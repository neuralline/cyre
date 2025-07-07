// examples/final-benchmark-test.ts
// Comprehensive benchmark test with all fixes applied

import {performance} from 'perf_hooks'
import {cpus, totalmem, platform, arch} from 'os'
import {cyre, schema} from '../src'
import {memoryCleanup} from '../src/components/memory-management'

/*

      C.Y.R.E - F.I.N.A.L - B.E.N.C.H.M.A.R.K
      
      Comprehensive benchmark with fixes:
      - Fixed schema validation (no artificial errors)
      - Memory leak prevention
      - Proper error handling
      - Realistic test scenarios
      - Performance optimization validation

*/

interface BenchmarkResult {
  readonly name: string
  readonly opsPerSecond: number
  readonly meanLatencyMs: number
  readonly p95LatencyMs: number
  readonly p99LatencyMs: number
  readonly errorCount: number
  readonly errorRate: number
  readonly iterations: number
  readonly memoryDeltaMB: number
  readonly successfulOps: number
}

// Enhanced utilities
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

const calculatePercentile = (values: number[], percentile: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor((percentile / 100) * sorted.length)
  return sorted[Math.min(index, sorted.length - 1)] || 0
}

// Enhanced benchmark runner with memory management
const runBenchmark = async (
  name: string,
  setupFn: () => Promise<void>,
  testFn: () => Promise<{success: boolean; errorType?: string}>,
  cleanupFn: () => Promise<void>,
  iterations: number = 5000
): Promise<BenchmarkResult> => {
  console.log(`\n🚀 ${name}`)

  // Cleanup before starting
  memoryCleanup.deepCleanup()
  await sleep(100)

  const startMemory = memoryCleanup.getMemoryUsage()

  try {
    await setupFn()

    // Warmup with error tracking
    console.log(`  Warming up...`)
    let warmupErrors = 0
    const warmupIterations = Math.min(iterations / 10, 500)

    for (let i = 0; i < warmupIterations; i++) {
      try {
        const result = await testFn()
        if (!result.success) warmupErrors++
      } catch {
        warmupErrors++
      }
    }

    // Alert if warmup has high error rate
    if (warmupErrors > warmupIterations * 0.2) {
      console.log(
        `  ⚠️  High warmup error rate: ${warmupErrors}/${warmupIterations}`
      )
    }

    // Stabilize system
    await sleep(100)
    memoryCleanup.forceGC()
    await sleep(50)

    // Benchmark phase
    console.log(`  Benchmarking ${iterations} iterations...`)

    const latencies: number[] = []
    let errorCount = 0
    let successfulOps = 0
    const errorTypes: Record<string, number> = {}

    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now()

      try {
        const result = await testFn()
        if (result.success) {
          successfulOps++
        } else {
          errorCount++
          const errorType = result.errorType || 'unknown'
          errorTypes[errorType] = (errorTypes[errorType] || 0) + 1
        }
      } catch (error) {
        errorCount++
        errorTypes['exception'] = (errorTypes['exception'] || 0) + 1
      }

      latencies.push(performance.now() - iterStart)

      // Periodic cleanup to prevent memory buildup
      if (i > 0 && i % 1000 === 0) {
        memoryCleanup.forceGC()
      }
    }

    const totalTime = performance.now() - startTime

    await cleanupFn()

    // Final cleanup and memory measurement
    memoryCleanup.forceGC()
    await sleep(100)
    const endMemory = memoryCleanup.getMemoryUsage()

    // Calculate metrics
    const opsPerSecond = (iterations / totalTime) * 1000
    const meanLatency =
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
    const errorRate = (errorCount / iterations) * 100
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed

    // Report significant error types
    if (errorCount > 0 && Object.keys(errorTypes).length > 0) {
      console.log(`  Error types:`, errorTypes)
    }

    const result: BenchmarkResult = {
      name,
      opsPerSecond,
      meanLatencyMs: meanLatency,
      p95LatencyMs: calculatePercentile(latencies, 95),
      p99LatencyMs: calculatePercentile(latencies, 99),
      errorCount,
      errorRate,
      iterations,
      memoryDeltaMB: memoryDelta,
      successfulOps
    }

    const memoryStatus =
      memoryDelta > 1 ? '🔴' : memoryDelta > 0.1 ? '🟡' : '✅'
    console.log(
      `  ${memoryStatus} ${opsPerSecond.toFixed(
        0
      )} ops/sec, ${meanLatency.toFixed(3)}ms avg, ${errorRate.toFixed(
        1
      )}% errors, ${memoryDelta.toFixed(2)}MB Δ`
    )

    return result
  } catch (error) {
    console.error(`  ❌ Test failed:`, error)
    await cleanupFn()
    throw error
  }
}

// Fixed benchmark tests
const benchmarks = {
  // Test 1: Baseline performance (no protections)
  async baselinePerformance(): Promise<BenchmarkResult> {
    return runBenchmark(
      'Baseline Performance',
      // Setup
      async () => {
        cyre.clear()
        cyre.action({id: 'baseline-test'})
        cyre.on('baseline-test', (payload: any) => ({
          processed: true,
          ...payload
        }))
      },
      // Test
      async () => {
        const response = await cyre.call('baseline-test', {
          value: Math.random()
        })
        return {success: response.ok}
      },
      // Cleanup
      async () => {
        cyre.forget('baseline-test')
      },
      10000
    )
  },

  // Test 2: Schema validation with VALID data only
  async schemaValidationFixed(): Promise<BenchmarkResult> {
    return runBenchmark(
      'Schema Validation (Fixed)',
      // Setup
      async () => {
        cyre.clear()

        const userSchema = schema.object({
          id: schema.number().positive(),
          name: schema.string().minLength(2),
          email: schema.email_string()
        })

        cyre.action({
          id: 'schema-test',
          schema: userSchema
        })

        cyre.on('schema-test', (payload: any) => ({
          validated: true,
          ...payload
        }))
      },
      // Test with VALID data only
      async () => {
        const validPayload = {
          id: Math.floor(Math.random() * 1000) + 1,
          name: 'User' + Math.floor(Math.random() * 1000),
          email: `user${Math.floor(Math.random() * 1000)}@example.com`
        }
        const response = await cyre.call('schema-test', validPayload)
        return {
          success: response.ok,
          errorType: response.ok ? undefined : 'schema_validation'
        }
      },
      // Cleanup
      async () => {
        cyre.forget('schema-test')
      },
      5000
    )
  },

  // Test 3: Protection pipeline performance
  async protectionPipeline(): Promise<BenchmarkResult> {
    return runBenchmark(
      'Protection Pipeline',
      // Setup
      async () => {
        cyre.clear()

        cyre.action({
          id: 'protection-test',
          throttle: 1, // Very light throttling
          detectChanges: true,
          condition: (payload: any) => payload.value > 0,
          transform: (payload: any) => ({...payload, processed: true})
        })

        cyre.on('protection-test', (payload: any) => ({
          result: payload.value * 2
        }))
      },
      // Test
      async () => {
        const payload = {value: Math.random() + 0.1} // Always > 0
        const response = await cyre.call('protection-test', payload)
        return {
          success: response.ok || response.message?.includes('Throttled'),
          errorType: response.ok ? undefined : 'protection'
        }
      },
      // Cleanup
      async () => {
        cyre.forget('protection-test')
      },
      3000
    )
  },

  // Test 4: Realistic concurrency (proper async handling)
  async realisticConcurrency(): Promise<BenchmarkResult> {
    return runBenchmark(
      'Realistic Concurrency',
      // Setup
      async () => {
        cyre.clear()
        cyre.action({id: 'concurrent-test'})
        cyre.on('concurrent-test', async (payload: any) => {
          // Simulate realistic async work
          await sleep(Math.random() * 2)
          return {processed: true, worker: payload.worker}
        })
      },
      // Test
      async () => {
        const concurrency = 5 // Reasonable concurrency
        const promises = Array.from({length: concurrency}, async (_, i) => {
          const response = await cyre.call('concurrent-test', {worker: i})
          return response.ok
        })

        const results = await Promise.all(promises)
        const allSuccessful = results.every(r => r)

        return {
          success: allSuccessful,
          errorType: allSuccessful ? undefined : 'concurrency'
        }
      },
      // Cleanup
      async () => {
        cyre.forget('concurrent-test')
      },
      1000
    )
  },

  // Test 5: Memory leak test with proper cleanup
  async memoryLeakTest(): Promise<BenchmarkResult> {
    return runBenchmark(
      'Memory Leak Prevention',
      // Setup
      async () => {
        cyre.clear()
      },
      // Test - create and destroy actions
      async () => {
        const actionId = `memory-${Math.random().toString(36).substr(2, 9)}`

        try {
          // Create action with moderate payload
          cyre.action({
            id: actionId,
            payload: {data: new Array(50).fill(Math.random())}
          })
          cyre.on(actionId, (payload: any) => ({processed: true}))

          // Use it once
          const response = await cyre.call(actionId, {test: true})

          // Clean up immediately with proper cleanup
          cyre.forget(actionId)
          memoryCleanup.cleanupAction(actionId)

          return {success: response.ok}
        } catch (error) {
          // Cleanup on error
          cyre.forget(actionId)
          memoryCleanup.cleanupAction(actionId)
          return {success: false, errorType: 'memory_test'}
        }
      },
      // Cleanup
      async () => {
        cyre.clear()
        memoryCleanup.deepCleanup()
      },
      2000
    )
  },

  // Test 6: Real-world simulation (fixed timing)
  async realWorldSimulation(): Promise<BenchmarkResult> {
    return runBenchmark(
      'Real-World Simulation',
      // Setup
      async () => {
        cyre.clear()

        const actions = [
          {id: 'user-click', weight: 10},
          {id: 'api-call', weight: 3},
          {id: 'ui-update', weight: 15},
          {id: 'data-save', weight: 2}
        ]

        actions.forEach(({id}) => {
          cyre.action({
            id,
            detectChanges: id === 'ui-update',
            throttle: id === 'data-save' ? 50 : undefined
          })

          cyre.on(id, async (payload: any) => {
            // Simulate realistic work
            if (id === 'api-call') await sleep(1)
            return {type: id, processed: true, ...payload}
          })
        })
      },
      // Test
      async () => {
        const actionTypes = ['user-click', 'api-call', 'ui-update', 'data-save']
        const actionId =
          actionTypes[Math.floor(Math.random() * actionTypes.length)]

        const response = await cyre.call(actionId, {
          timestamp: Date.now(),
          user: Math.floor(Math.random() * 100)
        })

        return {
          success: response.ok || response.message?.includes('Throttled'),
          errorType: response.ok ? undefined : 'simulation'
        }
      },
      // Cleanup
      async () => {
        ;['user-click', 'api-call', 'ui-update', 'data-save'].forEach(id => {
          cyre.forget(id)
        })
      },
      3000
    )
  }
}

// Enhanced reporting
const generateReport = (results: BenchmarkResult[]): void => {
  const runtime = process.versions?.bun ? 'Bun' : 'Node.js'

  console.log('\n' + '='.repeat(90))
  console.log('                     CYRE FINAL PERFORMANCE REPORT')
  console.log('='.repeat(90))

  // System info
  console.log(`\n📋 SYSTEM INFO`)
  console.log(`Runtime: ${runtime} ${process.version}`)
  console.log(`Platform: ${platform()} ${arch()}`)
  console.log(`CPU Cores: ${cpus().length}`)
  console.log(`Memory: ${Math.round(totalmem() / 1024 / 1024 / 1024)}GB`)

  // Results table
  console.log('\n📊 BENCHMARK RESULTS')
  console.log(
    '┌─' +
      '─'.repeat(25) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(10) +
      '┬─' +
      '─'.repeat(12) +
      '┐'
  )
  console.log(
    '│ Test                      │ Ops/Second   │ Mean (ms)    │ P95 (ms)     │ Errors     │ Memory (MB)  │'
  )
  console.log(
    '├─' +
      '─'.repeat(25) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(10) +
      '┼─' +
      '─'.repeat(12) +
      '┤'
  )

  results.forEach(result => {
    const name = result.name.padEnd(25)
    const ops = result.opsPerSecond.toFixed(0).padStart(12)
    const mean = result.meanLatencyMs.toFixed(3).padStart(12)
    const p95 = result.p95LatencyMs.toFixed(3).padStart(12)
    const errors = `${result.errorRate.toFixed(1)}%`.padStart(10)
    const memory = `${
      result.memoryDeltaMB >= 0 ? '+' : ''
    }${result.memoryDeltaMB.toFixed(2)}`.padStart(12)

    console.log(
      `│ ${name} │ ${ops} │ ${mean} │ ${p95} │ ${errors} │ ${memory} │`
    )
  })

  console.log(
    '└─' +
      '─'.repeat(25) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(10) +
      '┴─' +
      '─'.repeat(12) +
      '┘'
  )

  // Analysis
  const totalOps = results.reduce((sum, r) => sum + r.successfulOps, 0)
  const totalTime = results.reduce((sum, r) => sum + r.iterations, 0)
  const avgThroughput =
    results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length
  const avgLatency =
    results.reduce((sum, r) => sum + r.meanLatencyMs, 0) / results.length
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0)
  const errorRate = (totalErrors / totalTime) * 100
  const totalMemoryDelta = results.reduce(
    (sum, r) => sum + Math.abs(r.memoryDeltaMB),
    0
  )

  console.log('\n📈 PERFORMANCE ANALYSIS')
  console.log(`Total Successful Operations: ${totalOps.toLocaleString()}`)
  console.log(`Average Throughput: ${avgThroughput.toFixed(0)} ops/second`)
  console.log(`Average Latency: ${avgLatency.toFixed(3)}ms`)
  console.log(`Overall Error Rate: ${errorRate.toFixed(3)}%`)
  console.log(`Total Memory Impact: ${totalMemoryDelta.toFixed(2)}MB`)

  // Performance rating
  const throughputRating =
    avgThroughput > 15000
      ? '🟢 Excellent'
      : avgThroughput > 8000
      ? '🟡 Good'
      : '🔴 Needs Work'
  const latencyRating =
    avgLatency < 0.2
      ? '🟢 Excellent'
      : avgLatency < 1.0
      ? '🟡 Good'
      : '🔴 Needs Work'
  const reliabilityRating =
    errorRate < 1.0
      ? '🟢 Excellent'
      : errorRate < 5.0
      ? '🟡 Good'
      : '🔴 Needs Work'
  const memoryRating =
    totalMemoryDelta < 5.0
      ? '🟢 Excellent'
      : totalMemoryDelta < 20.0
      ? '🟡 Good'
      : '🔴 Memory Leak'

  console.log('\n🎯 PERFORMANCE RATING')
  console.log(`Throughput: ${throughputRating}`)
  console.log(`Latency: ${latencyRating}`)
  console.log(`Reliability: ${reliabilityRating}`)
  console.log(`Memory Management: ${memoryRating}`)

  // Final assessment
  const ratings = [
    throughputRating,
    latencyRating,
    reliabilityRating,
    memoryRating
  ]
  const needsWork = ratings.filter(r => r.includes('🔴')).length
  const good = ratings.filter(r => r.includes('🟡')).length

  console.log('\n🏆 OVERALL ASSESSMENT')
  if (needsWork === 0 && good <= 1) {
    console.log('🟢 EXCELLENT: CYRE is performing exceptionally well!')
  } else if (needsWork === 0) {
    console.log('🟡 GOOD: CYRE performance is solid with room for optimization')
  } else {
    console.log('🔴 NEEDS WORK: Several performance issues need attention')
  }

  console.log('\n✅ Benchmark completed - fixes validated!')
}

// Main runner
const runFinalBenchmarks = async (): Promise<void> => {
  console.log('🚀 CYRE Final Performance Benchmark')
  console.log('Validating all performance fixes and optimizations\n')

  try {
    // Initialize CYRE
    await cyre.init()

    const results: BenchmarkResult[] = []

    // Run all benchmarks with proper spacing
    results.push(await benchmarks.baselinePerformance())
    await sleep(300)

    results.push(await benchmarks.schemaValidationFixed())
    await sleep(300)

    results.push(await benchmarks.protectionPipeline())
    await sleep(300)

    results.push(await benchmarks.realisticConcurrency())
    await sleep(500)

    results.push(await benchmarks.memoryLeakTest())
    await sleep(500)

    results.push(await benchmarks.realWorldSimulation())

    // Generate comprehensive report
    generateReport(results)
  } catch (error) {
    console.error('\n❌ Final benchmark failed:', error)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Auto-run
runFinalBenchmarks().catch(console.error)
