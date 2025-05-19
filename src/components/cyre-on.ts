// src/components/cyre-on.ts
import {metricsState} from '../context/metrics-state'
import {MSG} from '../config/cyre-config'
import {subscribers} from '../context/state'
import {On, Subscriber, SubscriptionResponse} from '../interfaces/interface'
import {log} from './cyre-logger'

/* 

      C.Y.R.E. - O.N.


*/
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

// Validation functions
const validateSubscriber = (
  type: string,
  fn: (
    payload?: unknown
  ) => void | Promise<void> | {id: string; payload?: unknown}
): SubscriptionResult => {
  if (!type || typeof type !== 'string') {
    return {
      ok: false,
      message: MSG.CHANNEL_INVALID_TYPE,
      error: {
        code: 'INVALID_TYPE',
        message: `Type must be a non-empty string, received: ${type}`
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
    subscriber: {id: type.trim(), fn}
  }
}

const addSingleSubscriber = (
  type: string,
  fn: (
    payload?: unknown
  ) => void | Promise<void> | {id: string; payload?: unknown}
): SubscriptionResponse => {
  try {
    const validation = validateSubscriber(type, fn)
    if (!validation.ok || !validation.subscriber) {
      log.error(validation.error || validation.message)
      return {
        ok: false,
        message: validation.message
      }
    }

    const {subscriber} = validation

    // Enhanced duplicate subscriber detection
    const existing = subscribers.get(subscriber.id)
    if (existing) {
      // Add more prominent warning with both CyreLog and console.warn
      const duplicateMessage = `DUPLICATE LISTENER DETECTED: Channel "${subscriber.id}" already has a listener attached!`

      // Use warning level instead of just info
      log.warn(duplicateMessage)

      // Also log directly to console for better visibility during development
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`🔥 ${duplicateMessage}`)
        console.warn(
          'This may cause unexpected behavior if the previous listener is still active.'
        )
        console.warn(
          'Consider using cyre.forget() to remove previous listeners before adding new ones.'
        )
      }
    }

    // Add or update subscriber
    subscribers.add(subscriber)

    log.info(`${MSG.SUBSCRIPTION_SUCCESS_SINGLE}: ${subscriber.id}`)
    return {
      ok: true,
      message: `${MSG.SUBSCRIPTION_SUCCESS_SINGLE}: ${subscriber.id}`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to add subscriber: ${errorMessage}`)
    return {
      ok: false,
      message: MSG.SUBSCRIPTION_FAILED
    }
  }
}

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

    return {
      ok: true,
      message: `Successfully added ${successCount} out of ${totalCount} subscribers`
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
 * Enhanced subscribe function with better error handling and validation
 */
export const subscribe: On = (
  type: string | Subscriber[],
  fn?: (
    payload?: unknown
  ) => void | Promise<void> | {id: string; payload?: unknown}
): SubscriptionResponse => {
  //check if system new registry is locked
  if (metricsState.isSystemLocked()) {
    log.error(MSG.SYSTEM_LOCKED_SUBSCRIBERS)
    return {
      ok: false,
      message: MSG.SYSTEM_LOCKED_SUBSCRIBERS
    }
  }

  // Handle array of subscribers
  if (Array.isArray(type)) {
    const result = addMultipleSubscribers(type)
    // Add unsubscribe function for array case
    if (result.ok) {
      result.unsubscribe = () => {
        let allRemoved = true
        type.forEach(sub => {
          if (!subscribers.forget(sub.id)) {
            allRemoved = false
          }
        })
        return allRemoved
      }
    }
    return result
  }

  // Handle single subscriber
  if (typeof type === 'string' && fn) {
    const result = addSingleSubscriber(type, fn)
    // Add unsubscribe function for single case
    if (result.ok) {
      result.unsubscribe = () => subscribers.forget(type)
    }
    return result
  }

  log.error(MSG.SUBSCRIPTION_INVALID_PARAMS)
  return {
    ok: false,
    message: MSG.SUBSCRIPTION_INVALID_PARAMS
  }
}
