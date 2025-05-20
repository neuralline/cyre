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
import {applyMiddleware, registerMiddleware} from './components/cyre-middleware'
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
    Version 4.0.1 2025

    example use:
      cyre.action({id: 'uber', payload: 44085648634})
      cyre.on('uber', number => {
          console.log('Calling Uber: ', number)
      })
      cyre.call('uber') 

    Cyre's first law: A robot can not injure a human being or allow a human being to be harmed by not helping.
    Cyre's second law: An event system must never fail to execute critical actions nor allow system degradation by refusing to implement proper protection mechanisms.
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

  /**
   * Simplified useDispatch that focuses solely on dispatching to subscribers
   */
  const useDispatch = async (io: IO): Promise<CyreResponse> => {
    if (!io?.id) {
      throw new Error('Invalid IO object')
    }

    // Find subscriber
    const subscriber = subscribers.get(io.id)
    if (!subscriber) {
      const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${io.id}`
      // Record failed dispatch in history
      historyState.record(io.id, io.payload, {ok: false, message: error})
      return {ok: false, payload: null, message: error}
    }

    // Execute action
    const startTime = performance.now()
    const dispatch = CyreAction({...io}, subscriber.fn)
    const duration = performance.now() - startTime

    // Record history
    historyState.record(
      io.id,
      io.payload,
      {ok: dispatch.ok, message: dispatch.message, error: dispatch.error},
      duration
    )

    // Log if enabled
    if (io.log) {
      log.info({
        ...dispatch,
        executionTime: duration,
        timestamp: Date.now()
      })
    }

    // Handle intraLink (chain to next action)
    if (dispatch?.intraLink) {
      const {id, payload} = dispatch.intraLink
      call(id, payload).catch(error => {
        log.error(`Linked action error: ${error}`)
      })
    }

    // Return standardized response reflecting actual dispatch result
    return {
      ok: dispatch.ok,
      payload: dispatch,
      message: dispatch.message || MSG.WELCOME
    }
  }

  /**
   * Entry point for action execution
   */
  const call = async (
    id?: ActionId,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    // System shutdown check
    if (isShutdown) {
      return {ok: false, message: MSG.CALL_OFFLINE, payload: null}
    }

    // ID validation
    if (!id?.trim()) {
      return {ok: false, message: MSG.CALL_INVALID_ID, payload: null}
    }

    // Action retrieval from store
    const action = io.get(id.trim())
    if (!action) {
      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_NOT_RESPONDING}: ${id}`
      }
    }

    try {
      // Apply protection layers first (throttle, debounce, change detection)
      const protectionResult = await applyProtectionLayers(action, payload)
      if (protectionResult.protected) {
        return protectionResult.response // Early return if any protection prevented execution
      }

      // Use the potentially modified payload from protection layers
      const finalPayload = protectionResult.payload ?? payload ?? action.payload

      // Route based on timing settings
      if (action.interval || action.delay) {
        return scheduleTimedExecution(action, finalPayload)
      } else {
        return executeImmediately(action, finalPayload)
      }
    } catch (error) {
      return standardErrorResponse('Call failed', error)
    }
  }

  /**
   * Applies protection layers (throttle, debounce, change detection)
   * Returns whether execution was prevented and a response if so
   */
  interface ProtectionResult {
    protected: boolean
    response?: CyreResponse
    payload?: ActionPayload
  }

  const applyProtectionLayers = async (
    action: IO,
    payload?: ActionPayload
  ): Promise<ProtectionResult> => {
    const finalPayload = payload ?? action.payload

    // 1. Check system state (recuperation mode)
    const {breathing} = metricsState.get()
    if (breathing.isRecuperating && action.priority?.level !== 'critical') {
      return {
        protected: true,
        response: {
          ok: false,
          payload: null,
          message: `System recuperating (${(
            breathing.recuperationDepth * 100
          ).toFixed(1)}% depth). Try later.`
        }
      }
    }

    // 2. Check repeat: 0 case
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
    if (action.debounce) {
      return {
        protected: true,
        response: debounceAction(action, finalPayload)
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
    if (action.middleware?.length > 0) {
      const middlewareResult = await applyMiddleware(action, finalPayload)
      if (!middlewareResult) {
        return {
          protected: true,
          response: {
            ok: false,
            payload: null,
            message: 'Action rejected by middleware'
          }
        }
      }

      // Middleware modified the action/payload but didn't block execution
      return {
        protected: false,
        payload: middlewareResult.payload,
        action: middlewareResult.action
      }
    }

    // No protection blocked execution
    return {
      protected: false,
      payload: finalPayload
    }
  }

  /**
   * Implements industry-standard throttle behavior
   * First call always passes through, subsequent calls are rate-limited
   */
  interface ThrottleResult {
    blocked: boolean
    response?: CyreResponse
  }

  const throttleCheck = (action: IO): ThrottleResult => {
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
   * Implements focused debounce behavior
   * Only handles setting up a timer for future execution
   */
  const debounceAction = (action: IO, payload: ActionPayload): CyreResponse => {
    // Cancel any existing debounce timer
    if (action.debounceTimerId) {
      timeKeeper.forget(action.debounceTimerId)
      action.debounceTimerId = undefined
    }

    // Create new debounce timer ID
    const debounceTimerId = `${action.id}-debounce-${Date.now()}`

    // Set up debounce timer - important: just handling debounce here!
    const timerResult = timeKeeper.keep(
      action.debounce,
      async () => {
        // After debounce period, process the action normally
        // This will go through the FULL PIPELINE again including other protections
        await call(action.id, payload)
      },
      false, // Don't repeat
      debounceTimerId
    )

    // Update action with timer ID
    if (timerResult.kind === 'ok') {
      action.debounceTimerId = debounceTimerId
      io.set(action)
    }

    return {
      ok: true,
      payload: null,
      message: `Debounced: will execute after ${action.debounce}ms`
    }
  }

  /**
   * Schedules execution with timing modifiers (delay, interval)
   */
  const scheduleTimedExecution = (
    action: IO,
    payload: ActionPayload
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
          // First execution
          const firstResult = await useDispatch({
            ...action,
            timeOfCreation: performance.now(),
            payload
          })

          // Handle repeats if needed
          if (
            (hasInterval && repeatValue === true) ||
            (typeof repeatValue === 'number' && repeatValue > 1)
          ) {
            // Schedule remaining executions with interval timing
            setupRepeatingTimer(action, payload, repeatValue)
          }

          resolve({
            ok: firstResult.ok,
            payload: firstResult.payload,
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
  const setupRepeatingTimer = (
    action: IO,
    payload: ActionPayload,
    repeat: number | boolean | undefined
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

  /**
   * Executes an action immediately with standardized approach
   */
  const executeImmediately = async (
    action: IO,
    payload: ActionPayload
  ): Promise<CyreResponse> => {
    try {
      // Simply dispatch the action - protections and middleware already applied
      const dispatchResult = await useDispatch({
        ...action,
        timeOfCreation: performance.now(),
        payload
      })

      // Record metrics
      metricsState.recordCall(action.priority?.level)

      return dispatchResult
    } catch (error) {
      return standardErrorResponse('Execution failed', error)
    }
  }

  /**
   * Standardized error response generator
   */
  const standardErrorResponse = (
    context: string,
    error: unknown
  ): CyreResponse => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`${context}: ${errorMessage}`)

    return {
      ok: false,
      payload: null,
      message: `${context}: ${errorMessage}`
    }
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

    log.quantum(
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
    log.quantum('Cyre shuting down')
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
