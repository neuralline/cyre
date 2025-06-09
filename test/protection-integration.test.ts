// test/protection-integration.test.ts
// File location: /test/protection-integration.test.ts
// Comprehensive protection feature integration testing

import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/app'

/*

      C.Y.R.E - P.R.O.T.E.C.T.I.O.N - I.N.T.E.G.R.A.T.I.O.N - T.E.S.T.S
      
      Tests the interaction between protection features:
      - Throttling + Change Detection
      - Debouncing + Payload Transformation  
      - Multiple protection layers
      - Protection recovery scenarios
      - False positive prevention

*/

describe('Protection Features Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cyre.initialize()
  })

  afterEach(() => {
    cyre.clear()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Throttling + Change Detection', () => {
    test('should properly combine throttling with change detection', async () => {
      let executionCount = 0
      const executions: Array<{payload: any; timestamp: number}> = []
      const actionId = 'throttle-change-test'

      cyre.on(actionId, payload => {
        executionCount++
        executions.push({payload, timestamp: Date.now()})
        return {executed: true, count: executionCount}
      })

      cyre.action({
        id: actionId,
        throttle: 100,
        detectChanges: true
      })

      // Phase 1: Same payload, rapid calls (should be throttled AND change-filtered)
      const phase1Results = []
      for (let i = 0; i < 5; i++) {
        phase1Results.push(await cyre.call(actionId, {value: 'same'}))
        vi.advanceTimersByTime(10) // Very fast calls
      }

      // First call should succeed, rest should be throttled
      expect(phase1Results[0].ok).toBe(true)
      expect(phase1Results.slice(1).every(r => !r.ok)).toBe(true)
      expect(executionCount).toBe(1)

      // Wait for throttle to clear
      vi.advanceTimersByTime(200)

      // Phase 2: Different payloads, spaced calls (should execute because payload changes)
      await cyre.call(actionId, {value: 'first'})
      vi.advanceTimersByTime(150) // Wait past throttle

      await cyre.call(actionId, {value: 'second'})
      vi.advanceTimersByTime(150)

      await cyre.call(actionId, {value: 'third'})

      // Should have 4 total executions (1 from phase 1 + 3 from phase 2)
      expect(executionCount).toBe(4)

      // Phase 3: Same payload again after changes (should be filtered by change detection)
      const samePayloadResult = await cyre.call(actionId, {value: 'third'})
      expect(samePayloadResult.ok).toBe(false)
      expect(samePayloadResult.message).toContain('unchanged')
      expect(executionCount).toBe(4) // No change
    })

    test('should handle throttle timing with change detection correctly', async () => {
      let executionCount = 0
      const actionId = 'throttle-timing-test'

      cyre.on(actionId, () => {
        executionCount++
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        throttle: 200,
        detectChanges: true
      })

      // Rapid different payloads - first should execute, others throttled
      await cyre.call(actionId, {value: 1})
      expect(executionCount).toBe(1)

      const throttledResult = await cyre.call(actionId, {value: 2})
      expect(throttledResult.ok).toBe(false)
      expect(throttledResult.message).toContain('Throttled')

      // Wait for throttle to clear
      vi.advanceTimersByTime(250)

      // Now should execute with new payload
      await cyre.call(actionId, {value: 3})
      expect(executionCount).toBe(2)
    })
  })

  describe('Debouncing + Payload Transformation', () => {
    test('should apply transformation to final debounced payload', async () => {
      let executionCount = 0
      const finalPayloads: any[] = []
      const actionId = 'debounce-transform-test'

      cyre.on(actionId, payload => {
        executionCount++
        finalPayloads.push(payload)
        return {executed: true, transformed: payload}
      })

      cyre.action({
        id: actionId,
        debounce: 150,
        transform: (payload: any) => ({
          ...payload,
          transformed: true,
          timestamp: Date.now()
        })
      })

      // Make rapid calls with different payloads
      const callPromises = []
      for (let i = 0; i < 5; i++) {
        callPromises.push(cyre.call(actionId, {value: i, index: i}))
        vi.advanceTimersByTime(30) // Rapid calls within debounce window
      }

      // All calls should return successfully but be debounced
      const results = await Promise.all(callPromises)
      expect(results.every(r => r.ok)).toBe(true)

      // No execution yet due to debounce
      expect(executionCount).toBe(0)

      // Wait for debounce to complete
      vi.advanceTimersByTime(200)

      // Should have executed once with the last payload, transformed
      expect(executionCount).toBe(1)
      expect(finalPayloads[0]).toEqual({
        value: 4,
        index: 4,
        transformed: true,
        timestamp: expect.any(Number)
      })
    })

    test('should handle debounce with transform errors gracefully', async () => {
      let executionCount = 0
      const actionId = 'debounce-transform-error-test'

      cyre.on(actionId, payload => {
        executionCount++
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        debounce: 100,
        transform: (payload: any) => {
          if (payload.shouldError) {
            throw new Error('Transform error')
          }
          return {...payload, transformed: true}
        }
      })

      // Call with payload that will cause transform error
      const errorResult = await cyre.call(actionId, {shouldError: true})
      vi.advanceTimersByTime(150)

      // Should handle error gracefully
      expect(errorResult.ok).toBe(false)
      expect(errorResult.message).toContain('Transform')
      expect(executionCount).toBe(0)

      // Normal call should work
      const normalResult = await cyre.call(actionId, {shouldError: false})
      vi.advanceTimersByTime(150)

      expect(normalResult.ok).toBe(true)
      expect(executionCount).toBe(1)
    })
  })

  describe('Multiple Protection Layers', () => {
    test('should handle throttle + debounce + change detection correctly', async () => {
      let executionCount = 0
      const executions: any[] = []
      const actionId = 'multi-protection-test'

      cyre.on(actionId, payload => {
        executionCount++
        executions.push({payload, timestamp: Date.now()})
        return {executed: true}
      })

      // Note: throttle and debounce together is usually not recommended,
      // but test that the system handles it gracefully
      cyre.action({
        id: actionId,
        throttle: 100,
        debounce: 200,
        detectChanges: true
      })

      // This should fail during action creation due to conflicting protections
      const action = cyre.get(actionId)
      expect(action).toBeUndefined() // Action creation should fail
    })

    test('should handle schema + change detection + throttling', async () => {
      let executionCount = 0
      const validPayloads: any[] = []
      const actionId = 'schema-change-throttle-test'

      cyre.on(actionId, payload => {
        executionCount++
        validPayloads.push(payload)
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        throttle: 100,
        detectChanges: true,
        schema: {
          type: 'object',
          required: true,
          refine: (payload: any) => payload.value > 0
        }
      })

      // Invalid payload - should fail schema validation
      const invalidResult = await cyre.call(actionId, {value: -1})
      expect(invalidResult.ok).toBe(false)
      expect(invalidResult.message).toContain('Schema validation failed')

      // Valid payload - should execute
      const validResult1 = await cyre.call(actionId, {value: 5})
      expect(validResult1.ok).toBe(true)
      expect(executionCount).toBe(1)

      // Same valid payload - should be filtered by change detection
      const unchangedResult = await cyre.call(actionId, {value: 5})
      expect(unchangedResult.ok).toBe(false)
      expect(unchangedResult.message).toContain('unchanged')

      // Different valid payload but throttled
      const throttledResult = await cyre.call(actionId, {value: 10})
      expect(throttledResult.ok).toBe(false)
      expect(throttledResult.message).toContain('Throttled')

      // Wait for throttle to clear
      vi.advanceTimersByTime(150)

      // Now should execute with new valid payload
      const finalResult = await cyre.call(actionId, {value: 15})
      expect(finalResult.ok).toBe(true)
      expect(executionCount).toBe(2)
    })
  })

  describe('Protection Recovery Scenarios', () => {
    test('should recover from protection overload correctly', async () => {
      let executionCount = 0
      const actionId = 'recovery-test'

      cyre.on(actionId, () => {
        executionCount++
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        throttle: 50
      })

      // Phase 1: Create throttle overload
      const rapidResults = []
      for (let i = 0; i < 10; i++) {
        rapidResults.push(await cyre.call(actionId, {attempt: i}))
        vi.advanceTimersByTime(5) // Very rapid calls
      }

      // Only first should succeed
      expect(rapidResults[0].ok).toBe(true)
      expect(rapidResults.slice(1).every(r => !r.ok)).toBe(true)
      expect(executionCount).toBe(1)

      // Phase 2: Wait for recovery and normal operation
      vi.advanceTimersByTime(100) // Clear throttle

      const recoveryResults = []
      for (let i = 0; i < 5; i++) {
        recoveryResults.push(await cyre.call(actionId, {recovery: i}))
        vi.advanceTimersByTime(60) // Properly spaced calls
      }

      // All should succeed now
      expect(recoveryResults.every(r => r.ok)).toBe(true)
      expect(executionCount).toBe(6) // 1 + 5
    })

    test('should handle system stress without false positives', async () => {
      const actionIds: string[] = []
      const executionCounts = new Map<string, number>()

      // Create multiple actions with reasonable protection
      for (let i = 0; i < 20; i++) {
        const actionId = `stress-protection-${i}`
        actionIds.push(actionId)
        executionCounts.set(actionId, 0)

        cyre.on(actionId, () => {
          const current = executionCounts.get(actionId) || 0
          executionCounts.set(actionId, current + 1)
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          throttle: 25, // Light throttling
          detectChanges: true
        })
      }

      // Phase 1: Normal load - should execute without issues
      for (const actionId of actionIds) {
        const result = await cyre.call(actionId, {
          phase: 'normal',
          id: actionId
        })
        expect(result.ok).toBe(true)
        vi.advanceTimersByTime(30) // Space out calls
      }

      // Verify all executed
      for (const count of executionCounts.values()) {
        expect(count).toBe(1)
      }

      // Phase 2: Higher load but still reasonable
      for (let round = 0; round < 3; round++) {
        for (const actionId of actionIds) {
          const result = await cyre.call(actionId, {
            phase: 'load',
            round,
            id: actionId
          })
          expect(result.ok).toBe(true)
          vi.advanceTimersByTime(30)
        }
      }

      // Verify continued execution (should be 4 total per action: 1 + 3)
      for (const count of executionCounts.values()) {
        expect(count).toBe(4)
      }
    })
  })

  describe('False Positive Prevention', () => {
    test('should not trigger breathing restrictions under normal load', async () => {
      let totalExecutions = 0
      const actionIds: string[] = []

      // Create moderate number of actions
      for (let i = 0; i < 10; i++) {
        const actionId = `normal-load-${i}`
        actionIds.push(actionId)

        cyre.on(actionId, () => {
          totalExecutions++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          throttle: 10 // Very light throttling
        })
      }

      // Make many calls with reasonable spacing
      for (let round = 0; round < 50; round++) {
        for (const actionId of actionIds) {
          const result = await cyre.call(actionId, {
            round,
            value: Math.random()
          })
          expect(result.ok).toBe(true)
          vi.advanceTimersByTime(15) // Reasonable spacing
        }
      }

      // Should achieve 100% execution rate
      expect(totalExecutions).toBe(500) // 10 actions * 50 rounds

      // System should not be in breathing/recuperation mode
      const breathingState = cyre.getBreathingState()
      expect(breathingState.stress).toBeLessThan(0.5) // Low stress
      expect(breathingState.isRecuperating).toBe(false)
    })

    test('should distinguish between legitimate protection and false positives', async () => {
      let legitimateBlocks = 0
      let falsePositives = 0
      const actionId = 'false-positive-test'

      cyre.on(actionId, () => {
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        throttle: 100,
        detectChanges: true
      })

      // Scenario 1: Legitimate throttling (rapid same calls)
      await cyre.call(actionId, {value: 'same'})
      for (let i = 0; i < 5; i++) {
        const result = await cyre.call(actionId, {value: 'same'})
        if (!result.ok) {
          if (
            result.message.includes('Throttled') ||
            result.message.includes('unchanged')
          ) {
            legitimateBlocks++
          } else {
            falsePositives++
          }
        }
        vi.advanceTimersByTime(10) // Rapid calls
      }

      // Wait for throttle to clear
      vi.advanceTimersByTime(150)

      // Scenario 2: Proper spacing with different payloads (should all succeed)
      for (let i = 0; i < 10; i++) {
        const result = await cyre.call(actionId, {value: `different-${i}`})
        if (!result.ok) {
          falsePositives++
        }
        vi.advanceTimersByTime(120) // Proper spacing
      }

      // Should have legitimate blocks but no false positives
      expect(legitimateBlocks).toBeGreaterThan(0)
      expect(falsePositives).toBe(0)
    })
  })

  describe('Protection Configuration Validation', () => {
    test('should reject invalid protection combinations', () => {
      // Throttle + Debounce should be rejected
      const invalidResult = cyre.action({
        id: 'invalid-combo',
        throttle: 100,
        debounce: 200
      })

      expect(invalidResult.ok).toBe(false)
      expect(invalidResult.message).toContain('throttle and debounce')
    })

    test('should accept valid protection combinations', () => {
      // These should work
      const validCombos = [
        {throttle: 100, detectChanges: true},
        {debounce: 200, schema: {type: 'object'}},
        {detectChanges: true, block: false},
        {throttle: 50, transform: (x: any) => x}
      ]

      validCombos.forEach((combo, index) => {
        const result = cyre.action({
          id: `valid-combo-${index}`,
          ...combo
        })
        expect(result.ok).toBe(true)
      })
    })
  })
})
