// server/cyre-client.ts
// Client for server/cyre-server.ts - zero-dependency, uses Node's built-in
// fetch (Node >=20, matching this project's own baseline), no axios/etc.

/*

      P.U.R.E - C.Y.R.E - H.T.T.P - C.L.I.E.N.T

      Exercises every route on server/cyre-server.ts and, for the two
      protected routes, fires rapid back-to-back requests to show what
      throttle and debounce actually do to the HTTP response - not just
      what the docs/comments say they do.

      Run the server first: `node server/cyre-server.js` (or via tsx/ts-node)
      Then: `node server/cyre-client.js`

*/

const BASE_URL = 'http://localhost:3000'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const get = async (path: string) => {
  const start = performance.now()
  const res = await fetch(`${BASE_URL}${path}`)
  const elapsed = performance.now() - start
  const body = await res.json().catch(() => undefined)
  return {status: res.status, elapsedMs: elapsed, body}
}

// =============================================================================
// 1) BASIC ROUTES  →  one request each, just confirming the server responds
//    with real handler output on unprotected routes.
// =============================================================================
console.log('=== 1) basic routes ===')

for (const path of ['/', '/benchmark', '/health']) {
  const {status, body} = await get(path)
  console.log(`  GET ${path} -> ${status} ${JSON.stringify(body)}`)
}

// =============================================================================
// 2) THROTTLED ROUTE (/api/users, throttle: 200)  →  fire 10 requests with
//    no delay between them. Expect the first to succeed and land real data;
//    anything inside the same 200ms window should come back rejected.
// =============================================================================
console.log('\n=== 2) throttled route: 10 rapid requests to /api/users ===')

const throttleResults = []
for (let i = 0; i < 10; i++) {
  throttleResults.push(await get('/api/users'))
}

throttleResults.forEach((r, i) => {
  console.log(
    `  request ${i + 1}: ${r.status} - ${JSON.stringify(r.body).slice(0, 90)}`
  )
})

const throttleSuccesses = throttleResults.filter(r => r.status === 200).length
const throttleRejections = throttleResults.filter(r => r.status !== 200).length

console.log(
  throttleSuccesses >= 1 && throttleRejections >= 1
    ? `✅ throttle behaved as a real request-level guard: ${throttleSuccesses} succeeded with real ` +
        `data, ${throttleRejections} were rejected mid-window. Note the rejections come back as a ` +
        'generic 500 ("Internal server error") rather than a proper 429 Too Many Requests - the ' +
        "server's current error handling treats every !result.ok the same way, throttle included. " +
        'Worth a dedicated status-code mapping if this server is going further than a demo.'
    : `ℹ️  ${throttleSuccesses} succeeded, ${throttleRejections} rejected - if every request succeeded, ` +
        'these 10 requests likely completed slower than 200ms apart (network/event-loop jitter) and ' +
        'never actually collided with the throttle window; rerun with a tighter loop if so.'
)

// =============================================================================
// 3a) DEBOUNCE, SEQUENTIAL  →  fire 5 requests one at a time, each awaited
//    before the next starts. Since cyre.call() on a debounced channel now
//    genuinely blocks for the window (the fix), sequential awaits can no
//    longer land inside the SAME window - each one opens and settles its
//    own solo window. This only proves the single-caller case works
//    (real data, no more empty responses) - it does NOT exercise sharing.
// =============================================================================
console.log(
  '\n=== 3a) debounce, sequential: 5 requests, each awaited before the next ==='
)

const sequentialBurst = []
for (let i = 0; i < 5; i++) {
  sequentialBurst.push(await get('/api/posts'))
}
sequentialBurst.forEach((r, i) => {
  console.log(
    `  request ${i + 1}: ${r.status} (${r.elapsedMs.toFixed(1)}ms) - ${JSON.stringify(r.body)}`
  )
})

const gotRealPostData = (r: {body: any}) => Array.isArray(r.body?.posts)
const allSequentialReal = sequentialBurst.every(gotRealPostData)

console.log(
  allSequentialReal
    ? '✅ every sequential call got real post data back (the core bug - empty/ack-only responses - is fixed)'
    : '❌ at least one sequential call still came back without real post data - the fix did not fully land'
)

// =============================================================================
// 3b) DEBOUNCE, CONCURRENT  →  fire 5 requests with NO await between them
//    (Promise.all), so they genuinely land in the SAME debounce window on
//    the server. This is the real test of promise-sharing: all 5 should
//    resolve at roughly the same time, with the SAME timestamp in the
//    body - proof one real execution served all 5 callers, rather than
//    the handler running 5 separate times.
// =============================================================================
console.log(
  '\n=== 3b) debounce, concurrent: 5 requests fired together (Promise.all) ==='
)

const concurrentBurst = await Promise.all(
  Array.from({length: 5}, () => get('/api/posts'))
)
concurrentBurst.forEach((r, i) => {
  console.log(
    `  request ${i + 1}: ${r.status} (${r.elapsedMs.toFixed(1)}ms) - ${JSON.stringify(r.body)}`
  )
})

await wait(400) // well past the 150ms debounce window, so this is a fresh window
const settledCall = await get('/api/posts')
console.log(
  `  post-window request: ${settledCall.status} - ${JSON.stringify(settledCall.body)}`
)

const allConcurrentReal = concurrentBurst.every(gotRealPostData)
const timestamps = concurrentBurst
  .map(r => r.body?.timestamp)
  .filter((t): t is number => typeof t === 'number')
const distinctTimestamps = new Set(timestamps)

if (
  allConcurrentReal &&
  timestamps.length === 5 &&
  distinctTimestamps.size === 1
) {
  console.log(
    '✅ all 5 concurrent requests share ONE real execution: identical `timestamp` across every ' +
      'response, confirming the shared pending-promise (context/pending-state.ts) resolved every ' +
      'caller in the window with the same result rather than the handler running once per request.'
  )
} else if (allConcurrentReal && distinctTimestamps.size > 1) {
  console.log(
    `ℹ️  all 5 got real data, but with ${distinctTimestamps.size} distinct timestamp(s) instead of 1 - ` +
      'these requests may not have actually landed concurrently (check for client-side/network delay ' +
      "between the 5 fetch() calls firing), or promise-sharing isn't working as designed - worth a look " +
      "at whether pendingState.get()/create() in app.ts's debounce branch is being reached correctly."
  )
} else {
  console.log(
    '❌ at least one concurrent request did not get real post data back - the fix is incomplete.'
  )
}

console.log('\n=== done ===')
