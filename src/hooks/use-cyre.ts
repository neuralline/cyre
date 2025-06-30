// src/hooks/use-cyre.ts
// Updated useCyre hook with perfect branch integration

import type {IO, ActionPayload, CyreResponse, EventHandler} from '../types/core'
import type {Branch, CyreInstance} from '../types/hooks'
import {cyre} from '../app'
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
  /** Local channel ID */
  id: string
  /** Global channel ID (includes path prefix if on branch) */
  globalId: string
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
  /** Check if channel exists */
  exists: () => boolean
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
 * @param config - Channel configuration
 * @param instance - Optional branch or cyre instance (defaults to main cyre)
 * @returns CyreHook interface for channel operations
 */
export const useCyre = (
  config: UseCyreConfig,
  instance?: CyreInstance | Branch
): CyreHook => {
  // Validate config
  if (!config.channelId) {
    throw new Error('useCyre requires a channelId in config')
  }

  // Determine if we're working with a branch or main cyre
  const isBranch = instance && typeof (instance as Branch).path === 'function'
  const isMainCyre = !instance || instance === cyre
  const targetInstance = instance || cyre

  // Get path information
  let path: string = ''
  let globalChannelId: string = config.channelId

  if (isBranch) {
    // ✅ BRANCH MODE: Use branch path + local ID
    const branch = instance as Branch
    path = branch.path()
    globalChannelId = path ? `${path}/${config.channelId}` : config.channelId
  } else if (isMainCyre) {
    // ✅ ROOT MODE: Use local ID as global ID
    path = ''
    globalChannelId = config.channelId
  } else {
    // ✅ CYRE INSTANCE MODE: Use instance path if available
    const cyreInstance = instance as CyreInstance
    if (typeof cyreInstance.path === 'function') {
      path = cyreInstance.path()
      globalChannelId = path ? `${path}/${config.channelId}` : config.channelId
    }
  }

  // Create channel configuration
  const channelConfig: IO = {
    id: config.channelId, // Local ID for branch operations
    payload: config.payload,
    ...config.config,
    // Preserve any existing tags and add useCyre metadata
    tags: [
      ...(config.config?.tags || []),
      'use-cyre',
      `local-id:${config.channelId}`,
      `global-id:${globalChannelId}`,
      ...(path ? [`branch-path:${path}`] : ['root-channel'])
    ]
  }

  // Track creation state
  let isCreated = false
  let isSubscribed = false

  // Create the channel using appropriate method
  const createChannel = (): boolean => {
    if (isCreated) return true

    try {
      let result: {ok: boolean; message: string}

      if (isBranch) {
        // ✅ Use branch.action() for branch instances
        result = (targetInstance as Branch).action(channelConfig)
      } else {
        // ✅ Use cyre.action() for main cyre or other instances
        result = (targetInstance as CyreInstance).action(channelConfig)
      }

      if (result.ok) {
        isCreated = true
        sensor.debug(
          `useCyre channel created: ${globalChannelId}`,
          'use-cyre',
          config.channelId,
          'success',
          {
            localId: config.channelId,
            globalId: globalChannelId,
            path,
            isBranch
          }
        )
        return true
      } else {
        sensor.error(
          `useCyre channel creation failed: ${result.message}`,
          'use-cyre',
          config.channelId,
          'error'
        )
        return false
      }
    } catch (error) {
      sensor.error(
        `useCyre channel creation error: ${error}`,
        'use-cyre',
        config.channelId,
        'error'
      )
      return false
    }
  }

  // Auto-create channel on first access
  createChannel()

  // Build and return the hook interface
  const hook: CyreHook = {
    id: config.channelId,
    globalId: globalChannelId,
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
        if (isBranch) {
          // ✅ Use branch.call() for branch instances
          return await (targetInstance as Branch).call(
            config.channelId,
            payload
          )
        } else {
          // ✅ Use cyre.call() for main cyre (with global ID)
          return await (targetInstance as CyreInstance).call(
            globalChannelId,
            payload
          )
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(
          `useCyre call failed: ${errorMessage}`,
          'use-cyre',
          config.channelId,
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
        let result: {ok: boolean; message: string; unsubscribe?: () => boolean}

        if (isBranch) {
          // ✅ Use branch.on() for branch instances
          result = (targetInstance as Branch).on(config.channelId, handler)
        } else {
          // ✅ Use cyre.on() for main cyre (with global ID)
          result = (targetInstance as CyreInstance).on(globalChannelId, handler)
        }

        if (result.ok) {
          isSubscribed = true
          sensor.debug(
            `useCyre subscription created: ${globalChannelId}`,
            'use-cyre',
            config.channelId,
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
          config.channelId,
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
        if (isBranch) {
          // ✅ Use branch.get() for branch instances
          return (targetInstance as Branch).get(config.channelId)
        } else {
          // ✅ Use cyre.get() for main cyre (with global ID)
          return (targetInstance as CyreInstance).get
            ? (targetInstance as CyreInstance).get!(globalChannelId)
            : undefined
        }
      } catch (error) {
        sensor.error(
          `useCyre get failed: ${error}`,
          'use-cyre',
          config.channelId,
          'error'
        )
        return undefined
      }
    },

    forget: () => {
      try {
        let success = false

        if (isBranch) {
          // ✅ Use branch.forget() for branch instances
          success = (targetInstance as Branch).forget(config.channelId)
        } else {
          // ✅ Use cyre.forget() for main cyre (with global ID)
          success = (targetInstance as CyreInstance).forget(globalChannelId)
        }

        if (success) {
          isCreated = false
          isSubscribed = false
          sensor.debug(
            `useCyre channel forgotten: ${globalChannelId}`,
            'use-cyre',
            config.channelId,
            'success'
          )
        }

        return success
      } catch (error) {
        sensor.error(
          `useCyre forget failed: ${error}`,
          'use-cyre',
          config.channelId,
          'error'
        )
        return false
      }
    },

    exists: () => {
      return isCreated && !!hook.get()
    },

    getStats: () => {
      const depth = path ? path.split('/').filter(Boolean).length : 0

      return {
        globalId: globalChannelId,
        localId: config.channelId,
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

// ============================================
// CONVENIENCE FACTORIES
// ============================================

/**
 * Create useCyre hook for main cyre instance
 */
export const useMainCyre = (config: UseCyreConfig): CyreHook => {
  return useCyre(config, cyre)
}

/**
 * Create useCyre hook with automatic subscription
 */
export const useCyreWithHandler = (
  config: UseCyreConfig,
  handler: EventHandler,
  instance?: CyreInstance | Branch
): CyreHook => {
  const hook = useCyre(config, instance)

  // Auto-subscribe
  const subscriptionResult = hook.on(handler)

  if (!subscriptionResult.ok) {
    sensor.warn(
      `Auto-subscription failed for ${hook.globalId}: ${subscriptionResult.message}`,
      'use-cyre',
      config.channelId,
      'warning'
    )
  }

  return hook
}

/**
 * Create multiple useCyre hooks at once
 */
export const useMultipleCyre = (
  configs: UseCyreConfig[],
  instance?: CyreInstance | Branch
): CyreHook[] => {
  return configs.map(config => useCyre(config, instance))
}

// ============================================
// TYPE EXPORTS
// ============================================

export default useCyre
