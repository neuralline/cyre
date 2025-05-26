// test/timekeeper-integration-test.ts
// Simple test to verify timekeeper integration is working

import {cyre} from '../src'

console.log('🧪 Testing Timekeeper Integration')

// Test 1: Simple interval action
console.log('\n🔹 Test 1: Simple interval action (should execute 3 times)')
const executions: Array<{time: number; data: any}> = []
const startTime = Date.now()

// Register handler
cyre.on('test-interval', payload => {
  const elapsed = Date.now() - startTime
  executions.push({time: elapsed, data: payload})
  console.log(`[${elapsed}ms] EXECUTED with:`, payload)
  return {executed: true}
})

// Create action with interval
console.log('Creating action with interval: 100ms, repeat: 3')
cyre.action({
  id: 'test-interval',
  interval: 100,
  repeat: 3,
  payload: {test: 'interval'}
})

// Get pipeline info
const pipelineInfo = cyre.getPipelineInfo('test-interval')
console.log('Pipeline info:', {
  isFastPath: pipelineInfo?.isFastPath,
  requiresTimekeeper: pipelineInfo?.requiresTimekeeper,
  category: pipelineInfo?.category
})

// Start the action
console.log('Starting action...')
cyre.call('test-interval', {counter: 1})

// Wait and check results
setTimeout(() => {
  console.log(`\n📊 Results after 400ms:`)
  console.log(`Expected: 3 executions`)
  console.log(`Actual: ${executions.length} executions`)
  console.log(
    'Execution times:',
    executions.map(e => e.time)
  )

  if (executions.length === 3) {
    console.log('✅ Test 1 PASSED')
  } else {
    console.log('❌ Test 1 FAILED')
  }

  // Test 2: Delay action
  console.log('\n🔹 Test 2: Delay action (should execute once after delay)')
  const delayExecutions: Array<{time: number}> = []
  const delayStart = Date.now()

  cyre.on('test-delay', () => {
    const elapsed = Date.now() - delayStart
    delayExecutions.push({time: elapsed})
    console.log(`[${elapsed}ms] DELAY EXECUTED`)
    return {executed: true}
  })

  cyre.action({
    id: 'test-delay',
    delay: 50,
    repeat: 1
  })

  const delayPipelineInfo = cyre.getPipelineInfo('test-delay')
  console.log('Delay Pipeline info:', {
    isFastPath: delayPipelineInfo?.isFastPath,
    requiresTimekeeper: delayPipelineInfo?.requiresTimekeeper,
    category: delayPipelineInfo?.category
  })

  cyre.call('test-delay')

  setTimeout(() => {
    console.log(`\n📊 Delay Results after 150ms:`)
    console.log(`Expected: 1 execution after ~50ms`)
    console.log(`Actual: ${delayExecutions.length} executions`)

    if (delayExecutions.length === 1 && delayExecutions[0].time >= 45) {
      console.log('✅ Test 2 PASSED')
    } else {
      console.log('❌ Test 2 FAILED')
    }

    // Clean up
    cyre.forget('test-interval')
    cyre.forget('test-delay')

    console.log('\n🧪 Timekeeper Integration Test Complete')
  }, 150)
}, 400)
