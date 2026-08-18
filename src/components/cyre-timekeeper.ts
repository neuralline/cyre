// src/components/cyre-timekeeper.ts
// Timer system with centralized timeline and quartz engine

import type {Timer, TimerDuration, TimerRepeat} from '../types/timer'
import {TIMING} from '../config/cyre-config'
import {sensor} from '../components/sensor'
import {timeline} from '../context/state'
import {metricsState} from '../context/metrics-state'

/*
      C.Y.R.E. - T.I.M.E.K.E.E.P.E.R.

      Rock-solid timer system, built for Node servers:
      - Centralized timeline as single source of truth
      - Quartz engine: tight-loop polling while fast-recurring timers are
        active, adaptive sleep otherwise - efficient by default
      - Drift compensation for accuracy
      - Interval + precision grouping for fast lookups
      - Bounded sleep windows so very large intervals just take a few
        extra wake-ups instead of overflowing setTimeout or busy-polling
      - Stress-aware: system load stretches both timer intervals and the
        engine's own polling cadence (via metricsState)
      - Hibernation is decided by metricsState - quartz only obeys the flag
      - High precision below HIGH_PRECISION_THRESHOLD ms, standard above
      - Recompute-aware: a timer can carry a recompute(from) function
        (see Timer['recompute'] in types/timer.ts) so calendar-based
        recurrence (cron/time-of-day, owned by cyre-calendar.ts and used by
        cyre-schedule.ts/orchestration-engine.ts) reschedules by asking for
        the next absolute occurrence instead of doing interval math - this
        is what makes both the normal post-execution reschedule AND
        TimeKeeper.resume() (after a pause) correctly recalculate a
        calendar timer's next fire time, in one place, rather than each
        caller hand-rolling its own re-arm logic on top of TimeKeeper.

      Used by: orchestration, scheduler, repeat, delay, debounce, interval
*/

// Environment detection - Node server focus
const TimerEnvironment = {
  hasHrTime:
    typeof process !== 'undefined' && typeof process.hrtime === 'function',
  hasPerformance:
    typeof performance !== 'undefined' && typeof performance.now === 'function',
  isNode: typeof process !== 'undefined' && !!process.versions?.node,
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

// Below this, a timer is treated as fast-recurring and gets tight-loop polling
const HIGH_PRECISION_THRESHOLD = 1016 // ms

// Poll bounds for the adaptive sleep - keeps the engine efficient (never
// busy-polls) while guaranteeing very large intervals never overflow
// setTimeout and are still checked on a bounded cadence
const QUARTZ_MIN_POLL = 10 // ms
const QUARTZ_MAX_POLL = TIMING.RECUPERATION // ms

// Precision tier calculation
const getPrecisionTier = (interval: number): 'high' | 'standard' =>
  interval < HIGH_PRECISION_THRESHOLD ? 'high' : 'standard'

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
  quartzHandle: null as NodeJS.Immediate | NodeJS.Timeout | null,
  isImmediateMode: false,
  lastScheduledDelay: 0,
  isRunning: false,
  lastTickTime: 0,

  // Timers currently mid-execution - prevents an overlapping tick from
  // re-entering a timer whose async callback hasn't settled yet
  dispatching: new Set<string>(),

  // Execution groups for efficiency
  executionGroups: new Map<number, Set<string>>(),
  precisionGroups: new Map<'high' | 'standard', Set<string>>(),

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
    this.scheduleTick(0)
  },

  stop(): void {
    this.isRunning = false

    if (this.quartzHandle) {
      if (this.isImmediateMode)
        clearImmediate(this.quartzHandle as NodeJS.Immediate)
      else clearTimeout(this.quartzHandle as NodeJS.Timeout)
      this.quartzHandle = null
    }

    this.executionGroups.clear()
    this.precisionGroups.clear()
    this.dispatching.clear()

    sensor.info('quartz', 'Quartz engine stopped')
  },

  // Schedules the next tick. delay <= 0 uses a tight setImmediate loop
  // (needed for sub-ms accuracy on fast-recurring timers); anything else
  // sleeps via setTimeout so the engine isn't spinning for no reason.
  scheduleTick(delay: number): void {
    if (!this.isRunning) return

    this.lastScheduledDelay = delay

    if (delay <= 0) {
      this.isImmediateMode = true
      this.quartzHandle = setImmediate(() => this.tick())
    } else {
      this.isImmediateMode = false
      this.quartzHandle = setTimeout(() => this.tick(), delay)
    }
  },

  // Cancels whatever's currently scheduled and rechecks promptly. Called
  // whenever a timer settles (added, resumed, or finished executing) so it
  // never sits stuck behind a long idle sleep that was scheduled before it.
  wake(): void {
    if (!this.isRunning) return

    if (this.quartzHandle) {
      if (this.isImmediateMode)
        clearImmediate(this.quartzHandle as NodeJS.Immediate)
      else clearTimeout(this.quartzHandle as NodeJS.Timeout)
    }

    this.scheduleTick(0)
  },

  tick(): void {
    if (!this.isRunning) return

    const tickStart = now()
    const currentTime = Date.now()
    const systemState = getMetricsState().get()

    this.metrics.totalTicks++

    // Track tick timing against what we actually asked for, not a fixed
    // constant - the poll cadence is intentionally variable now
    if (this.lastTickTime > 0) {
      const actualGap = tickStart - this.lastTickTime
      if (actualGap > this.lastScheduledDelay + QUARTZ_MIN_POLL * 2) {
        this.metrics.missedTicks++
      }
    }
    this.lastTickTime = tickStart

    // Hibernation is a system-level decision made by metricsState - quartz
    // just obeys the flag rather than deciding shutdown itself
    if (systemState.hibernating) {
      this.scheduleTick(QUARTZ_MAX_POLL)
      return
    }

    const timeline = getTimeline()
    const activeTimers = timeline.getActive()

    // Group by precision tier for optimal execution order
    const highPrecision: Timer[] = []
    const standardPrecision: Timer[] = []
    let earliestNextExecution = Infinity

    for (const timer of activeTimers) {
      // Already executing (slow async callback) - don't re-enter it
      if (this.dispatching.has(timer.id)) continue

      if (currentTime >= timer.nextExecutionTime) {
        const tier = getPrecisionTier(timer.duration)
        if (tier === 'high') {
          highPrecision.push(timer)
        } else {
          standardPrecision.push(timer)
        }
      } else if (timer.nextExecutionTime < earliestNextExecution) {
        earliestNextExecution = timer.nextExecutionTime
      }
    }

    // Execute high precision first
    for (const timer of highPrecision) {
      this.executeTimer(timer, currentTime)
    }

    // Then standard precision
    for (const timer of standardPrecision) {
      this.executeTimer(timer, currentTime)
    }

    this.scheduleNextTick(systemState, earliestNextExecution)
  },

  // Decides how soon to check again: tight loop while a fast-recurring
  // timer is active, otherwise sleep until the nearest due timer (bounded
  // so it stays efficient and responsive to newly added work).
  scheduleNextTick(
    systemState: ReturnType<MetricsInterface['get']>,
    earliestNextExecution: number
  ): void {
    const hasHighPrecisionActive =
      (this.precisionGroups.get('high')?.size || 0) > 0

    if (hasHighPrecisionActive) {
      this.scheduleTick(0)
      return
    }

    if (earliestNextExecution === Infinity) {
      // Nothing scheduled - poll less often the more stressed the system is
      const idleStressFactor = 1 + (systemState.stress?.combined || 0)
      this.scheduleTick(QUARTZ_MAX_POLL * idleStressFactor)
      return
    }

    const rawDelay = earliestNextExecution - Date.now()
    const boundedDelay = Math.min(
      Math.max(rawDelay, QUARTZ_MIN_POLL),
      QUARTZ_MAX_POLL
    )
    this.scheduleTick(boundedDelay)
  },

  async executeTimer(timer: Timer, currentTime: number): Promise<void> {
    this.dispatching.add(timer.id)
    const executionStart = now()

    try {
      // Calculate drift
      const drift = currentTime - timer.nextExecutionTime

      // Execute callback
      await Promise.resolve(timer.callback())

      const executionDuration = now() - executionStart

      // Update timer state immutably
      const updatedTimer = createTimerState(timer, {
        executionCount: timer.executionCount + 1,
        lastExecutionTime: currentTime,
        hasExecutedOnce: true,
        delay: undefined, // Clear delay after first execution
        repeat:
          typeof timer.repeat === 'number' && timer.repeat > 0
            ? timer.repeat - 1
            : timer.repeat
      })

      // Update metrics
      if (updatedTimer.metrics) {
        updatedTimer.metrics.totalExecutions++
        updatedTimer.metrics.successfulExecutions++
        updatedTimer.metrics.lastExecutionTime = executionDuration
        updatedTimer.metrics.averageExecutionTime =
          (updatedTimer.metrics.averageExecutionTime *
            (updatedTimer.metrics.totalExecutions - 1) +
            executionDuration) /
          updatedTimer.metrics.totalExecutions

        if (executionDuration > updatedTimer.metrics.longestExecutionTime) {
          updatedTimer.metrics.longestExecutionTime = executionDuration
        }
        if (executionDuration < updatedTimer.metrics.shortestExecutionTime) {
          updatedTimer.metrics.shortestExecutionTime = executionDuration
        }
      }

      // Save updated state
      getTimeline().add(updatedTimer)

      // Schedule next execution if needed
      if (this.shouldContinue(updatedTimer)) {
        this.scheduleNext(updatedTimer, currentTime, drift)
      } else {
        // Timer completed
        this.removeFromGroups(updatedTimer)
        getTimeline().forget(updatedTimer.id)
      }
    } catch (error) {
      this.metrics.executionErrors++

      // TimeKeeper isn't the error handler - it reports and moves on.
      // metricsState's existing stress adaptation is what actually slows
      // a struggling timer down; no separate backoff logic lives here.
      sensor.error(timer.id, String(error), 'timer-execution')

      // Immutable update, mirroring the success path - a plain object
      // spread, not a mutation of the copy still sitting in the timeline
      const updatedTimer = createTimerState(timer, {})
      if (updatedTimer.metrics) {
        updatedTimer.metrics.failedExecutions++
      }

      getTimeline().add(updatedTimer)

      // Continue with repeat logic even on error
      if (this.shouldContinue(updatedTimer)) {
        this.scheduleNext(updatedTimer, currentTime, 0)
      } else {
        this.removeFromGroups(updatedTimer)
        getTimeline().forget(updatedTimer.id)
      }
    } finally {
      this.dispatching.delete(timer.id)
      // Make sure the fresh reschedule (or removal) above isn't left
      // waiting behind a sleep that was computed before it happened
      this.wake()
    }
  },

  shouldContinue(timer: Timer): boolean {
    return (
      timer.repeat === true ||
      timer.repeat === Infinity ||
      (typeof timer.repeat === 'number' && timer.repeat > 0)
    )
  },

  scheduleNext(timer: Timer, currentTime: number, previousDrift: number): void {
    // Recompute-based rescheduling - calendar/cron triggers (see
    // Timer['recompute'] in types/timer.ts). This is an absolute
    // wall-clock instant computed fresh from `currentTime`, not a relative
    // interval, so none of the drift-compensation/stress-stretching logic
    // below applies - that machinery exists to correct or adapt a
    // RELATIVE interval, and recompute() already accounts for however
    // much time has actually passed (including a pause/resume gap, since
    // TimeKeeper.resume() also funnels through this same function).
    if (timer.recompute) {
      const nextExecutionTime = timer.recompute(currentTime)

      if (nextExecutionTime === undefined) {
        // No future occurrence (a one-off calendar date already fired, or
        // a cron search exhausted its lookahead window) - stop exactly
        // like a timer whose repeat count hit zero would.
        this.removeFromGroups(timer)
        getTimeline().forget(timer.id)
        return
      }

      const updatedTimer = createTimerState(timer, {
        nextExecutionTime,
        duration: Math.max(1, nextExecutionTime - currentTime),
        isInRecuperation: nextExecutionTime - currentTime > QUARTZ_MAX_POLL
      })

      this.addToGroups(updatedTimer)
      getTimeline().add(updatedTimer)
      return
    }

    const systemState = getMetricsState().get()
    const stressFactor = 1 + (systemState.stress?.combined || 0) * 0.1

    // Determine base interval
    let baseInterval: number
    if (!timer.hasExecutedOnce && timer.delay !== undefined) {
      baseInterval = timer.delay
    } else {
      baseInterval = timer.interval || timer.originalDuration
    }

    // Apply drift compensation for precision
    if (
      Math.abs(previousDrift) > 5 &&
      getPrecisionTier(baseInterval) === 'high'
    ) {
      baseInterval = calculateDriftCompensation(
        timer.nextExecutionTime,
        currentTime,
        baseInterval
      )
      this.metrics.driftCompensations++
    }

    // Apply stress adaptation
    const adaptedInterval = Math.max(1, Math.floor(baseInterval * stressFactor))
    const nextExecutionTime = currentTime + adaptedInterval

    // Update timer state - isInRecuperation is purely informational here:
    // the engine's own bounded polling (QUARTZ_MAX_POLL) is what actually
    // keeps very large intervals safe, regardless of this flag
    const updatedTimer = createTimerState(timer, {
      nextExecutionTime,
      duration: adaptedInterval,
      isInRecuperation: adaptedInterval > QUARTZ_MAX_POLL
    })

    // Update groups
    this.addToGroups(updatedTimer)

    // Save to timeline
    getTimeline().add(updatedTimer)

    // sensor.debug(updatedTimer.id, 'Next execution scheduled')
  },

  addToGroups(timer: Timer): void {
    // Clear any stale membership first (e.g. tier changed after a stress
    // reschedule) so a timer never lingers in the wrong bucket
    this.removeFromGroups(timer)

    // Add to interval group
    const groupKey = Math.round(timer.duration / 10) * 10
    if (!this.executionGroups.has(groupKey)) {
      this.executionGroups.set(groupKey, new Set())
    }
    this.executionGroups.get(groupKey)!.add(timer.id)

    // Add to precision group
    const tier = getPrecisionTier(timer.duration)
    if (!this.precisionGroups.has(tier)) {
      this.precisionGroups.set(tier, new Set())
    }
    this.precisionGroups.get(tier)!.add(timer.id)
  },

  removeFromGroups(timer: Timer): void {
    // Remove from interval groups
    for (const [, group] of this.executionGroups) {
      group.delete(timer.id)
    }

    // Remove from precision groups
    for (const [, group] of this.precisionGroups) {
      group.delete(timer.id)
    }
  }
}

// Timer creation
const createTimer = (
  id: string,
  interval: number,
  callback: () => void | Promise<void>,
  repeat?: TimerRepeat,
  delay?: number,
  recompute?: (from: number) => number | undefined
): Timer => {
  const currentTime = Date.now()
  const systemState = getMetricsState().get()
  const stressFactor = 1 + (systemState.stress?.combined || 0) * 0.1

  const initialDuration = delay !== undefined ? delay : interval
  const adaptedDuration = Math.max(
    1,
    Math.floor(initialDuration * stressFactor)
  )

  const timer: Timer = {
    id,
    startTime: currentTime,
    duration: adaptedDuration,
    originalDuration: interval,
    callback,
    repeat,
    executionCount: 0,
    lastExecutionTime: 0,
    nextExecutionTime: currentTime + adaptedDuration,
    isInRecuperation: adaptedDuration > QUARTZ_MAX_POLL,
    status: 'active',
    isActive: true,
    delay,
    interval,
    hasExecutedOnce: false,
    recompute
  }

  return timer
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
    delay?: number,
    // Calendar-based recurrence hook - see Timer['recompute'] in
    // types/timer.ts. When set, every reschedule (both the normal
    // post-execution path and a resume() after pause()) calls
    // recompute(currentTime) for the next absolute fire time instead of
    // adding a fixed interval.
    recompute?: (from: number) => number | undefined
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

      // Create new timer
      const timer = createTimer(
        id,
        intervalMs,
        callback,
        repeat,
        delay,
        recompute
      )

      // Add to timeline
      timeline.add(timer)

      // Add to execution groups
      QuartzEngine.addToGroups(timer)

      // Start quartz if not running, otherwise make sure this timer isn't
      // stuck behind a sleep that was scheduled before it existed
      if (!QuartzEngine.isRunning) {
        QuartzEngine.start()
      } else {
        QuartzEngine.wake()
      }

      return {ok: 'ok', value: timer}
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
    const timer = timeline.get(id)

    if (timer) {
      QuartzEngine.removeFromGroups(timer)
      timeline.forget(id)
    }
  },

  pause: (id?: string): void => {
    const timeline = getTimeline()

    if (id) {
      const timer = timeline.get(id)
      if (timer) {
        const updated = createTimerState(timer, {
          status: 'paused',
          isActive: false
        })
        timeline.add(updated)
        QuartzEngine.removeFromGroups(updated)
        sensor.debug(id, 'Timer paused')
      }
    } else {
      // Pause all
      timeline.getAll().forEach(timer => {
        const updated = createTimerState(timer, {
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
      const timer = timeline.get(id)
      if (timer && timer.status === 'paused') {
        const updated = createTimerState(timer, {
          status: 'active',
          isActive: true
        })
        timeline.add(updated)
        // scheduleNext() itself checks updated.recompute - a calendar
        // timer paused, say, three days ago correctly recalculates its
        // next occurrence from Date.now() here rather than resuming on
        // whatever interval it happened to be armed with pre-pause.
        QuartzEngine.scheduleNext(updated, Date.now(), 0)

        if (!QuartzEngine.isRunning) {
          QuartzEngine.start()
        } else {
          QuartzEngine.wake()
        }

        sensor.debug(id, 'Timer resumed')
      }
    } else {
      // Resume all
      const timers = timeline.getAll()
      timers.forEach(timer => {
        if (timer.status === 'paused') {
          const updated = createTimerState(timer, {
            status: 'active',
            isActive: true
          })
          timeline.add(updated)
          QuartzEngine.scheduleNext(updated, Date.now(), 0)
        }
      })

      if (!QuartzEngine.isRunning && timeline.getActive().length > 0) {
        QuartzEngine.start()
      } else if (QuartzEngine.isRunning) {
        QuartzEngine.wake()
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
    const timers = timeline.getAll()
    const activeTimers = timeline.getActive()
    const systemState = getMetricsState().get()

    return {
      activeFormations: activeTimers.length,
      totalFormations: timers.length,
      inRecuperation: timers.some(t => t.isInRecuperation),
      hibernating: systemState.hibernating,
      quartzRunning: QuartzEngine.isRunning,
      executionGroups: QuartzEngine.executionGroups.size,
      formations: timers,
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
        standard: QuartzEngine.precisionGroups.get('standard')?.size || 0
      }
    }
  }
}

export default TimeKeeper
