// src/components/cyre-call.ts
// Call processing with proper payload flow and debounce handling

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {useDispatch} from './cyre-dispatch'
import {metricsReport, sensor} from '../context/metrics-report'
import {TimeKeeper} from './cyre-timekeeper'
import {ProtectionContext} from './cyre-actions'
import {io} from '../context/state'
import {log} from './cyre-log'

/*

      C.Y.R.E - C.A.L.L 
      
      Call processing with proper payload transformation through pipeline

*/

export async function processCall(
  action: IO,
  payload: ActionPayload | undefined
): Promise<CyreResponse> {
  const startTime = performance.now()
  sensor.log(action.id, 'call', 'call-initiation', {
    timestamp: Date.now(),
    hasPayload: payload !== undefined,
    actionType: action.type || 'unknown'
  })

  const originalPayload = payload ?? action.payload
  const context: ProtectionContext = {
    action,
    payload: originalPayload,
    originalPayload,
    metrics: io.getMetrics(action.id),
    timestamp: Date.now()
  }

  const pipeline = action._protectionPipeline || []

  // Run protection pipeline
  for (const protection of pipeline) {
    const result = protection(context)

    if (!result.pass) {
      // Handle delayed execution (debounce) - preserve processed payload
      if (result.delayed && result.duration) {
        sensor.debounce(action.id, result.duration, 1, 'protection-pipeline')
        return useDebounce(action, context.payload, result.duration)
      }

      const protectionType = extractProtectionType(result.reason)
      sensor.log(action.id, protectionType, 'protection-pipeline', {
        reason: result.reason,
        protectionActive: true
      })

      return {
        ok: false,
        payload: null,
        message: result.reason
      }
    }

    // Update payload if protection modified it (selector, transform, etc.)
    if (result.payload !== undefined) {
      context.payload = result.payload
    }
  }

  // Determine execution path
  if (needsScheduling(action)) {
    return useSchedule(action, context.payload)
  }

  // Direct execution with processed payload
  const result = await useDispatch(action, context.payload)

  // Handle IntraLink chain reactions
  if (result.ok && result.metadata?.intraLink) {
    const {id: chainId, payload: chainPayload} = result.metadata.intraLink
    try {
      const chainResult = await processCall(io.get(chainId)!, chainPayload)
      result.metadata.chainResult = chainResult
    } catch (error) {
      log.error(`IntraLink chain failed for ${chainId}: ${error}`)
      result.metadata.chainError =
        error instanceof Error ? error.message : String(error)
    }
  }

  return result
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
 * Extract protection type from reason message for better metrics
 */
function extractProtectionType(
  reason: string
): 'throttle' | 'blocked' | 'skip' | 'error' {
  if (reason.includes('Throttled')) return 'throttle'
  if (reason.includes('unchanged')) return 'skip'
  if (reason.includes('not available')) return 'blocked'
  if (reason.includes('Condition not met')) return 'skip'
  if (reason.includes('Selector failed')) return 'error'
  if (reason.includes('Transform failed')) return 'error'
  return 'error'
}

/**
 * Schedule timed execution (interval/delay/repeat)
 */
function useSchedule(action: IO, payload: ActionPayload): CyreResponse {
  const interval = action.interval || action.delay || 0
  const repeat = action.repeat ?? 1
  const delay = action.delay

  metricsReport.sensor.log(action.id, 'info', 'scheduling', {
    interval,
    delay,
    repeat,
    scheduledExecution: true
  })

  const result = TimeKeeper.keep(
    interval,
    async () => {
      await useDispatch(action, payload)
    },
    repeat,
    action.id,
    delay
  )

  if (result.kind === 'error') {
    return {
      ok: false,
      payload: null,
      message: `Scheduling failed: ${result.error.message}`,
      error: result.error.message
    }
  }

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
 * Schedule delayed execution (debounce) - preserves processed payload
 */
function useDebounce(
  action: IO,
  payload: ActionPayload,
  delay: number
): CyreResponse {
  if (action._debounceTimer) {
    TimeKeeper.forget(action._debounceTimer)
  }

  const timerId = `${action.id}-debounce-${Date.now()}`
  action._debounceTimer = timerId

  const result = TimeKeeper.keep(
    delay,
    async () => {
      action._debounceTimer = undefined

      metricsReport.sensor.log(action.id, 'info', 'debounce-execution', {
        executedAfterDelay: delay,
        timestamp: Date.now()
      })

      // Execute directly with processed payload - bypass pipeline since it already ran
      await useDispatch(action, payload)
    },
    1,
    timerId
  )

  if (result.kind === 'error') {
    return {
      ok: false,
      payload: null,
      message: `Debounce scheduling failed: ${result.error.message}`,
      error: result.error.message
    }
  }

  return {
    ok: true,
    payload: null,
    message: `Debounced - will execute in ${delay}ms`,
    metadata: {delayed: true, duration: delay}
  }
}
