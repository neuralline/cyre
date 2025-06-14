// src/components/cyre-call.ts - Fixed infinite repeats handling

import {useDispatch} from './cyre-dispatch'
import {TimeKeeper} from './cyre-timekeeper'
import {sensor} from '../context/metrics-report'
import type {IO, ActionPayload, CyreResponse} from '../types/core'
import {executePipeline} from '../schema/channel-operators'
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

    // INLINE PROCESSING PIPELINE
    if (action._processingTalents?.length) {
      // Use optimized pipeline execution
      const talentResult = executePipeline(action, finalPayload)
      if (!talentResult.ok) {
        return {
          ok: false,
          payload: talentResult.payload,
          message: talentResult.message || 'Pipeline blocked execution'
        }
      }
      if (talentResult.payload !== undefined) {
        finalPayload = talentResult.payload
      }
    }

    // INLINE SCHEDULING LOGIC
    if (action._hasScheduling) {
      const result = TimeKeeper.keep(
        action.interval || 0,
        async () => await useDispatch(action, finalPayload),
        action.repeat || 1,
        action.id,
        action.delay
      )

      if (result.kind === 'error') {
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

    // DIRECT DISPATCH (fastest path)
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
