// src/metrics/enhanced-core.ts
// Enhanced metrics core with historical data integration

import type {ActionId} from '../types/core'
import {createStore} from '../context/create-store'
import type {
  RawEvent,
  SensorEvent,
  SystemMetrics,
  ChannelMetrics,
  MetricEvent
} from '../types/system'
import {log, LogLevel} from '../components/cyre-log'
import {dataPersistence} from './data-persistence'

/*

      C.Y.R.E - E.N.H.A.N.C.E.D - M.E.T.R.I.C.S - C.O.R.E
      
      Enhanced metrics core with historical data support:
      - All original functionality preserved
      - Integrated historical data persistence
      - Better call rate calculations using historical data
      - Enhanced system metrics with trends
      - Maintains existing API structure
      - Optional persistence for better data quality

*/

// Event storage (existing)
const eventStore = createStore<RawEvent>()
const channelStore = createStore<ChannelMetrics>()

// Enhanced system state with historical tracking
let systemMetrics = {
  totalCalls: 0,
  totalExecutions: 0,
  totalErrors: 0,
  callRate: 0,
  lastCallTime: Date.now(),
  startTime: Date.now(),
  uptime: 0
}

let eventSequence = 0
let cleanupTimer: NodeJS.Timeout | undefined
let persistenceTimer: NodeJS.Timeout | undefined

// Historical tracking for better call rate calculation
let callRateHistory: Array<{timestamp: number; count: number}> = []
let lastCallRateUpdate = Date.now()

/**
 * Enhanced core metrics interface
 */
export const enhancedMetricsCore = {
  /**
   * Record event - enhanced with historical tracking
   */
  record: (event: SensorEvent): void => {
    const rawEvent: RawEvent = {
      ...event,
      id: `evt-${eventSequence++}`,
      timestamp: Date.now()
    }

    // Store event (existing functionality)
    eventStore.set(rawEvent.id, rawEvent)

    // Update metrics with enhanced tracking
    updateEnhancedMetrics(rawEvent)

    // Terminal output if requested (existing functionality)
    if (event.log) {
      sendToLog(event.logLevel || 'DEBUG', formatMessage(event))
    }

    // Enhanced periodic operations
    if (eventSequence % 50 === 0) {
      updateHistoricalData()
      scheduleCleanup()
    }
  },

  // Enhanced query interfaces
  getSystemMetrics: (): SystemMetrics => {
    const enhancedCallRate = calculateEnhancedCallRate()
    return {
      ...systemMetrics,
      uptime: Date.now() - systemMetrics.startTime,
      callRate: enhancedCallRate
    }
  },

  getEnhancedSystemMetrics: () => {
    const baseMetrics = enhancedMetricsCore.getSystemMetrics()
    const peakMetrics = dataPersistence.getPeakMetrics()
    const snapshots = dataPersistence.getSystemSnapshots(3600000) // Last hour

    return {
      ...baseMetrics,
      enhanced: {
        peakCallRate: peakMetrics.peakCallRate,
        avgCallRateLastHour:
          snapshots.length > 0
            ? snapshots.reduce((sum, s) => sum + s.callRate, 0) /
              snapshots.length
            : baseMetrics.callRate,
        systemLoadPercentage:
          peakMetrics.peakCallRate > 0
            ? Math.round(
                (baseMetrics.callRate / peakMetrics.peakCallRate) * 100
              )
            : 0,
        healthTrend: calculateHealthTrend(snapshots),
        dataQuality: calculateDataQuality()
      }
    }
  },

  getChannelMetrics: (actionId: ActionId): ChannelMetrics | undefined =>
    channelStore.get(actionId),

  getAllChannelMetrics: (): ChannelMetrics[] => channelStore.getAll(),

  getEnhancedChannelMetrics: (actionId: ActionId) => {
    const baseMetrics = channelStore.get(actionId)
    if (!baseMetrics) return undefined

    const trends = dataPersistence.getChannelTrends(actionId)
    const baseline = dataPersistence.calculateBaselines(actionId)

    return {
      ...baseMetrics,
      enhanced: {
        trends,
        baseline,
        performanceScore: calculateChannelPerformanceScore(
          baseMetrics,
          baseline
        ),
        recommendations: generateChannelRecommendations(
          baseMetrics,
          baseline,
          trends
        )
      }
    }
  },

  getAllEnhancedChannelMetrics: () => {
    return channelStore
      .getAll()
      .map(channel => ({
        ...enhancedMetricsCore.getEnhancedChannelMetrics(channel.id),
        id: channel.id
      }))
      .filter(Boolean)
  },

  getEvents: (filter?: {
    actionId?: ActionId
    eventType?: MetricEvent
    since?: number
    limit?: number
  }): RawEvent[] => {
    let events = eventStore.getAll()

    if (filter) {
      if (filter.actionId) {
        events = events.filter(e => e.actionId === filter.actionId)
      }
      if (filter.eventType) {
        events = events.filter(e => e.eventType === filter.eventType)
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!)
      }
    }

    // Sort newest first
    events.sort((a, b) => b.timestamp - a.timestamp)

    return filter?.limit ? events.slice(0, filter.limit) : events
  },

  // Historical data access
  getHistoricalMetrics:
    dataPersistence.getHistoricalMetrics.bind(dataPersistence),
  getSystemSnapshots: dataPersistence.getSystemSnapshots.bind(dataPersistence),
  getChannelTrends: dataPersistence.getChannelTrends.bind(dataPersistence),
  calculateBaselines: dataPersistence.calculateBaselines.bind(dataPersistence),
  getPeakMetrics: dataPersistence.getPeakMetrics.bind(dataPersistence),

  // System control
  reset: (): void => {
    eventStore.clear()
    channelStore.clear()
    systemMetrics = {
      totalCalls: 0,
      totalExecutions: 0,
      totalErrors: 0,
      callRate: 0,
      lastCallTime: Date.now(),
      startTime: Date.now(),
      uptime: 0
    }
    eventSequence = 0
    callRateHistory = []
    lastCallRateUpdate = Date.now()
    dataPersistence.reset()
  },

  initialize: (config?: {
    maxEvents?: number
    retentionTime?: number
    cleanupInterval?: number
    enablePersistence?: boolean
    persistenceInterval?: number
  }): void => {
    const {
      retentionTime = 3600000,
      cleanupInterval = 300000,
      enablePersistence = false,
      persistenceInterval = 60000
    } = config || {}

    // Initialize data persistence
    dataPersistence.initialize({
      enablePersistence,
      maxInMemoryAge: retentionTime * 24, // Keep 24x retention time in persistence
      storagePrefix: 'cyre_metrics'
    })

    // Setup cleanup timer
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
    }
    cleanupTimer = setInterval(() => {
      cleanupOldEvents(retentionTime)
    }, cleanupInterval)

    // Setup persistence timer
    if (persistenceTimer) {
      clearInterval(persistenceTimer)
    }
    if (enablePersistence) {
      persistenceTimer = setInterval(() => {
        updateHistoricalData()
      }, persistenceInterval)
    }
  },

  shutdown: (): void => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = undefined
    }
    if (persistenceTimer) {
      clearInterval(persistenceTimer)
      persistenceTimer = undefined
    }
  },

  // Data export/import for backup/restore
  exportData: () => ({
    ...dataPersistence.exportData(),
    currentState: {
      systemMetrics,
      events: eventStore.getAll(),
      channels: channelStore.getAll(),
      callRateHistory,
      eventSequence
    }
  }),

  importData: (data: any) => {
    // Import historical data
    if (data.aggregatedMetrics && data.systemSnapshots) {
      dataPersistence.importData({
        aggregatedMetrics: data.aggregatedMetrics,
        systemSnapshots: data.systemSnapshots
      })
    }

    // Import current state if available
    if (data.currentState) {
      const state = data.currentState
      systemMetrics = state.systemMetrics || systemMetrics
      callRateHistory = state.callRateHistory || []
      eventSequence = state.eventSequence || 0

      // Restore events and channels
      if (state.events) {
        state.events.forEach((event: RawEvent) =>
          eventStore.set(event.id, event)
        )
      }
      if (state.channels) {
        state.channels.forEach((channel: ChannelMetrics) =>
          channelStore.set(channel.id, channel)
        )
      }
    }
  },

  // Statistics and health
  getDataStats: () => ({
    ...dataPersistence.getDataStats(),
    currentEvents: eventStore.getAll().length,
    currentChannels: channelStore.getAll().length,
    callRateHistoryLength: callRateHistory.length,
    dataQuality: calculateDataQuality()
  })
}

/**
 * Enhanced metrics update with historical tracking
 */
const updateEnhancedMetrics = (event: RawEvent): void => {
  // Update system metrics (existing functionality)
  switch (event.eventType) {
    case 'call':
      systemMetrics.totalCalls++
      systemMetrics.lastCallTime = event.timestamp
      updateCallRateHistory()
      break
    case 'execution':
      systemMetrics.totalExecutions++
      break
    case 'error':
      systemMetrics.totalErrors++
      break
  }

  // Update channel metrics (existing functionality)
  updateChannelMetrics(event)
}

/**
 * Enhanced call rate calculation using historical data
 */
const calculateEnhancedCallRate = (): number => {
  const now = Date.now()
  const oneMinuteAgo = now - 60000

  // Remove old entries
  callRateHistory = callRateHistory.filter(
    entry => entry.timestamp > oneMinuteAgo
  )

  if (callRateHistory.length < 2) {
    // Fallback to simple calculation
    const recentEvents = eventStore
      .getAll()
      .filter(e => e.eventType === 'call' && e.timestamp > oneMinuteAgo)
    return recentEvents.length / 60
  }

  // Calculate rate from historical data
  const totalCalls = callRateHistory.reduce(
    (sum, entry) => sum + entry.count,
    0
  )
  const timeSpan = (now - callRateHistory[0].timestamp) / 1000

  return timeSpan > 0 ? totalCalls / timeSpan : 0
}

/**
 * Update call rate history for better calculation
 */
const updateCallRateHistory = (): void => {
  const now = Date.now()

  // Update every 5 seconds
  if (now - lastCallRateUpdate < 5000) return

  const fiveSecondsAgo = now - 5000
  const recentCalls = eventStore
    .getAll()
    .filter(e => e.eventType === 'call' && e.timestamp > fiveSecondsAgo).length

  callRateHistory.push({
    timestamp: now,
    count: recentCalls
  })

  // Keep only last 12 entries (1 minute of 5-second intervals)
  if (callRateHistory.length > 12) {
    callRateHistory.shift()
  }

  lastCallRateUpdate = now
}

/**
 * Update historical data in persistence layer
 */
const updateHistoricalData = (): void => {
  const events = eventStore.getAll()
  const channels = channelStore.getAll()
  dataPersistence.storeEvents(events, channels)
}

/**
 * Calculate health trend from system snapshots
 */
const calculateHealthTrend = (
  snapshots: any[]
): 'improving' | 'stable' | 'degrading' => {
  if (snapshots.length < 3) return 'stable'

  const recent = snapshots.slice(-5).map(s => s.healthScore)
  const slope = calculateSlope(recent)

  if (slope > 2) return 'improving'
  if (slope < -2) return 'degrading'
  return 'stable'
}

/**
 * Calculate data quality score
 */
const calculateDataQuality = (): number => {
  const stats = dataPersistence.getDataStats()
  const currentEvents = eventStore.getAll().length

  let score = 0

  // Event coverage (0-30 points)
  if (currentEvents > 100) score += 30
  else if (currentEvents > 10) score += 15
  else if (currentEvents > 0) score += 5

  // Historical data depth (0-30 points)
  const hoursOfData = (Date.now() - stats.oldestTimestamp) / (1000 * 60 * 60)
  if (hoursOfData > 24) score += 30
  else if (hoursOfData > 1) score += Math.round(hoursOfData * 1.25)

  // Data consistency (0-25 points)
  if (stats.aggregatedMetricsCount > 100) score += 25
  else if (stats.aggregatedMetricsCount > 10) score += 15
  else if (stats.aggregatedMetricsCount > 0) score += 5

  // Call rate history (0-15 points)
  if (callRateHistory.length >= 10) score += 15
  else if (callRateHistory.length >= 5) score += 10
  else if (callRateHistory.length > 0) score += 5

  return Math.min(100, score)
}

/**
 * Calculate channel performance score
 */
const calculateChannelPerformanceScore = (
  metrics: ChannelMetrics,
  baseline: any
): number => {
  let score = 100

  // Error rate impact
  score -= metrics.errorRate * 30

  // Latency impact
  if (baseline && baseline.avgLatency > 0) {
    const latencyRatio = metrics.averageLatency / baseline.avgLatency
    if (latencyRatio > 1.5) score -= (latencyRatio - 1) * 20
  } else if (metrics.averageLatency > 100) {
    score -= Math.min(30, metrics.averageLatency / 10)
  }

  // Success rate boost
  score += (metrics.successRate - 0.9) * 20

  return Math.max(0, Math.min(100, score))
}

/**
 * Generate channel recommendations based on data
 */
const generateChannelRecommendations = (
  metrics: ChannelMetrics,
  baseline: any,
  trends: any
): string[] => {
  const recommendations = []

  if (metrics.errorRate > 0.1) {
    recommendations.push('High error rate - investigate error causes')
  }

  if (baseline && metrics.averageLatency > baseline.avgLatency * 2) {
    recommendations.push(
      'Latency significantly above baseline - performance optimization needed'
    )
  }

  if (trends.latencyTrend.length > 0) {
    const recentLatency = trends.latencyTrend.slice(-3)
    const isIncreasing = recentLatency.every(
      (val, i) => i === 0 || val >= recentLatency[i - 1]
    )
    if (isIncreasing) {
      recommendations.push('Latency trend increasing - monitor closely')
    }
  }

  const protectionRatio =
    Object.values(metrics.protectionEvents || {}).reduce(
      (sum: number, val: number) => sum + val,
      0
    ) / Math.max(1, metrics.calls)
  if (protectionRatio > 0.5) {
    recommendations.push(
      'High protection ratio - consider adjusting thresholds'
    )
  }

  return recommendations
}

/**
 * Helper functions from original core
 */
const updateChannelMetrics = (event: RawEvent): void => {
  let metrics = channelStore.get(event.actionId)

  if (!metrics) {
    metrics = {
      id: event.actionId,
      calls: 0,
      executions: 0,
      errors: 0,
      actualErrors: 0,
      lastExecution: 0,
      averageLatency: 0,
      successRate: 1,
      errorRate: 0,
      protectionEvents: {
        throttled: 0,
        debounced: 0,
        blocked: 0,
        skipped: 0
      }
    }
  }

  if (!metrics.protectionEvents) {
    metrics.protectionEvents = {
      throttled: 0,
      debounced: 0,
      blocked: 0,
      skipped: 0
    }
  }

  switch (event.eventType) {
    case 'call':
      metrics.calls++
      break
    case 'execution':
      metrics.executions++
      metrics.lastExecution = event.timestamp

      if (
        typeof event.metadata?.duration === 'number' &&
        event.metadata.duration > 0
      ) {
        const newLatency = event.metadata.duration
        metrics.averageLatency =
          metrics.executions === 1
            ? newLatency
            : (metrics.averageLatency * (metrics.executions - 1) + newLatency) /
              metrics.executions
      }
      break
    case 'error':
      metrics.errors++
      if (event.location === 'execution') {
        metrics.actualErrors++
      }
      break
    case 'throttle':
      metrics.protectionEvents.throttled++
      break
    case 'debounce':
      metrics.protectionEvents.debounced++
      break
    case 'blocked':
      metrics.protectionEvents.blocked++
      break
    case 'skip':
      metrics.protectionEvents.skipped++
      break
  }

  metrics.successRate =
    metrics.executions > 0
      ? (metrics.executions - metrics.actualErrors) / metrics.executions
      : 1
  metrics.errorRate = metrics.calls > 0 ? metrics.errors / metrics.calls : 0

  channelStore.set(event.actionId, metrics)
}

const cleanupOldEvents = (retentionTime: number): void => {
  const cutoff = Date.now() - retentionTime
  const allEvents = eventStore.getAll()

  allEvents.forEach(event => {
    if (event.timestamp < cutoff) {
      eventStore.delete(event.id)
    }
  })
}

const scheduleCleanup = (): void => {
  // Implementation would be similar to original
}

const sendToLog = (level: LogLevel, message: string): void => {
  log.debug(message)
}

const formatMessage = (event: SensorEvent): string => {
  return `[${event.actionId}] ${event.eventType}: ${
    event.message || 'no message'
  }`
}

const calculateSlope = (values: number[]): number => {
  if (values.length < 2) return 0

  const n = values.length
  const x = Array.from({length: n}, (_, i) => i)
  const sumX = x.reduce((sum, val) => sum + val, 0)
  const sumY = values.reduce((sum, val) => sum + val, 0)
  const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0)
  const sumXX = x.reduce((sum, val) => sum + val * val, 0)

  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
}
