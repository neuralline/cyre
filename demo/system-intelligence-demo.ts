// demo/system-intelligence-demo.ts
// Demonstration of the working system intelligence

import {cyre} from '../src'

/*

      C.Y.R.E - S.Y.S.T.E.M - I.N.T.E.L.L.I.G.E.N.C.E - D.E.M.O
      
      Demonstrates the working system intelligence:
      - Orchestrations running automatically
      - Breathing adaptation in real-time
      - Memory management
      - Performance monitoring
      - Health checks
      - Manual diagnostics

*/

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
}

const log = {
  header: (msg: string) =>
    console.log(
      `\n${colors.bright}${colors.cyan}=== ${msg} ===${colors.reset}`
    ),
  info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg: string) =>
    console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warn: (msg: string) =>
    console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  data: (msg: string) =>
    console.log(`${colors.magenta}📊 ${msg}${colors.reset}`)
}

/**
 * Wait for orchestrations to execute and observe
 */
const observeSystemIntelligence = async (durationSeconds: number = 45) => {
  log.header('OBSERVING SYSTEM INTELLIGENCE')
  log.info(`Watching system for ${durationSeconds} seconds...`)
  log.info('Look for orchestration logs every 15-35 seconds')

  let observationCount = 0
  const startTime = Date.now()
  const endTime = startTime + durationSeconds * 1000

  // Log system state every 10 seconds
  const logInterval = setInterval(() => {
    observationCount++
    const elapsed = Math.floor((Date.now() - startTime) / 1000)

    const breathing = cyre.getBreathingState()
    const performance = cyre.getPerformanceState()
    const health = cyre.getSystemHealth()

    log.data(`[${elapsed}s] Observation ${observationCount}:`)
    log.data(
      `  Breathing: ${breathing.currentRate.toFixed(1)}ms rate, ${(
        breathing.stress * 100
      ).toFixed(1)}% stress`
    )
    log.data(
      `  Performance: ${performance.totalCalls} calls, ${(
        performance.successRate * 100
      ).toFixed(1)}% success`
    )
    log.data(`  Health: ${health.overall ? 'Healthy' : 'Needs attention'}`)

    if (elapsed >= durationSeconds) {
      clearInterval(logInterval)
      log.success('Observation period complete!')
    }
  }, 10000)

  // Wait for the full duration
  await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000))
}

/**
 * Generate some system load to trigger adaptations
 */
const generateSystemLoad = async () => {
  log.header('GENERATING SYSTEM LOAD')
  log.info(
    'Creating channels and generating calls to trigger system adaptations...'
  )

  // Create test channels
  for (let i = 0; i < 5; i++) {
    cyre.action({id: `test-load-${i}`})
    cyre.on(`test-load-${i}`, (data: any) => ({
      processed: data,
      timestamp: Date.now()
    }))
  }

  // Generate increasing load
  for (let burst = 1; burst <= 3; burst++) {
    log.info(`Load burst ${burst}: ${burst * 25} calls`)

    for (let i = 0; i < burst * 25; i++) {
      cyre.call(`test-load-${i % 5}`, {burst, call: i})
    }

    await new Promise(resolve => setTimeout(resolve, 2000))

    const breathing = cyre.getBreathingState()
    log.data(
      `After burst ${burst}: ${breathing.currentRate.toFixed(
        1
      )}ms breathing, ${(breathing.stress * 100).toFixed(1)}% stress`
    )
  }

  log.success('Load generation complete - watch for system adaptations!')
}

/**
 * Test manual diagnostics
 */
const testManualDiagnostics = async () => {
  log.header('MANUAL DIAGNOSTICS TEST')
  log.info('Running manual system diagnostics...')

  try {
    // If diagnostics are available, run them
    if (typeof cyre.runSystemDiagnostics === 'function') {
      const diagnostics = await cyre.runSystemDiagnostics()

      if (diagnostics) {
        log.success(
          `Diagnostics complete! Overall status: ${diagnostics.overall}`
        )
        log.data(`System score: ${diagnostics.score}/100`)
        log.data(`Tests run: ${diagnostics.results.length}`)

        diagnostics.results.forEach(result => {
          const icon =
            result.status === 'pass'
              ? '✅'
              : result.status === 'fail'
              ? '❌'
              : result.status === 'warn'
              ? '⚠️'
              : 'ℹ️'
          log.info(`${icon} ${result.component}: ${result.message}`)
        })

        if (diagnostics.recommendations.length > 0) {
          log.info('Recommendations:')
          diagnostics.recommendations.forEach((rec, i) => {
            log.info(`  ${i + 1}. ${rec}`)
          })
        }
      } else {
        log.warn('Diagnostics returned no data')
      }
    } else {
      log.warn('Manual diagnostics not available - using basic system overview')

      // Use basic system overview instead
      const overview = cyre.getSystemDiagnostics()
      log.data(
        `Orchestrations: ${overview.orchestrations.running}/${overview.orchestrations.total} running`
      )
      log.data(
        `Timeline: ${overview.timeline.active}/${overview.timeline.total} active timers`
      )
      log.data(
        `Breathing: ${overview.breathing.rate.toFixed(1)}ms, ${(
          overview.breathing.stress * 100
        ).toFixed(1)}% stress`
      )
      log.data(
        `Metrics: ${overview.metrics.totalCalls} calls, ${overview.metrics.callRate}/sec`
      )
    }
  } catch (error) {
    log.warn(`Manual diagnostics failed: ${error}`)
  }
}

/**
 * Show orchestration status
 */
const showOrchestrationStatus = () => {
  log.header('ORCHESTRATION STATUS')

  const overview = cyre.orchestration.getSystemOverview()

  log.data(`Total Orchestrations: ${overview.total.orchestrations}`)
  log.data(`Running: ${overview.total.running}`)
  log.data(`Timeline Entries: ${overview.total.timelineEntries}`)
  log.data(`Active Triggers: ${overview.total.activeTriggers}`)
  log.data(`System Stress: ${(overview.systemStress * 100).toFixed(1)}%`)
  log.data(`Breathing Rate: ${overview.breathing.currentRate.toFixed(1)}ms`)

  const orchestrations = cyre.orchestration.list()

  log.info('Active System Orchestrations:')
  orchestrations.forEach(runtime => {
    const status = cyre.orchestration.getStatus(runtime.config.id)
    const statusIcon = status?.isActive ? '🟢' : '🔴'
    log.info(
      `  ${statusIcon} ${runtime.config.id}: ${runtime.status} (${runtime.executionCount} executions)`
    )
  })
}

/**
 * Main demo function
 */
const runSystemIntelligenceDemo = async () => {
  try {
    log.header('CYRE SYSTEM INTELLIGENCE DEMONSTRATION')

    // Initialize Cyre
    log.info('Initializing Cyre with system intelligence...')
    const init = await cyre.initialize()

    if (!init.ok) {
      log.warn(`Initialization failed: ${init.message}`)
      return
    }

    log.success('Cyre initialized with system intelligence!')

    // Show initial status
    showOrchestrationStatus()

    // Generate some load to trigger adaptations
    await generateSystemLoad()

    // Observe system intelligence for 45 seconds
    await observeSystemIntelligence(45)

    // Test manual diagnostics
    await testManualDiagnostics()

    // Final status
    log.header('FINAL SYSTEM STATE')
    const finalHealth = cyre.getSystemHealth()
    const finalBreathing = cyre.getBreathingState()
    const finalPerformance = cyre.getPerformanceState()

    log.data(
      `System Health: ${
        finalHealth.overall ? '✅ Healthy' : '⚠️ Needs Attention'
      }`
    )
    log.data(
      `Breathing: ${finalBreathing.currentRate.toFixed(1)}ms rate, ${(
        finalBreathing.stress * 100
      ).toFixed(1)}% stress`
    )
    log.data(
      `Performance: ${finalPerformance.totalCalls} total calls, ${(
        finalPerformance.successRate * 100
      ).toFixed(1)}% success rate`
    )
    log.data(`Call Rate: ${finalPerformance.callRate}/sec`)

    log.success('System Intelligence Demo Complete!')
    log.info('System orchestrations will continue running in the background')
  } catch (error) {
    log.warn(`Demo failed: ${error}`)
    console.error(error)
  }
}

// Export for use
export {runSystemIntelligenceDemo}

runSystemIntelligenceDemo().catch(console.error)
