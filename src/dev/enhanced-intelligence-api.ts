// src/dev/enhanced-intelligence-api.ts
// Complete system intelligence aggregating ALL stores and analyzers

import {analyzer} from '../metrics/analyzer'
import {metricsCore} from '../metrics/core'
import {io, subscribers, middlewares, timeline} from '../context/state'
import {metricsState} from '../context/metrics-state'

/*

      C.Y.R.E - E.N.H.A.N.C.E.D - I.N.T.E.L.L.I.G.E.N.C.E - A.P.I
      
      Complete system intelligence aggregating data from:
      - Analyzer (performance, health, anomalies)  
      - IO Store (action definitions, channel configs)
      - Subscribers Store (event handlers, subscriber counts)
      - Middlewares Store (middleware chains)
      - Timeline Store (scheduled tasks, formations)
      - Groups Store (channel groupings)
      - Metrics State (breathing, stress, system state)
      
      Perfect for external streaming or complete dashboard APIs

*/

export interface EnhancedIntelligence {
  timestamp: number
  system: {
    // From analyzer
    analysis: any

    // From stores - complete system state
    totalChannels: number
    activeChannels: number
    totalSubscribers: number
    totalMiddlewares: number
    totalGroups: number
    timelineEntries: number

    // System health from breathing
    breathing: any
    stress: any
    isRecuperating: boolean

    // Performance metrics
    uptime: number
    callRate: number
    totalCalls: number
    totalExecutions: number
    totalErrors: number
  }

  channels: Array<{
    // From IO store
    id: string
    name?: string
    type?: string
    path?: string
    group?: string
    tags?: string[]
    description?: string
    version?: string

    // Configuration
    required?: boolean
    maxWait?: number
    block?: boolean
    payload?: any
    schema?: any
    middleware?: string[]

    // From metrics
    metrics?: {
      calls: number
      executions: number
      errors: number
      averageLatency: number
      successRate: number
      errorRate: number
      lastExecution: number
      protectionEvents: any
    }

    // From subscribers
    subscribers: Array<{
      id: string
      hasHandler: boolean
      functionType?: string
    }>

    // Health and status
    status: 'healthy' | 'warning' | 'critical' | 'inactive'
    issues: string[]
  }>

  subscribers: Array<{
    id: string
    channelId: string
    functionType: string
    isActive: boolean
    lastExecuted?: number
  }>

  middlewares: Array<{
    id: string
    type: string
    channels: string[]
    isActive: boolean
  }>

  groups: Array<{
    id: string
    patterns: string[]
    matchedChannels: string[]
    sharedConfig: any
    memberCount: number
  }>

  timeline: Array<{
    id: string
    type: 'timer' | 'schedule' | 'formation'
    status: 'active' | 'paused' | 'completed' | 'error'
    nextExecution?: number
    interval?: number
    executionCount: number
  }>

  insights: {
    // Channel insights
    mostActiveChannels: Array<{id: string; calls: number}>
    slowestChannels: Array<{id: string; latency: number}>
    errorProneChannels: Array<{id: string; errorRate: number}>
    unusedChannels: string[]
    channelsWithoutSubscribers: string[]
    subscribersWithoutChannels: string[]

    // System insights
    systemEfficiency: number
    resourceUtilization: number
    peakThroughputTime?: number
    averageResponseTime: number

    // Patterns
    channelTypes: Record<string, number>
    groupDistribution: Record<string, number>
    middlewareUsage: Record<string, number>

    // Recommendations
    recommendations: string[]
  }

  streaming: {
    // For external analyzers
    rawEvents: any[]
    storeSnapshots: {
      ioStore: any[]
      subscriberStore: any[]
      middlewareStore: any[]
      timelineStore: any[]
    }
    metadata: {
      version: string
      dataSourceCount: number
      completeness: number
    }
  }
}

/**
 * Get complete system intelligence from ALL data sources
 */
export const getEnhancedIntelligence = (
  timeWindow = 300000
): EnhancedIntelligence => {
  const timestamp = Date.now()

  // 1. Get analyzer data (existing analysis)
  const systemAnalysis = analyzer.analyzeSystem(timeWindow)
  const systemMetrics = metricsCore.getSystemMetrics()
  const events = metricsCore.getEvents({
    since: timestamp - timeWindow,
    limit: 1000
  })

  // 2. Get complete store data
  const allActions = io.getAll()
  const allSubscribers = subscribers.getAll()
  const allMiddlewares = middlewares.getAll()
  const allTimeline = timeline.getAll()
  const breathingState = metricsState.get()

  // Try to get groups (may not be available in all setups)
  let allGroups: any[] = []
  try {
    // Groups not implemented yet or not available
    allGroups = []
  } catch (e) {
    // Groups not available
  }

  // 3. Build enhanced channel information
  const enhancedChannels = allActions.map(action => {
    // Get metrics for this channel
    const channelMetrics = metricsCore.getChannelMetrics(action.id)

    // Find subscribers for this channel
    const channelSubscribers = allSubscribers
      .filter(sub => sub.id === action.id || sub.id.includes(action.id))
      .map(sub => ({
        id: sub.id,
        hasHandler: typeof sub.handler === 'function',
        functionType: typeof sub.handler
      }))

    // Determine channel status
    let status: 'healthy' | 'warning' | 'critical' | 'inactive' = 'inactive'
    const issues: string[] = []

    if (channelMetrics) {
      if (channelMetrics.calls === 0) {
        status = 'inactive'
        issues.push('No recent activity')
      } else if (channelMetrics.successRate < 0.7) {
        status = 'critical'
        issues.push('Low success rate')
      } else if (channelMetrics.successRate < 0.9) {
        status = 'warning'
        issues.push('Moderate success rate')
      } else {
        status = 'healthy'
      }

      if (channelMetrics.averageLatency > 1000) {
        issues.push('High latency')
        if (status === 'healthy') status = 'warning'
      }
    }

    if (channelSubscribers.length === 0) {
      issues.push('No subscribers')
      if (status === 'healthy') status = 'warning'
    }

    return {
      // Basic info from IO store
      id: action.id,
      name: action.name,
      type: action.type,
      path: action.path,
      group: action.group,
      tags: action.tags,
      description: action.description,
      version: action.version,

      // Configuration
      required: action.required,
      maxWait: action.maxWait,
      block: action.block,
      payload: action.payload,
      schema: action.schema,
      middleware: action.middleware,

      // Metrics
      metrics: channelMetrics
        ? {
            calls: channelMetrics.calls,
            executions: channelMetrics.executions,
            errors: channelMetrics.errors,
            averageLatency: channelMetrics.averageLatency,
            successRate: channelMetrics.successRate,
            errorRate: channelMetrics.errorRate,
            lastExecution: channelMetrics.lastExecution,
            protectionEvents: channelMetrics.protectionEvents
          }
        : undefined,

      // Subscribers
      subscribers: channelSubscribers,

      // Status
      status,
      issues
    }
  })

  // 4. Build subscriber analysis
  const enhancedSubscribers = allSubscribers.map(sub => ({
    id: sub.id,
    channelId: sub.id, // Assuming subscriber ID matches channel ID
    functionType: typeof sub.handler,
    isActive: typeof sub.handler === 'function',
    lastExecuted: undefined // Could be enhanced with execution tracking
  }))

  // 5. Build middleware analysis
  const enhancedMiddlewares = allMiddlewares.map(middleware => ({
    id: middleware.id,
    type: typeof middleware.handler,
    channels: allActions
      .filter(action => action.middleware?.includes(middleware.id))
      .map(action => action.id),
    isActive: typeof middleware.handler === 'function'
  }))

  // 6. Build group analysis
  const enhancedGroups = allGroups.map((group: any) => ({
    id: group.id || 'unknown',
    patterns: group.patterns || [],
    matchedChannels: group.matchedChannels || [],
    sharedConfig: group.shared || {},
    memberCount: (group.matchedChannels || []).length
  }))

  // 7. Build timeline analysis
  const enhancedTimeline = allTimeline.map(timer => ({
    id: timer.id,
    type: timer.type || 'timer',
    status: timer.status || 'unknown',
    nextExecution: timer.nextExecution,
    interval: timer.interval,
    executionCount: timer.executionCount || 0
  }))

  // 8. Generate insights
  const activeChannels = enhancedChannels.filter(
    c => c.metrics && c.metrics.calls > 0
  )

  const mostActiveChannels = activeChannels
    .sort((a, b) => (b.metrics?.calls || 0) - (a.metrics?.calls || 0))
    .slice(0, 10)
    .map(c => ({id: c.id, calls: c.metrics?.calls || 0}))

  const slowestChannels = activeChannels
    .sort(
      (a, b) =>
        (b.metrics?.averageLatency || 0) - (a.metrics?.averageLatency || 0)
    )
    .slice(0, 10)
    .map(c => ({id: c.id, latency: c.metrics?.averageLatency || 0}))

  const errorProneChannels = activeChannels
    .filter(c => (c.metrics?.errorRate || 0) > 0.1)
    .sort((a, b) => (b.metrics?.errorRate || 0) - (a.metrics?.errorRate || 0))
    .slice(0, 10)
    .map(c => ({id: c.id, errorRate: c.metrics?.errorRate || 0}))

  const unusedChannels = enhancedChannels
    .filter(c => !c.metrics || c.metrics.calls === 0)
    .map(c => c.id)

  const channelsWithoutSubscribers = enhancedChannels
    .filter(c => c.subscribers.length === 0)
    .map(c => c.id)

  const subscribersWithoutChannels = enhancedSubscribers
    .filter(s => !allActions.find(a => a.id === s.channelId))
    .map(s => s.id)

  // Channel type distribution
  const channelTypes: Record<string, number> = {}
  enhancedChannels.forEach(c => {
    const type = c.type || 'untyped'
    channelTypes[type] = (channelTypes[type] || 0) + 1
  })

  // Group distribution
  const groupDistribution: Record<string, number> = {}
  enhancedChannels.forEach(c => {
    const group = c.group || 'ungrouped'
    groupDistribution[group] = (groupDistribution[group] || 0) + 1
  })

  // Middleware usage
  const middlewareUsage: Record<string, number> = {}
  enhancedMiddlewares.forEach(m => {
    middlewareUsage[m.id] = m.channels.length
  })

  // Generate recommendations
  const recommendations: string[] = []
  if (unusedChannels.length > 0) {
    recommendations.push(
      `${unusedChannels.length} channels have no activity - consider cleanup`
    )
  }
  if (channelsWithoutSubscribers.length > 0) {
    recommendations.push(
      `${channelsWithoutSubscribers.length} channels missing subscribers`
    )
  }
  if (errorProneChannels.length > 0) {
    recommendations.push(
      `${errorProneChannels.length} channels have high error rates`
    )
  }
  if (slowestChannels.length > 0 && slowestChannels[0].latency > 1000) {
    recommendations.push(
      `Optimize slow channels: ${slowestChannels[0].id} (${slowestChannels[0].latency}ms)`
    )
  }

  const systemEfficiency =
    systemMetrics.totalCalls > 0
      ? systemMetrics.totalExecutions / systemMetrics.totalCalls
      : 1

  if (systemEfficiency < 0.8) {
    recommendations.push(
      `System efficiency is ${(systemEfficiency * 100).toFixed(
        1
      )}% - investigate blocked calls`
    )
  }

  // 9. Build complete intelligence object
  const intelligence: EnhancedIntelligence = {
    timestamp,

    system: {
      analysis: systemAnalysis,

      // Store counts
      totalChannels: allActions.length,
      activeChannels: activeChannels.length,
      totalSubscribers: allSubscribers.length,
      totalMiddlewares: allMiddlewares.length,
      totalGroups: allGroups.length,
      timelineEntries: allTimeline.length,

      // Breathing system
      breathing: breathingState.breathing,
      stress: breathingState.breathing.stress,
      isRecuperating: breathingState.breathing.isRecuperating,

      // Performance
      uptime: systemMetrics.uptime,
      callRate: systemMetrics.callRate,
      totalCalls: systemMetrics.totalCalls,
      totalExecutions: systemMetrics.totalExecutions,
      totalErrors: systemMetrics.totalErrors
    },

    channels: enhancedChannels,
    subscribers: enhancedSubscribers,
    middlewares: enhancedMiddlewares,
    groups: enhancedGroups,
    timeline: enhancedTimeline,

    insights: {
      mostActiveChannels,
      slowestChannels,
      errorProneChannels,
      unusedChannels,
      channelsWithoutSubscribers,
      subscribersWithoutChannels,

      systemEfficiency,
      resourceUtilization: activeChannels.length / allActions.length,
      averageResponseTime:
        activeChannels.reduce(
          (sum, c) => sum + (c.metrics?.averageLatency || 0),
          0
        ) / Math.max(activeChannels.length, 1),

      channelTypes,
      groupDistribution,
      middlewareUsage,

      recommendations
    },

    streaming: {
      rawEvents: events.slice(0, 100), // Last 100 events for external processing
      storeSnapshots: {
        ioStore: allActions,
        subscriberStore: allSubscribers,
        middlewareStore: allMiddlewares,
        timelineStore: allTimeline
      },
      metadata: {
        version: '4.3.0',
        dataSourceCount: 6, // io, subscribers, middlewares, timeline, groups, metrics
        completeness: 1.0
      }
    }
  }

  return intelligence
}

/**
 * Get streamable data for external analyzers
 */
export const getStreamableIntelligence = (timeWindow = 300000) => {
  const intelligence = getEnhancedIntelligence(timeWindow)

  return {
    // Core metrics for external processing
    system: intelligence.system,
    channels: intelligence.channels.map(c => ({
      id: c.id,
      type: c.type,
      group: c.group,
      metrics: c.metrics,
      subscriberCount: c.subscribers.length,
      status: c.status,
      issues: c.issues
    })),

    // Raw data for external analysis
    rawEvents: intelligence.streaming.rawEvents,
    stores: intelligence.streaming.storeSnapshots,

    // Summary stats
    summary: {
      totalChannels: intelligence.system.totalChannels,
      activeChannels: intelligence.system.activeChannels,
      systemEfficiency: intelligence.insights.systemEfficiency,
      recommendations: intelligence.insights.recommendations
    },

    // Metadata
    metadata: intelligence.streaming.metadata
  }
}
