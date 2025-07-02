// src/components/sensor.ts
// Consolidated sensor with integrated logging - replaces cyre-log

/*

      C.Y.R.E - S.E.N.S.O.R 
      
      Consolidated logging and event tracking system:
      - Single interface for all logging needs
      - Event tracking with metadata
      - Environment-aware output (dev/prod/browser)
      - Standardized parameter order
      - Browser-optimized console output
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

// Smart message formatting - handles arrays of arguments like console.log
const formatMessage = (message: any): string => {
  if (Array.isArray(message)) {
    return message
      .map(item => {
        if (typeof item === 'string') return item
        if (typeof item === 'number') return String(item)
        if (typeof item === 'boolean') return String(item)
        if (item === null) return 'null'
        if (item === undefined) return 'undefined'
        try {
          return JSON.stringify(item, null, 2)
        } catch {
          return String(item)
        }
      })
      .join(' ')
  }

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

// Console output with full color support for both Node.js and Browser
const logToConsole = (level: LogLevel, message: string, context?: any) => {
  const timestamp = new Date().toISOString()
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
  const formattedMessage = formatMessage(message)

  if (isBrowser) {
    // Browser console with CSS styling (like cyre-log)
    const styles = {
      DEBUG: 'color: #6b7280',
      INFO: 'color: #2563eb',
      WARN: 'color: #d97706; font-weight: bold',
      ERROR: 'color: #dc2626; font-weight: bold',
      CRITICAL: 'color: #dc2626; font-weight: bold',
      SUCCESS: 'color: #059669; font-weight: bold',
      SYS: 'color: white; background: #7c3aed; padding: 2px 4px; border-radius: 3px; font-weight: bold'
    }

    const style = styles[levelName as keyof typeof styles] || 'color: gray'
    const logMessage = `%c[${timestamp}] ${levelName}: ${formattedMessage}`

    // Use appropriate console method based on level
    if (level >= LogLevel.ERROR) {
      console.error(logMessage, style)
    } else if (level === LogLevel.WARN) {
      console.warn(logMessage, style)
    } else {
      console.log(logMessage, style)
    }

    // Show context if provided
    if (context && Object.keys(context).length > 0) {
      console.log('%cContext:', 'color: #6b7280; font-style: italic', context)
    }
  } else {
    // Node.js console with ANSI colors
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[34m', // Blue
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
      CRITICAL: '\x1b[41m\x1b[37m', // Red background, white text
      SUCCESS: '\x1b[32m', // Green
      SYS: '\x1b[35m', // Magenta
      RESET: '\x1b[0m'
    }

    const color = colors[levelName as keyof typeof colors] || ''
    const reset = colors.RESET || ''

    const logOutput = `${color}[${timestamp}] ${levelName}: ${formattedMessage}${reset}`

    // Output based on level
    if (level >= LogLevel.ERROR) {
      console.error(logOutput)
    } else if (level === LogLevel.WARN) {
      console.warn(logOutput)
    } else {
      console.log(logOutput)
    }

    // Show context if provided
    if (context && Object.keys(context).length > 0) {
      const contextOutput = `${color}  Context:${reset}`
      console.log(contextOutput, context)
    }
  }
}

// Browser-specific debugging utilities
const getBrowserDebugInfo = (): Record<string, any> => {
  if (!isBrowser) return {}

  return {
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: Date.now(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    connection: (navigator as any).connection
      ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink
        }
      : undefined
  }
}

/**
 * Consolidated sensor with integrated logging
 */
export const sensor = {
  /**
   * Core sensor method - logs data to console by default
   */
  log: (event: SensorEvent): void => {
    // Log by default (like cyre-log), unless explicitly disabled
    const shouldLog = event.log !== false

    if (shouldLog) {
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

  // Standardized methods - handle multiple arguments like console.log

  success: (message: any, ...args: any[]): void => {
    const fullMessage = [message, ...args]
      .filter(arg => arg !== undefined)
      .join(' ')
    sensor.log({
      message: fullMessage,
      log: true,
      logLevel: LogLevel.SUCCESS
    })
  },

  error: (message: any, ...args: any[]): void => {
    const fullMessage = [message, ...args]
      .filter(arg => arg !== undefined)
      .join(' ')
    sensor.log({
      message: fullMessage,
      log: true,
      logLevel: LogLevel.ERROR
    })
  },

  warn: (message: any, ...args: any[]): void => {
    const fullMessage = [message, ...args]
      .filter(arg => arg !== undefined)
      .join(' ')
    sensor.log({
      message: fullMessage,
      log: true,
      logLevel: LogLevel.WARN
    })
  },

  info: (message: any, ...args: any[]): void => {
    const fullMessage = [message, ...args]
      .filter(arg => arg !== undefined)
      .join(' ')
    sensor.log({
      message: fullMessage,
      log: true,
      logLevel: LogLevel.INFO
    })
  },

  debug: (message: any, ...args: any[]): void => {
    const fullMessage = [message, ...args]
      .filter(arg => arg !== undefined)
      .join(' ')
    sensor.log({
      message: fullMessage,
      log: true,
      logLevel: LogLevel.DEBUG
    })
  },

  critical: (message: any, ...args: any[]): void => {
    const fullMessage = [message, ...args]
      .filter(arg => arg !== undefined)
      .join(' ')
    sensor.log({
      message: fullMessage,
      log: true,
      logLevel: LogLevel.CRITICAL
    })
  },

  sys: (message: any, ...args: any[]): void => {
    const fullMessage = [message, ...args]
      .filter(arg => arg !== undefined)
      .join(' ')
    sensor.log({
      message: fullMessage,
      log: true,
      logLevel: LogLevel.SYS
    })
  }
}
