// src/types/system.ts - Updated Timer interface
// System, Timer, and Performance related types

import {BREATHING} from '../config/cyre-config'
import {Priority, ActionPayload, StateKey} from './core'

// Timer Related Types
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

// Enhanced Timer interface with delay/interval support
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

  // New properties for delay/interval logic
  delay?: number // Optional delay for first execution
  interval?: number // Interval for subsequent executions
  hasExecutedOnce?: boolean // Track if first execution completed
}

// System Metrics
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
  pattern: keyof typeof BREATHING.PATTERNS
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
  pattern: keyof typeof BREATHING.PATTERNS
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

// Action metrics for legacy compatibility
export interface ActionMetrics {
  executionTime?: number
  lastExecutionTime?: number
  executionCount?: number
  formationId?: string
  status: 'success' | 'error'
  timestamp: number
  error?: string
}
