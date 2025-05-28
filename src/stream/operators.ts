// src/stream/operators.ts
// Stream creation and combination operators

import {createStream} from './cyre-stream'
import {log} from '../components/cyre-log'
import type {Stream, StreamCombinators} from '../types/stream'

/*

      C.Y.R.E - S.T.R.E.A.M - O.P.E.R.A.T.O.R.S
      
      Creation and combination operators for streams:
      - Factory functions for creating streams
      - Combination utilities for merging streams
      - Timing utilities with proper cleanup
      - Functional composition patterns

*/

/**
 * Create stream from static values
 */
export const of = <T>(...values: T[]): Stream<T> => {
  const stream = createStream<T>()

  // Emit values asynchronously
  Promise.resolve().then(async () => {
    try {
      for (const value of values) {
        await stream.next(value)
      }
      stream.complete()
    } catch (error) {
      stream.error(error instanceof Error ? error : new Error(String(error)))
    }
  })

  return stream
}

/**
 * Create stream from iterable
 */
export const from = <T>(iterable: Iterable<T>): Stream<T> => {
  const stream = createStream<T>()

  Promise.resolve().then(async () => {
    try {
      for (const value of iterable) {
        await stream.next(value)
      }
      stream.complete()
    } catch (error) {
      stream.error(error instanceof Error ? error : new Error(String(error)))
    }
  })

  return stream
}

/**
 * Create interval stream that emits incrementing numbers
 */
export const interval = (ms: number): Stream<number> => {
  const stream = createStream<number>()
  let counter = 0
  let intervalId: NodeJS.Timeout | null = null

  const startInterval = () => {
    // First emission after initial delay
    intervalId = setTimeout(async () => {
      try {
        if (!stream.closed) {
          await stream.next(counter++)

          // Continue with regular interval
          if (!stream.closed) {
            intervalId = setInterval(async () => {
              try {
                if (stream.closed) {
                  if (intervalId) clearInterval(intervalId)
                  return
                }
                await stream.next(counter++)
              } catch (error) {
                if (intervalId) clearInterval(intervalId)
                stream.error(
                  error instanceof Error ? error : new Error(String(error))
                )
              }
            }, ms)
          }
        }
      } catch (error) {
        stream.error(error instanceof Error ? error : new Error(String(error)))
      }
    }, ms)
  }

  startInterval()

  // Override complete to clean up interval
  const originalComplete = stream.complete
  stream.complete = () => {
    if (intervalId) {
      clearTimeout(intervalId)
      clearInterval(intervalId)
      intervalId = null
    }
    originalComplete.call(stream)
  }

  const originalError = stream.error
  stream.error = (error: Error) => {
    if (intervalId) {
      clearTimeout(intervalId)
      clearInterval(intervalId)
      intervalId = null
    }
    originalError.call(stream, error)
  }

  return stream
}

/**
 * Create timer stream that emits once after delay
 */
export const timer = (delay: number): Stream<void> => {
  const stream = createStream<void>()

  const timeoutId = setTimeout(async () => {
    try {
      await stream.next(undefined) // Explicitly emit undefined, not null
      stream.complete()
    } catch (error) {
      stream.error(error instanceof Error ? error : new Error(String(error)))
    }
  }, delay)

  // Override complete to clean up timeout
  const originalComplete = stream.complete
  stream.complete = () => {
    clearTimeout(timeoutId)
    originalComplete.call(stream)
  }

  const originalError = stream.error
  stream.error = (error: Error) => {
    clearTimeout(timeoutId)
    originalError.call(stream, error)
  }

  return stream
}

/**
 * Create empty stream that completes immediately
 */
export const empty = <T>(): Stream<T> => {
  const stream = createStream<T>()
  Promise.resolve().then(() => stream.complete())
  return stream
}

/**
 * Create stream that never emits
 */
export const never = <T>(): Stream<T> => {
  return createStream<T>()
}

/**
 * Create stream that errors immediately
 */
export const throwError = <T>(error: Error): Stream<T> => {
  const stream = createStream<T>()
  Promise.resolve().then(() => stream.error(error))
  return stream
}

/**
 * Merge multiple streams into one
 */
export const merge = <T>(...streams: Stream<T>[]): Stream<T> => {
  if (streams.length === 0) {
    return empty<T>()
  }

  if (streams.length === 1) {
    return streams[0]
  }

  const mergedId = `merge-${crypto.randomUUID().slice(0, 8)}`
  const merged = createStream<T>({id: mergedId})

  let completedCount = 0
  const subscriptions = streams.map(stream =>
    stream.subscribe({
      next: value => merged.next(value),
      error: error => merged.error(error),
      complete: () => {
        completedCount++
        if (completedCount === streams.length) {
          merged.complete()
        }
      }
    })
  )

  // Override cleanup to unsubscribe from all sources
  const originalComplete = merged.complete
  merged.complete = () => {
    subscriptions.forEach(sub => sub.unsubscribe())
    originalComplete.call(merged)
  }

  const originalError = merged.error
  merged.error = (error: Error) => {
    subscriptions.forEach(sub => sub.unsubscribe())
    originalError.call(merged, error)
  }

  return merged
}

/**
 * Zip multiple streams together
 */
export const zip = <T extends readonly unknown[]>(
  ...streams: {[K in keyof T]: Stream<T[K]>}
): Stream<T> => {
  if (streams.length === 0) {
    return empty<T>()
  }

  const zipId = `zip-${crypto.randomUUID().slice(0, 8)}`
  const zipped = createStream<T>({id: zipId})

  // Buffers for each stream
  const buffers: Array<Array<any>> = streams.map(() => [])
  let completedStreams = 0

  const tryEmit = async () => {
    // Check if all buffers have values
    if (buffers.every(buffer => buffer.length > 0)) {
      const values = buffers.map(buffer => buffer.shift()) as T
      await zipped.next(values)
    }
  }

  const subscriptions = streams.map((stream, index) =>
    stream.subscribe({
      next: value => {
        buffers[index].push(value)
        tryEmit()
      },
      error: error => zipped.error(error),
      complete: () => {
        completedStreams++
        if (completedStreams === streams.length) {
          zipped.complete()
        }
      }
    })
  )

  // Override cleanup
  const originalComplete = zipped.complete
  zipped.complete = () => {
    subscriptions.forEach(sub => sub.unsubscribe())
    originalComplete.call(zipped)
  }

  const originalError = zipped.error
  zipped.error = (error: Error) => {
    subscriptions.forEach(sub => sub.unsubscribe())
    originalError.call(zipped, error)
  }

  return zipped
}

/**
 * Combine latest values from multiple streams
 */
export const combineLatest = <T extends readonly unknown[]>(
  ...streams: {[K in keyof T]: Stream<T[K]>}
): Stream<T> => {
  if (streams.length === 0) {
    return empty<T>()
  }

  const combineId = `combine-${crypto.randomUUID().slice(0, 8)}`
  const combined = createStream<T>({id: combineId})

  // Latest values from each stream
  const latestValues: Array<any> = new Array(streams.length)
  const hasValue: boolean[] = new Array(streams.length).fill(false)
  let completedStreams = 0

  const tryEmit = async () => {
    // Check if all streams have emitted at least once
    if (hasValue.every(Boolean)) {
      await combined.next([...latestValues] as T)
    }
  }

  const subscriptions = streams.map((stream, index) =>
    stream.subscribe({
      next: value => {
        latestValues[index] = value
        hasValue[index] = true
        tryEmit()
      },
      error: error => combined.error(error),
      complete: () => {
        completedStreams++
        if (completedStreams === streams.length) {
          combined.complete()
        }
      }
    })
  )

  // Override cleanup
  const originalComplete = combined.complete
  combined.complete = () => {
    subscriptions.forEach(sub => sub.unsubscribe())
    originalComplete.call(combined)
  }

  const originalError = combined.error
  combined.error = (error: Error) => {
    subscriptions.forEach(sub => sub.unsubscribe())
    originalError.call(combined, error)
  }

  return combined
}

/**
 * Start stream with initial values
 */
export const startWith = <T>(stream: Stream<T>, ...values: T[]): Stream<T> => {
  const startWithId = `start-with-${crypto.randomUUID().slice(0, 8)}`
  const startWithStream = createStream<T>({id: startWithId})

  // Emit initial values then subscribe to source
  Promise.resolve().then(async () => {
    try {
      // Emit initial values
      for (const value of values) {
        await startWithStream.next(value)
      }

      // Then subscribe to source stream
      const subscription = stream.subscribe({
        next: value => startWithStream.next(value),
        error: error => startWithStream.error(error),
        complete: () => startWithStream.complete()
      })

      // Override cleanup
      const originalComplete = startWithStream.complete
      startWithStream.complete = () => {
        subscription.unsubscribe()
        originalComplete.call(startWithStream)
      }

      const originalError = startWithStream.error
      startWithStream.error = (error: Error) => {
        subscription.unsubscribe()
        originalError.call(startWithStream, error)
      }
    } catch (error) {
      startWithStream.error(
        error instanceof Error ? error : new Error(String(error))
      )
    }
  })

  return startWithStream
}

/**
 * Pipe operator for functional composition
 */
export const pipe =
  <T>(...operators: Array<(source: Stream<any>) => Stream<any>>) =>
  (source: Stream<T>) =>
    operators.reduce((stream, operator) => operator(stream), source)

/**
 * Race multiple streams - emit from first to emit
 */
export const race = <T>(...streams: Stream<T>[]): Stream<T> => {
  if (streams.length === 0) {
    return empty<T>()
  }

  if (streams.length === 1) {
    return streams[0]
  }

  const raceId = `race-${crypto.randomUUID().slice(0, 8)}`
  const raced = createStream<T>({id: raceId})

  let hasWinner = false
  const subscriptions: Array<{unsubscribe(): void}> = []

  streams.forEach(stream => {
    const subscription = stream.subscribe({
      next: value => {
        if (!hasWinner) {
          hasWinner = true
          // Unsubscribe from all other streams
          subscriptions.forEach(sub => sub.unsubscribe())
          // Forward all values from winner
          stream.subscribe({
            next: v => raced.next(v),
            error: e => raced.error(e),
            complete: () => raced.complete()
          })
          // Emit the winning value
          raced.next(value)
        }
      },
      error: error => {
        if (!hasWinner) {
          raced.error(error)
        }
      },
      complete: () => {
        if (!hasWinner) {
          const allCompleted = streams.every(s => s.closed)
          if (allCompleted) {
            raced.complete()
          }
        }
      }
    })
    subscriptions.push(subscription)
  })

  return raced
}

// Export combinators object
export const combinators: StreamCombinators = {
  merge,
  zip,
  combineLatest
}
