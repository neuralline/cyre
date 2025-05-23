// src/core/cyre-executor.ts
// Main execution engine with hot/cold path optimization

import type {IO, CyreResponse, ActionResult} from '../types/interface'
import {MSG} from '../config/cyre-config'
import {io, subscribers} from '../context/state'
import {metricsReport} from '../context/metrics-report'
import CyreAction from '../components/cyre-actions'
import {log} from '../components/cyre-log'
import {historyState} from '../context/history-state'

/*
  
      C.Y.R.E. - E.X.E.C.U.T.O.R
  
      Main execution engine with optimized hot/cold path separation
  
  */

/**
 * Simplified useDispatch that focuses solely on dispatching to subscribers
 */
export const useDispatch = async (io: IO): Promise<CyreResponse> => {
  if (!io?.id) {
    throw new Error('Invalid IO object')
  }

  // Find subscriber
  const subscriber = subscribers.get(io.id)
  if (!subscriber) {
    const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${io.id}`
    // Record failed dispatch in history
    historyState.record(io.id, io.payload, {ok: false, message: error})
    return {ok: false, payload: null, message: error}
  }

  // Execute action
  const startTime = performance.now()
  const dispatch = CyreAction({...io}, subscriber.fn)
  const duration = performance.now() - startTime

  // Record history
  historyState.record(
    io.id,
    io.payload,
    {ok: dispatch.ok, message: dispatch.message, error: dispatch.error},
    duration
  )

  // Log if enabled
  if (io.log) {
    log.info({
      ...dispatch,
      executionTime: duration,
      timestamp: Date.now()
    })
  }

  // Handle intraLink (chain to next action)
  if (dispatch.ok && dispatch.intraLink) {
    const {id: nextId, payload: nextPayload} = dispatch.intraLink
    if (nextId) {
      // Use setImmediate to avoid blocking the current execution
      setImmediate(async () => {
        try {
          await executeAction(nextId, nextPayload)
        } catch (error) {
          log.error(`Linked action error: ${error}`)
        }
      })
    }
  }

  // Return standardized response reflecting actual dispatch result
  return {
    ok: dispatch.ok,
    payload: dispatch,
    message: dispatch.message || MSG.WELCOME
  }
}

/**
 * Entry point for action execution with hot/cold path optimization
 */
const executeAction = (action: ActionResult): ActionResult => {
  if (action.skipped || action.status === 'error') {
    return action
  }

  try {
    const subscriber = subscribers.get(action.id)
    if (!subscriber) {
      throw new Error(`No subscriber found for: ${action.id}`)
    }

    // Track execution start time
    const startTime = performance.now()

    const result = subscriber.fn(action.payload)
    const endTime = performance.now()
    const executionTime = endTime - startTime

    // Update metrics with execution time
    io.updateMetrics(action.id, {
      lastExecutionTime: Date.now(),
      executionCount: (io.getMetrics(action.id)?.executionCount || 0) + 1
    })
    if (
      typeof metricsReport !== 'undefined' &&
      typeof metricsReport.trackListenerExecution === 'function'
    ) {
      metricsReport.trackListenerExecution(action.id, executionTime)
    }

    // Handle linked actions - updated logic
    if (result && typeof result === 'object' && 'id' in result) {
      return {
        ...action,
        ok: true,
        done: true,
        status: 'completed',
        intraLink: {
          id: result.id,
          payload: result.payload
        }
      }
    }

    return {
      ...action,
      ok: true,
      done: true,
      status: 'completed'
    }
  } catch (error) {
    log.error(
      `CYRE ACTION ERROR: ${MSG.ACTION_EXECUTE_FAILED} -id ${action.id} ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return {
      ...action,
      ok: false,
      done: false,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
