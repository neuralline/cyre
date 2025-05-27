// src/actions/index.ts

// src/actions/throttle.ts
// src/actions/throttle.ts

import type {
  IO,
  ActionPayload,
  CyreResponse,
  ActionPipelineFunction
} from '../types/interface'
import {io, middlewares} from '../context/state'
import {log} from '../components/cyre-log'
import timeKeeper from '../components/cyre-timekeeper'
import {metricsState} from '../context/metrics-state'

/**
 * Apply throttle protection
 * Industry standard: First call executes, subsequent calls within interval are rejected
 */
export const applyThrottleProtection = async (
  action: IO,
  payload: ActionPayload,
  next: (payload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (!action.throttle) {
    return next(payload)
  }

  const now = Date.now()
  const metrics = io.getMetrics(action.id)
  const lastExecutionTime = metrics?.lastExecutionTime || 0
  const timeSinceLastExecution = now - lastExecutionTime

  if (timeSinceLastExecution < action.throttle) {
    const remaining = action.throttle - timeSinceLastExecution
    log.debug(`Throttled ${action.id}: ${remaining}ms remaining`)

    return {
      ok: false,
      payload: null,
      message: `Throttled: ${remaining}ms remaining`
    }
  }

  return next(payload)
}

/**
 * Check if action should be throttled
 */
export const useThrottle = (action: IO): boolean => {
  if (!action.throttle) return false

  const now = Date.now()
  const metrics = io.getMetrics(action.id)
  const lastExecutionTime = metrics?.lastExecutionTime || 0

  return now - lastExecutionTime < action.throttle
}

// ========================================
// src/actions/debounce.ts
// ========================================

// Store debounce timers
const debounceTimers = new Map<string, string>()

/**
 * Apply debounce protection
 * Collapses rapid calls into single execution with last payload
 */
export const useDebounce = async (
  action: IO,
  payload: ActionPayload,
  next: (payload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (!action.debounce) {
    return next(payload)
  }

  // Cancel existing debounce timer
  const existingTimerId = debounceTimers.get(action.id)
  if (existingTimerId) {
    timeKeeper.forget(existingTimerId)
  }

  // Create new debounce timer
  const debounceTimerId = `${action.id}-debounce-${Date.now()}`

  return new Promise(resolve => {
    const timerResult = timeKeeper.keep(
      action.debounce!,
      async () => {
        try {
          // Execute after debounce delay
          const result = await next(payload)

          // Clean up timer reference
          debounceTimers.delete(action.id)

          resolve(result)
        } catch (error) {
          debounceTimers.delete(action.id)
          resolve({
            ok: false,
            payload: null,
            message: `Debounce execution failed: ${error}`
          })
        }
      },
      1, // Execute once
      debounceTimerId
    )

    if (timerResult.kind === 'ok') {
      // Store timer ID for potential cancellation
      debounceTimers.set(action.id, debounceTimerId)

      // Don't resolve here - let timer callback resolve
      log.debug(
        `Debounced ${action.id}: will execute after ${action.debounce}ms`
      )
    } else {
      resolve({
        ok: false,
        payload: null,
        message: `Debounce setup failed: ${timerResult.error.message}`
      })
    }
  })
}

// ========================================
// src/actions/change-detection.ts
// ========================================

/**
 * Apply change detection protection
 * Skip execution if payload hasn't changed from previous
 */
export const useDetectChange = async (
  action: IO,
  payload: ActionPayload,
  next: (payload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (!action.detectChanges) {
    return next(payload)
  }

  const hasChanged = io.hasChanged(action.id, payload)

  if (!hasChanged) {
    log.debug(`Change detection: no changes for ${action.id}`)
    return {
      ok: true,
      payload: null,
      message: 'Execution skipped: No changes detected in payload'
    }
  }

  // Update payload history for next comparison
  const result = await next(payload)

  // Only update history if execution was successful
  if (result.ok) {
    // The io.hasChanged call above already updates the history
    // No additional action needed
  }

  return result
}

/**
 * Check if payload has changed
 */
export const hasPayloadChanged = (
  actionId: string,
  payload: ActionPayload
): boolean => {
  return io.hasChanged(actionId, payload)
}

/**
 * Get previous payload
 */
export const getPreviousPayload = (
  actionId: string
): ActionPayload | undefined => {
  return io.getPrevious(actionId)
}

/**
 * Update payload history
 */
export const updatePayloadHistory = (
  actionId: string,
  payload: ActionPayload
): void => {
  // This is handled internally by io.hasChanged()
  // Just call it to trigger the update
  io.hasChanged(actionId, payload)
}

// ========================================
// src/actions/middleware.ts
// ========================================

/**
 * Apply middleware protection
 * Process action through registered middleware functions
 */
export const useMiddleware = async (
  action: IO,
  payload: ActionPayload,
  next: (payload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (!action.middleware || action.middleware.length === 0) {
    return next(payload)
  }

  let currentAction = action
  let currentPayload = payload

  // Process middleware in sequence
  for (const middlewareId of action.middleware) {
    const middleware = middlewares.get(middlewareId)

    if (!middleware) {
      log.warn(`Middleware not found: ${middlewareId}`)
      continue
    }

    try {
      const middlewareResult = await middleware.fn(
        currentAction,
        currentPayload
      )

      if (!middlewareResult) {
        // Middleware rejected the action
        log.debug(`Middleware ${middlewareId} rejected action ${action.id}`)
        return {
          ok: false,
          payload: null,
          message: `Action rejected by middleware: ${middlewareId}`
        }
      }

      // Update action and payload with middleware results
      currentAction = middlewareResult.action
      currentPayload = middlewareResult.payload

      log.debug(`Middleware ${middlewareId} processed action ${action.id}`)
    } catch (error) {
      log.error(`Middleware ${middlewareId} failed: ${error}`)
      return {
        ok: false,
        payload: null,
        message: `Middleware ${middlewareId} failed: ${error}`
      }
    }
  }

  // All middleware passed, proceed with transformed data
  return next(currentPayload)
}

/**
 * Check if action has middleware
 */
export const hasMiddleware = (action: IO): boolean => {
  return !!(action.middleware && action.middleware.length > 0)
}

/**
 * Get middleware count
 */
export const getMiddlewareCount = (action: IO): number => {
  return action.middleware?.length || 0
}

/**
 * Validate middleware chain
 */
export const validateMiddlewareChain = (
  action: IO
): {
  valid: boolean
  missing: string[]
  errors: string[]
} => {
  const result = {
    valid: true,
    missing: [] as string[],
    errors: [] as string[]
  }

  if (!action.middleware || action.middleware.length === 0) {
    return result
  }

  for (const middlewareId of action.middleware) {
    const middleware = middlewares.get(middlewareId)

    if (!middleware) {
      result.missing.push(middlewareId)
      result.valid = false
    } else if (typeof middleware.fn !== 'function') {
      result.errors.push(`Invalid middleware function: ${middlewareId}`)
      result.valid = false
    }
  }

  return result
}

/**
 * Repeat zero check - don't execute actions with repeat: 0
 */
export const useBlock: ActionPipelineFunction = (
  action,
  payload,
  timer,
  next
): CyreResponse => {
  if (action.repeat === 0 || !action.id) {
    return {
      ok: false,
      payload: null,
      message: 'Call blocked'
    }
  }
  return {
    ok: true,
    payload: null,
    message: `from block action`
  }
}

/**
 * System recuperation check - only critical actions during recuperation
 */
export const useRecuperation: ActionPipelineFunction = (
  action,
  payload,
  timer,
  next
) => {
  const {breathing} = metricsState.get()
  if (breathing.isRecuperating && action.priority?.level !== 'critical') {
    return {
      ok: false,
      payload: null,
      message: `System recuperating. Only critical actions allowed.`
    }
  }
  return {
    ok: true,
    payload: null,
    message: `System is fine`
  }
}
