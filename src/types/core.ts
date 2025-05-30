// src/types/core.ts - Updated with optimization fields
// Core type definitions for CYRE - with protection pipeline support

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

// Protection pipeline function type
export type ProtectionFn = (ctx: {
  action: IO
  payload: ActionPayload
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

  // Optimization fields (not exposed to users)
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

/**
 * On function type - flexible
 */
export type On = (...args: any[]) => any

// src/types/protection.ts
// Protection system type definitions

export type ProtectionType =
  | 'system-recuperation'
  | 'required-payload'
  | 'zero-repeat-block'
  | 'throttle'
  | 'debounce'
  | 'change-detection'

export interface BaseProtectionConfig {
  readonly type: ProtectionType
  readonly enabled: boolean
}

export interface ThrottleConfig extends BaseProtectionConfig {
  readonly type: 'throttle'
  readonly intervalMs: number
  readonly lastExecutionTime: number
}

export interface DebounceConfig extends BaseProtectionConfig {
  readonly type: 'debounce'
  readonly delayMs: number
  readonly maxWaitMs?: number
  readonly hasActiveTimer: boolean
  readonly timerId?: string
}

export interface ChangeDetectionConfig extends BaseProtectionConfig {
  readonly type: 'change-detection'
  readonly previousPayload?: unknown
}

export interface RequiredPayloadConfig extends BaseProtectionConfig {
  readonly type: 'required-payload'
  readonly requirement: boolean | 'non-empty'
}

export interface SystemRecuperationConfig extends BaseProtectionConfig {
  readonly type: 'system-recuperation'
  readonly isRecuperating: boolean
  readonly allowedPriorities: readonly string[]
}

export interface ZeroRepeatConfig extends BaseProtectionConfig {
  readonly type: 'zero-repeat-block'
  readonly repeatValue: number | boolean
}

export type ProtectionConfig =
  | ThrottleConfig
  | DebounceConfig
  | ChangeDetectionConfig
  | RequiredPayloadConfig
  | SystemRecuperationConfig
  | ZeroRepeatConfig

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
  TConfig extends ProtectionConfig = ProtectionConfig
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
