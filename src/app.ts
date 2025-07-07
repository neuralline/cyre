// src/app.ts - Updated with intelligent system orchestration

import type {
  IO,
  ActionPayload,
  CyreResponse,
  EventHandler,
  SubscriptionResponse
} from './types/core'
import {MSG} from './config/cyre-config'
import {subscribe} from './components/cyre-on'
import TimeKeeper from './components/cyre-timekeeper'
import {io, subscribers, timeline} from './context/state'
import {metricsState, updateBreathingFromMetrics} from './context/metrics-state'
import {sensor} from './components/sensor'
import {bufferState} from './context/buffer-state'
import {CyreActions} from './components/cyre-actions'
import {processCall} from './components/cyre-call'

import payloadState from './context/payload-state'

// Import advanced systems
import {orchestration} from './orchestration/orchestration-engine'

import {schedule} from './components/cyre-schedule'
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
        cyre.action({id: 'taxi', payload: 44085648634})
        cyre.on('taxi', number => {
            console.log('Calling taxi @', number)
        })
        cyre.call('taxi') 

       

        Path System Features:
        - Hierarchical channel organization: 'app/users/profile/settings'
        - Pattern-based operations: 'building/* /temperature'
        - Foreign key indexing for O(1) performance
        - Clean plugin architecture with private internals
        - Backward compatibility with existing flat IDs

        example use:
        cyre.action({id: 'user-profile', payload: userData})
        cyre.on('user-profile', handler)
        cyre.call('user-profile', newData)

        // path-based  
        cyre.action({id: 'user-profile', path: 'app/users/profile', payload: userData})

    Flow: call() → processCall() → applyPipeline() → dispatch() → cyreExecute() → .on() → [IntraLink → call()]


    Cyre's first law: A robot can not injure a human being or allow a human being to be harmed by not helping.
    
     

*/

// Track initialization state
export interface CyreInstance {
  // Core methods
  init: () => Promise<{ok: boolean; payload: number | null; message: string}>
  action: (config: IO | IO[]) => {ok: boolean; message: string; payload?: any}
  on: (id: string, handler: EventHandler) => SubscriptionResponse
  call: (id: string, payload?: ActionPayload) => Promise<CyreResponse>
  get: (id: string) => IO | undefined
  forget: (id: string) => boolean
  clear: () => void
  reset: () => void

  // Orchestration integration
  //orchestration: typeof import('./orchestration/orchestration-engine').orchestration

  // Path system
  path: () => string

  // Developer experience helpers
  //schedule: typeof import('./components/cyre-schedule').schedule

  // State methods
  hasChanged: (id: string, payload: ActionPayload) => boolean
  getPrevious: (id: string) => ActionPayload | undefined
  updatePayload: (id: string, payload: ActionPayload) => void

  // NEW: Dual payload system access
  //payloadState

  // Control methods with metrics
  pause: (id?: string) => void
  resume: (id?: string) => void
  lock: () => {ok: boolean; message: string; payload: null}
  unlock: () => {ok: boolean; message: string; payload: null}
  shutdown: () => void
  status: () => boolean

  // Metrics API
  getMetrics: (
    channelId?: string
  ) =>
    | import('./types/system').ChannelMetricsResult
    | import('./types/system').SystemMetricsResult
    | {error: string; available: false}
}

/**
 * Initialize with standardized system intelligence
 */
const init = async (): Promise<{
  ok: boolean
  payload: number | null
  message: string
}> => {
  try {
    if (metricsState.isInit()) {
      sensor.sys('System already initialized')
      return {ok: true, payload: Date.now(), message: MSG.ONLINE}
    }

    sensor.sys(MSG.QUANTUM_HEADER)

    // Initialize advanced systems
    //initializeQuerySystem()

    initializeBreathing()
    TimeKeeper.resume()

    sensor.debug('system', 'success', 'system-initialization')

    metricsState.init()

    sensor.success('Cyre initialized with system intelligence')
    sensor.success('initialize', 'Cyre initialized with system intelligence')
    sensor.debug('System online!')

    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.critical(`Cyre failed to initialize : ${errorMessage}`)
    sensor.critical('system', errorMessage, 'system-initialization')
    shutdown()
    return {ok: false, payload: null, message: errorMessage}
  }
}

/**
 * Initialize breathing system with metrics integration
 */
const initializeBreathing = (): void => {
  TimeKeeper.keep(
    1000,
    async () => {
      //callback on each reputation
      try {
        await updateBreathingFromMetrics()
        return undefined // ✅ Explicit return for async function
      } catch (error) {
        // Silent fail to prevent log spam
        sensor.error('system', 'Breathing update error:', 'initialize')
        return undefined // ✅ Return in catch block too
      }
    },
    true,
    'system-breathing',
    1000
  )

  sensor.info('system', 'Breathing system initialized with metrics integration')
}
/**
 * Action registration with automatic orchestration trigger detection
 */
const action = (
  attribute: IO | IO[]
): {ok: boolean; message: string; payload?: any} => {
  // HOT PATH OPTIMIZATION: Single flag check instead of multiple conditions
  const {allowed, messages} = metricsState.canRegister()
  if (!allowed) {
    sensor.error(messages, 'system-error', 'Channel-registration')

    return {ok: false, message: messages.join(', ')}
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
      sensor.error(`${MSG.CALL_INVALID_ID}: ${id}. Channel does not exist`)

      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_INVALID_ID}: ${id} `
      }
    }

    if (action._isBlocked) {
      sensor.critical(`${MSG.CALL_NOT_RESPONDING}: ${id}`)
      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_NOT_RESPONDING}: ${id} `
      }
    }
    // log.debug(action)

    // HOT PATH OPTIMIZATION: Single flag check for system conditions
    const {allowed, messages} = metricsState.canCall()
    if (!allowed) {
      // Special case: Allow critical actions even during recuperation
      if (action.priority?.level === 'critical') {
        // Continue with critical action
      } else {
        sensor.error(
          'app/call/system',
          messages.join(', '),
          action.id,
          'blocked'
        )
        return {
          ok: false,
          payload: undefined,
          message: messages.join(', ')
        }
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
          message: `Call throttled - retry available in ${remaining}ms`
        }
      }
    }

    // STEP 5: Debounce check (most complex protection)
    // In call() function - simplified debounce check
    else if (action.debounce && action.debounce > 0) {
      const debounceId = `debounce-${action.id}`

      // Check if already in debounce state
      if (timeline.get(debounceId)) {
        // Cancel existing debounce timer
        TimeKeeper.forget(debounceId)

        // Check maxWait constraint
        if (
          action.maxWait &&
          Date.now() - action._debounceStart >= action.maxWait
        ) {
          // MaxWait exceeded - execute immediately
          io.set({...action, _debounceStart: undefined})
          return await processCall(action, payload)
        }
      } else {
        // First debounce call - set start time
        io.set({...action, _debounceStart: Date.now()})
      }

      // Store latest payload and schedule debounced execution
      payloadState.set(action.id, payload, 'call')

      // Fix for the debounce callback in app.ts
      // The catch block needs a return statement

      TimeKeeper.keep(
        action.debounce,
        async () => {
          try {
            const latestPayload = payloadState.get(action.id) || payload
            const currentAction = io.get(action.id) // Get the FULL action object
            if (!currentAction) return
            // Clear debounce state PROPERLY
            io.set({
              ...currentAction, // Use the complete action object
              _debounceStart: undefined
            })

            // Execute with the complete action
            return await processCall(currentAction, latestPayload)
          } catch (error) {
            // Handle error properly
            return {
              ok: false,
              payload: null,
              message: `Debounced execution failed: ${error}`,
              error: String(error)
            } // ✅ Add explicit return in catch block
          }
        },
        1,
        debounceId
      )

      return {
        ok: true,
        payload,
        message: `Call debounced - execution scheduled in ${action.debounce}ms`,
        metadata: {delay: action.debounce}
      }
    }

    // Buffer protection - ultra-fast buffering
    else if (action.buffer && action.buffer.window > 0) {
      const bufferId = `buffer-${action.id}`

      if (!timeline.get(bufferId)) {
        // First call - start buffer window
        TimeKeeper.keep(
          action.buffer.window,
          async () => {
            try {
              // Get final buffered payload
              const finalPayload = bufferState.get(action.id) || payload

              // Clear buffer
              bufferState.clear(action.id)

              // Execute with final payload
              return await processCall(action, finalPayload)
            } catch (error) {
              return {
                ok: false,
                payload: null,
                message: `Buffer execution failed: ${error}`,
                error: String(error)
              }
            }
          },
          1,
          bufferId
        )
      }

      // Store payload in ultra-fast buffer (no payloadState!)
      bufferState.set(action.id, payload, action.buffer.strategy || 'overwrite')

      return {
        ok: true,
        payload,
        message: `Call buffered - execution scheduled in ${action.buffer.window}ms`,
        metadata: {bufferWindow: action.buffer.window}
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
    //removeChannelFromGroups(id)

    if (actionRemoved || subscriberRemoved) {
      //sensor.info(id, 'Action removal successful')

      return true
    }

    sensor.info(`No channel found to remove for id: ${id}`, 'action-removal')
    return false
  } catch (error) {
    sensor.error(`Failed to forget ${id}: ${error}`)
    sensor.error(id, String(error), 'action-removal')
    return false
  }
}
const shutdown = (): void => {
  try {
    sensor.sys('system', 'Initiating system shutdown')
    sensor.debug('system', 'critical', 'system-shutdown')

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
    sensor.debug('System reset initiated')

    io.clear()
    subscribers.clear()
    timeline.clear()
    //metrics.reset()
    metricsState.reset()
    payloadState.clear()

    // Clear all groups

    sensor.success('System cleared')
  } catch (error) {
    sensor.error(`Clear operation failed: ${error}`)
    sensor.critical('system', String(error), 'system-clear')
  }
}
/**
 * Main CYRE instance with intelligent system orchestration
 */
export const cyre: CyreInstance = Object.freeze({
  // Core methods
  init,
  action,
  on: subscribe,
  call,
  forget,
  clear: reset,
  reset,
  // ALIGNED ORCHESTRATION INTEGRATION
  orchestration,

  // SEAMLESS QUERY INTEGRATION
  //query,
  path: () => {
    return ''
  },
  // DEVELOPER EXPERIENCE HELPERS

  schedule,
  // ENHANCED METRICS SYSTEM
  // Add metrics interface

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

    return {ok: true, message: 'System locked', payload: null}
  },

  unlock: (): {ok: boolean; message: string; payload: null} => {
    metricsState.unlock()

    return {ok: true, message: 'System unlocked', payload: null}
  },

  shutdown,

  status: (): boolean => metricsState.get().hibernating,
  /**
   * Get metrics for system or specific channel
   * @param channelId Optional channel ID for channel-specific metrics
   */
  getMetrics: (channelId?: string) => {
    return metricsState.getMetrics(channelId)
  },

  // NEW: Dual payload system access
  payloadState
})

export default cyre
