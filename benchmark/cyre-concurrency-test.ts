// benchmark/cyre-concurrency-test.ts
// File location: /benchmark/cyre-concurrency-test.ts

/**
 * Cyre Concurrency & Channel Behavior Test
 *
 * Tests:
 * 1. Do multiple channels block each other when awaited in parallel?
 * 2. What happens when same channel gets await + spray simultaneously?
 * 3. Payload handling with different data on same channel
 * 4. Channel isolation and independence
 */

import {cyre} from '../src'

class CyreConcurrencyTest {
  /**
   * Test 1: Multiple Channels Parallel Await
   * Do different channels block each other when awaited simultaneously?
   */
  async testMultiChannelParallelAwait(): Promise<void> {
    console.log('\n🔄 Test 1: Multiple Channels Parallel Await')
    console.log('='.repeat(60))
    console.log('Question: Do different channels block each other?')

    // Setup multiple channels with different processing times
    const channels = [
      {id: 'fast-channel', delay: 10},
      {id: 'medium-channel', delay: 50},
      {id: 'slow-channel', delay: 100},
      {id: 'very-slow-channel', delay: 200}
    ]

    // Setup channels
    channels.forEach(({id, delay}) => {
      cyre.action({id, payload: {type: id, delay}})
      cyre.on(id, async (payload: any) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, delay))
        return {
          channel: id,
          processed: true,
          delay: delay,
          payload: payload,
          completedAt: Date.now()
        }
      })
    })

    console.log('\n🚀 Testing sequential vs parallel execution...')

    // Test 1a: Sequential await (should take sum of all delays)
    console.log('\n📍 Sequential Execution:')
    const sequentialStart = performance.now()

    for (const {id} of channels) {
      const result = await cyre.call(id, {
        mode: 'sequential',
        timestamp: Date.now()
      })
      console.log(`   ✅ ${id}: ${result.payload?.delay || 'unknown'}ms`)
    }

    const sequentialDuration = performance.now() - sequentialStart
    console.log(`   Total: ${sequentialDuration.toFixed(2)}ms`)

    // Test 1b: Parallel await (should take time of slowest channel)
    console.log('\n📍 Parallel Execution:')
    const parallelStart = performance.now()

    const parallelPromises = channels.map(({id}) =>
      cyre.call(id, {mode: 'parallel', timestamp: Date.now()})
    )

    const parallelResults = await Promise.all(parallelPromises)
    const parallelDuration = performance.now() - parallelStart

    parallelResults.forEach((result, index) => {
      console.log(
        `   ✅ ${channels[index].id}: ${result.payload?.delay || 'unknown'}ms`
      )
    })
    console.log(`   Total: ${parallelDuration.toFixed(2)}ms`)

    console.log(`\n📊 Results:`)
    console.log(`   Sequential: ${sequentialDuration.toFixed(2)}ms`)
    console.log(`   Parallel:   ${parallelDuration.toFixed(2)}ms`)
    console.log(
      `   Speedup:    ${(sequentialDuration / parallelDuration).toFixed(2)}x`
    )
    console.log(
      `   🎯 Conclusion: ${
        parallelDuration < sequentialDuration
          ? 'Channels DO NOT block each other!'
          : 'Channels appear to block each other'
      }`
    )
  }

  /**
   * Test 2: Same Channel - Await vs Spray Collision
   * What happens when same channel gets await + spray simultaneously?
   */
  async testSameChannelAwaitSprayCollision(): Promise<void> {
    console.log('\n🍎🍊 Test 2: Same Channel - Await vs Spray Collision')
    console.log('='.repeat(60))
    console.log('Question: await("apple") + spray("orange") on same channel?')

    let processedPayloads: any[] = []

    // Setup channel that tracks all payloads
    cyre.action({id: 'fruit-channel', payload: {default: 'banana'}})
    cyre.on('fruit-channel', (payload: any) => {
      processedPayloads.push({
        fruit: payload.fruit || 'unknown',
        method: payload.method || 'unknown',
        timestamp: Date.now(),
        processed: true
      })

      console.log(`   🍎 Processed: ${payload.fruit} (${payload.method})`)

      return {
        received: payload.fruit,
        method: payload.method,
        processed: true,
        order: processedPayloads.length
      }
    })

    console.log(
      '\n🚀 Firing await("apple") and spray("orange") simultaneously...'
    )

    const start = performance.now()

    // Fire both simultaneously
    const awaitPromise = cyre.call('fruit-channel', {
      fruit: 'apple',
      method: 'await',
      timestamp: Date.now()
    })

    // Immediately fire spray (no await)
    cyre.call('fruit-channel', {
      fruit: 'orange',
      method: 'spray',
      timestamp: Date.now()
    })

    // Wait for await to complete
    const awaitResult = await awaitPromise

    // Give spray time to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    const duration = performance.now() - start

    console.log(`\n📊 Results after ${duration.toFixed(2)}ms:`)
    console.log(`   Await result: ${JSON.stringify(awaitResult)}`)
    console.log(`   Total processed: ${processedPayloads.length}`)
    console.log(`   Payloads processed:`)

    processedPayloads.forEach((payload, index) => {
      console.log(`     ${index + 1}. ${payload.fruit} (${payload.method})`)
    })

    console.log(
      `\n🎯 Conclusion: ${
        processedPayloads.length === 2
          ? 'Both payloads processed independently!'
          : 'Collision or loss occurred'
      }`
    )
  }

  /**
   * Test 3: Rapid Fire Same Channel
   * What happens with rapid fire on same channel with different payloads?
   */
  async testRapidFireSameChannel(): Promise<void> {
    console.log('\n⚡ Test 3: Rapid Fire Same Channel')
    console.log('='.repeat(60))
    console.log('Question: Multiple rapid calls to same channel?')

    let processedCount = 0
    const receivedPayloads: any[] = []

    cyre.action({id: 'rapid-channel'})
    cyre.on('rapid-channel', (payload: any) => {
      processedCount++
      receivedPayloads.push(payload)
      return {
        id: payload.id,
        processed: true,
        order: processedCount
      }
    })

    const operations = 100
    console.log(`\n🔥 Firing ${operations} operations rapidly...`)

    const start = performance.now()
    const promises: Promise<any>[] = []

    // Mix of await and spray calls
    for (let i = 0; i < operations; i++) {
      const payload = {
        id: i,
        fruit: ['apple', 'orange', 'banana', 'grape'][i % 4],
        method: i % 3 === 0 ? 'await' : 'spray',
        timestamp: Date.now()
      }

      if (i % 3 === 0) {
        // Await every 3rd operation
        promises.push(cyre.call('rapid-channel', payload))
      } else {
        // Spray the rest
        cyre.call('rapid-channel', payload)
      }
    }

    // Wait for await operations to complete
    const awaitResults = await Promise.all(promises)

    // Give spray operations time to complete
    await new Promise(resolve => setTimeout(resolve, 200))

    const duration = performance.now() - start

    console.log(`\n📊 Results:`)
    console.log(`   Duration: ${duration.toFixed(2)}ms`)
    console.log(`   Fired: ${operations} operations`)
    console.log(`   Processed: ${processedCount}`)
    console.log(`   Await operations: ${promises.length}`)
    console.log(`   Spray operations: ${operations - promises.length}`)
    console.log(
      `   Success rate: ${((processedCount / operations) * 100).toFixed(1)}%`
    )

    // Check order preservation
    const fruits = receivedPayloads.map(p => `${p.id}:${p.fruit}`).slice(0, 10)
    console.log(`   First 10 processed: ${fruits.join(', ')}`)

    console.log(
      `\n🎯 Conclusion: ${
        processedCount === operations
          ? 'All operations processed successfully!'
          : 'Some operations were lost or delayed'
      }`
    )
  }

  /**
   * Test 4: Channel Isolation Test
   * Verify channels are truly independent
   */
  async testChannelIsolation(): Promise<void> {
    console.log('\n🏠 Test 4: Channel Isolation')
    console.log('='.repeat(60))
    console.log('Question: Are channels truly isolated from each other?')

    const channels = ['isolated-a', 'isolated-b', 'isolated-c']
    const channelData: Record<string, any[]> = {}

    // Setup isolated channels
    channels.forEach(channelId => {
      channelData[channelId] = []

      cyre.action({id: channelId})
      cyre.on(channelId, (payload: any) => {
        channelData[channelId].push({
          ...payload,
          processedAt: Date.now(),
          channel: channelId
        })

        return {
          channel: channelId,
          received: payload,
          count: channelData[channelId].length
        }
      })
    })

    console.log('\n🔥 Firing operations across all channels simultaneously...')

    const operationsPerChannel = 50
    const start = performance.now()

    // Fire operations across all channels simultaneously
    const allPromises: Promise<any>[] = []

    for (let i = 0; i < operationsPerChannel; i++) {
      channels.forEach(channelId => {
        const payload = {
          id: i,
          channel: channelId,
          data: `${channelId}-data-${i}`,
          timestamp: Date.now()
        }

        if (i % 2 === 0) {
          // Await half the operations
          allPromises.push(cyre.call(channelId, payload))
        } else {
          // Spray the other half
          cyre.call(channelId, payload)
        }
      })
    }

    await Promise.all(allPromises)
    await new Promise(resolve => setTimeout(resolve, 200))

    const duration = performance.now() - start

    console.log(`\n📊 Channel Isolation Results:`)
    console.log(`   Duration: ${duration.toFixed(2)}ms`)

    channels.forEach(channelId => {
      const data = channelData[channelId]
      console.log(
        `   ${channelId}: ${data.length}/${operationsPerChannel} operations`
      )

      // Check data integrity
      const uniqueIds = new Set(data.map(d => d.id))
      const hasCorrectChannel = data.every(d => d.channel === channelId)

      console.log(`     - Unique IDs: ${uniqueIds.size}`)
      console.log(`     - Correct channel: ${hasCorrectChannel}`)
      console.log(
        `     - Data integrity: ${
          data.length === operationsPerChannel && hasCorrectChannel
            ? '✅'
            : '❌'
        }`
      )
    })

    const totalProcessed = Object.values(channelData).reduce(
      (sum, arr) => sum + arr.length,
      0
    )
    const totalExpected = channels.length * operationsPerChannel

    console.log(
      `\n🎯 Overall: ${totalProcessed}/${totalExpected} operations processed`
    )
    console.log(
      `🎯 Conclusion: ${
        totalProcessed === totalExpected
          ? 'Perfect channel isolation!'
          : 'Some cross-channel interference detected'
      }`
    )
  }

  /**
   * Run all concurrency tests
   */
  async runAllConcurrencyTests(): Promise<void> {
    console.log('🧪 Starting Cyre Concurrency Tests')
    console.log('Testing blocking behavior and channel independence')
    console.log('='.repeat(70))

    try {
      await this.testMultiChannelParallelAwait()
      await this.testSameChannelAwaitSprayCollision()
      await this.testRapidFireSameChannel()
      await this.testChannelIsolation()

      console.log('\n✅ All concurrency tests completed!')
      console.log('\n🎯 Summary: These tests reveal how Cyre handles')
      console.log('   concurrent operations and channel independence.')
    } catch (error) {
      console.error('❌ Concurrency test failed:', error)
    }
  }
}

// Export for use
export {CyreConcurrencyTest}

// Run if executed directly
const test = new CyreConcurrencyTest()
test.runAllConcurrencyTests().catch(console.error)
