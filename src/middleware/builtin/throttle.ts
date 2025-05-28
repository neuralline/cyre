// src/middleware/builtin/throttle.ts
// Fixed throttle middleware with proper IO state integration

import type {BuiltinMiddlewareFunction} from '../../types/middleware'
import {io} from '../../context/state'
import {log} from '../../components/cyre-log'
import {metricsReport} from '../../context/metrics-report'

/*

      C.Y.R.E. - T.H.R.O.T.T.L.E - M.I.D.D.L.E.W.A.R.E
      
      Fixed throttle middleware with proper IO state integration:
      - Store throttle state in IO for persistence
      - Industry standard: first call executes immediately
      - Subsequent calls within throttle window are blocked
      - Proper state management and cleanup

*/

export const throttleMiddleware: BuiltinMiddlewareFunction = async (
  context,
  next
) => {
  const {action, payload} = context
  const throttleTime = action.throttle

  if (!throttleTime || throttleTime <= 0) {
    return next(payload)
  }

  try {
    // Get current action state
    const currentAction = io.get(action.id)
    if (!currentAction) {
      log.error(`Action ${action.id} not found in IO state for throttle`)
      return next(payload)
    }

    const now = Date.now()
    const lastExecution = currentAction.lastThrottleExecution || 0
    const timeSinceLastExecution = now - lastExecution

    // Check if we're within throttle window
    if (timeSinceLastExecution < throttleTime) {
      const remainingTime = throttleTime - timeSinceLastExecution

      log.debug(`Action ${action.id} throttled: ${remainingTime}ms remaining`)

      metricsReport.sensor.log(action.id, 'throttle', 'throttle-middleware', {
        action: 'blocked',
        remainingTime,
        timeSinceLastExecution,
        throttleTime
      })

      return {
        type: 'block',
        reason: `Throttled: ${remainingTime}ms remaining`,
        metadata: {
          throttled: true,
          remainingTime,
          throttleTime,
          lastExecution
        }
      }
    }

    // Update throttle execution timestamp in IO state
    const updatedAction = {
      ...currentAction,
      lastThrottleExecution: now
    }
    io.set(updatedAction)

    log.debug(`Action ${action.id} passed throttle check`)

    metricsReport.sensor.log(action.id, 'execution', 'throttle-middleware', {
      action: 'passed',
      timeSinceLastExecution,
      throttleTime
    })

    // Continue to next middleware
    return next(payload)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Throttle middleware error for ${action.id}: ${errorMessage}`)

    metricsReport.sensor.error(action.id, errorMessage, 'throttle-middleware')

    // Fall back to continue on error
    return next(payload)
  }
}
