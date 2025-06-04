// src/intelligence/metrics-analyzer.ts
// Transform raw metrics into actionable intelligence

import type {ActionPayload} from '../types/core'

/*

      C.Y.R.E - M.E.T.R.I.C.S - A.N.A.L.Y.Z.E.R
      
      Turn raw metrics into actionable insights:
      - Performance bottleneck detection
      - Anomaly pattern recognition
      - Optimization recommendations
      - Health scoring and trending

*/

export interface IntelligentReport {
  // Core metrics
  system: {
    healthScore: number
    trend: 'improving' | 'stable' | 'declining'
    uptime: number
    stress: number
  }

  // Actionable insights
  insights: Array<{
    type: 'performance' | 'error' | 'anomaly' | 'optimization'
    severity: 'info' | 'warning' | 'critical'
    message: string
    channels?: string[]
    recommendation: string
    impact: 'low' | 'medium' | 'high'
  }>

  // Performance analysis
  performance: {
    bottlenecks: Array<{
      channelId: string
      issue: string
      impact: number
      suggestion: string
    }>
    trends: {
      callRate: 'increasing' | 'stable' | 'decreasing'
      errorRate: 'increasing' | 'stable' | 'decreasing'
      latency: 'increasing' | 'stable' | 'decreasing'
    }
  }

  // Predictive analysis
  predictions: Array<{
    type: string
    probability: number
    timeframe: string
    description: string
    prevention: string
  }>

  // Immediate actions
  suggestedActions: Array<{
    priority: 'immediate' | 'soon' | 'eventually'
    action: string
    rationale: string
    impact: string
  }>

  timestamp: number
}

/**
 * Generate intelligent report from raw metrics
 */
export const generateIntelligentReport = (
  metricsReport: any,
  breathingState: any,
  channelsData: any
): IntelligentReport => {
  const insights: any[] = []
  const bottlenecks: any[] = []
  const predictions: any[] = []
  const suggestedActions: any[] = []

  // System health analysis
  const healthScore = calculateSystemHealthScore(metricsReport, breathingState)
  const systemTrend = analyzeSystemTrend(metricsReport, breathingState)

  // Performance analysis
  const performanceInsights = analyzePerformance(metricsReport, channelsData)
  insights.push(...performanceInsights.insights)
  bottlenecks.push(...performanceInsights.bottlenecks)
  suggestedActions.push(...performanceInsights.actions)

  // Error analysis
  const errorInsights = analyzeErrors(metricsReport)
  insights.push(...errorInsights.insights)
  suggestedActions.push(...errorInsights.actions)

  // Anomaly detection
  const anomalyInsights = detectSystemAnomalies(metricsReport, breathingState)
  insights.push(...anomalyInsights.insights)
  predictions.push(...anomalyInsights.predictions)

  // Optimization opportunities
  const optimizationInsights = findOptimizationOpportunities(channelsData)
  insights.push(...optimizationInsights.insights)
  suggestedActions.push(...optimizationInsights.actions)

  // Performance trends
  const trends = analyzePerformanceTrends(metricsReport)

  return {
    system: {
      healthScore,
      trend: systemTrend,
      uptime: metricsReport.global?.uptime || 0,
      stress: breathingState.stress
    },
    insights: prioritizeInsights(insights),
    performance: {
      bottlenecks: prioritizeBottlenecks(bottlenecks),
      trends
    },
    predictions: prioritizePredictions(predictions),
    suggestedActions: prioritizeActions(suggestedActions),
    timestamp: Date.now()
  }
}

/**
 * Calculate overall system health score (0-100)
 */
const calculateSystemHealthScore = (metrics: any, breathing: any): number => {
  let score = 100

  // Stress impact (0-40 points)
  score -= breathing.stress * 40

  // Error rate impact (0-30 points)
  const errorRate =
    metrics.global?.totalErrors / (metrics.global?.totalCalls || 1)
  score -= Math.min(errorRate * 300, 30) // Max 30 point deduction

  // Call rate health (0-20 points)
  const callRate = metrics.global?.callRate || 0
  if (callRate > 100) score -= Math.min((callRate - 100) / 10, 20)

  // Breathing pattern health (0-10 points)
  if (breathing.isRecuperating) score -= 10

  return Math.max(0, Math.round(score))
}

/**
 * Analyze system trend over time
 */
const analyzeSystemTrend = (
  metrics: any,
  breathing: any
): 'improving' | 'stable' | 'declining' => {
  // Simple heuristics for trend analysis
  if (breathing.stress > 0.8) return 'declining'
  if (breathing.stress < 0.3 && (metrics.global?.errorRate || 0) < 0.02)
    return 'improving'
  return 'stable'
}

/**
 * Analyze performance bottlenecks and issues
 */
const analyzePerformance = (metrics: any, channelsData: any) => {
  const insights: any[] = []
  const bottlenecks: any[] = []
  const actions: any[] = []

  // High-level performance insights
  if (metrics.global?.callRate > 50) {
    insights.push({
      type: 'performance',
      severity: metrics.global.callRate > 100 ? 'critical' : 'warning',
      message: `High system call rate: ${metrics.global.callRate}/sec`,
      recommendation: 'Review high-frequency channels and consider throttling',
      impact: 'high'
    })

    actions.push({
      priority: 'soon',
      action: 'Audit top 10 highest-frequency channels',
      rationale: 'High call rate may impact system responsiveness',
      impact: 'Reduced latency and improved stability'
    })
  }

  // Channel-specific analysis
  channelsData.channels?.forEach((channel: any) => {
    const channelMetrics = channel.metrics || {}

    // Slow execution detection
    if (channelMetrics.avgExecutionTime > 100) {
      bottlenecks.push({
        channelId: channel.id,
        issue: `Slow execution: ${channelMetrics.avgExecutionTime}ms average`,
        impact: channelMetrics.avgExecutionTime / 10, // Impact score
        suggestion: 'Optimize subscriber function or add async processing'
      })

      insights.push({
        type: 'performance',
        severity:
          channelMetrics.avgExecutionTime > 500 ? 'critical' : 'warning',
        message: `Channel ${channel.id} has slow execution times`,
        channels: [channel.id],
        recommendation: 'Profile and optimize the subscriber function',
        impact: 'medium'
      })
    }

    // High error rate detection
    if (channelMetrics.errorCount > 0) {
      const errorRate =
        channelMetrics.errorCount / (channelMetrics.executionCount || 1)
      if (errorRate > 0.1) {
        bottlenecks.push({
          channelId: channel.id,
          issue: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
          impact: errorRate * 10,
          suggestion: 'Review error handling and input validation'
        })

        insights.push({
          type: 'error',
          severity: errorRate > 0.5 ? 'critical' : 'warning',
          message: `Channel ${channel.id} has high error rate`,
          channels: [channel.id],
          recommendation:
            'Debug subscriber function and improve error handling',
          impact: 'high'
        })
      }
    }

    // Memory leak detection (placeholder)
    if (channelMetrics.executionCount > 1000 && !channelMetrics.lastCleanup) {
      insights.push({
        type: 'optimization',
        severity: 'info',
        message: `Channel ${channel.id} may benefit from periodic cleanup`,
        channels: [channel.id],
        recommendation: 'Implement payload state cleanup or use detectChanges',
        impact: 'low'
      })
    }
  })

  return {insights, bottlenecks, actions}
}

/**
 * Analyze error patterns and root causes
 */
const analyzeErrors = (metrics: any) => {
  const insights: any[] = []
  const actions: any[] = []

  const totalErrors = metrics.global?.totalErrors || 0
  const totalCalls = metrics.global?.totalCalls || 1
  const errorRate = totalErrors / totalCalls

  if (totalErrors > 0) {
    if (errorRate > 0.1) {
      insights.push({
        type: 'error',
        severity: 'critical',
        message: `System error rate is ${(errorRate * 100).toFixed(1)}%`,
        recommendation:
          'Immediate investigation required - check logs and recent changes',
        impact: 'high'
      })

      actions.push({
        priority: 'immediate',
        action: 'Investigate error patterns and root causes',
        rationale: 'High error rate indicates systemic issues',
        impact: 'System stability and reliability'
      })
    } else if (errorRate > 0.05) {
      insights.push({
        type: 'error',
        severity: 'warning',
        message: `Elevated error rate: ${(errorRate * 100).toFixed(1)}%`,
        recommendation: 'Monitor error trends and investigate patterns',
        impact: 'medium'
      })
    }

    // Error clustering analysis
    if (totalErrors > 10) {
      insights.push({
        type: 'error',
        severity: 'info',
        message: `${totalErrors} total errors detected`,
        recommendation: 'Review error distribution across channels',
        impact: 'low'
      })

      actions.push({
        priority: 'soon',
        action: 'Analyze error distribution and patterns',
        rationale: 'Understanding error patterns helps prevent future issues',
        impact: 'Improved error prevention and debugging'
      })
    }
  }

  return {insights, actions}
}

/**
 * Detect system-level anomalies
 */
const detectSystemAnomalies = (metrics: any, breathing: any) => {
  const insights: any[] = []
  const predictions: any[] = []

  // Breathing anomalies
  if (breathing.stress > 0.9) {
    insights.push({
      type: 'anomaly',
      severity: 'critical',
      message: 'System stress at critical levels',
      recommendation: 'Reduce load immediately - pause non-critical operations',
      impact: 'high'
    })

    predictions.push({
      type: 'system-overload',
      probability: 0.9,
      timeframe: '1-5 minutes',
      description: 'System may become unresponsive',
      prevention: 'Reduce call rate and pause background tasks'
    })
  }

  // Call rate anomalies
  const callRate = metrics.global?.callRate || 0
  if (callRate > 200) {
    insights.push({
      type: 'anomaly',
      severity: 'warning',
      message: `Unusual call rate spike: ${callRate}/sec`,
      recommendation: 'Investigate sudden increase in activity',
      impact: 'medium'
    })
  }

  // Breathing pattern anomalies
  if (breathing.isRecuperating) {
    insights.push({
      type: 'anomaly',
      severity: 'warning',
      message: 'System in recuperation mode',
      recommendation: 'Allow system to recover - avoid additional load',
      impact: 'medium'
    })

    predictions.push({
      type: 'extended-recovery',
      probability: 0.6,
      timeframe: '2-10 minutes',
      description: 'Recovery time may be extended under current load',
      prevention: 'Pause orchestrations and reduce background activity'
    })
  }

  return {insights, predictions}
}

/**
 * Find optimization opportunities
 */
const findOptimizationOpportunities = (channelsData: any) => {
  const insights: any[] = []
  const actions: any[] = []

  const channels = channelsData.channels || []

  // Unused channels
  const unusedChannels = channels.filter(
    (c: any) => c.metrics?.executionCount === 0 && c.hasSubscriber
  )

  if (unusedChannels.length > 0) {
    insights.push({
      type: 'optimization',
      severity: 'info',
      message: `${unusedChannels.length} channels have subscribers but never execute`,
      channels: unusedChannels.map((c: any) => c.id),
      recommendation: 'Review unused channels and remove if unnecessary',
      impact: 'low'
    })

    actions.push({
      priority: 'eventually',
      action: `Clean up ${unusedChannels.length} unused channels`,
      rationale: 'Reduces memory usage and simplifies system',
      impact: 'Cleaner codebase and reduced resource usage'
    })
  }

  // Throttling opportunities
  const highFrequencyChannels = channels.filter(
    (c: any) => c.metrics?.callsPerMinute > 60 && !c.config?.throttle
  )

  if (highFrequencyChannels.length > 0) {
    insights.push({
      type: 'optimization',
      severity: 'info',
      message: `${highFrequencyChannels.length} high-frequency channels could benefit from throttling`,
      channels: highFrequencyChannels.map((c: any) => c.id),
      recommendation: 'Add throttling to reduce system load',
      impact: 'medium'
    })

    actions.push({
      priority: 'soon',
      action: 'Add throttling to high-frequency channels',
      rationale: 'Reduces system load and improves responsiveness',
      impact: 'Better performance and stability'
    })
  }

  // Debouncing opportunities
  const rapidFireChannels = channels.filter(
    (c: any) => c.metrics?.callsPerMinute > 300 && !c.config?.debounce
  )

  if (rapidFireChannels.length > 0) {
    insights.push({
      type: 'optimization',
      severity: 'info',
      message: `${rapidFireChannels.length} channels show rapid-fire patterns - consider debouncing`,
      channels: rapidFireChannels.map((c: any) => c.id),
      recommendation: 'Add debouncing to collapse rapid calls',
      impact: 'medium'
    })
  }

  return {insights, actions}
}

/**
 * Analyze performance trends
 */
const analyzePerformanceTrends = (metrics: any) => {
  // This would analyze historical data for trends
  // For now, simple heuristics based on current state

  const callRate = metrics.global?.callRate || 0
  const errorRate =
    (metrics.global?.totalErrors || 0) / (metrics.global?.totalCalls || 1)

  return {
    callRate:
      callRate > 50 ? 'increasing' : callRate < 10 ? 'decreasing' : 'stable',
    errorRate:
      errorRate > 0.05
        ? 'increasing'
        : errorRate < 0.01
        ? 'decreasing'
        : 'stable',
    latency: 'stable' // Would need historical latency data
  } as const
}

/**
 * Prioritization helpers
 */
const prioritizeInsights = (insights: any[]) => {
  return insights.sort((a, b) => {
    const severityOrder = {critical: 3, warning: 2, info: 1}
    const impactOrder = {high: 3, medium: 2, low: 1}

    const scoreA =
      severityOrder[a.severity as keyof typeof severityOrder] * 2 +
      impactOrder[a.impact as keyof typeof impactOrder]
    const scoreB =
      severityOrder[b.severity as keyof typeof severityOrder] * 2 +
      impactOrder[b.impact as keyof typeof impactOrder]

    return scoreB - scoreA
  })
}

const prioritizeBottlenecks = (bottlenecks: any[]) => {
  return bottlenecks.sort((a, b) => b.impact - a.impact)
}

const prioritizePredictions = (predictions: any[]) => {
  return predictions.sort((a, b) => b.probability - a.probability)
}

const prioritizeActions = (actions: any[]) => {
  const priorityOrder = {immediate: 3, soon: 2, eventually: 1}
  return actions.sort(
    (a, b) =>
      priorityOrder[b.priority as keyof typeof priorityOrder] -
      priorityOrder[a.priority as keyof typeof priorityOrder]
  )
}
