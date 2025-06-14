// server/cyre-server.ts
// Real CYRE HTTP Server using actual CYRE library

import {createServer} from 'http'
import {cyre} from '../src' // Your real CYRE import

/*

      P.U.R.E - C.Y.R.E - H.T.T.P - S.E.R.V.E.R
      
      Zero-overhead HTTP server powered by real CYRE:
      - Direct channel-based routing
      - No middleware chains
      - Raw CYRE performance
      - Ready for benchmarking

*/

const PORT = 3000

// Initialize CYRE
console.log('🚀 Initializing CYRE...')
cyre.initialize()

// Register HTTP routes as CYRE channels
const routes = [
  {
    id: '/',
    channel: 'GET-root',
    handler: () => ({
      message: 'CYRE HTTP Server',
      timestamp: Date.now(),
      server: 'pure-cyre'
    })
  },
  {
    id: '/benchmark',
    channel: 'GET-benchmark',
    handler: () => ({
      hello: 'world',
      timestamp: Date.now(),
      pid: process.pid
    })
  },
  {
    id: '/api/users',
    channel: 'GET-users',
    handler: () => ({
      users: [
        {id: 1, name: 'John', email: 'john@example.com'},
        {id: 2, name: 'Jane', email: 'jane@example.com'},
        {id: 3, name: 'Bob', email: 'bob@example.com'}
      ],
      count: 3,
      timestamp: Date.now()
    })
  },
  {
    id: '/api/posts',
    channel: 'GET-posts',
    handler: () => ({
      posts: [
        {id: 1, title: 'Hello CYRE', content: 'CYRE is fast!'},
        {id: 2, title: 'Benchmarking', content: 'Testing performance'}
      ],
      count: 2,
      timestamp: Date.now()
    })
  },
  {
    id: '/health',
    channel: 'GET-health',
    handler: () => ({
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
      timestamp: Date.now()
    })
  }
]

// Register all routes as CYRE actions
console.log('📡 Registering CYRE channels...')
routes.forEach(route => {
  cyre.action({id: route.id})
  cyre.on(route.id, route.handler)
  console.log(`   ✅ ${route.channel} -> ${route.id}`)
})

// Main HTTP router channel
cyre.action({id: 'http-router'})
cyre.on('http-router', async ({method, url}) => {
  // Find matching route
  const route = routes.find(r => r.id === url)

  if (route && method === 'GET') {
    // Call the specific CYRE channel

    const result = await cyre.call(route.id)
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Powered-By': 'CYRE',
        'X-Server': 'pure-cyre'
      },
      body: result.payload
    }
  }

  // 404 fallback
  return {
    status: 404,
    headers: {'Content-Type': 'application/json'},
    body: {
      error: 'Not Found',
      method,
      url,
      availableRoutes: routes.map(r => `GET ${r.id}`)
    }
  }
})

// Create raw HTTP server
const server = createServer(async (req, res) => {
  const startTime = process.hrtime.bigint()

  try {
    // Route through CYRE
    const result = await cyre.call('http-router', {
      method: req.method,
      url: req.url
    })

    if (!result.ok) {
      throw new Error(`CYRE routing failed: ${result.message}`)
    }

    const response = result.payload

    // Calculate response time
    const endTime = process.hrtime.bigint()
    const responseTimeMs = Number(endTime - startTime) / 1000000

    // Set headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value as string)
    })
    res.setHeader('X-Response-Time', `${responseTimeMs.toFixed(3)}ms`)

    // Send response
    res.writeHead(response.status)
    res.end(JSON.stringify(response.body))
  } catch (error) {
    console.error('❌ Request error:', error)
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'X-Powered-By': 'CYRE'
    })
    res.end(
      JSON.stringify({
        error: 'Internal server error',
        message: String(error),
        timestamp: Date.now()
      })
    )
  }
})

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🔥 PURE CYRE HTTP SERVER RUNNING!')
  console.log('='.repeat(40))
  console.log(`🌐 Server: http://localhost:${PORT}`)
  console.log(`📊 Routes:`)
  routes.forEach(route => {
    console.log(`   • GET http://localhost:${PORT}${route.path}`)
  })
  console.log('\n⚡ Ready for benchmarking!')
  console.log(`🎯 Main benchmark endpoint: http://localhost:${PORT}/benchmark`)
  console.log('='.repeat(40))
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down CYRE server...')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

// Export for testing
export {server, routes}
