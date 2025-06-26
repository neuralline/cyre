// src/app.ts - Updated with intelligent system orchestration

import type {IO, ActionPayload, CyreResponse} from './types/core'
import {MSG} from './config/cyre-config'
import {log} from './components/cyre-log'
import {subscribe} from './components/cyre-on'
import TimeKeeper from './components/cyre-timekeeper'
import {io, subscribers, timeline} from './context/state'
import {metricsState, updateBreathingFromMetrics} from './context/metrics-state'
import {sensor} from './context/metrics-report'
import {CyreActions} from './components/cyre-actions'
import {processCall} from './components/cyre-call'

import schema from './schema/cyre-schema'
import {groupOperations, removeChannelFromGroups} from './components/cyre-group'
import payloadState from './context/payload-state'

// Import advanced systems
import {orchestration} from './orchestration/orchestration-engine'
import {query} from './query/cyre-query'
import type {OrchestrationConfig} from './types/orchestration'

import {pathPlugin} from './schema/path-plugin'

import {schedule} from './components/cyre-schedule'
import {QuickScheduleConfig, ScheduleConfig} from './types/timeline'
import {dev} from './dev/dev'
import {metrics} from './metrics'
import {useDispatch} from './components/cyre-dispatch'

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
const init = async (
  config: CyreConfig = {}
): Promise<{ok: boolean; payload: number; message: string}> => {
  try {
    if (sysInitialize || metricsState._init) {
      log.sys('System already initialized')
      return {ok: true, payload: Date.now(), message: MSG.ONLINE}
    }

    log.sys(MSG.QUANTUM_HEADER)

    // Initialize advanced systems
    //initializeQuerySystem()

    initializeBreathing()
    TimeKeeper.resume()

    sensor.debug('system', 'success', 'system-initialization')

    sysInitialize = true
    metricsState.init()

    log.success('Cyre initialized with system intelligence')
    sensor.success('initialize', 'Cyre initialized with system intelligence')
    log.debug('System online!')

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
    1000, // reputation interval
    async () => {
      //callback on each reputation
      try {
        await updateBreathingFromMetrics()
      } catch (error) {
        // Silent fail to prevent log spam
        sensor.error('system', 'Breathing update error:', 'initialize')
      }
    },
    true, //repeat infinity or number to count down
    'system-breathing', // id for tracking progress and cancellation
    2000 // start reputation after 2s delay
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
    sensor.error('system', 'error', 'Channel-registration')
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
    sensor.error(
      'system',
      '`Channel registration failed: ${errorMessage}`',
      'app/channel'
    )
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
  try {
    if (!id) {
      sensor.error(`${MSG.UNABLE_TO_COMPLY}: ${id}`)
      return {
        ok: false,
        payload: null,
        message: `${MSG.UNABLE_TO_COMPLY}: ${id} `
      }
    }
    const action = io.get(id)
    if (!action) {
      log.error(`${MSG.CALL_INVALID_ID}: ${id}. Channel does not exist`)

      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_INVALID_ID}: ${id} `
      }
    }

    if (action._isBlocked) {
      log.critical(`${MSG.CALL_NOT_RESPONDING}: ${id}`)
      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_NOT_RESPONDING}: ${id} `
      }
    }
    // log.debug(action)

    // PRE-PIPELINE PROTECTIONS (Block, Throttle, Debounce, Recuperation)

    //STEP 3: Recuperation check
    const breathing = metricsState.get().breathing
    if (breathing.isRecuperating && action.priority?.level !== 'critical') {
      sensor.error(
        'app/call/recuperation',
        'System is recuperating - only critical actions allowed',
        action.id,
        'blocked'
      )
      return {
        ok: false,
        payload: undefined,
        message: 'System is recuperating - only critical actions allowed'
      }
    }
    const req = payload ?? payloadState.get(id)
    //io.set(action)

    // In call() - detect fast path early
    if (action._hasFastPath) {
      // Direct dispatch - skip processCall entirely
      return await useDispatch(action, payload)
    }
    // STEP 4: Throttle check
    // ✅ STEP 4: FIXED Throttle check
    else if (action.throttle && action.throttle > 0) {
      const currentTime = Date.now()
      const lastExecTime = action._lastExecTime || 0

      // FIX 1: Calculate elapsed time from LAST EXECUTION, not action creation
      const elapsedSinceLastExec = currentTime - lastExecTime
      const remaining = Math.max(0, action.throttle - elapsedSinceLastExec)

      // FIX 2: Check if we should throttle (industry standard: first call always passes)
      if (lastExecTime > 0 && elapsedSinceLastExec < action.throttle) {
        return {
          ok: false,
          payload: undefined,
          message: `Throttled - ${remaining}ms remaining`,
          metadata: {
            throttled: true,
            remaining,
            lastExecTime,
            elapsed: elapsedSinceLastExec
          }
        }
      }
    }

    // STEP 5: Debounce check (most complex protection)
    else if (
      action.debounce &&
      action.debounce > 0 &&
      !action._bypassDebounce
    ) {
      const timerId = `${action.id}-debounce-${Date.now()}`

      if (!action._debounceTimer) {
        // First time debounce - execute immediately and set up debounce window

        action._debounceTimer = timerId

        // Store the payload for debounced calls
        payloadState.set(action.id, req, 'call')

        // Update action state
        io.set({
          ...action,
          _debounceTimer: timerId
        })

        return await processCall(action, req)
      } else {
        // Subsequent calls within debounce window

        // Clear existing debounce timer
        TimeKeeper.forget(action._debounceTimer)

        // Check maxWait constraint

        if (
          action.maxWait &&
          Date.now() - action._timestamp >= action.maxWait
        ) {
          // MaxWait exceeded - execute immediately and reset debounce

          action._debounceTimer = undefined

          // Update action state
          io.set({
            ...action,
            _debounceTimer: undefined
          })

          // Execute immediately due to maxWait

          return await processCall(action, req)
        } else {
          // Set up new debounce delay with latest payload
          action._debounceTimer = timerId

          // Update stored payload with latest data
          payloadState.set(action.id, req, 'call')

          // Update action state
          io.set({
            ...action,
            _debounceTimer: timerId
          })

          // Schedule delayed execution using TimeKeeper
          const timerResult = TimeKeeper.keep(
            action.debounce,
            async () => {
              try {
                // Get the latest payload that was stored
                const latestPayload = payloadState.get(action.id) || req

                // Clear timer reference since we're executing now
                const currentAction = io.get(action.id)
                if (currentAction) {
                  currentAction._debounceTimer = undefined

                  // Update action state
                  io.set({
                    ...currentAction,
                    _debounceTimer: undefined
                  })
                }

                // Execute with the latest payload
                const result = await processCall(
                  currentAction || action,
                  latestPayload
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

          if (timerResult.ok === 'error') {
            sensor.error(
              action.id,
              '  timerResult.error',
              'debounce-timer-creation-failed'
            )

            // Clear debounce state on timer creation failure
            action._debounceTimer = undefined

            io.set({
              ...action,
              _debounceTimer: undefined
            })

            return {
              ok: false,
              payload: null,
              message: `Debounce timer creation failed: ${timerResult.error}`,
              error: timerResult.error
            }
          }

          // Return debounced response
          return {
            ok: true,
            payload: req,
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

    // Execute the processing pipeline
    const result = await processCall(action, req)

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(id, errorMessage, 'call-execution')

    return {
      ok: false,
      payload: null,
      message: `Call failed: ${errorMessage}`,
      error: errorMessage
    }
  }
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
      sensor.info(id, 'Action removal successful')

      return true
    }

    sensor.info(id, 'Action removal failed - not found')
    return false
  } catch (error) {
    log.error(`Failed to forget ${id}: ${error}`)
    sensor.error(id, String(error), 'action-removal')
    return false
  }
}
const shutdown = (): void => {
  try {
    sensor.debug('system', 'critical', 'system-shutdown')
    sensor.sys('system', 'Initiating system shutdown')

    // Stop system orchestrations
    systemOrchestrationIds.forEach(id => {
      orchestration.stop(id)
    })

    reset()
    sensor.debug('System offline!')
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(0)
    }
  } catch (error) {
    sensor.critical('shutdown', 'System-shutdown failed')
  }
}

/**
 * Clear system with all integrations
 */
const reset = (): void => {
  try {
    sensor.info('system', 'System clear initiated')

    // Stop system orchestrations first
    systemOrchestrationIds.forEach(id => {
      orchestration.stop(id)
      orchestration.forget(id)
    })

    io.clear()
    subscribers.clear()
    timeline.clear()
    metrics.reset()
    metricsState.reset()
    payloadState.clear()

    // Clear all groups
    groupOperations.getAll().forEach(group => {
      groupOperations.remove(group.id)
    })

    // Clear orchestrations
    orchestration.list().forEach(runtime => {
      orchestration.forget(runtime.config.id)
    })

    // Clear query cache
    query.cache.clear()

    log.success('System cleared')
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
  init,
  action,
  on: subscribe,
  call,
  forget,
  clear: reset,

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
    payloadState.hasChanged(id, payload),
  getPrevious: (id: string): ActionPayload | undefined =>
    payloadState.getPrevious(id),
  updatePayload: (id: string, payload: ActionPayload): void =>
    payloadState.set(id, payload),

  // Control methods with metrics
  pause: (id?: string): void => {
    TimeKeeper.pause(id)
    sensor.debug(id || 'system', 'info', 'system-pause')
  },

  resume: (id?: string): void => {
    TimeKeeper.resume(id)
    sensor.debug(id || 'system', 'info', 'system-resume')
  },

  lock: (): {ok: boolean; message: string; payload: null} => {
    metricsState.lock()
    sensor.sys('system', 'lock', 'system-lock')
    return {ok: true, message: 'System locked', payload: null}
  },

  shutdown,

  status: (): boolean => metricsState.get().hibernating
})

export default cyre
