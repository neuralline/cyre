// src/actions/throttle.ts
// FIXED: Lightweight metrics integration

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {io} from '../context/state'
import {log} from '../components/cyre-log'
import {metricsReport} from '../context/metrics-report' // FIXED: Lightweight collector

/*

    C.Y.R.E - A.C.T.I.O.N.S - T.H.R.O.T.T.L.E. 

    Limits execution frequency based on throttle setting
    FIXED: Uses lightweight metrics collection

*/

/**
 * Throttle protection - limits execution frequency
 */
export const applyThrottleProtection = async (
  action: IO,
  payload: ActionPayload,
  next: (transformedPayload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (!action.throttle) {
    return next(payload)
  }

  const now = Date.now()
  const actionMetrics = io.getMetrics(action.id)
  const lastExecution = actionMetrics?.lastExecutionTime || 0
  const timeSinceLastExecution = now - lastExecution

  log.debug(`[THROTTLE] Checking throttle for ${action.id}:`)
  log.debug(`  - Last execution time: ${lastExecution}`)
  log.debug(`  - Time since last execution: ${timeSinceLastExecution}ms`)
  log.debug(`  - Throttle setting: ${action.throttle}ms`)

  // Industry standard: First execution always passes (lastExecution === 0)
  if (lastExecution !== 0 && timeSinceLastExecution < action.throttle) {
    // FIXED: Track throttle event with lightweight collector
    metricsReport.trackProtection(action.id, 'throttle')

    log.debug(`[THROTTLE] Throttling ${action.id} - too soon`)
    return {
      ok: false,
      payload: null,
      message: `Throttled: ${
        action.throttle - timeSinceLastExecution
      }ms remaining`
    }
  }

  log.debug(`[THROTTLE] Allowing ${action.id} to proceed`)

  // Execute the next function in the pipeline
  const result = await next(payload)

  // If execution was successful, ensure we update the lastExecutionTime
  if (result.ok) {
    io.updateMetrics(action.id, {
      lastExecutionTime: Date.now(),
      executionCount: (actionMetrics?.executionCount || 0) + 1
    })
  }

  return result
}

/**
 * Check if action should be throttled (without executing)
 */
export const shouldThrottle = (action: IO): boolean => {
  if (!action.throttle) return false

  const now = Date.now()
  const actionMetrics = io.getMetrics(action.id)
  const lastExecution = actionMetrics?.lastExecutionTime || 0
  const timeSinceLastExecution = now - lastExecution

  return lastExecution !== 0 && timeSinceLastExecution < action.throttle
}
