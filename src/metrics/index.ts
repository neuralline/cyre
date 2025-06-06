// src/metrics/index.ts
// Unified metrics system export

import {metrics} from './integration'

export {metrics} from './integration'
export {sensor} from './sensor'
export {metricsCore} from './core'
export {analyzer} from './analyzer'

export type {
  SystemAnalysis,
  ChannelAnalysis,
  HealthStatus,
  Alert
} from './analyzer'

/*

      C.Y.R.E - M.E.T.R.I.C.S - U.N.I.F.I.E.D
      
      Single export point for all metrics functionality:
      - Core metrics collection
      - Analysis and reporting
      - Sensor interface
      - Legacy compatibility

*/

// Default configuration for the metrics system
const DEFAULT_METRICS_CONFIG = {
  maxEvents: 1000,
  retentionTime: 3600000, // 1 hour
  cleanupInterval: 300000 // 5 minutes
}

/**
 * Initialize the metrics system with default configuration
 */
export const initializeMetrics = (config = DEFAULT_METRICS_CONFIG) => {
  metrics.initialize(config)
}

/**
 * Shutdown the metrics system
 */
export const shutdownMetrics = () => {
  metrics.shutdown()
}
