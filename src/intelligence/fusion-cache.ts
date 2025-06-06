// src/intelligence/fusion-cache.ts
// Centralized fusion cache that can be imported anywhere

import payloadState from '../context/payload-state'
import cyre from '../'
import {createStore} from '../context/create-store'

/*

      C.Y.R.E - F.U.S.I.O.N - C.A.C.H.E
      
      Centralized cache for fusion results and pattern states:
      - Exportable fusion cache
      - Pattern state storage
      - Performance metrics
      - Easy integration

*/

export interface FusionResult {
  result: any
  confidence: number
  sources: string[]
  timestamp: number
  method: string
}

export interface PatternState {
  channelId: string
  patternName: string
  lastDetection: number
  totalDetections: number
  confidence: number
  metadata: Record<string, any>
}

// Global caches that can be imported
export const fusionCache = createStore<FusionResult>()
export const patternStateCache = createStore<PatternState>()

// Helper functions
export const getFusionResult = (
  channelId: string
): FusionResult | undefined => {
  return fusionCache.get(channelId)
}

export const setFusionResult = (
  channelId: string,
  result: FusionResult
): void => {
  fusionCache.set(channelId, result)
}

export const getPatternState = (
  channelId: string
): PatternState | undefined => {
  return patternStateCache.get(channelId)
}

export const setPatternState = (
  channelId: string,
  state: PatternState
): void => {
  patternStateCache.set(channelId, state)
}

// ============================================
// src/intelligence/fusion-algorithms.ts
// Actual working fusion algorithm implementations

export const performSpatialFusion = (
  config: any,
  payload: any,
  channelId: string
): {value: any; confidence: number; sources: string[]} => {
  try {
    // Extract current location from payload
    const currentLocation = extractLocation(payload) || {x: 0, y: 0}
    const nearbyData: Array<{
      id: string
      value: any
      distance: number
      weight: number
    }> = []

    // Gather data from nearby sensors
    config.sensors.forEach((sensor: any) => {
      const distance = calculateDistance(currentLocation, sensor.location)

      if (distance <= (sensor.maxDistance || config.distanceThreshold)) {
        const sensorPayload = payloadState.get(sensor.id)

        if (sensorPayload !== undefined) {
          const weight = sensor.weight || 1 / (distance + 1) // Inverse distance weighting
          nearbyData.push({
            id: sensor.id,
            value: sensorPayload,
            distance,
            weight
          })
        }
      }
    })

    if (nearbyData.length === 0) {
      return {value: payload, confidence: 1.0, sources: [channelId]}
    }

    // Weighted fusion algorithm
    let fusedValue = payload
    let totalWeight = 1.0 // Current sensor weight
    let weightedSum = extractNumericValue(payload) || 0

    nearbyData.forEach(data => {
      const numericValue = extractNumericValue(data.value)
      if (numericValue !== null) {
        weightedSum += numericValue * data.weight
        totalWeight += data.weight
      }
    })

    // Calculate fused result
    if (typeof payload === 'number') {
      fusedValue = weightedSum / totalWeight
    } else if (typeof payload === 'object' && payload.value !== undefined) {
      fusedValue = {
        ...payload,
        value: weightedSum / totalWeight,
        originalValue: payload.value
      }
    }

    // Calculate confidence based on agreement between sensors
    const variance =
      nearbyData.reduce((sum, data) => {
        const numericValue = extractNumericValue(data.value) || 0
        const diff = numericValue - weightedSum / totalWeight
        return sum + diff * diff * data.weight
      }, 0) / totalWeight

    const confidence = Math.max(0.1, Math.min(1.0, 1 / (1 + variance)))

    return {
      value: fusedValue,
      confidence,
      sources: [channelId, ...nearbyData.map(d => d.id)]
    }
  } catch (error) {
    console.error('Spatial fusion error:', error)
    return {value: payload, confidence: 0.5, sources: [channelId]}
  }
}

export const performTemporalFusion = (
  config: any,
  payload: any,
  channelId: string
): {value: any; confidence: number; sources: string[]} => {
  try {
    const windowStart = Date.now() - config.windowSize
    const allValues: number[] = []

    // Gather historical data
    config.sensors.forEach((sensorId: string) => {
      const history = payloadState.getHistory(sensorId, 50)
      const windowData = history
        .filter((entry: any) => entry.timestamp >= windowStart)
        .map((entry: any) => extractNumericValue(entry.payload))
        .filter((value: any) => value !== null)

      allValues.push(...windowData)
    })

    if (allValues.length === 0) {
      return {value: payload, confidence: 1.0, sources: [channelId]}
    }

    // Temporal fusion based on method
    let fusedValue: any
    let confidence: number

    switch (config.method) {
      case 'average':
        const avg = allValues.reduce((sum, v) => sum + v, 0) / allValues.length
        fusedValue =
          typeof payload === 'number' ? avg : {...payload, value: avg}
        confidence = 0.8
        break

      case 'median':
        const sorted = [...allValues].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        fusedValue =
          typeof payload === 'number' ? median : {...payload, value: median}
        confidence = 0.9
        break

      case 'kalman':
        // Simplified Kalman filter
        const kalmanResult = simpleKalmanFilter(allValues)
        fusedValue =
          typeof payload === 'number'
            ? kalmanResult
            : {...payload, value: kalmanResult}
        confidence = 0.95
        break

      default:
        fusedValue = payload
        confidence = 0.7
    }

    return {
      value: fusedValue,
      confidence,
      sources: config.sensors
    }
  } catch (error) {
    console.error('Temporal fusion error:', error)
    return {value: payload, confidence: 0.5, sources: [channelId]}
  }
}

// ============================================
// src/intelligence/pattern-detectors.ts
// Working pattern detection implementations

export const detectAnomalies = (
  channelId: string,
  payload: any,
  anomalies: any[]
): Array<{
  detected: boolean
  patterns: Array<{name: string; confidence: number}>
}> => {
  const results: any[] = []

  anomalies.forEach(anomaly => {
    if (!matchesChannelPattern(channelId, anomaly.channelPattern)) return

    const value = extractNumericValue(payload)
    if (value === null) return

    // Get or create baseline for this anomaly detector
    let baseline = getAnomalyBaseline(channelId, anomaly.name)

    // Update baseline with new value
    baseline.values.push(value)
    if (baseline.values.length > anomaly.windowSize) {
      baseline.values.shift()
    }

    // Recalculate statistics
    updateAnomalyBaseline(baseline)
    setAnomalyBaseline(channelId, anomaly.name, baseline)

    // Detect anomaly based on method
    let isAnomaly = false
    let confidence = 0

    if (baseline.values.length >= 10) {
      // Need minimum data points
      switch (anomaly.method) {
        case 'zscore':
          if (baseline.stdDev > 0) {
            const zscore = Math.abs((value - baseline.mean) / baseline.stdDev)
            isAnomaly = zscore > anomaly.threshold
            confidence = Math.min(zscore / anomaly.threshold, 1)
          }
          break

        case 'iqr':
          const lowerBound = baseline.q1 - anomaly.threshold * baseline.iqr
          const upperBound = baseline.q3 + anomaly.threshold * baseline.iqr
          isAnomaly = value < lowerBound || value > upperBound
          confidence = isAnomaly ? 1 : 0
          break

        case 'custom':
          if (anomaly.customDetector) {
            isAnomaly = anomaly.customDetector(baseline.values)
            confidence = isAnomaly ? 1 : 0
          }
          break
      }
    }

    if (isAnomaly) {
      results.push({
        detected: true,
        patterns: [
          {
            name: `${anomaly.name}-anomaly`,
            confidence
          }
        ]
      })

      // Update pattern state
      setPatternState(channelId, {
        channelId,
        patternName: anomaly.name,
        lastDetection: Date.now(),
        totalDetections: (getPatternState(channelId)?.totalDetections || 0) + 1,
        confidence,
        metadata: {
          type: 'anomaly',
          method: anomaly.method,
          value,
          baseline: baseline.mean
        }
      })
    }
  })

  return results
}

// ============================================
// DEMO IMPLEMENTATION
// ============================================

// demo/fusion-pattern-demo.ts
export const runFusionPatternDemo = async () => {
  console.log('🚀 Starting Fusion & Pattern Recognition Demo')

  // Initialize Cyre
  await cyre.initialize()

  console.log('\n📡 Setting up sensor network...')

  // Create temperature sensors with spatial fusion
  cyre.action({
    id: 'temp-sensor-1',
    payload: {value: 22.5, location: {x: 0, y: 0}},
    fusion: {
      spatial: {
        sensors: [
          {id: 'temp-sensor-2', location: {x: 5, y: 0}, weight: 0.6},
          {id: 'temp-sensor-3', location: {x: 10, y: 0}, weight: 0.4}
        ],
        method: 'weighted',
        distanceThreshold: 15
      },
      temporal: {
        sensors: ['temp-sensor-1', 'temp-sensor-2'],
        windowSize: 60000, // 1 minute
        method: 'kalman'
      }
    },
    patterns: {
      anomalies: [
        {
          name: 'temperature-spike',
          channelPattern: 'temp-sensor-1',
          method: 'zscore',
          threshold: 2.0,
          windowSize: 20
        }
      ]
    }
  })

  cyre.action({
    id: 'temp-sensor-2',
    payload: {value: 23.1, location: {x: 5, y: 0}}
  })

  cyre.action({
    id: 'temp-sensor-3',
    payload: {value: 22.8, location: {x: 10, y: 0}}
  })

  // Set up subscribers to see the fusion in action
  cyre.on('temp-sensor-1', data => {
    console.log('🌡️  Sensor 1 (with fusion):', data)
  })

  console.log('\n🔄 Simulating sensor readings...')

  // Simulate normal readings
  for (let i = 0; i < 5; i++) {
    await sleep(1000)

    const reading1 = 22 + Math.random() * 2
    const reading2 = 23 + Math.random() * 2
    const reading3 = 22.5 + Math.random() * 2

    await cyre.call('temp-sensor-1', {value: reading1, location: {x: 0, y: 0}})
    await cyre.call('temp-sensor-2', {value: reading2, location: {x: 5, y: 0}})
    await cyre.call('temp-sensor-3', {value: reading3, location: {x: 10, y: 0}})

    // Check fusion results
    const fusionResult = cyre.intelligence.getFusionResult('temp-sensor-1')
    if (fusionResult) {
      console.log(
        `📊 Fusion confidence: ${fusionResult.confidence.toFixed(
          2
        )}, Sources: ${fusionResult.sources.length}`
      )
    }
  }

  console.log('\n🚨 Simulating anomaly...')

  // Create an anomaly
  await cyre.call('temp-sensor-1', {value: 35.0, location: {x: 0, y: 0}}) // Spike!

  await sleep(1000)

  // Check pattern detection
  const patternState = getPatternState('temp-sensor-1')
  if (patternState) {
    console.log(
      `🎯 Anomaly detected: ${
        patternState.patternName
      }, Confidence: ${patternState.confidence.toFixed(2)}`
    )
  }

  console.log('\n🏢 Creating intelligent building network...')

  // Create a complete sensor network
  const network = cyre.intelligence.createSensorNetwork({
    id: 'smart-building',
    sensors: [
      {
        id: 'room-101-temp',
        location: {x: 0, y: 0},
        type: 'temperature',
        fusion: {spatial: true, temporal: true},
        patterns: {anomalies: true}
      },
      {
        id: 'room-102-temp',
        location: {x: 10, y: 0},
        type: 'temperature',
        fusion: {spatial: true},
        patterns: {anomalies: true}
      },
      {
        id: 'hall-motion',
        location: {x: 5, y: 5},
        type: 'motion',
        patterns: {sequences: true, frequency: true}
      }
    ],
    globalFusion: {
      method: 'kalman',
      distanceThreshold: 15
    },
    globalPatterns: {
      crossSensorSequences: true,
      networkAnomalies: true
    }
  })

  console.log(`✅ ${network.message}`)

  console.log('\n📈 Intelligence system statistics:')
  const stats = cyre.intelligence.getSystemStats()
  console.log(
    `- Intelligence ratio: ${(stats.overall.intelligenceRatio * 100).toFixed(
      1
    )}%`
  )
  console.log(`- Fusion channels: ${stats.fusion.totalChannels}`)
  console.log(`- Pattern channels: ${stats.patterns.totalChannels}`)
  console.log(
    `- Avg fusion confidence: ${(stats.fusion.avgConfidence * 100).toFixed(1)}%`
  )

  console.log('\n🎉 Demo completed successfully!')
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const calculateDistance = (
  a: {x: number; y: number; z?: number},
  b: {x: number; y: number; z?: number}
): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z || 0) - (b.z || 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

const extractLocation = (
  payload: any
): {x: number; y: number; z?: number} | null => {
  if (payload?.location) return payload.location
  if (payload?.position) return payload.position
  return null
}

const extractNumericValue = (payload: any): number | null => {
  if (typeof payload === 'number') return payload
  if (typeof payload === 'object' && payload?.value !== undefined) {
    return Number(payload.value)
  }
  return null
}

const matchesChannelPattern = (channelId: string, pattern: string): boolean => {
  const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'))
  return regex.test(channelId)
}

const simpleKalmanFilter = (values: number[]): number => {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]

  // Simplified Kalman filter implementation
  let estimate = values[0]
  let errorEstimate = 1.0

  for (let i = 1; i < values.length; i++) {
    const kalmanGain = errorEstimate / (errorEstimate + 0.1)
    estimate = estimate + kalmanGain * (values[i] - estimate)
    errorEstimate = (1 - kalmanGain) * errorEstimate
  }

  return estimate
}

// Anomaly baseline storage
const anomalyBaselines = new Map<
  string,
  {
    values: number[]
    mean: number
    stdDev: number
    median: number
    q1: number
    q3: number
    iqr: number
  }
>()

const getAnomalyBaseline = (channelId: string, anomalyName: string) => {
  const key = `${channelId}-${anomalyName}`

  if (!anomalyBaselines.has(key)) {
    anomalyBaselines.set(key, {
      values: [],
      mean: 0,
      stdDev: 0,
      median: 0,
      q1: 0,
      q3: 0,
      iqr: 0
    })
  }

  return anomalyBaselines.get(key)!
}

const setAnomalyBaseline = (
  channelId: string,
  anomalyName: string,
  baseline: any
) => {
  const key = `${channelId}-${anomalyName}`
  anomalyBaselines.set(key, baseline)
}

const updateAnomalyBaseline = (baseline: any): void => {
  const values = baseline.values
  if (values.length === 0) return

  // Calculate mean
  baseline.mean =
    values.reduce((sum: number, v: number) => sum + v, 0) / values.length

  // Calculate standard deviation
  const variance =
    values.reduce(
      (sum: number, v: number) => sum + Math.pow(v - baseline.mean, 2),
      0
    ) / values.length
  baseline.stdDev = Math.sqrt(variance)

  // Calculate quartiles
  const sorted = [...values].sort((a, b) => a - b)
  baseline.median = sorted[Math.floor(sorted.length / 2)]
  baseline.q1 = sorted[Math.floor(sorted.length * 0.25)]
  baseline.q3 = sorted[Math.floor(sorted.length * 0.75)]
  baseline.iqr = baseline.q3 - baseline.q1
}

// Export for running the demo
export default runFusionPatternDemo
