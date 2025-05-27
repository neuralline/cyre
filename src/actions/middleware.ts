// src/actions/middleware.ts

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {middlewares} from '../context/state'
import {log} from '../components/cyre-log'

/*

    C.Y.R.E - A.C.T.I.O.N.S - M.I.D.D.L.E.W.A.R.E

    Proper middleware chaining with correct next() handling
    The issue was that middleware was calling next() but the result wasn't being returned properly

*/

/**
 * Middleware protection function with proper payload transformation and next() calling
 */
export const middlewareAction = async (
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
      log.debug(`Applying middleware '${middlewareId}' to action ${action.id}`)

      // Create a proper next function for this middleware
      const middlewareNext = async (
        processedPayload: ActionPayload
      ): Promise<CyreResponse> => {
        log.debug(
          `Middleware '${middlewareId}' called next() with processed payload`
        )

        // Actually call the next middleware or final handler
        // The middleware next() should continue the chain, not call the original next directly
        currentPayload = processedPayload

        // Continue to next middleware or final execution
        const remainingMiddleware = action.middleware!.slice(
          action.middleware!.indexOf(middlewareId) + 1
        )

        if (remainingMiddleware.length > 0) {
          // More middleware to process - create sub-action with remaining middleware
          const subAction = {
            ...currentAction,
            middleware: remainingMiddleware
          }
          return middlewareAction(subAction, processedPayload, next)
        } else {
          // No more middleware - call the final handler
          log.debug(
            `All middleware processed for ${action.id}, calling final handler`
          )
          return next(processedPayload)
        }
      }

      // Call middleware function with proper Promise handling
      const result = await Promise.resolve(
        middleware.fn(currentAction, currentPayload)
      )

      // Check the result type properly
      if (result === null || result === undefined) {
        log.debug(
          `Middleware '${middlewareId}' rejected action by returning null/undefined`
        )

        // Track middleware rejection - import here to avoid circular deps
        try {
          const {metricsReport} = await import('../context/metrics-report')
          metricsReport.trackMiddlewareRejection(action.id)
        } catch (error) {
          // Metrics not available - continue without tracking
        }

        return {
          ok: false,
          payload: null,
          message: `Action rejected by middleware '${middlewareId}'`
        }
      }

      // Handle different middleware return patterns
      if (typeof result === 'object' && 'ok' in result) {
        // Middleware returned a CyreResponse directly
        if (!result.ok) {
          log.debug(
            `Middleware '${middlewareId}' rejected action with response`
          )

          return result as CyreResponse
        }

        // Middleware returned success response - extract payload if available
        if ('payload' in result && result.payload !== null) {
          currentPayload = result.payload
        }

        log.debug(
          `Middleware '${middlewareId}' returned success response, continuing chain`
        )
        // Continue with the current payload
      } else if (
        typeof result === 'object' &&
        'action' in result &&
        'payload' in result
      ) {
        // Middleware returned traditional {action, payload} format
        log.debug(`Middleware '${middlewareId}' returned action/payload format`)
        currentAction = result.action
        currentPayload = result.payload
      } else {
        // Middleware returned some other format - treat as rejection
        log.warn(
          `Middleware '${middlewareId}' returned unexpected format, treating as rejection`
        )

        // Track middleware rejection - import here to avoid circular deps
        try {
          const {metricsReport} = await import('../context/metrics-report')
          metricsReport.trackMiddlewareRejection(action.id)
        } catch (error) {
          // Metrics not available - continue without tracking
        }

        return {
          ok: false,
          payload: null,
          message: `Middleware '${middlewareId}' returned invalid format`
        }
      }

      log.debug(
        `Middleware '${middlewareId}' successfully processed action ${action.id}`
      )
    } catch (error) {
      log.error(`Middleware '${middlewareId}' failed: ${error}`)

      // Track middleware rejection - import here to avoid circular deps
      try {
        const {metricsReport} = await import('../context/metrics-report')
        metricsReport.trackMiddlewareRejection(action.id)
      } catch (error) {
        // Metrics not available - continue without tracking
      }

      return {
        ok: false,
        payload: null,
        message: `Middleware error: ${
          error instanceof Error ? error.message : String(error)
        }`
      }
    }
  }

  // All middleware passed - execute with the final transformed payload
  log.debug(
    `All middleware completed for ${action.id}, executing final handler`
  )
  return next(currentPayload)
}
