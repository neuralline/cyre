// src/components/cyre-actions.ts
// FIXED: Chain reaction processing with proper history recording

import {io, subscribers, middlewares} from '../context/state'
import {IO, ActionPayload, CyreResponse} from '../types/interface'
import {log} from './cyre-log'
import {pipe} from '../libs/utils'
import {MSG} from '../config/cyre-config'
import {metricsReport, PerformanceTimer} from '../context/metrics-report'
import {metricsState} from '../context/metrics-state'
import timeKeeper from './cyre-timekeeper'
import {historyState} from '../context/history-state'

/*

      C.Y.R.E. - A.C.T.I.O.N.S.
      
      Complete action processing pipeline with enhanced timing measurement
      Proper separation of Action Pipeline overhead vs Listener execution time
      FIXED: Chain reaction (intraLink) processing with proper history recording
      
*/

// Enhanced type definitions
type ActionStatus = 'pending' | 'active' | 'completed' | 'error' | 'skipped'

interface ActionResult extends IO {
  ok: boolean
  done: boolean
  status?: ActionStatus
  error?: string
  skipped?: boolean
  skipReason?: string
  intraLink?: {
    id: string
    payload?: ActionPayload
  }
}

/**
 * Enhanced Protection function type with timing context
 */
export type ActionPipelineFunction = (
  action: IO,
  payload: ActionPayload,
  timer: PerformanceTimer,
  next: () => Promise<CyreResponse>
) => Promise<CyreResponse>

/**
 * System recuperation check - only critical actions during recuperation
 */
const recuperationProtection: ActionPipelineFunction = async (
  action,
  payload,
  timer,
  next
) => {
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

/**
 * Repeat zero check - don't execute actions with repeat: 0
 */
const repeatZeroProtection: ActionPipelineFunction = async (
  action,
  payload,
  timer,
  next
) => {
  if (action.repeat === 0) {
    return {
      ok: true,
      payload: null,
      message: 'Action registered but not executed (repeat: 0)'
    }
  }
  return next()
}

/**
 * Throttle protection - limits execution frequency
 */
const throttleProtection: ActionPipelineFunction = async (
  action,
  payload,
  timer,
  next
) => {
  timer.markStage('throttle')

  const now = Date.now()
  const actionMetrics = io.getMetrics(action.id)
  const lastExecution = actionMetrics?.lastExecutionTime || 0
  const timeSinceLastExecution = now - lastExecution

  // Industry standard: First execution always passes (lastExecution === 0)
  if (lastExecution !== 0 && timeSinceLastExecution < action.throttle!) {
    metricsReport.trackThrottle(action.id)

    return {
      ok: false,
      payload: null,
      message: `Throttled: ${
        action.throttle! - timeSinceLastExecution
      }ms remaining`
    }
  }

  // Execute the next function in the pipeline
  const result = await next()

  // If execution was successful, ensure we update the lastExecutionTime
  if (result.ok) {
    io.updateMetrics(action.id, {
      lastExecutionTime: Date.now(),
      executionCount: (actionMetrics?.executionCount || 0) + 1
    })
  }

  return result
}

/**
 * Debounce protection - collapses rapid calls
 */
const debounceProtection: ActionPipelineFunction = async (
  action,
  payload,
  timer,
  next
) => {
  timer.markStage('debounce')

  // Skip if this is a debounce-bypass execution
  if (action._bypassDebounce) {
    return next()
  }

  metricsReport.trackDebounce(action.id)

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
          // Create new timer for the debounced execution
          const debouncedTimer = metricsReport.createTimer()
          debouncedTimer.start()

          // Execute with debounce bypassed but keeping all other protections
          const result = await next()

          // Record the debounced execution timing
          const timing = debouncedTimer.createDetailedTiming()
          metricsReport.trackDetailedExecution(action.id, timing)

          resolve(result)
        } catch (error) {
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

    // Return immediate response to the caller
    resolve({
      ok: true,
      payload: null,
      message: `Debounced: will execute after ${action.debounce}ms`
    })
  })
}

/**
 * Change detection protection - only execute if payload changed
 */
const changeDetectionProtection: ActionPipelineFunction = async (
  action,
  payload,
  timer,
  next
) => {
  timer.markStage('changeDetection')

  if (!io.hasChanged(action.id, payload)) {
    metricsReport.trackChangeDetectionSkip(action.id)
    return {
      ok: true,
      payload: null,
      message: 'Execution skipped: No changes detected in payload'
    }
  }
  return next()
}

/**
 * Middleware protection - applies middleware to transform action and payload
 */
const middlewareProtection: ActionPipelineFunction = async (
  action,
  payload,
  timer,
  next
) => {
  timer.markStage('middleware')

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
      // Call middleware function with proper Promise handling
      const result = await Promise.resolve(
        middleware.fn(currentAction, currentPayload)
      )

      // If middleware returned null, reject the action
      if (result === null) {
        metricsReport.trackMiddlewareRejection(action.id)
        return {
          ok: false,
          payload: null,
          message: `Action rejected by middleware '${middlewareId}'`
        }
      }

      // Update current state for next middleware
      currentAction = result.action
      currentPayload = result.payload

      log.debug(
        `Middleware '${middlewareId}' successfully processed action ${action.id}`
      )
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

/**
 * Builds an action pipeline for an action based on its configuration
 */
export const buildActionPipeline = (action: IO): ActionPipelineFunction[] => {
  const pipeline: ActionPipelineFunction[] = []

  // System recuperation check (always included)
  pipeline.push(recuperationProtection)

  // Repeat: 0 check (always included)
  pipeline.push(repeatZeroProtection)

  // Add pipeline functions based on action configuration
  if (action.throttle) {
    pipeline.push(throttleProtection)
  }

  if (action.debounce) {
    pipeline.push(debounceProtection)
  }

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
 * Executes an action pipeline with enhanced timing measurement
 */
export const executeActionPipeline = async (
  action: IO,
  payload: ActionPayload,
  pipeline: ActionPipelineFunction[],
  timer: PerformanceTimer,
  finalExecution: () => Promise<CyreResponse>
): Promise<CyreResponse> => {
  // No pipeline, just execute directly
  if (!pipeline || pipeline.length === 0) {
    timer.markStage('dispatch')
    return finalExecution()
  }

  // Use functional composition to build the pipeline with timing
  const composedPipeline = pipeline.reduceRight<() => Promise<CyreResponse>>(
    (next, pipelineStep) => {
      return () => pipelineStep(action, payload, timer, next)
    },
    () => {
      timer.markStage('dispatch')
      return finalExecution()
    }
  )

  // Execute the pipeline
  return composedPipeline()
}

// Action pipeline functions with improved error handling and timing
const prepareAction = (action: IO): ActionResult => {
  try {
    if (!action) {
      throw new Error(MSG.ACTION_PREPARE_FAILED)
    }

    return {
      ...action,
      ok: true,
      done: false,
      status: 'pending',
      timestamp: Date.now()
    }
  } catch (error) {
    return {
      id: '',
      type: '',
      ok: false,
      done: false,
      status: 'error',
      error: MSG.ACTION_PREPARE_FAILED
    }
  }
}

const validateAction = (action: ActionResult): ActionResult => {
  if (!action.type || !action.id) {
    return {
      ...action,
      ok: false,
      done: false,
      status: 'error',
      error: 'Missing required fields: type or id'
    }
  }

  return {
    ...action,
    ok: true,
    status: 'active'
  }
}

const executeAction = (
  action: ActionResult,
  timer: PerformanceTimer
): ActionResult => {
  if (action.skipped || action.status === 'error') {
    return action
  }

  try {
    const subscriber = subscribers.get(action.id)
    if (!subscriber) {
      throw new Error(`No subscriber found for: ${action.id}`)
    }

    // Mark the start of listener execution
    timer.markStage('listener')
    const listenerStartTime = performance.now()

    const result = subscriber.fn(action.payload)

    // Calculate listener execution time
    const listenerExecutionTime = performance.now() - listenerStartTime

    // FIXED: Update both legacy and enhanced metrics systems
    const currentTime = Date.now()
    const currentMetrics = io.getMetrics(action.id)

    // Update legacy metrics
    io.updateMetrics(action.id, {
      lastExecutionTime: currentTime,
      executionCount: (currentMetrics?.executionCount || 0) + 1
    })

    // Track execution with actual timing
    io.trackExecution(action.id, listenerExecutionTime)

    log.debug(
      `Action ${action.id} executed in ${listenerExecutionTime.toFixed(2)}ms`
    )

    // FIXED: Handle linked actions (chain reactions/intraLinks)
    if (result && typeof result === 'object' && 'id' in result && result.id) {
      log.debug(`Chain reaction detected: ${action.id} -> ${result.id}`)

      return {
        ...action,
        ok: true,
        done: true,
        status: 'completed',
        intraLink: {
          id: result.id,
          payload: result.payload
        }
      }
    }

    return {
      ...action,
      ok: true,
      done: true,
      status: 'completed'
    }
  } catch (error) {
    log.error(
      `CYRE ACTION ERROR: ${MSG.ACTION_EXECUTE_FAILED} -id ${action.id} ${
        error instanceof Error ? error.message : String(error)
      }`
    )

    // Track error in metrics
    const currentMetrics = io.getMetrics(action.id)
    if (currentMetrics) {
      const errorEntry = {
        timestamp: Date.now(),
        message: error instanceof Error ? error.message : String(error)
      }
      io.updateMetrics(action.id, {
        ...currentMetrics,
        errors: [...currentMetrics.errors, errorEntry]
      })
    }

    return {
      ...action,
      ok: false,
      done: false,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const logAction = (action: ActionResult): ActionResult => {
  if (action.log) {
    if (action.status === 'error') {
      log.error(action)
    } else if (action.status === 'skipped') {
      log.info(action)
    } else {
      log.info(action)
    }
  }
  return action
}

const updateStore = (action: ActionResult): ActionResult => {
  if (action.ok && !action.skipped) {
    io.set({
      ...action,
      timestamp: Date.now()
    })
  }
  return action
}

/**
 * FIXED: Process intraLinks (chain reactions) with proper history recording
 */
const processIntraLinks = (action: ActionResult): ActionResult => {
  if (!action.intraLink || !action.intraLink.id) {
    return action
  }

  try {
    log.debug(
      `Processing chain reaction: ${action.id} -> ${action.intraLink.id}`
    )

    // Get the linked action configuration
    const linkedAction = io.get(action.intraLink.id)
    if (!linkedAction) {
      log.warn(
        `Chain reaction failed: action '${action.intraLink.id}' not found`
      )
      return action
    }

    // Check if we have a subscriber for the linked action
    const subscriber = subscribers.get(action.intraLink.id)
    if (!subscriber) {
      log.warn(
        `Chain reaction failed: no subscriber for '${action.intraLink.id}'`
      )
      return action
    }

    // FIXED: Execute the linked action with proper timing and history recording
    try {
      const chainPayload = action.intraLink.payload || linkedAction.payload

      // Create timer for chain execution
      const chainTimer = metricsReport.createTimer()
      chainTimer.start()

      // Mark listener execution stage
      chainTimer.markStage('listener')
      const listenerStartTime = performance.now()

      // Execute the chain handler
      const chainResult = subscriber.fn(chainPayload)

      // Calculate timing
      const listenerExecutionTime = performance.now() - listenerStartTime

      // Mark metrics stage
      chainTimer.markStage('metrics')

      // Create detailed timing for chain execution
      const timing = chainTimer.createDetailedTiming()
      metricsReport.trackDetailedExecution(action.intraLink.id, timing)

      log.debug(
        `Chain reaction executed: ${action.id} -> ${action.intraLink.id}`
      )

      // FIXED: Update metrics for the chained action
      const currentTime = Date.now()
      const chainMetrics = io.getMetrics(action.intraLink.id)

      io.updateMetrics(action.intraLink.id, {
        lastExecutionTime: currentTime,
        executionCount: (chainMetrics?.executionCount || 0) + 1
      })

      // FIXED: Record history for the chained action
      historyState.record(
        action.intraLink.id,
        chainPayload,
        {
          ok: true,
          message: `Chain execution from ${action.id}`,
          error: undefined
        },
        chainTimer.getTotalTime()
      )

      // If the chained action also returns an intraLink, process it recursively
      if (
        chainResult &&
        typeof chainResult === 'object' &&
        'id' in chainResult &&
        chainResult.id
      ) {
        const nestedChainAction: ActionResult = {
          ...linkedAction,
          ok: true,
          done: true,
          status: 'completed',
          intraLink: {
            id: chainResult.id,
            payload: chainResult.payload
          }
        }

        // Recursively process nested chains
        processIntraLinks(nestedChainAction)
      }
    } catch (error) {
      log.error(`Chain reaction execution failed: ${error}`)

      // FIXED: Record history for failed chain execution
      historyState.record(
        action.intraLink.id,
        action.intraLink.payload || linkedAction.payload,
        {
          ok: false,
          message: `Chain execution failed from ${action.id}`,
          error: error instanceof Error ? error.message : String(error)
        }
      )
    }

    return {
      ...action,
      intraLink: undefined // Clear the processed intraLink
    }
  } catch (error) {
    log.error(`Chain reaction failed: ${error}`)
    return action
  }
}

/**
 * Enhanced CyreAction function with detailed timing measurement and chain processing
 * Properly separates action pipeline overhead from listener execution
 * FIXED: Added proper intraLink processing for chain reactions with history recording
 */
export const CyreAction = (initialIO: IO, fn: Function): ActionResult => {
  // Handle null/undefined input before pipe
  if (!initialIO) {
    log.error(MSG.ACTION_PREPARE_FAILED)
    return {
      id: 'CYRE-ERROR',
      type: '',
      ok: false,
      done: false,
      status: 'error',
      error: MSG.ACTION_PREPARE_FAILED
    }
  }

  // Create timer for this execution
  const timer = metricsReport.createTimer()
  timer.start()

  try {
    const result = pipe(
      prepareAction(initialIO),
      validateAction,
      (action: ActionResult) =>
        action.status === 'error' ? action : executeAction(action, timer),
      (action: ActionResult) =>
        action.status === 'error' ? action : logAction(action),
      (action: ActionResult) =>
        action.status === 'error' ? action : updateStore(action),
      // FIXED: Process chain reactions as part of the main pipeline with proper history
      (action: ActionResult) =>
        action.status === 'error' || !action.intraLink
          ? action
          : processIntraLinks(action)
    )

    // Mark metrics recording stage
    timer.markStage('metrics')

    // Record detailed execution timing
    const timing = timer.createDetailedTiming()
    metricsReport.trackDetailedExecution(initialIO.id, timing)

    return result
  } catch (error) {
    log.error(`Action processing failed: ${error}`)
    return {
      ...initialIO,
      id: 'CYRE-ERROR',
      ok: false,
      done: false,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Enhanced dispatch function with detailed timing
 */
export const enhancedDispatch = async (
  io: IO,
  timer: PerformanceTimer
): Promise<CyreResponse> => {
  if (!io?.id) {
    throw new Error('Invalid IO object')
  }

  // Find subscriber
  const subscriber = subscribers.get(io.id)
  if (!subscriber) {
    const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${io.id}`
    historyState.record(io.id, io.payload, {ok: false, message: error})
    return {ok: false, payload: null, message: error}
  }

  // Execute action through pipeline with timing
  const dispatch = CyreAction({...io}, subscriber.fn)

  // Record history
  historyState.record(
    io.id,
    io.payload,
    {ok: dispatch.ok, message: dispatch.message, error: dispatch.error},
    timer.getTotalTime()
  )

  // Log if enabled
  if (io.log) {
    log.info({
      ...dispatch,
      executionTime: timer.getTotalTime(),
      timestamp: Date.now()
    })
  }

  return {
    ok: dispatch.ok,
    payload: dispatch,
    message: dispatch.message || MSG.WELCOME
  }
}

// Legacy exports for backwards compatibility
export const buildProtectionPipeline = buildActionPipeline
export const executeProtectionPipeline = executeActionPipeline

export default CyreAction
