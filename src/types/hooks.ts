// src/types/hooks-interface.ts
// Hooks and Channel related types

import {
  IO,
  EventHandler,
  ActionPayload,
  SubscriptionResponse,
  CyreResponse,
  Priority
} from './core'

/// src/types/use-cyre.ts
// Clean types for useCyre hook - simple single channel management

/**
 * Any cyre-like instance that useCyre can work with
 */
export interface CyreInstance {
  action: (config: IO) => {ok: boolean; message: string}
  on: (id: string, handler: EventHandler) => SubscriptionResponse
  call: (id: string, payload?: any) => Promise<CyreResponse>
  get?: (id: string) => IO | undefined
  forget: (id: string) => boolean
}

/**
 * Configuration for useCyre hook - core system aligned
 */
export interface UseCyreConfig<TPayload = ActionPayload> {
  /** Channel name (used as ID if channelId not provided) */
  name?: string
  /** Explicit channel ID (overrides name) */
  channelId?: string

  // Core system properties (direct, not nested)
  /** Throttle time in milliseconds */
  throttle?: number
  /** Debounce time in milliseconds */
  debounce?: number
  /** Maximum wait time for debounce */
  maxWait?: number
  /** Only execute when payload changes */
  detectChanges?: boolean

  // Core system scheduling
  /** Delay before execution */
  delay?: number
  /** Interval for repeated execution */
  interval?: number
  /** Number of times to repeat */
  repeat?: number | boolean

  // Core system processing
  /** Priority level */
  priority?: Priority
  /** Payload is required */
  required?: boolean
  /** Block channel from execution */
  block?: boolean
  /** Path for organization */
  path?: string

  // Core system talents
  /** Schema validation function */
  schema?: (payload: any) => any
  /** Condition for execution */
  condition?: (payload: any) => boolean
  /** Transform payload */
  transform?: (payload: any) => any
  /** Select from payload */
  selector?: (payload: any) => any

  // Initial state
  /** Initial payload */
  initialPayload?: TPayload
}

/**
 * Simple channel interface returned by useCyre
 */
export interface CyreChannel<TPayload = ActionPayload> {
  /** Channel ID */
  id: string
  /** Channel name */
  name: string

  /** Subscribe to channel */
  on: (
    handler: EventHandler
  ) => SubscriptionResponse & {unsubscribe: () => boolean}

  /** Call channel */
  call: (payload?: TPayload) => Promise<CyreResponse>

  /** Update channel configuration */
  update: (config: Partial<UseCyreConfig<TPayload>>) => {
    ok: boolean
    message: string
  }

  /** Get channel info */
  get: () => IO | undefined

  /** Remove channel */
  forget: () => boolean
}

/**
 * Any channel-like object that useCompose can work with
 */
export interface ChannelLike<TPayload = ActionPayload> {
  id: string
  name?: string
  call: (payload?: TPayload) => Promise<CyreResponse>
  on?: (
    handler: EventHandler
  ) => SubscriptionResponse & {unsubscribe?: () => boolean}
}

/**
 * Execution strategy for composition
 */
export type ExecutionStrategy = 'parallel' | 'sequential'

/**
 * Error handling strategy
 */
export type ErrorStrategy = 'fail-fast' | 'continue' | 'collect'

/**
 * Configuration for useCompose hook
 */
export interface UseComposeConfig {
  /** Composition name for debugging */
  name?: string
  /** Execution strategy */
  strategy?: ExecutionStrategy
  /** Error handling strategy */
  errorStrategy?: ErrorStrategy
  /** Timeout for entire composition (ms) */
  timeout?: number
  /** Priority for composed operations */
  priority?: Priority
}

/**
 * Result from individual channel execution
 */
export interface ChannelExecutionResult extends CyreResponse {
  /** Channel that produced this result */
  channelId: string
  /** Channel name for identification */
  channelName?: string
  /** Execution order in composition */
  executionOrder: number
  /** Execution time in milliseconds */
  executionTime: number
  /** Whether channel was skipped */
  skipped?: boolean
  /** Original error if channel failed */
  originalError?: Error | string
}

/**
 * Simple composed channel interface
 */
export interface ComposedChannel<TPayload = ActionPayload> {
  /** Composition ID */
  id: string
  /** Composition name */
  name: string
  /** Individual channels */
  channels: ChannelLike<TPayload>[]

  /** Execute all channels */
  call: (payload?: TPayload) => Promise<CyreResponse>

  /** Subscribe to all channels */
  on: (
    handler: EventHandler
  ) => SubscriptionResponse & {unsubscribe: () => boolean}

  /** Add channel to composition */
  add: (channel: ChannelLike<TPayload>) => void

  /** Remove channel from composition */
  forget: (channelId: string) => boolean

  /** Get composition stats */
  getStats: () => {
    channelCount: number
    lastExecutionTime: number
    totalExecutions: number
    successRate: number
  }
}
