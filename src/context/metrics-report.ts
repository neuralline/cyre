// src/context/metrics-report.ts
// Unified metrics system with timestamp-based analysis and minimal specialized sensors

import {createStore} from './create-store'
import type {ActionId, Priority, StateKey} from '../types/interface'
import {log} from '../components/cyre-log'
import {metricsState} from './metrics-state'

/*

      C.Y.R.E - M.E.T.R.I.C.S - R.E.P.O.R.T
      
      Simplified unified sensor architecture:
      - Single sensor.log() for most events with EventType classification
      - Timestamp-based timing analysis (no complex timing objects)
      - Specialized sensors only for multi-state updates or data processing
      - Eliminates redundant historyState (IO state + metrics handles this)
      - Functional approach with minimal overhead

*/

export type EventType =
  | 'call'
  | 'dispatch'
  | 'execution'
  | 'error'
  | 'throttle'
  | 'debounce'
  | 'skip'
  | 'middleware'
  | 'intralink'
  | 'timeout'
  | 'system'
  | 'info'
  | 'debug'
  | 'delayed'
  | 'blocked'

// Simple event structure - timestamp-based timing
export interface MetricEvent {
  id: string
  timestamp: number
  actionId: ActionId
  eventType: EventType
  location?: string
  priority?: Priority
  metadata?: Record<string, any>
}

// System performance (calculated from events)
export interface SystemStats {
  totalCalls: number
  totalExecutions: number
  totalErrors: number
  callRate: number
  startTime: number
}

// Configuration
const RETENTION_CONFIG = {
  MAX_EVENTS: 1000,
  CLEANUP_INTERVAL: 30000,
  TIMING_WINDOW: 60000 // 1 minute for timing calculations
}

// Storage
const eventStore = createStore<MetricEvent>()
let eventSequence = 0
let systemStartTime = Date.now()

/**
 * Core unified sensor - handles logging, metrics state, and event storage
 */
const unifiedSensor = (
  actionId: ActionId,
  eventType: EventType,
  location?: string,
  metadata?: Record<string, any>
): void => {
  const timestamp = Date.now()

  try {
    // 1. Store metric event
    const event: MetricEvent = {
      id: `evt-${++eventSequence}`,
      timestamp,
      actionId,
      eventType,
      location,
      metadata
    }
    eventStore.set(event.id, event)

    // 2. Update metrics state (breathing system)
    if (eventType === 'call') {
      metricsState.recordCall(metadata?.priority || 'medium')
    }

    // 3. Log to console (with appropriate log level)
    const logLevel = getLogLevel(eventType)
    const message = formatLogMessage(actionId, eventType, location, metadata)

    switch (logLevel) {
      case 'error':
        log.error(message)
        break
      case 'warn':
        log.warn(message)
        break
      case 'critical':
        log.critical(message)
        break
      case 'debug':
        log.debug(message)
        break
      default:
        log.info(message)
    }

    // 4. Periodic cleanup
    if (eventSequence % 100 === 0) {
      cleanup()
    }
  } catch (error) {
    log.error(`Unified sensor failed: ${error}`)
  }
}

/**
 * Map event types to log levels
 */
const getLogLevel = (
  eventType: EventType
): 'error' | 'warn' | 'critical' | 'debug' | 'info' => {
  switch (eventType) {
    case 'error':
    case 'timeout':
      return 'error'
    case 'blocked':
    case 'throttle':
      return 'warn'
    case 'system':
      return 'critical'
    case 'debug':
      return 'debug'
    default:
      return 'info'
  }
}

/**
 * Format log message consistently
 */
const formatLogMessage = (
  actionId: ActionId,
  eventType: EventType,
  location?: string,
  metadata?: Record<string, any>
): string => {
  const parts = [eventType.toUpperCase()]

  if (location) parts.push(`[${location}]`)
  parts.push(actionId)

  if (metadata) {
    const metaParts = []
    if (metadata.duration) metaParts.push(`${metadata.duration.toFixed(2)}ms`)
    if (metadata.remaining) metaParts.push(`${metadata.remaining}ms remaining`)
    if (metadata.error) metaParts.push(metadata.error)
    if (metaParts.length > 0) parts.push(`(${metaParts.join(', ')})`)
  }

  return parts.join(' ')
}

/**
 * Specialized sensor: Call lifecycle tracking
 * Updates multiple states: event log + IO metrics + breathing state
 */
const callLifecycleSensor = (
  actionId: ActionId,
  stage: 'start' | 'dispatch' | 'execute' | 'complete' | 'error',
  metadata?: Record<string, any>
): void => {
  const timestamp = Date.now()

  // Determine event type and location
  const eventMap = {
    start: {eventType: 'call' as EventType, location: 'call-initiation'},
    dispatch: {eventType: 'dispatch' as EventType, location: 'call-dispatch'},
    execute: {
      eventType: 'execution' as EventType,
      location: 'handler-execution'
    },
    complete: {
      eventType: 'execution' as EventType,
      location: 'call-completion'
    },
    error: {eventType: 'error' as EventType, location: 'execution-error'}
  }

  const {eventType, location} = eventMap[stage]

  // Use unified sensor for logging and event storage
  unifiedSensor(actionId, eventType, location, {
    ...metadata,
    stage,
    timestamp
  })

  // Update IO state metrics if execution completed
  if (stage === 'complete' || stage === 'error') {
    import('./state')
      .then(({io}) => {
        io.trackExecution(actionId, metadata?.duration)
      })
      .catch(err => log.error(`Failed to update IO metrics: ${err}`))
  }
}

/**
 * Specialized sensor: Protection events with state updates
 * Handles throttle/debounce/skip with proper state management
 */
const protectionSensor = (
  actionId: ActionId,
  protectionType: 'throttle' | 'debounce' | 'skip',
  blocked: boolean,
  metadata?: Record<string, any>
): void => {
  const eventType = blocked ? 'blocked' : protectionType

  // Log protection event
  unifiedSensor(actionId, eventType, `${protectionType}-protection`, metadata)

  // Update breathing state if system is under protection pressure
  if (
    blocked &&
    (protectionType === 'throttle' || protectionType === 'debounce')
  ) {
    const currentState = metricsState.get()
    if (currentState.stress.combined < 0.5) {
      // Only if not already stressed
      metricsState.update({
        stress: {
          ...currentState.stress,
          combined: Math.min(1, currentState.stress.combined + 0.1)
        }
      })
    }
  }
}

/**
 * Calculate timing analysis from events (timestamp-based)
 */
const calculateTimingAnalysis = (
  actionId: ActionId,
  timeWindow = RETENTION_CONFIG.TIMING_WINDOW
) => {
  const now = Date.now()
  const events = eventStore
    .getAll()
    .filter(e => e.actionId === actionId && e.timestamp > now - timeWindow)
    .sort((a, b) => a.timestamp - b.timestamp)

  const callEvents = events.filter(e => e.eventType === 'call')
  const dispatchEvents = events.filter(e => e.eventType === 'dispatch')
  const executionEvents = events.filter(e => e.eventType === 'execution')
  const errorEvents = events.filter(e => e.eventType === 'error')

  // Calculate timing pairs
  const timings = callEvents
    .map(callEvent => {
      const dispatchEvent = dispatchEvents.find(
        d =>
          d.timestamp >= callEvent.timestamp &&
          d.timestamp <= callEvent.timestamp + 1000 // within 1 second
      )
      const executionEvent = executionEvents.find(
        e =>
          e.timestamp >= callEvent.timestamp &&
          e.timestamp <= callEvent.timestamp + 1000
      )

      if (!executionEvent) return null

      return {
        callToDispatch: dispatchEvent
          ? dispatchEvent.timestamp - callEvent.timestamp
          : 0,
        dispatchToExecution:
          dispatchEvent && executionEvent
            ? executionEvent.timestamp - dispatchEvent.timestamp
            : 0,
        totalTime: executionEvent.timestamp - callEvent.timestamp,
        handlerTime: executionEvent.metadata?.duration || 0
      }
    })
    .filter(Boolean)

  if (timings.length === 0) {
    return {
      avgCallToDispatch: 0,
      avgDispatchToExecution: 0,
      avgTotalTime: 0,
      avgHandlerTime: 0,
      avgPipelineOverhead: 0,
      sampleCount: 0
    }
  }

  const totals = timings.reduce(
    (acc, timing) => {
      acc.callToDispatch += timing.callToDispatch
      acc.dispatchToExecution += timing.dispatchToExecution
      acc.totalTime += timing.totalTime
      acc.handlerTime += timing.handlerTime
      return acc
    },
    {callToDispatch: 0, dispatchToExecution: 0, totalTime: 0, handlerTime: 0}
  )

  const count = timings.length
  const avgTotalTime = totals.totalTime / count
  const avgHandlerTime = totals.handlerTime / count

  return {
    avgCallToDispatch: totals.callToDispatch / count,
    avgDispatchToExecution: totals.dispatchToExecution / count,
    avgTotalTime,
    avgHandlerTime,
    avgPipelineOverhead: avgTotalTime - avgHandlerTime,
    sampleCount: count
  }
}

/**
 * Get system statistics from events
 */
const getSystemStats = (): SystemStats => {
  const events = eventStore.getAll()
  const now = Date.now()
  const last10Seconds = events.filter(e => e.timestamp > now - 10000)

  return {
    totalCalls: events.filter(e => e.eventType === 'call').length,
    totalExecutions: events.filter(e => e.eventType === 'execution').length,
    totalErrors: events.filter(e => e.eventType === 'error').length,
    callRate: Math.floor(
      last10Seconds.filter(e => e.eventType === 'call').length / 10
    ),
    startTime: systemStartTime
  }
}

/**
 * Cleanup old events
 */
const cleanup = (): void => {
  try {
    const allEvents = eventStore.getAll()
    if (allEvents.length > RETENTION_CONFIG.MAX_EVENTS) {
      eventStore.clear()
      const recentEvents = allEvents
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, RETENTION_CONFIG.MAX_EVENTS)
      recentEvents.forEach(event => eventStore.set(event.id, event))
    }
  } catch (error) {
    log.error(`Metrics cleanup failed: ${error}`)
  }
}

/**
 * Main metrics interface - simplified and unified
 */
export const metricsReport = {
  // Core unified sensor (90% of usage)
  sensor: {
    log: unifiedSensor
  },

  // Specialized sensors (10% of usage - multi-state updates)
  callLifecycle: callLifecycleSensor,
  protection: protectionSensor,

  // Convenience methods for common events
  trackCall: (actionId: ActionId, priority?: Priority) =>
    callLifecycleSensor(actionId, 'start', {priority}),

  trackDispatch: (actionId: ActionId) =>
    callLifecycleSensor(actionId, 'dispatch'),

  trackExecution: (actionId: ActionId, duration?: number) =>
    callLifecycleSensor(actionId, 'execute', {duration}),

  trackError: (actionId: ActionId, error: string) =>
    callLifecycleSensor(actionId, 'error', {error}),

  trackThrottle: (actionId: ActionId, blocked: boolean, remaining?: number) =>
    protectionSensor(actionId, 'throttle', blocked, {remaining}),

  trackDebounce: (actionId: ActionId, blocked: boolean, delay?: number) =>
    protectionSensor(actionId, 'debounce', blocked, {delay}),

  trackSkip: (actionId: ActionId, reason: string) =>
    protectionSensor(actionId, 'skip', true, {reason}),

  // Analysis and reporting
  getTimingAnalysis: calculateTimingAnalysis,
  getSystemStats,

  getActionStats: (actionId: ActionId) => {
    const events = eventStore.getAll().filter(e => e.actionId === actionId)
    return {
      totalCalls: events.filter(e => e.eventType === 'call').length,
      totalExecutions: events.filter(e => e.eventType === 'execution').length,
      totalErrors: events.filter(e => e.eventType === 'error').length,
      totalThrottles: events.filter(e => e.eventType === 'throttle').length,
      totalDebounces: events.filter(e => e.eventType === 'debounce').length,
      avgExecutionTime: (() => {
        const execEvents = events.filter(
          e => e.eventType === 'execution' && e.metadata?.duration
        )
        if (execEvents.length === 0) return 0
        const total = execEvents.reduce(
          (sum, e) => sum + (e.metadata?.duration || 0),
          0
        )
        return total / execEvents.length
      })()
    }
  },

  // Data export
  exportEvents: (filter?: {
    actionIds?: string[]
    eventTypes?: EventType[]
    since?: number
    limit?: number
  }): MetricEvent[] => {
    let events = eventStore.getAll()

    if (filter) {
      if (filter.actionIds) {
        events = events.filter(e => filter.actionIds!.includes(e.actionId))
      }
      if (filter.eventTypes) {
        events = events.filter(e => filter.eventTypes!.includes(e.eventType))
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!)
      }
    }

    events.sort((a, b) => b.timestamp - a.timestamp)
    return filter?.limit ? events.slice(0, filter.limit) : events
  },

  getBasicReport: (): string => {
    const stats = getSystemStats()
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000)
    const eventCount = eventStore.getAll().length

    return `CYRE Metrics Report
===================
Uptime: ${uptime}s
Total Calls: ${stats.totalCalls}
Total Executions: ${stats.totalExecutions}
Total Errors: ${stats.totalErrors}
Call Rate: ${stats.callRate}/sec
Events Collected: ${eventCount}`
  },

  // System management
  reset: (): void => {
    eventStore.clear()
    eventSequence = 0
    systemStartTime = Date.now()
  },

  shutdown: (): void => {
    cleanup()
  }
}

// Auto-cleanup
setInterval(cleanup, RETENTION_CONFIG.CLEANUP_INTERVAL)
