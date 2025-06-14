// benchmark/extreme-bottleneck-test.ts
// File location: /benchmark/extreme-bottleneck-test.ts

/**
 * Extreme Bottleneck Test
 *
 * Push Cyre's single-file architecture to its limits:
 * 1. Aggressive throttling with rapid fire
 * 2. Slow handlers blocking channel
 * 3. Mixed fast/slow operations on same channel
 * 4. True interval constraints
 */

import {cyre} from '../src'

class ExtremeBottleneckTest {
  /**
   * Test 1: Aggressive Throttling
   * Force throttle conflicts with rapid operations
   */
  async testAggressiveThrottling(): Promise<void> {
    console.log('\n🚨 Test 1: Aggressive Throttling (Force Conflicts)')
    console.log('='.repeat(60))

    let processed = 0
    let throttled = 0
    const results: any[] = []

    // Very aggressive throttling
    cyre.action({
      id: 'aggressive-throttle-test',
      throttle: 2000, // 2 second throttle
      payload: {test: 'throttle'}
    })

    cyre.on('aggressive-throttle-test', (payload: any) => {
      processed++
      console.log(
        `   ✅ Processed: ${payload.table}-${payload.id} (${processed})`
      )
      return {processed: true, table: payload.table, id: payload.id}
    })

    console.log('\n🔥 Firing 10 operations rapidly (should hit throttle):')

    // Fire operations very rapidly (no delays)
    for (let i = 0; i < 10; i++) {
      const table = i % 2 === 0 ? 'apple' : 'orange'

      try {
        const result = await cyre.call('aggressive-throttle-test', {
          table: table,
          id: i,
          urgent: i < 3, // First 3 are urgent
          timestamp: Date.now()
        })

        results.push({table, id: i, success: true, result})
        console.log(`   🔥 Fired: ${table}-${i} - SUCCESS`)
      } catch (error) {
        throttled++
        results.push({
          table,
          id: i,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        console.log(
          `   ❌ Fired: ${table}-${i} - THROTTLED: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }

      // No delay - fire as fast as possible
    }

    console.log(`\n📊 Aggressive Throttling Results:`)
    console.log(`   Operations fired: 10`)
    console.log(`   Successfully processed: ${processed}`)
    console.log(`   Throttled/blocked: ${throttled}`)
    console.log(`   Success rate: ${((processed / 10) * 100).toFixed(1)}%`)

    if (throttled === 0) {
      console.log(
        `   🤔 No throttling detected - Cyre might be handling this differently`
      )
    } else {
      console.log(`   ✅ Throttling working as expected`)
    }
  }

  /**
   * Test 2: Slow Handler Blocking
   * Show how one slow operation blocks the entire channel
   */
  async testSlowHandlerBlocking(): Promise<void> {
    console.log('\n🐌 Test 2: Slow Handler Blocking Channel')
    console.log('='.repeat(60))

    let fastProcessed = 0
    let slowProcessed = 0
    const processingTimes: number[] = []

    cyre.action({id: 'slow-handler-test'})
    cyre.on('slow-handler-test', async (payload: any) => {
      const start = performance.now()

      if (payload.type === 'slow') {
        // Simulate slow database operation
        console.log(`   🐌 Starting slow operation: ${payload.id}`)
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
        slowProcessed++
        console.log(`   ✅ Slow operation completed: ${payload.id}`)
      } else {
        // Fast operation
        fastProcessed++
        console.log(`   ⚡ Fast operation: ${payload.id}`)
      }

      const duration = performance.now() - start
      processingTimes.push(duration)

      return {
        type: payload.type,
        id: payload.id,
        processed: true,
        duration: duration
      }
    })

    console.log('\n🔥 Mixing slow and fast operations:')

    const operations = [
      {type: 'fast', id: 1, table: 'apple'},
      {type: 'slow', id: 2, table: 'orange'}, // This should block everything after
      {type: 'fast', id: 3, table: 'apple'}, // Should wait for slow
      {type: 'fast', id: 4, table: 'banana'}, // Should wait for slow
      {type: 'fast', id: 5, table: 'apple'} // Should wait for slow
    ]

    const start = performance.now()
    const promises: Promise<any>[] = []

    // Fire all operations
    operations.forEach((op, index) => {
      console.log(`   🔥 Firing: ${op.type}-${op.id} (${op.table})`)
      promises.push(cyre.call('slow-handler-test', op))
    })

    // Wait for all to complete
    await Promise.all(promises)
    const totalDuration = performance.now() - start

    console.log(`\n📊 Blocking Results:`)
    console.log(`   Total duration: ${totalDuration.toFixed(2)}ms`)
    console.log(`   Fast operations: ${fastProcessed}`)
    console.log(`   Slow operations: ${slowProcessed}`)
    console.log(
      `   Average processing time: ${(
        processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      ).toFixed(2)}ms`
    )

    if (totalDuration > 800) {
      console.log(
        `   ✅ Single-file blocking confirmed - slow operation delayed everything`
      )
    } else {
      console.log(`   🤔 Unexpected: Operations processed faster than expected`)
    }
  }

  /**
   * Test 3: True Interval Constraint
   * Force interval behavior with immediate operations
   */
  async testTrueIntervalConstraint(): Promise<void> {
    console.log('\n⏱️ Test 3: True Interval Constraint')
    console.log('='.repeat(60))

    let processed = 0
    const processingTimes: number[] = []
    const startTime = Date.now()

    // Channel with strict interval
    cyre.action({
      id: 'strict-interval-test',
      interval: 1000, // 1 second interval
      repeat: true, // Keep processing
      delay: 0 // Start immediately
    })

    cyre.on('strict-interval-test', (payload: any) => {
      processed++
      const processTime = Date.now() - startTime
      processingTimes.push(processTime)

      console.log(`   ⏱️ Processed ${payload.id} at ${processTime}ms`)

      return {
        id: payload.id,
        processed: true,
        timestamp: processTime
      }
    })

    console.log(
      '\n🔥 Firing operations rapidly (should be delayed by interval):'
    )

    // Fire multiple operations rapidly
    for (let i = 1; i <= 5; i++) {
      cyre.call('strict-interval-test', {
        id: i,
        urgent: i <= 2, // First 2 are urgent
        fired_at: Date.now() - startTime
      })
      console.log(`   🔥 Fired operation ${i} at ${Date.now() - startTime}ms`)
    }

    // Wait longer to see interval behavior
    await new Promise(resolve => setTimeout(resolve, 6000))

    console.log(`\n📊 Interval Constraint Results:`)
    console.log(`   Operations fired: 5`)
    console.log(`   Operations processed: ${processed}`)
    console.log(`   Processing times: ${processingTimes.join('ms, ')}ms`)

    // Check if intervals are approximately 1000ms apart
    if (processingTimes.length > 1) {
      const intervals = []
      for (let i = 1; i < processingTimes.length; i++) {
        intervals.push(processingTimes[i] - processingTimes[i - 1])
      }

      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length
      console.log(`   Average interval: ${avgInterval.toFixed(2)}ms`)
      console.log(`   Expected interval: 1000ms`)

      if (avgInterval > 800 && avgInterval < 1200) {
        console.log(`   ✅ Interval constraint working correctly`)
      } else {
        console.log(`   🤔 Interval behavior unexpected`)
      }
    }
  }

  /**
   * Test 4: Debounce Collision Test
   * Force debounce conflicts with different payloads
   */
  async testDebounceCollision(): Promise<void> {
    console.log('\n🏀 Test 4: Debounce Collision')
    console.log('='.repeat(60))

    let processed = 0
    const processedPayloads: any[] = []

    // Aggressive debouncing
    cyre.action({
      id: 'debounce-collision-test',
      debounce: 1000, // 1 second debounce
      payload: {default: 'test'}
    })

    cyre.on('debounce-collision-test', (payload: any) => {
      processed++
      processedPayloads.push(payload)
      console.log(
        `   ✅ Processed: ${payload.table}-${payload.id} (total: ${processed})`
      )

      return {
        table: payload.table,
        id: payload.id,
        processed: true,
        finalPayload: true
      }
    })

    console.log('\n🔥 Rapid fire with debounce (should collapse):')

    // Fire operations rapidly - should be debounced
    const operations = [
      {table: 'apple', id: 1, data: 'apple-data-1'},
      {table: 'orange', id: 2, data: 'orange-data-2'},
      {table: 'apple', id: 3, data: 'apple-data-3'},
      {table: 'banana', id: 4, data: 'banana-data-4'},
      {table: 'orange', id: 5, data: 'orange-data-5'}
    ]

    operations.forEach((op, index) => {
      setTimeout(() => {
        cyre.call('debounce-collision-test', op)
        console.log(`   🔥 Fired: ${op.table}-${op.id}`)
      }, index * 100) // Fire every 100ms
    })

    // Wait for debounce to settle
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log(`\n📊 Debounce Collision Results:`)
    console.log(`   Operations fired: ${operations.length}`)
    console.log(`   Operations processed: ${processed}`)
    console.log(
      `   Debounce ratio: ${processed}/${operations.length} = ${(
        (processed / operations.length) *
        100
      ).toFixed(1)}%`
    )

    if (processed === 1) {
      console.log(`   ✅ Perfect debouncing - only last operation processed`)
      console.log(`   Last payload: ${JSON.stringify(processedPayloads[0])}`)
    } else if (processed < operations.length) {
      console.log(`   ⚠️ Partial debouncing - some operations collapsed`)
    } else {
      console.log(`   🤔 No debouncing detected`)
    }
  }

  async runExtremeBottleneckTests(): Promise<void> {
    console.log('🔥 Extreme Bottleneck Testing')
    console.log('Push Cyre single-file architecture to limits')
    console.log('='.repeat(70))

    try {
      await this.testAggressiveThrottling()
      await this.testSlowHandlerBlocking()
      await this.testTrueIntervalConstraint()
      await this.testDebounceCollision()

      console.log('\n✅ All extreme bottleneck tests completed!')
      console.log('\n🎯 These tests reveal the true constraints of')
      console.log("   Cyre's single-file channel architecture.")
    } catch (error) {
      console.error('❌ Extreme bottleneck test failed:', error)
    }
  }
}

// Export for use
export {ExtremeBottleneckTest}

const test = new ExtremeBottleneckTest()
test.runExtremeBottleneckTests().catch(console.error)
