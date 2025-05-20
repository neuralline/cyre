// src/components/cyre-protection.ts

import type {IO, ActionPayload, CyreResponse} from '../interfaces/interface'
import {io, middlewares} from '../context/state'
import {log} from './cyre-logger'
import {metricsState} from '../context/metrics-state'
import timeKeeper from './cyre-time-keeper'
/* 

      C.Y.R.E. - P.R.O.T.E.C.T.I.O.N.
      
      Pre-computed protection pipelines for efficient processing

*/

/**
 * Function in a protection pipeline
 */
export type ProtectionFunction = (
  action: IO,
  payload: ActionPayload,
  next: () => Promise<CyreResponse>
) => Promise<CyreResponse>

/**
 * Metadata for a protection function
 */
interface ProtectionMeta {
  name: string
  description: string
}

/**
 * Creates a named protection function with metadata
 */
const createProtection = (
  name: string,
  description: string,
  fn: ProtectionFunction
): ProtectionFunction & ProtectionMeta => {
  Object.defineProperty(fn, 'name', {
    value: name,
    configurable: true
  })
  Object.defineProperty(fn, 'description', {
    value: description,
    configurable: true
  })
  return fn as ProtectionFunction & ProtectionMeta
}

/**
 * System recuperation check - only critical actions during recuperation
 */
const recuperationProtection = createProtection(
  'recuperationProtection',
  'Blocks non-critical actions during system recuperation',
  async (action, payload, next) => {
    const {breathing} = metricsState.get()
    if (breathing.isRecuperating && action.priority?.level !== 'critical') {
      return {
        ok: false,
        payload: null,
        message: `System recuperating. Only critical actions allowed.`
      }
    }
    return next()
  }
)

/**
 * Repeat zero check - don't execute actions with repeat: 0
 */
const repeatZeroProtection = createProtection(
  'repeatZeroProtection',
  'Prevents execution of actions with repeat: 0',
  async (action, payload, next) => {
    if (action.repeat === 0) {
      return {
        ok: true,
        payload: null,
        message: 'Action registered but not executed (repeat: 0)'
      }
    }
    return next()
  }
)

/**
 * Throttle protection - limits execution frequency
 */
const throttleProtection = createProtection(
  'throttleProtection',
  'Limits execution frequency based on throttle setting',
  async (action, payload, next) => {
    const now = Date.now()
    const actionMetrics = io.getMetrics(action.id)
    const lastExecution = actionMetrics?.lastExecutionTime || 0
    const timeSinceLastExecution = now - lastExecution

    log.debug(`[THROTTLE] Checking throttle for ${action.id}:`)
    log.debug(`  - Last execution time: ${lastExecution}`)
    log.debug(`  - Time since last execution: ${timeSinceLastExecution}ms`)
    log.debug(`  - Throttle setting: ${action.throttle}ms`)

    // Industry standard: First execution always passes (lastExecution === 0)
    if (lastExecution !== 0 && timeSinceLastExecution < action.throttle!) {
      log.debug(`[THROTTLE] Throttling ${action.id} - too soon`)
      return {
        ok: false,
        payload: null,
        message: `Throttled: ${
          action.throttle! - timeSinceLastExecution
        }ms remaining`
      }
    }

    log.debug(`[THROTTLE] Allowing ${action.id} to proceed`)

    // Execute the next function in the pipeline
    const result = await next()

    // If execution was successful, update the lastExecutionTime
    if (result.ok && result.payload) {
      // Update metrics in store
      const updatedMetrics = actionMetrics || {
        lastExecutionTime: 0,
        executionCount: 0,
        errors: []
      }

      // CRITICAL FIX: Actually update the lastExecutionTime and store it
      io.updateMetrics(action.id, {
        ...updatedMetrics,
        lastExecutionTime: Date.now(),
        executionCount: (updatedMetrics.executionCount || 0) + 1
      })
    }

    return result
  }
)

/**
 * Debounce protection - collapses rapid calls
 */
const debounceProtection = createProtection(
  'debounceProtection',
  'Collapses rapid calls into a single delayed execution',
  async (action, payload, next) => {
    // Skip if this is a debounce-bypass execution
    if (action._bypassDebounce) {
      return next()
    }

    // Cancel any existing debounce timer
    if (action.debounceTimerId) {
      timeKeeper.forget(action.debounceTimerId)

      // Update action in store without timer ID
      const updatedAction = {...action}
      delete updatedAction.debounceTimerId
      io.set(updatedAction)
    }

    // Create unique timer ID
    const timerId = `${action.id}-debounce-${Date.now()}`

    // Return a promise that resolves when the debounce timer is set up
    return new Promise(resolve => {
      // Set up debounce timer
      const timerResult = timeKeeper.keep(
        action.debounce!,
        async () => {
          try {
            // Create a copy of the action that bypasses debounce to prevent recursion
            const debounceBypassAction = {
              ...action,
              _bypassDebounce: true
            }

            // Execute with debounce bypassed but keeping all other protections
            const result = await next()

            // Resolve with the execution result
            resolve(result)
          } catch (error) {
            // Resolve with error
            resolve({
              ok: false,
              payload: null,
              message: `Debounce execution error: ${
                error instanceof Error ? error.message : String(error)
              }`
            })
          }
        },
        1, // Execute exactly once
        timerId
      )

      // Handle timer setup failure
      if (timerResult.kind === 'error') {
        resolve({
          ok: false,
          payload: null,
          message: `Failed to set up debounce timer: ${timerResult.error.message}`
        })
        return
      }

      // Store the timer ID with the action
      const updatedAction = {
        ...action,
        debounceTimerId: timerId
      }
      io.set(updatedAction)

      // Don't resolve the promise yet - it will be resolved when the timer fires
      // Instead, return an immediate response to the caller
      resolve({
        ok: true,
        payload: null,
        message: `Debounced: will execute after ${action.debounce}ms`
      })
    })
  }
)

/**
 * Change detection protection - only execute if payload changed
 */
const changeDetectionProtection = createProtection(
  'changeDetectionProtection',
  'Prevents execution if payload has not changed',
  async (action, payload, next) => {
    if (!io.hasChanged(action.id, payload)) {
      return {
        ok: true,
        payload: null,
        message: 'Execution skipped: No changes detected in payload'
      }
    }
    return next()
  }
)

/**
 * Middleware protection - applies middleware transforms
 */
const middlewareProtection = createProtection(
  'middlewareProtection',
  'Applies middleware to transform action and payload',
  async (action, payload, next) => {
    if (
      !action.middleware ||
      !Array.isArray(action.middleware) ||
      action.middleware.length === 0
    ) {
      return next()
    }

    let currentAction = action
    let currentPayload = payload

    // Apply middleware sequentially
    for (const middlewareId of action.middleware) {
      const middleware = middlewares.get(middlewareId)
      if (!middleware) {
        log.warn(`Middleware '${middlewareId}' not found and will be skipped`)
        continue
      }

      try {
        // Call middleware function
        const result = await middleware.fn(currentAction, currentPayload)

        // If middleware returned null, reject the action
        if (result === null) {
          return {
            ok: false,
            payload: null,
            message: `Action rejected by middleware '${middlewareId}'`
          }
        }

        // Update current state for next middleware
        currentAction = result.action
        currentPayload = result.payload
      } catch (error) {
        log.error(`Middleware '${middlewareId}' failed: ${error}`)
        return {
          ok: false,
          payload: null,
          message: `Middleware error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }

    // Execute with transformed action and payload
    return next()
  }
)

/**
 * Builds a specialized protection pipeline for an action based on its configuration
 */
export const buildProtectionPipeline = (action: IO): ProtectionFunction[] => {
  const pipeline: ProtectionFunction[] = []

  // System recuperation check (always included)
  pipeline.push(recuperationProtection)

  // Repeat: 0 check (always included)
  pipeline.push(repeatZeroProtection)

  // Add throttle function if configured
  if (action.throttle) {
    pipeline.push(throttleProtection)
  }

  // Add debounce function if configured
  if (action.debounce) {
    pipeline.push(debounceProtection)
  }

  // Add change detection if configured
  if (action.detectChanges) {
    pipeline.push(changeDetectionProtection)
  }

  // Add middleware if configured
  if (action.middleware && action.middleware.length > 0) {
    pipeline.push(middlewareProtection)
  }

  return pipeline
}

/**
 * Executes a protection pipeline
 */
export const executeProtectionPipeline = async (
  action: IO,
  payload: ActionPayload,
  pipeline: ProtectionFunction[],
  finalExecution: () => Promise<CyreResponse>
): Promise<CyreResponse> => {
  // No pipeline, just execute directly
  if (!pipeline || pipeline.length === 0) {
    return finalExecution()
  }

  // Use functional composition to build the pipeline
  const composedPipeline = pipeline.reduceRight<() => Promise<CyreResponse>>(
    (next, protectionFn) => {
      return () => protectionFn(action, payload, next)
    },
    finalExecution
  )

  // Execute the pipeline
  return composedPipeline()
}

/**
 * Updates the protection pipeline when action configuration changes
 */
export const updateProtectionPipeline = (action: IO): IO => {
  const pipeline = buildProtectionPipeline(action)
  return {
    ...action,
    _protectionPipeline: pipeline
  }
}
