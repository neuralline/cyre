// src/context/pipeline-state.ts
// CYRE TODO #1: State management for compiled pipelines - NO OOP

import {createStore} from './create-store'
import type {CompiledPipeline} from '../pipeline/pipeline-compiler'
import type {StateKey} from '../types/interface'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E. - P.I.P.E.L.I.N.E. - S.T.A.T.E.
      
      Functional state management for compiled pipelines:
      - Store compiled pipelines alongside actions
      - Cache invalidation management  
      - Pipeline retrieval and updates
      - Statistics and monitoring

*/

// Create pipeline store using existing createStore pattern
const pipelineStore = createStore<CompiledPipeline>()

// Pipeline compilation statistics
interface PipelineStats {
  totalCompilations: number
  cacheHits: number
  cacheMisses: number
  fastPathChannels: number
  heavyChannels: number
  lastCompilationTime: number
}

let pipelineStats: PipelineStats = {
  totalCompilations: 0,
  cacheHits: 0,
  cacheMisses: 0,
  fastPathChannels: 0,
  heavyChannels: 0,
  lastCompilationTime: 0
}

/**
 * FUNCTIONAL PIPELINE STATE MANAGEMENT
 * All operations are pure functions that return new state
 */
export const pipelineState = {
  /**
   * Store compiled pipeline
   */
  set: (compiledPipeline: CompiledPipeline): void => {
    try {
      pipelineStore.set(compiledPipeline.channelId, compiledPipeline)

      // Update statistics
      pipelineStats = {
        ...pipelineStats,
        totalCompilations: pipelineStats.totalCompilations + 1,
        lastCompilationTime: Date.now(),
        fastPathChannels: compiledPipeline.isFastPath
          ? pipelineStats.fastPathChannels + 1
          : pipelineStats.fastPathChannels,
        heavyChannels:
          compiledPipeline.performance.category === 'HEAVY'
            ? pipelineStats.heavyChannels + 1
            : pipelineStats.heavyChannels
      }

      log.debug(
        `Pipeline stored for ${compiledPipeline.channelId} (${compiledPipeline.performance.category})`
      )
    } catch (error) {
      log.error(
        `Failed to store pipeline for ${compiledPipeline.channelId}: ${error}`
      )
    }
  },

  /**
   * Get compiled pipeline by channel ID
   */
  get: (channelId: StateKey): CompiledPipeline | undefined => {
    try {
      const pipeline = pipelineStore.get(channelId)

      if (pipeline) {
        // Update cache hit stats
        pipelineStats = {
          ...pipelineStats,
          cacheHits: pipelineStats.cacheHits + 1
        }
        log.debug(`Pipeline cache hit for ${channelId}`)
      } else {
        // Update cache miss stats
        pipelineStats = {
          ...pipelineStats,
          cacheMisses: pipelineStats.cacheMisses + 1
        }
        log.debug(`Pipeline cache miss for ${channelId}`)
      }

      return pipeline
    } catch (error) {
      log.error(`Failed to get pipeline for ${channelId}: ${error}`)
      return undefined
    }
  },

  /**
   * Check if pipeline exists and is valid
   */
  has: (channelId: StateKey, verificationHash?: string): boolean => {
    const pipeline = pipelineStore.get(channelId)

    if (!pipeline) return false

    // If verification hash provided, check if it matches
    if (verificationHash && pipeline.verificationHash !== verificationHash) {
      return false
    }

    return true
  },

  /**
   * Remove compiled pipeline
   */
  forget: (channelId: StateKey): boolean => {
    try {
      const existed = pipelineStore.forget(channelId)

      if (existed) {
        log.debug(`Pipeline removed for ${channelId}`)
      }

      return existed
    } catch (error) {
      log.error(`Failed to remove pipeline for ${channelId}: ${error}`)
      return false
    }
  },

  /**
   * Clear all pipelines
   */
  clear: (): void => {
    try {
      pipelineStore.clear()

      // Reset statistics
      pipelineStats = {
        totalCompilations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        fastPathChannels: 0,
        heavyChannels: 0,
        lastCompilationTime: 0
      }

      log.debug('All pipelines cleared')
    } catch (error) {
      log.error(`Failed to clear pipelines: ${error}`)
    }
  },

  /**
   * Get all compiled pipelines
   */
  getAll: (): CompiledPipeline[] => {
    return pipelineStore.getAll()
  },

  /**
   * Get pipeline statistics
   */
  getStats: (): PipelineStats & {
    cacheSize: number
    hitRate: number
    averageOverhead: number
  } => {
    const allPipelines = pipelineStore.getAll()
    const cacheSize = allPipelines.length
    const totalHitMiss = pipelineStats.cacheHits + pipelineStats.cacheMisses
    const hitRate =
      totalHitMiss > 0 ? (pipelineStats.cacheHits / totalHitMiss) * 100 : 0

    const averageOverhead =
      cacheSize > 0
        ? allPipelines.reduce(
            (sum, p) => sum + p.performance.expectedOverhead,
            0
          ) / cacheSize
        : 0

    return {
      ...pipelineStats,
      cacheSize,
      hitRate,
      averageOverhead
    }
  },

  /**
   * Invalidate pipelines by criteria
   */
  invalidate: (criteria?: {
    channelId?: StateKey
    olderThan?: number
    category?: 'FAST_PATH' | 'LIGHT' | 'NORMAL' | 'HEAVY'
  }): number => {
    let invalidated = 0

    try {
      if (!criteria) {
        // Invalidate all
        pipelineStore.clear()
        return pipelineStore.size()
      }

      if (criteria.channelId) {
        // Invalidate specific channel
        const removed = pipelineStore.forget(criteria.channelId)
        return removed ? 1 : 0
      }

      // Invalidate by criteria
      const allPipelines = pipelineStore.getAll()
      const now = Date.now()

      for (const pipeline of allPipelines) {
        let shouldInvalidate = false

        if (
          criteria.olderThan &&
          now - pipeline.compiledAt > criteria.olderThan
        ) {
          shouldInvalidate = true
        }

        if (
          criteria.category &&
          pipeline.performance.category === criteria.category
        ) {
          shouldInvalidate = true
        }

        if (shouldInvalidate) {
          pipelineStore.forget(pipeline.channelId)
          invalidated++
        }
      }

      if (invalidated > 0) {
        log.debug(`Invalidated ${invalidated} pipelines based on criteria`)
      }
    } catch (error) {
      log.error(`Pipeline invalidation failed: ${error}`)
    }

    return invalidated
  },

  /**
   * Health check for stored pipelines
   */
  healthCheck: (): {
    healthy: boolean
    issues: string[]
    recommendations: string[]
    summary: {
      totalPipelines: number
      fastPathCount: number
      heavyPipelineCount: number
      oldPipelineCount: number
    }
  } => {
    const issues: string[] = []
    const recommendations: string[] = []
    const allPipelines = pipelineStore.getAll()
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    let fastPathCount = 0
    let heavyPipelineCount = 0
    let oldPipelineCount = 0

    for (const pipeline of allPipelines) {
      // Count categories
      if (pipeline.isFastPath) fastPathCount++
      if (pipeline.performance.category === 'HEAVY') heavyPipelineCount++
      if (now - pipeline.compiledAt > oneHour) oldPipelineCount++

      // Check for issues
      if (pipeline.verification.errors.length > 0) {
        issues.push(
          `Pipeline ${pipeline.channelId}: ${pipeline.verification.errors.join(
            ', '
          )}`
        )
      }

      if (pipeline.performance.optimizationLevel < 50) {
        issues.push(
          `Pipeline ${pipeline.channelId}: Low optimization level (${pipeline.performance.optimizationLevel}%)`
        )
      }

      if (pipeline.performance.expectedOverhead > 10) {
        issues.push(
          `Pipeline ${
            pipeline.channelId
          }: High overhead (${pipeline.performance.expectedOverhead.toFixed(
            2
          )}ms)`
        )
      }
    }

    // Generate recommendations
    const fastPathPercentage =
      allPipelines.length > 0
        ? (fastPathCount / allPipelines.length) * 100
        : 100

    if (fastPathPercentage < 30) {
      recommendations.push(
        'Low fast-path usage detected - consider simplifying action configurations'
      )
    }

    if (heavyPipelineCount > allPipelines.length * 0.2) {
      recommendations.push(
        'Many heavy pipelines detected - review middleware and protection usage'
      )
    }

    if (oldPipelineCount > 0) {
      recommendations.push(
        `${oldPipelineCount} pipelines are over 1 hour old - consider invalidation`
      )
    }

    const healthy = issues.length === 0

    return {
      healthy,
      issues,
      recommendations,
      summary: {
        totalPipelines: allPipelines.length,
        fastPathCount,
        heavyPipelineCount,
        oldPipelineCount
      }
    }
  },

  /**
   * Debug utilities
   */
  debug: {
    /**
     * Get pipeline details for debugging
     */
    getPipelineDetails: (channelId: StateKey) => {
      const pipeline = pipelineStore.get(channelId)
      if (!pipeline) return null

      return {
        channelId: pipeline.channelId,
        isFastPath: pipeline.isFastPath,
        category: pipeline.performance.category,
        expectedOverhead: pipeline.performance.expectedOverhead,
        optimizationLevel: pipeline.performance.optimizationLevel,
        compiledAt: new Date(pipeline.compiledAt).toISOString(),
        flags: pipeline.flags,
        verification: {
          errors: pipeline.verification.errors,
          warnings: pipeline.verification.warnings,
          optimizations: pipeline.verification.optimizations
        },
        pipelineSteps: pipeline.pipeline.length
      }
    },

    /**
     * Export all pipelines for analysis
     */
    exportPipelines: () => {
      return pipelineStore.getAll().map(pipeline => ({
        channelId: pipeline.channelId,
        isFastPath: pipeline.isFastPath,
        category: pipeline.performance.category,
        expectedOverhead: pipeline.performance.expectedOverhead,
        optimizationLevel: pipeline.performance.optimizationLevel,
        compiledAt: pipeline.compiledAt,
        verificationHash: pipeline.verificationHash
      }))
    },

    /**
     * Generate performance report
     */
    generateReport: (): string => {
      const stats = pipelineState.getStats()
      const health = pipelineState.healthCheck()

      let report = `CYRE Pipeline State Report\n`
      report += `==========================\n\n`

      report += `Cache Statistics:\n`
      report += `- Total Compilations: ${stats.totalCompilations}\n`
      report += `- Cache Size: ${stats.cacheSize}\n`
      report += `- Cache Hit Rate: ${stats.hitRate.toFixed(1)}%\n`
      report += `- Average Overhead: ${stats.averageOverhead.toFixed(2)}ms\n\n`

      report += `Pipeline Distribution:\n`
      report += `- Fast Path: ${health.summary.fastPathCount} (${(
        (health.summary.fastPathCount / stats.cacheSize) *
        100
      ).toFixed(1)}%)\n`
      report += `- Heavy Pipelines: ${health.summary.heavyPipelineCount}\n`
      report += `- Old Pipelines: ${health.summary.oldPipelineCount}\n\n`

      if (health.issues.length > 0) {
        report += `Issues Found:\n`
        health.issues.forEach(issue => (report += `- ${issue}\n`))
        report += `\n`
      }

      if (health.recommendations.length > 0) {
        report += `Recommendations:\n`
        health.recommendations.forEach(rec => (report += `- ${rec}\n`))
      }

      return report
    }
  }
}

// Export the functional state interface
export type {CompiledPipeline, PipelineStats}
