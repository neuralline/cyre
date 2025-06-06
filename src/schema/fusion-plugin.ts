import {metricsCore} from './../metrics/core'
// src/schema/fusion-plugin.ts
// Multi-Sensor Fusion and Pattern Recognition plugin with correct exports

import {sensor} from '../context/metrics-report'
import {io} from '../context/state'
import {
  getFusionResult,
  getPatternState,
  setFusionResult,
  setPatternState
} from '../intelligence/fusion-cache'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - F.U.S.I.O.N - P.L.U.G.I.N
      
      Data definition plugin for multi-sensor fusion and pattern recognition:
      - Validates fusion configuration
      - Validates pattern configuration  
      - Registers fusion and pattern data types
      - Integrates with talent compilation system

*/

export interface FusionConfig {
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
  temporal?: {
    sensors: string[]
    windowSize: number
    method: 'average' | 'median' | 'weighted' | 'kalman'
    weights?: number[]
  }
  crossDomain?: {
    sensors: Array<{
      id: string
      domain: string
      transform?: (value: any) => number
      weight: number
    }>
    correlationModel: 'linear' | 'neural' | 'custom'
  }
}

export interface PatternConfig {
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
  anomalies?: Array<{
    name: string
    channelPattern: string
    method: 'zscore' | 'iqr' | 'isolation' | 'custom'
    threshold: number
    windowSize: number
    customDetector?: (values: number[]) => boolean
  }>
  frequency?: Array<{
    name: string
    channelPattern: string
    expectedInterval: number
    tolerance: number
    minOccurrences: number
  }>
}

/**
 * Fusion data definition validator - CORRECTLY NAMED EXPORT
 */
export const fusionDataDefinition = (
  value: any
): {ok: boolean; data?: FusionConfig; error?: string; talentName?: string} => {
  log.critical('fusion definitions')
  if (value === undefined) {
    return {ok: true, data: undefined}
  }

  if (!value || typeof value !== 'object') {
    return {ok: false, error: 'Fusion must be an object'}
  }

  try {
    const fusion = value as Partial<FusionConfig>
    const errors: string[] = []

    // Validate spatial fusion
    if (fusion.spatial) {
      if (!Array.isArray(fusion.spatial.sensors)) {
        errors.push('Spatial fusion sensors must be an array')
      } else {
        fusion.spatial.sensors.forEach((sensor, index) => {
          if (!sensor.id || typeof sensor.id !== 'string') {
            errors.push(`Spatial sensor ${index}: id must be a string`)
          }
          if (
            !sensor.location ||
            typeof sensor.location.x !== 'number' ||
            typeof sensor.location.y !== 'number'
          ) {
            errors.push(
              `Spatial sensor ${index}: location must have x,y coordinates`
            )
          }
          if (
            sensor.weight !== undefined &&
            (typeof sensor.weight !== 'number' || sensor.weight <= 0)
          ) {
            errors.push(
              `Spatial sensor ${index}: weight must be a positive number`
            )
          }
        })
      }

      if (
        !['weighted', 'kalman', 'consensus'].includes(fusion.spatial.method)
      ) {
        errors.push('Spatial method must be: weighted, kalman, or consensus')
      }

      if (
        typeof fusion.spatial.distanceThreshold !== 'number' ||
        fusion.spatial.distanceThreshold <= 0
      ) {
        errors.push('Spatial distanceThreshold must be a positive number')
      }
    }

    // Validate temporal fusion
    if (fusion.temporal) {
      if (!Array.isArray(fusion.temporal.sensors)) {
        errors.push('Temporal fusion sensors must be an array of channel IDs')
      }

      if (
        typeof fusion.temporal.windowSize !== 'number' ||
        fusion.temporal.windowSize <= 0
      ) {
        errors.push('Temporal windowSize must be a positive number')
      }

      if (
        !['average', 'median', 'weighted', 'kalman'].includes(
          fusion.temporal.method
        )
      ) {
        errors.push(
          'Temporal method must be: average, median, weighted, or kalman'
        )
      }

      if (fusion.temporal.weights && !Array.isArray(fusion.temporal.weights)) {
        errors.push('Temporal weights must be an array of numbers')
      }
    }

    // Validate cross-domain fusion
    if (fusion.crossDomain) {
      if (!Array.isArray(fusion.crossDomain.sensors)) {
        errors.push('Cross-domain sensors must be an array')
      } else {
        fusion.crossDomain.sensors.forEach((sensor, index) => {
          if (!sensor.id || typeof sensor.id !== 'string') {
            errors.push(`Cross-domain sensor ${index}: id must be a string`)
          }
          if (!sensor.domain || typeof sensor.domain !== 'string') {
            errors.push(`Cross-domain sensor ${index}: domain must be a string`)
          }
          if (typeof sensor.weight !== 'number' || sensor.weight <= 0) {
            errors.push(
              `Cross-domain sensor ${index}: weight must be a positive number`
            )
          }
        })
      }

      if (
        !['linear', 'neural', 'custom'].includes(
          fusion.crossDomain.correlationModel
        )
      ) {
        errors.push(
          'Cross-domain correlationModel must be: linear, neural, or custom'
        )
      }
    }

    if (errors.length > 0) {
      return {ok: false, error: errors.join('; ')}
    }

    return {
      ok: true,
      data: fusion as FusionConfig,
      talentName: 'fusion'
    }
  } catch (error) {
    return {
      ok: false,
      error: `Fusion validation error: ${
        error instanceof Error ? error.message : String(error)
      }`
    }
  }
}

/**
 * Pattern data definition validator - CORRECTLY NAMED EXPORT
 */
export const patternDataDefinition = (
  value: any
): {ok: boolean; data?: PatternConfig; error?: string; talentName?: string} => {
  log.critical('pattern definitions')
  if (value === undefined) {
    return {ok: true, data: undefined}
  }

  if (!value || typeof value !== 'object') {
    return {ok: false, error: 'Patterns must be an object'}
  }

  try {
    const patterns = value as Partial<PatternConfig>
    const errors: string[] = []

    // Validate sequence patterns
    if (patterns.sequences) {
      if (!Array.isArray(patterns.sequences)) {
        errors.push('Sequences must be an array')
      } else {
        patterns.sequences.forEach((seq, index) => {
          if (!seq.name || typeof seq.name !== 'string') {
            errors.push(`Sequence ${index}: name must be a string`)
          }
          if (!Array.isArray(seq.conditions)) {
            errors.push(`Sequence ${index}: conditions must be an array`)
          } else {
            seq.conditions.forEach((cond, condIndex) => {
              if (
                !cond.channelPattern ||
                typeof cond.channelPattern !== 'string'
              ) {
                errors.push(
                  `Sequence ${index}, condition ${condIndex}: channelPattern must be a string`
                )
              }
              if (typeof cond.condition !== 'function') {
                errors.push(
                  `Sequence ${index}, condition ${condIndex}: condition must be a function`
                )
              }
            })
          }
          if (typeof seq.timeout !== 'number' || seq.timeout <= 0) {
            errors.push(`Sequence ${index}: timeout must be a positive number`)
          }
          if (typeof seq.allowOverlap !== 'boolean') {
            errors.push(`Sequence ${index}: allowOverlap must be a boolean`)
          }
        })
      }
    }

    // Validate anomaly patterns
    if (patterns.anomalies) {
      if (!Array.isArray(patterns.anomalies)) {
        errors.push('Anomalies must be an array')
      } else {
        patterns.anomalies.forEach((anomaly, index) => {
          if (!anomaly.name || typeof anomaly.name !== 'string') {
            errors.push(`Anomaly ${index}: name must be a string`)
          }
          if (
            !anomaly.channelPattern ||
            typeof anomaly.channelPattern !== 'string'
          ) {
            errors.push(`Anomaly ${index}: channelPattern must be a string`)
          }
          if (
            !['zscore', 'iqr', 'isolation', 'custom'].includes(anomaly.method)
          ) {
            errors.push(
              `Anomaly ${index}: method must be zscore, iqr, isolation, or custom`
            )
          }
          if (typeof anomaly.threshold !== 'number' || anomaly.threshold <= 0) {
            errors.push(`Anomaly ${index}: threshold must be a positive number`)
          }
          if (
            typeof anomaly.windowSize !== 'number' ||
            anomaly.windowSize <= 0
          ) {
            errors.push(
              `Anomaly ${index}: windowSize must be a positive number`
            )
          }
        })
      }
    }

    // Validate frequency patterns
    if (patterns.frequency) {
      if (!Array.isArray(patterns.frequency)) {
        errors.push('Frequency patterns must be an array')
      } else {
        patterns.frequency.forEach((freq, index) => {
          if (!freq.name || typeof freq.name !== 'string') {
            errors.push(`Frequency ${index}: name must be a string`)
          }
          if (!freq.channelPattern || typeof freq.channelPattern !== 'string') {
            errors.push(`Frequency ${index}: channelPattern must be a string`)
          }
          if (
            typeof freq.expectedInterval !== 'number' ||
            freq.expectedInterval <= 0
          ) {
            errors.push(
              `Frequency ${index}: expectedInterval must be a positive number`
            )
          }
          if (
            typeof freq.tolerance !== 'number' ||
            freq.tolerance < 0 ||
            freq.tolerance > 100
          ) {
            errors.push(`Frequency ${index}: tolerance must be between 0-100`)
          }
          if (
            typeof freq.minOccurrences !== 'number' ||
            freq.minOccurrences <= 0
          ) {
            errors.push(
              `Frequency ${index}: minOccurrences must be a positive number`
            )
          }
        })
      }
    }

    if (errors.length > 0) {
      return {ok: false, error: errors.join('; ')}
    }

    return {
      ok: true,
      data: patterns as PatternConfig,
      talentName: 'patterns'
    }
  } catch (error) {
    return {
      ok: false,
      error: `Pattern validation error: ${
        error instanceof Error ? error.message : String(error)
      }`
    }
  }
}

/**
 * Intelligence interface for accessing fusion and pattern results
 */
export const intelligence = {
  /**
   * Get fusion results for a channel
   */
  getFusionResult: (channelId: string) => {
    return getFusionResult(channelId)
  },

  /**
   * Get pattern detection history
   */
  getPatternHistory: (
    channelId: string,
    patternType?: 'sequence' | 'anomaly' | 'frequency'
  ) => {
    const events = metricsCore.getEvents({
      actionIds: [channelId],
      eventTypes: ['patterns-detected']
    })

    return events
      .filter(
        event => !patternType || event.metadata?.patternType === patternType
      )
      .map(event => ({
        timestamp: event.timestamp,
        patterns: event.metadata?.patterns || [],
        confidence: event.metadata?.confidence || 0
      }))
  },

  /**
   * Get current pattern state
   */
  getPatternState: (channelId: string) => {
    return getPatternState(channelId)
  },

  /**
   * Get fusion confidence for multiple channels
   */
  getFusionConfidence: (channelIds: string[]) => {
    return channelIds.map(id => {
      const fusion = getFusionResult(id)
      return {
        channelId: id,
        confidence: fusion?.confidence || 0,
        sources: fusion?.sources || [],
        method: fusion?.method || 'none',
        timestamp: fusion?.timestamp || 0
      }
    })
  },

  /**
   * Get intelligence system statistics
   */
  getSystemStats: () => {
    const allChannels = io.getAll()
    const fusionChannels = allChannels.filter(channel => channel.fusion)
    const patternChannels = allChannels.filter(channel => channel.patterns)

    const fusionStats = fusionChannels.map(channel => {
      const result = getFusionResult(channel.id)
      return {
        channelId: channel.id,
        confidence: result?.confidence || 0,
        sources: result?.sources?.length || 0,
        method: result?.method || 'none'
      }
    })

    const patternStats = patternChannels.map(channel => {
      const state = getPatternState(channel.id)
      return {
        channelId: channel.id,
        totalDetections: state?.totalDetections || 0,
        lastDetection: state?.lastDetection || 0,
        confidence: state?.confidence || 0
      }
    })

    return {
      fusion: {
        totalChannels: fusionChannels.length,
        avgConfidence:
          fusionStats.length > 0
            ? fusionStats.reduce((sum, s) => sum + s.confidence, 0) /
              fusionStats.length
            : 0,
        channels: fusionStats
      },
      patterns: {
        totalChannels: patternChannels.length,
        totalDetections: patternStats.reduce(
          (sum, s) => sum + s.totalDetections,
          0
        ),
        avgConfidence:
          patternStats.length > 0
            ? patternStats.reduce((sum, s) => sum + s.confidence, 0) /
              patternStats.length
            : 0,
        channels: patternStats
      },
      overall: {
        intelligentChannels: fusionChannels.length + patternChannels.length,
        totalChannels: allChannels.length,
        intelligenceRatio:
          allChannels.length > 0
            ? (fusionChannels.length + patternChannels.length) /
              allChannels.length
            : 0
      }
    }
  },

  /**
   * Create intelligent sensor network
   */
  createSensorNetwork: (networkConfig: {
    id: string
    sensors: Array<{
      id: string
      location: {x: number; y: number; z?: number}
      type: string
      fusion?: {spatial?: boolean; temporal?: boolean}
      patterns?: {anomalies?: boolean; sequences?: boolean}
    }>
    globalFusion?: {method: string; distanceThreshold: number}
    globalPatterns?: {
      crossSensorSequences?: boolean
      networkAnomalies?: boolean
    }
  }) => {
    try {
      // Import cyre here to avoid circular dependency
      const {cyre} = require('../app')

      // Create individual sensor channels
      networkConfig.sensors.forEach(sensor => {
        const sensorConfig: any = {
          id: sensor.id,
          payload: {location: sensor.location, type: sensor.type}
        }

        // Add fusion configuration
        if (sensor.fusion && networkConfig.globalFusion) {
          sensorConfig.fusion = {}

          if (sensor.fusion.spatial) {
            const nearbySensors = networkConfig.sensors
              .filter(s => s.id !== sensor.id)
              .filter(s => {
                const distance = Math.sqrt(
                  Math.pow(sensor.location.x - s.location.x, 2) +
                    Math.pow(sensor.location.y - s.location.y, 2)
                )
                return distance <= networkConfig.globalFusion!.distanceThreshold
              })
              .map(s => ({
                id: s.id,
                location: s.location,
                weight: 1.0
              }))

            if (nearbySensors.length > 0) {
              sensorConfig.fusion.spatial = {
                sensors: nearbySensors,
                method: networkConfig.globalFusion.method,
                distanceThreshold: networkConfig.globalFusion.distanceThreshold
              }
            }
          }

          if (sensor.fusion.temporal) {
            sensorConfig.fusion.temporal = {
              sensors: [sensor.id],
              windowSize: 60000, // 1 minute
              method: 'kalman'
            }
          }
        }

        // Add pattern configuration
        if (sensor.patterns) {
          sensorConfig.patterns = {}

          if (sensor.patterns.anomalies) {
            sensorConfig.patterns.anomalies = [
              {
                name: `${sensor.id}-anomaly`,
                channelPattern: sensor.id,
                method: 'zscore',
                threshold: 2.0,
                windowSize: 20
              }
            ]
          }

          if (sensor.patterns.sequences) {
            sensorConfig.patterns.sequences = [
              {
                name: `${sensor.id}-sequence`,
                conditions: [
                  {
                    channelPattern: sensor.id,
                    condition: (payload: any) => payload?.value > 0,
                    timeout: 5000
                  }
                ],
                timeout: 10000,
                allowOverlap: false
              }
            ]
          }
        }

        cyre.action(sensorConfig)
      })

      sensor.log(networkConfig.id, 'success', 'sensor-network-created', {
        sensorCount: networkConfig.sensors.length,
        hasFusion: !!networkConfig.globalFusion,
        hasGlobalPatterns: !!networkConfig.globalPatterns
      })

      return {
        ok: true,
        message: `Sensor network '${networkConfig.id}' created with ${networkConfig.sensors.length} sensors`,
        network: {
          id: networkConfig.id,
          sensors: networkConfig.sensors.map(s => s.id)
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      return {
        ok: false,
        message: `Failed to create sensor network: ${errorMessage}`,
        network: null
      }
    }
  }
}
