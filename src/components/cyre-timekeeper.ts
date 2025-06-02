// src/components/cyre-timekeeper.ts
import type {Timer, TimerDuration, TimerRepeat} from '../types/timer'
import {TIMING} from '../config/cyre-config'
import {log} from './cyre-log'
import {metricsState, Result} from '../context/metrics-state'
import {timeline} from '../context/state'

/* 
      C.Y.R.E. - T.I.M.E.K.E.E.P.E.R.
      Q0.0U0.0A0.0N0.0T0.0U0.0M0

      
      Repeat logic and execution handling

      Cyre Interval, Delay, Repeat Logic

      Interval Actions:
      First execution WAITS for the interval, then repeats 
      Aligns with setInterval behavior that developers expect

      Delay Actions:
      First execution WAITS for delay
      overwrites interval for initial execution waiting time
     
      Repeat Handling:
      repeat specifies TOTAL number of executions 
      repeat: 3 = Execute exactly 3 times total
      Proper decrementing to avoid infinite loops

      Combined Delay and Interval:
      Delay applies first, then interval timing for subsequent executions
      No immediate executions for interval or delay actions

      Edge Cases:
      { repeat: 0 } = Do not execute at all. 
      { repeat: 1, interval: 1000 } = Wait 1000ms, execute once, done.
      { delay: 0 } = wait 0ms then execute.
      
      1. Always replace existing timekeeper for same action ID
      2. Delay handling: delay for first execution, interval for subsequent
      3. delay = 0 executes immediately, then uses interval
      4. After first execution, delay becomes undefined, interval takes over
      5. Proper metrics integration
      6. Maintains all existing timekeeper functionality

      Logic:
      - { delay: 500, interval: 1000, repeat: 3 }
        → Wait 500ms → Execute → Wait 1000ms → Execute → Wait 1000ms → Execute
      - { delay: 0, interval: 1000, repeat: 3 }  
        → Execute immediately → Wait 1000ms → Execute → Wait 1000ms → Execute
      - { interval: 1000, repeat: 3 } (no delay)
        → Wait 1000ms → Execute → Wait 1000ms → Execute → Wait 1000ms → Execute


      Redesigned with:
      - Single _quartz timer source for all timing operations
      - Delay & Interval handling: delay controls first execution, interval for subsequent
      - Timer precision tiers based on duration
      - Cross-platform compatibility (browser/Node.js)
      - Better memory and race condition management
      - Enhanced long duration optimization with chunking

      API: keep(interval, callback, repeat?, id?, delay?) => Result<Timer, Error>
      
      Timing Logic:
      - delay parameter controls first execution timing
      - interval parameter controls subsequent execution timing  
      - Combined: {delay: 500, interval: 1000, repeat: 3} 
        → Wait 500ms → Execute → Wait 1000ms → Execute → Wait 1000ms → Execute
*/

// Timer precision tiers for optimal performance
enum PrecisionTier {
  HIGH = 'high', // < 50ms - setImmediate/hrtime precision
  MEDIUM = 'medium', // < 1s - setTimeout precision
  LOW = 'low', // < 1min - setInterval precision
  CHUNKED = 'chunked' // > 1min - chunked execution
}

// Cross-platform timer detection
const TimerEnvironment = {
  hasHrTime:
    typeof process !== 'undefined' && typeof process.hrtime === 'function',
  hasPerformance:
    typeof performance !== 'undefined' && typeof performance.now === 'function',
  hasSetImmediate: typeof setImmediate !== 'undefined',
  isTest: typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
}

// Single unified timer source - _quartz
const _quartz = {
  activeTimers: new Map<
    string,
    {
      timeoutId: NodeJS.Timeout | number
      startTime: number
      executionId: string
      isExecuting: boolean
      cleanup?: () => void
    }
  >(),

  // Precision timer factory based on duration
  createTimer: (
    callback: () => void,
    duration: number,
    id: string
  ): NodeJS.Timeout | number => {
    const tier = _quartz.getPrecisionTier(duration)
    const executionId = `${id}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`

    // Prevent race conditions - cleanup existing timer first
    _quartz.clearTimer(id)

    const wrappedCallback = () => {
      const timerData = _quartz.activeTimers.get(id)
      if (
        !timerData ||
        timerData.executionId !== executionId ||
        timerData.isExecuting
      ) {
        return // Prevent duplicate execution
      }

      timerData.isExecuting = true
      _quartz.activeTimers.set(id, timerData)

      try {
        callback()
      } finally {
        const currentTimer = _quartz.activeTimers.get(id)
        if (currentTimer && currentTimer.executionId === executionId) {
          currentTimer.isExecuting = false
          _quartz.activeTimers.set(id, currentTimer)
        }
      }
    }

    let timeoutId: NodeJS.Timeout | number

    // In test environment, use setTimeout with actual duration
    if (TimerEnvironment.isTest) {
      timeoutId = setTimeout(wrappedCallback, duration)
    } else {
      switch (tier) {
        case PrecisionTier.HIGH:
          timeoutId = _quartz.createHighPrecisionTimer(
            wrappedCallback,
            duration
          )
          break
        case PrecisionTier.CHUNKED:
          timeoutId = _quartz.createChunkedTimer(wrappedCallback, duration, id)
          break
        default:
          timeoutId = _quartz.createMediumPrecisionTimer(
            wrappedCallback,
            duration
          )
      }
    }

    _quartz.activeTimers.set(id, {
      timeoutId,
      startTime: Date.now(),
      executionId,
      isExecuting: false
    })

    return timeoutId
  },

  // High precision timer for sub-50ms intervals
  createHighPrecisionTimer: (
    callback: () => void,
    duration: number
  ): NodeJS.Timeout => {
    if (TimerEnvironment.isTest) {
      return setTimeout(callback, duration) as NodeJS.Timeout
    }

    const start = TimerEnvironment.hasHrTime ? process.hrtime() : Date.now()

    const checkTime = () => {
      const elapsed = TimerEnvironment.hasHrTime
        ? (() => {
            const [seconds, nanoseconds] = process.hrtime(
              start as [number, number]
            )
            return seconds * 1000 + nanoseconds / 1000000
          })()
        : Date.now() - (start as number)

      if (elapsed >= duration) {
        callback()
      } else {
        const remaining = duration - elapsed
        if (remaining < 1 && TimerEnvironment.hasSetImmediate) {
          setImmediate(checkTime)
        } else {
          setTimeout(checkTime, Math.max(0, Math.floor(remaining / 2)))
        }
      }
    }

    return setTimeout(checkTime, 0) as NodeJS.Timeout
  },

  // Medium precision for standard intervals
  createMediumPrecisionTimer: (
    callback: () => void,
    duration: number
  ): NodeJS.Timeout => {
    const systemState = metricsState.get()
    const stressFactor = 1 + (systemState.stress?.combined || 0) * 0.1
    const adjustedDuration = Math.floor(duration * stressFactor)

    return setTimeout(callback, adjustedDuration) as NodeJS.Timeout
  },

  // Chunked timer for long durations (> 1 minute)
  createChunkedTimer: (
    callback: () => void,
    duration: number,
    id: string
  ): NodeJS.Timeout => {
    const chunkSize = Math.min(duration, TIMING.MAX_TIMEOUT / 2)
    const remainingTime = duration - chunkSize

    const chunkCallback = () => {
      if (remainingTime <= 0) {
        callback()
      } else {
        // Schedule next chunk
        _quartz.createTimer(
          () => {
            _quartz.createChunkedTimer(callback, remainingTime, id)
          },
          chunkSize,
          `${id}-chunk`
        )
      }
    }

    return setTimeout(chunkCallback, chunkSize) as NodeJS.Timeout
  },

  // Determine precision tier based on duration
  getPrecisionTier: (duration: number): PrecisionTier => {
    if (duration < 50) return PrecisionTier.HIGH
    if (duration < 1000) return PrecisionTier.MEDIUM
    if (duration < 60000) return PrecisionTier.LOW
    return PrecisionTier.CHUNKED
  },

  // Clear timer with proper cleanup
  clearTimer: (id: string): void => {
    const timerData = _quartz.activeTimers.get(id)
    if (timerData) {
      clearTimeout(timerData.timeoutId as NodeJS.Timeout)
      _quartz.activeTimers.delete(id)
    }
  },

  // Get timer statistics
  getStats: () => ({
    activeCount: _quartz.activeTimers.size,
    activeIds: Array.from(_quartz.activeTimers.keys()),
    memoryUsage: _quartz.activeTimers.size * 64 // Rough estimate in bytes
  })
}

// Duration conversion utility
const convertDurationToMs = (duration: TimerDuration): number => {
  return (
    (duration.days || 0) * 24 * 60 * 60 * 1000 +
    (duration.hours || 0) * 60 * 60 * 1000 +
    (duration.minutes || 0) * 60 * 1000 +
    (duration.seconds || 0) * 1000 +
    (duration.milliseconds || 0)
  )
}

// Enhanced formation initialization with delay/interval logic
const initializeFormation = (
  id: string,
  interval: number,
  callback: () => void,
  repeat?: TimerRepeat,
  delay?: number
): Timer => {
  if (!id || typeof interval !== 'number' || typeof callback !== 'function') {
    throw new Error('Invalid formation parameters')
  }

  const now = Date.now()
  const systemState = metricsState.get()
  const stressFactor = 1 + (systemState.stress?.combined || 0) * 0.1

  // Delay/Interval Logic:
  // - If delay is specified, use it for first execution
  // - Otherwise, use interval for first execution
  // - After first execution, always use interval for subsequent executions
  const initialDuration = delay !== undefined ? delay : interval
  const isLongDuration = initialDuration >= TIMING.MAX_TIMEOUT

  const formation: Timer = {
    id,
    startTime: now,
    duration: isLongDuration
      ? TIMING.MAX_TIMEOUT
      : Math.floor(initialDuration * stressFactor),
    originalDuration: interval, // Store original interval for subsequent executions
    callback,
    repeat,
    executionCount: 0,
    lastExecutionTime: 0,
    nextExecutionTime:
      now +
      (isLongDuration
        ? TIMING.MAX_TIMEOUT
        : Math.floor(initialDuration * stressFactor)),
    isInRecuperation: isLongDuration,
    status: 'active',
    isActive: true,

    // Store delay information for proper handling
    delay: delay,
    interval: interval,
    hasExecutedOnce: false, // Track if first execution completed

    metrics: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      lastExecutionTime: 0,
      longestExecutionTime: 0,
      shortestExecutionTime: Infinity,
      missedExecutions: 0,
      surgeProtection: {
        totalDelays: 0,
        totalDelayTime: 0,
        averageDelay: 0,
        lastDelay: 0
      }
    }
  }

  if (isLongDuration) {
    formation.recuperationInterval = createRecuperationChecker(formation)
  }

  return formation
}

// Enhanced callback execution with better error handling and metrics
const executeCallback = async (formation: Timer): Promise<void> => {
  if (!formation?.id) return

  const startTime = TimerEnvironment.hasPerformance
    ? performance.now()
    : Date.now()
  const currentFormation = timeline.get(formation.id)

  if (!currentFormation || !currentFormation.isActive) {
    return
  }

  try {
    // Execute the callback
    await currentFormation.callback()

    const executionTime = TimerEnvironment.hasPerformance
      ? performance.now() - startTime
      : Date.now() - startTime

    // Update metrics
    currentFormation.metrics.totalExecutions++
    currentFormation.metrics.successfulExecutions++
    currentFormation.metrics.lastExecutionTime = executionTime
    currentFormation.metrics.longestExecutionTime = Math.max(
      currentFormation.metrics.longestExecutionTime,
      executionTime
    )
    currentFormation.metrics.shortestExecutionTime = Math.min(
      currentFormation.metrics.shortestExecutionTime,
      executionTime
    )
    currentFormation.metrics.averageExecutionTime =
      (currentFormation.metrics.averageExecutionTime *
        (currentFormation.metrics.totalExecutions - 1) +
        executionTime) /
      currentFormation.metrics.totalExecutions

    currentFormation.executionCount++
    currentFormation.lastExecutionTime = Date.now()

    // Mark that first execution is complete
    if (!currentFormation.hasExecutedOnce) {
      currentFormation.hasExecutedOnce = true
      // After first execution, clear delay and use interval for subsequent executions
      if (currentFormation.delay !== undefined) {
        currentFormation.delay = undefined
      }
    }

    // Handle repeat logic
    if (
      typeof currentFormation.repeat === 'number' &&
      currentFormation.repeat > 0
    ) {
      currentFormation.repeat = currentFormation.repeat - 1
    }

    timeline.add(currentFormation)

    // Schedule next execution if needed
    if (
      currentFormation.repeat === true ||
      currentFormation.repeat === Infinity ||
      (typeof currentFormation.repeat === 'number' &&
        currentFormation.repeat > 0)
    ) {
      scheduleNext(currentFormation)
    } else {
      // Clean up completed formation
      _quartz.clearTimer(currentFormation.id)
      timeline.forget(currentFormation.id)
    }
  } catch (error) {
    const executionTime = TimerEnvironment.hasPerformance
      ? performance.now() - startTime
      : Date.now() - startTime

    const updatedFormation = timeline.get(formation.id)
    if (updatedFormation) {
      updatedFormation.metrics.failedExecutions++
      updatedFormation.metrics.lastExecutionTime = executionTime
      timeline.add(updatedFormation)
    }

    log.error(`Timer execution failed for ${formation.id}: ${error}`)

    // Continue with repeat logic even on error
    if (
      currentFormation.repeat === true ||
      currentFormation.repeat === Infinity ||
      (typeof currentFormation.repeat === 'number' &&
        currentFormation.repeat > 0)
    ) {
      scheduleNext(currentFormation)
    } else {
      _quartz.clearTimer(currentFormation.id)
      timeline.forget(currentFormation.id)
    }
  }
}

// Enhanced recuperation checker with better memory management
const createRecuperationChecker = (formation: Timer): NodeJS.Timeout => {
  if (!formation?.id) {
    return undefined as unknown as NodeJS.Timeout
  }

  const checkInterval = Math.min(
    formation.duration > TIMING.RECUPERATION
      ? TIMING.RECUPERATION
      : formation.duration / 10,
    10000 // Maximum 10 second check interval
  )

  let lastCheck = Date.now()

  const check = () => {
    const currentFormation = timeline.get(formation.id)
    if (!currentFormation || !currentFormation.isActive) {
      return // Stop checking if formation is gone or inactive
    }

    const now = Date.now()
    const systemState = metricsState.get()
    const stressFactor = 1 + (systemState.stress?.combined || 0) * 0.1

    // Adjust timing based on stress and elapsed time
    if (now - lastCheck > checkInterval || Math.abs(stressFactor - 1) > 0.1) {
      const baseInterval = currentFormation.hasExecutedOnce
        ? currentFormation.interval || currentFormation.originalDuration
        : currentFormation.delay !== undefined
        ? currentFormation.delay
        : currentFormation.originalDuration

      const remainingOriginal =
        baseInterval - currentFormation.executionCount * TIMING.MAX_TIMEOUT

      currentFormation.duration = Math.min(
        Math.max(remainingOriginal * stressFactor, 1000), // Minimum 1 second
        TIMING.MAX_TIMEOUT
      )

      currentFormation.nextExecutionTime = now + currentFormation.duration
      timeline.add(currentFormation)
      lastCheck = now
    }

    // Continue checking if still active and not hibernating
    if (!systemState.hibernating && currentFormation.status === 'active') {
      const nextCheck = setTimeout(check, checkInterval)
      currentFormation.recuperationInterval = nextCheck
      timeline.add(currentFormation)
    }
  }

  return setTimeout(check, checkInterval) as NodeJS.Timeout
}

// Enhanced scheduling with delay/interval logic
const scheduleNext = (formation: Timer): void => {
  if (!formation?.id) return

  const systemState = metricsState.get()
  if (systemState.hibernating) return

  const currentFormation = timeline.get(formation.id)
  if (!currentFormation || !currentFormation.isActive) return

  // Prevent runaway executions
  if (currentFormation.executionCount > 10000) {
    log.error(`Maximum execution count exceeded for ${currentFormation.id}`)
    _quartz.clearTimer(currentFormation.id)
    timeline.forget(currentFormation.id)
    return
  }

  const now = Date.now()
  const stressFactor = 1 + (systemState.stress?.combined || 0) * 0.1

  // Delay/Interval Logic:
  // - For first execution: use delay if specified, otherwise use interval
  // - For subsequent executions: always use interval
  let nextDuration: number

  if (
    !currentFormation.hasExecutedOnce &&
    currentFormation.delay !== undefined
  ) {
    // First execution with delay specified
    nextDuration = currentFormation.delay
  } else {
    // Subsequent executions or first execution without delay
    nextDuration =
      currentFormation.interval || currentFormation.originalDuration
  }

  // Apply stress factor and bounds checking
  nextDuration = Math.max(1, Math.floor(nextDuration * stressFactor))

  // Handle long durations with recuperation
  if (currentFormation.isInRecuperation) {
    const remainingOriginal =
      nextDuration - currentFormation.executionCount * TIMING.MAX_TIMEOUT
    nextDuration = Math.min(
      remainingOriginal * stressFactor,
      TIMING.MAX_TIMEOUT
    )

    if (
      nextDuration <= TIMING.MAX_TIMEOUT &&
      remainingOriginal <= TIMING.MAX_TIMEOUT
    ) {
      currentFormation.isInRecuperation = false
      if (currentFormation.recuperationInterval) {
        clearTimeout(currentFormation.recuperationInterval)
        currentFormation.recuperationInterval = undefined
      }
    }
  }

  currentFormation.duration = nextDuration
  currentFormation.nextExecutionTime = now + nextDuration

  // Create timer using unified _quartz system
  try {
    _quartz.createTimer(
      () => executeCallback(currentFormation),
      nextDuration,
      currentFormation.id
    )
    timeline.add(currentFormation)
  } catch (error) {
    log.error(
      `Failed to schedule next execution for ${currentFormation.id}: ${error}`
    )
    timeline.forget(currentFormation.id)
  }
}

// Main TimeKeeper interface with updated API
export const TimeKeeper = {
  /**
   * Create a new timer formation
   * @param interval - Duration for subsequent executions (default duration)
   * @param callback - Function to execute
   * @param repeat - Number of times to repeat or boolean for infinite (optional)
   * @param id - Unique identifier for the timer (optional)
   * @param delay - For delayed for first execution (optional)
   */
  keep: (
    interval: number | TimerDuration,
    callback: () => void,
    repeat?: TimerRepeat,
    id: string = `keep-${crypto.randomUUID()}`,
    delay?: number
  ): Result<Timer, Error> => {
    try {
      const intervalMs =
        typeof interval === 'number' ? interval : convertDurationToMs(interval)

      // Validate parameters
      if (intervalMs < 0) {
        throw new Error('Interval cannot be negative')
      }
      if (delay !== undefined && delay < 0) {
        throw new Error('Delay cannot be negative')
      }
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function')
      }

      // Clean up any existing timer with same ID
      _quartz.clearTimer(id)
      timeline.forget(id)

      const formation = initializeFormation(
        id,
        intervalMs,
        callback,
        repeat,
        delay
      )
      timeline.add(formation)

      // Schedule first execution
      scheduleNext(formation)

      return {kind: 'ok', value: formation}
    } catch (error) {
      log.error(`Timer creation failed: ${error}`)
      return {
        kind: 'error',
        error:
          error instanceof Error ? error : new Error('Timer creation failed')
      }
    }
  },
  wait: (
    duration: number,
    id: string = `wait-${crypto.randomUUID()}`
  ): Promise<void> => {
    // Validate duration
    if (duration <= 0) {
      return Promise.resolve() // Resolve immediately for zero or negative durations
    }

    return new Promise((resolve, reject) => {
      try {
        // Clear any existing timer first
        _quartz.clearTimer(id)

        // Use _quartz's timer creation for consistent behavior
        const timeoutId = _quartz.createTimer(
          () => {
            // Clean up and resolve
            _quartz.activeTimers.delete(id)
            resolve()
          },
          duration,
          id
        )

        // Store for cancellation
        _quartz.activeTimers.set(id, {
          timeoutId,
          startTime: Date.now(),
          executionId: `${id}-${Date.now()}`,
          isExecuting: false
        })

        // Handle cancellation
        const cleanup = () => {
          _quartz.clearTimer(id)
          _quartz.activeTimers.delete(id)
          resolve() // Resolve on cancellation
        }

        // Store cleanup function for forget
        _quartz.activeTimers.get(id)!.cleanup = cleanup
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error('Wait timer creation failed')
        )
      }
    })
  },
  forget: (id: string): void => {
    _quartz.clearTimer(id)

    const formation = timeline.get(id)
    if (formation?.recuperationInterval) {
      clearTimeout(formation.recuperationInterval)
    }

    timeline.forget(id)
  },

  pause: (id?: string): void => {
    if (id) {
      const formation = timeline.get(id)
      if (formation) {
        _quartz.clearTimer(id)
        if (formation.recuperationInterval) {
          clearTimeout(formation.recuperationInterval)
        }
        formation.status = 'paused'
        formation.isActive = false
        timeline.add(formation)
        log.debug(`Timer paused: ${id}`)
      }
    } else {
      // Pause all timers
      timeline.getAll().forEach(formation => {
        _quartz.clearTimer(formation.id)
        if (formation.recuperationInterval) {
          clearTimeout(formation.recuperationInterval)
        }
        formation.status = 'paused'
        formation.isActive = false
        timeline.add(formation)
      })
      log.debug('All timers paused')
    }
  },

  resume: (id?: string): void => {
    const systemState = metricsState.get()
    if (systemState.hibernating) {
      log.warn('Cannot resume timers while system is hibernating')
      return
    }

    if (id) {
      const formation = timeline.get(id)
      if (formation && formation.status === 'paused') {
        formation.status = 'active'
        formation.isActive = true
        timeline.add(formation)
        scheduleNext(formation)
        log.debug(`Timer resumed: ${id}`)
      }
    } else {
      // Resume all paused timers
      timeline.getAll().forEach(formation => {
        if (formation.status === 'paused') {
          formation.status = 'active'
          formation.isActive = true
          timeline.add(formation)
          scheduleNext(formation)
        }
      })
      log.debug('All timers resumed')
    }
  },

  hibernate: (): void => {
    log.debug('TimeKeeper entering hibernation')

    // Update metrics state first and ensure it's set
    metricsState.update({hibernating: true})

    // Clear all active timers
    timeline.getAll().forEach(formation => {
      _quartz.clearTimer(formation.id)
      if (formation.recuperationInterval) {
        clearTimeout(formation.recuperationInterval)
      }
    })

    // Clear timeline after all timers are cleared
    timeline.clear()

    // Double-check and force hibernation state
    const currentState = metricsState.get()
    if (!currentState.hibernating) {
      metricsState.update({hibernating: true})
    }

    // Verify state is set
    const finalState = metricsState.get()
    if (!finalState.hibernating) {
      log.critical('Failed to set hibernation state')
      throw new Error('Failed to set hibernation state')
    }
  },

  reset: (): void => {
    log.debug('TimeKeeper reset initiated')
    metricsState.update({hibernating: false})

    // Clear all timers and formations
    timeline.getAll().forEach(formation => {
      _quartz.clearTimer(formation.id)
      if (formation.recuperationInterval) {
        clearTimeout(formation.recuperationInterval)
      }
    })

    timeline.clear()

    // Clear quartz timers
    _quartz.activeTimers.clear()
  },

  status: () => {
    const formations = timeline.getAll()
    const quartzStats = _quartz.getStats()

    return {
      activeFormations: timeline.getActive().length,
      totalFormations: formations.length,
      inRecuperation: formations.some(f => f.isInRecuperation),
      hibernating: metricsState.get().hibernating,
      formations: formations,
      quartzStats,
      environment: TimerEnvironment,
      memoryUsage: {
        formations: formations.length * 256, // Rough estimate
        quartz: quartzStats.memoryUsage
      }
    }
  }
}

export default TimeKeeper
