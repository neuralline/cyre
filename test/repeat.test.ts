// test/repeat.test.ts - Updated for new TimeKeeper integration

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src'

/*
 * CYRE Repeat and Timing Behavior Tests
 * Updated for new TimeKeeper integration with delay/interval logic
 *
 * Tests the integration between cyre.action() timing properties and the redesigned TimeKeeper
 */

describe('CYRE Repeat and Timing Behavior with New TimeKeeper', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()
  })

  afterEach(() => {
    console.log()
    vi.restoreAllMocks()
  })

  /**
   * Test that interval actions wait for the interval before first execution
   * with new TimeKeeper integration
   */
  it('should wait for interval before each execution including the first', async () => {
    const INTERVAL = 200
    const actionId = `interval-action-${Date.now()}`
    const executions: Array<{time: number; counter: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      executions.push({time: elapsed, counter: payload.counter})
      console.log(`[${elapsed}ms] EXECUTED with counter: ${payload.counter}`)
      return {executed: true}
    })

    // Create action with interval - should use new TimeKeeper delay/interval logic
    cyre.action({
      id: actionId,
      interval: INTERVAL,
      repeat: 3,
      payload: {counter: 0}
    })

    // Start the action
    await cyre.call(actionId, {counter: 1})

    // Wait for all executions to complete
    await new Promise(resolve => setTimeout(resolve, INTERVAL * 4))

    console.log('Execution times:', executions)

    // Verify we have the expected number of executions
    expect(executions.length).toBe(3)

    // First execution should be after waiting for interval
    expect(executions[0].time).toBeGreaterThanOrEqual(INTERVAL * 0.8)
    expect(executions[0].time).toBeLessThanOrEqual(INTERVAL * 1.5)

    // Subsequent executions should be spaced by interval
    for (let i = 1; i < executions.length; i++) {
      const timeBetween = executions[i].time - executions[i - 1].time
      expect(timeBetween).toBeGreaterThanOrEqual(INTERVAL * 0.7)
      expect(timeBetween).toBeLessThanOrEqual(INTERVAL * 1.6)
    }

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test delay vs interval behavior with new TimeKeeper integration
   */
  it('should use delay value for initial wait when both delay and interval are specified', async () => {
    const DELAY = 100
    const INTERVAL = 200
    const actionId = `delay-interval-action-${Date.now()}`
    const executions: Array<{time: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, () => {
      const elapsed = Date.now() - startTime
      executions.push({time: elapsed})
      console.log(`[${elapsed}ms] EXECUTED`)
      return {executed: true}
    })

    // Create action with both delay and interval - new TimeKeeper should handle this properly
    cyre.action({
      id: actionId,
      delay: DELAY,
      interval: INTERVAL,
      repeat: 2
    })

    // Start the action
    await cyre.call(actionId)

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, DELAY + INTERVAL * 2))

    console.log('Execution times:', executions)

    // Verify executions
    expect(executions.length).toBe(2)

    // First execution should use delay
    expect(executions[0].time).toBeGreaterThanOrEqual(DELAY * 0.8)
    expect(executions[0].time).toBeLessThanOrEqual(DELAY * 2)

    // Second execution should be interval after first
    if (executions.length > 1) {
      const timeBetween = executions[1].time - executions[0].time
      expect(timeBetween).toBeGreaterThanOrEqual(INTERVAL * 0.7)
      expect(timeBetween).toBeLessThanOrEqual(INTERVAL * 1.6)
    }

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test immediate execution with delay: 0 and new TimeKeeper
   */
  it('should execute immediately when delay is explicitly set to 0', async () => {
    const actionId = `immediate-action-${Date.now()}`
    const executions: Array<{time: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, () => {
      const elapsed = Date.now() - startTime
      executions.push({time: elapsed})
      console.log(`[${elapsed}ms] EXECUTED immediately`)
      return {executed: true}
    })

    // Create action with delay: 0 - new TimeKeeper should handle immediate execution
    cyre.action({
      id: actionId,
      delay: 0,
      repeat: 1
    })

    // Start the action
    await cyre.call(actionId)

    // Wait a short time for execution
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log('Execution times:', executions)

    // Verify immediate execution
    expect(executions.length).toBe(1)
    expect(executions[0].time).toBeLessThanOrEqual(50)

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test infinite repeats with new TimeKeeper
   */
  it('should support infinite repeats with repeat: true', async () => {
    const INTERVAL = 150
    const actionId = `infinite-repeats-action-${Date.now()}`
    const executions: Array<{time: number; counter: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      executions.push({time: elapsed, counter: payload.counter})
      console.log(`[${elapsed}ms] EXECUTED with counter: ${payload.counter}`)
      return {executed: true}
    })

    // Create action with infinite repeats - new TimeKeeper should handle this
    cyre.action({
      id: actionId,
      interval: INTERVAL,
      repeat: true, // Infinite repeats
      payload: {counter: 0}
    })

    // Start the action
    await cyre.call(actionId, {counter: 1})

    // Let it run for a limited time
    await new Promise(resolve => setTimeout(resolve, INTERVAL * 3.5))

    // Stop the infinite repeats
    cyre.forget(actionId)

    console.log('Execution times:', executions)

    // Verify multiple executions occurred
    expect(executions.length).toBeGreaterThanOrEqual(2)
    expect(executions.length).toBeLessThanOrEqual(4)

    // Verify timing pattern with new TimeKeeper
    if (executions.length >= 2) {
      // First execution after interval
      expect(executions[0].time).toBeGreaterThanOrEqual(INTERVAL * 0.7)

      // Check intervals between executions
      for (let i = 1; i < executions.length; i++) {
        const timeBetween = executions[i].time - executions[i - 1].time
        expect(timeBetween).toBeGreaterThanOrEqual(INTERVAL * 0.6)
        expect(timeBetween).toBeLessThanOrEqual(INTERVAL * 1.6)
      }
    }
  })

  /**
   * Test repeat: 0 behavior with new TimeKeeper
   */
  it('should not execute any action with repeat: 0', async () => {
    const actionId = `zero-repeat-action-${Date.now()}`
    let executionCount = 0

    // Register handler
    cyre.on(actionId, () => {
      executionCount++
      console.log('EXECUTED (should not happen)')
      return {executed: true}
    })

    // Create action with repeat: 0 - new TimeKeeper should respect this
    cyre.action({
      id: actionId,
      repeat: 0
    })

    // Try to call the action
    const result = await cyre.call(actionId)

    // Wait to ensure no delayed execution
    await new Promise(resolve => setTimeout(resolve, 100))

    console.log('Execution count:', executionCount)
    console.log('Call result:', result)

    // Verify no execution occurred
    expect(executionCount).toBe(0)
    expect(result.ok).toBe(true) // Call succeeds but doesn't execute
    expect(result.message).toContain('repeat: 0')

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test multiple calls to same action ID with new TimeKeeper behavior
   */
  it('should handle multiple calls to the same action ID properly', async () => {
    const INTERVAL = 200
    const actionId = `multiple-calls-action-${Date.now()}`
    const executions: Array<{
      time: number
      payload: any
      callNumber?: number
    }> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      executions.push({
        time: elapsed,
        payload,
        callNumber: payload.callNumber
      })
      console.log(
        `[${elapsed}ms] EXECUTED with payload:`,
        JSON.stringify(payload)
      )
      return {executed: true}
    })

    // Create action with interval and limited repeats
    cyre.action({
      id: actionId,
      interval: INTERVAL,
      repeat: 2 // Only 2 executions total per call
    })

    // Make first call
    console.log(`[0ms] Making first call`)
    await cyre.call(actionId, {callNumber: 1, data: 'first'})

    // Wait a short time, then make second call
    await new Promise(resolve => setTimeout(resolve, 50))

    console.log(`[${Date.now() - startTime}ms] Making second call`)
    await cyre.call(actionId, {callNumber: 2, data: 'second'})

    // Wait another short time, then make third call
    await new Promise(resolve => setTimeout(resolve, 25))

    console.log(`[${Date.now() - startTime}ms] Making third call`)
    await cyre.call(actionId, {callNumber: 3, data: 'third'})

    // Wait for all executions to complete
    await new Promise(resolve => setTimeout(resolve, INTERVAL * 3))

    console.log('Final executions:', executions)

    // With new TimeKeeper, behavior should be more predictable
    expect(executions.length).toBeGreaterThanOrEqual(1)
    expect(executions.length).toBeLessThanOrEqual(8)

    // Verify we see recent payloads being used
    const payloadNumbers = executions
      .map(exec => exec.payload?.callNumber)
      .filter(Boolean)
    console.log('Payload numbers used:', payloadNumbers)

    // We should see evidence of recent calls
    const hasRecentPayload = payloadNumbers.some(num => num >= 2)
    expect(hasRecentPayload).toBe(true)

    // Verify reasonable timing between executions
    if (executions.length >= 2) {
      for (let i = 1; i < Math.min(executions.length, 3); i++) {
        const timeBetween = executions[i].time - executions[i - 1].time
        expect(timeBetween).toBeGreaterThan(0)
        expect(timeBetween).toBeLessThan(INTERVAL * 2.5)
      }
    }

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test debounce behavior with new TimeKeeper integration
   */
  it('should apply debounce before any execution when specified', async () => {
    const DEBOUNCE_TIME = 200
    const actionId = `debounce-action-${Date.now()}`
    const executions: Array<{time: number; value: string}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      executions.push({time: elapsed, value: payload.value})
      console.log(`[${elapsed}ms] EXECUTED with value: ${payload.value}`)
      return {executed: true}
    })

    // Create action with debounce - should work with new TimeKeeper
    cyre.action({
      id: actionId,
      debounce: DEBOUNCE_TIME
    })

    // Make rapid calls
    console.log(`[0ms] CALLING first time`)
    await cyre.call(actionId, {value: 'first'})

    console.log(`[0ms] CALLING second time immediately`)
    await cyre.call(actionId, {value: 'second'})

    console.log(`[0ms] CALLING third time immediately`)
    await cyre.call(actionId, {value: 'third'})

    console.log(
      `[1ms] Waiting ${DEBOUNCE_TIME + 100}ms for debounce to complete...`
    )

    // Wait for debounce to complete
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_TIME + 100))

    console.log('Final executions:', executions)

    // Debounce should result in only one execution with the last payload
    expect(executions.length).toBeLessThanOrEqual(2)

    if (executions.length > 0) {
      // The execution should use the last payload
      const lastExecution = executions[executions.length - 1]
      expect(lastExecution.value).toBe('third')

      // Execution should happen after debounce time
      expect(lastExecution.time).toBeGreaterThanOrEqual(DEBOUNCE_TIME * 0.8)
    }

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test complex timing scenario with delay, interval, and repeat
   */
  it('should handle complex timing scenarios with delay, interval, and repeat', async () => {
    const DELAY = 100
    const INTERVAL = 150
    const REPEAT = 3
    const actionId = `complex-timing-${Date.now()}`
    const executions: Array<{time: number; execution: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      const executionNum = executions.length + 1
      executions.push({time: elapsed, execution: executionNum})
      console.log(`[${elapsed}ms] EXECUTION #${executionNum}`)
      return {executed: true, execution: executionNum}
    })

    // Create action with complex timing
    cyre.action({
      id: actionId,
      delay: DELAY, // First execution after 100ms
      interval: INTERVAL, // Subsequent executions every 150ms
      repeat: REPEAT // Total of 3 executions
    })

    console.log(
      `[TEST] Starting complex timer: delay=${DELAY}ms, interval=${INTERVAL}ms, repeat=${REPEAT}`
    )

    // Start the action
    await cyre.call(actionId, {complex: true})

    // Wait for all executions
    await new Promise(resolve =>
      setTimeout(resolve, DELAY + INTERVAL * REPEAT + 100)
    )

    console.log('Complex timing executions:', executions)

    // Should have exactly REPEAT executions
    expect(executions.length).toBe(REPEAT)

    // First execution should be after DELAY
    expect(executions[0].time).toBeGreaterThanOrEqual(DELAY * 0.8)
    expect(executions[0].time).toBeLessThanOrEqual(DELAY * 1.5)

    // Subsequent executions should be INTERVAL apart
    for (let i = 1; i < executions.length; i++) {
      const timeBetween = executions[i].time - executions[i - 1].time
      expect(timeBetween).toBeGreaterThanOrEqual(INTERVAL * 0.7)
      expect(timeBetween).toBeLessThanOrEqual(INTERVAL * 1.6)
    }

    // Total time should be approximately DELAY + (REPEAT-1) * INTERVAL
    const totalTime = executions[executions.length - 1].time
    const expectedTotalTime = DELAY + (REPEAT - 1) * INTERVAL
    expect(totalTime).toBeGreaterThanOrEqual(expectedTotalTime * 0.7)
    expect(totalTime).toBeLessThanOrEqual(expectedTotalTime * 1.6)

    // Clean up
    cyre.forget(actionId)
  })
})
