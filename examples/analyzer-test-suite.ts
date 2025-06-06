// examples/analyzer-test-suite.ts
// Test suite with proper error handling and debug logging

import {cyre} from '../src'
import {metrics, metricsCore} from '../src/metrics'
import {analyzer} from '../src/metrics/analyzer'

/*

      C.Y.R.E - A.N.A.L.Y.Z.E.R - T.E.S.T - S.U.I.T.E
      
      Test scenarios to validate analyzer capabilities with proper error handling:
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
 * Scenario 3: Error Prone Service with proper error handling
 */
const errorProneService: TestScenario = {
  name: 'Error Prone Service',
  description: 'Service with high error rate that properly logs to sensor',
  expectedIssues: ['High error rate', 'Service reliability issues'],
  severity: 'high',

  setup: async () => {
    cyre.action({
      id: 'error-prone-service',
      debounce: 100,
      maxWait: 500,
      required: true
    })

    cyre.on('error-prone-service', async payload => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25))

      // Simulate various error conditions with proper error objects
      const errorType = Math.random()

      if (errorType < 0.15) {
        // 15% error rate - throw proper Error objects
        const errors = [
          new Error('Service temporarily unavailable'),
          new Error('Database connection timeout'),
          new Error('Invalid request format'),
          new Error('Rate limit exceeded'),
          new Error('Authentication failed')
        ]

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
    console.log('📊 Running error prone service test...')

    for (let i = 0; i < 30; i++) {
      try {
        await cyre.call('error-prone-service', {
          request: i,
          retryAttempt: Math.floor(i / 5) + 1
        })
      } catch (error) {
        // Expected errors - they should be logged by cyreExecute
        console.log(`Expected error in test: ${error}`)
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

/**
 * Scenario 4: Protection System Stress Test
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

    // Generate rapid burst calls sequentially to avoid channel ID confusion
    for (let i = 0; i < 40; i++) {
      try {
        await cyre.call('protected-service', {
          burst: i,
          // Repeat some payloads to trigger change detection
          data: i % 3 === 0 ? 'repeated-data' : `unique-${i}`
        })
      } catch (error) {
        // Expected throttle/debounce failures - ignore
      }

      // Very rapid calls to trigger protections
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.burstFreq))
    }
  }
}

/**
 * Scenario 5: Pipeline Complexity Test
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

    // Generate high-frequency calls sequentially to avoid Promise.all issues
    for (let i = 0; i < 60; i++) {
      try {
        await cyre.call('overload-target', {
          load: i,
          concurrent: false, // Changed to false to avoid confusion
          timestamp: Date.now()
        })
      } catch (error) {
        // Expected failures due to throttling and errors - ignore
      }

      // Minimal delay for stress
      await new Promise(resolve => setTimeout(resolve, 15))
    }
  }
}

/**
 * Scenario 7: Execution Mismatch Creator
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
 * Main test execution function with debug logging
 */
export async function runAnalyzerTestSuite(): Promise<void> {
  try {
    await initializeTest()

    console.log('🔧 Running test suite with debug logging')

    const scenarios = [
      highPerformanceBaseline,
      variableLatencyChannel,
      errorProneService,
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

    // Debug: Check channel metrics are being created
    console.log('\n🔍 DEBUG: Channel metrics after setup:')
    const channelsAfterSetup = metrics.getChannelMetrics()
    console.log(`Found ${channelsAfterSetup.length} channels:`)
    channelsAfterSetup.forEach(ch => {
      console.log(
        `  - ${ch.id}: ${ch.calls} calls, ${ch.executions} executions`
      )
    })

    // Execution phase
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i]

      console.log(`\n[${i + 1}/${scenarios.length}] ${scenario.name}`)

      const startTime = Date.now()
      const startMetrics = metrics.getSystemMetrics()

      try {
        await scenario.execute()
      } catch (error) {
        console.error(`Scenario ${scenario.name} had errors:`, error)
      }

      const duration = Date.now() - startTime
      const endMetrics = metrics.getSystemMetrics()

      console.log(`✓ Completed in ${duration}ms`)
      console.log(
        `  Calls: ${startMetrics.totalCalls} → ${endMetrics.totalCalls}`
      )
      console.log(
        `  Executions: ${startMetrics.totalExecutions} → ${endMetrics.totalExecutions}`
      )
      console.log(
        `  Errors: ${startMetrics.totalErrors} → ${endMetrics.totalErrors}`
      )

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Wait for metrics to settle
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Generate analysis with debug info
    await generateAnalysisWithDebug()
  } catch (error) {
    console.error('❌ Test suite failed:', error)
    throw error
  }
}

async function generateAnalysisWithDebug(): Promise<void> {
  console.log('\n📊 ANALYZER REPORT WITH DEBUG INFO')
  console.log('=' + '='.repeat(50))

  // Debug raw metrics
  const systemMetrics = metrics.getSystemMetrics()
  const allChannels = metrics.getChannelMetrics()

  console.log('\n🔍 RAW METRICS DEBUG:')
  console.log('System Metrics:')
  console.log(`  Total Calls: ${systemMetrics.totalCalls}`)
  console.log(`  Total Executions: ${systemMetrics.totalExecutions}`)
  console.log(`  Total Errors: ${systemMetrics.totalErrors}`)
  console.log(
    `  Execution Ratio: ${(
      (systemMetrics.totalExecutions / Math.max(systemMetrics.totalCalls, 1)) *
      100
    ).toFixed(1)}%`
  )
  console.log(
    `  Error Rate: ${(
      (systemMetrics.totalErrors / Math.max(systemMetrics.totalCalls, 1)) *
      100
    ).toFixed(1)}%`
  )

  console.log(`\nChannel Metrics (${allChannels.length} channels):`)
  allChannels.forEach(channel => {
    console.log(`  ${channel.id}:`)
    console.log(
      `    Calls: ${channel.calls}, Executions: ${channel.executions}, Errors: ${channel.errors}`
    )
    console.log(`    Success Rate: ${(channel.successRate * 100).toFixed(1)}%`)
    console.log(`    Avg Latency: ${channel.averageLatency.toFixed(2)}ms`)
    if (channel.protectionEvents) {
      const total = Object.values(channel.protectionEvents).reduce(
        (sum, val) => sum + val,
        0
      )
      if (total > 0) {
        console.log(
          `    Protections: ${JSON.stringify(channel.protectionEvents)}`
        )
      }
    }
  })

  // Debug recent events by type and location
  const rawEvents = metricsCore.getEvents({
    since: Date.now() - 120000, // Last 2 minutes
    limit: 50
  })

  console.log(`\n📝 RECENT EVENTS (${rawEvents.length} total):`)

  // Group by event type and location
  const eventGroups = new Map()
  const errorEvents = []

  rawEvents.forEach(event => {
    const key = `${event.eventType}@${event.location || 'no-location'}`
    eventGroups.set(key, (eventGroups.get(key) || 0) + 1)

    if (event.eventType === 'error') {
      errorEvents.push(event)
    }
  })

  eventGroups.forEach((count, type) => {
    console.log(`  ${type}: ${count}`)
  })

  console.log(`\n🔴 ERROR EVENTS BREAKDOWN (${errorEvents.length} total):`)
  const errorByLocation = new Map()
  const errorByChannel = new Map()

  errorEvents.forEach(event => {
    const location = event.location || 'no-location'
    const channel = event.actionId

    errorByLocation.set(location, (errorByLocation.get(location) || 0) + 1)
    errorByChannel.set(channel, (errorByChannel.get(channel) || 0) + 1)
  })

  console.log('  By Location:')
  errorByLocation.forEach((count, location) => {
    console.log(`    ${location}: ${count}`)
  })

  console.log('  By Channel:')
  errorByChannel.forEach((count, channel) => {
    console.log(`    ${channel}: ${count}`)
  })

  // Standard analysis
  console.log('\n📋 STANDARD ANALYSIS:')
  const analysis = analyzer.analyze(120000)
  const report = analyzer.generateReport(analysis)
  console.log(report)

  // Validation
  console.log('\n✅ VALIDATION:')
  console.log(`Expected errors in scenarios: YES`)
  console.log(`Errors recorded in metrics: ${systemMetrics.totalErrors}`)
  console.log(
    `Channel metrics populated: ${allChannels.length > 0 ? 'YES' : 'NO'}`
  )
  console.log(`Analysis health status: ${analysis.health.overall}`)
}

// Export for use in other test files
export {TEST_CONFIG, initializeTest}

// Run the test suite
runAnalyzerTestSuite().catch(console.error)
