// src/schema/cyre-schema.ts
// Schema validation with proper method chaining and pipe functionality

import type {ActionPayload} from '../types/core'
import {sensor} from '../components/sensor'

/*

      C.Y.R.E - S.C.H.E.M.A
      
      Smart schema validation system:
      - Concise functional API with pipe support
      - Direct action integration
      - Runtime type safety
      - Composable validators
      - Zero dependencies

*/

// Core validation types
export type ValidationResult<T = unknown> =
  | {ok: true; data: T}
  | {ok: false; errors: string[]}

export type Validator<T = unknown> = (value: unknown) => ValidationResult<T>

// Schema builder with type inference
export interface Schema<T = unknown> {
  (value: unknown): ValidationResult<T>
  optional(): Schema<T | undefined>
  nullable(): Schema<T | null>
  default(value: T): Schema<T>
  transform<U>(fn: (value: T) => U): Schema<U>
  refine(fn: (value: T) => boolean, message?: string): Schema<T>
  _type?: T // Type inference helper
}

// Constraint methods for number schema
export interface NumberSchema extends Schema<number> {
  min(minVal: number): NumberSchema
  max(maxVal: number): NumberSchema
  int(): NumberSchema
  positive(): NumberSchema
  optional(): NumberSchema
  nullable(): NumberSchema
  default(value: number): NumberSchema
  transform<U>(fn: (value: number) => U): Schema<U>
  refine(fn: (value: number) => boolean, message?: string): NumberSchema
}

// Constraint methods for string schema
export interface StringSchema extends Schema<string> {
  len(len: number): StringSchema
  minLength(len: number): StringSchema
  maxLength(len: number): StringSchema
  pattern(regex: RegExp): StringSchema
  email(): StringSchema
  url(): StringSchema
  optional(): StringSchema
  nullable(): StringSchema
  default(value: string): StringSchema
  transform<U>(fn: (value: string) => U): Schema<U>
  refine(fn: (value: string) => boolean, message?: string): StringSchema
}

// Create base schema with all common methods
const createSchema = <T>(validator: Validator<T>): Schema<T> => {
  const schema = validator as Schema<T>

  schema.optional = () =>
    createSchema<T | undefined>(value =>
      value === undefined ? {ok: true, data: undefined} : validator(value)
    )

  schema.nullable = () =>
    createSchema<T | null>(value =>
      value === null ? {ok: true, data: null} : validator(value)
    )

  schema.default = (defaultValue: T) =>
    createSchema<T>(value =>
      value === undefined ? {ok: true, data: defaultValue} : validator(value)
    )

  schema.transform = <U>(fn: (value: T) => U) =>
    createSchema<U>(value => {
      const result = validator(value)
      if (!result.ok) return result
      try {
        return {ok: true, data: fn(result.data)}
      } catch (error) {
        return {ok: false, errors: [`Transform failed: ${error}`]}
      }
    })

  schema.refine = (fn: (value: T) => boolean, message = 'Validation failed') =>
    createSchema<T>(value => {
      const result = validator(value)
      if (!result.ok) return result
      return fn(result.data) ? result : {ok: false, errors: [message]}
    })

  return schema
}

// Create number schema with constraints and base methods
const createNumberSchema = (validator: Validator<number>): NumberSchema => {
  const baseSchema = createSchema(validator)
  const numberSchema = Object.assign(baseSchema, {
    min: (minVal: number): NumberSchema =>
      createNumberSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return result.data >= minVal
          ? result
          : {ok: false, errors: [`Must be at least ${minVal}`]}
      }),

    max: (maxVal: number): NumberSchema =>
      createNumberSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return result.data <= maxVal
          ? result
          : {ok: false, errors: [`Must be at most ${maxVal}`]}
      }),

    int: (): NumberSchema =>
      createNumberSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return Number.isInteger(result.data)
          ? result
          : {ok: false, errors: ['Must be integer']}
      }),

    positive: (): NumberSchema =>
      createNumberSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return result.data > 0
          ? result
          : {ok: false, errors: ['Must be positive']}
      }),

    // Override base methods to maintain NumberSchema type
    optional: (): NumberSchema =>
      createNumberSchema(value =>
        value === undefined ? {ok: true, data: undefined} : validator(value)
      ) as any,

    nullable: (): NumberSchema =>
      createNumberSchema(value =>
        value === null ? {ok: true, data: null} : validator(value)
      ) as any,

    default: (defaultValue: number): NumberSchema =>
      createNumberSchema(value =>
        value === undefined ? {ok: true, data: defaultValue} : validator(value)
      ),

    transform: <U>(fn: (value: number) => U): Schema<U> =>
      createSchema<U>(value => {
        const result = validator(value)
        if (!result.ok) return result
        try {
          return {ok: true, data: fn(result.data)}
        } catch (error) {
          return {ok: false, errors: [`Transform failed: ${error}`]}
        }
      }),

    refine: (
      fn: (value: number) => boolean,
      message = 'Validation failed'
    ): NumberSchema =>
      createNumberSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return fn(result.data) ? result : {ok: false, errors: [message]}
      })
  }) as NumberSchema

  return numberSchema
}

// Create string schema with constraints and base methods
const createStringSchema = (validator: Validator<string>): StringSchema => {
  const baseSchema = createSchema(validator)
  const stringSchema = Object.assign(baseSchema, {
    len: (len: number): StringSchema =>
      createStringSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return result.data.length === len
          ? result
          : {ok: false, errors: [`Must be exactly ${len} characters`]}
      }),

    minLength: (len: number): StringSchema =>
      createStringSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return result.data.length >= len
          ? result
          : {ok: false, errors: [`Must be at least ${len} characters`]}
      }),

    maxLength: (len: number): StringSchema =>
      createStringSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return result.data.length <= len
          ? result
          : {ok: false, errors: [`Must be at most ${len} characters`]}
      }),

    pattern: (regex: RegExp): StringSchema =>
      createStringSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return regex.test(result.data)
          ? result
          : {ok: false, errors: ['Pattern does not match']}
      }),

    email: (): StringSchema =>
      createStringSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(result.data)
          ? result
          : {ok: false, errors: ['Invalid email format']}
      }),

    url: (): StringSchema =>
      createStringSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        try {
          new URL(result.data)
          return result
        } catch {
          return {ok: false, errors: ['Invalid URL']}
        }
      }),

    // Override base methods to maintain StringSchema type
    optional: (): StringSchema =>
      createStringSchema(value =>
        value === undefined ? {ok: true, data: undefined} : validator(value)
      ) as any,

    nullable: (): StringSchema =>
      createStringSchema(value =>
        value === null ? {ok: true, data: null} : validator(value)
      ) as any,

    default: (defaultValue: string): StringSchema =>
      createStringSchema(value =>
        value === undefined ? {ok: true, data: defaultValue} : validator(value)
      ),

    transform: <U>(fn: (value: string) => U): Schema<U> =>
      createSchema<U>(value => {
        const result = validator(value)
        if (!result.ok) return result
        try {
          return {ok: true, data: fn(result.data)}
        } catch (error) {
          return {ok: false, errors: [`Transform failed: ${error}`]}
        }
      }),

    refine: (
      fn: (value: string) => boolean,
      message = 'Validation failed'
    ): StringSchema =>
      createStringSchema(value => {
        const result = validator(value)
        if (!result.ok) return result
        return fn(result.data) ? result : {ok: false, errors: [message]}
      })
  }) as StringSchema

  return stringSchema
}

// Primitive validators
export const string = (): StringSchema =>
  createStringSchema(value =>
    typeof value === 'string'
      ? {ok: true, data: value}
      : {ok: false, errors: ['Expected string']}
  )

export const number = (): NumberSchema =>
  createNumberSchema(value =>
    typeof value === 'number' && !isNaN(value)
      ? {ok: true, data: value}
      : {ok: false, errors: ['Expected number']}
  )

export const boolean = () =>
  createSchema<boolean>(value =>
    typeof value === 'boolean'
      ? {ok: true, data: value}
      : {ok: false, errors: ['Expected boolean']}
  )

export const any = () => createSchema<any>(value => ({ok: true, data: value}))

// Object validation with proper default value handling
export const object = <T extends Record<string, Schema>>(shape: T) =>
  createSchema<{
    [K in keyof T]: ReturnType<T[K]> extends ValidationResult<infer U>
      ? U
      : never
  }>(value => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {ok: false, errors: ['Expected object']}
    }

    const obj = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    const errors: string[] = []

    for (const [key, schema] of Object.entries(shape)) {
      const fieldValue = obj[key]
      const fieldResult = schema(fieldValue)

      if (fieldResult.ok) {
        result[key] = fieldResult.data
      } else {
        errors.push(...fieldResult.errors.map(err => `${key}: ${err}`))
      }
    }

    return errors.length > 0
      ? {ok: false, errors}
      : {ok: true, data: result as any}
  })

// Array validation
export const array = <T>(itemSchema: Schema<T>) =>
  createSchema<T[]>(value => {
    if (!Array.isArray(value)) {
      return {ok: false, errors: ['Expected array']}
    }

    const result: T[] = []
    const errors: string[] = []

    for (let i = 0; i < value.length; i++) {
      const itemResult = itemSchema(value[i])
      if (itemResult.ok) {
        result.push(itemResult.data)
      } else {
        errors.push(...itemResult.errors.map(err => `[${i}]: ${err}`))
      }
    }

    return errors.length > 0 ? {ok: false, errors} : {ok: true, data: result}
  })

// Union validation
export const union = <T extends readonly Schema[]>(...schemas: T) =>
  createSchema<T[number] extends Schema<infer U> ? U : never>(value => {
    for (const schema of schemas) {
      const result = schema(value)
      if (result.ok) return result
    }
    return {ok: false, errors: ['No union variant matched']}
  })

// Literal validation
export const literal = <T extends string | number | boolean>(val: T) =>
  createSchema<T>(value =>
    value === val
      ? {ok: true, data: val}
      : {ok: false, errors: [`Expected ${val}`]}
  )

// Enum validation
export const enums = <T extends readonly string[]>(...values: T) =>
  createSchema<T[number]>(value =>
    typeof value === 'string' && values.includes(value as T[number])
      ? {ok: true, data: value as T[number]}
      : {ok: false, errors: [`Expected one of: ${values.join(', ')}`]}
  )

// Standalone transform functions
export const optional = <T>(schema: Schema<T>): Schema<T | undefined> =>
  schema.optional()

export const nullable = <T>(schema: Schema<T>): Schema<T | null> =>
  schema.nullable()

export const withDefault = <T>(schema: Schema<T>, defaultValue: T): Schema<T> =>
  schema.default(defaultValue)

export const transform = <T, U>(
  schema: Schema<T>,
  fn: (value: T) => U
): Schema<U> => schema.transform(fn)

export const refine = <T>(
  schema: Schema<T>,
  fn: (value: T) => boolean,
  message?: string
): Schema<T> => schema.refine(fn, message)

// String constraint functions
export const minLength =
  (len: number) =>
  (schema: StringSchema): StringSchema =>
    schema.minLength(len)

export const maxLength =
  (len: number) =>
  (schema: StringSchema): StringSchema =>
    schema.maxLength(len)

export const pattern =
  (regex: RegExp) =>
  (schema: StringSchema): StringSchema =>
    schema.pattern(regex)

// Number constraint functions
export const min =
  (minVal: number) =>
  (schema: NumberSchema): NumberSchema =>
    schema.min(minVal)

export const max =
  (maxVal: number) =>
  (schema: NumberSchema): NumberSchema =>
    schema.max(maxVal)

export const integer =
  () =>
  (schema: NumberSchema): NumberSchema =>
    schema.int()

export const positive =
  () =>
  (schema: NumberSchema): NumberSchema =>
    schema.positive()

// PIPE FUNCTION - for composing schema transformations
export const pipe = <T>(
  schema: Schema<T>,
  ...transforms: Array<(schema: Schema<T>) => Schema<any>>
): Schema<any> => {
  const validTransforms = transforms.filter(
    (transform): transform is (schema: Schema<T>) => Schema<any> =>
      typeof transform === 'function'
  )

  if (validTransforms.length === 0) {
    return schema
  }

  return validTransforms.reduce(
    (acc, transform) => transform(acc),
    schema as Schema<any>
  )
}

// All validator - validates all schemas pass
export const all = <T extends readonly Schema[]>(
  ...schemas: T
): Schema<{[K in keyof T]: T[K] extends Schema<infer U> ? U : never}> =>
  createSchema(value => {
    const results: any[] = []
    const errors: string[] = []

    for (let i = 0; i < schemas.length; i++) {
      const result = schemas[i](value)
      if (result.ok) {
        results[i] = result.data
      } else {
        errors.push(...result.errors.map(err => `Schema ${i}: ${err}`))
      }
    }

    return errors.length > 0
      ? {ok: false, errors}
      : {ok: true, data: results as any}
  })

// Pre-built validators
export const email = (): StringSchema => string().email()
export const url = (): StringSchema => string().url()
export const id = (): StringSchema => string().minLength(1)
export const timestamp = (): NumberSchema => number().positive()

// Enum shorthand (alias for enums)
export const enumSchema = enums

// Performance optimization - fast validator bypass
const fastValidatorCache = new Map<string, Schema>()

export const fast = <T>(schema: Schema<T>): Schema<T> => {
  const cacheKey = schema.toString()

  if (fastValidatorCache.has(cacheKey)) {
    return fastValidatorCache.get(cacheKey) as Schema<T>
  }

  const fastValidator = createSchema<T>(value => {
    // For fast path, skip complex validations in production
    if (process.env.NODE_ENV === 'production') {
      return {ok: true, data: value as T}
    }
    return schema(value)
  })

  fastValidatorCache.set(cacheKey, fastValidator)
  return fastValidator
}

// Memoization for expensive validations
const memoCache = new WeakMap<Schema, Map<any, ValidationResult>>()

export const memoize = <T>(schema: Schema<T>): Schema<T> => {
  let cache = memoCache.get(schema)
  if (!cache) {
    cache = new Map()
    memoCache.set(schema, cache)
  }

  return createSchema<T>(value => {
    if (cache!.has(value)) {
      return cache!.get(value)!
    }

    const result = schema(value)
    cache!.set(value, result)
    return result
  })
}

// EMAIL STRING - shorthand for string with email validation
export const email_string = (): StringSchema => string().email()

// Type inference helper
export type Infer<T extends Schema> = T extends Schema<infer U> ? U : never

// Schema validation function for action integration
export const validate = <T>(
  schema: Schema<T>,
  payload: ActionPayload
): ValidationResult<T> => {
  const result = schema(payload)

  if (!result.ok) {
    sensor.error('Schema validation failed:' + result.errors)
  }

  return result
}

// Quick schema builders for common action payloads
export const actionPayload = {
  string: () => object({payload: string()}),
  number: () => object({payload: number()}),
  object: <T extends Record<string, Schema>>(shape: T) =>
    object({payload: object(shape)}),
  array: <T>(itemSchema: Schema<T>) => object({payload: array(itemSchema)}),
  any: () => object({payload: any()})
}

// Export main schema API
export const schema = {
  // Core validators
  string,
  number,
  boolean,
  any,
  literal,
  enum: enumSchema,

  // Composite validators
  object,
  array,
  union,

  // Transforms
  optional,
  nullable,
  withDefault,
  transform,
  refine,

  // String constraints
  minLength,
  maxLength,
  pattern,

  // Number constraints
  min,
  max,
  integer,
  positive,

  // Composition utilities
  pipe,
  all,

  // Pre-built validators
  email,
  url,
  id,
  timestamp,

  // Performance optimizations
  fast,
  memoize,

  // Legacy support
  enums,
  email_string,

  // Utility
  validate: <T>(validator: Validator<T>, value: unknown): ValidationResult<T> =>
    validator(value)
} as const

export default schema
