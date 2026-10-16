// src/components/cyre-cloud.ts
// Built-in cloud sources for useCloud - poll() and supabaseLive()

import type {CloudContext, CloudPullOptions, CloudSource} from '../types/cloud'
import {TimeKeeper} from './cyre-timekeeper'
import {metricsState} from '../context/metrics-state'

/*

      C.Y.R.E - C.L.O.U.D - S.O.U.R.C.E.S

      Zero-dependency adapters that plug into useCloud:
      - poll(): pulls on a TimeKeeper interval (so breathing stretches it,
        cyre.pause() pauses it, metrics see it). Single-flight, abortable,
        exponential backoff with jitter on failure, ETag/304 for URLs,
        skips while the system is recuperating or the browser tab is
        hidden, and unwraps Supabase's {data, error} query results.
      - supabaseLive(): Supabase Realtime (postgres_changes, broadcast,
        presence) over a client YOU pass in - Cyre never imports
        @supabase/supabase-js. The client may also be a (sync or async)
        getter, and `channel`/`filter` may be getters too: all are read
        on every connect, so a source created once at boot can follow
        "whatever project is open now" through pause() + resume(). The Supabase client already reconnects and
        refreshes auth, so this adapter only mirrors its status and asks
        the hook to resync on every (re)subscribe, because Realtime does
        not replay changes missed while disconnected.

      Per-source runtime values (in-flight promise, etag, failure count)
      live in ctx.scratch, which is owned by context/cloud-state.ts.

*/

// ---------------------------------------------------------------- poll

export interface PollOptions {
  /** Interval in ms */
  every: number
  /**
   * What to pull: a URL (fetched with the global fetch), or a function -
   * e.g. () => supabase.from('orders').select('*'). Functions receive the
   * source's AbortSignal.
   */
  fetch: string | ((signal: AbortSignal) => Promise<unknown> | unknown)
  /** RequestInit for URL fetches (headers, method, ...) */
  init?: RequestInit
  /** Parse a URL Response (default: res.json()) */
  parse?: (res: Response) => Promise<unknown>
  /** Send If-None-Match with the last ETag and skip 304s (URL only, default true) */
  etag?: boolean
  /** Pull once immediately on connect (default true) */
  immediate?: boolean
  /** Upper bound for failure backoff in ms (default 60s) */
  maxBackoff?: number
  /** Skip scheduled pulls while the browser tab is hidden (default true) */
  pauseWhenHidden?: boolean
  /** Skip scheduled pulls while Cyre is recuperating under stress (default true) */
  respectBreathing?: boolean
}

interface PollScratch {
  inFlight?: Promise<void>
  // The connection the in-flight pull belongs to - a pull started before a
  // pause() is abandoned (its signal aborted), and a fetch function that
  // ignores the signal may never settle, so it must not block pulls on the
  // NEXT connection after resume()
  inFlightSignal?: AbortSignal
  etag?: string
  failures?: number
  backoffUntil?: number
}

// Supabase query builders resolve to {data, error, count, status, statusText}
// instead of throwing - unwrap that shape so handlers get the rows
const unwrapResult = (result: unknown): unknown => {
  if (
    result &&
    typeof result === 'object' &&
    'data' in (result as object) &&
    'error' in (result as object)
  ) {
    const {data, error} = result as {data: unknown; error: unknown}
    if (error) {
      const message =
        typeof error === 'object' && error && 'message' in error
          ? String((error as {message: unknown}).message)
          : String(error)
      throw new Error(message)
    }
    return data
  }
  return result
}

const isTabHidden = (): boolean =>
  typeof document !== 'undefined' && (document as Document).hidden === true

export const poll = (options: PollOptions): CloudSource => {
  if (!options || !(options.every > 0)) {
    throw new Error('poll() requires `every` (ms) greater than 0')
  }
  if (typeof options.fetch !== 'string' && typeof options.fetch !== 'function') {
    throw new Error('poll() requires `fetch` - a URL or a function')
  }

  const maxBackoff = options.maxBackoff ?? 60_000
  const useEtag = options.etag !== false

  const pullOnce = async (ctx: CloudContext): Promise<void> => {
    const s = ctx.scratch as PollScratch
    try {
      let data: unknown

      if (typeof options.fetch === 'string') {
        if (typeof fetch !== 'function') {
          throw new Error('global fetch is not available in this runtime')
        }
        const headers = new Headers(options.init?.headers)
        if (useEtag && s.etag) headers.set('If-None-Match', s.etag)

        const res = await fetch(options.fetch, {
          ...options.init,
          headers,
          signal: ctx.signal
        })

        if (res.status === 304) {
          s.failures = 0
          s.backoffUntil = 0
          ctx.status('live')
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

        if (useEtag) s.etag = res.headers.get('etag') || undefined
        data = options.parse ? await options.parse(res) : await res.json()
      } else {
        data = unwrapResult(await options.fetch(ctx.signal))
      }

      if (ctx.signal.aborted) return

      s.failures = 0
      s.backoffUntil = 0
      ctx.status('live')
      await ctx.emit(data, {event: 'poll'})
    } catch (error) {
      if (ctx.signal.aborted) return // paused/torn down mid-request - not a failure

      const failures = (s.failures || 0) + 1
      const jitter = 0.8 + Math.random() * 0.4
      s.failures = failures
      s.backoffUntil =
        Date.now() +
        Math.min(maxBackoff, options.every * 2 ** (failures - 1)) * jitter
      ctx.status('retrying', error)
    }
  }

  const pull = (ctx: CloudContext, pullOptions?: CloudPullOptions): Promise<void> => {
    if (ctx.signal.aborted) return Promise.resolve()

    const s = ctx.scratch as PollScratch
    // Single-flight: an overlapping pull shares the one already running on
    // this same connection
    if (s.inFlight && s.inFlightSignal === ctx.signal) return s.inFlight

    if (!pullOptions?.force) {
      if (s.backoffUntil && Date.now() < s.backoffUntil) return Promise.resolve()
      if (options.pauseWhenHidden !== false && isTabHidden()) {
        return Promise.resolve()
      }
      if (
        options.respectBreathing !== false &&
        metricsState.get().breathing.isRecuperating
      ) {
        return Promise.resolve()
      }
    }

    const current = pullOnce(ctx).finally(() => {
      if (s.inFlight === current) {
        s.inFlight = undefined
        s.inFlightSignal = undefined
      }
    })
    s.inFlight = current
    s.inFlightSignal = ctx.signal
    return current
  }

  return {
    kind: 'poll',
    pull,
    connect: ctx => {
      const timerId = `cloud-${ctx.id}-poll`
      ctx.status('connecting')

      if (options.immediate !== false) void pull(ctx, {force: true})

      TimeKeeper.keep(
        options.every,
        async () => {
          await pull(ctx)
        },
        true,
        timerId
      )

      // Catch up as soon as a hidden tab becomes visible again
      const onVisible = (): void => {
        if (!isTabHidden()) void pull(ctx)
      }
      const canListen =
        typeof document !== 'undefined' &&
        typeof document.addEventListener === 'function'
      if (canListen && options.pauseWhenHidden !== false) {
        document.addEventListener('visibilitychange', onVisible)
      }

      return () => {
        TimeKeeper.forget(timerId)
        if (canListen) document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }
}

// ------------------------------------------------------- supabaseLive

/**
 * The few Supabase client methods this adapter uses - structural, no
 * import. Method syntax (not property arrow types) on purpose: method
 * parameters are checked bivariantly, so supabase-js's overloaded
 * RealtimeChannel.on('postgres_changes' | 'broadcast' | ..., ...) and its
 * REALTIME_SUBSCRIBE_STATES enum stay assignable to these plain-string
 * signatures - a real SupabaseClient passes without a cast.
 */
export interface SupabaseLikeChannel {
  on(
    type: string,
    filter: Record<string, unknown>,
    callback: (payload: any) => void
  ): SupabaseLikeChannel
  subscribe(callback?: (status: string, error?: Error) => void): unknown
  presenceState?(): unknown
}

export interface SupabaseLikeClient {
  channel(name: string, options?: Record<string, unknown>): SupabaseLikeChannel
  removeChannel(channel: SupabaseLikeChannel): unknown
}

/**
 * The client itself, or a getter for it - sync or async, called on every
 * connect. A getter lets a source be created at boot (before cyre.lock())
 * while the client is still being configured/created lazily; returning
 * null/undefined means "not configured" and leaves the source idle.
 */
export type SupabaseClientInput =
  | SupabaseLikeClient
  | (() =>
      | SupabaseLikeClient
      | null
      | undefined
      | Promise<SupabaseLikeClient | null | undefined>)

/** A fixed value, or a getter read on every connect */
export type LiveValue<T> = T | (() => T)

const readLive = <T>(value: LiveValue<T>): T =>
  typeof value === 'function' ? (value as () => T)() : value

/** One table of a multi-table source (`tables`) - the same fields as the single-table options */
export interface SupabaseTableWatch {
  table: string
  /** default 'public' */
  schema?: string
  /** default '*' */
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  /** Row filter, e.g. 'project_id=eq.42' - or a getter read on every connect */
  filter?: LiveValue<string | undefined>
}

export interface SupabaseLiveOptions {
  /**
   * Realtime channel name (default `cyre:<hook id>`). Like `filter`, may be
   * a getter - read on every connect, so pause() + resume() re-subscribes
   * for whatever it returns now (e.g. the project that's open now).
   */
  channel?: LiveValue<string | undefined>
  /** Passed as client.channel(name, {config}) - e.g. {broadcast: {self: true}} */
  config?: Record<string, unknown>
  /** postgres_changes: table to watch */
  table?: string
  /** postgres_changes: schema (default 'public') */
  schema?: string
  /** postgres_changes: '*' | 'INSERT' | 'UPDATE' | 'DELETE' (default '*') */
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  /** postgres_changes: row filter, e.g. 'store_id=eq.42' - or a getter read on every connect */
  filter?: LiveValue<string | undefined>
  /**
   * postgres_changes on several tables over ONE Realtime channel (one join instead of one per table). Every change
   * carries meta.table, so a `to` function can route each table to its own channel (and its own debounce). Can be
   * combined with `table`.
   */
  tables?: ReadonlyArray<SupabaseTableWatch>
  /** broadcast event name(s) to receive ('*' for all) */
  broadcast?: string | string[]
  /** Emit presenceState() on every presence sync */
  presence?: boolean
}

export const supabaseLive = (
  client: SupabaseClientInput,
  options: SupabaseLiveOptions
): CloudSource => {
  if (
    !client ||
    (typeof client !== 'function' && typeof client.channel !== 'function')
  ) {
    throw new Error(
      'supabaseLive() requires a Supabase client (createClient(...)) or a getter that returns one'
    )
  }
  if (
    !options ||
    (!options.table && !options.tables?.length && !options.broadcast && !options.presence)
  ) {
    throw new Error(
      'supabaseLive() needs at least one of `table`, `tables`, `broadcast` or `presence`'
    )
  }

  // The single `table` option and every `tables` entry, as one list
  const watches: ReadonlyArray<SupabaseTableWatch> = [
    ...(options.table
      ? [{table: options.table, schema: options.schema, event: options.event, filter: options.filter}]
      : []),
    ...(options.tables || [])
  ]

  // Build and subscribe one Realtime channel on an already-resolved client
  const subscribeChannel = (
    resolved: SupabaseLikeClient,
    ctx: CloudContext
  ): SupabaseLikeChannel => {
    const name = readLive(options.channel) || `cyre:${ctx.id}`
    const channel = resolved.channel(
      name,
      options.config ? {config: options.config} : undefined
    )

    for (const watch of watches) {
      const filter = watch.filter === undefined ? undefined : readLive(watch.filter)
      channel.on(
        'postgres_changes',
        {
          event: watch.event || '*',
          schema: watch.schema || 'public',
          table: watch.table,
          ...(filter ? {filter} : {})
        },
        change => {
          void ctx.emit(change, {event: change?.eventType, table: watch.table})
        }
      )
    }

    if (options.broadcast) {
      const events = Array.isArray(options.broadcast)
        ? options.broadcast
        : [options.broadcast]
      for (const event of events) {
        channel.on('broadcast', {event}, message => {
          void ctx.emit(message?.payload, {event: message?.event ?? event})
        })
      }
    }

    if (options.presence) {
      channel.on('presence', {event: 'sync'}, () => {
        void ctx.emit(channel.presenceState?.(), {event: 'presence'})
      })
    }

    channel.subscribe((status, error) => {
      if (ctx.signal.aborted) return

      switch (status) {
        case 'SUBSCRIBED':
          ctx.status('live')
          // Initial snapshot on first subscribe, gap-fill on every rejoin
          void ctx.resync()
          break
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          ctx.status('retrying', error || new Error(`Supabase ${status}`))
          break
        case 'CLOSED':
          // Not closed by us (signal not aborted) - supabase-js rejoins
          // when its socket reconnects
          ctx.status('retrying', new Error('Supabase channel closed'))
          break
      }
    })

    return channel
  }

  return {
    kind: 'supabase',
    connect: ctx => {
      ctx.status('connecting')

      // This connection's Realtime channel once the client has resolved -
      // a per-connection transport handle, released by the cleanup below
      let channel: SupabaseLikeChannel | undefined
      let owner: SupabaseLikeClient | undefined

      const open = (resolved: SupabaseLikeClient | null | undefined): void => {
        if (ctx.signal.aborted) return // paused/forgotten while the client resolved
        if (!resolved) {
          ctx.status('idle') // no client configured - nothing to connect to
          return
        }
        owner = resolved
        channel = subscribeChannel(resolved, ctx)
      }

      try {
        const input = typeof client === 'function' ? client() : client
        if (input && typeof (input as Promise<unknown>).then === 'function') {
          ;(input as Promise<SupabaseLikeClient | null | undefined>).then(
            open,
            error => {
              if (!ctx.signal.aborted) ctx.status('retrying', error)
            }
          )
        } else {
          open(input as SupabaseLikeClient | null | undefined)
        }
      } catch (error) {
        ctx.status('retrying', error)
      }

      return () => {
        if (!channel || !owner) return
        try {
          const removed = owner.removeChannel(channel)
          if (removed && typeof (removed as Promise<unknown>).catch === 'function') {
            ;(removed as Promise<unknown>).catch(() => undefined)
          }
        } catch {
          // already gone
        }
        channel = undefined
        owner = undefined
      }
    }
  }
}
