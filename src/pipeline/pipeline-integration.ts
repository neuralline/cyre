// src/pipeline/pipeline-integration.ts
// FIXED: Integration layer with proper action property preservation and debugging

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {io} from '../context/state'
import {log} from '../components/cyre-log'
import {
  compileActionPipeline,
  invalidatePipelineCache,
  getCompiledPipeline
} from './pipeline-compiler'
import {executeCompiledAction, processChainReaction} from './pipeline-executor'

/*

      C.Y.R.E. - P.I.P.E.L.I.N.E. - I.N.T.E.G.R.A.T.I.O.N.
      
      FIXED: Integration layer with proper action property preservation:
      1. Enhanced action registration with property debugging
      2. Optimized call execution with timing detection
      3. Cache management hooks
      4. Backward compatibility maintained

*/

/**
 * Debug function to trace action properties
 */
const debugActionProperties = (action: IO, stage: string): void => {
  const needsTimekeeper = !!(
    action.interval ||
    action.delay !== undefined ||
    (action.repeat !== undefined && action.repeat !== 1 && action.repeat !== 0)
  )
}

/**
 * ENHANCED ACTION REGISTRATION
 * FIXED: Preserves all action properties and adds debugging
 */
export const registerActionWithPipeline = (
  action: IO
): {ok: boolean; message: string} => {
  try {
    // FIXED: Debug action properties BEFORE any processing
    debugActionProperties(action, 'PRE-REGISTRATION')

    // CRITICAL FIX: Ensure all timing properties are preserved
    const processedAction: IO = {
      ...action,
      // Explicitly preserve timing properties
      interval: action.interval,
      delay: action.delay,
      repeat: action.repeat,
      // Preserve protection properties
      throttle: action.throttle,
      debounce: action.debounce,
      detectChanges: action.detectChanges,
      middleware: action.middleware,
      // Ensure timestamp and type are set
      timestamp: action.timestamp || Date.now(),
      type: action.type || action.id
    }

    // Debug after processing
    debugActionProperties(processedAction, 'POST-PROCESSING')

    // Store the action FIRST, then compile pipeline
    io.set(processedAction)

    // Now compile and cache the pipeline
    const compiledPipeline = compileActionPipeline(processedAction)

    // Verify the compilation result

    // Verify warnings
    if (compiledPipeline.verification.warnings.length > 0) {
      log.warn(
        `Action ${action.id} has ${compiledPipeline.verification.warnings.length} warnings`
      )
      compiledPipeline.verification.warnings.forEach(warning =>
        log.warn(`  - ${warning}`)
      )
    }

    return {
      ok: true,
      message: `Action registered with ${
        compiledPipeline.isFastPath
          ? 'fast path'
          : compiledPipeline.requiresTimekeeper
          ? 'timekeeper'
          : 'compiled pipeline'
      }`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to register action ${action.id}: ${errorMessage}`)

    return {
      ok: false,
      message: `Action registration failed: ${errorMessage}`
    }
  }
}

/**
 * ENHANCED ACTION UPDATE
 * Recompiles pipeline when action configuration changes
 */
export const updateActionWithPipeline = (
  action: IO
): {ok: boolean; message: string} => {
  try {
    log.debug(`🔄 Updating action with pipeline recompilation: ${action.id}`)

    // Debug before update
    debugActionProperties(action, 'PRE-UPDATE')

    // 1. Invalidate existing pipeline cache
    invalidatePipelineCache(action.id)

    // 2. Process and store updated action
    const updatedAction: IO = {
      ...action,
      timestamp: Date.now(),
      type: action.type || action.id
    }

    io.set(updatedAction)

    // 3. Recompile with new configuration
    const compiledPipeline = compileActionPipeline(updatedAction)

    // 4. Log changes
    const pathChange = compiledPipeline.isFastPath
      ? 'FAST PATH'
      : compiledPipeline.requiresTimekeeper
      ? 'TIMEKEEPER'
      : compiledPipeline.performance.category
    log.debug(`Action ${action.id} updated with ${pathChange} pipeline`)

    return {
      ok: true,
      message: `Action updated with ${
        compiledPipeline.isFastPath
          ? 'fast path'
          : compiledPipeline.requiresTimekeeper
          ? 'timekeeper'
          : 'recompiled pipeline'
      }`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to update action ${action.id}: ${errorMessage}`)

    return {
      ok: false,
      message: `Action update failed: ${errorMessage}`
    }
  }
}

/**
 * OPTIMIZED CALL EXECUTION
 * Uses compiled pipeline for maximum performance
 */
export const executeOptimizedCall = async (
  actionId: string,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  try {
    // 1. Get action configuration
    const action = io.get(actionId)
    if (!action) {
      return {
        ok: false,
        payload: null,
        message: `Action not found: ${actionId}`
      }
    }

    // Debug action properties before execution
    debugActionProperties(action, 'PRE-EXECUTION')

    // 2. Execute using compiled pipeline
    const response = await executeCompiledAction(action, payload)

    // 3. Process chain reactions if present
    if (response.ok && response.metadata?.intraLink) {
      // Process chain reaction asynchronously to avoid blocking main response
      setImmediate(() =>
        processChainReaction(
          actionId,
          response.metadata!.intraLink!.id,
          response.metadata!.intraLink!.payload
        )
      )
    }

    return response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(
      `Optimized call execution failed for ${actionId}: ${errorMessage}`
    )

    return {
      ok: false,
      payload: null,
      message: `Call execution failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * ACTION REMOVAL WITH CLEANUP
 * Properly cleans up pipeline cache when action is removed
 */
export const removeActionWithCleanup = (actionId: string): boolean => {
  try {
    log.debug(`🗑️ Removing action with pipeline cleanup: ${actionId}`)

    // 1. Remove from pipeline cache
    invalidatePipelineCache(actionId)

    // 2. Remove from existing system
    const removed = io.forget(actionId)

    if (removed) {
      log.debug(`Action ${actionId} removed successfully`)
    } else {
      log.warn(`Action ${actionId} was not found during removal`)
    }

    return removed
  } catch (error) {
    log.error(`Failed to remove action ${actionId}: ${error}`)
    return false
  }
}

/**
 * BULK ACTION OPERATIONS
 * Optimized operations for multiple actions
 */
export const registerMultipleActions = (
  actions: IO[]
): {
  successful: number
  failed: number
  results: Array<{id: string; ok: boolean; message: string}>
} => {
  const results = actions.map(action => ({
    id: action.id,
    ...registerActionWithPipeline(action)
  }))

  const successful = results.filter(r => r.ok).length
  const failed = results.length - successful

  log.info(
    `Bulk action registration: ${successful} successful, ${failed} failed`
  )

  return {successful, failed, results}
}

/**
 * PIPELINE HEALTH CHECK
 * Validates all compiled pipelines and reports issues
 */
export const performPipelineHealthCheck = (): {
  healthy: boolean
  issues: string[]
  recommendations: string[]
  stats: {
    totalActions: number
    fastPathActions: number
    pipelineActions: number
    timekeeperActions: number
    cachedPipelines: number
  }
} => {
  const issues: string[] = []
  const recommendations: string[] = []

  // Get all actions from the system
  const allActions = io.getAll()
  const stats = {
    totalActions: allActions.length,
    fastPathActions: 0,
    pipelineActions: 0,
    timekeeperActions: 0,
    cachedPipelines: 0
  }

  try {
    // Check each action's pipeline
    for (const action of allActions) {
      try {
        const compiledPipeline = getCompiledPipeline(action)
        stats.cachedPipelines++

        if (compiledPipeline.isFastPath) {
          stats.fastPathActions++
        } else if (compiledPipeline.requiresTimekeeper) {
          stats.timekeeperActions++
        } else {
          stats.pipelineActions++
        }

        // Check for issues
        if (compiledPipeline.verification.errors.length > 0) {
          issues.push(
            `Action ${action.id}: ${compiledPipeline.verification.errors.join(
              ', '
            )}`
          )
        }

        if (compiledPipeline.performance.category === 'HEAVY') {
          issues.push(
            `Action ${
              action.id
            }: Heavy pipeline detected (${compiledPipeline.performance.expectedOverhead.toFixed(
              2
            )}ms overhead)`
          )
          recommendations.push(
            `Consider optimizing ${action.id} by reducing middleware or protections`
          )
        }

        if (compiledPipeline.performance.optimizationLevel < 50) {
          recommendations.push(
            `Action ${action.id}: Low optimization level (${compiledPipeline.performance.optimizationLevel}%)`
          )
        }
      } catch (error) {
        issues.push(
          `Action ${action.id}: Pipeline compilation failed - ${error}`
        )
      }
    }

    // Generate system-wide recommendations
    const timekeeperPercentage =
      stats.totalActions > 0
        ? (stats.timekeeperActions / stats.totalActions) * 100
        : 0
    const fastPathPercentage =
      stats.totalActions > 0
        ? (stats.fastPathActions / stats.totalActions) * 100
        : 0

    if (fastPathPercentage < 30) {
      recommendations.push(
        'Low fast-path usage - consider simplifying action configurations'
      )
    }

    if (timekeeperPercentage > 70) {
      recommendations.push(
        'High timekeeper usage - review timing configurations for optimization'
      )
    }

    const healthy = issues.length === 0

    log.info(
      `Pipeline health check: ${healthy ? 'HEALTHY' : 'ISSUES DETECTED'}`
    )
    if (!healthy) {
      log.warn(`Found ${issues.length} issues in pipeline compilation`)
    }

    log.info(
      `📊 Pipeline Distribution: ${stats.fastPathActions} fast-path, ${stats.timekeeperActions} timekeeper, ${stats.pipelineActions} pipeline`
    )

    return {healthy, issues, recommendations, stats}
  } catch (error) {
    issues.push(`Health check failed: ${error}`)
    return {healthy: false, issues, recommendations, stats}
  }
}

/**
 * MIGRATION HELPER
 * Helps migrate existing CYRE installations to use compiled pipelines
 */
export const migrateToCompiledPipelines = (): {
  migrated: number
  skipped: number
  failed: number
  report: string[]
} => {
  const report: string[] = []
  let migrated = 0
  let skipped = 0
  let failed = 0

  try {
    const allActions = io.getAll()
    report.push(
      `Starting migration of ${allActions.length} actions to compiled pipelines`
    )

    for (const action of allActions) {
      try {
        // Check if action already has compiled pipeline
        const existingPipeline = getCompiledPipeline(action)
        if (existingPipeline) {
          skipped++
          report.push(`Skipped ${action.id}: Already has compiled pipeline`)
          continue
        }

        // Compile new pipeline
        const result = registerActionWithPipeline(action)
        if (result.ok) {
          migrated++
          report.push(`Migrated ${action.id}: ${result.message}`)
        } else {
          failed++
          report.push(`Failed ${action.id}: ${result.message}`)
        }
      } catch (error) {
        failed++
        report.push(`Failed ${action.id}: ${error}`)
      }
    }

    report.push(
      `Migration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed`
    )
    log.info(
      `Pipeline migration complete: ${migrated}/${allActions.length} actions migrated`
    )
  } catch (error) {
    report.push(`Migration failed: ${error}`)
    log.error(`Pipeline migration failed: ${error}`)
  }

  return {migrated, skipped, failed, report}
}

/**
 * BACKWARD COMPATIBILITY LAYER
 * Ensures existing CYRE code continues to work
 */
export const createCompatibilityWrapper = () => {
  const originalIoSet = io.set
  const originalIoForget = io.forget

  // Wrap io.set to use pipeline compilation
  io.set = (action: IO) => {
    // Use the new pipeline registration
    const result = registerActionWithPipeline(action)
    if (!result.ok) {
      throw new Error(result.message)
    }
  }

  // Wrap io.forget to include pipeline cleanup
  io.forget = (actionId: string): boolean => {
    return removeActionWithCleanup(actionId)
  }

  // Return function to restore original behavior (for testing)
  return () => {
    io.set = originalIoSet
    io.forget = originalIoForget
  }
}

/**
 * DEVELOPMENT HELPERS
 */
export const developmentHelpers = {
  /**
   * Get pipeline info for debugging
   */
  getPipelineInfo: (actionId: string) => {
    const action = io.get(actionId)
    if (!action) return null

    try {
      const compiled = getCompiledPipeline(action)
      return {
        actionId,
        isFastPath: compiled.isFastPath,
        requiresTimekeeper: compiled.requiresTimekeeper,
        category: compiled.performance.category,
        expectedOverhead: compiled.performance.expectedOverhead,
        optimizationLevel: compiled.performance.optimizationLevel,
        flags: compiled.flags,
        warnings: compiled.verification.warnings,
        errors: compiled.verification.errors
      }
    } catch (error) {
      return {actionId, error: error.message}
    }
  },

  /**
   * Force recompile pipeline
   */
  recompilePipeline: (actionId: string) => {
    const action = io.get(actionId)
    if (!action) return {ok: false, message: 'Action not found'}

    return updateActionWithPipeline(action)
  },

  /**
   * Get all pipeline stats
   */
  getAllPipelineStats: () => {
    const {getPipelineCacheStats} = require('./pipeline-compiler')
    const {getExecutionStats} = require('./pipeline-executor')

    return {
      cache: getPipelineCacheStats(),
      execution: getExecutionStats(),
      health: performPipelineHealthCheck()
    }
  },

  /**
   * Debug action properties
   */
  debugAction: (actionId: string) => {
    const action = io.get(actionId)
    if (!action) return null

    debugActionProperties(action, 'DEBUG')
    return action
  }
}
