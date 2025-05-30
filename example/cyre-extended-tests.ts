// example/cyre-extended-tests.ts
// pnpm tsx example/cyre-extended-tests.ts

import {cyre} from '../src'
import {metricsReport} from '../src/context/metrics-report'
import type {EventType} from '../src/context/metrics-report'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Extended Extreme Test Cases
    
    These tests focus on addressing specific performance issues
    and edge cases identified in the initial extreme tests.
    Updated to work with current sensor-based metrics architecture.
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

// Helper to get metrics for specific action
const getActionMetrics = (actionId: string) => {
  const events = metricsReport.exportEvents({actionIds: [actionId]})
  const executions = events.filter(e => e.eventType === 'execution')
  const errors = events.filter(e => e.eventType === 'error')
  const throttles = events.filter(e => e.eventType === 'throttle')
  const debounces = events.filter(e => e.eventType === 'debounce')
  const calls = events.filter(e => e.eventType === 'call')

  const executionTimes = executions
    .map(e => e.metadata?.duration)
    .filter(d => typeof d === 'number') as number[]

  return {
    totalCalls: calls.length,
    totalExecutions: executions.length,
    totalErrors: errors.length,
    totalThrottles: throttles.length,
    totalDebounces: debounces.length,
    executionTimes,
    avgExecutionTime:
      executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) /
          executionTimes.length
        : 0,
    events
  }
}

// Helper to get system-wide metrics
const getSystemMetrics = () => {
  const allEvents = metricsReport.exportEvents()
  const systemStats = metricsReport.getSystemStats()

  const eventsByType = allEvents.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1
    return acc
  }, {} as Record<EventType, number>)

  return {
    ...systemStats,
    eventsByType,
    totalEvents: allEvents.length
  }
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

  console.log(
    'Testing pipeline overhead with identical work across different protection settings...'
  )
  console.log('Each test uses the same handler with identical CPU-bound work')

  // Run 10 calls for each action to get average times
  const runs = 10
  const results: Record<
    string,
    {totalTime: number; callLatency: number; executionCount: number}
  > = {}

  // Test each action type
  for (const actionId of [
    'overhead-none',
    'overhead-throttle',
    'overhead-change'
  ]) {
    console.log(`\nTesting ${actionId} with ${runs} runs...`)

    const callTimes: number[] = []

    // Run multiple times to get average
    for (let i = 0; i < runs; i++) {
      const {time} = await measureTime(() =>
        cyre.call(actionId, {iteration: i})
      )
      callTimes.push(time)

      // Small delay to prevent overwhelming the system
      await wait(10)
    }

    // Calculate averages
    const avgCallTime =
      callTimes.reduce((sum, time) => sum + time, 0) / callTimes.length
    const metrics = getActionMetrics(actionId)

    results[actionId] = {
      totalTime: avgCallTime,
      callLatency: avgCallTime,
      executionCount: metrics.totalExecutions
    }

    console.log(
      `  Average call latency: ${results[actionId].totalTime.toFixed(2)}ms`
    )
    console.log(
      `  Total executions recorded: ${results[actionId].executionCount}`
    )
    console.log(
      `  Average execution time: ${metrics.avgExecutionTime.toFixed(2)}ms`
    )
  }

  // Handle debounced actions separately
  console.log(`\nTesting overhead-debounce (special handling for debounce)...`)

  const debounceStart = performance.now()
  await cyre.call('overhead-debounce', {iteration: 0})

  // Wait for debounce to complete
  await wait(150)

  const debounceTime = performance.now() - debounceStart
  const debounceMetrics = getActionMetrics('overhead-debounce')

  results['overhead-debounce'] = {
    totalTime: debounceTime,
    callLatency: debounceTime,
    executionCount: debounceMetrics.totalExecutions
  }

  console.log(`  Total time (including debounce): ${debounceTime.toFixed(2)}ms`)
  console.log(`  Executions: ${debounceMetrics.totalExecutions}`)
  console.log(`  Debounces recorded: ${debounceMetrics.totalDebounces}`)

  // Test all protections action
  console.log(`\nTesting overhead-all (combined protections)...`)

  const allStart = performance.now()
  await cyre.call('overhead-all', {iteration: 0})

  // Wait for debounce to complete
  await wait(150)

  const allTime = performance.now() - allStart
  const allMetrics = getActionMetrics('overhead-all')

  results['overhead-all'] = {
    totalTime: allTime,
    callLatency: allTime,
    executionCount: allMetrics.totalExecutions
  }

  console.log(`  Total time (with all protections): ${allTime.toFixed(2)}ms`)
  console.log(`  Executions: ${allMetrics.totalExecutions}`)
  console.log(`  Throttles: ${allMetrics.totalThrottles}`)
  console.log(`  Debounces: ${allMetrics.totalDebounces}`)

  // Compare and analyze results
  console.log('\nPipeline overhead analysis:')
  const baseline = results['overhead-none'].totalTime

  for (const [actionId, result] of Object.entries(results)) {
    if (actionId === 'overhead-none') continue

    const overhead = ((result.totalTime - baseline) / baseline) * 100
    console.log(
      `  ${actionId}: ${result.totalTime.toFixed(2)}ms (${overhead.toFixed(
        2
      )}% overhead vs baseline)`
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
  const priorities = [
    {level: 'critical', id: 'priority-critical-test'},
    {level: 'high', id: 'priority-high-test'},
    {level: 'medium', id: 'priority-medium-test'},
    {level: 'low', id: 'priority-low-test'},
    {level: 'background', id: 'priority-background-test'}
  ] as const

  // Create actions
  priorities.forEach(({level, id}) => {
    cyre.action({
      id,
      priority: {level},
      payload: {value: 0}
    })
  })

  // Handlers with consistent work
  const createHandler = (priority: string) => {
    return async (payload: any) => {
      const start = performance.now()

      // Simulate work proportional to priority level
      await wait(5)

      const executionTime = performance.now() - start
      console.log(
        `${priority} handler completed in ${executionTime.toFixed(2)}ms`
      )

      return {executionTime}
    }
  }

  // Set up handlers
  priorities.forEach(({level, id}) => {
    cyre.on(id, createHandler(level))
  })

  // First test: baseline performance when system is unstressed
  console.log('\nBaseline priority performance (unstressed system):')

  const baselineResults = await Promise.all(
    priorities.map(async ({id}) => {
      const {time} = await measureTime(() => cyre.call(id, {iteration: 0}))
      return {id, time}
    })
  )

  baselineResults.forEach(({id, time}) => {
    console.log(`  ${id}: ${time.toFixed(2)}ms`)
  })

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
  for (let i = 0; i < 50; i++) {
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

  const stressedResults = await Promise.all(
    priorities.map(async ({id}) => {
      const {time} = await measureTime(() => cyre.call(id, {iteration: 1}))
      return {id, time}
    })
  )

  // Output results and compare
  console.log('\nPriority performance comparison:')

  priorities.forEach(({level, id}, index) => {
    const baseline = baselineResults[index].time
    const stressed = stressedResults[index].time
    const degradation = ((stressed - baseline) / baseline) * 100
    const metrics = getActionMetrics(id)

    console.log(`  ${level}:`)
    console.log(`    Baseline: ${baseline.toFixed(2)}ms`)
    console.log(`    Under stress: ${stressed.toFixed(2)}ms`)
    console.log(`    Performance degradation: ${degradation.toFixed(2)}%`)
    console.log(`    Total executions: ${metrics.totalExecutions}`)
  })

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
    throttle: 50, // 50ms throttle
    payload: {counter: 0}
  })

  // Handler to track executed vs. rejected calls
  let executedCalls = 0
  cyre.on('throttle-realistic', payload => {
    executedCalls++
    return {executed: true, counter: payload.counter}
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
    const {result, time} = await measureTime(() =>
      cyre.call('throttle-realistic', {counter: i})
    )

    callResults.push({
      counter: i,
      success: result.ok,
      message: result.message,
      callTime: time
    })

    // Wait 10ms between calls
    await wait(10)
  }

  const totalTime = performance.now() - startTime

  // Calculate throttle rate
  const totalCalls = callResults.length
  const successfulCalls = callResults.filter(r => r.success).length
  const throttledCalls = totalCalls - successfulCalls
  const throttleRate = (throttledCalls / totalCalls) * 100

  // Get metrics
  const metrics = getActionMetrics('throttle-realistic')

  console.log('\nThrottle test results:')
  console.log(`  Total time: ${totalTime.toFixed(2)}ms`)
  console.log(`  Total calls made: ${totalCalls}`)
  console.log(`  Successful calls: ${successfulCalls}`)
  console.log(`  Throttled calls: ${throttledCalls}`)
  console.log(`  Throttle rate: ${throttleRate.toFixed(2)}%`)
  console.log(`  Handler executions: ${executedCalls}`)
  console.log(`  Metrics - calls: ${metrics.totalCalls}`)
  console.log(`  Metrics - executions: ${metrics.totalExecutions}`)
  console.log(`  Metrics - throttles: ${metrics.totalThrottles}`)

  if (metrics.avgExecutionTime > 0) {
    console.log(
      `  Average execution time: ${metrics.avgExecutionTime.toFixed(2)}ms`
    )
  }

  // Show throttle pattern
  console.log('\nCall pattern (S=Success, T=Throttled):')
  const pattern = callResults.map(r => (r.success ? 'S' : 'T')).join('')
  console.log(`  ${pattern}`)

  // Wait for system to recover
  await wait(500)
}

/**
 * EXTENDED TEST 4: Circuit Breaker Pattern Test
 * Tests Cyre's ability to handle cascading failures
 */
async function testCircuitBreaker() {
  logSection('EXTENDED TEST 4: Circuit Breaker Pattern Test')

  // Create an action with a handler that increasingly fails
  cyre.action({
    id: 'circuit-test',
    payload: {attempt: 0}
  })

  let totalFailures = 0
  let lastSuccessfulCall = -1

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

  // Make 30 calls and observe failure patterns
  const results = []

  for (let i = 0; i < 30; i++) {
    const {result, time} = await measureTime(() =>
      cyre.call('circuit-test', {attempt: i})
    )

    const success = result.ok && !result.message.includes('failed')
    results.push({
      attempt: i,
      success,
      message: result.message,
      callTime: time
    })

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

  // Get metrics
  const metrics = getActionMetrics('circuit-test')
  console.log(`  Metrics - calls: ${metrics.totalCalls}`)
  console.log(`  Metrics - executions: ${metrics.totalExecutions}`)
  console.log(`  Metrics - errors: ${metrics.totalErrors}`)

  // Show failure pattern
  console.log('\nCall pattern (S=Success, F=Failed):')
  const pattern = results.map(r => (r.success ? 'S' : 'F')).join('')
  console.log(`  ${pattern}`)

  // Identify failure clusters
  let consecutiveFailures = 0
  let maxConsecutiveFailures = 0

  results.forEach(r => {
    if (!r.success) {
      consecutiveFailures++
      maxConsecutiveFailures = Math.max(
        maxConsecutiveFailures,
        consecutiveFailures
      )
    } else {
      consecutiveFailures = 0
    }
  })

  console.log(`  Max consecutive failures: ${maxConsecutiveFailures}`)

  // Wait for system to recover
  await wait(500)
}

/**
 * EXTENDED TEST 5: Memory and Performance Investigation
 * Tests Cyre's behavior under repeated action creation and disposal
 */
async function testMemoryAndPerformance() {
  logSection('EXTENDED TEST 5: Memory and Performance Investigation')

  console.log(
    'Testing performance behavior with repeated action creation and disposal'
  )
  console.log('Creating and disposing 50 unique actions in sequence...')

  const actionCount = 50
  const actionsCreated = []
  const performanceData = []

  // Create unique actions in sequence
  for (let i = 0; i < actionCount; i++) {
    const actionId = `mem-test-${i}`

    // Measure action creation time
    const {time: createTime} = await measureTime(async () => {
      // Register action
      cyre.action({
        id: actionId,
        payload: {value: i}
      })

      // Set up handler
      cyre.on(actionId, payload => {
        return {handled: true, value: payload.value}
      })
    })

    // Measure call time
    const {time: callTime} = await measureTime(() =>
      cyre.call(actionId, {value: i})
    )

    performanceData.push({
      iteration: i,
      createTime,
      callTime,
      totalActions: i + 1
    })

    actionsCreated.push(actionId)

    // Dispose of earlier actions periodically
    if (i > 0 && i % 10 === 0) {
      const toDispose = actionsCreated.splice(0, 5) // Dispose of 5 actions

      console.log(
        `  Iteration ${i}: Disposing of 5 actions: ${toDispose[0]} through ${toDispose[4]}`
      )

      const {time: disposeTime} = await measureTime(async () => {
        for (const id of toDispose) {
          cyre.forget(id)
        }
      })

      console.log(`    Disposal took: ${disposeTime.toFixed(2)}ms`)
    }

    // Log performance every 10 iterations
    if (i > 0 && i % 10 === 0) {
      const recent = performanceData.slice(-10)
      const avgCreateTime =
        recent.reduce((sum, d) => sum + d.createTime, 0) / recent.length
      const avgCallTime =
        recent.reduce((sum, d) => sum + d.callTime, 0) / recent.length

      console.log(
        `  Iteration ${i}: Avg create time: ${avgCreateTime.toFixed(
          2
        )}ms, Avg call time: ${avgCallTime.toFixed(2)}ms`
      )
    }
  }

  // Get system state after creation phase
  console.log('\nSystem state after creation phase:')
  const breathingAfterCreation = cyre.getBreathingState()
  const systemMetrics = getSystemMetrics()

  console.log(
    `  Stress level: ${(breathingAfterCreation.stress * 100).toFixed(2)}%`
  )
  console.log(
    `  Current breathing rate: ${breathingAfterCreation.currentRate}ms`
  )
  console.log(`  Total events recorded: ${systemMetrics.totalEvents}`)
  console.log(`  Total calls: ${systemMetrics.totalCalls}`)
  console.log(`  Total executions: ${systemMetrics.totalExecutions}`)

  // Dispose of all remaining actions
  console.log(`\nDisposing of ${actionsCreated.length} remaining actions...`)

  const {time: finalDisposeTime} = await measureTime(async () => {
    for (const id of actionsCreated) {
      cyre.forget(id)
    }
  })

  console.log(`Final disposal took: ${finalDisposeTime.toFixed(2)}ms`)

  // Wait a moment for metrics to update
  await wait(100)

  // Get system state after disposal
  console.log('\nSystem state after disposal:')
  const breathingAfterDisposal = cyre.getBreathingState()
  const finalSystemMetrics = getSystemMetrics()

  console.log(
    `  Stress level: ${(breathingAfterDisposal.stress * 100).toFixed(2)}%`
  )
  console.log(
    `  Current breathing rate: ${breathingAfterDisposal.currentRate}ms`
  )
  console.log(`  Total events recorded: ${finalSystemMetrics.totalEvents}`)

  // Analyze performance trends
  console.log('\nPerformance trend analysis:')
  const firstQuarter = performanceData.slice(
    0,
    Math.floor(performanceData.length / 4)
  )
  const lastQuarter = performanceData.slice(
    -Math.floor(performanceData.length / 4)
  )

  const firstQuarterAvgCreate =
    firstQuarter.reduce((sum, d) => sum + d.createTime, 0) / firstQuarter.length
  const lastQuarterAvgCreate =
    lastQuarter.reduce((sum, d) => sum + d.createTime, 0) / lastQuarter.length

  const firstQuarterAvgCall =
    firstQuarter.reduce((sum, d) => sum + d.callTime, 0) / firstQuarter.length
  const lastQuarterAvgCall =
    lastQuarter.reduce((sum, d) => sum + d.callTime, 0) / lastQuarter.length

  const createTimeTrend =
    ((lastQuarterAvgCreate - firstQuarterAvgCreate) / firstQuarterAvgCreate) *
    100
  const callTimeTrend =
    ((lastQuarterAvgCall - firstQuarterAvgCall) / firstQuarterAvgCall) * 100

  console.log(
    `  Action creation time trend: ${createTimeTrend.toFixed(2)}% change`
  )
  console.log(`  Action call time trend: ${callTimeTrend.toFixed(2)}% change`)

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
  } else if (stressReduction < -0.01) {
    console.log(
      'Potential memory management issue - stress increased after disposal'
    )
  } else {
    console.log('Stress levels remained stable after disposal')
  }

  // Wait for system to recover
  await wait(500)
}

/**
 * EXTENDED TEST 6: Metrics and Sensor Validation
 * Tests that all sensors are working correctly
 */
async function testMetricsAndSensors() {
  logSection('EXTENDED TEST 6: Metrics and Sensor Validation')

  console.log('Testing all sensor types and metrics collection...')

  // Create test actions for different scenarios
  cyre.action({id: 'sensor-normal', payload: {test: true}})
  cyre.action({id: 'sensor-throttle', throttle: 100, payload: {test: true}})
  cyre.action({id: 'sensor-debounce', debounce: 100, payload: {test: true}})
  cyre.action({id: 'sensor-error', payload: {test: true}})
  cyre.action({id: 'sensor-change', detectChanges: true, payload: {test: true}})

  // Normal execution sensor
  cyre.on('sensor-normal', payload => {
    return {normal: true}
  })

  // Throttled execution sensor
  cyre.on('sensor-throttle', payload => {
    return {throttled: true}
  })

  // Debounced execution sensor
  cyre.on('sensor-debounce', payload => {
    return {debounced: true}
  })

  // Error sensor
  cyre.on('sensor-error', payload => {
    throw new Error('Test error for sensor validation')
  })

  // Change detection sensor
  cyre.on('sensor-change', payload => {
    return {changed: payload}
  })

  console.log('\nTesting normal execution sensor...')
  await cyre.call('sensor-normal', {test: 'normal'})

  console.log('Testing throttle sensor...')
  await cyre.call('sensor-throttle', {test: 'throttle1'})
  await cyre.call('sensor-throttle', {test: 'throttle2'}) // Should be throttled

  console.log('Testing debounce sensor...')
  await cyre.call('sensor-debounce', {test: 'debounce1'})
  await cyre.call('sensor-debounce', {test: 'debounce2'}) // Should be debounced
  await wait(150) // Wait for debounce to execute

  console.log('Testing error sensor...')
  try {
    await cyre.call('sensor-error', {test: 'error'})
  } catch (error) {
    // Expected error
  }

  console.log('Testing change detection sensor...')
  await cyre.call('sensor-change', {value: 1}) // First call
  await cyre.call('sensor-change', {value: 1}) // Should be skipped
  await cyre.call('sensor-change', {value: 2}) // Should execute

  // Wait for all async operations to complete
  await wait(200)

  // Analyze collected metrics
  console.log('\nSensor validation results:')

  const testActions = [
    'sensor-normal',
    'sensor-throttle',
    'sensor-debounce',
    'sensor-error',
    'sensor-change'
  ]

  for (const actionId of testActions) {
    const metrics = getActionMetrics(actionId)
    console.log(`\n  ${actionId}:`)
    console.log(`    Total calls: ${metrics.totalCalls}`)
    console.log(`    Total executions: ${metrics.totalExecutions}`)
    console.log(`    Total errors: ${metrics.totalErrors}`)
    console.log(`    Total throttles: ${metrics.totalThrottles}`)
    console.log(`    Total debounces: ${metrics.totalDebounces}`)

    if (metrics.avgExecutionTime > 0) {
      console.log(
        `    Average execution time: ${metrics.avgExecutionTime.toFixed(2)}ms`
      )
    }
  }

  // Test event streaming
  console.log('\nTesting live event streaming...')

  let streamedEvents: RawMetricEvent[] = []
  const streamId = metricsReport.createStream(
    {eventTypes: ['call', 'execution', 'error']},
    event => {
      streamedEvents.push(event)
    }
  )

  // Generate some events for streaming test
  await cyre.call('sensor-normal', {stream: 'test'})
  await wait(50)

  console.log(`    Events captured by stream: ${streamedEvents.length}`)

  // Clean up stream
  metricsReport.removeStream(streamId)

  // Show overall system metrics
  console.log('\nOverall system metrics:')
  const systemStats = metricsReport.getSystemStats()
  console.log(`  Total calls: ${systemStats.totalCalls}`)
  console.log(`  Total executions: ${systemStats.totalExecutions}`)
  console.log(`  Total errors: ${systemStats.totalErrors}`)
  console.log(`  Call rate: ${systemStats.callRate}/sec`)
  console.log(
    `  Uptime: ${Math.floor((Date.now() - systemStats.startTime) / 1000)}s`
  )

  await wait(300)
}

/**
 * EXTENDED TEST 7: IntraLink Chain Reaction Test
 * Tests Cyre's chain reaction capabilities and metrics
 */
async function testIntraLinkChains() {
  logSection('EXTENDED TEST 7: IntraLink Chain Reaction Test')

  console.log('Testing IntraLink chain reactions and metrics tracking...')

  // Create a chain of actions
  cyre.action({id: 'chain-start', payload: {step: 0}})
  cyre.action({id: 'chain-middle', payload: {step: 1}})
  cyre.action({id: 'chain-end', payload: {step: 2}})

  // Set up chain handlers
  cyre.on('chain-start', payload => {
    console.log('  Chain step 1: Processing start')
    return {
      id: 'chain-middle',
      payload: {step: 1, data: payload.data, chainId: 'test-chain'}
    }
  })

  cyre.on('chain-middle', payload => {
    console.log('  Chain step 2: Processing middle')
    return {
      id: 'chain-end',
      payload: {step: 2, data: payload.data, chainId: payload.chainId}
    }
  })

  cyre.on('chain-end', payload => {
    console.log('  Chain step 3: Processing end')
    return {completed: true, chainId: payload.chainId, finalData: payload.data}
  })

  // Test single chain execution
  console.log('\nExecuting single chain reaction...')
  const chainResult = await cyre.call('chain-start', {data: 'test-data'})

  console.log('Chain execution result:', {
    ok: chainResult.ok,
    hasMetadata: !!chainResult.metadata,
    hasChainResult: !!chainResult.metadata?.chainResult
  })

  // Wait for chain to complete
  await wait(100)

  // Test multiple concurrent chains
  console.log('\nExecuting multiple concurrent chain reactions...')
  const chainPromises = []

  for (let i = 0; i < 5; i++) {
    chainPromises.push(cyre.call('chain-start', {data: `chain-${i}`, id: i}))
  }

  await Promise.all(chainPromises)
  await wait(200)

  // Analyze chain metrics
  console.log('\nChain reaction metrics:')

  const chainActions = ['chain-start', 'chain-middle', 'chain-end']
  for (const actionId of chainActions) {
    const metrics = getActionMetrics(actionId)
    const intralinks = metrics.events.filter(e => e.eventType === 'intralink')

    console.log(`  ${actionId}:`)
    console.log(`    Total calls: ${metrics.totalCalls}`)
    console.log(`    Total executions: ${metrics.totalExecutions}`)
    console.log(`    IntraLinks generated: ${intralinks.length}`)

    // Show intralink details
    intralinks.forEach((link, index) => {
      console.log(
        `    IntraLink ${index + 1}: ${actionId} -> ${
          link.metadata?.toActionId || 'unknown'
        }`
      )
    })
  }

  await wait(300)
}

/**
 * Run all extended tests in sequence
 */
async function runExtendedTests() {
  logSection('CYRE EXTENDED TEST SUITE INITIALIZATION')

  // Initialize cyre if not already initialized
  if (!cyre.status) {
    cyre.initialize()
  }

  // Reset metrics for clean test
  metricsReport.reset()

  console.log(
    'Testing Cyre with targeted extreme conditions and sensor validation\n'
  )
  console.log(
    'All metrics are collected via sensor architecture for comprehensive analysis\n'
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

    await testMemoryAndPerformance()
    await wait(1000)

    await testMetricsAndSensors()
    await wait(1000)

    await testIntraLinkChains()
    await wait(1000)

    // Generate comprehensive report
    logSection('COMPREHENSIVE METRICS REPORT')
    console.log(metricsReport.getBasicReport())

    // Export detailed metrics for analysis
    logSection('DETAILED METRICS ANALYSIS')

    const allEvents = metricsReport.exportEvents()
    const systemStats = metricsReport.getSystemStats()

    console.log('\nEvent type distribution:')
    const eventTypeCounts = allEvents.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    Object.entries(eventTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count} events`)
      })

    console.log('\nLocation-based analysis:')
    const locationCounts = allEvents
      .filter(e => e.location)
      .reduce((acc, event) => {
        acc[event.location!] = (acc[event.location!] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    Object.entries(locationCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([location, count]) => {
        console.log(`  ${location}: ${count} events`)
      })

    // Performance insights
    logSection('PERFORMANCE INSIGHTS')

    const executionEvents = allEvents.filter(
      e => e.eventType === 'execution' && e.metadata?.duration
    )
    if (executionEvents.length > 0) {
      const durations = executionEvents.map(e => e.metadata!.duration as number)
      const avgDuration =
        durations.reduce((sum, d) => sum + d, 0) / durations.length
      const minDuration = Math.min(...durations)
      const maxDuration = Math.max(...durations)

      console.log(`Average execution time: ${avgDuration.toFixed(2)}ms`)
      console.log(`Min execution time: ${minDuration.toFixed(2)}ms`)
      console.log(`Max execution time: ${maxDuration.toFixed(2)}ms`)

      // Performance distribution
      const fastExecutions = durations.filter(d => d < 1).length
      const mediumExecutions = durations.filter(d => d >= 1 && d < 10).length
      const slowExecutions = durations.filter(d => d >= 10).length

      console.log('\nExecution time distribution:')
      console.log(
        `  Fast (<1ms): ${fastExecutions} (${(
          (fastExecutions / durations.length) *
          100
        ).toFixed(1)}%)`
      )
      console.log(
        `  Medium (1-10ms): ${mediumExecutions} (${(
          (mediumExecutions / durations.length) *
          100
        ).toFixed(1)}%)`
      )
      console.log(
        `  Slow (>10ms): ${slowExecutions} (${(
          (slowExecutions / durations.length) *
          100
        ).toFixed(1)}%)`
      )
    }

    // Protection effectiveness analysis
    logSection('PROTECTION EFFECTIVENESS ANALYSIS')

    const throttleEvents = allEvents.filter(e => e.eventType === 'throttle')
    const debounceEvents = allEvents.filter(e => e.eventType === 'debounce')
    const skipEvents = allEvents.filter(e => e.eventType === 'skip')
    const errorEvents = allEvents.filter(e => e.eventType === 'error')

    console.log(`Throttle activations: ${throttleEvents.length}`)
    console.log(`Debounce activations: ${debounceEvents.length}`)
    console.log(`Change detection skips: ${skipEvents.length}`)
    console.log(`Error occurrences: ${errorEvents.length}`)

    const totalProtectionActivations =
      throttleEvents.length + debounceEvents.length + skipEvents.length
    const protectionEfficiency =
      totalProtectionActivations > 0
        ? (totalProtectionActivations / systemStats.totalCalls) * 100
        : 0

    console.log(
      `Overall protection efficiency: ${protectionEfficiency.toFixed(
        2
      )}% of calls protected`
    )

    // Breathing system analysis
    logSection('BREATHING SYSTEM ANALYSIS')

    const finalBreathingState = cyre.getBreathingState()
    console.log(
      `Final stress level: ${(finalBreathingState.stress * 100).toFixed(2)}%`
    )
    console.log(`Final breathing rate: ${finalBreathingState.currentRate}ms`)
    console.log(`System in recuperation: ${finalBreathingState.isRecuperating}`)
    console.log(`Breath count: ${finalBreathingState.breathCount}`)
    console.log(`Breathing pattern: ${finalBreathingState.pattern}`)

    // Test completion summary
    logSection('TEST COMPLETION SUMMARY')

    console.log(
      `Total test duration: ${Math.floor(
        (Date.now() - systemStats.startTime) / 1000
      )}s`
    )
    console.log(`Total events recorded: ${allEvents.length}`)
    console.log(`Total actions called: ${systemStats.totalCalls}`)
    console.log(`Total executions: ${systemStats.totalExecutions}`)
    console.log(`Total errors: ${systemStats.totalErrors}`)
    console.log(
      `System stability: ${
        systemStats.totalErrors === 0 ? 'STABLE' : 'ERRORS DETECTED'
      }`
    )

    // Export raw data for external analysis
    console.log(
      '\nRaw metrics data exported and available via metricsReport.exportEvents()'
    )
    console.log(
      'Use metricsReport.exportEvents({actionIds: ["action-id"]}) for specific action analysis'
    )
    console.log(
      'Use metricsReport.createStream() for real-time monitoring during development'
    )
  } catch (error) {
    console.error('Error running extended tests:', error)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
  }
}

// Export the test runner and helper functions
export {
  runExtendedTests,
  getActionMetrics,
  getSystemMetrics,
  measureTime,
  wait,
  logSection
}

// Auto-run if this file is executed directly

runExtendedTests()
