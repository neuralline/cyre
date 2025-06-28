// src/hooks/use-group.ts
// Beautiful simple channel coordination
// Works with any channel-like objects - doesn't care where they come from!

import type {EventHandler, ActionPayload} from '../types/core'
import type {
  ChannelLike,
  UseGroupConfig,
  GroupedChannel,
  ChannelExecutionResult,
  ExecutionStrategy,
  ErrorStrategy
} from '../types/hooks'
import {sensor} from '../components/sensor'

/**
 * Beautiful simple channel coordination
 * Works with ANY channel-like objects - main cyre, branches, anything!
 */
export function useGroup<TPayload = ActionPayload>(
  channels: ChannelLike<TPayload>[],
  config: UseGroupConfig = {}
): GroupedChannel<TPayload> {
  // Simple configuration with defaults
  const groupId = `group-${crypto.randomUUID().slice(0, 8)}`
  const groupName =
    config.name || `Group[${channels.map(c => c.name || c.id).join(', ')}]`
  const strategy: ExecutionStrategy = config.strategy || 'parallel'
  const errorStrategy: ErrorStrategy = config.errorStrategy || 'continue'
  const timeout = config.timeout || 10000 // 10 second default

  // Simple stats tracking
  let totalExecutions = 0
  let successfulExecutions = 0
  let lastExecutionTime = 0

  // Validate channels
  if (!channels || channels.length === 0) {
    throw new Error('useGroup requires at least one channel')
  }

  // Validate all channels have required methods
  const invalidChannels = channels.filter(
    channel => !channel || typeof channel.call !== 'function' || !channel.id
  )

  if (invalidChannels.length > 0) {
    throw new Error(
      `useGroup: ${invalidChannels.length} invalid channels provided`
    )
  }

  /**
   * Execute single channel with timing and error handling
   */
  async function executeChannel(
    channel: ChannelLike<TPayload>,
    payload: TPayload | undefined,
    executionOrder: number
  ): Promise<ChannelExecutionResult> {
    const startTime = performance.now()

    try {
      // Execute channel - doesn't matter if it's main, branch, or custom!
      const result = await channel.call(payload)
      const executionTime = performance.now() - startTime

      return {
        ...result,
        channelId: channel.id,
        channelName: channel.name || channel.id,
        executionOrder,
        executionTime
      }
    } catch (error) {
      const executionTime = performance.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      sensor.error(groupId, errorMessage, 'channel-execution-error')

      return {
        ok: false,
        payload: null,
        message: `Channel execution failed: ${errorMessage}`,
        error: errorMessage,
        channelId: channel.id,
        channelName: channel.name || channel.id,
        executionOrder,
        executionTime,
        originalError: error
      }
    }
  }

  /**
   * Execute all channels according to strategy
   */
  async function executeChannels(
    payload?: TPayload
  ): Promise<ChannelExecutionResult[]> {
    try {
      totalExecutions++
      const startTime = performance.now()

      let results: ChannelExecutionResult[]

      if (strategy === 'parallel') {
        // Execute all channels in parallel
        const promises = activeChannels.map((channel, index) =>
          executeChannel(channel, payload, index)
        )
        results = await Promise.all(promises)
      } else {
        // Execute channels sequentially
        results = []
        for (let i = 0; i < activeChannels.length; i++) {
          const result = await executeChannel(activeChannels[i], payload, i)
          results.push(result)

          // Stop on first failure if fail-fast strategy
          if (!result.ok && errorStrategy === 'fail-fast') {
            break
          }
        }
      }

      lastExecutionTime = performance.now() - startTime
      successfulExecutions += results.every(r => r.ok) ? 1 : 0

      return results
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      sensor.error(groupId, errorMessage, 'group-execution-error')

      // Return error results for all channels
      return channels.map((channel, index) => ({
        ok: false,
        payload: null,
        message: `Group failed: ${errorMessage}`,
        error: errorMessage,
        channelId: channel.id,
        channelName: channel.name || channel.id,
        executionOrder: index,
        executionTime: 0,
        originalError: error
      }))
    }
  }

  // Keep track of channels for dynamic management
  const activeChannels = [...channels]

  // Build simple grouped channel interface
  const groupedChannel: GroupedChannel<TPayload> = {
    id: groupId,
    name: groupName,
    channels: activeChannels,

    call: async (payload?: TPayload) => {
      try {
        // Apply timeout if specified
        const executeWithTimeout =
          timeout > 0
            ? Promise.race([
                executeChannels(payload),
                new Promise<never>((_, reject) =>
                  setTimeout(
                    () => reject(new Error(`Group timeout after ${timeout}ms`)),
                    timeout
                  )
                )
              ])
            : executeChannels(payload)

        const results = await executeWithTimeout

        // Build summary response
        const successful = results.filter(r => r.ok && !r.skipped)
        const failed = results.filter(r => !r.ok && !r.skipped)
        const skipped = results.filter(r => r.skipped)

        const allSuccessful = failed.length === 0
        const hasPartialSuccess = successful.length > 0 && failed.length > 0

        let message: string
        if (allSuccessful) {
          message = `All ${successful.length} channels executed successfully`
        } else if (hasPartialSuccess) {
          message = `${successful.length}/${activeChannels.length} channels succeeded`
          if (skipped.length > 0) message += `, ${skipped.length} skipped`
        } else {
          message = `All ${failed.length} channels failed`
        }

        const isSuccess =
          allSuccessful || (hasPartialSuccess && errorStrategy !== 'fail-fast')

        return {
          ok: isSuccess,
          payload: results, // Return all individual results
          message,
          metadata: {
            source: 'useGroup',
            groupId,
            strategy,
            errorStrategy,
            channelCount: activeChannels.length,
            successful: successful.length,
            failed: failed.length,
            skipped: skipped.length,
            executionTime: results.reduce((sum, r) => sum + r.executionTime, 0)
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(groupId, errorMessage, 'group-call-error')

        return {
          ok: false,
          payload: null,
          message: `Group call failed: ${errorMessage}`,
          error: errorMessage
        }
      }
    },

    on: (handler: EventHandler) => {
      // Subscribe to all channels that support subscriptions
      const subscriptions = activeChannels
        .filter(channel => channel.on)
        .map(channel => {
          try {
            return channel.on!(handler)
          } catch (error) {
            sensor.error(groupId, String(error), 'group-subscription-error')
            return {
              ok: false,
              message: `Subscription failed for ${channel.id}`,
              unsubscribe: () => false
            }
          }
        })

      const successful = subscriptions.filter(sub => sub.ok)

      return {
        ok: successful.length > 0,
        message: `Subscribed to ${successful.length}/${subscriptions.length} channels`,
        unsubscribe: () => {
          const unsubscribeResults = subscriptions.map(sub =>
            sub.unsubscribe ? sub.unsubscribe() : false
          )
          const successfulUnsubscribes =
            unsubscribeResults.filter(Boolean).length

          return successfulUnsubscribes > 0
        }
      }
    },

    add: (channel: ChannelLike<TPayload>) => {
      if (!channel || typeof channel.call !== 'function' || !channel.id) {
        throw new Error('Invalid channel provided to group')
      }

      activeChannels.push(channel)
    },

    forget: (channelId: string) => {
      const index = activeChannels.findIndex(c => c.id === channelId)
      if (index !== -1) {
        activeChannels.splice(index, 1)

        return true
      }
      return false
    },

    getStats: () => ({
      channelCount: activeChannels.length,
      lastExecutionTime,
      totalExecutions,
      successRate:
        totalExecutions > 0 ? successfulExecutions / totalExecutions : 0
    })
  }

  return groupedChannel
}

// Export types
export type {
  ChannelLike,
  UseGroupConfig,
  GroupedChannel,
  ChannelExecutionResult,
  ExecutionStrategy,
  ErrorStrategy
}
