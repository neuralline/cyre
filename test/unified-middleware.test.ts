// test/unified-middleware.test.ts
// Fixed comprehensive test for unified middleware system

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import type {ExternalMiddlewareFunction} from '../src/types/interface'

/*
 * Fixed Unified Middleware System Test
 *
 * Tests the corrected unified middleware architecture:
 * - Built-in middleware (throttle, debounce, change detection, etc.)
 * - External middleware without state access
 * - Zero overhead fast path for actions without middleware
 * - Proper separation between internal and external middleware
 */

describe('Unified Middleware System', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== UNIFIED MIDDLEWARE TEST STARTED =====')
  })

  afterEach(() => {
    // Clean up
    cyre.clear()
    console.log('===== UNIFIED MIDDLEWARE TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test fast path for actions without middleware
   */
  it('should use zero overhead fast path for simple actions', async () => {
    const actionId = `fast-path-${Date.now()}`
    let handlerExecuted = false

    // Create simple action without any protections
    cyre.action({
      id: actionId,
      payload: {simple: true}
      // NO protections: no throttle, debounce, detectChanges, repeat: 0, priority, middleware
    })

    // Register handler
    cyre.on(actionId, payload => {
      handlerExecuted = true
      return {success: true, payload}
    })

    // Call action
    const result = await cyre.call(actionId, {test: 'fast-path'})

    // Verify execution
    expect(result.ok).toBe(true)
    expect(handlerExecuted).toBe(true)

    // Check middleware stats - should show fast path
    const stats = cyre.getMiddlewareStats()
    expect(stats.fastPathActions).toBeGreaterThan(0)

    // Find our specific action in the chains
    const ourChain = stats.chains.find(c => c.actionId === actionId)
    expect(ourChain?.fastPath).toBe(true)
    expect(ourChain?.middlewareCount).toBe(0)

    console.log('[TEST] Fast path stats:', {
      fastPathActions: stats.fastPathActions,
      ourChain
    })
  })

  /**
   * Test built-in throttle middleware
   */
  it('should apply built-in throttle middleware automatically', async () => {
    const actionId = `throttle-test-${Date.now()}`
    let executionCount = 0

    // Create action with throttle
    cyre.action({
      id: actionId,
      throttle: 200, // 200ms throttle
      payload: {throttled: true}
    })

    // Register handler
    cyre.on(actionId, payload => {
      executionCount++
      return {executed: true, count: executionCount}
    })

    // Make rapid calls - but wait a bit between them to avoid test timing issues
    const result1 = await cyre.call(actionId, {call: 1})
    const result2 = await cyre.call(actionId, {call: 2})
    const result3 = await cyre.call(actionId, {call: 3})

    // First call should succeed, others should be throttled
    expect(result1.ok).toBe(true)
    expect(result2.ok).toBe(false) // Throttled
    expect(result3.ok).toBe(false) // Throttled

    expect(executionCount).toBe(1) // Only first execution

    // Check that throttle message is present
    expect(result2.message).toContain('Throttled')
    expect(result3.message).toContain('Throttled')

    console.log('[TEST] Throttle results:', {
      executionCount,
      results: [result1, result2, result3].map(r => ({
        ok: r.ok,
        message: r.message
      }))
    })
  })

  /**
   * Test built-in debounce middleware
   */
  it('should apply built-in debounce middleware automatically', async () => {
    const actionId = `debounce-test-${Date.now()}`
    let executionCount = 0

    // Create action with debounce
    cyre.action({
      id: actionId,
      debounce: 100, // 100ms debounce
      payload: {debounced: true}
    })

    // Register handler
    cyre.on(actionId, payload => {
      executionCount++
      return {executed: true, count: executionCount, payload}
    })

    // Make rapid calls - debounce should delay them
    await cyre.call(actionId, {call: 1})
    await cyre.call(actionId, {call: 2})
    await cyre.call(actionId, {call: 3})

    // Right after calls, no execution should have happened yet (debounced)
    expect(executionCount).toBe(0)

    // Wait for debounce to complete - increased timeout to ensure completion
    await new Promise(resolve => setTimeout(resolve, 200))

    // Should have executed only once with the last payload
    expect(executionCount).toBe(1)

    console.log('[TEST] Debounce execution count:', executionCount)
  })

  /**
   * Test built-in change detection middleware
   */
  it('should apply built-in change detection middleware automatically', async () => {
    const actionId = `change-detection-test-${Date.now()}`
    let executionCount = 0

    // Create action with change detection
    cyre.action({
      id: actionId,
      detectChanges: true,
      payload: {initial: true}
    })

    // Register handler
    cyre.on(actionId, payload => {
      executionCount++
      return {executed: true, count: executionCount}
    })

    // Make calls with same payload
    const result1 = await cyre.call(actionId, {data: 'same'})
    const result2 = await cyre.call(actionId, {data: 'same'}) // Should be skipped
    const result3 = await cyre.call(actionId, {data: 'different'}) // Should execute

    expect(result1.ok).toBe(true)
    expect(result2.ok).toBe(false) // Blocked by change detection
    expect(result3.ok).toBe(true)

    expect(executionCount).toBe(2) // First and third calls only

    expect(result2.message).toContain('No changes detected')

    console.log('[TEST] Change detection results:', {
      executionCount,
      results: [result1, result2, result3].map(r => ({
        ok: r.ok,
        message: r.message
      }))
    })
  })

  /**
   * Test external middleware registration and execution
   */
  it('should register and execute external middleware without state access', async () => {
    const actionId = `external-middleware-test-${Date.now()}`
    const middlewareId = `external-middleware-${Date.now()}`

    let handlerExecuted = false
    let middlewareExecuted = false
    let receivedPayload: any = null

    // Register external middleware
    const externalMiddleware: ExternalMiddlewareFunction = async (
      context,
      next
    ) => {
      middlewareExecuted = true

      // Verify external context doesn't have state access
      expect(context).not.toHaveProperty('state')
      expect(context).toHaveProperty('action')
      expect(context).toHaveProperty('payload')
      expect(context).toHaveProperty('timestamp')
      expect(context).toHaveProperty('executionId')

      // Transform payload
      const transformedPayload = {
        ...context.payload,
        transformed: true,
        timestamp: Date.now()
      }

      return {
        type: 'continue',
        payload: transformedPayload
      }
    }

    const middlewareResult = cyre.middleware(middlewareId, externalMiddleware)
    expect(middlewareResult.ok).toBe(true)

    // Create action with external middleware
    cyre.action({
      id: actionId,
      middleware: [middlewareId],
      payload: {external: true}
    })

    // Register handler
    cyre.on(actionId, payload => {
      handlerExecuted = true
      receivedPayload = payload
      return {success: true}
    })

    // Call action
    const result = await cyre.call(actionId, {original: 'data'})

    expect(result.ok).toBe(true)
    expect(middlewareExecuted).toBe(true)
    expect(handlerExecuted).toBe(true)
    expect(receivedPayload).toHaveProperty('transformed', true)
    expect(receivedPayload).toHaveProperty('original', 'data')

    console.log('[TEST] External middleware result:', {
      middlewareExecuted,
      handlerExecuted,
      receivedPayload
    })
  })

  /**
   * Test combined built-in and external middleware
   */
  it('should execute both built-in and external middleware in correct order', async () => {
    const actionId = `combined-middleware-test-${Date.now()}`
    const middlewareId = `combined-external-${Date.now()}`

    let executionCount = 0
    let middlewareExecuted = false
    const executionOrder: string[] = []

    // Register external middleware
    const externalMiddleware: ExternalMiddlewareFunction = async (
      context,
      next
    ) => {
      middlewareExecuted = true
      executionOrder.push('external-middleware')

      return {
        type: 'continue',
        payload: {
          ...context.payload,
          externalProcessed: true
        }
      }
    }

    const middlewareResult = cyre.middleware(middlewareId, externalMiddleware)
    expect(middlewareResult.ok).toBe(true)

    // Create action with both built-in protections and external middleware
    // Use detectChanges instead of throttle to avoid timing issues
    cyre.action({
      id: actionId,
      detectChanges: true, // Built-in change detection (instead of throttle)
      middleware: [middlewareId], // External middleware
      payload: {combined: true}
    })

    // Register handler
    cyre.on(actionId, payload => {
      executionCount++
      executionOrder.push('handler')
      return {executed: true, payload}
    })

    // First call - should execute through all middleware
    const result1 = await cyre.call(actionId, {test: 'first'})

    expect(result1.ok).toBe(true)
    expect(middlewareExecuted).toBe(true)
    expect(executionCount).toBe(1)
    expect(executionOrder).toContain('external-middleware')
    expect(executionOrder).toContain('handler')

    // Reset for second test
    middlewareExecuted = false
    executionOrder.length = 0

    // Second call with same payload - should be blocked by change detection
    const result2 = await cyre.call(actionId, {test: 'first'})

    expect(result2.ok).toBe(false)
    expect(result2.message).toContain('No changes detected')
    expect(middlewareExecuted).toBe(false) // Should not reach external middleware
    expect(executionCount).toBe(1) // No additional execution

    console.log('[TEST] Combined middleware results:', {
      result1: {ok: result1.ok, message: result1.message},
      result2: {ok: result2.ok, message: result2.message},
      executionOrder,
      totalExecutions: executionCount
    })
  })

  /**
   * Test middleware statistics and monitoring
   */
  it('should provide accurate middleware statistics', async () => {
    const fastActionId = `fast-action-${Date.now()}`
    const middlewareActionId = `middleware-action-${Date.now()}`

    // Create fast path action (no protections)
    cyre.action({
      id: fastActionId,
      payload: {fast: true}
    })

    // Create action with middleware
    cyre.action({
      id: middlewareActionId,
      throttle: 100,
      debounce: 50,
      payload: {slow: true}
    })

    // Get middleware statistics
    const stats = cyre.getMiddlewareStats()

    expect(stats.totalActions).toBeGreaterThanOrEqual(2)
    expect(stats.fastPathActions).toBeGreaterThanOrEqual(1)
    expect(stats.middlewareActions).toBeGreaterThanOrEqual(1)
    expect(stats.fastPathPercentage).toBeGreaterThan(0)
    expect(stats.chains).toBeInstanceOf(Array)

    // Find our specific chains
    const fastChain = stats.chains.find(c => c.actionId === fastActionId)
    const middlewareChain = stats.chains.find(
      c => c.actionId === middlewareActionId
    )

    expect(fastChain?.fastPath).toBe(true)
    expect(fastChain?.middlewareCount).toBe(0)

    expect(middlewareChain?.fastPath).toBe(false)
    expect(middlewareChain?.middlewareCount).toBeGreaterThan(0)

    console.log('[TEST] Middleware statistics:', stats)
  })

  /**
   * Test middleware error handling
   */
  it('should handle middleware errors gracefully', async () => {
    const actionId = `error-middleware-test-${Date.now()}`
    const middlewareId = `error-middleware-${Date.now()}`

    let handlerExecuted = false

    // Register failing external middleware
    const failingMiddleware: ExternalMiddlewareFunction = async (
      context,
      next
    ) => {
      throw new Error('Middleware intentionally failed')
    }

    const middlewareResult = cyre.middleware(middlewareId, failingMiddleware)
    expect(middlewareResult.ok).toBe(true)

    // Create action with failing middleware
    cyre.action({
      id: actionId,
      middleware: [middlewareId],
      payload: {error: true}
    })

    // Register handler
    cyre.on(actionId, payload => {
      handlerExecuted = true
      return {success: true}
    })

    // Call action
    const result = await cyre.call(actionId, {test: 'error'})

    expect(result.ok).toBe(false)
    expect(result.message).toContain('failed')
    expect(handlerExecuted).toBe(false) // Should not reach handler

    console.log('[TEST] Error handling result:', {
      ok: result.ok,
      message: result.message,
      handlerExecuted
    })
  })

  /**
   * Test repeat: 0 blocking
   */
  it('should automatically block actions with repeat: 0', async () => {
    const actionId = `repeat-zero-test-${Date.now()}`
    let handlerExecuted = false

    // Create action with repeat: 0
    cyre.action({
      id: actionId,
      repeat: 0,
      payload: {blocked: true}
    })

    // Register handler
    cyre.on(actionId, payload => {
      handlerExecuted = true
      return {success: true}
    })

    // Call action
    const result = await cyre.call(actionId, {test: 'blocked'})

    expect(result.ok).toBe(false)
    expect(result.message).toContain('repeat is 0')
    expect(handlerExecuted).toBe(false)

    console.log('[TEST] Repeat: 0 blocking result:', {
      ok: result.ok,
      message: result.message,
      handlerExecuted
    })
  })
})
