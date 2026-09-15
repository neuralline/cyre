// demo/speed-test-demo.ts
// Calls-per-second benchmarks across the scenarios that actually matter for
// a library whose whole pitch is "agility and responsiveness" - the plain
// fast path, the compiled talent pipeline (schema/condition/selector/
// transform), the five dispatch strategies, the throttle/debounce/buffer
// guards, the raw schema builder helpers (fast()/memoize(), see Update 6/14
// in claude/cyre-codebase-analysis.md), and cyre.orchestration.call()
// overhead versus a plain channel call.
//
// Every number below is measured against the real public API - nothing
// here reaches into internals - so the results reflect what an actual
// consumer of the package would see, not a synthetic micro-benchmark of an
// isolated function.
//
// All channels are registered up front and cyre.lock()'d before any
// benchmark runs, following this project's own demo convention (see
// claude/cyre-codebase-analysis.md Update 3).
import {cyre, log} from '../src'
import {fast, memoize, object, number} from '../src/schema/cyre-schema'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const now = () => performance.now()

interface BenchResult {
  name: string
  iterations: number
  elapsedMs: number
  opsPerSec: number
  note?: string
}

const results: BenchResult[] = []

function record(
  name: string,
  iterations: number,
  elapsedMs: number,
  note?: string
): BenchResult {
  const opsPerSec = iterations / (elapsedMs / 1000)
  const result = {name, iterations, elapsedMs, opsPerSec, note}
  results.push(result)
  console.log(
    `  ${name.padEnd(38)} ${opsPerSec.toFixed(0).padStart(10)} ops/sec` +
      `  (${iterations} calls in ${elapsedMs.toFixed(1)}ms)` +
      (note ? `  — ${note}` : '')
  )
  return result
}

// Sequential: awaits each call before firing the next - the realistic
// shape for most real usage (a request handler awaiting cyre.call, a loop
// processing one item at a time).
async function benchSequential(
  name: string,
  iterations: number,
  run: (i: number) => Promise<any> | any,
  note?: string
): Promise<BenchResult> {
  const start = now()
  for (let i = 0; i < iterations; i++) {
    await run(i)
  }
  return record(name, iterations, now() - start, note)
}

// Concurrent: fires every call immediately and awaits them all together -
// the ceiling on throughput when a caller doesn't need per-call ordering
// (a fan-out job, a batch import).
async function benchConcurrent(
  name: string,
  iterations: number,
  run: (i: number) => Promise<any> | any,
  note?: string
): Promise<BenchResult> {
  const start = now()
  const promises: Promise<any>[] = []
  for (let i = 0; i < iterations; i++) {
    promises.push(Promise.resolve(run(i)))
  }
  await Promise.all(promises)
  return record(name, iterations, now() - start, note)
}

// Synchronous: no async/await overhead at all - used for the raw schema
// builder helpers, which are plain functions, not cyre.call().
function benchSync(
  name: string,
  iterations: number,
  run: (i: number) => any,
  note?: string
): BenchResult {
  const start = now()
  for (let i = 0; i < iterations; i++) {
    run(i)
  }
  return record(name, iterations, now() - start, note)
}

await cyre.init()

// =============================================================================
// 0) REGISTRATION - every channel/handler/orchestration this file needs,
// all up front, before the single cyre.lock() call below.
// =============================================================================

// 1) plain fast path - no protections, no pipeline, one handler
cyre.action({id: 'speed/fast-path'})
cyre.on('speed/fast-path', (payload: {n: number}) => payload)

// 2) schema validation only
cyre.action({id: 'speed/schema-only', schema: object({n: number()})})
cyre.on('speed/schema-only', (payload: {n: number}) => payload)

// 3) full compiled pipeline - schema -> condition -> selector -> transform
cyre.action({
  id: 'speed/full-pipeline',
  schema: object({n: number()}),
  condition: (payload: {n: number}) => payload.n >= 0,
  selector: (payload: {n: number}) => payload,
  transform: (payload: {n: number}) => ({...payload, doubled: payload.n * 2})
})
cyre.on(
  'speed/full-pipeline',
  (payload: {n: number; doubled: number}) => payload
)

// 4) protections - throttle/debounce/buffer, each on its own channel so one
// guard's state doesn't interfere with another's during the benchmark loop
cyre.action({id: 'speed/throttled', throttle: 50})
cyre.on('speed/throttled', (payload: {n: number}) => payload)

cyre.action({id: 'speed/debounced', debounce: 20})
cyre.on('speed/debounced', (payload: {n: number}) => payload)

cyre.action({id: 'speed/buffered', buffer: {window: 50, strategy: 'append'}})
cyre.on('speed/buffered', (payload: {n: number}[]) => payload)

// 5) dispatch strategies - same 3 lightweight synchronous handlers on each,
// only the declared `dispatch` strategy differs
const DISPATCH_STRATEGIES = [
  'parallel',
  'sequential',
  'race',
  'waterfall'
] as const
for (const strategy of DISPATCH_STRATEGIES) {
  const id = `speed/dispatch-${strategy}`
  cyre.action({id, dispatch: strategy, dispatchTimeout: 2000})
  for (let h = 0; h < 3; h++) {
    cyre.on(id, (payload: {n: number}) => ({handler: h, n: payload.n}))
  }
}

// 6) orchestration - one plain action step targeting its own channel, so
// its overhead can be compared directly against calling that channel plainly
cyre.action({id: 'speed/orch-target'})
cyre.on('speed/orch-target', (payload: {n: number}) => payload)
cyre.orchestration.keep({
  id: 'speed/orchestration-test',
  triggers: [],
  workflow: [{name: 'run', type: 'action', targets: 'speed/orch-target'}]
})

cyre.lock()

console.log('\n' + '='.repeat(78))
console.log(
  '  C Y R E   S P E E D   T E S T   —   calls per second, by scenario'
)
console.log('='.repeat(78))

// =============================================================================
// 1) FAST PATH - the floor. No protections, no pipeline, one handler.
// =============================================================================
console.log('\n=== 1) fast path (no protections, single handler) ===')
await benchSequential(
  'fast-path (sequential)',
  20000,
  i => cyre.call('speed/fast-path', {n: i}),
  'awaits each call before the next'
)
await benchConcurrent(
  'fast-path (concurrent)',
  20000,
  i => cyre.call('speed/fast-path', {n: i}),
  'fires all, awaits together - throughput ceiling'
)

// =============================================================================
// 2) SCHEMA VALIDATION - the cost of one talent in the compiled pipeline
// =============================================================================
console.log('\n=== 2) schema validation only ===')
await benchSequential('schema-only (sequential)', 20000, i =>
  cyre.call('speed/schema-only', {n: i})
)

// =============================================================================
// 3) FULL PIPELINE - schema + condition + selector + transform, in order
// =============================================================================
console.log(
  '\n=== 3) full pipeline (schema -> condition -> selector -> transform) ==='
)
await benchSequential('full-pipeline (sequential)', 10000, i =>
  cyre.call('speed/full-pipeline', {n: i})
)

// =============================================================================
// 4) RAW SCHEMA BUILDER HELPERS - fast()/memoize() overhead in isolation,
// no cyre.call() involved at all (see Update 6/14 in the analysis doc)
// =============================================================================
console.log(
  '\n=== 4) raw schema helpers (no cyre.call - pure function overhead) ==='
)
{
  const schema = object({n: number()})
  const validator = schema
  const fastValidator = fast(schema)
  const memoValidator = memoize(schema)

  benchSync('plain schema validator', 100000, i => validator({n: i}))
  benchSync(
    'fast() cached wrapper',
    100000,
    i => fastValidator({n: i}),
    'same validator logic, cached wrapper reuse'
  )
  benchSync(
    'memoize() - all distinct values',
    100000,
    i => memoValidator({n: i}),
    'every call is a cache miss (worst case)'
  )
  benchSync(
    'memoize() - same value repeated',
    100000,
    () => memoValidator({n: 1}),
    'every call after the first is a cache hit (best case)'
  )
}

// =============================================================================
// 5) DISPATCH STRATEGIES - same 3 handlers, different fan-out strategy
// =============================================================================
console.log('\n=== 5) dispatch strategies (3 handlers each) ===')
for (const strategy of DISPATCH_STRATEGIES) {
  await benchSequential(`dispatch: ${strategy}`, 3000, i =>
    cyre.call(`speed/dispatch-${strategy}`, {n: i})
  )
}

// =============================================================================
// 6) PROTECTIONS - throttle/debounce/buffer guard overhead. These return as
// soon as the call is scheduled/rejected, not once a delayed dispatch
// actually runs, so this measures guard-check speed, not end-to-end latency.
// =============================================================================
console.log(
  '\n=== 6) protection guards (schedule/reject speed, not dispatch latency) ==='
)
{
  let accepted = 0
  const iterations = 2000
  const start = now()
  for (let i = 0; i < iterations; i++) {
    const res = await cyre.call('speed/throttled', {n: i})
    if (res.ok) accepted++
  }
  record(
    'throttle (50ms) guard check',
    iterations,
    now() - start,
    `${accepted}/${iterations} accepted, rest rejected within the window`
  )
}
await benchSequential(
  'debounce (20ms) scheduling',
  2000,
  i => cyre.call('speed/debounced', {n: i}),
  'every call reschedules the same window'
)
await benchSequential(
  'buffer (50ms, append) scheduling',
  2000,
  i => cyre.call('speed/buffered', {n: i}),
  'every call appends into the open window'
)
// let the last debounce/buffer windows this section opened settle before
// moving on - they're one-shot (repeat: 1) and self-clear, nothing to forget
await wait(150)

// =============================================================================
// 7) ORCHESTRATION OVERHEAD - cyre.orchestration.call() vs a plain
// cyre.call() to the exact same underlying channel
// =============================================================================
console.log(
  '\n=== 7) orchestration.call() overhead vs a plain channel call ==='
)
await benchSequential('plain channel call (baseline)', 5000, i =>
  cyre.call('speed/orch-target', {n: i})
)
await benchSequential('orchestration.call() (1-step workflow)', 5000, i =>
  cyre.orchestration.call('speed/orchestration-test', {n: i})
)

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n' + '='.repeat(78))
console.log('  SUMMARY (highest to lowest ops/sec)')
console.log('='.repeat(78))
const sorted = [...results].sort((a, b) => b.opsPerSec - a.opsPerSec)
for (const r of sorted) {
  console.log(
    `  ${r.name.padEnd(38)} ${r.opsPerSec.toFixed(0).padStart(10)} ops/sec`
  )
}
console.log('='.repeat(78))
log.sys(
  `Speed test complete - ${results.length} scenarios measured on this machine/run. ` +
    `Absolute numbers vary by hardware; relative ordering between scenarios is the useful signal.`
)

// Every protection window opened in section 6 was one-shot and waited out
// above; the orchestration and every plain channel used here are call()-only
// (no interval/repeat) - nothing is left running, safe to end the process.
cyre.shutdown()
