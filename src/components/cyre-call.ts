// src/components/cyre-call.ts
// Clean call processing with proper flow separation

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {useDispatch} from './cyre-dispatch'
import {MSG} from '../config/cyre-config'
import {log} from './cyre-log'
import {metricsReport} from '../context/metrics-report'
import {TimeKeeper} from './cyre-timekeeper'
import {executeMiddlewareChain} from '../middleware/executor'

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
/**
 * Process call with unified middleware integration
 */
export const processCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Execute unified middleware chain
    const middlewareResult = await executeMiddlewareChain(action, payload)

    if (!middlewareResult.ok) {
      // Middleware blocked execution or failed
      return {
        ok: false,
        payload: middlewareResult.payload,
        message: middlewareResult.message,
        metadata: middlewareResult.metadata
      }
    }

    // Handle delayed execution (debounce)
    if (middlewareResult.delayed) {
      return {
        ok: true,
        payload: middlewareResult.payload,
        message: middlewareResult.message,
        metadata: {
          ...middlewareResult.metadata,
          executionPath: 'delayed',
          delayed: true
        }
      }
    }

    // Middleware passed - dispatch to execution
    return await useDispatch(action, middlewareResult.payload)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(
      `Middleware call processing failed for ${action.id}: ${errorMessage}`
    )
    metricsReport.sensor.error(
      action.id,
      errorMessage,
      'middleware-call-processing'
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
 * Handle calls with timing requirements
 */
export const scheduleCall = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Create execution callback that runs middleware then dispatches
    const executionCallback = async () => {
      // Execute middleware chain for each execution
      const middlewareResult = await executeMiddlewareChain(action, payload)

      if (!middlewareResult.ok) {
        log.debug(
          `Scheduled execution blocked by middleware for ${action.id}: ${middlewareResult.message}`
        )
        return
      }

      // Handle delayed execution within scheduled calls
      if (middlewareResult.delayed) {
        log.debug(
          `Scheduled execution delayed by middleware for ${action.id}: ${middlewareResult.duration}ms`
        )
        return
      }

      // Middleware passed - dispatch to execution
      await useDispatch(action, middlewareResult.payload)
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
