// src/execution/immediate-executor.ts
// Fast path execution for immediate actions

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {metricsState} from '../context/metrics-state'
import {
  updateExecutionMetrics,
  recordExecution,
  logExecution,
  handleActionLink,
  createStandardErrorResponse
} from './execution-context'

/*

    C.Y.R.E. - I.M.M.E.D.I.A.T.E. - E.X.E.C.U.T.O.R

    Fast path execution for actions without timing requirements

*/

/**
 * Execute an action immediately with optimized hot path
 */
export const executeImmediately = async (
  action: IO,
  payload: ActionPayload,
  useDispatch: (io: IO) => Promise<CyreResponse>,
  call: (id: string, payload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  try {
    // Track execution start time
    const startTime = performance.now()

    // Dispatch the action
    const dispatchResult = await useDispatch({
      ...action,
      timeOfCreation: performance.now(),
      payload
    })

    // Calculate execution time and update metrics
    const executionTime = performance.now() - startTime

    // Only update metrics if dispatch was successful
    if (dispatchResult.ok) {
      updateExecutionMetrics(action.id, executionTime)
    }

    // Record metrics in breathing system
    metricsState.recordCall(action.priority?.level)

    return dispatchResult
  } catch (error) {
    // Track error and return standardized error response
    return createStandardErrorResponse('Execution failed', error)
  }
}
