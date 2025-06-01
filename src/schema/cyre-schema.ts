// src/schema/cyre-schema.ts
// Schema validation with proper method chaining and pipe functionality

import type {ActionPayload} from '../types/interface'
import {log} from '../components/cyre-log'

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
}

// Constraint methods for string schema
export interface StringSchema extends Schema<string> {
  len(len: number): StringSchema
  minLength(len: number): StringSchema
  maxLength(len: number): StringSchema
  pattern(regex: RegExp): StringSchema
  email(): StringSchema
  url(): StringSchema
}

// Create schema factory
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

// Create number schema with constraints
const createNumberSchema = (validator: Validator<number>): NumberSchema => {
  const baseSchema = createSchema(validator) as NumberSchema

  baseSchema.min = (minVal: number) =>
    createNumberSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      return result.data >= minVal
        ? result
        : {ok: false, errors: [`Must be at least ${minVal}`]}
    })

  baseSchema.max = (maxVal: number) =>
    createNumberSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      return result.data <= maxVal
        ? result
        : {ok: false, errors: [`Must be at most ${maxVal}`]}
    })

  baseSchema.int = () =>
    createNumberSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      return Number.isInteger(result.data)
        ? result
        : {ok: false, errors: ['Must be integer']}
    })

  baseSchema.positive = () =>
    createNumberSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      return result.data > 0
        ? result
        : {ok: false, errors: ['Must be positive']}
    })

  return baseSchema
}

// Create string schema with constraints
const createStringSchema = (validator: Validator<string>): StringSchema => {
  const baseSchema = createSchema(validator) as StringSchema

  baseSchema.len = (len: number) =>
    createStringSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      return result.data.length === len
        ? result
        : {ok: false, errors: [`Must be exactly ${len} characters`]}
    })

  baseSchema.minLength = (len: number) =>
    createStringSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      return result.data.length >= len
        ? result
        : {ok: false, errors: [`Must be at least ${len} characters`]}
    })

  baseSchema.maxLength = (len: number) =>
    createStringSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      return result.data.length <= len
        ? result
        : {ok: false, errors: [`Must be at most ${len} characters`]}
    })

  baseSchema.pattern = (regex: RegExp) =>
    createStringSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      return regex.test(result.data)
        ? result
        : {ok: false, errors: ['Pattern does not match']}
    })

  baseSchema.email = () =>
    createStringSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(result.data)
        ? result
        : {ok: false, errors: ['Invalid email format']}
    })

  baseSchema.url = () =>
    createStringSchema(value => {
      const result = validator(value)
      if (!result.ok) return result
      try {
        new URL(result.data)
        return result
      } catch {
        return {ok: false, errors: ['Invalid URL']}
      }
    })

  return baseSchema
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
      // Handle undefined values properly for default value support
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

// PIPE FUNCTION - for composing schema transformations
export const pipe = <T, U>(
  schema: Schema<T>,
  ...transforms: Array<(schema: Schema<T>) => Schema<U>>
): Schema<U> => {
  return transforms.reduce(
    (acc, transform) => transform(acc as any),
    schema as any
  ) as Schema<U>
}

// EMAIL STRING - shorthand for string with email validation
export const email_string = (): StringSchema => {
  return string().email()
}

// Type inference helper
export type Infer<T extends Schema> = T extends Schema<infer U> ? U : never

// Schema validation function for action integration
export const validate = <T>(
  schema: Schema<T>,
  payload: ActionPayload
): ValidationResult<T> => {
  const result = schema(payload)

  if (!result.ok) {
    log.error('Schema validation failed:' + result.errors)
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
  // Primitives
  string,
  number,
  boolean,
  any,

  // Containers
  object,
  array,
  union,
  literal,
  enums,

  // Validation
  validate,

  // Composition
  pipe,
  email_string
}

export default schema
