// src/components/cyre-on-fixed.ts

import {metricsState} from '../context/metrics-state'
import {MSG} from '../config/cyre-config'
import {subscribers} from '../context/state'
import type {EventHandler, SubscriptionResponse} from '../types/interface'
import {log} from './cyre-log'

/* 

      C.Y.R.E - O.N
      
      Fixed subscription system that works with optimized pipeline:
      1. Subscribe to ACTION IDs, not types
      2. Proper integration with pipeline execution
      3. Chain reaction support
      4. Multiple subscription handling

*/

interface Subscriber {
  id: string
  fn: EventHandler
}

interface SubscriptionError {
  code: string
  message: string
  details?: unknown
}

type SubscriptionResult = {
  ok: boolean
  message: string
  error?: SubscriptionError
  subscriber?: Subscriber
}

/**
 * Validate subscriber configuration
 */
const validateSubscriber = (
  actionId: string,
  fn: EventHandler
): SubscriptionResult => {
  if (!actionId || typeof actionId !== 'string') {
    return {
      ok: false,
      message: MSG.CHANNEL_INVALID_TYPE,
      error: {
        code: 'INVALID_ACTION_ID',
        message: `Action ID must be a non-empty string, received: ${actionId}`
      }
    }
  }

  if (typeof fn !== 'function') {
    return {
      ok: false,
      message: MSG.SUBSCRIPTION_INVALID_HANDLER,
      error: {
        code: 'INVALID_HANDLER',
        message: 'Event handler must be a function'
      }
    }
  }

  return {
    ok: true,
    message: MSG.SUBSCRIPTION_SUCCESS_SINGLE,
    subscriber: {id: actionId.trim(), fn}
  }
}

/**
 * Add single subscriber with proper validation
 */
const addSingleSubscriber = (
  actionId: string,
  fn: EventHandler
): SubscriptionResponse => {
  try {
    const validation = validateSubscriber(actionId, fn)
    if (!validation.ok || !validation.subscriber) {
      log.error(validation.error || validation.message)
      return {
        ok: false,
        message: validation.message
      }
    }

    const {subscriber} = validation

    // Check for existing subscriber
    const existing = subscribers.get(subscriber.id)
    if (existing) {
      const duplicateMessage = `DUPLICATE LISTENER DETECTED: Channel "${subscriber.id}" already has a listener attached!`
      log.warn(duplicateMessage)
      console.warn(duplicateMessage)
      console.warn(
        'This may cause unexpected behavior if the previous listener is still active. Consider using cyre.forget() to remove previous listeners before adding new ones.'
      )
    }

    // Add or update subscriber
    subscribers.add(subscriber)

    const successMessage = `${MSG.SUBSCRIPTION_SUCCESS_SINGLE}: ${subscriber.id}`
    log.debug(successMessage)

    return {
      ok: true,
      message: successMessage,
      unsubscribe: () => {
        const removed = subscribers.forget(subscriber.id)
        if (removed) {
          log.debug(`Unsubscribed from ${subscriber.id}`)
        }
        return removed
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`${MSG.SUBSCRIPTION_FAILED}: ${errorMessage}`)
    return {
      ok: false,
      message: MSG.SUBSCRIPTION_FAILED
    }
  }
}

/**
 * Add multiple subscribers
 */
const addMultipleSubscribers = (
  subscriberList: Subscriber[]
): SubscriptionResponse => {
  try {
    const results = subscriberList.map(subscriber => {
      if (!subscriber.id || !subscriber.fn) {
        log.error(`Invalid subscriber format: ${JSON.stringify(subscriber)}`)
        return false
      }

      try {
        subscribers.add(subscriber)
        return true
      } catch (error) {
        log.error(`Failed to add subscriber ${subscriber.id}: ${error}`)
        return false
      }
    })

    const successCount = results.filter(Boolean).length
    const totalCount = subscriberList.length

    if (successCount === 0) {
      return {
        ok: false,
        message: `Failed to add any subscribers out of ${totalCount}`
      }
    }

    const message = `Successfully added ${successCount} out of ${totalCount} subscribers`
    return {
      ok: true,
      message,
      unsubscribe: () => {
        let allRemoved = true
        subscriberList.forEach(sub => {
          if (!subscribers.forget(sub.id)) {
            allRemoved = false
          }
        })
        return allRemoved
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Batch subscription failed: ${errorMessage}`)
    return {
      ok: false,
      message: MSG.SUBSCRIPTION_FAILED
    }
  }
}

/**
 * FIXED: Enhanced subscribe function with better integration
 */
export const subscribe = (
  actionIdOrList: string | Subscriber[],
  fn?: EventHandler
): SubscriptionResponse => {
  // Check if system is locked
  if (metricsState.isSystemLocked()) {
    log.error(MSG.SYSTEM_LOCKED_SUBSCRIBERS)
    return {
      ok: false,
      message: MSG.SYSTEM_LOCKED_SUBSCRIBERS
    }
  }

  // Handle array of subscribers
  if (Array.isArray(actionIdOrList)) {
    const result = addMultipleSubscribers(actionIdOrList)
    return result
  }

  // Handle single subscriber - CRITICAL: Use action ID, not type
  if (typeof actionIdOrList === 'string' && fn) {
    const result = addSingleSubscriber(actionIdOrList, fn)
    return result
  }

  // Invalid parameters
  log.error(MSG.SUBSCRIPTION_INVALID_PARAMS)
  return {
    ok: false,
    message: MSG.SUBSCRIPTION_INVALID_PARAMS
  }
}

/**
 * Get subscriber by action ID (for pipeline integration)
 */
export const getSubscriber = (actionId: string): Subscriber | undefined => {
  return subscribers.get(actionId)
}

/**
 * Check if subscriber exists for action ID
 */
export const hasSubscriber = (actionId: string): boolean => {
  return subscribers.get(actionId) !== undefined
}

/**
 * Remove subscriber by action ID
 */
export const removeSubscriber = (actionId: string): boolean => {
  const removed = subscribers.forget(actionId)
  if (removed) {
    log.debug(`Removed subscriber for ${actionId}`)
  }
  return removed
}

/**
 * Get all active subscribers
 */
export const getAllSubscribers = (): Subscriber[] => {
  return subscribers.getAll()
}

/**
 * Clear all subscribers
 */
export const clearAllSubscribers = (): void => {
  subscribers.clear()
  log.debug('Cleared all subscribers')
}

// Export the main subscribe function as default
export default subscribe
