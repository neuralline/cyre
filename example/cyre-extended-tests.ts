// example/cyre-extended-tests.ts

import {cyre} from '../src'
import {metricsReport} from '../src/context/metrics-report'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Extended Extreme Test Cases
    
    These tests focus on addressing specific performance issues
    and edge cases identified in the initial extreme tests.
*/

// Helper to delay execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Log section header
const logSection = (title: string) => {
  console.log('\n' + '='.repeat(80))
  console.log(`  ${title}`)
  console.log('='.repeat(80))
}

// Measure function execution time
const measureTime = async <T>(
  fn: () => Promise<T>
): Promise<{result: T; time: number}> => {
  const start = performance.now()
  const result = await fn()
  const time = performance.now() - start
  return {result, time}
}

/**
 * EXTENDED TEST 1: Pipeline Overhead Investigation
 * Tests Cyre's action pipeline overhead vs. actual handler execution time
 */
async function testPipelineOverhead() {
  logSection('EXTENDED TEST 1: Pipeline Overhead Investigation')

  // Create a range of actions with increasing protection complexity
  cyre.action({id: 'overhead-none', payload: {}})
  cyre.action({id: 'overhead-throttle', throttle: 100, payload: {}})
  cyre.action({id: 'overhead-debounce', debounce: 100, payload: {}})
  cyre.action({id: 'overhead-change', detectChanges: true, payload: {}})
  cyre.action({
    id: 'overhead-all',
    throttle: 100,
    debounce: 100,
    detectChanges: true,
    payload: {}
  })

  // Create a middleware for testing overhead
  cyre.middleware('overhead-middleware', async (action, payload) => {
    // Simulate minimal middleware processing
    return {action, payload}
  })

  // Create an action with middleware
  cyre.action({
    id: 'overhead-middleware',
    middleware: ['overhead-middleware'],
    payload: {}
  })

  // Simple handler that has measurable execution time
  const handlerWithWork = async (payload: any) => {
    const start = performance.now()
    // Perform some measurable work (sum calculation)
    let sum = 0
    for (let i = 0; i < 100000; i++) {
      sum += i
    }
    const executionTime = performance.now() - start

    return {
      result: sum,
      executionTime
    }
  }

  // Set up handlers
  cyre.on('overhead-none', handlerWithWork)
  cyre.on('overhead-throttle', handlerWithWork)
  cyre.on('overhead-debounce', handlerWithWork)
  cyre.on('overhead-change', handlerWithWork)
  cyre.on('overhead-all', handlerWithWork)
  cyre.on('overhead-middleware', handlerWithWork)

  console.log(
    'Testing pipeline overhead with identical work across different protection settings...'
  )
  console.log('Each test uses the same handler with identical CPU-bound work')

  // Run 10 calls for each action to get average times
  const runs = 10
  const results: Record<
    string,
    {totalTime: number; handlerTime: number; overheadPercent: number}
  > = {}

  // Test each action type
  for (const actionId of [
    'overhead-none',
    'overhead-throttle',
    'overhead-debounce',
    'overhead-change',
    'overhead-all',
    'overhead-middleware'
  ]) {
    results[actionId] = {totalTime: 0, handlerTime: 0, overheadPercent: 0}

    // For debounce, we need to call once and wait for execution
    if (actionId === 'overhead-debounce' || actionId === 'overhead-all') {
      console.log(`\nTesting ${actionId} (special handling for debounce)...`)

      // For debounced actions, we make one call and wait
      const startTime = performance.now()
      const callResult = await cyre.call(actionId, {iteration: 0})

      // Wait for debounce to complete
      await wait(150)

      // Gather metrics
      const actionMetrics = metricsReport.getActionMetrics(actionId)
      if (actionMetrics && actionMetrics.executionTimes.length > 0) {
        const totalTime = actionMetrics.executionTimes[0]
        const handlerTime = actionMetrics.listenerExecutionTimes[0] || 0

        results[actionId] = {
          totalTime,
          handlerTime,
          overheadPercent: ((totalTime - handlerTime) / totalTime) * 100
        }
      }

      console.log(
        `  Total execution time: ${results[actionId].totalTime.toFixed(2)}ms`
      )
      console.log(
        `  Handler execution time: ${results[actionId].handlerTime.toFixed(
          2
        )}ms`
      )
      console.log(
        `  Pipeline overhead: ${results[actionId].overheadPercent.toFixed(2)}%`
      )
    } else {
      console.log(`\nTesting ${actionId} with ${runs} runs...`)

      // Run multiple times to get average
      for (let i = 0; i < runs; i++) {
        // Call action with unique payload to prevent change detection skips
        await cyre.call(actionId, {iteration: i})
      }

      // Gather metrics
      const actionMetrics = metricsReport.getActionMetrics(actionId)
      if (actionMetrics && actionMetrics.executionTimes.length > 0) {
        // Calculate averages
        const totalTime = actionMetrics.avgExecutionTime
        const handlerTime = actionMetrics.avgListenerExecutionTime || 0

        results[actionId] = {
          totalTime,
          handlerTime,
          overheadPercent: ((totalTime - handlerTime) / totalTime) * 100
        }
      }

      console.log(
        `  Average total execution time: ${results[actionId].totalTime.toFixed(
          2
        )}ms`
      )
      console.log(
        `  Average handler execution time: ${results[
          actionId
        ].handlerTime.toFixed(2)}ms`
      )
      console.log(
        `  Pipeline overhead: ${results[actionId].overheadPercent.toFixed(2)}%`
      )
    }
  }

  // Compare and analyze results
  console.log('\nPipeline overhead analysis:')
  const baseline = results['overhead-none'].overheadPercent

  for (const [actionId, result] of Object.entries(results)) {
    if (actionId === 'overhead-none') continue

    const overheadIncrease = result.overheadPercent - baseline
    console.log(
      `  ${actionId}: ${result.overheadPercent.toFixed(
        2
      )}% overhead (${overheadIncrease.toFixed(2)}% increase from baseline)`
    )
  }

  // Wait for system to stabilize
  await wait(500)
}

/**
 * EXTENDED TEST 2: Priority Differentiation Stress Test
 * Tests Cyre's ability to prioritize critical actions under heavy load
 */
async function testPriorityDifferentiation() {
  logSection('EXTENDED TEST 2: Priority Differentiation Stress Test')

  // Create actions with different priorities
  cyre.action({
    id: 'priority-critical-test',
    priority: {level: 'critical'},
    payload: {value: 0}
  })

  cyre.action({
    id: 'priority-high-test',
    priority: {level: 'high'},
    payload: {value: 0}
  })

  cyre.action({
    id: 'priority-medium-test',
    priority: {level: 'medium'},
    payload: {value: 0}
  })

  cyre.action({
    id: 'priority-low-test',
    priority: {level: 'low'},
    payload: {value: 0}
  })

  cyre.action({
    id: 'priority-background-test',
    priority: {level: 'background'},
    payload: {value: 0}
  })

  // Handlers with consistent work
  const createHandler = (priority: string) => {
    return async (payload: any) => {
      // Record start time
      const start = performance.now()

      // Simulate work proportional to priority level
      // Critical tasks should be able to do more work in stress situations
      await wait(10)

      const executionTime = performance.now() - start
      console.log(
        `${priority} handler completed in ${executionTime.toFixed(2)}ms`
      )

      return {executionTime}
    }
  }

  // Set up handlers
  cyre.on('priority-critical-test', createHandler('Critical'))
  cyre.on('priority-high-test', createHandler('High'))
  cyre.on('priority-medium-test', createHandler('Medium'))
  cyre.on('priority-low-test', createHandler('Low'))
  cyre.on('priority-background-test', createHandler('Background'))

  // First test: baseline performance when system is unstressed
  console.log('\nBaseline priority performance (unstressed system):')

  await cyre.call('priority-critical-test', {iteration: 0})
  await cyre.call('priority-high-test', {iteration: 0})
  await cyre.call('priority-medium-test', {iteration: 0})
  await cyre.call('priority-low-test', {iteration: 0})
  await cyre.call('priority-background-test', {iteration: 0})

  // Wait for baseline tests to complete
  await wait(100)

  // Get breathing state before stress
  const breathingBeforeStress = cyre.getBreathingState()
  console.log('\nBreathing system before stress:')
  console.log(
    `  Stress level: ${(breathingBeforeStress.stress * 100).toFixed(2)}%`
  )
  console.log(
    `  Current breathing rate: ${breathingBeforeStress.currentRate}ms`
  )
  console.log(`  In recuperation: ${breathingBeforeStress.isRecuperating}`)

  // Second test: create system stress with a flood of actions
  console.log('\nCreating system stress with background load...')

  // Create background stress-inducing action
  cyre.action({
    id: 'stress-inducer',
    payload: {value: 0}
  })

  cyre.on('stress-inducer', async payload => {
    // Perform intensive work to create stress
    const start = performance.now()
    while (performance.now() - start < 5) {
      // Burn CPU for 5ms
      let x = 0
      for (let i = 0; i < 10000; i++) {
        x += Math.sqrt(i)
      }
    }
    return {completed: true}
  })

  // Flood the system with stress-inducing actions
  const stressPromises = []
  for (let i = 0; i < 100; i++) {
    stressPromises.push(cyre.call('stress-inducer', {iteration: i}))
  }

  // Wait for some of the stress load to be processed
  await wait(100)

  // Get breathing state during stress
  const breathingDuringStress = cyre.getBreathingState()
  console.log('\nBreathing system during stress:')
  console.log(
    `  Stress level: ${(breathingDuringStress.stress * 100).toFixed(2)}%`
  )
  console.log(
    `  Current breathing rate: ${breathingDuringStress.currentRate}ms`
  )
  console.log(`  In recuperation: ${breathingDuringStress.isRecuperating}`)

  // Third test: priority performance under stress
  console.log('\nPriority performance under stress:')

  // Execute each priority level and time it
  const stressedResults = await Promise.all([
    measureTime(() => cyre.call('priority-critical-test', {iteration: 1})),
    measureTime(() => cyre.call('priority-high-test', {iteration: 1})),
    measureTime(() => cyre.call('priority-medium-test', {iteration: 1})),
    measureTime(() => cyre.call('priority-low-test', {iteration: 1})),
    measureTime(() => cyre.call('priority-background-test', {iteration: 1}))
  ])

  // Output results
  const priorities = ['Critical', 'High', 'Medium', 'Low', 'Background']

  // Wait for all executions to complete
  await wait(100)

  // Analyze and report
  console.log('\nPriority performance comparison:')

  // Get metrics for each priority level
  for (let i = 0; i < priorities.length; i++) {
    const priority = priorities[i]
    const actionId = `priority-${priority.toLowerCase()}-test`
    const metrics = metricsReport.getActionMetrics(actionId)

    if (metrics) {
      console.log(`  ${priority}:`)
      console.log(`    Call latency: ${stressedResults[i].time.toFixed(2)}ms`)
      console.log(
        `    Execution time: ${metrics.avgExecutionTime.toFixed(2)}ms`
      )

      // Show ratio of stressed to unstressed performance
      if (metrics.executionTimes.length >= 2) {
        const unstressedTime = metrics.executionTimes[0]
        const stressedTime = metrics.executionTimes[1]
        const ratio = unstressedTime / stressedTime

        console.log(`    Stress performance ratio: ${ratio.toFixed(2)}x`)
      }
    }
  }

  // Wait for system to recover
  console.log('\nWaiting for system to recover...')
  await wait(500)
}

/**
 * EXTENDED TEST 3: Realistic Throttle Test
 * Tests Cyre's throttle mechanism with realistic timing and load
 */
async function testRealisticThrottle() {
  logSection('EXTENDED TEST 3: Realistic Throttle Test')

  // Create throttled action with tight throttle settings
  cyre.action({
    id: 'throttle-realistic',
    throttle: 50, // 50ms throttle - much tighter than original test
    payload: {counter: 0}
  })

  // Handler to track executed vs. rejected calls
  let executedCalls = 0
  cyre.on('throttle-realistic', payload => {
    executedCalls++
    // Return successful execution
    return {executed: true}
  })

  console.log('Testing throttle with 50ms between allowed executions')
  console.log(
    'Sending 20 calls with 10ms between each call (twice the call rate of the throttle)'
  )

  // Start the test
  const startTime = performance.now()
  const callResults = []

  // Send 20 calls with 10ms spacing (should result in ~50% throttling)
  for (let i = 0; i < 20; i++) {
    const callResult = await cyre.call('throttle-realistic', {counter: i})
    callResults.push({
      counter: i,
      success: callResult.ok,
      message: callResult.message
    })

    // Wait 10ms between calls
    await wait(10)
  }

  const totalTime = performance.now() - startTime

  // Calculate throttle rate
  const totalCalls = callResults.length
  const throttledCalls = callResults.filter(r => !r.success).length
  const throttleRate = (throttledCalls / totalCalls) * 100

  // Get metrics
  const metrics = metricsReport.getActionMetrics('throttle-realistic')

  console.log('\nThrottle test results:')
  console.log(`  Total time: ${totalTime.toFixed(2)}ms`)
  console.log(`  Total calls: ${totalCalls}`)
  console.log(`  Executed calls: ${executedCalls}`)
  console.log(`  Throttled calls: ${throttledCalls}`)
  console.log(`  Throttle rate: ${throttleRate.toFixed(2)}%`)

  if (metrics) {
    console.log(`  Reported throttles: ${metrics.throttles}`)
    console.log(
      `  Average execution time: ${metrics.avgExecutionTime.toFixed(2)}ms`
    )
  }

  // Wait for system to recover
  await wait(500)
}

/**
 * EXTENDED TEST 4: Circuit Breaker Pattern Test
 * Tests Cyre's ability to break circuits under extreme error conditions
 */
async function testCircuitBreaker() {
  logSection('EXTENDED TEST 4: Circuit Breaker Pattern Test')

  // Create an action with a handler that increasingly fails
  cyre.action({
    id: 'circuit-test',
    payload: {attempt: 0}
  })

  let totalFailures = 0
  let circuitBroken = false
  let lastSuccessfulCall = 0

  // Handler that fails with increasing probability
  cyre.on('circuit-test', payload => {
    const attempt = payload.attempt

    // Start failing after 5 calls, with increasing probability
    const failChance = Math.max(0, (attempt - 5) * 0.1)

    if (Math.random() < failChance) {
      totalFailures++
      throw new Error(`Simulated failure on attempt ${attempt}`)
    }

    // Record successful call
    lastSuccessfulCall = attempt
    return {success: true, attempt}
  })

  console.log(
    'Testing circuit breaker pattern with increasingly failing handler'
  )
  console.log(
    'Failure chance increases by 10% after each call starting at call #6'
  )

  // Make 30 calls and observe if a circuit breaker pattern emerges
  const results = []
  let allResponsesFailed = false

  for (let i = 0; i < 30; i++) {
    // Check if circuit appears to be broken (5 consecutive failures)
    if (
      results.length >= 5 &&
      results.slice(-5).every(r => !r.success) &&
      !circuitBroken
    ) {
      circuitBroken = true
      console.log(`\nCircuit appears broken after attempt ${i - 1}!`)
    }

    // Skip making calls if all responses are failing after attempt 20
    // This simulates a smart client giving up
    if (i >= 20 && allResponsesFailed) {
      console.log(`Skipping attempt ${i} - client decided to back off`)
      results.push({attempt: i, success: false, circuitBroken: true})
      continue
    }

    // Make the call
    const result = await cyre.call('circuit-test', {attempt: i})

    // Parse result
    const success = result.ok && !result.message.includes('failed')
    results.push({
      attempt: i,
      success,
      circuitBroken
    })

    // Check if failing consistently (for client backoff)
    if (i >= 20) {
      const last5 = results.slice(-5)
      allResponsesFailed = last5.every(r => !r.success)
    }

    // Add a small delay to let the system react
    await wait(10)
  }

  // Analyze results
  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount
  const successRate = (successCount / results.length) * 100

  console.log('\nCircuit breaker test results:')
  console.log(`  Total calls: ${results.length}`)
  console.log(`  Successful calls: ${successCount}`)
  console.log(`  Failed calls: ${failureCount}`)
  console.log(`  Success rate: ${successRate.toFixed(2)}%`)
  console.log(`  Last successful call: attempt #${lastSuccessfulCall}`)

  if (circuitBroken) {
    const breakPoint = results.findIndex(r => r.circuitBroken)
    console.log(`  Circuit broken at: attempt #${breakPoint}`)

    // Calculate time to break
    const timeToBreak = breakPoint * 10 // Approx time based on wait intervals
    console.log(`  Time to break circuit: ~${timeToBreak}ms`)
  } else {
    console.log('  Circuit was not broken during the test')
  }

  // Get metrics
  const metrics = metricsReport.getActionMetrics('circuit-test')

  if (metrics) {
    console.log(`  Reported executions: ${metrics.executionTimes.length}`)
    console.log(`  Reported errors: ${metrics.errorCount}`)
  }

  // Wait for system to recover
  await wait(500)
}

/**
 * EXTENDED TEST 5: Memory Leak Investigation
 * Tests Cyre's behavior under repeated action creation and disposal
 */
async function testMemoryLeakInvestigation() {
  logSection('EXTENDED TEST 5: Memory Leak Investigation')

  console.log(
    'Testing memory behavior with repeated action creation and disposal'
  )
  console.log('Creating and disposing 100 unique actions in sequence...')

  const actionCount = 100
  const actionsCreated = []

  // Create unique actions in sequence
  for (let i = 0; i < actionCount; i++) {
    const actionId = `mem-test-${i}`

    // Register action
    cyre.action({
      id: actionId,
      payload: {value: i}
    })

    // Set up handler
    cyre.on(actionId, payload => {
      return {handled: true, value: payload.value}
    })

    // Call once
    await cyre.call(actionId, {value: i})

    // Remember action
    actionsCreated.push(actionId)

    // Dispose of earlier actions periodically
    if (i > 0 && i % 10 === 0) {
      // Dispose of the 10 earliest actions
      const toDispose = actionsCreated.slice(0, 10)
      actionsCreated.splice(0, 10)

      console.log(
        `  Disposing of 10 actions: ${toDispose[0]} through ${toDispose[9]}`
      )

      // Forget each action
      for (const id of toDispose) {
        cyre.forget(id)
      }
    }
  }

  // Get system state after creation phase
  console.log('\nSystem state after creation phase:')
  const breathingAfterCreation = cyre.getBreathingState()
  console.log(
    `  Stress level: ${(breathingAfterCreation.stress * 100).toFixed(2)}%`
  )
  console.log(
    `  Current breathing rate: ${breathingAfterCreation.currentRate}ms`
  )

  // Dispose of all remaining actions
  console.log(`\nDisposing of ${actionsCreated.length} remaining actions...`)
  for (const id of actionsCreated) {
    cyre.forget(id)
  }

  // Wait a moment
  await wait(100)

  // Get system state after disposal
  console.log('\nSystem state after disposal:')
  const breathingAfterDisposal = cyre.getBreathingState()
  console.log(
    `  Stress level: ${(breathingAfterDisposal.stress * 100).toFixed(2)}%`
  )
  console.log(
    `  Current breathing rate: ${breathingAfterDisposal.currentRate}ms`
  )

  // Check if stress reduced after disposal
  const stressReduction =
    breathingAfterCreation.stress - breathingAfterDisposal.stress
  console.log(
    `\nStress reduction after disposal: ${(stressReduction * 100).toFixed(2)}%`
  )

  if (stressReduction > 0) {
    console.log(
      'Memory management appears effective - stress reduced after disposal'
    )
  } else {
    console.log(
      'Potential memory management issue - stress did not reduce after disposal'
    )
  }

  // Wait for system to recover
  await wait(500)
}

/**
 * Run all extended tests in sequence
 */
async function runExtendedTests() {
  // Reset any existing actions and metrics
  //cyre.clear()
  metricsReport.reset()

  logSection('CYRE EXTENDED TEST SUITE')
  console.log(
    'Testing Cyre with targeted extreme conditions based on initial findings\n'
  )

  try {
    await testPipelineOverhead()
    await wait(1000) // Allow system to fully recover between tests

    await testPriorityDifferentiation()
    await wait(1000)

    await testRealisticThrottle()
    await wait(1000)

    await testCircuitBreaker()
    await wait(1000)

    await testMemoryLeakInvestigation()
    await wait(1000)

    // Generate comprehensive report
    logSection('COMPREHENSIVE METRICS REPORT')
    metricsReport.logReport()

    // Show actionable insights
    logSection('ACTIONABLE INSIGHTS')
    const insights = metricsReport.getInsights()
    if (insights.length > 0) {
      insights.forEach(insight => console.log(`- ${insight}`))
    } else {
      console.log('No actionable insights detected.')
    }
  } catch (error) {
    console.error('Error running extended tests:', error)
    if (error.stack) console.error(error.stack)
  }
}

// Export the test runner
export {runExtendedTests}

runExtendedTests()
