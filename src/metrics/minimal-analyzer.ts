// src/metrics/minimal-analyzer.ts
// Lightweight analyzer replacing the heavy unified-analyzer

import {enhancedCore} from './enhanced-core'
import type {SystemMetrics} from '../types/system'

/*

      C.Y.R.E - M.I.N.I.M.A.L - A.N.A.L.Y.Z.E.R
      
      Replaces heavy analyzer with lightweight version:
      - Essential analysis only (~1ms overhead)
      - Basic health scoring
      - Simple anomaly flags
      - Structured export for external analysis

*/

export interface CoreAnalysis {
  timestamp: number
  timeWindow: number

  // Basic system info
  system: SystemMetrics

  // Simple health analysis
  health: {
    overall: 'healthy' | 'degraded' | 'critical'
    score: number
    factors: {
      availability: number
      performance: number
      reliability: number
      efficiency: number
    }
    issues: string[]
    criticalAlerts: number
  }

  // Basic performance metrics
  performance: {
    avgLatency: number
    p95Latency: number
    throughput: number
    successRate: number
    errorRate: number
    trends: 'improving' | 'stable' | 'degrading'
    degradations: any[]
  }

  // Simple pipeline analysis
  pipeline: {
    totalCalls: number
    completedCalls: number
    failedCalls: number
    stuckCalls: number
    avgDuration: number
    efficiency: number
    flowHealth: 'healthy' | 'degraded' | 'critical'
    bottlenecks: any[]
  }

  // Basic anomaly flags
  anomalies: {
    detected: boolean
    anomalies: Array<{
      type: string
      channelId: string
      severity: string
      description: string
      confidence: number
    }>
    patterns: any[]
  }

  // Simple insights
  insights: {
    totalActivity: number
    activeChannels: number
    peakThroughput: number
    systemEfficiency: number
    topPerformers: string[]
    problemChannels: string[]
    unusedChannels: string[]
    resourceUtilization: number
  }

  // Basic recommendations
  recommendations: string[]
}

/**
 * Minimal analyzer - keeps Cyre fast
 */
export const minimalAnalyzer = {
  /**
   * Main analysis method - replaces heavy analyzer.analyzeSystem()
   */
  analyzeSystem(timeWindow = 60000): CoreAnalysis {
    const startTime = Date.now()

    const systemMetrics = enhancedCore.getSystemMetrics()
    const allChannels = enhancedCore.getAllChannelMetrics()
    const activeChannels = allChannels.filter(c => c.calls > 0)

    // Quick calculations only
    const performance = calculatePerformance(allChannels, systemMetrics)
    const health = calculateHealth(performance, allChannels, systemMetrics)
    const pipeline = calculatePipeline(allChannels, systemMetrics)
    const anomalies = detectSimpleAnomalies(allChannels)
    const insights = calculateInsights(allChannels, activeChannels)
    const recommendations = generateSimpleRecommendations(
      health,
      performance,
      pipeline
    )

    const analysisTime = Date.now() - startTime
    if (analysisTime > 5) {
      console.warn(
        `Minimal analyzer took ${analysisTime.toFixed(
          2
        )}ms - consider optimization`
      )
    }

    return {
      timestamp: Date.now(),
      timeWindow,
      system: systemMetrics,
      health,
      performance,
      pipeline,
      anomalies,
      insights,
      recommendations
    }
  },

  /**
   * Channel analysis - replaces analyzer.analyzeChannel()
   */
  analyzeChannel(channelId: string, timeWindow?: number) {
    const channel = enhancedCore.getChannelMetrics(channelId)
    if (!channel) return null

    const enhanced = enhancedCore.getEnhancedChannelMetrics(channelId)[0]
    if (!enhanced) return channel

    // Simple channel health
    const successRate =
      channel.calls > 0 ? channel.executions / channel.calls : 1
    const status =
      successRate > 0.9
        ? 'healthy'
        : successRate > 0.7
        ? 'degraded'
        : 'critical'

    return {
      ...enhanced,
      analysis: {
        status,
        successRate,
        avgLatency: channel.averageLatency,
        subscriberCount: enhanced.subscribers.count,
        branchPath: enhanced.branch?.branchPath,
        groupCount: enhanced.groups.length
      }
    }
  }
}

// Simple calculation functions
function calculatePerformance(channels: any[], systemMetrics: SystemMetrics) {
  const totalLatency = channels.reduce(
    (sum, c) => sum + c.averageLatency * c.calls,
    0
  )
  const totalCalls = channels.reduce((sum, c) => sum + c.calls, 0)
  const avgLatency = totalCalls > 0 ? totalLatency / totalCalls : 0

  // Simple P95 estimation
  const latencies = channels
    .filter(c => c.calls > 0)
    .map(c => c.averageLatency)
    .sort((a, b) => a - b)
  const p95Index = Math.floor(latencies.length * 0.95)
  const p95Latency = latencies[p95Index] || avgLatency

  const successRate =
    totalCalls > 0 ? systemMetrics.totalExecutions / totalCalls : 1
  const errorRate = totalCalls > 0 ? systemMetrics.totalErrors / totalCalls : 0

  return {
    avgLatency,
    p95Latency,
    throughput: systemMetrics.callRate,
    successRate,
    errorRate,
    trends: 'stable' as const,
    degradations: []
  }
}

const calculateHealth = (
  performance: any,
  channels: any[],
  systemMetrics: SystemMetrics
) => {
  let score = 100
  const issues: string[] = []

  // Simple health scoring
  if (performance.avgLatency > 500) {
    score -= 20
    issues.push('High latency detected')
  }
  if (performance.successRate < 0.9) {
    score -= 30
    issues.push(
      `Low success rate: ${(performance.successRate * 100).toFixed(1)}%`
    )
  }
  if (performance.errorRate > 0.05) {
    score -= 25
    issues.push('High error rate')
  }

  const availability = performance.successRate
  const performanceFactor =
    performance.avgLatency < 100
      ? 1
      : Math.max(0.5, 1 - performance.avgLatency / 1000)
  const reliability = 1 - performance.errorRate
  const efficiency =
    systemMetrics.totalCalls > 0
      ? systemMetrics.totalExecutions / systemMetrics.totalCalls
      : 1

  if (availability < 0.5) {
    issues.push(`Low availability: ${(availability * 100).toFixed(1)}%`)
  }

  const status = score > 80 ? 'healthy' : score > 60 ? 'degraded' : 'critical'

  return {
    overall: status,
    score: Math.max(0, score),
    factors: {
      availability,
      performance: performanceFactor,
      reliability,
      efficiency
    },
    issues,
    criticalAlerts: status === 'critical' ? 1 : 0
  }
}

const calculatePipeline = (channels: any[], systemMetrics: SystemMetrics) => {
  const totalCalls = systemMetrics.totalCalls
  const completedCalls = systemMetrics.totalExecutions
  const failedCalls = systemMetrics.totalErrors
  const stuckCalls = Math.max(0, totalCalls - completedCalls - failedCalls)

  const efficiency = totalCalls > 0 ? completedCalls / totalCalls : 1
  const flowHealth =
    efficiency > 0.8 ? 'healthy' : efficiency > 0.5 ? 'degraded' : 'critical'

  return {
    totalCalls,
    completedCalls,
    failedCalls,
    stuckCalls,
    avgDuration: 0, // Simple placeholder
    efficiency,
    flowHealth,
    bottlenecks: []
  }
}

const detectSimpleAnomalies = (channels: any[]) => {
  const anomalies: any[] = []

  // Simple anomaly detection
  channels.forEach(channel => {
    if (channel.averageLatency > 1000 && channel.calls > 10) {
      anomalies.push({
        type: 'statistical',
        channelId: channel.id,
        severity: 'high',
        description: `High latency: ${channel.averageLatency.toFixed(2)}ms`,
        confidence: 0.8
      })
    }
  })

  return {
    detected: anomalies.length > 0,
    anomalies,
    patterns: []
  }
}

const calculateInsights = (allChannels: any[], activeChannels: any[]) => {
  const topPerformers = activeChannels
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 3)
    .map(c => c.id)

  const problemChannels = activeChannels
    .filter(
      c =>
        c.averageLatency > 500 || (c.calls > 0 && c.executions / c.calls < 0.8)
    )
    .map(c => c.id)

  const unusedChannels = allChannels.filter(c => c.calls === 0).map(c => c.id)

  const totalActivity = allChannels.reduce((sum, c) => sum + c.calls, 0)
  const peakThroughput = Math.max(...activeChannels.map(c => c.calls), 0)

  return {
    totalActivity,
    activeChannels: activeChannels.length,
    peakThroughput,
    systemEfficiency:
      allChannels.length > 0 ? activeChannels.length / allChannels.length : 1,
    topPerformers,
    problemChannels,
    unusedChannels,
    resourceUtilization:
      allChannels.length > 0 ? activeChannels.length / allChannels.length : 0
  }
}

const generateSimpleRecommendations = (
  health: any,
  performance: any,
  pipeline: any
): string[] => {
  const recommendations: string[] = []

  if (pipeline.efficiency < 0.5) {
    recommendations.push(
      'Improve pipeline efficiency - many calls not completing'
    )
  }

  if (performance.avgLatency > 200) {
    recommendations.push('Consider optimizing high-latency channels')
  }

  if (health.factors.availability < 0.8) {
    recommendations.push('Investigate low availability issues')
  }

  return recommendations
}
