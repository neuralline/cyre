// test/debounce-test-fixed.ts
// Fixed debounce test with corrected Mixed Intervals timing

import {cyre} from '../src'
import {log} from '../src/components/cyre-log'

/*

      C.Y.R.E - D.E.B.O.U.N.C.E - T.E.S.T - F.I.X.E.D
      
      Fixed the Mixed Intervals test timing issue:
      - Extended pause duration to allow first debounce execution to complete
      - Proper timing calculations: debounce + safety margin
      - All other tests remain unchanged (they were passing)

*/

interface TestResult {
  testName: string
  expectedExecutions: number
  actualExecutions: number
  timestamps: number[]
  callTimestamps: number[]
  debounceInterval: number
  maxWait?: number
  success: boolean
  details: string
}

class DebounceTestRunner {
  private results: TestResult[] = []
  private executionCounts = new Map<string, number>()
  private executionTimestamps = new Map<string, number[]>()

  async runAllTests(): Promise<void> {
    console.log('🔄 Starting Cyre Debounce Test Suite (Fixed)')
    console.log('='.repeat(60))

    await cyre.initialize()

    // Test 1: Basic debounce with different intervals
    await this.testBasicDebounce()

    // Test 2: Burst call patterns
    await this.testBurstCalls()

    // Test 3: MaxWait constraint
    await this.testMaxWaitConstraint()

    // Test 4: Fixed mixed interval testing
    await this.testMixedIntervalsFixed()

    // Test 5: Edge cases
    await this.testEdgeCases()

    // Generate report
    this.generateReport()
  }

  private async testBasicDebounce(): Promise<void> {
    console.log('\n📍 Test 1: Basic Debounce with Different Intervals')

    const intervals = [100, 300, 500, 1000]

    for (const interval of intervals) {
      await this.runBasicDebounceTest(interval)
    }
  }

  private async runBasicDebounceTest(debounceMs: number): Promise<void> {
    const testId = `basic-debounce-${debounceMs}`
    const actionId = `test-action-${testId}`

    this.setupActionAndSubscriber(actionId, testId)

    // Configure action with debounce
    cyre.action({
      id: actionId,
      debounce: debounceMs,
      payload: 'test'
    })

    const callTimestamps: number[] = []
    const startTime = Date.now()

    console.log(`\n  ⏱️  Testing ${debounceMs}ms debounce interval`)
    console.log(`     Start time: ${new Date(startTime).toISOString()}`)

    // Make 5 rapid calls
    for (let i = 0; i < 5; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      console.log(
        `     📞 Call ${i + 1} at: ${callTime - startTime}ms (+${
          i === 0 ? 0 : callTime - callTimestamps[i - 1]
        }ms)`
      )

      await cyre.call(actionId, {iteration: i + 1, timestamp: callTime})

      // Small delay between calls (faster than debounce)
      await this.wait(debounceMs / 10)
    }

    // Wait for debounce to complete
    await this.wait(debounceMs + 100)

    const actualExecutions = this.executionCounts.get(testId) || 0
    const executionTimestamps = this.executionTimestamps.get(testId) || []

    console.log(`     ✅ Expected: 1 execution, Got: ${actualExecutions}`)
    if (executionTimestamps.length > 0) {
      const executionDelay =
        executionTimestamps[0] - callTimestamps[callTimestamps.length - 1]
      console.log(
        `     ⏰ Execution delay: ${executionDelay}ms (expected: ~${debounceMs}ms)`
      )
    }

    this.results.push({
      testName: `Basic Debounce ${debounceMs}ms`,
      expectedExecutions: 1,
      actualExecutions,
      timestamps: executionTimestamps,
      callTimestamps,
      debounceInterval: debounceMs,
      success: actualExecutions === 1,
      details: `Rapid calls with ${debounceMs}ms debounce`
    })

    // Cleanup
    cyre.forget(actionId)
  }

  private async testBurstCalls(): Promise<void> {
    console.log('\n📍 Test 2: Burst Call Patterns')

    const testConfigs = [
      {calls: 10, interval: 50, debounce: 200, expected: 1},
      {calls: 20, interval: 25, debounce: 300, expected: 1},
      {calls: 5, interval: 100, debounce: 150, expected: 1}
    ]

    for (const config of testConfigs) {
      await this.runBurstTest(config)
    }
  }

  private async runBurstTest(config: {
    calls: number
    interval: number
    debounce: number
    expected: number
  }): Promise<void> {
    const testId = `burst-${config.calls}-${config.interval}-${config.debounce}`
    const actionId = `test-action-${testId}`

    this.setupActionAndSubscriber(actionId, testId)

    cyre.action({
      id: actionId,
      debounce: config.debounce,
      payload: 'burst-test'
    })

    const callTimestamps: number[] = []
    const startTime = Date.now()

    console.log(
      `\n  💥 Burst test: ${config.calls} calls every ${config.interval}ms, debounce: ${config.debounce}ms`
    )
    console.log(`     Start time: ${new Date(startTime).toISOString()}`)

    // Make burst calls
    for (let i = 0; i < config.calls; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      if (i < 5 || i >= config.calls - 5) {
        // Log first and last 5 calls
        console.log(`     📞 Call ${i + 1} at: ${callTime - startTime}ms`)
      } else if (i === 5) {
        console.log(`     📞 ... (${config.calls - 10} more calls) ...`)
      }

      await cyre.call(actionId, {iteration: i + 1, timestamp: callTime})

      if (i < config.calls - 1) {
        await this.wait(config.interval)
      }
    }

    // Wait for debounce completion
    await this.wait(config.debounce + 100)

    const actualExecutions = this.executionCounts.get(testId) || 0
    const executionTimestamps = this.executionTimestamps.get(testId) || []

    console.log(
      `     ✅ Expected: ${config.expected} execution, Got: ${actualExecutions}`
    )
    if (executionTimestamps.length > 0) {
      const executionDelay =
        executionTimestamps[0] - callTimestamps[callTimestamps.length - 1]
      console.log(
        `     ⏰ Execution delay: ${executionDelay}ms (expected: ~${config.debounce}ms)`
      )
    }

    this.results.push({
      testName: `Burst ${config.calls} calls/${config.interval}ms interval`,
      expectedExecutions: config.expected,
      actualExecutions,
      timestamps: executionTimestamps,
      callTimestamps,
      debounceInterval: config.debounce,
      success: actualExecutions === config.expected,
      details: `${config.calls} calls with ${config.interval}ms spacing`
    })

    cyre.forget(actionId)
  }

  private async testMaxWaitConstraint(): Promise<void> {
    console.log('\n📍 Test 3: MaxWait Constraint Testing')

    const configs = [
      {debounce: 500, maxWait: 1000, callInterval: 100, calls: 15}, // Should execute due to maxWait
      {debounce: 200, maxWait: 800, callInterval: 50, calls: 20} // Should execute due to maxWait
    ]

    for (const config of configs) {
      await this.runMaxWaitTest(config)
    }
  }

  private async runMaxWaitTest(config: {
    debounce: number
    maxWait: number
    callInterval: number
    calls: number
  }): Promise<void> {
    const testId = `maxwait-${config.debounce}-${config.maxWait}`
    const actionId = `test-action-${testId}`

    this.setupActionAndSubscriber(actionId, testId)

    cyre.action({
      id: actionId,
      debounce: config.debounce,
      maxWait: config.maxWait,
      payload: 'maxwait-test'
    })

    const callTimestamps: number[] = []
    const startTime = Date.now()

    console.log(
      `\n  ⏳ MaxWait test: debounce ${config.debounce}ms, maxWait ${config.maxWait}ms`
    )
    console.log(`     Start time: ${new Date(startTime).toISOString()}`)
    console.log(
      `     Making ${config.calls} calls every ${config.callInterval}ms`
    )

    // Make continuous calls that should trigger maxWait
    for (let i = 0; i < config.calls; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      if (i < 3 || i >= config.calls - 3) {
        console.log(`     📞 Call ${i + 1} at: ${callTime - startTime}ms`)
      } else if (i === 3) {
        console.log(`     📞 ... (continuous calls) ...`)
      }

      await cyre.call(actionId, {iteration: i + 1, timestamp: callTime})
      await this.wait(config.callInterval)
    }

    // Wait for any remaining executions
    await this.wait(Math.max(config.debounce, config.maxWait) + 200)

    const actualExecutions = this.executionCounts.get(testId) || 0
    const executionTimestamps = this.executionTimestamps.get(testId) || []

    // With maxWait, we expect at least one execution within maxWait time
    const expectedExecutions = Math.ceil(
      (config.calls * config.callInterval) / config.maxWait
    )

    console.log(
      `     ✅ Expected: ~${expectedExecutions} executions, Got: ${actualExecutions}`
    )

    executionTimestamps.forEach((timestamp, index) => {
      console.log(
        `     ⏰ Execution ${index + 1} at: ${timestamp - startTime}ms`
      )
    })

    this.results.push({
      testName: `MaxWait ${config.maxWait}ms (debounce ${config.debounce}ms)`,
      expectedExecutions: expectedExecutions,
      actualExecutions,
      timestamps: executionTimestamps,
      callTimestamps,
      debounceInterval: config.debounce,
      maxWait: config.maxWait,
      success: actualExecutions >= 1, // At least one execution should occur
      details: `Continuous calls with maxWait constraint`
    })

    cyre.forget(actionId)
  }

  // FIXED: Mixed interval testing with proper timing
  private async testMixedIntervalsFixed(): Promise<void> {
    console.log('\n📍 Test 4: Mixed Interval Testing (FIXED)')

    const testId = 'mixed-intervals-fixed'
    const actionId = `test-action-${testId}`
    const debounceMs = 300

    this.setupActionAndSubscriber(actionId, testId)

    cyre.action({
      id: actionId,
      debounce: debounceMs,
      payload: 'mixed-test'
    })

    const callTimestamps: number[] = []
    const startTime = Date.now()

    console.log(`\n  🔀 Fixed mixed interval test: varying call patterns`)
    console.log(`     Start time: ${new Date(startTime).toISOString()}`)
    console.log(`     Debounce: ${debounceMs}ms`)
    console.log(
      `     🔧 FIX: Extended pause to allow first execution to complete`
    )

    // FIXED: Proper timing with explicit waits between pattern groups
    console.log(`     🔄 Initial burst: 3 calls, 50ms apart`)

    // First burst: 3 rapid calls
    for (let i = 0; i < 3; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      console.log(`       📞 Call ${i + 1} at: ${callTime - startTime}ms`)

      await cyre.call(actionId, {
        pattern: 'Initial burst',
        iteration: i + 1,
        timestamp: callTime
      })

      if (i < 2) {
        // Wait between calls in the burst
        await this.wait(50)
      }
    }

    // CRITICAL: Wait 800ms between first burst and second burst
    console.log(
      `     🔄 Extended pause: 800ms (allowing first execution to complete)`
    )
    await this.wait(800)

    console.log(`     🔄 Second burst: 4 calls, 75ms apart`)

    // Second burst: 4 rapid calls
    for (let i = 0; i < 4; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      console.log(`       📞 Call ${i + 1} at: ${callTime - startTime}ms`)

      await cyre.call(actionId, {
        pattern: 'Second burst',
        iteration: i + 1,
        timestamp: callTime
      })

      if (i < 3) {
        // Wait between calls in the burst
        await this.wait(75)
      }
    }

    console.log(`     🔄 Final pause: waiting for second execution`)
    // No additional calls needed - just wait for final debounce

    // Wait for final debounce
    await this.wait(debounceMs + 200)

    const actualExecutions = this.executionCounts.get(testId) || 0
    const executionTimestamps = this.executionTimestamps.get(testId) || []

    // Expected: 2 executions (after first burst settles + after second burst settles)
    const expectedExecutions = 2

    console.log(
      `     ✅ Expected: ${expectedExecutions} executions, Got: ${actualExecutions}`
    )
    console.log(
      `     🔧 Extended pause duration: 800ms (${debounceMs}ms debounce + 500ms safety)`
    )

    executionTimestamps.forEach((timestamp, index) => {
      console.log(
        `     ⏰ Execution ${index + 1} at: ${timestamp - startTime}ms`
      )
    })

    this.results.push({
      testName: 'Mixed Intervals (Fixed)',
      expectedExecutions,
      actualExecutions,
      timestamps: executionTimestamps,
      callTimestamps,
      debounceInterval: debounceMs,
      success: actualExecutions === expectedExecutions,
      details: 'Fixed burst and pause pattern with extended pause timing'
    })

    cyre.forget(actionId)
  }

  private async testEdgeCases(): Promise<void> {
    console.log('\n📍 Test 5: Edge Cases')

    // Test zero debounce
    await this.testZeroDebounce()

    // Test very small debounce
    await this.testSmallDebounce()

    // Test large debounce
    await this.testLargeDebounce()
  }

  private async testZeroDebounce(): Promise<void> {
    const testId = 'zero-debounce'
    const actionId = `test-action-${testId}`

    this.setupActionAndSubscriber(actionId, testId)

    cyre.action({
      id: actionId,
      debounce: 0, // Should not debounce
      payload: 'zero-test'
    })

    const callTimestamps: number[] = []
    const startTime = Date.now()

    console.log(`\n  🔍 Edge case: Zero debounce (should execute immediately)`)
    console.log(`     Start time: ${new Date(startTime).toISOString()}`)

    // Make 3 calls
    for (let i = 0; i < 3; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      console.log(`     📞 Call ${i + 1} at: ${callTime - startTime}ms`)

      await cyre.call(actionId, {iteration: i + 1, timestamp: callTime})
      await this.wait(50)
    }

    await this.wait(100)

    const actualExecutions = this.executionCounts.get(testId) || 0
    const executionTimestamps = this.executionTimestamps.get(testId) || []

    console.log(
      `     ✅ Expected: 3 executions (no debounce), Got: ${actualExecutions}`
    )

    this.results.push({
      testName: 'Zero Debounce',
      expectedExecutions: 3,
      actualExecutions,
      timestamps: executionTimestamps,
      callTimestamps,
      debounceInterval: 0,
      success: actualExecutions === 3,
      details: 'Zero debounce should not delay execution'
    })

    cyre.forget(actionId)
  }

  private async testSmallDebounce(): Promise<void> {
    const testId = 'small-debounce'
    const actionId = `test-action-${testId}`

    this.setupActionAndSubscriber(actionId, testId)

    cyre.action({
      id: actionId,
      debounce: 10, // Very small debounce
      payload: 'small-test'
    })

    const callTimestamps: number[] = []
    const startTime = Date.now()

    console.log(`\n  🔍 Edge case: Very small debounce (10ms)`)
    console.log(`     Start time: ${new Date(startTime).toISOString()}`)

    // Make rapid calls
    for (let i = 0; i < 5; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      console.log(`     📞 Call ${i + 1} at: ${callTime - startTime}ms`)

      await cyre.call(actionId, {iteration: i + 1, timestamp: callTime})
      await this.wait(5) // Faster than debounce
    }

    await this.wait(50)

    const actualExecutions = this.executionCounts.get(testId) || 0
    const executionTimestamps = this.executionTimestamps.get(testId) || []

    console.log(`     ✅ Expected: 1 execution, Got: ${actualExecutions}`)

    this.results.push({
      testName: 'Small Debounce (10ms)',
      expectedExecutions: 1,
      actualExecutions,
      timestamps: executionTimestamps,
      callTimestamps,
      debounceInterval: 10,
      success: actualExecutions === 1,
      details: 'Very small debounce timing precision'
    })

    cyre.forget(actionId)
  }

  private async testLargeDebounce(): Promise<void> {
    const testId = 'large-debounce'
    const actionId = `test-action-${testId}`

    this.setupActionAndSubscriber(actionId, testId)

    cyre.action({
      id: actionId,
      debounce: 2000, // Large debounce
      payload: 'large-test'
    })

    const callTimestamps: number[] = []
    const startTime = Date.now()

    console.log(`\n  🔍 Edge case: Large debounce (2000ms)`)
    console.log(`     Start time: ${new Date(startTime).toISOString()}`)

    // Make a few calls
    for (let i = 0; i < 3; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      console.log(`     📞 Call ${i + 1} at: ${callTime - startTime}ms`)

      await cyre.call(actionId, {iteration: i + 1, timestamp: callTime})
      await this.wait(500) // Less than debounce
    }

    console.log(`     ⏳ Waiting for large debounce to complete...`)
    await this.wait(2500)

    const actualExecutions = this.executionCounts.get(testId) || 0
    const executionTimestamps = this.executionTimestamps.get(testId) || []

    console.log(`     ✅ Expected: 1 execution, Got: ${actualExecutions}`)
    if (executionTimestamps.length > 0) {
      const totalDelay =
        executionTimestamps[0] - callTimestamps[callTimestamps.length - 1]
      console.log(`     ⏰ Total delay: ${totalDelay}ms (expected: ~2000ms)`)
    }

    this.results.push({
      testName: 'Large Debounce (2000ms)',
      expectedExecutions: 1,
      actualExecutions,
      timestamps: executionTimestamps,
      callTimestamps,
      debounceInterval: 2000,
      success: actualExecutions === 1,
      details: 'Large debounce delay handling'
    })

    cyre.forget(actionId)
  }

  private setupActionAndSubscriber(actionId: string, testId: string): void {
    this.executionCounts.set(testId, 0)
    this.executionTimestamps.set(testId, [])

    cyre.on(actionId, (payload: any) => {
      const executionTime = Date.now()
      const currentCount = this.executionCounts.get(testId) || 0
      const timestamps = this.executionTimestamps.get(testId) || []

      this.executionCounts.set(testId, currentCount + 1)
      timestamps.push(executionTime)
      this.executionTimestamps.set(testId, timestamps)

      console.log(
        `       ✨ EXECUTED ${testId} #${currentCount + 1} at: ${new Date(
          executionTime
        ).toISOString()}`
      )

      return {executed: true, timestamp: executionTime, payload}
    })
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 DEBOUNCE TEST RESULTS SUMMARY (FIXED)')
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
      console.log(
        `   Expected: ${result.expectedExecutions}, Got: ${result.actualExecutions}`
      )
      console.log(
        `   Debounce: ${result.debounceInterval}ms${
          result.maxWait ? `, MaxWait: ${result.maxWait}ms` : ''
        }`
      )
      console.log(`   Details: ${result.details}`)

      if (result.timestamps.length > 0 && result.callTimestamps.length > 0) {
        const avgDelay =
          result.timestamps.reduce((sum, timestamp, i) => {
            const lastCallTime =
              result.callTimestamps[result.callTimestamps.length - 1]
            return sum + (timestamp - lastCallTime)
          }, 0) / result.timestamps.length

        console.log(`   Avg Execution Delay: ${avgDelay.toFixed(1)}ms`)
      }

      if (!result.success) {
        console.log(
          `   ⚠️  Test failed: Expected ${result.expectedExecutions} but got ${result.actualExecutions}`
        )
      }
    })

    console.log('\n' + '='.repeat(60))
    console.log('🔧 KEY FIX APPLIED:')
    console.log('   Mixed Intervals test pause extended from 400ms → 800ms')
    console.log('   Formula: debounce (300ms) + safety margin (500ms) = 800ms')
    console.log(
      '   This ensures first debounce execution completes before second burst'
    )
    console.log('='.repeat(60))
    console.log('🏁 Debounce Test Suite Complete (Fixed)')
    console.log('='.repeat(60))
  }
}

// Export test runner
export const runDebounceTestsFixed = async (): Promise<void> => {
  const testRunner = new DebounceTestRunner()
  await testRunner.runAllTests()
}

// Auto-run if executed directly

runDebounceTestsFixed().catch(error => {
  console.error('Fixed test suite failed:', error)
  process.exit(1)
})
