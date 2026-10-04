// src/types/system.ts - Updated with clear separation of concerns

import {subscribers, timeline} from './../context/state'

// System performance and monitoring types

export type SystemMetrics = {
  cpu: number
  memory: number
  eventLoop: number
  isOverloaded: boolean
  startTime?: number // Track system start time for uptime calculations
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

// Pre-computed system flags for hot path optimization
export interface SystemFlags {
  // Call method flags
  canCall: boolean
  canCallMessages: string[]

  // Action/On method flags
  canAction: boolean
  canActionMessages: string[]

  // System-wide flags
  isOperational: boolean
  isOperationalMessages: string[]

  // Last computed timestamp
  lastComputed: number
}

// User-tunable system config, exposed via cyre.init({...}) -----------------
//
// These are the values that used to live only as hardcoded constants in
// config/cyre-config.ts (TIMING/BREATHING). They're still the DEFAULTS -
// see config/cyre-config.ts's `defaultConfig` - but the values consumers
// actually read at runtime now come from QuantumState.config (via
// metricsState), so cyre.init(userConfig) can override them per-deployment
// without touching the shipped source. Only values something in the engine
// genuinely reads are exposed here - e.g. PROTECTION.MIN_THROTTLE/
// MIN_DEBOUNCE/MAX_DELAY were deliberately left out because nothing in the
// current validation path (schema/data-definitions.ts, compile-pipeline.ts)
// actually consults them; exposing overrides for constants nothing reads
// would be misleading.
export interface CyreConfig {
  breathing: {
    rates: {min: number; base: number; max: number; recovery: number}
    stress: {low: number; medium: number; high: number; critical: number}
    limits: {
      maxCpu: number
      maxMemory: number
      maxEventLoop: number
      maxCallRate: number
    }
  }
  timing: {
    // Upper bound on how long TimeKeeper's Quartz engine will ever sleep
    // between polls when idle/hibernating, and the ceiling a resolved
    // "check again" delay gets clamped to. Was TIMING.RECUPERATION /
    // components/cyre-timekeeper.ts's QUARTZ_MAX_POLL.
    recuperation: number
  }
}

// Deep-partial mirror of CyreConfig for what a caller can pass to
// cyre.init() - every level optional, merged over the current config
// (itself seeded from CyreConfig defaults) rather than replacing it.
export interface CyreUserConfig {
  breathing?: {
    rates?: Partial<CyreConfig['breathing']['rates']>
    stress?: Partial<CyreConfig['breathing']['stress']>
    limits?: Partial<CyreConfig['breathing']['limits']>
  }
  timing?: Partial<CyreConfig['timing']>
}

// Main system state interface with clear authority separation
export interface QuantumState {
  system: SystemMetrics
  breathing: BreathingState
  performance: PerformanceMetrics
  stress: SystemStress
  lastUpdate: number

  // User-tunable config - defaults from config/cyre-config.ts's
  // defaultConfig, overridable per-deployment via cyre.init(userConfig).
  // Lives here (not a separate store) so it's covered by the same single
  // source of truth as the rest of system state - see metricsState.init().
  config: CyreConfig

  // AUTHORITY SEPARATION:
  inRecuperation: boolean // Breathing system authority (system-wide)
  hibernating: boolean // TimeKeeper authority only

  activeFormations: number
  store: {
    channels: number
    branches: number
    subscribers: number
    tasks: number
    timeline: number
  }

  // System flags
  _isLocked: boolean // Changed from _Locked to _isLocked for consistency
  _shutdown: boolean
  _init: boolean

  // Pre-computed flags for hot path optimization
  flags: SystemFlags
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

// Metrics API types for cyre.getMetrics()
export interface ChannelMetricsResult {
  channelId: string
  executionCount: number
  lastExecutionTime: number
  executionDuration: number
  errorCount: number
  timeOfCreation: number
  isBlocked: boolean
  hasFastPath: boolean
  hasProtections: boolean
  hasProcessing: boolean
  hasScheduling: boolean
  available: boolean
  error?: string
}

export interface SystemMetricsResult {
  system: {
    stress: SystemStress
    breathing: {
      currentRate: number
      stress: number
      isRecuperating: boolean
      pattern: string
      breathCount: number
    }
    performance: PerformanceMetrics
    health: {
      isHealthy: boolean
      isLocked: boolean
      hibernating: boolean
      inRecuperation: boolean
    }
    uptime: number
    lastUpdate: number
  }
  stores: {
    channels: number
    subscribers: number
    timeline: number
    activeFormations: number
  }
  available: boolean
  error?: string
}

export interface MetricsExportFilter {
  includeChannels?: boolean
  includeSystem?: boolean
  includeBreathing?: boolean
  channelPattern?: string
}

export interface MetricsExportResult {
  system?: SystemMetricsResult['system']
  breathing?: BreathingMetrics & {
    stressThresholds: Record<string, number>
    rateRange: Record<string, number>
  }
  channels?: Array<{
    id: string
    type?: string
    executionCount: number
    lastExecutionTime: number
    executionDuration: number
    errorCount: number
    isBlocked: boolean
    hasFastPath: boolean
    protections: {
      throttle?: number
      debounce?: number
      detectChanges?: boolean
    }
  }>
  timestamp: number
  available: boolean
  error?: string
}

// Shared metrics types to prevent circular imports
import type {ActionId, Priority} from './core'
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
  CRITICAL = 'CRITICAL',
  SYS = 'SYS' // System LOG
}

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
