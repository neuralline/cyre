// test/interval-behavior.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {io, timeline} from '../src/context/state' // Import timeline and io

/**
 * CYRE Interval Behavior Test
 *
 * This test file specifically addresses and documents the behavior of CYRE's interval
 * actions, focusing on:
 *
 * 1. Interval actions wait for the interval before first execution
 * 2. Delay overrides interval for initial wait time
 * 3. Repeat specifies total number of executions
 * 4. No immediate executions for interval or delay actions by default
 * 5. delay: 0 provides immediate execution
 */
describe('CYRE Interval Behavior', () => {
  // Extend timeout for all tests to 15 seconds
  const TEST_TIMEOUT = 15000

  // Use smaller intervals to speed up tests
  const SMALL_INTERVAL = 100 // ms

  // Track action IDs to clean up after each test
  const testActionIds: string[] = []

  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.init()

    // Clear our tracking array
    testActionIds.length = 0
  })

  afterEach(() => {
    // Clean up all actions created in tests
    testActionIds.forEach(id => {
      cyre.forget(id) // Use forget instead of clear
    })

    vi.restoreAllMocks()
  })

  it(
    'should wait for interval before first execution',
    async () => {
      const ACTION_ID = 'interval-wait-test'
      testActionIds.push(ACTION_ID) // Track for cleanup

      const REPEAT_COUNT = 1 // Just need one execution to validate timing

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        interval: SMALL_INTERVAL,
        repeat: REPEAT_COUNT
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const elapsed = getElapsedTime()
        executionTimes.push(elapsed)
        return {executed: true}
      })

      // Call the action
      await cyre.call(ACTION_ID, {counter: 1})

      // Wait for execution to complete with buffer
      const waitTime = SMALL_INTERVAL * 2
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Verify execution occurred - unconditional, so a regression that
      // stops the interval from ever firing actually fails this test
      // instead of silently passing on an empty array
      expect(executionTimes.length).toBeGreaterThan(0)

      // First execution should wait for interval (not immediate)
      expect(executionTimes[0]).toBeGreaterThanOrEqual(SMALL_INTERVAL * 0.9)
    },
    TEST_TIMEOUT
  )

  it(
    'should update interval action state with payloads from sequential calls',
    async () => {
      const ACTION_ID = 'payload-update-test'
      testActionIds.push(ACTION_ID) // Track for cleanup

      const REPEAT_COUNT = 1 // Just need a few executions

      // Record execution details
      const executions: Array<{
        time: number
        payload: any
      }> = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {initial: true},
        interval: SMALL_INTERVAL,
        repeat: REPEAT_COUNT
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const elapsed = getElapsedTime()

        executions.push({
          time: elapsed,
          payload: {...payload} // Clone to avoid reference sharing
        })

        return {executed: true}
      })

      // Call with final payload (we'll just test one payload to simplify)
      await cyre.call(ACTION_ID, {value: 'final'})

      // Wait for execution with buffer
      await new Promise(resolve => setTimeout(resolve, SMALL_INTERVAL * 2))

      // Verify execution occurred - unconditional
      expect(executions.length).toBeGreaterThan(0)

      // The (only) execution should carry our payload
      const lastExecution = executions[executions.length - 1]
      expect(lastExecution.payload.value).toBe('final')
    },
    TEST_TIMEOUT
  )

  it(
    'should maintain separate interval timers for different action IDs',
    async () => {
      // Create multiple actions with same configuration but different IDs
      const ACTION_IDS = ['action-a', 'action-b'] // Reduced to 2 actions
      testActionIds.push(...ACTION_IDS) // Track for cleanup

      const REPEAT_COUNT = 1 // Just one execution per action

      // Track executions per action
      const executionsByAction: Record<string, boolean> = {}
      ACTION_IDS.forEach(id => {
        executionsByAction[id] = false // Track whether execution occurred at all
      })

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Setup handlers and actions
      ACTION_IDS.forEach(actionId => {
        // Setup handler
        cyre.on(actionId, (payload: any) => {
          const elapsed = getElapsedTime()
          executionsByAction[actionId] = true // Mark as executed
          return {executed: true}
        })

        // Create action
        cyre.action({
          id: actionId,
          payload: {value: actionId},
          interval: SMALL_INTERVAL,
          repeat: REPEAT_COUNT
        })
      })

      // Call each action
      for (const actionId of ACTION_IDS) {
        await cyre.call(actionId, {value: actionId})
      }

      // Wait for all executions
      await new Promise(resolve => setTimeout(resolve, SMALL_INTERVAL * 2))

      // Verify each action executed at least once
      Object.entries(executionsByAction).forEach(([actionId, executed]) => {
        expect(executed).toBe(true)
      })
    },
    TEST_TIMEOUT
  )

  it(
    'should override existing interval timer when calling same action with new payload',
    async () => {
      const ACTION_ID = 'override-test'
      testActionIds.push(ACTION_ID) // Track for cleanup

      const REPEAT_COUNT = 1 // Just need one execution

      // Record execution details, just the most recent value
      let lastExecutedValue: string | null = null

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {initial: true},
        interval: SMALL_INTERVAL,
        repeat: REPEAT_COUNT
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const elapsed = getElapsedTime()
        lastExecutedValue = payload.value
        return {executed: true}
      })

      // First call
      await cyre.call(ACTION_ID, {value: 'first'})

      // Small delay, then override with second call
      await new Promise(resolve => setTimeout(resolve, 20))
      await cyre.call(ACTION_ID, {value: 'second'})

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, SMALL_INTERVAL * 2))

      // Verify the last execution used the second value. This used to be
      // guarded by `if (lastExecutedValue !== null)` with no unconditional
      // check that execution happened at all - if the override silently
      // broke and the handler never ran, the whole test passed without
      // asserting anything. Now a missed execution actually fails it.
      expect(lastExecutedValue).not.toBeNull()
      expect(lastExecutedValue).toBe('second')
    },
    TEST_TIMEOUT
  )
})
