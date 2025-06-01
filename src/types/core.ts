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
  // Group configuration
  group?: string

  // Multi-sensor fusion
  fusion?: {
    spatial?: Array<{
      id: string
      location: {x: number; y: number}
      weight?: number
    }>
    temporal?: string[]
    method?: 'weighted' | 'kalman'
  }

  // Pattern recognition
  patterns?: {
    sequences?: Array<{name: string; conditions: string[]; timeout?: number}>
    anomalies?: Array<{method: 'zscore' | 'iqr'; threshold: number}>
  }

  // Compiled pipelines (internal)
  _fusionPipeline?: FusionFn[]
  _patternPipeline?: PatternFn[]
}

export type FusionFn = (payload: any, context: FusionContext) => any
export type PatternFn = (payload: any, history: any[]) => PatternResult

export interface FusionContext {
  spatialData: Array<{id: string; value: any; distance: number}>
  temporalData: Array<{id: string; values: any[]}>
}

export interface PatternResult {
  detected: boolean
  patterns: Array<{name: string; confidence: number}>
}

export interface ChannelGroup {
  id: string
  channels: Set<string>
  shared: {throttle?: number; schema?: any; priority?: any}
  coordination: {emergency?: {triggers: string[]; action: string}}
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
/**
 * Group configuration following IO interface patterns
 */
export interface GroupConfig {
  /** Channel patterns to match (supports wildcards like 'sensor-*', 'floor-2-*') */
  channels: string[]
  /** Shared configuration applied to all matching channels */
  shared: Partial<IO> & {
    /** Group-specific middleware chain */
    middleware?: GroupMiddleware[]
    /** Alert configurations */
    alerts?: Record<string, AlertConfig>
  }
}

/**
 * Group middleware function type
 */
export type GroupMiddleware = (
  payload: ActionPayload,
  next: (payload?: ActionPayload) => Promise<any>
) => Promise<any>

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Threshold value for triggering alert */
  threshold: number
  /** Alert action identifier */
  action: string
  /** Alert condition type */
  condition?: 'offline' | 'anomaly' | 'error' | 'custom'
  /** Custom alert handler function */
  handler?: (channelId: string, alertType: string, data: any) => void
}

/**
 * Internal group state
 */
export interface GroupState {
  /** Group identifier */
  id: string
  /** Group configuration */
  config: GroupConfig
  /** Set of matched channel IDs */
  matchedChannels: Set<string>
  /** Array of middleware IDs applied to this group */
  middlewareIds: string[]
  /** Alert states tracking */
  alertStates: Map<string, AlertState>
  /** Whether group is active */
  isActive: boolean
  /** Creation timestamp */
  createdAt: number
}

/**
 * Alert state tracking
 */
export interface AlertState {
  /** Last time this alert was triggered */
  lastTriggered: number
  /** Number of times this alert has been triggered */
  triggerCount: number
  /** Whether alert is currently active */
  isActive: boolean
}

/**
 * Group operations result
 */
export interface GroupResult<T = any> {
  /** Operation success status */
  ok: boolean
  /** Result message */
  message: string
  /** Optional payload data */
  payload?: T
}

/**
 * Group statistics
 */
export interface GroupStats {
  /** Group identifier */
  id: string
  /** Number of matched channels */
  channelCount: number
  /** Number of active alerts */
  activeAlerts: number
  /** Total alert triggers */
  totalAlertTriggers: number
  /** Group uptime in milliseconds */
  uptime: number
  /** Middleware execution count */
  middlewareExecutions: number
}

/**
 * Group metrics
 */
export interface GroupMetrics {
  /** Group statistics */
  stats: GroupStats
  /** Per-channel metrics */
  channels: Record<
    string,
    {
      executionCount: number
      lastExecution: number
      errors: number
    }
  >
  /** Alert history */
  alertHistory: Array<{
    alertType: string
    channelId: string
    timestamp: number
    data: any
  }>
}

/**
 * Group operations interface
 */
export interface GroupOperations {
  /** Create a new group */
  create: (groupId: string, config: GroupConfig) => GroupResult<GroupState>
  /** Get group by ID */
  get: (groupId: string) => GroupState | undefined
  /** Update group configuration */
  update: (groupId: string, updates: Partial<GroupConfig>) => GroupResult
  /** Remove group */
  remove: (groupId: string) => boolean
  /** Get all groups */
  getAll: () => GroupState[]
  /** Get groups for a specific channel */
  getChannelGroups: (channelId: string) => GroupState[]
  /** Add channel to matching groups */
  addChannelToGroups: (channelId: string) => void
  /** Remove channel from groups */
  removeChannelFromGroups: (channelId: string) => void
}

export interface GroupAlert {
  id: string
  type: 'offline' | 'anomaly' | 'error' | 'custom'
  channelId: string
  timestamp: number
  data: any
  resolved: boolean
  resolvedAt?: number
}

export interface GroupPerformance {
  middlewareChainTime: number
  channelDistribution: Record<string, number>
  patternMatchEfficiency: number
  alertResponseTime: number
}

// src/types/interface.ts
// Updated core interfaces with payload separation

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

/**
 * IO interface - configuration only, no payload data
 */
export interface IO {
  /** Unique identifier for this action */
  id: string
  /** Optional grouping category (defaults to id if not specified) */
  type?: string
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
  _isBlocked?: boolean
  _blockReason?: string
  _hasFastPath?: boolean

  // Metadata fields (no payload data)
  timestamp?: number
  timeOfCreation?: number

 

  // Group configuration
  group?: string

  // Multi-sensor fusion
  fusion?: {
    spatial?: Array<{
      id: string
      location: {x: number; y: number}
      weight?: number
    }>
    temporal?: string[]
    method?: 'weighted' | 'kalman'
  }

  // Pattern recognition
  patterns?: {
    sequences?: Array<{name: string; conditions: string[]; timeout?: number}>
    anomalies?: Array<{method: 'zscore' | 'iqr'; threshold: number}>
  }

  // Compiled pipelines (internal)
  _fusionPipeline?: FusionFn[]
  _patternPipeline?: PatternFn[]
}

export type FusionFn = (payload: any, context: FusionContext) => any
export type PatternFn = (payload: any, history: any[]) => PatternResult

export interface FusionContext {
  spatialData: Array<{id: string; value: any; distance: number}>
  temporalData: Array<{id: string; values: any[]}>
}

export interface PatternResult {
  detected: boolean
  patterns: Array<{name: string; confidence: number}>
}

/**
 * Extended IO interface for backward compatibility during transition
 * This allows gradual migration without breaking existing code
 */
export interface IOWithPayload extends IO {
  /** @deprecated Use payloadState.get(id) instead */
  payload?: ActionPayload
}

// Timer interfaces (unchanged)
export type TimerStatus = 'active' | 'paused'
export type TimerRepeat = number | boolean | typeof Infinity

export interface TimerDuration {
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  milliseconds?: number
}

export interface TimerMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  lastExecutionTime: number
  longestExecutionTime: number
  shortestExecutionTime: number
  missedExecutions: number
  surgeProtection?: {
    totalDelays: number
    totalDelayTime: number
    averageDelay: number
    lastDelay: number
  }
}

export interface Timer {
  id: string
  startTime: number
  duration: number
  callback: () => void | Promise<void>
  repeat?: TimerRepeat
  executionCount: number
  lastExecutionTime: number
  nextExecutionTime: number
  timeoutId?: NodeJS.Timeout
  isInRecuperation: boolean
  status: 'active' | 'paused'
  metrics: TimerMetrics
  cleanup?: () => void
  isActive: boolean
  priority?: 'critical' | 'normal'
  originalDuration: number
  recuperationInterval?: NodeJS.Timeout
  delay?: number
  interval?: number
  hasExecutedOnce?: boolean
}

// System metrics (unchanged)
export type SystemMetrics = {
  cpu: number
  memory: number
  eventLoop: number
  isOverloaded: boolean
}

export type SystemStress = {
  cpu: number
  memory: number
  eventLoop: number
  callRate: number
  combined: number
}

export type PerformanceMetrics = {
  callsTotal: number
  callsPerSecond: number
  lastCallTimestamp: number
  activeQueues: Record<Priority, number>
  queueDepth: number
}

export type BreathingState = {
  breathCount: number
  currentRate: number
  lastBreath: number
  stress: number
  isRecuperating: boolean
  recuperationDepth: number
  pattern: keyof typeof import('../config/cyre-config').BREATHING.PATTERNS
  nextBreathDue: number
  recuperationInterval?: NodeJS.Timeout
}

export type BreathingMetrics = {
  breathCount: number
  currentRate: number
  lastBreath: number
  stress: number
  isRecuperating: boolean
  recuperationDepth: number
  pattern: keyof typeof import('../config/cyre-config').BREATHING.PATTERNS
}

export interface QuantumState {
  system: SystemMetrics
  breathing: BreathingState
  performance: PerformanceMetrics
  stress: SystemStress
  lastUpdate: number
  inRecuperation: boolean
  hibernating: boolean
  recuperationInterval?: NodeJS.Timeout
  activeFormations: number
  isLocked: boolean
  initialize: boolean
  isShutdown: boolean
}

export interface TimekeeperMetrics {
  hibernating: boolean
  activeFormations: number
  totalFormations: number
  inRecuperation: boolean
  breathing: BreathingState
  formations: Array<{
    id: string
    duration: number
    executionCount: number
    status: 'active' | 'paused'
    nextExecutionTime: number
    isInRecuperation: boolean
    breathingSync: number
    delay?: number
    interval?: number
    hasExecutedOnce?: boolean
  }>
  quartzStats: {
    activeCount: number
    activeIds: string[]
    memoryUsage: number
  }
  environment: {
    hasHrTime: boolean
    hasPerformance: boolean
    hasSetImmediate: boolean
    isTest: boolean
  }
  memoryUsage: {
    formations: number
    quartz: number
  }
}

export interface ActionMetrics {
  executionTime?: number
  lastExecutionTime?: number
  executionCount?: number
  formationId?: string
  status: 'success' | 'error'
  timestamp: number
  error?: string
}

// Payload state specific types
export interface PayloadStateMetrics {
  totalChannels: number
  totalUpdates: number
  frozenChannels: number
  activeSubscriptions: number
  totalSnapshots: number
  historySize: number
  memoryUsage: {
    payloads: number
    history: number
    subscriptions: number
    snapshots: number
  }
}

/**
 * Helper types for payload operations
 */
export type PayloadUpdateSource = 'initial' | 'call' | 'pipeline' | 'external'

export interface PayloadValidationResult {
  valid: boolean
  errors?: string[]
  data?: ActionPayload
}

export interface PayloadComparison {
  equal: boolean
  differences: string[]
  similarity: number
}

export interface PayloadSubscriptionOptions {
  filter?: (payload: ActionPayload) => boolean
  immediate?: boolean
  once?: boolean
}
