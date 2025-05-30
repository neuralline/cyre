// src/components/cyre-actions.ts
// Action system with schema validation integration

import type {IO, ActionPayload, CyreResponse} from '../types/interface'
import {io} from '../context/state'
import {metricsState} from '../context/metrics-state'
import CyreChannel from './cyre-channels'
import dataDefinitions from '../elements/data-definitions'
import {metricsReport, sensor} from '../context/metrics-report'
import {log} from './cyre-log'
import {validate, type Schema} from '../schema/cyre-schema'

/*

      C.Y.R.E - A.C.T.I.O.N.S
      
      Pipeline-based action system with schema validation:
      - Fast path for no protections (pipeline.length === 0)
      - Schema validation in protection pipeline
      - Fast block for blocked channels (repeat:0, block:true)
      - Debounce continues pipeline after delay
      - Extensible protection pipeline
      - Compiled at registration for performance

*/

export interface ProtectionContext {
  action: IO
  payload: ActionPayload
  metrics: any
  timestamp: number
}

export type ProtectionFn = (
  ctx: ProtectionContext
) =>
  | {pass: true; payload?: ActionPayload}
  | {pass: false; reason: string; delayed?: boolean; duration?: number}

/**
 * Register single action with schema validation support
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

    // Get built-in protection info for logging
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
 * Compile protection pipeline at action registration
 * Includes schema validation in the pipeline
 */
export function compileProtectionPipeline(action: IO): ProtectionFn[] {
  const pipeline: ProtectionFn[] = []

  // Zero repeat block
  if (action.repeat === 0) {
    io.set({...action, block: true})
    pipeline.push(ctx => {
      metricsReport.sensor.log(ctx.action.id, 'blocked', 'zero-repeat-block', {
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
      metricsReport.sensor.log(
        ctx.action.id,
        'blocked',
        'service-unavailable',
        {
          blockStatus: true,
          blockReason: 'service marked as unavailable'
        }
      )
      return {
        pass: false,
        reason: 'Service not available'
      }
    })
  }

  // System recuperation - only add if action has protections or is not critical
  const hasProtections = !!(
    action.throttle ||
    action.debounce ||
    action.detectChanges ||
    action.schema
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

  // Schema validation - run early in pipeline
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
        payload: validationResult.data // Use validated/transformed data
      }
    })
  }

  // Throttle - only if configured
  if (action.throttle && action.throttle > 0) {
    pipeline.push(ctx => {
      const lastExec = ctx.metrics?.lastExecutionTime || 0
      if (lastExec === 0) return {pass: true} // First execution always passes

      const elapsed = ctx.timestamp - lastExec
      if (elapsed < action.throttle!) {
        const remaining = action.throttle! - elapsed
        metricsReport.sensor.throttle(
          ctx.action.id,
          remaining,
          'throttle-protection'
        )
        return {
          pass: false,
          reason: `Throttled - ${action.throttle! - elapsed}ms remaining`
        }
      }
      return {pass: true}
    })
  }

  // Debounce - simplified without creating timers here
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

  // Change detection - only if enabled
  if (action.detectChanges) {
    pipeline.push(ctx => {
      const hasChanged = io.hasChanged(ctx.action.id, ctx.payload)
      if (!hasChanged) {
        metricsReport.sensor.log(ctx.action.id, 'skip', 'change-detection', {
          payloadUnchanged: true,
          skipReason: 'identical payload detected'
        })

        return {
          pass: false,
          reason: 'Payload unchanged - execution skipped'
        }
      }
      return {pass: true, payload: ctx.payload}
    })
  }

  // Store compiled pipeline on action
  io.set({...action, _protectionPipeline: pipeline})

  return pipeline
}
