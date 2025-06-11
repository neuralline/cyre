// src/metrics/live-analyzer.ts
// Enhanced live analyzer with historical data accumulation and better calculations

import {metricsCore} from './core'
import type {
  RawEvent,
  ChannelMetrics,
  SystemMetrics as CoreSystemMetrics
} from '../types/system'
import type {
  SystemAnalysis,
  SystemMetrics,
  PipelineAnalysis,
  PerformanceAnalysis,
  HealthAnalysis,
  ChannelAnalysis,
  AnomalyAnalysis,
  InsightAnalysis,
  LatencyBucket,
  PerformanceDegradation,
  Bottleneck,
  HealthTrend,
  OptimizationOpportunity
} from '../types/enhanced-dashboard'
import type {ActionId} from '../types/core'

/*

  C.Y.R.E - E.N.H.A.N.C.E.D - L.I.V.E - A.N.A.L.Y.Z.E.R
  
  Enhanced live analyzer with improved data quality:
  - Historical data accumulation for better trends
  - Multiple time window aggregations  
  - Advanced health scoring algorithms
  - Better baseline calculations
  - Real-time and historical metrics combination
  - Maintains existing API structure

*/

interface HistoricalMetric {
  timestamp: number
  value: number
  channelId?: string
  type: 'call_rate' | 'latency' | 'error_rate' | 'throughput' | 'health_score'
}

interface AggregatedMetrics {
  oneMin: Map<string, number>
  fiveMin: Map<string, number>
  oneHour: Map<string, number>
  oneDay: Map<string, number>
}

interface ChannelBaseline {
  avgLatency: number
  avgCallRate: number
  avgErrorRate: number
  lastUpdated: number
  sampleCount: number
}

class EnhancedLiveAnalyzer {
  private historicalData: HistoricalMetric[] = []
  private channelBaselines = new Map<string, ChannelBaseline>()
  private aggregatedMetrics: AggregatedMetrics = {
    oneMin: new Map(),
    fiveMin: new Map(),
    oneHour: new Map(),
    oneDay: new Map()
  }
  private lastHealthScores: number[] = []
  private lastAggregationTime = 0

  /**
   * Main system analysis with enhanced historical data
   */
  analyzeSystem(timeWindow = 300000): SystemAnalysis {
    const events = metricsCore.getEvents({since: Date.now() - timeWindow})
    const systemMetrics = metricsCore.getSystemMetrics()
    const channelMetrics = metricsCore.getAllChannelMetrics()

    // Update historical data and baselines
    this.updateHistoricalData(events, channelMetrics)
    this.updateChannelBaselines(channelMetrics)
    this.updateAggregatedMetrics()

    return {
      timestamp: Date.now(),
      timeWindow,
      system: this.buildEnhancedSystemMetrics(
        systemMetrics,
        events,
        channelMetrics
      ),
      pipeline: this.analyzeEnhancedPipeline(events, channelMetrics),
      performance: this.analyzeEnhancedPerformance(events, channelMetrics),
      health: this.analyzeEnhancedHealth(events, channelMetrics),
      channels: this.analyzeEnhancedChannels(channelMetrics, events),
      events: this.analyzeRecentEvents(events),
      anomalies: this.detectEnhancedAnomalies(events, channelMetrics),
      insights: this.generateEnhancedInsights(events, channelMetrics),
      recommendations: this.generateEnhancedRecommendations(
        events,
        channelMetrics
      )
    }
  }

  /**
   * Update historical data with new metrics
   */
  private updateHistoricalData(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): void {
    const now = Date.now()

    // Add system-level metrics
    const recentEvents = events.filter(e => e.timestamp > now - 60000)
    const callRate =
      recentEvents.filter(e => e.eventType === 'call').length / 60
    const avgLatency = this.calculateAverageLatency(recentEvents)
    const errorRate =
      recentEvents.filter(e => e.eventType === 'error').length /
      Math.max(1, recentEvents.length)

    this.historicalData.push(
      {timestamp: now, value: callRate, type: 'call_rate'},
      {timestamp: now, value: avgLatency, type: 'latency'},
      {timestamp: now, value: errorRate, type: 'error_rate'}
    )

    // Add channel-specific metrics
    channels.forEach(channel => {
      const channelEvents = events.filter(
        e => e.actionId === channel.id && e.timestamp > now - 60000
      )
      const channelCallRate =
        channelEvents.filter(e => e.eventType === 'call').length / 60
      const channelThroughput =
        channelEvents.filter(e => e.eventType === 'execution').length / 60

      this.historicalData.push(
        {
          timestamp: now,
          value: channelCallRate,
          channelId: channel.id,
          type: 'call_rate'
        },
        {
          timestamp: now,
          value: channel.averageLatency,
          channelId: channel.id,
          type: 'latency'
        },
        {
          timestamp: now,
          value: channel.errorRate,
          channelId: channel.id,
          type: 'error_rate'
        },
        {
          timestamp: now,
          value: channelThroughput,
          channelId: channel.id,
          type: 'throughput'
        }
      )
    })

    // Cleanup old historical data (keep 24 hours)
    const cutoff = now - 24 * 60 * 60 * 1000
    this.historicalData = this.historicalData.filter(h => h.timestamp > cutoff)
  }

  /**
   * Update channel baselines for better trend detection
   */
  private updateChannelBaselines(channels: ChannelMetrics[]): void {
    channels.forEach(channel => {
      let baseline = this.channelBaselines.get(channel.id)

      if (!baseline) {
        baseline = {
          avgLatency: channel.averageLatency,
          avgCallRate:
            channel.calls /
            Math.max(
              1,
              (Date.now() - metricsCore.getSystemMetrics().startTime) / 1000
            ),
          avgErrorRate: channel.errorRate,
          lastUpdated: Date.now(),
          sampleCount: 1
        }
      } else {
        // Update with exponential moving average for better stability
        const alpha = 0.1 // Smoothing factor
        baseline.avgLatency =
          (1 - alpha) * baseline.avgLatency + alpha * channel.averageLatency
        baseline.avgErrorRate =
          (1 - alpha) * baseline.avgErrorRate + alpha * channel.errorRate
        baseline.sampleCount++
        baseline.lastUpdated = Date.now()
      }

      this.channelBaselines.set(channel.id, baseline)
    })
  }

  /**
   * Update aggregated metrics for different time windows
   */
  private updateAggregatedMetrics(): void {
    const now = Date.now()

    // Update every 30 seconds to avoid excessive computation
    if (now - this.lastAggregationTime < 30000) return
    this.lastAggregationTime = now

    // Calculate aggregations for different time windows
    const timeWindows = [
      {key: 'oneMin', duration: 60 * 1000},
      {key: 'fiveMin', duration: 5 * 60 * 1000},
      {key: 'oneHour', duration: 60 * 60 * 1000},
      {key: 'oneDay', duration: 24 * 60 * 60 * 1000}
    ] as const

    timeWindows.forEach(({key, duration}) => {
      const windowData = this.historicalData.filter(
        h => h.timestamp > now - duration
      )
      const map = this.aggregatedMetrics[key]

      // Clear and recalculate
      map.clear()

      // Aggregate by type
      const typeGroups = this.groupBy(windowData, 'type')
      Object.entries(typeGroups).forEach(([type, metrics]) => {
        const avg =
          metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
        map.set(`system_${type}`, avg)
      })

      // Aggregate by channel
      const channelGroups = this.groupBy(
        windowData.filter(h => h.channelId),
        'channelId'
      )
      Object.entries(channelGroups).forEach(([channelId, metrics]) => {
        const typeGroups = this.groupBy(metrics, 'type')
        Object.entries(typeGroups).forEach(([type, channelMetrics]) => {
          const avg =
            channelMetrics.reduce((sum, m) => sum + m.value, 0) /
            channelMetrics.length
          map.set(`${channelId}_${type}`, avg)
        })
      })
    })
  }

  /**
   * Build enhanced system metrics with historical context
   */
  private buildEnhancedSystemMetrics(
    core: CoreSystemMetrics,
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): SystemMetrics {
    const now = Date.now()

    // Get historical call rates for better calculation
    const historicalCallRates = this.getHistoricalValues('call_rate', 3600000) // Last hour
    const avgCallRate =
      historicalCallRates.length > 0
        ? historicalCallRates.reduce((sum, rate) => sum + rate, 0) /
          historicalCallRates.length
        : core.callRate

    const peakCallRate =
      historicalCallRates.length > 0
        ? Math.max(...historicalCallRates)
        : core.callRate

    // Calculate system load based on peak vs current
    const systemLoad =
      peakCallRate > 0 ? Math.min(1, core.callRate / peakCallRate) : 0

    return {
      totalCalls: core.totalCalls,
      totalExecutions: core.totalExecutions,
      totalErrors: core.totalErrors,
      callRate: core.callRate,
      lastCallTime: core.lastCallTime,
      startTime: core.startTime,
      uptime: core.uptime,
      activeChannels: channels.filter(c => c.calls > 0).length,
      memory: {
        eventCount: events.length,
        channelCount: channels.length,
        maxEvents: 10000, // Configuration value
        memoryUsage: this.estimateMemoryUsage(events, channels)
      },
      performance: {
        avgCallRate,
        peakCallRate,
        systemLoad
      }
    }
  }

  /**
   * Enhanced performance analysis with trend detection
   */
  private analyzeEnhancedPerformance(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): PerformanceAnalysis {
    const executeEvents = events.filter(e => e.eventType === 'execution')
    const latencies = executeEvents
      .map(e => e.metadata?.duration as number)
      .filter(d => typeof d === 'number' && d > 0)
      .sort((a, b) => a - b)

    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0

    const p95Index = Math.floor(latencies.length * 0.95)
    const p99Index = Math.floor(latencies.length * 0.99)
    const p95Latency = latencies[p95Index] || 0
    const p99Latency = latencies[p99Index] || 0

    // Enhanced throughput calculation using historical data
    const historicalThroughput = this.getHistoricalValues('throughput', 300000)
    const throughput =
      historicalThroughput.length > 0
        ? historicalThroughput.reduce((sum, t) => sum + t, 0) /
          historicalThroughput.length
        : executeEvents.length / (300000 / 1000)

    const totalEvents = events.length
    const errorEvents = events.filter(e => e.eventType === 'error').length
    const successRate =
      totalEvents > 0 ? (totalEvents - errorEvents) / totalEvents : 1
    const errorRate = totalEvents > 0 ? errorEvents / totalEvents : 0

    // Enhanced degradation detection using baselines
    const degradations = this.identifyEnhancedDegradations(channels)
    const trends = this.calculateEnhancedTrends(
      avgLatency,
      successRate,
      throughput
    )
    const latencyDistribution = this.calculateLatencyDistribution(latencies)

    return {
      avgLatency,
      p95Latency,
      p99Latency,
      throughput,
      successRate,
      errorRate,
      degradations,
      trends,
      latencyDistribution
    }
  }

  /**
   * Enhanced health analysis with sophisticated scoring
   */
  private analyzeEnhancedHealth(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): HealthAnalysis {
    const now = Date.now()

    // Calculate health factors with historical context
    const availability = this.calculateAvailabilityScore(channels)
    const performance = this.calculatePerformanceScore(events, channels)
    const reliability = this.calculateReliabilityScore(channels)
    const efficiency = this.calculateEfficiencyScore(events, channels)

    const factors = {availability, performance, reliability, efficiency}

    // Weighted health score with trend consideration
    const weights = {
      availability: 0.3,
      performance: 0.3,
      reliability: 0.25,
      efficiency: 0.15
    }
    const currentScore = Math.round(
      Object.entries(factors).reduce(
        (sum, [key, value]) =>
          sum + value * weights[key as keyof typeof weights],
        0
      ) * 100
    )

    // Track health score trends
    this.lastHealthScores.push(currentScore)
    if (this.lastHealthScores.length > 10) {
      this.lastHealthScores.shift()
    }

    // Adjust score based on trend
    const trendAdjustment = this.calculateHealthTrendAdjustment()
    const score = Math.max(0, Math.min(100, currentScore + trendAdjustment))

    const overall =
      score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'critical'
    const issues = this.identifyEnhancedHealthIssues(channels, events, factors)
    const criticalAlerts = issues.filter(issue =>
      issue.includes('critical')
    ).length
    const trends = this.calculateHealthTrends(factors)

    // Store health score in historical data
    this.historicalData.push({
      timestamp: now,
      value: score,
      type: 'health_score'
    })

    return {
      overall,
      score,
      factors,
      issues,
      criticalAlerts,
      trends
    }
  }

  /**
   * Enhanced channel analysis with historical performance
   */
  private analyzeEnhancedChannels(
    channels: ChannelMetrics[],
    events: RawEvent[]
  ): ChannelAnalysis[] {
    return channels.map(channel => {
      const channelEvents = events.filter(e => e.actionId === channel.id)
      const status = this.determineEnhancedChannelStatus(channel, channelEvents)
      const issues = this.identifyEnhancedChannelIssues(channel, channelEvents)
      const latencyTrend = this.calculateEnhancedLatencyTrend(channel.id)
      const protectionStats = this.calculateProtectionStats(channel)
      const recommendations = this.generateChannelRecommendations(
        channel,
        channelEvents
      )

      return {
        id: channel.id,
        metrics: channel,
        status,
        issues,
        latencyTrend,
        protectionStats,
        recommendations
      }
    })
  }

  /**
   * Helper methods for enhanced calculations
   */
  private getHistoricalValues(
    type: string,
    timeWindow: number,
    channelId?: string
  ): number[] {
    const cutoff = Date.now() - timeWindow
    return this.historicalData
      .filter(
        h =>
          h.type === type &&
          h.timestamp > cutoff &&
          (!channelId || h.channelId === channelId)
      )
      .map(h => h.value)
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((result, item) => {
      const group = String(item[key])
      return {
        ...result,
        [group]: [...(result[group] || []), item]
      }
    }, {} as Record<string, T[]>)
  }

  private calculateAverageLatency(events: RawEvent[]): number {
    const latencies = events
      .filter(e => e.eventType === 'execution')
      .map(e => e.metadata?.duration as number)
      .filter(d => typeof d === 'number' && d > 0)

    return latencies.length > 0
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      : 0
  }

  private estimateMemoryUsage(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): number {
    // Rough estimation: 500 bytes per event + 200 bytes per channel
    return (
      events.length * 500 +
      channels.length * 200 +
      this.historicalData.length * 100
    )
  }

  private calculateAvailabilityScore(channels: ChannelMetrics[]): number {
    if (channels.length === 0) return 1
    const activeChannels = channels.filter(c => c.calls > 0).length
    return activeChannels / channels.length
  }

  private calculatePerformanceScore(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): number {
    const avgLatency = this.calculateAverageLatency(events)
    const latencyScore =
      avgLatency < 50
        ? 1
        : avgLatency < 200
        ? 0.8
        : avgLatency < 500
        ? 0.5
        : 0.2

    const errorRate =
      events.length > 0
        ? events.filter(e => e.eventType === 'error').length / events.length
        : 0
    const errorScore = Math.max(0, 1 - errorRate * 2)

    return (latencyScore + errorScore) / 2
  }

  private calculateReliabilityScore(channels: ChannelMetrics[]): number {
    if (channels.length === 0) return 1
    const avgSuccessRate =
      channels.reduce((sum, c) => sum + c.successRate, 0) / channels.length
    return avgSuccessRate
  }

  private calculateEfficiencyScore(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): number {
    const totalCalls = events.filter(e => e.eventType === 'call').length
    const totalExecutions = events.filter(
      e => e.eventType === 'execution'
    ).length
    return totalCalls > 0 ? totalExecutions / totalCalls : 1
  }

  private calculateHealthTrendAdjustment(): number {
    if (this.lastHealthScores.length < 3) return 0

    const recent = this.lastHealthScores.slice(-3)
    const trend = (recent[2] - recent[0]) / 2

    // Amplify positive trends, dampen negative ones
    return trend > 0 ? Math.min(5, trend * 0.5) : Math.max(-10, trend * 0.3)
  }

  private identifyEnhancedDegradations(
    channels: ChannelMetrics[]
  ): PerformanceDegradation[] {
    const degradations: PerformanceDegradation[] = []

    channels.forEach(channel => {
      const baseline = this.channelBaselines.get(channel.id)
      if (!baseline || baseline.sampleCount < 3) return

      // Check latency degradation
      if (channel.averageLatency > baseline.avgLatency * 1.5) {
        degradations.push({
          channelId: channel.id,
          type: 'latency',
          severity:
            channel.averageLatency > baseline.avgLatency * 3
              ? 'critical'
              : 'major',
          current: channel.averageLatency,
          expected: baseline.avgLatency,
          impact:
            (channel.averageLatency - baseline.avgLatency) / baseline.avgLatency
        })
      }

      // Check error rate degradation
      if (
        channel.errorRate > baseline.avgErrorRate * 2 &&
        channel.errorRate > 0.05
      ) {
        degradations.push({
          channelId: channel.id,
          type: 'errors',
          severity: channel.errorRate > 0.2 ? 'critical' : 'major',
          current: channel.errorRate,
          expected: baseline.avgErrorRate,
          impact: channel.errorRate - baseline.avgErrorRate
        })
      }
    })

    return degradations
  }

  private calculateEnhancedTrends(
    avgLatency: number,
    successRate: number,
    throughput: number
  ): 'improving' | 'stable' | 'degrading' {
    const latencyHistory = this.getHistoricalValues('latency', 600000) // 10 minutes
    const throughputHistory = this.getHistoricalValues('throughput', 600000)

    if (latencyHistory.length < 3 || throughputHistory.length < 3)
      return 'stable'

    const latencyTrend = this.calculateTrendDirection(latencyHistory)
    const throughputTrend = this.calculateTrendDirection(throughputHistory)

    // Improving if latency decreasing AND throughput increasing
    if (latencyTrend === 'decreasing' && throughputTrend === 'increasing')
      return 'improving'

    // Degrading if latency increasing OR throughput decreasing significantly
    if (latencyTrend === 'increasing' || throughputTrend === 'decreasing')
      return 'degrading'

    return 'stable'
  }

  private calculateTrendDirection(
    values: number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 3) return 'stable'

    const recent = values.slice(-5) // Last 5 values
    const slope = this.calculateSlope(recent)

    if (Math.abs(slope) < 0.1) return 'stable'
    return slope > 0 ? 'increasing' : 'decreasing'
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0

    const n = values.length
    const x = Array.from({length: n}, (_, i) => i)
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = values.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  }

  private calculateLatencyDistribution(latencies: number[]): LatencyBucket[] {
    const buckets = [
      {min: 0, max: 10, count: 0},
      {min: 10, max: 50, count: 0},
      {min: 50, max: 100, count: 0},
      {min: 100, max: 500, count: 0},
      {min: 500, max: 1000, count: 0},
      {min: 1000, max: Infinity, count: 0}
    ]

    latencies.forEach(latency => {
      const bucket = buckets.find(b => latency >= b.min && latency < b.max)
      if (bucket) bucket.count++
    })

    return buckets.map(bucket => ({
      ...bucket,
      percentage:
        latencies.length > 0 ? (bucket.count / latencies.length) * 100 : 0
    }))
  }

  private identifyEnhancedHealthIssues(
    channels: ChannelMetrics[],
    events: RawEvent[],
    factors: any
  ): string[] {
    const issues = []

    // Performance issues
    if (factors.performance < 0.7) {
      const avgLatency = this.calculateAverageLatency(events)
      if (avgLatency > 200)
        issues.push(`High system latency: ${avgLatency.toFixed(0)}ms`)

      const errorRate =
        events.filter(e => e.eventType === 'error').length /
        Math.max(1, events.length)
      if (errorRate > 0.1)
        issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`)
    }

    // Availability issues
    if (factors.availability < 0.8) {
      const inactiveChannels = channels.filter(c => c.calls === 0).length
      if (inactiveChannels > 0)
        issues.push(`${inactiveChannels} inactive channels`)
    }

    // Reliability issues
    if (factors.reliability < 0.9) {
      const unreliableChannels = channels.filter(
        c => c.successRate < 0.8
      ).length
      if (unreliableChannels > 0)
        issues.push(`${unreliableChannels} unreliable channels`)
    }

    // Recent critical events
    const recentCritical = events.filter(
      e => e.eventType === 'error' && e.timestamp > Date.now() - 300000
    ).length
    if (recentCritical > 10) {
      issues.push(`${recentCritical} critical errors in last 5 minutes`)
    }

    return issues
  }

  private determineEnhancedChannelStatus(
    channel: ChannelMetrics,
    events: RawEvent[]
  ): 'healthy' | 'warning' | 'critical' | 'inactive' {
    if (channel.calls === 0) return 'inactive'

    const baseline = this.channelBaselines.get(channel.id)

    // Critical conditions
    if (
      channel.errorRate > 0.3 ||
      (baseline && channel.averageLatency > baseline.avgLatency * 4)
    ) {
      return 'critical'
    }

    // Warning conditions
    if (
      channel.errorRate > 0.1 ||
      channel.averageLatency > 1000 ||
      (baseline && channel.averageLatency > baseline.avgLatency * 2)
    ) {
      return 'warning'
    }

    return 'healthy'
  }

  private identifyEnhancedChannelIssues(
    channel: ChannelMetrics,
    events: RawEvent[]
  ): string[] {
    const issues = []
    const baseline = this.channelBaselines.get(channel.id)

    if (channel.errorRate > 0.1) {
      issues.push(`High error rate: ${(channel.errorRate * 100).toFixed(1)}%`)
    }

    if (baseline && channel.averageLatency > baseline.avgLatency * 1.5) {
      const increase = (
        (channel.averageLatency / baseline.avgLatency - 1) *
        100
      ).toFixed(0)
      issues.push(`Latency increased ${increase}% above baseline`)
    } else if (channel.averageLatency > 1000) {
      issues.push(`High latency: ${channel.averageLatency.toFixed(0)}ms`)
    }

    const recentErrors = events.filter(
      e => e.eventType === 'error' && e.timestamp > Date.now() - 300000
    ).length
    if (recentErrors > 5) {
      issues.push(`${recentErrors} recent errors`)
    }

    return issues
  }

  private calculateEnhancedLatencyTrend(
    channelId: string
  ): 'improving' | 'degrading' | 'stable' {
    const latencyHistory = this.getHistoricalValues(
      'latency',
      600000,
      channelId
    )

    if (latencyHistory.length < 3) return 'stable'

    const trend = this.calculateTrendDirection(latencyHistory)
    return trend === 'decreasing'
      ? 'improving'
      : trend === 'increasing'
      ? 'degrading'
      : 'stable'
  }

  private calculateProtectionStats(channel: ChannelMetrics) {
    const protection = channel.protectionEvents || {
      throttled: 0,
      debounced: 0,
      blocked: 0,
      skipped: 0
    }
    return protection
  }

  private generateChannelRecommendations(
    channel: ChannelMetrics,
    events: RawEvent[]
  ): string[] {
    const recommendations = []
    const baseline = this.channelBaselines.get(channel.id)

    if (channel.errorRate > 0.2) {
      recommendations.push(
        'Investigate error causes and implement error handling'
      )
    }

    if (baseline && channel.averageLatency > baseline.avgLatency * 2) {
      recommendations.push(
        'Optimize performance or increase timeout thresholds'
      )
    }

    const protectionRatio =
      Object.values(channel.protectionEvents || {}).reduce(
        (sum, val) => sum + val,
        0
      ) / Math.max(1, channel.calls)
    if (protectionRatio > 0.5) {
      recommendations.push(
        'Consider adjusting protection mechanisms - high protection ratio'
      )
    }

    return recommendations
  }

  private analyzeRecentEvents(events: RawEvent[]) {
    const recentEvents = events.slice(-50)
    const timeWindow = 60000
    const recentTime = Date.now() - timeWindow
    const windowEvents = events.filter(e => e.timestamp >= recentTime)

    return {
      events: recentEvents.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        channelId: e.actionId,
        type: e.eventType,
        duration: e.metadata?.duration as number,
        status:
          e.eventType === 'error'
            ? 'error'
            : e.eventType === 'execution'
            ? 'success'
            : 'info'
      })),
      summary: {
        total: windowEvents.length,
        errors: windowEvents.filter(e => e.eventType === 'error').length,
        calls: windowEvents.filter(e => e.eventType === 'call').length,
        executions: windowEvents.filter(e => e.eventType === 'execution').length
      }
    }
  }

  private detectEnhancedAnomalies(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): AnomalyAnalysis {
    const anomalies = []
    let confidence = 0

    // Detect statistical anomalies using historical data
    channels.forEach(channel => {
      const baseline = this.channelBaselines.get(channel.id)
      if (!baseline || baseline.sampleCount < 5) return

      // Latency anomaly
      if (channel.averageLatency > baseline.avgLatency * 3) {
        anomalies.push({
          type: 'statistical' as const,
          channelId: channel.id,
          severity: 'high' as const,
          description: `Latency spike: ${channel.averageLatency.toFixed(
            0
          )}ms vs baseline ${baseline.avgLatency.toFixed(0)}ms`,
          confidence: 0.9
        })
        confidence = Math.max(confidence, 0.9)
      }

      // Error rate anomaly
      if (
        channel.errorRate > baseline.avgErrorRate * 5 &&
        channel.errorRate > 0.1
      ) {
        anomalies.push({
          type: 'statistical' as const,
          channelId: channel.id,
          severity: 'high' as const,
          description: `Error rate spike: ${(channel.errorRate * 100).toFixed(
            1
          )}% vs baseline ${(baseline.avgErrorRate * 100).toFixed(1)}%`,
          confidence: 0.85
        })
        confidence = Math.max(confidence, 0.85)
      }
    })

    return {
      detected: anomalies.length > 0,
      confidence,
      anomalies,
      patterns: [] // Could be expanded with pattern detection algorithms
    }
  }

  private generateEnhancedInsights(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): InsightAnalysis {
    const activeChannels = channels.filter(c => c.calls > 0)
    const totalActivity = events.length

    const peakThroughput = Math.max(
      ...this.getHistoricalValues('throughput', 3600000),
      0
    )
    const avgThroughput = activeChannels.reduce(
      (sum, c) =>
        sum + c.executions / Math.max(1, (Date.now() - c.lastExecution) / 1000),
      0
    )

    const systemEfficiency =
      channels.length > 0
        ? channels.reduce(
            (sum, c) => sum + (c.calls > 0 ? c.executions / c.calls : 0),
            0
          ) / channels.length
        : 1

    const topPerformers = channels
      .filter(c => c.calls > 10)
      .sort(
        (a, b) =>
          b.successRate - a.successRate || a.averageLatency - b.averageLatency
      )
      .slice(0, 5)
      .map(c => c.id)

    const problemChannels = channels
      .filter(c => c.errorRate > 0.1 || c.averageLatency > 1000)
      .map(c => c.id)

    const unusedChannels = channels.filter(c => c.calls === 0).map(c => c.id)

    const resourceUtilization = Math.min(
      1,
      avgThroughput / Math.max(1, peakThroughput)
    )

    return {
      totalActivity,
      activeChannels: activeChannels.length,
      peakThroughput,
      systemEfficiency,
      topPerformers,
      problemChannels,
      unusedChannels,
      resourceUtilization,
      optimizationOpportunities:
        this.identifyOptimizationOpportunities(channels)
    }
  }

  /**
   * Enhanced pipeline analysis with flow health assessment
   */
  private analyzeEnhancedPipeline(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): PipelineAnalysis {
    const callEvents = events.filter(e => e.eventType === 'call')
    const executionEvents = events.filter(e => e.eventType === 'execution')
    const errorEvents = events.filter(e => e.eventType === 'error')

    const totalCalls = callEvents.length
    const completedCalls = executionEvents.length
    const failedCalls = errorEvents.filter(
      e => e.location === 'execution'
    ).length

    // Calculate stuck calls (calls without corresponding executions after reasonable time)
    const now = Date.now()
    const stuckThreshold = 30000 // 30 seconds
    const stuckCalls = callEvents.filter(call => {
      const hasExecution = executionEvents.some(
        exec =>
          exec.actionId === call.actionId && exec.timestamp > call.timestamp
      )
      return !hasExecution && now - call.timestamp > stuckThreshold
    }).length

    // Calculate average duration from execution events
    const durations = executionEvents
      .map(e => e.metadata?.duration as number)
      .filter(d => typeof d === 'number' && d > 0)
    const avgDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0

    // Calculate efficiency
    const efficiency = totalCalls > 0 ? completedCalls / totalCalls : 1

    // Identify bottlenecks by channel
    const bottlenecks: Bottleneck[] = channels
      .filter(c => c.calls > 5) // Only consider channels with meaningful activity
      .map(channel => {
        const channelEvents = executionEvents.filter(
          e => e.actionId === channel.id
        )
        const channelDurations = channelEvents
          .map(e => e.metadata?.duration as number)
          .filter(d => typeof d === 'number' && d > 0)

        const avgChannelDuration =
          channelDurations.length > 0
            ? channelDurations.reduce((sum, d) => sum + d, 0) /
              channelDurations.length
            : 0

        return {
          stage: channel.id,
          count: channelEvents.length,
          avgDuration: avgChannelDuration
        }
      })
      .filter(b => b.avgDuration > avgDuration * 1.5) // Significantly slower than average
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5) // Top 5 bottlenecks

    // Determine flow health
    let flowHealth: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (efficiency < 0.5 || stuckCalls > totalCalls * 0.2) {
      flowHealth = 'critical'
    } else if (efficiency < 0.8 || stuckCalls > 0 || bottlenecks.length > 3) {
      flowHealth = 'degraded'
    }

    return {
      totalCalls,
      completedCalls,
      failedCalls,
      stuckCalls,
      avgDuration,
      efficiency,
      bottlenecks,
      flowHealth
    }
  }

  /**
   * Enhanced anomaly detection with statistical analysis
   */
  private detectEnhancedAnomalies(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): AnomalyAnalysis {
    const anomalies = []
    let confidence = 0

    // Detect statistical anomalies using historical data
    channels.forEach(channel => {
      const baseline = this.channelBaselines.get(channel.id)
      if (!baseline || baseline.sampleCount < 5) return

      // Latency anomaly detection
      if (channel.averageLatency > baseline.avgLatency * 3) {
        anomalies.push({
          type: 'statistical' as const,
          channelId: channel.id,
          severity: 'high' as const,
          description: `Latency spike: ${channel.averageLatency.toFixed(
            0
          )}ms vs baseline ${baseline.avgLatency.toFixed(0)}ms`,
          confidence: 0.9
        })
        confidence = Math.max(confidence, 0.9)
      }

      // Error rate anomaly detection
      if (
        channel.errorRate > baseline.avgErrorRate * 5 &&
        channel.errorRate > 0.1
      ) {
        anomalies.push({
          type: 'statistical' as const,
          channelId: channel.id,
          severity: 'high' as const,
          description: `Error rate spike: ${(channel.errorRate * 100).toFixed(
            1
          )}% vs baseline ${(baseline.avgErrorRate * 100).toFixed(1)}%`,
          confidence: 0.85
        })
        confidence = Math.max(confidence, 0.85)
      }

      // Call pattern anomaly
      const historicalCallRates = this.getHistoricalValues(
        'call_rate',
        3600000,
        channel.id
      )
      if (historicalCallRates.length > 5) {
        const avgHistoricalRate =
          historicalCallRates.reduce((sum, rate) => sum + rate, 0) /
          historicalCallRates.length
        const currentRate =
          channel.calls /
          Math.max(1, (Date.now() - baseline.lastUpdated) / 1000)

        if (currentRate > avgHistoricalRate * 5) {
          anomalies.push({
            type: 'pattern' as const,
            channelId: channel.id,
            severity: 'medium' as const,
            description: `Unusual call rate spike: ${currentRate.toFixed(
              1
            )}/sec vs avg ${avgHistoricalRate.toFixed(1)}/sec`,
            confidence: 0.7
          })
          confidence = Math.max(confidence, 0.7)
        }
      }
    })

    // Detect timing anomalies in event sequences
    const recentEvents = events
      .filter(e => e.timestamp > Date.now() - 300000)
      .sort((a, b) => a.timestamp - b.timestamp)
    const eventGaps = []
    for (let i = 1; i < recentEvents.length; i++) {
      eventGaps.push(recentEvents[i].timestamp - recentEvents[i - 1].timestamp)
    }

    if (eventGaps.length > 10) {
      const avgGap =
        eventGaps.reduce((sum, gap) => sum + gap, 0) / eventGaps.length
      const largeGaps = eventGaps.filter(gap => gap > avgGap * 10)

      if (largeGaps.length > 2) {
        anomalies.push({
          type: 'timing' as const,
          channelId: 'system',
          severity: 'medium' as const,
          description: `Irregular event timing detected: ${largeGaps.length} large gaps in event stream`,
          confidence: 0.6
        })
        confidence = Math.max(confidence, 0.6)
      }
    }

    // Pattern detection for common anomaly signatures
    const patterns = []
    const errorChannels = channels.filter(c => c.errorRate > 0.2).map(c => c.id)
    if (errorChannels.length > 3) {
      patterns.push({
        name: 'Multi-channel error cascade',
        channels: errorChannels,
        frequency: errorChannels.length
      })
    }

    const slowChannels = channels
      .filter(c => c.averageLatency > 1000)
      .map(c => c.id)
    if (slowChannels.length > 2) {
      patterns.push({
        name: 'System-wide latency degradation',
        channels: slowChannels,
        frequency: slowChannels.length
      })
    }

    return {
      detected: anomalies.length > 0,
      confidence,
      anomalies,
      patterns
    }
  }

  /**
   * Enhanced insights generation with optimization opportunities
   */
  private generateEnhancedInsights(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): InsightAnalysis {
    const activeChannels = channels.filter(c => c.calls > 0)
    const totalActivity = events.length

    // Calculate peak throughput from historical data
    const throughputHistory = this.getHistoricalValues('throughput', 3600000)
    const peakThroughput =
      throughputHistory.length > 0 ? Math.max(...throughputHistory) : 0

    // Calculate current average throughput
    const avgThroughput = activeChannels.reduce((sum, c) => {
      const timeSinceLastExecution =
        c.lastExecution > 0 ? (Date.now() - c.lastExecution) / 1000 : 1
      return sum + c.executions / Math.max(1, timeSinceLastExecution)
    }, 0)

    // Calculate system efficiency
    const systemEfficiency =
      channels.length > 0
        ? channels.reduce(
            (sum, c) => sum + (c.calls > 0 ? c.executions / c.calls : 0),
            0
          ) / channels.length
        : 1

    // Identify top performers (high success rate, low latency, good throughput)
    const topPerformers = channels
      .filter(c => c.calls > 10) // Only consider channels with meaningful activity
      .map(c => ({
        id: c.id,
        score:
          c.successRate * 0.4 +
          (1000 / Math.max(c.averageLatency, 1)) * 0.3 +
          (c.executions / Math.max(c.calls, 1)) * 0.3
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(c => c.id)

    // Identify problem channels
    const problemChannels = channels
      .filter(c => c.errorRate > 0.1 || c.averageLatency > 1000)
      .map(c => c.id)

    // Identify unused channels
    const unusedChannels = channels.filter(c => c.calls === 0).map(c => c.id)

    // Calculate resource utilization
    const resourceUtilization =
      peakThroughput > 0 ? Math.min(1, avgThroughput / peakThroughput) : 0

    // Generate optimization opportunities
    const optimizationOpportunities =
      this.identifyOptimizationOpportunities(channels)

    return {
      totalActivity,
      activeChannels: activeChannels.length,
      peakThroughput,
      systemEfficiency,
      topPerformers,
      problemChannels,
      unusedChannels,
      resourceUtilization,
      optimizationOpportunities
    }
  }

  /**
   * Enhanced recommendations generation
   */
  private generateEnhancedRecommendations(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): string[] {
    const recommendations = []

    // System-level recommendations
    const errorRate =
      events.filter(e => e.eventType === 'error').length /
      Math.max(1, events.length)
    if (errorRate > 0.1) {
      recommendations.push(
        'High system error rate detected - review error handling and monitoring'
      )
    }

    const avgLatency = this.calculateAverageLatency(events)
    if (avgLatency > 200) {
      recommendations.push(
        'System latency above optimal - consider performance optimization'
      )
    }

    // Channel-level recommendations
    const problematicChannels = channels.filter(
      c => c.errorRate > 0.2 || c.averageLatency > 1000
    )
    if (problematicChannels.length > 0) {
      recommendations.push(
        `${problematicChannels.length} channels need attention - review individual channel performance`
      )
    }

    // Historical trend recommendations
    const healthTrend = this.calculateTrendDirection(this.lastHealthScores)
    if (healthTrend === 'decreasing') {
      recommendations.push(
        'System health declining - investigate recent changes and monitor closely'
      )
    }

    // Data quality recommendations
    const dataAge =
      this.historicalData.length > 0
        ? Date.now() - Math.min(...this.historicalData.map(h => h.timestamp))
        : 0

    if (dataAge < 3600000) {
      // Less than 1 hour of data
      recommendations.push(
        'Limited historical data - consider enabling persistence for better trend analysis'
      )
    }

    // Performance optimization recommendations
    const highLatencyChannels = channels.filter(
      c => c.averageLatency > 500
    ).length
    if (highLatencyChannels > channels.length * 0.3) {
      recommendations.push(
        'Multiple channels showing high latency - system-wide performance review recommended'
      )
    }

    // Protection mechanism recommendations
    const overProtectedChannels = channels.filter(c => {
      const protectionRatio =
        Object.values(c.protectionEvents || {}).reduce(
          (sum, val) => sum + val,
          0
        ) / Math.max(1, c.calls)
      return protectionRatio > 0.6
    }).length

    if (overProtectedChannels > 0) {
      recommendations.push(
        `${overProtectedChannels} channels may be over-protected - review throttling and debouncing settings`
      )
    }

    return recommendations.slice(0, 8) // Top 8 recommendations
  }

  private identifyOptimizationOpportunities(channels: ChannelMetrics[]) {
    const opportunities = []

    channels.forEach(channel => {
      const baseline = this.channelBaselines.get(channel.id)

      if (channel.averageLatency > 500) {
        opportunities.push({
          channelId: channel.id,
          type: 'performance',
          priority: 'high',
          description: 'High latency detected - consider optimization',
          estimatedImpact: `Potential ${(
            ((channel.averageLatency - 100) / channel.averageLatency) *
            100
          ).toFixed(0)}% latency reduction`
        })
      }

      const protectionRatio =
        Object.values(channel.protectionEvents || {}).reduce(
          (sum, val) => sum + val,
          0
        ) / Math.max(1, channel.calls)
      if (protectionRatio > 0.7) {
        opportunities.push({
          channelId: channel.id,
          type: 'configuration',
          priority: 'medium',
          description: 'High protection ratio - review thresholds',
          estimatedImpact: 'Improved responsiveness and reduced blocking'
        })
      }

      if (
        baseline &&
        channel.errorRate > baseline.avgErrorRate * 3 &&
        channel.errorRate > 0.05
      ) {
        opportunities.push({
          channelId: channel.id,
          type: 'reliability',
          priority: 'high',
          description: 'Error rate significantly above baseline',
          estimatedImpact: 'Improved system reliability and user experience'
        })
      }

      if (channel.calls > 100 && channel.executions / channel.calls < 0.5) {
        opportunities.push({
          channelId: channel.id,
          type: 'efficiency',
          priority: 'medium',
          description: 'Low execution ratio - many calls not completing',
          estimatedImpact: 'Better resource utilization and response times'
        })
      }
    })

    return opportunities.slice(0, 10) // Return top 10 opportunities
  }

  private generateEnhancedRecommendations(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): string[] {
    const recommendations = []

    // System-level recommendations
    const errorRate =
      events.filter(e => e.eventType === 'error').length /
      Math.max(1, events.length)
    if (errorRate > 0.1) {
      recommendations.push(
        'High system error rate detected - review error handling and monitoring'
      )
    }

    const avgLatency = this.calculateAverageLatency(events)
    if (avgLatency > 200) {
      recommendations.push(
        'System latency above optimal - consider performance optimization'
      )
    }

    // Channel-level recommendations
    const problematicChannels = channels.filter(
      c => c.errorRate > 0.2 || c.averageLatency > 1000
    )
    if (problematicChannels.length > 0) {
      recommendations.push(
        `${problematicChannels.length} channels need attention - review individual channel performance`
      )
    }

    // Historical trend recommendations
    const healthTrend = this.calculateTrendDirection(this.lastHealthScores)
    if (healthTrend === 'decreasing') {
      recommendations.push(
        'System health declining - investigate recent changes and monitor closely'
      )
    }

    return recommendations.slice(0, 5) // Top 5 recommendations
  }

  private calculateHealthTrends(factors: any) {
    // Simplified trend calculation - would need historical data for real trends
    return Object.keys(factors).map(key => ({
      factor: key as any,
      trend: 'stable' as const,
      changeRate: 0
    }))
  }
}

// Export singleton instance
export const liveAnalyzer = new EnhancedLiveAnalyzer()
