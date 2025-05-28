// src/components/cyre-call.ts
// Simplified call processing with built-in protections only

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {useDispatch} from './cyre-dispatch'
import {log} from './cyre-log'
import {metricsReport} from '../context/metrics-report'
import {TimeKeeper} from './cyre-timekeeper'
import {applyBuiltInProtections} from './cyre-actions'

/*

      C.Y.R.E - C.A.L.L
      
      Simplified call processing with built-in protections:
      - Clean execution flow: call() → built-in protections → dispatch()
      - No external middleware in core
      - Proper timekeeper integration
      - Clear error handling

*/

/**
 * Process call with built-in protections only
 */
export const processCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Apply built-in protections
    const protectionResult = await applyBuiltInProtections(action, payload)

    if (!protectionResult.ok) {
      return {
        ok: false,
        payload: protectionResult.payload,
        message: protectionResult.message,
        metadata: {
          executionPath: 'blocked-by-protection',
          ...protectionResult.metadata
        }
      }
    }

    // Handle delayed execution (debounce)
    if (protectionResult.delayed) {
      return {
        ok: true,
        payload: protectionResult.payload,
        message: protectionResult.message,
        metadata: {
          executionPath: 'delayed-by-protection',
          delayed: true,
          duration: protectionResult.duration,
          ...protectionResult.metadata
        }
      }
    }

    // Built-in protections passed - dispatch to execution
    return await useDispatch(action, protectionResult.payload)
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
 * Handle calls with timing requirements
 */
export const scheduleCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Create execution callback that applies protections then dispatches
    const executionCallback = async () => {
      // Apply built-in protections for each execution
      const protectionResult = await applyBuiltInProtections(action, payload)

      if (!protectionResult.ok || protectionResult.blocked) {
        log.debug(
          `Scheduled execution blocked by protection for ${action.id}: ${protectionResult.message}`
        )
        return
      }

      // Handle delayed execution within scheduled calls
      if (protectionResult.delayed) {
        log.debug(
          `Scheduled execution delayed by protection for ${action.id}: ${protectionResult.duration}ms`
        )
        return
      }

      // Protections passed - dispatch to execution
      await useDispatch(action, protectionResult.payload)
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
