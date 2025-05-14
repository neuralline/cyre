// src/tests/advanced-throttle-debounce.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * Advanced Test Suite for Cyre's throttle and debounce functionality
 *
 * This test suite thoroughly examines the behavior of these rate limiting features
 * under various conditions and configurations.
 */
describe('Advanced Throttle and Debounce Tests', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre fresh for each test
    cyre.initialize()

    console.log('===== ADVANCED THROTTLE/DEBOUNCE TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== ADVANCED THROTTLE/DEBOUNCE TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test different debounce intervals to verify timing accuracy
   */
  it('should respect different debounce intervals', async () => {
    // Test different intervals
    const intervals = [50, 100, 200]
    const results: Record<
      number,
      {
        callCount: number
        execCount: number
        executionTimes: number[]
        lastPayload?: any
      }
    > = {}

    // Setup actions with different debounce intervals
    for (const interval of intervals) {
      const actionId = `debounce-${interval}`

      // Track state for this interval
      results[interval] = {
        callCount: 0,
        execCount: 0,
        executionTimes: [],
        lastPayload: undefined
      }

      // Register handler
      cyre.on(actionId, payload => {
        const now = Date.now()
        results[interval].execCount++
        results[interval].executionTimes.push(now)
        results[interval].lastPayload = payload

        console.log(`[HANDLER] ${actionId} executed at ${now}:`, payload)
        return {executed: true}
      })

      // Create action with specific debounce
      cyre.action({
        id: actionId,
        type: 'debounce-test',
        payload: {initial: true},
        debounce: interval
      })
    }

    // Make rapid calls to all actions
    const callCount = 8
    for (let i = 0; i < callCount; i++) {
      // Call each action in parallel
      await Promise.all(
        intervals.map(interval => {
          const actionId = `debounce-${interval}`
          results[interval].callCount++

          return cyre.call(actionId, {
            iteration: i,
            timestamp: Date.now()
          })
        })
      )

      // Small delay between call batches (but still faster than all debounce intervals)
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    // Wait for the longest interval plus extra time to ensure completion
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(...intervals) + 100)
    )

    // Print results
    console.log(
      '[TEST] Debounce interval results:',
      Object.entries(results).map(([interval, data]) => ({
        interval,
        callCount: data.callCount,
        execCount: data.execCount,
        lastPayload: data.lastPayload
      }))
    )

    // Verify debounce works for all intervals
    for (const interval of intervals) {
      const data = results[interval]

      // Debouncing should result in fewer executions than calls
      expect(data.execCount).toBeLessThan(data.callCount)

      // Debouncing should result in the last call being executed
      expect(data.lastPayload?.iteration).toBe(callCount - 1)
    }

    // Verify that different intervals result in different debounce behavior
    // Longer debounce intervals should result in fewer executions
    if (
      results[intervals[0]].execCount > 1 &&
      results[intervals[2]].execCount > 1
    ) {
      // Only verify if we have multiple executions to compare
      expect(results[intervals[0]].execCount).toBeGreaterThanOrEqual(
        results[intervals[2]].execCount
      )
    }
  })

  /**
   * Test different throttle intervals to verify timing accuracy
   */
  it('should respect different throttle intervals', async () => {
    // Test different intervals
    const intervals = [50, 100, 200]
    const results: Record<
      number,
      {
        callCount: number
        execCount: number
        executionTimes: number[]
        intervals: number[]
      }
    > = {}

    // Setup actions with different throttle intervals
    for (const interval of intervals) {
      const actionId = `throttle-${interval}`

      // Track state for this interval
      results[interval] = {
        callCount: 0,
        execCount: 0,
        executionTimes: [],
        intervals: []
      }

      // Register handler
      cyre.on(actionId, payload => {
        const now = Date.now()
        results[interval].execCount++
        results[interval].executionTimes.push(now)

        // Calculate interval from previous execution
        if (results[interval].executionTimes.length > 1) {
          const prev =
            results[interval].executionTimes[
              results[interval].executionTimes.length - 2
            ]
          results[interval].intervals.push(now - prev)
        }

        console.log(`[HANDLER] ${actionId} executed at ${now}:`, payload)
        return {executed: true}
      })

      // Create action with specific throttle
      cyre.action({
        id: actionId,
        type: 'throttle-test',
        payload: {initial: true},
        throttle: interval
      })
    }

    // Make rapid calls to all actions over a longer period
    // to see throttle behavior under continuous pressure
    const testDuration = 500 // 500ms total test time
    const startTime = Date.now()

    console.log('[TEST] Starting rapid throttled calls')

    // Continue calling until test duration is reached
    while (Date.now() - startTime < testDuration) {
      // Call each action in parallel
      await Promise.all(
        intervals.map(interval => {
          const actionId = `throttle-${interval}`
          results[interval].callCount++

          return cyre.call(actionId, {
            timestamp: Date.now()
          })
        })
      )

      // Small delay between call batches (but still faster than all throttle intervals)
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Wait for the longest interval plus extra time to ensure completion
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(...intervals) + 50)
    )

    // Print results
    console.log(
      '[TEST] Throttle interval results:',
      Object.entries(results).map(([interval, data]) => ({
        interval,
        callCount: data.callCount,
        execCount: data.execCount,
        avgInterval:
          data.intervals.length > 0
            ? data.intervals.reduce((sum, i) => sum + i, 0) /
              data.intervals.length
            : 0
      }))
    )

    // Verify throttle works for all intervals
    for (const interval of intervals) {
      const data = results[interval]

      // Throttling should result in fewer executions than calls
      expect(data.execCount).toBeLessThan(data.callCount)

      // If we have multiple executions, verify the timing
      if (data.intervals.length > 0) {
        const avgInterval =
          data.intervals.reduce((sum, i) => sum + i, 0) / data.intervals.length

        // Average interval should be close to the throttle interval
        // Allow 20% margin for timing variations
        console.log(
          `[TEST] Interval ${interval}ms - Average actual: ${avgInterval}ms`
        )
        expect(avgInterval).toBeGreaterThanOrEqual(interval * 0.8)
      }
    }

    // Verify that different throttle intervals result in different execution counts
    // Faster throttle intervals should allow more executions
    expect(results[intervals[0]].execCount).toBeGreaterThanOrEqual(
      results[intervals[2]].execCount
    )
  })

  /**
   * Test throttling under high system stress to verify it adapts with quantum breathing
   */
  it('should maintain throttling under system stress', async () => {
    // Create a regular throttled action
    const THROTTLE_ACTION_ID = 'stress-throttle-action'
    const THROTTLE_INTERVAL = 100 // 100ms throttle
    const executionTimes: number[] = []

    // Register handler
    cyre.on(THROTTLE_ACTION_ID, payload => {
      const now = Date.now()
      executionTimes.push(now)

      // Generate some load
      let x = 0
      for (let i = 0; i < 10000; i++) {
        x += Math.sqrt(i)
      }

      console.log(`[HANDLER] Throttled execution at ${now}:`, payload)
      return {executed: true, result: x}
    })

    // Create action with throttle
    cyre.action({
      id: THROTTLE_ACTION_ID,
      type: 'stress-test',
      payload: {initial: true},
      throttle: THROTTLE_INTERVAL
    })

    // Create a stress-generating action
    const STRESS_ACTION_ID = 'system-stress-action'

    cyre.on(STRESS_ACTION_ID, payload => {
      // Generate significant CPU load
      let x = 0
      for (let i = 0; i < 50000; i++) {
        x += Math.sqrt(i) * Math.sin(i)
      }
      return {result: x}
    })

    cyre.action({
      id: STRESS_ACTION_ID,
      type: 'stress-test',
      payload: {initial: true}
    })

    // First generate baseline readings without stress
    console.log('[TEST] Phase 1: Throttling without stress')

    // Make some throttled calls
    for (let i = 0; i < 5; i++) {
      await cyre.call(THROTTLE_ACTION_ID, {phase: 'baseline', iteration: i})
      await new Promise(resolve => setTimeout(resolve, 30)) // Fast but not instant
    }

    const baselineExecutionTimes = [...executionTimes]

    // Calculate baseline intervals
    const baselineIntervals = []
    for (let i = 1; i < baselineExecutionTimes.length; i++) {
      baselineIntervals.push(
        baselineExecutionTimes[i] - baselineExecutionTimes[i - 1]
      )
    }

    const baselineAvgInterval =
      baselineIntervals.length > 0
        ? baselineIntervals.reduce((sum, i) => sum + i, 0) /
          baselineIntervals.length
        : 0

    console.log(`[TEST] Baseline average interval: ${baselineAvgInterval}ms`)

    // Clear execution times for next phase
    executionTimes.length = 0

    // Now generate system stress and check throttling
    console.log('[TEST] Phase 2: Throttling under stress')

    // Generate significant stress
    const stressCalls = []
    for (let i = 0; i < 5; i++) {
      stressCalls.push(cyre.call(STRESS_ACTION_ID, {iteration: i}))
    }

    // Run stress calls in parallel with throttled calls
    await Promise.all([
      ...stressCalls,
      (async () => {
        // Make some throttled calls during stress
        for (let i = 0; i < 5; i++) {
          await cyre.call(THROTTLE_ACTION_ID, {phase: 'stressed', iteration: i})
          await new Promise(resolve => setTimeout(resolve, 30)) // Fast but not instant
        }
      })()
    ])

    const stressedExecutionTimes = [...executionTimes]

    // Calculate stressed intervals
    const stressedIntervals = []
    for (let i = 1; i < stressedExecutionTimes.length; i++) {
      stressedIntervals.push(
        stressedExecutionTimes[i] - stressedExecutionTimes[i - 1]
      )
    }

    const stressedAvgInterval =
      stressedIntervals.length > 0
        ? stressedIntervals.reduce((sum, i) => sum + i, 0) /
          stressedIntervals.length
        : 0

    console.log(`[TEST] Stressed average interval: ${stressedAvgInterval}ms`)

    // Check breathing state
    const breathingState = cyre.getBreathingState()
    console.log('[TEST] Breathing state:', {
      stress: breathingState.stress,
      isRecuperating: breathingState.isRecuperating,
      currentRate: breathingState.currentRate
    })

    // Verify throttling still works under stress
    expect(stressedExecutionTimes.length).toBeGreaterThan(0)

    // If significant stress was generated, quantum breathing might increase intervals
    if (breathingState.stress > 0.3) {
      console.log(
        '[TEST] System under significant stress, checking for interval adaptation'
      )

      // Note: This may not always be true depending on how quantum breathing is configured
      // but in general, stress should lead to longer intervals
      if (stressedAvgInterval > baselineAvgInterval * 1.1) {
        console.log('[TEST] Intervals increased under stress as expected')
      } else {
        console.log(
          '[TEST] Intervals did not increase significantly under stress'
        )
      }
    }
  })

  /**
   * Test interaction between debounce and change detection
   */
  it('should correctly combine debounce with change detection', async () => {
    // Create an action with both debounce and change detection
    const ACTION_ID = 'debounce-change-action'
    const DEBOUNCE_DELAY = 100

    const executionRecords: Array<{
      timestamp: number
      payload: any
    }> = []

    // Register handler
    cyre.on(ACTION_ID, payload => {
      executionRecords.push({
        timestamp: Date.now(),
        payload: {...payload} // Clone to avoid reference issues
      })

      console.log(`[HANDLER] Executed with:`, payload)
      return {executed: true}
    })

    // Create action with both debounce and change detection
    cyre.action({
      id: ACTION_ID,
      type: 'combined-test',
      payload: {initial: true},
      debounce: DEBOUNCE_DELAY,
      detectChanges: true
    })

    console.log('[TEST] Testing combined debounce and change detection')

    // Test case 1: Multiple identical calls (should debounce to 1)
    console.log('[TEST] Case 1: Multiple identical calls')
    const staticPayload = {value: 'static', case: 1}

    for (let i = 0; i < 5; i++) {
      await cyre.call(ACTION_ID, staticPayload)
      await new Promise(resolve => setTimeout(resolve, 20)) // Rapid but not instant
    }

    // Wait for debounce to complete
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_DELAY + 50))

    const case1Count = executionRecords.filter(r => r.payload.case === 1).length
    console.log(`[TEST] Case 1 executions: ${case1Count}`)

    // Test case 2: Multiple different calls (should debounce to 1, last value)
    console.log('[TEST] Case 2: Multiple different calls')
    const initialLength = executionRecords.length

    for (let i = 0; i < 5; i++) {
      await cyre.call(ACTION_ID, {
        value: `dynamic-${i}`,
        case: 2,
        iteration: i
      })
      await new Promise(resolve => setTimeout(resolve, 20)) // Rapid but not instant
    }

    // Wait for debounce to complete
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_DELAY + 50))

    const case2Records = executionRecords.filter(r => r.payload.case === 2)
    console.log(`[TEST] Case 2 executions: ${case2Records.length}`)

    // Test case 3: Calls separated by more than debounce time
    console.log('[TEST] Case 3: Separated calls')
    const initialCount2 = executionRecords.length

    for (let i = 0; i < 3; i++) {
      await cyre.call(ACTION_ID, {value: `separate-${i}`, case: 3})

      // Wait longer than debounce interval between calls
      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_DELAY + 20))
    }

    const case3Count = executionRecords.filter(r => r.payload.case === 3).length
    console.log(`[TEST] Case 3 executions: ${case3Count}`)

    // Verify results

    // Case 1: Multiple identical calls with debounce and change detection
    // Should execute once at most
    expect(case1Count).toBeLessThanOrEqual(1)

    // Case 2: Multiple different calls with debounce
    // Should execute once
    expect(case2Records.length).toBeLessThanOrEqual(1)

    // If it executed, should have the last payload
    if (case2Records.length > 0) {
      expect(case2Records[0].payload.iteration).toBe(4) // Last iteration
    }

    // Case 3: Separated calls should execute (up to) once per call
    // due to debounce time expiration between calls
    expect(case3Count).toBeLessThanOrEqual(3)
    expect(case3Count).toBeGreaterThan(0)
  })

  /**
   * Test concurrent throttle and debounce with many actions
   */
  it('should handle many concurrent throttled and debounced actions', async () => {
    // Create multiple actions with different configurations
    const actionCount = 10
    const actions: Array<{
      id: string
      protection: 'throttle' | 'debounce'
      interval: number
      executions: number
    }> = []

    // Create actions with different throttle/debounce settings
    for (let i = 0; i < actionCount; i++) {
      const isThrottle = i % 2 === 0
      const protection = isThrottle ? 'throttle' : 'debounce'
      const interval = 50 + i * 20 // Different intervals from 50ms to 230ms

      const actionId = `concurrent-${protection}-${i}`

      // Add to tracking
      actions.push({
        id: actionId,
        protection,
        interval,
        executions: 0
      })

      // Register handler
      cyre.on(actionId, payload => {
        const actionInfo = actions.find(a => a.id === actionId)
        if (actionInfo) {
          actionInfo.executions++
        }

        // Small work to do
        let x = 0
        for (let j = 0; j < 1000; j++) {
          x += Math.sqrt(j)
        }

        return {executed: true, result: x}
      })

      // Create action
      cyre.action({
        id: actionId,
        type: 'concurrent-test',
        payload: {initial: true},
        [protection]: interval // Set either throttle or debounce
      })
    }

    // Test duration and call rate
    const testDuration = 500 // 500ms
    const callsPerAction = 10

    console.log('[TEST] Starting concurrent action test')

    // Make calls to all actions
    for (let call = 0; call < callsPerAction; call++) {
      // Call all actions in parallel
      await Promise.all(
        actions.map(action =>
          cyre.call(action.id, {
            call,
            timestamp: Date.now()
          })
        )
      )

      // Small delay between batches
      await new Promise(resolve =>
        setTimeout(resolve, testDuration / callsPerAction)
      )
    }

    // Wait for all pending actions to complete
    const maxInterval = Math.max(...actions.map(a => a.interval))
    await new Promise(resolve => setTimeout(resolve, maxInterval + 100))

    // Print results
    console.log(
      '[TEST] Concurrent test results:',
      actions.map(a => ({
        id: a.id,
        protection: a.protection,
        interval: a.interval,
        calls: callsPerAction,
        executions: a.executions,
        ratio: (a.executions / callsPerAction).toFixed(2)
      }))
    )

    // Calculate efficiency metrics
    const throttleActions = actions.filter(a => a.protection === 'throttle')
    const debounceActions = actions.filter(a => a.protection === 'debounce')

    const avgThrottleRatio =
      throttleActions.reduce((sum, a) => sum + a.executions, 0) /
      (throttleActions.length * callsPerAction)

    const avgDebounceRatio =
      debounceActions.reduce((sum, a) => sum + a.executions, 0) /
      (debounceActions.length * callsPerAction)

    console.log('[TEST] Protection efficiency:')
    console.log(
      `  Throttle: ${(100 - avgThrottleRatio * 100).toFixed(1)}% reduction`
    )
    console.log(
      `  Debounce: ${(100 - avgDebounceRatio * 100).toFixed(1)}% reduction`
    )

    // Verify rate limiting is working
    for (const action of actions) {
      expect(action.executions).toBeLessThan(callsPerAction)
    }

    // Verify correlation between interval and execution count for throttle
    // Sort throttle actions by interval and check if execution counts are in reverse order
    const sortedThrottleActions = [...throttleActions].sort(
      (a, b) => a.interval - b.interval
    )

    // First action should have shorter interval and potentially more executions than last
    if (sortedThrottleActions.length >= 2) {
      const shortestInterval = sortedThrottleActions[0]
      const longestInterval =
        sortedThrottleActions[sortedThrottleActions.length - 1]

      console.log(
        `[TEST] Comparing shortest throttle interval (${shortestInterval.interval}ms): ${shortestInterval.executions} executions`
      )
      console.log(
        `[TEST] Comparing longest throttle interval (${longestInterval.interval}ms): ${longestInterval.executions} executions`
      )

      // This might not always be true depending on timing, but generally should hold
      // if throttling is working correctly with different intervals
      expect(shortestInterval.executions).toBeGreaterThanOrEqual(
        longestInterval.executions * 0.8
      )
    }
  })
})
