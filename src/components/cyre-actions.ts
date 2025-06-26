// src/components/cyre-actions.ts
// Action registration with performance optimized compilation

import {sensor} from '../context/metrics-report'
import type {IO} from '../types/core'
import {addChannelToGroups} from './cyre-group'
import payloadState from '../context/payload-state'
import {log} from './cyre-log'
import {io} from '../context/state'
import {pathEngine} from '../schema/path-engine'
import {compileAction} from '../schema/data-definitions'

/*

      C.Y.R.E - A.C.T.I.O.N.S

      Performance optimized action registration:
      1. Validate basic structure with detailed error messages
      2. Compile action with performance tracking and statistics
      3. Set optimization flags with validation and warnings
      4. Index paths with error handling
      5. Store compiled action with success confirmation
      6. Track performance metrics for optimization

*/

interface RegistrationResult {
  ok: boolean
  message: string
  payload?: IO
  errors?: string[]
  warnings?: string[]
  compilationTime?: number
  hasFastPath?: boolean
}

/**
 * Validate channel ID and basic structure with detailed error reporting
 */

/**
 * Cross-attribute validation with detailed error reporting
 */
const validateCrossAttributes = (
  action: Partial<IO>
): {errors: string[]; warnings: string[]} => {
  const errors: string[] = []
  const warnings: string[] = []

  // Interval requires repeat
  if (action.interval !== undefined && action.repeat === undefined) {
    errors.push(
      'interval requires repeat to be specified (suggestion: add repeat: true for infinite)'
    )
  }

  // Throttle and debounce conflict
  if (
    action.throttle &&
    action.debounce &&
    action.throttle > 0 &&
    action.debounce > 0
  ) {
    errors.push(
      'throttle and debounce cannot both be active (suggestion: choose one based on use case)'
    )
  }

  // MaxWait requires debounce
  if (action.maxWait !== undefined && action.debounce === undefined) {
    errors.push('maxWait requires debounce to be specified')
  }

  if (action.maxWait && action.debounce && action.maxWait <= action.debounce) {
    errors.push(
      'maxWait must be greater than debounce (suggestion: set maxWait to at least 2x debounce)'
    )
  }

  // Path validation
  if (action.path) {
    if (!pathEngine.isValidPath(action.path)) {
      errors.push(
        'path must be a valid hierarchical path (suggestion: use format "app/users/profile")'
      )
    }
  }

  // Performance warnings
  if (action.throttle && action.throttle < 16) {
    warnings.push('throttle below 16ms may cause performance issues ')
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

  // Schema and condition warnings
  if (action.schema && !action.required) {
    warnings.push(
      'schema validation without required may allow undefined payloads'
    )
  }

  // Talent combination warnings
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

export const CyreActions = (action: IO): RegistrationResult => {
  const startTime = performance.now()

  try {
    // 1. VALIDATE CHANNEL ID AND BASIC STRUCTURE

    if (!action.id) {
      sensor.error(
        action?.id || 'unknown',
        'Channel id validation failed',
        'cyre-action'
      )

      return {
        ok: false,
        message: 'Channel id validation failed',
        errors: ['Channel id validation failed'],
        compilationTime: performance.now() - startTime
      }
    }

    // 3. SET DEFAULTS FOR OPTIONAL ATTRIBUTES
    const actionWithDefaults: Partial<IO> = {
      type: action.id, // Default type to id if not specified
      ...action
    }

    // 4. COMPILE ACTION WITH PERFORMANCE TRACKING
    let compilation
    try {
      compilation = compileAction(actionWithDefaults)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const registrationTime = performance.now() - startTime

      sensor.error(action.id, errorMessage, 'compilation-exception')

      return {
        ok: false,
        message: `Compilation exception: ${errorMessage}`,
        errors: [errorMessage],
        compilationTime: registrationTime
      }
    }

    if (compilation.errors.length > 0) {
      const detailedMessage = `Compilation failed: ${compilation.errors.join(
        ', '
      )}`

      sensor.error(action.id, detailedMessage, 'compilation-errors')

      log.error(
        `Action compilation failed for ${action.id}:`,
        compilation.errors
      )

      // Handle blocking conditions
      if (compilation.compiledAction._isBlocked) {
        io.set(compilation.compiledAction)

        return {
          ok: false,
          message: compilation.compiledAction._blockReason!,
          payload: compilation.compiledAction,
          errors: compilation.errors,
          warnings: compilation.warnings,
          compilationTime: compilation.compilationTime
        }
      }

      return {
        ok: false,
        message: `Compilation failed: ${compilation.errors.join(', ')}`,
        errors: compilation.errors,
        warnings: compilation.warnings,
        compilationTime: compilation.compilationTime
      }
    }

    const finalAction = compilation.compiledAction

    // 5. CROSS-ATTRIBUTE VALIDATION WITH DETAILED WARNINGS
    const crossValidation = validateCrossAttributes(finalAction)
    if (crossValidation.errors.length > 0) {
      sensor.error(
        action.id,
        'Cross-validation failed',
        'cross-validation-errors'
      )

      return {
        ok: false,
        message: `Cross-validation failed: ${crossValidation.errors.join(
          ', '
        )}`,
        errors: crossValidation.errors,
        warnings: [...compilation.warnings, ...crossValidation.warnings],
        compilationTime: compilation.compilationTime
      }
    }

    // 6. INDEX PATH IF PROVIDED
    if (finalAction.path && pathEngine.isValidPath(finalAction.path)) {
      try {
        pathEngine.add(finalAction.id, finalAction.path)

        // Verify indexing worked
        const indexedPath = pathEngine.getPath(finalAction.id)
        if (indexedPath !== finalAction.path) {
          sensor.warn(finalAction.id, 'Path indexing mismatch detected', {
            expected: finalAction.path,
            actual: indexedPath,
            indexed: !!indexedPath
          })
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        sensor.error(finalAction.id, errorMessage, 'path-indexing-failed')

        // Continue with registration even if path indexing fails
        crossValidation.warnings.push(`Path indexing failed: ${errorMessage}`)
      }
    }

    // 7. ADD TO GROUPS WITH ERROR HANDLING
    try {
      addChannelToGroups(finalAction.id)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      sensor.error(
        finalAction.id,
        `Group assignment failed: ${errorMessage}`,
        'cyre-action'
      )

      // Continue with registration even if group assignment fails
      crossValidation.warnings.push(`Group assignment failed: ${errorMessage}`)
    }

    // 8. STORE COMPILED ACTION
    try {
      io.set({...action, ...finalAction})
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      sensor.error(finalAction.id, errorMessage, 'action-storage-failed')

      return {
        ok: false,
        message: `Action storage failed: ${errorMessage}`,
        errors: [errorMessage],
        compilationTime: compilation.compilationTime
      }
    }

    // 9. INITIALIZE PAYLOAD STATE IF PROVIDED
    if ('payload' in action && action.payload !== undefined) {
      try {
        payloadState.set(finalAction.id, action.payload, 'initial')
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        // Continue - payload initialization failure is not critical
        crossValidation.warnings.push(
          `Payload initialization failed: ${errorMessage}`
        )
      }
    }

    // 2. CHECK IF ACTION EXISTS
    const exists = !!io.get(action.id)

    const actionMessage = exists ? 'Action updated' : 'Action registered'

    let statusMsg: string
    if (finalAction._hasFastPath) {
      statusMsg = 'Fast path (optimized)'
    } else {
      const features: string[] = []
      if (finalAction._hasProtections) features.push('protections')
      if (finalAction._hasProcessing) {
        const talentCount = finalAction._processingTalents?.length || 0
        features.push(`${talentCount} processing talents`)
      }
      if (finalAction._hasScheduling) features.push('scheduling')
      if (finalAction._hasIntelligence) features.push('intelligence')
      statusMsg = features.join(', ')
    }

    // Add path info to status if available
    if (finalAction.path) {
      statusMsg += ` (path: ${finalAction.path})`
    }

    // Add performance info for slow compilations
    if (compilation.compilationTime > 5) {
      statusMsg += ` [${compilation.compilationTime.toFixed(1)}ms compilation]`
    }

    //log.debug(`${actionMessage} ${finalAction.id}: ${statusMsg}`)

    // Combine all warnings
    const allWarnings = [...compilation.warnings, ...crossValidation.warnings]

    return {
      ok: true,
      message: `${actionMessage}: ${statusMsg}`,
      payload: finalAction,
      warnings: allWarnings,
      compilationTime: compilation.compilationTime,
      hasFastPath: finalAction._hasFastPath
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const registrationTime = performance.now() - startTime

    sensor.error(
      action?.id || 'unknown',
      errorMessage,
      'action-registration-exception'
    )

    return {
      ok: false,
      message: `Registration failed: ${errorMessage}`,
      errors: [errorMessage],
      compilationTime: registrationTime
    }
  }
}
