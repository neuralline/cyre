// src/hooks/cyre-compos.ts

import type {
  EventHandler,
  ActionPayload,
  CyreResponse
} from '../interfaces/interface'
import type {CyreChannel} from '../interfaces/hooks'

/**
 * Options for composed channels
 */
export interface CompositionOptions {
  /** Custom ID for composed channels */
  id?: string
  /** Whether to continue on error */
  continueOnError?: boolean
}

/**
 * Create a composed channel from multiple channels
 */
export function cyreCompose<TPayload = ActionPayload>(
  channels: CyreChannel<TPayload>[],
  options?: CompositionOptions
) {
  const composedId = options?.id || `composed-${crypto.randomUUID()}`

  return {
    id: composedId,

    // Call all channels in sequence
    call: async (payload?: TPayload): Promise<CyreResponse[]> => {
      const results: CyreResponse[] = []

      for (const channel of channels) {
        try {
          const result = await channel.call(payload)
          results.push(result)

          // Stop chain on first error unless options specify otherwise
          if (!result.ok && !options?.continueOnError) {
            break
          }
        } catch (error) {
          results.push({
            ok: false,
            payload: null,
            message: error instanceof Error ? error.message : String(error)
          })

          if (!options?.continueOnError) {
            break
          }
        }
      }

      return results
    },

    // Subscribe to all channels
    on: (handler: EventHandler): {unsubscribe: () => void} => {
      const subscriptions = channels.map(channel => channel.on(handler))

      return {
        unsubscribe: () => {
          subscriptions.forEach(sub => {
            if ('unsubscribe' in sub) {
              sub.unsubscribe()
            }
          })
        }
      }
    },

    // Pause all channels
    pause: () => channels.forEach(channel => channel.pause()),

    // Resume all channels
    resume: () => channels.forEach(channel => channel.resume()),

    // Forget all channels
    forget: () => channels.map(channel => channel.forget()).every(Boolean),

    // Get all channel IDs
    getChannelIds: () => channels.map(channel => channel.id)
  }
}
