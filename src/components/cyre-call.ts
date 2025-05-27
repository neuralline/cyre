// src/components/cyre-call.ts
// Clean call processing with proper flow separation

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {applyActionPipeline} from './cyre-actions'
import {useDispatch} from './cyre-dispatch'
import {MSG} from '../config/cyre-config'
import {log} from './cyre-log'
import {metricsReport} from '../context/metrics-report'
import timeKeeper from './cyre-timekeeper'

/*

      C.Y.R.E. - C.A.L.L.
      
      Clean call processing following intended flow:
      call() → processCall() → applyPipeline() → dispatch() → cyreExecute() → [IntraLink → call()]
      
      - Removed inline protections (now in pipeline)
      - Clear separation between normal and scheduled calls
      - Proper timekeeper integration
      - Clean error handling

*/

/**
 * Main call processing function - clean and focused
 */
export const processCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  if (!action) {
    return {ok: false, payload: null, message: 'Invalid action'}
  }

  // Check if action requires timekeeper (has timing properties)
  const requiresTimekeeper = !!(
    action.interval ||
    action.delay !== undefined ||
    (action.repeat !== undefined && action.repeat !== 1 && action.repeat !== 0)
  )

  if (requiresTimekeeper) {
    return await scheduleCall(action, payload)
  }

  // Normal call flow: apply pipeline then dispatch
  return await processNormalCall(action, payload)
}

/**
 * Process normal call (no timing requirements)
 */
const processNormalCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Apply action pipeline (includes all protections)
    const pipelineResult = await applyActionPipeline(action, payload)

    if (!pipelineResult.ok) {
      // Pipeline blocked execution
      return pipelineResult
    }

    // Pipeline passed - dispatch to execution
    return await useDispatch(action, pipelineResult.payload)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Normal call processing failed for ${action.id}: ${errorMessage}`)
    metricsReport.sensor.error(
      action.id,
      errorMessage,
      'normal-call-processing'
    )

    return {
      ok: false,
      payload: null,
      message: `Call processing failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * Handle calls with delay, interval and repeat using timekeeper
 */
const scheduleCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Create execution callback that applies pipeline then dispatches
    const executionCallback = async () => {
      // Apply pipeline for each execution
      const pipelineResult = await applyActionPipeline(action, payload)

      if (!pipelineResult.ok) {
        log.debug(
          `Scheduled execution blocked by pipeline for ${action.id}: ${pipelineResult.message}`
        )
        return
      }

      // Pipeline passed - dispatch to execution
      await useDispatch(action, pipelineResult.payload)
    }

    // Configure timing parameters
    const interval = action.interval || action.delay || 0
    const repeat = action.repeat ?? 1
    const delay = action.delay

    log.debug(
      `Scheduling with TimeKeeper: interval=${interval}, delay=${delay}, repeat=${repeat}, id=${action.id}`
    )

    // Schedule with timekeeper
    const timekeeperResult = timeKeeper.keep(
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
