// src/streams/cyre-stream.ts
// Streams implementation using Cyre for reactive programming patterns

import {cyre} from '../app'
import {log} from '../components/cyre-log'
import {
  Stream,
  Observer,
  StreamSubscription,
  ErrorHandler
} from '../streams/types'
import {debounceOperator, throttleOperator} from './stream-operators'

/**
 * Creates a new stream with the given ID
 */
export function createStream<T>(id: string): Stream<T> {
  // Internal state
  let completed = false
  const observers: Observer<T>[] = []

  // Ensure unique ID
  const streamId = id || `stream-${crypto.randomUUID().slice(0, 8)}`

  // Initialize Cyre action for this stream
  cyre.action({
    id: streamId,
    type: 'stream',
    payload: {initialized: true}
  })

  // Create error channel for this stream
  const errorChannelId = `${streamId}-error-channel`
  cyre.action({
    id: errorChannelId,
    type: 'stream-error',
    payload: null
  })

  // Subscribe to Cyre action events
  cyre.on(streamId, (payload: T) => {
    if (completed) {
      log.debug(`[Stream ${streamId}] Ignoring value for completed stream`)
      return
    }

    // Notify all observers
    log.debug(`[Stream ${streamId}] Notifying ${observers.length} observers`)
    observers.forEach(observer => {
      try {
        // Use Promise.resolve to handle both sync and async observers
        Promise.resolve(observer(payload)).catch(err => {
          log.error(`Error in stream observer for ${streamId}:`, err)
        })
      } catch (error) {
        log.error(`Error in stream observer for ${streamId}:`, error)
      }
    })
  })

  // Create the stream object
  const stream: Stream<T> = {
    id: streamId,

    // Push a new value to stream
    next: async (value: T): Promise<void> => {
      if (completed) {
        log.warn(`Attempted to push value to completed stream ${streamId}`)
        return
      }

      log.debug(`[Stream ${streamId}] Pushing value:`, value)
      return cyre.call(streamId, value)
    },

    // Mark stream as complete
    complete: (): void => {
      if (!completed) {
        completed = true
        observers.length = 0 // Clear all observers
        log.debug(`Stream ${streamId} completed`)
      }
    },

    // Subscribe to stream values
    subscribe: (observer: Observer<T>): StreamSubscription => {
      if (completed) {
        log.warn(`Attempted to subscribe to completed stream ${streamId}`)
        return {unsubscribe: () => {}}
      }

      observers.push(observer)
      log.debug(
        `[Stream ${streamId}] Added observer, total: ${observers.length}`
      )

      return {
        unsubscribe: () => {
          const index = observers.indexOf(observer)
          if (index >= 0) {
            observers.splice(index, 1)
            log.debug(
              `[Stream ${streamId}] Removed observer, remaining: ${observers.length}`
            )
          }
        }
      }
    },

    // Check if stream is completed
    isCompleted: (): boolean => completed,

    // Transform values with map
    map: <R>(fn: (value: T) => R | Promise<R>): Stream<R> => {
      const mappedId = `${streamId}-map-${crypto.randomUUID().slice(0, 8)}`
      log.debug(`[Stream ${streamId}] Creating map operator: ${mappedId}`)
      const mappedStream = createStream<R>(mappedId)

      const subscription = stream.subscribe(value => {
        try {
          log.debug(`[Stream ${mappedId}] Mapping value:`, value)

          // Handle both sync and async mapping functions
          Promise.resolve(fn(value))
            .then(result => {
              log.debug(`[Stream ${mappedId}] Mapped result:`, result)
              return mappedStream.next(result)
            })
            .catch(error => {
              log.error(
                `Error in stream map (${streamId} -> ${mappedId}):`,
                error
              )

              // Call error channel for the mapped stream
              cyre.call(`${mappedId}-error-channel`, {
                error:
                  error instanceof Error ? error : new Error(String(error)),
                value
              })
            })
        } catch (error) {
          log.error(`Error in stream map (${streamId} -> ${mappedId}):`, error)

          // Call error channel for synchronous errors
          cyre.call(`${mappedId}-error-channel`, {
            error: error instanceof Error ? error : new Error(String(error)),
            value
          })
        }
      })

      // Override complete to clean up
      const originalComplete = mappedStream.complete
      mappedStream.complete = () => {
        subscription.unsubscribe()
        originalComplete()
      }

      return mappedStream
    },

    // Filter values
    filter: (predicate: (value: T) => boolean): Stream<T> => {
      const filterId = `${streamId}-filter-${crypto.randomUUID().slice(0, 8)}`
      log.debug(`[Stream ${streamId}] Creating filter operator: ${filterId}`)
      const filteredStream = createStream<T>(filterId)

      const subscription = stream.subscribe(value => {
        try {
          const passes = predicate(value)
          log.debug(
            `[Stream ${filterId}] Filter result for`,
            value,
            `: ${passes}`
          )
          if (passes) {
            filteredStream
              .next(value)
              .catch(err => log.error(`Error in filtered stream:`, err))
          }
        } catch (error) {
          log.error(`Error in stream filter:`, error)
        }
      })

      // Override complete
      const originalComplete = filteredStream.complete
      filteredStream.complete = () => {
        subscription.unsubscribe()
        originalComplete()
      }

      return filteredStream
    },

    // Execute side effects without changing the stream
    tap: (fn: (value: T) => void | Promise<void>): Stream<T> => {
      const tapId = `${streamId}-tap-${crypto.randomUUID().slice(0, 8)}`
      log.debug(`[Stream ${streamId}] Creating tap operator: ${tapId}`)
      const tapStream = createStream<T>(tapId)

      const subscription = stream.subscribe(value => {
        try {
          log.debug(`[Stream ${tapId}] Executing side effect for:`, value)

          // Handle both sync and async side effects
          Promise.resolve(fn(value))
            .catch(error => log.error(`Error in tap side effect:`, error))
            .finally(() => {
              // Always continue with the value even if tap fails
              tapStream
                .next(value)
                .catch(err => log.error(`Error forwarding value in tap:`, err))
            })
        } catch (error) {
          log.error(`Error in stream tap:`, error)
          // Still continue with the value even if tap fails
          tapStream
            .next(value)
            .catch(err =>
              log.error(`Error forwarding value after tap error:`, err)
            )
        }
      })

      // Override complete
      const originalComplete = tapStream.complete
      tapStream.complete = () => {
        subscription.unsubscribe()
        originalComplete()
      }

      return tapStream
    },

    // Take only a specified number of values
    take: (count: number): Stream<T> => {
      const takeId = `${streamId}-take-${crypto.randomUUID().slice(0, 8)}`
      log.debug(
        `[Stream ${streamId}] Creating take(${count}) operator: ${takeId}`
      )
      const takeStream = createStream<T>(takeId)

      let taken = 0

      const subscription = stream.subscribe(value => {
        if (taken < count) {
          taken++
          log.debug(`[Stream ${takeId}] Taking value ${taken}/${count}:`, value)
          takeStream
            .next(value)
            .catch(err => log.error(`Error in take stream:`, err))
            .then(() => {
              if (taken >= count) {
                log.debug(
                  `[Stream ${takeId}] Take limit reached, completing stream`
                )
                takeStream.complete()
              }
            })
        } else {
          log.debug(`[Stream ${takeId}] Ignoring value after limit:`, value)
        }
      })

      // Override complete
      const originalComplete = takeStream.complete
      takeStream.complete = () => {
        subscription.unsubscribe()
        originalComplete()
      }

      return takeStream
    },

    // Skip a specified number of values
    skip: (count: number): Stream<T> => {
      const skipId = `${streamId}-skip-${crypto.randomUUID().slice(0, 8)}`
      log.debug(
        `[Stream ${streamId}] Creating skip(${count}) operator: ${skipId}`
      )
      const skipStream = createStream<T>(skipId)

      let skipped = 0

      const subscription = stream.subscribe(value => {
        if (skipped < count) {
          skipped++
          log.debug(
            `[Stream ${skipId}] Skipping value ${skipped}/${count}:`,
            value
          )
        } else {
          log.debug(`[Stream ${skipId}] Processing value after skip:`, value)
          skipStream
            .next(value)
            .catch(err => log.error(`Error in skip stream:`, err))
        }
      })

      // Override complete
      const originalComplete = skipStream.complete
      skipStream.complete = () => {
        subscription.unsubscribe()
        originalComplete()
      }

      return skipStream
    },

    // Filter out duplicate consecutive values
    distinct: () => {
      const distinctId = `${streamId}-distinct-${crypto
        .randomUUID()
        .slice(0, 8)}`
      log.debug(
        `[Stream ${streamId}] Creating distinct operator: ${distinctId}`
      )
      const distinctStream = createStream<T>(distinctId)

      let lastValue: T | undefined
      let initialized = false

      const subscription = stream.subscribe(value => {
        const valueJson = JSON.stringify(value)
        const lastJson =
          lastValue !== undefined ? JSON.stringify(lastValue) : undefined

        if (!initialized || valueJson !== lastJson) {
          initialized = true
          lastValue = value
          log.debug(`[Stream ${distinctId}] Value is distinct:`, value)
          distinctStream
            .next(value)
            .catch(err => log.error(`Error in distinct stream:`, err))
        } else {
          log.debug(`[Stream ${distinctId}] Filtering duplicate:`, value)
        }
      })

      // Override complete
      const originalComplete = distinctStream.complete
      distinctStream.complete = () => {
        subscription.unsubscribe()
        originalComplete()
      }

      return distinctStream
    },

    // src/hooks/cyre-stream.ts - update debounce and throttle methods

    // Delay emission by specified milliseconds
    // src/hooks/cyre-stream.ts - update just the debounce and throttle methods

    // Delay emission by specified milliseconds
    debounce: (ms: number): Stream<T> => {
      const debounceId = `${streamId}-debounce-${crypto
        .randomUUID()
        .slice(0, 8)}`
      log.debug(
        `[Stream ${streamId}] Creating debounce(${ms}ms) operator: ${debounceId}`
      )
      const debounceStream = createStream<T>(debounceId)

      // Important: Create a unique handler function for this operation
      const debounceHandler = (value: any) => {
        log.debug(`[Stream ${debounceId}] Debounced handler received value`)
        debounceStream
          .next(value)
          .catch(err => log.error(`Error in debounce stream:`, err))
      }

      // Register the channel just once
      cyre.action({
        id: debounceId,
        type: 'stream-debounce',
        debounce: ms
      })

      // Register handler with a unique reference
      const handlerSub = cyre.on(debounceId, debounceHandler)

      // Subscribe to source stream
      const subscription = stream.subscribe(value => {
        // Call the debounced action
        cyre.call(debounceId, value)
      })

      // Override complete to clean up ALL resources
      const originalComplete = debounceStream.complete
      debounceStream.complete = () => {
        log.debug(`[Stream ${debounceId}] Completing debounce stream`)
        subscription.unsubscribe()
        if (handlerSub && typeof handlerSub.unsubscribe === 'function') {
          handlerSub.unsubscribe()
        }
        cyre.forget(debounceId)
        originalComplete()
      }

      return debounceStream
    },

    // Limit emissions to one per specified milliseconds
    throttle: (ms: number): Stream<T> => {
      const throttleId = `${streamId}-throttle-${crypto
        .randomUUID()
        .slice(0, 8)}`
      log.debug(
        `[Stream ${streamId}] Creating throttle(${ms}ms) operator: ${throttleId}`
      )
      const throttleStream = createStream<T>(throttleId)

      // Important: Create a unique handler function for this operation
      const throttleHandler = (value: any) => {
        log.debug(`[Stream ${throttleId}] Throttled handler received value`)
        throttleStream
          .next(value)
          .catch(err => log.error(`Error in throttle stream:`, err))
      }

      // Register the channel just once
      cyre.action({
        id: throttleId,
        type: 'stream-throttle',
        throttle: ms
      })

      // Register handler with a unique reference
      const handlerSub = cyre.on(throttleId, throttleHandler)

      // Subscribe to source stream
      const subscription = stream.subscribe(value => {
        // Call the throttled action
        cyre.call(throttleId, value)
      })

      // Override complete to clean up ALL resources
      const originalComplete = throttleStream.complete
      throttleStream.complete = () => {
        log.debug(`[Stream ${throttleId}] Completing throttle stream`)
        subscription.unsubscribe()
        if (handlerSub && typeof handlerSub.unsubscribe === 'function') {
          handlerSub.unsubscribe()
        }
        cyre.forget(throttleId)
        originalComplete()
      }

      return throttleStream
    },
    // Handle errors in the stream
    catchError: (handler: ErrorHandler<T>): Stream<T> => {
      const errorId = `${streamId}-error-${crypto.randomUUID().slice(0, 8)}`
      log.debug(`[Stream ${streamId}] Creating catchError operator: ${errorId}`)
      const errorStream = createStream<T>(errorId)

      // Subscribe to the main stream
      const streamSub = stream.subscribe(value => {
        try {
          errorStream.next(value).catch(error => {
            log.error(`Error caught in catchError:`, error)
            const fallbackValue = handler(
              error instanceof Error ? error : new Error(String(error)),
              value
            )
            errorStream
              .next(fallbackValue)
              .catch(err => log.error(`Error in catchError fallback:`, err))
          })
        } catch (error) {
          log.error(`Error caught in catchError:`, error)
          const fallbackValue = handler(
            error instanceof Error ? error : new Error(String(error)),
            value
          )
          errorStream
            .next(fallbackValue)
            .catch(err => log.error(`Error in catchError fallback:`, err))
        }
      })

      // Subscribe to the error channel for upstream map errors
      const errorChannelSub = cyre.on(
        errorChannelId,
        (errorData: {error: Error; value?: T}) => {
          log.debug(
            `[Stream ${errorId}] Handling error from channel:`,
            errorData.error.message
          )
          const fallbackValue = handler(errorData.error, errorData.value as T)
          errorStream
            .next(fallbackValue)
            .catch(err => log.error(`Error in error channel fallback:`, err))
        }
      )

      // Override complete
      const originalComplete = errorStream.complete
      errorStream.complete = () => {
        streamSub.unsubscribe && streamSub.unsubscribe()
        errorChannelSub.unsubscribe && errorChannelSub.unsubscribe()
        originalComplete()
      }

      return errorStream
    },

    // Switch to a new stream based on values
    // src/streams/cyre-stream.ts - Fixed switchMap implementation
    switchMap: <R>(fn: (value: T) => Stream<R>): Stream<R> => {
      const switchId = `${streamId}-switch-${crypto.randomUUID().slice(0, 8)}`
      log.debug(`[Stream ${streamId}] Creating switchMap operator: ${switchId}`)
      const switchStream = createStream<R>(switchId)

      // Track all subscriptions
      const subscriptions: StreamSubscription[] = []

      // Create main subscription
      const mainSub = stream.subscribe(value => {
        log.debug(`[Stream ${switchId}] Received value from source:`, value)

        // Clean up previous subscriptions
        subscriptions.slice(1).forEach(sub => sub.unsubscribe())
        // Keep only main subscription
        subscriptions.length = 1

        try {
          // Create new inner stream
          const innerStream = fn(value)
          log.debug(
            `[Stream ${switchId}] Created inner stream, setting up subscription`
          )

          // Subscribe to inner stream
          const innerSub = innerStream.subscribe(innerValue => {
            log.debug(
              `[Stream ${switchId}] Received value from inner stream:`,
              innerValue
            )
            switchStream
              .next(innerValue)
              .catch(err =>
                log.error(`Error forwarding value in switchMap:`, err)
              )
          })

          // Add to subscriptions array
          subscriptions.push(innerSub)

          // Note: We don't need to emit values here!
          // Values will be emitted AFTER this function returns
        } catch (error) {
          log.error(`Error in switchMap:`, error)
        }
      })

      // Add main subscription first
      subscriptions.push(mainSub)

      // Override complete
      const originalComplete = switchStream.complete
      switchStream.complete = () => {
        log.debug(`[Stream ${switchId}] Completing switchMap stream`)
        subscriptions.forEach(sub => sub.unsubscribe())
        subscriptions.length = 0
        originalComplete()
      }

      return switchStream
    },

    // Add instance methods for merging streams
    merge: <R>(otherStream: Stream<R>): Stream<T | R> => {
      const mergedId = `${streamId}-merge-${crypto.randomUUID().slice(0, 8)}`
      log.debug(`[Stream ${streamId}] Creating merge with: ${otherStream.id}`)

      const mergedStream = createStream<T | R>(mergedId)

      // Subscribe to this stream
      const sub1 = stream.subscribe(value => {
        mergedStream
          .next(value)
          .catch(err => log.error(`Error forwarding to merged stream:`, err))
      })

      // Subscribe to other stream
      const sub2 = otherStream.subscribe(value => {
        mergedStream
          .next(value)
          .catch(err => log.error(`Error forwarding to merged stream:`, err))
      })

      // Override complete
      const originalComplete = mergedStream.complete
      mergedStream.complete = () => {
        log.debug(`[Stream ${mergedId}] Completing merged stream`)
        sub1.unsubscribe()
        sub2.unsubscribe()
        originalComplete()
      }

      return mergedStream
    },

    // Add instance method for zipping streams
    zip: <R, O = [T, R]>(
      otherStream: Stream<R>,
      combiner?: (a: T, b: R) => O
    ): Stream<O> => {
      const zipId = `${streamId}-zip-${crypto.randomUUID().slice(0, 8)}`
      log.debug(`[Stream ${streamId}] Creating zip with: ${otherStream.id}`)

      const zipStream = createStream<O>(zipId)

      // Buffers for values
      const bufferA: T[] = []
      const bufferB: R[] = []

      // Default combiner
      const defaultCombiner = (a: T, b: R) => [a, b] as unknown as O
      const combineFn = combiner || defaultCombiner

      // Try to emit combined values
      const tryEmit = async () => {
        log.debug(
          `[Stream ${zipId}] Checking zip buffers A:${bufferA.length}, B:${bufferB.length}`
        )
        while (bufferA.length > 0 && bufferB.length > 0) {
          const a = bufferA.shift()!
          const b = bufferB.shift()!
          log.debug(`[Stream ${zipId}] Zipping values:`, a, `with`, b)
          const combined = combineFn(a, b)
          await zipStream
            .next(combined)
            .catch(err => log.error(`Error in zip emission:`, err))
        }
      }

      // Subscribe to both streams
      const sub1 = stream.subscribe(value => {
        log.debug(`[Stream ${zipId}] Stream A received value:`, value)
        bufferA.push(value)
        tryEmit().catch(err =>
          log.error(`Error in zip emission from stream A:`, err)
        )
      })

      const sub2 = otherStream.subscribe(value => {
        log.debug(`[Stream ${zipId}] Stream B received value:`, value)
        bufferB.push(value)
        tryEmit().catch(err =>
          log.error(`Error in zip emission from stream B:`, err)
        )
      })

      // Override complete
      const originalComplete = zipStream.complete
      zipStream.complete = () => {
        log.debug(`[Stream ${zipId}] Completing zip stream`)
        sub1.unsubscribe()
        sub2.unsubscribe()
        originalComplete()
      }

      return zipStream
    }
  }

  return stream
}
