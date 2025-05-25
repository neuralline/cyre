// src/actions/change-detection.ts
// Change detection protection mechanism

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {io} from '../context/state'
import {metricsReport} from '../context/metrics-report'

/*

    C.Y.R.E - A.C.T.I.O.N.S - C.H.A.N.G.E

    Prevents execution if payload has not changed

*/

/**
 * Change detection protection - only execute if payload changed
 */
export const applyChangeDetectionProtection = async (
  action: IO,
  payload: ActionPayload,
  next: (transformedPayload?: ActionPayload) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (!action.detectChanges) {
    return next(payload)
  }

  if (!io.hasChanged(action.id, payload)) {
    metricsReport.trackChangeDetectionSkip(action.id)
    return {
      ok: true,
      payload: null,
      message: 'Execution skipped: No changes detected in payload'
    }
  }

  // Update payload history for future change detection
  const currentAction = io.get(action.id)
  if (currentAction) {
    io.set({
      ...currentAction,
      payload,
      timestamp: Date.now()
    })
  }

  return next(payload)
}

/**
 * Check if payload has changed without applying protection
 */
export const hasPayloadChanged = (
  action: IO,
  payload: ActionPayload
): boolean => {
  if (!action.detectChanges) return true
  return io.hasChanged(action.id, payload)
}

/**
 * Get previous payload for comparison
 */
export const getPreviousPayload = (
  actionId: string
): ActionPayload | undefined => {
  return io.getPrevious(actionId)
}

/**
 * Force update payload to trigger change detection on next call
 */
export const updatePayloadHistory = (
  actionId: string,
  payload: ActionPayload
): void => {
  // This is typically handled internally by io.set, but can be called explicitly if needed
  const action = io.get(actionId)
  if (action && action.detectChanges) {
    io.set({
      ...action,
      payload,
      timestamp: Date.now()
    })
  }
}
