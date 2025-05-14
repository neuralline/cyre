// src/components/cyre-actions.ts
import {io, subscribers} from '../context/state'
import {IO} from '../interfaces/interface'
import {CyreLog} from './cyre-logger'
import {pipe} from '../libs/utils'
import {MSG} from '../config/cyre-config'

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
      throw new Error('No subscriber found')
    }

    const result = subscriber.fn(action.payload)

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
    CyreLog.error(`${MSG.ACTION_EXECUTE_FAILED}: ${action}`)
    // Return error result and prevent further pipeline execution
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
      CyreLog.error(action)
    } else if (action.status === 'skipped') {
      CyreLog.info(action)
    } else {
      CyreLog.info(action)
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
const CyreAction = (initialIO: IO, fn: Function): ActionResult => {
  // Handle null/undefined input before pipe
  if (!initialIO) {
    CyreLog.error(MSG.ACTION_PREPARE_FAILED)
    return {
      id: '',
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
      checkPayloadChanges,
      executeAction,
      (action: ActionResult) =>
        action.status === 'error' ? action : logAction(action),
      (action: ActionResult) =>
        action.status === 'error' ? action : updateStore(action)
    )
    return result
  } catch (error) {
    CyreLog.error(`Action processing failed: ${error}`)
    return {
      ...initialIO,
      ok: false,
      done: false,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export default CyreAction
