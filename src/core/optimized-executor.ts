// src/core/optimized-executor.ts - Fix timing in optimized execution path

import type {
  IO,
  ActionId,
  ActionPayload,
  CyreResponse,
  ISubscriber
} from '../types/interface'
import {MSG} from '../config/cyre-config'
import {log} from '../components/cyre-log'
import {metricsReport} from '../context/metrics-report'
import {metricsState} from '../context/metrics-state'
import {historyState} from '../context/history-state'
import {executeSmartPipeline} from './smart-pipeline'

/*
    
        C.Y.R.E. - O.P.T.I.M.I.Z.E.D. - E.X.E.C.U.T.O.R
    
        FIXED: Absolute minimum overhead call execution with accurate timing
    
    */

/**
 * Execution context for minimal object allocation
 */
interface ExecutionContext {
  id: string
  action: IO
  subscriber: ISubscriber
  payload: ActionPayload
  startTime: number
}

/**
 * Pre-allocated response objects to minimize GC pressure
 */
const RESPONSE_POOL = {
  OFFLINE: {ok: false, message: MSG.CALL_OFFLINE, payload: null},
  INVALID_ID: {ok: false, message: MSG.CALL_INVALID_ID, payload: null},
  NO_SUBSCRIBER: {ok: false, payload: null, message: ''},
  SUCCESS: {ok: true, payload: null, message: MSG.WELCOME}
} as const

/**
 * Ultra-fast ID validation with early returns
 */
const validateId = (id?: ActionId): string | null => {
  if (!id) return null
  const trimmedId = id.trim()
  return trimmedId.length > 0 ? trimmedId : null
}

/**
 * Smart action retrieval with inline validation
 */
const getActionAndSubscriber = (
  id: string,
  ioStore: any,
  subscriberStore: any
): {action?: IO; subscriber?: ISubscriber; error?: string} => {
  const action = ioStore.get(id)
  if (!action) {
    return {error: `${MSG.CALL_NOT_RESPONDING}: ${id}`}
  }

  const subscriber = subscriberStore.get(id)
  if (!subscriber) {
    return {error: `${MSG.DISPATCH_NO_SUBSCRIBER} ${id}`}
  }

  return {action, subscriber}
}

/**
 * FIXED: Optimized payload execution with accurate timing measurement
 */
const executePayload = async (
  ctx: ExecutionContext
): Promise<{
  result: any
  duration: number
  listenerTime: number
  error?: string
}> => {
  const totalStartTime = performance.now()

  try {
    // FIXED: Measure listener execution time precisely
    const listenerStartTime = performance.now()
    const result = await ctx.subscriber.fn(ctx.payload)
    const listenerEndTime = performance.now()
    const listenerTime = listenerEndTime - listenerStartTime

    // FIXED: Track listener execution immediately
    metricsReport.trackListenerExecution(ctx.action.id, listenerTime)

    const totalEndTime = performance.now()
    const totalDuration = totalEndTime - totalStartTime

    return {result, duration: totalDuration, listenerTime}
  } catch (error) {
    // FIXED: Track errors immediately when they occur
    metricsReport.trackError(ctx.action.id)

    const totalEndTime = performance.now()
    const duration = totalEndTime - totalStartTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      result: null,
      duration,
      listenerTime: 0, // No successful listener execution
      error: errorMessage
    }
  }
}

/**
 * FIXED: Smart dispatch with accurate metrics tracking
 */
const smartDispatch = async (ctx: ExecutionContext): Promise<CyreResponse> => {
  const execution = await executePayload(ctx)

  // Create response object with minimal overhead
  const response: CyreResponse = {
    ok: !execution.error,
    payload: execution.result,
    message: execution.error || MSG.WELCOME
  }

  // Handle action linking with zero-copy detection
  if (
    execution.result &&
    typeof execution.result === 'object' &&
    'id' in execution.result
  ) {
    ;(response.payload as any).intraLink = {
      id: execution.result.id,
      payload: execution.result.payload
    }
  }

  // FIXED: Record metrics with proper total execution time
  if (response.ok) {
    metricsReport.trackExecution(ctx.action.id, execution.duration)

    // Update action metrics
    const ioStore = (await import('../context/state')).io
    const currentMetrics = ioStore.getMetrics(ctx.action.id)
    ioStore.updateMetrics(ctx.action.id, {
      lastExecutionTime: Date.now(),
      executionCount: (currentMetrics?.executionCount || 0) + 1
    })
  }

  // FIXED: Record history with proper success/failure tracking
  historyState.record(
    ctx.action.id,
    ctx.payload,
    {
      ok: response.ok,
      message: response.message,
      error: execution.error
    },
    execution.duration
  )

  // Log if enabled (async to avoid blocking)
  if (ctx.action.log) {
    setImmediate(() => {
      log.info({
        id: ctx.action.id,
        ok: response.ok,
        executionTime: execution.duration,
        listenerTime: execution.listenerTime,
        timestamp: Date.now()
      })
    })
  }

  return response
}

/**
 * Ultra-optimized immediate execution
 */
const executeImmediate = async (
  action: IO,
  payload: ActionPayload,
  ioStore: any,
  subscriberStore: any
): Promise<CyreResponse> => {
  const validation = getActionAndSubscriber(action.id, ioStore, subscriberStore)
  if (validation.error) {
    return {ok: false, payload: null, message: validation.error}
  }

  const ctx: ExecutionContext = {
    id: action.id,
    action,
    subscriber: validation.subscriber!,
    payload,
    startTime: performance.now()
  }

  // Record call in breathing system
  metricsState.recordCall(action.priority?.level)

  return smartDispatch(ctx)
}

/**
 * Smart timing execution with minimal overhead
 */
const executeWithTiming = async (
  action: IO,
  payload: ActionPayload,
  ioStore: any,
  subscriberStore: any
): Promise<CyreResponse> => {
  // Import timeKeeper dynamically to avoid circular dependencies
  const timeKeeper = (await import('../components/cyre-timekeeper')).default
  const {timeline} = await import('../context/state')

  // Determine timing strategy
  const hasDelay = action.delay !== undefined && action.delay >= 0
  const hasInterval = action.interval && action.interval > 0
  const repeatValue = action.repeat

  // Apply stress factor for smart adaptation
  const {stress} = metricsState.get()
  const stressFactor = 1 + stress.combined
  const adjustedInterval = hasInterval ? action.interval * stressFactor : 0

  // Calculate optimal initial wait time
  const initialWait = hasDelay
    ? Math.max(0, action.delay)
    : hasInterval
    ? adjustedInterval
    : 0

  // Clean up existing timers with minimal overhead
  const existingTimers = timeline.getAll().filter(t => t.id === action.id)
  if (existingTimers.length > 0) {
    existingTimers.forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
      if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
    })
    timeline.forget(action.id)
  }

  return new Promise(resolve => {
    const timerId = `${action.id}-${Date.now()}`

    const timerResult = timeKeeper.keep(
      initialWait,
      async () => {
        // FIXED: Execute with proper timing measurement
        const result = await executeImmediate(
          action,
          payload,
          ioStore,
          subscriberStore
        )

        // Handle repeats if needed
        if (
          (hasInterval && repeatValue === true) ||
          (typeof repeatValue === 'number' && repeatValue > 1)
        ) {
          // Set up remaining executions
          const remainingRepeats = repeatValue === true ? true : repeatValue - 1

          if (remainingRepeats) {
            timeKeeper.keep(
              adjustedInterval,
              async () => {
                if (metricsState.isHealthy()) {
                  await executeImmediate(
                    action,
                    payload,
                    ioStore,
                    subscriberStore
                  )
                }
              },
              remainingRepeats,
              action.id
            )
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
 * Ultra-optimized main execution function
 */
export const executeOptimized = async (
  id?: ActionId,
  payload?: ActionPayload,
  isShutdown?: boolean,
  ioStore?: any,
  subscriberStore?: any
): Promise<CyreResponse> => {
  // System shutdown check (fastest possible)
  if (isShutdown) {
    return RESPONSE_POOL.OFFLINE
  }

  // Ultra-fast ID validation
  const validId = validateId(id)
  if (!validId) {
    return RESPONSE_POOL.INVALID_ID
  }

  // Track call with minimal overhead
  metricsReport.trackCall(validId)

  // Get action with inline validation
  const action = ioStore.get(validId)
  if (!action) {
    return {
      ok: false,
      payload: null,
      message: `${MSG.CALL_NOT_RESPONDING}: ${validId}`
    }
  }

  // Determine final payload with minimal allocation
  const finalPayload = payload ?? action.payload

  // Smart execution routing
  const needsTiming = action.interval || action.delay

  if (needsTiming) {
    // Timed execution path with smart pipeline
    const timedExecution = (transformedPayload: ActionPayload) =>
      executeWithTiming(action, transformedPayload, ioStore, subscriberStore)

    return executeSmartPipeline(action, finalPayload, timedExecution)
  } else {
    // Immediate execution path with smart pipeline
    const immediateExecution = (transformedPayload: ActionPayload) =>
      executeImmediate(action, transformedPayload, ioStore, subscriberStore)

    return executeSmartPipeline(action, finalPayload, immediateExecution)
  }
}

/**
 * Handle action linking with tail call optimization
 */
export const handleActionLinking = async (
  result: CyreResponse,
  executor: (id: string, payload?: ActionPayload) => Promise<CyreResponse>
): Promise<void> => {
  if (
    result.ok &&
    result.payload &&
    typeof result.payload === 'object' &&
    'intraLink' in result.payload
  ) {
    const link = (result.payload as any).intraLink
    if (link?.id) {
      try {
        // Use setImmediate for tail call optimization
        setImmediate(async () => {
          await executor(link.id, link.payload)
        })
      } catch (error) {
        log.error(`Linked action error: ${error}`)
      }
    }
  }
}

/**
 * Performance statistics for monitoring
 */
export const getExecutionStats = (): {
  hotPathExecutions: number
  coldPathExecutions: number
  averageExecutionTime: number
  totalExecutions: number
} => {
  const globalMetrics = metricsReport.getGlobalMetrics()

  return {
    hotPathExecutions: 0, // Would need to track this separately
    coldPathExecutions: 0, // Would need to track this separately
    averageExecutionTime:
      globalMetrics.totalExecutionTime / globalMetrics.totalExecutions || 0,
    totalExecutions: globalMetrics.totalExecutions
  }
}
