// src/dev/auto-metrics.ts
// Auto-start metrics server in development mode

import {startMetricsServer, stopMetricsServer} from './metrics-server'
import type {MetricsServerConfig} from './server-types'

/*

      C.Y.R.E - A.U.T.O - M.E.T.R.I.C.S
      
      Auto-start metrics server in development:
      - Detects development environment
      - Starts metrics server automatically
      - Integrates with Cyre lifecycle
      - Zero configuration required

*/

let autoStarted = false
let shutdownRegistered = false

/**
 * Check if we're in development mode
 */
const isDevelopmentMode = (): boolean => {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.CYRE_DEV === 'true' ||
    process.env.CYRE_METRICS_AUTO === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test')
  )
}

/**
 * Auto-start metrics server if conditions are met
 */
export const maybeStartMetricsServer = async (
  config: Partial<MetricsServerConfig> = {}
): Promise<boolean> => {
  // Skip if already started
  if (autoStarted) {
    return true
  }

  // Skip if not in development mode
  if (!isDevelopmentMode()) {
    return false
  }

  // Skip if explicitly disabled
  if (process.env.CYRE_METRICS_DISABLE === 'true') {
    return false
  }

  try {
    console.log('🔧 Development mode detected, starting metrics server...')

    const devConfig = {
      port: 3001,
      updateInterval: 1000,
      ...config
    }

    await startMetricsServer(devConfig)
    autoStarted = true

    // Register shutdown handler once
    if (!shutdownRegistered) {
      registerShutdownHandler()
      shutdownRegistered = true
    }

    return true
  } catch (error) {
    console.warn('⚠️ Failed to auto-start metrics server:', error)
    return false
  }
}

/**
 * Stop auto-started metrics server
 */
export const stopAutoMetricsServer = async (): Promise<boolean> => {
  if (!autoStarted) {
    return false
  }

  try {
    await stopMetricsServer()
    autoStarted = false
    return true
  } catch (error) {
    console.warn('⚠️ Failed to stop auto-started metrics server:', error)
    return false
  }
}

/**
 * Register graceful shutdown handler
 */
const registerShutdownHandler = (): void => {
  const shutdown = async (signal: string) => {
    if (autoStarted) {
      console.log(
        `\n🔧 ${signal} received, stopping auto-started metrics server...`
      )
      try {
        await stopAutoMetricsServer()
      } catch (error) {
        console.warn('Auto-metrics shutdown error:', error)
      }
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGUSR2', () => shutdown('SIGUSR2'))

  // Handle process exit
  process.on('beforeExit', () => {
    if (autoStarted) {
      console.log('🔧 Process exiting, stopping metrics server...')
      stopAutoMetricsServer().catch(() => {})
    }
  })
}

/**
 * Get auto-start status
 */
export const getAutoMetricsStatus = () => ({
  autoStarted,
  shutdownRegistered,
  isDevelopmentMode: isDevelopmentMode(),
  disabled: process.env.CYRE_METRICS_DISABLE === 'true'
})

/**
 * Manual trigger for auto-start (for testing)
 */
export const forceStartAutoMetrics = async (
  config?: Partial<MetricsServerConfig>
): Promise<boolean> => {
  // Temporarily enable development mode
  const originalEnv = process.env.CYRE_DEV
  process.env.CYRE_DEV = 'true'

  try {
    const result = await maybeStartMetricsServer(config)
    return result
  } finally {
    // Restore original environment
    if (originalEnv === undefined) {
      delete process.env.CYRE_DEV
    } else {
      process.env.CYRE_DEV = originalEnv
    }
  }
}
