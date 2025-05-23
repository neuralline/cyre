// src/core/smart-pipeline.ts
// Ultra-intelligent, low-overhead protection pipeline with fixed middleware

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {metricsState} from '../context/metrics-state'
import {log} from '../components/cyre-log'

/*

    C.Y.R.E. - S.M.A.R.T. - P.I.P.E.L.I.N.E

    Ultra-intelligent protection with minimal overhead
    Fixed middleware processing integration

*/

/**
 * Protection execution context with minimal allocation
 */
interface ProtectionContext {
  action: IO
  payload: ActionPayload
  timestamp: number
  skipMask: number // Bitmask for skipped protections
  transformedPayload?: ActionPayload
}

/**
 * Protection function signatures for maximum performance
 */
type SmartProtectionFn = (
  ctx: ProtectionContext,
  next: (ctx: ProtectionContext) => Promise<CyreResponse>
) => Promise<CyreResponse>

/**
 * Protection bitmasks for ultra-fast checks
 */
const PROTECTION_MASK = {
  NONE: 0,
  RECUPERATION: 1 << 0, // 1
  REPEAT_ZERO: 1 << 1, // 2
  THROTTLE: 1 << 2, // 4
  DEBOUNCE: 1 << 3, // 8
  CHANGE_DETECT: 1 << 4, // 16
  MIDDLEWARE: 1 << 5 // 32
} as const

/**
 * Pre-computed protection strategies for different action types
 */
const STRATEGY_CACHE = new Map<
  string,
  {
    mask: number
    hotPath: boolean
    pipeline?: SmartProtectionFn[]
  }
>()

/**
 * Calculate protection mask for an action (cached)
 */
export const calculateProtectionMask = (action: IO): number => {
  let mask = PROTECTION_MASK.NONE

  // Always check recuperation and repeat zero
  mask |= PROTECTION_MASK.RECUPERATION
  mask |= PROTECTION_MASK.REPEAT_ZERO

  // Conditional protections
  if (action.throttle && action.throttle > 0) mask |= PROTECTION_MASK.THROTTLE
  if (action.debounce && action.debounce > 0) mask |= PROTECTION_MASK.DEBOUNCE
  if (action.detectChanges) mask |= PROTECTION_MASK.CHANGE_DETECT
  if (action.middleware?.length) mask |= PROTECTION_MASK.MIDDLEWARE

  return mask
}

/**
 * Determine if action qualifies for hot path (ultra-fast execution)
 */
export const isUltraHotPath = (mask: number): boolean => {
  // Hot path: only recuperation and repeat zero checks
  return mask === (PROTECTION_MASK.RECUPERATION | PROTECTION_MASK.REPEAT_ZERO)
}

/**
 * Smart recuperation check with early exit
 */
const smartRecuperationCheck = async (
  ctx: ProtectionContext,
  next: (ctx: ProtectionContext) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  const {breathing} = metricsState.get()

  // Ultra-fast path: system is healthy
  if (!breathing.isRecuperating) {
    return next(ctx)
  }

  // Critical actions bypass recuperation
  if (ctx.action.priority?.level === 'critical') {
    return next(ctx)
  }

  // Block non-critical actions during recuperation
  return {
    ok: false,
    payload: null,
    message: 'System recuperating. Only critical actions allowed.'
  }
}

/**
 * Smart repeat zero check with immediate return
 */
const smartRepeatZeroCheck = async (
  ctx: ProtectionContext,
  next: (ctx: ProtectionContext) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  if (ctx.action.repeat === 0) {
    return {
      ok: true,
      payload: null,
      message: 'Action registered but not executed (repeat: 0)'
    }
  }
  return next(ctx)
}

/**
 * Smart throttle with microsecond precision
 */
const smartThrottleCheck = async (
  ctx: ProtectionContext,
  next: (ctx: ProtectionContext) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  const {action, timestamp} = ctx

  // Import dynamically to avoid circular dependencies
  const {io} = await import('../context/state')
  const {metricsReport} = await import('../context/metrics-report')

  const actionMetrics = io.getMetrics(action.id)
  const lastExecution = actionMetrics?.lastExecutionTime || 0
  const timeSinceLastExecution = timestamp - lastExecution

  // First execution or sufficient time passed
  if (lastExecution === 0 || timeSinceLastExecution >= action.throttle!) {
    const result = await next(ctx)

    // Update metrics on successful execution
    if (result.ok) {
      io.updateMetrics(action.id, {
        lastExecutionTime: timestamp,
        executionCount: (actionMetrics?.executionCount || 0) + 1
      })
    }

    return result
  }

  // Throttled
  metricsReport.trackThrottle(action.id)
  return {
    ok: false,
    payload: null,
    message: `Throttled: ${
      action.throttle! - timeSinceLastExecution
    }ms remaining`
  }
}

/**
 * Smart change detection with shallow comparison optimization
 */
const smartChangeDetection = async (
  ctx: ProtectionContext,
  next: (ctx: ProtectionContext) => Promise<CyreResponse>
): Promise<CyreResponse> => {
  const {io} = await import('../context/state')
  const {metricsReport} = await import('../context/metrics-report')

  // Fast shallow comparison first
  const hasChanged = io.hasChanged(ctx.action.id, ctx.payload)

  if (!hasChanged) {
    metricsReport.trackChangeDetectionSkip(ctx.action.id)
    return {
      ok: true,
      payload: null,
      message: 'Execution skipped: No changes detected in payload'
    }
  }

  return next(ctx)
}

/**
 * Fixed smart middleware execution with proper payload transformation
 * Note: This function will be dynamically created with middleware store access
 */
const createSmartMiddlewareExecution =
  (middlewareStore: any) =>
  async (
    ctx: ProtectionContext,
    next: (ctx: ProtectionContext) => Promise<CyreResponse>
  ): Promise<CyreResponse> => {
    // Import metricsReport dynamically to avoid circular dependencies
    const {metricsReport} = await import('../context/metrics-report')

    if (!ctx.action.middleware?.length) {
      return next(ctx)
    }

    let currentPayload = ctx.payload

    // Execute middleware chain with minimal overhead
    for (const middlewareId of ctx.action.middleware) {
      const middleware = middlewareStore.get(middlewareId)
      if (!middleware) {
        log.warn(`Middleware '${middlewareId}' not found and will be skipped`)
        continue
      }

      try {
        // Call middleware function with proper async handling
        const result = await Promise.resolve(
          middleware.fn(ctx.action, currentPayload)
        )

        if (result === null) {
          metricsReport.trackMiddlewareRejection(ctx.action.id)
          return {
            ok: false,
            payload: null,
            message: `Action rejected by middleware '${middlewareId}'`
          }
        }

        // Update current payload for next middleware
        currentPayload = result.payload
        log.debug(
          `Middleware '${middlewareId}' successfully processed action ${ctx.action.id}`
        )
      } catch (error) {
        log.error(`Middleware '${middlewareId}' failed: ${error}`)
        return {
          ok: false,
          payload: null,
          message: `Middleware error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }

    // Update context with transformed payload
    const updatedCtx = {
      ...ctx,
      payload: currentPayload,
      transformedPayload: currentPayload
    }

    return next(updatedCtx)
  }

/**
 * Build optimized protection strategy with caching and middleware store
 */
export const buildSmartStrategy = (
  action: IO,
  middlewareStore?: any
): {
  mask: number
  hotPath: boolean
  pipeline?: SmartProtectionFn[]
} => {
  // Check cache first
  const cacheKey = `${action.id}-${action.throttle || 0}-${
    action.debounce || 0
  }-${action.detectChanges ? 1 : 0}-${action.middleware?.length || 0}`
  const cached = STRATEGY_CACHE.get(cacheKey)
  if (cached) return cached

  const mask = calculateProtectionMask(action)
  const hotPath = isUltraHotPath(mask)

  let strategy: {mask: number; hotPath: boolean; pipeline?: SmartProtectionFn[]}

  if (hotPath) {
    // Ultra-hot path: minimal pipeline
    strategy = {
      mask,
      hotPath: true,
      pipeline: [smartRecuperationCheck, smartRepeatZeroCheck]
    }
  } else {
    // Smart cold path: build optimized pipeline
    const pipeline: SmartProtectionFn[] = [
      smartRecuperationCheck,
      smartRepeatZeroCheck
    ]

    if (mask & PROTECTION_MASK.THROTTLE) pipeline.push(smartThrottleCheck)
    if (mask & PROTECTION_MASK.CHANGE_DETECT)
      pipeline.push(smartChangeDetection)
    if (mask & PROTECTION_MASK.MIDDLEWARE && middlewareStore) {
      // Create middleware execution function with access to middleware store
      pipeline.push(createSmartMiddlewareExecution(middlewareStore))
    }

    strategy = {mask, hotPath: false, pipeline}
  }

  // Cache strategy
  STRATEGY_CACHE.set(cacheKey, strategy)
  return strategy
}

/**
 * Execute smart pipeline with minimal overhead
 */
export const executeSmartPipeline = async (
  action: IO,
  payload: ActionPayload,
  finalExecution: (finalPayload: ActionPayload) => Promise<CyreResponse>,
  middlewareStore?: any
): Promise<CyreResponse> => {
  const strategy = buildSmartStrategy(action, middlewareStore)

  // Ultra-hot path: direct execution with minimal checks
  if (strategy.hotPath) {
    const {breathing} = metricsState.get()

    // Single check for recuperation
    if (breathing.isRecuperating && action.priority?.level !== 'critical') {
      return {
        ok: false,
        payload: null,
        message: 'System recuperating. Only critical actions allowed.'
      }
    }

    // Single check for repeat zero
    if (action.repeat === 0) {
      return {
        ok: true,
        payload: null,
        message: 'Action registered but not executed (repeat: 0)'
      }
    }

    // Execute directly
    // log.debug(`Ultra-hot path execution for ${action.id}`)
    return finalExecution(payload)
  }

  // Smart cold path: optimized pipeline execution
  //log.debug(`Smart pipeline execution for ${action.id}`)

  const ctx: ProtectionContext = {
    action,
    payload,
    timestamp: Date.now(),
    skipMask: 0
  }

  // Execute pipeline with functional composition
  const pipeline = strategy.pipeline!
  const composedPipeline = pipeline.reduceRight<
    (ctx: ProtectionContext) => Promise<CyreResponse>
  >(
    (next, protectionFn) => {
      return (inputCtx: ProtectionContext) => protectionFn(inputCtx, next)
    },
    (finalCtx: ProtectionContext) =>
      finalExecution(finalCtx.transformedPayload || finalCtx.payload)
  )

  return composedPipeline(ctx)
}

/**
 * Clear strategy cache (for memory management)
 */
export const clearStrategyCache = (): void => {
  STRATEGY_CACHE.clear()
}

/**
 * Get cache statistics for monitoring
 */
export const getStrategyStats = (): {
  cacheSize: number
  hotPathActions: number
  coldPathActions: number
} => {
  let hotPathActions = 0
  let coldPathActions = 0

  for (const strategy of STRATEGY_CACHE.values()) {
    if (strategy.hotPath) {
      hotPathActions++
    } else {
      coldPathActions++
    }
  }

  return {
    cacheSize: STRATEGY_CACHE.size,
    hotPathActions,
    coldPathActions
  }
}
