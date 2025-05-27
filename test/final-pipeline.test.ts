// test/final-pipeline.test.ts
// Complete test of the fixed pipeline system

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {pipelineState} from '../src/context/pipeline-state'

describe('Fixed Pipeline System', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    cyre.initialize()
  })

  afterEach(() => {
    cyre.clear()
    vi.restoreAllMocks()
  })

  it('should use fast path for truly simple actions', () => {
    const result = cyre.action({
      id: 'truly-simple',
      type: 'test',
      payload: {data: true}
    })

    console.log('Simple action result:', result.message)

    expect(result.ok).toBe(true)
    expect(result.message).toContain('fast-path')
    expect(pipelineState.isFastPath('truly-simple')).toBe(true)
    expect(pipelineState.has('truly-simple')).toBe(false)
  })

  it('should create pipeline for protected actions', () => {
    const result = cyre.action({
      id: 'protected-action',
      type: 'test',
      throttle: 100,
      detectChanges: true
    })

    console.log('Protected action result:', result.message)

    expect(result.ok).toBe(true)
    expect(result.message).toContain('pipeline functions')
    expect(pipelineState.isFastPath('protected-action')).toBe(false)
    expect(pipelineState.has('protected-action')).toBe(true)
  })

  it('should provide accurate statistics', () => {
    cyre.action([
      {id: 'simple1', type: 'test'},
      {id: 'simple2', type: 'test'},
      {id: 'throttled', type: 'test', throttle: 100},
      {id: 'debounced', type: 'test', debounce: 200}
    ])

    const stats = cyre.getPipelineStats()
    console.log('Pipeline stats:', stats)

    expect(stats.totalActions).toBe(4)
    expect(stats.fastPathActions).toBe(2)
    expect(stats.pipelineActions).toBe(2)
    expect(stats.fastPathPercentage).toBe(50)
  })

  it('should properly handle change detection', async () => {
    let executionCount = 0

    cyre.on('change-test', payload => {
      executionCount++
      console.log(`Handler execution ${executionCount}:`, payload)
      return {count: executionCount}
    })

    cyre.action({
      id: 'change-test',
      type: 'test',
      detectChanges: true
    })

    // First call should execute
    const result1 = await cyre.call('change-test', {value: 'first'})
    expect(result1.ok).toBe(true)
    expect(executionCount).toBe(1)

    // Second call with same payload should be blocked
    const result2 = await cyre.call('change-test', {value: 'first'})
    console.log('Second call result:', {
      ok: result2.ok,
      message: result2.message
    })
    expect(result2.ok).toBe(false)
    expect(result2.message).toContain('No changes detected')
    expect(executionCount).toBe(1) // Should not increase

    // Third call with different payload should execute
    const result3 = await cyre.call('change-test', {value: 'different'})
    expect(result3.ok).toBe(true)
    expect(executionCount).toBe(2)
  })

  it('should handle throttling correctly', async () => {
    let executionCount = 0

    cyre.on('throttle-test', () => {
      executionCount++
      return {count: executionCount}
    })

    cyre.action({
      id: 'throttle-test',
      type: 'test',
      throttle: 100
    })

    // First call should execute
    const result1 = await cyre.call('throttle-test')
    expect(result1.ok).toBe(true)
    expect(executionCount).toBe(1)

    // Second call should be throttled
    const result2 = await cyre.call('throttle-test')
    expect(result2.ok).toBe(false)
    expect(result2.message).toContain('Throttled')
    expect(executionCount).toBe(1) // Should not increase
  })

  it('should handle chain reactions', async () => {
    const executionOrder: string[] = []

    cyre.on('chain-1', () => {
      executionOrder.push('first')
      return {id: 'chain-2', payload: {chained: true}}
    })

    cyre.on('chain-2', payload => {
      executionOrder.push('second')
      return {completed: true, payload}
    })

    cyre.action([
      {id: 'chain-1', type: 'chain'},
      {id: 'chain-2', type: 'chain'}
    ])

    const result = await cyre.call('chain-1', {start: true})

    expect(result.ok).toBe(true)
    expect(executionOrder).toEqual(['first', 'second'])
  })
})
