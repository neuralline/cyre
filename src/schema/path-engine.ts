// src/schema/path-engine.ts
// High-performance path resolution with foreign key indexing

import {io} from '../context/state'
import type {IO, StateKey} from '../types/core'
import {createStore} from '../context/create-store'

/*

      C.Y.R.E - P.A.T.H - E.N.G.I.N.E
      
      High-performance hierarchical path system:
      - Foreign key indexing for O(1) lookups
      - Pattern matching with wildcards
      - Path-based channel organization
      - Efficient tree traversal
      - Proper wildcard handling

*/

// Path matching types
export interface PathMatch {
  id: string
  path: string
  segments: string[]
  depth: number
  exactMatch: boolean
}

export interface PathPattern {
  pattern: string
  segments: string[]
  hasWildcards: boolean
  depth: number
}

export interface PathNode {
  segment: string
  channels: Set<string>
  children: Map<string, PathNode>
  wildcardChildren: Set<string>
}

// Foreign key indexes for O(1) performance
const pathToChannels = createStore<Set<string>>() // path -> channel IDs
const segmentToChannels = createStore<Set<string>>() // segment -> channel IDs
const depthToChannels = createStore<Set<string>>() // depth -> channel IDs
const channelToPaths = createStore<string>() // channel ID -> path

// Root of path tree for traversal
let pathTree: PathNode = {
  segment: '',
  channels: new Set(),
  children: new Map(),
  wildcardChildren: new Set()
}

/**
 * Parse path into normalized segments
 */
const parsePath = (path: string): string[] => {
  if (!path || typeof path !== 'string') return []

  return path
    .split('/')
    .filter(segment => segment.length > 0 && segment.trim().length > 0)
    .map(segment => segment.trim())
}

/**
 * Add channel to path indexes (foreign keys)
 */
const addToIndexes = (channelId: string, path: string): void => {
  const segments = parsePath(path)
  const depth = segments.length

  // Path -> Channels index
  const pathChannels = pathToChannels.get(path) || new Set()
  pathChannels.add(channelId)
  pathToChannels.set(path, pathChannels)

  // Segment -> Channels index (for wildcard matching)
  segments.forEach(segment => {
    const segmentChannels = segmentToChannels.get(segment) || new Set()
    segmentChannels.add(channelId)
    segmentToChannels.set(segment, segmentChannels)
  })

  // Depth -> Channels index (for depth-based queries)
  const depthKey = depth.toString()
  const depthChannels = depthToChannels.get(depthKey) || new Set()
  depthChannels.add(channelId)
  depthToChannels.set(depthKey, depthChannels)

  // Channel -> Path reverse lookup
  channelToPaths.set(channelId, path)

  // Add to tree structure
  addToTree(channelId, segments)
}

/**
 * Remove channel from path indexes
 */
const removeFromIndexes = (channelId: string): void => {
  const path = channelToPaths.get(channelId)
  if (!path) return

  const segments = parsePath(path)
  const depth = segments.length

  // Remove from path index
  const pathChannels = pathToChannels.get(path)
  if (pathChannels) {
    pathChannels.delete(channelId)
    if (pathChannels.size === 0) {
      pathToChannels.forget(path)
    } else {
      pathToChannels.set(path, pathChannels)
    }
  }

  // Remove from segment indexes
  segments.forEach(segment => {
    const segmentChannels = segmentToChannels.get(segment)
    if (segmentChannels) {
      segmentChannels.delete(channelId)
      if (segmentChannels.size === 0) {
        segmentToChannels.forget(segment)
      } else {
        segmentToChannels.set(segment, segmentChannels)
      }
    }
  })

  // Remove from depth index
  const depthKey = depth.toString()
  const depthChannels = depthToChannels.get(depthKey)
  if (depthChannels) {
    depthChannels.delete(channelId)
    if (depthChannels.size === 0) {
      depthToChannels.forget(depthKey)
    } else {
      depthToChannels.set(depthKey, depthChannels)
    }
  }

  // Remove reverse lookup
  channelToPaths.forget(channelId)

  // Remove from tree
  removeFromTree(channelId, segments)
}

/**
 * Add channel to path tree
 */
const addToTree = (channelId: string, segments: string[]): void => {
  let currentNode = pathTree

  for (const segment of segments) {
    if (!currentNode.children.has(segment)) {
      currentNode.children.set(segment, {
        segment,
        channels: new Set(),
        children: new Map(),
        wildcardChildren: new Set()
      })
    }
    currentNode = currentNode.children.get(segment)!
  }

  currentNode.channels.add(channelId)
}

/**
 * Remove channel from path tree
 */
const removeFromTree = (channelId: string, segments: string[]): void => {
  const nodePath: PathNode[] = [pathTree]
  let currentNode = pathTree

  // Build path to leaf node
  for (const segment of segments) {
    const nextNode = currentNode.children.get(segment)
    if (!nextNode) return
    nodePath.push(nextNode)
    currentNode = nextNode
  }

  // Remove channel from leaf
  currentNode.channels.delete(channelId)

  // Clean up empty nodes (bottom-up)
  for (let i = nodePath.length - 1; i > 0; i--) {
    const node = nodePath[i]
    if (node.channels.size === 0 && node.children.size === 0) {
      const parentNode = nodePath[i - 1]
      parentNode.children.delete(node.segment)
    } else {
      break // Stop if node still has content
    }
  }
}

/**
 * Match pattern against segments using foreign key indexes
 */
const matchPattern = (pattern: string): PathMatch[] => {
  const patternSegments = parsePath(pattern)

  if (patternSegments.length === 0) {
    return []
  }

  const hasWildcards = patternSegments.some(
    segment => segment === '*' || segment === '**'
  )

  // Fast path: exact match using foreign key
  if (!hasWildcards) {
    const exactChannels = pathToChannels.get(pattern)
    if (exactChannels) {
      return Array.from(exactChannels).map(channelId => ({
        id: channelId,
        path: pattern,
        segments: patternSegments,
        depth: patternSegments.length,
        exactMatch: true
      }))
    }
    return []
  }

  // Wildcard matching using tree traversal with indexes
  return matchWildcardPattern(patternSegments)
}

/**
 * Wildcard pattern matching with proper depth handling
 */
const matchWildcardPattern = (patternSegments: string[]): PathMatch[] => {
  const matches: PathMatch[] = []

  const traverse = (
    node: PathNode,
    segmentIndex: number,
    currentPath: string[]
  ): void => {
    // Base case: reached end of pattern
    if (segmentIndex >= patternSegments.length) {
      // Only add channels that are at this exact node (complete paths only)
      node.channels.forEach(channelId => {
        const fullPath = currentPath.join('/')
        matches.push({
          id: channelId,
          path: fullPath,
          segments: [...currentPath],
          depth: currentPath.length,
          exactMatch: false
        })
      })
      return
    }

    const currentPattern = patternSegments[segmentIndex]

    if (currentPattern === '*') {
      // Single wildcard: match exactly one segment at this level
      node.children.forEach((childNode, segment) => {
        traverse(childNode, segmentIndex + 1, [...currentPath, segment])
      })
    } else if (currentPattern === '**') {
      // Multi-level wildcard: match any number of segments

      // Option 1: Consume ** without advancing path (match zero segments)
      traverse(node, segmentIndex + 1, currentPath)

      // Option 2: Match one or more segments recursively
      const traverseDeep = (deepNode: PathNode, deepPath: string[]) => {
        // Try to advance past ** at current depth
        traverse(deepNode, segmentIndex + 1, deepPath)

        // Recurse deeper with ** still active
        deepNode.children.forEach((childNode, segment) => {
          traverseDeep(childNode, [...deepPath, segment])
        })
      }

      traverseDeep(node, currentPath)
    } else {
      // Exact segment match
      const childNode = node.children.get(currentPattern)
      if (childNode) {
        traverse(childNode, segmentIndex + 1, [...currentPath, currentPattern])
      }
    }
  }

  traverse(pathTree, 0, [])

  // Remove duplicates (can happen with ** patterns)
  const uniqueMatches = new Map<string, PathMatch>()
  matches.forEach(match => {
    const key = `${match.id}:${match.path}`
    if (!uniqueMatches.has(key)) {
      uniqueMatches.set(key, match)
    }
  })

  return Array.from(uniqueMatches.values())
}

/**
 * Get channels by path depth (using foreign key index)
 */
const getChannelsByDepth = (depth: number): string[] => {
  const depthChannels = depthToChannels.get(depth.toString())
  return depthChannels ? Array.from(depthChannels) : []
}

/**
 * Get channels containing specific segment (using foreign key index)
 */
const getChannelsBySegment = (segment: string): string[] => {
  const segmentChannels = segmentToChannels.get(segment)
  return segmentChannels ? Array.from(segmentChannels) : []
}

/**
 * Build path tree for visualization
 */
const buildPathTree = (): PathNode => {
  return pathTree
}

/**
 * Get path statistics
 */
const getPathStats = () => {
  const allChannels = io.getAll()
  const channelsWithPaths = allChannels.filter(channel => channel.path)

  const depths = channelsWithPaths
    .map(channel => parsePath(channel.path || '').length)
    .filter(depth => depth > 0)

  return {
    totalChannels: allChannels.length,
    channelsWithPaths: channelsWithPaths.length,
    uniquePaths: pathToChannels.size(),
    uniqueSegments: segmentToChannels.size(),
    maxDepth: depths.length > 0 ? Math.max(...depths) : 0,
    averageDepth:
      depths.length > 0
        ? depths.reduce((sum, depth) => sum + depth, 0) / depths.length
        : 0
  }
}

/**
 * Main path engine API
 */
export const pathEngine = {
  // Core operations
  add: addToIndexes,
  remove: removeFromIndexes,

  // Pattern matching with foreign key optimization
  match: matchPattern,

  // Fast lookups using foreign keys
  getByDepth: getChannelsByDepth,
  getBySegment: getChannelsBySegment,
  getPath: (channelId: string): string | undefined =>
    channelToPaths.get(channelId),

  // Tree operations
  tree: buildPathTree,

  // Utilities
  parse: parsePath,
  stats: getPathStats,

  // Validation
  isValidPath: (path: string): boolean => {
    if (!path || typeof path !== 'string') return false

    // Check for invalid patterns
    if (path.startsWith('/') || path.endsWith('/')) return false
    if (path.includes('//')) return false
    if (path.includes(' ') && path.trim() !== path) return false

    const segments = parsePath(path)
    if (segments.length === 0) return false

    // Check each segment for validity
    return segments.every(segment => {
      // Allow wildcards and basic alphanumeric with hyphens/underscores
      return /^[a-zA-Z0-9\-_*]+$/.test(segment)
    })
  },

  // Clear all indexes (for testing/reset)
  clear: (): void => {
    pathToChannels.clear()
    segmentToChannels.clear()
    depthToChannels.clear()
    channelToPaths.clear()
    pathTree = {
      segment: '',
      channels: new Set(),
      children: new Map(),
      wildcardChildren: new Set()
    }
  }
}
