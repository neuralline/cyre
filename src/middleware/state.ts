// src/middleware/state.ts
// Fixed middleware state management with proper fast path detection

import {createStore} from '../context/create-store'
import {
  getBuiltinMiddleware,
  isBuiltinMiddleware,
  buildMiddlewareChain,
  needsMiddleware
} from './builtin'
import {log} from '../components/cyre-log'
import type {
  IO,
  StateKey,
  MiddlewareEntry,
  MiddlewareChain,
  ExternalMiddlewareFunction,
  BuiltinMiddlewareFunction
} from '../types/interface'

/*

      C.Y.R.E. - M.I.D.D.L.E.W.A.R.E - S.T.A.T.E.
      
      Fixed middleware state management:
      - Proper fast path detection for zero overhead
      - Separate built-in and external middleware registries
      - Per-action middleware chain compilation and caching
      - Fixed statistics tracking

*/

// Stores
const externalMiddlewareStore = createStore<MiddlewareEntry>()
const middlewareChainStore = createStore<MiddlewareChain>()

// Fast path tracking
const fastPathActions = new Set<StateKey>()

/**
 * Register external middleware (user-facing API)
 */
const registerExternalMiddleware = (
  id: string,
  fn: ExternalMiddlewareFunction,
  description?: string
): {ok: boolean; message: string} => {
  try {
    // Prevent users from registering built-in middleware IDs
    if (isBuiltinMiddleware(id)) {
      return {
        ok: false,
        message: `Cannot register middleware with reserved built-in ID: ${id}`
      }
    }

    if (!id || typeof id !== 'string') {
      return {
        ok: false,
        message: 'Middleware ID must be a non-empty string'
      }
    }

    if (typeof fn !== 'function') {
      return {
        ok: false,
        message: 'Middleware function is required'
      }
    }

    const middleware: MiddlewareEntry = {
      id,
      type: 'external',
      fn,
      description
    }

    externalMiddlewareStore.set(id, middleware)
    log.debug(`External middleware registered: ${id}`)

    return {
      ok: true,
      message: `Middleware registered: ${id}`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to register middleware ${id}: ${errorMessage}`)
    return {
      ok: false,
      message: `Registration failed: ${errorMessage}`
    }
  }
}

/**
 * Get middleware entry by ID (handles both built-in and external)
 */
const getMiddleware = (id: string): MiddlewareEntry | undefined => {
  if (isBuiltinMiddleware(id)) {
    const builtinFn = getBuiltinMiddleware(id)
    if (builtinFn) {
      return {
        id,
        type: 'builtin',
        fn: builtinFn,
        description: `Built-in middleware: ${id.replace('builtin:', '')}`
      }
    }
  }

  return externalMiddlewareStore.get(id)
}

/**
 * Compile middleware chain for an action - FIXED
 */
const compileMiddlewareChain = (action: IO): MiddlewareChain => {
  // Check if action needs middleware first
  const actionNeedsMiddleware = needsMiddleware(action)

  if (!actionNeedsMiddleware) {
    // This is a fast path action
    return {
      actionId: action.id,
      middlewares: [],
      compiled: true,
      fastPath: true
    }
  }

  // Build middleware chain for actions that need protection
  const middlewareIds = buildMiddlewareChain(action)

  const chain: MiddlewareChain = {
    actionId: action.id,
    middlewares: middlewareIds,
    compiled: true,
    fastPath: false
  }

  return chain
}

/**
 * Store compiled middleware chain for an action - FIXED
 */
const setMiddlewareChain = (action: IO): void => {
  const chain = compileMiddlewareChain(action)
  middlewareChainStore.set(action.id, chain)

  // Update fast path tracking
  if (chain.fastPath) {
    fastPathActions.add(action.id)
  } else {
    fastPathActions.delete(action.id)
  }

  const chainInfo = chain.fastPath
    ? 'fast-path (zero overhead)'
    : `${chain.middlewares.length} middleware functions`

  log.debug(`Middleware chain compiled for ${action.id}: ${chainInfo}`)
}

/**
 * Get compiled middleware chain for an action
 */
const getMiddlewareChain = (
  actionId: StateKey
): MiddlewareChain | undefined => {
  return middlewareChainStore.get(actionId)
}

/**
 * Get all middleware entries for a chain
 */
const getMiddlewareEntries = (middlewareIds: string[]): MiddlewareEntry[] => {
  const entries: MiddlewareEntry[] = []

  for (const id of middlewareIds) {
    const middleware = getMiddleware(id)
    if (middleware) {
      entries.push(middleware)
    } else {
      log.warn(`Middleware not found: ${id}`)
    }
  }

  return entries
}

/**
 * Check if action uses fast path (no middleware) - FIXED
 */
const isFastPath = (actionId: StateKey): boolean => {
  return fastPathActions.has(actionId)
}

/**
 * Check if action has middleware chain
 */
const hasMiddlewareChain = (actionId: StateKey): boolean => {
  return middlewareChainStore.get(actionId) !== undefined
}

/**
 * Remove middleware chain for an action
 */
const forgetMiddlewareChain = (actionId: StateKey): boolean => {
  fastPathActions.delete(actionId)
  return middlewareChainStore.forget(actionId)
}

/**
 * Remove external middleware
 */
const forgetExternalMiddleware = (id: string): boolean => {
  if (isBuiltinMiddleware(id)) {
    log.warn(`Cannot remove built-in middleware: ${id}`)
    return false
  }

  const removed = externalMiddlewareStore.forget(id)
  if (removed) {
    log.debug(`External middleware removed: ${id}`)
  }
  return removed
}

/**
 * Clear all middleware chains
 */
const clearMiddlewareChains = (): void => {
  middlewareChainStore.clear()
  fastPathActions.clear()
}

/**
 * Clear all external middleware
 */
const clearExternalMiddleware = (): void => {
  externalMiddlewareStore.clear()
}

/**
 * Get middleware statistics - FIXED
 */
const getMiddlewareStats = () => {
  const allChains = middlewareChainStore.getAll()
  const totalActions = allChains.length
  const fastPathCount = fastPathActions.size
  const middlewareActions = totalActions - fastPathCount
  const externalMiddlewareCount = externalMiddlewareStore.getAll().length

  return {
    totalActions,
    fastPathActions: fastPathCount,
    middlewareActions,
    fastPathPercentage:
      totalActions > 0 ? Math.round((fastPathCount / totalActions) * 100) : 0,
    externalMiddlewareCount,
    chains: allChains.map(chain => ({
      actionId: chain.actionId,
      middlewareCount: chain.middlewares.length,
      fastPath: chain.fastPath,
      middlewares: chain.middlewares
    }))
  }
}

/**
 * Validate middleware chain integrity
 */
const validateMiddlewareChain = (
  actionId: StateKey
): {
  valid: boolean
  issues: string[]
  warnings: string[]
} => {
  const chain = getMiddlewareChain(actionId)
  const issues: string[] = []
  const warnings: string[] = []

  if (!chain) {
    issues.push(`No middleware chain found for action: ${actionId}`)
    return {valid: false, issues, warnings}
  }

  // Fast path actions are always valid
  if (chain.fastPath) {
    return {valid: true, issues: [], warnings: []}
  }

  // Check if all middleware in chain exist
  for (const middlewareId of chain.middlewares) {
    const middleware = getMiddleware(middlewareId)
    if (!middleware) {
      issues.push(`Missing middleware: ${middlewareId}`)
    }
  }

  // Check for potential ordering issues
  const hasThrottle = chain.middlewares.includes('builtin:throttle')
  const hasDebounce = chain.middlewares.includes('builtin:debounce')

  if (hasThrottle && hasDebounce) {
    const throttleIndex = chain.middlewares.indexOf('builtin:throttle')
    const debounceIndex = chain.middlewares.indexOf('builtin:debounce')

    if (throttleIndex > debounceIndex) {
      warnings.push('Throttle middleware should typically come before debounce')
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  }
}

/**
 * Export middleware state interface
 */
export const middlewareState = {
  // External middleware management (user-facing)
  registerExternal: registerExternalMiddleware,
  forgetExternal: forgetExternalMiddleware,
  clearExternal: clearExternalMiddleware,

  // Chain management (internal)
  setChain: setMiddlewareChain,
  getChain: getMiddlewareChain,
  getEntries: getMiddlewareEntries,
  hasChain: hasMiddlewareChain,
  forgetChain: forgetMiddlewareChain,
  clearChains: clearMiddlewareChains,

  // Fast path detection
  isFastPath,

  // Utilities
  getStats: getMiddlewareStats,
  validate: validateMiddlewareChain,

  // Internal helpers (not exposed to users)
  _getMiddleware: getMiddleware,
  _needsMiddleware: needsMiddleware
}
