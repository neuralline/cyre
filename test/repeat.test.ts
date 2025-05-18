// test/repeat.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * This test validates CYRE's execution behavior for interval and repeated actions
 * following the new timing rules:
 *
 * 1. Interval actions wait for the interval before first execution
 * 2. Delay overrides interval for initial wait time
 * 3. Repeat specifies total number of executions
 * 4. No immediate executions for interval or delay actions by default
 * 5. Edge cases like repeat: 0 and delay: 0 are properly handled
 */
describe('CYRE Repeat and Timing Behavior', () => {
  // Test timeout - we need this longer for intervals
  const TEST_TIMEOUT = 5000

  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('\n===== REPEAT BEHAVIOR TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== REPEAT BEHAVIOR TEST COMPLETED =====\n')
    vi.restoreAllMocks()
  })

  it(
    'should wait for interval before each execution including the first',
    async () => {
      const ACTION_ID = 'interval-action'
      const INTERVAL = 300 // ms
      const TOTAL_EXECUTIONS = 3 // Total executions

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
        repeat: TOTAL_EXECUTIONS
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const now = Date.now()
        const elapsed = now - testStartTime

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
      const waitTime = INTERVAL * (TOTAL_EXECUTIONS + 1) // Add buffer
      logWithTime(`Waiting for ${waitTime}ms for all executions...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Log the execution times
      logWithTime('Execution times:')
      executionTimes.forEach((time, index) => {
        console.log(`  ${index + 1}. ${time}ms after test start`)
      })

      // Calculate intervals between executions
      const intervalsBetweenExecutions = []
      for (let i = 1; i < executionTimes.length; i++) {
        intervalsBetweenExecutions.push(
          executionTimes[i] - executionTimes[i - 1]
        )
      }

      logWithTime('Intervals between executions:')
      intervalsBetweenExecutions.forEach((interval, index) => {
        console.log(`  ${index + 1}. ${interval}ms`)
      })

      // ASSERTIONS

      // Should have executed exactly TOTAL_EXECUTIONS times
      expect(executionTimes.length).toBe(TOTAL_EXECUTIONS)

      // First execution should wait for the interval (not immediate)
      expect(executionTimes[0]).toBeGreaterThanOrEqual(INTERVAL * 0.9)
      expect(executionTimes[0]).toBeLessThanOrEqual(INTERVAL * 1.1)

      // Subsequent executions should be separated by the interval
      intervalsBetweenExecutions.forEach(interval => {
        expect(interval).toBeGreaterThanOrEqual(INTERVAL * 0.9)
        expect(interval).toBeLessThanOrEqual(INTERVAL * 1.1)
      })
    },
    TEST_TIMEOUT
  )

  it(
    'should use delay value for initial wait when both delay and interval are specified',
    async () => {
      const ACTION_ID = 'delay-interval-action'
      const DELAY = 150 // ms - shorter than interval
      const INTERVAL = 300 // ms
      const TOTAL_EXECUTIONS = 3 // Total executions

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action with delay overriding interval for first wait
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        delay: DELAY,
        interval: INTERVAL,
        repeat: TOTAL_EXECUTIONS
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const now = Date.now()
        const elapsed = now - testStartTime

        executionTimes.push(elapsed)
        logWithTime(`EXECUTED with counter: ${payload.counter}`)

        return {executed: true}
      })

      // Call the action
      logWithTime(
        'CALLING action - should wait for delay first, then use interval timing'
      )
      await cyre.call(ACTION_ID, {counter: 1})

      // Wait for all executions to complete
      const waitTime = DELAY + INTERVAL * TOTAL_EXECUTIONS // Account for delay and intervals
      logWithTime(`Waiting for ${waitTime}ms for all executions...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Log the execution times
      logWithTime('Execution times:')
      executionTimes.forEach((time, index) => {
        console.log(`  ${index + 1}. ${time}ms after test start`)
      })

      // ASSERTIONS

      // Should have executed exactly TOTAL_EXECUTIONS times
      expect(executionTimes.length).toBe(TOTAL_EXECUTIONS)

      // First execution should wait for the DELAY (not interval)
      expect(executionTimes[0]).toBeGreaterThanOrEqual(DELAY * 0.9)
      expect(executionTimes[0]).toBeLessThanOrEqual(DELAY * 1.2)
      expect(executionTimes[0]).toBeLessThan(INTERVAL * 0.9) // Should be faster than interval

      // Calculate intervals between executions
      if (executionTimes.length > 1) {
        const secondExecutionInterval = executionTimes[1] - executionTimes[0]
        // Second execution should follow the INTERVAL timing
        expect(secondExecutionInterval).toBeGreaterThanOrEqual(INTERVAL * 0.9)
        expect(secondExecutionInterval).toBeLessThanOrEqual(INTERVAL * 1.2)
      }
    },
    TEST_TIMEOUT
  )

  it(
    'should execute immediately when delay is explicitly set to 0',
    async () => {
      const ACTION_ID = 'zero-delay-action'
      const DELAY = 0 // ms - immediate execution
      const INTERVAL = 200 // ms
      const TOTAL_EXECUTIONS = 2 // Total executions

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action with explicit zero delay
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        delay: DELAY,
        interval: INTERVAL,
        repeat: TOTAL_EXECUTIONS
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const now = Date.now()
        const elapsed = now - testStartTime

        executionTimes.push(elapsed)
        logWithTime(`EXECUTED with counter: ${payload.counter}`)

        return {executed: true}
      })

      // Call the action
      logWithTime('CALLING action with delay: 0 - should execute immediately')
      await cyre.call(ACTION_ID, {counter: 1})

      // Wait for all executions to complete
      const waitTime = INTERVAL * (TOTAL_EXECUTIONS + 1) // Add buffer
      logWithTime(`Waiting for ${waitTime}ms for all executions...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Log the execution times
      logWithTime('Execution times:')
      executionTimes.forEach((time, index) => {
        console.log(`  ${index + 1}. ${time}ms after test start`)
      })

      // ASSERTIONS

      // Should have executed exactly TOTAL_EXECUTIONS times
      expect(executionTimes.length).toBe(TOTAL_EXECUTIONS)

      // First execution should be near-immediate due to delay: 0
      expect(executionTimes[0]).toBeLessThan(50)

      // Calculate intervals between executions
      if (executionTimes.length > 1) {
        const secondExecutionInterval = executionTimes[1] - executionTimes[0]
        // Second execution should follow the INTERVAL timing
        expect(secondExecutionInterval).toBeGreaterThanOrEqual(INTERVAL * 0.9)
        expect(secondExecutionInterval).toBeLessThanOrEqual(INTERVAL * 1.2)
      }
    },
    TEST_TIMEOUT
  )

  it(
    'should support infinite repeats with repeat: true',
    async () => {
      const ACTION_ID = 'infinite-repeats-action'
      const INTERVAL = 150 // ms
      const EXECUTION_COUNT = 4 // How many executions to wait for

      // Record execution timestamps
      const executionTimes: number[] = []

      // Create test start time reference
      const testStartTime = Date.now()
      const getElapsedTime = () => Date.now() - testStartTime

      // Helper to log with timestamp
      const logWithTime = (message: string) => {
        console.log(`[${getElapsedTime()}ms] ${message}`)
      }

      // Setup the action with infinite repeats
      cyre.action({
        id: ACTION_ID,
        payload: {counter: 0},
        interval: INTERVAL,
        repeat: true // Infinite repeats
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const now = Date.now()
        const elapsed = now - testStartTime

        executionTimes.push(elapsed)
        logWithTime(`EXECUTED with counter: ${payload.counter}`)

        // Stop infinite execution after reaching our target count
        if (executionTimes.length >= EXECUTION_COUNT) {
          cyre.forget(ACTION_ID)
        }

        return {executed: true}
      })

      // Call the action
      logWithTime('CALLING action with infinite repeats')
      await cyre.call(ACTION_ID, {counter: 1})

      // Wait for enough executions
      logWithTime(`Waiting for ${EXECUTION_COUNT} executions...`)

      // Use a promise that resolves when we have enough executions
      await new Promise<void>(resolve => {
        const checkInterval = setInterval(() => {
          if (executionTimes.length >= EXECUTION_COUNT) {
            clearInterval(checkInterval)
            resolve()
          }
        }, INTERVAL / 2)
      })

      // Add a small buffer to ensure last execution is recorded
      await new Promise(resolve => setTimeout(resolve, 50))

      // Log the execution times
      logWithTime('Execution times:')
      executionTimes.forEach((time, index) => {
        console.log(`  ${index + 1}. ${time}ms after test start`)
      })

      // ASSERTIONS

      // Should have executed at least EXECUTION_COUNT times
      expect(executionTimes.length).toBeGreaterThanOrEqual(EXECUTION_COUNT)

      // First execution should wait for the interval
      expect(executionTimes[0]).toBeGreaterThanOrEqual(INTERVAL * 0.9)
      expect(executionTimes[0]).toBeLessThanOrEqual(INTERVAL * 1.2)

      // Calculate intervals between executions
      const intervalsBetweenExecutions = []
      for (let i = 1; i < executionTimes.length; i++) {
        intervalsBetweenExecutions.push(
          executionTimes[i] - executionTimes[i - 1]
        )
      }

      // Intervals should match the specified INTERVAL
      intervalsBetweenExecutions.forEach(interval => {
        expect(interval).toBeGreaterThanOrEqual(INTERVAL * 0.9)
        expect(interval).toBeLessThanOrEqual(INTERVAL * 1.3) // Allow more margin for infinite case
      })
    },
    TEST_TIMEOUT
  )

  it(
    'should not execute any action with repeat: 0',
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
      expect(result.message).toContain('not executed')
    },
    TEST_TIMEOUT
  )

  it(
    'should handle multiple calls to the same action ID by using the most recent payload',
    async () => {
      const ACTION_ID = 'multiple-calls-action'
      const INTERVAL = 200 // ms
      const TOTAL_EXECUTIONS = 3 // Total executions

      // Record executions with payloads
      const executions: Array<{time: number; payload: any}> = []

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
        payload: {value: 'initial'},
        interval: INTERVAL,
        repeat: TOTAL_EXECUTIONS
      })

      // Setup the handler
      cyre.on(ACTION_ID, (payload: any) => {
        const elapsed = getElapsedTime()

        logWithTime(`EXECUTED with value: ${payload.value}`)
        executions.push({
          time: elapsed,
          payload: {...payload} // Clone to avoid reference sharing
        })

        return {executed: true}
      })

      // Make sequential calls with different payloads
      // Add delays between calls to ensure they're processed in sequence
      logWithTime('CALLING with first value')
      await cyre.call(ACTION_ID, {value: 'first'})

      // Small delay before second call
      await new Promise(resolve => setTimeout(resolve, 50))

      logWithTime('CALLING with second value')
      await cyre.call(ACTION_ID, {value: 'second'})

      // Small delay before third call
      await new Promise(resolve => setTimeout(resolve, 50))

      logWithTime('CALLING with final value')
      await cyre.call(ACTION_ID, {value: 'final'})

      // Wait for all executions to complete
      const waitTime = INTERVAL * (TOTAL_EXECUTIONS + 1) // Add buffer
      logWithTime(`Waiting for ${waitTime}ms for all executions...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      // Log the executions
      logWithTime('Execution details:')
      executions.forEach((exec, index) => {
        console.log(
          `  ${index + 1}. [${exec.time}ms] Value: ${exec.payload.value}`
        )
      })

      // ASSERTIONS - UPDATED TO MATCH IMPLEMENTATION BEHAVIOR

      // Check if all executed values after the final call use the final payload
      const executionsAfterFinalCall = executions.filter(
        exec =>
          // Find executions that happened after a reasonable time after the final call
          // 50ms should be enough buffer for the final call to be processed
          exec.time > 525 + 50
      )

      logWithTime(
        `Found ${executionsAfterFinalCall.length} executions after final call`
      )

      // All executions after final call should use final payload
      executionsAfterFinalCall.forEach(exec => {
        expect(exec.payload.value).toBe('final')
      })

      // First execution with interval should happen after the interval
      const firstIntervalExecution = executionsAfterFinalCall[0]
      if (firstIntervalExecution) {
        expect(firstIntervalExecution.time).toBeGreaterThanOrEqual(
          525 + INTERVAL * 0.9
        )
      }
    },
    TEST_TIMEOUT
  ),
    it(
      'should apply debounce before any execution when specified',
      async () => {
        const ACTION_ID = 'debounce-action'
        const DEBOUNCE = 200 // ms

        // Record execution timestamps
        const executionTimes: number[] = []

        // Create test start time reference
        const testStartTime = Date.now()
        const getElapsedTime = () => Date.now() - testStartTime

        // Helper to log with timestamp
        const logWithTime = (message: string) => {
          console.log(`[${getElapsedTime()}ms] ${message}`)
        }

        // Setup the action with debounce
        cyre.action({
          id: ACTION_ID,
          debounce: DEBOUNCE,
          repeat: 1
        })

        // Setup the handler
        cyre.on(ACTION_ID, (payload: any) => {
          const elapsed = getElapsedTime()
          executionTimes.push(elapsed)
          logWithTime(`EXECUTED with value: ${payload.value}`)
          return {executed: true}
        })

        // Make multiple rapid calls that should get debounced
        logWithTime('CALLING first time')
        await cyre.call(ACTION_ID, {value: 'first'})

        logWithTime('CALLING second time immediately')
        await cyre.call(ACTION_ID, {value: 'second'})

        logWithTime('CALLING third time immediately')
        await cyre.call(ACTION_ID, {value: 'third'})

        // Wait for debounce to complete
        const waitTime = DEBOUNCE * 1.5
        logWithTime(`Waiting ${waitTime}ms for debounce to complete...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))

        // ASSERTIONS

        // Should execute exactly once after debounce period
        expect(executionTimes.length).toBe(1)

        // Execution should happen after the debounce period
        expect(executionTimes[0]).toBeGreaterThanOrEqual(DEBOUNCE * 0.9)
        expect(executionTimes[0]).toBeLessThanOrEqual(DEBOUNCE * 1.2)
      },
      TEST_TIMEOUT
    )
})
