// src/middleware/executor.ts
// Unified middleware execution system

import type {
  IO,
  ActionPayload,
  CyreResponse,
  StateKey,
  InternalMiddlewareContext,
  ChainExecutionResult,
  MiddlewareResult
} from '../types/interface'

import {composeMiddleware} from './core'
import {middlewareState} from './state'
import {io} from '../context/state'
import {metricsState} from '../context/metrics-state'
import {metricsReport} from '../context/metrics-report'
import {log} from '../components/cyre-log'
import timeKeeper from '../components/cyre-timekeeper'

/*
  
        C.Y.R.E. - M.I.D.D.L.E.W.A.R.E - E.X.E.C.U.T.O.R.
        
        Unified middleware execution:
        - Single execution path for all protections
        - Zero overhead fast path for simple actions  
        - Handles blocking, delays, and transformations
        - Proper error handling and metrics tracking
  
  */

// Active debounce timers
const debounceTimers = new Map<StateKey, string>()

/**
 * Execute middleware chain for an action
 */
export const executeMiddlewareChain = async (
  action: IO,
  payload?: ActionPayload
): Promise<ChainExecutionResult> => {
  const startTime = performance.now()
  const executionId = `${action.id}-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`

  try {
    // Check for fast path (no middleware)

    const chain = middlewareState.getChain(action.id)?.middlewares || []
    if (middlewareState.isFastPath(action.id)) {
      metricsReport.sensor.log(action.id, 'info', 'middleware-fast-path')

      return {
        ok: true,
        payload: payload || action.payload,
        message: 'Fast path - no middleware'
      }
    }

    // Get middleware chain

    if (!chain || chain.length === 0) {
      return {
        ok: true,
        payload: payload || action.payload,
        message: 'No middleware configured'
      }
    }

    // Get middleware entries
    const middlewareEntries = middlewareState.getEntries(chain)
    if (middlewareEntries.length === 0) {
      log.warn(`No valid middleware found for chain: ${action.id}`)
      return {
        ok: true,
        payload: payload || action.payload,
        message: 'No valid middleware in chain'
      }
    }

    // Create internal context with state access
    const context: InternalMiddlewareContext = {
      action,
      payload: payload || action.payload,
      state: {
        metrics: io.getMetrics(action.id),
        payloadHistory: io.getPrevious(action.id),
        systemState: metricsState.get()
      },
      timestamp: Date.now(),
      executionId
    }

    // Compose and execute middleware chain
    const executionChain = composeMiddleware(middlewareEntries, context)
    const result = await executionChain(context.payload)

    // Process result
    const totalTime = performance.now() - startTime

    metricsReport.sensor.log(action.id, 'info', 'middleware-chain-executed', {
      middlewareCount: middlewareEntries.length,
      executionTime: totalTime,
      result: result.type
    })

    return await processMiddlewareResult(action, result, context, totalTime)
  } catch (error) {
    const totalTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(
      `Middleware chain execution failed for ${action.id}: ${errorMessage}`
    )
    metricsReport.sensor.error(action.id, errorMessage, 'middleware-execution')

    return {
      ok: false,
      payload: null,
      message: `Middleware execution failed: ${errorMessage}`,
      metadata: {
        executionTime: totalTime,
        error: errorMessage
      }
    }
  }
}

/**
 * Process middleware result into chain execution result
 */
const processMiddlewareResult = async (
  action: IO,
  result: MiddlewareResult,
  context: InternalMiddlewareContext,
  executionTime: number
): Promise<ChainExecutionResult> => {
  switch (result.type) {
    case 'continue':
    case 'transform':
      return {
        ok: true,
        payload: result.payload ?? context.payload,
        message: 'Middleware chain passed',
        metadata: {
          executionTime,
          middlewareResult: result.type
        }
      }

    case 'block':
      metricsReport.sensor.log(action.id, 'blocked', 'middleware-blocked', {
        reason: result.reason,
        metadata: result.metadata
      })

      return {
        ok: false,
        payload: null,
        message: result.reason,
        blocked: true,
        metadata: {
          executionTime,
          blockReason: result.reason,
          ...result.metadata
        }
      }

    case 'delay':
      return await processDelayResult(action, result, context, executionTime)

    default:
      log.warn(`Unknown middleware result type: ${(result as any).type}`)
      return {
        ok: true,
        payload: context.payload,
        message: 'Unknown result type - defaulting to continue'
      }
  }
}

/**
 * Process delay result (debounce handling)
 */
const processDelayResult = async (
  action: IO,
  result: Extract<MiddlewareResult, {type: 'delay'}>,
  context: InternalMiddlewareContext,
  executionTime: number
): Promise<ChainExecutionResult> => {
  const {duration, payload, metadata} = result

  // Cancel existing debounce timer if any
  const existingTimerId = debounceTimers.get(action.id)
  if (existingTimerId) {
    timeKeeper.forget(existingTimerId)
  }

  // Create new debounce timer
  const debounceTimerId = `${action.id}-debounce-${Date.now()}`
  debounceTimers.set(action.id, debounceTimerId)

  metricsReport.sensor.debounce(action.id, duration, 1, 'middleware-debounce')

  return new Promise(resolve => {
    const timerResult = timeKeeper.keep(
      duration,
      () => {
        // Clean up timer reference
        debounceTimers.delete(action.id)

        resolve({
          ok: true,
          payload: payload ?? context.payload,
          message: `Delayed execution completed after ${duration}ms`,
          delayed: true,
          duration,
          metadata: {
            executionTime,
            debounceDelay: duration,
            ...metadata
          }
        })
      },
      1, // Execute once
      debounceTimerId
    )

    if (timerResult.kind === 'error') {
      debounceTimers.delete(action.id)
      resolve({
        ok: false,
        payload: null,
        message: `Delay setup failed: ${timerResult.error.message}`,
        metadata: {
          executionTime,
          error: timerResult.error.message
        }
      })
    }
  })
}

/**
 * Cancel any pending debounce for an action
 */
export const cancelDebounce = (actionId: StateKey): boolean => {
  const timerId = debounceTimers.get(actionId)
  if (timerId) {
    timeKeeper.forget(timerId)
    debounceTimers.delete(actionId)
    return true
  }
  return false
}

/**
 * Check if action has pending debounce
 */
export const hasPendingDebounce = (actionId: StateKey): boolean => {
  return debounceTimers.has(actionId)
}

/**
 * Get debounce timer statistics
 */
export const getDebounceStats = () => {
  return {
    activeDebounceTimers: debounceTimers.size,
    activeTimerIds: Array.from(debounceTimers.keys())
  }
}

/**
 * Clear all debounce timers
 */
export const clearAllDebounceTimers = (): void => {
  for (const timerId of debounceTimers.values()) {
    timeKeeper.forget(timerId)
  }
  debounceTimers.clear()
}
