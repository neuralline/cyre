// src/stream/cyre-stream.ts
// Core stream implementation fixes for main issues

import {cyre} from '../app'
import {log} from '../components/cyre-log'
import type {
  Stream,
  StreamObserver,
  StreamSubscription,
  StreamConfig,
  StreamErrorHandler,
  StreamOperator
} from '../types/stream'

/*

      C.Y.R.E - S.T.R.E.A.M
      
      Core fixes for main stream system:
      1. Fix interval stream null emission (starts with 0, not null)
      2. Fix timer emission (emit proper void, not undefined)
      3. Fix catchError to continue stream instead of completing
      4. Fix subscription management for multiple observers
      5. Improve cleanup and resource management

*/

interface StreamState<T> {
  observers: Set<StreamObserver<T>>
  completed: boolean
  errored: boolean
  lastError?: Error
  config: Required<StreamConfig>
  lastValue?: T
  emissionCount: number
}

const streamStates = new Map<string, StreamState<any>>()

/**
 * Create stream state with proper initialization
 */
const createStreamState = <T>(
  config: Required<StreamConfig>
): StreamState<T> => {
  const state: StreamState<T> = {
    observers: new Set(),
    completed: false,
    errored: false,
    config,
    emissionCount: 0
  }

  // Register Cyre action for this stream with priority support
  cyre.action({
    id: config.id,
    type: 'stream',
    payload: null,
    detectChanges: false,
    log: config.debug,
    priority: {level: 'medium'} // Streams get medium priority by default
  })

  // Set up stream handler in Cyre
  cyre.on(config.id, (value: T) => {
    if (state.completed || state.errored) {
      return {handled: false, reason: 'stream-closed'}
    }

    state.emissionCount++
    state.lastValue = value

    // Notify all observers
    const observerPromises: Promise<void>[] = []

    state.observers.forEach(observer => {
      try {
        if (observer.next) {
          const result = observer.next(value)
          if (result && typeof result.then === 'function') {
            observerPromises.push(
              result.catch(error => {
                if (observer.error) {
                  observer.error(
                    error instanceof Error ? error : new Error(String(error))
                  )
                } else {
                  log.error(`Unhandled stream observer error: ${error}`)
                }
              })
            )
          }
        }
      } catch (error) {
        if (observer.error) {
          observer.error(
            error instanceof Error ? error : new Error(String(error))
          )
        } else {
          log.error(`Stream observer threw error: ${error}`)
        }
      }
    })

    // Wait for all async observers if any
    if (observerPromises.length > 0) {
      Promise.all(observerPromises).catch(() => {
        // Already handled individual errors above
      })
    }

    return {handled: true, observerCount: state.observers.size}
  })

  return state
}

/**
 * Clean up stream state and resources
 */
const cleanupStreamState = (streamId: string): void => {
  const state = streamStates.get(streamId)
  if (state) {
    // Complete all remaining observers
    state.observers.forEach(observer => {
      try {
        if (observer.complete) observer.complete()
      } catch (error) {
        log.error(`Error completing observer: ${error}`)
      }
    })

    state.observers.clear()
    state.completed = true

    // Clean up Cyre resources
    cyre.forget(streamId)
    streamStates.delete(streamId)

    if (state.config.debug) {
      log.debug(`Stream ${streamId} cleaned up`)
    }
  }
}

/**
 * Create subscription with proper cleanup
 */
const createSubscription = <T>(
  streamId: string,
  observer: StreamObserver<T>
): StreamSubscription => {
  const state = streamStates.get(streamId)
  if (!state) {
    throw new Error(`Stream ${streamId} not found`)
  }

  if (state.completed || state.errored) {
    // Handle completed/errored streams immediately
    if (state.completed && observer.complete) {
      setTimeout(() => observer.complete!(), 0)
    }
    if (state.errored && observer.error && state.lastError) {
      setTimeout(() => observer.error!(state.lastError!), 0)
    }
  } else {
    state.observers.add(observer)
  }

  let closed = false

  return {
    get closed() {
      return closed
    },
    unsubscribe: () => {
      if (!closed) {
        closed = true
        const currentState = streamStates.get(streamId)
        if (currentState) {
          currentState.observers.delete(observer)

          if (currentState.config.debug) {
            log.debug(
              `Stream ${streamId} observer unsubscribed, remaining: ${currentState.observers.size}`
            )
          }
        }
      }
    }
  }
}

/**
 * Helper to create operator streams with proper cleanup
 */
const createOperatorStream = <T, R>(
  source: Stream<T>,
  subscribeFn: (source: Stream<T>, target: Stream<R>) => StreamSubscription
): Stream<R> => {
  const operatorId = `${source.id}-op-${crypto.randomUUID().slice(0, 8)}`
  const target = createStream<R>({
    id: operatorId,
    debug: streamStates.get(source.id)?.config.debug
  })

  const subscription = subscribeFn(source, target)

  // Clean up subscription when target is completed/errored
  const originalComplete = target.complete
  const originalError = target.error

  target.complete = () => {
    subscription.unsubscribe()
    originalComplete.call(target)
  }

  target.error = (error: Error) => {
    subscription.unsubscribe()
    originalError.call(target, error)
  }

  return target
}

/**
 * Core stream implementation with fixes
 */
export const createStream = <T>(config: StreamConfig = {}): Stream<T> => {
  const streamConfig: Required<StreamConfig> = {
    id: config.id || `stream-${crypto.randomUUID().slice(0, 8)}`,
    bufferSize: config.bufferSize || 100,
    debug: config.debug || false
  }

  const streamId = streamConfig.id

  // Create and store stream state
  const state = createStreamState<T>(streamConfig)
  streamStates.set(streamId, state)

  if (streamConfig.debug) {
    log.debug(`Stream ${streamId} created`)
  }

  const stream: Stream<T> = {
    id: streamId,

    get closed() {
      const currentState = streamStates.get(streamId)
      return !currentState || currentState.completed || currentState.errored
    },

    // Subscription methods
    subscribe(
      observerOrNext: StreamObserver<T> | ((value: T) => void | Promise<void>)
    ): StreamSubscription {
      const observer: StreamObserver<T> =
        typeof observerOrNext === 'function'
          ? {next: observerOrNext}
          : observerOrNext

      return createSubscription(streamId, observer)
    },

    // Core emission methods
    async next(value: T): Promise<void> {
      const currentState = streamStates.get(streamId)
      if (!currentState || currentState.completed || currentState.errored) {
        if (streamConfig.debug) {
          log.warn(`Attempted to emit value to closed stream ${streamId}`)
        }
        return
      }

      try {
        await cyre.call(streamId, value)

        if (streamConfig.debug) {
          log.debug(`Stream ${streamId} emitted value`)
        }
      } catch (error) {
        log.error(`Failed to emit value to stream ${streamId}: ${error}`)
        throw error
      }
    },

    error(error: Error): void {
      const currentState = streamStates.get(streamId)
      if (!currentState || currentState.completed || currentState.errored) {
        return
      }

      currentState.errored = true
      currentState.lastError = error

      // Notify all observers of error
      currentState.observers.forEach(observer => {
        try {
          if (observer.error) observer.error(error)
        } catch (observerError) {
          log.error(`Observer error handler threw: ${observerError}`)
        }
      })

      // Clean up
      cleanupStreamState(streamId)

      if (streamConfig.debug) {
        log.debug(`Stream ${streamId} errored: ${error.message}`)
      }
    },

    complete(): void {
      const currentState = streamStates.get(streamId)
      if (!currentState || currentState.completed || currentState.errored) {
        return
      }

      currentState.completed = true

      if (streamConfig.debug) {
        log.debug(`Stream ${streamId} completed`)
      }

      // Clean up after completion
      cleanupStreamState(streamId)
    },

    // Transformation operators
    map<R>(fn: (value: T) => R | Promise<R>): Stream<R> {
      return createOperatorStream(stream, (source, target) => {
        return source.subscribe({
          next: async value => {
            try {
              const result = await Promise.resolve(fn(value))
              await target.next(result)
            } catch (error) {
              target.error(
                error instanceof Error ? error : new Error(String(error))
              )
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    filter(predicate: (value: T) => boolean): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        return source.subscribe({
          next: async value => {
            try {
              if (predicate(value)) {
                await target.next(value)
              }
            } catch (error) {
              target.error(
                error instanceof Error ? error : new Error(String(error))
              )
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    take(count: number): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        let taken = 0
        return source.subscribe({
          next: async value => {
            if (taken < count) {
              taken++
              await target.next(value)
              if (taken >= count) {
                target.complete()
              }
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    skip(count: number): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        let skipped = 0
        return source.subscribe({
          next: async value => {
            if (skipped < count) {
              skipped++
            } else {
              await target.next(value)
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    distinct(): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        const seen = new Set<string>()
        return source.subscribe({
          next: async value => {
            const key = JSON.stringify(value)
            if (!seen.has(key)) {
              seen.add(key)
              await target.next(value)
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    distinctUntilChanged(): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        let hasLast = false
        let lastValue: T
        return source.subscribe({
          next: async value => {
            if (
              !hasLast ||
              JSON.stringify(value) !== JSON.stringify(lastValue)
            ) {
              hasLast = true
              lastValue = value
              await target.next(value)
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    // Timing operators using Cyre's built-in protections
    debounce(ms: number): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        const debounceId = `${streamId}-debounce-${crypto
          .randomUUID()
          .slice(0, 8)}`

        // Use Cyre's built-in debounce
        cyre.action({
          id: debounceId,
          debounce: ms,
          detectChanges: false
        })

        cyre.on(debounceId, async (value: T) => {
          await target.next(value)
        })

        return source.subscribe({
          next: value => {
            cyre.call(debounceId, value)
          },
          error: error => target.error(error),
          complete: () => {
            cyre.forget(debounceId)
            target.complete()
          }
        })
      })
    },

    throttle(ms: number): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        let lastEmission = 0

        return source.subscribe({
          next: async value => {
            const now = Date.now()
            if (now - lastEmission >= ms) {
              lastEmission = now
              await target.next(value)
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    delay(ms: number): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        return source.subscribe({
          next: value => {
            setTimeout(async () => {
              try {
                await target.next(value)
              } catch (error) {
                target.error(
                  error instanceof Error ? error : new Error(String(error))
                )
              }
            }, ms)
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    // Utility operators
    tap(fn: (value: T) => void | Promise<void>): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        return source.subscribe({
          next: async value => {
            try {
              await Promise.resolve(fn(value))
              await target.next(value)
            } catch (error) {
              target.error(
                error instanceof Error ? error : new Error(String(error))
              )
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    // FIXED: catchError should continue stream, not complete it
    catchError(handler: StreamErrorHandler<T>): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        return source.subscribe({
          next: async value => {
            await target.next(value)
          },
          error: async error => {
            try {
              const fallbackValue = await Promise.resolve(handler(error))
              await target.next(fallbackValue)
              // DON'T complete - continue the stream
            } catch (handlerError) {
              target.error(
                handlerError instanceof Error
                  ? handlerError
                  : new Error(String(handlerError))
              )
            }
          },
          complete: () => target.complete()
        })
      })
    },

    retry(attempts: number = 3): Stream<T> {
      return createOperatorStream(stream, (source, target) => {
        let currentAttempts = 0

        const trySubscribe = (): StreamSubscription => {
          return source.subscribe({
            next: async value => {
              await target.next(value)
            },
            error: error => {
              if (currentAttempts < attempts) {
                currentAttempts++
                // Retry
                setTimeout(() => trySubscribe(), 0)
              } else {
                target.error(error)
              }
            },
            complete: () => target.complete()
          })
        }

        return trySubscribe()
      })
    },

    // Combination operators
    merge<R>(other: Stream<R>): Stream<T | R> {
      const mergedId = `${streamId}-merge-${crypto.randomUUID().slice(0, 8)}`
      const merged = createStream<T | R>({
        id: mergedId,
        debug: streamConfig.debug
      })

      let completed1 = false
      let completed2 = false

      const checkComplete = () => {
        if (completed1 && completed2) {
          merged.complete()
        }
      }

      stream.subscribe({
        next: value => merged.next(value),
        error: error => merged.error(error),
        complete: () => {
          completed1 = true
          checkComplete()
        }
      })

      other.subscribe({
        next: value => merged.next(value),
        error: error => merged.error(error),
        complete: () => {
          completed2 = true
          checkComplete()
        }
      })

      return merged
    },

    zip<R, O = [T, R]>(
      other: Stream<R>,
      combiner?: (a: T, b: R) => O
    ): Stream<O> {
      const zipId = `${streamId}-zip-${crypto.randomUUID().slice(0, 8)}`
      const zipped = createStream<O>({id: zipId, debug: streamConfig.debug})

      const bufferA: T[] = []
      const bufferB: R[] = []
      const defaultCombiner = (a: T, b: R) => [a, b] as unknown as O
      const combineFn = combiner || defaultCombiner

      const tryEmit = async () => {
        while (bufferA.length > 0 && bufferB.length > 0) {
          const a = bufferA.shift()!
          const b = bufferB.shift()!
          const combined = combineFn(a, b)
          await zipped.next(combined)
        }
      }

      stream.subscribe({
        next: value => {
          bufferA.push(value)
          tryEmit()
        },
        error: error => zipped.error(error),
        complete: () => zipped.complete()
      })

      other.subscribe({
        next: value => {
          bufferB.push(value)
          tryEmit()
        },
        error: error => zipped.error(error),
        complete: () => zipped.complete()
      })

      return zipped
    },

    switchMap<R>(fn: (value: T) => Stream<R>): Stream<R> {
      return createOperatorStream(stream, (source, target) => {
        let innerSubscription: StreamSubscription | null = null

        return source.subscribe({
          next: value => {
            // Unsubscribe from previous inner stream
            if (innerSubscription) {
              innerSubscription.unsubscribe()
            }

            try {
              const innerStream = fn(value)
              innerSubscription = innerStream.subscribe({
                next: innerValue => target.next(innerValue),
                error: error => target.error(error),
                complete: () => {} // Don't complete target on inner complete
              })
            } catch (error) {
              target.error(
                error instanceof Error ? error : new Error(String(error))
              )
            }
          },
          error: error => target.error(error),
          complete: () => target.complete()
        })
      })
    },

    mergeMap<R>(fn: (value: T) => Stream<R>): Stream<R> {
      return createOperatorStream(stream, (source, target) => {
        const innerSubscriptions: StreamSubscription[] = []
        let sourceCompleted = false
        let completedInner = 0

        const checkComplete = () => {
          if (sourceCompleted && completedInner === innerSubscriptions.length) {
            target.complete()
          }
        }

        return source.subscribe({
          next: value => {
            try {
              const innerStream = fn(value)
              const subscription = innerStream.subscribe({
                next: innerValue => target.next(innerValue),
                error: error => target.error(error),
                complete: () => {
                  completedInner++
                  checkComplete()
                }
              })
              innerSubscriptions.push(subscription)
            } catch (error) {
              target.error(
                error instanceof Error ? error : new Error(String(error))
              )
            }
          },
          error: error => target.error(error),
          complete: () => {
            sourceCompleted = true
            checkComplete()
          }
        })
      })
    },

    // Utility methods
    pipe<R>(...operators: StreamOperator<any, any>[]): Stream<R> {
      return operators.reduce(
        (stream, operator) => operator(stream),
        stream as any
      )
    },

    async toPromise(): Promise<T> {
      return new Promise((resolve, reject) => {
        let hasValue = false
        let lastValue: T

        const subscription = stream.subscribe({
          next: value => {
            hasValue = true
            lastValue = value
          },
          error: reject,
          complete: () => {
            if (hasValue) {
              resolve(lastValue)
            } else {
              reject(new Error('Stream completed without emitting any values'))
            }
          }
        })
      })
    },

    async toArray(): Promise<T[]> {
      return new Promise((resolve, reject) => {
        const values: T[] = []

        const subscription = stream.subscribe({
          next: value => {
            values.push(value)
          },
          error: reject,
          complete: () => resolve(values)
        })
      })
    }
  }

  return stream
}
