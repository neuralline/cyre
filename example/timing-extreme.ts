import {cyre} from '../src/app'

interface ExtremeMetrics {
  burstCalls: number
  concurrentCalls: number
  maxConcurrent: number
  responseTime: number[]
  errors: number
  throttled: number
  overflowCount: number
  memoryUsage: {heapUsed: number; heapTotal: number}[]
  gcPauses: number
  longPauses: number // >100ms pauses
}

interface ExtremeBurstPayload {
  timestamp: number
  intensity: number
  dataSize: number
  retain: boolean
}

const metrics: ExtremeMetrics = {
  burstCalls: 0,
  concurrentCalls: 0,
  maxConcurrent: 0,
  responseTime: [],
  errors: 0,
  throttled: 0,
  overflowCount: 0,
  memoryUsage: [],
  gcPauses: 0,
  longPauses: 0
}

// Register extreme burst handlers
cyre.on([
  {
    id: 'extreme-burst',
    fn: async (payload: ExtremeBurstPayload) => {
      metrics.concurrentCalls++
      metrics.maxConcurrent = Math.max(
        metrics.maxConcurrent,
        metrics.concurrentCalls
      )

      const startTime = Date.now()
      const data = new Array(payload.dataSize).fill('X') // Simulate memory allocation

      try {
        // Simulate intensive processing
        const processingTime = payload.intensity * Math.random() * 200 // Double processing time
        await new Promise(resolve => setTimeout(resolve, processingTime))

        // Force memory retention for testing
        if (payload.retain) {
          global.retainedData = global.retainedData || []
          global.retainedData.push(data.slice(0, 100))
        }

        const responseTime = Date.now() - startTime
        metrics.responseTime.push(responseTime)
        metrics.burstCalls++

        if (responseTime > 100) {
          metrics.longPauses++
        }
      } catch (error) {
        metrics.errors++
      } finally {
        metrics.concurrentCalls--
      }
    }
  }
])

// Register action with aggressive settings
cyre.action([
  {
    id: 'extreme-burst',
    type: 'extreme-burst',
    priority: {level: 'critical'},
    throttle: 10 // Aggressive throttling threshold
  }
])

// Enhanced monitoring with memory tracking
const startTime = Date.now()
const monitor = setInterval(() => {
  const runTime = (Date.now() - startTime) / 1000
  const breathingState = cyre.getBreathingState()
  const memoryUsage = process.memoryUsage()

  metrics.memoryUsage.push({
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal
  })

  const avgResponse =
    metrics.responseTime.length > 0
      ? metrics.responseTime.reduce((a, b) => a + b) /
        metrics.responseTime.length
      : 0

  const memoryTrend =
    metrics.memoryUsage.length > 1
      ? (
          (metrics.memoryUsage[metrics.memoryUsage.length - 1].heapUsed -
            metrics.memoryUsage[0].heapUsed) /
          (1024 * 1024)
        ).toFixed(2) + ' MB'
      : '0 MB'

  log.debug({
    timestamp: Date.now(),
    runtime: `${runTime.toFixed(1)}s`,
    metrics: {
      ...metrics,
      averageResponse: avgResponse.toFixed(2) + 'ms',
      currentLoad: metrics.concurrentCalls,
      throughput: (metrics.burstCalls / runTime).toFixed(1) + '/s',
      memoryTrend,
      heapUsed: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(2) + ' MB',
      heapTotal: (memoryUsage.heapTotal / (1024 * 1024)).toFixed(2) + ' MB'
    },
    breathing: {
      pattern: breathingState.pattern,
      stress: (breathingState.stress * 100).toFixed(1) + '%',
      recuperating: breathingState.isRecuperating
    }
  })

  // Extended test duration and completion conditions
  if (
    runTime > 120 || // 2 minutes
    metrics.errors > 1000 ||
    metrics.longPauses > 100 ||
    memoryUsage.heapUsed > 1024 * 1024 * 1024
  ) {
    // 1GB limit
    clearInterval(monitor)
    cyre.shutdown()
    log.success(
      `Extreme burst test complete - Final Metrics: ${JSON.stringify({
        finalMetrics: metrics,
        memoryLeak: memoryTrend
      })}`
    )
  }
}, 1000)

// Generate extreme burst patterns
const generateExtremeBursts = async () => {
  while (true) {
    try {
      // Larger burst sizes (50-200 calls)
      const burstSize = 50 + Math.floor(Math.random() * 150)

      // Generate intense burst
      const burst = Array(burstSize)
        .fill(null)
        .map(() =>
          cyre.call('extreme-burst', {
            timestamp: Date.now(),
            intensity: Math.random() * 2, // Double intensity
            dataSize: 1000 + Math.floor(Math.random() * 9000), // 1-10KB data
            retain: Math.random() > 0.9 // 10% chance to retain data
          })
        )

      await Promise.all(burst)

      // Shorter delays between bursts (0.1-1 second)
      await new Promise(resolve =>
        setTimeout(resolve, 100 + Math.random() * 900)
      )
    } catch (error) {
      metrics.errors++
    }
  }
}

// Start extreme burst test
generateExtremeBursts().catch(error => {
  log.error('Extreme burst generation error:', error)
  cyre.shutdown()
})

// Cleanup retained data periodically
setInterval(() => {
  if (global.retainedData && global.retainedData.length > 1000) {
    global.retainedData = global.retainedData.slice(-100)
  }
}, 5000)
