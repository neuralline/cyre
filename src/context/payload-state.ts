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
  // The req value that was current immediately before the latest setReq()
  // call overwrote it - a single slot of history, not a full log, which is
  // all getPrevious() below needs. Previously getPrevious() was a stub that
  // always returned undefined ("we don't store history - could be added
  // later"); this is that one slot.
  prevReq?: ActionPayload
  // Additional previous request payloads beyond prevReq, newest first,
  // only populated when a channel's `history` config is above 1 (see
  // setReq's historyLimit param). prevReq alone covers the default
  // history: 1 case, so this stays undefined for every channel that
  // hasn't opted into a longer history.
  history?: ActionPayload[]
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
    correlationId?: string,
    // Matches a channel's resolved `_history` (compile-pipeline.ts,
    // default 1). historyLimit <= 1 keeps today's behaviour exactly -
    // prevReq alone, no `history` array - so this is a strict addition,
    // not a shape change, for every channel that doesn't opt in.
    historyLimit = 1
  ): void => {
    const currentTime = Date.now()
    const existing = payloadStore.get(channelId)

    // historyLimit: 0 (action.history: 0) genuinely turns previous-payload
    // tracking off, not just the extra `history` array below it - so
    // prevReq itself is gated on it too, rather than being kept
    // unconditionally the way it always was pre-history/keepPayload.
    const prevReq = historyLimit >= 1 ? existing?.req : undefined

    let history: ActionPayload[] | undefined
    if (historyLimit > 1 && existing?.req !== undefined) {
      const prior = existing.history ?? []
      history = [existing.req, ...prior].slice(0, historyLimit)
    }

    const updated: ChannelPayload = {
      req: payload,
      // Whatever req held before this call becomes the new "previous" -
      // shifted here, once, right before it's overwritten, rather than
      // tracked as a growing history the caller has to prune.
      prevReq,
      history,
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
   * Metadata-only request bump for keepPayload: false channels - counts
   * the call and marks status pending without keeping a reference to the
   * payload itself. The whole point of keepPayload: false is that a large
   * one-off payload never gets copied into payload-state, so unlike
   * setReq() above this takes no payload argument at all.
   */
  touchReq: (channelId: string, correlationId?: string): void => {
    const currentTime = Date.now()
    const existing = payloadStore.get(channelId)

    const updated: ChannelPayload = {
      req: undefined,
      prevReq: undefined,
      history: undefined,
      res: existing?.res,
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
      prevReq: existing.prevReq,
      history: existing.history,
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
   * Metadata-only response bump for keepPayload: false channels - keeps
   * the response's ok/message/error/metadata (small, and genuinely useful
   * for cyre.get()) but drops response.payload itself, which is the part
   * that can be as large as the request that produced it.
   */
  touchRes: (
    channelId: string,
    response: CyreResponse,
    correlationId?: string
  ): void => {
    const currentTime = Date.now()
    const existing = payloadStore.get(channelId)

    if (!existing) {
      sensor.warn(`Setting response for channel ${channelId} without request`)
      return
    }

    const updated: ChannelPayload = {
      req: undefined,
      prevReq: undefined,
      history: undefined,
      res: {...response, payload: undefined},
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
   * Get previous request payload (for change detection) - the req value
   * that was current immediately before the most recent one, tracked as a
   * single slot in setReq() above. Returns undefined if the channel has
   * received fewer than two requests (there's no "previous" yet).
   */
  getPrevious: (channelId: string): ActionPayload | undefined => {
    return payloadStore.get(channelId)?.prevReq
  },

  /**
   * Get previous request payloads beyond just the last one, newest first,
   * for a channel registered with `history` above the default 1. Falls
   * back to a single-item array built from prevReq for every channel that
   * hasn't opted in, so callers don't need to branch on which field a
   * given channel happens to populate. Empty array for a channel with no
   * previous request yet, or with keepPayload: false.
   */
  getHistory: (channelId: string): ActionPayload[] => {
    const entry = payloadStore.get(channelId)
    if (!entry) return []
    if (entry.history) return entry.history
    return entry.prevReq !== undefined ? [entry.prevReq] : []
  },

  /**
   * Clear a channel's stored payload state and put it back to the clean
   * slate a freshly-registered channel starts from, without touching the
   * channel's IO config, its subscribers, or any in-flight debounce/
   * buffer window (those live in context/buffer-state.ts and context/
   * pending-state.ts - separate stores, untouched here). This is the
   * "clear this channel's payload, keep the channel" operation forget()
   * doesn't have on its own - forget() only ever removes payload state as
   * a side effect of removing the whole channel (see context/state.ts's
   * io.forget()).
   *
   * Drops req/res/prevReq/history and every counter. With no
   * `defaultPayload`, the channel goes back to genuinely never-called -
   * no entry at all, same as a fresh channel with no configured
   * `payload` (cyre.get() returns undefined, matching registration's own
   * behaviour of only ever writing an entry when a default is given).
   * Pass `defaultPayload` to reseed req the way registration does for a
   * channel that was given a `payload` in its config - the caller
   * (app.ts's resetPayload()) is what decides whether that default
   * applies, since a keepPayload: false channel should stay unseeded
   * even though its action config still carries a `payload` value.
   */
  reset: (channelId: string, defaultPayload?: ActionPayload): void => {
    if (defaultPayload === undefined) {
      payloadStore.forget(channelId)
      return
    }

    payloadStore.set(channelId, {
      req: defaultPayload,
      prevReq: undefined,
      history: undefined,
      res: undefined,
      metadata: {
        lastRequestTime: Date.now(),
        requestCount: 1,
        responseCount: 0,
        status: 'idle'
      }
    })
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
