// test/action-pipeline.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {
  buildProtectionPipeline,
  executeProtectionPipeline
} from '../src/components/cyre-actions'

describe('Action pipeline', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Test that pipelines are built correctly
   */
  it('should build action pipeline based on action configuration', () => {
    // Define actions with different protection combinations
    const actions = [
      {id: 'basic-action', type: 'test'},
      {id: 'throttle-action', type: 'test', throttle: 100},
      {id: 'debounce-action', type: 'test', debounce: 100},
      {id: 'change-action', type: 'test', detectChanges: true},
      {
        id: 'all-protections',
        type: 'test',
        throttle: 100,
        debounce: 100,
        detectChanges: true,
        middleware: ['test']
      }
    ]

    // Build pipelines for each action
    const pipelines = actions.map(action => ({
      id: action.id,
      pipeline: buildProtectionPipeline(action)
    }))

    // Verify pipeline lengths match protection counts
    // Base pipeline always has at least 2 functions (recuperation and repeat:0)
    expect(pipelines[0].pipeline.length).toBe(2) // basic has only system protections
    expect(pipelines[1].pipeline.length).toBe(3) // throttle adds 1 protection
    expect(pipelines[2].pipeline.length).toBe(3) // debounce adds 1 protection
    expect(pipelines[3].pipeline.length).toBe(3) // change detection adds 1 protection
    expect(pipelines[4].pipeline.length).toBe(6) // all protections

    // Verify pipeline function names for one case
    const allProtectionsPipeline = pipelines[4].pipeline
    const functionNames = allProtectionsPipeline.map(fn => (fn as any).name)

    // Should contain all protection functions
    expect(functionNames).toContain('recuperationProtection')
    expect(functionNames).toContain('repeatZeroProtection')
    expect(functionNames).toContain('throttleProtection')
    expect(functionNames).toContain('debounceProtection')
    expect(functionNames).toContain('changeDetectionProtection')
    expect(functionNames).toContain('middlewareProtection')
  })

  /**
   * Test pipeline execution
   */
  it('should execute action pipeline in correct order', async () => {
    // Create test action with a longer throttle time for clarity
    const action = {
      id: 'pipeline-test-action',
      type: 'test',
      throttle: 1000 // 1 second throttle
    }

    console.log('[TEST] Creating throttled action')

    // Register the action
    cyre.action(action)

    // Verify the action was registered properly
    const storedAction = cyre.get('pipeline-test-action')
    expect(storedAction).toBeDefined()
    expect(storedAction?.throttle).toBe(1000)
    expect(storedAction?._protectionPipeline).toBeDefined()

    // Register handler
    let executionCount = 0
    cyre.on('pipeline-test-action', payload => {
      console.log(`[TEST] Handler executed (count: ${++executionCount})`)
      return {executed: true, payload}
    })

    // First call should succeed
    console.log('[TEST] Making first call')
    const result = await cyre.call('pipeline-test-action', {test: true})

    // Print result for debugging
    console.log('[TEST] First call result:', result)

    expect(result.ok).toBe(true)
    expect(executionCount).toBe(1)

    // Short delay to ensure metrics are updated
    await new Promise(resolve => setTimeout(resolve, 10))

    // Immediate second call should be throttled
    console.log('[TEST] Making second call immediately')
    const secondResult = await cyre.call('pipeline-test-action', {test: true})

    // Print result for debugging
    console.log('[TEST] Second call result:', secondResult)

    // This is the failing assertion
    expect(secondResult.ok).toBe(false)
    expect(secondResult.message).toContain('Throttled')
    expect(executionCount).toBe(1) // Should still be 1 since second call was throttled
  })

  /**
   * Test that repeat:0 blocks execution
   */
  it('should prevent execution for actions with repeat:0', async () => {
    // Create test action with repeat:0
    cyre.action({
      id: 'repeat-zero-action',
      type: 'test',
      repeat: 0
    })

    // Track execution
    let executed = false

    // Register handler
    cyre.on('repeat-zero-action', () => {
      executed = true
      return {executed: true}
    })

    // Call the action
    const result = await cyre.call('repeat-zero-action', {test: true})

    // Should return ok but not execute handler
    expect(result.ok).toBe(true)
    expect(result.message).toContain('not executed')
    expect(executed).toBe(false)
  })

  /**
   * Test change detection protection
   */
  it('should skip execution when payload has not changed with detectChanges', async () => {
    // Create test action with change detection
    cyre.action({
      id: 'change-detection-action',
      type: 'test',
      detectChanges: true
    })

    // Track execution count
    let executionCount = 0

    // Register handler
    cyre.on('change-detection-action', payload => {
      executionCount++
      return {executed: true, count: executionCount}
    })

    // First call should execute
    await cyre.call('change-detection-action', {test: true})
    expect(executionCount).toBe(1)

    // Second call with same payload should be skipped
    const secondResult = await cyre.call('change-detection-action', {
      test: true
    })
    expect(secondResult.ok).toBe(true)
    expect(secondResult.message).toContain('No changes detected')
    expect(executionCount).toBe(1) // Still 1

    // Third call with different payload should execute
    await cyre.call('change-detection-action', {test: false})
    expect(executionCount).toBe(2)
  })
})
