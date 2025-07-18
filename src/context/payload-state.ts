// src/context/payload-state.ts
// Updated payload state system with req/res separation

import type {ActionPayload, CyreResponse} from '../types/core'
import {createStore} from './create-store'
import {sensor} from '../components/sensor'

/*
      C.Y.R.E. - P.A.Y.L.O.A.D. - S.T.A.T.E
      
      Payload management with req/res separation:
      - Request payload saved just before dispatch (execution certain)
      - Response payload saved after execution complete
      - Users can poll but not mutate directly
      - Clean separation from buffer state (temporary storage)
*/

export interface ChannelPayload {
  req?: ActionPayload
  res?: CyreResponse
  metadata: {
    lastRequestTime?: number
    lastResponseTime?: number
    requestCount: number
    responseCount: number
    correlationId?: string
    status: 'idle' | 'pending' | 'completed' | 'failed'
  }
}

// Create payload store
const payloadStore = createStore<ChannelPayload>()

/**
 * Core payload state operations - internal use only
 */
export const payloadState = {
  /**
   * Set request payload - called just before dispatch when execution is certain
   */
  setReq: (
    channelId: string,
    payload: ActionPayload,
    correlationId?: string
  ): void => {
    const currentTime = Date.now()
    const existing = payloadStore.get(channelId)

    const updated: ChannelPayload = {
      req: payload,
      res: existing?.res, // Keep existing response
      metadata: {
        lastRequestTime: currentTime,
        lastResponseTime: existing?.metadata.lastResponseTime,
        requestCount: (existing?.metadata.requestCount || 0) + 1,
        responseCount: existing?.metadata.responseCount || 0,
        correlationId,
        status: 'pending'
      }
    }

    payloadStore.set(channelId, updated)
  },

  /**
   * Set response payload - called after execution complete
   */
  setRes: (
    channelId: string,
    response: CyreResponse,
    correlationId?: string
  ): void => {
    const currentTime = Date.now()
    const existing = payloadStore.get(channelId)

    if (!existing) {
      // No request found - this shouldn't happen in normal flow
      sensor.warn(`Setting response for channel ${channelId} without request`)
      return
    }

    const updated: ChannelPayload = {
      req: existing.req,
      res: response,
      metadata: {
        ...existing.metadata,
        lastResponseTime: currentTime,
        responseCount: existing.metadata.responseCount + 1,
        correlationId,
        status: response.ok ? 'completed' : 'failed'
      }
    }

    payloadStore.set(channelId, updated)
  },

  /**
   * Get channel payload - returns {req, res, metadata}
   */
  get: (channelId: string): ChannelPayload | undefined => {
    return payloadStore.get(channelId)
  },

  /**
   * Get request payload only
   */
  getReq: (channelId: string): ActionPayload | undefined => {
    return payloadStore.get(channelId)?.req
  },

  /**
   * Get response payload only
   */
  getRes: (channelId: string): CyreResponse | undefined => {
    return payloadStore.get(channelId)?.res
  },

  /**
   * Check if payload has changed compared to new value
   */
  hasChanged: (channelId: string, newPayload: ActionPayload): boolean => {
    const current = payloadStore.get(channelId)?.req
    return !fastEquals(current, newPayload)
  },

  /**
   * Get previous request payload (for change detection)
   */
  getPrevious: (channelId: string): ActionPayload | undefined => {
    // For now, we don't store history - could be added later
    return undefined
  },

  /**
   * Initialize channel payload entry
   */
  initialize: (channelId: string, initialPayload?: ActionPayload): void => {
    if (!payloadStore.get(channelId)) {
      const entry: ChannelPayload = {
        req: initialPayload,
        res: undefined,
        metadata: {
          requestCount: initialPayload ? 1 : 0,
          responseCount: 0,
          status: 'idle'
        }
      }
      payloadStore.set(channelId, entry)
    }
  },

  /**
   * Remove payload for channel
   */
  forget: (channelId: string): boolean => {
    return payloadStore.forget(channelId)
  },

  /**
   * Clear all payloads
   */
  clear: (): void => {
    payloadStore.clear()
  },

  /**
   * Get payload statistics
   */
  getStats: () => {
    const entries = payloadStore.getAll()
    return {
      totalChannels: entries.length,
      totalRequests: entries.reduce(
        (sum, entry) => sum + entry.metadata.requestCount,
        0
      ),
      totalResponses: entries.reduce(
        (sum, entry) => sum + entry.metadata.responseCount,
        0
      ),
      pendingChannels: entries.filter(
        entry => entry.metadata.status === 'pending'
      ).length,
      completedChannels: entries.filter(
        entry => entry.metadata.status === 'completed'
      ).length,
      failedChannels: entries.filter(
        entry => entry.metadata.status === 'failed'
      ).length
    }
  }
}

// Fast shallow equality check for payload comparison
const fastEquals = (a: any, b: any): boolean => {
  if (a === b) return true
  if (!a || !b) return false

  const typeA = typeof a
  const typeB = typeof b
  if (typeA !== typeB) return false
  if (typeA !== 'object') return a === b

  // Fast path for arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  // Shallow object comparison
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (a[key] !== b[key]) return false
  }
  return true
}

export default payloadState
