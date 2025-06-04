// src/intelligence/optimized-talents.ts
// High-performance intelligence talents for user-defined channels

import type {IO} from '../types/core'
import type {TalentResult} from '../schema/talent-definitions'
import type {CompiledIntelligence} from './intelligence-compiler'
import {sensor} from '../context/metrics-report'
import {setFusionResult, setPatternState} from './fusion-cache'

/*

      C.Y.R.E - O.P.T.I.M.I.Z.E.D - I.N.T.E.L.L.I.G.E.N.C.E
      
      Lightning-fast intelligence execution using pre-compiled configs:
      - Zero reflection or dynamic analysis
      - Minimal memory allocations
      - Direct function calls
      - Breathing-aware processing

*/

// Anomaly baseline storage per channel
const anomalyBaselines = new Map<string, number[]>()

/**
 * Optimized fusion talent - uses pre-compiled configuration
 */
export const optimizedFusion = (action: IO, payload: any): TalentResult => {
  const config = action._intelligenceConfig as CompiledIntelligence
  if (!config?.fusionMethod) {
    return {ok: true, payload}
  }

  try {
    const startTime = performance.now()

    // Fast path: use pre-compiled fusion method
    const fusedPayload = config.fusionMethod(payload, config.spatialSensors!)
    const executionTime = performance.now() - startTime

    // Cache result for external access
    setFusionResult(action.id, {
      result: fusedPayload,
      confidence: 0.85, // Could be calculated by fusion method
      sources: [action.id, ...Array.from(config.spatialSensors!.keys())],
      timestamp: Date.now(),
      method: 'compiled'
    })

    // Only log if execution is slow (breathing-aware)
    if (executionTime > 5) {
      sensor.log(action.id, 'info', 'fusion-slow-execution', {executionTime})
    }

    return {
      ok: true,
      payload: fusedPayload,
      message: `Fusion applied (${executionTime.toFixed(2)}ms)`
    }
  } catch (error) {
    sensor.error(action.id, String(error), 'fusion-execution')
    return {
      ok: false,
      error: true,
      payload,
      message: `Fusion failed: ${error}`
    }
  }
}

/**
 * Optimized pattern detection - uses pre-compiled detectors
 */
export const optimizedPatterns = (action: IO, payload: any): TalentResult => {
  const config = action._intelligenceConfig as CompiledIntelligence
  if (!config?.anomalyDetector && !config?.sequenceTracker) {
    return {ok: true, payload}
  }

  try {
    const startTime = performance.now()
    const detectedPatterns: Array<{name: string; confidence: number}> = []

    // Fast anomaly detection
    if (config.anomalyDetector) {
      const anomaly = detectAnomalyOptimized(
        action.id,
        payload,
        config.anomalyDetector
      )
      if (anomaly.detected) {
        detectedPatterns.push({
          name: `${action.id}-anomaly`,
          confidence: anomaly.confidence
        })

        // Update pattern state
        setPatternState(action.id, {
          channelId: action.id,
          patternName: 'anomaly',
          lastDetection: Date.now(),
          totalDetections: (getExistingPatternCount(action.id) || 0) + 1,
          confidence: anomaly.confidence,
          metadata: {type: 'anomaly', method: config.anomalyDetector.method}
        })
      }
    }

    // Fast sequence tracking
    if (config.sequenceTracker) {
      const sequences = trackSequencesOptimized(
        action.id,
        payload,
        config.sequenceTracker
      )
      detectedPatterns.push(...sequences)
    }

    const executionTime = performance.now() - startTime

    // Only log if patterns detected or execution is slow
    if (detectedPatterns.length > 0 || executionTime > 3) {
      sensor.log(action.id, 'info', 'pattern-detection', {
        patternsDetected: detectedPatterns.length,
        executionTime
      })
    }

    return {
      ok: true,
      payload,
      message:
        detectedPatterns.length > 0
          ? `${detectedPatterns.length} patterns detected`
          : 'No patterns detected'
    }
  } catch (error) {
    sensor.error(action.id, String(error), 'pattern-detection')
    return {
      ok: false,
      error: true,
      payload,
      message: `Pattern detection failed: ${error}`
    }
  }
}

/**
 * Ultra-fast anomaly detection using pre-compiled detector
 */
const detectAnomalyOptimized = (
  channelId: string,
  payload: any,
  config: CompiledIntelligence['anomalyDetector']
): {detected: boolean; confidence: number} => {
  const value = extractNumericValue(payload)
  if (value === null || !config) {
    return {detected: false, confidence: 0}
  }

  // Get or create baseline
  let baseline = anomalyBaselines.get(channelId)
  if (!baseline) {
    baseline = []
    anomalyBaselines.set(channelId, baseline)
  }

  // Add current value and maintain window size
  baseline.push(value)
  if (baseline.length > config.windowSize) {
    baseline.shift() // Remove oldest value
  }

  // Skip detection if not enough data
  if (baseline.length < Math.min(5, config.windowSize)) {
    return {detected: false, confidence: 0}
  }

  // Use pre-compiled detector function
  const result = config.detector(value, baseline.slice(0, -1)) // Exclude current value from baseline

  return {
    detected: result.anomalous,
    confidence: result.confidence
  }
}

/**
 * Fast sequence tracking using state machines
 */
const trackSequencesOptimized = (
  channelId: string,
  payload: any,
  config: CompiledIntelligence['sequenceTracker']
): Array<{name: string; confidence: number}> => {
  const detectedSequences: Array<{name: string; confidence: number}> = []

  if (!config) return detectedSequences

  const now = Date.now()

  for (const [patternName, pattern] of config.patterns) {
    // Check if current channel matches any condition in this pattern
    const matchingCondition = pattern.conditions.find(condition =>
      matchesChannelPattern(channelId, condition.channelPattern)
    )

    if (matchingCondition) {
      try {
        // Check condition
        const conditionMet = matchingCondition.condition(payload)

        if (conditionMet) {
          // Update sequence state
          const sequenceState = pattern.state.get(patternName) || {
            steps: [],
            startTime: now,
            lastStep: now
          }

          sequenceState.steps.push({
            channelId,
            timestamp: now,
            condition: matchingCondition.channelPattern
          })
          sequenceState.lastStep = now

          // Check if sequence is complete
          if (sequenceState.steps.length >= pattern.conditions.length) {
            detectedSequences.push({
              name: patternName,
              confidence: 0.9
            })

            // Reset sequence state
            pattern.state.delete(patternName)
          } else if (now - sequenceState.startTime > pattern.timeout) {
            // Sequence timed out
            pattern.state.delete(patternName)
          } else {
            // Update state
            pattern.state.set(patternName, sequenceState)
          }
        }
      } catch (error) {
        // Ignore condition errors - don't break the sequence tracking
      }
    }
  }

  return detectedSequences
}

/**
 * Performance helpers
 */
const extractNumericValue = (payload: any): number | null => {
  if (typeof payload === 'number') return payload
  if (typeof payload === 'object' && payload?.value !== undefined) {
    const value = Number(payload.value)
    return isNaN(value) ? null : value
  }
  return null
}

const matchesChannelPattern = (channelId: string, pattern: string): boolean => {
  if (pattern === channelId) return true
  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  )
  return regex.test(channelId)
}

const getExistingPatternCount = (channelId: string): number => {
  // This would get count from pattern state cache
  return 0 // Placeholder
}

/**
 * Breathing-aware intelligence processing
 */
export const shouldProcessIntelligence = (breathing: any): boolean => {
  return breathing.stress < 0.8 // Only process when system is healthy
}
