// src/schema/schema-memory-optimization.ts
// Memory optimization for schema validation system

import {log} from '../components/cyre-log'

/*

      C.Y.R.E - S.C.H.E.M.A - M.E.M.O.R.Y - O.P.T.I.M.I.Z.A.T.I.O.N
      
      Memory management for schema validation:
      - Object pooling for validation results
      - Cache size limits and cleanup
      - Memory leak prevention
      - Performance monitoring

*/

interface CacheEntry<T = any> {
  value: T
  lastAccess: number
  accessCount: number
  size: number // Estimated memory usage in bytes
}

interface CacheStats {
  totalEntries: number
  totalMemoryUsage: number
  hitRate: number
  missRate: number
  evictionCount: number
}

// Configuration
const CACHE_CONFIG = {
  MAX_ENTRIES: 100,
  MAX_MEMORY_MB: 10,
  CLEANUP_INTERVAL: 30000, // 30 seconds
  TTL: 300000, // 5 minutes
  EVICTION_THRESHOLD: 0.8 // Start eviction at 80% capacity
}

// Enhanced cache with memory management
class MemoryManagedCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalMemoryUsage: 0
  }
  private cleanupTimer?: NodeJS.Timeout

  constructor() {
    this.startCleanupTimer()
  }

  set(key: string, value: T): void {
    const estimatedSize = this.estimateSize(value)
    const now = Date.now()

    // Check if we need to evict before adding
    if (this.shouldEvict(estimatedSize)) {
      this.evictLeastUsed()
    }

    // Remove existing entry if present
    const existing = this.cache.get(key)
    if (existing) {
      this.stats.totalMemoryUsage -= existing.size
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      lastAccess: now,
      accessCount: 1,
      size: estimatedSize
    }

    this.cache.set(key, entry)
    this.stats.totalMemoryUsage += estimatedSize
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (entry) {
      // Update access stats
      entry.lastAccess = Date.now()
      entry.accessCount++
      this.stats.hits++
      return entry.value
    } else {
      this.stats.misses++
      return undefined
    }
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (entry) {
      this.stats.totalMemoryUsage -= entry.size
      return this.cache.delete(key)
    }
    return false
  }

  clear(): void {
    this.cache.clear()
    this.stats.totalMemoryUsage = 0
    this.stats.evictions = 0
  }

  size(): number {
    return this.cache.size
  }

  getStats(): CacheStats {
    const totalAccess = this.stats.hits + this.stats.misses
    return {
      totalEntries: this.cache.size,
      totalMemoryUsage: this.stats.totalMemoryUsage,
      hitRate: totalAccess > 0 ? this.stats.hits / totalAccess : 0,
      missRate: totalAccess > 0 ? this.stats.misses / totalAccess : 0,
      evictionCount: this.stats.evictions
    }
  }

  private shouldEvict(newEntrySize: number): boolean {
    const wouldExceedMemory =
      this.stats.totalMemoryUsage + newEntrySize >
      CACHE_CONFIG.MAX_MEMORY_MB * 1024 * 1024

    const wouldExceedEntries =
      this.cache.size >=
      CACHE_CONFIG.MAX_ENTRIES * CACHE_CONFIG.EVICTION_THRESHOLD

    return wouldExceedMemory || wouldExceedEntries
  }

  private evictLeastUsed(): void {
    if (this.cache.size === 0) return

    // Find least recently used entry
    let lruKey = ''
    let lruTime = Date.now()

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess
        lruKey = key
      }
    }

    if (lruKey) {
      this.delete(lruKey)
      this.stats.evictions++
    }
  }

  private estimateSize(value: any): number {
    // Simple size estimation
    try {
      if (typeof value === 'string') {
        return value.length * 2 // Unicode characters
      }

      if (typeof value === 'function') {
        return value.toString().length * 2 + 100 // Function overhead
      }

      if (typeof value === 'object' && value !== null) {
        // Rough estimation for objects
        const jsonString = JSON.stringify(value)
        return jsonString.length * 2 + 50 // Object overhead
      }

      return 50 // Default for primitives
    } catch {
      return 100 // Fallback for circular references
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, CACHE_CONFIG.CLEANUP_INTERVAL)
  }

  private cleanup(): void {
    const now = Date.now()
    const entriesToRemove: string[] = []

    // Find expired entries
    for (const [key, entry] of this.cache) {
      if (now - entry.lastAccess > CACHE_CONFIG.TTL) {
        entriesToRemove.push(key)
      }
    }

    // Remove expired entries
    entriesToRemove.forEach(key => {
      this.delete(key)
      this.stats.evictions++
    })

    // Log cleanup stats if significant
    if (entriesToRemove.length > 0) {
      log.debug(
        `Schema cache cleanup: removed ${entriesToRemove.length} expired entries`
      )
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
  }
}

// Object pool for validation results
class ValidationResultPool {
  private pool: Array<{ok: boolean; data?: any; errors?: string[]}> = []
  private maxSize = 50

  get(): {ok: boolean; data?: any; errors?: string[]} {
    if (this.pool.length > 0) {
      const result = this.pool.pop()!
      // Reset the object
      result.ok = false
      result.data = undefined
      result.errors = undefined
      return result
    }

    return {ok: false}
  }

  release(result: {ok: boolean; data?: any; errors?: string[]}): void {
    if (this.pool.length < this.maxSize) {
      // Clear references to prevent memory leaks
      result.data = undefined
      result.errors = undefined
      this.pool.push(result)
    }
  }

  clear(): void {
    this.pool.length = 0
  }

  size(): number {
    return this.pool.length
  }
}

// Global instances
const schemaCache = new MemoryManagedCache()
const validationPool = new ValidationResultPool()

// Enhanced schema caching with memory management
export const optimizedSchemaCache = {
  set: <T>(key: string, value: T): void => {
    schemaCache.set(key, value)
  },

  get: <T>(key: string): T | undefined => {
    return schemaCache.get(key)
  },

  has: (key: string): boolean => {
    return schemaCache.has(key)
  },

  delete: (key: string): boolean => {
    return schemaCache.delete(key)
  },

  clear: (): void => {
    schemaCache.clear()
    validationPool.clear()
  },

  getStats: (): CacheStats => {
    return schemaCache.getStats()
  },

  // Memory optimization utilities
  optimizeMemory: (): void => {
    // Force cleanup
    schemaCache.cleanup()

    // Run garbage collection if available
    if (typeof global !== 'undefined' && (global as any).gc) {
      ;(global as any).gc()
    }
  },

  // Get pooled validation result
  getValidationResult: (): {ok: boolean; data?: any; errors?: string[]} => {
    return validationPool.get()
  },

  // Release validation result back to pool
  releaseValidationResult: (result: {
    ok: boolean
    data?: any
    errors?: string[]
  }): void => {
    validationPool.release(result)
  },

  // Memory monitoring
  getMemoryStats: () => ({
    cache: schemaCache.getStats(),
    pool: {
      size: validationPool.size(),
      maxSize: 50
    },
    recommendations: generateMemoryRecommendations()
  })
}

// Generate memory optimization recommendations
const generateMemoryRecommendations = (): string[] => {
  const stats = schemaCache.getStats()
  const recommendations: string[] = []

  if (stats.totalMemoryUsage > CACHE_CONFIG.MAX_MEMORY_MB * 1024 * 1024 * 0.8) {
    recommendations.push(
      'Consider reducing schema cache size or increasing memory limit'
    )
  }

  if (stats.hitRate < 0.7) {
    recommendations.push(
      'Low cache hit rate - consider optimizing schema reuse patterns'
    )
  }

  if (stats.evictionCount > 100) {
    recommendations.push('High eviction count - consider increasing cache size')
  }

  if (recommendations.length === 0) {
    recommendations.push('Memory usage is optimal')
  }

  return recommendations
}

// Memory monitoring for integration
export const memoryMonitor = {
  startMonitoring: (intervalMs = 60000): NodeJS.Timeout => {
    return setInterval(() => {
      const stats = optimizedSchemaCache.getMemoryStats()

      if (
        stats.cache.totalMemoryUsage >
        CACHE_CONFIG.MAX_MEMORY_MB * 1024 * 1024 * 0.9
      ) {
        log.warn(
          `Schema cache memory usage high: ${(
            stats.cache.totalMemoryUsage /
            1024 /
            1024
          ).toFixed(2)}MB`
        )
      }

      if (stats.cache.hitRate < 0.5) {
        log.warn(
          `Schema cache hit rate low: ${(stats.cache.hitRate * 100).toFixed(
            1
          )}%`
        )
      }
    }, intervalMs)
  },

  getReport: (): string => {
    const stats = optimizedSchemaCache.getMemoryStats()
    const memoryMB = stats.cache.totalMemoryUsage / 1024 / 1024

    return `Schema Memory Report:
- Cache Entries: ${stats.cache.totalEntries}
- Memory Usage: ${memoryMB.toFixed(2)}MB
- Hit Rate: ${(stats.cache.hitRate * 100).toFixed(1)}%
- Pool Size: ${stats.pool.size}/${stats.pool.maxSize}
- Recommendations: ${stats.recommendations.join(', ')}`
  }
}

// Cleanup function for shutdown
export const cleanupSchemaMemory = (): void => {
  schemaCache.destroy()
  validationPool.clear()
  log.debug('Schema memory cleanup completed')
}
