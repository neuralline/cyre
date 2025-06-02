// src/components/cyre-call.ts
// ACTUAL FIX: Use the compiled _protectionPipeline directly at runtime

import {ActionPayload, CyreResponse, IO} from '../types/core'
import {useDispatch} from './cyre-dispatch'
import {sensor} from '../context/metrics-report'
import {TimeKeeper} from './cyre-timekeeper'
import {io} from '../context/state'
import payloadState from '../context/payload-state'
import {log} from './cyre-log'
import {call} from '../app'

/*

      C.Y.R.E - C.A.L.L
      
      THE REAL PROBLEM: Runtime wasn't using compiled _protectionPipeline
      
      SOLUTION: Execute the compiled pipeline functions directly
      No re-extraction, no duplicate systems, just use what was compiled!

*/

export async function processCall(
  action: IO,
  payload: ActionPayload | undefined
): Promise<CyreResponse> {
  sensor.log(action.id, 'call', 'call-initiation', {
    timestamp: Date.now(),
    hasPayload: payload !== undefined
  })

  // STEP 1: Pre-computed blocking check (immediate exit)
  if (action._isBlocked) {
    sensor.log(action.id, 'blocked', 'pre-computed-block', {
      reason: action._blockReason
    })
    return {
      ok: false,
      payload: undefined,
      message: action._blockReason || 'Action blocked'
    }
  }

  const originalPayload = payload ?? action.payload
  let currentPayload = originalPayload

  // STEP 2: Fast path - direct execution (no protections)
  if (action._hasFastPath) {
    sensor.log(action.id, 'info', 'fast-path-execution')

    // Update payload state for change detection
    if (action._hasChangeDetection) {
      payloadState.set(action.id, originalPayload, 'call')
    }

    return useDispatch(action, currentPayload)
  }

  // STEP 3: Change detection (handled separately - not in pipeline)
  if (action._hasChangeDetection) {
    const hasChanged = payloadState.hasChanged(action.id, currentPayload)
    if (!hasChanged) {
      sensor.log(action.id, 'skip', 'change-detection-skip')
      return {
        ok: false,
        payload: undefined,
        message: 'Payload unchanged - execution skipped'
      }
    }
  }

  // STEP 4: Use compiled pipeline directly!
  const compiledPipeline = action._protectionPipeline || []

  if (compiledPipeline.length === 0) {
    // No protections compiled - direct execution
    return useDispatch(action, currentPayload)
  }

  // Create context for pipeline execution
  const context = {
    action,
    payload: currentPayload,
    originalPayload,
    metrics: io.getMetrics(action.id),
    timestamp: Date.now()
  }

  // EXECUTE THE COMPILED PIPELINE FUNCTIONS DIRECTLY
  for (let i = 0; i < compiledPipeline.length; i++) {
    const protectionFn = compiledPipeline[i]
    const protectionType = action._protectionTypes[i] // Use pre-computed type

    try {
      // Call the compiled protection function
      const result = await Promise.resolve(protectionFn(context))

      if (!result.pass) {
        // Handle delayed execution (debounce)
        if (result.delayed && result.duration) {
          return handleDebounceExecution(
            action,
            currentPayload,
            result.duration
          )
        }

        // Handle blocking
        sensor.log(action.id, protectionType, 'pipeline-protection-block', {
          reason: result.reason,
          protectionIndex: i,
          protectionType
        })

        return {
          ok: false,
          payload: undefined,
          message: result.reason || 'Protection failed'
        }
      }

      // Update payload if protection transformed it
      if (result.payload !== undefined) {
        currentPayload = result.payload
        context.payload = currentPayload
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      sensor.error(action.id, errorMessage, `pipeline-protection-${i}`)

      return {
        ok: false,
        payload: undefined,
        message: `Pipeline protection error: ${errorMessage}`
      }
    }
  }

  // STEP 5: All protections passed - execute or schedule
  if (action._isScheduled) {
    return scheduleExecution(action, currentPayload)
  }

  // STEP 6: Update payload state for change detection
  if (action._hasChangeDetection) {
    payloadState.set(action.id, originalPayload, 'call')
  }

  // STEP 7: Final execution with transformed payload
  const result = await useDispatch(action, currentPayload)

  // Handle IntraLink chains
  if (result.ok && result.metadata?.intraLink) {
    const {id: chainId, payload: chainPayload} = result.metadata.intraLink
    try {
      const chainResult = await call(chainId, chainPayload)
      result.metadata.chainResult = chainResult
    } catch (error) {
      log.error(`IntraLink chain failed for ${chainId}: ${error}`)
    }
  }

  return result
}

/**
 * Get protection type from compiled function metadata
 */
function getProtectionType(protectionFn: Function): string {
  // Use metadata added during compilation
  const type = (protectionFn as any).__type
  if (type) return type

  // Fallback to analyzing function (should not happen in normal operation)
  const funcStr = protectionFn.toString()
  if (funcStr.includes('Throttled')) return 'throttle'
  if (funcStr.includes('Debounced')) return 'debounce'
  if (funcStr.includes('Schema')) return 'schema'
  if (funcStr.includes('Condition')) return 'condition'
  if (funcStr.includes('Selector')) return 'selector'
  if (funcStr.includes('Transform')) return 'transform'

  return 'unknown'
}

/**
 * Handle debounce execution with proper timer management
 */
function handleDebounceExecution(
  action: IO,
  payload: ActionPayload,
  delay: number
): CyreResponse {
  // Clear existing debounce timer
  if (action._debounceTimer) {
    TimeKeeper.forget(action._debounceTimer)
  }

  const timerId = `${action.id}-debounce-${Date.now()}`
  action._debounceTimer = timerId

  // Schedule delayed execution
  const timerResult = TimeKeeper.keep(
    delay,
    async () => {
      try {
        // Clear timer reference
        action._debounceTimer = undefined

        sensor.log(action.id, 'info', 'debounce-delayed-execution', {
          executedAfterDelay: true,
          timestamp: Date.now()
        })

        // Create context for delayed execution
        const context = {
          action: {...action, _bypassDebounce: true}, // Bypass debounce on re-execution
          payload,
          originalPayload: payload,
          metrics: io.getMetrics(action.id),
          timestamp: Date.now()
        }

        let currentPayload = payload
        const pipeline = action._protectionPipeline || []
        let debounceIndex = -1

        // Find debounce protection index
        for (let i = 0; i < pipeline.length; i++) {
          if ((pipeline[i] as any).__type === 'debounce') {
            debounceIndex = i
            break
          }
        }

        // Execute pipeline from after debounce
        for (let i = debounceIndex + 1; i < pipeline.length; i++) {
          const protectionFn = pipeline[i]
          const protectionType = action._protectionTypes[i]

          try {
            const result = await Promise.resolve(protectionFn(context))
            if (!result.pass) {
              sensor.log(
                action.id,
                protectionType,
                'pipeline-protection-block',
                {
                  reason: result.reason,
                  protectionIndex: i,
                  protectionType
                }
              )

              return {
                ok: false,
                payload: undefined,
                message: result.reason || 'Protection failed'
              }
            }

            if (result.payload !== undefined) {
              currentPayload = result.payload
              context.payload = currentPayload
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            sensor.error(action.id, errorMessage, `pipeline-protection-${i}`)

            return {
              ok: false,
              payload: undefined,
              message: `Pipeline protection error: ${errorMessage}`
            }
          }
        }

        // Continue with normal execution flow
        if (action._isScheduled) {
          return scheduleExecution(action, currentPayload)
        }

        // Update payload state for change detection
        if (action._hasChangeDetection) {
          payloadState.set(action.id, currentPayload, 'call')
        }

        // Final execution with transformed payload
        const result = await useDispatch(action, currentPayload)

        // Handle IntraLink chains
        if (result.ok && result.metadata?.intraLink) {
          const {id: chainId, payload: chainPayload} = result.metadata.intraLink
          try {
            const chainResult = await call(chainId, chainPayload)
            result.metadata.chainResult = chainResult
          } catch (error) {
            log.error(`IntraLink chain failed for ${chainId}: ${error}`)
          }
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        sensor.error(action.id, errorMessage, 'debounce-execution-error')
        return {
          ok: false,
          payload: undefined,
          message: `Debounce execution failed: ${errorMessage}`
        }
      }
    },
    1, // Execute once
    timerId
  )

  if (timerResult.kind === 'error') {
    return {
      ok: false,
      payload: null,
      message: `Debounce scheduling failed: ${timerResult.error.message}`
    }
  }

  return {
    ok: false, // Debounce returns false initially
    payload: null,
    message: `Debounced - will execute in ${delay}ms`,
    metadata: {delayed: true, duration: delay}
  }
}

/**
 * Schedule execution for intervals/delays
 */
function scheduleExecution(action: IO, payload: ActionPayload): CyreResponse {
  const config = action._scheduleConfig!
  const interval = config.interval || config.delay || 0
  const repeat = config.repeat ?? 1
  const delay = config.delay

  const result = TimeKeeper.keep(
    interval,
    async () => await useDispatch(action, payload),
    repeat,
    action.id,
    delay
  )

  if (result.kind === 'error') {
    return {
      ok: false,
      payload: undefined,
      message: `Scheduling failed: ${result.error.message}`
    }
  }

  return {
    ok: true,
    payload: undefined,
    message: 'Scheduled execution',
    metadata: {scheduled: true, interval, delay, repeat}
  }
}
