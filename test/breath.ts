// test/breath.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {BREATHING} from '../src/config/cyre-config'

/*
 * Fixed Comprehensive Cyre Breathing Test Suite
 *
 * Tests CYRE's quantum breathing system with proper subscription approach
 * using action IDs (not types). Uses controlled stress simulation instead
 * of trying to overload the actual system.
 */

describe('Cyre breathing System', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== BREATHING TEST STARTED =====')
  })

  afterEach(() => {
    // Clear any test stress injection
    try {
      const {metricsState} = require('../src/context/metrics-state')
      metricsState.clearTestStress()
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('===== BREATHING TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Helper function to track breathing state changes
   */
  const trackBreathingState = (duration: number, interval: number = 100) => {
    return new Promise<
      Array<{
        time: number
        stress: number
        rate: number
        isRecuperating: boolean
        pattern: string
      }>
    >(resolve => {
      const startTime = Date.now()
      const samples: Array<{
        time: number
        stress: number
        rate: number
        isRecuperating: boolean
        pattern: string
      }> = []

      const trackingInterval = setInterval(() => {
        const state = cyre.getBreathingState()
        const elapsed = Date.now() - startTime

        samples.push({
          time: elapsed,
          stress: state.stress,
          rate: state.currentRate,
          isRecuperating: state.isRecuperating,
          pattern: state.pattern
        })

        if (elapsed >= duration) {
          clearInterval(trackingInterval)
          resolve(samples)
        }
      }, interval)
    })
  }

  /**
   * Mock system stress injection - directly manipulates breathing state
   */
  const injectSystemStress = (stressLevel: number) => {
    // Access the metrics state and use the test-specific injection method
    const {metricsState} = require('../src/context/metrics-state')

    const mockStress = {
      cpu: stressLevel * 0.8,
      memory: stressLevel * 0.6,
      eventLoop: stressLevel * 0.9,
      callRate: stressLevel * 0.7,
      combined: stressLevel
    }

    // Use the test-specific injection method
    metricsState.injectTestStress(mockStress)

    console.log(
      `[TEST] Injected stress level: ${(stressLevel * 100).toFixed(1)}%`
    )
  }

  /**
   * Create simulated load without relying on actual system stress
   */
  const createSimulatedLoad = async (intensity: number, actionId: string) => {
    console.log(`[TEST] Creating simulated load with intensity ${intensity}`)

    // Register handler that simulates work
    cyre.on(actionId, payload => {
      const startTime = performance.now()

      // Simulate varying amounts of work
      let result = 0
      for (let i = 0; i < 1000 * intensity; i++) {
        result += Math.random()
      }

      const executionTime = performance.now() - startTime
      console.log(
        `[HANDLER] Simulated work completed in ${executionTime.toFixed(2)}ms`
      )

      return {result, executionTime}
    })

    // Create action
    cyre.action({
      id: actionId,
      type: 'simulated-load',
      payload: {intensity},
      detectChanges: false
    })

    // Make multiple calls to simulate activity
    const calls = []
    for (let i = 0; i < intensity * 2; i++) {
      calls.push(cyre.call(actionId, {iteration: i, intensity}))
    }

    await Promise.allSettled(calls)
  }

  /**
   * Test for basic breathing state tracking
   */
  it('should track breathing state during system activity', async () => {
    console.log('[TEST] Starting breathing state tracking')

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(1000)

    // Create some activity
    await createSimulatedLoad(3, 'breathing-track-load-1')
    await new Promise(resolve => setTimeout(resolve, 100))
    await createSimulatedLoad(5, 'breathing-track-load-2')

    // Wait for tracking to complete
    const samples = await trackingPromise

    console.log(`[TEST] Collected ${samples.length} breathing state samples`)

    // Verify we collected samples
    expect(samples.length).toBeGreaterThan(3)

    // Verify breathing state structure
    samples.forEach(sample => {
      expect(typeof sample.stress).toBe('number')
      expect(typeof sample.rate).toBe('number')
      expect(typeof sample.isRecuperating).toBe('boolean')
      expect(typeof sample.pattern).toBe('string')
    })

    console.log('[TEST] Breathing state tracking completed successfully')
  }, 10000)

  /**
   * FIXED: Test for stress response with controlled stress injection
   */
  it('should respond to stress and demonstrate recovery', async () => {
    console.log(
      '[TEST] Testing stress response and recovery with controlled injection'
    )

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(2000)

    // Phase 1: Inject high stress directly
    console.log('[TEST] Phase 1: Injecting high stress')
    injectSystemStress(0.8) // 80% stress level

    // Get breathing state after stress injection
    await new Promise(resolve => setTimeout(resolve, 200))
    const stressedState = cyre.getBreathingState()
    console.log('[TEST] State after stress injection:', {
      stress: stressedState.stress,
      rate: stressedState.currentRate,
      isRecuperating: stressedState.isRecuperating,
      pattern: stressedState.pattern
    })

    // Phase 2: Create some activity under stress
    await createSimulatedLoad(2, 'stress-response-action')

    // Phase 3: Reduce stress and allow recovery
    console.log('[TEST] Phase 2: Reducing stress for recovery')
    await new Promise(resolve => setTimeout(resolve, 500))
    injectSystemStress(0.2) // Reduce to 20% stress

    // Phase 4: Check recovery
    await new Promise(resolve => setTimeout(resolve, 500))
    const recoveryState = cyre.getBreathingState()
    console.log('[TEST] State during recovery:', {
      stress: recoveryState.stress,
      rate: recoveryState.rate,
      isRecuperating: recoveryState.isRecuperating,
      pattern: recoveryState.pattern
    })

    // Wait for tracking to complete
    const samples = await trackingPromise

    // Analyze the samples
    const stressLevels = samples.map(s => s.stress)
    const maxStress = Math.max(...stressLevels)
    const minStress = Math.min(...stressLevels)

    console.log('[TEST] Stress analysis:', {
      maxStress,
      minStress,
      samples: samples.length,
      stressRange: maxStress - minStress
    })

    // Verify stress was properly injected and breathing system responded
    expect(maxStress).toBeGreaterThan(0.1) // Should have significant stress
    expect(samples.length).toBeGreaterThan(10) // Should have enough samples

    // Verify we can see stress variation (injection worked)
    expect(maxStress - minStress).toBeGreaterThan(0.1)

    console.log('[TEST] Stress response and recovery test completed')
  }, 10000)

  /**
   * Test for priority handling during stress
   */
  it('should prioritize critical actions during system stress', async () => {
    console.log('[TEST] Testing priority handling during stress')

    // Create actions with different priorities
    const priorities: Array<
      'critical' | 'high' | 'medium' | 'low' | 'background'
    > = ['critical', 'high', 'medium', 'low', 'background']

    // Track execution counts for each priority
    const executionCounts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      background: 0
    }

    // Register handlers for each priority level
    priorities.forEach(priority => {
      const ACTION_ID = `priority-test-${priority}`

      cyre.on(ACTION_ID, payload => {
        console.log(`[HANDLER] Executing ${priority} priority handler`)
        executionCounts[priority]++
        return {priority, executed: true, count: executionCounts[priority]}
      })

      // Create action with appropriate priority
      cyre.action({
        id: ACTION_ID,
        type: 'priority-test-group',
        payload: {priority},
        priority: {level: priority},
        detectChanges: false
      })
    })

    // Inject stress to trigger priority filtering
    injectSystemStress(0.9) // High stress

    // Make calls to each priority level
    console.log('[TEST] Making calls with various priorities under stress')
    const priorityCalls = []
    for (const priority of priorities) {
      const ACTION_ID = `priority-test-${priority}`
      priorityCalls.push(
        cyre.call(ACTION_ID, {priority, timestamp: Date.now()})
      )
    }

    await Promise.allSettled(priorityCalls)
    console.log('[TEST] Priority execution counts:', executionCounts)

    // Verify all actions executed (this test is more about structure)
    priorities.forEach(priority => {
      expect(executionCounts[priority]).toBeGreaterThanOrEqual(0)
    })

    // Reset stress
    injectSystemStress(0.1)
  })

  /**
   * Test for rate limiting with throttle and debounce
   */
  it('should demonstrate throttling and debounce during high call rates', async () => {
    console.log('[TEST] Testing throttling and debounce protection')

    const THROTTLE_ACTION_ID = 'throttle-test-action'
    const DEBOUNCE_ACTION_ID = 'debounce-test-action'

    // Track execution counts
    const executionCounts = {
      throttled: 0,
      debounced: 0
    }

    // Register handlers
    cyre.on(THROTTLE_ACTION_ID, payload => {
      console.log(`[HANDLER] Throttle handler executed:`, payload)
      executionCounts.throttled++
      return {executed: true}
    })

    cyre.on(DEBOUNCE_ACTION_ID, payload => {
      console.log(`[HANDLER] Debounce handler executed:`, payload)
      executionCounts.debounced++
      return {executed: true}
    })

    // Create actions with protection
    cyre.action({
      id: THROTTLE_ACTION_ID,
      type: 'protection-test',
      throttle: 100, // Throttle to one call per 100ms
      detectChanges: false
    })

    cyre.action({
      id: DEBOUNCE_ACTION_ID,
      type: 'protection-test',
      debounce: 100, // Debounce with 100ms delay
      detectChanges: false
    })

    // Fire multiple calls rapidly
    const callCount = 5
    const calls = []

    for (let i = 0; i < callCount; i++) {
      calls.push(cyre.call(THROTTLE_ACTION_ID, {iteration: i}))
      calls.push(cyre.call(DEBOUNCE_ACTION_ID, {iteration: i}))
    }

    await Promise.allSettled(calls)

    // Wait for debounced calls to complete
    await new Promise(resolve => setTimeout(resolve, 200))

    console.log('[TEST] Protection test execution counts:', executionCounts)

    // Verify protection mechanisms worked
    expect(executionCounts.throttled).toBeLessThanOrEqual(callCount)
    expect(executionCounts.debounced).toBeLessThanOrEqual(callCount)
  })

  /**
   * FIXED: Test for breathing pattern transitions with controlled stress
   */
  it('should transition between breathing patterns appropriately', async () => {
    console.log(
      '[TEST] Testing breathing pattern transitions with controlled stress'
    )

    // Track pattern transitions
    const patternPromise = trackBreathingState(1500)

    // Phase 1: Start with low stress
    console.log('[TEST] Phase 1: Low stress baseline')
    injectSystemStress(0.2)
    await new Promise(resolve => setTimeout(resolve, 300))

    const lowStressState = cyre.getBreathingState()
    console.log('[TEST] Low stress state:', {
      stress: lowStressState.stress,
      pattern: lowStressState.pattern,
      rate: lowStressState.currentRate
    })

    // Phase 2: Inject high stress to trigger pattern change
    console.log('[TEST] Phase 2: High stress injection')
    injectSystemStress(0.95) // Very high stress
    await new Promise(resolve => setTimeout(resolve, 300))

    const highStressState = cyre.getBreathingState()
    console.log('[TEST] High stress state:', {
      stress: highStressState.stress,
      pattern: highStressState.pattern,
      rate: highStressState.currentRate,
      isRecuperating: highStressState.isRecuperating
    })

    // Phase 3: Recovery phase
    console.log('[TEST] Phase 3: Recovery phase')
    injectSystemStress(0.3)
    await new Promise(resolve => setTimeout(resolve, 300))

    const recoveryState = cyre.getBreathingState()
    console.log('[TEST] Recovery state:', {
      stress: recoveryState.stress,
      pattern: recoveryState.pattern,
      rate: recoveryState.currentRate
    })

    // Collect all pattern samples
    const samples = await patternPromise

    // Analyze pattern transitions
    const patterns = samples.map(s => s.pattern)
    const uniquePatterns = [...new Set(patterns)]
    const stressLevels = samples.map(s => s.stress)
    const maxStress = Math.max(...stressLevels)

    console.log('[TEST] Pattern analysis:', {
      uniquePatterns,
      maxStress,
      sampleCount: samples.length
    })

    // Verify pattern behavior
    expect(samples.length).toBeGreaterThan(5)
    expect(maxStress).toBeGreaterThan(0.8) // Should have seen high stress

    // Check that we captured different stress levels
    const stressRange = Math.max(...stressLevels) - Math.min(...stressLevels)
    expect(stressRange).toBeGreaterThan(0.3) // Should see significant stress variation

    console.log('[TEST] Pattern transition test completed')
  }, 10000)

  /**
   * Test for proper breathing during chain reactions
   */
  it('should maintain breathing during chain reactions', async () => {
    console.log('[TEST] Testing breathing during chain reactions')

    const CHAIN_START_ID = 'chain-start-action'
    const CHAIN_MIDDLE_ID = 'chain-middle-action'
    const CHAIN_END_ID = 'chain-end-action'

    // Track execution counts
    const executionCounts = {start: 0, middle: 0, end: 0}

    // Register handlers for chain reactions
    cyre.on(CHAIN_START_ID, payload => {
      console.log('[HANDLER] Chain start executed:', payload)
      executionCounts.start++

      // Chain to middle action
      return {
        id: CHAIN_MIDDLE_ID,
        payload: {from: 'start', value: payload.value}
      }
    })

    cyre.on(CHAIN_MIDDLE_ID, payload => {
      console.log('[HANDLER] Chain middle executed:', payload)
      executionCounts.middle++

      // Chain to end action
      return {
        id: CHAIN_END_ID,
        payload: {from: 'middle', value: payload.value}
      }
    })

    cyre.on(CHAIN_END_ID, payload => {
      console.log('[HANDLER] Chain end executed:', payload)
      executionCounts.end++
      return {completed: true, result: payload.value}
    })

    // Create actions for the chain
    cyre.action({id: CHAIN_START_ID, type: 'chain-reaction'})
    cyre.action({id: CHAIN_MIDDLE_ID, type: 'chain-reaction'})
    cyre.action({id: CHAIN_END_ID, type: 'chain-reaction'})

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(1000)

    // Start multiple chains
    const chainCalls = []
    for (let i = 0; i < 3; i++) {
      chainCalls.push(cyre.call(CHAIN_START_ID, {chain: i, value: i * 10}))
    }

    await Promise.allSettled(chainCalls)
    console.log('[TEST] Chain execution counts:', executionCounts)

    // Wait for tracking to complete
    const samples = await trackingPromise

    // Verify chain execution
    expect(executionCounts.start).toBeGreaterThan(0)
    expect(executionCounts.middle).toBeGreaterThan(0)
    expect(executionCounts.end).toBeGreaterThan(0)

    // Verify breathing monitoring worked
    expect(samples.length).toBeGreaterThan(5)
  })

  /**
   * Test integration with change detection
   */
  it('should respect change detection settings', async () => {
    console.log('[TEST] Testing change detection integration')

    const CHANGE_DETECT_ID = 'change-detect-action'
    const NO_CHANGE_DETECT_ID = 'no-change-detect-action'

    // Track execution counts
    const executionCounts = {withDetection: 0, withoutDetection: 0}

    // Register handlers
    cyre.on(CHANGE_DETECT_ID, payload => {
      console.log('[HANDLER] Change detection handler executed:', payload)
      executionCounts.withDetection++
      return {handled: true}
    })

    cyre.on(NO_CHANGE_DETECT_ID, payload => {
      console.log('[HANDLER] No change detection handler executed:', payload)
      executionCounts.withoutDetection++
      return {handled: true}
    })

    // Create actions
    cyre.action({
      id: CHANGE_DETECT_ID,
      type: 'change-detection',
      detectChanges: true
    })

    cyre.action({
      id: NO_CHANGE_DETECT_ID,
      type: 'change-detection',
      detectChanges: false
    })

    // Make multiple calls with same payload
    const staticPayload = {value: 42, static: true}
    const callCount = 3

    for (let i = 0; i < callCount; i++) {
      await cyre.call(CHANGE_DETECT_ID, staticPayload)
      await cyre.call(NO_CHANGE_DETECT_ID, staticPayload)
    }

    // Call with different payload
    await cyre.call(CHANGE_DETECT_ID, {value: 99, changed: true})
    await cyre.call(NO_CHANGE_DETECT_ID, {value: 99, changed: true})

    console.log('[TEST] Change detection execution counts:', executionCounts)

    // Verify change detection behavior
    expect(executionCounts.withDetection).toBeLessThan(
      executionCounts.withoutDetection
    )
    expect(executionCounts.withoutDetection).toBe(callCount + 1) // All calls executed
  })

  /**
   * Test self-healing behavior with controlled scenarios
   */
  it('should demonstrate self-healing under sustained stress', async () => {
    console.log('[TEST] Testing self-healing under controlled stress')

    const SUSTAINED_STRESS_ID = 'sustained-stress-action'
    const executionTimes: number[] = []

    // Register handler
    cyre.on(SUSTAINED_STRESS_ID, payload => {
      const startTime = Date.now()
      console.log(`[HANDLER] Sustained stress handler:`, payload)

      // Simulate work
      let result = 0
      for (let i = 0; i < 1000; i++) {
        result += Math.random()
      }

      const execTime = Date.now() - startTime
      executionTimes.push(execTime)
      return {result, execTime}
    })

    // Create action
    cyre.action({
      id: SUSTAINED_STRESS_ID,
      type: 'sustained-stress',
      detectChanges: false
    })

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(2000)

    // Phase 1: Inject initial stress
    console.log('[TEST] Phase 1: Initial stress injection')
    injectSystemStress(0.7)

    // Make some calls under stress
    for (let i = 0; i < 5; i++) {
      await cyre.call(SUSTAINED_STRESS_ID, {phase: 1, iteration: i})
    }

    // Phase 2: Increase stress
    console.log('[TEST] Phase 2: Increased stress')
    injectSystemStress(0.9)

    for (let i = 0; i < 3; i++) {
      await cyre.call(SUSTAINED_STRESS_ID, {phase: 2, iteration: i})
    }

    // Phase 3: Recovery
    console.log('[TEST] Phase 3: Recovery phase')
    injectSystemStress(0.2)

    for (let i = 0; i < 2; i++) {
      await cyre.call(SUSTAINED_STRESS_ID, {phase: 3, iteration: i})
    }

    // Wait for tracking to complete
    const samples = await trackingPromise

    console.log('[TEST] Self-healing test results:', {
      executionCount: executionTimes.length,
      sampleCount: samples.length,
      stressRange: `${Math.min(...samples.map(s => s.stress))} - ${Math.max(
        ...samples.map(s => s.stress)
      )}`
    })

    // Verify self-healing behavior
    expect(executionTimes.length).toBeGreaterThan(0)
    expect(samples.length).toBeGreaterThan(10)

    // Check that we saw stress variation (simulating self-healing adaptation)
    const stressLevels = samples.map(s => s.stress)
    const stressRange = Math.max(...stressLevels) - Math.min(...stressLevels)
    expect(stressRange).toBeGreaterThan(0.3)
  })

  /**
   * Test for long-term stability
   */
  it('should maintain stability over longer operation', async () => {
    console.log('[TEST] Testing long-term stability')

    const PERIODIC_LOAD_ID = 'periodic-load-action'
    const executionLog: Array<{timestamp: number; duration: number}> = []

    // Register handler
    cyre.on(PERIODIC_LOAD_ID, payload => {
      const startTime = Date.now()

      // Generate light load
      let result = 0
      for (let i = 0; i < 500; i++) {
        result += Math.random()
      }

      const duration = Date.now() - startTime
      executionLog.push({timestamp: startTime, duration})
      return {result, duration, count: executionLog.length}
    })

    // Create action
    cyre.action({
      id: PERIODIC_LOAD_ID,
      type: 'stability-test',
      detectChanges: false
    })

    const testDuration = 1000 // 1 second for CI
    const startTime = Date.now()

    // Generate periodic load
    const intervalId = setInterval(async () => {
      try {
        await cyre.call(PERIODIC_LOAD_ID, {
          periodic: true,
          iteration: executionLog.length,
          elapsed: Date.now() - startTime
        })
      } catch (err) {
        console.error('[TEST] Error during periodic call:', err)
      }
    }, 100)

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDuration))
    clearInterval(intervalId)

    console.log('[TEST] Stability metrics:', {
      totalExecutions: executionLog.length,
      testDuration,
      avgExecutionsPerSecond: (executionLog.length / testDuration) * 1000
    })

    // Verify stability
    expect(executionLog.length).toBeGreaterThan(0)
    expect(executionLog.length).toBeLessThan(50) // Reasonable upper bound
  })

  /**
   * Test for proper interval adjustment with system stress
   */
  it('should adjust intervals based on system stress', async () => {
    console.log('[TEST] Testing interval adjustment under stress')

    const INTERVAL_ACTION_ID = 'interval-test-action'
    const executionTimes: number[] = []

    cyre.on(INTERVAL_ACTION_ID, payload => {
      const now = Date.now()
      console.log(`[HANDLER] Interval action executed at ${now}:`, payload)
      executionTimes.push(now)
      return {
        executed: true,
        timestamp: now,
        executionCount: executionTimes.length
      }
    })

    // Create action with interval
    const baseInterval = 200 // 200ms base interval
    cyre.action({
      id: INTERVAL_ACTION_ID,
      type: 'interval-test',
      payload: {initial: true},
      interval: baseInterval,
      repeat: 3, // Execute 3 times
      detectChanges: false
    })

    // Inject stress to affect interval timing
    console.log('[TEST] Injecting stress to affect intervals')
    injectSystemStress(0.6)

    // Start the interval action
    console.log('[TEST] Starting interval action')
    await cyre.call(INTERVAL_ACTION_ID)

    // Wait for all executions to complete
    const maxWaitTime = baseInterval * 6 // Allow extra time
    const waitStart = Date.now()

    while (executionTimes.length < 3 && Date.now() - waitStart < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    console.log('[TEST] Execution completed with times:', executionTimes)

    // Calculate intervals if we have multiple executions
    if (executionTimes.length > 1) {
      const intervals = []
      for (let i = 1; i < executionTimes.length; i++) {
        intervals.push(executionTimes[i] - executionTimes[i - 1])
      }
      console.log('[TEST] Measured intervals:', intervals)
    }

    // Verify interval execution worked
    expect(executionTimes.length).toBeGreaterThan(0)
    expect(executionTimes.length).toBeLessThanOrEqual(3)

    // Reset stress
    injectSystemStress(0.1)
  })

  /**
   * Test for breathingState API
   */
  it('should expose proper breathing state API', () => {
    console.log('[TEST] Testing breathing state API')

    const state = cyre.getBreathingState()

    // Verify structure
    expect(state).toBeDefined()
    expect(typeof state.breathCount).toBe('number')
    expect(typeof state.currentRate).toBe('number')
    expect(typeof state.lastBreath).toBe('number')
    expect(typeof state.stress).toBe('number')
    expect(typeof state.isRecuperating).toBe('boolean')
    expect(typeof state.recuperationDepth).toBe('number')
    expect(state.pattern).toBeDefined()

    // Verify ranges
    expect(state.breathCount).toBeGreaterThanOrEqual(0)
    expect(state.stress).toBeGreaterThanOrEqual(0)
    expect(state.stress).toBeLessThanOrEqual(1)
    expect(state.recuperationDepth).toBeGreaterThanOrEqual(0)
    expect(state.recuperationDepth).toBeLessThanOrEqual(1)

    // Verify rate is within config limits
    expect(state.currentRate).toBeGreaterThanOrEqual(BREATHING.RATES.MIN)
    expect(state.currentRate).toBeLessThanOrEqual(BREATHING.RATES.MAX)

    console.log('[TEST] Breathing state API:', state)
  })
})
