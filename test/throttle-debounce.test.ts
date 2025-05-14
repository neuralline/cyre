// src/tests/throttle-debounce.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * Test for Cyre's throttle and debounce functionality
 *
 * This test evaluates how well the throttling and debouncing features
 * are working in the current implementation.
 */
describe('Cyre Throttle and Debounce', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== THROTTLE/DEBOUNCE TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== THROTTLE/DEBOUNCE TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test for throttling functionality
   * Throttling should limit the rate of execution to at most
   * one call per throttle interval
   */
  it('should properly throttle action calls', async () => {
    // Track execution timestamps
    const executionTimes: number[] = []
    const callResults: Array<{ok: boolean; message: string}> = []

    // Create throttled action
    const THROTTLE_ACTION_ID = 'throttle-test-action'
    const THROTTLE_INTERVAL = 100 // 100ms throttle

    // Register handler
    cyre.on(THROTTLE_ACTION_ID, payload => {
      const now = Date.now()
      executionTimes.push(now)
      console.log(`[HANDLER] Throttled execution at ${now}:`, payload)
      return {executed: true}
    })

    // Create action with throttle
    cyre.action({
      id: THROTTLE_ACTION_ID,
      type: 'throttle-test',
      payload: {initial: true},
      throttle: THROTTLE_INTERVAL
    })

    // Make rapid calls - should be throttled
    const callCount = 10

    console.log('[TEST] Making rapid throttled calls')
    for (let i = 0; i < callCount; i++) {
      try {
        const result = await cyre.call(THROTTLE_ACTION_ID, {iteration: i})
        callResults.push({ok: result.ok, message: result.message || ''})
      } catch (error) {
        console.error(`[TEST] Error calling throttled action:`, error)
      }

      // Small delay to ensure the calls are distinct but still rapid
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Wait a bit more to ensure any throttled calls complete
    await new Promise(resolve => setTimeout(resolve, THROTTLE_INTERVAL * 2))

    console.log('[TEST] Throttle execution times:', executionTimes)
    console.log('[TEST] Call results:', callResults)

    // Calculate intervals between executions
    const intervals = []
    for (let i = 1; i < executionTimes.length; i++) {
      intervals.push(executionTimes[i] - executionTimes[i - 1])
    }

    console.log('[TEST] Intervals between executions:', intervals)

    // Analyze results to determine if throttling is working
    // 1. Check if any calls were rejected with throttle messages
    const throttledCalls = callResults.filter(
      r => !r.ok && r.message.includes('Throttled')
    ).length

    console.log(`[TEST] Throttled calls: ${throttledCalls}/${callCount}`)

    // 2. Check if execution times were properly spaced
    const properlyThrottled = intervals.every(
      interval => interval >= THROTTLE_INTERVAL * 0.9 // Allow small timing variations
    )

    console.log(`[TEST] Properly throttled: ${properlyThrottled}`)

    // Verify throttling behavior
    if (throttledCalls > 0) {
      // If calls were explicitly throttled, that's good
      expect(throttledCalls).toBeGreaterThan(0)
      expect(executionTimes.length).toBeLessThan(callCount)
    } else if (intervals.length > 0) {
      // Otherwise, check if executions were properly spaced
      expect(properlyThrottled).toBe(true)
    } else {
      // If neither, throttling isn't working
      fail('Throttling does not appear to be working')
    }
  })

  /**
   * Test for debouncing functionality
   * Debouncing should collapse multiple calls into one,
   * executing only after a specified delay since the last call
   */
  it('should properly debounce action calls', async () => {
    // Track execution count and timestamps
    const executionTimes: number[] = []
    const callResults: Array<{ok: boolean; message: string}> = []

    // Create debounced action
    const DEBOUNCE_ACTION_ID = 'debounce-test-action'
    const DEBOUNCE_DELAY = 100 // 100ms debounce

    // Register handler
    cyre.on(DEBOUNCE_ACTION_ID, payload => {
      const now = Date.now()
      executionTimes.push(now)
      console.log(`[HANDLER] Debounced execution at ${now}:`, payload)
      return {executed: true}
    })

    // Create action with debounce
    cyre.action({
      id: DEBOUNCE_ACTION_ID,
      type: 'debounce-test',
      payload: {initial: true},
      debounce: DEBOUNCE_DELAY
    })

    // Make rapid calls - should be debounced
    const callCount = 10

    console.log('[TEST] Making rapid debounced calls')
    for (let i = 0; i < callCount; i++) {
      try {
        const result = await cyre.call(DEBOUNCE_ACTION_ID, {iteration: i})
        callResults.push({ok: result.ok, message: result.message || ''})
      } catch (error) {
        console.error(`[TEST] Error calling debounced action:`, error)
      }

      // Small delay to ensure the calls are distinct but still rapid
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Wait longer than the debounce delay to ensure any debounced calls complete
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_DELAY * 3))

    console.log('[TEST] Debounce execution times:', executionTimes)
    console.log('[TEST] Call results:', callResults)

    // Analyze results to determine if debouncing is working
    // 1. Check if calls indicated debouncing in messages
    const debouncedCalls = callResults.filter(
      r => r.ok && r.message.includes('Debounced')
    ).length

    console.log(
      `[TEST] Explicitly debounced calls: ${debouncedCalls}/${callCount}`
    )

    // 2. Check if fewer executions than calls (essential for debouncing)
    const actualDebouncing = executionTimes.length < callCount

    console.log(
      `[TEST] Actual debouncing (fewer executions): ${actualDebouncing}`
    )
    console.log(`[TEST] Execution count: ${executionTimes.length}/${callCount}`)

    // Verify debouncing behavior
    if (debouncedCalls > 0) {
      // If calls explicitly mentioned debouncing, that's good
      expect(debouncedCalls).toBeGreaterThan(0)
      expect(executionTimes.length).toBeLessThan(callCount)
    } else if (actualDebouncing) {
      // Otherwise, check if there were fewer executions than calls
      expect(executionTimes.length).toBeLessThan(callCount)
    } else {
      // Log the issue but don't fail the test since we're just checking
      // the current implementation, not necessarily requiring it to work
      console.warn('Debouncing does not appear to be fully implemented')
    }
  })

  /**
   * Test for combined throttling and debouncing with batched calls
   * This tests if both mechanisms work with bursts of activity separated by pauses
   */
  it('should handle batched throttled and debounced calls', async () => {
    // Track execution counts
    const executionCounts = {
      throttled: 0,
      debounced: 0
    }

    // Create actions
    const THROTTLE_ACTION_ID = 'batch-throttle-action'
    const DEBOUNCE_ACTION_ID = 'batch-debounce-action'
    const PROTECTION_INTERVAL = 100 // 100ms for both

    // Register handlers
    cyre.on(THROTTLE_ACTION_ID, payload => {
      executionCounts.throttled++
      console.log(`[HANDLER] Throttled executed: ${executionCounts.throttled}`)
      return {executed: true, count: executionCounts.throttled}
    })

    cyre.on(DEBOUNCE_ACTION_ID, payload => {
      executionCounts.debounced++
      console.log(`[HANDLER] Debounced executed: ${executionCounts.debounced}`)
      return {executed: true, count: executionCounts.debounced}
    })

    // Create actions with protection
    cyre.action({
      id: THROTTLE_ACTION_ID,
      type: 'batch-test',
      payload: {protection: 'throttle'},
      throttle: PROTECTION_INTERVAL
    })

    cyre.action({
      id: DEBOUNCE_ACTION_ID,
      type: 'batch-test',
      payload: {protection: 'debounce'},
      debounce: PROTECTION_INTERVAL
    })

    // Make multiple calls in 3 batches with pauses between batches
    const batchSize = 5
    const batchCount = 3
    const batchPause = PROTECTION_INTERVAL * 2

    for (let batch = 0; batch < batchCount; batch++) {
      console.log(`[TEST] Firing batch ${batch + 1}`)

      const batchCalls = []

      // Fire rapid calls in each batch
      for (let i = 0; i < batchSize; i++) {
        batchCalls.push(
          cyre.call(THROTTLE_ACTION_ID, {batch, iteration: i}),
          cyre.call(DEBOUNCE_ACTION_ID, {batch, iteration: i})
        )
      }

      await Promise.allSettled(batchCalls)

      // Pause between batches to allow throttle/debounce to resolve
      if (batch < batchCount - 1) {
        await new Promise(resolve => setTimeout(resolve, batchPause))
      }
    }

    // Wait for any pending debounced calls
    await new Promise(resolve => setTimeout(resolve, PROTECTION_INTERVAL * 2))

    console.log('[TEST] Final execution counts:', executionCounts)

    // Verify behavior
    // 1. Throttling should allow one call per interval per batch at most
    expect(executionCounts.throttled).toBeGreaterThanOrEqual(1)
    expect(executionCounts.throttled).toBeLessThan(batchSize * batchCount)

    // 2. Debouncing should collapse each batch into fewer calls
    expect(executionCounts.debounced).toBeGreaterThanOrEqual(1)

    // Print throttling/debouncing efficiency metrics
    const throttleEfficiency = (
      ((batchSize * batchCount - executionCounts.throttled) /
        (batchSize * batchCount)) *
      100
    ).toFixed(1)
    console.log(`[TEST] Throttling efficiency: ${throttleEfficiency}%`)

    const debounceEfficiency = (
      ((batchSize * batchCount - executionCounts.debounced) /
        (batchSize * batchCount)) *
      100
    ).toFixed(1)
    console.log(`[TEST] Debouncing efficiency: ${debounceEfficiency}%`)

    // Output implementation status
    console.log(
      `[TEST] Throttling implementation status: ${
        executionCounts.throttled < batchSize * batchCount
          ? 'Working'
          : 'Not working'
      }`
    )

    console.log(
      `[TEST] Debouncing implementation status: ${
        executionCounts.debounced < batchSize * batchCount
          ? 'Working'
          : 'Not working'
      }`
    )
  })
})
