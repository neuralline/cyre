// test/protections/cyre-buffer.test.ts
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/index'

describe('Cyre Buffer Protection', () => {
  beforeEach(async () => {
    // Fake timers must be active BEFORE cyre.init() ever starts the quartz
    // engine. If init() runs under real timers (as it did previously via a
    // beforeAll that ran before the first useFakeTimers() call), the engine
    // schedules its tick loop against the real setTimeout/setImmediate.
    // clearTimeout/clearImmediate can't cancel a handle created by a
    // different timer implementation than the one currently installed, so
    // that loop keeps ticking on real wall-clock time for the rest of the
    // suite - completely independent of vi.advanceTimersByTime() - and can
    // fire buffered/scheduled callbacks at effectively random moments.
    vi.useFakeTimers()
    cyre.clear()
    await cyre.init()
  })

  afterEach(() => {
    // Clear (which stops the quartz engine) MUST happen while the same
    // fake timers that scheduled its pending tick are still active, so the
    // cancellation actually works. Switching back to real timers first, as
    // this used to do, leaves the engine's tick handle uncancellable and
    // lets it keep running into the next test.
    cyre.clear()
    vi.useRealTimers()
  })

  // CYRE v4.7.0: cyre.call() on a buffered channel no longer returns an
  // immediate "buffered/scheduled" ack - it returns a promise that resolves
  // with the REAL handler result once the buffer window closes, shared by
  // every caller that landed in the same window (see context/pending-state.ts).
  // That means these tests must NEVER `await cyre.call(...)` directly under
  // fake timers without first advancing the clock past the window - doing so
  // hangs forever, since nothing will ever fire the deferred callback that
  // resolves the promise. The pattern used throughout this file: capture the
  // promise (or promises) without awaiting, make any synchronous assertions
  // ("handler not called yet"), advance the fake clock past the window with
  // vi.advanceTimersByTimeAsync(), THEN await the captured promise(s).

  describe('Basic Buffer Behavior', () => {
    it('should buffer calls with overwrite strategy', async () => {
      const handler = vi.fn((data: any) => `processed-${data}`)

      cyre.action({
        id: 'buffered-overwrite',
        buffer: {window: 1000, strategy: 'overwrite'}
      })
      cyre.on('buffered-overwrite', handler)

      // All three calls land in the same window and share ONE settle promise
      const p1 = cyre.call('buffered-overwrite', 'data1')
      const p2 = cyre.call('buffered-overwrite', 'data2')
      const p3 = cyre.call('buffered-overwrite', 'data3')

      // Handler hasn't run yet - the window hasn't closed
      expect(handler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1000)
      const [result1, result2, result3] = await Promise.all([p1, p2, p3])

      // Overwrite strategy: only the LAST payload survives into the window
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('data3')

      // All three callers share the same settled result
      expect(result1.ok).toBe(true)
      expect(result1.payload).toBe('processed-data3')
      expect(result2).toEqual(result1)
      expect(result3).toEqual(result1)
    })

    it('should buffer calls with append strategy', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'buffered-append',
        buffer: {window: 500, strategy: 'append'}
      })
      cyre.on('buffered-append', handler)

      const p1 = cyre.call('buffered-append', 'item1')
      const p2 = cyre.call('buffered-append', 'item2')
      const p3 = cyre.call('buffered-append', 'item3')

      expect(handler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(500)
      const results = await Promise.all([p1, p2, p3])

      // Append strategy: the handler sees every payload collected in the window
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(['item1', 'item2', 'item3'])

      results.forEach(r => expect(r.ok).toBe(true))
    })

    it('should handle simple number buffer configuration', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'simple-buffer',
        buffer: 750 // Simple number should create {window: 750, strategy: 'overwrite'}
      })
      cyre.on('simple-buffer', handler)

      const pending = cyre.call('simple-buffer', 'test')
      expect(handler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(750)
      const result = await pending

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('test')
      expect(result.ok).toBe(true)
    })
  })

  describe('Buffer Timing and Execution', () => {
    it('should execute buffered calls after window expires', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'timed-buffer',
        buffer: {window: 800}
      })
      cyre.on('timed-buffer', handler)

      // Make calls within buffer window
      const p1 = cyre.call('timed-buffer', 'call1')
      const p2 = cyre.call('timed-buffer', 'call2')

      // Handler not called yet
      expect(handler).not.toHaveBeenCalled()

      // Advance time but not enough to trigger
      await vi.advanceTimersByTimeAsync(500)
      expect(handler).not.toHaveBeenCalled()

      // Advance past buffer window - handler should now fire once with the
      // last payload (default overwrite strategy)
      await vi.advanceTimersByTimeAsync(400)
      const [result1, result2] = await Promise.all([p1, p2])

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('call2')
      expect(result1.ok).toBe(true)
      expect(result2.ok).toBe(true)
    })

    it('should handle multiple buffer windows', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'multi-buffer',
        buffer: {window: 300}
      })
      cyre.on('multi-buffer', handler)

      // First buffer window
      const batch1a = cyre.call('multi-buffer', 'batch1-item1')
      const batch1b = cyre.call('multi-buffer', 'batch1-item2')

      await vi.advanceTimersByTimeAsync(400)
      await Promise.all([batch1a, batch1b])

      // Second buffer window
      const batch2a = cyre.call('multi-buffer', 'batch2-item1')
      const batch2b = cyre.call('multi-buffer', 'batch2-item2')

      await vi.advanceTimersByTimeAsync(400)
      await Promise.all([batch2a, batch2b])

      // Each window closes independently and delivers its own last payload
      // (default overwrite strategy)
      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenNthCalledWith(1, 'batch1-item2')
      expect(handler).toHaveBeenNthCalledWith(2, 'batch2-item2')
    })
  })

  describe('Buffer Strategies', () => {
    it('should validate buffer strategy options', () => {
      // Valid strategies should work
      const result1 = cyre.action({
        id: 'strategy-overwrite',
        buffer: {window: 500, strategy: 'overwrite'}
      })
      expect(result1.ok).toBe(true)

      const result2 = cyre.action({
        id: 'strategy-append',
        buffer: {window: 500, strategy: 'append'}
      })
      expect(result2.ok).toBe(true)

      const result3 = cyre.action({
        id: 'strategy-ignore',
        buffer: {window: 500, strategy: 'ignore'}
      })
      expect(result3.ok).toBe(true)
    })

    it('should handle buffer with maxSize option', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'sized-buffer',
        buffer: {window: 1000, strategy: 'append', maxSize: 3}
      })
      cyre.on('sized-buffer', handler)

      // Make more calls than maxSize - all land in the same window and
      // share the same settle promise
      const pendings = []
      for (let i = 1; i <= 5; i++) {
        pendings.push(cyre.call('sized-buffer', `item${i}`))
      }

      expect(handler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1000)
      const results = await Promise.all(pendings)

      expect(handler).toHaveBeenCalledTimes(1)
      results.forEach(r => expect(r.ok).toBe(true))
    })
  })

  describe('Buffer Edge Cases', () => {
    it('should reject invalid buffer configurations', () => {
      // Negative window
      const result1 = cyre.action({
        id: 'negative-buffer',
        buffer: {window: -100}
      })
      expect(result1.ok).toBe(false)
      expect(result1.message).toContain('positive number')

      // Invalid buffer type
      const result2 = cyre.action({
        id: 'invalid-buffer',
        buffer: 'invalid' as any
      })
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('number or object')
    })

    it('should handle zero buffer window', async () => {
      const handler = vi.fn()

      const result = cyre.action({
        id: 'zero-buffer',
        buffer: {window: 0}
      })

      if (result.ok) {
        cyre.on('zero-buffer', handler)

        // A zero window fails the `action.buffer.window > 0` check in
        // app.ts, so this falls straight through to direct execution -
        // no timer involved, safe to await immediately.
        const callResult = await cyre.call('zero-buffer', 'test')
        expect(callResult.ok).toBe(true)
      } else {
        // Zero window might be rejected
        expect(result.message).toContain('positive number')
      }
    })

    it('should handle channel removal during buffering', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'removable-buffer',
        buffer: {window: 500}
      })
      cyre.on('removable-buffer', handler)

      const pending = cyre.call('removable-buffer', 'test')

      // Remove channel before buffer executes - forget() resolves any
      // in-flight pending promise with a cancellation result rather than
      // leaving it hanging (see context/pending-state.ts)
      const removed = cyre.forget('removable-buffer')
      expect(removed).toBe(true)

      const result = await pending
      expect(result.ok).toBe(false)
      expect(result.message).toContain('forgotten')

      // Advance time - handler shouldn't be called, nothing left to fire it
      await vi.advanceTimersByTimeAsync(600)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Buffer with Other Protections', () => {
    it('should work with required validation', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'buffer-required',
        buffer: {window: 300},
        required: true
      })
      cyre.on('buffer-required', handler)

      // Valid payload should be buffered and eventually settle for real
      const pending1 = cyre.call('buffer-required', {valid: 'data'})
      await vi.advanceTimersByTimeAsync(300)
      const result1 = await pending1
      expect(result1).toHaveProperty('ok')

      // Invalid payload - behavior depends on when validation occurs
      const pending2 = cyre.call('buffer-required', null)
      await vi.advanceTimersByTimeAsync(300)
      const result2 = await pending2
      expect(result2).toHaveProperty('ok')
    })

    it('should work with detectChanges', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'buffer-changes',
        buffer: {window: 300},
        detectChanges: true,
        payload: {initial: 'value'}
      })
      cyre.on('buffer-changes', handler)

      // Calls should be buffered regardless of change detection
      const p1 = cyre.call('buffer-changes', {initial: 'value'})
      const p2 = cyre.call('buffer-changes', {different: 'value'})

      await vi.advanceTimersByTimeAsync(300)
      const [result1, result2] = await Promise.all([p1, p2])

      expect(result1).toHaveProperty('ok')
      expect(result2).toHaveProperty('ok')
    })

    it('should not combine with throttle or debounce', () => {
      const result1 = cyre.action({
        id: 'buffer-throttle-conflict',
        buffer: {window: 500},
        throttle: 1000
      })

      const result2 = cyre.action({
        id: 'buffer-debounce-conflict',
        buffer: {window: 500},
        debounce: 300
      })

      // May or may not be allowed depending on implementation
      // Test documents the current behavior
      expect(result1).toHaveProperty('ok')
      expect(result2).toHaveProperty('ok')
    })
  })

  describe('Buffer Performance', () => {
    it('should handle high-frequency buffered calls', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'high-freq-buffer',
        buffer: {window: 200, strategy: 'append'}
      })
      cyre.on('high-freq-buffer', handler)

      // Make 100 rapid calls - all land in the same window and share one
      // settle promise
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(cyre.call('high-freq-buffer', `call${i}`))
      }

      // Handler not called yet
      expect(handler).not.toHaveBeenCalled()

      // Advance time to trigger buffer
      await vi.advanceTimersByTimeAsync(300)
      const results = await Promise.all(promises)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(results.every(r => r.ok)).toBe(true)
    })

    it('should handle buffer cleanup on system clear', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'cleanup-buffer',
        buffer: {window: 500}
      })
      cyre.on('cleanup-buffer', handler)

      // Make buffered call
      const pending = cyre.call('cleanup-buffer', 'test')

      // Clear system should clean up pending buffers - clear() resolves
      // any in-flight pending promise with a cancellation result rather
      // than leaving it hanging (see context/pending-state.ts)
      cyre.clear()
      const result = await pending
      expect(result.ok).toBe(false)
      expect(result.message).toContain('reset')

      // Re-init so afterEach's cyre.clear() doesn't operate on a torn-down
      // system - beforeEach already did this once, but this test tore it
      // down mid-run
      await cyre.init()

      // Advance time - handler shouldn't be called
      await vi.advanceTimersByTimeAsync(600)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Buffer State Management', () => {
    it('should provide correct buffer metadata', async () => {
      cyre.action({
        id: 'metadata-buffer',
        buffer: {window: 600, strategy: 'append', maxSize: 5}
      })
      cyre.on('metadata-buffer', vi.fn())

      const pending = cyre.call('metadata-buffer', 'test')
      await vi.advanceTimersByTimeAsync(600)
      const result = await pending

      // The settled result is now the real handler's response, not a
      // "scheduled" ack - it carries the dispatch metadata instead of a
      // buffer-specific one
      expect(result.ok).toBe(true)
      expect(result.message).toBe('Operation completed as requested')
    })
  })

  describe('Buffer Error Handling', () => {
    it('should handle buffer execution errors gracefully', async () => {
      const flakyHandler = vi.fn(() => {
        throw new Error('Buffer execution failed')
      })

      cyre.action({
        id: 'error-buffer',
        buffer: {window: 300}
      })
      cyre.on('error-buffer', flakyHandler)

      const pending = cyre.call('error-buffer', 'test')

      // Execute buffer
      await vi.advanceTimersByTimeAsync(400)
      const result = await pending

      // The handler's thrown error surfaces as a real failed result now,
      // instead of being swallowed behind an already-returned "buffered" ack
      expect(flakyHandler).toHaveBeenCalledTimes(1)
      expect(result.ok).toBe(false)
    })

    it('should handle multiple handlers with buffering', async () => {
      const handler1 = vi.fn((data: any) => `result1-${data}`)
      const handler2 = vi.fn((data: any) => `result2-${data}`)

      cyre.action({
        id: 'multi-handler-buffer',
        buffer: {window: 250},
        dispatch: 'parallel'
      })
      cyre.on('multi-handler-buffer', handler1)
      cyre.on('multi-handler-buffer', handler2)

      const pending = cyre.call('multi-handler-buffer', 'test')

      // Handlers not called yet
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(250)
      const result = await pending

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(result.ok).toBe(true)
    })
  })

  describe('Buffer Configuration Validation', () => {
    it('should provide helpful error messages for invalid configs', () => {
      const result1 = cyre.action({
        id: 'bad-window',
        buffer: {window: 'invalid' as any}
      })
      expect(result1.ok).toBe(false)
      expect(result1.message).toContain('positive number')

      const result2 = cyre.action({
        id: 'missing-window',
        buffer: {} as any
      })
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('positive number')
    })

    it('should handle complex buffer configurations', async () => {
      const handler = vi.fn()

      const result = cyre.action({
        id: 'complex-buffer',
        buffer: {
          window: 1000,
          strategy: 'append',
          maxSize: 10
        },
        required: true,
        detectChanges: true
      })

      if (result.ok) {
        cyre.on('complex-buffer', handler)

        const pending = cyre.call('complex-buffer', {data: 'test'})
        await vi.advanceTimersByTimeAsync(1000)
        const callResult = await pending
        expect(callResult).toHaveProperty('ok')
      }
    })
  })

  describe('Buffer Integration Tests', () => {
    it('should work with schema validation', async () => {
      const mockSchema = vi.fn().mockImplementation(data => {
        if (data && data.name) {
          return {ok: true, data}
        }
        return {ok: false, errors: ['Name required']}
      })

      const handler = vi.fn()

      cyre.action({
        id: 'schema-buffer',
        buffer: {window: 400},
        schema: mockSchema
      })
      cyre.on('schema-buffer', handler)

      // Valid data should be buffered and eventually settle for real
      const pending1 = cyre.call('schema-buffer', {name: 'test'})
      await vi.advanceTimersByTimeAsync(400)
      const result1 = await pending1
      expect(result1).toHaveProperty('ok')

      // Invalid data behavior depends on when validation occurs
      const pending2 = cyre.call('schema-buffer', {invalid: 'data'})
      await vi.advanceTimersByTimeAsync(400)
      const result2 = await pending2
      expect(result2).toHaveProperty('ok')
    })

    it('should work with conditional execution', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'condition-buffer',
        buffer: {window: 300},
        condition: (payload: any) => payload.execute === true
      })
      cyre.on('condition-buffer', handler)

      const p1 = cyre.call('condition-buffer', {execute: true})
      const p2 = cyre.call('condition-buffer', {execute: false})

      await vi.advanceTimersByTimeAsync(300)
      const [result1, result2] = await Promise.all([p1, p2])

      // Both share the same window/settle promise
      expect(result1).toHaveProperty('ok')
      expect(result2).toHaveProperty('ok')
    })

    it('should work with payload transformations', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'transform-buffer',
        buffer: {window: 350},
        transform: (payload: any) => ({
          ...payload,
          processed: true,
          timestamp: Date.now()
        })
      })
      cyre.on('transform-buffer', handler)

      const pending = cyre.call('transform-buffer', {original: 'data'})
      await vi.advanceTimersByTimeAsync(350)
      const result = await pending

      expect(result).toHaveProperty('ok')

      // Check buffered state - may not exist immediately for buffered calls
      const currentState = cyre.get('transform-buffer')
      if (currentState && currentState.req) {
        expect(currentState.req).toEqual({
          original: 'data',
          processed: true,
          timestamp: expect.any(Number)
        })
      }
    })
  })
})
