// src/hooks/use-branch.ts
// Branch system with dual addressing: full id + localId system
// No parent/sibling access, strict hierarchy, cascade destruction

import type {Branch, BranchConfig, BranchSetup} from '../types/hooks'
import type {IO} from '../types/core'
import {cyre} from '../app'
import {sensor} from '../metrics'

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

  // Track child branches for cascade destruction
  const childBranches = new Set<string>()

  /**
   * Get all channels belonging to this branch
   */
  const getBranchChannels = (): IO[] => {
    const allChannels = (targetCyre as any).getAll?.() || []
    return allChannels.filter(
      (channel: IO) =>
        channel.id.startsWith(`${path}/`) && channel.path === path
    )
  }

  /**
   * Register this branch with parent for cascade destruction
   */
  if (finalConfig.parent) {
    const parentBranch = finalConfig.parent as any
    if (parentBranch.childBranches) {
      parentBranch.childBranches.add(path)
    }
  }

  // Create branch interface - React component-like
  const branch: Branch = {
    id: branchId,
    path,
    parent: finalConfig.parent,

    // Core action management with dual addressing
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
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(branchId, errorMessage, 'branch-action-error')
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
        sensor.error(branchId, errorMessage, 'branch-subscription-error')
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
        sensor.error(branchId, errorMessage, 'use-branch')
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
        sensor.error(branchId, 'Instance get failed', 'use-branch')
        return undefined
      }
    },

    // Remove channel using local ID
    forget: (localChannelId: string) => {
      try {
        const fullAddress = `${path}/${localChannelId}`
        return targetCyre.forget(fullAddress)
      } catch (error) {
        sensor.error(branchId, 'Forget failed', {localChannelId, error})
        return false
      }
    },

    // Destroy entire branch with cascade
    destroy: () => {
      try {
        const branchChannels = getBranchChannels()
        let removedCount = 0

        // Remove all channels in this branch
        branchChannels.forEach(channel => {
          if (targetCyre.forget(channel.id)) {
            removedCount++
          }
        })

        // CASCADE: Destroy all child branches recursively
        const destroyChildBranch = (childPath: string): number => {
          let childRemovedCount = 0

          // Find all channels in child branch
          const allChannels = (targetCyre as any).getAll?.() || []
          const childChannels = allChannels.filter((channel: IO) =>
            channel.id.startsWith(`${childPath}/`)
          )

          // Remove child channels
          childChannels.forEach((channel: IO) => {
            if (targetCyre.forget(channel.id)) {
              childRemovedCount++
            }
          })

          // Find and destroy grandchildren
          const grandchildPaths = Array.from(childBranches).filter(
            grandchildPath => grandchildPath.startsWith(`${childPath}/`)
          )

          grandchildPaths.forEach(grandchildPath => {
            childRemovedCount += destroyChildBranch(grandchildPath)
            childBranches.delete(grandchildPath)
          })

          return childRemovedCount
        }

        // Destroy all child branches
        const childPaths = Array.from(childBranches).filter(childPath =>
          childPath.startsWith(`${path}/`)
        )

        childPaths.forEach(childPath => {
          removedCount += destroyChildBranch(childPath)
          childBranches.delete(childPath)
        })

        // Remove from parent's child tracking
        if (finalConfig.parent) {
          const parentBranch = finalConfig.parent as any
          if (parentBranch.childBranches) {
            parentBranch.childBranches.delete(path)
          }
        }

        return removedCount > 0
      } catch (error) {
        sensor.error(branchId, 'Destroy failed', {error})
        return false
      }
    },

    // Check if branch is active (has channels)
    isActive: () => {
      const branchChannels = getBranchChannels()
      return branchChannels.length > 0
    },

    // Get branch statistics
    getStats: () => {
      const branchChannels = getBranchChannels()
      const childCount = Array.from(childBranches).filter(
        childPath =>
          childPath.startsWith(`${path}/`) &&
          childPath.split('/').length === path.split('/').length + 1
      ).length

      return {
        id: branchId,
        path,
        channelCount: branchChannels.length,
        subscriberCount: 0, // Would need tracking
        timerCount: 0, // Would need tracking
        childCount,
        depth: path.split('/').filter(Boolean).length,
        createdAt: Date.now(),
        isActive: branchChannels.length > 0
      }
    },

    // Setup branch with predefined configuration
    setup: (config: BranchSetup) => {
      try {
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // Setup actions with local IDs
        if (config.actions) {
          config.actions.forEach(actionConfig => {
            if (actionConfig.id) {
              const result = branch.action(actionConfig as IO)
              if (result.ok) {
                successCount++
              } else {
                errorCount++
                errors.push(`Action ${actionConfig.id}: ${result.message}`)
              }
            }
          })
        }

        // Setup subscriptions with local IDs
        if (config.subscriptions) {
          config.subscriptions.forEach(sub => {
            try {
              branch.on(sub.id, sub.handler)
              successCount++
            } catch (error) {
              errorCount++
              errors.push(
                `Subscription ${sub.id}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              )
            }
          })
        }

        const success = errorCount === 0
        const message = success
          ? `Setup completed: ${successCount} items configured`
          : `Setup completed with errors: ${successCount} successful, ${errorCount} failed. Errors: ${errors.join(
              ', '
            )}`

        return {ok: success, message}
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return {
          ok: false,
          message: `Setup failed: ${errorMessage}`
        }
      }
    }
  }

  // Expose childBranches for cascade destruction
  ;(branch as any).childBranches = childBranches

  // Log branch creation

  return branch
}
