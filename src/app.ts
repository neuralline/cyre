// src/app.ts - Refactored initialization with persistent state support

import type {IO, ActionPayload, CyreResponse} from './types/interface'
import {BREATHING, MSG} from './config/cyre-config'
import {log} from './components/cyre-log'
import {subscribe} from './components/cyre-on'
import TimeKeeper from './components/cyre-timekeeper'
import {metricsState} from './context/metrics-state'
import {metricsReport} from './context/metrics-report'
import {
  applyBuiltInProtections,
  registerSingleAction
} from './components/cyre-actions'
import {processCall, scheduleCall} from './components/cyre-call'
import {stateMachineService} from './state-machine/state-machine-service'
import {
  persistentState,
  createLocalStorageAdapter,
  type CyreConfig,
  type PersistentState
} from './context/persistent-state'
import {io, subscribers, timeline} from './context/state'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.1.0 2025

        example use:
        cyre.action({id: 'uber', payload: 44085648634})
        cyre.on('uber', number => {
            console.log('Calling Uber @', number)
        })
        cyre.call('uber') 

    Cyre's first law: A robot can not injure a human being or allow a human being to be harmed by not helping.
    Cyre's second law: An event system must never fail to execute critical actions nor allow system degradation by refusing to implement proper protection mechanisms.

    Intended flow: call() → processCall() → applyPipeline() → dispatch() → cyreExecute() → .on() → [IntraLink → call()]


      C.Y.R.E - A.P.P
      
      Refactored with organized state and persistence:
      - Clean initialization with config
      - Persistent state support
      - Minimal essential features only

*/

// Track initialization
let isInitialized = false
let storageAdapter = createLocalStorageAdapter()
let autoSaveEnabled = false
let saveKey = 'cyre-state'

/**
 * Initialize breathing system
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
 * Auto-save state when enabled
 */
const autoSave = async (): Promise<void> => {
  if (!autoSaveEnabled) return
  try {
    const state = persistentState.serialize()
    await storageAdapter.save(saveKey, state)
  } catch (error) {
    log.error(`Auto-save failed: ${error}`)
  }
}

/**
 * Action registration with persistent state
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
          persistentState.setAction(singleAction)
          autoSave()
        }
        return result
      })

      const successful = results.filter(r => r.ok).length
      return {
        ok: successful > 0,
        message: `Registered ${successful}/${results.length} actions`,
        payload: results
      }
    } else {
      const result = registerSingleAction(attribute)
      if (result.ok) {
        persistentState.setAction(attribute)
        autoSave()
      }
      return result
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Action registration failed: ${errorMessage}`)
    return {ok: false, message: `Action registration failed: ${errorMessage}`}
  }
}

/**
 * Subscription with persistent state
 */
const on = (actionId: string, handler: Function): any => {
  const result = subscribe(actionId, handler)
  if (result.ok) {
    persistentState.setSubscriber(actionId)
    autoSave()
  }
  return result
}

/**
 * Call execution with persistent state
 */
const call = async (
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

  metricsReport.sensor.log(id, 'call', 'call-initiation', {
    hasPayload: payload !== undefined
  })

  try {
    // Get action from persistent state
    const actionConfig = persistentState.getAction(id)
    if (!actionConfig) {
      return {ok: false, payload: null, message: `Action not found: ${id}`}
    }

    // Apply protections
    const protectionResult = await applyBuiltInProtections(
      actionConfig,
      payload
    )
    if (!protectionResult.ok) {
      return {
        ok: false,
        payload: protectionResult.payload,
        message: protectionResult.message,
        metadata: {
          executionPath: 'blocked-by-protection',
          protection: 'protectionResult?.protection',
          ...protectionResult.metadata
        }
      }
    }

    const processedPayload = protectionResult.payload

    // Execute
    const requiresTimekeeper = !!(
      actionConfig.interval ||
      actionConfig.delay !== undefined ||
      (actionConfig.repeat !== undefined &&
        actionConfig.repeat !== 1 &&
        actionConfig.repeat !== 0)
    )

    let result: CyreResponse
    if (requiresTimekeeper) {
      result = await scheduleCall(actionConfig, processedPayload)
    } else {
      result = await processCall(actionConfig, processedPayload)
    }

    // Handle IntraLink chain reactions
    if (result.ok && result.metadata?.intraLink) {
      persistentState.setPayload(id, processedPayload)
      autoSave()
      // Handle IntraLink chain reactions

      const chainLink = result.metadata.intraLink

      try {
        const chainResult = await call(chainLink.id, chainLink.payload)
        return {
          ...result,
          metadata: {
            ...result.metadata,
            chainResult
          }
        }
      } catch (chainError) {
        log.error(`IntraLink execution failed: ${chainError}`)
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
 * Forget action - simplified cleanup
 */
const forget = (id: string): boolean => {
  if (!id || typeof id !== 'string') return false

  try {
    const removed = persistentState.removeAction(id)
    const actionRemoved = io.forget(id)
    const subscriberRemoved = subscribers.forget(id)
    timeline.forget(id)

    if (actionRemoved || subscriberRemoved) {
      log.debug(`Removed action and subscriber for ${id}`)
      metricsReport.sensor.log(id, 'info', 'action-removal', {success: true})
      return true
    }
    if (removed) {
      autoSave()
      log.debug(`Removed action: ${id}`)
    }
    return removed
  } catch (error) {
    log.error(`Failed to forget ${id}: ${error}`)
    return false
  }
}

/**
 * Clear all state
 */
const clear = (): void => {
  try {
    autoSave()
    io.clear()
    subscribers.clear()
    timeline.clear()
    persistentState.clear()
    metricsReport.reset()
    metricsState.reset()
    stateMachineService.clear()

    log.success('System cleared')
  } catch (error) {
    log.error(`Clear operation failed: ${error}`)
  }
}

/**
 * Enhanced initialization with configuration and persistent state
 */
const initialize = async (
  config: CyreConfig = {}
): Promise<{ok: boolean; message: string}> => {
  if (metricsState.initialize) {
    return {ok: true, message: MSG.ONLINE}
  }

  try {
    metricsState.init()
    // Set configuration
    if (config.autoSave !== undefined) autoSaveEnabled = config.autoSave
    if (config.saveKey) saveKey = config.saveKey

    // Load persistent state if provided or from storage
    if (config.persistentState) {
      persistentState.hydrate(config.persistentState)
      log.debug('Loaded state from config')
    } else if (autoSaveEnabled) {
      const savedState = await storageAdapter.load(saveKey)
      if (savedState) {
        persistentState.hydrate(savedState)
        log.debug('Loaded state from storage')
      }
    }

    // Initialize core systems

    initializeBreathing()
    TimeKeeper.resume()

    const stats = persistentState.getStats()

    log.success(
      `Cyre initialized with ${stats.actionCount} actions, ${stats.subscriberCount} subscribers`
    )

    return {ok: true, message: MSG.ONLINE}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.critical(`Cyre initialization failed: ${errorMessage}`)
    return {ok: false, message: errorMessage}
  }
}

/**
 * Main CYRE instance with persistent state support
 */
export const cyre = {
  // Enhanced initialization
  initialize,

  // Core methods with persistent state
  action,
  on,
  call,
  get: (id: string): IO | undefined => persistentState.getAction(id),
  forget,
  clear,

  // State persistence methods
  saveState: async (key?: string): Promise<void> => {
    const state = persistentState.serialize()
    await storageAdapter.save(key || saveKey, state)
  },

  loadState: async (key?: string): Promise<void> => {
    const state = await storageAdapter.load(key || saveKey)
    if (state) {
      persistentState.hydrate(state)
    }
  },

  exportState: (): PersistentState => persistentState.serialize(),

  // State utilities
  hasChanged: (id: string, payload: ActionPayload): boolean => {
    const previous = persistentState.getPayload(id)
    return previous !== payload
  },

  getPrevious: (id: string): ActionPayload | undefined =>
    persistentState.getPayload(id),

  // Control methods
  pause: (id?: string): void => TimeKeeper.pause(id),
  resume: (id?: string): void => TimeKeeper.resume(id),
  lock: () => {
    metricsState.lock()
    return {ok: true, message: 'System locked', payload: null}
  },

  // Monitoring
  getStats: () => persistentState.getStats(),

  shutdown: (): void => {
    try {
      if (autoSaveEnabled) {
        const state = persistentState.serialize()
        storageAdapter.save(saveKey, state)
      }
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
