// src/schema/data-definitions.ts
// Data validation with path support and talent discovery

import {schema} from '../schema/cyre-schema'
import type {IO} from '../types/core'
import {hasTalent, type TalentName} from './talent-definitions'
import {pathEngine} from './path-engine'
import {fusionDataDefinition, patternDataDefinition} from './fusion-plugin'
import {compileIntelligenceConfig} from '../intelligence/intelligence-compiler'

/*

      C.Y.R.E - D.A.T.A - D.E.F.I.N.I.T.I.O.N.S
      
      Data validation with talent integration and path support:
      - Validates all user inputs including path field
      - Sets flags for call processor optimization  
      - Discovers talents by field name matching
      - Path validation and indexing integration

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
  'required',
  'fusion',
  'patterns'
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

// Main data definitions with talent discovery and path support
export const dataDefinitions: Record<string, (value: any) => DataDefResult> = {
  // Core required - can block
  id: (value: any): DataDefResult => {
    if (typeof value !== 'string' || value.length === 0) {
      return {ok: false, error: 'ID must be non-empty string', blocking: true}
    }
    return {ok: true, data: value}
  },
  pattern: patternDataDefinition,
  fusion: fusionDataDefinition,

  // Path validation and indexing
  path: (value: any): DataDefResult => {
    if (value === undefined) {
      return {ok: true, data: undefined}
    }

    if (typeof value !== 'string') {
      return {ok: false, error: 'Path must be a string'}
    }

    if (value.length === 0) {
      return {ok: true, data: undefined} // Empty string treated as no path
    }

    // Validate path format
    if (!pathEngine.isValidPath(value)) {
      return {
        ok: false,
        error:
          'Path must be a valid hierarchical path (e.g., "app/users/profile")'
      }
    }

    // Check for path conflicts (multiple channels with same path)
    const segments = pathEngine.parse(value)
    if (segments.length === 0) {
      return {ok: false, error: 'Path cannot be empty segments'}
    }

    // Validate segment names (no special characters except allowed ones)
    const invalidSegments = segments.filter(
      segment => !/^[a-zA-Z0-9\-_]+$/.test(segment)
    )

    if (invalidSegments.length > 0) {
      return {
        ok: false,
        error: `Path segments can only contain letters, numbers, hyphens, and underscores. Invalid: ${invalidSegments.join(
          ', '
        )}`
      }
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
  _processingPipeline: (value: any): DataDefResult => ({ok: true, data: value}),
  _debounceTimer: (value: any): DataDefResult => ({ok: true, data: value}),
  _bypassDebounce: (value: any): DataDefResult => ({ok: true, data: value}),
  _firstDebounceCall: (value: any): DataDefResult => ({ok: true, data: value}),
  _isBlocked: (value: any): DataDefResult => ({ok: true, data: value}),
  _blockReason: (value: any): DataDefResult => ({ok: true, data: value}),
  timestamp: (value: any): DataDefResult => ({ok: true, data: value}),
  timeOfCreation: (value: any): DataDefResult => ({ok: true, data: value})
}

/**
 * Compile action with talent discovery, pipeline building, and path indexing
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
  let hasIntelligence = false // NEW

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
          } else if (['fusion', 'patterns'].includes(result.talentName)) {
            hasIntelligence = true // NEW
          }
        }
      }
    } else {
      // Pass through unknown fields
      compiledAction[key as keyof IO] = value
    }
  }

  // Cross-attribute validation
  const crossValidationErrors = validateCrossAttributes(compiledAction as IO)
  errors.push(...crossValidationErrors)

  // NEW: Compile intelligence configuration for performance
  let intelligenceConfig = null
  if (hasIntelligence) {
    try {
      intelligenceConfig = compileIntelligenceConfig(compiledAction as IO)
    } catch (error) {
      errors.push(`Intelligence compilation failed: ${error}`)
    }
  }

  // Set optimization flags
  const hasProcessing = processingPipeline.length > 0
  const hasFastPath =
    !hasProtections && !hasProcessing && !hasScheduling && !hasIntelligence

  // Build final compiled action
  const finalAction: IO = {
    ...compiledAction,
    _hasFastPath: hasFastPath,
    _hasProtections: hasProtections,
    _hasProcessing: hasProcessing,
    _hasScheduling: hasScheduling,
    _hasIntelligence: hasIntelligence, // NEW
    _intelligenceConfig: intelligenceConfig, // NEW
    _processingTalents: processingPipeline,
    _isBlocked: false
  } as IO

  return {
    compiledAction: finalAction,
    errors,
    hasFastPath
  }
}

/**
 * Cross-attribute validation
 */
const validateCrossAttributes = (action: IO): string[] => {
  const errors: string[] = []

  // Interval requires repeat
  if (action.interval !== undefined && action.repeat === undefined) {
    errors.push('interval requires repeat to be specified')
  }

  // Throttle and debounce conflict
  if (
    action.throttle &&
    action.debounce &&
    action.throttle > 0 &&
    action.debounce > 0
  ) {
    errors.push('throttle and debounce cannot both be active')
  }

  // MaxWait requires debounce
  if (action.maxWait !== undefined && action.debounce === undefined) {
    errors.push('maxWait requires debounce to be specified')
  }

  if (action.maxWait && action.debounce && action.maxWait <= action.debounce) {
    errors.push('maxWait must be greater than debounce')
  }

  // Path validation (additional cross-checks)
  if (action.path) {
    const segments = pathEngine.parse(action.path)

    // Check for reasonable path depth
    if (segments.length > 10) {
      errors.push('path depth should not exceed 10 levels for performance')
    }

    // Check for reserved path segments
    const reservedSegments = ['system', 'internal', '_', '__']
    const conflictingSegments = segments.filter(segment =>
      reservedSegments.includes(segment.toLowerCase())
    )

    if (conflictingSegments.length > 0) {
      errors.push(
        `path contains reserved segments: ${conflictingSegments.join(', ')}`
      )
    }
  }

  return errors
}
