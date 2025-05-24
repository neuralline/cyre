// src/index.ts

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4 2025
*/

// Import the cyre instance and related utilities from app.ts
import {cyre, Cyre, log} from './app'
import {cyreCompose} from './hooks/cyre-compose'
import {useCyre} from './hooks/use-cyre'

// Main exports - ensure these are properly exported
export {cyre, Cyre, log, useCyre, cyreCompose}

// Export utility components
//export {pipe, memoize, isEqual, tryCatch} from './libs/utils'

// Export types with unique names to avoid conflicts
export type {
  IO as CyreIO,
  EventHandler as CyreEventHandler,
  ISubscriber as CyreSubscriber,
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

// Export history types
export type {HistoryEntry, HistoryStats, HistoryQuery} from './types/history'

// Export composition types
export type {
  CompositionOptions,
  CyreComposedResponse
} from './hooks/cyre-compose'

// Version information
export const version = '4.0.0'

// Also export cyre as the default export for maximum compatibility
export default cyre

// Ensure global availability for UMD builds (browser environments)
if (typeof globalThis !== 'undefined') {
  globalThis.cyre = cyre
  globalThis.useCyre = useCyre
  globalThis.cyreCompose = cyreCompose
}

// For browser environments that don't have globalThis
if (typeof window !== 'undefined') {
  ;(window as any).cyre = cyre
  ;(window as any).useCyre = useCyre
  ;(window as any).cyreCompose = cyreCompose
}
