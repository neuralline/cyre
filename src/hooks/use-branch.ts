// src/hooks/use-branch.ts
// Branch system with React component-like isolation
// No parent/sibling access, strict hierarchy, cascade destruction

import type {Branch, BranchConfig, BranchSetup} from '../types/hooks'
import type {IO, ActionPayload} from '../types/core'
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
 * - No access to parent or siblings
 * - Only parent can call children
 * - Cascade destruction when parent destroyed
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

  // Build path from parent instance + branch ID only (never uses name)
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
   * Get branch storage namespace
   */
  const getBranchStorage = (): Record<string, IO> => {
    const state = (targetCyre as any).getState?.() || {}

    if (!state.branches) {
      state.branches = {}
    }
    if (!state.branches[path]) {
      state.branches[path] = {}
    }

    return state.branches[path]
  }

  /**
   * Store action in branch namespace
   */
  const storeBranchAction = (actionConfig: IO): void => {
    const branchStorage = getBranchStorage()
    branchStorage[actionConfig.id] = actionConfig
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

    // Core action management
    action: (actionConfig: IO) => {
      try {
        // Validate clean ID (no slashes)
        if (actionConfig.id.includes('/') || actionConfig.id.includes('\\')) {
          throw new Error(
            `Channel ID "${actionConfig.id}" cannot contain path separators. Use clean IDs like "sensor" or "user-validator"`
          )
        }

        // Enhanced config with branch context
        const enhancedConfig: IO = {
          ...actionConfig,
          id: actionConfig.id,
          path: `${path}/${actionConfig.id}`,
          _branchId: branchId,
          tags: [
            ...(actionConfig.tags || []),
            `branch:${branchId}`,
            `branch-path:${path}`
          ]
        }

        // Register with core cyre
        const result = targetCyre.action({
          ...enhancedConfig,
          id: `${path}/${actionConfig.id}`
        })

        if (result.ok) {
          storeBranchAction(enhancedConfig)
          sensor.log(branchId, 'success', 'branch-action-registered', {
            cleanId: actionConfig.id,
            fullPath: `${path}/${actionConfig.id}`,
            branchPath: path
          })
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

    // Subscribe to branch channel
    on: (channelId: string, handler: any) => {
      try {
        const fullPath = `${path}/${channelId}`
        const result = targetCyre.on(fullPath, handler)

        if (result.ok) {
          sensor.log(branchId, 'success', 'branch-subscription', {
            cleanId: channelId,
            fullPath,
            branchPath: path
          })
        }

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

    // Call - strict hierarchy only (like React data flow)
    call: async (target: string, payload?: any) => {
      try {
        let targetPath: string

        // Block sibling communication (like React components)
        if (target.includes('../')) {
          throw new Error(
            'Sibling/parent communication not allowed. Use parent coordination pattern.'
          )
        }

        // Only allow parent → child calls
        if (target.includes('/')) {
          // Ensure it's a child path
          if (!target.startsWith(path + '/')) {
            throw new Error(
              'Cross-branch communication not allowed. Only parent → child calls permitted.'
            )
          }
          targetPath = target
        } else {
          // Local channel call
          targetPath = `${path}/${target}`
        }

        const result = await targetCyre.call(targetPath, payload)

        sensor.log(branchId, 'success', 'branch-call', {
          target,
          targetPath,
          branchPath: path
        })

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
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
        sensor.error(branchId, 'Get failed', {channelId, error})
        return undefined
      }
    },

    // Remove action from branch
    forget: (channelId: string) => {
      try {
        const fullPath = `${path}/${channelId}`
        const coreResult = targetCyre.forget(fullPath)
        const branchResult = removeBranchAction(channelId)
        return coreResult && branchResult
      } catch (error) {
        sensor.error(branchId, 'Forget failed', {channelId, error})
        return false
      }
    },

    // Destroy entire branch (React unmount-like)
    destroy: () => {
      try {
        const branchActions = listBranchActions()
        let removedCount = 0

        // Remove all actions in this branch
        branchActions.forEach(action => {
          const fullPath = `${path}/${action.id}`
          if (targetCyre.forget(fullPath)) {
            removedCount++
          }
        })

        // CASCADE: Destroy all child branches (like React unmount)
        childBranches.forEach(childPath => {
          const state = (targetCyre as any).getState?.() || {}
          if (state.branches && state.branches[childPath]) {
            // Remove all channels in child branch
            const childStorage = state.branches[childPath]
            Object.keys(childStorage).forEach(channelId => {
              const fullPath = `${childPath}/${channelId}`
              targetCyre.forget(fullPath)
              removedCount++
            })
            // Remove child branch storage
            delete state.branches[childPath]
          }
        })

        // Remove this branch storage
        const state = (targetCyre as any).getState?.() || {}
        if (state.branches && state.branches[path]) {
          delete state.branches[path]
        }

        // Remove from parent's child tracking
        if (finalConfig.parent) {
          const parentBranch = finalConfig.parent as any
          if (parentBranch.childBranches) {
            parentBranch.childBranches.delete(path)
          }
        }

        sensor.log(branchId, 'success', 'branch-destroyed', {
          branchId,
          path,
          removedChannels: removedCount,
          destroyedChildren: childBranches.size
        })

        return removedCount > 0
      } catch (error) {
        sensor.error(branchId, 'Destroy failed', {error})
        return false
      }
    },

    // Check if branch is active
    isActive: () => {
      const branchActions = listBranchActions()
      return branchActions.length > 0
    },

    // Get branch statistics
    getStats: () => {
      const branchActions = listBranchActions()

      return {
        id: branchId,
        path,
        channelCount: branchActions.length,
        subscriberCount: 0, // Would need tracking
        timerCount: 0, // Would need tracking
        childCount: childBranches.size,
        depth: path.split('/').filter(Boolean).length,
        createdAt: Date.now(),
        isActive: branchActions.length > 0
      }
    },

    // Setup branch with predefined configuration
    setup: (config: BranchSetup) => {
      try {
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // Setup actions
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

        // Setup subscriptions
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
  sensor.log(branchId, 'success', 'branch-created', {
    branchId,
    path,
    parentPath: finalConfig.parent?.path,
    name: finalConfig.name
  })

  return branch
}
