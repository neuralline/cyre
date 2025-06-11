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

// Utility functions for state management
const cleanupAction = (id: StateKey): void => {
  const metrics = actionMetrics.get(id)
  if (metrics?.intervalId) {
    clearInterval(metrics.intervalId)
  }
  actionMetrics.forget(id)
  // Payload cleanup is handled by payloadState
}

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

      // Clean action of any payload data for separation
      const {payload: _, ...cleanAction} = action as any

      const enhanced: IO = {
        ...cleanAction,
        timestamp: Date.now(),
        type: action.type || action.id
      }

      cleanupAction(action.id)
      ioStore.set(action.id, enhanced)

      // Initialize action metrics properly with current timestamp
      const currentMetrics = actionMetrics.get(action.id)

      if (!currentMetrics) {
        actionMetrics.set(action.id, {
          lastExecutionTime: 0,
          executionCount: 0,
          errors: []
        })
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

  /**
   * Update action metrics
   */
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

  /**
   * Get action configuration
   */
  get: (id: StateKey): IO | undefined => ioStore.get(id),

  /**
   * Remove action configuration
   */
  forget: (id: StateKey): boolean => {
    cleanupAction(id)
    // Also remove payload
    payloadState.forget(id)
    return ioStore.forget(id)
  },

  /**
   * Clear all action configurations
   */
  clear: (): void => {
    try {
      ioStore.getAll().forEach(item => {
        if (item.id) cleanupAction(item.id)
      })
      actionMetrics.clear()
      ioStore.clear()
      // Clear payload state
      payloadState.clear()
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
    const metrics = actionMetrics.get(id)
    if (metrics) {
      return metrics
    } else {
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
