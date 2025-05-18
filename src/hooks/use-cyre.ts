// src/hooks/use-cyre.ts

import {cyre} from '../app'
import type {
  IO,
  EventHandler,
  ActionPayload,
  CyreResponse
} from '../interfaces/interface'

import {
  CyreHook,
  CyreHookOptions,
  CyreMiddleware,
  ChannelConfig,
  HistoryEntry,
  Result,
  SubscriptionWithCleanup
} from '../interfaces/hooks'

/**
 * Creates a Cyre channel with enhanced capabilities
 *
 * @param prefix - Optional prefix for channel ID (default: "channel")
 * @param options - Optional channel configuration
 * @returns A channel object with CYRE operations bound to a specific ID
 */
export function useCyre<TPayload = ActionPayload>(
  prefix = 'channel',
  options: CyreHookOptions<TPayload> = {}
): CyreHook<TPayload> {
  const channelId = `${prefix}-${crypto.randomUUID()}`

  // Configure debugging
  const debugEnabled = options.debug === true
  const debugLog = debugEnabled
    ? (message: string, data?: any) =>
        console.log(
          `[Channel:${channelId}] ${message}`,
          data !== undefined ? data : ''
        )
    : () => {}

  // Initialize state tracking
  let isInitialized = false

  // Initialize middleware system
  const middlewares: CyreMiddleware<TPayload>[] = []

  // Initialize history tracking
  const history: HistoryEntry<TPayload>[] = []
  const historyLimit = 10

  // Initialize subscription tracking
  interface ChannelSubscription {
    id: string
    handler: EventHandler
  }

  const subscriptions: ChannelSubscription[] = []
  let subscriptionCounter = 0

  /**
   * Initialize the channel action with configuration
   */
  const initialize = (config: ChannelConfig = {}): Result<boolean, Error> => {
    try {
      if (isInitialized) {
        debugLog('Channel already initialized, updating configuration')
      } else {
        debugLog('Initializing channel')
      }

      cyre.action({
        ...config,
        id: channelId,
        // Apply protection options
        throttle: options.protection?.throttle,
        debounce: options.protection?.debounce,
        detectChanges: options.protection?.detectChanges,
        priority: options.priority,
        payload: config.payload ?? options.initialPayload ?? {}
      })

      isInitialized = true
      debugLog('Initialization complete')
      return {success: true, value: true}
    } catch (error) {
      debugLog('Initialization failed', error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error('Channel initialization failed')
      }
    }
  }

  /**
   * Execute middleware chain with the provided payload
   */
  const executeMiddleware = async (
    initialPayload: TPayload
  ): Promise<CyreResponse> => {
    if (middlewares.length === 0) {
      return cyre.call(channelId, initialPayload)
    }

    // Create middleware execution chain
    let index = 0
    const execute = async (payload: TPayload): Promise<CyreResponse> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++]
        return middleware(payload, execute)
      } else {
        return cyre.call(channelId, payload)
      }
    }

    return execute(initialPayload)
  }

  /**
   * Add entry to history log
   */
  const addToHistory = (payload: TPayload, response: CyreResponse): void => {
    history.unshift({
      timestamp: Date.now(),
      payload,
      response
    })

    // Trim if exceeding limit
    if (history.length > historyLimit) {
      history.pop()
    }
  }

  // Auto-initialize if enabled
  if (options.autoInit !== false) {
    initialize()
  }

  // Create the channel object
  const channel: CyreHook<TPayload> = {
    /** The unique ID for this channel */
    id: channelId,

    /** Initialize or update the channel configuration */
    action: (config: ChannelConfig): Result<boolean, Error> => {
      return initialize(config)
    },

    /**
     * Subscribe to events on this channel with unsubscribe capability
     */
    on: (handler: EventHandler): SubscriptionWithCleanup => {
      const subscriptionId = `${channelId}-sub-${++subscriptionCounter}`
      debugLog(`Creating subscription: ${subscriptionId}`)

      // Register with Cyre
      const response = cyre.on(channelId, handler)

      // Track locally for cleanup capability
      if (response.ok) {
        subscriptions.push({
          id: subscriptionId,
          handler
        })

        debugLog(`Subscription active, total: ${subscriptions.length}`)
      } else {
        debugLog(`Subscription failed: ${response.message}`)
      }

      // Return enhanced response with unsubscribe capability
      return {
        ...response,
        unsubscribe: () => {
          debugLog(`Unsubscribing: ${subscriptionId}`)
          const index = subscriptions.findIndex(
            sub => sub.id === subscriptionId
          )
          if (index >= 0) {
            subscriptions.splice(index, 1)
            debugLog(`Unsubscribed, remaining: ${subscriptions.length}`)
          }
        }
      }
    },

    /**
     * Trigger the channel action with optional payload
     */
    call: async (payload?: TPayload): Promise<CyreResponse> => {
      if (!isInitialized) {
        debugLog('Auto-initializing before call')
        const result = initialize()
        if (!result.success) {
          return {
            ok: false,
            payload: null,
            message: `Channel initialization failed: ${result.error.message}`
          }
        }
      }

      const finalPayload = payload || ({} as TPayload)
      debugLog('Calling with payload', finalPayload)

      try {
        // Execute middleware chain
        const response = await executeMiddleware(finalPayload)

        // Log the result
        if (response.ok) {
          debugLog('Call succeeded')
        } else {
          debugLog(`Call failed: ${response.message}`)
        }

        // Add to history
        addToHistory(finalPayload, response)

        return response
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        debugLog('Call error', errorMessage)

        return {
          ok: false,
          payload: null,
          message: `Call error: ${errorMessage}`
        }
      }
    },

    /**
     * Safely call the channel with automatic error handling
     */
    safeCall: async (
      payload?: TPayload
    ): Promise<Result<CyreResponse, Error>> => {
      try {
        const response = await channel.call(payload)
        return {success: true, value: response}
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        }
      }
    },

    /**
     * Get current channel state
     */
    get: (): IO | undefined => {
      return cyre.get(channelId)
    },

    /**
     * Remove the channel and its resources
     */
    forget: (): boolean => {
      debugLog('Forgetting channel')
      const result = cyre.forget(channelId)
      if (result) isInitialized = false
      return result
    },

    /**
     * Pause channel execution
     */
    pause: (): void => {
      debugLog('Pausing')
      cyre.pause(channelId)
    },

    /**
     * Resume channel execution
     */
    resume: (): void => {
      debugLog('Resuming')
      cyre.resume(channelId)
    },

    /**
     * Check if payload has changed from previous
     */
    hasChanged: (payload: TPayload): boolean => {
      return cyre.hasChanged(channelId, payload)
    },

    /**
     * Get previous payload
     */
    getPrevious: (): TPayload | undefined => {
      return cyre.getPreviousPayload(channelId) as TPayload | undefined
    },

    /**
     * Get channel performance metrics
     */
    metrics: () => {
      return cyre.getMetrics(channelId)
    },

    /**
     * Get breathing metrics for this channel
     */
    getBreathingState: () => {
      return cyre.getBreathingState()
    },

    /**
     * Check if channel is initialized
     */
    isInitialized: (): boolean => {
      return isInitialized
    },

    /**
     * Register middleware for pre/post processing
     */
    middleware: (middleware: CyreMiddleware<TPayload>): void => {
      debugLog('Adding middleware')
      middlewares.push(middleware)
    },

    /**
     * Get execution history
     */
    getHistory: (): ReadonlyArray<HistoryEntry<TPayload>> => {
      return [...history]
    },

    /**
     * Clear execution history
     */
    clearHistory: (): void => {
      debugLog('Clearing history')
      history.length = 0
    },

    /**
     * Get the count of active subscriptions
     */
    getSubscriptionCount: (): number => {
      return subscriptions.length
    }
  }

  return channel
}

/**
 * Type definition for the useCyre return value
 */
