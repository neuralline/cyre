// src/context/metrics-stream.ts
// Push-based metrics stream - events, live samples and a chart ring buffer.

/*

      C.Y.R.E - M.E.T.R.I.C.S - S.T.R.E.A.M

      cyre.getMetrics() is a pull-based snapshot, and useMetrics used to
      turn that into "live" by scheduling its own polling channel. This is
      the push side: subscribers are told when something happens instead
      of asking again.

      Cost model - the fast lane is what this library is built around, so
      nothing here adds work per call:
        - cyre.call() is untouched. Call-rate still comes from the bare
          callTracker counter, folded in by the breathing tick.
        - noteExecution() runs once per completed handler, right next to
          the io.touch() dispatch already does. With no slow-task
          subscriber the whole cost is one number comparison against
          Infinity.
        - noteError() runs only on the error path, which is already slow.
        - tick() piggybacks on the breathing tick (once per second, and it
          stretches under stress). It returns immediately when nobody is
          subscribed - no ring buffer writes, no per-channel diffing.

      While at least one subscriber exists, each tick records one flat
      sample into a fixed-size ring buffer (series()) for charts, diffs
      per-channel counters into rates (channels()), and pushes 'tick'.
      Per-channel max/avg durations are sampled at tick time, not exact:
      exact ones would need a write on every execution. Exact slow
      executions come from the 'slow-task' event instead.

      State lives here in context/ (same as sensor-state.ts), not inside
      the hook, so it stays app-wide and resettable.

*/

import {createStore} from './create-store'
import {io} from './state'

export interface MetricsSample {
  /** Epoch ms of the sample */
  t: number
  /** Combined system stress, 0..1 */
  stress: number
  cpu: number
  memory: number
  eventLoop: number
  callsPerSecond: number
  /** Current breathing interval in ms */
  breathingRate: number
  recuperating: boolean
}

export interface ChannelMetricsRow {
  id: string
  /** Lifetime executions */
  count: number
  /** Executions per second over the last tick window */
  rate: number
  /** Duration of the most recent execution, ms */
  lastMs: number
  /** Max of the tick-sampled durations since first seen, ms */
  maxMs: number
  errors: number
  /** ms since last execution (or since creation if never executed) */
  idleMs: number
  createdAt: number
  neverExecuted: boolean
  blocked: boolean
  /** Lifetime calls absorbed by throttle, allowed and rejected alike */
  throttleCount: number
  /** Lifetime calls that landed in a debounce window */
  debounceCount: number
  /** Lifetime calls that landed in a buffer window */
  bufferCount: number
}

export interface SlowTaskEvent {
  channelId: string
  durationMs: number
  t: number
}

export interface ChannelErrorEvent {
  channelId: string
  message: string
  durationMs: number
  t: number
}

export interface RecuperationEvent {
  recuperating: boolean
  stress: number
  t: number
}

export interface TickEvent {
  sample: MetricsSample
  channels: ChannelMetricsRow[]
}

export interface MetricsEventMap {
  tick: TickEvent
  'slow-task': SlowTaskEvent
  'channel-error': ChannelErrorEvent
  recuperation: RecuperationEvent
}

export type MetricsEventName = keyof MetricsEventMap

interface Listener {
  event: MetricsEventName
  callback: (payload: any) => void
  /** slow-task only: this listener's own threshold */
  thresholdMs: number
}

const DEFAULT_CAPACITY = 300

const listeners = createStore<Listener>()
let nextId = 0
let listenerCount = 0

// Lowest threshold across slow-task listeners; Infinity when none, so the
// hot-path comparison in noteExecution() is always false.
let slowMs = Infinity

let capacity = DEFAULT_CAPACITY
let ring: MetricsSample[] = []

interface ChannelTrack {
  count: number
  rate: number
  maxMs: number
}
const tracked = new Map<string, ChannelTrack>()
let lastTickAt = 0
let lastRecuperating = false
let latestChannels: ChannelMetricsRow[] = []

const recomputeSlowMs = (): void => {
  let min = Infinity
  for (const listener of listeners.getAll()) {
    if (listener.event === 'slow-task' && listener.thresholdMs < min) {
      min = listener.thresholdMs
    }
  }
  slowMs = min
}

const emit = <E extends MetricsEventName>(
  event: E,
  payload: MetricsEventMap[E]
): void => {
  for (const listener of listeners.getAll()) {
    if (listener.event !== event) continue
    try {
      listener.callback(payload)
    } catch {
      // A broken subscriber is the subscriber's problem, not the stream's.
    }
  }
}

const buildChannelRows = (now: number, elapsedSec: number): ChannelMetricsRow[] => {
  const rows: ChannelMetricsRow[] = []
  const seen = new Set<string>()

  for (const channel of io.getAll()) {
    const id = channel.id
    seen.add(id)

    const count = channel._executionCount || 0
    const lastMs = channel._executionDuration || 0
    const previous = tracked.get(id)
    const rate =
      previous && elapsedSec > 0
        ? Math.max(0, (count - previous.count) / elapsedSec)
        : previous?.rate || 0
    const maxMs = Math.max(previous?.maxMs || 0, lastMs)
    tracked.set(id, {count, rate, maxMs})

    const lastExec = channel._lastExecTime || 0
    const createdAt = channel._timeOfCreation || now
    rows.push({
      id,
      count,
      rate,
      lastMs,
      maxMs,
      errors: channel._errorCount || 0,
      idleMs: Math.max(0, now - (lastExec || createdAt)),
      createdAt,
      neverExecuted: count === 0,
      blocked: channel._isBlocked || false,
      throttleCount: channel._throttleCount || 0,
      debounceCount: channel._debounceCount || 0,
      bufferCount: channel._bufferCount || 0
    })
  }

  // Drop tracking for forgotten channels so this never grows unbounded
  if (tracked.size > seen.size) {
    for (const id of tracked.keys()) {
      if (!seen.has(id)) tracked.delete(id)
    }
  }

  return rows
}

export const metricsStream = {
  /**
   * Subscribe to one event. Returns an unsubscribe function - same shape as
   * sensorState.subscribe() and cyre.on()'s own unsubscribe.
   */
  subscribe: <E extends MetricsEventName>(
    event: E,
    callback: (payload: MetricsEventMap[E]) => void,
    options: {thresholdMs?: number} = {}
  ): (() => void) => {
    const id = `metrics-listener-${++nextId}`
    listeners.set(id, {
      event,
      callback,
      thresholdMs: options.thresholdMs ?? 100
    })
    listenerCount++
    if (event === 'slow-task') recomputeSlowMs()

    let active = true
    return () => {
      if (!active) return
      active = false
      listeners.forget(id)
      listenerCount--
      if (event === 'slow-task') recomputeSlowMs()
    }
  },

  /** True while anything is subscribed - the gate for all tick-side work */
  active: (): boolean => listenerCount > 0,

  count: (): number => listenerCount,

  /**
   * Hot-path hook, called once per completed handler by cyre-dispatch.
   * One comparison against a module-level number; Infinity when nobody
   * listens for slow tasks.
   */
  noteExecution: (channelId: string, durationMs: number): void => {
    if (durationMs > slowMs) {
      emit('slow-task', {channelId, durationMs, t: Date.now()})
    }
  },

  /** Error-path hook, called by cyre-dispatch when a handler throws */
  noteError: (channelId: string, message: string, durationMs: number): void => {
    if (listenerCount === 0) return
    emit('channel-error', {channelId, message, durationMs, t: Date.now()})
  },

  /**
   * Called by the breathing tick with the sample it just produced.
   * Returns immediately when nothing is subscribed.
   */
  tick: (sample: MetricsSample): void => {
    if (listenerCount === 0) return

    const elapsedSec = lastTickAt > 0 ? (sample.t - lastTickAt) / 1000 : 0
    lastTickAt = sample.t

    latestChannels = buildChannelRows(sample.t, elapsedSec)

    ring.push(sample)
    if (ring.length > capacity) ring.splice(0, ring.length - capacity)

    if (sample.recuperating !== lastRecuperating) {
      lastRecuperating = sample.recuperating
      emit('recuperation', {
        recuperating: sample.recuperating,
        stress: sample.stress,
        t: sample.t
      })
    }

    emit('tick', {sample, channels: latestChannels})
  },

  /**
   * Recent samples, oldest first - flat rows ready for a chart. Recorded
   * only while something is subscribed.
   */
  series: (last?: number): MetricsSample[] =>
    last !== undefined && last > 0 ? ring.slice(-last) : ring.slice(),

  /**
   * Per-channel rows. Uses the last tick's rates when available, otherwise
   * computes a one-off view (rates 0) so it also works before any tick.
   */
  channels: (): ChannelMetricsRow[] =>
    latestChannels.length > 0
      ? latestChannels.slice()
      : buildChannelRows(Date.now(), 0),

  /** Resize the ring buffer (default 300 samples, ~5 min at 1/sec) */
  configure: (options: {capacity?: number}): void => {
    if (options.capacity !== undefined && options.capacity > 0) {
      capacity = Math.floor(options.capacity)
      if (ring.length > capacity) ring.splice(0, ring.length - capacity)
    }
  },

  /** Drop every listener and all recorded data */
  clear: (): void => {
    listeners.clear()
    listenerCount = 0
    slowMs = Infinity
    ring = []
    tracked.clear()
    latestChannels = []
    lastTickAt = 0
    lastRecuperating = false
    capacity = DEFAULT_CAPACITY
  }
}

export default metricsStream
