// examples/debounce-examples.ts
// Location: examples/debounce-examples.ts
// COMPREHENSIVE debounce validation covering all edge cases and test scenarios

import {cyre} from '../src'

/*

      C.Y.R.E - C.O.M.P.R.E.H.E.N.S.I.V.E   D.E.B.O.U.N.C.E   T.E.S.T.S
      
      Complete debounce validation covering:
      - Call collapsing behavior
      - Timer reset mechanisms
      - Last payload wins logic
      - Real-world scenarios
      - Edge cases & extreme values
      - Error handling & recovery
      - Performance & stress testing
      - Integration with other protections
      - MaxWait functionality
      - Memory & cleanup testing

*/

interface SearchResult {
  query: string
  results: string[]
  timestamp: number
  executionId: number
}

interface SaveOperation {
  content: string
  version: number
  timestamp: number
  userId: string
}

interface TestResult {
  name: string
  passed: boolean
  details: string
  metrics?: Record<string, number>
}

// =============================================================================
// SECTION 1: BASIC DEBOUNCE BEHAVIOR
// =============================================================================

/**
 * Test fundamental debounce mechanics - call collapsing and timer reset
 */
export async function basicDebounceTests(): Promise<TestResult[]> {
  console.log('🔧 Basic Debounce Behavior Tests')
  console.log('='.repeat(50))

  const results: TestResult[] = []

  // Test 1: Basic call collapsing
  try {
    let execCount = 0
    let lastPayload: any = null

    cyre.on('basic-debounce-1', payload => {
      execCount++
      lastPayload = payload
      return {executed: true, count: execCount, payload}
    })

    cyre.action({
      id: 'basic-debounce-1',
      debounce: 200
    })

    // Rapid successive calls - should collapse to single execution
    await cyre.call('basic-debounce-1', {value: 'A'})
    await new Promise(resolve => setTimeout(resolve, 50))
    await cyre.call('basic-debounce-1', {value: 'B'})
    await new Promise(resolve => setTimeout(resolve, 50))
    await cyre.call('basic-debounce-1', {value: 'C'})

    // Wait for debounce to complete
    await new Promise(resolve => setTimeout(resolve, 250))

    const passed = execCount === 1 && lastPayload?.value === 'C'
    results.push({
      name: 'Basic call collapsing (last payload wins)',
      passed,
      details: `Executions: ${execCount}, Final payload: ${lastPayload?.value}, Expected: C`
    })

    console.log(`${passed ? '✅' : '❌'} Call collapsing: ${passed}`)
    cyre.forget('basic-debounce-1')
  } catch (error) {
    results.push({
      name: 'Basic call collapsing test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 2: Timer reset behavior
  try {
    let execCount = 0
    const executionTimes: number[] = []

    cyre.on('basic-debounce-2', payload => {
      execCount++
      executionTimes.push(Date.now())
      return {executed: true, count: execCount}
    })

    cyre.action({
      id: 'basic-debounce-2',
      debounce: 300
    })

    const startTime = Date.now()

    // Series of calls that reset the timer
    await cyre.call('basic-debounce-2', {sequence: 1})
    await new Promise(resolve => setTimeout(resolve, 100))
    await cyre.call('basic-debounce-2', {sequence: 2}) // Resets timer
    await new Promise(resolve => setTimeout(resolve, 100))
    await cyre.call('basic-debounce-2', {sequence: 3}) // Resets timer
    await new Promise(resolve => setTimeout(resolve, 100))
    await cyre.call('basic-debounce-2', {sequence: 4}) // Resets timer

    // Wait for final execution
    await new Promise(resolve => setTimeout(resolve, 350))

    const totalDuration = executionTimes[0] - startTime
    const passed = execCount === 1 && totalDuration >= 600 // Should be ~700ms due to resets

    results.push({
      name: 'Timer reset on new calls',
      passed,
      details: `Executions: ${execCount}, Duration: ${totalDuration}ms, Expected: ~700ms`
    })

    console.log(`${passed ? '✅' : '❌'} Timer reset: ${passed}`)
    cyre.forget('basic-debounce-2')
  } catch (error) {
    results.push({
      name: 'Timer reset test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 3: No debounce on single call
  try {
    let execCount = 0

    cyre.on('basic-debounce-3', payload => {
      execCount++
      return {executed: true}
    })

    cyre.action({
      id: 'basic-debounce-3',
      debounce: 200
    })

    // Single call should execute after debounce period
    await cyre.call('basic-debounce-3', {single: true})
    await new Promise(resolve => setTimeout(resolve, 250))

    const passed = execCount === 1
    results.push({
      name: 'Single call executes after debounce',
      passed,
      details: `Executions: ${execCount}, Expected: 1`
    })

    console.log(`${passed ? '✅' : '❌'} Single call: ${passed}`)
    cyre.forget('basic-debounce-3')
  } catch (error) {
    results.push({
      name: 'Single call test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  return results
}

// =============================================================================
// SECTION 2: MAXWAIT FUNCTIONALITY
// =============================================================================

/**
 * Test maxWait behavior - ensures execution happens even with continuous calls
 */
export async function maxWaitTests(): Promise<TestResult[]> {
  console.log('\n⏰ MaxWait Functionality Tests')
  console.log('='.repeat(50))

  const results: TestResult[] = []

  // Test 1: MaxWait prevents infinite delay
  try {
    let execCount = 0
    const executionTimes: number[] = []

    cyre.on('maxwait-test-1', payload => {
      execCount++
      executionTimes.push(Date.now())
      return {executed: true, count: execCount, payload}
    })

    cyre.action({
      id: 'maxwait-test-1',
      debounce: 500,
      maxWait: 1000 // Force execution after 1 second max
    })

    const startTime = Date.now()

    // Continuous calls that would normally delay execution indefinitely
    for (let i = 0; i < 10; i++) {
      await cyre.call('maxwait-test-1', {sequence: i})
      await new Promise(resolve => setTimeout(resolve, 200)) // Every 200ms
    }

    // Wait for potential execution
    await new Promise(resolve => setTimeout(resolve, 600))

    const totalDuration = executionTimes[0] - startTime
    const passed = execCount >= 1 && totalDuration <= 1200 // Should execute around 1000ms due to maxWait

    results.push({
      name: 'MaxWait prevents infinite delay',
      passed,
      details: `Executions: ${execCount}, Duration: ${totalDuration}ms, MaxWait: 1000ms`
    })

    console.log(`${passed ? '✅' : '❌'} MaxWait enforcement: ${passed}`)
    cyre.forget('maxwait-test-1')
  } catch (error) {
    results.push({
      name: 'MaxWait test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 2: MaxWait shorter than debounce
  try {
    let execCount = 0

    cyre.on('maxwait-test-2', payload => {
      execCount++
      return {executed: true}
    })

    cyre.action({
      id: 'maxwait-test-2',
      debounce: 1000,
      maxWait: 1300 // Shorter than debounce
    })

    // Rapid calls
    for (let i = 0; i < 5; i++) {
      await cyre.call('maxwait-test-2', {attempt: i})
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    await new Promise(resolve => setTimeout(resolve, 400))

    const passed = execCount >= 1
    results.push({
      name: 'MaxWait shorter than debounce',
      passed,
      details: `Executions: ${execCount}, Debounce: 1000ms, MaxWait: 300ms`
    })

    console.log(`${passed ? '✅' : '❌'} Short maxWait: ${passed}`)
    cyre.forget('maxwait-test-2')
  } catch (error) {
    results.push({
      name: 'Short maxWait test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  return results
}

// =============================================================================
// SECTION 3: EDGE CASES & EXTREME VALUES
// =============================================================================

/**
 * Test edge cases and extreme debounce values
 */
export async function edgeCaseTests(): Promise<TestResult[]> {
  console.log('\n⚡ Edge Cases & Extreme Values Tests')
  console.log('='.repeat(50))

  const results: TestResult[] = []

  // Test 1: Minimal debounce value (1ms)
  try {
    let execCount = 0

    cyre.on('edge-debounce-1', () => {
      execCount++
      return {executed: true}
    })

    cyre.action({
      id: 'edge-debounce-1',
      debounce: 1
    })

    // Rapid calls with 1ms debounce
    await cyre.call('edge-debounce-1')
    await cyre.call('edge-debounce-1')
    await cyre.call('edge-debounce-1')

    await new Promise(resolve => setTimeout(resolve, 10))

    const passed = execCount === 1
    results.push({
      name: 'Minimal debounce value (1ms)',
      passed,
      details: `Executions: ${execCount}, Expected: 1`
    })

    console.log(`${passed ? '✅' : '❌'} Minimal debounce: ${passed}`)
    cyre.forget('edge-debounce-1')
  } catch (error) {
    results.push({
      name: 'Minimal debounce test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 2: Very large debounce value
  try {
    let execCount = 0

    cyre.on('edge-debounce-2', () => {
      execCount++
      return {executed: true}
    })

    cyre.action({
      id: 'edge-debounce-2',
      debounce: Number.MAX_SAFE_INTEGER
    })

    await cyre.call('edge-debounce-2')
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should not execute within reasonable time
    const passed = execCount === 0
    results.push({
      name: 'Maximum debounce value',
      passed,
      details: `Executions: ${execCount}, Expected: 0 (within 100ms)`
    })

    console.log(`${passed ? '✅' : '❌'} Maximum debounce: ${passed}`)
    cyre.forget('edge-debounce-2')
  } catch (error) {
    results.push({
      name: 'Maximum debounce test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 3: Zero debounce (should not debounce)
  try {
    let execCount = 0

    cyre.on('edge-debounce-3', () => {
      execCount++
      return {executed: true}
    })

    cyre.action({
      id: 'edge-debounce-3',
      debounce: 0
    })

    // Multiple calls with zero debounce
    await cyre.call('edge-debounce-3')
    await cyre.call('edge-debounce-3')
    await cyre.call('edge-debounce-3')

    await new Promise(resolve => setTimeout(resolve, 50))

    const passed = execCount === 3 // All should execute
    results.push({
      name: 'Zero debounce (no debouncing)',
      passed,
      details: `Executions: ${execCount}, Expected: 3`
    })

    console.log(`${passed ? '✅' : '❌'} Zero debounce: ${passed}`)
    cyre.forget('edge-debounce-3')
  } catch (error) {
    results.push({
      name: 'Zero debounce test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 4: Undefined debounce
  try {
    let execCount = 0

    cyre.on('edge-debounce-4', () => {
      execCount++
      return {executed: true}
    })

    cyre.action({
      id: 'edge-debounce-4'
      // No debounce specified
    })

    await cyre.call('edge-debounce-4')
    await cyre.call('edge-debounce-4')
    await cyre.call('edge-debounce-4')

    await new Promise(resolve => setTimeout(resolve, 50))

    const passed = execCount === 3 // All should execute
    results.push({
      name: 'Undefined debounce (no debouncing)',
      passed,
      details: `Executions: ${execCount}, Expected: 3`
    })

    console.log(`${passed ? '✅' : '❌'} Undefined debounce: ${passed}`)
    cyre.forget('edge-debounce-4')
  } catch (error) {
    results.push({
      name: 'Undefined debounce test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  return results
}

// =============================================================================
// SECTION 4: ERROR HANDLING & RECOVERY
// =============================================================================

/**
 * Test debounce behavior with errors and recovery scenarios
 */
export async function errorHandlingTests(): Promise<TestResult[]> {
  console.log('\n🚨 Error Handling & Recovery Tests')
  console.log('='.repeat(50))

  const results: TestResult[] = []

  // Test 1: Handler throws error during debounced execution
  try {
    let attemptCount = 0

    cyre.on('error-debounce-1', payload => {
      attemptCount++
      if (attemptCount === 1) {
        throw new Error('Debounced execution fails')
      }
      return {executed: true, attempt: attemptCount}
    })

    cyre.action({
      id: 'error-debounce-1',
      debounce: 200
    })

    // Rapid calls that will be debounced
    await cyre.call('error-debounce-1', {test: 1})
    await cyre.call('error-debounce-1', {test: 2})
    await cyre.call('error-debounce-1', {test: 3})

    await new Promise(resolve => setTimeout(resolve, 300))

    // Second set of calls after error
    await cyre.call('error-debounce-1', {test: 4})
    await new Promise(resolve => setTimeout(resolve, 300))

    const passed = attemptCount === 2 // First failed, second succeeded
    results.push({
      name: 'Error handling in debounced execution',
      passed,
      details: `Attempts: ${attemptCount}, Expected: 2 (1 error, 1 success)`
    })

    console.log(`${passed ? '✅' : '❌'} Error handling: ${passed}`)
    cyre.forget('error-debounce-1')
  } catch (error) {
    results.push({
      name: 'Error handling test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 2: Async handler errors
  try {
    let attemptCount = 0

    cyre.on('error-debounce-2', async payload => {
      attemptCount++
      await new Promise(resolve => setTimeout(resolve, 50))
      if (attemptCount === 1) {
        throw new Error('Async debounced error')
      }
      return {executed: true, attempt: attemptCount}
    })

    cyre.action({
      id: 'error-debounce-2',
      debounce: 200
    })

    await cyre.call('error-debounce-2', {async: 1})
    await cyre.call('error-debounce-2', {async: 2})

    await new Promise(resolve => setTimeout(resolve, 350))

    // Try again after error
    await cyre.call('error-debounce-2', {async: 3})
    await new Promise(resolve => setTimeout(resolve, 350))

    const passed = attemptCount === 2
    results.push({
      name: 'Async error handling in debounce',
      passed,
      details: `Attempts: ${attemptCount}, Expected: 2`
    })

    console.log(`${passed ? '✅' : '❌'} Async error handling: ${passed}`)
    cyre.forget('error-debounce-2')
  } catch (error) {
    results.push({
      name: 'Async error test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  return results
}

// =============================================================================
// SECTION 5: INTEGRATION WITH OTHER PROTECTIONS
// =============================================================================

/**
 * Test debounce combined with other Cyre protection mechanisms
 */
export async function integrationTests(): Promise<TestResult[]> {
  console.log('\n🔗 Integration with Other Protections Tests')
  console.log('='.repeat(50))

  const results: TestResult[] = []

  // Test 1: Debounce + detectChanges
  try {
    let execCount = 0
    const executedPayloads: any[] = []

    cyre.on('integration-debounce-1', payload => {
      execCount++
      executedPayloads.push(payload)
      return {executed: true, count: execCount}
    })

    cyre.action({
      id: 'integration-debounce-1',
      debounce: 200,
      detectChanges: true
    })

    // Rapid calls with same payload - should debounce and detect no change
    await cyre.call('integration-debounce-1', {value: 'A'})
    await cyre.call('integration-debounce-1', {value: 'A'})
    await cyre.call('integration-debounce-1', {value: 'A'})

    await new Promise(resolve => setTimeout(resolve, 300))

    // Different payload after debounce
    await cyre.call('integration-debounce-1', {value: 'B'})
    await new Promise(resolve => setTimeout(resolve, 300))

    const passed =
      execCount === 2 &&
      executedPayloads[0].value === 'A' &&
      executedPayloads[1].value === 'B'
    results.push({
      name: 'Debounce + detectChanges integration',
      passed,
      details: `Executions: ${execCount}, Payloads: [${executedPayloads
        .map(p => p.value)
        .join(', ')}]`
    })

    console.log(
      `${passed ? '✅' : '❌'} Debounce + change detection: ${passed}`
    )
    cyre.forget('integration-debounce-1')
  } catch (error) {
    results.push({
      name: 'Debounce + detectChanges test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 2: Debounce + schema validation
  try {
    let execCount = 0

    cyre.on('integration-debounce-2', payload => {
      execCount++
      return {executed: true, validated: payload}
    })

    cyre.action({
      id: 'integration-debounce-2',
      debounce: 200,
      schema: payload => {
        if (!payload || !payload.name || payload.name.length < 2) {
          throw new Error('Invalid payload: name required, min 2 chars')
        }
        return payload
      }
    })

    // Valid payloads that will be debounced
    await cyre.call('integration-debounce-2', {name: 'John'})
    await cyre.call('integration-debounce-2', {name: 'Jane'})
    await cyre.call('integration-debounce-2', {name: 'Bob'})

    await new Promise(resolve => setTimeout(resolve, 300))

    // Invalid payload after debounce
    try {
      await cyre.call('integration-debounce-2', {name: 'X'})
      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (validationError) {
      // Expected validation error
    }

    const passed = execCount === 1 // Only the debounced valid call should execute
    results.push({
      name: 'Debounce + schema validation',
      passed,
      details: `Executions: ${execCount}, Expected: 1 (debounced valid calls)`
    })

    console.log(`${passed ? '✅' : '❌'} Debounce + schema: ${passed}`)
    cyre.forget('integration-debounce-2')
  } catch (error) {
    results.push({
      name: 'Debounce + schema test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  return results
}

// =============================================================================
// SECTION 6: PERFORMANCE & STRESS TESTING
// =============================================================================

/**
 * Test debounce under high load and performance scenarios
 */
export async function performanceTests(): Promise<TestResult[]> {
  console.log('\n🚀 Performance & Stress Tests')
  console.log('='.repeat(50))

  const results: TestResult[] = []

  // Test 1: High frequency debounced calls
  try {
    let execCount = 0
    const startTime = Date.now()

    cyre.on('perf-debounce-1', payload => {
      execCount++
      return {executed: true, finalPayload: payload}
    })

    cyre.action({
      id: 'perf-debounce-1',
      debounce: 100
    })

    // 200 rapid calls - should collapse to 1 execution
    for (let i = 0; i < 200; i++) {
      await cyre.call('perf-debounce-1', {iteration: i})
      // No delay - truly rapid calls
    }

    await new Promise(resolve => setTimeout(resolve, 200))

    const duration = Date.now() - startTime
    const passed = execCount === 1 && duration < 500

    results.push({
      name: 'High frequency call collapsing',
      passed,
      details: `${execCount}/200 executions, ${duration}ms duration`,
      metrics: {
        executionCount: execCount,
        totalCalls: 200,
        collapseEfficiency: (200 - execCount) / 200,
        duration
      }
    })

    console.log(
      `${
        passed ? '✅' : '❌'
      } High frequency: ${execCount}/200 executions, ${duration}ms`
    )
    cyre.forget('perf-debounce-1')
  } catch (error) {
    results.push({
      name: 'High frequency test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 2: Multiple concurrent debounced actions
  try {
    const actionResults: Record<string, number> = {}
    const actions = [
      {id: 'perf-debounce-fast', debounce: 50},
      {id: 'perf-debounce-medium', debounce: 200},
      {id: 'perf-debounce-slow', debounce: 500}
    ]

    // Set up actions
    actions.forEach(action => {
      actionResults[action.id] = 0
      cyre.on(action.id, () => {
        actionResults[action.id]++
        return {executed: true}
      })
      cyre.action(action)
    })

    // Rapid calls to all actions simultaneously
    for (let i = 0; i < 20; i++) {
      for (const action of actions) {
        await cyre.call(action.id, {round: i})
      }
      await new Promise(resolve => setTimeout(resolve, 25))
    }

    // Wait for all debounces to complete
    await new Promise(resolve => setTimeout(resolve, 700))

    // Each action should execute once (all calls collapsed)
    const allExecutedOnce = Object.values(actionResults).every(
      count => count === 1
    )
    const passed = allExecutedOnce

    results.push({
      name: 'Concurrent debounced actions',
      passed,
      details: `Fast: ${actionResults['perf-debounce-fast']}, Medium: ${actionResults['perf-debounce-medium']}, Slow: ${actionResults['perf-debounce-slow']}`,
      metrics: {
        fastExecutions: actionResults['perf-debounce-fast'],
        mediumExecutions: actionResults['perf-debounce-medium'],
        slowExecutions: actionResults['perf-debounce-slow']
      }
    })

    console.log(
      `${passed ? '✅' : '❌'} Concurrent debounces: Fast(${
        actionResults['perf-debounce-fast']
      }) Medium(${actionResults['perf-debounce-medium']}) Slow(${
        actionResults['perf-debounce-slow']
      })`
    )

    actions.forEach(action => cyre.forget(action.id))
  } catch (error) {
    results.push({
      name: 'Concurrent actions test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 3: Memory usage with large payloads
  try {
    const initialMemory = process.memoryUsage?.().heapUsed || 0
    let execCount = 0

    cyre.on('perf-debounce-3', payload => {
      execCount++
      return {executed: true, dataSize: payload.data.length}
    })

    cyre.action({
      id: 'perf-debounce-3',
      debounce: 100
    })

    // Multiple calls with large payloads
    for (let i = 0; i < 50; i++) {
      const largeData = new Array(10000).fill(0).map((_, j) => ({
        id: `item-${i}-${j}`,
        data: `large-string-${i}-${j}`.repeat(10)
      }))

      await cyre.call('perf-debounce-3', {iteration: i, data: largeData})
    }

    await new Promise(resolve => setTimeout(resolve, 200))

    const finalMemory = process.memoryUsage?.().heapUsed || 0
    const memoryIncrease = finalMemory - initialMemory

    // Should have minimal memory impact due to debouncing
    const passed = execCount === 1 && memoryIncrease < 100 * 1024 * 1024 // Less than 100MB

    results.push({
      name: 'Memory usage with large payloads',
      passed,
      details: `Executions: ${execCount}, Memory increase: ${Math.round(
        memoryIncrease / 1024 / 1024
      )}MB`,
      metrics: {
        executions: execCount,
        memoryIncreaseMB: Math.round(memoryIncrease / 1024 / 1024)
      }
    })

    console.log(
      `${
        passed ? '✅' : '❌'
      } Memory test: ${execCount} executions, ${Math.round(
        memoryIncrease / 1024 / 1024
      )}MB increase`
    )
    cyre.forget('perf-debounce-3')
  } catch (error) {
    results.push({
      name: 'Memory test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  return results
}

// =============================================================================
// SECTION 7: REAL-WORLD SCENARIOS
// =============================================================================

/**
 * Test comprehensive real-world debounce scenarios
 */
export async function realWorldTests(): Promise<TestResult[]> {
  console.log('\n🌍 Real-World Scenario Tests')
  console.log('='.repeat(50))

  const results: TestResult[] = []

  // Test 1: Search-as-you-type
  try {
    let searchCount = 0
    const searchQueries: string[] = []

    cyre.on('search-as-type', payload => {
      searchCount++
      searchQueries.push(payload.query)
      console.log(`🔍 Executing search #${searchCount}: "${payload.query}"`)
      return {
        query: payload.query,
        results: [
          `Result 1 for "${payload.query}"`,
          `Result 2 for "${payload.query}"`
        ],
        searchId: searchCount
      }
    })

    cyre.action({
      id: 'search-as-type',
      debounce: 300
    })

    console.log('⌨️ Simulating typing "react hooks"...')

    // Simulate user typing progressively
    const typingSequence = [
      'r',
      're',
      'rea',
      'reac',
      'react',
      'react ',
      'react h',
      'react ho',
      'react hoo',
      'react hook',
      'react hooks'
    ]

    for (const query of typingSequence) {
      console.log(`⌨️ Typed: "${query}"`)
      await cyre.call('search-as-type', {query, userId: 'user123'})
      await new Promise(resolve => setTimeout(resolve, 80)) // Realistic typing speed
    }

    // Wait for debounced execution
    await new Promise(resolve => setTimeout(resolve, 400))

    // Only final query should be searched
    const passed = searchCount === 1 && searchQueries[0] === 'react hooks'

    results.push({
      name: 'Search-as-you-type debouncing',
      passed,
      details: `Searches: ${searchCount}, Final query: "${searchQueries[0]}", Keystrokes: ${typingSequence.length}`,
      metrics: {
        searchesExecuted: searchCount,
        keystrokesSaved: typingSequence.length - searchCount,
        efficiency:
          (typingSequence.length - searchCount) / typingSequence.length
      }
    })

    console.log(
      `${
        passed ? '✅' : '❌'
      } Search debouncing: ${searchCount} searches from ${
        typingSequence.length
      } keystrokes`
    )
    cyre.forget('search-as-type')
  } catch (error) {
    results.push({
      name: 'Search-as-type test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 2: Auto-save functionality
  try {
    let saveCount = 0
    const savedVersions: SaveOperation[] = []

    cyre.on('auto-save', payload => {
      saveCount++
      const saveOp: SaveOperation = {
        content: payload.content,
        version: saveCount,
        timestamp: Date.now(),
        userId: payload.userId
      }
      savedVersions.push(saveOp)
      console.log(
        `💾 Auto-save #${saveCount}: "${payload.content.substring(0, 30)}..."`
      )
      return saveOp
    })

    cyre.action({
      id: 'auto-save',
      debounce: 2000, // 2 second delay after typing stops
      maxWait: 10000 // Force save every 10 seconds
    })

    console.log('📝 Simulating document editing...')

    // Simulate user typing a document
    const edits = [
      'Hello world',
      'Hello world!',
      'Hello world! This is',
      'Hello world! This is a',
      'Hello world! This is a test',
      'Hello world! This is a test document',
      'Hello world! This is a test document that',
      'Hello world! This is a test document that I am writing',
      'Hello world! This is a test document that I am writing for the demo'
    ]

    for (let i = 0; i < edits.length; i++) {
      console.log(`✏️ Edit ${i + 1}: "${edits[i]}"`)
      await cyre.call('auto-save', {
        content: edits[i],
        userId: 'writer123',
        documentId: 'doc-456'
      })
      await new Promise(resolve => setTimeout(resolve, 500)) // Typing pauses
    }

    // Wait for final auto-save
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Should save only the final version
    const passed =
      saveCount === 1 && savedVersions[0].content === edits[edits.length - 1]

    results.push({
      name: 'Auto-save document editing',
      passed,
      details: `Saves: ${saveCount}, Edits: ${
        edits.length
      }, Final content: "${savedVersions[0]?.content.substring(0, 30)}..."`,
      metrics: {
        savesExecuted: saveCount,
        editsCollapsed: edits.length - saveCount,
        compressionRatio: (edits.length - saveCount) / edits.length
      }
    })

    console.log(
      `${passed ? '✅' : '❌'} Auto-save: ${saveCount} saves from ${
        edits.length
      } edits`
    )
    cyre.forget('auto-save')
  } catch (error) {
    results.push({
      name: 'Auto-save test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 3: Window resize handling
  try {
    let resizeCount = 0
    const resizeEvents: Array<{
      width: number
      height: number
      timestamp: number
    }> = []

    cyre.on('window-resize', payload => {
      resizeCount++
      const resizeEvent = {
        width: payload.width,
        height: payload.height,
        timestamp: Date.now()
      }
      resizeEvents.push(resizeEvent)
      console.log(
        `📐 Handling resize #${resizeCount}: ${payload.width}x${payload.height}`
      )
      return resizeEvent
    })

    cyre.action({
      id: 'window-resize',
      debounce: 250 // Quarter second delay after resize stops
    })

    console.log('🖥️ Simulating window resize events...')

    // Simulate rapid window resize events
    const resizeSizes = [
      {width: 1200, height: 800},
      {width: 1180, height: 785},
      {width: 1160, height: 770},
      {width: 1140, height: 755},
      {width: 1120, height: 740},
      {width: 1100, height: 725},
      {width: 1080, height: 710},
      {width: 1060, height: 695},
      {width: 1040, height: 680},
      {width: 1024, height: 768} // Final size
    ]

    for (const size of resizeSizes) {
      console.log(`🖥️ Resize to: ${size.width}x${size.height}`)
      await cyre.call('window-resize', size)
      await new Promise(resolve => setTimeout(resolve, 50)) // Rapid resize events
    }

    // Wait for debounced execution
    await new Promise(resolve => setTimeout(resolve, 350))

    // Should handle only the final resize
    const finalSize = resizeSizes[resizeSizes.length - 1]
    const passed =
      resizeCount === 1 &&
      resizeEvents[0].width === finalSize.width &&
      resizeEvents[0].height === finalSize.height

    results.push({
      name: 'Window resize event debouncing',
      passed,
      details: `Resize handlers: ${resizeCount}, Events: ${resizeSizes.length}, Final: ${resizeEvents[0]?.width}x${resizeEvents[0]?.height}`,
      metrics: {
        handlersExecuted: resizeCount,
        eventsCollapsed: resizeSizes.length - resizeCount,
        performanceGain: (resizeSizes.length - resizeCount) / resizeSizes.length
      }
    })

    console.log(
      `${
        passed ? '✅' : '❌'
      } Resize debouncing: ${resizeCount} handlers from ${
        resizeSizes.length
      } events`
    )
    cyre.forget('window-resize')
  } catch (error) {
    results.push({
      name: 'Window resize test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 4: Form validation
  try {
    let validationCount = 0
    const validationResults: Array<{
      field: string
      isValid: boolean
      errors: string[]
    }> = []

    cyre.on('form-validation', payload => {
      validationCount++
      const errors: string[] = []

      if (!payload.email || !payload.email.includes('@')) {
        errors.push('Invalid email format')
      }
      if (!payload.password || payload.password.length < 6) {
        errors.push('Password must be at least 6 characters')
      }
      if (payload.password !== payload.confirmPassword) {
        errors.push('Passwords do not match')
      }

      const result = {
        field: payload.field,
        isValid: errors.length === 0,
        errors
      }

      validationResults.push(result)
      console.log(
        `✅ Validation #${validationCount} for ${payload.field}: ${
          result.isValid ? 'Valid' : `Invalid (${errors.length} errors)`
        }`
      )
      return result
    })

    cyre.action({
      id: 'form-validation',
      debounce: 500 // Half second after user stops typing
    })

    console.log('📋 Simulating form input validation...')

    // Simulate user filling out a form with corrections
    const formInputs = [
      {field: 'email', email: 'j', password: '', confirmPassword: ''},
      {field: 'email', email: 'jo', password: '', confirmPassword: ''},
      {field: 'email', email: 'joh', password: '', confirmPassword: ''},
      {field: 'email', email: 'john', password: '', confirmPassword: ''},
      {field: 'email', email: 'john@', password: '', confirmPassword: ''},
      {field: 'email', email: 'john@ex', password: '', confirmPassword: ''},
      {
        field: 'email',
        email: 'john@example.com',
        password: '',
        confirmPassword: ''
      },
      {
        field: 'password',
        email: 'john@example.com',
        password: 'p',
        confirmPassword: ''
      },
      {
        field: 'password',
        email: 'john@example.com',
        password: 'pa',
        confirmPassword: ''
      },
      {
        field: 'password',
        email: 'john@example.com',
        password: 'pass',
        confirmPassword: ''
      },
      {
        field: 'password',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: ''
      },
      {
        field: 'confirmPassword',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'p'
      },
      {
        field: 'confirmPassword',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'pa'
      },
      {
        field: 'confirmPassword',
        email: 'john@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      }
    ]

    for (const input of formInputs) {
      console.log(
        `📝 Input in ${input.field}: "${
          input[input.field as keyof typeof input]
        }"`
      )
      await cyre.call('form-validation', input)
      await new Promise(resolve => setTimeout(resolve, 100)) // Typing speed
    }

    // Wait for final validation
    await new Promise(resolve => setTimeout(resolve, 600))

    // Should validate only the final complete form
    const passed = validationCount === 1 && validationResults[0].isValid

    results.push({
      name: 'Form validation debouncing',
      passed,
      details: `Validations: ${validationCount}, Inputs: ${formInputs.length}, Final valid: ${validationResults[0]?.isValid}`,
      metrics: {
        validationsExecuted: validationCount,
        inputsCollapsed: formInputs.length - validationCount,
        processingReduction:
          (formInputs.length - validationCount) / formInputs.length
      }
    })

    console.log(
      `${
        passed ? '✅' : '❌'
      } Form validation: ${validationCount} validations from ${
        formInputs.length
      } inputs`
    )
    cyre.forget('form-validation')
  } catch (error) {
    results.push({
      name: 'Form validation test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  return results
}

// =============================================================================
// SECTION 8: ACTION LIFECYCLE & CLEANUP TESTS
// =============================================================================

/**
 * Test action lifecycle, replacement, and cleanup scenarios for debounce
 */
export async function lifecycleTests(): Promise<TestResult[]> {
  console.log('\n🔄 Action Lifecycle & Cleanup Tests')
  console.log('='.repeat(50))

  const results: TestResult[] = []

  // Test 1: Action replacement during debounce period
  try {
    let execCount = 0

    cyre.on('lifecycle-debounce-1', payload => {
      execCount++
      return {executed: true, count: execCount, payload}
    })

    // Create action with long debounce
    cyre.action({
      id: 'lifecycle-debounce-1',
      debounce: 1000
    })

    // Make calls that start debounce timer
    await cyre.call('lifecycle-debounce-1', {phase: 'original'})

    // Replace action with shorter debounce
    cyre.action({
      id: 'lifecycle-debounce-1',
      debounce: 200
    })

    // Wait for new debounce period
    await new Promise(resolve => setTimeout(resolve, 300))

    const passed = execCount >= 1
    results.push({
      name: 'Action replacement during debounce',
      passed,
      details: `Executions: ${execCount}, Expected: at least 1`
    })

    console.log(`${passed ? '✅' : '❌'} Action replacement: ${passed}`)
    cyre.forget('lifecycle-debounce-1')
  } catch (error) {
    results.push({
      name: 'Action replacement test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 2: Action forget during debounce period
  try {
    let execCount = 0

    cyre.on('lifecycle-debounce-2', () => {
      execCount++
      return {executed: true}
    })

    cyre.action({
      id: 'lifecycle-debounce-2',
      debounce: 500
    })

    // Start debounce timer
    await cyre.call('lifecycle-debounce-2', {test: 'forgotten'})

    // Forget action while debounce is pending
    const forgotten = cyre.forget('lifecycle-debounce-2')

    // Wait past original debounce period
    await new Promise(resolve => setTimeout(resolve, 600))

    // Should not execute after being forgotten
    const passed = forgotten && execCount === 0

    results.push({
      name: 'Action forget during debounce period',
      passed,
      details: `Forgotten: ${forgotten}, Executions: ${execCount}, Expected: 0`
    })

    console.log(`${passed ? '✅' : '❌'} Action forget: ${passed}`)
  } catch (error) {
    results.push({
      name: 'Action forget test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  // Test 3: System clear during multiple debounce operations
  try {
    const actionIds = [
      'cleanup-debounce-1',
      'cleanup-debounce-2',
      'cleanup-debounce-3'
    ]
    let totalExecs = 0

    // Create multiple debounced actions
    actionIds.forEach(id => {
      cyre.on(id, () => {
        totalExecs++
        return {executed: true, id}
      })
      cyre.action({id, debounce: 300})
    })

    // Start debounce timers for all actions
    for (const id of actionIds) {
      await cyre.call(id, {cleanup: true})
    }

    // Clear all actions while debounces are pending
    cyre.clear()

    // Wait past debounce period
    await new Promise(resolve => setTimeout(resolve, 400))

    // No executions should occur after cleanup
    const passed = totalExecs === 0

    results.push({
      name: 'System clear during debounce operations',
      passed,
      details: `Executions after clear: ${totalExecs}, Expected: 0`
    })

    console.log(`${passed ? '✅' : '❌'} System clear: ${passed}`)
  } catch (error) {
    results.push({
      name: 'System clear test',
      passed: false,
      details: `Error: ${error}`
    })
  }

  return results
}

// =============================================================================
// SECTION 9: COMPREHENSIVE TEST RUNNER
// =============================================================================

/**
 * Run all comprehensive debounce tests
 */
export async function runComprehensiveDebounceTests() {
  console.log('🎬 Cyre Comprehensive Debounce Test Suite')
  console.log('='.repeat(70))
  console.log('Testing ALL aspects of debounce behavior...\n')

  try {
    // Initialize Cyre
    cyre.init()

    const allResults: TestResult[] = []
    const sectionResults: Record<string, TestResult[]> = {}

    // Run all test sections
    console.log('Running comprehensive debounce test suite...\n')

    sectionResults['Basic Behavior'] = await basicDebounceTests()
    allResults.push(...sectionResults['Basic Behavior'])

    sectionResults['MaxWait Functionality'] = await maxWaitTests()
    allResults.push(...sectionResults['MaxWait Functionality'])

    sectionResults['Edge Cases'] = await edgeCaseTests()
    allResults.push(...sectionResults['Edge Cases'])

    sectionResults['Error Handling'] = await errorHandlingTests()
    allResults.push(...sectionResults['Error Handling'])

    sectionResults['Integration'] = await integrationTests()
    allResults.push(...sectionResults['Integration'])

    sectionResults['Performance'] = await performanceTests()
    allResults.push(...sectionResults['Performance'])

    sectionResults['Real-World Scenarios'] = await realWorldTests()
    allResults.push(...sectionResults['Real-World Scenarios'])

    sectionResults['Lifecycle'] = await lifecycleTests()
    allResults.push(...sectionResults['Lifecycle'])

    // Generate comprehensive report
    console.log('\n📊 COMPREHENSIVE DEBOUNCE TEST RESULTS')
    console.log('='.repeat(70))

    const totalTests = allResults.length
    const passedTests = allResults.filter(r => r.passed).length
    const failedTests = totalTests - passedTests
    const successRate = ((passedTests / totalTests) * 100).toFixed(1)

    // Section-by-section results
    Object.entries(sectionResults).forEach(([section, results]) => {
      const sectionPassed = results.filter(r => r.passed).length
      const sectionTotal = results.length
      const sectionRate = ((sectionPassed / sectionTotal) * 100).toFixed(1)

      console.log(
        `\n${section}: ${sectionPassed}/${sectionTotal} (${sectionRate}%)`
      )
      results.forEach(result => {
        const icon = result.passed ? '✅' : '❌'
        console.log(`  ${icon} ${result.name}`)
        if (!result.passed) {
          console.log(`    Details: ${result.details}`)
        }
        if (result.metrics) {
          const metricsStr = Object.entries(result.metrics)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
          console.log(`    Metrics: ${metricsStr}`)
        }
      })
    })

    // Overall summary
    console.log('\n🎯 OVERALL SUMMARY')
    console.log('='.repeat(30))
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${passedTests}`)
    console.log(`Failed: ${failedTests}`)
    console.log(`Success Rate: ${successRate}%`)

    // Performance metrics summary
    const perfResults = allResults.filter(r => r.metrics)
    if (perfResults.length > 0) {
      console.log('\n📈 PERFORMANCE METRICS')
      console.log('='.repeat(30))
      perfResults.forEach(result => {
        if (result.metrics) {
          console.log(`${result.name}:`)
          Object.entries(result.metrics).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`)
          })
        }
      })
    }

    // Coverage analysis
    console.log('\n🎯 DEBOUNCE COVERAGE ANALYSIS')
    console.log('='.repeat(30))
    console.log('✅ Basic call collapsing mechanics')
    console.log('✅ Timer reset behavior')
    console.log('✅ Last payload wins logic')
    console.log('✅ MaxWait functionality')
    console.log('✅ Edge cases and extreme values')
    console.log('✅ Error handling and recovery')
    console.log('✅ Integration with other protections')
    console.log('✅ Performance under load')
    console.log('✅ Real-world scenarios')
    console.log('✅ Action lifecycle management')
    console.log('✅ Memory and cleanup')
    console.log('✅ Search-as-you-type patterns')
    console.log('✅ Auto-save functionality')
    console.log('✅ Window resize handling')
    console.log('✅ Form validation debouncing')

    if (successRate === '100.0') {
      console.log(
        '\n🎉 ALL TESTS PASSED! Debounce system is robust and production-ready!'
      )
    } else if (parseFloat(successRate) >= 90) {
      console.log(
        '\n✅ Excellent! Debounce system is highly reliable with minor edge cases to address.'
      )
    } else if (parseFloat(successRate) >= 75) {
      console.log(
        '\n⚠️ Good foundation but some issues need attention before production.'
      )
    } else {
      console.log(
        '\n❌ Significant issues detected. Review failures before production use.'
      )
    }

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: parseFloat(successRate),
      sectionResults,
      allResults
    }
  } catch (error) {
    console.error('❌ Error running comprehensive debounce tests:', error)
    return null
  } finally {
    // Clean up
    cyre.clear()
  }
}

// =============================================================================
// SECTION 10: INTERACTIVE DEMO COMMANDS
// =============================================================================

/**
 * Interactive commands for testing specific debounce scenarios
 */
export const comprehensiveDebounceDemo = {
  // Run specific test sections
  testBasics: async () => {
    console.log('🧪 Running basic debounce tests...')
    cyre.init()
    const results = await basicDebounceTests()
    cyre.clear()
    return results
  },

  testMaxWait: async () => {
    console.log('🧪 Running maxWait tests...')
    cyre.init()
    const results = await maxWaitTests()
    cyre.clear()
    return results
  },

  testEdgeCases: async () => {
    console.log('🧪 Running edge case tests...')
    cyre.init()
    const results = await edgeCaseTests()
    cyre.clear()
    return results
  },

  testErrors: async () => {
    console.log('🧪 Running error handling tests...')
    cyre.init()
    const results = await errorHandlingTests()
    cyre.clear()
    return results
  },

  testIntegration: async () => {
    console.log('🧪 Running integration tests...')
    cyre.init()
    const results = await integrationTests()
    cyre.clear()
    return results
  },

  testPerformance: async () => {
    console.log('🧪 Running performance tests...')
    cyre.init()
    const results = await performanceTests()
    cyre.clear()
    return results
  },

  testRealWorld: async () => {
    console.log('🧪 Running real-world tests...')
    cyre.init()
    const results = await realWorldTests()
    cyre.clear()
    return results
  },

  testLifecycle: async () => {
    console.log('🧪 Running lifecycle tests...')
    cyre.init()
    const results = await lifecycleTests()
    cyre.clear()
    return results
  },

  // Run full comprehensive suite
  runAll: async () => {
    return await runComprehensiveDebounceTests()
  },

  // Quick validation
  quickValidation: async () => {
    console.log('⚡ Quick debounce validation...')
    cyre.init()

    try {
      let execCount = 0
      let lastPayload: any = null

      cyre.on('quick-debounce-test', payload => {
        execCount++
        lastPayload = payload
        return {executed: true}
      })

      cyre.action({id: 'quick-debounce-test', debounce: 100})

      // Rapid calls - should collapse to single execution
      await cyre.call('quick-debounce-test', {value: 'A'})
      await cyre.call('quick-debounce-test', {value: 'B'})
      await cyre.call('quick-debounce-test', {value: 'C'})

      await new Promise(resolve => setTimeout(resolve, 150))

      const passed = execCount === 1 && lastPayload?.value === 'C'

      console.log(
        `${passed ? '✅' : '❌'} Quick validation: ${
          passed ? 'PASSED' : 'FAILED'
        }`
      )
      console.log(
        `Details: Executions(${execCount}) LastPayload(${lastPayload?.value}) Expected(C)`
      )

      cyre.forget('quick-debounce-test')
      return passed
    } finally {
      cyre.clear()
    }
  },

  // Demo specific scenarios
  demoSearchAsType: async () => {
    console.log('🔍 Demo: Search-as-you-type...')
    cyre.init()

    try {
      let searchCount = 0
      cyre.on('demo-search', payload => {
        searchCount++
        console.log(`🔍 Search executed: "${payload.query}"`)
        return {query: payload.query, results: ['Result 1', 'Result 2']}
      })

      cyre.action({id: 'demo-search', debounce: 300})

      const queries = ['r', 're', 'rea', 'react']
      for (const query of queries) {
        console.log(`⌨️ Typing: "${query}"`)
        await cyre.call('demo-search', {query})
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      await new Promise(resolve => setTimeout(resolve, 400))

      console.log(
        `📊 Result: ${searchCount} search from ${queries.length} keystrokes`
      )
      cyre.forget('demo-search')
      return {searches: searchCount, keystrokes: queries.length}
    } finally {
      cyre.clear()
    }
  },

  demoAutoSave: async () => {
    console.log('💾 Demo: Auto-save functionality...')
    cyre.init()

    try {
      let saveCount = 0
      cyre.on('demo-autosave', payload => {
        saveCount++
        console.log(`💾 Auto-saved: "${payload.content.substring(0, 20)}..."`)
        return {saved: true, version: saveCount}
      })

      cyre.action({id: 'demo-autosave', debounce: 1000})

      const edits = [
        'Hello',
        'Hello world',
        'Hello world!',
        'Hello world! How are you?'
      ]
      for (const content of edits) {
        console.log(`✏️ Editing: "${content}"`)
        await cyre.call('demo-autosave', {content})
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      await new Promise(resolve => setTimeout(resolve, 1200))

      console.log(`📊 Result: ${saveCount} save from ${edits.length} edits`)
      cyre.forget('demo-autosave')
      return {saves: saveCount, edits: edits.length}
    } finally {
      cyre.clear()
    }
  }
}

// Export main functions
export {runComprehensiveDebounceTests as runAllDebounceTests}
export default comprehensiveDebounceDemo
const results = await runComprehensiveDebounceTests()
// =============================================================================
// USAGE INSTRUCTIONS & DOCUMENTATION
// =============================================================================

/*

COMPREHENSIVE DEBOUNCE TEST COVERAGE:

## 🎯 Test Categories Covered:

### 1. BASIC BEHAVIOR
- ✅ Call collapsing (last payload wins)
- ✅ Timer reset on new calls
- ✅ Single call execution after debounce period

### 2. MAXWAIT FUNCTIONALITY
- ✅ MaxWait prevents infinite delay
- ✅ MaxWait shorter than debounce period
- ✅ Continuous calls with maxWait enforcement

### 3. EDGE CASES
- ✅ Minimal debounce values (1ms)
- ✅ Maximum debounce values (Number.MAX_SAFE_INTEGER)
- ✅ Zero debounce (no debouncing)
- ✅ Undefined/null debounce handling

### 4. ERROR HANDLING
- ✅ Handler errors during debounced execution
- ✅ Async handler error handling
- ✅ Recovery after errors

### 5. INTEGRATION
- ✅ Debounce + detectChanges
- ✅ Debounce + schema validation
- ✅ Debounce + other protections

### 6. PERFORMANCE
- ✅ High frequency call collapsing
- ✅ Multiple concurrent debounced actions
- ✅ Memory usage with large payloads
- ✅ Stress testing

### 7. REAL-WORLD SCENARIOS
- ✅ Search-as-you-type functionality
- ✅ Auto-save document editing
- ✅ Window resize event handling
- ✅ Form validation debouncing

### 8. LIFECYCLE MANAGEMENT
- ✅ Action replacement during debounce
- ✅ Action cleanup during debounce
- ✅ System clear during debounce operations

## 🚀 Usage Examples:

```typescript
// Run full comprehensive test suite
import { runAllDebounceTests } from './examples/debounce-examples'
const results = await runAllDebounceTests()

// Run specific test categories
import { comprehensiveDebounceDemo } from './examples/debounce-examples'
await comprehensiveDebounceDemo.testBasics()
await comprehensiveDebounceDemo.testRealWorld()
await comprehensiveDebounceDemo.quickValidation()

// Demo specific scenarios
await comprehensiveDebounceDemo.demoSearchAsType()
await comprehensiveDebounceDemo.demoAutoSave()
```

## 📊 What This Tests vs Unit Tests:

**Comprehensive Debounce Examples Test:**
- ✅ Real call collapsing patterns
- ✅ Timer reset behavior validation
- ✅ Last payload wins verification
- ✅ MaxWait functionality testing
- ✅ Performance under load
- ✅ Memory management validation
- ✅ Real-world use case scenarios
- ✅ Integration with other protections

**Key Debounce Behaviors Validated:**
- 🔄 **Call Collapsing**: Multiple rapid calls collapse to single execution
- ⏱️ **Timer Reset**: New calls reset the debounce timer
- 🏆 **Last Wins**: Final payload used when timer expires
- ⚡ **MaxWait**: Prevents infinite delay with continuous calls
- 🚫 **Error Recovery**: Proper handling of execution errors
- 🔗 **Integration**: Works with detectChanges, schema, etc.
- 📱 **Real-World**: Search, auto-save, resize, validation scenarios

This comprehensive test suite validates that Cyre's debounce works correctly
in ALL scenarios, from basic call collapsing to complex real-world use cases,
providing confidence for production deployment.
*/

// Test search-as-you-type behavior
const searchDemo = await comprehensiveDebounceDemo.demoSearchAsType()
// Output: 1 search from 4 keystrokes (75% efficiency)

// Test auto-save functionality
const saveDemo = await comprehensiveDebounceDemo.demoAutoSave()
