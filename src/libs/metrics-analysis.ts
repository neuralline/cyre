// src/libs/metrics-analysis.ts
// Pure analyzers over per-channel metrics rows (see context/metrics-stream.ts)

/*

      C.Y.R.E - M.E.T.R.I.C.S - A.N.A.L.Y.S.I.S

      Pure functions, no state, no timers: give them the rows from
      useMetrics().channels() (or a tick event) and get back the answer.
      Kept separate from the stream so they cost nothing unless called,
      and are trivial to test.

*/

import type {ChannelMetricsRow} from '../context/metrics-stream'

/**
 * Channels with no execution for at least `idleMs` (default 60s). Includes
 * channels that never executed at all - those are the strongest candidates
 * for dead registrations. Longest idle first.
 */
export const findUnused = (
  rows: ChannelMetricsRow[],
  options: {idleMs?: number; includeNeverExecuted?: boolean} = {}
): ChannelMetricsRow[] => {
  const {idleMs = 60_000, includeNeverExecuted = true} = options
  return rows
    .filter(
      row => row.idleMs >= idleMs && (includeNeverExecuted || !row.neverExecuted)
    )
    .sort((a, b) => b.idleMs - a.idleMs)
}

/** Channels that were registered but have never executed. */
export const findNeverExecuted = (
  rows: ChannelMetricsRow[]
): ChannelMetricsRow[] => rows.filter(row => row.neverExecuted)

/**
 * Busiest channels. `by: 'rate'` ranks by executions/sec over the last tick
 * window ("hot right now"), `'count'` by lifetime executions.
 */
export const hottest = (
  rows: ChannelMetricsRow[],
  count = 5,
  by: 'rate' | 'count' = 'rate'
): ChannelMetricsRow[] =>
  rows
    .slice()
    .sort((a, b) => b[by] - a[by])
    .slice(0, Math.max(0, count))

/**
 * Slowest channels. `'lastMs'` is the most recent execution, `'maxMs'` the
 * worst tick-sampled duration seen since the channel was first observed.
 */
export const slowest = (
  rows: ChannelMetricsRow[],
  count = 5,
  by: 'lastMs' | 'maxMs' = 'maxMs'
): ChannelMetricsRow[] =>
  rows
    .slice()
    .sort((a, b) => b[by] - a[by])
    .slice(0, Math.max(0, count))

/**
 * Channels whose errors / (executions + errors) meets `minRatio`
 * (default 0.05), highest ratio first.
 */
export const errorProne = (
  rows: ChannelMetricsRow[],
  options: {minRatio?: number; minErrors?: number} = {}
): Array<ChannelMetricsRow & {errorRatio: number}> => {
  const {minRatio = 0.05, minErrors = 1} = options
  return rows
    .map(row => ({
      ...row,
      errorRatio: row.errors / Math.max(1, row.count + row.errors)
    }))
    .filter(row => row.errors >= minErrors && row.errorRatio >= minRatio)
    .sort((a, b) => b.errorRatio - a.errorRatio)
}

/**
 * Channels most absorbed by protections - throttle + debounce + buffer
 * counts combined, highest first. These calls never reach `count`
 * (executions), so without this a heavily-throttled or -debounced channel
 * looked identical to an idle one anywhere that only reads execution
 * count/rate.
 */
export const mostGated = (
  rows: ChannelMetricsRow[],
  count = 5
): Array<ChannelMetricsRow & {gatedCount: number}> =>
  rows
    .map(row => ({
      ...row,
      gatedCount: row.throttleCount + row.debounceCount + row.bufferCount
    }))
    .filter(row => row.gatedCount > 0)
    .sort((a, b) => b.gatedCount - a.gatedCount)
    .slice(0, Math.max(0, count))
