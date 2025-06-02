// src/query/cyre-query.ts
// Functional query system for Cyre channels and orchestrations

import type {ActionPayload, IO} from '../types/core'
import {io, subscribers} from '../context/state'
import {metricsReport} from '../context/metrics-report'
import payloadState from '../context/payload-state'
import {groupOperations} from '../components/cyre-group'

/*

      C.Y.R.E - Q.U.E.R.Y
      
      Functional query system for channels, payloads, and orchestrations:
      - Real-time channel state queries
      - Payload history and aggregation
      - Performance metrics queries
      - Group-based queries
      - Orchestration status queries

*/

export interface QueryFilter {
  channelPattern?: string | RegExp
  groupId?: string
  hasPayload?: boolean
  isActive?: boolean
  hasSubscriber?: boolean
  lastExecutedSince?: number
  errorCount?: {gt?: number; lt?: number}
  executionCount?: {gt?: number; lt?: number}
}

export interface QueryResult<T = any> {
  channels: Array<{
    id: string
    config: IO
    payload?: ActionPayload
    subscriber?: boolean
    lastExecuted?: number
    executionCount: number
    errorCount: number
    groupIds: string[]
  }>
  total: number
  filtered: number
  metadata: {
    queryTime: number
    timestamp: number
  }
}

export interface PayloadQuery {
  channelId?: string
  channelPattern?: string | RegExp
  since?: number
  until?: number
  limit?: number
  transform?: (payload: ActionPayload) => any
  aggregate?: 'count' | 'avg' | 'sum' | 'min' | 'max'
  groupBy?: string
}

export interface MetricsQuery {
  actionId?: string
  eventType?: string[]
  since?: number
  until?: number
  limit?: number
  aggregateBy?: 'hour' | 'day' | 'channel'
}

// Channel matching utility
const matchesPattern = (
  channelId: string,
  pattern: string | RegExp
): boolean => {
  if (typeof pattern === 'string') {
    if (pattern === channelId) return true
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
    return new RegExp(`^${regexPattern}$`).test(channelId)
  }
  return pattern.test(channelId)
}

// Get all matching channels
const getMatchingChannels = (pattern?: string | RegExp): string[] => {
  if (!pattern) return io.getAll().map(action => action.id)

  return io
    .getAll()
    .map(action => action.id)
    .filter(id => matchesPattern(id, pattern))
}

/**
 * Query channels with filters
 */
export const queryChannels = (filter: QueryFilter = {}): QueryResult => {
  const startTime = performance.now()

  let channels = io.getAll()

  // Apply pattern filter
  if (filter.channelPattern) {
    const matchingIds = getMatchingChannels(filter.channelPattern)
    channels = channels.filter(channel => matchingIds.includes(channel.id))
  }

  // Apply group filter
  if (filter.groupId) {
    const group = groupOperations.get(filter.groupId)
    if (group) {
      channels = channels.filter(channel =>
        group.matchedChannels.has(channel.id)
      )
    } else {
      channels = []
    }
  }

  // Build result with enriched data
  const enrichedChannels = channels.map(channel => {
    const payload = payloadState.get(channel.id)
    const subscriber = subscribers.get(channel.id)
    const metrics = io.getMetrics(channel.id)
    const channelGroups = groupOperations.getChannelGroups(channel.id)

    return {
      id: channel.id,
      config: channel,
      payload,
      subscriber: !!subscriber,
      lastExecuted: metrics?.lastExecutionTime,
      executionCount: metrics?.executionCount || 0,
      errorCount: metrics?.errors?.length || 0,
      groupIds: channelGroups.map(g => g.id)
    }
  })

  // Apply additional filters
  let filteredChannels = enrichedChannels

  if (filter.hasPayload !== undefined) {
    filteredChannels = filteredChannels.filter(ch =>
      filter.hasPayload ? ch.payload !== undefined : ch.payload === undefined
    )
  }

  if (filter.hasSubscriber !== undefined) {
    filteredChannels = filteredChannels.filter(
      ch => ch.subscriber === filter.hasSubscriber
    )
  }

  if (filter.lastExecutedSince) {
    filteredChannels = filteredChannels.filter(
      ch => ch.lastExecuted && ch.lastExecuted >= filter.lastExecutedSince!
    )
  }

  if (filter.errorCount) {
    filteredChannels = filteredChannels.filter(ch => {
      if (
        filter.errorCount!.gt !== undefined &&
        ch.errorCount <= filter.errorCount!.gt
      )
        return false
      if (
        filter.errorCount!.lt !== undefined &&
        ch.errorCount >= filter.errorCount!.lt
      )
        return false
      return true
    })
  }

  if (filter.executionCount) {
    filteredChannels = filteredChannels.filter(ch => {
      if (
        filter.executionCount!.gt !== undefined &&
        ch.executionCount <= filter.executionCount!.gt
      )
        return false
      if (
        filter.executionCount!.lt !== undefined &&
        ch.executionCount >= filter.executionCount!.lt
      )
        return false
      return true
    })
  }

  return {
    channels: filteredChannels,
    total: enrichedChannels.length,
    filtered: filteredChannels.length,
    metadata: {
      queryTime: performance.now() - startTime,
      timestamp: Date.now()
    }
  }
}

/**
 * Query payload history and aggregations
 */
export const queryPayloads = (query: PayloadQuery): any => {
  const startTime = performance.now()

  // Get matching channels
  const channelIds = query.channelId
    ? [query.channelId]
    : getMatchingChannels(query.channelPattern)

  let results: any[] = []

  for (const channelId of channelIds) {
    const history = payloadState.getHistory(channelId, query.limit)

    // Apply time filters
    let filteredHistory = history
    if (query.since) {
      filteredHistory = filteredHistory.filter(
        entry => entry.timestamp >= query.since!
      )
    }
    if (query.until) {
      filteredHistory = filteredHistory.filter(
        entry => entry.timestamp <= query.until!
      )
    }

    // Apply transform
    if (query.transform) {
      filteredHistory = filteredHistory.map(entry => ({
        ...entry,
        payload: query.transform!(entry.payload)
      }))
    }

    results.push(
      ...filteredHistory.map(entry => ({
        channelId,
        ...entry
      }))
    )
  }

  // Apply aggregation
  if (query.aggregate) {
    const values = results
      .map(r => (typeof r.payload === 'number' ? r.payload : 0))
      .filter(v => !isNaN(v))

    switch (query.aggregate) {
      case 'count':
        return {count: results.length, queryTime: performance.now() - startTime}
      case 'sum':
        return {
          sum: values.reduce((a, b) => a + b, 0),
          queryTime: performance.now() - startTime
        }
      case 'avg':
        return {
          avg: values.length
            ? values.reduce((a, b) => a + b, 0) / values.length
            : 0,
          queryTime: performance.now() - startTime
        }
      case 'min':
        return {
          min: values.length ? Math.min(...values) : 0,
          queryTime: performance.now() - startTime
        }
      case 'max':
        return {
          max: values.length ? Math.max(...values) : 0,
          queryTime: performance.now() - startTime
        }
    }
  }

  // Group by if specified
  if (query.groupBy) {
    const grouped = results.reduce((acc, item) => {
      const key = item[query.groupBy!] || 'undefined'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {} as Record<string, any[]>)

    return {
      grouped,
      queryTime: performance.now() - startTime,
      timestamp: Date.now()
    }
  }

  return {
    results,
    total: results.length,
    queryTime: performance.now() - startTime,
    timestamp: Date.now()
  }
}

/**
 * Query execution metrics
 */
export const queryMetrics = (query: MetricsQuery = {}): any => {
  const startTime = performance.now()

  const events = metricsReport.exportEvents({
    actionIds: query.actionId ? [query.actionId] : undefined,
    eventTypes: query.eventType,
    since: query.since,
    limit: query.limit
  })

  // Filter by until time
  let filteredEvents = events
  if (query.until) {
    filteredEvents = filteredEvents.filter(
      event => event.timestamp <= query.until!
    )
  }

  // Apply aggregation
  if (query.aggregateBy === 'channel') {
    const byChannel = filteredEvents.reduce((acc, event) => {
      const key = event.actionId
      if (!acc[key]) {
        acc[key] = {
          channelId: key,
          events: [],
          callCount: 0,
          errorCount: 0,
          executionCount: 0
        }
      }

      acc[key].events.push(event)
      if (event.eventType === 'call') acc[key].callCount++
      if (event.eventType === 'error') acc[key].errorCount++
      if (event.eventType === 'execution') acc[key].executionCount++

      return acc
    }, {} as Record<string, any>)

    return {
      byChannel,
      queryTime: performance.now() - startTime,
      timestamp: Date.now()
    }
  }

  if (query.aggregateBy === 'hour' || query.aggregateBy === 'day') {
    const timeUnit =
      query.aggregateBy === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000

    const byTime = filteredEvents.reduce((acc, event) => {
      const timeKey = Math.floor(event.timestamp / timeUnit) * timeUnit
      if (!acc[timeKey]) {
        acc[timeKey] = {
          timestamp: timeKey,
          events: [],
          callCount: 0,
          errorCount: 0,
          executionCount: 0
        }
      }

      acc[timeKey].events.push(event)
      if (event.eventType === 'call') acc[timeKey].callCount++
      if (event.eventType === 'error') acc[timeKey].errorCount++
      if (event.eventType === 'execution') acc[timeKey].executionCount++

      return acc
    }, {} as Record<number, any>)

    return {
      byTime,
      queryTime: performance.now() - startTime,
      timestamp: Date.now()
    }
  }

  return {
    events: filteredEvents,
    total: filteredEvents.length,
    queryTime: performance.now() - startTime,
    timestamp: Date.now()
  }
}

/**
 * Query groups and their channels
 */
export const queryGroups = (filter: {pattern?: string | RegExp} = {}): any => {
  const startTime = performance.now()

  let groups = groupOperations.getAll()

  if (filter.pattern) {
    groups = groups.filter(group => matchesPattern(group.id, filter.pattern!))
  }

  const enrichedGroups = groups.map(group => ({
    ...group,
    channelCount: group.matchedChannels.size,
    channels: Array.from(group.matchedChannels),
    activeAlerts: group.alertStates.size
  }))

  return {
    groups: enrichedGroups,
    total: enrichedGroups.length,
    queryTime: performance.now() - startTime,
    timestamp: Date.now()
  }
}

/**
 * Advanced composite queries
 */
export const compositeQuery = (queries: {
  channels?: QueryFilter
  payloads?: PayloadQuery
  metrics?: MetricsQuery
  groups?: {pattern?: string | RegExp}
}): any => {
  const startTime = performance.now()
  const results: any = {}

  if (queries.channels) {
    results.channels = queryChannels(queries.channels)
  }

  if (queries.payloads) {
    results.payloads = queryPayloads(queries.payloads)
  }

  if (queries.metrics) {
    results.metrics = queryMetrics(queries.metrics)
  }

  if (queries.groups) {
    results.groups = queryGroups(queries.groups)
  }

  return {
    ...results,
    totalQueryTime: performance.now() - startTime,
    timestamp: Date.now()
  }
}

// Query API
export const query = {
  channels: queryChannels,
  payloads: queryPayloads,
  metrics: queryMetrics,
  groups: queryGroups,
  composite: compositeQuery
}
