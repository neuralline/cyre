// src/stream/operators.ts
// IMMEDIATE FIXES for failing tests - replace current operators.ts

import {createStream} from './cyre-stream'
import type {Stream} from '../types/stream'

/*

      C.Y.R.E - S.T.R.E.A.M - O.P.E.R.A.T.O.R.S
      
      IMMEDIATE FIXES for test failures:
      1. Fix interval() to start with 0 (not null)
      2. Fix timer() to emit undefined (not null)  
      3. Fix proper async handling
      4. Fix stream completion logic

*/

/**
 * FIXED: Create stream from static values
 */
export const of = <T>(...values: T[]): Stream<T> => {
  const stream = createStream<T>()

  // Use setTimeout to ensure async emission
  setTimeout(async () => {
    try {
      for (const value of values) {
        if (stream.closed) break
        await stream.next(value)
      }
      if (!stream.closed) {
        stream.complete()
      }
    } catch (error) {
      if (!stream.closed) {
        stream.error(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }, 0)

  return stream
}

/**
 * FIXED: Create interval stream starting with 0
 */
export const interval = (ms: number): Stream<number> => {
  const stream = createStream<number>()
  let counter = 0
  let intervalId: NodeJS.Timeout | null = null

  // CRITICAL FIX: Start with 0, then increment
  const emit = async () => {
    if (stream.closed) {
      if (intervalId) clearInterval(intervalId)
      return
    }

    try {
      await stream.next(counter) // Emit current counter
      counter++ // Then increment for next time
    } catch (error) {
      if (intervalId) clearInterval(intervalId)
      if (!stream.closed) {
        stream.error(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  // Start immediately with first emission (0)
  emit().then(() => {
    if (!stream.closed) {
      intervalId = setInterval(emit, ms)
    }
  })

  // Proper cleanup
  const originalComplete = stream.complete
  stream.complete = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    originalComplete.call(stream)
  }

  const originalError = stream.error
  stream.error = (error: Error) => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    originalError.call(stream, error)
  }

  return stream
}

/**
 * FIXED: Create timer stream that emits undefined (void)
 */
export const timer = (delay: number): Stream<void> => {
  const stream = createStream<void>()

  const timeoutId = setTimeout(async () => {
    if (stream.closed) return

    try {
      // CRITICAL FIX: Emit undefined (void 0), not null
      await stream.next(undefined)
      if (!stream.closed) {
        stream.complete()
      }
    } catch (error) {
      if (!stream.closed) {
        stream.error(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }, delay)

  // Proper cleanup
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
 * Create empty stream
 */
export const empty = <T>(): Stream<T> => {
  const stream = createStream<T>()
  setTimeout(() => {
    if (!stream.closed) {
      stream.complete()
    }
  }, 0)
  return stream
}

/**
 * Create stream that never emits
 */
export const never = <T>(): Stream<T> => {
  return createStream<T>()
}

/**
 * Create error stream
 */
export const throwError = <T>(error: Error): Stream<T> => {
  const stream = createStream<T>()
  setTimeout(() => {
    if (!stream.closed) {
      stream.error(error)
    }
  }, 0)
  return stream
}

/**
 * Merge multiple streams
 */
export const merge = <T>(...streams: Stream<T>[]): Stream<T> => {
  if (streams.length === 0) return empty<T>()
  if (streams.length === 1) return streams[0]

  const merged = createStream<T>()
  let completedCount = 0
  const subscriptions = streams.map(stream =>
    stream.subscribe({
      next: value => {
        if (!merged.closed) {
          merged.next(value)
        }
      },
      error: error => {
        if (!merged.closed) {
          merged.error(error)
        }
      },
      complete: () => {
        completedCount++
        if (completedCount === streams.length && !merged.closed) {
          merged.complete()
        }
      }
    })
  )

  return merged
}

/**
 * Zip streams together
 */
export const zip = <T extends readonly unknown[]>(
  ...streams: {[K in keyof T]: Stream<T[K]>}
): Stream<T> => {
  if (streams.length === 0) return empty<T>()

  const zipped = createStream<T>()
  const buffers: Array<Array<any>> = streams.map(() => [])
  let completedStreams = 0

  const tryEmit = async () => {
    if (buffers.every(buffer => buffer.length > 0)) {
      const values = buffers.map(buffer => buffer.shift()) as T
      if (!zipped.closed) {
        await zipped.next(values)
      }
    }
  }

  streams.forEach((stream, index) =>
    stream.subscribe({
      next: value => {
        buffers[index].push(value)
        tryEmit()
      },
      error: error => {
        if (!zipped.closed) {
          zipped.error(error)
        }
      },
      complete: () => {
        completedStreams++
        if (completedStreams === streams.length && !zipped.closed) {
          zipped.complete()
        }
      }
    })
  )

  return zipped
}

/**
 * Combine latest values
 */
export const combineLatest = <T extends readonly unknown[]>(
  ...streams: {[K in keyof T]: Stream<T[K]>}
): Stream<T> => {
  if (streams.length === 0) return empty<T>()

  const combined = createStream<T>()
  const latestValues: Array<any> = new Array(streams.length)
  const hasValue: boolean[] = new Array(streams.length).fill(false)
  let completedStreams = 0

  const tryEmit = async () => {
    if (hasValue.every(Boolean) && !combined.closed) {
      await combined.next([...latestValues] as T)
    }
  }

  streams.forEach((stream, index) =>
    stream.subscribe({
      next: value => {
        latestValues[index] = value
        hasValue[index] = true
        tryEmit()
      },
      error: error => {
        if (!combined.closed) {
          combined.error(error)
        }
      },
      complete: () => {
        completedStreams++
        if (completedStreams === streams.length && !combined.closed) {
          combined.complete()
        }
      }
    })
  )

  return combined
}

// Simple pipe function
export const pipe =
  <T>(...operators: Array<(source: Stream<any>) => Stream<any>>) =>
  (source: Stream<T>) =>
    operators.reduce((stream, operator) => operator(stream), source)

// Export operators for pipe usage
export const operators = {
  map:
    <T, R>(fn: (value: T) => R | Promise<R>) =>
    (source: Stream<T>) =>
      source.map(fn),
  filter:
    <T>(predicate: (value: T) => boolean) =>
    (source: Stream<T>) =>
      source.filter(predicate),
  take:
    <T>(count: number) =>
    (source: Stream<T>) =>
      source.take(count),
  skip:
    <T>(count: number) =>
    (source: Stream<T>) =>
      source.skip(count)
}

/**
 * Create stream from iterable
 */
export const from = <T>(iterable: Iterable<T>): Stream<T> => {
  const stream = createStream<T>()

  setTimeout(async () => {
    try {
      for (const value of iterable) {
        if (stream.closed) break
        await stream.next(value)
      }
      if (!stream.closed) {
        stream.complete()
      }
    } catch (error) {
      if (!stream.closed) {
        stream.error(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }, 0)

  return stream
}

/**
 * Start stream with initial values
 */
export const startWith = <T>(stream: Stream<T>, ...values: T[]): Stream<T> => {
  const startWithStream = createStream<T>()

  setTimeout(async () => {
    try {
      // Emit initial values first
      for (const value of values) {
        if (startWithStream.closed) break
        await startWithStream.next(value)
      }

      if (!startWithStream.closed) {
        // Then subscribe to source stream
        const subscription = stream.subscribe({
          next: value => {
            if (!startWithStream.closed) {
              startWithStream.next(value)
            }
          },
          error: error => {
            if (!startWithStream.closed) {
              startWithStream.error(error)
            }
          },
          complete: () => {
            if (!startWithStream.closed) {
              startWithStream.complete()
            }
          }
        })
      }
    } catch (error) {
      if (!startWithStream.closed) {
        startWithStream.error(
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }
  }, 0)

  return startWithStream
}

/**
 * Race multiple streams - emit from first to emit
 */
export const race = <T>(...streams: Stream<T>[]): Stream<T> => {
  if (streams.length === 0) return empty<T>()
  if (streams.length === 1) return streams[0]

  const raced = createStream<T>()
  let hasWinner = false
  const subscriptions: Array<{unsubscribe(): void}> = []

  streams.forEach(stream => {
    const subscription = stream.subscribe({
      next: value => {
        if (!hasWinner && !raced.closed) {
          hasWinner = true
          // Unsubscribe from all other streams
          subscriptions.forEach(sub => {
            if (sub !== subscription && !sub.closed) {
              sub.unsubscribe()
            }
          })

          // Emit the winning value and forward rest
          raced.next(value)

          // Forward remaining values from winner
          stream.subscribe({
            next: v => {
              if (!raced.closed) {
                raced.next(v)
              }
            },
            error: e => {
              if (!raced.closed) {
                raced.error(e)
              }
            },
            complete: () => {
              if (!raced.closed) {
                raced.complete()
              }
            }
          })
        }
      },
      error: error => {
        if (!hasWinner && !raced.closed) {
          raced.error(error)
        }
      },
      complete: () => {
        if (!hasWinner) {
          const allCompleted = streams.every(s => s.closed)
          if (allCompleted && !raced.closed) {
            raced.complete()
          }
        }
      }
    })
    subscriptions.push(subscription)
  })

  return raced
}

// Export combinators
export const combinators = {
  merge,
  zip,
  combineLatest
}
