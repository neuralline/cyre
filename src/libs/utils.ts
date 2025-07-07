// src/libs/utils.ts

/*

      C.Y.R.E - U.T.I.L.I.T.I.E.S
      
      Simple utility functions:
      - Path validation using branch store
      - Lightweight alternatives to complex systems
      - Performance-focused implementations

*/
/**
 * Composes multiple functions from left to right
 * @template T - Value type
 * @param {T} initialValue - Starting value
 * @param {Array<(value: T) => T>} fns - Functions to compose
 * @returns {T} Final transformed value
 * @example
 * const result = pipe(5,
 *   n => n * 2,
 *   n => n + 1
 * ) // Returns 11
 */
export const pipe = <T>(initialValue: T, ...fns: Array<(value: T) => T>): T => {
  return fns.reduce((value, fn) => fn(value), initialValue)
}
/**
 * Deep equality comparison with special handling for arrays and objects
 */
export const isEqual = (a: any, b: any): boolean => {
  // Same reference
  if (a === b) return true

  // Null/undefined checks
  if (a == null || b == null) return a === b

  // Type check
  if (typeof a !== typeof b) return false

  // Primitive types
  if (typeof a !== 'object') return a === b

  // Array comparison
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false
    }
    return true
  }

  // Date comparison
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  // RegExp comparison
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString()
  }

  // Object comparison
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!keysB.includes(key)) return false
    if (!isEqual(a[key], b[key])) return false
  }

  return true
}

/**
 * Polyfill for crypto.randomUUID() in test environments
 * This resolves the "crypto is not defined" error in tests
 */

// Check if crypto is available globally
if (typeof crypto === 'undefined') {
  // Create a simple polyfill for minimal crypto functionality
  // @ts-ignore - we're intentionally adding to the global scope
  global.crypto = {
    // Simple UUID v4 implementation for tests
    randomUUID: (): `${string}-${string}-${string}-${string}-${string}` => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }) as `${string}-${string}-${string}-${string}-${string}` // Cast to the expected type
    },
    // Simple implementation of getRandomValues for tests
    getRandomValues: <T extends Uint8Array>(array: T | any): T | any => {
      if (array === null) return null // Handle null case
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256) // No need for casting
      }
      return array
    }
  }
}

export {}

/**
 * Option type for handling nullable values
 */
export type Option<T> = {kind: 'some'; value: T} | {kind: 'none'}

/**
 * Creates an Option from a nullable value
 */
export const fromNullable = <T>(value: T | null | undefined): Option<T> =>
  value != null ? {kind: 'some', value} : {kind: 'none'}

/**
 * Result type for handling operations that may fail
 */
export type Result<T, E = Error> =
  | {kind: 'ok'; value: T}
  | {kind: 'error'; error: E}

/**
 * Lens type for immutable state updates
 */
export type Lens<S, A> = {
  get: (s: S) => A
  set: (a: A, s: S) => S
}

/**
 * Creates a lens for a specific property
 */
export const lens = <S, A>(prop: keyof S): Lens<S, A> => ({
  get: (s: S) => s[prop] as unknown as A,
  set: (a: A, s: S) => ({...s, [prop]: a})
})

/**
 * Simple path validation using branch store
 * Replaces complex path-engine validation for basic checks
 */
export const isValidPath = (path: string): boolean => {
  if (!path || typeof path !== 'string') return false

  // Basic format validation
  if (path.startsWith('/') || path.endsWith('/')) return false
  if (path.includes('//')) return false
  if (path.includes(' ') && path.trim() !== path) return false

  // Parse segments
  const segments = path
    .split('/')
    .filter(segment => segment.length > 0 && segment.trim().length > 0)
    .map(segment => segment.trim())

  if (segments.length === 0) return false

  // Validate each segment
  return segments.every(segment => {
    // Allow alphanumeric with hyphens/underscores (no wildcards for basic validation)
    return /^[a-zA-Z0-9\-_]+$/.test(segment)
  })
}

/**
 * Memoization utility with proper cache management
 */
export const memoize = <TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  keyResolver?: (...args: TArgs) => string
): ((...args: TArgs) => TReturn) => {
  const cache = new Map<string, TReturn>()
  const maxCacheSize = 100

  return (...args: TArgs): TReturn => {
    const key = keyResolver ? keyResolver(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)

    // Manage cache size
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }

    cache.set(key, result)
    return result
  }
}
