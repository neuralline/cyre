// src/http/server.ts
// HTTP server for dashboard integration

import {createServer, IncomingMessage, ServerResponse} from 'http'
import {parse} from 'url'
import {WebSocketServer} from 'ws'
import {metrics} from '../metrics/integration'
import {analyzer} from '../metrics/analyzer'
import {metricsCore} from '../metrics/core'
import {sensor} from '../context/metrics-report'
import type {ActionId} from '../types/core'

/*

      C.Y.R.E - H.T.T.P - S.E.R.V.E.R
      
      HTTP API server for dashboard integration:
      - Exposes existing metrics API via HTTP
      - WebSocket support for real-time updates
      - CORS enabled for browser access
      - Functional programming approach
      - Integrates with existing sensor logging

*/

interface ServerConfig {
  port: number
  host: string
  enableWebSocket: boolean
  enableCors: boolean
  updateInterval: number
  maxClients: number
}

const defaultConfig: ServerConfig = {
  port: 3001,
  host: '0.0.0.0',
  enableWebSocket: true,
  enableCors: true,
  updateInterval: 5000,
  maxClients: 10
}

let server: ReturnType<typeof createServer> | null = null
let wsServer: WebSocketServer | null = null
let updateTimer: NodeJS.Timeout | null = null
let clientCount = 0

/**
 * Parse query parameters from URL
 */
const parseQuery = (url: string): Record<string, string> => {
  const parsed = parse(url, true)
  const query: Record<string, string> = {}

  Object.entries(parsed.query).forEach(([key, value]) => {
    if (typeof value === 'string') {
      query[key] = value
    } else if (Array.isArray(value)) {
      query[key] = value[0] || ''
    }
  })

  return query
}

/**
 * Send JSON response with CORS headers
 */
const sendJsonResponse = (
  res: ServerResponse,
  data: any,
  statusCode = 200,
  enableCors = true
): void => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (enableCors) {
    headers['Access-Control-Allow-Origin'] = '*'
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  }

  res.writeHead(statusCode, headers)
  res.end(JSON.stringify(data, null, 2))
}

/**
 * Send error response
 */
const sendErrorResponse = (
  res: ServerResponse,
  message: string,
  statusCode = 500,
  enableCors = true
): void => {
  sensor.error(`HTTP Server Error: ${message}`)
  sendJsonResponse(
    res,
    {error: message, timestamp: Date.now()},
    statusCode,
    enableCors
  )
}

/**
 * Handle CORS preflight requests
 */
const handleCorsOptions = (res: ServerResponse): void => {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  })
  res.end()
}

/**
 * Route handlers for metrics API
 */
const routes = {
  '/api/analyze': async (query: Record<string, string>) => {
    const timeWindow = query.timeWindow ? parseInt(query.timeWindow) : undefined
    sensor.info(
      `Metrics API: System analysis requested (timeWindow: ${timeWindow})`
    )
    return analyzer.analyzeSystem(timeWindow)
  },

  '/api/health': async () => {
    sensor.info('Metrics API: Health status requested')
    return metrics.health()
  },

  '/api/performance': async () => {
    sensor.info('Metrics API: Performance metrics requested')
    return metrics.performance()
  },

  '/api/pipeline': async () => {
    sensor.info('Metrics API: Pipeline status requested')
    return metrics.pipeline()
  },

  '/api/system': async () => {
    sensor.info('Metrics API: System metrics requested')
    return metricsCore.getSystemMetrics()
  },

  '/api/channels': async (query: Record<string, string>) => {
    const channelId = query.channelId as ActionId
    sensor.info(
      `Metrics API: Channel metrics requested (channelId: ${
        channelId || 'all'
      })`
    )

    if (channelId) {
      const channelMetrics = metricsCore.getChannelMetrics(channelId)
      return channelMetrics ? [channelMetrics] : []
    } else {
      return metricsCore.getAllChannelMetrics()
    }
  },

  '/api/events': async (query: Record<string, string>) => {
    const filter: Parameters<typeof metricsCore.getEvents>[0] = {}

    if (query.actionId) filter.actionId = query.actionId as ActionId
    if (query.eventType) filter.eventType = query.eventType as any
    if (query.since) filter.since = parseInt(query.since)
    if (query.limit) filter.limit = parseInt(query.limit)

    sensor.info('Metrics API: Events requested', 'HTTP Server', filter)
    return metricsCore.getEvents(filter)
  },

  '/api/snapshot': async () => {
    sensor.info('Metrics API: System snapshot requested')
    return metrics.snapshot()
  },

  '/api/status': async () => {
    return {
      status: 'online',
      timestamp: Date.now(),
      uptime: process.uptime(),
      clients: clientCount,
      version: '1.0.0'
    }
  }
}

/**
 * Request handler
 */
const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  const url = req.url || '/'
  const method = req.method || 'GET'
  const pathname = parse(url).pathname || '/'
  const query = parseQuery(url)

  sensor.info(`HTTP Request: ${method} ${pathname}`, 'HTTP Server')

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    handleCorsOptions(res)
    return
  }

  // Only allow GET requests for metrics API
  if (method !== 'GET') {
    sendErrorResponse(res, 'Method not allowed', 405)
    return
  }

  // Route to appropriate handler
  const handler = routes[pathname as keyof typeof routes]

  if (!handler) {
    sendErrorResponse(res, `Route not found: ${pathname}`, 404)
    return
  }

  try {
    const result = await handler(query)
    sendJsonResponse(res, result)
    sensor.info(`HTTP Response: ${pathname} completed successfully`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(`HTTP Handler Error: ${pathname} - ${errorMessage}`)
    sendErrorResponse(res, `Internal server error: ${errorMessage}`)
  }
}

/**
 * WebSocket message broadcasting
 */
const broadcastToClients = (data: any): void => {
  if (!wsServer) return

  const message = JSON.stringify({
    type: 'metrics_update',
    timestamp: Date.now(),
    data
  })

  wsServer.clients.forEach(client => {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      try {
        client.send(message)
      } catch (error) {
        sensor.warn('WebSocket send failed', 'WebSocket Server', error)
      }
    }
  })
}

/**
 * Setup WebSocket server
 */
const setupWebSocket = (
  httpServer: ReturnType<typeof createServer>,
  config: ServerConfig
): void => {
  wsServer = new WebSocketServer({server: httpServer})

  wsServer.on('connection', (ws, req) => {
    clientCount++
    const clientIp = req.socket.remoteAddress
    sensor.info(
      `WebSocket client connected from ${clientIp} (total: ${clientCount})`
    )

    // Send initial data
    try {
      const initialData = analyzer.analyzeSystem()
      ws.send(
        JSON.stringify({
          type: 'metrics_update',
          timestamp: Date.now(),
          data: initialData
        })
      )
    } catch (error) {
      sensor.warn(
        'Failed to send initial WebSocket data',
        'WebSocket Server',
        error
      )
    }

    ws.on('close', () => {
      clientCount--
      sensor.info(`WebSocket client disconnected (total: ${clientCount})`)
    })

    ws.on('error', error => {
      sensor.error('WebSocket client error', error, 'WebSocket Server')
    })

    // Check client limit
    if (clientCount > config.maxClients) {
      sensor.warn(
        `Maximum WebSocket clients exceeded (${clientCount}/${config.maxClients})`
      )
      ws.close(1008, 'Too many clients')
    }
  })

  wsServer.on('error', error => {
    sensor.error('WebSocket server error', error, 'WebSocket Server')
  })

  // Start periodic updates
  updateTimer = setInterval(() => {
    try {
      if (wsServer && wsServer.clients.size > 0) {
        const analysis = analyzer.analyzeSystem()
        broadcastToClients(analysis)
        sensor.debug(
          `WebSocket broadcast sent to ${wsServer.clients.size} clients`
        )
      }
    } catch (error) {
      sensor.error(
        'Failed to broadcast WebSocket update',
        error,
        'WebSocket Server'
      )
    }
  }, config.updateInterval)

  sensor.info(
    `WebSocket server enabled (update interval: ${config.updateInterval}ms)`
  )
}

/**
 * Start HTTP server
 */
const startServer = (config: Partial<ServerConfig> = {}): Promise<void> => {
  const finalConfig = {...defaultConfig, ...config}

  return new Promise((resolve, reject) => {
    try {
      if (server) {
        sensor.warn('HTTP server already running')
        resolve()
        return
      }

      server = createServer(handleRequest)

      // Setup WebSocket if enabled
      if (finalConfig.enableWebSocket) {
        setupWebSocket(server, finalConfig)
      }

      server.listen(finalConfig.port, finalConfig.host, () => {
        sensor.info(
          `Cyre HTTP server started on ${finalConfig.host}:${finalConfig.port}`,
          'HTTP Server',
          finalConfig
        )
        resolve()
      })

      server.on('error', error => {
        sensor.error('HTTP server error', error, 'HTTP Server')
        reject(error)
      })

      server.on('close', () => {
        sensor.info('HTTP server closed')
      })
    } catch (error) {
      sensor.error('Failed to start HTTP server', error, 'HTTP Server')
      reject(error)
    }
  })
}

/**
 * Stop HTTP server
 */
const stopServer = (): Promise<void> => {
  return new Promise(resolve => {
    sensor.info('HTTP server shutdown initiated')

    // Clear update timer first
    if (updateTimer) {
      clearInterval(updateTimer)
      updateTimer = null
      sensor.debug('Update timer cleared')
    }

    // Close WebSocket server and disconnect all clients
    if (wsServer) {
      sensor.info(
        `Closing WebSocket server with ${wsServer.clients.size} connected clients`
      )

      // Notify clients of shutdown
      wsServer.clients.forEach(client => {
        if (client.readyState === 1) {
          // WebSocket.OPEN
          try {
            client.send(
              JSON.stringify({
                type: 'server_shutdown',
                timestamp: Date.now(),
                message: 'Server is shutting down'
              })
            )
            client.close(1001, 'Server shutdown')
          } catch (error) {
            sensor.warn('Failed to notify WebSocket client of shutdown')
          }
        }
      })

      wsServer.close(() => {
        sensor.info('WebSocket server closed')
        wsServer = null
        clientCount = 0
      })
    }

    // Close HTTP server
    if (server) {
      sensor.info('Closing HTTP server')

      server.close(() => {
        sensor.info('HTTP server closed successfully')
        server = null
        resolve()
      })

      // Force close after 5 seconds if graceful close fails
      setTimeout(() => {
        if (server) {
          sensor.warn('Force closing HTTP server after timeout')
          server = null
          resolve()
        }
      }, 5000)
    } else {
      resolve()
    }
  })
}

/**
 * Get server status
 */
const getServerStatus = () => {
  return {
    running: server !== null,
    port: defaultConfig.port,
    host: defaultConfig.host,
    webSocketEnabled: wsServer !== null,
    connectedClients: clientCount,
    uptime: process.uptime()
  }
}

// Public API
export const httpServer = {
  start: startServer,
  stop: stopServer,
  status: getServerStatus,
  broadcast: broadcastToClients
}
