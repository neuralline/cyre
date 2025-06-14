// benchmark/throttle-investigation.ts
// File location: /benchmark/throttle-investigation.ts

/**
 * Throttle Investigation
 *
 * Deep dive into Cyre's throttling mechanism:
 * 1. Is throttling working at all?
 * 2. How does it handle rapid calls?
 * 3. What's the actual behavior vs expected?
 * 4. Check different throttle configurations
 */

import {cyre} from '../src'

class ThrottleInvestigation {
  /**
   * Test 1: Basic Throttle Test
   * Simplest possible throttle scenario
   */
  async testBasicThrottle(): Promise<void> {
    console.log('\n🔍 Test 1: Basic Throttle Investigation')
    console.log('='.repeat(60))

    let processedCount = 0
    let successCount = 0
    let errorCount = 0
    const results: any[] = []

    // Setup simple throttled action
    console.log('Setting up throttled action (500ms throttle)...')
    cyre.action({
      id: 'basic-throttle-test',
      throttle: 500, // 500ms throttle
      payload: {test: 'basic'}
    })

    cyre.on('basic-throttle-test', (payload: any) => {
      processedCount++
      console.log(
        `   ✅ Handler executed: call ${payload.callNumber} (total processed: ${processedCount})`
      )
      return {
        callNumber: payload.callNumber,
        processed: true,
        timestamp: Date.now()
      }
    })

    console.log('\n🔥 Firing 5 calls rapidly (0ms apart):')

    // Fire calls with precise timing
    for (let i = 1; i <= 5; i++) {
      const callStart = performance.now()

      try {
        const result = await cyre.call('basic-throttle-test', {
          callNumber: i,
          timestamp: Date.now()
        })

        successCount++
        const callDuration = performance.now() - callStart

        results.push({
          callNumber: i,
          success: true,
          duration: callDuration,
          result: result
        })

        console.log(`   🔥 Call ${i}: SUCCESS (${callDuration.toFixed(2)}ms)`)
      } catch (error) {
        errorCount++
        const callDuration = performance.now() - callStart
        const errorMsg = error instanceof Error ? error.message : String(error)

        results.push({
          callNumber: i,
          success: false,
          duration: callDuration,
          error: errorMsg
        })

        console.log(
          `   ❌ Call ${i}: ERROR - ${errorMsg} (${callDuration.toFixed(2)}ms)`
        )
      }

      // No delay between calls - fire as fast as possible
    }

    // Wait a bit to see if any delayed processing happens
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log(`\n📊 Basic Throttle Results:`)
    console.log(`   Calls made: 5`)
    console.log(`   Successful calls: ${successCount}`)
    console.log(`   Error calls: ${errorCount}`)
    console.log(`   Handler executions: ${processedCount}`)
    console.log(`   Expected behavior: 1 success, 4 throttled`)
    console.log(
      `   Actual behavior: ${successCount} success, ${errorCount} throttled`
    )

    if (errorCount === 0) {
      console.log(`   🚨 ISSUE: No throttling detected!`)
    } else {
      console.log(`   ✅ Throttling working correctly`)
    }
  }

  /**
   * Test 2: Throttle with Delays
   * Test throttle behavior with various delays
   */
  async testThrottleWithDelays(): Promise<void> {
    console.log('\n⏰ Test 2: Throttle with Different Delays')
    console.log('='.repeat(60))

    let processedCount = 0
    const results: any[] = []

    cyre.action({
      id: 'delayed-throttle-test',
      throttle: 1000, // 1 second throttle
      payload: {test: 'delayed'}
    })

    cyre.on('delayed-throttle-test', (payload: any) => {
      processedCount++
      console.log(`   ✅ Processed call ${payload.callNumber} at ${Date.now()}`)
      return {callNumber: payload.callNumber, processed: true}
    })

    const delays = [0, 200, 500, 800, 1200] // Various delays

    console.log('\n🔥 Testing calls with different delays:')

    const startTime = Date.now()

    for (let i = 0; i < delays.length; i++) {
      const delay = delays[i]

      // Wait for the specified delay
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      const callTime = Date.now() - startTime
      console.log(
        `   🔥 Firing call ${i + 1} at ${callTime}ms (delay: ${delay}ms)`
      )

      try {
        const result = await cyre.call('delayed-throttle-test', {
          callNumber: i + 1,
          delay: delay,
          callTime: callTime
        })

        results.push({callNumber: i + 1, success: true, delay, callTime})
        console.log(`   ✅ Call ${i + 1}: SUCCESS`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.push({
          callNumber: i + 1,
          success: false,
          delay,
          callTime,
          error: errorMsg
        })
        console.log(`   ❌ Call ${i + 1}: THROTTLED - ${errorMsg}`)
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500))

    console.log(`\n📊 Delayed Throttle Results:`)
    console.log(`   Total calls: ${delays.length}`)
    console.log(`   Handler executions: ${processedCount}`)

    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(
        `   ${status} Call ${result.callNumber} (${result.delay}ms delay): ${
          result.success ? 'SUCCESS' : result.error
        }`
      )
    })

    // Analyze expected vs actual
    const expectedSuccessful = delays.filter((delay, index) => {
      if (index === 0) return true // First call always succeeds
      const timeSinceFirst = delays
        .slice(0, index + 1)
        .reduce((sum, d) => sum + d, 0)
      return timeSinceFirst >= 1000 // Should succeed if > 1000ms since last success
    }).length

    const actualSuccessful = results.filter(r => r.success).length

    console.log(`   Expected successful: ${expectedSuccessful}`)
    console.log(`   Actually successful: ${actualSuccessful}`)

    if (actualSuccessful !== expectedSuccessful) {
      console.log(`   🚨 Throttling behavior doesn't match expected!`)
    }
  }

  /**
   * Test 3: Check Cyre Internal State
   * Inspect what Cyre thinks about throttling
   */
  async testInternalState(): Promise<void> {
    console.log('\n🔬 Test 3: Cyre Internal State Inspection')
    console.log('='.repeat(60))

    // Setup action and check its properties
    cyre.action({
      id: 'state-inspection-test',
      throttle: 2000,
      payload: {inspection: true}
    })

    cyre.on('state-inspection-test', (payload: any) => {
      console.log(`   ✅ Handler called for: ${payload.test}`)
      return {processed: true}
    })

    // Try to inspect action configuration
    try {
      const action = cyre.get('state-inspection-test')

      if (action) {
        console.log('\n🔍 Action Configuration:')
        console.log(`   ID: ${action.id}`)
        console.log(`   Throttle: ${action.throttle || 'undefined'}`)
        console.log(
          `   Has throttle property: ${action.hasOwnProperty('throttle')}`
        )
        console.log(`   Payload: ${JSON.stringify(action.payload)}`)

        // Check for internal throttle state
        console.log(`\n🔍 Internal Properties:`)
        Object.keys(action).forEach(key => {
          if (key.includes('throttle') || key.includes('_')) {
            console.log(`   ${key}: ${(action as any)[key]}`)
          }
        })
      } else {
        console.log('   ❌ Could not retrieve action configuration')
      }
    } catch (error) {
      console.log(`   ❌ Error inspecting action: ${error}`)
    }

    // Try to get metrics
    try {
      const metrics = cyre.getMetrics('state-inspection-test')
      if (metrics) {
        console.log('\n📊 Action Metrics:')
        console.log(`   ${JSON.stringify(metrics, null, 2)}`)
      }
    } catch (error) {
      console.log(`   ⚠️ No metrics available: ${error}`)
    }

    // Test actual call
    console.log('\n🔥 Testing call with inspection:')
    try {
      await cyre.call('state-inspection-test', {test: 'inspection-call'})
      console.log('   ✅ Call succeeded')
    } catch (error) {
      console.log(`   ❌ Call failed: ${error}`)
    }
  }

  /**
   * Test 4: Multiple Channels Throttle Independence
   * Verify throttling is per-channel
   */
  async testMultiChannelThrottle(): Promise<void> {
    console.log('\n🎭 Test 4: Multi-Channel Throttle Independence')
    console.log('='.repeat(60))

    let channel1Processed = 0
    let channel2Processed = 0

    // Setup two channels with same throttle settings
    cyre.action({id: 'throttle-channel-1', throttle: 1000})
    cyre.action({id: 'throttle-channel-2', throttle: 1000})

    cyre.on('throttle-channel-1', (payload: any) => {
      channel1Processed++
      console.log(`   ✅ Channel 1: processed call ${payload.callNumber}`)
      return {channel: 1, processed: true}
    })

    cyre.on('throttle-channel-2', (payload: any) => {
      channel2Processed++
      console.log(`   ✅ Channel 2: processed call ${payload.callNumber}`)
      return {channel: 2, processed: true}
    })

    console.log('\n🔥 Firing rapid calls to both channels:')

    // Fire calls to both channels rapidly
    const promises: Promise<any>[] = []

    for (let i = 1; i <= 3; i++) {
      console.log(`   🔥 Firing to both channels: call ${i}`)

      promises.push(
        cyre
          .call('throttle-channel-1', {callNumber: i, channel: 1})
          .catch(error => ({error: error.message, channel: 1, callNumber: i}))
      )

      promises.push(
        cyre
          .call('throttle-channel-2', {callNumber: i, channel: 2})
          .catch(error => ({error: error.message, channel: 2, callNumber: i}))
      )
    }

    const results = await Promise.all(promises)
    await new Promise(resolve => setTimeout(resolve, 500))

    console.log(`\n📊 Multi-Channel Results:`)
    console.log(`   Channel 1 processed: ${channel1Processed}`)
    console.log(`   Channel 2 processed: ${channel2Processed}`)
    console.log(`   Expected: 1 each (independent throttling)`)

    results.forEach((result, index) => {
      const channelNum = Math.floor(index / 2) + 1
      const isError = result.error
      console.log(
        `   ${isError ? '❌' : '✅'} Channel ${result.channel || channelNum}: ${
          isError ? result.error : 'SUCCESS'
        }`
      )
    })

    if (channel1Processed === 1 && channel2Processed === 1) {
      console.log(`   ✅ Channels are independently throttled`)
    } else {
      console.log(`   🚨 Unexpected throttling behavior across channels`)
    }
  }

  async runThrottleInvestigation(): Promise<void> {
    console.log('🕵️ Throttle Investigation')
    console.log('Deep dive into Cyre throttling mechanism')
    console.log('='.repeat(70))

    try {
      await this.testBasicThrottle()
      await this.testThrottleWithDelays()
      await this.testInternalState()
      await this.testMultiChannelThrottle()

      console.log('\n✅ Throttle investigation completed!')
      console.log('\n🎯 This investigation reveals the current state')
      console.log("   of Cyre's throttling implementation.")
    } catch (error) {
      console.error('❌ Throttle investigation failed:', error)
    }
  }
}

// Export for use
export {ThrottleInvestigation}

// Run if executed directly
const investigation = new ThrottleInvestigation()
investigation.runThrottleInvestigation().catch(console.error)
