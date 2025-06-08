// src/app.ts - Updated with intelligent system orchestration

import type {IO, ActionPayload, CyreResponse, GroupConfig} from './types/core'
import {BREATHING, MSG} from './config/cyre-config'
import {log} from './components/cyre-log'
import {subscribe} from './components/cyre-on'
import TimeKeeper from './components/cyre-timekeeper'
import {io, subscribers, timeline} from './context/state'
import {
  calculateSystemStress,
  metricsState,
  updateBreathingFromMetrics
} from './context/metrics-state'
import {sensor} from './context/metrics-report'
import {CyreActions} from './components/cyre-actions'
import {processCall} from './components/cyre-call'

import schema from './schema/cyre-schema'
import {groupOperations, removeChannelFromGroups} from './components/cyre-group'
import payloadState from './context/payload-state'

// Import advanced systems
import {orchestration} from './orchestration/orchestration-engine'
import {query, initializeQuerySystem} from './query/cyre-query'
import type {OrchestrationConfig} from './types/orchestration'

import {pathPlugin} from './schema/path-plugin'

import {schedule} from './components/cyre-schedule'
import {QuickScheduleConfig, ScheduleConfig} from './types/timeline'
import {dev} from './dev/dev'
import {metrics} from './metrics'

import {registerSystemIntelligence} from './intelligence/system-intelligence'
import {runDiagnostics} from './intelligence/system-diagnostics'

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

        Path System Features:
        - Hierarchical channel organization: 'app/users/profile/settings'
        - Pattern-based operations: 'building/* /temperature'
        - Foreign key indexing for O(1) performance
        - Clean plugin architecture with private internals
        - Backward compatibility with existing flat IDs

        example use:
        // ID-based
        cyre.action({id: 'user-profile', payload: userData})
        cyre.on('user-profile', handler)
        cyre.call('user-profile', newData)

        // path-based  
        cyre.action({id: 'user-profile', path: 'app/users/profile', payload: userData})
        cyre.path.call('app/users/*', newData)  // Call all user channels
        cyre.path.on('app/*', handler)          // Subscribe to all app events

    Flow: call() → processCall() → applyPipeline() → dispatch() → cyreExecute() → .on() → [IntraLink → call()]
    Path: pathEngine indexes → pattern matching → foreign key lookups → batch operations


    Cyre's first law: A robot can not injure a human being or allow a human being to be harmed by not helping.
    
     

*/

// Track initialization state
let systemOrchestrationIds: string[] = []
let sysInitialize = false

/**
 * Initialize with standardized system intelligence
 */
const initialize = async (
  config: CyreConfig = {}
): Promise<{ok: boolean; payload: number; message: string}> => {
  try {
    if (sysInitialize || metricsState._init) {
      log.sys('System already initialized')
      return {ok: true, payload: Date.now(), message: MSG.ONLINE}
    }

    log.sys(MSG.QUANTUM_HEADER)

    // Initialize advanced systems
    initializeQuerySystem()

    initializeBreathing()
    TimeKeeper.resume()

    // Register standardized system intelligence
    // try {
    //   const intelligenceResults = await registerSystemIntelligence(
    //     orchestration
    //   )
    //   systemOrchestrationIds.push(...intelligenceResults.registered)

    //   if (intelligenceResults.failed.length > 0) {
    //     sensor.debug(
    //       'initialize',
    //       `System intelligence: ${intelligenceResults.registered.length} registered, ${intelligenceResults.failed.length} failed`,
    //       {
    //         registered: intelligenceResults.registered,
    //         failed: intelligenceResults.failed
    //       }
    //     )
    //   } else {
    //     sensor.success(
    //       'initialize',
    //       `Registered ${intelligenceResults.registered.length} system intelligence orchestrations`
    //     )
    //   }
    // } catch (error) {
    //   sensor.debug(
    //     'initialize',
    //     'System intelligence registration deferred - will be available after system setup'
    //   )
    // }

    // // Register system diagnostics for comprehensive testing
    // try {
    //   const diagnosticsResults = registerSystemDiagnostics(orchestration)
    //   systemOrchestrationIds.push(...diagnosticsResults.registered)

    //   if (diagnosticsResults.failed.length > 0) {
    //     sensor.warn(
    //       'initialize',
    //       `System diagnostics: ${diagnosticsResults.registered.length} registered, ${diagnosticsResults.failed.length} failed`,
    //       {
    //         registered: diagnosticsResults.registered,
    //         failed: diagnosticsResults.failed
    //       }
    //     )
    //   } else {
    //     sensor.success(
    //       'initialize',
    //       `Registered ${diagnosticsResults.registered.length} system diagnostic orchestrations`
    //     )
    //   }
    // } catch (error) {
    //   sensor.error(
    //     'initialize',
    //     `System diagnostics registration deferred: ${error}`
    //   )
    // }

    sensor.debug('initialize', ` subscribers`)

    sensor.log('system', 'success', 'system-initialization', {
      timestamp: Date.now(),
      features: [
        'core-system',
        'system-intelligence',
        'orchestration-engine',
        'path-addressing',
        'query-system',
        'metrics-tracking',
        'breathing-system',
        'persistent-state'
      ]
    })

    sysInitialize = true
    metricsState.init()

    log.success('Cyre initialized with system intelligence')
    sensor.success('initialize', 'Cyre initialized with system intelligence')

    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.critical(`Cyre failed to initialize : ${errorMessage}`)
    sensor.critical('system', errorMessage, 'system-initialization')
    shutdown()
    return {ok: false, payload: undefined, message: errorMessage}
  }
}

/**
 * Initialize breathing system with metrics integration
 */
const initializeBreathing = (): void => {
  TimeKeeper.keep(
    1000, // Check every second
    async () => {
      try {
        await updateBreathingFromMetrics()
      } catch (error) {
        // Silent fail to prevent log spam
        console.error('Breathing update error:', error)
      }
    },
    true,
    'system-breathing'
  )

  sensor.info('system', 'Breathing system initialized with metrics integration')
}
/**
 * Action registration with automatic orchestration trigger detection
 */
const action = (
  attribute: IO | IO[]
): {ok: boolean; message: string; payload?: any} => {
  if (metricsState.isLocked()) {
    sensor.error('system', 'error', 'Channel-registration', {
      error: 'System is locked'
    })
    log.error(MSG.SYSTEM_LOCKED_CHANNELS)
    return {ok: false, message: MSG.SYSTEM_LOCKED_CHANNELS}
  }

  try {
    if (Array.isArray(attribute)) {
      const results = attribute.map(singleAction => {
        const result = CyreActions(singleAction)

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

      return result
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Channel registration failed: ${errorMessage}`)
    sensor.error('system', 'error', 'Channel-registration', {
      error: errorMessage
    })
    return {ok: false, message: `Channel registration failed: ${errorMessage}`}
  }
}

/**
 * Call execution with pre-pipeline protections
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
  const originalPayload = payload ?? action.payload

  try {
    sensor.log(id, 'call', 'call-entry', {
      timestamp: callStartTime,
      hasPayload: payload !== undefined,
      payloadType: typeof payload,
      actionType: action.type || 'unknown'
    })

    // PRE-PIPELINE PROTECTIONS (Block, Throttle, Debounce, Recuperation)

    // STEP 1: Pre-computed blocking check (immediate exit)
    if (action._isBlocked) {
      sensor.log(action.id, 'blocked', 'pre-computed-block', {
        reason: action._blockReason
      })
      return {
        ok: false,
        payload: undefined,
        message: action._blockReason || 'Action blocked'
      }
    }

    // STEP 2: Block talent check
    if (action.block === true) {
      sensor.log(action.id, 'blocked', 'talent-block')
      return {
        ok: false,
        payload: undefined,
        message: 'Action is blocked'
      }
    }

    // STEP 3: Recuperation check
    const breathing = metricsState.get().breathing
    if (breathing.isRecuperating && action.priority?.level !== 'critical') {
      sensor.log(
        action.id,
        'blocked',
        'call/recuperation',
        {
          stress: breathing.stress,
          priority: action.priority?.level || 'medium'
        },
        'System is recuperating - only critical actions allowed',
        true
      )
      return {
        ok: false,
        payload: undefined,
        message: 'System is recuperating - only critical actions allowed'
      }
    }

    // STEP 4: Throttle check
    if (action.throttle && action.throttle > 0) {
      const metrics = io.getMetrics(action.id)
      const lastExecTime = metrics?.lastExecutionTime || 0

      if (lastExecTime > 0) {
        const elapsed = Date.now() - lastExecTime
        if (elapsed < action.throttle) {
          const remaining = action.throttle - elapsed
          sensor.throttle(action.id, {throttleMs: action.throttle, remaining})
          return {
            ok: false,
            payload: undefined,
            message: `Throttled - ${remaining}ms remaining`,
            metadata: {
              throttled: true,
              remaining
            }
          }
        }
      }
    }

    // STEP 5: Debounce check (most complex protection)
    if (action.debounce && action.debounce > 0 && !action._bypassDebounce) {
      const timerId = `${action.id}-debounce-${Date.now()}`

      if (!action._debounceTimer) {
        // First time debounce - execute immediately and set up debounce window
        action._firstDebounceCall = Date.now()
        action._debounceTimer = timerId

        // Store the payload for debounced calls
        payloadState.set(action.id, originalPayload, 'call')

        // Update action state
        io.set({
          ...action,
          _debounceTimer: timerId,
          _firstDebounceCall: action._firstDebounceCall
        })

        sensor.log(action.id, 'info', 'debounce-first-execution', {
          debounceMs: action.debounce,
          timerId: timerId.slice(-8)
        })

        // Execute immediately for first call
        const result = await processCall(action, originalPayload)

        sensor.log(action.id, 'success', 'debounce-first-execution-complete', {
          success: result.ok,
          finalMessage: result.message
        })

        return result
      } else {
        // Subsequent calls within debounce window

        // Clear existing debounce timer
        TimeKeeper.forget(action._debounceTimer)

        // Check maxWait constraint
        const firstCallTime = action._firstDebounceCall || Date.now()
        if (action.maxWait && Date.now() - firstCallTime >= action.maxWait) {
          // MaxWait exceeded - execute immediately and reset debounce
          action._firstDebounceCall = undefined
          action._debounceTimer = undefined

          // Update action state
          io.set({
            ...action,
            _debounceTimer: undefined,
            _firstDebounceCall: undefined
          })

          sensor.log(action.id, 'info', 'debounce-maxwait-exceeded', {
            maxWait: action.maxWait,
            firstCallTime: firstCallTime,
            elapsed: Date.now() - firstCallTime
          })

          // Execute immediately due to maxWait
          const result = await processCall(action, originalPayload)

          sensor.log(
            action.id,
            'success',
            'debounce-maxwait-execution-complete',
            {
              success: result.ok,
              finalMessage: result.message
            }
          )

          return result
        } else {
          // Set up new debounce delay with latest payload
          action._debounceTimer = timerId

          // Update stored payload with latest data
          payloadState.set(action.id, originalPayload, 'call')

          // Update action state
          io.set({
            ...action,
            _debounceTimer: timerId,
            _firstDebounceCall: firstCallTime
          })

          // Schedule delayed execution using TimeKeeper
          const timerResult = TimeKeeper.keep(
            action.debounce,
            async () => {
              try {
                // Get the latest payload that was stored
                const latestPayload =
                  payloadState.get(action.id) || originalPayload

                // Clear timer reference since we're executing now
                const currentAction = io.get(action.id)
                if (currentAction) {
                  currentAction._debounceTimer = undefined
                  currentAction._firstDebounceCall = undefined

                  // Update action state
                  io.set({
                    ...currentAction,
                    _debounceTimer: undefined,
                    _firstDebounceCall: undefined
                  })
                }

                sensor.log(action.id, 'info', 'debounce-delayed-execution', {
                  executedAfterDelay: true,
                  timestamp: Date.now(),
                  timerId: timerId.slice(-8)
                })

                // Execute with the latest payload
                const result = await processCall(
                  currentAction || action,
                  latestPayload
                )

                sensor.log(
                  action.id,
                  'success',
                  'debounce-delayed-execution-complete',
                  {
                    success: result.ok,
                    finalMessage: result.message
                  }
                )

                return result
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error)

                sensor.error(
                  action.id,
                  errorMessage,
                  'debounce-delayed-execution-error'
                )

                return {
                  ok: false,
                  payload: null,
                  message: `Debounce execution failed: ${errorMessage}`,
                  error: errorMessage
                }
              }
            },
            1, // Execute only once
            timerId
          )

          if (timerResult.kind === 'error') {
            sensor.error(
              action.id,
              timerResult.error,
              'debounce-timer-creation-failed'
            )

            // Clear debounce state on timer creation failure
            action._debounceTimer = undefined
            action._firstDebounceCall = undefined

            io.set({
              ...action,
              _debounceTimer: undefined,
              _firstDebounceCall: undefined
            })

            return {
              ok: false,
              payload: null,
              message: `Debounce timer creation failed: ${timerResult.error}`,
              error: timerResult.error
            }
          }

          sensor.log(action.id, 'info', 'debounce-delayed-scheduled', {
            debounceMs: action.debounce,
            timerId: timerId.slice(-8),
            payloadUpdated: true
          })

          // Return debounced response
          return {
            ok: true,
            payload: originalPayload,
            message: `Debounced - will execute in ${action.debounce}ms with latest payload`,
            metadata: {
              debounced: true,
              delay: action.debounce,
              timerId: timerId.slice(-8),
              executionPath: 'debounce-delayed'
            }
          }
        }
      }
    }

    // ALL PRE-PIPELINE PROTECTIONS PASSED - Continue to pipeline

    sensor.log(action.id, 'info', 'pre-pipeline-passed', {
      protections: {
        block: !!action.block,
        throttle: !!(action.throttle && action.throttle > 0),
        debounce: !!(action.debounce && action.debounce > 0),
        recuperation: breathing.isRecuperating
      }
    })

    // Execute the processing pipeline
    const result = await processCall(action, originalPayload)

    const totalCallTime = Date.now() - callStartTime

    sensor.log(id, 'info', 'call-completion', {
      success: result.ok,
      totalCallTime,
      callPath: result.metadata?.executionPath || 'unknown'
    })

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const totalCallTime = Date.now() - callStartTime

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
const on = (
  actionId: string,
  handler: (...args: any[]) => any
): CyreResponse | any => {
  const result = subscribe(actionId, handler)
  if (result.ok) {
    sensor.info(actionId, 'Subscription successful', {
      subscriptionSuccess: true,
      timestamp: Date.now()
    })
  } else {
    sensor.error(actionId, result.message, 'subscription-failed', {
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
      sensor.info(id, 'Action removal successful', {
        success: true,
        actionRemoved,
        subscriberRemoved
      })

      return true
    }

    sensor.info(id, 'Action removal failed - not found', {
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
const shutdown = (): void => {
  try {
    sensor.log('system', 'critical', 'system-shutdown', {
      timestamp: Date.now()
    })
    log.critical('initiating system shutdown')

    // Stop system orchestrations
    systemOrchestrationIds.forEach(id => {
      orchestration.stop(id)
    })

    clear()

    if (typeof process !== 'undefined' && process.exit) {
      process.exit(0)
    }
  } catch (error) {
    log.critical(`Shutdown failed: ${error}`)
    sensor.critical('system', String(error), 'system-shutdown')
  }
}

/**
 * Clear system with all integrations
 */
const clear = (): void => {
  try {
    sensor.info('system', 'System clear initiated', {
      timestamp: Date.now(),
      log: true
    })

    // Stop system orchestrations first
    systemOrchestrationIds.forEach(id => {
      orchestration.stop(id)
      orchestration.remove(id)
    })

    io.clear()
    subscribers.clear()
    timeline.clear()
    metrics.reset()
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

    log.success('System cleared')
    sensor.success('system', 'System clear completed successfully', {
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
export const cyre = Object.freeze({
  // Core methods
  initialize,
  action,
  on,
  call,
  forget,
  clear,

  // ALIGNED ORCHESTRATION INTEGRATION
  orchestration,
  schema,

  // SEAMLESS QUERY INTEGRATION
  query,
  path: pathPlugin,
  // DEVELOPER EXPERIENCE HELPERS
  dev,

  schedule,
  // ENHANCED METRICS SYSTEM
  // Add metrics interface
  metrics,
  get: (id: string): IO | undefined => io.get(id),
  // Add this to the main cyre object, right before the closing brace

  // State methods
  hasChanged: (id: string, payload: ActionPayload): boolean =>
    io.hasChanged(id, payload),
  getPrevious: (id: string): ActionPayload | undefined => io.getPrevious(id),
  updatePayload: (id: string, payload: ActionPayload): void =>
    payloadState.set(id, payload),

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

  shutdown,

  status: (): boolean => metricsState.get().hibernating,

  // System monitoring with metrics integration
  getSystemHealth: () => {
    const breathing = metricsState.get().breathing
    const systemMetrics = metrics.getSystemMetrics()
    const analysis = metrics.analyze()

    return {
      overall:
        breathing.stress < 0.8 && analysis.health.factors.errorRate < 0.1,
      breathing: {
        stress: breathing.stress,
        rate: breathing.currentRate,
        healthy: breathing.stress < 0.8
      },
      metrics: {
        callRate: systemMetrics.callRate,
        successRate: analysis.health.factors.successRate,
        errorRate: analysis.health.factors.errorRate,
        averageLatency: analysis.health.factors.latency
      }
    }
  },

  // Breathing system controls with metrics awareness
  adaptSystemLoad: (loadLevel: number) => {
    const breathing = metricsState.get().breathing
    const systemMetrics = metrics.getSystemMetrics()

    if (loadLevel < 0.2) {
      // Recovery mode - reset stress to very low
      breathing.stress = 0.1
      breathing.currentRate = BREATHING.RATES.BASE
    } else {
      // Normal adaptation based on actual metrics
      const metricsStress = calculateSystemStress()
      breathing.stress = Math.max(loadLevel, metricsStress)
      breathing.currentRate =
        breathing.stress > 0.8
          ? BREATHING.RATES.RECOVERY
          : breathing.stress > 0.5
          ? BREATHING.RATES.MAX
          : BREATHING.RATES.BASE
    }

    // Log the adaptation with metrics context
    if (loadLevel > 0.9) {
      log.warn('High system load detected - adapting orchestration frequency')
      sensor.warn('system', 'Load adaptation triggered', {
        requestedLoad: loadLevel,
        actualStress: breathing.stress,
        callRate: systemMetrics.callRate,
        newBreathingRate: breathing.currentRate
      })
    }

    return {
      adapted: true,
      loadLevel,
      newStress: breathing.stress,
      metricsSnapshot: {
        callRate: systemMetrics.callRate,
        totalCalls: systemMetrics.totalCalls,
        totalErrors: systemMetrics.totalErrors
      }
    }
  },

  // Monitoring methods with metrics integration
  getBreathingState: () => {
    const state = metricsState.get().breathing
    const systemMetrics = metrics.getSystemMetrics()

    return {
      ...state,
      // Include relevant metrics context
      metricsContext: {
        callRate: systemMetrics.callRate,
        totalCalls: systemMetrics.totalCalls,
        totalErrors: systemMetrics.totalErrors,
        uptime: systemMetrics.uptime
      }
    }
  },

  getPerformanceState: () => {
    const systemMetrics = metrics.getSystemMetrics()
    const analysis = metrics.analyze()
    const breathing = metricsState.get().breathing

    return {
      totalProcessingTime: 0, // Could be calculated from metrics
      totalCallTime: 0, // Could be calculated from metrics
      totalStress: breathing.stress,
      stress: breathing.stress,
      callRate: systemMetrics.callRate,
      totalCalls: systemMetrics.totalCalls,
      totalExecutions: systemMetrics.totalExecutions,
      successRate: analysis.health.factors.successRate,
      errorRate: analysis.health.factors.errorRate,
      averageLatency: analysis.health.factors.latency
    }
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
  }, // System diagnostics methods
  runSystemDiagnostics: async () => {
    return await runDiagnostics()
  },

  getSystemDiagnostics: () => {
    const overview = cyre.orchestration.getSystemOverview()
    const breathing = metricsState.get().breathing
    const systemMetrics = metrics.getSystemMetrics()

    return {
      timestamp: Date.now(),
      orchestrations: {
        total: overview.total.orchestrations,
        running: overview.total.running,
        active: overview.total.activeTriggers
      },
      breathing: {
        stress: breathing.stress,
        rate: breathing.currentRate,
        isRecuperating: breathing.isRecuperating
      },
      metrics: {
        totalCalls: systemMetrics.totalCalls,
        callRate: systemMetrics.callRate,
        totalErrors: systemMetrics.totalErrors,
        uptime: systemMetrics.uptime
      },
      timeline: {
        total: timeline.getAll().length,
        active: timeline.getActive().length
      }
    }
  },

  // Manual trigger for immediate diagnostics
  triggerDiagnostics: async () => {
    try {
      log.info('🔍 Manual diagnostics triggered...')
      const result = await cyre.call('system-diagnostics-runner', {
        manual: true
      })

      if (result.ok) {
        log.success('🔍 Manual diagnostics completed successfully')
        return result.payload
      } else {
        log.error(`🔍 Manual diagnostics failed: ${result.message}`)
        return null
      }
    } catch (error) {
      log.error(`🔍 Manual diagnostics error: ${error}`)
      return null
    }
  }
})

export default cyre
