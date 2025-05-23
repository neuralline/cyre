// src/execution/timed-executor.ts
// Delay and interval execution with precise timing

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {metricsState} from '../context/metrics-state'
import {timeline, io} from '../context/state'
import timeKeeper from '../components/cyre-timekeeper'
import {updateExecutionMetrics} from './execution-context'

/*

    C.Y.R.E. - T.I.M.E.D. - E.X.E.C.U.T.O.R

    Handles delay and interval-based execution with precision timing

*/

/**
 * Execute an action with timing requirements (delay/interval)
 */
export const scheduleTimedExecution = (
  action: IO,
  payload: ActionPayload,
  useDispatch: (io: IO) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  // Determine timing behavior
  const hasDelay = action.delay !== undefined && action.delay >= 0
  const hasInterval = action.interval && action.interval > 0
  const repeatValue = action.repeat

  // Apply stress factor to interval
  const {stress} = metricsState.get()
  const stressFactor = 1 + stress.combined
  const adjustedInterval = hasInterval ? action.interval * stressFactor : 0

  // Determine initial wait time
  const initialWait = hasDelay
    ? Math.max(0, action.delay)
    : hasInterval
    ? adjustedInterval
    : 0

  // Clean up existing timers - only do this when creating a new timer
  const existingTimers = timeline.getAll().filter(t => t.id === action.id)
  existingTimers.forEach(timer => {
    if (timer.timeoutId) clearTimeout(timer.timeoutId)
    if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
  })
  timeline.forget(action.id)

  return new Promise(resolve => {
    // Set up first execution
    const timerId = `${action.id}-${Date.now()}`

    const timerResult = timeKeeper.keep(
      initialWait,
      async () => {
        // Track execution start time
        const startTime = performance.now()

        // First execution
        const firstResult = await useDispatch({
          ...action,
          timeOfCreation: performance.now(),
          payload
        })

        // Calculate execution time
        const executionTime = performance.now() - startTime

        // Update metrics if execution was successful
        if (firstResult.ok) {
          updateExecutionMetrics(action.id, executionTime)
        }

        // Handle repeats if needed
        if (
          (hasInterval && repeatValue === true) ||
          (typeof repeatValue === 'number' && repeatValue > 1)
        ) {
          // Schedule remaining executions with interval timing
          setupRepeatingTimer(action, payload, repeatValue, useDispatch)
        }

        resolve({
          ok: firstResult.ok,
          payload: firstResult.payload,
          message: `Action executed with ${
            hasDelay ? `delay: ${action.delay}ms` : ''
          }${hasInterval ? `, interval: ${action.interval}ms` : ''}, repeat: ${
            repeatValue === true ? 'infinite' : repeatValue
          }`
        })
      },
      1, // Execute first timer exactly once
      timerId
    )

    // Handle timer setup failure
    if (timerResult.kind === 'error') {
      resolve({
        ok: false,
        payload: null,
        message: `Failed to set up timer: ${timerResult.error.message}`
      })
    }
  })
}

/**
 * Sets up a repeating timer for interval actions
 */
export const setupRepeatingTimer = (
  action: IO,
  payload: ActionPayload,
  repeat: number | boolean | undefined,
  useDispatch: (io: IO) => Promise<CyreResponse>
): void => {
  // Apply stress factor to interval
  const {stress} = metricsState.get()
  const stressFactor = 1 + stress.combined
  const adjustedInterval = action.interval! * stressFactor

  // Calculate remaining repeats
  const remainingRepeats =
    repeat === true
      ? true
      : typeof repeat === 'number'
      ? repeat - 1 // First execution already happened
      : 0

  if (!remainingRepeats) return // Nothing to do

  // Set up repeating timer
  timeKeeper.keep(
    adjustedInterval,
    async () => {
      if (metricsState.isHealthy()) {
        await useDispatch({
          ...action,
          timeOfCreation: performance.now(),
          payload
        })
      }
    },
    remainingRepeats,
    action.id
  )
}
