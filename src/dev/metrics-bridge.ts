// src/dev/metrics-bridge.ts
// Simple bridge connecting enhanced intelligence to metrics server

import {getEnhancedIntelligence} from './enhanced-intelligence-api'

/*

      C.Y.R.E - S.I.M.P.L.E - M.E.T.R.I.C.S - B.R.I.D.G.E
      
      Simple bridge to enhanced intelligence:
      - Direct import from enhanced-intelligence-api
      - Transforms data for dashboard compatibility
      - No file-based complexity

*/

interface MetricsSnapshot {
  timestamp: number
  systemAnalysis: any
  health: any
  performance: any
  pipeline: any
  systemMetrics: any
  channelMetrics: any[]
  events: any[]
  serverInfo: {
    pid: number
    uptime: number
    version: string
  }
}

/**
 * Check if enhanced intelligence is available
 */
export const isCyreRunning = (): boolean => {
  try {
    getEnhancedIntelligence(1000) // Small test
    return true
  } catch {
    return false
  }
}

/**
 * Get metrics snapshot using enhanced intelligence
 */
export const readMetricsSnapshot = (): MetricsSnapshot | null => {
  try {
    const intelligence = getEnhancedIntelligence(60000)

    // Transform to dashboard format
    const channelMetrics = intelligence.channels
      .filter(c => c.metrics && c.metrics.calls > 0)
      .map(c => ({
        id: c.id,
        calls: c.metrics?.calls || 0,
        executions: c.metrics?.executions || 0,
        errors: c.metrics?.errors || 0,
        lastExecution: c.metrics?.lastExecution || Date.now(),
        averageLatency: c.metrics?.averageLatency || 0,
        successRate: c.metrics?.successRate || 0,
        errorRate: c.metrics?.errorRate || 0,
        protectionEvents: c.metrics?.protectionEvents || {
          throttled: 0,
          debounced: 0,
          blocked: 0,
          skipped: 0
        },

        // Enhanced fields
        name: c.name,
        type: c.type,
        subscriberCount: c.subscribers.length,
        hasSubscribers: c.subscribers.length > 0,
        status: c.status,
        issues: c.issues
      }))

    // Create some demo channels if none active
    if (channelMetrics.length === 0 && intelligence.channels.length > 0) {
      intelligence.channels.slice(0, 3).forEach(c => {
        channelMetrics.push({
          id: c.id,
          calls: 0,
          executions: 0,
          errors: 0,
          lastExecution: Date.now(),
          averageLatency: 0,
          successRate: 1,
          errorRate: 0,
          protectionEvents: {
            throttled: 0,
            debounced: 0,
            blocked: 0,
            skipped: 0
          },
          name: c.name,
          type: c.type,
          subscriberCount: c.subscribers.length,
          hasSubscribers: c.subscribers.length > 0,
          status: 'inactive',
          issues: ['No activity yet']
        })
      })
    }

    return {
      timestamp: intelligence.timestamp,
      systemAnalysis: intelligence.system.analysis || {
        timestamp: intelligence.timestamp,
        system: intelligence.system,
        health: {
          overall:
            intelligence.insights.systemEfficiency > 0.9
              ? 'healthy'
              : 'degraded',
          score: Math.round(intelligence.insights.systemEfficiency * 100),
          factors: {
            availability: intelligence.insights.resourceUtilization,
            performance: intelligence.insights.systemEfficiency,
            reliability:
              1 -
              intelligence.system.totalErrors /
                Math.max(intelligence.system.totalCalls, 1),
            efficiency: intelligence.insights.systemEfficiency
          },
          issues: intelligence.insights.recommendations.slice(0, 3),
          criticalAlerts: intelligence.insights.errorProneChannels.length
        },
        performance: {
          avgLatency: intelligence.insights.averageResponseTime,
          throughput: intelligence.system.callRate,
          successRate: intelligence.insights.systemEfficiency,
          errorRate: 1 - intelligence.insights.systemEfficiency,
          degradations: []
        },
        pipeline: {
          totalCalls: intelligence.system.totalCalls,
          completedCalls: intelligence.system.totalExecutions,
          failedCalls: intelligence.system.totalErrors,
          stuckCalls: 0,
          avgDuration: intelligence.insights.averageResponseTime,
          efficiency: intelligence.insights.systemEfficiency,
          flowHealth:
            intelligence.insights.systemEfficiency > 0.8
              ? 'healthy'
              : 'degraded',
          bottlenecks: []
        }
      },
      health: {
        overall:
          intelligence.insights.systemEfficiency > 0.9 ? 'healthy' : 'degraded',
        score: Math.round(intelligence.insights.systemEfficiency * 100),
        factors: {
          availability: intelligence.insights.resourceUtilization,
          performance: intelligence.insights.systemEfficiency,
          reliability:
            1 -
            intelligence.system.totalErrors /
              Math.max(intelligence.system.totalCalls, 1),
          efficiency: intelligence.insights.systemEfficiency
        },
        issues: intelligence.insights.recommendations.slice(0, 3),
        criticalAlerts: intelligence.insights.errorProneChannels.length
      },
      performance: {
        avgLatency: intelligence.insights.averageResponseTime,
        throughput: intelligence.system.callRate,
        successRate: intelligence.insights.systemEfficiency,
        errorRate: 1 - intelligence.insights.systemEfficiency,
        degradations: []
      },
      pipeline: {
        totalCalls: intelligence.system.totalCalls,
        completedCalls: intelligence.system.totalExecutions,
        failedCalls: intelligence.system.totalErrors,
        stuckCalls: 0,
        avgDuration: intelligence.insights.averageResponseTime,
        efficiency: intelligence.insights.systemEfficiency,
        flowHealth:
          intelligence.insights.systemEfficiency > 0.8 ? 'healthy' : 'degraded',
        bottlenecks: []
      },
      systemMetrics: {
        totalCalls: intelligence.system.totalCalls,
        totalExecutions: intelligence.system.totalExecutions,
        totalErrors: intelligence.system.totalErrors,
        callRate: intelligence.system.callRate,
        uptime: intelligence.system.uptime,
        startTime: Date.now() - intelligence.system.uptime,
        totalChannels: intelligence.system.totalChannels,
        activeChannels: intelligence.system.activeChannels,
        totalSubscribers: intelligence.system.totalSubscribers
      },
      channelMetrics,
      events: intelligence.streaming.rawEvents.slice(0, 50).map(event => ({
        id: event.id || `evt-${Date.now()}`,
        timestamp: event.timestamp || Date.now(),
        actionId: event.actionId,
        eventType: event.eventType,
        message: event.message || `${event.eventType} for ${event.actionId}`,
        metadata: event.metadata || {}
      })),
      serverInfo: {
        pid: process.pid,
        uptime: process.uptime(),
        version: '4.3.0'
      }
    }
  } catch (error) {
    console.warn('📊 Enhanced intelligence failed:', error)

    // Basic fallback
    return {
      timestamp: Date.now(),
      systemAnalysis: {error: 'Intelligence unavailable'},
      health: {overall: 'unknown', score: 0, issues: ['System error']},
      performance: {avgLatency: 0, throughput: 0, successRate: 0},
      pipeline: {totalCalls: 0, flowHealth: 'unknown', efficiency: 0},
      systemMetrics: {
        totalCalls: 0,
        totalExecutions: 0,
        totalErrors: 0,
        uptime: 0
      },
      channelMetrics: [],
      events: [],
      serverInfo: {pid: process.pid, uptime: process.uptime(), version: '4.3.0'}
    }
  }
}

/**
 * Get streamable intelligence for external analyzers
 */
export const getStreamableData = (timeWindow = 300000) => {
  try {
    const intelligence = getEnhancedIntelligence(timeWindow)
    return {
      system: intelligence.system,
      channels: intelligence.channels.map(c => ({
        id: c.id,
        type: c.type,
        metrics: c.metrics,
        subscriberCount: c.subscribers.length,
        status: c.status
      })),
      rawEvents: intelligence.streaming.rawEvents,
      summary: intelligence.insights,
      stores: intelligence.streaming.storeSnapshots
    }
  } catch (error) {
    console.warn('📊 Streamable data failed:', error)
    return null
  }
}

/**
 * Simple write function (not used but kept for compatibility)
 */
export const writeMetricsSnapshot = (snapshot: any): void => {
  console.log('📊 Metrics updated:', new Date().toISOString())
}
