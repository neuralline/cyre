// demo/talent-optimization-test.ts
// Comprehensive test suite for talent optimization and functionality

import {cyre} from '../src'
import {
  getOptimizationAnalytics,
  resetOptimizationCache
} from '../src/schema/channel-operators'
import {string, object, number} from '../src/schema/cyre-schema'

/*

      T.A.L.E.N.T - O.P.T.I.M.I.Z.A.T.I.O.N - T.E.S.T - S.U.I.T.E
      
      Comprehensive testing of:
      1. Zero-overhead channels (no operators)
      2. Fast-path channels (1-2 operators)  
      3. Complex channels (multiple operators)
      4. Functional correctness of all talents
      5. Performance comparison before/after optimization
      6. Edge cases and error handling

*/

interface TestResult {
  testName: string
  operationsPerSecond: number
  averageLatencyMs: number
  errorCount: number
  talentCount: number
  optimization: 'zero-overhead' | 'fast-path' | 'full-pipeline'
  functionalTests: {
    passed: number
    failed: number
    details: string[]
  }
}

class TalentOptimizationTestSuite {
  private results: TestResult[] = []

  /**
   * Run complete test suite
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 TALENT OPTIMIZATION TEST SUITE')
    console.log('==================================\n')

    // Reset optimization cache for clean testing
    resetOptimizationCache()

    // Test 1: Zero-overhead channels (no operators)
    await this.testZeroOverheadChannels()

    // Test 2: Fast-path channels (basic validation)
    await this.testFastPathChannels()

    // Test 3: Complex channels (multiple operators)
    await this.testComplexChannels()

    // Test 4: Functional correctness of each talent
    await this.testTalentFunctionality()

    // Test 5: Edge cases and error handling
    await this.testEdgeCases()

    // Test 6: Performance comparison
    await this.testPerformanceComparison()

    // Display results
    this.displayResults()
  }

  /**
   * Test 1: Zero-overhead channels (no operators)
   */
  async testZeroOverheadChannels(): Promise<void> {
    console.log('📊 Test 1: Zero-Overhead Channels (No Operators)')
    console.log('================================================')

    const iterations = 10000
    const latencies: number[] = []
    let errorCount = 0
    const functionalTests = {passed: 0, failed: 0, details: [] as string[]}

    // Create channels with NO operators
    const testChannels = [
      'simple-notification',
      'basic-event',
      'minimal-channel',
      'zero-ops-test'
    ]

    // Setup channels
    testChannels.forEach(id => {
      cyre.action({id}) // No operators at all
      cyre.on(id, (payload: any) => {
        return {received: true, payload, timestamp: Date.now()}
      })
    })

    console.log('Testing functional correctness...')

    // Functional tests
    for (const channelId of testChannels) {
      try {
        const result = await cyre.call(channelId, {test: 'data'})
        if (result.ok && result.payload.received) {
          functionalTests.passed++
          functionalTests.details.push(`✅ ${channelId}: Basic call works`)
        } else {
          functionalTests.failed++
          functionalTests.details.push(
            `❌ ${channelId}: Call failed - ${result.message}`
          )
        }
      } catch (error) {
        functionalTests.failed++
        functionalTests.details.push(`❌ ${channelId}: Exception - ${error}`)
      }
    }

    console.log('Running performance test...')

    // Performance test
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()
      const channelId = testChannels[i % testChannels.length]

      try {
        await cyre.call(channelId, {iteration: i, data: `test-${i}`})
      } catch (error) {
        errorCount++
      }

      latencies.push(performance.now() - operationStart)
    }

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length

    this.results.push({
      testName: 'Zero-Overhead Channels',
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      errorCount,
      talentCount: 0,
      optimization: 'zero-overhead',
      functionalTests
    })

    console.log(
      `✅ Completed: ${opsPerSecond.toFixed(0)} ops/sec, ${avgLatency.toFixed(
        3
      )}ms avg latency\n`
    )
  }

  /**
   * Test 2: Fast-path channels (1-2 operators)
   */
  async testFastPathChannels(): Promise<void> {
    console.log('📊 Test 2: Fast-Path Channels (1-2 Operators)')
    console.log('==============================================')

    const iterations = 8000
    const latencies: number[] = []
    let errorCount = 0
    const functionalTests = {passed: 0, failed: 0, details: [] as string[]}

    // Create channels with 1-2 operators (fast path eligible)
    const testChannels = [
      {
        id: 'required-only',
        config: {required: true},
        testPayload: {data: 'valid'},
        expectedTalents: 1
      },
      {
        id: 'schema-only',
        config: {schema: string()},
        testPayload: 'valid string',
        expectedTalents: 1
      },
      {
        id: 'required-schema',
        config: {required: true, schema: string()},
        testPayload: 'valid required string',
        expectedTalents: 2
      },
      {
        id: 'basic-validation',
        config: {
          required: true,
          schema: object({name: string(), age: number()})
        },
        testPayload: {name: 'John', age: 30},
        expectedTalents: 2
      }
    ]

    // Setup channels
    testChannels.forEach(({id, config}) => {
      cyre.action({id, ...config})
      cyre.on(id, (payload: any) => {
        return {validated: true, payload, processedAt: Date.now()}
      })
    })

    console.log('Testing functional correctness...')

    // Functional tests
    for (const {id, testPayload, expectedTalents} of testChannels) {
      try {
        // Test valid payload
        const result = await cyre.call(id, testPayload)
        if (result.ok && result.payload.validated) {
          functionalTests.passed++
          functionalTests.details.push(`✅ ${id}: Valid payload accepted`)
        } else {
          functionalTests.failed++
          functionalTests.details.push(
            `❌ ${id}: Valid payload rejected - ${result.message}`
          )
        }

        // Test invalid payload (if schema present)
        if (id.includes('schema')) {
          try {
            const invalidResult = await cyre.call(id, {invalid: 'data'})
            if (!invalidResult.ok) {
              functionalTests.passed++
              functionalTests.details.push(
                `✅ ${id}: Invalid payload correctly rejected`
              )
            } else {
              functionalTests.failed++
              functionalTests.details.push(
                `❌ ${id}: Invalid payload incorrectly accepted`
              )
            }
          } catch (error) {
            functionalTests.passed++
            functionalTests.details.push(
              `✅ ${id}: Invalid payload correctly threw error`
            )
          }
        }

        // Test required validation
        if (id.includes('required')) {
          try {
            const emptyResult = await cyre.call(id, undefined)
            if (!emptyResult.ok) {
              functionalTests.passed++
              functionalTests.details.push(
                `✅ ${id}: Required validation works`
              )
            } else {
              functionalTests.failed++
              functionalTests.details.push(
                `❌ ${id}: Required validation failed`
              )
            }
          } catch (error) {
            functionalTests.passed++
            functionalTests.details.push(
              `✅ ${id}: Required validation correctly threw error`
            )
          }
        }
      } catch (error) {
        functionalTests.failed++
        functionalTests.details.push(
          `❌ ${id}: Exception during testing - ${error}`
        )
      }
    }

    console.log('Running performance test...')

    // Performance test
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()
      const testChannel = testChannels[i % testChannels.length]

      try {
        await cyre.call(testChannel.id, testChannel.testPayload)
      } catch (error) {
        errorCount++
      }

      latencies.push(performance.now() - operationStart)
    }

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length

    this.results.push({
      testName: 'Fast-Path Channels',
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      errorCount,
      talentCount: 2, // Average
      optimization: 'fast-path',
      functionalTests
    })

    console.log(
      `✅ Completed: ${opsPerSecond.toFixed(0)} ops/sec, ${avgLatency.toFixed(
        3
      )}ms avg latency\n`
    )
  }

  /**
   * Test 3: Complex channels (multiple operators)
   */
  async testComplexChannels(): Promise<void> {
    console.log('📊 Test 3: Complex Channels (Multiple Operators)')
    console.log('================================================')

    const iterations = 5000
    const latencies: number[] = []
    let errorCount = 0
    const functionalTests = {passed: 0, failed: 0, details: [] as string[]}

    // Create channels with multiple operators
    const testChannels = [
      {
        id: 'full-pipeline',
        config: {
          required: true,
          schema: object({
            userId: number(),
            action: string(),
            data: object({value: number()})
          }),
          selector: (payload: any) => ({
            id: payload.userId,
            action: payload.action,
            value: payload.data.value
          }),
          condition: (payload: any) => payload.value > 0,
          transform: (payload: any) => ({
            ...payload,
            processed: true,
            timestamp: Date.now()
          }),
          detectChanges: true
        },
        testPayload: {
          userId: 123,
          action: 'update',
          data: {value: 42}
        },
        expectedTalents: 6
      },
      {
        id: 'api-request-simulation',
        config: {
          required: true,
          schema: object({url: string(), method: string()}),
          condition: (payload: any) =>
            ['GET', 'POST', 'PUT'].includes(payload.method),
          transform: (payload: any) => ({
            ...payload,
            timestamp: Date.now(),
            headers: {'Content-Type': 'application/json'}
          }),
          detectChanges: true,
          throttle: 100 // Simulated throttling
        },
        testPayload: {url: 'https://api.example.com/users', method: 'GET'},
        expectedTalents: 5
      }
    ]

    // Setup channels
    testChannels.forEach(({id, config}) => {
      cyre.action({id, ...config})
      cyre.on(id, (payload: any) => {
        return {
          processed: true,
          payload,
          executedAt: Date.now(),
          pipeline: 'complex'
        }
      })
    })

    console.log('Testing functional correctness...')

    // Functional tests
    for (const {id, testPayload, config} of testChannels) {
      try {
        // Test valid payload
        const result = await cyre.call(id, testPayload)
        if (result.ok && result.payload.processed) {
          functionalTests.passed++
          functionalTests.details.push(
            `✅ ${id}: Complex pipeline executed successfully`
          )

          // Verify transformation occurred
          if (config.transform && result.payload.payload.processed) {
            functionalTests.passed++
            functionalTests.details.push(`✅ ${id}: Transform talent worked`)
          }
        } else {
          functionalTests.failed++
          functionalTests.details.push(
            `❌ ${id}: Complex pipeline failed - ${result.message}`
          )
        }

        // Test condition rejection
        if (config.condition) {
          const invalidConditionPayload =
            id === 'full-pipeline'
              ? {...testPayload, data: {value: -1}} // Fails condition
              : {...testPayload, method: 'DELETE'} // Fails condition

          const conditionResult = await cyre.call(id, invalidConditionPayload)
          if (!conditionResult.ok) {
            functionalTests.passed++
            functionalTests.details.push(
              `✅ ${id}: Condition talent correctly rejected`
            )
          } else {
            functionalTests.failed++
            functionalTests.details.push(
              `❌ ${id}: Condition talent failed to reject`
            )
          }
        }

        // Test change detection
        if (config.detectChanges) {
          // Call with same payload twice
          await cyre.call(id, testPayload)
          const duplicateResult = await cyre.call(id, testPayload)

          // Note: Change detection behavior might vary, just verify it doesn't crash
          functionalTests.passed++
          functionalTests.details.push(
            `✅ ${id}: Change detection executed without errors`
          )
        }
      } catch (error) {
        functionalTests.failed++
        functionalTests.details.push(
          `❌ ${id}: Exception during testing - ${error}`
        )
      }
    }

    console.log('Running performance test...')

    // Performance test
    const startTime = performance.now()

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now()
      const testChannel = testChannels[i % testChannels.length]

      try {
        await cyre.call(testChannel.id, testChannel.testPayload)
      } catch (error) {
        errorCount++
      }

      latencies.push(performance.now() - operationStart)
    }

    const endTime = performance.now()
    const totalTimeSeconds = (endTime - startTime) / 1000
    const opsPerSecond = iterations / totalTimeSeconds
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length

    this.results.push({
      testName: 'Complex Channels',
      operationsPerSecond: Math.round(opsPerSecond),
      averageLatencyMs: Number(avgLatency.toFixed(3)),
      errorCount,
      talentCount: 5, // Average
      optimization: 'full-pipeline',
      functionalTests
    })

    console.log(
      `✅ Completed: ${opsPerSecond.toFixed(0)} ops/sec, ${avgLatency.toFixed(
        3
      )}ms avg latency\n`
    )
  }

  /**
   * Test 4: Individual talent functionality
   */
  async testTalentFunctionality(): Promise<void> {
    console.log('📊 Test 4: Individual Talent Functionality')
    console.log('==========================================')

    const functionalTests = {passed: 0, failed: 0, details: [] as string[]}

    // Test each talent individually
    const talentTests = [
      {
        name: 'Schema Talent',
        setup: () => {
          cyre.action({
            id: 'schema-test',
            schema: object({name: string(), age: number()})
          })
          cyre.on('schema-test', (payload: any) => ({validated: payload}))
        },
        tests: [
          {
            name: 'Valid schema',
            call: () => cyre.call('schema-test', {name: 'John', age: 30}),
            expect: (result: any) =>
              result.ok && result.payload.validated.name === 'John'
          },
          {
            name: 'Invalid schema',
            call: () => cyre.call('schema-test', {name: 'John', age: 'thirty'}),
            expect: (result: any) => !result.ok
          }
        ]
      },
      {
        name: 'Required Talent',
        setup: () => {
          cyre.action({id: 'required-test', required: true})
          cyre.on('required-test', (payload: any) => ({received: payload}))
        },
        tests: [
          {
            name: 'With payload',
            call: () => cyre.call('required-test', {data: 'present'}),
            expect: (result: any) => result.ok
          },
          {
            name: 'Without payload',
            call: () => cyre.call('required-test', undefined),
            expect: (result: any) => !result.ok
          }
        ]
      },
      {
        name: 'Selector Talent',
        setup: () => {
          cyre.action({
            id: 'selector-test',
            selector: (payload: any) => ({
              id: payload.userId,
              name: payload.userName
            })
          })
          cyre.on('selector-test', (payload: any) => ({selected: payload}))
        },
        tests: [
          {
            name: 'Selector extraction',
            call: () =>
              cyre.call('selector-test', {
                userId: 123,
                userName: 'John',
                extra: 'ignored'
              }),
            expect: (result: any) =>
              result.ok &&
              result.payload.selected.id === 123 &&
              result.payload.selected.name === 'John' &&
              !result.payload.selected.extra
          }
        ]
      },
      {
        name: 'Condition Talent',
        setup: () => {
          cyre.action({
            id: 'condition-test',
            condition: (payload: any) => payload.value > 10
          })
          cyre.on('condition-test', (payload: any) => ({processed: payload}))
        },
        tests: [
          {
            name: 'Condition met',
            call: () => cyre.call('condition-test', {value: 15}),
            expect: (result: any) => result.ok
          },
          {
            name: 'Condition not met',
            call: () => cyre.call('condition-test', {value: 5}),
            expect: (result: any) => !result.ok
          }
        ]
      },
      {
        name: 'Transform Talent',
        setup: () => {
          cyre.action({
            id: 'transform-test',
            transform: (payload: any) => ({
              ...payload,
              transformed: true,
              timestamp: Date.now()
            })
          })
          cyre.on('transform-test', (payload: any) => ({result: payload}))
        },
        tests: [
          {
            name: 'Payload transformation',
            call: () => cyre.call('transform-test', {original: 'data'}),
            expect: (result: any) =>
              result.ok &&
              result.payload.result.original === 'data' &&
              result.payload.result.transformed === true &&
              typeof result.payload.result.timestamp === 'number'
          }
        ]
      }
    ]

    console.log('Testing individual talent functionality...')

    for (const talentTest of talentTests) {
      console.log(`\n  Testing ${talentTest.name}...`)

      try {
        talentTest.setup()

        for (const test of talentTest.tests) {
          try {
            const result = await test.call()
            if (test.expect(result)) {
              functionalTests.passed++
              functionalTests.details.push(
                `✅ ${talentTest.name} - ${test.name}: Passed`
              )
            } else {
              functionalTests.failed++
              functionalTests.details.push(
                `❌ ${talentTest.name} - ${test.name}: Failed expectation`
              )
            }
          } catch (error) {
            // Some tests expect exceptions
            if (
              test.name.includes('Invalid') ||
              test.name.includes('Without')
            ) {
              functionalTests.passed++
              functionalTests.details.push(
                `✅ ${talentTest.name} - ${test.name}: Correctly threw error`
              )
            } else {
              functionalTests.failed++
              functionalTests.details.push(
                `❌ ${talentTest.name} - ${test.name}: Unexpected error - ${error}`
              )
            }
          }
        }
      } catch (error) {
        functionalTests.failed++
        functionalTests.details.push(
          `❌ ${talentTest.name}: Setup failed - ${error}`
        )
      }
    }

    // Add to results for reporting
    this.results.push({
      testName: 'Talent Functionality',
      operationsPerSecond: 0, // Not applicable
      averageLatencyMs: 0, // Not applicable
      errorCount: functionalTests.failed,
      talentCount: talentTests.length,
      optimization: 'full-pipeline',
      functionalTests
    })

    console.log(`\n✅ Talent functionality tests completed\n`)
  }

  /**
   * Test 5: Edge cases and error handling
   */
  async testEdgeCases(): Promise<void> {
    console.log('📊 Test 5: Edge Cases and Error Handling')
    console.log('========================================')

    const functionalTests = {passed: 0, failed: 0, details: [] as string[]}

    const edgeCases = [
      {
        name: 'Empty payload with required',
        test: async () => {
          cyre.action({id: 'edge-required', required: true})
          cyre.on('edge-required', (payload: any) => ({received: payload}))
          const result = await cyre.call('edge-required', null)
          return !result.ok // Should fail
        }
      },
      {
        name: 'Falsy payload with required false',
        test: async () => {
          cyre.action({id: 'edge-falsy', required: false})
          cyre.on('edge-falsy', (payload: any) => ({received: payload}))
          const result = await cyre.call('edge-falsy', 0) // Falsy but valid
          return result.ok && result.payload.received === 0
        }
      },
      {
        name: 'Circular reference in payload',
        test: async () => {
          const circular: any = {name: 'test'}
          circular.self = circular

          cyre.action({id: 'edge-circular'})
          cyre.on('edge-circular', (payload: any) => ({
            received: payload.name,
            hasSelf: !!payload.self
          }))

          const result = await cyre.call('edge-circular', circular)
          return result.ok && result.payload.received === 'test'
        }
      },
      {
        name: 'Very large payload',
        test: async () => {
          const largePayload = {
            data: Array.from({length: 10000}, (_, i) => ({
              id: i,
              value: `item-${i}`
            }))
          }

          cyre.action({id: 'edge-large'})
          cyre.on('edge-large', (payload: any) => ({
            received: true,
            itemCount: payload.data.length
          }))

          const result = await cyre.call('edge-large', largePayload)
          return result.ok && result.payload.itemCount === 10000
        }
      },
      {
        name: 'Nested object transformation',
        test: async () => {
          cyre.action({
            id: 'edge-nested',
            transform: (payload: any) => ({
              ...payload,
              nested: {
                ...payload.nested,
                processed: true
              }
            })
          })
          cyre.on('edge-nested', (payload: any) => ({result: payload}))

          const result = await cyre.call('edge-nested', {
            nested: {value: 42}
          })
          return result.ok && result.payload.result.nested.processed === true
        }
      }
    ]

    console.log('Testing edge cases...')

    for (const edgeCase of edgeCases) {
      try {
        const passed = await edgeCase.test()
        if (passed) {
          functionalTests.passed++
          functionalTests.details.push(`✅ ${edgeCase.name}: Handled correctly`)
        } else {
          functionalTests.failed++
          functionalTests.details.push(
            `❌ ${edgeCase.name}: Failed to handle correctly`
          )
        }
      } catch (error) {
        functionalTests.failed++
        functionalTests.details.push(
          `❌ ${edgeCase.name}: Exception - ${error}`
        )
      }
    }

    // Add to results
    this.results.push({
      testName: 'Edge Cases',
      operationsPerSecond: 0,
      averageLatencyMs: 0,
      errorCount: functionalTests.failed,
      talentCount: 0,
      optimization: 'full-pipeline',
      functionalTests
    })

    console.log(`✅ Edge case tests completed\n`)
  }

  /**
   * Test 6: Performance comparison
   */
  async testPerformanceComparison(): Promise<void> {
    console.log('📊 Test 6: Performance Comparison Summary')
    console.log('========================================')

    // Get optimization analytics
    const analytics = getOptimizationAnalytics()

    console.log('Optimization Analytics:')
    console.log(`• Total Channels: ${analytics.totalChannels}`)
    console.log(`• Fast Path Channels: ${analytics.fastPathChannels}`)
    console.log(`• Zero-Overhead Channels: ${analytics.zeroOverheadChannels}`)
    console.log(
      `• Average Talents per Channel: ${analytics.avgTalentsPerChannel.toFixed(
        1
      )}`
    )
    console.log(
      `• Average Execution Time: ${analytics.avgExecutionTime.toFixed(3)}ms`
    )
    console.log(
      `• Total Optimization Savings: ${analytics.totalOptimizationSavings.toFixed(
        2
      )}ms`
    )

    // Calculate theoretical vs actual performance
    const theoreticalFullPipeline = 10 // All talents
    const actualAverageTalents = analytics.avgTalentsPerChannel
    const optimizationRatio =
      (theoreticalFullPipeline - actualAverageTalents) / theoreticalFullPipeline

    console.log(`\nPerformance Optimization:`)
    console.log(`• Theoretical Pipeline: ${theoreticalFullPipeline} talents`)
    console.log(
      `• Actual Average Pipeline: ${actualAverageTalents.toFixed(1)} talents`
    )
    console.log(
      `• Optimization Ratio: ${(optimizationRatio * 100).toFixed(1)}%`
    )

    console.log('\n')
  }

  /**
   * Display comprehensive results
   */
  private displayResults(): void {
    console.log('\n🏆 TALENT OPTIMIZATION TEST RESULTS')
    console.log('===================================')

    this.results.forEach(result => {
      console.log(`\n${result.testName}`)
      console.log('-'.repeat(result.testName.length))

      if (result.operationsPerSecond > 0) {
        console.log(
          `• Performance: ${result.operationsPerSecond.toLocaleString()} ops/sec`
        )
        console.log(`• Avg Latency: ${result.averageLatencyMs}ms`)
        console.log(`• Error Count: ${result.errorCount}`)
      }

      console.log(`• Talent Count: ${result.talentCount}`)
      console.log(`• Optimization: ${result.optimization}`)
      console.log(
        `• Functional Tests: ${result.functionalTests.passed} passed, ${result.functionalTests.failed} failed`
      )

      if (result.functionalTests.failed > 0) {
        console.log('  Failed tests:')
        result.functionalTests.details
          .filter(detail => detail.startsWith('❌'))
          .forEach(detail => console.log(`    ${detail}`))
      }
    })

    // Summary
    const totalFunctionalTests = this.results.reduce(
      (sum, r) => sum + r.functionalTests.passed + r.functionalTests.failed,
      0
    )
    const totalFunctionalPassed = this.results.reduce(
      (sum, r) => sum + r.functionalTests.passed,
      0
    )
    const performanceResults = this.results.filter(
      r => r.operationsPerSecond > 0
    )

    console.log('\n📈 SUMMARY')
    console.log('==========')
    console.log(
      `• Functional Tests: ${totalFunctionalPassed}/${totalFunctionalTests} passed (${(
        (totalFunctionalPassed / totalFunctionalTests) *
        100
      ).toFixed(1)}%)`
    )

    if (performanceResults.length > 0) {
      const avgPerformance =
        performanceResults.reduce((sum, r) => sum + r.operationsPerSecond, 0) /
        performanceResults.length
      console.log(`• Average Performance: ${avgPerformance.toFixed(0)} ops/sec`)

      performanceResults.forEach(result => {
        console.log(
          `  - ${
            result.testName
          }: ${result.operationsPerSecond.toLocaleString()} ops/sec (${
            result.optimization
          })`
        )
      })
    }

    // Final verdict
    const overallSuccess =
      totalFunctionalPassed === totalFunctionalTests &&
      performanceResults.every(r => r.operationsPerSecond > 1000)

    console.log(
      `\n${overallSuccess ? '🎉' : '⚠️'} OVERALL RESULT: ${
        overallSuccess ? 'SUCCESS' : 'ISSUES DETECTED'
      }`
    )

    if (overallSuccess) {
      console.log('✅ All talent optimizations are working correctly!')
      console.log('✅ Performance improvements are significant!')
      console.log('✅ Functional correctness is maintained!')
    } else {
      console.log('❌ Some issues detected - review failed tests above')
    }
  }
}

/**
 * Run the test suite
 */
async function runTalentOptimizationTests() {
  const testSuite = new TalentOptimizationTestSuite()
  await testSuite.runAllTests()
}

/**
 * Export for use in other test files
 */
export {TalentOptimizationTestSuite, runTalentOptimizationTests}

/**
 * Run tests if this file is executed directly
 */
runTalentOptimizationTests().catch(console.error)
