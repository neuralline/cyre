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

      FIXED (from the first draft):
      - `route.path` didn't exist on the route objects (only `id` does) -
        the startup log was printing "undefined" for every route URL.
      - `cyre.init()` wasn't awaited. It happens to run fully synchronously
        today (app.ts's init() has no internal `await`), so this wasn't a
        live bug, but it's fragile against that changing later - awaited
        now for real.
      - Routing no longer goes through a second CYRE channel
        ('http-router'). Every request was paying for TWO cyre.call()
        dispatches - one to look up the route, one to run it - for a
        lookup that's just an array .find(), not anything reactive. That
        matters here specifically because this file's whole purpose is
        benchmarking raw per-channel overhead (see index.ts's own stated
        target: "the least call-to-execution overhead per channel") - the
        extra hop was inflating exactly the number this file exists to
        measure. The route lookup is now a plain function; each matched
        route still gets exactly one cyre.call().

      PER-ROUTE PROTECTIONS (the actual point):
      Removing the 'http-router' middleman does NOT remove the ability to
      throttle/debounce/buffer/delay an individual URL - that capability
      was never coming from 'http-router' in the first place. It comes
      from each route being registered as its OWN channel
      (cyre.action({id: route.id, ...})), independent of whatever calls
      cyre.call(route.id).
        - GET /api/users   -> throttle: 200   (max 5 req/sec on this route)
        - GET /health, /benchmark, /, /api/posts stay fast-path/unprotected
          on purpose - a health check or the raw benchmark endpoint should
          never be the thing getting throttled.

      WHY /api/posts is NOT debounced (tested via server/cyre-client.ts):
      A first draft put `debounce: 150` on /api/posts to show the same
      per-route-protection point a second way. Running the actual client
      against it confirmed this was wrong: EVERY request to a debounced
      route returns immediately with {ok: true, payload: req} - `req` is
      whatever payload the call carried, undefined for a bare GET - before
      the real handler ever runs (that only happens later, inside
      TimeKeeper's deferred callback, whose result nothing here awaits).
      Concretely: JSON.stringify(undefined) is the JS value `undefined`,
      and res.end(undefined) sends an EMPTY body - so every debounced
      request came back 200 with nothing in it, not even debounce's own
      "scheduled" acknowledgment message (this server only ever forwards
      result.payload to the client, never result.message). throttle does
      not have this problem: an ALLOWED call falls through to the real
      processCall() in the same request, so successful responses still
      carry genuine handler output - confirmed by the client's 10-request
      burst against /api/users (1 real 200, 9 clean rejections). debounce/
      buffer are fire-and-forget primitives, the right tool for "ack now,
      settle later, caller doesn't need this call's own return value" -
      not for a route whose contract is "hand back this request's data".

*/

const PORT = 3000

// Initialize CYRE
console.log('🚀 Initializing CYRE...')
await cyre.init()

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
    // Throttled: this route hits a (simulated) backing store, so it's
    // capped at 5 req/sec per-channel rather than left wide open.
    throttle: 200,
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
    // Re-enabled after the real fix (src/context/pending-state.ts +
    // app.ts's call()): debounce was tried here first and confirmed (via
    // server/cyre-client.ts) to return an empty 200 on every request
    // instead of real post data, because it acked immediately and ran
    // the real handler later with nothing waiting on the result. Now
    // that cyre.call() on a debounced channel returns a promise that
    // resolves with the REAL processCall() result, this route can safely
    // carry the protection again - awaiting cyre.call() below now
    // genuinely waits out the debounce window instead of racing past it.
    debounce: 150,
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

// Register all routes as CYRE actions - each one its own channel, each one
// free to carry its own protections (throttle/debounce/buffer/delay) with
// zero interaction with any other route's channel or with the HTTP layer
// that eventually calls it.
console.log('📡 Registering CYRE channels...')
routes.forEach(route => {
  const {id, channel, handler, ...protections} = route
  cyre.action({id, ...protections})
  cyre.on(id, handler)
  const protectionNote = Object.keys(protections).length
    ? ` (${Object.entries(protections)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')})`
    : ''
  console.log(`   ✅ ${channel} -> ${id}${protectionNote}`)
})

cyre.lock()

// Plain route lookup - NOT a CYRE channel. There's nothing reactive about
// "find the route object matching this URL"; making it one just added a
// second dispatch per request for no benefit (see the note up top).
const findRoute = (url: string) => routes.find(r => r.id === url)

// Create raw HTTP server
const server = createServer(async (req, res) => {
  const startTime = process.hrtime.bigint()

  try {
    const route = req.method === 'GET' ? findRoute(req.url || '/') : undefined

    if (!route) {
      res.writeHead(404, {'Content-Type': 'application/json'})
      res.end(
        JSON.stringify({
          error: 'Not Found',
          method: req.method,
          url: req.url,
          availableRoutes: routes.map(r => `GET ${r.id}`)
        })
      )
      return
    }

    // ONE cyre.call() per request - the route IS the channel, no
    // intermediary dispatch in between.
    const result = await cyre.call(route.id)

    if (!result.ok) {
      throw new Error(`CYRE call failed: ${result.message}`)
    }

    const endTime = process.hrtime.bigint()
    const responseTimeMs = Number(endTime - startTime) / 1000000

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Powered-By', 'CYRE')
    res.setHeader('X-Server', 'pure-cyre')
    res.setHeader('X-Response-Time', `${responseTimeMs.toFixed(3)}ms`)
    res.writeHead(200)
    res.end(JSON.stringify(result.payload))
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
    console.log(`   • GET http://localhost:${PORT}${route.id}`)
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
