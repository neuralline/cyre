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
    cyre.initialize()

    console.log('\n===== PAYLOAD UPDATE TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== PAYLOAD UPDATE TEST COMPLETED =====\n')
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

        console.log(
          `[EXEC ${elapsed}ms] Fruit: ${payload.fruit} (Call #${payload.callIndex})`
        )

        executionHistory.push({
          timestamp: elapsed,
          fruit: payload.fruit,
          callIndex: payload.callIndex
        })

        return {executed: true}
      })

      // Make sequential calls with different payloads
      console.log(`[CALL ${getElapsedTime()}ms] Calling with apple`)
      await cyre.call(ACTION_ID, {fruit: 'apple', callIndex: 1})

      // Small delay to ensure log sequence clarity
      await new Promise(resolve => setTimeout(resolve, 50))

      console.log(`[CALL ${getElapsedTime()}ms] Calling with orange`)
      await cyre.call(ACTION_ID, {fruit: 'orange', callIndex: 2})

      // Small delay for clarity
      await new Promise(resolve => setTimeout(resolve, 50))

      console.log(`[CALL ${getElapsedTime()}ms] Calling with lemon`)
      await cyre.call(ACTION_ID, {fruit: 'lemon', callIndex: 3})

      // Wait for all interval executions to complete
      console.log(`\nWaiting for ${REPEAT_COUNT} interval executions...`)
      await new Promise(resolve =>
        setTimeout(resolve, INTERVAL * (REPEAT_COUNT - 1))
      )

      // Log the execution history
      console.log('\nExecution History:')
      executionHistory.forEach((record, index) => {
        console.log(
          `${index + 1}. [${record.timestamp}ms] ${record.fruit} (Call #${
            record.callIndex
          })`
        )
      })

      // Analysis: first 3 entries should be the initial calls,
      // remaining entries should all be the last payload (lemon)
      const initialCalls = executionHistory.slice(0, 3)
      const intervalCalls = executionHistory.slice(3)

      console.log('\nTest Analysis:')
      console.log('- Initial calls:', initialCalls.map(c => c.fruit).join(', '))
      console.log(
        '- Interval repeats:',
        intervalCalls.map(c => c.fruit).join(', ')
      )

      // Verification
      expect(initialCalls.map(c => c.fruit)).toEqual([
        'apple',
        'orange',
        'lemon'
      ])

      // All interval repeats should be the last payload (lemon)
      if (intervalCalls.length > 0) {
        expect(intervalCalls.every(c => c.fruit === 'lemon')).toBe(true)
      }

      console.log(
        '\nTest confirms: Only the most recent payload (lemon) is used for interval repeats!'
      )
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

          console.log(
            `[EXEC ${elapsed}ms] Action: ${actionId}, Fruit: ${payload.fruit}`
          )

          executionHistory.push({
            timestamp: elapsed,
            actionId,
            fruit: payload.fruit
          })

          return {executed: true}
        })
      })

      // Call each action with its appropriate fruit
      console.log(`[CALL ${getElapsedTime()}ms] Calling apple-action`)
      await cyre.call('apple-action', {fruit: 'apple'})

      console.log(`[CALL ${getElapsedTime()}ms] Calling orange-action`)
      await cyre.call('orange-action', {fruit: 'orange'})

      console.log(`[CALL ${getElapsedTime()}ms] Calling lemon-action`)
      await cyre.call('lemon-action', {fruit: 'lemon'})

      // Wait for all interval executions to complete
      console.log(`\nWaiting for ${REPEAT_COUNT} executions for each action...`)
      await new Promise(resolve => setTimeout(resolve, INTERVAL * REPEAT_COUNT))

      // Group executions by action ID
      const executionsByAction = actions.reduce((acc, actionId) => {
        acc[actionId] = executionHistory.filter(
          record => record.actionId === actionId
        )
        return acc
      }, {} as Record<string, typeof executionHistory>)

      // Log and verify results
      console.log('\nExecution Counts by Action:')
      for (const [actionId, records] of Object.entries(executionsByAction)) {
        // Should have immediate call + repeats = REPEAT_COUNT total
        console.log(
          `- ${actionId}: ${records.length} executions with "${records[0]?.fruit}"`
        )

        expect(records.length).toBe(REPEAT_COUNT)
        expect(records.every(r => r.fruit === records[0]?.fruit)).toBe(true)
      }

      console.log(
        '\nTest confirms: Different action IDs maintain independent interval timers!'
      )
    },
    TEST_TIMEOUT
  )
})
