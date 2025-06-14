// src/context/state.ts
// Refactored state management with payload separation

import {log} from '../components/cyre-log'
import type {
  BranchStore,
  IO,
  ISubscriber,
  StateActionMetrics,
  Timer
} from '../types/core'
import {metricsState, type MetricsState} from './metrics-state'
import {payloadState} from './payload-state'
import type {StateKey} from '../types/core'
import {createStore} from './create-store'

/*

      C.Y.R.E - S.T.A.T.E
      
      Refactored state management with clean separation:
      - IO store: Configuration and behavior only
      - Payload state: Separate payload management
      - Clean interfaces and backward compatibility
      - Enhanced state operations

*/

// Create stores with proper typing
const ioStore = createStore<IO>() // Channels
const subscriberStore = createStore<ISubscriber>() // .on subscribers/listeners
const timelineStore = createStore<Timer>() // schedules and queued tasks
const actionMetrics = createStore<StateActionMetrics>()
const branchStore = createStore<BranchStore>()

/**
 * IO operations - configuration only, no payload data
 * // channel information store
 */
export const io = Object.freeze({
  /**
   * Set action configuration (no payload)
   */
  set: (action: IO): void => {
    try {
      if (!action?.id) throw new Error('IO state: Action must have an id')
      const id = action.id

      const channel: IO = {
        ...action,
        timestamp: Date.now()
      }

      ioStore.set(id, channel)
    } catch (error) {
      log.critical(
        `IO state corruption detected: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      throw error
    }
  },

  /**
   * Get action configuration
   */
  get: (id: StateKey): IO | undefined => ioStore.get(id),

  /**
   * Remove action configuration
   */
  forget: (id: StateKey): boolean => {
    // Also remove payload
    payloadState.forget(id)
    return ioStore.forget(id)
  },

  /**
   * Clear all action configurations
   */
  clear: (): void => {
    try {
      //actionMetrics.clear()
      ioStore.clear()

      payloadState.clear() // Clear payload state
      metricsState.reset()
    } catch (error) {
      log.critical(`System clear failed: ${error}`)
      throw error
    }
  },

  /**
   * Get all action configurations
   */
  getAll: (): IO[] => ioStore.getAll(),

  /**
   * Get action metrics
   */
  getMetrics: (id: StateKey): StateActionMetrics | undefined => {
    const action = ioStore.get(id)
    if (action) {
      const newMetrics: StateActionMetrics = {
        lastExecutionTime: action._lastExecTime || 0,
        executionCount: action._executionCount || 0,
        errors: action.errors || []
      }

      return newMetrics
    }

    return undefined
  },

  /**
   * Track execution
   */
  trackExecution: (id: StateKey, executionTime?: number): void => {
    try {
      const now = Date.now()
      const currentMetrics = io.getMetrics(id) || {
        lastExecutionTime: 0,
        executionCount: 0,
        errors: []
      }
    } catch (error) {
      log.error(`Failed to track execution for ${id}: ${error}`)
    }
  }
})

// Keep existing subscribers and timeline exports (unchanged)
export const subscribers = {
  add: (subscriber: ISubscriber): void => {
    if (!subscriber?.id || !subscriber?.handler) {
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

// scheduled task store
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
  branch: branchStore
})

// Export types
export type {MetricsState as QuantumState, StateKey}
