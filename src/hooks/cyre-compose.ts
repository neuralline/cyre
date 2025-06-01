// src/hooks/cyre-compose.ts
// Updated cyreCompose with latest Cyre v4.0 integration

import type {
  EventHandler,
  ActionPayload,
  CyreResponse,
  Priority
} from '../types/interface'
import type {CyreChannel, HookResult} from '../types/hooks-interface'
import {cyre} from '../app'
import {sensor} from '../context/metrics-report'

/**
 * Options for composed channels
 */
export interface CompositionOptions {
  /** Custom ID for composed channels */
  id?: string
  /** Whether to continue on error */
  continueOnError?: boolean
  /** Priority level for the composition */
  priority?: Priority
  /** Enable detailed timing collection */
  collectDetailedMetrics?: boolean
  /** Timeout for the entire composition (ms) */
  timeout?: number
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Result with detailed information
 */
export interface CyreComposedResponse extends CyreResponse {
  /** Channel that produced this result */
  channelId: string
  /** Channel name for easier identification */
  channelName: string
  /** Execution order in the composition */
  executionOrder: number
  /** Detailed timing information */
  timing?: {
    pipelineOverhead: number
    listenerExecution: number
    totalExecution: number
    overheadRatio: number
  }
  /** Whether this channel was skipped due to error handling */
  skipped?: boolean
  /** Original error if channel failed */
  originalError?: Error | string
}

/**
 * Composition execution context
 */
interface CompositionContext {
  startTime: number
  executionOrder: number
  results: CyreComposedResponse[]
  errors: Array<{channelId: string; error: Error | string}>
  timer: any // PerformanceTimer from metricsReport
}

/**
 * Create a composed channel from multiple channels
 * Integrates with Cyre v4.0 features including metrics, timing, and error handling
 */
export function cyreCompose<TPayload = ActionPayload>(
  channels: CyreChannel<TPayload>[],
  options: CompositionOptions = {}
): CyreChannel<TPayload> {
  const composedId = options.id || `composed-${crypto.randomUUID()}`
  const debug = options.debug || false
  const collectMetrics = options.collectDetailedMetrics !== false

  const debugLog = debug
    ? (message: string, data?: any) =>
        console.log(`[${composedId}] ${message}`, data || '')
    : () => {}

  debugLog('Creating composed channel', {
    channelCount: channels.length,
    channelIds: channels.map(c => c.id),
    options
  })

  /**
   * Execute channels with error handling and metrics
   */
  async function executeComposition(
    payload?: TPayload
  ): Promise<CyreComposedResponse[]> {
    const context: CompositionContext = {
      startTime: performance.now(),
      executionOrder: 0,
      results: [],
      errors: [],
      timer: collectMetrics ? Date.now() : null
    }

    if (context.timer) {
      context.timer.start()
    }

    debugLog('Starting composition execution', {
      channelCount: channels.length,
      payload: typeof payload
    })

    // Execute channels sequentially
    for (const channel of channels) {
      context.executionOrder++

      try {
        debugLog(
          `Executing channel ${context.executionOrder}/${channels.length}`,
          {
            channelId: channel.id,
            channelName: channel.name
          }
        )

        // Mark stage for timing if collecting metrics
        if (context.timer) {
          context.timer.markStage(`channel-${context.executionOrder}-start`)
        }

        // Execute the channel
        const channelStartTime = performance.now()
        const result = await channel.call(payload)
        const channelEndTime = performance.now()

        // Mark stage completion
        if (context.timer) {
          context.timer.markStage(`channel-${context.executionOrder}-end`)
        }

        // Get detailed timing if available
        const channelMetrics = channel.metrics()
        const timing = collectMetrics
          ? {
              pipelineOverhead: channelMetrics?.avgPipelineOverhead || 0,
              listenerExecution:
                channelMetrics?.avgListenerTime ||
                channelEndTime - channelStartTime,
              totalExecution: channelEndTime - channelStartTime,
              overheadRatio: channelMetrics?.overheadRatio || 0
            }
          : undefined

        // Create result
        const composedResult: CyreComposedResponse = {
          ...result,
          channelId: channel.id,
          channelName: channel.name,
          executionOrder: context.executionOrder,
          timing: collectMetrics
            ? {
                pipelineOverhead: channelMetrics?.avgPipelineOverhead || 0,
                listenerExecution: channelMetrics?.avgListenerTime || 0,
                totalExecution: channelEndTime - channelStartTime,
                overheadRatio: channelMetrics?.overheadRatio || 0
              }
            : {
                pipelineOverhead: 0,
                listenerExecution: 0,
                totalExecution: 0,
                overheadRatio: 0
              },
          skipped: false
        }

        context.results.push(composedResult)

        debugLog(`Channel ${context.executionOrder} completed`, {
          success: result.ok,
          message: result.message,
          timing: timing?.totalExecution
        })

        // Handle errors based on continueOnError setting
        if (!result.ok) {
          const error = result.error || result.message || 'Unknown error'
          context.errors.push({
            channelId: channel.id,
            error
          })

          // Stop execution if continueOnError is false
          if (!options.continueOnError) {
            debugLog('Stopping execution due to error', {
              channelId: channel.id,
              error,
              continueOnError: options.continueOnError
            })
            break
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        debugLog(`Channel ${context.executionOrder} threw exception`, {
          channelId: channel.id,
          error: errorMessage
        })

        context.errors.push({
          channelId: channel.id,
          error: errorMessage
        })

        // Create error result
        const errorResult: CyreComposedResponse = {
          ok: false,
          payload: null,
          message: `Channel execution failed: ${errorMessage}`,
          channelId: channel.id,
          channelName: channel.name,
          executionOrder: context.executionOrder,
          skipped: false,
          error: error
        }

        context.results.push(errorResult)

        // Stop execution if continueOnError is false
        if (!options.continueOnError) {
          debugLog('Stopping execution due to exception', {
            channelId: channel.id,
            error: errorMessage,
            continueOnError: options.continueOnError
          })
          break
        }
      }
    }

    // Record composition metrics
    if (context.timer && collectMetrics) {
      const compositionTiming = context.timer.createDetailedTiming()

      // Record in metrics system
      sensor.log(composedId, compositionTiming)

      debugLog('Composition metrics recorded', {
        totalTime: compositionTiming.totals.totalExecution,
        pipelineOverhead: compositionTiming.totals.pipelineOverhead,
        channels: context.results.length,
        errors: context.errors.length
      })
    }

    const totalTime = performance.now() - context.startTime
    debugLog('Composition execution completed', {
      totalChannels: channels.length,
      executedChannels: context.results.length,
      errors: context.errors.length,
      totalTime: totalTime.toFixed(2) + 'ms'
    })

    return context.results
  }

  // Create the composed channel
  const composedChannel: CyreChannel<TPayload> = {
    id: composedId,
    name: `composed-${channels.length}-channels`,

    // Enhanced action method
    action: config => {
      debugLog('Updating composition configuration', config)

      // Apply configuration to all channels
      const results = channels.map(channel => channel.action(config))
      const allSuccessful = results.every(r => r.success)

      return {
        success: allSuccessful,
        value: allSuccessful,
        error: allSuccessful
          ? undefined
          : new Error('Some channels failed to update')
      } as HookResult<boolean, Error>
    },

    // Subscription with composition-level handling
    on: (handler: EventHandler) => {
      debugLog('Setting up composition subscription')

      // Subscribe to all channels
      const subscriptions = channels.map(channel => channel.on(handler))

      return {
        ok: subscriptions.every(sub => sub.ok),
        message: `Subscribed to ${subscriptions.filter(sub => sub.ok).length}/${
          channels.length
        } channels`,
        unsubscribe: () => {
          debugLog('Unsubscribing from all channels')
          return subscriptions.every(sub =>
            sub.unsubscribe ? sub.unsubscribe() : false
          )
        }
      }
    },

    // Call method with detailed results
    call: async (payload?: TPayload): Promise<CyreResponse> => {
      try {
        // Apply timeout if specified
        const executeWithTimeout = options.timeout
          ? Promise.race([
              executeComposition(payload),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Composition timeout after ${options.timeout}ms`
                      )
                    ),
                  options.timeout
                )
              )
            ])
          : executeComposition(payload)

        const results = await executeWithTimeout

        // Return summary result
        const allSuccessful = results.every(r => r.ok)
        const failedChannels = results.filter(r => !r.ok)

        return {
          ok: allSuccessful,
          payload: results, // Return all results as payload
          message: allSuccessful
            ? `All ${results.length} channels executed successfully`
            : `${failedChannels.length}/${results.length} channels failed`,
          metadata: {
            executionTime: results.reduce(
              (sum, r) => sum + (r.timing?.totalExecution || 0),
              0
            ),
            source: 'cyreCompose',
            actionId: composedId,
            priority: options.priority || 'medium'
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        debugLog('Composition execution failed', {error: errorMessage})

        return {
          ok: false,
          payload: null,
          message: `Composition failed: ${errorMessage}`,
          error: errorMessage
        }
      }
    },

    // Safe call wrapper
    safeCall: async (payload?: TPayload) => {
      try {
        const result = await composedChannel.call(payload)
        return {success: true, value: result}
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        }
      }
    },

    // Get composed configuration
    get: () => {
      return {
        id: composedId,
        type: 'composed-channel',
        payload: {},
        metadata: {
          channelCount: channels.length,
          channelIds: channels.map(c => c.id),
          options
        }
      }
    },

    // Forget with proper cleanup
    forget: (): boolean => {
      debugLog('Forgetting composed channel and all sub-channels')

      const results = channels.map(channel => {
        try {
          return channel.forget()
        } catch (error) {
          debugLog(`Error forgetting channel ${channel.id}`, error)
          return false
        }
      })

      const allForgotten = results.every(Boolean)
      debugLog('Composition cleanup completed', {
        channels: channels.length,
        successful: results.filter(Boolean).length
      })

      return allForgotten
    },

    // Pause all channels
    pause: (): void => {
      debugLog('Pausing all channels in composition')
      channels.forEach(channel => {
        try {
          channel.pause()
        } catch (error) {
          debugLog(`Error pausing channel ${channel.id}`, error)
        }
      })
    },

    // Resume all channels
    resume: (): void => {
      debugLog('Resuming all channels in composition')
      channels.forEach(channel => {
        try {
          channel.resume()
        } catch (error) {
          debugLog(`Error resuming channel ${channel.id}`, error)
        }
      })
    },

    // Change detection (checks all channels)
    hasChanged: (payload: TPayload): boolean => {
      return channels.some(channel => {
        try {
          return channel.hasChanged(payload)
        } catch (error) {
          debugLog(`Error checking changes for channel ${channel.id}`, error)
          return true // Assume changed on error
        }
      })
    },

    // Get previous payload from first channel
    getPrevious: (): TPayload | undefined => {
      return channels[0]?.getPrevious()
    },

    // Metrics aggregation
    metrics: () => {
      const channelMetrics = channels.map(channel => {
        try {
          return {channelId: channel.id, metrics: channel.metrics()}
        } catch (error) {
          debugLog(`Error getting metrics for channel ${channel.id}`, error)
          return {channelId: channel.id, metrics: null}
        }
      })

      return {
        compositionId: composedId,
        channelCount: channels.length,
        channels: channelMetrics,
        breathing: cyre.getBreathingState(),
        performance: cyre.getPerformanceState()
      }
    },

    // Get breathing state from core system
    getBreathingState: () => {
      return cyre.getBreathingState()
    },

    // Check if all channels are initialized
    isInitialized: (): boolean => {
      return channels.every(channel => {
        try {
          return channel.isInitialized()
        } catch (error) {
          debugLog(
            `Error checking initialization for channel ${channel.id}`,
            error
          )
          return false
        }
      })
    },

    // Middleware (applies to all channels)
    middleware: middleware => {
      debugLog('Applying middleware to all channels in composition')

      channels.forEach(channel => {
        try {
          channel.middleware(middleware)
        } catch (error) {
          debugLog(`Error applying middleware to channel ${channel.id}`, error)
        }
      })
    },

    // Aggregated history
    getHistory: () => {
      const allHistory = channels.flatMap(channel => {
        try {
          return channel.getHistory().map(entry => ({
            ...entry,
            channelId: channel.id,
            channelName: channel.name
          }))
        } catch (error) {
          debugLog(`Error getting history for channel ${channel.id}`, error)
          return []
        }
      })

      // Sort by timestamp, newest first
      return allHistory.sort((a, b) => b.timestamp - a.timestamp)
    },

    // Clear history for all channels
    clearHistory: (): void => {
      debugLog('Clearing history for all channels')
      channels.forEach(channel => {
        try {
          channel.clearHistory()
        } catch (error) {
          debugLog(`Error clearing history for channel ${channel.id}`, error)
        }
      })
    },

    // Get total subscription count
    getSubscriptionCount: (): number => {
      return channels.reduce((total, channel) => {
        try {
          return total + channel.getSubscriptionCount()
        } catch (error) {
          debugLog(
            `Error getting subscription count for channel ${channel.id}`,
            error
          )
          return total
        }
      }, 0)
    }
  }

  // Additional composed channel methods
  return {
    ...composedChannel,

    // Get all channel IDs
    getChannelIds: (): string[] => {
      return channels.map(channel => channel.id)
    },

    // Get all channel names
    getChannelNames: (): string[] => {
      return channels.map(channel => channel.name)
    },

    // Get specific channel by ID
    getChannel: (channelId: string): CyreChannel<TPayload> | undefined => {
      return channels.find(channel => channel.id === channelId)
    },

    // Execution with detailed results
    executeDetailed: async (
      payload?: TPayload
    ): Promise<CyreComposedResponse[]> => {
      return executeComposition(payload)
    }
  } as CyreChannel<TPayload> & {
    getChannelIds(): string[]
    getChannelNames(): string[]
    getChannel(channelId: string): CyreChannel<TPayload> | undefined
    executeDetailed(payload?: TPayload): Promise<CyreComposedResponse[]>
  }
}
