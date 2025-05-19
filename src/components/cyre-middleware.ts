// src/components/cyre-middleware.ts

import type {IO, ActionPayload} from '../interfaces/interface'
import {log} from './cyre-logger'
import {middlewares} from '../context/state'

/* 
      C.Y.R.E. - M.I.D.D.L.E.W.A.R.E
*/

// Define the middleware function type
export type MiddlewareFunction = (
  action: IO,
  payload: ActionPayload
) => Promise<{action: IO; payload: ActionPayload} | null>

/**
 * Register a middleware function
 * @param id Unique middleware identifier
 * @param fn Middleware function
 * @returns boolean indicating success
 */
export const registerMiddleware = (id: string, fn: Function): boolean => {
  try {
    if (!id || typeof id !== 'string') {
      log.error('Invalid middleware ID')
      return false
    }

    if (typeof fn !== 'function') {
      log.error('Invalid middleware function')
      return false
    }

    // Store middleware in the central repository
    middlewares.add({
      id,
      fn
    })

    log.info(`Middleware '${id}' registered successfully`)
    return true
  } catch (error) {
    log.error(`Failed to register middleware: ${error}`)
    return false
  }
}

/**
 * Apply middleware chain to an action and payload
 * @param action The action to process
 * @param payload The action payload
 * @returns Processed action and payload, or null if rejected
 */
export const applyMiddleware = async (
  action: IO,
  payload: ActionPayload
): Promise<{action: IO; payload: ActionPayload} | null> => {
  if (
    !action.middleware ||
    !Array.isArray(action.middleware) ||
    action.middleware.length === 0
  ) {
    return {action, payload}
  }

  let result = {action, payload}

  for (const middlewareId of action.middleware) {
    // Get middleware from centralized store
    const middleware = middlewares.get(middlewareId)
    if (!middleware) {
      log.warn(`Middleware '${middlewareId}' not found and will be skipped`)
      continue
    }

    try {
      // Call middleware function with current state
      const middlewareResult = await middleware.fn(
        result.action,
        result.payload
      )

      // If middleware returned null, reject the action
      if (middlewareResult === null) {
        log.info(`Middleware '${middlewareId}' rejected the action`)
        return null
      }

      // Otherwise, update our result state for the next middleware
      result = middlewareResult
    } catch (error) {
      log.error(`Middleware '${middlewareId}' failed: ${error}`)
      return null
    }
  }

  return result
}
