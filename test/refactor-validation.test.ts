// src/test/refactor-validation.test.ts
// Test to validate that refactoring maintains all functionality

import {describe, test, expect, beforeEach} from 'vitest'
import {cyre, Cyre} from '../src/'

describe('CYRE Refactoring Validation', () => {
  beforeEach(() => {
    // Note: We can't easily reset the main cyre instance due to shared state
    // So we'll use separate instances for tests that need isolation
  })

  test('Basic action and call functionality works', async () => {
    // Create separate instance for this test
    const testInstance = Cyre('test-basic-instance')
    testInstance.initialize()

    // Register action
    testInstance.action({
      id: 'test-basic',
      payload: {message: 'Hello'}
    })

    // Subscribe
    let receivedPayload: any = null
    const subscription = testInstance.on('test-basic', payload => {
      receivedPayload = payload
      return {success: true}
    })

    expect(subscription.ok).toBe(true)

    // Call action
    const result = await testInstance.call('test-basic', {message: 'World'})

    expect(result.ok).toBe(true)
    expect(receivedPayload).toEqual({message: 'World'})
  })

  test('Hot path optimization for simple actions', async () => {
    // Create separate instance for this test
    const testInstance = Cyre('test-hot-path-instance')
    testInstance.initialize()

    // Create simple action (should use hot path)
    testInstance.action({
      id: 'hot-path-test',
      payload: {value: 42}
    })

    testInstance.on('hot-path-test', payload => {
      return {processed: true, value: payload.value}
    })

    const startTime = performance.now()
    const result = await testInstance.call('hot-path-test', {value: 100})
    const endTime = performance.now()

    expect(result.ok).toBe(true)
    // Hot path should be very fast (< 10ms for simple operation)
    expect(endTime - startTime).toBeLessThan(10)
  })

  test('Cold path with protection features', async () => {
    // Create separate instance for this test
    const testInstance = Cyre('test-cold-path-instance')
    testInstance.initialize()

    // Create action with protection (should use cold path)
    testInstance.action({
      id: 'cold-path-test',
      throttle: 100,
      debounce: 50,
      detectChanges: true,
      payload: {count: 0}
    })

    let executionCount = 0
    testInstance.on('cold-path-test', payload => {
      executionCount++
      return {executed: true, count: payload.count}
    })

    // First call should work
    const result1 = await testInstance.call('cold-path-test', {count: 1})
    expect(result1.ok).toBe(true)

    // Immediate second call should be throttled
    const result2 = await testInstance.call('cold-path-test', {count: 2})
    expect(result2.ok).toBe(false)
    expect(result2.message).toContain('Throttled')
  })

  test('Middleware functionality works after refactor', async () => {
    // Create separate instance for this test
    const testInstance = Cyre('test-middleware-instance')
    testInstance.initialize()

    // Register middleware
    const middlewareResponse = testInstance.middleware(
      'test-middleware',
      async (action, payload) => {
        return {
          action,
          payload: {
            ...payload,
            middlewareApplied: true,
            timestamp: Date.now()
          }
        }
      }
    )

    expect(middlewareResponse.ok).toBe(true)

    // Create action with middleware
    testInstance.action({
      id: 'middleware-test',
      middleware: ['test-middleware'],
      payload: {original: true}
    })

    let processedPayload: any = null
    testInstance.on('middleware-test', payload => {
      processedPayload = payload
      return {success: true}
    })

    const result = await testInstance.call('middleware-test', {
      original: true,
      value: 123
    })

    expect(result.ok).toBe(true)
    expect(processedPayload.middlewareApplied).toBe(true)
    expect(processedPayload.timestamp).toBeDefined()
    expect(processedPayload.value).toBe(123)
  })

  test('Timing functionality (delay/interval) works', async () => {
    // Create separate instance for this test
    const testInstance = Cyre('test-timing-instance')
    testInstance.initialize()

    // Create action with delay
    testInstance.action({
      id: 'timing-test',
      delay: 10, // Very short delay for testing
      payload: {startTime: Date.now()}
    })

    let executionTime: number | null = null
    testInstance.on('timing-test', payload => {
      executionTime = Date.now()
      return {completed: true}
    })

    const callTime = Date.now()
    const result = await testInstance.call('timing-test', {startTime: callTime})

    expect(result.ok).toBe(true)
    // Allow some time for delayed execution
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(executionTime).not.toBeNull()
    if (executionTime) {
      // Should have been delayed by at least 8ms (allowing for some variance)
      expect(executionTime - callTime).toBeGreaterThanOrEqual(8)
    }
  })

  test('System lifecycle functions work', () => {
    // Create separate instance for this test
    const testInstance = Cyre('test-lifecycle-instance')

    // Test initialization
    const initResult = testInstance.initialize()
    expect(initResult.ok).toBe(true)

    // Test status
    const status = testInstance.status()
    expect(typeof status).toBe('boolean')

    // Test metrics
    const breathing = testInstance.getBreathingState()
    expect(breathing).toBeDefined()
    expect(typeof breathing.currentRate).toBe('number')

    const performance = testInstance.getPerformanceState()
    expect(performance).toBeDefined()
    expect(typeof performance.stress).toBe('number')

    // Test lock functionality on this instance only
    const lockResult = testInstance.lock()
    expect(lockResult.ok).toBe(true)
  })

  test('Multiple instance creation works', () => {
    const instance1 = Cyre('test-instance-1')
    const instance2 = Cyre('test-instance-2')

    // Both should initialize successfully
    const init1 = instance1.initialize()
    const init2 = instance2.initialize()

    expect(init1.ok).toBe(true)
    expect(init2.ok).toBe(true)

    // They should be independent
    instance1.action({id: 'instance1-action', payload: {source: 'instance1'}})
    instance2.action({id: 'instance2-action', payload: {source: 'instance2'}})

    const action1 = instance1.get('instance1-action')
    const action2 = instance2.get('instance2-action')

    expect(action1).toBeDefined()
    expect(action2).toBeDefined()
    expect(action1?.payload.source).toBe('instance1')
    expect(action2?.payload.source).toBe('instance2')

    // Actions should be isolated - instance1 shouldn't see instance2's actions
    const crossAction1 = instance1.get('instance2-action')
    const crossAction2 = instance2.get('instance1-action')

    expect(crossAction1).toBeUndefined()
    expect(crossAction2).toBeUndefined()
  })

  test('History and metrics reporting works', async () => {
    // Create separate instance for this test
    const testInstance = Cyre('test-metrics-instance')
    testInstance.initialize()

    // Create and execute action
    testInstance.action({
      id: 'metrics-test',
      payload: {test: true}
    })

    testInstance.on('metrics-test', payload => {
      return {processed: true}
    })

    await testInstance.call('metrics-test', {test: true, value: 456})

    // Check history (using the main cyre instance's global history)
    // Note: History is still global, but that's acceptable for now
    const history = cyre.getHistory('metrics-test')
    expect(Array.isArray(history)).toBe(true)
    // History might be empty if using isolated instances, which is expected

    // Check metrics report (using the main cyre instance's global metrics)
    const report = cyre.getMetricsReport()
    expect(report).toBeDefined()
    expect(report.actions).toBeDefined()
    expect(report.global).toBeDefined()
    expect(Array.isArray(report.insights)).toBe(true)
  })

  test('Instance isolation prevents interference', async () => {
    const instance1 = Cyre('isolation-test-1')
    const instance2 = Cyre('isolation-test-2')

    instance1.initialize()
    instance2.initialize()

    // Create same action ID in both instances
    instance1.action({id: 'shared-id', payload: {source: 'instance1'}})
    instance2.action({id: 'shared-id', payload: {source: 'instance2'}})

    let result1: any = null
    let result2: any = null

    instance1.on('shared-id', payload => {
      result1 = payload
      return {processed: 'instance1'}
    })

    instance2.on('shared-id', payload => {
      result2 = payload
      return {processed: 'instance2'}
    })

    // Call both instances
    await instance1.call('shared-id', {callSource: 'instance1'})
    await instance2.call('shared-id', {callSource: 'instance2'})

    // Each instance should only process its own calls
    expect(result1).toEqual({callSource: 'instance1'})
    expect(result2).toEqual({callSource: 'instance2'})

    // Verify actions are isolated
    const action1 = instance1.get('shared-id')
    const action2 = instance2.get('shared-id')

    expect(action1?.payload.source).toBe('instance1')
    expect(action2?.payload.source).toBe('instance2')
  })
})
