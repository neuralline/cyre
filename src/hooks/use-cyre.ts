// src/hooks/use-cyre.ts
// Updated useCyre hook with perfect branch integration, fixed implementation, and generic payload/response typing

import type {IO, ActionPayload, CyreResponse, EventHandler} from '../types/core'
import type {Branch} from '../types/hooks'
import {cyre, CyreInstance} from '../app'
import {io} from '../context/state'
import {sensor} from '../components/sensor'

/**
 * Configuration for useCyre hook
 *
 * This is exactly the IO channel config useCyre forwards to
 * instance.action() - the same object you'd pass to cyre.action() directly
 * (id, throttle, debounce, schema, etc.), including `payload` for an
 * initial value. Named separately from IO so callers have a
 * hook-specific type to import without pulling in IO's full surface.
 */
export type UseCyreConfig = IO

/**
 * Return type for useCyre hook
 *
 * TPayload - what `.call()` sends and what `.on()`'s handler receives.
 * TResponse - what `.call()` resolves with (as `CyreResponse<TResponse>.payload`)
 * and what `.on()`'s handler must return. Both default to `ActionPayload`
 * (i.e. `any`) so existing untyped call sites keep compiling unchanged -
 * pass explicit type arguments to `useCyre<TPayload, TResponse>(...)` to
 * opt into full type safety for a given channel.
 */
export interface CyreHook<TPayload = ActionPayload, TResponse = TPayload> {
  /** Branch path (empty string for root) */
  path: string
  /** Call the channel */
  call: (payload?: TPayload) => Promise<CyreResponse<TResponse>>
  /** Set up handler for the channel */
  on: (
    handler: (payload: TPayload) => TResponse | Promise<TResponse>
  ) => {
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
 *
 * @example
 * // Untyped (default) - behaves exactly as before
 * const channel = useCyre(cyre, {id: 'user-profile'})
 *
 * @example
 * // Typed - TPayload is what .call() accepts and .on() receives,
 * // TResponse is what .call() resolves with and .on() must return
 * const userChannel = useCyre<{userId: string}, {name: string; email: string}>(
 *   cyre,
 *   {id: 'user-profile'}
 * )
 *
 * userChannel.on(payload => {
 *   // payload: {userId: string}
 *   return {name: 'Jane', email: 'jane@x.com'} // must satisfy TResponse
 * })
 *
 * const res = await userChannel.call({userId: '123'})
 * // res.payload: {name: string; email: string}
 */
export const useCyre = <TPayload = ActionPayload, TResponse = TPayload>(
  instance: CyreInstance | Branch,
  config?: UseCyreConfig
): CyreHook<TPayload, TResponse> => {
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
  // How many handlers THIS hook currently has attached, so a partial
  // unsubscribe() (see on() below) can tell whether isSubscribed should
  // flip back to false or stay true because another handler remains.
  let handlerCount = 0

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
  const hook: CyreHook<TPayload, TResponse> = {
    path,

    call: async (payload?: TPayload) => {
      if (!isCreated && !createChannel()) {
        return {
          ok: false,
          payload: null,
          message: 'Channel not created',
          error: 'Failed to create channel'
        } as CyreResponse<TResponse>
      }

      try {
        // Use direct cyre.call() with channelId for maximum performance
        return (await cyre.call(channelId, payload)) as CyreResponse<TResponse>
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
        } as CyreResponse<TResponse>
      }
    },

    on: (handler: (payload: TPayload) => TResponse | Promise<TResponse>) => {
      if (!isCreated && !createChannel()) {
        return {
          ok: false,
          message: 'Cannot subscribe - channel not created'
        }
      }

      try {
        // Use direct cyre.on() with channelId for maximum performance
        const result = cyre.on(channelId, handler as EventHandler)

        if (result.ok) {
          handlerCount++
          isSubscribed = true
          sensor.debug(
            `useCyre subscription created: ${channelId}`,
            'use-cyre',
            localId,
            'success'
          )

          // cyre.on() already returns a real unsubscribe bound to this
          // exact (channelId, handler) pair (see cyre-on.ts's
          // addSingleSubscriber/removeHandler). Wrap it so THIS hook's own
          // isSubscribed/getStats().subscribed stay accurate if the caller
          // unsubscribes through the value on() just returned, rather than
          // only via forget() - without this, isSubscribed would latch
          // true forever the moment any handler was ever attached.
          const rawUnsubscribe = result.unsubscribe
          if (rawUnsubscribe) {
            result.unsubscribe = () => {
              const removed = rawUnsubscribe()
              if (removed) {
                handlerCount = Math.max(0, handlerCount - 1)
                isSubscribed = handlerCount > 0
              }
              return removed
            }
          }
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
        // Channel CONFIG lives in the io store, not payload state - cyre.get()
        // returns {req, prevReq, res, metadata} (the request/response record),
        // never the IO config this hook promises. Go straight to io.get()
        // instead of through cyre.get() (see context/state.ts's own note on
        // this exact distinction).
        return io.get(channelId)
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
          handlerCount = 0
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
