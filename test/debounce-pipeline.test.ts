// test/debounce-pipeline.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * Comprehensive tests for debounce protection in the protection pipeline
 */
describe('Debounce Protection Pipeline', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== DEBOUNCE PROTECTION TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== DEBOUNCE PROTECTION TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test basic debounce behavior
   */
  it('should collapse rapid calls with debounce interval', async () => {
    // Create action with debounce
    const DEBOUNCE_INTERVAL = 200 // ms
    cyre.action({
      id: 'debounce-test',
      type: 'test',
      debounce: DEBOUNCE_INTERVAL
    })

    // Execution tracking
    const executions = []
    let handlerCallCount = 0
    let lastExecutedPayload = null

    // Register handler
    cyre.on('debounce-test', payload => {
      handlerCallCount++
      lastExecutedPayload = {...payload}

      const timestamp = Date.now()
      executions.push({
        timestamp,
        payload: {...payload},
        count: handlerCallCount
      })

      console.log(`[TEST] Handler executed (${handlerCallCount}):`, payload)
      return {executed: true}
    })

    // SCENARIO 1: Make multiple rapid calls
    console.log(
      '[TEST] Making multiple rapid calls - should collapse to one execution'
    )

    const callCount = 5
    const callResults = []

    // Make rapid calls
    for (let i = 0; i < callCount; i++) {
      const result = await cyre.call('debounce-test', {
        sequence: 'rapid',
        call: i + 1,
        value: `call-${i + 1}`
      })

      callResults.push(result)

      // Brief delay between calls (but shorter than debounce interval)
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    // All calls should report debounced status
    callResults.forEach((result, i) => {
      expect(result.ok).toBe(true)
      expect(result.message).toContain('Debounced')
    })

    // Handler shouldn't have executed yet
    expect(handlerCallCount).toBe(0)

    // SCENARIO 2: Wait for debounce period to expire
    console.log(`[TEST] Waiting for debounce period (${DEBOUNCE_INTERVAL}ms)`)
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_INTERVAL + 50))

    // Handler should now have executed exactly once
    expect(handlerCallCount).toBe(1)

    // Should have executed with the last payload from the rapid call series
    expect(lastExecutedPayload?.call).toBe(5)
    expect(lastExecutedPayload?.value).toBe('call-5')

    // SCENARIO 3: Make a single call and wait
    console.log('[TEST] Making single call with sufficient delay')
    await cyre.call('debounce-test', {
      sequence: 'single',
      uniqueId: 'abc123'
    })

    // Wait for debounce period to expire
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_INTERVAL + 50))

    // Should now have executed twice
    expect(handlerCallCount).toBe(2)

    // Should have executed with the single call payload
    expect(lastExecutedPayload?.sequence).toBe('single')
    expect(lastExecutedPayload?.uniqueId).toBe('abc123')

    // Log execution details
    console.log('[TEST] Execution details:', executions)
  })

  /**
   * Test debounce with a new call during wait period
   */
  it('should reset debounce timer when new calls arrive during wait period', async () => {
    // Create action with debounce
    const DEBOUNCE_INTERVAL = 300 // ms
    cyre.action({
      id: 'debounce-reset-test',
      type: 'test',
      debounce: DEBOUNCE_INTERVAL
    })

    // Execution tracking
    let handlerCallCount = 0
    let lastExecutedPayload = null
    const executionTimestamps = []

    // Register handler
    cyre.on('debounce-reset-test', payload => {
      handlerCallCount++
      lastExecutedPayload = {...payload}
      executionTimestamps.push(Date.now())

      console.log(`[TEST] Handler executed (${handlerCallCount}):`, payload)
      return {executed: true}
    })

    // SCENARIO 1: Make initial call
    console.log('[TEST] Making initial call')
    const startTime = Date.now()
    await cyre.call('debounce-reset-test', {stage: 'initial', value: 1})

    // Wait half the debounce period
    const halfInterval = Math.floor(DEBOUNCE_INTERVAL / 2)
    console.log(`[TEST] Waiting half the debounce period (${halfInterval}ms)`)
    await new Promise(resolve => setTimeout(resolve, halfInterval))

    // SCENARIO 2: Make another call during wait period
    console.log('[TEST] Making second call during wait period')
    await cyre.call('debounce-reset-test', {stage: 'reset', value: 2})

    // Wait half the debounce period again
    console.log(
      `[TEST] Waiting half the debounce period again (${halfInterval}ms)`
    )
    await new Promise(resolve => setTimeout(resolve, halfInterval))

    // SCENARIO 3: Make a third call
    console.log('[TEST] Making third call during wait period')
    await cyre.call('debounce-reset-test', {stage: 'final', value: 3})

    // Wait the full debounce period
    console.log(`[TEST] Waiting full debounce period (${DEBOUNCE_INTERVAL}ms)`)
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_INTERVAL + 50))

    // Verify execution
    expect(handlerCallCount).toBe(1)
    expect(lastExecutedPayload?.stage).toBe('final')
    expect(lastExecutedPayload?.value).toBe(3)

    // Calculate actual debounce time
    const totalElapsed = executionTimestamps[0] - startTime
    console.log(`[TEST] Total elapsed time before execution: ${totalElapsed}ms`)

    // This should be at least the sum of half interval + half interval + full interval
    // But allow some timing flexibility
    expect(totalElapsed).toBeGreaterThanOrEqual(DEBOUNCE_INTERVAL * 1.8)
  })

  /**
   * Test different debounce intervals
   */
  it('should respect different debounce intervals', async () => {
    // Create actions with different debounce intervals
    const intervals = [100, 250, 500]
    const executions = {}
    const actions = {}

    // Set up each action
    for (const interval of intervals) {
      const actionId = `debounce-${interval}`

      // Initialize execution tracking
      executions[interval] = {
        calls: 0,
        timestamp: 0,
        payload: null
      }

      // Create action
      cyre.action({
        id: actionId,
        type: 'test',
        debounce: interval
      })

      // Store reference
      actions[interval] = actionId

      // Register handler
      cyre.on(actionId, payload => {
        executions[interval].calls++
        executions[interval].timestamp = Date.now()
        executions[interval].payload = {...payload}

        return {executed: true}
      })
    }

    // Record start time
    const startTime = Date.now()

    // Make rapid calls to all actions
    console.log('[TEST] Making rapid calls to all debounced actions')

    for (let i = 0; i < 3; i++) {
      for (const interval of intervals) {
        const actionId = actions[interval]
        await cyre.call(actionId, {batch: i, value: `call-${i}`})
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    // Wait for shortest interval to complete
    const shortestInterval = Math.min(...intervals)
    console.log(`[TEST] Waiting for shortest interval (${shortestInterval}ms)`)
    await new Promise(resolve => setTimeout(resolve, shortestInterval + 50))

    // Check execution state
    console.log('[TEST] Checking execution state after shortest interval')
    expect(executions[shortestInterval].calls).toBe(1)
    expect(executions[shortestInterval].payload.value).toBe('call-2')

    // Medium and longest intervals should not have executed yet
    const mediumInterval = intervals[1]
    const longestInterval = Math.max(...intervals)

    expect(executions[mediumInterval].calls).toBe(0)
    expect(executions[longestInterval].calls).toBe(0)

    // Wait for medium interval to complete
    console.log(`[TEST] Waiting for medium interval (${mediumInterval}ms)`)
    await new Promise(resolve =>
      setTimeout(resolve, mediumInterval - shortestInterval + 50)
    )

    // Check execution state again
    console.log('[TEST] Checking execution state after medium interval')
    expect(executions[mediumInterval].calls).toBe(1)
    expect(executions[mediumInterval].payload.value).toBe('call-2')
    expect(executions[longestInterval].calls).toBe(0)

    // Wait for longest interval to complete
    console.log(`[TEST] Waiting for longest interval (${longestInterval}ms)`)
    await new Promise(resolve =>
      setTimeout(resolve, longestInterval - mediumInterval + 50)
    )

    // All should have executed once
    console.log('[TEST] Checking final execution state')
    for (const interval of intervals) {
      expect(executions[interval].calls).toBe(1)
      expect(executions[interval].payload.value).toBe('call-2')
    }

    // Calculate elapsed times
    const elapsedTimes = {}
    for (const interval of intervals) {
      elapsedTimes[interval] = executions[interval].timestamp - startTime
    }

    console.log('[TEST] Execution elapsed times:', elapsedTimes)

    // Verify intervals are respected
    for (const interval of intervals) {
      // Allow for small timing variations (0.9x - 1.2x of specified interval)
      const minExpectedTime = interval * 0.9
      const maxExpectedTime = interval * 1.2 + 60 // Add buffer for test overhead

      expect(elapsedTimes[interval]).toBeGreaterThanOrEqual(minExpectedTime)
      expect(elapsedTimes[interval]).toBeLessThanOrEqual(maxExpectedTime)
    }
  })

  /**
   * Test that debounce executes with the most recent payload
   */
  it('should execute with the most recent payload after debounce period', async () => {
    // Create action with debounce
    const DEBOUNCE_INTERVAL = 200 // ms
    cyre.action({
      id: 'debounce-payload-test',
      type: 'test',
      debounce: DEBOUNCE_INTERVAL
    })

    // Execution tracking
    let executedPayload = null

    // Register handler
    cyre.on('debounce-payload-test', payload => {
      console.log(`[TEST] Handler executed with payload:`, payload)
      executedPayload = {...payload}
      return {executed: true}
    })

    // Make a series of calls with different payloads
    console.log('[TEST] Making series of calls with different payloads')

    const payloads = [
      {id: 'first', value: 1, data: 'a'},
      {id: 'second', value: 2, data: 'b'},
      {id: 'third', value: 3, data: 'c'},
      {id: 'fourth', value: 4, data: 'd'},
      {id: 'fifth', value: 5, data: 'e'}
    ]

    for (const payload of payloads) {
      await cyre.call('debounce-payload-test', payload)
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Wait for debounce period to expire
    console.log(`[TEST] Waiting for debounce period (${DEBOUNCE_INTERVAL}ms)`)
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_INTERVAL + 50))

    // Verify executed with last payload
    expect(executedPayload).not.toBeNull()
    expect(executedPayload.id).toBe('fifth')
    expect(executedPayload.value).toBe(5)
    expect(executedPayload.data).toBe('e')
  })

  /**
   * Test combined debounce and change detection
   */
  it('should correctly combine debounce with change detection', async () => {
    // Create action with debounce and change detection
    const DEBOUNCE_INTERVAL = 200 // ms
    cyre.action({
      id: 'debounce-change-test',
      type: 'test',
      debounce: DEBOUNCE_INTERVAL,
      detectChanges: true
    })

    // Execution tracking
    const executions = []

    // Register handler
    cyre.on('debounce-change-test', payload => {
      const timestamp = Date.now()
      executions.push({
        timestamp,
        payload: {...payload}
      })

      console.log(`[TEST] Handler executed at ${timestamp}:`, payload)
      return {executed: true}
    })

    // SCENARIO 1: Multiple identical calls - should result in one execution
    console.log('[TEST] Making multiple identical calls')

    const staticPayload = {id: 'static', value: 1}

    for (let i = 0; i < 3; i++) {
      await cyre.call('debounce-change-test', staticPayload)
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    // Wait for debounce period
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_INTERVAL + 50))

    // Should have executed once
    expect(executions.length).toBe(1)
    expect(executions[0].payload).toEqual(staticPayload)

    // SCENARIO 2: Multiple different calls - should result in one execution with last payload
    console.log('[TEST] Making multiple different calls')

    for (let i = 0; i < 3; i++) {
      await cyre.call('debounce-change-test', {
        id: 'dynamic',
        value: i + 1,
        suffix: `call-${i + 1}`
      })

      await new Promise(resolve => setTimeout(resolve, 20))
    }

    // Wait for debounce period
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_INTERVAL + 50))

    // Should now have executed twice
    expect(executions.length).toBe(2)
    expect(executions[1].payload.id).toBe('dynamic')
    expect(executions[1].payload.value).toBe(3)
    expect(executions[1].payload.suffix).toBe('call-3')

    // SCENARIO 3: Rapid identical calls after change - should be skipped
    console.log('[TEST] Making identical calls after change')

    const unchangedPayload = {...executions[1].payload}

    for (let i = 0; i < 3; i++) {
      await cyre.call('debounce-change-test', unchangedPayload)
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    // Wait for debounce period
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_INTERVAL + 50))

    // Should still have only executed twice (unchanged payload skipped)
    expect(executions.length).toBe(2)

    // Log execution details
    console.log('[TEST] Final execution details:', executions)
  })
})
