// src/context/history-state.ts

import {createStore} from './create-store'
import type {ActionPayload, IO, StateKey} from '../types/interface'

export interface HistoryEntry {
  actionId: string
  timestamp: number
  payload: ActionPayload
  result: {
    ok: boolean
    message?: string
    error?: string
  }
  duration?: number
}

// Configure history size limits
const MAX_HISTORY_ENTRIES = 200
const MAX_HISTORY_PER_ACTION = 20

// Create history store
const historyStore = createStore<HistoryEntry[]>()

export const historyState = {
  /**
   * Record a new history entry
   */
  record: (
    actionId: string,
    payload: ActionPayload,
    result: {ok: boolean; message?: string; error?: string},
    duration?: number
  ): void => {
    const entry: HistoryEntry = {
      actionId,
      timestamp: Date.now(),
      payload,
      result,
      duration
    }

    // Get existing history for this action
    const actionHistory = historyStore.get(actionId) || []

    // Add new entry and trim if needed
    const updatedHistory = [entry, ...actionHistory].slice(
      0,
      MAX_HISTORY_PER_ACTION
    )

    // Store updated history
    historyStore.set(actionId, updatedHistory)
  },

  /**
   * Get history for a specific action
   */
  getChannel: (actionId: string): HistoryEntry[] => {
    return historyStore.get(actionId) || []
  },

  /**
   * Get all history entries across actions
   */
  getAll: (): HistoryEntry[] => {
    const allEntries: HistoryEntry[] = []
    historyStore.getAll().forEach(entries => {
      allEntries.push(...entries)
    })

    // Sort by timestamp (newest first) and limit total entries
    return allEntries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_HISTORY_ENTRIES)
  },

  /**
   * Clear history for a specific action
   */
  clearChannel: (actionId: string): boolean => {
    return historyStore.forget(actionId)
  },

  /**
   * Clear all history
   */
  clearAll: (): void => {
    historyStore.clear()
  },

  /**
   * Get statistics for an action
   */
  getStats: (
    actionId: string
  ): {
    totalCalls: number
    successRate: number
    averageDuration?: number
    lastCall?: HistoryEntry
  } => {
    const history = historyStore.get(actionId) || []
    if (history.length === 0) {
      return {totalCalls: 0, successRate: 0}
    }

    const successfulCalls = history.filter(entry => entry.result.ok).length
    const durationsAvailable = history.filter(
      entry => typeof entry.duration === 'number'
    ).length
    const totalDuration = history.reduce(
      (sum, entry) => sum + (entry.duration || 0),
      0
    )

    return {
      totalCalls: history.length,
      successRate: successfulCalls / history.length,
      averageDuration: durationsAvailable
        ? totalDuration / durationsAvailable
        : undefined,
      lastCall: history[0]
    }
  }
}
