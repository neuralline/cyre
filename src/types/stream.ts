// src/types/stream.ts
// Stream type definitions and interfaces

/**
 * Configuration for creating streams
 */
export interface StreamConfig {
  /** Unique identifier for the stream */
  id?: string
  /** Buffer size for stream emissions */
  bufferSize?: number
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Stream observer interface for handling emissions
 */
export interface StreamObserver<T> {
  /** Handle next emission */
  next?: (value: T) => void | Promise<void>
  /** Handle error */
  error?: (error: Error) => void
  /** Handle completion */
  complete?: () => void
}

/**
 * Stream subscription interface
 */
export interface StreamSubscription {
  /** Whether the subscription is closed */
  readonly closed: boolean
  /** Unsubscribe from the stream */
  unsubscribe(): void
}

/**
 * Stream error handler type
 */
export type StreamErrorHandler<T> = (error: Error) => T | Promise<T>

/**
 * Stream operator type
 */
export type StreamOperator<T, R> = (source: Stream<T>) => Stream<R>

/**
 * Stream factory function type
 */
export type StreamFactory<T> = (...args: any[]) => Stream<T>

/**
 * Stream combinators interface
 */
export interface StreamCombinators {
  merge: <T>(...streams: Stream<T>[]) => Stream<T>
  zip: <T extends readonly unknown[]>(
    ...streams: {[K in keyof T]: Stream<T[K]>}
  ) => Stream<T>
  combineLatest: <T extends readonly unknown[]>(
    ...streams: {[K in keyof T]: Stream<T[K]>}
  ) => Stream<T>
}

/**
 * Core stream interface
 */
export interface Stream<T> {
  /** Unique identifier for this stream */
  readonly id: string
  /** Whether the stream is closed (completed or errored) */
  readonly closed: boolean

  // Core methods
  /** Subscribe to stream emissions */
  subscribe(observer: StreamObserver<T>): StreamSubscription
  subscribe(next: (value: T) => void | Promise<void>): StreamSubscription
  /** Emit next value */
  next(value: T): Promise<void>
  /** Emit error */
  error(error: Error): void
  /** Complete the stream */
  complete(): void

  // Transformation operators
  /** Transform emitted values */
  map<R>(fn: (value: T) => R | Promise<R>): Stream<R>
  /** Filter emitted values */
  filter(predicate: (value: T) => boolean): Stream<T>
  /** Take specified number of values */
  take(count: number): Stream<T>
  /** Skip specified number of values */
  skip(count: number): Stream<T>
  /** Filter distinct values */
  distinct(): Stream<T>
  /** Filter distinct consecutive values */
  distinctUntilChanged(): Stream<T>

  // Timing operators
  /** Debounce emissions */
  debounce(ms: number): Stream<T>
  /** Throttle emissions */
  throttle(ms: number): Stream<T>
  /** Delay emissions */
  delay(ms: number): Stream<T>

  // Utility operators
  /** Execute side effect without affecting stream */
  tap(fn: (value: T) => void | Promise<void>): Stream<T>
  /** Handle errors with fallback value */
  catchError(handler: StreamErrorHandler<T>): Stream<T>
  /** Retry on error */
  retry(attempts?: number): Stream<T>

  // Combination operators
  /** Merge with another stream */
  merge<R>(other: Stream<R>): Stream<T | R>
  /** Zip with another stream */
  zip<R, O = [T, R]>(other: Stream<R>, combiner?: (a: T, b: R) => O): Stream<O>
  /** Switch to new stream for each emission */
  switchMap<R>(fn: (value: T) => Stream<R>): Stream<R>
  /** Merge multiple streams from each emission */
  mergeMap<R>(fn: (value: T) => Stream<R>): Stream<R>

  // Utility methods
  /** Apply multiple operators in sequence */
  pipe<R>(...operators: StreamOperator<any, any>[]): Stream<R>
  /** Convert stream to promise (last value) */
  toPromise(): Promise<T>
  /** Convert stream to array (all values) */
  toArray(): Promise<T[]>
}
