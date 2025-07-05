// src/schema/data-definitions.ts
// Action compilation with talent discovery and improved validation messages

import type {
  IO,
  ChannelOperator,
  ExecutionOperator,
  ErrorStrategy,
  CollectStrategy
} from '../types/core'

/*

      C.Y.R.E - D.A.T.A - D.E.F.I.N.I.T.I.O.N.S
      
      Channel Operator's verification and compilation system with improved validation messages:
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
  operator?: ChannelOperator
  suggestions?: string[]
}
export interface DataResult {
  ok: boolean
  data?: any
  error?: string
  operator?: string
  blocking?: boolean
  suggestions?: string[]
}

type DataFunction = (value: any, action?: Partial<IO>) => DataResult

// Valid execution operators
const VALID_EXECUTION_OPERATORS: ExecutionOperator[] = [
  'single',
  'parallel',
  'sequential',
  'race',
  'waterfall'
]

// Valid error strategies
const VALID_ERROR_STRATEGIES: ErrorStrategy[] = [
  'fail-fast',
  'continue',
  'retry'
]

// Valid collect strategies
const VALID_COLLECT_STRATEGIES: (CollectStrategy | boolean)[] = [
  'first',
  'last',
  'all',
  true,
  false
]
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
          'Path must be url friendly string',
          'Example: "sensors/temperature/room1"'
        ]
      }
    }

    if (value.length === 0) {
      return {ok: true, data: undefined}
    }

    // Validate path format
    const pathRegex = /^[a-zA-Z0-9/_-]+$/
    if (!pathRegex.test(value)) {
      return {
        // FIX: Actually return the error result
        ok: false,
        error: 'Path contains invalid characters',
        suggestions: ['Use only letters, numbers, /, _, and -']
      }
    }

    return {ok: true, data: value}
  },
  // Protection talents
  block: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (value === true) {
      return {
        ok: false,
        error: 'Channel is blocked from execution',
        blocking: true
      }
    }

    if (!isBoolean(value)) {
      return {
        ok: false,
        error: `Block must be true or false, but received ${describeValue(
          value
        )}`,
        suggestions: [
          'Use true to prevent channel execution entirely',
          'Use false or omit to allow normal execution',
          'Block is useful for temporarily disabling channels'
        ]
      }
    }

    return {ok: true, data: value, operator: 'block'}
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
        suggestions: [
          'Specify time in milliseconds to limit execution frequency',
          'Example: 1000 for maximum once per second',
          'Use 0 to disable throttling'
        ]
      }
    }

    return {ok: true, data: value, operator: 'throttle'}
  },

  debounce: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: `Debounce must be a positive number (milliseconds), but received ${describeValue(
          value
        )}`,
        suggestions: [
          'Specify delay in milliseconds to wait for rapid calls to settle',
          'Example: 300 to wait 300ms after last call before executing',
          'Use 0 to disable debouncing'
        ]
      }
    }

    return {ok: true, data: value, operator: 'debounce'}
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
        suggestions: [
          'Use cyre-schema builders: schema.object({ name: schema.string() })',
          'Or provide custom function: (data) => ({ ok: true, data })',
          'Function should return { ok: boolean, data?: any, errors?: string[] }'
        ]
      }
    }

    return {ok: true, data: value, operator: 'schema'}
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
        suggestions: [
          'Function should return boolean: (payload) => boolean',
          'Return true to allow execution, false to skip',
          'Example: (payload) => payload.status === "active"'
        ]
      }
    }

    return {ok: true, data: value, operator: 'condition'}
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
        suggestions: [
          'Function should extract part of your data: (payload) => any',
          'Return the specific data you want to use',
          'Example: (payload) => payload.user.email'
        ]
      }
    }

    return {ok: true, data: value, operator: 'selector'}
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
        suggestions: [
          'Function should return modified data: (payload) => any',
          'Transform and return your data as needed',
          'Example: (payload) => ({ ...payload, processed: true })'
        ]
      }
    }

    return {ok: true, data: value, operator: 'transform'}
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
        suggestions: [
          'Use true to only execute when data changes from previous call',
          'Use false to execute every time regardless of changes',
          'This helps prevent unnecessary processing of duplicate data'
        ]
      }
    }

    return {ok: true, data: value, operator: 'detectChanges'}
  },

  // Required validation
  required: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isBoolean(value)) {
      return {
        ok: false,
        error: `Required must be true or false, but received ${describeValue(
          value
        )}`,
        suggestions: [
          'Use true to require payload (rejects undefined/null)',
          'Use false to make payload optional',
          'Required validation includes empty string/array/object checks automatically'
        ]
      }
    }

    return {ok: true, data: value, operator: 'required'}
  },

  delay: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
      return {
        ok: false,
        error: `Delay must be a positive number (milliseconds), but received ${describeValue(
          value
        )}`,
        operator: 'schedule',
        suggestions: [
          'Specify initial delay in milliseconds before first execution',
          'Example: 1000 to wait 1 second before executing',
          'Use 0 for immediate execution'
        ]
      }
    }

    return {ok: true, data: value, operator: 'schedule'}
  },

  interval: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value < 0) {
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

    return {ok: true, data: value, operator: 'schedule'}
  },

  dispatch: (value: any): DataDefResult => {
    if (value === undefined || value === null) {
      return {ok: true, data: 'parallel'} // Default
    }

    if (typeof value !== 'string') {
      return {
        ok: false,
        error: 'dispatch must be a string',
        suggestions: ['parallel', 'sequential', 'single', 'race', 'waterfall']
      }
    }

    if (!VALID_EXECUTION_OPERATORS.includes(value as ExecutionOperator)) {
      return {
        ok: false,
        error: `Invalid dispatch operator: ${value}`,
        suggestions: VALID_EXECUTION_OPERATORS
      }
    }

    return {ok: true, data: value}
  },

  errorStrategy: (value: any): DataDefResult => {
    if (value === undefined || value === null) {
      return {ok: true, data: 'continue'} // Default
    }

    if (typeof value !== 'string') {
      return {
        ok: false,
        error: 'errorStrategy must be a string',
        suggestions: VALID_ERROR_STRATEGIES
      }
    }

    if (!VALID_ERROR_STRATEGIES.includes(value as ErrorStrategy)) {
      return {
        ok: false,
        error: `Invalid error strategy: ${value}`,
        suggestions: VALID_ERROR_STRATEGIES
      }
    }

    return {ok: true, data: value}
  },

  collectResults: (value: any): DataDefResult => {
    if (value === undefined || value === null) {
      return {ok: true, data: 'last'} // Default
    }

    // Handle boolean values
    if (typeof value === 'boolean') {
      return {
        ok: true,
        data: value ? 'all' : 'last'
      }
    }

    if (typeof value !== 'string') {
      return {
        ok: false,
        error: 'collectResults must be a string or boolean',
        suggestions: ['first', 'last', 'all', 'true', 'false']
      }
    }

    if (!VALID_COLLECT_STRATEGIES.includes(value as CollectStrategy)) {
      return {
        ok: false,
        error: `Invalid collect strategy: ${value}`,
        suggestions: ['first', 'last', 'all']
      }
    }

    return {ok: true, data: value}
  },

  dispatchTimeout: (value: any): DataDefResult => {
    if (value === undefined || value === null) {
      return {ok: true, data: 10000} // 10 second default
    }

    const numValue = Number(value)
    if (isNaN(numValue) || numValue < 0) {
      return {
        ok: false,
        error: 'dispatchTimeout must be a positive number (milliseconds)',
        suggestions: ['5000', '10000', '30000']
      }
    }

    if (numValue > 0 && numValue < 100) {
      return {
        ok: false,
        error: 'dispatchTimeout too short - minimum 100ms recommended',
        suggestions: ['100', '1000', '5000']
      }
    }

    if (numValue > 300000) {
      // 5 minutes
      return {
        ok: false,
        error: 'dispatchTimeout too long - maximum 5 minutes recommended',
        suggestions: ['30000', '60000', '300000']
      }
    }

    return {ok: true, data: numValue}
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

    return {ok: true, data: value, operator: 'schedule'}
  },
  maxWait: (value: any): DataDefResult => {
    if (value === undefined) return {ok: true, data: undefined}

    if (!isNumber(value) || value <= 0) {
      return {
        ok: false,
        error: `MaxWait must be a positive number (milliseconds), but received ${describeValue(
          value
        )}`,
        suggestions: [
          'Specify maximum wait time in milliseconds for debounce',
          'Should be greater than debounce value',
          'Example: 2000 for 2-second maximum wait'
        ]
      }
    }

    return {ok: true, data: value} // No operator - it's a modifier
  },

  // Additional fields (pass-through)
  payload: (value: any): DataDefResult => ({ok: true, data: value}),
  type: (value: any): DataDefResult => ({ok: true, data: value}),
  priority: (value: any): DataDefResult => ({ok: true, data: value}),
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
