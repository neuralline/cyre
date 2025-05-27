// src/components/cyre-call.ts
import {metricsState} from '../context/metrics-state'
import {io, subscribers, timeline} from '../context/state'
import {ActionPayload, CyreResponse, IO} from '../types/core'
import {TimeKeeper} from './cyre-timekeeper'
import {historyState} from '../context/history-state'
import {cyreExecute} from './cyre-execute'
import {MSG} from '../config/cyre-config'
import {log} from './cyre-log'

import {applyActionPipeline} from './cyre-actions'
import {metricsReport} from '../context/metrics-report'

export const processCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  if (!action) {
    return {ok: false, payload: null, message: 'Invalid action'}
  }

  // System recuperation check
  const {breathing, stress} = metricsState.get()
  if (breathing.isRecuperating && action.priority?.level !== 'critical') {
    metricsReport.sensor.log(action.id, 'blocked', 'system-recuperation')
    return {
      ok: false,
      payload: null,
      message: `System recuperating (${(
        breathing.recuperationDepth * 100
      ).toFixed(1)}% depth). Try later.`
    }
  }

  // Handle repeat: 0 as "don't execute"
  if (action.repeat === 0) {
    metricsReport.sensor.log(action.id, 'blocked', 'repeat-zero')
    return {
      ok: true,
      payload: null,
      message: 'Action registered but not executed (repeat: 0)'
    }
  }

  // Check if action requires timekeeper (has timing properties)
  const requiresTimekeeper = !!(
    action.interval ||
    action.delay !== undefined ||
    (action.repeat !== undefined && action.repeat !== 1 && action.repeat !== 0)
  )

  await applyActionPipeline(action, payload)
  if (requiresTimekeeper) {
    return await scheduleCall(action, payload)
  }

  //if all clear dispatch action
  await useDispatch(action, payload)
}

//handle calls with delay, interval and repeat
const scheduleCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Create execution callback for timekeeper
    const executionCallback = async () => {
      // Apply pipeline then execute
      return await useDispatch(action, payload)
    }

    // Configure timing parameters
    const interval = action.interval || action.delay || 0
    const repeat = action.repeat ?? 1
    const delay = action.delay

    log.debug(
      `Scheduling with TimeKeeper: interval=${interval}, delay=${delay}, repeat=${repeat}, id=${action.id}`
    )

    // Schedule with timekeeper
    const timekeeperResult = TimeKeeper.keep(
      interval,
      executionCallback,
      repeat,
      action.id,
      delay
    )

    if (timekeeperResult.kind === 'error') {
      metricsReport.sensor.error(
        action.id,
        timekeeperResult.error.message,
        'timekeeper-scheduling'
      )
      return {
        ok: false,
        payload: null,
        message: `Timekeeper scheduling failed: ${timekeeperResult.error.message}`,
        error: timekeeperResult.error.message
      }
    }

    const timingDescription =
      delay !== undefined && action.interval
        ? `delay: ${delay}ms, then interval: ${interval}ms`
        : delay !== undefined
        ? `delay: ${delay}ms`
        : action.interval
        ? `interval: ${interval}ms`
        : 'immediate'

    metricsReport.sensor.log(action.id, 'delayed', 'timekeeper-scheduled', {
      interval,
      delay,
      repeat,
      timingDescription
    })

    return {
      ok: true,
      payload: null,
      message: `Scheduled ${repeat} execution(s) with ${timingDescription}`,
      metadata: {
        executionPath: 'timekeeper',
        interval,
        delay,
        repeat,
        scheduled: true,
        timingDescription
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Timekeeper execution failed for ${action.id}: ${errorMessage}`)
    metricsReport.sensor.error(action.id, errorMessage, 'timekeeper-execution')

    return {
      ok: false,
      payload: null,
      message: `Timekeeper execution failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

export const useDispatch = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()
  const currentPayload = payload || action.payload

  try {
    // Get subscriber
    const subscriber = subscribers.get(action.id)
    if (!subscriber) {
      const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${action.id}`
      metricsReport.sensor.log(
        action.id,
        'no subscriber',
        'dispatch-to-execute'
      )

      metricsReport.sensor.error(action.id, 'dispatch', 'dispatch-to-execute')

      return {ok: false, payload: null, message: error}
    }

    metricsReport.sensor.log(action.id, 'dispatch', 'dispatch-to-execute')

    // Execute through cyreExecute (renamed from cyreAction)
    const result = await cyreExecute(
      {
        ...action,
        currentPayload,
        timeOfCreation: startTime
      },
      subscriber.fn
    )

    const totalTime = performance.now() - startTime

    // Record execution metrics
    metricsReport.sensor.execution(
      action.id,
      totalTime,
      'execution',
      'useDispatch'
    )

    // Handle IntraLink (chain reactions)
    if (result.intraLink) {
      log.debug(`IntraLink detected: ${action.id} -> ${result.intraLink.id}`)

      // Recursively call the linked action
      try {
        const chainResult = await processCall(
          io.get(result.intraLink.id)!,
          result.intraLink.payload
        )

        return {
          ok: true,
          payload: result.payload,
          message: MSG.WELCOME,
          metadata: {
            executionTime: totalTime,
            intraLink: {
              id: result.intraLink.id,
              payload: result.intraLink.payload,
              chainResult: chainResult
            }
          }
        }
      } catch (chainError) {
        log.error(`IntraLink execution failed: ${chainError}`)
      }
    }

    return {
      ok: result.ok,
      payload: result.payload,
      message: result.ok ? MSG.WELCOME : result.error || 'Execution failed',
      metadata: {
        executionTime: totalTime
      }
    }
  } catch (error) {
    const totalTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(`Dispatch failed for ${action.id}: ${errorMessage}`)
    metricsReport.sensor.error(action.id, errorMessage, 'dispatch-execution')

    historyState.record(
      action.id,
      currentPayload,
      {ok: false, error: errorMessage},
      totalTime
    )

    return {
      ok: false,
      payload: null,
      message: `Dispatch failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}
