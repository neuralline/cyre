// smart-factory-functional.ts
// Functional implementation showcasing full Cyre capabilities

import {cyre, log, schema} from '../src/index'

// Production state (functional approach)
let productionStats = {
  totalUnits: 0,
  defectiveUnits: 0,
  emergencyStops: 0,
  fusionCorrections: 0,
  patternsDetected: 0
}

// Schemas
const temperatureSchema = schema.object({
  value: schema.number().min(-50).max(200),
  unit: schema.literal('celsius'),
  location: schema.object({x: schema.number(), y: schema.number()}),
  timestamp: schema.number()
})

const pressureSchema = schema.object({
  value: schema.number().min(0).max(500),
  unit: schema.literal('PSI'),
  timestamp: schema.number()
})

// Helper functions (pure functions)
const generateTempReading = (baseTemp: number, variation: number = 4) => ({
  value: baseTemp + (Math.random() - 0.5) * variation,
  unit: 'celsius' as const,
  location: {x: 10, y: 5},
  timestamp: Date.now()
})

const generatePressureReading = (
  basePressure: number,
  variation: number = 6
) => ({
  value: basePressure + (Math.random() - 0.5) * variation,
  unit: 'PSI' as const,
  timestamp: Date.now()
})

const generateQualityReading = () => {
  const defects = Math.random() < 0.1 ? Math.floor(Math.random() * 2) : 0
  return {
    defectCount: defects,
    confidence: 0.95 - Math.random() * 0.1,
    imageAnalysis: {
      brightness: 128 + (Math.random() - 0.5) * 20,
      contrast: 0.8 + (Math.random() - 0.5) * 0.2,
      artifacts:
        defects > 0 ? ['scratch', 'discoloration'].slice(0, defects) : []
    },
    timestamp: Date.now()
  }
}

// Production line setup (functional)
const setupProductionLine = async () => {
  console.log('🏭 Setting up Smart Factory with Cyre...\n')

  // Initialize Cyre
  await cyre.initialize({autoSave: true, saveKey: 'smart-factory'})

  // 1. Setup Groups with Coordination
  console.log('📊 Creating production groups...')

  cyre.group('production-line-alpha', {
    channels: ['temp-zone-1', 'temp-zone-2', 'pressure-main', 'quality-camera'],
    shared: {
      throttle: 1000,
      priority: {level: 'high'}
    },
    coordination: {
      emergency: {
        triggers: ['temperature-critical', 'pressure-spike'],
        action: 'emergency-shutdown'
      }
    }
  })

  // 2. Temperature Sensors with Fusion
  console.log('🌡️  Setting up temperature fusion...')

  // Primary temperature with spatial fusion
  cyre.action({
    id: 'temp-zone-1',
    group: 'production-line-alpha',

    fusion: {
      spatial: [
        {id: 'temp-zone-2', location: {x: 15, y: 5}, weight: 0.4},
        {id: 'temp-backup', location: {x: 8, y: 8}, weight: 0.3}
      ],
      temporal: ['ambient-temp'],
      method: 'weighted'
    },

    patterns: {
      sequences: [
        {
          name: 'thermal-runaway',
          conditions: ['value > 90', 'value > 95', 'value > 100'],
          timeout: 180000
        }
      ],
      anomalies: [{method: 'zscore', threshold: 2.5}]
    },

    schema: temperatureSchema,
    detectChanges: true,
    interval: 3000
  })

  // Secondary temperature sensor
  cyre.action({
    id: 'temp-zone-2',
    fusion: {
      spatial: [{id: 'temp-zone-1', location: {x: 10, y: 5}, weight: 0.5}],
      method: 'weighted'
    },
    schema: temperatureSchema,
    interval: 3000
  })

  // Supporting sensors for fusion
  cyre.action({
    id: 'temp-backup',
    payload: {
      value: 84,
      unit: 'celsius',
      location: {x: 8, y: 8},
      timestamp: Date.now()
    },
    interval: 5000
  })

  cyre.action({
    id: 'ambient-temp',
    payload: {value: 22, timestamp: Date.now()},
    interval: 30000
  })

  // 3. Pressure Monitoring with Patterns
  console.log('💨 Setting up pressure patterns...')

  cyre.action({
    id: 'pressure-main',
    group: 'production-line-alpha',

    fusion: {
      temporal: ['pressure-backup'],
      method: 'kalman'
    },

    patterns: {
      sequences: [
        {
          name: 'pressure-spike',
          conditions: ['value > 60', 'value > 70', 'value > 80'],
          timeout: 120000
        },
        {
          name: 'pressure-oscillation',
          conditions: ['value > 50', 'value < 40', 'value > 50'],
          timeout: 300000
        }
      ],
      anomalies: [{method: 'zscore', threshold: 3.0}]
    },

    schema: pressureSchema,
    interval: 2000
  })

  cyre.action({
    id: 'pressure-backup',
    payload: {value: 44, unit: 'PSI', timestamp: Date.now()},
    interval: 4000
  })

  // 4. Quality Control
  console.log('📷 Setting up quality monitoring...')

  cyre.action({
    id: 'quality-camera',
    group: 'production-line-alpha',

    patterns: {
      sequences: [
        {
          name: 'quality-degradation',
          conditions: ['defectCount > 1', 'defectCount > 2', 'defectCount > 3'],
          timeout: 1800000
        }
      ],
      anomalies: [{method: 'zscore', threshold: 2.0}]
    },

    interval: 8000,
    detectChanges: true
  })

  // 5. Emergency Systems
  cyre.action({
    id: 'emergency-shutdown',
    payload: {active: false, reason: '', timestamp: Date.now()}
  })

  cyre.action({
    id: 'emergency-cooling',
    payload: {active: false, intensity: 0, timestamp: Date.now()}
  })

  console.log('✅ Production line configured\n')
}

// Event handlers (functional approach)
const setupEventHandlers = () => {
  console.log('📊 Setting up event handlers...')

  // Temperature monitoring with fusion feedback
  cyre.on('temp-zone-1', payload => {
    if (payload.fusion?.fused) {
      productionStats.fusionCorrections++
      console.log(
        `🔄 Temp fusion: ${
          payload.fusion.original
        }°C → ${payload.fusion.fused.toFixed(1)}°C (confidence: ${(
          payload.fusion.confidence * 100
        ).toFixed(1)}%)`
      )
    }

    if (payload.detectedPatterns?.length > 0) {
      productionStats.patternsDetected++
      payload.detectedPatterns.forEach(pattern => {
        console.log(
          `🔥 Pattern: ${pattern.name} (${(pattern.confidence * 100).toFixed(
            1
          )}%)`
        )

        if (pattern.name === 'thermal-runaway') {
          console.log('🚨 THERMAL RUNAWAY - Activating emergency cooling!')
          cyre.call('emergency-cooling', {
            active: true,
            intensity: 100,
            reason: 'thermal-runaway',
            timestamp: Date.now()
          })
        }
      })
    }
  })

  // Pressure monitoring
  cyre.on('pressure-main', payload => {
    if (payload.detectedPatterns?.length > 0) {
      productionStats.patternsDetected++
      payload.detectedPatterns.forEach(pattern => {
        console.log(`💨 Pressure pattern: ${pattern.name}`)

        if (pattern.name === 'pressure-spike' && pattern.confidence > 0.8) {
          console.log('⚠️  Pressure spike - relieving pressure')
          // Simulate pressure relief after 2 seconds
          setTimeout(() => {
            cyre.call('pressure-main', generatePressureReading(35, 3))
          }, 2000)
        }
      })
    }

    if (payload.fusion?.temporal) {
      console.log(
        `💨 Pressure correlation: ${(
          payload.fusion.temporal.correlation * 100
        ).toFixed(1)}%`
      )
    }
  })

  // Quality monitoring
  cyre.on('quality-camera', payload => {
    productionStats.totalUnits++

    if (payload.defectCount > 0) {
      productionStats.defectiveUnits++
      console.log(
        `📷 Quality issue: ${payload.defectCount} defects (confidence: ${(
          payload.confidence * 100
        ).toFixed(1)}%)`
      )
    }

    if (payload.detectedPatterns?.length > 0) {
      payload.detectedPatterns.forEach(pattern => {
        console.log(`📊 Quality pattern: ${pattern.name}`)
      })
    }
  })

  // Emergency response
  cyre.on('emergency-cooling', payload => {
    if (payload.active) {
      console.log(`❄️  Emergency cooling: ${payload.intensity}% intensity`)

      // Simulate cooling effect
      setTimeout(() => {
        cyre.call('temp-zone-1', {
          value: Math.max(70, 90 - payload.intensity * 0.2),
          unit: 'celsius',
          location: {x: 10, y: 5},
          timestamp: Date.now()
        })
      }, 3000)
    }
  })

  console.log('✅ Event handlers configured\n')
}

// Production simulation (functional)
const runProductionSimulation = () => {
  console.log('🚀 Starting production simulation...\n')

  let simulationTime = 0
  const maxSimulationTime = 90000 // 90 seconds

  // Normal operation cycle
  const normalOperation = setInterval(() => {
    simulationTime += 2000

    // Generate sensor readings
    cyre.call('temp-zone-1', generateTempReading(85, 3))
    cyre.call('temp-zone-2', generateTempReading(82, 3))
    cyre.call('pressure-main', generatePressureReading(45, 4))
    cyre.call('quality-camera', generateQualityReading())

    // Update supporting sensors
    cyre.call('temp-backup', generateTempReading(84, 2))
    cyre.call('ambient-temp', {
      value: 22 + Math.sin(simulationTime / 10000) * 2,
      timestamp: Date.now()
    })
    cyre.call('pressure-backup', generatePressureReading(44, 2))

    if (simulationTime >= maxSimulationTime) {
      clearInterval(normalOperation)
      endSimulation()
    }
  }, 2000)

  // Trigger events at specific times

  // Temperature spike at 20 seconds
  setTimeout(() => {
    console.log('\n🔥 Triggering temperature spike...')
    let temp = 85
    const heatUp = setInterval(() => {
      temp += 3 + Math.random() * 4
      cyre.call('temp-zone-1', {
        value: temp,
        unit: 'celsius',
        location: {x: 10, y: 5},
        timestamp: Date.now()
      })

      if (temp > 100) clearInterval(heatUp)
    }, 3000)
  }, 20000)

  // Pressure spike at 40 seconds
  setTimeout(() => {
    console.log('\n💨 Triggering pressure buildup...')
    let pressure = 50
    const pressureUp = setInterval(() => {
      pressure += 5 + Math.random() * 8
      cyre.call('pressure-main', generatePressureReading(pressure, 2))

      if (pressure > 80) clearInterval(pressureUp)
    }, 4000)
  }, 40000)

  // Quality degradation at 60 seconds
  setTimeout(() => {
    console.log('\n📷 Triggering quality issues...')
    let defects = 1
    const qualityDegrade = setInterval(() => {
      cyre.call('quality-camera', {
        defectCount: defects,
        confidence: Math.max(0.5, 0.9 - defects * 0.1),
        imageAnalysis: {
          brightness: Math.max(50, 128 - defects * 10),
          contrast: Math.max(0.3, 0.8 - defects * 0.1),
          artifacts: ['scratch', 'dent', 'crack'].slice(0, defects)
        },
        timestamp: Date.now()
      })

      defects++
      if (defects > 4) clearInterval(qualityDegrade)
    }, 6000)
  }, 60000)
}

// Statistics display (functional)
const showStats = () => {
  console.log('\n📊 Production Statistics:')
  console.log(`   Units: ${productionStats.totalUnits}`)
  console.log(`   Defects: ${productionStats.defectiveUnits}`)
  console.log(
    `   Quality: ${(
      ((productionStats.totalUnits - productionStats.defectiveUnits) /
        Math.max(1, productionStats.totalUnits)) *
      100
    ).toFixed(1)}%`
  )
  console.log(`   Fusion Corrections: ${productionStats.fusionCorrections}`)
  console.log(`   Patterns Detected: ${productionStats.patternsDetected}`)

  const metrics = cyre.getMetrics()
  console.log(`   Total Calls: ${metrics.totalCalls}`)
  console.log(
    `   System Stress: ${(metrics.breathing.stress * 100).toFixed(1)}%`
  )
}

const endSimulation = () => {
  console.log('\n🏁 Production Simulation Complete!')
  console.log('='.repeat(50))
  showStats()

  const report = cyre.getMetricsReport()
  console.log(`\n📈 Cyre Performance:`)
  console.log(`   Uptime: ${report.global.uptime}s`)
  console.log(`   Call Rate: ${report.global.callRate.toFixed(2)}/sec`)
  console.log(`   Errors: ${report.global.totalErrors}`)

  const insights = cyre.getPerformanceInsights()
  if (insights.length > 0) {
    console.log('\n💡 Insights:')
    insights.forEach(insight => console.log(`   • ${insight}`))
  }

  // Save state and exit
  setTimeout(async () => {
    console.log('\n💾 Saving state...')
    await cyre.saveState()
    console.log('✅ Demo complete!')
    process.exit(0)
  }, 2000)
}

// Stats display interval
let statsInterval: NodeJS.Timeout

// Main execution (functional)
const main = async () => {
  console.log('🚀 Cyre Advanced Features - Functional Demo\n')
  console.log('Features demonstrated:')
  console.log('• Multi-sensor fusion (spatial & temporal)')
  console.log('• Pattern recognition & anomaly detection')
  console.log('• Group coordination & emergency response')
  console.log('• Real-time monitoring & analytics\n')

  try {
    await setupProductionLine()
    setupEventHandlers()

    // Show stats every 15 seconds
    statsInterval = setInterval(showStats, 15000)

    runProductionSimulation()
  } catch (error) {
    console.error('❌ Error:', error)
    clearInterval(statsInterval)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down...')
  clearInterval(statsInterval)
  cyre.shutdown()
})

// Run the demo
main().catch(console.error)
