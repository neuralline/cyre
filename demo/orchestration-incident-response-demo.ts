// demo/orchestration-incident-response-demo.ts
// orchestration-scheduling-demo.ts already covers cyre.orchestration's API
// surface feature-by-feature in isolation (a time trigger, each workflow
// step type on its own, condition-abort, the actions-only path, the two
// trigger types that silently no-op). This file doesn't repeat any of that
// - it composes the pieces into one scenario to see how they behave
// TOGETHER, which is where the interesting/unexpected behavior tends to
// show up: an autonomous incident-response system for a fictional web
// service, with two things neither demo nor the source's own examples
// exercise:
//
//   1. An orchestration triggered FROM INSIDE a plain channel handler
//      (cyre.orchestration.call() called from a cyre.on() callback) rather
//      than from a `type: 'time'`/`'external'` trigger - orchestration
//      composing with the ordinary channel layer, not just standing alone.
//   2. TWO independently time-scheduled orchestrations (a 200ms health
//      monitor and a 400ms dashboard reporter) running concurrently for
//      the same duration, to see whether one's workflow execution
//      interferes with the other's - the "long intervals"/scheduling
//      angle, but with two real schedules overlapping instead of one.
//
// Severity-based branching is deliberately built out of the SAME
// condition-step-with-onError:'abort' mechanism orchestration-scheduling-
// demo.ts already proved works - here it's used for something a real
// system would actually want: a 'warning' incident gets paged and stops
// there, a 'critical' incident continues on to an automated rollback.
import {cyre, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 0) REGISTER EVERY CHANNEL + ORCHESTRATION THIS DEMO USES  →  all up front,
//    same discipline as every other demo in this project even though
//    orchestration.keep() itself isn't gated by cyre.lock().
// =============================================================================
console.log('\n=== 0) registering channels + orchestrations ===')

let notifyCount = 0
let pageCount = 0
let rollbackDbCount = 0
let rollbackCacheCount = 0
let resolveCount = 0
let dashboardPrints = 0

cyre.action({id: 'incident/notify-oncall'})
cyre.on('incident/notify-oncall', (payload: any) => {
  notifyCount++
  log.debug(`  📟 on-call notified: ${JSON.stringify(payload)}`)
  return {notified: true}
})

cyre.action({id: 'incident/page-lead'})
cyre.on('incident/page-lead', (payload: any) => {
  pageCount++
  log.debug(`  📞 lead paged: ${JSON.stringify(payload)}`)
  return {paged: true}
})

cyre.action({id: 'incident/rollback-db', delay: 30})
cyre.on('incident/rollback-db', (payload: any) => {
  rollbackDbCount++
  log.debug(`  🗄️  db rolled back: ${JSON.stringify(payload)}`)
  return {rolledBack: 'db'}
})

cyre.action({id: 'incident/rollback-cache', delay: 30})
cyre.on('incident/rollback-cache', (payload: any) => {
  rollbackCacheCount++
  log.debug(`  🧹 cache flushed: ${JSON.stringify(payload)}`)
  return {rolledBack: 'cache'}
})

cyre.action({id: 'incident/resolve'})
cyre.on('incident/resolve', (payload: any) => {
  resolveCount++
  log.debug(`  ✅ incident resolved: ${JSON.stringify(payload)}`)
  return {resolved: true}
})

cyre.action({id: 'dashboard/print'})
cyre.on('dashboard/print', () => {
  dashboardPrints++
  const overview = cyre.orchestration.getSystemOverview()
  log.debug(
    `  📊 dashboard #${dashboardPrints}: ${overview.total.running}/${overview.total.orchestrations} orchestrations running, stress=${overview.systemStress}`
  )
  return overview
})

// A scripted, deterministic health-check sequence rather than real
// randomness, so the demo's assertions below aren't flaky: tick 3 comes
// back down with a CRITICAL incident, tick 6 comes back down with a
// merely WARNING one. Every other tick is healthy.
let pingTick = 0
cyre.action({id: 'service/ping'})
cyre.on('service/ping', async () => {
  pingTick++
  const severity =
    pingTick === 3 ? 'critical' : pingTick === 6 ? 'warning' : undefined
  if (!severity) {
    log.debug(`  💚 ping #${pingTick}: healthy`)
    return {tick: pingTick, healthy: true}
  }

  log.debug(
    `  💔 ping #${pingTick}: DOWN (${severity}) - escalating to incident-response`
  )
  // The interesting part: this orchestration is triggered from INSIDE a
  // plain channel handler, not from a `type: 'time'`/`'external'` trigger -
  // the health-monitor orchestration's own workflow just calls this
  // channel, and this handler decides on its own whether to kick off a
  // SEPARATE orchestration in response to what it found.
  const incidentResult = await cyre.orchestration.call('incident-response', {
    service: 'checkout',
    severity,
    detectedAtTick: pingTick
  })
  log.debug(
    `  🚨 incident-response for tick #${pingTick} -> ok:${incidentResult.ok}`
  )
  return {
    tick: pingTick,
    healthy: false,
    severity,
    incidentResult: incidentResult.ok
  }
})

// A) health-monitor - real recurring scheduling (`type: 'time'`), the
// orchestration that's actually being watched for interesting behavior.
cyre.orchestration.keep({
  id: 'health-monitor',
  triggers: [{name: 'poll', type: 'time', interval: 200}],
  workflow: [{name: 'check', type: 'action', targets: 'service/ping'}]
})

// B) incident-response - no time trigger at all (only `call()`ed directly,
// from inside service/ping's handler above). notify+page run in parallel
// first; a condition step then gates whether rollback+resolve happen at
// all, based on severity - the SAME onError:'abort' mechanism
// orchestration-scheduling-demo.ts proved works, now doing real work.
cyre.orchestration.keep({
  id: 'incident-response',
  triggers: [{name: 'manual', type: 'external'}],
  workflow: [
    {
      name: 'alert',
      type: 'parallel',
      steps: [
        {
          name: 'notify',
          type: 'action',
          targets: 'incident/notify-oncall',
          payload: (ctx: any) => ctx.trigger.payload
        },
        {
          name: 'page',
          type: 'action',
          targets: 'incident/page-lead',
          payload: (ctx: any) => ctx.trigger.payload
        }
      ]
    },
    {
      name: 'severity-gate',
      type: 'condition',
      condition: (ctx: any) => ctx.trigger.payload?.severity === 'critical',
      onError: 'abort'
    },
    {
      name: 'rollback',
      type: 'sequential',
      steps: [
        {
          name: 'rollback-db',
          type: 'action',
          targets: 'incident/rollback-db',
          payload: (ctx: any) => ctx.trigger.payload
        },
        {
          name: 'rollback-cache',
          type: 'action',
          targets: 'incident/rollback-cache',
          payload: (ctx: any) => ctx.trigger.payload
        }
      ]
    },
    {
      name: 'close',
      type: 'action',
      targets: 'incident/resolve',
      payload: (ctx: any) => ctx.trigger.payload
    }
  ]
})

// C) status-report - a SECOND, independently time-scheduled orchestration
// (400ms), running concurrently with health-monitor's 200ms schedule for
// the whole demo, to see whether the two step on each other.
cyre.orchestration.keep({
  id: 'status-report',
  triggers: [{name: 'tick', type: 'time', interval: 400}],
  workflow: [{name: 'print', type: 'action', targets: 'dashboard/print'}]
})

console.log(
  `  registered ${cyre.orchestration.list().length} orchestrations, ${dashboardPrints + notifyCount + pageCount + rollbackDbCount + rollbackCacheCount + resolveCount} handler(s) primed`
)

// Every channel and orchestration this demo will ever touch is registered
// by this point - lock() here, before either orchestration is activated,
// is what actually prevents a stray late registration from slipping in
// while both schedules are running concurrently below.
cyre.lock()

// =============================================================================
// 1) RUN BOTH SCHEDULES CONCURRENTLY
// =============================================================================
console.log(
  '\n=== 1) activating health-monitor (200ms) and status-report (400ms) together ==='
)

cyre.orchestration.activate('health-monitor', true)
cyre.orchestration.activate('status-report', true)

await wait(1450) // ~7 health-check ticks, ~3-4 dashboard prints

cyre.orchestration.activate('health-monitor', false)
cyre.orchestration.activate('status-report', false)

console.log(
  `  final tallies: pingTicks=${pingTick}, dashboardPrints=${dashboardPrints}`
)
console.log(
  `  notify=${notifyCount}, page=${pageCount}, rollback-db=${rollbackDbCount}, rollback-cache=${rollbackCacheCount}, resolve=${resolveCount}`
)

console.log(
  pingTick >= 6 && dashboardPrints >= 2
    ? '✅ both independently-scheduled orchestrations ran concurrently for the full window without stalling each other'
    : `❌ expected ~7 ping ticks and several dashboard prints, got pingTicks=${pingTick} dashboardPrints=${dashboardPrints}`
)

// =============================================================================
// 2) VERIFY THE SEVERITY GATE ACTUALLY GATED SOMETHING
// =============================================================================
console.log(
  '\n=== 2) severity-based branching: critical rolls back, warning only pages ==='
)

console.log(
  notifyCount === 2 && pageCount === 2
    ? '✅ both incidents (critical + warning) triggered the parallel notify+page alert step'
    : `❌ expected 2 notify + 2 page (one per incident), got notify=${notifyCount} page=${pageCount}`
)

console.log(
  rollbackDbCount === 1 && rollbackCacheCount === 1 && resolveCount === 1
    ? '✅ rollback + resolve ran exactly once - only for the CRITICAL incident, not the warning one'
    : `❌ expected exactly 1 rollback+resolve (critical only), got db=${rollbackDbCount} cache=${rollbackCacheCount} resolve=${resolveCount}`
)

// =============================================================================
// 3) FINAL ORCHESTRATION-LEVEL METRICS  →  incident-response was call()ed
//    twice (from inside service/ping's handler, never from a trigger of
//    its own) - its OWN executionCount should reflect that.
// =============================================================================
console.log('\n=== 3) incident-response execution metrics ===')

const incidentStatus = cyre.orchestration.getStatus('incident-response')
console.log(
  `  incident-response: executionCount=${incidentStatus?.executionCount}, metrics=${JSON.stringify(incidentStatus?.metrics)}`
)
console.log(
  incidentStatus?.executionCount === 2
    ? "✅ incident-response ran exactly twice, entirely triggered from inside another orchestration's workflow step - no trigger of its own fired it"
    : `❌ expected incident-response.executionCount === 2, got ${incidentStatus?.executionCount}`
)

// =============================================================================
// 4) TEARDOWN
// =============================================================================
console.log('\n=== 4) teardown ===')
for (const id of ['health-monitor', 'incident-response', 'status-report']) {
  console.log(`  forget('${id}') -> ${cyre.orchestration.forget(id)}`)
}

// Both time-triggered orchestrations were already deactivated in section 1
// before anything else ran, and everything else in this demo was pure
// request/response (no lingering timers) - nothing is left running, safe
// to end the process here.
cyre.shutdown()
