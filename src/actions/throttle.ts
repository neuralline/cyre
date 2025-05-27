// src/actions/throttle.ts
// FIXED: Lightweight metrics integration

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {io} from '../context/state'
import {log} from '../components/cyre-log'
import {metricsReport} from '../context/metrics-report' // FIXED: Lightweight collector

/*

    C.Y.R.E - A.C.T.I.O.N.S - T.H.R.O.T.T.L.E 

    Limits execution frequency based on throttle setting
   

*/

export const throttle = (action: IO, payload: ActionPayload): CyreResponse => {
  if (!action.throttle) {
    return {
      ok: false,
      error: true,
      payload: null,
      message: `Throttle not defined`
    }
  }

  const now = Date.now()
  const lastExecution = io.getMetrics(action.id)?.lastExecutionTime || 0
  const timeSinceLastExecution = now - lastExecution

  // Industry standard: First execution always passes (lastExecution === 0)
  if (lastExecution !== 0 && timeSinceLastExecution < action.throttle) {
    // FIXED: Track throttle event with lightweight collector
    metricsReport.trackProtection(action.id, 'throttle')

    return {
      ok: true,
      payload: null,
      message: `Throttled: ${
        action.throttle - timeSinceLastExecution
      }ms remaining`
    }
  }

  // If execution was successful, ensure we update the lastExecutionTime

  return {
    ok: false,
    payload: null,
    message: `0ms remaining`
  }
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
