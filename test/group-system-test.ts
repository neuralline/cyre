// test/group-system-test.ts
// Quick test to verify group system functionality

import {cyre, schema} from '../src/index'

const testGroupSystem = async () => {
  console.log('🧪 Testing Cyre Group System...')

  await cyre.initialize()

  // Simple middleware for testing
  const testMiddleware = async (payload: any, next: any) => {
    console.log('🔧 Group middleware executed for:', payload)
    return next({...payload, processedByGroup: true})
  }

  // Create a simple test group
  const groupResult = cyre.group('test-group', {
    channels: ['test-*'],
    shared: {
      middleware: [testMiddleware],
      throttle: 500,
      priority: {level: 'medium'}
    }
  })

  console.log('Group creation result:', groupResult)

  if (groupResult.ok) {
    // Create test channels
    cyre.action({id: 'test-alpha', payload: {name: 'alpha'}})
    cyre.action({id: 'test-beta', payload: {name: 'beta'}})
    cyre.action({id: 'other-channel', payload: {name: 'other'}}) // Won't match group

    // Subscribe to channels
    cyre.on('test-alpha', data => {
      console.log('✅ Alpha received:', data)
    })

    cyre.on('test-beta', data => {
      console.log('✅ Beta received:', data)
    })

    cyre.on('other-channel', data => {
      console.log('✅ Other received:', data)
    })

    // Test calls
    console.log('\n📞 Testing calls...')
    await cyre.call('test-alpha', {name: 'alpha-test'})
    await cyre.call('test-beta', {name: 'beta-test'})
    await cyre.call('other-channel', {name: 'other-test'})

    // Check group status
    const group = cyre.getGroup('test-group')
    console.log('\n📊 Group status:')
    console.log('- Matched channels:', group?.matchedChannels.size)
    console.log('- Middleware count:', group?.middlewareIds.length)

    console.log('\n✅ Group system test completed!')
  } else {
    console.error('❌ Group creation failed:', groupResult.message)
  }
}

// Run the test
testGroupSystem().catch(console.error)
