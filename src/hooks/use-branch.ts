// src/hooks/use-branch.ts
// Branch system with flat string path storage for performance
// Storage structure: io[path][id] for O(1) lookups

import type {Branch, BranchConfig, BranchSetup} from '../types/branch'
import type {IO, ActionPayload} from '../types/core'
import {cyre} from '../app'
import {sensor} from '../metrics'

/**
 * Enhanced branch configuration
 */
export interface UseBranchConfig extends BranchConfig {
  /** Branch name for debugging */
  name?: string
  /** Enable debug logging */
  debug?: boolean
  /** Parent branch instance */
  parent?: Branch
}

/**
 * Create branch with flat string path storage
 * Storage: io[path][id] for optimal performance
 */

export function useBranch(
  configOrCyre: UseBranchConfig | typeof cyre = {},
  config: UseBranchConfig = {}
): Branch {
  let finalConfig: UseBranchConfig
  let targetCyre: typeof cyre

  // Handle overloaded parameters
  if (
    typeof configOrCyre === 'function' ||
    (configOrCyre && 'action' in configOrCyre)
  ) {
    targetCyre = configOrCyre as typeof cyre
    finalConfig = config
  } else {
    targetCyre = cyre // Default to main cyre
    finalConfig = configOrCyre as UseBranchConfig
  }

  // Generate branch identifiers
  const branchId = finalConfig.id || `branch-${crypto.randomUUID().slice(0, 8)}`
  const pathSegment = finalConfig.pathSegment || finalConfig.name || branchId

  // Build flat string path
  const path = finalConfig.parent
    ? `${finalConfig.parent.path}/${pathSegment}`
    : pathSegment

  const debug = finalConfig.debug || false
  const debugLog = debug
    ? (message: string, data?: any) =>
        console.log(`[Branch:${branchId}] ${message}`, data || '')
    : () => {}

  debugLog('Creating branch', {
    branchId,
    path,
    parentPath: finalConfig.parent?.path
  })

  // Validate depth if specified
  if (finalConfig.maxDepth !== undefined) {
    const depth = path.split('/').filter(Boolean).length
    if (depth > finalConfig.maxDepth) {
      throw new Error(
        `Branch depth ${depth} exceeds maximum ${finalConfig.maxDepth}`
      )
    }
  }

  /**
   * Get branch storage namespace
   * Creates io[path] if it doesn't exist
   */
  const getBranchStorage = (): Record<string, IO> => {
    const state = (targetCyre as any).getState?.() || {}

    // Initialize branch storage if needed
    if (!state.branches) {
      state.branches = {}
    }
    if (!state.branches[path]) {
      state.branches[path] = {}
      debugLog('Initialized branch storage', {path})
    }

    return state.branches[path]
  }

  /**
   * Store action in branch namespace: io[path][id]
   */
  const storeBranchAction = (actionConfig: IO): void => {
    const branchStorage = getBranchStorage()
    branchStorage[actionConfig.id] = actionConfig

    debugLog('Stored action in branch', {
      id: actionConfig.id,
      path,
      totalChannels: Object.keys(branchStorage).length
    })
  }

  /**
   * Get action from branch namespace
   */
  const getBranchAction = (id: string): IO | undefined => {
    const branchStorage = getBranchStorage()
    return branchStorage[id]
  }

  /**
   * Remove action from branch namespace
   */
  const removeBranchAction = (id: string): boolean => {
    const branchStorage = getBranchStorage()
    if (branchStorage[id]) {
      delete branchStorage[id]
      debugLog('Removed action from branch', {id, path})
      return true
    }
    return false
  }

  /**
   * List all actions in branch
   */
  const listBranchActions = (): IO[] => {
    const branchStorage = getBranchStorage()
    return Object.values(branchStorage)
  }

  // Create branch interface
  const branch: Branch = {
    id: branchId,
    path,
    parent: finalConfig.parent,

    // Core action management with branch storage
    action: (actionConfig: IO) => {
      try {
        debugLog('Registering action', {
          id: actionConfig.id,
          hasThrottle: !!actionConfig.throttle,
          hasDebounce: !!actionConfig.debounce
        })

        // Validate clean ID (no slashes)
        if (actionConfig.id.includes('/') || actionConfig.id.includes('\\')) {
          throw new Error(
            `Channel ID "${actionConfig.id}" cannot contain path separators. Use clean IDs like "sensor" or "user-validator"`
          )
        }

        // Enhanced config with branch context
        const enhancedConfig: IO = {
          ...actionConfig,
          // Keep original clean ID
          id: actionConfig.id,
          // Set path to full branch path + id for routing
          path: `${path}/${actionConfig.id}`,
          // Add branch metadata
          _branchId: branchId,
          path: path,
          tags: [
            ...(actionConfig.tags || []),
            `branch:${branchId}`,
            `branch-path:${path}`
          ]
        }

        // Register with core cyre (uses full path as internal key)
        const result = targetCyre.action({
          ...enhancedConfig,
          // Internal storage uses full path for uniqueness
          id: `${path}/${actionConfig.id}`
        })

        if (result.ok) {
          // Store in branch namespace with clean ID
          storeBranchAction(enhancedConfig)

          sensor.log(branchId, 'success', 'branch-action-registered', {
            cleanId: actionConfig.id,
            fullPath: `${path}/${actionConfig.id}`,
            branchPath: path
          })
        }

        debugLog('Action registration result', {
          id: actionConfig.id,
          success: result.ok,
          message: result.message
        })

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        debugLog('Action registration failed', {error: errorMessage})

        sensor.error(branchId, errorMessage, 'branch-action-error')

        return {
          ok: false,
          message: `Branch action registration failed: ${errorMessage}`
        }
      }
    },

    // Subscribe to branch channel
    on: (channelId: string, handler: any) => {
      try {
        debugLog('Creating subscription', {channelId})

        // Full path for core cyre subscription
        const fullPath = `${path}/${channelId}`
        const result = targetCyre.on(fullPath, handler)

        if (result.ok) {
          sensor.log(branchId, 'success', 'branch-subscription', {
            cleanId: channelId,
            fullPath,
            branchPath: path
          })
        }

        debugLog('Subscription result', {
          channelId,
          success: result.ok,
          message: result.message
        })

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        debugLog('Subscription failed', {error: errorMessage})

        sensor.error(branchId, errorMessage, 'branch-subscription-error')

        return {
          ok: false,
          message: `Branch subscription failed: ${errorMessage}`
        }
      }
    },

    // Call branch channel or cross-branch
    call: async (target: string, payload?: ActionPayload) => {
      try {
        debugLog('Making call', {target, hasPayload: !!payload})

        let resolvedTarget: string

        if (target.startsWith('../')) {
          // Parent navigation: ../sensor or ../../other-branch/sensor
          const upLevels = (target.match(/\.\.\//g) || []).length
          const targetId = target.replace(/\.\.\//g, '')

          const pathSegments = path.split('/').filter(Boolean)

          if (upLevels > pathSegments.length) {
            throw new Error(
              `Cannot navigate ${upLevels} levels up from ${path}`
            )
          }

          const parentPath = pathSegments.slice(0, -upLevels).join('/')
          resolvedTarget = parentPath ? `${parentPath}/${targetId}` : targetId
        } else if (target.includes('/')) {
          // Absolute path: home/bedroom/sensor
          resolvedTarget = target
        } else {
          // Local branch channel: sensor -> home/living-room/sensor
          resolvedTarget = `${path}/${target}`
        }

        debugLog('Resolved call target', {
          originalTarget: target,
          resolvedTarget,
          branchPath: path
        })

        // Call using full path
        const result = await targetCyre.call(resolvedTarget, payload)

        sensor.log(branchId, 'call', 'branch-call', {
          originalTarget: target,
          resolvedTarget,
          branchPath: path,
          success: result.ok
        })

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        debugLog('Call failed', {error: errorMessage})

        sensor.error(branchId, errorMessage, 'branch-call-error')

        return {
          ok: false,
          payload: null,
          message: `Branch call failed: ${errorMessage}`,
          error: errorMessage
        }
      }
    },

    // Get action from branch storage
    get: (channelId: string) => {
      try {
        return getBranchAction(channelId)
      } catch (error) {
        debugLog('Get failed', {channelId, error})
        return undefined
      }
    },

    // Remove action from branch
    forget: (channelId: string) => {
      try {
        // Remove from core cyre
        const fullPath = `${path}/${channelId}`
        const coreResult = targetCyre.forget(fullPath)

        // Remove from branch storage
        const branchResult = removeBranchAction(channelId)

        debugLog('Forget result', {
          channelId,
          coreRemoved: coreResult,
          branchRemoved: branchResult
        })

        return coreResult && branchResult
      } catch (error) {
        debugLog('Forget failed', {channelId, error})
        return false
      }
    },

    // Create child branch
    createChild: (childConfig: BranchConfig = {}) => {
      try {
        const childBranch = useBranch({
          ...childConfig,
          parent: branch,
          debug
        })

        debugLog('Created child branch', {
          childId: childBranch.id,
          childPath: childBranch.path
        })

        return childBranch
      } catch (error) {
        debugLog('Child creation failed', {error})
        throw error
      }
    },

    // Destroy child branch
    destroyChild: (childId: string) => {
      try {
        const childPath = `${path}/${childId}`
        const state = (targetCyre as any).getState?.() || {}

        if (state.branches && state.branches[childPath]) {
          // Remove all channels in child branch
          const childStorage = state.branches[childPath]
          const channelIds = Object.keys(childStorage)

          let removedCount = 0
          channelIds.forEach(id => {
            const fullPath = `${childPath}/${id}`
            if (targetCyre.forget(fullPath)) {
              removedCount++
            }
          })

          // Remove child branch storage
          delete state.branches[childPath]

          debugLog('Destroyed child branch', {
            childPath,
            removedChannels: removedCount
          })

          return removedCount > 0
        }

        return false
      } catch (error) {
        debugLog('Child destruction failed', {error})
        return false
      }
    },

    // Get child branch
    getChild: (childId: string) => {
      const childPath = `${path}/${childId}`
      const state = (targetCyre as any).getState?.() || {}

      if (state.branches && state.branches[childPath]) {
        // Return branch wrapper for existing child
        return useBranch({
          id: childId,
          pathSegment: childId,
          parent: branch,
          debug
        })
      }

      return undefined
    },

    // List child branches
    getChildren: () => {
      const state = (targetCyre as any).getState?.() || {}
      if (!state.branches) return []

      const children: Branch[] = []
      const pathPrefix = `${path}/`

      Object.keys(state.branches).forEach(branchPath => {
        if (branchPath.startsWith(pathPrefix)) {
          const relativePath = branchPath.slice(pathPrefix.length)
          const firstSegment = relativePath.split('/')[0]

          if (firstSegment && !children.find(c => c.id === firstSegment)) {
            children.push(
              useBranch({
                id: firstSegment,
                pathSegment: firstSegment,
                parent: branch,
                debug
              })
            )
          }
        }
      })

      return children
    },

    // Destroy entire branch
    destroy: () => {
      try {
        const branchActions = listBranchActions()
        let removedCount = 0

        // Remove all channels
        branchActions.forEach(action => {
          const fullPath = `${path}/${action.id}`
          if (targetCyre.forget(fullPath)) {
            removedCount++
          }
        })

        // Remove branch storage
        const state = (targetCyre as any).getState?.() || {}
        if (state.branches) {
          delete state.branches[path]
        }

        debugLog('Branch destroyed', {
          path,
          removedChannels: removedCount
        })

        sensor.log(branchId, 'info', 'branch-destroyed', {
          branchPath: path,
          removedChannels: removedCount
        })

        return removedCount > 0
      } catch (error) {
        debugLog('Destroy failed', {error})
        return false
      }
    },

    // Check if branch has channels
    isActive: () => {
      const branchActions = listBranchActions()
      return branchActions.length > 0
    },

    // Get branch statistics
    getStats: () => {
      const branchActions = listBranchActions()
      const children = branch.getChildren()

      return {
        id: branchId,
        path,
        channelCount: branchActions.length,
        subscriberCount: branchActions.filter(action => {
          // Check if channel has subscribers (simplified)
          return true // Would need actual subscriber tracking
        }).length,
        timerCount: 0, // Would track active timers
        childCount: children.length,
        depth: path.split('/').filter(Boolean).length,
        createdAt: Date.now(),
        isActive: branchActions.length > 0
      }
    },

    // Setup multiple actions/subscriptions
    setup: (setupConfig: BranchSetup) => {
      try {
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // Setup actions
        if (setupConfig.actions) {
          setupConfig.actions.forEach(actionConfig => {
            try {
              const result = branch.action(actionConfig as IO)
              if (result.ok) {
                successCount++
              } else {
                errorCount++
                errors.push(result.message)
              }
            } catch (error) {
              errorCount++
              errors.push(String(error))
            }
          })
        }

        // Setup subscriptions
        if (setupConfig.subscriptions) {
          setupConfig.subscriptions.forEach(sub => {
            try {
              const result = branch.on(sub.id, sub.handler)
              if (result.ok) {
                successCount++
              } else {
                errorCount++
                errors.push(result.message)
              }
            } catch (error) {
              errorCount++
              errors.push(String(error))
            }
          })
        }

        const success = errorCount === 0
        const message = success
          ? `Setup completed: ${successCount} items configured`
          : `Setup completed with errors: ${successCount} successful, ${errorCount} failed. Errors: ${errors.join(
              ', '
            )}`

        debugLog('Setup completed', {
          successCount,
          errorCount,
          success
        })

        return {ok: success, message}
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        debugLog('Setup failed', {error: errorMessage})

        return {
          ok: false,
          message: `Setup failed: ${errorMessage}`
        }
      }
    }
  }

  // Log branch creation
  sensor.log(branchId, 'success', 'branch-created', {
    branchId,
    path,
    parentPath: finalConfig.parent?.path
  })

  debugLog('Branch created successfully', {
    branchId,
    path,
    hasParent: !!finalConfig.parent
  })

  return branch
}
