// src/types/orchestration.ts
// Type definitions for Cyre orchestration system

import type {ActionPayload} from './core'

export interface OrchestrationConfig {
  id: string
  name?: string
  triggers: OrchestrationTrigger[]
  workflow?: WorkflowStep[]
  actions?: OrchestrationAction[]
  conditions?: Record<string, ConditionFunction>
  errorHandling?: ErrorHandlingConfig
  monitoring?: MonitoringConfig
}

export interface OrchestrationTrigger {
  name: string
  type: 'channel' | 'time' | 'condition' | 'external'
  channels?: string | string[]
  condition?: (payload: any, context: OrchestrationContext) => boolean
  schedule?: string
  interval?: number
  debounce?: number
  throttle?: number
}

export interface WorkflowStep {
  name: string
  type: 'action' | 'condition' | 'parallel' | 'sequential' | 'delay' | 'loop'
  action?: string
  targets?:
    | string
    | string[]
    | ((context: OrchestrationContext) => string | string[])
  payload?: any | ((context: OrchestrationContext) => any)
  condition?: string | ConditionFunction
  timeout?: number
  retries?: number
  steps?: WorkflowStep[]
  onError?: 'continue' | 'retry' | 'abort' | WorkflowStep[]
}

export interface OrchestrationAction {
  action: string
  targets:
    | string
    | string[]
    | ((context: OrchestrationContext) => string | string[])
  payload?: any | ((context: OrchestrationContext) => any)
  condition?: ConditionFunction
  timeout?: number
}

export interface OrchestrationContext {
  orchestrationId: string
  trigger: TriggerEvent
  variables: Record<string, any>
  startTime: number
  stepHistory: StepResult[]
}

export interface TriggerEvent {
  name: string
  type: string
  channelId?: string
  payload?: any
  timestamp: number
}

export interface StepResult {
  stepName: string
  success: boolean
  result?: any
  error?: string
  duration: number
  timestamp: number
}

export interface ErrorHandlingConfig {
  retries?: number
  timeout?: number
  fallback?: string | ((context: OrchestrationContext) => Promise<void>)
  notifications?: string[]
}

export interface MonitoringConfig {
  trackMetrics?: string[]
  reportTo?: string
  alerts?: AlertConfig[]
}

export interface AlertConfig {
  condition: (metrics: any) => boolean
  action: string
  cooldown?: number
}

export type ConditionFunction = (
  context: OrchestrationContext
) => boolean | Promise<boolean>

export interface OrchestrationRuntime {
  config: OrchestrationConfig
  status: 'stopped' | 'running' | 'paused' | 'error'
  context?: OrchestrationContext
  lastExecution?: number
  executionCount: number
  metrics: OrchestrationMetrics
}

export interface OrchestrationMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  lastExecutionTime: number
}
