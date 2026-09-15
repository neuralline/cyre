// src/context/sensor-state.ts
// Subscriber registry for sensor's log/error stream.

/*

      C.Y.R.E - S.E.N.S.O.R - S.T.A.T.E

      Every sensor.log()/error()/warn()/etc call currently only ever
      reaches console.log/error - there's no way for code to react to a
      log event, only to watch stdout. This is the piece that closes that
      gap: a small subscriber registry, kept here in context/state (next
      to io/subscribers/metricsStore) rather than as a bare module-level
      array inside components/sensor.ts, so it stays visible/resettable
      the same way everything else here is.

      sensor.log() (see components/sensor.ts) calls emit() unconditionally
      for every event, independent of the current minLogLevel console
      threshold - a listener can watch DEBUG-level events even when the
      console itself is set to ERROR-only. Filtering by level/actionId/
      eventType is the listener's job (see hooks/use-log.ts), not this
      registry's.

*/

import {createStore} from './create-store'
import type {SensorEvent, LogLevel} from '../components/sensor'

export type SensorLogEvent = SensorEvent & {logLevel: LogLevel}
export type SensorListener = (event: SensorLogEvent) => void

const listeners = createStore<SensorListener>()
let nextId = 0

export const sensorState = {
  /**
   * Register a listener. Returns an unsubscribe function - same shape as
   * every other subscribe-style API in cyre (cyre.on()'s own
   * unsubscribe, TimeKeeper formations, etc).
   */
  subscribe: (listener: SensorListener): (() => void) => {
    const id = `sensor-listener-${++nextId}`
    listeners.set(id, listener)
    return () => {
      listeners.forget(id)
    }
  },

  /**
   * Fan a log event out to every subscriber. Called from sensor.log() on
   * every event, regardless of the console print threshold. A listener
   * throwing must never take logging itself down, so failures are
   * swallowed here rather than propagated.
   */
  emit: (event: SensorLogEvent): void => {
    listeners.getAll().forEach(listener => {
      try {
        listener(event)
      } catch {
        // A broken subscriber is the subscriber's problem, not sensor's.
      }
    })
  },

  count: (): number => listeners.size(),

  clear: (): void => {
    listeners.clear()
  }
}

export default sensorState
