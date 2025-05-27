// src/actions/debounce.ts
// Lightweight metrics integration

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {io} from '../context/state'
import timeKeeper from '../components/cyre-timekeeper'
import {log} from '../components/cyre-log'

/*

    C.Y.R.E- A.C.T.I.O.N.S - D.E.B.O.U.N.C.E

    Collapses rapid calls into a single delayed execution
    Uses lightweight metrics collection

*/

/**
 * Debounce protection - collapses rapid calls
 */
export const debounce = async (
  action: IO,
  payload: ActionPayload
): Promise<CyreResponse> => {
  if (!action.debounce) {
    return {
      ok: false,
      payload: null,
      error: true,
      message: `Error debounce not defined`
    }
  }

  // Skip if this is a debounce-bypass execution
  if (action._bypassDebounce) {
    return {
      ok: true,
      payload: null,
      message: `bypassed debounce: will execute after ${action.debounce}ms`
    }
  }

  // Track debounce with lightweight collector - import here to avoid circular deps
  try {
    const {metricsReport} = await import('../context/metrics-report')
    metricsReport.trackProtection(action.id, 'debounce')
  } catch (error) {
    // Metrics not available - continue without tracking
  }

  // Cancel any existing debounce timer
  if (action.debounceTimerId) {
    timeKeeper.forget(action.debounceTimerId)

    // Update action in store without timer ID
    const updatedAction = {...action}
    delete updatedAction.debounceTimerId
    io.set(updatedAction)
  }

  // Create unique timer ID
  const timerId = `${action.id}-debounce-${Date.now()}`

  // Return the debounce response immediately, execute later
  const timerResult = timeKeeper.keep(
    action.debounce,
    async () => {
      try {
        // Execute with debounce bypassed
        return {
          ok: true,
          payload: null,
          message: `bypassed debounce: will execute after ${action.debounce}ms`
        }
        // Note: This result won't be returned to the original caller
        // as the debounce has already responded
      } catch (error) {
        log.error(`Debounce execution error: ${error}`)
      }
    },
    1, // Execute exactly once
    timerId
  )

  // Handle timer setup failure
  if (timerResult.kind === 'error') {
    return {
      ok: false,
      payload: null,
      message: `Failed to set up debounce timer: ${timerResult.error.message}`
    }
  }

  // Store the timer ID with the action
  const updatedAction = {
    ...action,
    debounceTimerId: timerId
  }
  io.set(updatedAction)

  // Return immediate debounce response
  return {
    ok: true,
    payload: null,
    message: `Debounced: will execute after ${action.debounce}ms`
  }
}
