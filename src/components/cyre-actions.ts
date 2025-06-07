// src/components/cyre-actions.ts
// Action registration with performance optimized compilation

import {sensor} from '../context/metrics-report'
import type {IO} from '../types/core'
import {addChannelToGroups, getChannelGroups} from './cyre-group'
import payloadState from '../context/payload-state'
import {log} from './cyre-log'
import {io} from '../context/state'
import {compileActionWithStats} from '../schema/compilation-integration'
import {pathEngine} from '../schema/path-engine'

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
const validateChannelId = (
  action: any
): {valid: boolean; error?: string; details?: any} => {
  if (action === null || action === undefined) {
    return {
      valid: false,
      error: 'Action cannot be null or undefined',
      details: {provided: action, type: typeof action}
    }
  }

  if (typeof action !== 'object') {
    return {
      valid: false,
      error: 'Action must be an object',
      details: {provided: action, type: typeof action}
    }
  }

  if (!action.id) {
    return {
      valid: false,
      error: 'Action ID is required',
      details: {
        provided: action.id,
        hasId: 'id' in action,
        actionKeys: Object.keys(action),
        suggestions: ['Provide a unique string identifier for this action']
      }
    }
  }

  if (typeof action.id !== 'string') {
    return {
      valid: false,
      error: 'Action ID must be a string',
      details: {
        provided: action.id,
        type: typeof action.id,
        suggestions: [
          'Use a string identifier like "user-login" or "data-fetch"'
        ]
      }
    }
  }

  if (action.id.trim().length === 0) {
    return {
      valid: false,
      error: 'Action ID cannot be empty or whitespace only',
      details: {
        provided: action.id,
        length: action.id.length,
        suggestions: ['Provide a meaningful non-empty string identifier']
      }
    }
  }

  return {valid: true}
}

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
    warnings.push(
      'throttle below 16ms may cause performance issues - consider using requestAnimationFrame'
    )
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
    const validation = validateChannelId(action)
    if (!validation.valid) {
      const registrationTime = performance.now() - startTime

      sensor.error(
        action?.id || 'unknown',
        validation.error!,
        'action-id-validation-failed',
        {
          ...validation.details,
          registrationTime
        }
      )

      log.error(`Action ID validation failed: ${validation.error}`)

      return {
        ok: false,
        message: validation.error!,
        errors: [validation.error!],
        compilationTime: registrationTime
      }
    }

    // 2. CHECK IF ACTION EXISTS
    const exists = !!io.get(action.id)

    // 3. SET DEFAULTS FOR OPTIONAL ATTRIBUTES
    const actionWithDefaults: Partial<IO> = {
      type: action.id, // Default type to id if not specified
      ...action
    }

    // 4. COMPILE ACTION WITH PERFORMANCE TRACKING
    let compilation
    try {
      compilation = compileActionWithStats(actionWithDefaults)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const registrationTime = performance.now() - startTime

      sensor.error(action.id, errorMessage, 'compilation-exception', {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        actionConfig: Object.keys(actionWithDefaults),
        registrationTime
      })

      log.error(
        `Action compilation threw exception for ${action.id}: ${errorMessage}`
      )

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

      sensor.error(action.id, detailedMessage, 'compilation-errors', {
        errors: compilation.errors,
        warnings: compilation.warnings,
        hasFastPath: compilation.hasFastPath,
        actionConfig: Object.keys(actionWithDefaults),
        compilationTime: compilation.compilationTime
      })

      log.error(
        `Action compilation failed for ${action.id}:`,
        compilation.errors
      )

      // Handle blocking conditions
      if (compilation.compiledAction._isBlocked) {
        io.set(compilation.compiledAction)

        sensor.log(action.id, 'blocked', 'action-blocked-during-compilation', {
          blockReason: compilation.compiledAction._blockReason,
          errors: compilation.errors,
          compilationTime: compilation.compilationTime
        })

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
        'cross-validation-errors',
        {
          errors: crossValidation.errors,
          warnings: crossValidation.warnings,
          compilationTime: compilation.compilationTime
        }
      )

      log.error(
        `Cross-validation failed for ${action.id}:`,
        crossValidation.errors
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

        sensor.log(finalAction.id, 'info', 'path-indexed-successfully', {
          path: finalAction.path,
          segments: pathEngine.parse(finalAction.path).length,
          indexed: true,
          isUpdate: exists,
          compilationTime: compilation.compilationTime
        })

        // Verify indexing worked
        const indexedPath = pathEngine.getPath(finalAction.id)
        if (indexedPath !== finalAction.path) {
          sensor.warn(finalAction.id, 'Path indexing mismatch detected', {
            expected: finalAction.path,
            actual: indexedPath,
            indexed: !!indexedPath
          })

          log.warn(
            `Path indexing mismatch for ${finalAction.id}: expected '${finalAction.path}', got '${indexedPath}'`
          )
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        sensor.error(finalAction.id, errorMessage, 'path-indexing-failed', {
          path: finalAction.path,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown'
        })

        log.error(`Path indexing failed for ${finalAction.id}: ${errorMessage}`)

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

      sensor.warn(finalAction.id, `Group assignment failed: ${errorMessage}`, {
        error: errorMessage
      })

      log.warn(`Group assignment failed for ${finalAction.id}: ${errorMessage}`)
      // Continue with registration even if group assignment fails
      crossValidation.warnings.push(`Group assignment failed: ${errorMessage}`)
    }

    // 8. STORE COMPILED ACTION
    try {
      io.set(finalAction)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const registrationTime = performance.now() - startTime

      sensor.error(finalAction.id, errorMessage, 'action-storage-failed', {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        registrationTime,
        compilationTime: compilation.compilationTime
      })

      log.error(`Failed to store action ${finalAction.id}: ${errorMessage}`)

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

        sensor.warn(
          finalAction.id,
          `Payload initialization failed: ${errorMessage}`,
          {
            payloadType: typeof action.payload,
            error: errorMessage
          }
        )

        log.warn(
          `Payload initialization failed for ${finalAction.id}: ${errorMessage}`
        )
        // Continue - payload initialization failure is not critical
        crossValidation.warnings.push(
          `Payload initialization failed: ${errorMessage}`
        )
      }
    }

    // 10. GENERATE STATUS MESSAGE AND METRICS
    const channelGroups = getChannelGroups(finalAction.id)
    const actionMessage = exists ? 'Action updated' : 'Action registered'
    const registrationTime = performance.now() - startTime

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

    // Comprehensive metrics logging
    sensor.log(finalAction.id, 'success', 'action-registration-complete', {
      isUpdate: exists,
      attributeCount: Object.keys(action).length,
      hasFastPath: finalAction._hasFastPath,
      hasProtections: finalAction._hasProtections,
      hasProcessing: finalAction._hasProcessing,
      hasScheduling: finalAction._hasScheduling,
      hasIntelligence: finalAction._hasIntelligence,
      processingTalents: finalAction._processingTalents,
      isBlocked: finalAction._isBlocked,
      groupCount: channelGroups.length,
      groupIds: channelGroups.map(g => g.id),
      path: finalAction.path,
      pathIndexed: !!finalAction.path,
      compilationSuccess: true,
      compilationTime: compilation.compilationTime,
      registrationTime,
      warnings: [...compilation.warnings, ...crossValidation.warnings],
      cacheStats: compilation.stats
    })

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
      'action-registration-exception',
      {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        registrationTime,
        actionProvided: !!action,
        actionId: action?.id
      }
    )

    log.error(
      `Action processing exception for ${
        action?.id || 'unknown'
      }: ${errorMessage}`
    )

    return {
      ok: false,
      message: `Registration failed: ${errorMessage}`,
      errors: [errorMessage],
      compilationTime: registrationTime
    }
  }
}
