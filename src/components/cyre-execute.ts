// src/components/cyre-execute.ts

import {io, subscribers} from '../context/state'
import {IO, ActionPayload, CyreResponse} from '../types/interface'
import {log} from './cyre-log'
import {pipe} from '../libs/utils'
import {MSG} from '../config/cyre-config'
import {metricsReport} from '../context/metrics-report'
import {historyState} from '../context/history-state'
import {ActionResult} from './cyre-actions'

/*

      C.Y.R.E - E.X.E.C.U.T.E
      
      
      
*/

// Action pipeline functions with improved error handling and timing
const prepareAction = (action: IO): ActionResult => {
  try {
    if (!action) {
      throw new Error(MSG.ACTION_PREPARE_FAILED)
    }

    return {
      ...action,
      ok: true,
      done: false,
      status: 'pending',
      timestamp: Date.now()
    }
  } catch (error) {
    return {
      id: '',
      type: '',
      ok: false,
      done: false,
      status: 'error',
      error: MSG.ACTION_PREPARE_FAILED
    }
  }
}

const validateAction = (action: ActionResult): ActionResult => {
  if (!action.type || !action.id) {
    return {
      ...action,
      ok: false,
      done: false,
      status: 'error',
      error: 'Missing required fields: type or id'
    }
  }

  return {
    ...action,
    ok: true,
    status: 'active'
  }
}

const CyreExecute = (action: ActionResult, timer: any): ActionResult => {
  if (action.skipped || action.status === 'error') {
    return action
  }

  try {
    const subscriber = subscribers.get(action.id)
    if (!subscriber) {
      throw new Error(`No subscriber found for: ${action.id}`)
    }

    const listenerStartTime = performance.now()
    //execute action
    const result = subscriber.fn(action.payload)
    //action executed

    // Calculate listener execution time
    const listenerExecutionTime = performance.now() - listenerStartTime

    //Update both metrics systems
    const currentTime = Date.now()
    const currentMetrics = io.getMetrics(action.id)

    // Update metrics
    io.updateMetrics(action.id, {
      lastExecutionTime: currentTime,
      executionCount: (currentMetrics?.executionCount || 0) + 1
    })

    // Track execution with actual timing
    io.trackExecution(action.id, listenerExecutionTime)

    log.debug(
      `Action ${action.id} executed in ${listenerExecutionTime.toFixed(2)}ms`
    )

    // Handle linked actions (chain reactions/intraLinks)
    if (result && typeof result === 'object' && 'id' in result && result.id) {
      log.debug(`Chain reaction detected: ${action.id} -> ${result.id}`)

      return {
        ...action,
        ok: true,
        done: true,
        status: 'completed',
        intraLink: {
          id: result.id,
          payload: result.payload
        }
      }
    }

    return {
      ...action,
      ok: true,
      done: true,
      status: 'completed'
    }
  } catch (error) {
    log.error(
      `CYRE ACTION ERROR: ${MSG.ACTION_EXECUTE_FAILED} -id ${action.id} ${
        error instanceof Error ? error.message : String(error)
      }`
    )

    // Track error in metrics
    const currentMetrics = io.getMetrics(action.id)
    if (currentMetrics) {
      const errorEntry = {
        timestamp: Date.now(),
        message: error instanceof Error ? error.message : String(error)
      }
      io.updateMetrics(action.id, {
        ...currentMetrics,
        errors: [...currentMetrics.errors, errorEntry]
      })
    }

    return {
      ...action,
      ok: false,
      done: false,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const logAction = (action: ActionResult): ActionResult => {
  if (action.log) {
    if (action.status === 'error') {
      log.error(action)
    } else if (action.status === 'skipped') {
      log.info(action)
    } else {
      log.info(action)
    }
  }
  return action
}

const updateStore = (action: ActionResult): ActionResult => {
  if (action.ok && !action.skipped) {
    io.set({
      ...action,
      timestamp: Date.now()
    })
  }
  return action
}

/**
 * Process intraLinks (chain reactions) with proper history recording
 */
const processIntraLinks = (action: ActionResult): ActionResult => {
  if (!action.intraLink || !action.intraLink.id) {
    return action
  }

  try {
    log.debug(
      `Processing chain reaction: ${action.id} -> ${action.intraLink.id}`
    )

    // Get the linked action configuration
    const linkedAction = io.get(action.intraLink.id)
    if (!linkedAction) {
      log.warn(
        `Chain reaction failed: action '${action.intraLink.id}' not found`
      )
      return action
    }

    // Check if we have a subscriber for the linked action
    const subscriber = subscribers.get(action.intraLink.id)
    if (!subscriber) {
      log.warn(
        `Chain reaction failed: no subscriber for '${action.intraLink.id}'`
      )
      return action
    }

    // FIXED: Execute the linked action with proper timing and history recording
    try {
      const chainPayload = action.intraLink.payload || linkedAction.payload

      // Create timer for chain execution

      const listenerStartTime = performance.now()

      // Execute the chain handler
      const chainResult = subscriber.fn(chainPayload)

      // Calculate timing
      const listenerExecutionTime = performance.now() - listenerStartTime

      // Mark metrics stage

      log.debug(
        `Chain reaction executed: ${action.id} -> ${action.intraLink.id}`
      )

      // FIXED: Update metrics for the chained action
      const currentTime = Date.now()
      const chainMetrics = io.getMetrics(action.intraLink.id)

      io.updateMetrics(action.intraLink.id, {
        lastExecutionTime: currentTime,
        executionCount: (chainMetrics?.executionCount || 0) + 1
      })

      // FIXED: Record history for the chained action
      historyState.record(action.intraLink.id, chainPayload, {
        ok: true,
        message: `Chain execution from ${action.id}`,
        error: undefined
      })

      // If the chained action also returns an intraLink, process it recursively
      if (
        chainResult &&
        typeof chainResult === 'object' &&
        'id' in chainResult &&
        chainResult.id
      ) {
        const nestedChainAction: ActionResult = {
          ...linkedAction,
          ok: true,
          done: true,
          status: 'completed',
          intraLink: {
            id: chainResult.id,
            payload: chainResult.payload
          }
        }

        // Recursively process nested chains
        processIntraLinks(nestedChainAction)
      }
    } catch (error) {
      log.error(`Chain reaction execution failed: ${error}`)

      // FIXED: Record history for failed chain execution
      historyState.record(
        action.intraLink.id,
        action.intraLink.payload || linkedAction.payload,
        {
          ok: false,
          message: `Chain execution failed from ${action.id}`,
          error: error instanceof Error ? error.message : String(error)
        }
      )
    }

    return {
      ...action,
      intraLink: undefined // Clear the processed intraLink
    }
  } catch (error) {
    log.error(`Chain reaction failed: ${error}`)
    return action
  }
}

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
 * Execute action handler (renamed from CyreAction)
 * Simplified and focused on execution only
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
