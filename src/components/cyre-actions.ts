// src/components/cyre-actions.ts
import {io, subscribers} from '../context/state'
import {IO} from '../interfaces/interface'
import {log} from './cyre-logger'
import {pipe} from '../libs/utils'
import {MSG} from '../config/cyre-config'
import {metricsReport} from '../context/metrics-report'

/*

      C.Y.R.E. - A.C.T.I.O.N.S
      
      
*/

// Enhanced type definitions
type ActionStatus = 'pending' | 'active' | 'completed' | 'error' | 'skipped'

interface ActionResult extends IO {
  ok: boolean
  done: boolean
  status?: ActionStatus
  error?: string
  skipped?: boolean
  skipReason?: string
}

// Action pipeline functions with improved error handling
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

// Note: We keep this but it's typically handled earlier in the pipeline now
const checkPayloadChanges = (action: ActionResult): ActionResult => {
  if (!action.detectChanges) {
    return action
  }

  const hasChanged = io.hasChanged(action.id, action.payload)
  if (!hasChanged) {
    return {
      ...action,
      ok: true,
      done: true,
      status: 'skipped',
      skipped: true,
      skipReason: MSG.ACTION_SKIPPED
    }
  }

  return action
}

const executeAction = (action: ActionResult): ActionResult => {
  if (action.skipped || action.status === 'error') {
    return action
  }

  try {
    const subscriber = subscribers.get(action.id)
    if (!subscriber) {
      throw new Error(`No subscriber found for: ${action.id}`)
    }

    // Track execution start time
    const startTime = performance.now()

    const result = subscriber.fn(action.payload)
    const endTime = performance.now()
    const executionTime = endTime - startTime

    // Update metrics with execution time
    io.updateMetrics(action.id, {
      lastExecutionTime: Date.now(),
      executionCount: (io.getMetrics(action.id)?.executionCount || 0) + 1
    })
    if (
      typeof metricsReport !== 'undefined' &&
      typeof metricsReport.trackListenerExecution === 'function'
    ) {
      metricsReport.trackListenerExecution(action.id, executionTime)
    }

    // Handle linked actions
    if (result && typeof result === 'object' && 'id' in result) {
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
 * CyreAction function - handles single action execution
 * Repeat/interval handling is managed by the call method
 */
export const CyreAction = (initialIO: IO, fn: Function): ActionResult => {
  // Handle null/undefined input before pipe
  if (!initialIO) {
    log.error(MSG.ACTION_PREPARE_FAILED)
    return {
      id: 'CYRE-ERROR',
      type: '',
      ok: false,
      done: false,
      status: 'error',
      error: MSG.ACTION_PREPARE_FAILED
    }
  }

  try {
    const result = pipe(
      prepareAction(initialIO),
      validateAction,
      executeAction,
      (action: ActionResult) =>
        action.status === 'error' ? action : logAction(action),
      (action: ActionResult) =>
        action.status === 'error' ? action : updateStore(action)
    )
    return result
  } catch (error) {
    log.error(`Action processing failed: ${error}`)
    return {
      ...initialIO,
      id: 'CYRE-ERROR',
      ok: false,
      done: false,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export default CyreAction
