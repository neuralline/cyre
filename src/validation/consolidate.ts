// src/components/consolidate.ts
// Validation integration for action structure and payload validation

import {schema, type Schema} from '../schema/cyre-schema'
import type {IO, ActionPayload} from '../types/interface'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - V.A.L.I.D.A.T.I.O.N - I.N.T.E.G.R.A.T.I.O.N
      
      Unified validation system:
      - Action structure validation
      - Payload validation using schemas
      - Function attribute validation
      - Timing configuration validation
      - Performance optimized with caching

*/

interface ValidationError {
  field: string
  message: string
  value?: any
}

interface StructureValidationResult {
  valid: boolean
  data?: IO
  errors?: string[]
}

interface PayloadValidationResult {
  ok: boolean
  data?: any
  errors?: string[]
}

// Import memory-optimized cache
import {optimizedSchemaCache} from '../schema/schema-memory-optimization'

// Type for cached schemas
type CachedSchema = Schema

/**
 * Action structure schema for validating IO objects
 */
const createActionStructureSchema = (): Schema<IO> => {
  return schema.object({
    id: schema.pipe(schema.string(), s => s.minLength(1)),
    type: schema.string().optional(),
    payload: schema.any().optional(),
    required: schema
      .union(schema.boolean(), schema.literal('non-empty'))
      .optional(),
    interval: schema.pipe(schema.number(), s => s.min(0)).optional(),
    repeat: schema.union(schema.number(), schema.boolean()).optional(),
    delay: schema.pipe(schema.number(), s => s.min(0)).optional(),
    throttle: schema.pipe(schema.number(), s => s.min(0)).optional(),
    debounce: schema.pipe(schema.number(), s => s.min(0)).optional(),
    maxWait: schema.pipe(schema.number(), s => s.min(0)).optional(),
    detectChanges: schema.boolean().optional(),
    log: schema.boolean().optional(),
    priority: schema
      .object({
        level: schema.enums('critical', 'high', 'medium', 'low', 'background'),
        maxRetries: schema.number().optional(),
        timeout: schema.number().optional(),
        fallback: schema.any().optional(),
        baseDelay: schema.number().optional(),
        maxDelay: schema.number().optional()
      })
      .optional(),
    middleware: schema.array(schema.string()).optional(),
    schema: schema.any().optional(),
    block: schema.boolean().optional(),
    condition: schema.any().optional(),
    selector: schema.any().optional(),
    transform: schema.any().optional(),
    group: schema.string().optional(),
    fusion: schema
      .object({
        spatial: schema
          .array(
            schema.object({
              id: schema.string(),
              location: schema.object({
                x: schema.number(),
                y: schema.number()
              }),
              weight: schema.number().optional()
            })
          )
          .optional(),
        temporal: schema.array(schema.string()).optional(),
        method: schema.enums('weighted', 'kalman').optional()
      })
      .optional(),
    patterns: schema
      .object({
        sequences: schema
          .array(
            schema.object({
              name: schema.string(),
              conditions: schema.array(schema.string()),
              timeout: schema.number().optional()
            })
          )
          .optional(),
        anomalies: schema
          .array(
            schema.object({
              method: schema.enums('zscore', 'iqr'),
              threshold: schema.number()
            })
          )
          .optional()
      })
      .optional(),
    tags: schema.array(schema.string()).optional(),
    // Internal fields - validated but not required
    _protectionPipeline: schema.any().optional(),
    _debounceTimer: schema.string().optional(),
    _bypassDebounce: schema.boolean().optional(),
    _fusionPipeline: schema.any().optional(),
    _patternPipeline: schema.any().optional(),
    timestamp: schema.number().optional(),
    timeOfCreation: schema.number().optional()
  })
}

/**
 * Get or create cached action structure schema
 */
const getActionStructureSchema = (): Schema<IO> => {
  const cacheKey = 'action-structure'

  if (!optimizedSchemaCache.has(cacheKey)) {
    optimizedSchemaCache.set(cacheKey, createActionStructureSchema())
  }

  return optimizedSchemaCache.get(cacheKey)!
}

/**
 * Validate action structure
 */
const validateActionStructure = (action: any): StructureValidationResult => {
  try {
    const structureSchema = getActionStructureSchema()
    const result = structureSchema(action)

    if (result.ok) {
      return {
        valid: true,
        data: result.data
      }
    } else {
      return {
        valid: false,
        errors: result.errors
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Action structure validation error: ${message}`)

    return {
      valid: false,
      errors: [`Validation error: ${message}`]
    }
  }
}

/**
 * Validate payload using provided schema
 */
const validateActionPayload = (
  payload: ActionPayload,
  payloadSchema: Schema
): PayloadValidationResult => {
  // Get pooled result object to reduce allocations
  const result = optimizedSchemaCache.getValidationResult()

  try {
    const validationResult = payloadSchema(payload)

    if (validationResult.ok) {
      result.ok = true
      result.data = validationResult.data
      result.errors = undefined
    } else {
      result.ok = false
      result.data = undefined
      result.errors = validationResult.errors
    }

    // Create a copy to return (result object will be recycled)
    const returnResult = {
      ok: result.ok,
      data: result.data,
      errors: result.errors
    }

    // Release result back to pool
    optimizedSchemaCache.releaseValidationResult(result)

    return returnResult
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Payload validation error: ${message}`)

    // Release result back to pool
    optimizedSchemaCache.releaseValidationResult(result)

    return {
      ok: false,
      errors: [`Validation error: ${message}`]
    }
  }
}

/**
 * Validate function attributes (condition, selector, transform)
 */
const validateFunctionAttributes = (action: IO): string[] => {
  const errors: string[] = []

  // Validate condition function
  if (
    action.condition !== undefined &&
    typeof action.condition !== 'function'
  ) {
    errors.push('condition must be a function')
  }

  // Validate selector function
  if (action.selector !== undefined && typeof action.selector !== 'function') {
    errors.push('selector must be a function')
  }

  // Validate transform function
  if (
    action.transform !== undefined &&
    typeof action.transform !== 'function'
  ) {
    errors.push('transform must be a function')
  }

  // Validate priority fallback if provided
  if (
    action.priority?.fallback !== undefined &&
    typeof action.priority.fallback !== 'function'
  ) {
    errors.push('priority.fallback must be a function')
  }

  return errors
}

/**
 * Validate timing configuration
 */
const validateActionAttributes = (action: IO): string[] => {
  const errors: string[] = []

  // Validate interval with repeat
  if (action.interval !== undefined && action.repeat === undefined) {
    errors.push('interval requires repeat to be specified')
  }

  // Validate repeat value
  if (action.repeat !== undefined) {
    if (typeof action.repeat === 'number' && action.repeat < 0) {
      errors.push('repeat cannot be negative')
    }
  }

  // Validate timing relationships
  if (action.throttle !== undefined && action.debounce !== undefined) {
    if (action.throttle > 0 && action.debounce > 0) {
      errors.push('throttle and debounce cannot both be active')
    }
  }

  // Validate maxWait with debounce
  if (action.maxWait !== undefined && action.debounce === undefined) {
    errors.push('maxWait requires debounce to be specified')
  }

  if (action.maxWait !== undefined && action.debounce !== undefined) {
    if (action.maxWait <= action.debounce) {
      errors.push('maxWait must be greater than debounce')
    }
  }

  // Validate delay and interval combination
  if (action.delay !== undefined && action.interval !== undefined) {
    if (action.delay > action.interval) {
      // This is actually valid - delay can be longer than interval
      // Just log a warning
      log.warn(
        `Action ${action.id}: delay (${action.delay}ms) is longer than interval (${action.interval}ms)`
      )
    }
  }

  return errors
}

/**
 * Comprehensive action validation
 */
const validateAction = (
  action: any
): {
  valid: boolean
  data?: IO
  errors?: string[]
} => {
  // Step 1: Structure validation
  const structureResult = validateActionStructure(action)
  if (!structureResult.valid) {
    return structureResult
  }

  const validatedAction = structureResult.data!

  // Step 2: Function validation
  const functionErrors = validateFunctionAttributes(validatedAction)
  if (functionErrors.length > 0) {
    return {
      valid: false,
      errors: functionErrors
    }
  }

  // Step 3: Timing validation
  const timingErrors = validateActionAttributes(validatedAction)
  if (timingErrors.length > 0) {
    return {
      valid: false,
      errors: timingErrors
    }
  }

  return {
    valid: true,
    data: validatedAction
  }
}

/**
 * Integration helpers for existing code
 */
export const integrationHelpers = {
  validateFunctionAttributes,
  validateActionAttributes
}

/**
 * Main validation export
 */
export const validation = {
  action: {
    structure: validateActionStructure,
    payload: validateActionPayload,
    complete: validateAction
  },
  schema: {
    create: createActionStructureSchema,
    cached: getActionStructureSchema
  }
}

/**
 * Clear validation cache (for testing)
 */
export const clearValidationCache = (): void => {
  optimizedSchemaCache.clear()
}

/**
 * Get validation cache statistics
 */
export const getValidationStats = () => ({
  cacheStats: optimizedSchemaCache.getStats(),
  memoryStats: optimizedSchemaCache.getMemoryStats()
})
