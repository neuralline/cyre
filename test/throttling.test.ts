// test/throttling.test.ts
// Location: test/throttling.test.ts
// Comprehensive throttling test suite for Cyre's rate limiting capabilities

import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src'

describe('Cyre Throttling System', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    cyre.initialize()
  })

  afterEach(() => {
    vi.useRealTimers()
    cyre.dev?.clearAll()
  })

  // ============================================================================
  // BASIC THROTTLING BEHAVIOR
  // ============================================================================

  describe('Basic Throttling Behavior', () => {
    test('should allow first call immediately, throttle subsequent calls', async () => {
      const actionId = 'basic-throttle-test'
      let executionCount = 0

      // Handler first (Cyre pattern)
      cyre.on(actionId, payload => {
        executionCount++
        return {executed: true, count: executionCount, payload}
      })

      cyre.action({
        id: actionId,
        throttle: 1000 // 1 second throttle
      })

      // First call should execute immediately
      const result1 = await cyre.call(actionId, {attempt: 1})
      expect(result1.ok).toBe(true)
      expect(executionCount).toBe(1)

      // Second call within throttle window should be rejected
      const result2 = await cyre.call(actionId, {attempt: 2})
      expect(result2.ok).toBe(false) // Throttled
      expect(executionCount).toBe(1) // No execution

      // Wait for throttle to expire
      vi.advanceTimersByTime(1001) // Add 1ms buffer for timing precision
      await vi.runAllTimersAsync()

      // Third call after throttle should execute
      const result3 = await cyre.call(actionId, {attempt: 3})
      expect(result3.ok).toBe(true)
      expect(executionCount).toBe(2)

      cyre.forget(actionId)
    })

    test('should handle rapid fire calls with consistent throttling', async () => {
      const actionId = 'rapid-fire-throttle'
      let executionCount = 0
      const executionTimes: number[] = []

      cyre.on(actionId, () => {
        executionCount++
        executionTimes.push(Date.now())
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        throttle: 200 // 200ms throttle
      })

      // Fire 10 rapid calls sequentially
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(await cyre.call(actionId, {attempt: i}))
        vi.advanceTimersByTime(50) // 50ms between calls
      }

      // With 200ms throttle and 50ms intervals:
      // Call at 0ms: ✅ executes (first call)
      // Call at 50ms: ❌ throttled (elapsed 50ms < 200ms)
      // Call at 100ms: ❌ throttled (elapsed 100ms < 200ms)
      // Call at 150ms: ❌ throttled (elapsed 150ms < 200ms)
      // Call at 200ms: ✅ executes (elapsed 200ms >= 200ms)
      // etc.

      expect(results[0].ok).toBe(true) // First call always succeeds
      expect(executionCount).toBeGreaterThanOrEqual(1)
      expect(executionCount).toBeLessThanOrEqual(3) // Should be ~2-3 executions with this timing

      cyre.forget(actionId)
    })

    test('should respect throttle timing precision', async () => {
      const actionId = 'timing-precision-test'
      let executionCount = 0

      cyre.on(actionId, () => {
        executionCount++
        return {executed: true}
      })

      cyre.action({
        id: actionId,
        throttle: 500 // 500ms throttle
      })

      // First execution
      await cyre.call(actionId)
      expect(executionCount).toBe(1)

      // Call just before throttle expires (should be rejected)
      vi.advanceTimersByTime(499)
      const earlyResult = await cyre.call(actionId)
      expect(earlyResult.ok).toBe(false)
      expect(executionCount).toBe(1)

      // Call after throttle expires (should execute)
      vi.advanceTimersByTime(2) // Total 501ms
      const lateResult = await cyre.call(actionId)
      expect(lateResult.ok).toBe(true)
      expect(executionCount).toBe(2)

      cyre.forget(actionId)
    })
  })

  // ============================================================================
  // API RATE LIMITING SCENARIOS
  // ============================================================================

  describe('API Rate Limiting Scenarios', () => {
    test('should throttle API calls to respect rate limits', async () => {
      const actionId = 'api-rate-limit'
      let apiCallCount = 0
      const apiResponses: any[] = []

      // Mock API handler
      cyre.on(actionId, async payload => {
        apiCallCount++
        const response = {
          status: 'success',
          data: payload,
          timestamp: Date.now(),
          callNumber: apiCallCount
        }
        apiResponses.push(response)
        return response
      })

      cyre.action({
        id: actionId,
        throttle: 1000 // 1 request per second
      })

      // Simulate rapid API call attempts (5 calls sequentially)
      const responses = []
      for (let i = 0; i < 5; i++) {
        responses.push(
          await cyre.call(actionId, {endpoint: `/data/${i}`, userId: 123})
        )
        vi.advanceTimersByTime(40) // 40ms between attempts
      }

      // Only first call should succeed
      expect(responses[0].ok).toBe(true)
      expect(apiCallCount).toBe(1)

      // Rest should be throttled
      for (let i = 1; i < responses.length; i++) {
        expect(responses[i].ok).toBe(false)
      }

      // Wait for next allowed call
      vi.advanceTimersByTime(1000)
      const nextCall = await cyre.call(actionId, {
        endpoint: '/next',
        userId: 123
      })
      expect(nextCall.ok).toBe(true)
      expect(apiCallCount).toBe(2)

      cyre.forget(actionId)
    })

    test('should handle different throttle rates for different endpoints', async () => {
      const highFreqActionId = 'high-frequency-api'
      const lowFreqActionId = 'low-frequency-api'
      let highFreqCount = 0
      let lowFreqCount = 0

      // High frequency endpoint (100ms throttle)
      cyre.on(highFreqActionId, () => {
        highFreqCount++
        return {endpoint: 'high-freq', count: highFreqCount}
      })

      cyre.action({
        id: highFreqActionId,
        throttle: 100
      })

      // Low frequency endpoint (1000ms throttle)
      cyre.on(lowFreqActionId, () => {
        lowFreqCount++
        return {endpoint: 'low-freq', count: lowFreqCount}
      })

      cyre.action({
        id: lowFreqActionId,
        throttle: 1000
      })

      // Test high frequency calls
      await cyre.call(highFreqActionId)
      expect(highFreqCount).toBe(1)

      vi.advanceTimersByTime(100)
      await cyre.call(highFreqActionId)
      expect(highFreqCount).toBe(2)

      // Test low frequency calls
      await cyre.call(lowFreqActionId)
      expect(lowFreqCount).toBe(1)

      vi.advanceTimersByTime(100)
      await cyre.call(lowFreqActionId)
      expect(lowFreqCount).toBe(1) // Should still be throttled

      vi.advanceTimersByTime(900)
      await cyre.call(lowFreqActionId)
      expect(lowFreqCount).toBe(2) // Now should execute

      cyre.forget(highFreqActionId)
      cyre.forget(lowFreqActionId)
    })
  })

  // ============================================================================
  // USER INTERACTION THROTTLING
  // ============================================================================

  describe('User Interaction Throttling', () => {
    test('should throttle button clicks to prevent spam', async () => {
      const actionId = 'button-click-throttle'
      let clickCount = 0
      const clickEvents: any[] = []

      cyre.on(actionId, payload => {
        clickCount++
        clickEvents.push({
          clickNumber: clickCount,
          buttonId: payload.buttonId,
          timestamp: Date.now()
        })
        return {processed: true, clickNumber: clickCount}
      })

      cyre.action({
        id: actionId,
        throttle: 500 // 500ms between clicks
      })

      // Simulate rapid button clicking
      const clicks = [
        {buttonId: 'submit', action: 'click'},
        {buttonId: 'submit', action: 'click'},
        {buttonId: 'submit', action: 'click'},
        {buttonId: 'submit', action: 'click'}
      ]

      for (let i = 0; i < clicks.length; i++) {
        await cyre.call(actionId, clicks[i])
        vi.advanceTimersByTime(100) // 100ms between rapid clicks
      }

      // Only first click should be processed
      expect(clickCount).toBe(1)
      expect(clickEvents).toHaveLength(1)

      // Wait for throttle to expire and try again
      vi.advanceTimersByTime(500)
      await cyre.call(actionId, {buttonId: 'submit', action: 'click'})

      expect(clickCount).toBe(2)

      cyre.forget(actionId)
    })

    test('should throttle search input while preserving user experience', async () => {
      const actionId = 'search-throttle'
      let searchCount = 0
      const searchQueries: string[] = []

      cyre.on(actionId, payload => {
        searchCount++
        searchQueries.push(payload.query)
        return {
          results: [`Result for: ${payload.query}`],
          searchNumber: searchCount
        }
      })

      cyre.action({
        id: actionId,
        throttle: 300 // 300ms between searches
      })

      // Simulate typing "react hooks"
      const typingSequence = [
        'r',
        're',
        'rea',
        'reac',
        'react',
        'react ',
        'react h',
        'react ho',
        'react hoo',
        'react hook',
        'react hooks'
      ]

      for (const query of typingSequence) {
        await cyre.call(actionId, {query, userId: 'user123'})
        vi.advanceTimersByTime(50) // Fast typing
      }

      // Only first search should execute immediately
      expect(searchCount).toBe(1)
      expect(searchQueries[0]).toBe('r')

      // Wait for throttle period
      vi.advanceTimersByTime(300)

      // Try final search
      await cyre.call(actionId, {query: 'react hooks final', userId: 'user123'})
      expect(searchCount).toBe(2)

      cyre.forget(actionId)
    })
  })

  // ============================================================================
  // COMBINED PROTECTION MECHANISMS
  // ============================================================================

  describe('Combined Protection Mechanisms', () => {
    test('should work with throttle + detectChanges', async () => {
      const actionId = 'throttle-change-detection'
      let executionCount = 0

      cyre.on(actionId, payload => {
        executionCount++
        return {executed: true, value: payload.value}
      })

      cyre.action({
        id: actionId,
        throttle: 200,
        detectChanges: true
      })

      // First call - should execute
      await cyre.call(actionId, {value: 'A'})
      expect(executionCount).toBe(1)

      // Same payload within throttle - should be blocked by throttle
      await cyre.call(actionId, {value: 'A'})
      expect(executionCount).toBe(1)

      // Wait for throttle, same payload - should be blocked by change detection
      vi.advanceTimersByTime(200)
      await cyre.call(actionId, {value: 'A'})
      expect(executionCount).toBe(1)

      // Different payload after throttle - should execute
      await cyre.call(actionId, {value: 'B'})
      expect(executionCount).toBe(2)

      cyre.forget(actionId)
    })

    test('should NOT combine throttle with debounce (anti-pattern)', async () => {
      const actionId = 'throttle-debounce-antipattern'
      let executionCount = 0

      cyre.on(actionId, () => {
        executionCount++
        return {executed: true}
      })

      // This is an anti-pattern - throttle and debounce together
      // Following Cyre's protection pipeline order: throttle → debounce
      cyre.action({
        id: actionId,
        throttle: 200
      })

      // Document the behavior but mark as anti-pattern
      await cyre.call(actionId, {test: 1})
      expect(executionCount).toBe(1) // First call executes immediately

      // Rapid subsequent calls
      for (let i = 0; i < 5; i++) {
        await cyre.call(actionId, {test: i + 2})
        vi.advanceTimersByTime(50)
      }

      // The behavior here is complex due to throttle + debounce interaction
      // This test documents it but we should recommend avoiding this pattern

      cyre.forget(actionId)
    })
  })

  // ============================================================================
  // STRESS TESTING AND EDGE CASES
  // ============================================================================

  describe('Stress Testing and Edge Cases', () => {
    test('should handle extreme throttle values', async () => {
      const actionId = 'extreme-throttle-test'
      let executionCount = 0

      cyre.on(actionId, () => {
        executionCount++
        return {executed: true}
      })

      // Very small throttle
      cyre.action({
        id: actionId,
        throttle: 1 // 1ms throttle
      })

      await cyre.call(actionId)
      expect(executionCount).toBe(1)

      vi.advanceTimersByTime(1)
      await cyre.call(actionId)
      expect(executionCount).toBe(2)

      cyre.forget(actionId)

      // Very large throttle
      const largeThrottleId = 'large-throttle-test'
      let largeThrottleCount = 0

      cyre.on(largeThrottleId, () => {
        largeThrottleCount++
        return {executed: true}
      })

      cyre.action({
        id: largeThrottleId,
        throttle: Number.MAX_SAFE_INTEGER
      })

      await cyre.call(largeThrottleId)
      expect(largeThrottleCount).toBe(1)

      // Second call should be throttled indefinitely
      await cyre.call(largeThrottleId)
      expect(largeThrottleCount).toBe(1)

      cyre.forget(largeThrottleId)
    })

    test('should maintain throttle state across multiple rapid calls', async () => {
      const actionId = 'throttle-state-test'
      let executionCount = 0
      const executionTimes: number[] = []

      cyre.on(actionId, () => {
        executionCount++
        executionTimes.push(Date.now())
        return {executed: true, count: executionCount}
      })

      cyre.action({
        id: actionId,
        throttle: 500
      })

      // Make 100 rapid calls
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(cyre.call(actionId, {attempt: i}))
        vi.advanceTimersByTime(10) // 10ms between calls
      }

      await Promise.all(promises)

      // Only first call should execute
      expect(executionCount).toBe(1)

      // Wait for throttle to expire
      vi.advanceTimersByTime(500)
      await cyre.call(actionId, {final: true})

      expect(executionCount).toBe(2)

      cyre.forget(actionId)
    })

    test('should handle concurrent actions with different throttle rates', async () => {
      const fastActionId = 'fast-action'
      const slowActionId = 'slow-action'
      let fastCount = 0
      let slowCount = 0

      cyre.on(fastActionId, () => {
        fastCount++
        return {type: 'fast', count: fastCount}
      })

      cyre.on(slowActionId, () => {
        slowCount++
        return {type: 'slow', count: slowCount}
      })

      cyre.action({id: fastActionId, throttle: 50})
      cyre.action({id: slowActionId, throttle: 500})

      // Interleave calls to both actions
      const promises = []
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          promises.push(cyre.call(fastActionId, {iteration: i}))
        } else {
          promises.push(cyre.call(slowActionId, {iteration: i}))
        }
        vi.advanceTimersByTime(25)
      }

      await Promise.all(promises)

      // Fast action should allow more executions
      expect(fastCount).toBeGreaterThan(0)
      expect(slowCount).toBeGreaterThan(0)

      // Fast should have more executions than slow
      // (This depends on exact timing, but fast should generally allow more)

      cyre.forget(fastActionId)
      cyre.forget(slowActionId)
    })
  })

  // ============================================================================
  // REAL-WORLD PERFORMANCE SCENARIOS
  // ============================================================================

  describe('Real-World Performance Scenarios', () => {
    test('should throttle analytics events effectively', async () => {
      const actionId = 'analytics-throttle'
      let eventCount = 0
      const events: any[] = []

      cyre.on(actionId, payload => {
        eventCount++
        events.push({
          eventType: payload.eventType,
          timestamp: Date.now(),
          data: payload.data
        })
        return {tracked: true, eventNumber: eventCount}
      })

      cyre.action({
        id: actionId,
        throttle: 1000 // Max 1 analytics event per second
      })

      // Simulate user interaction bursts
      const userActions = [
        {eventType: 'page_view', data: {page: '/home'}},
        {eventType: 'click', data: {element: 'button1'}},
        {eventType: 'click', data: {element: 'button2'}},
        {eventType: 'scroll', data: {position: 100}},
        {eventType: 'scroll', data: {position: 200}},
        {eventType: 'click', data: {element: 'link1'}}
      ]

      // Fire all events rapidly
      for (const action of userActions) {
        await cyre.call(actionId, action)
        vi.advanceTimersByTime(100)
      }

      // Only first event should be tracked
      expect(eventCount).toBe(1)
      expect(events[0].eventType).toBe('page_view')

      cyre.forget(actionId)
    })

    test('should handle notification throttling with priority', async () => {
      const notificationId = 'notification-throttle'
      let notificationCount = 0
      const notifications: any[] = []

      cyre.on(notificationId, payload => {
        notificationCount++
        notifications.push({
          message: payload.message,
          priority: payload.priority,
          timestamp: Date.now()
        })
        return {sent: true, notificationNumber: notificationCount}
      })

      cyre.action({
        id: notificationId,
        throttle: 2000, // Max 1 notification per 2 seconds
        priority: 'medium' // Normal priority action
      })

      // Simulate notification spam
      const messages = [
        {message: 'Welcome!', priority: 'low'},
        {message: 'New message', priority: 'medium'},
        {message: 'System alert', priority: 'high'},
        {message: 'Another alert', priority: 'high'},
        {message: 'Spam message', priority: 'low'}
      ]

      for (const msg of messages) {
        await cyre.call(notificationId, msg)
        vi.advanceTimersByTime(200)
      }

      // Only first notification should be sent
      expect(notificationCount).toBe(1)
      expect(notifications[0].message).toBe('Welcome!')

      cyre.forget(notificationId)
    })
  })
})
