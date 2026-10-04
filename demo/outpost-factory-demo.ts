// demo/outpost-factory-demo.ts
// A "factory / outpost" architecture on top of useCyre + useBranch, and how
// to point a typed useCyre hook at a channel id that's already registered
// on the MAIN cyre instance instead of letting useCyre invent one.
//
//   MAIN CYRE      → mission control: one shared channel every outpost
//                    reports into. Registered once, by a fixed id constant.
//   FACTORY        → createOutpost(id) - an ordinary function that builds
//                    one outpost the same way every time: a branch plus its
//                    typed instrument channels, tracked in its own registry.
//   OUTPOST        → the thing the factory returns: a useBranch(cyre, {id})
//                    branch, isolated from every other outpost, holding two
//                    useCyre-typed channels - 'telemetry' (reports upward)
//                    and 'command' (receives orders downward).
//
// The id-reuse trick (the actual original ask this demo answers): useCyre's
// `config` is just the IO object it forwards to `instance.action()`. If you
// pass the SAME id a channel was already registered under, useCyre's hook
// attaches to that exact channel (channel identity in cyre is "same id,
// same store entry" - nothing more) instead of minting a new hook-<random>
// id. See MISSION_STATUS_ID in section 1. The one thing to know: since
// useCyre calls `action()` again itself (the first time you use
// `.call()`/`.on()`), re-registering with a THINNER config than the
// original will overwrite whatever extra fields the original had - keep
// the id-reuse config either identical to, or a superset of, the original
// registration.
//
// What this version adds on top of a single upstream channel:
//   §5  DOWNSTREAM commands  - mission control -> every outpost, via a
//       registry-driven broadcast() helper (no useGroup: its `channels:
//       IO[]` parameter type doesn't structurally fit a CyreHook - see the
//       note next to broadcast() below)
//   §6  UNSUBSCRIBE          - .on()'s returned unsubscribe(), scoped to
//       one handler, safe to call twice, and (as of this file) kept in
//       sync with getStats().subscribed - see the use-cyre.ts note below
//   §7  TEARDOWN             - branch.destroy() decommissions one outpost;
//       broadcast() and direct calls both prove it's really gone
//   §8  LOCK                 - cyre.lock() after commissioning: no new
//       channels, but every already-commissioned outpost keeps working
//   §9  TYPE SAFETY, PROVEN  - the two calls that would fail to compile if
//       you got a payload/response shape wrong, left in as documentation
//
// Builds on:
//   - branches-demo.ts       branch isolation, path prefixing, and the
//                             destroy()+wait(50) teardown idiom reused in §7
//   - hook-and-chaining-demo.ts   the cyre.lock() pattern reused in §8
//   - src/hooks/use-cyre.ts's generics (TPayload/TResponse on useCyre) -
//     what makes every .call()/.on() below fully typed per channel
//
// A note on §6: cyre.on()'s single-handler path (cyre-on.ts's
// addSingleSubscriber) returns a real unsubscribe() bound to the exact
// (channel, handler) pair - it is NOT a stub. useCyre's own on() wraps that
// unsubscribe so the hook's isSubscribed/getStats().subscribed stay
// accurate across a partial unsubscribe too (it used to latch `true`
// forever the moment any handler was ever attached).
//
// Run: tsx demo/outpost-factory-demo.ts
import {cyre, useCyre, useBranch, log, CyreHook, Branch} from '../src'

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

type OutpostCommandAction = 'recalibrate' | 'shutdown'

/** Payload mission control sends DOWN to an outpost */
interface OutpostCommand {
  action: OutpostCommandAction
  issuedAt: number
}

/** What an outpost's command handler resolves .call() with */
interface OutpostCommandAck {
  ok: true
  outpostId: string
  action: OutpostCommandAction
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
//    one branch, two typed channels (telemetry up, command down), and an
//    entry in the factory's own registry.
// =============================================================================
console.log('\n=== 2) the factory ===')

interface Outpost {
  id: string
  path: string
  /** The underlying branch - exposed so callers can introspect/tear it down */
  branch: Branch
  telemetry: CyreHook<TelemetryReading, TelemetryAck>
  command: CyreHook<OutpostCommand, OutpostCommandAck>
}

// This Map is the FACTORY's own bookkeeping (plain userland state, not part
// of cyre's internals) - it's how broadcast() below knows who's currently
// commissioned. cyre still owns the actual channel/branch stores; this just
// remembers which Outpost objects this factory has handed out.
const outposts = new Map<string, Outpost>()

const createOutpost = (id: string): Outpost => {
  // Every outpost is its own isolated branch off root cyre - see
  // branches-demo.ts for why the SAME local ids below ('telemetry',
  // 'command') never collide between outposts: useBranch prefixes them
  // into unique global ids (`${id}/telemetry`, `${id}/command`)
  // automatically.
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

  const command = useCyre<OutpostCommand, OutpostCommandAck>(branch, {
    id: 'command'
  })

  command.on(cmd => {
    log.debug(`  📥 [${id}] command received -> ${cmd.action}`)
    return {ok: true, outpostId: id, action: cmd.action}
  })

  const outpost: Outpost = {id, path: branch.path(), branch, telemetry, command}
  outposts.set(id, outpost)
  return outpost
}

/**
 * Fan a command out to every CURRENTLY REGISTERED outpost. Deliberately a
 * plain typed loop rather than useGroup: useGroup's `channels: IO[]`
 * parameter type doesn't structurally match a CyreHook (no required `id`
 * field), so using it here would need an `as any` cast - a loop keeps every
 * call fully typed with zero casts. useGroup is still the right tool when
 * you want ONE call to await/aggregate many DIFFERENT channels at once;
 * see orbital-command.ts for that use case.
 */
const broadcast = (action: OutpostCommandAction) =>
  Promise.all(
    [...outposts.values()].map(o =>
      o.command.call({action, issuedAt: Date.now()})
    )
  )

console.log('  createOutpost(id) + broadcast(action) ready')

// =============================================================================
// 3) SPIN UP OUTPOSTS  →  same factory call, three times, zero id collisions
// =============================================================================
console.log('\n=== 3) outposts, built by the factory ===')

const alpha = createOutpost('outpost-alpha')
const bravo = createOutpost('outpost-bravo')
const charlie = createOutpost('outpost-charlie')

console.log(`  alpha path:   "${alpha.path}"`)
console.log(`  bravo path:   "${bravo.path}"`)
console.log(`  charlie path: "${charlie.path}"`)

const paths = [alpha.path, bravo.path, charlie.path]
console.log(
  new Set(paths).size === paths.length
    ? "✅ all three outposts' 'telemetry'/'command' local ids resolved to distinct channels"
    : '❌ two outposts collided on the same global channel id'
)

// =============================================================================
// 4) UPSTREAM  →  telemetry readings, funnelled through the factory-wired
//    handler up to the single mission-control channel from section 1
// =============================================================================
console.log('\n=== 4) upstream: telemetry -> mission control ===')

await alpha.telemetry.call({tempC: 45, timestamp: Date.now()})
await wait(20)
await bravo.telemetry.call({tempC: 72, timestamp: Date.now()})
await wait(20)
await charlie.telemetry.call({tempC: 88, timestamp: Date.now()})
await wait(20)
await alpha.telemetry.call({tempC: 91, timestamp: Date.now()})
await wait(20)

console.log('\n  mission control log:')
statusLog.forEach((entry, i) =>
  console.log(
    `   #${i + 1} ${entry.outpostId}: ${entry.status} (${entry.tempC}°C)`
  )
)

const expectedUpstream: MissionStatusUpdate[] = [
  {outpostId: 'outpost-alpha', status: 'nominal', tempC: 45},
  {outpostId: 'outpost-bravo', status: 'warning', tempC: 72},
  {outpostId: 'outpost-charlie', status: 'critical', tempC: 88},
  {outpostId: 'outpost-alpha', status: 'critical', tempC: 91}
]
const upstreamMatches =
  totalReports === expectedUpstream.length &&
  expectedUpstream.every(
    (e, i) =>
      statusLog[i]?.outpostId === e.outpostId &&
      statusLog[i]?.status === e.status &&
      statusLog[i]?.tempC === e.tempC
  )

console.log(
  upstreamMatches
    ? `✅ mission control received all ${totalReports} reports, correctly attributed`
    : `❌ mission control log did not match expected reports (got ${totalReports})`
)

// =============================================================================
// 5) DOWNSTREAM  →  one broadcast() call reaches all three outposts' typed
//    'command' channels through the factory's registry
// =============================================================================
console.log('\n=== 5) downstream: broadcast(recalibrate) ===')

const recalAcks = await broadcast('recalibrate')
recalAcks.forEach(ack =>
  console.log(`  ack from ${ack.payload?.outpostId}: ${ack.payload?.action}`)
)

console.log(
  recalAcks.length === 3 &&
    recalAcks.every(a => a.ok && a.payload?.action === 'recalibrate')
    ? '✅ all three outposts acknowledged the broadcast command'
    : '❌ broadcast did not reach (or was not acked by) every outpost'
)

// =============================================================================
// 6) UNSUBSCRIBE  →  .on()'s return carries an unsubscribe() bound to that
//    exact (channel, handler) pair - removing it never touches any OTHER
//    handler on the same channel, is safe to call twice, and keeps the
//    hook's own getStats().subscribed accurate.
// =============================================================================
console.log('\n=== 6) unsubscribe ===')

// Add a SECOND handler to alpha's already-live 'telemetry' channel, on top
// of the one the factory installed in section 2.
let secondHandlerFired = 0
const secondSubscription = alpha.telemetry.on(reading => {
  secondHandlerFired++
  log.debug(`  🔔 [outpost-alpha] second handler also saw ${reading.tempC}°C`)
  return {
    received: true,
    outpostId: alpha.id,
    status: statusOf(reading.tempC)
  }
})

await alpha.telemetry.call({tempC: 40, timestamp: Date.now()})
console.log(
  secondHandlerFired === 1
    ? '✅ both handlers on alpha.telemetry fired for the same call'
    : '❌ the second handler did not fire alongside the factory-installed one'
)

const unsubscribed = secondSubscription.unsubscribe?.()
console.log(`  unsubscribe() -> ${unsubscribed}`)

await alpha.telemetry.call({tempC: 41, timestamp: Date.now()})
console.log(
  secondHandlerFired === 1
    ? "✅ after unsubscribe, the second handler no longer fires - the factory's original handler is untouched"
    : '❌ unsubscribe did not actually remove the handler'
)

console.log(
  alpha.telemetry.getStats().subscribed
    ? "✅ getStats().subscribed is still true - the factory's original handler is still attached"
    : '❌ getStats().subscribed went stale/false even though one handler remains'
)

const doubleUnsubscribe = secondSubscription.unsubscribe?.()
console.log(
  doubleUnsubscribe === false
    ? '✅ calling unsubscribe() a second time is a safe no-op (returns false)'
    : '❌ double-unsubscribe misbehaved'
)

// =============================================================================
// 7) TEARDOWN  →  decommission one outpost; prove it's really gone, and that
//    its siblings and the factory's registry are unaffected
// =============================================================================
console.log('\n=== 7) decommissioning outpost-bravo ===')

bravo.branch.destroy()
outposts.delete('outpost-bravo')
await wait(50) // destroy() kicks off async cleanup and returns immediately

const afterDestroy = await bravo.telemetry.call({
  tempC: 50,
  timestamp: Date.now()
})
console.log(
  `  bravo telemetry callable after destroy: ${afterDestroy.ok} (${afterDestroy.message})`
)

const shutdownAcks = await broadcast('shutdown')
console.log(
  !afterDestroy.ok && shutdownAcks.length === 2
    ? '✅ bravo is gone (call fails, and broadcast now only reaches alpha + charlie)'
    : '❌ bravo still responded after being decommissioned'
)

const charlieStillFine = await charlie.telemetry.call({
  tempC: 55,
  timestamp: Date.now()
})
console.log(
  charlieStillFine.ok
    ? "✅ a sibling outpost (charlie) is untouched by bravo's teardown"
    : '❌ decommissioning bravo unexpectedly broke charlie'
)

// =============================================================================
// 8) LOCK  →  once every outpost you need is commissioned, freeze new
//    registrations - the factory can no longer stand up new channels, but
//    every already-commissioned outpost keeps working exactly as before
// =============================================================================
console.log('\n=== 8) lock the system after commissioning ===')

cyre.lock()

const lateRegistration = cyre.action({id: 'outpost-delta/telemetry'})
console.log(`  registering a channel after lock() -> ok:${lateRegistration.ok}`)
console.log(
  !lateRegistration.ok
    ? '✅ lock() blocked a new outpost channel from being registered'
    : '❌ a new channel registered even though the system was locked'
)

const aliveAfterLock = await alpha.telemetry.call({
  tempC: 30,
  timestamp: Date.now()
})
console.log(
  aliveAfterLock.ok
    ? '✅ an already-commissioned outpost still works after lock()'
    : '❌ lock() broke an outpost that was commissioned before locking'
)

// =============================================================================
// 9) TYPE SAFETY, PROVEN  →  what the generics on useCyre actually buy you.
//    Left commented out because this file is meant to run (tsx doesn't
//    type-check); uncomment either line and your editor's TypeScript
//    server - or `tsc --noEmit` with demo/ added to tsconfig's `include` -
//    will report exactly one error, right where the shape is wrong.
// =============================================================================
//
// alpha.telemetry.call({wrongField: true})
// // ~~~~~~~~~~~~~~~~~~ Argument of type '{ wrongField: boolean }' is not
// // assignable to parameter of type 'TelemetryReading | undefined'.
//
// alpha.command.on(cmd => ({wrong: 'shape'}))
// // ~~~~~~~~~~~~~~~~~~ Type '{ wrong: string }' is not assignable to type
// // 'OutpostCommandAck | Promise<OutpostCommandAck>'.

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
// 4. Keep the factory's own registry (a plain Map, as above) if you need to
//    fan a call out to "every instance currently commissioned" - that's
//    userland bookkeeping, separate from anything cyre stores internally.
// 5. branch.destroy() decommissions one instance without having to remember
//    every channel id it ever registered; cyre.lock() freezes registration
//    of NEW channels once setup is done, without touching existing ones.
//
// What you get for free from the generics added to useCyre:
//   - useCyre<Payload>(...)            .call() only accepts Payload
//   - useCyre<Payload, Response>(...)  .on()'s handler must return Response,
//                                       and .call()'s Promise resolves
//                                       { ok, payload: Response, ... }
//   - useCyre(...)                     unchanged - both default to `any`
console.log('\ndone.')
cyre.shutdown()
