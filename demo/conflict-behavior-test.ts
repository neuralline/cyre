// demo/conflict-behavior-test.ts
// Test current Cyre conflict behavior to understand when conflicts actually occur

import {cyre} from '../src'

/*
    
    C.Y.R.E - C.O.N.F.L.I.C.T - B.E.H.A.V.I.O.R - T.E.S.T
    
    Testing scenarios:
    1. Concurrent calls to single channel (parallel)
    2. Rapid sequence calls to single channel  
    3. Async calls to single channel
    4. Long running .on handlers - conflict or parallel?
    5. Different channels - do they interfere?
    6. Scheduled tasks (interval/repeat/delay) - known conflicts
    
    All tests without debounce, throttle, or protection talents.

*/

// Utility functions for testing
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const timestamp = () => new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm

// Test result tracking
interface TestResult {
  testName: string
  callId: string
  startTime: string
  endTime: string
  duration: number
  payload: any
  result: any
  error?: string
}

const testResults: TestResult[] = []

const logResult = (
  testName: string,
  callId: string,
  startTime: string,
  payload: any,
  result: any,
  error?: string
) => {
  const endTime = timestamp()
  const start = new Date(`1970-01-01T${startTime}Z`).getTime()
  const end = new Date(`1970-01-01T${endTime}Z`).getTime()
  const duration = end - start

  testResults.push({
    testName,
    callId,
    startTime,
    endTime,
    duration,
    payload,
    result,
    error
  })

  console.log(
    `[${endTime}] ${testName} | ${callId} | Duration: ${duration}ms | Result:`,
    result
  )
}

const printSummary = (testName: string) => {
  const results = testResults.filter(r => r.testName === testName)
  console.log(`\n📊 ${testName} Summary:`)
  console.log(`   Total calls: ${results.length}`)
  console.log(
    `   Avg duration: ${Math.round(
      results.reduce((sum, r) => sum + r.duration, 0) / results.length
    )}ms`
  )
  console.log(`   Call order: ${results.map(r => r.callId).join(' → ')}`)
  console.log(
    `   Execution order: ${results
      .sort((a, b) => a.startTime.localeCompare(a.startTime))
      .map(r => r.callId)
      .join(' → ')}`
  )
  console.log(`   Errors: ${results.filter(r => r.error).length}`)
}

// ============================================
// TEST 1: CONCURRENT CALLS TO SINGLE CHANNEL (PARALLEL)
// ============================================

const testConcurrentCalls = async () => {
  console.log('\n🚀 TEST 1: Concurrent Calls to Single Channel (Parallel)')
  console.log('='.repeat(60))

  // Clear previous state
  cyre.clear()

  // Setup simple action - NO protections
  cyre.action({
    id: 'concurrent-test'
    // No debounce, throttle, interval, repeat, delay
  })

  // Setup handler that takes some time
  cyre.on('concurrent-test', async data => {
    const start = timestamp()
    console.log(
      `[${start}] Handler START: ${data.callId} (processing time: ${data.processingTime}ms)`
    )

    await delay(data.processingTime)

    const result = `processed-${data.callId}`
    logResult('concurrent-test', data.callId, start, data, result)
    return result
  })

  // Fire multiple calls AT THE SAME TIME
  console.log('\n⚡ Firing 5 concurrent calls...')
  const promises = [
    cyre.call('concurrent-test', {callId: 'A', processingTime: 300}),
    cyre.call('concurrent-test', {callId: 'B', processingTime: 200}),
    cyre.call('concurrent-test', {callId: 'C', processingTime: 400}),
    cyre.call('concurrent-test', {callId: 'D', processingTime: 100}),
    cyre.call('concurrent-test', {callId: 'E', processingTime: 250})
  ]

  try {
    const results = await Promise.all(promises)
    console.log(
      '\n✅ All concurrent calls completed:',
      results.map(r => r.payload)
    )
  } catch (error) {
    console.log('\n❌ Concurrent calls error:', error)
  }

  printSummary('concurrent-test')
}

// ============================================
// TEST 2: RAPID SEQUENCE CALLS TO SINGLE CHANNEL
// ============================================

const testRapidSequence = async () => {
  console.log('\n⚡ TEST 2: Rapid Sequence Calls to Single Channel')
  console.log('='.repeat(60))

  cyre.clear()

  // Setup action
  cyre.action({
    id: 'rapid-test'
  })

  // Handler with variable processing time
  cyre.on('rapid-test', async data => {
    const start = timestamp()
    console.log(`[${start}] Handler START: ${data.callId}`)

    await delay(data.processingTime)

    const result = `processed-${data.callId}`
    logResult('rapid-test', data.callId, start, data, result)
    return result
  })

  // Fire calls in rapid sequence (no await)
  console.log('\n⚡ Firing rapid sequence calls (50ms apart)...')
  const rapidPromises: Promise<any>[] = []

  for (let i = 1; i <= 5; i++) {
    rapidPromises.push(
      cyre.call('rapid-test', {callId: `R${i}`, processingTime: 200})
    )
    await delay(50) // Small delay between calls
  }

  try {
    const results = await Promise.all(rapidPromises)
    console.log(
      '\n✅ All rapid calls completed:',
      results.map(r => r.payload)
    )
  } catch (error) {
    console.log('\n❌ Rapid calls error:', error)
  }

  printSummary('rapid-test')
}

// ============================================
// TEST 3: ASYNC CALLS TO SINGLE CHANNEL
// ============================================

const testAsyncCalls = async () => {
  console.log('\n🔄 TEST 3: Async Calls to Single Channel')
  console.log('='.repeat(60))

  cyre.clear()

  cyre.action({
    id: 'async-test'
  })

  cyre.on('async-test', async data => {
    const start = timestamp()
    console.log(`[${start}] Handler START: ${data.callId}`)

    await delay(data.processingTime)

    const result = `processed-${data.callId}`
    logResult('async-test', data.callId, start, data, result)
    return result
  })

  // Fire async calls with different delays
  console.log('\n🔄 Firing async calls...')

  // Call 1: Immediate
  const call1 = cyre.call('async-test', {callId: 'ASYNC1', processingTime: 300})

  // Call 2: After 100ms
  setTimeout(() => {
    cyre.call('async-test', {callId: 'ASYNC2', processingTime: 200})
  }, 100)

  // Call 3: After 150ms
  setTimeout(() => {
    cyre.call('async-test', {callId: 'ASYNC3', processingTime: 100})
  }, 150)

  // Wait for first call and all async calls to complete
  await call1
  await delay(1000) // Wait for all async calls

  printSummary('async-test')
}

// ============================================
// TEST 4: LONG RUNNING HANDLERS - CONFLICT OR PARALLEL?
// ============================================

const testLongRunningHandlers = async () => {
  console.log('\n⏰ TEST 4: Long Running Handlers - Conflict or Parallel?')
  console.log('='.repeat(60))

  cyre.clear()

  cyre.action({
    id: 'long-running-test'
  })

  // Very slow handler
  cyre.on('long-running-test', async data => {
    const start = timestamp()
    console.log(
      `[${start}] LONG Handler START: ${data.callId} (will take ${data.processingTime}ms)`
    )

    await delay(data.processingTime)

    const result = `long-processed-${data.callId}`
    logResult('long-running-test', data.callId, start, data, result)
    return result
  })

  // Start a very long running call
  console.log('\n⏰ Starting long call (2 seconds)...')
  const longCall = cyre.call('long-running-test', {
    callId: 'LONG1',
    processingTime: 2000
  })

  // After 500ms, try to make another call
  setTimeout(() => {
    console.log('\n⚡ Attempting second call while first is still running...')
    cyre.call('long-running-test', {callId: 'LONG2', processingTime: 300})
  }, 500)

  // After 1000ms, try a third call
  setTimeout(() => {
    console.log('\n⚡ Attempting third call while first is still running...')
    cyre.call('long-running-test', {callId: 'LONG3', processingTime: 200})
  }, 1000)

  // Wait for all to complete
  await longCall
  await delay(3000)

  printSummary('long-running-test')
}

// ============================================
// TEST 5: DIFFERENT CHANNELS - DO THEY INTERFERE?
// ============================================

const testDifferentChannels = async () => {
  console.log('\n🔀 TEST 5: Different Channels - Do They Interfere?')
  console.log('='.repeat(60))

  cyre.clear()

  // Setup multiple channels
  cyre.action({id: 'channel-a'})
  cyre.action({id: 'channel-b'})
  cyre.action({id: 'channel-c'})

  // Handlers for each channel
  cyre.on('channel-a', async data => {
    const start = timestamp()
    console.log(`[${start}] Channel A Handler START: ${data.callId}`)
    await delay(data.processingTime)
    const result = `A-processed-${data.callId}`
    logResult('channel-a', data.callId, start, data, result)
    return result
  })

  cyre.on('channel-b', async data => {
    const start = timestamp()
    console.log(`[${start}] Channel B Handler START: ${data.callId}`)
    await delay(data.processingTime)
    const result = `B-processed-${data.callId}`
    logResult('channel-b', data.callId, start, data, result)
    return result
  })

  cyre.on('channel-c', async data => {
    const start = timestamp()
    console.log(`[${start}] Channel C Handler START: ${data.callId}`)
    await delay(data.processingTime)
    const result = `C-processed-${data.callId}`
    logResult('channel-c', data.callId, start, data, result)
    return result
  })

  // Fire calls to different channels simultaneously
  console.log('\n🔀 Firing calls to different channels simultaneously...')
  const channelPromises = [
    cyre.call('channel-a', {callId: 'A1', processingTime: 300}),
    cyre.call('channel-b', {callId: 'B1', processingTime: 200}),
    cyre.call('channel-c', {callId: 'C1', processingTime: 400}),
    cyre.call('channel-a', {callId: 'A2', processingTime: 150}),
    cyre.call('channel-b', {callId: 'B2', processingTime: 250})
  ]

  try {
    const results = await Promise.all(channelPromises)
    console.log(
      '\n✅ All channel calls completed:',
      results.map(r => r.payload)
    )
  } catch (error) {
    console.log('\n❌ Channel calls error:', error)
  }

  console.log('\n📊 Channel A Summary:')
  printSummary('channel-a')
  console.log('\n📊 Channel B Summary:')
  printSummary('channel-b')
  console.log('\n📊 Channel C Summary:')
  printSummary('channel-c')
}

// ============================================
// TEST 6: SCHEDULED TASKS - KNOWN CONFLICTS
// ============================================

const testScheduledConflicts = async () => {
  console.log('\n⏲️  TEST 6: Scheduled Tasks - Known Conflicts')
  console.log('='.repeat(60))

  cyre.clear()

  // Action with interval (known to cause conflicts)
  cyre.action({
    id: 'scheduled-conflict-test',
    repeat: 6,
    interval: 500 // Every 500ms
  })

  cyre.on('scheduled-conflict-test', async data => {
    const start = timestamp()
    const payload = data || {callId: 'SCHEDULED', processingTime: 800} // Takes longer than interval
    console.log(`[${start}] Scheduled Handler START: ${payload.callId}`)

    await delay(payload.processingTime)

    const result = `scheduled-${payload.callId}`
    logResult('scheduled-conflict-test', payload.callId, start, payload, result)
    return result
  })

  console.log(
    '\n⏲️  Starting scheduled task (500ms interval, 800ms processing)...'
  )
  console.log('   This should create conflicts since processing > interval')

  // Let it run for a few cycles
  await delay(3000)

  // Try manual call during scheduled execution
  console.log('\n⚡ Making manual call during scheduled execution...')
  try {
    const manualResult = await cyre.call('scheduled-conflict-test', {
      callId: 'MANUAL',
      processingTime: 200
    })
    console.log('Manual call result:', manualResult.payload)
  } catch (error) {
    console.log('Manual call error:', error)
  }

  // Stop the scheduled task
  cyre.forget('scheduled-conflict-test')

  printSummary('scheduled-conflict-test')
}

// ============================================
// RUN ALL TESTS
// ============================================

const runAllConflictTests = async () => {
  console.log('🧪 CYRE CONFLICT BEHAVIOR TEST SUITE')
  console.log('='.repeat(60))
  console.log(
    'Testing current behavior to understand when conflicts occur...\n'
  )

  try {
    await testConcurrentCalls()
    await delay(1000)

    await testRapidSequence()
    await delay(1000)

    await testAsyncCalls()
    await delay(1000)

    await testLongRunningHandlers()
    await delay(1000)

    await testDifferentChannels()
    await delay(1000)

    await testScheduledConflicts()

    console.log('\n🎉 ALL TESTS COMPLETED!')
    console.log('='.repeat(60))

    // Overall summary
    console.log('\n📋 OVERALL FINDINGS:')
    console.log(`   Total test calls: ${testResults.length}`)
    console.log(
      `   Errors encountered: ${testResults.filter(r => r.error).length}`
    )
    console.log(`   Tests with conflicts: (analyze results above)`)
  } catch (error) {
    console.error('\n💥 Test suite error:', error)
  }
}

// Export for manual testing
export {
  runAllConflictTests,
  testConcurrentCalls,
  testRapidSequence,
  testAsyncCalls,
  testLongRunningHandlers,
  testDifferentChannels,
  testScheduledConflicts
}

runAllConflictTests()
