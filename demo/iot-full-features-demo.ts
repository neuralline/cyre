// demo/iot-full-features-demo.ts
// A smart-greenhouse system that deliberately reaches for a wide slice of
// Cyre's toolkit, each piece used where it's actually the right tool rather
// than just to show it off: branches for site isolation, the schema/
// transform/detectChanges/condition/selector pipeline for data hygiene,
// throttle/debounce+maxWait/buffer for protecting actuators and dashboards,
// TimeKeeper interval/delay/repeat + pause/resume for sensor polling and
// maintenance windows, useGroup for coordinating multiple zones, and the
// system-level getMetrics()/lock() for a final health snapshot.
import {cyre, useBranch, useGroup, log} from '../src'
import {schema} from '../src/schema/cyre-schema'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) SITE STRUCTURE  →  branches isolate each zone's channels from the others
// =============================================================================
console.log('\n=== 1) greenhouse layout: zone-a, zone-b, central ===')

const greenhouse = useBranch(cyre, {id: 'greenhouse'})
if (!greenhouse) throw new Error('failed to create greenhouse branch')

const zoneA = useBranch(greenhouse, {id: 'zone-a'})
const zoneB = useBranch(greenhouse, {id: 'zone-b'})
const central = useBranch(greenhouse, {id: 'central'})
if (!zoneA || !zoneB || !central)
  throw new Error('failed to create zone branches')

console.log(`  ${zoneA.path()}, ${zoneB.path()}, ${central.path()}`)

const HIGH_TEMP_C = 30
const zones = [
  {name: 'zone-a', branch: zoneA, lastReading: null as any},
  {name: 'zone-b', branch: zoneB, lastReading: null as any}
]

// =============================================================================
// 2) VALIDATED TELEMETRY INGESTION  →  schema -> transform -> detectChanges
//
// Each zone's "ingest" channel validates the sensor frame's shape, stamps a
// receive time, and skips re-dispatching identical back-to-back readings -
// a real sensor free-running at a fixed poll rate reports the same value far
// more often than it reports a change. Readings over the high-temp
// threshold escalate to the central alarm channel (built in section 5).
// =============================================================================
console.log(
  '\n=== 2) telemetry ingestion: schema -> transform -> detectChanges ==='
)

let zoneADispatches = 0
let zoneBDispatches = 0

for (const zone of zones) {
  zone.branch.action({
    id: 'ingest',
    // schema -> detectChanges -> transform: dedupe happens BEFORE the
    // payload gets a fresh receivedAt timestamp stamped onto it. Getting
    // this order backwards (transform first) means detectChanges would be
    // comparing a payload that's already different on every single call
    // (the timestamp always changes), silently defeating the dedup.
    schema: schema.object({
      temp: schema.number(),
      humidity: schema.number(),
      soilMoisture: schema.number()
    }),
    detectChanges: true,
    transform: (payload: any) => ({...payload, receivedAt: Date.now()})
  })

  zone.branch.on('ingest', (reading: any) => {
    if (zone.name === 'zone-a') zoneADispatches++
    else zoneBDispatches++
    zone.lastReading = reading
    log.debug(
      `  🌱 [${zone.name}] temp=${reading.temp}°C humidity=${reading.humidity}% soil=${reading.soilMoisture}%`
    )

    if (reading.temp > HIGH_TEMP_C) {
      // Would escalate to central's "alerts" channel here via an absolute
      // cross-branch path (factory-a/floor-2-style, see the branches demo) -
      // that channel is built and exercised on its own in section 5 below,
      // which re-fires equivalent hot readings so it stays runnable/
      // verifiable independent of section ordering.
      log.debug(
        `  ⬆️  [${zone.name}] would escalate to central/alerts (temp ${reading.temp}°C > ${HIGH_TEMP_C}°C)`
      )
    }
  })
}

// Simulated sensor frames: zone-a repeats a value (should dedupe), then
// changes, then spikes hot; zone-b spikes hot twice in the same window.
const zoneAFrames = [
  {temp: 22.0, humidity: 55, soilMoisture: 40},
  {temp: 22.0, humidity: 55, soilMoisture: 40}, // identical - detectChanges should block this one
  {temp: 24.5, humidity: 53, soilMoisture: 38},
  {temp: 33.0, humidity: 50, soilMoisture: 35} // hot - should escalate
]
const zoneBFrames = [
  {temp: 21.0, humidity: 60, soilMoisture: 45},
  {temp: 36.0, humidity: 58, soilMoisture: 44}, // hot - should escalate
  {temp: 37.5, humidity: 57, soilMoisture: 43} // still hot - should escalate again
]

for (const frame of zoneAFrames) await zoneA.call('ingest', frame)
for (const frame of zoneBFrames) await zoneB.call('ingest', frame)

console.log(
  zoneADispatches === 3 && zoneBDispatches === 3
    ? `✅ dedup worked: zone-a dispatched 3/${zoneAFrames.length} frames, zone-b dispatched all ${zoneBFrames.length}`
    : `❌ expected 3 zone-a / 3 zone-b dispatches, got ${zoneADispatches} / ${zoneBDispatches}`
)

// =============================================================================
// 3) PROTECTED ACTUATOR  →  throttle
//
// The irrigation valve is a physical relay - rapid-fire toggling would wear
// it out fast, so it's rate-limited independently of anything the dashboard
// or an automation rule tries to do to it.
// =============================================================================
console.log('\n=== 3) irrigation valve: throttled to one toggle per 800ms ===')
{
  let toggles = 0
  zoneA.action({id: 'irrigation-valve', throttle: 800})
  zoneA.on('irrigation-valve', (open: boolean) => {
    toggles++
    log.debug(`  🚿 [zone-a] valve ${open ? 'OPEN' : 'CLOSED'}`)
  })

  const attempts = [true, false, true, false, true] // fired back-to-back
  const results = []
  for (const open of attempts) {
    results.push((await zoneA.call('irrigation-valve', open)).ok)
    await wait(50) // much faster than the 800ms throttle window
  }

  console.log(
    `  ${results.filter(Boolean).length}/${attempts.length} toggle attempts got through immediately`
  )
  console.log(
    toggles === 1 && results.filter(Boolean).length === 1
      ? '✅ throttle let the first toggle through and rejected the rapid-fire rest'
      : `❌ expected exactly 1 toggle to succeed, got ${toggles}`
  )
}

// =============================================================================
// 4) DASHBOARD CONTROL  →  debounce + maxWait + condition
//
// A user dragging a target-temperature slider fires a call per pixel of
// drag. debounce collapses that into one update after they stop moving it -
// but maxWait guarantees a save happens periodically even if they never
// stop (e.g. an automated ramp), and condition rejects anything outside the
// greenhouse's safe operating range regardless of how it got there.
// =============================================================================
console.log(
  '\n=== 4) target-temperature dashboard: debounce + maxWait + condition ==='
)
{
  let applied: number[] = []
  central.action({
    id: 'target-temperature',
    debounce: 250,
    maxWait: 700,
    condition: (value: number) => value >= 10 && value <= 35
  })
  central.on('target-temperature', (value: number) => {
    applied.push(value)
    log.debug(`  🎛️  target temperature applied: ${value}°C`)
  })

  console.log('  dragging slider continuously (never pausing 250ms)...')
  for (let v = 20; v <= 26; v++) {
    await central.call('target-temperature', v)
    await wait(150) // faster than debounce - maxWait has to force a save
  }
  await wait(400) // let the final debounced value settle

  console.log(`  applied values: [${applied.join(', ')}]`)
  console.log(
    applied.length > 1 && applied[applied.length - 1] === 26
      ? '✅ maxWait forced intermediate saves during continuous dragging, final value stuck'
      : '❌ expected multiple applied values ending in 26'
  )

  const rejected = await central.call('target-temperature', 50) // out of range
  await wait(400)
  console.log(
    !applied.includes(50)
      ? '✅ out-of-range target rejected by condition, never applied'
      : '❌ an out-of-range target was applied'
  )
}

// =============================================================================
// 5) GROUPED ALERTS  →  buffer(append) + selector
//
// buffer/debounce/throttle run BEFORE the schema/condition/selector/
// transform pipeline (they're protections, not processing talents) - so
// what accumulates in the buffer window is the raw alarm payload. When the
// window closes, selector strips each buffered event down to just the
// fields the on-call summary actually needs, discarding device metadata
// noise that hitched a ride on every event.
// =============================================================================
console.log('\n=== 5) alert aggregation: buffer(append) -> selector ===')
{
  let batches: any[] = []
  central.action({
    id: 'alerts',
    buffer: {window: 900, strategy: 'append'},
    selector: (events: any[]) =>
      events.map(e => ({zone: e.zone, temp: e.temp, level: e.level}))
  })
  central.on('alerts', (summary: any) => {
    batches.push(summary)
    log.debug(`  🚨 alert batch: ${JSON.stringify(summary)}`)
  })

  // Re-fire the same hot readings from section 2 directly, so this section
  // is runnable/verifiable on its own
  await central.call('alerts', {
    zone: 'zone-a',
    temp: 33.0,
    level: 'warning',
    deviceMeta: {firmware: '2.3.1'}
  })
  await central.call('alerts', {
    zone: 'zone-b',
    temp: 36.0,
    level: 'warning',
    deviceMeta: {firmware: '2.3.1'}
  })
  await central.call('alerts', {
    zone: 'zone-b',
    temp: 37.5,
    level: 'critical',
    deviceMeta: {firmware: '2.3.1'}
  })
  await wait(1000)

  const stripped = batches[0]
  console.log(
    batches.length === 1 &&
      stripped?.length === 3 &&
      stripped.every((e: any) => !('deviceMeta' in e))
      ? '✅ 3 alerts collapsed into 1 batch, selector stripped device metadata from each'
      : '❌ alert batching or field-selection did not behave as expected'
  )
}

// =============================================================================
// 6) CALIBRATION DELAY + MAINTENANCE WINDOW  →  delay/interval/repeat, pause/resume
//
// Sensors need a warm-up before their first reading is trustworthy (delay),
// then poll continuously (interval + repeat: true). Taking a zone offline
// for physical maintenance is just cyre.pause(id) on its polling channel -
// no separate "enabled" flag to manage.
// =============================================================================
console.log(
  '\n=== 6) zone-a polling: delay warm-up -> interval polling -> maintenance pause ==='
)
{
  let polls = 0
  const pollId = `${zoneA.path()}/auto-poll`

  zoneA.action({id: 'auto-poll', delay: 300, interval: 250, repeat: true})
  zoneA.on('auto-poll', () => {
    polls++
    log.debug(`  📟 [zone-a] auto-poll tick #${polls}`)
  })

  await zoneA.call('auto-poll')
  await wait(300 + 250 * 2 + 100) // warm-up + a couple of ticks

  const beforePause = polls
  cyre.pause(pollId)
  console.log(
    `  ${beforePause} polls before maintenance window - pausing for 500ms`
  )
  await wait(500)
  const duringPause = polls

  cyre.resume(pollId)
  await wait(250 * 2 + 100)
  const afterResume = polls
  zoneA.forget('auto-poll')

  console.log(
    duringPause === beforePause && afterResume > duringPause
      ? '✅ zero polls during the maintenance window, polling resumed correctly after'
      : '❌ pause/resume did not behave as expected for the polling timer'
  )
}

// =============================================================================
// 7) MULTI-ZONE COORDINATION  →  useGroup (parallel health-check, sequential startup)
// =============================================================================
console.log('\n=== 7) useGroup: parallel health-check, sequential startup ===')
{
  for (const zone of zones) {
    zone.branch.action({id: 'status'})
    zone.branch.on('status', () => ({
      zone: zone.name,
      ok: true,
      lastTemp: zone.lastReading?.temp ?? null
    }))

    zone.branch.action({id: 'calibrate', delay: 100})
    zone.branch.on('calibrate', () => {
      log.debug(`  🔧 [${zone.name}] calibration complete`)
      return {calibrated: true}
    })
  }

  const healthGroup = useGroup(
    zones.map(z => ({
      id: `${z.name}-status`,
      call: (p: any) => z.branch.call('status', p)
    })),
    {strategy: 'parallel', errorStrategy: 'continue', timeout: 2000}
  )
  const healthResult = await healthGroup.call()
  console.log(
    `  parallel health-check: ${healthResult.metadata?.successful}/${healthResult.metadata?.channelCount} zones healthy`
  )

  const startupOrder: string[] = []
  const startupGroup = useGroup(
    zones.map(z => ({
      id: `${z.name}-calibrate`,
      call: async (p: any) => {
        const r = await z.branch.call('calibrate', p)
        startupOrder.push(z.name)
        return r
      }
    })),
    {strategy: 'sequential', errorStrategy: 'continue'}
  )
  await startupGroup.call()

  console.log(
    healthResult.metadata?.successful === zones.length &&
      startupOrder.join(',') === 'zone-a,zone-b'
      ? '✅ health-check ran on all zones in parallel; startup calibrated zone-a then zone-b, in order'
      : `❌ expected in-order sequential startup, got: ${startupOrder.join(',')}`
  )
}

// =============================================================================
// 8) SYSTEM SNAPSHOT  →  getMetrics() + lock()
// =============================================================================
console.log('\n=== 8) system snapshot ===')
{
  const metrics = cyre.getMetrics()
  console.log(
    '  system metrics:',
    JSON.stringify(metrics, null, 2).slice(0, 400) + ' ...'
  )
}

cyre.lock()
console.log('\ndone.')
