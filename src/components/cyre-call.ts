// src/components/cyre-call.ts
// Fix for Cyre converting falsy values (0, undefined) to null

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {useDispatch} from './cyre-dispatch'
import {log} from './cyre-log'
import {metricsReport} from '../context/metrics-report'
import {TimeKeeper} from './cyre-timekeeper'
import {applyBuiltInProtections} from './cyre-actions'

/*

      C.Y.R.E - C.A.L.L 
      
      CRITICAL FIX: Cyre was converting falsy values to null
      - 0 became null (breaking interval streams)
      - undefined became null (breaking timer streams)
      - false, empty string also affected
      
      Solution: Preserve exact values throughout call chain

*/

/**
 * Process call without timing - protections already applied
 */
export const processCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Protections already applied in main call() - direct dispatch
    return await useDispatch(action, payload)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Call processing failed for ${action.id}: ${errorMessage}`)
    metricsReport.sensor.error(action.id, errorMessage, 'call-processing')

    return {
      ok: false,
      payload: null,
      message: `Call processing failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * Handle calls with timing requirements - protections already applied
 */
export const scheduleCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Create execution callback - protections already applied in main call()
    const executionCallback = async () => {
      // Direct dispatch without re-applying protections
      await useDispatch(action, payload)
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
