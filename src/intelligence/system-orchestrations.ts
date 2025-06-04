// src/intelligence/system-orchestrations.ts
// Background intelligence orchestrations for system analysis

import type {OrchestrationConfig} from '../types/orchestration'

/*

      C.Y.R.E - S.Y.S.T.E.M - I.N.T.E.L.L.I.G.E.N.C.E
      
      Background intelligence tasks that run via orchestration/schedule:
      - System anomaly detection
      - Cross-channel correlation analysis
      - Performance pattern recognition
      - Proactive problem prediction

*/

/**
 * System intelligence orchestrations to be registered at startup
 */
export const systemIntelligenceOrchestrations: OrchestrationConfig[] = [
  {
    id: 'system-health-analysis',
    triggers: [
      {
        name: 'periodic-health-check',
        type: 'time',
        interval: 60000 // Every minute
      }
    ],
    workflow: [
      {
        name: 'analyze-system-metrics',
        type: 'action',
        targets: ['system-intelligence-health'],
        payload: () => {
          // Dynamic import to avoid circular dependency
          return import('../app').then(({cyre}) => {
            const metrics = cyre.getMetricsReport()
            const breathing = cyre.getBreathingState()

            return analyzeSystemHealth(metrics, breathing)
          })
        }
      }
    ],
    enabled: true
  },

  {
    id: 'channel-performance-analysis',
    triggers: [
      {
        name: 'performance-check',
        type: 'time',
        interval: 120000 // Every 2 minutes
      }
    ],
    workflow: [
      {
        name: 'analyze-channel-performance',
        type: 'action',
        targets: ['system-intelligence-performance'],
        payload: () => {
          return import('../app').then(({cyre}) => {
            const channels = cyre.query.channels({})
            return analyzeChannelPerformance(channels)
          })
        }
      }
    ],
    enabled: true
  },

  {
    id: 'cross-channel-correlation',
    triggers: [
      {
        name: 'correlation-analysis',
        type: 'time',
        interval: 300000 // Every 5 minutes
      }
    ],
    workflow: [
      {
        name: 'find-channel-correlations',
        type: 'action',
        targets: ['system-intelligence-correlation'],
        payload: () => {
          return import('../app').then(({cyre}) => {
            return analyzeCrossChannelCorrelations(cyre)
          })
        }
      }
    ],
    enabled: true
  },

  {
    id: 'predictive-analysis',
    triggers: [
      {
        name: 'predict-issues',
        type: 'time',
        interval: 600000 // Every 10 minutes
      }
    ],
    workflow: [
      {
        name: 'predict-system-issues',
        type: 'action',
        targets: ['system-intelligence-predictions'],
        payload: () => {
          return import('../app').then(({cyre}) => {
            return generatePredictiveAnalysis(cyre)
          })
        }
      }
    ],
    enabled: true
  }
]

/**
 * Analyze overall system health and detect anomalies
 */
const analyzeSystemHealth = (metrics: any, breathing: any) => {
  const insights: string[] = []
  const recommendations: string[] = []
  let severity: 'info' | 'warning' | 'critical' = 'info'

  // Breathing system analysis
  if (breathing.stress > 0.9) {
    insights.push('System stress critical - performance severely degraded')
    recommendations.push(
      'Pause non-critical orchestrations and reduce call rate'
    )
    severity = 'critical'
  } else if (breathing.stress > 0.7) {
    insights.push('System stress elevated - performance impact detected')
    recommendations.push('Consider reducing background tasks')
    severity = 'warning'
  }

  // Call rate analysis
  if (metrics.global.callRate > 100) {
    insights.push(`High call rate detected: ${metrics.global.callRate}/sec`)
    recommendations.push(
      'Review high-frequency channels for throttling opportunities'
    )
    if (severity === 'info') severity = 'warning'
  }

  // Error rate analysis
  const errorRate = metrics.global.totalErrors / metrics.global.totalCalls
  if (errorRate > 0.1) {
    insights.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`)
    recommendations.push('Investigate channels with high error rates')
    severity = 'critical'
  } else if (errorRate > 0.05) {
    insights.push(`Elevated error rate: ${(errorRate * 100).toFixed(1)}%`)
    recommendations.push('Monitor error patterns for trending issues')
    if (severity === 'info') severity = 'warning'
  }

  // Breathing pattern analysis
  if (breathing.isRecuperating) {
    insights.push('System in recuperation mode - only critical actions allowed')
    recommendations.push(
      'Wait for stress levels to decrease before resuming normal operations'
    )
  }

  return {
    type: 'system-health',
    insights,
    recommendations,
    severity,
    timestamp: Date.now(),
    metrics: {
      stress: breathing.stress,
      callRate: metrics.global.callRate,
      errorRate,
      uptime: metrics.global.uptime
    }
  }
}

/**
 * Analyze individual channel performance patterns
 */
const analyzeChannelPerformance = (channelsData: any) => {
  const insights: string[] = []
  const recommendations: string[] = []
  const problemChannels: string[] = []

  channelsData.channels.forEach((channel: any) => {
    const metrics = channel.metrics || {}

    // High error rate channels
    if (metrics.errorCount > 0 && metrics.executionCount > 0) {
      const errorRate = metrics.errorCount / metrics.executionCount
      if (errorRate > 0.2) {
        insights.push(
          `Channel ${channel.id}: High error rate (${(errorRate * 100).toFixed(
            1
          )}%)`
        )
        recommendations.push(`Review ${channel.id} subscriber implementation`)
        problemChannels.push(channel.id)
      }
    }

    // Slow execution channels
    if (metrics.lastExecuted && metrics.avgExecutionTime > 100) {
      insights.push(
        `Channel ${channel.id}: Slow execution (${metrics.avgExecutionTime}ms avg)`
      )
      recommendations.push(
        `Optimize ${channel.id} processing or add throttling`
      )
      problemChannels.push(channel.id)
    }

    // High frequency channels
    if (metrics.callsPerMinute > 300) {
      // 5 calls per second
      insights.push(`Channel ${channel.id}: Very high call frequency`)
      recommendations.push(
        `Consider debouncing or throttling for ${channel.id}`
      )
    }

    // Unused channels
    if (metrics.executionCount === 0 && channel.subscriber) {
      insights.push(`Channel ${channel.id}: Has subscriber but never executed`)
      recommendations.push(
        `Review ${channel.id} usage or remove if unnecessary`
      )
    }
  })

  return {
    type: 'channel-performance',
    insights,
    recommendations,
    problemChannels,
    channelStats: {
      total: channelsData.channels.length,
      withProblems: problemChannels.length,
      utilizationRate:
        channelsData.channels.filter((c: any) => c.metrics?.executionCount > 0)
          .length / channelsData.channels.length
    },
    timestamp: Date.now()
  }
}

/**
 * Analyze correlations between channels using path and timing data
 */
const analyzeCrossChannelCorrelations = (cyre: any) => {
  const insights: string[] = []
  const correlations: Array<{
    channels: string[]
    type: string
    strength: number
    description: string
  }> = []

  // Path-based correlations
  const pathGroups = groupChannelsByPath(cyre)
  pathGroups.forEach(group => {
    if (group.channels.length > 1) {
      const correlation = analyzePathGroupCorrelation(group)
      if (correlation.strength > 0.7) {
        correlations.push(correlation)
        insights.push(
          `Strong correlation detected in ${group.path}: ${correlation.description}`
        )
      }
    }
  })

  // Timing-based correlations
  const timingCorrelations = analyzeTimingCorrelations(cyre)
  correlations.push(...timingCorrelations)

  timingCorrelations.forEach(corr => {
    if (corr.strength > 0.8) {
      insights.push(`Timing correlation: ${corr.description}`)
    }
  })

  // Error pattern correlations
  const errorCorrelations = analyzeErrorCorrelations(cyre)
  correlations.push(...errorCorrelations)

  return {
    type: 'cross-channel-correlation',
    insights,
    correlations,
    summary: {
      totalCorrelations: correlations.length,
      strongCorrelations: correlations.filter(c => c.strength > 0.8).length,
      pathBasedCorrelations: correlations.filter(c => c.type === 'path').length,
      timingBasedCorrelations: correlations.filter(c => c.type === 'timing')
        .length
    },
    timestamp: Date.now()
  }
}

/**
 * Generate predictive analysis for potential issues
 */
const generatePredictiveAnalysis = (cyre: any) => {
  const predictions: Array<{
    type: string
    probability: number
    timeframe: string
    description: string
    prevention: string
  }> = []

  // Predict stress escalation
  const breathing = cyre.getBreathingState()
  if (breathing.stress > 0.6) {
    const stressTrend = calculateStressTrend(breathing)
    if (stressTrend.increasing) {
      predictions.push({
        type: 'stress-escalation',
        probability: stressTrend.confidence,
        timeframe: '5-10 minutes',
        description: 'System stress likely to reach critical levels',
        prevention: 'Reduce call rates and pause non-critical orchestrations'
      })
    }
  }

  // Predict memory issues
  const memoryTrend = analyzeMemoryTrend(cyre)
  if (memoryTrend.concerning) {
    predictions.push({
      type: 'memory-leak',
      probability: 0.7,
      timeframe: '30-60 minutes',
      description: `Memory usage trending upward: ${memoryTrend.rate}MB/hour`,
      prevention:
        'Review payload state cleanup and channel lifecycle management'
    })
  }

  // Predict channel failures
  const channelRisks = predictChannelFailures(cyre)
  predictions.push(...channelRisks)

  return {
    type: 'predictive-analysis',
    predictions,
    summary: {
      totalPredictions: predictions.length,
      highRiskPredictions: predictions.filter(p => p.probability > 0.8).length,
      nextCheckRecommended: predictions.length > 0 ? '5 minutes' : '10 minutes'
    },
    timestamp: Date.now()
  }
}

/**
 * Helper functions for analysis
 */
const groupChannelsByPath = (cyre: any) => {
  const pathGroups: Array<{path: string; channels: any[]}> = []
  const channels = cyre.query.channels({})

  // Group channels by path prefix
  const pathMap = new Map<string, any[]>()

  channels.channels.forEach((channel: any) => {
    if (channel.config?.path) {
      const pathSegments = channel.config.path.split('/')
      const basePath = pathSegments.slice(0, -1).join('/')

      if (!pathMap.has(basePath)) {
        pathMap.set(basePath, [])
      }
      pathMap.get(basePath)!.push(channel)
    }
  })

  pathMap.forEach((channels, path) => {
    if (channels.length > 1) {
      pathGroups.push({path, channels})
    }
  })

  return pathGroups
}

const analyzePathGroupCorrelation = (group: {
  path: string
  channels: any[]
}) => {
  // Analyze channels in the same path for correlation patterns
  const callTimes = group.channels.map(
    channel => channel.metrics?.lastExecution || 0
  )

  // Simple correlation: channels called within similar timeframes
  const timeDiffs = callTimes
    .map((time, i) =>
      callTimes.slice(i + 1).map(otherTime => Math.abs(time - otherTime))
    )
    .flat()

  const avgTimeDiff =
    timeDiffs.length > 0
      ? timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length
      : Infinity

  // Correlation strength based on timing similarity
  const strength =
    avgTimeDiff < 60000
      ? 0.8 // Within 1 minute
      : avgTimeDiff < 300000
      ? 0.6 // Within 5 minutes
      : 0.3

  return {
    channels: group.channels.map(c => c.id),
    type: 'path',
    strength,
    description: `Channels in ${group.path} show ${
      strength > 0.7 ? 'strong' : 'weak'
    } temporal correlation`
  }
}

const analyzeTimingCorrelations = (cyre: any) => {
  const correlations: any[] = []
  const events = cyre.exportMetrics({
    eventType: 'call',
    since: Date.now() - 300000, // Last 5 minutes
    limit: 1000
  })

  // Group events by time windows (10 second windows)
  const timeWindows = new Map<number, string[]>()

  events.forEach((event: any) => {
    const window = Math.floor(event.timestamp / 10000) * 10000
    if (!timeWindows.has(window)) {
      timeWindows.set(window, [])
    }
    timeWindows.get(window)!.push(event.actionId)
  })

  // Find channels that frequently appear in the same time windows
  const coOccurrences = new Map<string, number>()

  timeWindows.forEach(channels => {
    if (channels.length > 1) {
      for (let i = 0; i < channels.length; i++) {
        for (let j = i + 1; j < channels.length; j++) {
          const pair = [channels[i], channels[j]].sort().join('|')
          coOccurrences.set(pair, (coOccurrences.get(pair) || 0) + 1)
        }
      }
    }
  })

  // Convert to correlations
  coOccurrences.forEach((count, pair) => {
    if (count >= 3) {
      // At least 3 co-occurrences
      const [channel1, channel2] = pair.split('|')
      correlations.push({
        channels: [channel1, channel2],
        type: 'timing',
        strength: Math.min(count / 10, 1), // Normalize to 0-1
        description: `${channel1} and ${channel2} frequently called together (${count} times)`
      })
    }
  })

  return correlations
}

const analyzeErrorCorrelations = (cyre: any) => {
  const correlations: any[] = []
  const errorEvents = cyre.exportMetrics({
    eventType: 'error',
    since: Date.now() - 600000, // Last 10 minutes
    limit: 500
  })

  // Group errors by time proximity (within 30 seconds)
  const errorGroups: Array<{timestamp: number; channels: string[]}> = []

  errorEvents.forEach((event: any) => {
    const existingGroup = errorGroups.find(
      group => Math.abs(group.timestamp - event.timestamp) < 30000
    )

    if (existingGroup) {
      existingGroup.channels.push(event.actionId)
    } else {
      errorGroups.push({
        timestamp: event.timestamp,
        channels: [event.actionId]
      })
    }
  })

  // Find channels that error together
  errorGroups.forEach(group => {
    if (group.channels.length > 1) {
      correlations.push({
        channels: group.channels,
        type: 'error',
        strength: 0.9, // Errors happening together are significant
        description: `Channels ${group.channels.join(
          ', '
        )} experienced errors simultaneously`
      })
    }
  })

  return correlations
}

const calculateStressTrend = (breathing: any) => {
  // This would analyze historical stress data
  // For now, simple heuristic based on current stress
  const increasing =
    breathing.stress > 0.6 && breathing.currentRate > breathing.baseRate

  return {
    increasing,
    confidence: increasing ? Math.min(breathing.stress, 0.9) : 0.1
  }
}

const analyzeMemoryTrend = (cyre: any) => {
  const stats = cyre.getStats()
  const channelCount = stats.actionCount
  const subscriberCount = stats.subscriberCount

  // Simple heuristic: too many channels without cleanup
  const concerning = channelCount > 1000 || subscriberCount > channelCount * 1.5

  return {
    concerning,
    rate: concerning ? channelCount / 10 : 0, // Rough estimate
    recommendation: concerning
      ? 'Review channel lifecycle and cleanup patterns'
      : null
  }
}

const predictChannelFailures = (cyre: any) => {
  const predictions: any[] = []
  const channels = cyre.query.channels({})

  channels.channels.forEach((channel: any) => {
    const metrics = channel.metrics || {}

    // Predict failure based on error rate trend
    if (metrics.errorCount > 0 && metrics.executionCount > 0) {
      const errorRate = metrics.errorCount / metrics.executionCount

      if (errorRate > 0.5) {
        predictions.push({
          type: 'channel-failure',
          probability: Math.min(errorRate * 1.5, 0.95),
          timeframe: '10-30 minutes',
          description: `Channel ${channel.id} likely to fail due to high error rate`,
          prevention: `Review and fix ${channel.id} subscriber implementation`
        })
      }
    }

    // Predict overload based on call frequency
    if (metrics.callsPerMinute > 500) {
      predictions.push({
        type: 'channel-overload',
        probability: 0.7,
        timeframe: '5-15 minutes',
        description: `Channel ${channel.id} may become overloaded`,
        prevention: `Add throttling or debouncing to ${channel.id}`
      })
    }
  })

  return predictions
}

/**
 * Register system intelligence orchestrations
 */
export const registerSystemIntelligence = async (orchestration: any) => {
  const results = {
    registered: [] as string[],
    failed: [] as string[]
  }

  for (const config of systemIntelligenceOrchestrations) {
    try {
      const result = orchestration.create(config)
      if (result.ok) {
        orchestration.start(config.id)
        results.registered.push(config.id)
      } else {
        results.failed.push(config.id)
      }
    } catch (error) {
      results.failed.push(config.id)
    }
  }

  return results
}
