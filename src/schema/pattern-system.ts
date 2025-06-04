// src/intelligence/fusion-pattern-system.ts
// Multi-Sensor Fusion and Event Pattern Recognition for Cyre ecosystem

import type {
  ActionPayload,
  IO,
  FusionContext,
  PatternResult
} from '../types/core'
import {sensor} from '../context/metrics-report'
import {payloadState} from '../context/payload-state'
import {query} from '../query/cyre-query'
import {createStore} from '../context/create-store'

/*

      C.Y.R.E - I.N.T.E.L.L.I.G.E.N.C.E - S.Y.S.T.E.M
      
      Multi-Sensor Fusion and Event Pattern Recognition:
      - Combines data from multiple channels for enhanced accuracy
      - Detects complex patterns and sequences across time
      - Integrates with existing action pipeline as talents
      - Works seamlessly with branches, groups, and orchestration

*/

// ========================================
// MULTI-SENSOR FUSION SYSTEM
// ========================================

interface SensorData {
  channelId: string
  value: any
  timestamp: number
  location?: {x: number; y: number; z?: number}
  reliability: number // 0-1 confidence score
  metadata?: Record<string, any>
}

interface FusionConfiguration {
  /** Spatial fusion - combine nearby sensors */
  spatial?: {
    sensors: Array<{
      id: string
      location: {x: number; y: number; z?: number}
      weight?: number
      maxDistance?: number
    }>
    method: 'weighted' | 'kalman' | 'consensus'
    distanceThreshold: number
  }
  /** Temporal fusion - combine data over time */
  temporal?: {
    sensors: string[]
    windowSize: number // milliseconds
    method: 'average' | 'median' | 'weighted' | 'kalman'
    weights?: number[]
  }
  /** Cross-domain fusion - combine different sensor types */
  crossDomain?: {
    sensors: Array<{
      id: string
      domain: string // 'temperature', 'humidity', 'motion', etc.
      transform?: (value: any) => number
      weight: number
    }>
    correlationModel: 'linear' | 'neural' | 'custom'
  }
}

// Fusion result storage
const fusionResults = createStore<{
  result: any
  confidence: number
  sources: string[]
  timestamp: number
  method: string
}>()

// Sensor data cache for fusion calculations
const sensorDataCache = createStore<SensorData[]>()

/**
 * Spatial Fusion: Combine data from nearby sensors
 */
const spatialFusion = (
  config: FusionConfiguration['spatial'],
  targetLocation: {x: number; y: number; z?: number}
): {value: any; confidence: number; sources: string[]} => {
  if (!config) throw new Error('Spatial config required')

  // Get recent data from nearby sensors
  const nearbySensors = config.sensors.filter(sensor => {
    const distance = calculateDistance(targetLocation, sensor.location)
    return distance <= (sensor.maxDistance || config.distanceThreshold)
  })

  if (nearbySensors.length === 0) {
    return {value: null, confidence: 0, sources: []}
  }

  const sensorValues = nearbySensors
    .map(sensor => {
      const data = payloadState.get(sensor.id)
      const distance = calculateDistance(targetLocation, sensor.location)

      return {
        id: sensor.id,
        value: data,
        weight: sensor.weight || 1 / (distance + 1), // Inverse distance weighting
        distance
      }
    })
    .filter(s => s.value !== undefined)

  switch (config.method) {
    case 'weighted':
      return weightedFusion(sensorValues)
    case 'kalman':
      return kalmanFusion(sensorValues)
    case 'consensus':
      return consensusFusion(sensorValues)
    default:
      return weightedFusion(sensorValues)
  }
}

/**
 * Temporal Fusion: Combine sensor data over time window
 */
const temporalFusion = (
  config: FusionConfiguration['temporal'],
  channelId: string
): {
  value: any
  confidence: number
  trend: 'increasing' | 'decreasing' | 'stable'
} => {
  if (!config) throw new Error('Temporal config required')

  // Get historical data for sensors within time window
  const now = Date.now()
  const windowStart = now - config.windowSize

  const historicalData = config.sensors
    .map(sensorId => {
      const history = payloadState.getHistory(sensorId, 50) // Get recent history
      const windowData = history.filter(
        entry => entry.timestamp >= windowStart && entry.timestamp <= now
      )

      return {sensorId, data: windowData}
    })
    .filter(s => s.data.length > 0)

  if (historicalData.length === 0) {
    return {value: null, confidence: 0, trend: 'stable'}
  }

  switch (config.method) {
    case 'average':
      return temporalAverage(historicalData)
    case 'median':
      return temporalMedian(historicalData)
    case 'weighted':
      return temporalWeighted(historicalData, config.weights)
    case 'kalman':
      return temporalKalman(historicalData)
    default:
      return temporalAverage(historicalData)
  }
}

/**
 * Cross-Domain Fusion: Combine different types of sensors
 */
const crossDomainFusion = (
  config: FusionConfiguration['crossDomain']
): {value: any; confidence: number; correlations: Record<string, number>} => {
  if (!config) throw new Error('Cross-domain config required')

  // Get current values from all sensors
  const sensorValues = config.sensors
    .map(sensor => {
      const rawValue = payloadState.get(sensor.id)
      const transformedValue = sensor.transform
        ? sensor.transform(rawValue)
        : rawValue

      return {
        id: sensor.id,
        domain: sensor.domain,
        value: transformedValue,
        weight: sensor.weight
      }
    })
    .filter(s => s.value !== undefined && typeof s.value === 'number')

  if (sensorValues.length < 2) {
    return {value: null, confidence: 0, correlations: {}}
  }

  switch (config.correlationModel) {
    case 'linear':
      return linearCorrelationFusion(sensorValues)
    case 'neural':
      return neuralCorrelationFusion(sensorValues)
    case 'custom':
      return customCorrelationFusion(sensorValues)
    default:
      return linearCorrelationFusion(sensorValues)
  }
}

// ========================================
// EVENT PATTERN RECOGNITION SYSTEM
// ========================================

export interface PatternConfiguration {
  /** Sequence patterns - detect ordered events */
  sequences?: Array<{
    name: string
    conditions: Array<{
      channelPattern: string
      condition: (payload: any) => boolean
      timeout?: number
    }>
    timeout: number
    allowOverlap: boolean
  }>
  /** Anomaly detection patterns */
  anomalies?: Array<{
    name: string
    channelPattern: string
    method: 'zscore' | 'iqr' | 'isolation' | 'custom'
    threshold: number
    windowSize: number
    customDetector?: (values: number[]) => boolean
  }>
  /** Frequency patterns - detect recurring events */
  frequency?: Array<{
    name: string
    channelPattern: string
    expectedInterval: number
    tolerance: number
    minOccurrences: number
  }>
}

// Pattern state tracking
const patternStates = createStore<{
  sequenceStates: Map<string, SequenceState>
  anomalyBaselines: Map<string, AnomalyBaseline>
  frequencyTrackers: Map<string, FrequencyTracker>
}>()

interface SequenceState {
  patternName: string
  currentStep: number
  startTime: number
  matchedEvents: Array<{channelId: string; timestamp: number; payload: any}>
  timeout?: NodeJS.Timeout
}

interface AnomalyBaseline {
  values: number[]
  mean: number
  stdDev: number
  median: number
  q1: number
  q3: number
  iqr: number
  lastUpdate: number
}

interface FrequencyTracker {
  events: Array<{timestamp: number; channelId: string}>
  intervals: number[]
  avgInterval: number
  lastEvent: number
}

/**
 * Sequence Pattern Detection
 */
const detectSequencePatterns = (
  channelId: string,
  payload: any,
  config: PatternConfiguration['sequences']
): PatternResult[] => {
  if (!config) return []

  const results: PatternResult[] = []
  const now = Date.now()

  config.forEach(pattern => {
    const stateKey = `seq-${pattern.name}`
    let state = getPatternState(stateKey) as SequenceState

    // Check if this event matches the current step
    const currentCondition = pattern.conditions[state?.currentStep || 0]
    const channelMatches = matchesChannelPattern(
      channelId,
      currentCondition.channelPattern
    )
    const conditionMet = channelMatches && currentCondition.condition(payload)

    if (conditionMet) {
      if (!state) {
        // Start new sequence
        state = {
          patternName: pattern.name,
          currentStep: 0,
          startTime: now,
          matchedEvents: [],
          timeout: undefined
        }
      }

      // Add matched event
      state.matchedEvents.push({channelId, timestamp: now, payload})
      state.currentStep++

      // Check if sequence is complete
      if (state.currentStep >= pattern.conditions.length) {
        results.push({
          detected: true,
          patterns: [
            {
              name: pattern.name,
              confidence: 1.0
            }
          ]
        })

        // Reset for next detection
        clearPatternState(stateKey)
        state = undefined
      } else {
        // Set timeout for next step
        if (currentCondition.timeout) {
          if (state.timeout) clearTimeout(state.timeout)

          state.timeout = setTimeout(() => {
            clearPatternState(stateKey)
          }, currentCondition.timeout)
        }

        setPatternState(stateKey, state)
      }
    } else if (state && !pattern.allowOverlap) {
      // Reset sequence if condition not met and overlap not allowed
      clearPatternState(stateKey)
    }
  })

  return results
}

/**
 * Anomaly Detection
 */
const detectAnomalies = (
  channelId: string,
  payload: any,
  config: PatternConfiguration['anomalies']
): PatternResult[] => {
  if (!config) return []

  const results: PatternResult[] = []

  config.forEach(anomaly => {
    if (!matchesChannelPattern(channelId, anomaly.channelPattern)) return

    const value = extractNumericValue(payload)
    if (value === null) return

    const baselineKey = `anomaly-${anomaly.name}-${channelId}`
    let baseline = getPatternState(baselineKey) as AnomalyBaseline

    if (!baseline) {
      baseline = {
        values: [],
        mean: 0,
        stdDev: 0,
        median: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        lastUpdate: Date.now()
      }
    }

    // Update baseline with new value
    baseline.values.push(value)
    if (baseline.values.length > anomaly.windowSize) {
      baseline.values.shift()
    }

    // Recalculate statistics
    updateAnomalyBaseline(baseline)
    setPatternState(baselineKey, baseline)

    // Detect anomaly
    let isAnomaly = false
    let confidence = 0

    switch (anomaly.method) {
      case 'zscore':
        const zscore = Math.abs((value - baseline.mean) / baseline.stdDev)
        isAnomaly = zscore > anomaly.threshold
        confidence = Math.min(zscore / anomaly.threshold, 1)
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
    }
  })

  return results
}

/**
 * Frequency Pattern Detection
 */
const detectFrequencyPatterns = (
  channelId: string,
  payload: any,
  config: PatternConfiguration['frequency']
): PatternResult[] => {
  if (!config) return []

  const results: PatternResult[] = []
  const now = Date.now()

  config.forEach(pattern => {
    if (!matchesChannelPattern(channelId, pattern.channelPattern)) return

    const trackerKey = `freq-${pattern.name}-${channelId}`
    let tracker = getPatternState(trackerKey) as FrequencyTracker

    if (!tracker) {
      tracker = {
        events: [],
        intervals: [],
        avgInterval: 0,
        lastEvent: 0
      }
    }

    // Add new event
    tracker.events.push({timestamp: now, channelId})

    // Calculate interval if we have previous event
    if (tracker.lastEvent > 0) {
      const interval = now - tracker.lastEvent
      tracker.intervals.push(interval)

      // Keep only recent intervals
      if (tracker.intervals.length > pattern.minOccurrences * 2) {
        tracker.intervals.shift()
      }

      // Update average
      tracker.avgInterval =
        tracker.intervals.reduce((sum, i) => sum + i, 0) /
        tracker.intervals.length
    }

    tracker.lastEvent = now
    setPatternState(trackerKey, tracker)

    // Check if pattern is detected
    if (tracker.intervals.length >= pattern.minOccurrences) {
      const deviation = Math.abs(tracker.avgInterval - pattern.expectedInterval)
      const tolerance = pattern.expectedInterval * (pattern.tolerance / 100)

      if (deviation <= tolerance) {
        const confidence = 1 - deviation / tolerance

        results.push({
          detected: true,
          patterns: [
            {
              name: `${pattern.name}-frequency`,
              confidence
            }
          ]
        })
      }
    }
  })

  return results
}

// ========================================
// INTEGRATION WITH CYRE PIPELINE
// ========================================

/**
 * Fusion talent for action pipeline
 */
export const fusionTalent = (
  action: IO,
  payload: any
): {ok: boolean; payload: any; message: string} => {
  if (!action.fusion) {
    return {ok: true, payload, message: 'No fusion config'}
  }

  try {
    let fusedResult = payload
    let confidence = 1.0
    const sources: string[] = [action.id]

    // Apply spatial fusion
    if (action.fusion.spatial) {
      const location = extractLocation(payload) || {x: 0, y: 0}
      const spatial = spatialFusion(action.fusion.spatial, location)

      if (spatial.confidence > confidence * 0.8) {
        fusedResult = combineValues(fusedResult, spatial.value)
        confidence = spatial.confidence
        sources.push(...spatial.sources)
      }
    }

    // Apply temporal fusion
    if (action.fusion.temporal) {
      const temporal = temporalFusion(action.fusion.temporal, action.id)

      if (temporal.confidence > 0.5) {
        fusedResult = combineValues(fusedResult, temporal.value)
        confidence = Math.min(confidence, temporal.confidence)
      }
    }

    // Store fusion result
    fusionResults.set(action.id, {
      result: fusedResult,
      confidence,
      sources,
      timestamp: Date.now(),
      method: 'multi-sensor-fusion'
    })

    sensor.log(action.id, 'success', 'fusion-applied', {
      confidence,
      sources: sources.length,
      fusionTypes: Object.keys(action.fusion)
    })

    return {
      ok: true,
      payload: fusedResult,
      message: `Fusion applied (confidence: ${confidence.toFixed(2)})`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(action.id, errorMessage, 'fusion-talent')

    return {
      ok: false,
      payload,
      message: `Fusion failed: ${errorMessage}`
    }
  }
}

/**
 * Pattern recognition talent for action pipeline
 */
export const patternTalent = (
  action: IO,
  payload: any
): {ok: boolean; payload: any; message: string; patterns?: PatternResult} => {
  if (!action.patterns) {
    return {ok: true, payload, message: 'No pattern config'}
  }

  try {
    const detectedPatterns: PatternResult[] = []

    // Detect sequence patterns
    const sequences = detectSequencePatterns(
      action.id,
      payload,
      action.patterns.sequences
    )
    detectedPatterns.push(...sequences)

    // Detect anomalies
    const anomalies = detectAnomalies(
      action.id,
      payload,
      action.patterns.anomalies
    )
    detectedPatterns.push(...anomalies)

    // Detect frequency patterns
    const frequencies = detectFrequencyPatterns(
      action.id,
      payload,
      action.patterns.frequency
    )
    detectedPatterns.push(...frequencies)

    const totalDetected = detectedPatterns.reduce(
      (sum, result) => sum + result.patterns.length,
      0
    )

    if (totalDetected > 0) {
      sensor.log(action.id, 'success', 'patterns-detected', {
        totalPatterns: totalDetected,
        sequences: sequences.length,
        anomalies: anomalies.length,
        frequencies: frequencies.length
      })
    }

    return {
      ok: true,
      payload,
      message: `Pattern detection: ${totalDetected} patterns found`,
      patterns: {
        detected: totalDetected > 0,
        patterns: detectedPatterns.flatMap(r => r.patterns)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(action.id, errorMessage, 'pattern-talent')

    return {
      ok: false,
      payload,
      message: `Pattern detection failed: ${errorMessage}`
    }
  }
}

// Helper functions (implementations would be more detailed)
const calculateDistance = (
  a: {x: number; y: number; z?: number},
  b: {x: number; y: number; z?: number}
): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z || 0) - (b.z || 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

const weightedFusion = (values: any[]) => ({
  value: null,
  confidence: 0,
  sources: []
})
const kalmanFusion = (values: any[]) => ({
  value: null,
  confidence: 0,
  sources: []
})
const consensusFusion = (values: any[]) => ({
  value: null,
  confidence: 0,
  sources: []
})
const temporalAverage = (data: any[]) => ({
  value: null,
  confidence: 0,
  trend: 'stable' as const
})
const temporalMedian = (data: any[]) => ({
  value: null,
  confidence: 0,
  trend: 'stable' as const
})
const temporalWeighted = (data: any[], weights?: number[]) => ({
  value: null,
  confidence: 0,
  trend: 'stable' as const
})
const temporalKalman = (data: any[]) => ({
  value: null,
  confidence: 0,
  trend: 'stable' as const
})
const linearCorrelationFusion = (values: any[]) => ({
  value: null,
  confidence: 0,
  correlations: {}
})
const neuralCorrelationFusion = (values: any[]) => ({
  value: null,
  confidence: 0,
  correlations: {}
})
const customCorrelationFusion = (values: any[]) => ({
  value: null,
  confidence: 0,
  correlations: {}
})

const matchesChannelPattern = (channelId: string, pattern: string): boolean => {
  return new RegExp(pattern.replace(/\*/g, '.*')).test(channelId)
}

const extractNumericValue = (payload: any): number | null => {
  if (typeof payload === 'number') return payload
  if (typeof payload === 'object' && payload.value !== undefined)
    return Number(payload.value)
  return null
}

const extractLocation = (
  payload: any
): {x: number; y: number; z?: number} | null => {
  if (payload.location) return payload.location
  if (payload.position) return payload.position
  return null
}

const combineValues = (a: any, b: any): any => {
  if (typeof a === 'number' && typeof b === 'number') return (a + b) / 2
  return b || a
}

const getPatternState = (key: string): any => {
  // Implementation would get from pattern state store
  return null
}

const setPatternState = (key: string, state: any): void => {
  // Implementation would set in pattern state store
}

const clearPatternState = (key: string): void => {
  // Implementation would clear from pattern state store
}

const updateAnomalyBaseline = (baseline: AnomalyBaseline): void => {
  const values = baseline.values
  baseline.mean = values.reduce((sum, v) => sum + v, 0) / values.length
  baseline.stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - baseline.mean, 2), 0) /
      values.length
  )

  const sorted = [...values].sort((a, b) => a - b)
  baseline.median = sorted[Math.floor(sorted.length / 2)]
  baseline.q1 = sorted[Math.floor(sorted.length * 0.25)]
  baseline.q3 = sorted[Math.floor(sorted.length * 0.75)]
  baseline.iqr = baseline.q3 - baseline.q1
  baseline.lastUpdate = Date.now()
}
