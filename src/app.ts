// src/app.ts
// Main CYRE application entry point - Refactored modular architecture

import {log} from './components/cyre-log'
import {createCyreInstance, Cyre} from './core/cyre-instance'

/* 
    Neural Line
    Reactive event manager
    C.Y.R.E ~/`SAYER`/
    Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
    Version 4.0.2+ 2025

    Refactored modular architecture with hot/cold path optimization:
    
    ├── core/
    │   ├── cyre-instance.ts      // Main instance creation (150 lines)
    │   ├── cyre-executor.ts      // Execution engine (200 lines)  
    │   ├── cyre-pipeline.ts      // Protection pipeline (150 lines)
    │   └── cyre-lifecycle.ts     // Startup/shutdown (100 lines)
    ├── execution/
    │   ├── immediate-executor.ts // Fast path execution
    │   ├── timed-executor.ts     // Delay/interval execution
    │   └── execution-context.ts  // Shared execution state
    └── protection/
        ├── throttle.ts           // Throttle protection
        ├── debounce.ts           // Debounce actions
        ├── change-detection.ts   // Change detection
        └── middleware.ts         // Middleware processing

    Example use:
      cyre.action({id: 'uber', payload: 44085648634})
      cyre.on('uber', number => {
          console.log('Calling Uber: ', number)
      })
      cyre.call('uber') 

    Cyre's first law: A robot can not injure a human being or allow a human being to be harmed by not helping.
    Cyre's second law: An event system must never fail to execute critical actions nor allow system degradation by refusing to implement proper protection mechanisms.
*/

// Create default instance
const cyre = createCyreInstance('quantum-inceptions')
cyre.initialize()

// Export the instance and factory
export {Cyre, cyre, log}
export default cyre
