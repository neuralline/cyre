// src/interfaces/history-interface.ts
// Enhanced type definitions for history and response handling

import type {ActionPayload, Priority} from './interface'

/**
 * Standardized response interface used throughout CYRE
 * Replaces inconsistent response typing across the system
 */
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
  }
}

/**
 * History-specific response interface
 * Simplified version for history storage
 */
export interface HistoryResponse {
  ok: boolean
  message?: string
  error?: string
  payload?: unknown
  timestamp?: number
}

/**
 * Enhanced history entry with comprehensive metadata
 */
export interface HistoryEntry {
  /** Unique identifier for the action */
  actionId: string
  /** When the action was executed */
  timestamp: number
  /** Payload sent to the action */
  payload: ActionPayload
  /** Response from the action execution */
  response: HistoryResponse
  /** Time taken to execute (in milliseconds) */
  duration?: number
  /** Unique execution identifier for tracing */
  executionId?: string
  /** Priority level of the action */
  priority?: Priority
  /** Additional metadata for analysis */
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

/**
 * Comprehensive statistics for action performance analysis
 */
export interface HistoryStats {
  /** Total number of calls recorded */
  totalCalls: number
  /** Success rate as a decimal (0-1) */
  successRate: number
  /** Average execution duration */
  averageDuration?: number
  /** Most recent call entry */
  lastCall?: HistoryEntry
  /** Total number of errors */
  errorCount: number
  /** Recent error entries for quick analysis */
  recentErrors: HistoryEntry[]
  /** Performance trend analysis */
  performanceTrend: {
    improving: boolean
    degrading: boolean
    stable: boolean
  }
  /** Percentile durations for deeper analysis */
  percentiles?: {
    p50?: number
    p90?: number
    p95?: number
    p99?: number
  }
  /** Time-based analysis */
  timeAnalysis?: {
    averagePerHour: number
    peakHour: number
    quietHour: number
  }
}

/**
 * Query options for filtering history entries
 */
export interface HistoryQuery {
  /** Filter by specific action ID */
  actionId?: string
  /** Filter by success/failure status */
  success?: boolean
  /** Filter by time range */
  timeRange?: {
    start: number
    end: number
  }
  /** Limit number of results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Sort field */
  sortBy?: 'timestamp' | 'duration' | 'actionId' | 'success'
  /** Sort direction */
  sortOrder?: 'asc' | 'desc'
  /** Filter by priority */
  priority?: Priority
  /** Filter by minimum duration */
  minDuration?: number
  /** Filter by maximum duration */
  maxDuration?: number
  /** Filter by error type */
  errorType?: string
  /** Filter by metadata tags */
  tags?: string[]
}

/**
 * Error analysis interface for debugging
 */
export interface ErrorAnalysis {
  /** Total number of errors recorded */
  totalErrors: number
  /** Errors grouped by type/message */
  errorsByType: Record<string, number>
  /** Recent error trend direction */
  recentErrorTrend: 'increasing' | 'decreasing' | 'stable'
  /** Most common error messages */
  commonErrors: Array<{
    message: string
    count: number
    lastSeen: number
    firstSeen: number
    frequency: number
  }>
  /** Error patterns over time */
  patterns?: {
    hourlyDistribution: Record<number, number>
    dailyDistribution: Record<string, number>
    errorSpikes: Array<{
      timestamp: number
      count: number
      duration: number
    }>
  }
}

/**
 * Memory usage information for monitoring
 */
export interface HistoryMemoryUsage {
  /** Total number of entries across all actions */
  totalEntries: number
  /** Number of entries per action */
  entriesPerAction: Record<string, number>
  /** Estimated memory usage in KB */
  estimatedMemoryKB: number
  /** Actions exceeding memory thresholds */
  heavyActions: Array<{
    actionId: string
    entryCount: number
    estimatedKB: number
  }>
  /** Memory optimization suggestions */
  suggestions: string[]
}

/**
 * Export configuration for history data
 */
export interface HistoryExportConfig {
  /** Export format */
  format: 'json' | 'csv' | 'excel'
  /** Include metadata in export */
  includeMetadata?: boolean
  /** Date range for export */
  dateRange?: {
    start: Date
    end: Date
  }
  /** Fields to include in export */
  fields?: Array<keyof HistoryEntry>
  /** Custom field mapping for CSV/Excel */
  fieldMapping?: Record<string, string>
  /** Compression for large exports */
  compress?: boolean
}

/**
 * Real-time monitoring interface
 */
export interface HistoryMonitor {
  /** Current execution rate (calls per second) */
  currentRate: number
  /** Average response time over the last minute */
  avgResponseTime: number
  /** Error rate over the last minute */
  errorRate: number
  /** Actions currently executing */
  activeExecutions: number
  /** Queue depth for delayed actions */
  queueDepth: number
  /** System health indicators */
  health: {
    status: 'healthy' | 'degraded' | 'critical'
    indicators: Record<string, boolean>
    lastCheck: number
  }
}

/**
 * History configuration interface
 */
export interface HistoryConfig {
  /** Maximum entries per action */
  maxEntriesPerAction: number
  /** Maximum total entries across all actions */
  maxTotalEntries: number
  /** Auto-cleanup interval in milliseconds */
  cleanupInterval: number
  /** Enable performance trend analysis */
  enableTrendAnalysis: boolean
  /** Enable real-time monitoring */
  enableRealTimeMonitoring: boolean
  /** Retention period in milliseconds */
  retentionPeriod: number
  /** Compression threshold for old entries */
  compressionThreshold: number
}

/**
 * Subscription interface for history events
 */
export interface HistorySubscription {
  /** Subscribe to new history entries */
  onNewEntry: (entry: HistoryEntry) => void
  /** Subscribe to error entries */
  onError: (entry: HistoryEntry) => void
  /** Subscribe to performance degradation */
  onPerformanceDegradation: (actionId: string, stats: HistoryStats) => void
  /** Subscribe to memory warnings */
  onMemoryWarning: (usage: HistoryMemoryUsage) => void
  /** Unsubscribe function */
  unsubscribe: () => void
}

/**
 * Result type for operations that might fail
 */
export type HistoryResult<T, E = Error> =
  | {success: true; data: T}
  | {success: false; error: E}

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
 * Factory functions for creating typed objects
 */
export const createHistoryEntry = (
  actionId: string,
  payload: ActionPayload,
  response: HistoryResponse,
  options?: {
    duration?: number
    priority?: Priority
    metadata?: HistoryEntry['metadata']
  }
): HistoryEntry => ({
  actionId,
  timestamp: Date.now(),
  payload,
  response,
  duration: options?.duration,
  executionId: crypto.randomUUID(),
  priority: options?.priority,
  metadata: {
    source: 'cyre-core',
    ...options?.metadata
  }
})

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
 * Utility functions for working with history data
 */
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`
  } else {
    return `${(milliseconds / 60000).toFixed(1)}m`
  }
}

export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toISOString()
}

export const calculateSuccessRate = (entries: HistoryEntry[]): number => {
  if (entries.length === 0) return 0
  const successful = entries.filter(e => e.response.ok).length
  return successful / entries.length
}

export const calculateAverageDuration = (
  entries: HistoryEntry[]
): number | undefined => {
  const withDuration = entries.filter(e => typeof e.duration === 'number')
  if (withDuration.length === 0) return undefined

  const total = withDuration.reduce((sum, e) => sum + (e.duration || 0), 0)
  return total / withDuration.length
}

/**
 * Re-export commonly used types from the main interface
 */
export type {ActionPayload, Priority, StateKey} from './interface'
