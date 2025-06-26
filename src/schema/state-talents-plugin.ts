// src/schema/state-talents-plugin.ts
// State reactivity talents plugin

import type {IO} from '../types/core'
import type {TalentResult} from './talent-definitions'
import {sensor} from '../context/metrics-report'
import payloadState from '../context/payload-state'

/*

      C.Y.R.E - S.T.A.T.E
                T.A.L.E.N.T.S P.L.U.G.I.N
      
      State reactivity talents:
      - selector: Extract specific parts of payload for processing
      - condition: Only execute when conditions are met
      - transform: Transform payload before passing to handler
      - detectChanges: Skip execution if payload unchanged
      - required: Validate payload existence
      - schema: Validate payload against schema

*/

/**
 * Selector talent - extracts specific part of payload
 */
const selector = (action: IO, payload: any): TalentResult => {
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

    sensor.error(action.id, errorMessage, 'selector-talent')

    return {
      ok: false,
      error: true,
      message: `Selector failed: ${errorMessage}`,
      payload
    }
  }
}

/**
 * Condition talent - checks if execution should proceed
 */
const condition = (action: IO, payload: any): TalentResult => {
  if (!action.condition) {
    return {ok: true, payload}
  }

  try {
    const conditionMet = action.condition(payload)

    if (!conditionMet) {
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

    sensor.error(action.id, errorMessage, 'condition-talent')

    return {
      ok: false,
      error: true,
      message: `Condition check failed: ${errorMessage}`,
      payload
    }
  }
}

/**
 * Transform talent - transforms payload before execution
 */
const transform = (action: IO, payload: any): TalentResult => {
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

    sensor.error(action.id, errorMessage, 'transform-talent')

    return {
      ok: false,
      error: true,
      message: `Transform failed: ${errorMessage}`,
      payload
    }
  }
}

/**
 * Change detection talent - checks if payload has changed from previous
 */
export const detectChanges = (action: IO, payload: any): TalentResult => {
  if (!action.detectChanges || action.detectChanges !== true) {
    return {ok: true, payload}
  }

  try {
    const hasChanged = payloadState.hasChanged(action.id, payload)

    if (!hasChanged) {
      // This is SUCCESSFUL protection, not an error

      return {
        ok: false, // Don't execute, but this is successful protection
        message: 'Payload unchanged - execution skipped',
        payload
      }
    }

    return {
      ok: true,
      payload,
      message: 'Payload changed'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'change-detection')

    return {
      ok: false,
      error: true,
      message: `Change detection failed: ${errorMessage}`,
      payload
    }
  }
}

/**
 * Required payload talent - validates payload existence
 */
const required = (action: IO, payload: any): TalentResult => {
  // Auto-infer required from schema presence if not explicitly set
  const effectiveRequired =
    action.required !== undefined ? action.required : Boolean(action.schema)

  if (!effectiveRequired) {
    return {ok: true, payload}
  }

  if (effectiveRequired === true && payload === undefined) {
    return {
      ok: false,
      message: action.schema
        ? 'Payload required for schema validation'
        : 'Required payload not provided',
      payload
    }
  }

  return {
    ok: true,
    payload,
    message: 'Payload requirement met'
  }
}

/**
 * Schema validation talent - validates payload against schema
 */
const schema = (action: IO, payload: any): TalentResult => {
  if (!action.schema) {
    return {ok: true, payload}
  }

  try {
    const result = action.schema(payload)

    if (!result.ok) {
      return {
        ok: false,
        error: true,
        message: `Schema validation failed: ${result.errors.join(', ')}`,
        payload
      }
    }

    return {
      ok: true,
      payload: result.data, // Use validated/transformed data
      message: 'Schema validation passed'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'schema-talent')

    return {
      ok: false,
      error: true,
      message: `Schema error: ${errorMessage}`,
      payload
    }
  }
}

/**
 * Execute state pipeline in proper order
 * Order: schema -> required -> selector -> condition -> transform -> detectChanges
 */
const executeStatePipeline = (action: IO, payload: any): TalentResult => {
  let currentPayload = payload

  // 1. FIXED: Check required FIRST, with auto-inference from schema
  const effectiveRequired =
    action.required !== undefined ? action.required : Boolean(action.schema) // Auto-infer from schema presence

  if (effectiveRequired) {
    const requiredResult = required(
      {...action, required: effectiveRequired},
      currentPayload
    )
    if (!requiredResult.ok) return requiredResult
    currentPayload = requiredResult.payload
  }

  // 2. Schema validation (after required check)
  if (action.schema) {
    const schemaResult = schema(action, currentPayload)
    if (!schemaResult.ok) return schemaResult
    currentPayload = schemaResult.payload
  }

  // 3. Selector
  if (action.selector) {
    const selectorResult = selector(action, currentPayload)
    if (!selectorResult.ok) return selectorResult
    currentPayload = selectorResult.payload
  }

  // 4. Condition check
  if (action.condition) {
    const conditionResult = condition(action, currentPayload)
    if (!conditionResult.ok) return conditionResult
    currentPayload = conditionResult.payload
  }

  // 5. Transform payload
  if (action.transform) {
    const transformResult = transform(action, currentPayload)
    if (!transformResult.ok) return transformResult
    currentPayload = transformResult.payload
  }

  // 6. Change detection (using transformed payload)
  if (action.detectChanges) {
    const changesResult = detectChanges(action, currentPayload)
    if (!changesResult.ok) return changesResult
    currentPayload = changesResult.payload
  }

  return {
    ok: true,
    payload: currentPayload,
    message: 'State pipeline executed successfully'
  }
}

/**
 * FIXED: Required payload talent with auto-inference
 */

// Export the state talents plugin
export const stateTalents = {
  selector,
  condition,
  transform,
  detectChanges,
  required,
  schema,
  executeStatePipeline
} as const

// Data definitions for state talents
export const stateDataDefinitions = {
  schema: (value: any) => {
    if (!value || typeof value !== 'function') {
      return {ok: false, error: 'Schema must be a validation function'}
    }
    return {ok: true, data: value, talentName: 'schema' as const}
  },

  condition: (value: any) => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Condition must be a function'}
    }
    return {ok: true, data: value, talentName: 'condition' as const}
  },

  selector: (value: any) => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Selector must be a function'}
    }
    return {ok: true, data: value, talentName: 'selector' as const}
  },

  transform: (value: any) => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Transform must be a function'}
    }
    return {ok: true, data: value, talentName: 'transform' as const}
  },

  detectChanges: (value: any) => {
    if (typeof value !== 'boolean') {
      return {ok: false, error: 'DetectChanges must be boolean'}
    }
    return {ok: true, data: value, talentName: 'detectChanges' as const}
  },

  required: (value: any) => {
    if (typeof value !== 'boolean' && value !== 'non-empty') {
      return {ok: false, error: 'Required must be boolean or "non-empty"'}
    }
    return {ok: true, data: value, talentName: 'required' as const}
  }
} as const

const isFunction = (value: any): value is Function =>
  typeof value === 'function'
const isBoolean = (value: any): value is boolean => typeof value === 'boolean'

// State talents validation definitions
const stateValidationDefinitions: Record<
  string,
  (value: any) => DataDefResult
> = {
  schema: (value: any): DataDefResult => {
    if (!isFunction(value)) {
      return {
        ok: false,
        error: 'Schema must be a validation function',
        talentName: 'schema',
        suggestions: [
          'Use cyre-schema validators: schema.object({...})',
          'Provide custom validation function: (payload) => ValidationResult'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'schema'}
  },

  condition: (value: any): DataDefResult => {
    if (!isFunction(value)) {
      return {
        ok: false,
        error: 'Condition must be a function',
        talentName: 'condition',
        suggestions: [
          'Provide function returning boolean: (payload) => boolean',
          'Example: (payload) => payload.status === "active"'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'condition'}
  },

  selector: (value: any): DataDefResult => {
    if (!isFunction(value)) {
      return {
        ok: false,
        error: 'Selector must be a function',
        talentName: 'selector',
        suggestions: [
          'Provide function to extract data: (payload) => selectedData',
          'Example: (payload) => payload.user.id'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'selector'}
  },

  transform: (value: any): DataDefResult => {
    if (!isFunction(value)) {
      return {
        ok: false,
        error: 'Transform must be a function',
        talentName: 'transform',
        suggestions: [
          'Provide function to transform data: (payload) => transformedData',
          'Example: (payload) => ({...payload, processed: true})'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'transform'}
  },

  detectChanges: (value: any): DataDefResult => {
    if (!isBoolean(value)) {
      return {
        ok: false,
        error: 'DetectChanges must be boolean',
        talentName: 'detectChanges',
        suggestions: [
          'Use true to enable change detection',
          'Use false to disable change detection',
          'Change detection compares payload with previous state'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'detectChanges'}
  },

  required: (value: any): DataDefResult => {
    if (!isBoolean(value) && value !== 'non-empty') {
      return {
        ok: false,
        error: 'Required must be boolean or "non-empty"',
        talentName: 'required',
        suggestions: [
          'Use true for required payload validation',
          'Use false for optional payload',
          'Use "non-empty" to check for non-empty values'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'required'}
  }
}

// Export the plugin
export const stateValidationPlugin: ValidationPlugin = {
  name: 'state-talents',
  definitions: stateValidationDefinitions
}
