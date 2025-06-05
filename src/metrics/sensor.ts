// src/metrics/sensor.ts
// Fixed sensor with proper data validation and type safety

import {metricsCore} from './core'
import {LogLevel} from '../components/cyre-log'
import type {ActionId, Priority} from '../types/core'
import {MetricEvent} from '../types/system'

/*

      C.Y.R.E - S.E.N.S.O.R 
      
      Fixed sensor system with proper data validation:
      - Validates event types before recording
      - Prevents object/number corruption in event fields
      - Maintains backward compatibility
      - Proper error handling for malformed data

*/

export interface SensorEvent {
  actionId: ActionId
  eventType: MetricEvent
  message?: string
  log?: boolean
  logLevel?: LogLevel
  metadata?: Record<string, unknown>
  location?: string
  priority?: Priority
}

// Valid event types to prevent corruption
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
const validateSensorEvent = (event: any): SensorEvent | null => {
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
    // This appears to be execution duration - convert to proper event
    eventType = 'execution'
    // Move the duration to metadata
    if (!event.metadata) event.metadata = {}
    event.metadata.executionTime = event.eventType
  } else if (typeof event.eventType === 'object') {
    // This appears to be dispatch metadata - convert to proper event
    eventType = 'dispatch'
    // Merge object into metadata
    if (!event.metadata) event.metadata = {}
    event.metadata = {...event.metadata, ...event.eventType}
  } else {
    console.error(
      'Invalid sensor event: eventType must be a valid string',
      event
    )
    return null
  }

  // Validate location (should be string or undefined)
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

  // Ensure metadata is an object
  const metadata =
    event.metadata && typeof event.metadata === 'object' ? event.metadata : {}

  return {
    actionId: event.actionId,
    eventType,
    message: typeof event.message === 'string' ? event.message : undefined,
    log: Boolean(event.log),
    logLevel: event.logLevel || LogLevel.DEBUG,
    metadata,
    location,
    priority: event.priority
  }
}

/**
 * Fixed sensor interface with data validation
 */
export const sensor = {
  /**
   * Core sensor method with validation
   */
  record: (event: SensorEvent | any): void => {
    const validatedEvent = validateSensorEvent(event)
    if (!validatedEvent) {
      console.error('Sensor event validation failed, skipping record')
      return
    }

    metricsCore.record(validatedEvent)
  },

  /**
   * Legacy log method with validation
   */
  log: (
    actionId: ActionId,
    eventType: any, // Accept any type for backward compatibility
    location?: any, // Accept any type for backward compatibility
    metadata?: Record<string, unknown>
  ): void => {
    const event = {
      actionId,
      eventType,
      location,
      metadata,
      logLevel: LogLevel.DEBUG,
      log: false
    }

    sensor.record(event)
  },

  // Type-safe structured methods
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

  warning: (
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

  //depreciated backward compatibility sensors
  // Execution tracking with proper data handling
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
        executionTime: duration, // For backward compatibility
        ...metadata
      },
      logLevel: LogLevel.DEBUG
    })
  },

  // Dispatch tracking with proper metadata handling
  dispatchToExecute: (
    actionId: ActionId,
    executionTime: number,
    dispatchMetadata: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'dispatch',
      location: 'dispatch-to-execute',
      metadata: {
        executionTime,
        ...dispatchMetadata
      },
      logLevel: LogLevel.DEBUG
    })
  },

  // Call tracking
  callToDispatch: (
    actionId: ActionId,
    callMetadata: Record<string, unknown>
  ): void => {
    sensor.record({
      actionId,
      eventType: 'call',
      location: 'call-to-dispatch',
      metadata: callMetadata,
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
  }
}
