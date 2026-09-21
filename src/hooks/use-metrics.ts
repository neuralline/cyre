// src/hooks/use-metrics.ts
// useMetrics hook - live, push-based cyre metrics for monitoring and charts

/*

      C.Y.R.E - U.S.E - M.E.T.R.I.C.S

      cyre.getMetrics(channelId?) (app.ts, backed by
      context/metrics-state.ts) is a pull-based snapshot - correct for a
      one-off read. For live monitoring this hook subscribes to
      context/metrics-stream.ts instead of polling: it is told when the
      breathing tick produces a new sample, when a handler runs slow, when
      a handler throws, and when the system enters/leaves recuperation.

      It creates no channel and no timer of its own, and never touches
      cyre.call() - the fast lane pays nothing for it. Sampling work only
      happens while at least one subscription exists (watch(), on()); with
      none, the stream is idle. Because ticks ride the breathing loop,
      delivery rate stretches under stress on its own.

      Chart data: series() returns flat, oldest-first rows recorded while
      subscribed (a fixed-size ring buffer, ~5 min at 1/sec), channels()
      returns per-channel rows (rate, last/max duration, errors, idle
      time). Pure analyzers for the common questions - unused, hottest,
      slowest, error-prone channels - live in libs/metrics-analysis.ts and
      are re-exported here.

      Same isBranch handling as useCyre for channelId: given a Branch, a
      channelId resolves to that branch's own path.

*/

import type {CyreInstance} from '../app'
import {cyre} from '../app'
import type {Branch} from '../types/hooks'
import type {
  ChannelMetricsResult,
  SystemMetricsResult
} from '../types/system'
import {sensor} from '../components/sensor'
import {metricsStream} from '../context/metrics-stream'
import type {
  ChannelMetricsRow,
  MetricsEventMap,
  MetricsEventName,
  MetricsSample
} from '../context/metrics-stream'
import {
  findUnused,
  findNeverExecuted,
  hottest,
  slowest,
  errorProne
} from '../libs/metrics-analysis'

export interface UseMetricsConfig {
  /** Watch one channel's metrics instead of the system-wide snapshot */
  channelId?: string
  /**
   * Minimum ms between deliveries to each watch() callback. Default 0 =
   * every breathing tick (~1/sec, slower under stress). Not a timer - it
   * only skips ticks that arrive sooner. Compared with 10% tolerance so a
   * nominal `interval: 1000` against a ~1s tick is never halved by a tick
   * landing a few ms early.
   */
  interval?: number
  /**
   * Slow-task threshold in ms for on('slow-task'). Default 100. With
   * several subscribers the lowest threshold is what the dispatcher
   * compares against; each callback still only sees events above its own.
   */
  slowMs?: number
}

export type MetricsSnapshot =
  | SystemMetricsResult
  | ChannelMetricsResult
  | {error: string; available: false}

export interface MetricsHook {
  /** Full id the hook resolved to watch (branch-prefixed if applicable) */
  channelId?: string
  /** One-off snapshot - same shape cyre.getMetrics() itself returns */
  get: () => MetricsSnapshot
  /**
   * Receive a fresh snapshot on every breathing tick (subject to
   * `interval`), plus one immediately. Returns a stop function that
   * removes only this callback.
   */
  watch: (callback: (metrics: MetricsSnapshot) => void) => () => void
  /**
   * Subscribe to a metrics event: 'tick' (sample + channel rows),
   * 'slow-task', 'channel-error', 'recuperation'. Returns unsubscribe.
   * With `channelId` set, channel events are filtered to that channel.
   */
  on: <E extends MetricsEventName>(
    event: E,
    callback: (payload: MetricsEventMap[E]) => void
  ) => () => void
  /** Recorded samples, oldest first, for charts. Recorded while subscribed. */
  series: (last?: number) => MetricsSample[]
  /** Per-channel rows (rate, durations, errors, idle time) */
  channels: () => ChannelMetricsRow[]
  /** Remove every subscription this hook created (idempotent) */
  stop: () => void
}

/**
 * Live cyre metrics - system-wide by default, or scoped to one channel.
 *
 * @example
 * const vitals = useMetrics(cyre)
 * vitals.on('tick', ({sample}) => chart.push(sample))
 * vitals.on('slow-task', e => console.warn(e.channelId, e.durationMs))
 *
 * @example
 * // Which channels are dead, hot or slow?
 * findUnused(vitals.channels(), {idleMs: 5 * 60_000})
 * hottest(vitals.channels(), 5)
 *
 * @example
 * // Scoped to a branch's own channel
 * const hero = useBranch(cyre, {id: 'hero'})
 * useMetrics(hero, {channelId: 'next-slide'}).watch(console.log)
 */
export const useMetrics = (
  instance: CyreInstance | Branch = cyre,
  config: UseMetricsConfig = {}
): MetricsHook => {
  if (!instance) {
    sensor.error(
      'useMetrics requires a valid instance parameter',
      'use-metrics',
      'validation',
      'error'
    )
    throw new Error('useMetrics requires a valid instance parameter')
  }

  if (
    typeof instance.path !== 'function' ||
    typeof instance.action !== 'function'
  ) {
    sensor.error(
      'Invalid instance - missing required methods (path, action)',
      'use-metrics',
      'validation',
      'error'
    )
    throw new Error('Invalid instance - missing required methods')
  }

  const {interval = 0, slowMs = 100} = config

  const path = instance.path() || ''
  const isBranch = path !== ''

  const channelId = config.channelId
    ? isBranch
      ? `${path}/${config.channelId}`
      : config.channelId
    : undefined

  const subscriptions = new Set<() => void>()

  const track = (unsubscribe: () => void): (() => void) => {
    let active = true
    const wrapped = (): void => {
      if (!active) return
      active = false
      subscriptions.delete(wrapped)
      unsubscribe()
    }
    subscriptions.add(wrapped)
    return wrapped
  }

  const reportCallbackError = (error: unknown): void => {
    sensor.error(
      `useMetrics callback threw: ${error}`,
      'use-metrics',
      channelId || 'system',
      'error'
    )
  }

  const get = (): MetricsSnapshot => cyre.getMetrics(channelId)

  const channels = (): ChannelMetricsRow[] => {
    const rows = metricsStream.channels()
    return channelId ? rows.filter(row => row.id === channelId) : rows
  }

  const watch = (
    callback: (metrics: MetricsSnapshot) => void
  ): (() => void) => {
    if (typeof callback !== 'function') {
      sensor.error(
        'useMetrics.watch requires a callback function',
        'use-metrics',
        channelId || 'system',
        'error'
      )
      return () => {}
    }

    // The eager delivery below is not counted against `interval`, so the
    // first real tick always arrives.
    let lastDelivered = -Infinity
    const unsubscribe = metricsStream.subscribe('tick', ({sample}) => {
      if (interval > 0 && sample.t - lastDelivered < interval * 0.9) return
      lastDelivered = sample.t
      try {
        callback(get())
      } catch (error) {
        reportCallbackError(error)
      }
    })

    // Eager first delivery so a UI has something to render immediately
    try {
      callback(get())
    } catch (error) {
      reportCallbackError(error)
    }

    return track(unsubscribe)
  }

  const on: MetricsHook['on'] = (event, callback) => {
    if (typeof callback !== 'function') {
      sensor.error(
        'useMetrics.on requires a callback function',
        'use-metrics',
        channelId || 'system',
        'error'
      )
      return () => {}
    }

    const unsubscribe = metricsStream.subscribe(
      event,
      payload => {
        if (channelId) {
          const id = (payload as {channelId?: string}).channelId
          if (id !== undefined && id !== channelId) return
        }
        callback(payload)
      },
      {thresholdMs: slowMs}
    )

    return track(unsubscribe)
  }

  const stop = (): void => {
    for (const unsubscribe of Array.from(subscriptions)) unsubscribe()
  }

  return {
    channelId,
    get,
    watch,
    on,
    series: metricsStream.series,
    channels,
    stop
  }
}

export {findUnused, findNeverExecuted, hottest, slowest, errorProne}

export default useMetrics
