// src/types/hooks.ts
// Hook types including the missing GroupedChannel and UseGroupConfig

import {
  IO,
  EventHandler,
  ActionPayload,
  SubscriptionResponse,
  CyreResponse,
  Priority
} from './core'

/**
 * Any cyre-like instance that useCyre can work with
 */
export interface CyreInstance {
  action: (config: IO) => {ok: boolean; message: string}
  on: (id: string, handler: EventHandler) => SubscriptionResponse
  call: (id: string, payload?: any) => Promise<CyreResponse>
  get?: (id: string) => IO | undefined
  forget: (id: string) => boolean
  path: () => string
}

/**
 * Configuration for useCyre hook - core system aligned
 */
export interface UseCyreConfig<TPayload = ActionPayload> {
  /** Channel name (used as ID if channelId not provided) */
  name?: string
  /** Explicit channel ID (overrides name) */
  id?: string

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
  name?: string

  /** Subscribe to channel */
  on: (
    handler: EventHandler
  ) => SubscriptionResponse & {unsubscribe: () => boolean}

  /** Call channel */
  call: (payload?: TPayload) => Promise<CyreResponse>

  /** Update channel configuration */
  // update: (config: Partial<UseCyreConfig<TPayload>>) => {
  //   ok: boolean
  //   message: string
  // }

  /** Get channel info */
  get: () => IO | undefined

  /** Remove channel */
  forget: () => boolean
}

/**
 * Any channel-like object that useGroup can work with
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
 * Execution strategy for group coordination
 */
export type ExecutionStrategy = 'parallel' | 'sequential'

/**
 * Error handling strategy
 */
export type ErrorStrategy = 'fail-fast' | 'continue' | 'collect'

/**
 * Configuration for useGroup hook
 */
export interface UseGroupConfig {
  /** Group name for debugging */
  name?: string
  /** Execution strategy */
  strategy?: ExecutionStrategy
  /** Error handling strategy */
  errorStrategy?: ErrorStrategy
  /** Timeout for entire group execution (ms) */
  timeout?: number
  /** Priority for grouped operations */
  priority?: Priority
}

/**
 * Result from individual channel execution in a group
 */
export interface ChannelExecutionResult extends CyreResponse {
  /** Channel that produced this result */
  channelId: string
  /** Channel name for identification */
  channelName?: string
  /** Execution order in group */
  executionOrder: number
  /** Execution time in milliseconds */
  executionTime: number
  /** Whether channel was skipped */
  skipped?: boolean
  /** Original error if channel failed */
  originalError?: Error | string
}

/**
 * Grouped channel interface returned by useGroup
 */
export interface GroupedChannel<TPayload = ActionPayload> {
  /** Group ID */
  id: string
  /** Group name */
  name: string
  /** Individual channels */
  channels: ChannelLike<TPayload>[]

  /** Execute all channels */
  call: (payload?: TPayload) => Promise<CyreResponse>

  /** Subscribe to all channels */
  on: (
    handler: EventHandler
  ) => SubscriptionResponse & {unsubscribe: () => boolean}

  /** Add channel to group */
  add: (channel: ChannelLike<TPayload>) => void

  /** Remove channel from group */
  forget: (channelId: string) => boolean

  /** Get group stats */
  getStats: () => {
    channelCount: number
    lastExecutionTime: number
    totalExecutions: number
    successRate: number
  }
}

/**
 * Branch configuration - minimal like React props
 */
export interface BranchConfig {
  /** Branch identifier (auto-generated if not provided) - must be path-safe */
  id?: string
  //optional branch name
  name?: string
  /** Whether to isolate completely or allow cross-branch calls */
  isolated?: boolean
  /** Maximum depth for child branches */
  maxDepth?: number
  /** Auto-cleanup when no channels remain */
  autoCleanup?: boolean
}

/**
 * Branch interface - React component-like isolation
 * - No parent/sibling access
 * - Only parent → child communication
 * - Cascade destruction
 */
export interface Branch {
  id: string
  path: () => string

  // Core methods (scoped to branch only)
  action: (config: IO) => {ok: boolean; message: string}
  on: (id: string, handler: any) => SubscriptionResponse
  call: (target: string, payload?: any) => Promise<CyreResponse>
  get: (id: string) => IO | undefined
  forget: (id: string) => boolean

  // Branch lifecycle (like React component)
  destroy: () => boolean
  isActive: () => boolean
  getStats: () => BranchStats
}

/**
 * Branch statistics
 */
export interface BranchStats {
  id: string
  path: string
  channelCount: number
  subscriberCount: number
  timerCount: number
  childCount: number
  depth: number
  createdAt: number
  isActive: boolean
}

/**
 * Branch setup configuration for component duplication
 */
export interface BranchSetup {
  actions?: Partial<IO>[]
  subscriptions?: Array<{
    id: string
    handler: (...args: any[]) => any
  }>
  orchestrations?: any[]
}
