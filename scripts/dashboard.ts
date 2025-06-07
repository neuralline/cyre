// scripts/dashboard.ts
// Easy run script for dashboard

import {DashboardCLI} from '../src/dev/dashboard-cli'

const cli = new DashboardCLI()
cli.start().catch(console.error)

// // package.json - Add dashboard script
// {
//   "scripts": {
//     "dev": "tsx src/index.ts",
//     "dashboard": "tsx scripts/dashboard.ts",
//     "dashboard:cli": "tsx src/dev/dashboard-cli.ts",
//     "test-with-dashboard": "concurrently \"npm run dev\" \"sleep 3 && npm run dashboard\"",
//     "build": "tsc",
//     "test": "vitest"
//   },
//   "devDependencies": {
//     "concurrently": "^7.6.0"
//   }
// }

// Clean test file - test-simple.ts
// Simple test without HTTP integration

import {cyre, metrics} from '../src'

async function testCyre() {
  console.log('🧪 Testing Cyre (no HTTP integration)')

  // Initialize clean Cyre
  const result = await cyre.initialize()
  console.log('✅ Cyre initialized:', result.ok)

  // Create test channels
  cyre.action({
    id: 'test/hello',
    payload: {message: 'string'}
  })

  cyre.on('test/hello', payload => {
    console.log('📝 Message:', payload.message)
    return {success: true}
  })

  // Test calls
  await cyre.call('test/hello', {message: 'Hello Cyre!'})

  // Check metrics
  const health = metrics.health()
  console.log('📊 Health:', health.overall)

  console.log('\n💡 Run "npm run dashboard" in another terminal for dashboard')
  console.log('💡 Press Ctrl+C to stop')

  // Generate some test data
  setInterval(async () => {
    await cyre.call('test/hello', {message: `Update ${Date.now()}`})
  }, 3000)
}

testCyre().catch(console.error)

// Handle shutdown properly
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down Cyre...')
  try {
    await cyre.shutdown()
    console.log('✅ Clean shutdown')
    process.exit(0)
  } catch (error) {
    console.error('❌ Shutdown error:', error)
    process.exit(1)
  }
})
