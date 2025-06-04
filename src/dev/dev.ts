import {cyre, createBranch, log, orchestration} from '../'

import {metricsReport} from '../context/metrics-report'
import payloadState from '../context/payload-state'
import {io, subscribers} from '../context/state'
import {query} from '../query/cyre-query'
import {IO} from '../types/core'

export const dev = {
  intelligence: {
    getChannelIntelligence: (channelId: string) => {
      const channel = cyre.get(channelId)
      if (!channel) return null

      const fusionResult = cyre.intelligence.getFusionResult(channelId)
      const patternState = cyre.intelligence.getPatternState(channelId)

      return {
        hasIntelligence: !!channel._hasIntelligence,
        config: channel._intelligenceConfig,
        fusion: fusionResult,
        patterns: patternState,
        compiledOptimizations: {
          hasFastPath: channel._hasFastPath,
          hasOptimizedFusion: !!channel._intelligenceConfig?.fusionMethod,
          hasOptimizedPatterns: !!channel._intelligenceConfig?.anomalyDetector
        }
      }
    },

    testIntelligence: async (channelId: string, testPayload: any) => {
      const channel = cyre.get(channelId)
      if (!channel?._hasIntelligence) {
        return {error: 'Channel has no intelligence configuration'}
      }

      const startTime = performance.now()
      const result = await cyre.call(channelId, testPayload)
      const executionTime = performance.now() - startTime

      const fusionResult = cyre.intelligence.getFusionResult(channelId)
      const patternState = cyre.intelligence.getPatternState(channelId)

      return {
        result,
        executionTime,
        intelligenceResults: {
          fusion: fusionResult,
          patterns: patternState
        },
        performance: {
          fast: executionTime < 5,
          acceptable: executionTime < 20,
          slow: executionTime > 20
        }
      }
    },

    benchmarkIntelligence: async (
      channelId: string,
      iterations: number = 100
    ) => {
      const times: number[] = []
      const channel = cyre.get(channelId)

      if (!channel?._hasIntelligence) {
        return {error: 'Channel has no intelligence configuration'}
      }

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        await cyre.call(channelId, {value: Math.random() * 100, iteration: i})
        times.push(performance.now() - startTime)
      }

      return {
        iterations,
        avgTime: times.reduce((sum, t) => sum + t, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        p95Time: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)],
        fastExecutions: times.filter(t => t < 5).length,
        slowExecutions: times.filter(t => t > 20).length
      }
    }
  },
  // Quick orchestration examples
  createSimpleWorkflow: (id: string, steps: string[]) => {
    const workflow = steps.map((step, index) => ({
      name: `step-${index + 1}`,
      type: 'action' as const,
      targets: step
    }))

    return orchestration.create({
      id,
      triggers: [{name: 'manual', type: 'external' as const}],
      workflow
    })
  },

  // Trigger manual orchestration execution
  trigger: async (orchestrationId: string, payload?: any) => {
    log.debug(`Manual trigger for orchestration '${orchestrationId}'`)
    return await orchestration.trigger(orchestrationId, 'manual', payload)
  },

  // Debug channel state (branch-aware)
  inspect: (channelId: string, branchId?: string) => {
    let config: IO | undefined
    let payload: any
    let subscriber: any
    let metrics: any

    const groups = cyre.getChannelGroups(channelId)

    return {
      id: channelId,
      branchId: branchId || 'root',
      config,
      payload,
      hasSubscriber: !!subscriber,
      metrics,
      groups: groups.map(g => g.id),
      queryTime: performance.now()
    }
  },

  // Performance snapshot with branch info
  snapshot: () => {
    const systemStats = metricsReport.getSystemStats()
    const queryStats = query.stats()
    const orchestrations = orchestration.list()

    return {
      system: {
        totalCalls: systemStats.totalCalls,
        callRate: systemStats.callRate,
        uptime: Math.floor((Date.now() - systemStats.startTime) / 1000)
      },
      channels: {
        total: io.getAll().length,
        withSubscribers: subscribers.getAll().length,
        withPayload: query.channels({hasPayload: true}).total
      },

      orchestrations: {
        total: orchestrations.length,
        running: orchestrations.filter(o => o.status === 'running').length
      },
      query: queryStats,
      timestamp: Date.now()
    }
  },

  // Branch-specific operations

  // System metrics
  getSystemMetrics: () => {
    const systemStats = metricsReport.getSystemStats()

    return {
      performance: {
        totalCalls: systemStats.totalCalls,
        callRate: systemStats.callRate,
        totalErrors: systemStats.totalErrors,
        uptime: Math.floor((Date.now() - systemStats.startTime) / 1000)
      }
    }
  },

  triggerHealthCheck: async () => {
    return await orchestration.trigger('system-health-monitor', 'manual')
  }
}
