// src/context/metrics-state.ts
// Metrics state with breathing system integration

import {BREATHING, defaultMetrics, MSG} from '../config/cyre-config'
import type {
  BreathingState,
  QuantumState as MetricsState,
  PerformanceMetrics,
  SystemMetrics,
  SystemStress
} from '../types/system'
import type {Priority, StateKey} from '../types/core'
import {memoize} from '../libs/utils'
import {createStore} from './create-store'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - M.E.T.R.I.C.S - S.T.A.T.E
      
      Metrics state management with breathing system integration:
      - Unified stress calculation
      - Breathing rate adaptation
      - System health monitoring
      - Performance tracking

*/

// Create quantum state store
const metricsStore = createStore<MetricsState>()
metricsStore.set('quantum', defaultMetrics)

// Memoized selectors for performance
const getStressLevel = memoize(
  (metrics: SystemMetrics, performance: PerformanceMetrics): SystemStress => {
    // Calculate stress from system metrics with improved sensitivity
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

    // Weight the maximum stress component more heavily
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
      // Combined stress with emphasis on max component
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

// Calculate breathing rate based on stress level
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

// Result type for state operations
export type Result<T, E = Error> =
  | {kind: 'ok'; value: T}
  | {kind: 'error'; error: E}

/**
 * Unified metrics state management with breathing integration
 */
export const metricsState = {
  // State tracking properties
  inRecuperation: false,
  hibernating: false,
  activeFormations: 0,
  recuperationInterval: undefined as NodeJS.Timeout | undefined,
  _isLocked: false,
  _init: false,
  _shutdown: false,

  /**
   * Check if system is locked
   */
  isLocked: (): boolean => {
    return metricsState._isLocked
  },

  /**
   * Get current metrics state (read-only)
   */
  get: (): Readonly<MetricsState> => {
    const state = metricsStore.get('quantum')!
    return Object.freeze({
      ...state,
      inRecuperation: metricsState.inRecuperation,
      hibernating: metricsState.hibernating,
      activeFormations: metricsState.activeFormations
    })
  },

  /**
   * Update metrics state
   */
  update: (update: Partial<MetricsState>): MetricsState => {
    const current = metricsStore.get('quantum')!
    const next = {
      ...current,
      ...update,
      lastUpdate: Date.now(),
      // FIXED: Properly handle hibernation state updates
      inRecuperation: update.inRecuperation ?? metricsState.inRecuperation,
      hibernating: update.hibernating ?? metricsState.hibernating,
      activeFormations: update.activeFormations ?? metricsState.activeFormations
    }

    // Recalculate stress when system or performance metrics change
    if (update.system || update.performance) {
      next.stress = getStressLevel(next.system, next.performance)
    }

    metricsStore.set('quantum', next)

    // FIXED: Update module-level state tracking
    if (update.hibernating !== undefined) {
      metricsState.hibernating = update.hibernating
    }
    if (update.inRecuperation !== undefined) {
      metricsState.inRecuperation = update.inRecuperation
    }
    if (update.activeFormations !== undefined) {
      metricsState.activeFormations = update.activeFormations
    }

    return next
  },

  /**
   * Update breathing state with system metrics
   */
  updateBreath: (metrics: SystemMetrics): MetricsState => {
    try {
      const current = metricsStore.get('quantum')!
      const stress = getStressLevel(metrics, current.performance)
      const now = Date.now()

      // Calculate new breathing rate based on stress
      const newRate = calculateBreathingRate(stress.combined)

      const breathing: BreathingState = {
        ...current.breathing,
        breathCount: current.breathing.breathCount + 1,
        lastBreath: now,
        stress: stress.combined,
        currentRate: newRate,
        nextBreathDue: now + newRate,
        isRecuperating: stress.combined > BREATHING.STRESS.HIGH,
        recuperationDepth: Math.min(1, stress.combined),
        pattern: stress.combined > BREATHING.STRESS.HIGH ? 'RECOVERY' : 'NORMAL'
      }

      // Update recovery state tracking
      metricsState.inRecuperation = breathing.isRecuperating

      const updatedState = metricsState.update({
        system: metrics,
        breathing,
        stress,
        inRecuperation: breathing.isRecuperating
      })

      // Log significant breathing state changes
      if (breathing.isRecuperating && !current.breathing.isRecuperating) {
        log.warn('System entering recuperation mode due to high stress')
      } else if (
        !breathing.isRecuperating &&
        current.breathing.isRecuperating
      ) {
        log.success('System exiting recuperation mode - stress normalized')
      }

      return updatedState
    } catch (error) {
      // Critical: Breathing system corruption affects entire system health
      log.critical(`Breathing system update failed: ${error}`)
      // Return current state to prevent total failure
      return metricsStore.get('quantum')!
    }
  },

  /**
   * Update breathing state with external stress calculation
   */
  updateBreathingWithStress: (
    stress: number,
    callRate?: number
  ): MetricsState => {
    try {
      const current = metricsStore.get('quantum')!
      const now = Date.now()

      // Calculate new breathing rate
      const newRate = calculateBreathingRate(stress)

      const breathing: BreathingState = {
        ...current.breathing,
        breathCount: current.breathing.breathCount + 1,
        lastBreath: now,
        stress: stress,
        currentRate: newRate,
        nextBreathDue: now + newRate,
        isRecuperating: stress > BREATHING.STRESS.HIGH,
        recuperationDepth: Math.min(1, stress),
        pattern: stress > BREATHING.STRESS.HIGH ? 'RECOVERY' : 'NORMAL'
      }

      // Update performance metrics if call rate provided
      const performance = callRate
        ? {
            ...current.performance,
            callsPerSecond: callRate,
            lastCallTimestamp: now
          }
        : current.performance

      // Update recovery state tracking
      metricsState.inRecuperation = breathing.isRecuperating

      return metricsState.update({
        breathing,
        performance,
        stress: {
          ...current.stress,
          combined: stress,
          callRate: callRate || current.stress.callRate
        },
        inRecuperation: breathing.isRecuperating
      })
    } catch (error) {
      log.critical(`Breathing update with stress failed: ${error}`)
      return metricsStore.get('quantum')!
    }
  },

  /**
   * Lock the system
   */
  lock: (): void => {
    try {
      metricsState.update({_isLocked: true})
    } catch (error) {
      log.critical(`System lock failed: ${error}`)
      throw error
    }
  },

  /**
   * Initialize the system
   */
  init: (): void => {
    try {
      metricsState.update({_init: true})
      log.success('Cyre Metrics State' + metricsState._init)
    } catch (error) {
      log.critical(`System init failed: ${error}`)
      throw error
    }
  },

  /**
   * Shutdown the system
   */
  shutdown: (): void => {
    try {
      metricsState.update({_shutdown: true})
    } catch (error) {
      log.critical(`System shutdown failed: ${error}`)
      throw error
    }
  },

  /**
   * Check if system is healthy
   */
  isHealthy: (): boolean => {
    const state = metricsStore.get('quantum')!
    return (
      !state.breathing.isRecuperating &&
      state.stress.combined < BREATHING.STRESS.HIGH
    )
  },

  /**
   * Check if call should be allowed based on priority and system state
   */
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

  /**
   * Reset all metrics state
   */
  reset: (): void => {
    metricsState.inRecuperation = false
    metricsState.hibernating = false
    metricsState.activeFormations = 0
    metricsState._isLocked = false
    metricsState._shutdown = false
    metricsState._init = false

    if (metricsState.recuperationInterval) {
      clearTimeout(metricsState.recuperationInterval)
      metricsState.recuperationInterval = undefined
    }

    metricsStore.set('quantum', defaultMetrics)
  },

  /**
   * Forget specific state key
   */
  forget: (key: StateKey): boolean => {
    return metricsStore.forget(key)
  },

  /**
   * Get breathing statistics for monitoring
   */
  getBreathingStats: () => {
    const state = metricsStore.get('quantum')!
    const breathing = state.breathing

    return {
      currentStress: breathing.stress,
      currentRate: breathing.currentRate,
      isRecuperating: breathing.isRecuperating,
      pattern: breathing.pattern,
      breathCount: breathing.breathCount,
      lastBreath: breathing.lastBreath,
      nextBreathDue: breathing.nextBreathDue,
      recuperationDepth: breathing.recuperationDepth,
      stressThresholds: {
        low: BREATHING.STRESS.LOW,
        medium: BREATHING.STRESS.MEDIUM,
        high: BREATHING.STRESS.HIGH,
        critical: BREATHING.STRESS.CRITICAL
      },
      rateRange: {
        min: BREATHING.RATES.MIN,
        base: BREATHING.RATES.BASE,
        max: BREATHING.RATES.MAX,
        recovery: BREATHING.RATES.RECOVERY
      }
    }
  }
}

// Export type for external use
export type {MetricsState, StateKey}

/**
 * Calculate system stress from current metrics - using proper ES module imports
 */
export const calculateSystemStress = async (): Promise<number> => {
  try {
    // Use dynamic ES module import to avoid circular dependency
    const {metrics} = await import('../metrics/integration.js')
    const systemMetrics = metrics.getSystemMetrics()

    // Simple stress calculation based on available metrics
    const callRateStress = Math.min(systemMetrics.callRate / 100, 1) // 100 calls/sec = 100% stress
    const errorRateStress =
      systemMetrics.totalErrors > 0
        ? Math.min(
            (systemMetrics.totalErrors /
              Math.max(systemMetrics.totalCalls, 1)) *
              10,
            1
          )
        : 0
    const uptimeStress = systemMetrics.uptime > 0 ? 0 : 0.2 // No uptime = some stress

    // Combined stress calculation
    const combinedStress = Math.min(
      callRateStress * 0.5 + errorRateStress * 0.4 + uptimeStress * 0.1,
      1
    )

    return combinedStress
  } catch (error) {
    console.error(`Stress calculation failed: ${error}`)
    return 0.1 // Default low stress on error
  }
}

/**
 * Update breathing system with current system metrics - using proper ES module imports
 */
export const updateBreathingFromMetrics = async (): Promise<void> => {
  try {
    const stress = await calculateSystemStress()

    // Calculate adaptive breathing rate based on stress
    let newRate: number = BREATHING.RATES.BASE

    if (stress > BREATHING.STRESS.CRITICAL) {
      newRate = BREATHING.RATES.RECOVERY // 2000ms
    } else if (stress > BREATHING.STRESS.HIGH) {
      newRate = BREATHING.RATES.MAX // 1000ms
    } else if (stress > BREATHING.STRESS.MEDIUM) {
      newRate = BREATHING.RATES.BASE * 2 // 400ms
    } else if (stress < BREATHING.STRESS.LOW) {
      newRate = BREATHING.RATES.MIN // 50ms
    }

    // Update breathing state with system metrics
    metricsState.updateBreathingWithStress(stress)

    // Log significant changes
    const breathing = metricsState.get().breathing
    if (stress > BREATHING.STRESS.HIGH) {
      // Get metrics safely
      const {metrics} = await import('../metrics/integration.js')
      const systemMetrics = metrics.getSystemMetrics()

      // Import sensor safely
      const {sensor} = await import('../context/metrics-report.js')
      sensor.warn(
        'system',
        `High stress detected: ${(stress * 100).toFixed(1)}%`,
        {
          callRate: systemMetrics.callRate,
          totalErrors: systemMetrics.totalErrors,
          breathingRate: newRate
        }
      )
    }
  } catch (error) {
    // Don't log error every second - just use console.error
    console.error(`Breathing update failed: ${error}`)
  }
}
