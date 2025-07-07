// test/throttle-pipeline.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * Comprehensive tests for throttle protection in the protection pipeline
 */
describe('Throttle Protection Pipeline', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.init()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Test basic throttling behavior
   */
  it('should throttle rapid calls according to the throttle interval', async () => {
    // Create action with throttle
    const THROTTLE_INTERVAL = 200 // ms
    cyre.action({
      id: 'throttle-test',
      type: 'test',
      throttle: THROTTLE_INTERVAL
    })

    // Track execution details
    const executions = []
    let handlerCallCount = 0

    // Register handler
    cyre.on('throttle-test', payload => {
      handlerCallCount++
      const timestamp = Date.now()
      executions.push({
        timestamp,
        payload: {...payload},
        count: handlerCallCount
      })

      console.log(`[TEST] Handler executed (${handlerCallCount}):`, payload)
      return {executed: true}
    })

    // SCENARIO 1: First call should always execute
    console.log('[TEST] Making first call - should execute')
    const firstResult = await cyre.call('throttle-test', {call: 1})

    // First call assertions
    expect(firstResult.ok).toBe(true)
    expect(handlerCallCount).toBe(1)

    // SCENARIO 2: Immediate second call should be throttled
    console.log('[TEST] Making second call immediately - should be throttled')
    const secondResult = await cyre.call('throttle-test', {call: 2})

    // Second call assertions
    expect(secondResult.ok).toBe(false)
    expect(secondResult.message).toContain('Throttled')
    expect(handlerCallCount).toBe(1) // Still 1

    // SCENARIO 3: After waiting for the throttle period, next call should execute
    console.log(`[TEST] Waiting for throttle period (${THROTTLE_INTERVAL}ms)`)
    await new Promise(resolve => setTimeout(resolve, THROTTLE_INTERVAL + 20))

    console.log(
      '[TEST] Making third call after throttle period - should execute'
    )
    const thirdResult = await cyre.call('throttle-test', {call: 3})

    // Third call assertions
    expect(thirdResult.ok).toBe(true)
    expect(handlerCallCount).toBe(2) // Now 2

    // SCENARIO 4: Rapid calls should all be throttled except one
    console.log('[TEST] Making multiple rapid calls - only one should execute')
    const results = []

    // Make 5 rapid calls
    for (let i = 0; i < 5; i++) {
      const result = await cyre.call('throttle-test', {
        batch: true,
        call: i + 4
      })
      results.push(result)
      // Small delay between calls but still within throttle interval
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Count successful calls
    const successfulCalls = results.filter(r => r.ok).length

    // Should be at most 1 successful call in the batch
    expect(successfulCalls).toBeLessThanOrEqual(1)
    // Total handler calls should be 2 or 3 (depending on timing)
    expect(handlerCallCount).toBeLessThanOrEqual(3)

    // Log final execution details
    console.log('[TEST] Final execution details:', {
      totalHandlerCalls: handlerCallCount,
      executionTimestamps: executions.map(e => e.timestamp),
      payloads: executions.map(e => e.payload)
    })
  })

  /**
   * Test different throttle intervals
   */
  it('should respect different throttle intervals', async () => {
    // Create actions with different throttle intervals
    const intervals = [50, 200, 500]
    const executions = {}
    const actions = {}

    // Set up each action
    for (const interval of intervals) {
      const actionId = `throttle-${interval}`

      // Initialize execution tracking
      executions[interval] = {
        calls: 0,
        timestamps: []
      }

      // Create action
      cyre.action({
        id: actionId,
        type: 'test',
        throttle: interval
      })

      // Store reference
      actions[interval] = actionId

      // Register handler
      cyre.on(actionId, payload => {
        executions[interval].calls++
        executions[interval].timestamps.push(Date.now())
        return {executed: true}
      })
    }

    // PHASE 1: Make initial calls to all actions
    console.log('[TEST] Making initial calls to all throttled actions')

    for (const interval of intervals) {
      const actionId = actions[interval]
      await cyre.call(actionId, {phase: 1})
    }

    // All should have executed once
    for (const interval of intervals) {
      expect(executions[interval].calls).toBe(1)
    }

    // PHASE 2: Make immediate second calls - all should be throttled
    console.log(
      '[TEST] Making immediate second calls - all should be throttled'
    )

    for (const interval of intervals) {
      const actionId = actions[interval]
      const result = await cyre.call(actionId, {phase: 2})
      expect(result.ok).toBe(false)
    }

    // PHASE 3: Wait for shortest interval, then call again
    const shortestInterval = Math.min(...intervals)
    console.log(`[TEST] Waiting for shortest interval (${shortestInterval}ms)`)
    await new Promise(resolve => setTimeout(resolve, shortestInterval + 20))

    // Make calls again
    for (const interval of intervals) {
      const actionId = actions[interval]
      await cyre.call(actionId, {phase: 3})
    }

    // Short interval action should now be at 2 calls, others still at 1
    expect(executions[shortestInterval].calls).toBe(2)

    // PHASE 4: Wait for longest interval and call again
    const longestInterval = Math.max(...intervals)
    console.log(`[TEST] Waiting for longest interval (${longestInterval}ms)`)
    await new Promise(resolve => setTimeout(resolve, longestInterval + 20))

    // Make final calls
    for (const interval of intervals) {
      const actionId = actions[interval]
      await cyre.call(actionId, {phase: 4})
    }

    // All should now have executed at least twice
    for (const interval of intervals) {
      expect(executions[interval].calls).toBeGreaterThanOrEqual(2)
    }

    // Calculate intervals between executions
    const executionIntervals = {}
    for (const interval of intervals) {
      if (executions[interval].timestamps.length >= 2) {
        const times = executions[interval].timestamps
        executionIntervals[interval] = []

        for (let i = 1; i < times.length; i++) {
          executionIntervals[interval].push(times[i] - times[i - 1])
        }
      }
    }

    // Log detailed results
    console.log('[TEST] Execution intervals between calls:', executionIntervals)
    console.log(
      '[TEST] Final execution counts:',
      Object.entries(executions).map(
        ([interval, data]) => `${interval}ms: ${data.calls} calls`
      )
    )

    // Verify intervals are respected
    for (const interval of intervals) {
      if (executionIntervals[interval]?.length > 0) {
        // Allow for small timing variations (90% of specified interval)
        const minAllowedInterval = interval * 0.9

        for (const actualInterval of executionIntervals[interval]) {
          expect(actualInterval).toBeGreaterThanOrEqual(minAllowedInterval)
        }
      }
    }
  })

  /**
   * Test throttle behavior under system stress
   */
  it('should maintain throttle protection under system stress', async () => {
    // Create throttled action
    const THROTTLE_INTERVAL = 300 // ms
    cyre.action({
      id: 'stress-throttle',
      type: 'test',
      throttle: THROTTLE_INTERVAL
    })

    // Execution tracking
    let executionCount = 0

    // Register handler
    cyre.on('stress-throttle', payload => {
      executionCount++

      // Generate some load
      let result = 0
      for (let i = 0; i < 10000; i++) {
        result += Math.sqrt(i)
      }

      return {executed: true, count: executionCount}
    })

    // Create stress-generating action
    cyre.action({
      id: 'stress-generator',
      type: 'test'
    })

    // Register stress handler
    cyre.on('stress-generator', () => {
      // Generate significant load
      let result = 0
      for (let i = 0; i < 50000; i++) {
        result += Math.sqrt(i) * Math.sin(i)
      }
      return {result}
    })

    // PHASE 1: Test throttle without stress
    console.log('[TEST] Testing throttle without system stress')

    // First call should succeed
    await cyre.call('stress-throttle', {phase: 1})
    expect(executionCount).toBe(1)

    // Immediate second call should be throttled
    const result = await cyre.call('stress-throttle', {phase: 1})
    expect(result.ok).toBe(false)
    expect(executionCount).toBe(1) // Still 1

    // PHASE 2: Generate system stress
    console.log('[TEST] Generating system stress')
    const stressCalls = []
    for (let i = 0; i < 5; i++) {
      stressCalls.push(cyre.call('stress-generator', {i}))
    }
    await Promise.all(stressCalls)

    // Wait for throttle interval to expire
    await new Promise(resolve => setTimeout(resolve, THROTTLE_INTERVAL + 20))

    // PHASE 3: Test throttle under stress
    console.log('[TEST] Testing throttle under system stress')

    // Next call should succeed despite stress
    await cyre.call('stress-throttle', {phase: 3})
    expect(executionCount).toBe(2)

    // Immediate next call should still be throttled
    const stressResult = await cyre.call('stress-throttle', {phase: 3})
    expect(stressResult.ok).toBe(false)
    expect(executionCount).toBe(2) // Still 2

    // Verify throttling behavior consistent under stress
    console.log('[TEST] Final execution count:', executionCount)
  })
})
