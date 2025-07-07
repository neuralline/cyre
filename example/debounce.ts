// example/debounce-advanced.ts
import {cyre} from '../src'
import TimeKeeper from '../src/components/cyre-timekeeper'

async function testAdvancedDebounce() {
  console.log('🧪 Testing advanced debounce scenarios...\n')

  await cyre.init()

  // Setup multiple channels with different debounce configurations
  const configs = [
    {id: 'fast-search', debounce: 100, maxWait: 500, color: '🔍'},
    {id: 'api-calls', debounce: 300, maxWait: 1000, color: '🌐'},
    {id: 'slow-validation', debounce: 500, maxWait: 2000, color: '✅'},
    {id: 'no-maxwait', debounce: 200, color: '⚡'},
    {id: 'long-debounce', debounce: 800, maxWait: 1500, color: '🐌'}
  ]

  // Create all channels
  configs.forEach(config => {
    cyre.action({
      id: config.id,
      debounce: config.debounce,
      maxWait: config.maxWait
    })

    cyre.on(config.id, data => {
      const time = new Date().toLocaleTimeString()
      console.log(
        `${config.color} [${config.id}] Executed: "${data}" at ${time}`
      )
      return {processed: data, timestamp: Date.now()}
    })
  })

  console.log('🎯 Test 1: Concurrent rapid calls on multiple channels')

  // Rapid fire all channels simultaneously
  for (let i = 0; i < 8; i++) {
    await Promise.all([
      cyre.call('fast-search', `search-${i}`),
      cyre.call('api-calls', `api-${i}`),
      cyre.call('slow-validation', `validate-${i}`),
      cyre.call('no-maxwait', `instant-${i}`),
      cyre.call('long-debounce', `slow-${i}`)
    ])

    console.log(`Batch ${i}: Called all channels`)
    await new Promise(resolve => setTimeout(resolve, 80)) // 80ms between batches
  }

  console.log('\nWaiting for debounced executions...')
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('\n🎯 Test 2: MaxWait testing with different intervals')

  // Test maxWait on different channels
  const testMaxWait = async (
    channelId: string,
    calls: number,
    interval: number
  ) => {
    console.log(
      `\nTesting maxWait on ${channelId} (${calls} calls, ${interval}ms apart)`
    )

    for (let i = 0; i < calls; i++) {
      await cyre.call(channelId, `maxwait-test-${i}`)
      console.log(`  Called ${channelId} with "maxwait-test-${i}"`)
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }

  // Run maxWait tests in parallel
  await Promise.all([
    testMaxWait('fast-search', 8, 75), // Should hit maxWait around call 6-7
    testMaxWait('api-calls', 6, 200), // Should hit maxWait around call 5-6
    testMaxWait('slow-validation', 12, 200) // Should hit maxWait around call 10-11
  ])

  console.log('\nWaiting for maxWait executions...')
  await new Promise(resolve => setTimeout(resolve, 1500))

  console.log('\n🎯 Test 3: Mixed execution patterns')

  // Create bursts with quiet periods
  const burst = async (channelId: string, burstSize: number, data: string) => {
    for (let i = 0; i < burstSize; i++) {
      await cyre.call(channelId, `${data}-${i}`)
      await new Promise(resolve => setTimeout(resolve, 30))
    }
  }

  // Burst 1
  console.log('Burst 1: Quick succession')
  await Promise.all([
    burst('fast-search', 5, 'burst1'),
    burst('api-calls', 4, 'burst1'),
    burst('no-maxwait', 6, 'burst1')
  ])

  // Quiet period
  await new Promise(resolve => setTimeout(resolve, 400))

  // Burst 2
  console.log('Burst 2: After quiet period')
  await Promise.all([
    burst('fast-search', 3, 'burst2'),
    burst('slow-validation', 5, 'burst2'),
    burst('long-debounce', 4, 'burst2')
  ])

  console.log('\nWaiting for final executions...')
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('\n🎯 Test 4: Edge cases')

  // Test immediate execution after debounce period
  console.log('Testing immediate execution after quiet period...')
  await cyre.call('fast-search', 'immediate-after-quiet')
  await cyre.call('api-calls', 'immediate-after-quiet')
  await cyre.call('slow-validation', 'immediate-after-quiet')

  await new Promise(resolve => setTimeout(resolve, 200))

  // Test single calls (should execute immediately if no pending debounce)
  console.log('Testing single calls...')
  await new Promise(resolve => setTimeout(resolve, 1000)) // Ensure all debounces cleared

  await cyre.call('fast-search', 'single-call-1')
  await new Promise(resolve => setTimeout(resolve, 150))
  await cyre.call('api-calls', 'single-call-2')
  await new Promise(resolve => setTimeout(resolve, 150))
  await cyre.call('slow-validation', 'single-call-3')

  await new Promise(resolve => setTimeout(resolve, 600))

  console.log('\n✅ Advanced debounce tests completed!')

  // Show final timeline status
  const status = TimeKeeper.status()
  console.log(`\n📊 Final timeline status:`)
  console.log(`  Active formations: ${status.activeFormations}`)
  console.log(`  Total formations: ${status.totalFormations}`)
  console.log(`  Quartz running: ${status.quartzRunning}`)
  console.log(`  Execution groups: ${status.executionGroups}`)

  if (status.groupStats.length > 0) {
    console.log(`  Group breakdown:`)
    status.groupStats.forEach(group => {
      console.log(
        `    ${group.interval}ms interval: ${group.timerCount} timers`
      )
    })
  }

  console.log(`\n🔥 Precision tier breakdown:`)
  console.log(`  High precision: ${status.precisionTiers.high}`)
  console.log(`  Standard: ${status.precisionTiers.standard}`)
  console.log(`  Chunked: ${status.precisionTiers.chunked}`)
}

testAdvancedDebounce().catch(console.error)
