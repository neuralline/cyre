// src/context/group-state.ts - New file
import {ChannelGroup} from '../types/core'
import {createStore} from './create-store'
import {io} from './state'

const groupStore = createStore<ChannelGroup>()

export const groups = {
  create: (config: {
    id: string
    channels: string[]
    shared?: any
    coordination?: any
  }) => {
    const group: ChannelGroup = {
      id: config.id,
      channels: new Set(config.channels),
      shared: config.shared || {},
      coordination: config.coordination || {}
    }

    groupStore.set(config.id, group)

    // Apply shared config to channels
    group.channels.forEach(channelId => {
      const channel = io.get(channelId)
      if (channel && group.shared) {
        Object.assign(channel, group.shared)
        io.set(channel)
      }
    })
  },

  get: (id: string) => groupStore.get(id),
  getForChannel: (channelId: string) =>
    groupStore.getAll().find(g => g.channels.has(channelId))
}
