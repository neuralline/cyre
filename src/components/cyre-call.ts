// src/components/cyre-call.ts
// Updated call processor with debounce talent integration before pipeline

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {useDispatch} from './cyre-dispatch'
import {sensor} from '../context/metrics-report'
import {TimeKeeper} from './cyre-timekeeper'
import {io} from '../context/state'
import payloadState from '../context/payload-state'
import {log} from './cyre-log'
import {debounce, scheduleExecution} from '../schema/talent-definitions'

/*

      C.Y.R.E - C.A.L.L - W.I.T.H - D.E.B.O.U.N.C.E
      
      Updated call flow with debounce talent integration:
      1. Execute debounce talent BEFORE pipeline
      2. If debounced, schedule callback to processCall after delay
      3. If allowed, continue with normal pipeline execution
      4. Debounce talent manages its own state and timing

*/

export async function processCall(
  action: IO,
  payload: ActionPayload | undefined
): Promise<CyreResponse> {
  sensor.log(action.id, 'call', 'call-initiation', {
    timestamp: Date.now(),
    hasPayload: payload !== undefined
  })

  const originalPayload = payload ?? action.payload
  let currentPayload = originalPayload

  // STEP 2: DEBOUNCE TALENT EXECUTION (Before Pipeline)

  // STEP 3: Continue with existing pipeline logic
  const compiledPipeline = action._protectionPipeline || []

  if (compiledPipeline.length === 0) {
    // No protections compiled - direct execution
    sensor.log(action.id, 'info', 'fast-path-execution')
    return useDispatch(action, currentPayload)
  }

  // Create context for pipeline execution
  const context = {
    action,
    payload: currentPayload,
    originalPayload,
    metrics: io.getMetrics(action.id),
    timestamp: Date.now()
  }

  // EXECUTE THE COMPILED PIPELINE FUNCTIONS (excluding debounce)
  for (let i = 0; i < compiledPipeline.length; i++) {
    const protectionFn = compiledPipeline[i]
    const protectionType = action._protectionTypes?.[i] || 'unknown'

    // Skip debounce protection since we handled it already
    if (protectionType === 'debounce') {
      continue
    }

    try {
      // Call the compiled protection function
      const result = await Promise.resolve(protectionFn(context))

      if (!result.pass) {
        // Handle blocking
        sensor.log(action.id, protectionType, 'pipeline-protection-block', {
          reason: result.reason,
          protectionIndex: i,
          protectionType
        })

        return {
          ok: false,
          payload: undefined,
          message: result.reason || 'Protection failed'
        }
      }

      // Update payload if protection transformed it
      if (result.payload !== undefined) {
        currentPayload = result.payload
        context.payload = currentPayload
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      sensor.error(action.id, errorMessage, `pipeline-protection-${i}`)

      return {
        ok: false,
        payload: undefined,
        message: `Pipeline protection error: ${errorMessage}`
      }
    }
  }

  // STEP 4: All protections passed - execute or schedule
  if (action._isScheduled) {
    return scheduleExecution(action, currentPayload)
  }

  // STEP 5: Update payload state for change detection
  if (action._hasChangeDetection) {
    payloadState.set(action.id, originalPayload, 'call')
  }

  // STEP 6: Final execution with transformed payload
  const result = await useDispatch(action, currentPayload)

  return result
}
