// test-dashboard-connection.ts
// Test connection between Cyre and dashboard

import {cyre, http} from '../src'

async function testConnection() {
  console.log('🚀 Testing Cyre → Dashboard Connection...\n')

  try {
    // Step 1: Initialize Cyre (this will auto-start HTTP server)
    console.log('📡 Initializing Cyre...')
    const result = await cyre.initialize()

    if (!result.ok) {
      throw new Error(result.message)
    }
    console.log('✅ Cyre initialized')

    // Step 2: Verify HTTP server is running
    console.log('🌐 Checking HTTP server...')
    const httpStatus = http.status()
    console.log('✅ HTTP server status:', httpStatus.server.running)

    // Step 3: Create some test channels
    console.log('📋 Creating test channels...')

    cyre.action({
      id: 'test/hello',
      payload: {message: 'string'}
    })

    cyre.action({
      id: 'test/counter',
      payload: {count: 'number'}
    })

    cyre.on('test/hello', payload => {
      console.log('📝 Hello message:', payload.message)
      return {success: true, echo: payload.message}
    })

    cyre.on('test/counter', payload => {
      console.log('🔢 Counter:', payload.count)
      return {success: true, doubled: payload.count * 2}
    })

    console.log('✅ Test channels created')

    // Step 4: Generate some test data
    console.log('📊 Generating test data...')

    await cyre.call('test/hello', {message: 'Dashboard test!'})
    await cyre.call('test/counter', {count: 42})
    await cyre.call('test/hello', {message: 'Connection working!'})

    console.log('✅ Test data generated')

    // Step 5: Show connection info
    console.log('\n🎉 Connection Test Complete!')
    console.log('─'.repeat(50))
    console.log('📊 Dashboard URL:  http://localhost:3000/dashboard')
    console.log('🔗 API Status:     http://localhost:3001/api/status')
    console.log('📡 WebSocket:      ws://localhost:3001')
    console.log('🔍 Test Health:    http://localhost:3001/api/health')
    console.log('─'.repeat(50))

    // Step 6: Keep generating data
    console.log('\n💡 Generating continuous test data...')
    console.log('💡 Open dashboard in browser to see live metrics!')
    console.log('💡 Press Ctrl+C to stop\n')

    // Generate data every few seconds
    let counter = 0
    setInterval(async () => {
      try {
        counter++
        await cyre.call('test/counter', {count: counter})

        if (counter % 3 === 0) {
          await cyre.call('test/hello', {message: `Update #${counter}`})
        }
      } catch (error) {
        console.warn('Test call failed:', error)
      }
    }, 3000)
  } catch (error) {
    console.error('❌ Connection test failed:', error)
    process.exit(1)
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Stopping connection test...')
  try {
    await http.stop()
    console.log('✅ HTTP server stopped')
  } catch (error) {
    console.error('❌ Error stopping:', error)
  }
  process.exit(0)
})

// Start test
testConnection()
