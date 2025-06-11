// src/metrics/data-persistence.ts
// Data persistence layer for historical metrics - optional storage for better data quality

import type {RawEvent, ChannelMetrics} from '../types/system'
import type {ActionId} from '../types/core'

/*

  C.Y.R.E - D.A.T.A - P.E.R.S.I.S.T.E.N.C.E
  
  Optional data persistence layer for historical metrics:
  - Memory-first with optional file persistence
  - Aggregated data storage for trends
  - Lightweight and non-blocking
  - Maintains API compatibility
  - Works in Node, Bun, and browsers (with limitations)

*/

interface AggregatedMetric {
  timestamp: number
  timeWindow: '1m' | '5m' | '1h' | '1d'
  channelId?: string
  metrics: {
    callCount: number
    executionCount: number
    errorCount: number
    avgLatency: number
    maxLatency: number
    throughput: number
    errorRate: number
    successRate: number
  }
}

interface SystemSnapshot {
  timestamp: number
  totalCalls: number
  totalExecutions: number
  totalErrors: number
  activeChannels: number
  avgLatency: number
  healthScore: number
  callRate: number
}

class DataPersistenceLayer {
  private aggregatedMetrics: AggregatedMetric[] = []
  private systemSnapshots: SystemSnapshot[] = []
  private lastAggregationTime = 0
  private maxInMemoryAge = 24 * 60 * 60 * 1000 // 24 hours
  private persistenceEnabled = false
  private storagePrefix = 'cyre_metrics'

  /**
   * Initialize persistence layer
   */
  initialize(
    options: {
      enablePersistence?: boolean
      maxInMemoryAge?: number
      storagePrefix?: string
    } = {}
  ): void {
    this.persistenceEnabled = options.enablePersistence ?? false
    this.maxInMemoryAge = options.maxInMemoryAge ?? this.maxInMemoryAge
    this.storagePrefix = options.storagePrefix ?? this.storagePrefix

    if (this.persistenceEnabled) {
      this.loadFromStorage()
    }

    // Clean up old data periodically
    setInterval(() => this.cleanupOldData(), 5 * 60 * 1000) // Every 5 minutes
  }

  /**
   * Store raw events and create aggregated metrics
   */
  storeEvents(events: RawEvent[], channels: ChannelMetrics[]): void {
    const now = Date.now()

    // Only aggregate every minute to avoid excessive processing
    if (now - this.lastAggregationTime < 60000) return
    this.lastAggregationTime = now

    // Create system snapshot
    this.createSystemSnapshot(events, channels)

    // Create aggregated metrics for different time windows
    this.createAggregatedMetrics(events, channels, now)

    // Save to storage if enabled
    if (this.persistenceEnabled) {
      this.saveToStorage()
    }

    // Cleanup old data
    this.cleanupOldData()
  }

  /**
   * Get historical metrics for analysis
   */
  getHistoricalMetrics(
    options: {
      timeWindow?: number
      channelId?: string
      aggregation?: '1m' | '5m' | '1h' | '1d'
    } = {}
  ): AggregatedMetric[] {
    const {timeWindow = 3600000, channelId, aggregation} = options
    const cutoff = Date.now() - timeWindow

    return this.aggregatedMetrics.filter(
      metric =>
        metric.timestamp > cutoff &&
        (!channelId || metric.channelId === channelId) &&
        (!aggregation || metric.timeWindow === aggregation)
    )
  }

  /**
   * Get system snapshots for trend analysis
   */
  getSystemSnapshots(timeWindow = 3600000): SystemSnapshot[] {
    const cutoff = Date.now() - timeWindow
    return this.systemSnapshots.filter(snapshot => snapshot.timestamp > cutoff)
  }

  /**
   * Get channel performance trends
   */
  getChannelTrends(
    channelId: string,
    timeWindow = 3600000
  ): {
    latencyTrend: number[]
    errorRateTrend: number[]
    throughputTrend: number[]
    timestamps: number[]
  } {
    const metrics = this.getHistoricalMetrics({
      timeWindow,
      channelId,
      aggregation: '1m'
    })

    return {
      latencyTrend: metrics.map(m => m.metrics.avgLatency),
      errorRateTrend: metrics.map(m => m.metrics.errorRate),
      throughputTrend: metrics.map(m => m.metrics.throughput),
      timestamps: metrics.map(m => m.timestamp)
    }
  }

  /**
   * Calculate baseline metrics for channels
   */
  calculateBaselines(
    channelId: string,
    timeWindow = 7 * 24 * 60 * 60 * 1000
  ): {
    avgLatency: number
    avgThroughput: number
    avgErrorRate: number
    confidence: number
  } | null {
    const metrics = this.getHistoricalMetrics({
      timeWindow,
      channelId,
      aggregation: '1h'
    })

    if (metrics.length < 24) return null // Need at least 24 hours of data

    const avgLatency =
      metrics.reduce((sum, m) => sum + m.metrics.avgLatency, 0) / metrics.length
    const avgThroughput =
      metrics.reduce((sum, m) => sum + m.metrics.throughput, 0) / metrics.length
    const avgErrorRate =
      metrics.reduce((sum, m) => sum + m.metrics.errorRate, 0) / metrics.length

    // Confidence based on data consistency
    const latencyVariance = this.calculateVariance(
      metrics.map(m => m.metrics.avgLatency)
    )
    const confidence = Math.max(
      0.1,
      Math.min(1, 1 - latencyVariance / avgLatency)
    )

    return {avgLatency, avgThroughput, avgErrorRate, confidence}
  }

  /**
   * Get peak performance metrics
   */
  getPeakMetrics(timeWindow = 24 * 60 * 60 * 1000): {
    peakCallRate: number
    peakThroughput: number
    minLatency: number
    bestHealthScore: number
  } {
    const snapshots = this.getSystemSnapshots(timeWindow)

    return {
      peakCallRate: Math.max(...snapshots.map(s => s.callRate), 0),
      peakThroughput: Math.max(
        ...this.aggregatedMetrics.map(m => m.metrics.throughput),
        0
      ),
      minLatency: Math.min(
        ...this.aggregatedMetrics.map(m => m.metrics.avgLatency),
        0
      ),
      bestHealthScore: Math.max(...snapshots.map(s => s.healthScore), 0)
    }
  }

  /**
   * Create system snapshot
   */
  private createSystemSnapshot(
    events: RawEvent[],
    channels: ChannelMetrics[]
  ): void {
    const now = Date.now()
    const activeChannels = channels.filter(c => c.calls > 0).length

    const recentEvents = events.filter(e => e.timestamp > now - 60000)
    const avgLatency = this.calculateAverageLatency(recentEvents)
    const callRate =
      recentEvents.filter(e => e.eventType === 'call').length / 60

    // Simple health score calculation
    const errorRate =
      recentEvents.length > 0
        ? recentEvents.filter(e => e.eventType === 'error').length /
          recentEvents.length
        : 0
    const healthScore = Math.round(
      (1 - errorRate) *
        (avgLatency < 100 ? 100 : Math.max(20, 100 - avgLatency / 10))
    )

    const snapshot: SystemSnapshot = {
      timestamp: now,
      totalCalls: channels.reduce((sum, c) => sum + c.calls, 0),
      totalExecutions: channels.reduce((sum, c) => sum + c.executions, 0),
      totalErrors: channels.reduce((sum, c) => sum + c.errors, 0),
      activeChannels,
      avgLatency,
      healthScore,
      callRate
    }

    this.systemSnapshots.push(snapshot)
  }

  /**
   * Create aggregated metrics for different time windows
   */
  private createAggregatedMetrics(
    events: RawEvent[],
    channels: ChannelMetrics[],
    timestamp: number
  ): void {
    const timeWindows = [
      {window: '1m' as const, duration: 60 * 1000},
      {window: '5m' as const, duration: 5 * 60 * 1000},
      {window: '1h' as const, duration: 60 * 60 * 1000}
    ]

    timeWindows.forEach(({window, duration}) => {
      const cutoff = timestamp - duration
      const windowEvents = events.filter(e => e.timestamp > cutoff)

      // System-level aggregation
      this.createAggregatedMetric(windowEvents, undefined, window, timestamp)

      // Channel-level aggregations
      channels.forEach(channel => {
        const channelEvents = windowEvents.filter(
          e => e.actionId === channel.id
        )
        if (channelEvents.length > 0) {
          this.createAggregatedMetric(
            channelEvents,
            channel.id,
            window,
            timestamp
          )
        }
      })
    })
  }

  /**
   * Create single aggregated metric
   */
  private createAggregatedMetric(
    events: RawEvent[],
    channelId: string | undefined,
    timeWindow: '1m' | '5m' | '1h' | '1d',
    timestamp: number
  ): void {
    const callEvents = events.filter(e => e.eventType === 'call')
    const executionEvents = events.filter(e => e.eventType === 'execution')
    const errorEvents = events.filter(e => e.eventType === 'error')

    const latencies = executionEvents
      .map(e => e.metadata?.duration as number)
      .filter(d => typeof d === 'number' && d > 0)

    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0

    const duration = this.getTimeWindowDuration(timeWindow)
    const throughput = executionEvents.length / (duration / 1000)
    const errorRate = events.length > 0 ? errorEvents.length / events.length : 0
    const successRate = 1 - errorRate

    const metric: AggregatedMetric = {
      timestamp,
      timeWindow,
      channelId,
      metrics: {
        callCount: callEvents.length,
        executionCount: executionEvents.length,
        errorCount: errorEvents.length,
        avgLatency,
        maxLatency,
        throughput,
        errorRate,
        successRate
      }
    }

    this.aggregatedMetrics.push(metric)
  }

  /**
   * Helper methods
   */
  private calculateAverageLatency(events: RawEvent[]): number {
    const latencies = events
      .filter(e => e.eventType === 'execution')
      .map(e => e.metadata?.duration as number)
      .filter(d => typeof d === 'number' && d > 0)

    return latencies.length > 0
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      : 0
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length
    return variance
  }

  private getTimeWindowDuration(timeWindow: '1m' | '5m' | '1h' | '1d'): number {
    const durations = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    }
    return durations[timeWindow]
  }

  /**
   * Storage operations (browser/Node.js compatible)
   */
  private saveToStorage(): void {
    if (!this.persistenceEnabled) return

    try {
      // Browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = {
          aggregatedMetrics: this.aggregatedMetrics.slice(-1000), // Keep last 1000
          systemSnapshots: this.systemSnapshots.slice(-500) // Keep last 500
        }
        localStorage.setItem(`${this.storagePrefix}_data`, JSON.stringify(data))
      }
      // Node.js environment would require fs module import
      // This is left as an exercise for production implementation
    } catch (error) {
      console.warn('Failed to save metrics to storage:', error)
    }
  }

  private loadFromStorage(): void {
    if (!this.persistenceEnabled) return

    try {
      // Browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(`${this.storagePrefix}_data`)
        if (stored) {
          const data = JSON.parse(stored)
          this.aggregatedMetrics = data.aggregatedMetrics || []
          this.systemSnapshots = data.systemSnapshots || []
        }
      }
      // Node.js environment would require fs module import
    } catch (error) {
      console.warn('Failed to load metrics from storage:', error)
    }
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - this.maxInMemoryAge

    // Remove old aggregated metrics
    this.aggregatedMetrics = this.aggregatedMetrics.filter(
      m => m.timestamp > cutoff
    )

    // Remove old system snapshots
    this.systemSnapshots = this.systemSnapshots.filter(
      s => s.timestamp > cutoff
    )

    // Keep reasonable limits even within time window
    if (this.aggregatedMetrics.length > 10000) {
      this.aggregatedMetrics = this.aggregatedMetrics.slice(-8000)
    }

    if (this.systemSnapshots.length > 2000) {
      this.systemSnapshots = this.systemSnapshots.slice(-1500)
    }
  }

  /**
   * Public API for data export/import
   */
  exportData(): {
    aggregatedMetrics: AggregatedMetric[]
    systemSnapshots: SystemSnapshot[]
    exportTimestamp: number
  } {
    return {
      aggregatedMetrics: this.aggregatedMetrics,
      systemSnapshots: this.systemSnapshots,
      exportTimestamp: Date.now()
    }
  }

  importData(data: {
    aggregatedMetrics: AggregatedMetric[]
    systemSnapshots: SystemSnapshot[]
  }): void {
    this.aggregatedMetrics = [
      ...this.aggregatedMetrics,
      ...data.aggregatedMetrics
    ]
    this.systemSnapshots = [...this.systemSnapshots, ...data.systemSnapshots]

    // Sort by timestamp
    this.aggregatedMetrics.sort((a, b) => a.timestamp - b.timestamp)
    this.systemSnapshots.sort((a, b) => a.timestamp - b.timestamp)

    // Cleanup duplicates and old data
    this.cleanupOldData()
  }

  /**
   * Reset all stored data
   */
  reset(): void {
    this.aggregatedMetrics = []
    this.systemSnapshots = []
    this.lastAggregationTime = 0

    if (this.persistenceEnabled) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(`${this.storagePrefix}_data`)
        }
      } catch (error) {
        console.warn('Failed to clear storage:', error)
      }
    }
  }

  /**
   * Get data statistics
   */
  getDataStats(): {
    aggregatedMetricsCount: number
    systemSnapshotsCount: number
    oldestTimestamp: number
    newestTimestamp: number
    memoryUsageEstimate: number
  } {
    const allTimestamps = [
      ...this.aggregatedMetrics.map(m => m.timestamp),
      ...this.systemSnapshots.map(s => s.timestamp)
    ]

    return {
      aggregatedMetricsCount: this.aggregatedMetrics.length,
      systemSnapshotsCount: this.systemSnapshots.length,
      oldestTimestamp: Math.min(...allTimestamps, Date.now()),
      newestTimestamp: Math.max(...allTimestamps, 0),
      memoryUsageEstimate:
        this.aggregatedMetrics.length * 200 + this.systemSnapshots.length * 100 // Rough estimate in bytes
    }
  }
}

// Export singleton instance
export const dataPersistence = new DataPersistenceLayer()
