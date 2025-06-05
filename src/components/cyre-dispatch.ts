// src/components/cyre-dispatch.ts
// Dispatch with schema validation support and proper payload state management

import {subscribers, io} from '../context/state'
import {ActionPayload, CyreResponse, IO} from '../types/core'
import {cyreExecute} from './cyre-execute'
import {MSG} from '../config/cyre-config'
import {log} from './cyre-log'
import {sensor} from '../context/metrics-report'
import payloadState from '../context/payload-state'

/*

      C.Y.R.E - D.I.S.P.A.T.C.H 
      
      Dispatch with schema validation metadata support:
      - Preserve exact payload values including falsy ones
      - Include validation metadata in responses
      - Track schema validation performance
      - Update payload state after successful execution

*/

/**
 * Dispatch action to subscriber with schema validation metadata
 */
export const useDispatch = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()

  // Preserve falsy values like 0, undefined, false, ''
  const currentPayload = payload !== undefined ? payload : action.payload

  try {
    sensor.log(action.id, {
      timestamp: Date.now(),
      payloadType: typeof currentPayload,
      hasSchema: !!action.schema,
      hasSubscriber: undefined // will be determined below
    })

    // Get subscriber
    const subscriber = subscribers.get(action.id)
    if (!subscriber) {
      const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${action.id}`
      sensor.log(action.id, 'no subscriber', 'dispatch-validation', {
        subscriberFound: false,
        actionExists: !!io.get(action.id)
      })

      return {ok: false, payload: null, message: error}
    }

    sensor.log(action.id, 'dispatch', 'dispatch-to-execute')

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
    sensor.log(action.id, totalTime, {
      success: result.ok,
      executionPath: 'direct-dispatch',
      payloadPreserved: true,
      schemaValidated: !!action.schema
    })

    // Update payload history after successful execution for change detection
    if (result.ok) {
      // Store the payload that was actually used for execution
      payloadState.set(action.id, currentPayload, 'call')

      // Track execution in metrics
      io.trackExecution(action.id, totalTime)
    } else {
      sensor.log(action.id, 'error', 'execution-failure', {
        errorMessage: result.message,
        executionTime: totalTime
      })
    }

    return {
      ok: result.ok,
      payload: result.payload,
      message: result.ok ? result.message : result.error || 'Execution failed',
      metadata: {
        executionTime: totalTime,
        intraLink: result.intraLink, // Pass through IntraLink metadata
        validationPassed: !!action.schema, // Indicate if validation was performed
        schemaUsed: !!action.schema
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(`Dispatch failed for ${action.id}: ${errorMessage}`)
    sensor.error(action.id, errorMessage, 'dispatch-execution')

    return {
      ok: false,
      payload: null,
      message: `Dispatch failed: ${errorMessage}`,
      error: errorMessage,
      metadata: {
        executionTime: performance.now() - startTime,
        schemaUsed: !!action.schema
      }
    }
  }
}
