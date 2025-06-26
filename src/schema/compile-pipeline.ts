import {ChannelOperator, IO} from '../types/core'
import {dataDefinitions} from './data-definitions'

// Talent categories for optimization flags
const PROTECTION_TALENTS: ChannelOperator[] = [
  'block',
  'throttle',
  'debounce'
] as const

const PROCESSING_TALENTS: ChannelOperator[] = [
  'schema',
  'condition',
  'selector',
  'transform',
  'detectChanges',
  'required'
] as const

const SCHEDULING_TALENTS = ['interval', 'delay', 'repeat'] as const

export const compileAction = (
  action: Partial<IO>
): {
  compiledAction: IO
  errors: string[]
  warnings: string[]
  block: boolean
} => {
  const errors: string[] = []
  const warnings: string[] = []
  const compiledAction: Partial<IO> = {...action}
  const processingPipeline: ChannelOperator[] = []

  // Track talent categories with single-pass detection
  let hasProtections = false
  let hasScheduling = false
  let hasProcessing = false
  let isBlocked = false

  // Smart field processing - preserve user order, validate efficiently
  for (const [key, value] of Object.entries(action)) {
    const definition = dataDefinitions[key as keyof typeof dataDefinitions]

    if (!definition) {
      // Unknown field - pass through with warning
      warnings.push(`Unknown field: ${key}`)
      compiledAction[key as keyof IO] = value
      continue
    }

    // Validate field with actual value, not key
    const result = definition(value)

    if (!result.ok) {
      if (result.blocking) {
        // Immediate blocking condition - early exit
        return {
          compiledAction: {
            ...action,
            _isBlocked: true,
            _blockReason: result.error!,
            _pipeline: []
          } as IO,
          errors: [result.error!],
          warnings,
          block: true
        }
      }
      errors.push(result.error || 'Validation failed')
      continue
    }

    // Store validated value
    compiledAction[key as keyof IO] = result.data

    // Smart categorization - single check per field
    if (result.operator) {
      switch (result.operator) {
        case 'schema':
        case 'condition':
        case 'selector':
        case 'transform':
        case 'detectChanges':
        case 'required':
          processingPipeline.push(result.operator)
          hasProcessing = true
          break

        case 'block':
        case 'throttle':
        case 'debounce':
          hasProtections = true
          break

        case 'schedule':
          hasScheduling = true
          break
      }
    }
  }

  // Phase 2: Cross-validation rules
  const crossValidation = validateCrossRules(compiledAction)
  errors.push(...crossValidation.errors)
  warnings.push(...crossValidation.warnings)

  // Check for blocking cross-validation errors
  if (crossValidation.errors.length > 0) {
    isBlocked = true
  }

  // Smart compilation flags - computed once
  const hasFastPath = !hasProtections && !hasProcessing && !hasScheduling

  // Efficient final assembly
  Object.assign(compiledAction, {
    _hasFastPath: hasFastPath,
    _hasProtections: hasProtections,
    _hasProcessing: hasProcessing,
    _hasScheduling: hasScheduling,
    _pipeline: processingPipeline.length > 0 ? processingPipeline : undefined
  })

  return {
    compiledAction: compiledAction as IO,
    errors,
    warnings,
    block: isBlocked
  }
}

// Cross-validation function for dependency and conflict checks
export const validateCrossRules = (
  action: Partial<IO>
): {
  errors: string[]
  warnings: string[]
} => {
  const errors: string[] = []
  const warnings: string[] = []

  // Dependency requirements
  if (action.interval !== undefined && action.repeat === undefined) {
    errors.push(
      'interval requires repeat to be specified (add repeat: true for infinite)'
    )
  }

  if (action.maxWait !== undefined && action.debounce === undefined) {
    errors.push('maxWait requires debounce to be specified')
  }

  // Conflicting combinations
  if (
    action.throttle &&
    action.debounce &&
    action.throttle > 0 &&
    action.debounce > 0
  ) {
    errors.push(
      'throttle and debounce cannot both be active (choose one based on use case)'
    )
  }

  if (action.maxWait && action.debounce && action.maxWait <= action.debounce) {
    errors.push(
      'maxWait must be greater than debounce (set maxWait to at least 2x debounce)'
    )
  }

  // Performance warnings
  if (action.throttle && action.throttle < 16) {
    warnings.push('throttle below 16ms may cause performance issues')
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

  // Logical warnings
  if (action.schema && !action.required) {
    warnings.push(
      'schema validation without required may allow undefined payloads'
    )
  }

  if (action.condition && action.selector) {
    warnings.push(
      'using both condition and selector - ensure selector runs before condition'
    )
  }

  if (action.transform && !action.detectChanges) {
    warnings.push(
      'transform without detectChanges may cause unnecessary executions'
    )
  }

  return {errors, warnings}
}
