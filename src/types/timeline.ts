// src/types/timeline-task.ts
// Unified timeline task system with trigger-based scheduling

import type {ActionPayload, Priority, ConditionFunction} from './core'

/*

      C.Y.R.E - T.I.M.E.L.I.N.E 
      
      Standardized task system for all scheduled work:
      - Channels, orchestrations, system tasks all become TimelineTasks
      - Trigger-based scheduling interface
      - Deep integration with breathing and metrics
      - Universal coordination and conflict resolution

*/

export type TaskType =
  | 'channel-execution' // From action delay/repeat
  | 'orchestration-step' // Workflow steps
  | 'orchestration-trigger' // Trigger monitoring
  | 'scheduled-event' // User-defined scheduling
  | 'system-maintenance' // Breathing, cleanup
  | 'user-defined' // Custom tasks

export type TaskSource =
  | 'action-definition' // From cyre.action()
  | 'orchestration' // From orchestration system
  | 'schedule' // From cyre.schedule()
  | 'system' // Internal system tasks
  | 'api' // External scheduling

export interface TaskTrigger {
  // Time-based triggers
  time?: string // '09:00', '14:30'
  cron?: string // '0 9 * * MON'
  interval?: number // Milliseconds
  delay?: number // Initial delay

  // Event-based triggers
  after?: string // After another task ID
  when?: ConditionFunction // When condition is met
  channel?: string // When channel is called

  // Targets (what to execute)
  channels?: string[] // Channel IDs to call
  orchestration?: string // Orchestration ID to trigger
  function?: () => Promise<any> // Custom function

  // Execution config
  payload?: ActionPayload // Payload for execution
  timezone?: string // Timezone for time-based triggers
  repeat?: number | boolean // Repetition config
  enabled?: boolean // Enable/disable trigger
}

export interface TaskBreathingConfig {
  adaptToStress?: boolean // Slow down under system stress
  stressMultiplier?: number // How much to slow down (1.5 = 50% slower)
  pauseThreshold?: number // Pause if stress exceeds this (0.9 = 90%)
  resumeThreshold?: number // Resume when stress drops below this
  priority?: Priority // Task priority affects breathing behavior
}

export interface TaskConflictConfig {
  strategy?: 'skip' | 'queue' | 'delay' | 'replace' | 'parallel'
  maxQueueSize?: number // Max queued executions
  timeout?: number // Max wait time for conflict resolution
  conflictsWith?: string[] // Specific task IDs that conflict
}

export interface TaskRetryConfig {
  enabled?: boolean
  maxRetries?: number
  backoff?: 'linear' | 'exponential' | 'fixed'
  baseDelay?: number
  maxDelay?: number
  retryOn?: string[] // Error types to retry on
}

export interface TaskMetadata {
  description?: string
  tags?: string[]
  category?: string
  owner?: string
  createdAt?: number
  updatedAt?: number
  version?: string
  [key: string]: any
}

export interface TimelineTask {
  // Identity
  id: string
  type: TaskType
  source: TaskSource

  // Scheduling - Your desired interface!
  triggers: TaskTrigger[]

  // Coordination
  dependencies?: string[] // Task IDs this depends on
  conflicts?: TaskConflictConfig
  priority?: Priority

  // System integration
  breathing?: TaskBreathingConfig
  retry?: TaskRetryConfig

  // Conditions
  enabled?: boolean
  conditions?: ConditionFunction[]

  // Metadata
  metadata?: TaskMetadata
}

export interface TaskExecutionContext {
  taskId: string
  triggerId: string
  trigger: TaskTrigger
  executionCount: number
  lastExecution?: number
  systemStress: number
  timestamp: number
  variables?: Record<string, any>
}

export interface TaskExecutionResult {
  ok: boolean
  duration: number
  result?: any
  error?: string
  nextExecution?: number
  shouldRetry?: boolean
  triggeredTasks?: string[]
}

export interface TaskConflict {
  taskId: string
  conflictsWith: string[]
  type: 'time-overlap' | 'resource-conflict' | 'dependency-cycle'
  severity: 'low' | 'medium' | 'high'
  resolution?: 'delay' | 'skip' | 'queue'
}

export interface TaskDependency {
  taskId: string
  dependsOn: string
  type: 'completion' | 'success' | 'start'
  timeout?: number
  optional?: boolean
}

export interface TimelineLoad {
  totalTasks: number
  activeTasks: number
  queuedTasks: number
  nextExecution: number
  systemCapacity: number
  overloaded: boolean
  estimatedRecovery?: number
}

export interface TaskFilter {
  type?: TaskType
  source?: TaskSource
  enabled?: boolean
  tags?: string[]
  priority?: Priority
  hasConflicts?: boolean
  nextExecutionBefore?: number
  nextExecutionAfter?: number
}

export interface TaskResult {
  ok: boolean
  taskId?: string
  message?: string
  conflicts?: TaskConflict[]
  nextExecution?: number
  error?: string
}

// Enhanced Timer interface that includes task information
export interface EnhancedTimer {
  // Existing timer properties
  id: string
  startTime: number
  duration: number
  originalDuration: number
  callback: () => void | Promise<void>
  repeat?: number | boolean
  executionCount: number
  lastExecutionTime: number
  nextExecutionTime: number
  isInRecuperation: boolean
  status: 'active' | 'paused' | 'completed' | 'failed'
  isActive: boolean

  // New task integration
  task: TimelineTask
  currentTrigger?: TaskTrigger

  // Enhanced metadata
  metadata?: {
    type: string
    [key: string]: any
  }

  // Enhanced metrics
  metrics: {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    lastExecutionTime: number
    longestExecutionTime: number
    shortestExecutionTime: number
    missedExecutions: number
    surgeProtection: {
      totalDelays: number
      totalDelayTime: number
      averageDelay: number
      lastDelay: number
    }
  }
}

// Configuration interfaces for the schedule API
export interface ScheduleConfig {
  id: string
  triggers: TaskTrigger[]
  type?: TaskType
  dependencies?: string[]
  conflicts?: TaskConflictConfig
  breathing?: TaskBreathingConfig
  retry?: TaskRetryConfig
  conditions?: ConditionFunction[]
  enabled?: boolean
  metadata?: TaskMetadata
}

export interface QuickScheduleConfig {
  id: string
  channels?: string[]
  orchestration?: string
  function?: () => Promise<any>
  payload?: ActionPayload
  timezone?: string
  enabled?: boolean
}

// Export types for external use
export type {
  TaskTrigger as Trigger,
  TimelineTask as Task,
  TaskExecutionContext as ExecutionContext,
  TaskExecutionResult as ExecutionResult
}
