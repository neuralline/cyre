// test/debug-pipeline.test.ts
// Debug specific pipeline issues

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {pipelineState} from '../src/context/pipeline-state'
import {buildActionPipeline} from '../src/actions'

describe('Debug Pipeline Issues', () => {
  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    cyre.initialize()
    console.log('=== TEST SETUP COMPLETE ===')
  })

  afterEach(() => {
    cyre.clear()
    vi.restoreAllMocks()
  })

  it('should debug pipeline building for simple action', () => {
    console.log('=== DEBUGGING SIMPLE ACTION PIPELINE ===')

    const simpleAction = {
      id: 'debug-simple',
      type: 'test',
      payload: {data: true}
    }

    console.log('Action config:', simpleAction)

    const pipeline = buildActionPipeline(simpleAction)
    console.log('Built pipeline functions:', pipeline.length)
    console.log(
      'Pipeline function names:',
      pipeline.map(f => f.name)
    )

    // Check conditions for fast path
    const needsProtection = !!(
      simpleAction.throttle ||
      simpleAction.debounce ||
      simpleAction.detectChanges ||
      (simpleAction.middleware && simpleAction.middleware.length > 0) ||
      simpleAction.repeat === 0 ||
      (simpleAction.priority?.level && simpleAction.priority.level !== 'medium')
    )

    console.log('Needs protection?', needsProtection)
    console.log('Should be empty pipeline?', !needsProtection)

    expect(pipeline.length).toBe(0)
  })

  it('should debug full action creation flow', () => {
    console.log('=== DEBUGGING ACTION CREATION FLOW ===')

    const result = cyre.action({
      id: 'debug-flow',
      type: 'test',
      payload: {simple: true}
    })

    console.log('Action creation result:', result)
    console.log('Is fast path?', pipelineState.isFastPath('debug-flow'))
    console.log('Has pipeline?', pipelineState.has('debug-flow'))

    const pipeline = pipelineState.get('debug-flow')
    console.log('Stored pipeline:', pipeline?.length || 'undefined')

    const stats = cyre.getPipelineStats()
    console.log('Current stats:', stats)
  })

  it('should debug change detection flow step by step', async () => {
    console.log('=== DEBUGGING CHANGE DETECTION ===')

    let executionCount = 0

    // Create action with change detection
    console.log('Creating action with detectChanges: true')
    const actionResult = cyre.action({
      id: 'debug-change',
      type: 'test',
      detectChanges: true
    })
    console.log('Action creation result:', actionResult)

    // Check pipeline
    const pipeline = pipelineState.get('debug-change')
    console.log('Pipeline functions:', pipeline?.length)
    console.log(
      'Pipeline function names:',
      pipeline?.map(f => f.name)
    )

    // Register handler with logging
    cyre.on('debug-change', payload => {
      executionCount++
      console.log(`>>> HANDLER EXECUTED ${executionCount} times with:`, payload)
      return {count: executionCount}
    })

    console.log('\n--- FIRST CALL ---')
    const result1 = await cyre.call('debug-change', {value: 'test'})
    console.log('First call result:', result1)
    console.log('Execution count after first:', executionCount)

    console.log('\n--- SECOND CALL (SAME PAYLOAD) ---')
    const result2 = await cyre.call('debug-change', {value: 'test'})
    console.log('Second call result:', result2)
    console.log('Execution count after second:', executionCount)

    // The issue: second call should be blocked but handler still executes
    console.log('\n--- ANALYSIS ---')
    console.log('Second call ok?', result2.ok)
    console.log('Handler executed twice?', executionCount === 2)
    console.log('Expected: ok=false, executionCount=1')
  })
})
