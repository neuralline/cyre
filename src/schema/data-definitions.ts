// src/schema/data-definitions.ts
// Data validation with performance optimization and talent discovery

import {schema} from '../schema/cyre-schema'
import type {IO} from '../types/core'
import {hasTalent, type TalentName} from './talent-definitions'
import {pathEngine} from './path-engine'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - D.A.T.A - D.E.F.I.N.I.T.I.O.N.S
      
      Performance optimized data validation:
      - Fast inline validation for simple types (boolean, string, number)
      - Schema validation only for complex objects
      - Validation result caching for repeated patterns
      - Plugin architecture for extensible validation rules
      - Better error context with field paths and suggestions

*/

interface DataDefResult {
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

// Helper to discover talent from field name

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
  _branchId: (value: any): DataDefResult => {
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
    if (!pathEngine.isValidPath(value)) {
      const result = {
        ok: false,
        error: 'Path must be valid hierarchical path',
        suggestions: [
          'Use forward slashes: "app/users/profile"',
          'Avoid special characters except hyphens and underscores'
        ]
      } as DataDefResult

      if (cacheKey) validationCache.set(cacheKey, result)
      return result
    }

    const segments = pathEngine.parse(value)
    if (segments.length === 0) {
      return {
        ok: false,
        error: 'Path cannot be empty segments',
        suggestions: ['Provide at least one path segment']
      }
    }

    // Fast validation for segment names
    const invalidSegments = segments.filter(
      segment => !/^[a-zA-Z0-9\-_]+$/.test(segment)
    )
    if (invalidSegments.length > 0) {
      return {
        ok: false,
        error: `Path segments can only contain letters, numbers, hyphens, and underscores. Invalid: ${invalidSegments.join(
          ', '
        )}`,
        suggestions: [
          'Use only alphanumeric characters, hyphens, and underscores in path segments'
        ]
      }
    }

    const result = {ok: true, data: value}
    if (cacheKey) {
      // Clean cache if it gets too large
      if (validationCache.size >= CACHE_SIZE_LIMIT) {
        validationCache.clear()
      }
      validationCache.set(cacheKey, result)
    }
    return result
  },

  // Fast boolean validations with caching
  block: (value: any): DataDefResult => {
    const cacheKey = createCacheKey('block', value)
    if (cacheKey && validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey)!
    }

    let result: DataDefResult
    if (!isBoolean(value)) {
      result = {
        ok: false,
        error: 'Block must be boolean',
        suggestions: ['Use true to block action, false to allow']
      }
    } else if (value === true) {
      result = {
        ok: false,
        error: 'Service not available',
        blocking: true
      }
    } else {
      result = {ok: true, data: value, talentName: 'block'}
    }

    if (cacheKey) validationCache.set(cacheKey, result)
    return result
  },

  log: (value: any): DataDefResult => {
    const cacheKey = createCacheKey('log', value)
    if (cacheKey && validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey)!
    }

    const result = !isBoolean(value)
      ? {
          ok: false,
          error: 'Log must be boolean',
          suggestions: ['Use true to enable logging, false to disable']
        }
      : {ok: true, data: value}

    if (cacheKey) validationCache.set(cacheKey, result)
    return result
  },

  // Fast number validations
  throttle: (value: any): DataDefResult => {
    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: 'Throttle must be non-negative number',
        suggestions: ['Use milliseconds, e.g., 1000 for 1 second throttle']
      }
    }
    return {ok: true, data: value, talentName: 'throttle'}
  },

  debounce: (value: any): DataDefResult => {
    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: 'Debounce must be non-negative number',
        suggestions: ['Use milliseconds, e.g., 300 for 300ms debounce']
      }
    }
    return {ok: true, data: value, talentName: 'debounce'}
  },

  interval: (value: any): DataDefResult => {
    if (!isNumber(value) || value <= 0) {
      return {
        ok: false,
        error: 'Interval must be positive number',
        suggestions: ['Use milliseconds, e.g., 5000 for 5 second interval']
      }
    }
    return {ok: true, data: value, talentName: 'interval'}
  },

  delay: (value: any): DataDefResult => {
    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: 'Delay must be non-negative number',
        suggestions: ['Use milliseconds, e.g., 2000 for 2 second delay']
      }
    }
    return {ok: true, data: value, talentName: 'interval'}
  },

  repeat: (value: any): DataDefResult => {
    if (!isNumber(value) && !isBoolean(value)) {
      return {
        ok: false,
        error: 'Repeat must be number or boolean',
        suggestions: [
          'Use number for specific count, true for infinite, false to disable'
        ]
      }
    }
    if (isNumber(value) && value < 0) {
      return {
        ok: false,
        error: 'Repeat cannot be negative',
        suggestions: ['Use positive number or 0 to disable']
      }
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

  maxWait: (value: any): DataDefResult => {
    if (!isNumber(value) || value <= 0) {
      return {
        ok: false,
        error: 'MaxWait must be positive number',
        suggestions: ['Use milliseconds, should be greater than debounce value']
      }
    }
    return {ok: true, data: value}
  },

  // Function validations (fast type check)
  schema: (value: any): DataDefResult => {
    if (typeof value !== 'function') {
      return {
        ok: false,
        error: 'Schema must be a validation function',
        suggestions: [
          'Use cyre-schema validators or custom validation function'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'schema'}
  },

  condition: (value: any): DataDefResult => {
    if (typeof value !== 'function') {
      return {
        ok: false,
        error: 'Condition must be a function',
        suggestions: [
          'Provide function that returns boolean: (payload) => boolean'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'condition'}
  },

  selector: (value: any): DataDefResult => {
    if (typeof value !== 'function') {
      return {
        ok: false,
        error: 'Selector must be a function',
        suggestions: [
          'Provide function to extract data: (payload) => selectedData'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'selector'}
  },

  transform: (value: any): DataDefResult => {
    if (typeof value !== 'function') {
      return {
        ok: false,
        error: 'Transform must be a function',
        suggestions: [
          'Provide function to transform data: (payload) => transformedData'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'transform'}
  },

  required: (value: any): DataDefResult => {
    if (!isBoolean(value) && value !== 'non-empty') {
      return {
        ok: false,
        error: 'Required must be boolean or "non-empty"',
        suggestions: [
          'Use true for required, false for optional, "non-empty" for non-empty check'
        ]
      }
    }
    return {ok: true, data: value, talentName: 'required'}
  },

  detectChanges: (value: any): DataDefResult => {
    if (!isBoolean(value)) {
      return {
        ok: false,
        error: 'DetectChanges must be boolean',
        suggestions: ['Use true to enable change detection, false to disable']
      }
    }
    return {ok: true, data: value, talentName: 'detectChanges'}
  },

  // Array validation (fast type check)
  middleware: (value: any): DataDefResult => {
    if (!isArray(value)) {
      return {
        ok: false,
        error: 'Middleware must be an array',
        suggestions: ['Provide array of middleware functions']
      }
    }
    return {ok: true, data: value}
  },

  // Complex object validation - fast validation instead of schema
  priority: (value: any): DataDefResult => {
    if (!isObject(value)) {
      return {
        ok: false,
        error: 'Priority must be an object',
        suggestions: ['Use {level: "medium", maxRetries: 3, timeout: 5000}']
      }
    }

    // Fast validation for priority object
    const validLevels = ['critical', 'high', 'medium', 'low', 'background']

    if (!value.level || !validLevels.includes(value.level)) {
      return {
        ok: false,
        error: `Priority level must be one of: ${validLevels.join(', ')}`,
        suggestions: ['Valid levels: critical, high, medium, low, background']
      }
    }

    // Optional number fields - fast validation
    const numberFields = ['maxRetries', 'timeout', 'baseDelay', 'maxDelay']
    for (const field of numberFields) {
      if (value[field] !== undefined && !isNumber(value[field])) {
        return {
          ok: false,
          error: `Priority ${field} must be a number`,
          suggestions: [`Set ${field} to a positive number or remove it`]
        }
      }
    }

    return {ok: true, data: value}
  },

  // Pass-through attributes (no validation needed)
  type: (value: any): DataDefResult => ({ok: true, data: value}),
  payload: (value: any): DataDefResult => ({ok: true, data: value}),
  group: (value: any): DataDefResult => ({ok: true, data: value}),
  tags: (value: any): DataDefResult => ({ok: true, data: value}),

  // Internal optimization flags (pass-through)
  _hasFastPath: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasProtections: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasProcessing: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasScheduling: (value: any): DataDefResult => ({ok: true, data: value}),
  _hasIntelligence: (value: any): DataDefResult => ({ok: true, data: value}),
  _intelligenceConfig: (value: any): DataDefResult => ({ok: true, data: value}),
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
  const compiledAction: Partial<IO> = {}
  const processingPipeline: TalentName[] = []

  // Track talent categories
  let hasProtections = false
  let hasScheduling = false
  let hasIntelligence = false

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
        }

        // Enhanced error with suggestions
        let errorMessage = `${key}: ${result.error}`
        if (result.suggestions && result.suggestions.length > 0) {
          errorMessage += ` (${result.suggestions.join(', ')})`
        }

        log.error(
          `data-definitions verification failed ${key}: ${result.error}`
        )
        errors.push(errorMessage)
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
            hasIntelligence = true
          }
        }
      }
    } else {
      // Pass through unknown fields with warning
      compiledAction[key as keyof IO] = value
      warnings.push(`Unknown field: ${key} - passed through without validation`)
      log.warn(`data-definitions unknown definition: ${key}`)
    }
  }

  // Cross-attribute validation with detailed warnings
  const crossValidationResult = validateCrossAttributes(compiledAction as IO)
  errors.push(...crossValidationResult.errors)
  warnings.push(...crossValidationResult.warnings)

  // Set optimization flags
  const hasProcessing = processingPipeline.length > 0
  const hasFastPath =
    !hasProtections && !hasProcessing && !hasScheduling && !hasIntelligence

  // Performance warnings
  if (processingPipeline.length > 5) {
    warnings.push(
      'Long processing pipeline detected - consider combining transforms'
    )
  }

  if (hasProtections && hasScheduling) {
    warnings.push(
      'Both protections and scheduling active - verify configuration'
    )
  }

  // Build final compiled action
  const finalAction: IO = {
    ...compiledAction,
    _hasFastPath: hasFastPath,
    _hasProtections: hasProtections,
    _hasProcessing: hasProcessing,
    _hasScheduling: hasScheduling,
    _hasIntelligence: hasIntelligence,
    _intelligenceConfig: null,
    _processingTalents: processingPipeline,
    _isBlocked: false
  } as IO

  return {
    compiledAction: finalAction,
    errors,
    warnings,
    hasFastPath
  }
}

/**
 * Cross-attribute validation with warnings
 */
const validateCrossAttributes = (
  action: IO
): {errors: string[]; warnings: string[]} => {
  const errors: string[] = []
  const warnings: string[] = []

  // Interval requires repeat
  if (action.interval !== undefined && action.repeat === undefined) {
    errors.push(
      'interval requires repeat to be specified (suggestion: add repeat: true for infinite)'
    )
  }

  // Throttle and debounce conflict
  if (
    action.throttle &&
    action.debounce &&
    action.throttle > 0 &&
    action.debounce > 0
  ) {
    errors.push(
      'throttle and debounce cannot both be active (suggestion: choose one based on use case)'
    )
  }

  // MaxWait requires debounce
  if (action.maxWait !== undefined && action.debounce === undefined) {
    errors.push('maxWait requires debounce to be specified')
  }

  if (action.maxWait && action.debounce && action.maxWait <= action.debounce) {
    errors.push(
      'maxWait must be greater than debounce (suggestion: set maxWait to at least 2x debounce)'
    )
  }

  // Performance warnings for path
  if (action.path) {
    const segments = pathEngine.parse(action.path)

    if (segments.length > 10) {
      warnings.push('path depth exceeds 10 levels - may impact performance')
    }

    if (segments.length > 6) {
      warnings.push(
        'deep path detected - consider flattening for better performance'
      )
    }

    // Check for reserved path segments
    const reservedSegments = ['system', 'internal', '_', '__']
    const conflictingSegments = segments.filter(segment =>
      reservedSegments.includes(segment.toLowerCase())
    )

    if (conflictingSegments.length > 0) {
      errors.push(
        `path contains reserved segments: ${conflictingSegments.join(
          ', '
        )} (suggestion: use different names)`
      )
    }
  }

  // Performance warnings for timing configurations
  if (action.throttle && action.throttle < 16) {
    warnings.push(
      'throttle below 16ms may cause performance issues - consider using requestAnimationFrame'
    )
  }

  if (action.debounce && action.debounce < 100) {
    warnings.push(
      'very short debounce may be ineffective - consider 100ms or higher'
    )
  }

  if (action.interval && action.interval < 1000) {
    warnings.push(
      'frequent intervals may impact performance - monitor system load'
    )
  }

  return {errors, warnings}
}

// Clear validation cache utility
export const clearValidationCache = (): void => {
  validationCache.clear()
  log.info('Validation cache cleared')
}

// Get cache statistics
export const getValidationCacheStats = (): {
  size: number
  limit: number
  hitRate?: number
} => {
  return {
    size: validationCache.size,
    limit: CACHE_SIZE_LIMIT
  }
}
