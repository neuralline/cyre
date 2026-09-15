// test/payload-update.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * This test demonstrates key behaviors in CYRE:
 * 1. How payloads are managed in interval actions
 * 2. How delay: 0 enables immediate execution
 * 3. How independent actions maintain separate timers
 */
describe('CYRE Payload Update Behavior', () => {
  // Test timeout - we need this longer for intervals
  const TEST_TIMEOUT = 3000

  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.init()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(
    'should use the most recent payload for interval repeats',
    async () => {
      const ACTION_ID = 'fruit-action'
      const INTERVAL = 300 // ms
      const REPEAT_COUNT = 3

      // Record execution history
      const executionHistory: Array<{
        timestamp: number
        fruit: string
        callIndex: number
      }> = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Setup the action with delay: 0 for immediate execution
      cyre.action({
        id: ACTION_ID,
        payload: {initial: true},
        interval: INTERVAL,
        repeat: REPEAT_COUNT,
        delay: 0 // Special case for immediate execution
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const now = Date.now()
        const elapsed = now - testStartTime

        executionHistory.push({
          timestamp: elapsed,
          fruit: payload.fruit,
          callIndex: payload.callIndex
        })

        return {executed: true}
      })

      // Make sequential calls with different payloads
      await cyre.call(ACTION_ID, {fruit: 'apple', callIndex: 1})

      // Small delay to ensure log sequence clarity
      await new Promise(resolve => setTimeout(resolve, 50))

      await cyre.call(ACTION_ID, {fruit: 'orange', callIndex: 2})

      // Small delay for clarity
      await new Promise(resolve => setTimeout(resolve, 50))

      await cyre.call(ACTION_ID, {fruit: 'lemon', callIndex: 3})

      // Wait for all interval executions to complete. A little extra
      // margin over the bare minimum (INTERVAL * (REPEAT_COUNT - 1)) so
      // real-timer jitter doesn't clip the last scheduled repeat.
      await new Promise(resolve =>
        setTimeout(resolve, INTERVAL * REPEAT_COUNT + 100)
      )

      // Analysis: first 3 entries should be the initial calls,
      // remaining entries should all be the last payload (lemon)
      const initialCalls = executionHistory.slice(0, 3)
      const intervalCalls = executionHistory.slice(3)

      // Verification
      expect(initialCalls.map(c => c.fruit)).toEqual([
        'apple',
        'orange',
        'lemon'
      ])

      // This is the actual claim the test is named for - it used to be
      // guarded by `if (intervalCalls.length > 0)` with no unconditional
      // check that any interval repeats happened at all. If interval
      // repeats silently stopped firing, the test passed without
      // asserting anything about the behavior it exists to verify.
      expect(intervalCalls.length).toBeGreaterThan(0)
      expect(intervalCalls.every(c => c.fruit === 'lemon')).toBe(true)
    },
    TEST_TIMEOUT
  ) // Extend timeout to allow for interval executions

  it(
    'should create distinct interval timers when using different action IDs',
    async () => {
      const INTERVAL = 300 // ms
      const REPEAT_COUNT = 2

      // Record execution history
      const executionHistory: Array<{
        timestamp: number
        actionId: string
        fruit: string
      }> = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Setup multiple actions with same configuration but different IDs
      const actions = ['apple-action', 'orange-action', 'lemon-action']

      actions.forEach(actionId => {
        // Register the action with delay: 0 for immediate execution
        cyre.action({
          id: actionId,
          payload: {initial: true},
          interval: INTERVAL,
          repeat: REPEAT_COUNT,
          delay: 0 // Immediate execution
        })

        // Register the handler
        cyre.on(actionId, (payload: any) => {
          const elapsed = Date.now() - testStartTime

          executionHistory.push({
            timestamp: elapsed,
            actionId,
            fruit: payload.fruit
          })

          return {executed: true}
        })
      })

      // Call each action with its appropriate fruit
      await cyre.call('apple-action', {fruit: 'apple'})
      await cyre.call('orange-action', {fruit: 'orange'})
      await cyre.call('lemon-action', {fruit: 'lemon'})

      // Wait for all interval executions to complete
      await new Promise(resolve => setTimeout(resolve, INTERVAL * REPEAT_COUNT))

      // Group executions by action ID
      const executionsByAction = actions.reduce(
        (acc, actionId) => {
          acc[actionId] = executionHistory.filter(
            record => record.actionId === actionId
          )
          return acc
        },
        {} as Record<string, typeof executionHistory>
      )

      // Verify results
      for (const [actionId, records] of Object.entries(executionsByAction)) {
        // Should have immediate call + repeats = REPEAT_COUNT total
        expect(records.length).toBe(REPEAT_COUNT)
        expect(records.every(r => r.fruit === records[0]?.fruit)).toBe(true)
      }
    },
    TEST_TIMEOUT
  )
})
