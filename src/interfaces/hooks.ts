// src/interface/hooks.ts

import type {
  IO,
  EventHandler,
  ActionPayload,
  SubscriptionResponse,
  CyreResponse,
  PriorityConfig,
  BreathingMetrics
} from './interface'

/**
 * Protection options for channel
 */
export interface ProtectionOptions {
  /** Throttle time in milliseconds (minimum time between executions) */
  throttle?: number
  /** Debounce time in milliseconds (collapse calls within this window) */
  debounce?: number
  /** Whether to only execute when payload changes */
  detectChanges?: boolean
}

/**
 * Configuration options for creating a Cyre channel
 */
export interface CyreHookOptions<TPayload = ActionPayload> {
  /** Auto-initialize the channel action (default: true) */
  autoInit?: boolean
  /** Enable debug logging for channel operations */
  debug?: boolean
  /** Enable protection features for the channel */
  protection?: ProtectionOptions
  /** Set priority level for operations */
  priority?: PriorityConfig
  /** Initialize with specified payload */
  initialPayload?: TPayload
}

/**
 * Middleware function for preprocessing payloads and handling responses
 */
export type CyreMiddleware<TPayload = ActionPayload> = (
  payload: TPayload,
  next: (payload: TPayload) => Promise<CyreResponse>
) => Promise<CyreResponse>

/**
 * Subscription with unsubscribe capability
 */
export interface SubscriptionWithCleanup extends SubscriptionResponse {
  /** Function to remove this subscription */
  unsubscribe: () => void
}

/**
 * History entry for tracking channel calls
 */
export interface HistoryEntry<TPayload = ActionPayload> {
  /** Timestamp when call was made */
  timestamp: number
  /** Payload used for the call */
  payload: TPayload
  /** Response from Cyre system */
  response: CyreResponse
}

/**
 * Result type for operations that might fail
 */
export type Result<T, E = Error> =
  | {success: true; value: T}
  | {success: false; error: E}

/**
 * Cyre channel configuration (without ID)
 */
export type ChannelConfig = Omit<IO, 'id'>

/**
 * Base Cyre Hook interface
 */
export interface CyreHook<TPayload = ActionPayload> {
  /** Channel unique identifier */
  id: string

  /** Initialize or update channel configuration */
  action: (config: ChannelConfig) => Result<boolean, Error>

  /** Subscribe to channel events */
  on: (handler: EventHandler) => SubscriptionWithCleanup

  /** Trigger channel with payload */
  call: (payload?: TPayload) => Promise<CyreResponse>

  /** Safely call with error handling */
  safeCall: (payload?: TPayload) => Promise<Result<CyreResponse, Error>>

  /** Get current channel configuration */
  get: () => IO | undefined

  /** Remove channel and clean up resources */
  forget: () => boolean

  /** Pause channel execution */
  pause: () => void

  /** Resume channel execution */
  resume: () => void

  /** Check if payload has changed */
  hasChanged: (payload: TPayload) => boolean

  /** Get previous payload */
  getPrevious: () => TPayload | undefined

  /** Get performance metrics */
  metrics: () => any

  /** Get system breathing state */
  getBreathingState: () => BreathingMetrics

  /** Check if channel is initialized */
  isInitialized: () => boolean

  /** Add middleware for processing */
  middleware: (middleware: CyreMiddleware<TPayload>) => void

  /** Get execution history */
  getHistory: () => ReadonlyArray<HistoryEntry<TPayload>>

  /** Clear execution history */
  clearHistory: () => void

  /** Get subscription count */
  getSubscriptionCount: () => number
}

export type CyreChannel<TPayload = ActionPayload> = CyreHook<TPayload>
