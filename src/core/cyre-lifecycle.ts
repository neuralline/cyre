// src/core/cyre-lifecycle.ts
// System lifecycle management - startup, shutdown, and locking

import type {CyreResponse} from '../types/interface'
import {BREATHING, MSG} from '../config/cyre-config'
import {log} from '../components/cyre-log'
import {metricsState} from '../context/metrics-state'
import {metricsReport} from '../context/metrics-report'
import {subscribers, timeline, io} from '../context/state'
import timeKeeper from '../components/cyre-timekeeper'

/*

    C.Y.R.E. - L.I.F.E.C.Y.C.L.E

    System lifecycle management with proper resource cleanup

*/

/**
 * Initialize the breathing system
 */
const initializeBreathing = (): void => {
  timeKeeper.keep(
    BREATHING.RATES.BASE,
    async () => {
      const currentState = metricsState.get()
      metricsState.updateBreath({
        cpu: currentState.system.cpu,
        memory: currentState.system.memory,
        eventLoop: currentState.system.eventLoop,
        isOverloaded: currentState.system.isOverloaded
      })
    },
    true
  )
}

/**
 * Initialize CYRE system
 */
export const initializeCyre = (): CyreResponse => {
  try {
    // Initialize breathing system
    initializeBreathing()

    // Resume timekeeper
    timeKeeper.resume()

    // Display quantum header
    log.sys(MSG.QUANTUM_HEADER)

    log.info('CYRE system initialized successfully')

    return {
      ok: true,
      payload: 200,
      message: MSG.WELCOME
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to initialize CYRE: ${errorMessage}`)

    return {
      ok: false,
      payload: null,
      message: `Initialization failed: ${errorMessage}`
    }
  }
}

/**
 * Lock system to prevent new actions/subscribers
 */
export const lockSystem = (): CyreResponse => {
  try {
    metricsState.lock()
    log.info('CYRE system locked - no new channels or subscribers can be added')

    return {
      ok: true,
      message: 'System locked successfully',
      payload: null
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to lock system: ${errorMessage}`)

    return {
      ok: false,
      message: `System lock failed: ${errorMessage}`,
      payload: null
    }
  }
}

/**
 * Get system status
 */
export const getSystemStatus = (isShutdown: boolean): boolean => {
  if (isShutdown) {
    log.info({ok: true, message: MSG.OFFLINE})
  } else {
    log.info({ok: true, message: MSG.ONLINE})
  }
  return isShutdown
}

/**
 * Shutdown CYRE system gracefully
 */
export const shutdownCyre = (): void => {
  try {
    log.info('Starting CYRE shutdown sequence...')

    // Clean up timers first
    timeline.getAll().forEach(timer => {
      if (timer.timeoutId) {
        clearTimeout(timer.timeoutId)
      }
      if (timer.recuperationInterval) {
        clearTimeout(timer.recuperationInterval)
      }
    })

    // Hibernate timekeeper
    timeKeeper.hibernate()

    // Clear all stores
    subscribers.clear()
    io.clear()

    // Reset metrics
    metricsState.reset()
    metricsReport.reset()

    log.sys('CYRE shutdown completed successfully')

    // Exit process if in Node.js environment
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(0)
    }
  } catch (error) {
    log.error(`Failed to shutdown gracefully: ${error}`)
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(1)
    }
  }
}

/**
 * Setup graceful shutdown handlers
 */
export const setupShutdownHandlers = (shutdownCallback: () => void): void => {
  // Browser environment
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', shutdownCallback)
  }
  // Node.js environment
  else if (typeof process !== 'undefined') {
    process.on('SIGINT', shutdownCallback)
    process.on('SIGTERM', shutdownCallback)
    process.on('uncaughtException', error => {
      console.error('Uncaught Exception:', error)
      shutdownCallback()
    })
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      shutdownCallback()
    })
  }
}

/**
 * Pause system operations
 */
export const pauseSystem = (id?: string): void => {
  try {
    timeKeeper.pause(id)
    const allTimers = timeline.getAll()

    if (id) {
      const timer = timeline.get(id)
      if (timer) {
        timeline.add({...timer, status: 'paused'})
        log.debug(`Paused action: ${id}`)
      }
    } else {
      allTimers.forEach(timer => {
        if (timer) {
          timeline.add({...timer, status: 'paused'})
        }
      })
      log.info('Paused all system operations')
    }
  } catch (error) {
    log.error(`Failed to pause system: ${error}`)
  }
}

/**
 * Resume system operations
 */
export const resumeSystem = (id?: string): void => {
  try {
    timeKeeper.resume(id)
    const allTimers = timeline.getAll()

    if (id) {
      const timer = timeline.get(id)
      if (timer) {
        timeline.add({...timer, status: 'active'})
        log.debug(`Resumed action: ${id}`)
      }
    } else {
      allTimers.forEach(timer => {
        if (timer) {
          timeline.add({...timer, status: 'active'})
        }
      })
      log.info('Resumed all system operations')
    }
  } catch (error) {
    log.error(`Failed to resume system: ${error}`)
  }
}

/**
 * Check if system is healthy
 */
export const isSystemHealthy = (): boolean => {
  return metricsState.isHealthy()
}

/**
 * Get system uptime in milliseconds
 */
export const getSystemUptime = (startTime: number): number => {
  return Date.now() - startTime
}
