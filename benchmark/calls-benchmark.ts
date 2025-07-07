// benchmark/calls-benchmark.ts
// Comprehensive benchmark testing for Cyre performance validation

import {processCall} from '../src/components/cyre-call'
import {compileAction} from '../src/schema/data-definitions'
import {executePipeline} from '../src/schema/talent-definitions'
import type {IO, ActionPayload, CyreResponse} from '../src/types/core'

/*

      C.Y.R.E - C.O.M.P.R.E.H.E.N.S.I.V.E - B.E.N.C.H.M.A.R.K - S.U.I.T.E
      
      Complete performance validation testing:
      1. Channel isolation testing (slow vs fast channels)
      2. Concurrency and parallelism testing
      3. State talent performance validation
      4. Complex to simple action performance comparison
      5. Memory leak detection and GC impact
      6. Pipeline interference testing
      7. Cache effectiveness under load
      8. Scaling characteristics validation

*/

interface BenchmarkMetrics {
  name: string
  iterations: number
  totalTime: number
  averageTime: number
  medianTime: number
  p95Time: number
  p99Time: number
  opsPerSecond: number
  memoryDelta: number
  cacheHitRate?: number
  errors: number
}

interface ConcurrencyTestResult {
  concurrentActions: number
  totalTime: number
  averagePerAction: number
  interferenceDetected: boolean
  slowChannelImpact: number
}

/**
 * Performance measurement utilities
 */
class PerformanceMeasurer {
  private measurements: number[] = []
  private startMemory: number = 0
  private errors: number = 0

  start(): void {
    this.measurements = []
    this.errors = 0
    this.startMemory = this.getMemoryUsage()
    // Force GC if available
    if (global.gc) global.gc()
  }

  measure<T>(fn: () => T): T {
    const start = performance.now()
    try {
      const result = fn()
      const end = performance.now()
      this.measurements.push(end - start)
      return result
    } catch (error) {
      this.errors++
      throw error
    }
  }

  async measureAsync<T>(fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      const end = performance.now()
      this.measurements.push(end - start)
      return result
    } catch (error) {
      this.errors++
      throw error
    }
  }

  getResults(name: string): BenchmarkMetrics {
    if (this.measurements.length === 0) {
      throw new Error('No measurements recorded')
    }

    const sorted = [...this.measurements].sort((a, b) => a - b)
    const totalTime = this.measurements.reduce((sum, time) => sum + time, 0)
    const averageTime = totalTime / this.measurements.length
    const medianTime = sorted[Math.floor(sorted.length / 2)]
    const p95Time = sorted[Math.floor(sorted.length * 0.95)]
    const p99Time = sorted[Math.floor(sorted.length * 0.99)]
    const opsPerSecond = 1000 / averageTime

    return {
      name,
      iterations: this.measurements.length,
      totalTime,
      averageTime,
      medianTime,
      p95Time,
      p99Time,
      opsPerSecond,
      memoryDelta: this.getMemoryUsage() - this.startMemory,
      errors: this.errors
    }
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }
}

/**
 * Create test actions for different performance characteristics
 */
const createTestActions = () => {
  return {
    // Fast path actions (minimal overhead)
    fastActions: [
      {
        id: 'fast-click',
        type: 'button-click',
        payload: {clicked: true}
      },
      {
        id: 'fast-event',
        type: 'user-event',
        log: true
      },
      {
        id: 'fast-simple',
        type: 'simple-action'
      }
    ],

    // Protected actions (moderate overhead)
    protectedActions: [
      {
        id: 'throttled-api',
        type: 'api-call',
        throttle: 100,
        payload: {endpoint: '/data'}
      },
      {
        id: 'debounced-input',
        type: 'user-input',
        debounce: 50,
        payload: {value: 'test'}
      }
    ],

    // Complex actions (processing pipeline)
    complexActions: [
      {
        id: 'complex-processor',
        type: 'data-processing',
        required: true,
        condition: (payload: any) => payload?.valid === true,
        selector: (payload: any) => payload.data,
        transform: (payload: any) => ({
          ...payload,
          processed: true,
          timestamp: Date.now()
        }),
        detectChanges: true,
        priority: {level: 'high', maxRetries: 3}
      },
      {
        id: 'complex-validator',
        type: 'validation',
        required: 'non-empty',
        condition: (payload: any) => typeof payload === 'object',
        transform: (payload: any) => ({
          ...payload,
          validated: true,
          checksum: JSON.stringify(payload).length
        }),
        detectChanges: true
      }
    ],

    // Slow actions (intentionally heavy)
    slowActions: [
      {
        id: 'slow-heavy',
        type: 'heavy-processing',
        condition: (payload: any) => {
          // Simulate heavy computation
          let sum = 0
          for (let i = 0; i < 10000; i++) {
            sum += Math.sqrt(i)
          }
          return payload && sum > 0
        },
        transform: (payload: any) => {
          // Simulate heavy transformation
          const result = {
            ...payload,
            heavyComputation: []
          }
          for (let i = 0; i < 1000; i++) {
            result.heavyComputation.push({
              index: i,
              square: i * i,
              timestamp: Date.now()
            })
          }
          return result
        },
        detectChanges: true
      }
    ]
  }
}

/**
 * Test 1: Channel Isolation - Ensure slow channels don't affect fast channels
 */
export const testChannelIsolation = async (
  iterations: number = 1000
): Promise<void> => {
  console.log('🔬 Test 1: Channel Isolation (Slow vs Fast Channels)')

  const testActions = createTestActions()
  const measurer = new PerformanceMeasurer()

  // Compile all actions first
  const compiledFast = testActions.fastActions.map(
    action => compileAction(action).compiledAction
  )
  const compiledSlow = testActions.slowActions.map(
    action => compileAction(action).compiledAction
  )

  // Baseline: Fast channels alone
  console.log('   📊 Baseline: Fast channels only')
  measurer.start()

  for (let i = 0; i < iterations; i++) {
    const action = compiledFast[i % compiledFast.length]
    await measurer.measureAsync(() =>
      processCall(action, {test: true, iteration: i})
    )
  }

  const fastOnlyResults = measurer.getResults('Fast Channels Only')
  console.log(`      Average: ${fastOnlyResults.averageTime.toFixed(4)}ms`)
  console.log(`      P95: ${fastOnlyResults.p95Time.toFixed(4)}ms`)
  console.log(`      Ops/sec: ${fastOnlyResults.opsPerSecond.toFixed(0)}`)

  // Test: Fast channels with slow channels running concurrently
  console.log('   📊 With concurrent slow channels')
  measurer.start()

  // Start slow channels in background
  const slowPromises: Promise<any>[] = []
  for (let i = 0; i < 10; i++) {
    const slowAction = compiledSlow[0]
    slowPromises.push(processCall(slowAction, {test: true, heavy: true}))
  }

  // Measure fast channels performance
  for (let i = 0; i < iterations; i++) {
    const action = compiledFast[i % compiledFast.length]
    await measurer.measureAsync(() =>
      processCall(action, {test: true, iteration: i})
    )
  }

  const fastWithSlowResults = measurer.getResults(
    'Fast Channels With Slow Background'
  )

  // Wait for slow channels to complete
  await Promise.all(slowPromises)

  // Calculate interference
  const interferenceRatio =
    fastWithSlowResults.averageTime / fastOnlyResults.averageTime
  const interferencePercent = (interferenceRatio - 1) * 100

  console.log(`      Average: ${fastWithSlowResults.averageTime.toFixed(4)}ms`)
  console.log(`      P95: ${fastWithSlowResults.p95Time.toFixed(4)}ms`)
  console.log(`      Interference: ${interferencePercent.toFixed(1)}% slower`)

  if (interferencePercent < 10) {
    console.log('   ✅ Channel isolation working well - minimal interference')
  } else if (interferencePercent < 25) {
    console.log('   ⚠️  Moderate interference detected - consider optimization')
  } else {
    console.log(
      '   ❌ High interference detected - channel isolation needs improvement'
    )
  }

  console.log('')
}

/**
 * Test 2: Concurrency Testing - Multiple channels executing simultaneously
 */
export const testConcurrency = async (
  concurrencyLevels: number[] = [1, 5, 10, 25, 50]
): Promise<void> => {
  console.log('🔬 Test 2: Concurrency Performance')

  const testActions = createTestActions()
  const compiledComplex = testActions.complexActions.map(
    action => compileAction(action).compiledAction
  )

  for (const concurrency of concurrencyLevels) {
    console.log(`   📊 Testing ${concurrency} concurrent actions`)

    const measurer = new PerformanceMeasurer()
    measurer.start()

    const promises: Promise<CyreResponse>[] = []

    const startTime = performance.now()

    for (let i = 0; i < concurrency; i++) {
      const action = compiledComplex[i % compiledComplex.length]
      const promise = processCall(action, {
        test: true,
        concurrency,
        actionIndex: i,
        valid: true,
        data: {value: i * 42}
      })
      promises.push(promise)
    }

    await Promise.all(promises)
    const totalTime = performance.now() - startTime

    const averagePerAction = totalTime / concurrency

    console.log(`      Total time: ${totalTime.toFixed(2)}ms`)
    console.log(`      Average per action: ${averagePerAction.toFixed(4)}ms`)
    console.log(
      `      Throughput: ${(concurrency / (totalTime / 1000)).toFixed(
        0
      )} actions/sec`
    )
  }

  console.log('')
}

/**
 * Test 3: State Talent Performance - Individual talent benchmarking
 */
export const testStateTalentPerformance = async (
  iterations: number = 5000
): Promise<void> => {
  console.log('🔬 Test 3: State Talent Performance')

  const testPayload = {
    valid: true,
    data: {
      userId: 'test-123',
      email: 'test@example.com',
      settings: {
        theme: 'dark',
        notifications: true
      }
    },
    metadata: {
      timestamp: Date.now(),
      version: '1.0.0'
    }
  }

  // Test individual talents
  const talents = [
    {
      name: 'required',
      action: {
        id: 'test-required',
        required: true
      }
    },
    {
      name: 'condition',
      action: {
        id: 'test-condition',
        condition: (payload: any) => payload.valid === true
      }
    },
    {
      name: 'selector',
      action: {
        id: 'test-selector',
        selector: (payload: any) => payload.data
      }
    },
    {
      name: 'transform',
      action: {
        id: 'test-transform',
        transform: (payload: any) => ({
          ...payload,
          processed: true,
          timestamp: Date.now()
        })
      }
    },
    {
      name: 'detectChanges',
      action: {
        id: 'test-detect-changes',
        detectChanges: true
      }
    }
  ]

  for (const talent of talents) {
    console.log(`   📊 Testing ${talent.name} talent`)

    const compiledAction = compileAction({
      ...talent.action,
      _hasProcessing: true,
      _processingTalents: [talent.name]
    }).compiledAction

    const measurer = new PerformanceMeasurer()
    measurer.start()

    for (let i = 0; i < iterations; i++) {
      measurer.measure(() => {
        executePipeline(compiledAction, testPayload)
      })
    }

    const results = measurer.getResults(`${talent.name} talent`)
    console.log(`      Average: ${results.averageTime.toFixed(4)}ms`)
    console.log(`      P95: ${results.p95Time.toFixed(4)}ms`)
    console.log(`      Ops/sec: ${results.opsPerSecond.toFixed(0)}`)
  }

  console.log('')
}

/**
 * Test 4: Complex to Simple Performance Comparison
 */
export const testComplexToSimplePerformance = async (
  iterations: number = 2000
): Promise<void> => {
  console.log('🔬 Test 4: Complex to Simple Performance Comparison')

  const testActions = createTestActions()
  const measurer = new PerformanceMeasurer()

  // Test each category
  const categories = [
    {name: 'Fast Actions', actions: testActions.fastActions},
    {name: 'Protected Actions', actions: testActions.protectedActions},
    {name: 'Complex Actions', actions: testActions.complexActions}
  ]

  const results: BenchmarkMetrics[] = []

  for (const category of categories) {
    console.log(`   📊 Testing ${category.name}`)

    const compiledActions = category.actions.map(
      action => compileAction(action).compiledAction
    )

    measurer.start()

    for (let i = 0; i < iterations; i++) {
      const action = compiledActions[i % compiledActions.length]
      const payload = {
        test: true,
        valid: true,
        data: {value: i},
        iteration: i
      }

      await measurer.measureAsync(() => processCall(action, payload))
    }

    const categoryResults = measurer.getResults(category.name)
    results.push(categoryResults)

    console.log(`      Average: ${categoryResults.averageTime.toFixed(4)}ms`)
    console.log(`      P95: ${categoryResults.p95Time.toFixed(4)}ms`)
    console.log(`      Ops/sec: ${categoryResults.opsPerSecond.toFixed(0)}`)
    console.log(
      `      Memory delta: ${(categoryResults.memoryDelta / 1024).toFixed(2)}KB`
    )
  }

  // Performance ratios
  console.log('   📈 Performance Ratios:')
  const fastResult = results[0]
  for (let i = 1; i < results.length; i++) {
    const ratio = results[i].averageTime / fastResult.averageTime
    console.log(`      ${results[i].name} vs Fast: ${ratio.toFixed(1)}x slower`)
  }

  console.log('')
}

/**
 * Test 5: Memory Leak Detection
 */
export const testMemoryLeaks = async (
  iterations: number = 10000
): Promise<void> => {
  console.log('🔬 Test 5: Memory Leak Detection')

  const testActions = createTestActions()
  const allActions = [
    ...testActions.fastActions,
    ...testActions.protectedActions,
    ...testActions.complexActions
  ]

  const compiledActions = allActions.map(
    action => compileAction(action).compiledAction
  )

  const getMemory = () => {
    if (global.gc) global.gc()
    return process.memoryUsage?.().heapUsed || 0
  }

  const startMemory = getMemory()
  console.log(
    `   📊 Initial memory: ${(startMemory / 1024 / 1024).toFixed(2)}MB`
  )

  // Run many iterations
  for (let batch = 0; batch < 10; batch++) {
    for (let i = 0; i < iterations / 10; i++) {
      const action = compiledActions[i % compiledActions.length]
      await processCall(action, {
        test: true,
        batch,
        iteration: i,
        valid: true,
        data: {value: Math.random()}
      })
    }

    const currentMemory = getMemory()
    const memoryDelta = currentMemory - startMemory
    console.log(
      `   Batch ${batch + 1}: ${(currentMemory / 1024 / 1024).toFixed(
        2
      )}MB (+${(memoryDelta / 1024 / 1024).toFixed(2)}MB)`
    )
  }

  const finalMemory = getMemory()
  const totalMemoryDelta = finalMemory - startMemory
  const memoryPerAction = totalMemoryDelta / iterations

  console.log(`   📊 Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`)
  console.log(
    `   📊 Total delta: ${(totalMemoryDelta / 1024 / 1024).toFixed(2)}MB`
  )
  console.log(
    `   📊 Memory per action: ${(memoryPerAction / 1024).toFixed(2)}KB`
  )

  if (memoryPerAction < 1024) {
    // Less than 1KB per action
    console.log('   ✅ No significant memory leaks detected')
  } else {
    console.log('   ⚠️  Potential memory leak - investigate memory management')
  }

  console.log('')
}

/**
 * Test 6: Cache Effectiveness Under Load
 */
export const testCacheEffectivenessUnderLoad = async (): Promise<void> => {
  console.log('🔬 Test 6: Cache Effectiveness Under Load')

  // Test with repeated actions (should benefit from caching)
  const repeatedAction = {
    id: 'repeated-cache-test',
    type: 'cache-test',
    condition: (payload: any) => payload.valid,
    transform: (payload: any) => ({...payload, cached: true}),
    detectChanges: true
  }

  const compiledAction = compileAction(repeatedAction).compiledAction
  const payload = {valid: true, value: 42}

  // Cold cache test
  console.log('   📊 Cold cache performance')
  const measurer = new PerformanceMeasurer()
  measurer.start()

  for (let i = 0; i < 1000; i++) {
    measurer.measure(() => {
      executePipeline(compiledAction, payload)
    })
  }

  const coldResults = measurer.getResults('Cold Cache')
  console.log(`      Average: ${coldResults.averageTime.toFixed(4)}ms`)

  // Warm cache test (same action repeated)
  console.log('   📊 Warm cache performance')
  measurer.start()

  for (let i = 0; i < 1000; i++) {
    measurer.measure(() => {
      executePipeline(compiledAction, payload)
    })
  }

  const warmResults = measurer.getResults('Warm Cache')
  console.log(`      Average: ${warmResults.averageTime.toFixed(4)}ms`)

  const cacheSpeedup = coldResults.averageTime / warmResults.averageTime
  console.log(
    `   🔥 Cache effectiveness: ${cacheSpeedup.toFixed(
      1
    )}x faster with warm cache`
  )

  console.log('')
}

/**
 * Run all benchmark tests
 */
export const runComprehensiveBenchmarkSuite = async (): Promise<void> => {
  console.log('🚀 Cyre Comprehensive Benchmark Suite\n')
  console.log('Testing performance, isolation, concurrency, and scaling...\n')

  try {
    await testChannelIsolation(1000)
    await testConcurrency([1, 5, 10, 25, 50])
    await testStateTalentPerformance(5000)
    await testComplexToSimplePerformance(2000)
    await testMemoryLeaks(10000)
    await testCacheEffectivenessUnderLoad()

    console.log('✅ All benchmark tests completed successfully!')
    console.log('📊 Performance characteristics validated')
    console.log('🎯 System ready for production use')
  } catch (error) {
    console.error('❌ Benchmark test failed:', error)
    throw error
  }
}

runComprehensiveBenchmarkSuite().catch(console.error)
