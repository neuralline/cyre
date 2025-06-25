// src/schema/talent-definitions.ts
// Core talent definitions with fast execution cache

import type {IO} from '../types/core'
import {sensor} from '../context/metrics-report'
import payloadState from '../context/payload-state'
import {io} from '../context/state'
import {metricsState} from '../context/metrics-state'

/*

      C.Y.R.E - T.A.L.E.N.T - D.E.F.I.N.I.T.I.O.N.S
      
      Fast talent execution system with:
      - Pre-compiled talent functions in cache for performance
      - Individual talent testing support
      - Pipeline execution optimization
      - Three-phase architecture support

*/

export interface TalentResult {
  ok: boolean
  payload?: any
  message?: string
  error?: boolean
}

export type TalentFunction = (action: IO, payload: any) => TalentResult

export type TalentName =
  | 'block'
  | 'throttle'
  | 'debounce'
  | 'schema'
  | 'condition'
  | 'selector'
  | 'transform'
  | 'detectChanges'
  | 'required'
  | 'schedule'
  | 'auth'

// Performance-optimized talent function cache
const talentFunctionCache = new Map<string, TalentFunction>()

/**
 * Initialize talent cache with pre-compiled functions
 */
const initializeTalentCache = (): void => {
  // Block talent (protection)
  talentFunctionCache.set('block', (action: IO, payload: any): TalentResult => {
    if (!action.block) {
      return {ok: true, payload}
    }

    if (action.block === true) {
      return {
        ok: false,
        payload,
        message: 'Action is blocked'
      }
    }

    return {ok: true, payload}
  })

  // Throttle talent (protection)
  talentFunctionCache.set(
    'throttle',
    (action: IO, payload: any): TalentResult => {
      if (!action.throttle) {
        return {ok: true, payload}
      }

      try {
        const metrics = io.getMetrics(action.id)
        const now = Date.now()
        const timeSinceLastExecution = now - (metrics?.lastExecutionTime || 0)

        if (timeSinceLastExecution < action.throttle) {
          const remaining = action.throttle - timeSinceLastExecution
          return {
            ok: false,
            payload,
            message: `Throttled - ${remaining}ms remaining`
          }
        }

        return {ok: true, payload}
      } catch (error) {
        // If throttle check fails, allow execution
        return {ok: true, payload}
      }
    }
  )

  // Debounce talent (protection)
  talentFunctionCache.set(
    'debounce',
    (action: IO, payload: any): TalentResult => {
      if (!action.debounce) {
        return {ok: true, payload}
      }

      try {
        const metrics = metricsState.get(action.id)
        if (metrics?.breathing?.isRecuperating) {
          return {
            ok: false,
            payload,
            message: 'Debounced - system recuperating'
          }
        }

        return {ok: true, payload}
      } catch (error) {
        return {ok: true, payload}
      }
    }
  )

  // Schema validation talent
  talentFunctionCache.set(
    'schema',
    (action: IO, payload: any): TalentResult => {
      if (!action.schema) {
        return {ok: true, payload}
      }

      try {
        const validationResult = action.schema(payload)

        if (validationResult && validationResult.ok) {
          return {
            ok: true,
            payload: validationResult.data || payload,
            message: 'Schema validation passed'
          }
        }

        return {
          ok: false,
          error: true,
          payload,
          message: 'Schema validation failed'
        }
      } catch (error) {
        return {
          ok: false,
          error: true,
          payload,
          message: `Schema error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  )

  // Required validation talent
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

  // Selector talent (fast function execution)
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
          error: true,
          payload,
          message: `Selector error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  )

  // Condition talent (fast boolean check)
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
            message: 'Condition not met - execution skipped'
          }
        }
      } catch (error) {
        return {
          ok: false,
          error: true,
          payload,
          message: `Condition error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  )

  // Transform talent (fast transformation)
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
          error: true,
          payload,
          message: `Transform error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  )

  // Change detection talent (optimized comparison)
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
export const executeTalent = (
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
 * Talents object for individual testing and direct access
 */
export const talents = {
  block: (action: IO, payload: any) => executeTalent('block', action, payload),
  throttle: (action: IO, payload: any) =>
    executeTalent('throttle', action, payload),
  debounce: (action: IO, payload: any) =>
    executeTalent('debounce', action, payload),
  schema: (action: IO, payload: any) =>
    executeTalent('schema', action, payload),
  condition: (action: IO, payload: any) =>
    executeTalent('condition', action, payload),
  selector: (action: IO, payload: any) =>
    executeTalent('selector', action, payload),
  transform: (action: IO, payload: any) =>
    executeTalent('transform', action, payload),
  detectChanges: (action: IO, payload: any) =>
    executeTalent('detectChanges', action, payload),
  required: (action: IO, payload: any) =>
    executeTalent('required', action, payload)
} as const

/**
 * Optimized pipeline execution with early termination
 */
export const executePipeline = (action: IO, payload: any): TalentResult => {
  // Pre-check if we have any processing talents
  if (!action._processingPipeline || action._processingPipeline.length === 0) {
    return {ok: true, payload}
  }

  let currentPayload = payload
  const pipeline = action._processingPipeline

  // Execute talents in sequence with early termination
  for (let i = 0; i < pipeline.length; i++) {
    const talentName = pipeline[i]
    const result = executeTalent(talentName, action, currentPayload)

    if (!result.ok) {
      // Log only on failures to reduce overhead
      sensor.log(action.id, 'skip', 'talent-execution-blocked', {
        talentName,
        position: i,
        totalTalents: pipeline.length,
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
    talentCount: pipeline.length,
    payloadTransformed: currentPayload !== payload
  })

  return {
    ok: true,
    payload: currentPayload,
    message: `${pipeline.length} talents executed successfully`
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
