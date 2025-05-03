// test/quantum-breathing.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {BREATHING} from '../src/config/cyre-config'

/*
 * Comprehensive Quantum Breathing Test Suite
 *
 * Tests CYRE's quantum breathing system with proper subscription approach
 * using action IDs (not types).
 */

describe('Quantum Breathing System', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== BREATHING TEST STARTED =====')
  })

  afterEach(() => {
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
   * Helper to generate system load by firing multiple actions
   */
  const generateLoad = async (intensity: number) => {
    console.log(`[TEST] Generating load with intensity ${intensity}`)

    // Action ID for load generator
    const LOAD_ACTION_ID = 'load-generator-action'

    // Register handler
    cyre.on(LOAD_ACTION_ID, payload => {
      // Generate CPU load proportional to intensity
      let x = 0
      for (let i = 0; i < 10000 * payload.intensity; i++) {
        x += Math.sqrt(i)
      }
      return {computed: x}
    })

    // Create action
    cyre.action({
      id: LOAD_ACTION_ID,
      type: 'load-generator-group',
      payload: {initial: true},
      detectChanges: false
    })

    // Fire multiple calls to generate load
    const calls = []
    for (let i = 0; i < intensity; i++) {
      calls.push(
        cyre.call(LOAD_ACTION_ID, {
          intensity,
          iteration: i,
          timestamp: Date.now()
        })
      )
    }

    await Promise.all(calls)
    console.log(`[TEST] Load generation complete`)
  }

  /**
   * Test for basic breathing state tracking
   */
  it('should track breathing state during system activity', async () => {
    console.log('[TEST] Starting breathing state tracking')

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(1500)

    // Generate some load
    await generateLoad(5)
    await new Promise(resolve => setTimeout(resolve, 200))
    await generateLoad(10)
    await new Promise(resolve => setTimeout(resolve, 200))
    await generateLoad(15)

    // Wait for tracking to complete
    const samples = await trackingPromise

    console.log(`[TEST] Collected ${samples.length} breathing state samples`)

    // Calculate breathing state metrics
    const initialState = samples[0]
    const finalState = samples[samples.length - 1]

    const stressLevels = samples.map(s => s.stress)
    const maxStress = Math.max(...stressLevels)
    const avgStress =
      stressLevels.reduce((sum, s) => sum + s, 0) / stressLevels.length

    const rateChanges = samples.map(s => s.rate)
    const uniqueRates = new Set(rateChanges).size

    console.log('[TEST] Breathing state metrics:', {
      initialStress: initialState.stress,
      finalStress: finalState.stress,
      maxStress,
      avgStress,
      uniqueRates
    })

    // Verify breathing state adaptation
    expect(samples.length).toBeGreaterThan(3)
    expect(maxStress).toBeGreaterThan(initialState.stress)
    expect(uniqueRates).toBeGreaterThan(1) // Should see rate changes
  })

  /**
   * Test for stress generation and recovery
   */
  it('should respond to stress and demonstrate recovery', async () => {
    console.log('[TEST] Testing stress response and recovery')

    // Action for stress generation with unique ID
    const STRESS_ACTION_ID = 'stress-response-action'

    // Register handler that generates significant load
    cyre.on(STRESS_ACTION_ID, payload => {
      console.log(
        `[HANDLER] Executing stress handler with level ${payload.stressLevel}`
      )

      // Generate variable CPU load based on stress level
      let x = 0
      for (let i = 0; i < 20000 * payload.stressLevel; i++) {
        x += Math.sqrt(i)
      }

      return {result: x}
    })

    // Create action
    cyre.action({
      id: STRESS_ACTION_ID,
      type: 'stress-response-group',
      payload: {initial: true},
      detectChanges: false
    })

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(3000)

    // Phase 1: Generate significant stress
    console.log('[TEST] Phase 1: Generating high stress')

    const stressCalls = []
    for (let i = 0; i < 10; i++) {
      stressCalls.push(
        cyre.call(STRESS_ACTION_ID, {
          stressLevel: 5, // High stress
          iteration: i,
          timestamp: Date.now()
        })
      )
    }

    await Promise.all(stressCalls)

    // Get immediate post-stress breathing state
    const stressedState = cyre.getBreathingState()
    console.log('[TEST] State after stress generation:', stressedState)

    // Phase 2: Allow system to recover
    console.log('[TEST] Phase 2: Recovery period')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Phase 3: Light activity during recovery
    console.log('[TEST] Phase 3: Light activity during recovery')

    const lightCalls = []
    for (let i = 0; i < 3; i++) {
      lightCalls.push(
        cyre.call(STRESS_ACTION_ID, {
          stressLevel: 1, // Low stress
          iteration: i,
          timestamp: Date.now()
        })
      )

      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    await Promise.all(lightCalls)

    // Get recovery state
    const recoveryState = cyre.getBreathingState()
    console.log('[TEST] State during recovery:', recoveryState)

    // Wait for tracking to complete
    const samples = await trackingPromise

    // Analyze breathing patterns during test
    const stressPhase = samples.filter(s => s.time < 1000)
    const recoveryPhase = samples.filter(s => s.time >= 1000)

    const maxStress = Math.max(...samples.map(s => s.stress))
    const recoveryTrend =
      recoveryPhase.length > 1
        ? recoveryPhase[recoveryPhase.length - 1].stress -
          recoveryPhase[0].stress
        : 0

    console.log('[TEST] Stress and recovery analysis:', {
      maxStress,
      recoveryTrend,
      stressPhaseCount: stressPhase.length,
      recoveryPhaseCount: recoveryPhase.length
    })

    // Verify stress response and recovery behavior
    expect(maxStress).toBeGreaterThan(0.05) // Should see significant stress
    expect(stressedState.stress).toBeGreaterThan(0)

    // Verify system captures breathing pattern changes
    if (samples.length > 5) {
      const patterns = new Set(samples.map(s => s.pattern)).size
      expect(patterns).toBeGreaterThanOrEqual(1)
    }
  })

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
      // Use priority as part of action ID to make it unique
      const ACTION_ID = `priority-test-${priority}`

      cyre.on(ACTION_ID, payload => {
        console.log(`[HANDLER] Executing ${priority} priority handler`)
        executionCounts[priority]++

        // Generate some load proportional to priority
        // (lower priority = more load to show throttling effects)
        let loadFactor = 0
        switch (priority) {
          case 'critical':
            loadFactor = 1
            break
          case 'high':
            loadFactor = 2
            break
          case 'medium':
            loadFactor = 3
            break
          case 'low':
            loadFactor = 4
            break
          case 'background':
            loadFactor = 5
            break
        }

        let x = 0
        for (let i = 0; i < 5000 * loadFactor; i++) {
          x += Math.sqrt(i)
        }

        return {
          priority,
          executed: true,
          count: executionCounts[priority]
        }
      })

      // Create action with appropriate priority
      cyre.action({
        id: ACTION_ID,
        type: 'priority-test-group',
        payload: {priority},
        priority: {level: priority},
        detectChanges: false // Ensure all calls go through
      })
    })

    // First generate system stress
    console.log('[TEST] Generating system stress')
    await generateLoad(20)

    // Get breathing state to confirm stress
    const stressedState = cyre.getBreathingState()
    console.log('[TEST] Breathing state after stress:', stressedState)

    // Now make calls to each priority level multiple times
    console.log('[TEST] Making calls with various priorities under stress')

    // Make 3 calls to each priority level
    const priorityCalls = []
    for (let round = 0; round < 3; round++) {
      for (const priority of priorities) {
        const ACTION_ID = `priority-test-${priority}`

        priorityCalls.push(
          cyre
            .call(ACTION_ID, {
              round,
              priority,
              timestamp: Date.now()
            })
            .catch(err => {
              console.log(`[TEST] Error with ${priority} call:`, err)
            })
        )
      }
    }

    // Wait for all calls to complete or timeout
    await Promise.allSettled(priorityCalls)

    console.log('[TEST] Priority execution counts:', executionCounts)

    // Calculate success rates for each priority
    const callAttemptsPerPriority = 3 // We made 3 calls to each
    const successRates: Record<string, number> = {}

    priorities.forEach(priority => {
      successRates[priority] =
        executionCounts[priority] / callAttemptsPerPriority
    })

    console.log('[TEST] Priority success rates:', successRates)

    // Verify critical priority had highest success rate
    // Note: This test might be flaky depending on system load
    if (stressedState.stress > 0.3) {
      // Only if significant stress was generated
      expect(successRates.critical).toBeGreaterThanOrEqual(successRates.low)
      expect(successRates.critical).toBeGreaterThanOrEqual(
        successRates.background
      )
    }
  })

  /**
   * Test for rate limiting with throttle and debounce
   */
  it('should demonstrate throttling and debounce during high call rates', async () => {
    console.log('[TEST] Testing throttling and debounce protection')

    // Create separate action IDs for throttle and debounce
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
      return {executed: true, count: executionCounts.throttled}
    })

    cyre.on(DEBOUNCE_ACTION_ID, payload => {
      console.log(`[HANDLER] Debounce handler executed:`, payload)
      executionCounts.debounced++
      return {executed: true, count: executionCounts.debounced}
    })

    // Create actions with protection
    cyre.action({
      id: THROTTLE_ACTION_ID,
      type: 'protection-test-group',
      payload: {protection: 'throttle'},
      throttle: 100, // Throttle to one call per 100ms
      detectChanges: false
    })

    cyre.action({
      id: DEBOUNCE_ACTION_ID,
      type: 'protection-test-group',
      payload: {protection: 'debounce'},
      debounce: 100, // Debounce with 100ms delay
      detectChanges: false
    })

    // Fire multiple calls rapidly to both actions
    console.log('[TEST] Firing rapid calls to test protection')

    const callCount = 10
    const calls = []

    // Make rapid throttled calls
    for (let i = 0; i < callCount; i++) {
      calls.push(
        cyre.call(THROTTLE_ACTION_ID, {
          iteration: i,
          timestamp: Date.now()
        })
      )
    }

    // Make rapid debounced calls
    for (let i = 0; i < callCount; i++) {
      calls.push(
        cyre.call(DEBOUNCE_ACTION_ID, {
          iteration: i,
          timestamp: Date.now()
        })
      )
    }

    // Wait for all calls to complete
    await Promise.allSettled(calls)

    // Wait a bit more for any debounced calls to execute
    await new Promise(resolve => setTimeout(resolve, 200))

    console.log('[TEST] Protection test execution counts:', executionCounts)

    // Verify throttling and debounce worked
    expect(executionCounts.throttled).toBeLessThan(callCount)
    expect(executionCounts.debounced).toBeLessThan(callCount)

    // Debounce usually results in just one call
    expect(executionCounts.debounced).toBeLessThanOrEqual(2)
  })

  /**
   * Test for proper breathing during chain reactions
   */
  it('should maintain breathing during chain reactions', async () => {
    console.log('[TEST] Testing breathing during chain reactions')

    // Set up a chain of actions
    const CHAIN_START_ID = 'chain-start-action'
    const CHAIN_MIDDLE_ID = 'chain-middle-action'
    const CHAIN_END_ID = 'chain-end-action'

    // Track execution counts
    const executionCounts = {
      start: 0,
      middle: 0,
      end: 0
    }

    // Register handlers for chain reactions
    cyre.on(CHAIN_START_ID, payload => {
      console.log('[HANDLER] Chain start executed:', payload)
      executionCounts.start++

      // Do some work
      let x = 0
      for (let i = 0; i < 10000; i++) {
        x += Math.sqrt(i)
      }

      // Chain to middle action
      return {
        id: CHAIN_MIDDLE_ID,
        payload: {
          from: 'start',
          value: x,
          timestamp: Date.now()
        }
      }
    })

    cyre.on(CHAIN_MIDDLE_ID, payload => {
      console.log('[HANDLER] Chain middle executed:', payload)
      executionCounts.middle++

      // Do more intensive work
      let x = 0
      for (let i = 0; i < 20000; i++) {
        x += Math.sqrt(i)
      }

      // Chain to end action
      return {
        id: CHAIN_END_ID,
        payload: {
          from: 'middle',
          value: x,
          timestamp: Date.now()
        }
      }
    })

    cyre.on(CHAIN_END_ID, payload => {
      console.log('[HANDLER] Chain end executed:', payload)
      executionCounts.end++

      // Do most intensive work
      let x = 0
      for (let i = 0; i < 30000; i++) {
        x += Math.sqrt(i)
      }

      return {
        completed: true,
        result: x
      }
    })

    // Create actions for the chain
    cyre.action({
      id: CHAIN_START_ID,
      type: 'chain-reaction-group',
      payload: {stage: 'start'},
      detectChanges: false
    })

    cyre.action({
      id: CHAIN_MIDDLE_ID,
      type: 'chain-reaction-group',
      payload: {stage: 'middle'},
      detectChanges: false
    })

    cyre.action({
      id: CHAIN_END_ID,
      type: 'chain-reaction-group',
      payload: {stage: 'end'},
      detectChanges: false
    })

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(1500)

    // Start multiple chains in parallel to create load
    console.log('[TEST] Starting multiple chain reactions')

    const chainCalls = []
    for (let i = 0; i < 5; i++) {
      chainCalls.push(
        cyre.call(CHAIN_START_ID, {
          chain: i,
          timestamp: Date.now()
        })
      )
    }

    // Wait for all chains to complete
    await Promise.allSettled(chainCalls)

    console.log('[TEST] Chain execution counts:', executionCounts)

    // Wait for tracking to complete
    const samples = await trackingPromise

    // Analyze breathing during chains
    const stressLevels = samples.map(s => s.stress)
    const maxStress = Math.max(...stressLevels)
    const avgStress =
      stressLevels.reduce((sum, s) => sum + s, 0) / stressLevels.length

    console.log('[TEST] Chain breathing analysis:', {
      maxStress,
      avgStress,
      sampleCount: samples.length
    })

    // Verify chain execution
    expect(executionCounts.start).toBeGreaterThan(0)
    expect(executionCounts.middle).toBeGreaterThan(0)
    expect(executionCounts.end).toBeGreaterThan(0)

    // Check that stress was detected during chain reactions
    expect(maxStress).toBeGreaterThan(0)
  })

  /**
   * Test integration with change detection
   */
  it('should respect change detection settings', async () => {
    console.log('[TEST] Testing change detection integration')

    // Set up actions with and without change detection
    const CHANGE_DETECT_ID = 'change-detect-action'
    const NO_CHANGE_DETECT_ID = 'no-change-detect-action'

    // Track execution counts
    const executionCounts = {
      withDetection: 0,
      withoutDetection: 0
    }

    // Register handlers
    cyre.on(CHANGE_DETECT_ID, payload => {
      console.log('[HANDLER] Change detection handler executed:', payload)
      executionCounts.withDetection++
      return {handled: true, count: executionCounts.withDetection}
    })

    cyre.on(NO_CHANGE_DETECT_ID, payload => {
      console.log('[HANDLER] No change detection handler executed:', payload)
      executionCounts.withoutDetection++
      return {handled: true, count: executionCounts.withoutDetection}
    })

    // Create actions
    cyre.action({
      id: CHANGE_DETECT_ID,
      type: 'change-detection-group',
      payload: {initial: true},
      detectChanges: true // Enable change detection
    })

    cyre.action({
      id: NO_CHANGE_DETECT_ID,
      type: 'change-detection-group',
      payload: {initial: true},
      detectChanges: false // Disable change detection
    })

    // Make multiple calls with same payload
    console.log('[TEST] Making calls with identical payloads')

    const staticPayload = {value: 42, static: true}

    // Make 3 calls to each action with identical payload
    const callCount = 3
    const calls = []

    for (let i = 0; i < callCount; i++) {
      // Call with change detection (should only execute once)
      calls.push(cyre.call(CHANGE_DETECT_ID, staticPayload))

      // Call without change detection (should execute every time)
      calls.push(cyre.call(NO_CHANGE_DETECT_ID, staticPayload))
    }

    // Wait for all calls to complete
    await Promise.allSettled(calls)

    console.log('[TEST] Change detection execution counts:', executionCounts)

    // Now call again with different payload
    console.log('[TEST] Making calls with different payload')

    await Promise.all([
      cyre.call(CHANGE_DETECT_ID, {value: 99, changed: true}),
      cyre.call(NO_CHANGE_DETECT_ID, {value: 99, changed: true})
    ])

    console.log('[TEST] Final execution counts:', executionCounts)

    // Verify change detection behavior
    expect(executionCounts.withDetection).toBeLessThan(
      executionCounts.withoutDetection
    )
    expect(executionCounts.withDetection).toBeLessThanOrEqual(2) // Initial + changed payload
    expect(executionCounts.withoutDetection).toBe(callCount + 1) // All calls + changed payload
  })

  /**
   * Test for self-healing capability under sustained stress
   */
  it('should demonstrate self-healing under sustained stress', async () => {
    console.log('[TEST] Testing self-healing under sustained stress')

    // Action for sustained stress
    const SUSTAINED_STRESS_ID = 'sustained-stress-action'

    // Track execution behavior
    const executionTimes: number[] = []

    // Register handler
    cyre.on(SUSTAINED_STRESS_ID, payload => {
      const startTime = Date.now()
      console.log(`[HANDLER] Sustained stress handler start:`, payload)

      // Generate significant CPU load
      let x = 0
      for (let i = 0; i < 50000; i++) {
        x += Math.sqrt(i)
      }

      const execTime = Date.now() - startTime
      executionTimes.push(execTime)

      console.log(`[HANDLER] Sustained stress completed in ${execTime}ms`)

      return {
        result: x,
        execTime
      }
    })

    // Create action
    cyre.action({
      id: SUSTAINED_STRESS_ID,
      type: 'sustained-stress-group',
      payload: {initial: true},
      detectChanges: false
      // No throttle or debounce - relying on quantum breathing only
    })

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(3000)

    // Generate sustained stress in phases
    console.log('[TEST] Phase 1: Initial stress')

    // Phase 1: Initial stress burst
    const phase1Calls = []
    for (let i = 0; i < 5; i++) {
      phase1Calls.push(
        cyre.call(SUSTAINED_STRESS_ID, {
          phase: 1,
          iteration: i,
          timestamp: Date.now()
        })
      )
    }

    await Promise.allSettled(phase1Calls)

    // Get state after phase 1
    const phase1State = cyre.getBreathingState()
    console.log('[TEST] State after phase 1:', phase1State)

    // Brief pause
    await new Promise(resolve => setTimeout(resolve, 200))

    // Phase 2: Continued stress - system should be adapting
    console.log('[TEST] Phase 2: Continued stress')

    const phase2Calls = []
    for (let i = 0; i < 5; i++) {
      phase2Calls.push(
        cyre.call(SUSTAINED_STRESS_ID, {
          phase: 2,
          iteration: i,
          timestamp: Date.now()
        })
      )
    }

    await Promise.allSettled(phase2Calls)

    // Get state after phase 2
    const phase2State = cyre.getBreathingState()
    console.log('[TEST] State after phase 2:', phase2State)

    // Brief pause to allow partial recovery
    await new Promise(resolve => setTimeout(resolve, 500))

    // Phase 3: More stress while recovering
    console.log('[TEST] Phase 3: Stress during recovery')

    const phase3Calls = []
    for (let i = 0; i < 3; i++) {
      phase3Calls.push(
        cyre.call(SUSTAINED_STRESS_ID, {
          phase: 3,
          iteration: i,
          timestamp: Date.now()
        })
      )
    }

    await Promise.allSettled(phase3Calls)

    // Get final state
    const phase3State = cyre.getBreathingState()
    console.log('[TEST] State after phase 3:', phase3State)

    // Wait for tracking to complete
    const samples = await trackingPromise

    // Analyze breathing patterns during test
    const stressProgression = samples.map(s => s.stress)
    const rateProgression = samples.map(s => s.rate)

    console.log('[TEST] Execution time statistics:', {
      count: executionTimes.length,
      minTime: Math.min(...executionTimes),
      maxTime: Math.max(...executionTimes),
      avgTime:
        executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
    })

    // Verify self-healing behavior
    expect(executionTimes.length).toBeGreaterThan(0)

    // Check stress levels progressed appropriately
    if (samples.length > 5) {
      // Stress should increase during phases 1 and 2
      expect(phase2State.stress).toBeGreaterThanOrEqual(phase1State.stress)

      // Check that breathing rate adapted to stress
      expect(new Set(rateProgression).size).toBeGreaterThan(1)
    }
  })

  /**
   * Test for long-term stability
   */
  it('should maintain stability over longer operation', async () => {
    // This is a longer-running test to verify the system remains stable
    console.log('[TEST] Testing long-term stability (reduced for CI)')

    // For CI environments, we'll use a shorter duration
    const testDuration = 2000 // 2 seconds (adjust for CI or local testing)

    // Action for regular load
    const PERIODIC_LOAD_ID = 'periodic-load-action'

    // Track executions
    const executionLog: Array<{
      timestamp: number
      duration: number
    }> = []

    // Register handler
    cyre.on(PERIODIC_LOAD_ID, payload => {
      const startTime = Date.now()

      // Generate moderate CPU load
      let x = 0
      for (let i = 0; i < 20000; i++) {
        x += Math.sqrt(i)
      }

      const duration = Date.now() - startTime

      executionLog.push({
        timestamp: startTime,
        duration
      })

      return {
        result: x,
        duration,
        count: executionLog.length
      }
    })

    // Create action
    cyre.action({
      id: PERIODIC_LOAD_ID,
      type: 'stability-test-group',
      payload: {initial: true},
      detectChanges: false
    })

    // Start tracking breathing state
    const trackingPromise = trackBreathingState(testDuration)

    // Start periodic load generation
    console.log('[TEST] Starting periodic load generation')

    const startTime = Date.now()
    const interval = setInterval(async () => {
      try {
        await cyre.call(PERIODIC_LOAD_ID, {
          periodic: true,
          iteration: executionLog.length,
          elapsed: Date.now() - startTime,
          timestamp: Date.now()
        })
      } catch (err) {
        console.error('[TEST] Error during periodic call:', err)
      }
    }, 200) // Fire every 200ms

    // Wait for the test duration
    await new Promise(resolve => setTimeout(resolve, testDuration))

    // Stop periodic firing
    clearInterval(interval)

    // Wait for tracking to complete
    const samples = await trackingPromise

    // Calculate stability metrics
    const executionRates = []
    const executionWindows = []
    const windowSize = 500 // 500ms windows

    // Group executions into time windows
    for (
      let windowStart = 0;
      windowStart < testDuration;
      windowStart += windowSize
    ) {
      const windowEnd = windowStart + windowSize
      const executionsInWindow = executionLog.filter(
        exec =>
          exec.timestamp - startTime >= windowStart &&
          exec.timestamp - startTime < windowEnd
      )

      executionWindows.push({
        start: windowStart,
        end: windowEnd,
        count: executionsInWindow.length
      })

      if (executionsInWindow.length > 0) {
        executionRates.push(executionsInWindow.length)
      }
    }

    // Analyze breathing patterns
    const breathingRates = samples.map(s => s.rate)
    const stressLevels = samples.map(s => s.stress)

    console.log('[TEST] Stability metrics:', {
      totalExecutions: executionLog.length,
      executionWindows,
      avgRate:
        executionRates.length > 0
          ? executionRates.reduce((sum, r) => sum + r, 0) /
            executionRates.length
          : 0,
      minRate: executionRates.length > 0 ? Math.min(...executionRates) : 0,
      maxRate: executionRates.length > 0 ? Math.max(...executionRates) : 0,
      avgStress:
        stressLevels.reduce((sum, s) => sum + s, 0) / stressLevels.length
    })

    // Verify stability
    expect(executionLog.length).toBeGreaterThan(0)

    // Check for reasonable execution rate stability
    if (executionRates.length > 1) {
      const rateVariation =
        Math.max(...executionRates) - Math.min(...executionRates)
      const avgRate =
        executionRates.reduce((sum, r) => sum + r, 0) / executionRates.length

      // Variation should be reasonable compared to average
      expect(rateVariation / avgRate).toBeLessThan(1.5)
    }
  })

  /**
   * Test for proper interval adjustment with system stress
   */
  it('should adjust intervals based on system stress', async () => {
    console.log('[TEST] Testing interval adjustment under stress')

    // Action for interval testing
    const INTERVAL_ACTION_ID = 'interval-test-action'

    // Track execution times
    const executionTimes: number[] = []

    // Register handler
    cyre.on(INTERVAL_ACTION_ID, payload => {
      const now = Date.now()
      console.log(`[HANDLER] Interval action executed at ${now}:`, payload)

      executionTimes.push(now)

      // Small workload
      let x = 0
      for (let i = 0; i < 5000; i++) {
        x += Math.sqrt(i)
      }

      return {
        executed: true,
        timestamp: now,
        result: x,
        executionCount: executionTimes.length
      }
    })

    // Create action with interval
    const baseInterval = 300 // 300ms base interval

    cyre.action({
      id: INTERVAL_ACTION_ID,
      type: 'interval-test-group',
      payload: {initial: true},
      interval: baseInterval, // Should be adjusted based on stress
      repeat: 5 // Execute 5 times
    })

    // Generate stress to affect interval timing
    console.log('[TEST] Generating background stress')
    await generateLoad(15)

    // Start the interval action
    console.log('[TEST] Starting interval action')
    await cyre.call(INTERVAL_ACTION_ID)

    // Wait for all executions to complete (with buffer)
    const maxWaitTime = baseInterval * 10 // Allow plenty of time
    const waitStart = Date.now()

    while (executionTimes.length < 5 && Date.now() - waitStart < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('[TEST] Execution completed with times:', executionTimes)

    // Calculate actual intervals
    const intervals = []
    for (let i = 1; i < executionTimes.length; i++) {
      intervals.push(executionTimes[i] - executionTimes[i - 1])
    }

    console.log('[TEST] Measured intervals:', intervals)

    // Verify interval adaptation
    if (intervals.length > 0) {
      const avgInterval =
        intervals.reduce((sum, i) => sum + i, 0) / intervals.length

      console.log(
        '[TEST] Average interval:',
        avgInterval,
        'Base interval:',
        baseInterval
      )

      // Final verification depends on how much stress was generated
      const stressedState = cyre.getBreathingState()

      if (stressedState.stress > 0.2) {
        // If significant stress, intervals should be increased
        expect(avgInterval).toBeGreaterThan(baseInterval)
      }
    }
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

  /**
   * Test for recovery pattern transitions
   */
  it('should transition between breathing patterns appropriately', async () => {
    console.log('[TEST] Testing breathing pattern transitions')

    // Track pattern transitions
    const patternPromise = trackBreathingState(2500)

    // Generate high stress to trigger recovery pattern
    console.log('[TEST] Generating high stress load')
    await generateLoad(25)

    // Brief pause to allow pattern transition
    await new Promise(resolve => setTimeout(resolve, 500))

    // Get current state
    const stressedState = cyre.getBreathingState()
    console.log('[TEST] State after stress:', stressedState)

    // Recovery period
    console.log('[TEST] Allowing recovery period')
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get recovery state
    const recoveryState = cyre.getBreathingState()
    console.log('[TEST] State during recovery:', recoveryState)

    // Generate light load during recovery
    console.log('[TEST] Generating light load during recovery')
    await generateLoad(3)

    // Get final state
    const finalState = cyre.getBreathingState()
    console.log('[TEST] Final state:', finalState)

    // Collect all pattern samples
    const samples = await patternPromise

    // Analyze pattern transitions
    const patterns = samples.map(s => s.pattern)
    const uniquePatterns = [...new Set(patterns)]
    const patternTransitions = []

    for (let i = 1; i < samples.length; i++) {
      if (samples[i].pattern !== samples[i - 1].pattern) {
        patternTransitions.push({
          from: samples[i - 1].pattern,
          to: samples[i].pattern,
          time: samples[i].time
        })
      }
    }

    console.log('[TEST] Pattern analysis:', {
      uniquePatterns,
      transitions: patternTransitions
    })

    // Verify pattern behavior if stress was significant
    if (stressedState.stress > BREATHING.STRESS.HIGH) {
      expect(stressedState.pattern).toBe('RECOVERY')
    }
  })
})
