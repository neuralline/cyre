// src/actions/debounce.ts
// Debounce protection mechanism

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {io} from '../context/state'
import {metricsReport} from '../context/metrics-report'
import timeKeeper from '../components/cyre-timekeeper'
import {log} from '../components/cyre-log'

/*

    C.Y.R.E- A.C.T.I.O.N.S - D.E.B.O.U.N.C.E

    Collapses rapid calls into a single delayed execution

*/

/**
 * Debounce protection - collapses rapid calls
 */
export const applyDebounceProtection = async (
  action: IO,
  payload: ActionPayload,
  next: (transformedPayload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (!action.debounce) {
    return next(payload)
  }

  // Skip if this is a debounce-bypass execution
  if (action._bypassDebounce) {
    return next(payload)
  }

  // IMPORTANT: Track debounce before setting up timer
  metricsReport.trackDebounce(action.id)

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

  // CRITICAL FIX: Return the debounce response immediately, execute later
  const timerResult = timeKeeper.keep(
    action.debounce,
    async () => {
      try {
        // Execute with debounce bypassed
        const result = await next(payload)
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

/**
 * Check if action has pending debounce timer
 */
export const hasPendingDebounce = (action: IO): boolean => {
  return Boolean(action.debounceTimerId)
}

/**
 * Cancel existing debounce timer for an action
 */
export const cancelDebounceTimer = (action: IO): void => {
  if (action.debounceTimerId) {
    timeKeeper.forget(action.debounceTimerId)

    // Update action in store without timer ID
    const updatedAction = {...action}
    delete updatedAction.debounceTimerId
    io.set(updatedAction)
  }
}
