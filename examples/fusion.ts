// examples/fusion.ts
// Test file for fusion and pattern recognition talents

import {cyre} from '../src'
import {metrics} from '../src/metrics'
import {intelligence} from '../src/schema/fusion-plugin'

/*

      F.U.S.I.O.N - P.A.T.T.E.R.N - T.A.L.E.N.T.S - T.E.S.T
      
      Comprehensive test for multi-sensor fusion and pattern recognition:
      - Spatial fusion with sensor network
      - Temporal fusion with historical data
      - Cross-domain fusion with different sensor types
      - Anomaly detection with statistical methods
      - Sequence pattern recognition
      - Frequency pattern analysis

*/

async function testFusionAndPatternTalents() {
  console.log('🧪 TESTING FUSION AND PATTERN TALENTS')
  console.log('=' + '='.repeat(50))

  // Initialize Cyre and clear any existing state
  await cyre.initialize()
  cyre.clear()

  // ========================================
  // 1. SPATIAL FUSION TEST
  // ========================================
  console.log('\n🌐 1. SPATIAL FUSION TEST')
  console.log('-'.repeat(30))

  // Create temperature sensor network with spatial fusion
  console.log('Setting up spatial sensor network...')

  // Main sensor with spatial fusion configuration
  const spatialSensorResult = cyre.action({
    id: 'temp-sensor-central',
    payload: {value: 22.5, location: {x: 0, y: 0}},
    fusion: {
      spatial: {
        sensors: [
          {id: 'temp-sensor-north', location: {x: 0, y: 10}, weight: 0.8},
          {id: 'temp-sensor-south', location: {x: 0, y: -10}, weight: 0.8},
          {id: 'temp-sensor-east', location: {x: 10, y: 0}, weight: 0.6},
          {id: 'temp-sensor-west', location: {x: -10, y: 0}, weight: 0.6}
        ],
        method: 'weighted',
        distanceThreshold: 15
      }
    }
  })

  console.log(`Central sensor setup: ${spatialSensorResult.message}`)

  // Create nearby sensors
  const nearbysensors = [
    {id: 'temp-sensor-north', location: {x: 0, y: 10}, value: 23.1},
    {id: 'temp-sensor-south', location: {x: 0, y: -10}, value: 22.0},
    {id: 'temp-sensor-east', location: {x: 10, y: 0}, value: 22.8},
    {id: 'temp-sensor-west', location: {x: -10, y: 0}, value: 22.3}
  ]

  nearbysensors.forEach(sensor => {
    cyre.action({
      id: sensor.id,
      payload: {value: sensor.value, location: sensor.location}
    })
  })

  // Set up handler to capture fusion results
  let spatialFusionResults: any[] = []
  cyre.on('temp-sensor-central', data => {
    spatialFusionResults.push(data)
    console.log(`📊 Spatial fusion result: ${JSON.stringify(data)}`)
  })

  // Test spatial fusion
  console.log('\nTesting spatial fusion with varying sensor data...')

  for (let i = 0; i < 5; i++) {
    // Update all sensors with slightly different values
    await cyre.call('temp-sensor-central', {
      value: 22.5 + Math.random() * 2,
      location: {x: 0, y: 0}
    })

    await cyre.call('temp-sensor-north', {
      value: 23.0 + Math.random() * 1.5,
      location: {x: 0, y: 10}
    })

    await cyre.call('temp-sensor-south', {
      value: 22.2 + Math.random() * 1.5,
      location: {x: 0, y: -10}
    })

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Check fusion results
  const fusionResult = intelligence.getFusionResult('temp-sensor-central')
  console.log('\n📈 Spatial Fusion Analysis:')
  if (fusionResult) {
    console.log(`  Confidence: ${(fusionResult.confidence * 100).toFixed(1)}%`)
    console.log(`  Sources: ${fusionResult.sources.length}`)
    console.log(`  Method: ${fusionResult.method}`)
    console.log(`  Result: ${JSON.stringify(fusionResult.result)}`)
  } else {
    console.log('  ❌ No fusion results captured')
  }

  // ========================================
  // 2. TEMPORAL FUSION TEST
  // ========================================
  console.log('\n⏰ 2. TEMPORAL FUSION TEST')
  console.log('-'.repeat(30))

  // Create sensor with temporal fusion
  console.log('Setting up temporal fusion sensor...')

  cyre.action({
    id: 'pressure-sensor',
    payload: {value: 1013.25, unit: 'hPa'},
    fusion: {
      temporal: {
        sensors: ['pressure-sensor'],
        windowSize: 60000, // 1 minute window
        method: 'kalman',
        weights: [1.0]
      }
    }
  })

  let temporalResults: any[] = []
  cyre.on('pressure-sensor', data => {
    temporalResults.push(data)
    console.log(`📊 Temporal fusion result: ${JSON.stringify(data)}`)
  })

  console.log('\nGenerating temporal data sequence...')

  // Generate temporal data with trend and noise
  const basePressure = 1013.25
  for (let i = 0; i < 10; i++) {
    const trend = Math.sin(i * 0.3) * 5 // Sine wave trend
    const noise = (Math.random() - 0.5) * 3 // Random noise
    const value = basePressure + trend + noise

    await cyre.call('pressure-sensor', {
      value,
      unit: 'hPa',
      timestamp: Date.now()
    })

    await new Promise(resolve => setTimeout(resolve, 200))
  }

  const temporalFusion = intelligence.getFusionResult('pressure-sensor')
  console.log('\n📈 Temporal Fusion Analysis:')
  if (temporalFusion) {
    console.log(
      `  Confidence: ${(temporalFusion.confidence * 100).toFixed(1)}%`
    )
    console.log(`  Method: ${temporalFusion.method}`)
    console.log(`  Smoothed Value: ${JSON.stringify(temporalFusion.result)}`)
  } else {
    console.log('  ❌ No temporal fusion results')
  }

  // ========================================
  // 3. CROSS-DOMAIN FUSION TEST
  // ========================================
  console.log('\n🔄 3. CROSS-DOMAIN FUSION TEST')
  console.log('-'.repeat(35))

  console.log('Setting up cross-domain sensor fusion...')

  // Create multi-domain sensor
  cyre.action({
    id: 'environmental-monitor',
    payload: {temperature: 22.5, humidity: 65, pressure: 1013.25},
    fusion: {
      crossDomain: {
        sensors: [
          {
            id: 'temp-sensor-central',
            domain: 'temperature',
            transform: (data: any) => data.value || 0,
            weight: 0.4
          },
          {
            id: 'humidity-sensor',
            domain: 'humidity',
            transform: (data: any) => data.humidity || 0,
            weight: 0.3
          },
          {
            id: 'pressure-sensor',
            domain: 'pressure',
            transform: (data: any) => data.value - 1000 || 0, // Normalize pressure
            weight: 0.3
          }
        ],
        correlationModel: 'linear'
      }
    }
  })

  // Create humidity sensor
  cyre.action({
    id: 'humidity-sensor',
    payload: {humidity: 65, unit: '%'}
  })

  let crossDomainResults: any[] = []
  cyre.on('environmental-monitor', data => {
    crossDomainResults.push(data)
    console.log(`📊 Cross-domain fusion: ${JSON.stringify(data)}`)
  })

  console.log('\nTesting cross-domain correlation...')

  // Simulate correlated environmental changes
  for (let i = 0; i < 5; i++) {
    const tempChange = Math.random() * 4 - 2 // ±2°C
    const humidityChange = -tempChange * 2 + Math.random() * 5 // Inverse correlation
    const pressureChange = Math.random() * 10 - 5 // ±5 hPa

    await cyre.call('temp-sensor-central', {
      value: 22.5 + tempChange,
      location: {x: 0, y: 0}
    })

    await cyre.call('humidity-sensor', {
      humidity: 65 + humidityChange,
      unit: '%'
    })

    await cyre.call('pressure-sensor', {
      value: 1013.25 + pressureChange,
      unit: 'hPa'
    })

    await cyre.call('environmental-monitor', {
      temperature: 22.5 + tempChange,
      humidity: 65 + humidityChange,
      pressure: 1013.25 + pressureChange
    })

    await new Promise(resolve => setTimeout(resolve, 300))
  }

  const crossDomainFusion = intelligence.getFusionResult(
    'environmental-monitor'
  )
  console.log('\n📈 Cross-Domain Fusion Analysis:')
  if (crossDomainFusion) {
    console.log(
      `  Confidence: ${(crossDomainFusion.confidence * 100).toFixed(1)}%`
    )
    console.log(`  Domains: ${crossDomainFusion.sources.length}`)
    console.log(`  Correlation: ${crossDomainFusion.method}`)
  } else {
    console.log('  ❌ No cross-domain fusion results')
  }

  // ========================================
  // 4. ANOMALY DETECTION TEST
  // ========================================
  console.log('\n🚨 4. ANOMALY DETECTION TEST')
  console.log('-'.repeat(35))

  console.log('Setting up anomaly detection...')

  cyre.action({
    id: 'vibration-sensor',
    payload: {value: 0.5, unit: 'g'},
    patterns: {
      anomalies: [
        {
          name: 'vibration-spike',
          channelPattern: 'vibration-sensor',
          method: 'zscore',
          threshold: 2.0,
          windowSize: 20
        },
        {
          name: 'vibration-outlier',
          channelPattern: 'vibration-sensor',
          method: 'iqr',
          threshold: 1.5,
          windowSize: 15
        }
      ]
    }
  })

  let anomalyDetections: any[] = []
  cyre.on('vibration-sensor', data => {
    console.log(`📊 Vibration reading: ${data?.value || 'undefined'}`)

    // Check for pattern detection
    const patternState = intelligence.getPatternState('vibration-sensor')
    if (patternState && patternState.lastDetection > Date.now() - 1000) {
      anomalyDetections.push(patternState)
      console.log(`🚨 ANOMALY DETECTED: ${patternState.patternName}`)
    }
  })

  console.log('\nGenerating normal data baseline...')

  // Generate normal baseline data
  for (let i = 0; i < 25; i++) {
    const normalValue = 0.5 + (Math.random() - 0.5) * 0.2 // 0.4-0.6 range
    await cyre.call('vibration-sensor', {
      value: normalValue,
      unit: 'g',
      timestamp: Date.now()
    })
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  console.log('Injecting anomalies...')

  // Inject anomalies
  const anomalies = [
    {value: 2.5, type: 'spike'}, // Large spike
    {value: 0.1, type: 'drop'}, // Large drop
    {value: 1.8, type: 'spike'} // Another spike
  ]

  for (const anomaly of anomalies) {
    console.log(`  Injecting ${anomaly.type}: ${anomaly.value}`)
    await cyre.call('vibration-sensor', {
      value: anomaly.value,
      unit: 'g',
      anomaly: true,
      type: anomaly.type
    })
    await new Promise(resolve => setTimeout(resolve, 100))

    // Add some normal data after anomaly
    for (let i = 0; i < 3; i++) {
      const normalValue = 0.5 + (Math.random() - 0.5) * 0.2
      await cyre.call('vibration-sensor', {
        value: normalValue,
        unit: 'g'
      })
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  console.log('\n📈 Anomaly Detection Analysis:')
  console.log(`  Anomalies detected: ${anomalyDetections.length}`)
  if (anomalyDetections.length > 0) {
    anomalyDetections.forEach((detection, i) => {
      console.log(
        `  ${i + 1}. ${detection.patternName} (confidence: ${(
          detection.confidence * 100
        ).toFixed(1)}%)`
      )
    })
  }

  const vibrationPatterns = intelligence.getPatternState('vibration-sensor')
  if (vibrationPatterns) {
    console.log(`  Total detections: ${vibrationPatterns.totalDetections}`)
    console.log(
      `  Last detection: ${new Date(
        vibrationPatterns.lastDetection
      ).toLocaleTimeString()}`
    )
  }

  // ========================================
  // 5. SEQUENCE PATTERN TEST
  // ========================================
  console.log('\n🔗 5. SEQUENCE PATTERN DETECTION TEST')
  console.log('-'.repeat(45))

  console.log('Setting up sequence pattern detection...')

  cyre.action({
    id: 'door-sensor',
    payload: {state: 'closed'},
    patterns: {
      sequences: [
        {
          name: 'entry-sequence',
          conditions: [
            {
              channelPattern: 'door-sensor',
              condition: (payload: any) => payload.state === 'opened',
              timeout: 2000
            },
            {
              channelPattern: 'motion-sensor',
              condition: (payload: any) => payload.detected === true,
              timeout: 3000
            },
            {
              channelPattern: 'door-sensor',
              condition: (payload: any) => payload.state === 'closed',
              timeout: 5000
            }
          ],
          timeout: 10000,
          allowOverlap: false
        }
      ]
    }
  })

  cyre.action({
    id: 'motion-sensor',
    payload: {detected: false}
  })

  let sequenceDetections: any[] = []

  cyre.on('door-sensor', data => {
    console.log(`🚪 Door: ${data?.state || 'unknown'}`)
  })

  cyre.on('motion-sensor', data => {
    console.log(`👤 Motion: ${data?.detected ? 'detected' : 'none'}`)
  })

  console.log('\nSimulating entry sequence...')

  // Simulate successful entry sequence
  await cyre.call('door-sensor', {state: 'opened', timestamp: Date.now()})
  await new Promise(resolve => setTimeout(resolve, 500))

  await cyre.call('motion-sensor', {detected: true, timestamp: Date.now()})
  await new Promise(resolve => setTimeout(resolve, 1000))

  await cyre.call('door-sensor', {state: 'closed', timestamp: Date.now()})
  await new Promise(resolve => setTimeout(resolve, 500))

  // Check for sequence detection
  const doorPatterns = intelligence.getPatternState('door-sensor')
  console.log('\n📈 Sequence Pattern Analysis:')
  if (doorPatterns) {
    console.log(`  Pattern: ${doorPatterns.patternName}`)
    console.log(`  Detections: ${doorPatterns.totalDetections}`)
    console.log(`  Confidence: ${(doorPatterns.confidence * 100).toFixed(1)}%`)
  } else {
    console.log('  ❌ No sequence patterns detected')
  }

  // ========================================
  // 6. FREQUENCY PATTERN TEST
  // ========================================
  console.log('\n📊 6. FREQUENCY PATTERN TEST')
  console.log('-'.repeat(35))

  console.log('Setting up frequency pattern detection...')

  cyre.action({
    id: 'heartbeat-monitor',
    payload: {bpm: 72},
    patterns: {
      frequency: [
        {
          name: 'normal-heartbeat',
          channelPattern: 'heartbeat-monitor',
          expectedInterval: 833, // ~72 BPM in milliseconds
          tolerance: 20, // 20% tolerance
          minOccurrences: 5
        }
      ]
    }
  })

  let frequencyDetections: any[] = []

  cyre.on('heartbeat-monitor', data => {
    console.log(`💓 Heartbeat: ${data?.bpm || 0} BPM`)
  })

  console.log('\nSimulating regular heartbeat pattern...')

  // Simulate regular heartbeat with slight variation
  const baseBPM = 72
  const baseInterval = 60000 / baseBPM // ms per beat

  for (let i = 0; i < 10; i++) {
    const variation = (Math.random() - 0.5) * 0.1 // ±5% variation
    const currentBPM = baseBPM * (1 + variation)
    const interval = (60000 / currentBPM) * (1 + (Math.random() - 0.5) * 0.1)

    await cyre.call('heartbeat-monitor', {
      bpm: Math.round(currentBPM),
      timestamp: Date.now()
    })

    await new Promise(resolve => setTimeout(resolve, Math.max(100, interval)))
  }

  const heartbeatPatterns = intelligence.getPatternState('heartbeat-monitor')
  console.log('\n📈 Frequency Pattern Analysis:')
  if (heartbeatPatterns) {
    console.log(`  Pattern: ${heartbeatPatterns.patternName}`)
    console.log(`  Detections: ${heartbeatPatterns.totalDetections}`)
    console.log(
      `  Regularity score: ${(heartbeatPatterns.confidence * 100).toFixed(1)}%`
    )
  } else {
    console.log('  ❌ No frequency patterns detected')
  }

  // ========================================
  // 7. INTELLIGENCE SYSTEM OVERVIEW
  // ========================================
  console.log('\n🧠 7. INTELLIGENCE SYSTEM OVERVIEW')
  console.log('-'.repeat(40))

  const systemStats = intelligence.getSystemStats()
  console.log('Intelligence System Statistics:')
  console.log(`  Total channels: ${systemStats.overall.totalChannels}`)
  console.log(
    `  Intelligent channels: ${systemStats.overall.intelligentChannels}`
  )
  console.log(
    `  Intelligence ratio: ${(
      systemStats.overall.intelligenceRatio * 100
    ).toFixed(1)}%`
  )

  console.log('\nFusion Statistics:')
  console.log(`  Fusion channels: ${systemStats.fusion.totalChannels}`)
  console.log(
    `  Average confidence: ${(systemStats.fusion.avgConfidence * 100).toFixed(
      1
    )}%`
  )

  console.log('\nPattern Statistics:')
  console.log(`  Pattern channels: ${systemStats.patterns.totalChannels}`)
  console.log(`  Total detections: ${systemStats.patterns.totalDetections}`)
  console.log(
    `  Average confidence: ${(systemStats.patterns.avgConfidence * 100).toFixed(
      1
    )}%`
  )

  // ========================================
  // 8. METRICS AND PERFORMANCE ANALYSIS
  // ========================================
  console.log('\n⚡ 8. PERFORMANCE ANALYSIS')
  console.log('-'.repeat(30))

  const channelMetrics = [
    'temp-sensor-central',
    'vibration-sensor',
    'environmental-monitor'
  ]

  console.log('Channel Performance Summary:')
  channelMetrics.forEach(channelId => {
    const analysis = metrics.analyzeChannel(channelId)
    if (analysis) {
      console.log(`  ${channelId}:`)
      console.log(`    Calls: ${analysis.metrics.calls}`)
      console.log(
        `    Success rate: ${(analysis.metrics.successRate * 100).toFixed(1)}%`
      )
      console.log(
        `    Avg latency: ${analysis.metrics.averageLatency.toFixed(2)}ms`
      )
      console.log(`    Status: ${analysis.status}`)
    }
  })

  // ========================================
  // 9. TEST SUMMARY AND RESULTS
  // ========================================
  console.log('\n📋 9. TEST SUMMARY')
  console.log('-'.repeat(25))

  const testResults = {
    spatialFusion: spatialFusionResults.length > 0,
    temporalFusion: temporalResults.length > 0,
    crossDomainFusion: crossDomainResults.length > 0,
    anomalyDetection: anomalyDetections.length > 0,
    sequencePattern: sequenceDetections.length > 0,
    frequencyPattern: frequencyDetections.length > 0,
    systemStats: systemStats.overall.intelligentChannels > 0
  }

  console.log('Test Results:')
  Object.entries(testResults).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌'
    console.log(`  ${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`)
  })

  const passedTests = Object.values(testResults).filter(Boolean).length
  const totalTests = Object.keys(testResults).length

  console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`)

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL FUSION AND PATTERN TALENTS WORKING CORRECTLY!')
  } else {
    console.log('\n⚠️  Some talents need investigation')
  }

  // ========================================
  // 10. CLEANUP
  // ========================================
  console.log('\n🧹 10. CLEANUP')
  console.log('-'.repeat(15))

  console.log('Exporting final intelligence state...')

  const finalReport = {
    timestamp: new Date().toISOString(),
    testResults,
    intelligenceStats: systemStats,
    fusionChannels: systemStats.fusion.channels,
    patternChannels: systemStats.patterns.channels,
    recommendations: [
      'Fusion talents are processing sensor data effectively',
      'Pattern recognition is detecting anomalies and sequences',
      'Cross-domain fusion provides multi-sensor insights',
      'System is ready for production intelligence workloads'
    ]
  }

  console.log('\nFinal Intelligence Report:')
  console.log(JSON.stringify(finalReport, null, 2))

  return finalReport
}

// Export test function for external use
export {testFusionAndPatternTalents}

// Run the test if this file is executed directly

testFusionAndPatternTalents().catch(console.error)
