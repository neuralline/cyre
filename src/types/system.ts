// src/types/system.ts
// System performance and monitoring types

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
  _Locked: boolean
  _shutdown: boolean
  _init: boolean
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

// src/types/metrics.ts
// Shared metrics types to prevent circular imports

import type {ActionId, Priority} from './core'
import {LogLevel} from '../components/cyre-log'

// Core metric event types - what happened
export type MetricEvent =
  | 'call' // Action was called
  | 'dispatch' // Dispatch to handler started
  | 'execution' // Handler execution completed
  | 'error' // Error occurred
  | 'throttle' // Throttle protection activated
  | 'debounce' // Debounce protection activated
  | 'skip' // Execution skipped
  | 'blocked' // Execution blocked
  | 'success' // Operation successful
  | 'info' // Information event
  | 'warning' // Warning event
  | 'critical' // Critical system event

// Event structure
export interface RawEvent {
  id: string
  timestamp: number
  actionId: ActionId
  eventType: MetricEvent
  message?: string
  log?: boolean
  logLevel?: LogLevel
  metadata?: Record<string, unknown>
  location?: string
  priority?: Priority
}

// Sensor event (input to sensor)
export interface SensorEvent {
  actionId: ActionId
  eventType: MetricEvent
  message?: string
  log?: boolean
  logLevel?: LogLevel
  metadata?: Record<string, unknown>
  location?: string
  priority?: Priority
}

// System statistics
export interface SystemMetricsStat {
  totalCalls: number
  totalExecutions: number
  totalErrors: number
  callRate: number
  lastCallTime: number
  startTime: number
  uptime: number
}

// Channel statistics
export interface ChannelMetrics {
  id: ActionId
  calls: number
  executions: number
  errors: number
  lastExecution: number
  averageLatency: number
  successRate: number
  errorRate: number
  protectionEvents: {
    throttled: number
    debounced: number
    blocked: number
    skipped: number
  }
}

// Analysis interfaces
export interface ChannelAnalysis {
  id: string
  metrics: ChannelMetrics
  status: 'healthy' | 'warning' | 'critical' | 'inactive'
  issues: string[]
  latencyTrend: 'improving' | 'degrading' | 'stable'
  protectionUsage: {
    throttled: number
    debounced: number
    blocked: number
    skipped: number
  }
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical'
  score: number
  factors: {
    successRate: number
    latency: number
    errorRate: number
    systemStress: number
  }
}

export interface Alert {
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'performance' | 'error' | 'system'
  message: string
  channel?: string
  metric?: string
  value?: number
  threshold?: number
  timestamp: number
}

export interface SystemAnalysis {
  timestamp: number
  system: SystemMetrics
  channels: ChannelAnalysis[]
  health: HealthStatus
  alerts: Alert[]
  recommendations: string[]
}
