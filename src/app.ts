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

//import {schedule} from './orchestration/cyre-schedule'
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
  get: (id: string) => ActionPayload | undefined
  hasChanged: (id: string, payload: ActionPayload) => boolean
  getPrevious: (id: string) => ActionPayload | undefined

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
        message: `${MSG.UNABLE_TO_COMPLY}: ${id}`
      }
    }

    const action = io.get(id)
    if (!action) {
      sensor.error(`${MSG.CALL_INVALID_ID}: ${id}. Channel does not exist`)
      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_INVALID_ID}: ${id}`
      }
    } else if (action._isBlocked) {
      sensor.critical(`${MSG.CALL_NOT_RESPONDING}: ${id}`)
      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_NOT_RESPONDING}: ${id}`
      }
    }

    const {allowed, messages} = metricsState.canCall()
    if (!allowed) {
      if (action.priority?.level === 'critical') {
        // Allow critical actions even during recuperation
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

    // Get request payload - use payload from call or action default
    const req = payload !== undefined ? payload : action.payload

    // Fast path detection
    if (action._hasFastPath) {
      return await useDispatch(action, req)
    }

    // THROTTLE: Use buffer state for temporary storage
    if (action.throttle && action.throttle > 0) {
      const currentTime = Date.now()
      const lastExecTime = action._lastExecTime || 0
      const elapsedSinceLastExec = currentTime - lastExecTime
      const remaining = Math.max(0, action.throttle - elapsedSinceLastExec)

      if (lastExecTime > 0 && elapsedSinceLastExec < action.throttle) {
        return {
          ok: false,
          payload: undefined,
          message: `Call throttled - retry available in ${remaining}ms`
        }
      }
    }

    // DEBOUNCE: Use buffer state for temporary storage
    if (action.debounce && action.debounce > 0) {
      const debounceId = `debounce-${action.id}`

      // Store in buffer state (temporary) - ultra-fast set
      bufferState.set(action.id, req)

      if (timeline.get(debounceId)) {
        TimeKeeper.forget(debounceId)

        const debounceStart = action._debounceStart || Date.now()
        if (action.maxWait && Date.now() - debounceStart >= action.maxWait) {
          const tempPayload = bufferState.get(action.id)
          bufferState.forget(action.id)
          io.set({...action, _debounceStart: undefined})
          return await processCall(action, tempPayload)
        }
      } else {
        io.set({...action, _debounceStart: Date.now()})
      }

      TimeKeeper.keep(
        action.debounce,
        async () => {
          try {
            const latestPayload = bufferState.get(action.id)
            const currentAction = io.get(action.id)
            if (!currentAction) return

            bufferState.forget(action.id)
            io.set({...currentAction, _debounceStart: undefined})

            return await processCall(currentAction, latestPayload)
          } catch (error) {
            bufferState.forget(action.id)
            return {
              ok: false,
              payload: null,
              message: `Debounced execution failed: ${error}`,
              error: String(error)
            }
          }
        },
        1,
        debounceId
      )

      return {
        ok: true,
        payload: req,
        message: `Call debounced - execution scheduled in ${action.debounce}ms`,
        metadata: {delay: action.debounce}
      }
    }

    // BUFFER: Use buffer state for temporary storage
    if (action.buffer && action.buffer.window > 0) {
      const bufferId = `buffer-${action.id}`

      if (!timeline.get(bufferId)) {
        TimeKeeper.keep(
          action.buffer.window,
          async () => {
            try {
              const finalPayload = bufferState.get(action.id) || req
              bufferState.forget(action.id)
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

      // Use dedicated append method for buffer strategy
      if (action.buffer.strategy === 'append') {
        bufferState.append(action.id, req)
      } else {
        bufferState.set(action.id, req) // Default overwrite
      }

      return {
        ok: true,
        payload: req,
        message: `Call buffered - execution scheduled in ${action.buffer.window}ms`,
        metadata: {bufferWindow: action.buffer.window}
      }
    }

    // Direct execution - payload will be saved in processCall -> dispatch
    return await processCall(action, req)
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
    metricsState.reset()
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
    // metricsState.clear()
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

  //schedule,
  // ENHANCED METRICS SYSTEM
  // Add metrics interface

  get: (id: string) => payloadState.get(id),
  // Add this to the main cyre object, right before the closing brace

  // State methods
  hasChanged: (id: string, payload: ActionPayload) =>
    payloadState.hasChanged(id, payload),
  getPrevious: (id: string) => payloadState.getPrevious(id),

  // Control methods with metrics
  pause: (id?: string) => {
    TimeKeeper.pause(id)
    sensor.debug(id || 'system', 'info', 'system-pause')
  },

  resume: (id?: string) => {
    TimeKeeper.resume(id)
    sensor.debug(id || 'system', 'info', 'system-resume')
  },

  lock: () => {
    metricsState.lock()

    return {ok: true, message: 'System locked', payload: null}
  },

  unlock: () => {
    metricsState.unlock()

    return {ok: true, message: 'System unlocked', payload: null}
  },

  shutdown,

  status: () => metricsState.get().hibernating,
  /**
   * Get metrics for system or specific channel
   * @param channelId Optional channel ID for channel-specific metrics
   */
  getMetrics: (channelId?: string) => {
    return metricsState.getMetrics(channelId)
  }
})

export default cyre
