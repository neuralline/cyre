import {TimeKeeper} from '../src/components/cyre-timekeeper'
import {log} from '../src/components/cyre-log'

// Benchmark configuration
const BENCHMARK_CONFIG = {
  ITERATIONS: 1000,
  WARMUP_ITERATIONS: 100,
  TIMEOUT: 30000,
  MEMORY_CHECK_INTERVAL: 5000,
  CONCURRENT_TIMERS: {
    SMALL: 100,
    MEDIUM: 1000,
    LARGE: 10000
  },
  INTERVALS: {
    SHORT: 10, // 10ms
    MEDIUM: 100, // 100ms
    LONG: 1000 // 1s
  }
}

// Benchmark results interface
interface BenchmarkResult {
  name: string
  operations: number
  duration: number
  opsPerSecond: number
  memoryUsage: {
    start: number
    end: number
    peak: number
  }
  errors: number
  details?: Record<string, any>
}

// Utility for measuring memory usage
const getMemoryUsage = () => {
  const mem = process.memoryUsage()
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss
  }
}

// Utility for formatting memory
const formatMemory = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)}MB`

// Utility for measuring execution time
const measureExecution = async (fn: () => Promise<void> | void) => {
  const start = performance.now()
  await fn()
  return performance.now() - start
}

// Benchmark runner
class BenchmarkRunner {
  private results: BenchmarkResult[] = []
  private startMemory = getMemoryUsage()
  private peakMemory = this.startMemory
  private currentDetails: Record<string, any> = {}

  constructor() {
    // Monitor memory usage
    setInterval(() => {
      const current = getMemoryUsage()
      this.peakMemory = {
        heapUsed: Math.max(this.peakMemory.heapUsed, current.heapUsed),
        heapTotal: Math.max(this.peakMemory.heapTotal, current.heapTotal),
        external: Math.max(this.peakMemory.external, current.external),
        rss: Math.max(this.peakMemory.rss, current.rss)
      }
    }, BENCHMARK_CONFIG.MEMORY_CHECK_INTERVAL)
  }

  async runBenchmark(
    name: string,
    fn: () => Promise<void> | void,
    iterations: number = BENCHMARK_CONFIG.ITERATIONS
  ): Promise<BenchmarkResult> {
    log.info(`\nRunning benchmark: ${name}`)
    this.currentDetails = {}

    // Warmup
    for (let i = 0; i < BENCHMARK_CONFIG.WARMUP_ITERATIONS; i++) {
      await fn()
    }

    const startTime = performance.now()
    let errors = 0

    // Run benchmark
    for (let i = 0; i < iterations; i++) {
      try {
        await fn()
      } catch (error) {
        errors++
        log.error(`Error in iteration ${i}:`, error)
      }
    }

    const duration = performance.now() - startTime
    const endMemory = getMemoryUsage()

    const result: BenchmarkResult = {
      name,
      operations: iterations,
      duration,
      opsPerSecond: (iterations / duration) * 1000,
      memoryUsage: {
        start: this.startMemory.heapUsed,
        end: endMemory.heapUsed,
        peak: this.peakMemory.heapUsed
      },
      errors,
      details: this.currentDetails
    }

    this.results.push(result)
    return result
  }

  setDetails(details: Record<string, any>) {
    this.currentDetails = details
  }

  printResults() {
    log.info('\n=== Benchmark Results ===')
    this.results.forEach(result => {
      log.info(`\n${result.name}:
        Operations: ${result.operations}
        Duration: ${result.duration.toFixed(2)}ms
        Ops/sec: ${result.opsPerSecond.toFixed(2)}
        Memory:
          Start: ${formatMemory(result.memoryUsage.start)}
          End: ${formatMemory(result.memoryUsage.end)}
          Peak: ${formatMemory(result.memoryUsage.peak)}
        Errors: ${result.errors}
        ${
          result.details
            ? `Details: ${JSON.stringify(result.details, null, 2)}`
            : ''
        }
      `)
    })
  }
}

// Benchmark scenarios
async function runBenchmarks() {
  const runner = new BenchmarkRunner()

  // 1. Timer Creation Performance
  await runner.runBenchmark('Timer Creation', async () => {
    const id = `timer-${Date.now()}-${Math.random()}`
    TimeKeeper.keep(100, () => {}, 1, id)
    TimeKeeper.forget(id)
  })

  // 2. Short Interval Precision
  await runner.runBenchmark('Short Interval Precision', async () => {
    const executions: number[] = []
    let count = 0
    const targetInterval = BENCHMARK_CONFIG.INTERVALS.SHORT

    const timer = TimeKeeper.keep(
      targetInterval,
      () => {
        executions.push(performance.now())
        count++
      },
      10,
      'short-interval-test'
    )

    if (timer.kind === 'error') {
      throw timer.error
    }

    await new Promise(resolve => setTimeout(resolve, targetInterval * 11))
    TimeKeeper.forget('short-interval-test')

    // Calculate timing accuracy
    const intervals: number[] = []
    for (let i = 1; i < executions.length; i++) {
      intervals.push(executions[i] - executions[i - 1])
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const maxDeviation = Math.max(
      ...intervals.map(i => Math.abs(i - targetInterval))
    )

    runner.setDetails({
      avgInterval,
      maxDeviation,
      count
    })
  })

  // 3. Concurrent Timer Creation
  await runner.runBenchmark('Concurrent Timer Creation', async () => {
    const timers: string[] = []
    const executions = new Set<string>()

    // Create timers
    for (let i = 0; i < BENCHMARK_CONFIG.CONCURRENT_TIMERS.MEDIUM; i++) {
      const id = `concurrent-${i}`
      timers.push(id)
      TimeKeeper.keep(100, () => executions.add(id), 1, id)
    }

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 200))

    // Clean up
    timers.forEach(id => TimeKeeper.forget(id))

    runner.setDetails({
      created: timers.length,
      executed: executions.size
    })
  })

  // 4. Memory Usage Under Load
  await runner.runBenchmark('Memory Usage Under Load', async () => {
    const timers = new Set<string>()
    let activeTimers = 0

    // Create and destroy timers rapidly
    for (let i = 0; i < 1000; i++) {
      const id = `memory-test-${i}`
      timers.add(id)
      activeTimers++

      TimeKeeper.keep(
        Math.random() * 1000,
        () => {},
        Math.random() > 0.5 ? 1 : true,
        id
      )

      if (Math.random() > 0.7) {
        TimeKeeper.forget(id)
        timers.delete(id)
        activeTimers--
      }
    }

    // Clean up
    timers.forEach(id => TimeKeeper.forget(id))

    // Add a small delay before hibernation to allow state to settle
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      TimeKeeper.hibernate()
      // Add another small delay after hibernation
      await new Promise(resolve => setTimeout(resolve, 100))
      TimeKeeper.reset()
    } catch (error) {
      log.error('Hibernation failed:', error)
      // Force cleanup even if hibernation fails
      TimeKeeper.reset()
    }

    runner.setDetails({
      activeTimers,
      totalCreated: 1000
    })
  })

  // 5. Timer Cancellation Performance
  await runner.runBenchmark('Timer Cancellation', async () => {
    const timers: string[] = []

    // Create timers
    for (let i = 0; i < 100; i++) {
      const id = `cancel-test-${i}`
      timers.push(id)
      TimeKeeper.keep(1000, () => {}, 1, id)
    }

    // Cancel timers
    const start = performance.now()
    timers.forEach(id => TimeKeeper.forget(id))
    const duration = performance.now() - start

    runner.setDetails({
      cancellationTime: duration,
      timersCancelled: timers.length
    })
  })

  // 6. Long Interval Handling
  await runner.runBenchmark('Long Interval Handling', async () => {
    const timer = TimeKeeper.keep(
      BENCHMARK_CONFIG.INTERVALS.LONG,
      () => {},
      1,
      'long-interval-test'
    )

    if (timer.kind === 'error') {
      throw timer.error
    }

    const status = TimeKeeper.status()
    TimeKeeper.forget('long-interval-test')

    runner.setDetails({
      inRecuperation: status.inRecuperation,
      activeFormations: status.activeFormations
    })
  })

  // Print results
  runner.printResults()
}

// Run benchmarks
runBenchmarks().catch(error => {
  log.error('Benchmark failed:', error)
  process.exit(1)
})
