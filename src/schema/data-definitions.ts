// src/schema/data-definitions.ts
// Action compilation with talent discovery and pipeline building

import type {IO} from '../types/core'
import type {TalentName} from './talent-definitions'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - D.A.T.A - D.E.F.I.N.I.T.I.O.N.S
      
      Action compilation system with:
      - Talent discovery and validation
      - Pipeline building in user-defined order
      - Fast path optimization
      - Three-phase architecture flagging

*/

export interface DataDefResult {
  ok: boolean
  data?: any
  error?: string
  blocking?: boolean
  talentName?: TalentName
  suggestions?: string[]
}

// Validation result cache for performance
const validationCache = new Map<string, DataDefResult>()
const CACHE_SIZE_LIMIT = 1000

// Helper to create cache key for simple values
const createCacheKey = (fieldName: string, value: any): string => {
  const valueType = typeof value
  if (valueType === 'boolean' || valueType === 'number') {
    return `${fieldName}:${valueType}:${value}`
  }
  if (valueType === 'string' && value.length < 100) {
    return `${fieldName}:${valueType}:${value}`
  }
  return '' // Don't cache complex values
}

// Fast validation helpers
const isString = (value: any): value is string => typeof value === 'string'
const isNumber = (value: any): value is number =>
  typeof value === 'number' && !isNaN(value)
const isBoolean = (value: any): value is boolean => typeof value === 'boolean'
const isArray = (value: any): value is any[] => Array.isArray(value)
const isObject = (value: any): value is object =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Talent categories for optimization flags
const PROTECTION_TALENTS = ['block', 'throttle', 'debounce'] as const

const PROCESSING_TALENTS = [
  'schema',
  'condition',
  'selector',
  'transform',
  'detectChanges',
  'required'
] as const

const SCHEDULING_TALENTS = ['interval', 'delay', 'repeat'] as const

// Main data definitions with performance optimization
export const dataDefinitions: Record<string, (value: any) => DataDefResult> = {
  // Core required - can block (fast validation)
  id: (value: any): DataDefResult => {
    if (!isString(value) || value.length === 0) {
      return {
        ok: false,
        error: 'ID must be non-empty string',
        blocking: true,
        suggestions: ['Provide a unique string identifier for this action']
      }
    }
    return {ok: true, data: value}
  },

  // Path validation with caching
  path: (value: any): DataDefResult => {
    if (value === undefined) {
      return {ok: true, data: undefined}
    }

    if (!isString(value)) {
      return {
        ok: false,
        error: 'Path must be a string',
        suggestions: ['Use format: "app/users/profile"']
      }
    }

    if (value.length === 0) {
      return {ok: true, data: undefined}
    }

    // Check cache first
    const cacheKey = createCacheKey('path', value)
    if (cacheKey && validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey)!
    }

    // Validate path format
    const pathRegex = /^[a-zA-Z0-9/_-]+$/
    if (!pathRegex.test(value)) {
      const result = {
        ok: false,
        error: 'Path contains invalid characters',
        suggestions: ['Use only letters, numbers, /, _, and -']
      }
      if (cacheKey) validationCache.set(cacheKey, result)
      return result
    }

    const result = {ok: true, data: value}
    if (cacheKey) validationCache.set(cacheKey, result)
    return result
  },

  // Protection talents
  block: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (value === true) {
      return {
        ok: false,
        error: 'Service not available',
        blocking: true
      }
    }

    if (!isBoolean(value)) {
      return {
        ok: false,
        error: 'Block must be boolean',
        suggestions: ['Use true to block, false to allow']
      }
    }

    return {ok: true, data: value, talentName: 'block'}
  },

  throttle: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: 'Throttle must be positive number (milliseconds)',
        suggestions: ['Use 1000 for 1 second throttle']
      }
    }

    return {ok: true, data: value, talentName: 'throttle'}
  },

  debounce: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: 'Debounce must be positive number (milliseconds)',
        suggestions: ['Use 300 for 300ms debounce']
      }
    }

    return {ok: true, data: value, talentName: 'debounce'}
  },

  // Processing talents
  schema: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (typeof value !== 'function') {
      return {
        ok: false,
        error: 'Schema must be a validation function',
        suggestions: ['Provide function that returns {ok: boolean, data?: any}']
      }
    }

    return {ok: true, data: value, talentName: 'schema'}
  },

  condition: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (typeof value !== 'function') {
      return {
        ok: false,
        error: 'Condition must be a function',
        suggestions: ['Provide function that returns boolean']
      }
    }

    return {ok: true, data: value, talentName: 'condition'}
  },

  selector: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (typeof value !== 'function') {
      return {
        ok: false,
        error: 'Selector must be a function',
        suggestions: ['Provide function to extract data from payload']
      }
    }

    return {ok: true, data: value, talentName: 'selector'}
  },

  transform: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (typeof value !== 'function') {
      return {
        ok: false,
        error: 'Transform must be a function',
        suggestions: ['Provide function to transform payload']
      }
    }

    return {ok: true, data: value, talentName: 'transform'}
  },

  detectChanges: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isBoolean(value)) {
      return {
        ok: false,
        error: 'DetectChanges must be boolean',
        suggestions: ['Use true to enable change detection']
      }
    }

    return {ok: true, data: value, talentName: 'detectChanges'}
  },

  required: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isBoolean(value) && value !== 'non-empty') {
      return {
        ok: false,
        error: 'Required must be boolean or "non-empty"',
        suggestions: [
          'Use true for required, "non-empty" for non-empty validation'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'required'}
  },

  // Scheduling talents
  interval: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: 'Interval must be positive number (milliseconds)',
        suggestions: ['Use 1000 for 1 second interval']
      }
    }

    return {ok: true, data: value}
  },

  delay: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: 'Delay must be positive number (milliseconds)',
        suggestions: ['Use 1000 for 1 second delay']
      }
    }

    return {ok: true, data: value}
  },

  repeat: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    // Handle boolean values for infinite repeat control
    if (isBoolean(value)) {
      if (value === true) {
        return {ok: true, data: value, talentName: 'interval'}
      }
      // false disables repeat
      return {ok: true, data: false}
    }

    // Handle number values
    if (!isNumber(value)) {
      return {
        ok: false,
        error: 'Repeat must be number greater than 1 or boolean',
        suggestions: [
          'Use number > 1 for specific repeat count: repeat: 5',
          'Use true for infinite repeats: repeat: true',
          'Use false to disable repeats: repeat: false',
          'Examples: repeat: 3 (runs 3 times), repeat: 10 (runs 10 times)',
          'For scheduling: combine with interval for timed repeats',
          'For infinite: repeat: true with interval: 5000 (every 5 seconds)',
          'Note: repeat: 1 means run once (same as no repeat)',
          'Note: repeat: 0 is invalid and will block execution'
        ]
      }
    }

    // Numbers must be greater than 1 (reject 0 and 1)
    if (value < 1) {
      return {
        ok: false,
        error: 'Repeat cannot be negative or zero',
        suggestions: [
          'Use number greater than 1: repeat: 2, repeat: 5, repeat: 10',
          'Use true for infinite repeats: repeat: true',
          'Use false to disable: repeat: false',
          'Zero repeats block execution - use false instead',
          'Negative numbers are invalid for repeat counts'
        ]
      }
    }

    if (value === 1) {
      return {
        ok: false,
        error: 'Repeat value of 1 is redundant',
        suggestions: [
          'Remove repeat property - actions run once by default',
          'Use repeat: 2 or higher for multiple executions',
          'Use repeat: true for infinite repeats with interval',
          'Use repeat: false to explicitly disable repeats',
          'Combine with interval for timed execution: {repeat: 5, interval: 1000}'
        ]
      }
    }

    // Valid number greater than 1
    return {ok: true, data: value, talentName: 'interval'}
  },

  // Additional fields (pass-through)
  payload: (value: any): DataDefResult => ({ok: true, data: value}),
  type: (value: any): DataDefResult => ({ok: true, data: value}),
  priority: (value: any): DataDefResult => ({ok: true, data: value}),
  maxWait: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasFastPath: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasProtections: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasProcessing: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasScheduling: (value: any): DataDefResult => ({ok: true, data: value}),
  _processingPipeline: (value: any): DataDefResult => ({ok: true, data: value}),
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
  warnings: string[]
  hasFastPath: boolean
} => {
  const errors: string[] = []
  const warnings: string[] = []
  const compiledAction: Partial<IO> = {...action}
  const processingPipeline: TalentName[] = []

  // Track talent categories
  let hasProtections = false
  let hasScheduling = false
  let hasProcessing = false

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
            warnings,
            hasFastPath: false
          }
        } else {
          errors.push(result.error || 'Validation failed')
        }
      } else {
        // Store validated value
        compiledAction[key as keyof IO] = result.data

        // Track talent categories and build pipeline
        if (result.talentName) {
          // Check if it's a processing talent and add to pipeline
          if (PROCESSING_TALENTS.includes(result.talentName as any)) {
            processingPipeline.push(result.talentName)
            hasProcessing = true
          }

          // Check protection talents (validated but not in pipeline)
          if (PROTECTION_TALENTS.includes(result.talentName as any)) {
            hasProtections = true
          }
        }

        // Check scheduling talents
        if (SCHEDULING_TALENTS.includes(key as any)) {
          hasScheduling = true
        }
      }
    } else {
      // Unknown field - pass through with warning
      warnings.push(`Unknown field: ${key}`)
      compiledAction[key as keyof IO] = value
    }
  }

  // Determine fast path eligibility
  const hasFastPath = !hasProtections && !hasProcessing && !hasScheduling

  // Set compilation flags
  compiledAction._hasFastPath = hasFastPath
  compiledAction._hasProtections = hasProtections
  compiledAction._hasProcessing = hasProcessing
  compiledAction._hasScheduling = hasScheduling

  // Set processing pipeline if we have processing talents
  if (processingPipeline.length > 0) {
    compiledAction._processingPipeline = processingPipeline
  }

  return {
    compiledAction: compiledAction as IO,
    errors,
    warnings,
    hasFastPath
  }
}

// Plugin architecture for extensible validation
export interface ValidationPlugin {
  name: string
  definitions: Record<string, (value: any) => DataDefResult>
}

const registeredPlugins: ValidationPlugin[] = []

export const registerValidationPlugin = (plugin: ValidationPlugin): void => {
  registeredPlugins.push(plugin)

  // Merge plugin definitions into main definitions
  Object.assign(dataDefinitions, plugin.definitions)

  log.info(`Registered validation plugin: ${plugin.name}`)
}

/**
 * Cache management
 */
export const clearValidationCache = (): void => {
  validationCache.clear()
}

export const getValidationCacheStats = (): {
  size: number
  limit: number
} => {
  return {
    size: validationCache.size,
    limit: CACHE_SIZE_LIMIT
  }
}
