// src/components/cyre-dispatch.ts
// Updated dispatch logic with unified middleware integration

import {subscribers, io} from '../context/state'
import {ActionPayload, CyreResponse, IO} from '../types/core'
import {cyreExecute} from './cyre-execute'
import {historyState} from '../context/history-state'
import {MSG} from '../config/cyre-config'
import {log} from './cyre-log'
import {metricsReport} from '../context/metrics-report'

/*

      C.Y.R.E. - D.I.S.P.A.T.C.H.
      
      Updated dispatch logic with middleware integration:
      - Find subscriber and execute
      - Handle IntraLink chain reactions
      - Record execution history
      - Update payload history after successful execution
      - Proper error handling and metrics

*/

/**
 * Dispatch action to subscriber for execution
 */
export const useDispatch = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()
  const currentPayload = payload || action.payload

  try {
    // Get subscriber
    const subscriber = subscribers.get(action.id)
    if (!subscriber) {
      const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${action.id}`
      metricsReport.sensor.log(
        action.id,
        'no subscriber',
        'dispatch-to-execute'
      )

      return {ok: false, payload: null, message: error}
    }

    metricsReport.sensor.log(action.id, 'dispatch', 'dispatch-to-execute')

    // Execute through cyreExecute
    const result = await cyreExecute(
      {
        ...action,
        payload: currentPayload,
        timeOfCreation: startTime
      },
      subscriber.fn
    )

    const totalTime = performance.now() - startTime

    // Record execution metrics
    metricsReport.sensor.execution(
      action.id,
      totalTime,
      'execution',
      'useDispatch'
    )

    // IMPORTANT: Update payload history after successful execution for change detection
    if (result.ok) {
      // Update payload history for change detection on successful execution
      if (action.detectChanges) {
        io.updatePayload(action.id, currentPayload)
      }

      // Track execution in metrics
      io.trackExecution(action.id, totalTime)
    }

    // Record in history
    historyState.record(
      action.id,
      currentPayload,
      {
        ok: result.ok,
        message: result.ok
          ? 'Execution completed'
          : result.error || 'Execution failed',
        error: result.error
      },
      totalTime
    )

    // Handle IntraLink (chain reactions)
    if (result.intraLink) {
      log.debug(`IntraLink detected: ${action.id} -> ${result.intraLink.id}`)

      // Record the chain reaction
      metricsReport.sensor.intralink(action.id, result.intraLink.id, 'dispatch')

      // Return success with IntraLink info for processing by caller
      return {
        ok: true,
        payload: result.payload,
        message: MSG.WELCOME,
        metadata: {
          executionTime: totalTime,
          intraLink: {
            id: result.intraLink.id,
            payload: result.intraLink.payload
          }
        }
      }
    }

    return {
      ok: result.ok,
      payload: result.payload,
      message: result.ok ? MSG.WELCOME : result.error || 'Execution failed',
      metadata: {
        executionTime: totalTime
      }
    }
  } catch (error) {
    const totalTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(`Dispatch failed for ${action.id}: ${errorMessage}`)
    metricsReport.sensor.error(action.id, errorMessage, 'dispatch-execution')

    historyState.record(
      action.id,
      currentPayload,
      {ok: false, error: errorMessage},
      totalTime
    )

    return {
      ok: false,
      payload: null,
      message: `Dispatch failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}
