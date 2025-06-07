// src/orchestration/orchestration-engine.ts
// Orchestration system with proper TimeKeeper integration

import {timeline} from '../context/state'
import {sensor} from '../context/metrics-report'
import {metricsState} from '../context/metrics-state'
import {call} from '../app'
import {TimeKeeper} from '../components/cyre-timekeeper'
import type {
  OrchestrationConfig,
  WorkflowStep,
  ExecutionContext,
  StepResult,
  OrchestrationRuntime,
  TriggerEvent
} from '../types/orchestration'

/*

      C.Y.R.E - O.R.C.H.E.S.T.R.A.T.I.O.N - E.N.G.I.N.E
      
      Timeline-unified orchestration with TimeKeeper integration:
      - Uses TimeKeeper.keep() to actually schedule timer execution
      - Proper timer callback execution 
      - Breathing system integration
      - Fixed timer execution flow

      CRITICAL FIX: Now properly calls TimeKeeper.keep() to schedule timers

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
    // Register triggers with PROPER TimeKeeper integration
    const triggerIds = registerTriggers(runtime.config)
    runtime.triggerIds = triggerIds

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
    // Stop all triggers using TimeKeeper
    runtime.triggerIds?.forEach(triggerId => {
      TimeKeeper.forget(triggerId)
      timeline.forget(triggerId)

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
 * Register triggers for orchestration - FIXED with proper TimeKeeper integration
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
          // CRITICAL FIX: Use TimeKeeper.keep() instead of just timeline.add()

          const executionCallback = async () => {
            console.log(`🔄 Orchestration trigger fired: ${config.id}`)
            const triggerEvent: TriggerEvent = {
              name: trigger.name,
              type: 'time',
              timestamp: Date.now()
            }

            try {
              const result = await executeWorkflow(config, triggerEvent)
              if (result.ok) {
                console.log(
                  `✅ Orchestration ${config.id} executed successfully`
                )
              } else {
                console.log(
                  `❌ Orchestration ${config.id} failed: ${result.message}`
                )
              }
            } catch (error) {
              console.error(`❌ Orchestration ${config.id} error:`, error)
            }
          }

          // Use TimeKeeper.keep() to actually schedule execution
          const timerResult = TimeKeeper.keep(
            trigger.interval, // duration
            executionCallback, // callback
            trigger.repeat !== false ? true : 1, // repeat (default true for time triggers)
            triggerId, // id
            trigger.delay // delay (optional)
          )

          if (timerResult.kind === 'ok') {
            console.log(
              `✅ TimeKeeper scheduled: ${triggerId} (${trigger.interval}ms interval)`
            )

            // Also add to timeline for tracking
            timeline.add(timerResult.value)
          } else {
            console.error(
              `❌ TimeKeeper failed to schedule: ${triggerId}`,
              timerResult.error
            )
          }
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
    const runtime = orchestrationRuntimes.get(orchestrationId)
    if (!runtime) return null

    // Get TimeKeeper status for this orchestration
    const timeKeeperStatus = TimeKeeper.status()
    const orchestrationTimers =
      timeKeeperStatus.formations?.filter(timer =>
        timer.id.includes(orchestrationId)
      ) || []

    return {
      id: orchestrationId,
      status: runtime.status,
      isActive: orchestrationTimers.some(timer => timer.isActive),
      executionCount: runtime.executionCount,
      lastExecution: runtime.lastExecution,
      metrics: runtime.metrics,
      timeKeeperInfo: {
        timerCount: orchestrationTimers.length,
        activeTimers: orchestrationTimers.filter(timer => timer.isActive).length
      }
    }
  },

  getSystemOverview: () => {
    const timeKeeperStatus = TimeKeeper.status()
    const allRuntimes = Array.from(orchestrationRuntimes.values())

    return {
      total: {
        orchestrations: orchestrationRuntimes.size,
        running: allRuntimes.filter(r => r.status === 'running').length,
        timelineEntries: timeline.getAll().length,
        activeTriggers: timeKeeperStatus.activeFormations
      },
      breathing: metricsState.get().breathing,
      systemStress: metricsState.get().stress?.combined || 0
    }
  }
}
