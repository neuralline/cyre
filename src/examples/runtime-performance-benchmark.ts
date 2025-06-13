// tests/action-operators-talents.test.ts
// File location: /tests/action-operators-talents.test.ts
// Comprehensive test suite for Cyre action operators/talents

import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/app'
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

        cyre.on(actionId, () => {
          executionCount++
          executions.push(Date.now())
          return {executed: true, count: executionCount}
        })

        cyre.action({
          id: actionId,
          delay: delayTime
        })

        const startTime = Date.now()
        const resultPromise = cyre.call(actionId, {test: 'delay'})

        // Should not execute immediately
        expect(executionCount).toBe(1) // Only first executes due to throttle

      // Wait for throttle to clear
      vi.advanceTimersByTime(200)

      // Different payload should execute
      await cyre.call(actionId, {value: 'different'})
      expect(executionCount).toBe(2)

      // Null payload should be blocked by required
      const nullResult = await cyre.call(actionId, null)
      expect(nullResult.ok).toBe(false)
      expect(executionCount).toBe(2)
    })

    test('should handle processing pipeline with all operators', async () => {
      let executionCount = 0
      let finalPayload: any = null
      const actionId = 'full-pipeline-test'

      cyre.on(actionId, (payload) => {
        executionCount++
        finalPayload = payload
        return {executed: true, payload}
      })

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
      expect(executionCount).toBe(1) // Should not execute
    })

    test('should handle timing + processing operators together', async () => {
      let executionCount = 0
      const executions: any[] = []
      const actionId = 'timing-processing-test'

      cyre.on(actionId, (payload) => {
        executionCount++
        executions.push({
          count: executionCount,
          payload,
          timestamp: Date.now()
        })
        return {executed: true}
      })

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

      // Should not execute immediately (delay)
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
      expect(executionCount).toBe(3)
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
      expect(conflictResult.message).toContain('throttle and debounce cannot both be active')
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
      expect(result.message).toContain('maxWait must be greater than debounce')
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

      // These should be valid (operators ignored when null/undefined)
      const result = cyre.action({
        id: actionId,
        delay: undefined,
        interval: null as any,
        throttle: 0, // Should be treated as no throttling
        debounce: 0  // Should be treated as no debouncing
      })

      expect(result.ok).toBe(true)
    })

    test('should handle very large timing values', async () => {
      const actionId = 'large-timing-test'

      const result = cyre.action({
        id: actionId,
        delay: Number.MAX_SAFE_INTEGER,
        interval: Number.MAX_SAFE_INTEGER,
        repeat: 1
      })

      expect(result.ok).toBe(true)

      // Should handle the large values without throwing
      cyre.call(actionId)
      expect(true).toBe(true) // If we get here, no error was thrown
    })

    test('should handle rapid action creation and destruction', async () => {
      for (let i = 0; i < 100; i++) {
        const actionId = `rapid-${i}`
        
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
      const actionIds: string[] = []
      const executionCounts = new Map<string, number>()
      const numActions = 100

      for (let i = 0; i < numActions; i++) {
        const actionId = `concurrent-${i}`
        actionIds.push(actionId)
        executionCounts.set(actionId, 0)

        cyre.on(actionId, () => {
          const current = executionCounts.get(actionId) || 0
          executionCounts.set(actionId, current + 1)
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          interval: 50 + (i % 50), // Vary intervals
          repeat: 3
        })

        cyre.call(actionId, {index: i})
      }

      // Execute all timers
      for (let tick = 0; tick < 20; tick++) {
        vi.advanceTimersByTime(50)
        await vi.runAllTimersAsync()
      }

      // Verify executions
      let totalExecutions = 0
      for (const count of executionCounts.values()) {
        totalExecutions += count
        expect(count).toBeGreaterThan(0)
        expect(count).toBeLessThanOrEqual(3)
      }

      expect(totalExecutions).toBeGreaterThan(numActions)

      // Cleanup
      actionIds.forEach(id => TimeKeeper.forget(id))
    })

    test('should handle complex operator combinations under load', async () => {
      const actionIds: string[] = []
      const executionCounts = new Map<string, number>()
      const numActions = 50

      for (let i = 0; i < numActions; i++) {
        const actionId = `complex-load-${i}`
        actionIds.push(actionId)
        executionCounts.set(actionId, 0)

        cyre.on(actionId, (payload) => {
          const current = executionCounts.get(actionId) || 0
          executionCounts.set(actionId, current + 1)
          return {executed: true, payload}
        })

        cyre.action({
          id: actionId,
          throttle: 25,
          detectChanges: true,
          required: true,
          condition: (payload: any) => payload?.value > i * 0.5,
          transform: (payload: any) => ({
            ...payload,
            processed: Date.now(),
            actionIndex: i
          }),
          delay: i % 10 === 0 ? 100 : undefined,
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

      expect(totalExecutions).toBeGreaterThan(0)

      // Cleanup
      actionIds.forEach(id => {
        cyre.forget(id)
        TimeKeeper.forget(id)
      })
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

      // Execute all intervals
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
        expect(timeDifference).toBeLessThanOrEqual(1)
      }

      TimeKeeper.forget(actionId)
    })
  })

  // ============================================================================
  // PART 8: INTEGRATION WITH CYRE CORE FEATURES
  // ============================================================================

  describe('Integration with Cyre Core', () => {
    test('should work with cyre.get() to inspect action configuration', async () => {
      const actionId = 'inspect-config-test'

      cyre.action({
        id: actionId,
        delay: 500,
        interval: 1000,
        repeat: 5,
        throttle: 100,
        required: true,
        priority: 'high',
        path: 'test/integration'
      })

      const actionInfo = cyre.get(actionId)

      expect(actionInfo).toBeDefined()
      expect(actionInfo?.delay).toBe(500)
      expect(actionInfo?.interval).toBe(1000)
      expect(actionInfo?.repeat).toBe(5)
      expect(actionInfo?.throttle).toBe(100)
      expect(actionInfo?.required).toBe(true)
      expect(actionInfo?.priority).toBe('high')
      expect(actionInfo?.path).toBe('test/integration')
    })

    test('should work with cyre.forget() to clean up timed actions', async () => {
      let executionCount = 0
      const actionId = 'forget-timing-test'

      cyre.on(actionId, () => {
        executionCount++
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        interval: 100,
        repeat: true
      })

      cyre.call(actionId)

      // Let it execute a few times
      vi.advanceTimersByTime(250)
      await vi.runAllTimersAsync()
      
      const initialCount = executionCount
      expect(initialCount).toBeGreaterThan(0)

      // Forget the action
      const forgetResult = cyre.forget(actionId)
      expect(forgetResult).toBe(true)

      // Should stop executing
      vi.advanceTimersByTime(500)
      await vi.runAllTimersAsync()
      
      expect(executionCount).toBe(initialCount)
    })

    test('should handle action replacement with new timing configuration', async () => {
      let executionCount = 0
      const actionId = 'replacement-test'

      cyre.on(actionId, () => {
        executionCount++
        return {executed: true}
      })

      // Original action with slow timing
      cyre.action({
        id: actionId,
        interval: 500,
        repeat: true
      })

      cyre.call(actionId)
      vi.advanceTimersByTime(500)
      await vi.runAllTimersAsync()
      expect(executionCount).toBe(1)

      // Replace with faster timing
      cyre.action({
        id: actionId, // Same ID
        interval: 100,
        repeat: 3
      })

      cyre.call(actionId)

      // Should use new timing
      vi.advanceTimersByTime(300)
      await vi.runAllTimersAsync()
      
      // Should have executed 3 more times at faster interval
      expect(executionCount).toBe(4) // 1 + 3

      TimeKeeper.forget(actionId)
    })
  })

  // ============================================================================
  // PART 9: REAL-WORLD SCENARIOS
  // ============================================================================

  describe('Real-World Scenarios', () => {
    test('should handle periodic health check with retry logic', async () => {
      let checkCount = 0
      let failureCount = 0
      const actionId = 'health-check'

      cyre.on(actionId, (payload) => {
        checkCount++
        
        // Simulate occasional failures
        if (checkCount % 3 === 0) {
          failureCount++
          throw new Error('Health check failed')
        }
        
        return {healthy: true, checkCount}
      })

      cyre.action({
        id: actionId,
        interval: 100,
        repeat: 10,
        throttle: 50, // Prevent spam
        required: true
      })

      cyre.call(actionId, {service: 'api'})

      // Execute health checks
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(100)
        await vi.runAllTimersAsync()
      }

      expect(checkCount).toBe(10)
      expect(failureCount).toBe(3) // Every 3rd check fails

      TimeKeeper.forget(actionId)
    })

    test('should handle user activity debouncing', async () => {
      let saveCount = 0
      let lastSavedData: any = null
      const actionId = 'auto-save'

      cyre.on(actionId, (payload) => {
        saveCount++
        lastSavedData = payload
        return {saved: true, timestamp: Date.now()}
      })

      cyre.action({
        id: actionId,
        debounce: 200,
        maxWait: 500,
        detectChanges: true,
        transform: (payload: any) => ({
          ...payload,
          saveId: `save-${Date.now()}`
        })
      })

      // Rapid typing simulation
      const typingData = ['H', 'He', 'Hel', 'Hell', 'Hello']
      
      for (const data of typingData) {
        await cyre.call(actionId, {content: data})
        vi.advanceTimersByTime(50) // Fast typing
      }

      // Should not save yet (within debounce)
      expect(saveCount).toBe(0)

      // Wait for debounce
      vi.advanceTimersByTime(200)
      await vi.runAllTimersAsync()

      // Should save once with final content
      expect(saveCount).toBe(1)
      expect(lastSavedData.content).toBe('Hello')
    })

    test('should handle rate-limited API calls', async () => {
      let apiCallCount = 0
      const apiResponses: any[] = []
      const actionId = 'api-request'

      cyre.on(actionId, (payload) => {
        apiCallCount++
        const response = {
          id: apiCallCount,
          data: payload,
          timestamp: Date.now()
        }
        apiResponses.push(response)
        return response
      })

      cyre.action({
        id: actionId,
        throttle: 100, // Rate limiting
        required: true,
        schema: (payload: any) => ({
          ok: payload && payload.endpoint,
          data: payload,
          errors: payload?.endpoint ? [] : ['endpoint required']
        })
      })

      // Rapid API requests
      const requests = [
        {endpoint: '/users', method: 'GET'},
        {endpoint: '/users', method: 'GET'}, // Duplicate - should be throttled
        {endpoint: '/posts', method: 'GET'},
        {endpoint: '/posts', method: 'GET'}, // Duplicate - should be throttled
      ]

      const results = []
      for (const request of requests) {
        results.push(await cyre.call(actionId, request))
        vi.advanceTimersByTime(25) // Rapid calls
      }

      // Only first and third should succeed (throttled)
      expect(results[0].ok).toBe(true)
      expect(results[1].ok).toBe(false) // Throttled
      expect(results[2].ok).toBe(false) // Still throttled
      expect(results[3].ok).toBe(false) // Still throttled

      expect(apiCallCount).toBe(1)

      // Wait for throttle to clear and try again
      vi.advanceTimersByTime(200)
      
      const laterResult = await cyre.call(actionId, {endpoint: '/comments', method: 'GET'})
      expect(laterResult.ok).toBe(true)
      expect(apiCallCount).toBe(2)
    })
  })
})Count).toBe(0)

        // Advance time to just before delay
        vi.advanceTimersByTime(delayTime - 1)
        expect(executionCount).toBe(0)

        // Advance time to complete delay
        vi.advanceTimersByTime(1)
        await vi.runAllTimersAsync()

        expect(executionCount).toBe(1)
        expect(executions[0] - startTime).toBe(delayTime)

        await resultPromise
      })

      test('should handle delay: 0 (waits 0ms, not immediate)', async () => {
        let executionCount = 0
        const actionId = 'delay-zero-test'

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          delay: 0
        })

        const resultPromise = cyre.call(actionId)
        
        // Should not execute immediately even with delay: 0
        expect(executionCount).toBe(0)

        // Should execute after event loop tick
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(1)

        await resultPromise
      })

      test('should handle negative delay (should error)', async () => {
        const actionId = 'negative-delay-test'

        const result = cyre.action({
          id: actionId,
          delay: -100
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain('negative')
      })
    })

    describe('interval operator', () => {
      test('should wait interval before first execution', async () => {
        let executionCount = 0
        const executions: number[] = []
        const actionId = 'interval-test'
        const intervalTime = 500

        cyre.on(actionId, () => {
          executionCount++
          executions.push(Date.now())
          return {executed: true, count: executionCount}
        })

        cyre.action({
          id: actionId,
          interval: intervalTime,
          repeat: true // Required for interval
        })

        const startTime = Date.now()
        cyre.call(actionId, {test: 'interval'})

        // Should not execute immediately
        expect(executionCount).toBe(0)

        // Advance to first execution
        vi.advanceTimersByTime(intervalTime)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(1)

        // Advance to second execution
        vi.advanceTimersByTime(intervalTime)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(2)

        // Verify timing intervals
        const interval1 = executions[0] - startTime
        const interval2 = executions[1] - executions[0]
        expect(interval1).toBe(intervalTime)
        expect(interval2).toBe(intervalTime)

        TimeKeeper.forget(actionId)
      })

      test('should require repeat to be specified', async () => {
        const actionId = 'interval-no-repeat-test'

        const result = cyre.action({
          id: actionId,
          interval: 1000
          // Missing repeat - should error
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain('interval requires repeat')
      })

      test('should handle zero interval', async () => {
        let executionCount = 0
        const actionId = 'zero-interval-test'

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          interval: 0,
          repeat: 3
        })

        cyre.call(actionId)

        // Should execute rapidly but still wait between executions
        await vi.runAllTimersAsync()
        
        expect(executionCount).toBe(3)
        TimeKeeper.forget(actionId)
      })
    })

    describe('repeat operator', () => {
      test('should execute exactly N times when repeat is number', async () => {
        let executionCount = 0
        const actionId = 'repeat-number-test'
        const repeatCount = 5

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true, count: executionCount}
        })

        cyre.action({
          id: actionId,
          interval: 100,
          repeat: repeatCount
        })

        cyre.call(actionId)

        // Execute all intervals
        for (let i = 0; i < repeatCount; i++) {
          vi.advanceTimersByTime(100)
          await vi.runAllTimersAsync()
        }

        expect(executionCount).toBe(repeatCount)

        // Should not execute beyond repeat count
        vi.advanceTimersByTime(200)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(repeatCount)
      })

      test('should execute infinitely when repeat: true', async () => {
        let executionCount = 0
        const actionId = 'repeat-infinite-test'

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          interval: 50,
          repeat: true
        })

        cyre.call(actionId)

        // Execute many intervals
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(50)
          await vi.runAllTimersAsync()
        }

        expect(executionCount).toBe(20)

        // Should continue beyond any specific count
        for (let i = 0; i < 10; i++) {
          vi.advanceTimersByTime(50)
          await vi.runAllTimersAsync()
        }

        expect(executionCount).toBe(30)
        TimeKeeper.forget(actionId)
      })

      test('should not execute when repeat: 0', async () => {
        let executionCount = 0
        const actionId = 'repeat-zero-test'

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        const result = cyre.action({
          id: actionId,
          repeat: 0
        })

        expect(result.ok).toBe(true) // Action registered successfully
        
        const callResult = await cyre.call(actionId)
        expect(callResult.ok).toBe(true) // Call succeeds but doesn't execute
        expect(callResult.message).toContain('not execute')

        expect(executionCount).toBe(0)
      })

      test('should handle repeat: Infinity', async () => {
        let executionCount = 0
        const actionId = 'repeat-infinity-test'

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          interval: 25,
          repeat: Infinity
        })

        cyre.call(actionId)

        // Execute many times
        for (let i = 0; i < 50; i++) {
          vi.advanceTimersByTime(25)
          await vi.runAllTimersAsync()
        }

        expect(executionCount).toBe(50)
        TimeKeeper.forget(actionId)
      })
    })
  })

  // ============================================================================
  // PART 2: COMBINED TIMING OPERATORS (YOUR EXAMPLE)
  // ============================================================================

  describe('Combined Timing Operators', () => {
    test('delay 1000 with interval 1000, repeat 10 - YOUR EXAMPLE', async () => {
      let executionCount = 0
      const executions: number[] = []
      const actionId = 'delay 1000 with interval 1000'

      cyre.on(actionId, () => {
        executionCount++
        executions.push(Date.now())
        return {executed: true, count: executionCount}
      })

      cyre.action({
        id: actionId,
        repeat: 10,
        interval: 1000,
        delay: 1000
      })

      const startTime = Date.now()
      cyre.call(actionId, {test: 'combined-timing'})

      // Should not execute immediately
      expect(executionCount).toBe(0)

      // First execution after delay (1000ms)
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
      expect(executionCount).toBe(1)
      expect(executions[0] - startTime).toBe(1000)

      // Execute remaining 9 times with interval timing
      for (let i = 1; i < 10; i++) {
        vi.advanceTimersByTime(1000)
        await vi.runAllTimersAsync()
        expect(executionCount).toBe(i + 1)
        
        // Verify interval timing (not delay)
        const timeDiff = executions[i] - executions[i - 1]
        expect(timeDiff).toBe(1000)
      }

      // Should stop after exactly 10 executions
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
      expect(executionCount).toBe(10)

      // Verify total execution pattern
      expect(executions).toHaveLength(10)
      expect(executions[0] - startTime).toBe(1000) // First execution after delay
      expect(executions[9] - startTime).toBe(10000) // Last execution at expected time
    })

    test('delay overrides interval for first execution', async () => {
      let executionCount = 0
      const executions: number[] = []
      const actionId = 'delay-override-test'

      cyre.on(actionId, () => {
        executionCount++
        executions.push(Date.now())
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        delay: 500,      // Different from interval
        interval: 1000,
        repeat: 3
      })

      const startTime = Date.now()
      cyre.call(actionId)

      // First execution after delay (500ms, not interval 1000ms)
      vi.advanceTimersByTime(500)
      await vi.runAllTimersAsync()
      expect(executionCount).toBe(1)

      // Subsequent executions follow interval timing
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
      expect(executionCount).toBe(2)

      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
      expect(executionCount).toBe(3)

      // Verify timing pattern
      expect(executions[0] - startTime).toBe(500)  // Delay for first
      expect(executions[1] - executions[0]).toBe(1000) // Interval for subsequent  
      expect(executions[2] - executions[1]).toBe(1000) // Interval for subsequent
    })

    test('delay with single execution (no interval)', async () => {
      let executionCount = 0
      const actionId = 'delay-single-test'

      cyre.on(actionId, () => {
        executionCount++
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        delay: 300
        // No interval or repeat - should execute once
      })

      cyre.call(actionId)

      // Should not execute immediately
      expect(executionCount).toBe(0)

      // Should execute after delay
      vi.advanceTimersByTime(300)
      await vi.runAllTimersAsync()
      expect(executionCount).toBe(1)

      // Should not execute again
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
      expect(executionCount).toBe(1)
    })
  })

  // ============================================================================
  // PART 3: PROTECTION OPERATORS
  // ============================================================================

  describe('Protection Operators', () => {
    describe('throttle operator', () => {
      test('should prevent execution within throttle window', async () => {
        let executionCount = 0
        const actionId = 'throttle-test'

        cyre.on(actionId, (payload) => {
          executionCount++
          return {executed: true, payload}
        })

        cyre.action({
          id: actionId,
          throttle: 100
        })

        // Rapid calls within throttle window
        const results = []
        for (let i = 0; i < 5; i++) {
          results.push(await cyre.call(actionId, {attempt: i}))
          vi.advanceTimersByTime(10) // Fast calls
        }

        // Only first should succeed
        expect(results[0].ok).toBe(true)
        expect(results.slice(1).every(r => !r.ok)).toBe(true)
        expect(executionCount).toBe(1)

        // Wait for throttle to clear
        vi.advanceTimersByTime(200)

        // Should execute again
        const laterResult = await cyre.call(actionId, {attempt: 'later'})
        expect(laterResult.ok).toBe(true)
        expect(executionCount).toBe(2)
      })
    })

    describe('debounce operator', () => {
      test('should delay execution until after calls stop', async () => {
        let executionCount = 0
        let lastPayload: any = null
        const actionId = 'debounce-test'

        cyre.on(actionId, (payload) => {
          executionCount++
          lastPayload = payload
          return {executed: true, payload}
        })

        cyre.action({
          id: actionId,
          debounce: 100
        })

        // Rapid calls that should be debounced
        for (let i = 0; i < 5; i++) {
          await cyre.call(actionId, {value: i})
          vi.advanceTimersByTime(50) // Within debounce window
        }

        // Should not have executed yet
        expect(executionCount).toBe(0)

        // Wait for debounce to complete
        vi.advanceTimersByTime(100)
        await vi.runAllTimersAsync()

        // Should execute once with last payload
        expect(executionCount).toBe(1)
        expect(lastPayload.value).toBe(4)
      })

      test('should respect maxWait with debounce', async () => {
        let executionCount = 0
        const actionId = 'debounce-maxwait-test'

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          debounce: 100,
          maxWait: 200
        })

        // Continuous calls that would normally prevent debounce execution
        for (let i = 0; i < 10; i++) {
          await cyre.call(actionId, {continuous: i})
          vi.advanceTimersByTime(50) // Keep within debounce window
        }

        // Should execute due to maxWait (at 200ms mark)
        expect(executionCount).toBe(1)
      })
    })

    describe('detectChanges operator', () => {
      test('should only execute when payload changes', async () => {
        let executionCount = 0
        const executions: any[] = []
        const actionId = 'detect-changes-test'

        cyre.on(actionId, (payload) => {
          executionCount++
          executions.push(payload)
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          detectChanges: true
        })

        // Same payload multiple times
        await cyre.call(actionId, {value: 'same'})
        await cyre.call(actionId, {value: 'same'})
        await cyre.call(actionId, {value: 'same'})

        // Should execute only once
        expect(executionCount).toBe(1)

        // Different payload
        await cyre.call(actionId, {value: 'different'})
        expect(executionCount).toBe(2)

        // Back to same payload as first
        await cyre.call(actionId, {value: 'same'})
        expect(executionCount).toBe(3) // Should execute because it's different from 'different'
      })
    })
  })

  // ============================================================================
  // PART 4: PROCESSING OPERATORS
  // ============================================================================

  describe('Processing Operators', () => {
    describe('schema operator', () => {
      test('should validate payload with schema function', async () => {
        let executionCount = 0
        const actionId = 'schema-test'

        cyre.on(actionId, (payload) => {
          executionCount++
          return {executed: true, payload}
        })

        cyre.action({
          id: actionId,
          schema: (payload: any) => ({
            ok: payload && typeof payload.value === 'number',
            data: payload,
            errors: payload ? [] : ['payload required']
          })
        })

        // Valid payload
        const validResult = await cyre.call(actionId, {value: 42})
        expect(validResult.ok).toBe(true)
        expect(executionCount).toBe(1)

        // Invalid payload
        const invalidResult = await cyre.call(actionId, {value: 'not-a-number'})
        expect(invalidResult.ok).toBe(false)
        expect(executionCount).toBe(1) // Should not execute

        // Null payload
        const nullResult = await cyre.call(actionId, null)
        expect(nullResult.ok).toBe(false)
        expect(executionCount).toBe(1) // Should not execute
      })
    })

    describe('required operator', () => {
      test('should block execution when payload is null/undefined', async () => {
        let executionCount = 0
        const actionId = 'required-test'

        cyre.on(actionId, (payload) => {
          executionCount++
          return {executed: true, payload}
        })

        cyre.action({
          id: actionId,
          required: true
        })

        // Valid payload
        const validResult = await cyre.call(actionId, {data: 'valid'})
        expect(validResult.ok).toBe(true)
        expect(executionCount).toBe(1)

        // Null payload
        const nullResult = await cyre.call(actionId, null)
        expect(nullResult.ok).toBe(false)
        expect(executionCount).toBe(1)

        // Undefined payload
        const undefinedResult = await cyre.call(actionId)
        expect(undefinedResult.ok).toBe(false)
        expect(executionCount).toBe(1)

        // Empty object should pass
        const emptyResult = await cyre.call(actionId, {})
        expect(emptyResult.ok).toBe(true)
        expect(executionCount).toBe(2)
      })
    })

    describe('condition operator', () => {
      test('should only execute when condition returns true', async () => {
        let executionCount = 0
        const actionId = 'condition-test'

        cyre.on(actionId, (payload) => {
          executionCount++
          return {executed: true, payload}
        })

        cyre.action({
          id: actionId,
          condition: (payload: any) => payload?.active === true
        })

        // Condition true
        const trueResult = await cyre.call(actionId, {active: true, data: 'test'})
        expect(trueResult.ok).toBe(true)
        expect(executionCount).toBe(1)

        // Condition false
        const falseResult = await cyre.call(actionId, {active: false, data: 'test'})
        expect(falseResult.ok).toBe(false)
        expect(executionCount).toBe(1)

        // Missing condition field
        const missingResult = await cyre.call(actionId, {data: 'test'})
        expect(missingResult.ok).toBe(false)
        expect(executionCount).toBe(1)
      })
    })

    describe('transform operator', () => {
      test('should transform payload before execution', async () => {
        let executionCount = 0
        let receivedPayload: any = null
        const actionId = 'transform-test'

        cyre.on(actionId, (payload) => {
          executionCount++
          receivedPayload = payload
          return {executed: true, payload}
        })

        cyre.action({
          id: actionId,
          transform: (payload: any) => ({
            ...payload,
            transformed: true,
            timestamp: Date.now()
          })
        })

        const originalPayload = {data: 'test', value: 42}
        const result = await cyre.call(actionId, originalPayload)

        expect(result.ok).toBe(true)
        expect(executionCount).toBe(1)
        expect(receivedPayload.data).toBe('test')
        expect(receivedPayload.value).toBe(42)
        expect(receivedPayload.transformed).toBe(true)
        expect(receivedPayload.timestamp).toBeDefined()
      })
    })

    describe('selector operator', () => {
      test('should extract specific part of payload', async () => {
        let executionCount = 0
        let receivedPayload: any = null
        const actionId = 'selector-test'

        cyre.on(actionId, (payload) => {
          executionCount++
          receivedPayload = payload
          return {executed: true, payload}
        })

        cyre.action({
          id: actionId,
          selector: (payload: any) => payload?.user?.profile
        })

        const complexPayload = {
          user: {
            profile: {name: 'John', age: 30},
            settings: {theme: 'dark'}
          },
          metadata: {version: '1.0'}
        }

        const result = await cyre.call(actionId, complexPayload)

        expect(result.ok).toBe(true)
        expect(executionCount).toBe(1)
        expect(receivedPayload).toEqual({name: 'John', age: 30})
      })
    })
  })

  // ============================================================================
  // PART 5: SYSTEM OPERATORS
  // ============================================================================

  describe('System Operators', () => {
    describe('block operator', () => {
      test('should prevent execution when blocked', async () => {
        let executionCount = 0
        const actionId = 'block-test'

        cyre.on(actionId, () => {
          executionCount++
          return {executed: true}
        })

        cyre.action({
          id: actionId,
          block: true
        })

        const result = await cyre.call(actionId, {test: 'data'})

        expect(result.ok).toBe(false)
        expect(result.message).toContain('blocked')
        expect(executionCount).toBe(0)
      })
    })

    describe('priority operator', () => {
      test('should accept different priority levels', async () => {
        const priorities = ['low', 'normal', 'high', 'critical'] as const

        for (const priority of priorities) {
          const actionId = `priority-${priority}-test`
          
          const result = cyre.action({
            id: actionId,
            priority
          })

          expect(result.ok).toBe(true)
          
          const actionInfo = cyre.get(actionId)
          expect(actionInfo?.priority).toBe(priority)
        }
      })
    })

    describe('path operator', () => {
      test('should organize actions by hierarchical path', async () => {
        const paths = [
          'app/users',
          'app/users/profile', 
          'app/settings/theme',
          'system/monitoring'
        ]

        for (const path of paths) {
          const actionId = `${path.replace('/', '-')}-test`
          
          const result = cyre.action({
            id: actionId,
            path
          })

          expect(result.ok).toBe(true)
          
          const actionInfo = cyre.get(actionId)
          expect(actionInfo?.path).toBe(path)
        }
      })
    })
  })
})
