// src/components/cyre-actions.ts
// Action registration with comprehensive error reporting and talent compilation

import {sensor} from '../context/metrics-report'
import type {IO} from '../types/core'
import {addChannelToGroups, getChannelGroups} from './cyre-group'
import payloadState from '../context/payload-state'
import {log} from './cyre-log'
import {io} from '../context/state'
import {compileAction} from '../schema/data-definitions'
import {pathEngine} from '../schema/path-engine'

/*

      C.Y.R.E - A.C.T.I.O.N.S

      Action registration with comprehensive error reporting:
      1. Validate basic structure with detailed error messages
      2. Compile action with talent discovery and error reporting
      3. Set optimization flags with validation
      4. Index paths with error handling
      5. Store compiled action with success confirmation

*/

interface RegistrationResult {
  ok: boolean
  message: string
  payload?: IO
  errors?: string[]
  warnings?: string[]
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
        actionKeys: Object.keys(action)
      }
    }
  }

  if (typeof action.id !== 'string') {
    return {
      valid: false,
      error: 'Action ID must be a string',
      details: {provided: action.id, type: typeof action.id}
    }
  }

  if (action.id.trim().length === 0) {
    return {
      valid: false,
      error: 'Action ID cannot be empty or whitespace only',
      details: {provided: action.id, length: action.id.length}
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
    errors.push('interval requires repeat to be specified')
  }

  // Throttle and debounce conflict
  if (
    action.throttle &&
    action.debounce &&
    action.throttle > 0 &&
    action.debounce > 0
  ) {
    errors.push('throttle and debounce cannot both be active')
  }

  // MaxWait requires debounce
  if (action.maxWait !== undefined && action.debounce === undefined) {
    errors.push('maxWait requires debounce to be specified')
  }

  if (action.maxWait && action.debounce && action.maxWait <= action.debounce) {
    errors.push('maxWait must be greater than debounce')
  }

  // Path validation
  if (action.path) {
    if (!pathEngine.isValidPath(action.path)) {
      errors.push('path must be a valid hierarchical path')
    }
  }

  // Performance warnings
  if (action.throttle && action.throttle < 10) {
    warnings.push('very low throttle values may impact performance')
  }

  if (action.debounce && action.debounce < 25) {
    warnings.push('very low debounce values may not be effective')
  }

  // Schema and condition warnings
  if (action.schema && !action.required) {
    warnings.push(
      'schema validation without required may allow undefined payloads'
    )
  }

  return {errors, warnings}
}

export const CyreActions = (action: IO): RegistrationResult => {
  const startTime = performance.now()

  try {
    // 1. Validate ID requirements with detailed error reporting
    const idValidation = validateChannelId(action)
    if (!idValidation.valid) {
      sensor.error(
        action?.id || 'unknown',
        idValidation.error!,
        'action-validation-failed',
        {
          validationDetails: idValidation.details,
          actionStructure:
            typeof action === 'object' ? Object.keys(action) : 'not-object'
        }
      )

      log.error(
        `Action validation failed: ${idValidation.error}`,
        idValidation.details
      )

      return {
        ok: false,
        message: idValidation.error!,
        errors: [idValidation.error!]
      }
    }

    // 2. Check if channel exists
    const exists = io.get(action.id) !== undefined
    const now = Date.now()

    // If channel exists and has a path, remove it from path indexes first
    if (exists) {
      const existingAction = io.get(action.id)
      if (existingAction?.path) {
        try {
          pathEngine.remove(action.id)
          sensor.log(action.id, 'info', 'path-removed-for-update', {
            oldPath: existingAction.path
          })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          sensor.warning(
            action.id,
            `Failed to remove old path: ${errorMessage}`,
            {
              oldPath: existingAction.path,
              error: errorMessage
            }
          )
        }
      }
    }

    // 3. Add timestamps and defaults
    const actionWithDefaults = {
      ...action,
      timeOfCreation: now,
      timestamp: now,
      type: action.type || action.id
    }

    // 4. Cross-attribute validation with warnings
    const crossValidation = validateCrossAttributes(actionWithDefaults)
    if (crossValidation.errors.length > 0) {
      const detailedMessage = `Cross-validation failed: ${crossValidation.errors.join(
        ', '
      )}`

      sensor.error(
        action.id,
        detailedMessage, // Use detailed message in sensor too
        'cross-validation-errors',
        {
          errors: crossValidation.errors,
          warnings: crossValidation.warnings,
          actionConfig: Object.keys(actionWithDefaults)
        }
      )

      log.error(
        `Cross-validation failed for ${action.id}:`,
        crossValidation.errors
      )

      return {
        ok: false,
        message: detailedMessage,
        errors: crossValidation.errors,
        warnings: crossValidation.warnings
      }
    }

    // Log warnings if present
    if (crossValidation.warnings.length > 0) {
      sensor.warning(action.id, 'Configuration warnings detected', {
        warnings: crossValidation.warnings,
        actionId: action.id
      })

      crossValidation.warnings.forEach(warning => {
        log.warn(`${action.id}: ${warning}`)
      })
    }

    // 5. COMPILE ACTION WITH TALENT DISCOVERY AND ERROR REPORTING
    let compilation
    try {
      compilation = compileAction(actionWithDefaults)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      sensor.error(action.id, errorMessage, 'compilation-exception', {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        actionConfig: Object.keys(actionWithDefaults)
      })

      log.error(
        `Action compilation threw exception for ${action.id}: ${errorMessage}`
      )

      return {
        ok: false,
        message: `Compilation exception: ${errorMessage}`,
        errors: [errorMessage]
      }
    }

    if (compilation.errors.length > 0) {
      const detailedMessage = `Compilation failed: ${compilation.errors.join(
        ', '
      )}`

      sensor.error(action.id, detailedMessage, 'compilation-errors', {
        errors: compilation.errors,
        hasFastPath: compilation.hasFastPath,
        actionConfig: Object.keys(actionWithDefaults)
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
          errors: compilation.errors
        })

        return {
          ok: false,
          message: compilation.compiledAction._blockReason!,
          payload: compilation.compiledAction,
          errors: compilation.errors
        }
      }

      return {
        ok: false,
        message: `Compilation failed: ${compilation.errors.join(', ')}`,
        errors: compilation.errors
      }
    }

    const finalAction = compilation.compiledAction

    // 6. INDEX PATH IF PROVIDED
    if (finalAction.path && pathEngine.isValidPath(finalAction.path)) {
      try {
        pathEngine.add(finalAction.id, finalAction.path)

        sensor.log(finalAction.id, 'info', 'path-indexed-successfully', {
          path: finalAction.path,
          segments: pathEngine.parse(finalAction.path).length,
          indexed: true,
          isUpdate: exists
        })

        // Verify indexing worked
        const indexedPath = pathEngine.getPath(finalAction.id)
        if (indexedPath !== finalAction.path) {
          sensor.warning(finalAction.id, 'Path indexing mismatch detected', {
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
      }
    }

    // 7. Add to groups with error handling
    try {
      addChannelToGroups(finalAction.id)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      sensor.warning(
        finalAction.id,
        `Group assignment failed: ${errorMessage}`,
        {
          error: errorMessage
        }
      )

      log.warn(`Group assignment failed for ${finalAction.id}: ${errorMessage}`)
      // Continue with registration even if group assignment fails
    }

    // 8. Store compiled action
    try {
      io.set(finalAction)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      sensor.error(finalAction.id, errorMessage, 'action-storage-failed', {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      })

      log.error(`Failed to store action ${finalAction.id}: ${errorMessage}`)

      return {
        ok: false,
        message: `Action storage failed: ${errorMessage}`,
        errors: [errorMessage]
      }
    }

    // 9. Initialize payload state if provided
    if ('payload' in action && action.payload !== undefined) {
      try {
        payloadState.set(finalAction.id, action.payload, 'initial')
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        sensor.warning(
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
      }
    }

    // 10. Generate status message and metrics
    const channelGroups = getChannelGroups(finalAction.id)
    const actionMessage = exists ? 'Action updated' : 'Action registered'
    const registrationTime = performance.now() - startTime

    let statusMsg: string
    if (finalAction._hasFastPath) {
      statusMsg = 'Fast path (no talents)'
    } else {
      const features: string[] = []
      if (finalAction._hasProtections) features.push('protections')
      if (finalAction._hasProcessing) {
        const talentCount = finalAction._processingTalents?.length || 0
        features.push(`${talentCount} processing talents`)
      }
      if (finalAction._hasScheduling) features.push('scheduling')
      statusMsg = features.join(', ')
    }

    // Add path info to status if available
    if (finalAction.path) {
      statusMsg += ` (path: ${finalAction.path})`
    }

    log.debug(`${actionMessage} ${finalAction.id}: ${statusMsg}`)

    sensor.log(finalAction.id, 'success', 'action-registration-complete', {
      isUpdate: exists,
      attributeCount: Object.keys(action).length,
      hasFastPath: finalAction._hasFastPath,
      hasProtections: finalAction._hasProtections,
      hasProcessing: finalAction._hasProcessing,
      hasScheduling: finalAction._hasScheduling,
      processingTalents: finalAction._processingTalents,
      isBlocked: finalAction._isBlocked,
      groupCount: channelGroups.length,
      groupIds: channelGroups.map(g => g.id),
      path: finalAction.path,
      pathIndexed: !!finalAction.path,
      compilationSuccess: true,
      registrationTime,
      warnings: crossValidation.warnings
    })

    return {
      ok: true,
      message: `${actionMessage}: ${statusMsg}`,
      payload: finalAction,
      warnings: crossValidation.warnings
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
      errors: [errorMessage]
    }
  }
}
