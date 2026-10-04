// demo/path-system-demo.ts
// The hierarchical PATH SYSTEM - a section none of the other demos actually
// exercise. branches-demo.ts uses `path` internally (every useBranch channel
// gets one), but it only ever looks channels up by their exact global id -
// it never touches the pattern-matching/bulk-operation layer built on top of
// that: pathEngine (src/schema/path-engine.ts) and pathPlugin
// (src/schema/path-plugin.ts, not part of the public index.ts export list,
// same as schema - reached here by importing it directly).
//
// pathPlugin promises: find() / tree() / stats() for discovery, on() for
// wildcard subscription, call() for a single exact-path call, and
// bulkCall() for pattern-matched fan-out with real safety rails (a channel
// cap, a "large operation" confirmation gate, a force override, dry-run).
//
// Every check below self-reports what actually happened against whatever
// build you run it on - read the ✅/❌/ℹ️ lines to get the real answer.
import {cyre, log} from '../src'
import {pathPlugin} from '../src/schema/path-plugin'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) REGISTER A HIERARCHY OF FLAT CHANNELS  →  plain cyre.action({id, path}),
//    deliberately NOT useBranch, so this is testing the path SYSTEM itself
//    rather than the (separately verified) branch mechanism built on top of
//    a different lookup (stores.io.getAll().filter(c => c.path === path)).
// =============================================================================
console.log('\n=== 1) registering a building/floor-N/sensor hierarchy ===')

const CHANNELS = [
  {id: 'sensor-f1-temp', path: 'building/floor-1/temperature'},
  {id: 'sensor-f1-humid', path: 'building/floor-1/humidity'},
  {id: 'sensor-f2-temp', path: 'building/floor-2/temperature'},
  {id: 'sensor-f2-humid', path: 'building/floor-2/humidity'}
]

const readings: Record<string, number> = {}
for (const {id, path} of CHANNELS) {
  const result = cyre.action({id, path})
  cyre.on(id, (value: number) => {
    readings[id] = value
    log.debug(`  📟 ${id} (${path}) -> ${value}`)
    return value
  })
  console.log(`  registered ${id} at "${path}" -> ok:${result.ok}`)
}

// Section 4 below registers 6 more channels (bulk-target-N) as part of its
// safety-gate check - those are registered up front too, so every
// registration in this file happens before lock() engages at the end of
// section 5.
for (let i = 0; i < 6; i++) {
  cyre.action({id: `bulk-target-${i}`, path: `bulk-test/${i}/leaf`})
  cyre.on(`bulk-target-${i}`, () => undefined)
}

// =============================================================================
// 2) DISCOVERY  →  pathPlugin.find / .stats / .tree
//
// Every one of the 4 channels above has a valid `path`. If the index is
// actually populated, a wildcard find for "building/*/temperature" should
// return exactly the 2 temperature sensors (not humidity, not depth-1).
// =============================================================================
console.log('\n=== 2) discovery: pathPlugin.find / stats / tree ===')

const stats = pathPlugin.stats()
console.log(`  pathPlugin.stats(): ${JSON.stringify(stats)}`)

const tempMatches = pathPlugin.find('building/*/temperature')
console.log(
  `  find("building/*/temperature") -> ${tempMatches.length} match(es): ${JSON.stringify(tempMatches.map(m => m.id))}`
)

const allMatches = pathPlugin.find('**')
console.log(`  find("**") -> ${allMatches.length} match(es) total`)

if (tempMatches.length === 2 && tempMatches.every(m => m.id.includes('temp'))) {
  console.log(
    '✅ wildcard discovery found exactly the 2 temperature channels - the path index is live'
  )
} else if (
  stats.channelsWithPaths === CHANNELS.length &&
  allMatches.length === 0
) {
  console.log(
    `ℹ️  ${stats.channelsWithPaths} channels report a path (via cyre.getMetrics-style stats), ` +
      'but pathPlugin.find() returns 0 matches for everything. That would mean the index ' +
      'find()/on()/bulkCall() search against never got populated during registration. ' +
      'Exact-id calls (cyre.call(id, ...)) still work fine either way - only PATTERN discovery is affected.'
  )
} else {
  console.log(
    `❌ unexpected result shape - matches: ${JSON.stringify(allMatches)}`
  )
}

// =============================================================================
// 3) EXACT-PATH CALL  →  pathPlugin.call() - no wildcards allowed here by
//    design (it explicitly rejects patterns), so this exercises a DIFFERENT
//    code path than find()/bulkCall() and may behave differently.
// =============================================================================
console.log('\n=== 3) pathPlugin.call: exact path, no wildcards ===')

const exactCallResults = await pathPlugin.call(
  'building/floor-1/temperature',
  21.5
)
console.log(
  `  call("building/floor-1/temperature", 21.5) -> ${JSON.stringify(exactCallResults.map(r => ({ok: r.ok, message: r.message})))}`
)

const wildcardRejected = await pathPlugin.call('building/*/temperature', 99)
console.log(
  `  call() WITH a wildcard -> ${JSON.stringify(wildcardRejected.map(r => r.message))}`
)
console.log(
  wildcardRejected.every(r => !r.ok) &&
    wildcardRejected[0]?.message.includes('Wildcards not allowed')
    ? '✅ pathPlugin.call() correctly refuses wildcards, as documented'
    : 'ℹ️  pathPlugin.call() did not refuse the wildcard the way its own comment says it should'
)

// =============================================================================
// 4) BULK CALL  →  pathPlugin.bulkCall() - pattern-matched fan-out with
//    dryRun, a maxChannels safety cap, and a "large operation" confirmation
//    gate that (per the source) requires BOTH force:true AND
//    confirmLargeOperation:false once more than 5 channels match.
// =============================================================================
console.log('\n=== 4) bulkCall: dry run, then a real fan-out ===')

const dryRun = await pathPlugin.bulkCall('building/*/temperature', 20, {
  dryRun: true
})
console.log(
  `  dry run -> matched:${dryRun.matchedChannels}, message: ${dryRun.message}`
)

const realBulk = await pathPlugin.bulkCall('building/*/temperature', 20)
console.log(
  `  real bulk call -> ok:${realBulk.ok}, ${realBulk.successfulCalls}/${realBulk.matchedChannels} succeeded`
)
console.log(
  `  readings captured by handlers so far: ${JSON.stringify(readings)}`
)

console.log(
  realBulk.matchedChannels === 2
    ? '✅ bulkCall matched and fanned out to both temperature sensors'
    : `ℹ️  bulkCall matched ${realBulk.matchedChannels} channel(s) - consistent with section 2's finding`
)

// Safety rail: force an operation past the >5-channel confirmation gate
// without force:true, and confirm it's actually blocked rather than merely
// documented as blocked. (bulk-target-0..5 were registered up in section 1.)
const blockedBulk = await pathPlugin.bulkCall('bulk-test/*/leaf', null)
console.log(
  `  6-channel pattern without force -> ok:${blockedBulk.ok}, message: ${blockedBulk.message}`
)
if (blockedBulk.message.includes('No channels found')) {
  console.log(
    "ℹ️  0 matches again - this specific check can't exercise the >5-channel gate until section 2's finding is resolved"
  )
} else if (!blockedBulk.ok && blockedBulk.matchedChannels > 5) {
  console.log(
    '✅ the >5-channel safety gate held even though nothing was force-confirmed'
  )
} else {
  console.log(
    `❌ ${blockedBulk.successfulCalls} calls got through a 6-channel pattern without force confirmation`
  )
}

// =============================================================================
// 5) WILDCARD SUBSCRIPTION  →  pathPlugin.on() - patterns are explicitly
//    ALLOWED here (unlike call()), since subscribing is read-only/safe in a
//    way that calling isn't. This is the LAST registration in the file
//    (pathPlugin.on() internally calls cyre.on(), which is gated by lock()
//    exactly like cyre.action() is) - lock() engages right after it.
// =============================================================================
console.log('\n=== 5) wildcard subscription: pathPlugin.on ===')

let wildcardHandlerHits = 0
const wildcardSub = await pathPlugin.on(
  'building/*/humidity',
  (payload, context) => {
    wildcardHandlerHits++
    log.debug(
      `  💧 wildcard handler fired for ${context.id} (matched "${context.matchedPattern}")`
    )
  }
)
console.log(
  `  subscribe("building/*/humidity") -> ok:${wildcardSub.ok}, matched ${wildcardSub.matchCount} channel(s)`
)

// Every registration in this file (sections 1 and 5) is done by this point -
// lock() here, before the calls below, is what actually prevents a stray
// late registration or a duplicate handler from slipping in unnoticed.
cyre.lock()

// This call bypasses the wildcard subscription entirely and goes straight to
// the channel's OWN handler from section 1 (cyre.on registers directly on
// the exact id - pathPlugin.on is an independent, additional subscription
// mechanism, not a replacement for it).
await cyre.call('sensor-f1-humid', 55)
await wait(20)
console.log(
  `  wildcard handler fired ${wildcardHandlerHits} time(s) after a direct cyre.call()`
)
console.log(
  wildcardSub.matchCount >= 1 && wildcardHandlerHits >= 1
    ? '✅ the wildcard-subscribed handler ran alongside the exact-id handler'
    : 'ℹ️  the wildcard subscription matched 0 channels (or never fired) - consistent with section 2'
)

// =============================================================================
// 6) SUMMARY
// =============================================================================
console.log('\n=== 6) summary ===')
console.log(`  path stats: ${JSON.stringify(pathPlugin.stats())}`)

// No recurring/scheduled channels were created in this demo, so there's
// nothing left running that a shutdown would cut off mid-flight - safe to
// end the process here rather than leaving it hanging around.
cyre.shutdown()
