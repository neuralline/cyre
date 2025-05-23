// src/execution/execution-context.ts
// Shared execution state and utilities

import type {
  IO,
  ActionPayload,
  CyreResponse,
  StateKey
} from '../types/interface'
import {MSG} from '../config/cyre-config'
import {log} from '../components/cyre-log'
import {historyState} from '../context/history-state'
import {io} from '../context/state'
import {metricsReport} from '../context/metrics-report'

/*
  
      C.Y.R.E. - E.X.E.C.U.T.I.O.N. - C.O.N.T.E.X.T
  
      Shared execution utilities and context management
  
  */

/**
 * Standardized error response generator
 */
export const createStandardErrorResponse = (
  context: string,
  error: unknown
): CyreResponse => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  log.error(`${context}: ${errorMessage}`)

  return {
    ok: false,
    payload: null,
    message: `${context}: ${errorMessage}`
  }
}

/**
 * Update execution metrics after successful execution
 */
export const updateExecutionMetrics = (
  actionId: StateKey,
  executionTime: number
): void => {
  // Track execution metrics
  metricsReport.trackExecution(actionId, executionTime)

  // Update IO metrics
  io.updateMetrics(actionId, {
    lastExecutionTime: Date.now(),
    executionCount: (io.getMetrics(actionId)?.executionCount || 0) + 1
  })
}

/**
 * Record execution in history
 */
export const recordExecution = (
  actionId: StateKey,
  payload: ActionPayload,
  result: {ok: boolean; message?: string; error?: string},
  duration?: number
): void => {
  historyState.record(actionId, payload, result, duration)
}

/**
 * Log execution if enabled
 */
export const logExecution = (
  action: IO,
  result: any,
  duration: number
): void => {
  if (action.log) {
    log.info({
      ...result,
      executionTime: duration,
      timestamp: Date.now()
    })
  }
}

/**
 * Handle action linking (chaining to next action)
 */
export const handleActionLink = async (
  dispatch: any,
  call: (id: string, payload?: ActionPayload) => Promise<CyreResponse>
): Promise<void> => {
  if (dispatch?.intraLink) {
    const {id, payload} = dispatch.intraLink
    try {
      await call(id, payload)
    } catch (error) {
      log.error(`Linked action error: ${error}`)
    }
  }
}

/**
 * Validate action ID
 */
export const validateActionId = (
  id?: string
): {valid: boolean; message?: string} => {
  if (!id?.trim()) {
    return {
      valid: false,
      message: MSG.CALL_INVALID_ID
    }
  }
  return {valid: true}
}

/**
 * Get action from store with validation
 */
export const getValidatedAction = (
  id: string
): {action?: IO; error?: string} => {
  const action = io.get(id.trim())
  if (!action) {
    return {
      error: `${MSG.CALL_NOT_RESPONDING}: ${id}`
    }
  }
  return {action}
}

/**
 * Determine execution strategy based on action configuration
 */
export const getExecutionStrategy = (action: IO): 'immediate' | 'timed' => {
  return action.interval || action.delay ? 'timed' : 'immediate'
}
