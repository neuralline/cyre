// real-system-monitor.ts

import {cyre, log} from '../src/app'
import * as os from 'os' // Built-in Node.js module for system information

/**
 * Real-time System Monitoring using Cyre
 *
 * This module implements a real system monitor that tracks actual
 * CPU, memory, and other system resources using Node.js APIs.
 */

// Configuration
const MONITOR_CONFIG = {
  // Monitoring intervals
  intervals: {
    quickCheck: 5 * 1000, // 5 seconds
    standardCheck: 30 * 1000, // 30 seconds
    detailedCheck: 2 * 60 * 1000 // 2 minutes
  },
  // Alert thresholds
  thresholds: {
    highCpuUsage: 0.8, // 80% CPU usage
    highMemoryUsage: 0.85, // 85% Memory usage
    highStress: 0.75 // 75% overall system stress
  }
}

// Track historical CPU usage to calculate current load
const cpuHistory = {
  lastSample: os.cpus().map(cpu => cpu.times),
  lastSampleTime: Date.now()
}

/**
 * Get real-time system metrics
 */
const collectRealSystemMetrics = () => {
  // Get current CPU information
  const currentCpuInfo = os.cpus()
  const currentSampleTime = Date.now()

  // Calculate CPU usage percentage across all cores
  let totalUsage = 0

  currentCpuInfo.forEach((cpu, index) => {
    const prevCpu = cpuHistory.lastSample[index]

    // Calculate deltas
    const idleDelta = cpu.times.idle - prevCpu.idle
    const totalDelta =
      cpu.times.user -
      prevCpu.user +
      (cpu.times.nice - prevCpu.nice) +
      (cpu.times.sys - prevCpu.sys) +
      (cpu.times.irq - prevCpu.irq) +
      idleDelta

    // Calculate usage for this core
    const usage = totalDelta === 0 ? 0 : 1 - idleDelta / totalDelta
    totalUsage += usage
  })

  // Average CPU usage across all cores
  const cpuUsage = totalUsage / currentCpuInfo.length

  // Update cpu history for next calculation
  cpuHistory.lastSample = currentCpuInfo.map(cpu => cpu.times)
  cpuHistory.lastSampleTime = currentSampleTime

  // Calculate memory usage
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()
  const memoryUsage = (totalMemory - freeMemory) / totalMemory

  // Gather additional system metrics
  const loadAverage = os.loadavg()
  const uptime = os.uptime()

  return {
    cpuUsage,
    memoryUsage,
    loadAverage: loadAverage[0], // 1 minute load average
    uptime,
    totalMemory,
    freeMemory,
    hostname: os.hostname(),
    platform: os.platform(),
    timestamp: Date.now()
  }
}

// Generate real CPU load for stress testing
const stressGenerator = {
  active: false,
  intensity: 0,
  workers: [],

  // Start CPU stress test
  start: (intensity = 0.5, duration = 60000) => {
    if (stressGenerator.active) {
      log.warn('Stress generator already active')
      return false
    }

    stressGenerator.active = true
    stressGenerator.intensity = intensity

    // Determine number of workers based on CPU cores
    const cpuCount = os.cpus().length
    const workerCount = Math.max(1, Math.floor(cpuCount * intensity))

    log.info(
      `Starting stress test with ${workerCount} workers for ${duration}ms`
    )

    // Start worker processes
    for (let i = 0; i < workerCount; i++) {
      const worker = setInterval(() => {
        // CPU-intensive work
        let x = 0
        for (let j = 0; j < 10000000; j++) {
          x += Math.sqrt(j)
        }
      }, 0)

      stressGenerator.workers.push(worker)
    }

    // Auto-stop after duration
    setTimeout(() => {
      stressGenerator.stop()
    }, duration)

    return true
  },

  // Stop CPU stress test
  stop: () => {
    if (!stressGenerator.active) {
      return false
    }

    log.info('Stopping stress test')

    // Clean up all workers
    stressGenerator.workers.forEach(worker => {
      clearInterval(worker)
    })

    stressGenerator.workers = []
    stressGenerator.active = false
    stressGenerator.intensity = 0

    return true
  },

  // Get current stress status
  getStatus: () => ({
    active: stressGenerator.active,
    intensity: stressGenerator.intensity,
    workerCount: stressGenerator.workers.length
  })
}

// Memory leak simulator for testing
const memoryLeakSimulator = {
  active: false,
  leakStorage: [],
  intervalId: null,

  // Start simulated memory leak
  start: (mbPerSecond = 10, duration = 30000) => {
    if (memoryLeakSimulator.active) {
      log.warn('Memory leak simulator already active')
      return false
    }

    memoryLeakSimulator.active = true
    memoryLeakSimulator.leakStorage = []

    log.info(
      `Starting memory leak simulation: ${mbPerSecond}MB/sec for ${duration}ms`
    )

    // Generate 1MB chunks of data every second
    memoryLeakSimulator.intervalId = setInterval(() => {
      // Create array of specified size
      for (let i = 0; i < mbPerSecond; i++) {
        const chunk = new Array((1024 * 1024) / 8).fill(Math.random())
        memoryLeakSimulator.leakStorage.push(chunk)
      }

      log.info(
        `Memory leak simulator: added ${mbPerSecond}MB, total size: ${
          memoryLeakSimulator.leakStorage.length * mbPerSecond
        }MB`
      )
    }, 1000)

    // Auto-stop after duration
    setTimeout(() => {
      memoryLeakSimulator.stop()
    }, duration)

    return true
  },

  // Stop memory leak simulation
  stop: () => {
    if (!memoryLeakSimulator.active) {
      return false
    }

    log.info('Stopping memory leak simulation')

    if (memoryLeakSimulator.intervalId) {
      clearInterval(memoryLeakSimulator.intervalId)
    }

    // Free memory
    memoryLeakSimulator.leakStorage = []
    memoryLeakSimulator.active = false
    memoryLeakSimulator.intervalId = null

    return true
  },

  // Get current status
  getStatus: () => ({
    active: memoryLeakSimulator.active,
    allocatedChunks: memoryLeakSimulator.leakStorage.length,
    estimatedSize: (memoryLeakSimulator.leakStorage.length * 1024 * 1024) / 8
  })
}

// Initialize monitoring system
const initializeMonitoring = () => {
  log.info('Starting Cyre real-time system monitoring')

  // Register handlers for monitoring actions
  setupQuickHealthCheck()
  setupStandardHealthCheck()
  setupDetailedHealthCheck()
  setupAlertSystem()

  // Start all monitoring actions
  startAllMonitors()

  return {
    // Public API for the monitoring system
    getStatus: () => getMonitoringStatus(),
    pauseMonitoring: () => pauseAllMonitors(),
    resumeMonitoring: () => resumeAllMonitors(),
    runManualCheck: () => runManualHealthCheck(),

    // Stress testing functions
    stress: {
      startCpuStress: (intensity, duration) =>
        stressGenerator.start(intensity, duration),
      stopCpuStress: () => stressGenerator.stop(),
      getStressStatus: () => stressGenerator.getStatus(),
      startMemoryLeak: (mbPerSecond, duration) =>
        memoryLeakSimulator.start(mbPerSecond, duration),
      stopMemoryLeak: () => memoryLeakSimulator.stop(),
      getMemoryLeakStatus: () => memoryLeakSimulator.getStatus()
    }
  }
}

// Quick health check - runs frequently
const setupQuickHealthCheck = () => {
  cyre.on('monitor-quick-check', async () => {
    const metrics = collectRealSystemMetrics()
    const breathingState = cyre.getBreathingState()

    // Check for critical issues
    const hasCriticalIssues =
      metrics.cpuUsage > MONITOR_CONFIG.thresholds.highCpuUsage ||
      metrics.memoryUsage > MONITOR_CONFIG.thresholds.highMemoryUsage ||
      breathingState.stress > MONITOR_CONFIG.thresholds.highStress

    if (hasCriticalIssues) {
      // Chain to alert system if critical issues detected
      return {
        id: 'system-alert',
        payload: {
          level: 'critical',
          message: 'Critical system resources exceeded thresholds',
          metrics,
          breathingState,
          timestamp: Date.now()
        }
      }
    }

    // Log current state
    log.info(
      `Quick health check: CPU: ${(metrics.cpuUsage * 100).toFixed(
        1
      )}%, Memory: ${(metrics.memoryUsage * 100).toFixed(
        1
      )}%, Load: ${metrics.loadAverage.toFixed(2)}`
    )

    // Store metrics in historical data
    storeHistoricalMetrics('quick', metrics, breathingState)

    return {status: 'healthy'}
  })

  cyre.action({
    id: 'monitor-quick-check',
    type: 'system-monitor',
    interval: MONITOR_CONFIG.intervals.quickCheck,
    repeat: true, // Use boolean for infinite repeats
    priority: {level: 'high'}
  })
}

// Standard health check
const setupStandardHealthCheck = () => {
  cyre.on('monitor-standard-check', async () => {
    const metrics = collectRealSystemMetrics()
    const breathingState = cyre.getBreathingState()
    const performanceState = cyre.getPerformanceState()

    // More detailed analysis
    const issues = []

    if (metrics.cpuUsage > MONITOR_CONFIG.thresholds.highCpuUsage * 0.8) {
      issues.push('CPU usage approaching threshold')
    }

    if (metrics.memoryUsage > MONITOR_CONFIG.thresholds.highMemoryUsage * 0.8) {
      issues.push('Memory usage approaching threshold')
    }

    if (metrics.loadAverage > os.cpus().length * 0.8) {
      issues.push('System load average approaching threshold')
    }

    if (breathingState.isRecuperating) {
      issues.push(
        `System is in recuperation mode (${(
          breathingState.recuperationDepth * 100
        ).toFixed(1)}%)`
      )
    }

    // Check stress testing status
    if (stressGenerator.active) {
      issues.push(
        `CPU stress test active at ${
          stressGenerator.intensity * 100
        }% intensity`
      )
    }

    if (memoryLeakSimulator.active) {
      issues.push(
        `Memory leak simulation active, allocated ~${
          memoryLeakSimulator.getStatus().estimatedSize / (1024 * 1024)
        }MB`
      )
    }

    // Print summary
    log.info(
      `Standard health check - CPU: ${(metrics.cpuUsage * 100).toFixed(
        1
      )}%, Memory: ${(metrics.memoryUsage * 100).toFixed(
        1
      )}%, Load: ${metrics.loadAverage.toFixed(2)}`
    )
    log.info(
      `Breathing - Rate: ${breathingState.currentRate}ms, Pattern: ${
        breathingState.pattern
      }, Stress: ${(breathingState.stress * 100).toFixed(1)}%`
    )

    if (issues.length > 0) {
      log.warn(`Health issues detected: ${issues.join(', ')}`)
    }

    // Store detailed metrics
    storeHistoricalMetrics(
      'standard',
      metrics,
      breathingState,
      performanceState
    )

    // Chain to alert if needed
    if (issues.length > 0) {
      return {
        id: 'system-alert',
        payload: {
          level: 'warning',
          message: `Health issues detected: ${issues.join(', ')}`,
          metrics,
          breathingState,
          timestamp: Date.now()
        }
      }
    }

    return {status: 'healthy', issues: []}
  })

  cyre.action({
    id: 'monitor-standard-check',
    type: 'system-monitor',
    interval: MONITOR_CONFIG.intervals.standardCheck,
    repeat: true, // Use boolean for infinite repeats
    priority: {level: 'medium'}
  })
}

// Detailed health check
const setupDetailedHealthCheck = () => {
  cyre.on('monitor-detailed-check', async () => {
    const metrics = collectRealSystemMetrics()
    const breathingState = cyre.getBreathingState()
    const performanceState = cyre.getPerformanceState()

    // Get metrics for all active channels
    const activeActions = cyre.getMetrics('monitor-detailed-check')

    // Calculate additional metrics
    const memoryUsedGB =
      (metrics.totalMemory - metrics.freeMemory) / (1024 * 1024 * 1024)
    const totalMemoryGB = metrics.totalMemory / (1024 * 1024 * 1024)
    const uptimeHours = metrics.uptime / 3600

    // Detailed system health report
    log.info('============= DETAILED SYSTEM HEALTH CHECK =============')
    log.info(`Time: ${new Date().toISOString()}`)
    log.info(`Host: ${metrics.hostname} (${metrics.platform})`)
    log.info(`Uptime: ${uptimeHours.toFixed(2)} hours`)
    log.info(`System Metrics:`)
    log.info(`  CPU Usage: ${(metrics.cpuUsage * 100).toFixed(1)}%`)
    log.info(
      `  Memory Usage: ${memoryUsedGB.toFixed(2)}GB / ${totalMemoryGB.toFixed(
        2
      )}GB (${(metrics.memoryUsage * 100).toFixed(1)}%)`
    )
    log.info(`  Load Average (1m): ${metrics.loadAverage.toFixed(2)}`)

    log.info(`Cyre Breathing State:`)
    log.info(`  Breath Count: ${breathingState.breathCount}`)
    log.info(`  Current Rate: ${breathingState.currentRate}ms`)
    log.info(`  Stress Level: ${(breathingState.stress * 100).toFixed(1)}%`)
    log.info(`  Is Recuperating: ${breathingState.isRecuperating}`)
    log.info(`  Pattern: ${breathingState.pattern}`)

    log.info(`Performance Metrics:`)
    log.info(
      `  Total Processing Time: ${performanceState.totalProcessingTime}ms`
    )
    log.info(`  Total Call Time: ${performanceState.totalCallTime}ms`)
    log.info(`  Stress: ${(performanceState.stress * 100).toFixed(1)}%`)

    log.info(`Active Formations: ${activeActions.activeFormations}`)

    // Report on stress test status
    if (stressGenerator.active) {
      log.info(
        `CPU Stress Test: Active at ${
          stressGenerator.intensity * 100
        }% intensity with ${stressGenerator.workers.length} workers`
      )
    }

    if (memoryLeakSimulator.active) {
      const leakStatus = memoryLeakSimulator.getStatus()
      log.info(
        `Memory Leak Simulation: Active with ${
          leakStatus.allocatedChunks
        } chunks, ~${(leakStatus.estimatedSize / (1024 * 1024)).toFixed(
          2
        )}MB allocated`
      )
    }

    log.info('=========================================================')

    // Store comprehensive metrics history
    storeHistoricalMetrics(
      'detailed',
      metrics,
      breathingState,
      performanceState,
      activeActions
    )

    // Health assessment
    const systemHealth = assessSystemHealth(
      metrics,
      breathingState,
      performanceState
    )

    if (systemHealth.score < 70) {
      return {
        id: 'system-alert',
        payload: {
          level: 'warning',
          message: `System health score is ${systemHealth.score}%`,
          systemHealth,
          timestamp: Date.now()
        }
      }
    }

    return {
      status: 'completed',
      healthScore: systemHealth.score
    }
  })

  cyre.action({
    id: 'monitor-detailed-check',
    type: 'system-monitor',
    interval: MONITOR_CONFIG.intervals.detailedCheck,
    repeat: true, // Use boolean for infinite repeats
    priority: {level: 'low'}
  })
}

// Alert system
const setupAlertSystem = () => {
  cyre.on('system-alert', async payload => {
    // Log the alert
    if (payload.level === 'critical') {
      log.error(`[CRITICAL ALERT] ${payload.message}`)
    } else {
      log.warn(`[ALERT] ${payload.message}`)
    }

    // In a real system, you might:
    // - Send an email or SMS
    // - Create an incident ticket
    // - Call an external alerting API
    // - Trigger automated recovery procedures

    // For critical alerts, could run an immediate detailed check
    if (payload.level === 'critical') {
      return {
        id: 'monitor-detailed-check',
        payload: {
          triggeredBy: 'alert',
          timestamp: Date.now()
        }
      }
    }

    return {
      status: 'alert-processed',
      timestamp: Date.now()
    }
  })

  cyre.action({
    id: 'system-alert',
    type: 'system-monitor',
    priority: {level: 'critical'}
  })
}

// Helper function to start all monitoring actions
const startAllMonitors = () => {
  cyre.call('monitor-quick-check')
  cyre.call('monitor-standard-check')
  cyre.call('monitor-detailed-check')

  log.info('All monitoring actions started')
}

// Helper function to pause all monitoring actions
const pauseAllMonitors = () => {
  cyre.pause('monitor-quick-check')
  cyre.pause('monitor-standard-check')
  cyre.pause('monitor-detailed-check')

  log.info('All monitoring actions paused')
}

// Helper function to resume all monitoring actions
const resumeAllMonitors = () => {
  cyre.resume('monitor-quick-check')
  cyre.resume('monitor-standard-check')
  cyre.resume('monitor-detailed-check')

  log.info('All monitoring actions resumed')
}

// Run a manual health check
const runManualHealthCheck = async () => {
  log.info('Running manual health check')
  return cyre.call('monitor-detailed-check', {manual: true})
}

// Get current monitoring status
const getMonitoringStatus = () => {
  const quickCheckAction = cyre.get('monitor-quick-check')
  const standardCheckAction = cyre.get('monitor-standard-check')
  const detailedCheckAction = cyre.get('monitor-detailed-check')

  const breathingState = cyre.getBreathingState()
  const metrics = collectRealSystemMetrics()

  return {
    system: {
      metrics,
      breathing: breathingState,
      performanceState: cyre.getPerformanceState(),
      activeFormations:
        cyre.getMetrics('monitor-quick-check')?.activeFormations || 0
    },
    monitoring: {
      quickCheck: !!quickCheckAction,
      standardCheck: !!standardCheckAction,
      detailedCheck: !!detailedCheckAction
    },
    stress: {
      cpuStress: stressGenerator.getStatus(),
      memoryLeak: memoryLeakSimulator.getStatus()
    },
    timestamp: Date.now()
  }
}

// Internal storage for historical metrics
// In a real application, you might use a database
let metricsHistory: Array<{
  type: string
  timestamp: number
  metrics: any
  breathing: any
  performance?: any
  activeActions?: any
}> = []

// Store metrics for historical tracking
const storeHistoricalMetrics = (
  type: string,
  metrics: any,
  breathing: any,
  performance?: any,
  activeActions?: any
) => {
  metricsHistory.push({
    type,
    timestamp: Date.now(),
    metrics,
    breathing,
    performance,
    activeActions
  })

  // Limit history size
  if (metricsHistory.length > 1000) {
    metricsHistory = metricsHistory.slice(-1000)
  }
}

// Get historical metrics data
const getHistoricalData = () => {
  return [...metricsHistory]
}

// Calculate overall system health score
const assessSystemHealth = (metrics: any, breathing: any, performance: any) => {
  // Weight different factors
  const weights = {
    cpuUsage: 0.25,
    memoryUsage: 0.25,
    loadAverage: 0.2,
    systemStress: 0.3
  }

  // Calculate component scores (0-100)
  const cpuScore = 100 - metrics.cpuUsage * 100
  const memoryScore = 100 - metrics.memoryUsage * 100
  const loadScore = 100 - (metrics.loadAverage / os.cpus().length) * 100
  const stressScore = 100 - breathing.stress * 100

  // Calculate weighted health score
  const healthScore =
    cpuScore * weights.cpuUsage +
    memoryScore * weights.memoryUsage +
    loadScore * weights.loadAverage +
    stressScore * weights.systemStress

  return {
    score: Math.round(healthScore),
    components: {
      cpuScore: Math.round(cpuScore),
      memoryScore: Math.round(memoryScore),
      loadScore: Math.round(loadScore),
      stressScore: Math.round(stressScore)
    },
    timestamp: Date.now()
  }
}

// Export the monitoring system
export const systemMonitor = initializeMonitoring()

// Example usage:
// Start monitoring automatically when module loads
// systemMonitor.getStatus() - Get current status
// systemMonitor.stress.startCpuStress(0.8, 30000) - Generate 80% CPU load for 30 seconds
// systemMonitor.stress.startMemoryLeak(20, 30000) - Simulate 20MB/sec memory leak for 30 seconds
