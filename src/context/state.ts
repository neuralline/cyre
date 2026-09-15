// src/context/state.ts
// Cyre state management with payload separation

import type {
  BranchStore,
  IO,
  ISubscriber,
  StateActionMetrics,
  Timer
} from '../types/core'
import {metricsState, type MetricsState} from './metrics-state'
import {payloadState} from './payload-state'
import type {StateKey} from '../types/core'
import {createStore} from './create-store'
import {sensor} from '../components/sensor'

/*

      C.Y.R.E - S.T.A.T.E
      
      State management with clean separation:
      - IO store: Channel configuration and behavior only
      - Payload state: Separate payload management
      - Clean interfaces and backward compatibility
      - Enhanced state operations

*/

// Create stores with proper typing
const ioStore = createStore<IO>() // Channels
const subscriberStore = createStore<ISubscriber>() // .on subscribers/listeners
const timelineStore = createStore<Timer>() // schedules and queued tasks used by TimeKeeper
//const actionMetrics = createStore<StateActionMetrics>()
export const branchStore = createStore<BranchStore>()

/**
 * IO operations - configuration only, no payload data
 * // channel information store
 */
export const io = Object.freeze({
  /**
   * Set action configuration (no payload)
   */
  set: (action: IO): void => {
    try {
      if (!action?.id) throw new Error('IO state: Channel must have an id')
      const id = action.id

      const channel: IO = {
        ...action,
        _timestamp: Date.now()
      }

      ioStore.set(id, channel)
    } catch (error) {
      sensor.critical(
        `IO state corruption detected: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      throw error
    }
  },

  /**
   * Get action configuration
   */
  get: (id: StateKey): IO | undefined => ioStore.get(id),

  /**
   * Patch a few fields onto an already-registered channel's config
   * WITHOUT cloning the whole record - added because the hot dispatch
   * path (cyre-dispatch.ts's per-strategy handlers, plus app.ts's
   * throttle/debounce branches) was calling `io.set({...action, ...})`
   * on every single successful call just to bump a handful of numeric
   * counters (_executionTime/_lastExecTime/_executionCount, etc). That
   * spread clones the ENTIRE IO record (which can carry a compiled
   * `_pipeline` array, schema/condition/selector/transform closures, and
   * every protection field) - and set() then spreads it AGAIN internally
   * - twice per call, on the path this project's own comments call
   * "ultra-fast single handler execution". touch() mutates the existing
   * stored object's fields in place instead: no IO record is ever
   * exposed through the public API by reference (cyre.get()/branch.get()
   * both return payload state, not the raw channel config - see
   * claude/cyre-codebase-analysis.md's README-vs-code section), so
   * nothing depends on a channel's config object staying an immutable
   * snapshot between calls. A no-op if the id isn't currently registered
   * (e.g. a stale reference from mid-teardown), matching set()'s existing
   * "channel must have an id" guard in spirit rather than throwing.
   */
  touch: (id: StateKey, patch: Partial<IO>): void => {
    const existing = ioStore.get(id)
    if (!existing) return
    Object.assign(existing, patch, {_timestamp: Date.now()})
  },

  /**
   * Remove action configuration
   */
  forget: (id: StateKey): boolean => {
    // Also remove payload
    payloadState.forget(id) //remove chanel's payload state
    return ioStore.forget(id) // finally forget channel
  },

  /**
   * Clear all action configurations
   *
   * Channel/payload-store cleanup only - deliberately does NOT touch
   * metricsState. It used to call metricsState.reset() directly here as
   * an undocumented side effect, which meant any cyre.clear()/cyre.reset()
   * call mid-session silently wiped _init/_shutdown/config back to
   * defaults (system reported "System not initialized" right after a
   * clear()). Callers that want metricsState reset too (app.ts's
   * clear()/reset()) now do that explicitly at the call site, so the two
   * concerns don't get bundled together again by accident.
   */
  clear: (): void => {
    try {
      //actionMetrics.clear()
      ioStore.clear()

      payloadState.clear() // Clear payload state
    } catch (error) {
      sensor.critical(`System clear failed: ${error}`)
      throw error
    }
  },

  /**
   * Get all action configurations
   */
  getAll: (): IO[] => ioStore.getAll(),

  /**
   * Get action metrics
   */
  getMetrics: (id: StateKey): StateActionMetrics | undefined => {
    const action = ioStore.get(id)
    if (action) {
      const newMetrics: StateActionMetrics = {
        lastExecutionTime: action._lastExecTime || 0,
        executionCount: action._executionCount || 0,
        errors: action.errors || []
      }

      return newMetrics
    }

    return undefined
  }
})

// Keep existing subscribers and timeline exports (unchanged)
export const subscribers = {
  set: (subscriber: ISubscriber): void => {
    if (!subscriber?.id || !Array.isArray(subscriber.handlers)) {
      throw new Error('Invalid subscriber format')
    }
    subscriberStore.set(subscriber.id, subscriber)
  },
  get: (id: StateKey): ISubscriber | undefined => subscriberStore.get(id),
  forget: (id: StateKey): boolean => subscriberStore.forget(id),
  clear: (): void => subscriberStore.clear(),
  getAll: (): ISubscriber[] => subscriberStore.getAll()
}

// scheduled task store
export const timeline = {
  add: (timer: Timer): void => {
    if (!timer.id) return
    timelineStore.set(timer.id, timer)

    // Update active formations count in metrics state
    const activeCount = timelineStore
      .getAll()
      .filter(t => t.status === 'active').length
    metricsState.update({activeFormations: activeCount})
  },

  get: (id: StateKey): Timer | undefined => timelineStore.get(id),

  forget: (id: StateKey): boolean => {
    const timers = timelineStore.getAll().filter(timer => timer.id === id)
    timers.forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
      if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
    })

    const result = timelineStore.forget(id)

    // Update active formations count
    const activeCount = timelineStore
      .getAll()
      .filter(t => t.status === 'active').length
    metricsState.update({activeFormations: activeCount})

    return result
  },

  clear: (): void => {
    timelineStore.getAll().forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId)
      if (timer.recuperationInterval) clearTimeout(timer.recuperationInterval)
    })
    timelineStore.clear()
    metricsState.update({activeFormations: 0})
  },

  getAll: (): Timer[] => timelineStore.getAll(),

  getActive: (): Timer[] => {
    return timelineStore.getAll().filter(timer => timer.status === 'active')
  }
}

// Call-rate tracking - a bare incrementing counter, not a full
// metricsState.update() call. Cyre's fast path is the hot path this whole
// library is built around ("agility and responsiveness is it's main
// feature" - see the project's own notes) - doing a full state-store write
// with flag recomputation on every single cyre.call() would undercut
// exactly the thing breathing is supposed to protect. app.ts's call()
// increments this once per invocation (including blocked/rejected calls -
// it's meant to measure how hard the system is being hit, not just
// successes); context/metrics-state.ts's updateBreathingFromMetrics()
// (the breathing tick, once per second) is the only thing that ever reads
// and resets it, folding the result into metricsState.performance.
// callsPerSecond. This used to sit permanently at 0 - nothing in the
// codebase ever wrote to it - which meant call-rate stress could never
// contribute to the breathing system's combined stress score.
let callCount = 0

export const callTracker = Object.freeze({
  increment: (): void => {
    callCount++
  },
  sampleAndReset: (): number => {
    const count = callCount
    callCount = 0
    return count
  }
})

// Export readonly stores
export const stores = Object.freeze({
  io: ioStore,
  subscribers: subscriberStore,
  timeline: timelineStore,
  //quantum: metricsState,
  branch: branchStore
})

// Export types
export type {MetricsState as QuantumState, StateKey}
