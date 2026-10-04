// src/types/orchestration.ts
// Unified orchestration types for engine and app integration

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
  // What happens when a trigger (or a manual call()) fires while a run of
  // this orchestration is still in flight:
  //  - 'drop' (default): the new run is skipped and resolves
  //    {ok: false, dropped: true} - overlapping runs never pile up, which is
  //    what a 24/7 server wants from a 1s time trigger whose workflow can
  //    take 3s.
  //  - 'queue': runs execute one at a time in arrival order, up to
  //    `queueLimit` waiting runs (default 100); beyond that new runs are
  //    rejected rather than growing memory without bound.
  //  - 'parallel': the old behavior - every firing runs immediately.
  concurrency?: 'drop' | 'queue' | 'parallel'
  queueLimit?: number
}

export interface OrchestrationTrigger {
  name: string
  type: 'channel' | 'time' | 'condition' | 'external'
  channels?: string | string[]
  condition?: (
    payload: any,
    context: ExecutionContext
  ) => boolean | Promise<boolean>
  // Calendar schedule for `type: 'time'` triggers - a standard 5-field cron
  // expression ('0 9 * * 1-5'). When set, this takes priority over `interval`
  // and is computed via cyre-calendar.ts: the trigger fires once at the next
  // matching occurrence, then recomputes and re-arms for the following one -
  // it does not degrade into a fixed-interval repeat.
  schedule?: string
  // IANA timezone for `schedule`, e.g. 'Europe/London'. Defaults to UTC.
  timezone?: string
  interval?: number
  debounce?: number
  throttle?: number
  enabled?: boolean
  repeat?: boolean | number
  delay?: number
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
  // For every step type except 'delay': max time in ms one attempt may take
  // before it fails with a timeout error (counts as a failure for
  // retries/onError). For 'delay' steps this is the delay duration itself,
  // unchanged from before.
  timeout?: number
  // Extra attempts after a failed one. A step "fails" when it throws, times
  // out, a condition comes back false with onError 'abort' or a fallback
  // array, or an 'action' step's channel call returns {ok: false}.
  retries?: number
  // Wait in ms between retry attempts. Defaults to 0.
  retryDelay?: number
  // Name of a context.variables key to store this step's value under once
  // it succeeds - later steps read it via ctx.variables[name] in payload/
  // targets/condition functions, or by passing the name as a string
  // `condition`. For 'action' steps the value is the handler's payload (an
  // array of payloads for multi-target steps); for every other step type
  // it's the step result itself.
  output?: string
  steps?: WorkflowStep[]
  // Only consulted for `type: 'loop'` - how many times to run `steps`.
  // Defaults to 3 (the previously hardcoded value) when omitted, so
  // existing configs that never set this keep their old behavior.
  iterations?: number
  // What to do once a step has failed and its retries are used up:
  //  - 'continue' (default): record the failure and move on.
  //  - 'retry': same as 'continue', but guarantees at least one retry when
  //    `retries` isn't set.
  //  - 'abort': stop the whole workflow; the run resolves {ok: false}.
  //  - WorkflowStep[]: run these fallback steps in the same context, each
  //    with its own onError rules. The workflow then carries on (and
  //    `output`, if set, receives the fallback's result) - unless a
  //    fallback step aborts, which aborts the whole workflow. A condition
  //    step that comes back false also runs its fallback, so this doubles
  //    as an "else" branch.
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

// One run waiting its turn under `concurrency: 'queue'` - `resolve` settles
// the promise whoever fired the run (a trigger handler or call()) is awaiting.
export interface QueuedOrchestrationRun {
  trigger: TriggerEvent
  resolve: (result: OrchestrationRunResult) => void
}

// What a single orchestration run resolves to - returned from
// orchestration.call() and settled for queued runs.
export interface OrchestrationRunResult {
  ok: boolean
  result?: any
  variables?: Record<string, any>
  message: string
  dropped?: boolean
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
  status: 'inactive' | 'active' | 'paused' | 'error'
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
