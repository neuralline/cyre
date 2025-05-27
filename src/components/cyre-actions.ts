// src/components/cyre-actions.ts
// Clean pipeline application system

import {IO, ActionPayload, CyreResponse} from '../types/interface'
import {pipelineState} from '../context/pipeline-state'
import {processMiddleware, processDebounce} from '../actions'
import {metricsReport} from '../context/metrics-report'
import {log} from './cyre-log'

/*

      C.Y.R.E. - A.C.T.I.O.N.S.
      
      Clean pipeline application system:
      - Loop through saved pipeline functions
      - Handle async operations (middleware, debounce)
      - Fast path for actions without pipeline
      - Proper error handling and metrics

*/

/**
 * Apply action pipeline by looping through saved pipeline functions
 */
export const applyActionPipeline = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()
  let currentPayload = payload || action.payload
  const pipeline = pipelineState.get(action.id) || []
  try {
    // Check for fast path
    if (!pipeline.length) {
      // Zero overhead path - no pipeline to apply
      metricsReport.sensor.log(action.id, 'info', 'fast-path')
      return {
        ok: true,
        payload: currentPayload,
        message: 'Fast path - no pipeline'
      }
    }

    // Get saved pipeline for this action

    if (!pipeline || pipeline.length === 0) {
      // No pipeline saved, treat as fast path
      metricsReport.sensor.log(action.id, 'info', 'no-pipeline')
      return {
        ok: true,
        payload: currentPayload,
        message: 'No pipeline configured'
      }
    }

    // Apply pipeline functions in sequence
    for (let i = 0; i < pipeline.length; i++) {
      const pipelineFunction = pipeline[i]

      try {
        const result = pipelineFunction(action, currentPayload, null)

        if (!result.ok) {
          // Pipeline function blocked execution
          const overhead = performance.now() - startTime

          metricsReport.sensor.log(action.id, 'blocked', 'pipeline-blocked', {
            blockingFunction: i,
            reason: result.message,
            overhead
          })

          // Handle special cases that require async processing
          if (result.metadata?.debounce) {
            // Process debounce delay
            return await processDebounce(
              action,
              currentPayload,
              result.metadata.debounce
            )
          }

          // Return the blocking result immediately - don't continue pipeline
          return result
        }

        // Pipeline function passed, continue with potentially modified payload
        if (result.payload !== undefined) {
          currentPayload = result.payload
        }

        // Handle async operations
        if (result.metadata?.middleware?.requiresAsync) {
          const middlewareResult = await processMiddleware(
            action,
            currentPayload
          )
          if (!middlewareResult.ok) {
            const overhead = performance.now() - startTime
            metricsReport.sensor.middleware(
              action.id,
              'unknown',
              'reject',
              'pipeline-middleware'
            )
            return middlewareResult
          }
          currentPayload = middlewareResult.payload
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const overhead = performance.now() - startTime

        log.error(
          `Pipeline function ${i} failed for ${action.id}: ${errorMessage}`
        )
        metricsReport.sensor.error(action.id, errorMessage, 'pipeline-function')

        return {
          ok: false,
          payload: null,
          message: `Pipeline function failed: ${errorMessage}`,
          error: errorMessage
        }
      }
    }

    // All pipeline functions passed
    const totalOverhead = performance.now() - startTime

    metricsReport.sensor.log(action.id, 'info', 'pipeline-passed', {
      stepsProcessed: pipeline.length,
      overhead: totalOverhead
    })

    return {
      ok: true,
      payload: currentPayload,
      message: 'Pipeline applied successfully'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const totalOverhead = performance.now() - startTime

    log.error(`Pipeline application failed for ${action.id}: ${errorMessage}`)
    metricsReport.sensor.error(action.id, errorMessage, 'pipeline-application')

    return {
      ok: false,
      payload: null,
      message: `Pipeline application failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}
