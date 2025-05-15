// src/context/metrics-state.ts

import {BREATHING, defaultMetrics} from '../config/cyre-config'
import type {
  BreathingState,
  QuantumState as MetricsState,
  PerformanceMetrics,
  Priority,
  StateKey,
  SystemMetrics,
  SystemStress
} from '../interfaces/interface'
import {memoize} from '../libs/utils'
import {createStore} from './create-store'

// Core Types

// Create quantum state store
const metricsStore = createStore<MetricsState>()
metricsStore.set('quantum', defaultMetrics)

// Memoized selectors
const getStressLevel = memoize(
  (metrics: SystemMetrics, performance: PerformanceMetrics): SystemStress => {
    // Increase stress sensitivity by lowering the divisors
    const cpuStress = Math.min(
      1,
      (metrics.cpu || 0) / (BREATHING.LIMITS.MAX_CPU * 0.7)
    )
    const memoryStress = Math.min(
      1,
      (metrics.memory || 0) / (BREATHING.LIMITS.MAX_MEMORY * 0.7)
    )
    const eventLoopStress = Math.min(
      1,
      (metrics.eventLoop || 0) / (BREATHING.LIMITS.MAX_EVENT_LOOP * 0.7)
    )
    const callRateStress = Math.min(
      1,
      (performance.callsPerSecond || 0) / (BREATHING.LIMITS.MAX_CALL_RATE * 0.7)
    )

    // Increase weight of maximum stress component
    const maxStress = Math.max(
      cpuStress,
      memoryStress,
      eventLoopStress,
      callRateStress
    )

    return {
      cpu: cpuStress,
      memory: memoryStress,
      eventLoop: eventLoopStress,
      callRate: callRateStress,
      // Use weighted average with more emphasis on max component
      combined: Math.min(
        1,
        (cpuStress +
          memoryStress +
          eventLoopStress +
          callRateStress +
          maxStress * 2) /
          6
      )
    }
  }
)

// Add breathing rate calculation
const calculateBreathingRate = (stress: number): number => {
  if (stress >= BREATHING.STRESS.CRITICAL) {
    return BREATHING.RATES.RECOVERY
  }

  // Exponential rate adjustment based on stress
  const stressFactor = Math.exp(stress) - 1
  return Math.max(
    BREATHING.RATES.MIN,
    Math.min(BREATHING.RATES.MAX, BREATHING.RATES.BASE * (1 + stressFactor))
  )
}

// Add Result type if not already defined
export type Result<T, E = Error> =
  | {kind: 'ok'; value: T}
  | {kind: 'error'; error: E}

// Export unified state management
export const metricsState = {
  // Add these properties at the top level to match QuantumState interface
  inRecuperation: false,
  hibernating: false,
  activeFormations: 0,
  recuperationInterval: undefined as NodeJS.Timeout | undefined,
  isLocked: false,

  lock: (): void => {
    metricsState.isLocked = true
    metricsState.update({isLocked: true})
  },

  isSystemLocked: (): boolean => {
    return metricsState.isLocked
  },

  get: (): Readonly<MetricsState> => {
    const state = metricsStore.get('quantum')!
    return Object.freeze({
      ...state,
      inRecuperation: metricsState.inRecuperation,
      hibernating: metricsState.hibernating,
      activeFormations: metricsState.activeFormations
    })
  },

  update: (update: Partial<MetricsState>): MetricsState => {
    const current = metricsStore.get('quantum')!
    const next = {
      ...current,
      ...update,
      lastUpdate: Date.now(),
      inRecuperation: update.inRecuperation ?? metricsState.inRecuperation,
      hibernating: update.hibernating ?? metricsState.hibernating,
      activeFormations: update.activeFormations ?? metricsState.activeFormations
    }

    // Recalculate stress when system or performance metrics change
    if (update.system || update.performance) {
      next.stress = getStressLevel(next.system, next.performance)
    }

    metricsStore.set('quantum', next)
    return next
  },

  // Breathing operations
  updateBreath: (metrics: SystemMetrics): MetricsState => {
    const current = metricsStore.get('quantum')!
    const stress = getStressLevel(metrics, current.performance)
    const now = Date.now()

    const breathing: BreathingState = {
      ...current.breathing,
      breathCount: current.breathing.breathCount + 1,
      lastBreath: now,
      stress: stress.combined,
      currentRate: calculateBreathingRate(stress.combined),
      nextBreathDue: now + calculateBreathingRate(stress.combined),
      isRecuperating: stress.combined > BREATHING.STRESS.HIGH,
      recuperationDepth: Math.min(1, stress.combined),
      pattern: stress.combined > BREATHING.STRESS.HIGH ? 'RECOVERY' : 'NORMAL'
    }

    return metricsState.update({
      system: metrics,
      breathing,
      stress,
      inRecuperation: breathing.isRecuperating
    })
  },
  // Performance tracking
  recordCall: (priority: Priority = 'medium'): MetricsState => {
    const current = metricsStore.get('quantum')!
    const now = Date.now()
    const timeDiff = now - current.performance.lastCallTimestamp

    const callsPerSecond =
      timeDiff >= 1000 ? 1 : current.performance.callsPerSecond + 1

    const performance: PerformanceMetrics = {
      ...current.performance,
      callsTotal: current.performance.callsTotal + 1,
      callsPerSecond,
      lastCallTimestamp: now,
      activeQueues: {
        ...current.performance.activeQueues,
        [priority]: current.performance.activeQueues[priority] + 1
      },
      queueDepth: current.performance.queueDepth + 1
    }

    return metricsState.update({performance})
  },

  // System health checks
  isHealthy: (): boolean => {
    const state = metricsStore.get('quantum')!
    return (
      !state.breathing.isRecuperating &&
      state.stress.combined < BREATHING.STRESS.HIGH
    )
  },

  shouldAllowCall: (priority: Priority): boolean => {
    const state = metricsStore.get('quantum')!

    if (state.breathing.isRecuperating) {
      return priority === 'critical'
    }

    return (
      state.stress.combined < BREATHING.STRESS.HIGH ||
      priority === 'critical' ||
      priority === 'high'
    )
  },

  reset: (): void => {
    metricsState.inRecuperation = false
    metricsState.hibernating = false
    metricsState.activeFormations = 0
    metricsState.isLocked = false
    if (metricsState.recuperationInterval) {
      clearTimeout(metricsState.recuperationInterval)
      metricsState.recuperationInterval = undefined
    }
    metricsStore.set('quantum', defaultMetrics)
  },
  forget: (key: StateKey) => {
    metricsStore.forget(key)
  }
}

// Export type for external use
export type {MetricsState as QuantumState, StateKey}
