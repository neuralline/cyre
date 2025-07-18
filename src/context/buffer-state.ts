// src/context/buffer-state.ts
// Ultra-fast buffer state for temporary storage

interface BufferEntry {
  payload: any
  timestamp: number
}

// Ultra-fast Map-based storage - no strategy complexity
const bufferStore = new Map<string, BufferEntry>()

export const bufferState = {
  // Default set - ultra-fast overwrite
  set: (channelId: string, payload: any): void => {
    bufferStore.set(channelId, {
      payload,
      timestamp: Date.now()
    })
  },

  // Dedicated append method - no conditionals in main path
  append: (channelId: string, payload: any): void => {
    const existing = bufferStore.get(channelId)

    if (existing) {
      // Append to existing
      const newPayload = Array.isArray(existing.payload)
        ? [...existing.payload, payload]
        : [existing.payload, payload]

      bufferStore.set(channelId, {
        payload: newPayload,
        timestamp: Date.now()
      })
    } else {
      // First entry - just store as single item
      bufferStore.set(channelId, {
        payload,
        timestamp: Date.now()
      })
    }
  },

  // Ultra-fast get - direct payload access
  get: (channelId: string): any => {
    return bufferStore.get(channelId) || undefined
  },

  // API aligned with cyre naming convention
  forget: (channelId: string): boolean => {
    return bufferStore.delete(channelId)
  },

  // Clear all buffers
  clear: (): void => {
    bufferStore.clear()
  },

  // Check if buffer exists
  has: (channelId: string): boolean => {
    return bufferStore.has(channelId)
  }
}
