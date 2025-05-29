// src/schema/cyre-schema.ts
// Schema validation system for Cyre using functional approach

import type {ActionPayload, IO} from '../types/interface'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - S.C.H.E.M.A
      
      Functional schema validation system:
      - Runtime validation with TypeScript inference
      - Composable validators
      - Integration with action pipeline
      - No external dependencies
      - Functional programming approach

*/

// Base validation result type
export type ValidationResult<T = unknown> =
  | {ok: true; data: T; errors?: never}
  | {ok: false; data?: never; errors: ValidationError[]}

// Validation error structure
export interface ValidationError {
  path: string[]
  message: string
  code: string
  received?: unknown
  expected?: string
}

// Schema validator function type
export type SchemaValidator<T = unknown> = (
  value: unknown,
  path?: string[]
) => ValidationResult<T>

// Schema builder type
export type Schema<T = unknown> = {
  parse: (value: unknown) => ValidationResult<T>
  safeParse: (value: unknown) => ValidationResult<T>
  validate: SchemaValidator<T>
  optional: () => Schema<T | undefined>
  nullable: () => Schema<T | null>
  default: (defaultValue: T) => Schema<T>
  transform: <U>(fn: (value: T) => U) => Schema<U>
  refine: (fn: (value: T) => boolean, message?: string) => Schema<T>
  _type: T // Type inference helper
}

// Create validation error
const createError = (
  path: string[],
  message: string,
  code: string,
  received?: unknown,
  expected?: string
): ValidationError => ({
  path,
  message,
  code,
  received,
  expected
})

// Base schema factory
const createSchema = <T>(validator: SchemaValidator<T>): Schema<T> => {
  const parse = (value: unknown): ValidationResult<T> => {
    return validator(value, [])
  }

  const safeParse = parse // Same as parse in this implementation

  return {
    parse,
    safeParse,
    validate: validator,
    optional: () =>
      createSchema<T | undefined>((value, path = []) => {
        if (value === undefined) {
          return {ok: true, data: undefined}
        }
        return validator(value, path)
      }),
    nullable: () =>
      createSchema<T | null>((value, path = []) => {
        if (value === null) {
          return {ok: true, data: null}
        }
        return validator(value, path)
      }),
    default: (defaultValue: T) =>
      createSchema<T>((value, path = []) => {
        if (value === undefined) {
          return {ok: true, data: defaultValue}
        }
        return validator(value, path)
      }),
    transform: <U>(fn: (value: T) => U) =>
      createSchema<U>((value, path = []) => {
        const result = validator(value, path)
        if (!result.ok) return result
        try {
          return {ok: true, data: fn(result.data)}
        } catch (error) {
          return {
            ok: false,
            errors: [
              createError(
                path,
                `Transform failed: ${error}`,
                'transform_failed'
              )
            ]
          }
        }
      }),
    refine: (fn: (value: T) => boolean, message = 'Custom validation failed') =>
      createSchema<T>((value, path = []) => {
        const result = validator(value, path)
        if (!result.ok) return result
        if (!fn(result.data)) {
          return {
            ok: false,
            errors: [createError(path, message, 'custom_validation')]
          }
        }
        return result
      }),
    _type: undefined as any as T
  }
}

// Primitive validators
export const string = (): Schema<string> =>
  createSchema((value, path = []) => {
    if (typeof value === 'string') {
      return {ok: true, data: value}
    }
    return {
      ok: false,
      errors: [
        createError(path, 'Expected string', 'invalid_type', value, 'string')
      ]
    }
  })

export const number = (): Schema<number> =>
  createSchema((value, path = []) => {
    if (typeof value === 'number' && !isNaN(value)) {
      return {ok: true, data: value}
    }
    return {
      ok: false,
      errors: [
        createError(path, 'Expected number', 'invalid_type', value, 'number')
      ]
    }
  })

export const boolean = (): Schema<boolean> =>
  createSchema((value, path = []) => {
    if (typeof value === 'boolean') {
      return {ok: true, data: value}
    }
    return {
      ok: false,
      errors: [
        createError(path, 'Expected boolean', 'invalid_type', value, 'boolean')
      ]
    }
  })

// String refinements
export const stringWithConstraints = (constraints: {
  min?: number
  max?: number
  pattern?: RegExp
  email?: boolean
  url?: boolean
}) => {
  let schema = string()

  if (constraints.min !== undefined) {
    schema = schema.refine(
      val => val.length >= constraints.min!,
      `String must be at least ${constraints.min} characters`
    )
  }

  if (constraints.max !== undefined) {
    schema = schema.refine(
      val => val.length <= constraints.max!,
      `String must be at most ${constraints.max} characters`
    )
  }

  if (constraints.pattern) {
    schema = schema.refine(
      val => constraints.pattern!.test(val),
      'String does not match pattern'
    )
  }

  if (constraints.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    schema = schema.refine(val => emailRegex.test(val), 'Invalid email format')
  }

  if (constraints.url) {
    schema = schema.refine(val => {
      try {
        new URL(val)
        return true
      } catch {
        return false
      }
    }, 'Invalid URL format')
  }

  return schema
}

// Number refinements
export const numberWithConstraints = (constraints: {
  min?: number
  max?: number
  int?: boolean
  positive?: boolean
}) => {
  let schema = number()

  if (constraints.min !== undefined) {
    schema = schema.refine(
      val => val >= constraints.min!,
      `Number must be at least ${constraints.min}`
    )
  }

  if (constraints.max !== undefined) {
    schema = schema.refine(
      val => val <= constraints.max!,
      `Number must be at most ${constraints.max}`
    )
  }

  if (constraints.int) {
    schema = schema.refine(val => Number.isInteger(val), 'Must be an integer')
  }

  if (constraints.positive) {
    schema = schema.refine(val => val > 0, 'Must be a positive number')
  }

  return schema
}

// Object schema
export const object = <T extends Record<string, Schema>>(
  shape: T
): Schema<{[K in keyof T]: T[K]['_type']}> => {
  return createSchema((value, path = []) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {
        ok: false,
        errors: [
          createError(path, 'Expected object', 'invalid_type', value, 'object')
        ]
      }
    }

    const obj = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    const errors: ValidationError[] = []

    for (const [key, schema] of Object.entries(shape)) {
      const fieldResult = schema.validate(obj[key], [...path, key])
      if (fieldResult.ok) {
        result[key] = fieldResult.data
      } else {
        errors.push(...fieldResult.errors)
      }
    }

    if (errors.length > 0) {
      return {ok: false, errors}
    }

    return {ok: true, data: result as {[K in keyof T]: T[K]['_type']}}
  })
}

// Array schema
export const array = <T>(itemSchema: Schema<T>): Schema<T[]> => {
  return createSchema((value, path = []) => {
    if (!Array.isArray(value)) {
      return {
        ok: false,
        errors: [
          createError(path, 'Expected array', 'invalid_type', value, 'array')
        ]
      }
    }

    const result: T[] = []
    const errors: ValidationError[] = []

    for (let i = 0; i < value.length; i++) {
      const itemResult = itemSchema.validate(value[i], [...path, i.toString()])
      if (itemResult.ok) {
        result.push(itemResult.data)
      } else {
        errors.push(...itemResult.errors)
      }
    }

    if (errors.length > 0) {
      return {ok: false, errors}
    }

    return {ok: true, data: result}
  })
}

// Union schema
export const union = <T extends readonly Schema[]>(
  schemas: T
): Schema<T[number]['_type']> => {
  return createSchema((value, path = []) => {
    const errors: ValidationError[] = []

    for (const schema of schemas) {
      const result = schema.validate(value, path)
      if (result.ok) {
        return result
      }
      errors.push(...result.errors)
    }

    return {
      ok: false,
      errors: [
        createError(path, 'No union variant matched', 'union_mismatch', value)
      ]
    }
  })
}

// Literal schema
export const literal = <T extends string | number | boolean>(
  value: T
): Schema<T> => {
  return createSchema((input, path = []) => {
    if (input === value) {
      return {ok: true, data: value}
    }
    return {
      ok: false,
      errors: [
        createError(
          path,
          `Expected literal ${value}`,
          'invalid_literal',
          input,
          String(value)
        )
      ]
    }
  })
}

// Enum schema
export const enumSchema = <T extends readonly string[]>(
  values: T
): Schema<T[number]> => {
  return createSchema((input, path = []) => {
    if (typeof input === 'string' && values.includes(input as T[number])) {
      return {ok: true, data: input as T[number]}
    }
    return {
      ok: false,
      errors: [
        createError(
          path,
          `Expected one of: ${values.join(', ')}`,
          'invalid_enum',
          input
        )
      ]
    }
  })
}

// Any schema (bypass validation)
export const any = (): Schema<any> =>
  createSchema(value => ({
    ok: true,
    data: value
  }))

// Type inference helper
export type Infer<T extends Schema> = T['_type']

// Utility for creating custom validators
export const custom = <T>(
  validator: (value: unknown) => value is T,
  message = 'Custom validation failed'
): Schema<T> => {
  return createSchema((value, path = []) => {
    if (validator(value)) {
      return {ok: true, data: value}
    }
    return {
      ok: false,
      errors: [createError(path, message, 'custom_validation', value)]
    }
  })
}

// Integration with Cyre actions
export const validateActionPayload = <T>(
  schema: Schema<T>,
  payload: ActionPayload
): ValidationResult<T> => {
  const result = schema.parse(payload)

  if (!result.ok) {
    log.error('Action payload validation failed:', result.errors)
  }

  return result
}

// Action schema builder for Cyre integration
export const actionSchema = <T extends Record<string, Schema>>(shape: T) => {
  return object(shape)
}

// Export main schema builder
export const cyreSchema = {
  string,
  number,
  boolean,
  object,
  array,
  union,
  literal,
  enum: enumSchema,
  any,
  custom,
  stringWithConstraints,
  numberWithConstraints,
  actionSchema,
  validateActionPayload
}
