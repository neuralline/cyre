// src/context/payload-state.ts
// Payload state management with functional performance optimizations

import type {
  ActionPayload,
  CyreResponse,
  ChannelPayloads,
  RequestResponsePair
} from '../types/core'
import {createStore} from './create-store'
import {sensor} from '../components/sensor'
import {PAYLOAD_CONFIG} from '../config/cyre-config'

/*
      C.Y.R.E. - P.A.Y.L.O.A.D. - S.T.A.T.E
      
      Enhanced dual payload management:
      - Request payloads (input to channels)
      - Response payloads (output from channels)
      - Circular buffer history for performance
      - Fast equality checks for common patterns
      - Deferred logging to avoid blocking call path
      - Memory-efficient operations with pooling
      - 100% functional - no classes or OOP
      - Request-response correlation tracking
*/

export interface PayloadHistoryEntry {
  payload: ActionPayload | CyreResponse
  timestamp: number
  source: 'initial' | 'call' | 'pipeline' | 'external'
  changeType: 'initial' | 'set' | 'merge' | 'transform'
  direction: 'request' | 'response'
  correlationId?: string
}

export interface PayloadMetadata {
  lastUpdated: number
  updateCount: number
  source: 'initial' | 'call' | 'pipeline' | 'external'
  frozen: boolean
  // NEW: Response tracking
  lastResponseTime?: number
  responseCount: number
  averageResponseTime?: number
  lastError?: string
  status: 'idle' | 'pending' | 'completed' | 'failed'
}

export interface PayloadEntry {
  current: ActionPayload
  previous?: ActionPayload
  history: PayloadHistoryEntry[] | CircularHistory
  metadata: PayloadMetadata
  // NEW: Response payload support
  response?: CyreResponse
  responseHistory?: RequestResponsePair[]
}

// Functional circular buffer implementation
interface CircularHistory {
  buffer: PayloadHistoryEntry[]
  head: number
  size: number
  capacity: number
  add: (entry: PayloadHistoryEntry) => void
  toArray: () => PayloadHistoryEntry[]
  length: number
}

// Factory function for circular history buffer
const createCircularHistory = (
  capacity: number = PAYLOAD_CONFIG.MAX_HISTORY_PER_CHANNEL
): CircularHistory => {
  const buffer: PayloadHistoryEntry[] = new Array(capacity)
  let head = 0
  let size = 0

  const add = (entry: PayloadHistoryEntry): void => {
    buffer[head] = entry
    head = (head + 1) % capacity
    if (size < capacity) {
      size++
    }
  }

  const toArray = (): PayloadHistoryEntry[] => {
    if (size === 0) return []

    const result = new Array(size)
    let bufferIndex = size === capacity ? head : 0

    for (let i = 0; i < size; i++) {
      result[i] = buffer[bufferIndex]
      bufferIndex = (bufferIndex + 1) % capacity
    }

    return result
  }

  return {
    buffer,
    head,
    size,
    capacity,
    add,
    toArray,
    get length() {
      return size
    }
  }
}

// Pre-compute timestamp once per batch/tick for better performance
let currentTimestamp = Date.now()
let timestampUpdateId: NodeJS.Timeout | number | null = null

const updateTimestamp = (): void => {
  currentTimestamp = Date.now()
}

// Update timestamp every 16ms (60fps) or on-demand
const ensureTimestamp = (): void => {
  if (!timestampUpdateId) {
    timestampUpdateId = setInterval(updateTimestamp, 16)
  }
}

// Fast shallow equality check for common payload types
const fastEquals = (a: any, b: any): boolean => {
  if (a === b) return true
  if (!a || !b) return false

  // Fast path for primitives and same reference
  const typeA = typeof a
  const typeB = typeof b
  if (typeA !== typeB) return false
  if (typeA !== 'object') return a === b

  // Fast path for arrays of primitives
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  // For objects, use shallow comparison first
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (a[key] !== b[key]) return false
  }
  return true
}

// Pool of reusable history buffers to reduce GC pressure
const historyBufferPool: CircularHistory[] = []

const getHistoryBuffer = (): CircularHistory => {
  return historyBufferPool.pop() || createCircularHistory()
}

const returnHistoryBuffer = (buffer: CircularHistory): void => {
  if (historyBufferPool.length < 10) {
    // Keep pool small
    historyBufferPool.push(buffer)
  }
}

// Helper to check if object is CircularHistory
const isCircularHistory = (obj: any): obj is CircularHistory => {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.add === 'function' &&
    typeof obj.toArray === 'function'
  )
}

// Create payload store
const payloadStore = createStore<PayloadEntry>()

/**
 * Core payload state operations
 */
export const payloadState = {
  /**
   * Set payload for channel - OPTIMIZED FOR CALL PROCESS SPEED
   */
  set: (
    channelId: string,
    payload: ActionPayload,
    source: 'initial' | 'call' | 'pipeline' | 'external' = 'call'
  ): void => {
    // Early timestamp update only when needed
    ensureTimestamp()

    const existing = payloadStore.get(channelId)

    // Fast path: Check if frozen first (most common early exit)
    if (existing?.metadata.frozen) {
      // Defer expensive logging to avoid blocking call path
      process.nextTick(() => {
        sensor.warn(`Payload for ${channelId} is frozen - update blocked`)
        sensor.warn(channelId, 'blocked', 'payload-frozen')
      })
      return
    }

    // Fast equality check - avoid expensive deep comparison
    const hasChanged = !existing || !fastEquals(payload, existing.current)

    // Skip update if no actual change and not initial
    if (!hasChanged && source !== 'initial') {
      return
    }

    try {
      let historyBuffer: CircularHistory

      if (existing) {
        // Reuse existing buffer if it's already a CircularHistory
        historyBuffer = isCircularHistory(existing.history)
          ? existing.history
          : getHistoryBuffer()

        // Convert legacy array history to buffer if needed
        if (Array.isArray(existing.history)) {
          existing.history.forEach(entry => historyBuffer.add(entry))
        }
      } else {
        historyBuffer = getHistoryBuffer()
      }

      // Create history entry only if there's a previous value
      if (existing?.current !== undefined) {
        const historyEntry: PayloadHistoryEntry = {
          payload: existing.current,
          timestamp: currentTimestamp,
          source,
          changeType: 'set',
          direction: 'request'
        }
        historyBuffer.add(historyEntry)
      }

      // Create new entry with minimal object creation
      const updateCount = (existing?.metadata.updateCount || 0) + 1
      const entry: PayloadEntry = {
        current: payload,
        previous: existing?.current,
        history: historyBuffer,
        metadata: {
          lastUpdated: currentTimestamp,
          updateCount,
          source,
          frozen: false,
          responseCount: existing?.metadata.responseCount || 0,
          status: 'idle'
        }
      }

      payloadStore.set(channelId, entry)

      // Defer expensive logging operations to next tick to avoid blocking
      if (hasChanged) {
        process.nextTick(() => {})
      }
    } catch (error) {
      // Defer error logging to avoid blocking call path
      process.nextTick(() => {
        sensor.error(`Failed to set payload for ${channelId}: ${error}`)
        sensor.error(channelId, String(error), 'payload-set')
      })
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
   * Set response payload for channel
   */
  setResponse: (
    channelId: string,
    response: CyreResponse,
    correlationId?: string
  ): void => {
    ensureTimestamp()

    const existing = payloadStore.get(channelId)
    if (!existing) {
      sensor.warn(`Cannot set response for non-existent channel: ${channelId}`)
      return
    }

    try {
      // Update metadata
      const responseCount = (existing.metadata.responseCount || 0) + 1
      const lastResponseTime = currentTimestamp
      const executionTime = response.metadata?.executionTime || 0

      // Calculate average response time
      const currentAvg = existing.metadata.averageResponseTime || 0
      const newAvg =
        currentAvg === 0
          ? executionTime
          : (currentAvg * (responseCount - 1) + executionTime) / responseCount

      // Update status based on response
      const status = response.ok ? 'completed' : 'failed'
      const lastError = response.ok ? undefined : response.message

      // Add to history
      if (isCircularHistory(existing.history)) {
        const historyEntry: PayloadHistoryEntry = {
          payload: response,
          timestamp: currentTimestamp,
          source: 'call',
          changeType: 'set',
          direction: 'response',
          correlationId
        }
        existing.history.add(historyEntry)
      }

      // Update entry
      const updatedEntry: PayloadEntry = {
        ...existing,
        response,
        metadata: {
          ...existing.metadata,
          lastResponseTime,
          responseCount,
          averageResponseTime: newAvg,
          lastError,
          status
        }
      }

      payloadStore.set(channelId, updatedEntry)

      // // Defer logging
      // process.nextTick(() => {
      //   sensor.debug(`Response set for ${channelId}: ${status}`)
      // })
    } catch (error) {
      process.nextTick(() => {
        sensor.error(`Failed to set response for ${channelId}: ${error}`)
        sensor.error(channelId, String(error), 'payload-response-set')
      })
    }
  },

  /**
   * Get current response for channel
   */
  getResponse: (channelId: string): CyreResponse | undefined => {
    return payloadStore.get(channelId)?.response
  },

  /**
   * Get channel payloads (both request and response)
   */
  getPayloads: (channelId: string): ChannelPayloads | undefined => {
    const entry = payloadStore.get(channelId)
    if (!entry) return undefined

    return {
      request: entry.current,
      response: entry.response,
      metadata: {
        lastRequestTime: entry.metadata.lastUpdated,
        lastResponseTime: entry.metadata.lastResponseTime,
        requestCount: entry.metadata.updateCount,
        responseCount: entry.metadata.responseCount,
        averageResponseTime: entry.metadata.averageResponseTime,
        lastError: entry.metadata.lastError,
        status: entry.metadata.status
      }
    }
  },

  /**
   * Check if payload has changed compared to new value
   */
  hasChanged: (channelId: string, newPayload: ActionPayload): boolean => {
    const current = payloadStore.get(channelId)?.current
    return !fastEquals(current, newPayload)
  },

  /**
   * Get payload history with circular buffer support
   */
  getHistory: (channelId: string, limit?: number): PayloadHistoryEntry[] => {
    const entry = payloadStore.get(channelId)
    if (!entry) return []

    if (isCircularHistory(entry.history)) {
      const history = entry.history.toArray()
      return limit ? history.slice(-limit) : history
    }

    // Legacy array support
    const history = Array.isArray(entry.history) ? entry.history : []
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

      return transformed
    } catch (error) {
      sensor.error(`Payload transform failed for ${channelId}: ${error}`)
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

      return merged
    } catch (error) {
      sensor.error(`Payload merge failed for ${channelId}: ${error}`)
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

      return true
    } catch (error) {
      sensor.error(`Failed to freeze payload for ${channelId}: ${error}`)
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

      return true
    } catch (error) {
      sensor.error(`Failed to unfreeze payload for ${channelId}: ${error}`)
      return false
    }
  },

  /**
   * Remove payload for channel
   */
  forget: (channelId: string): boolean => {
    const entry = payloadStore.get(channelId)
    if (entry && isCircularHistory(entry.history)) {
      returnHistoryBuffer(entry.history)
    }
    return payloadStore.forget(channelId)
  },

  /**
   * Clear all payloads
   */
  clear: (): void => {
    // Return all history buffers to pool before clearing
    payloadStore.getAll().forEach(entry => {
      if (isCircularHistory(entry.history)) {
        returnHistoryBuffer(entry.history)
      }
    })
    payloadStore.clear()
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
      (sum, entry) =>
        isCircularHistory(entry.history)
          ? entry.history.length
          : entry.history.length,
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
      },
      bufferPoolSize: historyBufferPool.length
    }
  },

  /**
   * Cleanup function for buffer pool management
   */
  cleanup: (): void => {
    if (timestampUpdateId) {
      clearInterval(timestampUpdateId as NodeJS.Timeout)
      timestampUpdateId = null
    }
    historyBufferPool.length = 0
  }
}

// Export default for compatibility
export default payloadState
