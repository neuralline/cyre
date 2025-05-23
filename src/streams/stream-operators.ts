// src/streams/stream-operators.ts

import {cyre} from '../app'
import {log} from '../components/cyre-log'
import {Stream, Observer, StreamSubscription} from './types'
import {createStream} from './cyre-stream'

/**
 * Enhanced debounce implementation that works with fake timers in tests
 */
export function debounceOperator<T>(stream: Stream<T>, ms: number): Stream<T> {
  const debounceId = `${stream.id}-debounce-${crypto.randomUUID().slice(0, 8)}`
  log.debug(
    `[Stream ${stream.id}] Creating debounce(${ms}ms) operator: ${debounceId}`
  )
  const debounceStream = createStream<T>(debounceId)

  // Track state for debouncing
  let latestValue: T | undefined = undefined
  let hasValue = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  // Subscribe to source stream
  const subscription = stream.subscribe(value => {
    // Store latest value
    latestValue = value
    hasValue = true

    // Clear any existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    // Schedule new timeout
    timeoutId = setTimeout(() => {
      if (hasValue && latestValue !== undefined) {
        log.debug(
          `[Stream ${debounceId}] Debounce timeout elapsed, emitting:`,
          latestValue !== null ? latestValue : 'No value'
        )
        debounceStream
          .next(latestValue)
          .catch(err => log.error(`Error in debounce stream:`, err))
        hasValue = false
      }
    }, ms)
  })

  // Override complete
  const originalComplete = debounceStream.complete
  debounceStream.complete = () => {
    subscription.unsubscribe()
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    originalComplete()
  }

  return debounceStream
}

/**
 * Enhanced throttle implementation that works with fake timers in tests
 */
export function throttleOperator<T>(stream: Stream<T>, ms: number): Stream<T> {
  const throttleId = `${stream.id}-throttle-${crypto.randomUUID().slice(0, 8)}`
  log.debug(
    `[Stream ${stream.id}] Creating throttle(${ms}ms) operator: ${throttleId}`
  )
  const throttleStream = createStream<T>(throttleId)

  // Track state for throttling
  let lastEmitTime = 0
  let latestValue: T | undefined = undefined
  let hasValue = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  // Subscribe to source stream
  const subscription = stream.subscribe(value => {
    const now = Date.now()

    // Store latest value
    latestValue = value
    hasValue = true

    // Check if we should emit immediately
    if (now - lastEmitTime >= ms) {
      log.debug(
        `[Stream ${throttleId}] Throttle window clear, emitting immediately:`,
        value
      )
      throttleStream
        .next(value)
        .catch(err => log.error(`Error in throttle stream:`, err))

      lastEmitTime = now
      hasValue = false
    } else if (timeoutId === null) {
      // Schedule emission for end of throttle period
      const remaining = ms - (now - lastEmitTime)
      timeoutId = setTimeout(() => {
        if (hasValue && latestValue !== undefined) {
          log.debug(
            `[Stream ${throttleId}] Throttle timeout elapsed, emitting:`,
            latestValue !== null ? latestValue : 'No value'
          )
          throttleStream
            .next(latestValue)
            .catch(err => log.error(`Error in throttle stream:`, err))

          lastEmitTime = Date.now()
          hasValue = false
        }
        timeoutId = null
      }, remaining)
    }
  })

  // Override complete
  const originalComplete = throttleStream.complete
  throttleStream.complete = () => {
    subscription.unsubscribe()
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    originalComplete()
  }

  return throttleStream
}
