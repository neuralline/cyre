// src/context/state.ts - Update with timer utilities
import {log} from '../components/cyre-log'
import type {
  ActionMetrics,
  ActionPayload,
  IO,
  ISubscriber,
  Timer
} from '../types/interface'
import {isEqual} from '../libs/utils'
import {metricsState, type QuantumState} from './metrics-state'

import type {StateKey} from '../types/interface'
import {createStore} from './create-store'
import timeKeeper from '../components/cyre-timekeeper'

// Update to include proper middleware typing
import type {MiddlewareFunction} from '../components/cyre-middleware'

// Define a middleware type that works with the ISubscriber interface
export interface IMiddleware extends ISubscriber {
  fn: MiddlewareFunction
}

export interface StateActionMetrics {
  lastExecutionTime: number
  executionCount: number
  intervalId?: NodeJS.Timeout
  errors: Array<{
    timestamp: number
    message: string
  }>
}

// Create stores with proper typing
const ioStore = createStore<IO>()
const subscriberStore = createStore<ISubscriber>()
const middlewareStore = createStore<IMiddleware>()
const timelineStore = createStore<Timer>()
const payloadHistory = createStore<ActionPayload>()
const actionMetrics = createStore<StateActionMetrics>()

// Export IO operations
// Utility functions for state management
const cleanupAction = (id: StateKey): void => {
  const metrics = actionMetrics.get(id)
  if (metrics?.intervalId) {
    clearInterval(metrics.intervalId)
  }
  actionMetrics.forget(id)
  payloadHistory.forget(id)
}
export const io = {
  set: (ioState: IO): void => {
    if (!ioState?.id) throw new Error('IO must have an id')

    try {
      const enhanced: IO = {
        ...ioState,
        timestamp: Date.now(),
        type: ioState.type || ioState.id
      }

      cleanupAction(ioState.id)
      ioStore.set(ioState.id, enhanced)

      // Ensure action metrics are initialized with a valid timestamp
      const currentTime = Date.now()
      const currentMetrics = actionMetrics.get(ioState.id)

      // Only initialize if metrics don't exist yet or have invalid values
      if (!currentMetrics || currentMetrics.lastExecutionTime === 0) {
        actionMetrics.set(ioState.id, {
          lastExecutionTime: 0, // Keep as 0 until first execution
          executionCount: 0,
          errors: []
        })
      }

      if (ioState.detectChanges) {
        payloadHistory.set(ioState.id, ioState.payload)
      }

      // Record call in quantum state
      metricsState.recordCall(ioState.priority?.level)
    } catch (error) {
      log.error(
        `Failed to set IO: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      throw error
    }
  },

  updateMetrics: (id: StateKey, update: Partial<ActionMetrics>): void => {
    // Get current metrics or create default if none exist
    const current = actionMetrics.get(id) || {
      lastExecutionTime: 0,
      executionCount: 0,
      errors: []
    }

    // Update with new metrics, ensuring values are valid
    const updatedMetrics = {
      ...current,
      ...update,
      // Ensure lastExecutionTime is a valid number greater than 0
      lastExecutionTime:
        update.lastExecutionTime && update.lastExecutionTime > 0
          ? update.lastExecutionTime
          : current.lastExecutionTime
    }

    // Store updated metrics
    actionMetrics.set(id, updatedMetrics)
  },

  get: (id: StateKey): IO | undefined => ioStore.get(id),

  //remove channel
  forget: (id: StateKey): boolean => {
    cleanupAction(id)
    return ioStore.forget(id)
  },
  //forget all channels and clear all related records
  clear: (): void => {
    ioStore.getAll().forEach(item => {
      if (item.id) cleanupAction(item.id)
    })
    payloadHistory.clear()
    actionMetrics.clear()
    ioStore.clear()
    metricsState.reset()
  },

  //get all io state
  getAll: (): IO[] => ioStore.getAll(),

  hasChanged: (id: StateKey, newPayload: ActionPayload): boolean => {
    const previousPayload = payloadHistory.get(id)

    // If no previous payload, consider it changed
    if (previousPayload === undefined) {
      return true
    }

    return !isEqual(newPayload, previousPayload)
  },

  getPrevious: (id: StateKey): ActionPayload | undefined => {
    return payloadHistory.get(id)
  },

  getMetrics: (id: StateKey): StateActionMetrics | undefined => {
    return actionMetrics.get(id)
  },

  /**
   * Set a timer with proper error handling
   * @returns Object indicating success and optional timerId/message
   */
  setTimer: (
    duration: number,
    callback: () => void,
    timerId: string
  ): {ok: boolean; message?: string} => {
    try {
      const result = timeKeeper.keep(
        duration,
        callback,
        1, // Execute once
        timerId
      )

      return result.kind === 'ok'
        ? {ok: true}
        : {ok: false, message: result.error.message}
    } catch (error) {
      log.error(`Failed to set timer: ${error}`)
      return {ok: false, message: String(error)}
    }
  },

  /**
   * Clear a timer by ID
   */
  clearTimer: (timerId: string): boolean => {
    try {
      timeKeeper.forget(timerId)
      return true
    } catch (error) {
      log.error(`Failed to clear timer ${timerId}: ${error}`)
      return false
    }
  }
}

// Keep existing subscribers and timeline exports
export const subscribers = {
  add: (subscriber: ISubscriber): void => {
    if (!subscriber?.id || !subscriber?.fn) {
      throw new Error('Invalid subscriber format')
    }
    subscriberStore.set(subscriber.id, subscriber)
  },
  get: (id: StateKey): ISubscriber | undefined => subscriberStore.get(id),
  forget: (id: StateKey): boolean => subscriberStore.forget(id),
  clear: (): void => subscriberStore.clear(),
  getAll: (): ISubscriber[] => subscriberStore.getAll()
}

export const middlewares = {
  add: (middleware: IMiddleware): void => {
    if (!middleware?.id || typeof middleware.fn !== 'function') {
      throw new Error('Invalid middleware format')
    }

    // Store middleware in the central store
    middlewareStore.set(middleware.id, middleware)
  },
  get: (id: StateKey): IMiddleware | undefined => {
    return middlewareStore.get(id)
  },
  forget: (id: StateKey): boolean => {
    return middlewareStore.forget(id)
  },
  clear: (): void => {
    middlewareStore.clear()
  },
  getAll: (): IMiddleware[] => {
    return middlewareStore.getAll()
  }
}
export const timeline = {
  add: (timer: Timer): void => {
    if (!timer.id) return
    timelineStore.set(timer.id, timer)
  },
  get: (id: StateKey): Timer | undefined => timelineStore.get(id),
  forget: (id: StateKey): boolean => {
    const timers = timelineStore.getAll().filter(timer => timer.id === id)
    timers.forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
      if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
    })
    return timelineStore.forget(id)
  },
  clear: (): void => {
    timelineStore.getAll().forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
    })
    timelineStore.clear()
  },
  getAll: (): Timer[] => timelineStore.getAll(),
  getActive: (): Timer[] =>
    timelineStore.getAll().filter(timer => timer.status === 'active')
}

// Export readonly stores
export const stores = Object.freeze({
  io: ioStore,
  subscribers: subscriberStore,
  timeline: timelineStore,
  quantum: metricsState,
  middleware: middlewareStore
})

// Export types
export type {QuantumState, StateKey}
