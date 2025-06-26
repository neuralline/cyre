// src/metrics/sensor.ts
// Consolidated sensor with integrated logging - replaces cyre-log

/*

      C.Y.R.E - S.E.N.S.O.R 
      
      Consolidated logging and event tracking system:
      - Single interface for all logging needs
      - Event tracking with metadata
      - Environment-aware output (dev/prod)
      - Standardized parameter order
      - Replaces cyre-log entirely

*/

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
  SUCCESS = 5,
  SYS = 6
}

export interface SensorEvent {
  message: any // Can be anything like console.log
  location?: string // Where this log was generated
  actionId?: string // Channel id if available, related tag eg: system
  eventType?: MetricEvent // Event type for categorization
  metadata?: Record<string, unknown> // Additional data
  log?: boolean // If true, log to terminal
  logLevel?: LogLevel // Log level
}

// Event types for categorization
export type MetricEvent =
  | 'call'
  | 'dispatch'
  | 'execution'
  | 'error'
  | 'throttle'
  | 'debounce'
  | 'skip'
  | 'blocked'
  | 'success'
  | 'warning'
  | 'info'
  | 'debug'
  | 'critical'
  | 'system'

// Environment detection
const isDev =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
const isBrowser = typeof window !== 'undefined'

// Smart message formatting
const formatMessage = (message: any): string => {
  if (typeof message === 'string') return message
  if (typeof message === 'number') return String(message)
  if (typeof message === 'boolean') return String(message)
  if (message === null) return 'null'
  if (message === undefined) return 'undefined'

  try {
    return JSON.stringify(message, null, 2)
  } catch {
    return String(message)
  }
}

// Console output with colors (Node.js only)
const logToConsole = (level: LogLevel, message: string, context?: any) => {
  const timestamp = new Date().toISOString()

  // Color codes for Node.js
  const colors = isBrowser
    ? {}
    : {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[34m', // Blue (changed from white)
        WARN: '\x1b[33m', // Yellow
        ERROR: '\x1b[31m', // Red
        CRITICAL: '\x1b[41m\x1b[37m', // Red background, white text
        SUCCESS: '\x1b[32m', // Green
        SYS: '\x1b[35m', // Magenta
        RESET: '\x1b[0m'
      }

  const levelNames = [
    'DEBUG',
    'INFO',
    'WARN',
    'ERROR',
    'CRITICAL',
    'SUCCESS',
    'SYS'
  ]
  const levelName = levelNames[level] || 'INFO'

  const color = colors[levelName as keyof typeof colors] || ''
  const reset = colors.RESET || ''

  const formattedMessage = formatMessage(message)

  // Format: [2025-06-26T12:30:13.011Z] ERROR: message (all colorized)
  const logOutput = `${color}[${timestamp}] ${levelName}: ${formattedMessage}${reset}`

  // Output based on level
  if (level >= LogLevel.ERROR) {
    console.error(logOutput)
  } else if (level === LogLevel.WARN) {
    console.warn(logOutput)
  } else {
    console.log(logOutput)
  }

  // Show context if provided and in dev mode
  if (context && isDev && Object.keys(context).length > 0) {
    const contextOutput = `${color}  Context:${reset}`
    console.log(contextOutput, context)
  }
}

/**
 * Consolidated sensor with integrated logging
 */
export const sensor = {
  /**
   * Core sensor method - logs data and optionally to terminal
   */
  log: (event: SensorEvent): void => {
    // Always log to terminal if log: true or in development
    if (event.log || isDev) {
      const context = {
        ...(event.location && {location: event.location}),
        ...(event.actionId && {actionId: event.actionId}),
        ...(event.eventType && {eventType: event.eventType}),
        ...(event.metadata && {metadata: event.metadata})
      }

      logToConsole(
        event.logLevel || LogLevel.INFO,
        event.message,
        Object.keys(context).length > 0 ? context : undefined
      )
    }
  },

  // Standardized methods - all follow: message, location?, actionId?, eventType?, metadata?

  success: (
    message: any,
    location?: string,
    actionId?: string,
    eventType?: MetricEvent,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.log({
      message,
      location,
      actionId,
      eventType: eventType || 'success',
      metadata,
      log: true,
      logLevel: LogLevel.SUCCESS
    })
  },

  error: (
    message: any,
    location?: string,
    actionId?: string,
    eventType?: MetricEvent,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.log({
      message,
      location,
      actionId,
      eventType: eventType || 'error',
      metadata,
      log: true,
      logLevel: LogLevel.ERROR
    })
  },

  warn: (
    message: any,
    location?: string,
    actionId?: string,
    eventType?: MetricEvent,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.log({
      message,
      location,
      actionId,
      eventType: eventType || 'warning',
      metadata,
      log: true,
      logLevel: LogLevel.WARN
    })
  },

  info: (
    message: any,
    location?: string,
    actionId?: string,
    eventType?: MetricEvent,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.log({
      message,
      location,
      actionId,
      eventType: eventType || 'info',
      metadata,
      log: true,
      logLevel: LogLevel.INFO
    })
  },

  debug: (
    message: any,
    location?: string,
    actionId?: string,
    eventType?: MetricEvent,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.log({
      message,
      location,
      actionId,
      eventType: eventType || 'debug',
      metadata,
      log: isDev, // Only log debug in development
      logLevel: LogLevel.DEBUG
    })
  },

  critical: (
    message: any,
    location?: string,
    actionId?: string,
    eventType?: MetricEvent,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.log({
      message,
      location,
      actionId,
      eventType: eventType || 'critical',
      metadata,
      log: true,
      logLevel: LogLevel.CRITICAL
    })
  },

  sys: (
    message: any,
    location?: string,
    actionId?: string,
    eventType?: MetricEvent,
    metadata?: Record<string, unknown>
  ): void => {
    sensor.log({
      message,
      location,
      actionId,
      eventType: eventType || 'system',
      metadata,
      log: true,
      logLevel: LogLevel.SYS
    })
  }
}
