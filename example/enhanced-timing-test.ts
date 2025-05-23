// example/enhanced-timing-test.ts
// Enhanced test to better analyze CYRE timing issues

import {cyre} from '../src'
import {metricsReport} from '../src/context/metrics-report'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Enhanced Pipeline Overhead Test with Better Timing Analysis
 */
async function enhancedPipelineOverheadTest() {
  console.log('\n=== Enhanced Pipeline Overhead Analysis ===')

  // Reset metrics for clean test
  metricsReport.reset()

  // Create test actions with different complexities
  const testCases = [
    {id: 'timing-simple', workload: 1000, protection: {}},
    {id: 'timing-throttled', workload: 1000, protection: {throttle: 100}},
    {id: 'timing-debounced', workload: 1000, protection: {debounce: 50}},
    {
      id: 'timing-complex',
      workload: 10000,
      protection: {throttle: 50, detectChanges: true}
    }
  ]

  // Register test actions
  testCases.forEach(testCase => {
    cyre.action({
      id: testCase.id,
      payload: {workload: testCase.workload},
      ...testCase.protection
    })
  })

  // Create handlers with measured workloads
  testCases.forEach(testCase => {
    cyre.on(testCase.id, payload => {
      const handlerStart = performance.now()

      // Perform measurable CPU work
      let result = 0
      for (let i = 0; i < payload.workload; i++) {
        result += Math.sqrt(i) * Math.sin(i / 1000)
        // Add some complexity to ensure measurable time
        if (i % 100 === 0) {
          result = result * 1.0001 // Prevent optimization
        }
      }

      const handlerEnd = performance.now()
      const handlerTime = handlerEnd - handlerStart

      // Return timing info for verification
      return {
        result,
        handlerExecutionTime: handlerTime,
        workloadCompleted: payload.workload
      }
    })
  })

  console.log('Running enhanced timing tests...')

  // Test each case with multiple runs
  for (const testCase of testCases) {
    console.log(`\nTesting ${testCase.id} (workload: ${testCase.workload})...`)

    const runs = 5
    const manualTimings: number[] = []

    for (let i = 0; i < runs; i++) {
      const callStart = performance.now()

      const result = await cyre.call(testCase.id, {
        workload: testCase.workload,
        run: i
      })

      const callEnd = performance.now()
      const totalCallTime = callEnd - callStart

      manualTimings.push(totalCallTime)

      // Log individual result for debugging
      if (result.ok && result.payload) {
        console.log(
          `  Run ${i + 1}: Total call time: ${totalCallTime.toFixed(
            2
          )}ms, Handler reported: ${
            result.payload.handlerExecutionTime?.toFixed(2) || 'N/A'
          }ms`
        )
      }

      // Small delay between runs to allow metrics to settle
      await wait(10)
    }

    // Wait for metrics to be processed
    await wait(50)

    // Get metrics for this action
    const actionMetrics = metricsReport.getActionMetrics(testCase.id)

    if (actionMetrics) {
      const avgManualTiming =
        manualTimings.reduce((a, b) => a + b, 0) / manualTimings.length

      console.log(`  Results for ${testCase.id}:`)
      console.log(
        `    Manual average call time: ${avgManualTiming.toFixed(2)}ms`
      )
      console.log(
        `    Reported total execution time: ${actionMetrics.avgExecutionTime.toFixed(
          2
        )}ms`
      )
      console.log(
        `    Reported listener execution time: ${actionMetrics.avgListenerExecutionTime.toFixed(
          2
        )}ms`
      )
      console.log(
        `    Pipeline overhead ratio: ${(
          actionMetrics.pipelineOverheadRatio * 100
        ).toFixed(1)}%`
      )
      console.log(
        `    Calls: ${actionMetrics.calls}, Executions: ${actionMetrics.executionCount}`
      )

      if (testCase.protection.throttle) {
        console.log(`    Throttles: ${actionMetrics.throttles}`)
      }
      if (testCase.protection.debounce) {
        console.log(`    Debounces: ${actionMetrics.debounces}`)
      }

      // Verify timing consistency
      const timingDifference = Math.abs(
        avgManualTiming - actionMetrics.avgExecutionTime
      )
      if (timingDifference > 1) {
        // More than 1ms difference
        console.log(
          `    ⚠️  TIMING DISCREPANCY: ${timingDifference.toFixed(
            2
          )}ms difference`
        )
      }

      // Check if listener timing is reasonable
      if (actionMetrics.avgListenerExecutionTime < 0.1) {
        console.log(
          `    ⚠️  LISTENER TIMING ISSUE: Reported listener time too low`
        )
      }
    } else {
      console.log(`    ❌ No metrics found for ${testCase.id}`)
    }
  }
}

/**
 * Memory and Stress Correlation Test
 */
async function memoryStressCorrelationTest() {
  console.log('\n=== Memory and Stress Correlation Test ===')

  // Create action for memory stress testing
  cyre.action({
    id: 'memory-stress-test',
    payload: {intensity: 1}
  })

  const memoryAllocations: any[] = []

  cyre.on('memory-stress-test', payload => {
    const startTime = performance.now()

    // Create memory pressure
    const intensity = payload.intensity
    const tempArrays = []

    for (let i = 0; i < intensity * 1000; i++) {
      tempArrays.push(new Array(100).fill(Math.random()))
    }

    // Keep some references to prevent immediate GC
    memoryAllocations.push(...tempArrays.slice(0, intensity * 10))

    const endTime = performance.now()

    return {
      memoryAllocated: tempArrays.length,
      executionTime: endTime - startTime
    }
  })

  console.log('Testing memory allocation impact on timing...')

  // Test with increasing memory pressure
  for (let intensity = 1; intensity <= 5; intensity++) {
    console.log(`\nMemory pressure level ${intensity}:`)

    const breathingBefore = cyre.getBreathingState()

    await cyre.call('memory-stress-test', {intensity})

    await wait(100) // Allow breathing system to react

    const breathingAfter = cyre.getBreathingState()
    const stressIncrease = breathingAfter.stress - breathingBefore.stress

    console.log(
      `  Stress before: ${(breathingBefore.stress * 100).toFixed(2)}%`
    )
    console.log(`  Stress after: ${(breathingAfter.stress * 100).toFixed(2)}%`)
    console.log(`  Stress increase: ${(stressIncrease * 100).toFixed(2)}%`)
    console.log(`  Memory allocations held: ${memoryAllocations.length}`)
  }

  // Clean up memory
  memoryAllocations.length = 0

  console.log('\nMemory cleaned up, waiting for recovery...')
  await wait(500)

  const finalBreathing = cyre.getBreathingState()
  console.log(
    `Final stress level: ${(finalBreathing.stress * 100).toFixed(2)}%`
  )
}

/**
 * Error Tracking Verification Test
 */
async function errorTrackingTest() {
  console.log('\n=== Error Tracking Verification Test ===')

  // Create actions that will fail in controlled ways
  cyre.action({id: 'error-sync', payload: {}})
  cyre.action({id: 'error-async', payload: {}})
  cyre.action({id: 'error-timeout', payload: {}})

  // Synchronous error handler
  cyre.on('error-sync', () => {
    throw new Error('Synchronous test error')
  })

  // Asynchronous error handler
  cyre.on('error-async', async () => {
    await wait(10)
    throw new Error('Asynchronous test error')
  })

  // Timeout simulation
  cyre.on('error-timeout', async () => {
    await wait(100)
    throw new Error('Timeout test error')
  })

  console.log('Testing error tracking...')

  const errorTests = [
    {id: 'error-sync', description: 'Synchronous error'},
    {id: 'error-async', description: 'Asynchronous error'},
    {id: 'error-timeout', description: 'Timeout error'}
  ]

  for (const test of errorTests) {
    console.log(`\nTesting ${test.description}:`)

    try {
      const result = await cyre.call(test.id)
      console.log(`  Call result: ok=${result.ok}, message="${result.message}"`)
    } catch (error) {
      console.log(`  Caught error: ${error}`)
    }

    await wait(50) // Allow metrics to process

    const metrics = metricsReport.getActionMetrics(test.id)
    if (metrics) {
      console.log(`  Reported errors: ${metrics.errorCount}`)
      console.log(`  Total calls: ${metrics.calls}`)
      console.log(`  Total executions: ${metrics.executionCount}`)
    } else {
      console.log(`  ❌ No metrics found for ${test.id}`)
    }
  }
}

/**
 * Run all enhanced timing tests
 */
async function runEnhancedTimingTests() {
  console.log('🔍 CYRE Enhanced Timing Analysis')
  console.log('================================')

  try {
    await enhancedPipelineOverheadTest()
    await wait(500)

    await memoryStressCorrelationTest()
    await wait(500)

    await errorTrackingTest()
    await wait(500)

    // Final comprehensive report
    console.log('\n=== Final Comprehensive Analysis ===')
    metricsReport.logReport(metrics => {
      // Filter for our test actions
      return (
        metrics.id.includes('timing-') ||
        metrics.id.includes('memory-') ||
        metrics.id.includes('error-')
      )
    })
  } catch (error) {
    console.error('Error in enhanced timing tests:', error)
  }
}

export {runEnhancedTimingTests}

runEnhancedTimingTests()
