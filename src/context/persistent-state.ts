// src/context/persistent-state.ts
// Integrated persistence layer for existing state system

import {log} from '../components/cyre-log'
import {io, subscribers, timeline} from './state'
import type {IO, ActionPayload, Timer} from '../types/core'
import payloadState from './payload-state'

/*

      C.Y.R.E - P.E.R.S.I.S.T.E.N.T - S.T.A.T.E
      
      Persistence layer for existing state system:
      - Serializes existing state stores
      - Hydrates state on startup
      - Preserves function references vs data separation

*/

// What gets persisted (data only, no functions)
interface PersistentState {
  actions: Record<string, IO>
  subscriberIds: string[] // Just the IDs, not the functions
  timerConfigs: Array<{
    id: string
    duration: number
    originalDuration: number
    repeat?: number | boolean
    delay?: number
    interval?: number
    executionCount: number
    isInRecuperation: boolean
  }>
  payloadHistory: Record<string, ActionPayload>
  timestamp: number
  version: string
}

// Configuration for Cyre initialization
interface CyreConfig {
  persistentState?: PersistentState
  autoSave?: boolean
  saveKey?: string
}

// Auto-save state
let autoSaveEnabled = false
let saveKey = 'cyre-state'

/**
 * Serialize current state from existing stores
 */
const serialize = (): PersistentState => {
  try {
    // Get all actions from existing io store
    const actions: Record<string, IO> = {}
    io.getAll().forEach(action => {
      actions[action.id] = action
    })

    // Get subscriber IDs only (functions can't be serialized)
    const subscriberIds = subscribers.getAll().map(sub => sub.id)

    // Get timer configurations (not active timeouts)
    const timerConfigs = timeline.getAll().map(timer => ({
      id: timer.id,
      duration: timer.duration,
      originalDuration: timer.originalDuration,
      repeat: timer.repeat,
      delay: timer.delay,
      interval: timer.interval,
      executionCount: timer.executionCount,
      isInRecuperation: timer.isInRecuperation
    }))

    // Get payload history for change detection
    const payloadHistory: Record<string, ActionPayload> = {}
    io.getAll().forEach(action => {
      const previous = io.getPrevious(action.id)
      if (previous !== undefined) {
        payloadHistory[action.id] = previous
      }
    })

    return {
      actions,
      subscriberIds,
      timerConfigs,
      payloadHistory,
      timestamp: Date.now(),
      version: '4.1.0'
    }
  } catch (error) {
    log.error(`State serialization failed: ${error}`)
    throw error
  }
}

/**
 * Restore state to existing stores
 */
const hydrate = (state: PersistentState): void => {
  try {
    // Validate state structure
    if (!state.actions || !Array.isArray(state.subscriberIds)) {
      throw new Error('Invalid persistent state structure')
    }

    // Version compatibility
    if (state.version !== '4.1.0') {
      log.warn(`State version mismatch: ${state.version} vs 4.1.0`)
    }

    // Restore actions to existing io store
    Object.values(state.actions).forEach(action => {
      io.set(action)
    })

    // Restore payload history
    Object.entries(state.payloadHistory).forEach(([id, payload]) => {
      payloadState.set(id, payload, 'initial')
    })

    // Note: Timer configs are stored but will need to be recreated by the application
    // since we can't serialize the callback functions

    log.debug(
      `Hydrated ${Object.keys(state.actions).length} actions, ${
        state.subscriberIds.length
      } subscriber IDs`
    )
  } catch (error) {
    log.error(`State hydration failed: ${error}`)
    throw error
  }
}

/**
 * Auto-save current state
 */
const autoSave = async (): Promise<void> => {
  if (!autoSaveEnabled) return

  try {
    const state = serialize()
    await storageAdapter.save(saveKey, state)
  } catch (error) {
    log.error(`Auto-save failed: ${error}`)
  }
}

/**
 * Get persistence statistics
 */
const getStats = () => {
  const state = serialize()
  return {
    actionCount: Object.keys(state.actions).length,
    subscriberCount: state.subscriberIds.length,
    timerCount: state.timerConfigs.length,
    payloadHistoryCount: Object.keys(state.payloadHistory).length,
    lastUpdate: state.timestamp
  }
}

// Storage adapter interface
interface StorageAdapter {
  save: (key: string, state: PersistentState) => Promise<void>
  load: (key: string) => Promise<PersistentState | null>
}

// Default localStorage adapter
let storageAdapter: StorageAdapter = {
  save: async (key: string, state: PersistentState) => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      log.error(`Failed to save state: ${error}`)
    }
  },

  load: async (key: string) => {
    if (typeof localStorage === 'undefined') return null
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      log.error(`Failed to load state: ${error}`)
      return null
    }
  }
}

/**
 * Set configuration
 */
const configure = (config: {
  autoSave?: boolean
  saveKey?: string
  adapter?: StorageAdapter
}) => {
  if (config.autoSave !== undefined) autoSaveEnabled = config.autoSave
  if (config.saveKey) saveKey = config.saveKey
  if (config.adapter) storageAdapter = config.adapter
}

/**
 * Manual save/load operations
 */
const saveState = async (key?: string): Promise<void> => {
  const state = serialize()
  await storageAdapter.save(key || saveKey, state)
}

const loadState = async (key?: string): Promise<PersistentState | null> => {
  return await storageAdapter.load(key || saveKey)
}

// Export the persistence interface
export const persistence = {
  serialize,
  hydrate,
  autoSave,
  configure,
  saveState,
  loadState,
  getStats
}

// Export types
export type {CyreConfig, PersistentState}

// Create localStorage adapter factory
export const createLocalStorageAdapter = (): StorageAdapter => ({
  save: async (key: string, state: PersistentState) => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      log.error(`Failed to save state: ${error}`)
    }
  },

  load: async (key: string) => {
    if (typeof localStorage === 'undefined') return null
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      log.error(`Failed to load state: ${error}`)
      return null
    }
  }
})
