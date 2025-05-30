// src/types/core.ts
// Enhanced core types with state reactivity support

import type {Schema} from '../schema/cyre-schema'

export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'background'
export type ActionPayload = any
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

export interface CyreResponse<T = any> {
  ok: boolean
  payload: T
  message: string
  error?: any
  timestamp?: number
  metadata?: {
    executionTime?: number
    scheduled?: boolean
    delayed?: boolean
    duration?: number
    interval?: number
    delay?: number
    repeat?: number | boolean
    intraLink?: {
      id: string
      payload?: ActionPayload
    }
    chainResult?: CyreResponse
    validationPassed?: boolean
    validationErrors?: string[]
    conditionMet?: boolean
    selectorApplied?: boolean
    transformApplied?: boolean
    [key: string]: any
  }
}

export type EventHandler = (...args: any[]) => any
export type MiddlewareFunction = (...args: any[]) => any

export interface ISubscriber {
  id: string
  fn: any
}

export interface IMiddleware {
  id: string
  fn: any
}

export interface SubscriptionResponse {
  ok: boolean
  message: string
  unsubscribe?: () => boolean
}

// State reactivity function types
export type ConditionFunction = (payload: ActionPayload) => boolean
export type SelectorFunction = (payload: ActionPayload) => any
export type TransformFunction = (payload: ActionPayload) => any

// Protection pipeline function type
export type ProtectionFn = (ctx: {
  action: IO
  payload: ActionPayload
  originalPayload: ActionPayload
  metrics: any
  timestamp: number
}) =>
  | {pass: true; payload?: ActionPayload}
  | {pass: false; reason: string; delayed?: boolean; duration?: number}

export interface IO {
  /** Unique identifier for this action */
  id: string
  /** Optional grouping category (defaults to id if not specified) */
  type?: string
  /** Initial or default payload data */
  payload?: any
  /** Require payload to be provided - boolean for basic requirement, 'non-empty' for non-empty requirement */
  required?: boolean | 'non-empty'
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
  /** Maximum wait for debounce */
  maxWait?: number
  /** Only execute if payload has changed from previous execution */
  detectChanges?: boolean
  /** Enable logging for this action */
  log?: boolean
  /** Priority level for execution during system stress */
  priority?: PriorityConfig
  /** Middleware functions to process action before execution */
  middleware?: string[]
  /** Schema validation for payload */
  schema?: Schema<any>
  /** Block this action from execution */
  block?: boolean

  // State reactivity options
  /** Only execute when this condition returns true */
  condition?: ConditionFunction
  /** Select specific part of payload to watch for changes */
  selector?: SelectorFunction
  /** Transform payload before execution */
  transform?: TransformFunction

  // Internal optimization fields
  /** Pre-compiled protection pipeline for performance */
  _protectionPipeline?: ProtectionFn[]
  /** Active debounce timer ID */
  _debounceTimer?: string
  /** Flag to bypass debounce protection for internal use */
  _bypassDebounce?: boolean

  /** Allow indexing with string keys for additional properties */
  [key: string]: any
}

export type ActionPipelineFunction = (...args: any[]) => any

export type Result<T, E = Error> =
  | {kind: 'ok'; value: T}
  | {kind: 'error'; error: E}

export type On = (...args: any[]) => any

// Protection system types
export type ProtectionType =
  | 'system-recuperation'
  | 'required-payload'
  | 'zero-repeat-block'
  | 'throttle'
  | 'debounce'
  | 'change-detection'
  | 'schema-validation'
  | 'condition-check'
  | 'payload-selection'
  | 'payload-transform'

export interface BaseProtectionConfig {
  readonly type: ProtectionType
  readonly enabled: boolean
}

// Additional protection config interfaces for new features
export interface ConditionConfig extends BaseProtectionConfig {
  readonly type: 'condition-check'
  readonly conditionFunction: ConditionFunction
}

export interface SelectorConfig extends BaseProtectionConfig {
  readonly type: 'payload-selection'
  readonly selectorFunction: SelectorFunction
}

export interface TransformConfig extends BaseProtectionConfig {
  readonly type: 'payload-transform'
  readonly transformFunction: TransformFunction
}

// ... existing protection config types remain the same

export interface ProtectionResult<T = unknown> {
  readonly success: boolean
  readonly proceed: boolean
  readonly data: T
  readonly scheduled: boolean
  readonly blocked: boolean
  readonly reason?: string
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface ProtectionPipelineResult<T = unknown> {
  readonly ok: boolean
  readonly message: string
  readonly payload: T
  readonly blocked?: boolean
  readonly scheduled?: boolean
  readonly duration?: number
  readonly metadata?: Readonly<Record<string, unknown>>
}

export type ProtectionFunction<
  TConfig extends BaseProtectionConfig = BaseProtectionConfig
> = (config: TConfig, payload?: unknown) => Promise<ProtectionResult>

export interface ProtectionRegistry {
  readonly [key: string]: ProtectionFunction
}

export interface TimerManager {
  readonly create: (
    id: string,
    duration: number,
    callback: () => void
  ) => Promise<{success: boolean; error?: string}>
  readonly clear: (id: string) => boolean
  readonly exists: (id: string) => boolean
}

export interface ProtectionContext {
  readonly actionId: string
  readonly currentTime: number
  readonly systemState: {
    readonly isRecuperating: boolean
    readonly stress: number
  }
  readonly actionState: {
    readonly lastExecutionTime: number
    readonly previousPayload?: unknown
    readonly debounceTimerId?: string
  }
  readonly timerManager: TimerManager
}
