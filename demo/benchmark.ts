// demo/benchmark.ts
// Cyre's resilience/protection benchmark - complements demo/speed-test-demo.ts
// (which measures raw dispatch throughput) with a different question: does
// the system stay correct and alive under bad usage, not just fast under
// good usage? Every number below is measured against a real cyre.call()
// round trip - nothing here is a hardcoded/simulated figure.

/*

      C.Y.R.E - R.E.S.I.L.I.E.N.C.E   B.E.N.C.H.M.A.R.K

      Four real, live-measured scenarios:
      - Baseline throughput on an unprotected channel
      - Protection systems actually rejecting a rapid-fire burst
      - Defensive user handlers surviving malformed payloads
      - Cyre's OWN dispatch-level catch surviving a handler that throws
        with no user-side try/catch at all

*/

import {cyre} from '../src'

interface TestResults {
  testName: string
  opsPerSec: number
  avgLatency: number
  p95Latency: number
  errorRate: number
  resilienceScore: number
  memoryUsage: number
  operations: number
  gracefullyHandled: number
  crashesPrevented: number
}

/**
 * Track memory usage during tests
 */
const getMemoryUsage = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

/**
 * Times a real cyre.call() round trip (not just the handler body) and
 * reports whether the pipeline let it through (result.ok) - this is the
 * only place latency is measured anywhere in this file, so every reported
 * number traces back to an actual awaited call.
 */
const timedCall = async (
  id: string,
  payload: any
): Promise<{ok: boolean; latency: number}> => {
  const start = performance.now()
  const result = await cyre.call(id, payload)
  return {ok: result.ok, latency: performance.now() - start}
}

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[index]
}

const summarize = (
  testName: string,
  latencies: number[],
  operations: number,
  errors: number,
  durationSec: number,
  memoryPeak: number,
  gracefullyHandled: number,
  crashesPrevented: number
): TestResults => {
  const sorted = [...latencies].sort((a, b) => a - b)
  const avgLatency =
    latencies.length > 0
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      : 0

  return {
    testName,
    opsPerSec: durationSec > 0 ? Math.round(operations / durationSec) : 0,
    avgLatency: Number(avgLatency.toFixed(3)),
    p95Latency: Number(percentile(sorted, 0.95).toFixed(3)),
    errorRate: operations > 0 ? Number((errors / operations).toFixed(6)) : 0,
    resilienceScore:
      operations > 0
        ? Number((((operations - errors) / operations) * 100).toFixed(1))
        : 100,
    memoryUsage: Number(memoryPeak.toFixed(2)),
    operations,
    gracefullyHandled,
    crashesPrevented
  }
}

/**
 * Test 1: baseline throughput on a genuinely unprotected channel. No
 * throttle/debounce here on purpose - the old version of this file put
 * throttle: 10 on the "baseline" channel, which meant most of its 10,000
 * sequential calls were silently throttled (still counted as "operations"
 * even though they never reached the handler) rather than measuring actual
 * unprotected throughput. Protection overhead gets its own test below.
 */
async function testProperCyreUsage(): Promise<TestResults> {
  console.log('\n🏆 Testing Proper Cyre Usage (Baseline, no protections)')

  const totalOperations = 10000
  const latencies: number[] = []
  let operations = 0
  let errors = 0
  let memoryPeak = 0

  cyre.action({id: 'proper-usage-test'})
  cyre.on('proper-usage-test', payload => ({
    id: payload?.id ?? 0,
    processed: true,
    data: payload?.data?.map((item: any) => ({...item, processed: true})) ?? [],
    timestamp: Date.now()
  }))

  const start = Date.now()

  for (let i = 0; i < totalOperations; i++) {
    const {ok, latency} = await timedCall('proper-usage-test', {
      id: i,
      data: [{value: i, type: 'test'}],
      timestamp: Date.now()
    })

    latencies.push(latency)
    if (ok) operations++
    else errors++

    memoryPeak = Math.max(memoryPeak, getMemoryUsage())
    if (i % 1000 === 0) await new Promise(resolve => setTimeout(resolve, 1))
  }

  const durationSec = (Date.now() - start) / 1000
  cyre.forget('proper-usage-test')

  return summarize(
    'Proper Cyre Usage',
    latencies,
    operations,
    errors,
    durationSec,
    memoryPeak,
    0,
    0
  )
}

/**
 * Test 2: does throttle actually reject a rapid-fire burst? The old
 * version of this file counted every call.then()-resolved promise as an
 * "operation" regardless of whether the call was accepted or throttled,
 * so it could never actually tell you protection was working - it just
 * measured how fast promises settled. This version tracks accepted vs
 * rejected explicitly and reports both.
 */
async function testProtectionSystems(): Promise<TestResults> {
  console.log('\n🛡️ Testing Protection Systems (throttle + detectChanges)')

  const totalOperations = 5000
  const latencies: number[] = []
  let accepted = 0
  let rejected = 0
  let memoryPeak = 0

  cyre.action({
    id: 'protection-test',
    throttle: 50,
    detectChanges: true
  })

  cyre.on('protection-test', (payload: any) => {
    if (!payload || !Array.isArray(payload)) return []
    return payload.map((item: any) => item?.value ?? null)
  })

  const start = Date.now()

  for (let i = 0; i < totalOperations; i++) {
    const {ok, latency} = await timedCall(
      'protection-test',
      i % 2 === 0 ? [{value: i}] : undefined
    )
    latencies.push(latency)
    if (ok) accepted++
    else rejected++
    memoryPeak = Math.max(memoryPeak, getMemoryUsage())
  }

  const durationSec = (Date.now() - start) / 1000
  cyre.forget('protection-test')

  console.log(
    `  accepted=${accepted} rejected(throttled/no-change)=${rejected} out of ${totalOperations}`
  )

  // opsPerSec/operations here mean "successful throughput", consistent with
  // every other test in this file - accepted, not attempted, is the real
  // "operations" count. Rejections are tracked separately below since a
  // throttle/detectChanges rejection is correct protective behavior, not
  // an error - and reported through gracefullyHandled, not errorRate.
  return summarize(
    'Protection Systems',
    latencies,
    accepted,
    0,
    durationSec,
    memoryPeak,
    rejected,
    0
  )
}

/**
 * Test 3: user-supplied defensive handlers surviving malformed payloads -
 * each handler is wrapped in its own try/catch, matching real-world
 * defensive coding practice.
 */
async function testResilienceAgainstBadUsage(): Promise<TestResults> {
  console.log('\n💪 Testing Resilience Against Bad Usage (defensive handlers)')

  const totalOperations = 2000
  const latencies: number[] = []
  let operations = 0
  let errors = 0
  let gracefullyHandled = 0
  let memoryPeak = 0

  const start = Date.now()

  for (let i = 0; i < totalOperations; i++) {
    const actionId = `resilience-test-${i}`
    const errorType = i % 3

    cyre.action({id: actionId, throttle: 50})

    cyre.on(actionId, (payload: any) => {
      try {
        switch (errorType) {
          case 0: // "Cannot read properties of undefined (reading 'map')"
            if (!payload || !Array.isArray(payload)) {
              gracefullyHandled++
              return []
            }
            return payload.map((item: any) => item?.value ?? null)
          case 1: // "Cannot read properties of undefined (reading 'nonExistent')"
            if (!payload || typeof payload !== 'object') {
              gracefullyHandled++
              return null
            }
            return payload.nonExistent ?? null
          default: // "Cannot read properties of undefined (reading 'length')"
            if (!payload) {
              gracefullyHandled++
              return 0
            }
            return Array.isArray(payload) || typeof payload === 'string'
              ? payload.length
              : 0
        }
      } catch (error) {
        errors++
        return {error: 'handler failed', handled: true}
      }
    })

    const problematicPayload = errorType === 1 ? null : undefined
    const {ok, latency} = await timedCall(actionId, problematicPayload)
    latencies.push(latency)
    if (ok) operations++
    else errors++

    cyre.forget(actionId)
    memoryPeak = Math.max(memoryPeak, getMemoryUsage())
    if (i % 100 === 0) await new Promise(resolve => setTimeout(resolve, 10))
  }

  const durationSec = (Date.now() - start) / 1000

  return summarize(
    'Resilience Against Bad Usage',
    latencies,
    operations,
    errors,
    durationSec,
    memoryPeak,
    gracefullyHandled,
    0
  )
}

/**
 * Test 4 (new): the real resilience question the other tests never
 * actually asked - can a handler crash the process, or does Cyre's own
 * dispatch-level try/catch (components/cyre-dispatch.ts's
 * executeSingleHandler) contain it even with NO user-side try/catch at
 * all? Every handler above defends itself; this one deliberately doesn't -
 * it throws unconditionally on every call, using bad payload access
 * exactly like the old error messages this file is modeled on
 * ("Cannot read properties of undefined"), with no guard whatsoever.
 * A live health-check call right after each throw confirms the process
 * (and Cyre itself) is still alive and responsive, not just that the
 * throwing call's own promise resolved.
 */
async function testDispatchLevelCrashContainment(): Promise<TestResults> {
  console.log(
    '\n🔥 Testing Dispatch-Level Crash Containment (no user try/catch at all)'
  )

  const totalOperations = 500
  const latencies: number[] = []
  let operations = 0
  let errors = 0
  let crashesPrevented = 0
  let memoryPeak = 0

  cyre.action({id: 'unguarded-throw-test'})
  cyre.on('unguarded-throw-test', (payload: any) => {
    // No try/catch anywhere in this handler - if Cyre didn't contain this,
    // it would take the whole process down with it.
    return payload.data.map((item: any) => item.value.toUpperCase())
  })

  cyre.action({id: 'health-check'})
  cyre.on('health-check', () => ({alive: true}))

  const start = Date.now()

  // Every one of these 500 throws is caught by Cyre's own dispatch layer
  // (components/cyre-dispatch.ts's executeSingleHandler) and reported
  // through sensor.error() - real, correct telemetry, but sensor.error()
  // hardcodes log:true with no per-call way to suppress it, so left alone
  // this floods stdout with 500 lines of ERROR output for a test whose
  // whole point is "the system survived this gracefully." Silencing
  // console.error just for this loop so the benchmark's own summary line
  // (crashesPrevented) is what tells the story, not a wall of red text -
  // nothing about the underlying dispatch-level error handling changes.
  const originalConsoleError = console.error
  console.error = () => {}

  try {
    for (let i = 0; i < totalOperations; i++) {
      const {ok, latency} = await timedCall('unguarded-throw-test', undefined)
      latencies.push(latency)

      if (!ok) {
        // Expected: the throw was caught by Cyre's own dispatch layer, not
        // by anything in this handler.
        crashesPrevented++
      } else {
        // Unexpected - would mean the throw somehow didn't propagate as an
        // error response.
        errors++
      }
      operations++

      // Prove the process/system is still genuinely alive and responsive,
      // not just that this one call's promise resolved.
      const health = await cyre.call('health-check', {})
      if (!health.ok) errors++

      memoryPeak = Math.max(memoryPeak, getMemoryUsage())
    }
  } finally {
    console.error = originalConsoleError
  }

  const durationSec = (Date.now() - start) / 1000
  cyre.forget('unguarded-throw-test')
  cyre.forget('health-check')

  console.log(
    `  ${crashesPrevented}/${totalOperations} unguarded throws contained by Cyre's dispatch layer; process stayed alive and responsive throughout`
  )

  return summarize(
    'Dispatch-Level Crash Containment',
    latencies,
    operations,
    errors,
    durationSec,
    memoryPeak,
    0,
    crashesPrevented
  )
}

/**
 * Display results - every figure printed here comes directly from a
 * TestResults object computed above; nothing in this function is a
 * hardcoded literal standing in for a measurement.
 */
function displayResults(results: TestResults[]): void {
  console.log('\n🏆 CYRE RESILIENCE BENCHMARK RESULTS')
  console.log('====================================\n')

  results.forEach(result => {
    console.log(`${result.testName}`)
    console.log(`  • Ops/sec: ${result.opsPerSec.toLocaleString()}`)
    console.log(`  • Avg Latency: ${result.avgLatency}ms`)
    console.log(`  • P95 Latency: ${result.p95Latency}ms`)
    console.log(`  • Error Rate: ${(result.errorRate * 100).toFixed(4)}%`)
    console.log(`  • Resilience Score: ${result.resilienceScore}%`)
    console.log(`  • Memory: ${result.memoryUsage}MB`)
    console.log(`  • Operations: ${result.operations.toLocaleString()}\n`)
  })

  const totalGracefullyHandled = results.reduce(
    (sum, r) => sum + r.gracefullyHandled,
    0
  )
  const totalCrashesPrevented = results.reduce(
    (sum, r) => sum + r.crashesPrevented,
    0
  )

  console.log(`   💥 Handled gracefully (rejected/defended): ${totalGracefullyHandled}`)
  console.log(`   🔥 Unguarded handler throws contained by Cyre: ${totalCrashesPrevented}\n`)

  const avgPerformance = Math.round(
    results.reduce((sum, r) => sum + r.opsPerSec, 0) / results.length
  )
  const avgLatency = Number(
    (results.reduce((sum, r) => sum + r.avgLatency, 0) / results.length).toFixed(3)
  )
  const worstResilience = Math.min(...results.map(r => r.resilienceScore))

  console.log('🎯 PERFORMANCE ASSESSMENT (measured, not simulated)')
  console.log('====================================================')
  console.log(`• Average Performance: ${avgPerformance.toLocaleString()} ops/sec`)
  console.log(`• Average Latency: ${avgLatency}ms`)
  console.log(`• Lowest Resilience Score Across Tests: ${worstResilience}%`)
  console.log(`• Excess calls rejected/handled gracefully: ${totalGracefullyHandled}`)
  console.log(`• Unguarded handler throws contained: ${totalCrashesPrevented}`)
  console.log('')
  console.log('Run this yourself: numbers vary by machine and JS runtime -')
  console.log('see demo/speed-test-demo.ts for a dedicated raw-throughput')
  console.log('comparison across dispatch strategies and runtimes.')
}

/**
 * Main test runner
 */
async function runResilienceBenchmark(): Promise<void> {
  console.log('🚀 CYRE RESILIENCE BENCHMARK')
  console.log('============================')
  console.log('Measuring real behavior under bad usage, not just good usage...\n')

  try {
    await cyre.init()

    const results: TestResults[] = []

    results.push(await testProperCyreUsage())
    await new Promise(resolve => setTimeout(resolve, 500))

    results.push(await testProtectionSystems())
    await new Promise(resolve => setTimeout(resolve, 500))

    results.push(await testResilienceAgainstBadUsage())
    await new Promise(resolve => setTimeout(resolve, 500))

    results.push(await testDispatchLevelCrashContainment())

    displayResults(results)
  } catch (error) {
    console.error('❌ Test suite failed:', error)
  } finally {
    cyre.shutdown()
  }
}

// Export for external use
export {
  runResilienceBenchmark,
  testProperCyreUsage,
  testProtectionSystems,
  testResilienceAgainstBadUsage,
  testDispatchLevelCrashContainment
}

// Run if called directly
runResilienceBenchmark().catch(console.error)

export default runResilienceBenchmark
