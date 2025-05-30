// example/industry-standard-tests.ts
// Industry-standard performance benchmarks for CYRE

import {cyre} from '../src'
import {metricsReport} from '../src/context/metrics-report'

/*
    CYRE Industry-Standard Performance Test Suite
    
    Following patterns from:
    - Redux DevTools benchmarks
    - RxJS performance tests  
    - React profiler patterns
    - Node.js benchmark suite standards
*/

interface BenchmarkResult {
  name: string
  opsPerSecond: number
  avgLatency: number
  p95Latency: number
  p99Latency: number
  memoryUsage: number
  errors: number
  iterations: number
}

interface ComparisonFramework {
  name: string
  setup: () => any
  execute: (framework: any, payload: any) => Promise<any>
  cleanup: (framework: any) => void
}

// Utility functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const measureMemory = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor((p / 100) * sorted.length)
  return sorted[index] || 0
}

const runGC = () => {
  if (typeof global !== 'undefined' && global.gc) {
    global.gc()
  }
}

/**
 * BENCHMARK 1: Basic Action/Call Performance
 * Industry standard: Measure raw throughput and latency
 */
async function benchmarkBasicPerformance(): Promise<BenchmarkResult> {
  console.log('\n🔥 BENCHMARK 1: Basic Action/Call Performance')

  // Setup
  metricsReport.reset()
  const iterations = 10000
  const warmupIterations = 1000

  cyre.action({id: 'bench-basic', payload: {counter: 0}})
  cyre.on('bench-basic', payload => ({result: payload.counter * 2}))

  // Warmup phase (standard practice)
  console.log(`  Warming up with ${warmupIterations} iterations...`)
  for (let i = 0; i < warmupIterations; i++) {
    await cyre.call('bench-basic', {counter: i})
  }

  await sleep(100) // Let system stabilize
  runGC()

  // Actual benchmark
  console.log(`  Running ${iterations} iterations...`)
  const startMemory = measureMemory()
  const latencies: number[] = []
  let errors = 0

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const callStart = performance.now()

    try {
      const result = await cyre.call('bench-basic', {counter: i})
      if (!result.ok) errors++
    } catch (error) {
      errors++
    }

    latencies.push(performance.now() - callStart)
  }

  const totalTime = performance.now() - startTime
  const endMemory = measureMemory()

  // Calculate metrics
  const opsPerSecond = (iterations / totalTime) * 1000
  const avgLatency =
    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length

  const result: BenchmarkResult = {
    name: 'Basic Action/Call',
    opsPerSecond,
    avgLatency,
    p95Latency: percentile(latencies, 95),
    p99Latency: percentile(latencies, 99),
    memoryUsage: endMemory - startMemory,
    errors,
    iterations
  }

  console.log(
    `  ✅ ${opsPerSecond.toFixed(0)} ops/sec, ${avgLatency.toFixed(
      3
    )}ms avg latency`
  )
  return result
}

/**
 * BENCHMARK 2: Subscription/Handler Performance
 * Measures multi-subscriber scenarios
 */
async function benchmarkSubscriptionPerformance(): Promise<BenchmarkResult> {
  console.log('\n🔥 BENCHMARK 2: Multi-Subscriber Performance')

  metricsReport.reset()
  const iterations = 5000
  const subscriberCount = 10

  // Setup multiple subscribers
  cyre.action({id: 'bench-multi', payload: {data: 'test'}})

  for (let i = 0; i < subscriberCount; i++) {
    cyre.on(`bench-multi-${i}`, payload => ({
      subscriberId: i,
      processed: payload.data
    }))
    cyre.action({id: `bench-multi-${i}`, payload: {data: 'test'}})
  }

  // Benchmark
  const latencies: number[] = []
  let errors = 0

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const callStart = performance.now()

    try {
      // Call all subscribers
      const promises = []
      for (let j = 0; j < subscriberCount; j++) {
        promises.push(cyre.call(`bench-multi-${j}`, {data: `test-${i}`}))
      }

      const results = await Promise.all(promises)
      const failed = results.filter(r => !r.ok).length
      errors += failed
    } catch (error) {
      errors++
    }

    latencies.push(performance.now() - callStart)
  }

  const totalTime = performance.now() - startTime
  const opsPerSecond = (iterations / totalTime) * 1000
  const avgLatency =
    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length

  const result: BenchmarkResult = {
    name: 'Multi-Subscriber',
    opsPerSecond,
    avgLatency,
    p95Latency: percentile(latencies, 95),
    p99Latency: percentile(latencies, 99),
    memoryUsage: 0,
    errors,
    iterations
  }

  console.log(
    `  ✅ ${opsPerSecond.toFixed(
      0
    )} ops/sec across ${subscriberCount} subscribers`
  )
  return result
}

/**
 * BENCHMARK 3: Protection Mechanism Performance
 * Tests throttle/debounce under realistic conditions
 */
async function benchmarkProtectionPerformance(): Promise<BenchmarkResult> {
  console.log('\n🔥 BENCHMARK 3: Protection Mechanism Performance')

  metricsReport.reset()
  const iterations = 2000

  // Test throttle protection
  cyre.action({
    id: 'bench-throttle',
    throttle: 10, // 10ms throttle
    payload: {data: 'test'}
  })

  cyre.on('bench-throttle', payload => ({throttled: true, data: payload.data}))

  const latencies: number[] = []
  let errors = 0
  let throttledCount = 0

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const callStart = performance.now()

    try {
      const result = await cyre.call('bench-throttle', {data: `test-${i}`})
      if (!result.ok) {
        if (result.message.includes('Throttled')) {
          throttledCount++
        } else {
          errors++
        }
      }
    } catch (error) {
      errors++
    }

    latencies.push(performance.now() - callStart)

    // Small delay to test throttling realistically
    if (i % 5 === 0) await sleep(1)
  }

  const totalTime = performance.now() - startTime
  const opsPerSecond = (iterations / totalTime) * 1000
  const avgLatency =
    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length

  console.log(`  ℹ️  ${throttledCount} calls throttled (expected behavior)`)

  const result: BenchmarkResult = {
    name: 'Throttle Protection',
    opsPerSecond,
    avgLatency,
    p95Latency: percentile(latencies, 95),
    p99Latency: percentile(latencies, 99),
    memoryUsage: 0,
    errors,
    iterations
  }

  console.log(`  ✅ ${opsPerSecond.toFixed(0)} ops/sec with throttling`)
  return result
}

/**
 * BENCHMARK 4: Memory Stress Test
 * Industry standard: Create/destroy many objects
 */
async function benchmarkMemoryStress(): Promise<BenchmarkResult> {
  console.log('\n🔥 BENCHMARK 4: Memory Stress Test')

  metricsReport.reset()
  const cycles = 100
  const actionsPerCycle = 50

  const startMemory = measureMemory()
  const latencies: number[] = []
  let errors = 0

  const startTime = performance.now()

  for (let cycle = 0; cycle < cycles; cycle++) {
    const cycleStart = performance.now()

    // Create actions
    const actionIds: string[] = []
    for (let i = 0; i < actionsPerCycle; i++) {
      const actionId = `stress-${cycle}-${i}`
      actionIds.push(actionId)

      try {
        cyre.action({id: actionId, payload: {cycle, iteration: i}})
        cyre.on(actionId, payload => ({processed: true, ...payload}))

        // Execute once
        const result = await cyre.call(actionId, {test: true})
        if (!result.ok) errors++
      } catch (error) {
        errors++
      }
    }

    // Clean up
    actionIds.forEach(id => cyre.forget(id))

    latencies.push(performance.now() - cycleStart)

    // Periodic GC
    if (cycle % 10 === 0) {
      runGC()
      await sleep(1)
    }
  }

  const totalTime = performance.now() - startTime
  const endMemory = measureMemory()

  const opsPerSecond = (cycles / totalTime) * 1000
  const avgLatency =
    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length

  const result: BenchmarkResult = {
    name: 'Memory Stress',
    opsPerSecond,
    avgLatency,
    p95Latency: percentile(latencies, 95),
    p99Latency: percentile(latencies, 99),
    memoryUsage: endMemory - startMemory,
    errors,
    iterations: cycles
  }

  console.log(
    `  ✅ ${cycles} cycles completed, ${(endMemory - startMemory).toFixed(
      2
    )}MB memory change`
  )
  return result
}

/**
 * BENCHMARK 5: Concurrent Load Test
 * Industry standard: Measure under concurrent load
 */
async function benchmarkConcurrentLoad(): Promise<BenchmarkResult> {
  console.log('\n🔥 BENCHMARK 5: Concurrent Load Test')

  metricsReport.reset()
  const concurrency = 10
  const iterationsPerWorker = 500

  // Setup
  cyre.action({id: 'bench-concurrent', payload: {worker: 0, iteration: 0}})
  cyre.on('bench-concurrent', payload => ({
    processed: true,
    worker: payload.worker,
    iteration: payload.iteration
  }))

  const startTime = performance.now()
  let totalErrors = 0
  const allLatencies: number[] = []

  // Create concurrent workers
  const workers = Array.from({length: concurrency}, async (_, workerId) => {
    const workerLatencies: number[] = []
    let workerErrors = 0

    for (let i = 0; i < iterationsPerWorker; i++) {
      const callStart = performance.now()

      try {
        const result = await cyre.call('bench-concurrent', {
          worker: workerId,
          iteration: i
        })

        if (!result.ok) workerErrors++
      } catch (error) {
        workerErrors++
      }

      workerLatencies.push(performance.now() - callStart)
    }

    return {workerErrors, workerLatencies}
  })

  // Wait for all workers
  const results = await Promise.all(workers)

  const totalTime = performance.now() - startTime

  // Aggregate results
  results.forEach(({workerErrors, workerLatencies}) => {
    totalErrors += workerErrors
    allLatencies.push(...workerLatencies)
  })

  const totalIterations = concurrency * iterationsPerWorker
  const opsPerSecond = (totalIterations / totalTime) * 1000
  const avgLatency =
    allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length

  const result: BenchmarkResult = {
    name: 'Concurrent Load',
    opsPerSecond,
    avgLatency,
    p95Latency: percentile(allLatencies, 95),
    p99Latency: percentile(allLatencies, 99),
    memoryUsage: 0,
    errors: totalErrors,
    iterations: totalIterations
  }

  console.log(
    `  ✅ ${opsPerSecond.toFixed(
      0
    )} ops/sec with ${concurrency} concurrent workers`
  )
  return result
}

/**
 * BENCHMARK 6: Real-world Application Simulation
 * Simulates typical application patterns
 */
async function benchmarkRealWorldSimulation(): Promise<BenchmarkResult> {
  console.log('\n🔥 BENCHMARK 6: Real-World Application Simulation')

  metricsReport.reset()
  const iterations = 1000

  // Setup realistic application actions
  const actions = [
    {id: 'user-login', weight: 1},
    {id: 'fetch-data', weight: 5},
    {id: 'update-ui', weight: 10},
    {id: 'save-data', weight: 2},
    {id: 'navigation', weight: 3}
  ]

  actions.forEach(({id}) => {
    cyre.action({
      id,
      payload: {timestamp: Date.now()},
      detectChanges: id === 'update-ui', // Only UI updates need change detection
      throttle: id === 'save-data' ? 100 : undefined // Throttle saves
    })

    cyre.on(id, payload => ({
      actionType: id,
      processed: true,
      timestamp: Date.now(),
      ...payload
    }))
  })

  // Create weighted action selection
  const weightedActions: string[] = []
  actions.forEach(({id, weight}) => {
    for (let i = 0; i < weight; i++) {
      weightedActions.push(id)
    }
  })

  const latencies: number[] = []
  let errors = 0

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    // Randomly select action based on weights
    const actionId =
      weightedActions[Math.floor(Math.random() * weightedActions.length)]

    const callStart = performance.now()

    try {
      const result = await cyre.call(actionId, {
        requestId: i,
        userId: Math.floor(Math.random() * 100),
        data: `payload-${i}`
      })

      if (!result.ok && !result.message.includes('Throttled')) {
        errors++
      }
    } catch (error) {
      errors++
    }

    latencies.push(performance.now() - callStart)

    // Simulate realistic timing
    if (i % 10 === 0) await sleep(1)
  }

  const totalTime = performance.now() - startTime
  const opsPerSecond = (iterations / totalTime) * 1000
  const avgLatency =
    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length

  const result: BenchmarkResult = {
    name: 'Real-World Simulation',
    opsPerSecond,
    avgLatency,
    p95Latency: percentile(latencies, 95),
    p99Latency: percentile(latencies, 99),
    memoryUsage: 0,
    errors,
    iterations
  }

  console.log(
    `  ✅ ${opsPerSecond.toFixed(0)} ops/sec realistic application load`
  )
  return result
}

/**
 * Generate Industry-Standard Performance Report
 */
function generatePerformanceReport(results: BenchmarkResult[]): void {
  console.log('\n' + '='.repeat(80))
  console.log('  CYRE INDUSTRY-STANDARD PERFORMANCE REPORT')
  console.log('='.repeat(80))

  // Summary table
  console.log('\n📊 PERFORMANCE SUMMARY')
  console.log(
    '┌' +
      '─'.repeat(25) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(10) +
      '┬' +
      '─'.repeat(8) +
      '┐'
  )
  console.log(
    '│ Benchmark               │ Ops/Sec     │ Avg Latency  │ P95 (ms)   │ Errors   │'
  )
  console.log(
    '├' +
      '─'.repeat(25) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(10) +
      '┼' +
      '─'.repeat(8) +
      '┤'
  )

  results.forEach(result => {
    const name = result.name.padEnd(23)
    const ops = result.opsPerSecond.toFixed(0).padStart(10)
    const avg = result.avgLatency.toFixed(3).padStart(10)
    const p95 = result.p95Latency.toFixed(3).padStart(8)
    const errors = result.errors.toString().padStart(6)

    console.log(`│ ${name} │ ${ops}   │ ${avg}    │ ${p95}    │ ${errors}   │`)
  })

  console.log(
    '└' +
      '─'.repeat(25) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(10) +
      '┴' +
      '─'.repeat(8) +
      '┘'
  )

  // Performance analysis
  console.log('\n🔍 PERFORMANCE ANALYSIS')

  const avgOps =
    results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length
  const avgLatency =
    results.reduce((sum, r) => sum + r.avgLatency, 0) / results.length
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
  const totalIterations = results.reduce((sum, r) => sum + r.iterations, 0)
  const errorRate = (totalErrors / totalIterations) * 100

  console.log(`Average Throughput: ${avgOps.toFixed(0)} operations/second`)
  console.log(`Average Latency: ${avgLatency.toFixed(3)}ms`)
  console.log(
    `Error Rate: ${errorRate.toFixed(3)}% (${totalErrors}/${totalIterations})`
  )

  // Industry comparison
  console.log('\n📈 INDUSTRY COMPARISON')
  console.log('CYRE vs Industry Standards:')
  console.log(
    `├─ Throughput: ${
      avgOps > 50000
        ? '🟢 Excellent'
        : avgOps > 20000
        ? '🟡 Good'
        : '🔴 Needs Improvement'
    } (${avgOps.toFixed(0)} ops/sec)`
  )
  console.log(
    `├─ Latency: ${
      avgLatency < 0.5
        ? '🟢 Excellent'
        : avgLatency < 2
        ? '🟡 Good'
        : '🔴 Needs Improvement'
    } (${avgLatency.toFixed(3)}ms)`
  )
  console.log(
    `├─ Reliability: ${
      errorRate < 0.1
        ? '🟢 Excellent'
        : errorRate < 1
        ? '🟡 Good'
        : '🔴 Needs Improvement'
    } (${errorRate.toFixed(3)}% errors)`
  )
  console.log(
    `└─ Memory: ${
      results.some(r => r.memoryUsage > 0) ? 'Measured' : 'Not measured'
    }`
  )

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS')

  if (avgLatency > 1) {
    console.log('⚠️  Consider optimizing pipeline overhead - latency above 1ms')
  }

  if (errorRate > 1) {
    console.log('⚠️  High error rate detected - investigate error handling')
  }

  if (avgOps < 20000) {
    console.log('⚠️  Throughput below industry standards - profile bottlenecks')
  }

  const bestPerformer = results.reduce((best, current) =>
    current.opsPerSecond > best.opsPerSecond ? current : best
  )
  console.log(
    `✅ Best performing scenario: ${
      bestPerformer.name
    } (${bestPerformer.opsPerSecond.toFixed(0)} ops/sec)`
  )

  // Export data for external analysis
  console.log('\n📁 RAW DATA')
  console.log('Full benchmark data available for analysis:')
  console.log(JSON.stringify(results, null, 2))
}

/**
 * Main test runner
 */
export async function runIndustryStandardTests(): Promise<void> {
  console.log('🚀 CYRE Industry-Standard Performance Test Suite')
  console.log('Following React, Redux, RxJS benchmark methodologies\n')

  // Initialize system
  if (!cyre.status) {
    await cyre.initialize()
  }

  const results: BenchmarkResult[] = []

  try {
    // Run benchmarks in sequence
    results.push(await benchmarkBasicPerformance())
    await sleep(500)

    results.push(await benchmarkSubscriptionPerformance())
    await sleep(500)

    results.push(await benchmarkProtectionPerformance())
    await sleep(500)

    results.push(await benchmarkMemoryStress())
    await sleep(500)

    results.push(await benchmarkConcurrentLoad())
    await sleep(500)

    results.push(await benchmarkRealWorldSimulation())

    // Generate comprehensive report
    generatePerformanceReport(results)
  } catch (error) {
    console.error('❌ Benchmark suite failed:', error)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
  }
}

// Auto-run if executed directlyif (require.main === module) {
runIndustryStandardTests()
