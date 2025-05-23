// src/context/metrics-report.ts

import {createStore} from './create-store'
import type {ActionId, Priority, StateKey} from '../types/interface'
import {log} from '../components/cyre-log'
import {metricsState} from './metrics-state'

/* 
      C.Y.R.E. - M.E.T.R.I.C.S. - R.E.P.O.R.T.
      
      Enhanced metrics tracking for diagnostics and analysis
      Hybrid approach that integrates with metrics-state
*/

// Types for tracking metrics report
export interface ActionMetricsData {
  id: string
  calls: number
  executionCount: number // Add this missing property
  debounces: number
  throttles: number
  repeats: number
  changeDetectionSkips: number
  executionTimes: number[]
  totalExecutionTime: number
  avgExecutionTime: number
  minExecutionTime: number
  maxExecutionTime: number
  lastCall: number
  lastExecution: number
  priority: Priority
  errorCount: number
  middlewareRejections: number
  // Listener execution time tracking
  listenerExecutionTimes: number[]
  totalListenerExecutionTime: number
  avgListenerExecutionTime: number
  minListenerExecutionTime: number
  maxListenerExecutionTime: number
  slowListenerCount: number
  // Performance ratio analysis
  pipelineOverheadRatio: number
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
  totalErrors: number
  totalMiddlewareRejections: number
  startTime: number
  highestCallRate: number
  currentCallRate: number
  callRateTimestamp: number
  callsPerPriority: Record<Priority, number>
  // Listener metrics
  totalListenerExecutions: number
  totalListenerExecutionTime: number
  totalSlowListeners: number
  avgListenerExecutionTime: number
}

// Constants for metrics management
const MAX_EXECUTION_TIMES_HISTORY = 100
const RATE_CALCULATION_WINDOW = 10000 // 10 seconds for rate calculations
const SLOW_LISTENER_THRESHOLD = 20 // ms, threshold for marking a listener as slow

// Create the stores
const actionMetricsStore = createStore<ActionMetricsData>()
const globalMetricsStore = createStore<GlobalMetricsData>()

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
  // Initialize listener metrics
  totalListenerExecutions: 0,
  totalListenerExecutionTime: 0,
  totalSlowListeners: 0,
  avgListenerExecutionTime: 0
})

// Initialize an action metrics record
const initActionMetrics = (
  id: string,
  priority: Priority = 'medium'
): ActionMetricsData => ({
  id,
  calls: 0,
  executionCount: 0, // Initialize executionCount
  debounces: 0,
  throttles: 0,
  repeats: 0,
  changeDetectionSkips: 0,
  executionTimes: [],
  totalExecutionTime: 0,
  avgExecutionTime: 0,
  minExecutionTime: Infinity,
  maxExecutionTime: 0,
  lastCall: 0,
  lastExecution: 0,
  priority,
  errorCount: 0,
  middlewareRejections: 0,
  // Initialize listener metrics
  listenerExecutionTimes: [],
  totalListenerExecutionTime: 0,
  avgListenerExecutionTime: 0,
  minListenerExecutionTime: Infinity,
  maxListenerExecutionTime: 0,
  slowListenerCount: 0,
  pipelineOverheadRatio: 0
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
  // Use a fixed time window for more stable rate calculation
  const timeWindow = Math.min(
    now - globalMetrics.callRateTimestamp,
    RATE_CALCULATION_WINDOW
  )

  // Avoid division by zero
  if (timeWindow <= 0) return 0

  const callsPerSecond =
    (globalMetrics.totalCalls -
      globalMetrics.currentCallRate *
        (globalMetrics.callRateTimestamp / 1000)) /
    (timeWindow / 1000)

  return Math.max(0, callsPerSecond)
}

// Sort metrics by array for presentation
const sortActionMetrics = (
  metrics: ActionMetricsData[]
): ActionMetricsData[] => {
  return [...metrics].sort((a, b) => {
    // Primary sort by call count (desc)
    if (b.calls !== a.calls) return b.calls - a.calls

    // Secondary sort by execution time (desc)
    return b.avgExecutionTime - a.avgExecutionTime
  })
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
      priority // Update priority in case it changed
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

    // Log high call rates for potential issues
    if (callRate > 100) {
      // Arbitrary threshold - adjust based on your needs
      // log.debug(`High call rate detected: ${callRate.toFixed(2)} calls/second`)
    }
  },

  trackDebounce: (id: ActionId): void => {
    // Use local variables to minimize object lookups and writes
    const actionMetrics = actionMetricsStore.get(id) || initActionMetrics(id)

    // Just increment the debounces counter
    actionMetrics.debounces++

    // Only update the store if we created a new record or changed values
    actionMetricsStore.set(id, actionMetrics)

    // Update global metrics with minimal writes - use local variables
    const globalMetrics = getGlobalMetrics()
    globalMetrics.totalDebounces++

    // Batch updates to reduce store writes
    globalMetricsStore.set('global', globalMetrics)
  },

  // Track a throttle operation
  trackThrottle: (id: ActionId): void => {
    // Update action metrics
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      throttles: actionMetrics.throttles + 1
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalThrottles: globalMetrics.totalThrottles + 1
    })
  },

  // Track a repeat operation
  trackRepeat: (id: ActionId): void => {
    // Update action metrics
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      repeats: actionMetrics.repeats + 1
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalRepeats: globalMetrics.totalRepeats + 1
    })
  },

  // Track change detection skips
  trackChangeDetectionSkip: (id: ActionId): void => {
    // Update action metrics
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      changeDetectionSkips: actionMetrics.changeDetectionSkips + 1
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalChangeDetectionSkips: globalMetrics.totalChangeDetectionSkips + 1
    })
  },

  // Track middleware rejections
  trackMiddlewareRejection: (id: ActionId): void => {
    // Update action metrics
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      middlewareRejections: actionMetrics.middlewareRejections + 1
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalMiddlewareRejections: globalMetrics.totalMiddlewareRejections + 1
    })
  },

  // Track errors
  trackError: (id: ActionId): void => {
    // Update action metrics
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      errorCount: actionMetrics.errorCount + 1
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalErrors: globalMetrics.totalErrors + 1
    })
  },

  // Track execution time and success
  // Optimize trackExecution to better handle pipeline overhead calculation
  trackExecution: (id: ActionId, executionTime: number): void => {
    const now = Date.now()

    // Get action metrics with minimal lookups
    const actionMetrics = getActionMetrics(id)

    // Update execution times with minimal array operations
    const newExecutionTimes = actionMetrics.executionTimes
    if (newExecutionTimes.length >= MAX_EXECUTION_TIMES_HISTORY) {
      newExecutionTimes.shift()
    }
    newExecutionTimes.push(executionTime)

    // Update totals with minimal calculations
    const newTotal = actionMetrics.totalExecutionTime + executionTime
    const executionCount = newExecutionTimes.length

    // FIXED: Calculate pipeline overhead ratio more accurately
    let pipelineOverheadRatio = 0

    // Only calculate overhead if we have both execution and listener times
    if (actionMetrics.listenerExecutionTimes.length > 0 && executionTime > 0) {
      // Get the most recent listener execution time
      const recentListenerTimes =
        actionMetrics.listenerExecutionTimes.slice(-10) // Last 10
      const avgRecentListenerTime =
        recentListenerTimes.reduce((sum, time) => sum + time, 0) /
        recentListenerTimes.length

      if (avgRecentListenerTime > 0) {
        // Pipeline overhead = (Total - Listener) / Total
        const overhead = Math.max(0, executionTime - avgRecentListenerTime)
        pipelineOverheadRatio = overhead / executionTime

        // Ensure ratio is between 0 and 1
        pipelineOverheadRatio = Math.min(Math.max(pipelineOverheadRatio, 0), 1)
      }
    }

    // Batch updates to action metrics - increment executionCount
    actionMetricsStore.set(id, {
      ...actionMetrics,
      executionCount: actionMetrics.executionCount + 1,
      executionTimes: newExecutionTimes,
      totalExecutionTime: newTotal,
      avgExecutionTime: newTotal / executionCount,
      minExecutionTime: Math.min(
        actionMetrics.minExecutionTime === Infinity
          ? executionTime
          : actionMetrics.minExecutionTime,
        executionTime
      ),
      maxExecutionTime: Math.max(actionMetrics.maxExecution, executionTime),
      lastExecution: now,
      pipelineOverheadRatio
    })

    // Optimize global metrics updates
    const globalMetrics = getGlobalMetrics()
    globalMetrics.totalExecutions++
    globalMetrics.totalExecutionTime += executionTime
    globalMetricsStore.set('global', globalMetrics)

    // Only update breathing metrics for significant executions
    if (executionTime > 100) {
      try {
        const {system} = metricsState.get()
        // Reduce frequency of breathing updates
        if (Math.random() < 0.25) {
          // Sample only 25% of events
          metricsState.updateBreath({
            ...system,
            eventLoop: Math.max(system.eventLoop, executionTime / 10)
          })
        }
      } catch (error) {
        // Silently ignore errors in breathing updates
      }
    }
  },

  // FIXED: Track listener execution time with better precision
  trackListenerExecution: (id: ActionId, executionTime: number): void => {
    // Validate input
    if (typeof executionTime !== 'number' || executionTime < 0) {
      console.warn(
        `Invalid listener execution time for ${id}: ${executionTime}`
      )
      return
    }

    // Get existing metrics
    const actionMetrics = getActionMetrics(id)

    // Add the execution time to history
    const newExecutionTimes = [
      ...actionMetrics.listenerExecutionTimes,
      executionTime
    ].slice(-MAX_EXECUTION_TIMES_HISTORY)

    // Calculate new metrics
    const totalTime = actionMetrics.totalListenerExecutionTime + executionTime
    const executionCount = newExecutionTimes.length
    const avgTime = totalTime / executionCount

    // Check if this is a slow listener
    const isSlowExecution = executionTime > SLOW_LISTENER_THRESHOLD

    // Update action metrics
    actionMetricsStore.set(id, {
      ...actionMetrics,
      listenerExecutionTimes: newExecutionTimes,
      totalListenerExecutionTime: totalTime,
      avgListenerExecutionTime: avgTime,
      minListenerExecutionTime: Math.min(
        actionMetrics.minListenerExecutionTime === Infinity
          ? executionTime
          : actionMetrics.minListenerExecutionTime,
        executionTime
      ),
      maxListenerExecutionTime: Math.max(
        actionMetrics.maxListenerExecutionTime || 0,
        executionTime
      ),
      slowListenerCount: isSlowExecution
        ? actionMetrics.slowListenerCount + 1
        : actionMetrics.slowListenerCount
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    const newTotalTime =
      globalMetrics.totalListenerExecutionTime + executionTime
    const newTotalCount = globalMetrics.totalListenerExecutions + 1

    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalListenerExecutions: newTotalCount,
      totalListenerExecutionTime: newTotalTime,
      avgListenerExecutionTime: newTotalTime / newTotalCount,
      totalSlowListeners: isSlowExecution
        ? globalMetrics.totalSlowListeners + 1
        : globalMetrics.totalSlowListeners
    })

    // Log warning for slow listeners
    if (isSlowExecution) {
      log.warn(
        `Slow listener detected for action "${id}": ${executionTime.toFixed(
          2
        )}ms (threshold: ${SLOW_LISTENER_THRESHOLD}ms)`
      )
    }

    // Debug logging for tracking
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `Listener execution tracked: ${id} - ${executionTime.toFixed(2)}ms`
      )
    }
  },

  // Add a special method for accurately measuring debounce overhead
  trackDebounceOverhead: (id: ActionId, setupTime: number): void => {
    const actionMetrics = getActionMetrics(id)

    // Track setup time separately from execution time
    if (!(actionMetrics as any)._debounceOverheadTimes) {
      ;(actionMetrics as any)._debounceOverheadTimes = []
      ;(actionMetrics as any)._totalDebounceOverhead = 0
    }

    // Add to overhead tracking
    if ((actionMetrics as any)._debounceOverheadTimes.length >= 10) {
      ;(actionMetrics as any)._debounceOverheadTimes.shift()
    }
    ;(actionMetrics as any)._debounceOverheadTimes.push(setupTime)
    ;(actionMetrics as any)._totalDebounceOverhead += setupTime

    // Save the updated metrics
    actionMetricsStore.set(id, actionMetrics)
  },

  // Track listener execution time specifically
  trackListenerExecution: (id: ActionId, executionTime: number): void => {
    // Get existing metrics
    const actionMetrics = getActionMetrics(id)

    // Add the execution time to history
    const newExecutionTimes = [
      ...actionMetrics.listenerExecutionTimes,
      executionTime
    ].slice(-MAX_EXECUTION_TIMES_HISTORY)

    // Calculate new metrics
    const totalTime = actionMetrics.totalListenerExecutionTime + executionTime
    const executionCount = newExecutionTimes.length
    const avgTime = totalTime / executionCount

    // Check if this is a slow listener
    const isSlowExecution = executionTime > SLOW_LISTENER_THRESHOLD

    // Update action metrics
    actionMetricsStore.set(id, {
      ...actionMetrics,
      listenerExecutionTimes: newExecutionTimes,
      totalListenerExecutionTime: totalTime,
      avgListenerExecutionTime: avgTime,
      minListenerExecutionTime: Math.min(
        actionMetrics.minListenerExecutionTime === Infinity
          ? executionTime
          : actionMetrics.minListenerExecutionTime,
        executionTime
      ),
      maxListenerExecutionTime: Math.max(
        actionMetrics.maxListenerExecutionTime || 0,
        executionTime
      ),
      slowListenerCount: isSlowExecution
        ? actionMetrics.slowListenerCount + 1
        : actionMetrics.slowListenerCount
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    const newTotalTime =
      globalMetrics.totalListenerExecutionTime + executionTime
    const newTotalCount = globalMetrics.totalListenerExecutions + 1

    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalListenerExecutions: newTotalCount,
      totalListenerExecutionTime: newTotalTime,
      avgListenerExecutionTime: newTotalTime / newTotalCount,
      totalSlowListeners: isSlowExecution
        ? globalMetrics.totalSlowListeners + 1
        : globalMetrics.totalSlowListeners
    })

    // Log warning for slow listeners
    if (isSlowExecution) {
      log.warn(
        `Slow listener detected for action "${id}": ${executionTime.toFixed(
          2
        )}ms (threshold: ${SLOW_LISTENER_THRESHOLD}ms)`
      )
    }
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
    const uptime = (now - globalMetrics.startTime) / 1000 // seconds

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

    // Sort the execution times
    const sortedTimes = [...actionMetrics.executionTimes].sort((a, b) => a - b)
    const index = Math.floor(sortedTimes.length * (percentile / 100))
    return sortedTimes[Math.min(index, sortedTimes.length - 1)]
  },

  // Get percentile listener execution time for an action
  getListenerExecutionTimePercentile: (
    id: StateKey,
    percentile: number
  ): number | undefined => {
    const actionMetrics = actionMetricsStore.get(id)
    if (!actionMetrics || actionMetrics.listenerExecutionTimes.length === 0)
      return undefined

    // Sort the execution times
    const sortedTimes = [...actionMetrics.listenerExecutionTimes].sort(
      (a, b) => a - b
    )
    const index = Math.floor(sortedTimes.length * (percentile / 100))
    return sortedTimes[Math.min(index, sortedTimes.length - 1)]
  },

  // Generate a comprehensive metrics report
  generateReport: (
    filterPredicate?: (metrics: ActionMetricsData) => boolean
  ): string => {
    const globalMetrics = getGlobalMetrics()
    let allActionMetrics = actionMetricsStore.getAll()

    // Filter out internal ids and system actions
    allActionMetrics = allActionMetrics.filter(metrics => {
      // Filter out internal IDs, timer IDs, and actions with zero calls
      const isInternalId =
        metrics.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}/) || // UUID format
        metrics.id.includes('-debounce-') || // Debounce timer
        metrics.id.endsWith('-timer') || // Generic timer
        metrics.calls === 0 // Unused actions
      return !isInternalId
    })

    // Apply additional filter if provided
    if (filterPredicate) {
      allActionMetrics = allActionMetrics.filter(filterPredicate)
    }

    // Sort by call count (highest first)
    allActionMetrics = sortActionMetrics(allActionMetrics)

    const uptime = Math.floor((Date.now() - globalMetrics.startTime) / 1000)
    const uptimeFormatted = (() => {
      const seconds = uptime % 60
      const minutes = Math.floor(uptime / 60) % 60
      const hours = Math.floor(uptime / 3600) % 24
      const days = Math.floor(uptime / 86400)
      return `${days}d ${hours}h ${minutes}m ${seconds}s`
    })()

    const avoidDivByZero = (num: number, denom: number) =>
      denom === 0 ? 0 : num / denom

    const avgExecTime = avoidDivByZero(
      globalMetrics.totalExecutionTime,
      globalMetrics.totalExecutions
    ).toFixed(2)

    const avgListenerTime = avoidDivByZero(
      globalMetrics.totalListenerExecutionTime,
      globalMetrics.totalListenerExecutions
    ).toFixed(2)

    let report = `CYRE Metrics Report\n`
    report += `=============================\n\n`
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

    report += `Performance Metrics:\n`
    report += `------------------\n`
    report += `Avg Execution Time: ${avgExecTime}ms\n`
    if (globalMetrics.totalListenerExecutions > 0) {
      report += `Avg Listener Time: ${avgListenerTime}ms\n`
      report += `Pipeline Overhead: ${(
        ((globalMetrics.totalExecutionTime -
          globalMetrics.totalListenerExecutionTime) /
          globalMetrics.totalExecutionTime) *
        100
      ).toFixed(1)}%\n`
    }
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
      const percentage = avoidDivByZero(
        count * 100,
        globalMetrics.totalCalls
      ).toFixed(1)
      report += `${priority}: ${count} calls (${percentage}%)\n`
    })

    report += `\nTop Actions by Call Count:\n`
    report += `------------------------\n`

    const topN = Math.min(allActionMetrics.length, 15) // Show top 15 or fewer
    for (let i = 0; i < topN; i++) {
      const metrics = allActionMetrics[i]
      report += `\n${i + 1}. ${metrics.id} (${metrics.priority})\n`
      report += `   Calls: ${metrics.calls}\n`

      if (metrics.executionTimes.length > 0) {
        report += `   Execution Time: ${metrics.avgExecutionTime.toFixed(
          2
        )}ms avg (range: ${metrics.minExecutionTime.toFixed(
          2
        )}ms - ${metrics.maxExecutionTime.toFixed(2)}ms)\n`

        // Show 95th percentile if we have enough data
        if (metrics.executionTimes.length >= 10) {
          const p95 = metricsReport.getExecutionTimePercentile(metrics.id, 95)
          if (p95 !== undefined) {
            report += `   95th Percentile: ${p95.toFixed(2)}ms\n`
          }
        }
      }

      // Add listener execution times if available
      if (metrics.listenerExecutionTimes?.length > 0) {
        report += `   Listener Time: ${metrics.avgListenerExecutionTime.toFixed(
          2
        )}ms avg (range: ${metrics.minListenerExecutionTime.toFixed(
          2
        )}ms - ${metrics.maxListenerExecutionTime.toFixed(2)}ms)\n`

        // Show overhead ratio if available
        if (
          metrics.executionTimes.length > 0 &&
          metrics.pipelineOverheadRatio > 0
        ) {
          report += `   Pipeline Overhead: ${(
            metrics.pipelineOverheadRatio * 100
          ).toFixed(1)}%\n`
        }

        // Show slow listener count if any
        if (metrics.slowListenerCount > 0) {
          report += `   Slow Listeners: ${metrics.slowListenerCount}\n`
        }
      }

      const throttleRate = avoidDivByZero(
        metrics.throttles * 100,
        metrics.calls
      ).toFixed(1)
      const debounceRate = avoidDivByZero(
        metrics.debounces * 100,
        metrics.calls
      ).toFixed(1)
      report += `   Throttles: ${metrics.throttles} (${throttleRate}%)\n`
      report += `   Debounces: ${metrics.debounces} (${debounceRate}%)\n`

      if (metrics.changeDetectionSkips > 0) {
        const skipRate = avoidDivByZero(
          metrics.changeDetectionSkips * 100,
          metrics.calls
        ).toFixed(1)
        report += `   Change Skips: ${metrics.changeDetectionSkips} (${skipRate}%)\n`
      }

      if (metrics.errorCount > 0) {
        report += `   Errors: ${metrics.errorCount}\n`
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

  // Get actionable insights based on metrics
  getInsights: (): string[] => {
    const insights: string[] = []
    const globalMetrics = getGlobalMetrics()
    const allActionMetrics = actionMetricsStore
      .getAll()
      .filter(m => m.calls > 0) // Only analyze actions that were called

    // Look for frequently throttled actions
    const highThrottleActions = allActionMetrics.filter(
      m => m.calls > 5 && m.throttles / m.calls > 0.3
    )

    if (highThrottleActions.length > 0) {
      insights.push(
        `${highThrottleActions.length} actions have high throttle rates (>30%). Consider increasing their throttle intervals.`
      )

      highThrottleActions.slice(0, 3).forEach(m => {
        const rate = ((m.throttles / m.calls) * 100).toFixed(1)
        insights.push(`  - "${m.id}" is throttled ${rate}% of the time`)
      })
    }

    // Look for actions with high debounce rates
    const highDebounceActions = allActionMetrics.filter(
      m => m.calls > 5 && m.debounces / m.calls > 0.7
    )

    if (highDebounceActions.length > 0) {
      insights.push(
        `${highDebounceActions.length} actions have high debounce rates (>70%). Consider reviewing the call patterns.`
      )

      highDebounceActions.slice(0, 3).forEach(m => {
        const rate = ((m.debounces / m.calls) * 100).toFixed(1)
        insights.push(`  - "${m.id}" is debounced ${rate}% of the time`)
      })
    }

    // Look for actions with high error rates
    const highErrorActions = allActionMetrics.filter(
      m => m.calls > 5 && m.errorCount / m.calls > 0.1
    )

    if (highErrorActions.length > 0) {
      insights.push(
        `${highErrorActions.length} actions have error rates >10%. Review error handling.`
      )

      highErrorActions.slice(0, 3).forEach(m => {
        const rate = ((m.errorCount / m.calls) * 100).toFixed(1)
        insights.push(`  - "${m.id}" fails ${rate}% of the time`)
      })
    }

    // Look for slow actions
    const slowActions = allActionMetrics.filter(
      m => m.executionTimes.length > 0 && m.avgExecutionTime > 20 // Adjust threshold as needed
    )

    if (slowActions.length > 0) {
      insights.push(
        `${slowActions.length} actions have average execution times >20ms. Consider optimizing:`
      )

      slowActions
        .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
        .slice(0, 3)
        .forEach(m => {
          insights.push(
            `  - "${m.id}" averages ${m.avgExecutionTime.toFixed(
              1
            )}ms per execution`
          )
        })
    }

    // Look for slow listeners
    const slowListenerActions = allActionMetrics.filter(
      m => m.listenerExecutionTimes?.length > 0 && m.slowListenerCount > 0
    )

    if (slowListenerActions.length > 0) {
      insights.push(
        `${slowListenerActions.length} actions have slow listeners exceeding ${SLOW_LISTENER_THRESHOLD}ms:`
      )

      slowListenerActions
        .sort((a, b) => b.maxListenerExecutionTime - a.maxListenerExecutionTime)
        .slice(0, 3)
        .forEach(m => {
          insights.push(
            `  - "${
              m.id
            }" has slow listener: max ${m.maxListenerExecutionTime.toFixed(
              1
            )}ms`
          )
        })
    }

    // Look for inefficient pipeline overhead
    const highOverheadActions = allActionMetrics.filter(
      m =>
        m.executionTimes.length > 0 &&
        m.listenerExecutionTimes?.length > 0 &&
        m.pipelineOverheadRatio > 0.5
    )

    if (highOverheadActions.length > 0) {
      insights.push(
        `${highOverheadActions.length} actions have high pipeline overhead (>50% of execution time):`
      )

      highOverheadActions
        .sort((a, b) => b.pipelineOverheadRatio - a.pipelineOverheadRatio)
        .slice(0, 3)
        .forEach(m => {
          insights.push(
            `  - "${m.id}" spends ${(m.pipelineOverheadRatio * 100).toFixed(
              1
            )}% of time in pipeline overhead`
          )
        })
    }

    // Add call rate insights
    if (globalMetrics.currentCallRate > 100) {
      // Adjust threshold as needed
      insights.push(
        `Current call rate (${globalMetrics.currentCallRate.toFixed(
          1
        )} calls/sec) is high. Check for call optimization opportunities.`
      )
    }

    // Add insights on change detection effectiveness
    const ineffectiveChangeDetection = allActionMetrics.filter(
      m => m.calls > 10 && m.changeDetectionSkips === 0
    )

    if (ineffectiveChangeDetection.length > 0) {
      insights.push(
        `${ineffectiveChangeDetection.length} actions have change detection enabled but no skips recorded. Consider removing detectChanges.`
      )
    }

    return insights
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
