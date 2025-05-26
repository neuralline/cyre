// Quick debug runner to test TimeKeeper behavior
// This helps us understand what's happening without running the full test suite

import {cyre} from '../src'

const runDebugTest = async () => {
  console.log('=== TimeKeeper Debug Test ===')

  // Initialize
  cyre.initialize()

  // Test 1: delay → interval transition
  console.log('\n--- Test 1: Delay → Interval Transition ---')

  const executions: Array<{time: number; executionNumber: number}> = []
  const startTime = Date.now()

  // Register handler
  cyre.on('debug-test', payload => {
    const elapsed = Date.now() - startTime
    const executionNumber = executions.length + 1
    executions.push({time: elapsed, executionNumber})

    console.log(
      `[${elapsed}ms] EXECUTION ${executionNumber}: ${JSON.stringify(payload)}`
    )
    return {executed: true, executionNumber}
  })

  // Create action with delay and interval
  console.log('Creating action: delay=150ms, interval=250ms, repeat=3')
  cyre.action({
    id: 'debug-test',
    delay: 150,
    interval: 250,
    repeat: 3
  })

  // Start the action
  console.log('Calling action...')
  const result = await cyre.call('debug-test', {test: 'delay-interval'})
  console.log('Call result:', result)

  // Wait for executions
  console.log('Waiting for executions...')
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('\nFinal results:')
  console.log('Executions:', executions)

  // Calculate intervals
  if (executions.length >= 2) {
    const intervals = []
    for (let i = 1; i < executions.length; i++) {
      intervals.push(executions[i].time - executions[i - 1].time)
    }
    console.log('Intervals between executions:', intervals)
  }

  // Test 2: immediate → interval
  console.log('\n--- Test 2: Immediate → Interval ---')

  const executions2: Array<{time: number; executionNumber: number}> = []
  const startTime2 = Date.now()

  cyre.on('debug-test-2', payload => {
    const elapsed = Date.now() - startTime2
    const executionNumber = executions2.length + 1
    executions2.push({time: elapsed, executionNumber})

    console.log(
      `[${elapsed}ms] IMMEDIATE EXECUTION ${executionNumber}: ${JSON.stringify(
        payload
      )}`
    )
    return {executed: true, executionNumber}
  })

  console.log('Creating action: delay=0 (immediate), interval=200ms, repeat=3')
  cyre.action({
    id: 'debug-test-2',
    delay: 0,
    interval: 200,
    repeat: 3
  })

  console.log('Calling immediate action...')
  const result2 = await cyre.call('debug-test-2', {test: 'immediate-interval'})
  console.log('Call result:', result2)

  await new Promise(resolve => setTimeout(resolve, 800))

  console.log('\nImmediate test results:')
  console.log('Executions:', executions2)

  if (executions2.length >= 2) {
    const intervals2 = []
    for (let i = 1; i < executions2.length; i++) {
      intervals2.push(executions2[i].time - executions2[i - 1].time)
    }
    console.log('Intervals between executions:', intervals2)
  }

  console.log('\n=== Debug Test Complete ===')
}

// Run the debug test
runDebugTest().catch(console.error)
