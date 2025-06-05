// examples/analyzer-test-suite.ts
// Comprehensive test suite to generate various scenarios for analyzer testing

import {cyre} from '../src'
import {metrics, metricsCore} from '../src/metrics'
import {analyzer} from '../src/metrics/analyzer'

/*

      C.Y.R.E - A.N.A.L.Y.Z.E.R - T.E.S.T - S.U.I.T.E
      
      Comprehensive test scenarios to validate analyzer capabilities:
      - Performance anomalies (high latency, variable response times)
      - Error patterns (burst errors, sustained failures, intermittent issues)
      - Protection system testing (throttle, debounce, blocking)
      - Pipeline complexity variations
      - System stress scenarios
      - Real-world failure modes

*/

interface TestScenario {
  name: string
  description: string
  setup: () => Promise<void>
  execute: () => Promise<void>
  expectedIssues: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Test configuration
const TEST_CONFIG = {
  // Scenario durations
  shortBurst: 2000, // 2 seconds
  mediumTest: 5000, // 5 seconds
  longTest: 10000, // 10 seconds

  // Call frequencies
  lowFreq: 100, // Every 100ms
  mediumFreq: 50, // Every 50ms
  highFreq: 25, // Every 25ms
  burstFreq: 10, // Every 10ms

  // Error rates
  lowErrorRate: 0.05, // 5%
  mediumErrorRate: 0.15, // 15%
  highErrorRate: 0.3, // 30%
  criticalErrorRate: 0.5 // 50%
}

/**
 * Initialize Cyre and clear any existing state
 */
async function initializeTest(): Promise<void> {
  console.log('🚀 Initializing Cyre Analyzer Test Suite')
  console.log('=' + '='.repeat(50))

  await cyre.initialize()
  cyre.clear() // Start fresh

  console.log('✅ Cyre initialized and cleared')
}

/**
 * Scenario 1: High Performance Baseline
 * Creates a fast, reliable channel for comparison
 */
const highPerformanceBaseline: TestScenario = {
  name: 'High Performance Baseline',
  description: 'Fast, reliable channel with consistent performance',
  expectedIssues: [],
  severity: 'low',

  setup: async () => {
    cyre.action({
      id: 'fast-baseline',
      throttle: 25 // Minimal throttle
    })

    cyre.on('fast-baseline', async payload => {
      // Simulate very fast processing (1-3ms)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2 + 1))
      return {
        processed: true,
        timestamp: Date.now(),
        payload
      }
    })
  },

  execute: async () => {
    console.log('📊 Running high performance baseline...')

    // Generate steady, fast calls
    for (let i = 0; i < 20; i++) {
      await cyre.call('fast-baseline', {request: i, type: 'baseline'})
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.mediumFreq))
    }
  }
}

/**
 * Scenario 2: Variable Latency Channel
 * Tests analyzer's ability to detect performance inconsistency
 */
const variableLatencyChannel: TestScenario = {
  name: 'Variable Latency Channel',
  description: 'Channel with highly variable response times',
  expectedIssues: ['High latency variance', 'Performance degradation'],
  severity: 'medium',

  setup: async () => {
    cyre.action({
      id: 'variable-latency',
      detectChanges: true
    })

    cyre.on('variable-latency', async payload => {
      // Simulate variable latency (10ms to 200ms)
      const latency =
        Math.random() < 0.2
          ? Math.random() * 190 + 10 // 20% chance of high latency
          : Math.random() * 15 + 5 // 80% chance of normal latency

      await new Promise(resolve => setTimeout(resolve, latency))

      return {
        processed: true,
        latency,
        timestamp: Date.now(),
        payload
      }
    })
  },

  execute: async () => {
    console.log('📊 Running variable latency test...')

    for (let i = 0; i < 25; i++) {
      await cyre.call('variable-latency', {
        request: i,
        complexity: Math.floor(Math.random() * 5) + 1
      })
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.lowFreq))
    }
  }
}

/**
 * Scenario 3: Error Prone Service
 * Tests error detection and correlation
 */
export const improvedErrorProneService: TestScenario = {
  name: 'Error Prone Service - Fixed',
  description: 'Service with high error rate that properly logs to sensor',
  expectedIssues: ['High error rate', 'Service reliability issues'],
  severity: 'high',

  setup: async () => {
    cyre.action({
      id: 'error-prone-service-fixed',
      debounce: 100,
      maxWait: 500,
      required: true
    })

    cyre.on('error-prone-service-fixed', async payload => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25))

      // Simulate various error conditions with proper error objects
      const errorType = Math.random()

      if (errorType < 0.15) {
        // 15% error rate
        const errors = [
          new Error('Service temporarily unavailable'),
          new Error('Database connection timeout'),
          new Error('Invalid request format'),
          new Error('Rate limit exceeded'),
          new Error('Authentication failed')
        ]

        // Throw proper Error objects that will be caught by cyreExecute
        throw errors[Math.floor(Math.random() * errors.length)]
      }

      return {
        processed: true,
        timestamp: Date.now(),
        payload
      }
    })
  },

  execute: async () => {
    console.log('📊 Running error prone service test (fixed)...')

    for (let i = 0; i < 30; i++) {
      try {
        await cyre.call('error-prone-service-fixed', {
          request: i,
          retryAttempt: Math.floor(i / 5) + 1
        })
      } catch (error) {
        // These errors should now be properly logged by sensor
        console.log(`Expected error caught: ${error}`)
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

// 2. Alternative: Add global error handler to ensure all errors are captured
export function setupGlobalErrorCapture() {
  // Capture unhandled promise rejections
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      // Log to sensor if it's a cyre-related error
      if (reason instanceof Error && reason.message.includes('cyre')) {
        cyre.metrics.record('system', 'error', 'unhandled-rejection', {
          error: reason.message,
          stack: reason.stack
        })
      }
    })
  }

  // Capture uncaught exceptions
  if (typeof process !== 'undefined') {
    process.on('uncaughtException', error => {
      console.error('Uncaught Exception:', error)
      // Log to sensor
      cyre.metrics.record('system', 'critical', 'uncaught-exception', {
        error: error.message,
        stack: error.stack
      })
    })
  }
}

// 3. Enhanced test execution function with better error tracking
export async function runImprovedAnalyzerTestSuite(): Promise<void> {
  try {
    // Setup global error capture
    setupGlobalErrorCapture()

    await initializeTest()

    console.log('🔧 Running IMPROVED test suite with better error logging')

    // Add a manual error tracking service
    cyre.action({
      id: 'error-tracker',
      log: true
    })

    let errorCount = 0
    cyre.on('error-tracker', error => {
      errorCount++
      console.log(`🔴 Error ${errorCount} logged:`, error)
      return {logged: true, count: errorCount}
    })

    // Run original scenarios but with explicit error tracking
    const scenarios = [
      highPerformanceBaseline,
      variableLatencyChannel,
      improvedErrorProneService, // Use the fixed version
      protectionStressTest,
      pipelineComplexityTest,
      systemOverloadSimulation,
      executionMismatchCreator
    ]

    // Setup phase
    for (const scenario of scenarios) {
      console.log(`\n⚙️  Setting up: ${scenario.name}`)
      await scenario.setup()
    }

    // Execution phase with error tracking
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i]

      console.log(`\n[${i + 1}/${scenarios.length}] ${scenario.name}`)

      const startTime = Date.now()

      try {
        await scenario.execute()
      } catch (error) {
        // Track any scenario-level errors
        console.error(`Scenario ${scenario.name} had errors:`, error)
        await cyre.call('error-tracker', {
          scenario: scenario.name,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        })
      }

      const duration = Date.now() - startTime
      console.log(`✓ Completed in ${duration}ms`)

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log(`\n📊 Total tracked errors: ${errorCount}`)

    // Wait for metrics to settle
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Generate analysis
    await generateEnhancedAnalysis()
  } catch (error) {
    console.error('❌ Improved test suite failed:', error)
    throw error
  }
}

async function generateEnhancedAnalysis(): Promise<void> {
  console.log('\n📊 ENHANCED ANALYZER REPORT')
  console.log('=' + '='.repeat(50))

  // Get the metrics data directly from the store to debug the issue
  const systemMetrics = metrics.getSystemMetrics()
  const allChannels = metrics.getChannelMetrics() || []

  console.log('\n🔍 RAW METRICS DEBUG:')
  console.log('System Metrics:', JSON.stringify(systemMetrics, null, 2))

  console.log('\nChannel Metrics:')
  allChannels.forEach(channel => {
    console.log(`${channel.id}:`, JSON.stringify(channel, null, 2))
  })

  // Export raw events to see what's actually being recorded
  const rawEvents = metricsCore.getEvents({
    since: Date.now() - 120000, // Last 2 minutes
    limit: 100
  })

  console.log('\n📝 RECENT ERROR EVENTS:')
  const errorEvents = rawEvents.filter(event => event.eventType === 'error')
  console.log(`Found ${errorEvents.length} error events:`)
  errorEvents.forEach((event, i) => {
    console.log(
      `${i + 1}. [${event.actionId}] ${event.eventType}: ${
        event.message || 'No message'
      }`
    )
    if (event.metadata) {
      console.log(`   Metadata:`, event.metadata)
    }
  })

  // Now run the standard analysis
  const analysis = analyzer.analyze(120000)
  console.log('\n📋 STANDARD ANALYSIS:')
  const report = analyzer.generateReport(analysis)
  console.log(report)

  // Compare expected vs actual
  console.log('\n🔍 ERROR DETECTION ANALYSIS:')
  console.log(`Expected: High error rates from test scenarios`)
  console.log(`Detected: ${errorEvents.length} error events in metrics`)
  console.log(
    `System error rate: ${(
      (systemMetrics.totalErrors / Math.max(systemMetrics.totalCalls, 1)) *
      100
    ).toFixed(1)}%`
  )

  if (errorEvents.length === 0) {
    console.log(
      '\n⚠️  ISSUE IDENTIFIED: No error events found in metrics store'
    )
    console.log(
      'This means errors are being logged to console but not recorded by sensor'
    )
    console.log('Possible causes:')
    console.log(
      '1. Errors thrown in handlers are not being caught by cyreExecute'
    )
    console.log('2. Sensor.error() is not being called in error handling paths')
    console.log('3. MetricsCore is not recording error events properly')
  }
}
/**
 * Scenario 4: Protection System Stress Test
 * Tests throttle, debounce, and blocking mechanisms
 */
const protectionStressTest: TestScenario = {
  name: 'Protection System Stress Test',
  description: 'Rapid calls to test protection mechanisms',
  expectedIssues: [
    'High protection utilization',
    'Throttle/debounce activation'
  ],
  severity: 'medium',

  setup: async () => {
    cyre.action({
      id: 'protected-service',
      throttle: 75,
      debounce: 150,
      maxWait: 400,
      detectChanges: true
    })

    cyre.on('protected-service', async payload => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 20))
      return {
        processed: true,
        timestamp: Date.now(),
        payload
      }
    })
  },

  execute: async () => {
    console.log('📊 Running protection system stress test...')

    // Generate rapid burst calls
    const promises = []
    for (let i = 0; i < 40; i++) {
      promises.push(
        cyre
          .call('protected-service', {
            burst: i,
            // Repeat some payloads to trigger change detection
            data: i % 3 === 0 ? 'repeated-data' : `unique-${i}`
          })
          .catch(() => {}) // Ignore throttle/debounce failures
      )

      // Very rapid calls
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.burstFreq))
    }

    await Promise.allSettled(promises)
  }
}

/**
 * Scenario 5: Pipeline Complexity Test
 * Tests channels with different pipeline complexities
 */
const pipelineComplexityTest: TestScenario = {
  name: 'Pipeline Complexity Test',
  description: 'Channels with varying pipeline complexity',
  expectedIssues: ['Pipeline overhead', 'Complex processing'],
  severity: 'medium',

  setup: async () => {
    // Simple pipeline
    cyre.action({
      id: 'simple-pipeline'
      // No talents = simple pipeline
    })

    cyre.on('simple-pipeline', payload => payload)

    // Complex pipeline
    cyre.action({
      id: 'complex-pipeline',
      required: 'non-empty',
      detectChanges: true,
      throttle: 50,
      debounce: 100,
      schema: (value: any) => {
        if (!value || typeof value !== 'object') {
          return {ok: false, errors: ['Invalid payload']}
        }
        return {ok: true, data: value}
      },
      condition: (payload: any) => payload?.enabled !== false,
      transform: (payload: any) => ({
        ...payload,
        processed: true,
        timestamp: Date.now()
      })
    })

    cyre.on('complex-pipeline', async payload => {
      // Simulate complex processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 30))
      return payload
    })
  },

  execute: async () => {
    console.log('📊 Running pipeline complexity test...')

    // Test simple pipeline
    for (let i = 0; i < 15; i++) {
      await cyre.call('simple-pipeline', {simple: i})
      await new Promise(resolve => setTimeout(resolve, 30))
    }

    // Test complex pipeline
    for (let i = 0; i < 15; i++) {
      await cyre.call('complex-pipeline', {
        complex: i,
        enabled: Math.random() > 0.1, // 10% chance of condition failure
        data: `complex-data-${i}`
      })
      await new Promise(resolve => setTimeout(resolve, 40))
    }
  }
}

/**
 * Scenario 6: System Overload Simulation
 * Tests system behavior under high load
 */
const systemOverloadSimulation: TestScenario = {
  name: 'System Overload Simulation',
  description: 'High frequency calls to simulate system overload',
  expectedIssues: ['High system stress', 'Protection system overuse'],
  severity: 'high',

  setup: async () => {
    cyre.action({
      id: 'overload-target',
      priority: {level: 'medium'},
      throttle: 30
    })

    cyre.on('overload-target', async payload => {
      // Simulate resource-intensive operation
      await new Promise(resolve => setTimeout(resolve, Math.random() * 60 + 40))

      // Random failures under stress
      if (Math.random() < 0.1) {
        throw new Error('System overloaded')
      }

      return payload
    })
  },

  execute: async () => {
    console.log('📊 Running system overload simulation...')

    // Generate high-frequency concurrent calls
    const promises = []
    for (let i = 0; i < 60; i++) {
      promises.push(
        cyre
          .call('overload-target', {
            load: i,
            concurrent: true,
            timestamp: Date.now()
          })
          .catch(() => {}) // Handle expected failures
      )

      // Minimal delay for maximum stress
      await new Promise(resolve => setTimeout(resolve, 15))
    }

    await Promise.allSettled(promises)
  }
}

/**
 * Scenario 7: Execution Mismatch Creator
 * Creates scenarios where calls don't complete execution
 */
const executionMismatchCreator: TestScenario = {
  name: 'Execution Mismatch Creator',
  description: 'Creates calls that fail to complete execution',
  expectedIssues: ['Low execution ratio', 'Pipeline failures'],
  severity: 'high',

  setup: async () => {
    cyre.action({
      id: 'mismatch-creator',
      required: 'non-empty',
      condition: (payload: any) => payload?.shouldExecute === true,
      detectChanges: true
    })

    cyre.on('mismatch-creator', async payload => {
      // Simulate processing that sometimes fails
      if (Math.random() < 0.2) {
        throw new Error('Execution failed')
      }

      await new Promise(resolve => setTimeout(resolve, 20))
      return payload
    })
  },

  execute: async () => {
    console.log('📊 Running execution mismatch test...')

    for (let i = 0; i < 25; i++) {
      try {
        await cyre.call('mismatch-creator', {
          id: i,
          shouldExecute: Math.random() > 0.3, // 30% will fail condition
          data: i % 4 === 0 ? 'repeated' : `unique-${i}` // Some repeated for change detection
        })
      } catch (error) {
        // Expected failures
      }
      await new Promise(resolve => setTimeout(resolve, 60))
    }
  }
}

/**
 * Main test execution function
 */

// Export for use in other test files
export {TEST_CONFIG, initializeTest}

runImprovedAnalyzerTestSuite().catch(console.error)
