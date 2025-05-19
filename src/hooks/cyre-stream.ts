// src/hooks/cyre-stream.ts

import {cyre} from '../app'
import type {ActionPayload} from '../interfaces/interface'

export const createStream = <T = ActionPayload>(channelId: string) => {
  // Map operator transforms values
  const map = <R>(fn: (value: T) => R) => {
    const mappedId = `${channelId}-map-${crypto.randomUUID().slice(0, 8)}`

    cyre.on(channelId, (payload: T) => {
      return {
        id: mappedId,
        payload: fn(payload as T)
      }
    })

    return createStream<R>(mappedId)
  }

  // Filter operator passes only values matching predicate
  const filter = (predicate: (value: T) => boolean) => {
    const filteredId = `${channelId}-filter-${crypto.randomUUID().slice(0, 8)}`

    cyre.on(channelId, (payload: T) => {
      if (predicate(payload as T)) {
        return {
          id: filteredId,
          payload
        }
      }
      // No return means no chain execution
    })

    return createStream<T>(filteredId)
  }

  // Subscribe to the stream output
  const subscribe = (handler: (value: T) => void) => {
    return cyre.on(channelId, handler)
  }

  // Push values into the stream
  const next = (value: T) => {
    return cyre.call(channelId, value)
  }

  return {
    map,
    filter,
    subscribe,
    next,
    id: channelId
  }
}
