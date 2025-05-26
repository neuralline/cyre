// src/pipeline/pipeline-compiler.ts
// FIXED: Proper detection of timing requirements and fast path eligibility

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {log} from '../components/cyre-log'
import {pipelineState} from '../context/pipeline-state'
import {MSG, PERFORMANCE} from '../config/cyre-config'

// Import individual action modules for modular testing
import {applyThrottleProtection, shouldThrottle} from '../actions/throttle'
import {applyDebounceProtection, hasPendingDebounce} from '../actions/debounce'
import {
  applyChangeDetectionProtection,
  hasPayloadChanged
} from '../actions/change-detection'
import {
  applyMiddlewareProtection,
  hasMiddleware,
  validateMiddlewareChain
} from '../actions/middleware'

/*

      C.Y.R.E. - P.I.P.E.L.I.N.E. - C.O.M.P.I.L.E.R.
      
      FIXED: Proper timing detection and pipeline compilation:
      1. Compile-time verification and optimization
      2. Channel-specific pipeline caching
      3. Correct fast path detection (excludes timing requirements)
      4. Runtime pipeline execution with minimal overhead

*/

// Pipeline function type with timing context
export type PipelineFunction = (
  action: IO,
  payload: ActionPayload,
  next: (transformedPayload?: ActionPayload) => Promise<CyreResponse>
) => Promise<CyreResponse>

// Verification result for compile-time checks
export interface VerificationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  optimizations: string[]
}

// Compiled pipeline profile for each channel
export interface CompiledPipeline {
  channelId: string
  hasProtections: boolean
  isFastPath: boolean
  requiresTimekeeper: boolean // FIXED: Add timekeeper requirement flag
  verificationHash: string
  compiledAt: number

  // Pre-compiled pipeline functions in execution order
  pipeline: PipelineFunction[]

  // Pre-computed flags for ultra-fast checks
  flags: {
    hasThrottle: boolean
    hasDebounce: boolean
    hasChangeDetection: boolean
    hasMiddleware: boolean
    hasInterval: boolean
    hasDelay: boolean
    hasRepeat: boolean
  }

  // Verification results cached at compile time
  verification: VerificationResult

  // Performance characteristics
  performance: {
    expectedOverhead: number // Estimated pipeline overhead in ms
    category: 'FAST_PATH' | 'LIGHT' | 'NORMAL' | 'HEAVY' | 'TIMEKEEPER'
    optimizationLevel: number // 0-100 score
  }

  // Middleware validation (pre-computed)
  middlewareValidation?: {
    valid: boolean
    missing: string[]
    errors: string[]
  }
}

// Safe performance measurement utility
const safePerformanceNow = (): number => {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now()
  }
  if (typeof process !== 'undefined' && process.hrtime) {
    const [seconds, nanoseconds] = process.hrtime()
    return seconds * 1000 + nanoseconds / 1000000
  }
  return Date.now()
}

/**
 * FIXED: Check if action requires timekeeper (has timing properties)
 * Must match the logic in pipeline-executor.ts
 */
const requiresTimekeeper = (action: IO): boolean => {
  const needsTimekeeper = !!(
    action.interval ||
    action.delay !== undefined ||
    (action.repeat !== undefined && action.repeat !== 1 && action.repeat !== 0)
  )

  if (needsTimekeeper) {
    log.debug(
      `⏱️ Compiler detected timekeeper requirement for ${action.id}: interval=${action.interval}, delay=${action.delay}, repeat=${action.repeat}`
    )
  }

  return needsTimekeeper
}

/**
 * 🔍 COMPILE-TIME VERIFICATION SYSTEM
 * Performs all possible checks at action registration time
 */
const performCompileTimeVerification = (action: IO): VerificationResult => {
  const result: VerificationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    optimizations: []
  }

  // 1. Required field validation
  if (!action.id || typeof action.id !== 'string') {
    result.errors.push('Action ID is required and must be a string')
    result.isValid = false
  }

  if (action.id && action.id.length > 100) {
    result.warnings.push(
      'Action ID is very long, consider shorter names for better performance'
    )
  }

  // 2. Timing configuration validation
  if (action.throttle !== undefined) {
    if (typeof action.throttle !== 'number' || action.throttle < 0) {
      result.errors.push('Throttle must be a positive number')
      result.isValid = false
    } else if (action.throttle < 10) {
      result.warnings.push('Throttle values below 10ms may not be effective')
    }
  }

  if (action.debounce !== undefined) {
    if (typeof action.debounce !== 'number' || action.debounce < 0) {
      result.errors.push('Debounce must be a positive number')
      result.isValid = false
    } else if (action.debounce < 10) {
      result.warnings.push('Debounce values below 10ms may not be effective')
    }
  }

  if (action.interval !== undefined) {
    if (typeof action.interval !== 'number' || action.interval < 0) {
      result.errors.push('Interval must be a positive number')
      result.isValid = false
    }
  }

  if (action.delay !== undefined) {
    if (typeof action.delay !== 'number' || action.delay < 0) {
      result.errors.push('Delay must be a non-negative number')
      result.isValid = false
    }
  }

  // 3. Repeat validation
  if (action.repeat !== undefined) {
    const isValidRepeat =
      typeof action.repeat === 'number' ||
      typeof action.repeat === 'boolean' ||
      action.repeat === Infinity

    if (!isValidRepeat) {
      result.errors.push('Repeat must be a number, boolean, or Infinity')
      result.isValid = false
    }

    if (typeof action.repeat === 'number' && action.repeat < 0) {
      result.errors.push('Repeat count cannot be negative')
      result.isValid = false
    }
  }

  // 4. Priority validation
  if (action.priority) {
    const validLevels = ['critical', 'high', 'medium', 'low', 'background']
    if (!validLevels.includes(action.priority.level)) {
      result.errors.push(
        `Invalid priority level. Must be one of: ${validLevels.join(', ')}`
      )
      result.isValid = false
    }
  }

  // 5. Middleware validation
  if (action.middleware) {
    if (!Array.isArray(action.middleware)) {
      result.errors.push('Middleware must be an array of middleware IDs')
      result.isValid = false
    } else {
      const middlewareValidation = validateMiddlewareChain(action)
      if (!middlewareValidation.valid) {
        result.errors.push(...middlewareValidation.errors)
        if (middlewareValidation.missing.length > 0) {
          result.errors.push(
            `Missing middleware: ${middlewareValidation.missing.join(', ')}`
          )
        }
        result.isValid = false
      }
    }
  }

  // 6. Optimization suggestions
  if (action.throttle && action.debounce) {
    if (action.throttle >= action.debounce) {
      result.optimizations.push(
        'Throttle >= debounce may cause unexpected behavior'
      )
    }
  }

  if (action.detectChanges && !action.debounce && !action.throttle) {
    result.optimizations.push(
      'Change detection without throttle/debounce may have limited benefit'
    )
  }

  if (action.middleware && action.middleware.length > 5) {
    result.warnings.push('Large middleware chains may impact performance')
  }

  // FIXED: Timing-related optimizations
  if (action.interval && action.delay !== undefined) {
    if (action.delay > action.interval) {
      result.warnings.push(
        'Delay is longer than interval, which may cause unexpected timing'
      )
    }
  }

  if (action.repeat === 1 && (action.interval || action.delay !== undefined)) {
    result.optimizations.push(
      'Single execution with timing delay - consider if timing is necessary'
    )
  }

  return result
}

/**
 * 📊 CALCULATE PERFORMANCE CHARACTERISTICS
 * FIXED: Properly categorizes timekeeper actions and calculates overhead
 */
const calculatePerformanceCharacteristics = (
  action: IO,
  verification: VerificationResult
) => {
  let expectedOverhead = 0
  let category: 'FAST_PATH' | 'LIGHT' | 'NORMAL' | 'HEAVY' | 'TIMEKEEPER' =
    'FAST_PATH'
  let optimizationLevel = 100

  // FIXED: Check timekeeper requirements FIRST and categorize appropriately
  const needsTimekeeper = requiresTimekeeper(action)

  if (needsTimekeeper) {
    expectedOverhead += 1.0 // Timekeeper scheduling overhead
    category = 'TIMEKEEPER'
    optimizationLevel -= 15 // Timekeeper adds complexity
  } else {
    // Calculate expected overhead based on protection features
    if (action.throttle) {
      expectedOverhead += 0.1 // Throttle check is very fast
      optimizationLevel -= 5
    }

    if (action.debounce) {
      expectedOverhead += 0.5 // Timer setup overhead
      optimizationLevel -= 10
    }

    if (action.detectChanges) {
      expectedOverhead += 0.2 // Deep comparison overhead
      optimizationLevel -= 5
    }

    if (action.middleware) {
      expectedOverhead += action.middleware.length * 0.3 // Per middleware overhead
      optimizationLevel -= action.middleware.length * 8
    }

    // System recuperation check (always present but minimal)
    expectedOverhead += 0.05

    // Categorize performance for non-timekeeper actions
    if (expectedOverhead < 0.1) {
      category = 'FAST_PATH'
    } else if (expectedOverhead < 0.5) {
      category = 'LIGHT'
    } else if (expectedOverhead < 2.0) {
      category = 'NORMAL'
    } else {
      category = 'HEAVY'
    }
  }

  // Adjust optimization level based on verification issues
  optimizationLevel -= verification.warnings.length * 5
  optimizationLevel -= verification.errors.length * 20
  optimizationLevel = Math.max(0, Math.min(100, optimizationLevel))

  return {
    expectedOverhead,
    category,
    optimizationLevel
  }
}

/**
 * FIXED: FAST PATH DETECTION
 * Determines if a channel can use zero-overhead execution
 * Must properly exclude timekeeper actions and actions with protections
 */
const isFastPathEligible = (action: IO): boolean => {
  // CRITICAL: Fast path is ONLY for simple actions with no special requirements
  const hasProtections = !!(
    action.throttle ||
    action.debounce ||
    action.detectChanges ||
    (action.middleware && action.middleware.length > 0)
  )

  const needsTimekeeper = requiresTimekeeper(action)

  const isFastPath = !hasProtections && !needsTimekeeper

  return isFastPath
}

/**
 * 🔧 SYSTEM PROTECTION FUNCTIONS
 * Built-in system protections that are always applied
 */
const createSystemProtections = (): PipelineFunction[] => {
  return [
    // System recuperation check (always first, ultra-lightweight)
    async (action, payload, next) => {
      // Import here to avoid circular dependency
      const {metricsState} = await import('../context/metrics-state')
      const {breathing} = metricsState.get()

      if (breathing.isRecuperating && action.priority?.level !== 'critical') {
        return {
          ok: false,
          payload: null,
          message: `System recuperating. Only critical actions allowed.`
        }
      }
      return next(payload)
    },

    // Repeat zero check (prevents execution if repeat is 0)
    async (action, payload, next) => {
      if (action.repeat === 0) {
        return {
          ok: true,
          payload: null,
          message: 'Action registered but not executed (repeat: 0)'
        }
      }
      return next(payload)
    }
  ]
}

/**
 * 🏗️ PIPELINE CONSTRUCTION
 * Builds the optimized execution pipeline for a channel
 */
const buildPipeline = (action: IO): PipelineFunction[] => {
  const pipeline: PipelineFunction[] = []

  // Add system protections first (always included)
  pipeline.push(...createSystemProtections())

  // Add optional protection functions in optimal order
  if (action.throttle) {
    pipeline.push(applyThrottleProtection)
  }

  if (action.debounce) {
    pipeline.push(applyDebounceProtection)
  }

  if (action.detectChanges) {
    pipeline.push(applyChangeDetectionProtection)
  }

  if (action.middleware?.length) {
    pipeline.push(applyMiddlewareProtection)
  }

  return pipeline
}

/**
 * 🔒 GENERATE VERIFICATION HASH
 * Creates a hash of action configuration for cache invalidation
 */
const generateVerificationHash = (action: IO): string => {
  const hashableProps = {
    id: action.id,
    throttle: action.throttle,
    debounce: action.debounce,
    detectChanges: action.detectChanges,
    middleware: action.middleware,
    interval: action.interval,
    delay: action.delay,
    repeat: action.repeat,
    priority: action.priority?.level
  }

  // Simple hash function (in production, consider using a proper hash library)
  return btoa(JSON.stringify(hashableProps)).slice(0, 16)
}

/**
 * 🚀 MAIN COMPILATION FUNCTION
 * FIXED: Proper timekeeper detection and pipeline construction
 */
export const compileActionPipeline = (action: IO): CompiledPipeline => {
  // Safe performance measurement with fallback
  const startTime = safePerformanceNow()

  // Generate verification hash for cache invalidation
  const verificationHash = generateVerificationHash(action)

  // Check cache first using functional state
  const cachedPipeline = pipelineState.get(action.id)
  if (cachedPipeline && cachedPipeline.verificationHash === verificationHash) {
    log.debug(`📦 Pipeline cache hit for ${action.id}`)
    return cachedPipeline
  }

  // 1. Perform compile-time verification
  const verification = performCompileTimeVerification(action)

  if (!verification.isValid) {
    const errorMsg = `Pipeline compilation failed for ${
      action.id
    }: ${verification.errors.join(', ')}`
    log.error(errorMsg)
    throw new Error(errorMsg)
  }

  // Log warnings and optimizations
  verification.warnings.forEach(warning => log.warn(`${action.id}: ${warning}`))
  verification.optimizations.forEach(opt => log.info(`${action.id}: 💡 ${opt}`))

  // 2. FIXED: Determine execution strategy
  const needsTimekeeper = requiresTimekeeper(action)
  const isFastPath = isFastPathEligible(action)

  // Verify logic consistency
  if (needsTimekeeper && isFastPath) {
    log.error(
      `❌ Logic error: ${action.id} marked as both timekeeper and fast path`
    )
    throw new Error(`Inconsistent pipeline classification for ${action.id}`)
  }

  // 3. Calculate performance characteristics
  const performance = calculatePerformanceCharacteristics(action, verification)

  // 4. Build pipeline based on execution strategy
  let pipeline: PipelineFunction[]

  if (isFastPath) {
    // Fast path: no pipeline needed
    pipeline = []
  } else if (needsTimekeeper) {
    // Timekeeper actions: minimal pipeline (system protections only)
    pipeline = createSystemProtections()
  } else {
    // Full pipeline for protected actions
    pipeline = buildPipeline(action)
    log.debug(`🏗️ Full pipeline for ${action.id}: ${pipeline.length} steps`)
  }

  // 5. Pre-compute flags for runtime checks
  const flags = {
    hasThrottle: !!action.throttle,
    hasDebounce: !!action.debounce,
    hasChangeDetection: !!action.detectChanges,
    hasMiddleware: hasMiddleware(action),
    hasInterval: !!action.interval,
    hasDelay: action.delay !== undefined,
    hasRepeat:
      action.repeat !== undefined && action.repeat !== 1 && action.repeat !== 0
  }

  // 6. Validate middleware at compile time
  let middlewareValidation
  if (action.middleware?.length) {
    middlewareValidation = validateMiddlewareChain(action)
  }

  // 7. Create compiled pipeline
  const compiledPipeline: CompiledPipeline = {
    channelId: action.id,
    hasProtections: !isFastPath && !needsTimekeeper,
    isFastPath,
    requiresTimekeeper: needsTimekeeper,
    verificationHash,
    compiledAt: Date.now(),
    pipeline,
    flags,
    verification,
    performance,
    middlewareValidation
  }

  // 8. Store in functional state system
  pipelineState.set(compiledPipeline)

  const compilationTime = safePerformanceNow() - startTime

  // Log performance characteristics with appropriate messages
  if (performance.category === 'TIMEKEEPER') {
    log.info(`⏱️ Timekeeper action compiled for ${action.id}`)
  } else if (performance.category === 'HEAVY') {
    log.warn(
      `⚠️ Heavy pipeline detected for ${
        action.id
      }: ${performance.expectedOverhead.toFixed(2)}ms overhead`
    )
  } else if (isFastPath) {
    log.success(`⚡ Fast path enabled for ${action.id} (zero overhead)`)
  } else {
    log.info(`🏗️ Pipeline compiled for ${action.id} (${performance.category})`)
  }

  return compiledPipeline
}

/**
 * 📋 GET COMPILED PIPELINE (with cache check)
 */
export const getCompiledPipeline = (action: IO): CompiledPipeline => {
  const verificationHash = generateVerificationHash(action)

  // Check functional state cache
  if (pipelineState.has(action.id, verificationHash)) {
    return pipelineState.get(action.id)!
  }

  // Recompile if cache miss or invalid
  return compileActionPipeline(action)
}

/**
 * 🗑️ INVALIDATE PIPELINE CACHE
 */
export const invalidatePipelineCache = (channelId?: string): void => {
  if (channelId) {
    pipelineState.forget(channelId)
  } else {
    pipelineState.clear()
    log.debug('🗑️ All pipeline caches cleared')
  }
}

/**
 * 📊 PIPELINE CACHE STATISTICS
 */
export const getPipelineCacheStats = () => {
  return pipelineState.getStats()
}

/**
 * 🧹 MAINTENANCE FUNCTIONS
 */
export const clearPipelineCache = (): void => {
  pipelineState.clear()
}

export const getAllCompiledPipelines = (): CompiledPipeline[] => {
  return pipelineState.getAll()
}

/**
 * 🔍 DEVELOPMENT HELPERS
 */
export const getPipelineDebugInfo = (actionId: string) => {
  return pipelineState.debug.getPipelineDetails(actionId)
}
