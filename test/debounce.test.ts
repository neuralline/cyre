// test/debounce.test.ts
// File location: /test/debounce.test.ts - Fixed import issue

import {describe, test, expect, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src'

/*
 * Debounce Test Suite
 * Fixed import to use vitest instead of bun:test
 */

describe('Debounce Tests', () => {
  beforeEach(() => {
    cyre.initialize()
  })

  afterEach(() => {
    cyre.clear()
  })

  test('should debounce rapid calls correctly', async () => {
    let executionCount = 0
    const actionId = 'debounce-test'

    cyre.on(actionId, () => {
      executionCount++
      return {executed: true}
    })

    cyre.action({
      id: actionId,
      debounce: 1000
    })

    // Make TRULY rapid calls (concurrent, not sequential)
    const promise1 = cyre.call(actionId, {call: 1})
    const promise2 = cyre.call(actionId, {call: 2})
    const promise3 = cyre.call(actionId, {call: 3})

    // Wait for all calls to process
    await Promise.all([promise1, promise2, promise3])

    // With immediate-execution debounce, should only execute once
    expect(executionCount).toBe(1)
  })

  // Alternative: Fire and forget approach
  test('should debounce rapid fire-and-forget calls', async () => {
    let executionCount = 0
    const actionId = 'rapid-debounce-test'

    cyre.on(actionId, () => {
      executionCount++
      return {executed: true}
    })

    cyre.action({
      id: actionId,
      debounce: 500
    })

    // Fire calls rapidly without awaiting
    cyre.call(actionId, {call: 1})
    cyre.call(actionId, {call: 2})
    cyre.call(actionId, {call: 3})
    cyre.call(actionId, {call: 4})
    cyre.call(actionId, {call: 5})

    // Wait for debounce window + some buffer
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should only execute once (immediate execution on first call)
    expect(executionCount).toBe(1)
  })
})
