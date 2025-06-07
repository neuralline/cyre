// src/components/cyre-call.ts
// Call processor with proper talent pipeline integration

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {useDispatch} from './cyre-dispatch'
import {sensor} from '../context/metrics-report'
import {io} from '../context/state'
import payloadState from '../context/payload-state'
import {
  scheduleExecution,
  executeProcessingPipeline
} from '../schema/talent-definitions'

/*

      C.Y.R.E - C.A.L.L - P.R.O.C.E.S.S.O.R
      
      Call flow with proper talent pipeline integration:
      1. Execute processing talents pipeline (selector, condition, transform, etc.)
      2. Check for scheduling requirements (interval/delay/repeat)
      3. Update payload state for change detection
      4. Dispatch to final handler

*/

export async function processCall(
  action: IO,
  payload: ActionPayload | undefined
): Promise<CyreResponse> {
  const isTestAction = action.id.includes('diagnostic-test-action')

  if (isTestAction) {
    console.log('🔍 PROCESS_CALL START:', {
      actionId: action.id,
      hasPayload: payload !== undefined,
      hasFastPath: action._hasFastPath,
      hasProcessing: action._hasProcessing,
      hasScheduling: action._hasScheduling
    })
  }

  sensor.log(action.id, 'call', 'call-processing', {
    timestamp: Date.now(),
    hasPayload: payload !== undefined,
    hasFastPath: action._hasFastPath,
    hasProcessing: action._hasProcessing,
    hasScheduling: action._hasScheduling
  })

  const originalPayload = payload ?? action.payload
  let currentPayload = originalPayload

  // STEP 1: Fast path check - no processing needed
  if (action._hasFastPath) {
    if (isTestAction) {
      console.log('🔍 TAKING FAST PATH to useDispatch')
    }
    sensor.log(action.id, 'info', 'fast-path-execution')
    const result = await useDispatch(action, currentPayload)

    if (isTestAction) {
      console.log('🔍 FAST PATH RESULT:', {
        ok: result.ok,
        payload: result.payload,
        message: result.message,
        error: result.error
      })
    }

    return result
  }

  // STEP 2: Execute processing talents pipeline
  if (action._hasProcessing) {
    if (isTestAction) {
      console.log('🔍 EXECUTING PROCESSING PIPELINE')
    }

    sensor.log(action.id, 'info', 'processing-pipeline-start', {
      talents: action._processingTalents || []
    })

    const pipelineResult = executeProcessingPipeline(action, currentPayload)

    if (!pipelineResult.ok) {
      if (isTestAction) {
        console.log('🔍 PROCESSING PIPELINE BLOCKED:', pipelineResult.message)
      }

      sensor.log(action.id, 'skip', 'processing-pipeline-blocked', {
        reason: pipelineResult.message,
        blocked: true
      })

      return {
        ok: false,
        payload: pipelineResult.payload,
        message: pipelineResult.message || 'Processing pipeline failed'
      }
    }

    // Update payload with processed result
    currentPayload = pipelineResult.payload

    if (isTestAction) {
      console.log('🔍 PROCESSING PIPELINE COMPLETE:', {
        payloadTransformed: currentPayload !== originalPayload
      })
    }

    sensor.log(action.id, 'success', 'processing-pipeline-complete', {
      payloadTransformed: currentPayload !== originalPayload,
      finalPayloadType: typeof currentPayload
    })
  }

  // STEP 3: Check for scheduling requirements
  if (
    action._hasScheduling &&
    (action.interval || action.delay || action.repeat)
  ) {
    if (isTestAction) {
      console.log('🔍 EXECUTING SCHEDULING')
    }

    sensor.log(action.id, 'info', 'scheduling-execution', {
      interval: action.interval,
      delay: action.delay,
      repeat: action.repeat
    })

    return scheduleExecution(action, currentPayload)
  }

  // STEP 4: Update payload state for change detection history
  if (action.detectChanges) {
    payloadState.set(action.id, currentPayload, 'call')
    sensor.log(action.id, 'info', 'payload-state-updated', {
      payloadType: typeof currentPayload
    })
  }

  // STEP 5: Final execution with processed payload
  if (isTestAction) {
    console.log('🔍 DISPATCHING TO HANDLER:', {
      finalPayloadType: typeof currentPayload,
      payloadProcessed: currentPayload !== originalPayload
    })
  }

  sensor.log(action.id, 'info', 'dispatching-to-handler', {
    finalPayloadType: typeof currentPayload,
    payloadProcessed: currentPayload !== originalPayload
  })

  const result = await useDispatch(action, currentPayload)

  if (isTestAction) {
    console.log('🔍 FINAL DISPATCH RESULT:', {
      ok: result.ok,
      payload: result.payload,
      message: result.message,
      error: result.error
    })
  }

  sensor.log(action.id, 'info', 'call-processing-complete', {
    success: result.ok,
    executionTime: result.metadata?.executionTime
  })

  return result
}
