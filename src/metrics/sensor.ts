// src/metrics/sensor.ts

import {metricsCore, type MetricEvent} from './core'
import {LogLevel} from '../components/cyre-log'
import type {ActionId, Priority} from '../types/core'

/*

      C.Y.R.E - S.E.N.S.O.R 
      
      World's best sensor system:
      - Unified metrics collection and logging
      - Separate event types from log levels
      - Terminal output control via log option
      - Comprehensive sensor interface
      - No duplicate logging systems

*/

// Sensor-specific interfaces
export interface SensorOptions {}

export interface SensorEvent {
  actionId: ActionId

  eventType: MetricEvent

  message?: string
  /** Send to terminal via cyre-log */
  log?: boolean
  /** Log level for terminal output */
  logLevel?: LogLevel
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Location/context information */
  location?: string
  /** Priority level */
  priority?: Priority
}

/**
 * Unified sensor interface - metrics collection + logging
 */
export const sensor = {
  /**
   * Core sensor method - records metrics and optionally logs to terminal
   */

  success: (action: SensorEvent): void => {
    metricsCore.record({...action, logLevel: LogLevel.SUCCESS})
  },

  // Error Events
  error: (action: SensorEvent): void => {
    metricsCore.record({...action, logLevel: LogLevel.ERROR})
  }, // Error Events
  fail: (action: SensorEvent): void => {
    metricsCore.record({...action, logLevel: LogLevel.ERROR})
  },

  critical: (action: SensorEvent): void => {
    metricsCore.record({...action, logLevel: LogLevel.CRITICAL})
  },

  warning: (action: SensorEvent): void => {
    metricsCore.record({...action, logLevel: LogLevel.WARN})
  },

  // Information Events
  info: (action: SensorEvent): void => {
    metricsCore.record({...action, logLevel: LogLevel.INFO})
  },

  debug: (action: SensorEvent): void => {
    metricsCore.record({...action, logLevel: LogLevel.DEBUG})
  },

  // System Events
  sys: (action: SensorEvent): void => {
    metricsCore.record({...action, logLevel: LogLevel.SYS})
  },

  log: (action: SensorEvent): void => {
    metricsCore.record({...action})
  }
}
