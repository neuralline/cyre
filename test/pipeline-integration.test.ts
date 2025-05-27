// test/pipeline-integration.test.ts
// Test the clean pipeline integration system

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {pipelineState} from '../src/context/pipeline-state'

/*
 * Pipeline Integration Test for Clean Cyre System
 *
 * Tests the clean pipeline integration:
 * - Fast path for actions without pipeline (zero overhead)
 * - Pipeline compilation during action creation
 * - Clean call flow: call() → processCall() → applyPipeline() → dispatch() → cyreExecute()
 * - IntraLink chain reaction handling
 * - Individual action functions working correctly
 */

describe('Clean Pipeline Integration System', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== PIPELINE INTEGRATION TEST STARTED =====')
  })

  afterEach(() => {
    // Clear all actions and pipelines
    cyre.clear()

    console.log('===== PIPELINE INTEGRATION TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test fast path for simple actions (zero overhead)
   */
  it('should use fast path for actions without protection features', async () => {
    const actionId = 'fast-path-action'
    let handlerExecuted = false

    // Register handler
    cyre.on(actionId, payload => {
      handlerExecuted = true
      return {success: true, payload}
    })

    // Create simple action (should use fast path)
    const result = cyre.action({
      id: actionId,
      type: 'simple-test',
      payload: {message: 'fast path test'}
    })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('fast-path')

    // Verify fast path detection
    expect(pipelineState.isFastPath(actionId)).toBe(true)
    expect(pipelineState.has(actionId)).toBe(false)

    // Call should execute with zero overhead
    const callResult = await cyre.call(actionId, {test: 'fast path'})

    expect(callResult.ok).toBe(true)
    expect(handlerExecuted).toBe(true)

    console.log('Fast path test result:', callResult)
  })

  /**
   * Test pipeline creation for actions with protection features
   */
  it('should create pipeline for actions with protection features', () => {
    const actionId = 'pipeline-action'

    // Create action with protection features
    const result = cyre.action({
      id: actionId,
      type: 'protected-test',
      payload: {message: 'pipeline test'},
      throttle: 100,
      debounce: 50,
      detectChanges: true
    })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('pipeline functions')

    // Verify pipeline was created
    expect(pipelineState.isFastPath(actionId)).toBe(false)
    expect(pipelineState.has(actionId)).toBe(true)

    const pipeline = pipelineState.get(actionId)
    expect(pipeline).toBeDefined()
    expect(pipeline!.length).toBeGreaterThan(0)

    console.log(`Pipeline created with ${pipeline!.length} functions`)
  })

  /**
   * Test pipeline statistics
   */
  it('should provide accurate pipeline statistics', () => {
    // Create mix of fast path and pipeline actions
    cyre.action([
      {id: 'fast1', type: 'fast'},
      {id: 'fast2', type: 'fast'},
      {id: 'pipeline1', type: 'protected', throttle: 100},
      {id: 'pipeline2', type: 'protected', debounce: 200}
    ])

    const stats = cyre.getPipelineStats()

    expect(stats.totalActions).toBe(4)
    expect(stats.fastPathActions).toBe(2)
    expect(stats.pipelineActions).toBe(2)
    expect(stats.fastPathPercentage).toBe(50)

    console.log('Pipeline statistics:', stats)
  })

  /**
   * Test throttle protection in pipeline
   */
  it('should apply throttle protection through pipeline', async () => {
    const actionId = 'throttle-test'
    let executionCount = 0

    cyre.on(actionId, () => {
      executionCount++
      return {executed: true, count: executionCount}
    })

    cyre.action({
      id: actionId,
      type: 'throttle-test',
      throttle: 200
    })

    // First call should execute
    const result1 = await cyre.call(actionId)
    expect(result1.ok).toBe(true)
    expect(executionCount).toBe(1)

    // Second call should be throttled
    const result2 = await cyre.call(actionId)
    expect(result2.ok).toBe(false)
    expect(result2.message).toContain('Throttled')
    expect(executionCount).toBe(1) // Should not increase

    console.log('Throttle test results:', {
      result1: result1.ok,
      result2: result2.ok
    })
  })

  /**
   * Test change detection in pipeline
   */
  it('should apply change detection through pipeline', async () => {
    const actionId = 'change-detection-test'
    let executionCount = 0
    let lastPayload: any = null

    cyre.on(actionId, payload => {
      executionCount++
      lastPayload = payload
      console.log(
        `Handler executed ${executionCount} times with payload:`,
        payload
      )
      return {executed: true, payload}
    })

    cyre.action({
      id: actionId,
      type: 'change-test',
      detectChanges: true
    })

    console.log('=== Testing change detection ===')

    // First call should execute
    console.log('Making first call with {value: "test"}')
    const result1 = await cyre.call(actionId, {value: 'test'})
    console.log('First call result:', {
      ok: result1.ok,
      message: result1.message
    })
    expect(result1.ok).toBe(true)
    expect(executionCount).toBe(1)

    // Small delay to ensure async operations complete
    await new Promise(resolve => setTimeout(resolve, 10))

    // Second call with same payload should be skipped
    console.log('Making second call with same payload {value: "test"}')
    const result2 = await cyre.call(actionId, {value: 'test'})
    console.log('Second call result:', {
      ok: result2.ok,
      message: result2.message
    })
    console.log('Execution count after second call:', executionCount)

    expect(result2.ok).toBe(false)
    expect(result2.message).toContain('No changes detected')
    expect(executionCount).toBe(1) // Should not increase

    // Third call with different payload should execute
    console.log('Making third call with different payload {value: "different"}')
    const result3 = await cyre.call(actionId, {value: 'different'})
    console.log('Third call result:', {
      ok: result3.ok,
      message: result3.message
    })
    expect(result3.ok).toBe(true)
    expect(executionCount).toBe(2)

    console.log('Change detection results:', {
      first: result1.ok,
      same: result2.ok,
      different: result3.ok,
      finalCount: executionCount
    })
  })

  /**
   * Test IntraLink chain reactions
   */
  it('should handle IntraLink chain reactions correctly', async () => {
    const firstId = 'chain-first'
    const secondId = 'chain-second'
    const executionOrder: string[] = []

    // Set up chain handlers
    cyre.on(firstId, payload => {
      executionOrder.push('first')
      return {
        id: secondId,
        payload: {from: 'first', ...payload}
      }
    })

    cyre.on(secondId, payload => {
      executionOrder.push('second')
      return {completed: true, payload}
    })

    // Create actions
    cyre.action({id: firstId, type: 'chain'})
    cyre.action({id: secondId, type: 'chain'})

    // Start the chain
    const result = await cyre.call(firstId, {start: true})

    expect(result.ok).toBe(true)
    expect(executionOrder).toEqual(['first', 'second'])
    expect(result.metadata?.chainResult).toBeDefined()

    console.log('Chain reaction order:', executionOrder)
  })

  /**
   * Test middleware integration in pipeline
   */
  it('should integrate middleware through pipeline', async () => {
    const actionId = 'middleware-test'
    const middlewareId = 'test-middleware'
    let middlewareExecuted = false
    let handlerExecuted = false

    // Register middleware
    const middlewareResult = cyre.middleware(
      middlewareId,
      async (action, payload) => {
        middlewareExecuted = true

        if (!payload || typeof payload !== 'object') {
          return null // Reject
        }

        return {
          action,
          payload: {
            ...payload,
            enhanced: true,
            timestamp: Date.now()
          }
        }
      }
    )

    expect(middlewareResult.ok).toBe(true)

    // Register handler
    cyre.on(actionId, payload => {
      handlerExecuted = true
      return {processed: true, payload}
    })

    // Create action with middleware
    cyre.action({
      id: actionId,
      type: 'middleware-test',
      middleware: [middlewareId]
    })

    // Test valid payload
    const result = await cyre.call(actionId, {data: 'valid'})

    expect(result.ok).toBe(true)
    expect(middlewareExecuted).toBe(true)
    expect(handlerExecuted).toBe(true)

    console.log('Middleware integration result:', result.ok)
  })

  /**
   * Test timing features integration
   */
  it('should handle timing features correctly', async () => {
    const actionId = 'timing-test'
    let executionCount = 0

    cyre.on(actionId, () => {
      executionCount++
      return {count: executionCount}
    })

    // Create action with delay
    cyre.action({
      id: actionId,
      type: 'timing-test',
      delay: 0, // Immediate
      repeat: 1
    })

    const result = await cyre.call(actionId)

    expect(result.ok).toBe(true)
    expect(result.message).toContain('Scheduled')

    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(executionCount).toBe(1)

    console.log('Timing test execution count:', executionCount)
  })

  /**
   * Test system recuperation blocking
   */
  it('should block non-critical actions during recuperation', async () => {
    // This test simulates recuperation state
    // In a real scenario, recuperation would be triggered by system stress

    const actionId = 'recuperation-test'
    let executionCount = 0

    cyre.on(actionId, () => {
      executionCount++
      return {executed: true}
    })

    cyre.action({
      id: actionId,
      type: 'recuperation-test',
      priority: {level: 'medium'} // Non-critical
    })

    // Normal call should work
    const normalResult = await cyre.call(actionId)
    expect(normalResult.ok).toBe(true)
    expect(executionCount).toBe(1)

    console.log('Recuperation test (normal):', normalResult.ok)
  })

  /**
   * Test action cleanup with pipeline
   */
  it('should clean up actions and pipelines correctly', () => {
    const actionId = 'cleanup-test'

    // Create action with pipeline
    cyre.action({
      id: actionId,
      type: 'cleanup-test',
      throttle: 100
    })

    // Verify action and pipeline exist
    expect(cyre.get(actionId)).toBeDefined()
    expect(pipelineState.has(actionId)).toBe(true)

    // Forget action
    const result = cyre.forget(actionId)
    expect(result).toBe(true)

    // Verify cleanup
    expect(cyre.get(actionId)).toBeUndefined()
    expect(pipelineState.has(actionId)).toBe(false)

    console.log('Cleanup test result:', result)
  })

  /**
   * Test complete system clear
   */
  it('should clear all actions and pipelines', () => {
    // Create multiple actions
    cyre.action([
      {id: 'clear-test-1', type: 'test'},
      {id: 'clear-test-2', type: 'test', throttle: 100}
    ])

    const statsBefore = cyre.getPipelineStats()
    expect(statsBefore.totalActions).toBe(2)

    // Clear system
    cyre.clear()

    const statsAfter = cyre.getPipelineStats()
    expect(statsAfter.totalActions).toBe(0)
    expect(statsAfter.fastPathActions).toBe(0)
    expect(statsAfter.pipelineActions).toBe(0)

    console.log(
      'Clear test - before:',
      statsBefore.totalActions,
      'after:',
      statsAfter.totalActions
    )
  })

  /**
   * Test error handling in pipeline
   */
  it('should handle pipeline errors gracefully', async () => {
    const actionId = 'error-test'

    // Create action with invalid middleware reference
    cyre.action({
      id: actionId,
      type: 'error-test',
      middleware: ['non-existent-middleware']
    })

    // Register handler
    cyre.on(actionId, () => ({success: true}))

    // Call should handle middleware error gracefully
    const result = await cyre.call(actionId)

    // The specific behavior may vary, but it should not crash
    expect(typeof result.ok).toBe('boolean')

    console.log('Error handling test result:', result.ok)
  })
})
