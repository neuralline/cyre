// src/context/create-store.ts
// Ultra-fast, minimal store implementation

import {StateKey} from '../types/core'

export interface StateStore<T> {
  get: (key: StateKey) => T | undefined
  set: (key: StateKey, value: T) => void
  forget: (key: StateKey) => boolean
  clear: () => void
  getAll: () => T[]
  size: () => number
}

// Ultra-fast store - direct Map property access
export const createStore = <T>(): StateStore<T> => {
  const store = new Map<StateKey, T>()

  return {
    // Direct property access for maximum speed
    get: store.get.bind(store),
    set: store.set.bind(store),
    forget: store.delete.bind(store),
    clear: store.clear.bind(store),
    getAll: () => Array.from(store.values()),
    size: () => store.size
  }
}
