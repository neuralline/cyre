// src/components/cyre-actions.ts
// Action registration using consolidated schema validation

import type {IO, ActionPayload} from '../types/interface'
import {io, middlewares} from '../context/state'
import {metricsState} from '../context/metrics-state'
import CyreChannel from './cyre-channels'
import {sensor} from '../context/metrics-report'
import {log} from './cyre-log'
import {addChannelToGroups, getChannelGroups} from './cyre-group'
import {validate} from '../schema/cyre-schema'
import type {Schema} from '../schema/cyre-schema'

/*

      C.Y.R.E - A.C.T.I.O.N.S
      
      Action registration with unified schema validation:
      - Single validation pipeline using schema system
      - Replaces all manual validation logic
      - Performance optimized with caching
      - Consistent error messages

*/

export interface ProtectionContext {
  action: IO
  payload: ActionPayload
  originalPayload: ActionPayload
  metrics: any
  timestamp: number
}

export type ProtectionFn = (
  ctx: ProtectionContext
) =>
  | {pass: true; payload?: ActionPayload}
  | {pass: false; reason: string; delayed?: boolean; duration?: number}
  | Promise<{pass: true; payload?: ActionPayload}>
  | Promise<{pass: false; reason: string; delayed?: boolean; duration?: number}>

/**
 * Validate action structure using basic checks
 */
export const validateActionStructure = (
  action: IO
): {valid: boolean; errors?: string[]; data?: IO} => {
  const errors: string[] = []

  // Basic validation
  if (!action.id || typeof action.id !== 'string') {
    errors.push('Action ID must be a non-empty string')
  }

  if (
    action.throttle !== undefined &&
    (typeof action.throttle !== 'number' || action.throttle < 0)
  ) {
    errors.push('Throttle must be a non-negative number')
  }

  if (
    action.debounce !== undefined &&
    (typeof action.debounce !== 'number' || action.debounce < 0)
  ) {
    errors.push('Debounce must be a non-negative number')
  }

  if (
    action.repeat !== undefined &&
    typeof action.repeat !== 'number' &&
    typeof action.repeat !== 'boolean'
  ) {
    errors.push('Repeat must be a number or boolean')
  }

  return errors.length > 0
    ? {valid: false, errors}
    : {valid: true, data: action}
}


const determineBlockedState = (action: IO): {isBlocked: boolean; reason?: string} => {
  // Static conditions that permanently block the channel
  if (action.repeat === 0) {
    return {isBlocked: true, reason: 'Action configured with repeat: 0'}
  }
  
  if (action.block === true) {
    return {isBlocked: true, reason: 'Service not available'}
  }
  
  // Add other static blocking conditions
  if (action.required && action.payload === undefined) {
    return {isBlocked: true, reason: 'Required payload not provided'}
  }
  
  return {isBlocked: false}
}
/**
 * Validate function attributes
 */
export const validateFunctionAttributes = (action: IO): string[] => {
  const errors: string[] = []

  if (action.condition && typeof action.condition !== 'function') {
    errors.push('Condition must be a function')
  }

  if (action.selector && typeof action.selector !== 'function') {
    errors.push('Selector must be a function')
  }

  if (action.transform && typeof action.transform !== 'function') {
    errors.push('Transform must be a function')
  }

  return errors
}

/**
 * Get all middleware for this action (group + individual)
 */
const getAllMiddleware = (
  actionId: string
): {id: string; fn: any; source: 'group' | 'individual'}[] => {
  const allMiddleware: {id: string; fn: any; source: 'group' | 'individual'}[] =
    []

  // 1. Get group middleware first (executes before individual middleware)
  const channelGroups = getChannelGroups(actionId)
  channelGroups.forEach(group => {
    group.middlewareIds.forEach(middlewareId => {
      const middleware = middlewares.get(middlewareId)
      if (middleware) {
        allMiddleware.push({
          id: middlewareId,
          fn: middleware.fn,
          source: 'group'
        })
      }
    })
  })

  // 2. Get individual action middleware (executes after group middleware)
  const action = io.get(actionId)
  if (action?.middleware) {
    action.middleware.forEach(middlewareId => {
      const middleware = middlewares.get(middlewareId)
      if (middleware) {
        allMiddleware.push({
          id: middlewareId,
          fn: middleware.fn,
          source: 'individual'
        })
      }
    })
  }

  return allMiddleware
}

/**
 * Create middleware protection function
 */
const createMiddlewareProtection = (
  middlewareList: {id: string; fn: any; source: 'group' | 'individual'}[]
): ProtectionFn => {
  if (middlewareList.length === 0) {
    // Return pass-through protection if no middleware
    return () => ({pass: true})
  }

  return async (ctx: ProtectionContext) => {
    let currentPayload = ctx.payload

    for (let i = 0; i < middlewareList.length; i++) {
      const middleware = middlewareList[i]

      try {
        sensor.log(ctx.action.id, 'info', 'middleware-start', {
          middlewareId: middleware.id,
          source: middleware.source,
          index: i
        })

        // Create next function for this middleware
        const next = (nextPayload?: ActionPayload) => {
          return Promise.resolve({
            ok: true,
            payload: nextPayload !== undefined ? nextPayload : currentPayload,
            message: 'Middleware processing complete'
          })
        }

        // Execute middleware
        const result = await middleware.fn(currentPayload, next)

        if (!result || !result.ok) {
          const message = result?.message || 'Middleware blocked execution'
          sensor.log(ctx.action.id, 'blocked', 'middleware-block', {
            middlewareId: middleware.id,
            source: middleware.source,
            reason: message
          })
          return {
            pass: false,
            reason: `${middleware.source} middleware ${middleware.id} blocked: ${message}`
          }
        }

        // Update payload for next middleware
        if (result.payload !== null && result.payload !== undefined) {
          currentPayload = result.payload
        }

        sensor.log(ctx.action.id, 'info', 'middleware-success', {
          middlewareId: middleware.id,
          source: middleware.source,
          payloadTransformed: result.payload !== ctx.payload
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        sensor.log(ctx.action.id, 'error', 'middleware-error', {
          middlewareId: middleware.id,
          source: middleware.source,
          error: errorMsg
        })
        return {
          pass: false,
          reason: `${middleware.source} middleware ${middleware.id} error: ${errorMsg}`
        }
      }
    }

    // All middleware passed
    return {
      pass: true,
      payload: currentPayload
    }
  }
}

/**
 * Unified protection pipeline compilation using schema validation
 */
const compileProtectionPipeline = (action: IO): ProtectionFn[] => {
  const pipeline: ProtectionFn[] = []

  // 1. Zero repeat block (fastest check)
  if (action.repeat === 0) {
    pipeline.push(() => {
      sensor.log(action.id, 'blocked', 'zero-repeat-block', {
        repeatValue: 0
      })
      return {pass: false, reason: 'Action configured with repeat: 0'}
    })
  }

  // 2. Block check
  if (action.block === true) {
    pipeline.push(() => {
      sensor.log(action.id, 'blocked', 'service-unavailable', {
        blockStatus: true
      })
      return {pass: false, reason: 'Service not available'}
    })
  }

  // 3. System recuperation check
  const hasProtections = !!(
    action.throttle ||
    action.debounce ||
    action.detectChanges ||
    action.schema ||
    action.condition ||
    action.selector
  )
  if (hasProtections && action.priority?.level !== 'critical') {
    pipeline.push(() => {
      const state = metricsState.get()
      if (state.breathing.isRecuperating) {
        sensor.log(action.id, 'blocked', 'system-recuperation', {
          stressLevel: state.stress.combined
        })
        return {
          pass: false,
          reason: 'System in recuperation - only critical actions allowed'
        }
      }
      return {pass: true}
    })
  }

  // 4. Schema validation - FIXED INTEGRATION
  if (action.schema) {
    pipeline.push(ctx => {
      try {
        const validationResult = validate(action.schema!, ctx.payload)

        if (!validationResult.ok) {
          sensor.log(ctx.action.id, 'blocked', 'schema-validation', {
            validationErrors: validationResult.errors,
            schemaValidation: false
          })
          return {
            pass: false,
            reason: `Schema validation failed: ${validationResult.errors.join(
              ', '
            )}`
          }
        }

        sensor.log(ctx.action.id, 'info', 'schema-validation', {
          schemaValidation: true
        })

        // Return the validated/transformed data
        return {pass: true, payload: validationResult.data}
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        sensor.log(ctx.action.id, 'error', 'schema-validation', {
          error: errorMsg
        })
        return {
          pass: false,
          reason: `Schema validation error: ${errorMsg}`
        }
      }
    })
  }

  // 5. ALL MIDDLEWARE (group + individual) - unified execution
  const allMiddleware = getAllMiddleware(action.id)
  if (allMiddleware.length > 0) {
    pipeline.push(createMiddlewareProtection(allMiddleware))
  }

  // 6. Selector
  if (action.selector) {
    pipeline.push(ctx => {
      try {
        const selectedData = action.selector!(ctx.payload)
        sensor.log(ctx.action.id, 'info', 'payload-selection', {
          selectorApplied: true
        })
        return {pass: true, payload: selectedData}
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        sensor.log(ctx.action.id, 'error', 'payload-selection', {
          error: errorMsg
        })
        return {pass: false, reason: `Selector failed: ${errorMsg}`}
      }
    })
  }

  // 7. Condition check
  if (action.condition) {
    pipeline.push(ctx => {
      try {
        const conditionMet = action.condition!(ctx.payload)
        if (!conditionMet) {
          sensor.log(ctx.action.id, 'skip', 'condition-check', {
            conditionMet: false
          })
          return {pass: false, reason: 'Condition not met - execution skipped'}
        }
        sensor.log(ctx.action.id, 'info', 'condition-check', {
          conditionMet: true
        })
        return {pass: true}
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        sensor.log(ctx.action.id, 'error', 'condition-check', {
          error: errorMsg
        })
        return {pass: false, reason: `Condition check failed: ${errorMsg}`}
      }
    })
  }

  // 8. Change detection
  if (action.detectChanges) {
    pipeline.push(ctx => {
      const hasChanged = io.hasChanged(ctx.action.id, ctx.payload)
      if (!hasChanged) {
        sensor.log(ctx.action.id, 'skip', 'change-detection', {
          payloadUnchanged: true
        })
        return {pass: false, reason: 'Payload unchanged - execution skipped'}
      }
      return {pass: true}
    })
  }

  // 9. Throttle
  if (action.throttle && action.throttle > 0) {
    pipeline.push(ctx => {
      const lastExec = ctx.metrics?.lastExecutionTime || 0
      if (lastExec === 0) return {pass: true}

      const elapsed = ctx.timestamp - lastExec
      if (elapsed < action.throttle!) {
        const remaining = action.throttle! - elapsed
        sensor.throttle(ctx.action.id, remaining, 'throttle-protection')
        return {pass: false, reason: `Throttled - ${remaining}ms remaining`}
      }
      return {pass: true}
    })
  }

  // 10. Debounce
  if (action.debounce && action.debounce > 0) {
    pipeline.push(() => {
      sensor.log(action.id, 'info', 'debounce-delay', {
        debounceMs: action.debounce
      })
      return {
        pass: false,
        reason: `Debounced - will execute in ${action.debounce}ms`,
        delayed: true,
        duration: action.debounce
      }
    })
  }

  // 11. Transform
  if (action.transform) {
    pipeline.push(ctx => {
      try {
        const transformedPayload = action.transform!(ctx.payload)
        sensor.log(ctx.action.id, 'info', 'payload-transform', {
          transformApplied: true
        })
        return {pass: true, payload: transformedPayload}
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        sensor.log(ctx.action.id, 'error', 'payload-transform', {
          error: errorMsg
        })
        return {pass: false, reason: `Transform failed: ${errorMsg}`}
      }
    })
  }

  return pipeline
}

/**
 * Unified action registration using schema validation
 */
export const registerSingleAction = (
  attribute: IO
): {ok: boolean; message: string; payload?: any} => {
  try {
    // 1. Create channel (handles ID, existence, defaults)
    const channelResult = CyreChannel(attribute)
    if (!channelResult.ok || !channelResult.payload) {
      sensor.error(
        attribute.id || 'unknown',
        channelResult.message || '',
        'channel-creation'
      )
      return {ok: false, message: channelResult.message}
    }

    const channel = channelResult.payload

    // 2. FIRST add to groups to ensure middleware is available for compilation
    addChannelToGroups(channel.id)

    // 3. Validate action structure
    const structureValidation = validateActionStructure(channel)
    if (!structureValidation.valid) {
      const errorMessage = `Action structure invalid: ${
        structureValidation.errors
          ? structureValidation.errors.join(', ')
          : 'Unknown errors'
      }`
      sensor.error(channel.id, errorMessage, 'action-structure-validation')
      return {ok: false, message: errorMessage}
    }

    // Use validated data from schema
    const validatedChannel = structureValidation.data!

    // 4. Additional function validation
    const functionErrors = validateFunctionAttributes(validatedChannel)
    if (functionErrors.length > 0) {
      const errorMessage = `Function validation failed: ${functionErrors.join(
        ', '
      )}`
      sensor.error(
        validatedChannel.id,
        errorMessage,
        'action-function-validation'
      )
      return {ok: false, message: errorMessage}
    }

    // 5. Compile unified protection pipeline (NOW includes group middleware)
    const pipeLine = compileProtectionPipeline(validatedChannel)

    // 6. Create final action with compiled pipeline
    const finalAction: IO = {
      ...channel,
      _isBlocked: pipeLine.isBlocked,
      _blockReason: pipeLine.blockReason,
      _hasFastPath: pipeLine.hasFastPath,
      _protectionPipeline: pipeLine.pipeline
    }

    // 7. Store final action
    io.set(finalAction)

    // Get integration info for logging
    const channelGroups = getChannelGroups(finalAction.id)
    const allMiddleware = getAllMiddleware(finalAction.id)
    const groupMiddleware = allMiddleware.filter(m => m.source === 'group')
    const individualMiddleware = allMiddleware.filter(
      m => m.source === 'individual'
    )

    const groupInfo =
      channelGroups.length > 0
        ? `in ${channelGroups.length} group(s): [${channelGroups
            .map(g => g.id)
            .join(', ')}]`
        : 'in no groups'

    const middlewareInfo =
      allMiddleware.length > 0
        ? `with ${groupMiddleware.length} group + ${individualMiddleware.length} individual middleware`
        : 'with no middleware'

    const protectionInfo = `${pipeLine.length} total protections`

    log.debug(
      `Registered actions ${finalAction.id} with ${protectionInfo} ${middlewareInfo} ${groupInfo}`
    )

    sensor.log(finalAction.id, 'info', 'action-registration', {
      protectionCount: pipeLine.length,
      groupCount: channelGroups.length,
      groupIds: channelGroups.map(g => g.id),
      groupMiddlewareCount: groupMiddleware.length,
      individualMiddlewareCount: individualMiddleware.length,
      totalMiddlewareCount: allMiddleware.length,
      hasThrottle: !!(finalAction.throttle && finalAction.throttle > 0),
      hasDebounce: !!(finalAction.debounce && finalAction.debounce > 0),
      hasChangeDetection: !!finalAction.detectChanges,
      hasSchema: !!finalAction.schema,
      hasCondition: !!finalAction.condition,
      hasSelector: !!finalAction.selector,
      hasTransform: !!finalAction.transform,
      priority: finalAction.priority?.level || 'medium'
    })

    return {
      ok: true,
      message: `Action registered with ${protectionInfo} ${middlewareInfo} ${groupInfo}`,
      payload: finalAction
    }
  } catch (error) {
    console.log(error)
    const msg = error instanceof Error ? error.message : String(error)
    log.error(`Failed to register action ${attribute.id}: ${msg}`)
    sensor.error(attribute.id || 'unknown', msg, 'action-registration')
    return {ok: false, message: msg}
  }
}

// Export pipeline compilation for testing
export {compileProtectionPipeline}
