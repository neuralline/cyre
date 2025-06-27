// src/metrics/core.ts
// Core metrics collection with proper channel metrics retrieval

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
      
      Core metrics collection with proper channel metrics:
      - Single responsibility: collect and store events
      - Fast event recording with minimal processing
      - Proper channel metrics tracking and retrieval
      - Clean separation from analysis

*/

// Event storage
const eventStore = createStore<RawEvent>()
const channelStore = createStore<ChannelMetrics>()

// System state
let systemMetrics = {
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
    //eventStore.set(rawEvent.id, rawEvent)

    // Update metrics efficiently
    //updateMetrics(rawEvent)

    // Terminal output if requested
    if (event.log) {
      sendToLog(event.logLevel || 'DEBUG', event)
    }

    // // Periodic cleanup
    // if (eventSequence % 100 === 0) {
    //   scheduleCleanup()
    // }
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
  }): void => {
    const {retentionTime = 3600000, cleanupInterval = 300000} = config || {}

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
  let metrics = channelStore.get(event.actionId) || {
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

  // Ensure protectionEvents is always properly initialized
  if (!metrics.protectionEvents) {
    metrics.protectionEvents = {
      throttled: 0,
      debounced: 0,
      blocked: 0,
      skipped: 0
    }
  }

  // Update counters based on event type and location
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
      // Only count actual execution errors, not pipeline skips
      const isActualError =
        event.location === 'handler-error' ||
        (event.location !== 'protection' &&
          event.location !== 'processing-pipeline-blocked' &&
          !event.metadata?.blocked &&
          !event.metadata?.successfulProtection)

      if (isActualError) {
        metrics.errors++
        metrics.actualErrors = (metrics.actualErrors || 0) + 1
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
    const actualErrors = metrics.actualErrors || 0
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
 * Schedule cleanup to avoid blocking
 */
const scheduleCleanup = (): void => {
  process.nextTick(() => cleanupOldEvents())
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
  // Better error context and suggestions
  if (event.eventType === 'error') {
    if (
      event.location === 'schema-talent' &&
      event.message?.includes('Cannot read properties of undefined')
    ) {
      return `${event.actionId}: Schema validation failed - missing schema property. Add schema to your action config.`
    }

    if (event.location === 'compilation-errors') {
      return `${event.actionId}: ${event.message}. Check your action configuration.`
    }

    if (event.message?.includes('Priority must be an object')) {
      return `${event.actionId}: Priority should be a string like "high", not an object. Use priority: "high" instead of priority: { level: "high" }`
    }
  }

  // Better warning context
  if (event.eventType === 'warning') {
    if (event.message?.includes('schema validation without required')) {
      return `${event.actionId}: Schema defined but no 'required' field. Add required: true to enforce payload validation.`
    }

    if (event.message?.includes('DUPLICATE LISTENER')) {
      return `${event.actionId}: Duplicate listener detected. Use cyre.forget('${event.actionId}') before adding new listeners.`
    }
  }

  // Throttle/debounce info
  if (event.eventType === 'throttle') {
    const remaining = event.metadata?.remaining || 0
    return `${event.actionId}: Throttled (${remaining}ms remaining) - this is expected behavior`
  }

  if (event.eventType === 'debounce') {
    const delay = event.metadata?.debounceMs || 0
    return `⏳ ${event.actionId}: Debounced (${delay}ms) - this is expected behavior`
  }

  // Success/info messages
  if (event.eventType === 'success') {
    return `✅ ${event.actionId}: ${
      event.message || 'Operation completed successfully'
    }`
  }

  // Default format with better structure
  let msg = `${event.actionId}`

  if (
    event.location &&
    !['talent-', 'schema-', 'compilation-'].some(prefix =>
      event.location!.startsWith(prefix)
    )
  ) {
    msg += ` (${event.location})`
  }

  if (event.message) {
    msg += `: ${event.message}`
  }

  // Add useful metadata without clutter
  if (event.metadata) {
    const meta = event.metadata
    const parts: string[] = []

    if (typeof meta.duration === 'number') parts.push(`${meta.duration}ms`)
    if (typeof meta.remaining === 'number')
      parts.push(`${meta.remaining}ms left`)
    if (meta.reason && typeof meta.reason === 'string') parts.push(meta.reason)

    if (parts.length > 0) msg += ` (${parts.join(', ')})`
  }

  return msg
}
