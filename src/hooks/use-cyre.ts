// src/hooks/use-cyre.ts
// Beautiful simple single channel management
// Instance-agnostic - works with any cyre-like object

import type {IO, EventHandler, ActionPayload} from '../types/core'
import type {CyreInstance, UseCyreConfig, CyreChannel} from '../types/hooks'
import {cyre} from '../app'
import {sensor} from '../metrics'

/**
 * Beautiful simple single channel management
 * Works with any cyre-like instance - main cyre, branches, anything!
 */

export function useCyre<TPayload = ActionPayload>(
  configOrId: string | UseCyreConfig<TPayload>,
  configOrInstance?: UseCyreConfig<TPayload> | CyreInstance,
  instance?: CyreInstance
): CyreChannel<TPayload> {
  let finalConfig: UseCyreConfig<TPayload>
  let targetInstance: CyreInstance
  let channelId: string

  // Handle overloaded parameters
  if (typeof configOrId === 'string') {
    channelId = configOrId

    if (configOrInstance && 'action' in configOrInstance) {
      // useCyre(id, instance) - config is empty
      finalConfig = {}
      targetInstance = configOrInstance as CyreInstance
    } else {
      // useCyre(id, config) or useCyre(id, config, instance)
      finalConfig = (configOrInstance as UseCyreConfig<TPayload>) || {}
      targetInstance = instance || cyre
    }
  } else {
    // useCyre(config) or useCyre(config, instance)
    finalConfig = configOrId
    channelId =
      finalConfig.channelId ||
      finalConfig.name ||
      `channel-${crypto.randomUUID().slice(0, 8)}`

    if (configOrInstance && 'action' in configOrInstance) {
      targetInstance = configOrInstance as CyreInstance
    } else {
      targetInstance = cyre // Default to main cyre
    }
  }

  const channelName = finalConfig.name || channelId

  sensor.log(channelId, 'info', 'useCyre-creating', {
    channelId,
    channelName,
    hasThrottle: !!finalConfig.throttle,
    hasDebounce: !!finalConfig.debounce,
    hasTalents: !!(
      finalConfig.schema ||
      finalConfig.condition ||
      finalConfig.transform ||
      finalConfig.selector
    )
  })

  // Build core action config - clean and simple
  const actionConfig: IO = {
    id: channelId,

    // Core system properties (direct, not nested)
    ...(finalConfig.throttle !== undefined && {throttle: finalConfig.throttle}),
    ...(finalConfig.debounce !== undefined && {debounce: finalConfig.debounce}),
    ...(finalConfig.maxWait !== undefined && {maxWait: finalConfig.maxWait}),
    ...(finalConfig.detectChanges !== undefined && {
      detectChanges: finalConfig.detectChanges
    }),
    ...(finalConfig.delay !== undefined && {delay: finalConfig.delay}),
    ...(finalConfig.interval !== undefined && {interval: finalConfig.interval}),
    ...(finalConfig.repeat !== undefined && {repeat: finalConfig.repeat}),
    ...(finalConfig.priority !== undefined && {priority: finalConfig.priority}),
    ...(finalConfig.required !== undefined && {required: finalConfig.required}),
    ...(finalConfig.block !== undefined && {block: finalConfig.block}),
    ...(finalConfig.path !== undefined && {path: finalConfig.path}),
    ...(finalConfig.schema !== undefined && {schema: finalConfig.schema}),
    ...(finalConfig.condition !== undefined && {
      condition: finalConfig.condition
    }),
    ...(finalConfig.transform !== undefined && {
      transform: finalConfig.transform
    }),
    ...(finalConfig.selector !== undefined && {selector: finalConfig.selector}),
    ...(finalConfig.initialPayload !== undefined && {
      payload: finalConfig.initialPayload
    })
  }

  // Register with the provided instance (whatever it is!)
  const registrationResult = targetInstance.action(actionConfig)

  if (!registrationResult.ok) {
    const error = `Failed to create channel: ${registrationResult.message}`
    sensor.error(channelId, error, 'useCyre-registration-failed')
    throw new Error(error)
  }

  sensor.log(channelId, 'success', 'useCyre-created', {
    channelId,
    channelName,
    message: registrationResult.message
  })

  // Build simple channel interface
  const channel: CyreChannel<TPayload> = {
    id: channelId,
    name: channelName,

    on: (handler: EventHandler) => {
      try {
        // Use the same instance for everything!
        const subscription = targetInstance.on(channelId, handler)

        sensor.log(
          channelId,
          subscription.ok ? 'success' : 'error',
          'useCyre-subscription',
          {
            channelName,
            success: subscription.ok,
            message: subscription.message
          }
        )

        return {
          ...subscription,
          unsubscribe: () => {
            const result = targetInstance.forget(channelId)

            sensor.log(channelId, 'info', 'useCyre-unsubscribe', {
              channelName,
              success: result
            })

            return result
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(channelId, errorMessage, 'useCyre-subscription-error')

        return {
          ok: false,
          message: `Subscription failed: ${errorMessage}`,
          unsubscribe: () => false
        }
      }
    },

    call: async (payload?: TPayload) => {
      try {
        sensor.log(channelId, 'call', 'useCyre-calling', {
          channelName,
          hasPayload: payload !== undefined
        })

        // Use the same instance for everything!
        const result = await targetInstance.call(channelId, payload)

        sensor.log(
          channelId,
          result.ok ? 'success' : 'error',
          'useCyre-call-complete',
          {
            channelName,
            success: result.ok,
            message: result.message
          }
        )

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(channelId, errorMessage, 'useCyre-call-error')

        return {
          ok: false,
          payload: null,
          message: `Call failed: ${errorMessage}`,
          error: errorMessage
        }
      }
    },

    update: (newConfig: Partial<UseCyreConfig<TPayload>>) => {
      try {
        // Merge configurations
        const updatedConfig = {...finalConfig, ...newConfig}

        // Build new action config
        const newActionConfig: IO = {
          id: channelId,
          ...(updatedConfig.throttle !== undefined && {
            throttle: updatedConfig.throttle
          }),
          ...(updatedConfig.debounce !== undefined && {
            debounce: updatedConfig.debounce
          }),
          ...(updatedConfig.maxWait !== undefined && {
            maxWait: updatedConfig.maxWait
          }),
          ...(updatedConfig.detectChanges !== undefined && {
            detectChanges: updatedConfig.detectChanges
          }),
          ...(updatedConfig.delay !== undefined && {
            delay: updatedConfig.delay
          }),
          ...(updatedConfig.interval !== undefined && {
            interval: updatedConfig.interval
          }),
          ...(updatedConfig.repeat !== undefined && {
            repeat: updatedConfig.repeat
          }),
          ...(updatedConfig.priority !== undefined && {
            priority: updatedConfig.priority
          }),
          ...(updatedConfig.required !== undefined && {
            required: updatedConfig.required
          }),
          ...(updatedConfig.block !== undefined && {
            block: updatedConfig.block
          }),
          ...(updatedConfig.path !== undefined && {path: updatedConfig.path}),
          ...(updatedConfig.schema !== undefined && {
            schema: updatedConfig.schema
          }),
          ...(updatedConfig.condition !== undefined && {
            condition: updatedConfig.condition
          }),
          ...(updatedConfig.transform !== undefined && {
            transform: updatedConfig.transform
          }),
          ...(updatedConfig.selector !== undefined && {
            selector: updatedConfig.selector
          })
        }

        // Update with the same instance!
        const updateResult = targetInstance.action(newActionConfig)

        if (updateResult.ok) {
          finalConfig = updatedConfig
          sensor.log(channelId, 'success', 'useCyre-updated', {
            channelName,
            updatedFields: Object.keys(newConfig)
          })
        } else {
          sensor.error(channelId, updateResult.message, 'useCyre-update-failed')
        }

        return updateResult
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(channelId, errorMessage, 'useCyre-update-error')

        return {
          ok: false,
          message: `Update failed: ${errorMessage}`
        }
      }
    },

    get: () => {
      try {
        // Use the same instance!
        return targetInstance.get ? targetInstance.get(channelId) : undefined
      } catch (error) {
        sensor.error(channelId, String(error), 'useCyre-get-error')
        return undefined
      }
    },

    forget: () => {
      try {
        // Use the same instance!
        const result = targetInstance.forget(channelId)

        if (result) {
          sensor.log(channelId, 'info', 'useCyre-destroyed', {
            channelName
          })
        }

        return result
      } catch (error) {
        sensor.error(channelId, String(error), 'useCyre-destroy-error')
        return false
      }
    }
  }

  return channel
}

// Export types
export type {UseCyreConfig, CyreChannel, CyreInstance}
