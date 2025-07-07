// demo/throttle-detectchanges-speed-test.ts
// Performance test to determine if throttle + detectChanges configuration makes Cyre actions faster

import cyre from '../src'

/**
 * Test if throttle and detectChanges make Cyre actions faster
 *
 * Theory:
 * - throttle: 10ms prevents excessive calls, should reduce overhead
 * - detectChanges: true skips unnecessary executions, should improve performance
 *
 * Expected result: Combined config should show better throughput and lower latency
 */

interface TestResult {
  configName: string
  operationsPerSecond: number
  averageLatencyMs: number
  p95LatencyMs: number
  successfulCalls: number
  rejectedCalls: number
  throttledCalls: number
  changeDetectionSkips: number
  actualExecutions: number
  totalCallTime: number
}

const performanceTest = async (): Promise<void> => {
  console.log('🚀 Cyre Performance Comparison Test')
  console.log('Testing: Is throttle + detectChanges faster than default?')
  console.log('====================================================\n')

  // Clear any existing state
  cyre.clear()
  const iterations = 2000

  // Helper to run single test configuration
  const testConfiguration = async (
    configName: string,
    actionConfig: any
  ): Promise<TestResult> => {
    console.log(`📊 Testing: ${configName}`)

    const latencies: number[] = []
    let successfulCalls = 0
    let rejectedCalls = 0
    let throttledCalls = 0
    let changeDetectionSkips = 0
    let actualExecutions = 0

    // Setup handler first (proper Cyre pattern)
    cyre.on(actionConfig.id, (payload: any) => {
      actualExecutions++
      return {
        processed: true,
        timestamp: Date.now(),
        executionId: actualExecutions,
        originalPayload: payload
      }
    })

    // Register action
    const registrationResult = cyre.action(actionConfig)
    if (!registrationResult.ok) {
      throw new Error(
        `Failed to register action: ${registrationResult.message}`
      )
    }

    // Test payloads with deliberate duplicates for change detection
    const testPayloads = [
      {operation: 'user-update', userId: 1001, data: 'first'},
      {operation: 'user-update', userId: 1002, data: 'second'},
      {operation: 'user-update', userId: 1001, data: 'first'}, // Duplicate
      {operation: 'user-update', userId: 1003, data: 'third'},
      {operation: 'user-update', userId: 1002, data: 'second'}, // Duplicate
      {operation: 'user-update', userId: 1004, data: 'fourth'},
      {operation: 'user-update', userId: 1001, data: 'first'}, // Duplicate
      {operation: 'user-update', userId: 1005, data: 'fifth'}
    ]

    const startTime = performance.now()

    // Execute test iterations
    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()

      try {
        const payload = testPayloads[i % testPayloads.length]
        const result = await cyre.call(actionConfig.id, payload)

        if (result.ok) {
          successfulCalls++
        } else {
          rejectedCalls++

          // Categorize rejection reasons
          if (result.message?.includes('Throttled')) {
            throttledCalls++
          }
          if (result.message?.includes('No payload changes detected')) {
            changeDetectionSkips++
          }
        }
      } catch (error) {
        rejectedCalls++
      }

      const operationEnd = performance.now()
      latencies.push(operationEnd - operationStart)
    }

    const endTime = performance.now()
    const totalCallTime = endTime - startTime
    const operationsPerSecond = Math.round((iterations / totalCallTime) * 1000)
    const averageLatency =
      latencies.reduce((a, b) => a + b, 0) / latencies.length

    // Calculate P95 latency
    const sortedLatencies = [...latencies].sort((a, b) => a - b)
    const p95Index = Math.floor(sortedLatencies.length * 0.95)
    const p95Latency = sortedLatencies[p95Index]

    // Clean up
    cyre.forget(actionConfig.id)

    console.log(`   ✅ Completed: ${iterations} operations`)
    console.log(`   📈 Operations/sec: ${operationsPerSecond}`)
    console.log(`   ⏱️  Average latency: ${averageLatency.toFixed(3)}ms`)
    console.log(`   🎯 P95 latency: ${p95Latency.toFixed(3)}ms`)
    console.log(`   ✅ Successful calls: ${successfulCalls}`)
    console.log(`   ❌ Rejected calls: ${rejectedCalls}`)
    if (throttledCalls > 0) console.log(`   🚫 Throttled: ${throttledCalls}`)
    if (changeDetectionSkips > 0)
      console.log(`   🔄 Change detection skips: ${changeDetectionSkips}`)
    console.log(`   🎬 Actual executions: ${actualExecutions}\n`)

    return {
      configName,
      operationsPerSecond,
      averageLatencyMs: Number(averageLatency.toFixed(3)),
      p95LatencyMs: Number(p95Latency.toFixed(3)),
      successfulCalls,
      rejectedCalls,
      throttledCalls,
      changeDetectionSkips,
      actualExecutions,
      totalCallTime: Number(totalCallTime.toFixed(3))
    }
  }

  // Test configurations
  const configurations = [
    {
      name: 'Default (No Protection)',
      config: {id: 'test-default'}
    },
    {
      name: 'Throttle + DetectChanges',
      config: {id: 'test-optimized', throttle: 100, detectChanges: true}
    },
    {
      name: 'Throttle Only',
      config: {id: 'test-throttle', throttle: 100}
    },
    {
      name: 'DetectChanges Only',
      config: {id: 'test-detectchanges', detectChanges: true}
    }
  ]

  const results: TestResult[] = []

  // Run all tests
  for (const test of configurations) {
    const result = await testConfiguration(test.name, test.config)
    results.push(result)

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Analyze and display results
  console.log('🏆 PERFORMANCE COMPARISON RESULTS')
  console.log('==================================\n')

  const baseline = results[0] // Default configuration

  results.forEach((result, index) => {
    const opsImprovement =
      ((result.operationsPerSecond - baseline.operationsPerSecond) /
        baseline.operationsPerSecond) *
      100
    const latencyImprovement =
      ((baseline.averageLatencyMs - result.averageLatencyMs) /
        baseline.averageLatencyMs) *
      100

    console.log(`${index + 1}. ${result.configName}`)
    console.log(
      `   🚀 Operations/sec: ${result.operationsPerSecond} ${
        index > 0
          ? `(${opsImprovement > 0 ? '+' : ''}${opsImprovement.toFixed(1)}%)`
          : '(baseline)'
      }`
    )
    console.log(
      `   ⏱️  Avg latency: ${result.averageLatencyMs}ms ${
        index > 0
          ? `(${latencyImprovement > 0 ? '+' : ''}${latencyImprovement.toFixed(
              1
            )}%)`
          : '(baseline)'
      }`
    )
    console.log(
      `   📊 Efficiency: ${Math.round(
        (result.actualExecutions / result.successfulCalls) * 100
      )}% actual executions`
    )

    if (result.throttledCalls > 0 || result.changeDetectionSkips > 0) {
      console.log(
        `   🛡️  Protection: ${result.throttledCalls} throttled, ${result.changeDetectionSkips} change skips`
      )
    }
    console.log('')
  })

  // Conclusion
  const optimizedResult = results.find(r =>
    r.configName.includes('Throttle + DetectChanges')
  )
  const isOptimizedFaster =
    optimizedResult &&
    optimizedResult.operationsPerSecond > baseline.operationsPerSecond

  console.log('🎯 CONCLUSION')
  console.log('=============')

  if (isOptimizedFaster) {
    const improvement =
      ((optimizedResult.operationsPerSecond - baseline.operationsPerSecond) /
        baseline.operationsPerSecond) *
      100
    console.log(
      `✅ YES! throttle: 10 + detectChanges: true IS ${improvement.toFixed(
        1
      )}% FASTER`
    )
    console.log(`   • Reduced unnecessary executions through change detection`)
    console.log(`   • Prevented excessive calls through throttling`)
    console.log(`   • Higher throughput with lower latency`)
  } else {
    console.log(`❌ NO, throttle + detectChanges is not faster than default`)
    console.log(`   • Protection mechanisms add slight overhead`)
    console.log(`   • Benefits depend on usage patterns and duplicate calls`)
  }

  console.log('\n📝 Note: Performance depends on:')
  console.log('   • Frequency of duplicate payloads (change detection benefit)')
  console.log('   • Call frequency patterns (throttle benefit)')
  console.log('   • Handler complexity and system load')
}

// Execute the test
performanceTest().catch(console.error)
