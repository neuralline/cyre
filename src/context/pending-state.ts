// src/context/pending-state.ts
// Shared "settle" promises for debounce/buffer channels

/*

      C.Y.R.E - P.E.N.D.I.N.G - S.T.A.T.E

      Debounce and buffer both defer real execution to a later
      TimeKeeper callback - without this store, cyre.call() had no way to
      hand a caller that later result, so it returned an immediate
      "scheduled" acknowledgment instead (see claude/id-path-collision-demo.ts's
      sibling investigation, claude/server/cyre-client.ts, for how that
      surfaced as silent empty responses over HTTP).

      One pending entry per in-flight window, keyed by channel id. The
      FIRST call into an empty window creates the entry; every other call
      that lands in the SAME window shares it via get(). Whoever's
      deferred TimeKeeper callback actually runs processCall() calls
      settle() with the real result, which resolves every caller sharing
      that promise at once and removes the entry. A maxWait-forced flush
      also calls settle() (with the forced result) since it cancels the
      timer the entry was originally waiting on - otherwise every OTHER
      caller sharing that promise would hang forever.

      forget()/clear() RESOLVE any in-flight entry (with a cancellation
      result) rather than just deleting it - the first version of this
      store didn't, which meant cyre.forget(id) or cyre.clear() mid-window
      left any caller still awaiting that channel's call() hanging forever
      with nothing left to ever settle their promise. Caught by
      test/protections/cyre-debounce.test.ts's "channel removal during
      debounce" and "clean up debounce timers properly" cases.

      Known limitation (buffer only, not debounce): a call landing in the
      narrow window between a buffer dispatch STARTING and its settle()
      resolving will attach to that in-flight window's promise and
      resolve with ITS result, even though (per the existing buffer
      reopen logic in app.ts's call()) their payload actually gets carried
      into the NEXT window. This mirrors a pre-existing ambiguity in the
      buffer reopen design (that caller never got precise data back
      before this change either) - flagged here rather than silently
      left undocumented.

*/

import type {CyreResponse} from '../types/core'

interface PendingEntry {
  promise: Promise<CyreResponse>
  resolve: (result: CyreResponse) => void
}

const pending = new Map<string, PendingEntry>()

/**
 * Get the existing shared promise for this channel's current window, if
 * one is already in flight.
 */
const get = (id: string): PendingEntry | undefined => pending.get(id)

/**
 * Create and register a new shared promise for this channel. Call this
 * exactly once per window - the first caller into an empty window.
 * Every other caller in the same window should use get() instead.
 */
const create = (id: string): PendingEntry => {
  let resolve!: (result: CyreResponse) => void
  const promise = new Promise<CyreResponse>(res => {
    resolve = res
  })
  const entry: PendingEntry = {promise, resolve}
  pending.set(id, entry)
  return entry
}

/**
 * Resolve and clear the pending entry for this channel, settling every
 * caller sharing it. Safe to call even if no entry exists (e.g. a
 * maxWait flush racing a timer callback that already settled it).
 */
const settle = (id: string, result: CyreResponse): void => {
  const entry = pending.get(id)
  if (!entry) return
  pending.delete(id)
  entry.resolve(result)
}

/**
 * Cancel the pending entry for this channel. Unlike a bare Map delete,
 * this RESOLVES the promise (with the given cancellation result) before
 * removing it - a caller that's already `await`ing this channel's call
 * (e.g. cyre.forget() firing mid-window) needs to be released, not left
 * hanging on a promise nothing will ever settle again.
 */
const forget = (id: string, cancelResult?: CyreResponse): boolean => {
  const entry = pending.get(id)
  if (!entry) return false
  pending.delete(id)
  if (cancelResult) entry.resolve(cancelResult)
  return true
}

/**
 * Cancel every pending entry (system reset/clear). Same reasoning as
 * forget() above - resolves each in-flight promise with the given
 * cancellation result before dropping it, rather than abandoning them.
 */
const clear = (cancelResult?: CyreResponse): void => {
  if (cancelResult) {
    pending.forEach(entry => entry.resolve(cancelResult))
  }
  pending.clear()
}

export const pendingState = {
  get,
  create,
  settle,
  forget,
  clear
}

export default pendingState
