// src/schema/functional-schema.ts
// File location: Improved functional schema system with better composition and performance

/*
  C.Y.R.E - F.U.N.C.T.I.O.N.A.L - S.C.H.E.M.A
  
  Issues with current schema:
  1. Complex inheritance chains (NumberSchema extends Schema)
  2. Runtime method attachment creates performance overhead
  3. Type inference issues with complex nested schemas
  4. Missing functional composition patterns
  5. No optimization for common validation patterns
  6. Error handling not functional enough
  
  Improvements:
  - Pure functional approach with composition
  - Better performance with memoization
  - Cleaner type inference
  - Functional error handling with Result types
  - Built-in optimization for hot paths
*/

// ===========================================
// CORE FUNCTIONAL TYPES
// ===========================================

/**
 * Result type for functional error handling
 */
export type ValidationResult<T> =
  | {readonly success: true; readonly data: T}
  | {readonly success: false; readonly errors: readonly string[]}

/**
 * Pure validator function
 */
export type Validator<T> = (value: unknown) => ValidationResult<T>

/**
 * Schema builder function (pure)
 */
export type SchemaBuilder<T> = () => Validator<T>

/**
 * Schema transformer function (pure)
 */
export type SchemaTransform<T, U> = (validator: Validator<T>) => Validator<U>

// ===========================================
// HELPER FUNCTIONS (PURE)
// ===========================================

/**
 * Create success result
 */
const ok = <T>(data: T): ValidationResult<T> => ({success: true, data})

/**
 * Create error result
 */
const err = (errors: string | readonly string[]): ValidationResult<never> => ({
  success: false,
  errors: Array.isArray(errors) ? errors : [errors]
})

/**
 * Compose two validators (functional composition)
 */
const compose =
  <T, U>(first: Validator<T>, second: SchemaTransform<T, U>): Validator<U> =>
  (value: unknown) => {
    const result = first(value)
    return result.success
      ? second(first)(value)
      : (result as ValidationResult<U>)
  }

/**
 * Memoize validator for performance (pure function memoization)
 */
const memoize = <T>(validator: Validator<T>): Validator<T> => {
  const cache = new Map<unknown, ValidationResult<T>>()

  return (value: unknown) => {
    // Simple cache key for primitives
    const key = typeof value === 'object' ? JSON.stringify(value) : value

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = validator(value)
    cache.set(key, result)
    return result
  }
}

// ===========================================
// CORE VALIDATORS (PURE FUNCTIONS)
// ===========================================

/**
 * String validator
 */
export const string: SchemaBuilder<string> = () => (value: unknown) =>
  typeof value === 'string' ? ok(value) : err('Expected string')

/**
 * Number validator
 */
export const number: SchemaBuilder<number> = () => (value: unknown) =>
  typeof value === 'number' && !isNaN(value)
    ? ok(value)
    : err('Expected number')

/**
 * Boolean validator
 */
export const boolean: SchemaBuilder<boolean> = () => (value: unknown) =>
  typeof value === 'boolean' ? ok(value) : err('Expected boolean')

/**
 * Any validator (always succeeds)
 */
export const any: SchemaBuilder<unknown> = () => (value: unknown) => ok(value)

/**
 * Literal validator
 */
export const literal =
  <T extends string | number | boolean>(expected: T): SchemaBuilder<T> =>
  () =>
  (value: unknown) =>
    value === expected ? ok(expected) : err(`Expected ${expected}`)

/**
 * Enum validator (improved implementation)
 */
export const enums =
  <const T extends readonly string[]>(...values: T): SchemaBuilder<T[number]> =>
  () =>
  (value: unknown) =>
    typeof value === 'string' && values.includes(value as T[number])
      ? ok(value as T[number])
      : err(`Expected one of: ${values.join(', ')}`)

// ===========================================
// CONSTRAINT TRANSFORMS (PURE FUNCTIONS)
// ===========================================

/**
 * String constraints
 */
export const minLength =
  (min: number): SchemaTransform<string, string> =>
  validator =>
  (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result

    return result.data.length >= min
      ? ok(result.data)
      : err(`Must be at least ${min} characters`)
  }

export const maxLength =
  (max: number): SchemaTransform<string, string> =>
  validator =>
  (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result

    return result.data.length <= max
      ? ok(result.data)
      : err(`Must be at most ${max} characters`)
  }

export const pattern =
  (regex: RegExp): SchemaTransform<string, string> =>
  validator =>
  (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result

    return regex.test(result.data)
      ? ok(result.data)
      : err(`Must match pattern ${regex}`)
  }

/**
 * Number constraints
 */
export const min =
  (minimum: number): SchemaTransform<number, number> =>
  validator =>
  (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result

    return result.data >= minimum
      ? ok(result.data)
      : err(`Must be at least ${minimum}`)
  }

export const max =
  (maximum: number): SchemaTransform<number, number> =>
  validator =>
  (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result

    return result.data <= maximum
      ? ok(result.data)
      : err(`Must be at most ${maximum}`)
  }

export const integer: SchemaTransform<number, number> =
  validator => (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result

    return Number.isInteger(result.data)
      ? ok(result.data)
      : err('Must be an integer')
  }

export const positive: SchemaTransform<number, number> =
  validator => (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result

    return result.data > 0 ? ok(result.data) : err('Must be positive')
  }

// ===========================================
// GENERIC TRANSFORMS (PURE FUNCTIONS)
// ===========================================

/**
 * Optional transform (allows undefined)
 */
export const optional =
  <T>(validator: Validator<T>): Validator<T | undefined> =>
  (value: unknown) =>
    value === undefined ? ok(undefined) : validator(value)

/**
 * Nullable transform (allows null)
 */
export const nullable =
  <T>(validator: Validator<T>): Validator<T | null> =>
  (value: unknown) =>
    value === null ? ok(null) : validator(value)

/**
 * Default value transform
 */
export const withDefault =
  <T>(defaultValue: T) =>
  (validator: Validator<T>): Validator<T> =>
  (value: unknown) =>
    value === undefined ? ok(defaultValue) : validator(value)

/**
 * Transform the result (map function)
 */
export const transform =
  <T, U>(fn: (value: T) => U) =>
  (validator: Validator<T>): Validator<U> =>
  (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result as ValidationResult<U>

    try {
      return ok(fn(result.data))
    } catch (error) {
      return err(`Transform failed: ${error}`)
    }
  }

/**
 * Refine with custom validation
 */
export const refine =
  <T>(predicate: (value: T) => boolean, message: string) =>
  (validator: Validator<T>): Validator<T> =>
  (value: unknown) => {
    const result = validator(value)
    if (!result.success) return result

    return predicate(result.data) ? ok(result.data) : err(message)
  }

// ===========================================
// COMPOSITE VALIDATORS (PURE FUNCTIONS)
// ===========================================

/**
 * Object validator with better type inference
 */
export const object =
  <T extends Record<string, Validator<any>>>(
    shape: T
  ): Validator<{
    [K in keyof T]: T[K] extends Validator<infer U> ? U : never
  }> =>
  (value: unknown) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return err('Expected object')
    }

    const obj = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    const errors: string[] = []

    for (const [key, validator] of Object.entries(shape)) {
      const fieldResult = validator(obj[key])

      if (fieldResult.success) {
        result[key] = fieldResult.data
      } else {
        errors.push(...fieldResult.errors.map(error => `${key}: ${error}`))
      }
    }

    return errors.length > 0 ? err(errors) : ok(result as any)
  }

/**
 * Array validator
 */
export const array =
  <T>(itemValidator: Validator<T>): Validator<T[]> =>
  (value: unknown) => {
    if (!Array.isArray(value)) {
      return err('Expected array')
    }

    const result: T[] = []
    const errors: string[] = []

    for (let i = 0; i < value.length; i++) {
      const itemResult = itemValidator(value[i])

      if (itemResult.success) {
        result.push(itemResult.data)
      } else {
        errors.push(...itemResult.errors.map(error => `[${i}]: ${error}`))
      }
    }

    return errors.length > 0 ? err(errors) : ok(result)
  }

/**
 * Union validator (tries validators in order)
 */
export const union =
  <T extends readonly Validator<any>[]>(
    ...validators: T
  ): Validator<T[number] extends Validator<infer U> ? U : never> =>
  (value: unknown) => {
    for (const validator of validators) {
      const result = validator(value)
      if (result.success) return result as any
    }

    return err('No union variant matched')
  }

// ===========================================
// FUNCTIONAL COMPOSITION UTILITIES
// ===========================================

/**
 * Pipe function for functional composition
 */
export const pipe = <T, U1, U2, U3, U4, U5>(
  validator: Validator<T>,
  ...transforms: [
    SchemaTransform<T, U1>?,
    SchemaTransform<U1, U2>?,
    SchemaTransform<U2, U3>?,
    SchemaTransform<U3, U4>?,
    SchemaTransform<U4, U5>?
  ]
): Validator<
  U5 extends undefined
    ? U4 extends undefined
      ? U3 extends undefined
        ? U2 extends undefined
          ? U1 extends undefined
            ? T
            : U1
          : U2
        : U3
      : U4
    : U5
> => {
  return transforms
    .filter(Boolean)
    .reduce((acc: any, transform: any) => transform(acc), validator) as any
}

/**
 * Combine multiple validators with AND logic
 */
export const all =
  <T>(...validators: Validator<T>[]): Validator<T> =>
  (value: unknown) => {
    for (const validator of validators) {
      const result = validator(value)
      if (!result.success) return result
    }

    // Return the result of the last validator
    return validators[validators.length - 1](value)
  }

// ===========================================
// OPTIMIZED COMMON PATTERNS
// ===========================================

/**
 * Pre-built email validator (optimized)
 */
export const email = (): Validator<string> =>
  memoize(pipe(string(), pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)))

/**
 * Pre-built URL validator (optimized)
 */
export const url = (): Validator<string> =>
  memoize(
    pipe(
      string(),
      refine(value => {
        try {
          new URL(value)
          return true
        } catch {
          return false
        }
      }, 'Must be a valid URL')
    )
  )

/**
 * Pre-built ID validator (optimized for common use case)
 */
export const id = (): Validator<string> =>
  memoize(pipe(string(), minLength(1), pattern(/^[a-zA-Z0-9_-]+$/)))

/**
 * Pre-built timestamp validator
 */
export const timestamp = (): Validator<number> =>
  memoize(pipe(number(), min(0), integer))

// ===========================================
// PERFORMANCE OPTIMIZATIONS
// ===========================================

/**
 * Fast path for simple validations (no constraints)
 */
const fastValidators = {
  string: memoize(string()),
  number: memoize(number()),
  boolean: memoize(boolean()),
  any: any()
} as const

/**
 * Get optimized validator for simple cases
 */
export const fast = <K extends keyof typeof fastValidators>(
  type: K
): (typeof fastValidators)[K] => fastValidators[type]

// ===========================================
// MAIN SCHEMA API (FUNCTIONAL)
// ===========================================

/**
 * Main schema API with functional composition
 */
export const schema = {
  // Core validators
  string,
  number,
  boolean,
  any,
  literal,
  enums,

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

  // Pre-built optimized validators
  email,
  url,
  id,
  timestamp,

  // Performance optimizations
  fast,
  memoize,

  // Utility
  validate: <T>(validator: Validator<T>, value: unknown): ValidationResult<T> =>
    validator(value)
} as const

// ===========================================
// TYPE INFERENCE HELPER
// ===========================================

/**
 * Infer the output type of a validator
 */
export type Infer<T extends Validator<any>> = T extends Validator<infer U>
  ? U
  : never

// ===========================================
// EXAMPLES OF USAGE
// ===========================================

/*
// Simple usage:
const userValidator = schema.object({
  id: schema.fast('string'),
  email: schema.email(),
  age: schema.pipe(schema.number(), schema.min(0), schema.max(120))
})

// Complex composition:
const complexValidator = schema.pipe(
  schema.string(),
  schema.minLength(3),
  schema.maxLength(50),
  schema.pattern(/^[a-zA-Z0-9_-]+$/),
  schema.transform(s => s.toLowerCase())
)

// With default values:
const configValidator = schema.object({
  name: schema.fast('string'),
  enabled: schema.pipe(schema.boolean(), schema.withDefault(true)),
  timeout: schema.pipe(schema.number(), schema.min(0), schema.withDefault(5000))
})

// Performance optimized for hot paths:
const hotPathValidator = schema.memoize(
  schema.pipe(
    schema.fast('string'),
    schema.minLength(1)
  )
)
*/

export default schema
