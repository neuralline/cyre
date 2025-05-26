// test/timekeeper.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/*
 * Enhanced TimeKeeper Tests for CYRE
 *
 * Tests the enhanced timekeeper system with proper delay/interval handling:
 * 1. Timekeeper replacement on multiple calls
 * 2. Delay → interval transition
 * 3. delay = 0 immediate execution
 * 4. Proper metrics integration
 * 5. Backward compatibility
 */

describe('Enhanced TimeKeeper with Delay/Interval Support', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== ENHANCED TIMEKEEPER TEST STARTED =====')
  })

  afterEach(() => {
    // Clean up
    cyre.clear()
    console.log('===== ENHANCED TIMEKEEPER TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test delay → interval transition behavior
   */
  it('should use delay for first execution, then interval for subsequent executions', async () => {
    const DELAY = 100
    const INTERVAL = 200
    const actionId = `delay-interval-test-${Date.now()}`
    const executions: Array<{time: number; executionNumber: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      const executionNumber = executions.length + 1
      executions.push({time: elapsed, executionNumber})

      console.log(
        `[${elapsed}ms] EXECUTION ${executionNumber}: ${JSON.stringify(
          payload
        )}`
      )
      return {executed: true, executionNumber}
    })

    // Create action with both delay and interval
    cyre.action({
      id: actionId,
      delay: DELAY, // First execution after 100ms
      interval: INTERVAL, // Subsequent executions every 200ms
      repeat: 3 // Total of 3 executions
    })

    console.log(
      `[TEST] Calling action: delay=${DELAY}ms, interval=${INTERVAL}ms, repeat=3`
    )

    // Start the action
    await cyre.call(actionId, {testData: 'delay-interval'})

    // Wait for all executions to complete
    const totalWaitTime = DELAY + INTERVAL * 2 + 100 // Buffer
    console.log(`[TEST] Waiting ${totalWaitTime}ms for all executions`)
    await new Promise(resolve => setTimeout(resolve, totalWaitTime))

    console.log('[TEST] Final executions:', executions)

    // Verify we have the expected number of executions
    expect(executions.length).toBe(3)

    // Verify timing pattern: delay for first, interval for subsequent
    // First execution should be after delay (with tolerance)
    expect(executions[0].time).toBeGreaterThanOrEqual(DELAY * 0.8)
    expect(executions[0].time).toBeLessThanOrEqual(DELAY * 1.5)

    // Subsequent executions should be spaced by interval
    if (executions.length >= 2) {
      const timeBetween1and2 = executions[1].time - executions[0].time
      expect(timeBetween1and2).toBeGreaterThanOrEqual(INTERVAL * 0.8)
      expect(timeBetween1and2).toBeLessThanOrEqual(INTERVAL * 1.5)
    }

    if (executions.length >= 3) {
      const timeBetween2and3 = executions[2].time - executions[1].time
      expect(timeBetween2and3).toBeGreaterThanOrEqual(INTERVAL * 0.8)
      expect(timeBetween2and3).toBeLessThanOrEqual(INTERVAL * 1.5)
    }
  })

  /**
   * Test delay = 0 immediate execution behavior
   */
  it('should execute immediately when delay = 0, then use interval for repeats', async () => {
    const INTERVAL = 150
    const actionId = `immediate-then-interval-test-${Date.now()}`
    const executions: Array<{time: number; executionNumber: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      const executionNumber = executions.length + 1
      executions.push({time: elapsed, executionNumber})

      console.log(
        `[${elapsed}ms] IMMEDIATE EXECUTION ${executionNumber}: ${JSON.stringify(
          payload
        )}`
      )
      return {executed: true, executionNumber}
    })

    // Create action with delay = 0 and interval
    cyre.action({
      id: actionId,
      delay: 0, // Execute immediately
      interval: INTERVAL, // Then every 150ms
      repeat: 3 // Total of 3 executions
    })

    console.log(
      `[TEST] Calling action: delay=0 (immediate), interval=${INTERVAL}ms, repeat=3`
    )

    // Start the action
    await cyre.call(actionId, {testData: 'immediate-then-interval'})

    // Wait for all executions
    const totalWaitTime = INTERVAL * 2 + 100 // No initial delay + buffer
    console.log(`[TEST] Waiting ${totalWaitTime}ms for all executions`)
    await new Promise(resolve => setTimeout(resolve, totalWaitTime))

    console.log('[TEST] Final executions:', executions)

    // Verify we have the expected number of executions
    expect(executions.length).toBe(3)

    // First execution should be immediate (very fast)
    expect(executions[0].time).toBeLessThanOrEqual(50) // Very quick

    // Subsequent executions should be spaced by interval
    if (executions.length >= 2) {
      const timeBetween1and2 = executions[1].time - executions[0].time
      expect(timeBetween1and2).toBeGreaterThanOrEqual(INTERVAL * 0.8)
      expect(timeBetween1and2).toBeLessThanOrEqual(INTERVAL * 1.5)
    }
  })

  /**
   * Test timekeeper replacement on multiple calls
   */
  it('should replace existing timekeeper when the same action is called multiple times', async () => {
    const INTERVAL = 200
    const actionId = `replacement-test-${Date.now()}`
    const executions: Array<{
      time: number
      payload: any
      executionNumber: number
    }> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      const executionNumber = executions.length + 1
      executions.push({time: elapsed, payload, executionNumber})

      console.log(
        `[${elapsed}ms] EXECUTION ${executionNumber}: ${JSON.stringify(
          payload
        )}`
      )
      return {executed: true, executionNumber}
    })

    // Create action
    cyre.action({
      id: actionId,
      interval: INTERVAL,
      repeat: 3
    })

    console.log(
      `[TEST] First call - should start 3 executions every ${INTERVAL}ms`
    )

    // First call
    await cyre.call(actionId, {call: 'first', timestamp: Date.now()})

    // Wait a short time, then make second call (should replace first)
    await new Promise(resolve => setTimeout(resolve, 50))

    console.log(`[TEST] Second call - should REPLACE first timekeeper`)
    await cyre.call(actionId, {call: 'second', timestamp: Date.now()})

    // Wait another short time, then make third call (should replace second)
    await new Promise(resolve => setTimeout(resolve, 30))

    console.log(`[TEST] Third call - should REPLACE second timekeeper`)
    await cyre.call(actionId, {call: 'third', timestamp: Date.now()})

    // Wait for the final timekeeper to complete
    const totalWaitTime = INTERVAL * 3 + 200 // Buffer for 3 executions
    console.log(
      `[TEST] Waiting ${totalWaitTime}ms for final timekeeper to complete`
    )
    await new Promise(resolve => setTimeout(resolve, totalWaitTime))

    console.log('[TEST] Final executions:', executions)

    // Since each call replaces the previous timekeeper, we should only see
    // executions from the LAST call (third call)
    expect(executions.length).toBe(3) // Only 3 executions total

    // All executions should be from the third (final) call
    const thirdCallExecutions = executions.filter(
      e => e.payload?.call === 'third'
    )
    expect(thirdCallExecutions.length).toBe(3) // All 3 should be from third call

    // Should NOT have executions from first or second calls
    const firstCallExecutions = executions.filter(
      e => e.payload?.call === 'first'
    )
    const secondCallExecutions = executions.filter(
      e => e.payload?.call === 'second'
    )
    expect(firstCallExecutions.length).toBe(0) // Replaced
    expect(secondCallExecutions.length).toBe(0) // Replaced

    console.log('[TEST] Replacement verification:', {
      totalExecutions: executions.length,
      thirdCallExecutions: thirdCallExecutions.length,
      firstCallExecutions: firstCallExecutions.length,
      secondCallExecutions: secondCallExecutions.length
    })
  })

  /**
   * Test interval-only behavior (no delay)
   */
  it('should use interval for all executions when no delay is specified', async () => {
    const INTERVAL = 120
    const actionId = `interval-only-test-${Date.now()}`
    const executions: Array<{time: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      executions.push({time: elapsed})

      console.log(
        `[${elapsed}ms] INTERVAL EXECUTION: ${JSON.stringify(payload)}`
      )
      return {executed: true}
    })

    // Create action with only interval (no delay)
    cyre.action({
      id: actionId,
      interval: INTERVAL, // Wait interval before each execution (including first)
      repeat: 2
    })

    console.log(`[TEST] Calling action: interval=${INTERVAL}ms only, repeat=2`)

    // Start the action
    await cyre.call(actionId, {testData: 'interval-only'})

    // Wait for all executions
    const totalWaitTime = INTERVAL * 2 + 100 // Buffer
    console.log(`[TEST] Waiting ${totalWaitTime}ms for all executions`)
    await new Promise(resolve => setTimeout(resolve, totalWaitTime))

    console.log('[TEST] Final executions:', executions)

    // Verify we have the expected number of executions
    expect(executions.length).toBe(2)

    // First execution should wait for interval (v4.0.0 behavior)
    expect(executions[0].time).toBeGreaterThanOrEqual(INTERVAL * 0.8)
    expect(executions[0].time).toBeLessThanOrEqual(INTERVAL * 1.5)

    // Second execution should be interval after first
    if (executions.length >= 2) {
      const timeBetween = executions[1].time - executions[0].time
      expect(timeBetween).toBeGreaterThanOrEqual(INTERVAL * 0.8)
      expect(timeBetween).toBeLessThanOrEqual(INTERVAL * 1.5)
    }
  })

  /**
   * Test infinite repeats with replacement
   */
  it('should handle infinite repeats and replacement correctly', async () => {
    const INTERVAL = 100
    const actionId = `infinite-replacement-test-${Date.now()}`
    const executions: Array<{time: number; payload: any}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      executions.push({time: elapsed, payload})

      console.log(
        `[${elapsed}ms] INFINITE EXECUTION: ${JSON.stringify(payload)}`
      )
      return {executed: true}
    })

    // Create action with infinite repeats
    cyre.action({
      id: actionId,
      interval: INTERVAL,
      repeat: true // Infinite
    })

    console.log(`[TEST] Starting infinite repeats every ${INTERVAL}ms`)

    // Start infinite repeats
    await cyre.call(actionId, {phase: 'infinite', start: Date.now()})

    // Let it run for a short time
    await new Promise(resolve => setTimeout(resolve, 250))

    console.log(`[TEST] Replacing infinite timekeeper with finite one`)

    // Replace with finite repeats
    cyre.action({
      id: actionId,
      interval: INTERVAL,
      repeat: 2 // Finite
    })

    await cyre.call(actionId, {phase: 'finite', start: Date.now()})

    // Wait for finite repeats to complete
    await new Promise(resolve => setTimeout(resolve, 300))

    console.log('[TEST] Final executions:', executions)

    // Should have some executions from both phases
    const infinitePhaseExecutions = executions.filter(
      e => e.payload?.phase === 'infinite'
    )
    const finitePhaseExecutions = executions.filter(
      e => e.payload?.phase === 'finite'
    )

    console.log('[TEST] Phase breakdown:', {
      infinite: infinitePhaseExecutions.length,
      finite: finitePhaseExecutions.length,
      total: executions.length
    })

    // Should have stopped the infinite loop and executed finite repeats
    expect(finitePhaseExecutions.length).toBe(2) // Exactly 2 finite executions
    expect(infinitePhaseExecutions.length).toBeGreaterThan(0) // Had some infinite executions
    expect(infinitePhaseExecutions.length).toBeLessThan(10) // But not too many (was stopped)
  })

  /**
   * Test metrics integration
   */
  it('should properly integrate with metrics system', async () => {
    const actionId = `metrics-integration-test-${Date.now()}`
    let executionCount = 0

    // Register handler
    cyre.on(actionId, payload => {
      executionCount++
      console.log(
        `[METRICS] Execution ${executionCount}: ${JSON.stringify(payload)}`
      )
      return {executed: true, count: executionCount}
    })

    // Create action with delay and interval
    cyre.action({
      id: actionId,
      delay: 50,
      interval: 100,
      repeat: 2
    })

    // Get initial metrics
    const initialMetrics = cyre.getMetrics(actionId)
    console.log('[TEST] Initial metrics:', initialMetrics)

    // Start the action
    await cyre.call(actionId, {metricsTest: true})

    // Wait for executions to complete
    await new Promise(resolve => setTimeout(resolve, 300))

    // Get final metrics
    const finalMetrics = cyre.getMetrics(actionId)
    console.log('[TEST] Final metrics:', finalMetrics)

    // Verify executions occurred
    expect(executionCount).toBe(2)

    // Verify metrics are tracking the action
    expect(finalMetrics).toBeDefined()
    expect(finalMetrics.formations).toBeDefined()

    // Should have formation data for this action
    const actionFormations = finalMetrics.formations.filter(
      f => f.id === actionId
    )
    if (actionFormations.length > 0) {
      expect(actionFormations[0].executionCount).toBeGreaterThan(0)
    }

    // Check breathing state (should be relatively stable for this small test)
    const breathingState = cyre.getBreathingState()
    console.log('[TEST] Breathing state:', breathingState)
    expect(breathingState).toBeDefined()
    expect(typeof breathingState.stress).toBe('number')
  })

  /**
   * Test backward compatibility with legacy timekeeper usage
   */
  it('should maintain backward compatibility with direct timekeeper usage', async () => {
    const executions: number[] = []
    let executionCount = 0

    // Direct timekeeper usage (legacy style)
    const timeKeeper = (await import('../src/components/cyre-timekeeper'))
      .default

    const timerResult = timeKeeper.keep(
      100, // duration
      () => {
        executionCount++
        executions.push(Date.now())
        console.log(`[LEGACY] Direct timekeeper execution ${executionCount}`)
      },
      2, // repeat 2 times
      'legacy-test-timer'
    )

    console.log('[TEST] Legacy timekeeper result:', timerResult)
    expect(timerResult.kind).toBe('ok')

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 250))

    console.log('[TEST] Legacy executions:', {
      count: executionCount,
      times: executions
    })

    // Should have executed the expected number of times
    expect(executionCount).toBe(2)
    expect(executions.length).toBe(2)
  })

  /**
   * Test edge case: delay without interval
   */
  it('should handle delay-only actions (no interval) correctly', async () => {
    const DELAY = 120
    const actionId = `delay-only-test-${Date.now()}`
    const executions: Array<{time: number}> = []
    const startTime = Date.now()

    // Register handler
    cyre.on(actionId, payload => {
      const elapsed = Date.now() - startTime
      executions.push({time: elapsed})

      console.log(
        `[${elapsed}ms] DELAY-ONLY EXECUTION: ${JSON.stringify(payload)}`
      )
      return {executed: true}
    })

    // Create action with only delay (no interval, no repeat)
    cyre.action({
      id: actionId,
      delay: DELAY
      // No interval, no repeat specified - should execute once after delay
    })

    console.log(
      `[TEST] Calling action: delay=${DELAY}ms only (single execution)`
    )

    // Start the action
    await cyre.call(actionId, {testData: 'delay-only'})

    // Wait for execution
    const totalWaitTime = DELAY + 50 // Buffer
    console.log(`[TEST] Waiting ${totalWaitTime}ms for single execution`)
    await new Promise(resolve => setTimeout(resolve, totalWaitTime))

    console.log('[TEST] Final executions:', executions)

    // Should execute exactly once after delay
    expect(executions.length).toBe(1)
    expect(executions[0].time).toBeGreaterThanOrEqual(DELAY * 0.8)
    expect(executions[0].time).toBeLessThanOrEqual(DELAY * 1.5)
  })
})
