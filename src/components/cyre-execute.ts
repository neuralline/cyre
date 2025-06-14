// src/components/cyre-execute.ts

import {io} from '../context/state'
import {IO, ActionPayload} from '../types/core'
import {log} from './cyre-log'
import {sensor} from '../context/metrics-report'
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
    const _executionTime = performance.now() - startTime
    const _lastExecTime = Date.now()
    const _executionCount = (action.executionCount || 0) + 1

    const updatedAction = {
      ...action,
      _lastExecTime, // Track when this execution completed
      timestamp: Date.now(),
      _executionCount // Also update general timestamp
    }

    io.set({
      ...updatedAction
    })
    // Check for IntraLink (chain reaction)
    let intraLink: {id: string; payload?: ActionPayload} | undefined
    if (result && typeof result === 'object' && 'id' in result && result.id) {
      intraLink = {
        id: result.id,
        payload: result.payload
      }
    }

    return {
      ok: true,
      payload: result,
      message: MSG.WELCOME,
      metadata: {
        executionTime: _executionTime,
        intraLink
      },
      intraLink
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const _lastExecTime = Date.now()
    sensor.error(action.id, errorMessage, 'cyre-execute')
    //log.error(`Execution error: ${errorMessage}`)
    io.set({
      ...action,
      _lastExecTime,
      timestamp: Date.now(),
      errors: [{timestamp: Date.now(), message: errorMessage}]
    })

    return {
      ok: false,
      payload: null,
      message: `Execution error: ${errorMessage}`,
      error: true
    }
  }
}

export default cyreExecute
