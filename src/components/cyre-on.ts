// src/components/cyre-on.ts
// Enhanced subscription system with pre-analysis and execution operator assignment

import {metricsState} from '../context/metrics-state'
import {MSG} from '../config/cyre-config'
import {subscribers, io} from '../context/state'
import type {
  EventHandler,
  ISubscriber,
  SubscriptionResponse,
  IO,
  ExecutionOperator
} from '../types/core'
import {sensor} from './sensor'

/* 

      C.Y.R.E - O.N
      
      Enhanced subscription system with pre-analysis and execution operator assignment:
      1. Subscribe to ACTION IDs, not types
      2. Pre-analyze execution strategy on registration
      3. Assign optimal execution operator based on handler count
      4. Store optimized configuration in io for hot path performance
      5. Multiple subscription handling with smart operator selection

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
  subscriber?: ISubscriber
}

// Smart execution operator selection logic
const determineExecutionOperator = (
  declaredDispatch: ExecutionOperator | undefined,
  handlerCount: number
): ExecutionOperator => {
  // SMART RULE: Always use single for one handler (override user declaration)
  if (handlerCount <= 1) {
    return 'single' // Maximum performance for single handler
  }

  // Multiple handlers - respect user preference or default to parallel
  switch (declaredDispatch) {
    case 'sequential':
    case 'waterfall':
      return 'sequential'
    case 'race':
      return 'race'
    case 'single':
      return 'parallel' // Upgrade single to parallel for multiple handlers
    case 'parallel':
    default:
      return 'parallel' // Default for multiple handlers
  }
}

// Pre-analyze and assign execution configuration
const preAnalyzeExecution = (action: IO, handlerCount: number): Partial<IO> => {
  const executionOperator = determineExecutionOperator(
    action.dispatch,
    handlerCount
  )

  // Pre-compile execution configuration for hot path
  const executionConfig: Partial<IO> = {
    _executionOperator: executionOperator,
    _handlerCount: handlerCount,
    _errorStrategy: action.errorStrategy || 'continue',
    _collectStrategy: action.collectResults || 'last',
    _dispatchTimeout: action.dispatchTimeout || 10000
  }

  // Performance optimizations based on execution operator
  if (executionOperator === 'single') {
    // Single handler - disable multi-handler specific settings
    executionConfig._errorStrategy = 'continue' // Not applicable
    executionConfig._collectStrategy = 'last' // Not applicable
    executionConfig._dispatchTimeout = undefined // Not applicable
  }

  return executionConfig
}

// Enhanced handler storage - now supports arrays
const handlerStorage = new Map<string, EventHandler[]>()

/**
 * Validate subscriber configuration
 */
const validateSubscriber = (
  id: string,
  handler: EventHandler
): SubscriptionResult => {
  if (!id || typeof id !== 'string') {
    return {
      ok: false,
      message: MSG.CHANNEL_INVALID_TYPE,
      error: {
        code: 'INVALID_ACTION_ID',
        message: `Action ID must be a non-empty string, received: ${id}`
      }
    }
  }

  if (typeof handler !== 'function') {
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
    subscriber: {id: id.trim(), handler: handler}
  }
}

/**
 * Add single subscriber with pre-analysis and execution operator assignment
 */
const addSingleSubscriber = (
  id: string,
  handler: EventHandler
): SubscriptionResponse => {
  try {
    const validation = validateSubscriber(id, handler)
    if (!validation.ok || !validation.subscriber) {
      sensor.error(validation.error || validation.message)
      return {
        ok: false,
        message: validation.message
      }
    }

    const {subscriber} = validation

    // Get or create handler array for this channel
    const existingHandlers = handlerStorage.get(subscriber.id) || []
    const newHandlerCount = existingHandlers.length + 1

    // Check for duplicate handlers
    if (existingHandlers.includes(handler)) {
      const duplicateMessage = `DUPLICATE HANDLER DETECTED: Identical handler already registered for channel "${subscriber.id}"`
      sensor.warn(duplicateMessage)
      sensor.warn(duplicateMessage)
      return {
        ok: false,
        message: 'Duplicate handler registration prevented'
      }
    }

    // Add new handler to array
    const updatedHandlers = [...existingHandlers, handler]
    handlerStorage.set(subscriber.id, updatedHandlers)

    // Get current action configuration
    const currentAction = io.get(subscriber.id)
    if (!currentAction) {
      sensor.error(
        `Action not found: ${subscriber.id}. Create action before subscribing.`
      )
      return {
        ok: false,
        message: `Action "${subscriber.id}" not found. Use cyre.action() first.`
      }
    }

    // PRE-ANALYZE: Determine optimal execution configuration
    const executionConfig = preAnalyzeExecution(currentAction, newHandlerCount)

    // Update action with optimized execution configuration
    const optimizedAction: IO = {
      ...currentAction,
      ...executionConfig
    }

    // Store optimized configuration for hot path access
    io.set(optimizedAction)

    // Update legacy subscribers map for backward compatibility
    // (We'll phase this out as we move to array-based storage)
    if (newHandlerCount === 1) {
      subscribers.add(subscriber)
    }

    // Update metrics
    // metricsState.addSubscriber(subscriber.id)

    // Log execution operator assignment for debugging
    // sensor.info(
    //   `Subscriber registered: ${subscriber.id} | ` +
    //     `Handlers: ${newHandlerCount} | ` +
    //     `Operator: ${executionConfig._executionOperator} | ` +
    //     `Strategy: ${executionConfig._errorStrategy}`
    // )

    return {
      ok: true,
      message: MSG.SUBSCRIPTION_SUCCESS_SINGLE,
      metadata: {
        handlerCount: newHandlerCount,
        executionOperator: executionConfig._executionOperator,
        errorStrategy: executionConfig._errorStrategy,
        optimized: true
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(`Subscription failed: ${errorMessage}`)
    sensor.error('subscription-error', errorMessage, 'cyre-on')

    return {
      ok: false,
      message: `Subscription failed: ${errorMessage}`
    }
  }
}

/**
 * Add multiple subscribers with batch pre-analysis
 */
const addMultipleSubscribers = (
  subscriptions: Array<{id: string; handler: EventHandler}>
): SubscriptionResponse => {
  const results: SubscriptionResponse[] = []

  try {
    for (const subscription of subscriptions) {
      const result = addSingleSubscriber(subscription.id, subscription.handler)
      results.push(result)
    }

    const successful = results.filter(r => r.ok).length
    const failed = results.length - successful

    return {
      ok: failed === 0,
      message:
        failed === 0
          ? MSG.SUBSCRIPTION_SUCCESS_MULTIPLE
          : `${successful}/${results.length} subscriptions successful`,
      metadata: {
        total: results.length,
        successful,
        failed,
        results
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(`Batch subscription failed: ${errorMessage}`)

    return {
      ok: false,
      message: `Batch subscription failed: ${errorMessage}`
    }
  }
}

/**
 * Get handlers for execution (used by dispatch)
 */
export const getHandlers = (actionId: string): EventHandler[] => {
  return handlerStorage.get(actionId) || []
}

/**
 * Remove handler and re-optimize execution strategy
 */
export const removeHandler = (
  actionId: string,
  handler: EventHandler
): boolean => {
  const handlers = handlerStorage.get(actionId)
  if (!handlers) return false

  const index = handlers.indexOf(handler)
  if (index === -1) return false

  // Remove handler
  const updatedHandlers = handlers.filter((_, i) => i !== index)

  if (updatedHandlers.length === 0) {
    handlerStorage.delete(actionId)
  } else {
    handlerStorage.set(actionId, updatedHandlers)
  }

  // Re-optimize execution configuration
  const currentAction = io.get(actionId)
  if (currentAction) {
    const executionConfig = preAnalyzeExecution(
      currentAction,
      updatedHandlers.length
    )
    io.set({...currentAction, ...executionConfig})
  }

  return true
}

/**
 * Get handler statistics for debugging
 */
export const getHandlerStats = (actionId?: string) => {
  if (actionId) {
    const handlers = handlerStorage.get(actionId) || []
    const action = io.get(actionId)
    return {
      actionId,
      handlerCount: handlers.length,
      executionOperator: action?._executionOperator,
      errorStrategy: action?._errorStrategy,
      collectStrategy: action?._collectStrategy
    }
  }

  // Return stats for all actions
  const stats = Array.from(handlerStorage.entries()).map(([id, handlers]) => {
    const action = io.get(id)
    return {
      actionId: id,
      handlerCount: handlers.length,
      executionOperator: action?._executionOperator,
      errorStrategy: action?._errorStrategy,
      collectStrategy: action?._collectStrategy
    }
  })

  return {
    totalChannels: stats.length,
    totalHandlers: stats.reduce((sum, s) => sum + s.handlerCount, 0),
    channels: stats
  }
}

/**
 * Main subscription function with intelligent routing
 */
export const subscribe = (
  idOrSubscriptions: string | Array<{id: string; handler: EventHandler}>,
  handler?: EventHandler
): SubscriptionResponse => {
  // HOT PATH OPTIMIZATION: Check system state before processing

  const {allowed, messages} = metricsState.canRegister()
  if (!allowed) {
    sensor.error(messages.join(', '))
    return {
      ok: false,
      message: messages.join(', ')
    }
  }

  // Handle array of subscriptions
  if (Array.isArray(idOrSubscriptions)) {
    return addMultipleSubscribers(idOrSubscriptions)
  }

  // Handle single subscription
  if (typeof idOrSubscriptions === 'string' && handler) {
    return addSingleSubscriber(idOrSubscriptions, handler)
  }

  return {
    ok: false,
    message: 'Invalid subscription parameters',
    metadata: {}
  }
}

// Export for external use

export default subscribe
