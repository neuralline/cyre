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
      const newPayload = Array.isArray(existing.payload)
        ? [...existing.payload, payload]
        : [existing.payload, payload]
      bufferStore.set(channelId, {payload: newPayload, timestamp: Date.now()})
    } else {
      bufferStore.set(channelId, {payload, timestamp: Date.now()}) // ← bare value, not [payload]
    }
  },

  // Ultra-fast get - direct payload access. Returns the stored PAYLOAD
  // itself, not the {payload, timestamp} entry - the return type used to
  // say BufferEntry, which was misleading (that's what caused a real bug
  // upstream: callers reaching for .payload on what get() already unwraps).
  // Use getTimestamp() below if you need the entry's write time - e.g. to
  // detect whether a new call landed since you last read it.
  get: (channelId: string): any => {
    return bufferStore.get(channelId)?.payload
  },

  // Timestamp of the current entry, if any. Lets a caller detect whether
  // the entry has been overwritten since it last read it, without having
  // to compare payload values (which may legitimately repeat).
  getTimestamp: (channelId: string): number | undefined => {
    return bufferStore.get(channelId)?.timestamp
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
