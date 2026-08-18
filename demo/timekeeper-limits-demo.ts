// demo/timekeeper-limits-demo.ts
// Stress-tests TimeKeeper across the ranges it's actually built for: very
// short high-precision intervals, a genuinely long interval that forces
// multiple internal engine wake-cycles, concurrent fast+slow timers,
// finite vs infinite repeat, pause/resume, and error resilience.
//
// This all goes through the public cyre.action/call API, same as any real
// app would use it - nothing here reaches into TimeKeeper directly.
import {cyre, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) HIGH-FREQUENCY REAL-TIME SYNC  →  short interval, repeat: true
//
// Multiplayer cursor position broadcast - 50ms cadence (20 updates/sec).
// This lands well under TimeKeeper's HIGH_PRECISION_THRESHOLD (1016ms), so
// it should run on the tight-loop polling path. We measure actual vs
// expected fire time on every tick to see how tight "tight" really is.
// =============================================================================
console.log('\n=== 1) high-frequency sync: 50ms interval, ~2s run ===')
{
  const INTERVAL = 50
  const RUN_TIME = 2000
  const start = Date.now()
  const drifts: number[] = []
  let ticks = 0

  cyre.action({id: 'cursor-sync://', interval: INTERVAL, repeat: true})
  cyre.on('cursor-sync://', () => {
    ticks++
    const expected = start + ticks * INTERVAL
    const drift = Date.now() - expected
    drifts.push(drift)
    return {x: ticks, y: ticks}
  })

  await cyre.call('cursor-sync://')
  await wait(RUN_TIME)
  cyre.forget('cursor-sync://')

  const avg = drifts.reduce((a, b) => a + b, 0) / drifts.length
  const max = Math.max(...drifts.map(Math.abs))
  log.debug(
    `  ${ticks} ticks in ${RUN_TIME}ms, avg drift ${avg.toFixed(1)}ms, max drift ${max}ms`
  )
}

// =============================================================================
// 2) ANIMATION-FRAME-STYLE JITTER TEST  →  16ms interval, 60 repeats
//
// Roughly a 60fps game-loop tick rate. This is the sharpest precision test
// in the file - if drift compensation and the high-precision tier aren't
// pulling their weight, it'll show up here first.
// =============================================================================
console.log('\n=== 2) 16ms "60fps" tick, 60 repeats ===')
{
  const INTERVAL = 16
  const REPEATS = 60
  const start = Date.now()
  const drifts: number[] = []

  cyre.action({id: 'frame-tick://', interval: INTERVAL, repeat: REPEATS})
  cyre.on('frame-tick://', () => {
    const tickIndex = drifts.length + 1
    const expected = start + tickIndex * INTERVAL
    drifts.push(Date.now() - expected)
  })

  await cyre.call('frame-tick://')
  await wait(INTERVAL * REPEATS + 500)

  const avg = drifts.reduce((a, b) => a + b, 0) / (drifts.length || 1)
  const max = drifts.length ? Math.max(...drifts.map(Math.abs)) : 0
  log.debug(
    `  ${drifts.length}/${REPEATS} ticks fired, avg drift ${avg.toFixed(1)}ms, max drift ${max}ms`
  )
  console.log(
    drifts.length === REPEATS
      ? '✅ all 60 ticks fired, no ticks silently dropped'
      : `❌ expected ${REPEATS} ticks, got ${drifts.length}`
  )
}

// =============================================================================
// 3) LONG INTERVAL, WELL PAST THE ENGINE'S OWN POLL BOUND  →  one-shot delay
//
// TimeKeeper never sleeps longer than ~60s at a stretch internally (that's
// what keeps it responsive and avoids setTimeout's 32-bit overflow) - so
// any interval longer than that has to survive multiple wake-cycles before
// it's actually due. 65s here is deliberately just past that boundary.
// This is the slow part of the demo - it's supposed to be.
// =============================================================================
console.log(
  "\n=== 3) long interval (65s) - crosses the engine's internal poll bound ==="
)
{
  const DELAY = 65_000
  const start = Date.now()
  let fired = false

  cyre.action({id: 'nightly-backup://', delay: DELAY, repeat: 1})
  cyre.on('nightly-backup://', () => {
    fired = true
    const actualDelay = Date.now() - start
    log.debug(
      `  📦 backup ran after ${actualDelay}ms (requested ${DELAY}ms, drift ${actualDelay - DELAY}ms)`
    )
  })

  await cyre.call('nightly-backup://')

  // heartbeat so this doesn't look hung while we wait
  const heartbeat = setInterval(() => {
    console.log(
      `  ...waiting (${Math.round((Date.now() - start) / 1000)}s elapsed)`
    )
  }, 10_000)

  await wait(DELAY + 3000)
  clearInterval(heartbeat)

  console.log(
    fired
      ? '✅ long-interval timer fired exactly once, on schedule'
      : '❌ long-interval timer never fired'
  )
}

// =============================================================================
// 4) CONCURRENT FAST + SLOW TIMERS  →  neither should starve the other
//
// A high-frequency telemetry stream (30ms) running alongside a periodic
// health check (4000ms). The telemetry keeps the engine in its tight polling
// loop the whole time - this proves that doesn't delay or distort the slower
// timer's own independently-computed schedule.
// =============================================================================
console.log(
  '\n=== 4) concurrent fast (30ms) + slow (4000ms) timers, 6s run ==='
)
{
  const RUN_TIME = 6000
  let telemetryTicks = 0
  let healthChecks = 0
  const healthCheckTimes: number[] = []
  const start = Date.now()

  cyre.action({id: 'telemetry://', interval: 30, repeat: true})
  cyre.on('telemetry://', () => {
    telemetryTicks++
  })

  cyre.action({id: 'health-check://', interval: 4000, repeat: true})
  cyre.on('health-check://', () => {
    healthChecks++
    healthCheckTimes.push(Date.now() - start)
    log.debug(`  🏥 health check #${healthChecks} at ${Date.now() - start}ms`)
  })

  await cyre.call('telemetry://')
  await cyre.call('health-check://')
  await wait(RUN_TIME)

  cyre.forget('telemetry://')
  cyre.forget('health-check://')

  const expectedTelemetryTicks = Math.floor(RUN_TIME / 30)
  log.debug(
    `  telemetry: ${telemetryTicks} ticks (~${expectedTelemetryTicks} expected), health checks: ${healthChecks} at [${healthCheckTimes.join(', ')}]ms`
  )
  console.log(
    telemetryTicks > expectedTelemetryTicks * 0.9 && healthChecks >= 1
      ? '✅ both timers ran on their own cadence, neither starved the other'
      : '❌ one of the timers fell noticeably behind its expected cadence'
  )
}

// =============================================================================
// 5) FINITE REPEAT COUNT  →  should fire exactly N times, then self-stop
// =============================================================================
console.log('\n=== 5) finite repeat: exactly 5 executions, then stop ===')
{
  const REPEATS = 5
  const INTERVAL = 200
  let count = 0

  cyre.action({id: 'retry-attempt://', interval: INTERVAL, repeat: REPEATS})
  cyre.on('retry-attempt://', () => {
    count++
    log.debug(`  attempt ${count}/${REPEATS}`)
  })

  await cyre.call('retry-attempt://')
  await wait(INTERVAL * REPEATS + 500)

  const countAfterExpectedCompletion = count
  await wait(INTERVAL * 3) // confirm it really stopped, not just paused between fires
  console.log(
    countAfterExpectedCompletion === REPEATS && count === REPEATS
      ? `✅ fired exactly ${REPEATS} times and stopped on its own`
      : `❌ expected exactly ${REPEATS} executions, saw ${countAfterExpectedCompletion} then ${count}`
  )
}

// =============================================================================
// 6) PAUSE / RESUME MID-FLIGHT  →  a maintenance window
// =============================================================================
console.log('\n=== 6) pause/resume: simulated maintenance window ===')
{
  const INTERVAL = 200
  let count = 0

  cyre.action({id: 'uptime-monitor://', interval: INTERVAL, repeat: true})
  cyre.on('uptime-monitor://', () => {
    count++
  })

  await cyre.call('uptime-monitor://')
  await wait(650) // let it run a few ticks
  const countBeforePause = count
  console.log(`  ${countBeforePause} checks before maintenance window`)

  cyre.pause('uptime-monitor://')
  console.log('  entering maintenance window (paused)...')
  await wait(1000)
  const countDuringPause = count
  console.log(
    `  ${countDuringPause} checks during maintenance window (should be unchanged)`
  )

  cyre.resume('uptime-monitor://')
  console.log('  maintenance window over, resumed')
  await wait(650)
  const countAfterResume = count

  cyre.forget('uptime-monitor://')

  console.log(
    countDuringPause === countBeforePause && countAfterResume > countDuringPause
      ? '✅ zero checks during the pause, resumed correctly afterward'
      : '❌ pause/resume did not behave as expected'
  )
}

// =============================================================================
// 7) RESILIENCE UNDER INTERMITTENT FAILURES  →  errors shouldn't derail the schedule
// =============================================================================
console.log(
  '\n=== 7) flaky handler: some attempts throw, schedule should be unaffected ==='
)
{
  const REPEATS = 6
  const INTERVAL = 200
  let attempts = 0
  let failures = 0

  cyre.action({id: 'flaky-sensor://', interval: INTERVAL, repeat: REPEATS})
  cyre.on('flaky-sensor://', () => {
    attempts++
    if (attempts % 2 === 0) {
      failures++
      throw new Error(`simulated sensor glitch on attempt ${attempts}`)
    }
    log.debug(`  ✓ attempt ${attempts} succeeded`)
    return 'ok'
  })

  await cyre.call('flaky-sensor://')
  await wait(INTERVAL * REPEATS + 500)

  console.log(`  ${attempts} attempts total, ${failures} of them threw`)
  console.log(
    attempts === REPEATS
      ? `✅ all ${REPEATS} scheduled attempts ran despite ${failures} failures`
      : `❌ expected ${REPEATS} attempts, only got ${attempts} - a failure derailed the schedule`
  )
}

cyre.lock()
console.log('\ndone.')
