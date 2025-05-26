// src/pipeline/pipeline-executor.ts
// FIXED: Synchronous chain reactions and proper delay/interval handling

import type {
  IO,
  ActionPayload,
  CyreResponse,
  EventHandler
} from '../types/interface'
import {subscribers} from '../context/state'
import {log} from '../components/cyre-log'
import {MSG} from '../config/cyre-config'
import {metricsReport} from '../context/metrics-report'
import {historyState} from '../context/history-state'
import timeKeeper from '../components/cyre-timekeeper'
import {CompiledPipeline, getCompiledPipeline} from './pipeline-compiler'

// Safe performance measurement utility
const safePerformanceNow = (): number => {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now()
  }
  if (typeof process !== 'undefined' && process.hrtime) {
    const [seconds, nanoseconds] = process.hrtime()
    return seconds * 1000 + nanoseconds / 1000000
  }
  return Date.now()
}

/*

      C.Y.R.E. - P.I.P.E.L.I.N.E. - E.X.E.C.U.T.O.R.
      
      FIXED: Lightweight metrics integration:
      1. Fast path for simple channels (direct execution ~0.05ms)
      2. Compiled pipeline execution for protected channels
      3. Timekeeper integration for interval, delay, repeat
      4. Lightweight metrics collection for external monitoring

      NOTE:
      - should handle Intralink executions/ event chaining
      - Actions are compiled at registration time
      - Fast path for simple channels (zero overhead)
      - Timekeeper integration for interval/delay/repeat
      - Pre-compiled pipelines stored per channel state
      - compiled pipeline should include all actions. eg:repeat,delay, debounce
      - pre-verification before compile and fast path
      - {block:true} option. like fast path, pre-block for failed verifications, {repeat:0}, {block:true} or service no longer available 
      - Lightweight metrics collection for external monitoring
      - Functional architecture
      - no emotes 
      - metrics-report should track these event types:
              EventType =
                      | 'call'
                      | 'dispatch'
                      | 'execution'
                      | 'error'
                      | 'warning'
                      | 'critical'
                      | 'info'
                      | 'debug'
                      | 'throttle'
                      | 'debounce'
                      | 'skip'
                      | 'delayed'
                      | 'repeat'
                      | 'blocked'
                      | 'unknown id'
                      | 'no subscriber'
                      | 'other'

*/

// Lightweight execution statistics
const executionStats = {
  totalExecutions: 0,
  fastPathExecutions: 0,
  pipelineExecutions: 0,
  timekeeperExecutions: 0
}

/**
 * Simple timer utility for lightweight timing
 */
interface SimpleTimer {
  startTime: number
  getTotalTime(): number
}

const createSimpleTimer = (): SimpleTimer => {
  const startTime = safePerformanceNow()
  return {
    startTime,
    getTotalTime(): number {
      return safePerformanceNow() - startTime
    }
  }
}

/**
 * FIXED: Check if action requires timekeeper (has timing properties)
 */
const requiresTimekeeper = (action: IO): boolean => {
  const needsTimekeeper = !!(
    action.interval ||
    action.delay !== undefined ||
    (action.repeat !== undefined && action.repeat !== 1 && action.repeat !== 0)
  )

  if (needsTimekeeper) {
    log.debug(
      `⏱️ Action ${action.id} requires timekeeper: interval=${action.interval}, delay=${action.delay}, repeat=${action.repeat}`
    )
  }

  return needsTimekeeper
}

/**
 * ⚡ ZERO-OVERHEAD FAST PATH EXECUTION
 * Direct execution with minimal overhead for simple channels (~0.05ms)
 */
const executeFastPath = async (
  action: IO,
  payload: ActionPayload,
  timer: SimpleTimer
): Promise<CyreResponse> => {
  // Apply essential system protections even in fast path
  const {metricsState} = await import('../context/metrics-state')
  const {breathing} = metricsState.get()
  if (breathing.isRecuperating && action.priority?.level !== 'critical') {
    return {
      ok: false,
      payload: null,
      message: `System recuperating. Only critical actions allowed.`
    }
  }

  // CRITICAL FIX: Repeat zero check for fast path
  if (action.repeat === 0) {
    return {
      ok: true,
      payload: null,
      message: 'Action registered but not executed (repeat: 0)'
    }
  }

  // Get subscriber with minimal validation
  const subscriber = subscribers.get(action.id)
  if (!subscriber) {
    const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${action.id}`
    return {ok: false, payload: null, message: error}
  }

  try {
    // Direct execution - Minimal pipeline overhead
    const result = subscriber.fn(payload)
    // Handle both sync and async results
    const handlerResult = await Promise.resolve(result)

    // Update lightweight execution stats
    executionStats.totalExecutions++
    executionStats.fastPathExecutions++

    const totalTime = timer.getTotalTime()

    // Track execution with lightweight collector
    metricsReport.trackExecution(action.id, totalTime, 'fast-path')

    // Record history
    historyState.record(
      action.id,
      payload,
      {ok: true, message: 'Fast path execution'},
      totalTime
    )

    // FIXED: Handle chain reactions synchronously for fast path
    if (
      handlerResult &&
      typeof handlerResult === 'object' &&
      'id' in handlerResult &&
      handlerResult.id
    ) {
      log.debug(
        `🔗 Processing fast path chain reaction: ${action.id} -> ${handlerResult.id}`
      )

      // Process chain reaction synchronously
      const chainResult = await processChainReaction(
        action.id,
        handlerResult.id,
        handlerResult.payload
      )

      return {
        ok: true,
        payload: handlerResult,
        message: MSG.WELCOME,
        metadata: {
          executionPath: 'fast-path',
          executionTime: totalTime,
          intraLink: {
            id: handlerResult.id,
            payload: handlerResult.payload,
            chainResult: chainResult
          }
        }
      }
    }

    return {
      ok: true,
      payload: handlerResult,
      message: MSG.WELCOME,
      metadata: {
        executionPath: 'fast-path',
        executionTime: totalTime
      }
    }
  } catch (error) {
    const totalTime = timer.getTotalTime()
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(
      `Cyre: Fast path execution failed for ${action.id}: ${errorMessage}`
    )

    // Track error with lightweight collector
    metricsReport.trackError(action.id, errorMessage)

    // Record error in history
    historyState.record(
      action.id,
      payload,
      {ok: false, error: errorMessage},
      totalTime
    )

    return {
      ok: false,
      payload: null,
      message: `Fast path execution failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * 🏗️ COMPILED PIPELINE EXECUTION
 * Executes the pre-compiled pipeline with minimal runtime overhead
 */
const executePipeline = async (
  action: IO,
  payload: ActionPayload,
  compiledPipeline: CompiledPipeline,
  timer: SimpleTimer
): Promise<CyreResponse> => {
  try {
    // Get the final execution function
    const finalExecution = async (
      finalPayload?: ActionPayload
    ): Promise<CyreResponse> => {
      const subscriber = subscribers.get(action.id)
      if (!subscriber) {
        const error = `${MSG.DISPATCH_NO_SUBSCRIBER} ${action.id}`
        return {ok: false, payload: null, message: error}
      }

      const result = await Promise.resolve(
        subscriber.fn(finalPayload || payload)
      )

      // FIXED: Handle chain reactions synchronously from pipeline execution
      if (result && typeof result === 'object' && 'id' in result && result.id) {
        log.debug(
          `🔗 Processing pipeline chain reaction: ${action.id} -> ${result.id}`
        )

        // Process chain reaction synchronously
        const chainResult = await processChainReaction(
          action.id,
          result.id,
          result.payload
        )

        return {
          ok: true,
          payload: result,
          message: MSG.WELCOME,
          metadata: {
            intraLink: {
              id: result.id,
              payload: result.payload,
              chainResult: chainResult
            }
          }
        }
      }

      return {
        ok: true,
        payload: result,
        message: MSG.WELCOME
      }
    }

    // Execute pipeline functions in sequence
    let currentPayload = payload
    let response: CyreResponse

    if (compiledPipeline.pipeline.length === 0) {
      // No pipeline functions, direct execution
      response = await finalExecution(currentPayload)
    } else {
      // Execute pipeline using functional composition
      const composedPipeline = compiledPipeline.pipeline.reduceRight<
        () => Promise<CyreResponse>
      >(
        (next, pipelineStep) => {
          return () =>
            pipelineStep(action, currentPayload, async transformedPayload => {
              currentPayload = transformedPayload || currentPayload
              return next()
            })
        },
        () => finalExecution(currentPayload)
      )

      response = await composedPipeline()
    }

    // Update lightweight execution stats
    executionStats.totalExecutions++
    executionStats.pipelineExecutions++

    const totalTime = timer.getTotalTime()

    // Track execution with lightweight collector
    metricsReport.trackExecution(
      action.id,
      totalTime,
      compiledPipeline.performance.category
    )

    // Record history
    historyState.record(
      action.id,
      payload,
      {ok: response.ok, message: response.message, error: response.error},
      totalTime
    )

    // Add execution metadata
    return {
      ...response,
      metadata: {
        ...response.metadata,
        executionPath: 'pipeline',
        executionTime: totalTime,
        pipelineCategory: compiledPipeline.performance.category,
        optimizationLevel: compiledPipeline.performance.optimizationLevel
      }
    }
  } catch (error) {
    const totalTime = timer.getTotalTime()
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(`Pipeline execution failed for ${action.id}: ${errorMessage}`)

    // Track error with lightweight collector
    metricsReport.trackError(action.id, errorMessage)

    // Record error in history
    historyState.record(
      action.id,
      payload,
      {ok: false, error: errorMessage},
      totalTime
    )

    return {
      ok: false,
      payload: null,
      message: `Pipeline execution failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * FIXED: TIMEKEEPER INTEGRATION with proper delay/interval handling
 */
const executeWithTimekeeper = async (
  action: IO,
  payload: ActionPayload,
  compiledPipeline: CompiledPipeline
): Promise<CyreResponse> => {
  const timer = createSimpleTimer()

  try {
    // Create the execution callback that will be called by timekeeper
    const executionCallback = async () => {
      try {
        // Create timer for this specific execution
        const execTimer = createSimpleTimer()

        let result: CyreResponse

        // Route to appropriate execution path (but NOT through timekeeper again)
        if (compiledPipeline.isFastPath) {
          result = await executeFastPath(action, payload, execTimer)
        } else {
          result = await executePipeline(
            action,
            payload,
            compiledPipeline,
            execTimer
          )
        }

        return result
      } catch (error) {
        log.error(
          `Timekeeper execution callback failed for ${action.id}: ${error}`
        )
        throw error
      }
    }

    // FIXED: Proper delay/interval handling for v4.0.0 logic
    let repeat: number | boolean = action.repeat ?? 1

    // FIXED: Pass delay and interval separately to timekeeper
    const timekeeperOptions: {delay?: number; interval?: number} = {}

    if (action.delay !== undefined) {
      timekeeperOptions.delay = action.delay
    }

    if (action.interval !== undefined) {
      timekeeperOptions.interval = action.interval
    }

    // Determine primary duration for timekeeper (delay takes priority, then interval)
    let duration: number
    if (action.delay !== undefined) {
      duration = action.delay
    } else if (action.interval) {
      duration = action.interval
    } else {
      duration = 0 // Immediate execution
    }

    log.debug(
      `[TIMEKEEPER] Setting up ${action.id} with duration: ${duration}, repeat: ${repeat}, options:`,
      timekeeperOptions
    )

    // Use action.id directly as timekeeper ID for proper management
    const timekeeperResult = timeKeeper.keep(
      duration,
      executionCallback,
      repeat,
      action.id, // Use action ID directly
      timekeeperOptions // Pass delay/interval options
    )

    if (timekeeperResult.kind === 'error') {
      return {
        ok: false,
        payload: null,
        message: `Timekeeper scheduling failed: ${timekeeperResult.error.message}`,
        error: timekeeperResult.error.message
      }
    }

    // Update lightweight stats
    executionStats.totalExecutions++
    executionStats.timekeeperExecutions++

    const totalTime = timer.getTotalTime()

    // Return immediate response - actual executions happen via timekeeper
    return {
      ok: true,
      payload: null,
      message: `Scheduled ${repeat} execution(s) with ${duration}ms ${
        action.delay !== undefined
          ? 'delay'
          : action.interval
          ? 'interval'
          : 'immediate'
      }`,
      metadata: {
        executionPath: 'timekeeper',
        schedulingTime: totalTime,
        duration,
        repeat,
        scheduled: true,
        timingOptions: timekeeperOptions
      }
    }
  } catch (error) {
    const totalTime = timer.getTotalTime()
    const errorMessage = error instanceof Error ? error.message : String(error)

    log.error(
      `❌ Timekeeper execution failed for ${action.id}: ${errorMessage}`
    )

    return {
      ok: false,
      payload: null,
      message: `Timekeeper execution failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * 🚀 MAIN EXECUTION DISPATCHER
 * Routes to fast path, pipeline, or timekeeper execution based on action config
 */
export const executeCompiledAction = async (
  action: IO,
  payload: ActionPayload
): Promise<CyreResponse> => {
  try {
    // Get or compile pipeline
    const compiledPipeline = getCompiledPipeline(action)

    // Check if action requires timekeeper first
    if (requiresTimekeeper(action)) {
      return await executeWithTimekeeper(action, payload, compiledPipeline)
    }

    // Create simple timer for immediate execution
    const timer = createSimpleTimer()

    // Route execution based on pipeline type for immediate execution
    if (compiledPipeline.isFastPath) {
      return await executeFastPath(action, payload, timer)
    } else {
      return await executePipeline(action, payload, compiledPipeline, timer)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(
      `Action execution dispatcher failed for ${action.id}: ${errorMessage}`
    )

    return {
      ok: false,
      payload: null,
      message: `Execution failed: ${errorMessage}`,
      error: errorMessage
    }
  }
}

/**
 * FIXED: SYNCHRONOUS CHAIN REACTION PROCESSOR
 * Handles intraLink execution synchronously for tests and predictable behavior
 */
export const processChainReaction = async (
  originActionId: string,
  chainId: string,
  chainPayload?: ActionPayload
): Promise<{ok: boolean; chainExecuted: boolean; error?: string}> => {
  try {
    log.debug(`🔗 Processing chain reaction: ${originActionId} -> ${chainId}`)

    // Get the linked action
    const {io} = await import('../context/state')
    const linkedAction = io.get(chainId)

    if (!linkedAction) {
      log.warn(`⚠️ Chain reaction failed: action '${chainId}' not found`)
      return {ok: false, chainExecuted: false, error: 'Action not found'}
    }

    // Execute the chain with its own timer and metrics
    const chainResponse = await executeCompiledAction(
      linkedAction,
      chainPayload || linkedAction.payload
    )

    // FIXED: Process nested chains recursively if present
    if (chainResponse.ok && chainResponse.metadata?.intraLink) {
      await processChainReaction(
        chainId,
        chainResponse.metadata.intraLink.id,
        chainResponse.metadata.intraLink.payload
      )
    }

    log.debug(`✅ Chain reaction completed: ${originActionId} -> ${chainId}`)
    return {
      ok: chainResponse.ok,
      chainExecuted: true,
      error: chainResponse.ok ? undefined : chainResponse.error
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(
      `❌ Chain reaction failed: ${originActionId} -> ${chainId}: ${errorMessage}`
    )
    return {ok: false, chainExecuted: false, error: errorMessage}
  }
}

/**
 * 📊 GET LIGHTWEIGHT EXECUTION STATISTICS
 */
export const getExecutionStats = () => {
  const totalExecutions = executionStats.totalExecutions || 1
  const fastPathPercentage =
    (executionStats.fastPathExecutions / totalExecutions) * 100
  const timekeeperPercentage =
    (executionStats.timekeeperExecutions / totalExecutions) * 100
  const pipelinePercentage =
    (executionStats.pipelineExecutions / totalExecutions) * 100

  return {
    ...executionStats,
    percentages: {
      fastPath: fastPathPercentage,
      pipeline: pipelinePercentage,
      timekeeper: timekeeperPercentage
    }
  }
}

/**
 * 🔄 RESET EXECUTION STATISTICS (for testing)
 */
export const resetExecutionStats = (): void => {
  Object.keys(executionStats).forEach(key => {
    executionStats[key as keyof typeof executionStats] = 0
  })
}

/**
 * 📈 LIGHTWEIGHT PERFORMANCE ANALYSIS
 */
export const getPerformanceAnalysis = () => {
  const stats = getExecutionStats()
  const insights: string[] = []
  const recommendations: string[] = []

  if (stats.percentages.fastPath > 80) {
    insights.push(
      '🚀 High fast-path usage detected - excellent performance profile'
    )
  } else if (stats.percentages.fastPath < 30) {
    insights.push(
      '⚠️ Low fast-path usage - consider simplifying action configurations'
    )
    recommendations.push(
      'Remove unnecessary protections from frequently called actions'
    )
  }

  if (stats.percentages.timekeeper > 50) {
    insights.push(
      '⏱️ High timekeeper usage - many actions use intervals/delays/repeats'
    )
  }

  return {
    stats,
    insights,
    recommendations
  }
}

/**
 * 🔧 DEVELOPMENT AND DEBUG HELPERS
 */
export const executionDebugHelpers = {
  getStats: getExecutionStats,
  resetStats: resetExecutionStats,
  analyze: getPerformanceAnalysis,
  requiresTimekeeper
}
