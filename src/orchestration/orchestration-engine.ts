// src/orchestration/orchestration-engine.ts
// Orchestration system using timeline as the unified source of running tasks

import {timeline} from '../context/state'
import {sensor} from '../context/metrics-report'
import {metricsState} from '../context/metrics-state'
import {call} from '../app'
import type {Timer} from '../types/timer'
import type {ActionPayload} from '../types/core'
import type {
  OrchestrationConfig,
  OrchestrationTrigger,
  WorkflowStep,
  ExecutionContext,
  StepResult,
  OrchestrationRuntime,
  OrchestrationMetrics,
  TriggerEvent
} from '../types/orchestration'

/*

      C.Y.R.E - O.R.C.H.E.S.T.R.A.T.I.O.N - E.N.G.I.N.E
      
      Timeline-unified orchestration with proper API alignment:
      - Matches app.ts expectations (create, start, stop, etc.)
      - Uses timeline as the single source of truth
      - Proper type integration with orchestration.ts
      - Breathing system integration
      - Security context support

*/

// Runtime storage for orchestration state
const orchestrationRuntimes = new Map<string, OrchestrationRuntime>()
const triggerSubscriptions = new Map<string, () => void>()

// Orchestration metadata for timeline entries
interface OrchestrationMetadata {
  type: 'orchestration'
  orchestrationId: string
  userId?: string
  stepIndex: number
  totalSteps: number
  securityContext?: SecurityContext
  breathingConfig?: BreathingConfig
  executionCount: number
  lastStepResult?: any
  isCompleted: boolean
  triggerType: 'manual' | 'channel' | 'time' | 'condition'
  triggerPayload?: any
}

interface SecurityContext {
  userId: string
  allowedChannels: string[]
  blockedChannels: string[]
  maxExecutionTime: number
  maxChannelCalls: number
}

interface BreathingConfig {
  enabled: boolean
  adaptToStress: boolean
  pauseThreshold: number
  slowdownThreshold: number
  maxStressAllowed: number
}

interface StepContext {
  orchestrationId: string
  stepIndex: number
  previousResults: any[]
  triggerPayload?: any
  variables: Record<string, any>
}

/**
 * Create orchestration runtime and register with timeline
 */
const create = (
  config: OrchestrationConfig
): {ok: boolean; message: string} => {
  try {
    // Validate configuration
    if (!config.id) {
      return {ok: false, message: 'Orchestration ID is required'}
    }

    if (orchestrationRuntimes.has(config.id)) {
      return {ok: false, message: 'Orchestration already exists'}
    }

    // Create runtime
    const runtime: OrchestrationRuntime = {
      config,
      status: 'stopped',
      lastExecution: undefined,
      executionCount: 0,
      metrics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        lastExecutionTime: 0
      },
      triggerIds: []
    }

    orchestrationRuntimes.set(config.id, runtime)

    sensor.log(config.id, 'info', 'orchestration-created', {
      triggers: config.triggers?.length || 0,
      workflow: config.workflow?.length || 0,
      actions: config.actions?.length || 0
    })

    return {ok: true, message: 'Orchestration created'}
  } catch (error) {
    sensor.error(config.id, String(error), 'orchestration-creation')
    return {ok: false, message: String(error)}
  }
}

/**
 * Start orchestration (enable triggers and timeline integration)
 */
const start = (orchestrationId: string): {ok: boolean; message: string} => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) {
    return {ok: false, message: 'Orchestration not found'}
  }

  if (runtime.status === 'running') {
    return {ok: false, message: 'Orchestration already running'}
  }

  try {
    // Register triggers
    const triggerIds = registerTriggers(runtime.config)
    runtime.triggerIds = triggerIds

    // Create timeline entry for orchestration management
    const orchestrationTimer: Timer = {
      id: orchestrationId,
      startTime: Date.now(),
      duration: 1000, // Check every second for pending executions
      originalDuration: 1000,
      callback: () => checkPendingExecutions(orchestrationId),
      repeat: true,
      executionCount: 0,
      lastExecutionTime: 0,
      nextExecutionTime: Date.now() + 1000,
      isInRecuperation: false,
      status: 'active',
      isActive: true,

      metadata: {
        type: 'orchestration-manager',
        orchestrationId,
        config: runtime.config
      },

      metrics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        lastExecutionTime: 0,
        longestExecutionTime: 0,
        shortestExecutionTime: Infinity,
        missedExecutions: 0,
        surgeProtection: {
          totalDelays: 0,
          totalDelayTime: 0,
          averageDelay: 0,
          lastDelay: 0
        }
      }
    }

    timeline.add(orchestrationTimer)

    runtime.status = 'running'
    orchestrationRuntimes.set(orchestrationId, runtime)

    sensor.log(orchestrationId, 'info', 'orchestration-started', {
      triggersRegistered: triggerIds.length
    })

    return {ok: true, message: 'Orchestration started'}
  } catch (error) {
    sensor.error(orchestrationId, String(error), 'orchestration-start')
    return {ok: false, message: String(error)}
  }
}

/**
 * Stop orchestration (disable triggers and remove from timeline)
 */
const stop = (orchestrationId: string): {ok: boolean; message: string} => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) {
    return {ok: false, message: 'Orchestration not found'}
  }

  try {
    // Unregister triggers
    runtime.triggerIds?.forEach(triggerId => {
      const unsubscribe = triggerSubscriptions.get(triggerId)
      if (unsubscribe) {
        unsubscribe()
        triggerSubscriptions.delete(triggerId)
      }
    })

    // Remove from timeline
    timeline.forget(orchestrationId)

    runtime.status = 'stopped'
    runtime.triggerIds = []
    orchestrationRuntimes.set(orchestrationId, runtime)

    sensor.log(orchestrationId, 'info', 'orchestration-stopped')

    return {ok: true, message: 'Orchestration stopped'}
  } catch (error) {
    sensor.error(orchestrationId, String(error), 'orchestration-stop')
    return {ok: false, message: String(error)}
  }
}

/**
 * Get orchestration runtime information
 */
const get = (orchestrationId: string): OrchestrationRuntime | undefined => {
  return orchestrationRuntimes.get(orchestrationId)
}

/**
 * List all orchestration runtimes
 */
const list = (): OrchestrationRuntime[] => {
  return Array.from(orchestrationRuntimes.values())
}

/**
 * Remove orchestration completely
 */
const remove = (orchestrationId: string): boolean => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) {
    return false
  }

  // Stop first if running
  if (runtime.status === 'running') {
    stop(orchestrationId)
  }

  // Remove runtime
  orchestrationRuntimes.delete(orchestrationId)

  sensor.log(orchestrationId, 'info', 'orchestration-removed')
  return true
}

/**
 * Manual trigger for orchestration execution
 */
const trigger = async (
  orchestrationId: string,
  triggerName: string,
  payload?: any
): Promise<{ok: boolean; result?: any; message: string}> => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) {
    return {ok: false, message: 'Orchestration not found'}
  }

  const triggerEvent: TriggerEvent = {
    name: triggerName,
    type: 'external',
    payload,
    timestamp: Date.now()
  }

  try {
    const result = await executeWorkflow(runtime.config, triggerEvent)

    // Update metrics
    runtime.executionCount++
    runtime.lastExecution = Date.now()
    runtime.metrics.totalExecutions++

    if (result.ok) {
      runtime.metrics.successfulExecutions++
    } else {
      runtime.metrics.failedExecutions++
    }

    orchestrationRuntimes.set(orchestrationId, runtime)

    return result
  } catch (error) {
    sensor.error(orchestrationId, String(error), 'orchestration-trigger')
    return {ok: false, message: String(error)}
  }
}

/**
 * Register triggers for orchestration
 */
const registerTriggers = (config: OrchestrationConfig): string[] => {
  const triggerIds: string[] = []

  config.triggers?.forEach((trigger, index) => {
    const triggerId = `${config.id}-trigger-${index}`
    triggerIds.push(triggerId)

    switch (trigger.type) {
      case 'channel':
        if (trigger.channels) {
          const channels = Array.isArray(trigger.channels)
            ? trigger.channels
            : [trigger.channels]

          channels.forEach(channelId => {
            // Register channel subscription
            const unsubscribe = () => {
              // Implementation would subscribe to channel events
              // For now, placeholder
            }
            triggerSubscriptions.set(triggerId, unsubscribe)
          })
        }
        break

      case 'time':
        if (trigger.interval) {
          const timerResult = timeline.add({
            id: triggerId,
            startTime: Date.now(),
            duration: trigger.interval,
            originalDuration: trigger.interval,
            callback: () => {
              const triggerEvent: TriggerEvent = {
                name: trigger.name,
                type: 'time',
                timestamp: Date.now()
              }
              executeWorkflow(config, triggerEvent)
            },
            repeat: true,
            executionCount: 0,
            lastExecutionTime: 0,
            nextExecutionTime: Date.now() + trigger.interval,
            isInRecuperation: false,
            status: 'active',
            isActive: true,
            metadata: {
              type: 'orchestration-trigger',
              orchestrationId: config.id,
              triggerName: trigger.name
            },
            metrics: {
              totalExecutions: 0,
              successfulExecutions: 0,
              failedExecutions: 0,
              averageExecutionTime: 0,
              lastExecutionTime: 0,
              longestExecutionTime: 0,
              shortestExecutionTime: Infinity,
              missedExecutions: 0,
              surgeProtection: {
                totalDelays: 0,
                totalDelayTime: 0,
                averageDelay: 0,
                lastDelay: 0
              }
            }
          })
        }
        break
    }
  })

  return triggerIds
}

/**
 * Execute workflow based on trigger event
 */
const executeWorkflow = async (
  config: OrchestrationConfig,
  trigger: TriggerEvent
): Promise<{ok: boolean; result?: any; message: string}> => {
  const context: ExecutionContext = {
    orchestrationId: config.id,
    trigger,
    variables: {},
    startTime: Date.now(),
    stepHistory: []
  }

  try {
    // Execute workflow steps if defined
    if (config.workflow) {
      const result = await executeWorkflowSteps(config.workflow, context)
      return {ok: true, result, message: 'Workflow completed'}
    }

    // Execute actions if defined
    if (config.actions) {
      const results = await Promise.all(
        config.actions.map(action =>
          executeOrchestrationAction(action, context)
        )
      )
      return {ok: true, result: results, message: 'Actions completed'}
    }

    return {ok: false, message: 'No workflow or actions defined'}
  } catch (error) {
    sensor.error(config.id, String(error), 'workflow-execution')
    return {ok: false, message: String(error)}
  }
}

/**
 * Execute workflow steps sequentially
 */
const executeWorkflowSteps = async (
  steps: WorkflowStep[],
  context: ExecutionContext
): Promise<any> => {
  const results: any[] = []

  for (const step of steps) {
    if (step.enabled === false) continue

    const stepStartTime = Date.now()

    try {
      let stepResult: any

      switch (step.type) {
        case 'action':
          if (step.targets) {
            const targets =
              typeof step.targets === 'function'
                ? step.targets(context)
                : step.targets

            const targetsArray = Array.isArray(targets) ? targets : [targets]
            const actionResults = await Promise.all(
              targetsArray.map(target => {
                const payload =
                  typeof step.payload === 'function'
                    ? step.payload(context)
                    : step.payload || context.trigger.payload

                return call(target, payload)
              })
            )

            stepResult =
              actionResults.length === 1 ? actionResults[0] : actionResults
          }
          break

        case 'delay':
          const delayTime = step.timeout || 1000
          await new Promise(resolve => setTimeout(resolve, delayTime))
          stepResult = {delayed: delayTime}
          break

        case 'condition':
          const conditionResult = step.condition
            ? typeof step.condition === 'function'
              ? step.condition(context)
              : context.variables[step.condition]
            : true

          stepResult = {conditionMet: conditionResult}

          if (!conditionResult && step.onError === 'abort') {
            throw new Error('Condition not met - aborting workflow')
          }
          break

        default:
          stepResult = {message: `Unknown step type: ${step.type}`}
      }

      const stepDuration = Date.now() - stepStartTime

      const stepRecord: StepResult = {
        stepName: step.name,
        success: true,
        result: stepResult,
        duration: stepDuration,
        timestamp: Date.now()
      }

      context.stepHistory.push(stepRecord)
      results.push(stepResult)
    } catch (error) {
      const stepDuration = Date.now() - stepStartTime
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      const stepRecord: StepResult = {
        stepName: step.name,
        success: false,
        error: errorMessage,
        duration: stepDuration,
        timestamp: Date.now()
      }

      context.stepHistory.push(stepRecord)

      if (step.onError === 'abort') {
        throw error
      }
      // Continue with next step if onError is 'continue'
    }
  }

  return results
}

/**
 * Execute orchestration action
 */
const executeOrchestrationAction = async (
  action: any,
  context: ExecutionContext
): Promise<any> => {
  const targets =
    typeof action.targets === 'function'
      ? action.targets(context)
      : action.targets

  const targetsArray = Array.isArray(targets) ? targets : [targets]

  const results = await Promise.all(
    targetsArray.map(target => {
      const payload =
        typeof action.payload === 'function'
          ? action.payload(context)
          : action.payload || context.trigger.payload

      return call(target, payload)
    })
  )

  return results.length === 1 ? results[0] : results
}

/**
 * Check for pending executions (called by timeline timer)
 */
const checkPendingExecutions = (orchestrationId: string): void => {
  // This could handle queued executions, retries, etc.
  // For now, it's a placeholder for future enhancements
}

/**
 * Main orchestration engine interface aligned with app.ts expectations
 */
export const orchestration = {
  create,
  start,
  stop,
  get,
  list,
  remove,
  trigger,

  // Additional utility methods
  getStatus: (orchestrationId: string) => {
    const timer = timeline.get(orchestrationId)
    const runtime = orchestrationRuntimes.get(orchestrationId)

    if (!runtime) return null

    return {
      id: orchestrationId,
      status: runtime.status,
      isActive: timer?.isActive || false,
      executionCount: runtime.executionCount,
      lastExecution: runtime.lastExecution,
      metrics: runtime.metrics,
      timelineInfo: timer
        ? {
            duration: timer.duration,
            repeat: timer.repeat,
            isInRecuperation: timer.isInRecuperation
          }
        : null
    }
  },

  getSystemOverview: () => {
    const allTimers = timeline.getAll()
    const orchestrationTimers = allTimers.filter(
      t => t.metadata?.type === 'orchestration-manager'
    )
    const triggerTimers = allTimers.filter(
      t => t.metadata?.type === 'orchestration-trigger'
    )

    return {
      total: {
        orchestrations: orchestrationRuntimes.size,
        running: Array.from(orchestrationRuntimes.values()).filter(
          r => r.status === 'running'
        ).length,
        timelineEntries: orchestrationTimers.length,
        activeTriggers: triggerTimers.filter(t => t.isActive).length
      },
      breathing: metricsState.get().breathing,
      systemStress: metricsState.get().stress?.combined || 0
    }
  }
}
