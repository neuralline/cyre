// src/components/cyre-timekeeper.ts
// Timer system with centralized timeline and quartz engine

import type {Timer, TimerDuration, TimerRepeat} from '../types/timer'
import {TIMING} from '../config/cyre-config'
import {sensor} from '../components/sensor'
import {timeline} from '../context/state'
import {metricsState} from '../context/metrics-state'

/* 
      C.Y.R.E. - T.I.M.E.K.E.E.P.E.R.
      
      Rock-solid timer system with:
      - Centralized timeline as single source of truth
      - Quartz engine for precise execution coordination
      - Drift compensation for accuracy
      - Smart interval grouping for performance
      - Time chunking for long durations
      - Adaptive timing with breathing system
      - High precision for <50ms, standard for ≥50ms
      
      Used by: orchestration, scheduler, repeat, delay, debounce, interval
*/

// Environment detection for optimal timer strategy
const TimerEnvironment = {
  hasHrTime:
    typeof process !== 'undefined' && typeof process.hrtime === 'function',
  hasPerformance:
    typeof performance !== 'undefined' && typeof performance.now === 'function',
  hasSetImmediate: typeof setImmediate !== 'undefined',
  isNode: typeof process !== 'undefined' && process.versions?.node,
  isBrowser: typeof window !== 'undefined',
  isTest: typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
}

// High precision time measurement
const now = (): number => {
  if (TimerEnvironment.hasPerformance) {
    return performance.now()
  }
  if (TimerEnvironment.hasHrTime) {
    const [seconds, nanoseconds] = process.hrtime()
    return seconds * 1000 + nanoseconds / 1000000
  }
  return Date.now()
}

// Timeline interface to avoid circular dependency
interface TimelineInterface {
  add: (timer: Timer) => void
  get: (id: string) => Timer | undefined
  forget: (id: string) => boolean
  clear: () => void
  getAll: () => Timer[]
  getActive: () => Timer[]
}

// Metrics interface to avoid circular dependency
interface MetricsInterface {
  get: () => {
    hibernating: boolean
    stress?: {combined: number}
    breathing: {currentRate: number}
  }
  update: (update: any) => void
}

const getTimeline = (): TimelineInterface => {
  return timeline
}

const getMetricsState = (): MetricsInterface => {
  return metricsState
}

// Timer state management with immutability
const createTimerState = (timer: Timer, updates: Partial<Timer>): Timer => ({
  ...timer,
  ...updates,
  metrics: timer.metrics
    ? {
        ...timer.metrics,
        ...updates.metrics
      }
    : timer.metrics
})

// Duration conversion utility
const convertDurationToMs = (duration: TimerDuration): number => {
  return (
    (duration.days ?? 0) * 24 * 60 * 60 * 1000 +
    (duration.hours ?? 0) * 60 * 60 * 1000 +
    (duration.minutes ?? 0) * 60 * 1000 +
    (duration.seconds ?? 0) * 1000 +
    (duration.milliseconds ?? 0)
  )
}

// Precision tier calculation
const getPrecisionTier = (
  interval: number
): 'high' | 'standard' | 'chunked' => {
  if (interval < 1016) return 'high'
  if (interval > TIMING.MAX_TIMEOUT) return 'chunked'
  return 'standard'
}

// Drift compensation calculation
const calculateDriftCompensation = (
  scheduledTime: number,
  actualTime: number,
  baseInterval: number
): number => {
  const drift = actualTime - scheduledTime

  // Only compensate if drift is significant (>5% of interval)
  if (Math.abs(drift) > baseInterval * 0.05) {
    return Math.max(1, baseInterval - drift)
  }

  return baseInterval
}

// Quartz Engine - Centralized execution coordinator
const QuartzEngine = {
  // Core state
  quartzTimer: null as NodeJS.Timeout | null,
  quartzInterval: 10, // 10ms for high precision
  isRunning: false,
  lastTickTime: 0,

  // Execution groups for efficiency
  executionGroups: new Map<number, Set<string>>(),
  precisionGroups: new Map<'high' | 'standard' | 'chunked', Set<string>>(),

  // Performance metrics
  metrics: {
    totalTicks: 0,
    missedTicks: 0,
    driftCompensations: 0,
    executionErrors: 0
  },

  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.lastTickTime = now()

    // Use setImmediate for Node.js high precision
    if (TimerEnvironment.isNode && TimerEnvironment.hasSetImmediate) {
      const tick = () => {
        if (this.isRunning) {
          this.tick()
          setImmediate(tick)
        }
      }
      setImmediate(tick)
    } else {
      // Fallback to setInterval for browsers
      this.quartzTimer = setInterval(() => this.tick(), this.quartzInterval)
    }
  },

  stop(): void {
    this.isRunning = false

    if (this.quartzTimer) {
      clearInterval(this.quartzTimer)
      this.quartzTimer = null
    }

    this.executionGroups.clear()
    this.precisionGroups.clear()

    sensor.info('quartz', 'Quartz engine stopped')
  },

  tick(): void {
    const tickStart = now()
    const currentTime = Date.now()
    const systemState = getMetricsState().get()

    // Skip if hibernating
    if (systemState.hibernating) return

    this.metrics.totalTicks++

    // Track tick timing for drift detection
    if (this.lastTickTime > 0) {
      const tickInterval = tickStart - this.lastTickTime
      if (tickInterval > this.quartzInterval * 2) {
        this.metrics.missedTicks++
      }
    }
    this.lastTickTime = tickStart

    // Get formations by precision tier for optimal execution order
    const timeline = getTimeline()
    const activeFormations = timeline.getActive()

    // Group by precision tier
    const highPrecision: Timer[] = []
    const standardPrecision: Timer[] = []

    for (const formation of activeFormations) {
      if (currentTime >= formation.nextExecutionTime) {
        const tier = getPrecisionTier(formation.duration)
        if (tier === 'high') {
          highPrecision.push(formation)
        } else {
          standardPrecision.push(formation)
        }
      }
    }

    // Execute high precision first
    for (const formation of highPrecision) {
      this.executeFormation(formation, currentTime)
    }

    // Then standard precision
    for (const formation of standardPrecision) {
      this.executeFormation(formation, currentTime)
    }
  },

  async executeFormation(formation: Timer, currentTime: number): Promise<void> {
    const executionStart = now()

    try {
      // Calculate drift
      const drift = currentTime - formation.nextExecutionTime

      // Execute callback
      await Promise.resolve(formation.callback())

      const executionDuration = now() - executionStart

      // Update formation state immutably
      const updatedFormation = createTimerState(formation, {
        executionCount: formation.executionCount + 1,
        lastExecutionTime: currentTime,
        hasExecutedOnce: true,
        delay: undefined, // Clear delay after first execution
        repeat:
          typeof formation.repeat === 'number' && formation.repeat > 0
            ? formation.repeat - 1
            : formation.repeat
      })

      // Update metrics
      if (updatedFormation.metrics) {
        updatedFormation.metrics.totalExecutions++
        updatedFormation.metrics.successfulExecutions++
        updatedFormation.metrics.lastExecutionTime = executionDuration
        updatedFormation.metrics.averageExecutionTime =
          (updatedFormation.metrics.averageExecutionTime *
            (updatedFormation.metrics.totalExecutions - 1) +
            executionDuration) /
          updatedFormation.metrics.totalExecutions

        if (executionDuration > updatedFormation.metrics.longestExecutionTime) {
          updatedFormation.metrics.longestExecutionTime = executionDuration
        }
        if (
          executionDuration < updatedFormation.metrics.shortestExecutionTime
        ) {
          updatedFormation.metrics.shortestExecutionTime = executionDuration
        }
      }

      // Save updated state
      getTimeline().add(updatedFormation)

      // Schedule next execution if needed
      if (this.shouldContinue(updatedFormation)) {
        this.scheduleNext(updatedFormation, currentTime, drift)
      } else {
        // Formation completed
        this.removeFromGroups(updatedFormation)
        getTimeline().forget(updatedFormation.id)
      }
    } catch (error) {
      this.metrics.executionErrors++

      sensor.error(formation.id, String(error), 'timer-execution')

      // Update failure metrics
      if (formation.metrics) {
        formation.metrics.failedExecutions++
      }

      // Continue with repeat logic even on error
      if (this.shouldContinue(formation)) {
        this.scheduleNext(formation, currentTime, 0)
      } else {
        this.removeFromGroups(formation)
        getTimeline().forget(formation.id)
      }
    }
  },

  shouldContinue(formation: Timer): boolean {
    return (
      formation.repeat === true ||
      formation.repeat === Infinity ||
      (typeof formation.repeat === 'number' && formation.repeat > 0)
    )
  },

  scheduleNext(
    formation: Timer,
    currentTime: number,
    previousDrift: number
  ): void {
    const systemState = getMetricsState().get()
    const stressFactor = 1 + (systemState.stress?.combined || 0) * 0.1

    // Determine base interval
    let baseInterval: number
    if (!formation.hasExecutedOnce && formation.delay !== undefined) {
      baseInterval = formation.delay
    } else {
      baseInterval = formation.interval || formation.originalDuration
    }

    // Apply drift compensation for precision
    if (
      Math.abs(previousDrift) > 5 &&
      getPrecisionTier(baseInterval) === 'high'
    ) {
      baseInterval = calculateDriftCompensation(
        formation.nextExecutionTime,
        currentTime,
        baseInterval
      )
      this.metrics.driftCompensations++
    }

    // Apply stress adaptation
    const adaptedInterval = Math.max(1, Math.floor(baseInterval * stressFactor))

    // Handle chunking for long durations
    let isInRecuperation = false
    let finalInterval = adaptedInterval

    if (adaptedInterval > TIMING.MAX_TIMEOUT) {
      isInRecuperation = true
      finalInterval = TIMING.RECUPERATION
    }

    // Calculate next execution time
    const nextExecutionTime = currentTime + finalInterval

    // Update formation state
    const updatedFormation = createTimerState(formation, {
      nextExecutionTime,
      duration: finalInterval,
      isInRecuperation
    })

    // Update groups
    this.addToGroups(updatedFormation)

    // Save to timeline
    getTimeline().add(updatedFormation)

    // sensor.debug(updatedFormation.id, 'Next execution scheduled')
  },

  addToGroups(formation: Timer): void {
    // Add to interval group
    const groupKey = Math.round(formation.duration / 10) * 10
    if (!this.executionGroups.has(groupKey)) {
      this.executionGroups.set(groupKey, new Set())
    }
    this.executionGroups.get(groupKey)!.add(formation.id)

    // Add to precision group
    const tier = getPrecisionTier(formation.duration)
    if (!this.precisionGroups.has(tier)) {
      this.precisionGroups.set(tier, new Set())
    }
    this.precisionGroups.get(tier)!.add(formation.id)
  },

  removeFromGroups(formation: Timer): void {
    // Remove from interval groups
    for (const [, group] of this.executionGroups) {
      group.delete(formation.id)
    }

    // Remove from precision groups
    for (const [, group] of this.precisionGroups) {
      group.delete(formation.id)
    }
  }
}

// Formation creation
const createFormation = (
  id: string,
  interval: number,
  callback: () => void | Promise<void>,
  repeat?: TimerRepeat,
  delay?: number
): Timer => {
  const currentTime = Date.now()
  const systemState = getMetricsState().get()
  const stressFactor = 1 + (systemState.stress?.combined || 0) * 0.1

  const initialDuration = delay !== undefined ? delay : interval
  const adaptedDuration = Math.floor(initialDuration * stressFactor)
  const tier = getPrecisionTier(adaptedDuration)

  const formation: Timer = {
    id,
    startTime: currentTime,
    duration: adaptedDuration,
    originalDuration: interval,
    callback,
    repeat,
    executionCount: 0,
    lastExecutionTime: 0,
    nextExecutionTime: currentTime + adaptedDuration,
    isInRecuperation: tier === 'chunked',
    status: 'active',
    isActive: true,
    delay,
    interval,
    hasExecutedOnce: false
  }

  return formation
}

// Result type for functional error handling
export type Result<T, E = Error> =
  | {ok: 'ok'; value: T}
  | {ok: 'error'; error: E}

// Main TimeKeeper API
export const TimeKeeper = {
  keep: (
    interval: number | TimerDuration,
    callback: () => Promise<any>,
    repeat?: TimerRepeat,
    id: string = `timer-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`,
    delay?: number
  ): Result<Timer, Error> => {
    try {
      // Validate inputs
      const intervalMs =
        typeof interval === 'number' ? interval : convertDurationToMs(interval)

      if (interval !== undefined && intervalMs < 0) {
        throw new Error('Interval cannot be negative')
      }
      if (delay !== undefined && delay < 0) {
        throw new Error('Delay cannot be negative')
      }
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function')
      }

      const timeline = getTimeline()

      // Remove existing timer with same ID
      timeline.forget(id)

      // Create new formation
      const formation = createFormation(id, intervalMs, callback, repeat, delay)

      // Add to timeline
      timeline.add(formation)

      // Add to execution groups
      QuartzEngine.addToGroups(formation)

      // Start quartz if not running
      if (!QuartzEngine.isRunning) {
        QuartzEngine.start()
      }

      return {ok: 'ok', value: formation}
    } catch (error) {
      sensor.error(id, String(error), 'TimeKeeper/Keep')
      return {
        ok: 'error',
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  },

  wait: (
    duration: number,
    id: string = `wait-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  ): Promise<void> => {
    if (duration <= 0) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const result = TimeKeeper.keep(
        duration,
        async () => {
          TimeKeeper.forget(id)
          resolve()
          return undefined // ✅ Explicit return for consistency
        },
        1,
        id
      )

      if (result.ok === 'error') {
        reject(result.error)
      }
    })
  },

  forget: (id: string): void => {
    const timeline = getTimeline()
    const formation = timeline.get(id)

    if (formation) {
      QuartzEngine.removeFromGroups(formation)
      timeline.forget(id)
    }
  },

  pause: (id?: string): void => {
    const timeline = getTimeline()

    if (id) {
      const formation = timeline.get(id)
      if (formation) {
        const updated = createTimerState(formation, {
          status: 'paused',
          isActive: false
        })
        timeline.add(updated)
        QuartzEngine.removeFromGroups(updated)
        sensor.debug(id, 'Timer paused')
      }
    } else {
      // Pause all
      timeline.getAll().forEach(formation => {
        const updated = createTimerState(formation, {
          status: 'paused',
          isActive: false
        })
        timeline.add(updated)
        QuartzEngine.removeFromGroups(updated)
      })
      sensor.debug('system', 'All timers paused')
    }
  },

  resume: (id?: string): void => {
    const timeline = getTimeline()
    const systemState = getMetricsState().get()

    if (systemState.hibernating) {
      sensor.warn('Cannot resume timers while hibernating')
      return
    }

    if (id) {
      const formation = timeline.get(id)
      if (formation && formation.status === 'paused') {
        const updated = createTimerState(formation, {
          status: 'active',
          isActive: true
        })
        timeline.add(updated)
        QuartzEngine.scheduleNext(updated, Date.now(), 0)

        if (!QuartzEngine.isRunning) {
          QuartzEngine.start()
        }

        sensor.debug(id, 'Timer resumed')
      }
    } else {
      // Resume all
      const formations = timeline.getAll()
      formations.forEach(formation => {
        if (formation.status === 'paused') {
          const updated = createTimerState(formation, {
            status: 'active',
            isActive: true
          })
          timeline.add(updated)
          QuartzEngine.scheduleNext(updated, Date.now(), 0)
        }
      })

      if (!QuartzEngine.isRunning && timeline.getActive().length > 0) {
        QuartzEngine.start()
      }

      sensor.debug('system', 'All timers resumed')
    }
  },

  hibernate: (): void => {
    sensor.debug('TimeKeeper entering hibernation')

    // Stop quartz first
    QuartzEngine.stop()

    // Clear timeline
    getTimeline().clear()

    // Update metrics state
    getMetricsState().update({hibernating: true})

    sensor.info('system', 'TimeKeeper hibernated')
  },

  reset: (): void => {
    // Stop quartz
    QuartzEngine.stop()

    // Clear timeline
    getTimeline().clear()

    // Reset hibernation state
    getMetricsState().update({hibernating: false})

    // Reset quartz metrics
    QuartzEngine.metrics = {
      totalTicks: 0,
      missedTicks: 0,
      driftCompensations: 0,
      executionErrors: 0
    }

    sensor.info('system', 'TimeKeeper reset complete')
  },

  status: () => {
    const timeline = getTimeline()
    const formations = timeline.getAll()
    const activeFormations = timeline.getActive()
    const systemState = getMetricsState().get()

    return {
      activeFormations: activeFormations.length,
      totalFormations: formations.length,
      inRecuperation: formations.some(f => f.isInRecuperation),
      hibernating: systemState.hibernating,
      quartzRunning: QuartzEngine.isRunning,
      executionGroups: QuartzEngine.executionGroups.size,
      formations,
      environment: TimerEnvironment,
      quartzMetrics: QuartzEngine.metrics,

      // Group statistics
      groupStats: Array.from(QuartzEngine.executionGroups.entries()).map(
        ([interval, ids]) => ({
          interval,
          timerCount: ids.size,
          timerIds: Array.from(ids)
        })
      ),

      // Precision tier breakdown
      precisionTiers: {
        high: QuartzEngine.precisionGroups.get('high')?.size || 0,
        standard: QuartzEngine.precisionGroups.get('standard')?.size || 0,
        chunked: QuartzEngine.precisionGroups.get('chunked')?.size || 0
      }
    }
  }
}

export default TimeKeeper
