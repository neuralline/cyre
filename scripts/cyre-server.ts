// scripts/cyre-server.ts
// Cyre server using core features and existing metrics API

import {createServer, Server} from 'http'
import cyre, {log} from '../src'
import {metrics} from '../src/metrics/integration'
import {metricsState} from '../src/context/metrics-state'
import {metricsCore} from '../src/metrics'

/*
    C.Y.R.E - S.I.M.P.L.E - S.E.R.V.E.R
    
    Pure Cyre server using only core features:
    - action/on/call patterns (no switch-case routing)
    - Existing metrics API integration
    - Proper Ctrl+C handling
    - No WebSockets, branches, groups, or hooks
    - Live route management through Cyre channels
*/

interface SimpleServerState {
  server: Server | null
  isRunning: boolean
  startTime: number
  port: number
  host: string
}

const serverState: SimpleServerState = {
  server: null,
  isRunning: false,
  startTime: Date.now(),
  port: 3001,
  host: '0.0.0.0'
}

// Initialize Cyre
cyre.initialize()

/**
 * Register server route actions
 */
const registerServerActions = () => {
  log.info('🛣️ Registering server actions...')

  // Server lifecycle actions
  const serverActions = [
    {id: 'server-start', required: true},
    {id: 'server-stop'},
    {id: 'server-status'}
  ]

  // HTTP route actions with performance optimizations
  const routeActions = [
    {id: 'route-health', throttle: 0}, // No throttling for health
    {id: 'route-api-health', throttle: 100},
    {id: 'route-api-analyze', throttle: 200},
    {id: 'route-api-performance', throttle: 300},
    {id: 'route-api-metrics', throttle: 100},
    {id: 'route-api-channels', throttle: 500},
    {id: 'route-http-request', throttle: 0} // Main request handler
  ]

  // Register all actions using array support
  const allActions = [...serverActions, ...routeActions]
  const result = cyre.action(allActions)

  if (result.ok) {
    log.success(`✅ Registered ${allActions.length} server actions`)
  } else {
    log.error(`❌ Failed to register actions: ${result.message}`)
  }
}

/**
 * Setup action handlers using pure on() patterns
 */
const setupActionHandlers = () => {
  log.info('🎯 Setting up action handlers...')

  // Server lifecycle handlers
  cyre.on('server-start', async payload => {
    const config = payload || {port: 3001, host: '0.0.0.0'}

    try {
      // Create HTTP server
      serverState.server = createServer((req, res) => {
        // Route all requests through Cyre
        cyre.call('route-http-request', {req, res})
      })

      // Start listening
      await new Promise<void>((resolve, reject) => {
        serverState.server!.listen(config.port, config.host, () => {
          serverState.isRunning = true
          serverState.startTime = Date.now()
          serverState.port = config.port
          serverState.host = config.host
          resolve()
        })
        serverState.server!.on('error', reject)
      })

      log.success(`🌐 Server running on ${config.host}:${config.port}`)

      return {
        ok: true,
        message: `Server started on ${config.host}:${config.port}`,
        config
      }
    } catch (error) {
      log.error(`❌ Server start failed: ${error}`)
      return {
        ok: false,
        message: `Failed to start server: ${error}`
      }
    }
  })

  cyre.on('server-stop', async () => {
    try {
      if (serverState.server) {
        await new Promise<void>((resolve, reject) => {
          serverState.server!.close(error => {
            if (error) reject(error)
            else resolve()
          })
        })
        serverState.server = null
      }

      serverState.isRunning = false
      log.success('✅ Server stopped successfully')

      return {
        ok: true,
        message: 'Server stopped successfully'
      }
    } catch (error) {
      log.error(`❌ Server stop failed: ${error}`)
      return {
        ok: false,
        message: `Failed to stop server: ${error}`
      }
    }
  })

  cyre.on('server-status', () => {
    return {
      ok: true,
      status: {
        isRunning: serverState.isRunning,
        uptime: serverState.isRunning ? Date.now() - serverState.startTime : 0,
        port: serverState.port,
        host: serverState.host,
        health: metricsState.isHealthy(),
        breathing: metricsState.getBreathingStats()
      }
    }
  })

  // Route handlers using existing metrics API
  cyre.on('route-health', () => ({
    status: 'live',
    server: 'cyre-simple-server',
    version: '4.6.0',
    timestamp: Date.now(),
    uptime: serverState.isRunning ? Date.now() - serverState.startTime : 0
  }))

  cyre.on('route-api-health', () => {
    const health = metrics.health()
    const breathing = metricsState.getBreathingStats()

    return {
      ok: true,
      health: {
        overall: health.overall,
        score: health.score,
        issues: health.issues
      },
      breathing: {
        stress: breathing.currentStress,
        isRecuperating: breathing.isRecuperating,
        pattern: breathing.pattern
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      }
    }
  })

  cyre.on('route-api-analyze', payload => {
    const timeWindow = payload?.timeWindow || 300000 // 5 minutes default
    const analysis = metrics.analyze(timeWindow)

    return {
      ok: true,
      analysis,
      timeWindow,
      timestamp: Date.now()
    }
  })

  cyre.on('route-api-performance', () => {
    const performance = metrics.performance()
    const breathing = metricsState.getBreathingStats()

    return {
      ok: true,
      performance,
      stress: {
        current: breathing.currentStress,
        thresholds: breathing.stressThresholds
      },
      timestamp: Date.now()
    }
  })

  cyre.on('route-api-metrics', payload => {
    const timeWindow = payload?.timeWindow || 60000 // 1 minute default
    const analysis = metrics.analyze(timeWindow)
    const breathing = metricsState.getBreathingStats()

    return {
      ok: true,
      metrics: {
        health: analysis.health,
        performance: analysis.performance,
        pipeline: analysis.pipeline
      },
      breathing,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: Date.now()
      }
    }
  })

  cyre.on('route-api-channels', () => {
    // Get all registered channels

    try {
      // Use the original metrics core directly to avoid undefined issues
      const allChannels = metricsCore.getAllChannelMetrics() || []

      // Simple transformation without complex processing
      const channelsData = allChannels.map(channel => {
        // Ensure all required fields exist
        const safeChannel = {
          id: channel.id || 'unknown',
          calls: channel.calls || 0,
          executions: channel.executions || 0,
          errors: channel.errors || 0,
          lastExecution: channel.lastExecution || Date.now(),
          averageLatency: channel.averageLatency || 0,
          successRate: channel.successRate || 1,
          errorRate: channel.errorRate || 0,
          protectionEvents: channel.protectionEvents || {
            throttled: 0,
            debounced: 0,
            blocked: 0,
            skipped: 0
          }
        }

        // Simple status calculation
        let status = 'inactive'
        if (safeChannel.calls > 0) {
          if (
            safeChannel.errorRate > 0.2 ||
            safeChannel.averageLatency > 2000
          ) {
            status = 'critical'
          } else if (
            safeChannel.errorRate > 0.1 ||
            safeChannel.averageLatency > 1000
          ) {
            status = 'warning'
          } else {
            status = 'healthy'
          }
        }

        return {
          id: safeChannel.id,
          metrics: safeChannel,
          status,
          issues: [],
          latencyTrend: 'stable',
          protectionStats: safeChannel.protectionEvents,
          recommendations: []
        }
      })

      return {
        timestamp: Date.now(),
        server: 'cyre-powered-simple-fix',
        metricsSource: 'simple-channel-analysis',
        channels: channelsData,
        summary: {
          total: channelsData.length,
          active: channelsData.filter(c => c.status !== 'inactive').length,
          healthy: channelsData.filter(c => c.status === 'healthy').length,
          warning: channelsData.filter(c => c.status === 'warning').length,
          critical: channelsData.filter(c => c.status === 'critical').length,
          inactive: channelsData.filter(c => c.status === 'inactive').length
        },
        status: 'success'
      }
    } catch (error) {
      console.error('❌ Simple channels handler error:', error)
      return {
        timestamp: Date.now(),
        server: 'cyre-powered-simple-fix',
        error: String(error),
        status: 'error',
        channels: [],
        summary: {
          total: 0,
          active: 0,
          healthy: 0,
          warning: 0,
          critical: 0,
          inactive: 0
        }
      }
    }
  })

  // Main HTTP request router
  cyre.on('route-http-request', async payload => {
    const {req, res} = payload

    try {
      const url = req.url || '/'
      const method = req.method || 'GET'

      // Parse URL
      const parsedUrl = new URL(url, 'http://localhost')
      const pathname = parsedUrl.pathname
      const searchParams = Object.fromEntries(parsedUrl.searchParams.entries())

      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }

      // Handle OPTIONS
      if (method === 'OPTIONS') {
        res.writeHead(200, corsHeaders)
        res.end()
        return {ok: true, handled: true}
      }

      // Route mapping - direct Cyre calls instead of switch-case
      const routeMap: Record<string, string> = {
        '/': 'route-health',
        '/health': 'route-health',
        '/api/health': 'route-api-health',
        '/api/analyze': 'route-api-analyze',
        '/api/performance': 'route-api-performance',
        '/api/metrics': 'route-api-metrics',
        '/api/channels': 'route-api-channels'
      }

      const actionId = routeMap[pathname]

      if (!actionId) {
        // 404 response
        res.writeHead(404, {
          'Content-Type': 'application/json',
          ...corsHeaders
        })
        res.end(
          JSON.stringify({
            error: 'Not found',
            path: pathname,
            availableRoutes: Object.keys(routeMap),
            timestamp: Date.now()
          })
        )
        return {ok: false, error: 'Route not found'}
      }

      // Execute route through Cyre
      const result = await cyre.call(actionId, searchParams)

      // Send response
      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      })
      res.end(JSON.stringify(result.payload || result))

      return {ok: true, route: actionId, handled: true}
    } catch (error) {
      log.error(`❌ HTTP request error: ${error}`)

      // Error response
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      })
      res.end(
        JSON.stringify({
          error: 'Internal server error',
          message: String(error),
          timestamp: Date.now()
        })
      )

      return {ok: false, error: String(error)}
    }
  })

  log.success('✅ Action handlers configured')
}

/**
 * Start the simple Cyre server
 */
export const startSimpleCyreServer = async (
  config = {port: 3001, host: '0.0.0.0'}
) => {
  try {
    log.info('🚀 Starting Simple Cyre Server...')
    log.info('═'.repeat(50))

    // Register actions and handlers
    registerServerActions()
    setupActionHandlers()

    // Start server through Cyre action
    const result = await cyre.call('server-start', config)

    if (result.ok) {
      log.info('🎯 Features: Core Cyre ✓ Metrics API ✓ Live Routes ✓')
      log.info('📊 Endpoints:')
      log.info('   GET  /              - Server status')
      log.info('   GET  /health        - Server status')
      log.info('   GET  /api/health    - Health analysis')
      log.info('   GET  /api/analyze   - System analysis')
      log.info('   GET  /api/performance - Performance metrics')
      log.info('   GET  /api/metrics   - Live metrics')
      log.info('   GET  /api/channels  - Registered channels')
    }

    return result
  } catch (error) {
    log.error(`❌ Failed to start Simple Cyre Server: ${error}`)
    return {
      ok: false,
      message: `Server start failed: ${error}`
    }
  }
}

/**
 * Stop the simple server
 */
export const stopSimpleCyreServer = async () => {
  return await cyre.call('server-stop')
}

/**
 * Get server status
 */
export const getServerStatus = async () => {
  return await cyre.call('server-status')
}

/**
 * Setup graceful shutdown on Ctrl+C
 */
const setupGracefulShutdown = () => {
  const shutdown = async (signal: string) => {
    log.info(`\n⏹️ Received ${signal}, stopping server...`)

    try {
      const result = await stopSimpleCyreServer()
      if (result.ok) {
        log.success('👋 Server stopped gracefully')
        cyre.shutdown()
        process.exit(0)
      } else {
        log.error(`❌ Error stopping server: ${result.message}`)
        process.exit(1)
      }
    } catch (error) {
      log.error(`❌ Shutdown error: ${error}`)
      process.exit(1)
    }
  }

  // Handle various shutdown signals
  process.on('SIGINT', () => shutdown('SIGINT')) // Ctrl+C
  process.on('SIGTERM', () => shutdown('SIGTERM')) // Kill command
  process.on('SIGUSR2', () => shutdown('SIGUSR2')) // Nodemon restart

  // Handle uncaught errors gracefully
  process.on('uncaughtException', error => {
    log.error(`❌ Uncaught exception: ${error}`)
    shutdown('uncaughtException')
  })

  process.on('unhandledRejection', reason => {
    log.error(`❌ Unhandled rejection: ${reason}`)
    shutdown('unhandledRejection')
  })
}

// Auto-start if run directly

const config = {
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0'
}

// Setup graceful shutdown first
setupGracefulShutdown()

startSimpleCyreServer(config)
  .then(result => {
    if (result.ok) {
      log.info('💡 Press Ctrl+C to stop the server')
    } else {
      process.exit(1)
    }
  })
  .catch(error => {
    log.error(`❌ Server startup error: ${error}`)
    process.exit(1)
  })

// Export for programmatic use
export default {
  start: startSimpleCyreServer,
  stop: stopSimpleCyreServer,
  status: getServerStatus
}
