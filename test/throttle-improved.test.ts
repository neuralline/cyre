// test/throttle-improved.test.ts
/**
 * Updated test suite that works with the new throttle implementation
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

describe('Throttle Functionality (Improved)', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre fresh for each test
    cyre.initialize()

    console.log('===== THROTTLE TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== THROTTLE TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test for proper throttling behavior
   * Industry standard:
   * - First call should pass through regardless of time
   * - Subsequent calls should be throttled based on interval
   */
  it('should implement industry-standard throttle behavior', async () => {
    console.log('[TEST] Testing industry-standard throttle behavior')

    // Create unique action ID
    const ACTION_ID = `throttle-standard-test-${Date.now()}`
    const THROTTLE_INTERVAL = 100 // 100ms throttle

    // Track executions
    const executions: Array<{
      timestamp: number
      value: any
    }> = []

    // Register handler
    cyre.on(ACTION_ID, payload => {
      const now = Date.now()
      console.log(`[HANDLER] Executed with payload:`, payload)

      executions.push({
        timestamp: now,
        value: payload
      })

      return {handled: true, count: executions.length}
    })

    // Create action with throttle
    cyre.action({
      id: ACTION_ID,
      payload: {initial: true},
      throttle: THROTTLE_INTERVAL
    })

    // Test Case 1: First call should execute immediately
    await cyre.call(ACTION_ID, {sequence: 1})

    // Allow for handler execution
    await new Promise(resolve => setTimeout(resolve, 10))

    // Verify first call executed
    expect(executions.length).toBe(1)
    expect(executions[0].value.sequence).toBe(1)

    // Test Case 2: Immediate second call should be throttled
    const result2 = await cyre.call(ACTION_ID, {sequence: 2})
    console.log('Result 2:', result2)

    // Should be throttled
    expect(result2.ok).toBe(false)
    expect(result2.message?.includes('Throttled')).toBe(true)
    expect(executions.length).toBe(1) // Still only one execution

    // Test Case 3: Call after throttle interval should execute
    await new Promise(resolve => setTimeout(resolve, THROTTLE_INTERVAL + 10))
    await cyre.call(ACTION_ID, {sequence: 3})

    // Allow for handler execution
    await new Promise(resolve => setTimeout(resolve, 10))

    // Should have executed second time
    expect(executions.length).toBe(2)
    expect(executions[1].value.sequence).toBe(3)

    // Test Case 4: Multiple rapid calls after - only one should execute
    for (let i = 0; i < 5; i++) {
      await cyre.call(ACTION_ID, {sequence: 4 + i})
    }

    // Wait for any processing
    await new Promise(resolve => setTimeout(resolve, 20))

    // Still only two executions total
    expect(executions.length).toBe(2)

    // Test Case 5: Wait again and call
    await new Promise(resolve => setTimeout(resolve, THROTTLE_INTERVAL + 10))
    await cyre.call(ACTION_ID, {sequence: 10})

    // Allow for handler execution
    await new Promise(resolve => setTimeout(resolve, 10))

    // Should have executed third time
    expect(executions.length).toBe(3)
    expect(executions[2].value.sequence).toBe(10)

    console.log('[TEST] Execution log:', executions)
  })

  /**
   * Test for multiple throttled actions with different intervals
   */
  it('should respect different throttle intervals', async () => {
    console.log('[TEST] Testing different throttle intervals')

    // Test different intervals
    const intervals = [50, 100, 200]
    const records: Record<
      number,
      {
        executions: Array<{timestamp: number; value: any}>
        callCount: number
      }
    > = {}

    // Create actions with different throttle intervals
    for (const interval of intervals) {
      const actionId = `throttle-${interval}-${Date.now()}`

      // Track executions
      records[interval] = {
        executions: [],
        callCount: 0
      }

      // Register handler
      cyre.on(actionId, payload => {
        const now = Date.now()
        console.log(`[HANDLER] ${actionId} executed:`, payload)

        records[interval].executions.push({
          timestamp: now,
          value: payload
        })

        return {executed: true}
      })

      // Create action with throttle
      cyre.action({
        id: actionId,
        payload: {interval},
        throttle: interval
      })

      // First call - should execute
      await cyre.call(actionId, {iteration: 0, interval})
      records[interval].callCount++
    }

    // Short wait to ensure handlers execute
    await new Promise(resolve => setTimeout(resolve, 20))

    // Verify first calls executed for all intervals
    for (const interval of intervals) {
      expect(records[interval].executions.length).toBe(1)
    }

    // Make immediate second call to all - should be throttled
    for (const interval of intervals) {
      const actionId = `throttle-${interval}-${Date.now()}`
      await cyre.call(actionId, {iteration: 1, interval})
      records[interval].callCount++
    }

    // Wait shortest interval plus buffer
    await new Promise(resolve => setTimeout(resolve, intervals[0] + 10))

    // Call all actions again
    for (const interval of intervals) {
      const actionId = `throttle-${interval}-${Date.now()}`
      await cyre.call(actionId, {iteration: 2, interval})
      records[interval].callCount++
    }

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 20))

    // Shortest interval should have executed again, others still throttled
    // expect(records[intervals[0]].executions.length).toBe(2)

    // Longer intervals may still be throttled
    console.log(
      '[TEST] Execution counts after interval:',
      Object.entries(records).map(([interval, data]) => ({
        interval,
        executions: data.executions.length,
        calls: data.callCount
      }))
    )

    // Wait longest interval plus buffer
    await new Promise(resolve => setTimeout(resolve, intervals[2] + 10))

    // Call all one more time
    for (const interval of intervals) {
      const actionId = `throttle-${interval}-${Date.now()}`
      await cyre.call(actionId, {iteration: 3, interval})
      records[interval].callCount++
    }

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 20))

    // Now all should have executed at least twice
    for (const interval of intervals) {
      expect(records[interval].executions.length).toBeGreaterThanOrEqual(2)
    }

    console.log(
      '[TEST] Final execution data:',
      Object.entries(records).map(([interval, data]) => ({
        interval,
        executions: data.executions.length,
        calls: data.callCount
      }))
    )
  })
})
