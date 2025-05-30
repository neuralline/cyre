// src/app.ts - Refactored initialization with persistent state support

import type {IO, ActionPayload, CyreResponse} from './types/interface'
import {BREATHING, MSG} from './config/cyre-config'
import {log} from './components/cyre-log'
import {subscribe} from './components/cyre-on'
import TimeKeeper from './components/cyre-timekeeper'
import {io, subscribers, timeline} from './context/state'
import {metricsState} from './context/metrics-state'
import {metricsReport, sensor} from './context/metrics-report'
import {registerSingleAction} from './components/cyre-actions'
import {processCall} from './components/cyre-call'
import {stateMachineService} from './state-machine/state-machine-service'
import {
  persistence,
  createLocalStorageAdapter,
  type CyreConfig,
  type PersistentState
} from './context/persistent-state'

/*

      C.Y.R.E - A.P.P
      
      Refactored with organized state and persistence:
      - Clean initialization with config
      - Persistent state support
      - Minimal essential features only

*/

// Track initialization state
let isInitialized = false

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

/**
 * Action registration - simplified without external middleware
 */
const action = (
  attribute: IO | IO[]
): {ok: boolean; message: string; payload?: any} => {
  if (metricsState.isLocked) {
    log.error(MSG.SYSTEM_LOCKED_CHANNELS)
    return {ok: false, message: MSG.SYSTEM_LOCKED_CHANNELS}
  }

  try {
    if (Array.isArray(attribute)) {
      const results = attribute.map(singleAction => {
        const result = registerSingleAction(singleAction)
        if (result.ok) {
          persistence.autoSave() // Auto-save after action registration
        }
        return result
      })

      const successful = results.filter(r => r.ok).length
      const total = results.length

      return {
        ok: successful > 0,
        message: `Registered ${successful}/${total} actions`,
        payload: results
      }
    } else {
      const result = registerSingleAction(attribute)
      if (result.ok) {
        persistence.autoSave() // Auto-save after action registration
      }
      return result
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Action registration failed: ${errorMessage}`)

    sensor.log('system', 'error', 'action-registration', {
      error: errorMessage
    })

    return {
      ok: false,
      message: `Action registration failed: ${errorMessage}`
    }
  }
}

/**
 * Call execution - simplified flow
 */
export const call = async (
  id: string,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  // Fast validation
  if (!id || typeof id !== 'string') {
    sensor.log('unknown', 'error', 'call-validation', {
      invalidId: true,
      providedId: id
    })
    return {
      ok: false,
      payload: null,
      message: MSG.CALL_INVALID_ID
    }
  }

  const action = io.get(id)
  if (!action) {
    sensor.log(id, 'error', 'call-validation', {
      actionNotFound: true,
      actionId: id
    })
    return {
      ok: false,
      payload: null,
      message: `Channel not found: ${id}`
    }
  }
  const callStartTime = performance.now()
  try {
    sensor.log(id, 'call', 'call-entry', {
      timestamp: Date.now(),
      hasPayload: payload !== undefined,
      payloadType: typeof payload,
      actionType: action.type || 'unknown',
      callInitiationTime: callStartTime
    })
    // Execute optimized pipeline
    const result = await processCall(action, payload)

    // Handle IntraLink if present
    // if (result.ok && result.metadata?.intraLink) {
    //   const {id: chainId, payload: chainPayload} = result.metadata.intraLink
    //   const chainResult = await call(chainId, chainPayload)
    //   result.metadata.chainResult = chainResult
    // }
    const totalCallTime = performance.now() - callStartTime

    sensor.log(id, 'info', 'call-completion', {
      success: result.ok,
      totalCallTime,
      callPath: result.metadata?.executionPath || 'unknown'
    })

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const totalCallTime = performance.now() - callStartTime

    // CRITICAL FIX: Log call errors
    sensor.error(id, errorMessage, 'call-execution')

    return {
      ok: false,
      payload: null,
      message: `Call failed: ${errorMessage}`,
      error: errorMessage,
      metadata: {
        totalCallTime,
        executionPath: 'call-error'
      }
    }
  }
}

/**
 * Subscription with auto-save
 */
const on = (actionId: string, handler: Function): any => {
  const result = subscribe(actionId, handler)
  if (result.ok) {
    // CRITICAL FIX: Log subscription events
    sensor.log(actionId, 'info', 'subscription', {
      subscriptionSuccess: true,
      timestamp: Date.now()
    })
    persistence.autoSave()
  } else {
    sensor.log(actionId, 'error', 'subscription', {
      subscriptionFailed: true,
      reason: result.message
    })
  }
  return result
}

/**
 * Forget action - simplified cleanup
 */
const forget = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }

  try {
    const actionRemoved = io.forget(id)
    const subscriberRemoved = subscribers.forget(id)
    timeline.forget(id)

    if (actionRemoved || subscriberRemoved) {
      //log.debug(`Removed action and subscriber for ${id}`)
      sensor.log(id, 'info', 'action-removal', {
        success: true,
        actionRemoved,
        subscriberRemoved
      })
      persistence.autoSave()
      return true
    }

    sensor.log(id, 'info', 'action-removal', {
      success: false,
      reason: 'not found'
    })
    return false
  } catch (error) {
    log.error(`Failed to forget ${id}: ${error}`)
    sensor.error(id, String(error), 'action-removal')
    return false
  }
}

/**
 * Clear system - simplified
 */
const clear = (): void => {
  try {
    sensor.log('system', 'info', 'system-clear', {
      timestamp: Date.now()
    })

    io.clear()
    subscribers.clear()
    timeline.clear()
    metricsReport.reset()
    metricsState.reset()

    stateMachineService.clear()
    persistence.autoSave()

    log.success('System cleared')
    sensor.log('system', 'success', 'system-clear', {
      completed: true
    })
  } catch (error) {
    log.error(`Clear operation failed: ${error}`)
    sensor.error('system', String(error), 'system-clear')
  }
}

/**
 * Initialize with configuration and persistent state
 */
const initialize = async (
  config: CyreConfig = {}
): Promise<{ok: boolean; payload: number; message: string}> => {
  if (isInitialized) {
    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  }

  try {
    // Configure persistence
    persistence.configure({
      autoSave: config.autoSave,
      saveKey: config.saveKey,
      adapter: createLocalStorageAdapter()
    })

    // Load persistent state
    if (config.persistentState) {
      persistence.hydrate(config.persistentState)
      log.debug('Loaded state from config')
    } else if (config.autoSave) {
      const savedState = await persistence.loadState(config.saveKey)
      if (savedState) {
        persistence.hydrate(savedState)
        log.debug('Loaded state from storage')
      }
    }

    isInitialized = true
    initializeBreathing()
    TimeKeeper.resume()

    log.sys(MSG.QUANTUM_HEADER)
    log.success('Cyre initialized with state machine support')

    const stats = persistence.getStats()
    log.debug(
      `Restored ${stats.actionCount} actions, ${stats.subscriberCount} subscribers`
    )

    sensor.log('system', 'success', 'system-initialization', {
      timestamp: Date.now(),
      features: [
        'simplified-core',
        'built-in-protections',
        'breathing-system',
        'state-machines',
        'persistent-state',
        'metrics-tracking'
      ],
      restoredActions: stats.actionCount,
      restoredSubscribers: stats.subscriberCount
    })

    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.critical(`Cyre failed to initialize : ${errorMessage}`)
    sensor.error('system', errorMessage, 'system-initialization')
    return {ok: false, payload: 0, message: errorMessage}
  }
}

/**
 * Main CYRE instance with comprehensive metrics
 */
export const cyre = {
  // Core methods
  initialize,
  action,
  on,
  call,
  get: (id: string): IO | undefined => io.get(id),
  forget,
  clear,

  // State methods
  hasChanged: (id: string, payload: ActionPayload): boolean =>
    io.hasChanged(id, payload),
  getPrevious: (id: string): ActionPayload | undefined => io.getPrevious(id),
  updatePayload: (id: string, payload: ActionPayload): void =>
    io.updatePayload(id, payload),

  // Persistent state methods
  saveState: async (key?: string): Promise<void> => {
    await persistence.saveState(key)
  },

  loadState: async (key?: string): Promise<void> => {
    const state = await persistence.loadState(key)
    if (state) {
      persistence.hydrate(state)
    }
  },

  exportState: (): PersistentState => persistence.serialize(),
  getStats: () => persistence.getStats(),

  // Control methods with metrics
  pause: (id?: string): void => {
    TimeKeeper.pause(id)
    sensor.log(id || 'system', 'info', 'system-pause')
  },

  resume: (id?: string): void => {
    TimeKeeper.resume(id)
    sensor.log(id || 'system', 'info', 'system-resume')
  },

  lock: (): {ok: boolean; message: string; payload: null} => {
    metricsState.lock()
    sensor.log('system', 'critical', 'system-lock')
    return {ok: true, message: 'System locked', payload: null}
  },

  shutdown: (): void => {
    try {
      sensor.log('system', 'critical', 'system-shutdown', {
        timestamp: Date.now()
      })

      persistence.saveState().catch(error => {
        log.error(`Failed to save state during shutdown: ${error}`)
      })

      metricsReport.shutdown()
      clear()

      if (typeof process !== 'undefined' && process.exit) {
        process.exit(0)
      }
    } catch (error) {
      log.error(`Shutdown failed: ${error}`)
      sensor.error('system', String(error), 'system-shutdown')
    }
  },

  status: (): boolean => metricsState.get().hibernating,

  // Monitoring methods
  getBreathingState: () => metricsState.get().breathing,

  getPerformanceState: () => {
    const systemStats = metricsReport.getSystemStats()
    return {
      totalProcessingTime: 0,
      totalCallTime: 0,
      totalStress: metricsState.get().stress.combined,
      stress: metricsState.get().stress.combined,
      callRate: systemStats.callRate,
      totalCalls: systemStats.totalCalls,
      totalExecutions: systemStats.totalExecutions
    }
  },

  // CRITICAL FIX: Enhanced metrics with proper call tracking
  getMetrics: (channelId?: string) => {
    const state = metricsState.get()
    const systemStats = metricsReport.getSystemStats()

    if (channelId) {
      const actionStats = metricsReport.getActionStats(channelId)
      return {
        hibernating: state.hibernating,
        activeFormations: state.activeFormations,
        inRecuperation: state.inRecuperation,
        breathing: state.breathing,
        totalCalls: systemStats.totalCalls,
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
      totalCalls: systemStats.totalCalls,
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

  exportMetrics: (filter?: {
    actionId?: string
    eventType?: string
    since?: number
    limit?: number
  }) => {
    return metricsReport.exportEvents(filter)
  },

  getMetricsReport: () => {
    const systemStats = metricsReport.getSystemStats()
    const breathingState = metricsState.get().breathing
    const allEvents = metricsReport.exportEvents()

    return {
      global: {
        totalCalls: systemStats.totalCalls,
        totalExecutions: systemStats.totalExecutions,
        totalErrors: systemStats.totalErrors,
        callRate: systemStats.callRate,
        uptime: Math.floor((Date.now() - systemStats.startTime) / 1000)
      },
      actions: {} as Record<string, any>,
      insights: [] as string[],
      breathing: breathingState,
      events: allEvents.length
    }
  },

  getPerformanceInsights: (actionId?: string): string[] => {
    const insights: string[] = []
    const systemStats = metricsReport.getSystemStats()
    const breathingState = metricsState.get().breathing

    if (breathingState.stress > 0.8) {
      insights.push('System stress is high - consider reducing load')
    }

    if (systemStats.callRate > 100) {
      insights.push('High call rate detected - throttling may be beneficial')
    }

    if (actionId) {
      const actionStats = metricsReport.getActionStats(actionId)
      if (actionStats && actionStats.errors > 0) {
        insights.push(`Action ${actionId} has ${actionStats.errors} errors`)
      }
    }

    return insights
  },

  // Timer utilities
  setTimer: (
    duration: number,
    callback: () => void,
    timerId: string
  ): {ok: boolean; message?: string} => {
    try {
      const result = TimeKeeper.keep(duration, callback, 1, timerId)
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
  },

  // State machine service
  stateMachine: stateMachineService
}
