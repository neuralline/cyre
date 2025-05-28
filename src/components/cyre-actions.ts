// src/components/cyre-actions.ts

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {metricsReport} from '../context/metrics-report'
import {log} from './cyre-log'
import CyreChannel from './cyre-channels'
import dataDefinitions from '../elements/data-definitions'
import {io} from '../context/state'
import {metricsState} from '../context/metrics-state'
import {TimeKeeper} from '../components/cyre-timekeeper'

interface ProtectionResult {
  ok: boolean
  message: string
  payload?: ActionPayload
  blocked?: boolean
  delayed?: boolean
  duration?: number
  metadata?: Record<string, any>
}

/*

      C.Y.R.E - A.C.T.I.O.N.S
      
      Simplified action registration:
      - No external middleware in core
      - Clean channel creation and validation
      - Built-in protections automatically applied during execution

*/

// Debounce state management using Map for proper state tracking
const debounceState = new Map<
  string,
  {
    timerId: string
    lastPayload: ActionPayload
  }
>()

/**
 * Register single action - simplified without external middleware
 */
export const registerSingleAction = (
  attribute: IO
): {ok: boolean; message: string; payload?: any} => {
  try {
    // Validate and create channel
    const channelResult = CyreChannel(attribute, dataDefinitions)
    if (!channelResult.ok || !channelResult.payload) {
      metricsReport.sensor.error(
        attribute.id || 'unknown',
        channelResult.message,
        'action-validation'
      )
      return {ok: false, message: channelResult.message}
    }

    const validatedAction = channelResult.payload

    // Get built-in protection info for logging
    const protections = []
    if (validatedAction.throttle)
      protections.push(`throttle:${validatedAction.throttle}ms`)
    if (validatedAction.debounce)
      protections.push(`debounce:${validatedAction.debounce}ms`)
    if (validatedAction.detectChanges) protections.push('change-detection')
    if (validatedAction.priority)
      protections.push(`priority:${validatedAction.priority.level}`)

    const protectionInfo =
      protections.length > 0
        ? `with built-in protections: ${protections.join(', ')}`
        : 'with no protections'

    log.debug(`Action ${validatedAction.id} registered ${protectionInfo}`)

    metricsReport.sensor.log(
      validatedAction.id,
      'info',
      'action-registration',
      {
        protections,
        protectionCount: protections.length,
        protectionInfo
      }
    )

    return {
      ok: true,
      message: `Action registered ${protectionInfo}`,
      payload: validatedAction
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error(`Failed to register action ${attribute.id}: ${msg}`)
    metricsReport.sensor.error(
      attribute.id || 'unknown',
      msg,
      'action-registration'
    )
    return {ok: false, message: msg}
  }
}

/**
 * System recuperation protection
 */
const systemRecuperationProtection = async (
  action: IO,
  payload?: ActionPayload
): Promise<ProtectionResult> => {
  const systemState = metricsState.get()

  if (systemState.breathing.isRecuperating) {
    const priority = action.priority?.level || 'medium'

    if (priority !== 'critical') {
      metricsReport.sensor.log(action.id, 'blocked', 'system-recuperation', {
        priority,
        stress: systemState.stress.combined
      })

      return {
        ok: false,
        message: `System in recuperation - only critical actions allowed (current priority: ${priority})`,
        blocked: true,
        metadata: {
          protection: 'system-recuperation',
          stress: systemState.stress.combined,
          priority
        }
      }
    }
  }

  return {
    ok: true,
    message: 'System recuperation check passed',
    payload
  }
}

/**
 * Block repeat: 0 protection
 */
const blockZeroRepeatProtection = async (
  action: IO,
  payload?: ActionPayload
): Promise<ProtectionResult> => {
  if (action.repeat === 0) {
    metricsReport.sensor.log(action.id, 'blocked', 'zero-repeat-protection')

    return {
      ok: false,
      message: `Action registered with repeat: 0 - execution blocked`,
      blocked: true,
      metadata: {
        protection: 'zero-repeat',
        repeat: action.repeat
      }
    }
  }

  return {
    ok: true,
    message: 'Zero repeat check passed',
    payload
  }
}

/**
 * Throttle protection
 */
const throttleProtection = async (
  action: IO,
  payload?: ActionPayload
): Promise<ProtectionResult> => {
  if (!action.throttle || action.throttle <= 0) {
    return {
      ok: true,
      message: 'No throttle configured',
      payload
    }
  }

  const now = Date.now()
  const lastExecution = io.getMetrics(action.id)?.lastExecutionTime || 0
  const timeSinceLastExecution = now - lastExecution

  // Industry standard: First execution always passes (lastExecution === 0)
  if (lastExecution !== 0 && timeSinceLastExecution < action.throttle) {
    const remaining = action.throttle - timeSinceLastExecution

    metricsReport.sensor.throttle(action.id, remaining, 'throttle-protection')

    return {
      ok: false,
      message: `Throttled - ${remaining}ms remaining`,
      blocked: true,
      metadata: {
        protection: 'throttle',
        throttleMs: action.throttle,
        remaining,
        lastExecution
      }
    }
  }

  return {
    ok: true,
    message: 'Throttle check passed',
    payload
  }
}

/**
 * Debounce protection - proper implementation without imports
 */
const debounceProtection = async (
  action: IO,
  payload?: ActionPayload
): Promise<ProtectionResult> => {
  if (!action.debounce || action.debounce <= 0) {
    return {
      ok: true,
      message: 'No debounce configured',
      payload
    }
  }

  const currentPayload = payload || action.payload

  // Clear existing debounce timer if it exists
  const existingState = debounceState.get(action.id)
  if (existingState) {
    TimeKeeper.forget(existingState.timerId)
  }

  // Create unique timer ID
  const timerId = `${action.id}-debounce-${Date.now()}`

  // Store debounce state
  debounceState.set(action.id, {
    timerId,
    lastPayload: currentPayload
  })

  // Set new debounce timer using TimeKeeper
  const timerResult = TimeKeeper.keep(
    action.debounce,
    async () => {
      try {
        // Get the stored state to access the payload
        const storedState = debounceState.get(action.id)
        const executePayload = storedState?.lastPayload || currentPayload

        // Clean up debounce state
        debounceState.delete(action.id)

        // Execute the debounced call through dispatch
        const {useDispatch} = await import('./cyre-dispatch')
        await useDispatch(action, executePayload)
      } catch (error) {
        log.error(`Debounced execution failed for ${action.id}: ${error}`)
        debounceState.delete(action.id)
      }
    },
    1, // Execute once
    timerId
  )

  if (timerResult.kind === 'error') {
    log.error(
      `Failed to create debounce timer for ${action.id}: ${timerResult.error.message}`
    )
    debounceState.delete(action.id)
    return {
      ok: false,
      message: `Debounce timer failed: ${timerResult.error.message}`,
      blocked: true
    }
  }

  metricsReport.sensor.debounce(
    action.id,
    action.debounce,
    1,
    'debounce-protection'
  )

  return {
    ok: true,
    message: `Debounced - will execute in ${action.debounce}ms`,
    delayed: true,
    duration: action.debounce,
    payload: currentPayload,
    metadata: {
      protection: 'debounce',
      debounceMs: action.debounce,
      delayed: true,
      timerId
    }
  }
}

/**
 * Change detection protection
 */
const changeDetectionProtection = async (
  action: IO,
  payload?: ActionPayload
): Promise<ProtectionResult> => {
  if (!action.detectChanges) {
    return {
      ok: true,
      message: 'Change detection not enabled',
      payload
    }
  }

  const currentPayload = payload || action.payload
  const hasChanged = io.hasChanged(action.id, currentPayload)

  if (!hasChanged) {
    metricsReport.sensor.log(action.id, 'skip', 'change-detection', {
      reason: 'no-change-detected'
    })

    return {
      ok: false,
      message: 'Payload unchanged - execution skipped',
      blocked: true,
      metadata: {
        protection: 'change-detection',
        reason: 'no-change-detected'
      }
    }
  }

  return {
    ok: true,
    message: 'Change detected - execution allowed',
    payload: currentPayload
  }
}

/**
 * Built-in protection registry - extensible for new protections
 */
const builtInProtections = [
  {name: 'system-recuperation', fn: systemRecuperationProtection},
  {name: 'zero-repeat-block', fn: blockZeroRepeatProtection},
  {name: 'throttle', fn: throttleProtection},
  {name: 'debounce', fn: debounceProtection},
  {name: 'change-detection', fn: changeDetectionProtection}
]

/**
 * Apply all built-in protections to an action
 */
export const applyBuiltInProtections = async (
  action: IO,
  payload?: ActionPayload
): Promise<ProtectionResult> => {
  let currentPayload = payload

  try {
    for (const protection of builtInProtections) {
      const result = await protection.fn(action, currentPayload)

      // If protection blocks or delays execution, return immediately
      if (!result.ok || result.blocked || result.delayed) {
        return result
      }

      // Update payload if protection modified it
      if (result.payload !== undefined) {
        currentPayload = result.payload
      }
    }

    return {
      ok: true,
      message: 'All built-in protections passed',
      payload: currentPayload,
      metadata: {
        protectionsApplied: builtInProtections.map(p => p.name)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Built-in protection failed for ${action.id}: ${errorMessage}`)

    metricsReport.sensor.error(action.id, errorMessage, 'built-in-protections')

    return {
      ok: false,
      message: `Protection error: ${errorMessage}`,
      blocked: true,
      metadata: {
        protection: 'error',
        error: errorMessage
      }
    }
  }
}

/**
 * Add new built-in protection (for extending core functionality)
 */
export const addBuiltInProtection = (
  name: string,
  protectionFn: (
    action: IO,
    payload?: ActionPayload
  ) => Promise<ProtectionResult>
): void => {
  builtInProtections.push({name, fn: protectionFn})
  log.debug(`Added built-in protection: ${name}`)
}

/**
 * Get list of active built-in protections
 */
export const getBuiltInProtections = (): string[] => {
  return builtInProtections.map(p => p.name)
}

/**
 * Clear debounce state for action (cleanup)
 */
export const clearDebounceState = (actionId: string): void => {
  const state = debounceState.get(actionId)
  if (state) {
    TimeKeeper.forget(state.timerId)
    debounceState.delete(actionId)
  }
}

/**
 * Clear all protection state for action (cleanup)
 */
export const clearProtectionState = (actionId: string): void => {
  clearDebounceState(actionId)
}
