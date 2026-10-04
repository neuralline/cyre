// demo/orchestration-scheduling-demo.ts
// timekeeper-limits-demo.ts already stress-tests raw TimeKeeper directly
// (drift, long intervals, concurrent timers, pause/resume, finite repeat,
// error resilience) - this file doesn't repeat any of that. It instead
// covers the layer built ON TOP of TimeKeeper that nothing else in the
// project touches: cyre.orchestration (src/orchestration/orchestration-engine.ts,
// attached to the public cyre object but not documented in the README's own
// examples beyond a one-line teaser). Real API, read directly from source
// rather than guessed: orchestration.keep(config) registers, .activate(id,
// bool) turns its triggers on/off (the actual recurring-schedule mechanism,
// built on TimeKeeper.keep() under the hood for `type: 'time'` triggers),
// .call(id, payload) runs its workflow/actions immediately regardless of
// triggers (like cyre.call), .get()/.list()/.getStatus()/
// .getSystemOverview() introspect it, and .forget() tears it down.
//
// `type: 'channel'` and `type: 'condition'` triggers were once TODOs/no-ops
// in this engine - both are now implemented (see the analysis doc's
// Update 11): `channel` subscribes to its target channel(s) once at
// keep()-time via a real cyre.on()-style handler and toggles on/off via
// runtime.status rather than re-subscribing; `condition` polls its
// predicate through the same TimeKeeper.keep() mechanism `time` triggers
// use, defaulting to a 1000ms poll interval when the trigger doesn't set
// its own `interval`. Every ✅/❌/ℹ️ line below self-reports what actually
// happened rather than asserting that ahead of time, same as the rest of
// this project's demos.
import {cyre, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 0) REGISTER EVERY REAL CHANNEL + EVERY ORCHESTRATION THIS DEMO USES  →  all
//    up front. orchestration.keep() is now gated by cyre.lock() the same way
//    cyre.action/.on are (see the analysis doc's Update 9), so - same as the
//    plain cyre.action/.on channels below - it has to happen before lock()
//    too, not just alongside it.
// =============================================================================
console.log('\n=== 0) registering channels + orchestrations ===')

let heartbeatCount = 0
cyre.action({id: 'log/event'})
cyre.on('log/event', (payload: any) => {
  heartbeatCount++
  log.debug(`  💓 log/event #${heartbeatCount}: ${JSON.stringify(payload)}`)
  return {logged: true, count: heartbeatCount}
})

let opsNotifyCount = 0
cyre.action({id: 'notify/ops'})
cyre.on('notify/ops', (payload: any) => {
  opsNotifyCount++
  log.debug(`  📣 notify/ops #${opsNotifyCount}: ${JSON.stringify(payload)}`)
  return {notified: true}
})

cyre.action({id: 'metrics/snapshot'})
cyre.on('metrics/snapshot', () => {
  return {timestamp: Date.now(), sample: Math.round(Math.random() * 100)}
})

// A) time-triggered orchestration - the actual recurring-schedule case.
cyre.orchestration.keep({
  id: 'heartbeat-check',
  triggers: [{name: 'every-tick', type: 'time', interval: 200}],
  workflow: [
    {
      name: 'log-tick',
      type: 'action',
      targets: 'log/event',
      payload: (ctx: any) => ctx.trigger
    }
  ]
})

// B) a multi-step workflow, run manually via .call() rather than on a timer
// - action -> delay -> condition(passes) -> parallel -> sequential -> loop.
cyre.orchestration.keep({
  id: 'deploy-workflow',
  triggers: [{name: 'manual', type: 'external'}],
  workflow: [
    {
      name: 'announce',
      type: 'action',
      targets: 'log/event',
      payload: {phase: 'starting'}
    },
    {name: 'settle', type: 'delay', timeout: 100},
    {name: 'gate', type: 'condition', condition: () => true},
    {
      name: 'fan-out',
      type: 'parallel',
      steps: [
        {
          name: 'notify-a',
          type: 'action',
          targets: 'notify/ops',
          payload: {who: 'team-a'}
        },
        {
          name: 'notify-b',
          type: 'action',
          targets: 'notify/ops',
          payload: {who: 'team-b'}
        }
      ]
    },
    {
      name: 'finish-up',
      type: 'sequential',
      steps: [
        {name: 'snapshot', type: 'action', targets: 'metrics/snapshot'},
        {
          name: 'announce-done',
          type: 'action',
          targets: 'log/event',
          payload: {phase: 'done'}
        }
      ]
    },
    {
      name: 'sample-loop',
      type: 'loop',
      steps: [{name: 'sample', type: 'action', targets: 'metrics/snapshot'}]
    }
  ]
})

// C) a workflow that deliberately fails its condition step with onError:
// 'abort' - the step right after it should never run.
cyre.orchestration.keep({
  id: 'safety-abort',
  triggers: [{name: 'manual', type: 'external'}],
  workflow: [
    {
      name: 'pre-check',
      type: 'condition',
      condition: () => false,
      onError: 'abort'
    },
    {
      name: 'should-never-run',
      type: 'action',
      targets: 'log/event',
      payload: {shouldNotHappen: true}
    }
  ]
})

// D) `actions` instead of `workflow` - the OTHER execution path
// (executeOrchestrationAction), fanning a single call out to two targets.
cyre.orchestration.keep({
  id: 'action-list-only',
  triggers: [{name: 'manual', type: 'external'}],
  actions: [
    {
      action: 'notify-both',
      targets: ['notify/ops', 'log/event'],
      payload: {broadcast: true}
    }
  ]
})

// E) the two trigger types that USED to be TODOs/no-ops - registered so
// section 5 can confirm, from the outside, that they now genuinely work.
// condition-trigger-demo sets an explicit 100ms `interval` (rather than
// relying on the 1000ms default) so this demo doesn't have to wait a full
// second to observe a poll tick.
cyre.orchestration.keep({
  id: 'channel-trigger-demo',
  triggers: [{name: 'on-notify', type: 'channel', channels: 'notify/ops'}],
  workflow: [
    {
      name: 'react',
      type: 'action',
      targets: 'log/event',
      payload: {via: 'channel-trigger'}
    }
  ]
})
cyre.orchestration.keep({
  id: 'condition-trigger-demo',
  triggers: [
    {name: 'poll', type: 'condition', condition: () => true, interval: 100}
  ],
  workflow: [
    {
      name: 'react',
      type: 'action',
      targets: 'log/event',
      payload: {via: 'condition-trigger'}
    }
  ]
})

console.log(`  registered ${cyre.orchestration.list().length} orchestrations`)

// Every channel and every orchestration this demo will ever touch is
// registered by this point - lock() here, before any of the operations
// below, is what actually prevents a stray late cyre.action()/cyre.on()
// registration or a duplicate handler from slipping in unnoticed. This now
// includes cyre.orchestration.keep() itself (Update 9's fix), and also
// covers channel-trigger-demo's real cyre.on() subscription, which happens
// synchronously inside keep() above - not deferred to activate() below.
cyre.lock()

// =============================================================================
// 1) TIME-TRIGGERED SCHEDULING  →  activate() wires a `type: 'time'` trigger
//    to TimeKeeper.keep() under the hood - this is real recurring task
//    scheduling, not a simulated one, running through the same engine
//    timekeeper-limits-demo.ts stress-tests directly.
// =============================================================================
console.log(
  '\n=== 1) heartbeat-check: activate() schedules a real 200ms interval ==='
)

const activateResult = cyre.orchestration.activate('heartbeat-check', true)
console.log(
  `  activate(true) -> ok:${activateResult.ok} - ${activateResult.message}`
)

await wait(950) // ~4-5 ticks at 200ms
const ticksWhileActive = heartbeatCount
console.log(`  log/event fired ${ticksWhileActive} time(s) while active`)

const deactivateResult = cyre.orchestration.activate('heartbeat-check', false)
console.log(
  `  activate(false) -> ok:${deactivateResult.ok} - ${deactivateResult.message}`
)

await wait(500) // long enough that more ticks WOULD have landed if still active
const ticksAfterDeactivate = heartbeatCount
console.log(
  `  log/event count after deactivating: ${ticksAfterDeactivate} (was ${ticksWhileActive})`
)

console.log(
  ticksWhileActive >= 3 && ticksAfterDeactivate === ticksWhileActive
    ? '✅ the time trigger fired repeatedly while active and stopped cleanly on activate(false)'
    : `❌ expected several ticks then a clean stop, got ${ticksWhileActive} then ${ticksAfterDeactivate}`
)

// =============================================================================
// 2) MULTI-STEP WORKFLOW, RUN MANUALLY  →  orchestration.call() executes the
//    workflow immediately regardless of triggers, same as cyre.call() does
//    for a plain channel - action, delay, passing condition, parallel,
//    sequential, and loop all in one workflow.
// =============================================================================
console.log(
  '\n=== 2) deploy-workflow: action -> delay -> condition -> parallel -> sequential -> loop ==='
)

const beforeOpsCount = opsNotifyCount
const deployResult = await cyre.orchestration.call('deploy-workflow', {
  trigger: 'manual-run'
})
console.log(`  call() -> ok:${deployResult.ok} - ${deployResult.message}`)
console.log(
  `  notify/ops fired ${opsNotifyCount - beforeOpsCount} time(s) during the parallel step (expected 2)`
)

const loopResult = deployResult.result?.[5] // 6th step in the workflow array, 0-indexed
console.log(`  loop step result: ${JSON.stringify(loopResult)}`)
console.log(
  opsNotifyCount - beforeOpsCount === 2 &&
    Array.isArray(loopResult) &&
    loopResult.length === 3
    ? 'ℹ️  the loop step ran exactly 3 iterations regardless of anything in this config - `iterations` is ' +
        "hardcoded in executeWorkflowSteps's 'loop' case (`const iterations = 3 // Default iterations`), " +
        'not read from the step config despite WorkflowStep looking like it should support configurable looping'
    : '❌ the multi-step workflow did not execute as expected'
)

// =============================================================================
// 3) ABORT ON A FAILED CONDITION  →  onError: 'abort' should stop the
//    workflow at that step - the step after it must never run.
// =============================================================================
console.log(
  '\n=== 3) safety-abort: a failing condition with onError: "abort" ==='
)

const beforeAbortLogCount = heartbeatCount
const abortResult = await cyre.orchestration.call('safety-abort')
console.log(`  call() -> ok:${abortResult.ok} - ${abortResult.message}`)
console.log(
  `  log/event fired ${heartbeatCount - beforeAbortLogCount} more time(s) (expected 0 - abort should have pre-empted it)`
)

console.log(
  !abortResult.ok && heartbeatCount === beforeAbortLogCount
    ? '✅ the failing condition aborted the workflow before the next step ever ran'
    : '❌ the workflow continued (or reported success) past a step that should have aborted it'
)

// =============================================================================
// 4) `actions` INSTEAD OF `workflow`  →  the other execution path
//    (executeOrchestrationAction), fanning one call out to multiple targets
// =============================================================================
console.log(
  '\n=== 4) action-list-only: config.actions, not config.workflow ==='
)

const beforeActionsOps = opsNotifyCount
const beforeActionsLog = heartbeatCount
const actionsResult = await cyre.orchestration.call('action-list-only')
console.log(
  `  call() -> ok:${actionsResult.ok}, result: ${JSON.stringify(actionsResult.result)}`
)

console.log(
  actionsResult.ok &&
    opsNotifyCount === beforeActionsOps + 1 &&
    heartbeatCount === beforeActionsLog + 1
    ? '✅ a single actions-list entry with 2 targets fanned out to both channels'
    : '❌ the actions-only execution path did not reach both targets'
)

// =============================================================================
// 5) CHANNEL + CONDITION TRIGGERS  →  both used to be inert TODOs; both are
//    now real. channel-trigger-demo should react the moment notify/ops is
//    called directly (no timer involved at all - a genuine cyre.on()
//    subscription). condition-trigger-demo should react on its own, polling
//    every 100ms, with no external call needed. Both should also correctly
//    stop reacting once deactivated.
// =============================================================================
console.log(
  '\n=== 5) channel-trigger / condition-trigger: do they actually fire now? ==='
)

const channelActivate = cyre.orchestration.activate(
  'channel-trigger-demo',
  true
)
const conditionActivate = cyre.orchestration.activate(
  'condition-trigger-demo',
  true
)
console.log(`  channel-trigger activate() -> ${channelActivate.message}`)
console.log(`  condition-trigger activate() -> ${conditionActivate.message}`)

const channelStatus = cyre.orchestration.getStatus('channel-trigger-demo')
const conditionStatus = cyre.orchestration.getStatus('condition-trigger-demo')
console.log(
  `  channel-trigger timeKeeperInfo: ${JSON.stringify(channelStatus?.timeKeeperInfo)}`
)
console.log(
  `  condition-trigger timeKeeperInfo: ${JSON.stringify(conditionStatus?.timeKeeperInfo)}`
)
console.log(
  channelStatus?.timeKeeperInfo.timerCount === 0
    ? 'ℹ️  channel-trigger correctly shows 0 TimeKeeper timers - it works via a real cyre.on() subscription, not a timer'
    : `❌ expected channel-trigger to have 0 TimeKeeper timers, got ${channelStatus?.timeKeeperInfo.timerCount}`
)
console.log(
  conditionStatus?.timeKeeperInfo.timerCount === 1
    ? '✅ condition-trigger now shows a real TimeKeeper timer (polling its condition every 100ms)'
    : `❌ expected condition-trigger to have exactly 1 TimeKeeper timer, got ${conditionStatus?.timeKeeperInfo.timerCount}`
)

// 5a) channel trigger: calling the exact channel it watches should fire it
const beforeChannelTest = heartbeatCount
await cyre.call('notify/ops', {directCall: true})
await wait(50)
console.log(
  `  log/event count after directly calling notify/ops: ${heartbeatCount} (was ${beforeChannelTest})`
)
console.log(
  heartbeatCount === beforeChannelTest + 1
    ? '✅ calling notify/ops directly fired the channel-triggered orchestration exactly once'
    : `❌ expected exactly 1 more log/event fire from the channel trigger, got ${heartbeatCount - beforeChannelTest}`
)

// 5b) condition trigger: should fire on its own within a couple of 100ms polls
const beforeConditionTest = heartbeatCount
await wait(250) // ~2 poll ticks at 100ms
console.log(
  `  log/event count after waiting for condition polling: ${heartbeatCount} (was ${beforeConditionTest})`
)
console.log(
  heartbeatCount > beforeConditionTest
    ? `✅ the condition trigger fired on its own ${heartbeatCount - beforeConditionTest} time(s) via polling, no external call needed`
    : '❌ the condition trigger never fired despite its condition always being true'
)

// 5c) deactivating should stop both from reacting further
cyre.orchestration.activate('channel-trigger-demo', false)
cyre.orchestration.activate('condition-trigger-demo', false)

const beforeDeactivatedTest = heartbeatCount
await cyre.call('notify/ops', {directCall: true, afterDeactivate: true})
await wait(250) // long enough for a condition poll tick too, if one were still happening
console.log(
  `  log/event count after deactivating both and calling notify/ops again: ${heartbeatCount} (was ${beforeDeactivatedTest})`
)
console.log(
  heartbeatCount === beforeDeactivatedTest
    ? '✅ both triggers stopped reacting once deactivated - channel trigger via runtime.status, condition trigger via TimeKeeper.forget()'
    : `❌ one of the triggers kept firing after deactivate(), log/event moved from ${beforeDeactivatedTest} to ${heartbeatCount}`
)

// =============================================================================
// 6) SYSTEM OVERVIEW
// =============================================================================
console.log('\n=== 6) orchestration system overview ===')
console.log(`  ${JSON.stringify(cyre.orchestration.getSystemOverview())}`)

// =============================================================================
// 7) TEARDOWN  →  forget() deactivates first if still running, then removes
//    the runtime entirely - and, for channel-trigger-demo, now also tears
//    down its real cyre.on() subscription (see forget()'s cleanup for
//    'channel' triggers). heartbeat-check/channel-trigger-demo/
//    condition-trigger-demo were already deactivated above, but forgetting
//    everything here is what actually guarantees no orchestration-owned
//    TimeKeeper timer or channel subscription is left behind before
//    shutdown.
// =============================================================================
console.log('\n=== 7) teardown ===')
for (const id of [
  'heartbeat-check',
  'deploy-workflow',
  'safety-abort',
  'action-list-only',
  'channel-trigger-demo',
  'condition-trigger-demo'
]) {
  const forgotten = cyre.orchestration.forget(id)
  console.log(`  forget('${id}') -> ${forgotten}`)
}
console.log(`  orchestrations remaining: ${cyre.orchestration.list().length}`)

// Every orchestration is forgotten above (which deactivates its TimeKeeper
// timers first if still running, and now also tears down channel-trigger
// subscriptions) and every timer/poller this demo ever activated
// (heartbeat-check, condition-trigger-demo) was already stopped above -
// nothing is left running, safe to end the process here.
cyre.shutdown()
