// src/schema/channel-operators.ts
// Complete optimized talent system with compileAction and executePipeline

import type {IO, TalentResult} from '../types/core'
import {sensor} from '../context/metrics-report'
import {log} from '../components/cyre-log'
import payloadState from '../context/payload-state'
import {useDispatch} from '../components/cyre-dispatch'
import TimeKeeper from '../components/cyre-timekeeper'
import {isEqual} from '../libs/utils'

/*
      C.Y.R.E - O.P.T.I.M.I.Z.E.D - T.A.L.E.N.T - S.Y.S.T.E.M
      
      This system implements an optimized talent pipeline for processing actions:
      - Smart compileAction: Pre-compiles actions with channel-specific optimizations
      - Zero-overhead executePipeline: Skips unnecessary processing for simple channels
      - Fast path execution: Specialized handling for basic validation cases
      - Intelligent caching: Reduces redundant compilation
      - Runtime analytics: Monitors performance and optimization effectiveness
      - Full API compatibility: Maintains existing interface while improving performance
*/

// ============================================================================
// OPTIMIZATION INFRASTRUCTURE
// ============================================================================

/**
 * ChannelProfile tracks optimization metadata for each channel
 * - requiredTalents: Set of talents needed for this channel
 * - compiledPipeline: Pre-compiled sequence of talent functions
 * - lastCompiled: Timestamp of last compilation
 * - executionCount: Number of times channel has been executed
 * - avgExecutionTime: Average execution time in milliseconds
 * - fastPath: Whether channel qualifies for fast path optimization
 * - zeroOverhead: Whether channel can skip all processing
 */
interface ChannelProfile {
  id: string
  requiredTalents: Set<string>
  compiledPipeline: TalentFunction[]
  lastCompiled: number
  executionCount: number
  avgExecutionTime: number
  fastPath: boolean
  zeroOverhead: boolean
}

/**
 * TalentFunction represents a single processing step in the pipeline
 * - name: Identifier for the talent
 * - fn: The actual processing function
 * - weight: Relative computational cost
 * - dependencies: Other talents this one depends on
 */
interface TalentFunction {
  name: string
  fn: (action: IO, payload: any) => TalentResult
  weight: number
  dependencies: string[]
}

/**
 * CompileResult contains the output of action compilation
 * - compiledAction: The optimized action
 * - errors: Any compilation errors
 * - warnings: Non-critical issues
 * - hasFastPath: Whether fast path optimization is possible
 * - channelProfile: Associated optimization metadata
 * - optimizationApplied: List of optimizations used
 */
interface CompileResult {
  compiledAction: IO
  errors: string[]
  warnings: string[]
  hasFastPath: boolean
  channelProfile: ChannelProfile
  optimizationApplied: string[]
}

// Global optimization state
const channelProfiles = new Map<string, ChannelProfile>() // Tracks optimization data per channel
const talentRegistry = new Map<string, TalentFunction>() // Registry of available talents
const dependencyGraph = new Map<string, Set<string>>() // Talent dependency relationships
const compilationCache = new Map<string, CompileResult>() // Caches compilation results
let isOptimizationInitialized = false // Tracks initialization state

/**
 * Available talents with their weights and dependencies
 * Weights indicate relative computational cost (higher = more expensive)
 * Dependencies list other talents that must run before this one
 */
const AVAILABLE_TALENTS = {
  schema: {weight: 3, dependencies: []}, // Validates payload structure
  required: {weight: 1, dependencies: []}, // Checks if payload is required
  selector: {weight: 2, dependencies: []}, // Extracts specific data from payload
  condition: {weight: 2, dependencies: []}, // Validates payload against conditions
  transform: {weight: 2, dependencies: []}, // Modifies payload data
  detectChanges: {weight: 3, dependencies: ['selector']}, // Tracks payload changes
  throttle: {weight: 4, dependencies: []}, // Limits execution frequency
  debounce: {weight: 4, dependencies: []}, // Delays execution until quiet period
  schedule: {weight: 5, dependencies: []}, // Handles timing of execution
  priority: {weight: 1, dependencies: []} // Sets execution priority
}

// ============================================================================
// TALENT IMPLEMENTATIONS
// ============================================================================

// COMPLETE FIX: Apply these changes to your talent-definitions-optimized.ts

// ============================================================================
// STEP 1: REPLACE getTalentImplementation function (around line 200)
// ============================================================================

const getTalentImplementation = (talentName: string) => {
  switch (talentName) {
    case 'schema':
      return (action: IO, payload: any): TalentResult => {
        if (!action.schema) return {ok: true, payload}

        try {
          const result = action.schema(payload)

          // Handle boolean results
          if (typeof result === 'boolean') {
            return {
              ok: result,
              payload: result ? payload : undefined,
              message: result ? 'Schema validated' : 'Schema validation failed',
              error: !result
            }
          }

          // Handle object results with ok property
          if (result && typeof result === 'object' && 'ok' in result) {
            return {
              ok: result.ok,
              payload: result.ok
                ? result.data !== undefined
                  ? result.data
                  : payload
                : payload,
              message: result.ok
                ? 'Schema validated'
                : `Schema failed: ${
                    result.errors?.join(', ') || 'Invalid data'
                  }`,
              error: !result.ok
            }
          }

          // Fallback for unclear results
          return {
            ok: true,
            payload,
            message: 'Schema validated (fallback)'
          }
        } catch (error) {
          return {
            ok: false,
            payload,
            message: `Schema error: ${
              error instanceof Error ? error.message : String(error)
            }`,
            error: true
          }
        }
      }

    case 'required':
      return (action: IO, payload: any): TalentResult => {
        // Auto-infer required from schema presence if not explicitly set
        const effectiveRequired =
          action.required !== undefined
            ? action.required
            : Boolean(action.schema)

        if (!effectiveRequired) {
          return {ok: true, payload}
        }

        if (effectiveRequired === true && payload === undefined) {
          return {
            ok: false,
            message: action.schema
              ? 'Payload required (enforced by schema)'
              : 'Payload required',
            payload: undefined,
            error: true
          }
        }

        return {ok: true, payload}
      }

    case 'selector':
      return (action: IO, payload: any): TalentResult => {
        if (!action.selector) return {ok: true, payload}

        try {
          const selected = action.selector(payload)
          return {
            ok: true,
            payload: selected,
            message: 'Payload selected'
          }
        } catch (error) {
          return {
            ok: false,
            payload,
            message: `Selector failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            error: true
          }
        }
      }

    case 'condition':
      return (action: IO, payload: any): TalentResult => {
        if (!action.condition) return {ok: true, payload}

        try {
          const conditionMet = action.condition(payload)

          if (!conditionMet) {
            return {
              ok: false,
              payload,
              message: 'Condition not met',
              error: false // Not an error, just condition failed
            }
          }

          return {ok: true, payload}
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          return {
            ok: false,
            error: true,
            message: `Condition failed: ${errorMessage}`,
            payload
          }
        }
      }

    case 'transform':
      return (action: IO, payload: any): TalentResult => {
        if (!action.transform) {
          return {ok: true, payload}
        }

        try {
          const transformed = action.transform(payload)

          return {
            ok: true,
            payload: transformed,
            message: 'Payload transformed'
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          return {
            ok: false,
            payload,
            message: `Transform failed: ${errorMessage}`,
            error: true
          }
        }
      }

    case 'detectChanges':
      return (action: IO, payload: any): TalentResult => {
        if (!action.detectChanges) return {ok: true, payload}

        try {
          const previousPayload = payloadState.get(action.id)

          if (previousPayload === undefined) {
            return {ok: true, payload}
          }

          const hasChanges = !isEqual(payload, previousPayload)

          if (!hasChanges) {
            return {
              ok: false,
              payload,
              message: 'No changes detected',
              error: false // Not an error, just no changes
            }
          }

          return {ok: true, payload}
        } catch (error) {
          return {ok: true, payload} // Safe fallback
        }
      }

    case 'throttle':
      return (action: IO, payload: any): TalentResult => {
        // Throttle logic is handled at the app.ts level before talents run
        // This is a pass-through since throttling happens earlier in the pipeline
        return {ok: true, payload}
      }

    case 'debounce':
      return (action: IO, payload: any): TalentResult => {
        // Debounce logic is handled at the app.ts level before talents run
        // This is a pass-through since debouncing happens earlier in the pipeline
        return {ok: true, payload}
      }

    case 'schedule':
      return (action: IO, payload: any): TalentResult => {
        // CRITICAL FIX: The schedule talent should ONLY validate scheduling params
        // The actual scheduling is handled by cyre-dispatch.ts AFTER pipeline execution
        // This talent just validates that scheduling parameters are valid

        const interval = action.interval
        const delay = action.delay
        const repeat = action.repeat

        // Validate scheduling parameters
        if (interval !== undefined && interval < 0) {
          return {
            ok: false,
            payload,
            message: 'Invalid interval: must be >= 0',
            error: true
          }
        }

        if (delay !== undefined && delay < 0) {
          return {
            ok: false,
            payload,
            message: 'Invalid delay: must be >= 0',
            error: true
          }
        }

        if (repeat !== undefined && repeat !== true && repeat < 0) {
          return {
            ok: false,
            payload,
            message: 'Invalid repeat: must be >= 0 or true',
            error: true
          }
        }

        // Scheduling parameters are valid - pass through
        // The actual scheduling happens in cyre-dispatch.ts
        return {
          ok: true,
          payload,
          message: 'Scheduling parameters validated'
        }
      }

    case 'priority':
      return (action: IO, payload: any): TalentResult => {
        // Priority is handled at dispatch level, this is a pass-through
        return {ok: true, payload}
      }

    default:
      return () => ({
        ok: false,
        message: `Unknown talent: ${talentName}`,
        error: true
      })
  }
}

// ============================================================================
// STEP 2: REPLACE executeFastPath function (around line 550)
// ============================================================================

const executeFastPath = (
  action: IO,
  payload: any,
  profile: ChannelProfile,
  startTime: number
): TalentResult => {
  let currentPayload = payload

  // Use the updated talent implementations directly
  for (const talent of profile.compiledPipeline) {
    const result = talent.fn(action, currentPayload)

    if (!result.ok) {
      const executionTime = performance.now() - startTime
      updateChannelProfile(action.id, executionTime, false)

      return {
        ok: false,
        payload: currentPayload,
        message: result.message || `Fast path failed: ${talent.name}`,
        error: true
      }
    }

    if (result.payload !== undefined) {
      currentPayload = result.payload
    }
  }

  const executionTime = performance.now() - startTime
  updateChannelProfile(action.id, executionTime, true)

  return {
    ok: true,
    payload: currentPayload,
    message: `Fast path: ${profile.compiledPipeline.length} talents executed`
  }
}

// ============================================================================
// STEP 3: ADD cache clearing function and call it
// ============================================================================

/**
 * Clear all optimization caches - CRITICAL for applying fixes
 */
export const clearAllOptimizationCaches = (): void => {
  channelProfiles.clear()
  compilationCache.clear()

  // Re-register talents with fixed implementations
  Object.entries(AVAILABLE_TALENTS).forEach(([name, meta]) => {
    talentRegistry.set(name, {
      name,
      fn: getTalentImplementation(name), // Use the fixed implementation
      weight: meta.weight,
      dependencies: meta.dependencies
    })
  })

  log.info(
    'All optimization caches cleared and talents re-registered with fixes'
  )
}

// ============================================================================
// STEP 4: UPDATE the initializeOptimization function (around line 120)
// ============================================================================

export const initializeOptimization = (): void => {
  if (isOptimizationInitialized) {
    // If already initialized, clear caches and re-register with fixes
    clearAllOptimizationCaches()
    return
  }

  // Register talent functions with metadata
  Object.entries(AVAILABLE_TALENTS).forEach(([name, meta]) => {
    talentRegistry.set(name, {
      name,
      fn: getTalentImplementation(name), // Use fixed implementations
      weight: meta.weight,
      dependencies: meta.dependencies
    })

    // Build dependency graph
    if (meta.dependencies.length > 0) {
      dependencyGraph.set(name, new Set(meta.dependencies))
    }
  })

  isOptimizationInitialized = true
  log.info(
    'Talent optimization system initialized with FIXED implementations',
    {
      totalTalents: talentRegistry.size,
      dependencyNodes: dependencyGraph.size
    }
  )
}

// ============================================================================
// STEP 5: UPDATE resetOptimizationCache function to use the new clear function
// ============================================================================

export const resetOptimizationCache = (): void => {
  clearAllOptimizationCaches()
  log.info('Optimization cache reset with FIXED talent implementations')
}

// ============================================================================
// INITIALIZATION SYSTEM
// ============================================================================

// ============================================================================
// CHANNEL ANALYSIS
// ============================================================================

/**
 * Analyzes an action to determine which talents it requires
 * This is a static analysis that happens during compilation
 * @param action The action to analyze
 * @returns Set of required talent names
 */
const analyzeChannelRequirements = (action: IO): Set<string> => {
  const requiredTalents = new Set<string>()

  // Direct talent requirements based on action properties
  if (action.schema) requiredTalents.add('schema')
  if (action.required !== undefined || action.schema)
    requiredTalents.add('required')
  if (action.selector) requiredTalents.add('selector')
  if (action.condition) requiredTalents.add('condition')
  if (action.transform) requiredTalents.add('transform')
  if (action.detectChanges) requiredTalents.add('detectChanges')
  if (action.throttle) requiredTalents.add('throttle')
  if (action.debounce) requiredTalents.add('debounce')
  if (action.delay || action.interval || action.repeat)
    requiredTalents.add('schedule')
  if (action.priority) requiredTalents.add('priority')

  // Add dependencies recursively
  const resolvedTalents = new Set(requiredTalents)
  requiredTalents.forEach(talent => {
    const deps = dependencyGraph.get(talent)
    if (deps) {
      deps.forEach(dep => resolvedTalents.add(dep))
    }
  })

  return resolvedTalents
}

/**
 * Build optimized talent pipeline for specific channel
 */
const buildOptimizedPipeline = (
  action: IO,
  requiredTalents: Set<string>
): TalentFunction[] => {
  if (requiredTalents.size === 0) {
    return [] // Zero-overhead path
  }

  // Get talent functions in optimal execution order
  const orderedTalents = [
    'required',
    'schema',
    'selector',
    'condition',
    'transform',
    'detectChanges',
    'throttle',
    'debounce',
    'schedule',
    'priority'
  ]
    .filter(name => requiredTalents.has(name))
    .map(name => talentRegistry.get(name)!)
    .filter(Boolean)

  return orderedTalents
}

/**
 * Fast path detection - channels with minimal processing needs
 */
const isFastPath = (requiredTalents: Set<string>): boolean => {
  // Fast path: no talents or only lightweight validation
  if (requiredTalents.size === 0) return true
  if (requiredTalents.size === 1 && requiredTalents.has('required')) return true
  if (
    requiredTalents.size <= 2 &&
    requiredTalents.has('required') &&
    requiredTalents.has('schema')
  )
    return true

  return false
}

/**
 * Zero overhead detection
 */
const isZeroOverhead = (requiredTalents: Set<string>): boolean => {
  return requiredTalents.size === 0
}

// ============================================================================
// COMPILE ACTION (OPTIMIZED)
// ============================================================================

/**
 * Main compilation function that optimizes an action
 * - Analyzes required talents
 * - Builds optimized pipeline
 * - Creates channel profile
 * - Caches results
 * @param action The action to compile
 * @returns Compilation result with optimizations
 */
export const compileAction = (action: Partial<IO>): CompileResult => {
  if (!isOptimizationInitialized) {
    initializeOptimization()
  }

  const startTime = performance.now()

  // Ensure we have a complete action
  const fullAction: IO = {
    id: action.id || 'unknown',
    ...action
  } as IO

  const errors: string[] = []
  const warnings: string[] = []
  const optimizationApplied: string[] = []

  try {
    // Check cache first
    const cacheKey = `${fullAction.id}-${JSON.stringify(fullAction).slice(
      0,
      100
    )}`
    const cached = compilationCache.get(cacheKey)

    if (cached && cached.channelProfile.lastCompiled > Date.now() - 300000) {
      optimizationApplied.push('Using cached compilation')
      return {
        ...cached,
        optimizationApplied
      }
    }

    // 1. Analyze what this channel actually needs
    const requiredTalents = analyzeChannelRequirements(fullAction)

    // 2. Build optimized pipeline
    const compiledPipeline = buildOptimizedPipeline(fullAction, requiredTalents)
    const fastPath = isFastPath(requiredTalents)
    const zeroOverhead = isZeroOverhead(requiredTalents)

    // 3. Create channel profile
    const profile: ChannelProfile = {
      id: fullAction.id,
      requiredTalents,
      compiledPipeline,
      lastCompiled: Date.now(),
      executionCount: 0,
      avgExecutionTime: 0,
      fastPath,
      zeroOverhead
    }

    channelProfiles.set(fullAction.id, profile)

    optimizationApplied.push(
      `Compiled ${requiredTalents.size}/${
        Object.keys(AVAILABLE_TALENTS).length
      } talents`
    )

    if (zeroOverhead) {
      optimizationApplied.push('Zero-overhead execution path')
    } else if (fastPath) {
      optimizationApplied.push('Fast path optimization enabled')
    }

    // 4. Attach optimized execution metadata to action
    const compiledAction: IO = {
      ...fullAction,
      _processingTalents: Array.from(requiredTalents),
      _compiledPipeline: profile.compiledPipeline,
      _fastPath: profile.fastPath,
      _compilationId: `${fullAction.id}-${profile.lastCompiled}`
    }

    const compilationTime = performance.now() - startTime
    const result: CompileResult = {
      compiledAction,
      errors,
      warnings,
      hasFastPath: profile.fastPath,
      channelProfile: profile,
      optimizationApplied
    }

    // Cache the result
    compilationCache.set(cacheKey, result)

    // Log performance insights

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    errors.push(`Compilation failed: ${errorMessage}`)

    sensor.error(fullAction.id, errorMessage, 'compilation-error')

    return {
      compiledAction: fullAction as IO,
      errors,
      warnings,
      hasFastPath: false,
      channelProfile: channelProfiles.get(fullAction.id) || {
        id: fullAction.id,
        requiredTalents: new Set(),
        compiledPipeline: [],
        lastCompiled: Date.now(),
        executionCount: 0,
        avgExecutionTime: 0,
        fastPath: false,
        zeroOverhead: false
      },
      optimizationApplied: ['Fallback to standard compilation']
    }
  }
}

// ============================================================================
// EXECUTE PIPELINE (OPTIMIZED)
// ============================================================================

/**
 * Executes the talent pipeline with optimizations
 * - Uses zero-overhead path when possible
 * - Falls back to fast path for simple cases
 * - Otherwise uses full optimized pipeline
 * @param action The action to execute
 * @param payload The data to process
 * @returns Result of pipeline execution
 */
export const executePipeline = (action: IO, payload: any): TalentResult => {
  const startTime = performance.now()

  // Get channel profile
  const profile = channelProfiles.get(action.id)

  if (!profile) {
    // Fallback: compile on demand
    const compileResult = compileAction(action)
    return executePipeline(compileResult.compiledAction, payload)
  }

  // Zero-overhead path for channels without processing needs
  if (profile.zeroOverhead) {
    updateChannelProfile(action.id, performance.now() - startTime, true)
    return {
      ok: true,
      payload,
      message: 'Zero-overhead execution'
    }
  }

  // Fast path for simple validations
  if (profile.fastPath && profile.compiledPipeline.length <= 2) {
    return executeFastPath(action, payload, profile, startTime)
  }

  // Optimized execution with early termination
  let currentPayload = payload
  const pipeline = profile.compiledPipeline

  for (let i = 0; i < pipeline.length; i++) {
    const talent = pipeline[i]
    const result = talent.fn(action, currentPayload)

    if (!result.ok) {
      // Update channel profile with failure data
      updateChannelProfile(action.id, performance.now() - startTime, false)

      return {
        ok: false,
        payload: currentPayload,
        message: result.message || `Talent ${talent.name} failed`,
        error: true
      }
    }

    if (result.payload !== undefined) {
      currentPayload = result.payload
    }
  }

  // Update successful execution metrics
  const executionTime = performance.now() - startTime
  updateChannelProfile(action.id, executionTime, true)

  return {
    ok: true,
    payload: currentPayload,
    message: `Optimized pipeline: ${pipeline.length} talents executed`
  }
}

/**
 * Update channel profile with execution metrics
 */
const updateChannelProfile = (
  channelId: string,
  executionTime: number,
  success: boolean
): void => {
  const profile = channelProfiles.get(channelId)
  if (!profile) return

  profile.executionCount++
  profile.avgExecutionTime = (profile.avgExecutionTime + executionTime) / 2

  // Adaptive optimization: consider disabling fast path if performance degrades
  if (!success && profile.fastPath && profile.executionCount > 10) {
    if (profile.avgExecutionTime > 5) {
      // 5ms threshold
      profile.fastPath = false
      log.info(
        `Disabled fast path for ${channelId} due to performance degradation`
      )
    }
  }
}

// ============================================================================
// ANALYTICS AND MONITORING
// ============================================================================

/**
 * Get channel optimization analytics
 */
export const getOptimizationAnalytics = () => {
  const profiles = Array.from(channelProfiles.values())

  return {
    totalChannels: profiles.length,
    fastPathChannels: profiles.filter(p => p.fastPath).length,
    zeroOverheadChannels: profiles.filter(p => p.zeroOverhead).length,
    avgTalentsPerChannel:
      profiles.reduce((sum, p) => sum + p.requiredTalents.size, 0) /
        profiles.length || 0,
    avgExecutionTime:
      profiles.reduce((sum, p) => sum + p.avgExecutionTime, 0) /
        profiles.length || 0,
    totalOptimizationSavings: calculateOptimizationSavings(profiles),
    compilationCacheSize: compilationCache.size,
    channelEfficiency: profiles.map(p => ({
      id: p.id,
      talents: p.requiredTalents.size,
      executions: p.executionCount,
      avgTime: p.avgExecutionTime,
      fastPath: p.fastPath,
      zeroOverhead: p.zeroOverhead
    }))
  }
}

/**
 * Calculate optimization savings compared to running all talents
 */
const calculateOptimizationSavings = (profiles: ChannelProfile[]): number => {
  const totalAvailableTalents = Object.keys(AVAILABLE_TALENTS).length
  let totalSavings = 0

  profiles.forEach(profile => {
    const unusedTalents = totalAvailableTalents - profile.requiredTalents.size
    const estimatedSavingsPerExecution = unusedTalents * 0.5 // 0.5ms per unused talent
    totalSavings += estimatedSavingsPerExecution * profile.executionCount
  })

  return totalSavings
}

/**
 * Proactive optimization - analyze and optimize channels based on usage patterns
 */
export const runProactiveOptimization = (): void => {
  const profiles = Array.from(channelProfiles.values())
  let optimizationsApplied = 0

  profiles.forEach(profile => {
    // Enable fast path for frequently used simple channels
    if (
      !profile.fastPath &&
      profile.executionCount > 100 &&
      profile.requiredTalents.size <= 2 &&
      profile.avgExecutionTime < 2
    ) {
      profile.fastPath = true
      optimizationsApplied++
    }

    // Disable fast path for consistently slow channels
    if (
      profile.fastPath &&
      profile.avgExecutionTime > 10 &&
      profile.executionCount > 50
    ) {
      profile.fastPath = false
      optimizationsApplied++
    }
  })

  if (optimizationsApplied > 0) {
    log.info(
      `Proactive optimization completed: ${optimizationsApplied} channels optimized`
    )
  }
}

// ============================================================================
// INITIALIZATION AND EXPORTS
// ============================================================================

// Initialize on module load
initializeOptimization()

// Export all functions with original names for compatibility
