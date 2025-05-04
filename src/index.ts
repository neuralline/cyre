/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 3+ 2025
*/

// Export main components
export {Cyre, cyre, CyreLog} from './app'
export default './app'

// Export utility components
export {
  pipe,
  memoize,
  isEqual,
  debounce,
  throttle,
  tryCatch
} from './libs/utils'
//export {createCyreChannel, type Channel} from './libs/create-cyre-channel'

// Export types
export type {
  IO,
  EventHandler,
  Subscriber,
  SubscriptionResponse,
  ActionPayload,
  Priority,
  TimerDuration,
  BreathingMetrics,
  SystemMetrics,
  CyreResponse
} from './interfaces/interface'

// Version information
export const version = '3.1.2'
