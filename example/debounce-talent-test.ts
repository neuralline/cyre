// test/debounce-talent-test.ts
// Direct testing of debounce talent from talent-definitions

import {debounce, type TalentResult} from '../src/schema/talent-definitions'
import type {IO, ActionPayload} from '../src/types/core'

/*

      C.Y.R.E - D.E.B.O.U.N.C.E - T.A.L.E.N.T - T.E.S.T
      
      Direct testing of debounce talent functionality:
      - Tests the actual debounce function from talent-definitions
      - Isolated from full Cyre pipeline
      - Verifies timing behavior and state management
      - Tests maxWait constraint handling
      - Edge cases and boundary conditions

*/

interface TestResult {
  testName: string
  success: boolean
  expected: any
  actual: any
  details: string
  timestamp: number
}

class DebounceTalentTester {
  private results: TestResult[] = []
  private mockActions = new Map<string, IO>()

  async runAllTests(): Promise<void> {
    console.log('🔄 Starting Debounce Talent Direct Test Suite')
    console.log('='.repeat(60))

    // Test 1: Basic debounce behavior
    await this.testBasicDebounce()

    // Test 2: MaxWait constraint
    await this.testMaxWaitConstraint()

    // Test 3: Edge cases
    await this.testEdgeCases()

    // Test 4: State management
    await this.testStateManagement()

    // Test 5: Bypass behavior
    await this.testBypassBehavior()

    // Generate report
    this.generateReport()
  }

  private async testBasicDebounce(): Promise<void> {
    console.log('\n📍 Test 1: Basic Debounce Behavior')

    const testCases = [
      {debounceMs: 0, shouldPass: true, description: 'Zero debounce'},
      {
        debounceMs: undefined,
        shouldPass: true,
        description: 'Undefined debounce'
      },
      {debounceMs: 100, shouldPass: false, description: '100ms debounce'},
      {debounceMs: 500, shouldPass: false, description: '500ms debounce'}
    ]

    for (const testCase of testCases) {
      await this.runBasicDebounceTest(testCase)
    }
  }

  private async runBasicDebounceTest(testCase: {
    debounceMs: number | undefined
    shouldPass: boolean
    description: string
  }): Promise<void> {
    const actionId = `test-action-${testCase.debounceMs || 'undefined'}`
    const mockAction = this.createMockAction(actionId, testCase.debounceMs)
    const payload = {test: 'payload', timestamp: Date.now()}

    console.log(`\n  ⏱️  Testing ${testCase.description}`)
    console.log(`     Action config: debounce=${testCase.debounceMs}`)
    console.log(`     Start time: ${new Date().toISOString()}`)

    const startTime = Date.now()
    const result = debounce(mockAction, payload)
    const executionTime = Date.now() - startTime

    console.log(`     📊 Result: ok=${result.ok}, message="${result.message}"`)
    console.log(`     ⏰ Execution time: ${executionTime}ms`)

    if (result.delay) {
      console.log(`     ⏳ Delay configured: ${result.delay}ms`)
    }

    // Check if timer state was set for non-zero debounce
    if (!result.ok && testCase.debounceMs && testCase.debounceMs > 0) {
      console.log(
        `     🔧 Timer state: ${mockAction._debounceTimer ? 'Set' : 'Not set'}`
      )
      console.log(
        `     🔧 First call time: ${
          mockAction._firstDebounceCall ? 'Recorded' : 'Not recorded'
        }`
      )

      if (mockAction._debounceTimer) {
        console.log(`     🔧 Timer ID: ${mockAction._debounceTimer}`)
      }
    }

    const success = result.ok === testCase.shouldPass

    this.results.push({
      testName: `Basic Debounce - ${testCase.description}`,
      success,
      expected: testCase.shouldPass,
      actual: result.ok,
      details: `Config: ${testCase.debounceMs}ms, Message: ${
        result.message || 'none'
      }`,
      timestamp: Date.now()
    })

    console.log(
      `     ${success ? '✅' : '❌'} Expected ok=${
        testCase.shouldPass
      }, Got ok=${result.ok}`
    )

    // Clean up action state for next test
    this.cleanupMockAction(mockAction)
  }

  private async testMaxWaitConstraint(): Promise<void> {
    console.log('\n📍 Test 2: MaxWait Constraint')

    const actionId = 'maxwait-test-action'
    const mockAction = this.createMockAction(actionId, 500, 1000) // 500ms debounce, 1000ms maxWait

    console.log(
      `\n  ⏳ Testing maxWait constraint: debounce=500ms, maxWait=1000ms`
    )

    // First call - should set up debounce
    const payload1 = {call: 1, timestamp: Date.now()}
    const result1 = debounce(mockAction, payload1)
    const firstCallTime = Date.now()

    console.log(`     📞 Call 1 at: ${new Date(firstCallTime).toISOString()}`)
    console.log(
      `     📊 Result 1: ok=${result1.ok}, message="${result1.message}"`
    )
    console.log(
      `     🔧 Timer set: ${mockAction._debounceTimer ? 'Yes' : 'No'}`
    )
    console.log(
      `     🔧 First call recorded: ${
        mockAction._firstDebounceCall ? 'Yes' : 'No'
      }`
    )

    // Wait less than maxWait but more than debounce
    await this.wait(600)

    // Second call - should still be debounced (within maxWait)
    const payload2 = {call: 2, timestamp: Date.now()}
    const result2 = debounce(mockAction, payload2)
    const secondCallTime = Date.now()

    console.log(
      `     📞 Call 2 at: ${new Date(secondCallTime).toISOString()} (+${
        secondCallTime - firstCallTime
      }ms)`
    )
    console.log(
      `     📊 Result 2: ok=${result2.ok}, message="${result2.message}"`
    )

    // Wait to exceed maxWait
    await this.wait(600) // Total time > 1000ms

    // Third call - should be allowed due to maxWait exceeded
    const payload3 = {call: 3, timestamp: Date.now()}
    const result3 = debounce(mockAction, payload3)
    const thirdCallTime = Date.now()

    console.log(
      `     📞 Call 3 at: ${new Date(thirdCallTime).toISOString()} (+${
        thirdCallTime - firstCallTime
      }ms total)`
    )
    console.log(
      `     📊 Result 3: ok=${result3.ok}, message="${result3.message}"`
    )
    console.log(
      `     🔧 Timer after maxWait: ${
        mockAction._debounceTimer ? 'Still set' : 'Cleared'
      }`
    )
    console.log(
      `     🔧 First call after maxWait: ${
        mockAction._firstDebounceCall ? 'Still recorded' : 'Cleared'
      }`
    )

    const totalTime = thirdCallTime - firstCallTime
    console.log(`     ⏱️  Total time elapsed: ${totalTime}ms`)

    // Verify behavior
    const test1Success = result1.ok === false // First call should be debounced
    const test2Success = result2.ok === false // Second call should be debounced
    const test3Success = result3.ok === true // Third call should be allowed (maxWait exceeded)

    this.results.push({
      testName: 'MaxWait - First Call',
      success: test1Success,
      expected: false,
      actual: result1.ok,
      details: `Should be debounced initially`,
      timestamp: firstCallTime
    })

    this.results.push({
      testName: 'MaxWait - Second Call',
      success: test2Success,
      expected: false,
      actual: result2.ok,
      details: `Should still be debounced (${
        secondCallTime - firstCallTime
      }ms < 1000ms)`,
      timestamp: secondCallTime
    })

    this.results.push({
      testName: 'MaxWait - Third Call',
      success: test3Success,
      expected: true,
      actual: result3.ok,
      details: `Should be allowed after maxWait (${totalTime}ms > 1000ms)`,
      timestamp: thirdCallTime
    })

    console.log(
      `     ${test1Success ? '✅' : '❌'} Call 1: Expected debounced, Got ok=${
        result1.ok
      }`
    )
    console.log(
      `     ${test2Success ? '✅' : '❌'} Call 2: Expected debounced, Got ok=${
        result2.ok
      }`
    )
    console.log(
      `     ${test3Success ? '✅' : '❌'} Call 3: Expected allowed, Got ok=${
        result3.ok
      }`
    )

    this.cleanupMockAction(mockAction)
  }

  private async testEdgeCases(): Promise<void> {
    console.log('\n📍 Test 3: Edge Cases')

    // Test with null/undefined payloads
    await this.testNullPayload()

    // Test rapid consecutive calls
    await this.testRapidCalls()

    // Test timer replacement
    await this.testTimerReplacement()
  }

  private async testNullPayload(): Promise<void> {
    console.log(`\n  🔍 Testing with null/undefined payloads`)

    const actionId = 'null-payload-test'
    const mockAction = this.createMockAction(actionId, 100)

    const payloads = [null, undefined, {}, '', 0, false]

    for (const payload of payloads) {
      const result = debounce(mockAction, payload)

      console.log(`     📊 Payload ${JSON.stringify(payload)}: ok=${result.ok}`)

      const success = typeof result.ok === 'boolean' // Should always return a TalentResult

      this.results.push({
        testName: `Edge Case - Null Payload ${JSON.stringify(payload)}`,
        success,
        expected: 'boolean result',
        actual: typeof result.ok,
        details: `Payload: ${JSON.stringify(payload)}`,
        timestamp: Date.now()
      })

      // Reset action state between tests
      this.cleanupMockAction(mockAction)
      await this.wait(10)
    }
  }

  private async testRapidCalls(): Promise<void> {
    console.log(`\n  ⚡ Testing rapid consecutive calls`)

    const actionId = 'rapid-calls-test'
    const mockAction = this.createMockAction(actionId, 200)

    const results: TalentResult[] = []
    const timestamps: number[] = []
    const timerIds: (string | undefined)[] = []

    // Make 5 rapid calls
    for (let i = 0; i < 5; i++) {
      const payload = {call: i + 1, timestamp: Date.now()}
      const result = debounce(mockAction, payload)

      results.push(result)
      timestamps.push(Date.now())
      timerIds.push(mockAction._debounceTimer)

      console.log(
        `     📞 Call ${i + 1}: ok=${result.ok}, timer=${
          mockAction._debounceTimer?.slice(-8) || 'none'
        }`
      )

      // Small delay between calls
      await this.wait(10)
    }

    // Analyze results
    const allCallsDebounced = results.every(r => !r.ok)
    const hasTimer = mockAction._debounceTimer !== undefined
    const hasFirstCallTime = mockAction._firstDebounceCall !== undefined

    // Check that timer ID changed (previous timer should be replaced)
    const uniqueTimers = new Set(timerIds.filter(Boolean))
    const timerWasReplaced = uniqueTimers.size > 1

    console.log(`     📊 All calls debounced: ${allCallsDebounced}`)
    console.log(`     🔧 Final timer set: ${hasTimer}`)
    console.log(`     🔧 First call time recorded: ${hasFirstCallTime}`)
    console.log(
      `     🔧 Unique timers: ${uniqueTimers.size} (replacement working: ${timerWasReplaced})`
    )

    const success = allCallsDebounced && hasTimer && hasFirstCallTime

    this.results.push({
      testName: 'Edge Case - Rapid Calls',
      success,
      expected: 'All debounced with proper state',
      actual: `${results.filter(r => !r.ok).length}/${
        results.length
      } debounced, timer: ${hasTimer}`,
      details: `${results.length} rapid calls with 200ms debounce`,
      timestamp: Date.now()
    })

    console.log(`     ${success ? '✅' : '❌'} Rapid calls handling`)

    this.cleanupMockAction(mockAction)
  }

  private async testTimerReplacement(): Promise<void> {
    console.log(`\n  🔄 Testing timer replacement behavior`)

    const actionId = 'timer-replacement-test'
    const mockAction = this.createMockAction(actionId, 300)

    // First call - sets timer
    const payload1 = {call: 1}
    const result1 = debounce(mockAction, payload1)
    const firstTimer = mockAction._debounceTimer

    console.log(`     📞 Call 1: timer=${firstTimer?.slice(-8)}`)

    await this.wait(100) // Wait but not enough for debounce

    // Second call - should replace timer
    const payload2 = {call: 2}
    const result2 = debounce(mockAction, payload2)
    const secondTimer = mockAction._debounceTimer

    console.log(`     📞 Call 2: timer=${secondTimer?.slice(-8)}`)

    const timerChanged = firstTimer !== secondTimer && secondTimer !== undefined
    const bothCallsDebounced = !result1.ok && !result2.ok
    const firstCallTimePreserved = mockAction._firstDebounceCall !== undefined

    console.log(`     🔧 Timer changed: ${timerChanged}`)
    console.log(`     📊 Both calls debounced: ${bothCallsDebounced}`)
    console.log(`     🔧 First call time preserved: ${firstCallTimePreserved}`)

    const success = timerChanged && bothCallsDebounced && firstCallTimePreserved

    this.results.push({
      testName: 'Edge Case - Timer Replacement',
      success,
      expected: 'Timer replaced, calls debounced, first call time preserved',
      actual: `Timer changed: ${timerChanged}, Debounced: ${bothCallsDebounced}, Preserved: ${firstCallTimePreserved}`,
      details:
        'Timer should be replaced on subsequent calls but preserve first call time',
      timestamp: Date.now()
    })

    console.log(`     ${success ? '✅' : '❌'} Timer replacement`)

    this.cleanupMockAction(mockAction)
  }

  private async testStateManagement(): Promise<void> {
    console.log('\n📍 Test 4: State Management')

    const actionId = 'state-test'
    const mockAction = this.createMockAction(actionId, 300, 800)

    console.log(`\n  🔧 Testing state variables management`)
    console.log(`     Config: debounce=300ms, maxWait=800ms`)

    // Initial state
    console.log(`     Initial state:`)
    console.log(`       _debounceTimer: ${mockAction._debounceTimer}`)
    console.log(`       _firstDebounceCall: ${mockAction._firstDebounceCall}`)

    // First call
    const payload1 = {test: 1, timestamp: Date.now()}
    const result1 = debounce(mockAction, payload1)
    const callTime1 = Date.now()

    console.log(`     After first call:`)
    console.log(
      `       _debounceTimer: ${mockAction._debounceTimer ? 'Set' : 'Not set'}`
    )
    console.log(
      `       _firstDebounceCall: ${
        mockAction._firstDebounceCall ? 'Set' : 'Not set'
      }`
    )
    console.log(`       Result: ok=${result1.ok}`)

    const stateSetCorrectly =
      mockAction._debounceTimer !== undefined &&
      mockAction._firstDebounceCall !== undefined

    // Wait for maxWait to be exceeded
    console.log(`     Waiting for maxWait to be exceeded...`)
    await this.wait(900) // Exceed 800ms maxWait

    // Call after maxWait
    const payload2 = {test: 2, timestamp: Date.now()}
    const result2 = debounce(mockAction, payload2)
    const callTime2 = Date.now()
    const totalTime = callTime2 - callTime1

    console.log(`     After maxWait exceeded (${totalTime}ms later):`)
    console.log(
      `       _debounceTimer: ${
        mockAction._debounceTimer ? 'Still set' : 'Cleared'
      }`
    )
    console.log(
      `       _firstDebounceCall: ${
        mockAction._firstDebounceCall ? 'Still set' : 'Cleared'
      }`
    )
    console.log(`       Result: ok=${result2.ok}`)

    const stateCleanedUp =
      mockAction._debounceTimer === undefined &&
      mockAction._firstDebounceCall === undefined

    const behaviorCorrect = !result1.ok && result2.ok // First debounced, second allowed
    const stateManagementCorrect =
      stateSetCorrectly && stateCleanedUp && behaviorCorrect

    this.results.push({
      testName: 'State Management',
      success: stateManagementCorrect,
      expected: 'Proper state setup and cleanup with correct behavior',
      actual: `Setup: ${stateSetCorrectly}, Cleanup: ${stateCleanedUp}, Behavior: ${behaviorCorrect}`,
      details: `State variables managed correctly over ${totalTime}ms`,
      timestamp: Date.now()
    })

    console.log(
      `     ${stateManagementCorrect ? '✅' : '❌'} State management complete`
    )
    console.log(`       Setup correct: ${stateSetCorrectly}`)
    console.log(`       Cleanup correct: ${stateCleanedUp}`)
    console.log(`       Behavior correct: ${behaviorCorrect}`)

    this.cleanupMockAction(mockAction)
  }

  private async testBypassBehavior(): Promise<void> {
    console.log('\n📍 Test 5: Bypass Behavior')

    const actionId = 'bypass-test'

    console.log(`\n  🚀 Testing _bypassDebounce flag`)

    // Test with bypass flag set
    const mockActionWithBypass = this.createMockAction(actionId, 500)
    mockActionWithBypass._bypassDebounce = true

    const payload = {test: 'bypass', timestamp: Date.now()}
    const result = debounce(mockActionWithBypass, payload)

    console.log(`     Action with _bypassDebounce=true`)
    console.log(`     📊 Result: ok=${result.ok}, message="${result.message}"`)
    console.log(
      `     🔧 Timer set: ${mockActionWithBypass._debounceTimer ? 'Yes' : 'No'}`
    )

    const bypassWorked = result.ok === true // Should pass through
    const noTimerSet = mockActionWithBypass._debounceTimer === undefined

    this.results.push({
      testName: 'Bypass Behavior',
      success: bypassWorked && noTimerSet,
      expected: 'Should pass through without debouncing',
      actual: `ok=${result.ok}, timer=${
        mockActionWithBypass._debounceTimer ? 'set' : 'not set'
      }`,
      details: '_bypassDebounce flag should skip all debounce logic',
      timestamp: Date.now()
    })

    console.log(
      `     ${bypassWorked && noTimerSet ? '✅' : '❌'} Bypass behavior`
    )
    console.log(`       Passed through: ${bypassWorked}`)
    console.log(`       No timer set: ${noTimerSet}`)

    this.cleanupMockAction(mockActionWithBypass)
  }

  private createMockAction(
    id: string,
    debounceMs?: number,
    maxWait?: number
  ): IO {
    const action: IO = {
      id,
      type: 'test-action',
      debounce: debounceMs,
      maxWait: maxWait,
      _debounceTimer: undefined,
      _firstDebounceCall: undefined,
      _bypassDebounce: false
    }

    this.mockActions.set(id, action)
    return action
  }

  private cleanupMockAction(action: IO): void {
    action._debounceTimer = undefined
    action._firstDebounceCall = undefined
    action._bypassDebounce = false
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 DEBOUNCE TALENT TEST RESULTS')
    console.log('='.repeat(60))

    const totalTests = this.results.length
    const passedTests = this.results.filter(r => r.success).length
    const failedTests = totalTests - passedTests

    console.log(`\n📈 Overall Results:`)
    console.log(`   Total Tests: ${totalTests}`)
    console.log(`   Passed: ${passedTests} ✅`)
    console.log(`   Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`)
    console.log(
      `   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`
    )

    console.log(`\n📋 Detailed Results:`)
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌'
      console.log(`\n${index + 1}. ${result.testName} ${status}`)
      console.log(`   Expected: ${result.expected}`)
      console.log(`   Actual: ${result.actual}`)
      console.log(`   Details: ${result.details}`)

      if (!result.success) {
        console.log(`   ⚠️  Test failed`)
      }
    })

    console.log('\n' + '='.repeat(60))
    console.log('🏁 Debounce Talent Test Complete')
    console.log('='.repeat(60))

    // Summary insights
    const categories = [
      {name: 'Basic', filter: (r: TestResult) => r.testName.includes('Basic')},
      {
        name: 'MaxWait',
        filter: (r: TestResult) => r.testName.includes('MaxWait')
      },
      {
        name: 'Edge Case',
        filter: (r: TestResult) => r.testName.includes('Edge')
      },
      {name: 'State', filter: (r: TestResult) => r.testName.includes('State')},
      {name: 'Bypass', filter: (r: TestResult) => r.testName.includes('Bypass')}
    ]

    console.log('\n🔍 Test Category Summary:')
    categories.forEach(category => {
      const categoryTests = this.results.filter(category.filter)
      const passed = categoryTests.filter(r => r.success).length
      console.log(
        `• ${category.name} tests: ${passed}/${categoryTests.length} passed`
      )
    })

    if (failedTests > 0) {
      console.log('\n⚠️  Failed Tests Summary:')
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(
            `• ${result.testName}: Expected ${result.expected}, Got ${result.actual}`
          )
        })
    }
  }
}

// Export test runner
export const runDebounceTalentTests = async (): Promise<void> => {
  const tester = new DebounceTalentTester()
  await tester.runAllTests()
}

// Auto-run if executed directly

runDebounceTalentTests().catch(error => {
  console.error('Debounce talent test failed:', error)
  process.exit(1)
})
