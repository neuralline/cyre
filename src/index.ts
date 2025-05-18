import {CyreHook, CyreChannel} from './interfaces/hooks'
/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 3+ 2025
*/

// Export main components
// Import the cyre instance and related utilities from app.ts
import {cyre, Cyre, CyreLog, useCyre} from './app'
import {cyreCompose} from './hooks/cyre-compose'
// Export everything as both named exports and default export
export {cyre, Cyre, CyreLog, useCyre, cyreCompose}

// Also export cyre as the default export for compatibility
export default cyre

// Export utility components
export {pipe, memoize, isEqual, tryCatch} from './libs/utils'
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
export type {CyreHook, CyreChannel}

// Version information
export const version = '3.1.7'
