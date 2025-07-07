// demo/silent-failure-scenarios.ts
// Testing potential silent failure scenarios in Cyre

import {cyre} from '../src'

/*

      S.I.L.E.N.T - F.A.I.L.U.R.E - T.E.S.T.S
      
      Testing scenarios where calls might silently fail:
      - Duplicate .action() registrations
      - Duplicate .on() registrations  
      - Race conditions
      - Handler replacement scenarios
      - Memory leaks from duplicates

*/

const test = async (
  name: string,
  fn: () => Promise<{success: boolean; details: any}>
): Promise<void> => {
  try {
    const {success, details} = await fn()
    console.log(`${success ? '✅' : '❌'} ${name}`)
    if (details) {
      console.log(`   📋 ${JSON.stringify(details)}`)
    }
  } catch (error) {
    console.log(`💥 ${name} - Exception: ${error}`)
  }
}

export const silentFailureTest = async (): Promise<void> => {
  console.log('🔍 Silent Failure Scenarios Test')
  console.log('================================\n')

  await cyre.init()

  // Test 1: Duplicate .action() registration
  await test('Duplicate .action() registration', async () => {
    // First registration
    const result1 = cyre.action({
      id: 'duplicate-action-test',
      payload: {version: 1}
    })

    // Second registration (should this overwrite or fail?)
    const result2 = cyre.action({
      id: 'duplicate-action-test',
      payload: {version: 2}
    })

    // Check which version is active
    const channel = cyre.get('duplicate-action-test')

    return {
      success: result1.ok && result2.ok,
      details: {
        first: result1.ok,
        second: result2.ok,
        activeVersion: channel?.payload?.version,
        messages: [result1.message, result2.message]
      }
    }
  })

  // Test 2: Duplicate .on() registration behavior
  await test('Duplicate .on() registration behavior', async () => {
    cyre.action({id: 'duplicate-handler-test'})

    let handler1Calls = 0
    let handler2Calls = 0

    // First handler
    const sub1 = cyre.on('duplicate-handler-test', () => {
      handler1Calls++
      return {handler: 1, calls: handler1Calls}
    })

    // Second handler (should warn but what actually happens?)
    const sub2 = cyre.on('duplicate-handler-test', () => {
      handler2Calls++
      return {handler: 2, calls: handler2Calls}
    })

    // Make a call - which handler runs?
    const result = await cyre.call('duplicate-handler-test', {test: true})

    return {
      success: true, // Always succeeds for observation
      details: {
        sub1: sub1.ok,
        sub2: sub2.ok,
        handler1Calls,
        handler2Calls,
        resultFrom: result.payload?.handler,
        whichHandlerRan:
          handler1Calls > 0 ? 'first' : handler2Calls > 0 ? 'second' : 'none'
      }
    }
  })

  // Test 3: Handler replacement scenario
  await test('Handler replacement scenario', async () => {
    cyre.action({id: 'replacement-test'})

    // First handler
    cyre.on('replacement-test', () => ({version: 'original'}))

    // Call with original handler
    const result1 = await cyre.call('replacement-test')

    // "Replace" handler (actually duplicate)
    cyre.on('replacement-test', () => ({version: 'replacement'}))

    // Call again - which version runs?
    const result2 = await cyre.call('replacement-test')

    return {
      success: true,
      details: {
        originalResult: result1.payload?.version,
        afterReplacementResult: result2.payload?.version,
        wasReplaced: result1.payload?.version !== result2.payload?.version
      }
    }
  })

  // Test 4: Race condition with rapid registration
  await test('Race condition with rapid registration', async () => {
    const channelId = 'race-condition-test'

    // Rapid fire registration attempts
    const promises = Array.from({length: 10}, (_, i) =>
      Promise.resolve().then(() => {
        const actionResult = cyre.action({id: channelId, payload: {attempt: i}})
        const handlerResult = cyre.on(channelId, () => ({handlerAttempt: i}))
        return {actionResult, handlerResult, attempt: i}
      })
    )

    const results = await Promise.all(promises)

    // Test which one "won"
    const finalCall = await cyre.call(channelId)

    return {
      success: true,
      details: {
        registrationAttempts: results.length,
        successfulActions: results.filter(r => r.actionResult.ok).length,
        successfulHandlers: results.filter(r => r.handlerResult.ok).length,
        finalHandlerAttempt: finalCall.payload?.handlerAttempt,
        finalPayload: cyre.get(channelId)?.payload?.attempt
      }
    }
  })

  // Test 5: Silent overwrite detection
  await test('Silent overwrite detection', async () => {
    const channelId = 'overwrite-detection'

    // Create original
    cyre.action({id: channelId, payload: {original: true}})
    cyre.on(channelId, () => ({response: 'original'}))

    const originalCall = await cyre.call(channelId)

    // Store original state
    const originalChannel = JSON.stringify(cyre.get(channelId))

    // Attempt "overwrite"
    cyre.action({id: channelId, payload: {original: false, overwritten: true}})
    cyre.on(channelId, () => ({response: 'overwritten'}))

    const overwriteCall = await cyre.call(channelId)
    const newChannel = JSON.stringify(cyre.get(channelId))

    return {
      success: true,
      details: {
        originalResponse: originalCall.payload?.response,
        overwriteResponse: overwriteCall.payload?.response,
        channelChanged: originalChannel !== newChannel,
        silentOverwrite:
          originalCall.payload?.response === overwriteCall.payload?.response
      }
    }
  })

  // Test 6: Memory leak from duplicate registrations
  await test('Memory leak from duplicates', async () => {
    const initialMetrics = cyre.getMetrics()
    const initialChannels = initialMetrics?.stores?.channels || 0
    const initialSubscribers = initialMetrics?.stores?.subscribers || 0

    // Create many duplicates
    for (let i = 0; i < 50; i++) {
      cyre.action({id: 'memory-leak-test', payload: {iteration: i}})
      cyre.on('memory-leak-test', () => ({iteration: i}))
    }

    const finalMetrics = cyre.getMetrics()
    const finalChannels = finalMetrics?.stores?.channels || 0
    const finalSubscribers = finalMetrics?.stores?.subscribers || 0

    return {
      success: true,
      details: {
        channelsBefore: initialChannels,
        channelsAfter: finalChannels,
        channelsLeaked: finalChannels - initialChannels,
        subscribersBefore: initialSubscribers,
        subscribersAfter: finalSubscribers,
        subscribersLeaked: finalSubscribers - initialSubscribers,
        expectedLeaks: {channels: 1, subscribers: 1},
        actualLeaks: {
          channels: finalChannels - initialChannels,
          subscribers: finalSubscribers - initialSubscribers
        }
      }
    }
  })

  // Test 7: Forgotten channel still callable?
  await test('Forgotten channel resurrection', async () => {
    const channelId = 'resurrection-test'

    // Create and verify
    cyre.action({id: channelId})
    cyre.on(channelId, () => ({status: 'alive'}))

    const aliveCall = await cyre.call(channelId)

    // Forget it
    const forgotten = cyre.forget(channelId)

    // Try to call (should fail)
    const deadCall = await cyre.call(channelId)

    // Recreate with same ID
    cyre.action({id: channelId})
    cyre.on(channelId, () => ({status: 'resurrected'}))

    // Call again (should work)
    const resurrectCall = await cyre.call(channelId)

    return {
      success: true,
      details: {
        aliveResult: aliveCall.ok,
        forgotten: forgotten,
        deadResult: deadCall.ok,
        resurrectResult: resurrectCall.ok,
        resurrectStatus: resurrectCall.payload?.status,
        silentResurrection: deadCall.ok // This would be concerning
      }
    }
  })

  // Test 8: Cross-contamination between similar IDs
  await test('Cross-contamination between similar IDs', async () => {
    // Similar but different IDs
    const ids = [
      'test-channel',
      'test-channel-2',
      'test_channel',
      'testchannel'
    ]

    // Create each with unique handlers
    ids.forEach((id, index) => {
      cyre.action({id})
      cyre.on(id, () => ({channelIndex: index, id}))
    })

    // Call each and verify isolation
    const results = await Promise.all(
      ids.map(async (id, index) => {
        const result = await cyre.call(id)
        return {
          id,
          expectedIndex: index,
          actualIndex: result.payload?.channelIndex,
          contaminated: result.payload?.channelIndex !== index
        }
      })
    )

    const contaminated = results.filter(r => r.contaminated)

    return {
      success: contaminated.length === 0,
      details: {
        totalChannels: ids.length,
        contaminatedChannels: contaminated.length,
        contaminations: contaminated,
        allIsolated: contaminated.length === 0
      }
    }
  })

  console.log('\n📊 Analysis Summary:')
  console.log('===================')
  console.log('Check the logs above for potential silent failure patterns:')
  console.log('• Duplicate actions: Do they overwrite or accumulate?')
  console.log('• Duplicate handlers: Which one actually runs?')
  console.log('• Memory leaks: Are old registrations cleaned up?')
  console.log('• Race conditions: Is registration atomic?')
  console.log('• Silent overwrites: Are users warned of conflicts?')

  console.log('\n✨ Silent failure analysis completed!')
}

// Run the test
silentFailureTest().catch(console.error)
