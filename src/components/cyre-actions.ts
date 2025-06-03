// src/components/cyre-actions.ts
// Action registration with talent compilation and optimization

import {sensor} from '../context/metrics-report'
import type {IO} from '../types/core'
import {addChannelToGroups, getChannelGroups} from './cyre-group'
import payloadState from '../context/payload-state'
import {log} from './cyre-log'
import {io} from '../context/state'
import {compileAction} from '../schema/data-definitions'

/*

      C.Y.R.E - A.C.T.I.O.N.S


      pre-compute and compile action talents to minimise run time overhead and save it as easy to follow pipeline step by step instructions
      Manages talents for the channel, specialized abilities that the channel possesses to control channel behavior!
      
      Talent Categories:
        Protection Talents:
            throttle, debounce, block, fastPath, retry
        Processing Talents:
            schema, transform, condition, middleware
        Flow Talents:
            detectChanges, priority, required
        Scheduling Talents:
            interval, delay, repeat



      C.Y.R.E - A.C.T.I.O.N.S

      Action registration with talent compilation:
      1. Validate basic structure
      2. Compile action with talent discovery
      3. Set optimization flags
      4. Store compiled action

*/

interface RegistrationResult {
  ok: boolean
  message: string
  payload?: IO
  errors?: string[]
}

/**
 * Validate channel ID and basic structure
 */
const validateChannelId = (action: any): {valid: boolean; error?: string} => {
  if (action === null || action === undefined) {
    return {valid: false, error: 'Action cannot be null or undefined'}
  }

  if (typeof action !== 'object') {
    return {valid: false, error: 'Action must be an object'}
  }

  if (!action.id || typeof action.id !== 'string') {
    return {valid: false, error: 'Action ID must be a non-empty string'}
  }

  if (action.id.trim().length === 0) {
    return {valid: false, error: 'Action ID cannot be empty'}
  }

  return {valid: true}
}

/**
 * Cross-attribute validation
 */
const validateCrossAttributes = (action: Partial<IO>): string[] => {
  const errors: string[] = []

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

  return errors
}

export const CyreActions = (action: IO): RegistrationResult => {
  try {
    // 1. Validate ID requirements
    const idValidation = validateChannelId(action)
    if (!idValidation.valid) {
      sensor.error(
        action?.id || 'unknown',
        idValidation.error!,
        'action-validation'
      )
      return {ok: false, message: idValidation.error!}
    }

    // 2. Check if channel exists
    const exists = io.get(action.id) !== undefined
    const now = Date.now()

    // 3. Add timestamps and defaults
    const actionWithDefaults = {
      ...action,
      timeOfCreation: now,
      timestamp: now,
      type: action.type || action.id
    }

    // 4. Cross-attribute validation
    const crossValidationErrors = validateCrossAttributes(actionWithDefaults)
    if (crossValidationErrors.length > 0) {
      return {
        ok: false,
        message: `Cross-validation failed: ${crossValidationErrors.join(', ')}`,
        errors: crossValidationErrors
      }
    }

    // 5. COMPILE ACTION WITH TALENT DISCOVERY
    const compilation = compileAction(actionWithDefaults)

    if (compilation.errors.length > 0) {
      // Handle blocking conditions
      if (compilation.compiledAction._isBlocked) {
        io.set(compilation.compiledAction)
        return {
          ok: false,
          message: compilation.compiledAction._blockReason!,
          payload: compilation.compiledAction
        }
      }

      return {
        ok: false,
        message: `Compilation failed: ${compilation.errors.join(', ')}`,
        errors: compilation.errors
      }
    }

    const finalAction = compilation.compiledAction

    // 6. Add to groups
    addChannelToGroups(finalAction.id)

    // 7. Store compiled action
    io.set(finalAction)

    // 8. Initialize payload state if provided
    if ('payload' in action && action.payload !== undefined) {
      try {
        payloadState.set(finalAction.id, action.payload, 'initial')
      } catch (error) {
        log.warn(
          `Payload initialization failed for ${finalAction.id}: ${error}`
        )
      }
    }

    // 9. Generate status message based on compilation results
    const channelGroups = getChannelGroups(finalAction.id)
    const actionMessage = exists ? 'Action updated' : 'Action registered'

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

    log.debug(`${actionMessage} ${finalAction.id}: ${statusMsg}`)

    sensor.log(finalAction.id, 'info', 'action-registration', {
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
      compilationSuccess: true
    })

    return {
      ok: true,
      message: `${actionMessage}: ${statusMsg}`,
      payload: finalAction
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(
      `Action processing failed for ${action?.id || 'unknown'}: ${errorMessage}`
    )
    sensor.error(action?.id || 'unknown', errorMessage, 'action-processing')
    return {ok: false, message: errorMessage}
  }
}
