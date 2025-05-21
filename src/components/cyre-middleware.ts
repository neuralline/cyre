// src/components/cyre-middleware.ts

import type {IO, ActionPayload} from '../interfaces/interface'
import {log} from './cyre-logger'
import {io, middlewares} from '../context/state'
import {addMiddlewareToAction} from './cyre-protection'

/* 
      C.Y.R.E. - M.I.D.D.L.E.W.A.R.E
*/

// Define the middleware function type more precisely
export type MiddlewareFunction = (
  action: IO,
  payload: ActionPayload
) =>
  | Promise<{action: IO; payload: ActionPayload} | null>
  | {action: IO; payload: ActionPayload}
  | null

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
 * Update an action to include a middleware ID in its middleware array
 * @param actionId The ID of the action to update
 * @param middlewareId The ID of the middleware to add
 * @returns boolean indicating success
 */
export const attachMiddlewareToAction = (
  actionId: string,
  middlewareId: string
): boolean => {
  try {
    const action = io.get(actionId)
    if (!action) {
      log.warn(`Cannot attach middleware to non-existent action: ${actionId}`)
      return false
    }

    // Use enhanced function to add middleware and rebuild pipeline
    const updatedAction = addMiddlewareToAction(action, middlewareId)

    // Update the action in the store
    io.set(updatedAction)
    log.debug(`Middleware ${middlewareId} attached to action ${actionId}`)

    return true
  } catch (error) {
    log.error(`Failed to attach middleware to action: ${error}`)
    return false
  }
}

/**
 * Apply middleware chain to an action and payload with enhanced error handling
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

  // Debug logging of middleware chain for troubleshooting
  log.debug(
    `Applying middleware chain for ${action.id}: ${action.middleware.join(
      ', '
    )}`
  )

  for (const middlewareId of action.middleware) {
    // Get middleware from centralized store
    const middleware = middlewares.get(middlewareId)
    if (!middleware) {
      log.warn(`Middleware '${middlewareId}' not found and will be skipped`)
      continue
    }

    try {
      // Call middleware function with current state - properly handle Promise
      log.debug(`Executing middleware '${middlewareId}'`)
      const middlewareResult = await Promise.resolve(
        middleware.fn(result.action, result.payload)
      )

      // If middleware returned null, reject the action
      if (middlewareResult === null) {
        log.info(`Middleware '${middlewareId}' rejected the action`)
        return null
      }

      // Otherwise, update our result state for the next middleware
      result = middlewareResult
      log.debug(`Middleware '${middlewareId}' processed successfully`)
    } catch (error) {
      log.error(`Middleware '${middlewareId}' failed: ${error}`)
      return null
    }
  }

  return result
}

/**
 * Applies middleware to an action with better error handling - USE THIS DIRECTLY ONLY FOR SPECIAL CASES
 * In normal operation, middleware should be applied through the protection pipeline
 */
export const safeApplyMiddleware = async (
  action: IO,
  payload: ActionPayload
): Promise<{
  action: IO
  payload: ActionPayload
} | null> => {
  try {
    if (
      !action.middleware ||
      !Array.isArray(action.middleware) ||
      action.middleware.length === 0
    ) {
      return {action, payload}
    }

    log.debug(
      `Applying ${action.middleware.length} middleware to action ${action.id}`
    )

    // Apply middleware with proper error handling
    const result = await applyMiddleware(action, payload)

    if (result) {
      log.debug(`Middleware successfully applied to ${action.id}`)
      return result
    } else {
      log.info(`Action ${action.id} rejected by middleware`)
      return null
    }
  } catch (error) {
    log.error(`Error applying middleware to ${action.id}: ${error}`)
    return null
  }
}

/**
 * Testing utility to clear all middleware - USE ONLY IN TESTS
 */
export const clearAllMiddleware = (): void => {
  middlewares.clear()
}
