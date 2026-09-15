// src/orchestration/orchestration-engine.ts
// Updated orchestration engine with clean functional API

import {io, timeline} from '../context/state'
import {sensor} from '../components/sensor'
import {metricsState} from '../context/metrics-state'
import {orchestrationState} from '../context/orchestration-state'
import {call as cyreCall} from '../app'
import {subscribe, removeHandler} from '../components/cyre-on'
import {TimeKeeper} from '../components/cyre-timekeeper'
import {computeNextOccurrence} from '../components/cyre-calendar'
import type {
  OrchestrationConfig,
  OrchestrationTrigger,
  WorkflowStep,
  ExecutionContext,
  StepResult,
  OrchestrationRuntime,
  TriggerEvent,
  OrchestrationAction
} from '../types/orchestration'

/*

      C.Y.R.E - O.R.C.H.E.S.T.R.A.T.I.O.N - E.N.G.I.N.E - V2

      Clean functional API with TimeKeeper alignment:
      - orchestration.activate(id, boolean) - Enable/disable triggers
      - orchestration.call(id, payload) - Direct execution like cyre.call
      - orchestration.forget(id) - Remove orchestration
      - Perfect alignment with functional programming principles

*/

// Runtime storage for orchestration state now lives in
// context/orchestration-state.ts, same pattern as io/subscribers/timeline in
// context/state.ts, so orchestration runtime is visible to the rest of the
// app (metrics export, introspection, reset) instead of living in a
// module-private store only this file can see.
const {runtimes: orchestrationRuntimes, triggerSubscriptions} =
  orchestrationState

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
const keep = (config: OrchestrationConfig): {ok: boolean; message: string} => {
  try {
    // Validate configuration
    if (!config.id) {
      return {ok: false, message: 'Orchestration ID is required'}
    }

    // Registration is gated by metricsState the same way cyre.action()/
    // cyre.on() are - without this, cyre.lock() had no effect on
    // orchestration.keep() at all, silently defeating the "no more
    // registrations past this point" guarantee lock() is supposed to give.
    const registerCheck = metricsState.canRegister()
    if (!registerCheck.allowed) {
      return {ok: false, message: registerCheck.messages.join(', ')}
    }

    if (orchestrationRuntimes.get(config.id) !== undefined) {
      return {ok: false, message: 'Orchestration already exists'}
    }

    // Create runtime
    const runtime: OrchestrationRuntime = {
      config,
      status: 'inactive',
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

    // Channel triggers subscribe here, once, at registration time - like
    // any other cyre.on() call, gated by the same canRegister() check this
    // whole keep() call already went through above. This is deliberately
    // NOT done at activate()-time inside registerTriggers(): orchestrations
    // are typically activated after cyre.lock() (see this project's demo
    // convention), so subscribing on every activate() would fail against a
    // locked system the moment someone tried to re-enable a channel-
    // triggered orchestration. Instead the subscription stays live for the
    // orchestration's whole lifetime (cleaned up only in forget() below),
    // and activate()/deactivate() just flip runtime.status, which the
    // handler checks before actually running the workflow.
    subscribeChannelTriggers(config)

    sensor.info(config.id, 'info', 'orchestration-created')

    return {ok: true, message: 'Orchestration created'}
  } catch (error) {
    sensor.error(config.id, String(error), 'orchestration-creation')
    return {ok: false, message: String(error)}
  }
}

/**
 * Activate/deactivate orchestration triggers (replaces start/stop)
 * Aligns with TimeKeeper.keep/forget pattern
 */
const activate = (
  orchestrationId: string,
  enabled: boolean
): {ok: boolean; message: string} => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) {
    return {ok: false, message: 'Orchestration not found'}
  }

  try {
    if (enabled) {
      // Enable triggers (like TimeKeeper.keep)
      if (runtime.status === 'active') {
        return {ok: true, message: 'Orchestration already active'}
      }

      // Register triggers with PROPER TimeKeeper integration
      const triggerIds = registerTriggers(runtime.config)
      runtime.triggerIds = triggerIds
      runtime.status = 'active'
      orchestrationRuntimes.set(orchestrationId, runtime)

      sensor.info(orchestrationId, 'info', 'orchestration-activated')

      return {
        ok: true,
        message: `Orchestration activated with ${triggerIds.length} triggers`
      }
    } else {
      // Disable triggers (like TimeKeeper.forget)
      if (runtime.status === 'inactive') {
        return {ok: true, message: 'Orchestration already inactive'}
      }

      // Stop real TimeKeeper-backed triggers ('time' and, since the fix
      // below, 'condition' polling). 'channel' triggers are deliberately
      // skipped here - they were subscribed once in keep() and stay
      // subscribed for the orchestration's whole lifetime; deactivating
      // just means runtime.status flips to 'inactive' above, which the
      // channel handler checks before running the workflow. Actually
      // tearing the subscription down happens only in forget() below.
      runtime.config.triggers?.forEach((trigger, index) => {
        if (trigger.type === 'time' || trigger.type === 'condition') {
          const triggerId = `${orchestrationId}-trigger-${index}`
          TimeKeeper.forget(triggerId)
          timeline.forget(triggerId)
        }
      })

      // Remove from timeline
      timeline.forget(orchestrationId)
      runtime.status = 'inactive'
      runtime.triggerIds = []
      orchestrationRuntimes.set(orchestrationId, runtime)

      sensor.info(orchestrationId, 'info', 'orchestration-deactivated')

      return {ok: true, message: 'Orchestration deactivated'}
    }
  } catch (error) {
    sensor.error(
      orchestrationId,
      String(error),
      enabled ? 'orchestration-activate' : 'orchestration-deactivate'
    )
    return {ok: false, message: String(error)}
  }
}

/**
 * Pause an orchestration's TimeKeeper-backed triggers ('time'/'condition')
 * in place, without tearing down the runtime or its channel-trigger
 * subscriptions - mirrors schedule.pause() in cyre-schedule.ts. Unlike
 * activate(id, false), this doesn't forget the timers or flip
 * runtime.status to 'inactive'; it just marks each trigger timer paused so
 * resume() below can recalculate correctly. 'channel' triggers aren't
 * TimeKeeper-backed at all (they're live cyre.on() subscriptions), so
 * there's nothing to pause for them here - same scope as cyre.pause()
 * never blocking direct cyre.call()s on regular channels either.
 */
const pause = (orchestrationId: string): boolean => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) return false

  runtime.config.triggers?.forEach((trigger, index) => {
    if (trigger.type === 'time' || trigger.type === 'condition') {
      TimeKeeper.pause(`${orchestrationId}-trigger-${index}`)
    }
  })

  return true
}

/**
 * Resume an orchestration paused via pause() above. Goes through
 * TimeKeeper.resume(), which is recompute-aware (see
 * Timer['recompute'] in types/timer.ts and QuartzEngine.scheduleNext() in
 * cyre-timekeeper.ts) - a cron-based 'time' trigger paused for hours
 * recalculates its next occurrence from the actual resume time rather than
 * reusing a stale pre-pause schedule.
 */
const resume = (orchestrationId: string): boolean => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) return false

  runtime.config.triggers?.forEach((trigger, index) => {
    if (trigger.type === 'time' || trigger.type === 'condition') {
      TimeKeeper.resume(`${orchestrationId}-trigger-${index}`)
    }
  })

  return true
}

/**
 * Call orchestration directly (like cyre.call) - replaces trigger
 * Immediate execution with payload, similar to channel calls
 */
const call = async (
  orchestrationId: string,
  payload?: any
): Promise<{ok: boolean; result?: any; message: string}> => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) {
    return {ok: false, message: 'Orchestration not found'}
  }

  const triggerEvent: TriggerEvent = {
    name: 'manual-call',
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
    sensor.error(orchestrationId, String(error), 'orchestration-call')
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
  return orchestrationRuntimes.getAll()
}

/**
 * Remove orchestration completely (forget pattern)
 */
const forget = (orchestrationId: string): boolean => {
  const runtime = orchestrationRuntimes.get(orchestrationId)
  if (!runtime) {
    return false
  }

  // Deactivate first if running
  if (runtime.status === 'active') {
    activate(orchestrationId, false)
  }

  // Channel-trigger subscriptions live for the orchestration's whole
  // lifetime (see subscribeChannelTriggers(), called once from keep()),
  // independent of activate()/deactivate() cycles - clean them up here,
  // the one place this orchestration is genuinely done for good.
  runtime.config.triggers?.forEach((trigger, index) => {
    if (trigger.type === 'channel') {
      const triggerId = `${orchestrationId}-trigger-${index}`
      triggerSubscriptions.get(triggerId)?.()
      triggerSubscriptions.forget(triggerId)
    }
  })

  // Remove runtime
  orchestrationRuntimes.forget(orchestrationId)

  sensor.debug(orchestrationId, 'info', 'orchestration-forgotten')
  return true
}

/**
 * Remove every orchestration - called from cyre's top-level reset()/
 * shutdown() so a system reset doesn't leave stale OrchestrationRuntime /
 * triggerSubscription entries pointing at timers TimeKeeper.reset() just
 * destroyed out from under them. forget() already does the right thing
 * per-orchestration (deactivate + unsubscribe channel triggers + remove
 * runtime), so this is just "do that for everything, before the raw
 * io/subscriber/timeline stores it depends on get wiped".
 */
const reset = (): void => {
  list().forEach(runtime => forget(runtime.config.id))
}

/**
 * Subscribe every 'channel'-type trigger's target channel(s) to a handler
 * that runs this orchestration's workflow - called once from keep(), not
 * from registerTriggers()/activate(). See the comment in keep() for why:
 * subscribing on every activate() would break re-activating a channel-
 * triggered orchestration after cyre.lock(), since subscribe() (like
 * cyre.on()) is itself gated by metricsState.canRegister(). The
 * subscription stays live for the orchestration's whole lifetime; the
 * handler checks runtime.status before actually running anything, so
 * activate(false) can still make it a no-op without unsubscribing.
 */
const subscribeChannelTriggers = (config: OrchestrationConfig): void => {
  config.triggers?.forEach((trigger, index) => {
    if (trigger.type !== 'channel' || !trigger.channels) return

    const triggerId = `${config.id}-trigger-${index}`
    const channels = Array.isArray(trigger.channels)
      ? trigger.channels
      : [trigger.channels]
    const unsubscribers: Array<() => void> = []

    channels.forEach(channelId => {
      const channelHandler = async (payload: any) => {
        // Only run the workflow while this orchestration is actually
        // active - see the comment above for why the subscription itself
        // isn't torn down and rebuilt on every activate()/deactivate().
        const runtime = orchestrationRuntimes.get(config.id)
        if (!runtime || runtime.status !== 'active') return

        sensor.debug(
          config.id,
          `orchestration-trigger-fired: channel ${channelId}`
        )
        const triggerEvent: TriggerEvent = {
          name: trigger.name,
          type: 'channel',
          channelId,
          payload,
          timestamp: Date.now()
        }

        try {
          const result = await executeWorkflow(config, triggerEvent)
          if (result.ok) {
            sensor.debug(config.id, 'orchestration-executed-successfully')
          } else {
            sensor.error(
              config.id,
              `orchestration-failed: ${result.message}`
            )
          }
        } catch (error) {
          sensor.error(config.id, `orchestration-error: ${error}`)
        }
      }

      const subResult = subscribe(channelId, channelHandler)
      if (subResult.ok) {
        unsubscribers.push(() => removeHandler(channelId, channelHandler))
      } else {
        sensor.error(
          config.id,
          `channel-trigger-subscription-failed: ${subResult.message}`,
          'channel-trigger'
        )
      }
    })

    if (unsubscribers.length) {
      triggerSubscriptions.set(triggerId, () =>
        unsubscribers.forEach(unsubscribe => unsubscribe())
      )
    }
  })
}

/**
 * Runs one firing of a 'time' trigger's workflow, logging the same way the
 * interval-based path always has.
 */
const fireTimeTrigger = async (
  config: OrchestrationConfig,
  trigger: OrchestrationTrigger
): Promise<void> => {
  sensor.debug(config.id, 'orchestration-trigger-fired')
  const triggerEvent: TriggerEvent = {
    name: trigger.name,
    type: 'time',
    timestamp: Date.now()
  }

  try {
    const result = await executeWorkflow(config, triggerEvent)
    if (result.ok) {
      sensor.debug(config.id, 'orchestration-executed-successfully')
    } else {
      sensor.error(config.id, `orchestration-failed: ${result.message}`)
    }
  } catch (error) {
    sensor.error(config.id, `orchestration-error: ${error}`)
  }
}

/**
 * Arms a calendar-based 'time' trigger (trigger.schedule - a cron
 * expression) on TimeKeeper, using its native `recompute` hook (see
 * Timer['recompute'] in types/timer.ts) for anything that should keep
 * recurring. Mirrors armCalendarTrigger() in cyre-schedule.ts - both go
 * through cyre-calendar.ts's computeNextOccurrence() so "when does this run
 * next" is computed identically for schedule tasks and orchestrations, and
 * both hand the recompute function itself to TimeKeeper rather than
 * re-arming from outside it, so a repeating cron trigger stays locked to
 * its calendar slot (never degrading into a fixed-interval repeat) and
 * activate(true) after a deactivate() correctly recalculates rather than
 * resuming on a stale interval - TimeKeeper owns rescheduling uniformly,
 * this function only runs once, to make the initial arm.
 */
const armOrchestrationScheduleTrigger = (
  config: OrchestrationConfig,
  trigger: OrchestrationTrigger,
  triggerId: string
): void => {
  const recurrenceRule = {cron: trigger.schedule, timezone: trigger.timezone}
  const nextOccurrence = computeNextOccurrence(recurrenceRule, Date.now())

  if (nextOccurrence === undefined) {
    sensor.error(config.id, 'schedule-trigger-no-future-occurrence', triggerId)
    return
  }

  const delay = Math.max(0, nextOccurrence - Date.now())
  const shouldRearm = trigger.repeat !== false

  const timerResult = TimeKeeper.keep(
    delay,
    () => fireTimeTrigger(config, trigger),
    shouldRearm ? true : 1,
    triggerId,
    undefined,
    shouldRearm
      ? from => computeNextOccurrence(recurrenceRule, from)
      : undefined
  )

  if (timerResult.ok === 'ok') {
    sensor.debug(
      config.id,
      `timekeeper-scheduled: ${triggerId} (cron "${trigger.schedule}", next in ${delay}ms)`
    )
    timeline.add(timerResult.value)
  } else {
    sensor.error(
      config.id,
      `timekeeper-schedule-failed: ${triggerId} - ${timerResult.error}`
    )
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
        // Subscribed once at keep()-time (see subscribeChannelTriggers()
        // above), not here - this trigger type stays subscribed for the
        // orchestration's whole lifetime, and activate()/deactivate() just
        // flip runtime.status, which the channel handler already checks.
        // Nothing to do here beyond the triggerId already pushed above
        // (kept so getStatus()/the activation message still count it).
        break

      case 'time':
        if (trigger.schedule) {
          // Calendar-based (cron) trigger - a real recurrence rule, not a
          // fixed interval. See armOrchestrationScheduleTrigger() above.
          armOrchestrationScheduleTrigger(config, trigger, triggerId)
        } else if (trigger.interval) {
          // Plain fixed-interval trigger - TimeKeeper's native repeat is
          // the correct semantics here, unchanged from before.
          const timerResult = TimeKeeper.keep(
            trigger.interval, // duration
            () => fireTimeTrigger(config, trigger), // callback
            trigger.repeat !== false ? true : 1, // repeat (default true for time triggers)
            triggerId, // id
            trigger.delay // delay (optional)
          )

          if (timerResult.ok === 'ok') {
            sensor.debug(
              config.id,
              `timekeeper-scheduled: ${triggerId} (${trigger.interval}ms interval)`
            )

            // Also add to timeline for tracking
            timeline.add(timerResult.value)
          } else {
            sensor.error(
              config.id,
              `timekeeper-schedule-failed: ${triggerId} - ${timerResult.error}`
            )
          }
        }
        break

      case 'condition':
        if (trigger.condition) {
          // No dedicated poll-interval field on OrchestrationTrigger for
          // condition triggers - reuse `interval` the same way 'time'
          // triggers do, defaulting to 1000ms when the author didn't set
          // one, rather than inventing a new config field for this.
          const pollInterval = trigger.interval || 1000

          const conditionCallback = async () => {
            try {
              const pollContext: ExecutionContext = {
                orchestrationId: config.id,
                trigger: {
                  name: trigger.name,
                  type: 'condition',
                  timestamp: Date.now()
                },
                variables: {},
                startTime: Date.now(),
                stepHistory: []
              }

              const conditionMet = await trigger.condition!(
                undefined,
                pollContext
              )
              if (!conditionMet) return

              sensor.debug(config.id, 'orchestration-trigger-fired')
              const triggerEvent: TriggerEvent = {
                name: trigger.name,
                type: 'condition',
                timestamp: Date.now()
              }

              const result = await executeWorkflow(config, triggerEvent)
              if (result.ok) {
                sensor.debug(config.id, 'orchestration-executed-successfully')
              } else {
                sensor.error(
                  config.id,
                  `orchestration-failed: ${result.message}`
                )
              }
            } catch (error) {
              sensor.error(
                config.id,
                `orchestration-condition-trigger-error: ${error}`
              )
            }
          }

          const timerResult = TimeKeeper.keep(
            pollInterval,
            conditionCallback,
            trigger.repeat !== false ? true : 1,
            triggerId,
            trigger.delay
          )

          if (timerResult.ok === 'ok') {
            sensor.debug(
              config.id,
              `timekeeper-polling-condition: ${triggerId} (every ${pollInterval}ms)`
            )
            timeline.add(timerResult.value)
          } else {
            sensor.error(
              config.id,
              `timekeeper-condition-poll-failed: ${triggerId} - ${timerResult.error}`
            )
          }
        } else {
          sensor.error(
            config.id,
            'condition-trigger-missing-condition-function'
          )
        }
        break

      case 'external':
        // External triggers are handled via the call() method
        // No registration needed
        sensor.warn(
          'external-trigger-registered',
          config.id,
          triggerId,
          'warning',
          {triggerName: trigger.name}
        )
        break
    }
  })

  return triggerIds
}

/**
 * Call a channel target and, if the response only reflects a TimeKeeper
 * scheduling acknowledgment rather than real execution - see cyre-call.ts's
 * `_hasScheduling` branch, which returns `{ok: true, payload: undefined,
 * message: 'Scheduled execution'}` the instant a delayed/interval target is
 * handed to TimeKeeper.keep(), regardless of whether it has actually run -
 * wait out that target's own configured delay/interval before resolving.
 *
 * Without this, a 'sequential' workflow step only guaranteed CALL order,
 * not COMPLETION order, for any target with its own scheduling: the step
 * would resolve the moment the call was scheduled and the workflow would
 * move on to its next step before the scheduled target had actually
 * dispatched. Confirmed live in demo/orchestration-incident-response-demo.ts
 * (documented as Update 8 in the analysis doc) - a `close`/resolve step ran
 * ~1ms after a 30ms-delayed rollback step was merely scheduled, not once it
 * had completed.
 */
const callTargetAndAwaitDispatch = async (
  target: string,
  payload: any
): Promise<any> => {
  const result = await cyreCall(target, payload)

  if (result.ok && result.payload === undefined) {
    const targetConfig = io.get(target)
    const scheduledWait = targetConfig?.delay ?? targetConfig?.interval
    if (targetConfig?._hasScheduling && scheduledWait) {
      await new Promise(resolve => setTimeout(resolve, scheduledWait))
    }
  }

  return result
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

                return callTargetAndAwaitDispatch(target, payload)
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

        case 'parallel':
          if (step.steps) {
            const parallelResults = await Promise.all(
              step.steps.map(subStep =>
                executeWorkflowSteps([subStep], context)
              )
            )
            stepResult = parallelResults.flat()
          }
          break

        case 'sequential':
          if (step.steps) {
            stepResult = await executeWorkflowSteps(step.steps, context)
          }
          break

        case 'loop':
          if (step.steps) {
            const loopResults: any[] = []
            // Iteration count is configurable via step.iterations - falls
            // back to 3 (the old hardcoded value) when omitted, so existing
            // configs that never set it keep behaving exactly as before.
            const iterations =
              typeof step.iterations === 'number' && step.iterations >= 0
                ? step.iterations
                : 3
            for (let i = 0; i < iterations; i++) {
              const iterationResult = await executeWorkflowSteps(
                step.steps,
                context
              )
              loopResults.push(iterationResult)
            }
            stepResult = loopResults
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
  action: OrchestrationAction,
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

      return callTargetAndAwaitDispatch(target, payload)
    })
  )

  return results.length === 1 ? results[0] : results
}

/**
 * Main orchestration engine interface with clean functional API
 */
export const orchestration = {
  keep,
  activate, // NEW: Enable/disable triggers (replaces start/stop)
  call, // NEW: Direct execution (replaces trigger)
  get,
  list,
  forget, // RENAMED: Remove orchestration (replaces remove)
  pause, // NEW: pause TimeKeeper-backed triggers in place (mirrors schedule.pause)
  resume, // NEW: resume paused triggers - recompute-aware via TimeKeeper
  reset, // NEW: remove every orchestration - used by cyre.reset()/shutdown()

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
    const allRuntimes = orchestrationRuntimes.getAll()

    return {
      total: {
        orchestrations: orchestrationRuntimes.size(),
        running: allRuntimes.filter(r => r.status === 'active').length,
        timelineEntries: timeline.getAll().length,
        activeTriggers: timeKeeperStatus.activeFormations
      },
      breathing: metricsState.get().breathing,
      systemStress: metricsState.get().stress?.combined || 0
    }
  },

  // Backward compatibility methods (deprecated)
  /** @deprecated Use activate(id, true) instead */
  start: (id: string) => activate(id, true),

  /** @deprecated Use activate(id, false) instead */
  stop: (id: string) => activate(id, false),

  /** @deprecated Use call(id, payload) instead */
  trigger: async (id: string, triggerName: string, payload?: any) =>
    call(id, payload),

  /** @deprecated Use forget(id) instead */
  remove: (id: string) => forget(id)
}
