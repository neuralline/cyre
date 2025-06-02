import {TimeKeeper} from '../src/components/cyre-timekeeper'
import {log} from '../src/components/cyre-log'

// Utility for measuring execution time
const measureExecution = async (fn: () => Promise<void> | void) => {
  const start = performance.now()
  await fn()
  const duration = performance.now() - start
  return duration
}

// Utility for waiting with progress indicator
const waitWithProgress = async (ms: number, label: string) => {
  const start = Date.now()
  const interval = setInterval(() => {
    const elapsed = Date.now() - start
    const progress = Math.min(100, (elapsed / ms) * 100)
    process.stdout.write(`\r${label}: ${progress.toFixed(1)}%`)
  }, 100)

  await new Promise(resolve => setTimeout(resolve, ms))
  clearInterval(interval)
  process.stdout.write('\n')
}

// Example 1: Short Interval Precision
async function demonstrateShortIntervalPrecision() {
  log.info('\n=== Short Interval Precision Test ===')

  const executions: number[] = []
  let count = 0
  const targetInterval = 10 // 10ms
  const expectedExecutions = 100

  log.info(
    `Creating timer with ${targetInterval}ms interval, expecting ${expectedExecutions} executions`
  )

  const timer = TimeKeeper.keep(
    targetInterval,
    () => {
      const now = performance.now()
      executions.push(now)
      count++
      process.stdout.write(`\rExecutions: ${count}/${expectedExecutions}`)
    },
    expectedExecutions,
    'short-interval-test'
  )

  if (timer.kind === 'error') {
    log.error('Failed to create timer:', timer.error)
    return
  }

  // Wait for all executions
  await waitWithProgress(
    targetInterval * (expectedExecutions + 1),
    'Waiting for executions'
  )
  process.stdout.write('\n')

  // Calculate timing accuracy
  const intervals: number[] = []
  for (let i = 1; i < executions.length; i++) {
    intervals.push(executions[i] - executions[i - 1])
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const maxDeviation = Math.max(
    ...intervals.map(i => Math.abs(i - targetInterval))
  )
  const minDeviation = Math.min(
    ...intervals.map(i => Math.abs(i - targetInterval))
  )

  log.info(`Results:
    Total executions: ${count}
    Average interval: ${avgInterval.toFixed(2)}ms
    Max deviation: ${maxDeviation.toFixed(2)}ms
    Min deviation: ${minDeviation.toFixed(2)}ms
    Target interval: ${targetInterval}ms
  `)
}

// Example 2: Long Interval with Recuperation
async function demonstrateLongIntervalRecuperation() {
  log.info('\n=== Long Interval with Recuperation Test ===')

  const longInterval = 60000 // 1 minute
  log.info(`Creating timer with ${longInterval}ms interval`)

  const timer = TimeKeeper.keep(
    longInterval,
    () => {
      log.info('Long interval timer executed')
    },
    1,
    'long-interval-test'
  )

  if (timer.kind === 'error') {
    log.error('Failed to create timer:', timer.error)
    return
  }

  // Check recuperation status
  const status = TimeKeeper.status()
  log.info(`Initial status:
    In recuperation: ${status.inRecuperation}
    Active formations: ${status.activeFormations}
    Total formations: ${status.totalFormations}
  `)

  // Wait a bit to see recuperation in action
  await waitWithProgress(5000, 'Waiting to observe recuperation')

  const updatedStatus = TimeKeeper.status()
  log.info(`Updated status:
    In recuperation: ${updatedStatus.inRecuperation}
    Active formations: ${updatedStatus.activeFormations}
    Total formations: ${updatedStatus.totalFormations}
  `)

  // Clean up
  TimeKeeper.forget('long-interval-test')
}

// Example 3: Concurrent Timers
async function demonstrateConcurrentTimers() {
  log.info('\n=== Concurrent Timers Test ===')

  const numTimers = 1000
  const executions = new Set<string>()
  const timers: string[] = []

  log.info(`Creating ${numTimers} concurrent timers`)

  // Create many concurrent timers
  for (let i = 0; i < numTimers; i++) {
    const id = `concurrent-timer-${i}`
    timers.push(id)

    TimeKeeper.keep(
      100, // 100ms interval
      () => {
        executions.add(id)
        process.stdout.write(`\rExecuted: ${executions.size}/${numTimers}`)
      },
      1,
      id
    )
  }

  // Wait for executions
  await waitWithProgress(2000, 'Waiting for concurrent executions')
  process.stdout.write('\n')

  // Verify executions
  const executionCount = executions.size
  log.info(`Results:
    Created timers: ${numTimers}
    Executed timers: ${executionCount}
    Success rate: ${((executionCount / numTimers) * 100).toFixed(2)}%
  `)

  // Clean up
  timers.forEach(id => TimeKeeper.forget(id))
}

// Example 4: Delay and Repeat Combinations
async function demonstrateDelayAndRepeat() {
  log.info('\n=== Delay and Repeat Combinations Test ===')

  const executions: number[] = []
  let count = 0

  log.info('Creating timer with delay and repeat')

  const timer = TimeKeeper.keep(
    100, // 100ms interval
    () => {
      executions.push(Date.now())
      count++
      log.info(`Execution ${count} at ${new Date().toISOString()}`)
    },
    3, // Execute 3 times
    'delay-repeat-test',
    200 // 200ms initial delay
  )

  if (timer.kind === 'error') {
    log.error('Failed to create timer:', timer.error)
    return
  }

  // Wait for all executions
  await waitWithProgress(1000, 'Waiting for executions')

  // Calculate intervals
  const intervals: number[] = []
  for (let i = 1; i < executions.length; i++) {
    intervals.push(executions[i] - executions[i - 1])
  }

  log.info(`Results:
    Total executions: ${count}
    Intervals: ${intervals.map(i => i.toFixed(0)).join(', ')}ms
  `)

  // Clean up
  TimeKeeper.forget('delay-repeat-test')
}

// Example 5: Stress Test
async function demonstrateStressTest() {
  log.info('\n=== Stress Test ===')

  const startTime = Date.now()
  const timers = new Set<string>()
  let activeTimers = 0
  let totalExecutions = 0
  let maxMemory = 0

  // Monitor memory usage
  const memoryInterval = setInterval(() => {
    const mem = process.memoryUsage()
    maxMemory = Math.max(maxMemory, mem.heapUsed)
    log.info(`Memory usage: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`)
  }, 5000)

  // Create and destroy timers rapidly
  const stressInterval = setInterval(() => {
    // Create new timers
    for (let i = 0; i < 100; i++) {
      const id = `stress-timer-${Date.now()}-${i}`
      timers.add(id)
      activeTimers++

      TimeKeeper.keep(
        Math.random() * 1000,
        () => {
          totalExecutions++
          process.stdout.write(
            `\rExecutions: ${totalExecutions} | Active timers: ${activeTimers}`
          )
        },
        Math.random() > 0.5 ? 1 : true,
        id
      )
    }

    // Destroy some timers
    for (const id of timers) {
      if (Math.random() > 0.7) {
        TimeKeeper.forget(id)
        timers.delete(id)
        activeTimers--
      }
    }
  }, 100)

  // Run stress test for 30 seconds
  await waitWithProgress(30000, 'Running stress test')
  process.stdout.write('\n')

  // Cleanup
  clearInterval(stressInterval)
  clearInterval(memoryInterval)
  TimeKeeper.hibernate()

  const duration = (Date.now() - startTime) / 1000

  log.info(`Stress test results:
    Duration: ${duration.toFixed(2)}s
    Total executions: ${totalExecutions}
    Max memory usage: ${(maxMemory / 1024 / 1024).toFixed(2)}MB
    Final active timers: ${activeTimers}
  `)

  // Clean up
  TimeKeeper.reset()
}

// Example 6: Edge Cases
async function demonstrateEdgeCases() {
  log.info('\n=== Edge Cases Test ===')

  // Test zero interval
  log.info('Testing zero interval')
  const zeroTimer = TimeKeeper.keep(
    0,
    () => {
      log.info('Zero interval timer executed')
    },
    1,
    'zero-interval'
  )
  log.info(`Zero interval timer creation: ${zeroTimer.kind}`)

  // Test negative interval
  log.info('\nTesting negative interval')
  const negativeTimer = TimeKeeper.keep(-100, () => {}, 1, 'negative-interval')
  log.info(`Negative interval timer creation: ${negativeTimer.kind}`)

  // Test very large interval
  log.info('\nTesting very large interval')
  const largeTimer = TimeKeeper.keep(
    Number.MAX_SAFE_INTEGER,
    () => {
      log.info('Large interval timer executed')
    },
    1,
    'large-interval'
  )
  log.info(`Large interval timer creation: ${largeTimer.kind}`)

  // Test invalid callback
  log.info('\nTesting invalid callback')
  const invalidCallbackTimer = TimeKeeper.keep(
    100,
    null as any,
    1,
    'invalid-callback'
  )
  log.info(`Invalid callback timer creation: ${invalidCallbackTimer.kind}`)

  // Test duplicate IDs
  log.info('\nTesting duplicate IDs')
  const id = 'duplicate-test'
  const timer1 = TimeKeeper.keep(100, () => {}, 1, id)
  const timer2 = TimeKeeper.keep(100, () => {}, 1, id)
  log.info(`Duplicate ID timers creation: ${timer1.kind}, ${timer2.kind}`)

  // Test rapid create/forget
  log.info('\nTesting rapid create/forget')
  for (let i = 0; i < 100; i++) {
    const timer = TimeKeeper.keep(100, () => {}, 1, `rapid-${i}`)
    TimeKeeper.forget(`rapid-${i}`)
  }
  log.info('Rapid create/forget completed')

  // Test wait with various durations
  log.info('\nTesting wait with various durations')
  await TimeKeeper.wait(0)
  await TimeKeeper.wait(10)
  await TimeKeeper.wait(100)
  log.info('Wait tests completed')

  // Test wait cancellation
  log.info('\nTesting wait cancellation')
  const waitPromise = TimeKeeper.wait(1000, 'wait-to-cancel')
  TimeKeeper.forget('wait-to-cancel')
  await waitPromise
  log.info('Wait cancellation completed')

  // Clean up
  TimeKeeper.hibernate()
  TimeKeeper.reset()
}

// Main demo runner
async function runDemo() {
  try {
    log.info('Starting TimeKeeper demo')

    // Run all demonstrations
    await demonstrateShortIntervalPrecision()
    await demonstrateLongIntervalRecuperation()
    await demonstrateConcurrentTimers()
    await demonstrateDelayAndRepeat()
    await demonstrateStressTest()
    await demonstrateEdgeCases()

    log.info('\nDemo completed successfully')
  } catch (error) {
    log.error('Demo failed:', error)
  } finally {
    // Clean up
    TimeKeeper.hibernate()
    TimeKeeper.reset()
  }
}

// Run the demo
runDemo().catch(console.error)
