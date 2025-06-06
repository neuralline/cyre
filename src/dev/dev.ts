// src/dev/dev.ts
// Development utilities and debugging tools

import {metrics} from '../metrics/integration'
import {orchestration} from '../orchestration/orchestration-engine'
import {metricsState} from '../context/metrics-state'
import {call} from '../app'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - D.E.V - I.N.T.E.R.F.A.C.E
      
      Development utilities and debugging tools:
      - System metrics access
      - Memory cleanup triggers
      - Performance insights
      - System snapshots
      - Orchestration monitoring

*/

/**
 * Get comprehensive system metrics for development
 */
const getSystemMetrics = () => {
  const systemMetrics = metrics.getSystemMetrics()
  const breathing = metricsState.get().breathing
  const orchestrationOverview = orchestration.getSystemOverview()

  return {
    performance: {
      totalCalls: systemMetrics.totalCalls,
      totalExecutions: systemMetrics.totalExecutions,
      totalErrors: systemMetrics.totalErrors,
      callRate: systemMetrics.callRate,
      uptime: systemMetrics.uptime
    },
    breathing: {
      stress: breathing.stress,
      currentRate: breathing.currentRate,
      isRecuperating: breathing.isRecuperating,
      pattern: breathing.pattern
    },
    orchestrations: {
      total: orchestrationOverview.total.orchestrations,
      running: orchestrationOverview.total.running,
      timelineEntries: orchestrationOverview.total.timelineEntries
    },
    system: {
      totalCalls: systemMetrics.totalCalls,
      totalExecutions: systemMetrics.totalExecutions,
      totalErrors: systemMetrics.totalErrors,
      uptime: systemMetrics.uptime
    }
  }
}

/**
 * Trigger memory cleanup manually
 */
const triggerMemoryCleanup = async () => {
  try {
    log.info('🧹 Manual memory cleanup triggered')

    // Call the memory cleanup action
    const result = await call('memory-cleanup')

    if (result.ok) {
      log.success('Memory cleanup completed successfully')
      return {
        ok: true,
        message: 'Memory cleanup completed',
        result: result.payload
      }
    } else {
      log.error(`Memory cleanup failed: ${result.message}`)
      return {
        ok: false,
        message: result.message
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Memory cleanup error: ${errorMessage}`)
    return {
      ok: false,
      message: errorMessage
    }
  }
}

/**
 * Get performance insights
 */
export const getPerformanceInsights = () => {
  try {
    const recommendations = metrics.getRecommendations()
    return recommendations
  } catch (error) {
    log.error(`Failed to get performance insights: ${error}`)
    return []
  }
}

/**
 * Create development snapshot
 */
const snapshot = () => {
  const systemMetrics = metrics.getSystemMetrics()
  const breathing = metricsState.get().breathing
  const orchestrationOverview = orchestration.getSystemOverview()
  const analysis = metrics.analyze()

  return {
    timestamp: new Date().toISOString(),
    system: {
      totalCalls: systemMetrics.totalCalls,
      totalExecutions: systemMetrics.totalExecutions,
      totalErrors: systemMetrics.totalErrors,
      uptime: systemMetrics.uptime,
      callRate: systemMetrics.callRate
    },
    breathing: {
      stress: breathing.stress,
      currentRate: breathing.currentRate,
      isRecuperating: breathing.isRecuperating
    },
    orchestrations: {
      total: orchestrationOverview.total.orchestrations,
      running: orchestrationOverview.total.running,
      timelineEntries: orchestrationOverview.total.timelineEntries
    },
    health: {
      status: analysis.health.overall,
      score: analysis.health.score
    },
    performance: {
      avgLatency: analysis.performance.avgLatency,
      successRate: analysis.performance.successRate,
      throughput: analysis.performance.throughput
    }
  }
}

/**
 * Create simple workflow for testing
 */
const createSimpleWorkflow = (id: string, steps: string[]) => {
  return orchestration.create({
    id,
    name: `Simple Workflow: ${id}`,
    description: `Auto-generated workflow with steps: ${steps.join(' -> ')}`,
    enabled: true,
    workflow: steps.map((step, index) => ({
      name: `step-${index + 1}`,
      type: 'action' as const,
      targets: [step],
      enabled: true,
      onError: 'continue' as const
    }))
  })
}

/**
 * Trigger orchestration manually
 */
const trigger = (orchestrationId: string, payload?: any) => {
  return orchestration.trigger(orchestrationId, 'manual-dev-trigger', payload)
}

/**
 * Inspect channel details
 */
const inspect = (channelId: string) => {
  const channelAnalysis = metrics.analyzeChannel(channelId)
  return channelAnalysis
}

/**
 * Trigger health check manually
 */
const triggerHealthCheck = async () => {
  try {
    const result = await call('system-health-checker')
    return result
  } catch (error) {
    return {
      ok: false,
      message: String(error)
    }
  }
}

/**
 * Monitor orchestration activity
 */
const monitorOrchestrations = (durationMs = 30000) => {
  log.info(`👀 Monitoring orchestrations for ${durationMs / 1000} seconds...`)

  let activityCount = 0
  const startTime = Date.now()

  const monitor = setInterval(() => {
    const overview = orchestration.getSystemOverview()
    const elapsed = Date.now() - startTime

    if (elapsed % 5000 === 0) {
      log.info(
        `[${Math.floor(elapsed / 1000)}s] Running: ${overview.total.running}/${
          overview.total.orchestrations
        }`
      )
    }

    if (elapsed >= durationMs) {
      clearInterval(monitor)
      log.success('Monitoring complete')
    }
  }, 1000)

  return () => clearInterval(monitor)
}

export const dev = {
  getSystemMetrics,
  triggerMemoryCleanup,
  getPerformanceInsights,
  snapshot,
  createSimpleWorkflow,
  trigger,
  inspect,
  triggerHealthCheck,
  monitorOrchestrations
}
