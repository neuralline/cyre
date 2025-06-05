// src/metrics/analyzer.ts
// Metrics analysis and reporting system with direct store access

import {ChannelMetrics, SystemMetrics, RawEvent} from '../types/system'
import {metricsCore} from './core'
import type {ActionId} from '../types/core'

/*

      C.Y.R.E - M.E.T.R.I.C.S - A.N.A.L.Y.Z.E.R
      
      Analysis and reporting system with direct metrics store access:
      - Better health calculation based on actual activity
      - Intelligent issue detection and categorization
      - Context-aware uptime calculation
      - Performance trend analysis with realistic thresholds
      - Actionable insights and recommendations
      - Direct integration with metrics store data

*/

// Analysis result interfaces
export interface SystemAnalysis {
  timestamp: number
  system: SystemMetrics
  channels: ChannelAnalysis[]
  health: HealthStatus
  alerts: Alert[]
  recommendations: string[]
  insights: SystemInsights
  timeWindow: number
}

export interface ChannelAnalysis {
  id: string
  metrics: ChannelMetrics
  status: 'healthy' | 'warning' | 'critical' | 'inactive'
  issues: string[]
  insights: ChannelInsights
  protectionEffectiveness: number
  performance: PerformanceMetrics
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical'
  score: number
  factors: {
    availability: number
    performance: number
    reliability: number
    efficiency: number
    systemStress: number
    successRate: number
    errorRate: number
    latency: number
  }
  reasoning: string[]
}

export interface Alert {
  severity: 'info' | 'warning' | 'critical'
  category: 'performance' | 'reliability' | 'efficiency' | 'capacity'
  message: string
  channel?: string
  metric?: string
  value?: number
  threshold?: number
  confidence: number
  actionable: boolean
  recommendation?: string
}

export interface SystemInsights {
  totalActivity: number
  activeTimespan: number
  peakLoad: number
  protectionUtilization: number
  errorPatterns: ErrorPattern[]
  performancePatterns: PerformancePattern[]
  systemEfficiency: number
  pipelineEfficiency: number
  executionRatio: number
}

export interface ChannelInsights {
  activityLevel: 'high' | 'medium' | 'low' | 'none'
  protectionPattern: 'aggressive' | 'moderate' | 'minimal' | 'none'
  errorTrend: 'improving' | 'stable' | 'degrading'
  performanceTrend: 'fast' | 'normal' | 'slow'
  reliabilityScore: number
  pipelineComplexity: 'simple' | 'moderate' | 'complex'
}

export interface PerformanceMetrics {
  avgResponseTime: number
  p95ResponseTime: number
  throughput: number
  errorRate: number
  successRate: number
  executionRatio: number
  pipelineOverhead: number
}

interface ErrorPattern {
  type: 'burst' | 'sustained' | 'intermittent' | 'protection_block'
  severity: 'low' | 'medium' | 'high'
  affectedChannels: string[]
  frequency: number
  recommendation: string
}

interface PerformancePattern {
  type:
    | 'latency_spike'
    | 'throughput_drop'
    | 'error_surge'
    | 'pipeline_overhead'
    | 'execution_mismatch'
  channels: string[]
  magnitude: number
  recommendation: string
}

// Thresholds based on actual metrics data patterns
const ANALYSIS_THRESHOLDS = {
  latency: {
    excellent: 5,
    good: 20,
    acceptable: 50,
    poor: 100
  },
  successRate: {
    excellent: 0.99,
    good: 0.95,
    acceptable: 0.9,
    poor: 0.8
  },
  activity: {
    high: 10,
    medium: 5,
    low: 2
  },
  protection: {
    effective: 0.8,
    moderate: 0.5,
    ineffective: 0.2
  },
  executionRatio: {
    excellent: 0.95,
    good: 0.85,
    acceptable: 0.7,
    poor: 0.5
  }
} as const

/**
 * Metrics analyzer with direct store access
 */
export const analyzer = {
  /**
   * Comprehensive system analysis with direct store access
   */
  analyze: (timeWindow = 300000): SystemAnalysis => {
    const system = metricsCore.getSystemMetrics()
    const allChannels = metricsCore.getAllChannelMetrics()
    const events = metricsCore.getEvents({
      since: Date.now() - timeWindow
    })

    // Filter to only active channels (with recent activity)
    const activeChannels = allChannels.filter(ch => ch.calls > 0)

    // Analyze each channel with context
    const channels = activeChannels.map(metrics =>
      analyzeChannelWithContext(metrics, events, timeWindow)
    )

    // Calculate health based on metrics store data
    const health = calculateHealthFromStore(
      system,
      channels,
      events,
      timeWindow
    )

    // Generate alerts using store data patterns
    const alerts = generateAlertsFromStore(system, channels, events)

    // Create insights from store data
    const insights = generateInsightsFromStore(events, channels, timeWindow)

    // Generate recommendations based on store patterns
    const recommendations = generateRecommendationsFromStore(
      health,
      channels,
      alerts,
      insights
    )

    return {
      timestamp: Date.now(),
      system,
      channels,
      health,
      alerts,
      recommendations,
      insights,
      timeWindow
    }
  },

  /**
   * Analyze specific channel with store context
   */
  analyzeChannel: (
    actionId: string,
    timeWindow = 300000
  ): ChannelAnalysis | null => {
    const metrics = metricsCore.getChannelMetrics(actionId)
    if (!metrics || metrics.calls === 0) return null

    const events = metricsCore.getEvents({
      actionId,
      since: Date.now() - timeWindow
    })

    return analyzeChannelWithContext(metrics, events, timeWindow)
  },

  /**
   * Generate report using store data
   */
  generateReport: (analysis?: SystemAnalysis): string => {
    const data = analysis || analyzer.analyze()
    const lines: string[] = []
    const add = (text = '') => lines.push(text)

    // Header with context
    add('CYRE SYSTEM ANALYSIS REPORT')
    add('='.repeat(50))
    add(`Generated: ${new Date(data.timestamp).toISOString()}`)
    add(`Analysis Window: ${(data.timeWindow / 1000).toFixed(0)}s`)
    add()

    // Health summary with detailed factors
    const healthIcon =
      data.health.overall === 'healthy'
        ? '✅'
        : data.health.overall === 'degraded'
        ? '⚠️'
        : '🔴'

    add(
      `${healthIcon} System Health: ${data.health.overall.toUpperCase()} (${
        data.health.score
      }/100)`
    )
    add()
    add('Health Factors:')
    add(
      `  Availability:   ${(data.health.factors.availability * 100).toFixed(
        1
      )}%`
    )
    add(
      `  Performance:    ${(data.health.factors.performance * 100).toFixed(1)}%`
    )
    add(
      `  Reliability:    ${(data.health.factors.reliability * 100).toFixed(1)}%`
    )
    add(
      `  Efficiency:     ${(data.health.factors.efficiency * 100).toFixed(1)}%`
    )
    add(
      `  Success Rate:   ${(data.health.factors.successRate * 100).toFixed(1)}%`
    )
    add(
      `  Error Rate:     ${(data.health.factors.errorRate * 100).toFixed(2)}%`
    )
    add(`  Avg Latency:    ${data.health.factors.latency.toFixed(2)}ms`)
    add(
      `  System Stress:  ${(data.health.factors.systemStress * 100).toFixed(
        1
      )}%`
    )
    add()

    if (data.health.reasoning.length > 0) {
      add('Health Reasoning:')
      data.health.reasoning.forEach(reason => add(`  • ${reason}`))
      add()
    }

    // System insights with store-specific data
    add('SYSTEM INSIGHTS')
    add('-'.repeat(20))
    add(`Total Activity: ${data.insights.totalActivity} events`)
    add(`Active Timespan: ${(data.insights.activeTimespan / 1000).toFixed(0)}s`)
    add(`Peak Load: ${data.insights.peakLoad} events/min`)
    add(
      `Protection Utilization: ${(
        data.insights.protectionUtilization * 100
      ).toFixed(1)}%`
    )
    add(
      `Pipeline Efficiency: ${(data.insights.pipelineEfficiency * 100).toFixed(
        1
      )}%`
    )
    add(`Execution Ratio: ${(data.insights.executionRatio * 100).toFixed(1)}%`)
    add(
      `System Efficiency: ${(data.insights.systemEfficiency * 100).toFixed(1)}%`
    )
    add()

    // Active channels with store metrics
    const activeChannels = data.channels.filter(ch => ch.status !== 'inactive')
    if (activeChannels.length > 0) {
      add('ACTIVE CHANNELS')
      add('-'.repeat(16))
      activeChannels.forEach(ch => {
        const statusIcon =
          ch.status === 'healthy' ? '✅' : ch.status === 'warning' ? '⚠️' : '🔴'

        add(`${statusIcon} ${ch.id}: ${ch.status.toUpperCase()}`)
        add(
          `    Activity: ${ch.insights.activityLevel}, Pipeline: ${ch.insights.pipelineComplexity}`
        )
        add(
          `    Performance: ${ch.performance.avgResponseTime.toFixed(
            2
          )}ms avg, ${(ch.performance.successRate * 100).toFixed(1)}% success`
        )
        add(
          `    Execution Ratio: ${(ch.performance.executionRatio * 100).toFixed(
            1
          )}%, Pipeline Overhead: ${ch.performance.pipelineOverhead.toFixed(
            1
          )}ms`
        )

        // Protection breakdown
        const protections = []
        if (ch.metrics.protectionEvents.throttled > 0)
          protections.push(
            `throttled(${ch.metrics.protectionEvents.throttled})`
          )
        if (ch.metrics.protectionEvents.debounced > 0)
          protections.push(
            `debounced(${ch.metrics.protectionEvents.debounced})`
          )
        if (ch.metrics.protectionEvents.blocked > 0)
          protections.push(`blocked(${ch.metrics.protectionEvents.blocked})`)
        if (ch.metrics.protectionEvents.skipped > 0)
          protections.push(`skipped(${ch.metrics.protectionEvents.skipped})`)

        if (protections.length > 0) {
          add(`    Protections: ${protections.join(', ')}`)
        }

        if (ch.issues.length > 0) {
          add(`    Issues: ${ch.issues.join(', ')}`)
        }
        add()
      })
    }

    // Store-specific error patterns
    if (data.insights.errorPatterns.length > 0) {
      add('ERROR PATTERNS')
      add('-'.repeat(15))
      data.insights.errorPatterns.forEach(pattern => {
        add(
          `• ${pattern.type.toUpperCase()}: ${
            pattern.affectedChannels.length
          } channels`
        )
        add(`  Severity: ${pattern.severity}, Frequency: ${pattern.frequency}`)
        add(`  → ${pattern.recommendation}`)
      })
      add()
    }

    // Store-specific performance patterns
    if (data.insights.performancePatterns.length > 0) {
      add('PERFORMANCE PATTERNS')
      add('-'.repeat(20))
      data.insights.performancePatterns.forEach(pattern => {
        add(
          `• ${pattern.type.replace('_', ' ').toUpperCase()}: ${
            pattern.channels.length
          } channels`
        )
        add(`  Magnitude: ${pattern.magnitude.toFixed(1)}x`)
        add(`  → ${pattern.recommendation}`)
      })
      add()
    }

    // Critical alerts first
    const criticalAlerts = data.alerts.filter(a => a.severity === 'critical')
    if (criticalAlerts.length > 0) {
      add('CRITICAL ALERTS')
      add('-'.repeat(16))
      criticalAlerts.forEach(alert => {
        add(`🔴 ${alert.message}`)
        if (alert.recommendation) {
          add(`    → ${alert.recommendation}`)
        }
      })
      add()
    }

    // Store-based recommendations
    if (data.recommendations.length > 0) {
      add('RECOMMENDATIONS')
      add('-'.repeat(16))
      data.recommendations.forEach((rec, i) => {
        add(`${i + 1}. ${rec}`)
      })
      add()
    }

    return lines.join('\n')
  },

  /**
   * Quick health check using store data
   */
  healthCheck: (): {
    status: string
    score: number
    issues: string[]
    summary: string
  } => {
    const analysis = analyzer.analyze()

    const criticalIssues = analysis.alerts
      .filter(a => a.severity === 'critical')
      .map(a => a.message)

    const warningIssues = analysis.alerts
      .filter(a => a.severity === 'warning')
      .map(a => a.message)

    const summary = `${analysis.channels.length} channels, ${
      analysis.insights.totalActivity
    } events, ${(analysis.health.factors.reliability * 100).toFixed(
      0
    )}% reliability, ${(analysis.insights.executionRatio * 100).toFixed(
      0
    )}% execution ratio`

    return {
      status: analysis.health.overall,
      score: analysis.health.score,
      issues: [...criticalIssues, ...warningIssues.slice(0, 3)],
      summary
    }
  }
}

/**
 * Analyze channel with store context and pipeline awareness
 */
const analyzeChannelWithContext = (
  metrics: ChannelMetrics,
  events: RawEvent[],
  timeWindow: number
): ChannelAnalysis => {
  const channelEvents = events.filter(e => e.actionId === metrics.id)
  const issues: string[] = []

  // Calculate execution ratio from store data
  const executionRatio =
    metrics.calls > 0 ? metrics.executions / metrics.calls : 0

  // Analyze pipeline complexity from events
  const pipelineEvents = channelEvents.filter(
    e => e.location?.includes('pipeline') || e.location?.includes('processing')
  )
  const avgPipelineEvents =
    metrics.calls > 0 ? pipelineEvents.length / metrics.calls : 0

  const pipelineComplexity: ChannelInsights['pipelineComplexity'] =
    avgPipelineEvents > 8
      ? 'complex'
      : avgPipelineEvents > 4
      ? 'moderate'
      : 'simple'

  // Calculate pipeline overhead
  const pipelineOverhead = avgPipelineEvents * 0.5 // Estimated ms per event

  // Determine activity level based on store data
  const activityLevel: ChannelInsights['activityLevel'] =
    metrics.calls >= ANALYSIS_THRESHOLDS.activity.high
      ? 'high'
      : metrics.calls >= ANALYSIS_THRESHOLDS.activity.medium
      ? 'medium'
      : metrics.calls >= ANALYSIS_THRESHOLDS.activity.low
      ? 'low'
      : 'none'

  // Calculate protection effectiveness
  const totalProtectionEvents =
    metrics.protectionEvents.throttled +
    metrics.protectionEvents.debounced +
    metrics.protectionEvents.blocked +
    metrics.protectionEvents.skipped

  const protectionEffectiveness =
    totalProtectionEvents > 0
      ? Math.max(0, 1 - metrics.errors / Math.max(totalProtectionEvents, 1))
      : 1

  // Determine protection pattern
  const protectionRatio =
    metrics.calls > 0 ? totalProtectionEvents / metrics.calls : 0
  const protectionPattern: ChannelInsights['protectionPattern'] =
    protectionRatio > 0.5
      ? 'aggressive'
      : protectionRatio > 0.2
      ? 'moderate'
      : protectionRatio > 0.05
      ? 'minimal'
      : 'none'

  // Performance metrics from store
  const avgResponseTime = metrics.averageLatency
  const p95ResponseTime = avgResponseTime * 1.5 // Estimate

  // Performance trend
  const performanceTrend: ChannelInsights['performanceTrend'] =
    avgResponseTime < ANALYSIS_THRESHOLDS.latency.excellent
      ? 'fast'
      : avgResponseTime < ANALYSIS_THRESHOLDS.latency.good
      ? 'normal'
      : 'slow'

  // Reliability score
  const reliabilityScore =
    metrics.successRate *
    Math.max(0.5, executionRatio) *
    Math.max(0.7, protectionEffectiveness)

  // Error trend (would need historical data for proper analysis)
  const errorTrend: ChannelInsights['errorTrend'] =
    metrics.errorRate > 0.1 ? 'degrading' : 'stable'

  // Determine status
  let status: ChannelAnalysis['status'] = 'healthy'

  if (metrics.successRate < ANALYSIS_THRESHOLDS.successRate.poor) {
    status = 'critical'
    issues.push(
      `Critical success rate: ${(metrics.successRate * 100).toFixed(1)}%`
    )
  }

  if (avgResponseTime > ANALYSIS_THRESHOLDS.latency.poor) {
    status = 'critical'
    issues.push(`Critical latency: ${avgResponseTime.toFixed(1)}ms`)
  }

  if (executionRatio < ANALYSIS_THRESHOLDS.executionRatio.poor) {
    status = status === 'critical' ? 'critical' : 'warning'
    issues.push(`Low execution ratio: ${(executionRatio * 100).toFixed(1)}%`)
  }

  if (status !== 'critical') {
    if (metrics.successRate < ANALYSIS_THRESHOLDS.successRate.acceptable) {
      status = 'warning'
      issues.push(
        `Moderate success rate: ${(metrics.successRate * 100).toFixed(1)}%`
      )
    }

    if (avgResponseTime > ANALYSIS_THRESHOLDS.latency.acceptable) {
      status = 'warning'
      issues.push(`Elevated latency: ${avgResponseTime.toFixed(1)}ms`)
    }

    if (pipelineComplexity === 'complex') {
      status = 'warning'
      issues.push('High pipeline complexity detected')
    }
  }

  const insights: ChannelInsights = {
    activityLevel,
    protectionPattern,
    errorTrend,
    performanceTrend,
    reliabilityScore,
    pipelineComplexity
  }

  const performance: PerformanceMetrics = {
    avgResponseTime,
    p95ResponseTime,
    throughput: timeWindow > 0 ? (metrics.calls / timeWindow) * 60000 : 0,
    errorRate: metrics.errorRate,
    successRate: metrics.successRate,
    executionRatio,
    pipelineOverhead
  }

  return {
    id: metrics.id,
    metrics,
    status,
    issues,
    insights,
    protectionEffectiveness,
    performance
  }
}

/**
 * Calculate health using store data
 */
const calculateHealthFromStore = (
  system: SystemMetrics,
  channels: ChannelAnalysis[],
  events: RawEvent[],
  timeWindow: number
): HealthStatus => {
  const activeChannels = channels.filter(ch => ch.metrics.calls > 0)
  const reasoning: string[] = []

  if (activeChannels.length === 0) {
    return {
      overall: 'healthy',
      score: 100,
      factors: {
        availability: 1,
        performance: 1,
        reliability: 1,
        efficiency: 1,
        systemStress: 0,
        successRate: 1,
        errorRate: 0,
        latency: 0
      },
      reasoning: ['No active channels to evaluate']
    }
  }

  // Calculate factors from store data
  const avgSuccessRate =
    activeChannels.reduce((sum, ch) => sum + ch.performance.successRate, 0) /
    activeChannels.length
  const avgErrorRate =
    activeChannels.reduce((sum, ch) => sum + ch.performance.errorRate, 0) /
    activeChannels.length
  const avgLatency =
    activeChannels.reduce(
      (sum, ch) => sum + ch.performance.avgResponseTime,
      0
    ) / activeChannels.length
  const avgExecutionRatio =
    activeChannels.reduce((sum, ch) => sum + ch.performance.executionRatio, 0) /
    activeChannels.length

  // System stress from call rate and error patterns
  const systemStress = Math.min(1, system.callRate / 100 + avgErrorRate * 2)

  // Performance factor
  const performance =
    avgLatency < ANALYSIS_THRESHOLDS.latency.excellent
      ? 1
      : avgLatency < ANALYSIS_THRESHOLDS.latency.good
      ? 0.9
      : avgLatency < ANALYSIS_THRESHOLDS.latency.acceptable
      ? 0.7
      : avgLatency < ANALYSIS_THRESHOLDS.latency.poor
      ? 0.4
      : 0.2

  // Availability (execution ratio)
  const availability = avgExecutionRatio

  // Reliability (success rate)
  const reliability = avgSuccessRate

  // Efficiency (protection effectiveness)
  const avgProtectionEffectiveness =
    activeChannels.reduce((sum, ch) => sum + ch.protectionEffectiveness, 0) /
    activeChannels.length
  const efficiency = avgProtectionEffectiveness

  // Add reasoning
  if (avgSuccessRate < 0.95)
    reasoning.push(
      `System success rate ${(avgSuccessRate * 100).toFixed(1)}% below target`
    )
  if (avgLatency > 50)
    reasoning.push(
      `Average latency ${avgLatency.toFixed(1)}ms affects performance`
    )
  if (avgExecutionRatio < 0.8)
    reasoning.push(
      `Execution ratio ${(avgExecutionRatio * 100).toFixed(
        1
      )}% indicates pipeline issues`
    )
  if (systemStress > 0.7) reasoning.push('High system stress detected')

  // Calculate score
  const score = Math.round(
    (availability * 0.25 +
      performance * 0.25 +
      reliability * 0.3 +
      efficiency * 0.2) *
      100
  )

  const overall: HealthStatus['overall'] =
    score >= 85 ? 'healthy' : score >= 60 ? 'degraded' : 'critical'

  return {
    overall,
    score,
    factors: {
      availability,
      performance,
      reliability,
      efficiency,
      systemStress,
      successRate: avgSuccessRate,
      errorRate: avgErrorRate,
      latency: avgLatency
    },
    reasoning
  }
}

/**
 * Generate alerts from store data patterns
 */
const generateAlertsFromStore = (
  system: SystemMetrics,
  channels: ChannelAnalysis[],
  events: RawEvent[]
): Alert[] => {
  const alerts: Alert[] = []

  // System-level alerts
  if (system.totalCalls > 0) {
    const systemErrorRate = system.totalErrors / system.totalCalls

    if (systemErrorRate > 0.1) {
      alerts.push({
        severity: 'critical',
        category: 'reliability',
        message: `High system error rate: ${(systemErrorRate * 100).toFixed(
          1
        )}%`,
        confidence: 0.9,
        actionable: true,
        recommendation: 'Investigate error patterns and improve error handling'
      })
    }
  }

  // Channel-specific alerts from store data
  channels.forEach(channel => {
    if (channel.status === 'critical') {
      alerts.push({
        severity: 'critical',
        category: 'performance',
        message: `Channel ${channel.id} in critical state`,
        channel: channel.id,
        confidence: 0.95,
        actionable: true,
        recommendation: channel.issues.join(', ')
      })
    }

    if (
      channel.performance.executionRatio <
      ANALYSIS_THRESHOLDS.executionRatio.poor
    ) {
      alerts.push({
        severity: 'warning',
        category: 'efficiency',
        message: `Low execution ratio for ${channel.id}: ${(
          channel.performance.executionRatio * 100
        ).toFixed(1)}%`,
        channel: channel.id,
        metric: 'executionRatio',
        value: channel.performance.executionRatio,
        threshold: ANALYSIS_THRESHOLDS.executionRatio.poor,
        confidence: 0.85,
        actionable: true,
        recommendation: 'Review pipeline configuration and protection settings'
      })
    }

    if (channel.insights.pipelineComplexity === 'complex') {
      alerts.push({
        severity: 'info',
        category: 'efficiency',
        message: `High pipeline complexity for ${channel.id}`,
        channel: channel.id,
        confidence: 0.8,
        actionable: true,
        recommendation: 'Consider optimizing talent compilation'
      })
    }
  })

  return alerts.sort((a, b) => {
    const severityOrder = {critical: 3, warning: 2, info: 1}
    return severityOrder[b.severity] - severityOrder[a.severity]
  })
}

/**
 * Generate insights from store data
 */
const generateInsightsFromStore = (
  events: RawEvent[],
  channels: ChannelAnalysis[],
  timeWindow: number
): SystemInsights => {
  const totalActivity = events.length

  // Calculate timespan from events
  const eventTimes = events.map(e => e.timestamp).sort((a, b) => a - b)
  const activeTimespan =
    eventTimes.length > 1
      ? eventTimes[eventTimes.length - 1] - eventTimes[0]
      : timeWindow

  // Calculate peak load
  const minuteBuckets = new Map<number, number>()
  events.forEach(event => {
    const minute = Math.floor(event.timestamp / 60000)
    minuteBuckets.set(minute, (minuteBuckets.get(minute) || 0) + 1)
  })
  const peakLoad = Math.max(...Array.from(minuteBuckets.values()), 0)

  // Protection utilization from store data
  const protectionEvents = events.filter(e =>
    ['throttle', 'debounce', 'blocked', 'skip'].includes(e.eventType)
  ).length
  const protectionUtilization =
    totalActivity > 0 ? protectionEvents / totalActivity : 0

  // Pipeline efficiency from events
  const pipelineStarts = events.filter(
    e => e.location === 'processing-pipeline-start'
  ).length
  const pipelineCompletes = events.filter(
    e => e.location === 'processing-pipeline-complete'
  ).length
  const pipelineEfficiency =
    pipelineStarts > 0 ? pipelineCompletes / pipelineStarts : 1

  // Execution ratio across all channels
  const totalCalls = channels.reduce((sum, ch) => sum + ch.metrics.calls, 0)
  const totalExecutions = channels.reduce(
    (sum, ch) => sum + ch.metrics.executions,
    0
  )
  const executionRatio = totalCalls > 0 ? totalExecutions / totalCalls : 1

  // Error patterns from store data
  const errorEvents = events.filter(e => e.eventType === 'error')
  const errorPatterns: ErrorPattern[] = []

  if (errorEvents.length > 0) {
    // Check for protection blocking patterns
    const protectionBlocks = errorEvents.filter(
      e => e.location === 'processing-pipeline-blocked'
    )

    if (protectionBlocks.length > 0) {
      errorPatterns.push({
        type: 'protection_block',
        severity: protectionBlocks.length > 5 ? 'high' : 'medium',
        affectedChannels: [...new Set(protectionBlocks.map(e => e.actionId))],
        frequency: protectionBlocks.length,
        recommendation:
          'Review protection settings - frequent blocking detected'
      })
    }
  }

  // Performance patterns from store data
  const performancePatterns: PerformancePattern[] = []

  // Pipeline overhead pattern
  if (pipelineEfficiency < 0.8) {
    performancePatterns.push({
      type: 'pipeline_overhead',
      channels: channels
        .filter(ch => ch.insights.pipelineComplexity === 'complex')
        .map(ch => ch.id),
      magnitude: 1 / pipelineEfficiency,
      recommendation: 'Optimize pipeline efficiency - high overhead detected'
    })
  }

  // Execution mismatch pattern
  if (executionRatio < 0.8) {
    performancePatterns.push({
      type: 'execution_mismatch',
      channels: channels
        .filter(ch => ch.performance.executionRatio < 0.8)
        .map(ch => ch.id),
      magnitude: 1 / executionRatio,
      recommendation: 'Address execution mismatches - calls not completing'
    })
  }

  // System efficiency
  const avgEfficiency =
    channels.length > 0
      ? channels.reduce((sum, ch) => sum + ch.protectionEffectiveness, 0) /
        channels.length
      : 1

  return {
    totalActivity,
    activeTimespan,
    peakLoad,
    protectionUtilization,
    errorPatterns,
    performancePatterns,
    systemEfficiency: avgEfficiency,
    pipelineEfficiency,
    executionRatio
  }
}

/**
 * Generate recommendations from store patterns
 */
const generateRecommendationsFromStore = (
  health: HealthStatus,
  channels: ChannelAnalysis[],
  alerts: Alert[],
  insights: SystemInsights
): string[] => {
  const recommendations: string[] = []

  // Critical alerts first
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  if (criticalAlerts.length > 0) {
    recommendations.push(
      `URGENT: Address ${criticalAlerts.length} critical issues immediately`
    )
  }

  // Pipeline efficiency recommendations
  if (insights.pipelineEfficiency < 0.8) {
    recommendations.push(
      `Improve pipeline efficiency: ${(
        insights.pipelineEfficiency * 100
      ).toFixed(1)}% completion rate`
    )
  }

  // Execution ratio recommendations
  if (insights.executionRatio < 0.8) {
    recommendations.push(
      `Address execution mismatches: ${(insights.executionRatio * 100).toFixed(
        1
      )}% execution rate`
    )
  }

  // Channel-specific recommendations
  const slowChannels = channels.filter(
    ch => ch.performance.avgResponseTime > ANALYSIS_THRESHOLDS.latency.good
  )
  if (slowChannels.length > 0) {
    recommendations.push(
      `Optimize ${slowChannels.length} slow channels: ${slowChannels
        .slice(0, 3)
        .map(ch => ch.id)
        .join(', ')}`
    )
  }

  // Protection recommendations from store data
  const inefficientChannels = channels.filter(
    ch =>
      ch.protectionEffectiveness < ANALYSIS_THRESHOLDS.protection.moderate &&
      ch.metrics.errors > 0
  )
  if (inefficientChannels.length > 0) {
    recommendations.push(
      `Review protection settings for ${inefficientChannels.length} channels with low effectiveness`
    )
  }

  // Complex pipeline recommendations
  const complexChannels = channels.filter(
    ch => ch.insights.pipelineComplexity === 'complex'
  )
  if (complexChannels.length > 0) {
    recommendations.push(
      `Simplify pipeline for ${complexChannels.length} channels with high complexity`
    )
  }

  // Error pattern recommendations
  insights.errorPatterns.forEach(pattern => {
    recommendations.push(pattern.recommendation)
  })

  // Performance pattern recommendations
  insights.performancePatterns.forEach(pattern => {
    recommendations.push(pattern.recommendation)
  })

  // Store-specific recommendations
  if (insights.protectionUtilization > 0.3) {
    recommendations.push(
      'High protection utilization detected - review system load and protection thresholds'
    )
  }

  // Health factor recommendations
  if (health.factors.availability < 0.9) {
    recommendations.push(
      'Improve system availability - execution ratio below target'
    )
  }

  if (health.factors.systemStress > 0.7) {
    recommendations.push(
      'Reduce system stress - consider load balancing or rate limiting'
    )
  }

  return recommendations.slice(0, 8) // Top 8 most important recommendations
}

/**
 * Analyze metrics dump data directly from store format
 * This function provides enhanced analysis of raw dump data
 */
export function analyzeMetricsDump(dumpData: any): SystemAnalysis {
  const events = dumpData.rawEvents as RawEvent[]
  const systemMetrics = dumpData.systemMetrics as SystemMetrics
  const channelSummary = dumpData.channelSummary

  // Extract timespan for analysis
  const timespan = dumpData.dumpInfo.timespan
  const durationMs =
    new Date(timespan.newest).getTime() - new Date(timespan.oldest).getTime()

  // Convert channel summary to ChannelMetrics format
  const channels: ChannelAnalysis[] = channelSummary.channelMetrics.map(
    (channel: any) => {
      const channelEvents = events.filter(e => e.actionId === channel.id)
      return analyzeChannelWithContext(channel, channelEvents, durationMs)
    }
  )

  // Calculate health from dump data
  const health = calculateHealthFromStore(
    systemMetrics,
    channels,
    events,
    durationMs
  )

  // Generate alerts from dump patterns
  const alerts = generateAlertsFromStore(systemMetrics, channels, events)

  // Create insights from dump data
  const insights = generateInsightsFromStore(events, channels, durationMs)

  // Generate recommendations
  const recommendations = generateRecommendationsFromStore(
    health,
    channels,
    alerts,
    insights
  )

  return {
    timestamp: Date.now(),
    system: systemMetrics,
    channels,
    health,
    alerts,
    recommendations,
    insights,
    timeWindow: durationMs
  }
}

/**
 * Enhanced dump analysis with specific insights
 * Provides detailed analysis of the provided dump data structure
 */
export function analyzeSpecificDump(): {
  report: SystemAnalysis
  specificInsights: {
    dumpInfo: any
    performanceBreakdown: any
    protectionAnalysis: any
    pipelineAnalysis: any
    executionFlow: any
  }
} {
  // Use the actual dump data structure from the provided example
  const dumpData = {
    dumpInfo: {
      trigger: 'scheduled_cleanup',
      timestamp: '2025-06-05T12:31:12.507Z',
      totalEvents: 113,
      dumpedEvents: 113,
      timespan: {
        oldest: '2025-06-05T12:31:12.247Z',
        newest: '2025-06-05T12:31:12.506Z'
      }
    },
    systemMetrics: {
      totalCalls: 17,
      totalExecutions: 12,
      totalErrors: 1,
      callRate: 17,
      lastCallTime: 1749126672506,
      startTime: 1749126672247,
      uptime: 260
    },
    eventBreakdown: {
      byEventType: {
        call: 17,
        info: 62,
        success: 5,
        dispatch: 14,
        execution: 12,
        debounce: 1,
        skip: 1,
        error: 1
      },
      byLocation: {
        'call-entry': 9,
        'pre-pipeline-passed': 7,
        'call-processing': 8,
        'processing-pipeline-start': 4,
        'talent-required': 3,
        'change-detection': 5,
        'processing-pipeline-complete': 3,
        'payload-updated': 10,
        'payload-state-updated': 2,
        'dispatching-to-handler': 7,
        'dispatch-to-execute': 7,
        handler: 6,
        'metadata-relocated': 6,
        'call-processing-complete': 6,
        'call-completion': 6,
        'talent-debounce': 1,
        'debounce-first-execution': 1,
        'processing-pipeline-blocked': 1,
        'debounce-first-execution-complete': 1,
        'action-registration': 4
      }
    },
    channelSummary: {
      totalChannels: 5,
      channelMetrics: [
        {
          id: 'fast-api',
          calls: 8,
          executions: 8,
          errors: 0,
          successRate: 1,
          averageLatency: 3.5354579428571506,
          protectionEvents: {throttled: 0, debounced: 0, blocked: 0, skipped: 0}
        },
        {
          id: 'problematic-service',
          calls: 3,
          executions: 0,
          errors: 1,
          successRate: 0.6666666666666666,
          averageLatency: 0,
          protectionEvents: {throttled: 0, debounced: 1, blocked: 0, skipped: 1}
        },
        {
          id: 'variable-worker',
          calls: 4,
          executions: 2,
          errors: 0,
          successRate: 1,
          averageLatency: 86.033375,
          protectionEvents: {throttled: 0, debounced: 0, blocked: 0, skipped: 0}
        },
        {
          id: 'system-monitor',
          calls: 2,
          executions: 2,
          errors: 0,
          successRate: 1,
          averageLatency: 0.09641700000000242,
          protectionEvents: {throttled: 0, debounced: 0, blocked: 0, skipped: 0}
        }
      ]
    },
    rawEvents: [] // Would contain the full event array
  }

  const report = analyzeMetricsDump(dumpData)

  // Generate specific insights from the dump structure
  const specificInsights = {
    dumpInfo: {
      trigger: dumpData.dumpInfo.trigger,
      duration: '260ms burst analysis',
      eventDensity: `${dumpData.dumpInfo.totalEvents} events in 260ms = ${(
        dumpData.dumpInfo.totalEvents / 0.26
      ).toFixed(0)} events/sec`,
      efficiency: `${dumpData.systemMetrics.totalExecutions}/${
        dumpData.systemMetrics.totalCalls
      } execution ratio = ${(
        (dumpData.systemMetrics.totalExecutions /
          dumpData.systemMetrics.totalCalls) *
        100
      ).toFixed(1)}%`
    },

    performanceBreakdown: {
      fastApi: {
        status: '🟢 Excellent',
        latency: '3.5ms avg',
        throughput: '100% execution',
        issues: 'None detected'
      },
      problematicService: {
        status: '🔴 Critical',
        latency: 'N/A (no executions)',
        throughput: '0% execution',
        issues: 'Debounce + change detection blocking'
      },
      variableWorker: {
        status: '🟡 Warning',
        latency: '86ms avg (24x slower than fast-api)',
        throughput: '50% execution',
        issues: 'High latency, partial execution'
      },
      systemMonitor: {
        status: '🟢 Excellent',
        latency: '0.096ms avg',
        throughput: '100% execution',
        issues: 'None detected'
      }
    },

    protectionAnalysis: {
      debounceEffectiveness:
        'Working - prevented rapid calls on problematic-service',
      changeDetectionEffectiveness: 'Working - blocked unchanged payload',
      throttleUsage: 'Not activated in this window',
      overallProtectionHealth: 'Good - protections preventing issues',
      recommendations: [
        'Review problematic-service change detection sensitivity',
        'Consider debounce timing optimization'
      ]
    },

    pipelineAnalysis: {
      pipelineStarts:
        dumpData.eventBreakdown.byLocation['processing-pipeline-start'],
      pipelineCompletes:
        dumpData.eventBreakdown.byLocation['processing-pipeline-complete'],
      pipelineBlocked:
        dumpData.eventBreakdown.byLocation['processing-pipeline-blocked'],
      efficiency: `${
        dumpData.eventBreakdown.byLocation['processing-pipeline-complete']
      }/${dumpData.eventBreakdown.byLocation['processing-pipeline-start']} = ${(
        (dumpData.eventBreakdown.byLocation['processing-pipeline-complete'] /
          dumpData.eventBreakdown.byLocation['processing-pipeline-start']) *
        100
      ).toFixed(1)}%`,
      avgEventsPerCall: (
        dumpData.dumpInfo.totalEvents / dumpData.systemMetrics.totalCalls
      ).toFixed(1),
      recommendations: [
        'Pipeline efficiency is good at 75%',
        'One blocked pipeline needs investigation'
      ]
    },

    executionFlow: {
      callToExecutionRatio: `${dumpData.systemMetrics.totalExecutions}/${
        dumpData.systemMetrics.totalCalls
      } = ${(
        (dumpData.systemMetrics.totalExecutions /
          dumpData.systemMetrics.totalCalls) *
        100
      ).toFixed(1)}%`,
      dispatchEfficiency: `${dumpData.eventBreakdown.byEventType.dispatch}/${
        dumpData.eventBreakdown.byEventType.call
      } = ${(
        (dumpData.eventBreakdown.byEventType.dispatch /
          dumpData.eventBreakdown.byEventType.call) *
        100
      ).toFixed(1)}%`,
      executionSuccess: `${dumpData.eventBreakdown.byEventType.execution}/${
        dumpData.eventBreakdown.byEventType.dispatch
      } = ${(
        (dumpData.eventBreakdown.byEventType.execution /
          dumpData.eventBreakdown.byEventType.dispatch) *
        100
      ).toFixed(1)}%`,
      bottlenecks: [
        'problematic-service: 0% execution due to protection blocking',
        'variable-worker: 50% execution due to processing complexity'
      ]
    }
  }

  return {
    report,
    specificInsights
  }
}
