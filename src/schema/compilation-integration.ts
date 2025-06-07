// src/schema/compilation-integration.ts
// Integration point for compilation with plugin architecture

import {
  registerValidationPlugin,
  compileAction,
  clearValidationCache
} from './data-definitions'
import {stateValidationPlugin} from './state-talents-plugin'
import {log} from '../components/cyre-log'
import type {IO} from '../types/core'

/*

      C.Y.R.E - C.O.M.P.I.L.A.T.I.O.N - I.N.T.E.G.R.A.T.I.O.N
      
      Functional compilation system management:
      - Plugin registration at startup
      - Cache management utilities  
      - Compilation result analysis
      - Performance monitoring

*/

interface CompilationStats {
  totalCompilations: number
  successfulCompilations: number
  failedCompilations: number
  blockedCompilations: number
  averageCompilationTime: number
  cacheHitRate: number
  fastPathActions: number
  complexActions: number
}

// Module state
let compilationStats: CompilationStats = {
  totalCompilations: 0,
  successfulCompilations: 0,
  failedCompilations: 0,
  blockedCompilations: 0,
  averageCompilationTime: 0,
  cacheHitRate: 0,
  fastPathActions: 0,
  complexActions: 0
}

let compilationTimes: number[] = []
const MAX_TIME_SAMPLES = 100
let isInitialized = false

/**
 * Initialize compilation system with plugins
 */
const initializeCompilationSystem = (): void => {
  if (isInitialized) return

  try {
    // Register core plugins
    registerValidationPlugin(stateValidationPlugin)

    isInitialized = true
    log.info('Compilation system initialized with plugins')
  } catch (error) {
    log.error('Failed to initialize compilation plugins:', error)
  }
}

/**
 * Record compilation time for performance tracking
 */
const recordCompilationTime = (timeMs: number): void => {
  compilationTimes.push(timeMs)

  // Keep only recent samples
  if (compilationTimes.length > MAX_TIME_SAMPLES) {
    compilationTimes = compilationTimes.slice(-MAX_TIME_SAMPLES)
  }

  // Update average
  compilationStats.averageCompilationTime =
    compilationTimes.reduce((sum, time) => sum + time, 0) /
    compilationTimes.length
}

/**
 * Update compilation statistics
 */
const updateCompilationStats = (
  success: boolean,
  blocked: boolean,
  hasFastPath: boolean,
  timeMs: number
): void => {
  compilationStats.totalCompilations++

  if (success) {
    compilationStats.successfulCompilations++
  } else {
    compilationStats.failedCompilations++
  }

  if (blocked) {
    compilationStats.blockedCompilations++
  }

  if (hasFastPath) {
    compilationStats.fastPathActions++
  } else {
    compilationStats.complexActions++
  }

  recordCompilationTime(timeMs)
}

/**
 * Compile action with performance tracking
 */
export const compileActionWithStats = (
  action: Partial<IO>
): {
  compiledAction: IO
  errors: string[]
  warnings: string[]
  hasFastPath: boolean
  compilationTime: number
  stats: CompilationStats
} => {
  // Ensure system is initialized
  initializeCompilationSystem()

  const startTime = performance.now()

  // Perform compilation
  const result = compileAction(action)

  const compilationTime = performance.now() - startTime
  const success = result.errors.length === 0
  const blocked = result.compiledAction._isBlocked || false

  // Update statistics
  updateCompilationStats(success, blocked, result.hasFastPath, compilationTime)

  return {
    ...result,
    compilationTime,
    stats: getCompilationStats()
  }
}

/**
 * Get current compilation statistics
 */
export const getCompilationStats = (): CompilationStats => ({
  ...compilationStats
})

/**
 * Reset compilation statistics
 */
export const resetCompilationStats = (): void => {
  compilationStats = {
    totalCompilations: 0,
    successfulCompilations: 0,
    failedCompilations: 0,
    blockedCompilations: 0,
    averageCompilationTime: 0,
    cacheHitRate: 0,
    fastPathActions: 0,
    complexActions: 0
  }
  compilationTimes = []
  log.info('Compilation statistics reset')
}

/**
 * Analyze compilation performance
 */
export const analyzeCompilationPerformance = (): {
  efficiency: 'excellent' | 'good' | 'poor'
  fastPathRatio: number
  averageTime: number
  recommendations: string[]
} => {
  const stats = getCompilationStats()
  const recommendations: string[] = []

  // Only count successful compilations for fast path ratio
  const successfulCompilations = stats.successfulCompilations
  const fastPathRatio =
    successfulCompilations > 0
      ? stats.fastPathActions / successfulCompilations
      : 0

  let efficiency: 'excellent' | 'good' | 'poor' = 'excellent'

  // Analyze fast path ratio (only among successful compilations)
  if (fastPathRatio < 0.3) {
    efficiency = 'poor'
    recommendations.push(
      'Consider simplifying action configurations to increase fast path usage'
    )
  } else if (fastPathRatio < 0.6) {
    efficiency = 'good'
    recommendations.push('Good balance of simple and complex actions')
  } else {
    recommendations.push(
      'Excellent fast path usage - most actions use optimized compilation'
    )
  }

  // Analyze compilation time
  if (stats.averageCompilationTime > 10) {
    efficiency = 'poor'
    recommendations.push(
      'High compilation times detected - consider caching strategies'
    )
  } else if (stats.averageCompilationTime > 5) {
    if (efficiency === 'excellent') efficiency = 'good'
    recommendations.push(
      'Moderate compilation times - monitor for complex validations'
    )
  } else {
    recommendations.push(
      'Fast compilation times - validation system performing well'
    )
  }

  // Analyze failure rate
  const failureRate =
    stats.totalCompilations > 0
      ? stats.failedCompilations / stats.totalCompilations
      : 0

  if (failureRate > 0.1) {
    efficiency = 'poor'
    recommendations.push(
      'High validation failure rate - review action configurations'
    )
  } else if (failureRate > 0.05) {
    if (efficiency === 'excellent') efficiency = 'good'
    recommendations.push(
      'Moderate validation failure rate - some actions need review'
    )
  }

  return {
    efficiency,
    fastPathRatio,
    averageTime: stats.averageCompilationTime,
    recommendations
  }
}

/**
 * Clear all caches and reset performance data
 */
export const clearCompilationCaches = (): void => {
  clearValidationCache()
  resetCompilationStats()
  log.info('All compilation caches cleared')
}

/**
 * Get performance recommendations
 */
export const getPerformanceRecommendations = (): string[] => {
  const analysis = analyzeCompilationPerformance()
  return analysis.recommendations
}
