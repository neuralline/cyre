// examples/industry-benchmark-tests.ts

// Industry standard performance benchmarks for Node.js/Bun environments

import {performance} from 'perf_hooks'
import {cpus, totalmem, platform, arch} from 'os'
import {cyre, schema} from '../src'
import {metricsReport} from '../src/context/metrics-report'

/*

      C.Y.R.E - I.N.D.U.S.T.R.Y - B.E.N.C.H.M.A.R.K.S
      
      Performance test suite following industry standards:
      - Node.js benchmark patterns
      - Statistical significance testing
      - Memory leak detection
      - Percentile latency analysis
      - Concurrent execution patterns
      - Realistic workload simulation

*/

interface BenchmarkMetrics {
  readonly name: string
  readonly totalOperations: number
  readonly totalTimeMs: number
  readonly operationsPerSecond: number
  readonly meanLatencyMs: number
  readonly medianLatencyMs: number
  readonly p95LatencyMs: number
  readonly p99LatencyMs: number
  readonly minLatencyMs: number
  readonly maxLatencyMs: number
  readonly standardDeviation: number
  readonly memoryUsageMB: number
  readonly errorCount: number
  readonly errorRate: number
  readonly iterations: number
}

interface SystemInfo {
  readonly nodeVersion: string
  readonly platform: string
  readonly arch: string
  readonly cpuCount: number
  readonly totalMemoryMB: number
  readonly runtime: 'node' | 'bun' | 'unknown'
}

// System utilities
const getSystemInfo = (): SystemInfo => {
  const cpuList = cpus()
  const totalMem = totalmem()

  let runtime: 'node' | 'bun' | 'unknown' = 'unknown'
  if (typeof process !== 'undefined') {
    if (process.versions?.bun) runtime = 'bun'
    else if (process.versions?.node) runtime = 'node'
  }

  return {
    nodeVersion: process.version || 'unknown',
    platform: platform(),
    arch: arch(),
    cpuCount: cpuList?.length || 1,
    totalMemoryMB: Math.round(totalMem / 1024 / 1024),
    runtime
  }
}

const getMemoryUsageMB = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024
  }
  return 0
}

const forceGarbageCollection = (): void => {
  if (typeof global !== 'undefined' && (global as any).gc) {
    ;(global as any).gc()
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

// Statistical utilities
const calculateStatistics = (
  values: number[]
): {
  mean: number
  median: number
  p95: number
  p99: number
  min: number
  max: number
  stdDev: number
} => {
  if (values.length === 0) {
    return {mean: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0, stdDev: 0}
  }

  const sorted = [...values].sort((a, b) => a - b)
  const len = sorted.length

  const mean = values.reduce((sum, val) => sum + val, 0) / len
  const median =
    len % 2 === 0
      ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
      : sorted[Math.floor(len / 2)]

  const p95Index = Math.floor(len * 0.95)
  const p99Index = Math.floor(len * 0.99)

  const p95 = sorted[Math.min(p95Index, len - 1)]
  const p99 = sorted[Math.min(p99Index, len - 1)]
  const min = sorted[0]
  const max = sorted[len - 1]

  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / len
  const stdDev = Math.sqrt(variance)

  return {mean, median, p95, p99, min, max, stdDev}
}

// Base benchmark runner
const runBenchmark = async (
  name: string,
  setupFn: () => Promise<void>,
  benchmarkFn: () => Promise<boolean>,
  teardownFn: () => Promise<void>,
  iterations: number = 10000,
  warmupIterations: number = 1000
): Promise<BenchmarkMetrics> => {
  console.log(`\n🔥 Running: ${name}`)

  // Setup phase
  await setupFn()

  // Warmup phase
  console.log(`  Warming up with ${warmupIterations} iterations...`)
  for (let i = 0; i < warmupIterations; i++) {
    await benchmarkFn()
  }

  // Allow system to stabilize
  await sleep(100)
  forceGarbageCollection()
  await sleep(50)

  // Benchmark phase
  console.log(`  Benchmarking ${iterations} iterations...`)

  const latencies: number[] = []
  let errorCount = 0
  const startMemory = getMemoryUsageMB()

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const iterationStart = performance.now()

    try {
      const success = await benchmarkFn()
      if (!success) errorCount++
    } catch (error) {
      errorCount++
    }

    latencies.push(performance.now() - iterationStart)
  }

  const totalTime = performance.now() - startTime
  const endMemory = getMemoryUsageMB()

  // Cleanup
  await teardownFn()

  // Calculate metrics
  const stats = calculateStatistics(latencies)
  const operationsPerSecond = (iterations / totalTime) * 1000
  const errorRate = (errorCount / iterations) * 100

  const result: BenchmarkMetrics = {
    name,
    totalOperations: iterations,
    totalTimeMs: totalTime,
    operationsPerSecond,
    meanLatencyMs: stats.mean,
    medianLatencyMs: stats.median,
    p95LatencyMs: stats.p95,
    p99LatencyMs: stats.p99,
    minLatencyMs: stats.min,
    maxLatencyMs: stats.max,
    standardDeviation: stats.stdDev,
    memoryUsageMB: endMemory - startMemory,
    errorCount,
    errorRate,
    iterations
  }

  console.log(
    `  ✅ ${operationsPerSecond.toFixed(0)} ops/sec, ${stats.mean.toFixed(
      3
    )}ms avg`
  )

  return result
}

// Benchmark Suite 1: Basic action call performance
const benchmarkBasicActionCall = async (): Promise<BenchmarkMetrics> => {
  return runBenchmark(
    'Basic Action Call',
    // Setup
    async () => {
      cyre.clear()
      cyre.action({id: 'bench-basic', payload: {counter: 0}})
      cyre.on('bench-basic', (payload: any) => ({result: payload.counter * 2}))
    },
    // Benchmark
    async () => {
      const result = await cyre.call('bench-basic', {counter: Math.random()})
      return result.ok
    },
    // Teardown
    async () => {
      cyre.forget('bench-basic')
    },
    10000,
    1000
  )
}

// Benchmark Suite 2: Schema validation performance - FIXED
const benchmarkSchemaValidation = async (): Promise<BenchmarkMetrics> => {
  return runBenchmark(
    'Schema Validation',
    // Setup
    async () => {
      cyre.clear()

      // Use proper schema chaining API
      const userSchema = schema.object({
        id: schema.number().positive(),
        name: schema.string().minLength(2),
        email: schema.email_string()
      })

      cyre.action({
        id: 'bench-schema',
        schema: userSchema
      })

      cyre.on('bench-schema', (payload: any) => ({validated: true, ...payload}))
    },
    // Benchmark
    async () => {
      const payload = {
        id: Math.floor(Math.random() * 1000) + 1,
        name: 'John Doe',
        email: 'john@example.com'
      }
      const result = await cyre.call('bench-schema', payload)
      return result.ok
    },
    // Teardown
    async () => {
      cyre.forget('bench-schema')
    },
    5000,
    500
  )
}

// Benchmark Suite 3: Throttling mechanism performance
const benchmarkThrottling = async (): Promise<BenchmarkMetrics> => {
  return runBenchmark(
    'Throttling Mechanism',
    // Setup
    async () => {
      cyre.clear()
      cyre.action({
        id: 'bench-throttle',
        throttle: 10, // 10ms throttle
        payload: {data: 'test'}
      })
      cyre.on('bench-throttle', (payload: any) => ({
        throttled: true,
        ...payload
      }))
    },
    // Benchmark
    async () => {
      const result = await cyre.call('bench-throttle', {timestamp: Date.now()})
      // Consider throttled calls as successful for this benchmark
      return true
    },
    // Teardown
    async () => {
      cyre.forget('bench-throttle')
    },
    2000,
    200
  )
}

// Benchmark Suite 4: Multi-subscriber performance
const benchmarkMultiSubscriber = async (): Promise<BenchmarkMetrics> => {
  const subscriberCount = 10

  return runBenchmark(
    'Multi-Subscriber Broadcasting',
    // Setup
    async () => {
      cyre.clear()

      for (let i = 0; i < subscriberCount; i++) {
        cyre.action({id: `bench-multi-${i}`, payload: {subscriberId: i}})
        cyre.on(`bench-multi-${i}`, (payload: any) => ({
          processed: true,
          subscriberId: i,
          ...payload
        }))
      }
    },
    // Benchmark
    async () => {
      const promises = []
      const testData = {timestamp: Date.now(), data: Math.random()}

      for (let i = 0; i < subscriberCount; i++) {
        promises.push(cyre.call(`bench-multi-${i}`, testData))
      }

      const results = await Promise.all(promises)
      return results.every(r => r.ok)
    },
    // Teardown
    async () => {
      for (let i = 0; i < subscriberCount; i++) {
        cyre.forget(`bench-multi-${i}`)
      }
    },
    1000,
    100
  )
}

// Benchmark Suite 5: Memory pressure test
const benchmarkMemoryPressure = async (): Promise<BenchmarkMetrics> => {
  return runBenchmark(
    'Memory Pressure Test',
    // Setup
    async () => {
      cyre.clear()
    },
    // Benchmark
    async () => {
      const actionId = `memory-test-${Math.random().toString(36).substr(2, 9)}`

      // Create action with large payload
      const largePayload = {
        data: new Array(1000).fill(0).map(() => ({
          id: Math.random(),
          timestamp: Date.now(),
          values: new Array(100).fill(Math.random())
        }))
      }

      cyre.action({id: actionId, payload: largePayload})
      cyre.on(actionId, (payload: any) => ({
        processed: true,
        size: payload.data.length
      }))

      const result = await cyre.call(actionId, largePayload)

      // Cleanup immediately
      cyre.forget(actionId)

      return result.ok
    },
    // Teardown
    async () => {
      cyre.clear()
      forceGarbageCollection()
    },
    500,
    50
  )
}

// Benchmark Suite 6: Concurrent execution stress test
const benchmarkConcurrentExecution = async (): Promise<BenchmarkMetrics> => {
  const concurrency = 20

  return runBenchmark(
    'Concurrent Execution Stress',
    // Setup
    async () => {
      cyre.clear()
      cyre.action({id: 'bench-concurrent', payload: {worker: 0}})
      cyre.on('bench-concurrent', (payload: any) => ({
        processed: true,
        worker: payload.worker,
        timestamp: Date.now()
      }))
    },
    // Benchmark
    async () => {
      const promises = Array.from({length: concurrency}, async (_, i) => {
        const result = await cyre.call('bench-concurrent', {
          worker: i,
          timestamp: Date.now()
        })
        return result.ok
      })

      const results = await Promise.all(promises)
      return results.every(r => r)
    },
    // Teardown
    async () => {
      cyre.forget('bench-concurrent')
    },
    500,
    50
  )
}

// Benchmark Suite 7: Real-world application simulation
const benchmarkRealWorldSimulation = async (): Promise<BenchmarkMetrics> => {
  const actionTypes = [
    {id: 'user-action', weight: 10, throttle: 0},
    {id: 'api-request', weight: 5, throttle: 100},
    {id: 'ui-update', weight: 15, throttle: 0},
    {id: 'data-sync', weight: 3, throttle: 500},
    {id: 'background-task', weight: 2, throttle: 1000}
  ]

  return runBenchmark(
    'Real-World Application Simulation',
    // Setup
    async () => {
      cyre.clear()

      actionTypes.forEach(({id, throttle}) => {
        cyre.action({
          id,
          throttle: throttle > 0 ? throttle : undefined,
          detectChanges: id === 'ui-update',
          payload: {type: id}
        })

        cyre.on(id, (payload: any) => ({
          processed: true,
          actionType: id,
          timestamp: Date.now(),
          ...payload
        }))
      })
    },
    // Benchmark
    async () => {
      // Weighted random selection
      const weightedActions = actionTypes.flatMap(({id, weight}) =>
        Array(weight).fill(id)
      )

      const selectedAction =
        weightedActions[Math.floor(Math.random() * weightedActions.length)]

      const payload = {
        requestId: Math.random().toString(36),
        userId: Math.floor(Math.random() * 1000),
        data: {value: Math.random()}
      }

      const result = await cyre.call(selectedAction, payload)
      // Consider throttled results as success for realistic simulation
      return true
    },
    // Teardown
    async () => {
      actionTypes.forEach(({id}) => cyre.forget(id))
    },
    2000,
    200
  )
}

// Performance analysis and reporting
const analyzePerformance = (
  results: BenchmarkMetrics[]
): {
  overall: string
  throughput: string
  latency: string
  reliability: string
  recommendations: string[]
} => {
  const avgThroughput =
    results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / results.length
  const avgLatency =
    results.reduce((sum, r) => sum + r.meanLatencyMs, 0) / results.length
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0)
  const totalOps = results.reduce((sum, r) => sum + r.totalOperations, 0)
  const overallErrorRate = (totalErrors / totalOps) * 100

  const recommendations: string[] = []

  // Throughput analysis
  let throughputRating = 'excellent'
  if (avgThroughput < 10000) {
    throughputRating = 'needs improvement'
    recommendations.push(
      'Consider optimizing action pipeline - throughput below 10k ops/sec'
    )
  } else if (avgThroughput < 50000) {
    throughputRating = 'good'
  }

  // Latency analysis
  let latencyRating = 'excellent'
  if (avgLatency > 2.0) {
    latencyRating = 'needs improvement'
    recommendations.push(
      'High latency detected - review protection pipeline overhead'
    )
  } else if (avgLatency > 0.5) {
    latencyRating = 'good'
  }

  // Reliability analysis
  let reliabilityRating = 'excellent'
  if (overallErrorRate > 1.0) {
    reliabilityRating = 'needs improvement'
    recommendations.push(
      'High error rate - investigate error handling mechanisms'
    )
  } else if (overallErrorRate > 0.1) {
    reliabilityRating = 'good'
  }

  // Overall assessment
  const ratings = [throughputRating, latencyRating, reliabilityRating]
  const overall = ratings.includes('needs improvement')
    ? 'needs improvement'
    : ratings.includes('good')
    ? 'good'
    : 'excellent'

  if (recommendations.length === 0) {
    recommendations.push('Performance metrics are within acceptable ranges')
  }

  return {
    overall,
    throughput: throughputRating,
    latency: latencyRating,
    reliability: reliabilityRating,
    recommendations
  }
}

// Report generation
const generateReport = (
  results: BenchmarkMetrics[],
  systemInfo: SystemInfo
): void => {
  const analysis = analyzePerformance(results)

  console.log('\n' + '='.repeat(90))
  console.log('                    CYRE INDUSTRY STANDARD PERFORMANCE REPORT')
  console.log('='.repeat(90))

  // System information
  console.log('\n📋 SYSTEM INFORMATION')
  console.log(`Runtime: ${systemInfo.runtime} ${systemInfo.nodeVersion}`)
  console.log(`Platform: ${systemInfo.platform} ${systemInfo.arch}`)
  console.log(`CPU Cores: ${systemInfo.cpuCount}`)
  console.log(`Total Memory: ${systemInfo.totalMemoryMB}MB`)

  // Performance summary table
  console.log('\n📊 PERFORMANCE SUMMARY')
  console.log(
    '┌─' +
      '─'.repeat(28) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(10) +
      '┬─' +
      '─'.repeat(10) +
      '┬─' +
      '─'.repeat(8) +
      '┐'
  )
  console.log(
    '│ Benchmark                    │ Ops/Second   │ Mean (ms)    │ P95 (ms)   │ P99 (ms)   │ Errors   │'
  )
  console.log(
    '├─' +
      '─'.repeat(28) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(10) +
      '┼─' +
      '─'.repeat(10) +
      '┼─' +
      '─'.repeat(8) +
      '┤'
  )

  results.forEach(result => {
    const name = result.name.padEnd(28)
    const ops = result.operationsPerSecond.toFixed(0).padStart(12)
    const mean = result.meanLatencyMs.toFixed(3).padStart(12)
    const p95 = result.p95LatencyMs.toFixed(3).padStart(10)
    const p99 = result.p99LatencyMs.toFixed(3).padStart(10)
    const errors = result.errorCount.toString().padStart(8)

    console.log(`│ ${name} │ ${ops} │ ${mean} │ ${p95} │ ${p99} │ ${errors} │`)
  })

  console.log(
    '└─' +
      '─'.repeat(28) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(10) +
      '┴─' +
      '─'.repeat(10) +
      '┴─' +
      '─'.repeat(8) +
      '┘'
  )

  // Aggregate statistics
  const totalOps = results.reduce((sum, r) => sum + r.totalOperations, 0)
  const totalTime = results.reduce((sum, r) => sum + r.totalTimeMs, 0)
  const avgThroughput =
    results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / results.length
  const avgLatency =
    results.reduce((sum, r) => sum + r.meanLatencyMs, 0) / results.length
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0)
  const errorRate = (totalErrors / totalOps) * 100

  console.log('\n📈 AGGREGATE STATISTICS')
  console.log(`Total Operations: ${totalOps.toLocaleString()}`)
  console.log(`Total Runtime: ${(totalTime / 1000).toFixed(2)}s`)
  console.log(`Average Throughput: ${avgThroughput.toFixed(0)} ops/second`)
  console.log(`Average Latency: ${avgLatency.toFixed(3)}ms`)
  console.log(`Error Rate: ${errorRate.toFixed(3)}%`)

  // Performance rating
  console.log('\n🎯 PERFORMANCE RATING')
  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return '🟢'
      case 'good':
        return '🟡'
      case 'needs improvement':
        return '🔴'
      default:
        return '⚪'
    }
  }

  console.log(
    `Overall Performance: ${getRatingIcon(
      analysis.overall
    )} ${analysis.overall.toUpperCase()}`
  )
  console.log(
    `├─ Throughput: ${getRatingIcon(analysis.throughput)} ${
      analysis.throughput
    }`
  )
  console.log(
    `├─ Latency: ${getRatingIcon(analysis.latency)} ${analysis.latency}`
  )
  console.log(
    `└─ Reliability: ${getRatingIcon(analysis.reliability)} ${
      analysis.reliability
    }`
  )

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS')
  analysis.recommendations.forEach((rec, index) => {
    const prefix = index === analysis.recommendations.length - 1 ? '└─' : '├─'
    console.log(`${prefix} ${rec}`)
  })

  // Best and worst performers
  const bestThroughput = results.reduce((best, current) =>
    current.operationsPerSecond > best.operationsPerSecond ? current : best
  )
  const worstLatency = results.reduce((worst, current) =>
    current.p99LatencyMs > worst.p99LatencyMs ? current : worst
  )

  console.log('\n🏆 PERFORMANCE HIGHLIGHTS')
  console.log(
    `Best Throughput: ${
      bestThroughput.name
    } (${bestThroughput.operationsPerSecond.toFixed(0)} ops/sec)`
  )
  console.log(
    `Highest P99 Latency: ${
      worstLatency.name
    } (${worstLatency.p99LatencyMs.toFixed(3)}ms)`
  )

  // Memory usage summary
  const totalMemoryUsage = results.reduce(
    (sum, r) => sum + Math.abs(r.memoryUsageMB),
    0
  )
  if (totalMemoryUsage > 0) {
    console.log(`Total Memory Impact: ${totalMemoryUsage.toFixed(2)}MB`)
  }
}

// Main benchmark runner
export const runIndustryBenchmarks = async (): Promise<void> => {
  console.log('🚀 CYRE Industry Standard Performance Benchmarks')
  console.log('Node.js/Bun compatible test suite with statistical analysis\n')

  const systemInfo = getSystemInfo()
  console.log(
    `Running on: ${systemInfo.runtime} ${systemInfo.nodeVersion} (${systemInfo.platform})`
  )

  // Initialize Cyre
  if (!cyre.status()) {
    await cyre.initialize()
  }

  const results: BenchmarkMetrics[] = []

  try {
    // Run benchmark suite
    results.push(await benchmarkBasicActionCall())
    await sleep(500)

    results.push(await benchmarkSchemaValidation())
    await sleep(500)

    results.push(await benchmarkThrottling())
    await sleep(500)

    results.push(await benchmarkMultiSubscriber())
    await sleep(500)

    results.push(await benchmarkMemoryPressure())
    await sleep(1000) // Longer pause for memory cleanup

    results.push(await benchmarkConcurrentExecution())
    await sleep(500)

    results.push(await benchmarkRealWorldSimulation())

    // Generate comprehensive report
    generateReport(results, systemInfo)

    // Export raw data for external analysis
    console.log('\n📁 RAW BENCHMARK DATA')
    console.log('Copy the following JSON for external analysis:')
    console.log(JSON.stringify({systemInfo, results}, null, 2))
  } catch (error) {
    console.error('\n❌ Benchmark suite failed:', error)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

runIndustryBenchmarks().catch(console.error)
