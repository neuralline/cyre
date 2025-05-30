// src/schema/cyre-schema.ts
// Advanced schema validation with action integration

import type {ActionPayload} from '../types/interface'
import {log} from '../components/cyre-log'

/*

      C.Y.R.E - S.C.H.E.M.A
      
      Smart schema validation system:
      - Concise functional API
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

// Primitive validators
export const string = () =>
  createSchema<string>(value =>
    typeof value === 'string'
      ? {ok: true, data: value}
      : {ok: false, errors: ['Expected string']}
  )

export const number = () =>
  createSchema<number>(value =>
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

// Constraint helpers
export const min = (minVal: number) => (schema: Schema<number>) =>
  schema.refine(val => val >= minVal, `Must be at least ${minVal}`)

export const max = (maxVal: number) => (schema: Schema<number>) =>
  schema.refine(val => val <= maxVal, `Must be at most ${maxVal}`)

export const length = (len: number) => (schema: Schema<string>) =>
  schema.refine(val => val.length === len, `Must be exactly ${len} characters`)

export const minLength = (len: number) => (schema: Schema<string>) =>
  schema.refine(val => val.length >= len, `Must be at least ${len} characters`)

export const maxLength = (len: number) => (schema: Schema<string>) =>
  schema.refine(val => val.length <= len, `Must be at most ${len} characters`)

export const pattern = (regex: RegExp) => (schema: Schema<string>) =>
  schema.refine(val => regex.test(val), 'Pattern does not match')

export const email = (schema: Schema<string>) =>
  pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)(schema)

export const url = (schema: Schema<string>) =>
  schema.refine(val => {
    try {
      new URL(val)
      return true
    } catch {
      return false
    }
  }, 'Invalid URL')

export const int = (schema: Schema<number>) =>
  schema.refine(val => Number.isInteger(val), 'Must be integer')

export const positive = (schema: Schema<number>) =>
  schema.refine(val => val > 0, 'Must be positive')

// Object validation
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
      const fieldResult = schema(obj[key])
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

// Composable validation chains
export const pipe = <T, U>(
  schema: Schema<T>,
  ...transforms: Array<(s: Schema<T>) => Schema<U>>
) =>
  transforms.reduce((s, transform) => transform(s as any), schema) as Schema<U>

// Smart builders for common patterns
export const email_string = () => pipe(string(), email)
export const url_string = () => pipe(string(), url)
export const positive_int = () => pipe(number(), int, positive)
export const id_string = () => pipe(string(), minLength(1), maxLength(100))
export const safe_string = () => pipe(string(), maxLength(1000))

// Type inference helper
export type Infer<T extends Schema> = T extends Schema<infer U> ? U : never

// Schema validation function for action integration
export const validate = <T>(
  schema: Schema<T>,
  payload: ActionPayload
): ValidationResult<T> => {
  const result = schema(payload)

  if (!result.ok) {
    log.error('Schema validation failed:', result.errors)
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

  // Constraints
  min,
  max,
  length,
  minLength,
  maxLength,
  pattern,
  email,
  url,
  int,
  positive,

  // Builders
  pipe,
  email_string,
  url_string,
  positive_int,
  id_string,
  safe_string,
  actionPayload,

  // Validation
  validate
}

export default schema
