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
