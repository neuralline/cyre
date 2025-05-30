// src/components/cyre-call.ts
// Fix for Cyre converting falsy values (0, undefined) to null

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {useDispatch} from './cyre-dispatch'
import {metricsReport} from '../context/metrics-report'
import {TimeKeeper} from './cyre-timekeeper'
import {
  compileProtectionPipeline,
  ProtectionContext,
  ProtectionFn
} from './cyre-actions'
import {io} from '../context/state'

/*

      C.Y.R.E - C.A.L.L 
      
      CRITICAL FIX: Cyre was converting falsy values to null
      - 0 became null (breaking interval streams)
      - undefined became null (breaking timer streams)
      - false, empty string also affected
      
      Solution: Preserve exact values throughout call chain

*/
/** 
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
*/
export async function processCall(
  action: IO,
  payload: ActionPayload | undefined
): Promise<CyreResponse> {
  const startTime = performance.now()
  const context: ProtectionContext = {
    action,
    payload: payload ?? action.payload,
    metrics: io.getMetrics(action.id),
    timestamp: Date.now()
  }
  const pipeline = action._protectionPipeline ?? []
  // Run protection pipeline
  for (const protection of pipeline) {
    const result = protection(context)

    if (!result.pass) {
      // Handle delayed execution (debounce)
      if (result.delayed && result.duration) {
        return useDebounce(action, context.payload, result.duration)
      }

      // Protection blocked execution
      metricsReport.sensor.log(action.id, 'blocked', 'protection', {
        reason: result.reason
      })

      return {
        ok: false,
        payload: null,
        message: result.reason
      }
    }

    // Update payload if protection modified it
    if (result.payload !== undefined) {
      context.payload = result.payload
    }
  }

  // Determine execution path
  if (needsScheduling(action)) {
    return useSchedule(action, context.payload)
  }

  // Direct execution
  return useDispatch(action, context.payload)
}

/**
 * Check if action needs scheduling
 */
function needsScheduling(action: IO): boolean {
  return !!(
    action.interval ||
    action.delay !== undefined ||
    (action.repeat !== undefined && action.repeat !== 1)
  )
}

/**
 * Schedule timed execution (interval/delay/repeat)
 */
function useSchedule(action: IO, payload: ActionPayload): CyreResponse {
  const interval = action.interval || action.delay || 0
  const repeat = action.repeat ?? 1
  const delay = action.delay

  TimeKeeper.keep(
    interval,
    async () => {
      await processCall(action, payload)
    },
    repeat,
    action.id,
    delay
  )

  const timingDesc =
    delay !== undefined
      ? `delay: ${delay}ms${
          action.interval ? `, then interval: ${interval}ms` : ''
        }`
      : `interval: ${interval}ms`

  return {
    ok: true,
    payload: null,
    message: `Scheduled ${repeat} execution(s) with ${timingDesc}`,
    metadata: {
      scheduled: true,
      interval,
      delay,
      repeat
    }
  }
}

/**
 * Schedule delayed execution (debounce)
 */
function useDebounce(
  action: IO,
  payload: ActionPayload,
  delay: number
): CyreResponse {
  // Clear existing debounce timer

  //debounce already exist
  if (action._debounceTimer === undefined) {
    //first time debounce
    const timerId = `${action.id}-debounce-${Date.now()}`
    action._debounceTimer = timerId
    return {
      ok: true,
      payload: null,
      message: `Debounced - will execute in ${delay}ms`,
      metadata: {delayed: true, duration: delay}
    }
  }
  TimeKeeper.forget(action._debounceTimer)
  TimeKeeper.keep(
    delay,
    async () => {
      action._debounceTimer = undefined
      await useDispatch(action, payload)
    },
    1,
    action._debounceTimer
  )

  return {
    ok: true,
    payload: null,
    message: `Debounced - will execute in ${delay}ms`,
    metadata: {delayed: true, duration: delay}
  }
}
