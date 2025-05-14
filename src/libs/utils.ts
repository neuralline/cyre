// src/libs/utils.ts

/**
 * Creates a memoized version of a function that caches its results
 */
export const memoize = <TArgs extends Array<unknown>, TResult>(
  fn: (...args: TArgs) => TResult
): ((...args: TArgs) => TResult) => {
  const cache = new WeakMap()

  return (...args: TArgs) => {
    const key = args[0]
    // Only use WeakMap if first arg is an object
    if (typeof key === 'object' && key !== null) {
      if (!cache.has(key)) {
        cache.set(key, fn(...args))
      }
      return cache.get(key)
    }

    // Fallback to regular function call for primitive args
    return fn(...args)
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
 * Performs deep equality comparison between two values
 */
export const isEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true

  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((item, index) => isEqual(item, b[index]))
    )
  }

  const keysA = Object.keys(a as object)
  const keysB = Object.keys(b as object)

  if (keysA.length !== keysB.length) return false

  return keysA.every(key => isEqual((a as any)[key], (b as any)[key]))
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
