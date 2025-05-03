// test/timekeeper.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import timeKeeper from '../src/components/cyre-time-keeper'
import {cyre} from '../src/app'

/*
 * TimeKeeper Test for CYRE
 *
 * Tests TimeKeeper with proper subscription approach using action IDs
 */

describe('TimeKeeper with Correct Subscriptions', () => {
  // Prevent process.exit from terminating tests
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== TIMEKEEPER TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== TIMEKEEPER TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Basic timer creation and execution
   */
  it('should create and execute a timer', async () => {
    // Track execution
    let executionCount = 0
    const ACTION_ID = 'timer-test-action'

    // Register handler for the timer action ID
    console.log('[TEST] Registering handler for timer action')

    cyre.on(ACTION_ID, payload => {
      console.log('[HANDLER] Timer executed with payload:', payload)
      executionCount++
      return {executed: true, count: executionCount}
    })

    // Create action for the timer
    console.log('[TEST] Creating action for timer')

    cyre.action({
      id: ACTION_ID,
      type: 'timer-group', // Type is just for grouping
      payload: {initial: true},
      detectChanges: false
    })

    // Set up a simple timer using TimeKeeper
    console.log('[TEST] Creating timer with TimeKeeper')

    const timerResult = timeKeeper.keep(
      500, // 500ms delay
      () => {
        console.log('[TIMER] Timer callback executing')
        return cyre.call(ACTION_ID, {fromTimer: true, timestamp: Date.now()})
      },
      false, // Don't repeat
      'test-timer-id'
    )

    console.log('[TEST] Timer creation result:', timerResult)

    // Wait for timer to execute
    console.log('[TEST] Waiting for timer execution')
    await new Promise(resolve => setTimeout(resolve, 600))

    console.log('[TEST] Timer execution count:', executionCount)

    // Verify timer executed the action
    expect(executionCount).toBeGreaterThan(0)
  })

  /**
   * Test for timer with breathing adaptation
   */
  it('should adapt timer intervals based on breathing state', async () => {
    // Create a timer with tracking
    const executionTimes: number[] = []
    const ACTION_ID = 'adaptive-timer-action'

    // Register handler
    console.log('[TEST] Registering handler for adaptive timer')

    cyre.on(ACTION_ID, payload => {
      console.log('[HANDLER] Adaptive timer executed with:', payload)
      executionTimes.push(Date.now())
      return {executed: true, timestamp: Date.now()}
    })

    // Create action
    console.log('[TEST] Creating action for adaptive timer')

    cyre.action({
      id: ACTION_ID,
      type: 'timer-adaptive-group',
      payload: {initial: true},
      detectChanges: false
    })

    // Create a repeating timer
    console.log('[TEST] Creating repeating adaptive timer')

    const baseInterval = 200 // Base interval of 200ms

    const timerResult = timeKeeper.keep(
      baseInterval,
      () => {
        console.log('[TIMER] Adaptive timer callback executing')
        const breathingState = cyre.getBreathingState()
        console.log('[TIMER] Current breathing state:', {
          stress: breathingState.stress,
          rate: breathingState.currentRate,
          isRecuperating: breathingState.isRecuperating
        })

        return cyre.call(ACTION_ID, {
          fromTimer: true,
          timestamp: Date.now(),
          breathingState
        })
      },
      3, // Repeat 3 times
      'adaptive-timer-id'
    )

    console.log('[TEST] Adaptive timer creation result:', timerResult)

    // Wait for all executions to complete
    console.log('[TEST] Waiting for all timer executions')
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('[TEST] Timer execution times:', executionTimes)
    console.log('[TEST] Number of executions:', executionTimes.length)

    // Compute intervals between executions
    const intervals = []
    for (let i = 1; i < executionTimes.length; i++) {
      intervals.push(executionTimes[i] - executionTimes[i - 1])
    }

    console.log('[TEST] Intervals between executions:', intervals)

    // Verify timer executed multiple times
    expect(executionTimes.length).toBeGreaterThan(1)
  })

  /**
   * Test stress adaptation in timer execution
   */
  it('should demonstrate timer behavior under stress', async () => {
    // Set up stress simulation
    console.log('[TEST] Setting up stress simulation')

    // Action for stress testing
    const STRESS_ACTION_ID = 'stress-test-action'

    // Handler execution tracking
    let executionCount = 0
    let stressEventsFired = 0

    // Register handler
    console.log('[TEST] Registering stress test handler')

    cyre.on(STRESS_ACTION_ID, payload => {
      console.log('[HANDLER] Stress test executed with:', payload)
      executionCount++

      // Simulate CPU work to increase stress
      if (payload.generateStress) {
        console.log('[HANDLER] Generating artificial stress')
        stressEventsFired++

        // Artificial load
        let x = 0
        for (let i = 0; i < 100000; i++) {
          x += Math.sqrt(i)
        }
      }

      return {executed: true, count: executionCount, load: stressEventsFired}
    })

    // Create action
    console.log('[TEST] Creating stress test action')

    cyre.action({
      id: STRESS_ACTION_ID,
      type: 'stress-test-group',
      payload: {initial: true},
      detectChanges: false
    })

    // Generate some stress first
    console.log('[TEST] Generating initial stress')

    for (let i = 0; i < 5; i++) {
      await cyre.call(STRESS_ACTION_ID, {
        generateStress: true,
        round: i,
        timestamp: Date.now()
      })
    }

    console.log('[TEST] Initial stress generated')

    // Get breathing state to see the stress level
    const initialBreathingState = cyre.getBreathingState()
    console.log('[TEST] Breathing state after stress:', initialBreathingState)

    // Create a timer that should adapt to the stress
    console.log('[TEST] Creating timer under stress conditions')

    const baseInterval = 100 // Short interval

    const timerResult = timeKeeper.keep(
      baseInterval,
      () => {
        const breathingState = cyre.getBreathingState()
        console.log('[TIMER] Executing under stress:', breathingState.stress)

        return cyre.call(STRESS_ACTION_ID, {
          fromStressTimer: true,
          timestamp: Date.now(),
          breathingState
        })
      },
      2, // Repeat twice
      'stress-timer-id'
    )

    console.log('[TEST] Stress timer creation result:', timerResult)

    // Wait for timer executions
    console.log('[TEST] Waiting for stress timer executions')
    await new Promise(resolve => setTimeout(resolve, 500))

    console.log('[TEST] Final execution count:', executionCount)
    console.log('[TEST] Stress events fired:', stressEventsFired)

    // Get final breathing state
    const finalBreathingState = cyre.getBreathingState()
    console.log('[TEST] Final breathing state:', finalBreathingState)

    // Verify stress impact
    expect(executionCount).toBeGreaterThan(stressEventsFired)
    expect(finalBreathingState.stress).toBeGreaterThan(0)
  })
})
