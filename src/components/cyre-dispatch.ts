// src/components/cyre-dispatch.ts
// Dispatch with consolidated execution logic - no separate cyre-execute needed

import {subscribers, io} from '../context/state'
import {ActionPayload, CyreResponse, IO} from '../types/core'
import {MSG} from '../config/cyre-config'
import {log} from './cyre-log'
import {sensor} from '../context/metrics-report'
import payloadState from '../context/payload-state'

/*

      C.Y.R.E - D.I.S.P.A.T.C.H 
      
      Consolidated dispatch with inline execution:
      1. Find subscriber
      2. Execute subscriber (inline)
      3. Report errors (unified)
      4. Handle intraLink (direct)
      5. Update io.set() (streamlined)

*/

/**
 * Dispatch action to subscriber with consolidated execution logic
 */
export const useDispatch = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()
  const isTestAction = action.id.includes('diagnostic-test-action')

  // Preserve falsy values like 0, undefined, false, ''
  const currentPayload = payload !== undefined ? payload : action.payload

  try {
    // 1. FIND SUBSCRIBER
    const subscriber = subscribers.get(action.id)

    if (!subscriber) {
      const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${action.id}`

      sensor.error(error, action.id)

      return {ok: false, payload: null, message: error}
    }

    // 2. EXECUTE SUBSCRIBER (inline execution logic from cyreExecute)
    let executionResult: any
    let intraLink: {id: string; payload?: ActionPayload} | undefined

    try {
      // Execute the handler function
      executionResult = await Promise.resolve(
        subscriber.handler(currentPayload)
      )

      // Check for IntraLink (chain reaction)
      if (
        executionResult &&
        typeof executionResult === 'object' &&
        'id' in executionResult &&
        executionResult.id
      ) {
        intraLink = {
          id: executionResult.id,
          payload: executionResult.payload
        }
      }

      const executionTime = performance.now() - startTime
      const lastExecTime = Date.now()
      const executionCount = (action.executionCount || 0) + 1

      // 5. UPDATE IO.SET() (streamlined)
      io.set({
        ...action,
        _executionTime: executionTime,
        _lastExecTime: lastExecTime,
        _executionCount: executionCount
      })

      const totalTime = performance.now() - startTime

      // Update payload history after successful execution for change detection

      payloadState.set(action.id, action.payload, 'call')

      const finalResult: CyreResponse = {
        ok: true,
        payload: executionResult,
        message: MSG.WELCOME,
        metadata: {
          executionTime: totalTime,
          intraLink, // Pass through IntraLink metadata
          validationPassed: !!action.schema // Indicate if validation was performed
        }
      }

      return finalResult
    } catch (executionError) {
      // 3. REPORT ERRORS (unified error handling)
      const errorMessage =
        executionError instanceof Error
          ? executionError.message
          : String(executionError)
      const lastExecTime = Date.now()
      const totalTime = performance.now() - startTime

      // Update action with error info
      io.set({
        ...action,
        _lastExecTime: lastExecTime,
        errors: [{timestamp: Date.now(), message: errorMessage}]
      })

      sensor.error(action.id, errorMessage, 'consolidated-dispatch')

      log.critical(io.get(action.id))

      return {
        ok: false,
        payload: null,
        message: `Execution error: ${errorMessage}`,
        error: true,
        metadata: {
          executionTime: totalTime,
          validationPassed: !!action.schema
        }
      }
    }
  } catch (dispatchError) {
    const errorMessage =
      dispatchError instanceof Error
        ? dispatchError.message
        : String(dispatchError)
    const totalTime = performance.now() - startTime

    sensor.error(action.id, errorMessage, 'dispatch-exception')
    log.error(`Dispatch failed: ${errorMessage}`)

    return {
      ok: false,
      payload: null,
      message: `Dispatch failed: ${errorMessage}`,
      error: true,
      metadata: {
        executionTime: totalTime,
        validationPassed: !!action.schema
      }
    }
  }
}
