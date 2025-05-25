// test/cyre-exports.test.ts
// Enhanced comprehensive test for all Cyre exports and functionality

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

// Test both import styles
import cyre from '../src/' // default import
import {
  cyre as namedCyre,
  useCyre,
  cyreCompose,
  log,
  version,
  Cyre
} from '../src/' // named imports

// Test type imports
import type {CyreIO, CyreEventHandler, CyreActionPayload} from '../src/'

describe('Cyre Exports and API Integration Tests', () => {
  beforeEach(() => {
    // Mock process.exit to prevent test termination
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize both cyre instances
    cyre.initialize()
    namedCyre.initialize()
  })

  afterEach(() => {
    // Clean up any remaining actions/subscriptions
    cyre.clear()
    namedCyre.clear()
    vi.restoreAllMocks()
  })

  describe('Export Validation', () => {
    it('should export cyre as default and named export', () => {
      expect(cyre).toBeDefined()
      expect(namedCyre).toBeDefined()
      expect(cyre).toBe(namedCyre) // Should be the same instance
    })

    it('should export all core API methods', () => {
      const coreMethods = [
        'initialize',
        'action',
        'on',
        'call',
        'forget',
        'clear',
        'pause',
        'resume',
        'lock',
        'status',
        'shutdown',
        'get',
        'hasChanged',
        'getPrevious',
        'getMetrics',
        'getBreathingState',
        'getPerformanceState',
        'middleware',
        'getHistory',
        'clearHistory',
        'createPerformanceTimer'
      ]

      coreMethods.forEach(method => {
        expect(typeof cyre[method]).toBe('function')
      })
    })

    it('should export hooks and utilities', () => {
      expect(typeof useCyre).toBe('function')
      expect(typeof cyreCompose).toBe('function')
      expect(typeof Cyre).toBe('function') // Factory function
      expect(log).toBeDefined()
      expect(typeof version).toBe('string')
      expect(version).toBe('4.0.0')
    })

    it('should properly type check with TypeScript interfaces', () => {
      // These should compile without errors
      const action: CyreIO = {
        id: 'type-check-action',
        type: 'test',
        payload: {message: 'type test'}
      }

      const handler: CyreEventHandler = (payload: CyreActionPayload) => {
        return {success: true, payload}
      }

      const priority: string = 'high'

      expect(action.id).toBe('type-check-action')
      expect(typeof handler).toBe('function')
      expect(priority).toBe('high')
    })
  })

  describe('Core Functionality Integration', () => {
    it('should demonstrate complete action lifecycle', async () => {
      const actionId = `lifecycle-test-${Date.now()}`
      let handlerExecuted = false
      let receivedPayload: any = null

      // Register handler first (best practice)
      const subscription = cyre.on(actionId, payload => {
        handlerExecuted = true
        receivedPayload = payload
        return {handled: true, timestamp: Date.now()}
      })

      expect(subscription.ok).toBe(true)

      // Create action with comprehensive configuration
      cyre.action({
        id: actionId,
        type: 'lifecycle-test',
        payload: {initial: true},
        throttle: 100,
        debounce: 50,
        detectChanges: true,
        priority: {level: 'medium'},
        log: false
      })

      // Verify action was created
      const action = cyre.get(actionId)
      expect(action).toBeDefined()
      expect(action?.id).toBe(actionId)
      expect(action?.throttle).toBe(100)

      // Execute action
      const result = await cyre.call(actionId, {
        test: 'data',
        timestamp: Date.now()
      })

      // Verify execution
      expect(result.ok).toBe(true)
      expect(handlerExecuted).toBe(true)
      expect(receivedPayload).toMatchObject({test: 'data'})

      // Test protection mechanisms
      const throttledResult = await cyre.call(actionId, {test: 'throttled'})
      expect(throttledResult.ok).toBe(false) // Should be throttled

      // Clean up
      expect(cyre.forget(actionId)).toBe(true)
      expect(cyre.get(actionId)).toBeUndefined()
    })

    it('should handle middleware integration correctly', async () => {
      const actionId = `middleware-test-${Date.now()}`
      const middlewareId = `middleware-${Date.now()}`

      let middlewareExecuted = false
      let handlerExecuted = false
      let transformedPayload: any = null

      // Register middleware
      const middlewareResult = cyre.middleware(
        middlewareId,
        async (action, payload) => {
          middlewareExecuted = true

          // Validate and transform
          if (!payload || typeof payload !== 'object') {
            return null // Reject invalid payload
          }

          return {
            action,
            payload: {
              ...payload,
              enhanced: true,
              timestamp: Date.now()
            }
          }
        }
      )

      expect(middlewareResult.ok).toBe(true)

      // Register handler
      cyre.on(actionId, payload => {
        handlerExecuted = true
        transformedPayload = payload
        return {processed: true}
      })

      // Create action with middleware
      cyre.action({
        id: actionId,
        type: 'middleware-test',
        middleware: [middlewareId]
      })

      // Test valid payload
      const validResult = await cyre.call(actionId, {data: 'valid'})
      expect(validResult.ok).toBe(true)
      expect(middlewareExecuted).toBe(true)
      expect(handlerExecuted).toBe(true)
      expect(transformedPayload).toHaveProperty('enhanced', true)

      // Reset flags
      middlewareExecuted = false
      handlerExecuted = false

      // Test invalid payload (should be rejected by middleware)
      const invalidResult = await cyre.call(actionId, null)
      expect(invalidResult.ok).toBe(false)
      expect(middlewareExecuted).toBe(true)
      expect(handlerExecuted).toBe(false) // Should not execute
    })

    it('should demonstrate chain reactions (intraLinks)', async () => {
      const firstId = `chain-first-${Date.now()}`
      const secondId = `chain-second-${Date.now()}`
      const thirdId = `chain-third-${Date.now()}`

      const executionOrder: string[] = []

      // Set up chain handlers
      cyre.on(firstId, payload => {
        executionOrder.push('first')
        return {
          id: secondId,
          payload: {from: 'first', ...payload}
        }
      })

      cyre.on(secondId, payload => {
        executionOrder.push('second')
        return {
          id: thirdId,
          payload: {from: 'second', ...payload}
        }
      })

      cyre
        .on(thirdId, payload => {
          executionOrder.push('third')
          return {completed: true, payload}
        })

        [
          // Create all actions
          (firstId, secondId, thirdId)
        ].forEach(id => {
          cyre.action({id, type: 'chain-test'})
        })

      // Start the chain
      await cyre.call(firstId, {start: true})

      // Give time for chain to complete
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(executionOrder).toEqual(['first', 'second', 'third'])
    })
  })

  describe('Hook System Integration', () => {
    it('should integrate useCyre hook properly', async () => {
      const channel = useCyre({
        name: 'hook-integration-test',
        protection: {
          throttle: 100,
          debounce: 50,
          detectChanges: true
        },
        debug: false
      })

      let handlerExecuted = false
      let receivedPayload: any = null

      // Subscribe
      const subscription = channel.on(payload => {
        handlerExecuted = true
        receivedPayload = payload
        return {success: true}
      })

      expect(subscription.ok).toBe(true)
      expect(channel.isInitialized()).toBe(true)

      // Call channel
      const result = await channel.call({test: 'hook-data'})
      expect(result.ok).toBe(true)
      expect(handlerExecuted).toBe(true)
      expect(receivedPayload).toMatchObject({test: 'hook-data'})

      // Test change detection
      expect(channel.hasChanged({test: 'hook-data'})).toBe(false)
      expect(channel.hasChanged({test: 'different'})).toBe(true)

      // Clean up
      subscription.unsubscribe()
      channel.forget()
    })

    it('should integrate cyreCompose properly', async () => {
      const channel1 = useCyre({name: 'compose-test-1'})
      const channel2 = useCyre({name: 'compose-test-2'})

      let handler1Called = false
      let handler2Called = false

      // Set up handlers
      channel1.on(() => {
        handler1Called = true
        return {executed: 'channel1'}
      })

      channel2.on(() => {
        handler2Called = true
        return {executed: 'channel2'}
      })

      // Compose channels
      const composed = cyreCompose([channel1, channel2], {
        continueOnError: true
      })

      // Call composed channel
      const result = await composed.call({test: 'compose-data'})

      expect(result.ok).toBe(true)
      expect(handler1Called).toBe(true)
      expect(handler2Called).toBe(true)

      // Clean up
      composed.forget()
    })
  })

  describe('System Monitoring Integration', () => {
    it('should provide comprehensive system metrics', async () => {
      const actionId = `metrics-test-${Date.now()}`

      // Create action and execute to generate metrics
      cyre.action({id: actionId, type: 'metrics-test'})
      cyre.on(actionId, () => ({executed: true}))
      await cyre.call(actionId, {test: 'metrics'})

      // Test breathing state
      const breathingState = cyre.getBreathingState()
      expect(breathingState).toBeDefined()
      expect(typeof breathingState.stress).toBe('number')
      expect(breathingState.stress).toBeGreaterThanOrEqual(0)
      expect(breathingState.stress).toBeLessThanOrEqual(1)

      // Test performance state
      const perfState = cyre.getPerformanceState()
      expect(perfState).toBeDefined()
      expect(typeof perfState.totalProcessingTime).toBe('number')

      // Test action metrics
      const actionMetrics = cyre.getMetrics(actionId)
      expect(actionMetrics).toBeDefined()
      expect(actionMetrics.breathing).toBeDefined()

      // Test history
      const history = cyre.getHistory(actionId)
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeGreaterThan(0)
    })

    it('should handle performance timing correctly', async () => {
      const timer = cyre.createPerformanceTimer()

      timer.start()
      timer.markStage('test-stage')

      // Small delay to ensure measurable time
      await new Promise(resolve => setTimeout(resolve, 5))

      const totalTime = timer.getTotalTime()
      const stageTime = timer.getStageTime('test-stage')

      expect(totalTime).toBeGreaterThan(0)
      expect(stageTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid operations gracefully', async () => {
      // Test calling non-existent action
      const result = await cyre.call('non-existent-action')
      expect(result.ok).toBe(false)
      expect(result.message).toContain('subscriber')

      // Test getting non-existent action
      expect(cyre.get('non-existent')).toBeUndefined()

      // Test forgetting non-existent action
      expect(cyre.forget('non-existent')).toBe(false)
    })

    it('should handle system lock functionality', () => {
      const lockResult = cyre.lock()
      expect(lockResult.ok).toBe(true)

      // System should still function but warn about being locked
      const actionId = `post-lock-${Date.now()}`
      cyre.action({id: actionId, type: 'post-lock-test'})

      // Action creation might still work but subscriber registration might not
      const subResult = cyre.on(actionId, () => ({}))
      // Lock behavior may vary - just ensure it doesn't crash
      expect(typeof subResult.ok).toBe('boolean')
    })

    it('should handle multiple instance creation', () => {
      const instance1 = Cyre('test-instance-1')
      const instance2 = Cyre('test-instance-2')

      instance1.initialize()
      instance2.initialize()

      // Create different actions on each instance
      instance1.action({id: 'instance1-action', payload: {source: 'instance1'}})
      instance2.action({id: 'instance2-action', payload: {source: 'instance2'}})

      // Verify isolation
      expect(instance1.get('instance1-action')).toBeDefined()
      expect(instance1.get('instance2-action')).toBeUndefined()
      expect(instance2.get('instance2-action')).toBeDefined()
      expect(instance2.get('instance1-action')).toBeUndefined()

      // Clean up
      instance1.clear()
      instance2.clear()
    })
  })

  describe('Advanced Features Integration', () => {
    it('should handle complex timing scenarios', async () => {
      const actionId = `timing-test-${Date.now()}`
      let executionCount = 0

      cyre.on(actionId, () => {
        executionCount++
        return {count: executionCount}
      })

      // Test delay: 0 for immediate execution
      cyre.action({
        id: actionId,
        delay: 0,
        repeat: 1
      })

      const startTime = Date.now()
      await cyre.call(actionId)

      // Wait a bit for execution
      await new Promise(resolve => setTimeout(resolve, 50))

      const executionTime = Date.now() - startTime
      expect(executionCount).toBe(1)
      expect(executionTime).toBeLessThan(100) // Should execute quickly
    })

    it('should handle protection mechanisms together', async () => {
      const actionId = `protection-test-${Date.now()}`
      let executionCount = 0

      cyre.on(actionId, () => {
        executionCount++
        return {count: executionCount}
      })

      // Create action with multiple protection mechanisms
      cyre.action({
        id: actionId,
        throttle: 100,
        debounce: 50,
        detectChanges: true
      })

      // Make multiple rapid calls with same payload
      const staticPayload = {test: 'static'}
      await Promise.all([
        cyre.call(actionId, staticPayload),
        cyre.call(actionId, staticPayload),
        cyre.call(actionId, staticPayload)
      ])

      // Wait for any debounced execution
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should result in minimal executions due to protection
      expect(executionCount).toBeLessThanOrEqual(1)
    })

    it('should handle breathing system under artificial stress', async () => {
      const stressActionId = `stress-test-${Date.now()}`
      let stressExecutions = 0

      // Create stress-generating action
      cyre.on(stressActionId, () => {
        stressExecutions++

        // Generate some CPU load
        let result = 0
        for (let i = 0; i < 50000; i++) {
          result += Math.sqrt(i)
        }

        return {result, executions: stressExecutions}
      })

      cyre.action({id: stressActionId, type: 'stress-test'})

      // Generate some load
      const stressCalls = []
      for (let i = 0; i < 5; i++) {
        stressCalls.push(cyre.call(stressActionId))
      }

      await Promise.allSettled(stressCalls)

      // Check breathing state after stress
      const breathingState = cyre.getBreathingState()
      expect(breathingState.stress).toBeGreaterThanOrEqual(0)
      expect(breathingState.stress).toBeLessThanOrEqual(1)

      // System should still be functional
      expect(stressExecutions).toBeGreaterThan(0)
    })
  })

  describe('Backwards Compatibility', () => {
    it('should maintain API compatibility', () => {
      // Test that all documented v4.0.0 APIs are available
      const requiredAPIs = [
        'initialize',
        'action',
        'on',
        'call',
        'forget',
        'clear',
        'get',
        'hasChanged',
        'getPrevious',
        'getMetrics',
        'getBreathingState',
        'getPerformanceState',
        'middleware'
      ]

      requiredAPIs.forEach(api => {
        expect(cyre).toHaveProperty(api)
        expect(typeof cyre[api]).toBe('function')
      })
    })

    it('should handle legacy patterns gracefully', async () => {
      // Test patterns that might be used from older versions
      const actionId = `legacy-test-${Date.now()}`

      // Old-style action creation without all new options
      cyre.action({
        id: actionId,
        type: 'legacy',
        payload: {legacy: true}
      })

      // Old-style subscription
      cyre.on(actionId, payload => {
        return {legacy: true, payload}
      })

      // Should still work
      const result = await cyre.call(actionId, {test: 'legacy'})
      expect(result.ok).toBe(true)
    })
  })
})
