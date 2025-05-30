// src/components/cyre-actions.ts
// Action system with proper selector error handling and condition validation

import type {IO, ActionPayload} from '../types/interface'
import {io} from '../context/state'
import {metricsState} from '../context/metrics-state'
import CyreChannel from './cyre-channels'
import dataDefinitions from '../elements/data-definitions'
import {sensor} from '../context/metrics-report'
import {log} from './cyre-log'
import {validate} from '../schema/cyre-schema'

/*

      C.Y.R.E - A.C.T.I.O.N.S
      
      Action pipeline with proper selector/condition error handling:
      - condition: when to execute
      - selector: what part of payload to watch
      - transform: how to modify payload before execution
      - Compiled at registration for performance

*/

export interface ProtectionContext {
  action: IO
  payload: ActionPayload
  originalPayload: ActionPayload // Keep original for reference
  metrics: any
  timestamp: number
}

export type ProtectionFn = (
  ctx: ProtectionContext
) =>
  | {pass: true; payload?: ActionPayload}
  | {pass: false; reason: string; delayed?: boolean; duration?: number}

/**
 * Register single action with state capabilities
 */
export const registerSingleAction = (
  attribute: IO
): {ok: boolean; message: string; payload?: any} => {
  try {
    // Validate and create channel
    const channelResult = CyreChannel(attribute, dataDefinitions)
    if (!channelResult.ok || !channelResult.payload) {
      sensor.error(
        attribute.id || 'unknown',
        channelResult.message || '',
        'action-validation'
      )
      return {ok: false, message: channelResult.message}
    }

    const validatedAction = channelResult.payload

    // Compile protection pipeline with state features
    const protections = compileProtectionPipeline(validatedAction)

    const protectionInfo =
      protections.length > 0
        ? `with ${protections.length} protections`
        : 'with no protections'

    log.debug(`Action ${validatedAction.id} registered ${protectionInfo}`)

    sensor.log(validatedAction.id, 'info', 'action-registration', {
      protectionCount: protections.length,
      hasThrottle: !!(validatedAction.throttle && validatedAction.throttle > 0),
      hasDebounce: !!(validatedAction.debounce && validatedAction.debounce > 0),
      hasChangeDetection: !!validatedAction.detectChanges,
      hasSchema: !!validatedAction.schema,
      hasCondition: !!validatedAction.condition,
      hasSelector: !!validatedAction.selector,
      hasTransform: !!validatedAction.transform,
      priority: validatedAction.priority?.level || 'medium'
    })

    return {
      ok: true,
      message: `Action registered ${protectionInfo}`,
      payload: validatedAction
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error(`Failed to register action ${attribute.id}: ${msg}`)
    sensor.error(attribute.id || 'unknown', msg, 'action-registration')
    return {ok: false, message: msg}
  }
}

/**
 * Compile protection pipeline with proper error handling
 */
export function compileProtectionPipeline(action: IO): ProtectionFn[] {
  const pipeline: ProtectionFn[] = []

  // Zero repeat block
  if (action.repeat === 0) {
    io.set({...action, block: true})
    pipeline.push(ctx => {
      sensor.log(ctx.action.id, 'blocked', 'zero-repeat-block', {
        repeatValue: 0,
        blockReason: 'repeat: 0 configuration'
      })
      return {
        pass: false,
        reason: 'Action configured with repeat: 0'
      }
    })
  }

  // Block check
  if (action.block === true) {
    pipeline.push(ctx => {
      sensor.log(ctx.action.id, 'blocked', 'service-unavailable', {
        blockStatus: true,
        blockReason: 'service marked as unavailable'
      })
      return {
        pass: false,
        reason: 'Service not available'
      }
    })
  }

  // System recuperation
  const hasProtections = !!(
    action.throttle ||
    action.debounce ||
    action.detectChanges ||
    action.schema ||
    action.condition ||
    action.selector
  )
  if (hasProtections && action.priority?.level !== 'critical') {
    pipeline.push(ctx => {
      const state = metricsState.get()
      if (state.breathing.isRecuperating) {
        sensor.log(ctx.action.id, 'blocked', 'system-recuperation', {
          stressLevel: state.stress.combined,
          breathingRate: state.breathing.currentRate,
          isRecuperating: true
        })
        return {
          pass: false,
          reason: 'System in recuperation - only critical actions allowed'
        }
      }
      return {pass: true}
    })
  }

  // Schema validation (if exists)
  if (action.schema) {
    pipeline.push(ctx => {
      const validationResult = validate(action.schema!, ctx.payload)

      if (!validationResult.ok) {
        sensor.log(ctx.action.id, 'blocked', 'schema-validation', {
          validationErrors: validationResult.errors,
          payloadType: typeof ctx.payload,
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
        schemaValidation: true,
        payloadType: typeof ctx.payload
      })

      return {
        pass: true,
        payload: validationResult.data
      }
    })
  }

  // Selector (extract specific data to watch) - handle errors properly
  if (action.selector) {
    pipeline.push(ctx => {
      try {
        const selectedData = action.selector!(ctx.payload)

        sensor.log(ctx.action.id, 'info', 'payload-selection', {
          selectorApplied: true,
          originalType: typeof ctx.payload,
          selectedType: typeof selectedData,
          selectedValue: selectedData
        })

        return {
          pass: true,
          payload: selectedData
        }
      } catch (error) {
        sensor.log(ctx.action.id, 'error', 'payload-selection', {
          selectorError: true,
          error: error instanceof Error ? error.message : String(error)
        })
        return {
          pass: false,
          reason: `Selector failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    })
  }

  // Condition check (after selection) - handle undefined/null values properly
  if (action.condition) {
    pipeline.push(ctx => {
      try {
        // Check if payload is undefined/null before condition check
        if (ctx.payload === undefined || ctx.payload === null) {
          sensor.log(ctx.action.id, 'skip', 'condition-check', {
            conditionMet: false,
            skipReason: 'payload is null or undefined'
          })
          return {
            pass: false,
            reason: 'Condition not met - payload is null or undefined'
          }
        }

        const conditionMet = action.condition!(ctx.payload)

        if (!conditionMet) {
          sensor.log(ctx.action.id, 'skip', 'condition-check', {
            conditionMet: false,
            skipReason: 'condition not satisfied'
          })
          return {
            pass: false,
            reason: 'Condition not met - execution skipped'
          }
        }

        sensor.log(ctx.action.id, 'info', 'condition-check', {
          conditionMet: true
        })

        return {pass: true}
      } catch (error) {
        sensor.log(ctx.action.id, 'error', 'condition-check', {
          conditionError: true,
          error: error instanceof Error ? error.message : String(error)
        })
        return {
          pass: false,
          reason: `Condition check failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    })
  }

  // Change detection (uses processed payload from selector/transform)
  if (action.detectChanges) {
    pipeline.push(ctx => {
      const hasChanged = io.hasChanged(ctx.action.id, ctx.payload)
      if (!hasChanged) {
        sensor.log(ctx.action.id, 'skip', 'change-detection', {
          payloadUnchanged: true,
          skipReason: 'identical payload detected'
        })

        return {
          pass: false,
          reason: 'Payload unchanged - execution skipped'
        }
      }
      return {pass: true}
    })
  }

  // Throttle
  if (action.throttle && action.throttle > 0) {
    pipeline.push(ctx => {
      const lastExec = ctx.metrics?.lastExecutionTime || 0
      if (lastExec === 0) return {pass: true}

      const elapsed = ctx.timestamp - lastExec
      if (elapsed < action.throttle!) {
        const remaining = action.throttle! - elapsed
        sensor.throttle(ctx.action.id, remaining, 'throttle-protection')
        return {
          pass: false,
          reason: `Throttled - ${action.throttle! - elapsed}ms remaining`
        }
      }
      return {pass: true}
    })
  }

  // Debounce
  if (action.debounce && action.debounce > 0) {
    pipeline.push(ctx => {
      sensor.log(ctx.action.id, 'info', 'debounce-delay', {
        debounceMs: action.debounce,
        willDelay: true
      })

      return {
        pass: false,
        reason: `Debounced - will execute in ${action.debounce}ms`,
        delayed: true,
        duration: action.debounce
      }
    })
  }

  // Transform (final step before execution)
  if (action.transform) {
    pipeline.push(ctx => {
      try {
        const transformedPayload = action.transform!(ctx.payload)

        sensor.log(ctx.action.id, 'info', 'payload-transform', {
          transformApplied: true,
          originalType: typeof ctx.payload,
          transformedType: typeof transformedPayload
        })

        return {
          pass: true,
          payload: transformedPayload
        }
      } catch (error) {
        sensor.log(ctx.action.id, 'error', 'payload-transform', {
          transformError: true,
          error: error instanceof Error ? error.message : String(error)
        })
        return {
          pass: false,
          reason: `Transform failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    })
  }

  // Store compiled pipeline on action
  io.set({...action, _protectionPipeline: pipeline})

  return pipeline
}
