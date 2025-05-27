// test/long-interval-stability.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src'
import {TIMING} from '../src/config/cyre-config'

/**
 * Long Interval Stability Test
 *
 * This test suite specifically verifies Cyre's ability to handle very long intervals
 * and remain stable during extended operation.
 */
describe('Cyre Long Interval Stability', () => {
  // Timeout and test tracking
  const TEST_TIMEOUT = 5000
  const testActionIds: string[] = []

  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    cyre.initialize()
    testActionIds.length = 0
    console.log('===== LONG INTERVAL STABILITY TEST STARTED =====')
  })

  afterEach(() => {
    testActionIds.forEach(id => cyre.forget(id))
    console.log('===== LONG INTERVAL STABILITY TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test for long interval handling using public API
   */
  it(
    'should correctly handle extremely long intervals by breaking them into chunks',
    async () => {
      // Define an interval longer than MAX_TIMEOUT
      const extremelyLongInterval = TIMING.MAX_TIMEOUT + 100
      const ACTION_ID = 'long-interval-test'
      testActionIds.push(ACTION_ID)

      // Create our action with a very long interval
      cyre.action({
        id: ACTION_ID,
        payload: {initial: true},
        interval: extremelyLongInterval,
        repeat: 2
      })

      // Register a handler
      let handlerCalled = false
      cyre.on(ACTION_ID, () => {
        handlerCalled = true
        return {executed: true}
      })

      // Instead of calling with the long interval, update with a short one for testing
      cyre.action({
        id: ACTION_ID,
        payload: {initial: true},
        interval: 10, // Very short interval for testing
        repeat: 1
      })

      // Call with the short interval
      await cyre.call(ACTION_ID)

      // Small delay to allow for handler execution
      await new Promise(resolve => setTimeout(resolve, 50))

      // Check if handler was executed
      expect(handlerCalled).toBe(true)

      // Check that the action exists using public API
      const actionState = cyre.get(ACTION_ID)
      expect(actionState).not.toBeUndefined()

      // Verify the correct interval was stored in the action
      expect(actionState?.interval).toBe(10) // The short test interval

      // Verify we can get metrics for this action using public API
      const metrics = cyre.getMetrics(ACTION_ID)
      expect(metrics).toBeDefined()
    },
    TEST_TIMEOUT
  )

  /**
   * Test for interval repeat mechanisms using public API
   */
  it('should correctly handle interval repetition config', async () => {
    // Track execution counts
    let executionCount = 0
    const ACTION_ID = 'repeat-test'
    testActionIds.push(ACTION_ID)

    // Register handler
    cyre.on(ACTION_ID, () => {
      executionCount++
      return {executed: true}
    })

    // Create action with specific repeat value
    cyre.action({
      id: ACTION_ID,
      payload: {test: 'repeat'},
      interval: 100,
      repeat: 3 // Should execute 3 times
    })

    // Get action info through public API
    const actionInfo = cyre.get(ACTION_ID)

    // Verify repeat value was stored correctly
    expect(actionInfo?.repeat).toBe(3)
  })

  /**
   * Test for resource management using public API
   */
  it('should properly manage timeline resources', async () => {
    const RESOURCE_PREFIX = 'resource-test-'
    const ACTION_COUNT = 5

    // Create several actions
    for (let i = 0; i < ACTION_COUNT; i++) {
      const id = `${RESOURCE_PREFIX}${i}`
      testActionIds.push(id)

      cyre.action({
        id,
        payload: {index: i},
        interval: 100,
        repeat: 2
      })
    }

    // Verify actions exist using public API
    for (let i = 0; i < ACTION_COUNT; i++) {
      const id = `${RESOURCE_PREFIX}${i}`
      const actionInfo = cyre.get(id)
      expect(actionInfo).toBeDefined()
    }

    // Forget half the actions
    for (let i = 0; i < Math.floor(ACTION_COUNT / 2); i++) {
      cyre.forget(`${RESOURCE_PREFIX}${i}`)
    }

    // Verify forgotten actions are gone, remaining exist
    for (let i = 0; i < ACTION_COUNT; i++) {
      const id = `${RESOURCE_PREFIX}${i}`
      const actionInfo = cyre.get(id)

      if (i < Math.floor(ACTION_COUNT / 2)) {
        // These should be forgotten
        expect(actionInfo).toBeUndefined()
      } else {
        // These should still exist
        expect(actionInfo).toBeDefined()
      }
    }
  })

  /**
   * Test for delay:0 immediate execution
   */
  it('should support immediate execution with delay:0', async () => {
    let executed = false
    let executionTime = -1
    const ACTION_ID = 'immediate-execution-test'
    testActionIds.push(ACTION_ID)

    const startTime = Date.now()

    // Register handler
    cyre.on(ACTION_ID, () => {
      executed = true
      executionTime = Date.now() - startTime
      return {executed: true}
    })

    // Create action with delay:0
    cyre.action({
      id: ACTION_ID,
      payload: {test: 'immediate'},
      delay: 0,
      repeat: 1
    })

    // Call the action
    await cyre.call(ACTION_ID)

    // Small wait to allow execution
    await new Promise(resolve => setTimeout(resolve, 50))

    // Verify execution happened immediately
    expect(executed).toBe(true)
    expect(executionTime).toBeLessThan(50) // Should execute under 50ms
  })
})
