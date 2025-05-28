// test/simplified-core.test.ts
// Updated tests for simplified core architecture

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre, useCyre} from '../src/'

describe('Simplified Core CYRE Architecture', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    cyre.initialize()
  })

  afterEach(() => {
    cyre.clear()
    vi.restoreAllMocks()
  })

  describe('Core CYRE - Built-in Protections Only', () => {
    it('should register actions with built-in protections', async () => {
      const actionId = 'test-core-action'
      let executed = false

      // Register action with built-in protections
      cyre.action({
        id: actionId,
        throttle: 100,
        detectChanges: true,
        payload: {initial: true}
      })

      cyre.on(actionId, payload => {
        executed = true
        return {success: true, payload}
      })

      // First call should work
      const result1 = await cyre.call(actionId, {test: 'data'})
      expect(result1.ok).toBe(true)
      expect(executed).toBe(true)

      // Reset execution flag
      executed = false

      // Wait to ensure we're not throttled
      await new Promise(resolve => setTimeout(resolve, 110))

      // Second call with same payload should be blocked by change detection
      const result2 = await cyre.call(actionId, {test: 'data'})
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('unchanged')
      expect(executed).toBe(false)

      // Third call with different payload should work (after throttle period)
      const result3 = await cyre.call(actionId, {test: 'different'})
      expect(result3.ok).toBe(true)
      expect(executed).toBe(true)
    })

    it('should handle repeat: 0 correctly', async () => {
      const actionId = 'zero-repeat-test'
      let executed = false

      cyre.action({
        id: actionId,
        repeat: 0
      })

      cyre.on(actionId, () => {
        executed = true
        return {executed: true}
      })

      const result = await cyre.call(actionId)
      expect(result.ok).toBe(false) // Should be blocked
      expect(result.message).toContain('repeat: 0')
      expect(executed).toBe(false)
    })

    it('should not have external middleware in core', () => {
      // Core should not have middleware method
      expect(cyre.middleware).toBeUndefined()
    })
  })

  describe('useCyre Hook - Unlimited Middleware', () => {
    it('should support unlimited channel-specific middleware', async () => {
      const channel = useCyre({name: 'middleware-test'})

      let middleware1Called = false
      let middleware2Called = false
      let middleware3Called = false
      let handlerCalled = false

      // Add multiple middleware
      channel.middleware(async (payload, next) => {
        middleware1Called = true
        const result = await next({...payload, step1: true})
        return result
      })

      channel.middleware(async (payload, next) => {
        middleware2Called = true
        const result = await next({...payload, step2: true})
        return result
      })

      channel.middleware(async (payload, next) => {
        middleware3Called = true
        const result = await next({...payload, step3: true})
        return result
      })

      // Set up handler
      channel.on(payload => {
        handlerCalled = true
        expect(payload).toMatchObject({
          step1: true,
          step2: true,
          step3: true
        })
        return {processed: true}
      })

      // Call channel
      const result = await channel.call({initial: true})
      expect(result.ok).toBe(true)

      // Verify all middleware and handler were called
      expect(middleware1Called).toBe(true)
      expect(middleware2Called).toBe(true)
      expect(middleware3Called).toBe(true)
      expect(handlerCalled).toBe(true)

      channel.forget()
    })

    it('should support middleware management', () => {
      const channel = useCyre({name: 'management-test'})

      // Add middleware
      channel.middleware(async (payload, next) => next(payload))
      channel.middleware(async (payload, next) => next(payload))

      const info = channel.getMiddlewareInfo()
      expect(info.total).toBe(2)
      expect(info.enabled).toBe(2)
      expect(info.disabled).toBe(0)

      // Disable one middleware
      const middlewareId = info.middlewares[0].id
      expect(channel.disableMiddleware(middlewareId)).toBe(true)

      const updatedInfo = channel.getMiddlewareInfo()
      expect(updatedInfo.enabled).toBe(1)
      expect(updatedInfo.disabled).toBe(1)

      // Clear all middleware
      channel.clearMiddleware()
      const clearedInfo = channel.getMiddlewareInfo()
      expect(clearedInfo.total).toBe(0)

      channel.forget()
    })

    it('should isolate middleware between channels', async () => {
      const channel1 = useCyre({name: 'isolation-1'})
      const channel2 = useCyre({name: 'isolation-2'})

      let channel1MiddlewareCalled = false
      let channel2MiddlewareCalled = false

      // Add middleware to each channel
      channel1.middleware(async (payload, next) => {
        channel1MiddlewareCalled = true
        return next({...payload, channel: 1})
      })

      channel2.middleware(async (payload, next) => {
        channel2MiddlewareCalled = true
        return next({...payload, channel: 2})
      })

      // Set up handlers
      channel1.on(payload => {
        expect(payload.channel).toBe(1)
        return {processed: true}
      })

      channel2.on(payload => {
        expect(payload.channel).toBe(2)
        return {processed: true}
      })

      // Call channel1 - should only trigger channel1 middleware
      await channel1.call({test: true})
      expect(channel1MiddlewareCalled).toBe(true)
      expect(channel2MiddlewareCalled).toBe(false)

      // Reset flags
      channel1MiddlewareCalled = false
      channel2MiddlewareCalled = false

      // Call channel2 - should only trigger channel2 middleware
      await channel2.call({test: true})
      expect(channel1MiddlewareCalled).toBe(false)
      expect(channel2MiddlewareCalled).toBe(true)

      channel1.forget()
      channel2.forget()
    })

    it('should handle middleware errors gracefully', async () => {
      const channel = useCyre({name: 'error-test'})

      let handlerCalled = false

      // Add middleware that conditionally throws error
      channel.middleware(async (payload, next) => {
        if (payload.block) {
          throw new Error('Middleware error')
        }
        return next(payload)
      })

      // Set up handler
      channel.on(() => {
        handlerCalled = true
        return {processed: true}
      })

      // Call with blocking condition
      const blockedResult = await channel.call({block: true})
      expect(blockedResult.ok).toBe(false)
      expect(blockedResult.message).toContain('Middleware error')
      expect(handlerCalled).toBe(false)

      // Reset handler flag
      handlerCalled = false

      // Call without blocking condition
      const allowedResult = await channel.call({block: false})
      expect(allowedResult.ok).toBe(true)
      expect(handlerCalled).toBe(true)

      channel.forget()
    })

    it('should support adding multiple middleware at once', () => {
      const channel = useCyre({name: 'batch-test'})

      const middlewares = [
        async (payload, next) => next({...payload, batch1: true}),
        async (payload, next) => next({...payload, batch2: true}),
        async (payload, next) => next({...payload, batch3: true})
      ]

      const addedIds = channel.addMiddleware(middlewares)
      expect(addedIds).toHaveLength(3)

      const info = channel.getMiddlewareInfo()
      expect(info.total).toBe(3)
      expect(info.enabled).toBe(3)

      channel.forget()
    })
  })

  describe('Built-in Protections System', () => {
    it('should apply throttle protection', async () => {
      const actionId = 'throttle-test'
      let executionCount = 0

      cyre.action({
        id: actionId,
        throttle: 100
      })

      cyre.on(actionId, () => {
        executionCount++
        return {count: executionCount}
      })

      // First call should succeed
      const result1 = await cyre.call(actionId)
      expect(result1.ok).toBe(true)
      expect(executionCount).toBe(1)

      // Immediate second call should be throttled
      const result2 = await cyre.call(actionId)
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('Throttled')
      expect(executionCount).toBe(1)

      // After throttle period, should work again
      await new Promise(resolve => setTimeout(resolve, 110))
      const result3 = await cyre.call(actionId)
      expect(result3.ok).toBe(true)
      expect(executionCount).toBe(2)
    })

    it('should apply debounce protection', async () => {
      const actionId = 'debounce-test'
      let executionCount = 0

      cyre.action({
        id: actionId,
        debounce: 100
      })

      cyre.on(actionId, payload => {
        executionCount++
        return {count: executionCount, payload}
      })

      // Make rapid calls - should be debounced
      const result1 = await cyre.call(actionId, {call: 1})
      const result2 = await cyre.call(actionId, {call: 2})
      const result3 = await cyre.call(actionId, {call: 3})

      // All should return success but delayed
      expect(result1.ok).toBe(true)
      expect(result1.message).toContain('Debounced')
      expect(result2.ok).toBe(true)
      expect(result3.ok).toBe(true)

      // No immediate execution
      expect(executionCount).toBe(0)

      // Wait for debounce to complete
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should have executed once with last payload (from timer)
      expect(executionCount).toBe(1)
    })

    it('should apply change detection protection', async () => {
      const actionId = 'change-detection-test'
      let executionCount = 0

      cyre.action({
        id: actionId,
        detectChanges: true
      })

      cyre.on(actionId, payload => {
        executionCount++
        return {count: executionCount, payload}
      })

      // First call should work
      const result1 = await cyre.call(actionId, {data: 'test'})
      expect(result1.ok).toBe(true)
      expect(executionCount).toBe(1)

      // Same payload should be blocked
      const result2 = await cyre.call(actionId, {data: 'test'})
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('unchanged')
      expect(executionCount).toBe(1)

      // Different payload should work
      const result3 = await cyre.call(actionId, {data: 'different'})
      expect(result3.ok).toBe(true)
      expect(executionCount).toBe(2)
    })

    it('should handle system recuperation protection', async () => {
      const actionId = 'recuperation-test'
      let executionCount = 0

      // Create action with different priority levels
      cyre.action({
        id: actionId,
        priority: {level: 'medium'}
      })

      cyre.on(actionId, () => {
        executionCount++
        return {count: executionCount}
      })

      // Simulate system stress (this would normally be handled by breathing system)
      // For testing, we'll create a high-priority action that should work even under stress
      const criticalActionId = 'critical-test'

      cyre.action({
        id: criticalActionId,
        priority: {level: 'critical'}
      })

      cyre.on(criticalActionId, () => {
        executionCount++
        return {critical: true}
      })

      // Both should work under normal conditions
      const normalResult = await cyre.call(actionId)
      expect(normalResult.ok).toBe(true)

      const criticalResult = await cyre.call(criticalActionId)
      expect(criticalResult.ok).toBe(true)

      expect(executionCount).toBe(2)
    })
  })

  describe('Integration Tests', () => {
    it('should work with both core and hook systems together', async () => {
      // Core action with built-in protections
      const coreActionId = 'core-integration'
      cyre.action({
        id: coreActionId,
        throttle: 50
      })

      let coreExecuted = false
      cyre.on(coreActionId, () => {
        coreExecuted = true
        return {core: true}
      })

      // Hook channel with middleware
      const hookChannel = useCyre({name: 'hook-integration'})

      let hookExecuted = false
      let middlewareExecuted = false

      hookChannel.middleware(async (payload, next) => {
        middlewareExecuted = true
        return next({...payload, enhanced: true})
      })

      hookChannel.on(payload => {
        hookExecuted = true
        expect(payload.enhanced).toBe(true)
        return {hook: true}
      })

      // Test both systems
      const coreResult = await cyre.call(coreActionId)
      expect(coreResult.ok).toBe(true)
      expect(coreExecuted).toBe(true)

      const hookResult = await hookChannel.call({test: true})
      expect(hookResult.ok).toBe(true)
      expect(hookExecuted).toBe(true)
      expect(middlewareExecuted).toBe(true)

      // Verify they don't interfere with each other
      expect(coreExecuted).toBe(true)
      expect(hookExecuted).toBe(true)

      hookChannel.forget()
    })

    it('should maintain performance with multiple channels', async () => {
      const channels = []
      const results = []

      // Create multiple channels with middleware
      for (let i = 0; i < 10; i++) {
        const channel = useCyre({name: `perf-test-${i}`})

        // Add middleware to each
        channel.middleware(async (payload, next) => {
          return next({...payload, channelId: i})
        })

        channel.on(payload => {
          return {processed: true, channelId: payload.channelId}
        })

        channels.push(channel)
      }

      // Execute all channels
      const startTime = performance.now()

      for (let i = 0; i < channels.length; i++) {
        const result = await channels[i].call({test: true})
        results.push(result)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Verify all executed successfully
      expect(results).toHaveLength(10)
      results.forEach((result, index) => {
        expect(result.ok).toBe(true)
      })

      // Reasonable performance (should be well under 1 second for 10 channels)
      expect(totalTime).toBeLessThan(1000)

      // Cleanup
      channels.forEach(channel => channel.forget())
    })

    it('should handle complex middleware chains efficiently', async () => {
      const channel = useCyre({name: 'complex-chain'})

      // Add 20 middleware functions
      for (let i = 0; i < 20; i++) {
        channel.middleware(async (payload, next) => {
          const result = await next({
            ...payload,
            [`step${i}`]: true,
            stepCount: (payload.stepCount || 0) + 1
          })
          return result
        })
      }

      let finalPayload = null
      channel.on(payload => {
        finalPayload = payload
        return {processed: true}
      })

      const startTime = performance.now()
      const result = await channel.call({initial: true})
      const endTime = performance.now()

      expect(result.ok).toBe(true)
      expect(finalPayload.stepCount).toBe(20)
      expect(finalPayload.step0).toBe(true)
      expect(finalPayload.step19).toBe(true)

      // Should execute reasonably quickly even with 20 middleware
      const executionTime = endTime - startTime
      expect(executionTime).toBeLessThan(100) // Less than 100ms

      const info = channel.getMiddlewareInfo()
      expect(info.total).toBe(20)
      expect(info.enabled).toBe(20)

      channel.forget()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle middleware errors without crashing core', async () => {
      const channel = useCyre({name: 'error-handling'})

      // Add middleware that throws
      channel.middleware(async () => {
        throw new Error('Intentional middleware error')
      })

      let handlerCalled = false
      channel.on(() => {
        handlerCalled = true
        return {processed: true}
      })

      // Should handle error gracefully
      const result = await channel.call({test: true})
      expect(result.ok).toBe(false)
      expect(result.message).toContain('error')
      expect(handlerCalled).toBe(false)

      // Core should still work
      const coreActionId = 'core-still-works'
      cyre.action({id: coreActionId})

      let coreHandlerCalled = false
      cyre.on(coreActionId, () => {
        coreHandlerCalled = true
        return {core: true}
      })

      const coreResult = await cyre.call(coreActionId)
      expect(coreResult.ok).toBe(true)
      expect(coreHandlerCalled).toBe(true)

      channel.forget()
    })

    it('should handle channel cleanup properly', () => {
      const channel = useCyre({name: 'cleanup-test'})

      // Add middleware and subscription
      channel.middleware(async (payload, next) => next(payload))
      channel.on(() => ({processed: true}))

      // Verify setup
      expect(channel.isInitialized()).toBe(true)
      expect(channel.getMiddlewareInfo().total).toBe(1)
      expect(channel.getSubscriptionCount()).toBe(1)

      // Forget channel
      const forgotten = channel.forget()
      expect(forgotten).toBe(true)

      // Verify cleanup
      expect(channel.isInitialized()).toBe(false)
      expect(channel.getMiddlewareInfo().total).toBe(0)
    })
  })
})
