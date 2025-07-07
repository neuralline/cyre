// Enhanced compile-pipeline.ts with function reference pre-compilation

import type {IO, ChannelOperator} from '../types/core'
import {dataDefinitions} from './data-definitions'
import {talentOperators, type TalentFunction} from './talent-definitions' // Import the Map and type

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
      warnings.push(`Unknown field: ${key}`)
      compiledAction[key as keyof IO] = value
      continue
    }

    const result = definition(value)

    if (!result.ok) {
      if (result.blocking) {
        return {
          compiledAction: {
            ...action,
            _isBlocked: true,
            _blockReason: result.error!,
            _pipeline: undefined // No pipeline for blocked actions
          } as IO,
          errors: [result.error!],
          warnings,
          block: true
        }
      }
      errors.push(result.error || 'Validation failed')
      continue
    }

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

    if (['interval', 'delay', 'repeat'].includes(key)) {
      hasScheduling = true
    }
  }

  // Phase 2: Cross-validation rules
  const crossValidation = validateCrossRules(compiledAction)
  errors.push(...crossValidation.errors)
  warnings.push(...crossValidation.warnings)

  if (crossValidation.errors.length > 0) {
    isBlocked = true
  }

  // RUST-STYLE OPTIMIZATION: Pre-compile function references into _pipeline
  let compiledPipeline: TalentFunction[] | undefined

  if (processingPipeline.length > 0) {
    // Pre-compile function references for maximum hot path performance
    compiledPipeline = processingPipeline.map(talentName => {
      const talentFn = talentOperators.get(talentName)
      if (!talentFn) {
        errors.push(`Unknown talent operator: ${talentName}`)
        return () => ({ok: false, error: 'Unknown talent'})
      }
      return talentFn
    })
  }

  const hasFastPath = !hasProtections && !hasProcessing && !hasScheduling

  // Efficient final assembly
  Object.assign(compiledAction, {
    _hasFastPath: hasFastPath,
    _hasProtections: hasProtections,
    _hasProcessing: hasProcessing,
    _hasScheduling: hasScheduling,
    _pipeline: compiledPipeline // Now contains function references, not strings
  })

  return {
    compiledAction: compiledAction as IO,
    errors,
    warnings,
    block: isBlocked
  }
}

// Enhanced executePipeline with function reference optimization
export const executePipeline = (action: IO, payload: any) => {
  // Ultra-fast path: No processing needed
  if (!action._pipeline?.length) {
    return {ok: true, data: payload}
  }

  const functions = action._pipeline // Now contains function references
  const functionCount = functions.length

  // Specialized fast paths for common cases
  if (functionCount === 1) {
    // Single talent - direct call
    return functions[0](action, payload)
  }

  if (functionCount === 2) {
    // Dual talent - unrolled loop
    const result1 = functions[0](action, payload)
    if (!result1.ok) return result1
    return functions[1](
      action,
      result1.data !== undefined ? result1.data : payload
    )
  }

  // General case - optimized loop with function references
  let currentData = payload

  for (let i = 0; i < functionCount; i++) {
    const result = functions[i](action, currentData)

    if (!result.ok) {
      return {
        ok: false,
        error: result.error || `Talent failed at position ${i}`,
        blocking: result.blocking
      }
    }

    if (result.data !== undefined) {
      currentData = result.data
    }
  }

  return {ok: true, data: currentData}
}

// Cross-validation remains the same
const validateCrossRules = (
  action: Partial<IO>
): {
  errors: string[]
  warnings: string[]
} => {
  const errors: string[] = []
  const warnings: string[] = []

  if (action.interval !== undefined && action.repeat === undefined) {
    errors.push(
      'interval requires repeat to be specified (add repeat: true for infinite)'
    )
  }

  if (action.maxWait !== undefined && action.debounce === undefined) {
    errors.push('maxWait requires debounce to be specified')
  }

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
