// demo/buffer-strategy-test.ts
// Simple test to verify buffer strategies work correctly

import {cyre} from '../src/index'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const testBufferStrategy = async (
  strategyName: string,
  bufferConfig: any,
  inputCalls: string[],
  expectedHandlerCalls: number
) => {
  console.log(`\n🧪 Testing Buffer Strategy: ${strategyName}`)

  let handlerCallCount = 0
  let receivedPayloads: any[] = []

  // Setup channel
  cyre.action({
    id: 'buffer-strategy-test',
    buffer: bufferConfig
  })

  // Setup handler to track calls
  cyre.on('buffer-strategy-test', payload => {
    handlerCallCount++
    receivedPayloads.push(payload)
    console.log(`  📞 Handler called #${handlerCallCount} with:`, payload)
    return {processed: payload, handlerCall: handlerCallCount}
  })

  // Make rapid calls
  console.log(`  📤 Making ${inputCalls.length} rapid calls...`)
  const responses = []
  for (const call of inputCalls) {
    const response = await cyre.call('buffer-strategy-test', call)
    responses.push(response)
    console.log(`    → Call "${call}": ${response.message}`)
    await delay(10) // Small delay between calls
  }

  // Wait for buffer to execute
  const waitTime = (bufferConfig.window || 200) + 50
  console.log(`  ⏳ Waiting ${waitTime}ms for buffer execution...`)
  await delay(waitTime)

  // Check results
  console.log(`  📊 Results:`)
  console.log(
    `    Handler called: ${handlerCallCount} times (expected: ${expectedHandlerCalls})`
  )
  console.log(`    Received payloads:`, receivedPayloads)
  console.log(
    `    Success: ${handlerCallCount === expectedHandlerCalls ? '✅' : '❌'}`
  )

  // Cleanup
  cyre.forget('buffer-strategy-test')

  return {
    strategy: strategyName,
    handlerCallCount,
    receivedPayloads,
    responses,
    success: handlerCallCount === expectedHandlerCalls
  }
}

export const runBufferStrategyTests = async () => {
  console.log('🚀 Buffer Strategy Tests\n')

  await cyre.init()

  const results = []

  // Test 1: Append Strategy
  results.push(
    await testBufferStrategy(
      'Append Strategy',
      {window: 200, strategy: 'append'},
      ['call1', 'call2', 'call3'],
      1 // Should batch all calls into one execution
    )
  )

  // Test 2: Overwrite Strategy
  results.push(
    await testBufferStrategy(
      'Overwrite Strategy',
      {window: 200, strategy: 'overwrite'},
      ['call1', 'call2', 'call3'],
      1 // Should execute once with latest call
    )
  )

  // Test 3: Ignore Strategy
  results.push(
    await testBufferStrategy(
      'Ignore Strategy',
      {window: 200, strategy: 'ignore'},
      ['call1', 'call2', 'call3'],
      1 // Should execute once with first call
    )
  )

  // Test 4: Append with MaxSize
  results.push(
    await testBufferStrategy(
      'Append with MaxSize',
      {window: 500, strategy: 'append', maxSize: 2},
      ['call1', 'call2', 'call3'],
      2 // Should execute when maxSize reached, then again for remaining
    )
  )

  // Test 5: Simple Buffer (default overwrite)
  results.push(
    await testBufferStrategy(
      'Simple Buffer (default)',
      {window: 200},
      ['call1', 'call2', 'call3'],
      1 // Should execute once with latest
    )
  )

  // Summary
  console.log('\n📊 BUFFER STRATEGY TEST SUMMARY')
  console.log('='.repeat(50))

  const successCount = results.filter(r => r.success).length
  console.log(`✅ Passed: ${successCount}/${results.length} tests`)

  results.forEach(result => {
    const status = result.success ? '✅' : '❌'
    console.log(
      `${status} ${result.strategy}: ${result.handlerCallCount} handler calls`
    )
    if (!result.success) {
      console.log(`   Expected behavior not achieved`)
    }
  })

  if (successCount === results.length) {
    console.log('\n🎉 All buffer strategies working correctly!')
  } else {
    console.log('\n⚠️  Some buffer strategies need fixes')
  }

  return results
}

// Run if called directly
runBufferStrategyTests().catch(console.error)
