// src/metrics/unified-analyzer.ts
// Unified analyzer - no timers, only on-demand analysis

import {metricsCore} from './core'
import type {RawEvent, ChannelMetrics, SystemMetrics} from '../types/system'
import type {ActionId} from '../types/core'

/*

      C.Y.R.E - U.N.I.F.I.E.D - A.N.A.L.Y Z.E.R
      
      Single analyzer for ALL analysis:
      - No timers (orchestration handles scheduling)
      - On-demand analysis only
      - All analysis logic in one place
      - Standard interfaces

*/

export interface SystemAnalysis {
  timestamp: number
  timeWindow: number
  system: SystemMetrics
  pipeline: PipelineAnalysis
  protections: ProtectionAnalysis
  performance: PerformanceAnalysis
  health: HealthAnalysis
  anomalies: AnomalyAnalysis
  insights: InsightAnalysis
  recommendations: string[]
}

export interface PipelineAnalysis {
  totalCalls: number
  completedCalls: number
  failedCalls: number
  stuckCalls: number
  avgDuration: number
  efficiency: number
  bottlenecks: Array<{stage: string; count: number; avgDuration: number}>
  flowHealth: 'healthy' | 'degraded' | 'critical'
}

export interface ProtectionAnalysis {
  channels: Map<string, ChannelProtectionStats>
  overall: {
    effectiveness: number
    optimalChannels: number
    overProtected: number
    underProtected: number
    health: 'optimal' | 'suboptimal' | 'problematic'
  }
}

export interface ChannelProtectionStats {
  channelId: string
  throttleCount: number
  debounceCount: number
  blockCount: number
  skipCount: number
  callCount: number
  executionCount: number
  protectionRatio: number
  executionRatio: number
  effectiveness: number
  status: 'optimal' | 'over_protected' | 'under_protected' | 'problematic'
  recommendations: string[]
}

export interface PerformanceAnalysis {
  avgLatency: number
  p95Latency: number
  throughput: number
  successRate: number
  errorRate: number
  degradations: Array<{
    channelId: string
    type: 'latency' | 'throughput' | 'errors'
    severity: 'minor' | 'major' | 'critical'
    current: number
    expected: number
    impact: number
  }>
  trends: 'improving' | 'stable' | 'degrading'
}

export interface HealthAnalysis {
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

export interface AnomalyAnalysis {
  detected: boolean
  anomalies: Array<{
    type: 'statistical' | 'pattern' | 'sequence' | 'timing'
    channelId: string
    severity: 'low' | 'medium' | 'high'
    description: string
    confidence: number
  }>
  patterns: Array<{
    name: string
    channels: string[]
    frequency: number
  }>
}

export interface InsightAnalysis {
  totalActivity: number
  activeChannels: number
  peakThroughput: number
  systemEfficiency: number
  topPerformers: string[]
  problemChannels: string[]
  unusedChannels: string[]
  resourceUtilization: number
}

class UnifiedAnalyzer {
  private baselines = new Map<string, any>()

  /**
   * Main system analysis - on-demand only
   */
  analyzeSystem(timeWindow = 300000): SystemAnalysis {
    const events = metricsCore.getEvents({since: Date.now() - timeWindow})
    const systemMetrics = metricsCore.getSystemMetrics()
    const channelMetrics = metricsCore.getAllChannelMetrics()

    return {
      timestamp: Date.now(),
      timeWindow,
      system: systemMetrics,
      pipeline: this.analyzePipeline(events),
      protections: this.analyzeProtections(events, channelMetrics),
      performance: this.analyzePerformance(events, channelMetrics),
      health: this.analyzeHealth(events, channelMetrics),
      anomalies: this.detectAnomalies(events),
      insights: this.generateInsights(events, channelMetrics),
      recommendations: this.generateRecommendations(events, channelMetrics)
    }
  }

  /**
   * Channel-specific analysis
   */
  analyzeChannel(channelId: string, timeWindow = 300000) {
    const events = metricsCore.getEvents({
      actionId: channelId,
      since: Date.now() - timeWindow
    })
    const channelMetrics = metricsCore.getChannelMetrics(channelId)

    if (!channelMetrics) return null

    return {
      channelId,
      metrics: channelMetrics,
      pipeline: this.analyzeChannelPipeline(channelId, events),
      protections: this.analyzeChannelProtections(channelId, events),
      performance: this.analyzeChannelPerformance(channelId, events),
      health: this.analyzeChannelHealth(channelId, events),
      recommendations: this.generateChannelRecommendations(channelId, events)
    }
  }

  /**
   * Pipeline analysis from events
   */
  private analyzePipeline(events: RawEvent[]): PipelineAnalysis {
    const callEvents = events.filter(e => e.eventType === 'call')
    const executionEvents = events.filter(e => e.eventType === 'execution')
    const errorEvents = events.filter(e => e.eventType === 'error')

    // Group by call journeys
    const journeys = this.groupEventsByJourney(events)

    const completedJourneys = journeys.filter(j => j.hasExecution)
    const failedJourneys = journeys.filter(j => j.hasError && !j.hasExecution)
    const stuckJourneys = journeys.filter(
      j => !j.hasExecution && !j.hasError && Date.now() - j.startTime > 5000
    )

    // Calculate bottlenecks
    const stageStats = new Map<string, {count: number; totalDuration: number}>()

    events.forEach(event => {
      if (event.location && event.metadata?.duration) {
        const stage = event.location
        const duration = event.metadata.duration as number

        if (!stageStats.has(stage)) {
          stageStats.set(stage, {count: 0, totalDuration: 0})
        }

        const stats = stageStats.get(stage)!
        stats.count++
        stats.totalDuration += duration
      }
    })

    const bottlenecks = Array.from(stageStats.entries())
      .map(([stage, stats]) => ({
        stage,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5)

    const efficiency =
      callEvents.length > 0 ? executionEvents.length / callEvents.length : 1
    const avgDuration =
      completedJourneys.length > 0
        ? completedJourneys.reduce((sum, j) => sum + j.duration, 0) /
          completedJourneys.length
        : 0

    let flowHealth: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (efficiency < 0.5 || stuckJourneys.length > 3) flowHealth = 'critical'
    else if (efficiency < 0.8 || failedJourneys.length > 5)
      flowHealth = 'degraded'

    return {
      totalCalls: callEvents.length,
      completedCalls: completedJourneys.length,
      failedCalls: failedJourneys.length,
      stuckCalls: stuckJourneys.length,
      avgDuration,
      efficiency,
      bottlenecks,
      flowHealth
    }
  }

  /**
   * Protection analysis from events
   */
  private analyzeProtections(
    events: RawEvent[],
    channelMetrics: ChannelMetrics[]
  ): ProtectionAnalysis {
    const protectionEvents = events.filter(e =>
      ['throttle', 'debounce', 'blocked', 'skip'].includes(e.eventType)
    )

    const channelAnalysis = new Map<string, ChannelProtectionStats>()

    channelMetrics.forEach(channel => {
      const channelEvents = events.filter(e => e.actionId === channel.id)
      const channelProtections = protectionEvents.filter(
        e => e.actionId === channel.id
      )

      const throttleCount = channelProtections.filter(
        e => e.eventType === 'throttle'
      ).length
      const debounceCount = channelProtections.filter(
        e => e.eventType === 'debounce'
      ).length
      const blockCount = channelProtections.filter(
        e => e.eventType === 'blocked'
      ).length
      const skipCount = channelProtections.filter(
        e => e.eventType === 'skip'
      ).length

      const totalProtections =
        throttleCount + debounceCount + blockCount + skipCount
      const protectionRatio =
        channel.calls > 0 ? totalProtections / channel.calls : 0
      const executionRatio =
        channel.calls > 0 ? channel.executions / channel.calls : 1

      // Calculate effectiveness
      const effectiveness =
        channel.errors > 0
          ? Math.max(0, 1 - channel.errors / Math.max(totalProtections, 1))
          : 1

      let status: ChannelProtectionStats['status'] = 'optimal'
      const recommendations: string[] = []

      if (protectionRatio > 0.8 && channel.calls > 5) {
        status = 'over_protected'
        recommendations.push('Consider relaxing protection settings')
      } else if (protectionRatio === 0 && channel.errors > 2) {
        status = 'under_protected'
        recommendations.push('Consider adding protection mechanisms')
      } else if (effectiveness < 0.5 && totalProtections > 0) {
        status = 'problematic'
        recommendations.push(
          'Protection settings not preventing errors effectively'
        )
      }

      channelAnalysis.set(channel.id, {
        channelId: channel.id,
        throttleCount,
        debounceCount,
        blockCount,
        skipCount,
        callCount: channel.calls,
        executionCount: channel.executions,
        protectionRatio,
        executionRatio,
        effectiveness,
        status,
        recommendations
      })
    })

    const overallEffectiveness =
      channelAnalysis.size > 0
        ? Array.from(channelAnalysis.values()).reduce(
            (sum, c) => sum + c.effectiveness,
            0
          ) / channelAnalysis.size
        : 1

    const optimalChannels = Array.from(channelAnalysis.values()).filter(
      c => c.status === 'optimal'
    ).length
    const overProtected = Array.from(channelAnalysis.values()).filter(
      c => c.status === 'over_protected'
    ).length
    const underProtected = Array.from(channelAnalysis.values()).filter(
      c => c.status === 'under_protected'
    ).length

    let health: 'optimal' | 'suboptimal' | 'problematic' = 'optimal'
    if (
      overallEffectiveness < 0.6 ||
      overProtected + underProtected > channelAnalysis.size * 0.3
    ) {
      health = 'problematic'
    } else if (
      overallEffectiveness < 0.8 ||
      overProtected + underProtected > 0
    ) {
      health = 'suboptimal'
    }

    return {
      channels: channelAnalysis,
      overall: {
        effectiveness: overallEffectiveness,
        optimalChannels,
        overProtected,
        underProtected,
        health
      }
    }
  }

  /**
   * Performance analysis
   */
  private analyzePerformance(
    events: RawEvent[],
    channelMetrics: ChannelMetrics[]
  ): PerformanceAnalysis {
    const executionEvents = events.filter(
      e => e.eventType === 'execution' && e.metadata?.duration
    )
    const errorEvents = events.filter(e => e.eventType === 'error')

    const latencies = executionEvents
      .map(e => e.metadata?.duration as number)
      .filter(d => typeof d === 'number' && d > 0)
      .sort((a, b) => a - b)

    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0

    const p95Index = Math.floor(latencies.length * 0.95)
    const p95Latency =
      latencies.length > 0
        ? latencies[p95Index] || latencies[latencies.length - 1]
        : 0

    const totalCalls = events.filter(e => e.eventType === 'call').length
    const totalExecutions = events.filter(
      e => e.eventType === 'execution'
    ).length
    const throughput = totalCalls / (events.length > 0 ? 5 : 1)

    const successRate = totalCalls > 0 ? totalExecutions / totalCalls : 1
    const errorRate = totalCalls > 0 ? errorEvents.length / totalCalls : 0

    // Detect degradations
    const degradations: PerformanceAnalysis['degradations'] = []

    channelMetrics.forEach(channel => {
      const baseline = this.baselines.get(channel.id)

      if (baseline) {
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
              (channel.averageLatency - baseline.avgLatency) /
              baseline.avgLatency
          })
        }
      }
    })

    let trends: 'improving' | 'stable' | 'degrading' = 'stable'
    if (degradations.filter(d => d.severity === 'critical').length > 0)
      trends = 'degrading'
    else if (successRate > 0.95 && avgLatency < 20) trends = 'improving'

    return {
      avgLatency,
      p95Latency,
      throughput,
      successRate,
      errorRate,
      degradations,
      trends
    }
  }

  /**
   * Health analysis
   */
  private analyzeHealth(
    events: RawEvent[],
    channelMetrics: ChannelMetrics[]
  ): HealthAnalysis {
    const systemMetrics = metricsCore.getSystemMetrics()

    const availability =
      systemMetrics.totalCalls > 0
        ? systemMetrics.totalExecutions / systemMetrics.totalCalls
        : 1

    const avgLatency =
      channelMetrics.length > 0
        ? channelMetrics.reduce((sum, c) => sum + c.averageLatency, 0) /
          channelMetrics.length
        : 0

    const performance =
      avgLatency < 10 ? 1 : avgLatency < 50 ? 0.8 : avgLatency < 100 ? 0.5 : 0.2

    const avgSuccessRate =
      channelMetrics.length > 0
        ? channelMetrics.reduce((sum, c) => sum + c.successRate, 0) /
          channelMetrics.length
        : 1

    const reliability = avgSuccessRate

    const totalProtections = events.filter(e =>
      ['throttle', 'debounce', 'blocked', 'skip'].includes(e.eventType)
    ).length

    const efficiency =
      systemMetrics.totalCalls > 0
        ? 1 - totalProtections / systemMetrics.totalCalls
        : 1

    const score = Math.round(
      (availability * 0.3 +
        performance * 0.3 +
        reliability * 0.3 +
        efficiency * 0.1) *
        100
    )

    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy'
    const issues: string[] = []
    let criticalAlerts = 0

    if (score < 60) {
      overall = 'critical'
      criticalAlerts++
      issues.push('System health critically low')
    } else if (score < 80) {
      overall = 'degraded'
      issues.push('System performance degraded')
    }

    if (availability < 0.8) {
      issues.push(`Low availability: ${(availability * 100).toFixed(1)}%`)
      if (availability < 0.5) criticalAlerts++
    }

    if (avgLatency > 100) {
      issues.push(`High latency: ${avgLatency.toFixed(1)}ms`)
      if (avgLatency > 500) criticalAlerts++
    }

    return {
      overall,
      score,
      factors: {
        availability,
        performance,
        reliability,
        efficiency
      },
      issues,
      criticalAlerts
    }
  }

  /**
   * Anomaly detection
   */
  private detectAnomalies(events: RawEvent[]): AnomalyAnalysis {
    const anomalies: AnomalyAnalysis['anomalies'] = []

    // Statistical anomalies - burst of events
    const eventCounts = new Map<string, number>()
    events.forEach(event => {
      eventCounts.set(
        event.actionId,
        (eventCounts.get(event.actionId) || 0) + 1
      )
    })

    const avgEventCount =
      Array.from(eventCounts.values()).reduce((sum, count) => sum + count, 0) /
      eventCounts.size
    const threshold = avgEventCount * 3

    eventCounts.forEach((count, channelId) => {
      if (count > threshold && count > 10) {
        anomalies.push({
          type: 'statistical',
          channelId,
          severity: count > threshold * 2 ? 'high' : 'medium',
          description: `Event burst: ${count} events vs ${avgEventCount.toFixed(
            1
          )} average`,
          confidence: Math.min(0.95, (count / threshold) * 0.3 + 0.5)
        })
      }
    })

    return {
      detected: anomalies.length > 0,
      anomalies,
      patterns: []
    }
  }

  /**
   * Generate insights
   */
  private generateInsights(
    events: RawEvent[],
    channelMetrics: ChannelMetrics[]
  ): InsightAnalysis {
    const activeChannels = channelMetrics.filter(c => c.calls > 0)
    const totalActivity = events.length

    const timeWindows = new Map<number, number>()
    events.forEach(event => {
      const window = Math.floor(event.timestamp / 5000) * 5000
      timeWindows.set(window, (timeWindows.get(window) || 0) + 1)
    })
    const peakThroughput = Math.max(...Array.from(timeWindows.values()), 0)

    const totalCalls = events.filter(e => e.eventType === 'call').length
    const totalExecutions = events.filter(
      e => e.eventType === 'execution'
    ).length
    const systemEfficiency = totalCalls > 0 ? totalExecutions / totalCalls : 1

    const sortedByLatency = [...activeChannels].sort(
      (a, b) => a.averageLatency - b.averageLatency
    )
    const topPerformers = sortedByLatency.slice(0, 3).map(c => c.id)

    const problemChannels = activeChannels
      .filter(c => c.successRate < 0.8 || c.averageLatency > 100)
      .map(c => c.id)

    const unusedChannels = channelMetrics
      .filter(c => c.calls === 0)
      .map(c => c.id)

    const resourceUtilization = activeChannels.length / channelMetrics.length

    return {
      totalActivity,
      activeChannels: activeChannels.length,
      peakThroughput,
      systemEfficiency,
      topPerformers,
      problemChannels,
      unusedChannels,
      resourceUtilization
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    events: RawEvent[],
    channelMetrics: ChannelMetrics[]
  ): string[] {
    const recommendations: string[] = []

    const problemChannels = channelMetrics.filter(
      c => c.successRate < 0.8 || c.averageLatency > 100
    )
    if (problemChannels.length > 0) {
      recommendations.push(
        `Optimize ${problemChannels.length} underperforming channels`
      )
    }

    const totalCalls = events.filter(e => e.eventType === 'call').length
    const totalExecutions = events.filter(
      e => e.eventType === 'execution'
    ).length
    const efficiency = totalCalls > 0 ? totalExecutions / totalCalls : 1

    if (efficiency < 0.7) {
      recommendations.push(
        'Improve pipeline efficiency - many calls not completing'
      )
    }

    const errorEvents = events.filter(e => e.eventType === 'error')
    if (errorEvents.length > totalCalls * 0.1) {
      recommendations.push(
        'High error rate detected - investigate error patterns'
      )
    }

    return recommendations
  }

  // Helper methods
  private groupEventsByJourney(events: RawEvent[]) {
    const journeys = new Map<
      string,
      {
        startTime: number
        duration: number
        hasExecution: boolean
        hasError: boolean
        events: RawEvent[]
      }
    >()

    events.forEach(event => {
      const key = `${event.actionId}-${Math.floor(event.timestamp / 1000)}`

      if (!journeys.has(key)) {
        journeys.set(key, {
          startTime: event.timestamp,
          duration: 0,
          hasExecution: false,
          hasError: false,
          events: []
        })
      }

      const journey = journeys.get(key)!
      journey.events.push(event)
      journey.duration = event.timestamp - journey.startTime

      if (event.eventType === 'execution') journey.hasExecution = true
      if (event.eventType === 'error') journey.hasError = true
    })

    return Array.from(journeys.values())
  }

  // Channel-specific analysis methods
  private analyzeChannelPipeline(channelId: string, events: RawEvent[]) {
    const calls = events.filter(e => e.eventType === 'call').length
    const executions = events.filter(e => e.eventType === 'execution').length
    const efficiency = calls > 0 ? executions / calls : 1

    return {
      calls,
      executions,
      efficiency,
      status:
        efficiency > 0.9
          ? 'healthy'
          : efficiency > 0.7
          ? 'degraded'
          : 'critical'
    }
  }

  private analyzeChannelProtections(channelId: string, events: RawEvent[]) {
    const protections = events.filter(e =>
      ['throttle', 'debounce', 'blocked', 'skip'].includes(e.eventType)
    )

    return {
      total: protections.length,
      throttle: protections.filter(e => e.eventType === 'throttle').length,
      debounce: protections.filter(e => e.eventType === 'debounce').length,
      blocked: protections.filter(e => e.eventType === 'blocked').length,
      skipped: protections.filter(e => e.eventType === 'skip').length
    }
  }

  private analyzeChannelPerformance(channelId: string, events: RawEvent[]) {
    const executions = events.filter(e => e.eventType === 'execution')
    const latencies = executions
      .map(e => e.metadata?.duration as number)
      .filter(d => typeof d === 'number')

    return {
      avgLatency:
        latencies.length > 0
          ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
          : 0,
      executions: executions.length,
      trend: 'stable' as const
    }
  }

  private analyzeChannelHealth(channelId: string, events: RawEvent[]) {
    const calls = events.filter(e => e.eventType === 'call').length
    const executions = events.filter(e => e.eventType === 'execution').length
    const errors = events.filter(e => e.eventType === 'error').length

    const successRate = calls > 0 ? executions / calls : 1
    const errorRate = calls > 0 ? errors / calls : 0

    return {
      status:
        successRate > 0.9
          ? 'healthy'
          : successRate > 0.7
          ? 'degraded'
          : 'critical',
      successRate,
      errorRate
    }
  }

  private generateChannelRecommendations(
    channelId: string,
    events: RawEvent[]
  ) {
    const recommendations: string[] = []

    const calls = events.filter(e => e.eventType === 'call').length
    const executions = events.filter(e => e.eventType === 'execution').length

    if (calls > 0 && executions / calls < 0.7) {
      recommendations.push('Low execution ratio - check pipeline configuration')
    }

    return recommendations
  }

  /**
   * Learn baselines for comparison
   */
  learnBaselines(period = 24 * 60 * 60 * 1000) {
    const events = metricsCore.getEvents({since: Date.now() - period})
    const channels = metricsCore.getAllChannelMetrics()

    channels.forEach(channel => {
      this.baselines.set(channel.id, {
        avgLatency: channel.averageLatency,
        successRate: channel.successRate,
        calls: channel.calls,
        executions: channel.executions
      })
    })

    console.log(`📚 Learned baselines for ${channels.length} channels`)
  }
}

// Export singleton instance
export const unifiedAnalyzer = new UnifiedAnalyzer()

// Standard API (no monitoring methods - orchestration handles that)
export const analyzer = {
  // Main analysis methods
  analyzeSystem: (timeWindow?: number) =>
    unifiedAnalyzer.analyzeSystem(timeWindow),
  analyzeChannel: (channelId: string, timeWindow?: number) =>
    unifiedAnalyzer.analyzeChannel(channelId, timeWindow),

  // Learning
  learnBaselines: (period?: number) => unifiedAnalyzer.learnBaselines(period)
}
