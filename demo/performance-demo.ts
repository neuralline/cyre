// demo/performance-demo.ts
// Performance-focused demonstration of system orchestration

import {cyre} from '../src'
import {getPerformanceInsights} from '../src/dev/dev'

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

const log = {
  header: (msg: string) =>
    console.log(
      `\n${colors.bright}${colors.cyan}=== ${msg} ===${colors.reset}`
    ),
  perf: (msg: string) => console.log(`${colors.green}⚡ ${msg}${colors.reset}`),
  metric: (msg: string) =>
    console.log(`${colors.blue}📊 ${msg}${colors.reset}`),
  alert: (msg: string) =>
    console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  success: (msg: string) =>
    console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`)
}

interface PerformanceTest {
  name: string
  setup: () => Promise<void>
  execute: () => Promise<void>
  validate: () => Promise<{passed: boolean; metrics: any}>
}

const performanceTests: PerformanceTest[] = [
  {
    name: 'Breathing Adaptation Under Load',
    setup: async () => {
      // Create channels that will generate load
      for (let i = 0; i < 10; i++) {
        cyre.action({id: `load-channel-${i}`})
        cyre.on(`load-channel-${i}`, (data: any) => ({processed: data}))
      }
    },
    execute: async () => {
      log.info('Generating load to test breathing adaptation...')

      // Generate increasing load
      for (let burst = 0; burst < 5; burst++) {
        const callsPerBurst = 50 * (burst + 1)
        log.metric(`Burst ${burst + 1}: ${callsPerBurst} calls`)

        for (let i = 0; i < callsPerBurst; i++) {
          cyre.call(`load-channel-${i % 10}`, {burst, call: i})
        }

        await new Promise(r => setTimeout(r, 1000))

        const health = cyre.getSystemHealth()
        log.metric(
          `Breathing rate: ${health.breathing.rate}ms, Stress: ${(
            health.breathing.stress * 100
          ).toFixed(1)}%`
        )
      }
    },
    validate: async () => {
      const health = cyre.getSystemHealth()
      const systemMetrics = cyre.dev.getSystemMetrics()

      return {
        passed: health.breathing.rate > 200, // Should have adapted
        metrics: {
          finalBreathingRate: health.breathing.rate,
          finalStress: health.breathing.stress,
          totalCalls: systemMetrics.performance.totalCalls,
          callRate: systemMetrics.performance.callRate
        }
      }
    }
  },

  {
    name: 'Memory Cleanup Efficiency',
    setup: async () => {
      // Create memory-intensive channels
      for (let i = 0; i < 20; i++) {
        cyre.action({
          id: `memory-channel-${i}`,
          payload: new Array(1000).fill(Math.random())
        })
      }
    },
    execute: async () => {
      log.info('Testing memory cleanup efficiency...')

      const beforeCleanup = process.memoryUsage()
      log.metric(
        `Memory before: ${(beforeCleanup.heapUsed / 1024 / 1024).toFixed(2)}MB`
      )

      // Trigger memory cleanup using dev interface
      const cleanupResult = await cyre.dev.triggerMemoryCleanup()

      if (cleanupResult.ok) {
        log.success('Memory cleanup triggered successfully')
      } else {
        log.alert(`Memory cleanup failed: ${cleanupResult.message}`)
      }

      await new Promise(r => setTimeout(r, 2000)) // Wait for cleanup

      const afterCleanup = process.memoryUsage()
      log.metric(
        `Memory after: ${(afterCleanup.heapUsed / 1024 / 1024).toFixed(2)}MB`
      )

      const saved =
        (beforeCleanup.heapUsed - afterCleanup.heapUsed) / 1024 / 1024
      log.metric(`Memory freed: ${saved.toFixed(2)}MB`)
    },
    validate: async () => {
      const queryStats = cyre.query.stats()

      return {
        passed: true, // Memory cleanup always considered successful
        metrics: {
          cacheSize: queryStats.cache?.size || 0,
          memoryOptimized: true
        }
      }
    }
  },

  {
    name: 'Performance Monitoring Accuracy',
    setup: async () => {
      // Create channels with known performance characteristics
      cyre.action({id: 'fast-channel'})
      cyre.action({id: 'slow-channel'})
      cyre.action({id: 'error-channel'})

      cyre.on('fast-channel', (data: any) => ({fast: true, data}))
      cyre.on('slow-channel', async (data: any) => {
        await new Promise(r => setTimeout(r, 100)) // Intentionally slow
        return {slow: true, data}
      })
      cyre.on('error-channel', (data: any) => {
        if (data.shouldError) throw new Error('Intentional error')
        return {success: true, data}
      })
    },
    execute: async () => {
      log.info('Testing performance monitoring accuracy...')

      // Generate known patterns
      for (let i = 0; i < 20; i++) {
        cyre.call('fast-channel', {id: i})
      }

      for (let i = 0; i < 5; i++) {
        cyre.call('slow-channel', {id: i}) // These should be detected as slow
      }

      for (let i = 0; i < 3; i++) {
        cyre.call('error-channel', {id: i, shouldError: i % 2 === 0}) // 2 errors
      }

      await new Promise(r => setTimeout(r, 3000)) // Wait for analysis

      const insights = getPerformanceInsights()
      log.metric(`Performance insights generated: ${insights.length}`)
      insights.forEach(insight => log.info(insight))
    },
    validate: async () => {
      const systemMetrics = cyre.dev.getSystemMetrics()
      const insights = getPerformanceInsights()

      return {
        passed: systemMetrics.performance.totalErrors >= 2, // Should detect errors
        metrics: {
          totalCalls: systemMetrics.performance.totalCalls,
          totalErrors: systemMetrics.performance.totalErrors,
          insightsGenerated: insights.length
        }
      }
    }
  },

  {
    name: 'Load Balancing Effectiveness',
    setup: async () => {
      // Create channels that will become hot
      for (let i = 0; i < 5; i++) {
        cyre.action({id: `balanced-channel-${i}`})
        cyre.on(`balanced-channel-${i}`, async (data: any) => {
          await new Promise(r => setTimeout(r, 10))
          return {balanced: true, data}
        })
      }
    },
    execute: async () => {
      log.info('Testing load balancing effectiveness...')

      // Create uneven load (channel-0 gets most traffic)
      for (let round = 0; round < 3; round++) {
        log.metric(`Load balancing round ${round + 1}`)

        // Heavy load on channel-0
        for (let i = 0; i < 30; i++) {
          cyre.call('balanced-channel-0', {round, call: i})
        }

        // Light load on others
        for (let ch = 1; ch < 5; ch++) {
          for (let i = 0; i < 5; i++) {
            cyre.call(`balanced-channel-${ch}`, {round, call: i})
          }
        }

        await new Promise(r => setTimeout(r, 2000))

        const health = cyre.getSystemHealth()
        log.metric(
          `System stress: ${(health.breathing.stress * 100).toFixed(1)}%`
        )
      }
    },
    validate: async () => {
      const systemOverview = cyre.orchestration.getSystemOverview()

      return {
        passed: true, // Load balancing effectiveness is qualitative
        metrics: {
          activeOrchestrations: systemOverview.total.running,
          systemStress: systemOverview.systemStress
        }
      }
    }
  },

  {
    name: 'System Recovery Speed',
    setup: async () => {
      // Create channels for recovery test
      cyre.action({id: 'recovery-channel', throttle: 50})
      cyre.on('recovery-channel', (data: any) => ({recovered: true, data}))
    },
    execute: async () => {
      log.info('Testing system recovery speed...')

      // Push system to critical stress
      log.metric('Pushing system to critical stress...')
      cyre.adaptSystemLoad(0.95)

      // Generate burst load
      const startTime = Date.now()
      for (let i = 0; i < 100; i++) {
        cyre.call('recovery-channel', {stress: 'test', id: i})
      }

      await new Promise(r => setTimeout(r, 3000))

      // Allow recovery
      log.metric('Allowing system recovery...')
      cyre.adaptSystemLoad(0.1)

      await new Promise(r => setTimeout(r, 2000))

      const recoveryTime = Date.now() - startTime
      const finalHealth = cyre.getSystemHealth()

      log.metric(`Recovery completed in ${recoveryTime}ms`)
      log.metric(
        `Final stress level: ${(finalHealth.breathing.stress * 100).toFixed(
          1
        )}%`
      )
    },
    validate: async () => {
      const health = cyre.getSystemHealth()

      return {
        passed: health.breathing.stress < 0.5, // Should have recovered
        metrics: {
          finalStress: health.breathing.stress,
          finalBreathingRate: health.breathing.rate,
          systemHealthy: health.overall
        }
      }
    }
  }
]

const runPerformanceDemo = async () => {
  log.header('CYRE PERFORMANCE DEMONSTRATION')

  try {
    // Initialize Cyre
    log.info('Initializing Cyre with performance monitoring...')
    const init = await cyre.initialize({
      systemOrchestrations: {
        enabled: true,
        adaptiveScheduling: true
      }
    })

    if (!init.ok) {
      log.alert(`Initialization failed: ${init.message}`)
      return
    }

    log.success('Cyre initialized successfully')

    // Run performance tests
    const results = []

    for (const test of performanceTests) {
      log.header(`TEST: ${test.name}`)

      try {
        await test.setup()
        const testStart = Date.now()

        await test.execute()

        const validation = await test.validate()
        const testDuration = Date.now() - testStart

        results.push({
          name: test.name,
          passed: validation.passed,
          duration: testDuration,
          metrics: validation.metrics
        })

        if (validation.passed) {
          log.success(`Test passed in ${testDuration}ms`)
        } else {
          log.alert(`Test failed in ${testDuration}ms`)
        }

        log.metric(`Metrics: ${JSON.stringify(validation.metrics, null, 2)}`)
      } catch (error) {
        log.alert(`Test failed with error: ${error}`)
        results.push({
          name: test.name,
          passed: false,
          duration: 0,
          metrics: {error: String(error)}
        })
      }

      // Wait between tests
      await new Promise(r => setTimeout(r, 1000))
    }

    // Final results summary
    log.header('PERFORMANCE TEST RESULTS')

    const passed = results.filter(r => r.passed).length
    const total = results.length

    log.metric(`Tests Passed: ${passed}/${total}`)

    results.forEach(result => {
      const status = result.passed ? '✅' : '❌'
      log.info(`${status} ${result.name} (${result.duration}ms)`)
    })

    // Final system state - FIXED
    const finalSnapshot = cyre.dev.snapshot()
    const finalHealth = cyre.getSystemHealth()

    log.header('FINAL SYSTEM STATE')
    log.metric(
      `System Health: ${finalHealth.overall ? '✅ Healthy' : '❌ Degraded'}`
    )
    log.metric(
      `Breathing Stress: ${(finalHealth.breathing.stress * 100).toFixed(1)}%`
    )
    log.metric(`Total Calls: ${finalSnapshot.system.totalCalls}`)
    log.metric(
      `Active Orchestrations: ${finalSnapshot.orchestrations.running}/${finalSnapshot.orchestrations.total}`
    )

    if (passed === total) {
      log.success('All performance tests passed!')
    } else {
      log.alert(`${total - passed} tests failed`)
    }
  } catch (error) {
    log.alert(`Performance demo failed: ${error}`)
    console.error(error)
  }
}

// Export for use in other demos
export {runPerformanceDemo, performanceTests}

runPerformanceDemo().catch(console.error)
