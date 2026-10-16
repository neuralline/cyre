// src/context/system-monitor.ts
// Real system load sampling for the breathing/stress regulation system

import type {SystemMetrics} from '../types/system'

/*

      C.Y.R.E - S.Y.S.T.E.M - M.O.N.I.T.O.R

      Feeds context/metrics-state.ts's breathing authority with real
      readings instead of the placeholder zeros updateBreathingFromMetrics()
      used to hardcode. Every number here is cheap to produce and meant to
      be sampled once per second (the breathing tick's own cadence) -
      nothing here is meant to run per-call, that's exactly the mistake
      that made call-rate tracking look expensive before (see
      context/state.ts's callTracker for how that's solved separately,
      with a bare counter increment on the hot path instead).

      - cpu: % of wall-clock time this process spent on-CPU since the last
        sample, via process.cpuUsage() deltas. Deliberately NOT divided by
        core count - Cyre's own dispatch path is single-threaded, so "is
        the main thread busy" is what actually matters for backpressure
        here, not aggregate multi-core system load.
      - memory: resident set size as a % of the memory this process can
        still get (process.availableMemory()/constrainedMemory(), which
        respect container limits) - see sampleMemoryPercent() below. No
        'os' import needed, so this file stays free of any Node-builtin
        import and safe to include in the browser bundle - same reasoning
        behind cyre-timekeeper.ts's TimerEnvironment feature checks.
      - eventLoop: measured lag (ms) of a single setTimeout(fn, 0) round
        trip - the standard cheap proxy for "how backed up is the event
        loop/task queue right now". setTimeout over Node's setImmediate so
        the exact same code path runs in both Node and the browser.

      cpu/memory fall back to 0 outside Node (neither is meaningfully
      observable from browser JS anyway); eventLoop lag works in both.

*/

const isNode = typeof process !== 'undefined' && !!process.versions?.node

// Monitor-internal bookkeeping (the previous absolute cpuUsage snapshot and
// when it was taken). This mirrors cyre-timekeeper.ts's own QuartzEngine
// fields (lastTickTime etc.), which likewise live as plain module state
// rather than going through context/state - it's sampling-loop control
// data that nothing outside this file ever needs to read, not
// application-wide state.
let previousCpuUsage: {user: number; system: number} | null = null
let previousCpuSampleTime = 0

const sampleCpuPercent = (): number => {
  if (!isNode || typeof process.cpuUsage !== 'function') return 0

  const now = Date.now()
  const diff = previousCpuUsage
    ? process.cpuUsage(previousCpuUsage)
    : process.cpuUsage()
  const elapsedMs = previousCpuUsage ? now - previousCpuSampleTime : 0

  previousCpuUsage = process.cpuUsage()
  previousCpuSampleTime = now

  if (elapsedMs <= 0) return 0

  const cpuMs = (diff.user + diff.system) / 1000 // microseconds -> ms
  return Math.min(100, (cpuMs / elapsedMs) * 100)
}

// FIX (v4.7.2): this used to report heapUsed / heapTotal. V8 grows
// heapTotal lazily, so that ratio sits at 70-95% on a perfectly healthy
// process - against the default maxMemory limit it pinned memory stress at
// 1.0 permanently (combined stress ~0.5 at idle, one CPU spike away from
// recuperation). It now reports resident memory against what the process
// can actually still get: availableMemory() (Node >= 20.13/22, already
// respects container/cgroup limits), else constrainedMemory() (a cgroup
// limit, when one is set), else 0 - "unknown" rather than a false alarm.
// Both are plain `process` methods, so this file still needs no Node
// builtin import and stays browser-safe.
const sampleMemoryPercent = (): number => {
  if (!isNode || typeof process.memoryUsage !== 'function') return 0

  const proc = process as NodeJS.Process & {
    availableMemory?: () => number
    constrainedMemory?: () => number | undefined
  }
  const rss =
    typeof process.memoryUsage.rss === 'function'
      ? process.memoryUsage.rss()
      : process.memoryUsage().rss

  const available =
    typeof proc.availableMemory === 'function' ? proc.availableMemory() : 0
  if (available > 0) {
    return Math.min(100, (rss / (rss + available)) * 100)
  }

  const constrained =
    typeof proc.constrainedMemory === 'function'
      ? proc.constrainedMemory() || 0
      : 0
  // An unconstrained cgroup reports a huge sentinel (~2^63) - ignore it
  if (constrained > 0 && constrained < Number.MAX_SAFE_INTEGER) {
    return Math.min(100, (rss / constrained) * 100)
  }

  return 0
}

const sampleEventLoopLagMs = (): Promise<number> => {
  const start = Date.now()
  return new Promise<number>(resolve => {
    setTimeout(() => resolve(Math.max(0, Date.now() - start)), 0)
  })
}

export const systemMonitor = {
  /**
   * Take one real reading of process CPU%, heap%, and event-loop lag.
   * Cheap enough to call once per second (the breathing tick's cadence) -
   * not intended to be called per cyre.call().
   */
  sample: async (): Promise<SystemMetrics> => {
    const cpu = sampleCpuPercent()
    const memory = sampleMemoryPercent()
    const eventLoop = await sampleEventLoopLagMs()

    return {
      cpu,
      memory,
      eventLoop,
      isOverloaded: cpu >= 90 || memory >= 90 || eventLoop >= 200
    }
  }
}
