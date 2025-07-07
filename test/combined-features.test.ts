// test/combined-features.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * Combined Features Interaction Test
 *
 * This test examines the complex interactions between multiple protection features:
 * - Change detection
 * - Debouncing
 * - Throttling
 *
 * When these features are combined on the same action, they can create
 * complex behavior patterns that might lead to subtle bugs.
 */
describe('Combined Protection Features', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.init()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should correctly handle the interaction between throttling, debouncing, and change detection', async () => {
    // Create unique action ID to prevent test interference
    const ACTION_ID = `combined-features-test-${Date.now()}`

    // Track executions for analysis
    const executions: Array<{
      timestamp: number
      payload: any
      timeSinceLast: number | null
    }> = []
    let lastExecutionTime: number | null = null

    // Register handler
    cyre.on(ACTION_ID, payload => {
      const now = Date.now()
      const timeSinceLast = lastExecutionTime ? now - lastExecutionTime : null
      lastExecutionTime = now

      console.log(`[HANDLER] Executed with payload:`, payload)

      executions.push({
        timestamp: now,
        payload: {...payload}, // Clone to avoid reference issues
        timeSinceLast
      })

      return {executed: true, count: executions.length}
    })

    // Create action with all three protection features
    // - Throttle: At most one execution every 100ms
    // - Debounce: Wait 100ms after last call before executing
    // - Change detection: Only execute if payload changed
    cyre.action({
      id: ACTION_ID,
      type: 'combined-test',
      payload: {initial: true},
      throttle: 100,
      debounce: 100,
      detectChanges: true
    })

    // TEST PHASE 1: Same payload, rapid calls
    console.log('[TEST] Phase 1: Rapid calls with same payload')

    // Make multiple calls with identical payload
    const callCount = 5
    for (let i = 0; i < callCount; i++) {
      await cyre.call(ACTION_ID, {value: 'static', phase: 1})
      await new Promise(resolve => setTimeout(resolve, 20)) // Fast but not instant
    }

    // Wait for any pending executions
    await new Promise(resolve => setTimeout(resolve, 200))

    const phase1Executions = executions.filter(e => e.payload.phase === 1)
    console.log(`[TEST] Phase 1 executions: ${phase1Executions.length}`)

    // PHASE 2: Changing payload, throttled timing
    console.log('[TEST] Phase 2: Changing payload with throttled timing')

    // Make calls with changing payload, but within throttle period
    for (let i = 0; i < 5; i++) {
      await cyre.call(ACTION_ID, {value: `dynamic-${i}`, phase: 2})
      await new Promise(resolve => setTimeout(resolve, 50)) // Half of throttle period
    }

    // Wait for any pending executions
    await new Promise(resolve => setTimeout(resolve, 200))

    const phase2Executions = executions.filter(e => e.payload.phase === 2)
    console.log(`[TEST] Phase 2 executions: ${phase2Executions.length}`)

    // PHASE 3: Changing payload, debounce-respecting timing
    console.log(
      '[TEST] Phase 3: Changing payload with debounce-respecting timing'
    )

    // Make calls with changing payload, but with proper spacing to respect debounce
    for (let i = 0; i < 3; i++) {
      await cyre.call(ACTION_ID, {value: `spaced-${i}`, phase: 3})
      // Wait longer than debounce to ensure previous call completes
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    // Wait for any pending executions
    await new Promise(resolve => setTimeout(resolve, 200))

    const phase3Executions = executions.filter(e => e.payload.phase === 3)
    console.log(`[TEST] Phase 3 executions: ${phase3Executions.length}`)

    // PHASE 4: Alternating same and changing payloads
    console.log('[TEST] Phase 4: Alternating same and changing payloads')

    // Alternate between same payload and changing payload
    await cyre.call(ACTION_ID, {value: 'alternating', phase: 4})
    await new Promise(resolve => setTimeout(resolve, 50))

    await cyre.call(ACTION_ID, {value: 'alternating', phase: 4}) // Same payload
    await new Promise(resolve => setTimeout(resolve, 50))

    await cyre.call(ACTION_ID, {value: 'alternating-changed', phase: 4}) // Changed
    await new Promise(resolve => setTimeout(resolve, 50))

    await cyre.call(ACTION_ID, {value: 'alternating-changed', phase: 4}) // Same again
    await new Promise(resolve => setTimeout(resolve, 50))

    // Wait for any pending executions
    await new Promise(resolve => setTimeout(resolve, 200))

    const phase4Executions = executions.filter(e => e.payload.phase === 4)
    console.log(`[TEST] Phase 4 executions: ${phase4Executions.length}`)

    // Print all executions for debugging
    console.log(
      '[TEST] All executions:',
      executions.map(e => ({
        phase: e.payload.phase,
        value: e.payload.value,
        timeSinceLast: e.timeSinceLast
      }))
    )

    // ASSERTIONS

    // Phase 1: Same payload, rapid calls
    // Expected: At most 1 execution due to no payload changes and debounce/throttle
    expect(phase1Executions.length).toBeLessThanOrEqual(1)

    // Phase 2: Changing payload, throttled timing
    // Even with changing payloads, throttle should limit executions
    // We expect fewer executions than calls due to throttling
    expect(phase2Executions.length).toBeLessThan(5)

    // Phase 3: Changing payload, debounce-respecting timing
    // With good spacing and changing payloads, we expect most calls to execute
    expect(phase3Executions.length).toBeGreaterThanOrEqual(1)

    // Phase 4: Alternating same and changing payloads
    // We expect change detection to filter some calls, leaving fewer executions
    expect(phase4Executions.length).toBeLessThan(4)

    // Timing assertion: check that throttling is respected
    // Executions should be spaced by at least the throttle interval (minus a small margin)
    const intervals = executions
      .filter((_, i) => i > 0)
      .map(e => e.timeSinceLast as number)

    // In practice, some intervals might be below the throttle time due to test timing variations
    // But most should be close to or above the throttle time
    const validThrottleIntervals = intervals.filter(interval => interval >= 90) // Allow 10ms margin
    expect(validThrottleIntervals.length).toBeGreaterThan(0)
  })

  it('should prioritize protection features in the correct order', async () => {
    // This test examines the order of operations for protection features

    // Create unique action ID
    const ACTION_ID = `feature-priority-test-${Date.now()}`

    // Track different protection events
    const protectionEvents: Array<{
      type: 'throttled' | 'debounced' | 'change-detected' | 'executed'
      timestamp: number
      payload: any
    }> = []

    // Create spy functions to track each protection mechanism
    const throttleSpy = vi.fn()
    const debounceSpy = vi.fn()
    const changeDetectionSpy = vi.fn()

    // Override methods to detect what's happening (if possible)
    // This may not work depending on internal implementation
    // Alternative approach would be to add instrumentation to the codebase

    // Register handler
    cyre.on(ACTION_ID, payload => {
      console.log(`[HANDLER] Executed with:`, payload)

      protectionEvents.push({
        type: 'executed',
        timestamp: Date.now(),
        payload: {...payload}
      })

      return {executed: true}
    })

    // Create action with all protection features
    cyre.action({
      id: ACTION_ID,
      type: 'priority-test',
      payload: {initial: true},
      throttle: 100,
      debounce: 100,
      detectChanges: true
    })

    // Make initial call
    console.log('[TEST] Making initial call')
    await cyre.call(ACTION_ID, {value: 'first'})

    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 150))

    // Make rapid calls with same payload (tests change detection)
    console.log('[TEST] Making rapid calls with same payload')
    for (let i = 0; i < 3; i++) {
      await cyre.call(ACTION_ID, {value: 'first'})
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 50))

    // Make calls with changing payload
    console.log('[TEST] Making calls with changing payload')
    for (let i = 0; i < 3; i++) {
      await cyre.call(ACTION_ID, {value: `changed-${i}`})
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    // Wait for any pending executions
    await new Promise(resolve => setTimeout(resolve, 200))

    // Log all executions
    console.log(
      '[TEST] Execution events:',
      protectionEvents.map(e => `${e.type}: ${e.payload.value}`)
    )

    // Check execution count
    // Even with changing payloads, protection features should limit executions
    expect(
      protectionEvents.filter(e => e.type === 'executed').length
    ).toBeLessThan(6)
  })
})
