// src/index.ts
// Main exports with enhanced stream support

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.1.0 2025 with Streams




    CYRE TARGET: is to make Cyre the least call-to-execution overhead per channel still having cutting edge features 

CYRE TODO: 
[]  multi .on subscribers to single .action channel 
[]  single .on subscriber to multi .action channels 
[]  add queue option to .action. if true .call to that channel will be queued until .on subscriber registered
[]  improved react and nextjs support with hooks
[]  useCyre could take optional ID. if set, it uses that id instead of generated id. so cyre.call can access that useCyre remotely
[]  cyre/ssr: experimental/testing stage
[]  cyre/stream experimental/testing stage
[]  state-machine: experimental/testing stage
[]  TimeKeeper.cron():
[]  improve action pipeline. each channel in cyre are independent. so action pipeline should proactively compile actions that apply to specific channel when that channel run. the rest should run with zero overhead. 
[]  Cyre to operate smart, proactive, reactive, logical and be calculated than be full of features
[]  more test coverage
[]  more proactive decision on cyre init and registrations to minimize run time calculations and overheads
[]  publish to NPM these are my current todo list. what do you think? any todo suggestions?

[]  system channels: instead of endless cyre.api create system .on listening channels for users to subscribe eg: on initialize, on error, on stress high etc
[]  persistent state. load Cyre from saved state, storage and sync with server
[]  cyre/server: server for client cyre applicants or others
[]  location routing: use id as address bar eg 'home/branch/app'
[]  cyre/branch: branch Cyre instances run their own network and respond to parent calls eg: shutdown or state change

[]  .action future features {

      block:boolean // this channel is no longer available
      required: boolean // payload is required on call
      payload 
    }
*/

// Import the cyre instance and related utilities from app.ts
import {cyre} from './app'
import {cyreCompose} from './hooks/cyre-compose'
import {useCyre} from './hooks/use-cyre'
import {log} from './components/cyre-log'

// Import stream system
import {createStream} from './stream'

// Main exports - ensure these are properly exported
export {cyre, log, useCyre, cyreCompose, createStream}

// Export stream system

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

// Export composition types
export type {
  CompositionOptions,
  CyreComposedResponse
} from './hooks/cyre-compose'

// Export stream types
export type {
  Stream as CyreStream,
  StreamObserver as CyreStreamObserver,
  StreamSubscription as CyreStreamSubscription,
  StreamOperator as CyreStreamOperator,
  StreamConfig as CyreStreamConfig
} from './types/stream'

// Version information
export const version = '4.1.0'

// Also export cyre as the default export for maximum compatibility
export default cyre

// Enhanced global availability for UMD builds
if (typeof globalThis !== 'undefined') {
  globalThis.cyre = cyre
  globalThis.useCyre = useCyre
  globalThis.cyreCompose = cyreCompose
  globalThis.CyreStream = createStream
}

// For browser environments that don't have globalThis
if (typeof window !== 'undefined') {
  ;(window as any).cyre = cyre
  ;(window as any).useCyre = useCyre
  ;(window as any).cyreCompose = cyreCompose
  ;(window as any).CyreStream = createStream
}
