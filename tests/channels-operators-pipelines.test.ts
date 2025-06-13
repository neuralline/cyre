// tests/channels-operators-pipelines.test.ts
// File location: /tests/channels-operators-pipelines.test.ts
// Comprehensive test suite for Cyre action operators/talents - FIXED

import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src'
import {TimeKeeper} from '../src/components/cyre-timekeeper'

/*

      C.Y.R.E - A.C.T.I.O.N - O.P.E.R.A.T.O.R.S - T.A.L.E.N.T.S - T.E.S.T.S
      
      Comprehensive testing of all action operators/talents:
      
      1. TIMING OPERATORS: delay, interval, repeat
      2. PROTECTION OPERATORS: throttle, debounce, maxWait, detectChanges  
      3. PROCESSING OPERATORS: schema, required, condition, transform, selector
      4. SYSTEM OPERATORS: priority, block, path
      5. COMBINATIONS: Complex operator interactions
      6. EDGE CASES: Error scenarios and boundary conditions

*/

describe('Cyre Action Operators/Talents - Comprehensive Suite', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    await cyre.initialize()
    cyre.clear()
    TimeKeeper.reset()
  })

  afterEach(() => {
    cyre.clear()
    TimeKeeper.reset()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  // ============================================================================
  // PART 1: TIMING OPERATORS
  // ============================================================================

  describe('Timing Operators', () => {
    describe('delay operator', () => {
      test('should wait specified delay before first execution', async () => {
        let executionCount = 0
        const executions: number[] = []
        const actionId = 'delay-test'
        const delayTime = 1000

        // Handler first (CYRE pattern)
        cyre.on(actionId, () => {
          executionCount++
          executions.push(Date.now())
          return {executed: true, count: executionCount}
        })

        // Action with delay
        cyre.action({
          id: actionId,
          delay: delayTime
        })

        const startTime = Date.now()

        // Call action with delay - should schedule, not execute immediately
        const resultPromise = cyre.call(actionId, {test: 'delay'})

        // CYRE v4.0.0: Actions with delay WAIT before first execution
        expect(executionCount).toBe(0) // Should not execute immediately

        // Advance by half the delay - still should not execute
        vi.advanceTimersByTime(500)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(0)

        // Advance to complete the delay
        vi.advanceTimersByTime(500)
        await vi.runAllTimersAsync()

        // Now it should have executed
        expect(executionCount).toBe(1)
        expect(executions).toHaveLength(1)

        // Verify timing
        const executionTime = executions[0]
        expect(executionTime - startTime).toBeGreaterThanOrEqual(delayTime)

        await resultPromise // Ensure promise resolves
      })

      test('should handle processing pipeline with all operators', async () => {
        let executionCount = 0
        let finalPayload: any = null
        const actionId = 'full-pipeline-test'

        // Handler first
        cyre.on(actionId, payload => {
          executionCount++
          finalPayload = payload
          return {executed: true, payload}
        })

        // Action with processing operators only (no timing)
        cyre.action({
          id: actionId,
          required: true,
          schema: (payload: any) => ({
            ok: payload && typeof payload.value === 'number',
            data: payload,
            errors: []
          }),
          condition: (payload: any) => payload.value > 0,
          selector: (payload: any) => payload.data,
          transform: (payload: any) => ({
            ...payload,
            processed: true,
            timestamp: Date.now()
          })
        })

        // Valid payload that passes all checks
        const validPayload = {
          data: {value: 42, name: 'test'},
          metadata: {ignored: true}
        }

        const result = await cyre.call(actionId, validPayload)

        // Processing operators without timing should execute immediately
        expect(result.ok).toBe(true)
        expect(executionCount).toBe(1)
        expect(finalPayload.value).toBe(42)
        expect(finalPayload.name).toBe('test')
        expect(finalPayload.processed).toBe(true)
        expect(finalPayload.timestamp).toBeDefined()
        expect(finalPayload.metadata).toBeUndefined() // Should be removed by selector

        // Invalid payload that fails condition
        const invalidResult = await cyre.call(actionId, {
          data: {value: -1, name: 'negative'}
        })

        expect(invalidResult.ok).toBe(false)
        expect(executionCount).toBe(1) // Should not execute again
      })

      test('should handle timing + processing operators together', async () => {
        let executionCount = 0
        const executions: any[] = []
        const actionId = 'timing-processing-test'

        // Handler first
        cyre.on(actionId, payload => {
          executionCount++
          executions.push({
            count: executionCount,
            payload,
            timestamp: Date.now()
          })
          return {executed: true}
        })

        // Action with both timing AND processing
        cyre.action({
          id: actionId,
          delay: 100,
          interval: 200,
          repeat: 3,
          condition: (payload: any) => payload?.active === true,
          transform: (payload: any) => ({
            ...payload,
            execution: executionCount + 1
          })
        })

        // Call with valid condition
        cyre.call(actionId, {active: true, data: 'test'})

        // CYRE v4.0.0: Should not execute immediately due to delay
        expect(executionCount).toBe(0)

        // First execution after delay
        vi.advanceTimersByTime(100)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(1)
        expect(executions[0].payload.execution).toBe(1)

        // Subsequent executions at interval
        vi.advanceTimersByTime(200)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(2)

        vi.advanceTimersByTime(200)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(3)

        // Should stop after repeat count
        vi.advanceTimersByTime(200)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(3) // No more executions
      })
    })

    describe('Edge Cases & Error Handling', () => {
      test('should handle conflicting operators gracefully', async () => {
        const actionId = 'conflicting-operators-test'

        // Throttle and debounce together (should error)
        const conflictResult = cyre.action({
          id: actionId,
          throttle: 100,
          debounce: 100
        })

        expect(conflictResult.ok).toBe(false)
        expect(conflictResult.message).toContain(
          'throttle and debounce cannot both be active'
        )
      })

      test('should handle maxWait without debounce (should error)', async () => {
        const actionId = 'maxwait-no-debounce-test'

        const result = cyre.action({
          id: actionId,
          maxWait: 200
          // Missing debounce
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain('maxWait requires debounce')
      })

      test('should handle invalid maxWait value', async () => {
        const actionId = 'invalid-maxwait-test'

        const result = cyre.action({
          id: actionId,
          debounce: 200,
          maxWait: 100 // Less than debounce
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain(
          'maxWait must be greater than debounce'
        )
      })

      test('should handle operator errors during execution', async () => {
        let executionCount = 0
        const actionId = 'operator-error-test'

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          condition: () => {
            throw new Error('Condition function error')
          }
        })

        const result = await cyre.call(actionId, {test: 'data'})

        expect(result.ok).toBe(false)
        expect(result.message).toContain('error')
        expect(executionCount).toBe(0)
      })

      test('should handle empty/null operator values', async () => {
        const actionId = 'empty-operators-test'

        // Handler first
        cyre.on(actionId, () => ({executed: true}))

        // These should be valid (operators ignored when null/undefined)
        const result = cyre.action({
          id: actionId,
          delay: undefined,
          throttle: 0, // Should be treated as no throttling
          debounce: 0 // Should be treated as no debouncing
        })

        expect(result.ok).toBe(true)

        // Should be able to call normally
        const callResult = await cyre.call(actionId, {test: 'data'})
        expect(callResult.ok).toBe(true)
      })

      test('should handle very large timing values', async () => {
        const actionId = 'large-timing-test'

        // Handler first
        cyre.on(actionId, () => ({executed: true}))

        const result = cyre.action({
          id: actionId,
          delay: Number.MAX_SAFE_INTEGER,
          repeat: 1
        })

        expect(result.ok).toBe(true)

        // Should handle the large values without throwing
        const callResult = cyre.call(actionId)
        expect(callResult).toBeDefined() // Should not throw
      })

      test('should handle rapid action creation and destruction', async () => {
        for (let i = 0; i < 100; i++) {
          const actionId = `rapid-${i}`

          // Handler first
          cyre.on(actionId, () => ({executed: true}))

          const createResult = cyre.action({
            id: actionId,
            delay: Math.random() * 100,
            interval: Math.random() * 100 + 50,
            repeat: Math.floor(Math.random() * 5) + 1
          })

          expect(createResult.ok).toBe(true)

          // Call the action
          cyre.call(actionId, {iteration: i})

          // Immediately forget it
          const forgetResult = cyre.forget(actionId)
          expect(forgetResult).toBe(true)
        }

        // Should handle rapid creation/destruction without issues
        expect(true).toBe(true)
      })
    })

    // ============================================================================
    // PART 7: PERFORMANCE & STRESS TESTS
    // ============================================================================

    describe('Performance & Stress Tests', () => {
      test('should handle many concurrent timed actions', async () => {
        const numActions = 100
        const actionIds: string[] = []
        const executionCounts = new Map<string, number>()

        // Create many actions with different timing
        for (let i = 0; i < numActions; i++) {
          const actionId = `concurrent-${i}`
          actionIds.push(actionId)
          executionCounts.set(actionId, 0)

          // Handler first
          cyre.on(actionId, () => {
            const current = executionCounts.get(actionId) || 0
            executionCounts.set(actionId, current + 1)
            return {executed: true}
          })

          cyre.action({
            id: actionId,
            delay: i % 3 === 0 ? 50 : undefined,
            throttle: i % 7 === 0 ? 100 : undefined,
            interval: i % 5 === 0 ? 200 : undefined,
            repeat: i % 5 === 0 ? 2 : 1
          })
        }

        // Make many calls with varying payloads
        for (let round = 0; round < 10; round++) {
          for (let i = 0; i < numActions; i++) {
            const actionId = actionIds[i]
            await cyre.call(actionId, {
              value: round * 2, // Varies by round
              round,
              data: `test-${i}-${round}`
            })

            vi.advanceTimersByTime(5)
          }

          vi.advanceTimersByTime(50)
          await vi.runAllTimersAsync()
        }

        // Final timer cleanup
        vi.advanceTimersByTime(1000)
        await vi.runAllTimersAsync()

        // Verify at least some executions occurred
        let totalExecutions = 0
        for (const count of executionCounts.values()) {
          totalExecutions += count
        }

        expect(totalExecutions).toBeGreaterThan(50) // Reasonable minimum

        // Cleanup
        actionIds.forEach(id => {
          cyre.forget(id)
          TimeKeeper.forget(id)
        })
      })

      test('should handle complex operator combinations under load', async () => {
        const actionId = 'complex-operators-test'
        let executionCount = 0

        cyre.on(actionId, payload => {
          executionCount++
          return {executed: true, count: executionCount}
        })

        cyre.action({
          id: actionId,
          throttle: 50,
          detectChanges: true,
          schema: (payload: any) => ({
            ok: payload && typeof payload.value === 'number',
            data: payload
          }),
          condition: (payload: any) => payload.value > 0,
          transform: (payload: any) => ({
            ...payload,
            processed: Date.now()
          })
        })

        // Rapid calls with mostly same payload (detectChanges should help)
        for (let i = 0; i < 100; i++) {
          await cyre.call(actionId, {value: i % 5}) // Only 5 different values
          vi.advanceTimersByTime(10)
        }

        vi.advanceTimersByTime(1000)
        await vi.runAllTimersAsync()

        // Should be much less than 100 due to throttling and change detection
        expect(executionCount).toBeGreaterThan(0)
        expect(executionCount).toBeLessThan(50)
      })

      test('should maintain timing accuracy under load', async () => {
        const actionId = 'timing-accuracy-test'
        const executions: number[] = []
        const expectedInterval = 100

        cyre.on(actionId, () => {
          executions.push(Date.now())
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          interval: expectedInterval,
          repeat: 10
        })

        const startTime = Date.now()
        cyre.call(actionId)

        // Execute all intervals - CYRE v4.0.0 waits for first interval
        for (let i = 0; i < 10; i++) {
          vi.advanceTimersByTime(expectedInterval)
          await vi.runAllTimersAsync()
        }

        // Check timing accuracy
        expect(executions).toHaveLength(10)

        for (let i = 0; i < executions.length; i++) {
          const expectedTime = startTime + (i + 1) * expectedInterval
          const actualTime = executions[i]
          const timeDifference = Math.abs(actualTime - expectedTime)

          // Should be very accurate with fake timers
          expect(timeDifference).toBeLessThan(10)
        }
      })
    })

    // ============================================================================
    // PART 8: INTEGRATION WITH CYRE CORE
    // ============================================================================

    describe('Integration with Cyre Core', () => {
      test('should work with cyre.get() to inspect action configuration', async () => {
        const actionId = 'inspect-test'

        cyre.action({
          id: actionId,
          delay: 500,
          throttle: 200,
          priority: {level: 'high'}
        })

        const action = cyre.get(actionId)
        expect(action).toBeDefined()
        expect(action?.delay).toBe(500)
        expect(action?.throttle).toBe(200)
        expect(action?.priority?.level).toBe('high')
      })

      test('should work with cyre.forget() to clean up timed actions', async () => {
        const actionId = 'forget-test'
        let executionCount = 0

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          interval: 100,
          repeat: 10
        })

        cyre.call(actionId)

        // Let it execute once
        vi.advanceTimersByTime(100)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(1)

        // Forget the action
        const forgetResult = cyre.forget(actionId)
        expect(forgetResult).toBe(true)

        // Should not execute anymore
        vi.advanceTimersByTime(500)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(1) // No additional executions

        TimeKeeper.forget(actionId)
      })

      test('should handle action replacement with new timing configuration', async () => {
        const actionId = 'replacement-test'
        let executionCount = 0

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        // Original action with slow interval
        cyre.action({
          id: actionId,
          interval: 200,
          repeat: 2
        })

        cyre.call(actionId)

        // Execute once
        vi.advanceTimersByTime(200)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(1)

        // Replace with faster interval
        cyre.action({
          id: actionId,
          interval: 50,
          repeat: 3
        })

        cyre.call(actionId)

        // Execute at new faster pace
        for (let i = 0; i < 3; i++) {
          vi.advanceTimersByTime(50)
          await vi.runAllTimersAsync()
        }

        // Should have executed original + new executions
        expect(executionCount).toBe(4) // 1 + 3

        TimeKeeper.forget(actionId)
      })
    })

    // ============================================================================
    // PART 9: REAL-WORLD SCENARIOS
    // ============================================================================

    describe('Real-World Scenarios', () => {
      test('should handle periodic health check with retry logic', async () => {
        const actionId = 'health-check'
        let checkCount = 0
        let failureCount = 0

        cyre.on(actionId, async () => {
          checkCount++

          // Simulate failure every 3rd check
          if (checkCount % 3 === 0) {
            failureCount++
            throw new Error('Health check failed')
          }

          return {healthy: true, timestamp: Date.now()}
        })

        cyre.action({
          id: actionId,
          interval: 100,
          repeat: 10
        })

        cyre.call(actionId)

        // Run all health checks
        for (let i = 0; i < 10; i++) {
          vi.advanceTimersByTime(100)
          await vi.runAllTimersAsync()
        }

        expect(checkCount).toBe(10)
        expect(failureCount).toBe(3) // Every 3rd check fails

        TimeKeeper.forget(actionId)
      })

      test('should handle user activity debouncing', async () => {
        const actionId = 'user-activity-save'
        let saveCount = 0

        cyre.on(actionId, async data => {
          saveCount++
          return {saved: true, data}
        })

        cyre.action({
          id: actionId,
          debounce: 200,
          maxWait: 1000
        })

        // Rapid user activity
        for (let i = 0; i < 10; i++) {
          cyre.call(actionId, {content: `Draft ${i}`})
          vi.advanceTimersByTime(50)
        }

        // Should not save yet (within debounce)
        expect(saveCount).toBe(0)

        // Wait for debounce
        vi.advanceTimersByTime(200)
        await vi.runAllTimersAsync()

        // Should save once after debounce
        expect(saveCount).toBe(1)
      })

      test('should handle rate-limited API calls', async () => {
        const actionId = 'api-call'
        let apiCallCount = 0

        cyre.on(actionId, async data => {
          apiCallCount++
          return {result: 'success', data}
        })

        cyre.action({
          id: actionId,
          throttle: 100 // Max 1 call per 100ms
        })

        // Rapid API call attempts
        for (let i = 0; i < 20; i++) {
          await cyre.call(actionId, {request: i})
          vi.advanceTimersByTime(20) // Calls every 20ms
        }

        vi.advanceTimersByTime(1000)
        await vi.runAllTimersAsync()

        // Should be throttled to much fewer calls
        expect(apiCallCount).toBeGreaterThan(0)
        expect(apiCallCount).toBeLessThan(10) // Significantly throttled
      })
    })
  })
})
