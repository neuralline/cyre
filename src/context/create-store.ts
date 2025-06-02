// src/context/create-store.ts

import {StateKey} from '../types/core'

export interface StateStore<T> {
  get: (key: StateKey) => T | undefined
  set: (key: StateKey, value: T) => void
  forget: (key: StateKey) => boolean
  clear: () => void
  getAll: () => T[]
  size: () => number
}

// Move createStore to a separate utility file to avoid circular dependencies
export const createStore = <T>(): StateStore<T> => {
  const store = new Map<StateKey, T>()
  const maxHistorySize = 1000

  const cleanup = () => {
    if (store.size > maxHistorySize) {
      const entriesToDelete = Array.from(store.keys()).slice(
        0,
        store.size - maxHistorySize
      )
      entriesToDelete.forEach(key => store.delete(key))
    }
  }

  return {
    get: key => store.get(key),
    set: (key, value) => {
      store.set(key, value)
      cleanup()
    },
    forget: key => store.delete(key),
    clear: () => store.clear(),
    getAll: () => Array.from(store.values()),
    size: () => store.size
  }
}
