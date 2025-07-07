// demo/scheduled-conflict-test.ts
// Test scheduled task conflicts - where actual conflicts occur in Cyre

import {cyre} from '../src'

/*
    
    C.Y.R.E - S.C.H.E.D.U.L.E.D - C.O.N.F.L.I.C.T - T.E.S.T
    
    Testing actual conflict scenarios:
    1. Tasks with interval (overlapping executions)
    2. Tasks with delay (delayed start conflicts)  
    3. Tasks with repeat (multiple executions)
    4. Edge case: {repeat: 10, interval: undefined}
    5. Manual async/await queueing patterns
    6. Full cyre response logging

*/

// Minimal logging
const timestamp = () => new Date().toISOString().slice(11, 23)
const log = (msg: string) => console.log(`[${timestamp()}] ${msg}`)

// Track test results with full responses
interface ScheduledTestResult {
  testName: string
  callType: 'scheduled' | 'manual'
  response: any
  timestamp: string
  duration?: number
  error?: string
}

const scheduledResults: ScheduledTestResult[] = []

const logResponse = (
  testName: string,
  callType: 'scheduled' | 'manual',
  response: any,
  error?: string
) => {
  const result: ScheduledTestResult = {
    testName,
    callType,
    response,
    timestamp: timestamp(),
    error
  }

  scheduledResults.push(result)

  // Only log key info, not full response details
  log(
    `${testName} [${callType}] → Success: ${response?.ok}, Payload: ${response?.payload}`
  )
  if (error) {
    log(`  ❌ Error: ${error}`)
  }
}

// ============================================
// TEST 1: INTERVAL CONFLICTS (Overlapping Executions)
// ============================================

const testIntervalConflicts = async () => {
  log('🔄 TEST 1: Interval Conflicts (Timeline Overlap)')
  log('='.repeat(60))

  cyre.clear()

  // Setup interval that takes longer than interval duration
  log('Setting up interval: 800ms interval, 400ms processing time')

  const intervalResponse = cyre.action({
    id: 'interval-conflict-test',
    interval: 800, // Every 800ms
    payload: {source: 'interval', processingTime: 400} // Takes 400ms (shorter than interval)
  })

  logResponse('interval-setup', 'scheduled', intervalResponse)

  // Setup handler with minimal logging
  let executionCount = 0
  cyre.on('interval-conflict-test', async data => {
    executionCount++
    if (executionCount <= 3) {
      // Only log first 3 executions
      log(`EXEC-${executionCount} ${data.source} start`)
    }

    await new Promise(resolve => setTimeout(resolve, data.processingTime))

    if (executionCount <= 3) {
      log(`EXEC-${executionCount} ${data.source} complete`)
    }
    return `completed-${executionCount}`
  })

  log('⚡ Starting interval task...')

  // Let it run for 2 cycles only
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Try manual call during interval execution
  log('🔥 Manual call during interval...')
  try {
    const manualResponse = await cyre.call('interval-conflict-test', {
      source: 'manual',
      processingTime: 100
    })
    logResponse('interval-manual-call', 'manual', manualResponse)
  } catch (error) {
    logResponse('interval-manual-call', 'manual', null, String(error))
  }

  // Stop interval
  cyre.forget('interval-conflict-test')
  log(`✅ Interval test completed (${executionCount} total executions)\n`)
}

// ============================================
// TEST 2: DELAY CONFLICTS (Delayed Start)
// ============================================

const testDelayConflicts = async () => {
  log('⏱️  TEST 2: Delay Conflicts (Delayed Start)')
  log('='.repeat(60))

  cyre.clear()

  // Setup delayed task
  log('Setting up delay: 500ms delay, 200ms processing')

  const delayResponse = cyre.action({
    id: 'delay-conflict-test',
    delay: 980, // Start after 500ms
    payload: {source: 'delayed', processingTime: 200}
  })

  logResponse('delay-setup', 'scheduled', delayResponse)

  cyre.on('delay-conflict-test', async data => {
    log(`Delayed Handler: ${data.source} (${data.processingTime}ms)`)
    await new Promise(resolve => setTimeout(resolve, data.processingTime))
    log(`Delayed Handler complete`)
    return `delayed-completed-${data.source}`
  })

  // Try immediate manual call (before delay triggers)
  log('🔥 Manual call BEFORE delay triggers...')
  try {
    const manualResponse1 = await cyre.call('delay-conflict-test', {
      source: 'manual-before',
      processingTime: 100
    })
    logResponse('delay-manual-before', 'manual', manualResponse1)
  } catch (error) {
    logResponse('delay-manual-before', 'manual', null, String(error))
  }

  // Wait for delay to trigger and complete
  await new Promise(resolve => setTimeout(resolve, 1000))

  cyre.forget('delay-conflict-test')
  log('✅ Delay test completed\n')
}

// ============================================
// TEST 3: REPEAT CONFLICTS (Multiple Executions)
// ============================================

const testRepeatConflicts = async () => {
  log('🔁 TEST 3: Repeat Conflicts (Multiple Executions)')
  log('='.repeat(60))

  cyre.clear()

  // Setup repeat task
  log('Setting up repeat: 3 times, 200ms processing each')

  const repeatResponse = cyre.action({
    id: 'repeat-conflict-test',
    repeat: 3, // Execute 3 times
    payload: {source: 'repeat', processingTime: 200}
  })

  logResponse('repeat-setup', 'scheduled', repeatResponse)

  let repeatCount = 0
  cyre.on('repeat-conflict-test', async data => {
    repeatCount++
    log(`REPEAT-${repeatCount} ${data.source} (${data.processingTime}ms)`)

    await new Promise(resolve => setTimeout(resolve, data.processingTime))

    log(`REPEAT-${repeatCount} complete`)
    return `repeat-completed-${repeatCount}`
  })

  // Try manual call during repeat execution
  setTimeout(async () => {
    log('🔥 Manual call during repeat...')
    try {
      const manualResponse = await cyre.call('repeat-conflict-test', {
        source: 'manual',
        processingTime: 100
      })
      logResponse('repeat-manual', 'manual', manualResponse)
    } catch (error) {
      logResponse('repeat-manual', 'manual', null, String(error))
    }
  }, 300)

  // Wait for all repeats to complete
  await new Promise(resolve => setTimeout(resolve, 1500))

  cyre.forget('repeat-conflict-test')
  log(`✅ Repeat test completed (${repeatCount} executions)\n`)
}

// ============================================
// TEST 4: EDGE CASE - {repeat: 10, interval: undefined}
// ============================================

const testRepeatWithoutInterval = async () => {
  log('🎲 TEST 4: Edge Case - Repeat without Interval')
  log('='.repeat(60))

  cyre.clear()

  // Setup edge case: repeat without interval
  log('Setting up: repeat: 5, interval: undefined, 100ms processing')

  const edgeResponse = cyre.action({
    id: 'repeat-no-interval-test',
    repeat: 5, // 5 times only
    interval: undefined, // No interval specified
    payload: {source: 'repeat-no-interval', processingTime: 100}
  })

  logResponse('repeat-no-interval-setup', 'scheduled', edgeResponse)

  let edgeCount = 0
  cyre.on('repeat-no-interval-test', async data => {
    edgeCount++
    if (edgeCount <= 5) {
      // Only log first 5
      log(`EDGE-${edgeCount} ${data.source}`)
    }

    await new Promise(resolve => setTimeout(resolve, data.processingTime))

    if (edgeCount <= 5) {
      log(`EDGE-${edgeCount} complete`)
    }
    return `edge-completed-${edgeCount}`
  })

  // Try manual call during edge case execution
  setTimeout(async () => {
    log('🔥 Manual call during repeat-no-interval...')
    try {
      const manualResponse = await cyre.call('repeat-no-interval-test', {
        source: 'manual-edge',
        processingTime: 50
      })
      logResponse('repeat-no-interval-manual', 'manual', manualResponse)
    } catch (error) {
      logResponse('repeat-no-interval-manual', 'manual', null, String(error))
    }
  }, 250)

  // Wait for executions with timeout
  await new Promise(resolve => setTimeout(resolve, 2000))

  cyre.forget('repeat-no-interval-test')
  log(`✅ Edge case test completed (${edgeCount} executions)\n`)
}

// ============================================
// TEST 5: MANUAL ASYNC/AWAIT QUEUEING PATTERNS
// ============================================

const testManualQueueing = async () => {
  log('🧵 TEST 5: Manual Async/Await Queueing Patterns')
  log('='.repeat(60))

  cyre.clear()

  // Setup simple action for manual queueing
  cyre.action({
    id: 'manual-queue-test'
  })

  // Handler with minimal logging
  cyre.on('manual-queue-test', async data => {
    await new Promise(resolve => setTimeout(resolve, data.processingTime))
    return `manual-queued-${data.id}`
  })

  log('🧵 Testing manual queueing patterns...')

  // Pattern 1: Sequential execution using await
  log('Pattern 1: Sequential await')
  const startSeq = Date.now()
  try {
    await cyre.call('manual-queue-test', {id: 'SEQ1', processingTime: 100})
    await cyre.call('manual-queue-test', {id: 'SEQ2', processingTime: 100})
    await cyre.call('manual-queue-test', {id: 'SEQ3', processingTime: 100})
    log(`Sequential completed in ${Date.now() - startSeq}ms`)
  } catch (error) {
    log(`Sequential error: ${error}`)
  }

  // Pattern 2: Parallel execution using Promise.all
  log('Pattern 2: Parallel Promise.all')
  const startPar = Date.now()
  try {
    const parallelPromises = [
      cyre.call('manual-queue-test', {id: 'PAR1', processingTime: 100}),
      cyre.call('manual-queue-test', {id: 'PAR2', processingTime: 100}),
      cyre.call('manual-queue-test', {id: 'PAR3', processingTime: 100})
    ]

    await Promise.all(parallelPromises)
    log(`Parallel completed in ${Date.now() - startPar}ms`)
  } catch (error) {
    log(`Parallel error: ${error}`)
  }

  cyre.forget('manual-queue-test')
  log('✅ Manual queueing test completed\n')
}

// ============================================
// RUN ALL SCHEDULED CONFLICT TESTS
// ============================================

const runScheduledConflictTests = async () => {
  log('⏲️  CYRE SCHEDULED CONFLICT TEST SUITE')
  log('='.repeat(60))
  log(
    'Testing actual conflict scenarios where they occur - in scheduled tasks\n'
  )

  try {
    await testIntervalConflicts()
    await new Promise(resolve => setTimeout(resolve, 500))

    await testDelayConflicts()
    await new Promise(resolve => setTimeout(resolve, 500))

    await testRepeatConflicts()
    await new Promise(resolve => setTimeout(resolve, 500))

    await testRepeatWithoutInterval()
    await new Promise(resolve => setTimeout(resolve, 500))

    await testManualQueueing()

    log('🎉 ALL SCHEDULED CONFLICT TESTS COMPLETED!')
    log('='.repeat(60))

    // Key insights summary instead of full details
    log('\n🎯 KEY INSIGHTS:')

    const scheduled = scheduledResults.filter(r => r.callType === 'scheduled')
    const manual = scheduledResults.filter(r => r.callType === 'manual')
    const errors = scheduledResults.filter(r => r.error)

    log(
      `   📊 Total responses: ${scheduledResults.length} (${scheduled.length} scheduled, ${manual.length} manual)`
    )
    log(`   ❌ Errors: ${errors.length}`)

    // Check for specific conflict patterns
    const successfulScheduled = scheduled.filter(r => r.response?.ok)
    const successfulManual = manual.filter(r => r.response?.ok)

    log(
      `   ✅ Successful scheduled: ${successfulScheduled.length}/${scheduled.length}`
    )
    log(`   ✅ Successful manual: ${successfulManual.length}/${manual.length}`)

    // Timeline behavior insights
    if (successfulScheduled.length > 0) {
      log(`   🔄 Timeline system: Working (schedules executed)`)
    }

    if (successfulManual.length > 0 && successfulScheduled.length > 0) {
      log(`   🤝 Manual + Scheduled: Both can coexist`)
    }

    log('\n💡 CONFLICT BEHAVIOR:')
    log(`   - Regular calls: Unlimited parallel (as expected)`)
    log(
      `   - Scheduled tasks: ${
        successfulScheduled.length > 0
          ? 'Execute normally'
          : 'May have conflicts'
      }`
    )
    log(
      `   - Manual during scheduled: ${
        successfulManual.length > 0 ? 'Allowed' : 'Blocked'
      }`
    )

    if (errors.length > 0) {
      log('\n🚨 ERRORS FOUND:')
      errors.forEach(error => {
        log(`   - ${error.testName}: ${error.error}`)
      })
    }
  } catch (error) {
    log(`💥 Test suite error: ${error}`)
  }
}

// Export for manual testing
export {
  runScheduledConflictTests,
  testIntervalConflicts,
  testDelayConflicts,
  testRepeatConflicts,
  testRepeatWithoutInterval,
  testManualQueueing
}

// Run immediately if this file is executed directly

runScheduledConflictTests()
