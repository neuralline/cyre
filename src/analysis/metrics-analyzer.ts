// src/analysis/metrics-analyzer.ts
// Comprehensive metrics analysis and reporting system

import {
  metricsReport,
  type RawMetricEvent,
  type EventType
} from '../context/metrics-report'
import {metricsState} from '../context/metrics-state'
import {io, timeline} from '../context/state'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - M.E.T.R.I.C.S - A.N.A.L.Y.Z.E.R
      
      Deep analysis and reporting system:
      - Pattern detection in sensor data
      - Performance bottleneck identification
      - Error correlation analysis
      - Success rate calculations
      - Actionable insights generation
      - Terminal-friendly detailed reports

*/

interface AnalysisResult {
  timestamp: number
  summary: PerformanceSummary
  channels: ChannelAnalysis[]
  patterns: PatternAnalysis
  errors: ErrorAnalysis
  recommendations: string[]
  alerts: Alert[]
  systemHealth: SystemHealthAnalysis
}

interface PerformanceSummary {
  totalActions: number
  totalCalls: number
  totalExecutions: number
  totalErrors: number
  successRate: number
  averageLatency: number
  callRate: number
  uptime: number
  stress: number
}

interface ChannelAnalysis {
  id: string
  calls: number
  executions: number
  errors: number
  successRate: number
  averageLatency: number
  lastActivity: number
  status: 'healthy' | 'warning' | 'critical' | 'inactive'
  issues: string[]
  protections: {
    throttled: number
    debounced: number
    blocked: number
    skipped: number
  }
}

interface PatternAnalysis {
  frequentErrors: Array<{error: string; count: number; channels: string[]}>
  bottlenecks: Array<{channel: string; avgLatency: number; issue: string}>
  spikes: Array<{time: number; metric: string; value: number}>
  trends: Array<{
    metric: string
    direction: 'increasing' | 'decreasing' | 'stable'
    confidence: number
  }>
}

interface ErrorAnalysis {
  totalErrors: number
  errorRate: number
  errorsByType: Record<string, number>
  errorsByChannel: Record<string, number>
  recentErrors: Array<{
    timestamp: number
    channel: string
    error: string
    location: string
  }>
  criticalErrors: Array<{
    timestamp: number
    channel: string
    error: string
    frequency: number
  }>
}

interface Alert {
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'performance' | 'error' | 'system' | 'pattern'
  message: string
  channel?: string
  metric?: string
  value?: number
  threshold?: number
  timestamp: number
}

interface SystemHealthAnalysis {
  overall: 'healthy' | 'degraded' | 'critical'
  breathing: {
    status: 'normal' | 'stressed' | 'recuperating'
    rate: number
    stress: number
  }
  memory: {
    channels: number
    timers: number
    events: number
    estimated: string
  }
  performance: {
    slowChannels: string[]
    fastChannels: string[]
    averageResponseTime: number
  }
}

/**
 * Main metrics analyzer
 */
export const metricsAnalyzer = {
  /**
   * Generate comprehensive analysis report
   */
  analyze: (timeRange?: {since?: number; until?: number}): AnalysisResult => {
    const startTime = performance.now()

    // Get all metric events
    const events = metricsReport.exportEvents({
      since: timeRange?.since,
      limit: 10000
    })

    const systemStats = metricsReport.getSystemStats()
    const breathingState = metricsState.get().breathing
    const allChannels = io.getAll()

    log.debug(
      `Analyzing ${events.length} events across ${allChannels.length} channels`
    )

    // Generate analysis components
    const summary = generatePerformanceSummary(
      events,
      systemStats,
      breathingState
    )
    const channels = analyzeChannels(events, allChannels)
    const patterns = detectPatterns(events)
    const errors = analyzeErrors(events)
    const systemHealth = analyzeSystemHealth(summary, channels, breathingState)
    const alerts = generateAlerts(summary, channels, errors, systemHealth)
    const recommendations = generateRecommendations(
      summary,
      channels,
      patterns,
      errors
    )

    const analysisTime = performance.now() - startTime
    log.debug(`Analysis completed in ${analysisTime.toFixed(2)}ms`)

    return {
      timestamp: Date.now(),
      summary,
      channels,
      patterns,
      errors,
      recommendations,
      alerts,
      systemHealth
    }
  },

  /**
   * Generate terminal-friendly report
   */
  generateReport: (analysis?: AnalysisResult): string => {
    const data = analysis || metricsAnalyzer.analyze()

    const lines: string[] = []
    const addLine = (text: string = '') => lines.push(text)
    const addHeader = (title: string, char: string = '=') => {
      addLine()
      addLine(char.repeat(80))
      addLine(`  ${title}`)
      addLine(char.repeat(80))
    }
    const addSubHeader = (title: string) => {
      addLine()
      addLine(`${title}`)
      addLine('-'.repeat(title.length))
    }

    // Report header
    addHeader('CYRE METRICS ANALYSIS REPORT')
    addLine(`Generated: ${new Date(data.timestamp).toISOString()}`)
    addLine(`Uptime: ${formatDuration(data.summary.uptime)}`)
    addLine(`System Status: ${data.systemHealth.overall.toUpperCase()}`)

    // Executive summary
    addSubHeader('EXECUTIVE SUMMARY')
    addLine(`Total Channels: ${data.summary.totalActions}`)
    addLine(`Total Calls: ${data.summary.totalCalls.toLocaleString()}`)
    addLine(`Success Rate: ${(data.summary.successRate * 100).toFixed(1)}%`)
    addLine(`Average Latency: ${data.summary.averageLatency.toFixed(2)}ms`)
    addLine(`Call Rate: ${data.summary.callRate.toFixed(1)}/sec`)
    addLine(`System Stress: ${(data.summary.stress * 100).toFixed(1)}%`)

    // Alerts
    if (data.alerts.length > 0) {
      addSubHeader('🚨 ALERTS')
      data.alerts
        .sort(
          (a, b) =>
            alertSeverityOrder(b.severity) - alertSeverityOrder(a.severity)
        )
        .slice(0, 10)
        .forEach(alert => {
          const severityIcon = getAlertIcon(alert.severity)
          addLine(
            `${severityIcon} [${alert.type.toUpperCase()}] ${alert.message}`
          )
          if (alert.channel) addLine(`    Channel: ${alert.channel}`)
          if (alert.metric && alert.value !== undefined) {
            addLine(
              `    ${alert.metric}: ${alert.value} ${
                alert.threshold ? `(threshold: ${alert.threshold})` : ''
              }`
            )
          }
        })
    }

    // Top problematic channels
    const problematicChannels = data.channels
      .filter(ch => ch.status === 'critical' || ch.status === 'warning')
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 10)

    if (problematicChannels.length > 0) {
      addSubHeader('⚠️  PROBLEMATIC CHANNELS')
      addLine(
        `${'Channel'.padEnd(25)} ${'Calls'.padStart(8)} ${'Errors'.padStart(
          8
        )} ${'Success%'.padStart(9)} ${'Avg Latency'.padStart(12)} Status`
      )
      addLine('-'.repeat(80))
      problematicChannels.forEach(ch => {
        addLine(
          `${ch.id.padEnd(25)} ${ch.calls.toString().padStart(8)} ${ch.errors
            .toString()
            .padStart(8)} ` +
            `${(ch.successRate * 100)
              .toFixed(1)
              .padStart(8)}% ${ch.averageLatency.toFixed(1).padStart(11)}ms ` +
            `${ch.status.toUpperCase()}`
        )
        ch.issues.slice(0, 2).forEach(issue => {
          addLine(`    └─ ${issue}`)
        })
      })
    }

    // Performance insights
    addSubHeader('📊 PERFORMANCE INSIGHTS')

    // Top performers
    const topPerformers = data.channels
      .filter(ch => ch.calls > 0 && ch.status === 'healthy')
      .sort(
        (a, b) =>
          b.successRate - a.successRate || a.averageLatency - b.averageLatency
      )
      .slice(0, 5)

    if (topPerformers.length > 0) {
      addLine('Top Performing Channels:')
      topPerformers.forEach(ch => {
        addLine(
          `  ✓ ${ch.id} - ${(ch.successRate * 100).toFixed(
            1
          )}% success, ${ch.averageLatency.toFixed(1)}ms avg`
        )
      })
      addLine()
    }

    // Bottlenecks
    if (data.patterns.bottlenecks.length > 0) {
      addLine('Performance Bottlenecks:')
      data.patterns.bottlenecks.slice(0, 5).forEach(bottleneck => {
        addLine(
          `  🐌 ${bottleneck.channel} - ${bottleneck.avgLatency.toFixed(
            1
          )}ms (${bottleneck.issue})`
        )
      })
      addLine()
    }

    // Error analysis
    if (data.errors.totalErrors > 0) {
      addSubHeader('🔥 ERROR ANALYSIS')
      addLine(`Total Errors: ${data.errors.totalErrors}`)
      addLine(`Error Rate: ${(data.errors.errorRate * 100).toFixed(2)}%`)

      // Most frequent errors
      const frequentErrors = Object.entries(data.errors.errorsByType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)

      if (frequentErrors.length > 0) {
        addLine()
        addLine('Most Frequent Errors:')
        frequentErrors.forEach(([error, count]) => {
          addLine(`  ${count}x ${error}`)
        })
      }

      // Recent critical errors
      if (data.errors.criticalErrors.length > 0) {
        addLine()
        addLine('Recent Critical Errors:')
        data.errors.criticalErrors.slice(0, 5).forEach(error => {
          addLine(
            `  🔴 ${error.channel}: ${error.error} (${error.frequency}x in last hour)`
          )
        })
      }
    }

    // System health
    addSubHeader('🏥 SYSTEM HEALTH')
    addLine(`Overall Health: ${data.systemHealth.overall.toUpperCase()}`)
    addLine(`Breathing Status: ${data.systemHealth.breathing.status}`)
    addLine(`Breathing Rate: ${data.systemHealth.breathing.rate}ms`)
    addLine(`Memory Usage: ${data.systemHealth.memory.estimated}`)
    addLine(`Active Channels: ${data.systemHealth.memory.channels}`)
    addLine(`Active Timers: ${data.systemHealth.memory.timers}`)

    // Protection usage
    const protectionStats = data.channels.reduce(
      (acc, ch) => {
        acc.throttled += ch.protections.throttled
        acc.debounced += ch.protections.debounced
        acc.blocked += ch.protections.blocked
        acc.skipped += ch.protections.skipped
        return acc
      },
      {throttled: 0, debounced: 0, blocked: 0, skipped: 0}
    )

    if (Object.values(protectionStats).some(v => v > 0)) {
      addLine()
      addLine('Protection Usage:')
      if (protectionStats.throttled > 0)
        addLine(`  Throttled calls: ${protectionStats.throttled}`)
      if (protectionStats.debounced > 0)
        addLine(`  Debounced calls: ${protectionStats.debounced}`)
      if (protectionStats.blocked > 0)
        addLine(`  Blocked calls: ${protectionStats.blocked}`)
      if (protectionStats.skipped > 0)
        addLine(`  Skipped calls: ${protectionStats.skipped}`)
    }

    // Recommendations
    if (data.recommendations.length > 0) {
      addSubHeader('💡 RECOMMENDATIONS')
      data.recommendations.slice(0, 8).forEach((rec, i) => {
        addLine(`${i + 1}. ${rec}`)
      })
    }

    // Pattern detection
    if (data.patterns.trends.length > 0) {
      addSubHeader('📈 TRENDS')
      data.patterns.trends.slice(0, 5).forEach(trend => {
        const arrow =
          trend.direction === 'increasing'
            ? '↗️'
            : trend.direction === 'decreasing'
            ? '↘️'
            : '→'
        addLine(
          `${arrow} ${trend.metric}: ${trend.direction} (${(
            trend.confidence * 100
          ).toFixed(0)}% confidence)`
        )
      })
    }

    // Footer
    addLine()
    addLine('-'.repeat(80))
    addLine(`Report generated by CYRE Metrics Analyzer`)
    addLine(`Analysis Time: ${new Date().toISOString()}`)
    addLine(
      `Events Analyzed: ${data.summary.totalCalls + data.summary.totalErrors}`
    )

    return lines.join('\n')
  },

  /**
   * Live monitoring with periodic reports
   */
  startLiveMonitoring: (intervalMs: number = 30000) => {
    let lastReport = Date.now()

    const monitor = () => {
      try {
        const analysis = metricsAnalyzer.analyze({since: lastReport})

        // Only generate report if there's activity
        if (analysis.summary.totalCalls > 0 || analysis.alerts.length > 0) {
          const report = metricsAnalyzer.generateReport(analysis)
          console.log('\n' + report)
        }

        lastReport = Date.now()
      } catch (error) {
        log.error(`Live monitoring error: ${error}`)
      }
    }

    const intervalId = setInterval(monitor, intervalMs)
    log.success(`Live monitoring started (${intervalMs}ms intervals)`)

    return () => {
      clearInterval(intervalId)
      log.info('Live monitoring stopped')
    }
  },

  /**
   * Quick health check
   */
  healthCheck: (): {status: string; issues: string[]; score: number} => {
    const analysis = metricsAnalyzer.analyze()
    const issues: string[] = []
    let score = 100

    // Check success rate
    if (analysis.summary.successRate < 0.9) {
      issues.push(
        `Low success rate: ${(analysis.summary.successRate * 100).toFixed(1)}%`
      )
      score -= 20
    }

    // Check average latency
    if (analysis.summary.averageLatency > 100) {
      issues.push(
        `High latency: ${analysis.summary.averageLatency.toFixed(1)}ms`
      )
      score -= 15
    }

    // Check system stress
    if (analysis.summary.stress > 0.8) {
      issues.push(
        `High system stress: ${(analysis.summary.stress * 100).toFixed(1)}%`
      )
      score -= 25
    }

    // Check critical alerts
    const criticalAlerts = analysis.alerts.filter(
      a => a.severity === 'critical'
    )
    if (criticalAlerts.length > 0) {
      issues.push(`${criticalAlerts.length} critical alerts`)
      score -= 30
    }

    // Check error rate
    if (analysis.errors.errorRate > 0.05) {
      issues.push(
        `High error rate: ${(analysis.errors.errorRate * 100).toFixed(2)}%`
      )
      score -= 10
    }

    const status =
      score >= 90 ? 'healthy' : score >= 70 ? 'warning' : 'critical'

    return {
      status,
      issues,
      score: Math.max(0, score)
    }
  }
}

// Helper functions
function generatePerformanceSummary(
  events: RawMetricEvent[],
  systemStats: any,
  breathing: any
): PerformanceSummary {
  const calls = events.filter(e => e.eventType === 'call')
  const executions = events.filter(e => e.eventType === 'execution')
  const errors = events.filter(e => e.eventType === 'error')

  const executionTimes = executions
    .map(e => e.metadata?.duration || e.metadata?.executionTime)
    .filter(t => typeof t === 'number' && t > 0)

  return {
    totalActions: io.getAll().length,
    totalCalls: calls.length,
    totalExecutions: executions.length,
    totalErrors: errors.length,
    successRate:
      calls.length > 0 ? (calls.length - errors.length) / calls.length : 1,
    averageLatency:
      executionTimes.length > 0
        ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
        : 0,
    callRate: systemStats.callRate || 0,
    uptime: Date.now() - systemStats.startTime,
    stress: breathing.stress || 0
  }
}

function analyzeChannels(
  events: RawMetricEvent[],
  allChannels: any[]
): ChannelAnalysis[] {
  return allChannels.map(channel => {
    const channelEvents = events.filter(e => e.actionId === channel.id)
    const calls = channelEvents.filter(e => e.eventType === 'call')
    const executions = channelEvents.filter(e => e.eventType === 'execution')
    const errors = channelEvents.filter(e => e.eventType === 'error')

    const protections = {
      throttled: channelEvents.filter(e => e.eventType === 'throttle').length,
      debounced: channelEvents.filter(e => e.eventType === 'debounce').length,
      blocked: channelEvents.filter(e => e.eventType === 'blocked').length,
      skipped: channelEvents.filter(e => e.eventType === 'skip').length
    }

    const executionTimes = executions
      .map(e => e.metadata?.duration || e.metadata?.executionTime)
      .filter(t => typeof t === 'number' && t > 0)

    const avgLatency =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
        : 0

    const successRate =
      calls.length > 0 ? (calls.length - errors.length) / calls.length : 1
    const lastActivity = Math.max(...channelEvents.map(e => e.timestamp), 0)

    // Determine status
    let status: ChannelAnalysis['status'] = 'healthy'
    const issues: string[] = []

    if (calls.length === 0) {
      status = 'inactive'
      issues.push('No activity recorded')
    } else {
      if (successRate < 0.8) {
        status = 'critical'
        issues.push(`Low success rate: ${(successRate * 100).toFixed(1)}%`)
      } else if (successRate < 0.95) {
        status = status === 'critical' ? 'critical' : 'warning'
        issues.push(`Moderate success rate: ${(successRate * 100).toFixed(1)}%`)
      }

      if (avgLatency > 500) {
        status = 'critical'
        issues.push(`Very high latency: ${avgLatency.toFixed(1)}ms`)
      } else if (avgLatency > 100) {
        status = status === 'critical' ? 'critical' : 'warning'
        issues.push(`High latency: ${avgLatency.toFixed(1)}ms`)
      }

      if (errors.length > calls.length * 0.1) {
        status = 'critical'
        issues.push(`High error count: ${errors.length}`)
      }
    }

    return {
      id: channel.id,
      calls: calls.length,
      executions: executions.length,
      errors: errors.length,
      successRate,
      averageLatency: avgLatency,
      lastActivity,
      status,
      issues,
      protections
    }
  })
}

function detectPatterns(events: RawMetricEvent[]): PatternAnalysis {
  // Analyze frequent errors
  const errorEvents = events.filter(e => e.eventType === 'error')
  const errorCounts = errorEvents.reduce((acc, event) => {
    const error = event.metadata?.error || 'Unknown error'
    if (!acc[error]) {
      acc[error] = {count: 0, channels: new Set<string>()}
    }
    acc[error].count++
    acc[error].channels.add(event.actionId)
    return acc
  }, {} as Record<string, {count: number; channels: Set<string>}>)

  const frequentErrors = Object.entries(errorCounts)
    .map(([error, data]) => ({
      error,
      count: data.count,
      channels: Array.from(data.channels)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Detect bottlenecks
  const executionEvents = events.filter(
    e => e.eventType === 'execution' && e.metadata?.duration
  )
  const channelLatencies = executionEvents.reduce((acc, event) => {
    const duration = event.metadata?.duration || 0
    if (!acc[event.actionId]) {
      acc[event.actionId] = []
    }
    acc[event.actionId].push(duration)
    return acc
  }, {} as Record<string, number[]>)

  const bottlenecks = Object.entries(channelLatencies)
    .map(([channel, latencies]) => {
      const avgLatency =
        latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      let issue = 'High average latency'

      if (avgLatency > 1000) issue = 'Very slow execution'
      else if (avgLatency > 500) issue = 'Slow execution'
      else if (avgLatency > 100) issue = 'Moderate latency'

      return {channel, avgLatency, issue}
    })
    .filter(b => b.avgLatency > 50)
    .sort((a, b) => b.avgLatency - a.avgLatency)
    .slice(0, 10)

  // Simple trend detection (placeholder)
  const trends = [
    {metric: 'call_rate', direction: 'stable' as const, confidence: 0.8},
    {metric: 'error_rate', direction: 'decreasing' as const, confidence: 0.6}
  ]

  return {
    frequentErrors,
    bottlenecks,
    spikes: [], // Placeholder
    trends
  }
}

function analyzeErrors(events: RawMetricEvent[]): ErrorAnalysis {
  const errorEvents = events.filter(e => e.eventType === 'error')
  const totalEvents = events.length

  const errorsByType = errorEvents.reduce((acc, event) => {
    const error = event.metadata?.error || 'Unknown error'
    acc[error] = (acc[error] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const errorsByChannel = errorEvents.reduce((acc, event) => {
    acc[event.actionId] = (acc[event.actionId] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const recentErrors = errorEvents
    .filter(e => Date.now() - e.timestamp < 3600000) // Last hour
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)
    .map(event => ({
      timestamp: event.timestamp,
      channel: event.actionId,
      error: event.metadata?.error || 'Unknown error',
      location: event.location || 'unknown'
    }))

  // Identify critical errors (frequent in last hour)
  const hourAgo = Date.now() - 3600000
  const recentErrorCounts = errorEvents
    .filter(e => e.timestamp > hourAgo)
    .reduce((acc, event) => {
      const key = `${event.actionId}:${event.metadata?.error || 'Unknown'}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const criticalErrors = Object.entries(recentErrorCounts)
    .filter(([, count]) => count >= 3) // 3+ times in last hour
    .map(([key, frequency]) => {
      const [channel, error] = key.split(':')
      return {
        timestamp: Date.now(),
        channel,
        error,
        frequency
      }
    })
    .sort((a, b) => b.frequency - a.frequency)

  return {
    totalErrors: errorEvents.length,
    errorRate: totalEvents > 0 ? errorEvents.length / totalEvents : 0,
    errorsByType,
    errorsByChannel,
    recentErrors,
    criticalErrors
  }
}

function analyzeSystemHealth(
  summary: PerformanceSummary,
  channels: ChannelAnalysis[],
  breathing: any
): SystemHealthAnalysis {
  // Determine overall health
  let overall: SystemHealthAnalysis['overall'] = 'healthy'

  if (
    summary.successRate < 0.8 ||
    summary.stress > 0.9 ||
    breathing.stress > 0.9
  ) {
    overall = 'critical'
  } else if (
    summary.successRate < 0.95 ||
    summary.stress > 0.7 ||
    summary.averageLatency > 100
  ) {
    overall = 'degraded'
  }

  // Categorize channels by performance
  const slowChannels = channels
    .filter(ch => ch.averageLatency > 100 && ch.calls > 0)
    .sort((a, b) => b.averageLatency - a.averageLatency)
    .slice(0, 5)
    .map(ch => ch.id)

  const fastChannels = channels
    .filter(
      ch => ch.averageLatency < 20 && ch.successRate > 0.98 && ch.calls > 0
    )
    .sort((a, b) => a.averageLatency - b.averageLatency)
    .slice(0, 5)
    .map(ch => ch.id)

  const avgResponseTime =
    channels
      .filter(ch => ch.calls > 0)
      .reduce((sum, ch) => sum + ch.averageLatency, 0) /
    Math.max(1, channels.filter(ch => ch.calls > 0).length)

  // Estimate memory usage
  const eventCount = metricsReport.exportEvents().length
  const channelCount = channels.length
  const timerCount = timeline.getAll().length
  const estimatedMB =
    (channelCount * 2 + timerCount * 1 + eventCount * 0.5) / 1024

  return {
    overall,
    breathing: {
      status:
        breathing.stress > 0.8
          ? 'recuperating'
          : breathing.stress > 0.6
          ? 'stressed'
          : 'normal',
      rate: breathing.currentRate || 200,
      stress: breathing.stress || 0
    },
    memory: {
      channels: channelCount,
      timers: timerCount,
      events: eventCount,
      estimated: `${estimatedMB.toFixed(1)}MB`
    },
    performance: {
      slowChannels,
      fastChannels,
      averageResponseTime: avgResponseTime
    }
  }
}

function generateAlerts(
  summary: PerformanceSummary,
  channels: ChannelAnalysis[],
  errors: ErrorAnalysis,
  health: SystemHealthAnalysis
): Alert[] {
  const alerts: Alert[] = []
  const now = Date.now()

  // System-level alerts
  if (summary.successRate < 0.8) {
    alerts.push({
      severity: 'critical',
      type: 'system',
      message: `System success rate critically low: ${(
        summary.successRate * 100
      ).toFixed(1)}%`,
      metric: 'success_rate',
      value: summary.successRate,
      threshold: 0.8,
      timestamp: now
    })
  }

  if (summary.stress > 0.9) {
    alerts.push({
      severity: 'critical',
      type: 'system',
      message: `System stress critically high: ${(summary.stress * 100).toFixed(
        1
      )}%`,
      metric: 'stress',
      value: summary.stress,
      threshold: 0.9,
      timestamp: now
    })
  }

  if (summary.averageLatency > 500) {
    alerts.push({
      severity: 'high',
      type: 'performance',
      message: `Average latency very high: ${summary.averageLatency.toFixed(
        1
      )}ms`,
      metric: 'latency',
      value: summary.averageLatency,
      threshold: 500,
      timestamp: now
    })
  }

  // Channel-level alerts
  channels.forEach(channel => {
    if (channel.status === 'critical') {
      alerts.push({
        severity: 'high',
        type: 'performance',
        message: `Channel in critical state: ${channel.issues.join(', ')}`,
        channel: channel.id,
        timestamp: now
      })
    }
  })

  // Error alerts
  if (errors.errorRate > 0.1) {
    alerts.push({
      severity: 'high',
      type: 'error',
      message: `Error rate very high: ${(errors.errorRate * 100).toFixed(2)}%`,
      metric: 'error_rate',
      value: errors.errorRate,
      threshold: 0.1,
      timestamp: now
    })
  }

  errors.criticalErrors.forEach(error => {
    alerts.push({
      severity: 'medium',
      type: 'error',
      message: `Frequent errors in channel: ${error.error} (${error.frequency}x)`,
      channel: error.channel,
      timestamp: now
    })
  })

  return alerts.sort(
    (a, b) => alertSeverityOrder(b.severity) - alertSeverityOrder(a.severity)
  )
}

function generateRecommendations(
  summary: PerformanceSummary,
  channels: ChannelAnalysis[],
  patterns: PatternAnalysis,
  errors: ErrorAnalysis
): string[] {
  const recommendations: string[] = []

  // Performance recommendations
  if (summary.averageLatency > 100) {
    recommendations.push(
      `Consider optimizing slow channels - average latency is ${summary.averageLatency.toFixed(
        1
      )}ms`
    )
  }

  if (summary.successRate < 0.95) {
    recommendations.push(
      `Investigate failing channels - success rate is ${(
        summary.successRate * 100
      ).toFixed(1)}%`
    )
  }

  // Channel-specific recommendations
  const criticalChannels = channels.filter(ch => ch.status === 'critical')
  if (criticalChannels.length > 0) {
    recommendations.push(
      `${criticalChannels.length} channels need immediate attention`
    )
  }

  const highLatencyChannels = channels.filter(
    ch => ch.averageLatency > 200 && ch.calls > 0
  )
  if (highLatencyChannels.length > 0) {
    recommendations.push(
      `Consider adding throttling to ${highLatencyChannels.length} slow channels`
    )
  }

  // Error-based recommendations
  if (errors.errorRate > 0.05) {
    recommendations.push(
      `High error rate detected - review error handling patterns`
    )
  }

  const topErrorChannels = Object.entries(errors.errorsByChannel)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  if (topErrorChannels.length > 0) {
    recommendations.push(
      `Focus on error reduction in: ${topErrorChannels
        .map(([ch]) => ch)
        .join(', ')}`
    )
  }

  // Protection recommendations
  const unprotectedChannels = channels.filter(
    ch =>
      ch.calls > 10 &&
      ch.protections.throttled === 0 &&
      ch.protections.debounced === 0 &&
      ch.averageLatency > 50
  )

  if (unprotectedChannels.length > 0) {
    recommendations.push(
      `Consider adding protection (throttle/debounce) to ${unprotectedChannels.length} high-traffic channels`
    )
  }

  // Pattern-based recommendations
  patterns.frequentErrors.slice(0, 3).forEach(errorPattern => {
    if (errorPattern.count > 5) {
      recommendations.push(
        `Address recurring error: "${errorPattern.error}" affecting ${errorPattern.channels.length} channels`
      )
    }
  })

  // System-level recommendations
  if (summary.stress > 0.7) {
    recommendations.push(
      `System stress is high - consider implementing circuit breakers or rate limiting`
    )
  }

  if (
    summary.totalActions > 100 &&
    channels.filter(ch => ch.calls === 0).length > summary.totalActions * 0.3
  ) {
    recommendations.push(
      `Many inactive channels detected - consider cleanup to improve performance`
    )
  }

  return recommendations.slice(0, 10) // Limit to top 10
}

// Utility functions
function alertSeverityOrder(severity: Alert['severity']): number {
  const order = {critical: 4, high: 3, medium: 2, low: 1}
  return order[severity] || 0
}

function getAlertIcon(severity: Alert['severity']): string {
  const icons = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵'
  }
  return icons[severity] || '⚪'
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

// Export types for external usage
export type {
  AnalysisResult,
  PerformanceSummary,
  ChannelAnalysis,
  PatternAnalysis,
  ErrorAnalysis,
  Alert,
  SystemHealthAnalysis
}
