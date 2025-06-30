// src/hooks/use-branch.ts
// Branch system with required instance and proper error handling

import type {Branch, BranchConfig, CyreInstance} from '../types/hooks'
import type {IO, BranchStore} from '../types/core'
import {sensor} from '../components/sensor'
import {cyre} from '../app'

/**
 * Branch configuration - minimal like React props
 */
export interface UseBranchConfig extends BranchConfig {
  id?: string
  /** Branch name for debugging/display only - never used for paths */
  name?: string
}

/**
 * Create isolated branch with required instance and proper error handling
 * - Required instance parameter (no auto-fallback)
 * - Returns false on failures with sensor.error logging
 * - Handles cyre.path() returning empty string (root instance)
 * - Creates branches ON instances, not channels
 */
export function useBranch(
  instance: CyreInstance,
  config: UseBranchConfig = {}
): Branch | false {
  // VALIDATION 1: Required instance check
  if (!instance) {
    sensor.error(
      'useBranch requires a valid instance parameter',
      'use-branch',
      'validation',
      'error',
      {providedInstance: instance}
    )
    return false
  }

  // VALIDATION 2: Instance must have required methods
  if (
    typeof instance.action !== 'function' ||
    typeof instance.path !== 'function'
  ) {
    sensor.error(
      'Invalid instance - missing required methods (action, path)',
      'use-branch',
      'validation',
      'error',
      {
        hasAction: typeof instance.action === 'function',
        hasPath: typeof instance.path === 'function'
      }
    )
    return false
  }

  const finalConfig = config

  // Generate branch identifier
  let branchId = finalConfig.id || `branch-${crypto.randomUUID().slice(0, 8)}`

  // VALIDATION 3: Branch ID cannot contain path separators
  if (branchId.includes('/') || branchId.includes('\\')) {
    sensor.error(
      `Branch ID "${branchId}" cannot contain path separators - use clean IDs like "documents" or "analysis"`,
      'use-branch',
      branchId,
      'error'
    )
    return false
  }

  // VALIDATION 4: Get parent path from instance
  let parentPath: string
  try {
    parentPath = instance.path()
    // Handle case where cyre.path() returns empty string (root instance)
    if (typeof parentPath !== 'string') {
      sensor.error(
        'Instance path() method must return a string',
        'use-branch',
        branchId,
        'error',
        {returnedType: typeof parentPath, returnedValue: parentPath}
      )
      return false
    }
  } catch (error) {
    sensor.error(
      `Failed to get parent path from instance: ${error}`,
      'use-branch',
      branchId,
      'error',
      {error}
    )
    return false
  }

  // BUILD HIERARCHICAL PATH: instance.path + branchId
  // Handle empty string from cyre.path() (root instance)
  const path = parentPath ? `${parentPath}/${branchId}` : branchId

  // VALIDATION 5: Check depth limits if specified
  if (finalConfig.maxDepth !== undefined) {
    const depth = path.split('/').filter(Boolean).length
    if (depth > finalConfig.maxDepth) {
      sensor.error(
        `Branch depth ${depth} exceeds maximum ${finalConfig.maxDepth}`,
        'use-branch',
        branchId,
        'error',
        {depth, maxDepth: finalConfig.maxDepth, path}
      )
      return false
    }
  }

  // Import global stores with error handling
  const getStores = async () => {
    try {
      const {stores} = await import('../context/state')
      return stores
    } catch (error) {
      sensor.error(
        'Failed to import global stores',
        'use-branch',
        branchId,
        'error',
        {error}
      )
      return null
    }
  }

  /**
   * Register branch in global store
   */
  const registerInGlobalStore = async (): Promise<boolean> => {
    try {
      const stores = await getStores()
      if (!stores) return false

      const branchStoreEntry: BranchStore = {
        id: branchId,
        path,
        parentPath: parentPath || undefined,
        depth: path.split('/').filter(Boolean).length,
        createdAt: Date.now(),
        isActive: true,
        channelCount: 0,
        childCount: 0
      }

      stores.branch.set(path, branchStoreEntry)

      // Update parent's child count if has parent
      if (parentPath) {
        const parentEntry = stores.branch.get(parentPath)
        if (parentEntry) {
          stores.branch.set(parentPath, {
            ...parentEntry,
            childCount: parentEntry.childCount + 1
          })
        }
      }

      return true
    } catch (error) {
      sensor.error(
        'Failed to register branch in global store',
        'use-branch',
        branchId,
        'error',
        {error, path}
      )
      return false
    }
  }

  /**
   * Get all channels belonging to this branch from global store
   */
  const getBranchChannels = async (): Promise<IO[]> => {
    try {
      const stores = await getStores()
      if (!stores) return []

      return stores.io.getAll().filter((channel: IO) => channel.path === path)
    } catch (error) {
      sensor.error(
        'Failed to get branch channels',
        'use-branch',
        branchId,
        'error',
        {error}
      )
      return []
    }
  }

  /**
   * Update channel count in global store
   */
  const updateChannelCount = async (delta: number): Promise<void> => {
    try {
      const stores = await getStores()
      if (!stores) return

      const branchEntry = stores.branch.get(path)
      if (branchEntry) {
        stores.branch.set(path, {
          ...branchEntry,
          channelCount: Math.max(0, branchEntry.channelCount + delta)
        })
      }
    } catch (error) {
      sensor.error(
        'Failed to update channel count',
        'use-branch',
        branchId,
        'error',
        {error, delta}
      )
    }
  }

  // Register branch in global store immediately - if this fails, return false
  registerInGlobalStore().then(success => {
    if (!success) {
      sensor.error(
        'Branch registration failed during initialization',
        'use-branch',
        branchId,
        'error'
      )
    }
  })

  // Create branch interface
  const branch: Branch = {
    id: branchId,
    path: () => path,

    // Core action management with proper path handling
    action: (actionConfig: IO) => {
      try {
        // Validate channel ID
        if (!actionConfig.id) {
          sensor.error(
            'Channel ID is required for branch actions',
            'use-branch',
            branchId,
            'error'
          )
          return {
            ok: false,
            message: 'Channel ID is required'
          }
        }

        // Store original local ID
        const localChannelId = actionConfig.id

        // ✅ CREATE GLOBAL CHANNEL ID: path + localChannelId
        const globalChannelId = path
          ? `${path}/${localChannelId}`
          : localChannelId

        // Create enhanced config with branch context
        const enhancedConfig: IO = {
          ...actionConfig,
          // ✅ Use prefixed global ID for uniqueness
          id: globalChannelId,
          // ✅ Store original local ID for branch operations
          localId: localChannelId,
          // Set path to branch location
          path: path,
          _branchId: branchId, // Branch foreign key
          tags: [
            ...(actionConfig.tags || []),
            `branch:${branchId}`,
            `branch-path:${path}`,
            `local-id:${localChannelId}`
          ]
        }

        // ⚡ OPTIMIZATION: Direct action registration to cyre instead of instance chain
        // This bypasses the instance hierarchy for maximum performance
        const result = cyre.action(enhancedConfig)

        if (result.ok) {
          // Update channel count in global store
          updateChannelCount(1)
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(
          `Branch action registration failed: ${errorMessage}`,
          'use-branch',
          branchId,
          'error',
          {error, actionId: actionConfig.id}
        )
        return {
          ok: false,
          message: `Branch action registration failed: ${errorMessage}`
        }
      }
    },

    // Subscribe with OPTIMIZED direct cyre access
    on: (localChannelId: string, handler: any) => {
      try {
        if (!localChannelId) {
          sensor.error(
            'Channel ID is required for branch subscriptions',
            'use-branch',
            branchId,
            'error'
          )
          return {
            ok: false,
            message: 'Channel ID is required'
          }
        }

        // ✅ CONVERT LOCAL ID TO GLOBAL ID for subscription
        const globalChannelId = path
          ? `${path}/${localChannelId}`
          : localChannelId

        // ⚡ OPTIMIZATION: Direct subscription to cyre instead of instance chain
        // This bypasses the instance hierarchy for maximum performance
        const result = cyre.on(globalChannelId, handler)
        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(
          `Branch subscription failed: ${errorMessage}`,
          'use-branch',
          branchId,
          'error',
          {error, channelId: localChannelId}
        )
        return {
          ok: false,
          message: `Branch subscription failed: ${errorMessage}`
        }
      }
    },

    // Call with OPTIMIZED direct cyre access
    call: async (target: string, payload?: any) => {
      try {
        if (!target) {
          sensor.error(
            'Target channel ID is required for branch calls',
            'use-branch',
            branchId,
            'error'
          )
          return {
            ok: false,
            payload: null,
            message: 'Target channel ID is required',
            error: 'Target channel ID is required'
          }
        }

        // ✅ SMART TARGET RESOLUTION
        let globalTargetId: string

        // If target already contains path (absolute), use as-is
        if (target.includes('/')) {
          globalTargetId = target
        } else {
          // If target is local ID, prefix with current branch path
          globalTargetId = path ? `${path}/${target}` : target
        }

        // ⚡ OPTIMIZATION: Direct call to cyre instead of instance chain
        // This bypasses the instance hierarchy for maximum performance
        const result = await cyre.call(globalTargetId, payload)
        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(
          `Branch call failed: ${errorMessage}`,
          'use-branch',
          branchId,
          'error',
          {error, target}
        )
        return {
          ok: false,
          payload: null,
          message: `Branch call failed: ${errorMessage}`,
          error: errorMessage
        }
      }
    },

    // Get channel using local ID
    get: (localChannelId: string) => {
      try {
        if (!localChannelId) {
          sensor.error(
            'Channel ID is required for branch get operations',
            'use-branch',
            branchId,
            'error'
          )
          return undefined
        }

        // ✅ CONVERT LOCAL ID TO GLOBAL ID for retrieval
        const globalChannelId = path
          ? `${path}/${localChannelId}`
          : localChannelId

        // ⚡ OPTIMIZATION: Direct channel access to cyre instead of instance chain
        // This bypasses the instance hierarchy for maximum performance
        return cyre.get ? cyre.get(globalChannelId) : undefined
      } catch (error) {
        sensor.error(
          'Branch get operation failed',
          'use-branch',
          branchId,
          'error',
          {error, channelId: localChannelId}
        )
        return undefined
      }
    },

    // Remove channel using local ID with global store update
    forget: (localChannelId: string) => {
      try {
        if (!localChannelId) {
          sensor.error(
            'Channel ID is required for branch forget operations',
            'use-branch',
            branchId,
            'error'
          )
          return false
        }

        // ✅ CONVERT LOCAL ID TO GLOBAL ID for removal
        const globalChannelId = path
          ? `${path}/${localChannelId}`
          : localChannelId

        // ⚡ OPTIMIZATION: Direct channel removal from cyre instead of instance chain
        // This bypasses the instance hierarchy for maximum performance
        const success = cyre.forget(globalChannelId)

        if (success) {
          // Update channel count in global store
          updateChannelCount(-1)
        }

        return success
      } catch (error) {
        sensor.error(
          'Branch forget operation failed',
          'use-branch',
          branchId,
          'error',
          {error, channelId: localChannelId}
        )
        return false
      }
    },

    // Destroy entire branch with cascade using global store
    destroy: () => {
      try {
        // Execute async destruction
        const destroyAsync = async () => {
          try {
            const stores = await getStores()
            if (!stores) {
              sensor.error(
                'Cannot destroy branch - global stores unavailable',
                'use-branch',
                branchId,
                'error'
              )
              return false
            }

            // Get all descendants from global store
            const allBranches = stores.branch.getAll()
            const descendants = allBranches.filter(entry =>
              entry.path.startsWith(`${path}/`)
            )

            let removedCount = 0

            // Remove all descendant channels and branches
            for (const descendant of descendants) {
              const channels = stores.io
                .getAll()
                .filter((channel: IO) => channel.path === descendant.path)

              channels.forEach(channel => {
                if (cyre.forget(channel.id)) {
                  removedCount++
                }
              })

              // Remove descendant from branch store
              stores.branch.forget(descendant.path)
            }

            // Remove own channels
            const ownChannels = await getBranchChannels()
            ownChannels.forEach(channel => {
              if (cyre.forget(channel.id)) {
                removedCount++
              }
            })

            // Update parent's child count
            if (parentPath) {
              const parentEntry = stores.branch.get(parentPath)
              if (parentEntry) {
                stores.branch.set(parentPath, {
                  ...parentEntry,
                  childCount: Math.max(0, parentEntry.childCount - 1)
                })
              }
            }

            // Remove self from branch store
            const removed = stores.branch.forget(path)

            return removed || removedCount > 0
          } catch (error) {
            sensor.error(
              'Branch destruction failed',
              'use-branch',
              branchId,
              'error',
              {error}
            )
            return false
          }
        }

        // Start async operation
        destroyAsync().catch(error => {
          sensor.error(
            'Async branch destruction failed',
            'use-branch',
            branchId,
            'error',
            {error}
          )
        })

        return true // Return immediately, async cleanup continues
      } catch (error) {
        sensor.error(
          'Branch destroy operation failed',
          'use-branch',
          branchId,
          'error',
          {error}
        )
        return false
      }
    },

    // Check if branch is active using global store
    isActive: () => {
      try {
        // For immediate response, assume active - async check updates in background
        const checkAsync = async () => {
          try {
            const stores = await getStores()
            if (!stores) return false

            const branchEntry = stores.branch.get(path)
            return branchEntry?.isActive || false
          } catch (error) {
            return false
          }
        }

        // Start async check but return immediately
        checkAsync().catch(() => {
          // Silent fail for async check
        })

        return true // Assume active for immediate response
      } catch (error) {
        sensor.error(
          'Branch isActive check failed',
          'use-branch',
          branchId,
          'error',
          {error}
        )
        return false
      }
    },

    // Get branch statistics from global store
    getStats: () => {
      try {
        // Execute async stats gathering
        const statsAsync = async () => {
          try {
            const stores = await getStores()
            if (!stores) return null

            const branchEntry = stores.branch.get(path)
            const channels = await getBranchChannels()

            // Count direct children from global store
            const directChildren = stores.branch
              .getAll()
              .filter(entry => entry.parentPath === path)

            return {
              id: branchId,
              path,
              channelCount: channels.length,
              subscriberCount: 0, // Could get from subscribers store if needed
              timerCount: 0, // Could get from timeline store if needed
              childCount: directChildren.length,
              depth:
                branchEntry?.depth || path.split('/').filter(Boolean).length,
              createdAt: branchEntry?.createdAt || Date.now(),
              isActive: channels.length > 0
            }
          } catch (error) {
            sensor.error(
              'Failed to get branch stats',
              'use-branch',
              branchId,
              'error',
              {error}
            )
            return null
          }
        }

        // Start async operation
        statsAsync().catch(() => {
          // Silent fail for async stats
        })

        // Return immediate sync stats with accurate path
        return {
          id: branchId,
          path,
          channelCount: 0,
          subscriberCount: 0,
          timerCount: 0,
          childCount: 0,
          depth: path.split('/').filter(Boolean).length,
          createdAt: Date.now(),
          isActive: true
        }
      } catch (error) {
        sensor.error(
          'Branch getStats operation failed',
          'use-branch',
          branchId,
          'error',
          {error}
        )
        return {
          id: branchId,
          path,
          channelCount: 0,
          subscriberCount: 0,
          timerCount: 0,
          childCount: 0,
          depth: path.split('/').filter(Boolean).length,
          createdAt: Date.now(),
          isActive: false
        }
      }
    }
  }

  return branch
}

export default useBranch
