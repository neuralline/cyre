// src/types/history.ts
// History and response related types

import {ActionPayload, Priority} from './core'

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
  result: {
    ok: boolean
    message?: string
    error?: string
  }
  /** Time taken to execute (in milliseconds) - optional to fix TS issues */
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
  /** Average execution duration - optional to fix TS issues */
  averageDuration?: number
  /** Most recent call entry - optional to fix TS issues */
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
