// src/metrics/analyzer.ts
// Metrics analysis and reporting system

import {metricsCore, type ChannelMetrics, type SystemMetrics} from './core'

/*

      C.Y.R.E - M.E.T.R.I.C.S - A.N.A.L.Y.Z.E.R
      
      Analysis and reporting system:
      - Performance analysis
      - Error detection
      - Health assessment
      - Report generation

*/

// Analysis result interfaces
export interface SystemAnalysis {
  timestamp: number
  system: SystemMetrics
  channels: ChannelAnalysis[]
  health: HealthStatus
  alerts: Alert[]
  recommendations: string[]
}

export interface ChannelAnalysis {
  id: string
  metrics: ChannelMetrics
  status: 'healthy' | 'warning' | 'critical' | 'inactive'
  issues: string[]
  latencyTrend: 'improving' | 'degrading' | 'stable'
  protectionUsage: {
    throttled: number
    debounced: number
    blocked: number
    skipped: number
  }
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical'
  score: number
  factors: {
    successRate: number
    latency: number
    errorRate: number
    systemStress: number
  }
}

export interface Alert {
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'performance' | 'error' | 'system'
  message: string
  channel?: string
  metric?: string
  value?: number
  threshold?: number
  timestamp: number
}

// Analysis thresholds
const THRESHOLDS = {
  successRate: {
    critical: 0.8,
    warning: 0.95
  },
  latency: {
    critical: 500,
    warning: 100
  },
  errorRate: {
    critical: 0.1,
    warning: 0.05
  }
} as const

/**
 * Metrics analyzer
 */
export const analyzer = {
  /**
   * Analyze system performance
   */
  analyze: (timeWindow?: number): SystemAnalysis => {
    const system = metricsCore.getSystemMetrics()
    const allChannels = metricsCore.getAllChannelMetrics()

    // Analyze each channel
    const channels = allChannels.map(metrics =>
      analyzeChannel(metrics, timeWindow)
    )

    // Calculate system health
    const health = calculateHealth(system, channels)

    // Generate alerts
    const alerts = generateAlerts(system, channels)

    // Generate recommendations
    const recommendations = generateRecommendations(system, channels, alerts)

    return {
      timestamp: Date.now(),
      system,
      channels,
      health,
      alerts,
      recommendations
    }
  },

  /**
   * Analyze specific channel
   */
  analyzeChannel: (
    actionId: string,
    timeWindow?: number
  ): ChannelAnalysis | null => {
    const metrics = metricsCore.getChannelMetrics(actionId)
    if (!metrics) return null

    return analyzeChannel(metrics, timeWindow)
  },

  /**
   * Generate text report
   */
  generateReport: (analysis?: SystemAnalysis): string => {
    const data = analysis || analyzer.analyze()

    const lines: string[] = []
    const add = (text = '') => lines.push(text)

    // Header
    add('CYRE METRICS REPORT')
    add('='.repeat(50))
    add(`Generated: ${new Date(data.timestamp).toISOString()}`)
    add(
      `System Health: ${data.health.overall.toUpperCase()} (${
        data.health.score
      }/100)`
    )
    add()

    // System summary
    add('SYSTEM SUMMARY')
    add('-'.repeat(20))
    add(`Total Channels: ${data.channels.length}`)
    add(`Total Calls: ${data.system.totalCalls}`)
    add(`Success Rate: ${(data.health.factors.successRate * 100).toFixed(1)}%`)
    add(`Average Latency: ${data.health.factors.latency.toFixed(2)}ms`)
    add(`Error Rate: ${(data.health.factors.errorRate * 100).toFixed(2)}%`)
    add(`Call Rate: ${data.system.callRate.toFixed(1)}/sec`)
    add()

    // Alerts
    if (data.alerts.length > 0) {
      add('ALERTS')
      add('-'.repeat(10))
      data.alerts.slice(0, 5).forEach(alert => {
        const icon =
          alert.severity === 'critical'
            ? '🔴'
            : alert.severity === 'high'
            ? '🟠'
            : alert.severity === 'medium'
            ? '🟡'
            : '🔵'
        add(`${icon} ${alert.message}`)
        if (alert.channel) add(`    Channel: ${alert.channel}`)
      })
      add()
    }

    // Channel status
    const problematicChannels = data.channels.filter(
      ch => ch.status === 'critical' || ch.status === 'warning'
    )

    if (problematicChannels.length > 0) {
      add('PROBLEMATIC CHANNELS')
      add('-'.repeat(25))
      problematicChannels.forEach(ch => {
        add(`${ch.id}: ${ch.status.toUpperCase()}`)
        ch.issues.forEach(issue => add(`  • ${issue}`))
      })
      add()
    }

    // Recommendations
    if (data.recommendations.length > 0) {
      add('RECOMMENDATIONS')
      add('-'.repeat(20))
      data.recommendations.slice(0, 5).forEach((rec, i) => {
        add(`${i + 1}. ${rec}`)
      })
      add()
    }

    return lines.join('\n')
  },

  /**
   * Quick health check
   */
  healthCheck: (): {status: string; score: number; issues: string[]} => {
    const analysis = analyzer.analyze()
    return {
      status: analysis.health.overall,
      score: analysis.health.score,
      issues: analysis.alerts.map(a => a.message)
    }
  }
}

/**
 * Analyze individual channel
 */
const analyzeChannel = (
  metrics: ChannelMetrics,
  timeWindow?: number
): ChannelAnalysis => {
  const issues: string[] = []
  let status: ChannelAnalysis['status'] = 'healthy'

  // Check activity
  if (metrics.calls === 0) {
    status = 'inactive'
    issues.push('No activity recorded')
  } else {
    // Check success rate
    if (metrics.successRate < THRESHOLDS.successRate.critical) {
      status = 'critical'
      issues.push(
        `Low success rate: ${(metrics.successRate * 100).toFixed(1)}%`
      )
    } else if (metrics.successRate < THRESHOLDS.successRate.warning) {
      status = status === 'critical' ? 'critical' : 'warning'
      issues.push(
        `Moderate success rate: ${(metrics.successRate * 100).toFixed(1)}%`
      )
    }

    // Check latency
    if (metrics.averageLatency > THRESHOLDS.latency.critical) {
      status = 'critical'
      issues.push(`Very high latency: ${metrics.averageLatency.toFixed(1)}ms`)
    } else if (metrics.averageLatency > THRESHOLDS.latency.warning) {
      status = status === 'critical' ? 'critical' : 'warning'
      issues.push(`High latency: ${metrics.averageLatency.toFixed(1)}ms`)
    }

    // Check error count
    if (metrics.errors > metrics.calls * 0.1) {
      status = 'critical'
      issues.push(`High error count: ${metrics.errors}`)
    }
  }

  // Get protection usage
  const events = metricsCore.getEvents({
    actionId: metrics.id,
    since: timeWindow ? Date.now() - timeWindow : undefined
  })

  const protectionUsage = {
    throttled: events.filter(e => e.eventType === 'throttle').length,
    debounced: events.filter(e => e.eventType === 'debounce').length,
    blocked: events.filter(e => e.eventType === 'blocked').length,
    skipped: events.filter(e => e.eventType === 'skip').length
  }

  return {
    id: metrics.id,
    metrics,
    status,
    issues,
    latencyTrend: 'stable', // Could implement trend analysis
    protectionUsage
  }
}

/**
 * Calculate system health
 */
const calculateHealth = (
  system: SystemMetrics,
  channels: ChannelAnalysis[]
): HealthStatus => {
  // Calculate success rate across all channels
  const totalCalls = channels.reduce((sum, ch) => sum + ch.metrics.calls, 0)
  const totalErrors = channels.reduce((sum, ch) => sum + ch.metrics.errors, 0)
  const successRate =
    totalCalls > 0 ? (totalCalls - totalErrors) / totalCalls : 1

  // Calculate average latency
  const activeChannels = channels.filter(ch => ch.metrics.calls > 0)
  const avgLatency =
    activeChannels.length > 0
      ? activeChannels.reduce((sum, ch) => sum + ch.metrics.averageLatency, 0) /
        activeChannels.length
      : 0

  // Calculate error rate
  const errorRate = totalCalls > 0 ? totalErrors / totalCalls : 0

  // Calculate system stress (placeholder)
  const systemStress = Math.min(system.callRate / 100, 1)

  // Calculate overall score
  let score = 100

  if (successRate < THRESHOLDS.successRate.critical) score -= 30
  else if (successRate < THRESHOLDS.successRate.warning) score -= 15

  if (avgLatency > THRESHOLDS.latency.critical) score -= 25
  else if (avgLatency > THRESHOLDS.latency.warning) score -= 10

  if (errorRate > THRESHOLDS.errorRate.critical) score -= 20
  else if (errorRate > THRESHOLDS.errorRate.warning) score -= 10

  if (systemStress > 0.8) score -= 15

  score = Math.max(0, score)

  // Determine overall status
  const overall: HealthStatus['overall'] =
    score >= 90 ? 'healthy' : score >= 70 ? 'degraded' : 'critical'

  return {
    overall,
    score,
    factors: {
      successRate,
      latency: avgLatency,
      errorRate,
      systemStress
    }
  }
}

/**
 * Generate alerts
 */
const generateAlerts = (
  system: SystemMetrics,
  channels: ChannelAnalysis[]
): Alert[] => {
  const alerts: Alert[] = []
  const now = Date.now()

  // System-level alerts
  const health = calculateHealth(system, channels)

  if (health.factors.successRate < THRESHOLDS.successRate.critical) {
    alerts.push({
      severity: 'critical',
      type: 'system',
      message: `System success rate critically low: ${(
        health.factors.successRate * 100
      ).toFixed(1)}%`,
      metric: 'success_rate',
      value: health.factors.successRate,
      threshold: THRESHOLDS.successRate.critical,
      timestamp: now
    })
  }

  if (health.factors.latency > THRESHOLDS.latency.critical) {
    alerts.push({
      severity: 'high',
      type: 'performance',
      message: `Average latency very high: ${health.factors.latency.toFixed(
        1
      )}ms`,
      metric: 'latency',
      value: health.factors.latency,
      threshold: THRESHOLDS.latency.critical,
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

  return alerts
}

/**
 * Generate recommendations
 */
const generateRecommendations = (
  system: SystemMetrics,
  channels: ChannelAnalysis[],
  alerts: Alert[]
): string[] => {
  const recommendations: string[] = []

  const health = calculateHealth(system, channels)

  // Performance recommendations
  if (health.factors.latency > THRESHOLDS.latency.warning) {
    recommendations.push(
      `Consider optimizing slow channels - average latency is ${health.factors.latency.toFixed(
        1
      )}ms`
    )
  }

  if (health.factors.successRate < THRESHOLDS.successRate.warning) {
    recommendations.push(
      `Investigate failing channels - success rate is ${(
        health.factors.successRate * 100
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

  const slowChannels = channels.filter(
    ch =>
      ch.metrics.averageLatency > THRESHOLDS.latency.warning &&
      ch.metrics.calls > 0
  )
  if (slowChannels.length > 0) {
    recommendations.push(
      `Consider adding throttling to ${slowChannels.length} slow channels`
    )
  }

  // Error-based recommendations
  if (health.factors.errorRate > THRESHOLDS.errorRate.warning) {
    recommendations.push(
      'High error rate detected - review error handling patterns'
    )
  }

  return recommendations.slice(0, 10)
}
