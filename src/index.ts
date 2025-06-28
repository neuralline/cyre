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
[]   Multi .on subscribers to single .action channel 
[]   Single .on subscriber to multi .action channels 
[]   Add queue option to .action. if true .call to that channel will be queued until .on subscriber registered
[]   Improved react and nextjs support with hooks. low priority
[]   useCyre could take optional ID. if set, it uses that id instead of generated id. so cyre.call can access that useCyre remotely

//external services built on core cyre
[on hold]   cyre/ssr: experimental/testing stage
[on hold]   cyre/stream experimental/testing stage
[on hold]   state-machine: experimental/testing stage
[in progress]   cyre/server: server for client cyre applicants or others

[x]  schema: built in data validation

[in progress]   improve action pipeline. each channel in cyre are independent. so action pipeline should proactively compile actions that apply to specific channel when that channel run. the rest should run with zero overhead. 
[]   Cyre to operate smart, proactive, reactive, logical and be calculated than be full of features
[in progress]   more test coverage
[in progress]   more proactive decision on cyre init and registrations to minimize run time calculations and overheads
  
[]   publish to NPM these are my current todo list. what do you think? any todo suggestions?

[in progress]   system channels: instead of endless cyre.api create system .on listening channels for users to subscribe eg: on initialize, on error, on stress high etc
[experimental]   persistent state. load Cyre from saved state, storage and sync with server


[]   DM: Direct Message. ??

//cyre hooks
[in progress]   cyre/use: use-cyre hook easy use hook for cyre functional way
[in progress]   cyre/collectives: use-collective hook
[in progress]   cyre/group: use-group hook
[in progress][testing]   cyre/branch: use-branch hook

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
    [test] Multi-Sensor Fusion //combines data from multiple channel payload to create more accurate, reliable, and comprehensive environmental understanding.
    [test] Event Pattern Recognition? // detects complex patterns, sequences, and anomalies in channel payload data streams using various algorithmic approaches.
    
    
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
import {log} from './components/cyre-log'
//import {metrics} from '../dev/integration'

// Import schema system

// Import orchestration system
import {orchestration} from './orchestration/orchestration-engine'

// Main exports with branch system
export {
  cyre,
  useCyre,
  useGroup,
  useBranch,
  useCollective,
  orchestration, //advanced task setup// not sure to expose this
  log //utility logger function
  // metrics //Cyre stats fro external live stat monitors
}

// Version information
export const version = '4.6.0'

// Also export cyre as the default export for maximum compatibility
export default cyre

// Global availability for UMD builds
if (typeof window !== 'undefined') {
  ;(window as any).cyre = cyre
}
