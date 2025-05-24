// test/history-api.test.ts
// FIXED: History API test with proper chain reaction verification

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/*
 * CYRE History API Tests
 *
 * Tests the history recording functionality of CYRE
 * Key aspects tested:
 * - Basic history recording for actions
 * - Chain reaction history recording (FIXED)
 * - History retrieval and clearing
 * - Different action types (simple, debounced, change detection)
 */

describe('Cyre History API', () => {
  beforeEach(() => {
    // Mock process.exit to prevent test termination
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== HISTORY API TEST STARTED =====')
  })

  afterEach(() => {
    // Clear history and actions
    cyre.clearHistory()
    cyre.clear()

    vi.restoreAllMocks()
    console.log('===== HISTORY API TEST COMPLETED =====')
  })

  /**
   * Test basic history recording
   */
  it('should record history entries when actions are called', async () => {
    const actionId = 'history-test-action'
    let handlerExecuted = false

    // Register handler
    cyre.on(actionId, payload => {
      handlerExecuted = true
      return {executed: true, payload}
    })

    // Create action
    cyre.action({
      id: actionId,
      type: 'history-test'
    })

    // Call action multiple times
    await cyre.call(actionId, {value: 1})
    await cyre.call(actionId, {value: 2})
    await cyre.call(actionId, {value: 3})

    // Get history
    const history = cyre.getHistory(actionId)

    // Verify
    expect(handlerExecuted).toBe(true)
    expect(history).toBeDefined()
    expect(history.length).toBe(3)

    // Verify history entries are properly structured
    expect(history[0]).toHaveProperty('actionId', actionId)
    expect(history[0]).toHaveProperty('timestamp')
    expect(history[0]).toHaveProperty('payload')
    expect(history[0]).toHaveProperty('result')
    expect(history[0].result).toHaveProperty('ok', true)
  })

  /**
   * Test combined history retrieval
   */
  it('should retrieve combined history for all actions', async () => {
    const actionIds = ['history-all-1', 'history-all-2', 'history-all-3']

    // Register handlers and actions
    actionIds.forEach(id => {
      cyre.on(id, () => ({executed: true}))
      cyre.action({id, type: 'history-all-test'})
    })

    // Call all actions
    await Promise.all(actionIds.map(id => cyre.call(id, {actionId: id})))

    // Get combined history
    const allHistory = cyre.getHistory()

    // Verify
    expect(allHistory.length).toBe(3)

    // Verify all action IDs are present
    const recordedActionIds = allHistory.map(entry => entry.actionId)
    actionIds.forEach(id => {
      expect(recordedActionIds).toContain(id)
    })
  })

  /**
   * Test history clearing for specific action
   */
  it('should clear history for a specific action', async () => {
    const keepActionId = 'history-keep'
    const clearActionId = 'history-clear'

    // Register handlers and actions
    cyre.on(keepActionId, () => ({executed: true}))
    cyre.on(clearActionId, () => ({executed: true}))

    cyre.action({id: keepActionId, type: 'history-test'})
    cyre.action({id: clearActionId, type: 'history-test'})

    // Call both actions
    await cyre.call(keepActionId, {value: 'keep'})
    await cyre.call(clearActionId, {value: 'clear'})

    // Verify both have history
    expect(cyre.getHistory(keepActionId).length).toBe(1)
    expect(cyre.getHistory(clearActionId).length).toBe(1)

    // Clear specific action history
    cyre.clearHistory(clearActionId)

    // Verify only the cleared action's history is gone
    expect(cyre.getHistory(keepActionId).length).toBe(1)
    expect(cyre.getHistory(clearActionId).length).toBe(0)
  })

  /**
   * Test clearing all history
   */
  it('should clear all history', async () => {
    const actionIds = ['history-clear-all-1', 'history-clear-all-2']

    // Register handlers and actions
    actionIds.forEach(id => {
      cyre.on(id, () => ({executed: true}))
      cyre.action({id, type: 'history-clear-all-test'})
    })

    // Call actions
    await Promise.all(actionIds.map(id => cyre.call(id, {actionId: id})))

    // Verify history exists
    expect(cyre.getHistory().length).toBe(2)

    // Clear all history
    cyre.clearHistory()

    // Verify all history is cleared
    expect(cyre.getHistory().length).toBe(0)
    actionIds.forEach(id => {
      expect(cyre.getHistory(id).length).toBe(0)
    })
  })

  /**
   * Test history for different action types
   */
  it('should record history for different action types', async () => {
    // Simple action
    cyre.on('history-simple', () => ({executed: true}))
    cyre.action({id: 'history-simple', type: 'simple'})

    // Debounced action
    cyre.on('history-debounce', () => ({executed: true}))
    cyre.action({
      id: 'history-debounce',
      type: 'debounced',
      debounce: 50
    })

    // Change detection action
    cyre.on('history-change', () => ({executed: true}))
    cyre.action({
      id: 'history-change',
      type: 'change-detection',
      detectChanges: true
    })

    // Call simple action
    await cyre.call('history-simple', {value: 'simple'})

    // Call debounced action (wait for debounce to complete)
    await cyre.call('history-debounce', {value: 'debounced'})
    await new Promise(resolve => setTimeout(resolve, 100))

    // Call change detection action with different payloads
    await cyre.call('history-change', {value: 'first'})
    await cyre.call('history-change', {value: 'first'}) // Should be skipped
    await cyre.call('history-change', {value: 'second'}) // Should execute

    // Verify histories
    const simpleHistory = cyre.getHistory('history-simple')
    const debounceHistory = cyre.getHistory('history-debounce')
    const changeHistory = cyre.getHistory('history-change')

    expect(simpleHistory.length).toBe(1)
    expect(debounceHistory.length).toBe(1)
    expect(changeHistory.length).toBe(2) // First call + changed payload call

    // Verify history content
    expect(simpleHistory[0].payload).toEqual({value: 'simple'})
    expect(debounceHistory[0].payload).toEqual({value: 'debounced'})
    expect(changeHistory[0].payload).toEqual({value: 'second'}) // Most recent first
    expect(changeHistory[1].payload).toEqual({value: 'first'})
  })

  /**
   * FIXED: Test history for chained actions (intraLinks)
   */
  it('should record history for chained actions', async () => {
    const firstActionId = 'history-chain-first'
    const secondActionId = 'history-chain-second'

    let firstHandlerExecuted = false
    let secondHandlerExecuted = false

    // Register handlers for chain reactions
    cyre.on(firstActionId, payload => {
      firstHandlerExecuted = true
      console.log('[TEST] First handler executed with:', payload)

      // Return intraLink to trigger chain reaction
      return {
        id: secondActionId,
        payload: {
          from: firstActionId,
          originalData: payload,
          chainedAt: Date.now()
        }
      }
    })

    cyre.on(secondActionId, payload => {
      secondHandlerExecuted = true
      console.log('[TEST] Second handler executed with:', payload)

      return {
        executed: true,
        receivedFrom: payload.from
      }
    })

    // Create actions
    cyre.action({
      id: firstActionId,
      type: 'chain-test'
    })

    cyre.action({
      id: secondActionId,
      type: 'chain-test'
    })

    // Start the chain reaction
    await cyre.call(firstActionId, {
      initial: true,
      testValue: 'chain-test'
    })

    // Give the chain time to complete
    await new Promise(resolve => setTimeout(resolve, 50))

    // Verify both handlers executed
    expect(firstHandlerExecuted).toBe(true)
    expect(secondHandlerExecuted).toBe(true)

    // Get history for both actions
    const firstHistory = cyre.getHistory(firstActionId)
    const secondHistory = cyre.getHistory(secondActionId)

    console.log('[TEST] First action history:', firstHistory)
    console.log('[TEST] Second action history:', secondHistory)

    // Both actions should have history entries
    expect(firstHistory.length).toBeGreaterThan(0)
    expect(secondHistory.length).toBeGreaterThan(0)

    // Second action should have received payload from first
    expect(secondHistory[0].payload).toHaveProperty('from', firstActionId)
    expect(secondHistory[0].payload).toHaveProperty('originalData')
    expect(secondHistory[0].payload.originalData).toEqual({
      initial: true,
      testValue: 'chain-test'
    })

    // Both should have successful execution results
    expect(firstHistory[0].result.ok).toBe(true)
    expect(secondHistory[0].result.ok).toBe(true)
  })

  /**
   * Test history with action that has intervals
   */
  it('should record history for interval-based actions', async () => {
    const actionId = 'history-interval-test'
    let executionCount = 0

    // Register handler
    cyre.on(actionId, payload => {
      executionCount++
      return {
        executed: true,
        executionNumber: executionCount,
        payload
      }
    })

    // Create action with interval and limited repeats
    cyre.action({
      id: actionId,
      type: 'interval-test',
      interval: 50, // Short interval for testing
      repeat: 3, // Execute 3 times total
      delay: 0 // Execute immediately then wait for intervals
    })

    // Start the interval action
    await cyre.call(actionId, {testData: 'interval'})

    // Wait for all executions to complete
    await new Promise(resolve => setTimeout(resolve, 200))

    // Get history
    const history = cyre.getHistory(actionId)

    // Should have recorded all executions
    expect(history.length).toBe(3)
    expect(executionCount).toBe(3)

    // All history entries should be successful
    history.forEach(entry => {
      expect(entry.result.ok).toBe(true)
      expect(entry.payload).toEqual({testData: 'interval'})
    })
  })

  /**
   * Test history with failed actions
   */
  it('should record history for failed actions', async () => {
    const actionId = 'history-error-test'

    // Register handler that throws an error
    cyre.on(actionId, payload => {
      if (payload.shouldFail) {
        throw new Error('Test error for history')
      }
      return {executed: true}
    })

    // Create action
    cyre.action({
      id: actionId,
      type: 'error-test'
    })

    // Call with success
    await cyre.call(actionId, {shouldFail: false})

    // Call with failure
    await cyre.call(actionId, {shouldFail: true})

    // Get history
    const history = cyre.getHistory(actionId)

    expect(history.length).toBe(2)

    // First call should be successful
    expect(history[1].result.ok).toBe(true) // History is newest first
    expect(history[1].payload).toEqual({shouldFail: false})

    // Second call should be failed
    expect(history[0].result.ok).toBe(false)
    expect(history[0].payload).toEqual({shouldFail: true})
    expect(history[0].result.error).toContain('Test error for history')
  })
})
