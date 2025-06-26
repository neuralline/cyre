// src/types/timer.ts
// Timer and time-based execution types

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
  metrics?: TimerMetrics
  cleanup?: () => void
  isActive: boolean
  priority?: 'critical' | 'normal'
  originalDuration: number
  recuperationInterval?: NodeJS.Timeout
  delay?: number
  interval?: number
  hasExecutedOnce?: boolean
}

export interface TimekeeperMetrics {
  hibernating: boolean
  activeFormations: number
  totalFormations: number
  inRecuperation: boolean
  breathing: import('./system').BreathingState
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
