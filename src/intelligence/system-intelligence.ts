// src/intelligence/system-intelligence.ts
// System intelligence registration with proper execution flow

import {log} from '../components/cyre-log'
import {sensor} from '../context/metrics-report'
import {metrics} from '../metrics/integration'
import {metricsState} from '../context/metrics-state'
import type {IO} from '../types/core'
import type {OrchestrationConfig} from '../types/orchestration'
import cyre from '../'
import {query} from '../query/cyre-query'
import {registerSystemDiagnostics} from './system-diagnostics'

/*

      C.Y.R.E - S.Y.S.T.E.M - I.N.T.E.L.L.I.G.E.N.C.E
      
      System intelligence with proper execution:
      1. Batch register system actions with system tags
      2. Batch register system handlers (.on)
      3. Create orchestrations with proper triggers
      4. Verify execution flow
      5. Works consistently across environments

*/

// Track initialization state
let systemInitialized = false

/**
 * Get system action definitions with system tags
 */
const getSystemActions = (): IO[] => {
  return [
    {
      id: 'system-stress-monitor',
      tags: ['system', 'monitoring', 'stress']
    },
    {
      id: 'breathing-adapter',
      tags: ['system', 'breathing', 'adapter']
    },
    {
      id: 'memory-monitor',
      tags: ['system', 'memory', 'monitoring']
    },
    {
      id: 'memory-cleanup',
      tags: ['system', 'memory', 'cleanup']
    },
    {
      id: 'performance-analyzer',
      tags: ['system', 'performance', 'analysis']
    },
    {
      id: 'performance-insights',
      tags: ['system', 'performance', 'insights']
    },
    {
      id: 'system-health-checker',
      tags: ['system', 'health', 'monitoring']
    },
    {
      id: 'health-reporter',
      tags: ['system', 'health', 'reporting']
    }
  ]
}

/**
 * Get system handler definitions with proper logging
 */
const getSystemHandlers = (): Array<{
  id: string
  handler: (...args: any[]) => any
}> => {
  return [
    {
      id: 'system-stress-monitor',
      handler: (payload?: any) => {
        try {
          log.info('🎯 System Stress Monitor: Starting analysis...')

          const systemMetrics = metrics.getSystemMetrics()
          const currentStress = Math.min(systemMetrics.callRate / 50, 1)
          const breathing = metricsState.get().breathing

          // Update the system with current stress
          metricsState.updateBreathingWithStress(
            currentStress,
            systemMetrics.callRate
          )

          const result = {
            success: true,
            stress: currentStress,
            metrics: systemMetrics,
            breathing,
            timestamp: Date.now()
          }

          log.info(
            `📊 System Stress: ${(currentStress * 100).toFixed(
              1
            )}% | Call Rate: ${systemMetrics.callRate}/sec | Breathing: ${
              breathing.currentRate
            }ms`
          )

          sensor.info('system-stress-monitor', 'Stress monitoring complete', {
            stress: currentStress,
            callRate: systemMetrics.callRate,
            breathingRate: breathing.currentRate
          })

          return result
        } catch (error) {
          log.error(`❌ System stress monitor failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'breathing-adapter',
      handler: (payload?: any) => {
        try {
          log.info('🫁 Breathing Adapter: Adjusting breathing rate...')

          const breathing = metricsState.get().breathing
          const previousRate = breathing.currentRate
          const systemMetrics = metrics.getSystemMetrics()
          const stress = Math.min(systemMetrics.callRate / 50, 1)

          // Actually update the breathing system
          metricsState.updateBreathingWithStress(stress, systemMetrics.callRate)
          const newBreathing = metricsState.get().breathing
          const rateChanged =
            Math.abs(newBreathing.currentRate - previousRate) > 5

          const result = {
            success: true,
            adapted: rateChanged,
            previousRate,
            newRate: newBreathing.currentRate,
            stress,
            timestamp: Date.now()
          }

          if (rateChanged) {
            log.info(
              `🫁 Breathing Adapted: ${previousRate.toFixed(
                1
              )}ms → ${newBreathing.currentRate.toFixed(1)}ms (Stress: ${(
                stress * 100
              ).toFixed(1)}%)`
            )
          } else {
            log.info(
              `🫁 Breathing Stable: ${newBreathing.currentRate.toFixed(
                1
              )}ms (Stress: ${(stress * 100).toFixed(1)}%)`
            )
          }

          sensor.info('breathing-adapter', 'Breathing adaptation complete', {
            previousRate,
            newRate: newBreathing.currentRate,
            stress,
            rateChanged
          })

          return result
        } catch (error) {
          log.error(`❌ Breathing adapter failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'memory-monitor',
      handler: (payload?: any) => {
        try {
          log.info('🧠 Memory Monitor: Checking memory usage...')

          const systemMetrics = metrics.getSystemMetrics()
          const events = metrics.getEvents({since: Date.now() - 300000})

          const estimatedMemory = {
            totalCalls: systemMetrics.totalCalls,
            totalExecutions: systemMetrics.totalExecutions,
            recentEvents: events.length,
            memoryScore: Math.min(
              (systemMetrics.totalCalls + events.length) / 10000,
              1
            )
          }

          const needsCleanup =
            estimatedMemory.memoryScore > 0.8 || events.length > 1000

          const result = {
            success: true,
            memoryUsage: estimatedMemory.memoryScore,
            needsCleanup,
            metrics: estimatedMemory,
            timestamp: Date.now()
          }

          if (needsCleanup) {
            log.warn(
              `🧠 Memory Alert: ${events.length} recent events, score: ${(
                estimatedMemory.memoryScore * 100
              ).toFixed(1)}%`
            )
          } else {
            log.info(
              `🧠 Memory OK: ${events.length} events, score: ${(
                estimatedMemory.memoryScore * 100
              ).toFixed(1)}%`
            )
          }

          return result
        } catch (error) {
          log.error(`❌ Memory monitor failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'memory-cleanup',
      handler: (payload?: any) => {
        try {
          log.info('🧹 Memory Cleanup: Starting cleanup operations...')

          const events = metrics.getEvents({since: Date.now() - 300000})
          let cleanupActions = 0

          // Trigger actual cleanup if needed
          if (events.length > 1000) {
            query.cache.clear()
            cleanupActions++
            log.info(
              `🧹 Memory Cleanup: Cleared query cache, ${events.length} recent events`
            )
          }

          // Reset metrics if too many accumulated
          if (events.length > 5000) {
            metrics.reset()
            cleanupActions++
            log.warn(
              `🧹 Memory Cleanup: Reset metrics system, had ${events.length} events`
            )
          }

          const result = {
            success: true,
            cleanupActions,
            recentEvents: events.length,
            timestamp: Date.now()
          }

          if (cleanupActions === 0) {
            log.info('🧹 Memory Cleanup: No cleanup needed')
          }

          return result
        } catch (error) {
          log.error(`❌ Memory cleanup failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'performance-analyzer',
      handler: (payload?: any) => {
        try {
          log.info('⚡ Performance Analyzer: Analyzing system performance...')

          const systemMetrics = metrics.getSystemMetrics()
          const analysis = metrics.analyze(60000) // Last minute

          const performance = {
            avgLatency: analysis.performance.avgLatency,
            successRate:
              systemMetrics.totalExecutions /
              Math.max(systemMetrics.totalCalls, 1),
            errorRate:
              systemMetrics.totalErrors / Math.max(systemMetrics.totalCalls, 1),
            throughput: systemMetrics.callRate,
            efficiency: analysis.pipeline.efficiency
          }

          const result = {
            success: true,
            analysis: performance,
            timestamp: Date.now()
          }

          // Log performance insights
          if (performance.errorRate > 0.1) {
            log.warn(
              `⚡ Performance Alert: ${(performance.errorRate * 100).toFixed(
                1
              )}% error rate`
            )
          } else if (performance.successRate < 0.8) {
            log.warn(
              `⚡ Performance Alert: ${(performance.successRate * 100).toFixed(
                1
              )}% success rate`
            )
          } else {
            log.info(
              `⚡ Performance: ${(performance.successRate * 100).toFixed(
                1
              )}% success, ${performance.avgLatency.toFixed(1)}ms avg latency`
            )
          }

          return result
        } catch (error) {
          log.error(`❌ Performance analyzer failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'performance-insights',
      handler: (payload?: any) => {
        try {
          log.info('💡 Performance Insights: Generating recommendations...')

          const systemMetrics = metrics.getSystemMetrics()
          const analysis = metrics.analyze(60000)

          const insights = {
            systemEfficiency:
              systemMetrics.totalExecutions /
              Math.max(systemMetrics.totalCalls, 1),
            totalActivity: systemMetrics.totalCalls,
            uptime: systemMetrics.uptime,
            pipelineHealth: analysis.pipeline.flowHealth
          }

          const recommendations = []
          if (insights.systemEfficiency < 0.8) {
            recommendations.push(
              'Consider optimizing action pipeline efficiency'
            )
          }
          if (systemMetrics.totalErrors > 10) {
            recommendations.push(
              'Investigate error patterns to improve reliability'
            )
          }
          if (analysis.pipeline.stuckCalls > 0) {
            recommendations.push(
              `${analysis.pipeline.stuckCalls} calls are stuck in pipeline`
            )
          }

          const result = {
            success: true,
            insights,
            recommendations,
            timestamp: Date.now()
          }

          if (recommendations.length > 0) {
            log.info(`💡 Insights: ${recommendations.join(', ')}`)
          } else {
            log.info('💡 Insights: System performing optimally')
          }

          return result
        } catch (error) {
          log.error(`❌ Performance insights failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'system-health-checker',
      handler: (payload?: any) => {
        try {
          log.info('💚 Health Checker: Evaluating system health...')

          const systemMetrics = metrics.getSystemMetrics()
          const breathing = metricsState.get().breathing
          const analysis = metrics.analyze(60000)

          const successRate =
            systemMetrics.totalExecutions /
            Math.max(systemMetrics.totalCalls, 1)
          const errorRate =
            systemMetrics.totalErrors / Math.max(systemMetrics.totalCalls, 1)

          const score = Math.round(
            successRate * 70 +
              (1 - errorRate) * 20 +
              (breathing.stress < 0.8 ? 10 : 0)
          )
          const status =
            score > 80 ? 'healthy' : score > 60 ? 'degraded' : 'critical'

          const health = {
            status,
            score,
            issues: [],
            criticalAlerts: 0
          }

          if (errorRate > 0.1) {
            health.issues.push(
              `High error rate: ${(errorRate * 100).toFixed(1)}%`
            )
          }
          if (breathing.stress > 0.8) {
            health.issues.push('High system stress')
            health.criticalAlerts++
          }
          if (analysis.pipeline.stuckCalls > 3) {
            health.issues.push(`${analysis.pipeline.stuckCalls} stuck calls`)
            health.criticalAlerts++
          }

          const result = {
            success: true,
            health,
            systemMetrics,
            breathing,
            timestamp: Date.now()
          }

          // Log health status
          const healthIcon =
            status === 'healthy' ? '💚' : status === 'degraded' ? '💛' : '❤️'
          log.info(
            `${healthIcon} System Health: ${status.toUpperCase()} (${score}/100)`
          )

          if (health.issues.length > 0) {
            log.warn(`🚨 Health Issues: ${health.issues.join(', ')}`)
          }

          return result
        } catch (error) {
          log.error(`❌ System health checker failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'health-reporter',
      handler: (payload?: any) => {
        try {
          log.info('📋 Health Reporter: Generating health report...')

          const systemMetrics = metrics.getSystemMetrics()
          const breathing = metricsState.get().breathing

          const successRate =
            systemMetrics.totalExecutions /
            Math.max(systemMetrics.totalCalls, 1)
          const errorRate =
            systemMetrics.totalErrors / Math.max(systemMetrics.totalCalls, 1)
          const score = Math.round(successRate * 80 + (1 - errorRate) * 20)
          const status =
            score > 80 ? 'healthy' : score > 60 ? 'degraded' : 'critical'
          const criticalAlerts = errorRate > 0.2 ? 1 : 0

          const shouldReport =
            status !== 'healthy' || criticalAlerts > 0 || breathing.stress > 0.8

          const result = {
            success: true,
            reported: shouldReport,
            health: {status, score, criticalAlerts},
            timestamp: Date.now()
          }

          if (shouldReport) {
            log.warn(
              `📋 Health Report: Status=${status}, Score=${score}/100, Stress=${(
                breathing.stress * 100
              ).toFixed(1)}%`
            )

            if (criticalAlerts > 0) {
              log.critical(
                `🚨 Critical Alert: Error rate ${(errorRate * 100).toFixed(1)}%`
              )
            }
          } else {
            log.info(`📋 Health Report: All systems nominal (${score}/100)`)
          }

          return result
        } catch (error) {
          log.error(`❌ Health reporter failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    }
  ]
}

/**
 * Get system orchestration configurations with shorter intervals for visibility
 */
const getSystemOrchestrations = (): OrchestrationConfig[] => {
  return [
    {
      id: 'system-adaptive-breathing',
      name: 'Adaptive Breathing Monitor',
      description: 'Monitors system stress and adapts breathing rates',
      enabled: true,
      triggers: [
        {
          type: 'time',
          name: 'breathing-check',
          interval: 15000, // 15 seconds for visibility
          repeat: true
        }
      ],
      workflow: [
        {
          name: 'check-system-stress',
          type: 'action',
          targets: ['system-stress-monitor'],
          enabled: true,
          onError: 'continue'
        },
        {
          name: 'adapt-breathing-rate',
          type: 'action',
          targets: ['breathing-adapter'],
          enabled: true,
          onError: 'continue'
        }
      ]
    },
    {
      id: 'system-memory-management',
      name: 'Memory Management Monitor',
      description: 'Monitors system memory and performs cleanup when needed',
      enabled: true,
      triggers: [
        {
          type: 'time',
          name: 'memory-check',
          interval: 30000, // 30 seconds
          repeat: true
        }
      ],
      workflow: [
        {
          name: 'check-memory-usage',
          type: 'action',
          targets: ['memory-monitor'],
          enabled: true,
          onError: 'continue'
        },
        {
          name: 'cleanup-if-needed',
          type: 'action',
          targets: ['memory-cleanup'],
          enabled: true,
          onError: 'continue'
        }
      ]
    },
    {
      id: 'system-performance-monitor',
      name: 'Performance Monitor',
      description: 'Monitors system performance and generates insights',
      enabled: true,
      triggers: [
        {
          type: 'time',
          name: 'performance-check',
          interval: 25000, // 25 seconds
          repeat: true
        }
      ],
      workflow: [
        {
          name: 'analyze-performance',
          type: 'action',
          targets: ['performance-analyzer'],
          enabled: true,
          onError: 'continue'
        },
        {
          name: 'generate-insights',
          type: 'action',
          targets: ['performance-insights'],
          enabled: true,
          onError: 'continue'
        }
      ]
    },
    {
      id: 'system-health-check',
      name: 'System Health Check',
      description: 'Automated system health monitoring and reporting',
      enabled: true,
      triggers: [
        {
          type: 'time',
          name: 'health-check',
          interval: 35000, // 35 seconds
          repeat: true
        }
      ],
      workflow: [
        {
          name: 'run-health-check',
          type: 'action',
          targets: ['system-health-checker'],
          enabled: true,
          onError: 'continue'
        },
        {
          name: 'report-status',
          type: 'action',
          targets: ['health-reporter'],
          enabled: true,
          onError: 'continue'
        }
      ]
    }
  ]
}

/**
 * Register system intelligence with Cyre
 */
export const registerSystemIntelligence = (
  orchestration: any
): {registered: string[]; failed: string[]} => {
  if (systemInitialized) {
    log.debug('System intelligence already initialized')
    return {registered: [], failed: []}
  }

  const registered: string[] = []
  const failed: string[] = []

  try {
    log.info('🚀 Registering system intelligence...')

    // Step 1: Batch register system actions
    const systemActions = getSystemActions()

    for (const action of systemActions) {
      try {
        const actionResult = cyre.action(action)
        if (!actionResult.ok) {
          log.error(
            `❌ Failed to register action ${action.id}: ${actionResult.message}`
          )
          failed.push(action.id)
        } else {
          log.debug(`✅ Registered action: ${action.id}`)
        }
      } catch (error) {
        log.error(`❌ Error registering action ${action.id}: ${error}`)
        failed.push(action.id)
      }
    }

    log.success(
      `✅ Registered ${systemActions.length - failed.length}/${
        systemActions.length
      } system actions`
    )

    // Step 2: Batch register system handlers
    const systemHandlers = getSystemHandlers()
    let handlerSuccessCount = 0

    for (const {id, handler} of systemHandlers) {
      try {
        const result = cyre.on(id, handler)
        if (result.ok) {
          handlerSuccessCount++
          log.debug(`✅ Registered handler: ${id}`)
        } else {
          log.error(
            `❌ Failed to register handler for ${id}: ${result.message}`
          )
          failed.push(id)
        }
      } catch (error) {
        log.error(`❌ Error registering handler for ${id}: ${error}`)
        failed.push(id)
      }
    }

    log.success(
      `✅ Registered ${handlerSuccessCount}/${systemHandlers.length} system handlers`
    )

    // Step 3: Create and start orchestrations
    const systemOrchestrations = getSystemOrchestrations()

    for (const config of systemOrchestrations) {
      try {
        // Remove existing if present
        const existing = orchestration.get(config.id)
        if (existing) {
          orchestration.stop(config.id)
          orchestration.remove(config.id)
          log.debug(`🔄 Removed existing orchestration: ${config.id}`)
        }

        // Create new orchestration
        const createResult = orchestration.create(config)
        if (!createResult.ok) {
          failed.push(config.id)
          log.error(
            `❌ Failed to create orchestration ${config.id}: ${createResult.message}`
          )
          continue
        }

        // Start orchestration
        const startResult = orchestration.start(config.id)
        if (startResult.ok) {
          registered.push(config.id)
          log.success(`✅ Started orchestration: ${config.id}`)
        } else {
          failed.push(config.id)
          log.error(
            `❌ Failed to start orchestration ${config.id}: ${startResult.message}`
          )
        }
      } catch (error) {
        failed.push(config.id)
        log.error(`❌ Error with orchestration ${config.id}: ${error}`)
      }
    }

    systemInitialized = true

    log.info(`🎯 System intelligence registration complete:`)
    log.info(
      `  📝 Actions: ${
        systemActions.length -
        failed.filter(f => systemActions.some(a => a.id === f)).length
      } registered`
    )
    log.info(`  🎪 Handlers: ${handlerSuccessCount} registered`)
    log.info(
      `  🎼 Orchestrations: ${registered.length} started, ${
        failed.filter(f => systemOrchestrations.some(o => o.id === f)).length
      } failed`
    )

    if (registered.length > 0) {
      log.info(`  🔄 Active orchestrations: ${registered.join(', ')}`)
    }

    return {registered, failed}
  } catch (error) {
    log.error(`❌ System intelligence registration failed: ${error}`)
    return {
      registered: [],
      failed: ['system-intelligence-registration-error']
    }
  }
}

/**
 * Get system intelligence status
 */
export const getSystemIntelligenceStatus = () => {
  return {
    initialized: systemInitialized,
    actionIds: getSystemActions().map(action => action.id),
    handlerIds: getSystemHandlers().map(handler => handler.id),
    orchestrationIds: getSystemOrchestrations().map(orch => orch.id)
  }
}

/**
 * Reset system intelligence (for testing)
 */
export const resetSystemIntelligence = () => {
  systemInitialized = false
  log.debug('System intelligence reset')
}
