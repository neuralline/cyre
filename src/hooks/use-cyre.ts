// src/hooks/use-cyre.ts

import {cyre} from '../app'
import type {
  IO,
  EventHandler,
  ActionPayload,
  CyreResponse
} from '../types/interface'

import {
  CyreHook,
  CyreHookOptions,
  CyreMiddleware,
  ChannelConfig,
  HistoryEntry,
  Result,
  SubscriptionWithCleanup
} from '../types/hooks-interface'
import {
  registerMiddleware,
  MiddlewareFunction
} from '../components/cyre-middleware'

/**
 * Creates a Cyre channel with enhanced capabilities
 *
 * @param options - Channel configuration options including identification and protection
 * @returns A channel object with CYRE operations bound to a specific ID
 */
export function useCyre<TPayload = ActionPayload>(
  options: CyreHookOptions<TPayload> = {}
): CyreHook<TPayload> {
  // Use name/tag from options, or generate a default identifier
  const channelName = options.name || options.tag || 'channel'
  const channelId = `${channelName}-${crypto.randomUUID()}`

  // Configure debugging
  const debugEnabled = options.debug === true
  const debugLog = debugEnabled
    ? (message: string, data?: any) =>
        console.log(
          `[${channelName}:${channelId.slice(-8)}] ${message}`,
          data !== undefined ? data : ''
        )
    : () => {}

  // Initialize state tracking
  let isInitialized = false

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

      // Collect middleware IDs from action config if present
      const existingMiddleware = config.middleware || []

      cyre.action({
        ...config,
        id: channelId,
        // Apply protection options
        throttle: options.protection?.throttle,
        debounce: options.protection?.debounce,
        detectChanges: options.protection?.detectChanges,
        priority: options.priority,
        payload: config.payload ?? options.initialPayload ?? {},
        // Ensure middleware array is preserved
        middleware: existingMiddleware
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

  // Auto-initialize if enabled
  if (options.autoInit !== false) {
    initialize()
  }

  // Create the channel object
  const channel: CyreHook<TPayload> = {
    /** The unique ID for this channel */
    id: channelId,

    /** The friendly name for this channel */
    name: channelName,

    /**
     * Initialize or update the channel configuration
     */
    action: (config: ChannelConfig): Result<boolean, Error> => {
      try {
        if (isInitialized) {
          debugLog('Channel already initialized, updating configuration')
        } else {
          debugLog('Initializing channel')
        }

        // Get existing action to preserve middleware
        const existingAction = cyre.get(channelId)
        const existingMiddleware = existingAction?.middleware || []

        // Ensure middleware is preserved during updates
        cyre.action({
          ...config,
          id: channelId,
          // Apply protection options
          throttle: options.protection?.throttle,
          debounce: options.protection?.debounce,
          detectChanges: options.protection?.detectChanges,
          priority: options.priority,
          payload: config.payload ?? options.initialPayload ?? {},
          // Preserve existing middleware - this is the key fix
          middleware: config.middleware
            ? [...existingMiddleware, ...config.middleware]
            : existingMiddleware
        })

        isInitialized = true
        debugLog(`Initialization complete`)
        // Log middleware state for debugging
        const currentAction = cyre.get(channelId)
        debugLog(
          `Middleware array: ${JSON.stringify(currentAction?.middleware || [])}`
        )

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
          return cyre.forget(channelId)
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

      // Get the current action to check middleware array
      const action = cyre.get(channelId)
      debugLog(
        `Call - Current action has middleware: ${JSON.stringify(
          action?.middleware || []
        )}`
      )

      const finalPayload = payload || ({} as TPayload)
      debugLog('Calling with payload', finalPayload)

      try {
        // Call the action
        const response = await cyre.call(channelId, finalPayload)

        // Log the result
        if (response.ok) {
          debugLog('Call succeeded')
        } else {
          debugLog(`Call failed: ${response.message}`)
        }

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
        debugLog('Making safe call with payload', payload)
        const response = await channel.call(payload)
        debugLog('Safe call succeeded', response)
        return {success: true, value: response}
      } catch (error) {
        debugLog('Safe call failed', error)
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
      return cyre.getPrevious(channelId) as TPayload | undefined
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
     * Now uses core middleware system
     */
    /**
     * Register middleware for pre/post processing
     */
    middleware: (middleware: CyreMiddleware<TPayload>): void => {
      debugLog('Adding middleware')

      // Generate a unique ID for this middleware
      const middlewareId = `${channelId}-middleware-${crypto
        .randomUUID()
        .slice(0, 8)}`

      // Register the middleware function
      const response = cyre.middleware(
        middlewareId,
        async (action, actionPayload) => {
          try {
            // Only apply to this channel's actions
            if (action.id !== channelId) {
              return {action, payload: actionPayload}
            }

            debugLog(`Executing middleware ${middlewareId}`)

            // Prepare next function
            const next = async (
              processedPayload: TPayload
            ): Promise<CyreResponse> => {
              debugLog('Middleware calling next with processed payload')
              return await cyre.call(channelId, processedPayload)
            }

            // Call the channel middleware
            const result = await middleware(actionPayload as TPayload, next)

            // If middleware returns a result, continue the chain
            if (result.ok) {
              debugLog('Middleware transformation successful')
              return {action, payload: result.payload || actionPayload}
            }

            // Otherwise, reject the action
            debugLog('Middleware rejected the action')
            return null
          } catch (error) {
            debugLog('Middleware error', error)
            return null
          }
        }
      )

      if (response.ok) {
        // Get the current action configuration
        const action = cyre.get(channelId)

        if (action) {
          // Important: Create a proper middleware array
          const currentMiddleware = Array.isArray(action.middleware)
            ? action.middleware
            : []
          const updatedMiddleware = [...currentMiddleware, middlewareId]

          // Update the action with the new middleware array
          cyre.action({
            ...action,
            // Explicitly set the middleware array
            middleware: updatedMiddleware
          })

          // Verify the update was successful
          const updatedAction = cyre.get(channelId)
          debugLog(
            `Middleware registered and added to action, middleware array: [${
              updatedAction?.middleware?.join(', ') || ''
            }]`
          )
        } else {
          debugLog('Cannot add middleware: Action not found')
        }
      } else {
        debugLog(`Failed to register middleware: ${response.message}`)
      }
    },

    /**
     * Get execution history using core history system via cyre API
     */
    getHistory: (): ReadonlyArray<HistoryEntry<TPayload>> => {
      const rawHistory = cyre.getHistory(channelId)
      // Convert to expected format
      return rawHistory.map(entry => ({
        timestamp: entry.timestamp,
        payload: entry.payload as TPayload,
        response: {
          ok: entry.result.ok,
          payload: null,
          message: entry.result.message || '',
          error: entry.result.error ? new Error(entry.result.error) : undefined
        }
      }))
    },

    /**
     * Clear execution history using core history system via public API
     */
    clearHistory: (): void => {
      debugLog('Clearing history')
      cyre.clearHistory(channelId)
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
