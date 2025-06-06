// src/metrics/integration.ts
// Single metrics API export - uses orchestration for scheduling

import {analyzer} from './analyzer'
import {metricsCore} from './core'
import type {ActionId} from '../types/core'

/*

      C.Y.R.E - M.E.T.R.I.C.S - I.N.T.E.G.R.A.T.I.O.N
      
      Single metrics API that:
      - Uses existing sensor (no duplication)
      - Delegates scheduling to orchestration/schedule
      - Exports complete API for app.ts
      - On-demand analysis only

*/

/**
 * Complete metrics API - exported to app.ts
 */
export const metrics = {
  // Quick analysis methods
  health: () => {
    const analysis = analyzer.analyzeSystem(60000) // Last minute
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
    const analysis = analyzer.analyzeSystem(60000)
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
    const analysis = analyzer.analyzeSystem(60000)
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

  // Full analysis methods
  analyze: (timeWindow?: number) => analyzer.analyzeSystem(timeWindow),

  analyzeChannel: (channelId: string, timeWindow?: number) => {
    const result = analyzer.analyzeChannel(channelId, timeWindow)
    if (!result) {
      console.log(`❌ Channel '${channelId}' not found`)
      return null
    }
    return result
  },

  // Specialized reports
  performanceReport: (timeWindow?: number) => {
    const analysis = analyzer.analyzeSystem(timeWindow)
    return analysis.performance
  },

  pipelineReport: (timeWindow?: number) => {
    const analysis = analyzer.analyzeSystem(timeWindow)
    return analysis.pipeline
  },

  protectionReport: (timeWindow?: number) => {
    const analysis = analyzer.analyzeSystem(timeWindow)
    return analysis.protections
  },

  // Anomaly detection
  detectAnomalies: (timeWindow?: number) => {
    const analysis = analyzer.analyzeSystem(timeWindow)
    return analysis.anomalies
  },

  // Insights
  getInsights: (timeWindow?: number) => {
    const analysis = analyzer.analyzeSystem(timeWindow)
    return analysis.insights
  },

  getRecommendations: (timeWindow?: number) => {
    const analysis = analyzer.analyzeSystem(timeWindow)
    return analysis.recommendations
  },

  // Health check
  healthCheck: () => {
    const analysis = analyzer.analyzeSystem(60000)
    return {
      status: analysis.health.overall,
      score: analysis.health.score,
      issues: analysis.health.issues,
      criticalAlerts: analysis.health.criticalAlerts
    }
  },

  // Comprehensive reporting
  report: (timeWindow?: number) => {
    const analysis = analyzer.analyzeSystem(timeWindow)

    const lines: string[] = []
    const add = (text = '') => lines.push(text)

    add('CYRE METRICS ANALYSIS REPORT')
    add('='.repeat(50))
    add(`Generated: ${new Date(analysis.timestamp).toISOString()}`)
    add(`Analysis Window: ${(analysis.timeWindow / 1000).toFixed(0)}s`)
    add()

    // Health summary
    const healthIcon =
      analysis.health.overall === 'healthy'
        ? '✅'
        : analysis.health.overall === 'degraded'
        ? '⚠️'
        : '🔴'
    add(
      `${healthIcon} System Health: ${analysis.health.overall.toUpperCase()} (${
        analysis.health.score
      }/100)`
    )
    add()

    // System metrics
    add('📊 SYSTEM METRICS')
    add(`  Total Calls: ${analysis.system.totalCalls}`)
    add(`  Total Executions: ${analysis.system.totalExecutions}`)
    add(`  Total Errors: ${analysis.system.totalErrors}`)
    add(`  Call Rate: ${analysis.system.callRate}/sec`)
    add(`  Uptime: ${(analysis.system.uptime / 1000).toFixed(1)}s`)
    add()

    // Pipeline health
    add('🔄 PIPELINE ANALYSIS')
    add(`  Flow Health: ${analysis.pipeline.flowHealth.toUpperCase()}`)
    add(`  Efficiency: ${(analysis.pipeline.efficiency * 100).toFixed(1)}%`)
    add(
      `  Completed: ${analysis.pipeline.completedCalls}/${analysis.pipeline.totalCalls}`
    )
    add(`  Failed: ${analysis.pipeline.failedCalls}`)
    add(`  Stuck: ${analysis.pipeline.stuckCalls}`)
    add()

    // Performance metrics
    add('⚡ PERFORMANCE ANALYSIS')
    add(`  Avg Latency: ${analysis.performance.avgLatency.toFixed(2)}ms`)
    add(
      `  Success Rate: ${(analysis.performance.successRate * 100).toFixed(1)}%`
    )
    add(`  Error Rate: ${(analysis.performance.errorRate * 100).toFixed(2)}%`)
    add()

    // Protection analysis
    add('🛡️ PROTECTION ANALYSIS')
    add(
      `  Overall Health: ${analysis.protections.overall.health.toUpperCase()}`
    )
    add(
      `  Effectiveness: ${(
        analysis.protections.overall.effectiveness * 100
      ).toFixed(1)}%`
    )
    add()

    // Recommendations
    if (analysis.recommendations.length > 0) {
      add('📝 RECOMMENDATIONS')
      analysis.recommendations.forEach((rec, i) => {
        add(`  ${i + 1}. ${rec}`)
      })
      add()
    }

    const report = lines.join('\n')
    console.log('\n' + report)
    return report
  },

  // Snapshot
  snapshot: () => {
    const analysis = analyzer.analyzeSystem(60000)

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

  // Raw data access for advanced users
  getSystemMetrics: () => metricsCore.getSystemMetrics(),

  getChannelMetrics: (actionId?: ActionId) => {
    if (actionId) {
      return metricsCore.getChannelMetrics(actionId)
    }
    return metricsCore.getAllChannelMetrics()
  },

  getEvents: (filter?: {
    actionId?: ActionId
    eventType?: string
    since?: number
    limit?: number
  }) => metricsCore.getEvents(filter),

  // System control
  reset: () => {
    metricsCore.reset()
    console.log('📊 Metrics system reset')
  },

  initialize: (config?: {
    maxEvents?: number
    retentionTime?: number
    cleanupInterval?: number
  }) => {
    metricsCore.initialize(config)
    console.log('📊 Metrics system initialized')
  },

  shutdown: () => {
    metricsCore.shutdown()
    console.log('📊 Metrics system shutdown')
  }
}

export default metrics
