// src/context/state.ts

import {CyreLog} from '../components/cyre-logger'
import type {
  ActionMetrics,
  ActionPayload,
  IO,
  ISubscriber,
  Timer
} from '../interfaces/interface'
import {isEqual} from '../libs/utils'
import {metricsState, type QuantumState} from './metrics-state'

// Enhanced types for state management
type Listener<T> = (state: T) => void
type Unsubscribe = () => void

export interface StateActionMetrics {
  lastExecutionTime: number
  executionCount: number
  intervalId?: NodeJS.Timeout
  errors: Array<{
    timestamp: number
    message: string
  }>
}
import type {StateKey} from '../interfaces/interface'
import {createStore} from './create-store'

// Create stores with proper typing
const ioStore = createStore<IO>()
const subscriberStore = createStore<ISubscriber>()
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

      actionMetrics.set(ioState.id, {
        lastExecutionTime: Date.now(),
        executionCount: 0,
        errors: []
      })

      if (ioState.detectChanges) {
        payloadHistory.set(ioState.id, ioState.payload)
      }

      // Record call in quantum state
      metricsState.recordCall(ioState.priority?.level)
    } catch (error) {
      CyreLog.error(
        `Failed to set IO: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      throw error
    }
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
    return !isEqual(newPayload, previousPayload)
  },

  getPreviousPayload: (id: StateKey): ActionPayload | undefined => {
    return payloadHistory.get(id)
  },

  getMetrics: (id: StateKey): StateActionMetrics | undefined => {
    return actionMetrics.get(id)
  },

  updateMetrics: (id: StateKey, update: Partial<ActionMetrics>): void => {
    const current = actionMetrics.get(id) || {
      lastExecutionTime: 0,
      executionCount: 0,
      errors: []
    }
    actionMetrics.set(id, {...current, ...update})
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
  quantum: metricsState
})

// Export types
export type {QuantumState, StateKey}
