// src/libs/utils.ts

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
 * Wraps a function to measure its execution time
 */
export const measurePerformance = <TArgs extends Array<unknown>, TResult>(
  fn: (...args: TArgs) => TResult,
  name: string
): ((...args: TArgs) => TResult) => {
  return (...args: TArgs) => {
    const start = performance.now()
    try {
      const result = fn(...args)
      const end = performance.now()
      console.debug(`${name} took ${(end - start).toFixed(2)}ms`)
      return result
    } catch (error) {
      const end = performance.now()
      console.error(`${name} failed after ${(end - start).toFixed(2)}ms`, error)
      throw error
    }
  }
}

// src/utils/crypto-polyfill.ts

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
 * Creates a Result from a try/catch block
 */
export const tryCatch = async <T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> => {
  try {
    const value = await fn()
    return {kind: 'ok', value}
  } catch (error) {
    return {
      kind: 'error',
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

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
 * Effect type for handling async operations
 */
export type Effect<T> = () => Promise<T>

/**
 * Creates an Effect wrapper with map and chain operations
 */
export const withEffect = <T>(effect: Effect<T>) => ({
  map: <U>(fn: (t: T) => U) => withEffect(async () => fn(await effect())),
  chain: <U>(fn: (t: T) => Effect<U>) =>
    withEffect(async () => {
      const t = await effect()
      return fn(t)()
    }),
  run: effect
})

// src/libs/utils.ts
// Utility functions with proper deep comparison

/*

      C.Y.R.E - U.T.I.L.S
      
      Utility functions for deep comparison and state management

*/

/**
 * Deep clone utility
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array)
    return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const cloned = {} as {[key: string]: any}
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone((obj as {[key: string]: any})[key])
    })
    return cloned as T
  }
  return obj
}

/**
 * Safe JSON stringify with circular reference handling
 */
export const safeStringify = (obj: any): string => {
  const seen = new Set()
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  })
}
