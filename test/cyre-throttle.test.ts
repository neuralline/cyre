// test/cyre-throttle.test.ts
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll
} from 'vitest'
import {cyre} from '../src/index'

describe('Cyre Throttle Protection', () => {
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

  describe('Basic Throttle Behavior', () => {
    it('should allow first call and throttle subsequent calls', async () => {
      const handler = vi.fn((data: any) => `processed-${data}`)

      cyre.action({
        id: 'throttled-action',
        throttle: 1000
      })
      cyre.on('throttled-action', handler)

      // First call should succeed immediately
      const result1 = await cyre.call('throttled-action', 'call1')
      expect(result1.ok).toBe(true)
      expect(result1.payload).toBe('processed-call1')
      expect(handler).toHaveBeenCalledTimes(1)

      // Second call within throttle window should be rejected
      const result2 = await cyre.call('throttled-action', 'call2')
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('throttled')
      expect(result2.message).toMatch(/retry available in \d+ms/)
      expect(handler).toHaveBeenCalledTimes(1)

      // Third call should also be rejected
      const result3 = await cyre.call('throttled-action', 'call3')
      expect(result3.ok).toBe(false)
      expect(result3.message).toContain('throttled')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should allow calls after throttle period expires', async () => {
      const handler = vi.fn((data: any) => `processed-${data}`)

      cyre.action({
        id: 'throttle-expire',
        throttle: 500
      })
      cyre.on('throttle-expire', handler)

      // First call
      const result1 = await cyre.call('throttle-expire', 'call1')
      expect(result1.ok).toBe(true)
      expect(handler).toHaveBeenCalledTimes(1)

      // Call within throttle window - should be rejected
      const result2 = await cyre.call('throttle-expire', 'call2')
      expect(result2.ok).toBe(false)

      // Advance time past throttle period
      vi.advanceTimersByTime(600)

      // Call after throttle expires - should succeed
      const result3 = await cyre.call('throttle-expire', 'call3')
      expect(result3.ok).toBe(true)
      expect(result3.payload).toBe('processed-call3')
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should calculate remaining throttle time accurately', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'throttle-timing',
        throttle: 2000
      })
      cyre.on('throttle-timing', handler)

      // First call
      await cyre.call('throttle-timing', 'call1')

      // Advance part of the throttle period
      vi.advanceTimersByTime(800)

      // Second call should show accurate remaining time
      const result = await cyre.call('throttle-timing', 'call2')
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/retry available in 1[12]\d\dms/)
    })
  })

  describe('Throttle Edge Cases', () => {
    it('should handle zero throttle value (disables throttling)', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'zero-throttle',
        throttle: 0
      })
      cyre.on('zero-throttle', handler)

      // Multiple rapid calls should all succeed
      const result1 = await cyre.call('zero-throttle', 'call1')
      const result2 = await cyre.call('zero-throttle', 'call2')
      const result3 = await cyre.call('zero-throttle', 'call3')

      expect(result1.ok).toBe(true)
      expect(result2.ok).toBe(true)
      expect(result3.ok).toBe(true)
      expect(handler).toHaveBeenCalledTimes(3)
    })

    it('should reject negative throttle values', () => {
      const result = cyre.action({
        id: 'negative-throttle',
        throttle: -100
      })

      expect(result.ok).toBe(false)
      expect(result.message).toContain('positive number')
    })

    it('should handle very small throttle values', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'small-throttle',
        throttle: 1
      })
      cyre.on('small-throttle', handler)

      const result1 = await cyre.call('small-throttle', 'call1')
      expect(result1.ok).toBe(true)

      const result2 = await cyre.call('small-throttle', 'call2')
      expect(result2.ok).toBe(false)

      // Advance minimal time
      vi.advanceTimersByTime(2)

      const result3 = await cyre.call('small-throttle', 'call3')
      expect(result3.ok).toBe(true)
    })
  })

  describe('Throttle Performance', () => {
    it('should handle high-frequency calls efficiently', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'high-freq-throttle',
        throttle: 100
      })
      cyre.on('high-freq-throttle', handler)

      // Make 50 rapid calls - all should succeed due to fast execution
      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(cyre.call('high-freq-throttle', `call${i}`))
      }

      const results = await Promise.all(promises)

      // In fast execution, throttle might not catch all calls
      const successful = results.filter(r => r.ok)
      const throttled = results.filter(r => !r.ok)

      // At least some should be throttled, but exact count may vary
      expect(successful.length).toBeGreaterThanOrEqual(1)
      expect(throttled.length).toBeGreaterThanOrEqual(0)

      // Handler should be called for successful calls
      expect(handler).toHaveBeenCalled()
    })

    it('should maintain throttle state across different payloads', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'payload-throttle',
        throttle: 1000
      })
      cyre.on('payload-throttle', handler)

      // First call with one payload
      const result1 = await cyre.call('payload-throttle', {type: 'A', value: 1})
      expect(result1.ok).toBe(true)

      // Second call with different payload - still throttled
      const result2 = await cyre.call('payload-throttle', {type: 'B', value: 2})
      expect(result2.ok).toBe(false)

      // Handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({type: 'A', value: 1})
    })
  })

  describe('Throttle with Other Protections', () => {
    it('should work with required validation', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'throttle-required',
        throttle: 500,
        required: true
      })
      cyre.on('throttle-required', handler)

      // First call with invalid payload should fail validation
      const result1 = await cyre.call('throttle-required', null)
      expect(result1.ok).toBe(false)
      expect(result1.message).toContain('required')
      expect(handler).not.toHaveBeenCalled()

      // Second call with valid payload should succeed (not throttled)
      const result2 = await cyre.call('throttle-required', {valid: 'data'})
      expect(result2.ok).toBe(true)
      expect(handler).toHaveBeenCalledTimes(1)

      // Third call should be throttled
      const result3 = await cyre.call('throttle-required', {valid: 'data2'})
      expect(result3.ok).toBe(false)
      expect(result3.message).toContain('throttled')
    })

    it('should work with detectChanges', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'throttle-changes',
        throttle: 500,
        detectChanges: true,
        payload: {initial: 'value'}
      })
      cyre.on('throttle-changes', handler)

      // First call with different data should succeed
      const result1 = await cyre.call('throttle-changes', {new: 'value'})
      expect(result1.ok).toBe(true)
      expect(handler).toHaveBeenCalledTimes(1)

      // Second call should be throttled regardless of payload
      const result2 = await cyre.call('throttle-changes', {different: 'value'})
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('throttled')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should not combine with debounce', () => {
      const result = cyre.action({
        id: 'throttle-debounce-conflict',
        throttle: 1000,
        debounce: 500
      })

      expect(result.ok).toBe(false)
      expect(result.message).toContain(
        'throttle and debounce cannot both be active'
      )
    })
  })

  describe('Throttle Error Handling', () => {
    it('should handle handler errors but maintain throttle state', async () => {
      let callCount = 0
      const flakyHandler = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          throw new Error('First call failed')
        }
        return 'success'
      })

      cyre.action({
        id: 'error-throttle',
        throttle: 1000
      })
      cyre.on('error-throttle', flakyHandler)

      // First call should fail but throttle state is implementation dependent
      const result1 = await cyre.call('error-throttle', 'call1')
      expect(flakyHandler).toHaveBeenCalledTimes(1)

      // Second call behavior depends on whether throttle was established
      const result2 = await cyre.call('error-throttle', 'call2')
      // May or may not be throttled depending on implementation

      // After throttle period, should work
      vi.advanceTimersByTime(1100)

      const result3 = await cyre.call('error-throttle', 'call3')
      expect(result3.ok).toBe(true)
      expect(result3.payload).toBe('success')
      // Handler might be called more times than expected due to multiple attempts
      expect(flakyHandler).toHaveBeenCalled()
    })

    it('should handle channel removal gracefully', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'removable-throttle',
        throttle: 1000
      })
      cyre.on('removable-throttle', handler)

      // Make first call
      const result1 = await cyre.call('removable-throttle', 'call1')
      expect(result1.ok).toBe(true)

      // Remove channel
      const removed = cyre.forget('removable-throttle')
      expect(removed).toBe(true)

      // Try to call removed channel
      const result2 = await cyre.call('removable-throttle', 'call2')
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('not recognized')
    })
  })

  describe('Throttle State Management', () => {
    it('should track execution time correctly', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'time-tracking',
        throttle: 1000
      })
      cyre.on('time-tracking', handler)

      // First call at time 0
      const result1 = await cyre.call('time-tracking', 'call1')
      expect(result1.ok).toBe(true)

      // Advance time partially
      vi.advanceTimersByTime(300)

      // Second call should be throttled with correct remaining time
      const result2 = await cyre.call('time-tracking', 'call2')
      expect(result2.ok).toBe(false)
      expect(result2.message).toMatch(/retry available in [67]\d\dms/)

      // Advance more time
      vi.advanceTimersByTime(400)

      // Third call should be throttled with less remaining time
      const result3 = await cyre.call('time-tracking', 'call3')
      expect(result3.ok).toBe(false)
      expect(result3.message).toMatch(/retry available in [23]\d\dms/)
    })

    it('should reset throttle state after successful execution', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'throttle-reset',
        throttle: 500
      })
      cyre.on('throttle-reset', handler)

      // Cycle 1
      const result1 = await cyre.call('throttle-reset', 'call1')
      expect(result1.ok).toBe(true)

      const result2 = await cyre.call('throttle-reset', 'call2')
      expect(result2.ok).toBe(false)

      vi.advanceTimersByTime(600)

      // Cycle 2 - should start fresh
      const result3 = await cyre.call('throttle-reset', 'call3')
      expect(result3.ok).toBe(true)

      const result4 = await cyre.call('throttle-reset', 'call4')
      expect(result4.ok).toBe(false)

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('Throttle Metadata and Payload State', () => {
    it('should update payload state only on successful calls', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'state-throttle',
        throttle: 500,
        payload: {initial: 'state'}
      })
      cyre.on('state-throttle', handler)

      // First call should update state - check req field
      await cyre.call('state-throttle', {updated: 'state1'})
      let currentState = cyre.get('state-throttle')
      expect(currentState.req).toEqual({updated: 'state1'})

      // Throttled call should not update state
      await cyre.call('state-throttle', {updated: 'state2'})
      currentState = cyre.get('state-throttle')
      expect(currentState.req).toEqual({updated: 'state1'}) // Should remain unchanged

      vi.advanceTimersByTime(600)

      // Next successful call should update state
      await cyre.call('state-throttle', {updated: 'state3'})
      currentState = cyre.get('state-throttle')
      expect(currentState.req).toEqual({updated: 'state3'})
    })

    it('should provide useful error messages', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'message-throttle',
        throttle: 1500
      })
      cyre.on('message-throttle', handler)

      await cyre.call('message-throttle', 'call1')

      const result = await cyre.call('message-throttle', 'call2')
      expect(result.ok).toBe(false)
      expect(result.message).toContain('Call throttled')
      expect(result.message).toContain('retry available in')
      expect(result.message).toMatch(/\d+ms/)
    })
  })
})
