// scripts/dev-metrics.ts
// Start development metrics server on port 3001

import {startMetricsServer, stopMetricsServer} from '../src/dev/metrics-server'

/*

      C.Y.R.E - D.E.V - M.E.T.R.I.C.S - S.T.A.R.T.E.R
      
      Simple script to start metrics server:
      - Port 3001 by default
      - HTTP and WebSocket enabled
      - Graceful shutdown handling

*/

const startDevMetrics = async () => {
  try {
    console.log('\n🎛️ Cyre Development Metrics Server')
    console.log('='.repeat(50))

    // Parse command line arguments
    const args = process.argv.slice(2)
    const port = args.includes('--port')
      ? parseInt(args[args.indexOf('--port') + 1])
      : 3001

    const config = {
      port,
      host: args.includes('--host')
        ? args[args.indexOf('--host') + 1]
        : '0.0.0.0',
      enableWebSocket: !args.includes('--no-ws'),
      enableHTTP: !args.includes('--no-http'),
      updateInterval: args.includes('--interval')
        ? parseInt(args[args.indexOf('--interval') + 1])
        : 1000
    }

    await startMetricsServer(config)

    console.log('\n📊 Safe Enhanced Metrics Server Ready!')
    console.log('─'.repeat(50))
    console.log(`📊 API Base URL:   http://localhost:${port}/api/`)
    console.log(`📈 System Analysis: http://localhost:${port}/api/analyze`)
    console.log(`🏥 Health Check:   http://localhost:${port}/api/health`)
    console.log(`📈 Performance:    http://localhost:${port}/api/performance`)
    console.log(`🔄 Pipeline:       http://localhost:${port}/api/pipeline`)
    console.log(`📡 Channels:       http://localhost:${port}/api/channels`)
    console.log(`📝 Events:         http://localhost:${port}/api/events`)
    console.log(`🧠 Enhanced Intel: http://localhost:${port}/api/intelligence`)
    console.log(`📤 Streamable:     http://localhost:${port}/api/streamable`)

    if (config.enableWebSocket) {
      console.log(`📡 WebSocket:      ws://localhost:${port}/metrics`)
    }

    console.log('─'.repeat(50))
    console.log('\n💡 Make sure your Cyre application is running!')
    console.log('💡 Press Ctrl+C to stop the metrics server\n')

    // Setup shutdown handlers
    const shutdown = async (signal: string) => {
      console.log(`\n⏹️ Received ${signal}, stopping metrics server...`)
      try {
        await stopMetricsServer()
        console.log('👋 Metrics server stopped')
        process.exit(0)
      } catch (error) {
        console.error('❌ Error stopping server:', error)
        process.exit(1)
      }
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGUSR2', () => shutdown('SIGUSR2'))
  } catch (error) {
    console.error('\n❌ Failed to start metrics server:', error)
    process.exit(1)
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: bun run scripts/dev-metrics.ts [options]

Options:
  --port <number>     Server port (default: 3001)
  --host <string>     Server host (default: 0.0.0.0)
  --interval <ms>     WebSocket update interval (default: 1000)
  --no-ws            Disable WebSocket
  --no-http          Disable HTTP endpoints
  --help, -h         Show this help

Examples:
  bun run scripts/dev-metrics.ts
  bun run scripts/dev-metrics.ts --port 3002
  bun run scripts/dev-metrics.ts --no-ws --interval 2000

Endpoints:
  HTTP API:        http://localhost:3001/api/analyze
  Enhanced Intel:  http://localhost:3001/api/intelligence  
  Streamable:      http://localhost:3001/api/streamable
  WebSocket:       ws://localhost:3001/metrics
  Health:          http://localhost:3001/api/health
`)
  process.exit(0)
}

startDevMetrics().catch(console.error)

// Export for programmatic use
export {startDevMetrics}
