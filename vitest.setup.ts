// vitest.setup.ts
import './src/utils/crypto-polyfill' // Import the crypto polyfill first

import {beforeAll, afterAll, vi} from 'vitest'

// Setup global environment
beforeAll(() => {
  // Mock performance API if needed
  if (!global.performance) {
    global.performance = {
      now: vi.fn(() => Date.now())
      // Add other methods as needed
    } as unknown as Performance
  }

  // Mock process.hrtime for precision timing
  if (!global.process) {
    global.process = {} as NodeJS.Process
  }

  if (!global.process.hrtime) {
    global.process.hrtime = vi.fn(
      (time?: [number, number]): [number, bigint] => {
        // Explicitly define return type
        const now = Date.now()
        const nowInSec = Math.floor(now / 1000)
        const nowInNano = (now % 1000) * 1000000

        if (!time) {
          return [nowInSec, BigInt(nowInNano)] // Return type is [number, bigint]
        }

        const diffSec = nowInSec - time[0]
        const diffNano = nowInNano - time[1]

        return [
          diffSec,
          BigInt(diffNano < 0 ? 1000000000 + diffNano : diffNano)
        ] // Return type is [number, bigint]
      }
    ) as unknown as NodeJS.Process['hrtime'] // Cast to the correct type
  }

  // Mock process.exit to prevent actual exit
  if (!global.process.exit) {
    global.process.exit = vi.fn() as any
  }

  // Create a mock for setImmediate if not available
  if (!global.setImmediate) {
    global.setImmediate = vi.fn(callback => setTimeout(callback, 0)) as any
  }
})

// Clean up after all tests
afterAll(() => {
  vi.clearAllMocks()
})
