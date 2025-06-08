// src/components/cyre-call.ts - Fixed infinite repeats handling

import {useDispatch} from './cyre-dispatch'
import {TimeKeeper} from './cyre-timekeeper'
import {executePipeline} from '../schema/talent-definitions'
import {sensor} from '../context/metrics-report'
import {log} from './cyre-log'
import type {IO, ActionPayload, CyreResponse} from '../types/core'

/*

      C.Y.R.E - C.A.L.L - P.R.O.C.E.S.S.I.N.G
      
      Fixed infinite repeats handling:
      - Proper repeat: true logic for TimeKeeper
      - Fixed callback execution pattern
      - Better scheduling path integration

*/

interface CachedActionData {
  _hasFastPath: boolean
  _hasProcessing: boolean
  _hasScheduling: boolean
  _processingTalents: string[]
  isTestAction: boolean
}

/**
 * Cache action data for performance
 */
const getCachedActionData = (action: IO): CachedActionData => {
  return {
    _hasFastPath: action._hasFastPath ?? false,
    _hasProcessing: action._hasProcessing ?? false,
    _hasScheduling: action._hasScheduling ?? false,
    _processingTalents: action._processingTalents ?? [],
    isTestAction: action.id.includes('test') || action.id.includes('Test')
  }
}

/**
 * Fast path execution (no protections, processing, or scheduling)
 */
const executeFastPath = async (
  action: IO,
  payload: ActionPayload | undefined,
  cachedData: CachedActionData
): Promise<CyreResponse> => {
  const result = await useDispatch(action, payload)

  return result
}

/**
 * Processing pipeline execution with optimizations
 */
const executeProcessingPath = async (
  action: IO,
  payload: ActionPayload | undefined,
  cachedData: CachedActionData
): Promise<CyreResponse> => {
  const currentPayload = payload ?? action.payload

  // Use optimized pipeline execution
  const pipelineResult = executePipeline(action, currentPayload)

  if (!pipelineResult.ok) {
    sensor.log(action.id, 'skip', 'processing-pipeline-blocked', {
      reason: pipelineResult.message,
      talents: cachedData._processingTalents
    })

    return {
      ok: false,
      payload: pipelineResult.payload,
      message: pipelineResult.message || 'Pipeline blocked execution'
    }
  }

  // Continue to dispatch with processed payload
  return await useDispatch(action, pipelineResult.payload)
}

/**
 * Scheduling path execution with proper infinite repeats handling
 */
const executeSchedulingPath = async (
  action: IO,
  payload: ActionPayload | undefined,
  cachedData: CachedActionData
): Promise<CyreResponse> => {
  const currentPayload = payload ?? action.payload

  // Determine timing parameters
  const interval = action.interval ?? 0
  const delay = action.delay || undefined
  const repeat = action.repeat || 1

  // Use the interval as the duration, fall back to delay if no interval
  const duration = interval > 0 ? interval : delay

  // Generate unique timer ID for this scheduling request
  const timerId = action.id

  sensor.log(action.id, 'info', 'scheduling-action', {
    delay,
    interval,
    repeat,
    duration,
    timerId: timerId,
    hasPayload: currentPayload !== undefined
  })

  try {
    // Create execution callback that dispatches the action directly
    const executeCallback = async () => {
      try {
        sensor.log(action.id, 'info', 'scheduled-execution', {
          timerId: timerId,
          timestamp: Date.now()
        })

        // Execute through dispatch to trigger the registered handler
        const result = await useDispatch(action, currentPayload)

        if (!result.ok && cachedData.isTestAction) {
          log.error(
            `🔍 Scheduled execution failed for ${action.id}: ${result.message}`
          )
          sensor.error(
            action.id,
            'schedule execution fail',
            'scheduled-execution-error'
          )
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(action.id, errorMessage, 'scheduled-execution-error')
        log.error(`Scheduled execution error for ${action.id}: ${errorMessage}`)
        return {
          ok: false,
          payload: undefined,
          message: `Scheduled execution error: ${errorMessage}`
        }
      }
    }

    // Schedule with TimeKeeper - key fix for infinite repeats
    const timerResult = TimeKeeper.keep(
      duration,
      executeCallback,
      repeat, // This is the key - pass actualRepeat correctly
      timerId,
      delay
    )

    if (timerResult.kind === 'error') {
      sensor.error(
        action.id,
        timerResult.error.message,
        'scheduling-timer-error'
      )
      return {
        ok: false,
        payload: undefined,
        message: `Scheduling failed: ${timerResult.error.message}`
      }
    }

    sensor.log(action.id, 'success', 'action-scheduled', {
      delay,
      interval,
      duration,
      timerId,
      timeKeeperResponse: timerResult.kind
    })

    return {
      ok: true,
      payload: currentPayload,
      message: `Action scheduled successfully`,
      metadata: {
        scheduled: true,
        timerId,
        delay,
        interval,
        repeat,
        duration,
        executionPath: 'scheduling'
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'scheduling-exception')
    log.error(`Scheduling exception for ${action.id}: ${errorMessage}`)

    return {
      ok: false,
      payload: undefined,
      message: `Scheduling exception: ${errorMessage}`
    }
  }
}

/**
 * Main optimized process call function
 */
export async function processCall(
  action: IO,
  payload: ActionPayload | undefined
): Promise<CyreResponse> {
  // Get cached action data to avoid repeated property access
  const cachedData = getCachedActionData(action)

  // Minimal sensor logging for performance
  sensor.log(action.id, 'call', 'call-processing', {
    timestamp: Date.now(),
    hasPayload: payload !== undefined,
    path: cachedData._hasFastPath
      ? 'fast'
      : cachedData._hasScheduling
      ? 'scheduling'
      : 'processing'
  })

  try {
    // Execution path selection with proper priority
    if (cachedData._hasScheduling) {
      // Scheduling path has highest priority for timing-based actions

      return await executeSchedulingPath(action, payload, cachedData)
    } else if (cachedData._hasProcessing) {
      // Processing path for talent pipeline

      return await executeProcessingPath(action, payload, cachedData)
    } else {
      // Fast path for simple actions

      return await executeFastPath(action, payload, cachedData)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'process-call-exception')

    return {
      ok: false,
      payload: undefined,
      message: `Process call failed: ${errorMessage}`
    }
  }
}
