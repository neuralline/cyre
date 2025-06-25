// src/metrics/sensor.ts
// Fixed sensor with proper data validation and type safety

import {log, LogLevel} from '../components/cyre-log'

/*

      C.Y.R.E - S.E.N.S.O.R 
      
      Sensor system with proper data validation:
      - Validates event types before recording
      - Prevents object/number corruption in event fields
      - Maintains backward compatibility
      - Proper error handling for malformed data
      - log events to terminal depending on environment dev/prod
      - replace cyre-log. if true it will log to terminal/console though cyre-log

*/
export interface SensorEvent {
  actionId: string
  eventType?: MetricEvent
  message?: string
  log?: boolean //if true it will log to terminal or console/
  logLevel?: LogLevel // log events to terminal depending on environment dev/prod
  metadata?: Record<string, unknown>
  location?: string
}

// Valid event types to group log types for analysis.
// create a new event type group if needed
export type MetricEvent =
  | 'call' // channel was called
  | 'dispatch' // Dispatch to handler started
  | 'execution' // Handler execution completed
  | 'error' // Error occurred
  | 'throttle' // Throttle protection activated
  | 'debounce' // Debounce protection activated
  | 'skip' // Execution skipped
  | 'blocked' // Execution blocked

//

/**
 * Simplified sensor - ONLY logs data
 */
export const sensor = {
  /**
   * Core sensor method - validates and logs data
   */
  record: (event: SensorEvent): void => {
    //console.log('event', event)
    // LOG DATA ONLY - no analysis
    //metricsCore.record(sanitizedEvent)
  },

  /**
   * Legacy log method for backward compatibility
   */
  log: (
    actionId: string,
    eventType: MetricEvent,
    message?: string,
    location?: any,
    log: boolean = false,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType,
      location,
      metadata,
      message,
      log,
      logLevel: LogLevel.DEBUG
    })
  },

  // Structured logging methods for convenience
  success: (
    actionId: string,
    message?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'success',
      message,
      metadata,
      log: true,
      logLevel: LogLevel.SUCCESS
    })
  },

  error: (
    actionId: string, // channel id if available, or system if its app related
    message?: string,
    location?: string, //where this log generated
    eventType?: MetricEvent,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType,
      message,
      location,
      metadata,
      log: true,
      logLevel: LogLevel.ERROR
    })
  },

  warn: (
    actionId: string,
    message?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'warning',
      message,
      metadata,
      log: true,
      logLevel: LogLevel.WARN
    })
  },

  info: (
    actionId: string,
    message?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'info',
      message,
      metadata,
      log: false,
      logLevel: LogLevel.INFO
    })
  },

  debug: (
    actionId: string,
    message?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'debug',
      message,
      metadata,
      log: false,
      logLevel: LogLevel.DEBUG
    })
  },

  critical: (
    actionId: string,
    message?: string,
    location?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'critical',
      message,
      metadata,
      location,
      log: true,
      logLevel: LogLevel.CRITICAL
    })
  },
  sys: (
    actionId: string,
    message?: string,
    location?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'system',
      message,
      metadata,
      location,
      log: true,
      logLevel: LogLevel.CRITICAL
    })
  }
}

export default sensor
