// src/components/cyre-dispatch.ts
// Updated dispatch with proper payload flow and fixed waterfall execution

import {io} from '../context/state'
import {metricsStream} from '../context/metrics-stream'
import {
  ActionPayload,
  CyreResponse,
  IO,
  MultiHandlerResult
} from '../types/core'
import {MSG} from '../config/cyre-config'
import {sensor} from '../components/sensor'
import payloadState from '../context/payload-state'
import {getHandlers} from './cyre-on'

/*
      C.Y.R.E - D.I.S.P.A.T.C.H

      Fixed dispatch with proper payload flow:
      1. Save request payload just before dispatch (execution certain)
      2. Execute handlers with correct strategy
      3. Save response payload after execution complete
      4. FIXED: Waterfall execution now properly chains data between handlers
*/

/**
 * Main dispatch function with proper payload flow
 */
const isIntraLinkSignal = (
  value: unknown
): value is {id: string; payload?: ActionPayload} => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value as object)
  const onlyExpectedKeys =
    keys.every(k => k === 'id' || k === 'payload') && keys.includes('id')
  if (!onlyExpectedKeys) return false
  if (typeof (value as any).id !== 'string') return false
  return io.get((value as any).id) !== undefined // only chain to a real, registered channel
}

const MAX_CHAIN_DEPTH = 10

const followIntraLink = async (
  response: CyreResponse,
  depth: number
): Promise<CyreResponse> => {
  if (!response.ok || !isIntraLinkSignal(response.payload)) return response

  if (depth >= MAX_CHAIN_DEPTH) {
    sensor.warn(
      `IntraLink chain aborted after ${MAX_CHAIN_DEPTH} hops (possible cycle) at "${(response.payload as any).id}"`
    )
    return response
  }

  const {id: nextId, payload: nextPayload} = response.payload as {
    id: string
    payload?: ActionPayload
  }
  // dynamic import to dodge the circular dependency with app.ts —
  // same pattern already used in path-plugin.ts's bulk-call path
  const {call} = await import('../app')
  const chainResult = await call(nextId, nextPayload)

  return {
    ...response,
    metadata: {
      ...response.metadata,
      intraLink: {id: nextId, payload: nextPayload},
      chainResult
    }
  }
}

// A per-process monotonic counter for correlationId's uniqueness suffix -
// cheaper than Math.random().toString(36).slice(2, 9) on every single
// dispatch (correlationId is currently write-only: stored in payload
// state's metadata but never read back anywhere in src/ - see
// claude/cyre-codebase-analysis.md's hot-path notes) while keeping the
// same id-timestamp-suffix shape in case anything outside this codebase
// parses it.
let dispatchSequence = 0

export const useDispatch = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()
  const correlationId = `${action.id}-${Date.now()}-${(
    dispatchSequence++
  ).toString(36)}`

  try {
    // Get handlers using array-based storage
    const handlers = getHandlers(action.id)

    if (handlers.length === 0) {
      const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${action.id}`
      sensor.error(error, action.id)

      const errorResponse: CyreResponse = {
        ok: false,
        payload: null,
        message: error
      }

      // Save error response to payload state
      // payloadState.setResponse(action.id, errorResponse, correlationId)
      return errorResponse
    }

    // STEP 1: Save request payload just before dispatch (execution is certain)
    const requestPayload = payload !== undefined ? payload : action.payload
    // keepPayload: false (compile-pipeline.ts's _keepPayload, default true)
    // skips holding a reference to the payload itself - touchReq() still
    // bumps requestCount/status so cyre.get() keeps reporting activity,
    // it just doesn't copy a (possibly huge, one-off) payload into
    // payload-state for a channel that has no use for it later.
    if (action._keepPayload === false) {
      payloadState.touchReq(action.id, 'call')
    } else {
      payloadState.setReq(action.id, requestPayload, 'call', action._history)
    }

    // STEP 2: Execute handlers based on strategy - FIXED ROUTING
    const executionOperator = action._executionOperator || 'single'
    let response: CyreResponse

    switch (executionOperator) {
      case 'single':
        response = await executeSingleHandler(
          action,
          handlers[0],
          requestPayload
        )
        break

      case 'parallel':
        const parallelResult = await executeParallelHandlers(
          action,
          handlers,
          requestPayload
        )
        response = convertMultiHandlerResult(parallelResult)
        break

      case 'sequential':
        const sequentialResult = await executeSequentialHandlers(
          action,
          handlers,
          requestPayload
        )
        response = convertMultiHandlerResult(sequentialResult)
        break

      case 'race':
        const raceResult = await executeRaceHandlers(
          action,
          handlers,
          requestPayload
        )
        response = convertMultiHandlerResult(raceResult)
        break

      case 'waterfall':
        const waterfallResult = await executeWaterfallHandlers(
          action,
          handlers,
          requestPayload
        )
        response = convertMultiHandlerResult(waterfallResult)
        break

      default:
        sensor.warn(
          `Unknown execution operator: ${executionOperator}, falling back to single`
        )
        response = await executeSingleHandler(
          action,
          handlers[0],
          requestPayload
        )
        break
    }

    // STEP 3: Save response payload after execution complete
    if (action._keepPayload === false) {
      payloadState.touchRes(action.id, response, correlationId)
    } else {
      payloadState.setRes(action.id, response, correlationId)
    }

    return await followIntraLink(response, 0)
  } catch (dispatchError) {
    const errorMessage =
      dispatchError instanceof Error
        ? dispatchError.message
        : String(dispatchError)
    const totalTime = performance.now() - startTime

    sensor.error(action.id, errorMessage, 'dispatch-exception')

    const errorResponse: CyreResponse = {
      ok: false,
      payload: null,
      message: `Dispatch failed: ${errorMessage}`,
      error: true,
      metadata: {
        executionOperator: action._executionOperator || 'unknown',
        handlerCount: 0,
        executionTime: totalTime,
        hasTimeout: false
      }
    }

    // Save error response to payload state
    if (action._keepPayload === false) {
      payloadState.touchRes(action.id, errorResponse, correlationId)
    } else {
      payloadState.setRes(action.id, errorResponse, correlationId)
    }
    return errorResponse
  }
}

/**
 * Ultra-fast single handler execution
 */
const executeSingleHandler = async (
  action: IO,
  handler: Function,
  payload: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()

  try {
    const result = await handler(payload)
    const executionTime = performance.now() - startTime

    // Update action metrics
    io.touch(action.id, {
      _executionDuration: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })
    metricsStream.noteExecution(action.id, executionTime)

    return {
      ok: true,
      payload: result,
      message: MSG.OPERATION_SUCCESSFUL,
      metadata: {
        executionOperator: 'single',
        handlerCount: 1,
        executionTime,
        hasTimeout: false
      }
    }
  } catch (error) {
    const executionTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Update action with error info
    io.touch(action.id, {
      _executionDuration: executionTime,
      _errorCount: (action._errorCount || 0) + 1,
      errors: [
        ...(action.errors || []),
        {timestamp: Date.now(), message: errorMessage}
      ]
    })

    metricsStream.noteError(action.id, errorMessage, executionTime)
    sensor.error(action.id, errorMessage, 'single-handler-execution')

    return {
      ok: false,
      payload: null,
      message: `Handler execution failed: ${errorMessage}`,
      error: true,
      metadata: {
        executionOperator: 'single',
        handlerCount: 1,
        executionTime,
        hasTimeout: false
      }
    }
  }
}

/**
 * Convert MultiHandlerResult to CyreResponse
 */
const convertMultiHandlerResult = (
  result: MultiHandlerResult
): CyreResponse => {
  return {
    ok: result.ok,
    payload: result.payload,
    message: result.message,
    error: !result.ok,
    metadata: result.metadata
  }
}

/**
 * Waterfall execution with proper payload chaining.
 *
 * FIX: previously, the per-handler catch block only did anything when
 * errorStrategy === 'fail-fast' (it threw); for every other strategy the
 * error was silently dropped - not logged, not counted in failedHandlers,
 * and the final response still reported ok: true and "completed through N
 * handlers" even though a handler threw partway through. Sequential and
 * parallel dispatch both correctly track per-handler failures; waterfall
 * now does too, via the same successfulHandlers/failedHandlers accounting
 * they use, and the same `ok: successful > 0 || errorStrategy === 'continue'`
 * rule parallel/sequential already apply.
 */
const executeWaterfallHandlers = async (
  action: IO,
  handlers: Function[],
  payload: ActionPayload
): Promise<MultiHandlerResult> => {
  const startTime = performance.now()
  const timeout = action._dispatchTimeout || 15000
  const errorStrategy = action._errorStrategy || 'fail-fast'

  try {
    const executeWaterfall = async () => {
      let currentPayload = payload
      let successfulHandlers = 0
      const handlerErrors: string[] = []

      for (let i = 0; i < handlers.length; i++) {
        try {
          // 🔍 CRITICAL: Execute handler with current payload
          const handlerResult = await handlers[i](currentPayload)

          currentPayload = handlerResult
          successfulHandlers++
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          if (errorStrategy === 'fail-fast') {
            throw new Error(
              `Waterfall execution failed at handler ${i + 1}: ${errorMessage}`
            )
          }

          // Non-fail-fast: don't let this failure vanish silently. Log it
          // and count it - currentPayload deliberately stays at its last
          // successful value, so the next handler in the chain still gets
          // sensible input instead of this handler's thrown error.
          handlerErrors.push(`handler ${i + 1}: ${errorMessage}`)
          sensor.error(action.id, errorMessage, `waterfall-handler-${i + 1}`)
        }
      }

      return {currentPayload, successfulHandlers, handlerErrors}
    }

    const waterfallOutcome =
      timeout > 0
        ? await Promise.race([
            executeWaterfall(),
            new Promise<never>((_, reject) =>
              setTimeout(() => {
                reject(
                  new Error(`Waterfall execution timeout after ${timeout}ms`)
                )
              }, timeout)
            )
          ])
        : await executeWaterfall()

    const {currentPayload, successfulHandlers, handlerErrors} = waterfallOutcome
    const executionTime = performance.now() - startTime

    // Update action metrics
    io.touch(action.id, {
      _executionDuration: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })
    metricsStream.noteExecution(action.id, executionTime)

    const isSuccess = successfulHandlers > 0 || errorStrategy === 'continue'

    return {
      ok: isSuccess,
      payload: currentPayload,
      message:
        handlerErrors.length === 0
          ? `Waterfall execution completed through ${handlers.length} handlers`
          : `${successfulHandlers}/${handlers.length} handlers succeeded`,
      metadata: {
        executionOperator: 'waterfall',
        handlerCount: handlers.length,
        strategy: errorStrategy,
        collectStrategy: 'last',
        executionTime,
        hasTimeout: timeout > 0
      },
      successfulHandlers,
      failedHandlers: handlerErrors.length
    }
  } catch (error) {
    const executionTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'waterfall-execution')

    return {
      ok: false,
      payload: null,
      message: `Waterfall execution failed: ${errorMessage}`,
      metadata: {
        executionOperator: 'waterfall',
        handlerCount: handlers.length,
        strategy: errorStrategy,
        collectStrategy: 'last',
        executionTime,
        hasTimeout: timeout > 0
      },
      successfulHandlers: 0,
      failedHandlers: handlers.length
    }
  }
}

/**
 * Parallel execution for multiple handlers
 */
const executeParallelHandlers = async (
  action: IO,
  handlers: Function[],
  payload: ActionPayload
): Promise<MultiHandlerResult> => {
  const startTime = performance.now()
  const timeout = action._dispatchTimeout || 10000
  const errorStrategy = action._errorStrategy || 'continue'
  const collectStrategy = action._collectStrategy || 'last'

  try {
    const executeWithTimeout =
      timeout > 0
        ? Promise.race([
            Promise.allSettled(handlers.map(h => h(payload))),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`Parallel execution timeout after ${timeout}ms`)
                  ),
                timeout
              )
            )
          ])
        : Promise.allSettled(handlers.map(h => h(payload)))

    const results = await executeWithTimeout
    const executionTime = performance.now() - startTime

    const successful = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    if (failed.length > 0 && errorStrategy === 'fail-fast') {
      const firstError = failed[0] as PromiseRejectedResult
      throw new Error(`Parallel execution failed: ${firstError.reason}`)
    }

    let finalPayload: any
    switch (collectStrategy) {
      case 'first':
        finalPayload =
          successful.length > 0
            ? (successful[0] as PromiseFulfilledResult<any>).value
            : null
        break
      case 'last':
        finalPayload =
          successful.length > 0
            ? (successful[successful.length - 1] as PromiseFulfilledResult<any>)
                .value
            : null
        break
      case 'all':
        finalPayload = successful.map(
          r => (r as PromiseFulfilledResult<any>).value
        )
        break
      default:
        finalPayload =
          successful.length > 0
            ? (successful[successful.length - 1] as PromiseFulfilledResult<any>)
                .value
            : null
    }

    io.touch(action.id, {
      _executionDuration: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })
    metricsStream.noteExecution(action.id, executionTime)

    const isSuccess = successful.length > 0 || errorStrategy === 'continue'

    return {
      ok: isSuccess,
      payload: finalPayload,
      message:
        failed.length === 0
          ? MSG.EXECUTION_SUCCESSFUL
          : `${successful.length}/${handlers.length} handlers succeeded`,
      metadata: {
        executionOperator: 'parallel',
        handlerCount: handlers.length,
        strategy: errorStrategy,
        collectStrategy,
        executionTime,
        hasTimeout: timeout > 0
      },
      individualResults: collectStrategy === 'all' ? results : undefined,
      successfulHandlers: successful.length,
      failedHandlers: failed.length
    }
  } catch (error) {
    const executionTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'parallel-execution')

    return {
      ok: false,
      payload: null,
      message: `Parallel execution failed: ${errorMessage}`,
      metadata: {
        executionOperator: 'parallel',
        handlerCount: handlers.length,
        strategy: errorStrategy,
        collectStrategy,
        executionTime,
        hasTimeout: timeout > 0
      },
      successfulHandlers: 0,
      failedHandlers: handlers.length
    }
  }
}

/**
 * Sequential execution for multiple handlers
 */
const executeSequentialHandlers = async (
  action: IO,
  handlers: Function[],
  payload: ActionPayload
): Promise<MultiHandlerResult> => {
  const startTime = performance.now()
  const timeout = action._dispatchTimeout || 15000
  const errorStrategy = action._errorStrategy || 'continue'
  const collectStrategy = action._collectStrategy || 'last'

  const results: any[] = []
  const errors: string[] = []
  let successfulHandlers = 0

  try {
    const executeSequentialWithTimeout = async () => {
      for (let i = 0; i < handlers.length; i++) {
        try {
          const result = await handlers[i](payload)
          results.push(result)
          successfulHandlers++
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          errors.push(errorMessage)

          if (errorStrategy === 'fail-fast') {
            throw new Error(
              `Sequential execution failed at handler ${i + 1}: ${errorMessage}`
            )
          }
        }
      }
      return results
    }

    const finalResults =
      timeout > 0
        ? await Promise.race([
            executeSequentialWithTimeout(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`Sequential execution timeout after ${timeout}ms`)
                  ),
                timeout
              )
            )
          ])
        : await executeSequentialWithTimeout()

    const executionTime = performance.now() - startTime

    // Collect results based on strategy
    let finalPayload: any
    switch (collectStrategy) {
      case 'first':
        finalPayload = results.length > 0 ? results[0] : null
        break
      case 'last':
        finalPayload = results.length > 0 ? results[results.length - 1] : null
        break
      case 'all':
        finalPayload = results
        break
      default:
        finalPayload = results.length > 0 ? results[results.length - 1] : null
    }

    // Update action metrics
    io.touch(action.id, {
      _executionDuration: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })
    metricsStream.noteExecution(action.id, executionTime)

    const isSuccess = successfulHandlers > 0 || errorStrategy === 'continue'

    return {
      ok: isSuccess,
      payload: finalPayload,
      message:
        errors.length === 0
          ? MSG.EXECUTION_SUCCESSFUL
          : `${successfulHandlers}/${handlers.length} handlers succeeded`,
      metadata: {
        executionOperator: 'sequential',
        handlerCount: handlers.length,
        strategy: errorStrategy,
        collectStrategy,
        executionTime,
        hasTimeout: timeout > 0
      },
      individualResults: collectStrategy === 'all' ? results : undefined,
      successfulHandlers,
      failedHandlers: errors.length
    }
  } catch (error) {
    const executionTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'sequential-execution')

    return {
      ok: false,
      payload: null,
      message: `Sequential execution failed: ${errorMessage}`,
      metadata: {
        executionOperator: 'sequential',
        handlerCount: handlers.length,
        strategy: errorStrategy,
        collectStrategy,
        executionTime,
        hasTimeout: timeout > 0
      },
      successfulHandlers,
      failedHandlers: handlers.length - successfulHandlers
    }
  }
}

/**
 * Race execution - first successful result wins
 */
const executeRaceHandlers = async (
  action: IO,
  handlers: Function[],
  payload: ActionPayload
): Promise<MultiHandlerResult> => {
  const startTime = performance.now()
  const timeout = action._dispatchTimeout || 5000 // Shorter default for race

  try {
    const racePromise = Promise.race(handlers.map(h => h(payload)))

    const result =
      timeout > 0
        ? await Promise.race([
            racePromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`Race execution timeout after ${timeout}ms`)
                  ),
                timeout
              )
            )
          ])
        : await racePromise

    const executionTime = performance.now() - startTime

    // Update action metrics
    io.touch(action.id, {
      _executionDuration: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })
    metricsStream.noteExecution(action.id, executionTime)

    return {
      ok: true,
      payload: result,
      message: `Race execution completed - first handler won`,
      metadata: {
        executionOperator: 'race',
        handlerCount: handlers.length,
        strategy: 'continue',
        collectStrategy: 'first',
        executionTime,
        hasTimeout: timeout > 0
      },
      successfulHandlers: 1,
      failedHandlers: 0
    }
  } catch (error) {
    const executionTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    sensor.error(action.id, errorMessage, 'race-execution')

    return {
      ok: false,
      payload: null,
      message: `Race execution failed: ${errorMessage}`,
      metadata: {
        executionOperator: 'race',
        handlerCount: handlers.length,
        strategy: 'continue',
        collectStrategy: 'first',
        executionTime,
        hasTimeout: timeout > 0
      },
      successfulHandlers: 0,
      failedHandlers: handlers.length
    }
  }
}
