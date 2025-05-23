// src/core/cyre-instance.ts
// Main CYRE instance creation with proper instance isolation

import type {
  IO,
  ActionId,
  ActionPayload,
  BreathingMetrics,
  CyreResponse,
  Subscriber,
  SubscriptionResponse,
  TimekeeperMetrics
} from '../types/interface'
import {MSG} from '../config/cyre-config'
import {log} from '../components/cyre-log'
import {metricsState} from '../context/metrics-state'
import {historyState} from '../context/history-state'
import {metricsReport} from '../context/metrics-report'
import CyreChannel from '../components/cyre-channels'
import dataDefinitions from '../elements/data-definitions'
import {buildSmartStrategy} from './smart-pipeline'
import {executeOptimized, handleActionLinking} from './optimized-executor'
import {createInstanceState, InstanceState} from './instance-state'
import {
  initializeCyre,
  getSystemStatus,
  shutdownCyre,
  setupShutdownHandlers,
  pauseSystem,
  resumeSystem
} from './cyre-lifecycle'

/*
    
        C.Y.R.E. - I.N.S.T.A.N.C.E
    
        Ultra-optimized instance with proper isolation
        Version 4.0.3+ 2025 - Fixed Instance Isolation
    
    */

interface CyreInstance {
  initialize: () => CyreResponse
  call: (id?: ActionId, payload?: ActionPayload) => Promise<CyreResponse>
  action: (attribute: IO | IO[]) => void
  on: (
    type: string | Subscriber[],
    fn?: (
      payload?: unknown
    ) => void | Promise<void> | {id: string; payload?: unknown}
  ) => SubscriptionResponse
  shutdown: () => void
  lock: () => CyreResponse
  status: () => boolean
  forget: (id: string) => boolean
  get: (id: string) => IO | undefined
  pause: (id?: string) => void
  resume: (id?: string) => void
  hasChanged: (id: string, payload: ActionPayload) => boolean
  getPrevious: (id: string) => ActionPayload | undefined
  getBreathingState: () => Readonly<BreathingMetrics>
  getPerformanceState: () => {
    totalProcessingTime: number
    totalCallTime: number
    totalStress: number
    stress: number
  }
  getMetrics: (channelId: string) => TimekeeperMetrics
  getHistory: (actionId?: string) => any
  clearHistory: (actionId?: string) => void
  middleware: (id: string, fn: Function) => CyreResponse
  getMetricsReport: (actionId?: string) => any
  logMetricsReport: (filter?: (metrics: any) => boolean) => void
}

/**
 * Create ultra-optimized CYRE instance with proper isolation
 */
export const createCyreInstance = (
  line: string = crypto.randomUUID()
): CyreInstance => {
  let isShutdown = false
  let isInstanceLocked = false // Per-instance locking
  const startTime = Date.now()

  // Create isolated state for this instance
  const instanceState = createInstanceState()

  // Ultra-fast subscription function with minimal overhead
  const subscribe = (
    type: string | Subscriber[],
    fn?: (
      payload?: unknown
    ) => void | Promise<void> | {id: string; payload?: unknown}
  ): SubscriptionResponse => {
    // Check instance-specific lock instead of global lock
    if (isInstanceLocked) {
      return {ok: false, message: MSG.SYSTEM_LOCKED_SUBSCRIBERS}
    }

    // Handle array of subscribers with batch processing
    if (Array.isArray(type)) {
      const results = type.map(subscriber => {
        if (!subscriber.id || !subscriber.fn) return false
        try {
          instanceState.subscribers.add(subscriber)
          return true
        } catch {
          return false
        }
      })

      const successCount = results.filter(Boolean).length
      return {
        ok: successCount > 0,
        message: `Successfully added ${successCount} out of ${type.length} subscribers`
      }
    }

    // Handle single subscriber with fast path
    if (typeof type === 'string' && fn) {
      const trimmedId = type.trim()
      if (!trimmedId || typeof fn !== 'function') {
        return {ok: false, message: MSG.SUBSCRIPTION_INVALID_HANDLER}
      }

      const subscriber = {id: trimmedId, fn}

      // Check for duplicates with minimal overhead
      const existing = instanceState.subscribers.get(subscriber.id)
      if (existing) {
        log.warn(`Duplicate listener: ${subscriber.id}`)
      }

      instanceState.subscribers.add(subscriber)
      return {
        ok: true,
        message: `Subscribed: ${subscriber.id}`,
        unsubscribe: () => instanceState.subscribers.forget(trimmedId)
      }
    }

    return {ok: false, message: MSG.SUBSCRIPTION_INVALID_PARAMS}
  }

  // Ultra-optimized call function with smart routing
  const call = async (
    id?: ActionId,
    payload?: ActionPayload
  ): Promise<CyreResponse> => {
    const result = await executeOptimized(
      id,
      payload,
      isShutdown,
      instanceState.io,
      instanceState.subscribers,
      instanceState.middlewares // Pass middleware store
    )

    // Handle action linking with tail call optimization
    await handleActionLinking(result, call)

    return result
  }

  // Smart action registration with pipeline pre-computation
  const registerAction = (attribute: IO | IO[]): void => {
    if (isShutdown) {
      log.error(MSG.OFFLINE)
      return
    }
    // Check instance-specific lock instead of global lock
    if (isInstanceLocked) {
      log.error(MSG.SYSTEM_LOCKED_CHANNELS)
      return
    }

    const processAction = (ioItem: IO): void => {
      try {
        // Get existing action for middleware preservation
        const existingAction = instanceState.io.get(ioItem.id)
        const existingMiddleware = existingAction?.middleware || []

        // Smart middleware merging
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
          // Pre-compute smart strategy for ultra-fast execution
          const strategy = buildSmartStrategy(
            processedChannel.payload,
            instanceState.middlewares
          )
          const actionWithStrategy = {
            ...processedChannel.payload,
            _smartStrategy: strategy
          }

          // Store in instance state
          instanceState.io.set(actionWithStrategy)

          log.debug(
            `Action registered with smart strategy: ${actionWithStrategy.id} (${
              strategy.hotPath ? 'hot' : 'cold'
            } path)`
          )
        } else {
          log.error(`Failed to process action: ${processedChannel.message}`)
        }
      } catch (error) {
        log.error(`Action processing failed: ${error}`)
      }
    }

    // Batch process if array
    if (Array.isArray(attribute)) {
      attribute.forEach(processAction)
    } else {
      processAction(attribute)
    }
  }

  // Optimized resource management
  const forgetAction = (id: string): boolean => {
    if (isShutdown) return false
    pauseSystem(id)
    return instanceState.io.forget(id)
  }

  const getAction = (id: string): IO | undefined => {
    return isShutdown ? undefined : instanceState.io.get(id)
  }

  // Fast state management
  const hasPayloadChanged = (id: string, payload: ActionPayload): boolean => {
    return isShutdown ? false : instanceState.io.hasChanged(id, payload)
  }

  const getPreviousPayload = (id: string): ActionPayload | undefined => {
    return isShutdown ? undefined : instanceState.io.getPrevious(id)
  }

  // Optimized metrics functions
  const getBreathingMetrics = (): Readonly<BreathingMetrics> => {
    return metricsState.get().breathing
  }

  const getPerformanceMetrics = () => {
    const state = metricsState.get()
    return {
      totalProcessingTime: 0,
      totalCallTime: 0,
      totalStress: state.stress.combined,
      stress: state.stress.combined
    }
  }

  const getActionMetrics = (channelId: string): TimekeeperMetrics => {
    if (isShutdown) {
      return {
        hibernating: true,
        activeFormations: 0,
        inRecuperation: false,
        breathing: metricsState.get().breathing,
        formations: []
      }
    }

    return {
      hibernating: false,
      activeFormations: instanceState.timeline.getActive().length,
      inRecuperation: false,
      breathing: metricsState.get().breathing,
      formations: instanceState.timeline
        .getAll()
        .filter(f => f.id === channelId)
        .map(f => ({...f, breathingSync: 1.0}))
    }
  }

  // Optimized history functions
  const getExecutionHistory = (actionId?: string) => {
    if (isShutdown) return []
    return actionId ? historyState.getChannel(actionId) : historyState.getAll()
  }

  const clearExecutionHistory = (actionId?: string) => {
    if (isShutdown) return
    if (actionId) {
      historyState.clearChannel(actionId)
    } else {
      historyState.clearAll()
    }
  }

  // Fast middleware registration
  const registerInstanceMiddleware = (
    id: string,
    fn: Function
  ): CyreResponse => {
    if (isShutdown) {
      return {ok: false, message: MSG.CALL_OFFLINE, payload: null}
    }

    if (isInstanceLocked) {
      return {ok: false, message: MSG.SYSTEM_LOCKED_CHANNELS, payload: null}
    }

    try {
      instanceState.middlewares.add({id, fn})
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
  }

  // Instance-specific lock function
  const lockInstance = (): CyreResponse => {
    try {
      isInstanceLocked = true
      log.info(
        'CYRE instance locked - no new channels or subscribers can be added'
      )

      return {
        ok: true,
        message: 'Instance locked successfully',
        payload: null
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error(`Failed to lock instance: ${errorMessage}`)

      return {
        ok: false,
        message: `Instance lock failed: ${errorMessage}`,
        payload: null
      }
    }
  }

  // Optimized shutdown
  const shutdown = (): void => {
    if (isShutdown) return

    isShutdown = true

    // Clear instance state with minimal overhead
    instanceState.io.clear()
    instanceState.subscribers.clear()
    instanceState.middlewares.clear()
    instanceState.timeline.clear()
    instanceState.payloadHistory.clear()
    instanceState.actionMetrics.clear()
  }

  // Setup shutdown handlers for main instance only
  if (line === 'quantum-inceptions') {
    setupShutdownHandlers(shutdown)
  }

  // Return optimized instance
  const instance: CyreInstance = {
    initialize: () => {
      isShutdown = false
      return initializeCyre()
    },

    call,
    action: registerAction,
    on: subscribe,
    shutdown,
    lock: lockInstance, // Use instance-specific lock
    status: () => getSystemStatus(isShutdown),
    forget: forgetAction,
    get: getAction,
    pause: (id?: string) => pauseSystem(id),
    resume: (id?: string) => resumeSystem(id),
    hasChanged: hasPayloadChanged,
    getPrevious: getPreviousPayload,
    getBreathingState: getBreathingMetrics,
    getPerformanceState: getPerformanceMetrics,
    getMetrics: getActionMetrics,
    getHistory: getExecutionHistory,
    clearHistory: clearExecutionHistory,
    middleware: registerInstanceMiddleware,

    getMetricsReport: () => ({
      actions: metricsReport.getAllActionMetrics(),
      global: metricsReport.getGlobalMetrics(),
      insights: metricsReport.getInsights()
    }),

    logMetricsReport: (filter?: (metrics: any) => boolean) =>
      metricsReport.logReport(filter)
  }

  return instance
}

// Factory function for creating optimized CYRE instances
export const Cyre = (line?: string): CyreInstance => {
  return createCyreInstance(line)
}
