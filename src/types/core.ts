// src/types/core.ts - Permissive version
// Core type definitions for CYRE - relaxed for build compatibility

export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'background'
export type ActionPayload = any // More permissive
export type ActionId = string
export type StateKey = string

export interface PriorityConfig {
  level: Priority
  maxRetries?: number
  timeout?: number
  fallback?: () => Promise<void>
  baseDelay?: number
  maxDelay?: number
}

/**
 * Enhanced CyreResponse with proper typing
 */
export interface CyreResponse<T = any> {
  ok: boolean
  payload: T
  message: string
  error?: any // More permissive
  timestamp?: number
  metadata?: any // More permissive
}

/**
 * Event handler type for CYRE actions - more permissive
 */
export type EventHandler = (...args: any[]) => any

/**
 * Middleware function type - flexible signature
 */
export type MiddlewareFunction = (...args: any[]) => any

/**
 * Subscriber interface - flexible
 */
export interface ISubscriber {
  id: string
  fn: any // More permissive
}

/**
 * Middleware interface - flexible
 */
export interface IMiddleware {
  id: string
  fn: any // More permissive
}

/**
 * Subscription response
 */
export interface SubscriptionResponse {
  ok: boolean
  message: string
  unsubscribe?: () => boolean
}

/**
 * Configuration object for CYRE actions - permissive
 */

export interface IO {
  /** Unique identifier for this action */
  id: string
  /** Optional grouping category (defaults to id if not specified) */
  type?: string
  /** Initial or default payload data */
  payload?: any
  /** Milliseconds between executions for repeated actions */
  interval?: number
  /** Number of times to repeat execution, true for infinite repeats */
  repeat?: number | boolean
  /** Milliseconds to delay before first execution */
  delay?: number
  /** Minimum milliseconds between executions (rate limiting) */
  throttle?: number
  /** Collapse rapid calls within this window (milliseconds) */
  debounce?: number
  /** Only execute if payload has changed from previous execution */
  detectChanges?: boolean
  /** Enable logging for this action */
  log?: boolean
  /** ID of the debounce timer if one is active */
  debounceTimerId?: string
  /** Timestamp of last throttle execution */
  lastThrottleExecution?: number
  /** Priority level for execution during system stress */
  priority?: PriorityConfig
  /** Middleware functions to process action before execution */
  middleware?: string[]
  /** Protection pipeline functions for this action */
  _protectionPipeline?: any[]
  /** Flag to bypass debounce protection for internal use */
  _bypassDebounce?: boolean
  /** Allow indexing with string keys for additional properties */
  [key: string]: any
}
/**
 * Action pipeline function type - flexible
 */
export type ActionPipelineFunction = (...args: any[]) => any

/**
 * Result type for operations that might fail
 */
export type Result<T, E = Error> =
  | {kind: 'ok'; value: T}
  | {kind: 'error'; error: E}

/**
 * On function type - flexible
 */
export type On = (...args: any[]) => any
