// src/test/quantum-breathing-resilience.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {BREATHING} from '../src/config/cyre-config'

/*
 * Quantum Breathing Resilience Test
 *
 * This test evaluates Cyre's quantum breathing system under prolonged stress,
 * focusing on recuperation behavior, rate adaptation, and multi-priority execution.
 * It demonstrates the system's ability to self-regulate while maintaining
 * operation of critical processes even during high system stress.
 */

describe('Quantum Breathing Resilience', () => {
  // Test configuration
  const TEST_DURATION = 60_000 // 1 minute
  const BREATHING_SAMPLE_INTERVAL = 500 // Sample every 500ms

  // Track breathing patterns
  type BreathingSnapshot = {
    timestamp: number
    breathCount: number
    rate: number
    stress: number
    isRecuperating: boolean
    pattern: string
  }

  // Track execution flow by priority
  type ExecutionRecord = {
    timestamp: number
    priority: string
    stress: number
    timeSinceLastExecution: number
    duration: number
  }

  // Shared test state
  let breathingSnapshots: BreathingSnapshot[] = []
  let executionRecords: Record<string, ExecutionRecord[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    background: []
  }
  let monitorInterval: NodeJS.Timer
  let startTime: number
  let lastExecutionTime: Record<string, number> = {}
  let systemStabilized = false

  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize test state
    breathingSnapshots = []
    executionRecords = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      background: []
    }
    lastExecutionTime = {}
    systemStabilized = false
    startTime = Date.now()

    // Initialize cyre
    cyre.initialize()

    console.log('===== QUANTUM BREATHING RESILIENCE TEST STARTED =====')
  })

  afterEach(() => {
    // Clean up monitoring
    if (monitorInterval) {
      clearInterval(monitorInterval)
    }

    // Log test summary
    const totalExecutions = Object.values(executionRecords).reduce(
      (sum, records) => sum + records.length,
      0
    )

    console.log(`Test completed with ${totalExecutions} total executions`)
    console.log(`Collected ${breathingSnapshots.length} breathing samples`)

    console.log('===== QUANTUM BREATHING RESILIENCE TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  // Utility: Track breathing patterns over time
  const monitorBreathingSystem = () => {
    return setInterval(() => {
      const breathingState = cyre.getBreathingState()
      const elapsed = Date.now() - startTime

      breathingSnapshots.push({
        timestamp: elapsed,
        breathCount: breathingState.breathCount,
        rate: breathingState.currentRate,
        stress: breathingState.stress,
        isRecuperating: breathingState.isRecuperating,
        pattern: breathingState.pattern
      })

      // Track recuperation transitions
      const previousSnapshot = breathingSnapshots[breathingSnapshots.length - 2]
      if (
        previousSnapshot &&
        previousSnapshot.isRecuperating !== breathingState.isRecuperating
      ) {
        console.log(
          `[${elapsed}ms] Recuperation state changed: ${
            breathingState.isRecuperating ? 'STARTED' : 'ENDED'
          } (stress: ${(breathingState.stress * 100).toFixed(1)}%)`
        )
      }

      // Track breathing pattern changes
      if (
        previousSnapshot &&
        previousSnapshot.pattern !== breathingState.pattern
      ) {
        console.log(
          `[${elapsed}ms] Breathing pattern changed: ${
            previousSnapshot.pattern
          } → ${breathingState.pattern} (stress: ${(
            breathingState.stress * 100
          ).toFixed(1)}%)`
        )
      }

      // Detect when system has stabilized post-stress
      if (
        !systemStabilized &&
        breathingSnapshots.length > 10 &&
        !breathingState.isRecuperating &&
        breathingState.stress < BREATHING.STRESS.LOW
      ) {
        // Check if stress has been low for the last few samples
        const recentSnapshots = breathingSnapshots.slice(-5)
        const allLowStress = recentSnapshots.every(
          s => s.stress < BREATHING.STRESS.LOW && !s.isRecuperating
        )

        if (allLowStress) {
          systemStabilized = true
          console.log(
            `[${elapsed}ms] System has STABILIZED (stress: ${(
              breathingState.stress * 100
            ).toFixed(1)}%)`
          )
        }
      }
    }, BREATHING_SAMPLE_INTERVAL)
  }

  // Utility: Create a timer with a specific priority and workload
  const createPriorityTimer = (
    priority: 'critical' | 'high' | 'medium' | 'low' | 'background',
    interval: number,
    workload: number = 1
  ) => {
    const id = `${priority}-timer-${interval}`

    // Record initial execution time
    lastExecutionTime[priority] = Date.now()

    // Register handler
    cyre.on(id, () => {
      const now = Date.now()
      const elapsed = now - startTime
      const timeSinceLastExecution = now - (lastExecutionTime[priority] || now)
      lastExecutionTime[priority] = now

      const startExecution = Date.now()

      // Simulate workload proportional to priority and configured load
      let result = 0
      for (let i = 0; i < 10000 * workload; i++) {
        result += Math.sqrt(i * Math.cos(i))
      }

      const duration = Date.now() - startExecution
      const breathingState = cyre.getBreathingState()

      // Record execution metrics
      executionRecords[priority].push({
        timestamp: elapsed,
        priority,
        stress: breathingState.stress,
        timeSinceLastExecution,
        duration
      })

      // Log milestones for visibility
      const count = executionRecords[priority].length
      if (count % 5 === 0) {
        console.log(
          `[${elapsed}ms] ${priority.toUpperCase()} priority executed ${count} times ` +
            `(stress: ${(breathingState.stress * 100).toFixed(1)}%)`
        )
      }

      return {result, count}
    })

    // Create action
    cyre.action({
      id,
      type: `timer-${priority}`,
      payload: {priority},
      interval,
      repeat: true,
      priority: {level: priority},
      detectChanges: false
    })

    // Start the timer
    cyre.call(id, {startTime: Date.now()})
  }

  // Utility: Generate system stress - direct CPU load for more reliable stress
  const generateSystemStress = async (
    intensity: number,
    duration: number
  ): Promise<void> => {
    console.log(
      `Generating system stress (intensity: ${intensity}) for ${duration}ms...`
    )

    // Direct approach using synchronous CPU load
    const startTime = Date.now()
    const endTime = startTime + duration

    // Create intense CPU load in a blocking manner
    while (Date.now() < endTime) {
      let result = 0
      for (let i = 0; i < 200000 * intensity; i++) {
        result += Math.sqrt(i * Math.sin(i))
      }

      // Create memory pressure
      const memoryLoad = Array(10000 * intensity)
        .fill(0)
        .map((_, i) => ({
          value: i,
          computed: Math.sin(i) * Math.cos(i)
        }))

      // Allow event loop to process other tasks occasionally
      if (Date.now() % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }

    console.log(`Stress generation complete after ${Date.now() - startTime}ms`)
  }

  // Utility: Analyze execution patterns by priority
  const analyzeExecutionPatterns = () => {
    return Object.entries(executionRecords).map(([priority, records]) => {
      if (records.length < 2) {
        return {priority, executionCount: records.length}
      }

      // Calculate intervals between executions
      const intervals = []
      for (let i = 1; i < records.length; i++) {
        intervals.push(records[i].timeSinceLastExecution)
      }

      // Calculate metrics
      const avgInterval =
        intervals.reduce((sum, i) => sum + i, 0) / intervals.length
      const maxInterval = Math.max(...intervals)
      const minInterval = Math.min(...intervals)

      // Extract stress data
      const stressLevels = records.map(r => r.stress)
      const avgStress =
        stressLevels.reduce((sum, s) => sum + s, 0) / stressLevels.length

      // Calculate performance under high stress
      const highStressRecords = records.filter(
        r => r.stress > BREATHING.STRESS.HIGH
      )
      const normalStressRecords = records.filter(
        r => r.stress <= BREATHING.STRESS.MEDIUM
      )

      const highStressIntervals =
        highStressRecords.length > 1
          ? highStressRecords
              .slice(1)
              .map(
                (r, i) =>
                  r.timeSinceLastExecution -
                  highStressRecords[i].timeSinceLastExecution
              )
          : []

      const normalStressIntervals =
        normalStressRecords.length > 1
          ? normalStressRecords
              .slice(1)
              .map(
                (r, i) =>
                  r.timeSinceLastExecution -
                  normalStressRecords[i].timeSinceLastExecution
              )
          : []

      const avgHighStressInterval = highStressIntervals.length
        ? highStressIntervals.reduce((sum, i) => sum + i, 0) /
          highStressIntervals.length
        : 0

      const avgNormalStressInterval = normalStressIntervals.length
        ? normalStressIntervals.reduce((sum, i) => sum + i, 0) /
          normalStressIntervals.length
        : 0

      return {
        priority,
        executionCount: records.length,
        avgInterval,
        maxInterval,
        minInterval,
        intervalStdDev: calculateStdDev(intervals),
        highStressRatio: highStressRecords.length / records.length,
        avgStress,
        avgHighStressInterval,
        avgNormalStressInterval,
        stressAdaptationRatio:
          avgHighStressInterval && avgNormalStressInterval
            ? avgHighStressInterval / avgNormalStressInterval
            : 1
      }
    })
  }

  // Utility: Analyze breathing pattern transitions
  const analyzeBreathingPatterns = () => {
    if (breathingSnapshots.length < 2) return {}

    // Extract key metrics
    const stressLevels = breathingSnapshots.map(s => s.stress)
    const breathRates = breathingSnapshots.map(s => s.rate)
    const recuperationStates = breathingSnapshots.map(s => s.isRecuperating)

    // Find recuperation periods
    const recuperationPeriods = []
    let currentPeriod = null

    for (let i = 0; i < recuperationStates.length; i++) {
      if (recuperationStates[i] && currentPeriod === null) {
        // Start of recuperation
        currentPeriod = {
          startIndex: i,
          endIndex: -1,
          startTime: breathingSnapshots[i].timestamp,
          endTime: -1
        }
      } else if (!recuperationStates[i] && currentPeriod !== null) {
        // End of recuperation
        currentPeriod.endIndex = i - 1
        currentPeriod.endTime = breathingSnapshots[i - 1].timestamp
        currentPeriod.duration = currentPeriod.endTime - currentPeriod.startTime

        // Calculate peak stress during this period
        const periodStress = stressLevels.slice(
          currentPeriod.startIndex,
          currentPeriod.endIndex + 1
        )
        currentPeriod.peakStress = Math.max(...periodStress)
        currentPeriod.avgStress =
          periodStress.reduce((sum, s) => sum + s, 0) / periodStress.length

        recuperationPeriods.push(currentPeriod)
        currentPeriod = null
      }
    }

    // Handle ongoing recuperation at end of test
    if (currentPeriod !== null) {
      currentPeriod.endIndex = recuperationStates.length - 1
      currentPeriod.endTime =
        breathingSnapshots[recuperationStates.length - 1].timestamp
      currentPeriod.duration = currentPeriod.endTime - currentPeriod.startTime

      const periodStress = stressLevels.slice(
        currentPeriod.startIndex,
        currentPeriod.endIndex + 1
      )
      currentPeriod.peakStress = Math.max(...periodStress)
      currentPeriod.avgStress =
        periodStress.reduce((sum, s) => sum + s, 0) / periodStress.length

      recuperationPeriods.push(currentPeriod)
    }

    // Pattern transitions
    const patternTransitions = []
    for (let i = 1; i < breathingSnapshots.length; i++) {
      if (breathingSnapshots[i].pattern !== breathingSnapshots[i - 1].pattern) {
        patternTransitions.push({
          timestamp: breathingSnapshots[i].timestamp,
          from: breathingSnapshots[i - 1].pattern,
          to: breathingSnapshots[i].pattern,
          stress: breathingSnapshots[i].stress
        })
      }
    }

    return {
      sampleCount: breathingSnapshots.length,
      avgStress: calculateAverage(stressLevels),
      maxStress: Math.max(...stressLevels),
      minStress: Math.min(...stressLevels),
      stressStdDev: calculateStdDev(stressLevels),

      avgBreathRate: calculateAverage(breathRates),
      maxBreathRate: Math.max(...breathRates),
      minBreathRate: Math.min(...breathRates),
      breathRateStdDev: calculateStdDev(breathRates),

      recuperationPeriods,
      recuperationTime: recuperationPeriods.reduce(
        (sum, p) => sum + p.duration,
        0
      ),
      recuperationPercentage:
        (recuperationStates.filter(Boolean).length /
          recuperationStates.length) *
        100,

      patternTransitions,
      uniquePatterns: [...new Set(breathingSnapshots.map(s => s.pattern))],
      breathCount: breathingSnapshots[breathingSnapshots.length - 1].breathCount
    }
  }

  // Utility: Helper function to calculate standard deviation
  const calculateStdDev = (values: number[]): number => {
    if (values.length < 2) return 0

    const avg = calculateAverage(values)
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
      values.length
    return Math.sqrt(variance)
  }

  // Utility: Helper function to calculate average
  const calculateAverage = (values: number[]): number => {
    if (values.length === 0) return 0
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  // Main test case
  it(
    'should maintain system integrity under prolonged stress with quantum breathing',
    async () => {
      // This is a long-running test

      // Start monitoring breathing system
      monitorInterval = monitorBreathingSystem()

      // Create timers with different priorities
      console.log('Creating timers across all priority levels...')
      createPriorityTimer('critical', 1000, 1) // Critical operations - 1s interval, regular workload
      createPriorityTimer('high', 2000, 1.5) // High priority - 2s interval, moderate workload
      createPriorityTimer('medium', 3000, 2) // Medium priority - 3s interval, higher workload
      createPriorityTimer('low', 5000, 2.5) // Low priority - 5s interval, heavy workload
      createPriorityTimer('background', 8000, 3) // Background - 8s interval, very heavy workload

      // Let system run normally for 10 seconds to establish baseline
      console.log('Establishing baseline performance for 10 seconds...')
      await new Promise(resolve => setTimeout(resolve, 10000))

      // Phase 1: Generate medium stress for 10 seconds
      console.log('Phase 1: Generating MEDIUM stress for 10 seconds...')
      await generateSystemStress(3, 10000)

      // Brief recovery period
      console.log('Brief recovery period for 5 seconds...')
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Phase 2: Generate high stress for 15 seconds
      console.log('Phase 2: Generating HIGH stress for 15 seconds...')
      await generateSystemStress(7, 15000)

      // Recovery period
      console.log('Recovery period for 10 seconds...')
      await new Promise(resolve => setTimeout(resolve, 10000))

      // Final phase: Generate variable stress pattern
      console.log('Phase 3: Generating VARIABLE stress pattern...')

      // Several short but intense stress bursts
      for (let i = 0; i < 3; i++) {
        console.log(`Stress burst ${i + 1}/3...`)
        await generateSystemStress(5, 2000)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Final recovery period
      console.log('Final recovery and stabilization period...')
      // Wait for system to stabilize or timeout
      const stabilizationTimeout = Date.now() + 10000
      while (!systemStabilized && Date.now() < stabilizationTimeout) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Analyze results
      const executionAnalysis = analyzeExecutionPatterns()
      const breathingAnalysis = analyzeBreathingPatterns()

      console.log('Test completed. Analyzing results...')
      console.log(
        'Execution Analysis:',
        JSON.stringify(executionAnalysis, null, 2)
      )
      console.log(
        'Breathing Analysis:',
        JSON.stringify(breathingAnalysis, null, 2)
      )

      // Verify expected behavior with assertions

      // 1. System should have detected stress and entered recuperation
      expect(breathingAnalysis.recuperationPeriods.length).toBeGreaterThan(0)
      expect(breathingAnalysis.maxStress).toBeGreaterThan(
        BREATHING.STRESS.MEDIUM
      )

      // 2. System should have adapted breath rate under stress
      expect(breathingAnalysis.maxBreathRate).toBeGreaterThan(
        breathingAnalysis.minBreathRate
      )

      // 3. Critical tasks should maintain better performance than low priority tasks
      const criticalMetrics = executionAnalysis.find(
        m => m.priority === 'critical'
      )
      const lowMetrics = executionAnalysis.find(m => m.priority === 'low')

      if (
        criticalMetrics &&
        lowMetrics &&
        breathingAnalysis.maxStress > BREATHING.STRESS.HIGH
      ) {
        // If system experienced significant stress, critical should have more reliable timing
        expect(criticalMetrics.intervalStdDev).toBeLessThan(
          lowMetrics.intervalStdDev * 1.5
        )

        // Critical tasks should execute more frequently than low priority tasks during stress
        expect(criticalMetrics.executionCount).toBeGreaterThan(
          lowMetrics.executionCount * 0.5
        )
      }

      // 4. System should show adaptation in breathing rates
      expect(breathingAnalysis.breathRateStdDev).toBeGreaterThan(0)

      // 5. System should have recovered from stress periods
      expect(systemStabilized).toBe(true)

      console.log('Test passed successfully!')
    },
    TEST_DURATION + 10000
  ) // Set timeout for the full test duration plus buffer
})
