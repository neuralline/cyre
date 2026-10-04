// src/context/metrics-state.ts
// Metrics state with breathing system integration and centralized state management

import {sensor} from '../components/sensor'
import {defaultMetrics, MSG} from '../config/cyre-config'
import type {
  BreathingState,
  QuantumState as MetricsState,
  PerformanceMetrics,
  SystemMetrics,
  SystemStress,
  SystemFlags,
  CyreConfig,
  CyreUserConfig
} from '../types/system'
import type {Priority, StateKey} from '../types/core'
import {memoize} from '../libs/utils'
import {io, subscribers, timeline, callTracker} from './state'
import {scheduleState} from './schedule-state'
import {orchestrationState} from './orchestration-state'
import {createStore} from './create-store'
import {systemMonitor} from './system-monitor'
import {metricsStream} from './metrics-stream'

/*

      C.Y.R.E - M.E.T.R.I.C.S - S.T.A.T.E

      Centralized metrics state management with breathing authority:
      - Single source of truth via stores.quantum
      - Breathing system has authority over system flags
      - Clean separation: hibernating (TimeKeeper) vs recuperating (system)
      - Provides .getMetrics() API for cyre.getMetrics()
      - Pre-computed flags for hot path optimization
      - Aware of scheduleState/orchestrationState (schedule tasks and
        orchestrations), not just io/subscribers/timeline - the scheduler
        and orchestration engine each keep their own domain-level registry
        (see context/schedule-state.ts, context/orchestration-state.ts)
        alongside the shared TimeKeeper timeline, so system-wide metrics
        report their counts too instead of only knowing about raw timers

*/

// Create quantum state store - keeping original pattern
const metricsStore = createStore<MetricsState>()
metricsStore.set('quantum', defaultMetrics)

// Memoized selectors for performance
//
// `limits` is now a real parameter (was a direct BREATHING.LIMITS read)
// so this stays correct once limits are user-configurable via
// cyre.init(userConfig) - the memoize cache is keyed off every argument,
// so a config change naturally produces a fresh cache entry instead of
// silently returning a stress calculation based on stale limits for the
// same (metrics, performance) pair.
const getStressLevel = memoize(
  (
    metrics: SystemMetrics,
    performance: PerformanceMetrics,
    limits: CyreConfig['breathing']['limits']
  ): SystemStress => {
    // Calculate stress from system metrics with improved sensitivity
    const cpuStress = Math.min(1, (metrics.cpu || 0) / (limits.maxCpu * 0.7))
    const memoryStress = Math.min(
      1,
      (metrics.memory || 0) / (limits.maxMemory * 0.7)
    )
    const eventLoopStress = Math.min(
      1,
      (metrics.eventLoop || 0) / (limits.maxEventLoop * 0.7)
    )
    const callRateStress = Math.min(
      1,
      (performance.callsPerSecond || 0) / (limits.maxCallRate * 0.7)
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

// Calculate breathing rate based on stress level - `cfg` was a direct
// BREATHING.RATES/BREATHING.STRESS.CRITICAL read, now the live (possibly
// user-overridden) breathing config off QuantumState.
const calculateBreathingRate = (
  stress: number,
  cfg: CyreConfig['breathing']
): number => {
  if (stress >= cfg.stress.critical) {
    return cfg.rates.recovery
  }

  // Exponential rate adjustment based on stress
  const stressFactor = Math.exp(stress) - 1
  return Math.max(
    cfg.rates.min,
    Math.min(cfg.rates.max, cfg.rates.base * (1 + stressFactor))
  )
}

// Clamp a numeric override into a sane range instead of accepting anything
// - a stress threshold above 1 or a negative rate would silently break the
// breathing system's math elsewhere. Falls back to `fallback` (the current/
// default value) and warns rather than throwing, matching how the rest of
// this module reports problems.
const clampNumber = (
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string
): number => {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || Number.isNaN(value)) {
    sensor.warn(
      `Ignoring invalid cyre.init() config value for ${label}: ${value}`
    )
    return fallback
  }
  if (value < min || value > max) {
    sensor.warn(
      `cyre.init() config value for ${label} (${value}) outside allowed range [${min}, ${max}] - clamped`
    )
    return Math.min(max, Math.max(min, value))
  }
  return value
}

// Merge a user-supplied config over the current (already-defaulted) config,
// field by field, with light validation - never lets a malformed override
// corrupt the breathing/timing math the rest of this file depends on.
const mergeConfig = (
  current: CyreConfig,
  userConfig?: CyreUserConfig
): CyreConfig => ({
  breathing: {
    rates: {
      min: clampNumber(
        userConfig?.breathing?.rates?.min,
        current.breathing.rates.min,
        1,
        60_000,
        'breathing.rates.min'
      ),
      base: clampNumber(
        userConfig?.breathing?.rates?.base,
        current.breathing.rates.base,
        1,
        60_000,
        'breathing.rates.base'
      ),
      max: clampNumber(
        userConfig?.breathing?.rates?.max,
        current.breathing.rates.max,
        1,
        60_000,
        'breathing.rates.max'
      ),
      recovery: clampNumber(
        userConfig?.breathing?.rates?.recovery,
        current.breathing.rates.recovery,
        1,
        60_000,
        'breathing.rates.recovery'
      )
    },
    stress: {
      low: clampNumber(
        userConfig?.breathing?.stress?.low,
        current.breathing.stress.low,
        0,
        1,
        'breathing.stress.low'
      ),
      medium: clampNumber(
        userConfig?.breathing?.stress?.medium,
        current.breathing.stress.medium,
        0,
        1,
        'breathing.stress.medium'
      ),
      high: clampNumber(
        userConfig?.breathing?.stress?.high,
        current.breathing.stress.high,
        0,
        1,
        'breathing.stress.high'
      ),
      critical: clampNumber(
        userConfig?.breathing?.stress?.critical,
        current.breathing.stress.critical,
        0,
        1,
        'breathing.stress.critical'
      )
    },
    limits: {
      maxCpu: clampNumber(
        userConfig?.breathing?.limits?.maxCpu,
        current.breathing.limits.maxCpu,
        1,
        100,
        'breathing.limits.maxCpu'
      ),
      maxMemory: clampNumber(
        userConfig?.breathing?.limits?.maxMemory,
        current.breathing.limits.maxMemory,
        1,
        100,
        'breathing.limits.maxMemory'
      ),
      maxEventLoop: clampNumber(
        userConfig?.breathing?.limits?.maxEventLoop,
        current.breathing.limits.maxEventLoop,
        1,
        60_000,
        'breathing.limits.maxEventLoop'
      ),
      maxCallRate: clampNumber(
        userConfig?.breathing?.limits?.maxCallRate,
        current.breathing.limits.maxCallRate,
        1,
        1_000_000,
        'breathing.limits.maxCallRate'
      )
    }
  },
  timing: {
    recuperation: clampNumber(
      userConfig?.timing?.recuperation,
      current.timing.recuperation,
      100,
      24 * 60 * 60 * 1000,
      'timing.recuperation'
    )
  }
})

/**
 * Compute system flags based on current state
 * This is the core optimization - pre-compute all conditions
 */
const computeSystemFlags = (state: MetricsState): SystemFlags => {
  const messages: string[] = []
  const canCallMessages: string[] = []
  const canActionMessages: string[] = []
  const isOperationalMessages: string[] = []

  // PRECEDENCE ORDER: shutdown > locked > not initialized > recuperating > hibernating

  // Check if system is shutdown (highest precedence)
  if (state._shutdown) {
    canCallMessages.push('System is shutdown')
    canActionMessages.push('System is shutdown')
    isOperationalMessages.push('System is shutdown')
  }
  // Check if system is locked (only if not shutdown)
  else if (state._isLocked) {
    canActionMessages.push('System is locked')
    isOperationalMessages.push('System is locked')
  }
  // Check initialization (only if not shutdown and not locked)
  else if (!state._init) {
    canCallMessages.push('System not initialized')
    canActionMessages.push('System not initialized')
    isOperationalMessages.push('System not initialized')
  }

  // Check recuperation state (for call method) - independent of other states
  if (state.breathing.isRecuperating) {
    canCallMessages.push('System is in recuperation mode')
    isOperationalMessages.push('System is in recuperation mode')
  }

  // Check hibernation state - independent of other states
  if (state.hibernating) {
    isOperationalMessages.push('System is hibernating')
  }

  // Determine flags
  const canCall = canCallMessages.length === 0
  const canAction = canActionMessages.length === 0
  const isOperational = isOperationalMessages.length === 0

  return {
    canCall,
    canCallMessages,
    canAction,
    canActionMessages,
    isOperational,
    isOperationalMessages,
    lastComputed: Date.now()
  }
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
 * Subscription store breakdown for getMetrics().stores.
 * subscribers is keyed by channel id; multiple cyre.on() calls on the
 * same channel append handlers to one entry rather than inflating the
 * subscribed-channel count.
 */
const getSubscriptionStoreStats = () => {
  const subscriberEntries = subscribers.getAll()
  const subscribedChannels = subscriberEntries.length
  const handlers = subscriberEntries.reduce(
    (sum, entry) => sum + entry.handlers.length,
    0
  )
  const orphanedHandlers = subscriberEntries.filter(
    entry => !io.get(entry.id)
  ).length

  return {subscribedChannels, handlers, orphanedHandlers}
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
   * Update metrics state - central state updater with flag recomputation
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
      next.stress = getStressLevel(
        next.system,
        next.performance,
        next.config.breathing.limits
      )
    }

    // Recompute flags whenever state changes
    next.flags = computeSystemFlags(next)

    metricsStore.set('quantum', next)
    return next
  },

  /**
   * Pre-computed flag accessors for hot path optimization
   */
  canCall: (): {allowed: boolean; messages: string[]} => {
    const state = metricsStore.get('quantum') || defaultMetrics
    return {
      allowed: state.flags.canCall,
      messages: state.flags.canCallMessages
    }
  },

  canRegister: (): {allowed: boolean; messages: string[]} => {
    const state = metricsStore.get('quantum') || defaultMetrics
    return {
      allowed: state.flags.canAction,
      messages: state.flags.canActionMessages
    }
  },

  isOperational: (): {operational: boolean; messages: string[]} => {
    const state = metricsStore.get('quantum') || defaultMetrics
    return {
      operational: state.flags.isOperational,
      messages: state.flags.isOperationalMessages
    }
  },

  /**
   * Breathing system authority - evaluates and sets system flags
   */
  updateBreathingState: (metrics: SystemMetrics): MetricsState => {
    try {
      initializeQuantumStore()
      const current = metricsStore.get('quantum')!
      const stress = getStressLevel(
        metrics,
        current.performance,
        current.config.breathing.limits
      )
      const now = Date.now()

      // Calculate new breathing rate based on stress
      const newRate = calculateBreathingRate(
        stress.combined,
        current.config.breathing
      )

      const breathing: BreathingState = {
        ...current.breathing,
        breathCount: current.breathing.breathCount + 1,
        lastBreath: now,
        stress: stress.combined,
        currentRate: newRate,
        nextBreathDue: now + newRate,
        isRecuperating: stress.combined > current.config.breathing.stress.high,
        recuperationDepth: Math.min(1, stress.combined),
        pattern:
          stress.combined > current.config.breathing.stress.high
            ? 'RECOVERY'
            : 'NORMAL'
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
      sensor.sys('system is locked', 'app', 'system-lock')
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
   * Initialize the system - optionally accepts a user config
   * (cyre.init(userConfig)) merged over the current/default config
   * before the rest of the system (breathing, TimeKeeper) comes online,
   * so everything reads live-configured values from the first tick.
   */
  init: (userConfig?: CyreUserConfig): void => {
    try {
      initializeQuantumStore()
      const current = metricsStore.get('quantum')!
      const config = mergeConfig(current.config, userConfig)
      metricsState.update({_init: true, config})
      sensor.debug(
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
      state.stress.combined < state.config.breathing.stress.high
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
      state.stress.combined < state.config.breathing.stress.high ||
      priority === 'critical' ||
      priority === 'high'
    )
  },

  /**
   * Reset all metrics state
   */
  reset: (): void => {
    try {
      // Use update to ensure flags are recomputed
      metricsState.update({
        ...defaultMetrics,
        lastUpdate: Date.now()
      })
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
        low: state.config.breathing.stress.low,
        medium: state.config.breathing.stress.medium,
        high: state.config.breathing.stress.high,
        critical: state.config.breathing.stress.critical
      },
      rateRange: {
        min: state.config.breathing.rates.min,
        base: state.config.breathing.rates.base,
        max: state.config.breathing.rates.max,
        recovery: state.config.breathing.rates.recovery
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
          // Calls absorbed by each protection - previously invisible,
          // see app.ts's call() throttle/debounce/buffer branches
          throttleCount: channel._throttleCount || 0,
          debounceCount: channel._debounceCount || 0,
          bufferCount: channel._bufferCount || 0,
          available: true
        }
      }

      const subscriptionStats = getSubscriptionStoreStats()

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
          ...subscriptionStats,
          // Alias kept for callers that already read stores.subscribers
          subscribers: subscriptionStats.subscribedChannels,
          timeline: timeline.getAll().length,
          activeFormations: state.activeFormations,
          // scheduleState/orchestrationState are domain-level registries
          // that sit alongside the shared TimeKeeper timeline (see
          // context/schedule-state.ts, context/orchestration-state.ts) -
          // without these, system-wide metrics only ever showed raw timer
          // counts and had no idea scheduled tasks or orchestrations
          // existed at all
          scheduledTasks: scheduleState.tasks.size(),
          orchestrations: orchestrationState.runtimes.size()
        },
        flags: {
          canCall: state.flags.canCall,
          canAction: state.flags.canAction,
          isOperational: state.flags.isOperational,
          lastComputed: state.flags.lastComputed
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
            detectChanges: channel.detectChanges,
            throttleCount: channel._throttleCount || 0,
            debounceCount: channel._debounceCount || 0,
            bufferCount: channel._bufferCount || 0
          }
        }))

        // Same domain-level registries surfaced in getMetrics()'s
        // stores.scheduledTasks/orchestrations above, kept alongside the
        // channels list here since exportMetrics() is the "give me
        // everything registered" view
        result.scheduledTasks = scheduleState.tasks.size()
        result.orchestrations = orchestrationState.runtimes.size()
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
  },

  /**
   * Soft clear: Reset runtime metrics, keep init/identity/config
   *
   * `config` (the user's cyre.init(userConfig) overrides) is preserved
   * alongside _init/_isLocked/_shutdown - a soft clear() is meant to wipe
   * accumulated runtime metrics/breathing/stress state, not a deployment's
   * tuned breathing/timing settings. Only the hard reset() below drops
   * back to defaultConfig.
   */
  clear: (): void => {
    try {
      const current = metricsStore.get('quantum') || defaultMetrics
      metricsState.update({
        ...defaultMetrics,
        _init: current._init,
        _isLocked: current._isLocked,
        _shutdown: current._shutdown,
        config: current.config,
        lastUpdate: Date.now()
      })
    } catch (error) {
      sensor.critical(`Metrics clear failed: ${error}`)
      throw error
    }
  }
}

// Export type for external use
export type {MetricsState, StateKey}

// Last time performance.callsPerSecond was computed - kept as module-local
// bookkeeping (same reasoning as system-monitor.ts's own previous-sample
// fields) rather than overloading performance.lastCallTimestamp, whose
// existing meaning is "timestamp of the last individual call", not "last
// time the call-rate window was sampled".
let lastPerformanceSampleTime = Date.now()

/**
 * Update breathing system with REAL system metrics - called by the
 * breathing interval (app.ts's initializeBreathing(), once per second).
 *
 * This used to feed updateBreathingState() hardcoded cpu:0/memory:0/
 * eventLoop:0 and a fixed ~0.1 baseline stress no matter what the process
 * was actually doing, so recuperation could never trigger from real load.
 * Real readings now come from two places designed to stay cheap on the
 * call-per-call hot path:
 *  - context/system-monitor.ts samples cpu%/heap%/event-loop lag - all
 *    cheap enough to run here, once a second.
 *  - context/state.ts's callTracker is a bare counter incremented once per
 *    cyre.call() (see app.ts) and only ever read+reset here, so call-rate
 *    stress is now real without adding per-call overhead.
 */
export const updateBreathingFromMetrics = async (): Promise<void> => {
  try {
    const metrics = await systemMonitor.sample()

    const now = Date.now()
    const elapsedSeconds = Math.max(
      0.001,
      (now - lastPerformanceSampleTime) / 1000
    )
    const calls = callTracker.sampleAndReset()
    const callsPerSecond = calls / elapsedSeconds
    lastPerformanceSampleTime = now

    const current = metricsState.get()
    metricsState.update({
      performance: {
        ...current.performance,
        callsTotal: current.performance.callsTotal + calls,
        callsPerSecond,
        lastCallTimestamp:
          calls > 0 ? now : current.performance.lastCallTimestamp
      }
    })

    // Breathing has authority over system/stress/recuperation flags.
    // updateBreathingState() reads performance.callsPerSecond fresh off
    // the store, so the performance write above has to land first.
    const updated = metricsState.updateBreathingState(metrics)

    // Push side of useMetrics: no-op unless something is subscribed, so an
    // app that never watches metrics pays one integer comparison per tick.
    if (metricsStream.active()) {
      metricsStream.tick({
        t: now,
        stress: updated.stress.combined,
        cpu: metrics.cpu || 0,
        memory: metrics.memory || 0,
        eventLoop: metrics.eventLoop || 0,
        callsPerSecond,
        breathingRate: updated.breathing.currentRate,
        recuperating: updated.breathing.isRecuperating
      })
    }
  } catch (error) {
    // Don't log error every second - just use console.error
    sensor.error(`Breathing update failed: ${error}`)
  }
}
