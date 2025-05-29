// test/stream-diagnostic.test.ts
// Minimal diagnostic test to identify the core issue

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {createStream, cyre} from '../src'

/*

      C.Y.R.E - S.T.R.E.A.M - D.I.A.G.N.O.S.T.I.C
      
      Minimal test to identify why streams aren't working:
      1. Test basic Cyre functionality first
      2. Test stream creation without operators
      3. Identify where the breakdown occurs

*/

describe('Stream Diagnostic', () => {
  beforeEach(() => {
    cyre.initialize()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cyre.clear()
    vi.useRealTimers()
  })

  describe('Basic Cyre Functionality', () => {
    it('should create and call basic Cyre action', async () => {
      cyre.action({id: 'test-action', payload: null})
      let called = false

      cyre.on('test-action', () => {
        called = true
        return {success: true}
      })

      await cyre.call('test-action')
      expect(called).toBe(true)
    })
  })

  describe('Manual Stream Implementation', () => {
    it('should work with manual stream logic', async () => {
      // Create manual stream without using factory functions
      const streamId = 'manual-stream'
      const values: number[] = []

      // Create Cyre action for stream
      cyre.action({
        id: streamId,
        type: 'stream',
        payload: null
      })

      // Subscribe to stream
      cyre.on(streamId, (value: number) => {
        values.push(value)
        return {handled: true}
      })

      // Manually emit values
      await cyre.call(streamId, 0)
      await cyre.call(streamId, 1)
      await cyre.call(streamId, 2)

      expect(values).toEqual([0, 1, 2])
    })
  })

  describe('Interval Logic Test', () => {
    it('should test manual interval implementation', async () => {
      const values: number[] = []
      let counter = 0
      let emissionCount = 0
      const maxEmissions = 3

      const emitValue = async () => {
        if (emissionCount >= maxEmissions) return

        values.push(counter)
        counter++
        emissionCount++

        if (emissionCount < maxEmissions) {
          setTimeout(emitValue, 100)
        }
      }

      // Start emission
      emitValue()

      // Advance timers to trigger emissions
      vi.advanceTimersByTime(250)

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(values).toEqual([0, 1, 2])
    })
  })

  describe('Timer vs setTimeout Test', () => {
    it('should test what setTimeout actually emits', async () => {
      let emittedValue: any = 'not-set'

      setTimeout(() => {
        emittedValue = undefined // What we expect
      }, 100)

      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(emittedValue).toBe(undefined)
    })

    it('should test void value behavior', async () => {
      let voidValue: any = 'not-set'

      const getVoid = (): void => {
        return void 0
      }

      setTimeout(() => {
        voidValue = getVoid()
      }, 100)

      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(voidValue).toBe(undefined)
    })
  })

  describe('Stream State Debugging', () => {
    it('should debug stream creation process', () => {
      // Test if we can import stream functions at all
      let canImportStream = false

      try {
        // Try to import - this might fail

        canImportStream = !!createStream
      } catch (error) {
        console.log('Stream import error:', error)
      }

      console.log('Can import stream:', canImportStream)

      // This test always passes - it's just for debugging
      expect(true).toBe(true)
    })

    it('should test Cyre action creation with priority', async () => {
      cyre.action({
        id: 'priority-test',
        type: 'stream',
        priority: {level: 'medium'},
        payload: null
      })

      const action = cyre.get('priority-test')
      console.log('Created action:', action)

      expect(action).toBeDefined()
      expect(action?.id).toBe('priority-test')
    })
  })
})

// Simple test to verify test runner is working
describe('Test Environment', () => {
  it('should have working fake timers', () => {
    vi.useFakeTimers()

    let called = false
    setTimeout(() => {
      called = true
    }, 100)

    expect(called).toBe(false)

    vi.advanceTimersByTime(100)
    expect(called).toBe(true)

    vi.useRealTimers()
  })

  it('should have working async/await', async () => {
    const promise = new Promise(resolve => {
      setTimeout(() => resolve('done'), 50)
    })

    vi.useFakeTimers()
    const resultPromise = promise
    vi.advanceTimersByTime(50)

    const result = await resultPromise
    expect(result).toBe('done')

    vi.useRealTimers()
  })
})
