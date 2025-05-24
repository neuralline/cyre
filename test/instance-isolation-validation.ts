// test/instance-isolation-validation.test.ts
// Validation test for the instance isolation fixes

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {Cyre} from '../src'

/*
 * Instance Isolation Validation Test
 *
 * This test validates the fixes for:
 * 1. Middleware functionality works after refactor
 * 2. Multiple instance creation works
 * 3. Instance isolation prevents interference
 */

describe('Instance Isolation Validation', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    console.log('===== INSTANCE ISOLATION VALIDATION TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== INSTANCE ISOLATION VALIDATION TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test that middleware functionality works after refactor
   */
  it('should properly apply middleware and transform payloads', async () => {
    // Create isolated instance
    const instance = Cyre('middleware-test-instance')
    instance.initialize()

    // Track processed payload
    let processedPayload: any = null

    // Register middleware that transforms payload
    const middlewareResult = instance.middleware(
      'test-middleware',
      async (action, payload) => {
        console.log('[MIDDLEWARE] Processing payload:', payload)

        // Transform the payload
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

    console.log('[TEST] Middleware registration result:', middlewareResult)
    expect(middlewareResult.ok).toBe(true)

    // Register action with middleware
    instance.action({
      id: 'middleware-test-action',
      type: 'test',
      middleware: ['test-middleware'],
      payload: {initial: true}
    })

    // Register handler to capture processed payload
    instance.on('middleware-test-action', payload => {
      console.log('[HANDLER] Received payload:', payload)
      processedPayload = payload
      return {executed: true}
    })

    // Call the action
    const result = await instance.call('middleware-test-action', {value: 123})

    console.log('[TEST] Call result:', result)
    console.log('[TEST] Processed payload:', processedPayload)

    // Verify middleware was applied
    expect(result.ok).toBe(true)
    expect(processedPayload).toBeDefined()
    expect(processedPayload.middlewareApplied).toBe(true)
    expect(processedPayload.timestamp).toBeDefined()
    expect(processedPayload.value).toBe(123)

    instance.shutdown()
  })

  /**
   * Test that multiple instances can be created and work independently
   */
  it('should create multiple independent instances', async () => {
    // Create two separate instances
    const instance1 = Cyre('instance-1')
    const instance2 = Cyre('instance-2')

    instance1.initialize()
    instance2.initialize()

    // Register different actions on each instance
    instance1.action({
      id: 'instance1-action',
      type: 'test',
      payload: {source: 'instance1'}
    })

    instance2.action({
      id: 'instance2-action',
      type: 'test',
      payload: {source: 'instance2'}
    })

    // Verify actions exist on their respective instances
    const action1 = instance1.get('instance1-action')
    const action2 = instance2.get('instance2-action')

    console.log('[TEST] Instance1 action:', action1)
    console.log('[TEST] Instance2 action:', action2)

    expect(action1).toBeDefined()
    expect(action2).toBeDefined()
    expect(action1?.payload.source).toBe('instance1')
    expect(action2?.payload.source).toBe('instance2')

    // Verify actions don't exist on wrong instances
    expect(instance1.get('instance2-action')).toBeUndefined()
    expect(instance2.get('instance1-action')).toBeUndefined()

    // Clean up
    instance1.shutdown()
    instance2.shutdown()
  })

  /**
   * Test that instances are properly isolated and don't interfere
   */
  it('should maintain isolation between instances', async () => {
    // Create two instances
    const instance1 = Cyre('isolated-instance-1')
    const instance2 = Cyre('isolated-instance-2')

    instance1.initialize()
    instance2.initialize()

    // Track results from each instance
    let result1: any = null
    let result2: any = null

    // Set up handlers on each instance
    instance1.on('isolated-test', payload => {
      console.log('[INSTANCE1] Handler called with:', payload)
      result1 = {callSource: 'instance1', ...payload}
      return result1
    })

    instance2.on('isolated-test', payload => {
      console.log('[INSTANCE2] Handler called with:', payload)
      result2 = {callSource: 'instance2', ...payload}
      return result2
    })

    // Register actions on each instance
    instance1.action({
      id: 'isolated-test',
      type: 'isolation-test',
      payload: {initial: true}
    })

    instance2.action({
      id: 'isolated-test',
      type: 'isolation-test',
      payload: {initial: true}
    })

    // Call each instance separately
    await instance1.call('isolated-test', {testData: 'from-instance1'})
    await instance2.call('isolated-test', {testData: 'from-instance2'})

    console.log('[TEST] Result1:', result1)
    console.log('[TEST] Result2:', result2)

    // Each instance should only process its own calls
    expect(result1).toEqual({
      callSource: 'instance1',
      testData: 'from-instance1'
    })
    expect(result2).toEqual({
      callSource: 'instance2',
      testData: 'from-instance2'
    })

    // Clean up
    instance1.shutdown()
    instance2.shutdown()
  })

  /**
   * Test that instance locking works independently
   */
  it('should lock instances independently', async () => {
    // Create two instances
    const instance1 = Cyre('lockable-instance-1')
    const instance2 = Cyre('lockable-instance-2')

    instance1.initialize()
    instance2.initialize()

    // Lock only instance1
    const lockResult = instance1.lock()
    expect(lockResult.ok).toBe(true)

    // Try to add actions to both instances
    // Instance1 should reject (locked)
    instance1.action({
      id: 'locked-action',
      type: 'test',
      payload: {test: true}
    })

    // Instance2 should accept (not locked)
    instance2.action({
      id: 'unlocked-action',
      type: 'test',
      payload: {test: true}
    })

    // Verify instance1 action was rejected
    expect(instance1.get('locked-action')).toBeUndefined()

    // Verify instance2 action was accepted
    expect(instance2.get('unlocked-action')).toBeDefined()

    // Clean up
    instance1.shutdown()
    instance2.shutdown()
  })

  /**
   * Test middleware isolation between instances
   */
  it('should maintain middleware isolation between instances', async () => {
    // Create two instances
    const instance1 = Cyre('middleware-instance-1')
    const instance2 = Cyre('middleware-instance-2')

    instance1.initialize()
    instance2.initialize()

    // Register different middleware on each instance
    instance1.middleware('instance1-middleware', async (action, payload) => {
      return {
        action,
        payload: {...payload, processedBy: 'instance1'}
      }
    })

    instance2.middleware('instance2-middleware', async (action, payload) => {
      return {
        action,
        payload: {...payload, processedBy: 'instance2'}
      }
    })

    // Create actions with instance-specific middleware
    instance1.action({
      id: 'middleware-test',
      middleware: ['instance1-middleware'],
      payload: {initial: true}
    })

    instance2.action({
      id: 'middleware-test',
      middleware: ['instance2-middleware'],
      payload: {initial: true}
    })

    // Track processed payloads
    let payload1: any = null
    let payload2: any = null

    // Set up handlers
    instance1.on('middleware-test', payload => {
      payload1 = payload
      return {received: true}
    })

    instance2.on('middleware-test', payload => {
      payload2 = payload
      return {received: true}
    })

    // Execute actions
    await instance1.call('middleware-test', {data: 'test1'})
    await instance2.call('middleware-test', {data: 'test2'})

    // Verify middleware isolation
    expect(payload1.processedBy).toBe('instance1')
    expect(payload2.processedBy).toBe('instance2')
    expect(payload1.data).toBe('test1')
    expect(payload2.data).toBe('test2')

    // Clean up
    instance1.shutdown()
    instance2.shutdown()
  })
})
