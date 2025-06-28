// example/metrics-system-demo.ts
// Comprehensive example demonstrating the refined metrics system

import {metricsReport, type RawMetricEvent} from '../src/components/sensor'

/*

  CYRE Metrics System Demo
  
  This example demonstrates:
  - Core sensor.log() usage
  - Custom sensors for complex events  
  - Live streaming capabilities
  - Raw data export and filtering
  - Basic reporting
  - Real-world usage patterns

*/

// Utility for colored terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
}

const log = {
  header: (msg: string) =>
    console.log(`${colors.bright}${colors.cyan}=== ${msg} ===${colors.reset}`),
  success: (msg: string) =>
    console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warn: (msg: string) =>
    console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  data: (msg: string) => console.log(`${colors.dim}   ${msg}${colors.reset}`),
  live: (msg: string) =>
    console.log(`${colors.magenta}📡 ${msg}${colors.reset}`)
}

/**
 * Demo 1: Basic sensor usage
 */
async function demoBasicSensors() {
  log.header('Basic Sensor Usage')

  // Initialize metrics system
  metricsReport.initialize()

  // Simulate typical application flow
  const actions = ['user-login', 'data-fetch', 'ui-render']

  for (const actionId of actions) {
    log.info(`Simulating action: ${actionId}`)

    // Basic events using sensor.log()
    metricsReport.sensor.log(actionId, 'call', 'api-gateway')
    log.data(`  📞 Call initiated for ${actionId}`)

    // Simulate some processing time
    await sleep(10)

    // Custom execution sensor with timing
    const executionTime = Math.random() * 50 + 10 // 10-60ms
    metricsReport.sensor.execution(
      actionId,
      executionTime,
      'normal',
      'pipeline-executor'
    )
    log.data(`  ⚡ Executed in ${executionTime.toFixed(1)}ms`)

    // Simulate occasional errors
    if (Math.random() < 0.3) {
      metricsReport.sensor.error(actionId, 'Network timeout', 'network-layer')
      log.data(`  ❌ Error occurred: Network timeout`)
    }

    await sleep(5)
  }

  log.success('Basic sensor logging completed')
  console.log()
}

/**
 * Demo 2: Protection mechanism sensors
 */
async function demoProtectionSensors() {
  log.header('Protection Mechanism Sensors')

  const actionId = 'protected-action'

  // Simulate throttling
  log.info('Simulating throttled calls')
  metricsReport.sensor.log(actionId, 'call', 'throttle-check')
  metricsReport.sensor.throttle(actionId, 150, 'throttle-protection')
  log.data('  🛡️  First call allowed')
  log.data('  ⏱️  Second call throttled (150ms remaining)')

  await sleep(20)

  // Simulate debouncing
  log.info('Simulating debounced calls')
  for (let i = 0; i < 5; i++) {
    metricsReport.sensor.log(actionId, 'call', 'debounce-check')
    await sleep(2)
  }
  metricsReport.sensor.debounce(actionId, 200, 4, 'debounce-protection')
  log.data(
    '  🔄 5 rapid calls collapsed into 1 (200ms delay, 4 calls collapsed)'
  )

  await sleep(20)

  // Simulate change detection skip
  metricsReport.sensor.log(actionId, 'skip', 'change-detection')
  log.data('  ⏭️  Execution skipped (no payload changes)')

  log.success('Protection sensor demo completed')
  console.log()
}

/**
 * Demo 3: Advanced sensors (middleware, intralinks)
 */
async function demoAdvancedSensors() {
  log.header('Advanced Sensor Usage')

  const actionId = 'complex-workflow'

  // Middleware processing
  log.info('Simulating middleware chain')
  const middlewares = [
    {id: 'auth-middleware', result: 'accept' as const},
    {id: 'validation-middleware', result: 'transform' as const},
    {id: 'security-middleware', result: 'accept' as const}
  ]

  for (const middleware of middlewares) {
    metricsReport.sensor.middleware(
      actionId,
      middleware.id,
      middleware.result,
      'middleware-chain'
    )
    log.data(`  🔧 ${middleware.id}: ${middleware.result}`)
    await sleep(5)
  }

  // Intralink chain reaction
  log.info('Simulating chain reaction')
  const chainActions = [
    'workflow-start',
    'data-process',
    'notification-send',
    'audit-log'
  ]

  for (let i = 0; i < chainActions.length - 1; i++) {
    metricsReport.sensor.intralink(
      chainActions[i],
      chainActions[i + 1],
      'chain-processor'
    )
    log.data(`  🔗 ${chainActions[i]} → ${chainActions[i + 1]}`)
    await sleep(8)
  }

  // Timeout simulation
  metricsReport.sensor.timeout('slow-operation', 5000, 'execution-timeout')
  log.data('  ⏰ Operation timed out after 5000ms')

  log.success('Advanced sensor demo completed')
  console.log()
}

/**
 * Demo 4: Live streaming
 */
async function demoLiveStreaming() {
  log.header('Live Streaming Demo')

  const receivedEvents: RawMetricEvent[] = []

  // Create live stream with filter
  log.info('Setting up live stream for error events')
  const streamId = metricsReport.createStream(
    {eventTypes: ['error', 'timeout', 'critical']},
    event => {
      receivedEvents.push(event)
      log.live(
        `${event.eventType.toUpperCase()} on ${event.actionId} at ${
          event.location || 'unknown'
        }`
      )
      if (event.metadata) {
        log.data(`    Metadata: ${JSON.stringify(event.metadata)}`)
      }
    }
  )

  log.data(`  📡 Stream created with ID: ${streamId}`)

  // Generate various events (some will match filter)
  log.info('Generating events to trigger live stream')

  const testEvents = [
    {action: 'payment-process', type: 'call' as const},
    {
      action: 'payment-process',
      type: 'error' as const,
      meta: {error: 'Payment gateway down'}
    },
    {action: 'user-auth', type: 'execution' as const},
    {action: 'data-sync', type: 'timeout' as const, meta: {timeout: 3000}},
    {action: 'health-check', type: 'call' as const},
    {
      action: 'backup-job',
      type: 'critical' as const,
      meta: {error: 'Disk space critical'}
    }
  ]

  for (const event of testEvents) {
    if (event.type === 'error') {
      metricsReport.sensor.error(
        event.action,
        event.meta?.error || 'Unknown error',
        'demo-generator'
      )
    } else if (event.type === 'timeout') {
      metricsReport.sensor.timeout(
        event.action,
        event.meta?.timeout || 1000,
        'demo-generator'
      )
    } else if (event.type === 'critical') {
      metricsReport.sensor.log(
        event.action,
        'critical',
        'demo-generator',
        event.meta
      )
    } else {
      metricsReport.sensor.log(event.action, event.type, 'demo-generator')
    }
    await sleep(15)
  }

  await sleep(50) // Allow stream processing

  log.success(`Live stream captured ${receivedEvents.length} matching events`)

  // Remove stream
  metricsReport.removeStream(streamId)
  log.data('  📡 Stream removed')
  console.log()
}

/**
 * Demo 5: Data export and filtering
 */
async function demoDataExport() {
  log.header('Data Export and Filtering')

  // Export all events
  const allEvents = metricsReport.exportEvents()
  log.info(`Total events collected: ${allEvents.length}`)

  // Show event type breakdown
  const eventTypeCounts = allEvents.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  log.info('Event type breakdown:')
  Object.entries(eventTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      log.data(`  ${type}: ${count}`)
    })

  // Filter by event type
  const errorEvents = metricsReport.exportEvents({eventTypes: ['error']})
  log.info(`Error events: ${errorEvents.length}`)
  errorEvents.forEach((event, index) => {
    log.data(`  ${index + 1}. ${event.actionId}: ${event.metadata?.error}`)
  })

  // Filter by action ID
  const userLoginEvents = metricsReport.exportEvents({
    actionIds: ['user-login']
  })
  log.info(`Events for 'user-login': ${userLoginEvents.length}`)
  userLoginEvents.forEach((event, index) => {
    log.data(
      `  ${index + 1}. ${event.eventType} at ${new Date(
        event.timestamp
      ).toISOString()}`
    )
  })

  // Filter by time range (last 1 second)
  const recentEvents = metricsReport.exportEvents({
    since: Date.now() - 1000,
    limit: 5
  })
  log.info(`Recent events (last 1 second, limit 5): ${recentEvents.length}`)
  recentEvents.forEach((event, index) => {
    log.data(`  ${index + 1}. ${event.eventType} on ${event.actionId}`)
  })

  log.success('Data export demo completed')
  console.log()
}

/**
 * Demo 6: System stats and reporting
 */
async function demoSystemStats() {
  log.header('System Stats and Reporting')

  // Get system stats
  const systemStats = metricsReport.getSystemStats()
  log.info('System Statistics:')
  log.data(`  Total Calls: ${systemStats.totalCalls}`)
  log.data(`  Total Executions: ${systemStats.totalExecutions}`)
  log.data(`  Total Errors: ${systemStats.totalErrors}`)
  log.data(`  Call Rate: ${systemStats.callRate}/sec`)
  log.data(
    `  Uptime: ${Math.floor((Date.now() - systemStats.startTime) / 1000)}s`
  )

  // Get action-specific stats
  const actionStats = metricsReport.getActionStats('user-login')
  if (actionStats) {
    log.info('Action Stats for "user-login":')
    log.data(`  Calls: ${actionStats.calls}`)
    log.data(`  Errors: ${actionStats.errors}`)
    log.data(`  Last Call: ${new Date(actionStats.lastCall).toISOString()}`)
  }

  // Generate basic report
  log.info('Basic System Report:')
  const report = metricsReport.getBasicReport()
  report.split('\n').forEach(line => {
    if (line.trim()) {
      log.data(`  ${line}`)
    }
  })

  log.success('System stats demo completed')
  console.log()
}

/**
 * Demo 7: Real-world simulation
 */
async function demoRealWorldScenario() {
  log.header('Real-World Scenario Simulation')

  log.info('Simulating e-commerce checkout flow with metrics')

  const checkoutSteps = [
    'cart-validation',
    'inventory-check',
    'payment-processing',
    'order-creation',
    'notification-send',
    'audit-logging'
  ]

  // Setup live monitoring for this flow
  const checkoutEvents: RawMetricEvent[] = []
  const monitoringStreamId = metricsReport.createStream(
    {actionIds: checkoutSteps},
    event => {
      checkoutEvents.push(event)
      const timestamp = new Date(event.timestamp)
        .toISOString()
        .split('T')[1]
        .split('.')[0]
      log.live(
        `[${timestamp}] ${event.eventType.toUpperCase()}: ${event.actionId}`
      )

      if (event.metadata?.duration) {
        log.data(`    Execution time: ${event.metadata.duration}ms`)
      }
      if (event.metadata?.error) {
        log.data(`    Error: ${event.metadata.error}`)
      }
    }
  )

  // Simulate checkout process
  for (let checkoutId = 1; checkoutId <= 3; checkoutId++) {
    log.info(`Processing checkout #${checkoutId}`)

    for (const [index, step] of checkoutSteps.entries()) {
      // Call initiated
      metricsReport.sensor.log(step, 'call', 'checkout-processor')

      // Simulate processing time based on step complexity
      const baseTime = [20, 35, 150, 45, 30, 15][index] // Different times per step
      const actualTime = baseTime + (Math.random() * 20 - 10) // Add variance

      await sleep(Math.max(5, actualTime / 10)) // Scaled down for demo

      // Simulate occasional issues
      if (step === 'payment-processing' && Math.random() < 0.3) {
        metricsReport.sensor.error(
          step,
          'Payment gateway timeout',
          'payment-service'
        )
        continue // Skip to next checkout
      }

      if (step === 'inventory-check' && Math.random() < 0.2) {
        metricsReport.sensor.log(step, 'skip', 'inventory-cache')
        log.data(`    ${step}: Skipped (cached result)`)
        continue
      }

      // Successful execution
      metricsReport.sensor.execution(
        step,
        actualTime,
        'normal',
        'checkout-processor'
      )

      // Chain to next step (except last)
      if (index < checkoutSteps.length - 1) {
        metricsReport.sensor.intralink(
          step,
          checkoutSteps[index + 1],
          'checkout-chain'
        )
      }
    }

    await sleep(100) // Pause between checkouts
  }

  // Remove monitoring stream
  metricsReport.removeStream(monitoringStreamId)

  log.success(
    `Real-world simulation completed. Captured ${checkoutEvents.length} events`
  )

  // Show summary of checkout flow
  const checkoutSummary = checkoutSteps.map(step => {
    const stepEvents = checkoutEvents.filter(e => e.actionId === step)
    const calls = stepEvents.filter(e => e.eventType === 'call').length
    const executions = stepEvents.filter(
      e => e.eventType === 'execution'
    ).length
    const errors = stepEvents.filter(e => e.eventType === 'error').length
    const avgTime =
      stepEvents
        .filter(e => e.metadata?.duration)
        .reduce((sum, e) => sum + (e.metadata!.duration as number), 0) /
      Math.max(1, executions)

    return {step, calls, executions, errors, avgTime: avgTime || 0}
  })

  log.info('Checkout Flow Summary:')
  checkoutSummary.forEach(summary => {
    const errorRate =
      summary.calls > 0
        ? ((summary.errors / summary.calls) * 100).toFixed(1)
        : '0'
    log.data(`  ${summary.step}:`)
    log.data(
      `    Calls: ${summary.calls}, Executions: ${summary.executions}, Errors: ${summary.errors}`
    )
    log.data(
      `    Avg Time: ${summary.avgTime.toFixed(1)}ms, Error Rate: ${errorRate}%`
    )
  })

  console.log()
}

/**
 * Demo 8: Performance impact test
 */
async function demoPerformanceImpact() {
  log.header('Performance Impact Test')

  log.info('Testing metrics collection performance')

  const iterations = 1000
  const actionId = 'performance-test'

  // Test sensor.log() performance
  const startTime = Date.now()

  for (let i = 0; i < iterations; i++) {
    metricsReport.sensor.log(actionId, 'call', 'performance-test')

    if (i % 5 === 0) {
      metricsReport.sensor.execution(actionId, Math.random() * 20, 'fast')
    }

    if (i % 10 === 0) {
      metricsReport.sensor.throttle(actionId, Math.random() * 100)
    }
  }

  const endTime = Date.now()
  const totalTime = endTime - startTime
  const avgTimePerEvent = totalTime / iterations

  log.info('Performance Results:')
  log.data(`  Total events: ${iterations}`)
  log.data(`  Total time: ${totalTime}ms`)
  log.data(`  Average time per event: ${avgTimePerEvent.toFixed(3)}ms`)
  log.data(
    `  Events per second: ${Math.round(iterations / (totalTime / 1000))}`
  )

  // Memory usage estimation
  const currentEvents = metricsReport.exportEvents()
  const memoryEstimate = currentEvents.length * 200 // Rough estimate: 200 bytes per event
  log.data(`  Current events in memory: ${currentEvents.length}`)
  log.data(`  Estimated memory usage: ${(memoryEstimate / 1024).toFixed(1)} KB`)

  if (avgTimePerEvent < 0.1) {
    log.success('Performance: Excellent (< 0.1ms per event)')
  } else if (avgTimePerEvent < 0.5) {
    log.success('Performance: Good (< 0.5ms per event)')
  } else {
    log.warn('Performance: Could be improved')
  }

  console.log()
}

/**
 * Utility function for sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Main demo execution
 */
async function runMetricsDemo() {
  console.log(`${colors.bright}${colors.green}`)
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║                CYRE Metrics System Demo                 ║')
  console.log('║            Sensor-Based Collection & Streaming          ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`${colors.reset}\n`)

  try {
    await demoBasicSensors()
    await demoProtectionSensors()
    await demoAdvancedSensors()
    await demoLiveStreaming()
    await demoDataExport()
    await demoSystemStats()
    await demoRealWorldScenario()
    await demoPerformanceImpact()

    log.header('Demo Summary')

    const finalStats = metricsReport.getSystemStats()
    const finalReport = metricsReport.getBasicReport()

    log.success('All demos completed successfully!')
    log.info('Final System State:')
    finalReport.split('\n').forEach(line => {
      if (line.trim()) {
        log.data(`  ${line}`)
      }
    })

    console.log(
      `\n${colors.bright}${colors.cyan}Demo completed! The metrics system is ready for production use.${colors.reset}`
    )
  } catch (error) {
    log.error(`Demo failed: ${error}`)
  } finally {
    // Cleanup
    metricsReport.shutdown()
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMetricsDemo().catch(console.error)
}

export {runMetricsDemo}
