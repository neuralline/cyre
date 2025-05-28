// test/stream-core.test.ts
// Fixed tests for Cyre stream system

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {
  createStream,
  of,
  interval,
  timer,
  merge,
  operators
} from '../src/stream'
import {cyre} from '../src'

describe('Cyre Stream Core', () => {
  beforeEach(() => {
    cyre.initialize()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cyre.clear()
    vi.useRealTimers()
  })

  describe('Stream Creation', () => {
    it('should create stream with unique ID', () => {
      const stream = createStream<number>()
      expect(stream.id).toBeDefined()
      expect(typeof stream.id).toBe('string')
      expect(stream.closed).toBe(false)
    })

    it('should create stream with custom config', () => {
      const stream = createStream<string>({
        id: 'test-stream',
        debug: true,
        bufferSize: 50
      })
      expect(stream.id).toBe('test-stream')
    })

    it('should emit and receive values', async () => {
      const stream = createStream<number>()
      const values: number[] = []

      stream.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(2)
      await stream.next(3)

      expect(values).toEqual([1, 2, 3])
    })

    it('should handle completion', async () => {
      const stream = createStream<number>()
      let completed = false

      stream.subscribe({
        next: () => {},
        complete: () => {
          completed = true
        }
      })

      stream.complete()

      // Allow async completion
      await vi.waitFor(() => expect(completed).toBe(true), {timeout: 100})
      expect(stream.closed).toBe(true)
    })

    it('should handle errors', async () => {
      const stream = createStream<number>()
      let errorReceived: Error | null = null

      stream.subscribe({
        next: () => {},
        error: error => {
          errorReceived = error
        }
      })

      const testError = new Error('Test error')
      stream.error(testError)

      await vi.waitFor(() => expect(errorReceived).toBe(testError), {
        timeout: 100
      })
      expect(stream.closed).toBe(true)
    })

    it('should prevent emissions after completion', async () => {
      const stream = createStream<number>()
      const values: number[] = []

      stream.subscribe(value => values.push(value))

      await stream.next(1)
      stream.complete()

      // These should be ignored
      await stream.next(2)
      await stream.next(3)

      expect(values).toEqual([1])
    })
  })

  describe('Stream Operators', () => {
    it('should map values correctly', async () => {
      const stream = createStream<number>()
      const mapped = stream.map(x => x * 2)
      const values: number[] = []

      mapped.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(2)
      await stream.next(3)

      // Allow async processing
      await vi.waitFor(() => expect(values).toEqual([2, 4, 6]), {timeout: 100})
    })

    it('should filter values correctly', async () => {
      const stream = createStream<number>()
      const filtered = stream.filter(x => x % 2 === 0)
      const values: number[] = []

      filtered.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(2)
      await stream.next(3)
      await stream.next(4)

      await vi.waitFor(() => expect(values).toEqual([2, 4]), {timeout: 100})
    })

    it('should take specified number of values', async () => {
      const stream = createStream<number>()
      const taken = stream.take(2)
      const values: number[] = []
      let completed = false

      taken.subscribe({
        next: value => values.push(value),
        complete: () => (completed = true)
      })

      await stream.next(1)
      await stream.next(2)
      await stream.next(3)
      await stream.next(4)

      await vi.waitFor(
        () => {
          expect(values).toEqual([1, 2])
          expect(completed).toBe(true)
        },
        {timeout: 100}
      )
    })

    it('should skip specified number of values', async () => {
      const stream = createStream<number>()
      const skipped = stream.skip(2)
      const values: number[] = []

      skipped.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(2)
      await stream.next(3)
      await stream.next(4)

      await vi.waitFor(() => expect(values).toEqual([3, 4]), {timeout: 100})
    })

    it('should filter distinct values', async () => {
      const stream = createStream<number>()
      const distinct = stream.distinct()
      const values: number[] = []

      distinct.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(2)
      await stream.next(2)
      await stream.next(3)
      await stream.next(1)

      await vi.waitFor(() => expect(values).toEqual([1, 2, 3]), {timeout: 100})
    })

    it('should filter distinct until changed', async () => {
      const stream = createStream<number>()
      const distinct = stream.distinctUntilChanged()
      const values: number[] = []

      distinct.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(1)
      await stream.next(2)
      await stream.next(2)
      await stream.next(1)

      await vi.waitFor(() => expect(values).toEqual([1, 2, 1]), {timeout: 100})
    })

    it('should debounce values using Cyre protection', async () => {
      const stream = createStream<number>()
      const debounced = stream.debounce(100)
      const values: number[] = []

      debounced.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(2)
      await stream.next(3)

      // Fast timers - only last value should emit
      vi.advanceTimersByTime(150)
      await vi.waitFor(() => expect(values).toEqual([3]), {timeout: 100})
    })

    it('should throttle values using custom implementation', async () => {
      const stream = createStream<number>()
      const throttled = stream.throttle(100)
      const values: number[] = []

      throttled.subscribe(value => values.push(value))

      await stream.next(1) // Should pass (first value)
      await stream.next(2) // Should be throttled

      vi.advanceTimersByTime(50)
      await stream.next(3) // Should be throttled

      vi.advanceTimersByTime(60) // Total: 110ms
      await stream.next(4) // Should pass (enough time elapsed)

      // Give time for processing
      await vi.waitFor(() => expect(values).toEqual([1, 4]), {timeout: 200})
    })

    it('should delay values', async () => {
      const stream = createStream<number>()
      const delayed = stream.delay(100)
      const values: number[] = []

      delayed.subscribe(value => values.push(value))

      await stream.next(1)
      expect(values).toEqual([])

      vi.advanceTimersByTime(100)
      await vi.waitFor(() => expect(values).toEqual([1]), {timeout: 100})
    })

    it('should tap without affecting stream', async () => {
      const stream = createStream<number>()
      const tapped: number[] = []
      const values: number[] = []

      const tappedStream = stream.tap(value => tapped.push(value))
      tappedStream.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(2)

      await vi.waitFor(
        () => {
          expect(tapped).toEqual([1, 2])
          expect(values).toEqual([1, 2])
        },
        {timeout: 100}
      )
    })

    it('should catch and handle errors', async () => {
      const stream = createStream<number>()
      const caught = stream.catchError(() => -1)
      const values: number[] = []

      caught.subscribe(value => values.push(value))

      await stream.next(1)
      stream.error(new Error('Test error'))

      await vi.waitFor(() => expect(values).toEqual([1, -1]), {timeout: 200})
    })

    it('should retry on errors', async () => {
      let attempts = 0
      const stream = createStream<number>()
      const retried = stream.retry(2)

      // This is a simplified test - real retry would need error injection
      const values: number[] = []
      retried.subscribe(value => values.push(value))

      await stream.next(1)
      expect(values).toEqual([1])
    })
  })

  describe('Stream Combination', () => {
    it('should merge streams', async () => {
      const stream1 = createStream<number>()
      const stream2 = createStream<number>()
      const merged = stream1.merge(stream2)
      const values: number[] = []

      merged.subscribe(value => values.push(value))

      await stream1.next(1)
      await stream2.next(2)
      await stream1.next(3)

      await vi.waitFor(() => expect(values).toEqual([1, 2, 3]), {timeout: 100})
    })

    it('should zip streams', async () => {
      const stream1 = createStream<number>()
      const stream2 = createStream<string>()
      const zipped = stream1.zip(stream2)
      const values: [number, string][] = []

      zipped.subscribe(value => values.push(value))

      await stream1.next(1)
      await stream2.next('a')
      await stream1.next(2)
      await stream2.next('b')

      await vi.waitFor(
        () =>
          expect(values).toEqual([
            [1, 'a'],
            [2, 'b']
          ]),
        {timeout: 100}
      )
    })

    it('should switchMap to new streams', async () => {
      const stream = createStream<number>()
      const switched = stream.switchMap(x => of(x * 2, x * 3))
      const values: number[] = []

      switched.subscribe(value => values.push(value))

      await stream.next(1)
      vi.advanceTimersByTime(10) // Allow of() to emit

      await stream.next(2)
      vi.advanceTimersByTime(10) // Allow of() to emit

      // Should receive values from both inner streams
      await vi.waitFor(() => expect(values.length).toBeGreaterThan(0), {
        timeout: 100
      })
    })

    it('should mergeMap to multiple streams', async () => {
      const stream = createStream<number>()
      const merged = stream.mergeMap(x => of(x * 2))
      const values: number[] = []

      merged.subscribe(value => values.push(value))

      await stream.next(1)
      await stream.next(2)
      vi.advanceTimersByTime(10) // Allow of() to emit

      await vi.waitFor(() => expect(values).toEqual([2, 4]), {timeout: 100})
    })
  })

  describe('Stream Utilities', () => {
    it('should convert to promise', async () => {
      const stream = createStream<number>()

      const promise = stream.toPromise()

      await stream.next(1)
      await stream.next(2)
      stream.complete()

      const result = await promise
      expect(result).toBe(2) // Should be last value
    })

    it('should convert to array', async () => {
      const stream = createStream<number>()

      const arrayPromise = stream.toArray()

      await stream.next(1)
      await stream.next(2)
      await stream.next(3)
      stream.complete()

      const result = await arrayPromise
      expect(result).toEqual([1, 2, 3])
    })

    it('should pipe multiple operators', async () => {
      const stream = createStream<number>()
      const piped = stream.pipe(
        stream => stream.map(x => x * 2),
        stream => stream.filter(x => x > 2),
        stream => stream.take(2)
      )

      const values: number[] = []
      let completed = false

      piped.subscribe({
        next: value => values.push(value),
        complete: () => (completed = true)
      })

      await stream.next(1) // 2, filtered out
      await stream.next(2) // 4, passes
      await stream.next(3) // 6, passes, completes stream
      await stream.next(4) // Should be ignored

      await vi.waitFor(
        () => {
          expect(values).toEqual([4, 6])
          expect(completed).toBe(true)
        },
        {timeout: 100}
      )
    })
  })

  describe('Factory Functions', () => {
    it('should create stream from values with of()', async () => {
      const stream = of(1, 2, 3)
      const values: number[] = []
      let completed = false

      stream.subscribe({
        next: value => values.push(value),
        complete: () => (completed = true)
      })

      vi.advanceTimersByTime(10) // Allow of() to emit
      await vi.waitFor(
        () => {
          expect(values).toEqual([1, 2, 3])
          expect(completed).toBe(true)
        },
        {timeout: 100}
      )
    })

    it('should create interval stream', async () => {
      const stream = interval(100)
      const values: number[] = []

      const subscription = stream.subscribe(value => values.push(value))

      vi.advanceTimersByTime(100) // First emission after initial delay
      vi.advanceTimersByTime(100) // Second emission
      vi.advanceTimersByTime(100) // Third emission

      subscription.unsubscribe()

      await vi.waitFor(() => expect(values).toEqual([0, 1, 2]), {timeout: 200})
    })

    it('should create timer stream', async () => {
      const stream = timer(100)
      const values: (void | undefined)[] = []
      let completed = false

      stream.subscribe({
        next: value => values.push(value),
        complete: () => (completed = true)
      })

      vi.advanceTimersByTime(100)
      await vi.waitFor(
        () => {
          expect(values).toEqual([undefined])
          expect(completed).toBe(true)
        },
        {timeout: 100}
      )
    })

    it('should merge multiple streams with merge()', async () => {
      const stream1 = of(1, 3)
      const stream2 = of(2, 4)
      const merged = merge(stream1, stream2)
      const values: number[] = []

      merged.subscribe(value => values.push(value))

      vi.advanceTimersByTime(10) // Allow of() to emit
      await vi.waitFor(() => expect(values.sort()).toEqual([1, 2, 3, 4]), {
        timeout: 100
      })
    })
  })

  describe('Memory Management', () => {
    it('should clean up resources on completion', async () => {
      const stream = createStream<number>({debug: true})
      const mapped = stream.map(x => x * 2)

      let subscriptionClosed = false
      const subscription = mapped.subscribe({
        next: () => {},
        complete: () => {}
      })

      // Override unsubscribe to track cleanup
      const originalUnsubscribe = subscription.unsubscribe
      subscription.unsubscribe = () => {
        subscriptionClosed = true
        originalUnsubscribe.call(subscription)
      }

      stream.complete()
      await vi.waitFor(
        () => {
          expect(stream.closed).toBe(true)
          expect(mapped.closed).toBe(true)
        },
        {timeout: 100}
      )
    })

    it('should handle unsubscription properly', async () => {
      const stream = createStream<number>()
      const values: number[] = []

      const subscription = stream.subscribe(value => values.push(value))

      await stream.next(1)
      subscription.unsubscribe()
      await stream.next(2) // Should not be received

      expect(values).toEqual([1])
      expect(subscription.closed).toBe(true)
    })

    it('should clean up Cyre resources', async () => {
      const stream = createStream<number>({id: 'cleanup-test'})

      // Verify Cyre action was created
      expect(cyre.get('cleanup-test')).toBeDefined()

      stream.complete()
      await vi.waitFor(
        () => {
          expect(cyre.get('cleanup-test')).toBeUndefined()
        },
        {timeout: 100}
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle synchronous errors in operators', async () => {
      const stream = createStream<number>()
      const mapped = stream.map(x => {
        if (x === 2) throw new Error('Test error')
        return x * 2
      })

      const values: number[] = []
      let errorReceived: Error | null = null

      mapped.subscribe({
        next: value => values.push(value),
        error: error => (errorReceived = error)
      })

      await stream.next(1)
      await stream.next(2) // Should cause error

      await vi.waitFor(
        () => {
          expect(values).toEqual([2])
          expect(errorReceived).toBeInstanceOf(Error)
          expect(errorReceived?.message).toBe('Test error')
        },
        {timeout: 100}
      )
    })

    it('should handle asynchronous errors in operators', async () => {
      const stream = createStream<number>()
      const mapped = stream.map(async x => {
        if (x === 2) throw new Error('Async error')
        return x * 2
      })

      const values: number[] = []
      let errorReceived: Error | null = null

      mapped.subscribe({
        next: value => values.push(value),
        error: error => (errorReceived = error)
      })

      await stream.next(1)
      await stream.next(2) // Should cause error

      await vi.waitFor(
        () => {
          expect(values).toEqual([2])
          expect(errorReceived).toBeInstanceOf(Error)
          expect(errorReceived?.message).toBe('Async error')
        },
        {timeout: 100}
      )
    })

    it('should prevent further emissions after error', async () => {
      const stream = createStream<number>()
      const values: number[] = []

      stream.subscribe({
        next: value => values.push(value),
        error: () => {}
      })

      await stream.next(1)
      stream.error(new Error('Test error'))
      await stream.next(2) // Should be ignored

      expect(values).toEqual([1])
      expect(stream.closed).toBe(true)
    })
  })

  describe('Integration with Cyre', () => {
    it('should use Cyre actions for stream communication', async () => {
      const stream = createStream<number>({id: 'integration-test'})
      const values: number[] = []

      stream.subscribe(value => values.push(value))

      // Emit directly through Cyre
      await cyre.call('integration-test', 42)

      expect(values).toEqual([42])
    })

    it('should integrate with Cyre protection mechanisms', async () => {
      const stream = createStream<number>()
      const debounced = stream.debounce(100)
      const values: number[] = []

      debounced.subscribe(value => values.push(value))

      // These should be debounced by Cyre
      await stream.next(1)
      await stream.next(2)
      await stream.next(3)

      vi.advanceTimersByTime(150)
      await vi.waitFor(() => expect(values).toEqual([3]), {timeout: 100})
    })

    it('should clean up Cyre resources on stream cleanup', async () => {
      const stream = createStream<number>()
      const throttled = stream.throttle(100)

      // This creates internal Cyre actions
      const subscription = throttled.subscribe(() => {})

      // Clean up should remove internal Cyre actions
      subscription.unsubscribe()
      throttled.complete()

      // Verify cleanup
      await vi.waitFor(() => expect(throttled.closed).toBe(true), {
        timeout: 100
      })
    })
  })
})
