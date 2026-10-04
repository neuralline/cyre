// src/app.ts - Updated with intelligent system orchestration

import type {
  IO,
  ActionPayload,
  CyreResponse,
  EventHandler,
  SubscriptionResponse
} from './types/core'
import type {CyreUserConfig} from './types/system'
import {MSG} from './config/cyre-config'
import {subscribe} from './components/cyre-on'
import TimeKeeper from './components/cyre-timekeeper'
import {io, subscribers, timeline, callTracker} from './context/state'
import {metricsState, updateBreathingFromMetrics} from './context/metrics-state'
import {sensor} from './components/sensor'
import {bufferState} from './context/buffer-state'
import {pendingState} from './context/pending-state'
import {CyreActions} from './components/cyre-actions'
import {processCall} from './components/cyre-call'
import {pathEngine} from './schema/path-engine'

import payloadState from './context/payload-state'
import type {ChannelPayload} from './context/payload-state'

// Import advanced systems
import {orchestration} from './orchestration/orchestration-engine'

import {schedule} from './components/cyre-schedule'
import {useDispatch} from './components/cyre-dispatch'

/*
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.6.0 2026 with Intelligent System Orchestration

    Intelligent system processes:
    - Adaptive breathing with stress-responsive adjustments
    - Smart memory cleanup with performance impact analysis
    - Proactive performance monitoring with actionable insights
    - Automated state persistence with conflict resolution
    - Comprehensive health checks with self-healing
    - Dynamic load balancing and adaptive optimization

        example use:
        cyre.action({id: 'taxi', payload: 44085648634})
        cyre.on('taxi', number => {
            console.log('Calling taxi @', number)
        })
        cyre.call('taxi')



        Path System Features:
        - Hierarchical channel organization: 'app/users/profile/settings'
        - Pattern-based operations: 'building/* /temperature'
        - Foreign key indexing for O(1) performance
        - Clean plugin architecture with private internals
        - Backward compatibility with existing flat IDs

        example use:
        cyre.action({id: 'user-profile', payload: userData})
        cyre.on('user-profile', handler)
        cyre.call('user-profile', newData)

        // path-based
        cyre.action({id: 'user-profile', path: 'app/users/profile', payload: userData})

    Flow: call() → processCall() → applyPipeline() → dispatch() → cyreExecute() → .on() → [IntraLink → call()]


    Cyre's first law: A robot can not injure a human being or allow a human being to be harmed by not helping.



    CYRE v4.7.0 BREAKING CHANGE - debounce/buffer now settle for real:
    cyre.call() on a debounced or buffered channel used to return an
    immediate {ok: true, payload: <echo of your request>, message:
    "...scheduled..."} ack BEFORE the real handler ever ran - the actual
    execution happened later inside a TimeKeeper callback whose result
    nothing could reach. Any caller (HTTP handler, awaiting code, anything)
    that used that return value got stale/empty data while believing it
    had a real answer (see claude/server/cyre-client.ts for exactly this
    surfacing as an empty 200 response). cyre.call() on a debounced/
    buffered channel now returns a promise that resolves with the REAL
    processCall() result once that window's deferred execution actually
    runs - every caller who called into the same window shares and
    resolves off the same promise. This means await cyre.call(...) on
    such a channel now genuinely waits up to the full debounce/buffer
    window before resolving, instead of returning near-instantly - if you
    were relying on the old fire-and-forget timing, that has changed.
    See src/context/pending-state.ts for the settle mechanism itself.

    CYRE v4.7.1 FIX - throttle now closes a concurrent-burst race:
    cyre.call()'s throttle gate used to check `action._lastExecTime`,
    which is only written AFTER a handler resolves (see cyre-dispatch.ts's
    executeSingleHandler) - on the other side of an await boundary. A
    burst of concurrent, un-awaited cyre.call()s on the same throttled
    channel (e.g. `for (...) { promises.push(cyre.call(id)) }` with no
    await between iterations) would each run synchronously up to their
    own first internal await before yielding back to the loop, so every
    one of them read the same stale _lastExecTime and ALL passed the
    gate - throttle only ever protected sequential/awaited calls, not
    concurrent ones. Fixed by reserving the slot synchronously (via a new
    `_throttleReservedAt` field, written with io.set() before any await)
    the instant a call passes the gate, and rolling that reservation back
    if the call's execution ultimately fails - so a failed call still
    doesn't cost the caller a legitimate retry, matching prior behavior.
    See the throttle branch in call() below.

*/

// Track initialization state
export interface CyreInstance {
  // Core methods
  init: (
    userConfig?: CyreUserConfig
  ) => Promise<{ok: boolean; payload: number | null; message: string}>
  action: (config: IO | IO[]) => {ok: boolean; message: string; payload?: any}
  on: (id: string, handler: EventHandler) => SubscriptionResponse
  call: (id: string, payload?: ActionPayload) => Promise<CyreResponse>
  forget: (id: string) => boolean
  /** Clear a channel's stored payload back to a clean slate (reseeded
   *  with its configured default, if any) without removing the channel
   *  itself - see resetPayload()'s own comment above its implementation. */
  resetPayload: (id: string) => boolean
  clear: () => void
  reset: () => void

  // Orchestration integration
  orchestration: typeof import('./orchestration/orchestration-engine').orchestration

  // Path system
  path: () => string

  // Developer experience helpers
  schedule: typeof import('./components/cyre-schedule').schedule

  // State methods
  // cyre.get(id) returns the channel's full request/response record -
  // {req, prevReq, res, metadata} - not just the raw payload. Matches
  // payloadState.get()'s actual return type (see context/payload-state.ts);
  // this used to be mistyped as ActionPayload | undefined, which hid
  // .req/.res/.metadata from TypeScript even though they worked at runtime.
  get: (id: string) => ChannelPayload | undefined
  hasChanged: (id: string, payload: ActionPayload) => boolean
  getPrevious: (id: string) => ActionPayload | undefined
  /** Previous request payloads beyond just the last one, newest first -
   *  only populated for a channel registered with `history` above the
   *  default 1 (or empty when keepPayload is false). */
  getHistory: (id: string) => ActionPayload[]

  // NEW: Dual payload system access
  //payloadState

  // Control methods with metrics
  pause: (id?: string) => void
  resume: (id?: string) => void
  lock: () => {ok: boolean; message: string; payload: null}
  unlock: () => {ok: boolean; message: string; payload: null}
  shutdown: () => void
  status: () => boolean

  // Metrics API
  getMetrics: (
    channelId?: string
  ) =>
    | import('./types/system').ChannelMetricsResult
    | import('./types/system').SystemMetricsResult
    | {error: string; available: false}
}

/**
 * Initialize with standardized system intelligence
 *
 * Accepts an optional userConfig (breathing rates/stress/limits, timing.
 * recuperation) merged into metricsState's config - see types/system.ts's
 * CyreUserConfig/CyreConfig and context/metrics-state.ts's mergeConfig().
 * This runs BEFORE initializeBreathing()/TimeKeeper.resume() so the
 * breathing loop and Quartz engine both read the live (possibly
 * user-overridden) config from their very first tick, rather than racing
 * against defaults that get swapped out underneath them.
 */
const init = async (
  userConfig?: CyreUserConfig
): Promise<{
  ok: boolean
  payload: number | null
  message: string
}> => {
  try {
    if (metricsState.isInit()) {
      sensor.sys('System already initialized')
      return {ok: true, payload: Date.now(), message: MSG.ONLINE}
    }

    sensor.sys(MSG.QUANTUM_HEADER)

    // Initialize advanced systems
    //initializeQuerySystem()

    metricsState.init(userConfig)

    initializeBreathing()
    TimeKeeper.resume()

    sensor.debug('system', 'success', 'system-initialization')

    sensor.success('Cyre initialized with system intelligence')
    sensor.success('initialize', 'Cyre initialized with system intelligence')
    sensor.debug('System online!')

    return {ok: true, payload: Date.now(), message: MSG.ONLINE}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.critical(`Cyre failed to initialize : ${errorMessage}`)
    sensor.critical('system', errorMessage, 'system-initialization')
    shutdown()
    return {ok: false, payload: null, message: errorMessage}
  }
}

/**
 * Initialize breathing system with metrics integration
 */
const initializeBreathing = (): void => {
  TimeKeeper.keep(
    1000,
    async () => {
      //callback on each reputation
      try {
        await updateBreathingFromMetrics()
        return undefined // ✅ Explicit return for async function
      } catch (error) {
        // Silent fail to prevent log spam
        sensor.error('system', 'Breathing update error:', 'initialize')
        return undefined // ✅ Return in catch block too
      }
    },
    true,
    'system-breathing',
    1000
  )

  sensor.info('system', 'Breathing system initialized with metrics integration')
}
/**
 * Action registration with automatic orchestration trigger detection
 */
const action = (
  attribute: IO | IO[]
): {ok: boolean; message: string; payload?: any} => {
  // HOT PATH OPTIMIZATION: Single flag check instead of multiple conditions
  const {allowed, messages} = metricsState.canRegister()
  if (!allowed) {
    sensor.error(messages, 'system-error', 'Channel-registration')

    return {ok: false, message: messages.join(', ')}
  }

  try {
    if (Array.isArray(attribute)) {
      const results = attribute.map(singleAction => {
        const result = CyreActions(singleAction)

        return result
      })

      const successful = results.filter(r => r.ok).length
      return {
        ok: successful > 0,
        message: `Registered ${successful}/${results.length} actions`,
        payload: results
      }
    } else {
      const result = CyreActions(attribute)

      return result
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(
      'system',
      `Channel registration failed: ${errorMessage}`,
      'app/channel'
    )
    return {ok: false, message: `Channel registration failed: ${errorMessage}`}
  }
}

/**
 * Call execution with pre-pipeline protections
 */
export const call = async (
  id: string,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  // Cheapest possible hot-path cost - a single module-level integer
  // increment (see context/state.ts's callTracker), counting every call
  // attempt (including ones about to be rejected below) so
  // metricsState.performance.callsPerSecond reflects real load pressure,
  // not just successful dispatches. Sampled + reset once a second by the
  // breathing tick - nothing here does a full state write per call.
  callTracker.increment()

  try {
    if (!id) {
      sensor.error(`${MSG.UNABLE_TO_COMPLY}: ${id}`)
      return {
        ok: false,
        payload: null,
        message: `${MSG.UNABLE_TO_COMPLY}: ${id}`
      }
    }

    const action = io.get(id)
    if (!action) {
      sensor.error(`${MSG.CALL_INVALID_ID}: ${id}. Channel does not exist`)
      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_INVALID_ID}: ${id}`
      }
    } else if (action._isBlocked) {
      sensor.critical(`${MSG.CALL_NOT_RESPONDING}: ${id}`)
      return {
        ok: false,
        payload: null,
        message: `${MSG.CALL_NOT_RESPONDING}: ${id}`
      }
    }

    const {allowed, messages} = metricsState.canCall()
    if (!allowed) {
      if (action.priority?.level === 'critical') {
        // Allow critical actions even during recuperation
      } else {
        sensor.error(
          'app/call/system',
          messages.join(', '),
          action.id,
          'blocked'
        )
        return {
          ok: false,
          payload: undefined,
          message: messages.join(', ')
        }
      }
    }

    // Get request payload - use payload from call or action default
    const req = payload !== undefined ? payload : action.payload

    // Fast path detection
    if (action._hasFastPath) {
      return await useDispatch(action, req)
    }

    // THROTTLE: reserves its slot SYNCHRONOUSLY, before any await - this
    // closes a real concurrency gap where a burst of concurrent,
    // un-awaited cyre.call()s on the same throttled channel could ALL
    // pass the gate. The old check-then-act here only ever read
    // `_lastExecTime`, which is written later, after the handler resolves
    // (see cyre-dispatch.ts's executeSingleHandler) - on the other side of
    // an await boundary. A tight loop of `cyre.call(id)` with no await
    // between calls runs each call synchronously up to ITS OWN first
    // internal await before yielding back to the loop, so every one of
    // them read the same stale `_lastExecTime` and all passed. Reserving
    // via `_throttleReservedAt` synchronously here means the very next
    // call() invocation in the same synchronous burst sees it immediately
    // (io.set() is a synchronous Map write), instead of racing on state
    // nothing has updated yet. The reservation is provisional: if this
    // call's execution ultimately fails, it's rolled back below so a
    // failed call doesn't cost the caller a legitimate retry - preserving
    // the pre-existing (and separately tested) behavior that only a
    // successful execution establishes a throttle window.
    if (action.throttle && action.throttle > 0) {
      // Every call routed through the throttle gate, allowed or rejected -
      // was previously invisible to getMetrics()/useMetrics(), which only
      // ever saw _executionCount (post-gate) and had no way to tell "this
      // channel is quiet" from "this channel is getting hammered and
      // throttle is absorbing it".
      io.touch(action.id, {_throttleCount: (action._throttleCount || 0) + 1})

      const currentTime = Date.now()
      const lastExecTime = action._lastExecTime || 0
      const reservedAt = action._throttleReservedAt || 0
      const effectiveLastTime = Math.max(lastExecTime, reservedAt)
      const elapsedSinceLastExec = currentTime - effectiveLastTime
      const remaining = Math.max(0, action.throttle - elapsedSinceLastExec)

      if (effectiveLastTime > 0 && elapsedSinceLastExec < action.throttle) {
        return {
          ok: false,
          payload: undefined,
          message: `Call throttled - retry available in ${remaining}ms`
        }
      }

      io.touch(action.id, {_throttleReservedAt: currentTime})

      const result = await processCall(action, req)

      if (!result.ok) {
        // Roll back the reservation - this attempt didn't actually
        // execute successfully, so it shouldn't cost the next caller
        // their retry. Guarded by an identity check on the timestamp we
        // set, in case a later call has already reserved a newer slot by
        // the time this one's execution finishes.
        const current = io.get(action.id)
        if (current && current._throttleReservedAt === currentTime) {
          io.touch(action.id, {_throttleReservedAt: undefined})
        }
      }

      return result
    }

    // DEBOUNCE: shares ONE settle promise per window (pendingState) - every
    // call landing in the same window returns the SAME promise, resolved
    // with the REAL processCall() result once the deferred execution
    // actually runs, instead of each call getting its own immediate
    // "scheduled" ack that threw the real result away. See
    // src/context/pending-state.ts for the settle mechanism.
    if (action.debounce && action.debounce > 0) {
      // Same visibility gap as throttle above - one bump per call landing
      // in the debounce window, not just the one call that ends up
      // settling it.
      io.touch(action.id, {_debounceCount: (action._debounceCount || 0) + 1})

      const debounceId = `debounce-${action.id}`

      // Store in buffer state (temporary) - ultra-fast set
      bufferState.set(action.id, req)

      const existingPending = pendingState.get(action.id)

      if (timeline.get(debounceId)) {
        TimeKeeper.forget(debounceId)

        const debounceStart = action._debounceStart || Date.now()
        if (action.maxWait && Date.now() - debounceStart >= action.maxWait) {
          // bufferState.get() already returns the raw payload (not a
          // wrapper) - has() distinguishes "no entry" from "entry exists
          // and its payload happens to be falsy/undefined"
          const tempPayload = bufferState.has(action.id)
            ? bufferState.get(action.id)
            : req
          bufferState.forget(action.id)
          io.touch(action.id, {_debounceStart: undefined})

          const result = await processCall(action, tempPayload)
          // The timer this window's OTHER callers were waiting on just got
          // cancelled above (TimeKeeper.forget) - without this, they'd
          // share a promise that would now never resolve on its own.
          pendingState.settle(action.id, result)
          return result
        }
      } else {
        io.touch(action.id, {_debounceStart: Date.now()})
      }

      const {promise} = existingPending ?? pendingState.create(action.id)

      TimeKeeper.keep(
        action.debounce,
        async () => {
          try {
            // Same has()/get() pattern as above - bufferState.get() already
            // returns the raw payload
            const latestPayload = bufferState.has(action.id)
              ? bufferState.get(action.id)
              : req
            const currentAction = io.get(action.id)
            if (!currentAction) {
              pendingState.settle(action.id, {
                ok: false,
                payload: null,
                message: 'Debounced execution failed: channel no longer exists'
              })
              return
            }

            bufferState.forget(action.id)
            io.touch(action.id, {_debounceStart: undefined})

            const result = await processCall(currentAction, latestPayload)
            pendingState.settle(action.id, result)
            return result
          } catch (error) {
            bufferState.forget(action.id)
            const errorResult: CyreResponse = {
              ok: false,
              payload: null,
              message: `Debounced execution failed: ${error}`,
              error: String(error)
            }
            pendingState.settle(action.id, errorResult)
            return errorResult
          }
        },
        1,
        debounceId
      )

      return promise
    }

    // BUFFER: shares ONE settle promise per window, same mechanism as
    // debounce above. Known limitation: a call landing in the narrow gap
    // between this window's dispatch STARTING and settle() resolving will
    // attach to and resolve with THIS window's result, even though (per
    // the reopen logic below) their payload actually carries into the
    // NEXT window - see src/context/pending-state.ts for the full note.
    if (action.buffer && action.buffer.window > 0) {
      // Same shape as _throttleCount/_debounceCount above.
      io.touch(action.id, {_bufferCount: (action._bufferCount || 0) + 1})

      const bufferId = `buffer-${action.id}`
      const bufferConfig = action.buffer

      const existingPending = pendingState.get(action.id)

      if (!timeline.get(bufferId)) {
        // A named, self-recursive opener rather than a single inline
        // TimeKeeper.keep call: if a new payload lands while this window's
        // callback is still dispatching (processCall can take a while),
        // the window below re-opens itself for that payload instead of
        // leaving it stranded with nothing scheduled to collect it.
        const openBufferWindow = (): void => {
          TimeKeeper.keep(
            bufferConfig.window,
            async () => {
              // bufferState.get() returns the raw payload directly (not a
              // wrapper) - has() is what tells us whether an entry exists
              // at all, since the payload itself may legitimately be
              // falsy/undefined. getTimestamp() is the separate signal for
              // "has this entry been overwritten since I last looked at it".
              const hadEntry = bufferState.has(action.id)
              const finalPayload = hadEntry ? bufferState.get(action.id) : req
              const snapshotTimestamp = bufferState.getTimestamp(action.id)

              const settleBuffer = (): void => {
                if (!bufferState.has(action.id)) return // already gone

                if (bufferState.getTimestamp(action.id) === snapshotTimestamp) {
                  // Nothing new arrived during dispatch - safe to clear
                  bufferState.forget(action.id)
                } else {
                  // A call landed mid-dispatch after this window's timer
                  // was already committed to firing once (repeat: 1) and
                  // self-removing - open the next window for it now rather
                  // than losing it or silently folding it into whatever
                  // window happens to be created by some later call
                  openBufferWindow()
                }
              }

              try {
                const result = await processCall(action, finalPayload)
                // Settle THIS window's waiters with THIS window's result
                // before deciding whether a new window needs to open -
                // a caller who lands in the reopened window gets its own
                // new pending promise the next time this branch runs.
                pendingState.settle(action.id, result)
                settleBuffer()
                return result
              } catch (error) {
                const errorResult: CyreResponse = {
                  ok: false,
                  payload: null,
                  message: `Buffer execution failed: ${error}`,
                  error: String(error)
                }
                pendingState.settle(action.id, errorResult)
                settleBuffer()
                return errorResult
              }
            },
            1,
            bufferId
          )
        }

        openBufferWindow()
      }

      // Use dedicated append method for buffer strategy
      if (bufferConfig.strategy === 'append') {
        bufferState.append(action.id, req)
      } else {
        bufferState.set(action.id, req) // Default overwrite
      }

      const {promise} = existingPending ?? pendingState.create(action.id)
      return promise
    }

    // Direct execution - payload will be saved in processCall -> dispatch
    return await processCall(action, req)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    sensor.error(id, errorMessage, 'call-execution')
    return {
      ok: false,
      payload: null,
      message: `Call failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * Forget action with group and orchestration cleanup
 */
const forget = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }

  try {
    const actionRemoved = io.forget(id)
    const subscriberRemoved = subscribers.forget(id)
    // Route through TimeKeeper rather than clearing the timeline map
    // directly - that also cleans up QuartzEngine's own bookkeeping
    // (execution/precision groups, in-flight dispatch guard) for this id,
    // which a bare timeline.forget() leaves stale
    TimeKeeper.forget(id)
    // Keep the path engine's index in sync too - otherwise a forgotten
    // channel's id lingers in pathToChannels/the path tree and can still
    // surface from pathPlugin.find/on/bulkCall after it's gone
    pathEngine.remove(id)
    // A forgotten channel's in-flight debounce/buffer settle promise (if
    // any) would otherwise hang forever with no timer left to resolve it -
    // forget() RESOLVES it (not just deletes it) so any caller still
    // awaiting this channel's call() is released rather than left hanging
    pendingState.forget(id, {
      ok: false,
      payload: null,
      message: `Debounced/buffered call cancelled - channel ${id} was forgotten before its window settled`
    })

    // Remove from groups
    //removeChannelFromGroups(id)

    if (actionRemoved || subscriberRemoved) {
      //sensor.info(id, 'Action removal successful')

      return true
    }

    sensor.info(`No channel found to remove for id: ${id}`, 'action-removal')
    return false
  } catch (error) {
    sensor.error(`Failed to forget ${id}: ${error}`)
    sensor.error(id, String(error), 'action-removal')
    return false
  }
}

/**
 * Clear a channel's stored payload (req/res/prevReq/history) back to a
 * clean slate WITHOUT removing the channel itself - forget()'s payload
 * cleanup is a side effect of removing the whole channel; this is the
 * narrower "just the payload" op, for a channel you want to keep
 * registered (subscribers, protections, path, everything) but stop
 * remembering old data for - e.g. after processing a large one-off
 * document, or to deliberately drop a stale getPrevious()/getHistory()
 * value.
 *
 * Reseeds req with the channel's configured default `payload`, same as a
 * freshly-registered channel - unless the channel is keepPayload: false,
 * in which case it stays unseeded (storing a default when the channel is
 * configured never to store payloads would defeat the point of that
 * flag). Does not touch in-flight debounce/buffer windows - see
 * payload-state.ts's reset() for that boundary.
 */
const resetPayload = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false
  }

  const action = io.get(id)
  if (!action) {
    sensor.info(`No channel found to reset payload for id: ${id}`, 'payload-reset')
    return false
  }

  const defaultPayload = action._keepPayload === false ? undefined : action.payload
  payloadState.reset(id, defaultPayload)
  return true
}

const shutdown = (): void => {
  try {
    sensor.sys('system', 'Initiating system shutdown')
    sensor.debug('system', 'critical', 'system-shutdown')

    // reset() already performs the hard metricsState.reset() below - no
    // need to call it again here. shutdown() only adds the process-exit
    // step on top of a plain reset().
    reset()
    sensor.debug('System offline!')
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(0)
    }
  } catch (error) {
    sensor.critical('shutdown', 'System-shutdown failed')
  }
}

/**
 * Domain-level cleanup shared by clear() and reset() - channels,
 * subscribers, timers/timeline, buffers, pending calls, path index,
 * payloads. Deliberately does NOT touch metricsState: clear() and
 * reset() differ only in how they handle metricsState (soft vs hard),
 * so that decision is made at each call site below, not in here.
 */
const clearDomainState = (): void => {
  // Domain-level cleanup first: schedule.reset()/orchestration.reset()
  // do proper per-task/per-orchestration teardown (forgetting each
  // trigger timer, unsubscribing orchestration channel triggers via
  // subscribers) - that needs io/subscribers/TimeKeeper's timeline
  // still intact to do its job, so this has to run before those raw
  // stores get wiped below. Skipping this left scheduleState/
  // orchestrationState holding stale entries that pointed at timers
  // TimeKeeper.reset() had already destroyed.
  schedule.reset()
  orchestration.reset()

  io.clear()
  subscribers.clear()
  // TimeKeeper.reset() rather than a bare timeline.clear() - it also
  // stops the quartz engine and clears its own internal bookkeeping
  // (execution/precision groups, in-flight dispatch guard, metrics),
  // so nothing is left running against a timeline that was just wiped
  // out from under it
  TimeKeeper.reset()
  // bufferState is a separate module-level store from timeline/io and
  // was never cleared here - a buffer/debounce payload accumulated in
  // one test (or one system generation) could leak into the next
  bufferState.clear()
  // Same reasoning as bufferState - any debounce/buffer settle promise
  // still in flight has no timer left to resolve it after
  // TimeKeeper.reset(); clear() RESOLVES every in-flight entry (not just
  // deletes it) so nothing is left hanging on a promise that will now
  // never settle
  pendingState.clear({
    ok: false,
    payload: null,
    message:
      'Debounced/buffered call cancelled - system was reset before its window settled'
  })
  // Same reasoning as bufferState - pathEngine keeps its own foreign-key
  // indexes (path/segment/depth -> channel id, plus the tree) separate
  // from io, so clearing io alone left stale path entries behind
  pathEngine.clear()
  payloadState.clear()
}

/**
 * cyre.clear() - soft: wipes all channel/subscriber/timer/payload state
 * but preserves system identity (_init/_isLocked/_shutdown) and the
 * user's cyre.init(userConfig) overrides via metricsState.clear(). A
 * subset of reset() - same domain cleanup, softer metrics handling.
 */
const clear = (): void => {
  try {
    sensor.debug('System clear initiated')
    clearDomainState()
    metricsState.clear()
    sensor.success('System cleared')
  } catch (error) {
    sensor.error(`Clear operation failed: ${error}`)
    sensor.critical('system', String(error), 'system-clear')
  }
}

/**
 * cyre.reset() - hard: everything clear() does, plus a full
 * metricsState.reset() back to defaults (identity flags AND config both
 * wiped). Still stops short of shutdown() - no process.exit here, so the
 * system stays callable afterward (cyre.init() again to re-enable it).
 */
const reset = (): void => {
  try {
    sensor.debug('System reset initiated')
    clearDomainState()
    metricsState.reset()
    sensor.success('System reset')
  } catch (error) {
    sensor.error(`Reset operation failed: ${error}`)
    sensor.critical('system', String(error), 'system-reset')
  }
}
/**
 * Main CYRE instance with intelligent system orchestration
 */
export const cyre: CyreInstance = Object.freeze({
  // Core methods
  init,
  action,
  on: subscribe,
  call,
  forget,
  resetPayload,
  clear,
  reset,
  // ALIGNED ORCHESTRATION INTEGRATION
  orchestration,

  // SEAMLESS QUERY INTEGRATION
  //query,
  path: () => {
    return ''
  },
  // DEVELOPER EXPERIENCE HELPERS
  schedule,
  // ENHANCED METRICS SYSTEM
  // Add metrics interface

  get: (id: string) => payloadState.get(id),
  // Add this to the main cyre object, right before the closing brace

  // State methods
  hasChanged: (id: string, payload: ActionPayload) =>
    payloadState.hasChanged(id, payload),
  getPrevious: (id: string) => payloadState.getPrevious(id),
  getHistory: (id: string) => payloadState.getHistory(id),

  // Control methods with metrics
  pause: (id?: string) => {
    if (id) {
      // A schedule task's or orchestration's real TimeKeeper timers are
      // named "<id>-trigger-N", not the bare id (see armCalendarTrigger()
      // in cyre-schedule.ts / registerTriggers() in orchestration-engine.ts)
      // - a plain TimeKeeper.pause(id) silently matches nothing for them.
      // Delegate to whichever subsystem actually owns this id.
      if (schedule.get(id)) {
        schedule.pause(id)
      } else if (orchestration.get(id)) {
        orchestration.pause(id)
      } else {
        TimeKeeper.pause(id)
      }
    } else {
      // No id: pause everything. Every schedule/orchestration timer
      // already lives in the same shared TimeKeeper timeline as regular
      // channel timers (see context/state.ts), so this alone covers all
      // three - nothing extra to delegate to here.
      TimeKeeper.pause()
    }
    sensor.debug(id || 'system', 'info', 'system-pause')
  },

  resume: (id?: string) => {
    if (id) {
      if (schedule.get(id)) {
        schedule.resume(id)
      } else if (orchestration.get(id)) {
        orchestration.resume(id)
      } else {
        TimeKeeper.resume(id)
      }
    } else {
      TimeKeeper.resume()
    }
    sensor.debug(id || 'system', 'info', 'system-resume')
  },

  lock: () => {
    metricsState.lock()

    return {ok: true, message: 'System locked', payload: null}
  },

  unlock: () => {
    metricsState.unlock()

    return {ok: true, message: 'System unlocked', payload: null}
  },

  shutdown,

  status: () => metricsState.get().hibernating,
  /**
   * Get metrics for system or specific channel
   * @param channelId Optional channel ID for channel-specific metrics
   */
  getMetrics: (channelId?: string) => {
    return metricsState.getMetrics(channelId)
  }
})

export default cyre
