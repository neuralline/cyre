// src/components/cyre-middleware.ts

import type {IO, ActionPayload} from '../interfaces/interface'
import {CyreLog} from './cyre-logger'

type MiddlewareFunction = (
  action: IO,
  payload: ActionPayload
) => Promise<{action: IO; payload: ActionPayload} | null>

/*

      C.Y.R.E. - A.C.T.I.O.N.S
      
      
*/

const middlewareRegistry = new Map<string, MiddlewareFunction>()

/**
 * Register a middleware function
 * @param id Unique middleware identifier
 * @param fn Middleware function
 */
export const registerMiddleware = (
  id: string,
  fn: MiddlewareFunction
): void => {
  if (middlewareRegistry.has(id)) {
    CyreLog.warn(`Middleware '${id}' already exists and will be overwritten`)
  }
  middlewareRegistry.set(id, fn)
}

/**
 * Apply middleware to an action
 * @param action The action to process
 * @param payload The action payload
 * @returns Processed action and payload or null if rejected
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
    const middleware = middlewareRegistry.get(middlewareId)
    if (!middleware) {
      CyreLog.warn(`Middleware '${middlewareId}' not found and will be skipped`)
      continue
    }

    try {
      const middlewareResult = await middleware(result.action, result.payload)
      if (!middlewareResult) {
        CyreLog.info(`Middleware '${middlewareId}' rejected the action`)
        return null
      }
      result = middlewareResult
    } catch (error) {
      CyreLog.error(`Middleware '${middlewareId}' failed: ${error}`)
      return null
    }
  }

  return result
}
