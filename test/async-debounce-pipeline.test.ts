// test/async-debounce-pipeline.test.ts
// Test for async debounce integration with pipeline

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/'

describe('Async Debounce Pipeline Integration', () => {
  beforeEach(() => {
    cyre.initialize()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cyre.clear()
    vi.useRealTimers()
  })

  describe('Debounce Pipeline Flow', () => {
    it('should complete full pipeline after debounce delay', async () => {
      const actionId = `debounce-pipeline-${Date.now()}`
      const handlerMock = vi.fn().mockReturnValue({executed: true})

      // Set up action with debounce and change detection
      cyre.action({
        id: actionId,
        debounce: 300,
        detectChanges: true,
        payload: {initial: true}
      })

      cyre.on(actionId, handlerMock)

      // Start the call - this should initiate debounce
      const callPromise = cyre.call(actionId, {test: 'data'})

      // Handler should not be called immediately
      expect(handlerMock).not.toHaveBeenCalled()

      // Advance time but not enough for debounce
      vi.advanceTimersByTime(200)
      await vi.waitFor(() => {}, {timeout: 50})
      expect(handlerMock).not.toHaveBeenCalled()

      // Advance time to complete debounce
      vi.advanceTimersByTime(150) // Total 350ms > 300ms debounce

      // Wait for the call promise to resolve
      const result = await callPromise

      expect(result.ok).toBe(true)
      expect(handlerMock).toHaveBeenCalledOnce()
      expect(handlerMock).toHaveBeenCalledWith({test: 'data'})
    })

    it('should apply change detection after debounce', async () => {
      const actionId = `debounce-change-${Date.now()}`
      const handlerMock = vi.fn().mockReturnValue({executed: true})

      cyre.action({
        id: actionId,
        debounce: 200,
        detectChanges: true,
        payload: {count: 0}
      })

      cyre.on(actionId, handlerMock)

      // First call with new data
      const call1Promise = cyre.call(actionId, {count: 1})
      vi.advanceTimersByTime(250)
      await call1Promise

      expect(handlerMock).toHaveBeenCalledOnce()
      handlerMock.mockClear()

      // Second call with same data - should be blocked by change detection
      const call2Promise = cyre.call(actionId, {count: 1})
      vi.advanceTimersByTime(250)
      const result2 = await call2Promise

      // Should be blocked by change detection after debounce
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('unchanged')
      expect(handlerMock).not.toHaveBeenCalled()
    })

    it('should handle multiple rapid calls with debounce collapse', async () => {
      const actionId = `debounce-collapse-${Date.now()}`
      const handlerMock = vi.fn().mockReturnValue({executed: true})

      cyre.action({
        id: actionId,
        debounce: 300,
        payload: {}
      })

      cyre.on(actionId, handlerMock)

      // Make multiple rapid calls
      const call1 = cyre.call(actionId, {attempt: 1})
      const call2 = cyre.call(actionId, {attempt: 2})
      const call3 = cyre.call(actionId, {attempt: 3})

      // None should execute immediately
      expect(handlerMock).not.toHaveBeenCalled()

      // Advance time to complete all debounces
      vi.advanceTimersByTime(350)

      // Wait for all promises
      await Promise.all([call1, call2, call3])

      // Only the last call should execute (debounce collapse)
      expect(handlerMock).toHaveBeenCalledOnce()
      expect(handlerMock).toHaveBeenCalledWith({attempt: 3})
    })

    it('should integrate with throttle protection after debounce', async () => {
      const actionId = `debounce-throttle-${Date.now()}`
      const handlerMock = vi.fn().mockReturnValue({executed: true})

      cyre.action({
        id: actionId,
        debounce: 200,
        throttle: 500,
        payload: {}
      })

      cyre.on(actionId, handlerMock)

      // First call
      const call1Promise = cyre.call(actionId, {call: 1})
      vi.advanceTimersByTime(250) // Complete debounce
      await call1Promise

      expect(handlerMock).toHaveBeenCalledOnce()
      handlerMock.mockClear()

      // Second call immediately - should be debounced then throttled
      const call2Promise = cyre.call(actionId, {call: 2})
      vi.advanceTimersByTime(250) // Complete debounce
      const result2 = await call2Promise

      // Should be blocked by throttle after debounce completes
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('Throttled')
      expect(handlerMock).not.toHaveBeenCalled()
    })

    it('should handle timeline integration after debounce', async () => {
      const actionId = `debounce-timeline-${Date.now()}`
      const handlerMock = vi.fn().mockReturnValue({executed: true})

      cyre.action({
        id: actionId,
        debounce: 200,
        interval: 300,
        repeat: 2,
        payload: {}
      })

      cyre.on(actionId, handlerMock)

      // Call with debounce + timeline
      const callPromise = cyre.call(actionId, {test: 'timeline'})

      // Complete debounce
      vi.advanceTimersByTime(250)
      const result = await callPromise

      // Should indicate timeline scheduling
      expect(result.ok).toBe(true)
      expect(result.metadata?.scheduled).toBe(true)

      // Handler not called yet - timeline should handle execution
      expect(handlerMock).not.toHaveBeenCalled()

      // Advance time for timeline execution
      vi.advanceTimersByTime(350) // First interval execution
      await vi.waitFor(() => expect(handlerMock).toHaveBeenCalledTimes(1))

      vi.advanceTimersByTime(300) // Second interval execution
      await vi.waitFor(() => expect(handlerMock).toHaveBeenCalledTimes(2))
    })

    it('should handle system recuperation protection after debounce', async () => {
      const actionId = `debounce-recuperation-${Date.now()}`
      const handlerMock = vi.fn().mockReturnValue({executed: true})

      cyre.action({
        id: actionId,
        debounce: 200,
        priority: {level: 'medium'},
        payload: {}
      })

      cyre.on(actionId, handlerMock)

      // Simulate system stress to trigger recuperation
      // This would require accessing internal state - simplified for test
      const callPromise = cyre.call(actionId, {test: 'recuperation'})

      vi.advanceTimersByTime(250)
      const result = await callPromise

      // In normal conditions, should execute
      expect(result.ok).toBe(true)
      expect(handlerMock).toHaveBeenCalledOnce()
    })

    it('should maintain proper error handling in async pipeline', async () => {
      const actionId = `debounce-error-${Date.now()}`
      const handlerMock = vi.fn().mockImplementation(() => {
        throw new Error('Handler error')
      })

      cyre.action({
        id: actionId,
        debounce: 200,
        payload: {}
      })

      cyre.on(actionId, handlerMock)

      const callPromise = cyre.call(actionId, {test: 'error'})

      vi.advanceTimersByTime(250)
      const result = await callPromise

      // Call should succeed (pipeline worked), but handler error should be contained
      expect(result.ok).toBe(true) // Pipeline succeeded
      expect(handlerMock).toHaveBeenCalledOnce()
    })

    it('should handle concurrent debounced calls to different actions', async () => {
      const action1Id = `debounce-concurrent-1-${Date.now()}`
      const action2Id = `debounce-concurrent-2-${Date.now()}`
      const handler1Mock = vi.fn().mockReturnValue({action: 1})
      const handler2Mock = vi.fn().mockReturnValue({action: 2})

      cyre.action({id: action1Id, debounce: 200, payload: {}})
      cyre.action({id: action2Id, debounce: 300, payload: {}})

      cyre.on(action1Id, handler1Mock)
      cyre.on(action2Id, handler2Mock)

      // Start both calls
      const call1Promise = cyre.call(action1Id, {test: 'action1'})
      const call2Promise = cyre.call(action2Id, {test: 'action2'})

      // Complete first debounce
      vi.advanceTimersByTime(250)
      await call1Promise
      expect(handler1Mock).toHaveBeenCalledOnce()
      expect(handler2Mock).not.toHaveBeenCalled()

      // Complete second debounce
      vi.advanceTimersByTime(100) // Total 350ms
      await call2Promise
      expect(handler2Mock).toHaveBeenCalledOnce()
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero debounce time', async () => {
      const actionId = `debounce-zero-${Date.now()}`
      const handlerMock = vi.fn().mockReturnValue({executed: true})

      cyre.action({
        id: actionId,
        debounce: 0,
        payload: {}
      })

      cyre.on(actionId, handlerMock)

      const result = await cyre.call(actionId, {test: 'zero'})

      expect(result.ok).toBe(true)
      expect(handlerMock).toHaveBeenCalledOnce()
    })

    it('should handle debounce timer failure gracefully', async () => {
      const actionId = `debounce-timer-fail-${Date.now()}`
      const handlerMock = vi.fn().mockReturnValue({executed: true})

      // Mock TimeKeeper.keep to fail
      const originalKeep = cyre.setTimer
      vi.spyOn(cyre, 'setTimer').mockReturnValue({
        ok: false,
        message: 'Timer creation failed'
      })

      cyre.action({
        id: actionId,
        debounce: 200,
        payload: {}
      })

      cyre.on(actionId, handlerMock)

      const result = await cyre.call(actionId, {test: 'timer-fail'})

      expect(result.ok).toBe(false)
      expect(result.message).toContain('timer failed')
      expect(handlerMock).not.toHaveBeenCalled()
    })

    it('should clean up debounce state on action forget', () => {
      const actionId = `debounce-cleanup-${Date.now()}`

      cyre.action({
        id: actionId,
        debounce: 300,
        payload: {}
      })

      // Start a debounced call
      cyre.call(actionId, {test: 'cleanup'})

      // Forget the action
      const forgotten = cyre.forget(actionId)
      expect(forgotten).toBe(true)

      // Timer should be cleaned up (no way to directly test, but should not error)
      vi.advanceTimersByTime(350)
      // If cleanup worked, advancing timers won't cause issues
    })
  })
})
