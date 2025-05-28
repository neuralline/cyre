// src/stream/utils.ts
// Stream utility functions and helpers

import {createStream} from './cyre-stream'
import type {Stream, StreamOperator} from '../types/stream'

/*

      C.Y.R.E - S.T.R.E.A.M - U.T.I.L.S
      
      Utility functions for stream operations:
      - Advanced operators and transformations
      - Performance optimizations
      - Common stream patterns
      - Debugging utilities

*/

/**
 * Buffer stream values until count reached or time elapsed
 */
export const buffer =
  <T>(countOrTime: number, isTime: boolean = false): StreamOperator<T, T[]> =>
  source => {
    const buffered = createStream<T[]>()
    let buffer: T[] = []
    let timeoutId: NodeJS.Timeout | null = null

    const flush = async () => {
      if (buffer.length > 0) {
        const currentBuffer = [...buffer]
        buffer = []
        await buffered.next(currentBuffer)
      }
    }

    const subscription = source.subscribe({
      next: value => {
        buffer.push(value)

        if (isTime) {
          // Time-based buffering
          if (timeoutId === null) {
            timeoutId = setTimeout(() => {
              flush()
              timeoutId = null
            }, countOrTime)
          }
        } else {
          // Count-based buffering
          if (buffer.length >= countOrTime) {
            flush()
          }
        }
      },
      error: error => {
        if (timeoutId) clearTimeout(timeoutId)
        buffered.error(error)
      },
      complete: () => {
        if (timeoutId) clearTimeout(timeoutId)
        flush().then(() => buffered.complete())
      }
    })

    // Override cleanup
    const originalComplete = buffered.complete
    buffered.complete = () => {
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
      originalComplete.call(buffered)
    }

    return buffered
  }

/**
 * Buffer by count
 */
export const bufferCount = <T>(count: number): StreamOperator<T, T[]> =>
  buffer(count, false)

/**
 * Buffer by time
 */
export const bufferTime = <T>(ms: number): StreamOperator<T, T[]> =>
  buffer(ms, true)

/**
 * Sample stream at intervals
 */
export const sample =
  <T>(intervalMs: number): StreamOperator<T, T> =>
  source => {
    const sampled = createStream<T>()
    let lastValue: T | undefined
    let hasValue = false

    const subscription = source.subscribe({
      next: value => {
        lastValue = value
        hasValue = true
      },
      error: error => sampled.error(error),
      complete: () => sampled.complete()
    })

    const intervalId = setInterval(() => {
      if (hasValue && lastValue !== undefined) {
        sampled.next(lastValue)
        hasValue = false
      }
    }, intervalMs)

    // Override cleanup
    const originalComplete = sampled.complete
    sampled.complete = () => {
      clearInterval(intervalId)
      subscription.unsubscribe()
      originalComplete.call(sampled)
    }

    const originalError = sampled.error
    sampled.error = (error: Error) => {
      clearInterval(intervalId)
      subscription.unsubscribe()
      originalError.call(sampled, error)
    }

    return sampled
  }

/**
 * Audit stream emissions - emit after silence period
 */
export const audit =
  <T>(silenceMs: number): StreamOperator<T, T> =>
  source => {
    const audited = createStream<T>()
    let lastValue: T | undefined
    let timeoutId: NodeJS.Timeout | null = null

    const subscription = source.subscribe({
      next: value => {
        lastValue = value

        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        timeoutId = setTimeout(() => {
          if (lastValue !== undefined) {
            audited.next(lastValue)
          }
          timeoutId = null
        }, silenceMs)
      },
      error: error => {
        if (timeoutId) clearTimeout(timeoutId)
        audited.error(error)
      },
      complete: () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          if (lastValue !== undefined) {
            audited.next(lastValue)
          }
        }
        audited.complete()
      }
    })

    // Override cleanup
    const originalComplete = audited.complete
    audited.complete = () => {
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
      originalComplete.call(audited)
    }

    return audited
  }

/**
 * Scan (reduce) stream values over time
 */
export const scan =
  <T, R>(
    accumulator: (acc: R, value: T, index: number) => R,
    seed: R
  ): StreamOperator<T, R> =>
  source => {
    const scanned = createStream<R>()
    let acc = seed
    let index = 0

    const subscription = source.subscribe({
      next: async value => {
        try {
          acc = accumulator(acc, value, index++)
          await scanned.next(acc)
        } catch (error) {
          scanned.error(
            error instanceof Error ? error : new Error(String(error))
          )
        }
      },
      error: error => scanned.error(error),
      complete: () => scanned.complete()
    })

    // Override cleanup
    const originalComplete = scanned.complete
    scanned.complete = () => {
      subscription.unsubscribe()
      originalComplete.call(scanned)
    }

    return scanned
  }

/**
 * Reduce stream to single value
 */
export const reduce =
  <T, R>(
    accumulator: (acc: R, value: T, index: number) => R,
    seed: R
  ): StreamOperator<T, R> =>
  source => {
    const reduced = createStream<R>()
    let acc = seed
    let index = 0

    const subscription = source.subscribe({
      next: value => {
        try {
          acc = accumulator(acc, value, index++)
        } catch (error) {
          reduced.error(
            error instanceof Error ? error : new Error(String(error))
          )
        }
      },
      error: error => reduced.error(error),
      complete: async () => {
        await reduced.next(acc)
        reduced.complete()
      }
    })

    return reduced
  }

/**
 * Take values until condition is met
 */
export const takeUntil =
  <T>(predicate: (value: T) => boolean): StreamOperator<T, T> =>
  source => {
    const taken = createStream<T>()

    const subscription = source.subscribe({
      next: async value => {
        try {
          if (!predicate(value)) {
            await taken.next(value)
          } else {
            taken.complete()
          }
        } catch (error) {
          taken.error(error instanceof Error ? error : new Error(String(error)))
        }
      },
      error: error => taken.error(error),
      complete: () => taken.complete()
    })

    return taken
  }

/**
 * Take values while condition is true
 */
export const takeWhile =
  <T>(predicate: (value: T) => boolean): StreamOperator<T, T> =>
  source => {
    const taken = createStream<T>()

    const subscription = source.subscribe({
      next: async value => {
        try {
          if (predicate(value)) {
            await taken.next(value)
          } else {
            taken.complete()
          }
        } catch (error) {
          taken.error(error instanceof Error ? error : new Error(String(error)))
        }
      },
      error: error => taken.error(error),
      complete: () => taken.complete()
    })

    return taken
  }

/**
 * Skip values until condition is met
 */
export const skipUntil =
  <T>(predicate: (value: T) => boolean): StreamOperator<T, T> =>
  source => {
    const skipped = createStream<T>()
    let shouldSkip = true

    const subscription = source.subscribe({
      next: async value => {
        try {
          if (shouldSkip) {
            if (predicate(value)) {
              shouldSkip = false
            }
          } else {
            await skipped.next(value)
          }
        } catch (error) {
          skipped.error(
            error instanceof Error ? error : new Error(String(error))
          )
        }
      },
      error: error => skipped.error(error),
      complete: () => skipped.complete()
    })

    return skipped
  }

/**
 * Skip values while condition is true
 */
export const skipWhile =
  <T>(predicate: (value: T) => boolean): StreamOperator<T, T> =>
  source => {
    const skipped = createStream<T>()
    let shouldSkip = true

    const subscription = source.subscribe({
      next: async value => {
        try {
          if (shouldSkip) {
            if (!predicate(value)) {
              shouldSkip = false
              await skipped.next(value)
            }
          } else {
            await skipped.next(value)
          }
        } catch (error) {
          skipped.error(
            error instanceof Error ? error : new Error(String(error))
          )
        }
      },
      error: error => skipped.error(error),
      complete: () => skipped.complete()
    })

    return skipped
  }

/**
 * Share stream among multiple subscribers
 */
export const share =
  <T>(): StreamOperator<T, T> =>
  source => {
    const shared = createStream<T>()
    let subscription: {unsubscribe(): void} | null = null
    let refCount = 0

    const originalSubscribe = shared.subscribe.bind(shared)

    shared.subscribe = observer => {
      refCount++

      // Start source subscription on first subscriber
      if (refCount === 1 && !subscription) {
        subscription = source.subscribe({
          next: value => shared.next(value),
          error: error => shared.error(error),
          complete: () => shared.complete()
        })
      }

      const sub = originalSubscribe(observer)

      // Override unsubscribe to handle ref counting
      const originalUnsubscribe = sub.unsubscribe
      sub.unsubscribe = () => {
        originalUnsubscribe.call(sub)
        refCount--

        // Clean up source subscription when no subscribers
        if (refCount === 0 && subscription) {
          subscription.unsubscribe()
          subscription = null
        }
      }

      return sub
    }

    return shared
  }

/**
 * Debug stream emissions
 */
export const debug =
  <T>(label?: string): StreamOperator<T, T> =>
  source => {
    const debugged = createStream<T>()
    const streamLabel = label || `stream-${source.id}`

    const subscription = source.subscribe({
      next: async value => {
        console.log(`[${streamLabel}] Next:`, value)
        await debugged.next(value)
      },
      error: error => {
        console.log(`[${streamLabel}] Error:`, error)
        debugged.error(error)
      },
      complete: () => {
        console.log(`[${streamLabel}] Complete`)
        debugged.complete()
      }
    })

    return debugged
  }

/**
 * Log stream emissions using Cyre logger
 */
export const log =
  <T>(label?: string): StreamOperator<T, T> =>
  source => {
    const logged = createStream<T>()
    const streamLabel = label || `stream-${source.id}`

    const subscription = source.subscribe({
      next: async value => {
        await logged.next(value)
      },
      error: error => {
        logged.error(error)
      },
      complete: () => {
        logged.complete()
      }
    })

    return logged
  }

/**
 * Transform stream using multiple operators
 */
export const transform =
  <T, R>(...operators: StreamOperator<any, any>[]): StreamOperator<T, R> =>
  source =>
    operators.reduce(
      (stream, operator) => operator(stream),
      source
    ) as Stream<R>

/**
 * Compose multiple operators into one
 */
export const compose = <T, R>(
  ...operators: StreamOperator<any, any>[]
): StreamOperator<T, R> => transform(...operators)
