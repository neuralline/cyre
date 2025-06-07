// src/hooks/use-group.ts
// Beautiful simple channel coordination (renamed from useCompose)
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
import {sensor} from '../metrics'

/**
 * Beautiful simple channel coordination (renamed from useCompose)
 * Works with ANY channel-like objects - main cyre, branches, anything!
 */
export function useGroup<TPayload = ActionPayload>(
  channels: ChannelLike<TPayload>[],
  config: UseComposeConfig = {}
): ComposedChannel<TPayload> {
  // Simple configuration with defaults
  const compositionId = `compose-${crypto.randomUUID().slice(0, 8)}`
  const compositionName =
    config.name ||
    `Composition[${channels.map(c => c.name || c.id).join(', ')}]`
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

  sensor.log(compositionId, 'success', 'use-group-created', {
    compositionName,
    channelCount: channels.length,
    channelIds: channels.map(c => c.id),
    strategy,
    errorStrategy
  })

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
      sensor.log(compositionId, 'call', 'channel-execution-start', {
        channelId: channel.id,
        executionOrder,
        strategy
      })

      // Execute channel - doesn't matter if it's main, branch, or custom!
      const result = await channel.call(payload)
      const executionTime = performance.now() - startTime

      sensor.log(
        compositionId,
        result.ok ? 'success' : 'error',
        'channel-execution-complete',
        {
          channelId: channel.id,
          executionOrder,
          executionTime,
          success: result.ok
        }
      )

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

      sensor.error(compositionId, errorMessage, 'channel-execution-error', {
        channelId: channel.id,
        executionOrder,
        executionTime
      })

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
    const compositionStart = performance.now()

    sensor.log(compositionId, 'call', 'composition-execution-start', {
      strategy,
      channelCount: channels.length,
      hasPayload: payload !== undefined
    })

    try {
      let results: ChannelExecutionResult[]

      if (strategy === 'sequential') {
        // Sequential: execute one by one
        results = []

        for (let i = 0; i < channels.length; i++) {
          const result = await executeChannel(channels[i], payload, i)
          results.push(result)

          // Handle fail-fast for sequential
          if (errorStrategy === 'fail-fast' && !result.ok) {
            sensor.log(compositionId, 'info', 'fail-fast-triggered', {
              failedChannel: result.channelId,
              executedChannels: i + 1
            })

            // Mark remaining channels as skipped
            for (let j = i + 1; j < channels.length; j++) {
              results.push({
                ok: false,
                payload: null,
                message: 'Skipped due to fail-fast',
                channelId: channels[j].id,
                channelName: channels[j].name || channels[j].id,
                executionOrder: j,
                executionTime: 0,
                skipped: true
              })
            }
            break
          }
        }
      } else {
        // Parallel: execute all at once
        const executePromises = channels.map((channel, index) =>
          executeChannel(channel, payload, index)
        )

        if (errorStrategy === 'fail-fast') {
          // Fail fast: if any fails, all fail
          results = await Promise.all(executePromises)
        } else {
          // Continue/collect: wait for all, handle errors gracefully
          const settledResults = await Promise.allSettled(executePromises)
          results = settledResults.map((result, index) => {
            if (result.status === 'fulfilled') {
              return result.value
            } else {
              // Promise itself failed (shouldn't happen since we catch in executeChannel)
              return {
                ok: false,
                payload: null,
                message: `Promise failed: ${result.reason}`,
                error: String(result.reason),
                channelId: channels[index].id,
                channelName: channels[index].name || channels[index].id,
                executionOrder: index,
                executionTime: 0,
                originalError: result.reason
              }
            }
          })
        }
      }

      const compositionTime = performance.now() - compositionStart
      const successful = results.filter(r => r.ok && !r.skipped).length
      const failed = results.filter(r => !r.ok && !r.skipped).length
      const skipped = results.filter(r => r.skipped).length

      sensor.log(compositionId, 'success', 'composition-execution-complete', {
        strategy,
        totalChannels: channels.length,
        successful,
        failed,
        skipped,
        compositionTime
      })

      // Update stats
      totalExecutions++
      if (failed === 0) successfulExecutions++
      lastExecutionTime = compositionTime

      return results
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      sensor.error(compositionId, errorMessage, 'composition-execution-error')

      // Return error results for all channels
      return channels.map((channel, index) => ({
        ok: false,
        payload: null,
        message: `Composition failed: ${errorMessage}`,
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
    id: compositionId,
    name: compositionName,
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
                    () =>
                      reject(
                        new Error(`Composition timeout after ${timeout}ms`)
                      ),
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
            compositionId,
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
        sensor.error(compositionId, errorMessage, 'composition-call-error')

        return {
          ok: false,
          payload: null,
          message: `Composition call failed: ${errorMessage}`,
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
            sensor.error(
              compositionId,
              String(error),
              'composition-subscription-error',
              {
                channelId: channel.id
              }
            )
            return {
              ok: false,
              message: `Subscription failed for ${channel.id}`,
              unsubscribe: () => false
            }
          }
        })

      const successful = subscriptions.filter(sub => sub.ok)

      sensor.log(compositionId, 'success', 'composition-subscription', {
        totalChannels: activeChannels.length,
        subscriptionsAttempted: subscriptions.length,
        subscriptionsSuccessful: successful.length
      })

      return {
        ok: successful.length > 0,
        message: `Subscribed to ${successful.length}/${subscriptions.length} channels`,
        unsubscribe: () => {
          const unsubscribeResults = subscriptions.map(sub =>
            sub.unsubscribe ? sub.unsubscribe() : false
          )
          const successfulUnsubscribes =
            unsubscribeResults.filter(Boolean).length

          sensor.log(compositionId, 'info', 'composition-unsubscribe', {
            successful: successfulUnsubscribes,
            total: subscriptions.length
          })

          return successfulUnsubscribes > 0
        }
      }
    },

    add: (channel: ChannelLike<TPayload>) => {
      if (!channel || typeof channel.call !== 'function' || !channel.id) {
        throw new Error('Invalid channel provided to composition')
      }

      activeChannels.push(channel)

      sensor.log(compositionId, 'info', 'channel-added', {
        channelId: channel.id,
        totalChannels: activeChannels.length
      })
    },

    remove: (channelId: string) => {
      const index = activeChannels.findIndex(c => c.id === channelId)
      if (index !== -1) {
        activeChannels.splice(index, 1)

        sensor.log(compositionId, 'info', 'channel-removed', {
          channelId,
          totalChannels: activeChannels.length
        })

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
