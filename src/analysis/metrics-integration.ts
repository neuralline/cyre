// src/analysis/metrics-integration.ts
// Integration of metrics analyzer into main Cyre app

import {metricsAnalyzer, type AnalysisResult} from './metrics-analyzer'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - M.E.T.R.I.C.S - I.N.T.E.G.R.A.T.I.O.N
      
      Easy access to comprehensive metrics analysis:
      - Simple API for getting insights
      - Terminal logging integration
      - Development helpers
      - Production monitoring

*/

/**
 * Enhanced metrics reporting for Cyre
 */
export const cyreMetrics = {
  /**
   * Generate and log comprehensive report
   */
  report: (options?: {
    timeRange?: {since?: number; until?: number}
    logToConsole?: boolean
    returnData?: boolean
  }) => {
    const {timeRange, logToConsole = true, returnData = false} = options || {}

    try {
      const analysis = metricsAnalyzer.analyze(timeRange)
      const report = metricsAnalyzer.generateReport(analysis)

      if (logToConsole) {
        console.log('\n' + report)
      }

      if (returnData) {
        return {analysis, report}
      }

      return report
    } catch (error) {
      log.error(`Metrics report generation failed: ${error}`)
      return null
    }
  },

  /**
   * Quick health check with immediate feedback
   */
  healthCheck: () => {
    const health = metricsAnalyzer.healthCheck()

    const statusIcon =
      health.status === 'healthy'
        ? '✅'
        : health.status === 'warning'
        ? '⚠️'
        : '🔴'

    console.log(
      `\n${statusIcon} System Health: ${health.status.toUpperCase()} (Score: ${
        health.score
      }/100)`
    )

    if (health.issues.length > 0) {
      console.log('\nIssues:')
      health.issues.forEach(issue => console.log(`  • ${issue}`))
    }

    return health
  },

  /**
   * Start live monitoring with configurable intervals
   */
  startLiveMonitoring: (intervalMs: number = 30000) => {
    console.log(
      `🔍 Starting live metrics monitoring (${intervalMs}ms intervals)`
    )
    console.log('   Use cyre.metrics.stopLiveMonitoring() to stop')

    return metricsAnalyzer.startLiveMonitoring(intervalMs)
  },

  /**
   * Analyze specific channel in detail
   */
  analyzeChannel: (channelId: string) => {
    const analysis = metricsAnalyzer.analyze()
    const channel = analysis.channels.find(ch => ch.id === channelId)

    if (!channel) {
      console.log(`❌ Channel '${channelId}' not found`)
      return null
    }

    console.log(`\n📊 Channel Analysis: ${channelId}`)
    console.log(`   Status: ${channel.status.toUpperCase()}`)
    console.log(`   Calls: ${channel.calls}`)
    console.log(`   Success Rate: ${(channel.successRate * 100).toFixed(1)}%`)
    console.log(`   Average Latency: ${channel.averageLatency.toFixed(2)}ms`)
    console.log(`   Errors: ${channel.errors}`)

    if (
      channel.protections.throttled +
        channel.protections.debounced +
        channel.protections.blocked >
      0
    ) {
      console.log('   Protections:')
      if (channel.protections.throttled > 0)
        console.log(`     Throttled: ${channel.protections.throttled}`)
      if (channel.protections.debounced > 0)
        console.log(`     Debounced: ${channel.protections.debounced}`)
      if (channel.protections.blocked > 0)
        console.log(`     Blocked: ${channel.protections.blocked}`)
      if (channel.protections.skipped > 0)
        console.log(`     Skipped: ${channel.protections.skipped}`)
    }

    if (channel.issues.length > 0) {
      console.log('   Issues:')
      channel.issues.forEach(issue => console.log(`     • ${issue}`))
    }

    return channel
  },

  /**
   * Export raw analysis data for custom processing
   */
  exportData: (timeRange?: {since?: number; until?: number}) => {
    return metricsAnalyzer.analyze(timeRange)
  },

  /**
   * Performance snapshot for debugging
   */
  snapshot: () => {
    const analysis = metricsAnalyzer.analyze()

    const snapshot = {
      timestamp: new Date().toISOString(),
      system: {
        health: analysis.systemHealth.overall,
        stress: (analysis.summary.stress * 100).toFixed(1) + '%',
        successRate: (analysis.summary.successRate * 100).toFixed(1) + '%',
        avgLatency: analysis.summary.averageLatency.toFixed(2) + 'ms',
        callRate: analysis.summary.callRate.toFixed(1) + '/sec',
        totalChannels: analysis.summary.totalActions,
        totalCalls: analysis.summary.totalCalls,
        totalErrors: analysis.summary.totalErrors
      },
      alerts: analysis.alerts.length,
      criticalChannels: analysis.channels.filter(ch => ch.status === 'critical')
        .length,
      topErrors: analysis.patterns.frequentErrors.slice(0, 3).map(e => ({
        error: e.error,
        count: e.count
      }))
    }

    console.log('📸 Performance Snapshot:')
    console.log(JSON.stringify(snapshot, null, 2))

    return snapshot
  },

  /**
   * Monitor specific metrics over time
   */
  watchMetric: (
    metric: 'latency' | 'successRate' | 'errorRate' | 'callRate',
    threshold?: number
  ) => {
    let lastValue: number | null = null

    const check = () => {
      const analysis = metricsAnalyzer.analyze()
      let currentValue: number

      switch (metric) {
        case 'latency':
          currentValue = analysis.summary.averageLatency
          break
        case 'successRate':
          currentValue = analysis.summary.successRate
          break
        case 'errorRate':
          currentValue = analysis.errors.errorRate
          break
        case 'callRate':
          currentValue = analysis.summary.callRate
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
        if (
          (metric === 'latency' ||
            metric === 'errorRate' ||
            metric === 'callRate') &&
          currentValue > threshold
        ) {
          console.log(
            `⚠️  ${metric} exceeded threshold of ${formatMetricValue(
              metric,
              threshold
            )}`
          )
        } else if (metric === 'successRate' && currentValue < threshold) {
          console.log(
            `⚠️  ${metric} below threshold of ${formatMetricValue(
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

    return () => {
      clearInterval(intervalId)
      console.log(`✋ Stopped watching ${metric}`)
    }
  },

  /**
   * Development helper: Log metrics after each call
   */
  enableDebugMode: () => {
    console.log(
      '🐛 Debug mode enabled - metrics will be logged after each call'
    )

    // This would need to be integrated into the call pipeline
    // For now, just start frequent monitoring
    return metricsAnalyzer.startLiveMonitoring(1000)
  }
}

function formatMetricValue(metric: string, value: number): string {
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

// Update to app.ts - add this to the main cyre object:
export const appIntegration = {
  // Add to main cyre object
  metrics: cyreMetrics,

  // Enhanced getMetricsReport that uses the new analyzer
  getMetricsReport: () => {
    return cyreMetrics.exportData()
  },

  // Enhanced performance insights
  getPerformanceInsights: (actionId?: string): string[] => {
    const analysis = cyreMetrics.exportData()

    if (actionId) {
      const channel = analysis.channels.find(ch => ch.id === actionId)
      if (channel && channel.issues.length > 0) {
        return channel.issues
      }
    }

    return analysis.recommendations
  }
}
