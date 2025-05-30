// test/duplicate-handling.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/**
 * Duplicate Registration Test
 *
 * This test verifies how Cyre handles duplicate registrations:
 * 1. How calling .action multiple times with the same ID works (update behavior)
 * 2. How .on handles duplicate subscribers for the same channel
 */
describe('Duplicate Registration Handling', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should update action configuration when .action is called multiple times with the same ID', async () => {
    const ACTION_ID = `duplicate-action-${Date.now()}`

    // Track action configuration changes
    const getActionConfig = () => {
      const action = cyre.get(ACTION_ID)
      // Return a simplified version for easier comparison
      return action
        ? {
            id: action.id,
            payload: action.payload,
            interval: action.interval,
            detectChanges: action.detectChanges
          }
        : null
    }

    // First action registration
    console.log('[TEST] Registering initial action')
    cyre.action({
      id: ACTION_ID,
      type: 'duplicate-test',
      payload: {value: 'initial'},
      interval: 1000,
      detectChanges: false
    })

    const initialConfig = getActionConfig()
    console.log('[TEST] Initial action config:', initialConfig)

    // Second action registration with the same ID but different config
    console.log('[TEST] Registering duplicate action with different config')
    cyre.action({
      id: ACTION_ID,
      type: 'duplicate-test',
      payload: {value: 'updated'},
      interval: 2000,
      detectChanges: true
    })

    const updatedConfig = getActionConfig()
    console.log('[TEST] Updated action config:', updatedConfig)

    // Verify config was updated
    expect(initialConfig).not.toEqual(updatedConfig)
    expect(updatedConfig?.payload).toEqual({value: 'updated'})
    expect(updatedConfig?.interval).toBe(2000)
    expect(updatedConfig?.detectChanges).toBe(true)

    // Third registration with minimal config
    console.log('[TEST] Registering minimal action update')
    cyre.action({
      id: ACTION_ID,
      payload: {value: 'minimal-update'}
    })

    const minimalConfig = getActionConfig()
    console.log('[TEST] Minimal update config:', minimalConfig)

    // Verify partial update behavior
    expect(minimalConfig?.payload).toEqual({value: 'minimal-update'})
    // Check if other properties were preserved or reset
    console.log(
      '[TEST] Were other properties preserved?',
      'interval:',
      minimalConfig?.interval === updatedConfig?.interval,
      'detectChanges:',
      minimalConfig?.detectChanges === updatedConfig?.detectChanges
    )
  })

  it('should replace previous subscriber when .on is called multiple times with the same ID', async () => {
    const CHANNEL_ID = `duplicate-channel-${Date.now()}`

    // Create spy functions to track which handler is called
    const firstHandlerSpy = vi.fn(() => ({executed: 'first'}))
    const secondHandlerSpy = vi.fn(() => ({executed: 'second'}))
    const thirdHandlerSpy = vi.fn(() => ({executed: 'third'}))

    // Register action that will trigger the handlers
    cyre.action({
      id: CHANNEL_ID,
      type: 'duplicate-subscriber-test',
      payload: {initial: true}
    })

    // First subscriber registration
    console.log('[TEST] Registering first subscriber')
    cyre.on(CHANNEL_ID, firstHandlerSpy)

    // Call the action and check which handler was called
    console.log('[TEST] Calling action after first registration')
    await cyre.call(CHANNEL_ID, {call: 1})

    expect(firstHandlerSpy).toHaveBeenCalledTimes(1)
    expect(secondHandlerSpy).not.toHaveBeenCalled()
    expect(thirdHandlerSpy).not.toHaveBeenCalled()

    // Reset spy call counts
    firstHandlerSpy.mockClear()

    // Second subscriber registration with the same ID
    console.log('[TEST] Registering second subscriber with same ID')
    cyre.on(CHANNEL_ID, secondHandlerSpy)

    // Call the action again
    console.log('[TEST] Calling action after second registration')
    await cyre.call(CHANNEL_ID, {call: 2})

    // Verify that only the second handler was called
    expect(firstHandlerSpy).not.toHaveBeenCalled() // First handler should no longer be active
    expect(secondHandlerSpy).toHaveBeenCalledTimes(1)
    expect(thirdHandlerSpy).not.toHaveBeenCalled()

    // Reset spy call counts
    secondHandlerSpy.mockClear()

    // Third subscriber registration with same ID
    console.log('[TEST] Registering third subscriber with same ID')
    cyre.on(CHANNEL_ID, thirdHandlerSpy)

    // Call the action again
    console.log('[TEST] Calling action after third registration')
    await cyre.call(CHANNEL_ID, {call: 3})

    // Verify that only the third handler was called
    expect(firstHandlerSpy).not.toHaveBeenCalled()
    expect(secondHandlerSpy).not.toHaveBeenCalled()
    expect(thirdHandlerSpy).toHaveBeenCalledTimes(1)

    // Demonstrate that there's no way to restore previous handlers
    console.log('[TEST] Attempting to call previous handlers...')
    // No official API to restore or access previous handlers
  })

  it('should test the interaction between duplicate actions and subscribers', async () => {
    const INTERACTION_ID = `interaction-test-${Date.now()}`

    // Spy functions for subscribers
    const handlerA = vi.fn(() => ({result: 'A'}))
    const handlerB = vi.fn(() => ({result: 'B'}))

    // Register subscriber first
    console.log('[TEST] Registering initial subscriber')
    cyre.on(INTERACTION_ID, handlerA)

    // Then register action with same ID
    console.log('[TEST] Registering action with same ID as subscriber')
    cyre.action({
      id: INTERACTION_ID,
      payload: {test: 'interaction'}
    })

    // Call the action
    console.log('[TEST] Calling action')
    await cyre.call(INTERACTION_ID, {call: 'interact'})

    // Register new subscriber
    console.log('[TEST] Registering new subscriber')
    cyre.on(INTERACTION_ID, handlerB)

    // Update action
    console.log('[TEST] Updating action')
    cyre.action({
      id: INTERACTION_ID,
      payload: {test: 'updated-interaction'}
    })

    // Call action again
    console.log('[TEST] Calling updated action')
    await cyre.call(INTERACTION_ID, {call: 'updated-interact'})

    // Check handler calls
    console.log('[TEST] Checking handler call counts:', {
      handlerA: handlerA.mock.calls.length,
      handlerB: handlerB.mock.calls.length
    })

    // Verify handler replacement behavior
    expect(handlerA).toHaveBeenCalledTimes(1) // Called only for the first call
    expect(handlerB).toHaveBeenCalledTimes(1) // Called only for the second call
  })
})
