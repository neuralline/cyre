// src/context/detailed-metrics.ts

import {createStore} from './create-store'
import type {ActionId, Priority, StateKey} from '../interfaces/interface'
import {log} from '../components/cyre-logger'
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
}

// Constants for metrics management
const MAX_EXECUTION_TIMES_HISTORY = 100
const RATE_CALCULATION_WINDOW = 10000 // 10 seconds for rate calculations

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
  }
})

// Initialize an action metrics record
const initActionMetrics = (
  id: string,
  priority: Priority = 'medium'
): ActionMetricsData => ({
  id,
  calls: 0,
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
  middlewareRejections: 0
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
  const callsSinceLastCheck =
    globalMetrics.totalCalls -
    globalMetrics.currentCallRate *
      ((now - globalMetrics.callRateTimestamp) / 1000)
  const secondsElapsed = Math.max(
    0.001,
    (now - globalMetrics.callRateTimestamp) / 1000
  )
  return callsSinceLastCheck / secondsElapsed
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
      log.debug(`High call rate detected: ${callRate.toFixed(2)} calls/second`)
    }
  },

  // Track a debounce operation
  trackDebounce: (id: ActionId): void => {
    // Update action metrics
    const actionMetrics = getActionMetrics(id)
    actionMetricsStore.set(id, {
      ...actionMetrics,
      debounces: actionMetrics.debounces + 1
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalDebounces: globalMetrics.totalDebounces + 1
    })
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
  trackExecution: (id: ActionId, executionTime: number): void => {
    const now = Date.now()

    // Update action metrics
    const actionMetrics = getActionMetrics(id)
    const newExecutionTimes = [
      ...actionMetrics.executionTimes,
      executionTime
    ].slice(-MAX_EXECUTION_TIMES_HISTORY) // Keep only the most recent executions

    const totalExecutionTime = actionMetrics.totalExecutionTime + executionTime
    const executionCount = newExecutionTimes.length

    actionMetricsStore.set(id, {
      ...actionMetrics,
      executionTimes: newExecutionTimes,
      totalExecutionTime,
      avgExecutionTime: totalExecutionTime / executionCount,
      minExecutionTime: Math.min(actionMetrics.minExecutionTime, executionTime),
      maxExecutionTime: Math.max(actionMetrics.maxExecutionTime, executionTime),
      lastExecution: now
    })

    // Update global metrics
    const globalMetrics = getGlobalMetrics()
    globalMetricsStore.set('global', {
      ...globalMetrics,
      totalExecutions: globalMetrics.totalExecutions + 1,
      totalExecutionTime: globalMetrics.totalExecutionTime + executionTime
    })

    // Optionally integrate with metrics-state for breathing
    try {
      // Only trigger a metrics update if execution time is significant
      if (executionTime > 100) {
        // Adjust threshold as needed
        const {system} = metricsState.get()
        metricsState.updateBreath({
          ...system,
          eventLoop: Math.max(system.eventLoop, executionTime / 10) // Factor down execution time for eventLoop impact
        })
      }
    } catch (error) {
      log.debug('Failed to update metrics-state breathing with execution time')
    }
  },

  // Get metrics report for a specific action
  getActionMetrics: (id: StateKey): ActionMetricsData | undefined => {
    return actionMetricsStore.get(id)
  },

  // Get metrics report for all actions
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

  // Generate a comprehensive metrics report
  generateReport: (
    filterPredicate?: (metrics: ActionMetricsData) => boolean
  ): string => {
    const globalMetrics = getGlobalMetrics()
    let allActionMetrics = actionMetricsStore.getAll()

    // Apply filter if provided
    if (filterPredicate) {
      allActionMetrics = allActionMetrics.filter(filterPredicate)
    }

    // Sort by call count (highest first)
    allActionMetrics.sort((a, b) => b.calls - a.calls)

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

    let report = `CYRE Metrics Report Report\n`
    report += `=============================\n\n`
    report += `System Uptime: ${uptimeFormatted}\n`
    report += `Total Actions: ${globalMetrics.totalActions}\n\n`

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
        report += `   Avg Execution: ${metrics.avgExecutionTime.toFixed(2)}ms\n`
        report += `   Min/Max Execution: ${metrics.minExecutionTime.toFixed(
          2
        )}ms / ${metrics.maxExecutionTime.toFixed(2)}ms\n`
      }

      const throttleRate = avoidDivByZero(
        metrics.throttles * 100,
        metrics.calls
      ).toFixed(1)
      const debounceRate = avoidDivByZero(
        metrics.debounces * 100,
        metrics.calls
      ).toFixed(1)
      const skipRate = avoidDivByZero(
        metrics.changeDetectionSkips * 100,
        metrics.calls
      ).toFixed(1)

      report += `   Throttles: ${metrics.throttles} (${throttleRate}%)\n`
      report += `   Debounces: ${metrics.debounces} (${debounceRate}%)\n`
      if (metrics.changeDetectionSkips > 0) {
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
    const allActionMetrics = actionMetricsStore.getAll()

    // Look for frequently throttled actions
    const highThrottleActions = allActionMetrics.filter(
      m => m.calls > 10 && m.throttles / m.calls > 0.3
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
      m => m.calls > 10 && m.debounces / m.calls > 0.5
    )

    if (highDebounceActions.length > 0) {
      insights.push(
        `${highDebounceActions.length} actions have high debounce rates (>50%). Consider reviewing the call patterns.`
      )
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
      m => m.executionTimes.length > 0 && m.avgExecutionTime > 100 // Adjust threshold as needed
    )

    if (slowActions.length > 0) {
      insights.push(
        `${slowActions.length} actions have average execution times >100ms. Consider optimizing:`
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

    // Add call rate insights
    if (globalMetrics.currentCallRate > 50) {
      // Adjust threshold as needed
      insights.push(
        `Current call rate (${globalMetrics.currentCallRate.toFixed(
          1
        )} calls/sec) is high. Check for call optimization opportunities.`
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
export const initDetailedMetrics = (): void => {
  metricsReport.reset()
}
