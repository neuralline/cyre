// src/context/cloud-state.ts
// State for useCloud's live/polled cloud sources

import type {CloudSnapshot, CloudStatus} from '../types/cloud'
import {createStore} from './create-store'

/*

      C.Y.R.E - C.L.O.U.D - S.T.A.T.E

      One entry per useCloud hook, keyed by its global channel id - the
      connection status, counters, and the runtime handles (abort
      controller, transport cleanup, per-source scratch) live here rather
      than inside the hook's closure, so app.ts (forget/pause/resume/clear)
      and metrics can see and control every source app-wide, the same way
      scheduleState/orchestrationState expose their registries.

*/

export interface CloudRuntime {
  started: boolean
  controller?: AbortController
  cleanup?: () => void
  scratch: Record<string, unknown>
  resyncScratch: Record<string, unknown>
}

export interface CloudControl {
  pause: () => void
  resume: () => void
  refresh: () => Promise<void>
  /** Disconnect and drop this entry - does NOT forget the channels (app.ts's forget does that) */
  teardown: () => void
}

export interface CloudEntry extends CloudSnapshot {
  status: CloudStatus
  createdAt: number
  runtime: CloudRuntime
  control: CloudControl
}

const sources = createStore<CloudEntry>()

export const cloudState = Object.freeze({
  sources,

  get: (id: string): CloudEntry | undefined => sources.get(id),

  set: (entry: CloudEntry): void => sources.set(entry.id, entry),

  /** Patch an entry in place - cheap, called on every message */
  update: (id: string, patch: Partial<CloudEntry>): void => {
    const entry = sources.get(id)
    if (entry) Object.assign(entry, patch)
  },

  forget: (id: string): boolean => sources.forget(id),

  getAll: (): CloudEntry[] => sources.getAll(),

  size: (): number => sources.size(),

  /** Plain snapshot without runtime handles - safe to hand to users */
  snapshot: (id: string): CloudSnapshot | undefined => {
    const e = sources.get(id)
    if (!e) return undefined
    return {
      id: e.id,
      kind: e.kind,
      status: e.status,
      connectedAt: e.connectedAt,
      lastMessageAt: e.lastMessageAt,
      lastSyncAt: e.lastSyncAt,
      messageCount: e.messageCount,
      errorCount: e.errorCount,
      lastError: e.lastError
    }
  },

  /** Disconnect every source and drop all entries (cyre.clear()/reset()) */
  reset: (): void => {
    for (const entry of sources.getAll()) {
      try {
        entry.control.teardown()
      } catch {
        // teardown is best-effort during a system reset
      }
    }
    sources.clear()
  }
})

export default cloudState
