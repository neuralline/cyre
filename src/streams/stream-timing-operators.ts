// src/streams/stream-timing-test.ts

import {describe, it, expect, beforeEach} from 'vitest'
import {cyre} from '../app'
import {createStream} from './index'

describe('Stream Timing Operators with Real Timers', () => {
  beforeEach(() => {
    cyre.initialize()
  })

  describe('Stream Debounce', () => {
    it('should debounce values with the specified delay', async () => {
      // Create stream with debounce
      const stream = createStream<number>('debounce-real-test')
      const debounced = stream.debounce(100)
      const received: number[] = []

      // Subscribe and track values
      debounced.subscribe(value => {
        console.log(`Received debounced value: ${value}`)
        received.push(value)
      })

      // Emit values quickly
      console.log('Emitting rapid values to debounce stream')
      await stream.next(1)
      await new Promise(resolve => setTimeout(resolve, 20))
      await stream.next(2)
      await new Promise(resolve => setTimeout(resolve, 20))
      await stream.next(3)

      // Wait for debounce period to complete
      console.log('Waiting for debounce period')
      await new Promise(resolve => setTimeout(resolve, 150))

      // Verify we got only the last value
      expect(received).toEqual([3])

      // Emit another value after delay
      console.log('Emitting another value')
      await stream.next(4)

      // Wait for it to be processed
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should have both values now
      expect(received).toEqual([3, 4])

      // Cleanup
      debounced.complete()
      stream.complete()
    })
  })

  describe('Stream Throttle', () => {
    it('should throttle values with the specified delay', async () => {
      // Create stream with throttle
      const stream = createStream<number>('throttle-real-test')
      const throttled = stream.throttle(100)
      const received: number[] = []

      // Subscribe and track values
      throttled.subscribe(value => {
        console.log(`Received throttled value: ${value}`)
        received.push(value)
      })

      // Emit first value - should pass through immediately
      console.log('Emitting first value to throttle stream')
      await stream.next(1)

      // Give time for the first value to be processed
      await new Promise(resolve => setTimeout(resolve, 30))

      // Verify first value was emitted
      expect(received).toEqual([1])

      // Emit values rapidly during throttle window
      console.log('Emitting throttled values')
      await stream.next(2)
      await new Promise(resolve => setTimeout(resolve, 10))
      await stream.next(3)

      // Wait for throttle period to complete
      console.log('Waiting for throttle period')
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify we got the latest value
      expect(received).toEqual([1, 3])

      // Cleanup
      throttled.complete()
      stream.complete()
    })
  })

  describe('Standard Cyre Debounce', () => {
    it('should properly debounce action calls', async () => {
      const actionId = 'cyre-debounce-real-test'
      const received: number[] = []

      // Register action with debounce
      cyre.action({
        id: actionId,
        debounce: 100
      })

      // Set up handler
      cyre.on(actionId, value => {
        console.log(`Handling debounced action: ${value}`)
        received.push(value as number)
      })

      // Call rapidly
      console.log('Making rapid calls to debounced action')
      await cyre.call(actionId, 1)
      await new Promise(resolve => setTimeout(resolve, 20))
      await cyre.call(actionId, 2)
      await new Promise(resolve => setTimeout(resolve, 20))
      await cyre.call(actionId, 3)

      // Wait for debounce period to complete
      console.log('Waiting for debounce period')
      await new Promise(resolve => setTimeout(resolve, 150))

      // Verify only last value processed
      expect(received).toEqual([3])

      // Cleanup
      cyre.forget(actionId)
    })
  })

  describe('Standard Cyre Throttle', () => {
    it('should properly throttle action calls', async () => {
      const actionId = 'cyre-throttle-real-test'
      const received: number[] = []

      // Register action with throttle
      cyre.action({
        id: actionId,
        throttle: 100
      })

      // Set up handler
      cyre.on(actionId, value => {
        console.log(`Handling throttled action: ${value}`)
        received.push(value as number)
      })

      // First call should be handled immediately
      console.log('Making first call to throttled action')
      await cyre.call(actionId, 1)

      // Give time for processing
      await new Promise(resolve => setTimeout(resolve, 30))

      // Verify first value was handled
      expect(received).toEqual([1])

      // Make rapid calls during throttle window
      console.log('Making rapid calls to throttled action')
      await cyre.call(actionId, 2)
      await new Promise(resolve => setTimeout(resolve, 10))
      await cyre.call(actionId, 3)

      // Wait for throttle period to end
      console.log('Waiting for throttle period')
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify latest value was handled
      expect(received).toEqual([1, 3])

      // Cleanup
      cyre.forget(actionId)
    })
  })
})
