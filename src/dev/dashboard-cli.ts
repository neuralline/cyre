// src/dev/dashboard-cli.ts
// CLI tool for dashboard server

import {DashboardServer} from './dashboard-server'

/*

      C.Y.R.E - D.A.S.H.B.O.A.R.D - C.L.I
      
      Command-line interface for dashboard server:
      - Start/stop dashboard independently
      - Configure port and options
      - Monitor connection status

*/

class DashboardCLI {
  private server: DashboardServer

  constructor() {
    this.server = new DashboardServer()
  }

  async start(options: any = {}): Promise<void> {
    try {
      console.log('\n🎛️  Cyre Dashboard Dev Tool')
      console.log('='.repeat(50))

      // Configure server
      const config = {
        port: options.port || 3005,
        host: options.host || '0.0.0.0',
        enableWebSocket: options.websocket !== false
      }

      this.server = new DashboardServer(config)

      // Start server
      await this.server.start()

      console.log('\n📊 Dashboard Server Ready!')
      console.log('─'.repeat(50))
      console.log('🌐 Dashboard URL:  http://localhost:3000/dashboard')
      console.log(`📡 API Endpoint:   http://localhost:${config.port}/api`)
      console.log(
        `🔗 Health Check:   http://localhost:${config.port}/api/status`
      )

      if (config.enableWebSocket) {
        console.log(`📡 WebSocket:      ws://localhost:${config.port}`)
      }

      console.log('─'.repeat(50))
      console.log('\n💡 Make sure your Cyre application is running!')
      console.log('💡 Press Ctrl+C to stop the dashboard server\n')

      // Setup shutdown handling
      this.setupShutdownHandlers()
    } catch (error) {
      console.error('\n❌ Failed to start dashboard server:', error)
      process.exit(1)
    }
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n⏹️  Received ${signal}, stopping dashboard server...`)

      try {
        await this.server.stop()
        console.log('👋 Dashboard server stopped')
        process.exit(0)
      } catch (error) {
        console.error('❌ Error stopping server:', error)
        process.exit(1)
      }
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGUSR2', () => shutdown('SIGUSR2'))
  }

  async status(): Promise<void> {
    const status = this.server.getStatus()
    console.log('📊 Dashboard Server Status:')
    console.log(JSON.stringify(status, null, 2))
  }
}

// CLI execution

const cli = new DashboardCLI()

const args = process.argv.slice(2)
const command = args[0] || 'start'

switch (command) {
  case 'start':
    cli.start({
      port: args.includes('--port')
        ? parseInt(args[args.indexOf('--port') + 1])
        : 3001,
      host: args.includes('--host')
        ? args[args.indexOf('--host') + 1]
        : '0.0.0.0',
      websocket: !args.includes('--no-websocket')
    })
    break
  case 'status':
    cli.status()
    break
  default:
    console.log(
      'Usage: tsx dashboard-cli.ts [start|status] [--port 3001] [--host 0.0.0.0] [--no-websocket]'
    )
}

export {DashboardCLI}
