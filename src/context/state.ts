// src/context/state.ts
// Refactored state management with payload separation

import {log} from '../components/cyre-log'
import type {IO, ISubscriber, Timer} from '../types/core'
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

export type MiddlewareFunction = (action: IO) => Promise<void>

export interface IMiddleware extends ISubscriber {
  handler: MiddlewareFunction
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
const actionMetrics = createStore<StateActionMetrics>()

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
 */
export const io = {
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

      // Handle payload separately if provided in legacy format
      if ('payload' in action && action.payload !== undefined) {
        payloadState.set(action.id, action.payload, 'initial')
        //log.debug(`Migrated payload for ${action.id} to payload state`)
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
   * Check if payload has changed (delegated to payload state)
   */
  hasChanged: (id: StateKey, newPayload: any): boolean => {
    return payloadState.hasChanged(id, newPayload)
  },

  /**
   * Get previous payload (delegated to payload state)
   */
  getPrevious: (id: StateKey): any | undefined => {
    return payloadState.getPrevious(id)
  },

  /**
   * Update payload (delegated to payload state)
   */
  updatePayload: (id: StateKey, payload: any): void => {
    payloadState.set(id, payload, 'pipeline')
  },

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
  },

  /**
   * Create action with initial payload (backward compatibility)
   */
  createWithPayload: (action: IO & {payload?: any}): void => {
    const {payload, ...config} = action

    // Set configuration
    io.set(config)

    // Set payload separately if provided
    if (payload !== undefined) {
      payloadState.set(action.id, payload, 'initial')
    }
  },

  /**
   * Get action with current payload (backward compatibility)
   */
  getWithPayload: (id: StateKey): (IO & {payload?: any}) | undefined => {
    const config = io.get(id)
    if (!config) return undefined

    const currentPayload = payloadState.get(id)

    return {
      ...config,
      payload: currentPayload
    }
  }
}

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

export const middlewares = {
  add: (middleware: IMiddleware): void => {
    if (!middleware?.id || typeof middleware.handler !== 'function') {
      throw new Error('Invalid middleware format')
    }

    middlewareStore.set(middleware.id, middleware)
  },
  get: (id: StateKey): IMiddleware | undefined => {
    return middlewareStore.get(id)
  },
  forget: (id: StateKey): boolean => {
    const result = middlewareStore.forget(id)
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

  getActive: (): Timer[] => {
    return timelineStore.getAll().filter(timer => timer.status === 'active')
  }
}

/**
 * Migration utilities for smooth transition
 */
export const migrationUtils = {
  /**
   * Migrate existing actions with payload to new structure
   */
  migrateActions: (): {migrated: number; errors: string[]} => {
    const errors: string[] = []
    let migrated = 0

    try {
      const allActions = ioStore.getAll()

      allActions.forEach(action => {
        try {
          if ('payload' in action) {
            const {payload, ...config} = action as any

            // Update action without payload
            ioStore.set(action.id, config)

            // Set payload in payload state
            if (payload !== undefined) {
              payloadState.set(action.id, payload, 'initial')
              migrated++
            }
          }
        } catch (error) {
          errors.push(`Failed to migrate ${action.id}: ${error}`)
        }
      })
    } catch (error) {
      errors.push(`Migration failed: ${error}`)
    }

    log.info(
      `Migration completed: ${migrated} actions migrated, ${errors.length} errors`
    )
    return {migrated, errors}
  },

  /**
   * Validate separation - ensure no payload in IO store
   */
  validateSeparation: (): {valid: boolean; violations: string[]} => {
    const violations: string[] = []

    try {
      const allActions = ioStore.getAll()

      allActions.forEach(action => {
        if ('payload' in action && (action as any).payload !== undefined) {
          violations.push(`Action ${action.id} still contains payload data`)
        }
      })
    } catch (error) {
      violations.push(`Validation failed: ${error}`)
    }

    return {
      valid: violations.length === 0,
      violations
    }
  },

  /**
   * Get migration statistics
   */
  getStats: () => {
    const ioStats = {
      totalActions: ioStore.getAll().length,
      withPayloadViolations: ioStore.getAll().filter(a => 'payload' in a).length
    }

    const payloadStats = payloadState.getStats()

    return {
      io: ioStats,
      payload: payloadStats,
      separationIntegrity: {
        clean: ioStats.withPayloadViolations === 0,
        violations: ioStats.withPayloadViolations
      }
    }
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
