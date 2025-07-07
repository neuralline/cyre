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

  cyre.action([
    {
      id: `load-${load.name.toLowerCase()}`,
      type: `load-${load.name.toLowerCase()}`,
      priority: {level: 'medium'},
      throttle: 20
    }
  ])
})

const runTest = async () => {
  const results = {
    byLoad: {} as Record<
      string,
      {
        calls: number
        totalTime: number
        minTime: number
        maxTime: number
        successCount: number
        failCount: number
        times: number[]
      }
    >
  }

  // Initialize results
  WORK_LOADS.forEach(load => {
    results.byLoad[load.name] = {
      calls: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      successCount: 0,
      failCount: 0,
      times: []
    }
  })

  console.log('Running performance analysis...\n')

  // Test each workload
  for (const load of WORK_LOADS) {
    console.log(`\nTesting ${load.name} workload...`)
    const stats = results.byLoad[load.name]
    const testStart = Date.now()

    // Monitor for this phase
    const monitor = setInterval(() => {
      const state = cyre.getMetrics()
      const elapsed = (Date.now() - testStart) / 1000
      const throughput = stats.calls / elapsed

      process.stdout.write(
        '\r' +
          [
            `Time: ${elapsed.toFixed(1)}s`,
            `Calls: ${stats.calls}`,
            `Rate: ${throughput.toFixed(1)}/s`,
            `Avg: ${(stats.totalTime / Math.max(stats.calls, 1)).toFixed(1)}ms`,
            `Stress: ${(state.stress * 100).toFixed(1)}%`
          ].join(' | ')
      )
    }, 100)

    // Run for 5 seconds per workload
    const phaseEnd = Date.now() + 5000

    while (Date.now() < phaseEnd) {
      stats.calls++
      const start = Date.now()

      try {
        const result = await cyre.call(`load-${load.name.toLowerCase()}`, {
          timestamp: Date.now()
        })

        const duration = Date.now() - start
        stats.totalTime += duration
        stats.minTime = Math.min(stats.minTime, duration)
        stats.maxTime = Math.max(stats.maxTime, duration)
        stats.times.push(duration)
        stats.successCount++
      } catch (error) {
        stats.failCount++
      }

      // Dynamic delay based on system state
      const state = cyre.getBreathingState()
      await new Promise(resolve =>
        setTimeout(resolve, Math.max(10, state.currentRate / 4))
      )
    }

    clearInterval(monitor)
    console.log('') // New line after progress
  }

  // Show detailed results
  console.log('\n=== Performance Analysis Results ===')

  Object.entries(results.byLoad).forEach(([load, stats]) => {
    const avgTime = stats.totalTime / stats.calls
    const successRate = (stats.successCount / stats.calls) * 100

    // Calculate percentiles
    const sortedTimes = [...stats.times].sort((a, b) => a - b)
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)]
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)]
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)]

    console.log(`\n${load} Workload:`)
    console.log(`Total Calls: ${stats.calls}`)
    console.log(`Success Rate: ${successRate.toFixed(1)}%`)
    console.log(`Average Time: ${avgTime.toFixed(1)}ms`)
    console.log(`Min/Max Time: ${stats.minTime}ms / ${stats.maxTime}ms`)
    console.log(`Percentiles (50/95/99): ${p50}ms / ${p95}ms / ${p99}ms`)
    console.log(`Throughput: ${(stats.calls / 5).toFixed(1)} calls/second`)
  })

  // Get final system state
  const finalState = cyre.getBreathingState()
  console.log('\n=== System State ===')
  console.log(`Final Stress: ${(finalState.stress * 100).toFixed(1)}%`)
  console.log(`Pattern: ${finalState.pattern}`)
  console.log(`Rate: ${finalState.currentRate.toFixed(1)}ms`)
  console.log(`Breaths: ${finalState.breathCount}`)

  await cyre.shutdown()
  process.exit(0)
}

runTest().catch(async error => {
  console.error('Test failed:', error)
  await cyre.shutdown()
  process.exit(1)
})
