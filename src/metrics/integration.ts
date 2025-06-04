// src/metrics/integration.ts
// Integration layer for unified metrics system

import {metricsCore, type MetricEvent} from './core'
import {analyzer, type SystemAnalysis} from './analyzer'
import type {ActionId} from '../types/core'

/*

      C.Y.R.E - M.E.T.R.I.C.S - I.N.T.E.G.R.A.T.I.O.N
      
      Integration layer:
      - Simple API for recording metrics
      - Analysis and reporting interface
      - Development and monitoring tools
      - Performance optimizations

*/

// Live monitoring state
let liveMonitoringInterval: NodeJS.Timeout | undefined
let watcherIntervals: Map<string, NodeJS.Timeout> = new Map()

/**
 * Unified metrics interface
 */
export const metrics = {
  /**
   * Record an event
   */
  record: (
    actionId: ActionId,
    eventType: MetricEvent,
    location?: string,
    metadata?: Record<string, unknown>
  ): void => {
    metricsCore.record(actionId, eventType, location, metadata)
  },

  /**
   * Get system overview
   */
  getSystemMetrics: () => {
    return metricsCore.getSystemMetrics()
  },

  /**
   * Get channel metrics
   */
  getChannelMetrics: (actionId: ActionId) => {
    return metricsCore.getChannelMetrics(actionId)
  },

  /**
   * Analyze performance
   */
  analyze: (timeWindow?: number): SystemAnalysis => {
    return analyzer.analyze(timeWindow)
  },

  /**
   * Quick health check
   */
  healthCheck: () => {
    const health = analyzer.healthCheck()

    const statusIcon =
      health.status === 'healthy'
        ? '✅'
        : health.status === 'degraded'
        ? '⚠️'
        : '🔴'

    console.log(
      `${statusIcon} System Health: ${health.status.toUpperCase()} (Score: ${
        health.score
      }/100)`
    )

    if (health.issues.length > 0) {
      console.log('Issues:')
      health.issues.slice(0, 5).forEach(issue => console.log(`  • ${issue}`))
    }

    return health
  },

  /**
   * Generate report
   */
  report: (options?: {
    timeWindow?: number
    logToConsole?: boolean
    returnData?: boolean
  }) => {
    const {timeWindow, logToConsole = true, returnData = false} = options || {}

    try {
      const analysis = analyzer.analyze(timeWindow)
      const report = analyzer.generateReport(analysis)

      if (logToConsole) {
        console.log('\n' + report)
      }

      if (returnData) {
        return {analysis, report}
      }

      return report
    } catch (error) {
      console.error(`Metrics report generation failed: ${error}`)
      return null
    }
  },

  /**
   * Analyze specific channel
   */
  analyzeChannel: (channelId: string, timeWindow?: number) => {
    const channelAnalysis = analyzer.analyzeChannel(channelId, timeWindow)

    if (!channelAnalysis) {
      console.log(`❌ Channel '${channelId}' not found`)
      return null
    }

    console.log(`\n📊 Channel Analysis: ${channelId}`)
    console.log(`   Status: ${channelAnalysis.status.toUpperCase()}`)
    console.log(`   Calls: ${channelAnalysis.metrics.calls}`)
    console.log(
      `   Success Rate: ${(channelAnalysis.metrics.successRate * 100).toFixed(
        1
      )}%`
    )
    console.log(
      `   Average Latency: ${channelAnalysis.metrics.averageLatency.toFixed(
        2
      )}ms`
    )
    console.log(`   Errors: ${channelAnalysis.metrics.errors}`)

    const protections = channelAnalysis.protectionUsage
    if (
      protections.throttled + protections.debounced + protections.blocked >
      0
    ) {
      console.log('   Protections:')
      if (protections.throttled > 0)
        console.log(`     Throttled: ${protections.throttled}`)
      if (protections.debounced > 0)
        console.log(`     Debounced: ${protections.debounced}`)
      if (protections.blocked > 0)
        console.log(`     Blocked: ${protections.blocked}`)
      if (protections.skipped > 0)
        console.log(`     Skipped: ${protections.skipped}`)
    }

    if (channelAnalysis.issues.length > 0) {
      console.log('   Issues:')
      channelAnalysis.issues.forEach(issue => console.log(`     • ${issue}`))
    }

    return channelAnalysis
  },

  /**
   * Start live monitoring
   */
  startLiveMonitoring: (intervalMs = 30000) => {
    console.log(
      `🔍 Starting live metrics monitoring (${intervalMs}ms intervals)`
    )

    liveMonitoringInterval = setInterval(() => {
      try {
        const analysis = analyzer.analyze()

        // Only show report if there's activity or alerts
        if (analysis.system.totalCalls > 0 || analysis.alerts.length > 0) {
          const report = analyzer.generateReport(analysis)
          console.log('\n' + report)
        }
      } catch (error) {
        console.error(`Live monitoring error: ${error}`)
      }
    }, intervalMs)

    return () => {
      if (liveMonitoringInterval) {
        clearInterval(liveMonitoringInterval)
        liveMonitoringInterval = undefined
        console.log('✋ Live monitoring stopped')
      }
    }
  },

  /**
   * Watch specific metric
   */
  watchMetric: (
    metric: 'latency' | 'successRate' | 'errorRate' | 'callRate',
    threshold?: number
  ) => {
    const watcherId = `watch-${metric}-${Date.now()}`
    let lastValue: number | null = null

    const check = () => {
      const analysis = analyzer.analyze()
      let currentValue: number

      switch (metric) {
        case 'latency':
          currentValue = analysis.health.factors.latency
          break
        case 'successRate':
          currentValue = analysis.health.factors.successRate
          break
        case 'errorRate':
          currentValue = analysis.health.factors.errorRate
          break
        case 'callRate':
          currentValue = analysis.system.callRate
          break
        default:
          return
      }

      const change = lastValue !== null ? currentValue - lastValue : 0
      const changeDirection = change > 0 ? '↗️' : change < 0 ? '↘️' : '→'

      console.log(
        `${changeDirection} ${metric}: ${formatMetricValue(
          metric,
          currentValue
        )} ${
          change !== 0
            ? `(${formatMetricValue(metric, Math.abs(change))} ${
                change > 0 ? 'increase' : 'decrease'
              })`
            : ''
        }`
      )

      if (threshold !== undefined) {
        const exceedsThreshold =
          metric === 'latency' ||
          metric === 'errorRate' ||
          metric === 'callRate'
            ? currentValue > threshold
            : currentValue < threshold

        if (exceedsThreshold) {
          const comparison = metric === 'successRate' ? 'below' : 'exceeded'
          console.log(
            `⚠️  ${metric} ${comparison} threshold of ${formatMetricValue(
              metric,
              threshold
            )}`
          )
        }
      }

      lastValue = currentValue
    }

    console.log(
      `👀 Watching ${metric}${
        threshold ? ` (threshold: ${formatMetricValue(metric, threshold)})` : ''
      }`
    )

    const intervalId = setInterval(check, 5000)
    watcherIntervals.set(watcherId, intervalId)

    return () => {
      const interval = watcherIntervals.get(watcherId)
      if (interval) {
        clearInterval(interval)
        watcherIntervals.delete(watcherId)
        console.log(`✋ Stopped watching ${metric}`)
      }
    }
  },

  /**
   * Performance snapshot
   */
  snapshot: () => {
    const analysis = analyzer.analyze()

    const snapshot = {
      timestamp: new Date().toISOString(),
      system: {
        health: analysis.health.overall,
        stress: (analysis.health.factors.systemStress * 100).toFixed(1) + '%',
        successRate:
          (analysis.health.factors.successRate * 100).toFixed(1) + '%',
        avgLatency: analysis.health.factors.latency.toFixed(2) + 'ms',
        callRate: analysis.system.callRate.toFixed(1) + '/sec',
        totalChannels: analysis.channels.length,
        totalCalls: analysis.system.totalCalls,
        totalErrors: analysis.system.totalErrors
      },
      alerts: analysis.alerts.length,
      criticalChannels: analysis.channels.filter(ch => ch.status === 'critical')
        .length,
      topAlerts: analysis.alerts.slice(0, 3).map(a => ({
        severity: a.severity,
        message: a.message,
        channel: a.channel
      }))
    }

    console.log('📸 Performance Snapshot:')
    console.log(JSON.stringify(snapshot, null, 2))

    return snapshot
  },

  /**
   * Export raw data
   */
  exportData: (timeWindow?: number) => {
    return analyzer.analyze(timeWindow)
  },

  /**
   * Reset all metrics
   */
  reset: () => {
    // Stop all monitoring
    if (liveMonitoringInterval) {
      clearInterval(liveMonitoringInterval)
      liveMonitoringInterval = undefined
    }

    watcherIntervals.forEach(interval => clearInterval(interval))
    watcherIntervals.clear()

    // Reset core metrics
    metricsCore.reset()

    console.log('📊 Metrics system reset')
  },

  /**
   * Initialize metrics system
   */
  initialize: (config?: {
    maxEvents?: number
    retentionTime?: number
    cleanupInterval?: number
  }) => {
    metricsCore.initialize(config)
    console.log('📊 Metrics system initialized')
  },

  /**
   * Shutdown metrics system
   */
  shutdown: () => {
    // Stop all monitoring
    if (liveMonitoringInterval) {
      clearInterval(liveMonitoringInterval)
      liveMonitoringInterval = undefined
    }

    watcherIntervals.forEach(interval => clearInterval(interval))
    watcherIntervals.clear()

    // Shutdown core system
    metricsCore.shutdown()

    console.log('📊 Metrics system shutdown')
  }
}

/**
 * Format metric values for display
 */
const formatMetricValue = (metric: string, value: number): string => {
  switch (metric) {
    case 'latency':
      return `${value.toFixed(2)}ms`
    case 'successRate':
      return `${(value * 100).toFixed(1)}%`
    case 'errorRate':
      return `${(value * 100).toFixed(2)}%`
    case 'callRate':
      return `${value.toFixed(1)}/sec`
    default:
      return value.toString()
  }
}
