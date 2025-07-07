// example/cyre-accurate-performance-test.ts

import {cyre} from '../src'
import {metricsReport} from '../src/components/sensor'

/* 
    CYRE Accurate Performance Analysis
    
    This test properly measures CYRE's actual performance characteristics
    by isolating different components and measuring them independently.
*/

// Helper to get precise timing
const preciseTime = () => performance.now()

// Helper to delay execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Log section header
const logSection = (title: string) => {
  console.log('\n' + '='.repeat(80))
  console.log(`  ${title}`)
  console.log('='.repeat(80))
}

/**
 * Measure baseline JavaScript execution without CYRE
 */
async function measureBaselinePerformance() {
  logSection('BASELINE: Pure JavaScript Performance')

  const iterations = 1000
  const results = []

  // Simple function similar to what CYRE handlers might do
  const simpleWork = (payload: any) => {
    let result = 0
    for (let i = 0; i < 100; i++) {
      result += Math.sqrt(i) + payload.value
    }
    return {processed: true, result}
  }

  // Measure direct function calls
  console.log(`Measuring ${iterations} direct function calls...`)
  const startDirect = preciseTime()

  for (let i = 0; i < iterations; i++) {
    const start = preciseTime()
    simpleWork({value: i})
    results.push(preciseTime() - start)
  }

  const totalDirect = preciseTime() - startDirect
  const avgDirect =
    results.reduce((sum, time) => sum + time, 0) / results.length
  const minDirect = Math.min(...results)
  const maxDirect = Math.max(...results)

  console.log(`Direct Function Calls:`)
  console.log(`  Total time: ${totalDirect.toFixed(2)}ms`)
  console.log(`  Average per call: ${avgDirect.toFixed(4)}ms`)
  console.log(
    `  Min: ${minDirect.toFixed(4)}ms, Max: ${maxDirect.toFixed(4)}ms`
  )
  console.log(
    `  Throughput: ${(iterations / (totalDirect / 1000)).toFixed(0)} calls/sec`
  )

  return {
    totalTime: totalDirect,
    avgTime: avgDirect,
    minTime: minDirect,
    maxTime: maxDirect,
    throughput: iterations / (totalDirect / 1000)
  }
}

/**
 * Measure CYRE's simplest possible execution path
 */
async function measureCyreMinimalPath() {
  logSection('CYRE: Minimal Execution Path')

  const actionId = 'minimal-performance-test'
  const iterations = 1000
  const results = []

  // Create the simplest possible CYRE action
  cyre.action({
    id: actionId,
    payload: {value: 0}
    // No throttle, debounce, detectChanges, middleware, etc.
  })

  // Register the simplest possible handler
  cyre.on(actionId, payload => {
    let result = 0
    for (let i = 0; i < 100; i++) {
      result += Math.sqrt(i) + payload.value
    }
    return {processed: true, result}
  })

  console.log(`Measuring ${iterations} minimal CYRE calls...`)

  // Measure CYRE calls
  const startCyre = preciseTime()

  for (let i = 0; i < iterations; i++) {
    const start = preciseTime()
    await cyre.call(actionId, {value: i})
    results.push(preciseTime() - start)
  }

  const totalCyre = preciseTime() - startCyre
  const avgCyre = results.reduce((sum, time) => sum + time, 0) / results.length
  const minCyre = Math.min(...results)
  const maxCyre = Math.max(...results)

  console.log(`Minimal CYRE Calls:`)
  console.log(`  Total time: ${totalCyre.toFixed(2)}ms`)
  console.log(`  Average per call: ${avgCyre.toFixed(4)}ms`)
  console.log(`  Min: ${minCyre.toFixed(4)}ms, Max: ${maxCyre.toFixed(4)}ms`)
  console.log(
    `  Throughput: ${(iterations / (totalCyre / 1000)).toFixed(0)} calls/sec`
  )

  // Clean up
  cyre.forget(actionId)

  return {
    totalTime: totalCyre,
    avgTime: avgCyre,
    minTime: minCyre,
    maxTime: maxCyre,
    throughput: iterations / (totalCyre / 1000)
  }
}

/**
 * Measure CYRE with different protection mechanisms
 */
async function measureCyreProtectionOverhead() {
  logSection('CYRE: Protection Mechanisms Overhead')

  const iterations = 100 // Fewer iterations for protected actions
  const protectionTests = [
    {
      name: 'No Protection',
      config: {id: 'no-protection', payload: {value: 0}}
    },
    {
      name: 'With Throttle',
      config: {id: 'with-throttle', throttle: 10, payload: {value: 0}}
    },
    {
      name: 'With Debounce',
      config: {id: 'with-debounce', debounce: 10, payload: {value: 0}}
    },
    {
      name: 'With Change Detection',
      config: {
        id: 'with-change-detect',
        detectChanges: true,
        payload: {value: 0}
      }
    },
    {
      name: 'All Protections',
      config: {
        id: 'all-protections',
        throttle: 10,
        debounce: 10,
        detectChanges: true,
        payload: {value: 0}
      }
    }
  ]

  const results = {}

  for (const test of protectionTests) {
    console.log(`\nTesting: ${test.name}`)

    // Create action
    cyre.action(test.config)

    // Register handler
    cyre.on(test.config.id, payload => {
      let result = 0
      for (let i = 0; i < 100; i++) {
        result += Math.sqrt(i) + payload.value
      }
      return {processed: true, result}
    })

    // Measure calls
    const callTimes = []
    const startTime = preciseTime()

    for (let i = 0; i < iterations; i++) {
      const callStart = preciseTime()
      await cyre.call(test.config.id, {value: i})
      callTimes.push(preciseTime() - callStart)

      // Small delay to avoid overwhelming protection mechanisms
      if (test.config.throttle || test.config.debounce) {
        await wait(15) // Wait longer than protection settings
      }
    }

    const totalTime = preciseTime() - startTime
    const avgTime =
      callTimes.reduce((sum, time) => sum + time, 0) / callTimes.length

    results[test.name] = {
      totalTime,
      avgTime,
      minTime: Math.min(...callTimes),
      maxTime: Math.max(...callTimes),
      throughput: iterations / (totalTime / 1000)
    }

    console.log(`  Average per call: ${avgTime.toFixed(4)}ms`)
    console.log(
      `  Throughput: ${results[test.name].throughput.toFixed(0)} calls/sec`
    )

    // Clean up
    cyre.forget(test.config.id)

    // Wait for system to settle
    await wait(50)
  }

  return results
}

/**
 * Measure CYRE's interval and timing accuracy
 */
async function measureCyreTimingAccuracy() {
  logSection('CYRE: Timing Accuracy Analysis')

  const testCases = [
    {name: 'Simple Interval', interval: 100, repeat: 5},
    {name: 'Fast Interval', interval: 50, repeat: 10},
    {name: 'Delayed Start', delay: 100, interval: 50, repeat: 3}
  ]

  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}`)

    const actionId = `timing-test-${Date.now()}`
    const executionTimes = []
    let executionCount = 0

    // Register handler that records execution times
    cyre.on(actionId, () => {
      executionTimes.push(preciseTime())
      executionCount++
      return {executed: true, count: executionCount}
    })

    // Create timed action
    cyre.action({
      id: actionId,
      ...testCase,
      payload: {test: testCase.name}
    })

    // Start the timed action
    const testStart = preciseTime()
    await cyre.call(actionId)

    // Wait for all executions to complete
    const maxWaitTime =
      (testCase.delay || 0) + testCase.interval * testCase.repeat + 500
    await wait(maxWaitTime)

    // Analyze timing accuracy
    console.log(`  Expected executions: ${testCase.repeat}`)
    console.log(`  Actual executions: ${executionCount}`)

    if (executionTimes.length > 1) {
      const intervals = []
      for (let i = 1; i < executionTimes.length; i++) {
        intervals.push(executionTimes[i] - executionTimes[i - 1])
      }

      const avgInterval =
        intervals.reduce((sum, interval) => sum + interval, 0) /
        intervals.length
      const expectedInterval = testCase.interval
      const accuracy =
        ((expectedInterval - Math.abs(avgInterval - expectedInterval)) /
          expectedInterval) *
        100

      console.log(`  Expected interval: ${expectedInterval}ms`)
      console.log(`  Actual avg interval: ${avgInterval.toFixed(2)}ms`)
      console.log(`  Timing accuracy: ${accuracy.toFixed(1)}%`)

      // Check if first execution respected delay
      if (testCase.delay) {
        const firstExecutionDelay = executionTimes[0] - testStart
        console.log(`  Expected first delay: ${testCase.delay}ms`)
        console.log(`  Actual first delay: ${firstExecutionDelay.toFixed(2)}ms`)
      }
    }

    // Clean up
    cyre.forget(actionId)
    await wait(100)
  }
}

/**
 * Measure CYRE under different stress levels
 */
async function measureCyreUnderStress() {
  logSection('CYRE: Performance Under Stress')

  const stressLevels = [
    {name: 'Light Load', concurrent: 10, calls: 50},
    {name: 'Medium Load', concurrent: 50, calls: 100},
    {name: 'Heavy Load', concurrent: 100, calls: 200}
  ]

  for (const stress of stressLevels) {
    console.log(
      `\nTesting: ${stress.name} (${stress.concurrent} concurrent actions, ${stress.calls} calls each)`
    )

    const actionIds = []
    const allResults = []

    // Create multiple concurrent actions
    for (let i = 0; i < stress.concurrent; i++) {
      const actionId = `stress-test-${i}-${Date.now()}`
      actionIds.push(actionId)

      cyre.action({
        id: actionId,
        payload: {stress: stress.name, index: i}
      })

      cyre.on(actionId, payload => {
        // Simulate some work
        let result = 0
        for (let j = 0; j < 50; j++) {
          result += Math.sqrt(j) + payload.index
        }
        return {processed: true, result}
      })
    }

    // Measure concurrent execution
    const stressStart = preciseTime()
    const promises = []

    // Fire all calls concurrently
    for (const actionId of actionIds) {
      for (let call = 0; call < stress.calls; call++) {
        const callStart = preciseTime()
        const promise = cyre
          .call(actionId, {call, timestamp: Date.now()})
          .then(() => {
            allResults.push(preciseTime() - callStart)
          })
        promises.push(promise)
      }
    }

    // Wait for all to complete
    await Promise.all(promises)
    const totalStressTime = preciseTime() - stressStart

    // Analyze results
    const totalCalls = stress.concurrent * stress.calls
    const avgCallTime =
      allResults.reduce((sum, time) => sum + time, 0) / allResults.length
    const throughput = totalCalls / (totalStressTime / 1000)

    console.log(`  Total calls: ${totalCalls}`)
    console.log(`  Total time: ${totalStressTime.toFixed(2)}ms`)
    console.log(`  Average per call: ${avgCallTime.toFixed(4)}ms`)
    console.log(`  Throughput: ${throughput.toFixed(0)} calls/sec`)
    console.log(`  Min call time: ${Math.min(...allResults).toFixed(4)}ms`)
    console.log(`  Max call time: ${Math.max(...allResults).toFixed(4)}ms`)

    // Check breathing system response
    const breathingState = cyre.getBreathingState()
    console.log(
      `  System stress after test: ${(breathingState.stress * 100).toFixed(2)}%`
    )
    console.log(`  Breathing rate: ${breathingState.currentRate}ms`)
    console.log(`  In recuperation: ${breathingState.isRecuperating}`)

    // Clean up
    actionIds.forEach(id => cyre.forget(id))

    // Wait for system to recover
    await wait(500)
  }
}

/**
 * Comprehensive comparison and analysis
 */
async function analyzeOverallPerformance(
  baselineResults: any,
  cyreResults: any
) {
  logSection('PERFORMANCE ANALYSIS & COMPARISON')

  console.log('Baseline vs CYRE Minimal Performance:')
  console.log(`  Baseline average: ${baselineResults.avgTime.toFixed(4)}ms`)
  console.log(`  CYRE minimal average: ${cyreResults.avgTime.toFixed(4)}ms`)

  const overhead = cyreResults.avgTime - baselineResults.avgTime
  const overheadPercentage = (overhead / baselineResults.avgTime) * 100

  console.log(
    `  CYRE overhead: ${overhead.toFixed(4)}ms (${overheadPercentage.toFixed(
      1
    )}%)`
  )

  const throughputRatio = cyreResults.throughput / baselineResults.throughput
  console.log(
    `  Throughput ratio: ${throughputRatio.toFixed(2)}x (CYRE vs baseline)`
  )

  // Get CYRE's internal metrics
  const globalMetrics = metricsReport.getGlobalMetrics()
  console.log('\nCYRE Internal Metrics:')
  console.log(`  Total executions tracked: ${globalMetrics.totalExecutions}`)
  console.log(
    `  Average execution time: ${
      globalMetrics.totalExecutions > 0
        ? (
            globalMetrics.totalExecutionTime / globalMetrics.totalExecutions
          ).toFixed(4)
        : 0
    }ms`
  )

  // Performance categorization
  if (overheadPercentage < 50) {
    console.log('\n✅ CYRE Performance: EXCELLENT (< 50% overhead)')
  } else if (overheadPercentage < 100) {
    console.log('\n🟡 CYRE Performance: GOOD (< 100% overhead)')
  } else if (overheadPercentage < 200) {
    console.log('\n🟠 CYRE Performance: ACCEPTABLE (< 200% overhead)')
  } else {
    console.log('\n🔴 CYRE Performance: NEEDS OPTIMIZATION (> 200% overhead)')
  }

  console.log('\nPerformance Insights:')
  const insights = metricsReport.getInsights()
  if (insights.length > 0) {
    insights.forEach(insight => console.log(`  • ${insight}`))
  } else {
    console.log('  • No performance issues detected')
  }
}

/**
 * Run the comprehensive performance analysis
 */
async function runAccuratePerformanceTest() {
  logSection('CYRE ACCURATE PERFORMANCE ANALYSIS')
  console.log('Starting comprehensive performance measurement...\n')

  try {
    // Reset metrics for clean measurement
    metricsReport.reset()

    // 1. Measure baseline JavaScript performance
    const baselineResults = await measureBaselinePerformance()
    await wait(100)

    // 2. Measure CYRE's minimal execution path
    const cyreResults = await measureCyreMinimalPath()
    await wait(100)

    // 3. Measure protection mechanism overhead
    const protectionResults = await measureCyreProtectionOverhead()
    await wait(100)

    // 4. Measure timing accuracy
    await measureCyreTimingAccuracy()
    await wait(100)

    // 5. Measure performance under stress
    await measureCyreUnderStress()
    await wait(100)

    // 6. Overall analysis
    await analyzeOverallPerformance(baselineResults, cyreResults)

    // 7. Final metrics report
    logSection('DETAILED METRICS REPORT')
    metricsReport.logReport()
  } catch (error) {
    console.error('Error running performance test:', error)
    if (error.stack) console.error(error.stack)
  }
}

// Export and run
export {runAccuratePerformanceTest}

runAccuratePerformanceTest()
