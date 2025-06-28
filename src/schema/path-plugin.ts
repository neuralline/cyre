// src/schema/path-plugin.ts
// Secure path system with restrictive call design

import {pathEngine, type PathMatch} from './path-engine'
import type {IO, ActionPayload, CyreResponse} from '../types/core'
import {sensor} from '../components/sensor'

/*

      C.Y.R.E - P.A.T.H - P.L.U.G.I.N - S.E.C.U.R.E
      
      Secure path system with restrictive call design:
      - Exact paths only for regular calls
      - Explicit bulk operations with safety checks
      - Pattern matching for discovery and subscription only
      - Clear separation of concerns

*/

export const pathDataDefinition = (
  value: any
): {ok: boolean; data?: any; error?: string} => {
  if (value === undefined) {
    return {ok: true, data: undefined}
  }

  if (typeof value !== 'string') {
    return {ok: false, error: 'Path must be a string'}
  }

  if (!pathEngine.isValidPath(value)) {
    return {
      ok: false,
      error:
        'Path must be a valid hierarchical path (e.g., "app/users/profile")'
    }
  }

  return {ok: true, data: value}
}

// Path-based talents
export const pathTalents = {
  /**
   * Path-based routing talent
   */
  pathRoute: (action: IO, payload: any) => {
    if (!action.path) {
      return {ok: true, payload}
    }

    try {
      // Path routing logic could go here
      // For now, just validate and pass through
      const isValid = pathEngine.isValidPath(action.path)

      if (!isValid) {
        return {
          ok: false,
          error: true,
          message: 'Invalid path format',
          payload
        }
      }

      return {
        ok: true,
        payload,
        message: 'Path routing validated'
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        error: true,
        message: `Path routing error: ${errorMessage}`,
        payload
      }
    }
  }
} as const
// Path-specific types

// Path-specific types
export interface PathContext {
  id: string
  path: string
  segments: string[]
  depth: number
  matchedPattern?: string
}

export interface PathCallResult extends CyreResponse {
  pathContext?: PathContext
  totalMatches?: number
}

export interface BulkCallOptions {
  /** Maximum number of channels to call (safety limit) */
  maxChannels?: number
  /** Require explicit confirmation for large operations */
  confirmLargeOperation?: boolean
  /** Dry run - find matches without executing calls */
  dryRun?: boolean
  /** Override safety checks (use with caution) */
  force?: boolean
}

export interface BulkCallResult {
  ok: boolean
  message: string
  matchedChannels: number
  successfulCalls: number
  failedCalls: number
  results: PathCallResult[]
  dryRun?: boolean
}

/**
 * SECURE: Call by exact path only (no wildcards)
 */
const callByExactPath = async (
  exactPath: string,
  payload?: ActionPayload
): Promise<PathCallResult[]> => {
  // Validate that path contains no wildcards
  if (exactPath.includes('*')) {
    sensor.debug('path-system', 'error', 'wildcard-in-exact-call')

    return [
      {
        ok: false,
        payload: null,
        message: `Wildcards not allowed in exact path calls. Use bulkCall() for pattern matching. Path: ${exactPath}`,
        totalMatches: 0
      }
    ]
  }

  // Validate path format
  if (!pathEngine.isValidPath(exactPath)) {
    return [
      {
        ok: false,
        payload: null,
        message: `Invalid path format: ${exactPath}`,
        totalMatches: 0
      }
    ]
  }

  try {
    const matches = pathEngine.match(exactPath)

    if (matches.length === 0) {
      sensor.debug('path-system', 'info', 'exact-path-not-found')

      return [
        {
          ok: false,
          payload: null,
          message: `No channel found at exact path: ${exactPath}`,
          totalMatches: 0
        }
      ]
    }

    if (matches.length > 1) {
      sensor.debug('path-system', 'warn', 'multiple-channels-same-path')
    }

    // Execute calls to all channels at this exact path
    const results = await Promise.all(
      matches.map(async match => {
        try {
          const {call} = await import('../app')
          const result = await call(match.id, payload)

          return {
            ...result,
            pathContext: {
              id: match.id,
              path: match.path,
              segments: match.segments,
              depth: match.depth
            },
            totalMatches: matches.length
          } as PathCallResult
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          return {
            ok: false,
            payload: null,
            message: `Call failed for ${match.id}: ${errorMessage}`,
            pathContext: {
              id: match.id,
              path: match.path,
              segments: match.segments,
              depth: match.depth
            },
            totalMatches: matches.length
          } as PathCallResult
        }
      })
    )

    sensor.debug('path-system', 'success', 'exact-path-call-complete')

    return results
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error('path-system', errorMessage, 'exact-path-call-error')

    return [
      {
        ok: false,
        payload: null,
        message: `Exact path call failed: ${errorMessage}`,
        totalMatches: 0
      }
    ]
  }
}

/**
 * BULK: Explicit bulk operations with safety checks
 */
const bulkCallByPattern = async (
  pattern: string,
  payload: ActionPayload,
  options: BulkCallOptions = {}
): Promise<BulkCallResult> => {
  const {
    maxChannels = 50,
    confirmLargeOperation = true,
    dryRun = false,
    force = false
  } = options

  try {
    // Find matching channels
    const matches = pathEngine.match(pattern)

    if (matches.length === 0) {
      sensor.debug('path-system', 'info', 'bulk-call-no-matches')

      return {
        ok: false,
        message: `No channels found matching pattern: ${pattern}`,
        matchedChannels: 0,
        successfulCalls: 0,
        failedCalls: 0,
        results: []
      }
    }

    // Safety checks
    if (!force && matches.length > maxChannels) {
      sensor.debug('path-system', 'warn', 'bulk-call-exceeds-limit')

      return {
        ok: false,
        message: `Pattern matches ${matches.length} channels, exceeding safety limit of ${maxChannels}. Use force: true to override.`,
        matchedChannels: matches.length,
        successfulCalls: 0,
        failedCalls: 0,
        results: []
      }
    }

    // Large operation confirmation - CRITICAL SECURITY CHECK
    if (!force && confirmLargeOperation && matches.length > 5) {
      // Lowered threshold for security
      sensor.debug('path-system', 'warn', 'bulk-call-large-operation')

      return {
        ok: false,
        message: `SECURITY: Large operation blocked - ${matches.length} channels. Use confirmLargeOperation: false AND force: true to proceed.`,
        matchedChannels: matches.length,
        successfulCalls: 0,
        failedCalls: 0,
        results: []
      }
    }

    // Additional safety check - require BOTH force AND confirmation disabled for large ops
    if (!force && matches.length > 5) {
      sensor.debug('path-system', 'error', 'bulk-call-security-block')

      return {
        ok: false,
        message: `SECURITY: ${matches.length} channels would be affected. Require both force: true AND confirmLargeOperation: false for large operations.`,
        matchedChannels: matches.length,
        successfulCalls: 0,
        failedCalls: 0,
        results: []
      }
    }

    // Dry run - return matches without executing
    if (dryRun) {
      const dryRunResults: PathCallResult[] = matches.map(match => ({
        ok: true,
        payload: null,
        message: `Dry run - would call ${match.id}`,
        pathContext: {
          id: match.id,
          path: match.path,
          segments: match.segments,
          depth: match.depth,
          matchedPattern: pattern
        },
        totalMatches: matches.length
      }))

      return {
        ok: true,
        message: `Dry run: Found ${matches.length} channels that would be called`,
        matchedChannels: matches.length,
        successfulCalls: matches.length,
        failedCalls: 0,
        results: dryRunResults,
        dryRun: true
      }
    }

    sensor.debug('path-system', 'info', 'bulk-call-start')

    // Execute bulk calls
    const results = await Promise.all(
      matches.map(async match => {
        try {
          const {call} = await import('../app')
          const result = await call(match.id, payload)

          return {
            ...result,
            pathContext: {
              id: match.id,
              path: match.path,
              segments: match.segments,
              depth: match.depth,
              matchedPattern: pattern
            },
            totalMatches: matches.length
          } as PathCallResult
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          return {
            ok: false,
            payload: null,
            message: `Call failed for ${match.id}: ${errorMessage}`,
            pathContext: {
              id: match.id,
              path: match.path,
              segments: match.segments,
              depth: match.depth,
              matchedPattern: pattern
            },
            totalMatches: matches.length
          } as PathCallResult
        }
      })
    )

    const successfulCalls = results.filter(r => r.ok).length
    const failedCalls = results.length - successfulCalls

    return {
      ok: successfulCalls > 0,
      message: `Bulk call: ${successfulCalls}/${results.length} successful`,
      matchedChannels: matches.length,
      successfulCalls,
      failedCalls,
      results
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error('path-system', errorMessage, 'bulk-call-error')

    return {
      ok: false,
      message: `Bulk call failed: ${errorMessage}`,
      matchedChannels: 0,
      successfulCalls: 0,
      failedCalls: 0,
      results: []
    }
  }
}

/**
 * Subscribe to channels by path pattern (patterns allowed for discovery)
 */
const subscribeByPath = async (
  pathPattern: string,
  handler: (payload: any, context: PathContext) => any
) => {
  try {
    const matches = pathEngine.match(pathPattern)

    if (matches.length === 0) {
      return {
        ok: false,
        message: `No channels found matching path pattern: ${pathPattern}`,
        matchCount: 0
      }
    }

    const subscriptions = matches.map(match => {
      const subscribeModule = import('../components/cyre-on')
      return subscribeModule.then(({subscribe}) => {
        return subscribe(match.id, (payload: any) => {
          const context: PathContext = {
            id: match.id,
            path: match.path,
            segments: match.segments,
            depth: match.depth,
            matchedPattern: pathPattern
          }

          return handler(payload, context)
        })
      })
    })

    const resolvedSubscriptions = await Promise.all(subscriptions)
    const successfulSubs = resolvedSubscriptions.filter(sub => sub.ok)

    return {
      ok: successfulSubs.length > 0,
      message: `Subscribed to ${successfulSubs.length}/${matches.length} channels`,
      matchCount: matches.length,
      unsubscribe: () => {
        return resolvedSubscriptions.every(sub => sub.unsubscribe?.() || false)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error('path-system', errorMessage, 'path-subscription-error')

    return {
      ok: false,
      message: `Path subscription failed: ${errorMessage}`,
      matchCount: 0
    }
  }
}

/**
 * Find channels by path pattern (discovery only)
 */
const findByPath = (pathPattern: string): PathMatch[] => {
  try {
    const matches = pathEngine.match(pathPattern)

    return matches
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error('path-system', errorMessage, 'path-find-error')
    return []
  }
}

/**
 * Get path tree for debugging and visualization
 */
const getPathTree = () => {
  return {
    tree: pathEngine.tree(),
    stats: pathEngine.stats()
  }
}

/**
 * Secure path plugin API with clear separation of concerns
 */
export const pathPlugin = {
  // DISCOVERY: Pattern matching for finding channels
  find: findByPath,
  tree: getPathTree,
  stats: pathEngine.stats,

  // SUBSCRIPTION: Pattern matching allowed for event handling
  on: subscribeByPath,

  // CALLS: Restrictive and explicit
  call: callByExactPath, // Exact paths only, no wildcards
  bulkCall: bulkCallByPattern, // Explicit bulk operations with safety

  // UTILITIES: Path parsing and validation
  parse: pathEngine.parse,
  isValid: pathEngine.isValidPath,

  // ADVANCED: Discovery operations
  getAllPaths: (): string[] => {
    const matches = pathEngine.match('**')
    return [...new Set(matches.map(m => m.path))]
  },

  getChannelsByDepth: (depth: number): PathMatch[] => {
    const allMatches = pathEngine.match('**')
    return allMatches.filter(m => m.depth === depth)
  },

  // SAFETY: Preview operations before execution
  preview: (
    pattern: string
  ): {
    matches: PathMatch[]
    wouldAffect: number
    recommendation: string
  } => {
    const matches = pathEngine.match(pattern)
    let recommendation = 'Safe to proceed'

    if (matches.length === 0) {
      recommendation = 'No channels match this pattern'
    } else if (matches.length > 50) {
      recommendation = 'Large operation - consider more specific pattern'
    } else if (matches.length > 10) {
      recommendation = 'Medium operation - verify channels before proceeding'
    }

    return {
      matches,
      wouldAffect: matches.length,
      recommendation
    }
  }
}
