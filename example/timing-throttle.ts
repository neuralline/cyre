import {cyre} from '../src/app'

console.log('\n=== QUANTUM PERFORMANCE ANALYSIS TEST ===')

// Test different work intensities
const WORK_LOADS = [
  {name: 'Light', cpu: 10, async: 10},
  {name: 'Medium', cpu: 50, async: 50},
  {name: 'Heavy', cpu: 100, async: 100}
]

// Register handlers for each workload
WORK_LOADS.forEach(load => {
  cyre.on([
    {
      id: `load-${load.name.toLowerCase()}`,
      fn: async payload => {
        const start = Date.now()

        // CPU work
        const cpuEnd = Date.now() + load.cpu
        while (Date.now() < cpuEnd) {
          Math.random()
        }

        // Async work
        await new Promise(resolve => setTimeout(resolve, load.async))

        return {
          processingTime: Date.now() - start,
          workload: load.name
        }
      }
    }
  ])

  // Remove local throttle, use global config
  cyre.action([
    {
      id: `load-${load.name.toLowerCase()}`,
      type: `load-${load.name.toLowerCase()}`,
      priority: {level: 'medium'}
      // Removed throttle setting to use global config
    }
  ])
})

const runTest = async () => {
  console.log('Analyzing performance impact...\n')

  const metrics = {
    calls: 0,
    success: 0,
    failed: 0,
    totalProcessingTime: 0,
    totalCallTime: 0,
    totalStress: 0,
    stressLevels: [] as number[]
  }

  const startTime = Date.now()
  let lastSampleTime = startTime

  // Monitor performance patterns
  const monitor = setInterval(() => {
    const state = cyre.getPerformanceState()
    const now = Date.now()
    const elapsed = (now - startTime) / 1000
    const sampleElapsed = (now - lastSampleTime) / 1000

    // Calculate rates
    metrics.totalProcessingTime += state.totalProcessingTime
    metrics.totalCallTime += state.totalCallTime
    metrics.totalStress += state.totalStress
    metrics.stressLevels.push(state.stress)

    process.stdout.write(
      '\r' +
        [
          `Time: ${elapsed.toFixed(1)}s`,
          `Calls: ${metrics.calls}`,
          `Rate: ${(metrics.calls / elapsed).toFixed(1)}/s`,
          `Processing Time: ${state.totalProcessingTime.toFixed(1)}ms`,
          `Call Time: ${state.totalCallTime.toFixed(1)}ms`,
          `Stress: ${(state.stress * 100).toFixed(1)}%`
        ].join(' | ')
    )
  }, 100)

  // Run test for 15 seconds
  const testEnd = Date.now() + 15000

  while (Date.now() < testEnd) {
    metrics.calls++
    try {
      await cyre.call(`load-${WORK_LOADS[0].name.toLowerCase()}`, {
        timestamp: Date.now()
      })
      metrics.success++
    } catch (error) {
      metrics.failed++
    }

    // No artificial delay - test maximum rate
  }

  clearInterval(monitor)

  // Calculate statistics
  const avgProcessingTime = metrics.totalProcessingTime / metrics.calls
  const avgCallTime = metrics.totalCallTime / metrics.calls
  const avgStress = metrics.totalStress / metrics.calls

  const finalState = cyre.getPerformanceState()
  const totalTime = (Date.now() - startTime) / 1000

  console.log('\n\n=== Performance Analysis Results ===')
  console.log(`Test Duration: ${totalTime.toFixed(1)} seconds`)
  console.log(`Total Calls: ${metrics.calls}`)
  console.log(
    `Success Rate: ${((metrics.success / metrics.calls) * 100).toFixed(1)}%`
  )
  console.log(`Average Processing Time: ${avgProcessingTime.toFixed(1)}ms`)
  console.log(`Average Call Time: ${avgCallTime.toFixed(1)}ms`)

  console.log('\n=== System State ===')
  console.log(`Final Stress: ${(finalState.stress * 100).toFixed(1)}%`)
  console.log(`Average Stress: ${(avgStress * 100).toFixed(1)}%`)

  await cyre.shutdown()
  process.exit(0)
}

runTest().catch(async error => {
  console.error('Test failed:', error)
  await cyre.shutdown()
  process.exit(1)
})
