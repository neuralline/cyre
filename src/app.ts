// src/app.ts - Updated with intelligent system orchestration

import type {IO, ActionPayload, CyreResponse, GroupConfig} from './types/core'
import {BREATHING, MSG} from './config/cyre-config'
import {log} from './components/cyre-log'
import {subscribe} from './components/cyre-on'
import TimeKeeper from './components/cyre-timekeeper'
import {io, subscribers, timeline} from './context/state'
import {metricsState} from './context/metrics-state'
import {metricsReport, sensor} from './context/metrics-report'
import {CyreActions} from './components/cyre-actions'
import {processCall} from './components/cyre-call'
import {
  persistence,
  createLocalStorageAdapter,
  type CyreConfig,
  type PersistentState
} from './context/persistent-state'
import schema from './schema/cyre-schema'
import {groupOperations, removeChannelFromGroups} from './components/cyre-group'
import {awarenessBeats} from './context/awareness-beats'
import payloadState from './context/payload-state'

// Import advanced systems
import {orchestration} from './orchestration/orchestration-engine'
import {query, initializeQuerySystem} from './query/cyre-query'
import {
  initializeSystemOrchestrations,
  getSystemOrchestrationStatus,
  adaptSystemOrchestrations
} from './orchestration/system-orchestrations'
import type {OrchestrationConfig} from './types/orchestration'
import {registerSystemHandlers} from './schema/system-handlers'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.5.0 2025 with Intelligent System Orchestration

    Intelligent system processes:
    - Adaptive breathing with stress-responsive adjustments
    - Smart memory cleanup with performance impact analysis  
    - Proactive performance monitoring with actionable insights
    - Automated state persistence with conflict resolution
    - Comprehensive health checks with self-healing
    - Dynamic load balancing and adaptive optimization

        example use:
        cyre.action({id: 'uber', payload: 44085648634})
        cyre.on('uber', number => {
            console.log('Calling Uber @', number)
        })
        cyre.call('uber') 

        // System orchestrations run automatically:
        // - Breathing adapts to system stress
        // - Memory cleanup happens intelligently
        // - Performance issues are detected and resolved
        // - Health checks prevent system degradation

    Cyre's first law: A robot can not injure a human being or allow a human being to be harmed by not helping.
    
     flow: call() → processCall() → applyPipeline() → dispatch() → cyreExecute() → .on() → [IntraLink → call()]

*/

// Track initialization state
let isInitialized = false
let systemOrchestrationIds: string[] = []

/**
 * Initialize with advanced features and system orchestrations
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
    // Assuming awareness is part of CyreConfig or handled elsewhere
    // awarenessBeats.initialize(config.awareness || undefined) // Removed awareness initialization here

    // Initialize advanced systems
    initializeQuerySystem()

    // Load persistent state
    if (config.persistentState) {
      persistence.hydrate(config.persistentState)
      log.debug('Loaded state from config')
    } else if (config.autoSave) {
      const savedState = await persistence.loadState(config.saveKey)
      if (savedState) {
        persistence.hydrate(savedState)
      }
    }

    isInitialized = true
    initializeBreathing() // This now does nothing as breathing is orchestrated
    TimeKeeper.resume()

    // Register system handlers here after initialization
    //registerSystemHandlers()

    log.sys(MSG.QUANTUM_HEADER)
    log.success('Cyre initialized with advanced orchestration and query')

    const stats = persistence.getStats()
    log.debug(
      `Restored ${stats.actionCount} actions, ${stats.subscriberCount} subscribers`
    )

    sensor.log('system', 'success', 'system-initialization', {
      timestamp: Date.now(),
      features: [
        'core-system',
        'protections',
        'breathing-system',
        'persistent-state',
        'metrics-tracking',
        'group-system',
        'advanced-orchestration',
        'query-system'
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

// Add this function to calculate stress from system load
const calculateSystemStress = (
  callRate: number,
  totalCalls: number
): number => {
  // Simple stress calculation based on call rate
  const baseStress = Math.min(callRate / 100, 1) // 100 calls/sec = 100% stress
  const burstStress = Math.min(totalCalls / 1000, 0.5) // Large total calls add stress
  return Math.min(baseStress + burstStress, 1)
}

// Replace the breathing update function in your cyre object:
const updateBreathingFromLoad = () => {
  const systemStats = metricsReport.getSystemStats()
  const stress = calculateSystemStress(
    systemStats.callRate,
    systemStats.totalCalls
  )

  // Calculate adaptive breathing rate
  let newRate = BREATHING.RATES.BASE
  if (stress > 0.8) {
    newRate = BREATHING.RATES.RECOVERY // 2000ms
  } else if (stress > 0.5) {
    newRate = BREATHING.RATES.MAX // 1000ms
  } else if (stress > 0.3) {
    newRate = BREATHING.RATES.BASE * 2 // 400ms
  }

  // Update breathing state
  metricsState.updateBreath({
    cpu: stress * 100,
    memory: stress * 80,
    eventLoop: stress * 10,
    isOverloaded: stress > 0.9
  })

  // Update breathing rate manually since updateBreath might not set it
  const breathing = metricsState.get().breathing
  breathing.stress = stress
  breathing.currentRate = newRate
}

// Update your breathing timer initialization:
const initializeBreathing = (): void => {
  TimeKeeper.keep(
    1000, // Check every second
    updateBreathingFromLoad,
    true,
    'system-breathing'
  )
}

/**
 * Action registration with automatic orchestration trigger detection
 */
const action = (
  attribute: IO | IO[]
): {ok: boolean; message: string; payload?: any} => {
  if (metricsState.isLocked()) {
    log.error(MSG.SYSTEM_LOCKED_CHANNELS)
    return {ok: false, message: MSG.SYSTEM_LOCKED_CHANNELS}
  }

  try {
    if (Array.isArray(attribute)) {
      const results = attribute.map(singleAction => {
        const result = CyreActions(singleAction)
        if (result.ok) {
          persistence.autoSave()
          checkOrchestrationTriggers(singleAction.id)
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
      const result = CyreActions(attribute)

      if (result.ok) {
        persistence.autoSave()
        checkOrchestrationTriggers(attribute.id)
      }

      return result
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Action registration failed: ${errorMessage}`)
    sensor.log('system', 'error', 'action-registration', {error: errorMessage})
    return {ok: false, message: `Action registration failed: ${errorMessage}`}
  }
}

/**
 * Check for orchestration triggers when new channels are registered
 */
const checkOrchestrationTriggers = (channelId: string): void => {
  // This will be handled automatically by the compiled trigger system
  // No action needed here - triggers are checked on every call
}

/**
 * Call execution with orchestration integration
 */
export const call = async (
  id: string,
  payload?: ActionPayload
): Promise<CyreResponse> => {
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

  const callStartTime = Date.now()
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

    const totalCallTime = Date.now() - callStartTime

    sensor.log(id, 'info', 'call-completion', {
      success: result.ok,
      totalCallTime,
      callPath: result.metadata?.executionPath || 'unknown'
    })

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const totalCallTime = performance.now() - callStartTime

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
const on = (actionId: string, handler: (...args: any[]) => any): any => {
  const result = subscribe(actionId, handler)
  if (result.ok) {
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
 * Forget action with group and orchestration cleanup
 */
const forget = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }

  try {
    const actionRemoved = io.forget(id)
    const subscriberRemoved = subscribers.forget(id)
    timeline.forget(id)

    // Remove from groups
    removeChannelFromGroups(id)

    if (actionRemoved || subscriberRemoved) {
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
 * Clear system with all integrations
 */
const clear = (): void => {
  try {
    sensor.log('system', 'info', 'system-clear', {
      timestamp: Date.now()
    })

    // Stop system orchestrations first
    systemOrchestrationIds.forEach(id => {
      orchestration.stop(id)
      orchestration.remove(id)
    })

    io.clear()
    subscribers.clear()
    timeline.clear()
    metricsReport.reset()
    metricsState.reset()

    // Clear all groups
    groupOperations.getAll().forEach(group => {
      groupOperations.remove(group.id)
    })

    // Clear orchestrations
    orchestration.list().forEach(runtime => {
      orchestration.remove(runtime.config.id)
    })

    // Clear query cache
    query.cache.clear()

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
 * Main CYRE instance with intelligent system orchestration
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
  // Add this to the main cyre object, right before the closing brace

  // State methods
  hasChanged: (id: string, payload: ActionPayload): boolean =>
    io.hasChanged(id, payload),
  getPrevious: (id: string): ActionPayload | undefined => io.getPrevious(id),
  updatePayload: (id: string, payload: ActionPayload): void =>
    payloadState.set(id, payload),

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

      // Stop system orchestrations
      systemOrchestrationIds.forEach(id => {
        orchestration.stop(id)
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

  // System orchestration methods
  getSystemHealth: () => {
    const breathing = metricsState.get().breathing
    const systemStats = metricsReport.getSystemStats()

    return {
      overall: breathing.stress < 0.8 && systemStats.totalErrors < 10,
      breathing: {
        stress: breathing.stress,
        rate: breathing.currentRate,
        healthy: breathing.stress < 0.8
      }
    }
  },

  // Update your adaptSystemLoad function to actually reset stress:
  adaptSystemLoad: (loadLevel: number) => {
    const breathing = metricsState.get().breathing

    if (loadLevel < 0.2) {
      // Recovery mode - reset stress to very low
      breathing.stress = 0.1
      breathing.currentRate = BREATHING.RATES.BASE
    } else {
      // Normal adaptation
      breathing.stress = loadLevel
      breathing.currentRate =
        loadLevel > 0.8
          ? BREATHING.RATES.RECOVERY
          : loadLevel > 0.5
          ? BREATHING.RATES.MAX
          : BREATHING.RATES.BASE
    }

    // Log the adaptation
    if (loadLevel > 0.9) {
      log.warn('High system load detected - adapting orchestration frequency')
    }

    return {adapted: true, loadLevel, newStress: breathing.stress}
  },

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
        ? {ok: true, message: 'TimeKeeper'}
        : {ok: false, message: 'Forget'}
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

  schema,

  // Group system methods
  group: (groupId: string, config: GroupConfig) => {
    return groupOperations.create(groupId, config)
  },

  getGroup: (groupId: string) => {
    return groupOperations.get(groupId)
  },

  updateGroup: (groupId: string, updates: Partial<GroupConfig>) => {
    return groupOperations.update(groupId, updates)
  },

  removeGroup: (groupId: string): boolean => {
    return groupOperations.remove(groupId)
  },

  getAllGroups: () => {
    return groupOperations.getAll()
  },

  getChannelGroups: (channelId: string) => {
    return groupOperations.getChannelGroups(channelId)
  },

  // ALIGNED ORCHESTRATION INTEGRATION
  orchestration,

  // SEAMLESS QUERY INTEGRATION
  query,

  // DEVELOPER EXPERIENCE HELPERS
  dev: {
    // Quick orchestration examples
    createSimpleWorkflow: (id: string, steps: string[]) => {
      const workflow = steps.map((step, index) => ({
        name: `step-${index + 1}`,
        type: 'action' as const,
        targets: step
      }))

      return orchestration.createAndStart({
        id,
        triggers: [
          {name: 'manual', type: 'external' as const} // Manual trigger
        ],
        workflow
      })
    },

    // Trigger manual orchestration execution
    trigger: async (orchestrationId: string, payload?: any) => {
      // This would manually trigger an orchestration
      // Implementation would need to be added to orchestration system
      log.debug(`Manual trigger for orchestration '${orchestrationId}'`)
      // Call the actual orchestration trigger if it exists and is external
      // Note: A more robust implementation would verify the trigger type
      return await cyre.orchestration.trigger(
        orchestrationId,
        'manual',
        payload
      )
    },

    // Debug channel state
    inspect: (channelId: string) => {
      const config = cyre.get(channelId)
      const payload = payloadState.get(channelId)
      const subscriber = subscribers.get(channelId)
      const metrics = io.getMetrics(channelId)
      const groups = cyre.getChannelGroups(channelId)

      return {
        id: channelId,
        config,
        payload,
        hasSubscriber: !!subscriber,
        metrics,
        groups: groups.map(g => g.id),
        queryTime: performance.now()
      }
    },

    // Performance snapshot
    snapshot: () => {
      const systemStats = metricsReport.getSystemStats()
      const queryStats = query.stats()
      const orchestrations = cyre.orchestration.list()

      return {
        system: {
          totalCalls: systemStats.totalCalls,
          callRate: systemStats.callRate,
          uptime: Math.floor((Date.now() - systemStats.startTime) / 1000)
        },
        channels: {
          total: io.getAll().length,
          withSubscribers: subscribers.getAll().length,
          withPayload: query.channels({hasPayload: true}).total
        },
        orchestrations: {
          total: orchestrations.length,
          running: orchestrations.filter(o => o.status === 'running').length
          // system: orchestrations.filter(o => o.id.startsWith('system-')).length // Removed as per type definition
        },
        query: queryStats,
        timestamp: Date.now()
      }
    },

    // Add getSystemMetrics method
    getSystemMetrics: () => {
      const systemStats = metricsReport.getSystemStats()
      return {
        performance: {
          totalCalls: systemStats.totalCalls,
          callRate: systemStats.callRate,
          totalErrors: systemStats.totalErrors,
          uptime: Math.floor((Date.now() - systemStats.startTime) / 1000)
        }
      }
    },

    // Add triggerHealthCheck method
    triggerHealthCheck: async () => {
      return await cyre.orchestration.trigger('system-health-monitor', 'manual')
    }, // Add these methods directly to the main cyre object:
    getSystemHealth: () => {
      const breathing = metricsState.get().breathing
      const systemStats = metricsReport.getSystemStats()

      return {
        overall: breathing.stress < 0.8 && systemStats.totalErrors < 10,
        breathing: {
          stress: breathing.stress,
          rate: breathing.currentRate,
          healthy: breathing.stress < 0.8
        }
      }
    },

    adaptSystemLoad: (loadLevel: number) => {
      // Simple adaptation - just update breathing rate
      const newRate =
        loadLevel > 0.8 ? BREATHING.RATES.RECOVERY : BREATHING.RATES.BASE
      const breathing = metricsState.get().breathing
      breathing.currentRate = newRate
      breathing.stress = loadLevel

      return {adapted: true, loadLevel}
    }, // In the cyre.dev object, add:
    triggerMemoryCleanup: async () => {
      try {
        // Direct memory cleanup since orchestration isn't working
        query.cache.clear()

        // Force garbage collection if available
        if (typeof global !== 'undefined' && global.gc) {
          global.gc()
        }

        return {ok: true, message: 'Memory cleanup completed'}
      } catch (error) {
        return {ok: false, message: String(error)}
      }
    } // In the cyre.orchestration object, add:
  }
}
