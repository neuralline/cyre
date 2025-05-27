// src/actions/index.ts
// Individual action pipeline functions

import type {
  IO,
  ActionPayload,
  CyreResponse,
  ActionPipelineFunction
} from '../types/interface'
import {io, middlewares} from '../context/state'
import {metricsState} from '../context/metrics-state'
import {log} from '../components/cyre-log'
import timeKeeper from '../components/cyre-timekeeper'

/*

      C.Y.R.E. - A.C.T.I.O.N.S.
      
      Individual action pipeline functions following ActionPipelineFunction interface:
      - Each function handles one specific protection/feature
      - Functions can be composed into pipelines
      - Clean separation of concerns
      - Pure functional approach

*/

// Store debounce timers
const debounceTimers = new Map<string, string>()

/**
 * System recuperation check - only critical actions during recuperation
 */
export const useRecuperation: ActionPipelineFunction = (
  action: IO,
  payload: ActionPayload,
  timer: any
): CyreResponse => {
  const {breathing} = metricsState.get()

  if (breathing.isRecuperating && action.priority?.level !== 'critical') {
    return {
      ok: false,
      payload: null,
      message: `System recuperating (${(
        breathing.recuperationDepth * 100
      ).toFixed(1)}% depth). Only critical actions allowed.`
    }
  }

  return {
    ok: true,
    payload,
    message: 'Recuperation check passed'
  }
}

/**
 * Block actions with repeat: 0
 */
export const useBlock: ActionPipelineFunction = (
  action: IO,
  payload: ActionPayload,
  timer: any
): CyreResponse => {
  if (action.repeat === 0) {
    return {
      ok: false,
      payload: null,
      message: 'Action blocked: repeat is 0'
    }
  }

  return {
    ok: true,
    payload,
    message: 'Block check passed'
  }
}

/**
 * Throttle protection - industry standard implementation
 */
export const useThrottle: ActionPipelineFunction = (
  action: IO,
  payload: ActionPayload,
  timer: any
): CyreResponse => {
  if (!action.throttle) {
    return {
      ok: true,
      payload,
      message: 'No throttle configured'
    }
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

  return {
    ok: true,
    payload,
    message: 'Throttle check passed'
  }
}

/**
 * Debounce protection - collapses rapid calls
 */
export const useDebounce: ActionPipelineFunction = (
  action: IO,
  payload: ActionPayload,
  timer: any
): CyreResponse => {
  if (!action.debounce) {
    return {
      ok: true,
      payload,
      message: 'No debounce configured'
    }
  }

  // Cancel existing debounce timer
  const existingTimerId = debounceTimers.get(action.id)
  if (existingTimerId) {
    timeKeeper.forget(existingTimerId)
  }

  // For debounce, we need to delay execution
  // This will be handled by the pipeline executor
  const debounceTimerId = `${action.id}-debounce-${Date.now()}`
  debounceTimers.set(action.id, debounceTimerId)

  return {
    ok: false, // Block immediate execution
    payload: null,
    message: `Debounced: will execute after ${action.debounce}ms`,
    metadata: {
      debounce: {
        delay: action.debounce,
        timerId: debounceTimerId,
        payload: payload
      }
    }
  }
}

/**
 * Change detection - skip if payload unchanged
 */
export const useDetectChange: ActionPipelineFunction = (
  action: IO,
  payload: ActionPayload,
  timer: any
): CyreResponse => {
  if (!action.detectChanges) {
    return {
      ok: true,
      payload,
      message: 'No change detection configured'
    }
  }

  const hasChanged = io.hasChanged(action.id, payload)

  if (!hasChanged) {
    log.debug(`Change detection: no changes for ${action.id}`)
    return {
      ok: false,
      payload: null,
      message: 'Execution skipped: No changes detected in payload'
    }
  }

  return {
    ok: true,
    payload,
    message: 'Change detection passed'
  }
}

/**
 * Middleware processing - apply middleware chain
 */
export const useMiddleware: ActionPipelineFunction = (
  action: IO,
  payload: ActionPayload,
  timer: any
): CyreResponse => {
  if (!action.middleware || action.middleware.length === 0) {
    return {
      ok: true,
      payload,
      message: 'No middleware configured'
    }
  }

  // Middleware processing needs to be async, but ActionPipelineFunction is sync
  // We'll handle this differently in the pipeline executor
  return {
    ok: true,
    payload,
    message: 'Middleware processing required',
    metadata: {
      middleware: {
        ids: action.middleware,
        requiresAsync: true
      }
    }
  }
}

/**
 * Build action pipeline based on action configuration
 * Fast path: No pipeline functions for simple actions
 */
export const buildActionPipeline = (action: IO): ActionPipelineFunction[] => {
  const pipeline: ActionPipelineFunction[] = []

  // Check if action needs any protection features
  const needsProtection = !!(
    action.throttle ||
    action.debounce ||
    action.detectChanges ||
    (action.middleware && action.middleware.length > 0) ||
    action.repeat === 0 ||
    (action.priority?.level &&
      action.priority.level !== 'medium' &&
      action.priority.level !== undefined)
  )

  // If no protection needed, return empty pipeline for fast path
  if (!needsProtection) {
    return pipeline // Empty array = fast path
  }

  // Add protection functions only when needed

  // System recuperation check (only for non-critical actions that need protection)
  if (!action.priority?.level || action.priority.level !== 'critical') {
    pipeline.push(useRecuperation)
  }

  // Repeat: 0 check (only if repeat is explicitly set to 0)
  if (action.repeat === 0) {
    pipeline.push(useBlock)
  }

  // Add conditional pipeline functions based on action configuration
  if (action.throttle) {
    pipeline.push(useThrottle)
  }

  if (action.debounce) {
    pipeline.push(useDebounce)
  }

  if (action.detectChanges) {
    pipeline.push(useDetectChange)
  }

  if (action.middleware && action.middleware.length > 0) {
    pipeline.push(useMiddleware)
  }

  return pipeline
}

/**
 * Process middleware chain (async helper function)
 */
export const processMiddleware = async (
  action: IO,
  payload: ActionPayload
): Promise<CyreResponse> => {
  if (!action.middleware || action.middleware.length === 0) {
    return {
      ok: true,
      payload,
      message: 'No middleware to process'
    }
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

  return {
    ok: true,
    payload: currentPayload,
    message: 'All middleware processed successfully'
  }
}

/**
 * Process debounce delay (async helper function)
 */
export const processDebounce = async (
  action: IO,
  payload: ActionPayload,
  debounceData: any
): Promise<CyreResponse> => {
  const {delay, timerId} = debounceData

  return new Promise(resolve => {
    const timerResult = timeKeeper.keep(
      delay,
      () => {
        // Clean up timer reference
        debounceTimers.delete(action.id)

        resolve({
          ok: true,
          payload,
          message: 'Debounce delay completed'
        })
      },
      1, // Execute once
      timerId
    )

    if (timerResult.kind === 'error') {
      resolve({
        ok: false,
        payload: null,
        message: `Debounce setup failed: ${timerResult.error.message}`
      })
    }
  })
}
