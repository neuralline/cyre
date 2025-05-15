// src/test/breathing-resilience.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {BREATHING} from '../src/config/cyre-config'
import {metricsState} from '../src/context/metrics-state'

/*
 * Simplified Quantum Breathing Test
 *
 * This test evaluates basic breathing system functionality under artificial stress,
 * focusing on validating core system behavior while ensuring test reliability.
 */

describe('Quantum Breathing Resilience', () => {
  // Minimal test configuration
  const SAMPLE_INTERVAL = 200 // Sample every 200ms

  // Track breathing patterns
  type BreathingSnapshot = {
    timestamp: number
    breathCount: number
    rate: number
    stress: number
    isRecuperating: boolean
    pattern: string
  }

  // Shared test state
  let breathingSnapshots: BreathingSnapshot[] = []
  let monitorInterval: NodeJS.Timer | null = null
  let startTime: number

  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Reset test state
    breathingSnapshots = []
    startTime = Date.now()

    // Initialize cyre
    cyre.initialize()

    console.log('===== SIMPLIFIED BREATHING TEST STARTED =====')
  })

  afterEach(() => {
    // Clean up monitoring
    if (monitorInterval) {
      clearInterval(monitorInterval)
      monitorInterval = null
    }

    console.log(`Collected ${breathingSnapshots.length} breathing samples`)
    console.log('===== SIMPLIFIED BREATHING TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  // Simple monitoring function that doesn't interfere with test flow
  const setupMonitoring = () => {
    monitorInterval = setInterval(() => {
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

      // Log significant state changes
      if (breathingState.isRecuperating) {
        console.log(
          `[${elapsed}ms] System in RECUPERATION (stress: ${(
            breathingState.stress * 100
          ).toFixed(1)}%)`
        )
      }
    }, SAMPLE_INTERVAL)
  }

  // Simplified: Directly set stress level without complex cooling mechanism
  const setSystemStress = (level: number): void => {
    console.log(`Setting system stress to ${(level * 100).toFixed(1)}%`)

    // Directly update stress metrics
    metricsState.updateBreath({
      cpu: level * BREATHING.LIMITS.MAX_CPU,
      memory: level * BREATHING.LIMITS.MAX_MEMORY,
      eventLoop: level * BREATHING.LIMITS.MAX_EVENT_LOOP,
      isOverloaded: level >= BREATHING.STRESS.HIGH
    })
  }

  // Simplified: Apply stress for a fixed duration
  const applyStressForDuration = async (
    level: number,
    duration: number
  ): Promise<void> => {
    console.log(
      `Applying ${(level * 100).toFixed(1)}% stress for ${duration}ms`
    )

    // Set stress level
    setSystemStress(level)

    // Wait for specified duration
    await new Promise(resolve => setTimeout(resolve, duration))

    // No complex cooldown - just return to zero
    console.log(`Stress period complete`)
  }

  // Simplified test that won't hang
  it('should adapt to system stress through breathing mechanisms', async () => {
    // Setup monitoring
    setupMonitoring()

    // Baseline - no stress (500ms)
    await new Promise(resolve => setTimeout(resolve, 500))

    // Test various stress levels in sequence

    // 1. Medium stress (50% of HIGH threshold)
    const mediumStress = BREATHING.STRESS.HIGH * 0.5
    await applyStressForDuration(mediumStress, 1000)

    // 2. High stress (just at HIGH threshold)
    const highStress = BREATHING.STRESS.HIGH
    await applyStressForDuration(highStress, 1000)

    // 3. Critical stress (above HIGH threshold to trigger recuperation)
    const criticalStress = BREATHING.STRESS.HIGH * 1.1
    await applyStressForDuration(criticalStress, 1000)

    // Reset stress to zero
    setSystemStress(0)

    // Allow for final sample collection
    await new Promise(resolve => setTimeout(resolve, 500))

    // Stop monitoring
    if (monitorInterval) {
      clearInterval(monitorInterval)
      monitorInterval = null
    }

    // Analyze results
    const stressLevels = breathingSnapshots.map(s => s.stress)
    const breathRates = breathingSnapshots.map(s => s.rate)
    const recuperationStates = breathingSnapshots.map(s => s.isRecuperating)

    // Calculate key metrics
    const maxStress = Math.max(...stressLevels)
    const ratesStdDev = calculateStdDev(breathRates)
    const recuperationDetected = recuperationStates.some(Boolean)

    console.log('Test results:')
    console.log(`- Max stress: ${(maxStress * 100).toFixed(1)}%`)
    console.log(`- Breathing rate variation: ${ratesStdDev.toFixed(5)}`)
    console.log(`- Recuperation detected: ${recuperationDetected}`)

    // Verify core behavior

    // 1. System should register stress
    expect(maxStress).toBeGreaterThan(0.05) // At least 5% stress

    // 2. Breathing rate should adapt to stress
    expect(ratesStdDev).toBeGreaterThan(0)

    // 3. For high enough stress, recuperation should trigger
    if (maxStress >= BREATHING.STRESS.HIGH) {
      expect(recuperationDetected).toBe(true)
    }
  }, 10000) // 10 second timeout is plenty

  // Utility: Calculate standard deviation
  const calculateStdDev = (values: number[]): number => {
    if (values.length < 2) return 0
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      values.length
    return Math.sqrt(variance)
  }
})
