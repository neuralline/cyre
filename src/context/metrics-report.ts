// src/context/metrics-collector.ts
// FIXED: Lightweight metrics collection for external monitoring - no heavy processing

import {createStore} from './create-store'
import type {ActionId, Priority, StateKey} from '../types/interface'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E. - M.E.T.R.I.C.S. - C.O.L.L.E.C.T.O.R.
      
      Lightweight metrics collection system:
      - Raw timestamped events only
      - Minimal memory footprint
      - External monitoring friendly
      - No internal processing/analysis
      - Mission-critical data for Cyre breathing system only

*/
//metrics-report should track these event types
export type EventType =
  | 'call'
  | 'dispatch'
  | 'execution'
  | 'error'
  | 'warning'
  | 'critical'
  | 'success'
  | 'info'
  | 'debug'
  | 'throttle'
  | 'debounce'
  | 'skip'
  | 'delayed'
  | 'repeat'
  | 'blocked'
  | 'unknown id'
  | 'no subscriber'
  | 'other'
// Raw event types for external monitoring
export interface RawMetricEvent {
  timestamp: number
  actionId: ActionId
  eventType: EventType
  priority: Priority
  metadata?: {
    executionTime?: number
    pipelineOverhead?: number
    category?: string
    error?: string
  }
}

// Minimal action stats for Cyre core (breathing system needs)
export interface ActionStats {
  id: ActionId
  calls: number
  executions: number
  errors: number
  lastCall: number
  lastExecution: number
  // Keep minimal for memory efficiency
}

// Global system stats (mission critical for breathing system)
export interface SystemStats {
  totalCalls: number
  totalExecutions: number
  totalErrors: number
  callRate: number // For breathing system stress calculation
  lastCallTime: number
  startTime: number
}

// Configuration for data retention
const RETENTION_CONFIG = {
  MAX_EVENTS: 1000, // Keep only recent events
  MAX_ACTIONS: 500, // Limit tracked actions
  CLEANUP_INTERVAL: 10000, // Cleanup every 10 seconds
  EXPORT_BATCH_SIZE: 100 // Batch size for exports
}

// Create lightweight stores
const eventStore = createStore<RawMetricEvent>()
const actionStatsStore = createStore<ActionStats>()

// Global system stats (single object, not store)
let systemStats: SystemStats = {
  totalCalls: 0,
  totalExecutions: 0,
  totalErrors: 0,
  callRate: 0,
  lastCallTime: Date.now(),
  startTime: Date.now()
}

// Event sequence counter for ordering
let eventSequence = 0

// Cleanup timer
let cleanupTimer: NodeJS.Timeout | undefined

/**
 * Initialize cleanup timer
 */
const initializeCleanup = (): void => {
  if (cleanupTimer) return

  cleanupTimer = setInterval(() => {
    try {
      // Get all events and keep only recent ones
      const allEvents = eventStore.getAll()
      if (allEvents.length > RETENTION_CONFIG.MAX_EVENTS) {
        // Clear store and keep only recent events
        eventStore.clear()
        const recentEvents = allEvents
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, RETENTION_CONFIG.MAX_EVENTS)

        recentEvents.forEach((event, index) => {
          eventStore.set(`event-${Date.now()}-${index}`, event)
        })
      }

      // Limit action stats
      const allStats = actionStatsStore.getAll()
      if (allStats.length > RETENTION_CONFIG.MAX_ACTIONS) {
        // Remove oldest/least active actions
        const sortedStats = allStats
          .sort((a, b) => b.lastCall - a.lastCall)
          .slice(0, RETENTION_CONFIG.MAX_ACTIONS)

        actionStatsStore.clear()
        sortedStats.forEach(stat => {
          actionStatsStore.set(stat.id, stat)
        })
      }
    } catch (error) {
      log.error(`Metrics cleanup failed: ${error}`)
    }
  }, RETENTION_CONFIG.CLEANUP_INTERVAL)
}

/**
 * Create raw metric event
 */
const createEvent = (
  actionId: ActionId,
  eventType: RawMetricEvent['eventType'],
  priority: Priority = 'medium',
  metadata?: RawMetricEvent['metadata']
): RawMetricEvent => ({
  timestamp: Date.now(),
  actionId,
  eventType,
  priority,
  metadata
})

/**
 * Get or create action stats
 */
const getActionStats = (actionId: ActionId): ActionStats => {
  const existing = actionStatsStore.get(actionId)
  if (existing) return existing

  const newStats: ActionStats = {
    id: actionId,
    calls: 0,
    executions: 0,
    errors: 0,
    lastCall: 0,
    lastExecution: 0
  }

  actionStatsStore.set(actionId, newStats)
  return newStats
}

/**
 * Update system call rate (mission critical for breathing system)
 */
const updateCallRate = (): void => {
  const now = Date.now()
  const timeDiff = now - systemStats.lastCallTime

  if (timeDiff >= 1000) {
    // Calculate calls per second for last second
    const recentCalls = eventStore
      .getAll()
      .filter(
        event => event.eventType === 'call' && event.timestamp > now - 1000
      ).length

    systemStats.callRate = recentCalls
    systemStats.lastCallTime = now
  }
}

/**
 * LIGHTWEIGHT METRICS COLLECTOR
 */
export const metricsReport = {
  /**
   * Initialize the collector
   */
  initialize: (): void => {
    systemStats.startTime = Date.now()
    initializeCleanup()
  },

  /**
   * Record a call event
   */
  trackCall: (actionId: ActionId, priority: Priority = 'medium'): void => {
    try {
      // Create raw event
      const event = createEvent(actionId, 'call', priority)
      eventStore.set(`call-${eventSequence++}`, event)

      // Update action stats
      const stats = getActionStats(actionId)
      stats.calls++
      stats.lastCall = event.timestamp
      actionStatsStore.set(actionId, stats)

      // Update system stats
      systemStats.totalCalls++
      updateCallRate()
    } catch (error) {
      log.error(`Call tracking failed: ${error}`)
    }
  },

  /**
   * Record execution event with timing
   */
  trackExecution: (
    actionId: ActionId,
    executionTime: number,
    category?: string
  ): void => {
    try {
      // Create raw event with timing
      const event = createEvent(actionId, 'execution', 'medium', {
        executionTime,
        category
      })
      eventStore.set(`exec-${eventSequence++}`, event)

      // Update action stats
      const stats = getActionStats(actionId)
      stats.executions++
      stats.lastExecution = event.timestamp
      actionStatsStore.set(actionId, stats)

      // Update system stats
      systemStats.totalExecutions++
    } catch (error) {
      log.error(`Execution tracking failed: ${error}`)
    }
  },

  /**
   * Record error event
   */
  trackError: (actionId: ActionId, error?: string): void => {
    try {
      const event = createEvent(actionId, 'error', 'medium', {error})
      eventStore.set(`error-${eventSequence++}`, event)

      // Update action stats
      const stats = getActionStats(actionId)
      stats.errors++
      actionStatsStore.set(actionId, stats)

      // Update system stats
      systemStats.totalErrors++
    } catch (error) {
      log.error(`Error tracking failed: ${error}`)
    }
  },

  /**
   * Record protection events (throttle, debounce, skip)
   */
  trackProtection: (actionId: ActionId, eventType: EventType): void => {
    try {
      const event = createEvent(actionId, eventType)
      eventStore.set(`${eventType}-${eventSequence++}`, event)
    } catch (error) {
      log.error(`Protection tracking failed: ${error}`)
    }
  },
  /**
   * Record middleware rejection events
   */
  trackMiddleware: (actionId: ActionId, eventType: EventType): void => {
    try {
      const event = createEvent(actionId, eventType)
      eventStore.set(`middleware-${eventSequence++}`, event)
    } catch (error) {
      log.error(`Middleware rejection tracking failed: ${error}`)
    }
  },

  /**
   * Get current system stats (for breathing system)
   */
  getSystemStats: (): SystemStats => {
    updateCallRate()
    return {...systemStats}
  },

  /**
   * Get action stats (minimal, for core Cyre functions)
   */
  getActionStats: (actionId: ActionId): ActionStats | undefined => {
    return actionStatsStore.get(actionId)
  },

  /**
   * Export raw events for external monitoring
   */
  exportEvents: (filter?: {
    actionId?: ActionId
    eventType?: EventType
    since?: number
    limit?: number
  }): RawMetricEvent[] => {
    try {
      let events = eventStore.getAll()

      // Apply filters
      if (filter?.actionId) {
        events = events.filter(e => e.actionId === filter.actionId)
      }
      if (filter?.eventType) {
        events = events.filter(e => e.eventType === filter.eventType)
      }
      if (filter?.since) {
        events = events.filter(e => e.timestamp >= filter.since!)
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp - a.timestamp)

      // Apply limit
      if (filter?.limit) {
        events = events.slice(0, filter.limit)
      }

      return events
    } catch (error) {
      log.error(`Event export failed: ${error}`)
      return []
    }
  },

  /**
   * Export all action stats for external monitoring
   */
  exportActionStats: (): ActionStats[] => {
    return actionStatsStore.getAll()
  },

  /**
   * Get basic report for debugging (minimal processing)
   */
  getBasicReport: (): string => {
    const stats = metricsReport.getSystemStats()
    const uptime = Math.floor((Date.now() - stats.startTime) / 1000)
    const actionCount = actionStatsStore.getAll().length
    const eventCount = eventStore.getAll().length

    return `CYRE Lightweight Metrics Report
====================================
Uptime: ${uptime}s
Total Actions: ${actionCount}
Total Calls: ${stats.totalCalls}
Total Executions: ${stats.totalExecutions}
Total Errors: ${stats.totalErrors}
Current Call Rate: ${stats.callRate} calls/sec
Events in Buffer: ${eventCount}
Memory Usage: Lightweight (${eventCount} events, ${actionCount} actions)`
  },

  /**
   * Clear all collected data
   */
  reset: (): void => {
    eventStore.clear()
    actionStatsStore.clear()
    systemStats = {
      totalCalls: 0,
      totalExecutions: 0,
      totalErrors: 0,
      callRate: 0,
      lastCallTime: Date.now(),
      startTime: Date.now()
    }
    eventSequence = 0
    log.error('📊 Metrics collector reset')
  },

  /**
   * Cleanup and shutdown
   */
  shutdown: (): void => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = undefined
    }
    metricsReport.reset()
    log.error('📊 Metrics collector shutdown')
  },

  /**
   * Get memory usage info
   */
  getMemoryInfo: () => ({
    eventCount: eventStore.getAll().length,
    actionCount: actionStatsStore.getAll().length,
    maxEvents: RETENTION_CONFIG.MAX_EVENTS,
    maxActions: RETENTION_CONFIG.MAX_ACTIONS,
    isHealthy: eventStore.getAll().length < RETENTION_CONFIG.MAX_EVENTS * 0.9
  })
}

// Initialize on module load
metricsReport.initialize()

// Export types for external monitoring systems
