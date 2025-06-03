// src/schema/talent-definitions.ts
// One true source for all talents with consistent structure

import type {ActionPayload, IO} from '../types/core'
import {metricsState} from '../context/metrics-state'
import {sensor} from '../context/metrics-report'
import payloadState from '../context/payload-state'
import {TimeKeeper} from '../components/cyre-timekeeper'
import {io} from '../context/state'
import {log} from '../components/cyre-log'
import {processCall} from '../components/cyre-call'
import {useDispatch} from '../components/cyre-dispatch'

/*

      C.Y.R.E - T.A.L.E.N.T - D.E.F.I.N.I.T.I.O.N.S
      
      One true source for all talents:
      - Consistent (action: IO, payload: any) => TalentResult signature
      - Standard return format
      - Testable outside processCall
      - Easy to add new talents
      - User controls execution order

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
// PROTECTION TALENTS (Pre-pipeline)
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

  // Schedule delayed execution using TimeKeeper
  const timerResult = TimeKeeper.keep(
    action.debounce,
    async () => {
      try {
        // Clear timer reference since we're executing now
        action._debounceTimer = undefined

        sensor.log(action.id, 'info', 'debounce-execution', {
          executedAfterDelay: true,
          timestamp: Date.now(),
          originalTimerId: timerId.slice(-8)
        })

        // Set bypass flag to prevent re-debouncing on callback
        const originalBypass = action._bypassDebounce
        action._bypassDebounce = true

        try {
          // CALLBACK TO PROCESSCALL - This restarts the call flow without debounce
          const result = await processCall(action, payload)

          sensor.log(action.id, 'success', 'debounce-execution-complete', {
            success: result.ok,
            finalMessage: result.message
          })

          return result
        } finally {
          // Restore original bypass flag
          action._bypassDebounce = originalBypass
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        sensor.error(action.id, errorMessage, 'debounce-execution-error')

        // Clear timer reference on error
        action._debounceTimer = undefined

        log.error(`Debounce execution failed for ${action.id}: ${errorMessage}`)

        return {
          ok: false,
          payload: undefined,
          message: `Debounce execution failed: ${errorMessage}`
        }
      }
    },
    1, // Execute once
    timerId
  )

  sensor.log(action.id, 'debounce', 'talent-debounce', {
    debounceMs: action.debounce,
    maxWait: action.maxWait,
    firstCallTime
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
// PROCESSING TALENTS (Pipeline)
// ===========================================

export const schema = (action: IO, payload: any): TalentResult => {
  if (!action.schema) {
    return {ok: true, payload}
  }

  try {
    const result = action.schema(payload)
    if (!result.ok) {
      sensor.log(action.id, 'error', 'talent-schema', {
        errors: result.errors
      })
      return {
        ok: false,
        error: true,
        message: `Schema validation failed: ${result.errors.join(', ')}`,
        payload
      }
    }
    return {
      ok: true,
      payload: result.data,
      message: 'Schema validation passed'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: true,
      message: `Schema error: ${errorMessage}`,
      payload
    }
  }
}

export const condition = (action: IO, payload: any): TalentResult => {
  if (!action.condition) {
    return {ok: true, payload}
  }

  try {
    const conditionMet = action.condition(payload)
    if (!conditionMet) {
      sensor.log(action.id, 'skip', 'talent-condition', {
        reason: 'Condition not met'
      })
      return {
        ok: false,
        message: 'Condition not met - execution skipped',
        payload
      }
    }
    return {
      ok: true,
      payload,
      message: 'Condition met'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: true,
      message: `Condition error: ${errorMessage}`,
      payload
    }
  }
}

export const selector = (action: IO, payload: any): TalentResult => {
  if (!action.selector) {
    return {ok: true, payload}
  }

  try {
    const selectedData = action.selector(payload)
    return {
      ok: true,
      payload: selectedData,
      message: 'Payload selected'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: true,
      message: `Selector error: ${errorMessage}`,
      payload
    }
  }
}

export const transform = (action: IO, payload: any): TalentResult => {
  if (!action.transform) {
    return {ok: true, payload}
  }

  try {
    const transformedPayload = action.transform(payload)
    return {
      ok: true,
      payload: transformedPayload,
      message: 'Payload transformed'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: true,
      message: `Transform error: ${errorMessage}`,
      payload
    }
  }
}

export const detectChanges = (action: IO, payload: any): TalentResult => {
  if (action.detectChanges !== true) {
    return {ok: true, payload}
  }

  const hasChanged = payloadState.hasChanged(action.id, payload)
  if (!hasChanged) {
    sensor.log(action.id, 'skip', 'talent-detect-changes', {
      reason: 'Payload unchanged'
    })
    return {
      ok: false,
      message: 'Payload unchanged - execution skipped',
      payload
    }
  }

  return {
    ok: true,
    payload,
    message: 'Payload changed'
  }
}

export const required = (action: IO, payload: any): TalentResult => {
  if (action.required === undefined) {
    return {ok: true, payload}
  }

  if (action.required === true && payload === undefined) {
    return {
      ok: false,
      message: 'Required payload not provided',
      payload
    }
  }

  if (action.required === 'non-empty') {
    if (
      payload === undefined ||
      payload === null ||
      payload === '' ||
      (Array.isArray(payload) && payload.length === 0) ||
      (typeof payload === 'object' && Object.keys(payload).length === 0)
    ) {
      return {
        ok: false,
        message: 'Non-empty payload required',
        payload
      }
    }
  }

  return {
    ok: true,
    payload,
    message: 'Payload requirement met'
  }
}

// ===========================================
// SCHEDULING TALENTS (Post-pipeline)
// ===========================================

export const scheduleExecution = (action: IO, payload: any): TalentResult => {
  const config = action._scheduleConfig!
  const interval = config.interval || config.delay || 0
  const repeat = config.repeat ?? 1
  const delay = config.delay

  const result = TimeKeeper.keep(
    interval,
    async () => await useDispatch(action, payload),
    repeat,
    action.id,
    delay
  )

  if (result.kind === 'error') {
    return {
      ok: false,
      payload: undefined,
      message: `Scheduling failed: ${result.error.message}`
    }
  }

  return {
    ok: true,
    payload: undefined,
    message: 'Scheduled execution',
    metadata: {scheduled: true, interval, delay, repeat}
  }
}

// ===========================================
// TALENT REGISTRY
// ===========================================

export const talents = {
  // Protection talents
  block,
  throttle,
  debounce,
  recuperation,

  // Processing talents
  schema,
  condition,
  selector,
  transform,
  detectChanges,
  required,

  // Scheduling talents
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
