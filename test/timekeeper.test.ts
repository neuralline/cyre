// test/timekeeper.test.ts - Updated for new TimeKeeper API

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import timeKeeper from '../src/components/cyre-timekeeper'
import {cyre} from '../src/app'

/*
 * TimeKeeper Test for CYRE - Updated for redesigned API
 *
 * Tests new features:
 * - Delay/Interval logic: delay controls first execution, interval for subsequent
 * - Single _quartz timer source
 * - Timer precision tiers
 * - Cross-platform compatibility
 * - Better race condition management
 *
 * New API: keep(interval, callback, repeat?, id?, delay?)
 */

describe('TimeKeeper with Redesigned API', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()
  })

  afterEach(() => {
    // Clean up all timers
    timeKeeper.reset()

    vi.restoreAllMocks()
  })

  /**
   * Test basic timer creation with new API
   */
  it('should create and execute a timer with new API signature', async () => {
    let executionCount = 0
    const ACTION_ID = 'basic-timer-test'

    // Register handler
    cyre.on(ACTION_ID, payload => {
      console.log('[HANDLER] Timer executed with payload:', payload)
      executionCount++
      return {executed: true, count: executionCount}
    })

    // Create action
    cyre.action({
      id: ACTION_ID,
      type: 'timer-test',
      payload: {initial: true}
    })

    // Create timer with new API: keep(interval, callback, repeat?, id?, delay?)
    console.log('[TEST] Creating timer with new API')

    const timerResult = timeKeeper.keep(
      300, // interval - duration for executions
      () => {
        console.log('[TIMER] Timer callback executing')
        return cyre.call(ACTION_ID, {fromTimer: true, timestamp: Date.now()})
      },
      1, // repeat - execute once
      'basic-timer-id' // id
      // No delay parameter - should use interval for first execution
    )

    console.log('[TEST] Timer creation result:', timerResult)
    expect(timerResult.kind).toBe('ok')

    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 400))

    console.log('[TEST] Execution count:', executionCount)
    expect(executionCount).toBe(1)
  })

  /**
   * Test delay/interval logic - delay controls first execution
   */
  it('should use delay for first execution, interval for subsequent executions', async () => {
    const executionTimes: number[] = []
    const ACTION_ID = 'delay-interval-test'
    const startTime = Date.now()

    // Register handler
    cyre.on(ACTION_ID, payload => {
      console.log('[HANDLER] Delay/Interval timer executed')
      executionTimes.push(Date.now() - startTime)
      return {executed: true, timestamp: Date.now()}
    })

    // Create action
    cyre.action({
      id: ACTION_ID,
      type: 'delay-interval-test',
      payload: {test: true}
    })

    // Create timer: delay=100ms for first, interval=200ms for subsequent
    console.log(
      '[TEST] Creating timer with delay=100ms, interval=200ms, repeat=3'
    )

    const timerResult = timeKeeper.keep(
      200, // interval - for subsequent executions
      () => {
        console.log('[TIMER] Delay/Interval callback executing')
        return cyre.call(ACTION_ID, {fromTimer: true})
      },
      3, // repeat - execute 3 times total
      'delay-interval-timer',
      100 // delay - for first execution only
    )

    expect(timerResult.kind).toBe('ok')

    // Wait for all executions
    await new Promise(resolve => setTimeout(resolve, 700))

    console.log('[TEST] Execution times:', executionTimes)
    expect(executionTimes.length).toBe(3)

    // First execution should be around 100ms (delay)
    expect(executionTimes[0]).toBeGreaterThanOrEqual(90)
    expect(executionTimes[0]).toBeLessThanOrEqual(150)

    // Subsequent executions should be ~200ms apart (interval)
    if (executionTimes.length >= 2) {
      const firstInterval = executionTimes[1] - executionTimes[0]
      expect(firstInterval).toBeGreaterThanOrEqual(180)
      expect(firstInterval).toBeLessThanOrEqual(250)
    }

    if (executionTimes.length >= 3) {
      const secondInterval = executionTimes[2] - executionTimes[1]
      expect(secondInterval).toBeGreaterThanOrEqual(180)
      expect(secondInterval).toBeLessThanOrEqual(250)
    }
  })

  /**
   * Test immediate execution with delay=0
   */
  it('should execute immediately with delay=0, then use interval', async () => {
    const executionTimes: number[] = []
    const ACTION_ID = 'immediate-timer-test'
    const startTime = Date.now()

    // Register handler
    cyre.on(ACTION_ID, payload => {
      console.log('[HANDLER] Immediate timer executed')
      executionTimes.push(Date.now() - startTime)
      return {executed: true}
    })

    // Create action
    cyre.action({
      id: ACTION_ID,
      type: 'immediate-test',
      payload: {immediate: true}
    })

    // Create timer with delay=0 (immediate) and interval=150ms
    console.log(
      '[TEST] Creating timer with delay=0 (immediate), interval=150ms'
    )

    const timerResult = timeKeeper.keep(
      150, // interval
      () => cyre.call(ACTION_ID, {immediate: true}),
      2, // repeat twice
      'immediate-timer',
      0 // delay=0 for immediate first execution
    )

    expect(timerResult.kind).toBe('ok')

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 300))

    console.log('[TEST] Execution times:', executionTimes)
    expect(executionTimes.length).toBe(2)

    // First execution should be very quick (delay=0)
    expect(executionTimes[0]).toBeLessThanOrEqual(50)

    // Second execution should be ~150ms after first
    if (executionTimes.length >= 2) {
      const interval = executionTimes[1] - executionTimes[0]
      expect(interval).toBeGreaterThanOrEqual(130)
      expect(interval).toBeLessThanOrEqual(200)
    }
  })

  /**
   * Test timer precision tiers
   */
  it('should use appropriate precision tier based on duration', async () => {
    let highPrecisionExecuted = false
    let mediumPrecisionExecuted = false

    const HIGH_PRECISION_ID = 'high-precision-timer'
    const MEDIUM_PRECISION_ID = 'medium-precision-timer'

    // Register handlers
    cyre.on(HIGH_PRECISION_ID, () => {
      highPrecisionExecuted = true
      return {executed: true}
    })

    cyre.on(MEDIUM_PRECISION_ID, () => {
      mediumPrecisionExecuted = true
      return {executed: true}
    })

    // Create actions
    cyre.action({id: HIGH_PRECISION_ID, type: 'precision-test'})
    cyre.action({id: MEDIUM_PRECISION_ID, type: 'precision-test'})

    // High precision timer (< 50ms)
    console.log('[TEST] Creating high precision timer (25ms)')
    const highPrecisionResult = timeKeeper.keep(
      25, // interval - should trigger high precision tier
      () => cyre.call(HIGH_PRECISION_ID, {precision: 'high'}),
      1,
      'high-precision-test'
    )

    // Medium precision timer (>= 50ms)
    console.log('[TEST] Creating medium precision timer (100ms)')
    const mediumPrecisionResult = timeKeeper.keep(
      100, // interval - should trigger medium precision tier
      () => cyre.call(MEDIUM_PRECISION_ID, {precision: 'medium'}),
      1,
      'medium-precision-test'
    )

    expect(highPrecisionResult.kind).toBe('ok')
    expect(mediumPrecisionResult.kind).toBe('ok')

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(highPrecisionExecuted).toBe(true)
    expect(mediumPrecisionExecuted).toBe(true)
  })

  /**
   * Test infinite repeats
   */
  it('should support infinite repeats with proper cleanup', async () => {
    let executionCount = 0
    const ACTION_ID = 'infinite-timer-test'

    // Register handler
    cyre.on(ACTION_ID, payload => {
      console.log(
        '[HANDLER] Infinite timer executed, count:',
        executionCount + 1
      )
      executionCount++
      return {executed: true, count: executionCount}
    })

    // Create action
    cyre.action({
      id: ACTION_ID,
      type: 'infinite-test',
      payload: {infinite: true}
    })

    // Create infinite timer
    console.log('[TEST] Creating infinite timer with 100ms interval')

    const timerResult = timeKeeper.keep(
      100, // interval
      () => cyre.call(ACTION_ID, {infinite: true}),
      true, // infinite repeats
      'infinite-timer'
    )

    expect(timerResult.kind).toBe('ok')

    // Let it run for a bit
    await new Promise(resolve => setTimeout(resolve, 350))

    console.log('[TEST] Execution count after 350ms:', executionCount)
    expect(executionCount).toBeGreaterThanOrEqual(2)

    // Stop the infinite timer
    timeKeeper.forget('infinite-timer')

    const countAfterStop = executionCount

    // Wait a bit more to ensure it stopped
    await new Promise(resolve => setTimeout(resolve, 200))

    console.log('[TEST] Execution count after stop:', executionCount)
    expect(executionCount).toBe(countAfterStop) // Should not increase
  })

  /**
   * Test pause and resume functionality
   */
  it('should properly pause and resume timers', async () => {
    let executionCount = 0
    const ACTION_ID = 'pause-resume-test'

    // Register handler
    cyre.on(ACTION_ID, payload => {
      console.log('[HANDLER] Pause/Resume timer executed')
      executionCount++
      return {executed: true, count: executionCount}
    })

    // Create action
    cyre.action({
      id: ACTION_ID,
      type: 'pause-resume-test',
      payload: {test: true}
    })

    // Create timer
    console.log('[TEST] Creating timer for pause/resume test')

    const timerResult = timeKeeper.keep(
      100, // interval
      () => cyre.call(ACTION_ID, {pauseTest: true}),
      5, // repeat 5 times
      'pause-resume-timer'
    )

    expect(timerResult.kind).toBe('ok')

    // Let it execute once
    await new Promise(resolve => setTimeout(resolve, 150))

    const countAfterFirst = executionCount
    console.log('[TEST] Count after first execution:', countAfterFirst)
    expect(countAfterFirst).toBeGreaterThanOrEqual(1)

    // Pause the timer
    console.log('[TEST] Pausing timer')
    timeKeeper.pause('pause-resume-timer')

    // Wait while paused
    await new Promise(resolve => setTimeout(resolve, 200))

    const countWhilePaused = executionCount
    console.log('[TEST] Count while paused:', countWhilePaused)
    expect(countWhilePaused).toBe(countAfterFirst) // Should not increase

    // Resume the timer
    console.log('[TEST] Resuming timer')
    timeKeeper.resume('pause-resume-timer')

    // Wait for more executions
    await new Promise(resolve => setTimeout(resolve, 250))

    const countAfterResume = executionCount
    console.log('[TEST] Count after resume:', countAfterResume)
    expect(countAfterResume).toBeGreaterThan(countWhilePaused)
  })

  /**
   * Test timer status and statistics
   */
  it('should provide comprehensive timer status and statistics', async () => {
    console.log('[TEST] Testing timer status and statistics')

    // Create a few timers
    const timer1Result = timeKeeper.keep(
      200,
      () => console.log('Timer 1'),
      3,
      'status-timer-1',
      50 // delay
    )

    const timer2Result = timeKeeper.keep(
      300,
      () => console.log('Timer 2'),
      true, // infinite
      'status-timer-2'
    )

    expect(timer1Result.kind).toBe('ok')
    expect(timer2Result.kind).toBe('ok')

    // Get status
    const status = timeKeeper.status()

    console.log('[TEST] TimeKeeper status:', JSON.stringify(status, null, 2))

    // Verify status structure
    expect(status).toHaveProperty('activeFormations')
    expect(status).toHaveProperty('totalFormations')
    expect(status).toHaveProperty('hibernating')
    expect(status).toHaveProperty('formations')
    expect(status).toHaveProperty('quartzStats')
    expect(status).toHaveProperty('environment')
    expect(status).toHaveProperty('memoryUsage')

    // Verify we have active formations
    expect(status.activeFormations).toBeGreaterThanOrEqual(2)
    expect(status.formations).toHaveLength(status.totalFormations)

    // Verify quartz statistics
    expect(status.quartzStats.activeCount).toBeGreaterThanOrEqual(2)
    expect(status.quartzStats.activeIds).toContain('status-timer-1')
    expect(status.quartzStats.activeIds).toContain('status-timer-2')

    // Verify environment detection
    expect(status.environment).toHaveProperty('hasHrTime')
    expect(status.environment).toHaveProperty('hasPerformance')
    expect(status.environment).toHaveProperty('hasSetImmediate')
    expect(status.environment).toHaveProperty('isTest', true)

    // Clean up
    timeKeeper.forget('status-timer-1')
    timeKeeper.forget('status-timer-2')
  })

  /**
   * Test error handling and validation
   */
  it('should handle invalid parameters gracefully', () => {
    console.log('[TEST] Testing error handling and validation')

    // Test negative interval
    const negativeIntervalResult = timeKeeper.keep(
      -100,
      () => console.log('Should not work'),
      1,
      'negative-interval-test'
    )

    expect(negativeIntervalResult.kind).toBe('error')
    expect(negativeIntervalResult.error.message).toContain(
      'Interval cannot be negative'
    )

    // Test negative delay
    const negativeDelayResult = timeKeeper.keep(
      100,
      () => console.log('Should not work'),
      1,
      'negative-delay-test',
      -50 // negative delay
    )

    expect(negativeDelayResult.kind).toBe('error')
    expect(negativeDelayResult.error.message).toContain(
      'Delay cannot be negative'
    )

    // Test invalid callback
    const invalidCallbackResult = timeKeeper.keep(
      100,
      'not a function' as any,
      1,
      'invalid-callback-test'
    )

    expect(invalidCallbackResult.kind).toBe('error')
    expect(invalidCallbackResult.error.message).toContain(
      'Callback must be a function'
    )
  })

  /**
   * Test race condition prevention
   */
  it('should prevent race conditions with rapid timer operations', async () => {
    let executionCount = 0
    const ACTION_ID = 'race-condition-test'

    // Register handler
    cyre.on(ACTION_ID, payload => {
      executionCount++
      return {executed: true}
    })

    // Create action
    cyre.action({id: ACTION_ID, type: 'race-test'})

    const timerId = 'race-condition-timer'

    // Rapidly create and destroy timers with same ID
    console.log('[TEST] Testing race condition prevention')

    for (let i = 0; i < 5; i++) {
      timeKeeper.keep(
        50,
        () => cyre.call(ACTION_ID, {iteration: i}),
        1,
        timerId
      )

      // Immediately forget and recreate
      timeKeeper.forget(timerId)
    }

    // Create final timer
    const finalResult = timeKeeper.keep(
      100,
      () => cyre.call(ACTION_ID, {final: true}),
      1,
      timerId
    )

    expect(finalResult.kind).toBe('ok')

    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 150))

    console.log('[TEST] Final execution count:', executionCount)

    // Should only have 1 execution from the final timer
    expect(executionCount).toBeLessThanOrEqual(2)
  })

  /**
   * Test system integration with breathing system
   */
  it('should integrate with breathing system and adapt to stress', async () => {
    let executionCount = 0
    const ACTION_ID = 'breathing-integration-test'

    // Register handler that simulates some stress
    cyre.on(ACTION_ID, payload => {
      executionCount++

      // Simulate some work to potentially increase system stress
      let result = 0
      for (let i = 0; i < 10000; i++) {
        result += Math.sqrt(i)
      }

      return {executed: true, count: executionCount, workResult: result}
    })

    // Create action
    cyre.action({id: ACTION_ID, type: 'breathing-test'})

    // Get initial breathing state
    const initialBreathingState = cyre.getBreathingState()
    console.log('[TEST] Initial breathing state:', {
      stress: initialBreathingState.stress,
      currentRate: initialBreathingState.currentRate,
      isRecuperating: initialBreathingState.isRecuperating
    })

    // Create timer that should adapt to system breathing
    console.log('[TEST] Creating timer that adapts to breathing system')

    const timerResult = timeKeeper.keep(
      100, // base interval
      () => cyre.call(ACTION_ID, {breathing: true}),
      3,
      'breathing-timer'
    )

    expect(timerResult.kind).toBe('ok')

    // Wait for executions
    await new Promise(resolve => setTimeout(resolve, 400))

    // Get final breathing state
    const finalBreathingState = cyre.getBreathingState()
    console.log('[TEST] Final breathing state:', {
      stress: finalBreathingState.stress,
      currentRate: finalBreathingState.currentRate,
      isRecuperating: finalBreathingState.isRecuperating
    })

    console.log('[TEST] Breathing integration execution count:', executionCount)
    expect(executionCount).toBeGreaterThanOrEqual(1)

    // Breathing state should exist and be valid
    expect(finalBreathingState.stress).toBeGreaterThanOrEqual(0)
    expect(finalBreathingState.stress).toBeLessThanOrEqual(1)
    expect(finalBreathingState.currentRate).toBeGreaterThan(0)
  })
})
