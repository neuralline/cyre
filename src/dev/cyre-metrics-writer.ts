// src/dev/cyre-metrics-writer.ts
// Writes Cyre metrics to file for dashboard

import {writeMetricsSnapshot, cleanupMetrics} from './metrics-bridge'

/*

      C.Y.R.E - M.E.T.R.I.C.S - W.R.I.T.E.R
      
      Writes Cyre metrics to file for dashboard consumption:
      - Runs in same process as Cyre
      - Updates metrics file periodically
      - Integrates with Cyre lifecycle

*/

let updateTimer: NodeJS.Timeout | undefined
let isRunning = false

/**
 * Start metrics writer
 */
export const startMetricsWriter = async (
  updateInterval = 2000
): Promise<void> => {
  if (isRunning) {
    console.log('📊 Metrics writer already running')
    return
  }

  console.log('📊 Starting metrics writer for dashboard...')

  try {
    // Import metrics from same process
    const {metrics} = await import('../metrics/integration')

    isRunning = true

    // Write initial snapshot
    await writeSnapshot(metrics)

    // Start periodic updates
    updateTimer = setInterval(async () => {
      try {
        await writeSnapshot(metrics)
      } catch (error) {
        console.warn('📊 Failed to write metrics:', error)
      }
    }, updateInterval)

    console.log(`📊 Metrics writer started (${updateInterval}ms intervals)`)
  } catch (error) {
    console.error('📊 Failed to start metrics writer:', error)
    throw error
  }
}

/**
 * Stop metrics writer
 */
export const stopMetricsWriter = (): void => {
  if (!isRunning) {
    return
  }

  console.log('📊 Stopping metrics writer...')

  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = undefined
  }

  // Clean up metrics files
  cleanupMetrics()

  isRunning = false
  console.log('📊 Metrics writer stopped')
}

/**
 * Write current snapshot
 */
const writeSnapshot = async (metrics: any): Promise<void> => {
  try {
    const snapshot = {
      timestamp: Date.now(),
      systemAnalysis: metrics.analyze(60000),
      health: metrics.health(),
      performance: metrics.performance(),
      pipeline: metrics.pipeline(),
      systemMetrics: metrics.getSystemMetrics(),
      channelMetrics: metrics.getChannelMetrics(),
      events: metrics.getEvents({limit: 50})
    }

    writeMetricsSnapshot(snapshot)
  } catch (error) {
    console.warn('📊 Failed to create metrics snapshot:', error)
  }
}

/**
 * Get writer status
 */
export const getWriterStatus = () => {
  return {
    running: isRunning,
    hasTimer: updateTimer !== undefined
  }
}
