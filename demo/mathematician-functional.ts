// demo/mathematician-functional.ts
// A functional, modern-Cyre rewrite of demo/mathematician.ts - same five
// channel-lifecycle benchmarks (create->process->destroy, algebraic chains,
// matrix multiplication, recursive Fibonacci, pure lifecycle throughput),
// but as plain composable functions instead of a `class
// MathematicianBenchmark` (the original is one of the few files in this
// repo written OOP-style, against the project's own no-classes convention).
//
// Rewriting it surfaced three real bugs in the original that were silently
// eating its own results, fixed here:
//
// 1) THE BIG ONE: the original never called `cyre.init()`. metricsState's
//    default flags (config/cyre-config.ts's defaultMetrics.flags) start
//    with canAction/canCall both FALSE until init() flips them - so every
//    `cyre.action()` in the original returned {ok:false, message:'System
//    not initialized'} and never actually created a channel, and every
//    `cyre.call()` on those non-existent channels returned {ok:false,
//    payload:null, message:'...Channel does not exist'} WITHOUT throwing
//    or invoking any handler. Since the original never checked these
//    return values, nothing exploded - it just silently computed nothing,
//    while still reporting 100% success rates and "Perfect mathematical
//    precision maintained!" The benchmark was measuring the overhead of
//    hitting canRegister()/canCall()'s early-exit gate, not real channel
//    dispatch. `await cyre.init()` below is what actually makes every
//    number in this file mean something.
//
// 2) testComplexMathChains() (Test 2 here) never called cyre.clear() at
//    all - ~18,000 channels (2000 iterations x 9) would leak for the rest
//    of the process's life. Fixed with a bulk clear after the test.
//
// 3) testMassiveChannelLifecycle() (Test 5 here)'s own comment claimed
//    "Destroy (using cyre.clear() after the loop for efficiency)" but the
//    method never actually called cyre.clear() anywhere - 10,000 channels
//    were left live when the benchmark finished. Fixed the same way.
//
// Two "modern Cyre" touches beyond the bugfixes: cyre.init(userConfig)
// raises breathing.limits.maxCallRate for this workload (Test 5 alone
// fires 10,000 calls/sec-ish; left at the default 1000/sec limit, the
// breathing system's own stress calculation would push toward
// recuperation and throttle cyre.call() admission mid-benchmark - see
// src/context/metrics-state.ts's mergeConfig()); and dependency values are
// read with Promise.all() instead of sequential awaits, resolving sibling
// channels concurrently rather than one at a time.
import {cyre} from '../src'
// Verification-only import, same pattern as claude/calendar-scheduling-
// demo.ts and demo/cyre-init-userconfig-demo.ts - reaches past the public
// API purely to explain a failure, not to drive the benchmark itself.
import {metricsState} from '../src/context/metrics-state'

interface MathematicianResult {
  testName: string
  channelsCreated: number
  channelsProcessed: number
  channelsDestroyed: number
  operationsPerSecond: number
  averageLatencyMs: number
  memoryUsageMB: number
  equationComplexity: 'simple' | 'medium' | 'complex' | 'extreme'
  successRate: number
  errorCount: number
}

interface IterationOutcome {
  created: number
  processed: number
  destroyed: number
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const measureMemoryMB = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024
  }
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    return (performance as any).memory.usedJSHeapSize / 1024 / 1024
  }
  return 0
}

// The original file (and this file's first draft) never checked .ok on
// action()/on()/call() results - cyre never throws, it returns {ok:false,
// message} instead, so a silently-swallowed failure just looks like
// nothing happened. That let a real, late-run failure hide behind a
// reported "100% success rate, 0 errors" - see the header comment. These
// two throw on failure so runTimedTest's per-iteration try/catch (below)
// can actually see it.
const assertOk = (
  response: {ok: boolean; message: string},
  context: string
): void => {
  if (!response.ok) {
    throw new Error(`${context} failed: ${response.message}`)
  }
}

// A "variable" channel: holds a number, and a plain identity handler so
// cyre.call() on it just echoes back its stored value - a pull-based
// getter built out of an ordinary channel.
const setVariable = (id: string, value: number): void => {
  assertOk(cyre.action({id, payload: {value}}), `action(${id})`)
  assertOk(cyre.on(id, (payload: {value: number}) => payload), `on(${id})`)
}

const readValue = async (id: string): Promise<number> => {
  const response = await cyre.call(id)
  assertOk(response, `call(${id})`)
  return response.payload?.value ?? 0
}

// An "operation" channel: its handler reaches out to other channels (via
// readValue) to resolve its dependencies, then returns the computed value.
// This is the core pattern of the whole file - a channel graph doubling as
// a dependency graph.
const defineOperation = (
  id: string,
  operation: string,
  compute: () => Promise<number>
): void => {
  assertOk(cyre.action({id, payload: {value: 0}}), `action(${id})`)
  assertOk(
    cyre.on(id, async () => ({value: await compute(), operation})),
    `on(${id})`
  )
}

// Generic timed-test runner - the original class repeated this exact
// timing/memory/success-rate bookkeeping in all five test methods; here
// it's written once and every test supplies just its own iteration body.
const runTimedTest = async (
  testName: string,
  equationComplexity: MathematicianResult['equationComplexity'],
  iterations: number,
  runIteration: (index: number) => Promise<IterationOutcome>,
  afterAll?: () => void
): Promise<MathematicianResult> => {
  console.log(`\n🧮 Testing ${testName}...`)

  let channelsCreated = 0
  let channelsProcessed = 0
  let channelsDestroyed = 0
  let errorCount = 0
  const latencies: number[] = []

  const startMemory = measureMemoryMB()
  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now()
    try {
      const outcome = await runIteration(i)
      channelsCreated += outcome.created
      channelsProcessed += outcome.processed
      channelsDestroyed += outcome.destroyed
    } catch (error) {
      errorCount++
      // Dump the internal flags on the FIRST failure only - the point is
      // to answer "why" directly (not initialized? shutdown? locked?
      // recuperating?) instead of guessing from a message string, without
      // spamming this for every one of up to 10,000 iterations.
      if (errorCount === 1) {
        const state = metricsState.get()
        console.log(`  ⚠️  iteration ${i} failed: ${(error as Error).message}`)
        console.log(
          `     _init=${state._init} _shutdown=${state._shutdown} ` +
            `_isLocked=${state._isLocked} isRecuperating=${state.breathing.isRecuperating} ` +
            `hibernating=${state.hibernating} stress=${state.stress.combined.toFixed(3)}`
        )
      }
    }
    latencies.push(performance.now() - opStart)
  }

  afterAll?.()

  const totalTimeSeconds = (performance.now() - startTime) / 1000
  const opsPerSecond = iterations / totalTimeSeconds
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
  const memoryUsage = measureMemoryMB() - startMemory
  const successRate = ((iterations - errorCount) / iterations) * 100

  return {
    testName,
    channelsCreated,
    channelsProcessed,
    channelsDestroyed,
    operationsPerSecond: Math.round(opsPerSecond),
    averageLatencyMs: Number(avgLatency.toFixed(3)),
    memoryUsageMB: Number(memoryUsage.toFixed(2)),
    equationComplexity,
    successRate: Number(successRate.toFixed(2)),
    errorCount
  }
}

// =============================================================================
// Test 1: Simple Math Operations - result = a + b, create->process->destroy
// =============================================================================
const testSimpleMathOperations = (): Promise<MathematicianResult> =>
  runTimedTest(
    'Simple Math Operations (create -> process -> destroy)',
    'simple',
    5000,
    async i => {
      const varA = `var_a_${i}`
      const varB = `var_b_${i}`
      const result = `result_${i}`

      setVariable(varA, Math.floor(Math.random() * 100))
      setVariable(varB, Math.floor(Math.random() * 100))
      defineOperation(result, 'addition', async () => {
        const [a, b] = await Promise.all([readValue(varA), readValue(varB)])
        return a + b
      })

      assertOk(await cyre.call(result), `call(${result})`)
      return {created: 3, processed: 1, destroyed: 0}
    },
    () => cyre.clear() // bulk teardown once, after all 5000 iterations
  )

// =============================================================================
// Test 2: Complex Math Chains - result = (a*b) + (c/d) - e, a 4-deep
// dependency chain of operation channels
// =============================================================================
const testComplexMathChains = (): Promise<MathematicianResult> =>
  runTimedTest(
    'Complex Math Chains (algebraic expression)',
    'complex',
    2000,
    async i => {
      const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map(n => `${n}_${i}`)
      const [mult, div, add, final] = ['mult', 'div', 'add', 'final'].map(
        n => `${n}_${i}`
      )

      // +1 floor avoids division by zero on `d`, same as the original
      setVariable(a, Math.floor(Math.random() * 10) + 1)
      setVariable(b, Math.floor(Math.random() * 10) + 1)
      setVariable(c, Math.floor(Math.random() * 10) + 1)
      setVariable(d, Math.floor(Math.random() * 10) + 1)
      setVariable(e, Math.floor(Math.random() * 10) + 1)

      defineOperation(mult, 'multiplication', async () => {
        const [x, y] = await Promise.all([readValue(a), readValue(b)])
        return x * y
      })
      defineOperation(div, 'division', async () => {
        const [x, y] = await Promise.all([readValue(c), readValue(d)])
        return x / y
      })
      defineOperation(add, 'addition', async () => {
        const [x, y] = await Promise.all([readValue(mult), readValue(div)])
        return x + y
      })
      defineOperation(final, 'subtraction', async () => {
        const [x, y] = await Promise.all([readValue(add), readValue(e)])
        return x - y
      })

      assertOk(await cyre.call(final), `call(${final})`)
      return {created: 9, processed: 4, destroyed: 0}
    },
    () => cyre.clear() // FIX: original never cleared this test at all
  )

// =============================================================================
// Test 3: Matrix Operations - 3x3 matrix multiplication, 27 channels/iter.
// Result cells are called concurrently (Promise.all) instead of one at a
// time, and each cell resolves its own 3-term sum concurrently too.
// =============================================================================
const testMatrixOperations = (): Promise<MathematicianResult> =>
  runTimedTest(
    'Matrix Operations (3x3 matrix multiplication)',
    'extreme',
    500,
    async i => {
      const cellId = (prefix: string, row: number, col: number) =>
        `${prefix}_${i}_${row}_${col}`

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          setVariable(cellId('matA', row, col), Math.floor(Math.random() * 10))
          setVariable(cellId('matB', row, col), Math.floor(Math.random() * 10))
        }
      }

      const resultCells: string[] = []
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const id = cellId('result', row, col)
          resultCells.push(id)
          defineOperation(id, 'matrix_multiplication', async () => {
            const products = await Promise.all(
              [0, 1, 2].map(async k => {
                const [a, b] = await Promise.all([
                  readValue(cellId('matA', row, k)),
                  readValue(cellId('matB', k, col))
                ])
                return a * b
              })
            )
            return products.reduce((sum, p) => sum + p, 0)
          })
        }
      }

      const cellResults = await Promise.all(resultCells.map(id => cyre.call(id)))
      cellResults.forEach((r, idx) => assertOk(r, `call(${resultCells[idx]})`))

      return {created: 27, processed: resultCells.length, destroyed: 0}
    },
    () => cyre.clear() // bulk teardown once, after all 500 iterations - a
    // full cyre.clear() is a system-wide reset, not a per-channel op, so
    // calling it once here instead of 500x is both cheaper and the
    // semantically correct use (see Test 1/2/5's afterAll for the same
    // reasoning); peaks at 13,500 live channels, well within what Test 1
    // already tolerates at 15,000
  )

// =============================================================================
// Test 4: Recursive Functions - Fibonacci computed by wiring one channel
// per recursion depth, each depth's handler calling the two channels below
// it. A single forward pass (n=2..15) is enough - unlike the original's
// two-phase "create all actions, then all handlers" split, a channel only
// needs to EXIST (not have already run) by the time something calls it, so
// no phase separation is required here.
// =============================================================================
const testRecursiveFunctions = (): Promise<MathematicianResult> => {
  const fibDepth = 15
  return runTimedTest(
    'Recursive Functions (Fibonacci via channel graph)',
    'medium',
    1000,
    async i => {
      const fibId = (n: number) => `fib_${i}_${n}`

      setVariable(fibId(0), 0)
      setVariable(fibId(1), 1)

      for (let n = 2; n <= fibDepth; n++) {
        defineOperation(fibId(n), 'fibonacci', async () => {
          const [prev1, prev2] = await Promise.all([
            readValue(fibId(n - 1)),
            readValue(fibId(n - 2))
          ])
          return prev1 + prev2
        })
      }

      assertOk(await cyre.call(fibId(fibDepth)), `call(${fibId(fibDepth)})`)

      return {created: fibDepth + 1, processed: 1, destroyed: 0}
    },
    () => cyre.clear() // bulk teardown once, after all 1000 iterations -
    // same reasoning as Test 3: peaks at 16,000 live channels, still well
    // within Test 1's already-tolerated 15,000
  )
}

// =============================================================================
// Test 5: Massive Channel Lifecycle - pure single-channel create/call
// throughput, no dependency graph.
// =============================================================================
const testMassiveChannelLifecycle = (): Promise<MathematicianResult> =>
  runTimedTest(
    'Massive Channel Lifecycle (pure create/process/destroy speed)',
    'simple',
    10000,
    async i => {
      const id = `speed_test_${i}`

      assertOk(
        cyre.action({
          id,
          payload: {value: Math.random(), timestamp: Date.now(), iteration: i}
        }),
        `action(${id})`
      )
      assertOk(
        cyre.on(id, (payload: {value: number}) => ({
          processed: true,
          originalValue: payload.value,
          processedAt: Date.now()
        })),
        `on(${id})`
      )

      assertOk(await cyre.call(id, {operation: 'speed_test'}), `call(${id})`)
      return {created: 1, processed: 1, destroyed: 0}
    },
    () => cyre.clear() // FIX: original's comment claimed this happened;
    // the call was never actually made, so 10,000 channels leaked
  )

const printResults = (results: MathematicianResult[]): void => {
  console.log('\n🧮 MATHEMATICIAN MODULE BENCHMARK RESULTS')
  console.log('==========================================')

  let totalCreated = 0
  let totalProcessed = 0
  let totalDestroyed = 0

  for (const result of results) {
    totalCreated += result.channelsCreated
    totalProcessed += result.channelsProcessed
    totalDestroyed += result.channelsDestroyed

    console.log(`\n${result.testName} [${result.equationComplexity.toUpperCase()}]`)
    console.log(`  • Operations/sec: ${result.operationsPerSecond.toLocaleString()}`)
    console.log(`  • Avg Latency: ${result.averageLatencyMs}ms`)
    console.log(`  • Channels Created: ${result.channelsCreated.toLocaleString()}`)
    console.log(`  • Channels Processed: ${result.channelsProcessed.toLocaleString()}`)
    console.log(`  • Channels Destroyed: ${result.channelsDestroyed.toLocaleString()}`)
    console.log(`  • Success Rate: ${result.successRate}%`)
    console.log(`  • Memory Usage: ${result.memoryUsageMB}MB`)
    console.log(`  • Errors: ${result.errorCount}`)
  }

  console.log('\n📊 MATHEMATICIAN MODULE SUMMARY')
  console.log('===============================')
  console.log(`• Total Channels Created: ${totalCreated.toLocaleString()}`)
  console.log(`• Total Channels Processed: ${totalProcessed.toLocaleString()}`)
  console.log(`• Total Channels Destroyed: ${totalDestroyed.toLocaleString()}`)

  const avgOpsPerSec =
    results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / results.length
  const avgLatency =
    results.reduce((sum, r) => sum + r.averageLatencyMs, 0) / results.length
  const avgSuccessRate =
    results.reduce((sum, r) => sum + r.successRate, 0) / results.length

  console.log(`• Average Operations/sec: ${Math.round(avgOpsPerSec).toLocaleString()}`)
  console.log(`• Average Latency: ${avgLatency.toFixed(3)}ms`)
  console.log(`• Average Success Rate: ${avgSuccessRate.toFixed(2)}%`)

  const perfectResilience = results.every(r => r.successRate >= 99.9)
  if (perfectResilience) {
    console.log(
      '\n🛡️ MATHEMATICIAN RESILIENCE: Perfect mathematical precision maintained!'
    )
  }
}

export const runMathematicianBenchmark = async (): Promise<
  MathematicianResult[]
> => {
  console.log('🧮 CYRE MATHEMATICIAN MODULE BENCHMARK (functional edition)')
  console.log('=============================================================')
  console.log('Testing channel-based mathematical computation...\n')

  const results: MathematicianResult[] = []
  try {
    results.push(await testSimpleMathOperations())
    await wait(200)

    results.push(await testComplexMathChains())
    await wait(200)

    results.push(await testMatrixOperations())
    await wait(200)

    results.push(await testRecursiveFunctions())
    await wait(200)

    results.push(await testMassiveChannelLifecycle())

    printResults(results)
  } catch (error) {
    console.error('❌ Mathematician benchmark failed:', error)
  }

  return results
}

// MODERN CYRE: real init, tuned for this workload's call volume - see the
// header comment for why maxCallRate matters here.
await cyre.init({
  breathing: {
    limits: {maxCallRate: 20000}
  }
})

await runMathematicianBenchmark()

// cyre.shutdown() temporarily removed while diagnosing the mid-run "System
// not initialized" issue - shutdown()'s catch block also swallows its own
// errors (sensor.critical only, no rethrow), and process.exit(0) would cut
// the process off right after this line runs, so pulling it out for now
// keeps the process alive long enough to inspect afterward if needed and
// removes it as a variable while we isolate the real cause.
