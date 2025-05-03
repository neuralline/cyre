import {cyre, CyreLog} from '../src/app'

interface BurstMetrics {
  burstCalls: number
  concurrentCalls: number
  maxConcurrent: number
  responseTime: number[]
  errors: number
  throttled: number
  overflowCount: number
  recoveryTime: number[]
}

interface BurstHandlerPayload {
  intensity: number
  depth: number
  cascade: boolean
  timestamp: number
}

interface BurstCascadePayload {
  intensity: number
  depth: number
  cascade: boolean
}

const metrics: BurstMetrics = {
  burstCalls: 0,
  concurrentCalls: 0,
  maxConcurrent: 0,
  responseTime: [],
  errors: 0,
  throttled: 0,
  overflowCount: 0,
  recoveryTime: []
}

// Register burst handlers
cyre.on([
  {
    id: 'burst-handler',
    fn: async (payload: BurstHandlerPayload) => {
      metrics.concurrentCalls++
      metrics.maxConcurrent = Math.max(
        metrics.maxConcurrent,
        metrics.concurrentCalls
      )

      const startTime = Date.now()

      try {
        // Simulate varying processing loads
        const processingTime = payload.intensity * Math.random() * 100
        await new Promise(resolve => setTimeout(resolve, processingTime))

        metrics.responseTime.push(Date.now() - startTime)
        metrics.burstCalls++

        // Test cascade effect
        if (payload.cascade && payload.depth < 3) {
          await Promise.all([
            cyre.call('burst-cascade', {
              intensity: payload.intensity * 0.8,
              depth: payload.depth + 1,
              cascade: true
            }),
            cyre.call('burst-cascade', {
              intensity: payload.intensity * 0.6,
              depth: payload.depth + 1,
              cascade: true
            })
          ])
        }
      } catch (error) {
        metrics.errors++
      } finally {
        metrics.concurrentCalls--
      }
    }
  },
  {
    id: 'burst-cascade',
    fn: async (payload: BurstCascadePayload) => {
      const startTime = Date.now()
      await new Promise(resolve => setTimeout(resolve, payload.intensity * 50))
      metrics.responseTime.push(Date.now() - startTime)
    }
  }
])

// Register actions with protection settings
cyre.action([
  {
    id: 'burst-handler',
    type: 'burst-handler',
    priority: {level: 'high'},
    throttle: 50
  },
  {
    id: 'burst-cascade',
    type: 'burst-cascade',
    priority: {level: 'medium'},
    throttle: 100
  }
])

// Monitor system metrics
const startTime = Date.now()
const monitor = setInterval(() => {
  const runTime = (Date.now() - startTime) / 1000
  const breathingState = cyre.getBreathingState()

  const avgResponse =
    metrics.responseTime.length > 0
      ? metrics.responseTime.reduce((a, b) => a + b) /
        metrics.responseTime.length
      : 0

  CyreLog.debug({
    timestamp: Date.now(),
    runtime: `${runTime.toFixed(1)}s`,
    metrics: {
      ...metrics,
      averageResponse: avgResponse.toFixed(2) + 'ms',
      currentLoad: metrics.concurrentCalls,
      throughput: (metrics.burstCalls / runTime).toFixed(1) + '/s'
    },
    breathing: {
      pattern: breathingState.pattern,
      stress: (breathingState.stress * 100).toFixed(1) + '%',
      recuperating: breathingState.isRecuperating
    }
  })

  // Test completion check
  if (runTime > 30 || metrics.errors > 100) {
    clearInterval(monitor)
    cyre.shutdown()
    CyreLog.success('Burst test complete')
    CyreLog.debug({finalMetrics: metrics})
  }
}, 1000)

// Generate burst patterns
const generateBursts = async () => {
  while (true) {
    try {
      // Random burst size (10-50 calls)
      const burstSize = 10 + Math.floor(Math.random() * 40)

      // Generate burst
      const burst = Array(burstSize)
        .fill(null)
        .map(() =>
          cyre.call('burst-handler', {
            timestamp: Date.now(),
            intensity: Math.random(),
            depth: 0,
            cascade: Math.random() > 0.7 // 30% chance of cascade
          })
        )

      await Promise.all(burst)

      // Random delay between bursts (0.5-2 seconds)
      await new Promise(resolve =>
        setTimeout(resolve, 500 + Math.random() * 1500)
      )
    } catch (error) {
      metrics.errors++
    }
  }
}

// Start burst test
generateBursts().catch(error => {
  CyreLog.error('Burst generation error:', error)
  cyre.shutdown()
})
