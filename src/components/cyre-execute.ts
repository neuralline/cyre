// src/components/cyre-execute.ts

import {io} from '../context/state'
import {IO, ActionPayload} from '../types/interface'
import {log} from './cyre-log'
import {metricsReport} from '../context/metrics-report'
import {MSG} from '../config/cyre-config'

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
  error?: boolean
  message?: string
  metadata?: any
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

    metricsReport.sensor.execution(action.id, executionTime)

    // Check for IntraLink (chain reaction)
    let intraLink: {id: string; payload?: ActionPayload} | undefined
    if (result && typeof result === 'object' && 'id' in result && result.id) {
      intraLink = {
        id: result.id,
        payload: result.payload
      }

      metricsReport.sensor.intralink(action.id, result.id, 'dispatch')
    }

    return {
      ok: true,
      payload: result,
      message: MSG.WELCOME,
      metadata: {
        executionTime,
        intraLink
      },
      intraLink
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    metricsReport.sensor.error(action.id, errorMessage)
    log.error(`Execution error: ${errorMessage}`)
    return {
      ok: false,
      payload: null,
      message: `Execution error: ${errorMessage}`,
      error: true
    }
  }
}

export default cyreExecute
