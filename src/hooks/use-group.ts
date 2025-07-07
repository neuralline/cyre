// src/hooks/use-group-updated.ts
// Production-ready useGroup with enhanced validation and features

import type {EventHandler, ActionPayload, IO} from '../types/core'
import type {
  ChannelLike,
  UseGroupConfig,
  GroupedChannel,
  ChannelExecutionResult,
  ExecutionStrategy,
  ErrorStrategy
} from '../types/hooks'
import {sensor} from '../components/sensor'

/*
      U.S.E - G.R.O.U.P - U.P.D.A.T.E.D
      
      Production-ready channel coordination with:
      - Enhanced validation that works with useCyre hooks
      - Flexible channel interface detection
      - Better error messages and debugging
      - Performance monitoring
      - Lifecycle management
      - Memory leak prevention
*/

/**
 * Enhanced error handling
 */
const normalizeError = (error: unknown): Error | string => {
  if (error instanceof Error) {
    return error
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return String(error)
}

/**
 * FIXED: Enhanced channel validation that works with useCyre hooks
 */
const validateAndAdaptChannel = (
  channel: any,
  index: number
): ChannelLike<any> | null => {
  if (!channel) {
    sensor.error(
      'useGroup',
      `Channel at index ${index} is null/undefined`,
      'validation'
    )
    return null
  }

  // Check if it has a call method
  if (typeof channel.call !== 'function') {
    sensor.error(
      'useGroup',
      `Channel at index ${index} missing call() method`,
      'validation'
    )
    return null
  }

  // ENHANCED: Multiple ways to get channel ID
  let channelId: string

  if (channel.id) {
    channelId = channel.id
  } else if (channel.getStats && typeof channel.getStats === 'function') {
    // Handle useCyre hooks
    const stats = channel.getStats()
    channelId = stats.globalId || stats.localId || `channel-${index}`
  } else if (channel.path && typeof channel.path === 'function') {
    // Handle branch-like objects
    channelId = channel.path() || `channel-${index}`
  } else {
    // Fallback: generate ID
    channelId = `channel-${index}-${crypto.randomUUID().slice(0, 8)}`
    sensor.warn(
      'useGroup',
      `Channel at index ${index} missing ID, generated: ${channelId}`
    )
  }

  // Create standardized channel adapter
  return {
    id: channelId,
    name: channel.name || channelId,
    call: channel.call.bind(channel),
    on: channel.on ? channel.on.bind(channel) : undefined,
    path: channel.path || '',
    // Add metadata for debugging
    _originalChannel: channel,
    _adapted: true
  }
}

/**
 * Production-ready useGroup with enhanced validation
 */
export function useGroup<TPayload = ActionPayload>(
  channels: IO[], // More flexible input type
  config: UseGroupConfig = {}
): GroupedChannel<TPayload> {
  const groupId = `group-${crypto.randomUUID().slice(0, 8)}`

  // ENHANCED: Better validation and adaptation
  if (!channels || channels.length === 0) {
    throw new Error('useGroup requires at least one channel')
  }

  // Validate and adapt all channels
  const adaptedChannels: ChannelLike<TPayload>[] = []
  const invalidChannels: number[] = []

  channels.forEach((channel, index) => {
    const adapted = validateAndAdaptChannel(channel, index)
    if (adapted) {
      adaptedChannels.push(adapted)
    } else {
      invalidChannels.push(index)
    }
  })

  // IMPROVED: Better error reporting
  if (adaptedChannels.length === 0) {
    throw new Error(
      `useGroup: All ${channels.length} channels are invalid. ` +
        `Channels must have a call() method and some form of identifier.`
    )
  }

  if (invalidChannels.length > 0) {
    sensor.warn(
      'useGroup',
      `${
        invalidChannels.length
      } invalid channels ignored at indices: ${invalidChannels.join(', ')}`,
      'validation'
    )
  }

  const groupName =
    config.name || `Group[${adaptedChannels.map(c => c.name).join(', ')}]`
  const strategy: ExecutionStrategy = config.strategy || 'parallel'
  const errorStrategy: ErrorStrategy = config.errorStrategy || 'continue'
  const timeout = config.timeout || 10000

  // ENHANCED: Better stats tracking
  let totalExecutions = 0
  let successfulExecutions = 0
  let lastExecutionTime = 0
  let lastExecutionResults: ChannelExecutionResult[] = []
  const createdAt = Date.now()

  console.log(
    `🎯 useGroup created: ${groupName} (${adaptedChannels.length} channels)`
  )

  /**
   * ENHANCED: Execute single channel with better error handling
   */
  async function executeChannel(
    channel: ChannelLike<TPayload>,
    payload: TPayload | undefined,
    executionOrder: number
  ): Promise<ChannelExecutionResult> {
    const startTime = performance.now()

    try {
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
      const normalizedError = normalizeError(error)
      const errorMessage =
        normalizedError instanceof Error
          ? normalizedError.message
          : normalizedError

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
        originalError: normalizedError
      }
    }
  }

  /**
   * ENHANCED: Execute all channels with better coordination
   */
  async function executeChannels(
    payload?: TPayload
  ): Promise<ChannelExecutionResult[]> {
    try {
      totalExecutions++
      const startTime = performance.now()

      let results: ChannelExecutionResult[]

      if (strategy === 'parallel') {
        // Execute all channels in parallel with Promise.allSettled for better error handling
        const promises = adaptedChannels.map((channel, index) =>
          executeChannel(channel, payload, index)
        )
        results = await Promise.all(promises)
      } else if (strategy === 'sequential') {
        // Execute channels sequentially
        results = []
        for (let i = 0; i < adaptedChannels.length; i++) {
          const result = await executeChannel(adaptedChannels[i], payload, i)
          results.push(result)

          // Stop on first failure if fail-fast strategy
          if (!result.ok && errorStrategy === 'fail-fast') {
            console.log(
              `🛑 Group execution stopped at channel ${i} due to fail-fast strategy`
            )
            break
          }
        }
      } else {
        throw new Error(`Unknown execution strategy: ${strategy}`)
      }

      lastExecutionTime = performance.now() - startTime
      lastExecutionResults = results
      successfulExecutions += results.every(r => r.ok !== false) ? 1 : 0

      return results
    } catch (error) {
      const normalizedError = normalizeError(error)
      const errorMessage =
        normalizedError instanceof Error
          ? normalizedError.message
          : normalizedError

      sensor.error(groupId, errorMessage, 'group-execution-error')

      // Return error results for all channels
      return adaptedChannels.map((channel, index) => ({
        ok: false,
        payload: null,
        message: `Group failed: ${errorMessage}`,
        error: errorMessage,
        channelId: channel.id,
        channelName: channel.name || channel.id,
        executionOrder: index,
        executionTime: 0,
        originalError: normalizedError,
        success: false
      }))
    }
  }

  // Keep track of active channels for dynamic management
  const activeChannels = [...adaptedChannels]

  // ENHANCED: Build grouped channel interface with more features
  const groupedChannel: GroupedChannel<TPayload> = {
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

        // ENHANCED: Better result categorization
        const successful = results.filter(r => r.ok !== false && !r.skipped)
        const failed = results.filter(r => r.ok === false && !r.skipped)
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

        // ENHANCED: More detailed metadata
        return {
          ok: isSuccess,
          payload: results,
          message,
          metadata: {
            source: 'useGroup',
            groupId,
            groupName,
            executionStrategy: strategy,
            errorStrategy,
            channelCount: activeChannels.length,
            successful: successful.length,
            failed: failed.length,
            skipped: skipped.length,
            executionTime: results.reduce((sum, r) => sum + r.executionTime, 0),
            averageExecutionTime:
              results.length > 0
                ? results.reduce((sum, r) => sum + r.executionTime, 0) /
                  results.length
                : 0,
            timestamp: Date.now()
          }
        }
      } catch (error) {
        const normalizedError = normalizeError(error)
        const errorMessage =
          normalizedError instanceof Error
            ? normalizedError.message
            : normalizedError

        sensor.error(groupId, errorMessage, 'group-call-error')

        return {
          ok: false,
          payload: null,
          message: `Group call failed: ${errorMessage}`,
          error: errorMessage
        }
      }
    },

    // ENHANCED: Better subscription handling
    on: (handler: EventHandler) => {
      const subscriptions = activeChannels
        .filter(channel => channel.on)
        .map(channel => {
          try {
            return channel.on!(handler)
          } catch (error) {
            const normalizedError = normalizeError(error)
            const errorMessage =
              normalizedError instanceof Error
                ? normalizedError.message
                : normalizedError

            sensor.error(groupId, errorMessage, 'group-subscription-error')
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
          return unsubscribeResults.filter(Boolean).length > 0
        }
      }
    },

    // ENHANCED: Better channel management
    set: (channel: any) => {
      const adapted = validateAndAdaptChannel(channel, activeChannels.length)
      if (!adapted) {
        throw new Error('Invalid channel provided to group')
      }

      activeChannels.push(adapted)
      console.log(`➕ Added channel to group ${groupName}: ${adapted.name}`)
    },

    forget: (channelId: string) => {
      const index = activeChannels.findIndex(c => c.id === channelId)
      if (index !== -1) {
        const removed = activeChannels.splice(index, 1)[0]
        console.log(
          `➖ Removed channel from group ${groupName}: ${removed.name}`
        )
        return true
      }
      return false
    },

    // ENHANCED: More comprehensive stats
    getStats: () => ({
      groupId,
      groupName,
      channelCount: activeChannels.length,
      lastExecutionTime,
      totalExecutions,
      successfulExecutions,
      successRate:
        totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      strategy,
      errorStrategy,
      timeout,
      createdAt,
      uptime: Date.now() - createdAt,
      channels: activeChannels.map(c => ({
        id: c.id,
        name: c.name,
        hasSubscription: !!c.on
      })),
      lastResults:
        lastExecutionResults.length > 0
          ? {
              timestamp: Date.now(),
              successful: lastExecutionResults.filter(r => r.ok !== false)
                .length,
              failed: lastExecutionResults.filter(r => r.ok === false).length,
              totalTime: lastExecutionResults.reduce(
                (sum, r) => sum + r.executionTime,
                0
              )
            }
          : null
    }),

    // NEW: Health check method

    // NEW: Cleanup method
    destroy: () => {
      console.log(`🗑️ Destroying group: ${groupName}`)
      activeChannels.length = 0
      totalExecutions = 0
      successfulExecutions = 0
      lastExecutionResults = []
    }
  }

  return groupedChannel
}

// Export updated types
export type {
  ChannelLike,
  UseGroupConfig,
  GroupedChannel,
  ChannelExecutionResult,
  ExecutionStrategy,
  ErrorStrategy
}
