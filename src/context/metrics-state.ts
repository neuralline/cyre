// src/context/metrics-state.ts
// Metrics state with breathing system integration and centralized state management

import {sensor} from '../components/sensor'
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
import {io, subscribers, timeline} from './state'
import {createStore} from './create-store'

/*

      C.Y.R.E - M.E.T.R.I.C.S - S.T.A.T.E
      
      Centralized metrics state management with breathing authority:
      - Single source of truth via stores.quantum
      - Breathing system has authority over system flags
      - Clean separation: hibernating (TimeKeeper) vs recuperating (system)
      - Provides .getMetrics() API for cyre.getMetrics()

*/

// Create quantum state store - keeping original pattern
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
 * Initialize quantum store if not already done
 */
const initializeQuantumStore = (): void => {
  const current = metricsStore.get('quantum')
  if (!current) {
    metricsStore.set('quantum', defaultMetrics)
  }
}

/**
 * Unified metrics state management with breathing integration
 */
export const metricsState = {
  /**
   * Check if system is locked
   */
  isLocked: (): boolean => {
    const state = metricsStore.get('quantum')
    return state?._isLocked || false
  },
  isInit: (): boolean => {
    const state = metricsStore.get('quantum')
    return state?._init || false
  },

  /**
   * Get current metrics state (read-only)
   */
  get: (): Readonly<MetricsState> => {
    const state = metricsStore.get('quantum') || defaultMetrics
    return Object.freeze(state)
  },

  /**
   * Update metrics state - central state updater
   */
  update: (update: Partial<MetricsState>): MetricsState => {
    initializeQuantumStore()
    const current = metricsStore.get('quantum')!

    const next = {
      ...current,
      ...update,
      lastUpdate: Date.now()
    }

    // Recalculate stress when system or performance metrics change
    if (update.system || update.performance) {
      next.stress = getStressLevel(next.system, next.performance)
    }

    metricsStore.set('quantum', next)
    return next
  },

  /**
   * Breathing system authority - evaluates and sets system flags
   */
  updateBreathingState: (metrics: SystemMetrics): MetricsState => {
    try {
      initializeQuantumStore()
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

      // BREATHING AUTHORITY: Set system flags based on evaluation
      const updatedState = metricsState.update({
        system: metrics,
        breathing,
        stress,
        // Breathing system sets recuperating flag (system-wide)
        inRecuperation: breathing.isRecuperating
        // Note: hibernating is TimeKeeper authority, not breathing
      })

      // Log significant breathing state changes
      if (breathing.isRecuperating && !current.breathing.isRecuperating) {
        sensor.warn('System entering recuperation mode due to high stress')
        sensor.warn(
          'System entering recuperation mode due to high stress',
          'breathing-system',
          'system',
          'warning'
        )
      } else if (
        !breathing.isRecuperating &&
        current.breathing.isRecuperating
      ) {
        sensor.success('System exiting recuperation mode - stress normalized')
        sensor.success(
          'System exiting recuperation mode - stress normalized',
          'breathing-system',
          'system',
          'success'
        )
      }

      return updatedState
    } catch (error) {
      // Critical: Breathing system corruption affects entire system health
      sensor.critical(`Breathing system update failed: ${error}`)
      sensor.critical(
        `Breathing system update failed: ${error}`,
        'breathing-system',
        'system',
        'critical'
      )
      // Return current state to prevent total failure
      return metricsStore.get('quantum') || defaultMetrics
    }
  },

  /**
   * Lock the system
   */
  lock: (): void => {
    try {
      metricsState.update({_isLocked: true})
      sensor.sys('System locked', 'metrics-state', 'system', 'system')
    } catch (error) {
      sensor.critical(`System lock failed: ${error}`)
      throw error
    }
  },

  /**
   * Unlock the system
   */
  unlock: (): void => {
    try {
      metricsState.update({_isLocked: false})
      sensor.sys('System unlocked', 'metrics-state', 'system', 'system')
    } catch (error) {
      sensor.critical(`System unlock failed: ${error}`)
      throw error
    }
  },

  /**
   * Initialize the system
   */
  init: (): void => {
    try {
      initializeQuantumStore()
      metricsState.update({_init: true})
      sensor.success('Cyre Metrics State online')
      sensor.success(
        'Cyre Metrics State online',
        'metrics-state',
        'system',
        'success'
      )
    } catch (error) {
      sensor.critical(`System init failed: ${error}`)
      throw error
    }
  },

  /**
   * Shutdown the system
   */
  shutdown: (): void => {
    try {
      metricsState.update({_shutdown: true})
      sensor.sys(
        'System shutdown initiated',
        'metrics-state',
        'system',
        'system'
      )
    } catch (error) {
      sensor.critical(`System shutdown failed: ${error}`)
      throw error
    }
  },

  /**
   * Check if system is healthy (breathing authority)
   */
  isHealthy: (): boolean => {
    const state = metricsStore.get('quantum') || defaultMetrics
    return (
      !state.breathing.isRecuperating &&
      state.stress.combined < BREATHING.STRESS.HIGH
    )
  },

  /**
   * Check if call should be allowed based on priority and system state
   */
  shouldAllowCall: (priority: Priority): boolean => {
    const state = metricsStore.get('quantum') || defaultMetrics

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
    try {
      metricsStore.set('quantum', {
        ...defaultMetrics,
        lastUpdate: Date.now()
      })

      sensor.success(
        'Metrics state reset completed',
        'metrics-state',
        'system',
        'success'
      )
    } catch (error) {
      sensor.critical(`Metrics reset failed: ${error}`)
      throw error
    }
  },

  /**
   * Forget specific state key
   */
  forget: (key: StateKey): boolean => {
    try {
      return metricsStore.forget(key)
    } catch (error) {
      sensor.error(
        `Failed to forget key: ${key}`,
        'metrics-state',
        key,
        'error'
      )
      return false
    }
  },

  /**
   * Get breathing statistics for monitoring
   */
  getBreathingStats: () => {
    const state = metricsStore.get('quantum') || defaultMetrics
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
  },

  /**
   * API for cyre.getMetrics() - comprehensive metrics export
   */
  getMetrics: (channelId?: string): any => {
    try {
      const state = metricsStore.get('quantum') || defaultMetrics

      if (channelId) {
        // Get channel-specific metrics from IO store
        //const {io} = stores
        const channel = io.get(channelId)

        if (!channel) {
          return {
            error: `Channel ${channelId} not found`,
            available: false
          }
        }

        return {
          channelId,
          executionCount: channel._executionCount || 0,
          lastExecutionTime: channel._lastExecTime || 0,
          executionDuration: channel._executionDuration || 0,
          errorCount: channel._errorCount || 0,
          timeOfCreation: channel._timeOfCreation || 0,
          isBlocked: channel._isBlocked || false,
          hasFastPath: channel._hasFastPath || false,
          hasProtections: channel._hasProtections || false,
          hasProcessing: channel._hasProcessing || false,
          hasScheduling: channel._hasScheduling || false,
          available: true
        }
      }

      // Return system-wide metrics
      return {
        system: {
          stress: state.stress,
          breathing: {
            currentRate: state.breathing.currentRate,
            stress: state.breathing.stress,
            isRecuperating: state.breathing.isRecuperating,
            pattern: state.breathing.pattern,
            breathCount: state.breathing.breathCount
          },
          performance: state.performance,
          health: {
            isHealthy: metricsState.isHealthy(),
            isLocked: state._isLocked,
            hibernating: state.hibernating,
            inRecuperation: state.inRecuperation
          },
          uptime: Date.now() - (state.system?.startTime || Date.now()),
          lastUpdate: state.lastUpdate
        },
        stores: {
          channels: io.getAll().length,
          subscribers: subscribers.getAll().length,
          timeline: timeline.getAll().length,
          activeFormations: state.activeFormations
        },
        available: true
      }
    } catch (error) {
      sensor.error(
        `Metrics retrieval failed: ${error}`,
        'metrics-state',
        channelId || 'system',
        'error'
      )

      return {
        error: String(error),
        available: false
      }
    }
  },

  /**
   * Export detailed metrics for external monitoring
   */
  exportMetrics: (filter?: {
    includeChannels?: boolean
    includeSystem?: boolean
    includeBreathing?: boolean
    channelPattern?: string
  }): any => {
    try {
      const state = metricsStore.get('quantum') || defaultMetrics
      const options = {
        includeChannels: true,
        includeSystem: true,
        includeBreathing: true,
        ...filter
      }

      const result: any = {}

      if (options.includeSystem) {
        result.system = {
          stress: state.stress,
          performance: state.performance,
          health: {
            isHealthy: metricsState.isHealthy(),
            isLocked: state._isLocked,
            hibernating: state.hibernating,
            inRecuperation: state.inRecuperation
          },
          uptime: Date.now() - (state.system?.startTime || Date.now()),
          lastUpdate: state.lastUpdate
        }
      }

      if (options.includeBreathing) {
        result.breathing = metricsState.getBreathingStats()
      }

      if (options.includeChannels) {
        const channels = io.getAll()
        const filteredChannels = options.channelPattern
          ? channels.filter(ch =>
              new RegExp(options.channelPattern!).test(ch.id)
            )
          : channels

        result.channels = filteredChannels.map(channel => ({
          id: channel.id,
          type: channel.type,
          executionCount: channel._executionCount || 0,
          lastExecutionTime: channel._lastExecTime || 0,
          executionDuration: channel._executionDuration || 0,
          errorCount: channel._errorCount || 0,
          isBlocked: channel._isBlocked || false,
          hasFastPath: channel._hasFastPath || false,
          protections: {
            throttle: channel.throttle,
            debounce: channel.debounce,
            detectChanges: channel.detectChanges
          }
        }))
      }

      result.timestamp = Date.now()
      result.available = true

      return result
    } catch (error) {
      sensor.error(
        `Metrics export failed: ${error}`,
        'metrics-state',
        'system',
        'error'
      )

      return {
        error: String(error),
        available: false,
        timestamp: Date.now()
      }
    }
  }
}

// Export type for external use
export type {MetricsState, StateKey}

/**
 * Calculate system stress from current metrics
 */
export const calculateSystemStress = async (): Promise<number> => {
  try {
    // Simple stress calculation based on available metrics
    const callRateStress = 0.1 // Default baseline stress
    const errorRateStress = 0.1 // Default baseline stress
    const uptimeStress = 0.1 // Default baseline stress

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
 * Update breathing system with current system metrics - called by breathing interval
 */
export const updateBreathingFromMetrics = async (): Promise<void> => {
  try {
    const stress = await calculateSystemStress()

    // Update breathing state with system metrics - breathing has authority
    metricsState.updateBreathingState({
      cpu: 0, // Would get from actual system metrics
      memory: 0, // Would get from actual system metrics
      eventLoop: 0, // Would get from actual system metrics
      isOverloaded: stress > BREATHING.STRESS.HIGH
    })
  } catch (error) {
    // Don't log error every second - just use console.error
    sensor.error(`Breathing update failed: ${error}`)
  }
}
