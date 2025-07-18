// benchmark/performance-suite.ts
// Comprehensive Cyre performance profiling suite - Pure functional approach

import {cyre} from '../src/index'
import {performance} from 'perf_hooks'

interface BenchmarkResult {
  name: string
  scenario: string
  opsPerSecond: number
  averageLatency: number
  p95Latency: number
  p99Latency: number
  memoryUsage: number
  errors: number
  totalOps: number
  duration: number
}

interface BenchmarkConfig {
  name: string
  duration: number // milliseconds
  warmup: number // milliseconds
  concurrent?: number
  payloadSize?: 'small' | 'medium' | 'large'
}

// Utility functions
const getMemoryUsage = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

const calculatePercentile = (values: number[], percentile: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[index] || 0
}

const createPayload = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return {id: 1, name: 'test'}
    case 'medium':
      return {
        id: 1,
        name: 'test',
        data: Array(100)
          .fill(0)
          .map((_, i) => ({index: i, value: Math.random()}))
      }
    case 'large':
      return {
        id: 1,
        name: 'test',
        data: Array(1000)
          .fill(0)
          .map((_, i) => ({
            index: i,
            value: Math.random(),
            metadata: {created: Date.now(), hash: `hash-${i}`}
          }))
      }
  }
}

// Core benchmark runner
const runBenchmark = async (
  config: BenchmarkConfig,
  setup: () => Promise<void>,
  operation: () => Promise<void>
): Promise<BenchmarkResult> => {
  console.log(`📊 Running: ${config.name}`)

  // Setup
  await setup()

  // Warmup
  const warmupEnd = Date.now() + config.warmup
  while (Date.now() < warmupEnd) {
    try {
      await operation()
    } catch (error) {
      // Ignore warmup errors
    }
  }

  // Actual benchmark
  const latencies: number[] = []
  let operations = 0
  let errors = 0
  const memoryStart = getMemoryUsage()
  const startTime = Date.now()
  const endTime = startTime + config.duration

  while (Date.now() < endTime) {
    const opStart = performance.now()

    try {
      await operation()
      const opEnd = performance.now()
      latencies.push(opEnd - opStart)
      operations++
    } catch (error) {
      errors++
    }
  }

  const actualDuration = Date.now() - startTime
  const memoryEnd = getMemoryUsage()

  return {
    name: config.name,
    scenario: config.name,
    opsPerSecond: Math.round((operations / actualDuration) * 1000),
    averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p95Latency: calculatePercentile(latencies, 95),
    p99Latency: calculatePercentile(latencies, 99),
    memoryUsage: memoryEnd - memoryStart,
    errors,
    totalOps: operations,
    duration: actualDuration
  }
}

// 1. FAST PATH vs PIPELINE COMPARISON
const benchmarkFastPath = async (): Promise<BenchmarkResult[]> => {
  console.log('\n🏎️  FAST PATH vs PIPELINE COMPARISON')

  const results: BenchmarkResult[] = []

  // Fast path (no talents)
  const fastPathResult = await runBenchmark(
    {name: 'Fast Path (No Talents)', duration: 5000, warmup: 1000},
    async () => {
      cyre.action({id: 'fast-path-test'})
      cyre.on('fast-path-test', payload => payload)
    },
    async () => {
      await cyre.call('fast-path-test', {data: 'test'})
    }
  )
  results.push(fastPathResult)

  // Single talent pipeline
  const singleTalentResult = await runBenchmark(
    {name: 'Single Talent (Transform)', duration: 5000, warmup: 1000},
    async () => {
      cyre.action({
        id: 'single-talent-test',
        transform: (payload: any) => ({...payload, processed: true})
      })
      cyre.on('single-talent-test', payload => payload)
    },
    async () => {
      await cyre.call('single-talent-test', {data: 'test'})
    }
  )
  results.push(singleTalentResult)

  // Multiple talents pipeline
  const multiTalentResult = await runBenchmark(
    {name: 'Multi Talent Pipeline', duration: 5000, warmup: 1000},
    async () => {
      cyre.action({
        id: 'multi-talent-test',
        required: true,
        transform: (payload: any) => ({...payload, processed: true}),
        condition: (payload: any) => !!payload,
        selector: (payload: any) => payload.data
      })
      cyre.on('multi-talent-test', payload => payload)
    },
    async () => {
      await cyre.call('multi-talent-test', {data: 'test'})
    }
  )
  results.push(multiTalentResult)

  return results
}

// 2. THROTTLE PERFORMANCE ANALYSIS
const benchmarkThrottle = async (): Promise<BenchmarkResult[]> => {
  console.log('\n⏱️  THROTTLE PERFORMANCE ANALYSIS')

  const results: BenchmarkResult[] = []
  const throttleValues = [0, 1, 10, 50, 100] // milliseconds

  for (const throttle of throttleValues) {
    const result = await runBenchmark(
      {name: `Throttle ${throttle}ms`, duration: 3000, warmup: 500},
      async () => {
        cyre.action({
          id: `throttle-test-${throttle}`,
          throttle: throttle || undefined
        })
        cyre.on(`throttle-test-${throttle}`, payload => payload)
      },
      async () => {
        await cyre.call(`throttle-test-${throttle}`, {data: 'test'})
        // Add small delay to see throttle effect
        if (throttle > 0) {
          await new Promise(resolve => setTimeout(resolve, throttle + 1))
        }
      }
    )
    results.push(result)
  }

  return results
}

// 3. MULTI-HANDLER SCALING
const benchmarkMultiHandler = async (): Promise<BenchmarkResult[]> => {
  console.log('\n👥 MULTI-HANDLER SCALING')

  const results: BenchmarkResult[] = []
  const handlerCounts = [1, 2, 5, 10, 25, 50]

  for (const count of handlerCounts) {
    const result = await runBenchmark(
      {name: `${count} Handlers`, duration: 3000, warmup: 500},
      async () => {
        cyre.action({id: `multi-handler-${count}`})

        // Register multiple handlers
        for (let i = 0; i < count; i++) {
          cyre.on(`multi-handler-${count}`, payload => ({
            ...payload,
            processedBy: `handler-${i}`
          }))
        }
      },
      async () => {
        await cyre.call(`multi-handler-${count}`, {data: 'test'})
      }
    )
    results.push(result)
  }

  return results
}

// 4. TALENT PIPELINE OVERHEAD
const benchmarkTalentOverhead = async (): Promise<BenchmarkResult[]> => {
  console.log('\n🔧 TALENT PIPELINE OVERHEAD')

  const results: BenchmarkResult[] = []

  // Individual talent benchmarks
  const talents = [
    {
      name: 'Required Only',
      config: {required: true}
    },
    {
      name: 'Transform Only',
      config: {transform: (p: any) => ({...p, transformed: true})}
    },
    {
      name: 'Condition Only',
      config: {condition: (p: any) => !!p}
    },
    {
      name: 'Selector Only',
      config: {selector: (p: any) => p.data}
    },
    {
      name: 'DetectChanges Only',
      config: {detectChanges: true}
    }
  ]

  for (const talent of talents) {
    const result = await runBenchmark(
      {name: talent.name, duration: 3000, warmup: 500},
      async () => {
        cyre.action({
          id: `talent-${talent.name.toLowerCase().replace(' ', '-')}`,
          ...talent.config
        })
        cyre.on(
          `talent-${talent.name.toLowerCase().replace(' ', '-')}`,
          payload => payload
        )
      },
      async () => {
        await cyre.call(
          `talent-${talent.name.toLowerCase().replace(' ', '-')}`,
          {data: 'test'}
        )
      }
    )
    results.push(result)
  }

  return results
}

// 5. BUFFER vs DEBOUNCE RESOURCE USAGE
const benchmarkProtections = async (): Promise<BenchmarkResult[]> => {
  console.log('\n🛡️  BUFFER vs DEBOUNCE RESOURCE USAGE')

  const results: BenchmarkResult[] = []

  // Buffer benchmark
  const bufferResult = await runBenchmark(
    {name: 'Buffer 100ms', duration: 5000, warmup: 1000},
    async () => {
      cyre.action({
        id: 'buffer-test',
        buffer: {window: 100, strategy: 'overwrite'}
      })
      cyre.on('buffer-test', payload => payload)
    },
    async () => {
      await cyre.call('buffer-test', {data: Math.random()})
      await new Promise(resolve => setTimeout(resolve, 10)) // Rapid calls
    }
  )
  results.push(bufferResult)

  // Debounce benchmark
  const debounceResult = await runBenchmark(
    {name: 'Debounce 100ms', duration: 5000, warmup: 1000},
    async () => {
      cyre.action({
        id: 'debounce-test',
        debounce: 100
      })
      cyre.on('debounce-test', payload => payload)
    },
    async () => {
      await cyre.call('debounce-test', {data: Math.random()})
      await new Promise(resolve => setTimeout(resolve, 10)) // Rapid calls
    }
  )
  results.push(debounceResult)

  return results
}

// 6. MEMORY USAGE ANALYSIS
const benchmarkMemory = async (): Promise<BenchmarkResult[]> => {
  console.log('\n💾 MEMORY USAGE ANALYSIS')

  const results: BenchmarkResult[] = []
  const payloadSizes: Array<'small' | 'medium' | 'large'> = [
    'small',
    'medium',
    'large'
  ]

  for (const size of payloadSizes) {
    const result = await runBenchmark(
      {
        name: `Payload Size: ${size}`,
        duration: 3000,
        warmup: 500,
        payloadSize: size
      },
      async () => {
        cyre.action({id: `memory-test-${size}`})
        cyre.on(`memory-test-${size}`, payload => payload)
      },
      async () => {
        const payload = createPayload(size)
        await cyre.call(`memory-test-${size}`, payload)
      }
    )
    results.push(result)
  }

  return results
}

// Report generation
const generateReport = (allResults: BenchmarkResult[]): void => {
  console.log('\n📊 PERFORMANCE REPORT')
  console.log('='.repeat(80))

  // Group results by category
  const categories = [
    'FAST PATH vs PIPELINE COMPARISON',
    'THROTTLE PERFORMANCE ANALYSIS',
    'MULTI-HANDLER SCALING',
    'TALENT PIPELINE OVERHEAD',
    'BUFFER vs DEBOUNCE RESOURCE USAGE',
    'MEMORY USAGE ANALYSIS'
  ]

  allResults.forEach((result, index) => {
    console.log(`\n${result.name}:`)
    console.log(`  Operations/sec: ${result.opsPerSecond.toLocaleString()}`)
    console.log(`  Avg Latency: ${result.averageLatency.toFixed(2)}ms`)
    console.log(`  P95 Latency: ${result.p95Latency.toFixed(2)}ms`)
    console.log(`  P99 Latency: ${result.p99Latency.toFixed(2)}ms`)
    console.log(`  Memory Delta: ${result.memoryUsage.toFixed(2)}MB`)
    console.log(
      `  Error Rate: ${((result.errors / result.totalOps) * 100).toFixed(2)}%`
    )
  })

  // Performance insights
  console.log('\n🔍 PERFORMANCE INSIGHTS')
  console.log('='.repeat(50))

  // Find fastest/slowest
  const fastest = allResults.reduce((prev, curr) =>
    curr.opsPerSecond > prev.opsPerSecond ? curr : prev
  )
  const slowest = allResults.reduce((prev, curr) =>
    curr.opsPerSecond < prev.opsPerSecond ? curr : prev
  )

  console.log(
    `🏆 Fastest: ${
      fastest.name
    } (${fastest.opsPerSecond.toLocaleString()} ops/sec)`
  )
  console.log(
    `🐌 Slowest: ${
      slowest.name
    } (${slowest.opsPerSecond.toLocaleString()} ops/sec)`
  )
  console.log(
    `📈 Performance Range: ${(
      fastest.opsPerSecond / slowest.opsPerSecond
    ).toFixed(1)}x difference`
  )

  // Memory usage insights
  const memoryResults = allResults.filter(r => r.memoryUsage > 0)
  if (memoryResults.length > 0) {
    const highestMemory = memoryResults.reduce((prev, curr) =>
      curr.memoryUsage > prev.memoryUsage ? curr : prev
    )
    console.log(
      `💾 Highest Memory: ${
        highestMemory.name
      } (+${highestMemory.memoryUsage.toFixed(2)}MB)`
    )
  }
}

// Main benchmark runner
export const runPerformanceSuite = async (): Promise<void> => {
  console.log('🚀 Starting Cyre Performance Benchmark Suite\n')

  // Initialize Cyre
  await cyre.init()

  const allResults: BenchmarkResult[] = []

  try {
    // Run all benchmark categories
    const fastPathResults = await benchmarkFastPath()
    const throttleResults = await benchmarkThrottle()
    const multiHandlerResults = await benchmarkMultiHandler()
    const talentResults = await benchmarkTalentOverhead()
    const protectionResults = await benchmarkProtections()
    const memoryResults = await benchmarkMemory()

    allResults.push(
      ...fastPathResults,
      ...throttleResults,
      ...multiHandlerResults,
      ...talentResults,
      ...protectionResults,
      ...memoryResults
    )

    generateReport(allResults)
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
  } finally {
    // Cleanup
    cyre.clear()
  }
}

// Export for direct usage
export {
  runBenchmark,
  benchmarkFastPath,
  benchmarkThrottle,
  benchmarkMultiHandler,
  benchmarkTalentOverhead,
  benchmarkProtections,
  benchmarkMemory
}
runPerformanceSuite()
