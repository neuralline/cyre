// benchmark/pipeline-execution-order-test.ts
// File location: /benchmark/pipeline-execution-order-test.ts

/**
 * Pipeline Execution Order Investigation
 *
 * Tests to definitively answer:
 * 1. Does Cyre respect user declaration order of operators?
 * 2. Does Cyre have a fixed internal execution order?
 * 3. What is the actual execution sequence?
 * 4. How does data flow between operators?
 */

import {cyre} from '../src'

class PipelineExecutionOrderTest {
  /**
   * Test 1: Order Tracking Test
   * Track exactly which operators execute and in what order
   */
  async testOperatorExecutionOrder(): Promise<void> {
    console.log('\n🔍 Test 1: Operator Execution Order Tracking')
    console.log('='.repeat(60))

    const executionLog: string[] = []

    // Test different declaration orders
    const testConfigs = [
      {
        name: 'Transform → Selector → Condition',
        config: {
          transform: (payload: any) => {
            executionLog.push('TRANSFORM executed')
            return {...payload, step: 'transform', transformedAt: Date.now()}
          },
          selector: (payload: any) => {
            executionLog.push('SELECTOR executed')
            return {...payload, step: 'selector', selectedAt: Date.now()}
          },
          condition: (payload: any) => {
            executionLog.push('CONDITION executed')
            return payload.age >= 18
          }
        }
      },
      {
        name: 'Condition → Transform → Selector',
        config: {
          condition: (payload: any) => {
            executionLog.push('CONDITION executed')
            return payload.age >= 18
          },
          transform: (payload: any) => {
            executionLog.push('TRANSFORM executed')
            return {...payload, step: 'transform', transformedAt: Date.now()}
          },
          selector: (payload: any) => {
            executionLog.push('SELECTOR executed')
            return {...payload, step: 'selector', selectedAt: Date.now()}
          }
        }
      },
      {
        name: 'Selector → Condition → Transform',
        config: {
          selector: (payload: any) => {
            executionLog.push('SELECTOR executed')
            return {...payload, step: 'selector', selectedAt: Date.now()}
          },
          condition: (payload: any) => {
            executionLog.push('CONDITION executed')
            return payload.age >= 18
          },
          transform: (payload: any) => {
            executionLog.push('TRANSFORM executed')
            return {...payload, step: 'transform', transformedAt: Date.now()}
          }
        }
      }
    ]

    const testData = {name: 'John Doe', age: 25, id: 1}

    for (let i = 0; i < testConfigs.length; i++) {
      const testConfig = testConfigs[i]
      const actionId = `order-test-${i}`

      console.log(`\n🔥 Testing: ${testConfig.name}`)

      // Clear execution log
      executionLog.length = 0

      let finalPayload: any = null

      cyre.action({
        id: actionId,
        ...testConfig.config
      })

      cyre.on(actionId, (payload: any) => {
        executionLog.push('HANDLER executed')
        finalPayload = payload
        console.log(`   ✅ Handler received: ${JSON.stringify(payload)}`)
        return {processed: true}
      })

      try {
        await cyre.call(actionId, testData)

        console.log(`   📋 Execution order: ${executionLog.join(' → ')}`)
        console.log(
          `   📊 Final payload step: ${finalPayload?.step || 'unknown'}`
        )
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
        console.log(
          `   📋 Execution before failure: ${executionLog.join(' → ')}`
        )
      }
    }
  }

  /**
   * Test 2: Data Flow Tracking
   * Track how data changes between operators
   */
  async testDataFlow(): Promise<void> {
    console.log('\n📊 Test 2: Data Flow Between Operators')
    console.log('='.repeat(60))

    const dataFlowLog: Array<{operator: string; input: any; output: any}> = []

    cyre.action({
      id: 'data-flow-test',
      selector: (payload: any) => {
        const input = JSON.parse(JSON.stringify(payload))
        const output = {
          id: payload.id,
          name: payload.name,
          selectedBy: 'selector'
        }
        dataFlowLog.push({operator: 'SELECTOR', input, output})
        return output
      },
      transform: (payload: any) => {
        const input = JSON.parse(JSON.stringify(payload))
        const output = {
          ...payload,
          transformedBy: 'transform',
          timestamp: Date.now()
        }
        dataFlowLog.push({operator: 'TRANSFORM', input, output})
        return output
      },
      condition: (payload: any) => {
        const input = JSON.parse(JSON.stringify(payload))
        const result = payload.id > 0
        dataFlowLog.push({operator: 'CONDITION', input, output: result})
        return result
      }
    })

    cyre.on('data-flow-test', (payload: any) => {
      const input = JSON.parse(JSON.stringify(payload))
      dataFlowLog.push({operator: 'HANDLER', input, output: 'final'})
      console.log(`   ✅ Final payload: ${JSON.stringify(payload)}`)
      return {processed: true}
    })

    console.log('\n🔥 Testing data flow:')
    const testData = {id: 1, name: 'Test User', age: 25, extra: 'removed'}
    console.log(`   🔥 Input: ${JSON.stringify(testData)}`)

    try {
      await cyre.call('data-flow-test', testData)

      console.log('\n📊 Data Flow Results:')
      dataFlowLog.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.operator}:`)
        console.log(`      Input:  ${JSON.stringify(entry.input)}`)
        console.log(`      Output: ${JSON.stringify(entry.output)}`)
      })
    } catch (error) {
      console.log(`   ❌ Failed: ${error}`)
      console.log('\n📊 Data Flow Before Failure:')
      dataFlowLog.forEach((entry, index) => {
        console.log(
          `   ${index + 1}. ${entry.operator}: ${JSON.stringify(
            entry.input
          )} → ${JSON.stringify(entry.output)}`
        )
      })
    }
  }

  /**
   * Test 3: Fixed Order Investigation
   * Test if Cyre uses a fixed internal order regardless of declaration
   */
  async testFixedOrder(): Promise<void> {
    console.log('\n🏗️ Test 3: Fixed Order Investigation')
    console.log('='.repeat(60))

    const operators = ['schema', 'selector', 'condition', 'transform']
    const results: Record<string, string[]> = {}

    // Test all possible combinations of 3 operators
    const combinations = [
      ['selector', 'condition', 'transform'],
      ['condition', 'transform', 'selector'],
      ['transform', 'selector', 'condition'],
      ['selector', 'transform', 'condition'],
      ['condition', 'selector', 'transform'],
      ['transform', 'condition', 'selector']
    ]

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i]
      const actionId = `fixed-order-${i}`
      const executionOrder: string[] = []

      console.log(`\n🔥 Testing combination: ${combo.join(' → ')}`)

      const config: any = {}

      // Add operators in the specified order
      combo.forEach(op => {
        switch (op) {
          case 'selector':
            config.selector = (payload: any) => {
              executionOrder.push('selector')
              return {...payload, selectedBy: 'selector'}
            }
            break
          case 'condition':
            config.condition = (payload: any) => {
              executionOrder.push('condition')
              return payload.value > 0
            }
            break
          case 'transform':
            config.transform = (payload: any) => {
              executionOrder.push('transform')
              return {...payload, transformedBy: 'transform'}
            }
            break
        }
      })

      cyre.action({id: actionId, ...config})

      cyre.on(actionId, (payload: any) => {
        console.log(
          `   ✅ Success: ${combo.join(' → ')} actual: ${executionOrder.join(
            ' → '
          )}`
        )
        return {processed: true}
      })

      try {
        await cyre.call(actionId, {value: 1, name: 'test'})
        results[combo.join(' → ')] = [...executionOrder]
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
        results[combo.join(' → ')] = [...executionOrder, 'FAILED']
      }
    }

    console.log('\n📊 Fixed Order Analysis:')
    console.log('Declared Order → Actual Execution Order')
    console.log('-'.repeat(50))

    Object.entries(results).forEach(([declared, actual]) => {
      const isFixed = actual.join(' → ') !== declared
      console.log(
        `${declared} → ${actual.join(' → ')} ${
          isFixed ? '(REORDERED)' : '(PRESERVED)'
        }`
      )
    })

    // Analyze if there's a consistent pattern
    const uniqueExecutionOrders = new Set(
      Object.values(results).map(order => order.join(' → '))
    )
    console.log(`\n🎯 Analysis:`)
    console.log(`   Unique execution orders: ${uniqueExecutionOrders.size}`)
    console.log(`   Total combinations tested: ${combinations.length}`)

    if (uniqueExecutionOrders.size === 1) {
      console.log(
        `   ✅ FIXED ORDER CONFIRMED: ${Array.from(uniqueExecutionOrders)[0]}`
      )
    } else if (uniqueExecutionOrders.size < combinations.length) {
      console.log(`   ⚠️ PARTIAL FIXED ORDER: Some combinations reordered`)
    } else {
      console.log(`   ❌ NO FIXED ORDER: Declaration order preserved`)
    }
  }

  /**
   * Test 4: Pipeline Failure Points
   * Find exactly where pipelines break
   */
  async testPipelineFailurePoints(): Promise<void> {
    console.log('\n💥 Test 4: Pipeline Failure Points')
    console.log('='.repeat(60))

    const scenarios = [
      {
        name: 'All operators with failing condition',
        config: {
          selector: (payload: any) => ({selected: payload.value}),
          condition: (payload: any) => false, // Always fails
          transform: (payload: any) => ({transformed: payload.selected})
        },
        data: {value: 10}
      },
      {
        name: 'Transform before condition',
        config: {
          transform: (payload: any) => ({value: payload.value * 2}),
          condition: (payload: any) => payload.value > 5
        },
        data: {value: 3} // 3 * 2 = 6, should pass condition
      },
      {
        name: 'Condition before transform',
        config: {
          condition: (payload: any) => payload.value > 5,
          transform: (payload: any) => ({value: payload.value * 2})
        },
        data: {value: 3} // 3 < 5, should fail condition
      }
    ]

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i]
      const actionId = `failure-${i}`
      const executionLog: string[] = []

      console.log(`\n🔥 Testing: ${scenario.name}`)

      // Add logging to each operator
      const loggedConfig: any = {}
      Object.keys(scenario.config).forEach(key => {
        const originalFn = (scenario.config as any)[key]
        loggedConfig[key] = (payload: any) => {
          executionLog.push(key.toUpperCase())
          try {
            const result = originalFn(payload)
            console.log(
              `     ${key.toUpperCase()}: SUCCESS → ${JSON.stringify(result)}`
            )
            return result
          } catch (error) {
            console.log(`     ${key.toUpperCase()}: ERROR → ${error}`)
            throw error
          }
        }
      })

      cyre.action({id: actionId, ...loggedConfig})

      cyre.on(actionId, (payload: any) => {
        executionLog.push('HANDLER')
        console.log(`   ✅ Handler reached with: ${JSON.stringify(payload)}`)
        return {processed: true}
      })

      console.log(`   🔥 Input: ${JSON.stringify(scenario.data)}`)

      try {
        await cyre.call(actionId, scenario.data)
        console.log(`   ✅ Complete success: ${executionLog.join(' → ')}`)
      } catch (error) {
        console.log(
          `   ❌ Pipeline failed: ${executionLog.join(' → ')} → FAILED`
        )
        console.log(`   ❌ Error: ${error}`)
      }
    }
  }

  async runPipelineExecutionOrderTests(): Promise<void> {
    console.log('🔍 Pipeline Execution Order Investigation')
    console.log('Determining how Cyre processes operator pipelines')
    console.log('='.repeat(70))

    try {
      await this.testOperatorExecutionOrder()
      await this.testDataFlow()
      await this.testFixedOrder()
      await this.testPipelineFailurePoints()

      console.log('\n✅ All pipeline execution order tests completed!')
      console.log('\n🎯 This investigation reveals:')
      console.log('   • Whether Cyre respects user declaration order')
      console.log('   • How data flows between operators')
      console.log('   • The actual execution sequence')
      console.log('   • Where and why pipelines fail')
    } catch (error) {
      console.error('❌ Pipeline execution order test failed:', error)
    }
  }
}

// Export for use
export {PipelineExecutionOrderTest}

// Run if executed directly
const test = new PipelineExecutionOrderTest()
test.runPipelineExecutionOrderTests().catch(console.error)
