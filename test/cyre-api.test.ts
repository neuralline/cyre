// test/cyre-api.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
// Import the exact same way as the existing tests
import {cyre} from '../src/app'
import {log} from '../src/components/cyre-logger'

/*
 * Simplified Cyre API Tests
 * Tests designed to verify core interface methods
 */

describe('Cyre API Tests', () => {
  beforeEach(() => {
    // Mock process.exit to prevent test termination
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Mock logging
    vi.spyOn(log, 'info').mockImplementation(() => {})
    vi.spyOn(log, 'error').mockImplementation(() => {})

    // Initialize cyre
    cyre.initialize()

    console.log('===== CYRE API TEST STARTED =====')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    console.log('===== CYRE API TEST COMPLETED =====')
  })

  /**
   * Test basic action creation
   */
  it('should create and retrieve an action', () => {
    // Simple test ID to avoid conflicts
    const actionId = `test-action-${Date.now()}`

    // Create the action
    cyre.action({
      id: actionId,
      type: 'test',
      payload: {value: 'test'}
    })

    // Retrieve the action
    const action = cyre.get(actionId)

    // Verify
    expect(action).toBeDefined()
    expect(action?.id).toBe(actionId)
    expect(action?.type).toBe('test')
    expect(action?.payload).toEqual({value: 'test'})

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test action with handler
   * Important: only test a basic scenario
   */
  it('should process a basic action with handler', async () => {
    // Create unique ID for this test
    const actionId = `handler-test-${Date.now()}`
    let handlerCalled = false

    // Register handler first
    cyre.on(actionId, () => {
      handlerCalled = true
      return {handled: true}
    })

    // Create action
    cyre.action({
      id: actionId,
      type: 'test'
    })

    // Call action
    await cyre.call(actionId)

    // Verify handler was called
    expect(handlerCalled).toBe(true)

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test for pause and resume functionality with timing-based verification
   */
  it('should properly pause and resume an action with interval', async () => {
    // Create unique ID for this test
    const actionId = `pause-resume-test-${Date.now()}`
    let executionCount = 0

    // Register handler
    cyre.on(actionId, () => {
      executionCount++
      return {handled: true}
    })

    // Create action with interval
    cyre.action({
      id: actionId,
      type: 'interval-test',
      interval: 100, // Short interval
      repeat: true // Continuous execution
    })

    // Start the action
    await cyre.call(actionId)

    // Wait for at least one execution
    await new Promise(resolve => setTimeout(resolve, 150))

    // Verify at least one execution occurred
    expect(executionCount).toBeGreaterThan(0)

    // Store current count
    const countBeforePause = executionCount

    // Pause the action
    cyre.pause(actionId)

    // Wait for what would have been another execution
    await new Promise(resolve => setTimeout(resolve, 150))

    // Verify no new executions occurred while paused
    expect(executionCount).toBe(countBeforePause)

    // Resume the action
    cyre.resume(actionId)

    // Wait for new executions
    await new Promise(resolve => setTimeout(resolve, 150))

    // Verify new executions occurred after resume
    expect(executionCount).toBeGreaterThan(countBeforePause)

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test for change detection with hasChanged and getPrevious
   */
  it('should detect payload changes and track previous payloads', async () => {
    // Create unique ID for this test
    const actionId = `change-detection-test-${Date.now()}`

    // Create action with change detection enabled
    cyre.action({
      id: actionId,
      type: 'change-test',
      payload: {value: 'initial'},
      detectChanges: true
    })

    // Register handler
    cyre.on(actionId, () => {
      return {handled: true}
    })

    // Make initial call to set up the payload history
    await cyre.call(actionId, {value: 'initial'})

    // Check if a different payload would be detected as changed
    const hasChangedResult = cyre.hasChanged(actionId, {value: 'changed'})
    expect(hasChangedResult).toBe(true)

    // Check if the same payload is detected as unchanged
    const noChangeResult = cyre.hasChanged(actionId, {value: 'initial'})
    expect(noChangeResult).toBe(false)

    // Update the payload with a new value
    await cyre.call(actionId, {value: 'changed'})

    // Get the previous payload
    const previousPayload = cyre.getPrevious(actionId)

    // Verify the previous payload matches what we last sent
    expect(previousPayload).toBeDefined()
    expect(previousPayload).toEqual({value: 'changed'})

    // Clean up
    cyre.forget(actionId)
  })

  /**
   * Test for basic action chaining (manually chained calls)
   */
  it('should support basic action chaining', async () => {
    // Create unique IDs for this test
    const firstActionId = `first-action-${Date.now()}`
    const secondActionId = `second-action-${Date.now()}`

    // Track execution
    let firstHandlerExecuted = false
    let secondHandlerExecuted = false
    let secondHandlerPayload = null

    // Register handlers
    cyre.on(firstActionId, () => {
      firstHandlerExecuted = true

      // Call the second action directly from the first handler
      cyre.call(secondActionId, {from: 'first-handler'})

      return {handled: true}
    })

    cyre.on(secondActionId, payload => {
      secondHandlerExecuted = true
      secondHandlerPayload = payload
      return {handled: true}
    })

    // Create both actions
    cyre.action({
      id: firstActionId,
      type: 'chain-test-1'
    })

    cyre.action({
      id: secondActionId,
      type: 'chain-test-2'
    })

    // Call the first action
    await cyre.call(firstActionId)

    // Give the second action time to execute
    await new Promise(resolve => setTimeout(resolve, 50))

    // Verify both handlers executed
    expect(firstHandlerExecuted).toBe(true)
    expect(secondHandlerExecuted).toBe(true)

    // Verify the second handler received the correct payload
    expect(secondHandlerPayload).toEqual({from: 'first-handler'})

    // Clean up
    cyre.forget(firstActionId)
    cyre.forget(secondActionId)
  })
})
