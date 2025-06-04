// intelligence-tests.ts
// Complete test examples for the Cyre intelligence system

import {cyre} from '../src'

/*

      C.Y.R.E - I.N.T.E.L.L.I.G.E.N.C.E - T.E.S.T.S
      
      Test examples for the new intelligence system:
      1. User-defined fusion and pattern detection
      2. System intelligence orchestrations
      3. Intelligent metrics analysis
      4. Performance benchmarking

*/

/**
 * Test 1: User-Defined Spatial Fusion
 * Tests compile-time optimization and real-time fusion
 */
async function testSpatialFusion() {
  console.log('\n🌡️ Testing Spatial Fusion...')

  // Initialize Cyre
  await cyre.initialize()

  // Create temperature sensors with spatial fusion
  cyre.action({
    id: 'temp-sensor-1',
    path: 'building/floor-1/temp-1',
    payload: {value: 22.5, location: {x: 0, y: 0}},
    fusion: {
      spatial: {
        sensors: [
          {id: 'temp-sensor-2', location: {x: 5, y: 0}, weight: 0.8},
          {id: 'temp-sensor-3', location: {x: 10, y: 0}, weight: 0.6}
        ],
        method: 'weighted',
        distanceThreshold: 15
      }
    }
  })

  cyre.action({
    id: 'temp-sensor-2',
    path: 'building/floor-1/temp-2',
    payload: {value: 23.1, location: {x: 5, y: 0}}
  })

  cyre.action({
    id: 'temp-sensor-3',
    path: 'building/floor-1/temp-3',
    payload: {value: 22.8, location: {x: 10, y: 0}}
  })

  // Set up subscriber to see fusion results
  cyre.on('temp-sensor-1', data => {
    console.log('🔬 Fused sensor data:', {
      originalValue: data.originalValue,
      fusedValue: data.value,
      improvement: data.originalValue
        ? Math.abs(data.value - data.originalValue).toFixed(2)
        : 'N/A'
    })
    return {processed: true}
  })

  // Test fusion with different readings
  console.log('📊 Testing fusion with varying readings...')

  await cyre.call('temp-sensor-2', {value: 23.5, location: {x: 5, y: 0}})
  await cyre.call('temp-sensor-3', {value: 22.2, location: {x: 10, y: 0}})

  // This should trigger fusion
  await cyre.call('temp-sensor-1', {value: 22.0, location: {x: 0, y: 0}})

  // Check fusion results
  const fusionResult = cyre.intelligence.getFusionResult('temp-sensor-1')
  if (fusionResult) {
    console.log('✅ Fusion Result:', {
      confidence: fusionResult.confidence,
      sources: fusionResult.sources.length,
      method: fusionResult.method
    })
  }

  // Test dev tools
  const channelIntelligence =
    cyre.dev.intelligence.getChannelIntelligence('temp-sensor-1')
  console.log('🔧 Channel Intelligence Config:', {
    hasIntelligence: channelIntelligence?.hasIntelligence,
    hasOptimizedFusion:
      channelIntelligence?.compiledOptimizations.hasOptimizedFusion,
    configType: channelIntelligence?.config ? 'compiled' : 'none'
  })
}

/**
 * Test 2: Pattern Detection and Anomaly Detection
 * Tests compiled anomaly detection and sequence patterns
 */
async function testPatternDetection() {
  console.log('\n🎯 Testing Pattern Detection...')

  // Create sensor with anomaly detection
  cyre.action({
    id: 'pressure-sensor',
    path: 'system/sensors/pressure',
    payload: {value: 101.3, unit: 'kPa'},
    patterns: {
      anomalies: [
        {
          name: 'pressure-spike',
          channelPattern: 'pressure-sensor',
          method: 'zscore',
          threshold: 2.0,
          windowSize: 10
        }
      ],
      sequences: [
        {
          name: 'pressure-trend',
          conditions: [
            {
              channelPattern: 'pressure-sensor',
              condition: (payload: any) => payload.value > 105,
              timeout: 30000
            }
          ],
          timeout: 60000,
          allowOverlap: false
        }
      ]
    }
  })

  cyre.on('pressure-sensor', data => {
    console.log(`📊 Pressure reading: ${data.value} ${data.unit}`)
    return {timestamp: Date.now(), processed: true}
  })

  // Simulate normal readings to build baseline
  console.log('📈 Building baseline with normal readings...')
  const normalReadings = [
    101.2, 101.5, 101.1, 101.4, 101.3, 101.6, 101.0, 101.7
  ]

  for (const reading of normalReadings) {
    await cyre.call('pressure-sensor', {value: reading, unit: 'kPa'})
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Test anomaly detection
  console.log('🚨 Testing anomaly detection with spike...')
  await cyre.call('pressure-sensor', {value: 108.5, unit: 'kPa'}) // Should trigger anomaly

  // Check pattern detection results
  const patternState = cyre.intelligence.getPatternState('pressure-sensor')
  if (patternState) {
    console.log('✅ Pattern Detection:', {
      patternName: patternState.patternName,
      confidence: patternState.confidence,
      totalDetections: patternState.totalDetections
    })
  }

  // Benchmark pattern detection performance
  const benchmark = await cyre.dev.intelligence.benchmarkIntelligence(
    'pressure-sensor',
    50
  )
  console.log('⚡ Pattern Detection Performance:', {
    avgTime: `${benchmark.avgTime.toFixed(2)}ms`,
    fastExecutions: `${benchmark.fastExecutions}/50`,
    p95Time: `${benchmark.p95Time.toFixed(2)}ms`
  })
}

/**
 * Test 3: System Intelligence Orchestrations
 * Tests background intelligence and system analysis
 */
async function testSystemIntelligence() {
  console.log('\n🧠 Testing System Intelligence...')

  // Create some channels with different performance characteristics

  // Fast, efficient channel
  cyre.action({id: 'fast-channel', payload: {type: 'efficient'}})
  cyre.on('fast-channel', data => ({result: 'fast', ...data}))

  // Slow channel (simulates performance issue)
  cyre.action({id: 'slow-channel', payload: {type: 'slow'}})
  cyre.on('slow-channel', async data => {
    await new Promise(resolve => setTimeout(resolve, 150)) // Simulate slow processing
    return {result: 'slow', ...data}
  })

  // Error-prone channel
  cyre.action({id: 'error-channel', payload: {type: 'unreliable'}})
  cyre.on('error-channel', data => {
    if (Math.random() < 0.3) {
      // 30% error rate
      throw new Error('Simulated error')
    }
    return {result: 'success', ...data}
  })

  // High-frequency channel (should suggest throttling)
  cyre.action({id: 'high-freq-channel', payload: {type: 'frequent'}})
  cyre.on('high-freq-channel', data => ({result: 'frequent', ...data}))

  // Generate some activity to test system intelligence
  console.log('📊 Generating system activity...')

  // Fast channel calls
  for (let i = 0; i < 5; i++) {
    await cyre.call('fast-channel', {iteration: i})
  }

  // Slow channel calls
  for (let i = 0; i < 3; i++) {
    await cyre.call('slow-channel', {iteration: i})
  }

  // Error-prone channel calls
  for (let i = 0; i < 10; i++) {
    try {
      await cyre.call('error-channel', {iteration: i})
    } catch (error) {
      // Expected errors
    }
  }

  // High frequency calls
  for (let i = 0; i < 20; i++) {
    cyre.call('high-freq-channel', {iteration: i}) // Don't await - fire rapidly
  }

  // Wait for calls to complete
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test intelligent metrics
  console.log('📋 Getting intelligent system report...')
  const intelligentReport = cyre.getIntelligentReport()

  console.log(
    '✅ System Health Score:',
    `${intelligentReport.system.healthScore}/100`
  )
  console.log('📈 System Trend:', intelligentReport.system.trend)

  if (intelligentReport.insights.length > 0) {
    console.log('💡 Key Insights:')
    intelligentReport.insights.slice(0, 3).forEach(insight => {
      console.log(`  ${insight.severity.toUpperCase()}: ${insight.message}`)
      console.log(`  Recommendation: ${insight.recommendation}`)
    })
  }

  if (intelligentReport.performance.bottlenecks.length > 0) {
    console.log('🐌 Performance Bottlenecks:')
    intelligentReport.performance.bottlenecks.forEach(bottleneck => {
      console.log(`  ${bottleneck.channelId}: ${bottleneck.issue}`)
      console.log(`  Suggestion: ${bottleneck.suggestion}`)
    })
  }

  if (intelligentReport.suggestedActions.length > 0) {
    console.log('🎯 Suggested Actions:')
    intelligentReport.suggestedActions.slice(0, 3).forEach(action => {
      console.log(`  ${action.priority.toUpperCase()}: ${action.action}`)
      console.log(`  Impact: ${action.impact}`)
    })
  }

  // Test system intelligence methods
  const healthScore = cyre.systemIntelligence.getHealthScore()
  console.log('🏥 Health Summary:', healthScore)

  const bottlenecks = cyre.systemIntelligence.getBottlenecks()
  console.log('📉 Bottlenecks Found:', bottlenecks.length)

  const predictions = cyre.systemIntelligence.getPredictions()
  if (predictions.length > 0) {
    console.log('🔮 High-Risk Predictions:', predictions.length)
    predictions.forEach(pred => {
      console.log(
        `  ${pred.type}: ${(pred.probability * 100).toFixed(0)}% chance in ${
          pred.timeframe
        }`
      )
    })
  }
}

/**
 * Test 4: Cross-Domain Fusion and Complex Intelligence
 * Tests advanced fusion across different sensor types
 */
async function testCrossDomainFusion() {
  console.log('\n🌐 Testing Cross-Domain Fusion...')

  // Create sensors from different domains
  cyre.action({
    id: 'cpu-usage',
    path: 'system/performance/cpu',
    payload: {value: 45, unit: 'percent', domain: 'system'}
  })

  cyre.action({
    id: 'active-users',
    path: 'analytics/users/active',
    payload: {value: 150, unit: 'count', domain: 'analytics'}
  })

  cyre.action({
    id: 'response-time',
    path: 'performance/response',
    payload: {value: 120, unit: 'ms', domain: 'performance'},
    fusion: {
      crossDomain: {
        sensors: [
          {
            id: 'cpu-usage',
            domain: 'system',
            transform: (payload: any) => payload.value,
            weight: 0.4
          },
          {
            id: 'active-users',
            domain: 'analytics',
            transform: (payload: any) => payload.value / 10, // Normalize to 0-100 scale
            weight: 0.3
          }
        ],
        correlationModel: 'linear'
      }
    }
  })

  cyre.on('response-time', data => {
    console.log('🔗 Cross-domain fused data:', {
      responseTime: data.value,
      correlatedValue: data.correlatedValue || 'N/A',
      confidence: data.confidence || 'N/A'
    })
    return {processed: true}
  })

  // Simulate correlated data
  console.log('📊 Testing cross-domain correlations...')

  await cyre.call('cpu-usage', {value: 60, unit: 'percent', domain: 'system'})
  await cyre.call('active-users', {
    value: 200,
    unit: 'count',
    domain: 'analytics'
  })
  await cyre.call('response-time', {
    value: 180,
    unit: 'ms',
    domain: 'performance'
  })

  await cyre.call('cpu-usage', {value: 80, unit: 'percent', domain: 'system'})
  await cyre.call('active-users', {
    value: 300,
    unit: 'count',
    domain: 'analytics'
  })
  await cyre.call('response-time', {
    value: 250,
    unit: 'ms',
    domain: 'performance'
  })
}

/**
 * Test 5: Performance and Breathing System Integration
 * Tests intelligence system performance under load
 */
async function testPerformanceUnderLoad() {
  console.log('\n⚡ Testing Performance Under Load...')

  // Create channel with intelligence
  cyre.action({
    id: 'load-test-sensor',
    payload: {value: 50},
    fusion: {
      spatial: {
        sensors: [{id: 'load-helper', location: {x: 1, y: 1}, weight: 0.5}],
        method: 'weighted',
        distanceThreshold: 5
      }
    },
    patterns: {
      anomalies: [
        {
          name: 'load-anomaly',
          channelPattern: 'load-test-sensor',
          method: 'simple',
          threshold: 0.3,
          windowSize: 10
        }
      ]
    }
  })

  cyre.action({
    id: 'load-helper',
    payload: {value: 52}
  })

  cyre.on('load-test-sensor', data => ({processed: true, value: data.value}))
  cyre.on('load-helper', data => ({processed: true, value: data.value}))

  // Test performance under normal conditions
  console.log('📈 Testing normal load performance...')
  const normalTimes: number[] = []

  for (let i = 0; i < 20; i++) {
    const start = performance.now()
    await cyre.call('load-test-sensor', {value: 50 + Math.random() * 10})
    normalTimes.push(performance.now() - start)
  }

  const avgNormalTime =
    normalTimes.reduce((sum, t) => sum + t, 0) / normalTimes.length
  console.log(`⚡ Normal load avg time: ${avgNormalTime.toFixed(2)}ms`)

  // Simulate high system stress
  console.log('🔥 Testing performance under stress...')

  // Create high load to trigger breathing system
  const stressPromises = []
  for (let i = 0; i < 100; i++) {
    stressPromises.push(cyre.call('load-helper', {value: Math.random() * 100}))
  }

  // Test intelligence performance under stress
  const stressedTimes: number[] = []
  for (let i = 0; i < 10; i++) {
    const start = performance.now()
    await cyre.call('load-test-sensor', {value: 50 + Math.random() * 10})
    stressedTimes.push(performance.now() - start)
  }

  await Promise.all(stressPromises)

  const avgStressedTime =
    stressedTimes.reduce((sum, t) => sum + t, 0) / stressedTimes.length
  console.log(`🔥 Stressed load avg time: ${avgStressedTime.toFixed(2)}ms`)

  const breathing = cyre.getBreathingState()
  console.log('💨 Breathing state during test:', {
    stress: breathing.stress.toFixed(2),
    isRecuperating: breathing.isRecuperating,
    currentRate: breathing.currentRate
  })

  console.log('📊 Performance comparison:', {
    normalTime: `${avgNormalTime.toFixed(2)}ms`,
    stressedTime: `${avgStressedTime.toFixed(2)}ms`,
    intelligenceSkipped: avgStressedTime < avgNormalTime * 0.5 ? 'Yes' : 'No'
  })
}

/**
 * Test 6: Intelligence System Integration Test
 * Tests all systems working together
 */
async function testFullIntegration() {
  console.log('\n🚀 Testing Full Intelligence Integration...')

  // Create a complete intelligent sensor network
  const networkResult = cyre.intelligence.createSensorNetwork({
    id: 'test-network',
    sensors: [
      {
        id: 'temp-1',
        location: {x: 0, y: 0},
        type: 'temperature',
        fusion: {spatial: true, temporal: true},
        patterns: {anomalies: true}
      },
      {
        id: 'humidity-1',
        location: {x: 2, y: 0},
        type: 'humidity',
        fusion: {spatial: true},
        patterns: {anomalies: true}
      },
      {
        id: 'motion-1',
        location: {x: 1, y: 1},
        type: 'motion',
        patterns: {sequences: true}
      }
    ],
    globalFusion: {
      method: 'kalman',
      distanceThreshold: 10
    }
  })

  console.log('🏗️ Network creation:', networkResult.message)

  if (networkResult.ok) {
    // Test the network with various data
    const network = networkResult.network

    // Simulate sensor readings
    console.log('📊 Simulating sensor network activity...')

    await cyre.call('temp-1', {value: 22.5, location: {x: 0, y: 0}})
    await cyre.call('humidity-1', {value: 45, location: {x: 2, y: 0}})
    await cyre.call('motion-1', {detected: true, location: {x: 1, y: 1}})

    await cyre.call('temp-1', {value: 23.1, location: {x: 0, y: 0}})
    await cyre.call('humidity-1', {value: 48, location: {x: 2, y: 0}})

    // Check network intelligence
    const stats = cyre.intelligence.getSystemStats()
    console.log('🧠 Intelligence system stats:', {
      intelligenceRatio: `${(stats.overall.intelligenceRatio * 100).toFixed(
        1
      )}%`,
      fusionChannels: stats.fusion.totalChannels,
      patternChannels: stats.patterns.totalChannels,
      avgFusionConfidence: `${(stats.fusion.avgConfidence * 100).toFixed(1)}%`
    })
  }

  // Final system health check
  const finalReport = cyre.getIntelligentReport()
  console.log('🏁 Final System Health:', {
    healthScore: `${finalReport.system.healthScore}/100`,
    trend: finalReport.system.trend,
    insights: finalReport.insights.length,
    actions: finalReport.suggestedActions.length
  })
}

/**
 * Main test runner
 */
async function runIntelligenceTests() {
  console.log('🧪 Starting Cyre Intelligence System Tests\n')

  try {
    await testSpatialFusion()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await testPatternDetection()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await testSystemIntelligence()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await testCrossDomainFusion()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await testPerformanceUnderLoad()
    await new Promise(resolve => setTimeout(resolve, 1000))

    await testFullIntegration()

    console.log('\n✅ All intelligence tests completed successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Export for running
export {runIntelligenceTests}

// Auto-run if this file is executed directly

runIntelligenceTests()
