// src/metrics/core.ts
// Core metrics collection with separated event types and log levels

import type {ActionId, Priority, StateKey} from '../types/core'
import {createStore} from '../context/create-store'
import {SensorEvent} from './sensor'
import {log, LogLevel, Colors} from '../components/cyre-log'

/*

      C.Y.R.E - M.E.T.R.I.C.S - C.O.R.E
      
      Clean separation of concerns:
      - MetricEvent: What happened (call, execution, error)
      - LogLevel: How important it is (error, warn, info, debug)
      - Unified event structure
      - Efficient memory management

*/

// Core metric event types - what happened
export type MetricEvent =
  | 'call' // Action was called
  | 'dispatch' // Dispatch to handler started
  | 'execution' // Handler execution completed
  | 'error' // Error occurred
  | 'throttle' // Throttle protection activated
  | 'debounce' // Debounce protection activated
  | 'skip' // Execution skipped
  | 'blocked' // Execution blocked
  | 'success' // Operation successful
  | 'info' // Information event
  | 'warning' // Warning event
  | 'critical' // Critical system event

// Enhanced event structure with log level separation
export interface RawEvent {
  id: string

  timestamp: number

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

// System statistics
export interface SystemMetrics {
  totalCalls: number
  totalExecutions: number
  totalErrors: number
  callRate: number
  lastCallTime: number
  startTime: number
  uptime: number
}

// Channel statistics
export interface ChannelMetrics {
  id: ActionId
  calls: number
  executions: number
  errors: number
  lastExecution: number
  averageLatency: number
  successRate: number
  errorRate: number
  protectionEvents: {
    throttled: number
    debounced: number
    blocked: number
    skipped: number
  }
}

// Analysis configuration
interface AnalysisConfig {
  maxEvents: number
  retentionTime: number
  cleanupInterval: number
}

// Default configuration
const DEFAULT_CONFIG: AnalysisConfig = {
  maxEvents: 1000,
  retentionTime: 3600000, // 1 hour
  cleanupInterval: 300000 // 5 minutes
}

// Event storage
const eventStore = createStore<RawEvent>()
const channelMetricsStore = createStore<ChannelMetrics>()

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

/**
 * Core metrics collection interface
 */
export const metricsCore = {
  /**
   * Record a metric event with optional log level
   */
  record: ({...action}: SensorEvent): void => {
    const event: RawEvent = {
      ...action,
      id: `evt-${eventSequence++}`,
      timestamp: Date.now()
    }

    // Store event
    eventStore.set(event.id, event)

    // Update system metrics
    updateSystemMetrics(event)

    // Update channel metrics
    updateChannelMetrics(event)

    // Trigger cleanup if needed
    if (eventSequence % 200 === 0) {
      cleanupEvents()
    }

    // Optional terminal output
    if (action.log) {
      const message = formatMessage(action)
      sendToLog(action.logLevel || LogLevel.DEBUG, message)
    }
  },

  /**
   * Get system metrics
   */
  getSystemMetrics: (): SystemMetrics => {
    return {
      ...systemMetrics,
      uptime: Date.now() - systemMetrics.startTime,
      callRate: calculateCallRate()
    }
  },

  /**
   * Get channel metrics with protection events
   */
  getChannelMetrics: (actionId: ActionId): ChannelMetrics | undefined => {
    return channelMetricsStore.get(actionId)
  },

  /**
   * Get all channel metrics
   */
  getAllChannelMetrics: (): ChannelMetrics[] => {
    return channelMetricsStore.getAll()
  },

  /**
   * Get recent events with optional filtering
   */
  getEvents: (filter?: {
    actionId?: ActionId
    eventType?: MetricEvent
    logLevel?: LogLevel
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
      if (filter.logLevel) {
        events = events.filter(e => e.logLevel === filter.logLevel)
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!)
      }
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp)

    if (filter?.limit) {
      events = events.slice(0, filter.limit)
    }

    return events
  },

  /**
   * Calculate success rate for a channel
   */
  getSuccessRate: (actionId: ActionId, timeWindow?: number): number => {
    const since = timeWindow ? Date.now() - timeWindow : undefined
    const events = metricsCore.getEvents({actionId, since})

    const calls = events.filter(e => e.eventType === 'call').length
    const errors = events.filter(e => e.eventType === 'error').length

    return calls > 0 ? (calls - errors) / calls : 1
  },

  /**
   * Calculate average latency for a channel
   */
  getAverageLatency: (actionId: ActionId, timeWindow?: number): number => {
    const since = timeWindow ? Date.now() - timeWindow : undefined
    const events = metricsCore.getEvents({
      actionId,
      eventType: 'execution',
      since
    })

    const latencies = events
      .map(e => e.metadata?.duration as number)
      .filter(d => typeof d === 'number' && d > 0)

    return latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0
  },

  /**
   * Get protection event counts for a channel
   */
  getProtectionEvents: (actionId: ActionId, timeWindow?: number) => {
    const since = timeWindow ? Date.now() - timeWindow : undefined
    const events = metricsCore.getEvents({actionId, since})

    return {
      throttled: events.filter(e => e.eventType === 'throttle').length,
      debounced: events.filter(e => e.eventType === 'debounce').length,
      blocked: events.filter(e => e.eventType === 'blocked').length,
      skipped: events.filter(e => e.eventType === 'skip').length
    }
  },

  /**
   * Reset all metrics
   */
  reset: (): void => {
    eventStore.clear()
    channelMetricsStore.clear()
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

  /**
   * Initialize metrics system
   */
  initialize: (config: Partial<AnalysisConfig> = {}): void => {
    const finalConfig = {...DEFAULT_CONFIG, ...config}

    // Start cleanup timer
    cleanupTimer = setInterval(() => {
      cleanupEvents(finalConfig.retentionTime)
    }, finalConfig.cleanupInterval)
  },

  /**
   * Shutdown metrics system
   */
  shutdown: (): void => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = undefined
    }
  }
}

/**
 * Update system-level metrics
 */
const updateSystemMetrics = (event: RawEvent): void => {
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
}

/**
 * Update channel-level metrics with protection events
 */
const updateChannelMetrics = (event: RawEvent): void => {
  let metrics = channelMetricsStore.get(event.actionId)

  if (!metrics) {
    metrics = {
      id: event.actionId,
      calls: 0,
      executions: 0,
      errors: 0,
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

  switch (event.eventType) {
    case 'call':
      metrics.calls++
      break
    case 'execution':
      metrics.executions++
      metrics.lastExecution = event.timestamp

      // Update average latency
      const duration = event.metadata?.duration as number
      if (typeof duration === 'number' && duration > 0) {
        metrics.averageLatency =
          (metrics.averageLatency * (metrics.executions - 1) + duration) /
          metrics.executions
      }
      break
    case 'error':
      metrics.errors++
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

  // Recalculate rates
  metrics.successRate =
    metrics.calls > 0 ? (metrics.calls - metrics.errors) / metrics.calls : 1
  metrics.errorRate = metrics.calls > 0 ? metrics.errors / metrics.calls : 0

  channelMetricsStore.set(event.actionId, metrics)
}

/**
 * Calculate current call rate
 */
const calculateCallRate = (): number => {
  const now = Date.now()
  const oneSecondAgo = now - 1000

  const recentCalls = eventStore
    .getAll()
    .filter(e => e.eventType === 'call' && e.timestamp > oneSecondAgo)

  return recentCalls.length
}

/**
 * Clean up old events
 */
const cleanupEvents = (
  retentionTime: number = DEFAULT_CONFIG.retentionTime
): void => {
  const cutoff = Date.now() - retentionTime
  const allEvents = eventStore.getAll()

  // Remove old events
  allEvents.forEach(event => {
    if (event.timestamp < cutoff) {
      eventStore.forget(event.id)
    }
  })
}

/**
 * Fast message formatting
 */
const formatMessage = (action: SensorEvent): string => {
  let msg = `[${action.actionId}] ${action.eventType}`

  if (location) msg += ` @${location}`

  if (action.metadata) {
    const metadata = action.metadata
    const parts: string[] = []
    if (metadata.error) parts.push(`error: ${metadata.error}`)
    if (metadata.duration) parts.push(`${metadata.duration}ms`)
    if (metadata.remaining) parts.push(`${metadata.remaining}ms left`)
    if (metadata.reason) parts.push(`${metadata.reason}`)
    if (metadata.message) parts.push(`${metadata.message}`)

    if (parts.length > 0) msg += ` - ${parts.join(', ')}`
  }

  return msg
}

/**
 * Direct log output
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
