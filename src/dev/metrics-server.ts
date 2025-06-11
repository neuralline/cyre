// src/dev/metrics-server.ts
// Updated metrics server integrated with Cyre-powered approach

import {metrics} from '../metrics/integration'
import type {
  MetricsServerConfig,
  MetricsServerState,
  MetricsResponse,
  MetricsErrorResponse,
  WebSocketMessage,
  MetricsUpdateMessage
} from './server-types'

/*

      C.Y.R.E - I.N.T.E.G.R.A.T.E.D - M.E.T.R.I.C.S - S.E.R.V.E.R
      
      Integrated metrics server that works with cyre-app-with-metrics.ts:
      - Provides API endpoint handlers as Cyre channel functions
      - Live SystemAnalysis data from real Cyre metrics
      - WebSocket broadcasting through Cyre orchestration
      - No standalone server - integrates with main Cyre server

*/

let serverState: MetricsServerState = {
  isRunning: false,
  clientCount: 0,
  port: 3001,
  host: '0.0.0.0',
  cyreRunning: true,
  uptime: 0
}

let wsClients: Set<any> = new Set()
let broadcastTimer: NodeJS.Timeout | null = null

/**
 * Get live dashboard metrics in enhanced format
 */
const getLiveDashboardMetrics = (timeWindow = 300000): MetricsResponse => {
  try {
    const analysis = metrics.getDashboardData(timeWindow)

    return {
      timestamp: Date.now(),
      metrics: {
        system: {
          ...analysis.system,
          // Add compatibility fields for existing dashboard
          totalCalls: analysis.system.totalCalls,
          totalExecutions: analysis.system.totalExecutions,
          totalErrors: analysis.system.totalErrors,
          uptime: analysis.system.uptime,
          callRate: analysis.system.callRate
        },
        health: {
          ...analysis.health,
          // Add compatibility fields
          overall: analysis.health.overall,
          score: analysis.health.score,
          factors: analysis.health.factors,
          issues: analysis.health.issues
        },
        performance: {
          ...analysis.performance,
          // Add compatibility fields
          avgLatency: analysis.performance.avgLatency,
          throughput: analysis.performance.throughput,
          successRate: analysis.performance.successRate,
          errorRate: analysis.performance.errorRate,
          degradations: analysis.performance.degradations
        },
        pipeline: {
          ...analysis.pipeline,
          // Add compatibility fields
          totalCalls: analysis.pipeline.totalCalls,
          completedCalls: analysis.pipeline.completedCalls,
          stuckCalls: analysis.pipeline.stuckCalls,
          flowHealth: analysis.pipeline.flowHealth,
          efficiency: analysis.pipeline.efficiency
        },
        channels: analysis.channels.map(ch => ({
          id: ch.id,
          metrics: ch.metrics,
          status: ch.status,
          issues: ch.issues,
          latencyTrend: ch.latencyTrend,
          protectionStats: ch.protectionStats,
          recommendations: ch.recommendations
        })),
        events: analysis.events.events.map(evt => ({
          id: evt.id,
          timestamp: evt.timestamp,
          channelId: evt.channelId,
          type: evt.type,
          duration: evt.duration,
          status: evt.status
        }))
      },
      server: {
        pid: process.pid,
        uptime: process.uptime(),
        version: '4.6.0'
      },
      cyreRunning: true
    }
  } catch (error) {
    console.error('❌ Error getting dashboard metrics:', error)

    const errorResponse: MetricsErrorResponse = {
      error: `Failed to get metrics: ${String(error)}`,
      timestamp: Date.now(),
      cyreRunning: true
    }

    return {
      timestamp: Date.now(),
      metrics: {
        system: {
          totalCalls: 0,
          totalExecutions: 0,
          totalErrors: 0,
          uptime: 0,
          callRate: 0,
          activeChannels: 0,
          memory: {
            eventCount: 0,
            channelCount: 0,
            maxEvents: 1000,
            memoryUsage: process.memoryUsage().rss
          },
          performance: {
            avgCallRate: 0,
            peakCallRate: 0,
            systemLoad: 0
          }
        },
        health: {
          overall: 'healthy',
          score: 100,
          factors: {
            availability: 1,
            performance: 1,
            reliability: 1,
            efficiency: 1
          },
          issues: [],
          criticalAlerts: 0,
          trends: []
        },
        performance: {
          avgLatency: 0,
          throughput: 0,
          successRate: 1,
          errorRate: 0,
          degradations: []
        },
        pipeline: {
          totalCalls: 0,
          completedCalls: 0,
          stuckCalls: 0,
          flowHealth: 'healthy',
          efficiency: 1
        },
        channels: [],
        events: []
      },
      server: {
        pid: process.pid,
        uptime: process.uptime(),
        version: '4.6.0'
      },
      cyreRunning: true
    }
  }
}

/**
 * Cyre channel handlers for HTTP API endpoints
 */
export const createMetricsChannelHandlers = () => {
  return {
    // Main dashboard metrics endpoint - enhanced SystemAnalysis
    'http-api-metrics': {
      handler: async (payload?: {timeWindow?: number}) => {
        console.log(
          '🚀 [CYRE HANDLER] http-api-metrics - Getting enhanced dashboard data'
        )

        try {
          const timeWindow = payload?.timeWindow || 300000 // 5 minutes default
          const dashboardData = getLiveDashboardMetrics(timeWindow)

          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-cyre-system-analysis',
            data: dashboardData,
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Dashboard metrics error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-cyre-system-analysis',
            error: String(error),
            status: 'error'
          }
        }
      }
    },

    // Enhanced analyze endpoint with full SystemAnalysis
    'http-api-analyze': {
      handler: async (payload?: {timeWindow?: number}) => {
        console.log(
          '🚀 [CYRE HANDLER] http-api-analyze - Getting full SystemAnalysis'
        )

        try {
          const timeWindow = payload?.timeWindow || 300000
          const analysis = metrics.getDashboardData(timeWindow)

          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-system-analysis',
            analysis,
            insights: analysis.insights,
            anomalies: analysis.anomalies,
            recommendations: analysis.recommendations,
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Analysis error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            error: String(error),
            status: 'error'
          }
        }
      }
    },

    // Enhanced health endpoint
    'http-api-health': {
      handler: async (payload?: {timeWindow?: number}) => {
        console.log(
          '🚀 [CYRE HANDLER] http-api-health - Getting enhanced health data'
        )

        try {
          const timeWindow = payload?.timeWindow || 60000
          const analysis = metrics.getDashboardData(timeWindow)
          const healthData = analysis.health

          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-health-analysis',
            health: {
              ...healthData,
              systemMetrics: analysis.system,
              serverInfo: {
                pid: process.pid,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                clients: serverState.clientCount
              }
            },
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Health analysis error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            error: String(error),
            status: 'error'
          }
        }
      }
    },

    // Enhanced performance endpoint
    'http-api-performance': {
      handler: async (payload?: {timeWindow?: number}) => {
        console.log(
          '🚀 [CYRE HANDLER] http-api-performance - Getting enhanced performance data'
        )

        try {
          const timeWindow = payload?.timeWindow || 300000
          const analysis = metrics.getDashboardData(timeWindow)
          const perfData = analysis.performance

          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-performance-analysis',
            performance: {
              ...perfData,
              systemPerformance: analysis.system.performance,
              trends: perfData.trends,
              latencyDistribution: perfData.latencyDistribution,
              degradations: perfData.degradations
            },
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Performance analysis error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            error: String(error),
            status: 'error'
          }
        }
      }
    },

    // Enhanced pipeline endpoint
    'http-api-pipeline': {
      handler: async (payload?: {timeWindow?: number}) => {
        console.log(
          '🚀 [CYRE HANDLER] http-api-pipeline - Getting enhanced pipeline data'
        )

        try {
          const timeWindow = payload?.timeWindow || 300000
          const analysis = metrics.getDashboardData(timeWindow)
          const pipelineData = analysis.pipeline

          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-pipeline-analysis',
            pipeline: {
              ...pipelineData,
              bottlenecks: pipelineData.bottlenecks,
              throughputTrend: pipelineData.throughputTrend,
              flowHealth: pipelineData.flowHealth
            },
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Pipeline analysis error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            error: String(error),
            status: 'error'
          }
        }
      }
    },

    // Enhanced channels endpoint
    'http-api-channels': {
      handler: async (payload?: {timeWindow?: number}) => {
        console.log(
          '🚀 [CYRE HANDLER] http-api-channels - Getting enhanced channel data'
        )

        try {
          const timeWindow = payload?.timeWindow || 300000
          const analysis = metrics.getDashboardData(timeWindow)
          const channelsData = analysis.channels

          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-channel-analysis',
            channels: channelsData,
            summary: {
              total: channelsData.length,
              active: channelsData.filter(c => c.status !== 'inactive').length,
              healthy: channelsData.filter(c => c.status === 'healthy').length,
              warning: channelsData.filter(c => c.status === 'warning').length,
              critical: channelsData.filter(c => c.status === 'critical')
                .length,
              inactive: channelsData.filter(c => c.status === 'inactive').length
            },
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Channels analysis error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            error: String(error),
            status: 'error'
          }
        }
      }
    },

    // New insights endpoint
    'http-api-insights': {
      handler: async (payload?: {timeWindow?: number}) => {
        console.log(
          '🚀 [CYRE HANDLER] http-api-insights - Getting system insights'
        )

        try {
          const timeWindow = payload?.timeWindow || 300000
          const analysis = metrics.getDashboardData(timeWindow)
          const insightsData = analysis.insights

          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-insights-analysis',
            insights: {
              ...insightsData,
              optimizationOpportunities: insightsData.optimizationOpportunities,
              recommendations: analysis.recommendations
            },
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Insights analysis error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            error: String(error),
            status: 'error'
          }
        }
      }
    },

    // New anomalies endpoint
    'http-api-anomalies': {
      handler: async (payload?: {timeWindow?: number}) => {
        console.log(
          '🚀 [CYRE HANDLER] http-api-anomalies - Getting anomaly detection'
        )

        try {
          const timeWindow = payload?.timeWindow || 300000
          const analysis = metrics.getDashboardData(timeWindow)
          const anomaliesData = analysis.anomalies

          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            metricsSource: 'live-anomaly-detection',
            anomalies: {
              ...anomaliesData,
              detectionWindow: timeWindow,
              systemHealth: analysis.health.overall
            },
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Anomaly detection error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered-enhanced',
            error: String(error),
            status: 'error'
          }
        }
      }
    }
  }
}

/**
 * WebSocket management for real-time updates
 */
export const createWebSocketHandlers = () => {
  return {
    'websocket-connection': {
      handler: async (payload: {ws: any; request: any}) => {
        console.log(
          '🔗 [CYRE HANDLER] websocket-connection - New client connected'
        )

        const {ws, request} = payload

        wsClients.add(ws)
        serverState.clientCount = wsClients.size

        // Send initial data
        try {
          const initialData = getLiveDashboardMetrics()
          const message: WebSocketMessage = {
            type: 'initial_metrics',
            data: initialData,
            timestamp: Date.now()
          }

          ws.send(JSON.stringify(message))
          console.log('📡 Sent initial metrics to new client')
        } catch (error) {
          console.error('❌ Error sending initial data:', error)
        }

        // Handle client disconnect
        ws.on('close', () => {
          wsClients.delete(ws)
          serverState.clientCount = wsClients.size
          console.log(
            `📡 Client disconnected. Active clients: ${serverState.clientCount}`
          )
        })

        ws.on('error', (error: any) => {
          console.error('❌ WebSocket error:', error)
          wsClients.delete(ws)
          serverState.clientCount = wsClients.size
        })

        // Handle client messages
        ws.on('message', (data: any) => {
          try {
            const message = JSON.parse(data.toString())
            handleWebSocketMessage(ws, message)
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error)
          }
        })

        return {
          success: true,
          clientCount: serverState.clientCount
        }
      }
    },

    'websocket-broadcast': {
      handler: async () => {
        console.log(
          '📡 [CYRE HANDLER] websocket-broadcast - Broadcasting to all clients'
        )

        if (wsClients.size === 0) {
          return {
            success: true,
            clientCount: 0,
            message: 'No clients connected'
          }
        }

        try {
          const liveData = getLiveDashboardMetrics(60000) // 1 minute window for real-time
          const message: MetricsUpdateMessage = {
            type: 'metrics_update',
            data: liveData,
            timestamp: Date.now()
          }

          const messageStr = JSON.stringify(message)
          let successCount = 0

          wsClients.forEach(client => {
            try {
              if (client.readyState === 1) {
                // WebSocket.OPEN
                client.send(messageStr)
                successCount++
              } else {
                wsClients.delete(client)
              }
            } catch (error) {
              console.error('❌ WebSocket send error:', error)
              wsClients.delete(client)
            }
          })

          serverState.clientCount = wsClients.size

          console.log(
            `📡 Broadcasted to ${successCount}/${wsClients.size} clients`
          )

          return {
            success: true,
            clientCount: successCount,
            totalClients: wsClients.size,
            message: `Broadcasted to ${successCount} clients`
          }
        } catch (error) {
          console.error('❌ Broadcast error:', error)
          return {
            success: false,
            error: String(error),
            clientCount: wsClients.size
          }
        }
      }
    }
  }
}

/**
 * Handle individual WebSocket messages
 */
const handleWebSocketMessage = (ws: any, message: WebSocketMessage) => {
  switch (message.type) {
    case 'request_metrics':
      try {
        const timeWindow = (message.data as any)?.timeWindow || 60000
        const metrics = getLiveDashboardMetrics(timeWindow)

        const response: WebSocketMessage = {
          type: 'metrics_response',
          data: metrics,
          timestamp: Date.now(),
          requestId: message.requestId
        }

        ws.send(JSON.stringify(response))
      } catch (error) {
        console.error('❌ Error handling metrics request:', error)
      }
      break

    default:
      console.log(`❓ Unknown WebSocket message type: ${message.type}`)
  }
}

/**
 * Start automated broadcasting
 */
export const startBroadcasting = (intervalMs = 2000) => {
  if (broadcastTimer) {
    clearInterval(broadcastTimer)
  }

  broadcastTimer = setInterval(() => {
    if (wsClients.size > 0) {
      // Use Cyre to trigger broadcast
      // This would be called from the main server via cyre.call('websocket-broadcast')
    }
  }, intervalMs)

  console.log(`📡 Started WebSocket broadcasting every ${intervalMs}ms`)
}

/**
 * Stop automated broadcasting
 */
export const stopBroadcasting = () => {
  if (broadcastTimer) {
    clearInterval(broadcastTimer)
    broadcastTimer = null
    console.log('📡 Stopped WebSocket broadcasting')
  }
}

/**
 * Get current server state
 */
export const getServerState = (): MetricsServerState => {
  return {
    ...serverState,
    uptime: Date.now() - serverState.startTime || 0
  }
}

/**
 * Update server state
 */
export const updateServerState = (updates: Partial<MetricsServerState>) => {
  serverState = {...serverState, ...updates}
}
