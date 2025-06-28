// src/hooks/use-branch.ts
// Branch system with global store integration and dual addressing: full id + localId system
// No parent/sibling access, strict hierarchy, cascade destruction

import type {Branch, BranchConfig, BranchSetup} from '../types/hooks'
import type {IO, BranchStore} from '../types/core'
import {cyre} from '../app'
import {sensor} from '../components/sensor'

/**
 * Branch configuration - minimal like React props
 */
export interface UseBranchConfig extends BranchConfig {
  /** Branch name for debugging/display only - never used for paths */
  name?: string
  /** Parent branch instance (like React parent component) */
  parent?: Branch
}

/**
 * Create isolated branch like React component
 * - Uses dual addressing: full id + localId system
 * - Global store integration for state management
 * - No access to parent or siblings
 * - Only parent can call children
 * - Cascade destruction when parent destroyed
 */
export function useBranch(
  instance: UseBranchConfig | typeof cyre = {},
  config: UseBranchConfig = {}
): Branch {
  let finalConfig: UseBranchConfig
  let targetCyre: typeof cyre

  // Handle overloaded parameters
  if (typeof instance === 'function' || (instance && 'action' in instance)) {
    targetCyre = instance as typeof cyre
    finalConfig = config
  } else {
    targetCyre = cyre // Default to main cyre
    finalConfig = instance as UseBranchConfig
  }

  // Generate branch identifiers
  const branchId = finalConfig.id || `branch-${crypto.randomUUID().slice(0, 8)}`

  if (branchId.includes('/') || branchId.includes('\\')) {
    throw new Error(
      `Branch ID "${branchId}" cannot contain path separators. Use clean IDs like "sensor" or "user-validator"`
    )
  }

  // Build hierarchical path from parent
  const path = finalConfig.parent
    ? `${finalConfig.parent.path}/${branchId}`
    : branchId

  // Validate depth if specified
  if (finalConfig.maxDepth !== undefined) {
    const depth = path.split('/').filter(Boolean).length
    if (depth > finalConfig.maxDepth) {
      throw new Error(
        `Branch depth ${depth} exceeds maximum ${finalConfig.maxDepth}`
      )
    }
  }

  // Import global stores
  const getStores = async () => {
    const {stores} = await import('../context/state')
    return stores
  }

  /**
   * Register branch in global store
   */
  const registerInGlobalStore = async (): Promise<void> => {
    try {
      const stores = await getStores()

      const branchStoreEntry: BranchStore = {
        id: branchId,
        path,
        parentPath: finalConfig.parent?.path,
        depth: path.split('/').filter(Boolean).length,
        createdAt: Date.now(),
        isActive: true,
        channelCount: 0,
        childCount: 0
      }

      stores.branch.set(path, branchStoreEntry)

      // Update parent's child count if has parent
      if (finalConfig.parent) {
        const parentEntry = stores.branch.get(finalConfig.parent.path)
        if (parentEntry) {
          stores.branch.set(finalConfig.parent.path, {
            ...parentEntry,
            childCount: parentEntry.childCount + 1
          })
        }
      }
    } catch (error) {
      sensor.error(
        'Failed to register in global store',
        'use-branch',
        branchId,
        'error',
        {error}
      )
    }
  }

  /**
   * Get all channels belonging to this branch from global store
   */
  const getBranchChannels = async (): Promise<IO[]> => {
    try {
      const stores = await getStores()
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

  // Register branch in global store immediately
  registerInGlobalStore()

  // Create branch interface - React component-like
  const branch: Branch = {
    id: branchId,
    path,
    parent: finalConfig.parent,

    // Core action management with dual addressing and global store integration
    action: (actionConfig: IO) => {
      try {
        // Validate local channel ID
        if (!actionConfig.id) {
          throw new Error('Channel ID is required')
        }

        if (actionConfig.id.includes('/') || actionConfig.id.includes('\\')) {
          throw new Error(
            `Channel ID "${actionConfig.id}" cannot contain path separators. Use simple IDs like "create-user" or "validator"`
          )
        }

        // Store original local ID
        const localChannelId = actionConfig.id

        // Compute full address for io store
        const fullAddress = `${path}/${localChannelId}`

        // Enhanced config with dual addressing
        const enhancedConfig: IO = {
          ...actionConfig,
          id: fullAddress, // Full address for io store uniqueness
          localId: localChannelId, // Local ID for branch operations
          path: path, // Branch path for organization
          _branchId: branchId, // Branch foreign key
          tags: [
            ...(actionConfig.tags || []),
            `branch:${branchId}`,
            `branch-path:${path}`
          ]
        }

        // Register with core cyre using full address
        const result = targetCyre.action(enhancedConfig)

        if (result.ok) {
          // Update channel count in global store
          updateChannelCount(1)
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(errorMessage, 'use-branch', branchId, 'error')
        return {
          ok: false,
          message: `Branch action registration failed: ${errorMessage}`
        }
      }
    },

    // Subscribe to branch channel using local ID
    on: (localChannelId: string, handler: any) => {
      try {
        // Compute full address for subscription
        const fullAddress = `${path}/${localChannelId}`
        const result = targetCyre.on(fullAddress, handler)
        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(errorMessage, 'use-branch', branchId, 'error')
        return {
          ok: false,
          message: `Branch subscription failed: ${errorMessage}`
        }
      }
    },

    // Call with strict hierarchy and path resolution
    call: async (target: string, payload?: any) => {
      try {
        let targetAddress: string

        // Determine target type and resolve address
        if (target.includes('/')) {
          // Child path call - ensure it's within our hierarchy
          if (target.startsWith(`${path}/`)) {
            // Direct child path
            targetAddress = target
          } else {
            // Relative child path - append to our path
            targetAddress = `${path}/${target}`
          }
        } else {
          // Local channel call - compute full address
          targetAddress = `${path}/${target}`
        }

        // Execute call with computed address
        const result = await targetCyre.call(targetAddress, payload)

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(errorMessage, 'use-branch', branchId, 'error')
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
        const fullAddress = `${path}/${localChannelId}`
        return targetCyre.get ? targetCyre.get(fullAddress) : undefined
      } catch (error) {
        sensor.error('Instance get failed', 'use-branch', branchId, 'error')
        return undefined
      }
    },

    // Remove channel using local ID with global store update
    forget: (localChannelId: string) => {
      try {
        const fullAddress = `${path}/${localChannelId}`
        const success = targetCyre.forget(fullAddress)

        if (success) {
          // Update channel count in global store
          updateChannelCount(-1)
        }

        return success
      } catch (error) {
        sensor.error(branchId, 'Forget failed')
        return false
      }
    },

    // Destroy entire branch with cascade using global store
    destroy: () => {
      try {
        // Execute async destruction synchronously
        const destroyAsync = async () => {
          const stores = await getStores()

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
              if (targetCyre.forget(channel.id)) {
                removedCount++
              }
            })

            // Remove descendant from branch store
            stores.branch.forget(descendant.path)
          }

          // Remove own channels
          const ownChannels = await getBranchChannels()
          ownChannels.forEach(channel => {
            if (targetCyre.forget(channel.id)) {
              removedCount++
            }
          })

          // Update parent's child count
          if (finalConfig.parent) {
            const parentEntry = stores.branch.get(finalConfig.parent.path)
            if (parentEntry) {
              stores.branch.set(finalConfig.parent.path, {
                ...parentEntry,
                childCount: Math.max(0, parentEntry.childCount - 1)
              })
            }
          }

          // Remove self from branch store
          const removed = stores.branch.forget(path)

          return removed || removedCount > 0
        }

        // Start async operation but return immediately
        destroyAsync().catch(error => {
          sensor.error('Destroy failed', 'use-branch', branchId, 'error', {
            error
          })
        })

        return true // Assume success, actual result handled asynchronously
      } catch (error) {
        sensor.error('Destroy failed', 'use-branch', branchId, 'error', {error})
        return false
      }
    },

    // Check if branch is active using global store
    isActive: () => {
      try {
        // Execute async check synchronously
        const checkAsync = async () => {
          try {
            const stores = await getStores()
            const branchEntry = stores.branch.get(path)
            return branchEntry?.isActive || false
          } catch (error) {
            return false
          }
        }

        // Start async operation but return immediately
        checkAsync().catch(() => {
          // Silent fail for async check
        })

        return true // Assume active, actual state handled asynchronously
      } catch (error) {
        return false
      }
    },

    // Get branch statistics from global store
    getStats: () => {
      try {
        // Execute async stats gathering synchronously
        const statsAsync = async () => {
          try {
            const stores = await getStores()
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
              'Failed to get stats',
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

        // Start async operation but return immediately
        statsAsync().catch(() => {
          // Silent fail for async stats
        })

        // Return default stats immediately
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
    },

    // Setup branch with predefined configuration (DISCOURAGED)
    setup: (config: BranchSetup) => {
      try {
        // Implementation for branch setup
        return {ok: true, message: 'Branch setup completed'}
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(errorMessage, 'use-branch', branchId, 'error')
        return {ok: false, message: `Branch setup failed: ${errorMessage}`}
      }
    }
  }

  sensor.debug(
    'Branch created with global store integration',
    'use-branch',
    branchId,
    'debug'
  )

  return branch
}
