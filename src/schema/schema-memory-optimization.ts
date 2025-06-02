// src/schema/schema-memory-optimization.ts
// Schema memory optimization with object pooling

import type {Schema} from './cyre-schema'

/*

      C.Y.R.E - S.C.H.E.M.A - M.E.M.O.R.Y
      
      Memory optimization for schema validation:
      - Schema caching
      - Validation result pooling
      - Memory usage tracking
      - Performance optimization

*/

interface CachedValidationResult {
  ok: boolean
  data?: any
  errors?: string[]
}

interface CacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
}

interface MemoryStats {
  schemasSize: number
  poolSize: number
  totalAllocations: number
  currentAllocations: number
}

// Configuration
const CACHE_CONFIG = {
  MAX_SCHEMAS: 100,
  MAX_POOL_SIZE: 50,
  CLEANUP_THRESHOLD: 0.8
}

// Schema cache
const schemaCache = new Map<string, Schema>()

// Validation result pool
const validationResultPool: CachedValidationResult[] = []

// Statistics
let cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  size: 0,
  maxSize: CACHE_CONFIG.MAX_SCHEMAS
}

let memoryStats: MemoryStats = {
  schemasSize: 0,
  poolSize: 0,
  totalAllocations: 0,
  currentAllocations: 0
}

/**
 * Schema cache management
 */
export const optimizedSchemaCache = {
  /**
   * Get schema from cache
   */
  get: (key: string): Schema | undefined => {
    const schema = schemaCache.get(key)
    if (schema) {
      cacheStats.hits++
      return schema
    }
    cacheStats.misses++
    return undefined
  },

  /**
   * Set schema in cache
   */
  set: (key: string, schema: Schema): void => {
    // Check if we need to cleanup
    if (schemaCache.size >= CACHE_CONFIG.MAX_SCHEMAS) {
      cleanup()
    }

    schemaCache.set(key, schema)
    cacheStats.size = schemaCache.size
    memoryStats.schemasSize = schemaCache.size
  },

  /**
   * Check if schema exists in cache
   */
  has: (key: string): boolean => {
    return schemaCache.has(key)
  },

  /**
   * Clear all cached schemas
   */
  clear: (): void => {
    schemaCache.clear()
    cacheStats.size = 0
    cacheStats.hits = 0
    cacheStats.misses = 0
    memoryStats.schemasSize = 0
  },

  /**
   * Get validation result from pool
   */
  getValidationResult: (): CachedValidationResult => {
    memoryStats.totalAllocations++
    memoryStats.currentAllocations++

    if (validationResultPool.length > 0) {
      const result = validationResultPool.pop()!
      // Reset the result
      result.ok = false
      result.data = undefined
      result.errors = undefined
      return result
    }

    // Create new result if pool is empty
    return {
      ok: false,
      data: undefined,
      errors: undefined
    }
  },

  /**
   * Release validation result back to pool
   */
  releaseValidationResult: (result: CachedValidationResult): void => {
    memoryStats.currentAllocations--

    if (validationResultPool.length < CACHE_CONFIG.MAX_POOL_SIZE) {
      // Reset before returning to pool
      result.ok = false
      result.data = undefined
      result.errors = undefined
      validationResultPool.push(result)
      memoryStats.poolSize = validationResultPool.length
    }
  },

  /**
   * Get cache statistics
   */
  getStats: (): CacheStats => {
    return {...cacheStats}
  },

  /**
   * Get memory statistics
   */
  getMemoryStats: (): MemoryStats => {
    return {...memoryStats}
  },

  /**
   * Get cache hit ratio
   */
  getHitRatio: (): number => {
    const total = cacheStats.hits + cacheStats.misses
    return total > 0 ? cacheStats.hits / total : 0
  },

  /**
   * Force cleanup
   */
  cleanup: (): void => {
    cleanup()
  }
}

/**
 * Cleanup old cache entries using LRU strategy
 */
const cleanup = (): void => {
  const targetSize = Math.floor(
    CACHE_CONFIG.MAX_SCHEMAS * CACHE_CONFIG.CLEANUP_THRESHOLD
  )
  const keysToRemove = Array.from(schemaCache.keys()).slice(
    0,
    schemaCache.size - targetSize
  )

  keysToRemove.forEach(key => {
    schemaCache.delete(key)
  })

  cacheStats.size = schemaCache.size
  memoryStats.schemasSize = schemaCache.size
}

/**
 * Warmup cache with common schemas
 */
export const warmupSchemaCache = (): void => {
  // This could be populated with commonly used schemas
  // For now, it's a placeholder for future optimization
}

/**
 * Get memory usage report
 */
export const getMemoryReport = () => {
  const hitRatio = optimizedSchemaCache.getHitRatio()

  return {
    cache: {
      schemas: cacheStats.size,
      maxSchemas: cacheStats.maxSize,
      hitRatio: (hitRatio * 100).toFixed(2) + '%',
      hits: cacheStats.hits,
      misses: cacheStats.misses
    },
    pool: {
      size: memoryStats.poolSize,
      maxSize: CACHE_CONFIG.MAX_POOL_SIZE,
      utilizationRatio:
        ((memoryStats.poolSize / CACHE_CONFIG.MAX_POOL_SIZE) * 100).toFixed(2) +
        '%'
    },
    allocations: {
      total: memoryStats.totalAllocations,
      current: memoryStats.currentAllocations,
      pooled: memoryStats.poolSize
    }
  }
}
