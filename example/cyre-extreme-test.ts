// example/cyre-extreme-test.ts

import {cyre} from '../src'
import {metricsReport} from '../src/components/sensor'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Extreme Test Cases
*/

// Helper to delay execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Log section header
const logSection = (title: string) => {
  console.log('\n' + '='.repeat(80))
  console.log(`  ${title}`)
  console.log('='.repeat(80))
}

/**
 * EXTREME TEST 1: High-Frequency Action Flood
 * Tests Cyre's ability to handle rapid action calls and breathing system
 */
async function testHighFrequencyActionFlood() {
  logSection('EXTREME TEST 1: High-Frequency Action Flood')

  // Create action with different protection levels
  cyre.action({
    id: 'high-frequency-unprotected',
    payload: {value: 0}
  })

  cyre.action({
    id: 'high-frequency-throttled',
    throttle: 10, // Very aggressive throttling
    payload: {value: 0}
  })

  cyre.action({
    id: 'high-frequency-debounced',
    debounce: 50, // Short debounce
    payload: {value: 0}
  })

  // Simple handlers
  cyre.on('high-frequency-unprotected', payload => {
    // Empty handler for maximum throughput
    return null
  })

  cyre.on('high-frequency-throttled', payload => {
    // Empty handler for maximum throughput
    return null
  })

  cyre.on('high-frequency-debounced', payload => {
    // Empty handler for maximum throughput
    return null
  })

  console.log('Flooding Cyre with 1000 rapid unprotected actions...')
  const startUnprotected = Date.now()

  // Send 1000 calls in rapid succession
  const callPromises = []
  for (let i = 0; i < 1000; i++) {
    callPromises.push(cyre.call('high-frequency-unprotected', {value: i}))
  }

  await Promise.all(callPromises)
  const unprotectedTime = Date.now() - startUnprotected
  console.log(`Unprotected flood completed in ${unprotectedTime}ms`)

  console.log('Flooding Cyre with 1000 rapid throttled actions...')
  const startThrottled = Date.now()

  // Send 1000 calls in rapid succession to throttled action
  const throttlePromises = []
  for (let i = 0; i < 1000; i++) {
    throttlePromises.push(cyre.call('high-frequency-throttled', {value: i}))
  }

  await Promise.all(throttlePromises)
  const throttledTime = Date.now() - startThrottled
  console.log(`Throttled flood completed in ${throttledTime}ms`)

  console.log('Flooding Cyre with 1000 rapid debounced actions...')
  const startDebounced = Date.now()

  // Send 1000 calls in rapid succession to debounced action
  const debouncePromises = []
  for (let i = 0; i < 1000; i++) {
    debouncePromises.push(cyre.call('high-frequency-debounced', {value: i}))
  }

  await Promise.all(debouncePromises)
  const debouncedTime = Date.now() - startDebounced
  console.log(`Debounced flood completed in ${debouncedTime}ms`)

  // Wait for breathing system to stabilize
  console.log('Waiting for breathing system recovery...')
  await wait(300)

  // Check breathing state
  const breathingState = cyre.getBreathingState()
  console.log('Breathing system state after flood:')
  console.log(`  Stress level: ${(breathingState.stress * 100).toFixed(2)}%`)
  console.log(`  Current breathing rate: ${breathingState.currentRate}ms`)
  console.log(`  In recuperation: ${breathingState.isRecuperating}`)

  // Check metrics for each action
  const unprotectedMetrics = metricsReport.getActionMetrics(
    'high-frequency-unprotected'
  )
  const throttledMetrics = metricsReport.getActionMetrics(
    'high-frequency-throttled'
  )
  const debouncedMetrics = metricsReport.getActionMetrics(
    'high-frequency-debounced'
  )

  console.log('\nFlood execution results:')
  console.log(
    `  Unprotected: ${unprotectedMetrics?.calls || 0} calls, ${
      unprotectedMetrics?.executionTimes.length || 0
    } executions`
  )
  console.log(
    `  Throttled: ${throttledMetrics?.calls || 0} calls, ${
      throttledMetrics?.executionTimes.length || 0
    } executions, ${throttledMetrics?.throttles || 0} throttles`
  )
  console.log(
    `  Debounced: ${debouncedMetrics?.calls || 0} calls, ${
      debouncedMetrics?.executionTimes.length || 0
    } executions, ${debouncedMetrics?.debounces || 0} debounces`
  )
}

/**
 * EXTREME TEST 2: Long-Running Actions
 * Tests how Cyre handles actions with very long execution times
 */
async function testLongRunningActions() {
  logSection('EXTREME TEST 2: Long-Running Actions')

  // Create action that runs for a long time
  cyre.action({
    id: 'long-running-normal',
    payload: {duration: 1000}
  })

  cyre.action({
    id: 'long-running-critical',
    priority: {level: 'critical'},
    payload: {duration: 1000}
  })

  // Handler that takes a long time to execute
  cyre.on('long-running-normal', async payload => {
    console.log(`Starting long-running action: ${payload.duration}ms`)
    const start = Date.now()
    // Simulate CPU-intensive work
    let counter = 0
    while (Date.now() - start < payload.duration) {
      counter++
      if (counter % 10000000 === 0) {
        // Yield to event loop occasionally
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
    console.log(`Completed long-running action after ${Date.now() - start}ms`)
    return null
  })

  // Same handler but for critical priority
  cyre.on('long-running-critical', async payload => {
    console.log(`Starting critical long-running action: ${payload.duration}ms`)
    const start = Date.now()
    // Simulate CPU-intensive work
    let counter = 0
    while (Date.now() - start < payload.duration) {
      counter++
      if (counter % 10000000 === 0) {
        // Yield to event loop occasionally
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
    console.log(
      `Completed critical long-running action after ${Date.now() - start}ms`
    )
    return null
  })

  // Run a normal long action and see what happens
  console.log('Starting normal long-running action...')
  const normalStart = Date.now()
  await cyre.call('long-running-normal', {duration: 1000})
  console.log(
    `Normal long-running action call completed after ${
      Date.now() - normalStart
    }ms`
  )

  // Check breathing system state
  console.log('\nChecking breathing system state...')
  const breathingAfterNormal = cyre.getBreathingState()
  console.log(
    `  Stress level: ${(breathingAfterNormal.stress * 100).toFixed(2)}%`
  )
  console.log(`  Current breathing rate: ${breathingAfterNormal.currentRate}ms`)
  console.log(`  In recuperation: ${breathingAfterNormal.isRecuperating}`)

  // Wait for system to recover
  console.log('\nWaiting for system to recover...')
  await wait(500)

  // Run a critical long action during high stress
  console.log('\nStarting critical long-running action...')
  const criticalStart = Date.now()
  await cyre.call('long-running-critical', {duration: 1000})
  console.log(
    `Critical long-running action call completed after ${
      Date.now() - criticalStart
    }ms`
  )

  // Wait for recovery
  console.log('\nWaiting for system to recover...')
  await wait(500)

  // Show execution metrics
  const normalMetrics = metricsReport.getActionMetrics('long-running-normal')
  const criticalMetrics = metricsReport.getActionMetrics(
    'long-running-critical'
  )

  console.log('\nLong-running action metrics:')
  console.log(
    `  Normal action - avg execution: ${normalMetrics?.avgExecutionTime.toFixed(
      2
    )}ms`
  )
  console.log(
    `  Critical action - avg execution: ${criticalMetrics?.avgExecutionTime.toFixed(
      2
    )}ms`
  )
}

/**
 * EXTREME TEST 3: Deep Action Chaining
 * Tests how Cyre handles deeply nested action chains
 */
async function testDeepActionChaining() {
  logSection('EXTREME TEST 3: Deep Action Chaining')

  // Set up a chain of 20 actions
  const CHAIN_DEPTH = 20

  // Create the chain of actions
  for (let i = 1; i <= CHAIN_DEPTH; i++) {
    cyre.action({
      id: `chain-${i}`,
      payload: {depth: i}
    })

    cyre.on(`chain-${i}`, payload => {
      console.log(`Chain depth ${i} - processing`)

      // If we're not at the end of the chain, return link to next
      if (i < CHAIN_DEPTH) {
        return {
          id: `chain-${i + 1}`,
          payload: {depth: i + 1, previousData: payload}
        }
      }

      console.log(`Chain complete at depth ${i}`)
      return null
    })
  }

  console.log(`Starting action chain with depth ${CHAIN_DEPTH}...`)
  const chainStart = Date.now()
  await cyre.call('chain-1', {depth: 1, start: true})
  console.log(`Action chain completed in ${Date.now() - chainStart}ms`)

  // Show chain metrics
  console.log('\nAction chain metrics:')
  for (let i = 1; i <= CHAIN_DEPTH; i++) {
    const metrics = metricsReport.getActionMetrics(`chain-${i}`)
    console.log(
      `  chain-${i}: ${
        metrics?.calls || 0
      } calls, execution time: ${metrics?.avgExecutionTime.toFixed(2)}ms`
    )
  }
}

/**
 * EXTREME TEST 4: Concurrent Heavy Actions
 * Tests how Cyre handles multiple heavy actions executing simultaneously
 */
async function testConcurrentHeavyActions() {
  logSection('EXTREME TEST 4: Concurrent Heavy Actions')

  // Create different priority actions
  const priorities: Array<{
    level: 'critical' | 'high' | 'medium' | 'low' | 'background'
    delay: number
  }> = [
    {level: 'critical', delay: 1000},
    {level: 'high', delay: 1000},
    {level: 'medium', delay: 1000},
    {level: 'low', delay: 1000},
    {level: 'background', delay: 1000}
  ]

  // Create actions for each priority
  priorities.forEach(p => {
    cyre.action({
      id: `concurrent-${p.level}`,
      priority: {level: p.level},
      payload: {delay: p.delay}
    })

    cyre.on(`concurrent-${p.level}`, async payload => {
      const start = Date.now()
      console.log(`Starting ${p.level} priority action (${payload.delay}ms)`)

      // Simulate work
      await wait(payload.delay)

      console.log(
        `Completed ${p.level} priority action after ${Date.now() - start}ms`
      )
      return null
    })
  })

  // Run all actions concurrently
  console.log('Starting all priority actions concurrently...')
  const concurrentStart = Date.now()

  const concurrentPromises = priorities.map(p =>
    cyre.call(`concurrent-${p.level}`, {delay: p.delay})
  )

  await Promise.all(concurrentPromises)

  console.log(
    `All priority actions completed in ${Date.now() - concurrentStart}ms`
  )

  // Show priority handling metrics
  console.log('\nPriority handling metrics:')
  priorities.forEach(p => {
    const metrics = metricsReport.getActionMetrics(`concurrent-${p.level}`)
    console.log(
      `  ${p.level}: ${
        metrics?.calls || 0
      } calls, execution time: ${metrics?.avgExecutionTime.toFixed(2)}ms`
    )
  })

  // Check breathing system impact
  const breathingState = cyre.getBreathingState()
  console.log('\nBreathing system state after concurrent actions:')
  console.log(`  Stress level: ${(breathingState.stress * 100).toFixed(2)}%`)
  console.log(`  Current breathing rate: ${breathingState.currentRate}ms`)
  console.log(`  In recuperation: ${breathingState.isRecuperating}`)
}

/**
 * EXTREME TEST 5: Error Handling Stress Test
 * Tests how Cyre handles actions that consistently throw errors
 */
async function testErrorHandlingStress() {
  logSection('EXTREME TEST 5: Error Handling Stress Test')

  // Create actions with different error behaviors
  cyre.action({
    id: 'error-always',
    payload: {shouldFail: true}
  })

  cyre.action({
    id: 'error-sometimes',
    payload: {failRate: 0.5}
  })

  cyre.action({
    id: 'error-chain-first',
    payload: {step: 1}
  })

  cyre.action({
    id: 'error-chain-second',
    payload: {step: 2}
  })

  cyre.action({
    id: 'error-chain-third',
    payload: {step: 3}
  })

  // Handler that always throws
  cyre.on('error-always', payload => {
    throw new Error('This action always fails')
  })

  // Handler that sometimes throws
  cyre.on('error-sometimes', payload => {
    if (Math.random() < payload.failRate) {
      throw new Error('This action randomly failed')
    }
    return null
  })

  // Chain of actions where middle one fails
  cyre.on('error-chain-first', payload => {
    console.log('Error chain step 1 - success')
    return {
      id: 'error-chain-second',
      payload: {step: 2}
    }
  })

  cyre.on('error-chain-second', payload => {
    console.log('Error chain step 2 - failing')
    throw new Error('Chain broken at step 2')
  })

  cyre.on('error-chain-third', payload => {
    console.log('Error chain step 3 - success (should not execute)')
    return null
  })

  // Test always-failing action
  console.log('Testing always-failing action (100 calls)...')
  const alwaysFailPromises = []
  for (let i = 0; i < 100; i++) {
    alwaysFailPromises.push(cyre.call('error-always', {shouldFail: true}))
  }
  await Promise.all(alwaysFailPromises)

  // Test sometimes-failing action
  console.log(
    '\nTesting sometimes-failing action (100 calls with 50% fail rate)...'
  )
  const sometimesFailPromises = []
  for (let i = 0; i < 100; i++) {
    sometimesFailPromises.push(cyre.call('error-sometimes', {failRate: 0.5}))
  }
  await Promise.all(sometimesFailPromises)

  // Test error in action chain
  console.log('\nTesting error in action chain...')
  await cyre.call('error-chain-first', {step: 1})

  // Check error metrics
  const alwaysMetrics = metricsReport.getActionMetrics('error-always')
  const sometimesMetrics = metricsReport.getActionMetrics('error-sometimes')
  const chainFirstMetrics = metricsReport.getActionMetrics('error-chain-first')
  const chainSecondMetrics =
    metricsReport.getActionMetrics('error-chain-second')
  const chainThirdMetrics = metricsReport.getActionMetrics('error-chain-third')

  console.log('\nError handling metrics:')
  console.log(
    `  Always failing: ${alwaysMetrics?.calls || 0} calls, ${
      alwaysMetrics?.errorCount || 0
    } errors`
  )
  console.log(
    `  Sometimes failing: ${sometimesMetrics?.calls || 0} calls, ${
      sometimesMetrics?.errorCount || 0
    } errors`
  )
  console.log(
    `  Chain first: ${chainFirstMetrics?.calls || 0} calls, ${
      chainFirstMetrics?.errorCount || 0
    } errors`
  )
  console.log(
    `  Chain second: ${chainSecondMetrics?.calls || 0} calls, ${
      chainSecondMetrics?.errorCount || 0
    } errors`
  )
  console.log(
    `  Chain third: ${chainThirdMetrics?.calls || 0} calls, ${
      chainThirdMetrics?.errorCount || 0
    } errors (shouldn't be called)`
  )
}

/**
 * EXTREME TEST 6: System Recovery Test
 * Tests Cyre's ability to recover after high stress
 */
async function testSystemRecovery() {
  logSection('EXTREME TEST 6: System Recovery Test')

  // Create an action that will be used in phases
  cyre.action({
    id: 'recovery-test',
    payload: {iteration: 0}
  })

  cyre.on('recovery-test', async payload => {
    console.log(`Processing recovery test iteration ${payload.iteration}`)

    // Different behavior based on iteration
    if (payload.iteration < 10) {
      // Light work
      await wait(5)
    } else if (payload.iteration < 20) {
      // Medium work
      await wait(20)
    } else {
      // Heavy work
      await wait(50)
    }

    return null
  })

  // Phase 1: Normal operation
  console.log('Phase 1: Normal operation (10 calls with light work)')
  const phase1Start = Date.now()
  for (let i = 0; i < 10; i++) {
    await cyre.call('recovery-test', {iteration: i})
  }
  console.log(`Phase 1 completed in ${Date.now() - phase1Start}ms`)

  // Capture breathing state after phase 1
  const phase1Breathing = cyre.getBreathingState()
  console.log(
    `  Breathing after phase 1: rate=${
      phase1Breathing.currentRate
    }ms, stress=${(phase1Breathing.stress * 100).toFixed(2)}%`
  )

  // Phase 2: Increased load
  console.log('\nPhase 2: Increased load (10 calls with medium work)')
  const phase2Start = Date.now()
  for (let i = 10; i < 20; i++) {
    await cyre.call('recovery-test', {iteration: i})
  }
  console.log(`Phase 2 completed in ${Date.now() - phase2Start}ms`)

  // Capture breathing state after phase 2
  const phase2Breathing = cyre.getBreathingState()
  console.log(
    `  Breathing after phase 2: rate=${
      phase2Breathing.currentRate
    }ms, stress=${(phase2Breathing.stress * 100).toFixed(2)}%`
  )

  // Phase 3: High stress
  console.log('\nPhase 3: High stress (10 calls with heavy work)')
  const phase3Start = Date.now()
  for (let i = 20; i < 30; i++) {
    await cyre.call('recovery-test', {iteration: i})
  }
  console.log(`Phase 3 completed in ${Date.now() - phase3Start}ms`)

  // Capture breathing state after phase 3
  const phase3Breathing = cyre.getBreathingState()
  console.log(
    `  Breathing after phase 3: rate=${
      phase3Breathing.currentRate
    }ms, stress=${(phase3Breathing.stress * 100).toFixed(2)}%`
  )

  // Phase 4: Recovery period
  console.log('\nPhase 4: Recovery period (monitoring breathing system)')
  console.log('  Waiting for breathing system to stabilize...')

  // Monitor recovery over time
  for (let i = 0; i < 5; i++) {
    await wait(100)
    const recoveryBreathing = cyre.getBreathingState()
    console.log(
      `  Recovery at ${i * 100}ms: rate=${
        recoveryBreathing.currentRate
      }ms, stress=${(recoveryBreathing.stress * 100).toFixed(2)}%`
    )
  }

  // Phase 5: After recovery
  console.log('\nPhase 5: After recovery (10 calls with light work)')
  const phase5Start = Date.now()
  for (let i = 30; i < 40; i++) {
    await cyre.call('recovery-test', {iteration: i})
  }
  console.log(`Phase 5 completed in ${Date.now() - phase5Start}ms`)

  // Capture final breathing state
  const finalBreathing = cyre.getBreathingState()
  console.log(
    `  Final breathing state: rate=${finalBreathing.currentRate}ms, stress=${(
      finalBreathing.stress * 100
    ).toFixed(2)}%`
  )

  // Compare performance across phases
  const metrics = metricsReport.getActionMetrics('recovery-test')
  console.log('\nSystem recovery performance:')
  if (metrics && metrics.executionTimes.length >= 40) {
    const phase1Avg =
      metrics.executionTimes.slice(0, 10).reduce((a, b) => a + b, 0) / 10
    const phase2Avg =
      metrics.executionTimes.slice(10, 20).reduce((a, b) => a + b, 0) / 10
    const phase3Avg =
      metrics.executionTimes.slice(20, 30).reduce((a, b) => a + b, 0) / 10
    const phase5Avg =
      metrics.executionTimes.slice(30, 40).reduce((a, b) => a + b, 0) / 10

    console.log(
      `  Phase 1 (light load): ${phase1Avg.toFixed(2)}ms avg execution`
    )
    console.log(
      `  Phase 2 (medium load): ${phase2Avg.toFixed(2)}ms avg execution`
    )
    console.log(
      `  Phase 3 (heavy load): ${phase3Avg.toFixed(2)}ms avg execution`
    )
    console.log(
      `  Phase 5 (after recovery): ${phase5Avg.toFixed(2)}ms avg execution`
    )
    console.log(
      `  Recovery efficiency: ${((phase1Avg / phase5Avg) * 100).toFixed(
        2
      )}% of original performance`
    )
  }
}

/**
 * EXTREME TEST 7: Middleware Chain Test
 * Tests Cyre's middleware system with a long chain
 */
async function testMiddlewareChain() {
  logSection('EXTREME TEST 7: Middleware Chain Test')

  // Register a series of middleware functions
  const MIDDLEWARE_COUNT = 10

  for (let i = 1; i <= MIDDLEWARE_COUNT; i++) {
    cyre.middleware(`middleware-${i}`, async (action, payload) => {
      console.log(`Middleware ${i} executing...`)

      // Add processing marker
      const enhancedPayload = {
        ...payload,
        middlewareChain: [...(payload.middlewareChain || []), i]
      }

      // 20% chance to reject at high numbers
      if (i >= 8 && Math.random() < 0.2) {
        console.log(`Middleware ${i} rejecting action`)
        return null
      }

      // Otherwise continue
      return {action, payload: enhancedPayload}
    })
  }

  // Create actions with different middleware configurations
  cyre.action({
    id: 'middleware-light',
    middleware: ['middleware-1', 'middleware-2'],
    payload: {value: 'light'}
  })

  cyre.action({
    id: 'middleware-medium',
    middleware: [
      'middleware-1',
      'middleware-2',
      'middleware-3',
      'middleware-4',
      'middleware-5'
    ],
    payload: {value: 'medium'}
  })

  cyre.action({
    id: 'middleware-heavy',
    middleware: Array.from(
      {length: MIDDLEWARE_COUNT},
      (_, i) => `middleware-${i + 1}`
    ),
    payload: {value: 'heavy'}
  })

  // Create handlers
  cyre.on('middleware-light', payload => {
    console.log(`Light middleware action received:`, payload)
    return null
  })

  cyre.on('middleware-medium', payload => {
    console.log(`Medium middleware action received:`, payload)
    return null
  })

  cyre.on('middleware-heavy', payload => {
    console.log(`Heavy middleware action received:`, payload)
    return null
  })

  // Test light middleware action
  console.log('\nTesting light middleware action (2 middleware)...')
  await cyre.call('middleware-light', {value: 'light', middlewareChain: []})

  // Test medium middleware action
  console.log('\nTesting medium middleware action (5 middleware)...')
  await cyre.call('middleware-medium', {value: 'medium', middlewareChain: []})

  // Test heavy middleware action (may be rejected)
  console.log('\nTesting heavy middleware action (10 middleware)...')

  // Try multiple times since rejection is random
  for (let i = 0; i < 5; i++) {
    console.log(`  Attempt ${i + 1}`)
    await cyre.call('middleware-heavy', {value: 'heavy', middlewareChain: []})
  }

  // Check metrics
  const lightMetrics = metricsReport.getActionMetrics('middleware-light')
  const mediumMetrics = metricsReport.getActionMetrics('middleware-medium')
  const heavyMetrics = metricsReport.getActionMetrics('middleware-heavy')

  console.log('\nMiddleware metrics:')
  console.log(
    `  Light (2): ${lightMetrics?.calls || 0} calls, ${
      lightMetrics?.executionTimes.length || 0
    } executions, ${lightMetrics?.middlewareRejections || 0} rejections`
  )
  console.log(
    `  Medium (5): ${mediumMetrics?.calls || 0} calls, ${
      mediumMetrics?.executionTimes.length || 0
    } executions, ${mediumMetrics?.middlewareRejections || 0} rejections`
  )
  console.log(
    `  Heavy (10): ${heavyMetrics?.calls || 0} calls, ${
      heavyMetrics?.executionTimes.length || 0
    } executions, ${heavyMetrics?.middlewareRejections || 0} rejections`
  )

  // Performance comparison
  console.log('\nMiddleware performance impact:')
  if (lightMetrics && mediumMetrics && heavyMetrics) {
    console.log(
      `  Light avg execution: ${lightMetrics.avgExecutionTime.toFixed(2)}ms`
    )
    console.log(
      `  Medium avg execution: ${mediumMetrics.avgExecutionTime.toFixed(2)}ms`
    )
    console.log(
      `  Heavy avg execution: ${heavyMetrics.avgExecutionTime.toFixed(2)}ms`
    )

    // Calculate overhead per middleware
    const lightOverhead = lightMetrics.avgExecutionTime / 2 // per middleware
    const mediumOverhead = mediumMetrics.avgExecutionTime / 5 // per middleware
    const heavyOverhead = heavyMetrics.avgExecutionTime / 10 // per middleware

    console.log(`  Average overhead per middleware:`)
    console.log(`    Light chain: ${lightOverhead.toFixed(2)}ms per middleware`)
    console.log(
      `    Medium chain: ${mediumOverhead.toFixed(2)}ms per middleware`
    )
    console.log(`    Heavy chain: ${heavyOverhead.toFixed(2)}ms per middleware`)
  }
}

/**
 * Run all extreme tests in sequence
 */
async function runExtremeTests() {
  // Reset any existing actions and metrics
  //cyre.clear()
  metricsReport.reset()

  logSection('CYRE EXTREME TEST SUITE')
  console.log('Testing Cyre under extreme conditions\n')

  try {
    await testHighFrequencyActionFlood()
    await wait(500) // Allow system to stabilize between tests

    await testLongRunningActions()
    await wait(500)

    await testDeepActionChaining()
    await wait(500)

    await testConcurrentHeavyActions()
    await wait(500)

    await testErrorHandlingStress()
    await wait(500)

    await testSystemRecovery()
    await wait(500)

    await testMiddlewareChain()
    await wait(500)

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
    console.error('Error running extreme tests:', error)
    if (error.stack) console.error(error.stack)
  }
}

// Export the test runner
export {runExtremeTests}

runExtremeTests()
