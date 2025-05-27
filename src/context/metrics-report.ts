// src/context/metrics-report.ts
// Raw metrics collection with sensor-based architecture

import {createStore} from './create-store'
import type {ActionId, Priority, StateKey} from '../types/interface'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - M.E.T.R.I.C.S - R.E.P.O.R.T
      
      Raw metrics collection with sensor architecture:
      - Generalized sensor.log() for most events
      - Custom sensors for complex events requiring specific data
      - Live streaming capabilities for external monitoring
      - Minimal processing - raw data export focused
      - Essential stats only for Cyre breathing system
      - call-to-dispatch and dispatch-to-execute tracking

*/

export type EventType =
  | 'call' // Action call initiated
  | 'dispatch' // Call dispatched to listener
  | 'execution' // Action executed successfully
  | 'error' // Execution error
  | 'throttle' // Call throttled
  | 'debounce' // Call debounced
  | 'skip' // Execution skipped (change detection)
  | 'middleware' // Middleware processed
  | 'intralink' // Chain reaction processed
  | 'timeout' // Execution timeout
  | 'system' // System-level events
  | 'warning'
  | 'critical'
  | 'success'
  | 'info'
  | 'debug'
  | 'delayed'
  | 'repeat'
  | 'blocked'
  | 'unknown id'
  | 'no subscriber'
  | 'other'

// Core metric event structure
export interface RawMetricEvent {
  id: string // Unique event ID
  timestamp: number // When event occurred
  actionId: ActionId // Which action
  eventType: EventType // What happened
  location?: string // Where in pipeline (optional)
  priority?: Priority // Action priority
  metadata?: Record<string, any> // Event-specific data
}

// Live streaming interfaces
export interface EventFilter {
  actionIds?: string[]
  eventTypes?: EventType[]
  since?: number
  priority?: Priority[]
  location?: string
}

export interface LiveQuery extends EventFilter {
  limit?: number
  offset?: number
}

// Stream subscription for live monitoring
export interface StreamSubscription {
  id: string
  filter: EventFilter
  callback: (event: RawMetricEvent) => void
  active: boolean
}

// Essential system stats (breathing system only)
export interface SystemStats {
  totalCalls: number
  totalExecutions: number
  totalErrors: number
  callRate: number // For breathing system stress calculation
  lastCallTime: number
  startTime: number
}

// Minimal action stats (breathing system only)
export interface ActionStats {
  id: ActionId
  calls: number
  errors: number
  lastCall: number
}

// Configuration
const RETENTION_CONFIG = {
  MAX_EVENTS: 2000,
  MAX_ACTIONS: 1000,
  CLEANUP_INTERVAL: 30000, // 30 seconds
  LIVE_BUFFER_SIZE: 500 // Events to keep for live streaming
}

// Stores
const eventStore = createStore<RawMetricEvent>()
const actionStatsStore = createStore<ActionStats>()
const streamStore = createStore<StreamSubscription>()

// System stats (single object)
let systemStats: SystemStats = {
  totalCalls: 0,
  totalExecutions: 0,
  totalErrors: 0,
  callRate: 0,
  lastCallTime: Date.now(),
  startTime: Date.now()
}

// Event sequence and live buffer
let eventSequence = 0
const liveEventBuffer: RawMetricEvent[] = []

// Stream management
let streamIdCounter = 0

/**
 * Core sensor interface - generalized logging
 */
const sensorLog = (
  actionId: ActionId,
  eventType: EventType,
  location?: string,
  metadata?: Record<string, any>
): void => {
  try {
    const event: RawMetricEvent = {
      id: `evt-${eventSequence++}`,
      timestamp: Date.now(),
      actionId,
      eventType,
      location,
      metadata
    }

    // Store event
    eventStore.set(event.id, event)

    // Add to live buffer
    liveEventBuffer.push(event)
    if (liveEventBuffer.length > RETENTION_CONFIG.LIVE_BUFFER_SIZE) {
      liveEventBuffer.shift()
    }

    // Update basic stats for breathing system
    updateSystemStats(event)
    updateActionStats(event)

    // Notify live streams
    notifyStreams(event)
  } catch (error) {
    log.error(`Sensor logging failed: ${error}`)
  }
}

/**
 * Custom sensors for complex events with call-to-dispatch and dispatch-to-execute tracking
 */
const sensorExecution = (
  actionId: ActionId,
  duration: number,
  category?: string,
  location?: string
): void => {
  sensorLog(actionId, 'execution', location, {duration, category})
}

const sensorThrottle = (
  actionId: ActionId,
  remaining: number,
  location?: string
): void => {
  sensorLog(actionId, 'throttle', location, {remaining})
}

const sensorDebounce = (
  actionId: ActionId,
  delay: number,
  collapsed: number,
  location?: string
): void => {
  sensorLog(actionId, 'debounce', location, {delay, collapsed})
}

const sensorError = (
  actionId: ActionId,
  error: string,
  location?: string,
  stack?: string
): void => {
  sensorLog(actionId, 'error', location, {error, stack})
}

const sensorMiddleware = (
  actionId: ActionId,
  middlewareId: string,
  result: 'accept' | 'reject' | 'transform',
  location?: string
): void => {
  sensorLog(actionId, 'middleware', location, {middlewareId, result})
}

const sensorIntralink = (
  fromActionId: ActionId,
  toActionId: ActionId,
  location?: string
): void => {
  sensorLog(fromActionId, 'intralink', location, {toActionId})
}

const sensorTimeout = (
  actionId: ActionId,
  timeout: number,
  location?: string
): void => {
  sensorLog(actionId, 'timeout', location, {timeout})
}

/**
 * Call-to-dispatch tracking sensor
 */
const sensorCallToDispatch = (
  actionId: ActionId,
  metadata?: Record<string, any>
): void => {
  sensorLog(actionId, 'dispatch', 'call-to-dispatch', metadata)
}

/**
 * Dispatch-to-execute tracking sensor
 */
const sensorDispatchToExecute = (
  actionId: ActionId,
  executionTime?: number,
  metadata?: Record<string, any>
): void => {
  sensorLog(actionId, 'execution', 'dispatch-to-execute', {
    executionTime,
    ...metadata
  })
}

/**
 * Update system stats (breathing system needs)
 */
const updateSystemStats = (event: RawMetricEvent): void => {
  switch (event.eventType) {
    case 'call':
      systemStats.totalCalls++
      systemStats.lastCallTime = event.timestamp
      break
    case 'execution':
      systemStats.totalExecutions++
      break
    case 'error':
      systemStats.totalErrors++
      break
  }

  // Calculate call rate for breathing system
  const now = Date.now()
  const recentCalls = liveEventBuffer.filter(
    e => e.eventType === 'call' && e.timestamp > now - 1000
  ).length
  systemStats.callRate = recentCalls
}

/**
 * Update action stats (breathing system needs)
 */
const updateActionStats = (event: RawMetricEvent): void => {
  let stats = actionStatsStore.get(event.actionId)

  if (!stats) {
    stats = {
      id: event.actionId,
      calls: 0,
      errors: 0,
      lastCall: 0
    }
  }

  switch (event.eventType) {
    case 'call':
      stats.calls++
      stats.lastCall = event.timestamp
      break
    case 'error':
      stats.errors++
      break
  }

  actionStatsStore.set(event.actionId, stats)
}

/**
 * Live streaming - notify active streams
 */
const notifyStreams = (event: RawMetricEvent): void => {
  const activeStreams = streamStore.getAll().filter(s => s.active)

  for (const stream of activeStreams) {
    try {
      if (matchesFilter(event, stream.filter)) {
        stream.callback(event)
      }
    } catch (error) {
      log.error(`Stream notification failed for ${stream.id}: ${error}`)
      // Deactivate problematic stream
      stream.active = false
      streamStore.set(stream.id, stream)
    }
  }
}

/**
 * Check if event matches filter
 */
const matchesFilter = (event: RawMetricEvent, filter: EventFilter): boolean => {
  if (filter.actionIds && !filter.actionIds.includes(event.actionId)) {
    return false
  }

  if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
    return false
  }

  if (filter.since && event.timestamp < filter.since) {
    return false
  }

  if (
    filter.priority &&
    event.priority &&
    !filter.priority.includes(event.priority)
  ) {
    return false
  }

  if (filter.location && event.location !== filter.location) {
    return false
  }

  return true
}

/**
 * Create live stream subscription
 */
const createStream = (
  filter: EventFilter,
  callback: (event: RawMetricEvent) => void
): string => {
  const streamId = `stream-${++streamIdCounter}`

  const subscription: StreamSubscription = {
    id: streamId,
    filter,
    callback,
    active: true
  }

  streamStore.set(streamId, subscription)
  return streamId
}

/**
 * Remove stream subscription
 */
const removeStream = (streamId: string): boolean => {
  const stream = streamStore.get(streamId)
  if (stream) {
    stream.active = false
    streamStore.set(streamId, stream)
    return streamStore.forget(streamId)
  }
  return false
}

/**
 * Cleanup old data
 */
const cleanup = (): void => {
  try {
    // Clean old events
    const allEvents = eventStore.getAll()
    if (allEvents.length > RETENTION_CONFIG.MAX_EVENTS) {
      eventStore.clear()
      const recentEvents = allEvents
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, RETENTION_CONFIG.MAX_EVENTS)

      recentEvents.forEach(event => {
        eventStore.set(event.id, event)
      })
    }

    // Clean old action stats
    const allStats = actionStatsStore.getAll()
    if (allStats.length > RETENTION_CONFIG.MAX_ACTIONS) {
      actionStatsStore.clear()
      const recentStats = allStats
        .sort((a, b) => b.lastCall - a.lastCall)
        .slice(0, RETENTION_CONFIG.MAX_ACTIONS)

      recentStats.forEach(stat => {
        actionStatsStore.set(stat.id, stat)
      })
    }

    // Clean inactive streams
    const activeStreams = streamStore.getAll().filter(s => s.active)
    streamStore.clear()
    activeStreams.forEach(stream => {
      streamStore.set(stream.id, stream)
    })
  } catch (error) {
    log.error(`Metrics cleanup failed: ${error}`)
  }
}

// Cleanup timer
let cleanupTimer: NodeJS.Timeout | undefined

/**
 * Main metrics interface with sensor architecture
 */
export const metricsReport = {
  // Sensor interface
  sensor: {
    log: sensorLog,
    execution: sensorExecution,
    throttle: sensorThrottle,
    debounce: sensorDebounce,
    error: sensorError,
    middleware: sensorMiddleware,
    intralink: sensorIntralink,
    timeout: sensorTimeout,
    callToDispatch: sensorCallToDispatch,
    dispatchToExecute: sensorDispatchToExecute
  },

  // Live streaming
  createStream,
  removeStream,
  trackExecution: (actionId: string, duration: number, category?: string) => {
    sensorExecution(actionId, duration, category, 'execution')
  },

  trackError: (actionId: string, error: string, location?: string) => {
    sensorError(actionId, error, location)
  },

  trackProtection: (actionId: string, protectionType: string) => {
    sensorLog(actionId, protectionType as EventType, 'protection')
  },

  trackMiddlewareRejection: (actionId: string) => {
    sensorMiddleware(actionId, 'unknown', 'reject', 'middleware-rejection')
  },

  trackThrottle: (actionId: string) => {
    sensorThrottle(actionId, 0, 'throttle-protection')
  },

  trackDebounce: (actionId: string) => {
    sensorDebounce(actionId, 0, 1, 'debounce-protection')
  },

  trackChangeDetectionSkip: (actionId: string) => {
    sensorLog(actionId, 'skip', 'change-detection')
  },
  // Data export (raw)
  exportEvents: (query?: LiveQuery): RawMetricEvent[] => {
    let events = eventStore.getAll()

    if (query) {
      if (query.actionIds) {
        events = events.filter(e => query.actionIds!.includes(e.actionId))
      }
      if (query.eventTypes) {
        events = events.filter(e => query.eventTypes!.includes(e.eventType))
      }
      if (query.since) {
        events = events.filter(e => e.timestamp >= query.since!)
      }
      if (query.priority) {
        events = events.filter(
          e => e.priority && query.priority!.includes(e.priority)
        )
      }
      if (query.location) {
        events = events.filter(e => e.location === query.location)
      }
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp)

    // Apply pagination
    if (query?.offset) {
      events = events.slice(query.offset)
    }
    if (query?.limit) {
      events = events.slice(0, query.limit)
    }

    return events
  },

  // Live events (from buffer)
  getLiveEvents: (query?: LiveQuery): RawMetricEvent[] => {
    let events = [...liveEventBuffer]

    if (query && (matchesFilter as any)) {
      events = events.filter(event => matchesFilter(event, query))
    }

    return events.slice(0, query?.limit || 100)
  },

  // Essential stats for breathing system
  getSystemStats: (): SystemStats => ({...systemStats}),
  getActionStats: (actionId: ActionId): ActionStats | undefined => {
    return actionStatsStore.get(actionId)
  },

  // Basic reporting
  getBasicReport: (): string => {
    const stats = systemStats
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000)
    const actionCount = actionStatsStore.getAll().length
    const eventCount = eventStore.getAll().length
    const streamCount = streamStore.getAll().filter(s => s.active).length

    return `CYRE Metrics Report
===================
Uptime: ${uptime}s
Actions Tracked: ${actionCount}
Total Calls: ${stats.totalCalls}
Total Executions: ${stats.totalExecutions}
Total Errors: ${stats.totalErrors}
Call Rate: ${stats.callRate}/sec
Events Collected: ${eventCount}
Live Streams: ${streamCount}`
  },

  // System management
  initialize: (): void => {
    systemStats.startTime = Date.now()
    cleanupTimer = setInterval(cleanup, RETENTION_CONFIG.CLEANUP_INTERVAL)
  },

  reset: (): void => {
    eventStore.clear()
    actionStatsStore.clear()
    streamStore.clear()
    liveEventBuffer.length = 0
    systemStats = {
      totalCalls: 0,
      totalExecutions: 0,
      totalErrors: 0,
      callRate: 0,
      lastCallTime: Date.now(),
      startTime: Date.now()
    }
    eventSequence = 0
  },

  shutdown: (): void => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = undefined
    }
    // Deactivate all streams
    const allStreams = streamStore.getAll()
    allStreams.forEach(stream => {
      stream.active = false
      streamStore.set(stream.id, stream)
    })
    streamStore.clear()
  }
}

// Initialize on load
metricsReport.initialize()
