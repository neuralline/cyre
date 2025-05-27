// src/app.ts
// Fixed integration with working unified middleware system

import type {IO, ActionPayload, CyreResponse} from './types/interface'

import {BREATHING, MSG} from './config/cyre-config'
import {log} from './components/cyre-log'
import dataDefinitions from './elements/data-definitions'
import CyreChannel from './components/cyre-channels'
import {subscribe} from './components/cyre-on'
import {TimeKeeper} from './components/cyre-timekeeper'
import {io, subscribers, timeline} from './context/state'
import {metricsState} from './context/metrics-state'
import {historyState} from './context/history-state'
import {metricsReport} from './context/metrics-report'
import {middlewareState} from './middleware/state'
import {executeMiddlewareChain} from './middleware/executor'
import {useDispatch} from './components/cyre-dispatch'
import type {ExternalMiddlewareFunction} from './types/interface'
import {registerSingleAction} from './components/cyre-actions'
import {processCall, scheduleCall} from './components/cyre-call'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.1.0 2025

     example use:
      cyre.action({id: 'uber', payload: 44085648634})
      cyre.on('uber', number => {
          console.log('Calling Uber: ', number)
      })
      cyre.call('uber') 

    Cyre's first law: A robot can not injure a human being or allow a human being to be harmed by not helping.
    Cyre's second law: An event system must never fail to execute critical actions nor allow system degradation by refusing to implement proper protection mechanisms.


    - Intended flow: call() → processCall() → applyPipeline() → dispatch() → cyreExecute() → .on() → [IntraLink → call()]

 

    Fixed with working unified middleware system:
    - Single middleware execution chain
    - Built-in protections as internal middleware
    - External middleware without state access
    - Zero overhead fast path for simple actions
    - Proper integration with existing call flow

    Example use:
      cyre.action({id: 'uber', payload: 44085648634})
      cyre.on('uber', number => {
          console.log('Calling Uber: ', number)
      })
      cyre.call('uber') 

    Middleware Features:
    - Unified middleware system (internal + external)
    - Zero-overhead fast path for actions without protections
    - Per-action middleware chain compilation
    - Built-in protections: throttle, debounce, change detection, etc.
    - External middleware without internal state access
*/

/**
 * Initialize the breathing system
 */
const initializeBreathing = (): void => {
  TimeKeeper.keep(
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

// Track initialization state
let isInitialized = false
let isLocked = false

/**
 * Action registration with middleware chain compilation
 */
const action = (
  attribute: IO | IO[]
): {ok: boolean; message: string; payload?: any} => {
  if (isLocked) {
    log.error(MSG.SYSTEM_LOCKED_CHANNELS)
    return {ok: false, message: MSG.SYSTEM_LOCKED_CHANNELS}
  }

  try {
    if (Array.isArray(attribute)) {
      // Handle array of actions
      const results = attribute.map(singleAction => {
        return registerSingleAction(singleAction)
      })

      const successful = results.filter(r => r.ok).length
      const total = results.length

      return {
        ok: successful > 0,
        message: `Registered ${successful}/${total} actions with middleware compilation`,
        payload: results
      }
    } else {
      // Handle single action
      return registerSingleAction(attribute)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Action registration failed: ${errorMessage}`)

    metricsReport.sensor.log('system', 'error', 'action-registration', {
      error: errorMessage
    })

    return {
      ok: false,
      message: `Action registration failed: ${errorMessage}`
    }
  }
}

/**
 * Call execution with clean flow and IntraLink handling
 */
export const call = async (
  id: string,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  if (!id || typeof id !== 'string') {
    metricsReport.sensor.error(
      'unknown',
      'Invalid action ID',
      'call-validation'
    )
    return {
      ok: false,
      payload: null,
      message: MSG.CALL_INVALID_ID
    }
  }

  // Log call initiation
  metricsReport.sensor.log(id, 'call', 'call-initiation', {
    hasPayload: payload !== undefined
  })

  try {
    // Check if channel exists
    const actionConfig = io.get(id)
    if (!actionConfig) {
      metricsReport.sensor.error(id, 'unknown id', 'call-validation')
      return {
        ok: false,
        payload: null,
        message: `Channel not found: ${id}`
      }
    }

    // Check if action requires timekeeper (has timing properties)
    const requiresTimekeeper = !!(
      actionConfig.interval ||
      actionConfig.delay !== undefined ||
      (actionConfig.repeat !== undefined &&
        actionConfig.repeat !== 1 &&
        actionConfig.repeat !== 0)
    )

    let result: CyreResponse

    if (requiresTimekeeper) {
      result = await scheduleCall(actionConfig, payload)
    } else {
      result = await processCall(actionConfig, payload)
    }

    // Handle IntraLink chain reactions
    if (result.ok && result.metadata?.intraLink) {
      const chainLink = result.metadata.intraLink

      try {
        // Recursively call the linked action
        const chainResult = await call(chainLink.id, chainLink.payload)

        // Return original result but include chain information
        return {
          ...result,
          metadata: {
            ...result.metadata,
            chainResult
          }
        }
      } catch (chainError) {
        log.error(`IntraLink execution failed: ${chainError}`)
        // Return original result even if chain fails
        return result
      }
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.critical(`Call execution failed for ${id}: ${errorMessage}`)

    metricsReport.sensor.error(id, errorMessage, 'call-execution')

    return {
      ok: false,
      payload: null,
      message: `Call failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * Forget action with middleware cleanup
 */
const forget = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }

  try {
    // Clean up middleware chain
    const middlewareRemoved = middlewareState.forgetChain(id)

    // Remove action and subscriber
    const actionRemoved = io.forget(id)
    const subscriberRemoved = subscribers.forget(id)

    // Clean up timeline entries
    timeline.forget(id)

    if (actionRemoved || subscriberRemoved || middlewareRemoved) {
      log.debug(`Removed action, middleware chain, and subscriber for ${id}`)
      metricsReport.sensor.log(id, 'info', 'action-removal', {success: true})
      return true
    }

    metricsReport.sensor.log(id, 'info', 'action-removal', {
      success: false,
      reason: 'not found'
    })
    return false
  } catch (error) {
    log.error(`Failed to forget ${id}: ${error}`)
    metricsReport.sensor.error(id, String(error), 'action-removal')
    return false
  }
}

/**
 * External middleware registration (user-facing API)
 */
const middleware = (
  id: string,
  fn: ExternalMiddlewareFunction
): {ok: boolean; message: string; payload: null} => {
  if (isLocked) {
    metricsReport.sensor.log(id, 'blocked', 'middleware-registration', {
      reason: 'system locked'
    })
    return {ok: false, message: MSG.SYSTEM_LOCKED, payload: null}
  }

  try {
    const result = middlewareState.registerExternal(id, fn)

    if (result.ok) {
      metricsReport.sensor.log(id, 'middleware', 'middleware-registration', {
        registered: true
      })
    } else {
      metricsReport.sensor.error(id, result.message, 'middleware-registration')
    }

    return {
      ok: result.ok,
      message: result.message,
      payload: null
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Middleware registration failed: ${errorMessage}`)
    metricsReport.sensor.error(id, errorMessage, 'middleware-registration')
    return {ok: false, message: errorMessage, payload: null}
  }
}
const clear = (): void => {
  try {
    metricsReport.sensor.log('system', 'info', 'system-clear', {
      timestamp: Date.now()
    })

    // Clear middleware chains
    middlewareState.clearChains()

    // Clear existing state
    io.clear()
    subscribers.clear()
    timeline.clear()

    // Clear history
    historyState.clearAll()

    // Reset metrics
    metricsReport.reset()
    metricsState.reset()

    log.success('System cleared with complete cleanup')
    metricsReport.sensor.log('system', 'success', 'system-clear', {
      completed: true
    })
  } catch (error) {
    log.error(`Clear operation failed: ${error}`)
    metricsReport.sensor.error('system', String(error), 'system-clear')
  }
}

/**
 * Main CYRE instance with clean pipeline integration
 */
export const cyre = {
  // Core methods
  initialize: (): {ok: boolean; payload: number; message: string} => {
    if (isInitialized) {
      return {ok: true, payload: Date.now(), message: MSG.ONLINE}
    }

    try {
      isInitialized = true
      initializeBreathing()
      TimeKeeper.resume()

      log.sys(MSG.QUANTUM_HEADER)
      log.success('CYRE initialized with clean pipeline system')

      metricsReport.sensor.log('system', 'success', 'system-initialization', {
        timestamp: Date.now(),
        features: [
          'clean-pipeline',
          'fast-path',
          'sensor-metrics',
          'breathing-system'
        ]
      })

      return {ok: true, payload: Date.now(), message: MSG.ONLINE}
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error(`Initialization failed: ${errorMessage}`)
      metricsReport.sensor.error(
        'system',
        errorMessage,
        'system-initialization'
      )
      return {ok: false, payload: 0, message: errorMessage}
    }
  },
  action,
  on: subscribe,
  call,

  get: (id: string): IO | undefined => io.get(id),
  forget,
  /**
   * Clear system with comprehensive cleanup
   */
  clear,

  middleware,

  // State methods
  hasChanged: (id: string, payload: ActionPayload): boolean =>
    io.hasChanged(id, payload),
  getPrevious: (id: string): ActionPayload | undefined => io.getPrevious(id),
  updatePayload: (id: string, payload: ActionPayload): void =>
    io.updatePayload(id, payload),

  // Control methods
  pause: (id?: string): void => {
    TimeKeeper.pause(id)
    metricsReport.sensor.log(id || 'system', 'info', 'system-pause')
  },
  resume: (id?: string): void => {
    TimeKeeper.resume(id)
    metricsReport.sensor.log(id || 'system', 'info', 'system-resume')
  },
  lock: (): {ok: boolean; message: string; payload: null} => {
    isLocked = true
    metricsState.lock()
    metricsReport.sensor.log('system', 'critical', 'system-lock')
    return {ok: true, message: 'System locked', payload: null}
  },

  shutdown: (): void => {
    try {
      metricsReport.sensor.log('system', 'critical', 'system-shutdown', {
        timestamp: Date.now()
      })

      metricsReport.shutdown()
      clear()

      if (typeof process !== 'undefined' && process.exit) {
        process.exit(0)
      }
    } catch (error) {
      log.error(`Shutdown failed: ${error}`)
      metricsReport.sensor.error('system', String(error), 'system-shutdown')
    }
  },
  status: (): boolean => metricsState.get().hibernating,

  // Monitoring methods
  getBreathingState: () => metricsState.get().breathing,
  getPerformanceState: () => {
    const systemStats = metricsReport.getSystemStats()
    return {
      totalProcessingTime: 0, // Legacy compatibility
      totalCallTime: 0, // Legacy compatibility
      totalStress: metricsState.get().stress.combined,
      stress: metricsState.get().stress.combined,
      callRate: systemStats.callRate,
      totalCalls: systemStats.totalCalls,
      totalExecutions: systemStats.totalExecutions
    }
  },
  getMetrics: (channelId?: string) => {
    const state = metricsState.get()

    if (channelId) {
      const actionStats = metricsReport.getActionStats(channelId)
      return {
        hibernating: state.hibernating,
        activeFormations: state.activeFormations,
        inRecuperation: state.inRecuperation,
        breathing: state.breathing,
        formations: actionStats
          ? [
              {
                id: channelId,
                duration: 0,
                executionCount: actionStats.calls,
                status: 'active' as const,
                nextExecutionTime: actionStats.lastCall,
                isInRecuperation: state.inRecuperation,
                breathingSync: state.breathing.currentRate
              }
            ]
          : []
      }
    }

    return {
      hibernating: state.hibernating,
      activeFormations: state.activeFormations,
      inRecuperation: state.inRecuperation,
      breathing: state.breathing,
      formations: timeline.getAll().map(timer => ({
        id: timer.id,
        duration: timer.duration,
        executionCount: timer.executionCount,
        status: timer.status,
        nextExecutionTime: timer.nextExecutionTime,
        isInRecuperation: timer.isInRecuperation,
        breathingSync: state.breathing.currentRate
      }))
    }
  },
  // History methods
  getHistory: (actionId?: string) => {
    return actionId ? historyState.getChannel(actionId) : historyState.getAll()
  },
  clearHistory: (actionId?: string): void => {
    if (actionId) {
      historyState.clearChannel(actionId)
      metricsReport.sensor.log(actionId, 'info', 'history-clear', {
        scope: 'single'
      })
    } else {
      historyState.clearAll()
      metricsReport.sensor.log('system', 'info', 'history-clear', {
        scope: 'all'
      })
    }
  },

  // Pipeline monitoring
  getPipelineStats: () => {
    return pipelineState.getStats()
  },

  exportMetrics: (filter?: {
    actionId?: string
    eventType?: string
    since?: number
    limit?: number
  }) => {
    return metricsReport.exportEvents(filter)
  },
  getMetricsReport: (): string => {
    return metricsReport.getBasicReport()
  },

  //timer
  /**
   * Set a timer with proper error handling
   * @returns Object indicating success and optional timerId/message
   */
  setTimer: (
    duration: number,
    callback: () => void,
    timerId: string
  ): {ok: boolean; message?: string} => {
    try {
      const result = TimeKeeper.keep(
        duration,
        callback,
        1, // Execute once
        timerId
      )

      return result.kind === 'ok'
        ? {ok: true}
        : {ok: false, message: result.error.message}
    } catch (error) {
      log.error(`Failed to set timer: ${error}`)
      return {ok: false, message: String(error)}
    }
  },

  clearTimer: (timerId: string): boolean => {
    try {
      TimeKeeper.forget(timerId)
      return true
    } catch (error) {
      log.error(`Failed to clear timer ${timerId}: ${error}`)
      return false
    }
  }
}

// Initialize on import
cyre.initialize()

export default cyre
