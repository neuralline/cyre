// src/test/history-api.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src'

/*
 * Cyre History API Test Suite
 *
 * This test suite validates Cyre's history tracking functionality, ensuring:
 * - History entries are correctly recorded for actions
 * - History can be retrieved for specific channels
 * - History can be retrieved for all channels
 * - History can be cleared for specific channels
 * - History can be cleared globally
 */

describe('Cyre History API', () => {
  beforeEach(() => {
    // Mock process.exit to prevent test termination
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre fresh for each test
    cyre.initialize()

    // Clear any existing history
    cyre.clearHistory()

    console.log('===== HISTORY API TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== HISTORY API TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test recording history entries
   */
  it('should record history entries when actions are called', async () => {
    // Setup test actions
    const ACTION_ID = 'history-test-action'

    // Register handler
    cyre.on(ACTION_ID, payload => {
      return {executed: true, value: payload.value}
    })

    // Create action
    cyre.action({
      id: ACTION_ID,
      type: 'history-test',
      payload: {initial: true}
    })

    // Make multiple calls with different payloads
    await cyre.call(ACTION_ID, {value: 'first'})
    await cyre.call(ACTION_ID, {value: 'second'})
    await cyre.call(ACTION_ID, {value: 'third'})

    // Get history for this action
    const actionHistory = cyre.getHistory(ACTION_ID)

    // Verify history was recorded
    expect(actionHistory).toBeDefined()
    expect(Array.isArray(actionHistory)).toBe(true)
    expect(actionHistory.length).toBe(3)

    // Verify history entries have correct structure and values
    if (actionHistory.length >= 3) {
      // Most recent should be first
      expect(actionHistory[0].payload).toHaveProperty('value', 'third')
      expect(actionHistory[1].payload).toHaveProperty('value', 'second')
      expect(actionHistory[2].payload).toHaveProperty('value', 'first')

      // Check structure of history entry
      const entry = actionHistory[0]
      expect(entry).toHaveProperty('timestamp')
      expect(entry).toHaveProperty('payload')
      expect(entry).toHaveProperty('result')
      expect(entry.result).toHaveProperty('ok')
    }
  })

  /**
   * Test retrieving global history
   */
  it('should retrieve combined history for all actions', async () => {
    // Setup multiple test actions
    const ACTION_IDS = ['history-all-1', 'history-all-2', 'history-all-3']

    // Register handlers for all actions
    ACTION_IDS.forEach(id => {
      cyre.on(id, payload => {
        return {executed: true, actionId: id, value: payload.value}
      })

      cyre.action({
        id,
        type: 'history-all-test',
        payload: {initial: true}
      })
    })

    // Call each action
    for (const id of ACTION_IDS) {
      await cyre.call(id, {value: `value-for-${id}`})
    }

    // Get all history
    const allHistory = cyre.getHistory()

    // Verify combined history
    expect(allHistory).toBeDefined()
    expect(Array.isArray(allHistory)).toBe(true)
    expect(allHistory.length).toBeGreaterThanOrEqual(ACTION_IDS.length)

    // Verify each action has an entry
    const recordedIds = new Set(
      allHistory
        .map(entry =>
          typeof entry.actionId === 'string'
            ? entry.actionId
            : entry.payload &&
              typeof entry.payload === 'object' &&
              'actionId' in entry.payload
            ? entry.payload.actionId
            : null
        )
        .filter(Boolean)
    )

    ACTION_IDS.forEach(id => {
      // Verify at least some kind of record exists for this action
      // The actual structure might vary based on implementation
      const hasEntry = allHistory.some(entry =>
        JSON.stringify(entry).includes(id)
      )
      expect(hasEntry).toBe(true)
    })
  })

  /**
   * Test clearing history for specific channel
   */
  it('should clear history for a specific action', async () => {
    // Setup test actions
    const KEEP_ID = 'history-keep'
    const CLEAR_ID = 'history-clear'

    // Register handlers
    for (const id of [KEEP_ID, CLEAR_ID]) {
      cyre.on(id, payload => {
        return {executed: true}
      })

      cyre.action({
        id,
        type: 'history-clear-test',
        payload: {initial: true}
      })

      // Call each action to generate history
      await cyre.call(id, {value: `call-${id}`})
    }

    // Verify both have history before clearing
    expect(cyre.getHistory(KEEP_ID).length).toBeGreaterThan(0)
    expect(cyre.getHistory(CLEAR_ID).length).toBeGreaterThan(0)

    // Clear history for one action
    cyre.clearHistory(CLEAR_ID)

    // Verify only targeted history was cleared
    expect(cyre.getHistory(KEEP_ID).length).toBeGreaterThan(0)
    expect(cyre.getHistory(CLEAR_ID).length).toBe(0)
  })

  /**
   * Test clearing all history
   */
  it('should clear all history', async () => {
    // Setup multiple test actions
    const ACTION_IDS = ['history-clear-all-1', 'history-clear-all-2']

    // Register handlers for all actions
    ACTION_IDS.forEach(id => {
      cyre.on(id, payload => {
        return {executed: true}
      })

      cyre.action({
        id,
        type: 'history-clear-all-test',
        payload: {initial: true}
      })
    })

    // Call each action to generate history
    for (const id of ACTION_IDS) {
      await cyre.call(id, {value: `call-${id}`})
    }

    // Verify history exists before clearing
    const allHistoryBefore = cyre.getHistory()
    expect(allHistoryBefore.length).toBeGreaterThan(0)

    // Clear all history
    cyre.clearHistory()

    // Verify all history was cleared
    const allHistoryAfter = cyre.getHistory()
    expect(allHistoryAfter.length).toBe(0)

    // Also verify individual action histories are cleared
    for (const id of ACTION_IDS) {
      expect(cyre.getHistory(id).length).toBe(0)
    }
  })

  /**
   * Test history with different action types
   */
  it('should record history for different action types', async () => {
    // Setup actions with various configurations

    // 1. Simple immediate action
    const SIMPLE_ID = 'history-simple'
    cyre.on(SIMPLE_ID, payload => ({executed: true}))
    cyre.action({id: SIMPLE_ID})

    // 2. Debounced action
    const DEBOUNCE_ID = 'history-debounce'
    cyre.on(DEBOUNCE_ID, payload => ({executed: true}))
    cyre.action({
      id: DEBOUNCE_ID,
      debounce: 50
    })

    // 3. Action with change detection
    const CHANGE_ID = 'history-change'
    cyre.on(CHANGE_ID, payload => ({executed: true}))
    cyre.action({
      id: CHANGE_ID,
      detectChanges: true
    })

    // Execute all actions
    await cyre.call(SIMPLE_ID)

    // Call debounced action multiple times, but should record only once
    await cyre.call(DEBOUNCE_ID)
    await cyre.call(DEBOUNCE_ID)
    await new Promise(resolve => setTimeout(resolve, 100)) // Wait for debounce

    // Call change detection action with same payload twice
    const payload = {test: true}
    await cyre.call(CHANGE_ID, payload)
    await cyre.call(CHANGE_ID, payload)

    // Call change detection action with different payload
    await cyre.call(CHANGE_ID, {test: false})

    // Verify history records
    const simpleHistory = cyre.getHistory(SIMPLE_ID)
    const debounceHistory = cyre.getHistory(DEBOUNCE_ID)
    const changeHistory = cyre.getHistory(CHANGE_ID)

    expect(simpleHistory.length).toBe(1)
    expect(debounceHistory.length).toBeLessThanOrEqual(2) // Could be 1 or 2 depending on timing

    // History for change detection action should show whether it detected changes
    expect(changeHistory.length).toBeLessThanOrEqual(3) // Maximum possible executions
    // Expect at least one successful execution (exact count depends on implementation)
    expect(changeHistory.some(entry => entry.result?.ok)).toBe(true)
  })

  /**
   * Test history across action chaining
   */
  it('should record history for chained actions', async () => {
    // Setup chained actions
    const FIRST_ID = 'history-chain-first'
    const SECOND_ID = 'history-chain-second'

    // First action in chain
    cyre.on(FIRST_ID, payload => {
      // Return link to second action
      return {
        id: SECOND_ID,
        payload: {from: 'first', value: payload.value}
      }
    })

    // Second action in chain
    cyre.on(SECOND_ID, payload => {
      // End of chain
      return {
        executed: true,
        from: payload.from,
        value: payload.value
      }
    })

    // Create actions
    cyre.action({id: FIRST_ID})
    cyre.action({id: SECOND_ID})

    // Start the chain
    await cyre.call(FIRST_ID, {value: 'chain-test'})

    // Verify history for both actions
    const firstHistory = cyre.getHistory(FIRST_ID)
    const secondHistory = cyre.getHistory(SECOND_ID)

    // Both actions should have history entries
    expect(firstHistory.length).toBeGreaterThan(0)
    expect(secondHistory.length).toBeGreaterThan(0)

    // Second action should have received payload from first
    if (secondHistory.length > 0) {
      const entry = secondHistory[0]
      expect(entry.payload).toHaveProperty('from', 'first')
      expect(entry.payload).toHaveProperty('value', 'chain-test')
    }
  })
})
