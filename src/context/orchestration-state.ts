// src/context/orchestration-state.ts
// State for orchestration-engine.ts's runtime and trigger-subscription registries

import type {OrchestrationRuntime} from '../types/orchestration'
import {createStore} from './create-store'

/*

      C.Y.R.E - O.R.C.H.E.S.T.R.A.T.I.O.N - S.T.A.T.E

      Runtime/trigger-subscription registries for the orchestration engine,
      pulled out of orchestration-engine.ts into context/state the same way
      io/subscribers/timeline live in state.ts and the schedule module's task
      registry lives in schedule-state.ts - no local module-level Maps, so
      this stays visible to the rest of the app (introspection, metrics,
      reset) instead of being private to one file.

      This split also breaks what would otherwise be a circular import:
      metrics-state.ts needs to see orchestration counts for
      getMetrics()/exportMetrics(), and orchestration-engine.ts already
      imports metricsState - if the runtimes lived inside
      orchestration-engine.ts, metricsState importing them back would cycle.

*/

const runtimes = createStore<OrchestrationRuntime>()
const triggerSubscriptions = createStore<() => void>()

export const orchestrationState = Object.freeze({
  runtimes,
  triggerSubscriptions
})

export default orchestrationState
