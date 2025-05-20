import {cyre} from '../src/app'
/*

    C.Y.R.E. - Q.U.A.N.T.U.M. S.U.R.G.E.
    Stress test for Cyre protection system

*/

interface TimingMetrics {
  fastCalls: number
  mediumCalls: number
  slowCalls: number
  totalLatency: number
  maxLatency: number
  minLatency: number
  missedDeadlines: number
  successfulCalls: number
}

const metrics: TimingMetrics = {
  fastCalls: 0,
  mediumCalls: 0,
  slowCalls: 0,
  totalLatency: 0,
  maxLatency: 0,
  minLatency: Infinity,
  missedDeadlines: 0,
  successfulCalls: 0
}

// Add interface for the payload
interface TimingPayload {
  timestamp: number
}

// Register timing test handlers
cyre.on([
  {
    id: 'timing-fast',
    fn: async (payload: unknown): Promise<void> => {
      const typedPayload = payload as TimingPayload
      const startTime = typedPayload.timestamp
      const processingTime = Math.random() * 5 // Simulate 0-5ms processing
      await new Promise(resolve => setTimeout(resolve, processingTime))

      const latency = Date.now() - startTime
      metrics.fastCalls++
      metrics.totalLatency += latency
      metrics.maxLatency = Math.max(metrics.maxLatency, latency)
      metrics.minLatency = Math.min(metrics.minLatency, latency)

      if (latency > 16.67) {
        // 60fps threshold
        metrics.missedDeadlines++
      } else {
        metrics.successfulCalls++
      }
    }
  },
  {
    id: 'timing-medium',
    fn: async (payload: unknown): Promise<void> => {
      const typedPayload = payload as TimingPayload
      const startTime = typedPayload.timestamp
      const processingTime = 50 + Math.random() * 50 // 50-100ms processing
      await new Promise(resolve => setTimeout(resolve, processingTime))

      const latency = Date.now() - startTime
      metrics.mediumCalls++
      metrics.totalLatency += latency
      metrics.maxLatency = Math.max(metrics.maxLatency, latency)
      metrics.minLatency = Math.min(metrics.minLatency, latency)

      if (latency > 100) {
        // UI update threshold
        metrics.missedDeadlines++
      } else {
        metrics.successfulCalls++
      }
    }
  },
  {
    id: 'timing-slow',
    fn: async (payload: unknown): Promise<void> => {
      const typedPayload = payload as TimingPayload
      const startTime = typedPayload.timestamp
      const processingTime = 200 + Math.random() * 300 // 200-500ms processing
      await new Promise(resolve => setTimeout(resolve, processingTime))

      const latency = Date.now() - startTime
      metrics.slowCalls++
      metrics.totalLatency += latency
      metrics.maxLatency = Math.max(metrics.maxLatency, latency)
      metrics.minLatency = Math.min(metrics.minLatency, latency)

      if (latency > 500) {
        // Background task threshold
        metrics.missedDeadlines++
      } else {
        metrics.successfulCalls++
      }
    }
  }
])

// Register timing actions with different priorities
cyre.action([
  {
    id: 'timing-fast',
    type: 'timing-fast',
    priority: {level: 'high'},
    throttle: 16 // 60fps
  },
  {
    id: 'timing-medium',
    type: 'timing-medium',
    priority: {level: 'medium'},
    throttle: 100 // UI updates
  },
  {
    id: 'timing-slow',
    type: 'timing-slow',
    priority: {level: 'low'},
    throttle: 500 // Background tasks
  }
])

// Add initial logging
log.info({message: 'Starting timing surge test...'})

// Modify the monitor interval to show immediate feedback
const startTime = Date.now()
log.info({
  message: 'Test started',
  timestamp: new Date(startTime).toISOString()
})

const monitor = setInterval(() => {
  const runTime = (Date.now() - startTime) / 1000
  const breathingState = cyre.getBreathingState()

  // Only log if we have some data
  if (metrics.fastCalls + metrics.mediumCalls + metrics.slowCalls > 0) {
    log.info({
      timestamp: Date.now(),
      runtime: `${runTime.toFixed(1)}s`,
      metrics: {
        ...metrics,
        averageLatency:
          metrics.totalLatency /
          (metrics.fastCalls + metrics.mediumCalls + metrics.slowCalls),
        successRate:
          (
            (metrics.successfulCalls /
              (metrics.successfulCalls + metrics.missedDeadlines)) *
            100
          ).toFixed(1) + '%',
        callCounts: {
          fast: metrics.fastCalls,
          medium: metrics.mediumCalls,
          slow: metrics.slowCalls
        }
      },
      breathing: {
        pattern: breathingState.pattern,
        stress: (breathingState.stress * 100).toFixed(1) + '%',
        recuperating: breathingState.isRecuperating
      }
    })
  }

  // Modify test completion conditions
  if (runTime > 30 || metrics.missedDeadlines > 1000) {
    clearInterval(monitor)
    log.info({message: 'Timing test complete', status: 'success'})
    log.info({
      message: 'Final metrics',
      metrics: {
        totalCalls: metrics.fastCalls + metrics.mediumCalls + metrics.slowCalls,
        missedDeadlines: metrics.missedDeadlines,
        successRate:
          (
            (metrics.successfulCalls /
              (metrics.successfulCalls + metrics.missedDeadlines)) *
            100
          ).toFixed(1) + '%',
        averageLatency:
          (
            metrics.totalLatency /
            (metrics.fastCalls + metrics.mediumCalls + metrics.slowCalls)
          ).toFixed(2) + 'ms'
      }
    })

    // Add a small delay before shutdown to ensure logs are printed
    setTimeout(() => {
      cyre.shutdown()
      process.exit(0)
    }, 1000)
  }
}, 1000)

// Modify the load generator to handle shutdown
let isRunning = true
const generateLoad = async () => {
  while (isRunning) {
    try {
      const choice = Math.random()

      if (choice < 0.6) {
        await cyre.call('timing-fast', {timestamp: Date.now()})
      } else if (choice < 0.9) {
        await cyre.call('timing-medium', {timestamp: Date.now()})
      } else {
        await cyre.call('timing-slow', {timestamp: Date.now()})
      }

      await new Promise(resolve => setTimeout(resolve, Math.random() * 50))
    } catch (error) {
      if (isRunning) {
        log.error({message: `Load generation error: ${String(error)}`})
      }
      break
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  isRunning = false
  log.info('Shutting down...')
  clearInterval(monitor)
  cyre.shutdown()
  process.exit(0)
})

// Start the test
generateLoad().catch(error => {
  log.error({message: `Load generation error: ${String(error)}`})
  isRunning = false
  cyre.shutdown()
  process.exit(1)
})
