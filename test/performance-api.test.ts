// test/performance-api.test.ts
// Simple test to verify performance API fix

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/app'

describe('Performance API Fallback Test', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()
  })

  afterEach(() => {
    cyre.clear()
    vi.restoreAllMocks()
  })

  it('should handle performance API not being available', async () => {
    // Mock performance to be undefined to simulate test environment
    const originalPerformance = global.performance

    try {
      // Remove performance API to test fallback
      delete (global as any).performance

      let handlerExecuted = false
      const actionId = 'performance-test'

      // Register handler
      const subscription = cyre.on(actionId, payload => {
        handlerExecuted = true
        return {success: true, payload}
      })

      expect(subscription.ok).toBe(true)

      // Create action
      cyre.action({
        id: actionId,
        type: 'test'
      })

      // Call action
      const result = await cyre.call(actionId, {test: 'data'})

      // Should work even without performance API
      expect(result.ok).toBe(true)
      expect(handlerExecuted).toBe(true)
    } finally {
      // Restore original performance object
      if (originalPerformance) {
        global.performance = originalPerformance
      }
    }
  })

  it('should work with normal performance API', async () => {
    let handlerExecuted = false
    const actionId = 'normal-performance-test'

    // Register handler
    const subscription = cyre.on(actionId, payload => {
      handlerExecuted = true
      return {success: true, payload}
    })

    expect(subscription.ok).toBe(true)

    // Create action
    cyre.action({
      id: actionId,
      type: 'test'
    })

    // Call action
    const result = await cyre.call(actionId, {test: 'data'})

    // Should work with performance API
    expect(result.ok).toBe(true)
    expect(handlerExecuted).toBe(true)
  })
})
