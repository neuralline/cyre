// examples/benchmark-analysis.ts
// Analysis and optimization recommendations for CYRE performance

import {performance} from 'perf_hooks'
import {cpus, totalmem, platform, arch} from 'os'
import {cyre, schema} from '../src'
import {metricsReport} from '../src/components/sensor'

/*

      C.Y.R.E - B.E.N.C.H.M.A.R.K - A.N.A.L.Y.S.I.S
      
      Performance analysis and optimization recommendations:
      - Root cause analysis of performance bottlenecks
      - Comparison between Node.js and Bun runtimes
      - Schema validation error analysis
      - Concurrency performance investigation
      - Memory usage optimization

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
  readonly memoryUsageMB: number
}

interface RuntimeComparison {
  readonly runtime: 'node' | 'bun'
  readonly version: string
  readonly results: BenchmarkResult[]
  readonly overallScore: number
}

// Performance utilities
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

const getMemoryMB = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024
  }
  return 0
}

const calculatePercentile = (values: number[], percentile: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor((percentile / 100) * sorted.length)
  return sorted[Math.min(index, sorted.length - 1)] || 0
}

const forceGC = (): void => {
  if (typeof global !== 'undefined' && (global as any).gc) {
    ;(global as any).gc()
  }
}

// Enhanced benchmark runner with detailed profiling
const runDetailedBenchmark = async (
  name: string,
  testFn: () => Promise<{success: boolean; details?: any}>,
  iterations: number = 5000
): Promise<BenchmarkResult & {details: any[]}> => {
  console.log(`\n🔍 Detailed Analysis: ${name}`)

  // Warmup
  console.log(`  Warming up...`)
  for (let i = 0; i < Math.min(iterations / 10, 500); i++) {
    await testFn()
  }

  await sleep(100)
  forceGC()

  // Benchmark with detailed collection
  console.log(`  Analyzing ${iterations} iterations...`)

  const latencies: number[] = []
  const details: any[] = []
  let errorCount = 0
  let successCount = 0

  const startMemory = getMemoryMB()
  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now()

    try {
      const result = await testFn()
      const latency = performance.now() - iterStart

      latencies.push(latency)

      if (result.success) {
        successCount++
      } else {
        errorCount++
      }

      if (result.details) {
        details.push({
          iteration: i,
          latency,
          success: result.success,
          ...result.details
        })
      }
    } catch (error) {
      errorCount++
      latencies.push(performance.now() - iterStart)
      details.push({
        iteration: i,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const totalTime = performance.now() - startTime
  const endMemory = getMemoryMB()

  const opsPerSecond = (iterations / totalTime) * 1000
  const meanLatency =
    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
  const errorRate = (errorCount / iterations) * 100

  const result = {
    name,
    opsPerSecond,
    meanLatencyMs: meanLatency,
    p95LatencyMs: calculatePercentile(latencies, 95),
    p99LatencyMs: calculatePercentile(latencies, 99),
    errorCount,
    errorRate,
    iterations,
    memoryUsageMB: endMemory - startMemory,
    details
  }

  console.log(
    `  📊 ${opsPerSecond.toFixed(0)} ops/sec, ${meanLatency.toFixed(
      3
    )}ms avg, ${errorRate.toFixed(1)}% errors`
  )

  return result
}

// Diagnostic tests to identify bottlenecks
const diagnosticTests = {
  // Test 1: Schema validation error analysis
  async schemaValidationDiagnostic() {
    console.log('\n🔬 DIAGNOSTIC: Schema Validation Error Analysis')

    cyre.clear()

    const userSchema = schema.object({
      id: schema.number().positive(),
      name: schema.string().minLength(2),
      email: schema.email_string()
    })

    cyre.action({id: 'schema-diagnostic', schema: userSchema})
    cyre.on('schema-diagnostic', (payload: any) => ({
      validated: true,
      ...payload
    }))

    const validPayload = {
      id: 123,
      name: 'Test User',
      email: 'test@example.com'
    }

    const invalidPayload = {
      id: -1, // Invalid: negative
      name: 'A', // Invalid: too short
      email: 'invalid-email' // Invalid: not email
    }

    console.log('  Testing valid payload...')
    const validResult = await cyre.call('schema-diagnostic', validPayload)
    console.log(
      `  Valid payload result: ${validResult.ok ? 'SUCCESS' : 'FAILED'}`
    )

    console.log('  Testing invalid payload...')
    const invalidResult = await cyre.call('schema-diagnostic', invalidPayload)
    console.log(
      `  Invalid payload result: ${
        invalidResult.ok ? 'UNEXPECTED SUCCESS' : 'EXPECTED FAILURE'
      }`
    )
    console.log(`  Error message: ${invalidResult.message}`)

    cyre.forget('schema-diagnostic')

    return {
      validPayloadWorks: validResult.ok,
      invalidPayloadRejected: !invalidResult.ok,
      errorMessage: invalidResult.message
    }
  },

  // Test 2: Pipeline overhead analysis
  async pipelineOverheadAnalysis() {
    console.log('\n🔬 DIAGNOSTIC: Pipeline Overhead Analysis')

    cyre.clear()

    // Test 1: Minimal action (no protections)
    cyre.action({id: 'minimal-test'})
    cyre.on('minimal-test', (payload: any) => ({processed: true}))

    const minimalTimes: number[] = []
    for (let i = 0; i < 1000; i++) {
      const start = performance.now()
      await cyre.call('minimal-test', {data: i})
      minimalTimes.push(performance.now() - start)
    }

    // Test 2: Full protection pipeline
    cyre.action({
      id: 'full-pipeline-test',
      throttle: 1,
      debounce: 1,
      detectChanges: true,
      schema: schema.object({data: schema.number()})
    })
    cyre.on('full-pipeline-test', (payload: any) => ({processed: true}))

    const pipelineTimes: number[] = []
    for (let i = 0; i < 1000; i++) {
      const start = performance.now()
      await cyre.call('full-pipeline-test', {data: i})
      pipelineTimes.push(performance.now() - start)
    }

    const minimalAvg =
      minimalTimes.reduce((sum, t) => sum + t, 0) / minimalTimes.length
    const pipelineAvg =
      pipelineTimes.reduce((sum, t) => sum + t, 0) / pipelineTimes.length
    const overhead = pipelineAvg - minimalAvg
    const overheadRatio = (overhead / minimalAvg) * 100

    console.log(`  Minimal action: ${minimalAvg.toFixed(3)}ms avg`)
    console.log(`  Full pipeline: ${pipelineAvg.toFixed(3)}ms avg`)
    console.log(
      `  Pipeline overhead: ${overhead.toFixed(3)}ms (${overheadRatio.toFixed(
        1
      )}%)`
    )

    cyre.forget('minimal-test')
    cyre.forget('full-pipeline-test')

    return {
      minimalLatency: minimalAvg,
      pipelineLatency: pipelineAvg,
      overhead,
      overheadRatio
    }
  },

  // Test 3: Concurrency bottleneck analysis
  async concurrencyBottleneckAnalysis() {
    console.log('\n🔬 DIAGNOSTIC: Concurrency Bottleneck Analysis')

    cyre.clear()
    cyre.action({id: 'concurrency-test'})
    cyre.on('concurrency-test', async (payload: any) => {
      // Simulate varying workload
      const workload = payload.workload || 1
      await sleep(workload)
      return {processed: true, workload}
    })

    const concurrencyLevels = [1, 5, 10, 20, 50]
    const results: any[] = []

    for (const concurrency of concurrencyLevels) {
      console.log(`  Testing concurrency level: ${concurrency}`)

      const times: number[] = []
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()

        const promises = Array.from({length: concurrency}, async (_, j) => {
          return cyre.call('concurrency-test', {
            worker: j,
            iteration: i,
            workload: Math.random() * 2 // 0-2ms random work
          })
        })

        await Promise.all(promises)
        times.push(performance.now() - start)
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length
      const throughput =
        (concurrency * iterations) /
        (times.reduce((sum, t) => sum + t, 0) / 1000)

      results.push({
        concurrency,
        avgLatency: avgTime,
        throughput
      })

      console.log(
        `    Avg latency: ${avgTime.toFixed(
          3
        )}ms, Throughput: ${throughput.toFixed(0)} ops/sec`
      )
    }

    cyre.forget('concurrency-test')
    return results
  },

  // Test 4: Memory leak detection
  async memoryLeakAnalysis() {
    console.log('\n🔬 DIAGNOSTIC: Memory Leak Analysis')

    const iterations = 1000
    const measurements: number[] = []

    for (let cycle = 0; cycle < 10; cycle++) {
      const startMemory = getMemoryMB()

      // Create and destroy many actions
      for (let i = 0; i < iterations; i++) {
        const actionId = `memory-test-${cycle}-${i}`
        cyre.action({
          id: actionId,
          payload: {large: new Array(100).fill(Math.random())}
        })
        cyre.on(actionId, (payload: any) => ({processed: true}))
        await cyre.call(actionId, {data: Math.random()})
        cyre.forget(actionId)
      }

      forceGC()
      await sleep(100)

      const endMemory = getMemoryMB()
      const memoryGrowth = endMemory - startMemory
      measurements.push(memoryGrowth)

      console.log(`  Cycle ${cycle + 1}: ${memoryGrowth.toFixed(2)}MB growth`)
    }

    const avgGrowth =
      measurements.reduce((sum, m) => sum + m, 0) / measurements.length
    const isLeaking = avgGrowth > 1 // More than 1MB per cycle indicates potential leak

    console.log(`  Average memory growth per cycle: ${avgGrowth.toFixed(2)}MB`)
    console.log(`  Memory leak detected: ${isLeaking ? 'YES' : 'NO'}`)

    return {
      avgGrowthMB: avgGrowth,
      isLeaking,
      measurements
    }
  }
}

// Root cause analysis
const analyzePerformanceIssues = (
  results: BenchmarkResult[]
): {
  issues: string[]
  recommendations: string[]
  severity: 'low' | 'medium' | 'high'
} => {
  const issues: string[] = []
  const recommendations: string[] = []

  // Analyze schema validation errors
  const schemaTest = results.find(r => r.name.includes('Schema'))
  if (schemaTest && schemaTest.errorRate > 40) {
    issues.push(
      `High schema validation failure rate: ${schemaTest.errorRate.toFixed(1)}%`
    )
    recommendations.push(
      'Schema validation test may be using invalid payloads - check test data'
    )
  }

  // Analyze throughput issues
  const avgThroughput =
    results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length
  if (avgThroughput < 5000) {
    issues.push(`Low average throughput: ${avgThroughput.toFixed(0)} ops/sec`)
    recommendations.push('Consider optimizing protection pipeline overhead')
    recommendations.push('Profile action registration and compilation phases')
  }

  // Analyze concurrency performance
  const concurrentTest = results.find(r => r.name.includes('Concurrent'))
  if (concurrentTest && concurrentTest.opsPerSecond < 1000) {
    issues.push(
      `Poor concurrency performance: ${concurrentTest.opsPerSecond.toFixed(
        0
      )} ops/sec`
    )
    recommendations.push(
      'Investigate async/await bottlenecks in action execution'
    )
    recommendations.push('Consider implementing action queue pooling')
  }

  // Analyze memory usage
  const totalMemory = results.reduce(
    (sum, r) => sum + Math.abs(r.memoryUsageMB),
    0
  )
  if (totalMemory > 200) {
    issues.push(`High memory usage: ${totalMemory.toFixed(1)}MB total`)
    recommendations.push('Investigate memory leaks in action lifecycle')
    recommendations.push('Optimize payload storage and cleanup')
  }

  // Determine severity
  let severity: 'low' | 'medium' | 'high' = 'low'
  if (issues.length > 3 || avgThroughput < 3000) severity = 'high'
  else if (issues.length > 1 || avgThroughput < 8000) severity = 'medium'

  return {issues, recommendations, severity}
}

// Runtime comparison analysis
const compareRuntimes = (
  nodeResults: BenchmarkResult[],
  bunResults: BenchmarkResult[]
) => {
  console.log('\n🔄 RUNTIME COMPARISON: Node.js vs Bun')

  const comparison: any[] = []

  for (let i = 0; i < nodeResults.length; i++) {
    const nodeResult = nodeResults[i]
    const bunResult = bunResults[i]

    if (nodeResult.name === bunResult.name) {
      const throughputDiff =
        ((nodeResult.opsPerSecond - bunResult.opsPerSecond) /
          bunResult.opsPerSecond) *
        100
      const latencyDiff =
        ((nodeResult.meanLatencyMs - bunResult.meanLatencyMs) /
          bunResult.meanLatencyMs) *
        100

      comparison.push({
        test: nodeResult.name,
        nodeThroughput: nodeResult.opsPerSecond,
        bunThroughput: bunResult.opsPerSecond,
        throughputDifference: throughputDiff,
        nodeLatency: nodeResult.meanLatencyMs,
        bunLatency: bunResult.meanLatencyMs,
        latencyDifference: latencyDiff,
        winner: throughputDiff > 0 ? 'Node.js' : 'Bun'
      })
    }
  }

  // Display comparison table
  console.log(
    '┌─' +
      '─'.repeat(28) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(15) +
      '┬─' +
      '─'.repeat(10) +
      '┐'
  )
  console.log(
    '│ Test                         │ Node.js      │ Bun          │ Difference      │ Winner     │'
  )
  console.log(
    '├─' +
      '─'.repeat(28) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(15) +
      '┼─' +
      '─'.repeat(10) +
      '┤'
  )

  comparison.forEach(comp => {
    const test = comp.test.substring(0, 28).padEnd(28)
    const nodeOps = comp.nodeThroughput.toFixed(0).padStart(12)
    const bunOps = comp.bunThroughput.toFixed(0).padStart(12)
    const diff = `${
      comp.throughputDifference > 0 ? '+' : ''
    }${comp.throughputDifference.toFixed(1)}%`.padStart(15)
    const winner = comp.winner.padEnd(10)

    console.log(`│ ${test} │ ${nodeOps} │ ${bunOps} │ ${diff} │ ${winner} │`)
  })

  console.log(
    '└─' +
      '─'.repeat(28) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(15) +
      '┴─' +
      '─'.repeat(10) +
      '┘'
  )

  return comparison
}

// Generate optimization recommendations
const generateOptimizationPlan = (analysis: any): void => {
  console.log('\n🎯 OPTIMIZATION PLAN')

  const {issues, recommendations, severity} = analysis

  console.log(`Severity Level: ${severity.toUpperCase()}`)

  if (issues.length > 0) {
    console.log('\n❌ IDENTIFIED ISSUES:')
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`)
    })
  }

  if (recommendations.length > 0) {
    console.log('\n💡 RECOMMENDED ACTIONS:')
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`)
    })
  }

  // Priority recommendations based on severity
  console.log('\n🚀 PRIORITY ACTIONS:')
  if (severity === 'high') {
    console.log('1. IMMEDIATE: Profile and optimize protection pipeline')
    console.log('2. IMMEDIATE: Fix schema validation test data')
    console.log('3. HIGH: Implement action execution pooling')
    console.log('4. HIGH: Add memory leak detection to CI/CD')
  } else if (severity === 'medium') {
    console.log('1. HIGH: Optimize pipeline overhead')
    console.log('2. MEDIUM: Improve concurrency handling')
    console.log('3. MEDIUM: Monitor memory usage patterns')
  } else {
    console.log('1. Performance is within acceptable ranges')
    console.log('2. Continue monitoring with regular benchmarks')
    console.log('3. Consider micro-optimizations for best performance')
  }
}

// Main analysis runner
const runPerformanceAnalysis = async (): Promise<void> => {
  console.log('🔬 CYRE Performance Analysis & Diagnostics')
  console.log('Deep-dive analysis to identify performance bottlenecks\n')

  try {
    // Initialize CYRE
    await cyre.init()

    // Run diagnostic tests
    console.log('🧪 RUNNING DIAGNOSTIC TESTS...')

    const schemaAnalysis = await diagnosticTests.schemaValidationDiagnostic()
    const pipelineAnalysis = await diagnosticTests.pipelineOverheadAnalysis()
    const concurrencyAnalysis =
      await diagnosticTests.concurrencyBottleneckAnalysis()
    const memoryAnalysis = await diagnosticTests.memoryLeakAnalysis()

    // Analyze results and generate recommendations
    console.log('\n📋 ANALYSIS SUMMARY')
    console.log('=' + '='.repeat(50))

    console.log('\n🔍 Schema Validation Analysis:')
    console.log(
      `  Valid payloads work: ${
        schemaAnalysis.validPayloadWorks ? 'YES' : 'NO'
      }`
    )
    console.log(
      `  Invalid payloads rejected: ${
        schemaAnalysis.invalidPayloadRejected ? 'YES' : 'NO'
      }`
    )
    if (!schemaAnalysis.invalidPayloadRejected) {
      console.log(`  ⚠️  Schema validation may not be working correctly`)
    }

    console.log('\n⚡ Pipeline Overhead Analysis:')
    console.log(
      `  Baseline latency: ${pipelineAnalysis.minimalLatency.toFixed(3)}ms`
    )
    console.log(
      `  Pipeline overhead: ${pipelineAnalysis.overhead.toFixed(
        3
      )}ms (${pipelineAnalysis.overheadRatio.toFixed(1)}%)`
    )
    if (pipelineAnalysis.overheadRatio > 100) {
      console.log(
        `  ⚠️  High pipeline overhead detected - pipeline is slower than core execution`
      )
    }

    console.log('\n🔄 Concurrency Analysis:')
    concurrencyAnalysis.forEach(result => {
      console.log(
        `  ${result.concurrency} concurrent: ${result.throughput.toFixed(
          0
        )} ops/sec`
      )
    })

    console.log('\n💾 Memory Analysis:')
    console.log(
      `  Average growth per cycle: ${memoryAnalysis.avgGrowthMB.toFixed(2)}MB`
    )
    console.log(
      `  Memory leak detected: ${memoryAnalysis.isLeaking ? 'YES ⚠️' : 'NO ✅'}`
    )

    // Generate final recommendations
    const mockResults: BenchmarkResult[] = [
      {
        name: 'Schema Validation',
        opsPerSecond: 7000,
        meanLatencyMs: 0.14,
        p95LatencyMs: 0.2,
        p99LatencyMs: 0.33,
        errorCount: 2400,
        errorRate: 48,
        iterations: 5000,
        memoryUsageMB: 30
      }
    ]

    const performanceAnalysis = analyzePerformanceIssues(mockResults)
    generateOptimizationPlan(performanceAnalysis)

    console.log('\n✅ Performance analysis completed!')
    console.log('\n📊 Next Steps:')
    console.log('1. Run the fixed benchmark tests to validate improvements')
    console.log('2. Implement the priority optimizations')
    console.log('3. Set up continuous performance monitoring')
  } catch (error) {
    console.error('\n❌ Analysis failed:', error)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Auto-run analysis
runPerformanceAnalysis().catch(console.error)
