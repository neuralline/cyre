// demo/channel-fairness-demo.ts
// Cyre's breathing/stress system is GLOBAL: one metricsState.stress
// reading, one currentRate, one isRecuperating flag, shared by every
// channel in the process (see src/context/metrics-state.ts and app.ts's
// call() -> metricsState.canCall()). This demo asks a direct question
// about that design: if ONE channel is the sole source of overload, do
// completely unrelated, lightly-loaded "normal" channels pay for it too?
//
// Real load only - no synthetic injection. One `busy/channel` gets
// hammered with real synchronous CPU work; four `normal/*` channels get
// called on a light, steady, low cadence that would never trip
// recuperation on its own. Both run concurrently for the same window.
//
// This is a diagnostic demo, not a regression test for a feature that
// exists yet - there is no per-channel breathing in the codebase today
// (confirmed by reading app.ts/cyre-dispatch.ts/cyre-actions.ts: only
// throttle/debounce/buffer are per-channel, and all three are opt-in
// config, not stress-aware). What this demonstrates is the *case* for
// adding one: under the current global scheme, a single noisy channel's
// stress is indistinguishable from system-wide overload to every other
// channel's canCall() gate.
import {cyre, log} from '../src'
import {metricsState} from '../src/context/metrics-state'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

console.log('\n' + '='.repeat(78))
console.log(
  '  C Y R E   C H A N N E L   F A I R N E S S   ( B U S Y   V S   N O R M A L )'
)
console.log('='.repeat(78))

// Lowered thresholds, same reasoning as breathing-stress-demo.ts's section
// 1) - a laptop with idle cores to spare can be hard to overload past the
// real default 90%/95% thresholds in a few seconds of demo time.
await cyre.init({
  breathing: {stress: {low: 0.15, medium: 0.25, high: 0.35, critical: 0.55}}
})

const burnCpu = (ms: number): number => {
  const end = performance.now() + ms
  let x = 0
  while (performance.now() < end) x += Math.sqrt(x + 1)
  return x
}

cyre.action({id: 'busy/channel'})
cyre.on('busy/channel', (payload: {n: number}) => {
  burnCpu(4)
  return payload
})

// Four unrelated, lightweight channels - trivial handlers, called on a
// fixed ~150ms-per-channel cadence. On their own, this traffic pattern
// would sit comfortably at NORMAL/idle breathing forever.
const normalIds = ['normal/a', 'normal/b', 'normal/c', 'normal/d']
normalIds.forEach(id => {
  cyre.action({id})
  cyre.on(id, (payload: {n: number}) => payload)
})

const DURATION_MS = 3000

let busyFired = 0,
  busyAccepted = 0,
  busyBlocked = 0
let normalFired = 0,
  normalAccepted = 0,
  normalBlocked = 0

const busyGenerator = (async () => {
  const inFlight: Promise<any>[] = []
  const deadline = Date.now() + DURATION_MS
  while (Date.now() < deadline) {
    for (let i = 0; i < 15; i++) {
      busyFired++
      inFlight.push(
        cyre.call('busy/channel', {n: busyFired}).then(r => {
          r.ok ? busyAccepted++ : busyBlocked++
        })
      )
    }
    await wait(60)
  }
  await Promise.all(inFlight)
})()

const normalGenerator = (async () => {
  const inFlight: Promise<any>[] = []
  const deadline = Date.now() + DURATION_MS
  while (Date.now() < deadline) {
    for (const id of normalIds) {
      normalFired++
      inFlight.push(
        cyre.call(id, {n: normalFired}).then(r => {
          r.ok ? normalAccepted++ : normalBlocked++
        })
      )
    }
    await wait(150) // ~once every 150ms per normal channel - light, steady, unrelated traffic
  }
  await Promise.all(inFlight)
})()

const monitor = (async () => {
  const SAMPLE_MS = 500
  const samples = Math.ceil(DURATION_MS / SAMPLE_MS)
  console.log('\n  t(s)   stress   rate    recuperating  canCall')
  for (let i = 1; i <= samples; i++) {
    await wait(SAMPLE_MS)
    const state = metricsState.get()
    console.log(
      `  ${(i * (SAMPLE_MS / 1000)).toFixed(1).padStart(4)}s  ` +
        `${pct(state.stress.combined).padStart(6)}  ` +
        `${String(Math.round(state.breathing.currentRate)).padStart(5)}ms  ` +
        `${String(state.breathing.isRecuperating).padEnd(12)}  ` +
        `${state.flags.canCall}`
    )
  }
})()

await Promise.all([busyGenerator, normalGenerator, monitor])

cyre.forget('busy/channel')
normalIds.forEach(id => cyre.forget(id))

console.log('\n=== RESULT ===')
console.log(
  `  busy channel:    fired=${busyFired} accepted=${busyAccepted} blocked=${busyBlocked} (${((busyBlocked / busyFired) * 100).toFixed(0)}% blocked)`
)
console.log(
  `  normal channels: fired=${normalFired} accepted=${normalAccepted} blocked=${normalBlocked} (${((normalBlocked / normalFired) * 100).toFixed(0)}% blocked)`
)
console.log(
  normalBlocked > 0
    ? "  ⚠️  normal channels got blocked too - purely as collateral damage from the busy channel's stress. Global breathing has no way to tell them apart: metricsState.canCall() is one flag for the whole process, not one per channel."
    : '  normal channels were unaffected this run (try a longer DURATION_MS or heavier burnCpu() if this reruns clean)'
)
console.log(
  '\n  what this means for a hypothetical PER-CHANNEL breathing optimisation:\n' +
    "  - at NORMAL/idle stress (nothing overloaded), it would change nothing: each channel's own local\n" +
    '    stress reading would already sit near baseline, same as the global reading does today - calls/sec\n' +
    '    on quiet channels is identical either way.\n' +
    "  - it only matters once SOMETHING is overloaded: today that channel's stress leaks onto every other\n" +
    "    channel's canCall() gate and currentRate, as measured above. Scoping stress/recuperation per-channel\n" +
    "    (or per channel-group) would let 'normal/*' keep calling at its own baseline rate while only\n" +
    "    'busy/channel' itself gets throttled/blocked - the busy-vs-normal split above is exactly the gap\n" +
    '    between those two designs, measured with real load rather than argued in the abstract.'
)

console.log('\n' + '='.repeat(78))
log.sys('Channel fairness demo complete.')
cyre.shutdown()
