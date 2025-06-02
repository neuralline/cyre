// src/context/metrics-report.ts
// Improvements to metrics collection sensor system

import {createStore} from './create-store'
import type {ActionId, Priority, StateKey} from '../types/core'
import {log} from '../components/cyre-log'

export type EventType =
  | 'call' // Action call initiated - CRITICAL: must be logged
  | 'dispatch' // Call dispatched to listener
  | 'execution' // Action executed successfully
  | 'error' // Execution error
  | 'throttle' // Call throttled - CRITICAL: was missing
  | 'debounce' // Call debounced - CRITICAL: was missing
  | 'skip' // Execution skipped (change detection) - CRITICAL: was missing
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
  | 'blocked' // Service not available - CRITICAL: was missing
  | 'unknown id'
  | 'no subscriber'
  | 'other'

// Core metric event structure
export interface RawMetricEvent {
  id: string
  timestamp: number
  actionId: ActionId
  eventType: EventType
  location?: string
  priority?: Priority
  metadata?: Record<string, any>
}

// System stats with call rate tracking
export interface SystemStats {
  totalCalls: number // CRITICAL: this was not being incremented
  totalExecutions: number
  totalErrors: number
  callRate: number
  lastCallTime: number
  startTime: number
}

// Configuration
const RETENTION_CONFIG = {
  MAX_EVENTS: 2000,
  MAX_ACTIONS: 1000,
  CLEANUP_INTERVAL: 30000,
  LIVE_BUFFER_SIZE: 500
}

// Stores
const eventStore = createStore<RawMetricEvent>()
const actionStatsStore = createStore<ActionStats>()
const streamStore = createStore<StreamSubscription>()

// System stats tracking
let systemStats: SystemStats = {
  totalCalls: 0, // CRITICAL: Initialize properly
  totalExecutions: 0,
  totalErrors: 0,
  callRate: 0,
  lastCallTime: Date.now(),
  startTime: Date.now()
}

// Event sequence and live buffer
let eventSequence = 0
const liveEventBuffer: RawMetricEvent[] = []

/**
 * CRITICAL FIX: Core sensor interface with proper call tracking
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

    // CRITICAL FIX: Update system stats properly
    updateSystemStats(event)
    updateActionStats(event)

    // Notify live streams
    notifyStreams(event)
  } catch (error) {
    log.error(`Sensor logging failed: ${error}`)
  }
}

/**
 * CRITICAL FIX: Update system stats with proper call counting
 */
const updateSystemStats = (event: RawMetricEvent): void => {
  switch (event.eventType) {
    case 'call':
      systemStats.totalCalls++ // CRITICAL: This was missing
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
 * CRITICAL FIX: Enhanced throttle sensor with proper logging
 */
const sensorThrottle = (
  actionId: ActionId,
  remaining: number,
  location?: string
): void => {
  sensorLog(actionId, 'throttle', location, {
    remaining,
    throttleActive: true,
    throttleType: 'rate-limit'
  })
}

/**
 * CRITICAL FIX: Enhanced debounce sensor with proper logging
 */
const sensorDebounce = (
  actionId: ActionId,
  delay: number,
  collapsed: number,
  location?: string
): void => {
  sensorLog(actionId, 'debounce', location, {
    delay,
    collapsed,
    debounceActive: true,
    debounceType: 'call-collapse'
  })
}

/**
 * CRITICAL FIX: Change detection skip sensor
 */
const sensorChangeDetectionSkip = (
  actionId: ActionId,
  location?: string
): void => {
  sensorLog(actionId, 'skip', location, {
    skipReason: 'payload-unchanged',
    changeDetectionActive: true
  })
}

/**
 * CRITICAL FIX: Service blocked sensor
 */
const sensorServiceBlocked = (
  actionId: ActionId,
  reason: string,
  location?: string
): void => {
  sensorLog(actionId, 'blocked', location, {
    blockReason: reason,
    serviceAvailable: false
  })
}

export const // Sensor interface
  sensor = {
    log: sensorLog,

    // CRITICAL FIX: Properly implemented sensor methods
    execution: (
      actionId: ActionId,
      duration: number,
      category?: string,
      location?: string
    ) => {
      sensorLog(actionId, 'execution', location, {duration, category})
    },

    throttle: sensorThrottle,
    debounce: sensorDebounce,

    error: (
      actionId: ActionId,
      error: string,
      location?: string,
      stack?: string
    ) => {
      sensorLog(actionId, 'error', location, {error, stack})
    },

    middleware: (
      actionId: ActionId,
      middlewareId: string,
      result: 'accept' | 'reject' | 'transform',
      location?: string
    ) => {
      sensorLog(actionId, 'middleware', location, {middlewareId, result})
    },

    intralink: (
      fromActionId: ActionId,
      toActionId: ActionId,
      location?: string
    ) => {
      sensorLog(fromActionId, 'intralink', location, {toActionId})
    },

    timeout: (actionId: ActionId, timeout: number, location?: string) => {
      sensorLog(actionId, 'timeout', location, {timeout})
    },

    callToDispatch: (actionId: ActionId, metadata?: Record<string, any>) => {
      sensorLog(actionId, 'dispatch', 'call-to-dispatch', metadata)
    },

    dispatchToExecute: (
      actionId: ActionId,
      executionTime?: number,
      metadata?: Record<string, any>
    ) => {
      sensorLog(actionId, 'execution', 'dispatch-to-execute', {
        executionTime,
        ...metadata
      })
    },

    // CRITICAL FIX: New sensor methods for missing events
    skip: sensorChangeDetectionSkip,
    blocked: sensorServiceBlocked
  }

/**
 * Main metrics interface with comprehensive sensor architecture
 */
export const metricsReport = {
  // Enhanced sensor interface
  sensor,
  // Live streaming
  createStream: (
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
  },

  removeStream: (streamId: string): boolean => {
    const stream = streamStore.get(streamId)
    if (stream) {
      stream.active = false
      streamStore.set(streamId, stream)
      return streamStore.forget(streamId)
    }
    return false
  },

  // Enhanced tracking methods
  trackExecution: (actionId: string, duration: number, category?: string) => {
    sensorLog(actionId, 'execution', 'execution-tracking', {duration, category})
  },

  trackError: (actionId: string, error: string, location?: string) => {
    sensorLog(actionId, 'error', location || 'error-tracking', {error})
  },

  trackProtection: (actionId: string, protectionType: string) => {
    sensorLog(actionId, protectionType as EventType, 'protection-system')
  },

  trackMiddlewareRejection: (actionId: string) => {
    sensorLog(actionId, 'middleware', 'middleware-rejection', {
      result: 'reject'
    })
  },

  trackThrottle: (actionId: string) => {
    sensorThrottle(actionId, 0, 'throttle-protection')
  },

  trackDebounce: (actionId: string) => {
    sensorDebounce(actionId, 0, 1, 'debounce-protection')
  },

  trackChangeDetectionSkip: (actionId: string) => {
    sensorChangeDetectionSkip(actionId, 'change-detection')
  },

  // Data export
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

    events.sort((a, b) => b.timestamp - a.timestamp)

    if (query?.offset) {
      events = events.slice(query.offset)
    }
    if (query?.limit) {
      events = events.slice(0, query.limit)
    }

    return events
  },

  getLiveEvents: (query?: LiveQuery): RawMetricEvent[] => {
    let events = [...liveEventBuffer]
    if (query && matchesFilter) {
      events = events.filter(event => matchesFilter(event, query))
    }
    return events.slice(0, query?.limit || 100)
  },

  // CRITICAL FIX: System stats with proper call counting
  getSystemStats: (): SystemStats => ({...systemStats}),

  getActionStats: (actionId: ActionId): ActionStats | undefined => {
    return actionStatsStore.get(actionId)
  },

  getActionMetrics: (actionId: ActionId): ActionStats | undefined => {
    return actionStatsStore.get(actionId)
  },

  // Enhanced reporting
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
    const allStreams = streamStore.getAll()
    allStreams.forEach(stream => {
      stream.active = false
      streamStore.set(stream.id, stream)
    })
    streamStore.clear()
  }
}

// Required interfaces and types
interface ActionStats {
  id: ActionId
  calls: number
  errors: number
  lastCall: number
}

interface EventFilter {
  actionIds?: string[]
  eventTypes?: EventType[]
  since?: number
  priority?: Priority[]
  location?: string
}

interface LiveQuery extends EventFilter {
  limit?: number
  offset?: number
}

interface StreamSubscription {
  id: string
  filter: EventFilter
  callback: (event: RawMetricEvent) => void
  active: boolean
}

// Helper functions
let streamIdCounter = 0
let cleanupTimer: NodeJS.Timeout | undefined

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

const notifyStreams = (event: RawMetricEvent): void => {
  const activeStreams = streamStore.getAll().filter(s => s.active)

  for (const stream of activeStreams) {
    try {
      if (matchesFilter(event, stream.filter)) {
        stream.callback(event)
      }
    } catch (error) {
      log.error(`Stream notification failed for ${stream.id}: ${error}`)
      stream.active = false
      streamStore.set(stream.id, stream)
    }
  }
}

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

const cleanup = (): void => {
  try {
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

    const activeStreams = streamStore.getAll().filter(s => s.active)
    streamStore.clear()
    activeStreams.forEach(stream => {
      streamStore.set(stream.id, stream)
    })
  } catch (error) {
    log.error(`Metrics cleanup failed: ${error}`)
  }
}

// Initialize on load
metricsReport.initialize()
