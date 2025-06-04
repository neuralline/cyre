// src/types/branch.ts
// Branch system types with unified path addressing

import type {IO, CyreResponse, SubscriptionResponse} from './core'

/**
 * Branch configuration options
 */
export interface BranchConfig {
  /** Branch identifier (auto-generated if not provided) */
  id?: string
  /** Custom path segment (uses id if not provided) */
  pathSegment?: string
  /** Whether to isolate completely or allow cross-branch calls */
  isolated?: boolean
  /** Maximum depth for child branches */
  maxDepth?: number
  /** Auto-cleanup when no channels remain */
  autoCleanup?: boolean
}

/**
 * Branch interface - subset of main Cyre API scoped to branch
 */
// src/types/branch.ts -
export interface Branch {
  id: string
  path: string
  parent?: Branch

  // Core methods (delegate to main cyre)
  action: (config: IO) => {ok: boolean; message: string}
  on: (id: string, handler: any) => SubscriptionResponse
  call: (target: string, payload?: any) => Promise<CyreResponse>
  get: (id: string) => IO | undefined
  forget: (id: string) => boolean

  // Branch methods
  createChild: (config?: BranchConfig) => Branch
  destroyChild: (childId: string) => boolean
  getChild: (childId: string) => Branch | undefined
  getChildren: () => Branch[]
  destroy: () => boolean
  isActive: () => boolean
  getStats: () => BranchStats
  setup: (config: BranchSetup) => {ok: boolean; message: string}
}

export interface BranchConfig {
  id?: string
  pathSegment?: string
  maxDepth?: number
}

// Remove these interfaces - not needed anymore:
// - BranchContext
// - BranchRegistry
// - CallResolution

/**
 * Branch statistics
 */
export interface BranchStats {
  id: string
  path: string
  channelCount: number
  subscriberCount: number
  timerCount: number
  childCount: number
  depth: number
  createdAt: number
  isActive: boolean
}

/**
 * Branch setup configuration for component duplication
 */
export interface BranchSetup {
  actions?: Partial<IO>[]
  subscriptions?: Array<{
    id: string
    handler: (...args: any[]) => any
  }>
  orchestrations?: any[]
}
