import {cyre, log, orchestration} from '../'

import {io} from '../context/state'
import {metrics} from '../metrics'

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

  // Branch-specific operations
  /**
   * Quick system diagnostic
   */
  diagnose: (): void => {
    console.log('🔍 CYRE DIAGNOSTIC REPORT')
    console.log('='.repeat(50))

    const health = metrics.healthCheck()
    const systemMetrics = metrics.getSystemMetrics()
    const analysis = metrics.analyze()

    console.log(
      `\n${
        health.score >= 90 ? '✅' : health.score >= 70 ? '⚠️' : '🔴'
      } System Health: ${health.status.toUpperCase()} (Score: ${
        health.score
      }/100)`
    )

    console.log('\nQuick Stats:')
    console.log(`  Channels: ${analysis.channels.length}`)
    console.log(`  Calls: ${systemMetrics.totalCalls}`)
    console.log(
      `  Success Rate: ${(analysis.health.factors.successRate * 100).toFixed(
        1
      )}%`
    )
    console.log(
      `  Avg Latency: ${analysis.health.factors.latency.toFixed(2)}ms`
    )

    if (analysis.alerts.length > 0) {
      console.log(`\n⚠️  ${analysis.alerts.length} alerts require attention`)
    }

    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Top recommendations:')
      analysis.recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`)
      })
    }
  },

  /**
   * Stress test a channel
   */
  stressTest: async (
    channelId: string,
    callCount: number,
    durationSeconds: number
  ) => {
    console.log(
      `🧪 Stress testing channel '${channelId}' with ${callCount} calls...`
    )

    const beforeAnalysis = metrics.analyzeChannel(channelId)
    const startTime = Date.now()

    let successful = 0
    let failed = 0

    const interval = (durationSeconds * 1000) / callCount

    for (let i = 0; i < callCount; i++) {
      try {
        const result = await cyre.call(channelId, {
          stressTest: true,
          iteration: i,
          timestamp: Date.now()
        })

        if (result.ok) {
          successful++
        } else {
          failed++
        }
      } catch (error) {
        failed++
      }

      // Maintain rate
      if (i < callCount - 1) {
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }

    const duration = Date.now() - startTime
    const rate = (callCount / duration) * 1000

    const afterAnalysis = metrics.analyzeChannel(channelId)

    console.log('\n📊 Stress Test Results:')
    console.log(`  Duration: ${duration}ms`)
    console.log(
      `  Successful: ${successful}/${callCount} (${(
        (successful / callCount) *
        100
      ).toFixed(1)}%)`
    )
    console.log(`  Failed: ${failed}/${callCount}`)
    console.log(`  Rate: ${rate.toFixed(1)} calls/sec`)

    if (beforeAnalysis && afterAnalysis) {
      const latencyChange =
        afterAnalysis.metrics.averageLatency -
        beforeAnalysis.metrics.averageLatency
      const successRateChange =
        afterAnalysis.metrics.successRate - beforeAnalysis.metrics.successRate

      console.log('\n📈 Channel Performance Impact:')
      console.log(
        `  Latency: ${beforeAnalysis.metrics.averageLatency.toFixed(
          2
        )}ms → ${afterAnalysis.metrics.averageLatency.toFixed(2)}ms (${
          latencyChange >= 0 ? '+' : ''
        }${latencyChange.toFixed(2)}ms)`
      )
      console.log(
        `  Success Rate: ${(beforeAnalysis.metrics.successRate * 100).toFixed(
          1
        )}% → ${(afterAnalysis.metrics.successRate * 100).toFixed(1)}% (${(
          successRateChange * 100
        ).toFixed(1)}%)`
      )
    }

    return {
      duration,
      successful,
      failed,
      rate,
      successRate: successful / callCount
    }
  },

  /**
   * Compare channel performance
   */
  compareChannels: (channelIds: string[]): void => {
    console.log('📊 Channel Comparison:')
    console.log(
      'Channel'.padEnd(20) +
        'Calls'.padStart(6) +
        'Success%'.padStart(10) +
        'Latency'.padStart(12) +
        ' Status'
    )
    console.log('-'.repeat(60))

    const comparisons = channelIds
      .map(id => {
        const analysis = metrics.analyzeChannel(id, undefined)
        return analysis
          ? {
              id,
              calls: analysis.metrics.calls,
              successRate: analysis.metrics.successRate,
              latency: analysis.metrics.averageLatency,
              status: analysis.status
            }
          : null
      })
      .filter(Boolean)

    comparisons.forEach(comp => {
      if (comp) {
        console.log(
          comp.id.padEnd(20) +
            comp.calls.toString().padStart(6) +
            `${(comp.successRate * 100).toFixed(1)}%`.padStart(9) +
            `${comp.latency.toFixed(1)}ms`.padStart(11) +
            ` ${comp.status}`
        )
      }
    })

    // Find best and worst
    if (comparisons.length > 1) {
      const sortedBySuccess = [...comparisons].sort(
        (a, b) => b!.successRate - a!.successRate
      )
      const sortedByLatency = [...comparisons].sort(
        (a, b) => a!.latency - b!.latency
      )

      console.log(
        `\n🏆 Best: ${sortedByLatency[0]!.id} (${(
          sortedBySuccess[0]!.successRate * 100
        ).toFixed(1)}% success, ${sortedByLatency[0]!.latency.toFixed(1)}ms)`
      )

      const worst =
        comparisons.find(c => c!.status === 'critical') ||
        sortedBySuccess[sortedBySuccess.length - 1]
      if (worst) {
        console.log(
          `🐌 Needs attention: ${worst.id} (${(worst.successRate * 100).toFixed(
            1
          )}% success, ${worst.latency.toFixed(1)}ms)`
        )
      }
    }
  },

  /**
   * Performance snapshot for debugging
   */
  snapshot: () => {
    return metrics.snapshot()
  },

  /**
   * Export system state for debugging
   */
  exportState: () => {
    const analysis = metrics.analyze()
    const allChannels = io.getAll()

    return {
      timestamp: Date.now(),
      channels: allChannels.map(ch => ({
        id: ch.id,
        type: ch.type,
        hasThrottle: !!ch.throttle,
        hasDebounce: !!ch.debounce,
        hasSchema: !!ch.schema,
        priority: ch.priority?.level
      })),
      metrics: analysis,
      systemHealth: analysis.health
    }
  },

  /**
   * Quick channel inspection
   */
  inspect: (channelId: string) => {
    const channel = io.get(channelId)
    if (!channel) {
      console.log(`❌ Channel '${channelId}' not found`)
      return null
    }

    console.log(`\n🔍 Channel Inspection: ${channelId}`)
    console.log('Configuration:')
    console.log(`  Type: ${channel.type || 'default'}`)
    console.log(`  Priority: ${channel.priority?.level || 'medium'}`)
    console.log(
      `  Protections: ${
        [
          channel.throttle ? 'throttle' : null,
          channel.debounce ? 'debounce' : null,
          channel.detectChanges ? 'change-detection' : null,
          channel.schema ? 'schema' : null
        ]
          .filter(Boolean)
          .join(', ') || 'none'
      }`
    )

    const analysis = metrics.analyzeChannel(channelId)
    if (analysis) {
      console.log('Performance:')
      console.log(`  Calls: ${analysis.metrics.calls}`)
      console.log(
        `  Success Rate: ${(analysis.metrics.successRate * 100).toFixed(1)}%`
      )
      console.log(
        `  Average Latency: ${analysis.metrics.averageLatency.toFixed(2)}ms`
      )
      console.log(`  Status: ${analysis.status.toUpperCase()}`)

      if (analysis.issues.length > 0) {
        console.log('Issues:')
        analysis.issues.forEach(issue => console.log(`  • ${issue}`))
      }
    }

    return {channel, analysis}
  },

  /**
   * System overview
   */
  overview: () => {
    const analysis = metrics.analyze()

    console.log('📋 CYRE SYSTEM OVERVIEW')
    console.log('='.repeat(30))
    console.log(
      `Health: ${analysis.health.overall.toUpperCase()} (${
        analysis.health.score
      }/100)`
    )
    console.log(`Channels: ${analysis.channels.length} total`)
    console.log(
      `  • Healthy: ${
        analysis.channels.filter(ch => ch.status === 'healthy').length
      }`
    )
    console.log(
      `  • Warning: ${
        analysis.channels.filter(ch => ch.status === 'warning').length
      }`
    )
    console.log(
      `  • Critical: ${
        analysis.channels.filter(ch => ch.status === 'critical').length
      }`
    )
    console.log(
      `  • Inactive: ${
        analysis.channels.filter(ch => ch.status === 'inactive').length
      }`
    )
    console.log(`Alerts: ${analysis.alerts.length}`)
    console.log(`Recommendations: ${analysis.recommendations.length}`)

    return analysis
  }
}
