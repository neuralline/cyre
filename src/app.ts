import {buildActionPipeline} from './components/cyre-actions'
// src/app.ts

import type {
  IO,
  ActionPayload,
  CyreResponse,
  IMiddleware
} from './types/interface'

import {BREATHING, MSG} from './config/cyre-config'
import {log} from './components/cyre-log'
import dataDefinitions from './elements/data-definitions'
import CyreChannel from './components/cyre-channels'
import {subscribe} from './components/cyre-on'
import timeKeeper from './components/cyre-timekeeper'
import {io, subscribers, middlewares, timeline} from './context/state'
import {metricsState} from './context/metrics-state'
import {historyState} from './context/history-state'
import {metricsReport} from './context/metrics-report'
import {processCall} from './components/cyre-call'

// Pipeline system imports

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.0.0 2025

    Pipeline-compiled action system with lightweight metrics collection:
    - Actions compiled at registration time for optimal performance
    - Fast path for simple channels with zero overhead
    - Timekeeper integration for interval/delay/repeat timing
    - Pre-compiled pipelines cached per channel
    - Raw metrics collection via sensor architecture
    - Functional programming approach with no OOP/Classes
    - Live streaming capabilities for external monitoring

    Example use:
      cyre.action({id: 'uber', payload: 44085648634})
      cyre.on('uber', number => {
          console.log('Calling Uber: ', number)
      })
      cyre.call('uber') 

    Pipeline Features:
    - Compile-time verification and optimization
    - Zero-overhead fast path for simple actions
    - Protection pipeline for complex actions
    - Lightweight sensor-based metrics collection
    - Live event streaming for external monitoring
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

// Track initialization state
let isInitialized = false
let isLocked = false

export interface DetailedTiming {
  stages: Record<string, number>
  totals: {
    totalExecution: number
    pipelineOverhead: number
    listenerExecution: number
    overheadRatio: number
  }
}

/**
 * Action registration with pipeline compilation and sensor logging
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
        try {
          // Validate and create channel
          const channelResult = CyreChannel(singleAction, dataDefinitions)
          if (!channelResult.ok || !channelResult.payload) {
            metricsReport.sensor.error(
              singleAction.id || 'unknown',
              channelResult.message,
              'action-validation'
            )
            return {ok: false, message: channelResult.message}
          }

          // Register with pipeline compilation
          const pipelineResult = buildActionPipeline(channelResult.payload)

          // Log action registration
          metricsReport.sensor.log(
            singleAction.id,
            'info',
            'action-registration',
            {
              success: pipelineResult.ok,
              pipeline: pipelineResult.message
            }
          )

          return pipelineResult
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          log.error(`Failed to register action ${singleAction.id}: ${msg}`)
          metricsReport.sensor.error(
            singleAction.id || 'unknown',
            msg,
            'action-registration'
          )
          return {ok: false, message: msg}
        }
      })

      const successful = results.filter(r => r.ok).length
      const total = results.length

      return {
        ok: successful > 0,
        message: `Registered ${successful}/${total} actions with pipeline compilation`,
        payload: results
      }
    } else {
      // Handle single action
      // Validate and create channel
      const channelResult = CyreChannel(attribute, dataDefinitions)
      if (!channelResult.ok || !channelResult.payload) {
        metricsReport.sensor.error(
          attribute.id || 'unknown',
          channelResult.message,
          'action-validation'
        )
        return {ok: false, message: channelResult.message}
      }

      // Register with pipeline compilation
      const pipelineResult = buildActionPipeline(channelResult.payload)

      // Log action registration
      metricsReport.sensor.log(attribute.id, 'info', 'action-registration', {
        success: pipelineResult.ok,
        pipeline: pipelineResult.message
      })

      return {
        ok: pipelineResult.ok,
        message: pipelineResult.message,
        payload: channelResult.payload
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Action registration failed: ${errorMessage}`)

    // Log system error
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
 * Call execution with optimized pipeline and sensor logging
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
    // Check if action exists
    const actionConfig = io.get(id)
    if (!actionConfig) {
      metricsReport.sensor.error(id, 'unknown id', 'call-validation')
      return {
        ok: false,
        payload: null,
        message: `Action not found: ${id}`
      }
    }

    // Streamlined call processing
    const result = await processCall(actionConfig, payload)
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
 * Forget action with pipeline cleanup and sensor logging
 */
const forget = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }

  try {
    // Remove with pipeline cleanup
    //const actionRemoved = removeActionWithCleanup(id)
    const subscriberRemoved = subscribers.forget(id)

    // Clean up timeline entries
    timeline.forget(id)

    if (subscriberRemoved) {
      log.debug(`Removed action and pipeline for ${id}`)
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
 * Clear system with comprehensive cleanup and sensor logging
 */
const clear = (): void => {
  try {
    metricsReport.sensor.log('system', 'info', 'system-clear', {
      timestamp: Date.now()
    })

    // Clear all pipeline caches
    //invalidatePipelineCache()

    // Clear existing state
    io.clear()
    subscribers.clear()
    middlewares.clear()
    timeline.clear()

    // Clear history
    historyState.clearAll()

    // Reset metrics
    metricsReport.reset()
    //resetExecutionStats()
    metricsState.reset()

    log.success('System cleared with pipeline cleanup')
    metricsReport.sensor.log('system', 'success', 'system-clear', {
      completed: true
    })
  } catch (error) {
    log.error(`Clear operation failed: ${error}`)
    metricsReport.sensor.error('system', String(error), 'system-clear')
  }
}

/**
 * Middleware registration with sensor logging
 */
const middleware = (
  id: string,
  fn: (
    action: IO,
    payload: ActionPayload
  ) => Promise<{action: IO; payload: ActionPayload} | null>
): {ok: boolean; message: string; payload: null} => {
  if (isLocked) {
    metricsReport.sensor.log(id, 'blocked', 'middleware-registration', {
      reason: 'system locked'
    })
    return {ok: false, message: MSG.SYSTEM_LOCKED, payload: null}
  }

  try {
    if (!id || typeof id !== 'string') {
      metricsReport.sensor.error(
        id || 'unknown',
        'Invalid middleware ID',
        'middleware-registration'
      )
      return {ok: false, message: 'Middleware ID is required', payload: null}
    }

    if (typeof fn !== 'function') {
      metricsReport.sensor.error(
        id,
        'Invalid middleware function',
        'middleware-registration'
      )
      return {
        ok: false,
        message: 'Middleware function is required',
        payload: null
      }
    }

    // Register middleware
    const middlewareObj: IMiddleware = {id, fn}
    middlewares.add(middlewareObj)

    log.debug(`Middleware registered: ${id}`)
    metricsReport.sensor.log(id, 'middleware', 'middleware-registration', {
      registered: true
    })

    return {ok: true, message: `Middleware registered: ${id}`, payload: null}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Middleware registration failed: ${errorMessage}`)
    metricsReport.sensor.error(id, errorMessage, 'middleware-registration')
    return {ok: false, message: errorMessage, payload: null}
  }
}

// Core methods - unchanged interfaces
const on = subscribe
const get = (id: string): IO | undefined => io.get(id)
const hasChanged = (id: string, payload: ActionPayload): boolean =>
  io.hasChanged(id, payload)
const getPrevious = (id: string): ActionPayload | undefined =>
  io.getPrevious(id)
const pause = (id?: string): void => {
  timeKeeper.pause(id)
  metricsReport.sensor.log(id || 'system', 'info', 'system-pause')
}
const resume = (id?: string): void => {
  timeKeeper.resume(id)
  metricsReport.sensor.log(id || 'system', 'info', 'system-resume')
}
const status = (): boolean => metricsState.get().hibernating

const lock = (): {ok: boolean; message: string; payload: null} => {
  isLocked = true
  metricsState.lock()
  metricsReport.sensor.log('system', 'critical', 'system-lock')
  return {ok: true, message: 'System locked', payload: null}
}

const shutdown = (): void => {
  try {
    metricsReport.sensor.log('system', 'critical', 'system-shutdown', {
      timestamp: Date.now()
    })

    // Shutdown metrics collector
    metricsReport.shutdown()
    clear()

    if (typeof process !== 'undefined' && process.exit) {
      process.exit(0)
    }
  } catch (error) {
    log.error(`Shutdown failed: ${error}`)
    metricsReport.sensor.error('system', String(error), 'system-shutdown')
  }
}

const initialize = (): {ok: boolean; payload: number; message: string} => {
  if (isInitialized) {
    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  }

  try {
    isInitialized = true
    initializeBreathing()
    timeKeeper.resume()

    log.sys(MSG.QUANTUM_HEADER)
    log.success('CYRE initialized with pipeline compilation and sensor metrics')

    metricsReport.sensor.log('system', 'success', 'system-initialization', {
      timestamp: Date.now(),
      features: ['pipeline-compilation', 'sensor-metrics', 'breathing-system']
    })

    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Initialization failed: ${errorMessage}`)
    metricsReport.sensor.error('system', errorMessage, 'system-initialization')
    return {ok: false, payload: 0, message: errorMessage}
  }
}

// System monitoring methods
const getBreathingState = () => metricsState.get().breathing

const getPerformanceState = () => {
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
}

const getMetrics = (channelId?: string) => {
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
}

// History methods
const getHistory = (actionId?: string) => {
  return actionId ? historyState.getChannel(actionId) : historyState.getAll()
}

const clearHistory = (actionId?: string): void => {
  if (actionId) {
    historyState.clearChannel(actionId)
    metricsReport.sensor.log(actionId, 'info', 'history-clear', {
      scope: 'single'
    })
  } else {
    historyState.clearAll()
    metricsReport.sensor.log('system', 'info', 'history-clear', {scope: 'all'})
  }
}

/**
 * Pipeline management methods
 */

/**
 * Metrics export and monitoring methods
 */
const exportMetrics = (filter?: {
  actionId?: string
  eventType?: string
  since?: number
  limit?: number
}) => {
  return metricsReport.exportEvents(filter)
}

const getBasicMetricsReport = (): string => {
  return metricsReport.getBasicReport()
}

const getMetricsMemoryInfo = () => {
  const stats = metricsReport.getSystemStats()
  return {
    totalCalls: stats.totalCalls,
    totalExecutions: stats.totalExecutions,
    totalErrors: stats.totalErrors,
    callRate: stats.callRate,
    uptime: Date.now() - stats.startTime
  }
}

/**
 * Live streaming methods for external monitoring
 */

/**
 * Main CYRE instance with pipeline compilation and sensor metrics
 */
export const cyre = {
  // Core methods
  initialize,
  action,
  on,
  call,
  get,
  forget,
  clear,
  middleware,

  // State methods
  hasChanged,
  getPrevious,

  // Control methods
  pause,
  resume,
  lock,
  shutdown,
  status,

  // Monitoring methods
  getBreathingState,
  getPerformanceState,
  getMetrics,
  getHistory,
  clearHistory,

  // Metrics export
  exportMetrics,
  getBasicMetricsReport,
  getMetricsMemoryInfo

  // Development helpers
  // dev: {
  //   resetExecutionStats,
  //   getExecutionStats,
  //   getPerformanceAnalysis,
  //   invalidatePipelineCache: (channelId?: string) =>
  //     invalidatePipelineCache(channelId),
  //   getAllPipelines: () => getAllCompiledPipelines(),
  //   forceRecompile: (actionId: string) => {
  //     invalidatePipelineCache(actionId)
  //     return recompileAction(actionId)
  //   },
  //   // Raw metrics access for advanced monitoring
  //   getSystemStats: () => metricsReport.getSystemStats(),
  //   getActionStats: (actionId: string) => metricsReport.getActionStats(actionId)
  // }
}

// Initialize on import
initialize()

export default cyre
