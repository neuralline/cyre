// src/dev/cyre-app-with-metrics.ts
// Cyre networking server with real metrics data integration

import {createServer, Server, IncomingMessage, ServerResponse} from 'http'
import {WebSocketServer, WebSocket} from 'ws'
import cyre from '../src'
import {metrics} from '../src/metrics'
import {metricsCore} from '../src/metrics/core'

/*

      C.Y.R.E - N.E.T.W.O.R.K.I.N.G - S.E.R.V.E.R
      
      Real metrics data server powered by Cyre:
      - All endpoints return live/real data from Cyre metrics
      - Follows SystemAnalysis interface structure
      - Uses unified analyzer for comprehensive data
      - No mock data - everything is real system metrics
      - Added /api/metrics endpoint for dashboard

*/

interface ServerState {
  server: Server | null
  wsServer: WebSocketServer | null
  isRunning: boolean
  clientCount: number
  startTime: number
  updateTimer: NodeJS.Timeout | null
}

const serverState: ServerState = {
  server: null,
  wsServer: null,
  isRunning: false,
  clientCount: 0,
  startTime: Date.now(),
  updateTimer: null
}

// Initialize Cyre first
cyre.initialize()

/**
 * Setup Cyre networking channels for server management
 */
const setupCyreNetworkingChannels = () => {
  console.log('🔧 Registering Cyre networking channels...')

  // Server lifecycle management channels
  const serverChannels = [
    {
      id: 'server-start',
      tags: ['server', 'lifecycle', 'start']
    },
    {
      id: 'server-stop',
      tags: ['server', 'lifecycle', 'stop']
    },
    {
      id: 'server-status',
      tags: ['server', 'monitoring', 'status']
    }
  ]

  // HTTP request handling channels
  const httpChannels = [
    {
      id: 'http-request-router',
      tags: ['http', 'router', 'request']
    },
    {
      id: 'http-api-analyze',
      tags: ['http', 'api', 'analyze']
    },
    {
      id: 'http-api-health',
      tags: ['http', 'api', 'health']
    },
    {
      id: 'http-api-performance',
      tags: ['http', 'api', 'performance']
    },
    {
      id: 'http-api-status',
      tags: ['http', 'api', 'status']
    },
    {
      id: 'http-api-channels',
      tags: ['http', 'api', 'channels']
    },
    {
      id: 'http-api-pipeline',
      tags: ['http', 'api', 'pipeline']
    },
    {
      id: 'http-api-metrics',
      tags: ['http', 'api', 'metrics']
    },
    {
      id: 'http-cors-handler',
      tags: ['http', 'cors', 'middleware']
    }
  ]

  // WebSocket management channels
  const wsChannels = [
    {
      id: 'websocket-connection',
      tags: ['websocket', 'connection', 'lifecycle']
    },
    {
      id: 'websocket-message',
      tags: ['websocket', 'message', 'handler']
    },
    {
      id: 'websocket-broadcast',
      interval: 1000,
      repeat: Infinity,
      tags: ['websocket', 'broadcast', 'metrics']
    },
    {
      id: 'websocket-cleanup',
      interval: 30000,
      repeat: Infinity,
      tags: ['websocket', 'cleanup', 'maintenance']
    }
  ]

  // Metrics collection channels
  const metricsChannels = [
    {
      id: 'metrics-collector',
      interval: 2000,
      repeat: Infinity,
      tags: ['metrics', 'collection', 'system']
    },
    {
      id: 'metrics-aggregator',
      interval: 5000,
      repeat: Infinity,
      tags: ['metrics', 'aggregation', 'analysis']
    },
    {
      id: 'metrics-snapshot',
      tags: ['metrics', 'snapshot', 'capture']
    }
  ]

  // Register all channels
  const allChannels = [
    ...serverChannels,
    ...httpChannels,
    ...wsChannels,
    ...metricsChannels
  ]

  try {
    const result = cyre.action(allChannels)
    if (result.ok) {
      console.log(`   ✅ Registered ${allChannels.length} networking channels`)
    } else {
      console.log(`   ⚠️ Batch registration failed: ${result.message}`)
    }
  } catch (error) {
    console.log(`   ❌ Failed to register channels: ${error}`)
  }
}

/**
 * Setup Cyre networking handlers with real metrics data
 */
const setupCyreNetworkingHandlers = () => {
  console.log('🔧 Setting up Cyre networking handlers with real metrics...')

  const handlers = [
    // Server lifecycle handlers
    {
      id: 'server-start',
      handler: async (payload: any) => {
        const {port = 3001, host = '0.0.0.0'} = payload

        console.log(`🚀 [CYRE HANDLER] server-start triggered - Port: ${port}`)

        return new Promise((resolve, reject) => {
          try {
            serverState.server = createServer(async (req, res) => {
              const routerPayload = {
                url: req.url,
                method: req.method,
                headers: req.headers
              }
              const result = await cyre.call(
                'http-request-router',
                routerPayload
              )

              if (result.ok && result.payload) {
                res.writeHead(result.payload.status, result.payload.headers)
                res.end(result.payload.body)
              } else {
                res.writeHead(500)
                res.end('Internal Server Error')
              }
            })

            // Setup WebSocket server
            serverState.wsServer = new WebSocketServer({
              server: serverState.server,
              path: '/metrics'
            })

            serverState.wsServer.on('connection', (ws, req) => {
              serverState.clientCount++

              console.log(`📡 [WS CONNECT] New WebSocket client connected!`)
              console.log(`   - Remote Address: ${req.socket.remoteAddress}`)
              console.log(`   - URL: ${req.url}`)
              console.log(`   - User-Agent: ${req.headers['user-agent']}`)
              console.log(`   - Total Clients: ${serverState.clientCount}`)

              // Send initial metrics immediately
              try {
                const initialSnapshot = metrics.snapshot()
                const initialMessage = JSON.stringify({
                  type: 'initial_metrics',
                  timestamp: Date.now(),
                  server: 'cyre-powered',
                  data: initialSnapshot,
                  welcome: 'Connected to Cyre metrics server'
                })

                ws.send(initialMessage)
                console.log(
                  `📡 [WS INIT] Sent initial metrics to new client (${Math.round(
                    initialMessage.length / 1024
                  )}KB)`
                )
              } catch (error) {
                console.error('❌ Failed to send initial metrics:', error)
              }

              cyre.call('websocket-connection', {
                action: 'connect',
                clientCount: serverState.clientCount,
                remoteAddress: req.socket.remoteAddress
              })

              ws.on('close', () => {
                serverState.clientCount--
                console.log(
                  `📡 [WS DISCONNECT] Client disconnected (remaining: ${serverState.clientCount})`
                )

                cyre.call('websocket-connection', {
                  action: 'disconnect',
                  clientCount: serverState.clientCount
                })
              })

              ws.on('message', message => {
                const messageStr = message.toString()
                console.log(
                  `📡 [WS MESSAGE] Received from client: ${messageStr.slice(
                    0,
                    100
                  )}${messageStr.length > 100 ? '...' : ''}`
                )

                // Echo back for testing
                try {
                  const parsedMessage = JSON.parse(messageStr)
                  if (parsedMessage.type === 'ping') {
                    const pongResponse = JSON.stringify({
                      type: 'pong',
                      timestamp: Date.now(),
                      originalTimestamp: parsedMessage.timestamp,
                      server: 'cyre-powered'
                    })
                    ws.send(pongResponse)
                    console.log(`📡 [WS PONG] Responded to ping from client`)
                  }
                } catch (error) {
                  // Not JSON, ignore
                }

                cyre.call('websocket-message', {
                  message: messageStr,
                  clientCount: serverState.clientCount
                })
              })

              ws.on('error', error => {
                console.error(
                  `❌ [WS ERROR] WebSocket client error: ${error.message}`
                )
              })
            })

            // Start metrics broadcasting
            serverState.updateTimer = setInterval(() => {
              cyre.call('websocket-broadcast')
            }, 1000)

            serverState.server.listen(port, host, () => {
              serverState.isRunning = true
              serverState.startTime = Date.now()
              console.log(`🚀 [CYRE HANDLER] Server started on ${host}:${port}`)
              console.log(`📡 WebSocket server ready - waiting for clients...`)
              console.log(
                `💡 Test connection: bun run scripts/test-websocket.ts`
              )
              resolve({
                started: true,
                port,
                host,
                timestamp: Date.now()
              })
            })

            serverState.server.on('error', error => {
              console.error(`❌ [CYRE HANDLER] Server error:`, error)
              reject(error)
            })
          } catch (error) {
            console.error(`❌ [CYRE HANDLER] Failed to start server:`, error)
            reject(error)
          }
        })
      }
    },

    {
      id: 'server-stop',
      handler: async () => {
        console.log(`🚀 [CYRE HANDLER] server-stop triggered`)

        if (serverState.updateTimer) {
          clearInterval(serverState.updateTimer)
          serverState.updateTimer = null
        }

        if (serverState.wsServer) {
          serverState.wsServer.close()
          serverState.wsServer = null
        }

        if (serverState.server) {
          await new Promise<void>(resolve => {
            serverState.server!.close(() => {
              serverState.isRunning = false
              resolve()
            })
          })
        }

        return {
          stopped: true,
          timestamp: Date.now()
        }
      }
    },

    {
      id: 'server-status',
      handler: async () => {
        return {
          isRunning: serverState.isRunning,
          clientCount: serverState.clientCount,
          uptime: Date.now() - serverState.startTime,
          timestamp: Date.now()
        }
      }
    },

    // HTTP request routing handler
    {
      id: 'http-request-router',
      handler: async (payload: any) => {
        const {url, method} = payload
        const pathname = new URL(url, 'http://localhost').pathname

        console.log(
          `🚀 [CYRE HANDLER] http-request-router: ${method} ${pathname}`
        )

        // Add CORS headers
        await cyre.call('http-cors-handler', payload)

        if (method === 'OPTIONS') {
          return {
            status: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: ''
          }
        }

        if (method !== 'GET') {
          return {
            status: 405,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({error: 'Method not allowed'})
          }
        }

        const headers = {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }

        switch (pathname) {
          case '/api/analyze':
            const analyzeResult = await cyre.call('http-api-analyze', payload)
            return {
              status: 200,
              headers,
              body: JSON.stringify(
                analyzeResult.payload || {error: 'No analysis available'}
              )
            }

          case '/api/health':
            const healthResult = await cyre.call('http-api-health', payload)
            return {
              status: 200,
              headers,
              body: JSON.stringify(healthResult.payload || {status: 'unknown'})
            }

          case '/api/status':
            const statusResult = await cyre.call('http-api-status', payload)
            return {
              status: 200,
              headers,
              body: JSON.stringify(statusResult.payload || {status: 'unknown'})
            }

          case '/api/performance':
            const perfResult = await cyre.call('http-api-performance', payload)
            return {
              status: 200,
              headers,
              body: JSON.stringify(
                perfResult.payload || {performance: 'unknown'}
              )
            }

          case '/api/channels':
            const channelsResult = await cyre.call('http-api-channels', payload)
            return {
              status: 200,
              headers,
              body: JSON.stringify(channelsResult.payload || {channels: []})
            }

          case '/api/pipeline':
            const pipelineResult = await cyre.call('http-api-pipeline', payload)
            return {
              status: 200,
              headers,
              body: JSON.stringify(
                pipelineResult.payload || {pipeline: 'unknown'}
              )
            }

          case '/api/metrics':
            const metricsResult = await cyre.call('http-api-metrics', payload)
            return {
              status: 200,
              headers,
              body: JSON.stringify(
                metricsResult.payload || {error: 'No metrics available'}
              )
            }

          default:
            return {
              status: 404,
              headers,
              body: JSON.stringify({
                error: 'Not found',
                availableEndpoints: [
                  '/api/analyze',
                  '/api/health',
                  '/api/status',
                  '/api/performance',
                  '/api/channels',
                  '/api/pipeline',
                  '/api/metrics'
                ]
              })
            }
        }
      }
    },

    // API endpoint handlers with REAL metrics data
    {
      id: 'http-api-analyze',
      handler: async () => {
        console.log(
          `🚀 [CYRE HANDLER] http-api-analyze - Getting live system analysis`
        )

        try {
          // Get comprehensive system analysis using real metrics
          const systemAnalysis = metrics.analyze(300000) // 5 minute window

          return {
            timestamp: Date.now(),
            server: 'cyre-powered',
            metricsSource: 'live-cyre-system',
            analysis: systemAnalysis,
            status: 'success'
          }
        } catch (error) {
          console.error('❌ Analysis error:', error)
          return {
            timestamp: Date.now(),
            server: 'cyre-powered',
            metricsSource: 'live-cyre-system',
            error: String(error),
            status: 'error'
          }
        }
      }
    },

    {
      id: 'http-api-health',
      handler: async () => {
        console.log(
          `🚀 [CYRE HANDLER] http-api-health - Getting real health data`
        )

        try {
          // Get real health data from metrics system
          const healthData = metrics.healthCheck()
          const systemMetrics = metrics.getSystemMetrics()
          const serverStatus = await cyre.call('server-status')

          return {
            status: healthData.status,
            server: 'cyre-powered',
            score: healthData.score,
            uptime: serverStatus.payload?.uptime || 0,
            clients: serverState.clientCount,
            system: {
              totalCalls: systemMetrics.totalCalls,
              totalExecutions: systemMetrics.totalExecutions,
              totalErrors: systemMetrics.totalErrors,
              callRate: systemMetrics.callRate,
              lastCallTime: systemMetrics.lastCallTime
            },
            health: {
              issues: healthData.issues,
              criticalAlerts: healthData.criticalAlerts
            },
            timestamp: Date.now()
          }
        } catch (error) {
          console.error('❌ Health check error:', error)
          return {
            status: 'error',
            server: 'cyre-powered',
            error: String(error),
            timestamp: Date.now()
          }
        }
      }
    },

    {
      id: 'http-api-performance',
      handler: async () => {
        console.log(
          `🚀 [CYRE HANDLER] http-api-performance - Getting real performance data`
        )

        try {
          // Get real performance data from metrics system
          const performanceData = metrics.performanceReport(300000)

          return {
            server: 'cyre-powered',
            metricsSource: 'live-cyre-system',
            performance: {
              avgLatency: performanceData.avgLatency,
              p95Latency: performanceData.p95Latency,
              throughput: performanceData.throughput,
              successRate: performanceData.successRate,
              errorRate: performanceData.errorRate,
              trends: performanceData.trends
            },
            degradations: performanceData.degradations,
            timestamp: Date.now()
          }
        } catch (error) {
          console.error('❌ Performance analysis error:', error)
          return {
            server: 'cyre-powered',
            error: String(error),
            timestamp: Date.now()
          }
        }
      }
    },

    {
      id: 'http-api-status',
      handler: async () => {
        console.log(
          `🚀 [CYRE HANDLER] http-api-status - Getting real server status`
        )

        try {
          const serverStatus = await cyre.call('server-status')
          const systemMetrics = metrics.getSystemMetrics()

          return {
            status: 'operational',
            server: 'cyre-powered-networking',
            version: '4.6.0',
            uptime: serverStatus.payload?.uptime || 0,
            clients: serverState.clientCount,
            isRunning: serverState.isRunning,
            system: {
              totalCalls: systemMetrics.totalCalls,
              totalExecutions: systemMetrics.totalExecutions,
              startTime: systemMetrics.startTime,
              uptime: systemMetrics.uptime
            },
            endpoints: [
              '/api/analyze',
              '/api/health',
              '/api/status',
              '/api/performance',
              '/api/channels',
              '/api/pipeline',
              '/api/metrics'
            ],
            websocket: {
              enabled: true,
              path: '/metrics',
              clients: serverState.clientCount
            },
            timestamp: Date.now()
          }
        } catch (error) {
          console.error('❌ Status error:', error)
          return {
            status: 'error',
            server: 'cyre-powered-networking',
            error: String(error),
            timestamp: Date.now()
          }
        }
      }
    },

    {
      id: 'http-api-channels',
      handler: async () => {
        console.log(
          `🚀 [CYRE HANDLER] http-api-channels - Getting real channel data`
        )

        try {
          // Get real channel metrics from the system
          const allChannelMetrics = metricsCore.getAllChannelMetrics()

          const channelData = allChannelMetrics.map(channel => ({
            id: channel.id,
            calls: channel.calls,
            executions: channel.executions,
            errors: channel.errors,
            successRate: channel.successRate,
            errorRate: channel.errorRate,
            averageLatency: channel.averageLatency,
            lastExecution: channel.lastExecution,
            protectionEvents: channel.protectionEvents
          }))

          return {
            server: 'cyre-powered',
            metricsSource: 'live-cyre-system',
            totalChannels: channelData.length,
            channels: channelData,
            summary: {
              totalCalls: channelData.reduce((sum, c) => sum + c.calls, 0),
              totalExecutions: channelData.reduce(
                (sum, c) => sum + c.executions,
                0
              ),
              totalErrors: channelData.reduce((sum, c) => sum + c.errors, 0),
              avgSuccessRate:
                channelData.length > 0
                  ? channelData.reduce((sum, c) => sum + c.successRate, 0) /
                    channelData.length
                  : 0
            },
            timestamp: Date.now()
          }
        } catch (error) {
          console.error('❌ Channels error:', error)
          return {
            server: 'cyre-powered',
            error: String(error),
            timestamp: Date.now()
          }
        }
      }
    },

    {
      id: 'http-api-pipeline',
      handler: async () => {
        console.log(
          `🚀 [CYRE HANDLER] http-api-pipeline - Getting real pipeline data`
        )

        try {
          // Get real pipeline data from metrics system
          const pipelineData = metrics.pipelineReport(300000)

          return {
            server: 'cyre-powered',
            metricsSource: 'live-cyre-system',
            pipeline: {
              totalCalls: pipelineData.totalCalls,
              completedCalls: pipelineData.completedCalls,
              failedCalls: pipelineData.failedCalls,
              stuckCalls: pipelineData.stuckCalls,
              avgDuration: pipelineData.avgDuration,
              efficiency: pipelineData.efficiency,
              flowHealth: pipelineData.flowHealth,
              bottlenecks: pipelineData.bottlenecks
            },
            timestamp: Date.now()
          }
        } catch (error) {
          console.error('❌ Pipeline analysis error:', error)
          return {
            server: 'cyre-powered',
            error: String(error),
            timestamp: Date.now()
          }
        }
      }
    },

    {
      id: 'http-api-metrics',
      handler: async () => {
        console.log(
          `🚀 [CYRE HANDLER] http-api-metrics - Getting dashboard metrics data`
        )

        try {
          // Get comprehensive system analysis for dashboard
          const systemAnalysis = metrics.analyze(300000) // 5 minute window
          const systemMetrics = metrics.getSystemMetrics()
          const channelMetrics = metricsCore.getAllChannelMetrics()

          // Format data in the structure the dashboard expects
          const dashboardData = {
            timestamp: Date.now(),
            metrics: {
              system: {
                totalCalls: systemMetrics.totalCalls,
                totalExecutions: systemMetrics.totalExecutions,
                totalErrors: systemMetrics.totalErrors,
                uptime: systemMetrics.uptime,
                callRate: systemMetrics.callRate,
                startTime: systemMetrics.startTime,
                lastCallTime: systemMetrics.lastCallTime
              },
              health: {
                overall: systemAnalysis.health.overall,
                score: systemAnalysis.health.score,
                factors: systemAnalysis.health.factors,
                issues: systemAnalysis.health.issues,
                criticalAlerts: systemAnalysis.health.criticalAlerts
              },
              performance: {
                avgLatency: systemAnalysis.performance.avgLatency,
                p95Latency: systemAnalysis.performance.p95Latency,
                throughput: systemAnalysis.performance.throughput,
                successRate: systemAnalysis.performance.successRate,
                errorRate: systemAnalysis.performance.errorRate,
                degradations: systemAnalysis.performance.degradations,
                trends: systemAnalysis.performance.trends
              },
              pipeline: {
                totalCalls: systemAnalysis.pipeline.totalCalls,
                completedCalls: systemAnalysis.pipeline.completedCalls,
                failedCalls: systemAnalysis.pipeline.failedCalls,
                stuckCalls: systemAnalysis.pipeline.stuckCalls,
                avgDuration: systemAnalysis.pipeline.avgDuration,
                efficiency: systemAnalysis.pipeline.efficiency,
                flowHealth: systemAnalysis.pipeline.flowHealth,
                bottlenecks: systemAnalysis.pipeline.bottlenecks
              },
              channels: channelMetrics.map(channel => ({
                id: channel.id,
                calls: channel.calls,
                executions: channel.executions,
                errors: channel.errors,
                successRate: channel.successRate,
                errorRate: channel.errorRate,
                averageLatency: channel.averageLatency,
                lastExecution: channel.lastExecution,
                protectionEvents: channel.protectionEvents
              })),
              events:
                systemAnalysis.system.totalCalls > 0
                  ? metricsCore.getEvents({limit: 50}).map(event => ({
                      actionId: event.actionId,
                      eventType: event.eventType,
                      timestamp: event.timestamp,
                      message: event.message
                    }))
                  : [],
              anomalies: systemAnalysis.anomalies,
              insights: systemAnalysis.insights,
              recommendations: systemAnalysis.recommendations
            },
            server: {
              pid: process.pid,
              uptime: process.uptime(),
              version: '4.6.0',
              type: 'cyre-powered'
            },
            cyreRunning: true
          }

          console.log(
            `📊 [METRICS] Sending dashboard data: ${channelMetrics.length} channels, ${dashboardData.metrics.events.length} events`
          )

          return dashboardData
        } catch (error) {
          console.error('❌ Metrics endpoint error:', error)
          return {
            timestamp: Date.now(),
            error: String(error),
            server: 'cyre-powered',
            cyreRunning: false
          }
        }
      }
    },

    {
      id: 'http-cors-handler',
      handler: async () => {
        console.log(`🚀 [CYRE HANDLER] http-cors-handler - Handling CORS`)
        return {
          corsHandled: true,
          origin: '*',
          methods: 'GET, OPTIONS',
          timestamp: Date.now()
        }
      }
    },

    // WebSocket handlers
    {
      id: 'websocket-connection',
      handler: async (payload: any) => {
        const {action, clientCount, remoteAddress} = payload

        if (action === 'connect') {
          console.log(
            `🚀 [CYRE HANDLER] websocket-connection - Client connected from ${
              remoteAddress || 'unknown'
            } (total: ${clientCount})`
          )
        } else if (action === 'disconnect') {
          console.log(
            `🚀 [CYRE HANDLER] websocket-connection - Client disconnected (total: ${clientCount})`
          )
        }

        return {
          handled: true,
          action,
          clientCount,
          timestamp: Date.now()
        }
      }
    },

    {
      id: 'websocket-message',
      handler: async (payload: any) => {
        console.log(
          `🚀 [CYRE HANDLER] websocket-message - Processing: ${payload.message.slice(
            0,
            50
          )}${payload.message.length > 50 ? '...' : ''}`
        )

        return {
          received: true,
          messageLength: payload.message.length,
          timestamp: Date.now()
        }
      }
    },

    {
      id: 'websocket-broadcast',
      handler: async () => {
        if (serverState.wsServer && serverState.clientCount > 0) {
          try {
            // Get real-time metrics snapshot
            const snapshot = metrics.snapshot()
            const metricsData = JSON.stringify({
              type: 'metrics_update',
              timestamp: Date.now(),
              server: 'cyre-powered',
              data: snapshot
            })

            let sentCount = 0
            serverState.wsServer.clients.forEach(client => {
              if (client.readyState === 1) {
                // WebSocket.OPEN = 1
                try {
                  client.send(metricsData)
                  sentCount++
                } catch (error) {
                  console.error('❌ Failed to send to WebSocket client:', error)
                }
              }
            })

            // Only log occasionally to avoid spam, but log when there are clients
            if (sentCount > 0 && Math.random() < 0.1) {
              console.log(
                `📡 [WS BROADCAST] Sent metrics to ${sentCount} clients (${Math.round(
                  metricsData.length / 1024
                )}KB)`
              )
            }

            return {
              broadcast: true,
              clientsSent: sentCount,
              dataSize: metricsData.length,
              timestamp: Date.now()
            }
          } catch (error) {
            console.error('❌ WebSocket broadcast error:', error)
            return {
              broadcast: false,
              error: String(error),
              timestamp: Date.now()
            }
          }
        } else {
          // Log no clients occasionally for debugging
          if (Math.random() < 0.01) {
            // 1% chance to avoid spam
            console.log(
              `📡 [WS BROADCAST] No clients connected (${serverState.clientCount} total)`
            )
          }
        }

        return {
          broadcast: false,
          reason: serverState.wsServer ? 'no_clients' : 'no_server',
          clientCount: serverState.clientCount,
          timestamp: Date.now()
        }
      }
    },

    {
      id: 'websocket-cleanup',
      handler: async () => {
        if (serverState.wsServer) {
          let cleanedCount = 0
          serverState.wsServer.clients.forEach(client => {
            if (client.readyState === 3) {
              // WebSocket.CLOSED = 3
              client.terminate()
              cleanedCount++
            }
          })

          if (cleanedCount > 0) {
            console.log(
              `🚀 [CYRE HANDLER] websocket-cleanup - Cleaned ${cleanedCount} closed connections`
            )
          }

          return {
            cleaned: cleanedCount,
            totalClients: serverState.clientCount,
            timestamp: Date.now()
          }
        }

        return {
          cleaned: 0,
          timestamp: Date.now()
        }
      }
    },

    // Metrics collection handlers
    {
      id: 'metrics-collector',
      handler: async () => {
        // This handler can be used for periodic metrics collection
        // The actual collection happens automatically via the sensor system
        return {
          collected: true,
          timestamp: Date.now()
        }
      }
    },

    {
      id: 'metrics-aggregator',
      handler: async () => {
        // This handler can be used for periodic metrics aggregation
        // The actual aggregation happens automatically via the analyzer
        return {
          aggregated: true,
          timestamp: Date.now()
        }
      }
    },

    {
      id: 'metrics-snapshot',
      handler: async () => {
        console.log(
          `🚀 [CYRE HANDLER] metrics-snapshot - Creating real metrics snapshot`
        )

        try {
          // Get real metrics snapshot
          const snapshot = metrics.snapshot()

          return {
            snapshotCreated: true,
            data: snapshot,
            timestamp: Date.now()
          }
        } catch (error) {
          console.error('❌ Metrics snapshot error:', error)
          return {
            snapshotCreated: false,
            error: String(error),
            timestamp: Date.now()
          }
        }
      }
    }
  ]

  // Register all handlers
  try {
    const result = cyre.on(handlers)
    if (result.ok) {
      console.log(`   ✅ ${result.message}`)
    } else {
      console.log(`   ⚠️ ${result.message}`)
    }
  } catch (error) {
    console.log(`   ❌ ${error}`)
  }
}

/**
 * Start the Cyre-powered server with real metrics
 */
const startCyrePoweredServer = async () => {
  try {
    console.log('\n🧠 Starting Cyre-Powered Real Metrics Server')
    console.log('═'.repeat(60))

    // 1. Initialize metrics system
    console.log('📊 Initializing metrics system...')
    metrics.initialize()

    // 2. Setup all networking channels and handlers
    setupCyreNetworkingChannels()
    setupCyreNetworkingHandlers()

    // 3. Start the server through Cyre
    console.log('🚀 Starting server via Cyre channels...')
    const startResult = await cyre.call('server-start', {
      port: 3001,
      host: '0.0.0.0'
    })

    if (!startResult.ok) {
      throw new Error(`Failed to start server: ${startResult.message}`)
    }

    console.log('\n🎉 Cyre-Powered Real Metrics Server Running!')
    console.log('═'.repeat(60))
    console.log('🧠 Server infrastructure: 100% Cyre-powered')
    console.log('📊 Metrics data: 100% real/live from Cyre system')
    console.log('🌐 HTTP requests: Routed through Cyre channels')
    console.log('📡 WebSocket: Managed by Cyre orchestrations')
    console.log('⚡ All endpoints: Return real SystemAnalysis data')
    console.log('═'.repeat(60))
    console.log('📊 API Endpoints (all with REAL data):')
    console.log(
      '   • http://localhost:3001/api/analyze    - Full SystemAnalysis'
    )
    console.log(
      '   • http://localhost:3001/api/health     - Real health metrics'
    )
    console.log(
      '   • http://localhost:3001/api/status     - Server & system status'
    )
    console.log(
      '   • http://localhost:3001/api/performance - Live performance data'
    )
    console.log(
      '   • http://localhost:3001/api/channels   - Real channel metrics'
    )
    console.log('   • http://localhost:3001/api/pipeline   - Pipeline analysis')
    console.log(
      '   • http://localhost:3001/api/metrics    - Dashboard data format'
    )
    console.log('📡 WebSocket: ws://localhost:3001/metrics (real-time data)')
    console.log('═'.repeat(60))
    console.log('💡 All data is REAL - no mock data anywhere!')
    console.log('💡 Follows SystemAnalysis interface structure!')
    console.log('💡 Dashboard can use HTTP polling OR WebSocket streaming!')
    console.log('═'.repeat(60))
    console.log('\n💡 Press Ctrl+C to stop\n')
  } catch (error) {
    console.error('❌ Failed to start Cyre-powered server:', error)
    process.exit(1)
  }
}

// Graceful shutdown via Cyre
const shutdown = async () => {
  console.log('\n⏹️ Shutting down Cyre-powered server...')
  try {
    await cyre.call('server-stop')
    metrics.shutdown()
    console.log('✅ Cyre-powered server stopped')
    process.exit(0)
  } catch (error) {
    console.error('❌ Shutdown error:', error)
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

startCyrePoweredServer().catch(console.error)
