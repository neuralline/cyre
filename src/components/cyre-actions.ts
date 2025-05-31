// src/components/cyre-actions.ts
// Updated action registration with group middleware compilation
import type {IO, ActionPayload} from '../types/interface'
import {io, middlewares} from '../context/state'
import {metricsState} from '../context/metrics-state'
import CyreChannel from './cyre-channels'
import {sensor} from '../context/metrics-report'
import {log} from './cyre-log'
import {getChannelGroups} from './cyre-group'
import {
  validate,
  object,
  string,
  number,
  boolean,
  any
} from '../schema/cyre-schema'

/*

      C.Y.R.E - U.N.I.F.I.E.D - P.I.P.E.L.I.N.E
      
      Single pipeline that handles both individual and group protections:
      - Group middleware integrated as standard middleware
      - Natural execution order: group → individual → protections
      - Single protection compilation and execution
      - Clean separation of concerns

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

// Action schema for structure validation (unchanged)
const actionSchema = object({
  id: string(),
  type: string().optional(),
  payload: any().optional(),
  condition: any().optional(),
  selector: any().optional(),
  transform: any().optional(),
  interval: number().optional(),
  delay: number().optional(),
  repeat: any().optional(),
  timeOfCreation: number().optional(),
  detectChanges: boolean().optional(),
  debounce: number().optional(),
  throttle: number().optional(),
  schema: any().optional(),
  block: boolean().optional(),
  required: any().optional(),
  priority: any().optional(),
  middleware: any().optional(),
  _protectionPipeline: any().optional(),
  _debounceTimer: string().optional()
})

/**
 * Validate action structure using schema
 */
export const validateActionStructure = (
  action: IO
): {valid: boolean; errors?: string[]} => {
  const result = validate(actionSchema, action)
  return {
    valid: result.ok,
    errors: result.ok ? undefined : result.errors
  }
}

/**
 * Validate function attributes that schema can't handle
 */
export const validateFunctionAttributes = (action: IO): string[] => {
  const errors: string[] = []

  if (
    action.condition !== undefined &&
    typeof action.condition !== 'function'
  ) {
    errors.push('condition must be a function')
  }
  if (action.selector !== undefined && typeof action.selector !== 'function') {
    errors.push('selector must be a function')
  }
  if (
    action.transform !== undefined &&
    typeof action.transform !== 'function'
  ) {
    errors.push('transform must be a function')
  }
  if (action.schema !== undefined && typeof action.schema !== 'function') {
    errors.push('schema must be a schema function')
  }

  return errors
}

/**
 * Validate timing and protection attributes
 */
const validateActionAttributes = (action: IO): string[] => {
  const errors: string[] = []

  if (action.repeat !== undefined) {
    const isValid =
      typeof action.repeat === 'number' ||
      typeof action.repeat === 'boolean' ||
      action.repeat === Infinity
    if (!isValid) {
      errors.push('repeat must be number, boolean, or Infinity')
    }
  }

  if (
    action.debounce !== undefined &&
    (typeof action.debounce !== 'number' || action.debounce < 0)
  ) {
    errors.push('debounce must be a non-negative number')
  }
  if (
    action.throttle !== undefined &&
    (typeof action.throttle !== 'number' || action.throttle < 0)
  ) {
    errors.push('throttle must be a non-negative number')
  }
  if (
    action.interval !== undefined &&
    (typeof action.interval !== 'number' || action.interval < 0)
  ) {
    errors.push('interval must be a non-negative number')
  }
  if (
    action.delay !== undefined &&
    (typeof action.delay !== 'number' || action.delay < 0)
  ) {
    errors.push('delay must be a non-negative number')
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
 * Unified protection pipeline compilation
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

  // 4. Schema validation
  if (action.schema) {
    pipeline.push(ctx => {
      const validationResult = validate(action.schema!, ctx.payload)
      if (!validationResult.ok) {
        const errors = Array.isArray(validationResult.errors)
          ? validationResult.errors
          : [String(validationResult.errors)]

        sensor.log(ctx.action.id, 'blocked', 'schema-validation', {
          validationErrors: errors,
          schemaValidation: false
        })
        return {
          pass: false,
          reason: `Schema validation failed: ${errors.join(', ')}`
        }
      }
      sensor.log(ctx.action.id, 'info', 'schema-validation', {
        schemaValidation: true
      })
      return {pass: true, payload: validationResult.data}
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
 * Unified action registration
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

    // 2. Validate action structure
    const structureValidation = validateActionStructure(channel)
    if (!structureValidation.valid) {
      const errors = Array.isArray(structureValidation.errors)
        ? structureValidation.errors
        : [String(structureValidation.errors)]

      const errorMessage = `Action structure invalid: ${errors.join(', ')}`
      sensor.error(channel.id, errorMessage, 'action-structure-validation')
      return {ok: false, message: errorMessage}
    }

    // 3. Validate function attributes
    const functionErrors = validateFunctionAttributes(channel)
    if (functionErrors.length > 0) {
      const errorMessage = `Function validation failed: ${functionErrors.join(
        ', '
      )}`
      sensor.error(channel.id, errorMessage, 'action-function-validation')
      return {ok: false, message: errorMessage}
    }

    // 4. Validate other attributes
    const attributeErrors = validateActionAttributes(channel)
    if (attributeErrors.length > 0) {
      const errorMessage = `Attribute validation failed: ${attributeErrors.join(
        ', '
      )}`
      sensor.error(channel.id, errorMessage, 'action-attribute-validation')
      return {ok: false, message: errorMessage}
    }

    // 5. Compile unified protection pipeline (includes group + individual middleware)
    const protectionPipeline = compileProtectionPipeline(channel)

    // 6. Create final action with compiled pipeline
    const finalAction: IO = {
      ...channel,
      _protectionPipeline: protectionPipeline
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

    const protectionInfo = `${protectionPipeline.length} total protections`

    log.debug(
      `Action ${finalAction.id} registered with ${protectionInfo} ${middlewareInfo} ${groupInfo}`
    )

    sensor.log(finalAction.id, 'info', 'action-registration', {
      protectionCount: protectionPipeline.length,
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
    const msg = error instanceof Error ? error.message : String(error)
    log.error(`Failed to register action ${attribute.id}: ${msg}`)
    sensor.error(attribute.id || 'unknown', msg, 'action-registration')
    return {ok: false, message: msg}
  }
}

// Export pipeline compilation for testing
export {compileProtectionPipeline}
