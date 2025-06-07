// src/http/integration.ts - UPDATED
// HTTP server integration with proper Cyre shutdown handling

import {httpServer} from './server'
import {sensor} from '../context/metrics-report'

/*

      C.Y.R.E - H.T.T.P - I.N.T.E.G.R.A.T.I.O.N - F.I.X.E.D
      
      FIXED: HTTP server integration with proper shutdown lifecycle:
      - Integrates with Cyre's existing shutdown process
      - Graceful WebSocket disconnection
      - Proper cleanup of timers and connections
      - No hanging processes

*/

interface HttpConfig {
  enabled: boolean
  port?: number
  host?: string
  autoStart?: boolean
  webSocket?: boolean
}

const defaultHttpConfig: HttpConfig = {
  enabled: false,
  port: 3001,
  host: '0.0.0.0',
  autoStart: false,
  webSocket: true
}

let httpConfig: HttpConfig = defaultHttpConfig
let isInitialized = false
let shutdownCallbacks: Array<() => Promise<void>> = []

/**
 * Register shutdown callback with Cyre's shutdown process
 */
const registerShutdownCallback = (callback: () => Promise<void>): void => {
  shutdownCallbacks.push(callback)
}

/**
 * Initialize HTTP server integration
 */
const initializeHttp = (config: Partial<HttpConfig> = {}): void => {
  if (isInitialized) {
    sensor.warn('HTTP integration already initialized')
    return
  }

  httpConfig = {...defaultHttpConfig, ...config}
  isInitialized = true

  sensor.info('HTTP integration initialized', 'HTTP Integration', httpConfig)

  // Auto-start if enabled
  if (httpConfig.enabled && httpConfig.autoStart) {
    startHttpServer()
  }
}

/**
 * Start HTTP server with current config
 */
const startHttpServer = async (): Promise<void> => {
  if (!httpConfig.enabled) {
    sensor.warn('HTTP server disabled in config')
    return
  }

  try {
    await httpServer.start({
      port: httpConfig.port,
      host: httpConfig.host,
      enableWebSocket: httpConfig.webSocket
    })
    sensor.info('HTTP server started successfully')
  } catch (error) {
    sensor.error('Failed to start HTTP server', error, 'HTTP Integration')
    throw error
  }
}

/**
 * Stop HTTP server gracefully
 */
const stopHttpServer = async (): Promise<void> => {
  try {
    sensor.info('Stopping HTTP server...', 'HTTP Integration')
    await httpServer.stop()
    sensor.info('HTTP server stopped successfully')
  } catch (error) {
    sensor.error('Failed to stop HTTP server', error, 'HTTP Integration')
  }
}

/**
 * CYRE SHUTDOWN INTEGRATION
 * This function will be called by Cyre's shutdown process
 */
const cyreShutdownHandler = async (): Promise<void> => {
  sensor.info('HTTP integration shutdown initiated by Cyre')

  // Execute all shutdown callbacks
  for (const callback of shutdownCallbacks) {
    try {
      await callback()
    } catch (error) {
      sensor.error('Shutdown callback failed', error, 'HTTP Integration')
    }
  }

  // Stop HTTP server
  await stopHttpServer()

  sensor.info('HTTP integration shutdown complete')
}

/**
 * Get HTTP integration status
 */
const getHttpStatus = () => {
  return {
    initialized: isInitialized,
    config: httpConfig,
    server: httpServer.status()
  }
}

/**
 * Update HTTP configuration
 */
const updateHttpConfig = (newConfig: Partial<HttpConfig>): void => {
  const oldConfig = {...httpConfig}
  httpConfig = {...httpConfig, ...newConfig}

  sensor.info('HTTP config updated', 'HTTP Integration', {
    old: oldConfig,
    new: httpConfig
  })

  // Restart server if running and config changed
  if (httpServer.status().running) {
    sensor.info('Restarting HTTP server with new config')
    stopHttpServer().then(() => {
      if (httpConfig.enabled) {
        startHttpServer()
      }
    })
  }
}

// Public API for app.ts integration
export const http = {
  initialize: initializeHttp,
  start: startHttpServer,
  stop: stopHttpServer,
  status: getHttpStatus,
  config: updateHttpConfig,
  broadcast: httpServer.broadcast,

  // IMPORTANT: Shutdown integration for Cyre
  shutdown: cyreShutdownHandler,
  registerShutdownCallback
}
