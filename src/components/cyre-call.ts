// src/components/cyre-call.ts - Fixed infinite repeats handling

import {useDispatch} from './cyre-dispatch'
import {TimeKeeper} from './cyre-timekeeper'
import {sensor} from '../context/metrics-report'
import type {IO, ActionPayload, CyreResponse} from '../types/core'
import {executePipeline} from '../schema/compile-pipeline'
import payloadState from '../context/payload-state'

/*

      C.Y.R.E - C.A.L.L - P.R.O.C.E.S.S.I.N.G
      
      Fixed infinite repeats handling:
      - Proper repeat: true logic for TimeKeeper
      - Fixed callback execution pattern
      - Better scheduling path integration

*/

/**
 * Main optimized process call function
 */
export async function processCall(
  action: IO,
  payload: ActionPayload | undefined
): Promise<CyreResponse> {
  try {
    let finalPayload = payload ?? payloadState.get(action.id)

    // EXECUTE TALENT PIPELINE (this was missing!)
    if (action._pipeline?.length) {
      const pipelineResult = executePipeline(action, finalPayload)

      if (!pipelineResult.ok) {
        return {
          ok: false,
          payload: pipelineResult.data,
          message: pipelineResult.error || 'Pipeline execution failed'
        }
      }

      // Update payload with pipeline result
      if (pipelineResult.data !== undefined) {
        finalPayload = pipelineResult.data
      }
    }

    // SCHEDULING LOGIC
    if (action._hasScheduling) {
      sensor.sys(action)
      const result = TimeKeeper.keep(
        action.interval || 0,
        async () => await useDispatch(action, finalPayload),
        action.repeat || 1,
        action.id,
        action.delay
      )

      if (result.ok === 'error') {
        return {
          ok: false,
          payload: undefined,
          message: `Scheduling failed: ${result.error.message}`
        }
      }

      return {
        ok: true,
        payload: undefined,
        message: 'Scheduled execution'
      }
    }

    // DIRECT DISPATCH
    return await useDispatch(action, finalPayload)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(action.id, errorMessage, 'process-call-exception')
    return {
      ok: false,
      payload: undefined,
      message: `Process call failed: ${errorMessage}`
    }
  }
}
