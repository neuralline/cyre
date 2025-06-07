// src/schema/talent-definitions.ts
// Talent definitions with proper error reporting and logging

import type {CyreResponse, IO} from '../types/core'
import {metricsState} from '../context/metrics-state'
import {sensor} from '../context/metrics-report'
import {TimeKeeper} from '../components/cyre-timekeeper'
import {io} from '../context/state'
import {pathTalents} from './path-plugin'
import {stateTalents} from './state-talents-plugin'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - T.A.L.E.N.T - D.E.F.I.N.I.T.I.O.N.S
      
      Plugin-based talent system with proper error reporting:
      - Protection talents (pre-pipeline)
      - State processing talents (pipeline)
      - Scheduling talents (post-pipeline)
      - Comprehensive error logging and reporting

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
    sensor.log(action.id, 'blocked', 'talent-block', {
      reason: 'Action is blocked',
      talent: 'block'
    })
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
      remaining,
      talent: 'throttle'
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
    timerId: timerId.slice(-8),
    talent: 'debounce'
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
      priority: action.priority?.level || 'medium',
      talent: 'recuperation'
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
    return {ok: true, payload, message: 'Scheduled'}
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
      sensor.error(action.id, result.error.message, 'talent-schedule-error', {
        interval,
        delay,
        repeat: actualRepeat,
        talent: 'scheduleExecution'
      })

      return {
        ok: false,
        payload: undefined,
        message: `Scheduling failed: ${result.error.message}`
      }
    }

    sensor.log(action.id, 'info', 'talent-schedule-success', {
      interval,
      delay,
      repeat: actualRepeat,
      timerId: `${action.id}-scheduled`,
      talent: 'scheduleExecution'
    })

    return {
      ok: true,
      payload: undefined,
      message: 'Scheduled execution',
      schedule: {interval, delay, repeat: actualRepeat}
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'talent-schedule-exception', {
      interval,
      delay,
      repeat: actualRepeat,
      talent: 'scheduleExecution'
    })

    log.error(`Scheduling talent failed for ${action.id}: ${errorMessage}`)

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

  // Processing talents (handled in processCall pipeline) - FROM PLUGIN
  ...stateTalents,

  // Scheduling talents (handled post-pipeline)
  scheduleExecution
} as const

export type TalentName = keyof typeof talents

// ===========================================
// TALENT UTILITIES WITH BETTER ERROR HANDLING
// ===========================================

/**
 * Execute talent by name with comprehensive error logging
 */
export const executeTalent = (
  talentName: TalentName,
  action: IO,
  payload: any
): TalentResult => {
  const talent = talents[talentName]
  if (!talent) {
    const errorMsg = `Unknown talent: ${talentName}`
    sensor.error(action.id, errorMsg, 'talent-not-found', {
      talentName,
      availableTalents: Object.keys(talents)
    })
    log.error(`${errorMsg} for action ${action.id}`)

    return {
      ok: false,
      error: true,
      message: errorMsg,
      payload
    }
  }

  try {
    const startTime = performance.now()
    const result = talent(action, payload)
    const executionTime = performance.now() - startTime

    // Log talent execution with timing
    sensor.log(action.id, result.ok ? 'info' : 'skip', 'talent-execution', {
      talentName,
      success: result.ok,
      executionTime,
      message: result.message,
      hasError: result.error
    })

    // Log slow talent execution
    if (executionTime > 10) {
      sensor.warn(action.id, `Slow talent execution: ${talentName}`, {
        executionTime,
        talentName,
        threshold: 10
      })
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'talent-execution-exception', {
      talentName,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    })

    log.error(
      `Talent ${talentName} threw exception for ${action.id}: ${errorMessage}`
    )

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
 * Execute multiple talents in sequence with detailed error reporting
 */
export const executeTalentSequence = (
  talentNames: TalentName[],
  action: IO,
  initialPayload: any
): TalentResult => {
  let currentPayload = initialPayload
  const executedTalents: string[] = []
  const failedTalents: string[] = []

  for (const talentName of talentNames) {
    const result = executeTalent(talentName, action, currentPayload)

    if (!result.ok) {
      failedTalents.push(talentName)

      sensor.log(action.id, 'skip', 'talent-sequence-blocked', {
        failedTalent: talentName,
        executedTalents,
        failedTalents,
        reason: result.message
      })

      return {
        ok: false,
        error: result.error,
        message: result.message,
        payload: result.payload
      }
    }

    executedTalents.push(talentName)

    // Update payload for next talent
    if (result.payload !== undefined) {
      currentPayload = result.payload
    }
  }

  sensor.log(action.id, 'success', 'talent-sequence-complete', {
    executedTalents,
    totalTalents: talentNames.length,
    payloadTransformed: currentPayload !== initialPayload
  })

  return {
    ok: true,
    payload: currentPayload,
    message: `${talentNames.length} talents executed successfully`
  }
}

/**
 * Main processing pipeline execution with detailed error reporting
 */
export const executeProcessingPipeline = (
  action: IO,
  payload: any
): TalentResult => {
  try {
    const result = stateTalents.executeStatePipeline(action, payload)

    // Log pipeline result
    sensor.log(
      action.id,
      result.ok ? 'success' : 'skip',
      'processing-pipeline-result',
      {
        success: result.ok,
        message: result.message,
        error: result.error,
        payloadTransformed: result.payload !== payload
      }
    )

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'processing-pipeline-exception', {
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    })

    log.error(`Processing pipeline exception for ${action.id}: ${errorMessage}`)

    return {
      ok: false,
      error: true,
      message: `Processing pipeline failed: ${errorMessage}`,
      payload
    }
  }
}
