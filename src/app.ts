// src/app.ts - FIXED payload updates for interval actions
// Main CYRE application entry point with enhanced action pipeline timing

import {log} from './components/cyre-log'
import {subscribe} from './components/cyre-on'
import CyreChannel from './components/cyre-channels'
import CyreAction, {
  buildActionPipeline,
  executeActionPipeline,
  enhancedDispatch
} from './components/cyre-actions'
import timeKeeper from './components/cyre-timekeeper'
import {io, subscribers, middlewares} from './context/state'
import {metricsState} from './context/metrics-state'
import {historyState} from './context/history-state'
import {metricsReport} from './context/metrics-report'
import dataDefinitions from './elements/data-definitions'
import {MSG, BREATHING} from './config/cyre-config'
import type {
  IO,
  ActionId,
  ActionPayload,
  BreathingMetrics,
  CyreResponse,
  Subscriber,
  SubscriptionResponse,
  TimekeeperMetrics
} from './types/interface'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.0.3+ 2025

    Enhanced with detailed action pipeline timing measurement:
    - Proper separation of action pipeline overhead vs listener execution
    - Industry-aligned performance thresholds  
    - Detailed timing breakdowns and optimization suggestions
    - Real-time performance monitoring and warnings
    
    FIXED: Payload updates for interval actions
    - Most recent payload is used for subsequent executions
    - Proper payload tracking and updating for repeated actions

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
*/

/**
 * FIXED: Store for tracking latest payloads for interval actions
 */
const intervalPayloads = new Map<string, ActionPayload>()

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

/**
 * Enhanced dispatcher with detailed timing measurement
 */
const useDispatch = async (io: IO): Promise<CyreResponse> => {
  if (!io?.id) {
    throw new Error('Invalid IO object')
  }

  // Create performance timer for this execution
  const timer = metricsReport.createTimer()
  timer.start()

  // Find subscriber
  const subscriber = subscribers.get(io.id)
  if (!subscriber) {
    const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${io.id}`
    historyState.record(io.id, io.payload, {ok: false, message: error})
    return {ok: false, payload: null, message: error}
  }

  try {
    // Mark dispatch stage
    timer.markStage('dispatch')

    // Execute action through enhanced pipeline
    const dispatch = await CyreAction({...io}, subscriber.fn)

    // Mark metrics recording stage
    timer.markStage('metrics')

    // Create detailed timing and record it
    const timing = timer.createDetailedTiming()
    metricsReport.trackDetailedExecution(io.id, timing)

    const totalExecutionTime = timer.getTotalTime()

    // Record history with detailed timing
    historyState.record(
      io.id,
      io.payload,
      {ok: dispatch.ok, message: dispatch.message, error: dispatch.error},
      totalExecutionTime
    )

    // Log if enabled with timing details
    if (io.log) {
      log.info({
        ...dispatch,
        executionTime: totalExecutionTime,
        pipelineOverhead: timing.totals.pipelineOverhead,
        listenerTime: timing.stages.listenerExecution,
        overheadRatio: timing.ratios.overheadRatio,
        timestamp: Date.now()
      })
    }

    return {
      ok: dispatch.ok,
      payload: dispatch,
      message: dispatch.message || MSG.WELCOME
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Enhanced dispatch failed: ${errorMessage}`)

    // Still record the timing even on error
    const timing = timer.createDetailedTiming()
    metricsReport.trackDetailedExecution(io.id, timing)

    return {
      ok: false,
      payload: null,
      message: `Dispatch failed: ${errorMessage}`
    }
  }
}

/**
 * Execute action with enhanced pipeline and timing
 */
const executeAction = async (
  id?: ActionId,
  payload?: ActionPayload,
  isShutdown?: boolean
): Promise<CyreResponse> => {
  // System shutdown check
  if (isShutdown) {
    return {ok: false, message: MSG.CALL_OFFLINE, payload: null}
  }

  // ID validation
  if (!id?.trim()) {
    return {ok: false, message: MSG.CALL_INVALID_ID, payload: null}
  }

  const trimmedId = id.trim()

  // Track call metrics
  metricsReport.trackCall(trimmedId)

  // Get action
  const action = io.get(trimmedId)
  if (!action) {
    return {
      ok: false,
      payload: null,
      message: `${MSG.CALL_NOT_RESPONDING}: ${trimmedId}`
    }
  }

  try {
    const finalPayload = payload ?? action.payload

    // FIXED: Store the latest payload for interval actions
    if (action.interval || action.delay) {
      intervalPayloads.set(trimmedId, finalPayload)
    }

    // Ensure action pipeline exists
    if (!action._protectionPipeline) {
      action._protectionPipeline = buildActionPipeline(action)
      io.set(action)
    }

    // Check if this needs timing (interval/delay)
    const needsTiming = action.interval || action.delay

    if (needsTiming) {
      // Handle timed execution
      return await handleTimedExecution(action, finalPayload)
    } else {
      // Handle immediate execution with enhanced pipeline timing
      const timer = metricsReport.createTimer()
      timer.start()

      return await executeActionPipeline(
        action,
        finalPayload,
        action._protectionPipeline,
        timer,
        () => useDispatch({...action, payload: finalPayload})
      )
    }
  } catch (error) {
    return {
      ok: false,
      payload: null,
      message: `Call failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    }
  }
}

/**
 * FIXED: Handle timed execution with proper payload updates for repeats
 */
const handleTimedExecution = async (
  action: IO,
  payload: ActionPayload
): Promise<CyreResponse> => {
  const hasDelay = action.delay !== undefined && action.delay >= 0
  const hasInterval = action.interval && action.interval > 0
  const repeatValue = action.repeat

  // Apply stress factor
  const {stress} = metricsState.get()
  const stressFactor = 1 + stress.combined
  const adjustedInterval = hasInterval ? action.interval * stressFactor : 0

  // Determine initial wait time
  const initialWait = hasDelay
    ? Math.max(0, action.delay)
    : hasInterval
    ? adjustedInterval
    : 0

  return new Promise(resolve => {
    const timerId = `${action.id}-${Date.now()}`

    const timerResult = timeKeeper.keep(
      initialWait,
      async () => {
        // FIXED: Use the most recent payload for execution
        const currentPayload = intervalPayloads.get(action.id) || payload

        // Create timer for timed execution
        const timer = metricsReport.createTimer()
        timer.start()

        // Execute with enhanced pipeline timing
        const result = await executeActionPipeline(
          action,
          currentPayload, // Use the most recent payload
          action._protectionPipeline || buildActionPipeline(action),
          timer,
          () => useDispatch({...action, payload: currentPayload})
        )

        // FIXED: Handle repeats with most recent payload
        if (
          (hasInterval && repeatValue === true) ||
          (typeof repeatValue === 'number' && repeatValue > 1)
        ) {
          const remainingRepeats = repeatValue === true ? true : repeatValue - 1

          if (remainingRepeats) {
            // Create a recurring timer that checks for the latest payload each time
            const createRepeatTimer = (
              remainingCount: typeof remainingRepeats
            ) => {
              timeKeeper.keep(
                adjustedInterval,
                async () => {
                  if (metricsState.isHealthy()) {
                    // FIXED: Always use the most recent payload for each repeat
                    const latestPayload =
                      intervalPayloads.get(action.id) || payload

                    const repeatTimer = metricsReport.createTimer()
                    repeatTimer.start()

                    await executeActionPipeline(
                      action,
                      latestPayload, // Use the latest payload for this execution
                      action._protectionPipeline || buildActionPipeline(action),
                      repeatTimer,
                      () => useDispatch({...action, payload: latestPayload})
                    )

                    // Continue with remaining repeats
                    if (
                      typeof remainingCount === 'number' &&
                      remainingCount > 1
                    ) {
                      createRepeatTimer(remainingCount - 1)
                    } else if (remainingCount === true) {
                      createRepeatTimer(true) // Continue indefinitely
                    }
                  }
                },
                1, // Execute once per timer
                `${action.id}-repeat-${Date.now()}`
              )
            }

            createRepeatTimer(remainingRepeats)
          }
        }

        resolve({
          ok: result.ok,
          payload: result.payload,
          message: `Timed execution: ${
            hasDelay ? `delay=${action.delay}ms ` : ''
          }${
            hasInterval ? `interval=${action.interval}ms ` : ''
          }repeat=${repeatValue}`
        })
      },
      1,
      timerId
    )

    if (timerResult.kind === 'error') {
      resolve({
        ok: false,
        payload: null,
        message: `Timer setup failed: ${timerResult.error.message}`
      })
    }
  })
}

/**
 * Main CYRE instance with enhanced timing capabilities and fixed payload handling
 */
const cyre = {
  /**
   * Initialize the CYRE system
   */
  initialize: (): CyreResponse => {
    try {
      initializeBreathing()
      timeKeeper.resume()
      log.sys(MSG.QUANTUM_HEADER)
      log.info(
        'CYRE system initialized successfully with enhanced action pipeline timing and payload updates'
      )

      return {
        ok: true,
        payload: 200,
        message: MSG.WELCOME
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error(`Failed to initialize CYRE: ${errorMessage}`)

      return {
        ok: false,
        payload: null,
        message: `Initialization failed: ${errorMessage}`
      }
    }
  },

  /**
   * Register an action or array of actions
   */
  action: (attribute: IO | IO[]): void => {
    if (metricsState.isSystemLocked()) {
      log.error(MSG.SYSTEM_LOCKED_CHANNELS)
      return
    }

    const processAction = (ioItem: IO): void => {
      try {
        // Get existing action for middleware preservation
        const existingAction = io.get(ioItem.id)
        const existingMiddleware = existingAction?.middleware || []

        // Merge middleware
        const mergedItem = {
          ...ioItem,
          type: ioItem.type || ioItem.id,
          middleware: ioItem.middleware
            ? [
                ...existingMiddleware,
                ...ioItem.middleware.filter(
                  id => !existingMiddleware.includes(id)
                )
              ]
            : existingMiddleware
        }

        // Process channel with validation
        const processedChannel = CyreChannel(mergedItem, dataDefinitions)
        if (processedChannel.ok && processedChannel.payload) {
          // Pre-build action pipeline with enhanced timing support
          const actionWithPipeline = {
            ...processedChannel.payload,
            _protectionPipeline: buildActionPipeline(processedChannel.payload)
          }

          io.set(actionWithPipeline)
          log.debug(
            `Action registered with enhanced pipeline: ${actionWithPipeline.id}`
          )
        } else {
          log.error(`Failed to process action: ${processedChannel.message}`)
        }
      } catch (error) {
        log.error(`Action processing failed: ${error}`)
      }
    }

    if (Array.isArray(attribute)) {
      attribute.forEach(processAction)
    } else {
      processAction(attribute)
    }
  },

  /**
   * Subscribe to events by action ID
   */
  on: subscribe,

  /**
   * Call an action by ID with optional payload (enhanced with timing and payload updates)
   */
  call: (id?: ActionId, payload?: ActionPayload): Promise<CyreResponse> => {
    return executeAction(id, payload, false)
  },

  /**
   * Remove an action and cancel associated timers
   */
  forget: (id: string): boolean => {
    timeKeeper.pause(id)
    // FIXED: Clean up interval payload tracking
    intervalPayloads.delete(id)
    return io.forget(id)
  },

  /**
   * Get current state of an action
   */
  get: (id: string): IO | undefined => {
    return io.get(id)
  },

  /**
   * Pause execution of specific action or all actions
   */
  pause: (id?: string): void => {
    timeKeeper.pause(id)
  },

  /**
   * Resume execution of paused action or all actions
   */
  resume: (id?: string): void => {
    timeKeeper.resume(id)
  },

  /**
   * Check if payload has changed from previous execution
   */
  hasChanged: (id: string, payload: ActionPayload): boolean => {
    return io.hasChanged(id, payload)
  },

  /**
   * Get previous payload for an action
   */
  getPrevious: (id: string): ActionPayload | undefined => {
    return io.getPrevious(id)
  },

  /**
   * Lock system to prevent new actions/subscribers
   */
  lock: (): CyreResponse => {
    try {
      metricsState.lock()
      log.info(
        'CYRE system locked - no new channels or subscribers can be added'
      )

      return {
        ok: true,
        message: 'System locked successfully',
        payload: null
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error(`Failed to lock system: ${errorMessage}`)

      return {
        ok: false,
        message: `System lock failed: ${errorMessage}`,
        payload: null
      }
    }
  },

  /**
   * Check if system is shutdown
   */
  status: (): boolean => {
    const isShutdown = false // This would be managed by instance state
    if (isShutdown) {
      log.info({ok: true, message: MSG.OFFLINE})
    } else {
      log.info({ok: true, message: MSG.ONLINE})
    }
    return isShutdown
  },

  /**
   * Shutdown CYRE system completely
   */
  shutdown: (): void => {
    try {
      log.info('Starting CYRE shutdown sequence...')

      // Hibernate timekeeper
      timeKeeper.hibernate()

      // Clear all stores
      subscribers.clear()
      io.clear()

      // FIXED: Clear interval payload tracking
      intervalPayloads.clear()

      // Reset metrics
      metricsState.reset()
      metricsReport.reset()

      log.sys('CYRE shutdown completed successfully')
    } catch (error) {
      log.error(`Failed to shutdown gracefully: ${error}`)
    }
  },

  /**
   * Clear all actions and subscribers
   */
  clear: (): void => {
    io.clear()
    subscribers.clear()
    intervalPayloads.clear() // FIXED: Clear payload tracking
    metricsState.reset()
  },

  /**
   * Get current breathing state metrics
   */
  getBreathingState: (): Readonly<BreathingMetrics> => {
    return metricsState.get().breathing
  },

  /**
   * Get performance state metrics (enhanced with pipeline timing)
   */
  getPerformanceState: () => {
    const state = metricsState.get()
    const globalMetrics = metricsReport.getGlobalMetrics()

    return {
      totalProcessingTime: globalMetrics.totalExecutionTime,
      totalPipelineOverhead: globalMetrics.totalPipelineOverhead,
      totalListenerTime: globalMetrics.totalListenerTime,
      totalCallTime: globalMetrics.totalExecutionTime,
      totalStress: state.stress.combined,
      stress: state.stress.combined,
      avgOverheadRatio: globalMetrics.avgOverheadRatio,
      avgEfficiencyRatio: globalMetrics.avgEfficiencyRatio
    }
  },

  /**
   * Get detailed metrics for specific action (enhanced)
   */
  getMetrics: (channelId: string): TimekeeperMetrics => {
    const actionMetrics = metricsReport.getActionMetrics(channelId)

    return {
      hibernating: false,
      activeFormations: 0,
      inRecuperation: false,
      breathing: metricsState.get().breathing,
      formations: [],
      // Enhanced metrics
      ...(actionMetrics && {
        avgExecutionTime: actionMetrics.avgExecutionTime,
        avgPipelineOverhead: actionMetrics.avgPipelineOverhead,
        avgListenerTime: actionMetrics.avgListenerExecutionTime,
        overheadRatio: actionMetrics.avgOverheadRatio,
        performanceCategory: actionMetrics.performanceCategory,
        optimizationSuggestions: actionMetrics.optimizationSuggestions
      })
    }
  },

  /**
   * Get execution history
   */
  getHistory: (actionId?: string) => {
    return actionId ? historyState.getChannel(actionId) : historyState.getAll()
  },

  /**
   * Clear execution history
   */
  clearHistory: (actionId?: string): void => {
    if (actionId) {
      historyState.clearChannel(actionId)
    } else {
      historyState.clearAll()
    }
  },

  /**
   * Register middleware function
   */
  middleware: (id: string, fn: Function): CyreResponse => {
    if (metricsState.isSystemLocked()) {
      return {ok: false, message: MSG.SYSTEM_LOCKED_CHANNELS, payload: null}
    }

    try {
      middlewares.add({id, fn})
      log.info(`Middleware registered: ${id}`)
      return {ok: true, message: `Middleware registered: ${id}`, payload: null}
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        message: `Middleware registration failed: ${errorMessage}`,
        payload: null
      }
    }
  },

  /**
   * Get comprehensive enhanced metrics report
   */
  getMetricsReport: () => ({
    actions: metricsReport.getAllActionMetrics(),
    global: metricsReport.getGlobalMetrics(),
    insights: metricsReport.getInsights(),
    callRateStats: metricsReport.getCallRateStats()
  }),

  /**
   * Log enhanced metrics report to console
   */
  logMetricsReport: (filter?: (metrics: any) => boolean): void => {
    metricsReport.logReport(filter)
  },

  /**
   * Get performance insights and optimization suggestions
   */
  getPerformanceInsights: (actionId?: string) => {
    if (actionId) {
      const metrics = metricsReport.getActionMetrics(actionId)
      return metrics ? metrics.optimizationSuggestions : []
    }
    return metricsReport.getInsights()
  },

  /**
   * Create a performance timer for external use
   */
  createPerformanceTimer: () => {
    return metricsReport.createTimer()
  }
}

// Initialize the system
cyre.initialize()

// Export the instance and utilities
export {cyre, log}
export default cyre
