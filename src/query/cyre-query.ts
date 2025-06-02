// src/query/cyre-query.ts
// Advanced query system with indexing, caching, and real-time capabilities

import type {ActionPayload, IO} from '../types/core'
import {io, subscribers} from '../context/state'
import {metricsReport} from '../context/metrics-report'
import payloadState from '../context/payload-state'
import {groupOperations} from '../components/cyre-group'

/*

      C.Y.R.E - Q.U.E.R.Y
      
      Advanced query system with:
      - Pre-computed indexes for fast lookups
      - LRU cache for repeated queries
      - Real-time query subscriptions
      - Efficient pattern matching
      - Memory-conscious aggregations

*/

// Query result cache with LRU eviction
class QueryCache {
  private cache = new Map<
    string,
    {result: any; timestamp: number; hits: number}
  >()
  private maxSize = 100
  private maxAge = 60000 // 1 minute

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check expiration
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key)
      return null
    }

    // Update hit count and move to end (LRU)
    entry.hits++
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.result
  }

  set(key: string, result: any): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      hits: 0
    })
  }

  clear(): void {
    this.cache.clear()
  }

  stats() {
    return {
      size: this.cache.size,
      hitRatio:
        Array.from(this.cache.values()).reduce(
          (sum, entry) => sum + entry.hits,
          0
        ) / this.cache.size
    }
  }
}

// Pre-computed indexes for fast queries
class QueryIndexes {
  private channelsByGroup = new Map<string, Set<string>>()
  private channelsByPattern = new Map<string, Set<string>>()
  private channelsWithPayload = new Set<string>()
  private channelsWithSubscribers = new Set<string>()
  private lastIndexUpdate = 0
  private indexDirty = true

  // Update indexes when data changes
  updateIndexes(): void {
    if (!this.indexDirty && Date.now() - this.lastIndexUpdate < 5000) {
      return // Skip if recently updated
    }

    const startTime = performance.now()

    // Clear existing indexes
    this.channelsByGroup.clear()
    this.channelsByPattern.clear()
    this.channelsWithPayload.clear()
    this.channelsWithSubscribers.clear()

    // Build channel indexes
    const allChannels = io.getAll()

    for (const channel of allChannels) {
      const channelId = channel.id

      // Index by groups
      const channelGroups = groupOperations.getChannelGroups(channelId)
      for (const group of channelGroups) {
        if (!this.channelsByGroup.has(group.id)) {
          this.channelsByGroup.set(group.id, new Set())
        }
        this.channelsByGroup.get(group.id)!.add(channelId)
      }

      // Index payload existence
      if (payloadState.get(channelId) !== undefined) {
        this.channelsWithPayload.add(channelId)
      }

      // Index subscriber existence
      if (subscribers.get(channelId)) {
        this.channelsWithSubscribers.add(channelId)
      }

      // Index common patterns
      this.indexChannelPatterns(channelId)
    }

    this.lastIndexUpdate = Date.now()
    this.indexDirty = false

    const indexTime = performance.now() - startTime
    if (indexTime > 10) {
      console.warn(
        `Query indexing took ${indexTime.toFixed(2)}ms for ${
          allChannels.length
        } channels`
      )
    }
  }

  private indexChannelPatterns(channelId: string): void {
    // Pre-compute common pattern matches
    const patterns = [
      'sensor-*',
      'api-*',
      'user-*',
      'system-*',
      '*-error',
      '*-success',
      '*-pending'
    ]

    for (const pattern of patterns) {
      if (this.matchesPattern(channelId, pattern)) {
        if (!this.channelsByPattern.has(pattern)) {
          this.channelsByPattern.set(pattern, new Set())
        }
        this.channelsByPattern.get(pattern)!.add(channelId)
      }
    }
  }

  private matchesPattern(channelId: string, pattern: string): boolean {
    if (pattern === channelId) return true
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
    return new RegExp(`^${regexPattern}$`).test(channelId)
  }

  // Fast lookups using indexes
  getChannelsByGroup(groupId: string): string[] {
    this.updateIndexes()
    return Array.from(this.channelsByGroup.get(groupId) || [])
  }

  getChannelsByPattern(pattern: string): string[] {
    this.updateIndexes()

    // Check if we have this pattern pre-computed
    const precomputed = this.channelsByPattern.get(pattern)
    if (precomputed) {
      return Array.from(precomputed)
    }

    // Fall back to runtime pattern matching
    return io
      .getAll()
      .map(channel => channel.id)
      .filter(id => this.matchesPattern(id, pattern))
  }

  getChannelsWithPayload(): string[] {
    this.updateIndexes()
    return Array.from(this.channelsWithPayload)
  }

  getChannelsWithSubscribers(): string[] {
    this.updateIndexes()
    return Array.from(this.channelsWithSubscribers)
  }

  markDirty(): void {
    this.indexDirty = true
  }
}

// Real-time query subscriptions
class QuerySubscription {
  private subscriptions = new Map<
    string,
    {
      query: any
      callback: (result: any) => void
      lastResult: any
      active: boolean
    }
  >()

  subscribe(
    queryId: string,
    query: any,
    callback: (result: any) => void
  ): () => void {
    this.subscriptions.set(queryId, {
      query,
      callback,
      lastResult: null,
      active: true
    })

    // Initial execution
    this.executeQuery(queryId)

    // Return unsubscribe function
    return () => {
      const subscription = this.subscriptions.get(queryId)
      if (subscription) {
        subscription.active = false
        this.subscriptions.delete(queryId)
      }
    }
  }

  // Execute query and notify if result changed
  private async executeQuery(queryId: string): Promise<void> {
    const subscription = this.subscriptions.get(queryId)
    if (!subscription || !subscription.active) return

    try {
      const result = await this.runQuery(subscription.query)

      // Check if result changed (simple comparison)
      const resultString = JSON.stringify(result)
      const lastResultString = JSON.stringify(subscription.lastResult)

      if (resultString !== lastResultString) {
        subscription.lastResult = result
        subscription.callback(result)
      }
    } catch (error) {
      console.error(`Query subscription ${queryId} failed:`, error)
    }
  }

  private async runQuery(query: any): Promise<any> {
    // Delegate to appropriate query function based on query type
    if (query.type === 'channels') {
      return fastQueryChannels(query.filter)
    } else if (query.type === 'payloads') {
      return fastQueryPayloads(query)
    } else if (query.type === 'metrics') {
      return fastQueryMetrics(query)
    }
    return null
  }

  // Trigger all subscriptions (called when data changes)
  triggerAll(): void {
    for (const [queryId] of this.subscriptions) {
      this.executeQuery(queryId)
    }
  }
}

// Global instances
const queryCache = new QueryCache()
const queryIndexes = new QueryIndexes()
const querySubscriptions = new QuerySubscription()

// Hook into data changes to invalidate cache and update subscriptions
const setupChangeListeners = (): void => {
  // Monitor channel changes
  const originalSetAction = io.set
  io.set = (action: IO) => {
    originalSetAction.call(io, action)
    queryIndexes.markDirty()
    queryCache.clear()
    process.nextTick(() => querySubscriptions.triggerAll())
  }

  // Monitor payload changes
  const originalSetPayload = payloadState.set
  payloadState.set = (
    channelId: string,
    payload: ActionPayload,
    source: any
  ) => {
    originalSetPayload.call(payloadState, channelId, payload, source)
    queryIndexes.markDirty()
    queryCache.clear()
    process.nextTick(() => querySubscriptions.triggerAll())
  }
}

/**
 * Fast channel query with indexing and caching
 */
export const fastQueryChannels = (filter: any = {}): any => {
  const cacheKey = `channels:${JSON.stringify(filter)}`

  // Check cache first
  const cached = queryCache.get(cacheKey)
  if (cached) return cached

  const startTime = performance.now()

  // Use indexes for fast filtering
  let channelIds: string[] = []

  if (filter.groupId) {
    channelIds = queryIndexes.getChannelsByGroup(filter.groupId)
  } else if (filter.channelPattern) {
    channelIds = queryIndexes.getChannelsByPattern(filter.channelPattern)
  } else if (filter.hasPayload === true) {
    channelIds = queryIndexes.getChannelsWithPayload()
  } else if (filter.hasSubscriber === true) {
    channelIds = queryIndexes.getChannelsWithSubscribers()
  } else {
    // Get all channels
    channelIds = io.getAll().map(action => action.id)
  }

  // Build enriched results
  const enrichedChannels = channelIds
    .map(channelId => {
      const config = io.get(channelId)
      if (!config) return null

      const payload = payloadState.get(channelId)
      const subscriber = subscribers.get(channelId)
      const metrics = io.getMetrics(channelId)
      const channelGroups = groupOperations.getChannelGroups(channelId)

      return {
        id: channelId,
        config,
        payload,
        subscriber: !!subscriber,
        lastExecuted: metrics?.lastExecutionTime,
        executionCount: metrics?.executionCount || 0,
        errorCount: metrics?.errors?.length || 0,
        groupIds: channelGroups.map(g => g.id)
      }
    })
    .filter(Boolean)

  // Apply additional filters efficiently
  let filteredChannels = enrichedChannels

  if (filter.errorCount) {
    filteredChannels = filteredChannels.filter(ch => {
      if (
        filter.errorCount.gt !== undefined &&
        ch!.errorCount <= filter.errorCount.gt
      )
        return false
      if (
        filter.errorCount.lt !== undefined &&
        ch!.errorCount >= filter.errorCount.lt
      )
        return false
      return true
    })
  }

  if (filter.executionCount) {
    filteredChannels = filteredChannels.filter(ch => {
      if (
        filter.executionCount.gt !== undefined &&
        ch!.executionCount <= filter.executionCount.gt
      )
        return false
      if (
        filter.executionCount.lt !== undefined &&
        ch!.executionCount >= filter.executionCount.lt
      )
        return false
      return true
    })
  }

  if (filter.lastExecutedSince) {
    filteredChannels = filteredChannels.filter(
      ch => ch!.lastExecuted && ch!.lastExecuted >= filter.lastExecutedSince
    )
  }

  const result = {
    channels: filteredChannels,
    total: enrichedChannels.length,
    filtered: filteredChannels.length,
    metadata: {
      queryTime: performance.now() - startTime,
      timestamp: Date.now(),
      cached: false,
      indexUsed: true
    }
  }

  // Cache result
  queryCache.set(cacheKey, result)

  return result
}

/**
 * Fast payload query with streaming and aggregation
 */
export const fastQueryPayloads = (query: any): any => {
  const cacheKey = `payloads:${JSON.stringify(query)}`

  // Check cache for non-real-time queries
  if (!query.realTime) {
    const cached = queryCache.get(cacheKey)
    if (cached) return cached
  }

  const startTime = performance.now()

  // Get matching channels efficiently
  const channelIds = query.channelId
    ? [query.channelId]
    : queryIndexes.getChannelsByPattern(query.channelPattern || '*')

  // Use streaming for large datasets
  if (channelIds.length > 1000) {
    return streamingPayloadQuery(query, channelIds)
  }

  let results: any[] = []

  // Process channels in batches for memory efficiency
  const batchSize = 100
  for (let i = 0; i < channelIds.length; i += batchSize) {
    const batch = channelIds.slice(i, i + batchSize)

    for (const channelId of batch) {
      const history = payloadState.getHistory(channelId, query.limit || 10)

      // Apply time filters efficiently
      let filteredHistory = history
      if (query.since || query.until) {
        filteredHistory = history.filter(entry => {
          if (query.since && entry.timestamp < query.since) return false
          if (query.until && entry.timestamp > query.until) return false
          return true
        })
      }

      // Apply transform if provided
      if (query.transform) {
        filteredHistory = filteredHistory.map(entry => ({
          ...entry,
          payload: query.transform(entry.payload)
        }))
      }

      results.push(
        ...filteredHistory.map(entry => ({
          channelId,
          ...entry
        }))
      )
    }
  }

  // Handle aggregation efficiently
  if (query.aggregate) {
    return computeAggregation(results, query.aggregate, startTime)
  }

  // Handle grouping
  if (query.groupBy) {
    const grouped = results.reduce((acc, item) => {
      const key = item[query.groupBy] || 'undefined'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {} as Record<string, any[]>)

    const result = {
      grouped,
      queryTime: performance.now() - startTime,
      timestamp: Date.now()
    }

    if (!query.realTime) {
      queryCache.set(cacheKey, result)
    }

    return result
  }

  const result = {
    results,
    total: results.length,
    queryTime: performance.now() - startTime,
    timestamp: Date.now()
  }

  if (!query.realTime) {
    queryCache.set(cacheKey, result)
  }

  return result
}

/**
 * Streaming payload query for large datasets
 */
const streamingPayloadQuery = (query: any, channelIds: string[]): any => {
  let processedCount = 0
  let aggregatedResult: any = null

  const stream = {
    async *[Symbol.asyncIterator]() {
      const batchSize = 50

      for (let i = 0; i < channelIds.length; i += batchSize) {
        const batch = channelIds.slice(i, i + batchSize)
        const batchResults: any[] = []

        for (const channelId of batch) {
          const history = payloadState.getHistory(channelId, query.limit || 10)

          for (const entry of history) {
            if (query.since && entry.timestamp < query.since) continue
            if (query.until && entry.timestamp > query.until) continue

            const result = {
              channelId,
              ...entry,
              payload: query.transform
                ? query.transform(entry.payload)
                : entry.payload
            }

            batchResults.push(result)
            processedCount++
          }
        }

        yield {
          batch: batchResults,
          processed: processedCount,
          total: channelIds.length,
          progress: processedCount / channelIds.length
        }
      }
    },

    // Convenience method for aggregation
    async aggregate(aggregateType: string) {
      const values: number[] = []

      for await (const chunk of this) {
        for (const item of chunk.batch) {
          if (typeof item.payload === 'number') {
            values.push(item.payload)
          }
        }
      }

      return computeAggregationFromValues(values, aggregateType)
    }
  }

  return stream
}

/**
 * Compute aggregation efficiently
 */
const computeAggregation = (
  results: any[],
  aggregateType: string,
  startTime: number
): any => {
  const values = results
    .map(r => (typeof r.payload === 'number' ? r.payload : 0))
    .filter(v => !isNaN(v))

  return computeAggregationFromValues(
    values,
    aggregateType,
    performance.now() - startTime
  )
}

const computeAggregationFromValues = (
  values: number[],
  aggregateType: string,
  queryTime?: number
): any => {
  const result: any = {queryTime: queryTime || 0}

  switch (aggregateType) {
    case 'count':
      result.count = values.length
      break
    case 'sum':
      result.sum = values.reduce((a, b) => a + b, 0)
      break
    case 'avg':
      result.avg = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0
      break
    case 'min':
      result.min = values.length ? Math.min(...values) : 0
      break
    case 'max':
      result.max = values.length ? Math.max(...values) : 0
      break
    case 'stats':
      const sum = values.reduce((a, b) => a + b, 0)
      const avg = values.length ? sum / values.length : 0
      const variance = values.length
        ? values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) /
          values.length
        : 0
      result.stats = {
        count: values.length,
        sum,
        avg,
        min: values.length ? Math.min(...values) : 0,
        max: values.length ? Math.max(...values) : 0,
        variance,
        stdDev: Math.sqrt(variance)
      }
      break
  }

  return result
}

/**
 * Fast metrics query with temporal indexing
 */
export const fastQueryMetrics = (query: any = {}): any => {
  const cacheKey = `metrics:${JSON.stringify(query)}`

  const cached = queryCache.get(cacheKey)
  if (cached) return cached

  const startTime = performance.now()

  const events = metricsReport.exportEvents({
    actionIds: query.actionId ? [query.actionId] : undefined,
    eventTypes: query.eventType,
    since: query.since,
    limit: query.limit
  })

  // Apply additional filters
  let filteredEvents = events
  if (query.until) {
    filteredEvents = filteredEvents.filter(
      event => event.timestamp <= query.until
    )
  }

  // Fast aggregation paths
  if (query.aggregateBy === 'channel') {
    const result = aggregateByChannel(filteredEvents, startTime)
    queryCache.set(cacheKey, result)
    return result
  }

  if (query.aggregateBy === 'hour' || query.aggregateBy === 'day') {
    const result = aggregateByTime(filteredEvents, query.aggregateBy, startTime)
    queryCache.set(cacheKey, result)
    return result
  }

  const result = {
    events: filteredEvents,
    total: filteredEvents.length,
    queryTime: performance.now() - startTime,
    timestamp: Date.now()
  }

  queryCache.set(cacheKey, result)
  return result
}

const aggregateByChannel = (events: any[], startTime: number): any => {
  const byChannel = new Map()

  for (const event of events) {
    const key = event.actionId
    let channelData = byChannel.get(key)

    if (!channelData) {
      channelData = {
        channelId: key,
        callCount: 0,
        errorCount: 0,
        executionCount: 0,
        events: []
      }
      byChannel.set(key, channelData)
    }

    channelData.events.push(event)

    switch (event.eventType) {
      case 'call':
        channelData.callCount++
        break
      case 'error':
        channelData.errorCount++
        break
      case 'execution':
        channelData.executionCount++
        break
    }
  }

  return {
    byChannel: Object.fromEntries(byChannel),
    queryTime: performance.now() - startTime,
    timestamp: Date.now()
  }
}

const aggregateByTime = (
  events: any[],
  timeUnit: string,
  startTime: number
): any => {
  const timeWindow = timeUnit === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const byTime = new Map()

  for (const event of events) {
    const timeKey = Math.floor(event.timestamp / timeWindow) * timeWindow
    let timeData = byTime.get(timeKey)

    if (!timeData) {
      timeData = {
        timestamp: timeKey,
        callCount: 0,
        errorCount: 0,
        executionCount: 0,
        events: []
      }
      byTime.set(timeKey, timeData)
    }

    timeData.events.push(event)

    switch (event.eventType) {
      case 'call':
        timeData.callCount++
        break
      case 'error':
        timeData.errorCount++
        break
      case 'execution':
        timeData.executionCount++
        break
    }
  }

  return {
    byTime: Object.fromEntries(byTime),
    queryTime: performance.now() - startTime,
    timestamp: Date.now()
  }
}

/**
 * Real-time query subscription
 */
export const subscribeToQuery = (
  queryId: string,
  query: any,
  callback: (result: any) => void
): (() => void) => {
  return querySubscriptions.subscribe(queryId, query, callback)
}

/**
 * Query performance metrics
 */
export const getQueryStats = () => {
  return {
    cache: queryCache.stats(),
    indexLastUpdate: queryIndexes.lastIndexUpdate,
    activeSubscriptions: querySubscriptions.subscriptions.size
  }
}

/**
 * Initialize query system
 */
export const initializeQuerySystem = (): void => {
  setupChangeListeners()

  // Pre-warm indexes
  queryIndexes.updateIndexes()

  console.log('Advanced query system initialized')
}

// Export main query API
export const query = {
  channels: fastQueryChannels,
  payloads: fastQueryPayloads,
  metrics: fastQueryMetrics,
  subscribe: subscribeToQuery,
  stats: getQueryStats,
  cache: {
    clear: () => queryCache.clear(),
    stats: () => queryCache.stats()
  }
}
