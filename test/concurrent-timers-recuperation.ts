// src/test/concurrent-timers-recuperation.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {BREATHING} from '../src/config/cyre-config'

/*
 * Concurrent Timers and Recuperation Counter Test
 *
 * This test focuses specifically on:
 * 1. Running many concurrent timers with different intervals
 * 2. Tracking recuperation cycles and breathing rate adaptation
 * 3. Observing system self-regulation under varying load
 */

describe('Concurrent Timers and Recuperation', () => {
  // Test configuration
  const TEST_DURATION = 60_000 // 1 minute
  const CONCURRENT_TIMERS = 20 // High number of concurrent timers
  const MONITOR_INTERVAL = 200 // Sample frequently

  // Track timer executions
  type TimerRecord = {
    id: string
    interval: number
    scheduledTime: number
    executionTime: number
    duration: number
    delay: number
    stress: number
    isRecuperating: boolean
    breathRate: number
  }

  // Track recuperation cycles
  type RecuperationCycle = {
    startTime: number
    endTime: number | null
    duration: number | null
    peakStress: number
    peakBreathRate: number
    executionsDuringRecuperation: Record<string, number>
    totalExecutions: number
  }

  // Shared test state
  let timerRecords: TimerRecord[] = []
  let recuperationCycles: RecuperationCycle[] = []
  let monitorInterval: NodeJS.Timer
  let startTime: number
  let activeTimerIds: string[] = []
  let currentRecuperationCycle: RecuperationCycle | null = null
  let executionsDuringCurrentRecuperation: Record<string, number> = {}

  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize test state
    timerRecords = []
    recuperationCycles = []
    activeTimerIds = []
    currentRecuperationCycle = null
    executionsDuringCurrentRecuperation = {}
    startTime = Date.now()

    // Initialize cyre
    cyre.initialize()

    console.log('===== CONCURRENT TIMERS & RECUPERATION TEST STARTED =====')
  })

  afterEach(() => {
    // Clean up
    if (monitorInterval) {
      clearInterval(monitorInterval)
    }

    // Finalize any ongoing recuperation cycle
    if (currentRecuperationCycle !== null) {
      const duration = Date.now() - currentRecuperationCycle.startTime
      currentRecuperationCycle.endTime = Date.now()
      currentRecuperationCycle.duration = duration
      recuperationCycles.push(currentRecuperationCycle)
    }

    // Log test summary
    console.log(
      `Test completed with ${timerRecords.length} timer executions across ${activeTimerIds.length} timers`
    )
    console.log(`Observed ${recuperationCycles.length} recuperation cycles`)

    console.log('===== CONCURRENT TIMERS & RECUPERATION TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  // Utility: Monitor recuperation cycles
  const startRecuperationMonitor = () => {
    return setInterval(() => {
      const state = cyre.getBreathingState()
      const elapsed = Date.now() - startTime

      // Track recuperation cycles
      if (state.isRecuperating && currentRecuperationCycle === null) {
        // Start of recuperation cycle
        console.log(
          `[${elapsed}ms] RECUPERATION STARTED (stress: ${(
            state.stress * 100
          ).toFixed(1)}%)`
        )

        currentRecuperationCycle = {
          startTime: elapsed,
          endTime: null,
          duration: null,
          peakStress: state.stress,
          peakBreathRate: state.currentRate,
          executionsDuringRecuperation: {},
          totalExecutions: 0
        }
        executionsDuringCurrentRecuperation = {}
      } else if (state.isRecuperating && currentRecuperationCycle !== null) {
        // Ongoing recuperation - update peaks
        currentRecuperationCycle.peakStress = Math.max(
          currentRecuperationCycle.peakStress,
          state.stress
        )
        currentRecuperationCycle.peakBreathRate = Math.max(
          currentRecuperationCycle.peakBreathRate,
          state.currentRate
        )

        // Update executions count
        currentRecuperationCycle.executionsDuringRecuperation = {
          ...executionsDuringCurrentRecuperation
        }
        currentRecuperationCycle.totalExecutions = Object.values(
          executionsDuringCurrentRecuperation
        ).reduce((sum, count) => sum + count, 0)
      } else if (!state.isRecuperating && currentRecuperationCycle !== null) {
        // End of recuperation cycle
        const duration = elapsed - currentRecuperationCycle.startTime
        console.log(
          `[${elapsed}ms] RECUPERATION ENDED after ${duration}ms ` +
            `(peak stress: ${(
              currentRecuperationCycle.peakStress * 100
            ).toFixed(1)}%, ` +
            `executions: ${currentRecuperationCycle.totalExecutions})`
        )

        currentRecuperationCycle.endTime = elapsed
        currentRecuperationCycle.duration = duration

        // Finalize executions
        currentRecuperationCycle.executionsDuringRecuperation = {
          ...executionsDuringCurrentRecuperation
        }
        currentRecuperationCycle.totalExecutions = Object.values(
          executionsDuringCurrentRecuperation
        ).reduce((sum, count) => sum + count, 0)

        recuperationCycles.push(currentRecuperationCycle)
        currentRecuperationCycle = null
        executionsDuringCurrentRecuperation = {}
      }

      // Log significant breathing rate changes
      if (recuperationCycles.length > 0) {
        const lastCycle = recuperationCycles[recuperationCycles.length - 1]

        if (state.currentRate > lastCycle.peakBreathRate * 1.5) {
          console.log(
            `[${elapsed}ms] SIGNIFICANT BREATH RATE INCREASE: ${state.currentRate}ms ` +
              `(previously: ${lastCycle.peakBreathRate}ms)`
          )
        }
      }
    }, MONITOR_INTERVAL)
  }

  // Utility: Create a timer with specified configuration
  const createConcurrentTimer = (
    index: number,
    baseInterval: number,
    variability: number = 0
  ): string => {
    // Calculate actual interval with variability
    const actualInterval =
      variability > 0
        ? baseInterval + (Math.random() * 2 - 1) * variability * baseInterval
        : baseInterval

    const id = `timer-${index}-${actualInterval.toFixed(0)}`
    activeTimerIds.push(id)

    // Register handler
    cyre.on(id, payload => {
      const executionStart = Date.now()
      const elapsed = executionStart - startTime

      // Simulate variable work
      const workMultiplier = 0.5 + (index % 5) * 0.5 // 0.5 to 2.5 based on index
      let result = 0
      for (let i = 0; i < 5000 * workMultiplier; i++) {
        result += Math.sqrt(i * Math.sin(i) * Math.random())
      }

      // Get system state at execution time
      const breathingState = cyre.getBreathingState()

      // Calculate timing metrics
      const scheduledTime = payload?.scheduledTime || executionStart
      const delay = executionStart - scheduledTime
      const duration = Date.now() - executionStart

      // Record execution
      timerRecords.push({
        id,
        interval: actualInterval,
        scheduledTime,
        executionTime: elapsed,
        duration,
        delay,
        stress: breathingState.stress,
        isRecuperating: breathingState.isRecuperating,
        breathRate: breathingState.currentRate
      })

      // Track executions during recuperation
      if (breathingState.isRecuperating) {
        executionsDuringCurrentRecuperation[id] =
          (executionsDuringCurrentRecuperation[id] || 0) + 1
      }

      // Log the first execution and then every 100th
      const count = timerRecords.filter(r => r.id === id).length
      if (count === 1 || count % 100 === 0) {
        console.log(
          `[${elapsed}ms] Timer ${id} execution #${count} ` +
            `(delay: ${delay}ms, stress: ${(
              breathingState.stress * 100
            ).toFixed(1)}%)`
        )
      }

      return {
        result,
        count,
        scheduledTime: Date.now() + actualInterval
      }
    })

    // Create the timer action
    cyre.action({
      id,
      type: 'concurrent-timer',
      payload: {
        index,
        interval: actualInterval
      },
      interval: actualInterval,
      repeat: true,
      detectChanges: false
    })

    return id
  }

  // Utility: Generate load to stress the system - direct synchronous approach
  const generateStaggeredLoad = async (
    baseIntensity: number,
    duration: number,
    pattern: 'increasing' | 'decreasing' | 'wave'
  ): Promise<void> => {
    console.log(
      `Generating ${pattern} load over ${duration}ms (base intensity: ${baseIntensity})...`
    )

    const startLoadTime = Date.now()
    const endLoadTime = startLoadTime + duration

    // Generate load with specified pattern
    while (Date.now() < endLoadTime) {
      const progress = (Date.now() - startLoadTime) / duration

      // Calculate current intensity based on pattern
      let currentIntensity = baseIntensity
      switch (pattern) {
        case 'increasing':
          currentIntensity = baseIntensity * (0.2 + 0.8 * progress)
          break
        case 'decreasing':
          currentIntensity = baseIntensity * (1 - 0.8 * progress)
          break
        case 'wave':
          currentIntensity =
            baseIntensity * (0.5 + 0.5 * Math.sin(progress * Math.PI * 4))
          break
      }

      // Direct CPU load
      let result = 0
      for (let i = 0; i < 50000 * currentIntensity; i++) {
        result += Math.sqrt(i * Math.cos(i))
      }

      // Create memory pressure
      const memoryLoad = new Array(1000 * currentIntensity)
        .fill(0)
        .map((_, i) => ({
          value: i,
          computed: Math.sin(i) * Math.cos(i)
        }))

      // Allow breathing samples and event loop processing
      if (Date.now() % 30 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }

    console.log(
      `Load generation complete after ${Date.now() - startLoadTime}ms`
    )
  }

  // Utility: Analyze timer execution data
  const analyzeTimerData = () => {
    if (timerRecords.length < 1) return {}

    // Group by timer
    const timerGroups = timerRecords.reduce((groups, record) => {
      if (!groups[record.id]) {
        groups[record.id] = []
      }
      groups[record.id].push(record)
      return groups
    }, {} as Record<string, TimerRecord[]>)

    // Calculate metrics for each timer
    const timerMetrics = Object.entries(timerGroups).map(([id, records]) => {
      const delays = records.map(r => r.delay)
      const durations = records.map(r => r.duration)
      const stressLevels = records.map(r => r.stress)

      // Extract recuperation records
      const recuperationRecords = records.filter(r => r.isRecuperating)
      const normalRecords = records.filter(r => !r.isRecuperating)

      // Calculate timing differences during recuperation vs. normal
      const avgRecuperationDelay = recuperationRecords.length
        ? recuperationRecords.reduce((sum, r) => sum + r.delay, 0) /
          recuperationRecords.length
        : 0

      const avgNormalDelay = normalRecords.length
        ? normalRecords.reduce((sum, r) => sum + r.delay, 0) /
          normalRecords.length
        : 0

      return {
        id,
        count: records.length,
        interval: records[0].interval,
        avgDelay: calculateAverage(delays),
        maxDelay: Math.max(...delays),
        delayStdDev: calculateStdDev(delays),
        avgDuration: calculateAverage(durations),
        avgStress: calculateAverage(stressLevels),
        recuperationPercentage:
          (recuperationRecords.length / records.length) * 100,
        avgRecuperationDelay,
        avgNormalDelay,
        delayIncreaseRatio:
          avgNormalDelay > 0 ? avgRecuperationDelay / avgNormalDelay : 0
      }
    })

    // Calculate overall metrics
    const allDelays = timerRecords.map(r => r.delay)
    const recordsInRecuperation = timerRecords.filter(r => r.isRecuperating)

    return {
      totalExecutions: timerRecords.length,
      uniqueTimers: Object.keys(timerGroups).length,
      avgDelay: calculateAverage(allDelays),
      maxDelay: Math.max(...allDelays),
      delayStdDev: calculateStdDev(allDelays),
      recuperationExecutionPercentage:
        (recordsInRecuperation.length / timerRecords.length) * 100,
      timerMetrics,
      stressDistribution: calculateDistribution(
        timerRecords.map(r => r.stress),
        10
      )
    }
  }

  // Utility: Analyze recuperation cycles
  const analyzeRecuperationCycles = () => {
    if (recuperationCycles.length < 1) return {}

    const durations = recuperationCycles
      .filter(c => c.duration !== null)
      .map(c => c.duration as number)

    const peakStressLevels = recuperationCycles.map(c => c.peakStress)
    const executionCounts = recuperationCycles.map(c => c.totalExecutions)

    return {
      totalCycles: recuperationCycles.length,
      avgDuration: calculateAverage(durations),
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      durationStdDev: calculateStdDev(durations),
      avgPeakStress: calculateAverage(peakStressLevels),
      maxPeakStress: Math.max(...peakStressLevels),
      avgExecutionsPerCycle: calculateAverage(executionCounts),
      maxExecutionsInCycle: Math.max(...executionCounts),
      totalRecuperationTime: durations.reduce((sum, d) => sum + d, 0),
      recuperationPercentage:
        (durations.reduce((sum, d) => sum + d, 0) / TEST_DURATION) * 100,
      cyclesByStress: [
        recuperationCycles.filter(c => c.peakStress < BREATHING.STRESS.MEDIUM)
          .length,
        recuperationCycles.filter(
          c =>
            c.peakStress >= BREATHING.STRESS.MEDIUM &&
            c.peakStress < BREATHING.STRESS.HIGH
        ).length,
        recuperationCycles.filter(c => c.peakStress >= BREATHING.STRESS.HIGH)
          .length
      ]
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

  // Utility: Calculate distribution of values across buckets
  const calculateDistribution = (
    values: number[],
    bucketCount: number
  ): number[] => {
    if (values.length === 0) return new Array(bucketCount).fill(0)

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    const bucketSize = range / bucketCount

    // Initialize buckets
    const distribution = new Array(bucketCount).fill(0)

    // Fill buckets
    values.forEach(value => {
      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.floor((value - min) / bucketSize)
      )
      distribution[bucketIndex]++
    })

    return distribution
  }

  // Main test case
  it(
    'should effectively manage many concurrent timers with appropriate recuperation',
    async () => {
      // This is a long-running test

      // Start monitoring recuperation cycles
      monitorInterval = startRecuperationMonitor()

      // Create a diverse set of concurrent timers with varying intervals
      console.log(
        `Creating ${CONCURRENT_TIMERS} concurrent timers with varying intervals...`
      )

      // Create timers across different interval ranges
      const timerIds = []

      // Short interval timers (100-500ms)
      for (let i = 0; i < CONCURRENT_TIMERS * 0.2; i++) {
        const baseInterval = 100 + i * 20
        const id = createConcurrentTimer(i, baseInterval, 0.1)
        timerIds.push(id)
      }

      // Medium interval timers (500-2000ms)
      for (let i = 0; i < CONCURRENT_TIMERS * 0.5; i++) {
        const baseInterval = 500 + i * 150
        const id = createConcurrentTimer(i + 100, baseInterval, 0.2)
        timerIds.push(id)
      }

      // Long interval timers (2000-10000ms)
      for (let i = 0; i < CONCURRENT_TIMERS * 0.3; i++) {
        const baseInterval = 2000 + i * 800
        const id = createConcurrentTimer(i + 200, baseInterval, 0.3)
        timerIds.push(id)
      }

      // Start all timers
      console.log(`Starting all ${timerIds.length} timers...`)
      await Promise.all(
        timerIds.map(id =>
          cyre.call(id, {
            scheduledTime: Date.now()
          })
        )
      )

      // Let timers run for initial period
      console.log('Letting timers run for initial period (10s)...')
      await new Promise(resolve => setTimeout(resolve, 10000))

      // Generate increasing load
      console.log('Phase 1: Generating INCREASING load (15s)...')
      await generateStaggeredLoad(5, 15000, 'increasing')

      // Let system recuperate
      console.log('Allowing system to recuperate (10s)...')
      await new Promise(resolve => setTimeout(resolve, 10000))

      // Generate wave pattern load
      console.log('Phase 2: Generating WAVE pattern load (15s)...')
      await generateStaggeredLoad(4, 15000, 'wave')

      // Final recovery
      console.log('Final recovery period (10s)...')
      await new Promise(resolve => setTimeout(resolve, 10000))

      // Analyze results
      const timerAnalysis = analyzeTimerData()
      const recuperationAnalysis = analyzeRecuperationCycles()

      console.log('Test completed. Analyzing results...')
      console.log('Timer Analysis:', JSON.stringify(timerAnalysis, null, 2))
      console.log(
        'Recuperation Analysis:',
        JSON.stringify(recuperationAnalysis, null, 2)
      )

      // Assert expected behavior

      // 1. System should have registered recuperation cycles during stress
      expect(recuperationCycles.length).toBeGreaterThan(0)

      // 2. Significant number of executions should have occurred
      expect(timerRecords.length).toBeGreaterThan(CONCURRENT_TIMERS * 10)

      // 3. Short-interval timers should have more executions than long-interval timers
      const shortIntervalTimers =
        timerAnalysis.timerMetrics?.filter(m => m.interval < 500) || []
      const longIntervalTimers =
        timerAnalysis.timerMetrics?.filter(m => m.interval > 2000) || []

      if (shortIntervalTimers.length > 0 && longIntervalTimers.length > 0) {
        const avgShortCount =
          shortIntervalTimers.reduce((sum, m) => sum + m.count, 0) /
          shortIntervalTimers.length

        const avgLongCount =
          longIntervalTimers.reduce((sum, m) => sum + m.count, 0) /
          longIntervalTimers.length

        expect(avgShortCount).toBeGreaterThan(avgLongCount * 2)
      }

      // 4. Delays should be greater during recuperation
      expect(
        timerAnalysis.timerMetrics?.[0].delayIncreaseRatio
      ).toBeGreaterThan(1)

      // 5. System should have spent significant time in recuperation during stress
      if (recuperationAnalysis.totalCycles > 0) {
        expect(recuperationAnalysis.recuperationPercentage).toBeGreaterThan(10)
      }

      console.log('Test passed successfully!')
    },
    TEST_DURATION + 10000
  ) // Set timeout for the full test duration plus buffer
})
