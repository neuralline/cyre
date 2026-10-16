// src/types/cloud.ts
// Types for useCloud - live and polled cloud data sources feeding channels

import type {ActionPayload, CyreResponse, IO} from './core'

/*

      C.Y.R.E - C.L.O.U.D - T.Y.P.E.S

      A cloud source owns ONE connection to something outside the process
      (an HTTP endpoint, a Supabase Realtime channel, any SDK) and turns
      whatever arrives into ordinary cyre.call()s. The source never talks
      to handlers directly - every message goes through a channel, so all
      existing talents (schema, transform, detectChanges, throttle,
      debounce, buffer) apply to cloud data unchanged.

*/

/** Connection lifecycle of a cloud source */
export type CloudStatus =
  | 'idle' // registered, not started (autoStart: false)
  | 'connecting' // connect() called, nothing received yet
  | 'live' // connected / last pull succeeded
  | 'retrying' // transport error - the source (or its SDK) is retrying
  | 'paused' // paused via hook.pause() or cyre.pause()
  | 'stopped' // torn down

/** Extra information a source attaches to each message */
export interface CloudMeta {
  /**
   * What kind of message this is - used by `to` map routing.
   * poll: 'poll', resync: 'resync', Supabase postgres_changes: 'INSERT' |
   * 'UPDATE' | 'DELETE', Supabase broadcast: the broadcast event name,
   * Supabase presence: 'presence'. Custom sources choose their own.
   */
  event?: string
  [key: string]: unknown
}

/** Everything a source gets when it is connected */
export interface CloudContext {
  /** Global channel id of the useCloud hook that owns this source */
  id: string
  /** Aborted when the source is paused or torn down - pass it to fetch() */
  signal: AbortSignal
  /** Per-source scratch space, kept in context/cloud-state.ts */
  scratch: Record<string, unknown>
  /** Deliver one message into Cyre (routed through `to`, or the hook's own channel) */
  emit: (payload: ActionPayload, meta?: CloudMeta) => Promise<CyreResponse>
  /** Report connection state - an error moves the source to 'retrying' */
  status: (status: CloudStatus, error?: unknown) => void
  /** Run the hook's `resync` source once (no-op when none is configured) */
  resync: () => Promise<void>
}

/** Options for a one-off pull */
export interface CloudPullOptions {
  /** Ignore backoff / recuperation / hidden-tab skipping */
  force?: boolean
}

/**
 * A cloud source. Build your own for any SDK - connect() wires the
 * transport up and returns a cleanup function:
 *
 *   const mqttSource: CloudSource = {
 *     kind: 'mqtt',
 *     connect: ctx => {
 *       const off = client.subscribe('sensors/#', msg => ctx.emit(msg))
 *       ctx.status('live')
 *       return off
 *     }
 *   }
 */
export interface CloudSource {
  kind: string
  connect: (ctx: CloudContext) => (() => void) | void
  /** One-shot pull - present on pull-capable sources (poll). Used by refresh() and resync. */
  pull?: (ctx: CloudContext, options?: CloudPullOptions) => Promise<void>
}

/** Function form of `resync` - see UseCloudConfig.resync */
export type CloudResync = (signal: AbortSignal) => unknown | Promise<unknown>

/** Where incoming messages go */
export type CloudRoute =
  | string
  | Partial<Record<string, string>>
  | ((payload: ActionPayload, meta: CloudMeta) => string | undefined)

/**
 * useCloud config - a normal channel config (exactly what cyre.action()
 * takes) plus where the data comes from.
 */
export interface UseCloudConfig extends Omit<IO, 'id'> {
  id?: string
  /** The live or polled source - poll(), supabaseLive(), or your own */
  source: CloudSource
  /**
   * Run on every (re)connect of a live source - the initial snapshot, then
   * gap-filling after a disconnect (Supabase Realtime does not replay
   * missed changes). Either a pull-capable source (usually a poll()), or a
   * plain function: its result is delivered as a 'resync' message (route
   * it with `to: {resync: ...}`); returning undefined delivers nothing,
   * for a resync that does its own work (e.g. "reload the member list").
   */
  resync?: CloudSource | CloudResync
  /**
   * Route messages into existing channels instead of (or as well as) this
   * hook's own channel: a channel id, a map keyed by CloudMeta.event (with
   * an optional `default` key), or a function. Unmatched messages go to
   * this hook's own channel. Routed messages run the TARGET channel's
   * talents, not this hook's.
   */
  to?: CloudRoute
  /** Connect immediately (default true). With false, call resume() to start. */
  autoStart?: boolean
}

/** Snapshot of a cloud source - what status() and the status channel report */
export interface CloudSnapshot {
  id: string
  kind: string
  status: CloudStatus
  connectedAt?: number
  lastMessageAt?: number
  lastSyncAt?: number
  messageCount: number
  errorCount: number
  lastError?: string
}

/** What useCloud returns - the useCyre verbs plus source controls */
export interface CloudHook<TPayload = ActionPayload> {
  /** Branch path (empty string for root) */
  path: string
  /** Global id of the hook's own channel */
  id: string
  /** Global id of the status channel - cyre.on() it to react to connection changes */
  statusId: string
  /** Inject a payload into the hook's own channel (e.g. an optimistic update) */
  call: (payload?: TPayload) => Promise<CyreResponse>
  /** Handle messages arriving on the hook's own channel */
  on: (
    handler: (payload: TPayload) => unknown
  ) => {ok: boolean; message: string; unsubscribe?: () => boolean}
  /** Current channel configuration */
  get: () => IO | undefined
  /** Disconnect the source and remove its channels */
  forget: () => boolean
  /** Alias of forget() - matches useGroup/useBranch */
  destroy: () => boolean
  /** Disconnect (cancels in-flight requests) - resume() reconnects */
  pause: () => void
  /** Connect / reconnect */
  resume: () => void
  /** Pull now - the source itself if it can pull (poll), otherwise the resync source */
  refresh: () => Promise<void>
  /** Current connection snapshot */
  status: () => CloudSnapshot
  getStats: () => CloudSnapshot & {
    globalId: string
    localId: string
    path: string
    isBranch: boolean
  }
}
