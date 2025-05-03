// src/libs/create-cyre-channel.ts

import {cyre} from '../app'
import type {
  IO,
  EventHandler,
  ActionPayload,
  SubscriptionResponse,
  CyreResponse
} from '../interfaces/interface'

type ChannelConfig = Omit<IO, 'id'>

const createCyreChannel = (prefix = 'channel') => {
  const channelId = `${prefix}-${crypto.randomUUID()}`

  const channel = {
    id: channelId,

    action: (config: ChannelConfig): void => {
      cyre.action({
        ...config,
        id: channelId
      })
    },

    on: (handler: EventHandler): SubscriptionResponse => {
      return cyre.on(channelId, handler)
    },

    call: (payload?: ActionPayload): Promise<CyreResponse> => {
      return cyre.call(channelId, payload)
    },

    get: (): IO | undefined => {
      return cyre.get(channelId)
    },

    forget: (): boolean => {
      return cyre.forget(channelId)
    },

    pause: (): void => {
      cyre.pause(channelId)
    },

    resume: (): void => {
      cyre.resume(channelId)
    },

    hasChanged: (payload: ActionPayload): boolean => {
      return cyre.hasChanged(channelId, payload)
    },

    getPrevious: (): ActionPayload | undefined => {
      return cyre.getPreviousPayload(channelId)
    },

    metrics: () => {
      return cyre.getMetrics(channelId)
    }
  }

  return channel
}

export type Channel = ReturnType<typeof createCyreChannel>
export {createCyreChannel}
