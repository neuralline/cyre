// example/quantum-surge.ts

import {cyre, log} from '../src/'
import type {CyreResponse} from '../src/types/core'

/*
 * C.Y.R.E. - Q.U.A.N.T.U.M. S.U.R.G.E.
 * Advanced stress test for quantum protection system
 */

interface SurgeMetrics {
  messageCount: number
  surgeCount: number
  chainDepth: number
  errors: number
  throttled: number
  recovered: number
}

const metrics: SurgeMetrics = {
  messageCount: 0,
  surgeCount: 0,
  chainDepth: 0,
  errors: 0,
  throttled: 0,
  recovered: 0
}

// Create surge patterns with varying intensities
cyre.on([
  {
    id: 'quantum-initiator',
    handler: payload => {
      // Create multiple surge patterns
      const patterns = [
        {count: 50, delay: 0}, // Immediate burst
        {count: 30, delay: 100}, // Delayed burst
        {count: 20, delay: 500} // Scattered burst
      ]

      patterns.forEach(async pattern => {
        await new Promise(resolve => setTimeout(resolve, pattern.delay))
        for (let i = 0; i < pattern.count; i++) {
          metrics.messageCount++
          try {
            const response = await cyre.call('quantum-amplifier', {
              id: `${metrics.messageCount}-${pattern.delay}`,
              thread: i,
              depth: 0,
              pattern: pattern.delay,
              timestamp: Date.now()
            })

            if (!response.ok) {
              metrics.throttled++
            }
          } catch (error) {
            metrics.errors++
          }
        }
      })
    }
  },
  {
    id: 'quantum-amplifier',
    handler: async payload => {
      metrics.surgeCount++
      metrics.chainDepth = Math.max(metrics.chainDepth, payload.depth)

      // Create dynamic chain reactions
      if (payload.depth < 3) {
        const branchCount = Math.max(1, 4 - payload.depth) // Decreasing branches
        const promises: Promise<CyreResponse>[] = []

        for (let i = 0; i < branchCount; i++) {
          promises.push(
            cyre.call('quantum-amplifier', {
              id: `${payload.id}-${i}`,
              thread: payload.thread,
              depth: payload.depth + 1,
              pattern: payload.pattern,
              timestamp: payload.timestamp
            })
          )
        }

        // Parallel execution with error handling
        const results = await Promise.allSettled(promises)
        results.forEach(result => {
          if (result.status === 'rejected') metrics.errors++
          if (result.status === 'fulfilled' && !result.value.ok)
            metrics.throttled++
        })
      }

      // Monitor system health
      const breathingState = cyre.getMetrics()
      if (breathingState.available) {
        metrics.recovered++
      }

      // Trigger reactor for metrics
      await cyre.call('quantum-reactor', {
        ...payload,
        processTime: Date.now()
      })
    }
  },
  {
    id: 'quantum-reactor',
    handler: payload => {
      const totalDelay = Date.now() - payload.timestamp
      const processDelay = Date.now() - payload.processTime

      if (totalDelay > 1000) {
        // Log only significant delays
        log.warn(
          `High latency detected [ID: ${payload.id}] ` +
            `Total: ${totalDelay}ms, Process: ${processDelay}ms`
        )
      }
    }
  }
])

// Register actions with varying protection levels
cyre.action([
  {
    id: 'quantum-initiator',
    type: 'quantum-initiator',
    priority: {level: 'high'},
    payload: {start: true},
    interval: 2000 // Regular pulses
  },
  {
    id: 'quantum-amplifier',
    type: 'quantum-amplifier',
    priority: {level: 'medium'},
    throttle: 50 // Aggressive throttling
  },
  {
    id: 'quantum-reactor',
    type: 'quantum-reactor',
    priority: {level: 'low'},
    debounce: 200
  }
])

// Enhanced monitoring with detailed metrics
const startTime = Date.now()
const monitor = setInterval(() => {
  const runTime = (Date.now() - startTime) / 1000
  const breathingState = cyre.getMetrics()

  log.debug({
    timestamp: Date.now(),
    runtime: `${runTime.toFixed(1)}s`,
    metrics: {
      ...metrics,
      messagesPerSecond: (metrics.messageCount / runTime).toFixed(1),
      surgesPerSecond: (metrics.surgeCount / runTime).toFixed(1),
      errorRate:
        ((metrics.errors / metrics.messageCount) * 100).toFixed(1) + '%',
      throttleRate:
        ((metrics.throttled / metrics.messageCount) * 100).toFixed(1) + '%',
      recoveryRate:
        ((metrics.recovered / metrics.surgeCount) * 100).toFixed(1) + '%'
    },
    breathing: {
      pattern: breathingState.pattern,
      stress: (breathingState.stress * 100).toFixed(1) + '%',
      recuperating: breathingState.isRecuperating
    }
  })

  // Test completion conditions
  if (
    runTime > 30 || // Longer test duration
    metrics.messageCount > 10000 ||
    metrics.errors > 1000
  ) {
    clearInterval(monitor)
    cyre.shutdown()
    log.success(
      `Quantum surge test complete - Final metrics: ${JSON.stringify(metrics)}`
    )
  }
}, 1000)

// Start the cascade
cyre.call('quantum-initiator')
