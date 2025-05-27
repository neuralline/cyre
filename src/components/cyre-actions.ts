// src/components/cyre-actions.ts

import {IO, ActionPayload, CyreResponse} from '../types/interface'
import {metricsReport} from '../context/metrics-report'
import {log} from './cyre-log'
import {
  useBlock,
  useDebounce,
  useDetectChange,
  useMiddleware,
  useRecuperation,
  useThrottle
} from '../actions'

/*

      C.Y.R.E. - A.C.T.I.O.N.S.
      
      Complete action processing pipeline with enhanced timing measurement
      Proper separation of Action Pipeline overhead vs Listener execution time
      FIXED: Chain reaction (intraLink) processing with proper history recording
      
*/

export type ActionStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'error'
  | 'skipped'

export interface ActionResult extends IO {
  ok: boolean
  done: boolean
  status?: ActionStatus
  error?: string
  skipped?: boolean
  skipReason?: string
  intraLink?: {
    id: string
    payload?: ActionPayload
  }
}

/**
 * Enhanced Protection function type with timing context
 */
export type ActionPipelineFunction = (
  action: IO,
  payload: ActionPayload,
  timer: any
) => CyreResponse

/**
 * Builds an action pipeline for each channel on channel creation
 */
export const buildActionPipeline = (action: IO): ActionPipelineFunction[] => {
  const pipeline: ActionPipelineFunction[] = []

  // System recuperation check (always included)
  pipeline.push(useRecuperation)

  // Repeat: 0 check (always included)
  pipeline.push(useBlock)

  // Add pipeline functions based on action configuration
  if (action.throttle) {
    pipeline.push(useThrottle)
  }

  if (action.debounce) {
    pipeline.push(useDebounce)
  }

  if (action.detectChanges) {
    pipeline.push(useDetectChange)
  }

  // Add middleware if configured
  if (action.middleware && action.middleware.length > 0) {
    pipeline.push(useMiddleware)
  }

  //then save this to the channel
  return pipeline
}

/**
 * apply/ follow actionPipeline before dispatch then of all pass call dispatch
 */
export const applyActionPipeline = async (
  action: IO,
  pipeline,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  let currentPayload = payload || action.payload

  //this is wrong it should loop through action pipeline and apply
  //  for each pipeline
  try {
    // Apply protections in sequence
    if (action.throttle) {
      const throttleResult = await useThrottle(
        action,
        currentPayload,
        async transformedPayload => {
          currentPayload = transformedPayload || currentPayload
          return {ok: true, payload: currentPayload, message: 'Throttle passed'}
        }
      )
      if (!throttleResult.ok) {
        metricsReport.sensor.throttle(action.id, 0, 'throttle-protection')
        return throttleResult
      }
    }

    if (action.debounce) {
      const debounceResult = await useDebounce(
        action,
        currentPayload,
        async transformedPayload => {
          currentPayload = transformedPayload || currentPayload
          return {ok: true, payload: currentPayload, message: 'Debounce passed'}
        }
      )
      if (!debounceResult.ok) {
        metricsReport.sensor.debounce(
          action.id,
          action.debounce,
          1,
          'debounce-protection'
        )
        return debounceResult
      }
    }

    if (action.detectChanges) {
      const changeResult = await useDetectChange(
        action,
        currentPayload,
        async transformedPayload => {
          currentPayload = transformedPayload || currentPayload
          return {
            ok: true,
            payload: currentPayload,
            message: 'Change detection passed'
          }
        }
      )
      if (!changeResult.ok) {
        metricsReport.sensor.log(action.id, 'skip', 'change-detection')
        return changeResult
      }
    }

    if (action.middleware && action.middleware.length > 0) {
      const middlewareResult = await useMiddleware(
        action,
        currentPayload,
        async transformedPayload => {
          currentPayload = transformedPayload || currentPayload
          return {
            ok: true,
            payload: currentPayload,
            message: 'Middleware passed'
          }
        }
      )
      if (!middlewareResult.ok) {
        metricsReport.sensor.middleware(
          action.id,
          'unknown',
          'reject',
          'middleware-protection'
        )
        return middlewareResult
      }
    }

    // All protections passed - dispatch to execution
    metricsReport.sensor.log(action.id, 'dispatch', 'call-to-dispatch')
    return {
      ok: true,
      payload: currentPayload,
      message: ''
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Pipeline application failed for ${action.id}: ${errorMessage}`)
    metricsReport.sensor.error(action.id, errorMessage, 'pipeline-application')

    return {
      ok: false,
      payload: null,
      message: `Pipeline failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}
