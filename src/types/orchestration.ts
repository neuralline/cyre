// src/types/orchestration.ts
// Unified orchestration types for engine and app integration

import type {ActionPayload} from './core'

export interface OrchestrationConfig {
  id: string
  name?: string
  description?: string
  triggers: OrchestrationTrigger[]
  workflow?: WorkflowStep[]
  actions?: OrchestrationAction[]
  conditions?: Record<string, ConditionFunction>
  errorHandling?: ErrorHandlingConfig
  monitoring?: MonitoringConfig
  timeout?: number
  priority?: 'low' | 'medium' | 'high' | 'critical'
  enabled?: boolean
}

export interface OrchestrationTrigger {
  name: string
  type: 'channel' | 'time' | 'condition' | 'external'
  channels?: string | string[]
  condition?: (
    payload: any,
    context: ExecutionContext
  ) => boolean | Promise<boolean>
  schedule?: string
  interval?: number
  debounce?: number
  throttle?: number
  enabled?: boolean
}

export interface WorkflowStep {
  name: string
  type: 'action' | 'condition' | 'parallel' | 'sequential' | 'delay' | 'loop'
  description?: string
  action?: string
  targets?:
    | string
    | string[]
    | ((context: ExecutionContext) => string | string[])
  payload?: any | ((context: ExecutionContext) => any)
  condition?: string | ConditionFunction
  timeout?: number
  retries?: number
  steps?: WorkflowStep[]
  onError?: 'continue' | 'retry' | 'abort' | WorkflowStep[]
  enabled?: boolean
}

export interface OrchestrationAction {
  action: string
  targets:
    | string
    | string[]
    | ((context: ExecutionContext) => string | string[])
  payload?: any | ((context: ExecutionContext) => any)
  condition?: ConditionFunction
  timeout?: number
  retries?: number
}

export interface ExecutionContext {
  orchestrationId: string
  trigger: TriggerEvent
  variables: Record<string, any>
  startTime: number
  stepHistory: StepResult[]
  metadata?: Record<string, any>
}

export interface TriggerEvent {
  name: string
  type: string
  channelId?: string
  payload?: any
  timestamp: number
  metadata?: Record<string, any>
}

export interface StepResult {
  stepName: string
  success: boolean
  result?: any
  error?: string
  duration: number
  timestamp: number
  retryCount?: number
}

export interface ErrorHandlingConfig {
  retries?: number
  timeout?: number
  fallback?: string | ((context: ExecutionContext) => Promise<void>)
  notifications?: string[]
  escalation?: {
    after: number
    action: string
  }
}

export interface MonitoringConfig {
  trackMetrics?: string[]
  reportTo?: string
  alerts?: AlertConfig[]
  healthChecks?: HealthCheckConfig[]
}

export interface AlertConfig {
  condition: (metrics: any) => boolean
  action: string
  cooldown?: number
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

export interface HealthCheckConfig {
  interval: number
  timeout: number
  condition: (context: ExecutionContext) => boolean | Promise<boolean>
  onFailure?: string
}

export type ConditionFunction = (
  context: ExecutionContext
) => boolean | Promise<boolean>

export interface OrchestrationRuntime {
  config: OrchestrationConfig
  status: 'stopped' | 'running' | 'paused' | 'error'
  context?: ExecutionContext
  lastExecution?: number
  executionCount: number
  metrics: OrchestrationMetrics
  compiledWorkflow?: CompiledWorkflow
  triggerIds?: string[]
}

export interface OrchestrationMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  lastExecutionTime: number
  totalSteps?: number
  averageStepsPerExecution?: number
  longestExecution?: number
  shortestExecution?: number
}

export interface CompiledWorkflow {
  id: string
  execute: (context: ExecutionContext) => Promise<any>
  analysis: WorkflowAnalysis
}

export interface WorkflowAnalysis {
  isSequential: boolean
  isParallel: boolean
  hasConditions: boolean
  hasLoops: boolean
  hasDelays: boolean
  complexity: number
  estimatedDuration: number
  dependencies: string[]
}

export interface TriggerRegistration {
  id: string
  orchestrationId: string
  trigger: OrchestrationTrigger
  patterns?: RegExp[]
  timerId?: string
  subscriptionId?: string
  active: boolean
}

// Query system types for advanced orchestration analytics
export interface QueryFilter {
  channelPattern?: string | RegExp
  groupId?: string
  hasPayload?: boolean
  isActive?: boolean
  hasSubscriber?: boolean
  lastExecutedSince?: number
  errorCount?: {gt?: number; lt?: number; eq?: number}
  executionCount?: {gt?: number; lt?: number; eq?: number}
  tags?: string[]
  type?: string
}

export interface QueryResult<T = any> {
  channels: Array<{
    id: string
    config: any
    payload?: any
    subscriber?: boolean
    lastExecuted?: number
    executionCount: number
    errorCount: number
    groupIds: string[]
    tags?: string[]
  }>
  total: number
  filtered: number
  metadata: {
    queryTime: number
    timestamp: number
    cached?: boolean
    indexUsed?: boolean
  }
}

export interface PayloadQuery {
  channelId?: string
  channelPattern?: string | RegExp
  since?: number
  until?: number
  limit?: number
  offset?: number
  transform?: (payload: any) => any
  aggregate?: 'count' | 'avg' | 'sum' | 'min' | 'max' | 'stats'
  groupBy?: string
  orderBy?: string
  direction?: 'asc' | 'desc'
  realTime?: boolean
}

export interface MetricsQuery {
  actionId?: string | string[]
  eventType?: string | string[]
  since?: number
  until?: number
  limit?: number
  offset?: number
  aggregateBy?: 'hour' | 'day' | 'channel' | 'event'
  groupBy?: string
  includeMetadata?: boolean
}

export interface StreamingQuery {
  batchSize?: number
  maxBatches?: number
  onBatch?: (batch: any) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export interface QuerySubscription {
  id: string
  query: any
  callback: (result: any) => void
  interval?: number
  active: boolean
  lastResult?: any
  errorCount: number
}

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  hits: number
  ttl?: number
}

export interface CacheStats {
  size: number
  hits: number
  misses: number
  hitRatio: number
  memoryUsage: number
}

export interface QueryIndex {
  type: string
  field: string
  values: Map<any, Set<string>>
  lastUpdate: number
  size: number
}

export interface IndexStats {
  totalIndexes: number
  totalEntries: number
  memoryUsage: number
  lastUpdate: number
  updateFrequency: number
}

export interface QueryOperator<T = any> {
  name: string
  execute: (data: T[], params: any) => T[]
  isAggregation?: boolean
  requiresIndex?: boolean
}

export interface QueryPipeline {
  operators: QueryOperator[]
  estimatedCost: number
  canUseIndex: boolean
  parallelizable: boolean
}

export interface QueryPerformance {
  queryId: string
  executionTime: number
  cacheHit: boolean
  indexUsed: boolean
  rowsProcessed: number
  rowsReturned: number
  timestamp: number
}

export interface OrchestrationPerformance {
  orchestrationId: string
  triggerLatency: number
  executionTime: number
  stepsExecuted: number
  successRate: number
  resourceUsage: {
    cpu: number
    memory: number
  }
  timestamp: number
}
