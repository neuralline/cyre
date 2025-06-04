// src/schema/talent-definitions.ts
// Talent definitions using plugin approach

import type {CyreResponse, IO} from '../types/core'
import {metricsState} from '../context/metrics-state'
import {sensor} from '../context/metrics-report'
import {TimeKeeper} from '../components/cyre-timekeeper'
import {io} from '../context/state'
import {pathTalents} from './path-plugin'
import {fusion, patterns} from './fusion-pattern-talents'
import {stateTalents} from './state-talents-plugin'

/*

      C.Y.R.E - T.A.L.E.N.T - D.E.F.I.N.I.T.I.O.N.S
      
      Plugin-based talent system:
      - Protection talents (pre-pipeline)
      - State processing talents (pipeline)
      - Scheduling talents (post-pipeline)
      - Clean plugin architecture

*/

export interface TalentResult {
  ok: boolean
  error?: boolean
  message?: string
  payload?: any
  delay?: number
  schedule?: {
    interval?: number
    delay?: number
    repeat?: number | boolean
  }
}

// ===========================================
// PROTECTION TALENTS (Pre-pipeline - handled in app.call)
// ===========================================

export const block = (action: IO, payload: any): TalentResult => {
  if (action.block === true) {
    sensor.log(action.id, 'blocked', 'talent-block')
    return {
      ok: false,
      message: 'Action is blocked'
    }
  }
  return {ok: true, payload}
}

export const throttle = (action: IO, payload: any): TalentResult => {
  if (!action.throttle || action.throttle <= 0) {
    return {ok: true, payload}
  }

  const metrics = io.getMetrics(action.id)
  const lastExecTime = metrics?.lastExecutionTime || 0

  if (lastExecTime === 0) {
    return {ok: true, payload}
  }

  const elapsed = Date.now() - lastExecTime
  if (elapsed < action.throttle) {
    const remaining = action.throttle - elapsed
    sensor.log(action.id, 'throttle', 'talent-throttle', {
      throttleMs: action.throttle,
      elapsed,
      remaining
    })
    return {
      ok: false,
      message: `Throttled - ${remaining}ms remaining`
    }
  }

  return {ok: true, payload}
}

export const debounce = (action: IO, payload: any): TalentResult => {
  if (!action.debounce || action.debounce <= 0 || action._bypassDebounce) {
    return {ok: true, payload}
  }

  // Clear existing debounce timer
  if (action._debounceTimer) {
    TimeKeeper.forget(action._debounceTimer)
  }

  // Check maxWait constraint
  const firstCallTime = action._firstDebounceCall || Date.now()
  if (action.maxWait && Date.now() - firstCallTime >= action.maxWait) {
    // MaxWait exceeded - allow execution and reset
    action._firstDebounceCall = undefined
    action._debounceTimer = undefined
    return {ok: true, payload}
  }

  // Set up debounce delay
  const timerId = `${action.id}-debounce-${Date.now()}`
  action._debounceTimer = timerId
  action._firstDebounceCall = firstCallTime

  sensor.log(action.id, 'debounce', 'talent-debounce', {
    debounceMs: action.debounce,
    maxWait: action.maxWait,
    firstCallTime,
    timerId: timerId.slice(-8)
  })

  return {
    ok: false,
    message: `Debounced - will execute in ${action.debounce}ms`,
    delay: action.debounce
  }
}

export const recuperation = (action: IO, payload: any): TalentResult => {
  const breathing = metricsState.get().breathing

  if (breathing.isRecuperating && action.priority?.level !== 'critical') {
    sensor.log(action.id, 'blocked', 'talent-recuperation', {
      stress: breathing.stress,
      priority: action.priority?.level || 'medium'
    })
    return {
      ok: false,
      message: 'System is recuperating - only critical actions allowed'
    }
  }

  return {ok: true, payload}
}

// ===========================================
// SCHEDULING TALENTS (Post-pipeline)
// ===========================================

export const scheduleExecution = (action: IO, payload: any): CyreResponse => {
  const interval = action.interval
  const delay = action.delay
  const repeat = action.repeat

  // If no scheduling needed, return success
  if (!interval && !delay && !repeat) {
    return {ok: true, payload, message: 'No scheduling needed'}
  }

  // Use interval for duration, default to delay if no interval
  const duration = interval || delay || 1000
  const actualRepeat = repeat ?? 1

  try {
    const result = TimeKeeper.keep(
      duration,
      async () => {
        // Import here to avoid circular dependency
        const {useDispatch} = await import('../components/cyre-dispatch')
        return await useDispatch(action, payload)
      },
      actualRepeat,
      `${action.id}-scheduled`,
      delay
    )

    if (result.kind === 'error') {
      return {
        ok: false,
        payload: undefined,
        message: `Scheduling failed: ${result.error.message}`
      }
    }

    sensor.log(action.id, 'info', 'talent-schedule', {
      interval,
      delay,
      repeat: actualRepeat,
      timerId: `${action.id}-scheduled`
    })

    return {
      ok: true,
      payload: undefined,
      message: 'Scheduled execution'
      //schedule: {interval, delay, repeat: actualRepeat}
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      payload: undefined,
      message: `Scheduling error: ${errorMessage}`
    }
  }
}

// ===========================================
// TALENT REGISTRY WITH PLUGIN APPROACH
// ===========================================

export const talents = {
  // Protection talents (handled in app.call pre-pipeline)
  block,
  throttle,
  debounce,
  recuperation,
  path: pathTalents,
  pattern: patterns,
  fusion: fusion,

  // Processing talents (handled in processCall pipeline) - FROM PLUGIN
  ...stateTalents,

  // Scheduling talents (handled post-pipeline)
  scheduleExecution
} as const

export type TalentName = keyof typeof talents

// ===========================================
// TALENT UTILITIES
// ===========================================

/**
 * Execute talent by name
 */
export const executeTalent = (
  talentName: TalentName,
  action: IO,
  payload: any
): TalentResult => {
  const talent = talents[talentName]
  if (!talent) {
    return {
      ok: false,
      error: true,
      message: `Unknown talent: ${talentName}`,
      payload
    }
  }

  try {
    return talent(action, payload)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: true,
      message: `Talent ${talentName} failed: ${errorMessage}`,
      payload
    }
  }
}

/**
 * Check if talent exists
 */
export const hasTalent = (name: string): name is TalentName => {
  return name in talents
}

/**
 * Get all talent names
 */
export const getTalentNames = (): TalentName[] => {
  return Object.keys(talents) as TalentName[]
}

/**
 * Execute multiple talents in sequence
 */
export const executeTalentSequence = (
  talentNames: TalentName[],
  action: IO,
  initialPayload: any
): TalentResult => {
  let currentPayload = initialPayload

  for (const talentName of talentNames) {
    const result = executeTalent(talentName, action, currentPayload)

    if (!result.ok) {
      return result
    }

    // Update payload for next talent
    if (result.payload !== undefined) {
      currentPayload = result.payload
    }
  }

  return {
    ok: true,
    payload: currentPayload,
    message: `${talentNames.length} talents executed successfully`
  }
}

/**
 * Main processing pipeline execution - delegates to state talents plugin
 */
export const executeProcessingPipeline = (
  action: IO,
  payload: any
): TalentResult => {
  return stateTalents.executeStatePipeline(action, payload)
}
