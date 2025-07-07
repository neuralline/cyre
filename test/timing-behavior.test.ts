// test/timing-behavior.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * CYRE Timing Behavior Tests
 

    Cyre Interval, Delay, Repeat Logic

      Interval Actions:
      First execution WAITS for the interval, then repeats 
      Aligns with setInterval behavior that developers expect

      Delay Actions:
      First execution WAITS for delay
      overwrites interval for initial execution waiting time
     

      Repeat Handling:
      repeat specifies TOTAL number of executions 
      repeat: 3 = Execute exactly 3 times total


      Combined Delay and Interval:
      Delay applies first, then interval timing for subsequent executions
      No immediate executions for interval or delay actions


      Edge Cases:
      { repeat: 0 } = Do not execute at all. 
      { repeat: 1, interval: 1000 } = Wait 1000ms, execute once, done.
      { delay: 0 } = wait 0ms then execute.

 * This test suite validates CYRE's timing behavior according to the following rules:
 *
 * 1. Interval Actions: First execution WAITS for the interval, then repeats
 * 2. Delay Actions: First execution WAITS for the delay
 * 3. Repeat Handling: repeat specifies TOTAL number of executions
 * 4. Combined Delay and Interval: Delay applies first, then interval timing
 * 5. Edge Cases: repeat: 0, delay: 0, etc. are handled correctly
 */
describe('CYRE Timing Behavior', () => {
  // Test timeout - longer timeout to accommodate intervals
  const TEST_TIMEOUT = 5000

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
    'should wait for interval before first execution',
    async () => {
      const ACTION_ID = 'interval-only-action'
      const INTERVAL = 300 // ms
      const REPEAT_COUNT = 2 // Total of 2 executions

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        interval: INTERVAL,
        repeat: REPEAT_COUNT
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const elapsed = getElapsedTime()
        executionTimes.push(elapsed)
        logWithTime(`EXECUTED with counter: ${payload.counter}`)
        return {executed: true}
      })

      // Call the action
      logWithTime(
        'CALLING action - should wait for interval before first execution'
      )
      await cyre.call(ACTION_ID, {counter: 1})

      // Wait for all executions to complete
      const waitTime = INTERVAL * (REPEAT_COUNT + 1)
      logWithTime(`Waiting ${waitTime}ms for executions to complete...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Log execution times
      logWithTime('Execution times:')
      executionTimes.forEach((time, index) => {
        console.log(`  ${index + 1}. ${time}ms after test start`)
      })

      // ASSERTIONS

      // Should have REPEAT_COUNT total executions
      expect(executionTimes.length).toBe(REPEAT_COUNT)

      // First execution should happen after the interval (not immediately)
      expect(executionTimes[0]).toBeGreaterThanOrEqual(INTERVAL * 0.9)
      expect(executionTimes[0]).toBeLessThanOrEqual(INTERVAL * 1.2)

      // If more than one execution, check interval between them
      if (executionTimes.length > 1) {
        const actualInterval = executionTimes[1] - executionTimes[0]
        expect(actualInterval).toBeGreaterThanOrEqual(INTERVAL * 0.9)
        expect(actualInterval).toBeLessThanOrEqual(INTERVAL * 1.2)
      }
    },
    TEST_TIMEOUT
  )

  it(
    'should wait for delay before execution',
    async () => {
      const ACTION_ID = 'delay-only-action'
      const DELAY = 300 // ms

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        delay: DELAY,
        repeat: 1 // Total of 1 execution
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const elapsed = getElapsedTime()
        executionTimes.push(elapsed)
        logWithTime(`EXECUTED with counter: ${payload.counter}`)
        return {executed: true}
      })

      // Call the action
      logWithTime('CALLING action - should wait for delay')
      await cyre.call(ACTION_ID, {counter: 1})

      // Wait for execution to complete
      logWithTime(`Waiting ${DELAY * 1.5}ms for execution...`)
      await new Promise(resolve => setTimeout(resolve, DELAY * 1.5))

      // ASSERTIONS

      // Should have exactly 1 execution
      expect(executionTimes.length).toBe(1)

      // Execution should happen after the delay (not immediately)
      expect(executionTimes[0]).toBeGreaterThanOrEqual(DELAY * 0.9)
      expect(executionTimes[0]).toBeLessThanOrEqual(DELAY * 1.2)
    },
    TEST_TIMEOUT
  )

  it(
    'should handle combined delay and interval correctly',
    async () => {
      const ACTION_ID = 'combined-action'
      const DELAY = 200 // ms
      const INTERVAL = 300 // ms
      const REPEAT_COUNT = 3 // Total of 3 executions

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        delay: DELAY,
        interval: INTERVAL,
        repeat: REPEAT_COUNT
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const elapsed = getElapsedTime()
        executionTimes.push(elapsed)
        logWithTime(`EXECUTED with counter: ${payload.counter}`)
        return {executed: true}
      })

      // Call the action
      logWithTime(
        'CALLING action - should use delay for first wait, then interval'
      )
      await cyre.call(ACTION_ID, {counter: 1})

      // Wait for all executions to complete
      const waitTime = DELAY + INTERVAL * REPEAT_COUNT
      logWithTime(`Waiting ${waitTime}ms for executions to complete...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Log execution times
      logWithTime('Execution times:')
      executionTimes.forEach((time, index) => {
        console.log(`  ${index + 1}. ${time}ms after test start`)
      })

      // Calculate intervals between executions
      const intervals = []
      for (let i = 1; i < executionTimes.length; i++) {
        intervals.push(executionTimes[i] - executionTimes[i - 1])
      }

      logWithTime('Intervals between executions:')
      intervals.forEach((interval, index) => {
        console.log(`  ${index + 1}. ${interval}ms`)
      })

      // ASSERTIONS

      // Should have REPEAT_COUNT total executions
      expect(executionTimes.length).toBe(REPEAT_COUNT)

      // First execution should happen after the delay (not immediately)
      expect(executionTimes[0]).toBeGreaterThanOrEqual(DELAY * 0.9)
      expect(executionTimes[0]).toBeLessThanOrEqual(DELAY * 1.2)

      // Subsequent executions should follow the interval
      if (intervals.length > 0) {
        intervals.forEach(interval => {
          expect(interval).toBeGreaterThanOrEqual(INTERVAL * 0.9)
          expect(interval).toBeLessThanOrEqual(INTERVAL * 1.2)
        })
      }
    },
    TEST_TIMEOUT
  )

  it(
    'should respect repeat: 0 by not executing',
    async () => {
      const ACTION_ID = 'zero-repeat-action'
      const INTERVAL = 200 // ms

      // Flag to track execution
      let executed = false

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        interval: INTERVAL,
        repeat: 0 // Should not execute
      })

      // Setup the handler
      cyre.on(ACTION_ID, () => {
        executed = true
        logWithTime('EXECUTED - THIS SHOULD NOT HAPPEN')
        return {executed: true}
      })

      // Call the action
      logWithTime('CALLING action with repeat: 0 - should not execute')
      const result = await cyre.call(ACTION_ID, {counter: 1})

      logWithTime(`Call result: ${JSON.stringify(result)}`)

      // Wait to verify no execution occurs
      logWithTime(`Waiting ${INTERVAL * 2}ms to verify no execution...`)
      await new Promise(resolve => setTimeout(resolve, INTERVAL * 2))

      // ASSERTIONS

      // Should not have executed
      expect(executed).toBe(false)

      // Call should return ok: true (action registered but not executed)
      expect(result.ok).toBe(true)
      expect(result.message).toContain(
        'Timed execution: interval=200ms repeat=0'
      )
    },
    TEST_TIMEOUT
  )

  it(
    'should handle delay: 0 as immediate execution',
    async () => {
      const ACTION_ID = 'zero-delay-action'
      const DELAY = 0 // ms

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        delay: DELAY,
        repeat: 1 // Execute once
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const elapsed = getElapsedTime()
        executionTimes.push(elapsed)
        logWithTime(`EXECUTED with counter: ${payload.counter} at ${elapsed}ms`)
        return {executed: true}
      })

      // Call the action
      logWithTime('CALLING action with delay: 0 - should execute immediately')
      await cyre.call(ACTION_ID, {counter: 1})

      // Wait a bit to ensure execution happens
      logWithTime('Waiting 100ms to ensure execution completes...')
      await new Promise(resolve => setTimeout(resolve, 100))

      // ASSERTIONS

      // Should have exactly 1 execution
      expect(executionTimes.length).toBe(1)

      // Execution should happen "immediately" (under 50ms)
      expect(executionTimes[0]).toBeLessThan(50)
    },
    TEST_TIMEOUT
  )

  it(
    'should execute the exact number of times specified by repeat',
    async () => {
      const ACTION_ID = 'exact-repeat-action'
      const INTERVAL = 150 // ms
      const REPEAT_COUNT = 3 // Total of 3 executions

      // Record execution count
      let executionCount = 0

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        interval: INTERVAL,
        repeat: REPEAT_COUNT
      })

      // Setup the handler
      cyre.on(ACTION_ID, () => {
        executionCount++
        logWithTime(`EXECUTED count: ${executionCount}`)
        return {executed: true}
      })

      // Call the action
      logWithTime(`CALLING action with repeat: ${REPEAT_COUNT}`)
      await cyre.call(ACTION_ID)

      // Wait for all possible executions to complete
      const waitTime = INTERVAL * (REPEAT_COUNT + 2) // Add buffer
      logWithTime(`Waiting ${waitTime}ms for all possible executions...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // ASSERTIONS

      // Should have executed exactly REPEAT_COUNT times (not more, not less)
      expect(executionCount).toBe(REPEAT_COUNT)
    },
    TEST_TIMEOUT
  )

  it(
    'should handle infinite repeats with repeat: true',
    async () => {
      const ACTION_ID = 'infinite-repeat-action'
      const INTERVAL = 100 // ms
      const EXECUTION_THRESHOLD = 5 // How many executions to verify

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        interval: INTERVAL,
        repeat: true // Infinite repeats
      })

      // Setup the handler
      cyre.on(ACTION_ID, () => {
        const elapsed = getElapsedTime()
        executionTimes.push(elapsed)
        logWithTime(`EXECUTED #${executionTimes.length} at ${elapsed}ms`)

        // Stop after threshold reached
        if (executionTimes.length >= EXECUTION_THRESHOLD) {
          cyre.forget(ACTION_ID)
        }

        return {executed: true}
      })

      // Call the action
      logWithTime('CALLING action with infinite repeats')
      await cyre.call(ACTION_ID)

      // Wait for threshold executions
      const waitTime = INTERVAL * (EXECUTION_THRESHOLD + 2) // Add buffer
      logWithTime(
        `Waiting ${waitTime}ms for ${EXECUTION_THRESHOLD} executions...`
      )
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // ASSERTIONS

      // Should have executed at least EXECUTION_THRESHOLD times
      expect(executionTimes.length).toBeGreaterThanOrEqual(EXECUTION_THRESHOLD)

      // First execution should wait for interval
      expect(executionTimes[0]).toBeGreaterThanOrEqual(INTERVAL * 0.9)

      // Intervals between executions should match INTERVAL
      for (let i = 1; i < executionTimes.length; i++) {
        const actualInterval = executionTimes[i] - executionTimes[i - 1]
        expect(actualInterval).toBeGreaterThanOrEqual(INTERVAL * 0.9)
        expect(actualInterval).toBeLessThanOrEqual(INTERVAL * 1.5) // Allow more buffer for infinite case
      }
    },
    TEST_TIMEOUT
  )
})
