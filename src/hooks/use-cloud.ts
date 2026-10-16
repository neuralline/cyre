// src/hooks/use-cloud.ts
// useCloud - live and polled cloud data feeding Cyre channels

import type {ActionPayload, CyreResponse, EventHandler, IO} from '../types/core'
import type {Branch} from '../types/hooks'
import type {
  CloudContext,
  CloudHook,
  CloudMeta,
  CloudRoute,
  CloudSnapshot,
  CloudStatus,
  UseCloudConfig
} from '../types/cloud'
import {cyre, CyreInstance} from '../app'
import {io} from '../context/state'
import {cloudState, type CloudEntry} from '../context/cloud-state'
import {getHandlers} from '../components/cyre-on'
import {sensor} from '../components/sensor'

/*

      C.Y.R.E - U.S.E - C.L.O.U.D

      Same shape as useCyre(instance, config): the config is a normal
      channel config (anything cyre.action() takes) plus a `source`, and
      the hook exposes the same verbs (call/on/get/forget/getStats) plus
      the source controls (pause/resume/refresh/status).

      Flow: source (poll / supabaseLive / custom)
              → ctx.emit(payload, meta)
              → `to` routing → cyre.call(<target channel>, payload)
              → that channel's talents → its .on() handlers

      Nothing here bypasses the core - every message is an ordinary
      cyre.call(), so existing channels can receive cloud data without any
      change. Connection state is published on `<id>/status` (only when
      something listens), and the source is registered in
      context/cloud-state.ts so cyre.forget()/pause()/resume()/clear() and
      getMetrics() all see it.

        example use:
        const orders = useCloud(cyre, {
          id: 'orders/live',
          source: supabaseLive(supabase, {table: 'orders', filter: 'store_id=eq.42'}),
          resync: poll({every: 60_000, fetch: () => supabase.from('orders').select('*')}),
          to: {INSERT: 'orders/created', UPDATE: 'orders/updated', DELETE: 'orders/removed', resync: 'orders/snapshot'}
        })

*/

const resolveTarget = (
  route: CloudRoute | undefined,
  payload: ActionPayload,
  meta: CloudMeta
): string | undefined => {
  if (!route) return undefined
  if (typeof route === 'string') return route
  if (typeof route === 'function') return route(payload, meta)
  return (meta.event && route[meta.event]) || route.default
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const useCloud = <TPayload = ActionPayload>(
  instance: CyreInstance | Branch,
  config: UseCloudConfig
): CloudHook<TPayload> => {
  if (
    !instance ||
    typeof instance.path !== 'function' ||
    typeof instance.action !== 'function'
  ) {
    sensor.error('useCloud requires a valid cyre or branch instance', 'use-cloud')
    throw new Error('useCloud requires a valid cyre or branch instance')
  }
  if (!config?.source || typeof config.source.connect !== 'function') {
    sensor.error('useCloud requires a `source` with connect()', 'use-cloud')
    throw new Error('useCloud requires a `source` - poll(), supabaseLive() or a custom CloudSource')
  }

  const {source, resync, to, autoStart = true, ...channelFields} = config

  const path = instance.path() || ''
  const localId = config.id || `cloud-${crypto.randomUUID().slice(0, 8)}`
  const channelId = path ? `${path}/${localId}` : localId
  const statusLocalId = `${localId}/status`
  const statusId = path ? `${path}/${statusLocalId}` : statusLocalId
  const isBranch = path !== ''

  // Same registration path as useCyre - instance.action() handles branch prefixing
  const register = (channelConfig: IO): {ok: boolean; message: string} =>
    isBranch
      ? (instance as Branch).action(channelConfig)
      : (instance as CyreInstance).action(channelConfig)

  // A previous useCloud with the same id - disconnect it before taking over
  cloudState.get(channelId)?.control.teardown()

  const registered = register({...channelFields, id: localId, localId, path} as IO)
  if (!registered.ok) {
    sensor.error(`useCloud channel creation failed: ${registered.message}`, 'use-cloud', localId)
    throw new Error(`useCloud channel creation failed: ${registered.message}`)
  }
  register({id: statusLocalId, localId: statusLocalId, path} as IO)

  // ------------------------------------------------------------ state

  const entry = (): CloudEntry | undefined => cloudState.get(channelId)

  const publishStatus = (): void => {
    if (getHandlers(statusId).length === 0) return // nobody listening - skip the call
    const snapshot = cloudState.snapshot(channelId)
    if (snapshot) void cyre.call(statusId, snapshot)
  }

  const recordError = (error: unknown): void => {
    const e = entry()
    if (!e) return
    e.errorCount++
    e.lastError = errorMessage(error)
    sensor.warn(`useCloud ${channelId}: ${e.lastError}`, 'use-cloud', channelId)
  }

  const setStatus = (status: CloudStatus, error?: unknown): void => {
    const e = entry()
    if (!e) return
    if (error !== undefined) recordError(error)
    const changed = e.status !== status
    if (changed) {
      e.status = status
      if (status === 'live') e.connectedAt = Date.now()
    }
    if (changed || error !== undefined) publishStatus()
  }

  // ---------------------------------------------------------- messages

  const dropped = (reason: string): Promise<CyreResponse> =>
    Promise.resolve({ok: false, payload: null, message: reason})

  const emit = (payload: ActionPayload, meta: CloudMeta = {}): Promise<CyreResponse> => {
    const e = entry()
    if (!e || !e.runtime.started) {
      // late message after pause/teardown
      return dropped(`useCloud ${channelId} is not connected`)
    }
    e.messageCount++
    e.lastMessageAt = Date.now()
    if (meta.event === 'resync') e.lastSyncAt = e.lastMessageAt

    const target = resolveTarget(to, payload, meta) || channelId
    return cyre.call(target, payload)
  }

  const makeContext = (mode: 'source' | 'resync'): CloudContext => {
    const e = entry()!
    return {
      id: channelId,
      signal: e.runtime.controller!.signal,
      scratch: mode === 'source' ? e.runtime.scratch : e.runtime.resyncScratch,
      emit:
        mode === 'source'
          ? emit
          : (payload, meta) => emit(payload, {...meta, event: 'resync'}),
      // A resync failure is recorded, but must not flip a live source's status
      status:
        mode === 'source'
          ? setStatus
          : (_status, error) => {
              if (error !== undefined) {
                recordError(error)
                publishStatus()
              }
            },
      resync: runResync
    }
  }

  async function runResync(): Promise<void> {
    const e = entry()
    if (!resync || !e?.runtime.started) return

    // Function form: run it, deliver whatever it returns as a 'resync' message
    if (typeof resync === 'function') {
      const signal = e.runtime.controller!.signal
      try {
        const data = await resync(signal)
        if (data !== undefined && !signal.aborted) {
          await emit(data, {event: 'resync'})
        }
        if (!signal.aborted) cloudState.update(channelId, {lastSyncAt: Date.now()})
      } catch (error) {
        if (signal.aborted) return
        recordError(error)
        publishStatus()
      }
      return
    }

    if (resync.pull) await resync.pull(makeContext('resync'), {force: true})
  }

  // --------------------------------------------------------- lifecycle

  const start = (): void => {
    const e = entry()
    if (!e || e.runtime.started) return

    e.runtime.started = true
    e.runtime.controller = new AbortController()
    setStatus('connecting')

    try {
      const cleanup = source.connect(makeContext('source'))
      e.runtime.cleanup = typeof cleanup === 'function' ? cleanup : undefined
    } catch (error) {
      setStatus('retrying', error)
    }
  }

  const stop = (status: CloudStatus): void => {
    const e = entry()
    if (!e) return
    if (e.runtime.started) {
      e.runtime.started = false
      e.runtime.controller?.abort() // cancels in-flight fetches
      try {
        e.runtime.cleanup?.()
      } catch (error) {
        recordError(error)
      }
      e.runtime.cleanup = undefined
    }
    setStatus(status)
  }

  const refresh = async (): Promise<void> => {
    const e = entry()
    if (!e?.runtime.started) return
    if (source.pull) {
      await source.pull(makeContext('source'), {force: true})
    } else {
      await runResync()
    }
  }

  const teardown = (): void => {
    stop('stopped')
    cloudState.forget(channelId)
  }

  cloudState.set({
    id: channelId,
    kind: source.kind,
    status: 'idle',
    createdAt: Date.now(),
    messageCount: 0,
    errorCount: 0,
    runtime: {started: false, scratch: {}, resyncScratch: {}},
    control: {
      pause: () => stop('paused'),
      resume: start,
      refresh,
      teardown
    }
  })

  if (autoStart) start()

  // -------------------------------------------------------------- hook

  const snapshot = (): CloudSnapshot =>
    cloudState.snapshot(channelId) || {
      id: channelId,
      kind: source.kind,
      status: 'stopped',
      messageCount: 0,
      errorCount: 0
    }

  const forget = (): boolean => {
    teardown()
    cyre.forget(statusId)
    return cyre.forget(channelId)
  }

  return {
    path,
    id: channelId,
    statusId,

    call: (payload?: TPayload) => cyre.call(channelId, payload),

    on: handler => cyre.on(channelId, handler as EventHandler),

    get: () => io.get(channelId),

    forget,
    destroy: forget,

    pause: () => stop('paused'),
    resume: start,
    refresh,
    status: snapshot,

    getStats: () => ({
      ...snapshot(),
      globalId: channelId,
      localId,
      path,
      isBranch
    })
  }
}

export default useCloud
