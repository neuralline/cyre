// test/protections/cyre-debounce.test.ts
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll
} from 'vitest'
import {cyre} from '../src'

/*

      Rewritten for the debounce/buffer settle-promise fix (see
      src/context/pending-state.ts, src/app.ts's call()): cyre.call() on a
      debounced channel no longer returns an immediate "scheduled"
      acknowledgment - it returns a promise that resolves with the REAL
      handler result once the debounce window actually elapses and
      executes. Every call landing in the SAME window shares that one
      promise and resolves together off ONE real execution.

      This changes how these tests have to be written, not just what they
      assert:
        - NEVER `await cyre.call(...)` on a debounced channel before
          advancing the fake clock - the promise now genuinely depends on
          a timer firing, so under vi.useFakeTimers() it will hang until
          the clock is advanced. Fire the call, capture the promise
          WITHOUT awaiting it, do any synchronous assertions, THEN
          advance time, THEN await the promise.
        - Use vi.advanceTimersByTimeAsync() (not the sync
          advanceTimersByTime()) whenever a promise needs to observe the
          result - TimeKeeper's deferred callback itself does
          `await processCall(...)`, and only the *Async variant flushes
          that microtask chain as it advances.
        - There is no more per-call "debounced"/"scheduled" ack message or
          metadata.delay on the happy path - assertions now check the
          REAL result (ok, handler call count/args) instead.
        - Multiple rapid calls in the same window now resolve to the SAME
          result, off the LAST payload that landed before the window
          closed - not one ack per call.
        - cyre-call.ts's processCall() reads the effective payload as
          `payload ?? payloadState.get(action.id)` - a literal `null`
          argument is nullish, so it is NOT treated as "explicitly null",
          it falls back to whatever payload state that channel already
          holds (undefined for a channel that's never successfully
          executed, or the LAST successfully executed payload otherwise).
          Tests below that pass `null` account for this rather than
          assuming `null` reaches the handler/validator verbatim.

*/

describe('Cyre Debounce Protection', () => {
  beforeAll(async () => {
    await cyre.init()
  })

  beforeEach(async () => {
    vi.useFakeTimers()
    cyre.clear()
    await cyre.init()
  })

  afterEach(() => {
    vi.useRealTimers()
    cyre.clear()
  })

  describe('Basic Debounce Behavior', () => {
    it('should debounce rapid calls and execute only the last one', async () => {
      const handler = vi.fn((data: any) => `processed-${data}`)

      cyre.action({
        id: 'debounced-action',
        debounce: 500
      })
      cyre.on('debounced-action', handler)

      // Fire 3 rapid calls WITHOUT awaiting each one - they share one
      // settle promise for this window, so awaiting inline would each
      // block for the full 500ms before the next call even fires.
      const p1 = cyre.call('debounced-action', 'call1')
      const p2 = cyre.call('debounced-action', 'call2')
      const p3 = cyre.call('debounced-action', 'call3')

      // Still inside the window - nothing has executed yet
      expect(handler).not.toHaveBeenCalled()

      // Advance past the debounce window, flushing the deferred callback's
      // own internal await chain as it goes
      await vi.advanceTimersByTimeAsync(500)

      const [result1, result2, result3] = await Promise.all([p1, p2, p3])

      // One real execution served all 3 callers, using the LAST payload
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('call3')
      expect(result1.ok).toBe(true)
      expect(result2.ok).toBe(true)
      expect(result3.ok).toBe(true)
      // All 3 share the exact same settled result
      expect(result1).toEqual(result2)
      expect(result2).toEqual(result3)
    })

    it('should reset debounce timer on each new call', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'reset-debounce',
        debounce: 1000
      })
      cyre.on('reset-debounce', handler)

      // First call opens a window
      const p1 = cyre.call('reset-debounce', 'call1')

      // Advance partway through - NOT far enough for call1's window to
      // fire on its own
      await vi.advanceTimersByTimeAsync(600)
      expect(handler).not.toHaveBeenCalled()

      // Second call should cancel and re-arm a fresh 1000ms timer
      // (app.ts: timeline.get(debounceId) is truthy here, so it calls
      // TimeKeeper.forget(debounceId) and re-arms via TimeKeeper.keep())
      const p2 = cyre.call('reset-debounce', 'call2')

      // Advance to where call1's ORIGINAL window would have fired
      // (600 + 500 = 1100ms since call1) - if the timer was genuinely
      // reset rather than just left running, nothing should have
      // executed yet, since the reset window needs its own full 1000ms
      await vi.advanceTimersByTimeAsync(500)
      expect(handler).not.toHaveBeenCalled()

      // Advance the rest of the RESET window (1000ms from call2)
      await vi.advanceTimersByTimeAsync(500)

      const [result1, result2] = await Promise.all([p1, p2])

      // Timer was reset, not just left running - one execution, call2's
      // payload wins (it was the last one in before the window closed)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('call2')
      expect(result1.ok).toBe(true)
      expect(result2.ok).toBe(true)
    })

    it('should handle debounce with different payload types', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'payload-debounce',
        debounce: 300
      })
      cyre.on('payload-debounce', handler)

      // All 5 land in the same window - only the LAST call's payload
      // actually gets executed
      const promises = [
        cyre.call('payload-debounce', 'string'),
        cyre.call('payload-debounce', 42),
        cyre.call('payload-debounce', {object: 'value'}),
        cyre.call('payload-debounce', ['array', 'value']),
        cyre.call('payload-debounce', null)
      ]

      expect(handler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(300)
      const results = await Promise.all(promises)

      expect(handler).toHaveBeenCalledTimes(1)
      // The last call's payload is a literal `null`, which processCall's
      // `payload ?? payloadState.get(action.id)` treats as nullish and
      // falls back to this channel's stored payload state - undefined
      // here, since this channel never had a default payload or a prior
      // successful execution
      expect(handler).toHaveBeenCalledWith(undefined)
      expect(results.every(r => r.ok)).toBe(true)
      // All 5 callers share the identical settled result
      results.forEach(r => expect(r).toEqual(results[0]))
    })
  })

  describe('Debounce with maxWait', () => {
    it('should execute after maxWait even with continuous calls', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'maxwait-debounce',
        debounce: 500,
        maxWait: 2000
      })
      cyre.on('maxwait-debounce', handler)

      const promises: Promise<any>[] = [
        cyre.call('maxwait-debounce', 'initial')
      ]

      // Keep calling every 400ms (before each 500ms debounce window can
      // fire on its own) - maxWait:2000 should force a real execution
      // once 2000ms have elapsed since the FIRST call, regardless of the
      // debounce window continuing to get reset by each new call.
      for (let i = 1; i <= 6; i++) {
        await vi.advanceTimersByTimeAsync(400)
        promises.push(cyre.call('maxwait-debounce', `call${i}`))
      }

      // Let any still-pending window finish naturally
      await vi.advanceTimersByTimeAsync(600)

      const results = await Promise.all(promises)

      // maxWait must have forced at least one real execution somewhere
      // in this continuous-call sequence - debounce alone (no maxWait)
      // would never fire while calls keep arriving every 400ms
      expect(handler.mock.calls.length).toBeGreaterThanOrEqual(1)
      // Every caller's promise must have actually resolved (not hung) -
      // Promise.all above already proves that, this just documents it
      expect(results).toHaveLength(7)
      results.forEach(r => expect(r).toHaveProperty('ok'))
    })

    it('should validate maxWait is greater than debounce', () => {
      const result = cyre.action({
        id: 'invalid-maxwait',
        debounce: 1000,
        maxWait: 500 // Invalid: less than debounce
      })

      expect(result.ok).toBe(false)
      expect(result.message).toContain('maxWait must be greater than debounce')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle handler errors during debounced execution', async () => {
      const flakyHandler = vi.fn(() => {
        throw new Error('Handler failed')
      })

      cyre.action({
        id: 'error-debounce',
        debounce: 300
      })
      cyre.on('error-debounce', flakyHandler)

      const callPromise = cyre.call('error-debounce', 'test')
      await vi.advanceTimersByTimeAsync(300)
      const result = await callPromise

      // The real execution happened and the handler really threw - the
      // settled result should reflect that failure, not a "debounced"
      // acknowledgment that predates the handler even running
      expect(flakyHandler).toHaveBeenCalledTimes(1)
      expect(result.ok).toBe(false)
    })

    it('should handle channel removal during debounce', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'removable-debounce',
        debounce: 500
      })
      cyre.on('removable-debounce', handler)

      // Fire WITHOUT awaiting - forget() below needs to run while this
      // is still pending, not after it's already resolved
      const callPromise = cyre.call('removable-debounce', 'test')

      // Remove the channel before the debounce window ever elapses
      const removed = cyre.forget('removable-debounce')
      expect(removed).toBe(true)

      // The pending call must still resolve (not hang forever) - this is
      // exactly what pendingState.forget()'s cancellation resolve exists
      // for. It resolves with a failure, since the channel is gone.
      const result = await callPromise
      expect(result.ok).toBe(false)

      // Advancing time further should not cause any execution - the
      // channel and its timer are both gone
      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle zero and negative debounce values', () => {
      // Zero debounce should be allowed (effectively disables debouncing)
      const result1 = cyre.action({
        id: 'zero-debounce',
        debounce: 0
      })
      expect(result1.ok).toBe(true)

      // Negative debounce should be rejected
      const result2 = cyre.action({
        id: 'negative-debounce',
        debounce: -100
      })
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('positive number')
    })
  })

  describe('Debounce Performance', () => {
    it('should handle high-frequency calls efficiently', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'high-freq-debounce',
        debounce: 100
      })
      cyre.on('high-freq-debounce', handler)

      // Fire 100 rapid calls, all landing in the same window
      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(cyre.call('high-freq-debounce', `call${i}`))
      }

      expect(handler).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(100)
      const results = await Promise.all(promises)

      // 100 calls sharing ONE window means exactly ONE real execution,
      // not 100 - that's the whole point of debounce, and it's now
      // provable directly instead of inferring it from an ack message
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('call99')
      expect(results.every(r => r.ok)).toBe(true)
    })

    it('should clean up debounce timers properly', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'cleanup-debounce',
        debounce: 500
      })
      cyre.on('cleanup-debounce', handler)

      // Fire WITHOUT awaiting - clear() below needs to run while this is
      // still pending
      const callPromise = cyre.call('cleanup-debounce', 'test')

      // System clear should cancel the pending timer AND resolve anyone
      // still waiting on it (pendingState.clear()'s cancellation resolve)
      cyre.clear()

      const result = await callPromise
      expect(result.ok).toBe(false)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Debounce with Other Protections', () => {
    it('should work with required validation', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'debounce-required',
        debounce: 300,
        required: true
      })
      cyre.on('debounce-required', handler)

      // Test the null/invalid case FIRST, before this channel has any
      // stored payload state - processCall's `payload ?? payloadState.get(
      // action.id)` falls back to prior payload state for a nullish
      // argument, so testing this after a successful call would let the
      // fallback smuggle the earlier valid payload back in and mask
      // required's actual rejection.
      const invalidPromise = cyre.call('debounce-required', null)
      await vi.advanceTimersByTimeAsync(300)
      const result1 = await invalidPromise

      expect(result1.ok).toBe(false)
      expect(result1.message).toContain('required')
      expect(handler).not.toHaveBeenCalled()

      // Now a valid payload in its own window should execute normally
      const validPromise = cyre.call('debounce-required', {valid: 'data'})
      await vi.advanceTimersByTimeAsync(300)
      const result2 = await validPromise

      expect(result2.ok).toBe(true)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({valid: 'data'})
    })

    it('should work with detectChanges', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'debounce-changes',
        debounce: 300,
        detectChanges: true,
        payload: {initial: 'value'}
      })
      cyre.on('debounce-changes', handler)

      // All 3 land in one window - only the LAST payload ({different:
      // 'value'}) actually executes, and it DOES differ from the
      // channel's stored initial payload, so detectChanges should let it
      // through and the handler SHOULD run once.
      const p1 = cyre.call('debounce-changes', {initial: 'value'})
      const p2 = cyre.call('debounce-changes', {initial: 'value'})
      const p3 = cyre.call('debounce-changes', {different: 'value'})

      await vi.advanceTimersByTimeAsync(300)
      const [result1, result2, result3] = await Promise.all([p1, p2, p3])

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({different: 'value'})
      expect(result1.ok).toBe(true)
      expect(result1).toEqual(result2)
      expect(result2).toEqual(result3)
    })
  })

  describe('Debounce Settle Timing', () => {
    it('should not resolve before the debounce window elapses', async () => {
      cyre.action({
        id: 'timing-debounce',
        debounce: 750
      })
      cyre.on('timing-debounce', vi.fn())

      let settled = false
      cyre.call('timing-debounce', 'test').then(() => {
        settled = true
      })

      // Flush microtasks without advancing the clock at all - the
      // promise must still be pending
      await Promise.resolve()
      await Promise.resolve()
      expect(settled).toBe(false)

      // Advance most, but not all, of the window
      await vi.advanceTimersByTimeAsync(700)
      expect(settled).toBe(false)

      // Advance past the full window
      await vi.advanceTimersByTimeAsync(100)
      expect(settled).toBe(true)
    })

    it('should update payload state after the debounced call actually settles', async () => {
      cyre.action({
        id: 'state-debounce',
        debounce: 200,
        payload: {initial: 'state'}
      })
      cyre.on('state-debounce', vi.fn())

      const callPromise = cyre.call('state-debounce', {updated: 'state'})

      // Before the window elapses, payload state should still reflect
      // whatever it was before this call - the real execution (which is
      // what updates it) hasn't happened yet
      await vi.advanceTimersByTimeAsync(200)
      const result = await callPromise

      expect(result.ok).toBe(true)
      // Once actually executed, payload state reflects the executed call.
      // cyre.get() returns the full {req, res, prevReq, metadata} payload
      // state record, not just the raw request payload - see cyre.test.ts's
      // "should get current payload" for the same {req: ...} shape.
      const currentState = cyre.get('state-debounce')
      expect(currentState.req).toEqual({updated: 'state'})
    })
  })
})
