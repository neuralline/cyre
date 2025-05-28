// src/middleware/builtin.ts
// Built-in middleware functions with internal state access

import {continueMiddleware, blockMiddleware, delayMiddleware} from './core'
import {BREATHING} from '../config/cyre-config'
import {log} from '../components/cyre-log'
import {isEqual} from '../libs/utils'
import {BuiltinMiddlewareFunction} from '../types/middleware'
import {IO} from '../types/core'
import {metricsReport} from '../context/metrics-report'
import {io} from '../context/state'
import TimeKeeper from '../components/cyre-timekeeper'

/*

      C.Y.R.E. - B.U.I.L.T.I.N - M.I.D.D.L.E.W.A.R.E.
      
      Internal middleware functions with state access:
      - System recuperation check
      - Throttle protection
      - Debounce protection  
      - Change detection
      - Repeat blocking
      - Priority filtering
      
      These have access to internal state and metrics.
      Users cannot access or modify these functions.

*/

/**
 * System recuperation middleware - only critical actions during stress
 */
export const recuperationMiddleware: BuiltinMiddlewareFunction = async (
  context,
  next
) => {
  const {action, state} = context
  const {breathing} = state.systemState

  // Skip check for critical actions
  if (action.priority?.level === 'critical') {
    return next()
  }

  // Block non-critical actions during recuperation
  if (breathing.isRecuperating && breathing.stress > BREATHING.STRESS.HIGH) {
    return blockMiddleware(
      `System recuperating (${(breathing.recuperationDepth * 100).toFixed(
        1
      )}% depth). Only critical actions allowed.`,
      {
        stress: breathing.stress,
        recuperationDepth: breathing.recuperationDepth,
        requiredPriority: 'critical'
      }
    )
  }

  return next()
}

/**
 * Block middleware for repeat: 0 actions
 */
export const blockZeroRepeatMiddleware: BuiltinMiddlewareFunction = async (
  context,
  next
) => {
  const {action} = context

  if (action.repeat === 0) {
    return blockMiddleware('Action blocked: repeat is 0', {
      repeat: action.repeat
    })
  }

  return next()
}

/**
 * Throttle middleware - industry standard rate limiting
 */
export const throttleMiddleware: BuiltinMiddlewareFunction = async (
  context,
  next
) => {
  const {action, state} = context

  if (!action.throttle) {
    return next()
  }

  const now = Date.now()
  const lastExecutionTime = state.metrics?.lastExecutionTime || 0
  const timeSinceLastExecution = now - lastExecutionTime

  if (timeSinceLastExecution < action.throttle) {
    const remaining = action.throttle - timeSinceLastExecution

    log.debug(`Throttled ${action.id}: ${remaining}ms remaining`)

    return blockMiddleware(`Throttled: ${remaining}ms remaining`, {
      throttle: action.throttle,
      timeSinceLastExecution,
      remaining,
      lastExecutionTime
    })
  }

  return next()
}

/**
 * Debounce middleware - collapse rapid calls
 */
export const debounceMiddleware: BuiltinMiddlewareFunction = async (
  context,
  next
) => {
  const {action, payload} = context
  const debounceTime = action.debounce

  if (!debounceTime || debounceTime <= 0) {
    return next(payload)
  }

  try {
    // Get current action state
    const currentAction = io.get(action.id)
    if (!currentAction) {
      log.error(`Action ${action.id} not found in IO state for debounce`)
      return next(payload)
    }

    // Cancel existing debounce timer if it exists
    if (currentAction.debounceTimerId) {
      TimeKeeper.forget(currentAction.debounceTimerId)
      log.debug(`Cancelled existing debounce timer for ${action.id}`)

      metricsReport.sensor.log(action.id, 'debounce', 'debounce-middleware', {
        action: 'timer-cancelled',
        previousTimerId: currentAction.debounceTimerId
      })
    }

    // Generate unique timer ID
    const timerId = `${action.id}-debounce-${Date.now()}`

    // Update IO state with new timer ID and latest payload
    const updatedAction = {
      ...currentAction,
      debounceTimerId: timerId,
      payload: payload // Store latest payload
    }
    io.set(updatedAction)

    // Create debounce timer that will execute the actual dispatch
    const timerResult = TimeKeeper.keep(
      debounceTime,
      async () => {
        try {
          // Get the latest action state when timer executes
          const actionAtExecution = io.get(action.id)
          if (!actionAtExecution) {
            log.error(`Action ${action.id} not found during debounce execution`)
            return
          }

          // Clear the timer ID from action state
          const clearedAction = {
            ...actionAtExecution,
            debounceTimerId: undefined
          }
          io.set(clearedAction)

          log.debug(
            `Debounce timer fired for ${action.id} after ${debounceTime}ms`
          )

          metricsReport.sensor.log(
            action.id,
            'execution',
            'debounce-middleware',
            {
              action: 'debounce-executed',
              debounceTime,
              timerId
            }
          )

          // Execute the next middleware in chain with stored payload
          const result = await next(actionAtExecution.payload)

          // Handle the result appropriately
          if (!result || result.type === 'continue') {
            log.debug(`Debounced execution completed for ${action.id}`)
          } else {
            log.debug(
              `Debounced execution result for ${action.id}:`,
              result.type
            )
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          log.error(
            `Debounce execution failed for ${action.id}: ${errorMessage}`
          )

          metricsReport.sensor.error(
            action.id,
            errorMessage,
            'debounce-execution'
          )
        }
      },
      1, // Execute once
      timerId
    )

    if (timerResult.kind === 'error') {
      log.error(
        `Failed to create debounce timer for ${action.id}: ${timerResult.error.message}`
      )

      // Clear the timer ID since timer creation failed
      const failedAction = {...updatedAction, debounceTimerId: undefined}
      io.set(failedAction)

      metricsReport.sensor.error(
        action.id,
        timerResult.error.message,
        'debounce-timer-creation'
      )

      // Fall back to immediate execution
      return next(payload)
    }

    log.debug(
      `Debounce timer created for ${action.id}: ${debounceTime}ms delay`
    )

    metricsReport.sensor.log(action.id, 'debounce', 'debounce-middleware', {
      action: 'timer-created',
      debounceTime,
      timerId,
      collapsed: !!currentAction.debounceTimerId
    })

    // Return delay result - this tells the system to not continue immediately
    return {
      type: 'delay',
      duration: debounceTime,
      payload,
      metadata: {
        debounced: true,
        timerId,
        debounceTime
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Debounce middleware error for ${action.id}: ${errorMessage}`)

    metricsReport.sensor.error(action.id, errorMessage, 'debounce-middleware')

    // Fall back to immediate execution on error
    return next(payload)
  }
}

/**
 * Change detection middleware - skip unchanged payloads
 */
export const changeDetectionMiddleware: BuiltinMiddlewareFunction = async (
  context,
  next
) => {
  const {action, payload, state} = context

  if (!action.detectChanges) {
    return next()
  }

  const previousPayload = state.payloadHistory

  // If no previous payload, consider it changed
  if (previousPayload === undefined) {
    return next()
  }

  // Check for changes using deep equality
  const hasChanged = !isEqual(payload, previousPayload)

  if (!hasChanged) {
    log.debug(`Change detection: no changes for ${action.id}`)

    return blockMiddleware(
      'Execution skipped: No changes detected in payload',
      {
        previousPayload,
        currentPayload: payload,
        detectChanges: true
      }
    )
  }

  return next()
}

/**
 * Priority validation middleware
 */
export const priorityMiddleware: BuiltinMiddlewareFunction = async (
  context,
  next
) => {
  const {action, state} = context
  const {breathing} = state.systemState

  // During high stress, only allow high priority and above
  if (breathing.stress > BREATHING.STRESS.MEDIUM) {
    const priority = action.priority?.level || 'medium'

    if (priority === 'low' || priority === 'background') {
      return blockMiddleware(
        `System under stress (${(breathing.stress * 100).toFixed(
          1
        )}%). Low priority actions blocked.`,
        {
          systemStress: breathing.stress,
          actionPriority: priority,
          minimumRequired: 'medium'
        }
      )
    }
  }

  return next()
}

/**
 * Built-in middleware registry
 * Users cannot access these IDs or functions
 */
export const BUILTIN_MIDDLEWARE = {
  RECUPERATION: 'builtin:recuperation',
  BLOCK_ZERO_REPEAT: 'builtin:block-zero-repeat',
  THROTTLE: 'builtin:throttle',
  DEBOUNCE: 'builtin:debounce',
  CHANGE_DETECTION: 'builtin:change-detection',
  PRIORITY: 'builtin:priority'
} as const

/**
 * Get built-in middleware function by ID
 * Internal use only - not exposed to users
 */
export const getBuiltinMiddleware = (
  id: string
): BuiltinMiddlewareFunction | undefined => {
  switch (id) {
    case BUILTIN_MIDDLEWARE.RECUPERATION:
      return recuperationMiddleware
    case BUILTIN_MIDDLEWARE.BLOCK_ZERO_REPEAT:
      return blockZeroRepeatMiddleware
    case BUILTIN_MIDDLEWARE.THROTTLE:
      return throttleMiddleware
    case BUILTIN_MIDDLEWARE.DEBOUNCE:
      return debounceMiddleware
    case BUILTIN_MIDDLEWARE.CHANGE_DETECTION:
      return changeDetectionMiddleware
    case BUILTIN_MIDDLEWARE.PRIORITY:
      return priorityMiddleware
    default:
      return undefined
  }
}

/**
 * Check if middleware ID is built-in (internal check)
 */
export const isBuiltinMiddleware = (id: string): boolean => {
  return id.startsWith('builtin:')
}

/**
 * Build middleware chain based on action configuration
 * Automatically adds built-in middleware based on action properties
 */
export const buildMiddlewareChain = (action: IO): string[] => {
  const chain: string[] = []

  // Add built-in middleware only when needed
  // Order matters - more restrictive checks first

  // System recuperation (for non-critical actions)
  if (!action.priority?.level || action.priority.level !== 'critical') {
    chain.push(BUILTIN_MIDDLEWARE.RECUPERATION)
  }

  // Block zero repeat actions
  if (action.repeat === 0) {
    chain.push(BUILTIN_MIDDLEWARE.BLOCK_ZERO_REPEAT)
  }

  // Priority filtering (only if priority is set and not medium)
  if (action.priority?.level && action.priority.level !== 'medium') {
    chain.push(BUILTIN_MIDDLEWARE.PRIORITY)
  }

  // Throttle protection
  if (action.throttle) {
    chain.push(BUILTIN_MIDDLEWARE.THROTTLE)
  }

  // Debounce protection
  if (action.debounce) {
    chain.push(BUILTIN_MIDDLEWARE.DEBOUNCE)
  }

  // Change detection
  if (action.detectChanges) {
    chain.push(BUILTIN_MIDDLEWARE.CHANGE_DETECTION)
  }

  // Add external middleware (user-defined)
  if (action.middleware && action.middleware.length > 0) {
    chain.push(...action.middleware)
  }

  return chain
}

/**
 * Check if action needs any middleware (for fast path detection)
 */
export const needsMiddleware = (action: IO): boolean => {
  const hasBuiltinProtections = !!(
    action.throttle ||
    action.debounce ||
    action.detectChanges ||
    action.repeat === 0 ||
    (action.priority?.level && action.priority.level !== 'medium')
  )

  const hasExternalMiddleware = !!(
    action.middleware && action.middleware.length > 0
  )

  return hasBuiltinProtections || hasExternalMiddleware
}
