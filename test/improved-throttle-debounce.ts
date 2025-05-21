// src/tests/improved-throttle-debounce.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * Advanced test suite for throttle and debounce functionality
 *
 * This test suite uses fake timers for deterministic timing control
 * and provides precise assertions for both features.
 */
describe('Throttle and Debounce Advanced Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers() // Use fake timers for deterministic tests
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    cyre.initialize()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Basic throttle functionality test
   */
  it('should throttle executions to respect the specified interval', () => {
    // Setup
    const ACTION_ID = 'basic-throttle'
    const THROTTLE_INTERVAL = 100
    const executions: {timestamp: number; value: any}[] = []

    // Create throttled action with handler
    cyre.on(ACTION_ID, payload => {
      executions.push({
        timestamp: Date.now(),
        value: payload
      })
      return {executed: true}
    })

    cyre.action({
      id: ACTION_ID,
      throttle: THROTTLE_INTERVAL
    })

    // Test Case 1: First call should execute immediately
    cyre.call(ACTION_ID, {sequence: 1})
    expect(executions.length).toBe(1)
    expect(executions[0].value.sequence).toBe(1)

    // Test Case 2: Call within throttle interval should be rejected
    cyre.call(ACTION_ID, {sequence: 2})
    expect(executions.length).toBe(1) // Still only one execution

    // Test Case 3: Call after throttle interval should execute
    vi.advanceTimersByTime(THROTTLE_INTERVAL)
    cyre.call(ACTION_ID, {sequence: 3})
    expect(executions.length).toBe(2)
    expect(executions[1].value.sequence).toBe(3)

    // Test Case 4: Multiple calls after interval should execute just one
    vi.advanceTimersByTime(THROTTLE_INTERVAL)
    cyre.call(ACTION_ID, {sequence: 4})
    cyre.call(ACTION_ID, {sequence: 5})
    cyre.call(ACTION_ID, {sequence: 6})
    expect(executions.length).toBe(3) // Only one new execution
    expect(executions[2].value.sequence).toBe(4) // First of the batch
  })

  /**
   * Basic debounce functionality test
   */
  it('should debounce executions to wait until quiet period', async () => {
    // Setup
    const ACTION_ID = 'basic-debounce'
    const DEBOUNCE_DELAY = 100
    const executions: {timestamp: number; value: any}[] = []

    // Create debounced action with handler
    cyre.on(ACTION_ID, payload => {
      executions.push({
        timestamp: Date.now(),
        value: payload
      })
      return {executed: true}
    })

    cyre.action({
      id: ACTION_ID,
      debounce: DEBOUNCE_DELAY
    })

    // Test Case 1: Rapid calls should be debounced to just the last one
    cyre.call(ACTION_ID, {sequence: 1})
    expect(executions.length).toBe(0) // Nothing executed yet

    vi.advanceTimersByTime(50) // Advance 50ms (less than debounce time)
    cyre.call(ACTION_ID, {sequence: 2})
    expect(executions.length).toBe(0) // Still nothing executed

    vi.advanceTimersByTime(50) // Total 100ms
    cyre.call(ACTION_ID, {sequence: 3})
    expect(executions.length).toBe(0) // Still nothing executed

    vi.advanceTimersByTime(DEBOUNCE_DELAY) // Wait full debounce period

    // After full debounce period, only the last call should execute
    expect(executions.length).toBe(1)
    expect(executions[0].value.sequence).toBe(3) // Last call in sequence

    // Test Case 2: Calls separated by full debounce period should all execute
    vi.advanceTimersByTime(DEBOUNCE_DELAY * 2) // Advance well past debounce time

    // New call after a full pause
    cyre.call(ACTION_ID, {sequence: 4})
    vi.advanceTimersByTime(DEBOUNCE_DELAY * 2) // Wait full debounce period

    expect(executions.length).toBe(2)
    expect(executions[1].value.sequence).toBe(4)
  })

  /**
   * Test different throttle intervals
   */
  it('should respect different throttle intervals accurately', () => {
    // Setup actions with different throttle intervals
    const intervals = [50, 100, 200]
    const records: Record<number, {calls: number; executions: number[]}> = {}

    // Initialize records and create actions
    intervals.forEach(interval => {
      const actionId = `throttle-${interval}`
      records[interval] = {calls: 0, executions: []}

      cyre.on(actionId, () => {
        records[interval].executions.push(Date.now())
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        throttle: interval
      })
    })

    // Make initial calls to all actions
    intervals.forEach(interval => {
      const actionId = `throttle-${interval}`
      cyre.call(actionId)
      records[interval].calls++
    })

    // All should have executed once
    intervals.forEach(interval => {
      expect(records[interval].executions.length).toBe(1)
    })

    // Advance time by smallest interval
    vi.advanceTimersByTime(intervals[0])

    // Make second batch of calls
    intervals.forEach(interval => {
      const actionId = `throttle-${interval}`
      cyre.call(actionId)
      records[interval].calls++
    })

    // Only the smallest interval action should have executed again
    expect(records[intervals[0]].executions.length).toBe(2)
    expect(records[intervals[1]].executions.length).toBe(1)
    expect(records[intervals[2]].executions.length).toBe(1)

    // Advance to medium interval
    vi.advanceTimersByTime(intervals[1] - intervals[0])

    // Make third batch of calls
    intervals.forEach(interval => {
      const actionId = `throttle-${interval}`
      cyre.call(actionId)
      records[interval].calls++
    })

    // First and second interval actions should have executed again
    expect(records[intervals[0]].executions.length).toBe(3)
    expect(records[intervals[1]].executions.length).toBe(2)
    expect(records[intervals[2]].executions.length).toBe(1)

    // Advance to largest interval
    vi.advanceTimersByTime(intervals[2] - intervals[1])

    // Final assertion - all should execute on their own schedule
    intervals.forEach(interval => {
      const actionId = `throttle-${interval}`
      cyre.call(actionId)
      records[interval].calls++
    })

    // All actions should have executed again
    expect(records[intervals[0]].executions.length).toBe(4)
    expect(records[intervals[1]].executions.length).toBe(3)
    expect(records[intervals[2]].executions.length).toBe(2)

    // Verify execution count is less than call count for all actions
    intervals.forEach(interval => {
      expect(records[interval].executions.length).toBeLessThan(
        records[interval].calls
      )
    })
  })

  /**
   * Test different debounce intervals
   */
  it('should respect different debounce intervals accurately', () => {
    // Setup actions with different debounce intervals
    const intervals = [50, 100, 200]
    const records: Record<
      number,
      {calls: number; executions: number[]; lastPayload?: any}
    > = {}

    // Initialize records and create actions
    intervals.forEach(interval => {
      const actionId = `debounce-${interval}`
      records[interval] = {calls: 0, executions: []}

      cyre.on(actionId, payload => {
        records[interval].executions.push(Date.now())
        records[interval].lastPayload = payload
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        debounce: interval
      })
    })

    // Make rapid calls to all actions
    for (let i = 0; i < 5; i++) {
      intervals.forEach(interval => {
        const actionId = `debounce-${interval}`
        cyre.call(actionId, {iteration: i})
        records[interval].calls++
      })

      // Small advance to ensure calls are distinct
      vi.advanceTimersByTime(10)
    }

    // Nothing should have executed yet
    intervals.forEach(interval => {
      expect(records[interval].executions.length).toBe(0)
    })

    // Advance to first debounce interval
    vi.advanceTimersByTime(intervals[0] - 10 * 5)

    // Only first interval action should have executed
    expect(records[intervals[0]].executions.length).toBe(1)
    expect(records[intervals[1]].executions.length).toBe(0)
    expect(records[intervals[2]].executions.length).toBe(0)

    // Verify last payload was used for execution
    expect(records[intervals[0]].lastPayload.iteration).toBe(4)

    // Advance to second debounce interval
    vi.advanceTimersByTime(intervals[1] - intervals[0])

    // First and second interval actions should have executed
    expect(records[intervals[0]].executions.length).toBe(1)
    expect(records[intervals[1]].executions.length).toBe(1)
    expect(records[intervals[2]].executions.length).toBe(0)
    expect(records[intervals[1]].lastPayload.iteration).toBe(4)

    // Advance to third debounce interval
    vi.advanceTimersByTime(intervals[2] - intervals[1])

    // All actions should have executed
    intervals.forEach(interval => {
      expect(records[interval].executions.length).toBe(1)
      expect(records[interval].lastPayload.iteration).toBe(4)
    })

    // Verify execution count is less than call count for all actions
    intervals.forEach(interval => {
      expect(records[interval].executions.length).toBeLessThan(
        records[interval].calls
      )
    })
  })

  /**
   * Test interaction between debounce and change detection
   */
  it('should correctly combine debounce with change detection', () => {
    // Setup
    const ACTION_ID = 'debounce-change'
    const DEBOUNCE_DELAY = 100
    const executions: {value: any}[] = []

    // Create action with both debounce and change detection
    cyre.on(ACTION_ID, payload => {
      executions.push({value: {...payload}})
      return {executed: true}
    })

    cyre.action({
      id: ACTION_ID,
      debounce: DEBOUNCE_DELAY,
      detectChanges: true
    })

    // Test Case 1: Multiple identical calls (should debounce to 0)
    const staticPayload = {value: 'static', case: 1}

    for (let i = 0; i < 5; i++) {
      cyre.call(ACTION_ID, staticPayload)
      vi.advanceTimersByTime(20) // Small advance
    }

    vi.advanceTimersByTime(DEBOUNCE_DELAY) // Wait for debounce

    const case1Count = executions.filter(e => e.value.case === 1).length
    expect(case1Count).toBe(1) // Should execute once

    // Test Case 2: Multiple different calls (should debounce to last value)
    for (let i = 0; i < 5; i++) {
      cyre.call(ACTION_ID, {value: `dynamic-${i}`, case: 2, iteration: i})
      vi.advanceTimersByTime(20) // Small advance
    }

    vi.advanceTimersByTime(DEBOUNCE_DELAY) // Wait for debounce

    const case2Results = executions.filter(e => e.value.case === 2)
    expect(case2Results.length).toBe(1) // Should execute once
    expect(case2Results[0].value.iteration).toBe(4) // Should be last value

    // Test Case 3: Calls separated by more than debounce time
    for (let i = 0; i < 3; i++) {
      cyre.call(ACTION_ID, {value: `separate-${i}`, case: 3})
      vi.advanceTimersByTime(DEBOUNCE_DELAY + 20) // Longer than debounce
    }

    const case3Results = executions.filter(e => e.value.case === 3)
    expect(case3Results.length).toBe(3) // Each call should execute
  })

  /**
   * Test concurrent throttled and debounced actions
   */
  it('should handle many concurrent throttled and debounced actions', () => {
    // Create multiple actions with different configurations
    const actionCount = 10
    const actions: Array<{
      id: string
      protection: 'throttle' | 'debounce'
      interval: number
      executions: number
    }> = []

    // Setup actions with staggered intervals
    for (let i = 0; i < actionCount; i++) {
      const isThrottle = i % 2 === 0
      const protection = isThrottle ? 'throttle' : 'debounce'
      const interval = 50 + i * 20 // Different intervals from 50ms to 230ms
      const actionId = `concurrent-${protection}-${i}`

      actions.push({
        id: actionId,
        protection,
        interval,
        executions: 0
      })

      // Register handler
      cyre.on(actionId, () => {
        // Find action and increment counter
        const action = actions.find(a => a.id === actionId)
        if (action) {
          action.executions++
        }
        return {executed: true}
      })

      // Create action with appropriate protection
      cyre.action({
        id: actionId,
        [protection]: interval
      })
    }

    // Make multiple calls to all actions
    const callsPerAction = 10

    for (let call = 0; call < callsPerAction; call++) {
      // Call all actions in parallel
      actions.forEach(action => {
        cyre.call(action.id, {call, timestamp: Date.now()})
      })

      // Advance time between calls
      vi.advanceTimersByTime(20)
    }

    // Advance time to ensure all debounced actions complete
    const maxInterval = Math.max(...actions.map(a => a.interval))
    vi.advanceTimersByTime(maxInterval * 2)

    // Verify throttled actions executed fewer times than called
    const throttledActions = actions.filter(a => a.protection === 'throttle')
    throttledActions.forEach(action => {
      expect(action.executions).toBeLessThan(callsPerAction)
    })

    // Verify debounced actions executed exactly once
    const debouncedActions = actions.filter(a => a.protection === 'debounce')
    debouncedActions.forEach(action => {
      expect(action.executions).toBe(1)
    })

    // Verify correlation between interval and execution count for throttle
    if (throttledActions.length >= 2) {
      const sortedByInterval = [...throttledActions].sort(
        (a, b) => a.interval - b.interval
      )
      const lowestInterval = sortedByInterval[0]
      const highestInterval = sortedByInterval[sortedByInterval.length - 1]

      // Actions with lower throttle intervals should execute more frequently
      expect(lowestInterval.executions).toBeGreaterThan(
        highestInterval.executions
      )
    }
  })
})
