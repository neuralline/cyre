// src/components/cyre-logger.ts

// Define log levels and their corresponding colors
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}
/* 

      C.Y.R.E. - L.O.G.G.E.R.
      

*/
// Define color codes with semantic names
export const Colors = {
  reset: '\x1b[0m',
  magenta: '\x1b[35m',
  magentaBright: '\x1b[95m',
  red: '\x1b[31m',
  redBright: '\x1b[91m',
  green: '\x1b[32m',
  greenBright: '\x1b[92m',
  cyan: '\x1b[36m',
  cyanBright: '\x1b[96m',
  yellow: '\x1b[33m',
  yellowBright: '\x1b[93m',
  white: '\x1b[37m',
  whiteBright: '\x1b[97m',
  blue: '\x1b[34m',
  blueBright: '\x1b[94m',
  // Add background colors for better visibility
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  // Add text styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m'
} as const

// Define log level colors
const levelColors: Record<LogLevel, (keyof typeof Colors)[]> = {
  [LogLevel.DEBUG]: ['dim', 'cyan'],
  [LogLevel.INFO]: ['blue', 'bold'],
  [LogLevel.WARN]: ['yellowBright', 'bold'],
  [LogLevel.ERROR]: ['redBright', 'bold'],
  [LogLevel.SUCCESS]: ['greenBright', 'bold']
}

// Add environment detection
const isNode =
  typeof process !== 'undefined' && process.versions && process.versions.node
const isBrowser = typeof window !== 'undefined'

// Add log level filtering
let currentLogLevel: LogLevel = LogLevel.DEBUG
export const setLogLevel = (level: LogLevel) => {
  currentLogLevel = level
}

// Add log level priority mapping
const logLevelPriority: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.SUCCESS]: 1
}

// Base logging function to reduce duplication
const createLogMessage = (
  level: LogLevel,
  message: unknown,
  timestamp: boolean
): string => {
  // setLogLevel(level)
  const time = timestamp ? `[${new Date().toISOString()}]` : ''
  const formattedMessage =
    message instanceof Error
      ? `${message.message}\n${message.stack}`
      : typeof message === 'object'
      ? JSON.stringify(message, null, 2)
      : String(message)

  return `${time} ${level}: ${formattedMessage}`
}

// Enhanced LogFunction type
type LogFunction = (
  message: unknown,
  timestamp?: boolean,
  useConsole?: boolean
) => void

// Updated baseLogger to handle multiple color modifiers
const baseLogger = (
  level: LogLevel,
  colors: (keyof typeof Colors)[],
  consoleMethod: 'log' | 'error' | 'warn' | 'debug'
): LogFunction => {
  return (message: unknown, timestamp = true, useConsole = false) => {
    if (logLevelPriority[level] < logLevelPriority[currentLogLevel]) {
      return
    }

    const logMessage = createLogMessage(level, message, timestamp)

    if (useConsole || isBrowser) {
      // Add CSS styling for browser console
      const style =
        level === LogLevel.ERROR
          ? 'color: red; font-weight: bold'
          : level === LogLevel.WARN
          ? 'color: orange; font-weight: bold'
          : level === LogLevel.SUCCESS
          ? 'color: green; font-weight: bold'
          : level === LogLevel.INFO
          ? 'color: blue'
          : 'color: gray'

      console[consoleMethod](`%c${logMessage}`, style)
      return
    }

    if (isNode) {
      const coloredMessage = colors.reduce(
        (msg, color) => `${Colors[color]}${msg}`,
        logMessage
      )
      process.stdout.write(`${coloredMessage}${Colors.reset}\n`)
    }
  }
}

// Create enhanced CyreLog object
export const CyreLog = {
  error: baseLogger(LogLevel.ERROR, levelColors[LogLevel.ERROR], 'error'),
  warn: baseLogger(LogLevel.WARN, levelColors[LogLevel.WARN], 'warn'),
  info: baseLogger(LogLevel.INFO, levelColors[LogLevel.INFO], 'log'),
  debug: baseLogger(LogLevel.DEBUG, levelColors[LogLevel.DEBUG], 'debug'),
  success: baseLogger(LogLevel.SUCCESS, levelColors[LogLevel.SUCCESS], 'log')
}
