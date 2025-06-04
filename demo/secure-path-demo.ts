// demo/secure-path-demo.ts
// Demonstration of secure path system design

import {cyre} from '../src'

/*

      C.Y.R.E - S.E.C.U.R.E - P.A.T.H - D.E.M.O
      
      Demonstrates the secure path system design:
      ✅ Exact paths for regular calls
      ✅ Explicit bulk operations with safety
      ✅ Pattern matching for discovery only
      ✅ Clear intent and safety checks

*/

async function securePathDemo() {
  console.log('🔒 SECURE PATH SYSTEM DEMO')
  console.log('='.repeat(40))

  await cyre.initialize()

  // ===========================================
  // Setup Test Environment
  // ===========================================

  console.log('\n🏗️  Setting up test environment...')

  const channels = [
    // Building sensors
    {id: 'temp-101', path: 'building/floor-1/room-101/temperature'},
    {id: 'temp-102', path: 'building/floor-1/room-102/temperature'},
    {id: 'temp-201', path: 'building/floor-2/room-201/temperature'},
    {id: 'hum-101', path: 'building/floor-1/room-101/humidity'},

    // Critical systems
    {id: 'fire-sys', path: 'safety/fire-suppression/main'},
    {id: 'security', path: 'safety/security/main'},

    // Test sensors
    {id: 'test-1', path: 'test/zone-1/device-1/sensor'},
    {id: 'test-2', path: 'test/zone-1/device-2/sensor'},
    {id: 'test-3', path: 'test/zone-2/device-1/sensor'}
  ]

  // Register channels with handlers
  channels.forEach(ch => {
    cyre.action({...ch, payload: {value: 20}})
    cyre.on(ch.id, (payload: any) => {
      console.log(`   📡 ${ch.id} received:`, payload)
      return {processed: true, channelId: ch.id}
    })
  })

  console.log(`✅ Set up ${channels.length} channels with handlers`)

  // ===========================================
  // TEST 1: Secure Exact Path Calls
  // ===========================================

  console.log('\n🎯 TEST 1: Secure Exact Path Calls')

  // Valid exact path call
  console.log('\n✅ Valid exact path call:')
  const exactCall = await cyre.path.call(
    'building/floor-1/room-101/temperature',
    {
      exactTest: true,
      timestamp: Date.now()
    }
  )

  exactCall.forEach(result => {
    const status = result.ok ? '✅' : '❌'
    console.log(`   ${status} ${result.pathContext?.id}: ${result.message}`)
  })

  // Invalid wildcard in regular call (should be rejected)
  console.log('\n❌ Wildcard in regular call (should be rejected):')
  const wildcardCall = await cyre.path.call('building/floor-1/*/temperature', {
    shouldFail: true
  })

  wildcardCall.forEach(result => {
    const status = result.ok ? '❌ SECURITY ISSUE' : '✅ Properly blocked'
    console.log(`   ${status}: ${result.message}`)
  })

  // ===========================================
  // TEST 2: Discovery Operations (Safe)
  // ===========================================

  console.log('\n🔍 TEST 2: Discovery Operations (Safe Pattern Matching)')

  const discoveryPatterns = [
    'building/**',
    'safety/**',
    'test/zone-1/*',
    '**/temperature'
  ]

  discoveryPatterns.forEach(pattern => {
    const matches = cyre.path.find(pattern)
    console.log(`   "${pattern}": ${matches.length} channels found`)

    // Show preview for bulk operations
    const preview = cyre.path.preview(pattern)
    console.log(
      `     Preview: ${preview.wouldAffect} channels, ${preview.recommendation}`
    )
  })

  // ===========================================
  // TEST 3: Explicit Bulk Operations with Safety
  // ===========================================

  console.log('\n🚀 TEST 3: Explicit Bulk Operations with Safety')

  // Small bulk operation (should succeed)
  console.log('\n✅ Small bulk operation (test sensors):')
  const smallBulk = await cyre.path.bulkCall('test/**', {
    bulkTest: 'small',
    timestamp: Date.now()
  })

  console.log(`   Result: ${smallBulk.message}`)
  console.log(
    `   Success rate: ${smallBulk.successfulCalls}/${smallBulk.matchedChannels}`
  )

  // Large operation without confirmation (should be blocked)
  console.log('\n🛡️  Large operation without confirmation (should be blocked):')
  const largeBlocked = await cyre.path.bulkCall('**', {
    dangerousOperation: true
  })

  console.log(
    `   Result: ${
      largeBlocked.ok ? '❌ SECURITY ISSUE' : '✅ Properly blocked'
    }`
  )
  console.log(`   Message: ${largeBlocked.message}`)

  // Large operation with explicit force (should succeed)
  console.log('\n⚠️  Large operation with explicit force:')
  const largeForced = await cyre.path.bulkCall(
    '**',
    {
      forcedOperation: true,
      timestamp: Date.now()
    },
    {
      force: true,
      maxChannels: 100
    }
  )

  console.log(`   Result: ${largeForced.message}`)
  console.log(
    `   Success rate: ${largeForced.successfulCalls}/${largeForced.matchedChannels}`
  )

  // ===========================================
  // TEST 4: Dry Run Operations
  // ===========================================

  console.log('\n🧪 TEST 4: Dry Run Operations (Safe Testing)')

  const dryRun = await cyre.path.bulkCall(
    'building/**',
    {
      potentiallyDangerous: true
    },
    {
      dryRun: true
    }
  )

  console.log(`   Dry run: ${dryRun.message}`)
  console.log(`   Would affect: ${dryRun.matchedChannels} channels`)
  if (dryRun.results.length > 0) {
    console.log('   Channels that would be called:')
    dryRun.results.slice(0, 3).forEach(result => {
      console.log(
        `     - ${result.pathContext?.id} (${result.pathContext?.path})`
      )
    })
    if (dryRun.results.length > 3) {
      console.log(`     ... and ${dryRun.results.length - 3} more`)
    }
  }

  // ===========================================
  // TEST 5: Pattern-Based Subscription (Allowed)
  // ===========================================

  console.log(
    '\n📡 TEST 5: Pattern-Based Subscription (Safe for Event Handling)'
  )

  const subscription = await cyre.path.on(
    'building/floor-1/*/temperature',
    (payload, context) => {
      console.log(
        `   🌡️  Floor-1 temperature sensor ${context.id}: ${JSON.stringify(
          payload
        )}`
      )
      return {subscriptionProcessed: true, sensorId: context.id}
    }
  )

  console.log(`   Subscription result: ${subscription.message}`)

  // Test the subscription with individual calls
  console.log('\n🔄 Testing subscription with individual calls:')
  await cyre.call('temp-101', {temperature: 22.5, subscription: 'test'})
  await cyre.call('temp-102', {temperature: 23.1, subscription: 'test'})

  // ===========================================
  // Security Analysis Summary
  // ===========================================

  console.log('\n🔒 SECURITY ANALYSIS SUMMARY')
  console.log('='.repeat(40))

  console.log('\n✅ SECURE OPERATIONS:')
  console.log('   • Exact path calls: ✅ Only specific targets')
  console.log('   • Pattern discovery: ✅ Read-only, safe for exploration')
  console.log('   • Pattern subscription: ✅ Event handling, appropriate use')
  console.log('   • Dry runs: ✅ Safe testing without side effects')
  console.log('   • Explicit bulk ops: ✅ Intentional, with safety checks')

  console.log('\n🛡️  SECURITY PROTECTIONS:')
  console.log(
    '   • Wildcard calls blocked: ✅ Prevents accidental mass operations'
  )
  console.log('   • Large operation limits: ✅ Prevents system overload')
  console.log(
    '   • Explicit confirmation: ✅ Forces intentional bulk operations'
  )
  console.log(
    '   • Force flag required: ✅ Prevents accidental dangerous operations'
  )
  console.log('   • Preview capability: ✅ See impact before execution')

  console.log('\n📋 DESIGN PRINCIPLES:')
  console.log(
    '   • Principle of Least Privilege: Users must be explicit about bulk operations'
  )
  console.log(
    '   • Fail-Safe Defaults: Operations default to single-channel safety'
  )
  console.log(
    '   • Explicit Intent: Bulk operations require conscious decision'
  )
  console.log('   • Defense in Depth: Multiple safety checks and confirmations')
  console.log(
    '   • Clear Separation: Different methods for different use cases'
  )

  // Clean up
  console.log('\n🧹 Cleaning up test data...')
  let cleaned = 0
  channels.forEach(ch => {
    if (cyre.forget(ch.id)) cleaned++
  })
  console.log(`🧹 Cleaned ${cleaned} test channels`)

  console.log(
    '\n🎯 CONCLUSION: Path system is secure and prevents accidental mass operations!'
  )
}

// Run the secure demo
securePathDemo().catch(console.error)

export {securePathDemo}
