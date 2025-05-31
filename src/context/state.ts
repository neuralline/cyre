// src/context/state.ts
// Updated with proper payload history management for change detection

import {log} from '../components/cyre-log'
import type {ActionPayload, IO, ISubscriber, Timer} from '../types/interface'
import {isEqual} from '../libs/utils'
import {metricsState, type MetricsState} from './metrics-state'

import type {StateKey} from '../types/interface'
import {createStore} from './create-store'
export type MiddlewareFunction = (action: IO) => Promise<void>

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

// Utility functions for state management
const cleanupAction = (id: StateKey): void => {
  const metrics = actionMetrics.get(id)
  if (metrics?.intervalId) {
    clearInterval(metrics.intervalId)
  }
  actionMetrics.forget(id)
  payloadHistory.forget(id)
}

// Export IO operations with proper metrics tracking and synchronization
export const io = {
  set: (action: IO): void => {
    try {
      if (!action?.id) throw new Error('IO state: Action must have an id')
      const enhanced: IO = {
        ...action,
        timestamp: Date.now(),
        type: action.type || action.id
      }

      cleanupAction(action.id)
      ioStore.set(action.id, enhanced)

      // Initialize action metrics properly with current timestamp
      const currentMetrics = actionMetrics.get(action.id)

      // Initialize metrics if they don't exist or are invalid
      if (!currentMetrics) {
        actionMetrics.set(action.id, {
          lastExecutionTime: 0,
          executionCount: 0,
          errors: []
        })
      }

      // Initialize payload history for change detection if needed
      if (action.detectChanges && action.payload !== undefined) {
        payloadHistory.set(action.id, action.payload)
      }
    } catch (error) {
      log.critical(
        `IO state corruption detected: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      throw error
    }
  },

  updateMetrics: (id: StateKey, update: Partial<StateActionMetrics>): void => {
    try {
      const current = actionMetrics.get(id) || {
        lastExecutionTime: 0,
        executionCount: 0,
        errors: []
      }

      const updatedMetrics: StateActionMetrics = {
        ...current,
        lastExecutionTime:
          update.lastExecutionTime !== undefined
            ? Math.max(0, update.lastExecutionTime)
            : current.lastExecutionTime,
        executionCount:
          update.executionCount !== undefined
            ? Math.max(0, update.executionCount)
            : current.executionCount,
        errors: update.errors || current.errors
      }

      const hasChanges =
        updatedMetrics.lastExecutionTime !== current.lastExecutionTime ||
        updatedMetrics.executionCount !== current.executionCount ||
        updatedMetrics.errors.length !== current.errors.length

      if (hasChanges) {
        actionMetrics.set(id, updatedMetrics)
      }
    } catch (error) {
      log.error(`Failed to update metrics for ${id}: ${error}`)
    }
  },

  get: (id: StateKey): IO | undefined => ioStore.get(id),

  forget: (id: StateKey): boolean => {
    cleanupAction(id)
    return ioStore.forget(id)
  },

  clear: (): void => {
    try {
      ioStore.getAll().forEach(item => {
        if (item.id) cleanupAction(item.id)
      })
      payloadHistory.clear()
      actionMetrics.clear()
      ioStore.clear()
      metricsState.reset()
    } catch (error) {
      log.critical(`System clear failed: ${error}`)
      throw error
    }
  },

  getAll: (): IO[] => ioStore.getAll(),

  hasChanged: (id: StateKey, newPayload: ActionPayload): boolean => {
    try {
      const previousPayload = payloadHistory.get(id)

      if (previousPayload === undefined) {
        return true
      }

      const hasChanged = !isEqual(newPayload, previousPayload)
      return hasChanged
    } catch (error) {
      log.error(`Error in change detection for ${id}: ${error}`)
      return true
    }
  },

  getPrevious: (id: StateKey): ActionPayload | undefined => {
    return payloadHistory.get(id)
  },

  updatePayload: (id: StateKey, payload: ActionPayload): void => {
    try {
      payloadHistory.set(id, payload)
    } catch (error) {
      log.error(`Failed to update payload history for ${id}: ${error}`)
    }
  },

  getMetrics: (id: StateKey): StateActionMetrics | undefined => {
    const metrics = actionMetrics.get(id)
    if (metrics) {
      // log.debug(
      //   `Retrieved metrics for ${id}: lastExecution=${metrics.lastExecutionTime}, count=${metrics.executionCount}`
      // )
    } else {
      log.debug(`No metrics found for ${id}`)

      const action = ioStore.get(id)
      if (action) {
        const newMetrics: StateActionMetrics = {
          lastExecutionTime: 0,
          executionCount: 0,
          errors: []
        }
        actionMetrics.set(id, newMetrics)
        return newMetrics
      }
    }
    return metrics
  },

  trackExecution: (id: StateKey, executionTime?: number): void => {
    try {
      const now = Date.now()
      const currentMetrics = io.getMetrics(id) || {
        lastExecutionTime: 0,
        executionCount: 0,
        errors: []
      }

      const updatedMetrics: StateActionMetrics = {
        ...currentMetrics,
        lastExecutionTime: now,
        executionCount: currentMetrics.executionCount + 1
      }

      actionMetrics.set(id, updatedMetrics)
    } catch (error) {
      log.error(`Failed to track execution for ${id}: ${error}`)
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
  forget: (id: StateKey): boolean => {
    const result = subscriberStore.forget(id)
    return result
  },
  clear: (): void => {
    subscriberStore.clear()
  },
  getAll: (): ISubscriber[] => subscriberStore.getAll()
}

export const middlewares = {
  add: (middleware: IMiddleware): void => {
    if (!middleware?.id || typeof middleware.fn !== 'function') {
      throw new Error('Invalid middleware format')
    }

    middlewareStore.set(middleware.id, middleware)
  },
  get: (id: StateKey): IMiddleware | undefined => {
    return middlewareStore.get(id)
  },
  forget: (id: StateKey): boolean => {
    const result = middlewareStore.forget(id)
    if (result) {
      // log.debug(`Removed middleware: ${id}`)
    }
    return result
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

    // Update active formations count in metrics state
    const activeCount = timelineStore
      .getAll()
      .filter(t => t.status === 'active').length
    metricsState.update({activeFormations: activeCount})
  },

  get: (id: StateKey): Timer | undefined => timelineStore.get(id),

  forget: (id: StateKey): boolean => {
    const timers = timelineStore.getAll().filter(timer => timer.id === id)
    timers.forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
      if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
    })

    const result = timelineStore.forget(id)

    // Update active formations count
    const activeCount = timelineStore
      .getAll()
      .filter(t => t.status === 'active').length
    metricsState.update({activeFormations: activeCount})

    return result
  },

  clear: (): void => {
    timelineStore.getAll().forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
      if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
    })
    timelineStore.clear()
    metricsState.update({activeFormations: 0})
  },

  getAll: (): Timer[] => timelineStore.getAll(),

  // Add the missing getActive method
  getActive: (): Timer[] => {
    return timelineStore.getAll().filter(timer => timer.status === 'active')
  }
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
export type {MetricsState as QuantumState, StateKey}
