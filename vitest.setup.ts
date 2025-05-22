// vitest.setup.ts
import './src/libs/utils' // Import the crypto polyfill first
import {beforeAll, afterAll, beforeEach, afterEach, vi} from 'vitest'

// Enhanced global setup for better test isolation
beforeAll(() => {
  // Mock performance API if needed
  if (!globalThis.performance) {
    globalThis.performance = {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      getEntriesByName: vi.fn(() => []),
      getEntriesByType: vi.fn(() => []),
      getEntries: vi.fn(() => [])
    } as unknown as Performance
  }

  // Mock process.hrtime for precision timing with proper typing
  if (!globalThis.process) {
    globalThis.process = {} as NodeJS.Process
  }

  if (!globalThis.process.hrtime) {
    globalThis.process.hrtime = vi
      .fn()
      .mockImplementation((time?: [number, number]): [number, number] => {
        const now = Date.now()
        const nowInSec = Math.floor(now / 1000)
        const nowInNano = (now % 1000) * 1000000

        if (!time) {
          return [nowInSec, nowInNano]
        }

        const diffSec = nowInSec - time[0]
        const diffNano = nowInNano - time[1]

        return [diffSec, diffNano < 0 ? 1000000000 + diffNano : diffNano]
      })
  }

  // Mock process.exit to prevent actual exit during tests
  if (!globalThis.process.exit) {
    globalThis.process.exit = vi.fn() as any
  }

  // Mock process event handlers
  if (!globalThis.process.on) {
    globalThis.process.on = vi.fn() as any
  }

  // Create proper setImmediate mock if not available
  if (!globalThis.setImmediate) {
    globalThis.setImmediate = vi
      .fn()
      .mockImplementation(
        (callback: (...args: any[]) => void, ...args: any[]) => {
          return setTimeout(() => callback(...args), 0)
        }
      ) as any
  }

  // Mock clearImmediate if not available
  if (!globalThis.clearImmediate) {
    globalThis.clearImmediate = vi.fn().mockImplementation(clearTimeout) as any
  }

  // Enhanced crypto mock with proper typing
  if (!globalThis.crypto) {
    globalThis.crypto = {
      randomUUID: vi
        .fn()
        .mockImplementation(
          (): `${string}-${string}-${string}-${string}-${string}` => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
              /[xy]/g,
              c => {
                const r = (Math.random() * 16) | 0
                const v = c === 'x' ? r : (r & 0x3) | 0x8
                return v.toString(16)
              }
            ) as `${string}-${string}-${string}-${string}-${string}`
          }
        ),
      getRandomValues: vi.fn().mockImplementation((array: Uint8Array) => {
        if (!array) return null
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256)
        }
        return array
      }),
      subtle: {} as SubtleCrypto
    }
  }

  // Mock window and browser APIs if needed
  if (typeof window === 'undefined') {
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        location: {
          href: 'http://localhost:3000'
        },
        navigator: {
          userAgent: 'node.js'
        }
      },
      writable: true
    })
  }

  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.CYRE_LOG_LEVEL = 'ERROR' // Reduce noise in tests
})

// Clean up before each test for better isolation
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()

  // Reset any global state that might leak between tests
  if (globalThis.performance?.now) {
    vi.mocked(globalThis.performance.now).mockReturnValue(Date.now())
  }
})

// Clean up after each test
afterEach(() => {
  // Clear any timers that might be hanging around
  vi.clearAllTimers()

  // Reset modules to ensure clean state
  vi.resetModules()
})

// Final cleanup after all tests
afterAll(() => {
  // Restore all mocks
  vi.restoreAllMocks()

  // Clear any remaining timers
  vi.clearAllTimers()
})

// Global test utilities that can be used in tests
globalThis.testUtils = {
  // Utility to wait for next tick
  nextTick: () => new Promise(resolve => setImmediate(resolve)),

  // Utility to wait for a specific amount of time
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Utility to advance timers by a specific amount
  advanceTimers: (ms: number) => {
    vi.advanceTimersByTime(ms)
  },

  // Utility to run all pending timers
  runAllTimers: () => {
    vi.runAllTimers()
  }
}

// Extend global types for test utilities
declare global {
  var testUtils: {
    nextTick(): Promise<void>
    sleep(ms: number): Promise<void>
    advanceTimers(ms: number): void
    runAllTimers(): void
  }
}
