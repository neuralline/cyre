// src/components/cyre-time-keeper.ts
import type {Timer, TimerDuration, TimerRepeat} from '../interfaces/interface'
import {TIMING} from '../config/cyre-config'
import {log} from './cyre-logger'
import {metricsState, Result} from '../context/metrics-state'
import {timeline} from '../context/state'
import {detailedMetrics} from '@/context/detailed-metrics'

/* 
      C.Y.R.E. - T.I.M.E.K.E.E.P.E.R.
      Q0.0U0.0A0.0N0.0T0.0U0.0M0





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


      Combined Delay and Interval:
      Delay applies first, then interval timing for subsequent executions
      No immediate executions for interval or delay actions


      Edge Cases:
      { repeat: 0 } = Do not execute at all. 
      { repeat: 1, interval: 1000 } = Wait 1000ms, execute once, done.
      { delay: 0 } = wait 0ms then execute.
*/

const createPrecisionTimer = (
  callback: () => void,
  delay: number
): NodeJS.Timeout => {
  // Check if we're in a test environment
  const isTestEnv =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'test'

  if (isTestEnv) {
    // In test environment, use simple setTimeout without immediate execution
    return setTimeout(callback, delay) as NodeJS.Timeout
  }

  const start = process.hrtime()

  const checkTime = () => {
    const [seconds, nanoseconds] = process.hrtime(start)
    const elapsedMs = seconds * 1000 + nanoseconds / 1000000

    if (elapsedMs >= delay) {
      callback()
    } else {
      const remainingMs = delay - elapsedMs
      if (remainingMs < 1) {
        setImmediate(checkTime)
      } else if (remainingMs < 25) {
        setTimeout(checkTime, 0)
      } else {
        setTimeout(checkTime, Math.floor(remainingMs / 2))
      }
    }
  }

  return setTimeout(checkTime, 0) as NodeJS.Timeout
}

const convertDurationToMs = (duration: TimerDuration): number => {
  return (
    (duration.days || 0) * 24 * 60 * 60 * 1000 +
    (duration.hours || 0) * 60 * 60 * 1000 +
    (duration.minutes || 0) * 60 * 1000 +
    (duration.seconds || 0) * 1000 +
    (duration.milliseconds || 0)
  )
}

const initializeFormation = (
  id: string,
  rawDuration: number,
  callback: () => void,
  repeat?: TimerRepeat
): Timer => {
  if (
    !id ||
    typeof rawDuration !== 'number' ||
    typeof callback !== 'function'
  ) {
    throw new Error('Invalid formation parameters')
  }

  const now = Date.now()
  const isLongDuration = rawDuration >= TIMING.MAX_TIMEOUT
  const systemState = metricsState.get()
  const stressFactor = 1 + (systemState.stress?.combined || 0)

  // Create the formation with the ORIGINAL repeat value
  // No conversion to avoid any issues
  const formation: Timer = {
    id,
    startTime: now,
    duration: isLongDuration ? TIMING.MAX_TIMEOUT : rawDuration * stressFactor,
    originalDuration: rawDuration,
    callback,
    repeat: repeat, // Store the original repeat value exactly as provided
    executionCount: 0,
    lastExecutionTime: 0,
    nextExecutionTime:
      now + (isLongDuration ? TIMING.MAX_TIMEOUT : rawDuration * stressFactor),
    isInRecuperation: isLongDuration,
    status: 'active',
    isActive: true,
    metrics: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      lastExecutionTime: 0,
      longestExecutionTime: 0,
      shortestExecutionTime: Infinity,
      missedExecutions: 0
    }
  }

  if (isLongDuration) {
    formation.recuperationInterval = createRecuperationChecker(formation)
  }

  return formation
}

// Excerpt from executeCallback in cyre-time-keeper.ts
const executeCallback = async (formation: Timer): Promise<void> => {
  if (!formation || !formation.id) return

  const startTime = performance.now()
  const currentFormation = timeline.get(formation.id)
  if (!currentFormation || !currentFormation.isActive) return

  try {
    await formation.callback()

    const executionTime = performance.now() - startTime
    detailedMetrics.trackExecution(formation.id, executionTime)

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

    if (currentFormation.executionCount > 1) {
      detailedMetrics.trackRepeat(formation.id)
    }

    // Decrement repeat count appropriately
    // For numeric repeat values, decrease by 1 after execution
    if (
      typeof currentFormation.repeat === 'number' &&
      currentFormation.repeat > 0
    ) {
      currentFormation.repeat = currentFormation.repeat - 1
    }
    // Do not modify 'true' or 'infinite' repeat values

    timeline.add(currentFormation)

    // Use the consistent function to check if should continue
    // Only schedule another execution if we haven't reached our repeat count
    if (
      currentFormation.repeat === true ||
      (typeof currentFormation.repeat === 'number' &&
        currentFormation.repeat > 0)
    ) {
      scheduleNext(currentFormation)
    } else {
      timeline.forget(currentFormation.id)
    }
  } catch (error) {
    detailedMetrics.trackError(formation.id)
    const updatedFormation = timeline.get(formation.id)
    if (updatedFormation) {
      updatedFormation.metrics.failedExecutions++
      timeline.add(updatedFormation)
    }
    log.error(`Timer execution failed: ${error}`)
  }
}

const createRecuperationChecker = (formation: Timer): NodeJS.Timeout => {
  if (!formation || !formation.id) {
    return undefined as unknown as NodeJS.Timeout
  }

  const checkInterval =
    formation.duration > TIMING.RECUPERATION
      ? TIMING.RECUPERATION
      : Math.max(formation.duration / 10, 1000)

  let lastCheck = Date.now()
  let timeoutRef: NodeJS.Timeout

  const check = () => {
    const currentFormation = timeline.get(formation.id)
    if (!currentFormation || !currentFormation.isActive) {
      clearTimeout(timeoutRef)
      return
    }

    const now = Date.now()
    const systemState = metricsState.get()
    const stressFactor = 1 + (systemState.stress?.combined || 0)

    if (now - lastCheck > checkInterval || Math.abs(stressFactor - 1) > 0.1) {
      const remainingOriginal =
        currentFormation.originalDuration -
        currentFormation.executionCount * TIMING.MAX_TIMEOUT

      currentFormation.duration =
        Math.min(remainingOriginal, TIMING.MAX_TIMEOUT) * stressFactor
      currentFormation.nextExecutionTime = now + currentFormation.duration
      timeline.add(currentFormation)

      lastCheck = now
    }

    if (!systemState.hibernating && currentFormation.status === 'active') {
      timeoutRef = setTimeout(check, checkInterval)
      currentFormation.recuperationInterval = timeoutRef
      timeline.add(currentFormation)
    }
  }

  timeoutRef = setTimeout(check, checkInterval)
  return timeoutRef
}

const scheduleNext = (formation: Timer): void => {
  if (!formation || !formation.id) return

  const systemState = metricsState.get()
  if (systemState.hibernating) return

  const now = Date.now()
  const stressFactor = 1 + (systemState.stress?.combined || 0)
  const currentFormation = timeline.get(formation.id)

  if (!currentFormation || !currentFormation.isActive) return

  // Prevent infinite recursion
  if (currentFormation.executionCount > 10000) {
    log.error('Maximum execution count exceeded')
    timeline.forget(currentFormation.id)
    return
  }

  // Calculate next interval with stress factor applied first
  let nextInterval = currentFormation.duration * stressFactor

  if (currentFormation.isInRecuperation) {
    const remainingOriginal =
      currentFormation.originalDuration -
      currentFormation.executionCount * TIMING.MAX_TIMEOUT

    nextInterval = Math.min(
      remainingOriginal * stressFactor,
      TIMING.MAX_TIMEOUT
    )
    currentFormation.duration = nextInterval

    if (currentFormation.duration > TIMING.RECUPERATION) {
      if (currentFormation.recuperationInterval) {
        clearTimeout(currentFormation.recuperationInterval)
      }
      currentFormation.recuperationInterval =
        createRecuperationChecker(currentFormation)
    }

    if (remainingOriginal <= TIMING.MAX_TIMEOUT) {
      currentFormation.isInRecuperation = false
    }
  } else {
    currentFormation.duration = nextInterval
  }

  currentFormation.nextExecutionTime = now + currentFormation.duration

  // Clear any existing timeout
  if (currentFormation.timeoutId) {
    clearTimeout(currentFormation.timeoutId)
  }

  // In test mode, use simple setTimeout
  const isTestEnv =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
  currentFormation.timeoutId = isTestEnv
    ? setTimeout(
        () => executeCallback(currentFormation),
        currentFormation.duration
      )
    : currentFormation.duration < 25
    ? createPrecisionTimer(
        () => executeCallback(currentFormation),
        currentFormation.duration
      )
    : setTimeout(
        () => executeCallback(currentFormation),
        currentFormation.duration
      )

  timeline.add(currentFormation)
}

const TimeKeeper = {
  keep: (
    duration: number | TimerDuration,
    callback: () => void,
    repeat?: TimerRepeat,
    id: string = crypto.randomUUID()
  ): Result<Timer, Error> => {
    try {
      const msValue =
        typeof duration === 'number' ? duration : convertDurationToMs(duration)

      // Pass the original repeat value without any conversion
      const formation = initializeFormation(id, msValue, callback, repeat)
      timeline.add(formation)
      scheduleNext(formation)

      return {kind: 'ok', value: formation}
    } catch (error) {
      return {
        kind: 'error',
        error:
          error instanceof Error ? error : new Error('Timer creation failed')
      }
    }
  },

  forget: (id: string): void => {
    const formation = timeline.get(id)
    if (formation?.timeoutId) clearTimeout(formation.timeoutId)
    if (formation?.recuperationInterval) {
      clearTimeout(formation.recuperationInterval)
    }
    timeline.forget(id)
  },

  pause: (id?: string): void => {
    if (id) {
      const formation = timeline.get(id)
      if (formation) {
        if (formation.timeoutId) clearTimeout(formation.timeoutId)
        if (formation.recuperationInterval) {
          clearTimeout(formation.recuperationInterval)
        }
        formation.status = 'paused'
        formation.isActive = false
        timeline.add(formation)
      }
    } else {
      timeline.getAll().forEach(formation => {
        if (formation.timeoutId) clearTimeout(formation.timeoutId)
        if (formation.recuperationInterval) {
          clearTimeout(formation.recuperationInterval)
        }
        formation.status = 'paused'
        formation.isActive = false
        timeline.add(formation)
      })
    }
  },

  resume: (id?: string): void => {
    const systemState = metricsState.get()
    if (systemState.hibernating) return

    if (id) {
      const formation = timeline.get(id)
      if (formation && formation.status === 'paused') {
        formation.status = 'active'
        formation.isActive = true
        timeline.add(formation)
        scheduleNext(formation)
      }
    } else {
      timeline.getAll().forEach(formation => {
        if (formation.status === 'paused') {
          formation.status = 'active'
          formation.isActive = true
          timeline.add(formation)
          scheduleNext(formation)
        }
      })
    }
  },

  hibernate: (): void => {
    metricsState.update({hibernating: true})
    timeline.getAll().forEach(formation => {
      if (formation.timeoutId) clearTimeout(formation.timeoutId)
      if (formation.recuperationInterval) {
        clearTimeout(formation.recuperationInterval)
      }
    })
    timeline.clear()
  },

  reset: (): void => {
    metricsState.update({hibernating: false})
    timeline.getAll().forEach(formation => {
      if (formation.timeoutId) clearTimeout(formation.timeoutId)
      if (formation.recuperationInterval) {
        clearTimeout(formation.recuperationInterval)
      }
    })
    timeline.clear()
  },

  status: () => ({
    activeFormations: timeline.getActive().length,
    inRecuperation: timeline.getAll().some(f => f.isInRecuperation),
    hibernating: metricsState.get().hibernating,
    formations: timeline.getAll()
  })
}

export default TimeKeeper
