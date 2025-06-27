// example/pipeline-runtime-execution-test.ts
// Test runtime pipeline execution with proper order and blocking logic

import {cyre} from '../src'
import {processCall} from '../src/components/cyre-call'
import {io} from '../src/context/state'
import payloadState from '../src/context/payload-state'
import {log} from '../src/components/cyre-log'

/*

      C.Y.R.E - P.I.P.E.L.I.N.E - R.U.N.T.I.M.E - T.E.S.T
      
      Test runtime pipeline execution order:
      1. Pre-computed blocking check (immediate exit)
      2. Fast path detection (skip pipeline)
      3. Pipeline execution in correct order:
         - System protections (throttle, debounce)
         - User-defined conditions (schema, condition, selector, transform)
      4. Payload transformation through pipeline
      5. Final execution or blocking

*/

interface RuntimeTestResult {
  name: string
  success: boolean
  message: string
  details?: any
  executionOrder?: string[]
  payload?: any
  blocked?: boolean
  errorType?: string
}

interface PipelineTestSummary {
  totalTests: number
  passed: number
  failed: number
  results: RuntimeTestResult[]
}

// Mock subscribers for testing
const testSubscribers = new Map<string, Function>()

const setupTestSubscriber = (id: string, handler: Function) => {
  testSubscribers.set(id, handler)
  return cyre.on(id, handler)
}

/**
 * Test 1: Pre-computed blocking should exit immediately
 */
async function testPrecomputedBlocking(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  // Test blocked action (repeat: 0)
  try {
    const blockedAction = {
      id: 'test-blocked-runtime',
      repeat: 0,
      throttle: 1000,
      condition: () => true,
      schema: cyre.schema.string(),
      payload: 'test'
    }

    // Register action (should be blocked at registration)
    const regResult = cyre.action(blockedAction)

    if (regResult.ok) {
      // If somehow registered, try to call it
      const callResult = await cyre.call('test-blocked-runtime', 'test payload')

      results.push({
        name: 'Pre-computed Blocking',
        success: !callResult.ok,
        message: callResult.message,
        blocked: true,
        details: {
          registrationBlocked: !regResult.ok,
          callBlocked: !callResult.ok,
          blockReason: callResult.message
        }
      })
    } else {
      // Registration blocked (expected)
      results.push({
        name: 'Pre-computed Blocking',
        success: true,
        message: 'Action blocked at registration as expected',
        blocked: true,
        details: {
          registrationBlocked: true,
          blockReason: regResult.message
        }
      })
    }
  } catch (error) {
    results.push({
      name: 'Pre-computed Blocking',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Test 2: Fast path should skip pipeline entirely
 */
async function testFastPath(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  try {
    let executionOrder: string[] = []
    let receivedPayload: any = null

    // Simple action with no protections
    cyre.action({
      id: 'test-fast-path-runtime',
      payload: {message: 'fast path test'}
    })

    setupTestSubscriber('test-fast-path-runtime', (payload: any) => {
      executionOrder.push('subscriber-executed')
      receivedPayload = payload
      return {success: true, payload}
    })

    const startTime = performance.now()
    const result = await cyre.call('test-fast-path-runtime', {
      message: 'updated'
    })
    const executionTime = performance.now() - startTime

    const storedAction = io.get('test-fast-path-runtime')

    results.push({
      name: 'Fast Path Execution',
      success: result.ok && storedAction?._hasFastPath === true,
      message: 'Fast path executed without pipeline',
      details: {
        hasFastPath: storedAction?._hasFastPath,
        pipelineLength: storedAction?._protectionPipeline?.length || 0,
        executionTime: executionTime.toFixed(3),
        subscriberCalled: executionOrder.includes('subscriber-executed'),
        payloadReceived: receivedPayload
      },
      executionOrder,
      payload: receivedPayload
    })
  } catch (error) {
    results.push({
      name: 'Fast Path Execution',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Test 3: Throttle protection should block subsequent calls
 */
async function testThrottleProtection(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  try {
    let executionCount = 0
    const executionOrder: string[] = []

    cyre.action({
      id: 'test-throttle-runtime',
      throttle: 500, // 500ms throttle
      payload: {counter: 0}
    })

    setupTestSubscriber('test-throttle-runtime', (payload: any) => {
      executionCount++
      executionOrder.push(`execution-${executionCount}`)
      return {success: true, payload}
    })

    // First call - should succeed
    const result1 = await cyre.call('test-throttle-runtime', {counter: 1})

    // Immediate second call - should be throttled
    const result2 = await cyre.call('test-throttle-runtime', {counter: 2})

    // Wait for throttle to clear
    await new Promise(resolve => setTimeout(resolve, 600))

    // Third call - should succeed
    const result3 = await cyre.call('test-throttle-runtime', {counter: 3})

    results.push({
      name: 'Throttle Protection',
      success: result1.ok && !result2.ok && result3.ok,
      message: 'Throttle protection working correctly',
      details: {
        firstCallSuccess: result1.ok,
        secondCallThrottled:
          !result2.ok && result2.message.includes('Throttled'),
        thirdCallSuccess: result3.ok,
        executionCount,
        throttleMessage: result2.message
      },
      executionOrder
    })
  } catch (error) {
    results.push({
      name: 'Throttle Protection',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Test 4: Debounce protection should delay execution
 */
async function testDebounceProtection(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  try {
    let executionCount = 0
    const executionOrder: string[] = []
    const executionTimes: number[] = []

    cyre.action({
      id: 'test-debounce-runtime',
      debounce: 200, // 200ms debounce
      payload: {search: ''}
    })

    setupTestSubscriber('test-debounce-runtime', (payload: any) => {
      executionCount++
      executionTimes.push(Date.now())
      executionOrder.push(`execution-${executionCount}-${payload.search}`)
      return {success: true, payload}
    })

    const startTime = Date.now()

    // Rapid calls - should be debounced
    const result1 = await cyre.call('test-debounce-runtime', {search: 'a'})
    const result2 = await cyre.call('test-debounce-runtime', {search: 'ab'})
    const result3 = await cyre.call('test-debounce-runtime', {search: 'abc'})

    // All should return debounce message immediately
    const allDebounced = [result1, result2, result3].every(
      r => !r.ok && r.message.includes('Debounced')
    )

    // Wait for debounce to execute
    await new Promise(resolve => setTimeout(resolve, 300))

    const totalTime = Date.now() - startTime

    results.push({
      name: 'Debounce Protection',
      success: allDebounced && executionCount === 1,
      message: 'Debounce protection working correctly',
      details: {
        allCallsDebounced: allDebounced,
        finalExecutionCount: executionCount,
        totalTime,
        debounceMessages: [result1.message, result2.message, result3.message],
        executedAfterDelay: executionCount === 1,
        lastSearch: executionOrder[0]?.includes('abc')
      },
      executionOrder
    })
  } catch (error) {
    results.push({
      name: 'Debounce Protection',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Test 5: Schema validation should block invalid payloads
 */
async function testSchemaValidation(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  try {
    let executionCount = 0
    const executionOrder: string[] = []

    cyre.action({
      id: 'test-schema-runtime',
      schema: cyre.schema.object({
        name: cyre.schema.string(),
        age: cyre.schema.number().min(0)
      }),
      payload: {name: 'test', age: 25}
    })

    setupTestSubscriber('test-schema-runtime', (payload: any) => {
      executionCount++
      executionOrder.push(`valid-execution-${payload.name}`)
      return {success: true, payload}
    })

    // Valid payload - should pass
    const validResult = await cyre.call('test-schema-runtime', {
      name: 'John',
      age: 30
    })

    // Invalid payload - should be blocked
    const invalidResult = await cyre.call('test-schema-runtime', {
      name: 'Jane',
      age: 'invalid' // Should fail schema validation
    })

    results.push({
      name: 'Schema Validation',
      success: validResult.ok && !invalidResult.ok,
      message: 'Schema validation working correctly',
      details: {
        validPayloadPassed: validResult.ok,
        invalidPayloadBlocked: !invalidResult.ok,
        executionCount,
        schemaErrorMessage: invalidResult.message,
        validationFailed: invalidResult.message.includes(
          'Schema validation failed'
        )
      },
      executionOrder
    })
  } catch (error) {
    results.push({
      name: 'Schema Validation',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Test 6: Condition function should control execution
 */
async function testConditionExecution(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  try {
    let executionCount = 0
    const executionOrder: string[] = []

    cyre.action({
      id: 'test-condition-runtime',
      condition: (payload: any) => payload.enabled === true,
      payload: {enabled: false, data: 'test'}
    })

    setupTestSubscriber('test-condition-runtime', (payload: any) => {
      executionCount++
      executionOrder.push(`execution-${payload.enabled}`)
      return {success: true, payload}
    })

    // Condition fails - should be blocked
    const blockedResult = await cyre.call('test-condition-runtime', {
      enabled: false,
      data: 'blocked'
    })

    // Condition passes - should execute
    const passedResult = await cyre.call('test-condition-runtime', {
      enabled: true,
      data: 'passed'
    })

    results.push({
      name: 'Condition Execution',
      success: !blockedResult.ok && passedResult.ok,
      message: 'Condition function working correctly',
      details: {
        conditionBlockedWhenFalse: !blockedResult.ok,
        conditionPassedWhenTrue: passedResult.ok,
        executionCount,
        blockMessage: blockedResult.message,
        conditionMetMessage: blockedResult.message.includes('Condition not met')
      },
      executionOrder
    })
  } catch (error) {
    results.push({
      name: 'Condition Execution',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Test 7: Selector and Transform pipeline order and payload transformation
 */
async function testSelectorTransformPipeline(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  try {
    let executionCount = 0
    const executionOrder: string[] = []
    let finalPayload: any = null

    cyre.action({
      id: 'test-selector-transform-runtime',
      selector: (payload: any) => {
        executionOrder.push('selector-executed')
        return payload.user // Select only user object
      },
      transform: (selectedData: any) => {
        executionOrder.push('transform-executed')
        return {
          ...selectedData,
          processed: true,
          timestamp: Date.now()
        }
      },
      payload: {user: {id: 1, name: 'Test'}, metadata: {}}
    })

    setupTestSubscriber('test-selector-transform-runtime', (payload: any) => {
      executionCount++
      executionOrder.push('subscriber-executed')
      finalPayload = payload
      return {success: true, payload}
    })

    const originalPayload = {
      user: {id: 123, name: 'John'},
      metadata: {source: 'test', irrelevant: 'data'},
      other: 'ignored'
    }

    const result = await cyre.call(
      'test-selector-transform-runtime',
      originalPayload
    )

    const selectorExecutedBeforeTransform =
      executionOrder.indexOf('selector-executed') <
      executionOrder.indexOf('transform-executed')

    const transformExecutedBeforeSubscriber =
      executionOrder.indexOf('transform-executed') <
      executionOrder.indexOf('subscriber-executed')

    results.push({
      name: 'Selector/Transform Pipeline',
      success: result.ok && finalPayload && finalPayload.processed === true,
      message: 'Selector and transform pipeline working correctly',
      details: {
        executionSucceeded: result.ok,
        correctExecutionOrder:
          selectorExecutedBeforeTransform && transformExecutedBeforeSubscriber,
        payloadTransformed: finalPayload?.processed === true,
        userDataSelected:
          finalPayload?.id === 123 && finalPayload?.name === 'John',
        metadataExcluded: !('metadata' in finalPayload),
        hasTimestamp: typeof finalPayload?.timestamp === 'number'
      },
      executionOrder,
      payload: finalPayload
    })
  } catch (error) {
    results.push({
      name: 'Selector/Transform Pipeline',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Test 8: Complex pipeline with multiple protections in correct order
 */
async function testComplexPipelineOrder(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  try {
    let executionCount = 0
    const executionOrder: string[] = []
    let finalPayload: any = null

    cyre.action({
      id: 'test-complex-pipeline-runtime',
      throttle: 100,
      schema: cyre.schema.object({
        userId: cyre.schema.string(),
        action: cyre.schema.string(),
        value: cyre.schema.number()
      }),
      condition: (payload: any) => {
        executionOrder.push('condition-executed')
        return payload.value > 0
      },
      selector: (payload: any) => {
        executionOrder.push('selector-executed')
        return {
          user: payload.userId,
          event: payload.action,
          data: payload.value
        }
      },
      transform: (selected: any) => {
        executionOrder.push('transform-executed')
        return {
          ...selected,
          processed: true,
          level: selected.data > 100 ? 'high' : 'normal'
        }
      },
      payload: {userId: 'user1', action: 'click', value: 50}
    })

    setupTestSubscriber('test-complex-pipeline-runtime', (payload: any) => {
      executionCount++
      executionOrder.push('subscriber-executed')
      finalPayload = payload
      return {success: true, payload}
    })

    // Test 1: Valid payload that passes all checks
    const validResult = await cyre.call('test-complex-pipeline-runtime', {
      userId: 'user123',
      action: 'purchase',
      value: 150
    })

    // Test 2: Payload that fails condition (value <= 0)
    const conditionFailResult = await cyre.call(
      'test-complex-pipeline-runtime',
      {
        userId: 'user456',
        action: 'cancel',
        value: -10
      }
    )

    // Test 3: Immediate throttled call
    const throttledResult = await cyre.call('test-complex-pipeline-runtime', {
      userId: 'user789',
      action: 'retry',
      value: 75
    })

    const correctOrder =
      executionOrder.indexOf('condition-executed') <
        executionOrder.indexOf('selector-executed') &&
      executionOrder.indexOf('selector-executed') <
        executionOrder.indexOf('transform-executed') &&
      executionOrder.indexOf('transform-executed') <
        executionOrder.indexOf('subscriber-executed')

    results.push({
      name: 'Complex Pipeline Order',
      success:
        validResult.ok &&
        !conditionFailResult.ok &&
        !throttledResult.ok &&
        correctOrder,
      message: 'Complex pipeline executing in correct order',
      details: {
        validPayloadPassed: validResult.ok,
        conditionFailureBlocked:
          !conditionFailResult.ok &&
          conditionFailResult.message.includes('Condition not met'),
        throttleWorking:
          !throttledResult.ok && throttledResult.message.includes('Throttled'),
        correctExecutionOrder: correctOrder,
        payloadTransformed: finalPayload?.processed === true,
        levelCalculated: finalPayload?.level === 'high',
        executionCount
      },
      executionOrder,
      payload: finalPayload
    })
  } catch (error) {
    results.push({
      name: 'Complex Pipeline Order',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Test 9: Change detection should skip unchanged payloads
 */
async function testChangeDetection(): Promise<RuntimeTestResult[]> {
  const results: RuntimeTestResult[] = []

  try {
    let executionCount = 0
    const executionOrder: string[] = []

    cyre.action({
      id: 'test-change-detection-runtime',
      detectChanges: true,
      payload: {counter: 0}
    })

    setupTestSubscriber('test-change-detection-runtime', (payload: any) => {
      executionCount++
      executionOrder.push(`execution-${payload.counter}`)
      return {success: true, payload}
    })

    // First call - should execute (new payload)
    const result1 = await cyre.call('test-change-detection-runtime', {
      counter: 1
    })

    // Second call with same payload - should be skipped
    const result2 = await cyre.call('test-change-detection-runtime', {
      counter: 1
    })

    // Third call with different payload - should execute
    const result3 = await cyre.call('test-change-detection-runtime', {
      counter: 2
    })

    results.push({
      name: 'Change Detection',
      success: result1.ok && !result2.ok && result3.ok && executionCount === 2,
      message: 'Change detection working correctly',
      details: {
        firstCallExecuted: result1.ok,
        secondCallSkipped: !result2.ok && result2.message.includes('unchanged'),
        thirdCallExecuted: result3.ok,
        correctExecutionCount: executionCount === 2,
        skipMessage: result2.message
      },
      executionOrder
    })
  } catch (error) {
    results.push({
      name: 'Change Detection',
      success: false,
      message: `Error: ${error}`,
      errorType: 'exception'
    })
  }

  return results
}

/**
 * Main pipeline runtime test function
 */
export async function testPipelineRuntimeExecution(): Promise<PipelineTestSummary> {
  console.log('\n🔍 CYRE PIPELINE RUNTIME EXECUTION TEST')
  console.log('='.repeat(60))

  // Initialize cyre
  if (!cyre.status) {
    await cyre.init()
  }

  // Clear any existing state
  cyre.clear()

  const allResults: RuntimeTestResult[] = []

  // Run all test categories in order
  console.log('\n🚫 Testing Pre-computed Blocking...')
  allResults.push(...(await testPrecomputedBlocking()))

  console.log('\n⚡ Testing Fast Path Execution...')
  allResults.push(...(await testFastPath()))

  console.log('\n🔄 Testing Throttle Protection...')
  allResults.push(...(await testThrottleProtection()))

  console.log('\n⏱️  Testing Debounce Protection...')
  allResults.push(...(await testDebounceProtection()))

  console.log('\n📋 Testing Schema Validation...')
  allResults.push(...(await testSchemaValidation()))

  console.log('\n✅ Testing Condition Execution...')
  allResults.push(...(await testConditionExecution()))

  console.log('\n🔄 Testing Selector/Transform Pipeline...')
  allResults.push(...(await testSelectorTransformPipeline()))

  console.log('\n🎯 Testing Complex Pipeline Order...')
  allResults.push(...(await testComplexPipelineOrder()))

  console.log('\n🔍 Testing Change Detection...')
  allResults.push(...(await testChangeDetection()))

  // Calculate summary
  const passed = allResults.filter(r => r.success).length
  const failed = allResults.length - passed

  const summary: PipelineTestSummary = {
    totalTests: allResults.length,
    passed,
    failed,
    results: allResults
  }

  // Print results
  console.log('\n📊 PIPELINE RUNTIME TEST RESULTS')
  console.log('='.repeat(60))
  console.log(`Total Tests: ${summary.totalTests}`)
  console.log(
    `Passed: ${passed} (${((passed / summary.totalTests) * 100).toFixed(1)}%)`
  )
  console.log(
    `Failed: ${failed} (${((failed / summary.totalTests) * 100).toFixed(1)}%)`
  )

  console.log('\n📝 DETAILED RESULTS')
  console.log('-'.repeat(60))

  allResults.forEach((result, index) => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} ${index + 1}. ${result.name}`)
    console.log(`   ${result.message}`)

    if (result.executionOrder && result.executionOrder.length > 0) {
      console.log(`   Execution Order: ${result.executionOrder.join(' → ')}`)
    }

    if (result.details) {
      console.log(`   Details:`, result.details)
    }

    if (result.payload) {
      console.log(`   Final Payload:`, result.payload)
    }

    if (result.errorType) {
      console.log(`   Error Type: ${result.errorType}`)
    }

    console.log('')
  })

  return summary
}

// Auto-run if executed directly

testPipelineRuntimeExecution()
  .then(summary => {
    if (summary.failed > 0) {
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('Pipeline runtime test failed:', error)
    process.exit(1)
  })
