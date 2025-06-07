// src/schema/talent-definitions-optimized.ts
// Runtime optimized talent execution with minimal overhead

import type {IO} from '../types/core'
import {sensor} from '../context/metrics-report'
import {log} from '../components/cyre-log'
import payloadState from '../context/payload-state'
import {useDispatch} from '../components/cyre-dispatch'
import TimeKeeper from '../components/cyre-timekeeper'

/*

      C.Y.R.E - T.A.L.E.N.T - E.X.E.C.U.T.I.O.N - O.P.T.I.M.I.Z.E.D
      
      Runtime optimized talent execution:
      - Pre-compiled talent function lookups
      - Minimal object creation and memory allocation
      - Fast-fail validation with early returns
      - Cached function references for hot paths
      - Reduced logging overhead in production

*/

export interface TalentResult {
  ok: boolean
  payload?: any
  message?: string
  error?: boolean
  delay?: number
}

// Pre-compiled talent function cache for hot paths
interface TalentFunction {
  (action: IO, payload: any): TalentResult
}

const talentFunctionCache = new Map<string, TalentFunction>()

// Initialize common talent functions
const initializeTalentCache = (): void => {
  // Schema validation (fast path for functions)
  talentFunctionCache.set(
    'schema',
    (action: IO, payload: any): TalentResult => {
      if (!action.schema) {
        return {ok: true, payload}
      }

      try {
        const result = action.schema(payload)
        if (result.ok) {
          return {ok: true, payload: result.data}
        } else {
          return {
            ok: false,
            payload,
            message: `Schema validation failed: ${result.errors.join(', ')}`
          }
        }
      } catch (error) {
        return {
          ok: false,
          payload,
          message: `Schema error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  )

  // Required validation (optimized)
  talentFunctionCache.set(
    'required',
    (action: IO, payload: any): TalentResult => {
      if (!action.required) {
        return {ok: true, payload}
      }

      if (payload === undefined || payload === null) {
        return {
          ok: false,
          payload,
          message: 'Payload is required but not provided'
        }
      }

      if (action.required === 'non-empty') {
        if (
          payload === '' ||
          (Array.isArray(payload) && payload.length === 0) ||
          (typeof payload === 'object' && Object.keys(payload).length === 0)
        ) {
          return {
            ok: false,
            payload,
            message: 'Payload cannot be empty'
          }
        }
      }

      return {ok: true, payload}
    }
  )

  // Selector (fast function execution)
  talentFunctionCache.set(
    'selector',
    (action: IO, payload: any): TalentResult => {
      if (!action.selector) {
        return {ok: true, payload}
      }

      try {
        const selected = action.selector(payload)
        return {ok: true, payload: selected}
      } catch (error) {
        return {
          ok: false,
          payload,
          message: `Selector error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  )

  // Condition (fast boolean check)
  talentFunctionCache.set(
    'condition',
    (action: IO, payload: any): TalentResult => {
      if (!action.condition) {
        return {ok: true, payload}
      }

      try {
        const conditionResult = action.condition(payload)
        if (conditionResult) {
          return {ok: true, payload}
        } else {
          return {
            ok: false,
            payload,
            message: 'Condition check failed'
          }
        }
      } catch (error) {
        return {
          ok: false,
          payload,
          message: `Condition error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  )

  // Transform (fast transformation)
  talentFunctionCache.set(
    'transform',
    (action: IO, payload: any): TalentResult => {
      if (!action.transform) {
        return {ok: true, payload}
      }

      try {
        const transformed = action.transform(payload)
        return {ok: true, payload: transformed}
      } catch (error) {
        return {
          ok: false,
          payload,
          message: `Transform error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  )

  // Change detection (optimized comparison)
  talentFunctionCache.set(
    'detectChanges',
    (action: IO, payload: any): TalentResult => {
      if (!action.detectChanges) {
        return {ok: true, payload}
      }

      try {
        const previousPayload = payloadState.get(action.id)

        // Fast comparison for primitives
        if (previousPayload === payload) {
          return {
            ok: false,
            payload,
            message: 'No payload changes detected'
          }
        }

        // Fast comparison for null/undefined
        if (previousPayload === null || previousPayload === undefined) {
          return {ok: true, payload}
        }

        // For objects, do a shallow comparison first (fast path)
        if (
          typeof payload === 'object' &&
          typeof previousPayload === 'object'
        ) {
          if (JSON.stringify(payload) === JSON.stringify(previousPayload)) {
            return {
              ok: false,
              payload,
              message: 'No payload changes detected'
            }
          }
        }

        return {ok: true, payload}
      } catch (error) {
        // If change detection fails, allow execution
        return {ok: true, payload}
      }
    }
  )
}

// Initialize cache on module load
initializeTalentCache()

/**
 * Fast talent execution with pre-compiled functions
 */
const executeTalentFast = (
  talentName: string,
  action: IO,
  payload: any
): TalentResult => {
  const talentFunction = talentFunctionCache.get(talentName)

  if (!talentFunction) {
    return {
      ok: false,
      error: true,
      message: `Unknown talent: ${talentName}`,
      payload
    }
  }

  try {
    return talentFunction(action, payload)
  } catch (error) {
    return {
      ok: false,
      error: true,
      message: `Talent ${talentName} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      payload
    }
  }
}

/**
 * Optimized pipeline execution with early termination
 */
export const executePipeline = (action: IO, payload: any): TalentResult => {
  // Pre-check if we have any processing talents
  if (!action._processingTalents || action._processingTalents.length === 0) {
    return {ok: true, payload}
  }

  let currentPayload = payload
  const talents = action._processingTalents

  // Execute talents in sequence with early termination
  for (let i = 0; i < talents.length; i++) {
    const talentName = talents[i]
    const result = executeTalentFast(talentName, action, currentPayload)

    if (!result.ok) {
      // Log only on failures to reduce overhead
      sensor.log(action.id, 'skip', 'talent-execution-blocked', {
        talentName,
        position: i,
        totalTalents: talents.length,
        reason: result.message
      })

      return result
    }

    // Update payload for next talent
    if (result.payload !== undefined) {
      currentPayload = result.payload
    }
  }

  // Success - minimal logging
  sensor.log(action.id, 'success', 'pipeline-execution-complete', {
    talentCount: talents.length,
    payloadTransformed: currentPayload !== payload
  })

  return {
    ok: true,
    payload: currentPayload,
    message: `${talents.length} talents executed successfully`
  }
}

/**
 * Optimized scheduling execution (from original talent-definitions)
 */
export const scheduleExecution = (action: IO, payload: any): TalentResult => {
  const interval = action.interval
  const delay = action.delay
  const repeat = action.repeat

  // Fast path - no scheduling needed
  if (!interval && !delay && !repeat) {
    return {ok: true, payload, message: 'No scheduling required'}
  }

  // Import TimeKeeper lazily to avoid circular dependencies

  const duration = interval || delay || 1000
  const actualRepeat = repeat ?? (interval ? true : 1)

  try {
    const result = TimeKeeper.keep(
      duration,
      async () => {
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
        repeat: actualRepeat
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
      timerId: `${action.id}-scheduled`
    })

    return {
      ok: true,
      payload: undefined,
      message: 'Scheduled execution'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'talent-schedule-exception', {
      interval,
      delay,
      repeat: actualRepeat
    })

    return {
      ok: false,
      payload: undefined,
      message: `Scheduling error: ${errorMessage}`
    }
  }
}

/**
 * Clear talent cache (for testing or hot reloading)
 */
export const clearTalentCache = (): void => {
  talentFunctionCache.clear()
  initializeTalentCache()
}

/**
 * Get talent cache statistics
 */
export const getTalentCacheStats = (): {
  size: number
  talents: string[]
} => {
  return {
    size: talentFunctionCache.size,
    talents: Array.from(talentFunctionCache.keys())
  }
}

/**
 * Add custom talent function to cache
 */
export const registerOptimizedTalent = (
  name: string,
  talentFunction: TalentFunction
): void => {
  talentFunctionCache.set(name, talentFunction)
}
