// src/app.ts - FIXED: Lightweight metrics integration

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
import {EventType, metricsReport} from './context/metrics-report' // FIXED: Lightweight collector

// 🚀 NEW: Import pipeline system
import {
  getCompiledPipeline,
  invalidatePipelineCache,
  getPipelineCacheStats,
  getAllCompiledPipelines
} from './pipeline/pipeline-compiler'
import {
  getExecutionStats,
  getPerformanceAnalysis,
  resetExecutionStats
} from './pipeline/pipeline-executor'
import {
  registerActionWithPipeline,
  updateActionWithPipeline,
  removeActionWithCleanup,
  executeOptimizedCall,
  performPipelineHealthCheck
} from './pipeline/pipeline-integration'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.0.0 2025

    Enhanced with detailed action pipeline timing measurement:
    - Proper separation of action pipeline overhead vs listener execution
    - Industry-aligned performance thresholds  
    - Detailed timing breakdowns and optimization suggestions
    - Real-time performance monitoring and warnings

    Example use:
      cyre.action({id: 'uber', payload: 44085648634})
      cyre.on('uber', number => {
          console.log('Calling Uber: ', number)
      })
      cyre.call('uber') 

    Now with enhanced timing:
    - Action Pipeline: throttle + debounce + middleware + dispatch overhead
    - Listener Execution: pure user handler execution time  
    - Total Execution: pipeline overhead + listener execution

      
      - Actions are compiled at registration time
      - Fast path for simple channels (zero overhead)
      - Timekeeper integration for interval/delay/repeat
      - Pre-compiled pipelines stored per channel state
      - compiled pipeline should include all actions. eg:repeat,delay, debounce
      - pre-verification before compile and fast path
      - {block:true} option. like fast path, pre-block for failed verifications, {repeat:0}, {block:true} or service no longer available 
      - Lightweight metrics collection for external monitoring
      - Functional architecture maintained

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

/**
 * 🎯 ENHANCED ACTION REGISTRATION WITH PIPELINE COMPILATION
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
            return {ok: false, message: channelResult.message}
          }

          // 🚀 Register with pipeline compilation
          return registerActionWithPipeline(channelResult.payload)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          log.error(`Failed to register action ${singleAction.id}: ${msg}`)
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
        return {ok: false, message: channelResult.message}
      }

      // 🚀 Register with pipeline compilation
      const pipelineResult = registerActionWithPipeline(channelResult.payload)

      return {
        ok: pipelineResult.ok,
        message: pipelineResult.message,
        payload: channelResult.payload
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Action registration failed: ${errorMessage}`)
    return {
      ok: false,
      message: `Action registration failed: ${errorMessage}`
    }
  }
}

/**
 * 📞 ENHANCED CALL EXECUTION WITH LIGHTWEIGHT METRICS
 */
const call = async (
  id: string,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  if (!id || typeof id !== 'string') {
    return {
      ok: false,
      payload: null,
      message: MSG.CALL_INVALID_ID
    }
  }

  try {
    // Check if action exists
    const actionConfig = io.get(id)
    if (!actionConfig) {
      return {
        ok: false,
        payload: null,
        message: `Action not found: ${id}`
      }
    }

    // FIXED: Track call with lightweight collector
    metricsReport.trackCall(id, actionConfig.priority?.level || 'medium')

    // 🚀 Use optimized execution with compiled pipelines
    const result = await executeOptimizedCall(id, payload)

    // FIXED: Track execution with lightweight metrics
    if (result.metadata?.executionTime) {
      metricsReport.trackExecution(
        id,
        result.metadata.executionTime,
        result.metadata.executionPath
      )
    }

    // Track errors if any
    if (!result.ok) {
      metricsReport.trackError(id, result.error)
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Call execution failed for ${id}: ${errorMessage}`)

    // Track the error
    metricsReport.trackError(id, errorMessage)

    return {
      ok: false,
      payload: null,
      message: `Call failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * 🗑️ ENHANCED FORGET WITH PIPELINE CLEANUP
 */
const forget = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }

  try {
    // 🗑️ Remove with pipeline cleanup
    const actionRemoved = removeActionWithCleanup(id)
    const subscriberRemoved = subscribers.forget(id)

    // Clean up timeline entries
    timeline.forget(id)

    if (actionRemoved || subscriberRemoved) {
      log.debug(`Removed action and pipeline for ${id}`)
      return true
    }

    return false
  } catch (error) {
    log.error(`Failed to forget ${id}: ${error}`)
    return false
  }
}

/**
 * 🧹 ENHANCED CLEAR WITH LIGHTWEIGHT CLEANUP
 */
const clear = (): void => {
  try {
    // Clear all pipeline caches
    invalidatePipelineCache()

    // Clear existing state
    io.clear()
    subscribers.clear()
    middlewares.clear()
    timeline.clear()

    // Clear history
    historyState.clearAll()

    // Reset lightweight metrics
    metricsReport.reset()
    resetExecutionStats()
    metricsState.reset()

    log.success('🧹 System cleared with  cleanup')
  } catch (error) {
    log.error(`Clear operation failed: ${error}`)
  }
}

/**
 * 🔧 ENHANCED MIDDLEWARE REGISTRATION
 */
const middleware = (
  id: string,
  fn: (
    action: IO,
    payload: ActionPayload
  ) => Promise<{action: IO; payload: ActionPayload} | null>
): {ok: boolean; message: string; payload: null} => {
  if (isLocked) {
    return {ok: false, message: MSG.SYSTEM_LOCKED, payload: null}
  }

  try {
    if (!id || typeof id !== 'string') {
      return {ok: false, message: 'Middleware ID is required', payload: null}
    }

    if (typeof fn !== 'function') {
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
    return {ok: true, message: `Middleware registered: ${id}`, payload: null}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Middleware registration failed: ${errorMessage}`)
    return {ok: false, message: errorMessage, payload: null}
  }
}

// Keep existing methods unchanged
const on = subscribe
const get = (id: string): IO | undefined => io.get(id)
const hasChanged = (id: string, payload: ActionPayload): boolean =>
  io.hasChanged(id, payload)
const getPrevious = (id: string): ActionPayload | undefined =>
  io.getPrevious(id)
const pause = (id?: string): void => timeKeeper.pause(id)
const resume = (id?: string): void => timeKeeper.resume(id)
const status = (): boolean => metricsState.get().hibernating

const lock = (): {ok: boolean; message: string; payload: null} => {
  isLocked = true
  metricsState.lock()
  return {ok: true, message: 'System locked', payload: null}
}

const shutdown = (): void => {
  try {
    // Shutdown metrics collector
    metricsReport.shutdown()
    clear()
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(0)
    }
  } catch (error) {
    log.error(`Shutdown failed: ${error}`)
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
    log.success('🚀 CYRE initialized with  metrics system')
    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Initialization failed: ${errorMessage}`)
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
    callRate: systemStats.callRate, // From lightweight collector
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
              executionCount: actionStats.executions,
              status: 'active' as const,
              nextExecutionTime: actionStats.lastExecution,
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
  } else {
    historyState.clearAll()
  }
}

/**
 * 🚀 LIGHTWEIGHT METRICS METHODS
 */
const getPipelineStats = () => {
  return {
    cache: getPipelineCacheStats(),
    execution: getExecutionStats(),
    performance: getPerformanceAnalysis()
  }
}

const getPipelineInfo = (actionId: string) => {
  try {
    const action = io.get(actionId)
    if (!action) {
      return null
    }

    const compiledPipeline = getCompiledPipeline(action)
    if (!compiledPipeline) {
      return null
    }

    return {
      channelId: compiledPipeline.channelId,
      isFastPath: compiledPipeline.isFastPath,
      requiresTimekeeper: compiledPipeline.requiresTimekeeper,
      category: compiledPipeline.performance.category,
      expectedOverhead: compiledPipeline.performance.expectedOverhead,
      optimizationLevel: compiledPipeline.performance.optimizationLevel,
      compiledAt: compiledPipeline.compiledAt,
      verificationHash: compiledPipeline.verificationHash,
      flags: compiledPipeline.flags,
      verification: {
        errors: compiledPipeline.verification.errors,
        warnings: compiledPipeline.verification.warnings,
        optimizations: compiledPipeline.verification.optimizations
      }
    }
  } catch (error) {
    return null
  }
}

const recompileAction = (actionId: string): {ok: boolean; message: string} => {
  const action = io.get(actionId)
  if (!action) {
    return {ok: false, message: 'Action not found'}
  }

  try {
    return updateActionWithPipeline(action)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {ok: false, message: errorMessage}
  }
}

const performHealthCheck = () => {
  return performPipelineHealthCheck()
}

const getPerformanceInsights = (): string[] => {
  const analysis = getPerformanceAnalysis()
  return [...analysis.insights, ...analysis.recommendations]
}

/**
 * LIGHTWEIGHT METRICS EXPORT METHODS
 */
const exportMetrics = (filter?: {
  actionId?: string
  eventType?: EventType
  since?: number
  limit?: number
}) => {
  return metricsReport.exportEvents(filter)
}

const getBasicMetricsReport = (): string => {
  return metricsReport.getBasicReport()
}

const getMetricsMemoryInfo = () => {
  return metricsReport.getMemoryInfo()
}

/**
 * 🎯 MAIN CYRE INSTANCE WITH LIGHTWEIGHT METRICS
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

  // 🚀 Pipeline-specific methods
  getPipelineStats,
  getPipelineInfo,
  recompileAction,
  performHealthCheck,
  getPerformanceInsights,

  // 📊 LIGHTWEIGHT METRICS EXPORT
  exportMetrics,
  getBasicMetricsReport,
  getMetricsMemoryInfo,

  // Development helpers
  dev: {
    resetExecutionStats,
    getExecutionStats,
    getPerformanceAnalysis,
    invalidatePipelineCache: (channelId?: string) =>
      invalidatePipelineCache(channelId),
    getAllPipelines: () => getAllCompiledPipelines(),
    forceRecompile: (actionId: string) => {
      invalidatePipelineCache(actionId)
      return recompileAction(actionId)
    },
    // Raw metrics access for advanced monitoring
    getSystemStats: () => metricsReport.getSystemStats(),
    getActionStats: (actionId: string) =>
      metricsReport.getActionStats(actionId),
    exportAllActionStats: () => metricsReport.exportActionStats()
  }
}

// Initialize on import
initialize()

export default cyre
