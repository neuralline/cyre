// src/app.ts
import CyreAction from './components/cyre-actions'
import CyreChannel from './components/cyre-channels'
import {CyreLog} from './components/cyre-logger'
import {subscribe} from './components/cyre-on'
import timeKeeper from './components/cyre-time-keeper'
import {BREATHING, MSG} from './config/cyre-config'
import {io, subscribers, timeline} from './context/state'
import {metricsState} from './context/metrics-state'
import dataDefinitions from './elements/data-definitions'
import type {
  ActionId,
  ActionPayload,
  BreathingMetrics,
  CyreResponse,
  IO,
  Priority,
  Subscriber,
  SubscriptionResponse,
  SystemMetrics,
  TimekeeperMetrics
} from './interfaces/interface'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 3 2025

    example use
    cyre.action({ id: 'uber', payload: 44085648634 })
    cyre.on('uber', number => {
      console.log("Calling taxi, dialling ", number)
    })
    cyre.call('uber')

    Cyre's first low: A robot can not injure a human being or allow a human being to be harmed by not helping;
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
  status: () => boolean
  forget: (id: string) => boolean
  get: (id: string) => IO | undefined
  pause: (id?: string) => void
  resume: (id?: string) => void
  hasChanged: (id: string, payload: ActionPayload) => boolean
  getPreviousPayload: (id: string) => ActionPayload | undefined
  getBreathingState: () => Readonly<BreathingMetrics>
  getPerformanceState: () => {
    totalProcessingTime: number
    totalCallTime: number
    totalStress: number
    stress: number
  }
  getMetrics: (channelId: string) => TimekeeperMetrics
}

const Cyre = function (line: string = crypto.randomUUID()): CyreInstance {
  let isShutdown = false

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

  const processCall = async (
    action: IO,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    if (!action) {
      return {
        ok: false,
        payload: null,
        message: 'Invalid action'
      }
    }

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

    if (action.interval) {
      const adjustedInterval = action.interval * (1 + stress.combined)
      return scheduleIntervalAction(action, adjustedInterval, payload)
    }

    if (stress.combined >= BREATHING.STRESS.HIGH) {
      return handleStressedCall(action, payload)
    }

    return handleNormalCall(action, payload)
  }

  const scheduleIntervalAction = async (
    action: IO,
    interval: number,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
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
      action.repeat || true,
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
      message: `Scheduled with breathing-adjusted interval: ${Math.round(
        interval
      )}ms`
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

  // src/app.ts (partial - dispatch related code)

  const useDispatch = async (io: IO): Promise<CyreResponse> => {
    if (!io?.type) {
      throw new Error('Invalid IO object')
    }

    try {
      // Try to find subscriber by type or id
      const subscriber = subscribers.get(io.type) || subscribers.get(io.id)

      if (!subscriber) {
        const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${io.type}`
        CyreLog.error(error)
        return {
          ok: false,
          payload: null,
          message: error
        }
      }

      const startTime = performance.now()
      const dispatch = CyreAction({...io}, subscriber.fn)

      if (io.log) {
        CyreLog.info({
          ...dispatch,
          executionTime: performance.now() - startTime,
          timestamp: Date.now()
        })
      }

      // Handle chainable actions
      if (dispatch?.intraLink) {
        try {
          const {id, payload} = dispatch.intraLink
          await call(id, payload)
        } catch (error) {
          CyreLog.error(`Linked action error: ${error}`)
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
      CyreLog.error(`Dispatch error: ${errorMessage}`)
      return {
        ok: false,
        payload: null,
        message: `Dispatch error: ${errorMessage}`
      }
    }
  }

  // Fix error handling in CyreAction return
  const handleNormalCall = async (
    action: IO,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    try {
      // Add stronger throttling enforcement
      if (action.throttle) {
        const now = Date.now()
        const lastExecution = io.getMetrics(action.id)?.lastExecutionTime || 0
        const timeSinceLastExecution = now - lastExecution

        if (timeSinceLastExecution < action.throttle) {
          // Strictly enforce throttle
          return {
            ok: false,
            payload: null,
            message: `Throttled: ${
              action.throttle - timeSinceLastExecution
            }ms remaining`
          }
        }
      }
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
      CyreLog.error(MSG.OFFLINE)
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
            io.set(processedChannel.payload)
          }
        })
      } else {
        const processedChannel = CyreChannel(
          {...attribute, type: attribute.type || attribute.id},
          dataDefinitions
        )
        if (processedChannel.ok && processedChannel.payload) {
          io.set(processedChannel.payload)
        }
      }
    } catch (error) {
      CyreLog.error(`Action registration failed: ${error}`)
    }
  }

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
      ? CyreLog.info({ok: true, message: MSG.OFFLINE})
      : CyreLog.info({ok: true, message: MSG.ONLINE})
    return isShutdown
  }

  const forget = (id: string): boolean => {
    if (isShutdown) {
      CyreLog.error(MSG.CALL_OFFLINE)
      return false
    }

    timeKeeper.pause(id)
    return io.forget(id)
  }

  const get = (id: string): IO | undefined => {
    if (isShutdown) {
      CyreLog.error(MSG.CALL_OFFLINE)
      return undefined
    }
    return io.get(id)
  }

  const pause = (id?: string): void => {
    if (isShutdown) {
      CyreLog.error(MSG.CALL_OFFLINE)
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
      CyreLog.error(MSG.CALL_OFFLINE)
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
      CyreLog.error(MSG.CALL_OFFLINE)
      return false
    }
    return io.hasChanged(id, payload)
  }

  const getPreviousPayload = (id: string): ActionPayload | undefined => {
    if (isShutdown) {
      CyreLog.error(MSG.CALL_OFFLINE)
      return undefined
    }
    return io.getPreviousPayload(id)
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
      CyreLog.error(`Failed to shutdown gracefully: ${error}`)
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
    status,
    forget,
    get,
    pause,
    resume,
    hasChanged,
    getPreviousPayload,
    getBreathingState,
    getPerformanceState,
    getMetrics
  }
}

// Create default instance
const cyre = Cyre('quantum-inceptions')
cyre.initialize()

export {Cyre, cyre, CyreLog}
export default cyre
