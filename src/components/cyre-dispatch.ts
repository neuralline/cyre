// src/components/cyre-dispatch.ts
// Enhanced dispatch with smart execution operators and hot path optimization

import {io} from '../context/state'
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
      
      Enhanced dispatch with smart execution operators:
      1. Ultra-fast single handler path (zero overhead)
      2. Optimized parallel execution for multiple handlers
      3. Sequential execution with early termination
      4. Race and waterfall execution strategies
      5. Pre-compiled execution configuration from registration
      6. Smart error handling and result collection

*/

/**
 * Ultra-fast single handler execution (most common case)
 */
const executeSingleHandler = async (
  action: IO,
  handler: Function,
  payload: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()

  try {
    // Direct handler execution - zero Promise.all overhead
    const result = await handler(payload)

    const executionTime = performance.now() - startTime
    const lastExecTime = Date.now()
    const executionCount = (action._executionCount || 0) + 1

    // Update action metrics
    io.set({
      ...action,
      _executionTime: executionTime,
      _lastExecTime: lastExecTime,
      _executionCount: executionCount
    })

    // Update payload history for change detection
    payloadState.set(action.id, payload, 'call')

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
    io.set({
      ...action,
      _executionTime: executionTime,
      _errorCount: (action._errorCount || 0) + 1,
      errors: [
        ...(action.errors || []),
        {timestamp: Date.now(), message: errorMessage}
      ]
    })

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

    // Analyze results
    const successful = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    // Handle error strategy
    if (failed.length > 0 && errorStrategy === 'fail-fast') {
      const firstError = failed[0] as PromiseRejectedResult
      throw new Error(`Parallel execution failed: ${firstError.reason}`)
    }

    // Collect results based on strategy
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

    // Update action metrics
    io.set({
      ...action,
      _executionTime: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })

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
  const timeout = action._dispatchTimeout || 10000
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
    io.set({
      ...action,
      _executionTime: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })

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
    io.set({
      ...action,
      _executionTime: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })

    return {
      ok: true,
      payload: result,
      message: `Race execution completed - first handler won`,
      metadata: {
        executionOperator: 'race',
        handlerCount: handlers.length,
        strategy: 'continue', // Race always continues
        collectStrategy: 'first', // Race always returns first
        executionTime,
        hasTimeout: timeout > 0
      },
      successfulHandlers: 1, // Only one wins in race
      failedHandlers: 0 // Others are cancelled, not failed
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

/**
 * Waterfall execution - each handler processes the result of the previous
 */
const executeWaterfallHandlers = async (
  action: IO,
  handlers: Function[],
  payload: ActionPayload
): Promise<MultiHandlerResult> => {
  const startTime = performance.now()
  const timeout = action._dispatchTimeout || 15000 // Longer default for waterfall
  const errorStrategy = action._errorStrategy || 'fail-fast' // Waterfall usually wants fail-fast

  try {
    const executeWaterfall = async () => {
      let currentPayload = payload

      for (let i = 0; i < handlers.length; i++) {
        try {
          currentPayload = await handlers[i](currentPayload)
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          if (errorStrategy === 'fail-fast') {
            throw new Error(
              `Waterfall execution failed at handler ${i + 1}: ${errorMessage}`
            )
          }
          // For 'continue' strategy, pass original payload to next handler
        }
      }

      return currentPayload
    }

    const result =
      timeout > 0
        ? await Promise.race([
            executeWaterfall(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`Waterfall execution timeout after ${timeout}ms`)
                  ),
                timeout
              )
            )
          ])
        : await executeWaterfall()

    const executionTime = performance.now() - startTime

    // Update action metrics
    io.set({
      ...action,
      _executionTime: executionTime,
      _lastExecTime: Date.now(),
      _executionCount: (action._executionCount || 0) + 1
    })

    return {
      ok: true,
      payload: result,
      message: `Waterfall execution completed through ${handlers.length} handlers`,
      metadata: {
        executionOperator: 'waterfall',
        handlerCount: handlers.length,
        strategy: errorStrategy,
        collectStrategy: 'last', // Waterfall always returns final result
        executionTime,
        hasTimeout: timeout > 0
      },
      successfulHandlers: handlers.length,
      failedHandlers: 0
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
 * Main dispatch function with smart execution operator routing
 */
export const useDispatch = async (
  action: IO,
  payload?: ActionPayload
): Promise<CyreResponse> => {
  const startTime = performance.now()

  // Preserve falsy values like 0, undefined, false, ''
  const currentPayload = payload !== undefined ? payload : action.payload

  try {
    // Get handlers using new array-based storage
    const handlers = getHandlers(action.id)

    if (handlers.length === 0) {
      const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${action.id}`
      sensor.error(error, action.id)
      const errorResponse = {ok: false, payload: null, message: error}

      // Store error response in payload state
      payloadState.setResponse(action.id, errorResponse)
      return errorResponse
    }

    // Route to appropriate execution strategy based on pre-compiled operator
    const executionOperator = action._executionOperator || 'single'

    let response: CyreResponse

    switch (executionOperator) {
      case 'single':
        // Ultra-fast path for single handler
        response = await executeSingleHandler(
          action,
          handlers[0],
          currentPayload
        )
        break

      case 'parallel':
        const parallelResult = await executeParallelHandlers(
          action,
          handlers,
          currentPayload
        )
        // Convert MultiHandlerResult to CyreResponse
        response = {
          ok: parallelResult.ok,
          payload: parallelResult.payload,
          message: parallelResult.message,
          error: !parallelResult.ok,
          metadata: parallelResult.metadata
        }
        break

      case 'sequential':
        const sequentialResult = await executeSequentialHandlers(
          action,
          handlers,
          currentPayload
        )
        response = {
          ok: sequentialResult.ok,
          payload: sequentialResult.payload,
          message: sequentialResult.message,
          error: !sequentialResult.ok,
          metadata: sequentialResult.metadata
        }
        break

      case 'race':
        const raceResult = await executeRaceHandlers(
          action,
          handlers,
          currentPayload
        )
        response = {
          ok: raceResult.ok,
          payload: raceResult.payload,
          message: raceResult.message,
          error: !raceResult.ok,
          metadata: raceResult.metadata
        }
        break

      case 'waterfall':
        const waterfallResult = await executeWaterfallHandlers(
          action,
          handlers,
          currentPayload
        )
        response = {
          ok: waterfallResult.ok,
          payload: waterfallResult.payload,
          message: waterfallResult.message,
          error: !waterfallResult.ok,
          metadata: waterfallResult.metadata
        }
        break

      default:
        // Fallback to single execution
        sensor.warn(
          `Unknown execution operator: ${executionOperator}, falling back to single`
        )
        response = await executeSingleHandler(
          action,
          handlers[0],
          currentPayload
        )
        break
    }

    // Store response in payload state
    payloadState.setResponse(action.id, response)
    return response
  } catch (dispatchError) {
    const errorMessage =
      dispatchError instanceof Error
        ? dispatchError.message
        : String(dispatchError)
    const totalTime = performance.now() - startTime

    sensor.error(action.id, errorMessage, 'dispatch-exception')
    sensor.error(`Dispatch failed: ${errorMessage}`)

    const errorResponse = {
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

    // Store error response in payload state
    payloadState.setResponse(action.id, errorResponse)
    return errorResponse
  }
}
