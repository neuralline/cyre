// src/hooks/use-cyre.ts
// Updated useCyre hook with perfect branch integration and fixed implementation

import type {IO, ActionPayload, CyreResponse, EventHandler} from '../types/core'
import type {Branch} from '../types/hooks'
import {cyre, CyreInstance} from '../app'
import {sensor} from '../components/sensor'

/**
 * Configuration for useCyre hook
 */
export interface UseCyreConfig {
  /** Local channel ID (will be prefixed with branch path if used with branch) */
  channelId: string
  /** Initial payload for the channel */
  payload?: ActionPayload
  /** Channel name for debugging/display */
  name?: string
  /** Channel configuration (throttle, debounce, etc.) */
  config?: Partial<IO>
}

/**
 * Return type for useCyre hook
 */
export interface CyreHook {
  /** Branch path (empty string for root) */
  path: string
  /** Call the channel */
  call: (payload?: ActionPayload) => Promise<CyreResponse>
  /** Set up handler for the channel */
  on: (handler: EventHandler) => {
    ok: boolean
    message: string
    unsubscribe?: () => boolean
  }

  /** Get current channel configuration */
  get: () => IO | undefined
  /** Remove the channel */
  forget: () => boolean

  /** Get channel statistics */
  getStats: () => {
    globalId: string
    localId: string
    path: string
    isBranch: boolean
    depth: number
    created: boolean
    subscribed: boolean
  }
}

/**
 * Perfect useCyre hook that works seamlessly with both main cyre and branches
 *
 * @param instance - Required branch or cyre instance
 * @param config - Optional channel configuration
 * @returns CyreHook interface for channel operations
 */
export const useCyre = (
  instance: CyreInstance | Branch,
  config?: IO
): CyreHook => {
  // VALIDATION: Required instance check
  if (!instance) {
    sensor.error(
      'useCyre requires a valid instance parameter',
      'use-cyre',
      'validation',
      'error'
    )
    throw new Error('useCyre requires a valid instance parameter')
  }

  // VALIDATION: Instance must have required methods
  if (
    typeof instance.path !== 'function' ||
    typeof instance.action !== 'function'
  ) {
    sensor.error(
      'Invalid instance - missing required methods (path, action)',
      'use-cyre',
      'validation',
      'error'
    )
    throw new Error('Invalid instance - missing required methods')
  }

  // Define path, localId, and channelId early for consistent use
  const path = instance.path() || ''
  const localId = config?.id || `hook-${crypto.randomUUID().slice(0, 8)}`
  const channelId = path ? `${path}/${localId}` : localId

  // Determine if we're working with a branch
  const isBranch =
    instance && typeof (instance as Branch).path === 'function' && path !== ''

  // Create channel configuration using core cyre pattern
  // CRITICAL FIX: Pass localId as the action.id, not the full channelId
  // The instance.action() method will handle the path prefixing internally
  const channelConfig: IO = {
    ...config,
    id: localId, // ✅ Use localId - instance.action() will handle path prefixing
    localId, // Store original local ID
    payload: config?.payload || undefined,
    path
  }

  // Track creation and subscription state
  let isCreated = false
  let isSubscribed = false

  // Create the channel using appropriate method (follows handler-first pattern)
  const createChannel = (): boolean => {
    if (isCreated) return true

    try {
      let result: {ok: boolean; message: string}

      if (isBranch) {
        // Use branch.action() for branch instances
        result = (instance as Branch).action(channelConfig)
      } else {
        // Use cyre.action() for main cyre instances
        result = (instance as CyreInstance).action(channelConfig)
      }

      if (result.ok) {
        isCreated = true
        sensor.debug(
          `useCyre channel created: ${channelId}`,
          'use-cyre',
          localId,
          'success',
          {
            localId,
            channelId,
            path,
            isBranch
          }
        )
        return true
      } else {
        sensor.error(
          `useCyre channel creation failed: ${result.message}`,
          'use-cyre',
          localId,
          'error'
        )
        return false
      }
    } catch (error) {
      sensor.error(
        `useCyre channel creation error: ${error}`,
        'use-cyre',
        localId,
        'error'
      )
      return false
    }
  }

  // Build and return the hook interface
  const hook: CyreHook = {
    path,

    call: async (payload?: ActionPayload) => {
      if (!isCreated && !createChannel()) {
        return {
          ok: false,
          payload: null,
          message: 'Channel not created',
          error: 'Failed to create channel'
        }
      }

      try {
        // Use direct cyre.call() with channelId for maximum performance
        return await cyre.call(channelId, payload)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(
          `useCyre call failed: ${errorMessage}`,
          'use-cyre',
          localId,
          'error'
        )
        return {
          ok: false,
          payload: null,
          message: `Call failed: ${errorMessage}`,
          error: errorMessage
        }
      }
    },

    on: (handler: EventHandler) => {
      if (!isCreated && !createChannel()) {
        return {
          ok: false,
          message: 'Cannot subscribe - channel not created'
        }
      }

      try {
        // Use direct cyre.on() with channelId for maximum performance
        const result = cyre.on(channelId, handler)

        if (result.ok) {
          isSubscribed = true
          sensor.debug(
            `useCyre subscription created: ${channelId}`,
            'use-cyre',
            localId,
            'success'
          )
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(
          `useCyre subscription failed: ${errorMessage}`,
          'use-cyre',
          localId,
          'error'
        )
        return {
          ok: false,
          message: `Subscription failed: ${errorMessage}`
        }
      }
    },

    get: () => {
      try {
        // Use direct cyre.get() with channelId for maximum performance
        return cyre.get ? cyre.get(channelId) : undefined
      } catch (error) {
        sensor.error(
          `useCyre get failed: ${error}`,
          'use-cyre',
          localId,
          'error'
        )
        return undefined
      }
    },

    forget: () => {
      try {
        // Use direct cyre.forget() with channelId for maximum performance
        const success = cyre.forget(channelId)

        if (success) {
          isCreated = false
          isSubscribed = false
          sensor.debug(
            `useCyre channel forgotten: ${channelId}`,
            'use-cyre',
            localId,
            'success'
          )
        }

        return success
      } catch (error) {
        sensor.error(
          `useCyre forget failed: ${error}`,
          'use-cyre',
          localId,
          'error'
        )
        return false
      }
    },

    getStats: () => {
      const depth = path ? path.split('/').filter(Boolean).length : 0

      return {
        globalId: channelId,
        localId,
        path,
        isBranch: !!isBranch,
        depth,
        created: isCreated,
        subscribed: isSubscribed
      }
    }
  }

  return hook
}

export default useCyre
