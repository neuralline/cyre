// test/subscribe-fixed.test.ts
// Fixed subscription test that should work with optimized pipeline

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/*
 * FIXED: CYRE Subscription Test with Optimized Pipeline
 *
 * Tests the corrected subscription behavior:
 * - Subscribe to ACTION IDs, not types
 * - Multiple subscriptions by action IDs
 * - Chain reactions between actions
 * - Proper integration with optimized pipeline system
 */

describe('Fixed CYRE Subscription Test', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== FIXED SUBSCRIPTION TEST STARTED =====')
  })

  afterEach(() => {
    // Clear all actions and subscriptions
    cyre.clear()

    console.log('===== FIXED SUBSCRIPTION TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test 1: Subscribe to ACTION IDs, not types
   */
  it('should correctly register handlers using ACTION IDs (not types)', async () => {
    const actionId = 'user-update-action'
    const actionType = 'user' // This should NOT be used for subscription

    let handlerExecuted = false
    let receivedPayload: any = null

    // FIRST: Register the handler by ACTION ID
    const subscription = cyre.on(actionId, payload => {
      handlerExecuted = true
      receivedPayload = payload
      return {handled: true, actionId}
    })

    expect(subscription.ok).toBe(true)
    expect(subscription.message).toContain(actionId)

    // THEN: Create action with both ID and type
    const actionResult = cyre.action({
      id: actionId,
      type: actionType, // This is just for grouping
      payload: {userId: 123}
    })

    expect(actionResult.ok).toBe(true)

    // Call using ACTION ID (should work)
    const callResult = await cyre.call(actionId, {
      userId: 456,
      name: 'John Doe'
    })

    expect(callResult.ok).toBe(true)
    expect(handlerExecuted).toBe(true)
    expect(receivedPayload).toEqual({
      userId: 456,
      name: 'John Doe'
    })

    // Verify action exists
    const retrievedAction = cyre.get(actionId)
    expect(retrievedAction).toBeDefined()
    expect(retrievedAction?.id).toBe(actionId)
    expect(retrievedAction?.type).toBe(actionType)
  })

  /**
   * Test 2: Multiple subscriptions by action IDs
   */
  it('should handle multiple subscriptions by action IDs', async () => {
    const actions = [
      {id: 'email-send', type: 'notification'},
      {id: 'sms-send', type: 'notification'},
      {id: 'push-send', type: 'notification'}
    ]

    const executionTracker: Record<string, boolean> = {}
    const payloadTracker: Record<string, any> = {}

    // Register handlers for each ACTION ID
    for (const action of actions) {
      cyre.on(action.id, payload => {
        executionTracker[action.id] = true
        payloadTracker[action.id] = payload
        return {
          executed: true,
          actionId: action.id,
          type: action.type
        }
      })

      // Create the action
      const result = cyre.action({
        id: action.id,
        type: action.type,
        payload: {message: `Default ${action.id}`}
      })

      expect(result.ok).toBe(true)
    }

    // Call each action by its ACTION ID
    for (const action of actions) {
      const callResult = await cyre.call(action.id, {
        message: `Test message for ${action.id}`,
        timestamp: Date.now()
      })

      expect(callResult.ok).toBe(true)
      expect(executionTracker[action.id]).toBe(true)
      expect(payloadTracker[action.id]).toEqual({
        message: `Test message for ${action.id}`,
        timestamp: expect.any(Number)
      })
    }

    // Verify all handlers were executed
    expect(Object.keys(executionTracker)).toHaveLength(3)
    expect(Object.values(executionTracker).every(Boolean)).toBe(true)
  })

  /**
   * Test 3: Chain reactions between actions (intraLinks)
   */
  it('should support chain reactions between actions', async () => {
    const firstActionId = 'validate-user'
    const secondActionId = 'create-profile'
    const thirdActionId = 'send-welcome-email'

    const executionOrder: string[] = []
    const payloadChain: any[] = []

    // Set up chain reaction handlers
    cyre.on(firstActionId, payload => {
      executionOrder.push(firstActionId)
      payloadChain.push(payload)

      // Return intraLink to next action
      return {
        id: secondActionId,
        payload: {
          ...payload,
          validated: true,
          validatedAt: Date.now()
        }
      }
    })

    cyre.on(secondActionId, payload => {
      executionOrder.push(secondActionId)
      payloadChain.push(payload)

      // Continue the chain
      return {
        id: thirdActionId,
        payload: {
          ...payload,
          profileCreated: true,
          profileId: `profile-${Date.now()}`
        }
      }
    })

    cyre.on(thirdActionId, payload => {
      executionOrder.push(thirdActionId)
      payloadChain.push(payload)

      // End the chain
      return {
        emailSent: true,
        chainCompleted: true,
        finalPayload: payload
      }
    })

    // Create all actions
    const actions = [firstActionId, secondActionId, thirdActionId]
    for (const actionId of actions) {
      const result = cyre.action({
        id: actionId,
        type: 'user-onboarding'
      })
      expect(result.ok).toBe(true)
    }

    // Start the chain reaction
    const initialPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    }

    const result = await cyre.call(firstActionId, initialPayload)
    expect(result.ok).toBe(true)

    // Give time for chain to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify execution order
    expect(executionOrder).toEqual([
      firstActionId,
      secondActionId,
      thirdActionId
    ])

    // Verify payload transformation through chain
    expect(payloadChain).toHaveLength(3)

    // First payload (original)
    expect(payloadChain[0]).toEqual(initialPayload)

    // Second payload (validated)
    expect(payloadChain[1]).toMatchObject({
      ...initialPayload,
      validated: true,
      validatedAt: expect.any(Number)
    })

    // Third payload (profile created)
    expect(payloadChain[2]).toMatchObject({
      ...initialPayload,
      validated: true,
      validatedAt: expect.any(Number),
      profileCreated: true,
      profileId: expect.stringContaining('profile-')
    })
  })

  /**
   * Test 4: Confirm action ID is the key, not type
   */
  it('should confirm action ID (not type) is the key for subscribers', async () => {
    const actionId1 = 'user-login'
    const actionId2 = 'user-logout'
    const sharedType = 'user-authentication' // Same type, different IDs

    let loginExecuted = false
    let logoutExecuted = false

    // Register handlers by ACTION ID (same type, different IDs)
    cyre.on(actionId1, payload => {
      loginExecuted = true
      return {action: 'login', userId: payload.userId}
    })

    cyre.on(actionId2, payload => {
      logoutExecuted = true
      return {action: 'logout', userId: payload.userId}
    })

    // Create actions with SAME TYPE but different IDs
    cyre.action({
      id: actionId1,
      type: sharedType,
      payload: {action: 'login'}
    })

    cyre.action({
      id: actionId2,
      type: sharedType,
      payload: {action: 'logout'}
    })

    // Call each action by its ID
    const loginResult = await cyre.call(actionId1, {userId: 'user-123'})
    const logoutResult = await cyre.call(actionId2, {userId: 'user-123'})

    // Both calls should succeed
    expect(loginResult.ok).toBe(true)
    expect(logoutResult.ok).toBe(true)

    // Correct handlers should have executed
    expect(loginExecuted).toBe(true)
    expect(logoutExecuted).toBe(true)

    // Verify we can't call by type
    const typeCallResult = await cyre.call(sharedType, {userId: 'user-123'})
    expect(typeCallResult.ok).toBe(false)
    expect(typeCallResult.message).toContain('not found')
  })

  /**
   * Test 5: Pipeline integration with subscriptions
   */
  it('should work correctly with pipeline protections', async () => {
    const actionId = 'protected-subscription-test'

    let executionCount = 0
    let lastPayload: any = null

    // Register handler
    cyre.on(actionId, payload => {
      executionCount++
      lastPayload = payload
      return {
        executed: true,
        count: executionCount,
        payload
      }
    })

    // Create action with protections
    const actionResult = cyre.action({
      id: actionId,
      throttle: 100, // Throttle protection
      detectChanges: true // Change detection
    })

    expect(actionResult.ok).toBe(true)

    // First call should work
    const result1 = await cyre.call(actionId, {value: 'first'})
    expect(result1.ok).toBe(true)
    expect(executionCount).toBe(1)

    // Immediate second call should be throttled
    const result2 = await cyre.call(actionId, {value: 'second'})
    expect(result2.ok).toBe(false) // Throttled
    expect(result2.message).toContain('Throttled')
    expect(executionCount).toBe(1) // Still 1

    // Wait for throttle to clear
    await new Promise(resolve => setTimeout(resolve, 150))

    // Third call with same payload should be skipped (change detection)
    const result3 = await cyre.call(actionId, {value: 'first'}) // Same as first
    expect(result3.ok).toBe(true)
    expect(result3.message).toContain('skipped') // Change detection
    expect(executionCount).toBe(1) // Still 1

    // Fourth call with different payload should work
    const result4 = await cyre.call(actionId, {value: 'different'})
    expect(result4.ok).toBe(true)
    expect(executionCount).toBe(2) // Now 2
    expect(lastPayload).toEqual({value: 'different'})
  })
})
