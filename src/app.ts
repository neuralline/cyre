// src/app.ts
import CyreAction from './components/cyre-actions'
import CyreChannel from './components/cyre-channels'
import {log} from './components/cyre-logger'
import {subscribe} from './components/cyre-on'
import timeKeeper from './components/cyre-time-keeper'
import {BREATHING, MSG} from './config/cyre-config'
import {io, subscribers, timeline} from './context/state'
import {metricsState} from './context/metrics-state'
import {historyState} from './context/history-state'
import {
  applyMiddleware,
  MiddlewareFunction,
  registerMiddleware
} from './components/cyre-middleware'
import dataDefinitions from './elements/data-definitions'
import type {
  ActionId,
  ActionPayload,
  BreathingMetrics,
  CyreResponse,
  IO,
  Subscriber,
  SubscriptionResponse,
  TimekeeperMetrics
} from './interfaces/interface'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.0.0 2025

    example use:
      cyre.action({id: 'uber', payload: 44085648634})
      cyre.on('uber', number => {
          console.log('Calling Uber: ', number)
      })
      cyre.call('uber') 

    Cyre's first low: A robot can not injure a human being or allow a human being to be harmed by not helping.
*/

interface CyreInstance {
  initialize: () => CyreResponse
  call: (id?: ActionId, payload?: ActionPayload) => Promise<CyreResponse>
  action: (attribute: IO | IO[]) => void
  on: (
    type: string | Subscriber[],
    fn?: (
      payload?: unknown
    ) => void | Promise<void> | {id: string; payload?: unknown}
  ) => SubscriptionResponse
  shutdown: () => void
  lock: () => void
  status: () => boolean
  forget: (id: string) => boolean
  get: (id: string) => IO | undefined
  pause: (id?: string) => void
  resume: (id?: string) => void
  hasChanged: (id: string, payload: ActionPayload) => boolean
  getPrevious: (id: string) => ActionPayload | undefined
  getBreathingState: () => Readonly<BreathingMetrics>
  getPerformanceState: () => {
    totalProcessingTime: number
    totalCallTime: number
    totalStress: number
    stress: number
  }
  getMetrics: (channelId: string) => TimekeeperMetrics
  getHistory: (actionId?: string) => any
  clearHistory: (actionId?: string) => void
  middleware: (id: string, fn: Function) => void
}

const Cyre = function (line: string = crypto.randomUUID()): CyreInstance {
  let isShutdown = false // Cyre shutdown state

  const initializeBreathing = () => {
    timeKeeper.keep(
      BREATHING.RATES.BASE,
      async () => {
        const currentState = metricsState.get()
        const state = metricsState.updateBreath({
          cpu: currentState.system.cpu,
          memory: currentState.system.memory,
          eventLoop: currentState.system.eventLoop,
          isOverloaded: currentState.system.isOverloaded
        })
      },
      true
    )
  }

  const lock = (): CyreResponse => {
    if (isShutdown) {
      return {
        ok: false,
        message: MSG.CALL_OFFLINE,
        payload: null
      }
    }

    metricsState.lock()
    log.info('Cyre system locked - no new channels or subscribers can be added')

    return {
      ok: true,
      message: 'System locked successfully',
      payload: null
    }
  }

  // src/components/cyre-time-keeper.ts
  const processCall = async (
    action: IO,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    if (!action) {
      return {ok: false, payload: null, message: 'Invalid action'}
    }

    // Check system state first
    const {breathing, stress} = metricsState.get()
    if (breathing.isRecuperating && action.priority?.level !== 'critical') {
      return {
        ok: false,
        payload: null,
        message: `System recuperating (${(
          breathing.recuperationDepth * 100
        ).toFixed(1)}% depth). Try later.`
      }
    }

    // Handle repeat: 0 as "don't execute"
    if (action.repeat === 0) {
      return {
        ok: true,
        payload: null,
        message: 'Action registered but not executed (repeat: 0)'
      }
    }

    // Clear any existing timers for this action
    const existingTimers = timeline.getAll().filter(t => t.id === action.id)
    existingTimers.forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
      if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
    })
    timeline.forget(action.id)

    // Determine timing behavior
    const hasDelay = action.delay !== undefined && action.delay >= 0
    const hasInterval = action.interval && action.interval > 0
    const repeatValue = action.repeat

    // Apply stress factor to interval
    const stressFactor = 1 + stress.combined
    const adjustedInterval = hasInterval ? action.interval * stressFactor : 0

    // CASE 1: No timing modifiers - execute immediately
    if (!hasDelay && !hasInterval) {
      return handleNormalCall(action, payload)
    }

    // CASE A: Actions with timing modifiers
    return new Promise(resolve => {
      // Determine initial wait time:
      // - If delay specified, use it (even if 0)
      // - Otherwise use interval
      const initialWait = hasDelay
        ? Math.max(0, action.delay)
        : hasInterval
        ? adjustedInterval
        : 0

      const timerId = `${action.id}-${Date.now()}`

      // First execution timer
      const timerResult = timeKeeper.keep(
        initialWait,
        async () => {
          // First execution
          await useDispatch({
            ...action,
            timeOfCreation: performance.now(),
            payload: payload ?? action.payload
          })

          // Handle repeats if needed
          if (hasInterval && repeatValue !== 1) {
            // Calculate remaining executions
            // If repeat is true/infinite, pass true
            // Otherwise subtract 1 from repeat (since we just did first execution)
            const remainingRepeats =
              repeatValue === true
                ? true
                : typeof repeatValue === 'number'
                ? repeatValue - 1
                : 0

            if (remainingRepeats) {
              // Schedule remaining executions with interval timing
              timeKeeper.keep(
                adjustedInterval,
                async () => {
                  if (metricsState.isHealthy()) {
                    await useDispatch({
                      ...action,
                      timeOfCreation: performance.now(),
                      payload: payload ?? action.payload
                    })
                  }
                },
                remainingRepeats,
                action.id
              )
            }
          }

          // Resolve with success message
          resolve({
            ok: true,
            payload: null,
            message: `Action executed with ${
              hasDelay ? `delay: ${action.delay}ms` : ''
            }${
              hasInterval ? `, interval: ${action.interval}ms` : ''
            }, repeat: ${repeatValue === true ? 'infinite' : repeatValue}`
          })
        },
        1, // Execute first timer exactly once
        timerId
      )

      if (timerResult.kind === 'error') {
        resolve({
          ok: false,
          payload: null,
          message: `Failed to set up timer: ${timerResult.error.message}`
        })
      }
    })
  }

  const scheduleIntervalAction = async (
    action: IO,
    interval: number,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    // First, clear any existing timers for this action ID
    const existingTimers = timeline.getAll().filter(t => t.id === action.id)
    existingTimers.forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
      if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
    })

    timeline.forget(action.id)

    // No immediate execution - follow the agreed logic:
    // "For interval actions: First execution should ALWAYS wait for the interval"
    const repeatValue = action.repeat

    // Skip execution for repeat: 0
    if (repeatValue === 0) {
      return {
        ok: true,
        payload: null,
        message: 'Action registered but not executed (repeat: 0)'
      }
    }

    // Schedule all executions with the interval
    const timerId = timeKeeper.keep(
      interval,
      async () => {
        if (metricsState.isHealthy()) {
          await useDispatch({
            ...action,
            timeOfCreation: performance.now(),
            payload: payload ?? action.payload
          })
        }
      },
      repeatValue, // Pass the original repeat value
      action.id
    )

    if (timerId.kind === 'error') {
      return {
        ok: false,
        payload: null,
        message: timerId.error.message
      }
    }

    return {
      ok: true,
      payload: null,
      message: `Action queued. First execution in ${Math.round(
        interval
      )}ms. Total executions: ${
        repeatValue === true ? 'infinite' : repeatValue
      }`
    }
  }

  const handleStressedCall = async (
    action: IO,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    const priority = action.priority?.level || 'medium'

    if (!metricsState.shouldAllowCall(priority)) {
      const {stress} = metricsState.get()
      return {
        ok: false,
        payload: null,
        message: `System under high stress (${(stress.combined * 100).toFixed(
          1
        )}%). Try later.`
      }
    }

    return handleNormalCall(action, payload)
  }

  const useDispatch = async (io: IO): Promise<CyreResponse> => {
    if (!io?.id) {
      throw new Error('Invalid IO object')
    }

    try {
      // Try to find subscriber by type or id
      const subscriber = subscribers.get(io.id)

      if (!subscriber) {
        const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${io.id}`
        log.error(error)

        // Record failed dispatch in history
        historyState.record(io.id, io.payload, {
          ok: false,
          message: error
        })

        return {
          ok: false,
          payload: null,
          message: error
        }
      }

      const startTime = performance.now()
      const dispatch = CyreAction({...io}, subscriber.fn)
      const duration = performance.now() - startTime

      // Record history entry
      historyState.record(
        io.id,
        io.payload,
        {
          ok: dispatch.ok,
          message: dispatch.message,
          error: dispatch.error
        },
        duration
      )

      if (io.log) {
        log.info({
          ...dispatch,
          executionTime: duration,
          timestamp: Date.now()
        })
      }

      // Handle chainable actions
      if (dispatch?.intraLink) {
        try {
          const {id, payload} = dispatch.intraLink
          await call(id, payload)
        } catch (error) {
          log.error(`Linked action error: ${error}`)
        }
      }

      return {
        ok: true,
        payload: dispatch, // Return the dispatch result
        message: MSG.WELCOME
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error(`Dispatch error: ${errorMessage}`)

      // Record error in history
      historyState.record(io.id, io.payload, {
        ok: false,
        error: errorMessage
      })

      return {
        ok: false,
        payload: null,
        message: `Dispatch error: ${errorMessage}`
      }
    }
  }

  const handleNormalCall = async (
    action: IO,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    try {
      // 1. THROTTLE - Check first as it's an immediate rejection if too soon
      if (action.throttle) {
        const now = Date.now()
        const lastExecution = io.getMetrics(action.id)?.lastExecutionTime || 0
        const timeSinceLastExecution = now - lastExecution

        if (timeSinceLastExecution < action.throttle) {
          return {
            ok: false,
            payload: null,
            message: `Throttled: ${
              action.throttle - timeSinceLastExecution
            }ms remaining`
          }
        }
      }

      // 2. DEBOUNCE - Queue for later execution if needed
      if (action.debounce) {
        // If there's an existing debounce timer, cancel it
        if (action.debounceTimerId) {
          timeKeeper.forget(action.debounceTimerId)
          action.debounceTimerId = undefined
        }

        // Store this payload to use when the timer executes
        const debouncedPayload = payload ?? action.payload

        // Create a new unique ID for this debounce timer
        const debounceTimerId = `${action.id}-debounce-${Date.now()}`

        // Setup a new debounce timer
        const timerResult = timeKeeper.keep(
          action.debounce,
          async () => {
            // Execute the action after the debounce delay
            // but still apply detectChanges and delay if needed
            let result

            // 3. DETECT CHANGES (within debounce timer)
            if (
              action.detectChanges &&
              !io.hasChanged(action.id, debouncedPayload)
            ) {
              result = {
                ok: true,
                payload: null,
                message: 'Execution skipped: No changes detected in payload'
              }
            }
            // 4. DELAY (within debounce timer)
            else if (action.delay && action.delay > 0) {
              const delayTimerId = `${
                action.id
              }-delay-after-debounce-${Date.now()}`

              result = await new Promise(resolve => {
                timeKeeper.keep(
                  action.delay,
                  async () => {
                    // After both debounce and delay, actually execute
                    const execResult = await useDispatch({
                      ...action,
                      timeOfCreation: performance.now(),
                      payload: debouncedPayload,
                      // Clear the debounce timer ID since it's now executing
                      debounceTimerId: undefined
                    })

                    // Update metrics after execution
                    metricsState.recordCall(action.priority?.level)
                    resolve(execResult)
                  },
                  false, // Don't repeat
                  delayTimerId
                )
              })
            }
            // Direct execution if no delay
            else {
              result = await useDispatch({
                ...action,
                timeOfCreation: performance.now(),
                payload: debouncedPayload,
                // Clear the debounce timer ID since it's now executing
                debounceTimerId: undefined
              })

              // Update metrics after execution
              metricsState.recordCall(action.priority?.level)
            }

            return result
          },
          false, // Don't repeat
          debounceTimerId
        )

        // Store the timer ID to be able to cancel it later
        if (timerResult.kind === 'ok') {
          // Update the action in the store with the debounce timer ID
          action.debounceTimerId = debounceTimerId
          io.set(action)

          return {
            ok: true,
            payload: null,
            message: `Debounced: will execute after ${action.debounce}ms`
          }
        } else {
          return {
            ok: false,
            payload: null,
            message: `Failed to setup debounce: ${timerResult.error.message}`
          }
        }
      }

      // 3. DETECT CHANGES - Skip if payload hasn't changed
      if (
        action.detectChanges &&
        !io.hasChanged(action.id, payload ?? action.payload)
      ) {
        return {
          ok: true,
          payload: null,
          message: 'Execution skipped: No changes detected in payload'
        }
      }

      // 4. DELAY - Apply as the final protection step
      if (action.delay && action.delay > 0) {
        return new Promise(resolve => {
          const delayTimerId = `${action.id}-delay-${Date.now()}`

          const timerResult = timeKeeper.keep(
            action.delay,
            async () => {
              // After delay, process normally
              const result = action.interval
                ? await scheduleIntervalAction(
                    action,
                    action.interval * (1 + stress.combined),
                    payload
                  )
                : await useDispatch({
                    ...action,
                    timeOfCreation: performance.now(),
                    payload: payload ?? action.payload
                  })

              // Record the call
              metricsState.recordCall(action.priority?.level)
              resolve(result)
            },
            false, // Don't repeat
            delayTimerId
          )

          // If timeKeeper failed to set up the timer, resolve with error
          if (timerResult.kind === 'error') {
            resolve({
              ok: false,
              payload: null,
              message: `Failed to set up delay: ${timerResult.error.message}`
            })
          }
        })
      }

      // Apply middleware if present
      if (
        action.middleware &&
        Array.isArray(action.middleware) &&
        action.middleware.length > 0
      ) {
        const middlewareResult = await applyMiddleware(
          action,
          payload ?? action.payload
        )
        if (!middlewareResult) {
          return {
            ok: false,
            payload: null,
            message: 'Action rejected by middleware'
          }
        }

        // Use the processed action and payload
        const {action: processedAction, payload: processedPayload} =
          middlewareResult

        // Execute normally with processed data
        const result = await useDispatch({
          ...processedAction,
          timeOfCreation: performance.now(),
          payload: processedPayload
        })

        metricsState.recordCall(processedAction.priority?.level)
        return result
      }

      // No protection active, execute normally
      const result = await useDispatch({
        ...action,
        timeOfCreation: performance.now(),
        payload: payload ?? action.payload
      })

      metricsState.recordCall(action.priority?.level)
      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        payload: null,
        message: `Call failed: ${errorMessage}`
      }
    }
  }

  const call = async (
    id?: ActionId,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    if (isShutdown) {
      return {
        ok: false,
        message: MSG.CALL_OFFLINE,
        payload: null
      }
    }

    if (!id?.trim()) {
      return {
        ok: false,
        message: MSG.CALL_INVALID_ID,
        payload: null
      }
    }

    const action = io.get(id.trim())
    if (!action) {
      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_NOT_RESPONDING}: ${id}`
      }
    }

    return processCall(action, payload)
  }

  const action = (attribute: IO | IO[]): void => {
    if (isShutdown) {
      log.error(MSG.OFFLINE)
      return
    }
    if (metricsState.isSystemLocked()) {
      log.error(MSG.SYSTEM_LOCKED_CHANNELS)
      return
    }

    try {
      if (Array.isArray(attribute)) {
        attribute.forEach(ioItem => {
          const processedChannel = CyreChannel(
            {...ioItem, type: ioItem.type || ioItem.id},
            dataDefinitions
          )
          if (processedChannel.ok && processedChannel.payload) {
            // Ensure the action is properly stored
            const payload = processedChannel.payload
            io.set(payload)

            // Debug log to confirm storage
            log.debug(`Action ${payload.id} registered successfully`)

            // Double-check that action was stored correctly
            const stored = io.get(payload.id)
            if (!stored) {
              log.error(`Failed to retrieve action ${payload.id} after storage`)
            }
          } else {
            log.error(`Failed to process action: ${processedChannel.message}`)
          }
        })
      } else {
        const processedChannel = CyreChannel(
          {...attribute, type: attribute.type || attribute.id},
          dataDefinitions
        )
        if (processedChannel.ok && processedChannel.payload) {
          // Ensure the action is properly stored
          const payload = processedChannel.payload
          io.set(payload)

          // Debug log to confirm storage
          log.debug(`Action ${payload.id} registered successfully`)

          // Double-check that action was stored correctly
          const stored = io.get(payload.id)
          if (!stored) {
            log.error(`Failed to retrieve action ${payload.id} after storage`)
          }
        } else {
          log.error(`Failed to process action: ${processedChannel.message}`)
        }
      }
    } catch (error) {
      log.error(`Action registration failed: ${error}`)
    }
  }

  //init Cyre
  const initialize = (): CyreResponse => {
    isShutdown = false
    initializeBreathing()
    timeKeeper.resume()

    console.log(
      '%c' + MSG.QUANTUM_HEADER,
      'background: rgb(151, 2, 151); color: white; display: block;'
    )

    return {
      ok: true,
      payload: 200,
      message: MSG.WELCOME
    }
  }

  const status = () => {
    isShutdown
      ? log.info({ok: true, message: MSG.OFFLINE})
      : log.info({ok: true, message: MSG.ONLINE})
    return isShutdown
  }

  const forget = (id: string): boolean => {
    if (isShutdown) {
      log.error(MSG.CALL_OFFLINE)
      return false
    }

    timeKeeper.pause(id)
    return io.forget(id)
  }

  const get = (id: string): IO | undefined => {
    if (isShutdown) {
      log.error(MSG.CALL_OFFLINE)
      return undefined
    }
    return io.get(id)
  }

  const pause = (id?: string): void => {
    if (isShutdown) {
      log.error(MSG.CALL_OFFLINE)
      return
    }

    timeKeeper.pause(id)
    const allTimers = timeline.getAll()

    if (id) {
      const timer = timeline.get(id)
      if (timer) {
        timeline.add({...timer, status: 'paused'})
      }
    } else {
      allTimers.forEach(timer => {
        if (timer) {
          timeline.add({...timer, status: 'paused'})
        }
      })
    }
  }

  const resume = (id?: string): void => {
    if (isShutdown) {
      log.error(MSG.CALL_OFFLINE)
      return
    }

    timeKeeper.resume(id)
    const allTimers = timeline.getAll()

    if (id) {
      const timer = timeline.get(id)
      if (timer) {
        timeline.add({...timer, status: 'active'})
      }
    } else {
      allTimers.forEach(timer => {
        if (timer) {
          timeline.add({...timer, status: 'active'})
        }
      })
    }
  }

  const hasChanged = (id: string, payload: ActionPayload): boolean => {
    if (isShutdown) {
      log.error(MSG.CALL_OFFLINE)
      return false
    }
    return io.hasChanged(id, payload)
  }

  const getPrevious = (id: string): ActionPayload | undefined => {
    if (isShutdown) {
      log.error(MSG.CALL_OFFLINE)
      return undefined
    }
    return io.getPrevious(id)
  }

  const getBreathingState = () => {
    return metricsState.get().breathing
  }

  const getPerformanceState = () => {
    const state = metricsState.get()
    return {
      totalProcessingTime: 0,
      totalCallTime: 0,
      totalStress: state.stress.combined,
      stress: state.stress.combined
    }
  }

  const getMetrics = (channelId: string): TimekeeperMetrics => {
    if (isShutdown) {
      return {
        hibernating: true,
        activeFormations: 0,
        inRecuperation: false,
        breathing: metricsState.get().breathing,
        formations: []
      }
    }
    return {
      hibernating: false,
      activeFormations: timeline.getActive().length,
      inRecuperation: false,
      breathing: metricsState.get().breathing,
      formations: timeline
        .getAll()
        .filter(f => f.id === channelId)
        .map(f => ({
          ...f,
          breathingSync: 1.0
        }))
    }
  }

  const getHistory = (actionId?: string) => {
    if (isShutdown) {
      log.error(MSG.CALL_OFFLINE)
      return []
    }

    if (actionId) {
      return historyState.getChannel(actionId)
    }
    return historyState.getAll()
  }

  const clearHistory = (actionId?: string) => {
    if (isShutdown) {
      log.error(MSG.CALL_OFFLINE)
      return
    }

    if (actionId) {
      historyState.clearChannel(actionId)
    } else {
      historyState.clearAll()
    }
  }

  /**
   * Register middleware
   * @param id Unique middleware identifier
   * @param fn Middleware function
   * @returns Response indicating success or failure
   */
  const middleware = (id: string, fn: Function): CyreResponse => {
    if (isShutdown) {
      return {
        ok: false,
        message: MSG.CALL_OFFLINE,
        payload: null
      }
    }

    if (metricsState.isSystemLocked()) {
      return {
        ok: false,
        message: MSG.SYSTEM_LOCKED_CHANNELS,
        payload: null
      }
    }

    try {
      // Register the middleware
      const success = registerMiddleware(id, fn)

      return {
        ok: success,
        message: success
          ? `Middleware '${id}' registered successfully`
          : `Failed to register middleware '${id}'`,
        payload: null
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error(`Failed to register middleware: ${errorMessage}`)

      return {
        ok: false,
        message: `Failed to register middleware: ${errorMessage}`,
        payload: null
      }
    }
  }

  const shutdown = (): void => {
    if (isShutdown) return

    try {
      // Clean up timers first
      timeline.getAll().forEach(timer => {
        if (timer.timeoutId) {
          clearTimeout(timer.timeoutId)
        }
      })

      timeKeeper.hibernate()
      subscribers.clear()
      io.clear()
      metricsState.reset()
      isShutdown = true

      if (typeof process !== 'undefined' && process.exit) {
        process.exit(0)
      }
    } catch (error) {
      log.error(`Failed to shutdown gracefully: ${error}`)
      if (typeof process !== 'undefined' && process.exit) {
        process.exit(1)
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', shutdown)
  } else {
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    process.on('uncaughtException', error => {
      console.error('Uncaught Exception:', error)
      shutdown()
    })
  }

  return {
    initialize,
    call,
    action,
    on: subscribe,
    shutdown,
    lock,
    status,
    forget,
    get,
    pause,
    resume,
    hasChanged,
    getPrevious,
    getBreathingState,
    getPerformanceState,
    getMetrics,
    getHistory,
    clearHistory,
    middleware
  }
}

// Create default instance
const cyre = Cyre('quantum-inceptions')
cyre.initialize()

export {Cyre, cyre, log}
export default cyre
