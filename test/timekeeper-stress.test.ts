import {TimeKeeper} from '../src/components/cyre-timekeeper'
import {log} from '../src/components/cyre-log'
import {metricsState} from '../src/context/metrics-state'
import type {TimerRepeat} from '../src/types/timer'
import {expect, describe, it} from 'vitest'

// Utility functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const getMemoryUsage = () => process.memoryUsage()
const formatMemory = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)}MB`

// Test configurations
const TEST_CONFIG = {
  SHORT_INTERVAL: 10, // 10ms
  MEDIUM_INTERVAL: 100, // 100ms
  LONG_INTERVAL: 1000, // 1s
  VERY_LONG_INTERVAL: 60000, // 1min
  CONCURRENT_TIMERS: 1000,
  STRESS_DURATION: 30000, // 30s
  MEMORY_CHECK_INTERVAL: 5000 // 5s
}

// Performance metrics
const metrics = {
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  averageExecutionTime: 0,
  maxExecutionTime: 0,
  minExecutionTime: Infinity,
  memoryUsage: [] as number[],
  startTime: 0,
  endTime: 0
}

describe('TimeKeeper Stress Tests', () => {
  beforeEach(() => {
    // Reset metrics
    metrics.totalExecutions = 0
    metrics.successfulExecutions = 0
    metrics.failedExecutions = 0
    metrics.averageExecutionTime = 0
    metrics.maxExecutionTime = 0
    metrics.minExecutionTime = Infinity
    metrics.memoryUsage = []
    metrics.startTime = 0
    metrics.endTime = 0

    // Reset TimeKeeper
    TimeKeeper.reset()
  })

  afterEach(() => {
    // Clean up
    TimeKeeper.reset()
  })

  it('should handle short intervals accurately', async () => {
    await runShortIntervalTest()
  })

  it('should handle long intervals with recuperation', async () => {
    await runLongIntervalTest()
  })

  it('should handle concurrent timers efficiently', async () => {
    await runConcurrentTimersTest()
  })

  it('should handle delay and repeat combinations', async () => {
    await runDelayAndRepeatTest()
  })

  it('should handle stress test scenarios', async () => {
    await runStressTest()
  })

  it('should handle edge cases properly', async () => {
    await runEdgeCasesTest()
  })
})

// Test scenarios
async function runShortIntervalTest() {
  log.info('Testing short interval timers (10ms)')
  const executions: number[] = []
  let count = 0

  const timer = TimeKeeper.keep(
    TEST_CONFIG.SHORT_INTERVAL,
    () => {
      const now = performance.now()
      executions.push(now)
      count++
    },
    100, // Execute 100 times
    'short-interval-test'
  )

  expect(timer.kind).toBe('ok')
  await sleep(TEST_CONFIG.SHORT_INTERVAL * 110) // Wait for all executions

  // Calculate timing accuracy
  const intervals: number[] = []
  for (let i = 1; i < executions.length; i++) {
    intervals.push(executions[i] - executions[i - 1])
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const maxDeviation = Math.max(
    ...intervals.map(i => Math.abs(i - TEST_CONFIG.SHORT_INTERVAL))
  )

  log.info(`Short interval test results:
    Total executions: ${count}
    Average interval: ${avgInterval.toFixed(2)}ms
    Max deviation: ${maxDeviation.toFixed(2)}ms
    Target interval: ${TEST_CONFIG.SHORT_INTERVAL}ms
  `)

  expect(count).toBe(100)
  expect(maxDeviation).toBeLessThan(TEST_CONFIG.SHORT_INTERVAL * 2)
}

async function runLongIntervalTest() {
  log.info('Testing long interval timers (1min)')
  const startTime = Date.now()
  let executed = false

  const timer = TimeKeeper.keep(
    TEST_CONFIG.VERY_LONG_INTERVAL,
    () => {
      executed = true
    },
    1,
    'long-interval-test'
  )

  expect(timer.kind).toBe('ok')

  // Check recuperation status
  const status = TimeKeeper.status()
  expect(status.inRecuperation).toBe(true)

  // Wait for a short time to verify timer is created
  await sleep(1000)
  expect(executed).toBe(false)

  // Clean up
  TimeKeeper.forget('long-interval-test')
}

async function runConcurrentTimersTest() {
  log.info(`Testing ${TEST_CONFIG.CONCURRENT_TIMERS} concurrent timers`)
  const executions = new Set<string>()
  const timers: string[] = []

  // Create many concurrent timers
  for (let i = 0; i < TEST_CONFIG.CONCURRENT_TIMERS; i++) {
    const id = `concurrent-timer-${i}`
    timers.push(id)

    TimeKeeper.keep(
      TEST_CONFIG.MEDIUM_INTERVAL,
      () => {
        executions.add(id)
      },
      1,
      id
    )
  }

  // Wait for executions
  await sleep(TEST_CONFIG.MEDIUM_INTERVAL * 2)

  // Verify executions
  const executionCount = executions.size
  log.info(`Concurrent timers test results:
    Created timers: ${TEST_CONFIG.CONCURRENT_TIMERS}
    Executed timers: ${executionCount}
    Success rate: ${(
      (executionCount / TEST_CONFIG.CONCURRENT_TIMERS) *
      100
    ).toFixed(2)}%
  `)

  expect(executionCount).toBeGreaterThan(TEST_CONFIG.CONCURRENT_TIMERS * 0.95)
}

async function runDelayAndRepeatTest() {
  log.info('Testing delay and repeat combinations')
  const executions: number[] = []
  let count = 0

  // Test with delay and repeat
  const timer = TimeKeeper.keep(
    TEST_CONFIG.MEDIUM_INTERVAL,
    () => {
      executions.push(Date.now())
      count++
    },
    3, // Repeat 3 times
    'delay-repeat-test',
    TEST_CONFIG.MEDIUM_INTERVAL // Delay first execution
  )

  expect(timer.kind).toBe('ok')
  await sleep(TEST_CONFIG.MEDIUM_INTERVAL * 5)

  // Verify timing
  const intervals: number[] = []
  for (let i = 1; i < executions.length; i++) {
    intervals.push(executions[i] - executions[i - 1])
  }

  log.info(`Delay and repeat test results:
    Total executions: ${count}
    Intervals: ${intervals.map(i => i.toFixed(0)).join(', ')}ms
  `)

  expect(count).toBe(3)
  expect(intervals[0]).toBeGreaterThanOrEqual(TEST_CONFIG.MEDIUM_INTERVAL)
}

async function runStressTest() {
  log.info('Starting stress test')
  metrics.startTime = Date.now()
  const timers = new Set<string>()
  let activeTimers = 0

  // Monitor memory usage
  const memoryInterval = setInterval(() => {
    const mem = getMemoryUsage()
    metrics.memoryUsage.push(mem.heapUsed)
    log.info(`Memory usage: ${formatMemory(mem.heapUsed)}`)
  }, TEST_CONFIG.MEMORY_CHECK_INTERVAL)

  // Create and destroy timers rapidly
  const stressInterval = setInterval(() => {
    // Create new timers
    for (let i = 0; i < 100; i++) {
      const id = `stress-timer-${Date.now()}-${i}`
      timers.add(id)
      activeTimers++

      const repeat: TimerRepeat = Math.random() > 0.5 ? 1 : true
      TimeKeeper.keep(
        Math.random() * 1000,
        () => {
          metrics.totalExecutions++
          const start = performance.now()
          // Simulate some work
          let result = 0
          for (let i = 0; i < 1000; i++) {
            result += Math.sqrt(i)
          }
          const duration = performance.now() - start

          metrics.averageExecutionTime =
            (metrics.averageExecutionTime * (metrics.totalExecutions - 1) +
              duration) /
            metrics.totalExecutions
          metrics.maxExecutionTime = Math.max(
            metrics.maxExecutionTime,
            duration
          )
          metrics.minExecutionTime = Math.min(
            metrics.minExecutionTime,
            duration
          )
        },
        repeat as TimerRepeat,
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

  // Run stress test for configured duration
  await sleep(TEST_CONFIG.STRESS_DURATION)

  // Cleanup
  clearInterval(stressInterval)
  clearInterval(memoryInterval)
  TimeKeeper.hibernate()

  metrics.endTime = Date.now()
  const duration = (metrics.endTime - metrics.startTime) / 1000

  // Calculate final metrics
  const maxMemory = Math.max(...metrics.memoryUsage)
  const avgMemory =
    metrics.memoryUsage.reduce((a, b) => a + b, 0) / metrics.memoryUsage.length

  log.info(`Stress test results:
    Duration: ${duration.toFixed(2)}s
    Total executions: ${metrics.totalExecutions}
    Average execution time: ${metrics.averageExecutionTime.toFixed(2)}ms
    Max execution time: ${metrics.maxExecutionTime.toFixed(2)}ms
    Min execution time: ${metrics.minExecutionTime.toFixed(2)}ms
    Max memory usage: ${formatMemory(maxMemory)}
    Average memory usage: ${formatMemory(avgMemory)}
    Final active timers: ${activeTimers}
  `)

  // Verify system stability
  expect(metrics.totalExecutions).toBeGreaterThan(0)
  expect(metrics.averageExecutionTime).toBeLessThan(100) // Should be reasonably fast
  expect(maxMemory).toBeLessThan(1024 * 1024 * 1024) // Should use less than 1GB
}

async function runEdgeCasesTest() {
  log.info('Testing edge cases')

  // Test zero interval
  const zeroTimer = TimeKeeper.keep(0, () => {}, 1, 'zero-interval')
  expect(zeroTimer.kind).toBe('ok')

  // Test negative interval
  const negativeTimer = TimeKeeper.keep(-100, () => {}, 1, 'negative-interval')
  expect(negativeTimer.kind).toBe('error')

  // Test very large interval
  const largeTimer = TimeKeeper.keep(
    Number.MAX_SAFE_INTEGER,
    () => {},
    1,
    'large-interval'
  )
  expect(largeTimer.kind).toBe('ok')

  // Test invalid callback
  const invalidCallbackTimer = TimeKeeper.keep(
    100,
    null as any,
    1,
    'invalid-callback'
  )
  expect(invalidCallbackTimer.kind).toBe('error')

  // Test duplicate IDs
  const id = 'duplicate-test'
  const timer1 = TimeKeeper.keep(100, () => {}, 1, id)
  const timer2 = TimeKeeper.keep(100, () => {}, 1, id)
  expect(timer1.kind).toBe('ok')
  expect(timer2.kind).toBe('ok')

  // Test rapid create/forget
  for (let i = 0; i < 100; i++) {
    const timer = TimeKeeper.keep(100, () => {}, 1, `rapid-${i}`)
    TimeKeeper.forget(`rapid-${i}`)
  }

  // Test wait with various durations
  await TimeKeeper.wait(0)
  await TimeKeeper.wait(10)
  await TimeKeeper.wait(100)

  // Test wait cancellation
  const waitPromise = TimeKeeper.wait(1000, 'wait-to-cancel')
  TimeKeeper.forget('wait-to-cancel')
  await expect(waitPromise as any).resolves.toBeUndefined()

  // Clean up
  TimeKeeper.hibernate()
  TimeKeeper.reset()
}

// Main test runner
async function runAllTests() {
  try {
    log.info('Starting TimeKeeper stress tests')

    // Run all test scenarios
    await runShortIntervalTest()
    await runLongIntervalTest()
    await runConcurrentTimersTest()
    await runDelayAndRepeatTest()
    await runEdgeCasesTest()
    await runStressTest()

    log.info('All tests completed successfully')
  } catch (error) {
    log.error('Test failed:', error)
    throw error
  } finally {
    // Clean up
    TimeKeeper.hibernate()
    TimeKeeper.reset()
  }
}

// Run tests
runAllTests().catch(console.error)
