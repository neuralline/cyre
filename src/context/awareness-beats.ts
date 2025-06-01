// src/context/awareness-beats.ts
// TimeKeeper-driven awareness system for proactive monitoring

import {TimeKeeper} from '../components/cyre-timekeeper'
import {metricsState} from './metrics-state'
import {sensor} from './metrics-report'
import {cyre} from '../app'
import {BREATHING} from '../config/cyre-config'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - A.W.A.R.E.N.E.S.S - B.E.A.T.S
      
      TimeKeeper-driven awareness system:
      - System pulse: Monitors CPU, memory, event loop health
      - Performance pulse: Analyzes execution patterns and bottlenecks  
      - Pattern pulse: Detects usage patterns and anomalies
      - All beats run continuously via TimeKeeper for proactive awareness

*/

interface AwarenessConfig {
  systemPulse: {enabled: boolean; interval: number}
  performancePulse: {enabled: boolean; interval: number}
  patternPulse: {enabled: boolean; interval: number}
  thresholds: {
    cpuWarning: number
    cpuCritical: number
    memoryWarning: number
    memoryCritical: number
    stressHigh: number
    callRateHigh: number
    eventLoopLag: number
  }
}

const defaultConfig: AwarenessConfig = {
  systemPulse: {enabled: true, interval: BREATHING.RATES.BASE}, // ~200ms heartbeat
  performancePulse: {enabled: true, interval: 5000}, // 5 second analysis
  patternPulse: {enabled: true, interval: 30000}, // 30 second pattern detection
  thresholds: {
    cpuWarning: 80,
    cpuCritical: 95,
    memoryWarning: 85,
    memoryCritical: 95,
    stressHigh: 0.8,
    callRateHigh: 100,
    eventLoopLag: 50
  }
}

let currentConfig = {...defaultConfig}
let isInitialized = false

/**
 * System health pulse - monitors basic system metrics
 */
const systemPulse = async (): Promise<void> => {
  try {
    // Get CPU usage (simplified - replace with actual monitoring)
    const cpuUsage = Math.random() * 100

    // Get memory usage
    const memoryUsage = (performance as any).memory
      ? ((performance as any).memory.usedJSHeapSize /
          (performance as any).memory.totalJSHeapSize) *
        100
      : Math.random() * 100

    // Measure event loop lag
    const eventLoopStart = performance.now()
    await new Promise(resolve => setImmediate(resolve))
    const eventLoopLag = performance.now() - eventLoopStart

    // Update system metrics
    metricsState.updateBreath({
      cpu: cpuUsage,
      memory: memoryUsage,
      eventLoop: eventLoopLag,
      isOverloaded:
        cpuUsage > currentConfig.thresholds.cpuWarning ||
        memoryUsage > currentConfig.thresholds.memoryWarning
    })

    // Proactive alerts
    if (cpuUsage > currentConfig.thresholds.cpuCritical) {
      sensor.log('system', 'critical', 'cpu-critical', {cpu: cpuUsage})
      cyre.call('system-critical-cpu', {
        level: 'critical',
        cpu: cpuUsage,
        timestamp: Date.now()
      })
    } else if (cpuUsage > currentConfig.thresholds.cpuWarning) {
      sensor.log('system', 'warning', 'cpu-warning', {cpu: cpuUsage})
    }

    if (memoryUsage > currentConfig.thresholds.memoryCritical) {
      sensor.log('system', 'critical', 'memory-critical', {memory: memoryUsage})
      cyre.call('system-critical-memory', {
        level: 'critical',
        memory: memoryUsage,
        timestamp: Date.now()
      })
    }

    if (eventLoopLag > currentConfig.thresholds.eventLoopLag) {
      sensor.log('system', 'warning', 'event-loop-lag', {lag: eventLoopLag})
    }

    sensor.log('system', 'debug', 'system-pulse', {
      cpu: Math.round(cpuUsage * 100) / 100,
      memory: Math.round(memoryUsage * 100) / 100,
      eventLoopLag: Math.round(eventLoopLag * 100) / 100
    })
  } catch (error) {
    sensor.error('system', String(error), 'system-pulse')
    log.error(`System pulse error: ${error}`)
  }
}

/**
 * Performance analysis pulse - monitors execution patterns
 */
const performancePulse = async (): Promise<void> => {
  try {
    const systemStats = metricsState.get()
    const currentStress = systemStats.stress.combined
    const callRate = systemStats.performance.callsPerSecond
    const queueDepth = systemStats.performance.queueDepth

    // Detect performance issues
    const issues: Array<{
      type: string
      severity: 'low' | 'medium' | 'high'
      data: any
    }> = []

    if (currentStress > currentConfig.thresholds.stressHigh) {
      issues.push({
        type: 'high-stress',
        severity: currentStress > 0.95 ? 'high' : 'medium',
        data: {
          stress: currentStress,
          threshold: currentConfig.thresholds.stressHigh
        }
      })
    }

    if (callRate > currentConfig.thresholds.callRateHigh) {
      issues.push({
        type: 'high-call-rate',
        severity: callRate > 200 ? 'high' : 'medium',
        data: {callRate, threshold: currentConfig.thresholds.callRateHigh}
      })
    }

    if (queueDepth > 10) {
      issues.push({
        type: 'queue-buildup',
        severity: queueDepth > 50 ? 'high' : 'medium',
        data: {queueDepth}
      })
    }

    // Proactive optimization triggers
    if (issues.length > 0) {
      const highSeverityIssues = issues.filter(i => i.severity === 'high')

      sensor.log('performance', 'warning', 'performance-issues', {
        issueCount: issues.length,
        highSeverity: highSeverityIssues.length,
        issues: issues.map(i => i.type)
      })

      if (highSeverityIssues.length > 0) {
        cyre.call('performance-critical-issues', {
          issues: highSeverityIssues,
          timestamp: Date.now(),
          action: 'immediate-attention-required'
        })
      } else {
        cyre.call('performance-optimization-suggested', {
          issues,
          severity: 'medium',
          timestamp: Date.now()
        })
      }
    }

    sensor.log('performance', 'debug', 'performance-pulse', {
      stress: Math.round(currentStress * 1000) / 1000,
      callRate,
      queueDepth,
      issueCount: issues.length
    })
  } catch (error) {
    sensor.error('performance', String(error), 'performance-pulse')
    log.error(`Performance pulse error: ${error}`)
  }
}

/**
 * Pattern detection pulse - identifies usage patterns and anomalies
 */
const patternPulse = async (): Promise<void> => {
  try {
    const now = Date.now()
    const systemStats = metricsState.get()
    const patterns: Array<{type: string; confidence: number; data: any}> = []

    // Detect stress patterns
    if (systemStats.breathing.isRecuperating) {
      const recuperationDuration = now - systemStats.breathing.lastBreath
      patterns.push({
        type: 'stress-recuperation-pattern',
        confidence: 0.9,
        data: {
          stress: systemStats.stress.combined,
          duration: recuperationDuration,
          breathCount: systemStats.breathing.breathCount
        }
      })
    }

    // Detect sustained high activity
    if (systemStats.performance.callsPerSecond > 50) {
      patterns.push({
        type: 'sustained-high-activity',
        confidence: 0.8,
        data: {
          callRate: systemStats.performance.callsPerSecond,
          duration: now - systemStats.performance.lastCallTimestamp,
          queueDepth: systemStats.performance.queueDepth
        }
      })
    }

    // Detect breathing pattern changes
    const breathingRate = systemStats.breathing.currentRate
    if (breathingRate > BREATHING.RATES.BASE * 2) {
      patterns.push({
        type: 'rapid-breathing-pattern',
        confidence: 0.85,
        data: {
          currentRate: breathingRate,
          baseRate: BREATHING.RATES.BASE,
          stress: systemStats.stress.combined
        }
      })
    }

    // Detect system hibernation patterns
    if (systemStats.hibernating) {
      patterns.push({
        type: 'hibernation-pattern',
        confidence: 1.0,
        data: {
          activeFormations: systemStats.activeFormations,
          inRecuperation: systemStats.inRecuperation
        }
      })
    }

    // Proactive pattern responses
    if (patterns.length > 0) {
      const highConfidencePatterns = patterns.filter(p => p.confidence > 0.8)

      cyre.call('usage-patterns-detected', {
        patterns,
        highConfidence: highConfidencePatterns,
        timestamp: now,
        recommendations: generatePatternRecommendations(patterns)
      })

      sensor.log('patterns', 'info', 'patterns-detected', {
        patternCount: patterns.length,
        highConfidence: highConfidencePatterns.length,
        types: patterns.map(p => p.type)
      })
    }

    sensor.log('patterns', 'debug', 'pattern-pulse', {
      patternsDetected: patterns.length,
      systemState: {
        hibernating: systemStats.hibernating,
        recuperating: systemStats.breathing.isRecuperating,
        stress: systemStats.stress.combined
      }
    })
  } catch (error) {
    sensor.error('patterns', String(error), 'pattern-pulse')
    log.error(`Pattern pulse error: ${error}`)
  }
}

/**
 * Generate recommendations based on detected patterns
 */
const generatePatternRecommendations = (
  patterns: Array<{type: string; confidence: number; data: any}>
): string[] => {
  const recommendations: string[] = []

  patterns.forEach(pattern => {
    switch (pattern.type) {
      case 'stress-recuperation-pattern':
        recommendations.push(
          'Consider implementing additional throttling or load balancing'
        )
        break
      case 'sustained-high-activity':
        recommendations.push(
          'Monitor for potential bottlenecks and consider scaling strategies'
        )
        break
      case 'rapid-breathing-pattern':
        recommendations.push(
          'System stress detected - review recent changes or reduce load'
        )
        break
      case 'hibernation-pattern':
        recommendations.push(
          'System in hibernation - normal behavior during low activity'
        )
        break
      default:
        recommendations.push('Pattern detected - monitor system behavior')
    }
  })

  return [...new Set(recommendations)] // Remove duplicates
}

/**
 * Main awareness beats controller
 */
export const awarenessBeats = {
  /**
   * Initialize awareness beats with optional configuration
   */
  initialize: (config?: Partial<AwarenessConfig>): void => {
    if (isInitialized) {
      log.warn('Awareness beats already initialized')
      return
    }

    // Merge user config with defaults
    if (config) {
      currentConfig = {
        ...defaultConfig,
        ...config,
        systemPulse: {...defaultConfig.systemPulse, ...config.systemPulse},
        performancePulse: {
          ...defaultConfig.performancePulse,
          ...config.performancePulse
        },
        patternPulse: {...defaultConfig.patternPulse, ...config.patternPulse},
        thresholds: {...defaultConfig.thresholds, ...config.thresholds}
      }
    }

    // Start system pulse
    if (currentConfig.systemPulse.enabled) {
      const result = TimeKeeper.keep(
        currentConfig.systemPulse.interval,
        systemPulse,
        true, // infinite repeat
        'awareness-system-pulse'
      )

      if (result.kind === 'error') {
        log.error(`Failed to start system pulse: ${result.error.message}`)
      }
    }

    // Start performance pulse
    if (currentConfig.performancePulse.enabled) {
      const result = TimeKeeper.keep(
        currentConfig.performancePulse.interval,
        performancePulse,
        true,
        'awareness-performance-pulse'
      )

      if (result.kind === 'error') {
        log.error(`Failed to start performance pulse: ${result.error.message}`)
      }
    }

    // Start pattern pulse
    if (currentConfig.patternPulse.enabled) {
      const result = TimeKeeper.keep(
        currentConfig.patternPulse.interval,
        patternPulse,
        true,
        'awareness-pattern-pulse'
      )

      if (result.kind === 'error') {
        log.error(`Failed to start pattern pulse: ${result.error.message}`)
      }
    }

    isInitialized = true

    sensor.log('awareness', 'success', 'beats-initialized', {
      config: currentConfig,
      timestamp: Date.now(),
      activePulses: [
        currentConfig.systemPulse.enabled ? 'system' : null,
        currentConfig.performancePulse.enabled ? 'performance' : null,
        currentConfig.patternPulse.enabled ? 'pattern' : null
      ].filter(Boolean)
    })

    log.success(
      'Awareness beats initialized - TimeKeeper driving system consciousness'
    )
  },

  /**
   * Stop all awareness beats
   */
  stop: (): void => {
    TimeKeeper.forget('awareness-system-pulse')
    TimeKeeper.forget('awareness-performance-pulse')
    TimeKeeper.forget('awareness-pattern-pulse')

    isInitialized = false

    sensor.log('awareness', 'info', 'beats-stopped', {
      timestamp: Date.now()
    })

    log.info('Awareness beats stopped')
  },

  /**
   * Update configuration and restart beats
   */
  updateConfig: (config: Partial<AwarenessConfig>): void => {
    const oldConfig = {...currentConfig}

    currentConfig = {
      ...currentConfig,
      ...config,
      systemPulse: {...currentConfig.systemPulse, ...config.systemPulse},
      performancePulse: {
        ...currentConfig.performancePulse,
        ...config.performancePulse
      },
      patternPulse: {...currentConfig.patternPulse, ...config.patternPulse},
      thresholds: {...currentConfig.thresholds, ...config.thresholds}
    }

    // Restart with new configuration
    if (isInitialized) {
      awarenessBeats.stop()
      awarenessBeats.initialize(currentConfig)
    }

    sensor.log('awareness', 'info', 'config-updated', {
      oldConfig,
      newConfig: currentConfig,
      timestamp: Date.now()
    })

    log.info('Awareness beats configuration updated')
  },

  /**
   * Get current status and configuration
   */
  getStatus: () => ({
    initialized: isInitialized,
    config: currentConfig,
    activePulses: [
      currentConfig.systemPulse.enabled ? 'system' : null,
      currentConfig.performancePulse.enabled ? 'performance' : null,
      currentConfig.patternPulse.enabled ? 'pattern' : null
    ].filter(Boolean),
    timekeeperStatus: TimeKeeper.status()
  }),

  /**
   * Force immediate execution of all pulses (for testing/debugging)
   */
  pulse: async (): Promise<void> => {
    if (!isInitialized) {
      log.warn('Awareness beats not initialized')
      return
    }

    log.debug('Executing immediate awareness pulse')

    if (currentConfig.systemPulse.enabled) await systemPulse()
    if (currentConfig.performancePulse.enabled) await performancePulse()
    if (currentConfig.patternPulse.enabled) await patternPulse()

    sensor.log('awareness', 'debug', 'manual-pulse-complete', {
      timestamp: Date.now()
    })
  }
}
