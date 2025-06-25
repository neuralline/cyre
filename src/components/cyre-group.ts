// src/components/cyre-group.ts
// Channel grouping with shared configuration

import type {
  IO,
  ActionPayload,
  GroupConfig,
  GroupState,
  GroupResult
} from '../types/core'
import {io, subscribers} from '../context/state'
import {sensor} from '../context/metrics-report'
import {log} from './cyre-log'
import {createStore} from '../context/create-store'

/*

      C.Y.R.E - G.R.O.U.P
      
      Channel grouping system:
      - Pattern-based channel matching
      - Shared   configuration
      - Group-level operations
      - Simple alert management

*/

const groupStore = createStore<GroupState>()

/**
 * Check if channel ID matches pattern (wildcard only)
 */
const matchesPattern = (channelId: string, pattern: string): boolean => {
  if (pattern === channelId) return true
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

  const {alerts, ...safeShared} = shared

  const updated: IO = {
    ...existing,
    ...safeShared,
    id: channelId
  }

  io.set(updated)
}

/**
 * Create and manage channel group
 */
export const createGroup = (
  groupId: string,
  config: GroupConfig
): GroupResult<GroupState> => {
  try {
    if (!groupId || typeof groupId !== 'string') {
      return {ok: false, message: 'Group ID must be a non-empty string'}
    }

    if (!config.channels || !Array.isArray(config.channels)) {
      return {ok: false, message: 'Group channels must be an array of patterns'}
    }

    if (!config.shared || typeof config.shared !== 'object') {
      return {ok: false, message: 'Group shared configuration is required'}
    }

    const matchedChannels = findMatchingChannels(config.channels)

    const groupState: GroupState = {
      id: groupId,
      config,
      matchedChannels: new Set(matchedChannels),

      alertStates: new Map(),
      isActive: true,
      createdAt: Date.now()
    }

    matchedChannels.forEach(channelId => {
      applySharedConfig(channelId, config.shared)
    })

    groupStore.set(groupId, groupState)

    sensor.log(groupId, 'success', 'group-created', {
      matchedChannels: matchedChannels.length
    })

    return {
      ok: true,
      message: `Group created with ${matchedChannels.length} matched channels`,
      payload: groupState
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Group creation failed: ${errorMessage}`)
    return {ok: false, message: `Group creation failed: ${errorMessage}`}
  }
}

/**
 * Add channel to existing groups if it matches patterns
 */
export const addChannelToGroups = (channelId: string): void => {
  const allGroups = groupStore.getAll()

  allGroups.forEach(group => {
    if (!group.isActive) return

    const matches = group.config.channels.some(pattern =>
      matchesPattern(channelId, pattern)
    )

    if (matches && !group.matchedChannels.has(channelId)) {
      group.matchedChannels.add(channelId)
      applySharedConfig(channelId, group.config.shared)
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
 * Update group configuration
 */
export const updateGroup = (
  groupId: string,
  updates: Partial<GroupConfig>
): GroupResult => {
  try {
    const group = groupStore.get(groupId)
    if (!group) {
      return {ok: false, message: 'Group not found'}
    }

    const newConfig = {
      ...group.config,
      ...updates,
      shared: {
        ...group.config.shared,
        ...updates.shared
      }
    }

    if (updates.channels) {
      const newMatches = findMatchingChannels(newConfig.channels)
      group.matchedChannels.clear()
      newMatches.forEach(channelId => group.matchedChannels.add(channelId))
    }

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
 * Remove group and cleanup
 */
export const removeGroup = (groupId: string): boolean => {
  const group = groupStore.get(groupId)
  if (!group) return false

  group.isActive = false
  const removed = groupStore.forget(groupId)

  sensor.log(groupId, 'info', 'group-removed', {
    channelCount: group.matchedChannels.size
  })

  return removed
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
