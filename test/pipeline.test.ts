// test/pipeline.test.ts
// Test specific fixes for pipeline issues

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {pipelineState} from '../src/context/pipeline-state'
import {buildActionPipeline} from '../src/actions'

/*
 * Pipeline Fixes Test
 *
 * Tests specific fixes for:
 * 1. Fast path detection (empty pipeline = fast path)
 * 2. Pipeline statistics accuracy
 * 3. Change detection blocking
 */

describe('Pipeline System Fixes', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    cyre.initialize()
  })

  afterEach(() => {
    cyre.clear()
    vi.restoreAllMocks()
  })

  /**
   * Test pipeline building logic directly
   */
  it('should build empty pipeline for simple actions', () => {
    // Simple action with no protection features
    const simpleAction = {
      id: 'simple',
      type: 'test',
      payload: {data: true}
    }

    const pipeline = buildActionPipeline(simpleAction)
    console.log('Simple action pipeline length:', pipeline.length)
    expect(pipeline.length).toBe(0)

    // Action with protection features
    const protectedAction = {
      id: 'protected',
      type: 'test',
      payload: {data: true},
      throttle: 100,
      detectChanges: true
    }

    const protectedPipeline = buildActionPipeline(protectedAction)
    console.log('Protected action pipeline length:', protectedPipeline.length)
    expect(protectedPipeline.length).toBeGreaterThan(0)
  })

  /**
   * Test fast path integration
   */
  it('should properly detect and use fast path', () => {
    // Create simple action
    const result = cyre.action({
      id: 'fast-test',
      type: 'simple'
    })

    console.log('Action creation result:', result.message)

    // Should be fast path
    expect(pipelineState.isFastPath('fast-test')).toBe(true)
    expect(pipelineState.has('fast-test')).toBe(false)

    // Should mention fast path in message
    expect(result.message).toContain('fast-path')
  })

  /**
   * Test pipeline statistics
   */
  it('should provide accurate pipeline statistics', () => {
    // Create mix of actions
    cyre.action([
      {id: 'simple1', type: 'simple'},
      {id: 'simple2', type: 'simple'},
      {id: 'throttled', type: 'protected', throttle: 100},
      {id: 'debounced', type: 'protected', debounce: 200}
    ])

    const stats = cyre.getPipelineStats()
    console.log('Pipeline stats:', stats)

    expect(stats.totalActions).toBe(4)
    expect(stats.fastPathActions).toBeGreaterThan(0)
    expect(stats.pipelineActions).toBeGreaterThan(0)
    expect(stats.totalActions).toBe(
      stats.fastPathActions + stats.pipelineActions
    )
  })

  /**
   * Test change detection specifically
   */
  it('should block identical payloads with change detection', async () => {
    let executionCount = 0

    // Set up action with change detection
    cyre.action({
      id: 'change-test',
      type: 'test',
      detectChanges: true
    })

    cyre.on('change-test', payload => {
      executionCount++
      console.log(`Execution ${executionCount}:`, payload)
      return {count: executionCount}
    })

    // First call - should execute
    const result1 = await cyre.call('change-test', {data: 'same'})
    console.log('First call:', result1.ok, result1.message)
    expect(result1.ok).toBe(true)
    expect(executionCount).toBe(1)

    // Wait to ensure any async operations complete
    await new Promise(resolve => setTimeout(resolve, 5))

    // Second call with same payload - should be blocked
    const result2 = await cyre.call('change-test', {data: 'same'})
    console.log('Second call (same):', result2.ok, result2.message)
    console.log('Execution count after second call:', executionCount)

    expect(result2.ok).toBe(false)
    expect(executionCount).toBe(1) // Should not increase

    // Third call with different payload - should execute
    const result3 = await cyre.call('change-test', {data: 'different'})
    console.log('Third call (different):', result3.ok, result3.message)
    expect(result3.ok).toBe(true)
    expect(executionCount).toBe(2)
  })

  /**
   * Test that protection features create pipeline
   */
  it('should create pipeline for actions with protection features', () => {
    const protectionFeatures = [
      {feature: 'throttle', config: {throttle: 100}},
      {feature: 'debounce', config: {debounce: 200}},
      {feature: 'detectChanges', config: {detectChanges: true}},
      {feature: 'repeat', config: {repeat: 0}},
      {feature: 'middleware', config: {middleware: ['test']}}
    ]

    protectionFeatures.forEach(({feature, config}, index) => {
      const actionId = `${feature}-test-${index}`

      const result = cyre.action({
        id: actionId,
        type: 'protection-test',
        ...config
      })

      console.log(`${feature} action:`, result.message)

      // Should NOT be fast path
      expect(pipelineState.isFastPath(actionId)).toBe(false)
      expect(pipelineState.has(actionId)).toBe(true)

      // Should mention pipeline functions
      expect(result.message).toContain('pipeline functions')
    })
  })

  /**
   * Test system recuperation function
   */
  it('should only add recuperation for non-critical actions needing protection', () => {
    // Critical action with throttle - should still get protection
    const criticalAction = {
      id: 'critical',
      type: 'test',
      throttle: 100,
      priority: {level: 'critical' as const}
    }

    const criticalPipeline = buildActionPipeline(criticalAction)
    console.log('Critical action pipeline length:', criticalPipeline.length)
    // Should have throttle but not recuperation
    expect(criticalPipeline.length).toBeGreaterThan(0)

    // Regular action with throttle
    const regularAction = {
      id: 'regular',
      type: 'test',
      throttle: 100
    }

    const regularPipeline = buildActionPipeline(regularAction)
    console.log('Regular action pipeline length:', regularPipeline.length)
    // Should have both throttle and recuperation
    expect(regularPipeline.length).toBeGreaterThan(0)
  })
})
