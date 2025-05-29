// src/components/cyre-dispatch.ts
// CRITICAL FIX: Stop converting falsy values to null

import {subscribers, io} from '../context/state'
import {ActionPayload, CyreResponse, IO} from '../types/core'
import {cyreExecute} from './cyre-execute'
import {MSG} from '../config/cyre-config'
import {log} from './cyre-log'
import {metricsReport} from '../context/metrics-report'

/*

      C.Y.R.E - D.I.S.P.A.T.C.H 
      
      CRITICAL FIX: Stop converting falsy values (0, undefined, false, '') to null
      
      The bug was in payload processing:
      OLD: const currentPayload = payload || action.payload  // ❌ Converts falsy to action.payload
      NEW: const currentPayload = payload !== undefined ? payload : action.payload  // ✅ Preserves falsy

*/

/**
 * FIXED: Dispatch action to subscriber preserving exact payload values
 */
export const useDispatch = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()

  // CRITICAL FIX: Preserve falsy values like 0, undefined, false, ''
  // Use strict undefined check instead of truthy check
  const currentPayload = payload !== undefined ? payload : action.payload

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

    // Execute through cyreExecute with EXACT payload value
    const result = await cyreExecute(
      {
        ...action,
        payload: currentPayload, // Pass exact value, including falsy values
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
        // CRITICAL FIX: Store exact payload value for change detection
        io.updatePayload(action.id, currentPayload)
      }

      // Track execution in metrics
      io.trackExecution(action.id, totalTime)
    }

    // Handle IntraLink (chain reactions)
    if (result.intraLink) {
      log.debug(`IntraLink detected: ${action.id} -> ${result.intraLink.id}`)

      // Record the chain reaction
      metricsReport.sensor.intralink(action.id, result.intraLink.id, 'dispatch')

      // Return success with IntraLink info for processing by caller
      return {
        ok: true,
        payload: result.payload,
        message: result.message,
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
      message: result.ok ? result.message : result.error || 'Execution failed',
      metadata: {
        executionTime: totalTime
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(`Dispatch failed for ${action.id}: ${errorMessage}`)
    metricsReport.sensor.error(action.id, errorMessage, 'dispatch-execution')

    return {
      ok: false,
      payload: null,
      message: `Dispatch failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}
