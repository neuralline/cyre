// src/metrics/integration.ts - UPDATED
// Enhanced integration that maintains backwards compatibility

import {minimalAnalyzer} from './minimal-analyzer'
import {enhancedCore} from './enhanced-core'
import type {ActionId} from '../types/core'

/*

      C.Y.R.E - M.E.T.R.I.C.S - I.N.T.E.G.R.A.T.I.O.N - V2
      
      Enhanced integration with backwards compatibility:
      - All existing methods work unchanged
      - New enhanced methods available
      - Uses minimal analyzer (fast)
      - Enhanced data collection

*/

/**
 * Complete metrics API - backwards compatible + enhanced
 */
export const metrics = {
  // EXISTING API - unchanged for backwards compatibility
  health: () => {
    const analysis = minimalAnalyzer.analyzeSystem(60000) // Fast analysis
    const health = analysis.health

    const statusIcon =
      health.overall === 'healthy'
        ? '✅'
        : health.overall === 'degraded'
        ? '⚠️'
        : '🔴'

    console.log(
      `${statusIcon} System: ${health.overall.toUpperCase()} (${
        health.score
      }/100)`
    )

    if (health.issues.length > 0) {
      console.log('Issues:', health.issues.slice(0, 3).join(', '))
    }

    return health
  },

  performance: () => {
    const analysis = minimalAnalyzer.analyzeSystem(60000)
    const perf = analysis.performance

    console.log('⚡ Performance:')
    console.log(`  Latency: ${perf.avgLatency.toFixed(2)}ms avg`)
    console.log(`  Success: ${(perf.successRate * 100).toFixed(1)}%`)
    console.log(`  Throughput: ${perf.throughput.toFixed(1)}/sec`)

    if (perf.degradations.length > 0) {
      console.log(`  Issues: ${perf.degradations.length} degradations`)
    }

    return perf
  },

  pipeline: () => {
    const analysis = minimalAnalyzer.analyzeSystem(60000)
    const pipeline = analysis.pipeline

    console.log('🔄 Pipeline:')
    console.log(`  Health: ${pipeline.flowHealth.toUpperCase()}`)
    console.log(`  Efficiency: ${(pipeline.efficiency * 100).toFixed(1)}%`)
    console.log(
      `  Completed: ${pipeline.completedCalls}/${pipeline.totalCalls}`
    )

    if (pipeline.stuckCalls > 0) {
      console.log(`  ⚠️ Stuck calls: ${pipeline.stuckCalls}`)
    }

    return pipeline
  },

  // EXISTING: Full analysis - now uses minimal analyzer
  analyze: (timeWindow?: number) => minimalAnalyzer.analyzeSystem(timeWindow),

  analyzeChannel: (channelId: string, timeWindow?: number) => {
    const result = minimalAnalyzer.analyzeChannel(channelId, timeWindow)
    if (!result) {
      console.log(`❌ Channel '${channelId}' not found`)
      return null
    }
    return result
  },

  // EXISTING: Specialized reports
  performanceReport: (timeWindow?: number) => {
    const analysis = minimalAnalyzer.analyzeSystem(timeWindow)
    return analysis.performance
  },

  pipelineReport: (timeWindow?: number) => {
    const analysis = minimalAnalyzer.analyzeSystem(timeWindow)
    return analysis.pipeline
  },

  // EXISTING: System control methods - delegate to enhancedCore
  getSystemMetrics: () => enhancedCore.getSystemMetrics(),
  getChannelMetrics: (actionId?: ActionId) => {
    if (actionId) {
      return enhancedCore.getChannelMetrics(actionId)
    }
    return enhancedCore.getAllChannelMetrics()
  },
  getEvents: enhancedCore.getEvents,
  reset: enhancedCore.reset,
  initialize: enhancedCore.initialize,
  shutdown: enhancedCore.shutdown,

  // EXISTING: Other methods...
  snapshot: () => {
    const analysis = minimalAnalyzer.analyzeSystem(60000)
    const snapshot = {
      timestamp: new Date().toISOString(),
      health: {
        status: analysis.health.overall,
        score: analysis.health.score
      },
      performance: {
        avgLatency: `${analysis.performance.avgLatency.toFixed(2)}ms`,
        successRate: `${(analysis.performance.successRate * 100).toFixed(1)}%`,
        throughput: `${analysis.performance.throughput.toFixed(1)}/sec`
      },
      pipeline: {
        health: analysis.pipeline.flowHealth,
        efficiency: `${(analysis.pipeline.efficiency * 100).toFixed(1)}%`,
        stuckCalls: analysis.pipeline.stuckCalls
      },
      system: {
        totalCalls: analysis.system.totalCalls,
        totalExecutions: analysis.system.totalExecutions,
        totalErrors: analysis.system.totalErrors,
        uptime: `${(analysis.system.uptime / 1000).toFixed(1)}s`
      }
    }

    console.log('📸 System Snapshot:')
    console.log(JSON.stringify(snapshot, null, 2))
    return snapshot
  },

  // NEW: Enhanced methods
  getEnhancedChannelMetrics: (channelId?: ActionId) => {
    return enhancedCore.getEnhancedChannelMetrics(channelId)
  },

  getSystemTopology: () => {
    return enhancedCore.getSystemTopology()
  },

  getSubscriberNetwork: () => {
    return enhancedCore.getSubscriberNetwork()
  },

  // NEW: Export for external analyzer
  exportStructuredData: () => {
    const channels = enhancedCore.getEnhancedChannelMetrics()
    const topology = enhancedCore.getSystemTopology()
    const events = enhancedCore.getEvents({limit: 1000})

    return {
      metadata: {
        timestamp: Date.now(),
        version: '2.0.0',
        instance: process.pid.toString(),
        export_type: 'enhanced_structured_metrics'
      },
      channels: channels.map(ch => ({
        id: ch.id,
        calls: ch.calls,
        executions: ch.executions,
        errors: ch.errors,
        avg_latency: ch.averageLatency,
        success_rate: ch.successRate,
        subscribers: ch.subscribers.count,
        branch: ch.branch?.branchPath,
        groups: ch.groups.map(g => g.groupId),
        configuration: ch.configuration
      })),
      topology,
      events: events.map(evt => ({
        id: evt.id,
        timestamp: evt.timestamp,
        channel_id: evt.actionId,
        event_type: evt.eventType,
        message: evt.message,
        metadata: evt.metadata
      })),
      system: enhancedCore.getSystemMetrics()
    }
  }
}
export default metrics
