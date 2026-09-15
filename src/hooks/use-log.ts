// src/hooks/use-log.ts
// useLog hook - subscribe to sensor's log/error stream the official way

/*

      C.Y.R.E - U.S.E - L.O.G

      sensor.error()/warn()/etc (components/sensor.ts) only ever wrote to
      console - there was no supported way for an app to react to a log
      event itself, short of monkey-patching console.error. This hook is
      the supported way: it reads from context/sensor-state.ts's
      subscriber registry, which sensor.log() now feeds on every call,
      independent of the console's own minLogLevel threshold.

      Mirrors useCyre's shape (a factory function returning a small
      interface, sensor-guarded, unsubscribe-returning) rather than
      inventing a new hook convention.

*/

import {LogLevel, sensor} from '../components/sensor'
import type {MetricEvent} from '../components/sensor'
import {sensorState} from '../context/sensor-state'
import type {SensorLogEvent} from '../context/sensor-state'

export interface UseLogConfig {
  /**
   * Minimum level this hook's subscribers receive. Defaults to
   * LogLevel.ERROR - the same default threshold sensor itself uses for
   * console output, so an unconfigured useLog() reacts to exactly the
   * messages that "usually end up on console".
   */
  level?: LogLevel
  /** Only receive events for one channel/branch id */
  actionId?: string
  /** Only receive one category of event (see MetricEvent) */
  eventType?: MetricEvent
}

export interface LogHook {
  /**
   * Subscribe to log events matching this hook's filter. Returns an
   * unsubscribe function - same shape as cyre.on()'s own unsubscribe.
   */
  on: (handler: (event: SensorLogEvent) => void) => () => void
  /** Resolved filter this hook was created with */
  config: {level: LogLevel; actionId?: string; eventType?: MetricEvent}
}

/**
 * Subscribe to cyre's internal log/error stream.
 *
 * @example
 * const errors = useLog() // ERROR + CRITICAL, system-wide
 * const stop = errors.on(event => showToast(event.message))
 *
 * @example
 * // Everything from one channel, including DEBUG-level chatter
 * useLog({level: LogLevel.DEBUG, actionId: 'checkout'}).on(console.log)
 */
export const useLog = (config: UseLogConfig = {}): LogHook => {
  const level = config.level ?? LogLevel.ERROR
  const actionId = config.actionId
  const eventType = config.eventType

  const on = (handler: (event: SensorLogEvent) => void): (() => void) => {
    if (typeof handler !== 'function') {
      sensor.error(
        'useLog requires a handler function',
        'use-log',
        'validation',
        'error'
      )
      return () => {}
    }

    return sensorState.subscribe((event: SensorLogEvent) => {
      if (event.logLevel < level) return
      if (actionId && event.actionId !== actionId) return
      if (eventType && event.eventType !== eventType) return

      try {
        handler(event)
      } catch (error) {
        // A handler throwing must not take the log stream down for every
        // other subscriber - report it through sensor itself, once,
        // rather than silently swallowing it.
        sensor.error(
          `useLog handler threw: ${error}`,
          'use-log',
          actionId || 'system',
          'error'
        )
      }
    })
  }

  return {on, config: {level, actionId, eventType}}
}

export default useLog
