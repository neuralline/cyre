// src/streams/types.ts

/**
 * Subscription to a stream with cleanup capability
 */
export interface StreamSubscription {
  unsubscribe: () => void
}

/**
 * Value observer function
 */
export type Observer<T> = (value: T) => void | Promise<void>

/**
 * Error handling function
 */
export type ErrorHandler<T> = (error: Error, value?: T) => T

// src/streams/types.ts - updated with instance methods
export interface Stream<T> {
  /** Unique identifier for this stream */
  readonly id: string

  /** Push a new value to the stream */
  next: (value: T) => Promise<void>

  /** Mark the stream as complete */
  complete: () => void

  /** Subscribe to stream values */
  subscribe: (observer: Observer<T>) => StreamSubscription

  /** Check if stream is completed */
  isCompleted: () => boolean

  // Stream operators
  map: <R>(fn: (value: T) => R | Promise<R>) => Stream<R>
  filter: (predicate: (value: T) => boolean) => Stream<T>
  tap: (fn: (value: T) => void | Promise<void>) => Stream<T>
  take: (count: number) => Stream<T>
  skip: (count: number) => Stream<T>
  distinct: () => Stream<T>
  debounce: (ms: number) => Stream<T>
  throttle: (ms: number) => Stream<T>
  catchError: (handler: ErrorHandler<T>) => Stream<T>
  switchMap: <R>(fn: (value: T) => Stream<R>) => Stream<R>

  // Add these instance methods
  merge: <R>(otherStream: Stream<R>) => Stream<T | R>
  zip: <R, O = [T, R]>(
    otherStream: Stream<R>,
    combiner?: (a: T, b: R) => O
  ) => Stream<O>
}
