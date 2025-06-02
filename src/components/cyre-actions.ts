// src/components/cyre-actions.ts
// v8 : increase this every time you update actions

import {sensor} from '../context/metrics-report'
import type {IO, ProtectionFn} from '../types/core'
import {dataDefinitions} from '../schema/data-definitions'
import {addChannelToGroups, getChannelGroups} from './cyre-group'
import payloadState from '../context/payload-state'
import {log} from './cyre-log'
import {io} from '../context/state'

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
 * Cross-attribute validation (timing relationships, etc.)
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
      return {
        ok: false,
        message: idValidation.error!
      }
    }

    // 2. Check if channel exists
    const exists = io.get(action.id) !== undefined
    const now = Date.now()

    // 3. Set defaults
    const channel = {
      timeOfCreation: now,
      timestamp: now,
      ...action,
      type: action.type || action.id
    } as IO

    // 4. Single-pass validation and pipeline compilation
    const validatedAction: Partial<IO> = {}
    const errors: string[] = []
    const pipeline: ProtectionFn[] = []
    let requiresPayloadCheck = false
    let hasChangeDetection = false

    // Create a Map of validators for faster lookups
    const definition = new Map(Object.entries(dataDefinitions))

    // Only process properties that have validators
    for (const [key, value] of Object.entries(channel)) {
      const validator = definition.get(key)

      if (validator) {
        const result = validator(value, pipeline)

        if (!result.ok) {
          // Early termination for blocking conditions
          if (result.blocking) {
            return {
              ok: false,
              message: result.error!,
              payload: {
                ...channel,
                _isBlocked: true,
                _blockReason: result.error!,
                _hasFastPath: false,
                _protectionPipeline: []
              } as IO
            }
          }
          errors.push(`${key}: ${result.error}`)
        } else {
          validatedAction[key] = result.data

          if (result.requiresPayloadCheck) {
            requiresPayloadCheck = true
          }

          if (key === 'detectChanges' && result.data === true) {
            hasChangeDetection = true
          }
        }
      } else {
        validatedAction[key] = value
      }
    }

    // Early exit if validation failed
    if (errors.length > 0) {
      return {
        ok: false,
        message: `Validation failed: ${errors.join(', ')}`,
        errors
      }
    }

    // Required payload check
    if (requiresPayloadCheck && validatedAction.required) {
      if (
        validatedAction.required === true &&
        validatedAction.payload === undefined
      ) {
        return {
          ok: false,
          message: 'Required payload not provided',
          payload: {
            ...validatedAction,
            _isBlocked: true,
            _blockReason: 'Required payload not provided',
            _hasFastPath: false,
            _protectionPipeline: []
          } as IO
        }
      }

      if (validatedAction.required === 'non-empty') {
        const payload = validatedAction.payload
        if (
          payload === undefined ||
          payload === null ||
          payload === '' ||
          (Array.isArray(payload) && payload.length === 0) ||
          (typeof payload === 'object' && Object.keys(payload).length === 0)
        ) {
          return {
            ok: false,
            message: 'Non-empty payload required',
            payload: {
              ...validatedAction,
              _isBlocked: true,
              _blockReason: 'Non-empty payload required',
              _hasFastPath: false,
              _protectionPipeline: []
            } as IO
          }
        }
      }
    }

    // Cross-attribute validation
    const crossValidationErrors = validateCrossAttributes(validatedAction)
    if (crossValidationErrors.length > 0) {
      return {
        ok: false,
        message: `Cross-validation failed: ${crossValidationErrors.join(', ')}`,
        errors: crossValidationErrors
      }
    }

    // FIXED: Determine fast path correctly
    // Fast path only if NO pipeline protections AND NO change detection
    const hasFastPath = pipeline.length === 0 && !hasChangeDetection

    // Pre-determine scheduling status
    const isScheduled = !!(
      validatedAction.interval ||
      validatedAction.delay !== undefined ||
      (validatedAction.repeat !== undefined && validatedAction.repeat !== 1)
    )

    // Pre-compute payload requirements
    const requiresPayload =
      validatedAction.required === true ||
      validatedAction.required === 'non-empty' ||
      validatedAction.detectChanges === true

    // Pre-compute protection types for faster runtime lookups
    const protectionTypes = pipeline.map(fn => {
      const funcStr = fn.toString()
      if (funcStr.includes('Throttled')) return 'throttle'
      if (funcStr.includes('Debounced')) return 'debounce'
      if (funcStr.includes('Schema')) return 'schema'
      if (funcStr.includes('Condition')) return 'condition'
      if (funcStr.includes('Selector')) return 'selector'
      if (funcStr.includes('Transform')) return 'transform'
      return 'unknown'
    })

    // Reorder pipeline to put block, throttle, debounce at the top
    if (pipeline.length > 0) {
      const criticalProtections = pipeline.filter(fn => {
        const funcStr = fn.toString()
        return funcStr.includes('Throttled') || funcStr.includes('Debounced')
      })

      const otherProtections = pipeline.filter(fn => {
        const funcStr = fn.toString()
        return !funcStr.includes('Throttled') && !funcStr.includes('Debounced')
      })

      pipeline.length = 0 // Clear pipeline
      pipeline.push(...criticalProtections, ...otherProtections) // Reorder
    }

    const finalAction: IO = {
      ...validatedAction,
      _isBlocked: false,
      _hasFastPath: hasFastPath,
      _protectionPipeline: pipeline,
      _isScheduled: isScheduled,
      _scheduleConfig: isScheduled
        ? {
            interval: validatedAction.interval,
            delay: validatedAction.delay,
            repeat: validatedAction.repeat
          }
        : undefined,
      _requiresPayload: requiresPayload,
      _hasChangeDetection: validatedAction.detectChanges === true,
      _protectionTypes: protectionTypes, // Store pre-computed protection types
      _executionConfig: {
        hasFastPath,
        isScheduled,
        requiresPayload,
        hasChangeDetection: validatedAction.detectChanges === true,
        protectionCount: pipeline.length
      }
    } as IO

    // Add to groups
    addChannelToGroups(finalAction.id)

    // Store compiled action
    io.set(finalAction)

    // Initialize payload state if provided
    if ('payload' in channel && channel.payload !== undefined) {
      try {
        payloadState.set(finalAction.id, channel.payload, 'initial')
      } catch (error) {
        log.warn(
          `Payload initialization failed for ${finalAction.id}: ${error}`
        )
      }
    }

    // Logging and metrics
    const channelGroups = getChannelGroups(finalAction.id)
    const protectionCount = pipeline.length
    const isBlocked = finalAction._isBlocked

    const statusMsg = isBlocked
      ? `BLOCKED: ${finalAction._blockReason}`
      : hasFastPath
      ? 'FAST PATH (no protections)'
      : `${protectionCount} protections compiled`

    const actionMessage = exists ? 'Action updated' : 'Action registered'

    log.debug(`${actionMessage} ${finalAction.id}: ${statusMsg}`)

    sensor.log(finalAction.id, 'info', 'action-registration', {
      isUpdate: exists,
      attributeCount: Object.keys(channel).length,
      pipelineLength: protectionCount,
      hasFastPath,
      hasChangeDetection, // Include change detection info
      isBlocked: false,
      groupCount: channelGroups.length,
      groupIds: channelGroups.map(g => g.id)
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
