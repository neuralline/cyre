// src/schema/talent-definitions.ts
// O(1) talent execution with hot path optimization

import type {IO} from '../types/core'
import payloadState from '../context/payload-state'

/*

      C.Y.R.E - T.A.L.E.N.T - D.E.F.I.N.I.T.I.O.N.S
      
      Hot path optimized talent operators:
      - O(1) talent lookup via Map for maximum performance
      - Operators perform actual tasks and return results
      - Same return interface as data-definitions for consistency
      - Fast pipeline execution with early termination

*/

// Same interface as data-definitions for consistency
export interface TalentResult {
  ok: boolean
  data?: any
  error?: string
  blocking?: boolean
  suggestions?: string[]
}

export type TalentFunction = (action: IO, payload: any) => TalentResult

// O(1) talent operator Map - hot path optimization
export const talentOperators = new Map<string, TalentFunction>([
  [
    'schema',
    (action: IO, payload: any): TalentResult => {
      // OPERATOR: Validate payload against schema and transform if needed
      try {
        const result = action.schema!(payload)

        // Handle boolean results
        if (typeof result === 'boolean') {
          return result
            ? {ok: true, data: payload}
            : {ok: false, error: 'Schema validation failed'}
        }

        // Handle object results with ok property
        if (result && typeof result === 'object' && 'ok' in result) {
          return {
            ok: result.ok,
            data: result.ok
              ? result.data !== undefined
                ? result.data
                : payload
              : undefined,
            error: result.ok
              ? undefined
              : `Schema failed: ${result.errors?.join(', ') || 'Invalid data'}`
          }
        }

        // Fallback for unclear results
        return {ok: true, data: payload}
      } catch (error) {
        return {
          ok: false,
          error: `Schema execution failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  ],

  [
    'required',
    (action: IO, payload: any): TalentResult => {
      // OPERATOR: Check if payload meets requirement and block if not
      const effectiveRequired =
        action.required !== undefined ? action.required : Boolean(action.schema)

      if (!effectiveRequired) {
        return {ok: true, data: payload}
      }

      // Comprehensive required check: undefined, null, empty string, empty array, empty object
      if (payload === undefined || payload === null) {
        return {
          ok: false,
          error: 'Payload is required but received undefined/null',
          blocking: true
        }
      }

      if (typeof payload === 'string' && payload.length === 0) {
        return {
          ok: false,
          error: 'Payload is required but received empty string',
          blocking: true
        }
      }

      if (Array.isArray(payload) && payload.length === 0) {
        return {
          ok: false,
          error: 'Payload is required but received empty array',
          blocking: true
        }
      }

      if (typeof payload === 'object' && Object.keys(payload).length === 0) {
        return {
          ok: false,
          error: 'Payload is required but received empty object',
          blocking: true
        }
      }

      return {ok: true, data: payload}
    }
  ],

  [
    'selector',
    (action: IO, payload: any): TalentResult => {
      // OPERATOR: Extract specific data from payload
      try {
        const selected = action.selector!(payload)
        return {ok: true, data: selected}
      } catch (error) {
        return {
          ok: false,
          error: `Selector execution failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          suggestions: [
            'Check selector function logic',
            'Ensure payload has expected structure'
          ]
        }
      }
    }
  ],

  [
    'condition',
    (action: IO, payload: any): TalentResult => {
      // OPERATOR: Test condition and block execution if not met
      try {
        const conditionMet = action.condition!(payload)

        if (!conditionMet) {
          return {
            ok: false,
            error: 'Condition not met - execution blocked',
            blocking: true
          }
        }

        return {ok: true, data: payload}
      } catch (error) {
        return {
          ok: false,
          error: `Condition execution failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          suggestions: [
            'Check condition function logic',
            'Ensure payload has expected structure'
          ]
        }
      }
    }
  ],

  [
    'transform',
    (action: IO, payload: any): TalentResult => {
      // OPERATOR: Transform payload data
      try {
        const transformed = action.transform!(payload)
        return {ok: true, data: transformed}
      } catch (error) {
        return {
          ok: false,
          error: `Transform execution failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          suggestions: [
            'Check transform function logic',
            'Ensure transform returns valid data'
          ]
        }
      }
    }
  ],

  // In talent-definitions.ts, update the detectChanges operator:

  [
    'detectChanges',
    (action: IO, payload: any): TalentResult => {
      try {
        // Use the built-in hasChanged method from payload-state
        const hasChanges = payloadState.hasChanged(action.id, payload)

        if (!hasChanges) {
          return {
            ok: false,
            error: 'No changes detected - execution blocked',
            blocking: true
          }
        }

        return {ok: true, data: payload}
      } catch (error) {
        // Fail safe - allow execution if change detection fails
        return {ok: true, data: payload}
      }
    }
  ]
])
