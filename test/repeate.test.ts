// test/repeat.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/*
 * Test for CYRE repeat functionality
 * This test focuses on verifying that repeat works correctly with both
 * boolean values for infinite repetition and number values for countdown repetition.
 */

describe('Cyre Repeat Functionality', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== REPEAT TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== REPEAT TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test for repeat with boolean true value
   */
  it('should correctly handle repeat: true for infinite repetition', async () => {
    // Track execution
    const executionTimes: number[] = []
    const ACTION_ID = 'repeat-boolean-test'

    // Register handler
    cyre.on(ACTION_ID, payload => {
      const now = Date.now()
      executionTimes.push(now)
      console.log(`[HANDLER] Executed at ${now}:`, payload)
      return {executed: true, timestamp: now}
    })

    // Create action with boolean true repeat
    cyre.action({
      id: ACTION_ID,
      type: 'repeat-test',
      payload: {initial: true},
      interval: 100, // Use a short interval for testing
      repeat: true // Infinite repetition
    })

    // Start the action
    await cyre.call(ACTION_ID)

    // Wait for a few executions
    const totalWaitTime = 500 // Wait for 500ms to allow multiple executions
    await new Promise(resolve => setTimeout(resolve, totalWaitTime))

    console.log('[TEST] Execution count:', executionTimes.length)
    console.log('[TEST] Execution times:', executionTimes)

    // Verify multiple executions occurred (should have at least 3-4 with 100ms interval over 500ms)
    expect(executionTimes.length).toBeGreaterThan(2)

    // Stop the action to prevent further executions
    cyre.forget(ACTION_ID)
  })

  /**
   * Test for repeat with a numeric value
   */
  it('should correctly handle repeat: number for countdown repetition', async () => {
    // Track execution
    const executionTimes: number[] = []
    const ACTION_ID = 'repeat-number-test'
    const REPEAT_COUNT = 3

    // Register handler
    cyre.on(ACTION_ID, payload => {
      const now = Date.now()
      executionTimes.push(now)
      console.log(`[HANDLER] Executed at ${now}:`, payload)
      return {executed: true, timestamp: now}
    })

    // Create action with numeric repeat
    cyre.action({
      id: ACTION_ID,
      type: 'repeat-test',
      payload: {initial: true},
      interval: 100, // Use a short interval for testing
      repeat: REPEAT_COUNT // Execute exactly 3 times
    })

    // Start the action
    await cyre.call(ACTION_ID)

    // Wait for all executions to complete
    const totalWaitTime = 600 // Wait longer than needed to ensure all executions complete
    await new Promise(resolve => setTimeout(resolve, totalWaitTime))

    console.log('[TEST] Execution count:', executionTimes.length)
    console.log('[TEST] Execution times:', executionTimes)

    // Verify the exact number of executions
    expect(executionTimes.length).toBe(REPEAT_COUNT)
  })

  /**
   * Test for both types of repeat in the same test
   */
  it('should handle both boolean and numeric repeat values correctly', async () => {
    // Track execution
    const executionResults = {
      infiniteRepeat: 0,
      countdownRepeat: 0
    }

    const INFINITE_ID = 'repeat-infinite-test'
    const COUNTDOWN_ID = 'repeat-countdown-test'
    const REPEAT_COUNT = 2

    // Register handlers
    cyre.on(INFINITE_ID, () => {
      executionResults.infiniteRepeat++
      console.log(
        `[HANDLER] Infinite repeat executed: ${executionResults.infiniteRepeat}`
      )
      return {executed: true}
    })

    cyre.on(COUNTDOWN_ID, () => {
      executionResults.countdownRepeat++
      console.log(
        `[HANDLER] Countdown repeat executed: ${executionResults.countdownRepeat}`
      )
      return {executed: true}
    })

    // Create actions
    cyre.action({
      id: INFINITE_ID,
      type: 'repeat-test',
      interval: 50, // Very short for testing
      repeat: true // Infinite
    })

    cyre.action({
      id: COUNTDOWN_ID,
      type: 'repeat-test',
      interval: 100, // Longer interval
      repeat: REPEAT_COUNT // Limited count
    })

    // Start both actions
    await Promise.all([cyre.call(INFINITE_ID), cyre.call(COUNTDOWN_ID)])

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 300))

    // Check initial results
    const firstCheck = {...executionResults}
    console.log('[TEST] First check:', firstCheck)

    // Wait longer for more executions
    await new Promise(resolve => setTimeout(resolve, 200))

    // Check final results
    const secondCheck = {...executionResults}
    console.log('[TEST] Second check:', secondCheck)

    // Stop the infinite action
    cyre.forget(INFINITE_ID)

    // Verify results
    // Countdown should have executed exactly REPEAT_COUNT times
    expect(executionResults.countdownRepeat).toBe(REPEAT_COUNT)

    // Infinite should have executed more times during the second check
    expect(secondCheck.infiniteRepeat).toBeGreaterThan(
      firstCheck.infiniteRepeat
    )

    // Infinite should have executed multiple times
    expect(executionResults.infiniteRepeat).toBeGreaterThan(2)
  })

  /**
   * Test that an action stops repeating after being forgotten
   */
  it('should stop repeating after being forgotten', async () => {
    // Track execution
    const executionTimes: number[] = []
    const ACTION_ID = 'repeating-forgotten-test'

    // Register handler
    cyre.on(ACTION_ID, () => {
      executionTimes.push(Date.now())
      console.log(`[HANDLER] Executed: ${executionTimes.length}`)
      return {executed: true}
    })

    // Create action with infinite repeat
    cyre.action({
      id: ACTION_ID,
      type: 'repeat-test',
      interval: 50, // Very fast for testing
      repeat: true // Infinite
    })

    // Start action
    await cyre.call(ACTION_ID)

    // Let it execute a few times
    await new Promise(resolve => setTimeout(resolve, 200))

    // Record count after first round
    const firstCount = executionTimes.length
    console.log(`[TEST] Executions before forgetting: ${firstCount}`)

    // Forget the action to stop execution
    cyre.forget(ACTION_ID)

    // Wait to see if any more executions happen
    await new Promise(resolve => setTimeout(resolve, 200))

    // Record final count
    const finalCount = executionTimes.length
    console.log(`[TEST] Final executions: ${finalCount}`)

    // Verify no additional executions occurred after forgetting
    expect(finalCount).toBe(firstCount)
    expect(finalCount).toBeGreaterThan(1) // Ensure it did repeat at least once before forgetting
  })
})
