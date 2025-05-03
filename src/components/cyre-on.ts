// src/components/cyre-on.ts
import {MSG} from '../config/cyre-config'
import {subscribers} from '../context/state'
import {On, Subscriber, SubscriptionResponse, IO} from '../interfaces/interface'
import {CyreLog} from './cyre-logger'

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
      CyreLog.error(validation.error || validation.message)
      return {
        ok: false,
        message: validation.message
      }
    }

    const {subscriber} = validation

    // Check for existing subscriber
    const existing = subscribers.get(subscriber.id)
    if (existing) {
      CyreLog.info(`${subscriber.id}: ${MSG.SUBSCRIPTION_EXISTS}`)
    }

    // Add or update subscriber
    subscribers.add(subscriber)

    CyreLog.info(`${MSG.SUBSCRIPTION_SUCCESS_SINGLE}: ${subscriber.id}`)
    return {
      ok: true,
      message: `${MSG.SUBSCRIPTION_SUCCESS_SINGLE}: ${subscriber.id}`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    CyreLog.error(`Failed to add subscriber: ${errorMessage}`)
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
        CyreLog.error(
          `Invalid subscriber format: ${JSON.stringify(subscriber)}`
        )
        return false
      }

      try {
        subscribers.add(subscriber)
        return true
      } catch (error) {
        CyreLog.error(`Failed to add subscriber ${subscriber.id}: ${error}`)
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
    CyreLog.error(`Batch subscription failed: ${errorMessage}`)
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
  // Handle array of subscribers
  if (Array.isArray(type)) {
    return addMultipleSubscribers(type)
  }

  // Handle single subscriber
  if (typeof type === 'string' && fn) {
    return addSingleSubscriber(type, fn)
  }

  CyreLog.error(MSG.SUBSCRIPTION_INVALID_PARAMS)
  return {
    ok: false,
    message: MSG.SUBSCRIPTION_INVALID_PARAMS
  }
}
