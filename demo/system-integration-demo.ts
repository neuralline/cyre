// demo/system-integration-demo.ts
// Exercises the system-wide integration work that closes the gap between
// cyre's core (io/subscribers/TimeKeeper's shared timeline) and the two
// systems that sit above it - src/components/cyre-schedule.ts and
// src/orchestration/orchestration-engine.ts:
//
// - context/orchestration-state.ts (new) - orchestration's runtime/
//   trigger-subscription stores, pulled out of orchestration-engine.ts the
//   same way schedule's task registry already lived in
//   context/schedule-state.ts, so neither is a module-private Map anymore
//   (this split also broke what would've been a circular import into
//   metrics-state.ts)
// - context/metrics-state.ts - getMetrics() now reports
//   stores.scheduledTasks/stores.orchestrations alongside
//   channels/subscribers/timeline, instead of only ever seeing raw timer
//   counts and having no idea scheduled tasks or orchestrations existed
// - cyre-schedule.ts's schedule.task() is now gated by
//   metricsState.canRegister() - previously cyre.lock() had no effect on
//   it at all, unlike cyre.action()/cyre.on()/orchestration.keep()
// - app.ts's reset() now calls the new schedule.reset()/orchestration.reset()
//   BEFORE wiping io/subscribers/TimeKeeper, so a system reset (and
//   shutdown(), which calls reset() internally) doesn't leave scheduleState/
//   orchestrationState full of stale entries pointing at timers that were
//   just destroyed out from under them
// - app.ts's pause()/resume() now delegate to schedule.pause()/resume() or
//   the new orchestration.pause()/resume() when given a schedule task's or
//   orchestration's id - previously TimeKeeper.pause(id)/resume(id) matched
//   nothing for them, because their real TimeKeeper timers are named
//   "<id>-trigger-N", not the bare id, so cyre.pause(taskId) silently did
//   nothing
//
// Section 3a below deliberately also exercises the *unchanged* path (a
// plain interval channel, whose TimeKeeper timer id genuinely is the bare
// channel id per cyre-call.ts's processCall) as a control - proof the new
// delegation in pause()/resume() didn't regress the case it already worked
// for.

import {cyre, log} from '../src'

const schedule = cyre.schedule
const orchestration = cyre.orchestration

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 0) REGISTER CHANNELS  →  targets used throughout the sections below
// =============================================================================
console.log('\n=== 0) registering channels ===')

let pingCount = 0
cyre.action({id: 'ping/tick', interval: 250, repeat: true})
cyre.on('ping/tick', () => {
  pingCount++
  return {ok: true}
})

let digestCount = 0
cyre.action({id: 'digest/run'})
cyre.on('digest/run', () => {
  digestCount++
  return {ok: true}
})

let orchRunCount = 0
cyre.action({id: 'orch/run'})
cyre.on('orch/run', () => {
  orchRunCount++
  return {ok: true}
})

console.log('  registered: ping/tick, digest/run, orch/run')

// =============================================================================
// 1) metricsState AWARENESS  →  cyre.getMetrics().stores.scheduledTasks /
//    .orchestrations now track scheduleState/orchestrationState directly,
//    not just raw TimeKeeper timer counts
// =============================================================================
console.log(
  '\n=== 1) metricsState awareness of schedule/orchestration counts ==='
)

const baseline = cyre.getMetrics() as any
console.log(
  `  baseline stores.scheduledTasks:${baseline.stores.scheduledTasks} stores.orchestrations:${baseline.stores.orchestrations}`
)
console.log(
  baseline.stores.scheduledTasks === schedule.list().length &&
    baseline.stores.orchestrations === orchestration.list().length
    ? '✅ baseline metrics match schedule.list()/orchestration.list()'
    : '❌ baseline metrics out of sync with schedule/orchestration registries'
)

schedule.task({
  id: 'demo-metrics-task',
  triggers: [{delay: 60000, channels: ['digest/run'], repeat: false}]
})
orchestration.keep({
  id: 'demo-metrics-orch',
  triggers: [{name: 'noop', type: 'time', interval: 60000, repeat: false}],
  workflow: [{name: 'run', type: 'action', targets: 'orch/run'}]
})

const afterRegister = cyre.getMetrics() as any
console.log(
  `  after registering 1 task + 1 orchestration: stores.scheduledTasks:${afterRegister.stores.scheduledTasks} stores.orchestrations:${afterRegister.stores.orchestrations}`
)
console.log(
  afterRegister.stores.scheduledTasks === baseline.stores.scheduledTasks + 1 &&
    afterRegister.stores.orchestrations === baseline.stores.orchestrations + 1
    ? '✅ metricsState picked up the new schedule task and orchestration'
    : '❌ metricsState did not reflect the new registrations'
)

schedule.cancel('demo-metrics-task')
orchestration.forget('demo-metrics-orch')

const afterCleanup = cyre.getMetrics() as any
console.log(
  afterCleanup.stores.scheduledTasks === baseline.stores.scheduledTasks &&
    afterCleanup.stores.orchestrations === baseline.stores.orchestrations
    ? '✅ counts drop back down after cancel()/forget()'
    : '❌ counts did not return to baseline after cleanup'
)

// =============================================================================
// 2) cyre.lock() GATES schedule.task()  →  previously schedule.task() never
//    called metricsState.canRegister(), so a locked system still silently
//    accepted new scheduled tasks
// =============================================================================
console.log('\n=== 2) cyre.lock() now gates schedule.task() ===')

cyre.lock()
const lockedAttempt = schedule.task({
  id: 'demo-should-be-blocked',
  triggers: [{interval: 1000, channels: ['digest/run'], repeat: true}]
})
console.log(
  `  schedule.task() while locked -> ok:${lockedAttempt.ok} - ${lockedAttempt.message}`
)
console.log(
  lockedAttempt.ok === false
    ? '✅ schedule.task() correctly refused while the system is locked'
    : '❌ schedule.task() should have been blocked while locked'
)

cyre.unlock()
const unlockedAttempt = schedule.task({
  id: 'demo-should-be-blocked',
  triggers: [{interval: 1000, channels: ['digest/run'], repeat: true}]
})
console.log(
  `  schedule.task() after unlock() -> ok:${unlockedAttempt.ok} - ${unlockedAttempt.message}`
)
console.log(
  unlockedAttempt.ok === true
    ? '✅ schedule.task() succeeds again once unlocked'
    : '❌ schedule.task() should have succeeded after unlock()'
)
schedule.cancel('demo-should-be-blocked')

// =============================================================================
// 3) cyre.pause(id)/cyre.resume(id) DELEGATION  →  a schedule task's or
//    orchestration's real TimeKeeper timers are named "<id>-trigger-N", not
//    the bare id, so the top-level cyre.pause(id)/resume(id) now check
//    schedule.get(id)/orchestration.get(id) first and delegate correctly
// =============================================================================
console.log(
  '\n=== 3) cyre.pause(id)/resume(id) delegate to the right subsystem ==='
)

// --- 3a) control case: a plain interval channel (unchanged path - its
//     TimeKeeper timer id genuinely IS the bare channel id) ---
console.log('\n--- 3a) plain channel (control case) ---')
await cyre.call('ping/tick') // arms the interval timer on first call
await wait(700)
const pingBeforePause = pingCount
cyre.pause('ping/tick')
await wait(700)
const pingDuringPause = pingCount
cyre.resume('ping/tick')
await wait(700)
const pingAfterResume = pingCount

console.log(
  `  ticks before pause:${pingBeforePause} during pause:${pingDuringPause - pingBeforePause} after resume:${pingAfterResume - pingDuringPause}`
)
console.log(
  pingDuringPause === pingBeforePause && pingAfterResume > pingDuringPause
    ? '✅ plain channel pause/resume still works (control case not regressed)'
    : '❌ plain channel pause/resume regressed'
)

// --- 3b) schedule task ---
console.log('\n--- 3b) schedule task ---')
schedule.task({
  id: 'demo-pause-task',
  triggers: [{interval: 250, channels: ['digest/run'], repeat: true}]
})
await wait(700)
const digestBeforePause = digestCount
cyre.pause('demo-pause-task') // bare task id - NOT "demo-pause-task-trigger-0"
await wait(700)
const digestDuringPause = digestCount
cyre.resume('demo-pause-task')
await wait(700)
const digestAfterResume = digestCount

console.log(
  `  ticks before pause:${digestBeforePause} during pause:${digestDuringPause - digestBeforePause} after resume:${digestAfterResume - digestDuringPause}`
)
console.log(
  digestDuringPause === digestBeforePause &&
    digestAfterResume > digestDuringPause
    ? '✅ cyre.pause(taskId)/resume(taskId) correctly delegate to schedule.pause()/resume()'
    : '❌ cyre.pause(taskId) did not actually pause the schedule task'
)
schedule.cancel('demo-pause-task')

// --- 3c) orchestration ---
console.log('\n--- 3c) orchestration ---')
orchestration.keep({
  id: 'demo-pause-orch',
  triggers: [{name: 'tick', type: 'time', interval: 250, repeat: true}],
  workflow: [{name: 'run', type: 'action', targets: 'orch/run'}]
})
orchestration.activate('demo-pause-orch', true)
await wait(700)
const orchBeforePause = orchRunCount
cyre.pause('demo-pause-orch') // bare orchestration id
await wait(700)
const orchDuringPause = orchRunCount
cyre.resume('demo-pause-orch')
await wait(700)
const orchAfterResume = orchRunCount

console.log(
  `  ticks before pause:${orchBeforePause} during pause:${orchDuringPause - orchBeforePause} after resume:${orchAfterResume - orchDuringPause}`
)
console.log(
  orchDuringPause === orchBeforePause && orchAfterResume > orchDuringPause
    ? '✅ cyre.pause(orchestrationId)/resume(orchestrationId) correctly delegate to orchestration.pause()/resume()'
    : '❌ cyre.pause(orchestrationId) did not actually pause the orchestration'
)
orchestration.forget('demo-pause-orch')

// =============================================================================
// 4) cyre.reset() (and shutdown(), which calls reset() internally) TEAR DOWN
//    schedule/orchestration state too, not just io/subscribers/TimeKeeper
// =============================================================================
console.log('\n=== 4) cyre.reset() manages schedule/orchestration state ===')

schedule.task({
  id: 'demo-reset-task',
  triggers: [{interval: 5000, channels: ['digest/run'], repeat: true}]
})
orchestration.keep({
  id: 'demo-reset-orch',
  triggers: [{name: 'tick', type: 'time', interval: 5000, repeat: true}],
  workflow: [{name: 'run', type: 'action', targets: 'orch/run'}]
})
orchestration.activate('demo-reset-orch', true)

console.log(
  `  before reset(): schedule tasks:${schedule.list().length} orchestrations:${orchestration.list().length}`
)
console.log(
  schedule.list().length > 0 && orchestration.list().length > 0
    ? '✅ task and orchestration are registered ahead of reset()'
    : '❌ setup for the reset() check failed'
)

cyre.reset()

const afterReset = cyre.getMetrics() as any
console.log(
  `  after reset(): schedule tasks:${schedule.list().length} orchestrations:${orchestration.list().length}, stores.scheduledTasks:${afterReset.stores.scheduledTasks} stores.orchestrations:${afterReset.stores.orchestrations}`
)
console.log(
  schedule.list().length === 0 &&
    orchestration.list().length === 0 &&
    afterReset.stores.scheduledTasks === 0 &&
    afterReset.stores.orchestrations === 0
    ? '✅ reset() cleared both the domain registries and what metricsState reports'
    : '❌ reset() left stale schedule/orchestration state behind'
)

// Confirm the system comes all the way back, not just "cleared" -
// re-init and prove schedule.task() (gated in section 2) works again
await cyre.init()
cyre.action({id: 'digest/run'})
cyre.on('digest/run', () => ({ok: true}))
const postResetTask = schedule.task({
  id: 'demo-post-reset-task',
  triggers: [{delay: 60000, channels: ['digest/run'], repeat: false}]
})
console.log(
  postResetTask.ok
    ? '✅ system is fully usable again after reset() + re-init()'
    : `❌ schedule.task() failed after reset()+init(): ${postResetTask.message}`
)
schedule.cancel('demo-post-reset-task')

// =============================================================================
// 5) TEARDOWN
// =============================================================================
console.log('\n=== 5) teardown ===')
console.log(`  remaining schedule tasks: ${schedule.list().length}`)
console.log(`  remaining orchestrations: ${orchestration.list().length}`)

cyre.shutdown()
