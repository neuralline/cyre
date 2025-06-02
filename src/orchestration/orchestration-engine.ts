// src/orchestration/orchestration-engine.ts
// Functional orchestration engine for Cyre

import {createStore} from '../context/create-store'
import {TimeKeeper} from '../components/cyre-timekeeper'
import {io, subscribers} from '../context/state'
import {sensor} from '../context/metrics-report'
import type {
  OrchestrationConfig,
  OrchestrationTrigger,
  OrchestrationContext,
  TriggerEvent,
  WorkflowStep,
  StepResult,
  OrchestrationAction,
  OrchestrationRuntime,
  OrchestrationMetrics,
  ConditionFunction
} from '../types/orchestration'
import type {ActionPayload} from '../types/core'

/*

      C.Y.R.E - O.R.C.H.E.S.T.R.A.T.I.O.N
      
      Functional orchestration engine:
      - Pure functions for workflow execution
      - Immutable state management
      - Composable workflow steps
      - Integration with existing Cyre functional architecture

*/

// Import call function dynamically to avoid circular dependency
let callFunction: (id: string, payload?: ActionPayload) => Promise<any>

const getCallFunction = async () => {
  if (!callFunction) {
    const appModule = await import('../app')
    callFunction = appModule.call
  }
  return callFunction
}

interface TriggerRegistration {
  orchestrationId: string
  trigger: OrchestrationTrigger
  subscriptionId?: string
  timerId?: string
}

// State management
const orchestrationStore = createStore<OrchestrationRuntime>()
const triggerRegistry = createStore<TriggerRegistration>()

// Utility functions
const createOrchestrationContext = (
  orchestrationId: string,
  triggerEvent: TriggerEvent
): OrchestrationContext => {
  return {
    orchestrationId,
    trigger: triggerEvent,
    variables: {},
    startTime: Date.now(),
    stepHistory: []
  }
}

const evaluateCondition = async (
  condition: string | ConditionFunction,
  context: OrchestrationContext
): Promise<boolean> => {
  if (typeof condition === 'function') {
    return await condition(context)
  }
  return true
}

const updateOrchestrationMetrics = (
  orchestrationId: string,
  success: boolean,
  executionTime: number
): void => {
  const runtime = orchestrationStore.get(orchestrationId)
  if (!runtime) return

  const metrics = runtime.metrics
  const newMetrics: OrchestrationMetrics = {
    totalExecutions: metrics.totalExecutions + 1,
    successfulExecutions: success
      ? metrics.successfulExecutions + 1
      : metrics.successfulExecutions,
    failedExecutions: success
      ? metrics.failedExecutions
      : metrics.failedExecutions + 1,
    averageExecutionTime:
      (metrics.averageExecutionTime * metrics.totalExecutions + executionTime) /
      (metrics.totalExecutions + 1),
    lastExecutionTime: executionTime
  }

  const updatedRuntime = {...runtime, metrics: newMetrics}
  orchestrationStore.set(orchestrationId, updatedRuntime)
}

const validateOrchestrationConfig = (
  config: OrchestrationConfig
): {ok: boolean; message: string} => {
  if (!config.id) {
    return {ok: false, message: 'Orchestration ID is required'}
  }

  if (!config.triggers || config.triggers.length === 0) {
    return {ok: false, message: 'At least one trigger is required'}
  }

  if (!config.workflow && !config.actions) {
    return {ok: false, message: 'Either workflow or actions must be specified'}
  }

  for (const trigger of config.triggers) {
    if (!trigger.name || !trigger.type) {
      return {ok: false, message: 'Each trigger must have name and type'}
    }

    if (trigger.type === 'channel' && !trigger.channels) {
      return {ok: false, message: 'Channel triggers must specify channels'}
    }

    if (trigger.type === 'time' && !trigger.interval) {
      return {ok: false, message: 'Time triggers must specify interval'}
    }
  }

  return {ok: true, message: 'Configuration valid'}
}

// Forward declarations for workflow execution functions
let executeWorkflowStep: (
  step: WorkflowStep,
  context: OrchestrationContext
) => Promise<void>
let executeSequentialSteps: (
  steps: WorkflowStep[],
  context: OrchestrationContext
) => Promise<any[]>

// Helper functions for workflow execution
const executeStepAction = async (
  step: WorkflowStep,
  context: OrchestrationContext
): Promise<any> => {
  const actionTarget = step.targets || step.action

  if (!actionTarget) {
    throw new Error('Action step requires targets or action field')
  }

  const targets =
    typeof actionTarget === 'function' ? actionTarget(context) : actionTarget
  const payload =
    typeof step.payload === 'function' ? step.payload(context) : step.payload

  const targetArray = Array.isArray(targets) ? targets : [targets]
  const results = []

  const call = await getCallFunction()

  for (const target of targetArray) {
    try {
      const result = await call(target, payload)
      results.push({target, result})
    } catch (error) {
      results.push({
        target,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return results
}

const executeConditionalSteps = async (
  step: WorkflowStep,
  context: OrchestrationContext
): Promise<any> => {
  if (!step.condition || !step.steps) {
    throw new Error('Conditional step requires condition and steps')
  }

  const conditionMet = await evaluateCondition(step.condition, context)
  if (conditionMet) {
    return executeSequentialSteps(step.steps, context)
  }
  return null
}

const executeParallelSteps = async (
  steps: WorkflowStep[],
  context: OrchestrationContext
): Promise<any[]> => {
  const promises = steps.map(async step => {
    try {
      await executeWorkflowStep(step, context)
      return {stepName: step.name, success: true}
    } catch (error) {
      return {
        stepName: step.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  const results = await Promise.allSettled(promises)
  return results.map(result =>
    result.status === 'fulfilled'
      ? result.value
      : {success: false, error: 'Promise rejected'}
  )
}

executeSequentialSteps = async (
  steps: WorkflowStep[],
  context: OrchestrationContext
): Promise<any[]> => {
  const results = []
  for (const step of steps) {
    const result = await executeWorkflowStep(step, context)
    results.push(result)
  }
  return results
}

const executeDelay = async (
  step: WorkflowStep,
  context: OrchestrationContext
): Promise<void> => {
  const delay = step.timeout || 1000
  await TimeKeeper.wait(delay, `${context.orchestrationId}-delay-${Date.now()}`)
}

const executeLoopSteps = async (
  step: WorkflowStep,
  context: OrchestrationContext
): Promise<any[]> => {
  if (!step.steps) {
    throw new Error('Loop step requires steps')
  }

  const results = []
  let iterations = 0
  const maxIterations = 100 // Safety limit

  while (iterations < maxIterations) {
    const shouldContinue = iterations < 3 // Simple example
    if (!shouldContinue) break

    const iterationResult = await executeSequentialSteps(step.steps, context)
    results.push(iterationResult)
    iterations++
  }

  return results
}

const handleStepError = async (
  step: WorkflowStep,
  error: any,
  context: OrchestrationContext
): Promise<void> => {
  if (!step.onError) {
    throw error
  }

  switch (step.onError) {
    case 'continue':
      sensor.log(context.orchestrationId, 'info', 'step-error-continue', {
        stepName: step.name,
        error: String(error)
      })
      break
    case 'retry':
      sensor.log(context.orchestrationId, 'info', 'step-error-retry', {
        stepName: step.name
      })
      throw error
    case 'abort':
      throw error
    default:
      if (Array.isArray(step.onError)) {
        await executeSequentialSteps(step.onError, context)
      }
  }
}

// Main workflow execution function
executeWorkflowStep = async (
  step: WorkflowStep,
  context: OrchestrationContext
): Promise<void> => {
  const stepStartTime = Date.now()

  try {
    if (step.condition) {
      const conditionMet = await evaluateCondition(step.condition, context)
      if (!conditionMet) {
        sensor.log(context.orchestrationId, 'info', 'step-condition-not-met', {
          stepName: step.name
        })
        return
      }
    }

    let result: any

    switch (step.type) {
      case 'action':
        result = await executeStepAction(step, context)
        break
      case 'condition':
        result = await executeConditionalSteps(step, context)
        break
      case 'parallel':
        result = await executeParallelSteps(step.steps || [], context)
        break
      case 'sequential':
        result = await executeSequentialSteps(step.steps || [], context)
        break
      case 'delay':
        result = await executeDelay(step, context)
        break
      case 'loop':
        result = await executeLoopSteps(step, context)
        break
      default:
        throw new Error(`Unknown step type: ${step.type}`)
    }

    const stepResult: StepResult = {
      stepName: step.name,
      success: true,
      result,
      duration: Date.now() - stepStartTime,
      timestamp: Date.now()
    }

    context.stepHistory.push(stepResult)

    sensor.log(context.orchestrationId, 'info', 'step-completed', {
      stepName: step.name,
      stepType: step.type,
      duration: stepResult.duration
    })
  } catch (error) {
    const stepResult: StepResult = {
      stepName: step.name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - stepStartTime,
      timestamp: Date.now()
    }

    context.stepHistory.push(stepResult)
    sensor.error(context.orchestrationId, stepResult.error!, 'step-execution')

    await handleStepError(step, error, context)
  }
}

const executeWorkflow = async (
  workflow: WorkflowStep[],
  context: OrchestrationContext
): Promise<void> => {
  for (const step of workflow) {
    await executeWorkflowStep(step, context)
  }
}

const executeActions = async (
  actions: OrchestrationAction[],
  context: OrchestrationContext
): Promise<void> => {
  const call = await getCallFunction()

  for (const action of actions) {
    if (action.condition) {
      const conditionMet = await action.condition(context)
      if (!conditionMet) continue
    }

    const targets =
      typeof action.targets === 'function'
        ? action.targets(context)
        : action.targets

    const payload =
      typeof action.payload === 'function'
        ? action.payload(context)
        : action.payload

    const targetArray = Array.isArray(targets) ? targets : [targets]

    for (const target of targetArray) {
      try {
        await call(target, payload)
      } catch (error) {
        sensor.error(context.orchestrationId, String(error), 'action-execution')
      }
    }
  }
}

const handleOrchestrationError = async (
  orchestrationId: string,
  error: any,
  context: OrchestrationContext
): Promise<void> => {
  const runtime = orchestrationStore.get(orchestrationId)
  if (!runtime?.config.errorHandling) return

  const errorConfig = runtime.config.errorHandling
  const call = await getCallFunction()

  if (errorConfig.fallback) {
    try {
      if (typeof errorConfig.fallback === 'function') {
        await errorConfig.fallback(context)
      } else {
        await call(errorConfig.fallback, {
          orchestrationId,
          error: error instanceof Error ? error.message : String(error),
          context
        })
      }
    } catch (fallbackError) {
      sensor.error(
        orchestrationId,
        String(fallbackError),
        'orchestration-fallback'
      )
    }
  }

  if (errorConfig.notifications) {
    for (const notification of errorConfig.notifications) {
      try {
        await call(notification, {
          type: 'orchestration_error',
          orchestrationId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        })
      } catch (notificationError) {
        sensor.error(
          orchestrationId,
          String(notificationError),
          'error-notification'
        )
      }
    }
  }
}

// Main orchestration execution
const executeOrchestration = async (
  orchestrationId: string,
  triggerEvent: TriggerEvent
): Promise<void> => {
  const runtime = orchestrationStore.get(orchestrationId)
  if (!runtime || runtime.status !== 'running') {
    return
  }

  const startTime = Date.now()
  const context = createOrchestrationContext(orchestrationId, triggerEvent)

  try {
    sensor.log(orchestrationId, 'info', 'orchestration-execution-start', {
      triggerName: triggerEvent.name,
      triggerType: triggerEvent.type
    })

    const updatedRuntime = {
      ...runtime,
      context,
      lastExecution: startTime,
      executionCount: runtime.executionCount + 1
    }
    orchestrationStore.set(orchestrationId, updatedRuntime)

    if (runtime.config.workflow) {
      await executeWorkflow(runtime.config.workflow, context)
    } else if (runtime.config.actions) {
      await executeActions(runtime.config.actions, context)
    }

    const executionTime = Date.now() - startTime
    updateOrchestrationMetrics(orchestrationId, true, executionTime)

    sensor.log(orchestrationId, 'info', 'orchestration-execution-success', {
      executionTime,
      triggerName: triggerEvent.name
    })
  } catch (error) {
    const executionTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    updateOrchestrationMetrics(orchestrationId, false, executionTime)
    sensor.error(orchestrationId, errorMessage, 'orchestration-execution')

    if (runtime.config.errorHandling) {
      await handleOrchestrationError(orchestrationId, error, context)
    }
  }
}

// Core orchestration functions
export const createOrchestration = (
  config: OrchestrationConfig
): {ok: boolean; message: string} => {
  try {
    const validation = validateOrchestrationConfig(config)
    if (!validation.ok) {
      return {ok: false, message: validation.message}
    }

    const runtime: OrchestrationRuntime = {
      config,
      status: 'stopped',
      executionCount: 0,
      metrics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        lastExecutionTime: 0
      }
    }

    orchestrationStore.set(config.id, runtime)

    const triggerResults = config.triggers.map(trigger =>
      registerTrigger(config.id, trigger)
    )

    const failedTriggers = triggerResults.filter(r => !r.ok)
    if (failedTriggers.length > 0) {
      return {
        ok: false,
        message: `Failed to register ${failedTriggers.length} triggers`
      }
    }

    sensor.log(config.id, 'info', 'orchestration-created', {
      triggerCount: config.triggers.length,
      hasWorkflow: !!config.workflow,
      hasActions: !!config.actions
    })

    return {
      ok: true,
      message: `Orchestration '${config.id}' created successfully`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(config.id, errorMessage, 'orchestration-creation')
    return {ok: false, message: errorMessage}
  }
}

export const startOrchestration = (
  orchestrationId: string
): {ok: boolean; message: string} => {
  const runtime = orchestrationStore.get(orchestrationId)
  if (!runtime) {
    return {ok: false, message: 'Orchestration not found'}
  }

  if (runtime.status === 'running') {
    return {ok: false, message: 'Orchestration already running'}
  }

  const updatedRuntime = {...runtime, status: 'running' as const}
  orchestrationStore.set(orchestrationId, updatedRuntime)

  sensor.log(orchestrationId, 'info', 'orchestration-started')
  return {ok: true, message: 'Orchestration started'}
}

export const stopOrchestration = (
  orchestrationId: string
): {ok: boolean; message: string} => {
  const runtime = orchestrationStore.get(orchestrationId)
  if (!runtime) {
    return {ok: false, message: 'Orchestration not found'}
  }

  const updatedRuntime = {
    ...runtime,
    status: 'stopped' as const,
    context: undefined
  }
  orchestrationStore.set(orchestrationId, updatedRuntime)

  const triggers = triggerRegistry
    .getAll()
    .filter(t => t.orchestrationId === orchestrationId)
  triggers.forEach(trigger => unregisterTrigger(trigger))

  sensor.log(orchestrationId, 'info', 'orchestration-stopped')
  return {ok: true, message: 'Orchestration stopped'}
}

export const getOrchestration = (
  orchestrationId: string
): OrchestrationRuntime | undefined => {
  return orchestrationStore.get(orchestrationId)
}

export const listOrchestrations = (): OrchestrationRuntime[] => {
  return orchestrationStore.getAll()
}

export const removeOrchestration = (orchestrationId: string): boolean => {
  stopOrchestration(orchestrationId)
  return orchestrationStore.forget(orchestrationId)
}

// Trigger management functions
const registerTrigger = (
  orchestrationId: string,
  trigger: OrchestrationTrigger
): {ok: boolean; message: string} => {
  try {
    const registration: TriggerRegistration = {
      orchestrationId,
      trigger
    }

    switch (trigger.type) {
      case 'channel':
        return registerChannelTrigger(registration)
      case 'time':
        return registerTimeTrigger(registration)
      case 'condition':
        return registerConditionTrigger(registration)
      case 'external':
        return registerExternalTrigger(registration)
      default:
        return {ok: false, message: `Unknown trigger type: ${trigger.type}`}
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {ok: false, message: errorMessage}
  }
}

const registerChannelTrigger = (
  registration: TriggerRegistration
): {ok: boolean; message: string} => {
  const {orchestrationId, trigger} = registration

  if (!trigger.channels) {
    return {ok: false, message: 'Channel trigger requires channels'}
  }

  const channels = Array.isArray(trigger.channels)
    ? trigger.channels
    : [trigger.channels]

  channels.forEach(channelPattern => {
    const handler = (payload: ActionPayload) => {
      handleChannelTrigger(orchestrationId, trigger, channelPattern, payload)
      return {
        orchestrationTriggered: true,
        orchestrationId,
        triggerName: trigger.name
      }
    }

    io.set({id: channelPattern})
    subscribers.add({id: channelPattern, fn: handler})
    registration.subscriptionId = channelPattern
  })

  triggerRegistry.set(`${orchestrationId}-${trigger.name}`, registration)
  return {ok: true, message: 'Channel trigger registered'}
}

const registerTimeTrigger = (
  registration: TriggerRegistration
): {ok: boolean; message: string} => {
  const {orchestrationId, trigger} = registration

  if (!trigger.interval) {
    return {ok: false, message: 'Time trigger requires interval'}
  }

  const result = TimeKeeper.keep(
    trigger.interval,
    () => handleTimeTrigger(orchestrationId, trigger),
    true,
    `orchestration-${orchestrationId}-${trigger.name}`
  )

  if (result.kind === 'ok') {
    registration.timerId = `orchestration-${orchestrationId}-${trigger.name}`
    triggerRegistry.set(`${orchestrationId}-${trigger.name}`, registration)
    return {ok: true, message: 'Time trigger registered'}
  } else {
    return {ok: false, message: 'Failed to register time trigger'}
  }
}

const registerConditionTrigger = (
  registration: TriggerRegistration
): {ok: boolean; message: string} => {
  triggerRegistry.set(
    `${registration.orchestrationId}-${registration.trigger.name}`,
    registration
  )
  return {ok: true, message: 'Condition trigger registered'}
}

const registerExternalTrigger = (
  registration: TriggerRegistration
): {ok: boolean; message: string} => {
  triggerRegistry.set(
    `${registration.orchestrationId}-${registration.trigger.name}`,
    registration
  )
  return {ok: true, message: 'External trigger registered'}
}

const unregisterTrigger = (registration: TriggerRegistration): void => {
  const {orchestrationId, trigger} = registration

  if (trigger.type === 'time' && registration.timerId) {
    TimeKeeper.forget(registration.timerId)
  }

  if (trigger.type === 'channel' && registration.subscriptionId) {
    subscribers.forget(registration.subscriptionId)
  }

  triggerRegistry.forget(`${orchestrationId}-${trigger.name}`)
}

// Event handlers
const handleChannelTrigger = async (
  orchestrationId: string,
  trigger: OrchestrationTrigger,
  channelId: string,
  payload: ActionPayload
): Promise<void> => {
  const runtime = orchestrationStore.get(orchestrationId)
  if (!runtime || runtime.status !== 'running') {
    return
  }

  if (trigger.condition) {
    const context = createOrchestrationContext(orchestrationId, {
      name: trigger.name,
      type: 'channel',
      channelId,
      payload,
      timestamp: Date.now()
    })

    try {
      const conditionMet = await trigger.condition(payload, context)
      if (!conditionMet) {
        sensor.log(orchestrationId, 'info', 'trigger-condition-not-met', {
          triggerName: trigger.name,
          channelId
        })
        return
      }
    } catch (error) {
      sensor.error(orchestrationId, String(error), 'trigger-condition-error')
      return
    }
  }

  const triggerEvent: TriggerEvent = {
    name: trigger.name,
    type: 'channel',
    channelId,
    payload,
    timestamp: Date.now()
  }

  await executeOrchestration(orchestrationId, triggerEvent)
}

const handleTimeTrigger = async (
  orchestrationId: string,
  trigger: OrchestrationTrigger
): Promise<void> => {
  const triggerEvent: TriggerEvent = {
    name: trigger.name,
    type: 'time',
    timestamp: Date.now()
  }

  await executeOrchestration(orchestrationId, triggerEvent)
}

export const orchestrationAPI = {
  create: createOrchestration,
  start: startOrchestration,
  stop: stopOrchestration,
  get: getOrchestration,
  list: listOrchestrations,
  remove: removeOrchestration
}
