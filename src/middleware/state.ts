// src/middleware/state.ts
// Updated to include built-in debounce middleware

import {createStore} from '../context/create-store'
import type {
  IO,
  ActionPayload,
  MiddlewareEntry,
  MiddlewareChain,
  ChainExecutionResult,
  ExternalMiddlewareFunction,
  BuiltinMiddlewareFunction,
  InternalMiddlewareContext
} from '../types/interface'
import {log} from '../components/cyre-log'
import {metricsReport} from '../context/metrics-report'
import {io} from '../context/state'
import {metricsState} from '../context/metrics-state'
import TimeKeeper from '../components/cyre-timekeeper'
import {useDispatch} from '../components/cyre-dispatch'
import {BuiltinMiddlewareId} from './../types/middleware'

/*

      C.Y.R.E. - M.I.D.D.L.E.W.A.R.E - S.T.A.T.E
      
      Updated middleware state with integrated built-in middleware:
      - Register built-in debounce middleware
      - Auto-compile chains with debounce when needed
      - Maintain existing external middleware functionality

*/

// Stores
const middlewareRegistry = createStore<MiddlewareEntry>()
const compiledChains = createStore<MiddlewareChain>()

// Built-in debounce middleware implementation
const debounceMiddleware: BuiltinMiddlewareFunction = async (context, next) => {
  const {action, payload} = context
  const debounceTime = action.debounce

  if (!debounceTime || debounceTime <= 0) {
    return next(payload)
  }

  try {
    // Get current action state
    const currentAction = io.get(action.id)
    if (!currentAction) {
      return next(payload)
    }

    // Cancel existing debounce timer if it exists
    if (currentAction.debounceTimerId) {
      TimeKeeper.forget(currentAction.debounceTimerId)
      log.debug(`Cancelled existing debounce timer for ${action.id}`)
    }

    // Generate unique timer ID
    const timerId = `${action.id}-debounce-${Date.now()}`

    // Update IO state with new timer ID and latest payload
    const updatedAction = {
      ...currentAction,
      debounceTimerId: timerId,
      payload: payload // Store latest payload for execution
    }
    io.set(updatedAction)

    // Create debounce timer that will execute dispatch directly
    const timerResult = TimeKeeper.keep(
      debounceTime,
      async () => {
        try {
          // Get the latest action state when timer executes
          const actionAtExecution = io.get(action.id)
          if (!actionAtExecution) {
            return
          }

          // Clear the timer ID
          const clearedAction = {
            ...actionAtExecution,
            debounceTimerId: undefined
          }
          io.set(clearedAction)

          log.debug(
            `Debounce timer fired for ${action.id} after ${debounceTime}ms`
          )

          // Execute dispatch directly with stored payload
          await useDispatch(actionAtExecution, actionAtExecution.payload)
        } catch (error) {
          log.error(`Debounce execution failed for ${action.id}: ${error}`)
        }
      },
      1, // Execute once
      timerId
    )

    if (timerResult.kind === 'error') {
      // Timer creation failed, fall back to immediate execution
      const failedAction = {...updatedAction, debounceTimerId: undefined}
      io.set(failedAction)
      return next(payload)
    }

    log.debug(
      `Debounce timer created for ${action.id}: ${debounceTime}ms delay`
    )

    metricsReport.sensor.log(action.id, 'debounce', 'debounce-middleware', {
      debounceTime,
      timerId,
      collapsed: !!currentAction.debounceTimerId
    })

    // Return delay result - this prevents immediate execution
    return {
      type: 'delay',
      duration: debounceTime,
      payload,
      metadata: {
        debounced: true,
        timerId
      }
    }
  } catch (error) {
    log.error(`Debounce middleware error for ${action.id}: ${error}`)
    return next(payload)
  }
}

// Built-in throttle middleware implementation
const throttleMiddleware: BuiltinMiddlewareFunction = async (context, next) => {
  const {action, payload} = context
  const throttleTime = action.throttle

  if (!throttleTime || throttleTime <= 0) {
    return next(payload)
  }

  try {
    const currentAction = io.get(action.id)
    if (!currentAction) {
      return next(payload)
    }

    const now = Date.now()
    const lastExecution = currentAction.lastThrottleExecution || 0
    const timeSinceLastExecution = now - lastExecution

    if (timeSinceLastExecution < throttleTime) {
      const remainingTime = throttleTime - timeSinceLastExecution

      metricsReport.sensor.log(action.id, 'throttle', 'throttle-middleware', {
        remainingTime
      })

      return {
        type: 'block',
        reason: `Throttled: ${remainingTime}ms remaining`,
        metadata: {throttled: true, remainingTime}
      }
    }

    // Update throttle execution timestamp
    const updatedAction = {
      ...currentAction,
      lastThrottleExecution: now
    }
    io.set(updatedAction)

    return next(payload)
  } catch (error) {
    log.error(`Throttle middleware error for ${action.id}: ${error}`)
    return next(payload)
  }
}

// Register built-in middleware on initialization
const initializeBuiltinMiddleware = () => {
  middlewareRegistry.set(BuiltinMiddlewareId.DEBOUNCE, {
    id: BuiltinMiddlewareId.DEBOUNCE,
    type: 'builtin',
    fn: debounceMiddleware,
    description: 'Built-in debounce protection'
  })

  middlewareRegistry.set(BuiltinMiddlewareId.THROTTLE, {
    id: BuiltinMiddlewareId.THROTTLE,
    type: 'builtin',
    fn: throttleMiddleware,
    description: 'Built-in throttle protection'
  })

  log.debug('Built-in middleware initialized')
}

// Initialize built-in middleware immediately
initializeBuiltinMiddleware()

export const middlewareState = {
  /**
   * Register external middleware
   */
  registerExternal: (
    id: string,
    fn: ExternalMiddlewareFunction
  ): {ok: boolean; message: string} => {
    try {
      const entry: MiddlewareEntry = {
        id,
        type: 'external',
        fn,
        description: `External middleware: ${id}`
      }

      middlewareRegistry.set(id, entry)
      log.debug(`External middleware registered: ${id}`)

      return {ok: true, message: `Middleware ${id} registered`}
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error(`Failed to register middleware ${id}: ${msg}`)
      return {ok: false, message: msg}
    }
  },

  /**
   * Compile middleware chain for an action (auto-includes built-ins)
   */
  setChain: (action: IO): void => {
    try {
      const middlewares: string[] = []

      // Auto-add built-in middleware based on action properties
      if (action.throttle && action.throttle > 0) {
        middlewares.push(BuiltinMiddlewareId.THROTTLE)
      }

      if (action.debounce && action.debounce > 0) {
        middlewares.push(BuiltinMiddlewareId.DEBOUNCE)
      }

      // Add external middleware from action config
      if (action.middleware && Array.isArray(action.middleware)) {
        middlewares.push(...action.middleware)
      }

      // Create compiled chain
      const chain: MiddlewareChain = {
        actionId: action.id,
        middlewares,
        compiled: true,
        fastPath: middlewares.length === 0
      }

      compiledChains.set(action.id, chain)

      log.debug(
        `Middleware chain compiled for ${action.id}: ${middlewares.length} middleware functions`
      )
    } catch (error) {
      log.error(`Failed to compile middleware chain for ${action.id}: ${error}`)
    }
  },

  /**
   * Get compiled chain for action
   */
  getChain: (actionId: string): MiddlewareChain | undefined => {
    return compiledChains.get(actionId)
  },

  /**
   * Check if action uses fast path (no middleware)
   */
  isFastPath: (actionId: string): boolean => {
    const chain = compiledChains.get(actionId)
    return chain?.fastPath ?? true
  },

  /**
   * Get middleware entry by ID
   */
  getEntry: (middlewareId: string): MiddlewareEntry | undefined => {
    return middlewareRegistry.get(middlewareId)
  },

  /**
   * Remove compiled chain
   */
  forgetChain: (actionId: string): boolean => {
    return compiledChains.forget(actionId)
  },

  /**
   * Clear all compiled chains
   */
  clearChains: (): void => {
    compiledChains.clear()
  },

  /**
   * Get statistics
   */
  getStats: () => {
    const allChains = compiledChains.getAll()
    const fastPathCount = allChains.filter(c => c.fastPath).length

    return {
      totalActions: allChains.length,
      fastPathActions: fastPathCount,
      middlewareActions: allChains.length - fastPathCount,
      fastPathPercentage:
        allChains.length > 0 ? (fastPathCount / allChains.length) * 100 : 0,
      externalMiddlewareCount: middlewareRegistry
        .getAll()
        .filter(m => m.type === 'external').length,
      chains: allChains.map(chain => ({
        actionId: chain.actionId,
        middlewareCount: chain.middlewares.length,
        fastPath: chain.fastPath,
        middlewares: chain.middlewares
      }))
    }
  }
}
