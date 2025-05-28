// src/stream/index.ts
// Main exports for Cyre stream system

import {Stream, StreamErrorHandler} from '../types/stream'

export {createStream} from './cyre-stream'

export {
  of,
  from,
  interval,
  timer,
  empty,
  never,
  throwError,
  merge,
  zip,
  combineLatest,
  startWith,
  pipe,
  race,
  combinators
} from './operators'

export {
  bufferCount,
  bufferTime,
  sample,
  audit,
  scan,
  reduce,
  takeUntil,
  takeWhile,
  skipUntil,
  skipWhile,
  share,
  debug,
  log,
  transform,
  compose
} from './utils'

// Re-export types
export type {
  Stream,
  StreamObserver,
  StreamSubscription,
  StreamOperator,
  StreamErrorHandler,
  StreamConfig,
  StreamFactory,
  StreamCombinators
} from '../types/stream'

// Operators object for pipe usage
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
      source.skip(count),
  distinct:
    <T>() =>
    (source: Stream<T>) =>
      source.distinct(),
  distinctUntilChanged:
    <T>() =>
    (source: Stream<T>) =>
      source.distinctUntilChanged(),
  debounce:
    <T>(ms: number) =>
    (source: Stream<T>) =>
      source.debounce(ms),
  throttle:
    <T>(ms: number) =>
    (source: Stream<T>) =>
      source.throttle(ms),
  delay:
    <T>(ms: number) =>
    (source: Stream<T>) =>
      source.delay(ms),
  tap:
    <T>(fn: (value: T) => void | Promise<void>) =>
    (source: Stream<T>) =>
      source.tap(fn),
  catchError:
    <T>(handler: StreamErrorHandler<T>) =>
    (source: Stream<T>) =>
      source.catchError(handler),
  retry:
    <T>(attempts?: number) =>
    (source: Stream<T>) =>
      source.retry(attempts),
  switchMap:
    <T, R>(fn: (value: T) => Stream<R>) =>
    (source: Stream<T>) =>
      source.switchMap(fn),
  mergeMap:
    <T, R>(fn: (value: T) => Stream<R>) =>
    (source: Stream<T>) =>
      source.mergeMap(fn)
}
