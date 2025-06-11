// src/metrics/enhanced-integration.ts
// Enhanced metrics integration with improved data quality - maintains existing API

import {liveAnalyzer} from './live-analyzer' // Uses enhanced live analyzer
import {enhancedMetricsCore} from './enhanced-core'
import type {ActionId} from '../types/core'
import type {SystemAnalysis} from '../dev/server-types'

/*

      C.Y.R.E - E.N.H.A.N.C.E.D - M.E.T.R.I.C.S - I.N.T.E.G.R.A.T.I.O.N
      
      Enhanced metrics API with improved data quality:
      - All existing API methods preserved
      - Uses enhanced core with historical data
      - Better call rate calculations from accumulated data
      - Improved system health scoring with trends
      - Enhanced channel analysis with baselines
      - Optional data persistence for better trends
      - No breaking changes to API structure

*/

/**
 * Enhanced metrics API - improved data quality while maintaining compatibility
 */
export const enhancedMetrics = {
  // Quick analysis methods with enhanced data
  health: () => {
    const analysis = liveAnalyzer.analyzeSystem(60000) // Last minute
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

    // Show data quality info
    const dataStats = enhancedMetricsCore.getDataStats()
    console.log(`📊 Data Quality: ${dataStats.dataQuality}/100`)

    return health
  },

  performance: () => {
    const analysis = liveAnalyzer.analyzeSystem(60000)
    const perf = analysis.performance

    console.log('⚡ Performance:')
    console.log(
      `  Latency: ${perf.avgLatency.toFixed(
        2
      )}ms avg, ${perf.p95Latency.toFixed(2)}ms p95`
    )
    console.log(`  Success: ${(perf.successRate * 100).toFixed(1)}%`)
    console.log(`  Throughput: ${perf.throughput.toFixed(1)}/sec`)

    if (perf.degradations.length > 0) {
      console.log(`  Issues: ${perf.degradations.length} degradations`)
    }

    // Show enhanced performance data
    const systemMetrics = enhancedMetricsCore.getEnhancedSystemMetrics()
    if (systemMetrics.enhanced) {
      console.log(
        `  Peak Rate: ${systemMetrics.enhanced.peakCallRate.toFixed(1)}/sec`
      )
      console.log(
        `  System Load: ${systemMetrics.enhanced.systemLoadPercentage}%`
      )
      console.log(`  Health Trend: ${systemMetrics.enhanced.healthTrend}`)
    }

    return perf
  },

  pipeline: () => {
    const analysis = liveAnalyzer.analyzeSystem(60000)
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

    if (pipeline.bottlenecks.length > 0) {
      console.log(`  Bottlenecks: ${pipeline.bottlenecks.length} detected`)
    }

    return pipeline
  },

  // Enhanced channel analysis with historical context
  channel: (channelId: string) => {
    const analysis = liveAnalyzer.analyzeSystem(300000) // 5 minutes
    const channelData = analysis.channels.find(c => c.id === channelId)
    const enhancedChannel =
      enhancedMetricsCore.getEnhancedChannelMetrics(channelId)

    if (!channelData) {
      console.log(`❌ Channel '${channelId}' not found`)
      return null
    }

    console.log(`📊 Channel: ${channelId}`)
    console.log(`  Status: ${channelData.status.toUpperCase()}`)
    console.log(`  Calls: ${channelData.metrics.calls}`)
    console.log(
      `  Success Rate: ${(channelData.metrics.successRate * 100).toFixed(1)}%`
    )
    console.log(
      `  Avg Latency: ${channelData.metrics.averageLatency.toFixed(2)}ms`
    )
    console.log(`  Latency Trend: ${channelData.latencyTrend}`)

    // Show enhanced data if available
    if (enhancedChannel?.enhanced) {
      const enhanced = enhancedChannel.enhanced
      console.log(
        `  Performance Score: ${enhanced.performanceScore.toFixed(0)}/100`
      )

      if (enhanced.baseline) {
        const baseline = enhanced.baseline
        console.log(`  Baseline Latency: ${baseline.avgLatency.toFixed(2)}ms`)
        console.log(
          `  Baseline Confidence: ${(baseline.confidence * 100).toFixed(0)}%`
        )
      }

      if (enhanced.recommendations.length > 0) {
        console.log('  Recommendations:')
        enhanced.recommendations.slice(0, 3).forEach(rec => {
          console.log(`    • ${rec}`)
        })
      }
    }

    if (channelData.issues.length > 0) {
      console.log('  Issues:', channelData.issues.slice(0, 3).join(', '))
    }

    return channelData
  },

  // Full analysis methods - enhanced interface
  analyze: (timeWindow?: number): SystemAnalysis => {
    return liveAnalyzer.analyzeSystem(timeWindow)
  },

  analyzeChannel: (channelId: string, timeWindow?: number) => {
    const analysis = liveAnalyzer.analyzeSystem(timeWindow)
    return analysis.channels.find(c => c.id === channelId)
  },

  // Enhanced data access methods
  getSystemMetrics: () => enhancedMetricsCore.getSystemMetrics(),

  getEnhancedSystemMetrics: () =>
    enhancedMetricsCore.getEnhancedSystemMetrics(),

  getChannelMetrics: (actionId?: ActionId) => {
    if (actionId) {
      return enhancedMetricsCore.getChannelMetrics(actionId)
    }
    return enhancedMetricsCore.getAllChannelMetrics()
  },

  getEnhancedChannelMetrics: (actionId?: ActionId) => {
    if (actionId) {
      return enhancedMetricsCore.getEnhancedChannelMetrics(actionId)
    }
    return enhancedMetricsCore.getAllEnhancedChannelMetrics()
  },

  getEvents: (filter?: {
    actionId?: ActionId
    eventType?: string
    since?: number
    limit?: number
  }) => enhancedMetricsCore.getEvents(filter),

  // Historical data access (new functionality)
  getHistoricalMetrics: enhancedMetricsCore.getHistoricalMetrics,
  getSystemSnapshots: enhancedMetricsCore.getSystemSnapshots,
  getChannelTrends: enhancedMetricsCore.getChannelTrends,
  calculateBaselines: enhancedMetricsCore.calculateBaselines,
  getPeakMetrics: enhancedMetricsCore.getPeakMetrics,

  // Data quality and statistics
  getDataStats: () => {
    const stats = enhancedMetricsCore.getDataStats()

    console.log('📈 Data Statistics:')
    console.log(`  Data Quality: ${stats.dataQuality}/100`)
    console.log(`  Current Events: ${stats.currentEvents}`)
    console.log(`  Historical Metrics: ${stats.aggregatedMetricsCount}`)
    console.log(`  System Snapshots: ${stats.systemSnapshotsCount}`)
    console.log(
      `  Memory Usage: ${(stats.memoryUsageEstimate / 1024).toFixed(1)}KB`
    )

    if (stats.oldestTimestamp > 0) {
      const hoursOfData =
        (Date.now() - stats.oldestTimestamp) / (1000 * 60 * 60)
      console.log(`  Data History: ${hoursOfData.toFixed(1)} hours`)
    }

    return stats
  },

  // System control with enhanced features
  reset: () => {
    enhancedMetricsCore.reset()
    console.log('📊 Enhanced metrics system reset')
  },

  initialize: (config?: {
    maxEvents?: number
    retentionTime?: number
    cleanupInterval?: number
    enablePersistence?: boolean
    persistenceInterval?: number
    persistenceStoragePrefix?: string
  }) => {
    enhancedMetricsCore.initialize(config)

    console.log('📊 Enhanced metrics system initialized')
    if (config?.enablePersistence) {
      console.log('💾 Data persistence enabled for better trends')
    }

    const stats = enhancedMetricsCore.getDataStats()
    console.log(`📈 Data quality: ${stats.dataQuality}/100`)
  },

  shutdown: () => {
    enhancedMetricsCore.shutdown()
    console.log('📊 Enhanced metrics system shutdown')
  },

  // Data backup and restore
  exportData: () => {
    const data = enhancedMetricsCore.exportData()
    console.log('💾 Metrics data exported')
    console.log(`  Historical metrics: ${data.aggregatedMetrics?.length || 0}`)
    console.log(`  System snapshots: ${data.systemSnapshots?.length || 0}`)
    console.log(`  Current events: ${data.currentState?.events?.length || 0}`)
    return data
  },

  importData: (data: any) => {
    enhancedMetricsCore.importData(data)
    console.log('📥 Metrics data imported')

    const stats = enhancedMetricsCore.getDataStats()
    console.log(`📈 New data quality: ${stats.dataQuality}/100`)
  },

  // Anomaly detection with enhanced context
  anomalies: (timeWindow?: number) => {
    const analysis = liveAnalyzer.analyzeSystem(timeWindow)
    const anomalies = analysis.anomalies

    console.log('\n🔍 === ANOMALY DETECTION ===')
    console.log(`Anomalies Detected: ${anomalies.detected ? 'YES' : 'NO'}`)
    console.log(`Confidence: ${(anomalies.confidence * 100).toFixed(1)}%`)

    if (anomalies.anomalies.length > 0) {
      console.log('\nDetected Anomalies:')
      anomalies.anomalies.forEach(anomaly => {
        console.log(
          `  ${anomaly.channelId}: ${
            anomaly.type
          } - ${anomaly.severity.toUpperCase()}`
        )
        console.log(`    ${anomaly.description}`)
        console.log(`    Confidence: ${(anomaly.confidence * 100).toFixed(1)}%`)
      })
    }

    if (anomalies.patterns.length > 0) {
      console.log('\nAnomaly Patterns:')
      anomalies.patterns.forEach(pattern => {
        console.log(
          `  ${pattern.name}: ${pattern.channels.join(', ')} - Frequency: ${
            pattern.frequency
          }`
        )
      })
    }

    return anomalies
  },

  // System insights with enhanced historical context
  insights: (timeWindow?: number) => {
    const analysis = liveAnalyzer.analyzeSystem(timeWindow)
    const insights = analysis.insights

    console.log('\n💡 === SYSTEM INSIGHTS ===')
    console.log(`Total Activity: ${insights.totalActivity} events`)
    console.log(`Active Channels: ${insights.activeChannels}`)
    console.log(
      `Peak Throughput: ${insights.peakThroughput.toFixed(1)} calls/sec`
    )
    console.log(
      `System Efficiency: ${(insights.systemEfficiency * 100).toFixed(1)}%`
    )
    console.log(
      `Resource Utilization: ${(insights.resourceUtilization * 100).toFixed(
        1
      )}%`
    )

    if (insights.topPerformers.length > 0) {
      console.log(
        `Top Performers: ${insights.topPerformers.slice(0, 3).join(', ')}`
      )
    }

    if (insights.problemChannels.length > 0) {
      console.log(
        `Problem Channels: ${insights.problemChannels.slice(0, 3).join(', ')}`
      )
    }

    if (insights.unusedChannels.length > 0) {
      console.log(`Unused Channels: ${insights.unusedChannels.length} detected`)
    }

    if (insights.optimizationOpportunities?.length > 0) {
      console.log('\nOptimization Opportunities:')
      insights.optimizationOpportunities.slice(0, 3).forEach(opp => {
        console.log(
          `  ${opp.channelId}: ${opp.type} - ${opp.priority.toUpperCase()}`
        )
        console.log(`    ${opp.description}`)
        console.log(`    ${opp.estimatedImpact}`)
      })
    }

    // Show data quality impact on insights
    const dataStats = enhancedMetricsCore.getDataStats()
    if (dataStats.dataQuality < 50) {
      console.log('\n⚠️  Low data quality may affect insight accuracy')
      console.log('   Consider enabling persistence for better trends')
    }

    return insights
  },

  // Complete dashboard data for API endpoints
  getDashboardData: (timeWindow?: number): SystemAnalysis => {
    return liveAnalyzer.analyzeSystem(timeWindow)
  },

  // Quick status check with enhanced info
  status: () => {
    const systemMetrics = enhancedMetricsCore.getEnhancedSystemMetrics()
    const dataStats = enhancedMetricsCore.getDataStats()
    const analysis = liveAnalyzer.analyzeSystem(60000)

    console.log('🎯 === CYRE SYSTEM STATUS ===')
    console.log(
      `Health: ${analysis.health.overall.toUpperCase()} (${
        analysis.health.score
      }/100)`
    )
    console.log(`Active Channels: ${systemMetrics.activeChannels}`)
    console.log(`Call Rate: ${systemMetrics.callRate.toFixed(1)}/sec`)
    console.log(`Data Quality: ${dataStats.dataQuality}/100`)

    if (systemMetrics.enhanced) {
      console.log(
        `System Load: ${systemMetrics.enhanced.systemLoadPercentage}%`
      )
      console.log(`Health Trend: ${systemMetrics.enhanced.healthTrend}`)
    }

    if (analysis.health.issues.length > 0) {
      console.log(`Issues: ${analysis.health.issues.length} detected`)
    }

    return {
      health: analysis.health,
      systemMetrics,
      dataStats,
      summary: {
        healthy: analysis.health.overall === 'healthy',
        activeChannels: systemMetrics.activeChannels,
        callRate: systemMetrics.callRate,
        dataQuality: dataStats.dataQuality,
        issueCount: analysis.health.issues.length
      }
    }
  }
}

// Maintain backward compatibility
export const metrics = enhancedMetrics

export default enhancedMetrics
