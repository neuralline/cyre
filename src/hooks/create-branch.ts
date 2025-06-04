// src/hooks/create-branch.ts
// Simplified branch creation with ID prefixing and core cyre delegation

import type {
  Branch,
  BranchConfig,
  BranchStats,
  BranchSetup
} from '../types/branch'
import type {IO, ActionPayload, CyreResponse} from '../types/core'
import {log} from '../components/cyre-log'
import {sensor} from '../context/metrics-report'
import cyre from '..'

/*
  
        C.Y.R.E - C.R.E.A.T.E - B.R.A.N.C.H
        
        Simplified branch creation with ID prefixing:
        - Branch = ID prefixer + core cyre delegation
        - No separate stores needed
        - Perfect integration with all cyre features
        - Natural isolation through instance control
  
  */

/**
 * Create new branch with simplified ID prefixing approach
 */
export const createBranch = (
  parent?: Branch,
  config: BranchConfig = {}
): Branch => {
  // Generate unique ID if not provided
  const branchId = config.id || `branch-${crypto.randomUUID().slice(0, 8)}`
  const pathSegment = config.pathSegment || branchId

  // Build hierarchical path
  const path = parent ? `${parent.path}/${pathSegment}` : pathSegment

  // Validate depth limits
  if (config.maxDepth !== undefined) {
    const currentDepth = path.split('/').filter(Boolean).length
    if (currentDepth >= config.maxDepth) {
      throw new Error(`Maximum branch depth ${config.maxDepth} exceeded`)
    }
  }

  /**
   * Validate channel ID doesn't contain path separators
   */
  const validateChannelId = (id: string): void => {
    if (id.includes('/')) {
      throw new Error(
        'Branch channel IDs cannot contain "/" - use path field instead'
      )
    }
    if (id.includes('\\')) {
      throw new Error('Branch channel IDs cannot contain "\\"')
    }
  }

  /**
   * Prefix channel ID with branch path
   */
  const prefixId = (id: string): string => `${path}/${id}`

  /**
   * Resolve call target with branch path logic
   */
  const resolveTarget = (target: string): string => {
    if (target.startsWith('../')) {
      // Parent access: '../parent-channel' or '../../grandparent-channel'
      if (!parent) {
        throw new Error('Cannot access parent: no parent branch')
      }

      const upLevels = (target.match(/\.\.\//g) || []).length
      const channelId = target.replace(/\.\.\//g, '')

      let currentBranch: Branch | undefined = branch
      for (let i = 0; i < upLevels && currentBranch?.parent; i++) {
        currentBranch = currentBranch.parent
      }

      if (!currentBranch) {
        throw new Error(
          `Cannot navigate ${upLevels} levels up from branch ${path}`
        )
      }

      return `${currentBranch.path}/${channelId}`
    } else if (target.includes('/')) {
      // Absolute path: 'system/data-validator' or 'branch1/sensor'
      return target
    } else {
      // Local channel: 'sensor' -> 'branch1/sensor'
      return prefixId(target)
    }
  }

  // Create branch interface
  const branch: Branch = {
    id: branchId,
    path,
    parent,

    // Core Cyre methods - all delegate to main cyre with prefixed IDs
    action: (actionConfig: IO) => {
      try {
        validateChannelId(actionConfig.id)

        // Create enhanced action config with branch information
        const enhancedConfig: IO = {
          ...actionConfig,
          id: prefixId(actionConfig.id),
          _branchId: branchId,
          // Auto-set path if not provided
          path: actionConfig.path || prefixId(actionConfig.id),
          // Add branch context to tags
          tags: [
            ...(actionConfig.tags || []),
            `branch:${branchId}`,
            `branch-path:${path}`
          ]
        }

        const result = cyre.action(enhancedConfig)

        sensor.log(branchId, 'info', 'branch-action', {
          originalId: actionConfig.id,
          prefixedId: enhancedConfig.id,
          branchPath: path
        })

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(branchId, errorMessage, 'branch-action')
        return {ok: false, message: errorMessage}
      }
    },

    on: (channelId: string, handler: (...args: any[]) => any) => {
      try {
        validateChannelId(channelId)

        const prefixedId = prefixId(channelId)

        const result = cyre.on(prefixedId, handler)

        sensor.log(branchId, 'info', 'branch-subscription', {
          originalId: channelId,
          prefixedId,
          branchPath: path
        })

        return {
          ...result,
          unsubscribe: () => {
            const success = cyre.forget(prefixedId)
            if (success) {
              sensor.log(branchId, 'info', 'branch-unsubscribe', {
                prefixedId
              })
            }
            return success
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(branchId, errorMessage, 'branch-subscription')
        return {ok: false, message: errorMessage}
      }
    },

    call: async (
      target: string,
      payload?: ActionPayload
    ): Promise<CyreResponse> => {
      try {
        const resolvedTarget = resolveTarget(target)

        sensor.log(branchId, 'call', 'branch-call', {
          originalTarget: target,
          resolvedTarget,
          branchPath: path,
          crossBranch: !target.startsWith(path),
          parentAccess: target.startsWith('../')
        })

        // Delegate to core cyre - gets all protections, talents, metrics!
        const result = await cyre.call(resolvedTarget, payload)

        return {
          ...result,
          metadata: {
            ...result.metadata,
            sourceBranch: branchId,
            sourceBranchPath: path,
            originalTarget: target,
            resolvedTarget
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(branchId, errorMessage, 'branch-call')

        return {
          ok: false,
          payload: null,
          message: `Branch call failed: ${errorMessage}`
        }
      }
    },

    get: (channelId: string) => {
      try {
        validateChannelId(channelId)
        return cyre.get(prefixId(channelId))
      } catch (error) {
        return undefined
      }
    },

    forget: (channelId: string) => {
      try {
        validateChannelId(channelId)
        const success = cyre.forget(prefixId(channelId))

        if (success) {
          sensor.log(branchId, 'info', 'branch-forget', {
            channelId: prefixId(channelId)
          })
        }

        return success
      } catch (error) {
        return false
      }
    },

    // Branch-specific methods
    createChild: (childConfig?: BranchConfig) => {
      return createBranch(branch, childConfig)
    },

    destroyChild: (childBranchId: string) => {
      // Since we don't maintain child references, we need to use cyre's query system
      const childPath = `${path}/${childBranchId}`

      try {
        // Find all channels in child branch and remove them
        const channels = cyre.query.channels({
          channelPattern: `${childPath}/*`
        })

        let removedCount = 0
        channels.channels.forEach((channel: any) => {
          if (cyre.forget(channel.id)) {
            removedCount++
          }
        })

        sensor.log(branchId, 'info', 'branch-child-destroyed', {
          childPath,
          removedChannels: removedCount
        })

        return removedCount > 0
      } catch (error) {
        sensor.error(branchId, String(error), 'branch-child-destroy')
        return false
      }
    },

    getChild: (childBranchId: string) => {
      // Since children are just path prefixes, we can create a branch wrapper
      const childPath = `${path}/${childBranchId}`

      // Check if child has any channels
      const channels = cyre.query.channels({
        channelPattern: `${childPath}/*`
      })

      if (channels.channels.length === 0) {
        return undefined
      }

      // Return branch wrapper for existing child
      return createBranchWrapper(childBranchId, childPath, branch)
    },

    getChildren: () => {
      const channels = cyre.query.channels({
        channelPattern: `${path}/*/*` // One level down
      })

      // Extract unique child branch IDs
      const childPaths = new Set<string>()
      channels.channels.forEach((channel: any) => {
        const relativePath = channel.id.replace(`${path}/`, '')
        const firstSegment = relativePath.split('/')[0]
        if (firstSegment) {
          childPaths.add(firstSegment)
        }
      })

      // Create branch wrappers for each child
      return Array.from(childPaths).map(childId =>
        createBranchWrapper(childId, `${path}/${childId}`, branch)
      )
    },

    destroy: () => {
      try {
        // Find all channels in this branch and remove them
        const channels = cyre.query.channels({
          channelPattern: `${path}/*`
        })

        let removedCount = 0
        channels.channels.forEach((channel: any) => {
          if (cyre.forget(channel.id)) {
            removedCount++
          }
        })

        sensor.log(branchId, 'info', 'branch-destroyed', {
          branchPath: path,
          removedChannels: removedCount
        })

        return removedCount > 0
      } catch (error) {
        sensor.error(branchId, String(error), 'branch-destroy')
        return false
      }
    },

    // Utilities
    isActive: () => {
      // Branch is active if it has any channels
      const channels = cyre.query.channels({
        channelPattern: `${path}/*`
      })
      return channels.channels.length > 0
    },

    getStats: (): BranchStats => {
      const channels = cyre.query.channels({
        channelPattern: `${path}/*`
      })

      const subscribers = channels.channels.filter(
        (ch: any) => ch.hasSubscriber
      ).length

      return {
        id: branchId,
        path,
        channelCount: channels.channels.length,
        subscriberCount: subscribers,
        timerCount: 0, // Could be calculated from timeline
        childCount: branch.getChildren().length,
        depth: path.split('/').filter(Boolean).length,
        createdAt: Date.now(), // Could store this
        isActive: channels.channels.length > 0
      }
    },

    setup: (setupConfig: BranchSetup) => {
      try {
        let successCount = 0
        let errorCount = 0

        // Setup actions
        if (setupConfig.actions) {
          for (const actionConfig of setupConfig.actions) {
            const result = branch.action(actionConfig as IO)
            if (result.ok) successCount++
            else errorCount++
          }
        }

        // Setup subscriptions
        if (setupConfig.subscriptions) {
          for (const sub of setupConfig.subscriptions) {
            const result = branch.on(sub.id, sub.handler)
            if (result.ok) successCount++
            else errorCount++
          }
        }

        const message =
          errorCount > 0
            ? `Setup completed with ${errorCount} errors: ${successCount} successful, ${errorCount} failed`
            : `Setup completed: ${successCount} items configured successfully`

        return {
          ok: errorCount === 0,
          message
        }
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

  sensor.log(branchId, 'success', 'branch-created', {
    path,
    parentPath: parent?.path,
    config
  })

  return branch
}

/**
 * Create lightweight branch wrapper for existing branch paths
 */
const createBranchWrapper = (
  id: string,
  path: string,
  parent?: Branch
): Branch => {
  return {
    id,
    path,
    parent,

    // Minimal implementation - could delegate to full createBranch if needed
    action: () => ({
      ok: false,
      message: 'Use createBranch for full functionality'
    }),
    on: () => ({ok: false, message: 'Use createBranch for full functionality'}),
    call: async () => ({
      ok: false,
      payload: null,
      message: 'Use createBranch for full functionality'
    }),
    get: () => undefined,
    forget: () => false,
    createChild: (config?: BranchConfig) => createBranch(parent, config),
    destroyChild: () => false,
    getChild: () => undefined,
    getChildren: () => [],
    destroy: () => false,
    isActive: () => false,
    getStats: () => ({
      id,
      path,
      channelCount: 0,
      subscriberCount: 0,
      timerCount: 0,
      childCount: 0,
      depth: path.split('/').filter(Boolean).length,
      createdAt: 0,
      isActive: false
    }),
    setup: () => ({
      ok: false,
      message: 'Use createBranch for full functionality'
    })
  }
}
