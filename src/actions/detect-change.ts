// src/actions/detection-change.ts

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {io} from '../context/state'
import {metricsReport} from '../context/metrics-report'

/*

    C.Y.R.E - A.C.T.I.O.N.S - C.H.A.N.G.E

    Prevents execution if payload has not changed
    

*/

export const detectChange = (
  action: IO,
  payload: ActionPayload
): CyreResponse => {
  if (!io.hasChanged(action.id, payload)) {
    // Track skip event with lightweight collector - import here to avoid circular deps

    metricsReport.trackProtection(action.id, 'skip')

    return {
      ok: false,
      payload: null,
      message: 'Execution skipped: No changes detected in payload'
    }
  }

  return {
    ok: true,
    payload: null,
    message: 'Change detected'
  }
}
