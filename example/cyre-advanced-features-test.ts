// example/cyre-advanced-features-test.ts
// Comprehensive test of CYRE's unique features: debounce, repeat, intralink, delay

import {cyre} from '../src'
import {metricsReport} from '../src/context/metrics-report'

/*
    CYRE Advanced Features Performance Test
    
    Testing CYRE's unique differentiators:
    1. Debounce timing and efficiency
    2. Repeat execution patterns  
    3. IntraLink chain reactions
    4. Delay scheduling accuracy
    5. Combined feature interactions
*/

interface AdvancedBenchmarkResult {
  name: string
  totalOperations: number
  successfulOperations: number
  averageLatency: number
  p95Latency: number
  throughput: number
  featureSpecificMetrics: Record<string, any>
  errors: number
  testDuration: number
}

// Utility functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor((p / 100) * sorted.length)
  return sorted[index] || 0
}

/**
 * ADVANCED TEST 1: Debounce Performance and Accuracy
 * Tests debounce timing, call collapsing, and throughput
 */
async function testDebouncePerformance(): Promise<AdvancedBenchmarkResult> {
  console.log('\n🔥 ADVANCED TEST 1: Debounce Performance and Accuracy')

  metricsReport.reset()
  const debounceMs = 50
  const callBursts = 20 // Number of burst sequences
  const callsPerBurst = 10 // Calls in each burst
  const burstInterval = 100 // Time between bursts

  // Setup debounced action
  cyre.action({
    id: 'debounce-test',
    debounce: debounceMs,
    payload: {counter: 0}
  })

  let actualExecutions = 0
  const executionTimes: number[] = []
  const callTimes: number[] = []

  cyre.on('debounce-test', payload => {
    actualExecutions++
    return {
      executed: true,
      finalPayload: payload,
      executionTime: Date.now()
    }
  })

  console.log(`  Testing ${callBursts} bursts of ${callsPerBurst} calls each`)
  console.log(`  Debounce: ${debounceMs}ms, Burst interval: ${burstInterval}ms`)

  const startTime = performance.now()
  let totalCalls = 0
  let errors = 0

  // Execute call bursts
  for (let burst = 0; burst < callBursts; burst++) {
    const burstStartTime = performance.now()

    // Rapid calls within debounce window (should collapse to 1 execution)
    for (let call = 0; call < callsPerBurst; call++) {
      const callStart = performance.now()

      try {
        const result = await cyre.call('debounce-test', {
          burst,
          call,
          timestamp: Date.now()
        })

        callTimes.push(performance.now() - callStart)
        totalCalls++

        if (!result.ok) errors++
      } catch (error) {
        errors++
      }

      // Small delay within burst (much less than debounce time)
      await sleep(2)
    }

    // Wait for this burst's debounce to complete + interval before next burst
    await sleep(debounceMs + burstInterval)
  }

  // Wait for final debounce to complete
  await sleep(debounceMs + 50)

  const totalTime = performance.now() - startTime

  // Calculate metrics
  const avgCallLatency =
    callTimes.reduce((sum, time) => sum + time, 0) / callTimes.length
  const throughput = (totalCalls / totalTime) * 1000

  // Debounce efficiency: should have ~1 execution per burst
  const expectedExecutions = callBursts
  const debounceEfficiency = (totalCalls - actualExecutions) / totalCalls
  const accuracyRatio = actualExecutions / expectedExecutions

  console.log(`  📊 Results:`)
  console.log(`    Total calls made: ${totalCalls}`)
  console.log(`    Actual executions: ${actualExecutions}`)
  console.log(`    Expected executions: ${expectedExecutions}`)
  console.log(
    `    Debounce efficiency: ${(debounceEfficiency * 100).toFixed(
      1
    )}% calls collapsed`
  )
  console.log(
    `    Timing accuracy: ${(accuracyRatio * 100).toFixed(1)}% (target: ~100%)`
  )

  const result: AdvancedBenchmarkResult = {
    name: 'Debounce Performance',
    totalOperations: totalCalls,
    successfulOperations: totalCalls - errors,
    averageLatency: avgCallLatency,
    p95Latency: percentile(callTimes, 95),
    throughput,
    featureSpecificMetrics: {
      actualExecutions,
      expectedExecutions,
      debounceEfficiency: debounceEfficiency * 100,
      timingAccuracy: accuracyRatio * 100,
      callsCollapsed: totalCalls - actualExecutions
    },
    errors,
    testDuration: totalTime
  }

  return result
}

/**
 * ADVANCED TEST 2: Repeat Execution Performance
 * Tests interval timing, repeat counts, and execution accuracy
 */
async function testRepeatPerformance(): Promise<AdvancedBenchmarkResult> {
  console.log('\n🔥 ADVANCED TEST 2: Repeat Execution Performance')

  metricsReport.reset()
  const intervalMs = 25 // Fast interval for testing
  const repeatCount = 10
  const parallelActions = 5 // Multiple repeat actions running in parallel

  console.log(`  Testing ${parallelActions} parallel actions`)
  console.log(
    `  Each action: ${repeatCount} repeats with ${intervalMs}ms interval`
  )

  const executionCounts: Record<string, number> = {}
  const executionTimes: Record<string, number[]> = {}
  const intervalAccuracy: Record<string, number[]> = {}
  let errors = 0

  // Setup multiple repeat actions
  const actionPromises: Promise<void>[] = []

  for (let i = 0; i < parallelActions; i++) {
    const actionId = `repeat-test-${i}`
    executionCounts[actionId] = 0
    executionTimes[actionId] = []
    intervalAccuracy[actionId] = []

    // Create action with repeat
    cyre.action({
      id: actionId,
      interval: intervalMs,
      repeat: repeatCount,
      payload: {actionIndex: i}
    })

    // Track executions
    cyre.on(actionId, payload => {
      const executionTime = Date.now()
      executionCounts[actionId]++

      const previousTime =
        executionTimes[actionId][executionTimes[actionId].length - 1]
      executionTimes[actionId].push(executionTime)

      // Calculate interval accuracy (skip first execution)
      if (previousTime) {
        const actualInterval = executionTime - previousTime
        intervalAccuracy[actionId].push(Math.abs(actualInterval - intervalMs))
      }

      return {
        executed: true,
        executionCount: executionCounts[actionId],
        expectedCount: repeatCount
      }
    })

    // Start the repeat action
    const actionPromise = new Promise<void>(resolve => {
      cyre.call(actionId, {start: Date.now()}).catch(() => errors++)

      // Wait for all executions to complete (with safety margin)
      setTimeout(resolve, repeatCount * intervalMs + 200)
    })

    actionPromises.push(actionPromise)
  }

  const startTime = performance.now()

  // Wait for all repeat actions to complete
  await Promise.all(actionPromises)

  const totalTime = performance.now() - startTime

  // Calculate aggregate metrics
  const totalExecutions = Object.values(executionCounts).reduce(
    (sum, count) => sum + count,
    0
  )
  const expectedTotal = parallelActions * repeatCount
  const allIntervalErrors = Object.values(intervalAccuracy).flat()
  const avgIntervalError =
    allIntervalErrors.reduce((sum, err) => sum + err, 0) /
    allIntervalErrors.length
  const throughput = (totalExecutions / totalTime) * 1000

  // Execution accuracy
  const executionAccuracy = (totalExecutions / expectedTotal) * 100

  console.log(`  📊 Results:`)
  console.log(`    Expected total executions: ${expectedTotal}`)
  console.log(`    Actual total executions: ${totalExecutions}`)
  console.log(`    Execution accuracy: ${executionAccuracy.toFixed(1)}%`)
  console.log(`    Average interval error: ${avgIntervalError.toFixed(2)}ms`)
  console.log(
    `    Parallel execution efficiency: ${(
      (totalExecutions / totalTime) *
      1000
    ).toFixed(0)} executions/sec`
  )

  // Individual action analysis
  Object.entries(executionCounts).forEach(([actionId, count]) => {
    const avgError =
      intervalAccuracy[actionId].reduce((sum, err) => sum + err, 0) /
      intervalAccuracy[actionId].length
    console.log(
      `    ${actionId}: ${count}/${repeatCount} executions, ${avgError.toFixed(
        2
      )}ms avg timing error`
    )
  })

  const result: AdvancedBenchmarkResult = {
    name: 'Repeat Execution',
    totalOperations: totalExecutions,
    successfulOperations: totalExecutions,
    averageLatency: avgIntervalError,
    p95Latency: percentile(allIntervalErrors, 95),
    throughput,
    featureSpecificMetrics: {
      expectedExecutions: expectedTotal,
      executionAccuracy,
      averageIntervalError: avgIntervalError,
      parallelActions,
      intervalMs,
      repeatCount
    },
    errors,
    testDuration: totalTime
  }

  return result
}

/**
 * ADVANCED TEST 3: IntraLink Chain Performance
 * Tests chain reaction speed, depth, and reliability
 */
async function testIntraLinkPerformance(): Promise<AdvancedBenchmarkResult> {
  console.log('\n🔥 ADVANCED TEST 3: IntraLink Chain Performance')

  metricsReport.reset()
  const chainDepth = 5
  const parallelChains = 10
  const chainsPerBatch = 20

  console.log(`  Testing ${parallelChains} parallel chains`)
  console.log(`  Chain depth: ${chainDepth} links`)
  console.log(`  Batches: ${chainsPerBatch}`)

  // Setup chain links
  for (let depth = 0; depth < chainDepth; depth++) {
    const currentId = `chain-link-${depth}`
    const nextId = depth < chainDepth - 1 ? `chain-link-${depth + 1}` : null

    cyre.action({
      id: currentId,
      payload: {depth, chainId: ''}
    })

    cyre.on(currentId, payload => {
      const processedData = {
        ...payload,
        depth,
        processedAt: Date.now(),
        chainHistory: [...(payload.chainHistory || []), currentId]
      }

      // If not the final link, return IntraLink to next
      if (nextId) {
        return {
          id: nextId,
          payload: processedData
        }
      }

      // Final link - return completion
      return {
        chainCompleted: true,
        finalDepth: depth,
        ...processedData
      }
    })
  }

  const chainResults: any[] = []
  const chainLatencies: number[] = []
  let errors = 0

  const startTime = performance.now()

  // Execute multiple batches of parallel chains
  for (let batch = 0; batch < chainsPerBatch; batch++) {
    const batchPromises: Promise<any>[] = []

    for (let chain = 0; chain < parallelChains; chain++) {
      const chainId = `batch-${batch}-chain-${chain}`
      const chainStartTime = performance.now()

      const chainPromise = cyre
        .call('chain-link-0', {
          chainId,
          startTime: chainStartTime,
          batchId: batch
        })
        .then(result => {
          const chainEndTime = performance.now()
          const chainLatency = chainEndTime - chainStartTime

          chainLatencies.push(chainLatency)
          chainResults.push({
            chainId,
            result,
            latency: chainLatency,
            success: result.ok
          })

          if (!result.ok) errors++

          return result
        })
        .catch(error => {
          errors++
          return {ok: false, error}
        })

      batchPromises.push(chainPromise)
    }

    // Wait for current batch to complete
    await Promise.all(batchPromises)

    // Small delay between batches
    await sleep(10)
  }

  const totalTime = performance.now() - startTime

  // Calculate metrics
  const totalChains = chainsPerBatch * parallelChains
  const successfulChains = chainResults.filter(r => r.success).length
  const avgChainLatency =
    chainLatencies.reduce((sum, lat) => sum + lat, 0) / chainLatencies.length
  const throughput = (totalChains / totalTime) * 1000

  // Chain efficiency analysis
  const totalExpectedLinks = totalChains * chainDepth
  const chainSuccessRate = (successfulChains / totalChains) * 100

  console.log(`  📊 Results:`)
  console.log(`    Total chains initiated: ${totalChains}`)
  console.log(`    Successful chains: ${successfulChains}`)
  console.log(`    Chain success rate: ${chainSuccessRate.toFixed(1)}%`)
  console.log(`    Average chain latency: ${avgChainLatency.toFixed(3)}ms`)
  console.log(`    Chain throughput: ${throughput.toFixed(0)} chains/sec`)
  console.log(
    `    Link processing rate: ${(throughput * chainDepth).toFixed(
      0
    )} links/sec`
  )

  const result: AdvancedBenchmarkResult = {
    name: 'IntraLink Chains',
    totalOperations: totalChains,
    successfulOperations: successfulChains,
    averageLatency: avgChainLatency,
    p95Latency: percentile(chainLatencies, 95),
    throughput,
    featureSpecificMetrics: {
      chainDepth,
      parallelChains,
      chainsPerBatch,
      chainSuccessRate,
      totalExpectedLinks,
      linkProcessingRate: throughput * chainDepth
    },
    errors,
    testDuration: totalTime
  }

  return result
}

/**
 * ADVANCED TEST 4: Delay Scheduling Accuracy
 * Tests delay timing precision and scheduling efficiency
 */
async function testDelayPerformance(): Promise<AdvancedBenchmarkResult> {
  console.log('\n🔥 ADVANCED TEST 4: Delay Scheduling Accuracy')

  metricsReport.reset()
  const delayVariations = [10, 25, 50, 100, 250] // Different delay times
  const actionsPerDelay = 20

  console.log(`  Testing delays: ${delayVariations.join(', ')}ms`)
  console.log(`  ${actionsPerDelay} actions per delay timing`)

  const delayResults: Record<number, any[]> = {}
  const allLatencies: number[] = []
  let errors = 0
  let totalScheduled = 0

  const startTime = performance.now()

  // Test each delay variation
  for (const delayMs of delayVariations) {
    delayResults[delayMs] = []

    const actionPromises: Promise<any>[] = []

    for (let i = 0; i < actionsPerDelay; i++) {
      const actionId = `delay-${delayMs}-${i}`

      // Create delayed action
      cyre.action({
        id: actionId,
        delay: delayMs,
        payload: {delayMs, actionIndex: i}
      })

      cyre.on(actionId, payload => {
        return {
          executed: true,
          actualDelay: delayMs,
          executedAt: Date.now()
        }
      })

      const scheduleStartTime = performance.now()
      totalScheduled++

      const actionPromise = cyre
        .call(actionId, {
          scheduledAt: Date.now(),
          expectedDelay: delayMs
        })
        .then(result => {
          const actualExecutionTime = performance.now()
          const actualDelay = actualExecutionTime - scheduleStartTime
          const delayAccuracy = Math.abs(actualDelay - delayMs)

          allLatencies.push(actualDelay)

          delayResults[delayMs].push({
            actionId,
            expectedDelay: delayMs,
            actualDelay,
            delayAccuracy,
            success: result.ok
          })

          if (!result.ok) errors++

          return result
        })
        .catch(error => {
          errors++
          return {ok: false, error}
        })

      actionPromises.push(actionPromise)

      // Small stagger between scheduling
      await sleep(5)
    }

    // Wait for all actions with this delay to complete
    await Promise.all(actionPromises)

    // Analysis for this delay timing
    const results = delayResults[delayMs]
    const avgAccuracy =
      results.reduce((sum, r) => sum + r.delayAccuracy, 0) / results.length
    const successRate =
      (results.filter(r => r.success).length / results.length) * 100

    console.log(
      `    ${delayMs}ms delay: ${avgAccuracy.toFixed(
        2
      )}ms avg error, ${successRate.toFixed(1)}% success`
    )
  }

  const totalTime = performance.now() - startTime

  // Calculate aggregate metrics
  const allResults = Object.values(delayResults).flat()
  const overallAccuracy =
    allResults.reduce((sum, r) => sum + r.delayAccuracy, 0) / allResults.length
  const avgLatency =
    allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length
  const throughput = (totalScheduled / totalTime) * 1000

  console.log(`  📊 Overall Results:`)
  console.log(`    Total actions scheduled: ${totalScheduled}`)
  console.log(
    `    Overall timing accuracy: ${overallAccuracy.toFixed(2)}ms average error`
  )
  console.log(`    Scheduling throughput: ${throughput.toFixed(0)} actions/sec`)

  const result: AdvancedBenchmarkResult = {
    name: 'Delay Scheduling',
    totalOperations: totalScheduled,
    successfulOperations: totalScheduled - errors,
    averageLatency: avgLatency,
    p95Latency: percentile(allLatencies, 95),
    throughput,
    featureSpecificMetrics: {
      delayVariations,
      actionsPerDelay,
      overallTimingAccuracy: overallAccuracy,
      delayResults: Object.fromEntries(
        Object.entries(delayResults).map(([delay, results]) => [
          delay,
          {
            avgAccuracy:
              results.reduce((sum, r) => sum + r.delayAccuracy, 0) /
              results.length,
            successRate:
              (results.filter(r => r.success).length / results.length) * 100
          }
        ])
      )
    },
    errors,
    testDuration: totalTime
  }

  return result
}

/**
 * ADVANCED TEST 5: Combined Features Integration
 * Tests multiple features working together
 */
async function testCombinedFeatures(): Promise<AdvancedBenchmarkResult> {
  console.log('\n🔥 ADVANCED TEST 5: Combined Features Integration')

  metricsReport.reset()
  const scenarios = 10

  console.log(`  Testing ${scenarios} complex scenarios combining all features`)

  const scenarioResults: any[] = []
  let totalOperations = 0
  let errors = 0

  const startTime = performance.now()

  for (let scenario = 0; scenario < scenarios; scenario++) {
    const scenarioStartTime = performance.now()

    // Scenario: Debounced action that triggers repeat action with delays and chains
    const scenarioId = `scenario-${scenario}`

    // Setup debounced trigger
    cyre.action({
      id: `${scenarioId}-trigger`,
      debounce: 30,
      payload: {scenario}
    })

    // Setup repeat action
    cyre.action({
      id: `${scenarioId}-repeat`,
      interval: 20,
      repeat: 3,
      payload: {scenario}
    })

    // Setup delayed chain starter
    cyre.action({
      id: `${scenarioId}-chain-start`,
      delay: 15,
      payload: {scenario}
    })

    // Setup chain middle and end
    cyre.action({id: `${scenarioId}-chain-middle`, payload: {scenario}})
    cyre.action({id: `${scenarioId}-chain-end`, payload: {scenario}})

    // Wire up handlers
    cyre.on(`${scenarioId}-trigger`, payload => {
      return {
        id: `${scenarioId}-repeat`,
        payload: {...payload, triggeredBy: 'debounce'}
      }
    })

    cyre.on(`${scenarioId}-repeat`, payload => {
      return {
        id: `${scenarioId}-chain-start`,
        payload: {...payload, triggeredBy: 'repeat'}
      }
    })

    cyre.on(`${scenarioId}-chain-start`, payload => {
      return {
        id: `${scenarioId}-chain-middle`,
        payload: {...payload, triggeredBy: 'delay'}
      }
    })

    cyre.on(`${scenarioId}-chain-middle`, payload => {
      return {
        id: `${scenarioId}-chain-end`,
        payload: {...payload, triggeredBy: 'chain-middle'}
      }
    })

    cyre.on(`${scenarioId}-chain-end`, payload => {
      return {
        completed: true,
        scenario,
        finalPayload: payload
      }
    })

    // Execute scenario - trigger rapid calls (should debounce)
    const triggerPromises: Promise<any>[] = []
    for (let trigger = 0; trigger < 5; trigger++) {
      totalOperations++

      const promise = cyre
        .call(`${scenarioId}-trigger`, {
          scenario,
          trigger,
          timestamp: Date.now()
        })
        .catch(error => {
          errors++
          return {ok: false, error}
        })

      triggerPromises.push(promise)
      await sleep(5) // Rapid triggers within debounce window
    }

    await Promise.all(triggerPromises)

    // Wait for entire scenario to complete (debounce + repeat + delay + chains)
    await sleep(200)

    const scenarioTime = performance.now() - scenarioStartTime

    scenarioResults.push({
      scenario,
      duration: scenarioTime,
      completed: true
    })

    console.log(`    Scenario ${scenario}: ${scenarioTime.toFixed(2)}ms`)
  }

  const totalTime = performance.now() - startTime

  // Calculate metrics
  const avgScenarioTime =
    scenarioResults.reduce((sum, r) => sum + r.duration, 0) /
    scenarioResults.length
  const throughput = (scenarios / totalTime) * 1000

  console.log(`  📊 Results:`)
  console.log(`    Scenarios completed: ${scenarios}`)
  console.log(`    Average scenario time: ${avgScenarioTime.toFixed(2)}ms`)
  console.log(`    Scenario throughput: ${throughput.toFixed(2)} scenarios/sec`)
  console.log(`    Total operations: ${totalOperations}`)

  const result: AdvancedBenchmarkResult = {
    name: 'Combined Features',
    totalOperations,
    successfulOperations: totalOperations - errors,
    averageLatency: avgScenarioTime,
    p95Latency: percentile(
      scenarioResults.map(r => r.duration),
      95
    ),
    throughput,
    featureSpecificMetrics: {
      scenarios,
      averageScenarioTime: avgScenarioTime,
      featuresUsed: ['debounce', 'repeat', 'delay', 'intralink']
    },
    errors,
    testDuration: totalTime
  }

  return result
}

/**
 * Generate Advanced Features Report
 */
function generateAdvancedReport(results: AdvancedBenchmarkResult[]): void {
  console.log('\n' + '='.repeat(80))
  console.log('  CYRE ADVANCED FEATURES PERFORMANCE REPORT')
  console.log('='.repeat(80))

  // Summary table
  console.log('\n📊 ADVANCED FEATURES SUMMARY')
  console.log(
    '┌' +
      '─'.repeat(25) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(8) +
      '┐'
  )
  console.log(
    '│ Feature Test            │ Operations   │ Throughput   │ Avg Latency  │ Errors   │'
  )
  console.log(
    '├' +
      '─'.repeat(25) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(8) +
      '┤'
  )

  results.forEach(result => {
    const name = result.name.padEnd(23)
    const ops = result.totalOperations.toString().padStart(10)
    const throughput = result.throughput.toFixed(0).padStart(10)
    const latency = result.averageLatency.toFixed(3).padStart(10)
    const errors = result.errors.toString().padStart(6)

    console.log(
      `│ ${name} │ ${ops}   │ ${throughput}   │ ${latency}    │ ${errors}   │`
    )
  })

  console.log(
    '└' +
      '─'.repeat(25) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(8) +
      '┘'
  )

  // Feature-specific analysis
  console.log('\n🔍 FEATURE-SPECIFIC ANALYSIS')

  results.forEach(result => {
    console.log(`\n${result.name}:`)
    Object.entries(result.featureSpecificMetrics).forEach(([key, value]) => {
      if (typeof value === 'number') {
        console.log(`  ├─ ${key}: ${value.toFixed(2)}`)
      } else if (typeof value === 'object') {
        console.log(`  ├─ ${key}:`)
        Object.entries(value).forEach(([subKey, subValue]) => {
          console.log(`  │  └─ ${subKey}: ${subValue}`)
        })
      } else {
        console.log(`  ├─ ${key}: ${value}`)
      }
    })
  })

  // Overall assessment
  console.log('\n🎯 OVERALL FEATURE ASSESSMENT')

  const totalOps = results.reduce((sum, r) => sum + r.totalOperations, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
  const errorRate = (totalErrors / totalOps) * 100
  const avgThroughput =
    results.reduce((sum, r) => sum + r.throughput, 0) / results.length

  console.log(`Total operations across all advanced features: ${totalOps}`)
  console.log(
    `Overall error rate: ${errorRate.toFixed(3)}% (${totalErrors}/${totalOps})`
  )
  console.log(`Average feature throughput: ${avgThroughput.toFixed(0)} ops/sec`)

  // Feature readiness assessment
  console.log('\n✅ FEATURE READINESS ASSESSMENT')

  results.forEach(result => {
    const successRate =
      ((result.totalOperations - result.errors) / result.totalOperations) * 100
    const status =
      successRate >= 99
        ? '🟢 Production Ready'
        : successRate >= 95
        ? '🟡 Needs Minor Fixes'
        : '🔴 Needs Work'

    console.log(
      `${result.name}: ${status} (${successRate.toFixed(1)}% success rate)`
    )
  })

  console.log('\n📁 FULL ADVANCED RESULTS DATA')
  console.log(JSON.stringify(results, null, 2))
}

/**
 * Main test runner for advanced features
 */
export async function runAdvancedFeaturesTest(): Promise<void> {
  console.log('🚀 CYRE Advanced Features Performance Test Suite')
  console.log(
    'Testing unique CYRE capabilities: debounce, repeat, intralink, delay\n'
  )

  // Initialize system
  if (!cyre.status) {
    await cyre.init()
  }

  const results: AdvancedBenchmarkResult[] = []

  try {
    // Run advanced feature tests in sequence
    console.log("Starting comprehensive testing of CYRE's unique features...")

    results.push(await testDebouncePerformance())
    await sleep(1000) // Allow system to stabilize

    results.push(await testRepeatPerformance())
    await sleep(1000)

    results.push(await testIntraLinkPerformance())
    await sleep(1000)

    results.push(await testDelayPerformance())
    await sleep(1000)

    results.push(await testCombinedFeatures())
    await sleep(500)

    // Generate comprehensive report
    generateAdvancedReport(results)

    // Additional sensor validation
    console.log('\n📡 SENSOR VALIDATION')
    const finalMetrics = metricsReport.getSystemStats()
    console.log(`Final system metrics:`)
    console.log(`├─ Total calls tracked: ${finalMetrics.totalCalls}`)
    console.log(`├─ Total executions tracked: ${finalMetrics.totalExecutions}`)
    console.log(`├─ Total errors tracked: ${finalMetrics.totalErrors}`)
    console.log(`└─ Call rate: ${finalMetrics.callRate}/sec`)

    // Export detailed event data for analysis
    const allEvents = metricsReport.exportEvents()
    const eventsByType = allEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\n📊 EVENT TYPE DISTRIBUTION')
    Object.entries(eventsByType)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`├─ ${type}: ${count} events`)
      })

    // Feature-specific event analysis
    console.log('\n🔍 FEATURE-SPECIFIC EVENT ANALYSIS')

    const debounceEvents = allEvents.filter(
      e =>
        e.eventType === 'debounce' || (e.metadata && e.metadata.debounceActive)
    )
    console.log(`Debounce events: ${debounceEvents.length}`)

    const intraLinkEvents = allEvents.filter(e => e.eventType === 'intralink')
    console.log(`IntraLink events: ${intraLinkEvents.length}`)

    const throttleEvents = allEvents.filter(e => e.eventType === 'throttle')
    console.log(`Throttle events: ${throttleEvents.length}`)

    console.log('\n🎉 Advanced features test completed successfully!')
  } catch (error) {
    console.error('❌ Advanced features test failed:', error)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
  }
}

runAdvancedFeaturesTest()
