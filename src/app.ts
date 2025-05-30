// src/app.ts - Refactored initialization with persistent state support

import type {IO, ActionPayload, CyreResponse} from './types/interface'
import {BREATHING, MSG} from './config/cyre-config'
import {log} from './components/cyre-log'
import {subscribe} from './components/cyre-on'
import TimeKeeper from './components/cyre-timekeeper'
import {io, subscribers, timeline} from './context/state'
import {metricsState} from './context/metrics-state'
import {metricsReport} from './context/metrics-report'
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
 * Call execution - simplified flow
 */
export const call = async (
  id: string,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  // Fast validation
  if (!id || typeof id !== 'string') {
    return {
      ok: false,
      payload: null,
      message: MSG.CALL_INVALID_ID
    }
  }

  const action = io.get(id)
  if (!action) {
    return {
      ok: false,
      payload: null,
      message: `Channel not found: ${id}`
    }
  }

  try {
    // Execute optimized pipeline
    const result = await processCall(action, payload)

    // Handle IntraLink if present
    // if (result.ok && result.metadata?.intraLink) {
    //   const {id: chainId, payload: chainPayload} = result.metadata.intraLink
    //   const chainResult = await call(chainId, chainPayload)
    //   result.metadata.chainResult = chainResult
    // }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      payload: null,
      message: `Call failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * Subscription with auto-save
 */
const on = (actionId: string, handler: Function): any => {
  const result = subscribe(actionId, handler)
  if (result.ok) {
    persistence.autoSave() // Auto-save after subscription
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
      log.debug(`Removed action and subscriber for ${id}`)
      metricsReport.sensor.log(id, 'info', 'action-removal', {success: true})
      persistence.autoSave() // Auto-save after removal
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
 * Clear system - simplified
 */
const clear = (): void => {
  try {
    metricsReport.sensor.log('system', 'info', 'system-clear', {
      timestamp: Date.now()
    })

    io.clear()
    subscribers.clear()
    timeline.clear()
    metricsReport.reset()
    metricsState.reset()

    // Clear state machines
    stateMachineService.clear()

    persistence.autoSave() // Auto-save after clear

    log.success('System cleared')
    metricsReport.sensor.log('system', 'success', 'system-clear', {
      completed: true
    })
  } catch (error) {
    log.error(`Clear operation failed: ${error}`)
    metricsReport.sensor.error('system', String(error), 'system-clear')
  }
}

/**
 * Enhanced initialization with configuration and persistent state
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

    // Load persistent state if provided or from storage
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

    metricsReport.sensor.log('system', 'success', 'system-initialization', {
      timestamp: Date.now(),
      features: [
        'simplified-core',
        'built-in-protections',
        'breathing-system',
        'state-machines',
        'persistent-state'
      ],
      restoredActions: stats.actionCount,
      restoredSubscribers: stats.subscriberCount
    })

    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.critical(`Cyre failed to initialize : ${errorMessage}`)
    metricsReport.sensor.error('system', errorMessage, 'system-initialization')
    return {ok: false, payload: 0, message: errorMessage}
  }
}

/**
 * Main CYRE instance - with persistent state integration
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

  // State methods (existing)
  hasChanged: (id: string, payload: ActionPayload): boolean =>
    io.hasChanged(id, payload),
  getPrevious: (id: string): ActionPayload | undefined => io.getPrevious(id),
  updatePayload: (id: string, payload: ActionPayload): void =>
    io.updatePayload(id, payload),

  // NEW: Persistent state methods
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
    metricsState.lock()
    metricsReport.sensor.log('system', 'critical', 'system-lock')
    return {ok: true, message: 'System locked', payload: null}
  },

  shutdown: (): void => {
    try {
      metricsReport.sensor.log('system', 'critical', 'system-shutdown', {
        timestamp: Date.now()
      })

      // Save state before shutdown
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
      metricsReport.sensor.error('system', String(error), 'system-shutdown')
    }
  },

  status: (): boolean => metricsState.get().hibernating,

  // Monitoring methods (existing)
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
