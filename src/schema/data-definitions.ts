// src/schema/data-definitions.ts
// Action compilation with talent discovery and improved validation messages

import type {IO} from '../types/core'
import type {TalentName} from './talent-definitions'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - D.A.T.A - D.E.F.I.N.I.T.I.O.N.S
      
      Action compilation system with improved validation messages:
      - Clear, helpful error messages in British AI assistant style
      - Detailed suggestions for fixing configuration issues
      - Talent discovery and validation
      - Pipeline building in user-defined order
      - Fast path optimization

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
// Helper to describe the actual value received
const describeValue = (value: any): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `array with ${value.length} items`
  if (typeof value === 'object')
    return `object with keys: ${Object.keys(value).join(', ')}`
  if (typeof value === 'string') return `string "${value}"`
  if (typeof value === 'number') return `number ${value}`
  if (typeof value === 'boolean') return `boolean ${value}`
  return `${typeof value}: ${String(value)}`
}

// Fast validation helpers
const isString = (value: any): value is string => typeof value === 'string'
const isNumber = (value: any): value is number =>
  typeof value === 'number' && !isNaN(value)
const isBoolean = (value: any): value is boolean => typeof value === 'boolean'
const isFunction = (value: any): value is Function =>
  typeof value === 'function'

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
// Main data definitions with improved error messages
export const dataDefinitions: Record<string, (value: any) => DataDefResult> = {
  // Core required fields
  id: (value: any): DataDefResult => {
    if (!isString(value) || value.length === 0) {
      return {
        ok: false,
        error: `Channel ID must be a non-empty text value, but received ${describeValue(
          value
        )}`,
        blocking: true,
        suggestions: [
          'Provide a unique text identifier for this channel',
          'Example: "user-validator" or "sensor-IUG576&$"',
          'Avoid spaces - use hyphens or underscores instead'
        ]
      }
    }
    return {ok: true, data: value}
  },

  // Path validation
  path: (value: any): DataDefResult => {
    if (value === undefined) {
      return {ok: true, data: undefined}
    }

    if (!isString(value)) {
      return {
        ok: false,
        error: `Path must be text, but received ${describeValue(value)}`,
        suggestions: [
          'Use hierarchical format like "app/users/profile"',
          'Separate levels with forward slashes',
          'Example: "sensors/temperature/room1"'
        ]
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
        error: `Block must be true or false, but received ${describeValue(
          value
        )}`,
        talentName: 'block',
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
    return {ok: true, data: value, talentName: 'block'}
  },

  // Timing validations
  throttle: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: `Throttle must be a positive number (milliseconds), but received ${describeValue(
          value
        )}`,
        talentName: 'throttle',
        suggestions: [
          'Specify time in milliseconds to limit execution frequency',
          'Example: 1000 for maximum once per second',
          'Use 0 to disable throttling'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'throttle'}
  },

  debounce: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: `Debounce must be a positive number (milliseconds), but received ${describeValue(
          value
        )}`,
        talentName: 'debounce',
        suggestions: [
          'Specify delay in milliseconds to wait for rapid calls to settle',
          'Example: 300 to wait 300ms after last call before executing',
          'Use 0 to disable debouncing'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'debounce'}
  },

  // Processing talents
  schema: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isFunction(value)) {
      return {
        ok: false,
        error: `Schema must be a validation function, but received ${describeValue(
          value
        )}`,
        talentName: 'schema',
        suggestions: [
          'Use cyre-schema builders: schema.object({ name: schema.string() })',
          'Or provide custom function: (data) => ({ ok: true, data })',
          'Function should return { ok: boolean, data?: any, errors?: string[] }'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'schema'}
  },

  // Condition validation (functions)
  condition: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isFunction(value)) {
      return {
        ok: false,
        error: `Condition must be a function that returns true or false, but received ${describeValue(
          value
        )}`,
        talentName: 'condition',
        suggestions: [
          'Function should return boolean: (payload) => boolean',
          'Return true to allow execution, false to skip',
          'Example: (payload) => payload.status === "active"'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'condition'}
  },

  // Selector validation (functions)
  selector: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isFunction(value)) {
      return {
        ok: false,
        error: `Selector must be a function that extracts data, but received ${describeValue(
          value
        )}`,
        talentName: 'selector',
        suggestions: [
          'Function should extract part of your data: (payload) => any',
          'Return the specific data you want to use',
          'Example: (payload) => payload.user.email'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'selector'}
  },

  // Transform validation (functions)
  transform: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isFunction(value)) {
      return {
        ok: false,
        error: `Transform must be a function that modifies data, but received ${describeValue(
          value
        )}`,
        talentName: 'transform',
        suggestions: [
          'Function should return modified data: (payload) => any',
          'Transform and return your data as needed',
          'Example: (payload) => ({ ...payload, processed: true })'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'transform'}
  },

  // Boolean validations with clear explanations
  detectChanges: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isBoolean(value)) {
      return {
        ok: false,
        error: `DetectChanges must be true or false, but received ${describeValue(
          value
        )}`,
        talentName: 'detectChanges',
        suggestions: [
          'Use true to only execute when data changes from previous call',
          'Use false to execute every time regardless of changes',
          'This helps prevent unnecessary processing of duplicate data'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'detectChanges'}
  },

  // Required validation
  required: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isBoolean(value) && value !== 'non-empty') {
      return {
        ok: false,
        error: `Required must be true, false, or "non-empty", but received ${describeValue(
          value
        )}`,
        talentName: 'required',
        suggestions: [
          'Use true to require any value (including empty strings and zero)',
          'Use "non-empty" to require non-empty values (excludes "", [], {})',
          'Use false to make the field optional'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'required'}
  },

  delay: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: `Delay must be a positive number (milliseconds), but received ${describeValue(
          value
        )}`,
        talentName: 'delay',
        suggestions: [
          'Specify initial delay in milliseconds before first execution',
          'Example: 1000 to wait 1 second before executing',
          'Use 0 for immediate execution'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'schedule'}
  },

  interval: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value <= 0) {
      return {
        ok: false,
        error: `Interval must be a positive number (milliseconds), but received ${describeValue(
          value
        )}`,

        suggestions: [
          'Specify time in milliseconds between repeated executions',
          'Example: 5000 to execute every 5 seconds',
          'Must be greater than 0 for repeated execution'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'schedule'}
  },

  repeat: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) && value !== true && value !== false) {
      return {
        ok: false,
        error: `Repeat must be a number, true, or false, but received ${describeValue(
          value
        )}`,

        suggestions: [
          'Use a number to specify exact repetitions (e.g., 5)',
          'Use true for infinite repetitions',
          'Use false or omit to execute only once'
        ]
      }
    }

    if (isNumber(value) && (value < 0 || !Number.isInteger(value))) {
      return {
        ok: false,
        error: `Repeat count must be a positive whole number, but received ${value}`,

        suggestions: [
          'Use positive integers: 1, 2, 3, etc.',
          'Use true for infinite repetitions',
          'Decimals are not allowed for repeat counts'
        ]
      }
    }

    return {ok: true, data: value, talentName: 'schedule'}
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

// Plugin architecture for extensible validation
interface ValidationPlugin {
  name: string
  definitions: Record<string, (value: any) => DataDefResult>
}

const registeredPlugins: ValidationPlugin[] = []

const registerValidationPlugin = (plugin: ValidationPlugin): void => {
  registeredPlugins.push(plugin)

  // Merge plugin definitions into main definitions
  Object.assign(dataDefinitions, plugin.definitions)

  log.info(`Registered validation plugin: ${plugin.name}`)
}

/**
 * Cache management
 */
const clearValidationCache = (): void => {
  validationCache.clear()
}

const getValidationCacheStats = (): {
  size: number
  limit: number
} => {
  return {
    size: validationCache.size,
    limit: CACHE_SIZE_LIMIT
  }
}
