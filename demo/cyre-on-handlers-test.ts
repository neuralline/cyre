// demo/cyre-on-handlers-test.ts
// Comprehensive testing of .on handlers, subscriptions, and error scenarios

import {cyre, useBranch, useCyre} from '../src'
import {performance} from 'perf_hooks'

/* 

      C.Y.R.E - O.N - H.A.N.D.L.E.R.S - T.E.S.T
      
      Comprehensive testing suite for:
      - Handler registration and execution
      - Missing .on address scenarios
      - Error handling and recovery
      - Subscription lifecycle management
      - Cross-branch handler communication
      - Performance characteristics

*/

interface TestCase {
  name: string
  description: string
  success: boolean
  duration: number
  error?: string
  details?: any
}

interface TestSuite {
  suiteName: string
  cases: TestCase[]
  totalTests: number
  passedTests: number
  avgDuration: number
}

// ========================================
// TEST UTILITIES
// ========================================

const timeTest = async <T>(
  name: string,
  testFn: () => Promise<T>
): Promise<{result: T; duration: number}> => {
  const start = performance.now()
  const result = await testFn()
  const duration = performance.now() - start
  return {result, duration}
}

const createTestCase = (
  name: string,
  description: string,
  success: boolean,
  duration: number,
  error?: string,
  details?: any
): TestCase => ({
  name,
  description,
  success,
  duration,
  error,
  details
})

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

// ========================================
// BASIC HANDLER REGISTRATION TESTS
// ========================================

const testBasicHandlerRegistration = async (): Promise<TestSuite> => {
  console.log('\n🔧 Testing Basic Handler Registration...')
  const cases: TestCase[] = []

  // Test 1: Simple handler registration
  const {result: test1, duration: d1} = await timeTest(
    'simple-registration',
    async () => {
      const actionResult = cyre.action({id: 'test-basic-handler'})
      const handlerResult = cyre.on('test-basic-handler', payload => {
        return {received: payload, processed: true, timestamp: Date.now()}
      })

      return {actionResult, handlerResult}
    }
  )

  cases.push(
    createTestCase(
      'Simple Handler Registration',
      'Register action and handler with matching IDs',
      test1.actionResult.ok && test1.handlerResult.ok,
      d1,
      test1.actionResult.ok && test1.handlerResult.ok
        ? undefined
        : 'Registration failed'
    )
  )

  // Test 2: Handler before action (handler-first pattern)
  const {result: test2, duration: d2} = await timeTest(
    'handler-first',
    async () => {
      // Register handler BEFORE creating action
      const handlerResult = cyre.on('test-handler-first', payload => {
        return {pattern: 'handler-first', payload}
      })

      const actionResult = cyre.action({id: 'test-handler-first'})

      return {handlerResult, actionResult}
    }
  )

  cases.push(
    createTestCase(
      'Handler-First Pattern',
      'Register handler before action creation',
      test2.handlerResult.ok && test2.actionResult.ok,
      d2,
      test2.handlerResult.ok && test2.actionResult.ok
        ? undefined
        : 'Handler-first pattern failed'
    )
  )

  // Test 3: Multiple handlers for same ID (should warn but work)
  const {result: test3, duration: d3} = await timeTest(
    'duplicate-handlers',
    async () => {
      cyre.action({id: 'test-duplicate'})

      const handler1 = cyre.on('test-duplicate', () => ({handler: 1}))
      const handler2 = cyre.on('test-duplicate', () => ({handler: 2})) // Should warn

      return {handler1, handler2}
    }
  )

  cases.push(
    createTestCase(
      'Duplicate Handler Warning',
      'Register multiple handlers for same ID',
      test3.handler1.ok && test3.handler2.ok, // Both should succeed but warn
      d3,
      undefined,
      'Should log duplicate listener warning'
    )
  )

  // Test 4: Invalid handler registration
  const {result: test4, duration: d4} = await timeTest(
    'invalid-handler',
    async () => {
      try {
        // @ts-ignore - intentionally invalid for testing
        const result = cyre.on('test-invalid', 'not-a-function')
        return {success: false, result}
      } catch (error) {
        return {success: true, error: String(error)}
      }
    }
  )

  cases.push(
    createTestCase(
      'Invalid Handler Type',
      'Attempt to register non-function as handler',
      !test4.success, // Should fail validation
      d4,
      test4.success ? 'Should have rejected invalid handler' : undefined
    )
  )

  return {
    suiteName: 'Basic Handler Registration',
    cases,
    totalTests: cases.length,
    passedTests: cases.filter(c => c.success).length,
    avgDuration: cases.reduce((sum, c) => sum + c.duration, 0) / cases.length
  }
}

// ========================================
// CALL WITHOUT HANDLER TESTS
// ========================================

const testMissingHandlers = async (): Promise<TestSuite> => {
  console.log('\n❌ Testing Missing Handler Scenarios...')
  const cases: TestCase[] = []

  // Test 1: Call non-existent channel
  const {result: test1, duration: d1} = await timeTest(
    'non-existent-channel',
    async () => {
      const result = await cyre.call('channel-does-not-exist', {test: true})
      return result
    }
  )

  cases.push(
    createTestCase(
      'Non-existent Channel Call',
      'Call channel that was never created',
      !test1.ok && test1.message.includes('Channel does not exist'),
      d1,
      test1.ok ? 'Should fail for non-existent channel' : undefined,
      {actualMessage: test1.message}
    )
  )

  // Test 2: Action without handler
  const {result: test2, duration: d2} = await timeTest(
    'action-no-handler',
    async () => {
      cyre.action({id: 'action-without-handler'})
      const result = await cyre.call('action-without-handler', {test: true})
      return result
    }
  )

  cases.push(
    createTestCase(
      'Action Without Handler',
      'Call action that exists but has no .on handler',
      !test2.ok && test2.message.includes('no subscriber'),
      d2,
      test2.ok ? 'Should fail when no handler registered' : undefined,
      {actualMessage: test2.message}
    )
  )

  // Test 3: Handler registration after failed call
  const {result: test3, duration: d3} = await timeTest(
    'late-handler-registration',
    async () => {
      // Create action
      cyre.action({id: 'late-handler-test'})

      // Try call without handler (should fail)
      const failResult = await cyre.call('late-handler-test', {attempt: 1})

      // Register handler
      cyre.on('late-handler-test', payload => {
        return {received: payload, registered: 'after-failure'}
      })

      // Try call again (should succeed)
      const successResult = await cyre.call('late-handler-test', {attempt: 2})

      return {failResult, successResult}
    }
  )

  cases.push(
    createTestCase(
      'Late Handler Registration',
      'Register handler after initial call failure',
      !test3.failResult.ok && test3.successResult.ok,
      d3,
      !test3.failResult.ok && test3.successResult.ok
        ? undefined
        : 'Late registration pattern failed'
    )
  )

  // Test 4: Forgotten handler scenario
  const {result: test4, duration: d4} = await timeTest(
    'forgotten-handler',
    async () => {
      // Create and register normally
      cyre.action({id: 'forgettable-handler'})
      cyre.on('forgettable-handler', () => ({status: 'active'}))

      // Verify it works
      const workingResult = await cyre.call('forgettable-handler')

      // Forget the channel (removes handler)
      cyre.forget('forgettable-handler')

      // Try to call again (should fail)
      const failedResult = await cyre.call('forgettable-handler')

      return {workingResult, failedResult}
    }
  )

  cases.push(
    createTestCase(
      'Forgotten Handler Call',
      'Call handler after channel is forgotten',
      test4.workingResult.ok && !test4.failedResult.ok,
      d4,
      test4.workingResult.ok && !test4.failedResult.ok
        ? undefined
        : 'Forget pattern failed'
    )
  )

  return {
    suiteName: 'Missing Handler Scenarios',
    cases,
    totalTests: cases.length,
    passedTests: cases.filter(c => c.success).length,
    avgDuration: cases.reduce((sum, c) => sum + c.duration, 0) / cases.length
  }
}

// ========================================
// ERROR HANDLING IN HANDLERS
// ========================================

const testHandlerErrorHandling = async (): Promise<TestSuite> => {
  console.log('\n💥 Testing Handler Error Handling...')
  const cases: TestCase[] = []

  // Test 1: Synchronous error in handler
  const {result: test1, duration: d1} = await timeTest(
    'sync-error',
    async () => {
      cyre.action({id: 'sync-error-handler'})
      cyre.on('sync-error-handler', payload => {
        if (payload.throwError) {
          throw new Error('Intentional sync error')
        }
        return {success: true}
      })

      const successResult = await cyre.call('sync-error-handler', {
        throwError: false
      })
      const errorResult = await cyre.call('sync-error-handler', {
        throwError: true
      })

      return {successResult, errorResult}
    }
  )

  cases.push(
    createTestCase(
      'Synchronous Handler Error',
      'Handler throws synchronous error',
      test1.successResult.ok && !test1.errorResult.ok,
      d1,
      test1.successResult.ok && !test1.errorResult.ok
        ? undefined
        : 'Sync error handling failed'
    )
  )

  // Test 2: Asynchronous error in handler
  const {result: test2, duration: d2} = await timeTest(
    'async-error',
    async () => {
      cyre.action({id: 'async-error-handler'})
      cyre.on('async-error-handler', async payload => {
        await delay(10) // Small delay
        if (payload.throwError) {
          throw new Error('Intentional async error')
        }
        return {success: true, async: true}
      })

      const successResult = await cyre.call('async-error-handler', {
        throwError: false
      })
      const errorResult = await cyre.call('async-error-handler', {
        throwError: true
      })

      return {successResult, errorResult}
    }
  )

  cases.push(
    createTestCase(
      'Asynchronous Handler Error',
      'Handler throws asynchronous error',
      test2.successResult.ok && !test2.errorResult.ok,
      d2,
      test2.successResult.ok && !test2.errorResult.ok
        ? undefined
        : 'Async error handling failed'
    )
  )

  // Test 3: Handler returns invalid response
  const {result: test3, duration: d3} = await timeTest(
    'invalid-response',
    async () => {
      cyre.action({id: 'invalid-response-handler'})
      cyre.on('invalid-response-handler', payload => {
        if (payload.returnUndefined) {
          return undefined // Valid but edge case
        }
        if (payload.returnNull) {
          return null // Valid but edge case
        }
        return {valid: true}
      })

      const validResult = await cyre.call('invalid-response-handler', {})
      const undefinedResult = await cyre.call('invalid-response-handler', {
        returnUndefined: true
      })
      const nullResult = await cyre.call('invalid-response-handler', {
        returnNull: true
      })

      return {validResult, undefinedResult, nullResult}
    }
  )

  cases.push(
    createTestCase(
      'Handler Return Values',
      'Test various handler return value scenarios',
      test3.validResult.ok && test3.undefinedResult.ok && test3.nullResult.ok,
      d3,
      test3.validResult.ok && test3.undefinedResult.ok && test3.nullResult.ok
        ? undefined
        : 'Return value handling failed'
    )
  )

  // Test 4: Timeout scenario (if supported)
  const {result: test4, duration: d4} = await timeTest(
    'handler-timeout',
    async () => {
      cyre.action({id: 'slow-handler'})
      cyre.on('slow-handler', async payload => {
        if (payload.delay) {
          await delay(payload.delay)
        }
        return {processed: true, delay: payload.delay}
      })

      const fastResult = await cyre.call('slow-handler', {delay: 10})
      const slowResult = await cyre.call('slow-handler', {delay: 100})

      return {fastResult, slowResult}
    }
  )

  cases.push(
    createTestCase(
      'Handler Performance',
      'Test handlers with different execution times',
      test4.fastResult.ok && test4.slowResult.ok,
      d4,
      test4.fastResult.ok && test4.slowResult.ok
        ? undefined
        : 'Performance test failed'
    )
  )

  return {
    suiteName: 'Handler Error Handling',
    cases,
    totalTests: cases.length,
    passedTests: cases.filter(c => c.success).length,
    avgDuration: cases.reduce((sum, c) => sum + c.duration, 0) / cases.length
  }
}

// ========================================
// SUBSCRIPTION LIFECYCLE TESTS
// ========================================

const testSubscriptionLifecycle = async (): Promise<TestSuite> => {
  console.log('\n🔄 Testing Subscription Lifecycle...')
  const cases: TestCase[] = []

  // Test 1: Unsubscribe functionality
  const {result: test1, duration: d1} = await timeTest(
    'unsubscribe',
    async () => {
      cyre.action({id: 'unsubscribe-test'})

      let callCount = 0
      const subscription = cyre.on('unsubscribe-test', () => {
        callCount++
        return {callCount}
      })

      // Call while subscribed
      await cyre.call('unsubscribe-test')
      const firstCount = callCount

      // Unsubscribe
      const unsubscribed = subscription.unsubscribe
        ? subscription.unsubscribe()
        : false

      // Call after unsubscribe (should fail)
      const afterUnsubscribe = await cyre.call('unsubscribe-test')
      const finalCount = callCount

      return {
        firstCount,
        finalCount,
        unsubscribed,
        afterUnsubscribe,
        callsAfterUnsubscribe: finalCount - firstCount
      }
    }
  )

  cases.push(
    createTestCase(
      'Unsubscribe Functionality',
      'Test unsubscribe prevents further handler calls',
      test1.firstCount === 1 &&
        test1.callsAfterUnsubscribe === 0 &&
        !test1.afterUnsubscribe.ok,
      d1,
      test1.firstCount === 1 && test1.callsAfterUnsubscribe === 0
        ? undefined
        : 'Unsubscribe did not prevent handler calls'
    )
  )

  // Test 2: Multiple subscriptions with different unsubscribe
  const {result: test2, duration: d2} = await timeTest(
    'multiple-subscriptions',
    async () => {
      cyre.action({id: 'multi-sub-test'})

      let handler1Calls = 0
      let handler2Calls = 0

      const sub1 = cyre.on('multi-sub-test', () => {
        handler1Calls++
        return {handler: 1}
      })

      const sub2 = cyre.on('multi-sub-test', () => {
        handler2Calls++
        return {handler: 2}
      })

      // Call with both subscribed
      await cyre.call('multi-sub-test')
      const bothActive = {handler1Calls, handler2Calls}

      // Unsubscribe first handler
      if (sub1.unsubscribe) sub1.unsubscribe()

      // Call again
      await cyre.call('multi-sub-test')
      const oneActive = {
        handler1Calls: handler1Calls - bothActive.handler1Calls,
        handler2Calls: handler2Calls - bothActive.handler2Calls
      }

      return {bothActive, oneActive}
    }
  )

  cases.push(
    createTestCase(
      'Multiple Subscription Management',
      'Test independent unsubscription of multiple handlers',
      test2.bothActive.handler1Calls > 0 && test2.oneActive.handler1Calls === 0,
      d2,
      test2.bothActive.handler1Calls > 0 && test2.oneActive.handler1Calls === 0
        ? undefined
        : 'Multiple subscription management failed'
    )
  )

  // Test 3: Subscription state persistence
  const {result: test3, duration: d3} = await timeTest(
    'subscription-persistence',
    async () => {
      cyre.action({id: 'persistence-test', payload: {initial: true}})

      let receivedPayloads: any[] = []
      cyre.on('persistence-test', payload => {
        receivedPayloads.push(payload)
        return {received: receivedPayloads.length}
      })

      // Multiple calls with different payloads
      await cyre.call('persistence-test', {call: 1})
      await cyre.call('persistence-test', {call: 2})
      await cyre.call('persistence-test', {call: 3})

      return {receivedPayloads, totalCalls: receivedPayloads.length}
    }
  )

  cases.push(
    createTestCase(
      'Subscription State Persistence',
      'Test handler receives all calls and maintains state',
      test3.totalCalls === 3 &&
        test3.receivedPayloads.every((p, i) => p.call === i + 1),
      d3,
      test3.totalCalls === 3 ? undefined : 'Handler did not receive all calls'
    )
  )

  return {
    suiteName: 'Subscription Lifecycle',
    cases,
    totalTests: cases.length,
    passedTests: cases.filter(c => c.success).length,
    avgDuration: cases.reduce((sum, c) => sum + c.duration, 0) / cases.length
  }
}

// ========================================
// BRANCH HANDLER TESTS
// ========================================

const testBranchHandlers = async (): Promise<TestSuite> => {
  console.log('\n🌿 Testing Branch Handler Functionality...')
  const cases: TestCase[] = []

  // Test 1: Basic branch handler
  const {result: test1, duration: d1} = await timeTest(
    'basic-branch-handler',
    async () => {
      const testBranch = useBranch(cyre, {id: 'handler-test-branch'})
      if (!testBranch) return {success: false}

      testBranch.action({id: 'branch-channel'})
      testBranch.on('branch-channel', payload => {
        return {branch: 'handler-test-branch', payload, processed: true}
      })

      const result = await testBranch.call('branch-channel', {
        test: 'branch-data'
      })
      return {success: result.ok, result}
    }
  )

  cases.push(
    createTestCase(
      'Basic Branch Handler',
      'Create and use handler within branch',
      test1.success && test1.result?.ok,
      d1,
      test1.success ? undefined : 'Branch handler creation failed'
    )
  )

  // Test 2: Cross-branch handler access
  const {result: test2, duration: d2} = await timeTest(
    'cross-branch-access',
    async () => {
      const branch1 = useBranch(cyre, {id: 'branch-1'})
      const branch2 = useBranch(cyre, {id: 'branch-2'})

      if (!branch1 || !branch2) return {success: false}

      // Create handler in branch1
      branch1.action({id: 'shared-channel'})
      branch1.on('shared-channel', () => ({from: 'branch-1'}))

      // Try to call from branch2 using global path
      const directResult = await cyre.call('branch-1/shared-channel', {
        from: 'branch-2'
      })

      return {success: directResult.ok, result: directResult}
    }
  )

  cases.push(
    createTestCase(
      'Cross-Branch Handler Access',
      'Access branch handler from different branch using global path',
      test2.success && test2.result?.ok,
      d2,
      test2.success ? undefined : 'Cross-branch access failed'
    )
  )

  // Test 3: Nested branch handlers
  const {result: test3, duration: d3} = await timeTest(
    'nested-branch-handlers',
    async () => {
      const parentBranch = useBranch(cyre, {id: 'parent'})
      const childBranch = useBranch(parentBranch!, {id: 'child'})

      if (!childBranch) return {success: false}

      childBranch.action({id: 'nested-channel'})
      childBranch.on('nested-channel', payload => {
        return {path: 'parent/child', payload, nested: true}
      })

      // Call through nested path
      const result = await cyre.call('parent/child/nested-channel', {
        test: 'nested'
      })
      return {success: result.ok, result}
    }
  )

  cases.push(
    createTestCase(
      'Nested Branch Handlers',
      'Create and access handlers in nested branches',
      test3.success && test3.result?.ok,
      d3,
      test3.success ? undefined : 'Nested branch handlers failed'
    )
  )

  // Test 4: Branch handler isolation
  const {result: test4, duration: d4} = await timeTest(
    'branch-handler-isolation',
    async () => {
      const branch1 = useBranch(cyre, {id: 'isolated-1'})
      const branch2 = useBranch(cyre, {id: 'isolated-2'})

      if (!branch1 || !branch2) return {success: false}

      // Same local ID in different branches
      branch1.action({id: 'same-id'})
      branch2.action({id: 'same-id'})

      branch1.on('same-id', () => ({from: 'isolated-1'}))
      branch2.on('same-id', () => ({from: 'isolated-2'}))

      // Call each branch's version
      const result1 = await branch1.call('same-id')
      const result2 = await branch2.call('same-id')

      return {
        success: result1.ok && result2.ok,
        branch1Response: result1.payload?.from,
        branch2Response: result2.payload?.from
      }
    }
  )

  cases.push(
    createTestCase(
      'Branch Handler Isolation',
      'Same local ID in different branches should be isolated',
      test4.success &&
        test4.branch1Response === 'isolated-1' &&
        test4.branch2Response === 'isolated-2',
      d4,
      test4.success ? undefined : 'Branch isolation failed'
    )
  )

  return {
    suiteName: 'Branch Handler Functionality',
    cases,
    totalTests: cases.length,
    passedTests: cases.filter(c => c.success).length,
    avgDuration: cases.reduce((sum, c) => sum + c.duration, 0) / cases.length
  }
}

// ========================================
// PERFORMANCE AND EDGE CASES
// ========================================

const testPerformanceAndEdgeCases = async (): Promise<TestSuite> => {
  console.log('\n⚡ Testing Performance and Edge Cases...')
  const cases: TestCase[] = []

  // Test 1: High-frequency handler calls
  const {result: test1, duration: d1} = await timeTest(
    'high-frequency-calls',
    async () => {
      cyre.action({id: 'high-freq-test'})

      let callCount = 0
      cyre.on('high-freq-test', () => {
        callCount++
        return {callNumber: callCount}
      })

      // Make many rapid calls
      const promises = Array.from({length: 100}, (_, i) =>
        cyre.call('high-freq-test', {iteration: i})
      )

      const results = await Promise.all(promises)
      const allSuccessful = results.every(r => r.ok)

      return {allSuccessful, callCount, resultsCount: results.length}
    }
  )

  cases.push(
    createTestCase(
      'High-Frequency Handler Calls',
      'Test handler performance with 100 rapid calls',
      test1.allSuccessful && test1.callCount === 100,
      d1,
      test1.allSuccessful ? undefined : 'High-frequency calls failed'
    )
  )

  // Test 2: Large payload handling
  const {result: test2, duration: d2} = await timeTest(
    'large-payload',
    async () => {
      cyre.action({id: 'large-payload-test'})
      cyre.on('large-payload-test', payload => {
        return {
          received: true,
          payloadSize: JSON.stringify(payload).length,
          itemCount: payload.items?.length
        }
      })

      // Create large payload
      const largePayload = {
        items: Array.from({length: 1000}, (_, i) => ({
          id: i,
          data: `Item ${i}`.repeat(10),
          timestamp: Date.now()
        }))
      }

      const result = await cyre.call('large-payload-test', largePayload)
      return {success: result.ok, result}
    }
  )

  cases.push(
    createTestCase(
      'Large Payload Handling',
      'Test handler with large payload (1000 items)',
      test2.success && test2.result?.payload?.itemCount === 1000,
      d2,
      test2.success ? undefined : 'Large payload handling failed'
    )
  )

  // Test 3: Concurrent handler registrations
  const {result: test3, duration: d3} = await timeTest(
    'concurrent-registrations',
    async () => {
      const registrations = Array.from({length: 50}, (_, i) => {
        const channelId = `concurrent-${i}`
        return Promise.resolve().then(() => {
          cyre.action({id: channelId})
          return cyre.on(channelId, () => ({handlerNumber: i}))
        })
      })

      const results = await Promise.all(registrations)
      const allSuccessful = results.every(r => r.ok)

      return {allSuccessful, registrationCount: results.length}
    }
  )

  cases.push(
    createTestCase(
      'Concurrent Handler Registrations',
      'Register 50 handlers concurrently',
      test3.allSuccessful && test3.registrationCount === 50,
      d3,
      test3.allSuccessful ? undefined : 'Concurrent registrations failed'
    )
  )

  // Test 4: Memory cleanup test
  const {result: test4, duration: d4} = await timeTest(
    'memory-cleanup',
    async () => {
      const initialChannels = cyre.getMetrics()?.stores?.channels || 0

      // Create and remove many channels
      for (let i = 0; i < 100; i++) {
        const channelId = `cleanup-test-${i}`
        cyre.action({id: channelId})
        cyre.on(channelId, () => ({temp: true}))
        cyre.forget(channelId)
      }

      const finalChannels = cyre.getMetrics()?.stores?.channels || 0
      const channelsLeaked = finalChannels - initialChannels

      return {channelsLeaked, initialChannels, finalChannels}
    }
  )

  cases.push(
    createTestCase(
      'Memory Cleanup',
      'Test channel cleanup after forget operations',
      test4.channelsLeaked <= 5, // Allow small variance
      d4,
      test4.channelsLeaked <= 5
        ? undefined
        : `Leaked ${test4.channelsLeaked} channels`
    )
  )

  return {
    suiteName: 'Performance and Edge Cases',
    cases,
    totalTests: cases.length,
    passedTests: cases.filter(c => c.success).length,
    avgDuration: cases.reduce((sum, c) => sum + c.duration, 0) / cases.length
  }
}

// ========================================
// MAIN TEST ORCHESTRATOR
// ========================================

const printTestSuite = (suite: TestSuite): void => {
  console.log(`\n📊 ${suite.suiteName}`)
  console.log('='.repeat(suite.suiteName.length + 4))

  suite.cases.forEach(testCase => {
    const status = testCase.success ? '✅' : '❌'
    console.log(
      `${status} ${testCase.name} (${testCase.duration.toFixed(2)}ms)`
    )
    console.log(`   ${testCase.description}`)
    if (testCase.error) {
      console.log(`   ⚠️  ${testCase.error}`)
    }
    if (testCase.details) {
      console.log(`   📝 ${JSON.stringify(testCase.details)}`)
    }
  })

  console.log(
    `\n📈 Suite Summary: ${suite.passedTests}/${suite.totalTests} passed`
  )
  console.log(`⏱️  Average Duration: ${suite.avgDuration.toFixed(2)}ms`)
}

export const cyreOnHandlersTest = async (): Promise<void> => {
  console.log('🚀 Cyre .on Handlers Comprehensive Test Suite')
  console.log('============================================')
  console.log(
    'Testing handler registration, subscriptions, error handling, and edge cases\n'
  )

  // Initialize Cyre
  console.log('🔧 Initializing Cyre...')
  const initResult = await cyre.init()
  if (!initResult.ok) {
    throw new Error(`Cyre initialization failed: ${initResult.message}`)
  }
  console.log('✅ Cyre ready for testing\n')

  const testSuites: TestSuite[] = []

  try {
    // Run all test suites
    testSuites.push(await testBasicHandlerRegistration())
    testSuites.push(await testMissingHandlers())
    testSuites.push(await testHandlerErrorHandling())
    testSuites.push(await testSubscriptionLifecycle())
    testSuites.push(await testBranchHandlers())
    testSuites.push(await testPerformanceAndEdgeCases())

    // Print individual suite results
    testSuites.forEach(printTestSuite)

    // Overall summary
    console.log('\n🎯 OVERALL TEST SUMMARY')
    console.log('=======================')

    const totalTests = testSuites.reduce(
      (sum, suite) => sum + suite.totalTests,
      0
    )
    const totalPassed = testSuites.reduce(
      (sum, suite) => sum + suite.passedTests,
      0
    )
    const overallAvgDuration =
      testSuites.reduce((sum, suite) => sum + suite.avgDuration, 0) /
      testSuites.length
    const successRate = (totalPassed / totalTests) * 100

    console.log(`📊 Test Suites: ${testSuites.length}`)
    console.log(`📊 Total Tests: ${totalTests}`)
    console.log(`✅ Passed: ${totalPassed}`)
    console.log(`❌ Failed: ${totalTests - totalPassed}`)
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`)
    console.log(`⏱️  Average Test Duration: ${overallAvgDuration.toFixed(2)}ms`)

    // Performance insights
    console.log('\n⚡ PERFORMANCE INSIGHTS')
    console.log('======================')

    const fastestSuite = testSuites.reduce((fastest, suite) =>
      suite.avgDuration < fastest.avgDuration ? suite : fastest
    )
    const slowestSuite = testSuites.reduce((slowest, suite) =>
      suite.avgDuration > slowest.avgDuration ? suite : slowest
    )

    console.log(
      `🏃 Fastest Suite: ${
        fastestSuite.suiteName
      } (${fastestSuite.avgDuration.toFixed(2)}ms avg)`
    )
    console.log(
      `🐌 Slowest Suite: ${
        slowestSuite.suiteName
      } (${slowestSuite.avgDuration.toFixed(2)}ms avg)`
    )

    // System health check
    console.log('\n🏥 SYSTEM HEALTH CHECK')
    console.log('=====================')

    const systemMetrics = cyre.getMetrics()
    if (systemMetrics?.available) {
      console.log(`📡 Active Channels: ${systemMetrics.stores?.channels || 0}`)
      console.log(
        `👥 Active Subscribers: ${systemMetrics.stores?.subscribers || 0}`
      )
      console.log(`⏰ Timeline Tasks: ${systemMetrics.stores?.timeline || 0}`)
      console.log(
        `💚 System Health: ${
          systemMetrics.system?.health?.isHealthy ? 'Healthy' : 'Degraded'
        }`
      )
    } else {
      console.log('⚠️  System metrics unavailable')
    }

    // Recommendations based on results
    console.log('\n💡 RECOMMENDATIONS')
    console.log('==================')

    if (successRate === 100) {
      console.log('🎉 Perfect! All tests passed')
      console.log('✅ Handler system is working correctly')
      console.log('✅ Error handling is robust')
      console.log('✅ Subscription lifecycle is solid')
      console.log('✅ Branch isolation is working')
      console.log('✅ Performance characteristics are good')
    } else {
      console.log('⚠️  Some tests failed - review above for details')

      // Specific recommendations based on failed suites
      testSuites.forEach(suite => {
        if (suite.passedTests < suite.totalTests) {
          console.log(
            `🔍 Review ${suite.suiteName}: ${
              suite.totalTests - suite.passedTests
            } failures`
          )
        }
      })
    }

    if (overallAvgDuration > 50) {
      console.log('⚠️  Average test duration is high - consider optimization')
    }

    // Pattern detection
    console.log('\n🔍 PATTERN ANALYSIS')
    console.log('==================')

    const errorPatterns = testSuites
      .flatMap(suite => suite.cases.filter(c => !c.success).map(c => c.error))
      .filter(Boolean)

    if (errorPatterns.length > 0) {
      console.log('🚨 Common Error Patterns:')
      const uniqueErrors = [...new Set(errorPatterns)]
      uniqueErrors.forEach(error => {
        const count = errorPatterns.filter(e => e === error).length
        console.log(`   • ${error} (${count}x)`)
      })
    } else {
      console.log('✅ No error patterns detected')
    }

    // Edge case analysis
    const edgeCaseSuite = testSuites.find(s =>
      s.suiteName.includes('Edge Cases')
    )
    if (edgeCaseSuite) {
      console.log(
        `🎯 Edge Case Coverage: ${edgeCaseSuite.passedTests}/${edgeCaseSuite.totalTests}`
      )
    }

    console.log('\n✨ Test Suite Completed!')

    if (successRate === 100) {
      console.log('🚀 Cyre .on handler system is production-ready!')
    } else {
      console.log('🔧 Some areas need attention before production use')
    }
  } catch (error) {
    console.error('💥 Test suite execution failed:', error)

    // Cleanup on error
    try {
      cyre.reset()
      console.log('🧹 Cleaned up Cyre state after error')
    } catch (cleanupError) {
      console.error('💥 Cleanup also failed:', cleanupError)
    }

    throw error
  }
}

// ========================================
// ADDITIONAL UTILITY TESTS
// ========================================

/**
 * Quick smoke test for basic .on functionality
 */
export const quickSmokeTest = async (): Promise<boolean> => {
  console.log('💨 Running Quick Smoke Test...')

  try {
    await cyre.init()

    // Simple handler test
    cyre.action({id: 'smoke-test'})
    cyre.on('smoke-test', () => ({smoke: 'test', success: true}))

    const result = await cyre.call('smoke-test')
    const success = result.ok && result.payload?.success === true

    console.log(success ? '✅ Smoke test passed' : '❌ Smoke test failed')
    return success
  } catch (error) {
    console.log('❌ Smoke test failed with error:', error)
    return false
  }
}

/**
 * Interactive test runner with user prompts
 */
export const interactiveTest = async (): Promise<void> => {
  console.log('🎮 Interactive .on Handler Test')
  console.log('===============================')
  console.log('This will walk through key scenarios step by step\n')

  await cyre.init()

  // Step 1: Basic handler
  console.log('📋 Step 1: Basic Handler Registration')
  console.log('Creating action and handler...')

  cyre.action({id: 'interactive-test'})
  cyre.on('interactive-test', payload => {
    console.log(`   📨 Handler received:`, payload)
    return {step: 'completed', received: payload}
  })

  console.log('Calling handler...')
  const result1 = await cyre.call('interactive-test', {
    step: 1,
    message: 'Hello Cyre!'
  })
  console.log('Result:', result1.ok ? '✅ Success' : '❌ Failed')

  // Step 2: Error handling
  console.log('\n📋 Step 2: Error Handling')
  console.log('Creating handler that can throw errors...')

  cyre.action({id: 'error-test'})
  cyre.on('error-test', payload => {
    if (payload.shouldError) {
      throw new Error('Intentional test error')
    }
    return {success: true}
  })

  console.log('Testing success case...')
  const result2a = await cyre.call('error-test', {shouldError: false})
  console.log('Result:', result2a.ok ? '✅ Success' : '❌ Failed')

  console.log('Testing error case...')
  const result2b = await cyre.call('error-test', {shouldError: true})
  console.log(
    'Result:',
    !result2b.ok ? '✅ Error handled' : '❌ Should have failed'
  )

  // Step 3: Missing handler
  console.log('\n📋 Step 3: Missing Handler Scenario')
  console.log('Calling non-existent channel...')

  const result3 = await cyre.call('does-not-exist', {test: true})
  console.log(
    'Result:',
    !result3.ok ? '✅ Properly rejected' : '❌ Should have failed'
  )

  console.log('\n🎉 Interactive test completed!')
}

// Export main test function as default
export default cyreOnHandlersTest

// Auto-run if executed directly

cyreOnHandlersTest()
  .then(() => {
    console.log('\n✨ All tests completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  })
