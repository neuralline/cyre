// src/components/cyre-execute.ts

import {io} from '../context/state'
import {IO, ActionPayload} from '../types/interface'
import {log} from './cyre-log'
import {metricsReport} from '../context/metrics-report'

/*

      C.Y.R.E - E.X.E.C.U.T.E
      
      Clean execution logic:
      - Execute handler function
      - Track execution metrics
      - Handle IntraLink detection
      - Pure execution focus with no pipeline logic

*/

interface ExecutionResult {
  ok: boolean
  payload?: any
  error?: string
  intraLink?: {
    id: string
    payload?: ActionPayload
  }
}

/**
 * Execute action handler - clean and focused
 */
export const cyreExecute = async (
  action: IO,
  handler: Function
): Promise<ExecutionResult> => {
  if (!action?.id || !handler) {
    return {
      ok: false,
      error: 'Invalid action or handler'
    }
  }

  const startTime = performance.now()

  try {
    // Execute the handler
    const result = await Promise.resolve(handler(action.payload))
    const executionTime = performance.now() - startTime

    // Update metrics
    const currentTime = Date.now()
    const currentMetrics = io.getMetrics(action.id)

    io.updateMetrics(action.id, {
      lastExecutionTime: currentTime,
      executionCount: (currentMetrics?.executionCount || 0) + 1
    })

    io.trackExecution(action.id, executionTime)

    log.debug(`Action ${action.id} executed in ${executionTime.toFixed(2)}ms`)

    // Check for IntraLink (chain reaction)
    if (result && typeof result === 'object' && 'id' in result && result.id) {
      log.debug(`Chain reaction detected: ${action.id} -> ${result.id}`)

      return {
        ok: true,
        payload: result,
        intraLink: {
          id: result.id,
          payload: result.payload
        }
      }
    }

    return {
      ok: true,
      payload: result
    }
  } catch (error) {
    const executionTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(`Execution failed for ${action.id}: ${errorMessage}`)

    // Track error in metrics
    const currentMetrics = io.getMetrics(action.id)
    if (currentMetrics) {
      const errorEntry = {
        timestamp: Date.now(),
        message: errorMessage
      }
      io.updateMetrics(action.id, {
        ...currentMetrics,
        errors: [...currentMetrics.errors, errorEntry]
      })
    }

    metricsReport.sensor.error(action.id, errorMessage, 'cyre-execution')

    return {
      ok: false,
      error: errorMessage
    }
  }
}

export default cyreExecute
