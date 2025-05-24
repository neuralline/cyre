// src/context/metrics-report.ts
// Enhanced with detailed action pipeline timing and proper stage separation

import {createStore} from './create-store'
import type {ActionId, Priority, StateKey} from '../types/interface'
import {log} from '../components/cyre-log'
import {
  PERFORMANCE,
  MSG,
  getListenerThreshold,
  getPipelineThreshold,
  categorizeExecutionTime
} from '../config/cyre-config'
import {io} from './state'

/* 
      C.Y.R.E. - M.E.T.R.I.C.S. - R.E.P.O.R.T.
      
      Enhanced metrics tracking with detailed action pipeline timing
      Proper separation of pipeline overhead vs listener execution
*/

/**
 * Detailed execution timing breakdown
 */
export interface DetailedExecutionTiming {
  // Stage-by-stage breakdown
  stages: {
    actionPipeline: number // Time in throttle, debounce, middleware, etc.
    listenerExecution: number // Time in user's handler function
    metricsRecording: number // Time recording metrics/history
  }

  // Calculated totals
  totals: {
    pipelineOverhead: number // All Cyre overhead (excludes listener)
    totalExecution: number // Complete end-to-end time
  }

  // Performance ratios
  ratios: {
    overheadRatio: number // Pipeline overhead / total time
    efficiencyRatio: number // Listener time / total time
  }

  // Metadata
  timestamp: number
  category: 'FAST' | 'NORMAL' | 'SLOW' | 'VERY_SLOW' | 'CRITICAL'
}

// Enhanced action metrics with detailed timing
export interface ActionMetricsData {
  id: string
  calls: number
  executionCount: number
  debounces: number
  throttles: number
  repeats: number
  changeDetectionSkips: number

  // Enhanced timing data
  executionTimes: number[] // Total execution times
  pipelineOverheadTimes: number[] // Action pipeline overhead times
  listenerExecutionTimes: number[] // Pure listener execution times

  // Calculated averages
  totalExecutionTime: number
  avgExecutionTime: number
  minExecutionTime: number
  maxExecutionTime: number

  // Pipeline-specific metrics
  totalPipelineOverhead: number
  avgPipelineOverhead: number
  minPipelineOverhead: number
  maxPipelineOverhead: number

  // Listener-specific metrics
  totalListenerExecutionTime: number
  avgListenerExecutionTime: number
  minListenerExecutionTime: number
  maxListenerExecutionTime: number
  slowListenerCount: number

  // Performance ratios and analysis
  avgOverheadRatio: number
  avgEfficiencyRatio: number

  // Metadata
  lastCall: number
  lastExecution: number
  priority: Priority
  errorCount: number
  middlewareRejections: number

  // Performance categorization
  performanceCategory: 'FAST' | 'NORMAL' | 'SLOW' | 'VERY_SLOW' | 'CRITICAL'
  optimizationSuggestions: string[]
}

export interface GlobalMetricsData {
  totalActions: number
  totalCalls: number
  totalDebounces: number
  totalThrottles: number
  totalRepeats: number
  totalChangeDetectionSkips: number
  totalExecutions: number
  totalExecutionTime: number
  totalPipelineOverhead: number
  totalListenerTime: number
  totalErrors: number
  totalMiddlewareRejections: number
  startTime: number
  highestCallRate: number
  currentCallRate: number
  callRateTimestamp: number
  callsPerPriority: Record<Priority, number>

  // Performance efficiency metrics
  avgOverheadRatio: number
  avgEfficiencyRatio: number
  totalSlowListeners: number
  totalSlowPipelines: number
}

// Constants for metrics management
const MAX_EXECUTION_TIMES_HISTORY = 100
const RATE_CALCULATION_WINDOW = 10000 // 10 seconds for rate calculations

// Create the stores
const actionMetricsStore = createStore<ActionMetricsData>()
const globalMetricsStore = createStore<GlobalMetricsData>()

// Performance timer utility for precise measurements
export class PerformanceTimer {
  private startTime: number = 0
  private stageTimings: Map<string, number> = new Map()
  private lastStageTime: number = 0

  start(): void {
    this.startTime = performance.now()
    this.lastStageTime = this.startTime
  }

  markStage(stageName: string): number {
    const now = performance.now()
    const stageTime = now - this.lastStageTime
    this.stageTimings.set(stageName, stageTime)
    this.lastStageTime = now
    return stageTime
  }

  getTotalTime(): number {
    return performance.now() - this.startTime
  }

  getStageTime(stageName: string): number {
    return this.stageTimings.get(stageName) || 0
  }

  getAllStages(): Record<string, number> {
    return Object.fromEntries(this.stageTimings)
  }

  reset(): void {
    this.startTime = 0
    this.stageTimings.clear()
    this.lastStageTime = 0
  }

  /**
   * Create detailed timing breakdown from current measurements
   */
  createDetailedTiming(): DetailedExecutionTiming {
    const actionPipeline =
      this.getStageTime('throttle') +
      this.getStageTime('debounce') +
      this.getStageTime('changeDetection') +
      this.getStageTime('middleware') +
      this.getStageTime('dispatch')

    const listenerExecution = this.getStageTime('listener')
    const metricsRecording = this.getStageTime('metrics')
    const totalExecution = this.getTotalTime()
    const pipelineOverhead = actionPipeline + metricsRecording

    const overheadRatio =
      totalExecution > 0 ? pipelineOverhead / totalExecution : 0
    const efficiencyRatio =
      totalExecution > 0 ? listenerExecution / totalExecution : 0

    return {
      stages: {
        actionPipeline,
        listenerExecution,
        metricsRecording
      },
      totals: {
        pipelineOverhead,
        totalExecution
      },
      ratios: {
        overheadRatio,
        efficiencyRatio
      },
      timestamp: Date.now(),
      category: categorizeExecutionTime(totalExecution)
    }
  }
}

// Initialize a global metrics record
const initGlobalMetrics = (): GlobalMetricsData => ({
  totalActions: 0,
  totalCalls: 0,
  totalDebounces: 0,
  totalThrottles: 0,
  totalRepeats: 0,
  totalChangeDetectionSkips: 0,
  totalExecutions: 0,
  totalExecutionTime: 0,
  totalPipelineOverhead: 0,
  totalListenerTime: 0,
  totalErrors: 0,
  totalMiddlewareRejections: 0,
  startTime: Date.now(),
  highestCallRate: 0,
  currentCallRate: 0,
  callRateTimestamp: Date.now(),
  callsPerPriority: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    background: 0
  },
  avgOverheadRatio: 0,
  avgEfficiencyRatio: 0,
  totalSlowListeners: 0,
  totalSlowPipelines: 0
})

// Initialize an action metrics record
const initActionMetrics = (
  id: string,
  priority: Priority = 'medium'
): ActionMetricsData => ({
  id,
  calls: 0,
  executionCount: 0,
  debounces: 0,
  throttles: 0,
  repeats: 0,
  changeDetectionSkips: 0,
  executionTimes: [],
  pipelineOverheadTimes: [],
  listenerExecutionTimes: [],
  totalExecutionTime: 0,
  avgExecutionTime: 0,
  minExecutionTime: Infinity,
  maxExecutionTime: 0,
  totalPipelineOverhead: 0,
  avgPipelineOverhead: 0,
  minPipelineOverhead: Infinity,
  maxPipelineOverhead: 0,
  totalListenerExecutionTime: 0,
  avgListenerExecutionTime: 0,
  minListenerExecutionTime: Infinity,
  maxListenerExecutionTime: 0,
  slowListenerCount: 0,
  avgOverheadRatio: 0,
  avgEfficiencyRatio: 0,
  lastCall: 0,
  lastExecution: 0,
  priority,
  errorCount: 0,
  middlewareRejections: 0,
  performanceCategory: 'NORMAL',
  optimizationSuggestions: []
})

// Initialize the global metrics store
if (!globalMetricsStore.get('global')) {
  globalMetricsStore.set('global', initGlobalMetrics())
}

// Helper functions to get metrics
const getGlobalMetrics = (): GlobalMetricsData => {
  return globalMetricsStore.get('global') || initGlobalMetrics()
}

const getActionMetrics = (
  id: StateKey,
  priority?: Priority
): ActionMetricsData => {
  const existing = actionMetricsStore.get(id)
  if (existing) return existing

  // If not found, create a new record
  const newMetrics = initActionMetrics(id, priority)
  actionMetricsStore.set(id, newMetrics)

  // Update global action count
  const globalMetrics = getGlobalMetrics()
  globalMetricsStore.set('global', {
    ...globalMetrics,
    totalActions: globalMetrics.totalActions + 1
  })

  return newMetrics
}

// Calculate call rate
const calculateCallRate = (globalMetrics: GlobalMetricsData): number => {
  const now = Date.now()
  const timeWindow = Math.min(
    now - globalMetrics.callRateTimestamp,
    RATE_CALCULATION_WINDOW
  )

  if (timeWindow <= 0) return 0

  const callsPerSecond =
    (globalMetrics.totalCalls -
      globalMetrics.currentCallRate *
        (globalMetrics.callRateTimestamp / 1000)) /
    (timeWindow / 1000)

  return Math.max(0, callsPerSecond)
}

// Generate optimization suggestions
const generateOptimizationSuggestions = (
  metrics: ActionMetricsData
): string[] => {
  const suggestions: string[] = []

  // Check pipeline overhead
  if (metrics.avgOverheadRatio > PERFORMANCE.PIPELINE_EFFICIENCY.ACCEPTABLE) {
    suggestions.push(
      `High action pipeline overhead (${(
        metrics.avgOverheadRatio * 100
      ).toFixed(1)}% of total time)`
    )

    if (metrics.avgPipelineOverhead > getPipelineThreshold()) {
      suggestions.push(
        'Consider reducing middleware chain or simplifying action pipeline'
      )
    }
  }

  // Check listener performance
  const listenerThreshold = getListenerThreshold(metrics.priority)
  if (metrics.avgListenerExecutionTime > listenerThreshold) {
    suggestions.push(
      `Slow listener execution (avg: ${metrics.avgListenerExecutionTime.toFixed(
        2
      )}ms, threshold: ${listenerThreshold}ms)`
    )
    suggestions.push(
      'Consider optimizing business logic, using caching, or async patterns'
    )
  }

  // Check slow listener frequency
  if (metrics.slowListenerCount > metrics.executionCount * 0.2) {
    suggestions.push(
      'Frequent slow listener executions detected - review performance patterns'
    )
  }

  // Check efficiency ratio
  if (metrics.avgEfficiencyRatio < 0.5) {
    suggestions.push(
      'Low efficiency ratio - more time spent in pipeline than actual work'
    )
  }

  return suggestions
}

// Enhanced performance analysis
const analyzePerformance = (
  metrics: ActionMetricsData,
  timing: DetailedExecutionTiming
): void => {
  const {id, priority} = metrics
  const {stages, totals, ratios} = timing

  // Check action pipeline overhead
  if (totals.pipelineOverhead > getPipelineThreshold()) {
    // log.warn(
    //   `${
    //     MSG.HIGH_PIPELINE_OVERHEAD
    //   } for "${id}": ${totals.pipelineOverhead.toFixed(2)}ms ` +
    //     `(${(ratios.overheadRatio * 100).toFixed(1)}% of total time)`
    // )
  }

  // Check listener execution with priority-based thresholds
  const listenerThreshold = getListenerThreshold(priority)
  if (stages.listenerExecution > listenerThreshold) {
    // log.warn(
    //   `${MSG.SLOW_LISTENER_DETECTED} for "${id}" (${priority} priority): ` +
    //     `${stages.listenerExecution.toFixed(
    //       2
    //     )}ms (threshold: ${listenerThreshold}ms)`
    // )
  }

  // Check efficiency ratio
  if (ratios.overheadRatio > PERFORMANCE.PIPELINE_EFFICIENCY.ACCEPTABLE) {
    // log.warn(
    //   `${MSG.INEFFICIENT_PIPELINE_RATIO} for "${id}": ` +
    //     `${(ratios.overheadRatio * 100).toFixed(1)}% overhead, ` +
    //     `${(ratios.efficiencyRatio * 100).toFixed(1)}% actual work`
    // )
  }
}

// Export the metrics report manager
export const metricsReport = {
  // Track a call operation
  trackCall: (id: ActionId, priority: Priority = 'medium'): void => {
    const now = Date.now()

    // Update action metrics
    const actionMetrics = getActionMetrics(id, priority)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      calls: actionMetrics.calls + 1,
      lastCall: now,
      priority
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    const callRate = calculateCallRate(globalMetrics)

    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalCalls: globalMetrics.totalCalls + 1,
      currentCallRate: callRate,
      callRateTimestamp: now,
      highestCallRate: Math.max(globalMetrics.highestCallRate, callRate),
      callsPerPriority: {
        ...globalMetrics.callsPerPriority,
        [priority]: globalMetrics.callsPerPriority[priority] + 1
      }
    })
  },

  // Track detailed execution with proper stage separation
  trackDetailedExecution: (
    id: ActionId,
    timing: DetailedExecutionTiming
  ): void => {
    const actionMetrics = getActionMetrics(id)

    // Add timing data to arrays with history limits
    const newExecutionTimes = [
      ...actionMetrics.executionTimes,
      timing.totals.totalExecution
    ].slice(-MAX_EXECUTION_TIMES_HISTORY)
    const newPipelineOverheadTimes = [
      ...actionMetrics.pipelineOverheadTimes,
      timing.totals.pipelineOverhead
    ].slice(-MAX_EXECUTION_TIMES_HISTORY)
    const newListenerTimes = [
      ...actionMetrics.listenerExecutionTimes,
      timing.stages.listenerExecution
    ].slice(-MAX_EXECUTION_TIMES_HISTORY)

    // Calculate new statistics
    const totalExecTime =
      actionMetrics.totalExecutionTime + timing.totals.totalExecution
    const totalPipelineTime =
      actionMetrics.totalPipelineOverhead + timing.totals.pipelineOverhead
    const totalListenerTime =
      actionMetrics.totalListenerExecutionTime + timing.stages.listenerExecution
    const execCount = newExecutionTimes.length

    // Check for slow execution
    const listenerThreshold = getListenerThreshold(actionMetrics.priority)
    const isSlowListener = timing.stages.listenerExecution > listenerThreshold
    const isSlowPipeline =
      timing.totals.pipelineOverhead > getPipelineThreshold()

    // Update action metrics
    const updatedMetrics: ActionMetricsData = {
      ...actionMetrics,
      executionCount: actionMetrics.executionCount + 1,
      executionTimes: newExecutionTimes,
      pipelineOverheadTimes: newPipelineOverheadTimes,
      listenerExecutionTimes: newListenerTimes,

      // Total execution metrics
      totalExecutionTime: totalExecTime,
      avgExecutionTime: totalExecTime / execCount,
      minExecutionTime: Math.min(
        actionMetrics.minExecutionTime === Infinity
          ? timing.totals.totalExecution
          : actionMetrics.minExecutionTime,
        timing.totals.totalExecution
      ),
      maxExecutionTime: Math.max(
        actionMetrics.maxExecutionTime,
        timing.totals.totalExecution
      ),

      // Pipeline overhead metrics
      totalPipelineOverhead: totalPipelineTime,
      avgPipelineOverhead: totalPipelineTime / execCount,
      minPipelineOverhead: Math.min(
        actionMetrics.minPipelineOverhead === Infinity
          ? timing.totals.pipelineOverhead
          : actionMetrics.minPipelineOverhead,
        timing.totals.pipelineOverhead
      ),
      maxPipelineOverhead: Math.max(
        actionMetrics.maxPipelineOverhead,
        timing.totals.pipelineOverhead
      ),

      // Listener execution metrics
      totalListenerExecutionTime: totalListenerTime,
      avgListenerExecutionTime: totalListenerTime / execCount,
      minListenerExecutionTime: Math.min(
        actionMetrics.minListenerExecutionTime === Infinity
          ? timing.stages.listenerExecution
          : actionMetrics.minListenerExecutionTime,
        timing.stages.listenerExecution
      ),
      maxListenerExecutionTime: Math.max(
        actionMetrics.maxListenerExecutionTime,
        timing.stages.listenerExecution
      ),
      slowListenerCount:
        actionMetrics.slowListenerCount + (isSlowListener ? 1 : 0),

      // Performance ratios
      avgOverheadRatio:
        (actionMetrics.avgOverheadRatio * (execCount - 1) +
          timing.ratios.overheadRatio) /
        execCount,
      avgEfficiencyRatio:
        (actionMetrics.avgEfficiencyRatio * (execCount - 1) +
          timing.ratios.efficiencyRatio) /
        execCount,

      lastExecution: Date.now(),
      performanceCategory: timing.category,
      optimizationSuggestions: generateOptimizationSuggestions({
        ...actionMetrics,
        avgOverheadRatio: timing.ratios.overheadRatio,
        avgListenerExecutionTime: timing.stages.listenerExecution
      })
    }

    actionMetricsStore.set(id, updatedMetrics)

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    const totalGlobalExecs = globalMetrics.totalExecutions + 1

    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalExecutions: totalGlobalExecs,
      totalExecutionTime:
        globalMetrics.totalExecutionTime + timing.totals.totalExecution,
      totalPipelineOverhead:
        globalMetrics.totalPipelineOverhead + timing.totals.pipelineOverhead,
      totalListenerTime:
        globalMetrics.totalListenerTime + timing.stages.listenerExecution,
      avgOverheadRatio:
        (globalMetrics.avgOverheadRatio * (totalGlobalExecs - 1) +
          timing.ratios.overheadRatio) /
        totalGlobalExecs,
      avgEfficiencyRatio:
        (globalMetrics.avgEfficiencyRatio * (totalGlobalExecs - 1) +
          timing.ratios.efficiencyRatio) /
        totalGlobalExecs,
      totalSlowListeners:
        globalMetrics.totalSlowListeners + (isSlowListener ? 1 : 0),
      totalSlowPipelines:
        globalMetrics.totalSlowPipelines + (isSlowPipeline ? 1 : 0)
    })

    // Analyze performance and provide warnings
    analyzePerformance(updatedMetrics, timing)
  },

  // Legacy method for backwards compatibility - now uses detailed tracking
  trackExecution: (id: ActionId, executionTime: number): void => {
    // Create a simple timing object for backwards compatibility
    const timing: DetailedExecutionTiming = {
      stages: {
        actionPipeline: 0, // Unknown in legacy call
        listenerExecution: executionTime,
        metricsRecording: 0
      },
      totals: {
        pipelineOverhead: 0,
        totalExecution: executionTime
      },
      ratios: {
        overheadRatio: 0,
        efficiencyRatio: 1
      },
      timestamp: Date.now(),
      category: categorizeExecutionTime(executionTime)
    }

    metricsReport.trackDetailedExecution(id, timing)
  },

  // Legacy method - now part of detailed tracking
  trackListenerExecution: (id: ActionId, executionTime: number): void => {
    // This is now handled by trackDetailedExecution
    // Keeping for backwards compatibility but logging a deprecation warning
    if (PERFORMANCE.MONITORING.WARNING_ENABLED) {
      log.warn(
        `trackListenerExecution is deprecated - use trackDetailedExecution instead for action "${id}"`
      )
    }
  },

  trackDebounce: (id: ActionId): void => {
    const actionMetrics = actionMetricsStore.get(id) || initActionMetrics(id)
    actionMetrics.debounces++
    actionMetricsStore.set(id, actionMetrics)

    const globalMetrics = getGlobalMetrics()
    globalMetrics.totalDebounces++
    globalMetricsStore.set('global', globalMetrics)
  },

  trackThrottle: (id: ActionId): void => {
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      throttles: actionMetrics.throttles + 1
    })

    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalThrottles: globalMetrics.totalThrottles + 1
    })
  },

  trackRepeat: (id: ActionId): void => {
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      repeats: actionMetrics.repeats + 1
    })

    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalRepeats: globalMetrics.totalRepeats + 1
    })
  },

  trackChangeDetectionSkip: (id: ActionId): void => {
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      changeDetectionSkips: actionMetrics.changeDetectionSkips + 1
    })

    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalChangeDetectionSkips: globalMetrics.totalChangeDetectionSkips + 1
    })
  },

  trackMiddlewareRejection: (id: ActionId): void => {
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      middlewareRejections: actionMetrics.middlewareRejections + 1
    })

    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalMiddlewareRejections: globalMetrics.totalMiddlewareRejections + 1
    })
  },

  trackError: (id: ActionId): void => {
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      errorCount: actionMetrics.errorCount + 1
    })

    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalErrors: globalMetrics.totalErrors + 1
    })
  },

  // Get detailed metrics for a specific action
  getActionMetrics: (id: StateKey): ActionMetricsData | undefined => {
    return actionMetricsStore.get(id)
  },

  // Get detailed metrics for all actions
  getAllActionMetrics: (): ActionMetricsData[] => {
    return actionMetricsStore.getAll()
  },

  // Get global metrics
  getGlobalMetrics: (): GlobalMetricsData => {
    return getGlobalMetrics()
  },

  // Get call rate statistics
  getCallRateStats: () => {
    const globalMetrics = getGlobalMetrics()
    const now = Date.now()
    const currentRate = calculateCallRate(globalMetrics)
    const uptime = (now - globalMetrics.startTime) / 1000

    return {
      currentRate,
      highestRate: globalMetrics.highestCallRate,
      averageRate: uptime > 0 ? globalMetrics.totalCalls / uptime : 0,
      recentRateChange: currentRate - globalMetrics.currentCallRate
    }
  },

  // Get percentile execution time for an action
  getExecutionTimePercentile: (
    id: StateKey,
    percentile: number
  ): number | undefined => {
    const actionMetrics = actionMetricsStore.get(id)
    if (!actionMetrics || actionMetrics.executionTimes.length === 0)
      return undefined

    const sortedTimes = [...actionMetrics.executionTimes].sort((a, b) => a - b)
    const index = Math.floor(sortedTimes.length * (percentile / 100))
    return sortedTimes[Math.min(index, sortedTimes.length - 1)]
  },

  // Get pipeline overhead percentile
  getPipelineOverheadPercentile: (
    id: StateKey,
    percentile: number
  ): number | undefined => {
    const actionMetrics = actionMetricsStore.get(id)
    if (!actionMetrics || actionMetrics.pipelineOverheadTimes.length === 0)
      return undefined

    const sortedTimes = [...actionMetrics.pipelineOverheadTimes].sort(
      (a, b) => a - b
    )
    const index = Math.floor(sortedTimes.length * (percentile / 100))
    return sortedTimes[Math.min(index, sortedTimes.length - 1)]
  },

  // Get listener execution percentile
  getListenerExecutionTimePercentile: (
    id: StateKey,
    percentile: number
  ): number | undefined => {
    const actionMetrics = actionMetricsStore.get(id)
    if (!actionMetrics || actionMetrics.listenerExecutionTimes.length === 0)
      return undefined

    const sortedTimes = [...actionMetrics.listenerExecutionTimes].sort(
      (a, b) => a - b
    )
    const index = Math.floor(sortedTimes.length * (percentile / 100))
    return sortedTimes[Math.min(index, sortedTimes.length - 1)]
  },

  // Enhanced report generation with detailed timing breakdown
  generateReport: (
    filterPredicate?: (metrics: ActionMetricsData) => boolean
  ): string => {
    const globalMetrics = getGlobalMetrics()
    let allActionMetrics = actionMetricsStore.getAll().filter(
      metrics =>
        !metrics.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}/) && // Filter UUID format
        !metrics.id.includes('-debounce-') &&
        !metrics.id.endsWith('-timer') &&
        metrics.calls > 0
    )

    if (filterPredicate) {
      allActionMetrics = allActionMetrics.filter(filterPredicate)
    }

    allActionMetrics = allActionMetrics.sort((a, b) => b.calls - a.calls)

    const uptime = Math.floor((Date.now() - globalMetrics.startTime) / 1000)
    const uptimeFormatted = (() => {
      const seconds = uptime % 60
      const minutes = Math.floor(uptime / 60) % 60
      const hours = Math.floor(uptime / 3600) % 24
      const days = Math.floor(uptime / 86400)
      return `${days}d ${hours}h ${minutes}m ${seconds}s`
    })()

    const avgExecTime =
      globalMetrics.totalExecutions > 0
        ? (
            globalMetrics.totalExecutionTime / globalMetrics.totalExecutions
          ).toFixed(2)
        : '0.00'
    const avgPipelineOverhead =
      globalMetrics.totalExecutions > 0
        ? (
            globalMetrics.totalPipelineOverhead / globalMetrics.totalExecutions
          ).toFixed(2)
        : '0.00'
    const avgListenerTime =
      globalMetrics.totalExecutions > 0
        ? (
            globalMetrics.totalListenerTime / globalMetrics.totalExecutions
          ).toFixed(2)
        : '0.00'

    let report = `CYRE Enhanced Metrics Report\n`
    report += `================================\n\n`
    report += `System Uptime: ${uptimeFormatted}\n`
    report += `Total Actions: ${allActionMetrics.length}\n\n`

    report += `Activity Summary:\n`
    report += `----------------\n`
    report += `Total Calls: ${globalMetrics.totalCalls}\n`
    report += `Total Executions: ${globalMetrics.totalExecutions}\n`
    report += `Total Debounces: ${globalMetrics.totalDebounces}\n`
    report += `Total Throttles: ${globalMetrics.totalThrottles}\n`
    report += `Total Repeats: ${globalMetrics.totalRepeats}\n`
    report += `Total Change Detection Skips: ${globalMetrics.totalChangeDetectionSkips}\n`
    report += `Total Middleware Rejections: ${globalMetrics.totalMiddlewareRejections}\n`
    report += `Total Errors: ${globalMetrics.totalErrors}\n\n`

    report += `Performance Metrics (Enhanced):\n`
    report += `------------------------------\n`
    report += `Avg Total Execution Time: ${avgExecTime}ms\n`
    report += `Avg Action Pipeline Overhead: ${avgPipelineOverhead}ms\n`
    report += `Avg Listener Execution Time: ${avgListenerTime}ms\n`
    report += `Avg Pipeline Efficiency: ${(
      globalMetrics.avgEfficiencyRatio * 100
    ).toFixed(1)}%\n`
    report += `Avg Overhead Ratio: ${(
      globalMetrics.avgOverheadRatio * 100
    ).toFixed(1)}%\n`
    report += `Slow Listeners: ${globalMetrics.totalSlowListeners}\n`
    report += `Slow Pipelines: ${globalMetrics.totalSlowPipelines}\n`
    report += `Current Call Rate: ${globalMetrics.currentCallRate.toFixed(
      2
    )} calls/sec\n`
    report += `Highest Call Rate: ${globalMetrics.highestCallRate.toFixed(
      2
    )} calls/sec\n\n`

    report += `Priority Breakdown:\n`
    report += `------------------\n`
    const priorities: Priority[] = [
      'critical',
      'high',
      'medium',
      'low',
      'background'
    ]
    priorities.forEach(priority => {
      const count = globalMetrics.callsPerPriority[priority]
      const percentage =
        globalMetrics.totalCalls > 0
          ? ((count * 100) / globalMetrics.totalCalls).toFixed(1)
          : '0.0'
      report += `${priority}: ${count} calls (${percentage}%)\n`
    })

    report += `\nTop Actions by Call Count:\n`
    report += `-------------------------\n`

    const topN = Math.min(allActionMetrics.length, 15)
    for (let i = 0; i < topN; i++) {
      const metrics = allActionMetrics[i]
      report += `\n${i + 1}. ${metrics.id} (${metrics.priority}) [${
        metrics.performanceCategory
      }]\n`
      report += `   Calls: ${metrics.calls}\n`

      if (metrics.executionTimes.length > 0) {
        report += `   Total Execution: ${metrics.avgExecutionTime.toFixed(
          2
        )}ms avg (${metrics.minExecutionTime.toFixed(
          2
        )}-${metrics.maxExecutionTime.toFixed(2)}ms)\n`
        report += `   Pipeline Overhead: ${metrics.avgPipelineOverhead.toFixed(
          2
        )}ms avg (${(metrics.avgOverheadRatio * 100).toFixed(1)}%)\n`
        report += `   Listener Time: ${metrics.avgListenerExecutionTime.toFixed(
          2
        )}ms avg (${(metrics.avgEfficiencyRatio * 100).toFixed(1)}%)\n`

        if (metrics.executionTimes.length >= 10) {
          const p95 = metricsReport.getExecutionTimePercentile(metrics.id, 95)
          if (p95 !== undefined) {
            report += `   95th Percentile: ${p95.toFixed(2)}ms\n`
          }
        }
      }

      const throttleRate =
        metrics.calls > 0
          ? ((metrics.throttles * 100) / metrics.calls).toFixed(1)
          : '0.0'
      const debounceRate =
        metrics.calls > 0
          ? ((metrics.debounces * 100) / metrics.calls).toFixed(1)
          : '0.0'
      report += `   Throttles: ${metrics.throttles} (${throttleRate}%)\n`
      report += `   Debounces: ${metrics.debounces} (${debounceRate}%)\n`

      if (metrics.changeDetectionSkips > 0) {
        const skipRate = (
          (metrics.changeDetectionSkips * 100) /
          metrics.calls
        ).toFixed(1)
        report += `   Change Skips: ${metrics.changeDetectionSkips} (${skipRate}%)\n`
      }

      if (metrics.slowListenerCount > 0) {
        report += `   Slow Executions: ${metrics.slowListenerCount}\n`
      }

      if (metrics.errorCount > 0) {
        report += `   Errors: ${metrics.errorCount}\n`
      }

      if (metrics.optimizationSuggestions.length > 0) {
        report += `   Optimization Suggestions:\n`
        metrics.optimizationSuggestions.forEach(suggestion => {
          report += `     • ${suggestion}\n`
        })
      }
    }

    if (allActionMetrics.length > topN) {
      report += `\n...and ${allActionMetrics.length - topN} more actions\n`
    }

    return report
  },

  // Log metrics report
  logReport: (
    filterPredicate?: (metrics: ActionMetricsData) => boolean
  ): void => {
    log.info(metricsReport.generateReport(filterPredicate))
  },

  // Enhanced insights with action pipeline analysis
  getInsights: (): string[] => {
    const insights: string[] = []
    const globalMetrics = getGlobalMetrics()
    const allActionMetrics = actionMetricsStore
      .getAll()
      .filter(m => m.calls > 0)

    // Pipeline efficiency insights
    if (
      globalMetrics.avgOverheadRatio >
      PERFORMANCE.PIPELINE_EFFICIENCY.ACCEPTABLE
    ) {
      insights.push(
        `High action pipeline overhead globally (${(
          globalMetrics.avgOverheadRatio * 100
        ).toFixed(
          1
        )}%). Consider optimizing middleware chains and protection mechanisms.`
      )
    }

    // Slow pipeline actions
    const slowPipelineActions = allActionMetrics.filter(
      m => m.avgPipelineOverhead > getPipelineThreshold()
    )
    if (slowPipelineActions.length > 0) {
      insights.push(
        `${
          slowPipelineActions.length
        } actions have slow action pipelines (>${getPipelineThreshold()}ms overhead).`
      )
    }

    // Inefficient actions (low efficiency ratio)
    const inefficientActions = allActionMetrics.filter(
      m => m.avgEfficiencyRatio < 0.5
    )
    if (inefficientActions.length > 0) {
      insights.push(
        `${inefficientActions.length} actions spend more time in pipeline than actual work.`
      )
    }

    // Frequently throttled actions
    const highThrottleActions = allActionMetrics.filter(
      m => m.calls > 5 && m.throttles / m.calls > 0.3
    )
    if (highThrottleActions.length > 0) {
      insights.push(
        `${highThrottleActions.length} actions have high throttle rates (>30%). Consider increasing throttle intervals.`
      )
    }

    // High debounce actions
    const highDebounceActions = allActionMetrics.filter(
      m => m.calls > 5 && m.debounces / m.calls > 0.7
    )
    if (highDebounceActions.length > 0) {
      insights.push(
        `${highDebounceActions.length} actions have high debounce rates (>70%). Review call patterns.`
      )
    }

    // Error rate insights
    const highErrorActions = allActionMetrics.filter(
      m => m.calls > 5 && m.errorCount / m.calls > 0.1
    )
    if (highErrorActions.length > 0) {
      insights.push(
        `${highErrorActions.length} actions have error rates >10%. Review error handling.`
      )
    }

    // Performance category insights
    const criticalActions = allActionMetrics.filter(
      m => m.performanceCategory === 'CRITICAL'
    )
    if (criticalActions.length > 0) {
      insights.push(
        `${criticalActions.length} actions have CRITICAL performance issues requiring immediate attention.`
      )
    }

    return insights
  },

  // Create a performance timer instance
  createTimer: (): PerformanceTimer => {
    return new PerformanceTimer()
  },

  // Reset all metrics
  reset: (): void => {
    actionMetricsStore.clear()
    globalMetricsStore.set('global', initGlobalMetrics())
  },

  // Reset metrics for a specific action
  resetAction: (id: StateKey): void => {
    const actionMetrics = actionMetricsStore.get(id)
    if (actionMetrics) {
      actionMetricsStore.set(id, initActionMetrics(id, actionMetrics.priority))
    }
  }
}

// Export the initialization function if needed elsewhere
export const initMetricsReport = (): void => {
  metricsReport.reset()
}
