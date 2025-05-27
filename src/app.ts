// src/app.ts
// Updated with clean pipeline integration

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
import {buildActionPipeline} from './actions'
import {pipelineState} from './context/pipeline-state'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.0.0 2025

    Updated with clean pipeline integration:
    - Pipelines compiled and saved during action creation
    - Fast path for actions without pipeline (zero overhead)
    - Clean separation of concerns
    - Intended flow: call() → processCall() → applyPipeline() → dispatch() → cyreExecute() → [IntraLink → call()]

    Example use:
      cyre.action({id: 'uber', payload: 44085648634})
      cyre.on('uber', number => {
          console.log('Calling Uber: ', number)
      })
      cyre.call('uber') 

    Pipeline Features:
    - Compile-time pipeline creation and caching
    - Zero-overhead fast path for simple actions
    - Individual action modules for clean separation
    - Lightweight sensor-based metrics collection
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
 * Action registration with pipeline compilation and caching
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
        message: `Registered ${successful}/${total} actions with pipeline compilation`,
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
 * Register single action with pipeline compilation
 */
const registerSingleAction = (
  attribute: IO
): {ok: boolean; message: string; payload?: any} => {
  try {
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

    const validatedAction = channelResult.payload

    // Build and save pipeline during action creation
    const pipeline = buildActionPipeline(validatedAction)
    pipelineState.set(validatedAction.id, pipeline)

    // Log pipeline creation
    const pipelineInfo = pipelineState.isFastPath(validatedAction.id)
      ? 'fast-path (zero overhead)'
      : `${pipeline.length} pipeline functions`

    log.debug(`Action ${validatedAction.id} registered with ${pipelineInfo}`)

    metricsReport.sensor.log(
      validatedAction.id,
      'info',
      'action-registration',
      {
        pipelineLength: pipeline.length,
        isFastPath: pipelineState.isFastPath(validatedAction.id),
        pipelineInfo
      }
    )

    return {
      ok: true,
      message: `Action registered with ${pipelineInfo}`,
      payload: validatedAction
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error(`Failed to register action ${attribute.id}: ${msg}`)
    metricsReport.sensor.error(
      attribute.id || 'unknown',
      msg,
      'action-registration'
    )
    return {ok: false, message: msg}
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

    // Process call through clean flow
    const result = await processCall(actionConfig, payload)

    // Handle IntraLink chain reactions
    if (result.ok && result.metadata?.intraLink) {
      const chainLink = result.metadata.intraLink
      log.debug(`Processing IntraLink: ${id} -> ${chainLink.id}`)

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
 * Forget action with pipeline cleanup
 */
const forget = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }

  try {
    // Clean up pipeline
    const pipelineRemoved = pipelineState.forget(id)

    // Remove action and subscriber
    const actionRemoved = io.forget(id)
    const subscriberRemoved = subscribers.forget(id)

    // Clean up timeline entries
    timeline.forget(id)

    if (actionRemoved || subscriberRemoved || pipelineRemoved) {
      log.debug(`Removed action, pipeline, and subscriber for ${id}`)
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
 * Clear system with comprehensive cleanup
 */
const clear = (): void => {
  try {
    metricsReport.sensor.log('system', 'info', 'system-clear', {
      timestamp: Date.now()
    })

    // Clear pipeline cache
    pipelineState.clear()

    // Clear existing state
    io.clear()
    subscribers.clear()
    middlewares.clear()
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
 * Middleware registration
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
 * Pipeline statistics for monitoring
 */
const getPipelineStats = () => {
  return pipelineState.getStats()
}

/**
 * Metrics export methods
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

/**
 * Main CYRE instance with clean pipeline integration
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

  // Pipeline monitoring
  getPipelineStats,

  // Metrics export
  exportMetrics,
  getBasicMetricsReport
}

// Initialize on import
initialize()

export default cyre
