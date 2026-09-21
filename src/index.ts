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

[experimental]  Path-based cross-branch communication. location routing: use id as address bar eg 'home/branch/app'
[x]  Component duplication and reuse capabilities
[x]  .on one to many. multiple subscribers per channel in parallel, sequential, race, waterfall and none[don't execute]
[]   Single .on subscriber to multi .action channels 
[x]  Buffer operator
[]  payload full {req, res} support 
[]  detect change
[]   Add queue option to .action. if true .call to that channel will be queued until .on subscriber registered
[]   Improved react and nextjs support with hooks. low priority
[x]   useCyre could take optional ID. if set, it uses that id instead of generated id. so cyre.call can access that useCyre remotely
[x]   Sensor. single source of metrics/console/terminal. 
[]   orchestration. 

//external services built on core cyre
[on hold]   cyre/ssr: experimental/testing stage
[on hold]   cyre/stream experimental/testing stage
[on hold]   state-machine: experimental/testing stage
[on hold]   cyre/server: server for client cyre applicants or others

[x]  schema: built in data validation

[in progress]   improve action pipeline. each channel in cyre are independent. so action pipeline should proactively compile actions that apply to specific channel when that channel run. the rest should run with zero overhead. 
[]   Cyre to operate smart, proactive, reactive, logical and be calculated than be full of features
[in progress]   more test coverage
[in progress]   more proactive decision on cyre init and registrations to minimize run time calculations and overheads
[x]   hot path pipeline compiler
[x]   hot path pipeline executePipeline
  
[x]   publish to NPM: cyre v4.6.0 published

[x]  system channels: useLog subscribes to sensor's log/error stream, useMetrics watches cyre.getMetrics() - see hooks/use-log.ts, hooks/use-metrics.ts
[experimental]   persistent state. load Cyre from saved state, storage and sync with server


[]   DM: Direct Message. ??

//cyre hooks
[in progress]   cyre/use: use-cyre hook easy use hook for cyre functional way
[in progress]   cyre/collectives: use-collective hook
[in progress]   cyre/group: use-group hook
[in progress]   cyre/branch: use-branch hook

//timers and scheduler
[in progress]   Calendar for scheduling tasks
[in progress]  TimeKeeper.cron():

//channel operators/ action talents
[]  .action future talents {
    [done] block: boolean // this channel is no longer available
    onConflict: if call id is already in progress or in timeline: reset | ignore | debounce | update payload only| 
    [done] required: boolean // payload is required on call
    [done]  maxWait: number : boolean
      immutable: boolean // can't modify payload
      noDispatch: boolean //this channel won't be dispatch to .on listeners. 
    [on hold] Multi-Sensor Fusion //combines data from multiple channel payload to create more accurate, reliable, and comprehensive environmental understanding.
    [on hold] Event Pattern Recognition? // detects complex patterns, sequences, and anomalies in channel payload data streams using various algorithmic approaches.
    
    
    }

    Branch System Benefits:
    - Component isolation and reuse
    - No ID namespace collisions
    - Natural parent-child relationships
    - Path-based navigation like URLs
    - Cross-branch communication in same instance


    API: most of them follow these apis protocols. 

      keep/Set(id, new) add new entry. keep for main functions, set for state and small functions
      Get(id string) retrieve by id
      Forget(id string) remove by id
      Clear() clear all entries
      GetAll() retrieve all entries

      //function specific not all should have these
      Status() // provides status information of the function
      GetMetrics()  //only few should have this, returns metrics data, optional id

      //system and lifecycle
      init() // initializes functions that needs init 
      Reset() // rest the app to default, clear all entries specific to main App
      Hibernate() // go to sleep. specific to TimeKeeper
      ShutDown() // clear everything, initiate system shutdown then exit

      action/on/call cyre main methods also know as a channel. they use channel id to communicate to and from.

      outside of these there needs to be priority critical level big table discussion to add new api
  
   
      */

// Import the cyre instance and related utilities from app.ts
import {cyre} from './app'
import {useGroup} from './hooks/use-group'
import {useCyre} from './hooks/use-cyre'
import {useCollective} from './hooks/use-collective'
import {useBranch} from './hooks/use-branch'
import {useLog} from './hooks/use-log'
import {
  useMetrics,
  findUnused,
  findNeverExecuted,
  hottest,
  slowest,
  errorProne
} from './hooks/use-metrics'
import {sensor, LogLevel} from './components/sensor'

// Main exports with branch system
export {
  cyre,
  useCyre,
  useGroup,
  useBranch,
  useCollective,
  useLog, //subscribe to sensor's log/error stream - the previously-TODO'd "system channels: ... on error" listed above
  useMetrics, //live, push-based metrics (events, chart series, per-channel rows) - the previously-commented-out "metrics for external live stat monitors" listed above
  findUnused, //pure analyzers over useMetrics().channels() rows
  findNeverExecuted,
  hottest,
  slowest,
  errorProne,
  //orchestration, //advanced task setup// not sure to expose this
  sensor, //utility logger function
  sensor as log, //utility logger function
  LogLevel //so a useLog({level}) filter can be written without a magic number
}

// Types for the two hooks above
export type {UseLogConfig, LogHook} from './hooks/use-log'
export type {UseMetricsConfig, MetricsHook, MetricsSnapshot} from './hooks/use-metrics'
export type {
  MetricsSample,
  ChannelMetricsRow,
  MetricsEventMap,
  MetricsEventName,
  SlowTaskEvent,
  ChannelErrorEvent,
  RecuperationEvent,
  TickEvent
} from './context/metrics-stream'
export type {SensorEvent, MetricEvent} from './components/sensor'
export type {SensorLogEvent} from './context/sensor-state'
export type {
  ChannelMetricsResult,
  SystemMetricsResult,
  MetricsExportResult
} from './types/system'

// Version information
export const version = '4.6.0'

// Also export cyre as the default export for maximum compatibility
export default cyre
