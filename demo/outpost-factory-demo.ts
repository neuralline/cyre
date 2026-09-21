// demo/outpost-factory-demo.ts
// A "factory / outpost" architecture on top of useCyre + useBranch, and how
// to point a typed useCyre hook at a channel id that's already registered
// on the MAIN cyre instance instead of letting useCyre invent one.
//
//   MAIN CYRE      → mission control: one shared channel every outpost
//                    reports into. Registered once, by a fixed id constant.
//   FACTORY        → createOutpost(id) - an ordinary function that builds
//                    one outpost the same way every time: a branch plus its
//                    typed instrument channels.
//   OUTPOST        → the thing the factory returns: a useBranch(cyre, {id})
//                    branch, isolated from every other outpost, holding its
//                    own useCyre-typed 'telemetry' channel.
//
// The id-reuse trick (the actual ask this demo answers): useCyre's `config`
// is just the IO object it forwards to `instance.action()`. If you pass the
// SAME id a channel was already registered under, useCyre's hook attaches
// to that exact channel (channel identity in cyre is "same id, same store
// entry" - nothing more) instead of minting a new hook-<random> id. See
// MISSION_STATUS_ID below. The one thing to know: since useCyre calls
// `action()` again itself (the first time you use `.call()`/`.on()`),
// re-registering with a THINNER config than the original will overwrite
// whatever extra fields the original had - keep the id-reuse config either
// identical to, or a superset of, the original registration.
//
// Builds on:
//   - branches-demo.ts    the branch isolation/path-prefixing mechanics
//                          used here for each outpost's local 'telemetry' id
//   - src/hooks/use-cyre.ts's generics (TPayload/TResponse on useCyre) -
//     what makes `.call()`/`.on()` below fully typed per channel
//
// Run: tsx demo/outpost-factory-demo.ts
import {cyre, useCyre, useBranch, log} from '../src'
import type {CyreHook} from '../src/hooks/use-cyre'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// TYPES  →  what .call() sends and what .on() must return, for each channel
// =============================================================================

type OutpostStatus = 'nominal' | 'warning' | 'critical'

const statusOf = (tempC: number): OutpostStatus =>
  tempC > 80 ? 'critical' : tempC > 60 ? 'warning' : 'nominal'

/** Payload an outpost's instrument sends locally */
interface TelemetryReading {
  tempC: number
  timestamp: number
}

/** What an outpost's telemetry handler resolves .call() with */
interface TelemetryAck {
  received: true
  outpostId: string
  status: OutpostStatus
}

/** Payload every outpost reports up to mission control */
interface MissionStatusUpdate {
  outpostId: string
  status: OutpostStatus
  tempC: number
}

/** What mission control resolves a report .call() with */
interface MissionStatusAck {
  logged: true
  totalReports: number
}

// =============================================================================
// 1) MAIN CYRE  →  mission control's channel, registered once by id constant
//
// In a real app this line would live wherever your "core" channels are set
// up - the factory in section 2 never sees this registration, only the id.
// =============================================================================
console.log('\n=== 1) main cyre: register mission control ===')

const MISSION_STATUS_ID = 'mission/status'

// The "existing main channel" - deliberately a thin config. Anything you
// put here is what useCyre below must match-or-extend when it re-registers.
cyre.action({id: MISSION_STATUS_ID})

// Bind a TYPED hook to that SAME id, rather than useCyre({id: undefined})
// generating a fresh 'hook-xxxxxxxx' channel. `missionStatus` now reads and
// writes the exact channel `cyre.action` just created - same store entry,
// found by id, nothing more mysterious than that.
const missionStatus = useCyre<MissionStatusUpdate, MissionStatusAck>(cyre, {
  id: MISSION_STATUS_ID
})

let totalReports = 0
const statusLog: MissionStatusUpdate[] = []

missionStatus.on(update => {
  totalReports++
  statusLog.push(update)
  log.debug(
    `  📡 [mission-control] ${update.outpostId} -> ${update.status} (${update.tempC}°C)`
  )
  return {logged: true, totalReports}
})

console.log(`  mission control listening on "${MISSION_STATUS_ID}"`)

// =============================================================================
// 2) THE FACTORY  →  createOutpost(id) always wires an outpost the same way:
//    one branch, one typed 'telemetry' channel, one report-upward handler.
// =============================================================================
console.log('\n=== 2) the factory ===')

interface Outpost {
  id: string
  path: string
  telemetry: CyreHook<TelemetryReading, TelemetryAck>
}

const createOutpost = (id: string): Outpost => {
  // Every outpost is its own isolated branch off root cyre - see
  // branches-demo.ts for why the SAME local id ('telemetry') below never
  // collides between outposts: useBranch prefixes it into a unique global
  // id (`${id}/telemetry`) automatically.
  const branch = useBranch(cyre, {id})
  if (!branch) throw new Error(`factory: failed to create outpost "${id}"`)

  const telemetry = useCyre<TelemetryReading, TelemetryAck>(branch, {
    id: 'telemetry',
    detectChanges: true
  })

  telemetry.on(reading => {
    const status = statusOf(reading.tempC)
    log.debug(`  🛰️  [${id}] telemetry -> ${reading.tempC}°C (${status})`)

    // Report upward on the SHARED main channel bound in section 1 - every
    // outpost the factory makes funnels into the exact same handler.
    missionStatus.call({outpostId: id, status, tempC: reading.tempC})

    return {received: true, outpostId: id, status}
  })

  return {id, path: branch.path(), telemetry}
}

console.log('  createOutpost(id) ready')

// =============================================================================
// 3) SPIN UP OUTPOSTS  →  same factory call, twice, zero id collisions
// =============================================================================
console.log('\n=== 3) outposts, built by the factory ===')

const alpha = createOutpost('outpost-alpha')
const bravo = createOutpost('outpost-bravo')

console.log(`  alpha path: "${alpha.path}"`)
console.log(`  bravo path: "${bravo.path}"`)

await alpha.telemetry.call({tempC: 45, timestamp: Date.now()})
await wait(20)
await bravo.telemetry.call({tempC: 72, timestamp: Date.now()})
await wait(20)
await alpha.telemetry.call({tempC: 91, timestamp: Date.now()})
await wait(20)

console.log(
  alpha.path !== bravo.path
    ? "✅ alpha and bravo's 'telemetry' local id resolved to two distinct channels"
    : '❌ outposts collided on the same global channel id'
)

// =============================================================================
// 4) VERIFY  →  mission control saw every report, correctly attributed
// =============================================================================
console.log('\n=== 4) mission control log ===')

statusLog.forEach((entry, i) =>
  console.log(
    `  #${i + 1} ${entry.outpostId}: ${entry.status} (${entry.tempC}°C)`
  )
)

const expected: MissionStatusUpdate[] = [
  {outpostId: 'outpost-alpha', status: 'nominal', tempC: 45},
  {outpostId: 'outpost-bravo', status: 'warning', tempC: 72},
  {outpostId: 'outpost-alpha', status: 'critical', tempC: 91}
]
const matches =
  totalReports === expected.length &&
  expected.every(
    (e, i) =>
      statusLog[i]?.outpostId === e.outpostId &&
      statusLog[i]?.status === e.status &&
      statusLog[i]?.tempC === e.tempC
  )

console.log(
  matches
    ? `✅ mission control received all ${totalReports} reports, correctly attributed`
    : `❌ mission control log did not match expected reports (got ${totalReports})`
)

// =============================================================================
// HOW TO REUSE THIS PATTERN
// =============================================================================
// 1. Pick an id constant for anything mission-control-like that many
//    branches need to report into, and register it once on root cyre.
// 2. Bind a typed useCyre hook to that SAME id (useCyre<TPayload, TResponse>
//    (cyre, {id: THAT_CONSTANT})) wherever you need to call or subscribe to
//    it - it's the same channel, not a copy.
// 3. Write one factory function that takes an id and returns useBranch(cyre,
//    {id}) plus whatever typed useCyre channels that kind of branch always
//    needs. Call the factory once per instance instead of hand-wiring each
//    one - every instance gets the same shape, the same types, and
//    automatic id isolation from useBranch.
//
// What you get for free from the generics added to useCyre:
//   - useCyre<Payload>(...)            .call() only accepts Payload
//   - useCyre<Payload, Response>(...)  .on()'s handler must return Response,
//                                       and .call()'s Promise resolves
//                                       { ok, payload: Response, ... }
//   - useCyre(...)                     unchanged - both default to `any`
console.log('\ndone.')
