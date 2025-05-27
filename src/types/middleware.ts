// src/types/middleware.ts
// Type definitions for unified middleware system

import type {IO, ActionPayload} from './core'
import type {StateActionMetrics, QuantumState} from '../context/state'

/*

      C.Y.R.E. - M.I.D.D.L.E.W.A.R.E - T.Y.P.E.S.
      
      Type definitions for unified middleware system:
      - Separate contexts for internal vs external middleware
      - Result types for middleware execution
      - Chain management types
      - Security boundaries enforced through types

*/

/**
 * Internal middleware context with state access (built-in middleware only)
 */
export interface InternalMiddlewareContext {
  action: IO
  payload: ActionPayload
  state: {
    metrics: StateActionMetrics | undefined
    payloadHistory: ActionPayload | undefined
    systemState: QuantumState
  }
  timestamp: number
  executionId: string
}

/**
 * External middleware context without state access (user middleware)
 */
export interface ExternalMiddlewareContext {
  action: Readonly<
    Omit<IO, 'middleware' | '_protectionPipeline' | '_bypassDebounce'>
  >
  payload: ActionPayload
  timestamp: number
  executionId: string
}

/**
 * Middleware execution result types
 */
export type MiddlewareResult =
  | {type: 'continue'; payload?: ActionPayload}
  | {type: 'block'; reason: string; metadata?: Record<string, any>}
  | {
      type: 'delay'
      duration: number
      payload?: ActionPayload
      metadata?: Record<string, any>
    }
  | {type: 'transform'; payload: ActionPayload}

/**
 * Next function for middleware chain progression
 */
export type NextFunction = (
  payload?: ActionPayload
) => Promise<MiddlewareResult>

/**
 * Built-in middleware function signature (internal state access)
 */
export type BuiltinMiddlewareFunction = (
  context: InternalMiddlewareContext,
  next: NextFunction
) => Promise<MiddlewareResult>

/**
 * External middleware function signature (no state access)
 */
export type ExternalMiddlewareFunction = (
  context: ExternalMiddlewareContext,
  next: NextFunction
) => Promise<MiddlewareResult>

/**
 * Middleware registry entry
 */
export interface MiddlewareEntry {
  id: string
  type: 'builtin' | 'external'
  fn: BuiltinMiddlewareFunction | ExternalMiddlewareFunction
  description?: string
}

/**
 * Compiled middleware chain for an action
 */
export interface MiddlewareChain {
  actionId: string
  middlewares: string[]
  compiled: boolean
  fastPath: boolean
}

/**
 * Result from middleware chain execution
 */
export interface ChainExecutionResult {
  ok: boolean
  payload?: ActionPayload
  message: string
  blocked?: boolean
  delayed?: boolean
  duration?: number
  metadata?: Record<string, any>
}

/**
 * Middleware statistics for monitoring
 */
export interface MiddlewareStats {
  totalActions: number
  fastPathActions: number
  middlewareActions: number
  fastPathPercentage: number
  externalMiddlewareCount: number
  chains: Array<{
    actionId: string
    middlewareCount: number
    fastPath: boolean
    middlewares: string[]
  }>
}

/**
 * Middleware validation result
 */
export interface MiddlewareValidation {
  valid: boolean
  issues: string[]
  warnings: string[]
}

/**
 * Built-in middleware identifiers (internal use only)
 */
export enum BuiltinMiddlewareId {
  RECUPERATION = 'builtin:recuperation',
  BLOCK_ZERO_REPEAT = 'builtin:block-zero-repeat',
  THROTTLE = 'builtin:throttle',
  DEBOUNCE = 'builtin:debounce',
  CHANGE_DETECTION = 'builtin:change-detection',
  PRIORITY = 'builtin:priority'
}

/**
 * Helper types for middleware result creation
 */
export type ContinueResult = Extract<MiddlewareResult, {type: 'continue'}>
export type BlockResult = Extract<MiddlewareResult, {type: 'block'}>
export type DelayResult = Extract<MiddlewareResult, {type: 'delay'}>
export type TransformResult = Extract<MiddlewareResult, {type: 'transform'}>

/**
 * Middleware execution phase for debugging
 */
export type MiddlewarePhase =
  | 'validation'
  | 'protection'
  | 'transformation'
  | 'completion'

/**
 * Middleware error details
 */
export interface MiddlewareError {
  middlewareId: string
  phase: MiddlewarePhase
  error: Error | string
  context: {
    actionId: string
    executionId: string
    timestamp: number
  }
}
