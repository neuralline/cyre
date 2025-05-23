// src/index.ts

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4 2025
*/

// Export main components
// Import the cyre instance and related utilities from app.ts
import {cyre, Cyre, log} from './app'
import {cyreCompose} from './hooks/cyre-compose'
import {useCyre} from './hooks/use-cyre'

// Export everything as both named exports and default export
export {cyre, Cyre, log, useCyre, cyreCompose}

// Also export cyre as the default export for compatibility
export default cyre

// Export utility components
export {pipe, memoize, isEqual, tryCatch} from './libs/utils'
//export {createCyreChannel, type Channel} from './libs/create-cyre-channel'

// Export types with unique names to avoid conflicts
export type {
  IO as CyreIO,
  EventHandler as CyreEventHandler,
  Subscriber as CyreSubscriber,
  SubscriptionResponse as CyreSubscriptionResponse,
  ActionPayload as CyreActionPayload,
  Priority as CyrePriority,
  TimerDuration as CyreTimerDuration,
  BreathingMetrics as CyreBreathingMetrics,
  SystemMetrics as CyreSystemMetrics,
  CyreResponse as CyreCoreResponse
} from './types/interface'

// Export hook types
export type {
  CyreHook as CyreHookType,
  CyreChannel as CyreChannelType
} from './types/hooks-interface'

// Version information
export const version = '4.0.0'
