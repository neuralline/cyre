// src/context/payload-state.ts
// Dedicated payload state management with reactive features

import {createStore} from './create-store'
import {isEqual} from '../libs/utils'
import {log} from '../components/cyre-log'
import {sensor} from './metrics-report'
import type {ActionPayload, StateKey} from '../types/core'

/*

      C.Y.R.E - P.A.Y.L.O.A.D - S.T.A.T.E
      
      Dedicated payload state management:
      - Separate from IO configuration
      - Change detection and history
      - Reactive payload features
      - State snapshots and time travel
      - Payload validation and transformation
      - Cross-channel payload sharing

*/

interface PayloadEntry {
  current: ActionPayload
  previous?: ActionPayload
  history: PayloadHistoryEntry[]
  metadata: {
    lastUpdated: number
    updateCount: number
    source: 'initial' | 'call' | 'pipeline' | 'external'
    frozen: boolean
  }
}

interface PayloadHistoryEntry {
  payload: ActionPayload
  timestamp: number
  source: string
  changeType: 'set' | 'transform' | 'merge' | 'reset' | 'initial'
}

// Configuration
const PAYLOAD_CONFIG = {
  MAX_HISTORY_PER_CHANNEL: 50,
  MAX_SNAPSHOTS: 10,
  ENABLE_DEEP_WATCH: true,
  AUTO_SNAPSHOT_INTERVAL: 300000, // 5 minutes
  SUBSCRIPTION_TIMEOUT: 5000
}

// Storage
const payloadStore = createStore<PayloadEntry>()

/**
 * Core payload operations
 */
export const payloadState = {
  /**
   * Set payload for channel
   */
  set: (
    channelId: string,
    payload: ActionPayload,
    source: 'initial' | 'call' | 'pipeline' | 'external' = 'call'
  ): void => {
    try {
      const now = Date.now()
      const existing = payloadStore.get(channelId)

      // Create history entry
      const historyEntry: PayloadHistoryEntry = {
        payload: existing?.current,
        timestamp: now,
        source,
        changeType: existing ? 'set' : 'initial'
      }

      // Create new entry
      const entry: PayloadEntry = {
        current: payload,
        previous: existing?.current,
        history: existing
          ? [
              ...existing.history.slice(
                -PAYLOAD_CONFIG.MAX_HISTORY_PER_CHANNEL + 1
              ),
              historyEntry
            ]
          : [historyEntry],
        metadata: {
          lastUpdated: now,
          updateCount: (existing?.metadata.updateCount || 0) + 1,
          source,
          frozen: existing?.metadata.frozen || false
        }
      }

      // Check if frozen
      if (existing?.metadata.frozen) {
        log.warn(`Payload for ${channelId} is frozen - update blocked`)
        sensor.log(channelId, 'blocked', 'payload-frozen', {source})
        return
      }

      payloadStore.set(channelId, entry)
      sensor.log(channelId, 'info', 'payload-updated', {
        source,
        updateCount: entry.metadata.updateCount,
        hasChanged: !isEqual(payload, existing?.current)
      })
    } catch (error) {
      log.error(`Failed to set payload for ${channelId}: ${error}`)
      sensor.error(channelId, String(error), 'payload-set')
    }
  },

  /**
   * Get current payload for channel
   */
  get: (channelId: string): ActionPayload | undefined => {
    return payloadStore.get(channelId)?.current
  },

  /**
   * Get previous payload for channel
   */
  getPrevious: (channelId: string): ActionPayload | undefined => {
    return payloadStore.get(channelId)?.previous
  },

  /**
   * Check if payload has changed
   */
  hasChanged: (channelId: string, newPayload: ActionPayload): boolean => {
    try {
      const entry = payloadStore.get(channelId)
      if (!entry) return true
      const hasChanged = !isEqual(newPayload, entry.current)
      sensor.log(channelId, 'info', 'change-detection', {
        hasChanged,
        comparisonType: 'deep-equal'
      })

      return hasChanged
    } catch (error) {
      log.error(`Change detection failed for ${channelId}: ${error}`)
      return true // Assume changed on error
    }
  },

  /**
   * Remove payload entry
   */
  forget: (channelId: string): boolean => {
    try {
      const result = payloadStore.forget(channelId)
      sensor.log(channelId, 'info', 'payload-forgotten')
      return result
    } catch (error) {
      log.error(`Failed to forget payload for ${channelId}: ${error}`)
      return false
    }
  },

  /**
   * Clear all payloads
   */
  clear: (): void => {
    try {
      payloadStore.clear()
      sensor.log('system', 'info', 'payload-state-cleared')
      //log.debug('Payload state cleared')
    } catch (error) {
      log.error(`Failed to clear payload state: ${error}`)
    }
  },

  /**
   * Get payload metadata
   */
  getMetadata: (channelId: string) => {
    const entry = payloadStore.get(channelId)
    return entry?.metadata
  },

  /**
   * Get payload history
   */
  getHistory: (channelId: string, limit?: number): PayloadHistoryEntry[] => {
    const entry = payloadStore.get(channelId)
    if (!entry) return []

    const history = entry.history
    return limit ? history.slice(-limit) : history
  },

  /**
   * Transform payload with function
   */
  transform: (
    channelId: string,
    transformFn: (payload: ActionPayload) => ActionPayload
  ): ActionPayload | undefined => {
    try {
      const entry = payloadStore.get(channelId)
      if (!entry) return undefined

      const transformed = transformFn(entry.current)
      payloadState.set(channelId, transformed, 'pipeline')

      sensor.log(channelId, 'info', 'payload-transformed')
      return transformed
    } catch (error) {
      log.error(`Payload transform failed for ${channelId}: ${error}`)
      sensor.error(channelId, String(error), 'payload-transform')
      return undefined
    }
  },

  /**
   * Merge payload with existing
   */
  merge: (
    channelId: string,
    partialPayload: Partial<ActionPayload>
  ): ActionPayload | undefined => {
    try {
      const entry = payloadStore.get(channelId)
      if (!entry) {
        payloadState.set(channelId, partialPayload, 'external')
        return partialPayload
      }

      const merged =
        typeof entry.current === 'object' && entry.current !== null
          ? {...entry.current, ...partialPayload}
          : partialPayload

      payloadState.set(channelId, merged, 'external')

      sensor.log(channelId, 'info', 'payload-merged')
      return merged
    } catch (error) {
      log.error(`Payload merge failed for ${channelId}: ${error}`)
      return undefined
    }
  },

  /**
   * Freeze payload (make immutable)
   */
  freeze: (channelId: string): boolean => {
    try {
      const entry = payloadStore.get(channelId)
      if (!entry) return false

      entry.metadata.frozen = true
      payloadStore.set(channelId, entry)

      sensor.log(channelId, 'info', 'payload-frozen')
      return true
    } catch (error) {
      log.error(`Failed to freeze payload for ${channelId}: ${error}`)
      return false
    }
  },

  /**
   * Unfreeze payload
   */
  unfreeze: (channelId: string): boolean => {
    try {
      const entry = payloadStore.get(channelId)
      if (!entry) return false

      entry.metadata.frozen = false
      payloadStore.set(channelId, entry)

      sensor.log(channelId, 'info', 'payload-unfrozen')
      return true
    } catch (error) {
      log.error(`Failed to unfreeze payload for ${channelId}: ${error}`)
      return false
    }
  },

  /**
   * Get all channel IDs with payloads
   */
  getChannels: (): string[] => {
    return payloadStore.getAll().map((_, index) => {
      // We need to get the keys from the store
      // This is a limitation of the current store implementation
      // In practice, we'd need to modify createStore to expose keys
      return `channel-${index}` // Placeholder - needs store enhancement
    })
  },

  /**
   * Get payload statistics
   */
  getStats: () => {
    const entries = payloadStore.getAll()
    const totalUpdates = entries.reduce(
      (sum, entry) => sum + entry.metadata.updateCount,
      0
    )
    const frozenCount = entries.filter(entry => entry.metadata.frozen).length
    const historySize = entries.reduce(
      (sum, entry) => sum + entry.history.length,
      0
    )
    return {
      totalChannels: entries.length,
      totalUpdates,
      frozenChannels: frozenCount,

      historySize,
      memoryUsage: {
        payloads: entries.length * 256, // Rough estimate
        history: historySize * 128
      }
    }
  }
}

/**
 * Advanced payload operations
 */
export const advancedPayloadOps = {
  /**
   * Compare payloads between channels
   */
  compare: (
    channelId1: string,
    channelId2: string
  ): {
    equal: boolean
    differences: string[]
    similarity: number
  } => {
    const payload1 = payloadState.get(channelId1)
    const payload2 = payloadState.get(channelId2)
    if (!payload1 || !payload2) {
      return {
        equal: false,
        differences: ['One or both payloads not found'],
        similarity: 0
      }
    }

    const equal = isEqual(payload1, payload2)

    // Simple similarity calculation (can be enhanced)
    const similarity = equal ? 1 : 0.5 // Placeholder logic

    return {
      equal,
      differences: equal ? [] : ['Payloads differ'], // Can be enhanced with deep diff
      similarity
    }
  },

  /**
   * Share payload between channels
   */
  share: (
    sourceChannelId: string,
    targetChannelId: string,
    transform?: (payload: ActionPayload) => ActionPayload
  ): boolean => {
    try {
      const sourcePayload = payloadState.get(sourceChannelId)
      if (!sourcePayload) return false

      const finalPayload = transform ? transform(sourcePayload) : sourcePayload
      payloadState.set(targetChannelId, finalPayload, 'external')

      sensor.log(sourceChannelId, 'info', 'payload-shared', {
        targetChannelId,
        transformed: !!transform
      })

      return true
    } catch (error) {
      log.error(
        `Failed to share payload from ${sourceChannelId} to ${targetChannelId}: ${error}`
      )
      return false
    }
  },

  /**
   * Sync payloads between multiple channels
   */
  sync: (channelIds: string[], sourceChannelId?: string): boolean => {
    try {
      const source = sourceChannelId || channelIds[0]
      const sourcePayload = payloadState.get(source)

      if (!sourcePayload) return false

      channelIds.forEach(channelId => {
        if (channelId !== source) {
          payloadState.set(channelId, sourcePayload, 'external')
        }
      })

      sensor.log(source, 'info', 'payload-synced', {
        targetChannels: channelIds.filter(id => id !== source),
        syncCount: channelIds.length - 1
      })

      return true
    } catch (error) {
      log.error(`Failed to sync payloads: ${error}`)
      return false
    }
  },

  /**
   * Validate payload against schema
   */
  validate: (
    channelId: string,
    schema: any
  ): {valid: boolean; errors?: string[]} => {
    try {
      const payload = payloadState.get(channelId)
      if (!payload) {
        return {valid: false, errors: ['Payload not found']}
      }

      // This would use the schema validation system
      // const result = validate(schema, payload)
      // For now, simple validation
      const valid = payload !== null && payload !== undefined
      sensor.log(channelId, 'info', 'payload-validated', {
        valid,
        hasSchema: !!schema
      })

      return {valid, errors: valid ? undefined : ['Validation failed']}
    } catch (error) {
      log.error(`Payload validation failed for ${channelId}: ${error}`)
      return {valid: false, errors: [String(error)]}
    }
  }
}

// Export main interface
export default payloadState
