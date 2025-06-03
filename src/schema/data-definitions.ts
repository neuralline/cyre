// src/schema/data-definitions.ts
// Data validation with talent discovery and flag setting

import {schema} from '../schema/cyre-schema'
import type {IO, ActionPayload} from '../types/core'
import {hasTalent, type TalentName} from './talent-definitions'

/*

      C.Y.R.E - D.A.T.A - D.E.F.I.N.I.T.I.O.N.S
      
      Data validation with talent integration:
      - Validates all user inputs
      - Sets flags for call processor optimization  
      - Discovers talents by field name matching
      - No pipeline creation for protection talents

*/

interface DataDefResult {
  ok: boolean
  data?: any
  error?: string
  blocking?: boolean
  talentName?: TalentName
}

// Talent categories for optimization flags
const PROTECTION_TALENTS = [
  'block',
  'throttle',
  'debounce',
  'recuperation'
] as const
const PROCESSING_TALENTS = [
  'schema',
  'condition',
  'selector',
  'transform',
  'detectChanges',
  'required'
] as const
const SCHEDULING_TALENTS = ['interval'] as const

// Helper to check if field maps to talent
const discoverTalent = (fieldName: string): TalentName | null => {
  if (hasTalent(fieldName)) {
    return fieldName as TalentName
  }

  // Special cases for compound talents
  if (['interval', 'delay', 'repeat'].includes(fieldName)) {
    return 'interval' // All scheduling fields map to interval talent
  }

  return null
}

// Main data definitions with talent discovery
export const dataDefinitions = {
  // Core required - can block
  id: (value: any): DataDefResult => {
    if (typeof value !== 'string' || value.length === 0) {
      return {ok: false, error: 'ID must be non-empty string', blocking: true}
    }
    return {ok: true, data: value}
  },

  // Blocking conditions
  repeat: (value: any): DataDefResult => {
    if (typeof value !== 'number' && typeof value !== 'boolean') {
      return {ok: false, error: 'Repeat must be number or boolean'}
    }
    if (typeof value === 'number' && value < 0) {
      return {ok: false, error: 'Repeat cannot be negative'}
    }
    if (value === 0) {
      return {
        ok: false,
        error: 'Action configured with repeat: 0',
        blocking: true
      }
    }
    return {ok: true, data: value, talentName: 'interval'}
  },

  block: (value: any): DataDefResult => {
    if (typeof value !== 'boolean') {
      return {ok: false, error: 'Block must be boolean'}
    }
    if (value === true) {
      return {ok: false, error: 'Service not available', blocking: true}
    }
    return {ok: true, data: value, talentName: 'block'}
  },

  // Protection talents (pre-pipeline)
  throttle: (value: any): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'Throttle must be non-negative number'}
    }
    return {ok: true, data: value, talentName: 'throttle'}
  },

  debounce: (value: any): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'Debounce must be non-negative number'}
    }
    return {ok: true, data: value, talentName: 'debounce'}
  },

  // Processing talents (pipeline)
  schema: (value: any): DataDefResult => {
    if (!value || typeof value !== 'function') {
      return {ok: false, error: 'Schema must be a validation function'}
    }
    return {ok: true, data: value, talentName: 'schema'}
  },

  condition: (value: any): DataDefResult => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Condition must be a function'}
    }
    return {ok: true, data: value, talentName: 'condition'}
  },

  selector: (value: any): DataDefResult => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Selector must be a function'}
    }
    return {ok: true, data: value, talentName: 'selector'}
  },

  transform: (value: any): DataDefResult => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Transform must be a function'}
    }
    return {ok: true, data: value, talentName: 'transform'}
  },

  detectChanges: (value: any): DataDefResult => {
    if (typeof value !== 'boolean') {
      return {ok: false, error: 'DetectChanges must be boolean'}
    }
    return {ok: true, data: value, talentName: 'detectChanges'}
  },

  required: (value: any): DataDefResult => {
    if (typeof value !== 'boolean' && value !== 'non-empty') {
      return {ok: false, error: 'Required must be boolean or "non-empty"'}
    }
    return {ok: true, data: value, talentName: 'required'}
  },

  // Scheduling talents (post-pipeline)
  interval: (value: any): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'Interval must be non-negative number'}
    }
    return {ok: true, data: value, talentName: 'interval'}
  },

  delay: (value: any): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'Delay must be non-negative number'}
    }
    return {ok: true, data: value, talentName: 'interval'}
  },

  maxWait: (value: any): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'MaxWait must be non-negative number'}
    }
    return {ok: true, data: value}
  },

  // Priority validation
  priority: (value: any): DataDefResult => {
    if (typeof value !== 'object' || value === null) {
      return {ok: false, error: 'Priority must be an object'}
    }

    const prioritySchema = schema.object({
      level: schema.enums('critical', 'high', 'medium', 'low', 'background'),
      maxRetries: schema.number().optional(),
      timeout: schema.number().optional(),
      fallback: schema.any().optional(),
      baseDelay: schema.number().optional(),
      maxDelay: schema.number().optional()
    })

    const result = prioritySchema(value)
    if (!result.ok) {
      return {
        ok: false,
        error: `Priority validation failed: ${result.errors.join(', ')}`
      }
    }

    return {ok: true, data: result.data}
  },

  // Simple validations
  log: (value: any): DataDefResult => {
    if (typeof value !== 'boolean') {
      return {ok: false, error: 'Log must be boolean'}
    }
    return {ok: true, data: value}
  },

  middleware: (value: any): DataDefResult => {
    if (!Array.isArray(value)) {
      return {ok: false, error: 'Middleware must be an array'}
    }
    return {ok: true, data: value}
  },

  // Pass-through attributes
  type: (value: any): DataDefResult => ({ok: true, data: value}),
  payload: (value: any): DataDefResult => ({ok: true, data: value}),
  group: (value: any): DataDefResult => ({ok: true, data: value}),
  tags: (value: any): DataDefResult => ({ok: true, data: value}),

  // Internal fields (optimization flags)
  _hasFastPath: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasProtections: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasProcessing: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasScheduling: (value: any): DataDefResult => ({ok: true, data: value}),
  _processingTalents: (value: any): DataDefResult => ({ok: true, data: value}),
  _debounceTimer: (value: any): DataDefResult => ({ok: true, data: value}),
  _bypassDebounce: (value: any): DataDefResult => ({ok: true, data: value}),
  _firstDebounceCall: (value: any): DataDefResult => ({ok: true, data: value}),
  _isBlocked: (value: any): DataDefResult => ({ok: true, data: value}),
  _blockReason: (value: any): DataDefResult => ({ok: true, data: value}),
  timestamp: (value: any): DataDefResult => ({ok: true, data: value}),
  timeOfCreation: (value: any): DataDefResult => ({ok: true, data: value})
} as const

/**
 * Compile action with talent discovery and pipeline building
 */
export const compileAction = (
  action: Partial<IO>
): {
  compiledAction: IO
  errors: string[]
  hasFastPath: boolean
} => {
  const errors: string[] = []
  const compiledAction: Partial<IO> = {}
  const processingPipeline: TalentName[] = []

  // Track talent categories
  let hasProtections = false
  let hasScheduling = false

  // Process fields in order to preserve user-defined execution sequence
  const actionKeys = Object.keys(action)

  for (const key of actionKeys) {
    const value = action[key as keyof typeof action]
    const definition = dataDefinitions[key as keyof typeof dataDefinitions]

    if (definition) {
      const result = definition(value)

      if (!result.ok) {
        if (result.blocking) {
          // Early return for blocking conditions
          return {
            compiledAction: {
              ...action,
              _isBlocked: true,
              _blockReason: result.error!
            } as IO,
            errors: [result.error!],
            hasFastPath: false
          }
        }
        errors.push(`${key}: ${result.error}`)
      } else {
        compiledAction[key as keyof IO] = result.data

        // Build pipeline based on talent category
        if (result.talentName) {
          if (PROTECTION_TALENTS.includes(result.talentName as any)) {
            hasProtections = true
          } else if (PROCESSING_TALENTS.includes(result.talentName as any)) {
            // Add to pipeline in user-defined order
            processingPipeline.push(result.talentName)
          } else if (SCHEDULING_TALENTS.includes(result.talentName as any)) {
            hasScheduling = true
          }
        }
      }
    } else {
      // Pass through unknown fields
      compiledAction[key as keyof IO] = value
    }
  }

  // Set optimization flags
  const hasProcessing = processingPipeline.length > 0
  const hasFastPath = !hasProtections && !hasProcessing && !hasScheduling

  // Build final compiled action
  const finalAction: IO = {
    ...compiledAction,
    _hasFastPath: hasFastPath,
    _hasProtections: hasProtections,
    _hasProcessing: hasProcessing,
    _hasScheduling: hasScheduling,
    _processingPipeline: processingPipeline, // Save compiled pipeline
    _isBlocked: false
  } as IO

  return {
    compiledAction: finalAction,
    errors,
    hasFastPath
  }
}

// Remove redundant function - pipeline is now built during compilation
// export const getProcessingTalentsInOrder = (action: IO): TalentName[] => {
