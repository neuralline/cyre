// src/metrics/core.ts
// Core metrics collection with raw data dumping capability

import type {ActionId} from '../types/core'
import {createStore} from '../context/create-store'
import type {
  RawEvent,
  SensorEvent,
  SystemMetrics,
  ChannelMetrics,
  MetricEvent
} from '../types/system'
import {log, LogLevel} from '../components/cyre-log'

/*

      C.Y.R.E - M.E.T.R.I.C.S - C.O.R.E
      
      Core metrics collection with raw data dumping:
      - Single responsibility: collect and store events
      - Fast event recording with minimal processing
      - Raw data dump during cleanup for analysis
      - Configurable dump format (terminal or JSON)

*/

// Event storage
const eventStore = createStore<RawEvent>()
const channelStore = createStore<ChannelMetrics>()

// System state
let systemMetrics: SystemMetrics = {
  totalCalls: 0,
  totalExecutions: 0,
  totalErrors: 0,
  callRate: 0,
  lastCallTime: Date.now(),
  startTime: Date.now(),
  uptime: 0
}

let eventSequence = 0
let cleanupTimer: NodeJS.Timeout | undefined

// Dump configuration
interface DumpConfig {
  enabled: boolean
  format: 'terminal' | 'json' | 'both'
  includeMetadata: boolean
  maxEventsPerDump: number
  outputDirectory: string
  filenamePattern: string
}

let dumpConfig: DumpConfig = {
  enabled: false,
  format: 'json',
  includeMetadata: true,
  maxEventsPerDump: 1001,
  outputDirectory: 'src/log',
  filenamePattern: 'cyre-metrics-{timestamp}.json'
}

/**
 * Core metrics interface
 */
export const metricsCore = {
  /**
   * Record event - primary interface
   */
  record: (event: SensorEvent): void => {
    const rawEvent: RawEvent = {
      ...event,
      id: `evt-${eventSequence++}`,
      timestamp: Date.now()
    }

    // Store event
    eventStore.set(rawEvent.id, rawEvent)

    // Update metrics efficiently
    updateMetrics(rawEvent)

    // Terminal output if requested
    if (event.log && event.logLevel) {
      sendToLog(event.logLevel, formatMessage(event))
    }

    // Periodic cleanup with raw data dump
    if (eventSequence % 100 === 0) {
      scheduleCleanup()
    }
  },

  // Query interfaces
  getSystemMetrics: (): SystemMetrics => ({
    ...systemMetrics,
    uptime: Date.now() - systemMetrics.startTime,
    callRate: calculateCallRate()
  }),

  getChannelMetrics: (actionId: ActionId): ChannelMetrics | undefined =>
    channelStore.get(actionId),

  getAllChannelMetrics: (): ChannelMetrics[] => channelStore.getAll(),

  getEvents: (filter?: {
    actionId?: ActionId
    eventType?: MetricEvent
    since?: number
    limit?: number
  }): RawEvent[] => {
    let events = eventStore.getAll()

    if (filter) {
      if (filter.actionId) {
        events = events.filter(e => e.actionId === filter.actionId)
      }
      if (filter.eventType) {
        events = events.filter(e => e.eventType === filter.eventType)
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!)
      }
    }

    // Sort newest first
    events.sort((a, b) => b.timestamp - a.timestamp)

    return filter?.limit ? events.slice(0, filter.limit) : events
  },

  // Configuration methods
  configureDump: (config: Partial<DumpConfig>): void => {
    dumpConfig = {...dumpConfig, ...config}
  },

  getDumpConfig: (): DumpConfig => ({...dumpConfig}),

  // Manual dump trigger
  dumpRawData: (): void => {
    if (!dumpConfig.enabled) {
      log.warn('Raw data dump is disabled')
      return
    }

    const allEvents = eventStore.getAll()
    log.debug(`Manual dump triggered - ${allEvents.length} events available`)
    performRawDataDump(allEvents, 'manual')
  },

  // Utility methods
  reset: (): void => {
    eventStore.clear()
    channelStore.clear()
    systemMetrics = {
      totalCalls: 0,
      totalExecutions: 0,
      totalErrors: 0,
      callRate: 0,
      lastCallTime: Date.now(),
      startTime: Date.now(),
      uptime: 0
    }
    eventSequence = 0
  },

  initialize: (config?: {
    retentionTime?: number
    cleanupInterval?: number
    dump?: Partial<DumpConfig>
  }): void => {
    const {
      retentionTime = 3600000,
      cleanupInterval = 300000,
      dump
    } = config || {}

    if (dump) {
      dumpConfig = {...dumpConfig, ...dump}
    }

    if (cleanupTimer) {
      clearInterval(cleanupTimer)
    }

    cleanupTimer = setInterval(() => {
      cleanupOldEvents(retentionTime)
    }, cleanupInterval)
  },

  shutdown: (): void => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = undefined
    }

    // Final dump before shutdown
    if (dumpConfig.enabled) {
      performRawDataDump(eventStore.getAll(), 'shutdown')
    }
  }
}

/**
 * Update metrics efficiently
 */
const updateMetrics = (event: RawEvent): void => {
  // Update system metrics
  switch (event.eventType) {
    case 'call':
      systemMetrics.totalCalls++
      systemMetrics.lastCallTime = event.timestamp
      break
    case 'execution':
      systemMetrics.totalExecutions++
      break
    case 'error':
      systemMetrics.totalErrors++
      break
  }

  // Update channel metrics
  updateChannelMetrics(event)
}

/**
 * Update channel metrics with proper initialization
 */
const updateChannelMetrics = (event: RawEvent): void => {
  let metrics = channelStore.get(event.actionId)

  if (!metrics) {
    metrics = {
      id: event.actionId,
      calls: 0,
      executions: 0,
      errors: 0,
      actualErrors: 0,
      lastExecution: 0,
      averageLatency: 0,
      successRate: 1,
      errorRate: 0,
      protectionEvents: {
        throttled: 0,
        debounced: 0,
        blocked: 0,
        skipped: 0
      }
    }
  }

  // Ensure protectionEvents is always properly initialized
  if (!metrics.protectionEvents) {
    metrics.protectionEvents = {
      throttled: 0,
      debounced: 0,
      blocked: 0,
      skipped: 0
    }
  }

  // Update counters
  switch (event.eventType) {
    case 'call':
      metrics.calls++
      break
    case 'execution':
      metrics.executions++
      metrics.lastExecution = event.timestamp

      // Update latency with safe calculation
      const duration = event.metadata?.duration as number
      if (typeof duration === 'number' && duration > 0 && !isNaN(duration)) {
        if (metrics.executions === 1) {
          metrics.averageLatency = duration
        } else {
          metrics.averageLatency =
            (metrics.averageLatency * (metrics.executions - 1) + duration) /
            metrics.executions
        }
      }
      break
    case 'error':
      // Check if this is an actual error or a protection event
      const isActualError =
        event.location !== 'protection' && !event.metadata?.successfulProtection

      if (isActualError) {
        metrics.errors++
        metrics.actualErrors = (metrics.actualErrors || 0) + 1
      } else {
        // This is a protection skip being logged as error - count as skip
        metrics.protectionEvents.skipped++
      }
      break
    case 'throttle':
      metrics.protectionEvents.throttled++
      break
    case 'debounce':
      metrics.protectionEvents.debounced++
      break
    case 'blocked':
      metrics.protectionEvents.blocked++
      break
    case 'skip':
      metrics.protectionEvents.skipped++
      break
  }

  // Recalculate rates using actual errors only with safe division
  if (metrics.calls > 0) {
    const actualErrors = metrics.actualErrors || metrics.errors
    metrics.successRate = Math.max(
      0,
      (metrics.calls - actualErrors) / metrics.calls
    )
    metrics.errorRate = actualErrors / metrics.calls
  } else {
    metrics.successRate = 1
    metrics.errorRate = 0
  }

  // Ensure averageLatency is a valid number
  if (isNaN(metrics.averageLatency) || !isFinite(metrics.averageLatency)) {
    metrics.averageLatency = 0
  }

  channelStore.set(event.actionId, metrics)
}

/**
 * Calculate current call rate
 */
const calculateCallRate = (): number => {
  const recentCalls = eventStore
    .getAll()
    .filter(e => e.eventType === 'call' && e.timestamp > Date.now() - 1000)
  return recentCalls.length
}

/**
 * Schedule cleanup with raw data dump
 */
const scheduleCleanup = (): void => {
  process.nextTick(() => {
    if (dumpConfig.enabled) {
      const allEvents = eventStore.getAll()
      log.debug(
        `Scheduled cleanup triggered - ${allEvents.length} events to process`
      )
      performRawDataDump(allEvents, 'scheduled_cleanup')
    }
    // Comment out cleanupOldEvents as requested
    cleanupOldEvents()
  })
}

/**
 * Perform raw data dump in specified format
 */
const performRawDataDump = (events: RawEvent[], trigger = 'manual'): void => {
  if (!events.length) {
    log.debug(`No events to dump (trigger: ${trigger})`)
    return
  }

  log.debug(
    `Performing raw data dump - ${events.length} events (trigger: ${trigger}, format: ${dumpConfig.format})`
  )

  const dumpData = prepareDumpData(events, trigger)

  switch (dumpConfig.format) {
    case 'terminal':
      dumpToTerminal(dumpData)
      break
    case 'json':
      dumpToJson(dumpData)
      break
    case 'both':
      dumpToTerminal(dumpData)
      dumpToJson(dumpData)
      break
    default:
      log.error(`Unknown dump format: ${dumpConfig.format}`)
  }
}

/**
 * Prepare data for dumping
 */
const prepareDumpData = (events: RawEvent[], trigger: string) => {
  const limitedEvents = events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, dumpConfig.maxEventsPerDump)

  const summary = {
    dumpInfo: {
      trigger,
      timestamp: new Date().toISOString(),
      totalEvents: events.length,
      dumpedEvents: limitedEvents.length,
      timespan:
        events.length > 0
          ? {
              oldest: new Date(
                Math.min(...events.map(e => e.timestamp))
              ).toISOString(),
              newest: new Date(
                Math.max(...events.map(e => e.timestamp))
              ).toISOString()
            }
          : null
    },
    systemMetrics: {
      ...systemMetrics,
      uptime: Date.now() - systemMetrics.startTime,
      callRate: calculateCallRate()
    },
    eventBreakdown: getEventBreakdown(events),
    channelSummary: getChannelSummary(),
    rawEvents: limitedEvents.map(event =>
      dumpConfig.includeMetadata
        ? event
        : {
            id: event.id,
            actionId: event.actionId,
            eventType: event.eventType,
            timestamp: event.timestamp,
            location: event.location,
            message: event.message
          }
    )
  }

  return summary
}

/**
 * Get event breakdown statistics
 */
const getEventBreakdown = (events: RawEvent[]) => {
  const breakdown = events.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const locationBreakdown = events.reduce((acc, event) => {
    if (event.location) {
      acc[event.location] = (acc[event.location] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  return {
    byEventType: breakdown,
    byLocation: locationBreakdown,
    totalEvents: events.length
  }
}

/**
 * Get channel summary
 */
const getChannelSummary = () => {
  const channels = channelStore.getAll()
  return {
    totalChannels: channels.length,
    channelMetrics: channels.map(channel => ({
      id: channel.id,
      calls: channel.calls,
      executions: channel.executions,
      errors: channel.errors,
      successRate: channel.successRate,
      averageLatency: channel.averageLatency,
      protectionEvents: channel.protectionEvents
    }))
  }
}

/**
 * Dump to terminal with formatted output
 */
const dumpToTerminal = (data: any): void => {
  console.log('\n' + '='.repeat(60))
  console.log('📊 CYRE METRICS RAW DATA DUMP')
  console.log('='.repeat(60))

  console.log(`Trigger: ${data.dumpInfo.trigger}`)
  console.log(`Timestamp: ${data.dumpInfo.timestamp}`)
  console.log(
    `Events: ${data.dumpInfo.dumpedEvents}/${data.dumpInfo.totalEvents}`
  )

  if (data.dumpInfo.timespan) {
    console.log(
      `Timespan: ${data.dumpInfo.timespan.oldest} → ${data.dumpInfo.timespan.newest}`
    )
  }

  console.log('\n📈 SYSTEM METRICS:')
  console.log(`  Calls: ${data.systemMetrics.totalCalls}`)
  console.log(`  Executions: ${data.systemMetrics.totalExecutions}`)
  console.log(`  Errors: ${data.systemMetrics.totalErrors}`)
  console.log(`  Call Rate: ${data.systemMetrics.callRate}/sec`)
  console.log(`  Uptime: ${(data.systemMetrics.uptime / 1000).toFixed(1)}s`)

  console.log('\n📊 EVENT BREAKDOWN:')
  Object.entries(data.eventBreakdown.byEventType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`)
  })

  if (Object.keys(data.eventBreakdown.byLocation).length > 0) {
    console.log('\n📍 LOCATION BREAKDOWN:')
    Object.entries(data.eventBreakdown.byLocation).forEach(
      ([location, count]) => {
        console.log(`  ${location}: ${count}`)
      }
    )
  }

  console.log('\n🏢 CHANNEL SUMMARY:')
  console.log(`  Total Channels: ${data.channelSummary.totalChannels}`)

  if (data.channelSummary.channelMetrics.length > 0) {
    console.log('  Top Channels by Activity:')
    data.channelSummary.channelMetrics
      .sort((a: any, b: any) => b.calls - a.calls)
      .slice(0, 5)
      .forEach((channel: any) => {
        console.log(
          `    ${channel.id}: ${channel.calls} calls, ${(
            channel.successRate * 100
          ).toFixed(1)}% success`
        )
      })
  }

  console.log('\n📝 RECENT EVENTS:')
  data.rawEvents.slice(0, 10).forEach((event: RawEvent) => {
    const time = new Date(event.timestamp).toLocaleTimeString()
    const location = event.location ? `@${event.location}` : ''
    const message = event.message ? ` - ${event.message}` : ''
    console.log(
      `  ${time} | ${event.actionId} | ${event.eventType} ${location}${message}`
    )
  })

  console.log('='.repeat(60) + '\n')
}

/**
 * Dump to JSON format with file output to specified directory
 */
const dumpToJson = (data: any): void => {
  const jsonOutput = JSON.stringify(data, null, 2)

  // Always attempt file output for JSON dumps
  if (typeof process !== 'undefined') {
    try {
      const fs = require('fs')
      const path = require('path')

      log.debug(
        `Attempting to create JSON dump in directory: ${dumpConfig.outputDirectory}`
      )

      // Create directory if it doesn't exist
      if (!fs.existsSync(dumpConfig.outputDirectory)) {
        log.debug(`Creating directory: ${dumpConfig.outputDirectory}`)
        fs.mkdirSync(dumpConfig.outputDirectory, {recursive: true})
      }

      // Generate filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0] // Remove milliseconds

      const filename = dumpConfig.filenamePattern.replace(
        '{timestamp}',
        timestamp
      )
      const fullPath = path.join(dumpConfig.outputDirectory, filename)

      log.debug(`Writing JSON dump to: ${fullPath}`)

      // Write JSON file
      fs.writeFileSync(fullPath, jsonOutput, 'utf8')

      // Verify file was created
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath)
        log.success(
          `📄 Raw metrics data exported to: ${fullPath} (${stats.size} bytes)`
        )
      } else {
        log.error(
          `File creation failed - file does not exist after write: ${fullPath}`
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error(`Failed to write metrics dump file: ${errorMessage}`)
      log.error(`Output directory: ${dumpConfig.outputDirectory}`)
      log.error(`Filename pattern: ${dumpConfig.filenamePattern}`)
      log.warn('📄 JSON RAW DATA DUMP (console fallback):')
      console.log(jsonOutput)
    }
  } else {
    // Browser environment - console output only
    log.debug('Browser environment detected - using console output')
    console.log('📄 JSON RAW DATA DUMP:')
    console.log(jsonOutput)
  }
}

/**
 * Clean up old events
 */
const cleanupOldEvents = (retentionTime = 3600000): void => {
  const cutoff = Date.now() - retentionTime
  const events = eventStore.getAll()

  let removedCount = 0
  for (const event of events) {
    if (event.timestamp < cutoff) {
      eventStore.forget(event.id)
      removedCount++
    }
  }

  if (removedCount > 0) {
    console.debug(`Cleaned up ${removedCount} old events`)
  }
}

/**
 * Format message for terminal output
 */
const formatMessage = (event: SensorEvent): string => {
  let msg = `[${event.actionId}] ${event.eventType}`

  if (event.location) msg += ` @${event.location}`
  if (event.message) msg += ` - ${event.message}`

  if (event.metadata) {
    const parts: string[] = []
    const meta = event.metadata

    if (meta.duration) parts.push(`${meta.duration}ms`)
    if (meta.remaining) parts.push(`${meta.remaining}ms left`)
    if (meta.reason) parts.push(String(meta.reason))

    if (parts.length > 0) msg += ` (${parts.join(', ')})`
  }

  return msg
}

/**
 * Send to appropriate log level
 */
const sendToLog = (logLevel: LogLevel, message: string): void => {
  switch (logLevel) {
    case LogLevel.ERROR:
      log.error(message, false)
      break
    case LogLevel.WARN:
      log.warn(message, false)
      break
    case LogLevel.SUCCESS:
      log.success(message, false)
      break
    case LogLevel.CRITICAL:
      log.critical(message, false)
      break
    case LogLevel.SYS:
      log.sys(message, false)
      break
    case LogLevel.DEBUG:
      log.debug(message, false)
      break
    default:
      log.info(message, false)
  }
}
