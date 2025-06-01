// src/components/cyre-group.ts
// Channel grouping with shared configuration and middleware

import type {
  IO,
  ActionPayload,
  EventHandler,
  CyreResponse
} from '../types/interface'
import {io, subscribers, middlewares} from '../context/state'
import {cyre} from '../app'
import {sensor} from '../context/metrics-report'
import {log} from './cyre-log'
import {
  validateActionStructure,
  validateFunctionAttributes
} from './cyre-actions'

/*

      C.Y.R.E - G.R.O.U.P
      
      Channel grouping system:
      - Pattern-based channel matching
      - Shared middleware and configuration
      - Group-level operations
      - Alert management
      - Isolated group state

*/

// Group configuration following IO interface patterns
interface GroupConfig {
  /** Channel patterns to match (supports wildcards) */
  channels: string[]
  /** Shared configuration applied to all matching channels */
  shared: Partial<IO> & {
    /** Group-specific middleware chain */
    middleware?: string[]
    /** Alert configurations */
    alerts?: Record<string, AlertConfig>
  }
}

interface AlertConfig {
  threshold: number
  action: string
  condition?: 'offline' | 'anomaly' | 'error' | 'custom'
  handler?: (channelId: string, alertType: string, data: any) => void
}

interface GroupState {
  id: string
  config: GroupConfig
  matchedChannels: Set<string>
  middlewareIds: string[]
  alertStates: Map<string, AlertState>
  isActive: boolean
  createdAt: number
}

interface AlertState {
  lastTriggered: number
  triggerCount: number
  isActive: boolean
}

// Group registry using existing store pattern
import {createStore} from '../context/create-store'
const groupStore = createStore<GroupState>()

/**
 * Check if channel ID matches pattern
 */
const matchesPattern = (channelId: string, pattern: string): boolean => {
  if (pattern === channelId) return true

  // Convert wildcard pattern to regex
  const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')

  return new RegExp(`^${regexPattern}$`).test(channelId)
}

/**
 * Find all channels matching group patterns
 */
const findMatchingChannels = (patterns: string[]): string[] => {
  const allChannels = io.getAll().map(action => action.id)
  const matched: string[] = []

  for (const channelId of allChannels) {
    for (const pattern of patterns) {
      if (matchesPattern(channelId, pattern)) {
        matched.push(channelId)
        break
      }
    }
  }

  return matched
}

/**
 * Apply shared configuration to channel
 */
const applySharedConfig = (channelId: string, shared: Partial<IO>): void => {
  const existing = io.get(channelId)
  if (!existing) return

  // Create a copy of shared config without potentially conflicting fields
  const {middleware: sharedMiddleware, alerts, ...safeShared} = shared

  // Merge shared config with existing channel config
  const updated: IO = {
    ...existing,
    ...safeShared,
    id: channelId, // Preserve original ID
    // Merge middleware arrays if both exist
    middleware: [...(existing.middleware || []), ...(sharedMiddleware || [])]
  }

  io.set(updated)

  sensor.log(channelId, 'info', 'group-config-applied', {
    groupConfig: true,
    sharedProperties: Object.keys(safeShared)
  })
}

/**
 * Setup group middleware chain
 */
const setupGroupMiddleware = (
  groupId: string,
  middlewareFns: any[]
): string[] => {
  const middlewareIds: string[] = []

  middlewareFns.forEach((fn, index) => {
    const middlewareId = `${groupId}-middleware-${index}`

    middlewares.add({
      id: middlewareId,
      fn
    })

    middlewareIds.push(middlewareId)
  })

  return middlewareIds
}

/**
 * Setup alert monitoring for group
 */
const setupAlerts = (
  groupId: string,
  alertConfigs: Record<string, AlertConfig>
): Map<string, AlertState> => {
  const alertStates = new Map<string, AlertState>()

  Object.entries(alertConfigs).forEach(([alertType, config]) => {
    alertStates.set(alertType, {
      lastTriggered: 0,
      triggerCount: 0,
      isActive: false
    })

    // Setup alert monitoring based on type
    if (alertType === 'offline') {
      setupOfflineMonitoring(groupId, config)
    } else if (alertType === 'anomaly') {
      setupAnomalyMonitoring(groupId, config)
    }
  })

  return alertStates
}

/**
 * Setup offline monitoring for group channels
 */
const setupOfflineMonitoring = (groupId: string, config: AlertConfig): void => {
  const checkInterval = Math.min(config.threshold / 2, 5000)

  cyre.setTimer(
    checkInterval,
    () => {
      const group = groupStore.get(groupId)
      if (!group || !group.isActive) return

      const now = Date.now()

      group.matchedChannels.forEach(channelId => {
        const metrics = io.getMetrics(channelId)
        if (!metrics) return

        const timeSinceLastExecution = now - metrics.lastExecutionTime

        if (timeSinceLastExecution > config.threshold) {
          triggerAlert(groupId, 'offline', channelId, {
            timeSinceLastExecution,
            threshold: config.threshold
          })
        }
      })
    },
    `${groupId}-offline-monitor`
  )
}

/**
 * Setup anomaly monitoring for group channels
 */
const setupAnomalyMonitoring = (groupId: string, config: AlertConfig): void => {
  // Monitor execution patterns and trigger alerts on anomalies
  cyre.setTimer(
    config.threshold,
    () => {
      const group = groupStore.get(groupId)
      if (!group || !group.isActive) return

      group.matchedChannels.forEach(channelId => {
        const metrics = cyre.getMetrics(channelId)
        if (!metrics) return

        // Simple anomaly detection based on stress levels
        const breathingState = cyre.getBreathingState()
        if (breathingState.stress > 0.8) {
          triggerAlert(groupId, 'anomaly', channelId, {
            stressLevel: breathingState.stress,
            threshold: 0.8
          })
        }
      })
    },
    `${groupId}-anomaly-monitor`
  )
}

/**
 * Trigger alert for group
 */
const triggerAlert = (
  groupId: string,
  alertType: string,
  channelId: string,
  data: any
): void => {
  const group = groupStore.get(groupId)
  if (!group) return

  const alertState = group.alertStates.get(alertType)
  if (!alertState) return

  const now = Date.now()
  alertState.lastTriggered = now
  alertState.triggerCount++
  alertState.isActive = true

  group.alertStates.set(alertType, alertState)
  groupStore.set(groupId, group)

  // Execute alert action
  const alertConfig = group.config.shared.alerts?.[alertType]
  if (alertConfig?.handler) {
    try {
      alertConfig.handler(channelId, alertType, data)
    } catch (error) {
      log.error(`Alert handler failed for ${groupId}:${alertType}: ${error}`)
    }
  }

  sensor.log(groupId, 'critical', 'group-alert-triggered', {
    alertType,
    channelId,
    triggerCount: alertState.triggerCount,
    data
  })

  log.warn(`Group Alert [${groupId}]: ${alertType} triggered for ${channelId}`)
}

/**
 * Create and manage channel group
 */
export const createGroup = (
  groupId: string,
  config: GroupConfig
): {
  ok: boolean
  message: string
  payload?: GroupState
} => {
  try {
    // Validate group configuration
    if (!groupId || typeof groupId !== 'string') {
      return {ok: false, message: 'Group ID must be a non-empty string'}
    }

    if (!config.channels || !Array.isArray(config.channels)) {
      return {ok: false, message: 'Group channels must be an array of patterns'}
    }

    if (!config.shared || typeof config.shared !== 'object') {
      return {ok: false, message: 'Group shared configuration is required'}
    }

    // Validate shared configuration (skip ID requirement for groups)
    if (config.shared.schema && typeof config.shared.schema !== 'function') {
      return {ok: false, message: 'Shared schema must be a schema function'}
    }

    if (
      config.shared.condition &&
      typeof config.shared.condition !== 'function'
    ) {
      return {ok: false, message: 'Shared condition must be a function'}
    }

    if (
      config.shared.selector &&
      typeof config.shared.selector !== 'function'
    ) {
      return {ok: false, message: 'Shared selector must be a function'}
    }

    if (
      config.shared.transform &&
      typeof config.shared.transform !== 'function'
    ) {
      return {ok: false, message: 'Shared transform must be a function'}
    }

    // Validate timing values
    if (
      config.shared.throttle !== undefined &&
      (typeof config.shared.throttle !== 'number' || config.shared.throttle < 0)
    ) {
      return {
        ok: false,
        message: 'Shared throttle must be a non-negative number'
      }
    }

    if (
      config.shared.debounce !== undefined &&
      (typeof config.shared.debounce !== 'number' || config.shared.debounce < 0)
    ) {
      return {
        ok: false,
        message: 'Shared debounce must be a non-negative number'
      }
    }

    // Find matching channels
    const matchedChannels = findMatchingChannels(config.channels)

    // Setup group middleware if provided
    const middlewareIds = config.shared.middleware
      ? setupGroupMiddleware(groupId, config.shared.middleware)
      : []

    // Setup alerts if provided
    const alertStates = config.shared.alerts
      ? setupAlerts(groupId, config.shared.alerts)
      : new Map()

    // Create group state
    const groupState: GroupState = {
      id: groupId,
      config,
      matchedChannels: new Set(matchedChannels),
      middlewareIds,
      alertStates,
      isActive: true,
      createdAt: Date.now()
    }

    // Apply shared configuration to matched channels
    matchedChannels.forEach(channelId => {
      applySharedConfig(channelId, config.shared)
    })

    // Store group
    groupStore.set(groupId, groupState)

    sensor.log(groupId, 'success', 'group-created', {
      matchedChannels: matchedChannels.length,
      middlewareCount: middlewareIds.length,
      alertTypes: Object.keys(config.shared.alerts || {})
    })

    log.success(
      `Group ${groupId} created with ${matchedChannels.length} matched channels`
    )

    return {
      ok: true,
      message: `Group created with ${matchedChannels.length} matched channels`,
      payload: groupState
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Group creation failed: ${errorMessage}`)
    sensor.error(groupId, errorMessage, 'group-creation')
    return {ok: false, message: `Group creation failed: ${errorMessage}`}
  }
}

/**
 * Add channel to existing group if it matches patterns
 */
export const addChannelToGroups = (channelId: string): void => {
  const allGroups = groupStore.getAll()

  allGroups.forEach(group => {
    if (!group.isActive) return

    // Check if channel matches any group patterns
    const matches = group.config.channels.some(pattern =>
      matchesPattern(channelId, pattern)
    )

    if (matches && !group.matchedChannels.has(channelId)) {
      // Add to group
      group.matchedChannels.add(channelId)

      // Apply shared configuration
      applySharedConfig(channelId, group.config.shared)

      // Update group state
      groupStore.set(group.id, group)

      sensor.log(group.id, 'info', 'channel-added-to-group', {
        channelId,
        groupSize: group.matchedChannels.size
      })
    }
  })
}

/**
 * Remove channel from groups
 */
export const removeChannelFromGroups = (channelId: string): void => {
  const allGroups = groupStore.getAll()

  allGroups.forEach(group => {
    if (group.matchedChannels.has(channelId)) {
      group.matchedChannels.delete(channelId)
      groupStore.set(group.id, group)

      sensor.log(group.id, 'info', 'channel-removed-from-group', {
        channelId,
        groupSize: group.matchedChannels.size
      })
    }
  })
}

/**
 * Get comprehensive group metrics
 */
export const getGroupMetrics = (groupId: string): GroupMetrics | null => {
  const group = groupStore.get(groupId)
  if (!group) return null

  const now = Date.now()
  const channels = Array.from(group.matchedChannels)

  // Calculate metrics from action metrics
  let totalCalls = 0
  let totalExecutionTime = 0
  let totalErrors = 0

  channels.forEach(channelId => {
    const stats = metricsReport.getActionStats(channelId)
    if (stats) {
      totalCalls += stats.calls
      totalErrors += stats.errors
    }
  })

  return {
    id: groupId,
    channelCount: group.matchedChannels.size,
    middlewareExecutions: totalCalls, // Each call = middleware execution
    totalCallsHandled: totalCalls,
    averageExecutionTime: totalCalls > 0 ? totalExecutionTime / totalCalls : 0,
    errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
    lastActivity: Math.max(
      ...channels.map(id => {
        const stats = metricsReport.getActionStats(id)
        return stats?.lastCall || 0
      })
    ),
    uptime: now - group.createdAt,
    alertHistory: Array.from(group.alertStates.entries()).map(
      ([type, state]) => ({
        id: `${groupId}-${type}`,
        type: type as any,
        channelId: groupId,
        timestamp: state.lastTriggered,
        data: {triggerCount: state.triggerCount},
        resolved: !state.isActive
      })
    )
  }
}

/**
 * Group performance analysis
 */
export const analyzeGroupPerformance = (
  groupId: string
): GroupPerformance | null => {
  const group = groupStore.get(groupId)
  if (!group) return null

  const channels = Array.from(group.matchedChannels)
  const channelDistribution: Record<string, number> = {}

  channels.forEach(channelId => {
    const stats = metricsReport.getActionStats(channelId)
    channelDistribution[channelId] = stats?.calls || 0
  })

  return {
    middlewareChainTime: group.middlewareIds.length * 0.5, // Estimate
    channelDistribution,
    patternMatchEfficiency: channels.length / group.config.channels.length,
    alertResponseTime: 100 // Estimate based on monitoring intervals
  }
}

/**
 * Bulk group operations
 */
export const bulkGroupOperations = {
  /**
   * Pause all groups
   */
  pauseAll: (): void => {
    groupStore.getAll().forEach(group => {
      group.isActive = false
      groupStore.set(group.id, group)
    })
    log.info('All groups paused')
  },

  /**
   * Resume all groups
   */
  resumeAll: (): void => {
    groupStore.getAll().forEach(group => {
      group.isActive = true
      groupStore.set(group.id, group)
    })
    log.info('All groups resumed')
  },

  /**
   * Get groups by pattern
   */
  getByPattern: (pattern: string): GroupState[] => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return groupStore.getAll().filter(group => regex.test(group.id))
  },

  /**
   * Apply configuration to multiple groups
   */
  applyConfig: (pattern: string, config: Partial<GroupConfig>): number => {
    const matchedGroups = bulkGroupOperations.getByPattern(pattern)

    matchedGroups.forEach(group => {
      updateGroup(group.id, config)
    })

    return matchedGroups.length
  }
}

/**
 * Advanced pattern matching with multiple strategies
 */
const advancedPatternMatching = {
  /**
   * Wildcard pattern matching (existing)
   */
  wildcard: (channelId: string, pattern: string): boolean => {
    if (pattern === channelId) return true
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
    return new RegExp(`^${regexPattern}$`).test(channelId)
  },

  /**
   * Regex pattern matching
   */
  regex: (channelId: string, pattern: string): boolean => {
    try {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        const regexStr = pattern.slice(1, -1)
        const regex = new RegExp(regexStr)
        return regex.test(channelId)
      }
      return false
    } catch {
      return false
    }
  },

  /**
   * Hierarchical path matching
   */
  hierarchical: (channelId: string, pattern: string): boolean => {
    const channelParts = channelId.split('-')
    const patternParts = pattern.split('-')

    if (patternParts.length > channelParts.length) return false

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i]
      const channelPart = channelParts[i]

      if (patternPart === '*') continue
      if (patternPart === '**') return true // Match rest
      if (patternPart !== channelPart) return false
    }

    return true
  },

  /**
   * Tag-based matching
   */
  tag: (channelId: string, pattern: string): boolean => {
    // Support for tag:value patterns
    if (pattern.startsWith('tag:')) {
      const tagValue = pattern.substring(4)
      // This would require channels to have metadata with tags
      const action = io.get(channelId)
      return action?.tags?.includes(tagValue) || false
    }
    return false
  }
}

/**
 * Pattern validation
 */
const validatePattern = (pattern: string): {valid: boolean; error?: string} => {
  if (!pattern || typeof pattern !== 'string') {
    return {valid: false, error: 'Pattern must be a non-empty string'}
  }

  // Check for regex pattern
  if (pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      new RegExp(pattern.slice(1, -1))
      return {valid: true}
    } catch (error) {
      return {valid: false, error: `Invalid regex pattern: ${error}`}
    }
  }

  // Check for tag pattern
  if (pattern.startsWith('tag:')) {
    const tagValue = pattern.substring(4)
    if (!tagValue) {
      return {valid: false, error: 'Tag pattern must specify a tag value'}
    }
    return {valid: true}
  }

  // Wildcard patterns are always valid
  return {valid: true}
}
/**
 * Get group information
 */
export const getGroup = (groupId: string): GroupState | undefined => {
  return groupStore.get(groupId)
}

/**
 * Remove group and cleanup
 */
export const removeGroup = (groupId: string): boolean => {
  const group = groupStore.get(groupId)
  if (!group) return false

  // Cleanup middleware
  group.middlewareIds.forEach(middlewareId => {
    middlewares.forget(middlewareId)
  })

  // Cleanup alert timers
  cyre.clearTimer(`${groupId}-offline-monitor`)
  cyre.clearTimer(`${groupId}-anomaly-monitor`)

  // Mark as inactive
  group.isActive = false
  groupStore.set(groupId, group)

  // Remove from store
  const removed = groupStore.forget(groupId)

  sensor.log(groupId, 'info', 'group-removed', {
    channelCount: group.matchedChannels.size,
    middlewareCount: group.middlewareIds.length
  })

  return removed
}

/**
 * Update group configuration
 */
export const updateGroup = (
  groupId: string,
  updates: Partial<GroupConfig>
): {
  ok: boolean
  message: string
} => {
  try {
    const group = groupStore.get(groupId)
    if (!group) {
      return {ok: false, message: 'Group not found'}
    }

    // Merge configuration
    const newConfig = {
      ...group.config,
      ...updates,
      shared: {
        ...group.config.shared,
        ...updates.shared
      }
    }

    // Re-find matching channels if patterns changed
    if (updates.channels) {
      const newMatches = findMatchingChannels(newConfig.channels)
      group.matchedChannels.clear()
      newMatches.forEach(channelId => group.matchedChannels.add(channelId))
    }

    // Apply updated shared config
    group.matchedChannels.forEach(channelId => {
      applySharedConfig(channelId, newConfig.shared)
    })

    group.config = newConfig
    groupStore.set(groupId, group)

    sensor.log(groupId, 'info', 'group-updated', {
      channelCount: group.matchedChannels.size
    })

    return {ok: true, message: 'Group updated successfully'}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {ok: false, message: `Group update failed: ${errorMessage}`}
  }
}

/**
 * Get all groups
 */
export const getAllGroups = (): GroupState[] => {
  return groupStore.getAll()
}

/**
 * Get groups for specific channel
 */
export const getChannelGroups = (channelId: string): GroupState[] => {
  return groupStore
    .getAll()
    .filter(group => group.matchedChannels.has(channelId))
}

/**
 * Group operations interface
 */
export const groupOperations = {
  create: createGroup,
  get: getGroup,
  update: updateGroup,
  remove: removeGroup,
  getAll: getAllGroups,
  getChannelGroups,
  addChannelToGroups,
  removeChannelFromGroups
}

// src/components/cyre-group-templates.ts
// Pre-configured group templates for common use cases

import {schema} from '../schema/cyre-schema'

/**
 * Common middleware functions
 */
export const commonMiddleware = {
  timestamp: async (payload: any, next: any) => {
    return next({...payload, timestamp: Date.now()})
  },

  logger: (prefix: string) => async (payload: any, next: any) => {
    console.log(`${prefix}:`, payload)
    return next(payload)
  },

  validator: (requiredFields: string[]) => async (payload: any, next: any) => {
    for (const field of requiredFields) {
      if (!(field in payload)) {
        return {
          ok: false,
          payload: null,
          message: `Missing required field: ${field}`
        }
      }
    }
    return next(payload)
  },

  rateLimiter: (maxPerSecond: number) => {
    const calls = new Map<string, number[]>()

    return async (payload: any, next: any) => {
      const key = payload.id || 'default'
      const now = Date.now()
      const windowStart = now - 1000

      if (!calls.has(key)) calls.set(key, [])

      const callTimes = calls.get(key)!.filter(time => time > windowStart)

      if (callTimes.length >= maxPerSecond) {
        return {ok: false, payload: null, message: 'Rate limit exceeded'}
      }

      callTimes.push(now)
      calls.set(key, callTimes)

      return next(payload)
    }
  }
}

/**
 * Group templates for common scenarios
 */
export const groupTemplates = {
  /**
   * IoT sensor group template
   */
  iotSensors: (groupId: string, patterns: string[]): GroupConfig => ({
    channels: patterns,
    shared: {
      middleware: [
        commonMiddleware.timestamp,
        commonMiddleware.validator(['deviceId', 'value']),
        commonMiddleware.logger('IoT')
      ],
      throttle: 5000,
      schema: schema.object({
        deviceId: schema.string(),
        value: schema.number(),
        batteryLevel: schema.number().min(0).max(100).optional(),
        timestamp: schema.number().optional()
      }),
      alerts: {
        offline: {
          threshold: 60000,
          action: 'device-offline',
          handler: (channelId, alertType, data) => {
            console.log(`📱 IoT Device ${channelId} offline:`, data)
          }
        },
        lowBattery: {
          threshold: 10,
          action: 'battery-warning',
          condition: 'custom',
          handler: (channelId, alertType, data) => {
            if (data.batteryLevel < 10) {
              console.log(`🔋 Low battery warning for ${channelId}`)
            }
          }
        }
      }
    }
  }),

  /**
   * API endpoint group template
   */
  apiEndpoints: (groupId: string, patterns: string[]): GroupConfig => ({
    channels: patterns,
    shared: {
      middleware: [
        commonMiddleware.logger('API'),
        commonMiddleware.validator(['method', 'path']),
        commonMiddleware.rateLimiter(100)
      ],
      throttle: 100,
      schema: schema.object({
        method: schema.enums('GET', 'POST', 'PUT', 'DELETE'),
        path: schema.string(),
        headers: schema.object({}).optional(),
        body: schema.any().optional()
      }),
      alerts: {
        error: {
          threshold: 1,
          action: 'api-error',
          handler: (channelId, alertType, data) => {
            console.log(`🚨 API Error in ${channelId}:`, data)
          }
        }
      }
    }
  }),

  /**
   * UI component group template
   */
  uiComponents: (groupId: string, patterns: string[]): GroupConfig => ({
    channels: patterns,
    shared: {
      middleware: [commonMiddleware.timestamp, commonMiddleware.logger('UI')],
      debounce: 300,
      detectChanges: true,
      schema: schema.object({
        componentId: schema.string(),
        state: schema.any(),
        action: schema.string().optional()
      })
    }
  }),

  /**
   * Background task group template
   */
  backgroundTasks: (groupId: string, patterns: string[]): GroupConfig => ({
    channels: patterns,
    shared: {
      middleware: [commonMiddleware.timestamp, commonMiddleware.logger('TASK')],
      priority: {level: 'low'},
      throttle: 10000,
      schema: schema.object({
        taskId: schema.string(),
        status: schema.enums('pending', 'running', 'completed', 'failed'),
        progress: schema.number().min(0).max(100).optional()
      }),
      alerts: {
        stuck: {
          threshold: 300000, // 5 minutes
          action: 'task-stuck',
          handler: (channelId, alertType, data) => {
            console.log(`⏳ Task ${channelId} appears stuck:`, data)
          }
        }
      }
    }
  })
}

/**
 * Template application utility
 */
export const applyTemplate = (
  groupId: string,
  templateName: keyof typeof groupTemplates,
  patterns: string[],
  customizations?: Partial<GroupConfig>
) => {
  const template = groupTemplates[templateName](groupId, patterns)

  if (customizations) {
    // Deep merge customizations
    const mergedConfig: GroupConfig = {
      ...template,
      shared: {
        ...template.shared,
        ...customizations.shared,
        middleware: [
          ...(template.shared.middleware || []),
          ...(customizations.shared?.middleware || [])
        ]
      }
    }

    return createGroup(groupId, mergedConfig)
  }

  return createGroup(groupId, template)
}

// Usage examples:
// applyTemplate('sensor-network', 'iotSensors', ['temp-*', 'humidity-*'])
// applyTemplate('api-v1', 'apiEndpoints', ['api-v1-*'], {
//   shared: { throttle: 50 } // Custom throttle
// })

// src/types/core.ts - Add hierarchy support

export interface GroupHierarchy {
  id: string
  parentId?: string
  children: string[]
  level: number
  inheritanceEnabled: boolean
}

// src/components/cyre-group-hierarchy.ts
// Group hierarchy management

const hierarchyStore = createStore<GroupHierarchy>()

/**
 * Create group hierarchy
 */
export const createGroupHierarchy = (
  parentId: string,
  childId: string,
  inheritanceEnabled = true
): {ok: boolean; message: string} => {
  try {
    const parent = getGroup(parentId)
    const child = getGroup(childId)

    if (!parent || !child) {
      return {ok: false, message: 'Parent or child group not found'}
    }

    // Update parent hierarchy
    let parentHierarchy = hierarchyStore.get(parentId)
    if (!parentHierarchy) {
      parentHierarchy = {
        id: parentId,
        children: [],
        level: 0,
        inheritanceEnabled
      }
    }

    if (!parentHierarchy.children.includes(childId)) {
      parentHierarchy.children.push(childId)
    }

    hierarchyStore.set(parentId, parentHierarchy)

    // Update child hierarchy
    const childHierarchy: GroupHierarchy = {
      id: childId,
      parentId,
      children: [],
      level: parentHierarchy.level + 1,
      inheritanceEnabled
    }

    hierarchyStore.set(childId, childHierarchy)

    // Apply inheritance if enabled
    if (inheritanceEnabled) {
      applyInheritance(parentId, childId)
    }

    return {ok: true, message: 'Group hierarchy created'}
  } catch (error) {
    return {ok: false, message: `Hierarchy creation failed: ${error}`}
  }
}

/**
 * Apply configuration inheritance from parent to child
 */
const applyInheritance = (parentId: string, childId: string): void => {
  const parent = getGroup(parentId)
  const child = getGroup(childId)

  if (!parent || !child) return

  // Merge parent config into child (child takes precedence)
  const inheritedConfig: Partial<GroupConfig> = {
    shared: {
      ...parent.config.shared,
      ...child.config.shared,
      // Combine middleware arrays
      middleware: [
        ...(parent.config.shared.middleware || []),
        ...(child.config.shared.middleware || [])
      ]
    }
  }

  updateGroup(childId, inheritedConfig)
}

/**
 * Get group tree
 */
export const getGroupTree = (rootId: string): any => {
  const buildTree = (groupId: string): any => {
    const hierarchy = hierarchyStore.get(groupId)
    const group = getGroup(groupId)

    if (!hierarchy || !group) return null

    return {
      id: groupId,
      level: hierarchy.level,
      channelCount: group.matchedChannels.size,
      children: hierarchy.children
        .map(childId => buildTree(childId))
        .filter(Boolean)
    }
  }

  return buildTree(rootId)
}

// Usage example:
// cyre.group('sensors', { channels: ['sensor-*'], shared: { throttle: 1000 }})
// cyre.group('building-sensors', { channels: ['temp-*', 'motion-*'], shared: { schema: sensorSchema }})
// createGroupHierarchy('sensors', 'building-sensors') // building-sensors inherits from sensors

// src/components/cyre-group-coordination.ts
// Cross-group coordination and communication

interface GroupCoordinationRule {
  id: string
  sourceGroup: string
  targetGroups: string[]
  condition: (data: any) => boolean
  action: 'cascade' | 'aggregate' | 'block' | 'transform'
  transform?: (data: any) => any
  priority: number
}

interface GroupEvent {
  id: string
  groupId: string
  channelId: string
  eventType: 'call' | 'error' | 'alert' | 'custom'
  timestamp: number
  data: any
}

const coordinationRules = createStore<GroupCoordinationRule>()
const groupEvents = createStore<GroupEvent>()

/**
 * Cross-group coordination system
 */
export const groupCoordination = {
  /**
   * Add coordination rule
   */
  addRule: (rule: GroupCoordinationRule) => {
    coordinationRules.set(rule.id, rule)
  },

  /**
   * Emergency shutdown coordination
   */
  emergencyShutdown: (triggerGroupId: string, reason: string) => {
    const allGroups = getAllGroups()

    console.log(`🚨 Emergency shutdown triggered by group: ${triggerGroupId}`)
    console.log(`Reason: ${reason}`)

    // Pause all non-critical groups
    allGroups.forEach(group => {
      if (group.id !== triggerGroupId) {
        group.isActive = false
        console.log(`⏸️ Paused group: ${group.id}`)
      }
    })

    // Emit emergency event
    cyre.call('system-emergency', {
      triggerGroup: triggerGroupId,
      reason,
      timestamp: Date.now(),
      affectedGroups: allGroups.map(g => g.id)
    })
  },

  /**
   * Load balancing between groups
   */
  loadBalance: (
    groupIds: string[],
    strategy: 'round-robin' | 'least-loaded' = 'round-robin'
  ) => {
    let currentIndex = 0

    return (channelId: string, payload: any) => {
      const groups = groupIds.map(id => getGroup(id)).filter(Boolean)

      if (groups.length === 0) return false

      let selectedGroup

      if (strategy === 'round-robin') {
        selectedGroup = groups[currentIndex % groups.length]
        currentIndex++
      } else {
        // least-loaded: select group with fewest active channels
        selectedGroup = groups.reduce((min, group) =>
          group.matchedChannels.size < min.matchedChannels.size ? group : min
        )
      }

      // Create channel in selected group's pattern
      const newChannelId = `${selectedGroup.id}-lb-${channelId}`

      cyre.action({
        id: newChannelId,
        payload
      })

      return cyre.call(newChannelId, payload)
    }
  },

  /**
   * Group state synchronization
   */
  synchronizeGroups: (groupIds: string[], syncKey: string) => {
    const syncState = new Map<string, any>()

    groupIds.forEach(groupId => {
      const group = getGroup(groupId)
      if (!group) return

      // Listen to all channels in group
      group.matchedChannels.forEach(channelId => {
        cyre.on(channelId, (data: any) => {
          if (data[syncKey] !== undefined) {
            syncState.set(syncKey, data[syncKey])

            // Propagate to other groups
            groupIds.forEach(targetGroupId => {
              if (targetGroupId !== groupId) {
                const targetGroup = getGroup(targetGroupId)
                if (targetGroup) {
                  targetGroup.matchedChannels.forEach(targetChannelId => {
                    cyre.call(targetChannelId, {
                      [syncKey]: data[syncKey],
                      syncedFrom: channelId,
                      syncTimestamp: Date.now()
                    })
                  })
                }
              }
            })
          }
        })
      })
    })

    return {
      getState: () => Object.fromEntries(syncState),
      stop: () => {
        // Implementation for stopping synchronization
        syncState.clear()
      }
    }
  },

  /**
   * Circuit breaker pattern for groups
   */
  createCircuitBreaker: (
    groupId: string,
    config: {
      failureThreshold: number
      timeout: number
      halfOpenRetryCount: number
    }
  ) => {
    let state: 'closed' | 'open' | 'half-open' = 'closed'
    let failureCount = 0
    let lastFailureTime = 0
    let retryCount = 0

    return {
      execute: async (channelId: string, payload: any) => {
        const now = Date.now()

        // Check if circuit should move from open to half-open
        if (state === 'open' && now - lastFailureTime > config.timeout) {
          state = 'half-open'
          retryCount = 0
        }

        // Block execution if circuit is open
        if (state === 'open') {
          throw new Error(`Circuit breaker is open for group: ${groupId}`)
        }

        try {
          const result = await cyre.call(channelId, payload)

          if (!result.ok) {
            throw new Error(result.message)
          }

          // Success - reset circuit if in half-open state
          if (state === 'half-open') {
            state = 'closed'
            failureCount = 0
          }

          return result
        } catch (error) {
          failureCount++
          lastFailureTime = now

          if (state === 'half-open') {
            retryCount++
            if (retryCount >= config.halfOpenRetryCount) {
              state = 'open'
            }
          } else if (failureCount >= config.failureThreshold) {
            state = 'open'
          }

          throw error
        }
      },

      getState: () => ({state, failureCount, lastFailureTime})
    }
  },

  /**
   * Group-to-group messaging
   */
  createMessaging: () => {
    const messageQueues = new Map<string, any[]>()

    return {
      send: (fromGroup: string, toGroup: string, message: any) => {
        const queue = messageQueues.get(toGroup) || []
        queue.push({
          from: fromGroup,
          message,
          timestamp: Date.now(),
          id: crypto.randomUUID()
        })
        messageQueues.set(toGroup, queue)

        // Emit message event
        cyre.call(`group-message-${toGroup}`, {
          from: fromGroup,
          message,
          queueSize: queue.length
        })
      },

      receive: (groupId: string): any[] => {
        const messages = messageQueues.get(groupId) || []
        messageQueues.set(groupId, []) // Clear queue
        return messages
      },

      subscribe: (groupId: string, handler: (message: any) => void) => {
        cyre.on(`group-message-${groupId}`, handler)
      }
    }
  }
}

/**
 * Distributed group orchestration
 */
export const groupOrchestration = {
  /**
   * Saga pattern for distributed transactions across groups
   */
  createSaga: (
    sagaId: string,
    steps: Array<{
      groupId: string
      channelId: string
      payload: any
      compensate?: any
    }>
  ) => {
    const completedSteps: number[] = []
    const compensations: Array<() => Promise<void>> = []

    return {
      execute: async () => {
        try {
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i]

            const result = await cyre.call(step.channelId, step.payload)

            if (!result.ok) {
              throw new Error(`Step ${i} failed: ${result.message}`)
            }

            completedSteps.push(i)

            // Add compensation if provided
            if (step.compensate) {
              compensations.push(async () => {
                await cyre.call(step.channelId, step.compensate)
              })
            }
          }

          return {success: true, completedSteps}
        } catch (error) {
          // Execute compensations in reverse order
          for (let i = compensations.length - 1; i >= 0; i--) {
            try {
              await compensations[i]()
            } catch (compensationError) {
              console.error(`Compensation ${i} failed:`, compensationError)
            }
          }

          return {
            success: false,
            error,
            completedSteps,
            compensationsExecuted: compensations.length
          }
        }
      }
    }
  },

  /**
   * Event sourcing for group state changes
   */
  createEventStore: () => {
    const events: GroupEvent[] = []

    return {
      append: (event: Omit<GroupEvent, 'id' | 'timestamp'>) => {
        const fullEvent: GroupEvent = {
          ...event,
          id: crypto.randomUUID(),
          timestamp: Date.now()
        }

        events.push(fullEvent)
        groupEvents.set(fullEvent.id, fullEvent)

        return fullEvent
      },

      getEvents: (groupId?: string, eventType?: string) => {
        return events.filter(
          event =>
            (!groupId || event.groupId === groupId) &&
            (!eventType || event.eventType === eventType)
        )
      },

      replay: (groupId: string, fromTimestamp?: number) => {
        const relevantEvents = events.filter(
          event =>
            event.groupId === groupId &&
            (!fromTimestamp || event.timestamp >= fromTimestamp)
        )

        relevantEvents.forEach(event => {
          cyre.call(`replay-${event.channelId}`, event.data)
        })

        return relevantEvents.length
      }
    }
  }
}

// Usage examples:
/*
// Emergency coordination
groupCoordination.addRule({
  id: 'emergency-stop',
  sourceGroup: 'safety-sensors',
  targetGroups: ['industrial-machines', 'conveyor-belts'],
  condition: (data) => data.emergencyStop === true,
  action: 'block',
  priority: 1
})

// Load balancing
const balancer = groupCoordination.loadBalance(['worker-group-1', 'worker-group-2'])
balancer('heavy-task', { data: 'process this' })

// Circuit breaker
const circuitBreaker = groupCoordination.createCircuitBreaker('payment-services', {
  failureThreshold: 5,
  timeout: 30000,
  halfOpenRetryCount: 3
})

// Cross-group messaging
const messaging = groupCoordination.createMessaging()
messaging.send('sensors', 'alerts', { level: 'warning', message: 'Temperature high' })

// Saga pattern
const saga = groupOrchestration.createSaga('payment-process', [
  { groupId: 'payment', channelId: 'charge-card', payload: { amount: 100 }, compensate: { refund: 100 } },
  { groupId: 'inventory', channelId: 'reserve-item', payload: { itemId: 'abc123' }, compensate: { release: 'abc123' } },
  { groupId: 'shipping', channelId: 'create-label', payload: { address: '...' } }
])
*/

// src/components/cyre-group-analytics.ts
// Advanced analytics and pattern detection for groups

import {metricsReport} from '../context/metrics-report'

interface AnalyticsResult {
  groupId: string
  insights: string[]
  recommendations: string[]
  score: number
  trends: {
    usage: 'increasing' | 'decreasing' | 'stable'
    errors: 'increasing' | 'decreasing' | 'stable'
    performance: 'improving' | 'degrading' | 'stable'
  }
}

interface GroupPattern {
  name: string
  confidence: number
  description: string
  channels: string[]
  timeRange: {start: number; end: number}
}

/**
 * Group analytics and intelligence
 */
export const groupAnalytics = {
  /**
   * Analyze group performance and behavior
   */
  analyzeGroup: (groupId: string, timeWindow = 3600000): AnalyticsResult => {
    const group = getGroup(groupId)
    if (!group) {
      return {
        groupId,
        insights: ['Group not found'],
        recommendations: [],
        score: 0,
        trends: {usage: 'stable', errors: 'stable', performance: 'stable'}
      }
    }

    const insights: string[] = []
    const recommendations: string[] = []
    let score = 100

    const channels = Array.from(group.matchedChannels)
    const now = Date.now()
    const windowStart = now - timeWindow

    // Analyze channel activity
    let totalCalls = 0
    let totalErrors = 0
    let lastActivity = 0

    channels.forEach(channelId => {
      const stats = metricsReport.getActionStats(channelId)
      if (stats) {
        totalCalls += stats.calls
        totalErrors += stats.errors
        lastActivity = Math.max(lastActivity, stats.lastCall)
      }
    })

    // Performance insights
    if (totalCalls === 0) {
      insights.push('No activity detected in this group')
      score -= 20
      recommendations.push('Check if channels are properly configured')
    } else {
      const errorRate = totalErrors / totalCalls
      if (errorRate > 0.1) {
        insights.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`)
        score -= 30
        recommendations.push('Investigate error causes and add error handling')
      }
    }

    // Middleware efficiency
    if (group.middlewareIds.length > 5) {
      insights.push('Many middleware functions may impact performance')
      score -= 10
      recommendations.push('Consider consolidating middleware functions')
    }

    // Channel distribution
    if (channels.length > 50) {
      insights.push('Large number of channels in group')
      recommendations.push('Consider splitting into sub-groups')
    }

    // Activity trends (simplified)
    const recentActivity = now - lastActivity < timeWindow / 4
    const trends = {
      usage: recentActivity ? 'increasing' : ('decreasing' as const),
      errors: totalErrors > 0 ? 'increasing' : ('stable' as const),
      performance: score > 80 ? 'improving' : ('degrading' as const)
    }

    return {
      groupId,
      insights,
      recommendations,
      score: Math.max(0, score),
      trends
    }
  },

  /**
   * Detect patterns across groups
   */
  detectPatterns: (timeWindow = 7200000): GroupPattern[] => {
    const patterns: GroupPattern[] = []
    const allGroups = getAllGroups()
    const now = Date.now()
    const windowStart = now - timeWindow

    // Pattern 1: Synchronized activity
    const groupActivity = new Map<string, number[]>()

    allGroups.forEach(group => {
      const activities: number[] = []
      group.matchedChannels.forEach(channelId => {
        const stats = metricsReport.getActionStats(channelId)
        if (stats && stats.lastCall > windowStart) {
          activities.push(stats.lastCall)
        }
      })
      groupActivity.set(group.id, activities.sort())
    })

    // Find groups with similar activity patterns
    const groupIds = Array.from(groupActivity.keys())
    for (let i = 0; i < groupIds.length; i++) {
      for (let j = i + 1; j < groupIds.length; j++) {
        const group1Activities = groupActivity.get(groupIds[i]) || []
        const group2Activities = groupActivity.get(groupIds[j]) || []

        if (group1Activities.length > 0 && group2Activities.length > 0) {
          const correlation = calculateCorrelation(
            group1Activities,
            group2Activities
          )

          if (correlation > 0.8) {
            patterns.push({
              name: 'Synchronized Activity',
              confidence: correlation,
              description: `Groups ${groupIds[i]} and ${groupIds[j]} show synchronized activity patterns`,
              channels: [
                ...(getGroup(groupIds[i])?.matchedChannels || []),
                ...(getGroup(groupIds[j])?.matchedChannels || [])
              ],
              timeRange: {start: windowStart, end: now}
            })
          }
        }
      }
    }

    // Pattern 2: Error cascades
    allGroups.forEach(group => {
      let errorCount = 0
      group.matchedChannels.forEach(channelId => {
        const stats = metricsReport.getActionStats(channelId)
        if (stats) {
          errorCount += stats.errors
        }
      })

      if (errorCount > group.matchedChannels.size * 0.5) {
        patterns.push({
          name: 'Error Cascade',
          confidence: Math.min(errorCount / group.matchedChannels.size, 1),
          description: `Group ${group.id} experiencing widespread errors`,
          channels: Array.from(group.matchedChannels),
          timeRange: {start: windowStart, end: now}
        })
      }
    })

    return patterns.sort((a, b) => b.confidence - a.confidence)
  },

  /**
   * Predict group behavior
   */
  predictBehavior: (
    groupId: string
  ): {
    nextPeakTime: number
    expectedLoad: number
    riskLevel: 'low' | 'medium' | 'high'
    confidence: number
  } => {
    const group = getGroup(groupId)
    if (!group) {
      return {
        nextPeakTime: Date.now() + 3600000,
        expectedLoad: 0,
        riskLevel: 'low',
        confidence: 0
      }
    }

    // Simple prediction based on historical patterns
    let totalCalls = 0
    let maxCallsPerChannel = 0

    group.matchedChannels.forEach(channelId => {
      const stats = metricsReport.getActionStats(channelId)
      if (stats) {
        totalCalls += stats.calls
        maxCallsPerChannel = Math.max(maxCallsPerChannel, stats.calls)
      }
    })

    const avgCallsPerChannel = totalCalls / group.matchedChannels.size
    const loadVariance = maxCallsPerChannel - avgCallsPerChannel

    // Predict next peak (simplified)
    const peakInterval = 3600000 // 1 hour
    const nextPeakTime = Date.now() + peakInterval

    // Risk assessment
    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    if (loadVariance > avgCallsPerChannel * 2) riskLevel = 'high'
    else if (loadVariance > avgCallsPerChannel) riskLevel = 'medium'

    return {
      nextPeakTime,
      expectedLoad: Math.ceil(avgCallsPerChannel * 1.5),
      riskLevel,
      confidence: Math.min(totalCalls / 100, 0.9) // Higher confidence with more data
    }
  },

  /**
   * Auto-optimization suggestions
   */
  suggest: (
    groupId: string
  ): {
    throttleOptimization?: number
    middlewareReduction?: string[]
    patternReorganization?: string[]
    performanceImprovements?: string[]
  } => {
    const analysis = groupAnalytics.analyzeGroup(groupId)
    const suggestions: any = {}

    if (analysis.score < 70) {
      suggestions.performanceImprovements = [
        'Consider reducing middleware chain length',
        'Implement caching for frequently accessed data',
        'Add error boundaries for better fault isolation'
      ]
    }

    const group = getGroup(groupId)
    if (group) {
      // Throttle optimization
      let avgCallRate = 0
      group.matchedChannels.forEach(channelId => {
        const stats = metricsReport.getActionStats(channelId)
        if (stats) {
          avgCallRate += stats.calls
        }
      })
      avgCallRate = avgCallRate / group.matchedChannels.size

      if (avgCallRate > 100) {
        suggestions.throttleOptimization = Math.ceil(avgCallRate / 10) * 10
      }

      // Pattern reorganization
      if (group.matchedChannels.size > 20) {
        suggestions.patternReorganization = [
          'Consider splitting large groups by functionality',
          'Use hierarchical group structure',
          'Implement sub-groups for better organization'
        ]
      }
    }

    return suggestions
  }
}

/**
 * Helper function to calculate correlation between two arrays
 */
const calculateCorrelation = (arr1: number[], arr2: number[]): number => {
  if (arr1.length !== arr2.length || arr1.length === 0) return 0

  const n = arr1.length
  const sum1 = arr1.reduce((a, b) => a + b, 0)
  const sum2 = arr2.reduce((a, b) => a + b, 0)
  const sum1Sq = arr1.reduce((a, b) => a + b * b, 0)
  const sum2Sq = arr2.reduce((a, b) => a + b * b, 0)
  const pSum = arr1.reduce((a, b, i) => a + b * arr2[i], 0)

  const num = pSum - (sum1 * sum2) / n
  const den = Math.sqrt(
    (sum1Sq - (sum1 * sum1) / n) * (sum2Sq - (sum2 * sum2) / n)
  )

  return den === 0 ? 0 : num / den
}

/**
 * Real-time group monitoring dashboard data
 */
export const groupDashboard = {
  getLiveMetrics: () => {
    const allGroups = getAllGroups()

    return allGroups.map(group => {
      const analysis = groupAnalytics.analyzeGroup(group.id)
      const prediction = groupAnalytics.predictBehavior(group.id)

      return {
        id: group.id,
        channelCount: group.matchedChannels.size,
        middlewareCount: group.middlewareIds.length,
        healthScore: analysis.score,
        trends: analysis.trends,
        nextPeakTime: prediction.nextPeakTime,
        riskLevel: prediction.riskLevel,
        isActive: group.isActive,
        uptime: Date.now() - group.createdAt
      }
    })
  },

  getAlerts: () => {
    const patterns = groupAnalytics.detectPatterns()
    return patterns.filter(
      p => p.name === 'Error Cascade' && p.confidence > 0.7
    )
  }
}
