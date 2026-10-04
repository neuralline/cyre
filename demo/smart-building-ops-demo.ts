// demo/smart-building-ops-demo.ts
// A single realistic scenario - "Aurora Tower", a 40-floor smart office
// building - run through as much of cyre's surface as fits naturally into
// one operations story, rather than isolated feature-by-feature checks:
//
// - channel protections: schema (src/schema/cyre-schema.ts), throttle,
//   debounce, detectChanges, condition, transform, priority - each used
//   where it would genuinely belong in a real building's event pipeline,
//   not as a forced feature checklist
// - schedule.task()/.daily() (src/components/cyre-schedule.ts) - a live
//   sensor sweep on a short interval (via trigger.function, not
//   trigger.channels - the sweep generates its own readings) and a
//   calendar-correct daily report trigger
// - orchestration.keep()/.activate() (src/orchestration/orchestration-engine.ts) -
//   two workflows: a channel-triggered "climate-control" loop that fires on
//   every temperature reading, and an "incident-response" workflow with a
//   parallel lockdown step, triggered by a single security event
// - cyre.lock()/pause(id)/resume(id) - registration happens up front, then
//   the system locks (this project's own demo convention) before any live
//   traffic; mid-scenario, a "maintenance window" pauses the sensor sweep
//   by its bare task id and resumes it later - exercising the
//   schedule.pause()/resume() delegation added in app.ts's pause()/resume()
// - cyre.getMetrics() (system-wide AND per-channel) plus
//   hasChanged()/getPrevious() - a live ops dashboard printout
// - cyre.reset()/shutdown() - full teardown, including the schedule/
//   orchestration cleanup those now do internally
//
// Design choice worth calling out: "should the HVAC only run when it's hot"
// is decided by hvac/adjust's own `condition` field, not by an
// orchestration-level condition step - the workflow triggers unconditionally
// on every reading (that's realistic: check on every update), and the
// channel itself decides whether the reading is actually worth acting on.
// Business logic stays in the channel; the orchestration is only "when".

import {cyre, log} from '../src'
import {schema} from '../src/schema/cyre-schema'

const schedule = cyre.schedule
const orchestration = cyre.orchestration

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

console.log('\n🏢 AURORA TOWER — Smart Building Operations Center')
console.log(
  '   40 floors · live sensor grid · automated climate + security response\n'
)

await cyre.init()

// =============================================================================
// 0) REGISTER CHANNELS  →  the building's actual event surface. Registered
//    fully before anything is locked, per this project's own convention.
// =============================================================================
console.log("=== 0) wiring the building's sensor grid and actuators ===")

// Temperature: throttled (a real sensor can report far faster than anyone
// needs to react), and only worth reacting to when it actually changed.
cyre.action({
  id: 'sensors/temperature',
  throttle: 500,
  detectChanges: true,
  schema: schema.number().min(-40).max(60)
})
let tempReadings = 0
cyre.on('sensors/temperature', (celsius: number) => {
  tempReadings++
  log.debug(`  🌡️  floor sweep reading #${tempReadings}: ${celsius}°C`)
  return {celsius}
})

// Motion: bursty by nature (someone walking past trips it repeatedly) -
// debounce collapses a burst into one settle-of-motion event.
cyre.action({id: 'sensors/motion', debounce: 250})
let motionEvents = 0
cyre.on('sensors/motion', (payload: {zone: string}) => {
  motionEvents++
  log.debug(`  🚶 motion settled in ${payload.zone} (event #${motionEvents})`)
  return {zone: payload.zone}
})

// Occupancy: transform derives the percentage the rest of the system
// actually cares about, condition guards against a nonsensical reading, and
// detectChanges means a flat occupancy count doesn't re-trigger downstream
// work every time the same headcount is reported again.
cyre.action({
  id: 'sensors/occupancy',
  condition: (payload: {count: number; capacity: number}) =>
    payload.count >= 0 && payload.count <= payload.capacity,
  transform: (payload: {count: number; capacity: number}) => ({
    ...payload,
    pct: Math.round((payload.count / payload.capacity) * 100)
  }),
  detectChanges: true
})
cyre.on(
  'sensors/occupancy',
  (payload: {count: number; capacity: number; pct: number}) => {
    log.debug(
      `  👥 lobby occupancy: ${payload.count}/${payload.capacity} (${payload.pct}%)`
    )
    return payload
  }
)

// HVAC: throttled so the orchestration below can fire on every reading
// without spamming the actual actuator, and condition is what actually
// decides whether a reading is worth cooling for - see the header comment.
const HOT_THRESHOLD_C = 26
// hvac/adjust is triggered by climate-control's workflow with the trigger's
// raw payload (context.trigger.payload) - and since sensors/temperature's
// payload IS the plain celsius number (not an object), this channel is
// written to receive that same number directly, unwrapped.
cyre.action({
  id: 'hvac/adjust',
  throttle: 1000,
  condition: (celsius: number) => celsius > HOT_THRESHOLD_C
})
let hvacAdjustments = 0
cyre.on('hvac/adjust', (celsius: number) => {
  hvacAdjustments++
  log.debug(
    `  ❄️  HVAC: cooling engaged (${celsius}°C > ${HOT_THRESHOLD_C}°C threshold)`
  )
  return {cooling: true}
})

// Security: a panic-button-style event. priority: critical is what would
// let this keep flowing even if the system were in recuperation mode from
// system stress elsewhere - not exercised live here, just wired correctly.
cyre.action({
  id: 'security/breach',
  priority: {level: 'critical'},
  schema: schema.object({
    zone: schema.string().minLength(1),
    severity: schema.enums('low', 'medium', 'high')
  })
})

cyre.action({id: 'access/lock-doors'})
cyre.on('access/lock-doors', (payload: any) => {
  log.debug(`  🔒 doors locked - zone: ${payload.zone}`)
  return {locked: true}
})

cyre.action({id: 'access/notify-guard'})
cyre.on('access/notify-guard', (payload: any) => {
  log.debug(
    `  📟 guard notified - zone: ${payload.zone}, severity: ${payload.severity}`
  )
  return {notified: true}
})

cyre.action({id: 'access/log-event'})
let incidentLog: any[] = []
cyre.on('access/log-event', (payload: any) => {
  incidentLog.push({...payload, at: Date.now()})
  log.debug(`  📋 incident logged (total on record: ${incidentLog.length})`)
  return {logged: true}
})

cyre.action({id: 'facilities/report'})
cyre.on('facilities/report', () => {
  log.debug('  📰 daily facilities report sent')
  return {sent: true}
})

console.log(
  '  9 channels registered: sensors/*, hvac/adjust, security/breach, access/*, facilities/report'
)

// =============================================================================
// 1) ORCHESTRATIONS  →  "when", wired on top of the channels above
// =============================================================================
console.log('\n=== 1) wiring orchestrations ===')

orchestration.keep({
  id: 'climate-control',
  triggers: [
    {name: 'temp-reading', type: 'channel', channels: 'sensors/temperature'}
  ],
  workflow: [{name: 'consider-cooling', type: 'action', targets: 'hvac/adjust'}]
})
orchestration.activate('climate-control', true)
console.log(
  '  climate-control: fires on every sensors/temperature reading, hvac/adjust decides for itself'
)

orchestration.keep({
  id: 'incident-response',
  triggers: [
    {name: 'breach-detected', type: 'channel', channels: 'security/breach'}
  ],
  workflow: [
    {
      name: 'lockdown',
      type: 'parallel',
      steps: [
        {name: 'lock-doors', type: 'action', targets: 'access/lock-doors'},
        {name: 'notify-guard', type: 'action', targets: 'access/notify-guard'}
      ]
    },
    {name: 'log', type: 'action', targets: 'access/log-event'}
  ]
})
orchestration.activate('incident-response', true)
console.log(
  '  incident-response: lock doors + notify guard in parallel, then log - triggered by security/breach'
)

// =============================================================================
// 2) SCHEDULE  →  the building's own clock, independent of anything live
// =============================================================================
console.log('\n=== 2) wiring the schedule ===')

let sweepTick = 0
schedule.task({
  id: 'sensor-sweep',
  triggers: [
    {
      interval: 300,
      repeat: true,
      function: async () => {
        sweepTick++
        // A slow drift toward a warm afternoon, with sensor noise on top -
        // guarantees we cross HOT_THRESHOLD_C at least once during the demo.
        const drift = 22 + sweepTick * 0.6
        const noise = Math.random() * 2 - 1
        const celsius = Math.round((drift + noise) * 10) / 10
        await cyre.call('sensors/temperature', celsius)
        return {celsius}
      }
    }
  ]
})
console.log(
  '  sensor-sweep: a temperature reading every 300ms (via trigger.function, not a static payload)'
)

schedule.daily('09:00', {
  id: 'daily-facilities-report',
  channels: ['facilities/report'],
  timezone: 'UTC'
})
console.log(
  "  daily-facilities-report: real calendar-correct 09:00 UTC trigger (won't fire during this demo)"
)

// =============================================================================
// 3) LOCK  →  registration is done; nothing new gets added to the building
//    from here on, same convention this project's other demos already use
// =============================================================================
console.log('\n=== 3) locking the system - operations begin ===')
cyre.lock()
const blockedRegistration = cyre.action({id: 'sensors/pressure'})
console.log(
  blockedRegistration.ok === false
    ? '✅ a new channel registration is correctly refused once locked'
    : '❌ registration should have been blocked'
)

// =============================================================================
// 4) LIVE TRAFFIC
// =============================================================================
console.log('\n=== 4) a day in the life ===')

console.log(
  '\n--- throttle: 5 rapid temperature pings inside the 500ms window ---'
)
let throttledCount = 0
for (let i = 0; i < 5; i++) {
  const result = await cyre.call('sensors/temperature', 24 + i)
  if (!result.ok) throttledCount++
  console.log(
    `  ping ${i + 1}: ok:${result.ok}${result.message ? ` - ${result.message}` : ''}`
  )
}
console.log(
  throttledCount === 4
    ? '✅ the first ping went through, the next 4 within the 500ms window were throttled'
    : `❌ expected 4 throttled pings, got ${throttledCount}`
)

console.log('\n--- debounce: 5 rapid motion pings in the lobby ---')
const motionBefore = motionEvents
for (let i = 0; i < 5; i++) {
  await cyre.call('sensors/motion', {zone: 'lobby'})
  await wait(40)
}
await wait(500) // let the debounce window settle, with margin
console.log(
  motionEvents === motionBefore + 1
    ? `✅ 5 rapid pings collapsed into ${motionEvents - motionBefore} settled motion event`
    : `❌ expected exactly 1 settled event, got ${motionEvents - motionBefore}`
)

console.log(
  '\n--- occupancy: a bad reading is rejected, a good one goes through ---'
)
const badOccupancy = await cyre.call('sensors/occupancy', {
  count: 999,
  capacity: 50
})
console.log(`  count:999/capacity:50 (impossible) -> ok:${badOccupancy.ok}`)
await cyre.call('sensors/occupancy', {count: 31, capacity: 50})

console.log(
  '\n--- sensor-sweep running: climate-control reacts as the floor warms up ---'
)
const hvacBefore = hvacAdjustments
await wait(2400) // ~8 sweep ticks - drifts past HOT_THRESHOLD_C partway through
console.log(
  hvacAdjustments > hvacBefore
    ? `✅ HVAC engaged ${hvacAdjustments - hvacBefore} time(s) once readings crossed ${HOT_THRESHOLD_C}°C`
    : '❌ expected at least one HVAC adjustment as the floor warmed up'
)

console.log(
  '\n--- maintenance window: pausing the sensor sweep by its bare task id ---'
)
const tickBeforePause = sweepTick
cyre.pause('sensor-sweep') // NOT 'sensor-sweep-trigger-0' - the delegation handles that
await wait(900)
const tickDuringPause = sweepTick
cyre.resume('sensor-sweep')
await wait(900)
const tickAfterResume = sweepTick
console.log(
  `  sweep ticks - before:${tickBeforePause} during pause:${tickDuringPause - tickBeforePause} after resume:${tickAfterResume - tickDuringPause}`
)
console.log(
  tickDuringPause === tickBeforePause && tickAfterResume > tickDuringPause
    ? "✅ cyre.pause('sensor-sweep')/resume('sensor-sweep') correctly froze and restarted the sweep"
    : '❌ the maintenance window did not actually pause/resume the sweep'
)

console.log('\n--- security incident: a panic-button event on floor 12 ---')
const logBefore = incidentLog.length
await cyre.call('security/breach', {zone: 'floor-12-east', severity: 'high'})
await wait(100) // workflow steps are async - give the parallel lockdown a beat to settle
console.log(
  incidentLog.length === logBefore + 1
    ? '✅ incident-response ran the parallel lockdown (lock-doors + notify-guard) then logged it'
    : '❌ incident-response did not complete as expected'
)

// =============================================================================
// 5) OPS DASHBOARD  →  cyre.getMetrics() system-wide and per-channel,
//    hasChanged()/getPrevious()
// =============================================================================
console.log('\n=== 5) ops dashboard ===')

const systemMetrics = cyre.getMetrics() as any
console.log(
  `  channels:${systemMetrics.stores.channels} scheduledTasks:${systemMetrics.stores.scheduledTasks} orchestrations:${systemMetrics.stores.orchestrations}`
)
console.log(
  `  system stress: ${(systemMetrics.system.stress.combined * 100).toFixed(1)}%  breathing rate: ${systemMetrics.system.breathing.currentRate.toFixed(0)}ms`
)

const tempMetrics = cyre.getMetrics('sensors/temperature') as any
console.log(
  `  sensors/temperature: ${tempMetrics.executionCount} execution(s), last ${tempMetrics.lastExecutionTime ? new Date(tempMetrics.lastExecutionTime).toISOString() : 'n/a'}`
)

const lastKnownTemp = cyre.getPrevious('sensors/temperature')
console.log(`  last known temperature on record: ${lastKnownTemp}°C`)
console.log(
  `  would a fresh 99°C reading count as changed? ${cyre.hasChanged('sensors/temperature', 99)}`
)

// =============================================================================
// 6) TEARDOWN
// =============================================================================
console.log('\n=== 6) end of shift - shutting the building down ===')
schedule.cancel('sensor-sweep')
schedule.cancel('daily-facilities-report')
orchestration.forget('climate-control')
orchestration.forget('incident-response')
console.log(`  remaining schedule tasks: ${schedule.list().length}`)
console.log(`  remaining orchestrations: ${orchestration.list().length}`)
console.log(
  `  total temperature readings this session: ${tempReadings}, HVAC adjustments: ${hvacAdjustments}, incidents logged: ${incidentLog.length}`
)

cyre.shutdown()
