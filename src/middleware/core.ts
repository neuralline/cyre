// src/middleware/core.ts
// Unified middleware system - single execution chain for all protections

import type {ActionPayload} from '../types/interface'
import {
  BuiltinMiddlewareFunction,
  ExternalMiddlewareContext,
  ExternalMiddlewareFunction,
  InternalMiddlewareContext,
  MiddlewareEntry,
  MiddlewareResult,
  NextFunction
} from '../types/middleware'

/*

      C.Y.R.E. - M.I.D.D.L.E.W.A.R.E - C.O.R.E.
      
      Unified middleware architecture:
      - Single execution chain for all protections
      - Built-in middleware with state access (internal only)
      - External middleware without state access (user-facing)
      - Zero overhead for actions without middleware
      - Dynamic chain building based on action configuration

*/

/**
 * Create safe external context (strips internal properties)
 */
export const createExternalContext = (
  internal: InternalMiddlewareContext
): ExternalMiddlewareContext => {
  const {action, payload, timestamp, executionId} = internal

  // Strip internal properties from action
  const safeAction = {
    id: action.id,
    type: action.type,
    payload: action.payload,
    interval: action.interval,
    repeat: action.repeat,
    delay: action.delay,
    throttle: action.throttle,
    debounce: action.debounce,
    detectChanges: action.detectChanges,
    log: action.log,
    priority: action.priority,
    timestamp: action.timestamp,
    timeOfCreation: action.timeOfCreation
  } as const

  return {
    action: safeAction,
    payload,
    timestamp,
    executionId
  }
}

/**
 * Create continue result helper
 */
export const continueMiddleware = (
  payload?: ActionPayload
): MiddlewareResult => ({
  type: 'continue',
  payload
})

/**
 * Create block result helper
 */
export const blockMiddleware = (
  reason: string,
  metadata?: Record<string, any>
): MiddlewareResult => ({
  type: 'block',
  reason,
  metadata
})

/**
 * Create delay result helper
 */
export const delayMiddleware = (
  duration: number,
  payload?: ActionPayload,
  metadata?: Record<string, any>
): MiddlewareResult => ({
  type: 'delay',
  duration,
  payload,
  metadata
})

/**
 * Create transform result helper
 */
export const transformMiddleware = (
  payload: ActionPayload
): MiddlewareResult => ({
  type: 'transform',
  payload
})

/**
 * Default next function (end of chain)
 */
export const createDefaultNext = (payload?: ActionPayload): NextFunction => {
  return async (nextPayload?: ActionPayload) => ({
    type: 'continue',
    payload: nextPayload ?? payload
  })
}

/**
 * Compose middleware functions into execution chain
 */
export const composeMiddleware = (
  middlewares: MiddlewareEntry[],
  context: InternalMiddlewareContext
): NextFunction => {
  if (middlewares.length === 0) {
    return createDefaultNext(context.payload)
  }

  // Create the chain from right to left (last middleware first)
  const chain = middlewares.reduceRight<NextFunction>((next, middleware) => {
    return async (payload?: ActionPayload) => {
      const updatedContext = {
        ...context,
        payload: payload ?? context.payload
      }

      try {
        if (middleware.type === 'builtin') {
          return await (middleware.fn as BuiltinMiddlewareFunction)(
            updatedContext,
            next
          )
        } else {
          const externalContext = createExternalContext(updatedContext)
          return await (middleware.fn as ExternalMiddlewareFunction)(
            externalContext,
            next
          )
        }
      } catch (error) {
        return blockMiddleware(
          `Middleware ${middleware.id} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
  }, createDefaultNext(context.payload))

  return chain
}
