import {cyre, CyreLog} from '../app'

interface ApocalypseMetrics {
  burstCalls: number
  maxConcurrent: number
  errors: number
  responseTime: number[]
}

const metrics: ApocalypseMetrics = {
  burstCalls: 0,
  maxConcurrent: 0,
  errors: 0,
  responseTime: []
}

// Simple progress counter
let progress = 0
const TEST_DURATION = 30 // 30 seconds test

console.log('\n=== QUANTUM APOCALYPSE TEST ===')
console.log('Progress: [                              ]')
process.stdout.write('\x1B[1A')
process.stdout.write('\x1B[12C')

// Register single handler
cyre.on([
  {
    id: 'apocalypse',
    fn: async payload => {
      try {
        const startTime = Date.now()

        // Simple CPU burn
        const end = Date.now() + payload.intensity * 100
        while (Date.now() < end) {
          Math.random()
        }

        metrics.responseTime.push(Date.now() - startTime)
        metrics.burstCalls++
      } catch (error) {
        metrics.errors++
      }
    }
  }
])

// Register action
cyre.action([
  {
    id: 'apocalypse',
    type: 'apocalypse',
    priority: {level: 'high'}
  }
])

// Main test function
const runTest = async () => {
  const startTime = Date.now()

  try {
    while (Date.now() - startTime < TEST_DURATION * 1000) {
      // Update progress bar
      const newProgress = Math.floor(
        ((Date.now() - startTime) / (TEST_DURATION * 1000)) * 30
      )
      if (newProgress > progress) {
        process.stdout.write('█'.repeat(newProgress - progress))
        progress = newProgress
      }

      // Generate load
      const burst = Array(100)
        .fill(null)
        .map(() =>
          cyre.call('apocalypse', {
            intensity: Math.random() * 5
          })
        )

      await Promise.all(burst)
    }

    // Complete progress bar
    process.stdout.write('█'.repeat(30 - progress))

    // Show results
    console.log('\n\nTest Complete!')
    console.log('\nResults:')
    console.log(`Total Calls: ${metrics.burstCalls}`)
    console.log(`Errors: ${metrics.errors}`)
    console.log(
      `Avg Response: ${(
        metrics.responseTime.reduce((a, b) => a + b, 0) /
        metrics.responseTime.length
      ).toFixed(2)}ms`
    )

    await cyre.shutdown()
    process.exit(0)
  } catch (error) {
    console.error('\nTest failed:', error)
    await cyre.shutdown()
    process.exit(1)
  }
}

// Run the test
runTest()
