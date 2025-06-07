// src/metrics/enhanced-core.ts
// Enhanced core metrics with subscriber/branch/group data

import {metricsCore as originalCore} from './core'
import {io, subscribers} from '../context/state'
import {groupOperations} from '../components/cyre-group'
import type {ActionId} from '../types/core'
import type {RawEvent, ChannelMetrics, SystemMetrics} from '../types/system'

/*

      C.Y.R.E - E.N.H.A.N.C.E.D - C.O.R.E
      
      Enhanced metrics that extends existing core:
      - Keeps all existing functionality
      - Adds subscriber relationships
      - Adds branch topology
      - Adds group memberships
      - Backwards compatible

*/

// Extended channel metrics with enhanced data
export interface EnhancedChannelMetrics extends ChannelMetrics {
  // NEW: Configuration details
  configuration: {
    type?: string
    schema?: any
    talents?: string[]
    protections: {
      throttle?: number
      debounce?: number
      block?: boolean
      required?: boolean
      detectChanges?: boolean
    }
    priority?: string
    tags?: string[]
  }

  // NEW: Subscriber information
  subscribers: {
    count: number
    handlers: Array<{
      id: string
      registeredAt: number
      executionCount: number
      averageExecutionTime: number
    }>
  }

  // NEW: Branch context
  branch?: {
    branchId: string
    branchPath: string
    depth: number
    parentPath?: string
    isRoot: boolean
  }

  // NEW: Group memberships
  groups: Array<{
    groupId: string
    pattern: string
  }>
}

// System topology data
export interface SystemTopology {
  branches: Array<{
    id: string
    path: string
    parentId?: string
    depth: number
    channelCount: number
    totalCalls: number
    isActive: boolean
  }>

  groups: Array<{
    id: string
    patterns: string[]
    memberCount: number
    totalCalls: number
    avgLatency: number
  }>

  subscriberNetwork: {
    totalSubscribers: number
    channelsWithSubscribers: number
    averageSubscribersPerChannel: number
  }
}

/**
 * Enhanced metrics core - extends original functionality
 */
export const enhancedCore = {
  // EXISTING: Delegate to original core for backwards compatibility
  ...originalCore,

  // NEW: Enhanced channel metrics with all context
  getEnhancedChannelMetrics(channelId?: ActionId): EnhancedChannelMetrics[] {
    const baseMetrics = channelId
      ? [originalCore.getChannelMetrics(channelId)].filter(Boolean)
      : originalCore.getAllChannelMetrics()

    return baseMetrics.map(base => {
      const channel = io.get(base.id)
      const channelSubscribers = subscribers.getByChannelId
        ? subscribers.getByChannelId(base.id)
        : []

      return {
        ...base,
        configuration: extractChannelConfig(channel),
        subscribers: extractSubscriberInfo(base.id, channelSubscribers),
        branch: extractBranchInfo(base.id, channel),
        groups: extractGroupMemberships(base.id)
      }
    })
  },

  // NEW: System topology analysis
  getSystemTopology(): SystemTopology {
    const allChannels = originalCore.getAllChannelMetrics()
    const branches = analyzeBranches(allChannels)
    const groups = analyzeGroups(allChannels)
    const subscriberStats = analyzeSubscribers(allChannels)

    return {
      branches,
      groups,
      subscriberNetwork: subscriberStats
    }
  },

  // NEW: Subscriber network analysis
  getSubscriberNetwork() {
    const channels = originalCore.getAllChannelMetrics()
    const network = {
      nodes: [],
      edges: []
    }

    // Add channel nodes
    channels.forEach(channel => {
      const subs = subscribers.getByChannelId
        ? subscribers.getByChannelId(channel.id)
        : []

      network.nodes.push({
        id: channel.id,
        type: 'channel',
        subscriberCount: subs.length,
        calls: channel.calls,
        branch: extractBranchInfo(channel.id)?.branchPath
      })

      // Add subscriber edges
      subs.forEach(sub => {
        network.edges.push({
          from: channel.id,
          to: sub.id,
          type: 'subscription',
          executionCount: sub.executionCount || 0
        })
      })
    })

    return network
  }
}

// Helper functions
function extractChannelConfig(channel?: any) {
  if (!channel) return {protections: {}}

  return {
    type: channel.type,
    schema: channel.schema,
    talents: channel.talents,
    protections: {
      throttle: channel.throttle,
      debounce: channel.debounce,
      block: channel.block,
      required: channel.required,
      detectChanges: channel.detectChanges
    },
    priority: channel.priority,
    tags: channel.tags
  }
}

function extractSubscriberInfo(channelId: ActionId, channelSubscribers: any[]) {
  return {
    count: channelSubscribers.length,
    handlers: channelSubscribers.map(sub => ({
      id: sub.id || 'anonymous',
      registeredAt: sub.registeredAt || Date.now(),
      executionCount: sub.executionCount || 0,
      averageExecutionTime: sub.averageExecutionTime || 0
    }))
  }
}

function extractBranchInfo(channelId: ActionId, channel?: any) {
  if (!channelId.includes('/')) return undefined

  const pathParts = channelId.split('/')
  const branchPath = pathParts.slice(0, -1).join('/')
  const depth = pathParts.length - 1

  return {
    branchId: channel?._branchId || pathParts[0],
    branchPath,
    depth,
    parentPath: depth > 1 ? pathParts.slice(0, -2).join('/') : undefined,
    isRoot: depth === 1
  }
}

function extractGroupMemberships(channelId: ActionId) {
  try {
    return groupOperations
      .getAll()
      .filter(group => {
        return group.channels?.some(pattern => {
          const regexPattern = pattern.replace(/\*/g, '.*')
          return new RegExp(`^${regexPattern}$`).test(channelId)
        })
      })
      .map(group => ({
        groupId: group.id,
        pattern:
          group.channels?.find(p => {
            const regexPattern = p.replace(/\*/g, '.*')
            return new RegExp(`^${regexPattern}$`).test(channelId)
          }) || ''
      }))
  } catch (error) {
    return []
  }
}

function analyzeBranches(channels: ChannelMetrics[]) {
  const branchMap = new Map()

  channels.forEach(channel => {
    const branchInfo = extractBranchInfo(channel.id)
    if (branchInfo) {
      const key = branchInfo.branchPath
      if (!branchMap.has(key)) {
        branchMap.set(key, {
          id: branchInfo.branchId,
          path: branchInfo.branchPath,
          parentId: branchInfo.parentPath?.split('/').pop(),
          depth: branchInfo.depth,
          channelCount: 0,
          totalCalls: 0,
          isActive: false
        })
      }

      const branch = branchMap.get(key)
      branch.channelCount++
      branch.totalCalls += channel.calls
      branch.isActive = branch.isActive || channel.calls > 0
    }
  })

  return Array.from(branchMap.values())
}

function analyzeGroups(channels: ChannelMetrics[]) {
  try {
    return groupOperations.getAll().map(group => {
      const memberChannels = channels.filter(channel =>
        group.channels?.some(pattern => {
          const regexPattern = pattern.replace(/\*/g, '.*')
          return new RegExp(`^${regexPattern}$`).test(channel.id)
        })
      )

      const totalCalls = memberChannels.reduce((sum, ch) => sum + ch.calls, 0)
      const avgLatency =
        memberChannels.length > 0
          ? memberChannels.reduce((sum, ch) => sum + ch.averageLatency, 0) /
            memberChannels.length
          : 0

      return {
        id: group.id,
        patterns: group.channels || [],
        memberCount: memberChannels.length,
        totalCalls,
        avgLatency
      }
    })
  } catch (error) {
    return []
  }
}

function analyzeSubscribers(channels: ChannelMetrics[]) {
  let totalSubscribers = 0
  let channelsWithSubscribers = 0

  channels.forEach(channel => {
    const subs = subscribers.getByChannelId ? subscribers.get(channel.id) : []
    totalSubscribers += subs.length
    if (subs.length > 0) channelsWithSubscribers++
  })

  return {
    totalSubscribers,
    channelsWithSubscribers,
    averageSubscribersPerChannel:
      channels.length > 0 ? totalSubscribers / channels.length : 0
  }
}
