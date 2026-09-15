// demo/cyre-channels-as-state-demo.ts
// Every channel already stores its own request/response history
// (payload-state.ts's {req, res, prevReq, metadata} record) - this demo
// tests whether that's usable as a real state-management primitive on its
// own, with no external store/signals library, the way a consuming app
// (see the cyre-screenplay integration notes) might reach for it.
//
// Written after a live back-and-forth about whether cyre.get()/payload()/
// previousPayload() are the right names and shapes for this - rather than
// resolve that from memory or from README prose (which has drifted from
// the actual shipped API before, per claude/cyre-codebase-analysis.md's
// "README vs. code" section), every claim below is something this file
// actually executes and prints, self-reporting exactly like
// hook-and-chaining-demo.ts's IntraLink section does when two sources
// disagree on documented behavior.
//
// ONE THING THIS FILE ALREADY CAUGHT WHILE BEING WRITTEN, worth flagging
// even though it's not exercised below: src/components/cyre-channels.ts
// has a CyreChannel() function whose registration path sets `res` to the
// RAW unwrapped initial payload (payloadState.setRes(id, preparedChannel.
// payload, 'initial')) - which would make get(id).res a completely
// different shape (a bare value) than what it becomes after any real
// call() (a full {ok, payload, message, ...} CyreResponse). Grepped the
// whole src/ tree: nothing imports cyre-channels.ts or calls
// CyreChannel() anywhere - the real cyre.action() registration path is
// cyre-actions.ts, which never touches `res` at all, only `req`. So that
// shape-inconsistency landmine is sitting in dead code, unreachable today
// - but it's exactly the kind of thing worth knowing about before anyone
// resurrects that file.
//
// CONFIRMED BY ACTUALLY RUNNING THIS FILE (compiled with tsc and run under
// plain node, since neither tsx (esbuild has no linux-arm64 binary here)
// nor bun were runnable in this environment): cyre.get(id) really does
// return {req, prevReq, res, metadata}, and BEFORE any call() there is no
// `res` key at all - only `req` and `metadata` - exactly matching the
// cyre-actions.ts read above (registration sets req, never res). After a
// real call(), res is the full {ok, payload, message, metadata}
// CyreResponse. That means the "current computed value" of a channel is
// state.res?.payload, NOT state.payload - state.payload doesn't exist at
// any point. Getting that wrong is the single easiest mistake to make
// with this pattern, and section 3 below deliberately got it wrong on the
// first pass (read state.payload instead of state.res?.payload) so this
// comment could point at the real failure instead of a hypothetical one.
import {cyre, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) WHAT get(id) ACTUALLY LOOKS LIKE, at each stage - registration, before
//    any call, and after a real call. Printed directly rather than
//    asserted, since this is the exact question that started this demo.
// =============================================================================
console.log('\n=== 1) cyre.get(id) shape at each stage ===')

cyre.action({id: 'demo/counter', payload: 10})
console.log(
  `  right after cyre.action({id, payload: 10}), before any call():`
)
console.log(`  cyre.get('demo/counter') = ${JSON.stringify(cyre.get('demo/counter'))}`)

cyre.on('demo/counter', (delta: number) => {
  // Reads the channel's OWN current state to compute the next one - see
  // section 3 for why this specific read is safe to do from inside the
  // channel's own handler (setRes for THIS call hasn't run yet when this
  // handler body executes, so what get() returns here is still last
  // call's result, not a stale snapshot from outside the dispatch).
  const current = cyre.get('demo/counter') as any
  // The computed value lives at .res.payload, not .payload - see the
  // header comment above for why this is the one thing worth getting
  // exactly right about this pattern.
  const currentValue = current?.res?.payload
  const next =
    (typeof currentValue === 'number' ? currentValue : 10) + delta
  return next
})

await cyre.call('demo/counter', 5)
console.log(`\n  after ONE real call('demo/counter', 5):`)
console.log(`  cyre.get('demo/counter') = ${JSON.stringify(cyre.get('demo/counter'))}`)

const shapeAfterCall = cyre.get('demo/counter') as any
const resLooksWrapped =
  shapeAfterCall && typeof shapeAfterCall === 'object' && 'ok' in shapeAfterCall
console.log(
  resLooksWrapped
    ? 'ℹ️  get() returns a wrapper object (has an "ok" field) once a real call has happened'
    : 'ℹ️  get() returns something else after a real call - see the raw output above'
)

// =============================================================================
// 2) THREE WAYS TO READ "CURRENT STATE" - compared directly against each
//    other on the SAME channel, so any difference between them is visible
//    in one place instead of scattered across separate demos.
// =============================================================================
console.log('\n=== 2) three ways to read current state, compared ===')

cyre.action({id: 'demo/total', payload: 0})
cyre.on('demo/total', (amount: number) => {
  const state = cyre.get('demo/total') as any
  const currentTotal = typeof state?.res?.payload === 'number' ? state.res.payload : 0
  return currentTotal + amount
})

// (a) await cyre.call()'s own resolved response - the handler's return
//     value is right there in the response, no second read needed.
const callResponse = await cyre.call('demo/total', 100)
console.log(`  (a) await cyre.call() response.payload = ${(callResponse as any).payload}`)

// (b) cyre.get(id) read AFTER the call has settled - pulling state on
//     demand from somewhere else in the app that didn't make the call.
const getAfter = cyre.get('demo/total') as any
console.log(`  (b) cyre.get(id) after the call = ${JSON.stringify(getAfter)}`)

// (c) the common mistake - reading req thinking it's "the current value",
//     when req is the INPUT that was dispatched, not the computed result.
console.log(
  `  (c) req on that same record = ${JSON.stringify((getAfter as any)?.req)} ` +
    `(this is the argument passed to call(), not the running total)`
)

// =============================================================================
// 3) SELF-REFERENTIAL REDUCER - a channel that reads its OWN last result
//    to compute its next one, entirely through the channel network, no
//    outside variable holding "the real state" anywhere.
// =============================================================================
console.log('\n=== 3) a channel as its own reducer (no external variable) ===')

cyre.action({id: 'demo/cart-total', payload: 0})
cyre.on('demo/cart-total', (itemPrice: number) => {
  const state = cyre.get('demo/cart-total') as any
  const runningTotal = typeof state?.res?.payload === 'number' ? state.res.payload : 0
  return Math.round((runningTotal + itemPrice) * 100) / 100
})

for (const price of [9.99, 24.5, 3.25]) {
  const r = await cyre.call('demo/cart-total', price)
  console.log(`  + $${price} -> running total: $${(r as any).payload}`)
}

const finalTotal = (cyre.get('demo/cart-total') as any)?.res?.payload
console.log(
  finalTotal === 37.74
    ? '✅ the channel accumulated its own state across 3 calls with zero external variables'
    : `❌ expected $37.74, channel reports $${finalTotal}`
)

// =============================================================================
// 4) getPrevious() + hasChanged() - undo/diffing primitives that come
//    free with treating a channel as state.
// =============================================================================
console.log('\n=== 4) getPrevious() + hasChanged() ===')

cyre.action({id: 'demo/theme', payload: 'dark'})
cyre.on('demo/theme', (theme: string) => theme) // a subscriber is required for call() to dispatch at all
await cyre.call('demo/theme', 'light')
await cyre.call('demo/theme', 'dark')

console.log(`  current req (via get):  ${(cyre.get('demo/theme') as any)?.req}`)
console.log(`  getPrevious():           ${cyre.getPrevious('demo/theme')}`)
console.log(`  hasChanged(id, 'dark'):  ${cyre.hasChanged('demo/theme', 'dark')}`)
console.log(`  hasChanged(id, 'blue'):  ${cyre.hasChanged('demo/theme', 'blue')}`)
console.log(
  cyre.getPrevious('demo/theme') === 'light' &&
    cyre.hasChanged('demo/theme', 'dark') === false &&
    cyre.hasChanged('demo/theme', 'blue') === true
    ? '✅ getPrevious/hasChanged behave like a one-slot undo + dirty-check, no extra bookkeeping'
    : '❌ getPrevious/hasChanged did not behave as expected - see raw values above'
)

// =============================================================================
// 5) MULTIPLE INDEPENDENT STATE CHANNELS + a live subscriber - the "atoms"
//    comparison: several small, independently-updating pieces of state,
//    each with its own pull (get) AND push (on) access, like a signals/
//    atoms library, but with zero extra dependency.
// =============================================================================
console.log('\n=== 5) multiple independent state channels + a live subscriber ===')

cyre.action({id: 'demo/user-name', payload: 'Guest'})
cyre.action({id: 'demo/is-online', payload: false})

const observedNames: string[] = []
cyre.on('demo/user-name', (name: string) => {
  observedNames.push(name)
  log.debug(`  👤 user-name -> ${name}`)
  return name
})
cyre.on('demo/is-online', (online: boolean) => {
  log.debug(`  🟢 is-online -> ${online}`)
  return online
})

await cyre.call('demo/user-name', 'Alice')
await cyre.call('demo/is-online', true)

console.log(`  demo/user-name pulled via get(): ${(cyre.get('demo/user-name') as any)?.req}`)
console.log(`  demo/is-online pulled via get(): ${(cyre.get('demo/is-online') as any)?.req}`)
console.log(`  demo/user-name pushed to subscriber: ${JSON.stringify(observedNames)}`)
console.log(
  observedNames.join(',') === 'Alice' &&
    (cyre.get('demo/is-online') as any)?.req === true
    ? '✅ two independent state channels, each readable on demand AND reactive to subscribers'
    : '❌ one of the two channels behaved unexpectedly - see raw values above'
)

console.log('\ndone.')
