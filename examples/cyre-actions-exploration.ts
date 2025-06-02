// examples/cyre-actions-exploration.ts
// Comprehensive exploration of cyreActions and data-definitions integration

import {cyre} from '../src'
import {CyreActions} from '../src/components/cyre-actions'
import {dataDefinitions} from '../src/schema/data-definitions'
import {io} from '../src/context/state'
import payloadState from '../src/context/payload-state'

/*

      C.Y.R.E - A.C.T.I.O.N.S - E.X.P.L.O.R.A.T.I.O.N
      
      Test scenarios for action registration, validation, and compilation:
      - Basic action registration
      - Pipeline compilation verification
      - Blocking conditions testing
      - Store integration validation
      - Error handling verification

*/

interface TestResult {
  name: string
  success: boolean
  message: string
  details?: any
  errors?: string[]
}

interface ExplorationSummary {
  totalTests: number
  passed: number
  failed: number
  results: TestResult[]
}

/**
 * Test basic action registration and store integration
 */
function testBasicRegistration(): TestResult[] {
  const results: TestResult[] = []

  // Test 1: Valid basic action
  try {
    const basicAction = {
      id: 'test-basic',
      type: 'test',
      payload: {message: 'hello'}
    }

    const result = CyreActions(basicAction)
    const storedAction = io.get('test-basic')
    const storedPayload = payloadState.get('test-basic')

    results.push({
      name: 'Basic Action Registration',
      success: result.ok && !!storedAction && !!storedPayload,
      message: result.message,
      details: {
        registrationOk: result.ok,
        actionInStore: !!storedAction,
        payloadInStore: !!storedPayload,
        hasDefaults: storedAction?.timestamp && storedAction?.timeOfCreation,
        fastPath: storedAction?._hasFastPath,
        blocked: storedAction?._isBlocked
      }
    })
  } catch (error) {
    results.push({
      name: 'Basic Action Registration',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 2: Invalid ID validation
  try {
    const invalidAction = {id: '', payload: {}}
    const result = CyreActions(invalidAction)

    results.push({
      name: 'Invalid ID Validation',
      success: !result.ok,
      message: result.message,
      details: {
        correctlyRejected: !result.ok,
        errorMessage: result.message
      }
    })
  } catch (error) {
    results.push({
      name: 'Invalid ID Validation',
      success: false,
      message: `Unexpected error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 3: Null/undefined handling
  try {
    const nullResult = CyreActions(null)
    const undefinedResult = CyreActions(undefined)

    results.push({
      name: 'Null/Undefined Handling',
      success: !nullResult.ok && !undefinedResult.ok,
      message: `Null: ${nullResult.message}, Undefined: ${undefinedResult.message}`,
      details: {
        nullRejected: !nullResult.ok,
        undefinedRejected: !undefinedResult.ok
      }
    })
  } catch (error) {
    results.push({
      name: 'Null/Undefined Handling',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  return results
}

/**
 * Test pipeline compilation for different protection types
 */
function testPipelineCompilation(): TestResult[] {
  const results: TestResult[] = []

  // Test 1: No protections - should get fast path
  try {
    const fastPathAction = {
      id: 'test-fast-path',
      payload: {data: 'simple'}
    }

    const result = CyreActions(fastPathAction)
    const stored = io.get('test-fast-path')

    results.push({
      name: 'Fast Path Compilation',
      success: result.ok && stored?._hasFastPath === true,
      message: result.message,
      details: {
        hasFastPath: stored?._hasFastPath,
        pipelineLength: stored?._protectionPipeline?.length || 0,
        isBlocked: stored?._isBlocked
      }
    })
  } catch (error) {
    results.push({
      name: 'Fast Path Compilation',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 2: Multiple protections - should compile pipeline
  try {
    const protectedAction = {
      id: 'test-protected',
      throttle: 1000,
      detectChanges: true,
      condition: (payload: any) => payload.value > 0,
      transform: (payload: any) => ({...payload, processed: true}),
      payload: {value: 42}
    }

    const result = CyreActions(protectedAction)
    const stored = io.get('test-protected')

    results.push({
      name: 'Protection Pipeline Compilation',
      success: result.ok && stored?._hasFastPath === false,
      message: result.message,
      details: {
        hasFastPath: stored?._hasFastPath,
        pipelineLength: stored?._protectionPipeline?.length || 0,
        hasThrottle: !!protectedAction.throttle,
        hasCondition: !!protectedAction.condition,
        hasTransform: !!protectedAction.transform,
        hasChangeDetection: !!protectedAction.detectChanges
      }
    })
  } catch (error) {
    results.push({
      name: 'Protection Pipeline Compilation',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 3: Schema validation pipeline
  try {
    const schemaAction = {
      id: 'test-schema',
      schema: cyre.schema.object({
        name: cyre.schema.string(),
        age: cyre.schema.number().min(0)
      }),
      payload: {name: 'John', age: 30}
    }

    const result = CyreActions(schemaAction)
    const stored = io.get('test-schema')

    results.push({
      name: 'Schema Validation Pipeline',
      success:
        result.ok &&
        stored?._protectionPipeline &&
        stored._protectionPipeline.length > 0,
      message: result.message,
      details: {
        hasSchema: !!schemaAction.schema,
        pipelineLength: stored?._protectionPipeline?.length || 0,
        hasFastPath: stored?._hasFastPath
      }
    })
  } catch (error) {
    results.push({
      name: 'Schema Validation Pipeline',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  return results
}

/**
 * Test blocking conditions that should prevent registration
 */
function testBlockingConditions(): TestResult[] {
  const results: TestResult[] = []

  // Test 1: Repeat 0 should block
  try {
    const zeroRepeatAction = {
      id: 'test-zero-repeat',
      repeat: 0,
      payload: {data: 'test'}
    }

    const result = CyreActions(zeroRepeatAction)

    results.push({
      name: 'Zero Repeat Blocking',
      success: !result.ok,
      message: result.message,
      details: {
        correctlyBlocked: !result.ok,
        isBlockedInPayload: result.payload?._isBlocked,
        blockReason: result.payload?._blockReason
      }
    })
  } catch (error) {
    results.push({
      name: 'Zero Repeat Blocking',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 2: Block: true should block
  try {
    const blockedAction = {
      id: 'test-blocked',
      block: true,
      payload: {data: 'test'}
    }

    const result = CyreActions(blockedAction)

    results.push({
      name: 'Explicit Block Condition',
      success: !result.ok,
      message: result.message,
      details: {
        correctlyBlocked: !result.ok,
        isBlockedInPayload: result.payload?._isBlocked,
        blockReason: result.payload?._blockReason
      }
    })
  } catch (error) {
    results.push({
      name: 'Explicit Block Condition',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 3: Required payload validation
  try {
    const requiredAction = {
      id: 'test-required',
      required: true
      // No payload provided
    }

    const result = CyreActions(requiredAction)

    results.push({
      name: 'Required Payload Validation',
      success: !result.ok,
      message: result.message,
      details: {
        correctlyBlocked: !result.ok,
        errorMessage: result.message
      }
    })
  } catch (error) {
    results.push({
      name: 'Required Payload Validation',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  return results
}

/**
 * Test data-definitions individual validators
 */
function testDataDefinitions(): TestResult[] {
  const results: TestResult[] = []

  // Test 1: ID validation
  try {
    const pipeline: any[] = []

    const validId = dataDefinitions.id('valid-id', pipeline)
    const invalidId = dataDefinitions.id('', pipeline)
    const nullId = dataDefinitions.id(null, pipeline)

    results.push({
      name: 'ID Data Definition',
      success: validId.ok && !invalidId.ok && !nullId.ok,
      message: 'ID validation working correctly',
      details: {
        validIdPassed: validId.ok,
        emptyIdBlocked: !invalidId.ok && invalidId.blocking,
        nullIdBlocked: !nullId.ok && nullId.blocking
      }
    })
  } catch (error) {
    results.push({
      name: 'ID Data Definition',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 2: Throttle validation and pipeline addition
  try {
    const pipeline: any[] = []

    const validThrottle = dataDefinitions.throttle(1000, pipeline)
    const invalidThrottle = dataDefinitions.throttle(-1, pipeline)
    const zeroThrottle = dataDefinitions.throttle(0, pipeline)

    results.push({
      name: 'Throttle Data Definition',
      success: validThrottle.ok && !invalidThrottle.ok && zeroThrottle.ok,
      message: 'Throttle validation working correctly',
      details: {
        validThrottlePassed: validThrottle.ok,
        negativeThrottleBlocked: !invalidThrottle.ok,
        zeroThrottlePassed: zeroThrottle.ok,
        pipelineAdded: pipeline.length > 0
      }
    })
  } catch (error) {
    results.push({
      name: 'Throttle Data Definition',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 3: Schema validation
  try {
    const pipeline: any[] = []
    const testSchema = cyre.schema.string()

    const validSchema = dataDefinitions.schema(testSchema, pipeline)
    const invalidSchema = dataDefinitions.schema('not-a-function', pipeline)

    results.push({
      name: 'Schema Data Definition',
      success: validSchema.ok && !invalidSchema.ok,
      message: 'Schema validation working correctly',
      details: {
        validSchemaPassed: validSchema.ok,
        invalidSchemaBlocked: !invalidSchema.ok,
        pipelineAdded: pipeline.length > 0
      }
    })
  } catch (error) {
    results.push({
      name: 'Schema Data Definition',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  return results
}

/**
 * Test cross-attribute validation
 */
function testCrossValidation(): TestResult[] {
  const results: TestResult[] = []

  // Test 1: Interval requires repeat
  try {
    const intervalWithoutRepeat = {
      id: 'test-interval-no-repeat',
      interval: 1000
      // No repeat specified
    }

    const result = CyreActions(intervalWithoutRepeat)

    results.push({
      name: 'Interval Requires Repeat',
      success: !result.ok,
      message: result.message,
      details: {
        correctlyRejected: !result.ok,
        errorMessage: result.message
      }
    })
  } catch (error) {
    results.push({
      name: 'Interval Requires Repeat',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 2: Throttle and debounce conflict
  try {
    const conflictingAction = {
      id: 'test-throttle-debounce-conflict',
      throttle: 1000,
      debounce: 500,
      payload: {data: 'test'}
    }

    const result = CyreActions(conflictingAction)

    results.push({
      name: 'Throttle/Debounce Conflict',
      success: !result.ok,
      message: result.message,
      details: {
        correctlyRejected: !result.ok,
        errorMessage: result.message
      }
    })
  } catch (error) {
    results.push({
      name: 'Throttle/Debounce Conflict',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 3: MaxWait requires debounce
  try {
    const maxWaitWithoutDebounce = {
      id: 'test-maxwait-no-debounce',
      maxWait: 2000,
      payload: {data: 'test'}
    }

    const result = CyreActions(maxWaitWithoutDebounce)

    results.push({
      name: 'MaxWait Requires Debounce',
      success: !result.ok,
      message: result.message,
      details: {
        correctlyRejected: !result.ok,
        errorMessage: result.message
      }
    })
  } catch (error) {
    results.push({
      name: 'MaxWait Requires Debounce',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  return results
}

// Fix for the Action Update Handling test in cyre-actions-exploration.ts

// Replace the failing test section with this corrected version:

/**
 * Test store integration and separation - CORRECTED
 */
function testStoreIntegration(): TestResult[] {
  const results: TestResult[] = []

  // Test 1: Payload separation (unchanged - working correctly)
  try {
    const actionWithPayload = {
      id: 'test-payload-separation',
      type: 'test',
      throttle: 1000,
      payload: {message: 'hello', count: 42}
    }

    const result = CyreActions(actionWithPayload)
    const storedAction = io.get('test-payload-separation')
    const storedPayload = payloadState.get('test-payload-separation')

    results.push({
      name: 'Payload Separation',
      success: result.ok && !!storedAction && !!storedPayload,
      message: 'Payload correctly separated from action config',
      details: {
        actionInIOStore: !!storedAction,
        payloadInPayloadStore: !!storedPayload,
        actionHasNoPayload: !('payload' in storedAction),
        payloadMatches:
          JSON.stringify(storedPayload) ===
          JSON.stringify(actionWithPayload.payload),
        configPreserved: storedAction?.throttle === 1000
      }
    })
  } catch (error) {
    results.push({
      name: 'Payload Separation',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 2: Action update vs create - FIXED TEST
  try {
    const originalAction = {
      id: 'test-update',
      throttle: 1000,
      payload: {version: 1}
    }

    // CORRECTED: Valid update without conflicts
    const updateAction = {
      id: 'test-update',
      throttle: 2000, // Changed throttle value
      detectChanges: true, // Added new protection (no conflict)
      payload: {version: 2}
    }

    const createResult = CyreActions(originalAction)
    const updateResult = CyreActions(updateAction)

    const finalAction = io.get('test-update')
    const finalPayload = payloadState.get('test-update')

    results.push({
      name: 'Action Update Handling',
      success: createResult.ok && updateResult.ok,
      message: 'Action updates handled correctly',
      details: {
        createSucceeded: createResult.ok,
        updateSucceeded: updateResult.ok,
        configUpdated:
          finalAction?.throttle === 2000 && finalAction?.detectChanges === true,
        payloadUpdated: (finalPayload as any)?.version === 2,
        createMessage: createResult.message,
        updateMessage: updateResult.message
      }
    })
  } catch (error) {
    results.push({
      name: 'Action Update Handling',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 3: NEW - Test conflicting update rejection
  try {
    const conflictingUpdate = {
      id: 'test-conflict',
      throttle: 1000,
      debounce: 500, // This should be rejected
      payload: {test: 'conflict'}
    }

    const result = CyreActions(conflictingUpdate)

    results.push({
      name: 'Conflicting Update Rejection',
      success: !result.ok,
      message: 'Conflicting configurations correctly rejected',
      details: {
        correctlyRejected: !result.ok,
        errorMessage: result.message,
        containsConflictMessage: result.message.includes(
          'throttle and debounce'
        )
      }
    })
  } catch (error) {
    results.push({
      name: 'Conflicting Update Rejection',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  return results
}

/**
 * Test real-world complex scenarios
 */
function testComplexScenarios(): TestResult[] {
  const results: TestResult[] = []

  // Test 1: Complex action with multiple features
  try {
    const complexAction = {
      id: 'test-complex',
      type: 'user-interaction',
      throttle: 1000,
      detectChanges: true,
      schema: cyre.schema.object({
        userId: cyre.schema.string(),
        action: cyre.schema.enums('click', 'hover', 'scroll'),
        timestamp: cyre.schema.number(),
        metadata: cyre.schema
          .object({
            page: cyre.schema.string(),
            element: cyre.schema.string().optional()
          })
          .optional()
      }),
      condition: (payload: any) => payload.userId && payload.action,
      selector: (payload: any) => ({
        user: payload.userId,
        event: payload.action,
        context: payload.metadata
      }),
      transform: (selected: any) => ({
        ...selected,
        processed: true,
        processedAt: Date.now()
      }),
      priority: {
        level: 'medium' as const,
        timeout: 5000
      },
      payload: {
        userId: 'user123',
        action: 'click' as const,
        timestamp: Date.now(),
        metadata: {
          page: '/dashboard',
          element: 'submit-button'
        }
      }
    }

    const result = CyreActions(complexAction)
    const stored = io.get('test-complex')

    results.push({
      name: 'Complex Action Registration',
      success: result.ok && !!stored,
      message: result.message,
      details: {
        registrationOk: result.ok,
        hasMultipleProtections: (stored?._protectionPipeline?.length || 0) > 3,
        notFastPath: stored?._hasFastPath === false,
        hasSchema: !!complexAction.schema,
        hasCondition: !!complexAction.condition,
        hasTransform: !!complexAction.transform,
        hasThrottle: !!complexAction.throttle,
        hasPriority: !!complexAction.priority,
        pipelineLength: stored?._protectionPipeline?.length || 0
      }
    })
  } catch (error) {
    results.push({
      name: 'Complex Action Registration',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  // Test 2: Performance with many attributes
  try {
    const performanceStart = performance.now()
    const iterations = 100
    let successCount = 0

    for (let i = 0; i < iterations; i++) {
      const action = {
        id: `perf-test-${i}`,
        throttle: 100,
        detectChanges: true,
        condition: (p: any) => p.valid,
        transform: (p: any) => ({...p, id: i}),
        priority: {level: 'medium' as const},
        payload: {valid: true, data: `test-${i}`}
      }

      const result = CyreActions(action)
      if (result.ok) successCount++
    }

    const performanceEnd = performance.now()
    const totalTime = performanceEnd - performanceStart
    const avgTime = totalTime / iterations

    results.push({
      name: 'Performance Test',
      success: successCount === iterations && avgTime < 10, // Should be under 10ms per action
      message: `${successCount}/${iterations} actions in ${totalTime.toFixed(
        2
      )}ms`,
      details: {
        totalTime: totalTime.toFixed(2),
        avgTime: avgTime.toFixed(4),
        successRate: ((successCount / iterations) * 100).toFixed(1),
        throughput: (iterations / (totalTime / 1000)).toFixed(0)
      }
    })
  } catch (error) {
    results.push({
      name: 'Performance Test',
      success: false,
      message: `Error: ${error}`,
      errors: [String(error)]
    })
  }

  return results
}

/**
 * Main exploration function
 */
export async function exploreCyreActions(): Promise<ExplorationSummary> {
  console.log('\n🔍 CYRE ACTIONS & DATA-DEFINITIONS EXPLORATION')
  console.log('='.repeat(60))

  // Initialize cyre if needed
  if (!cyre.status) {
    await cyre.initialize()
  }

  // Clear any existing state
  cyre.clear()

  const allResults: TestResult[] = []

  // Run all test categories
  console.log('\n📋 Testing Basic Registration...')
  allResults.push(...testBasicRegistration())

  console.log('\n⚙️  Testing Pipeline Compilation...')
  allResults.push(...testPipelineCompilation())

  console.log('\n🚫 Testing Blocking Conditions...')
  allResults.push(...testBlockingConditions())

  console.log('\n🔧 Testing Data Definitions...')
  allResults.push(...testDataDefinitions())

  console.log('\n🔄 Testing Cross Validation...')
  allResults.push(...testCrossValidation())

  console.log('\n💾 Testing Store Integration...')
  allResults.push(...testStoreIntegration())

  console.log('\n🎯 Testing Complex Scenarios...')
  allResults.push(...testComplexScenarios())

  // Calculate summary
  const passed = allResults.filter(r => r.success).length
  const failed = allResults.length - passed

  const summary: ExplorationSummary = {
    totalTests: allResults.length,
    passed,
    failed,
    results: allResults
  }

  // Print results
  console.log('\n📊 EXPLORATION RESULTS')
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

    if (result.details) {
      console.log(`   Details:`, result.details)
    }

    if (result.errors && result.errors.length > 0) {
      console.log(`   Errors:`, result.errors)
    }

    console.log('')
  })

  // Store state analysis
  console.log('\n🏪 STORE STATE ANALYSIS')
  console.log('-'.repeat(60))

  const allActions = io.getAll()
  const payloadStats = payloadState.getStats()

  console.log(`Actions in IO store: ${allActions.length}`)
  console.log(`Payloads in payload store: ${payloadStats.totalChannels}`)
  console.log(
    `Fast path actions: ${allActions.filter(a => a._hasFastPath).length}`
  )
  console.log(
    `Protected actions: ${
      allActions.filter(a => !a._hasFastPath && !a._isBlocked).length
    }`
  )
  console.log(`Blocked actions: ${allActions.filter(a => a._isBlocked).length}`)

  // Pipeline analysis
  const pipelineLengths = allActions
    .filter(a => a._protectionPipeline)
    .map(a => a._protectionPipeline!.length)

  if (pipelineLengths.length > 0) {
    const avgPipelineLength =
      pipelineLengths.reduce((a, b) => a + b, 0) / pipelineLengths.length
    const maxPipelineLength = Math.max(...pipelineLengths)

    console.log(`Average pipeline length: ${avgPipelineLength.toFixed(1)}`)
    console.log(`Max pipeline length: ${maxPipelineLength}`)
  }

  return summary
}

// Auto-run if executed directly

exploreCyreActions()
  .then(summary => {
    if (summary.failed > 0) {
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('Exploration failed:', error)
    process.exit(1)
  })
