// src/hooks/use-cyre.ts

import {cyre} from '../app'
import type {IO, EventHandler, ActionPayload, CyreResponse} from '../types/core'

import {
  CyreHook,
  CyreHookOptions,
  CyreMiddleware,
  ChannelConfig,
  HookResult,
  SubscriptionWithCleanup
} from '../types/hooks-interface'

/*

      C.Y.R.E - H.O.O.K
      
      Enhanced useCyre hook with unlimited channel-specific middleware:
      - Each channel has its own middleware chain
      - Unlimited middleware support per channel
      - Channel isolation - middleware only applies to specific channel
      - Proper cleanup and error handling

*/

interface ChannelMiddleware {
  id: string
  fn: CyreMiddleware
  enabled: boolean
}

interface ChannelMiddlewareChain {
  middlewares: ChannelMiddleware[]
  executionCount: number
}

/**
 * Enhanced useCyre with unlimited channel-specific middleware
 */
export function useCyre<TPayload = ActionPayload>(
  options: CyreHookOptions<TPayload> = {}
): CyreHook<TPayload> {
  const hookName = options.name || options.tag || 'channel'
  const channelId = options.channelId || `${hookName}-${crypto.randomUUID()}`

  const debugEnabled = options.debug === true
  const debugLog = debugEnabled
    ? (message: string, data?: any) =>
        console.log(
          `[${name}:${channelId.slice(-8)}] ${message}`,
          data !== undefined ? data : ''
        )
    : () => {}

  // Channel-specific middleware chain
  const middlewareChain: ChannelMiddlewareChain = {
    middlewares: [],
    executionCount: 0
  }

  let isInitialized = false
  let middlewareCounter = 0

  // Subscription tracking
  interface ChannelSubscription {
    id: string
    handler: EventHandler
  }

  const subscriptions: ChannelSubscription[] = []
  let subscriptionCounter = 0

  /**
   * Execute channel-specific middleware chain
   */
  const executeMiddlewareChain = async (
    payload: TPayload
  ): Promise<CyreResponse> => {
    const enabledMiddlewares = middlewareChain.middlewares.filter(
      m => m.enabled
    )

    if (enabledMiddlewares.length === 0) {
      debugLog('No middleware - direct execution')
      return {
        ok: true,
        payload,
        message: 'No middleware to execute'
      }
    }

    debugLog(`Executing ${enabledMiddlewares.length} middleware functions`)

    let currentPayload = payload
    const executionId = `${channelId}-exec-${++middlewareChain.executionCount}`

    try {
      for (let i = 0; i < enabledMiddlewares.length; i++) {
        const middleware = enabledMiddlewares[i]

        debugLog(
          `Executing middleware ${i + 1}/${enabledMiddlewares.length}: ${
            middleware.id
          }`
        )

        // Create next function for this middleware
        const next = async (nextPayload?: TPayload): Promise<CyreResponse> => {
          return {
            ok: true,
            payload: nextPayload !== undefined ? nextPayload : currentPayload,
            message: 'Middleware processing complete'
          }
        }

        try {
          const result = await middleware.fn(currentPayload, next)

          if (!result.ok) {
            debugLog(
              `Middleware ${middleware.id} blocked execution: ${result.message}`
            )
            return {
              ok: false,
              payload: result.payload,
              message: `Middleware ${middleware.id} blocked: ${result.message}`,
              error: result.error
            }
          }

          // Update payload for next middleware
          if (result.payload !== null && result.payload !== undefined) {
            currentPayload = result.payload as TPayload
            debugLog(`Middleware ${middleware.id} transformed payload`)
          }
        } catch (middlewareError) {
          const errorMessage =
            middlewareError instanceof Error
              ? middlewareError.message
              : String(middlewareError)

          debugLog(`Middleware ${middleware.id} error: ${errorMessage}`)

          return {
            ok: false,
            payload: null,
            message: `Middleware ${middleware.id} error: ${errorMessage}`,
            error: errorMessage
          }
        }
      }

      debugLog('All middleware executed successfully')

      return {
        ok: true,
        payload: currentPayload,
        message: `${enabledMiddlewares.length} middleware functions executed`,
        metadata: {
          executionId,
          middlewareCount: enabledMiddlewares.length,
          middlewares: enabledMiddlewares.map(m => m.id)
        }
      }
    } catch (chainError) {
      const errorMessage =
        chainError instanceof Error ? chainError.message : String(chainError)

      debugLog(`Middleware chain error: ${errorMessage}`)

      return {
        ok: false,
        payload: null,
        message: `Middleware chain error: ${errorMessage}`,
        error: errorMessage
      }
    }
  }

  /**
   * Initialize channel configuration
   */
  const initialize = (
    config: ChannelConfig = {}
  ): HookResult<boolean, Error> => {
    try {
      if (isInitialized) {
        debugLog('Channel already initialized, updating configuration')
      } else {
        debugLog('Initializing channel')
      }

      cyre.action({
        ...config,
        id: channelId,
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

  // Auto-initialize if enabled
  if (options.autoInit !== false) {
    initialize()
  }

  // Create the enhanced channel object
  const channel: CyreHook<TPayload> = {
    id: channelId,
    name: hookName,

    action: (config: ChannelConfig): HookResult<boolean, Error> => {
      return initialize(config)
    },

    /**
     * Subscribe to channel events
     */
    on: (handler: EventHandler): SubscriptionWithCleanup => {
      const subscriptionId = `${channelId}-sub-${++subscriptionCounter}`
      debugLog(`Creating subscription: ${subscriptionId}`)

      // Register with core CYRE directly - middleware is handled in call
      const response = cyre.on(channelId, handler)

      if (response.ok) {
        subscriptions.push({
          id: subscriptionId,
          handler: handler
        })
        debugLog(`Subscription active, total: ${subscriptions.length}`)
      } else {
        debugLog(`Subscription failed: ${response.message}`)
      }

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
     * Call channel - middleware is executed here before calling core
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
        // Execute middleware chain first
        const middlewareResult = await executeMiddlewareChain(finalPayload)

        if (!middlewareResult.ok) {
          debugLog(`Middleware blocked execution: ${middlewareResult.message}`)
          return middlewareResult
        }

        // Then call core CYRE with processed payload
        const response = await cyre.call(
          channelId,
          middlewareResult.payload as TPayload
        )

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
     * Get current channel configuration
     */
    get: (): IO | undefined => {
      return cyre.get(channelId)
    },

    /**
     * Remove channel and cleanup middleware
     */
    forget: (): boolean => {
      debugLog('Forgetting channel and cleaning up middleware')

      // Clear all middleware
      middlewareChain.middlewares.length = 0
      middlewareChain.executionCount = 0

      const result = cyre.forget(channelId)
      if (result) isInitialized = false

      debugLog('Channel forgotten, middleware cleared')
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
     * Check if payload has changed
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
      const coreMetrics = cyre.getMetrics(channelId)

      return {
        ...coreMetrics,
        middleware: {
          totalMiddleware: middlewareChain.middlewares.length,
          enabledMiddleware: middlewareChain.middlewares.filter(m => m.enabled)
            .length,
          executionCount: middlewareChain.executionCount,
          middlewares: middlewareChain.middlewares.map(m => ({
            id: m.id,
            enabled: m.enabled
          }))
        }
      }
    },

    /**
     * Get breathing state
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
     * Add unlimited middleware to channel
     */
    middleware: (middlewareFn: CyreMiddleware<TPayload>): void => {
      const middlewareId = `${channelId}-middleware-${++middlewareCounter}`

      debugLog(`Adding middleware: ${middlewareId}`)

      const middlewareEntry: ChannelMiddleware = {
        id: middlewareId,
        fn: middlewareFn,
        enabled: true
      }

      middlewareChain.middlewares.push(middlewareEntry)

      debugLog(`Middleware added. Total: ${middlewareChain.middlewares.length}`)
    },

    /**
     * Get subscription count
     */
    getSubscriptionCount: (): number => {
      return subscriptions.length
    }
  }

  // Add enhanced middleware management methods
  return {
    ...channel,

    /**
     * Enable/disable specific middleware
     */
    enableMiddleware: (middlewareId: string): boolean => {
      const middleware = middlewareChain.middlewares.find(
        m => m.id === middlewareId
      )
      if (middleware) {
        middleware.enabled = true
        debugLog(`Enabled middleware: ${middlewareId}`)
        return true
      }
      return false
    },

    disableMiddleware: (middlewareId: string): boolean => {
      const middleware = middlewareChain.middlewares.find(
        m => m.id === middlewareId
      )
      if (middleware) {
        middleware.enabled = false
        debugLog(`Disabled middleware: ${middlewareId}`)
        return true
      }
      return false
    },

    /**
     * Remove specific middleware
     */
    removeMiddleware: (middlewareId: string): boolean => {
      const index = middlewareChain.middlewares.findIndex(
        m => m.id === middlewareId
      )
      if (index >= 0) {
        middlewareChain.middlewares.splice(index, 1)
        debugLog(
          `Removed middleware: ${middlewareId}. Remaining: ${middlewareChain.middlewares.length}`
        )
        return true
      }
      return false
    },

    /**
     * Clear all middleware
     */
    clearMiddleware: (): void => {
      const count = middlewareChain.middlewares.length
      middlewareChain.middlewares.length = 0
      debugLog(`Cleared all middleware (${count} removed)`)
    },

    /**
     * Get middleware information
     */
    getMiddlewareInfo: () => ({
      total: middlewareChain.middlewares.length,
      enabled: middlewareChain.middlewares.filter(m => m.enabled).length,
      disabled: middlewareChain.middlewares.filter(m => !m.enabled).length,
      executionCount: middlewareChain.executionCount,
      middlewares: middlewareChain.middlewares.map(m => ({
        id: m.id,
        enabled: m.enabled
      }))
    }),

    /**
     * Add multiple middleware at once
     */
    addMiddleware: (middlewares: CyreMiddleware<TPayload>[]): string[] => {
      const addedIds: string[] = []

      middlewares.forEach(fn => {
        const middlewareId = `${channelId}-middleware-${++middlewareCounter}`

        const middlewareEntry: ChannelMiddleware = {
          id: middlewareId,
          fn,
          enabled: true
        }

        middlewareChain.middlewares.push(middlewareEntry)
        addedIds.push(middlewareId)
      })

      debugLog(
        `Added ${addedIds.length} middleware functions. Total: ${middlewareChain.middlewares.length}`
      )
      return addedIds
    }
  } as CyreHook<TPayload> & {
    enableMiddleware: (id: string) => boolean
    disableMiddleware: (id: string) => boolean
    removeMiddleware: (id: string) => boolean
    clearMiddleware: () => void
    getMiddlewareInfo: () => any
    addMiddleware: (middlewares: CyreMiddleware<TPayload>[]) => string[]
  }
}
