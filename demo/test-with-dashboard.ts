// demo/test-with-dashboard.ts - UPDATED TEST FILE
// Test file that includes metrics writer

import {cyre, metrics} from '../src/'
import {
  startMetricsWriter,
  stopMetricsWriter
} from '../src/dev/cyre-metrics-writer'

async function testCyreWithDashboard() {
  console.log('🧪 Testing Cyre with Dashboard Integration')

  try {
    // Initialize clean Cyre
    const result = await cyre.initialize()
    console.log('✅ Cyre initialized:', result.ok)

    // Start metrics writer for dashboard
    await startMetricsWriter(2000) // Update every 2 seconds
    console.log('📊 Metrics writer started')

    // Create test channels
    cyre.action({
      id: 'test/hello',
      payload: {message: 'string'}
    })

    cyre.action({
      id: 'test/counter',
      payload: {count: 'number'}
    })

    cyre.on('test/hello', payload => {
      console.log('📝 Message:', payload.message)
      return {success: true}
    })

    cyre.on('test/counter', payload => {
      console.log('🔢 Counter:', payload.count)
      return {success: true, doubled: payload.count * 2}
    })

    // Test calls
    await cyre.call('test/hello', {message: 'Hello Cyre!'})

    // Check metrics
    const health = metrics.health()
    console.log('📊 Health:', health.overall)

    console.log('\n📊 Metrics file: ./.cyre-dev/metrics.json')
    console.log('💡 Run "npm run dashboard" in another terminal')
    console.log('💡 Press Ctrl+C to stop')

    // Generate test data
    let counter = 0
    setInterval(async () => {
      counter++
      await cyre.call('test/counter', {count: counter})

      if (counter % 3 === 0) {
        await cyre.call('test/hello', {message: `Update ${Date.now()}`})
      }
    }, 3000)
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Handle shutdown properly
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down...')
  try {
    stopMetricsWriter()
    await cyre.shutdown()
    console.log('✅ Clean shutdown')
    process.exit(0)
  } catch (error) {
    console.error('❌ Shutdown error:', error)
    process.exit(1)
  }
})

testCyreWithDashboard().catch(console.error)
