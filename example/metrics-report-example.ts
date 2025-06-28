// src/example/metrics-report-example.ts

import {cyre} from '../src'
import {metricsReport} from '../src/components/sensor'

/**
 * CYRE Metrics Report Example
 * Using official CYRE API with comprehensive performance tracking
 */

// Helper to delay execution
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Log section header
const logSection = (title: string) => {
  console.log('\n' + '='.repeat(80))
  console.log(`  ${title}`)
  console.log('='.repeat(80))
}

// Run the example
async function runMetricsExample() {
  // Reset any existing actions and metrics
  //cyre.clear()
  metricsReport.reset()

  logSection('CYRE Metrics Report Example')

  // Create actions with different protection mechanisms
  cyre.action({
    id: 'standard-action',
    payload: {message: 'Hello'}
  })

  cyre.action({
    id: 'throttled-action',
    throttle: 500,
    payload: {message: 'Throttled action'}
  })

  cyre.action({
    id: 'debounced-action',
    debounce: 300,
    payload: {message: 'Debounced action'}
  })

  cyre.action({
    id: 'change-detection-action',
    detectChanges: true,
    payload: {value: 1}
  })

  cyre.action({
    id: 'priority-critical',
    priority: {level: 'critical'},
    payload: {message: 'Critical action'}
  })

  cyre.action({
    id: 'repeated-action',
    interval: 100,
    repeat: 3,
    delay: 0,
    payload: {counter: 0}
  })

  // Normal, fast handler
  cyre.on('standard-action', payload => {
    console.log(`Standard handler received:`, payload)
    return null
  })

  // Fast throttled handler
  cyre.on('throttled-action', payload => {
    console.log(`Throttled handler received:`, payload)
    return null
  })

  // Medium speed handler with some processing
  cyre.on('debounced-action', async payload => {
    console.log(`Debounced handler processing:`, payload)
    // Simulate some processing time
    await wait(10)
    console.log(`Debounced handler completed`)
    return null
  })

  // Slow handler that takes longer to execute
  cyre.on('change-detection-action', async payload => {
    console.log(`Change detection handler processing:`, payload)
    // Simulate slower processing
    await wait(25)
    console.log(`Change detection handler completed`)
    return null
  })

  // Critical priority handler
  cyre.on('priority-critical', payload => {
    console.log(`Critical handler received:`, payload)
    return null
  })

  // Normal repeating handler
  cyre.on('repeated-action', payload => {
    console.log(`Repeat handler received:`, payload)
    return null
  })

  // Test standard action
  logSection('Standard Action (Fast Handler)')
  await cyre.call('standard-action', {message: 'Hello, World!'})
  await cyre.call('standard-action', {message: 'Hello again!'})

  // Test throttled action
  logSection('Throttled Action')
  console.log('Calling throttled action 3 times in rapid succession')
  await cyre.call('throttled-action', {message: 'Call 1'})
  await cyre.call('throttled-action', {message: 'Call 2'}) // Should be throttled
  await cyre.call('throttled-action', {message: 'Call 3'}) // Should be throttled

  console.log('Waiting for throttle to reset...')
  await wait(600)
  await cyre.call('throttled-action', {message: 'Call 4'}) // Should succeed

  // Test debounced action with medium speed handler
  logSection('Debounced Action (Medium Speed Handler)')
  console.log('Calling debounced action 3 times in rapid succession')
  await cyre.call('debounced-action', {message: 'Debounce 1'})
  await cyre.call('debounced-action', {message: 'Debounce 2'})
  await cyre.call('debounced-action', {message: 'Debounce 3'})

  console.log('Waiting for debounce to execute...')
  await wait(400)

  // Test change detection with slow handler
  logSection('Change Detection Action (Slow Handler)')
  console.log('Calling change detection action with same payload twice')
  await cyre.call('change-detection-action', {value: 42})
  await cyre.call('change-detection-action', {value: 42}) // Should be skipped
  console.log('Calling with different payload')
  await cyre.call('change-detection-action', {value: 100}) // Should execute

  // Test critical priority action
  logSection('Critical Priority Action')
  console.log('Calling critical priority action')
  await cyre.call('priority-critical', {message: 'Important task!'})

  // Test repeated action
  logSection('Repeated Action')
  console.log('Starting repeated action with 3 executions')
  await cyre.call('repeated-action', {counter: 1})

  console.log('Waiting for all repeats to complete...')
  await wait(500)

  // Wait a moment for all executions to complete
  await wait(100)

  // Display the metrics report
  logSection('Complete Metrics Report')
  console.log('\nGenerating full metrics report...\n')
  cyre.logMetricsReport()

  // Display listener execution time analysis
  logSection('Listener Execution Time Analysis')

  const actionIds = [
    'standard-action',
    'throttled-action',
    'debounced-action',
    'change-detection-action',
    'priority-critical',
    'repeated-action'
  ]

  console.log('\nListener Execution Times:')
  console.log('------------------------')

  actionIds.forEach(id => {
    const metrics = metricsReport.getActionMetrics(id)
    if (metrics) {
      console.log(`\n${id}:`)
      console.log(`  Calls: ${metrics.calls}`)
      console.log(`  Executions: ${metrics.executionTimes.length}`)

      if (metrics.executionTimes.length > 0) {
        console.log(
          `  Execution Time: ${metrics.avgExecutionTime.toFixed(2)}ms avg ` +
            `(range: ${metrics.minExecutionTime.toFixed(
              2
            )}ms - ${metrics.maxExecutionTime.toFixed(2)}ms)`
        )
      }

      if (metrics.listenerExecutionTimes?.length > 0) {
        console.log(
          `  Listener Time: ${metrics.avgListenerExecutionTime.toFixed(
            2
          )}ms avg ` +
            `(range: ${metrics.minListenerExecutionTime.toFixed(
              2
            )}ms - ${metrics.maxListenerExecutionTime.toFixed(2)}ms)`
        )

        if (metrics.pipelineOverheadRatio > 0) {
          console.log(
            `  Pipeline Overhead: ${(
              metrics.pipelineOverheadRatio * 100
            ).toFixed(1)}%`
          )
        }

        if (metrics.slowListenerCount > 0) {
          console.log(`  Slow Listener Count: ${metrics.slowListenerCount}`)
        }
      }
    }
  })

  // Show insights with listener performance info
  logSection('Actionable Insights')
  const insights = metricsReport.getInsights()
  if (insights.length > 0) {
    insights.forEach(insight => console.log(`- ${insight}`))
  } else {
    console.log('\nNo actionable insights detected.')
  }

  // Show filtered report example
  logSection('Filtered Report (Only Actions with Throttles)')
  cyre.logMetricsReport(metrics => metrics.throttles > 0)
}

// Run the example
runMetricsExample().catch(error => {
  console.error('Error running metrics example:', error)
  console.error(error.stack)
})

export {runMetricsExample}
