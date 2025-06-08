// src/metrics/sensor.ts
// Fixed sensor with proper data validation and type safety

import {metricsCore} from './core'
import {log, LogLevel} from '../components/cyre-log'
import type {ActionId, Priority} from '../types/core'
import {MetricEvent} from '../types/system'

/*

      C.Y.R.E - S.E.N.S.O.R 
      
      Fixed sensor system with proper data validation:
      - Validates event types before recording
      - Prevents object/number corruption in event fields
      - Maintains backward compatibility
      - Proper error handling for malformed data
      - log events to terminal depending on environment dev/prod
      - replace cyre-log. if true it will log to terminal/console though cyre-log

*/
export interface SensorEvent {
  actionId: ActionId
  eventType: MetricEvent
  message?: string
  log?: boolean //if true it will log to terminal or console/ also
  logLevel?: LogLevel // log events to terminal depending on environment dev/prod
  metadata?: Record<string, unknown>
  location?: string
  priority?: Priority
}

// Valid event types to prevent data corruption
const VALID_EVENT_TYPES: Set<MetricEvent> = new Set([
  'call',
  'execution',
  'dispatch',
  'error',
  'success',
  'warning',
  'info',
  'debug',
  'critical',
  'throttle',
  'debounce',
  'blocked',
  'skip'
])

/**
 * Validate and sanitize sensor event data
 */
const validateAndSanitize = (event: any): SensorEvent | null => {
  // Validate actionId
  if (!event.actionId || typeof event.actionId !== 'string') {
    console.error('Invalid sensor event: actionId must be a string', event)
    return null
  }

  // Validate and sanitize eventType
  let eventType: MetricEvent
  if (
    typeof event.eventType === 'string' &&
    VALID_EVENT_TYPES.has(event.eventType as MetricEvent)
  ) {
    eventType = event.eventType as MetricEvent
  } else if (typeof event.eventType === 'number') {
    // Legacy: number was passed as eventType (likely execution duration)
    eventType = 'execution'
    if (!event.metadata) event.metadata = {}
    event.metadata.duration = event.eventType
  } else if (typeof event.eventType === 'object') {
    // Legacy: object was passed as eventType (likely metadata)
    eventType = 'info'
    if (!event.metadata) event.metadata = {}
    event.metadata = {...event.metadata, ...event.eventType}
  } else {
    console.error('Invalid sensor event: eventType must be valid string', event)
    return null
  }

  // Sanitize location field
  let location: string | undefined
  if (event.location === undefined || event.location === null) {
    location = undefined
  } else if (typeof event.location === 'string') {
    location = event.location
  } else if (typeof event.location === 'object') {
    // Object was passed as location - move to metadata
    if (!event.metadata) event.metadata = {}
    event.metadata.locationData = event.location
    location = 'metadata-relocated'
  } else {
    location = String(event.location)
  }

  // Ensure metadata is object or undefined
  const metadata =
    event.metadata && typeof event.metadata === 'object'
      ? event.metadata
      : undefined

  // Sanitize message
  const message = typeof event.message === 'string' ? event.message : undefined

  return {
    actionId: event.actionId,
    eventType,
    message,
    log: Boolean(event.log),
    logLevel: event.logLevel || LogLevel.DEBUG,
    metadata,
    location,
    priority: event.priority
  }
}

/**
 * Simplified sensor - ONLY logs data
 */
export const sensor = {
  /**
   * Core sensor method - validates and logs data
   */
  record: (event: SensorEvent): void => {
    const sanitizedEvent = validateAndSanitize(event)
    if (!sanitizedEvent) {
      return // Skip invalid events
    }

    // LOG DATA ONLY - no analysis
    metricsCore.record(sanitizedEvent)
  },

  /**
   * Legacy log method for backward compatibility
   */
  log: (
    actionId: ActionId,
    eventType: MetricEvent,
    message?: string,
    location?: any,
    log: boolean = false,
    metadata?: Record<string, unknown>,
    priority?: Priority
  ): void => {
    sensor.record({
      actionId,
      eventType,
      location,
      metadata,
      message,
      log,
      priority,
      logLevel: LogLevel.DEBUG
    })
  },

  // Structured logging methods for convenience
  success: (
    actionId: ActionId,
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
    actionId: ActionId,
    error?: string,
    location?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'error',
      message: error,
      location,
      metadata,
      log: true,
      logLevel: LogLevel.ERROR
    })
  },

  warn: (
    actionId: ActionId,
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
    actionId: ActionId,
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
    actionId: ActionId,
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
    actionId: ActionId,
    message?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'critical',
      message,
      metadata,
      log: true,
      logLevel: LogLevel.CRITICAL
    })
  },

  // Execution tracking
  execution: (
    actionId: ActionId,
    duration: number,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'execution',
      location: 'handler',
      metadata: {
        duration,
        ...metadata
      },
      logLevel: LogLevel.DEBUG
    })
  },

  // Dispatch tracking
  dispatch: (actionId: ActionId, metadata?: Record<string, unknown>): void => {
    sensor.record({
      actionId,
      eventType: 'dispatch',
      location: 'dispatch-to-execute',
      metadata,
      logLevel: LogLevel.DEBUG
    })
  },

  // Call tracking
  call: (actionId: ActionId, metadata?: Record<string, unknown>): void => {
    sensor.record({
      actionId,
      eventType: 'call',
      location: 'call-entry',
      metadata,
      logLevel: LogLevel.DEBUG
    })
  },

  // Protection events
  throttle: (actionId: ActionId, metadata?: Record<string, unknown>): void => {
    sensor.record({
      actionId,
      eventType: 'throttle',
      location: 'protection',
      metadata,
      logLevel: LogLevel.DEBUG
    })
  },

  debounce: (actionId: ActionId, metadata?: Record<string, unknown>): void => {
    sensor.record({
      actionId,
      eventType: 'debounce',
      location: 'protection',
      metadata,
      logLevel: LogLevel.DEBUG
    })
  },

  blocked: (
    actionId: ActionId,
    reason?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'blocked',
      location: 'protection',
      message: reason,
      metadata,
      logLevel: LogLevel.WARN
    })
  },

  skip: (
    actionId: ActionId,
    reason?: string,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'skip',
      location: 'protection',
      message: reason,
      metadata,
      logLevel: LogLevel.DEBUG
    })
  },

  // Legacy methods for backward compatibility
  dispatchToExecute: (
    actionId: ActionId,
    executionTime: number,
    metadata: Record<string, unknown>
  ): void => {
    sensor.dispatch(actionId, {executionTime, ...metadata})
  },

  callToDispatch: (
    actionId: ActionId,
    metadata: Record<string, unknown>
  ): void => {
    sensor.call(actionId, metadata)
  }
}

export default sensor
