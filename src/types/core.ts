// src/types/core.ts
// IO: channel interface with additional

import {Schema} from '../schema/cyre-schema'
import type {TalentFunction} from '../schema/talent-definitions'

export type * from './timer'
export type * from './orchestration'
export type ChannelOperator =
  | 'block'
  | 'throttle'
  | 'debounce'
  | 'schema'
  | 'condition'
  | 'selector'
  | 'transform'
  | 'detectChanges'
  | 'required'
  | 'schedule'
  | 'auth'
  | 'buffer'

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

export interface TalentResult {
  ok: boolean
  error?: boolean
  message?: string
  payload?: any
  delay?: number
  schedule?: {
    interval?: number
    delay?: number
    repeat?: number | boolean
  }
}

export interface CyreResponse<T = any> {
  ok: boolean
  payload: T
  message: string
  error?: boolean | string
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
    // Dispatch-specific metadata
    executionOperator?: ExecutionOperator
    handlerCount?: number
    strategy?: ErrorStrategy
    executionStrategy?: 'parallel' | 'sequential'
    collectStrategy?: CollectStrategy
    hasTimeout?: boolean
    bufferWindow?: number
  }
}

export type EventHandler = (...args: any[]) => any
export type MiddlewareFunction = (...args: any[]) => any

export interface ISubscriber {
  id: string
  handler: (payload: any) => CyreResponse
}

export interface IMiddleware {
  id: string
  fn: any
}

export interface SubscriptionResponse {
  ok: boolean
  message: string
  unsubscribe?: () => boolean
  metadata?: {
    handlerCount?: number
    executionOperator?: ExecutionOperator
    errorStrategy?: ErrorStrategy
    optimized?: boolean
    total?: number
    successful?: number
    failed?: number
    results?: SubscriptionResponse[]
  }
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

export interface StateActionMetrics {
  lastExecutionTime: number
  executionCount: number
  intervalId?: NodeJS.Timeout
  errors: Array<{
    timestamp: number
    message: string
  }>
}

export interface BranchStore {
  id: string // Clean branch ID
  path: string // Full hierarchical path
  parentPath?: string // Foreign key to parent branch
  depth: number // Hierarchy depth for optimization
  createdAt: number
  isActive: boolean

  // Metadata for optimization
  channelCount: number // Cache for quick stats
  childCount: number // Cache for quick stats
}
/**
 * IO interface - Enhanced action configuration with channel organization fields
 */
export interface IO {
  /** Unique channel identifier */
  id: string

  /** local channel identifier for this action */
  localId?: string

  /** Human-readable name for the channel */
  name?: string

  /** Channel category/classification (defaults to id if not specified) */
  type?: string

  /** Hierarchical path for organization (e.g., "sensors/temperature/room1") */
  path?: string

  /** Group membership for bulk operations */
  group?: string

  /** Tags for filtering and organization */
  tags?: string[]

  /** Description of what this channel does */
  description?: string

  /** Version for channel evolution tracking */
  version?: string

  //channel operators aka action talents
  /** Require payload to be provided - boolean for basic requirement */
  required?: boolean
  /** Milliseconds between executions for repeated actions */
  interval?: number
  /** Number of times to repeat execution, true for infinite repeats */
  repeat?: number | boolean
  /** Milliseconds to delay before first execution in other word wait on the first reputation*/
  delay?: number
  /** Minimum milliseconds between executions (rate limiting) */
  throttle?: number
  /** Collapse rapid calls within this window (milliseconds) */
  debounce?: number
  /** Maximum wait time for debounce */
  maxWait?: number
  /** Only execute if payload has changed from previous execution */
  detectChanges?: boolean
  /** Enable logging for this action */
  log?: boolean
  /** Priority level for execution during system stress */
  priority?: PriorityConfig

  /** Schema validation for payload. only execute hen these conditions are error free*/
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

  // NEW: Execution Operators
  /** Execution strategy for multiple handlers */
  dispatch?: 'single' | 'parallel' | 'sequential' | 'race' | 'waterfall'

  /** Error handling strategy for multiple handlers */
  errorStrategy?: ErrorStrategy

  /** How to collect and return results from multiple handlers */
  collectResults?: CollectStrategy

  /** Timeout for multi-handler execution (milliseconds) */
  dispatchTimeout?: number

  //authentication: experimental
  auth?: {
    mode: 'token' | 'context' | 'group' | 'disabled'
    token?: string
    allowedCallers?: string[]
    groupPolicy?: string
    sessionTimeout?: number
  }

  // Internal optimization fields
  /** Pre-computed blocking state for instant use */
  _isBlocked?: boolean
  /** Reason for blocking if _isBlocked is true */
  _blockReason?: string
  /** True if action has no protections and can use fast path */
  _hasFastPath?: boolean
  /** save Pre-compiled channel operators list here */
  _pipeline?: TalentFunction[]
  /** Active debounce timer ID */
  _debounceTimer?: string

  /** Flag to indicate if this channel has schedule elements */
  _isScheduled?: boolean

  /** Branch ID if this channel belongs to a branch */
  _branchId?: string

  // Compiled pipelines (internal)

  _hasProtections?: boolean
  _hasProcessing?: boolean
  _hasScheduling?: boolean
  _processingTalents?: string[]
  _hasChangeDetection?: boolean

  // system fields
  _timestamp?: number //latest call to channel timestamp
  _timeOfCreation?: number //time of channel creation timestamp
  _lastExecTime?: number // last successful execution time timestamp
  _executionDuration?: number //how long last execution took
  _executionCount?: number //how many times it has been successfully executed
  _errorCount?: number //error execution count

  /** Allow indexing with string keys for additional properties */
  [key: string]: any
}

//dispatch
export type ExecutionOperator =
  | 'single'
  | 'parallel'
  | 'sequential'
  | 'race'
  | 'waterfall'
export type ErrorStrategy = 'fail-fast' | 'continue' | 'retry'
export type CollectStrategy = 'first' | 'last' | 'all' | boolean
export interface ExecutionMetadata {
  executionOperator: ExecutionOperator
  handlerCount: number
  strategy: ErrorStrategy
  collectStrategy: CollectStrategy
  executionTime: number
  hasTimeout: boolean
}

export interface MultiHandlerResult {
  ok: boolean
  payload: any
  message: string
  metadata: ExecutionMetadata
  individualResults?: any[]
  failedHandlers?: number
  successfulHandlers?: number
}

//payload

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

// NEW: Dual payload system types
export interface ChannelPayloads {
  /** Request payload (input to channel) */
  request: ActionPayload
  /** Response payload (output from channel execution) */
  response?: CyreResponse
  /** Metadata for tracking request/response lifecycle */
  metadata: {
    lastRequestTime: number
    lastResponseTime?: number
    requestCount: number
    responseCount: number
    averageResponseTime?: number
    lastError?: string
    status: 'idle' | 'pending' | 'completed' | 'failed'
  }
}

export interface PayloadDirection {
  direction: 'request' | 'response'
  timestamp: number
  correlationId?: string
}

export interface RequestResponsePair {
  request: {
    payload: ActionPayload
    timestamp: number
    source: PayloadUpdateSource
  }
  response?: {
    payload: CyreResponse
    timestamp: number
    executionTime: number
  }
  status: 'pending' | 'completed' | 'failed' | 'timeout'
  correlationId: string
}
// io buffer
export interface BufferOptions {
  window: number
  strategy?: 'overwrite' | 'append' | 'ignore'
  maxSize?: number
}
