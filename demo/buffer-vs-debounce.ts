// demo/buffer-vs-debounce.test.ts
// Comprehensive test for buffer vs debounce behavior and req/res saving

import {cyre} from '../src/index'

interface TestResult {
  name: string
  handlerExecutions: number
  finalState: any
  callResponses: any[]
  executionTimes: number[]
  memoryUsage: number
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const runProtectionTest = async (
  testName: string,
  actionConfig: any,
  callSequence: any[],
  timingMs: number[]
): Promise<TestResult> => {
  let handlerExecutions = 0
  const callResponses: any[] = []
  const executionTimes: number[] = []
  const memoryStart = process.memoryUsage?.()?.heapUsed || 0

  console.log(`\n🧪 Testing: ${testName}`)

  // Setup channel
  cyre.action({
    id: 'test-channel',
    ...actionConfig
  })

  // Track handler executions
  cyre.on('test-channel', payload => {
    handlerExecutions++
    const executionTime = Date.now()
    executionTimes.push(executionTime)
    console.log(`  📞 Handler executed #${handlerExecutions} with:`, payload)
    return {processed: payload, handlerCount: handlerExecutions}
  })

  // Execute call sequence with timing
  for (let i = 0; i < callSequence.length; i++) {
    const payload = callSequence[i]
    const response = await cyre.call('test-channel', payload)
    callResponses.push(response)
    console.log(`  📤 Call #${i + 1}:`, payload, '→', response.message)

    // Wait specified time before next call
    if (i < timingMs.length) {
      await delay(timingMs[i])
    }
  }

  // Wait for any pending executions
  await delay(
    Math.max(actionConfig.buffer?.window || 0, actionConfig.debounce || 0) + 50
  )

  // Check final state
  const finalState = cyre.get('test-channel')
  console.log(`  📊 Final State:`, finalState)
  console.log(`  📈 Handler Executions: ${handlerExecutions}`)

  const memoryEnd = process.memoryUsage?.()?.heapUsed || 0
  const memoryUsage = (memoryEnd - memoryStart) / 1024 / 1024 // MB

  // Cleanup
  cyre.forget('test-channel')

  return {
    name: testName,
    handlerExecutions,
    finalState,
    callResponses,
    executionTimes,
    memoryUsage
  }
}

export const testBufferVsDebounce = async () => {
  console.log('🚀 Buffer vs Debounce Comprehensive Test\n')

  await cyre.init()
  const results: TestResult[] = []

  // TEST 1: Buffer with Append Strategy
  results.push(
    await runProtectionTest(
      'Buffer 200ms - Append Strategy',
      {
        buffer: {window: 200, strategy: 'append'}
      },
      ['call1', 'call2', 'call3'],
      [50, 50] // Rapid calls within window
    )
  )

  // TEST 2: Buffer with Overwrite Strategy
  results.push(
    await runProtectionTest(
      'Buffer 200ms - Overwrite Strategy',
      {
        buffer: {window: 200, strategy: 'overwrite'}
      },
      ['call1', 'call2', 'call3'],
      [50, 50] // Rapid calls within window
    )
  )

  // TEST 3: Debounce Standard
  results.push(
    await runProtectionTest(
      'Debounce 200ms - Standard',
      {
        debounce: 200
      },
      ['call1', 'call2', 'call3'],
      [50, 50] // Rapid calls - should collapse to one
    )
  )

  // TEST 4: Debounce with MaxWait
  results.push(
    await runProtectionTest(
      'Debounce 200ms - MaxWait 300ms',
      {
        debounce: 200,
        maxWait: 300
      },
      ['call1', 'call2', 'call3'],
      [100, 100] // Should trigger maxWait
    )
  )

  // TEST 5: Fast Path (No Protections)
  results.push(
    await runProtectionTest(
      'Fast Path - No Protections',
      {
        // No protections = fast path
      },
      ['call1', 'call2', 'call3'],
      [10, 10] // Fast consecutive calls
    )
  )

  // TEST 6: Pipeline vs Protection Performance
  results.push(
    await runProtectionTest(
      'Pipeline + Buffer',
      {
        transform: (payload: any) => ({...payload, transformed: true}),
        buffer: {window: 200, strategy: 'append'}
      },
      ['call1', 'call2', 'call3'],
      [50, 50]
    )
  )

  results.push(
    await runProtectionTest(
      'Pipeline + Debounce',
      {
        transform: (payload: any) => ({...payload, transformed: true}),
        debounce: 200
      },
      ['call1', 'call2', 'call3'],
      [50, 50]
    )
  )

  // Generate comparison report
  generateComparisonReport(results)

  return results
}

const generateComparisonReport = (results: TestResult[]) => {
  console.log('\n📊 BUFFER vs DEBOUNCE COMPARISON REPORT')
  console.log('='.repeat(80))

  results.forEach(result => {
    console.log(`\n${result.name}:`)
    console.log(`  Handler Executions: ${result.handlerExecutions}`)
    console.log(`  Memory Usage: ${result.memoryUsage.toFixed(2)}MB`)
    console.log(`  Call Responses: ${result.callResponses.length}`)
    console.log(`  Final State Available: ${!!result.finalState}`)

    if (result.finalState) {
      console.log(`  Final req: ${JSON.stringify(result.finalState.req)}`)
      console.log(`  Final res: ${JSON.stringify(result.finalState.res)}`)
    }
  })

  // Key insights
  console.log('\n🔍 KEY INSIGHTS')
  console.log('='.repeat(50))

  const bufferResults = results.filter(r => r.name.includes('Buffer'))
  const debounceResults = results.filter(r => r.name.includes('Debounce'))
  const fastPathResult = results.find(r => r.name.includes('Fast Path'))

  if (bufferResults.length > 0) {
    const avgBufferExecs =
      bufferResults.reduce((sum, r) => sum + r.handlerExecutions, 0) /
      bufferResults.length
    console.log(`📦 Buffer Average Executions: ${avgBufferExecs}`)
  }

  if (debounceResults.length > 0) {
    const avgDebounceExecs =
      debounceResults.reduce((sum, r) => sum + r.handlerExecutions, 0) /
      debounceResults.length
    console.log(`⏱️  Debounce Average Executions: ${avgDebounceExecs}`)
  }

  if (fastPathResult) {
    console.log(`🏎️  Fast Path Executions: ${fastPathResult.handlerExecutions}`)
  }

  // Memory comparison
  const avgMemoryUsage =
    results.reduce((sum, r) => sum + r.memoryUsage, 0) / results.length
  console.log(`💾 Average Memory Usage: ${avgMemoryUsage.toFixed(2)}MB`)

  // State consistency check
  const stateIssues = results.filter(r => !r.finalState).length
  if (stateIssues > 0) {
    console.log(`⚠️  State Issues: ${stateIssues} tests had no final state`)
  } else {
    console.log(`✅ State Consistency: All tests saved req/res properly`)
  }
}

// Specific req/res saving test
export const testReqResSaving = async () => {
  console.log('\n🔍 REQ/RES SAVING TEST')
  console.log('='.repeat(40))

  await cyre.init()

  // Test different execution paths
  const testCases = [
    {name: 'Fast Path', config: {}},
    {name: 'Buffer', config: {buffer: {window: 100}}},
    {name: 'Debounce', config: {debounce: 100}},
    {
      name: 'Pipeline',
      config: {transform: (p: any) => ({...p, processed: true})}
    }
  ]

  for (const testCase of testCases) {
    console.log(`\n📝 Testing ${testCase.name} req/res saving...`)

    // Setup
    cyre.action({
      id: 'req-res-test',
      ...testCase.config
    })

    cyre.on('req-res-test', payload => {
      return {handlerResult: `processed-${payload.data}`}
    })

    // Make call
    const response = await cyre.call('req-res-test', {data: 'test'})

    // Wait for any async operations
    await delay(150)

    // Check state
    const state = cyre.get('req-res-test')

    console.log(`  Response:`, response)
    console.log(`  State:`, state)

    // Validate
    const hasReq = state && state.req !== undefined
    const hasRes = state && state.res !== undefined

    console.log(`  ✅ req saved: ${hasReq}`)
    console.log(`  ✅ res saved: ${hasRes}`)

    if (!hasReq || !hasRes) {
      console.log(`  ⚠️  ${testCase.name} missing req or res!`)
    }

    // Cleanup
    cyre.forget('req-res-test')
  }
}

// Export test runners
export const runBothTests = async () => {
  await testBufferVsDebounce()
  await testReqResSaving()

  console.log('\n✅ All tests completed!')
}

// Run if called directly
runBothTests().catch(console.error)
