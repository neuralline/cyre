// src/index.ts
// Main exports with branch system support

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.6.0 2025 with Branch System

    Branch System Features:
    - createBranch(parent) for isolated namespaces
    - Path-based addressing: 'users/profile/update'
    - Cross-branch communication in same instance
    - Component duplication and reuse
    - Natural parent-child relationships

    CYRE TARGET: Make Cyre the least call-to-execution overhead per channel while having cutting edge features 

CYRE TODO: 
[x]  Branch system with isolated stores and unified addressing
[experimental]  Path-based cross-branch communication. location routing: use id as address bar eg 'home/branch/app'
[x]  Component duplication and reuse capabilities
[]   Multi .on subscribers to single .action channel 
[]   Single .on subscriber to multi .action channels 
[]   Add queue option to .action. if true .call to that channel will be queued until .on subscriber registered
[]   Improved react and nextjs support with hooks. low priority
[]   useCyre could take optional ID. if set, it uses that id instead of generated id. so cyre.call can access that useCyre remotely

[on hold]   cyre/ssr: experimental/testing stage
[depreciated]   cyre/stream experimental/testing stage
[on hold]   state-machine: experimental/testing stage
[]   cyre/server: server for client cyre applicants or others

[x]  schema: built in data validation

[in progress]   improve action pipeline. each channel in cyre are independent. so action pipeline should proactively compile actions that apply to specific channel when that channel run. the rest should run with zero overhead. 
[]   Cyre to operate smart, proactive, reactive, logical and be calculated than be full of features
[]   more test coverage
[in progress]   more proactive decision on cyre init and registrations to minimize run time calculations and overheads
  
[]   publish to NPM these are my current todo list. what do you think? any todo suggestions?

[in progress]   system channels: instead of endless cyre.api create system .on listening channels for users to subscribe eg: on initialize, on error, on stress high etc
[experimental]   persistent state. load Cyre from saved state, storage and sync with server

[]   
[]   DM: Direct Message. ??
[in progress]   Calendar for scheduling tasks
[in progress]  TimeKeeper.cron():

[]  .action future talents {
    [done] block: boolean // this channel is no longer available
      no name yet: if call id is already in progress or in timeline: reset | ignore | debounce | update payload only| 
    [done] required: boolean // payload is required on call
    [done]  maxWait: number : boolean
      immutable: boolean // can't modify payload
      noDispatch: boolean //this channel won't be dispatch to .on listeners. 
    [test] Multi-Sensor Fusion //combines data from multiple channel payload to create more accurate, reliable, and comprehensive environmental understanding.
    [test] Event Pattern Recognition? // detects complex patterns, sequences, and anomalies in channel payload data streams using various algorithmic approaches.
    }

    Branch System Benefits:
    - Component isolation and reuse
    - No ID namespace collisions
    - Natural parent-child relationships
    - Path-based navigation like URLs
    - Cross-branch communication in same instance
*/

// Import the cyre instance and related utilities from app.ts
import {cyre} from './app'
import {cyreCompose} from './hooks/cyre-compose'
import {useCyre} from './hooks/use-cyre'
import {createBranch} from './hooks/create-branch'
import {log} from './components/cyre-log'

// Import schema system
import schema from './schema/cyre-schema'

// Import stream system
import {createStream} from './stream'

// Import group system
import {groupOperations} from './components/cyre-group'

// Import orchestration system
import {orchestration} from './orchestration/orchestration-engine'

// Main exports with branch system
export {
  cyre,
  log,
  useCyre,
  cyreCompose,
  createBranch,
  createStream,
  schema,
  groupOperations,
  orchestration
}

// Export branch types
export type {
  Branch,
  BranchConfig,
  BranchSetup,
  BranchStats
} from './types/branch'

// Export orchestration types
export type {
  OrchestrationConfig,
  OrchestrationTrigger,
  WorkflowStep,
  OrchestrationAction,
  TriggerEvent,
  StepResult,
  ErrorHandlingConfig,
  MonitoringConfig,
  AlertConfig,
  ConditionFunction,
  OrchestrationRuntime,
  OrchestrationMetrics
} from './types/orchestration'

// Export types with unique names to avoid conflicts
export type {
  IO as CyreIO,
  EventHandler as CyreEventHandler,
  ISubscriber as CyreSubscriber,
  SubscriptionResponse as CyreSubscriptionResponse,
  ActionPayload as CyreActionPayload,
  Priority as CyrePriority,
  TimerDuration as CyreTimerDuration,
  CyreResponse as CyreCoreResponse
} from './types/core'

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
  StreamErrorHandler as CyreStreamErrorHandler,
  StreamConfig as CyreStreamConfig
} from './types/stream'

// Export schema types
export type {
  Schema as CyreSchema,
  ValidationResult as CyreValidationResult,
  Validator as CyreValidator,
  Infer as CyreInfer
} from './schema/cyre-schema'

// Export group types
export type {
  GroupConfig as CyreGroupConfig,
  GroupState as CyreGroupState,
  GroupResult as CyreGroupResult,
  GroupStats as CyreGroupStats,
  GroupMetrics as CyreGroupMetrics,
  GroupOperations as CyreGroupOperations,
  AlertConfig as CyreAlertConfig,
  AlertState as CyreAlertState,
  GroupMiddleware as CyreGroupMiddleware
} from './types/core'

// Version information
export const version = '4.6.0'

// Also export cyre as the default export for maximum compatibility
export default cyre

// Global availability for UMD builds
if (typeof window !== 'undefined') {
  ;(window as any).cyre = cyre
}
