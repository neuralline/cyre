// src/middleware/builtin/debounce.ts
// Fixed debounce middleware with proper IO state integration

import type {
  BuiltinMiddlewareFunction,
  MiddlewareResult
} from '../../types/middleware'
import {io} from '../../context/state'
import {log} from '../../components/cyre-log'
import {metricsReport} from '../../context/metrics-report'
import {TimeKeeper} from '../../components/cyre-timekeeper'

/*

      C.Y.R.E. - D.E.B.O.U.N.C.E - M.I.D.D.L.E.W.A.R.E
      
      Fixed debounce middleware with proper IO state integration:
      - Store debounce timer IDs in IO state for persistence
      - Cancel existing timers before creating new ones
      - Execute callback with latest payload after debounce period
      - Proper cleanup and error handling

*/

export const debounceMiddleware: BuiltinMiddlewareFunction = async (
  context,
  next
) => {
  const {action, payload} = context
  const debounceTime = action.debounce

  if (!debounceTime || debounceTime <= 0) {
    return next(payload)
  }

  try {
    // Get current action state
    const currentAction = io.get(action.id)
    if (!currentAction) {
      log.error(`Action ${action.id} not found in IO state for debounce`)
      return next(payload)
    }

    // Cancel existing debounce timer if it exists
    if (currentAction.debounceTimerId) {
      TimeKeeper.forget(currentAction.debounceTimerId)
      log.debug(`Cancelled existing debounce timer for ${action.id}`)

      metricsReport.sensor.log(action.id, 'debounce', 'debounce-middleware', {
        action: 'timer-cancelled',
        previousTimerId: currentAction.debounceTimerId
      })
    }

    // Generate unique timer ID
    const timerId = `${action.id}-debounce-${Date.now()}`

    // Update IO state with new timer ID and latest payload
    const updatedAction = {
      ...currentAction,
      debounceTimerId: timerId,
      payload: payload // Store latest payload
    }
    io.set(updatedAction)

    // Create debounce timer that will execute the actual dispatch
    const timerResult = TimeKeeper.keep(
      debounceTime,
      async () => {
        try {
          // Get the latest action state when timer executes
          const actionAtExecution = io.get(action.id)
          if (!actionAtExecution) {
            log.error(`Action ${action.id} not found during debounce execution`)
            return
          }

          // Clear the timer ID from action state
          const clearedAction = {
            ...actionAtExecution,
            debounceTimerId: undefined
          }
          io.set(clearedAction)

          log.debug(
            `Debounce timer fired for ${action.id} after ${debounceTime}ms`
          )

          metricsReport.sensor.log(
            action.id,
            'execution',
            'debounce-middleware',
            {
              action: 'debounce-executed',
              debounceTime,
              timerId
            }
          )

          // Execute the next middleware in chain with stored payload
          const result = await next(actionAtExecution.payload)

          // Handle the result appropriately
          if (!result || result.type === 'continue') {
            log.debug(`Debounced execution completed for ${action.id}`)
          } else {
            log.debug(
              `Debounced execution result for ${action.id}:`,
              result.type
            )
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          log.error(
            `Debounce execution failed for ${action.id}: ${errorMessage}`
          )

          metricsReport.sensor.error(
            action.id,
            errorMessage,
            'debounce-execution'
          )
        }
      },
      1, // Execute once
      timerId
    )

    if (timerResult.kind === 'error') {
      log.error(
        `Failed to create debounce timer for ${action.id}: ${timerResult.error.message}`
      )

      // Clear the timer ID since timer creation failed
      const failedAction = {...updatedAction, debounceTimerId: undefined}
      io.set(failedAction)

      metricsReport.sensor.error(
        action.id,
        timerResult.error.message,
        'debounce-timer-creation'
      )

      // Fall back to immediate execution
      return next(payload)
    }

    log.debug(
      `Debounce timer created for ${action.id}: ${debounceTime}ms delay`
    )

    metricsReport.sensor.log(action.id, 'debounce', 'debounce-middleware', {
      action: 'timer-created',
      debounceTime,
      timerId,
      collapsed: !!currentAction.debounceTimerId
    })

    // Return delay result - this tells the system to not continue immediately
    return {
      type: 'delay',
      duration: debounceTime,
      payload,
      metadata: {
        debounced: true,
        timerId,
        debounceTime
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Debounce middleware error for ${action.id}: ${errorMessage}`)

    metricsReport.sensor.error(action.id, errorMessage, 'debounce-middleware')

    // Fall back to immediate execution on error
    return next(payload)
  }
}
