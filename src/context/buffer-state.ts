// src/context/buffer-state.ts
// Ultra-fast buffer state management

interface BufferEntry {
  payload: any
  timestamp: number
  strategy: 'overwrite' | 'append' | 'ignore'
}

interface BufferState {
  [channelId: string]: BufferEntry
}

// Simple Map-based storage (no circular buffers, no history, no metrics)
const bufferStore = new Map<string, BufferEntry>()

export const bufferState = {
  // Ultra-fast set - just store payload
  set: (
    channelId: string,
    payload: any,
    strategy: 'overwrite' | 'append' | 'ignore' = 'overwrite'
  ): void => {
    bufferStore.set(channelId, {
      payload,
      timestamp: Date.now(),
      strategy
    })
  },

  // Ultra-fast get
  get: (channelId: string): any => {
    return bufferStore.get(channelId)?.payload
  },

  // Ultra-fast clear
  clear: (channelId: string): void => {
    bufferStore.delete(channelId)
  },

  // Get all buffered channels
  getAll: (): string[] => {
    return Array.from(bufferStore.keys())
  },

  // Clear all
  clearAll: (): void => {
    bufferStore.clear()
  }
}
