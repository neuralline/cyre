// src/intelligence/intelligence-compiler.ts
// Compile-time optimization for user-defined intelligence

import type {IO} from '../types/core'
import {payloadState} from '../context/payload-state'

/*

      C.Y.R.E - I.N.T.E.L.L.I.G.E.N.C.E - C.O.M.P.I.L.E.R
      
      Pre-compile intelligence for maximum performance:
      - Spatial fusion: Pre-compute sensor lookups
      - Anomaly detection: Pre-compile detection functions
      - Pattern matching: Pre-build state machines
      - Zero runtime reflection or dynamic analysis

*/

export interface CompiledIntelligence {
  // Spatial fusion config
  spatialSensors?: Map<
    string,
    {
      location: {x: number; y: number; z?: number}
      weight: number
      maxDistance: number
    }
  >
  fusionMethod?: (payload: any, sensors: Map<string, any>) => any

  // Anomaly detection config
  anomalyDetector?: {
    method: 'zscore' | 'iqr' | 'simple'
    threshold: number
    windowSize: number
    detector: (
      value: number,
      baseline: number[]
    ) => {anomalous: boolean; confidence: number}
  }

  // Pattern detection config
  sequenceTracker?: {
    patterns: Map<
      string,
      {
        conditions: Array<{channelPattern: string; condition: Function}>
        timeout: number
        state: Map<string, any>
      }
    >
  }
}

/**
 * Compile intelligence configuration for maximum runtime performance
 */
export const compileIntelligenceConfig = (
  action: IO
): CompiledIntelligence | null => {
  if (!action.fusion && !action.patterns) {
    return null
  }

  const config: CompiledIntelligence = {}

  // Compile spatial fusion
  if (action.fusion?.spatial) {
    config.spatialSensors = new Map(
      action.fusion.spatial.sensors.map(sensor => [
        sensor.id,
        {
          location: sensor.location,
          weight: sensor.weight || 1.0,
          maxDistance:
            sensor.maxDistance || action.fusion.spatial.distanceThreshold
        }
      ])
    )

    config.fusionMethod = compileSpatialMethod(action.fusion.spatial.method)
  }

  // Compile anomaly detection
  if (action.patterns?.anomalies?.[0]) {
    const anomaly = action.patterns.anomalies[0]
    config.anomalyDetector = {
      method: anomaly.method,
      threshold: anomaly.threshold,
      windowSize: anomaly.windowSize,
      detector: compileAnomalyDetector(anomaly.method, anomaly.threshold)
    }
  }

  // Compile sequence patterns
  if (action.patterns?.sequences) {
    config.sequenceTracker = {
      patterns: new Map(
        action.patterns.sequences.map(seq => [
          seq.name,
          {
            conditions: seq.conditions,
            timeout: seq.timeout,
            state: new Map()
          }
        ])
      )
    }
  }

  return config
}

/**
 * Compile spatial fusion method for zero-reflection runtime
 */
const compileSpatialMethod = (method: string) => {
  switch (method) {
    case 'weighted':
      return (payload: any, sensors: Map<string, any>) => {
        let totalWeight = 1.0
        let weightedSum = extractNumericValue(payload) || 0

        for (const [sensorId, sensorConfig] of sensors) {
          const sensorValue = payloadState.get(sensorId)
          if (sensorValue !== undefined) {
            const distance = calculateDistance(
              extractLocation(payload) || {x: 0, y: 0},
              sensorConfig.location
            )

            if (distance <= sensorConfig.maxDistance) {
              const value = extractNumericValue(sensorValue) || 0
              const weight = sensorConfig.weight / (distance + 1) // Inverse distance
              weightedSum += value * weight
              totalWeight += weight
            }
          }
        }

        const fusedValue = weightedSum / totalWeight
        return typeof payload === 'number'
          ? fusedValue
          : {
              ...payload,
              value: fusedValue,
              originalValue: extractNumericValue(payload)
            }
      }

    case 'kalman':
      return (payload: any, sensors: Map<string, any>) => {
        // Simplified Kalman filter for real-time performance
        const currentValue = extractNumericValue(payload) || 0
        const sensorValues: number[] = []

        for (const [sensorId] of sensors) {
          const sensorValue = payloadState.get(sensorId)
          if (sensorValue !== undefined) {
            const value = extractNumericValue(sensorValue)
            if (value !== null) sensorValues.push(value)
          }
        }

        if (sensorValues.length === 0) return payload

        // Simple Kalman: weighted average with process noise
        const sensorAvg =
          sensorValues.reduce((sum, v) => sum + v, 0) / sensorValues.length
        const kalmanGain = 0.7 // Fixed gain for performance
        const estimate = currentValue + kalmanGain * (sensorAvg - currentValue)

        return typeof payload === 'number'
          ? estimate
          : {...payload, value: estimate, confidence: 0.9}
      }

    case 'consensus':
      return (payload: any, sensors: Map<string, any>) => {
        const values = [extractNumericValue(payload) || 0]

        for (const [sensorId] of sensors) {
          const sensorValue = payloadState.get(sensorId)
          if (sensorValue !== undefined) {
            const value = extractNumericValue(sensorValue)
            if (value !== null) values.push(value)
          }
        }

        // Consensus: median of all values
        values.sort((a, b) => a - b)
        const median = values[Math.floor(values.length / 2)]

        return typeof payload === 'number'
          ? median
          : {...payload, value: median, consensus: true}
      }

    default:
      return (payload: any) => payload
  }
}

/**
 * Compile anomaly detector for specific method and threshold
 */
const compileAnomalyDetector = (method: string, threshold: number) => {
  switch (method) {
    case 'zscore':
      return (value: number, baseline: number[]) => {
        if (baseline.length < 3) return {anomalous: false, confidence: 0}

        const mean = baseline.reduce((sum, v) => sum + v, 0) / baseline.length
        const variance =
          baseline.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
          baseline.length
        const stdDev = Math.sqrt(variance)

        if (stdDev === 0) return {anomalous: false, confidence: 0}

        const zscore = Math.abs((value - mean) / stdDev)
        const anomalous = zscore > threshold
        const confidence = Math.min(zscore / threshold, 1)

        return {anomalous, confidence}
      }

    case 'iqr':
      return (value: number, baseline: number[]) => {
        if (baseline.length < 4) return {anomalous: false, confidence: 0}

        const sorted = [...baseline].sort((a, b) => a - b)
        const q1 = sorted[Math.floor(sorted.length * 0.25)]
        const q3 = sorted[Math.floor(sorted.length * 0.75)]
        const iqr = q3 - q1

        const lowerBound = q1 - threshold * iqr
        const upperBound = q3 + threshold * iqr
        const anomalous = value < lowerBound || value > upperBound

        return {anomalous, confidence: anomalous ? 1 : 0}
      }

    case 'simple':
      return (value: number, baseline: number[]) => {
        if (baseline.length < 2) return {anomalous: false, confidence: 0}

        const recent = baseline.slice(-5) // Last 5 values
        const avg = recent.reduce((sum, v) => sum + v, 0) / recent.length
        const deviation = Math.abs(value - avg) / avg
        const anomalous = deviation > threshold

        return {anomalous, confidence: anomalous ? deviation / threshold : 0}
      }

    default:
      return () => ({anomalous: false, confidence: 0})
  }
}

/**
 * Helper functions for performance
 */
const extractNumericValue = (payload: any): number | null => {
  if (typeof payload === 'number') return payload
  if (typeof payload === 'object' && payload?.value !== undefined) {
    const value = Number(payload.value)
    return isNaN(value) ? null : value
  }
  return null
}

const extractLocation = (
  payload: any
): {x: number; y: number; z?: number} | null => {
  if (payload?.location) return payload.location
  if (payload?.position) return payload.position
  if (payload?.coords) return payload.coords
  return null
}

const calculateDistance = (
  a: {x: number; y: number; z?: number},
  b: {x: number; y: number; z?: number}
): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z || 0) - (b.z || 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
