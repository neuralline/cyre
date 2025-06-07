
// src/dev/dashboard-server.ts - UPDATED
// Updated dashboard server to use file-based metrics

import {createServer, IncomingMessage, ServerResponse} from 'http'
import {parse} from 'url'
import {WebSocketServer} from 'ws'
import {readMetricsSnapshot, isCyreRunning} from './metrics-bridge'

/*

      C.Y.R.E - D.A.S.H.B.O.A.R.D - S.E.R.V.E.R - F.I.X.E.D
      
      FIXED: Now uses file-based metrics bridge
      - Reads metrics from file written by Cyre
      - No process coupling
      - Simple and reliable

*/

interface DashboardServerConfig {
  port: number
  host: string
  enableWebSocket: boolean
  updateInterval: number
}

class DashboardServer {
  private config: DashboardServerConfig
  private server?: ReturnType<typeof createServer>
  private wsServer?: WebSocketServer
  private updateTimer?: NodeJS.Timeout
  private isRunning = false
  private clientCount = 0

  constructor(config: Partial<DashboardServerConfig> = {}) {
    this.config = {
      port: config.port || 3001,
      host: config.host || '0.0.0.0',
      enableWebSocket: config.enableWebSocket !== false,
      updateInterval: config.updateInterval || 3000
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📊 Dashboard server already running')
      return
    }

    console.log('🚀 Starting Cyre Dashboard Server...')
    console.log(`📡 Port: ${this.config.port}`)
    console.log(`🌐 Host: ${this.config.host}`)
    console.log(`📊 WebSocket: ${this.config.enableWebSocket ? 'enabled' : 'disabled'}`)

    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.handleRequest.bind(this))

        if (this.config.enableWebSocket) {
          this.setupWebSocket()
        }

        this.server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true
          console.log(`✅ Dashboard server running on http://${this.config.host}:${this.config.port}`)
          console.log(`📊 API endpoints available at http://localhost:${this.config.port}/api/*`)
          
          if (this.config.enableWebSocket) {
            console.log(`📡 WebSocket server running on ws://localhost:${this.config.port}`)
          }

          resolve()
        })

        this.server.on('error', (error) => {
          console.error('❌ Dashboard server error:', error)
          reject(error)
        })

      } catch (error) {
        console.error('❌ Failed to start dashboard server:', error)
        reject(error)
      }
    })
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    console.log('⏹️  Stopping dashboard server...')

    // Clear update timer
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = undefined
    }

    // Close WebSocket server
    if (this.wsServer) {
      console.log(`📡 Closing WebSocket server (${this.clientCount} clients)`)
      
      // Notify clients
      this.wsServer.clients.forEach(client => {
        if (client.readyState === 1) {
          try {
            client.send(JSON.stringify({
              type: 'server_shutdown',
              timestamp: Date.now()
            }))
            client.close(1001, 'Server shutdown')
          } catch (error) {
            // Ignore errors during shutdown
          }
        }
      })

      this.wsServer.close()
      this.wsServer = undefined
    }

    // Close HTTP server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false
          this.clientCount = 0
          console.log('✅ Dashboard server stopped')
          resolve()
        })

        // Force close after timeout
        setTimeout(() => {
          this.isRunning = false
          resolve()
        }, 3000)
      } else {
        resolve()
      }
    })
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/'
    const method = req.method || 'GET'
    const pathname = parse(url).pathname || '/'
    const query = this.parseQuery(url)

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    if (method !== 'GET') {
      this.sendError(res, 'Method not allowed', 405)
      return
    }

    try {
      // Check if Cyre is running
      if (!isCyreRunning()) {
        this.sendError(res, 'Cyre metrics not available - is Cyre running?', 503)
        return
      }

      // Get metrics snapshot
      const snapshot = readMetricsSnapshot()
      if (!snapshot) {
        this.sendError(res, 'Failed to read metrics - try again', 503)
        return
      }

      // Route to appropriate data
      let result: any

      switch (pathname) {
        case '/api/status':
          result = this.getServerStatus(snapshot)
          break
        case '/api/analyze':
          result = snapshot.systemAnalysis
          break
        case '/api/health':
          result = snapshot.health
          break
        case '/api/performance':
          result = snapshot.performance
          break
        case '/api/pipeline':
          result = snapshot.pipeline
          break
        case '/api/system':
          result = snapshot.systemMetrics
          break
        case '/api/channels':
          result = query.channelId 
            ? snapshot.channelMetrics.filter(c => c.id === query.channelId)
            : snapshot.channelMetrics
          break
        case '/api/events':
          result = this.filterEvents(snapshot.events, query)
          break
        default:
          this.sendError(res, `Route not found: ${pathname}`, 404)
          return
      }

      this.sendJson(res, result)

    } catch (error) {
      console.error('📊 Dashboard API error:', error)
      this.sendError(res, 'Internal server error', 500)
    }
  }

  private parseQuery(url: string): Record<string, string> {
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

  private sendJson(res: ServerResponse, data: any): void {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify(data, null, 2))
  }

  private sendError(res: ServerResponse, message: string, status = 500): void {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(status)
    res.end(JSON.stringify({ error: message, timestamp: Date.now() }))
  }

  private setupWebSocket(): void {
    if (!this.server) return

    this.wsServer = new WebSocketServer({ server: this.server })

    this.wsServer.on('connection', (ws) => {
      this.clientCount++
      console.log(`📡 WebSocket client connected (total: ${this.clientCount})`)

      // Send initial data
      this.sendInitialData(ws)

      ws.on('close', () => {
        this.clientCount--
        console.log(`📡 WebSocket client disconnected (total: ${this.clientCount})`)
      })

      ws.on('error', (error) => {
        console.error('📡 WebSocket client error:', error)
      })
    })

    // Start periodic updates
    this.startPeriodicUpdates()
  }

  private sendInitialData(ws: any): void {
    try {
      const snapshot = readMetricsSnapshot()
      if (snapshot) {
        ws.send(JSON.stringify({
          type: 'metrics_update',
          timestamp: Date.now(),
          data: snapshot.systemAnalysis
        }))
      }
    } catch (error) {
      console.error('📊 Failed to send initial data:', error)
    }
  }

  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(() => {
      if (this.wsServer && this.wsServer.clients.size > 0) {
        try {
          const snapshot = readMetricsSnapshot()
          if (snapshot) {
            const message = JSON.stringify({
              type: 'metrics_update',
              timestamp: Date.now(),
              data: snapshot.systemAnalysis
            })

            this.wsServer.clients.forEach(client => {
              if (client.readyState === 1) {
                try {
                  client.send(message)
                } catch (error) {
                  // Ignore send errors
                }
              }
            })
          }
        } catch (error) {
          console.error('📊 Periodic update failed:', error)
        }
      }
    }, this.config.updateInterval)
  }

  private getServerStatus(snapshot: any) {
    return {
      status: 'online',
      timestamp: Date.now(),
      uptime: process.uptime(),
      clients: this.clientCount,
      version: '1.0.0',
      cyreInfo: snapshot.serverInfo
    }
  }

  private filterEvents(events: any[], query: Record<string, string>) {
    let filtered = events

    if (query.actionId) {
      filtered = filtered.filter(e => e.actionId === query.actionId)
    }
    if (query.eventType) {
      filtered = filtered.filter(e => e.eventType === query.eventType)
    }
    if (query.since) {
      const since = parseInt(query.since)
      filtered = filtered.filter(e => e.timestamp >= since)
    }
    if (query.limit) {
      const limit = parseInt(query.limit)
      filtered = filtered.slice(0, limit)
    }

    return filtered
  }

  getStatus() {
    return {
      running: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      webSocketEnabled: this.config.enableWebSocket,
      connectedClients: this.clientCount,
      cyreRunning: isCyreRunning()
    }
  }
}

export { DashboardServer }