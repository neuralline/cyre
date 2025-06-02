// test/setup.ts
// Test environment setup for Bun

/*

      C.Y.R.E - T.E.S.T - S.E.T.U.P
      
      Bun test environment configuration:
      - Global test utilities
      - Mock implementations
      - Performance helpers
      - Memory management

*/

// Global test helpers
import {expect} from 'bun:test'

// Crypto polyfill for test environment
if (typeof crypto === 'undefined') {
  global.crypto = {
    randomUUID: (): string => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    },
    getRandomValues: <T extends Uint8Array>(array: T): T => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
      return array
    }
  } as Crypto
}

// Performance helpers
global.measurePerformance = <T>(fn: () => T, name: string): T => {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  console.log(`${name}: ${(end - start).toFixed(2)}ms`)
  return result
}

// Memory helpers
global.forceGC = () => {
  if (global.gc) {
    global.gc()
  }
}

// Test utilities
global.sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

global.waitFor = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 10
): Promise<void> => {
  const start = Date.now()

  while (!condition() && Date.now() - start < timeout) {
    await sleep(interval)
  }

  if (!condition()) {
    throw new Error(`Timeout waiting for condition after ${timeout}ms`)
  }
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be within range ${min}-${max}`
          : `Expected ${received} to be within range ${min}-${max}`
    }
  },

  toHaveExecutedWithin(received: number, expectedMs: number, tolerance = 10) {
    const pass = Math.abs(received - expectedMs) <= tolerance
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received}ms not to be within ${tolerance}ms of ${expectedMs}ms`
          : `Expected ${received}ms to be within ${tolerance}ms of ${expectedMs}ms`
    }
  }
})

// Declare global types
declare global {
  function measurePerformance<T>(fn: () => T, name: string): T
  function forceGC(): void
  function sleep(ms: number): Promise<void>
  function waitFor(
    condition: () => boolean,
    timeout?: number,
    interval?: number
  ): Promise<void>

  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(min: number, max: number): R
      toHaveExecutedWithin(expectedMs: number, tolerance?: number): R
    }
  }
}

export {}
