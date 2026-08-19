// test/long-operations.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/*
 * Long-running operations test
 */

describe('Quantum Breathing - Long Operations', () => {
  // Track the dynamically-generated action id so afterEach can clean it up -
  // this file previously registered a channel + handler and never forgot
  // it, which (since cyre is a module-level singleton) could leave a
  // lingering handler/timer bleeding into whatever test file runs next in
  // the same worker.
  let registeredActionId: string | undefined

  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.init()
    registeredActionId = undefined
  })

  afterEach(() => {
    if (registeredActionId) {
      cyre.forget(registeredActionId)
    }
    vi.restoreAllMocks()
  })

  it('should handle long-running operations with adaptive timing', async () => {
    // Action ID for long-running operation
    const LONG_OPERATION_ID = 'long-operation-test-' + Date.now()
    registeredActionId = LONG_OPERATION_ID

    // Track processed items
    let processedCount = 0
    const processingTimes: number[] = []
    const itemCount = 10
    // Require a majority of items to actually complete, not just "at least
    // one" - the original assertion (processedCount > 0) would pass even if
    // 9 of 10 calls were silently dropped, which tests almost nothing about
    // whether the system holds up under a burst of long-running work.
    const MIN_EXPECTED_PROCESSED = Math.ceil(itemCount / 2)

    const completionPromise = new Promise<void>(resolve => {
      // Set up a handler that will resolve the promise after some processing
      cyre.on(LONG_OPERATION_ID, async payload => {
        const startTime = Date.now()

        // Simulate processing work with varying intensity
        let x = 0
        const iterations = 10000 + payload.index * 5000
        for (let i = 0; i < iterations; i++) {
          x += Math.sqrt(i)
        }

        // Record processing
        processedCount++
        const endTime = Date.now()
        const processTime = endTime - startTime
        processingTimes.push(processTime)

        // Resolve the promise once we've processed enough items
        if (processedCount >= MIN_EXPECTED_PROCESSED) {
          resolve()
        }

        return {
          processed: true,
          index: payload.index,
          result: x,
          processTime
        }
      })
    })

    // Register the action
    cyre.action({
      id: LONG_OPERATION_ID,
      type: 'long-operation-group',
      payload: {initial: true},
      // Enable breathing adaptation
      priority: {level: 'medium'}
    })

    // Schedule multiple items with increasing processing requirements
    for (let i = 0; i < itemCount; i++) {
      cyre
        .call(LONG_OPERATION_ID, {
          index: i,
          timestamp: Date.now()
        })
        .catch(err => {
          console.error(`[TEST] Error processing item ${i}:`, err)
        })

      // Small delay between items
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Wait for enough items to be processed
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Test timed out')), 3000)
    })

    try {
      await Promise.race([completionPromise, timeoutPromise])
    } catch (error) {
      console.error('[TEST] Timeout waiting for processing:', error)
    }

    // A meaningful floor, not just "something happened"
    expect(processedCount).toBeGreaterThanOrEqual(MIN_EXPECTED_PROCESSED)
    expect(processingTimes).toHaveLength(processedCount)

    // Actually assert on the timing data instead of only logging it - every
    // recorded processing time must be a real, non-negative duration
    processingTimes.forEach(t => {
      expect(t).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(t)).toBe(true)
    })
  })
})
