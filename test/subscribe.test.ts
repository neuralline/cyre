// test/subscription.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/*
 * Subscription Test for CYRE
 *
 * Key insight: Subscribers register with action IDs, not types!
 * The 'type' property is a group identifier, not the subscription key.
 */

describe('Corrected CYRE Subscription Test', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Basic subscription test with corrected approach
   */
  it('should correctly register handlers using ACTION IDs (not types)', async () => {
    // Track execution
    let handlerExecuted = false

    // Define ACTION ID - this is what we subscribe to!
    const ACTION_ID = 'test-action-id'

    // Define type - this is just a grouping identifier
    const ACTION_TYPE = 'test-action-type'

    console.log('[TEST] Registering handler with ACTION ID')

    // IMPORTANT: Register handler with ACTION ID, not type!
    const subResult = cyre.on(ACTION_ID, payload => {
      console.log('[HANDLER] Executed with payload:', payload)
      handlerExecuted = true
      return {success: true}
    })

    console.log('[TEST] Subscription result:', subResult)

    console.log('[TEST] Creating action')

    // Create action with matching ID
    cyre.action({
      id: ACTION_ID, // This should match the subscription!
      type: ACTION_TYPE, // This is just a grouping mechanism
      payload: {initial: true},
      detectChanges: false
    })

    console.log('[TEST] Calling action')

    // Call the action
    const result = await cyre.call(ACTION_ID, {
      timestamp: Date.now()
    })

    console.log('[TEST] Call result:', result)
    console.log('[TEST] Handler executed?', handlerExecuted)

    // Verify handler was executed
    expect(handlerExecuted).toBe(true)
  })

  /**
   * Test with multiple subscriptions
   */
  it('should handle multiple subscriptions by action IDs', async () => {
    // Track executions
    const executed = {
      action1: false,
      action2: false,
      action3: false
    }

    console.log('[TEST] Registering multiple handlers by ACTION ID')

    // Register handlers for different action IDs
    cyre.on('action-one', () => {
      console.log('[HANDLER] Action One executed')
      executed.action1 = true
      return true
    })

    cyre.on('action-two', () => {
      console.log('[HANDLER] Action Two executed')
      executed.action2 = true
      return true
    })

    cyre.on('action-three', () => {
      console.log('[HANDLER] Action Three executed')
      executed.action3 = true
      return true
    })

    console.log('[TEST] Creating actions with various types')

    // Create actions with different types but matching IDs
    cyre.action({
      id: 'action-one',
      type: 'type-a',
      payload: {}
    })

    cyre.action({
      id: 'action-two',
      type: 'type-a', // Same type as action-one
      payload: {}
    })

    cyre.action({
      id: 'action-three',
      type: 'type-b', // Different type
      payload: {}
    })

    console.log('[TEST] Calling all actions')

    // Call all actions
    await Promise.all([
      cyre.call('action-one'),
      cyre.call('action-two'),
      cyre.call('action-three')
    ])

    console.log('[TEST] Execution results:', executed)

    // Verify all handlers executed despite different types
    expect(executed.action1).toBe(true)
    expect(executed.action2).toBe(true)
    expect(executed.action3).toBe(true)
  })

  /**
   * Test for chain reactions
   */
  it('should support chain reactions between actions', async () => {
    // Track executions
    let firstHandlerCalled = false
    let secondHandlerCalled = false

    console.log('[TEST] Setting up chain reaction')

    // Create actions first
    console.log('[TEST] Creating chain actions')

    cyre.action({
      id: 'chain-start',
      type: 'chain-type',
      payload: {stage: 'start'}
    })

    cyre.action({
      id: 'chain-next',
      type: 'chain-type',
      payload: {stage: 'next'}
    })

    // Register handlers
    console.log('[TEST] Registering handlers for chain')

    cyre.on('chain-start', payload => {
      console.log('[HANDLER] Chain start executed with:', payload)
      firstHandlerCalled = true

      // Return link to next action in chain
      return {
        id: 'chain-next',
        payload: {
          stage: 'chained',
          from: 'first-handler',
          timestamp: Date.now()
        }
      }
    })

    cyre.on('chain-next', payload => {
      console.log('[HANDLER] Chain next executed with:', payload)
      secondHandlerCalled = true
      return {completed: true}
    })

    // Start the chain
    console.log('[TEST] Starting chain reaction')

    const result = await cyre.call('chain-start', {
      initial: true,
      timestamp: Date.now()
    })

    console.log('[TEST] Chain result:', result)
    console.log('[TEST] Chain execution status:', {
      firstHandlerCalled,
      secondHandlerCalled
    })

    // Verify both handlers in the chain executed
    expect(firstHandlerCalled).toBe(true)
    expect(secondHandlerCalled).toBe(true)
  })

  /**
   * Test with explicit type matching verification
   */
  it('should confirm action ID (not type) is the key for subscribers', async () => {
    // Create test case with identical types but different IDs
    console.log('[TEST] Creating actions with same type but different IDs')

    cyre.action([
      {
        id: 'unique-id-1',
        type: 'shared-type', // SAME type
        payload: {marker: 1}
      },
      {
        id: 'unique-id-2',
        type: 'shared-type', // SAME type
        payload: {marker: 2}
      }
    ])

    // Track which handler is executed
    const executed = {
      handler1: false,
      handler2: false
    }

    // Register handlers for each ID
    console.log('[TEST] Registering handlers for unique IDs')

    cyre.on('unique-id-1', payload => {
      console.log('[HANDLER] ID 1 executed with:', payload)
      executed.handler1 = true
      return true
    })

    cyre.on('unique-id-2', payload => {
      console.log('[HANDLER] ID 2 executed with:', payload)
      executed.handler2 = true
      return true
    })

    // Call just one of the actions
    console.log('[TEST] Calling only first action')

    await cyre.call('unique-id-1')

    console.log('[TEST] Execution results after first call:', executed)

    // Verify ONLY the matching ID handler executed
    expect(executed.handler1).toBe(true)
    expect(executed.handler2).toBe(false) // This should NOT have executed

    // Reset tracking
    executed.handler1 = false
    executed.handler2 = false

    // Now call the other action
    console.log('[TEST] Calling only second action')

    await cyre.call('unique-id-2')

    console.log('[TEST] Execution results after second call:', executed)

    // Verify ONLY the matching ID handler executed this time
    expect(executed.handler1).toBe(false) // This should NOT have executed
    expect(executed.handler2).toBe(true)
  })
})
