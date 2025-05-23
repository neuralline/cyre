// src/actions/middleware.ts
// Middleware protection mechanism

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {middlewares} from '../context/state'
import {log} from '../components/cyre-log'
import {metricsReport} from '../context/metrics-report'

/*

    C.Y.R.E. - M.I.D.D.L.E.W.A.R.E. - A.C.T.I.O.N.S

    Applies middleware to transform action and payload

*/

/**
 * Middleware protection function with proper payload transformation
 */
export const applyMiddlewareProtection = async (
  action: IO,
  payload: ActionPayload,
  next: (transformedPayload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (
    !action.middleware ||
    !Array.isArray(action.middleware) ||
    action.middleware.length === 0
  ) {
    return next(payload)
  }

  let currentAction = action
  let currentPayload = payload

  // Apply middleware sequentially
  for (const middlewareId of action.middleware) {
    const middleware = middlewares.get(middlewareId)
    if (!middleware) {
      log.warn(`Middleware '${middlewareId}' not found and will be skipped`)
      continue
    }

    try {
      // Call middleware function with proper Promise handling
      const result = await Promise.resolve(
        middleware.fn(currentAction, currentPayload)
      )

      // If middleware returned null, reject the action
      if (result === null) {
        metricsReport.trackMiddlewareRejection(action.id)
        return {
          ok: false,
          payload: null,
          message: `Action rejected by middleware '${middlewareId}'`
        }
      }

      // Update current state for next middleware
      currentAction = result.action
      currentPayload = result.payload

      // Add debug logging for middleware execution
      log.debug(
        `Middleware '${middlewareId}' successfully processed action ${action.id}`
      )
    } catch (error) {
      log.error(`Middleware '${middlewareId}' failed: ${error}`)
      return {
        ok: false,
        payload: null,
        message: `Middleware error: ${
          error instanceof Error ? error.message : String(error)
        }`
      }
    }
  }

  // Execute with the final transformed payload
  return next(currentPayload)
}

/**
 * Check if action has middleware configured
 */
export const hasMiddleware = (action: IO): boolean => {
  return Boolean(
    action.middleware &&
      Array.isArray(action.middleware) &&
      action.middleware.length > 0
  )
}

/**
 * Get middleware count for an action
 */
export const getMiddlewareCount = (action: IO): number => {
  if (!hasMiddleware(action)) return 0
  return action.middleware!.length
}

/**
 * Validate middleware chain for an action
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

  if (!hasMiddleware(action)) {
    return result
  }

  for (const middlewareId of action.middleware!) {
    const middleware = middlewares.get(middlewareId)
    if (!middleware) {
      result.valid = false
      result.missing.push(middlewareId)
    } else if (typeof middleware.fn !== 'function') {
      result.valid = false
      result.errors.push(`Middleware '${middlewareId}' has invalid function`)
    }
  }

  return result
}
