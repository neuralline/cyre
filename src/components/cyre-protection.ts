// src/components/cyre-protection.ts
import type {IO, ActionPayload, CyreResponse} from '../interfaces/interface'
import {io} from '../context/state'
import {log} from './cyre-logger'
import timeKeeper from './cyre-time-keeper'

/* 
      C.Y.R.E. - P.R.O.T.E.C.T.I.O.N.
      
      Core protection mechanisms for throttle, debounce, and change detection
*/

/**
 * Result from protection layer processing
 */
export interface ProtectionResult {
  /** Whether execution was prevented by protection */
  protected: boolean
  /** Response to return if protected */
  response?: CyreResponse
  /** Potentially modified payload */
  payload?: ActionPayload
  /** Potentially modified action */
  action?: IO
}

/**
 * Checks if throttling should block execution
 * Uses industry-standard first-call-passes approach
 */
export const throttleCheck = (
  action: IO
): {
  blocked: boolean
  response?: CyreResponse
} => {
  const now = Date.now()
  const lastExecution = io.getMetrics(action.id)?.lastExecutionTime || 0
  const timeSinceLastExecution = now - lastExecution

  // Industry standard: First execution always goes through (lastExecution === 0)
  if (lastExecution !== 0 && timeSinceLastExecution < action.throttle) {
    return {
      blocked: true,
      response: {
        ok: false,
        payload: null,
        message: `Throttled: ${
          action.throttle - timeSinceLastExecution
        }ms remaining`
      }
    }
  }

  return {blocked: false}
}

/**
 * Sets up a timer for debounced execution
 */
export const setDebounceTimer = (
  action: IO,
  payload: ActionPayload,
  executeCallback: (action: IO, payload: ActionPayload) => Promise<void>
): {ok: boolean; timerId?: string; message?: string} => {
  try {
    // Create unique timer ID
    const timerId = `${action.id}-debounce-${Date.now()}`

    // Set up timer
    const result = timeKeeper.keep(
      action.debounce!,
      async () => {
        try {
          log.debug(
            `[DEBOUNCE] Timer fired for ${action.id}, executing with bypassed protections`
          )

          // Execute with debounce bypassed
          await executeCallback(action, payload)
        } catch (error) {
          log.error(
            `[DEBOUNCE] Error in debounced execution: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        }
      },
      1, // Execute once
      timerId
    )

    if (result.kind === 'error') {
      return {
        ok: false,
        message: `Failed to set debounce timer: ${result.error.message}`
      }
    }

    return {ok: true, timerId}
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`[DEBOUNCE] Error setting timer: ${message}`)
    return {ok: false, message}
  }
}

/**
 * Handles debounce logic - critically, after the debounce period,
 * this bypasses the normal protection layers and executes directly
 */
export const debounceAction = (
  action: IO,
  payload: ActionPayload,
  executeDirectly: (action: IO, payload: ActionPayload) => Promise<CyreResponse>
): CyreResponse => {
  // Cancel any existing debounce timer
  if (action.debounceTimerId) {
    timeKeeper.forget(action.debounceTimerId)
    action.debounceTimerId = undefined
  }

  // Store this payload to use when the timer executes
  const debouncedPayload = payload

  // Set up debounce timer that bypasses debounce check on execution
  const timerResult = setDebounceTimer(
    action,
    debouncedPayload,
    async (action, payload) => {
      // Create a copy of the action without debounce to prevent recursion
      const debounceBypassAction = {
        ...action,
        _bypassDebounce: true // Mark as debounce-bypassed
      }

      // Execute directly, bypassing debounce but allowing other protections
      await executeDirectly(debounceBypassAction, payload)
    }
  )

  // Update action with timer ID for tracking
  if (timerResult.ok && timerResult.timerId) {
    const updatedAction = {
      ...action,
      debounceTimerId: timerResult.timerId
    }
    io.set(updatedAction)

    log.debug(
      `[DEBOUNCE] Set up debounce timer ${timerResult.timerId} for ${action.id}`
    )
  } else {
    log.error(`[DEBOUNCE] Failed to set up timer: ${timerResult.message}`)
  }

  return {
    ok: true,
    payload: null,
    message: `Debounced: will execute after ${action.debounce}ms`
  }
}

/**
 * Applies all protection layers (throttle, debounce, change detection)
 * Returns whether execution was prevented and a response if so
 */
export const applyProtectionLayers = async (
  action: IO,
  payload: ActionPayload | undefined,
  executeDirectly: (
    action: IO,
    payload: ActionPayload
  ) => Promise<CyreResponse>,
  isRecuperating: boolean
): Promise<ProtectionResult> => {
  const finalPayload = payload ?? action.payload

  // If this is a debounce bypass execution, skip debounce check
  const skipDebounce = action._bypassDebounce === true

  // 1. Check system state (recuperation mode)
  if (isRecuperating && action.priority?.level !== 'critical') {
    return {
      protected: true,
      response: {
        ok: false,
        payload: null,
        message: `System recuperating. Only critical actions allowed.`
      }
    }
  }

  // 2. Check repeat: 0 case (no execution)
  if (action.repeat === 0) {
    return {
      protected: true,
      response: {
        ok: true,
        payload: null,
        message: 'Action registered but not executed (repeat: 0)'
      }
    }
  }

  // 3. Throttle (industry standard - first call passes)
  if (action.throttle) {
    const throttleResult = throttleCheck(action)
    if (throttleResult.blocked) {
      return {
        protected: true,
        response: throttleResult.response
      }
    }
  }

  // 4. Debounce (only handles debouncing, nothing else)
  if (action.debounce && !skipDebounce) {
    return {
      protected: true,
      response: debounceAction(action, finalPayload, executeDirectly)
    }
  }

  // 5. Change Detection
  if (action.detectChanges && !io.hasChanged(action.id, finalPayload)) {
    return {
      protected: true,
      response: {
        ok: true,
        payload: null,
        message: 'Execution skipped: No changes detected in payload'
      }
    }
  }

  // No protection blocked execution
  return {
    protected: false,
    payload: finalPayload
  }
}
