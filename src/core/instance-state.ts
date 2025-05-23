// src/core/instance-state.ts
// Isolated state management for CYRE instances

import {createStore} from '../context/create-store'
import type {
  IO,
  ISubscriber,
  Timer,
  ActionPayload,
  StateKey,
  StateActionMetrics
} from '../types/interface'
import {metricsState, QuantumState} from '../context/metrics-state'
import {log} from '../components/cyre-log'
import timeKeeper from '../components/cyre-timekeeper'
import {isEqual} from '../libs/utils'
import {buildProtectionPipeline} from '@/components/cyre-protection'

/*

    C.Y.R.E. - I.N.S.T.A.N.C.E. - S.T.A.T.E

    Isolated state management for individual CYRE instances

*/

export interface InstanceState {
  io: ReturnType<typeof createInstanceIOStore>
  subscribers: ReturnType<typeof createInstanceSubscriberStore>
  middlewares: ReturnType<typeof createInstanceMiddlewareStore>
  timeline: ReturnType<typeof createInstanceTimelineStore>
  payloadHistory: ReturnType<typeof createStore<ActionPayload>>
  actionMetrics: ReturnType<typeof createStore<StateActionMetrics>>
}

export interface StateActionMetrics {
  lastExecutionTime: number
  executionCount: number
  intervalId?: NodeJS.Timeout
  errors: Array<{
    timestamp: number
    message: string
  }>
  // Add error count for easier access
  get errorCount(): number
}

/**
 * Create isolated IO store for an instance
 */
const createInstanceIOStore = () => {
  const ioStore = createStore<IO>()
  const payloadHistory = createStore<ActionPayload>()
  const actionMetrics = createStore<StateActionMetrics>()

  const cleanupAction = (id: StateKey): void => {
    const metrics = actionMetrics.get(id)
    if (metrics?.intervalId) {
      clearInterval(metrics.intervalId)
    }
    actionMetrics.forget(id)
    payloadHistory.forget(id)
  }

  return {
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

        // Build protection pipeline if not already present
        if (!enhanced._protectionPipeline) {
          enhanced._protectionPipeline = buildProtectionPipeline(enhanced)
        }

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

    updateMetrics: (
      id: StateKey,
      update: Partial<StateActionMetrics>
    ): void => {
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

      // Log for debugging
      //   log.debug(`Updated metrics for ${id}:`, {
      //     previous: current,
      //     updated: updatedMetrics
      //   })
    },

    get: (id: StateKey): IO | undefined => ioStore.get(id),

    forget: (id: StateKey): boolean => {
      cleanupAction(id)
      return ioStore.forget(id)
    },

    clear: (): void => {
      ioStore.getAll().forEach(item => {
        if (item.id) cleanupAction(item.id)
      })
      payloadHistory.clear()
      actionMetrics.clear()
      ioStore.clear()
      metricsState.reset()
    },

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
}

/**
 * Create isolated subscriber store for an instance
 */
const createInstanceSubscriberStore = () => {
  const subscriberStore = createStore<ISubscriber>()

  return {
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
}

/**
 * Create isolated middleware store for an instance
 */
const createInstanceMiddlewareStore = () => {
  const middlewareStore = createStore<ISubscriber>()

  return {
    add: (middleware: ISubscriber): void => {
      if (!middleware?.id || typeof middleware.fn !== 'function') {
        throw new Error('Invalid middleware format')
      }
      middlewareStore.set(middleware.id, middleware)
    },
    get: (id: StateKey): ISubscriber | undefined => {
      return middlewareStore.get(id)
    },
    forget: (id: StateKey): boolean => {
      return middlewareStore.forget(id)
    },
    clear: (): void => {
      middlewareStore.clear()
    },
    getAll: (): ISubscriber[] => {
      return middlewareStore.getAll()
    }
  }
}

/**
 * Create isolated timeline store for an instance
 */
const createInstanceTimelineStore = () => {
  const timelineStore = createStore<Timer>()

  return {
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
}

/**
 * Create isolated state for a CYRE instance
 */
export const createInstanceState = (): InstanceState => {
  return {
    io: createInstanceIOStore(),
    subscribers: createInstanceSubscriberStore(),
    middlewares: createInstanceMiddlewareStore(),
    timeline: createInstanceTimelineStore(),
    payloadHistory: createStore<ActionPayload>(),
    actionMetrics: createStore<StateActionMetrics>()
  }
}
