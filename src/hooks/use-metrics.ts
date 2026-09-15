// src/hooks/use-metrics.ts
// useMetrics hook - watch cyre.getMetrics() the official way

/*

      C.Y.R.E - U.S.E - M.E.T.R.I.C.S

      cyre.getMetrics(channelId?) (app.ts, backed by
      context/metrics-state.ts) is a pull-based snapshot - correct for a
      one-off read, but "listen to and display" needs something that
      pushes fresh snapshots on its own. Rather than reaching for a bare
      setInterval, this schedules the polling as a real Cyre channel
      (interval + repeat, kicked off with one call - the same pattern
      every other recurring action in this codebase uses, e.g. an
      auto-animate loop). That gets the polling itself covered by cyre's
      own breathing/stress regulation for free: a metrics watcher that
      politely backs off under load instead of adding to it.

      Same isBranch handling as useCyre: given a Branch, the watch
      channel is registered on that branch (so branch.destroy() cleans it
      up automatically) and a channelId is resolved to that branch's own
      path; given the root cyre instance (the default), it's a plain
      root-level channel.

*/

import type {CyreInstance} from '../app'
import {cyre} from '../app'
import type {Branch} from '../types/hooks'
import type {
  ChannelMetricsResult,
  SystemMetricsResult
} from '../types/system'
import {sensor} from '../components/sensor'

export interface UseMetricsConfig {
  /** Watch one channel's metrics instead of the system-wide snapshot */
  channelId?: string
  /** Polling interval in ms while watching. Default 1000. */
  interval?: number
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
   * Start polling and receive a fresh snapshot every `interval` ms.
   * Returns a stop function. Calling watch() again while already
   * watching just returns another stop function for the same channel.
   */
  watch: (callback: (metrics: MetricsSnapshot) => void) => () => void
  /** Stop polling (idempotent - safe to call even if never started) */
  stop: () => void
}

/**
 * Watch cyre's own metrics - system-wide by default, or one channel.
 *
 * @example
 * const vitals = useMetrics(cyre, {interval: 500})
 * const stop = vitals.watch(m => renderStressGauge(m.system.stress))
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

  const {interval = 1000} = config

  const path =
    typeof instance.path === 'function' ? instance.path() || '' : ''
  const isBranch = path !== ''

  // Only the four methods actually used below - avoids fighting
  // TypeScript over Branch's and CyreInstance's slightly different
  // on()/call() return-type shapes, which don't intersect cleanly.
  interface WatchTarget {
    action: (config: {
      id: string
      interval?: number
      repeat?: boolean | number
    }) => {ok: boolean; message: string}
    on: (id: string, handler: (...args: any[]) => any) => unknown
    call: (id: string, payload?: any) => Promise<unknown>
    forget: (id: string) => boolean
  }

  const target = (isBranch ? instance : cyre) as unknown as WatchTarget

  const channelId = config.channelId
    ? isBranch
      ? `${path}/${config.channelId}`
      : config.channelId
    : undefined

  const watchId = `sys/metrics-watch-${
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36)
  }`

  let isWatching = false

  const get = (): MetricsSnapshot => cyre.getMetrics(channelId)

  const stop = (): void => {
    if (!isWatching) return
    target.forget(watchId)
    isWatching = false
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

    if (isWatching) return stop

    const created = target.action({id: watchId, interval, repeat: true})
    if (!created.ok) {
      sensor.error(
        `useMetrics failed to schedule watch channel: ${created.message}`,
        'use-metrics',
        channelId || 'system',
        'error'
      )
      return () => {}
    }

    target.on(watchId, () => {
      try {
        callback(get())
      } catch (error) {
        sensor.error(
          `useMetrics watch callback threw: ${error}`,
          'use-metrics',
          channelId || 'system',
          'error'
        )
      }
    })

    target.call(watchId)
    isWatching = true

    return stop
  }

  return {channelId, get, watch, stop}
}

export default useMetrics
