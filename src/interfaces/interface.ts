// src/interfaces/interface.ts
// Main interface definitions with enhanced response typing

import {ProtectionFunction} from '../components/cyre-protection'
import {BREATHING} from '../config/cyre-config'

export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'background'

export interface PriorityConfig {
  level: Priority
  maxRetries?: number
  timeout?: number
  fallback?: () => Promise<void>
  baseDelay?: number
  maxDelay?: number
}

// Common Types
export type ActionPayload = unknown
export type ActionId = string
export type EventHandler = (
  payload?: unknown
) => void | Promise<void> | {id: string; payload?: unknown}

// Base Interface for shared properties
interface BaseProperties {
  id: string
  type?: string
  payload?: ActionPayload
  timestamp?: number
  message?: string
  log?: boolean
  ok?: boolean
  done?: boolean
}

// Timer Related Types
export type TimerStatus = 'active' | 'paused'
export type TimerRepeat = number | boolean | typeof Infinity

export interface dataDefinitions extends BaseProperties {
  interval?: number
  throttle?: number | boolean
  debounce?: number | boolean
  repeat?: number
  group?: string
  middleware?: Record<string, unknown>
  definitions?: Record<string, unknown>
  at?: number
  onError: string
  timeout?: number
  toc?: number
  intraLink?: [] | undefined | boolean
  detectChanges?: boolean
  previousPayload?: ActionPayload
  skipped?: boolean
  skipReason?: string
}

/**
 * Configuration object for CYRE actions
 * @interface IO
 */
export interface IO extends BaseProperties {
  /** Unique identifier for this action */
  id: string

  /** Optional grouping category (defaults to id if not specified) */
  type?: string

  /** Initial or default payload data */
  payload?: ActionPayload

  /** Milliseconds between executions for repeated actions */
  interval?: number

  /**
   * Number of times to repeat execution, true for infinite repeats
   * @example repeat: 3 // Execute a total of 3 times
   * @example repeat: true // Repeat indefinitely
   */
  repeat?: number | boolean

  /**
   * Milliseconds to delay before first execution
   * @example delay: 1000 // Wait 1 second before first execution
   */
  delay?: number

  /**
   * Minimum milliseconds between executions (rate limiting)
   * @example throttle: 500 // At most one execution per 500ms
   */
  throttle?: number

  /**
   * Collapse rapid calls within this window (milliseconds)
   * @example debounce: 300 // Wait 300ms after last call before executing
   */
  debounce?: number

  /** Only execute if payload has changed from previous execution */
  detectChanges?: boolean

  /** Enable logging for this action */
  log?: boolean

  /** ID of the debounce timer if one is active */
  debounceTimerId?: string

  /**
   * Priority level for execution during system stress
   * @example priority: { level: 'high' }
   */
  priority?: PriorityConfig

  /**
   * Middleware functions to process action before execution
   * @example middleware: ['validate', 'transform']
   */
  middleware?: string[]

  /** Protection pipeline functions for this action */
  _protectionPipeline?: ProtectionFunction[]

  /** Flag to bypass debounce protection for internal use */
  _bypassDebounce?: boolean

  /** Allow indexing with string keys for additional properties */
  [key: string]: any
}

export interface Events {
  type: string | string[]
  has?: unknown
  fn: Function
  appID: string
  onError: string
}

export interface Line {
  id: string
  payload?: ActionPayload
}

export interface ISubscriber {
  id: string
  fn: Function
}

export interface IMiddleware extends ISubscriber {
  fn: (
    action: IO,
    payload: ActionPayload
  ) => Promise<{action: IO; payload: ActionPayload} | null>
}

export interface Subscriber extends ISubscriber {}

export interface SubscriptionResponse {
  ok: boolean
  message: string
  unsubscribe?: () => boolean
}

export type On = (
  type: string | Subscriber[],
  fn?: (
    payload?: unknown
  ) => void | Promise<void> | {id: string; payload?: unknown}
) => SubscriptionResponse

// Enhanced CyreResponse with proper typing
export interface CyreResponse<T = unknown> {
  ok: boolean
  payload: T
  message: string
  error?: Error | string
  timestamp?: number
  metadata?: {
    executionTime?: number
    source?: string
    correlationId?: string
    retryCount?: number
    actionId?: string
    priority?: Priority
  }
}

// Timer state and related interfaces
export type TimerState = {
  inRecuperation: boolean
  hibernating: boolean
  recuperationInterval?: NodeJS.Timeout
  activeFormations: number
}

// Enhance existing Timer interface
export interface Timer extends BaseProperties {
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
  surgeMetrics?: SurgeProtectionMetrics
  cleanup?: () => void
  isActive: boolean
  surgeProtection?: {
    currentDelay: number
    attempts: number
    lastThrottleTime?: number
    metrics: SystemMetrics
  }
  priority?: 'critical' | 'normal'
  originalDuration: number
  recuperationInterval?: NodeJS.Timeout
}

// Enhance existing TimerMetrics interface
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

export interface TimerDuration {
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
  milliseconds?: number
}

export interface QuantumMetrics {
  activeTime: number
  executionRate: number
  successRate: number
  recuperationRate: number
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
}

// Enums
export enum IOType {
  TYPE_A = 'TypeA',
  TYPE_B = 'TypeB'
  // Add other types as needed
}

export type ActionResult<T = unknown> = {
  ok: boolean
  payload: T
  message: string
  error?: Error
  timestamp: number
}

export type ActionHandler<T = unknown> = (
  payload: T
) => Promise<ActionResult<T>>

// Add or update the ActionMetrics interface
export interface ActionMetrics {
  executionTime?: number
  lastExecutionTime?: number
  executionCount?: number
  formationId?: string
  status: 'success' | 'error'
  timestamp: number
  error?: string
}

// Add this interface or extend existing ActionMetrics
export interface TimekeeperMetrics {
  hibernating: boolean
  activeFormations: number
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
  }>
}

// surge protection
export interface CallMetrics {
  count: number
  lastCall: number
  isProtected: boolean
  protectionId?: string
  systemLoad?: {
    callsPerSecond: number
    protectionLevel: number
    isOverloaded: boolean
    system?: SystemMetrics
    queues: Record<Priority, number>
  }
}

export interface SystemLoadInfo {
  callsPerSecond: number
  protectionLevel: number
  isOverloaded: boolean
  system?: SystemMetrics
  queues: Record<Priority, number>
}

export type SystemMetrics = {
  cpu: number
  memory: number
  eventLoop: number
  isOverloaded: boolean
}

// Add surge protection interfaces
export interface SurgeProtectionMetrics
  extends Pick<CallMetrics, 'count' | 'lastCall' | 'isProtected'> {
  systemLoad: Pick<SystemMetrics, 'cpu' | 'memory' | 'eventLoop'>
}

// Add TimeKeeper options interface
export interface TimeKeeperOptions {
  priority?: Priority
  surgeProtection?: boolean
  maxRetries?: number
  timeout?: number
}

export interface SurgeProtectionConfig {
  baseDelay?: number // Initial delay (e.g., 100ms)
  maxDelay?: number // Maximum delay (e.g., 900ms)
  incrementStep?: number // How much to increase delay (e.g., 100ms)
  recoveryThreshold?: {
    cpu?: number // CPU threshold to start recovery
    memory?: number // Memory threshold to start recovery
    eventLoopLag?: number // Event loop lag threshold
  }
}

// Enhanced type definitions
export type ValidationResult = {
  isValid: boolean
  error?: string
}

export type ChannelResult = {
  ok: boolean
  message?: string
  payload?: IO
}

export type DataDefinitionResult = {
  ok: boolean
  payload: any
  message?: string
  required?: boolean
}

export type DataDefinition = (value: any) => DataDefinitionResult
export type DataDefinitions = Record<string, DataDefinition>

export type BreathingMetrics = {
  breathCount: number
  currentRate: number
  lastBreath: number
  stress: number
  isRecuperating: boolean
  recuperationDepth: number
  pattern: keyof typeof BREATHING.PATTERNS
}

export type SystemStress = {
  cpu: number
  memory: number
  eventLoop: number
  callRate: number
  combined: number
}

export type StateKey = string

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
  pattern: keyof typeof BREATHING.PATTERNS
  nextBreathDue: number
  recuperationInterval?: NodeJS.Timeout
}

/**
 * Result of protection layer evaluation
 */
export interface ProtectionResult {
  protected: boolean
  response?: CyreResponse
  payload?: ActionPayload
  action?: IO // Added to allow middleware to modify the action
}

/**
 * Result of throttle check
 */
export interface ThrottleResult {
  blocked: boolean
  response?: CyreResponse
}

/**
 * Enhanced history interfaces integrated into main interface
 */
export interface HistoryResponse {
  ok: boolean
  message?: string
  error?: string
  payload?: unknown
  timestamp?: number
}

export interface HistoryEntry {
  actionId: string
  timestamp: number
  payload: ActionPayload
  response: HistoryResponse
  duration?: number
  executionId?: string
  priority?: Priority
  metadata?: {
    retry?: number
    source?: string
    tags?: string[]
    correlationId?: string
    userId?: string
    sessionId?: string
    traceId?: string
    spanId?: string
  }
}

export interface HistoryStats {
  totalCalls: number
  successRate: number
  averageDuration?: number
  lastCall?: HistoryEntry
  errorCount: number
  recentErrors: HistoryEntry[]
  performanceTrend: {
    improving: boolean
    degrading: boolean
    stable: boolean
  }
  percentiles?: {
    p50?: number
    p90?: number
    p95?: number
    p99?: number
  }
}

export interface HistoryQuery {
  actionId?: string
  success?: boolean
  timeRange?: {
    start: number
    end: number
  }
  limit?: number
  offset?: number
  sortBy?: 'timestamp' | 'duration' | 'actionId' | 'success'
  sortOrder?: 'asc' | 'desc'
  priority?: Priority
  minDuration?: number
  maxDuration?: number
  errorType?: string
  tags?: string[]
}

/**
 * Type guards for runtime validation
 */
export const isHistoryEntry = (obj: unknown): obj is HistoryEntry => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as HistoryEntry).actionId === 'string' &&
    typeof (obj as HistoryEntry).timestamp === 'number' &&
    typeof (obj as HistoryEntry).response === 'object' &&
    typeof (obj as HistoryEntry).response.ok === 'boolean'
  )
}

export const isHistoryResponse = (obj: unknown): obj is HistoryResponse => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as HistoryResponse).ok === 'boolean'
  )
}

export const isCyreResponse = <T = unknown>(
  obj: unknown
): obj is CyreResponse<T> => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as CyreResponse).ok === 'boolean' &&
    typeof (obj as CyreResponse).message === 'string' &&
    'payload' in (obj as CyreResponse)
  )
}

/**
 * Result type for operations that might fail
 */
export type Result<T, E = Error> =
  | {kind: 'ok'; value: T}
  | {kind: 'error'; error: E}

/**
 * Factory function for creating standardized responses
 */
export const createCyreResponse = <T = unknown>(
  ok: boolean,
  payload: T,
  message: string,
  options?: {
    error?: Error | string
    metadata?: CyreResponse<T>['metadata']
  }
): CyreResponse<T> => ({
  ok,
  payload,
  message,
  error: options?.error,
  timestamp: Date.now(),
  metadata: options?.metadata
})

/**
 * Factory function for creating history responses
 */
export const createHistoryResponse = (
  ok: boolean,
  options?: {
    message?: string
    error?: string
    payload?: unknown
  }
): HistoryResponse => ({
  ok,
  message: options?.message,
  error: options?.error,
  payload: options?.payload,
  timestamp: Date.now()
})

/**
 * Utility function to convert any response to HistoryResponse
 */
export const toHistoryResponse = (
  response:
    | CyreResponse
    | {ok: boolean; message?: string; error?: string}
    | unknown
): HistoryResponse => {
  if (isCyreResponse(response)) {
    return {
      ok: response.ok,
      message: response.message,
      error: response.error ? String(response.error) : undefined,
      payload: response.payload,
      timestamp: response.timestamp || Date.now()
    }
  }

  if (isHistoryResponse(response)) {
    return response
  }

  // Fallback for unknown response types
  if (typeof response === 'object' && response !== null && 'ok' in response) {
    return {
      ok: Boolean((response as any).ok),
      message: (response as any).message || undefined,
      error: (response as any).error || undefined,
      payload: (response as any).payload,
      timestamp: Date.now()
    }
  }

  // Default error response for unrecognized types
  return {
    ok: false,
    message: 'Invalid response format',
    error: 'Response could not be normalized',
    timestamp: Date.now()
  }
}
