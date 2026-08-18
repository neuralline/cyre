// src/context/schedule-state.ts
// State for cyre-schedule.ts's timeline task registry

import type {TimelineTask, TaskTrigger} from '../types/timeline'
import {createStore} from './create-store'

/*

      C.Y.R.E - S.C.H.E.D.U.L.E - S.T.A.T.E

      Task/timer/trigger registries for the schedule system, pulled out of
      cyre-schedule.ts into context/state the same way io/subscribers/timeline
      live in state.ts and orchestration runtimes live in orchestration-engine
      via createStore - no local module-level Maps, so this stays visible to
      the rest of the app (introspection, metrics) instead of being private
      to one file.

*/

const tasks = createStore<TimelineTask>()
const timerIds = createStore<string[]>() // task ID -> active timer/timeout IDs
const triggers = createStore<TaskTrigger[]>() // task ID -> its triggers

export const scheduleState = Object.freeze({
  tasks,
  timerIds,
  triggers
})

export default scheduleState
