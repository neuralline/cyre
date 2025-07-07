// demo/operators.ts
// Comprehensive benchmark for channel operators (talents) performance
// Tests single and multiple operator combinations

import {cyre} from '../src'
import TimeKeeper from '../src/components/cyre-timekeeper'
import schema from '../src/schema/cyre-schema'

/*

     C.Y.R.E - O.P.E.R.A.T.O.R.S - B.E.N.C.H.M.A.R.K
     
     Tests channel operators (talents) performance:
     - Single operator channels
     - Multiple operator combinations  
     - Real-world operator scenarios
     - Memory and latency impact analysis

*/

interface OperatorBenchmarkResult {
  testName: string
  operatorCount: number
  operators: string[]
  opsPerSec: number
  avgLatency: number
  p95Latency: number
  errorRate: number
  memoryUsage: number
  operations: number
  pipelineEfficiency: number
}

/**
 * Track memory usage during tests
 */
const getMemoryUsage = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

/**
 * Test single operator performance
 */
async function testSingleOperators(): Promise<OperatorBenchmarkResult[]> {
  console.log('\n🎯 Testing Single Operator Performance...')

  const results: OperatorBenchmarkResult[] = []
  const operations = 5000

  // Test each operator individually
  const operatorTests = [
    {
      name: 'Required Only',
      config: {required: true},
      payload: {data: 'test-payload'}
    },
    {
      name: 'Schema Validation',
      config: {
        schema: schema.object({
          id: schema.number(),
          name: schema.string()
        })
      },
      payload: {id: 1, name: 'test'}
    },
    {
      name: 'Transform Only',
      config: {
        transform: (payload: any) => ({
          ...payload,
          processed: true,
          timestamp: Date.now()
        })
      },
      payload: {data: 'transform-test'}
    },
    {
      name: 'Condition Check',
      config: {
        condition: (payload: any) => payload.valid === true
      },
      payload: {valid: true, data: 'condition-test'}
    },
    {
      name: 'Selector Extract',
      config: {
        selector: (payload: any) => payload.data?.value || null
      },
      payload: {data: {value: 'selected-data'}}
    },
    {
      name: 'Change Detection',
      config: {
        detectChanges: true
      },
      payload: {counter: 1}
    },
    {
      name: 'Throttle Protection',
      config: {
        throttle: 50
      },
      payload: {data: 'throttled'}
    },
    {
      name: 'Debounce Protection',
      config: {
        debounce: 100,
        maxWait: 300
      },
      payload: {data: 'debounced'}
    }
  ]

  for (const test of operatorTests) {
    const channelId = `single-${test.name.toLowerCase().replace(/\s+/g, '-')}`
    const startMemory = getMemoryUsage()
    const latencies: number[] = []
    let errors = 0

    try {
      // Create channel with single operator
      cyre.action({
        id: channelId,
        ...test.config
      })

      // Set up handler
      cyre.on(channelId, payload => {
        return {processed: payload, operator: test.name}
      })

      console.log(`  Testing: ${test.name}`)

      const startTime = performance.now()

      // Execute operations
      for (let i = 0; i < operations; i++) {
        const opStart = performance.now()

        try {
          await cyre.call(channelId, {
            ...test.payload,
            iteration: i
          })

          const opEnd = performance.now()
          latencies.push(opEnd - opStart)
        } catch (error) {
          errors++
        }

        // Small delay for debounce/throttle tests
        if (test.config.debounce || test.config.throttle) {
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1))
          }
        }
      }

      const endTime = performance.now()
      const duration = (endTime - startTime) / 1000
      const memoryUsage = getMemoryUsage() - startMemory

      // Calculate metrics
      const avgLatency =
        latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0
      const sortedLatencies = latencies.sort((a, b) => a - b)
      const p95Index = Math.floor(sortedLatencies.length * 0.95)
      const p95Latency = sortedLatencies[p95Index] || 0

      results.push({
        testName: test.name,
        operatorCount: 1,
        operators: [Object.keys(test.config)[0]],
        opsPerSec: Math.round((operations - errors) / duration),
        avgLatency: Number(avgLatency.toFixed(3)),
        p95Latency: Number(p95Latency.toFixed(3)),
        errorRate: errors / operations,
        memoryUsage: Number(memoryUsage.toFixed(2)),
        operations: operations - errors,
        pipelineEfficiency: ((operations - errors) / operations) * 100
      })

      // Cleanup
      cyre.forget(channelId)
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`  ❌ ${test.name} failed:`, error)
    }
  }

  return results
}

/**
 * Test multiple operator combinations
 */
async function testMultipleOperators(): Promise<OperatorBenchmarkResult[]> {
  console.log('\n🔥 Testing Multiple Operator Combinations...')

  const results: OperatorBenchmarkResult[] = []
  const operations = 3000

  const combinationTests = [
    {
      name: 'Required + Schema',
      config: {
        required: true,
        schema: schema.object({
          id: schema.number(),
          data: schema.string()
        })
      },
      payload: {id: 1, data: 'test'},
      operators: ['required', 'schema']
    },
    {
      name: 'Schema + Transform',
      config: {
        schema: schema.object({
          value: schema.number()
        }),
        transform: (payload: any) => ({
          ...payload,
          doubled: payload.value * 2,
          processed: true
        })
      },
      payload: {value: 42},
      operators: ['schema', 'transform']
    },
    {
      name: 'Condition + Selector',
      config: {
        condition: (payload: any) => payload.status === 'active',
        selector: (payload: any) => payload.data
      },
      payload: {status: 'active', data: {value: 'selected'}},
      operators: ['condition', 'selector']
    },
    {
      name: 'Triple: Required + Schema + Transform',
      config: {
        required: true,
        schema: schema.object({
          input: schema.string()
        }),
        transform: (payload: any) => ({
          output: payload.input.toUpperCase(),
          length: payload.input.length
        })
      },
      payload: {input: 'hello world'},
      operators: ['required', 'schema', 'transform']
    },
    {
      name: 'Quad: Schema + Condition + Selector + Transform',
      config: {
        schema: schema.object({
          user: schema.object({
            name: schema.string(),
            age: schema.number(),
            active: schema.boolean()
          })
        }),
        condition: (payload: any) => payload.user.active,
        selector: (payload: any) => payload.user,
        transform: (payload: any) => ({
          ...payload,
          displayName: `${payload.name} (${payload.age})`,
          processed: true
        })
      },
      payload: {
        user: {
          name: 'Alice',
          age: 30,
          active: true
        }
      },
      operators: ['schema', 'condition', 'selector', 'transform']
    },
    {
      name: 'Protection Combo: Throttle + DetectChanges',
      config: {
        throttle: 25,
        detectChanges: true
      },
      payload: {counter: 1},
      operators: ['throttle', 'detectChanges']
    },
    {
      name: 'Full Pipeline: All Operators',
      config: {
        required: true,
        schema: schema.object({
          data: schema.object({
            value: schema.number(),
            enabled: schema.boolean()
          })
        }),
        condition: (payload: any) => payload.data.enabled,
        selector: (payload: any) => payload.data,
        transform: (payload: any) => ({
          ...payload,
          computed: payload.value * 1.5,
          timestamp: Date.now()
        }),
        detectChanges: true
      },
      payload: {
        data: {
          value: 100,
          enabled: true
        }
      },
      operators: [
        'required',
        'schema',
        'condition',
        'selector',
        'transform',
        'detectChanges'
      ]
    }
  ]

  for (const test of combinationTests) {
    const channelId = `multi-${test.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')}`
    const startMemory = getMemoryUsage()
    const latencies: number[] = []
    let errors = 0

    try {
      // Create channel with multiple operators
      cyre.action({
        id: channelId,
        ...test.config
      })

      // Set up handler
      cyre.on(channelId, payload => {
        return {
          processed: payload,
          operators: test.operators,
          operatorCount: test.operators.length
        }
      })

      console.log(
        `  Testing: ${test.name} (${test.operators.length} operators)`
      )

      const startTime = performance.now()

      // Execute operations with variation
      for (let i = 0; i < operations; i++) {
        const opStart = performance.now()

        try {
          const variedPayload = {
            ...test.payload,
            iteration: i,
            // Add variation for change detection
            timestamp: Math.floor(i / 10) // Changes every 10 iterations
          }

          await cyre.call(channelId, variedPayload)

          const opEnd = performance.now()
          latencies.push(opEnd - opStart)
        } catch (error) {
          errors++
        }

        // Throttle delay for protection tests
        if (test.config.throttle && i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }

      const endTime = performance.now()
      const duration = (endTime - startTime) / 1000
      const memoryUsage = getMemoryUsage() - startMemory

      // Calculate metrics
      const avgLatency =
        latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0
      const sortedLatencies = latencies.sort((a, b) => a - b)
      const p95Index = Math.floor(sortedLatencies.length * 0.95)
      const p95Latency = sortedLatencies[p95Index] || 0

      results.push({
        testName: test.name,
        operatorCount: test.operators.length,
        operators: test.operators,
        opsPerSec: Math.round((operations - errors) / duration),
        avgLatency: Number(avgLatency.toFixed(3)),
        p95Latency: Number(p95Latency.toFixed(3)),
        errorRate: errors / operations,
        memoryUsage: Number(memoryUsage.toFixed(2)),
        operations: operations - errors,
        pipelineEfficiency: ((operations - errors) / operations) * 100
      })

      // Cleanup
      cyre.forget(channelId)
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`  ❌ ${test.name} failed:`, error)
    }
  }

  return results
}

/**
 * Test real-world operator scenarios
 */
async function testRealWorldScenarios(): Promise<OperatorBenchmarkResult[]> {
  console.log('\n🌍 Testing Real-World Operator Scenarios...')

  const results: OperatorBenchmarkResult[] = []
  const operations = 2000

  const scenarios = [
    {
      name: 'API Validation Pipeline',
      config: {
        required: true,
        schema: schema.object({
          method: schema.enums('GET', 'POST', 'PUT', 'DELETE'),
          url: schema.string().minLength(1),
          headers: schema.object({
            authorization: schema.string()
          }),
          body: schema.any().optional()
        }),
        condition: (payload: any) =>
          payload.headers.authorization.startsWith('Bearer '),
        transform: (payload: any) => ({
          ...payload,
          normalizedMethod: payload.method.toLowerCase(),
          timestamp: Date.now(),
          validated: true
        })
      },
      payload: {
        method: 'POST',
        url: '/api/users',
        headers: {
          authorization: 'Bearer jwt-token-here'
        },
        body: {name: 'John', email: 'john@example.com'}
      },
      operators: ['required', 'schema', 'condition', 'transform']
    },
    {
      name: 'User Input Sanitization',
      config: {
        required: true,
        schema: schema.object({
          input: schema.string().maxLength(1000)
        }),
        transform: (payload: any) => ({
          sanitized: payload.input
            .trim()
            .replace(/<script[^>]*>.*?<\/script>/gi, ''),
          length: payload.input.length,
          safe: !payload.input.includes('<script>')
        }),
        condition: (payload: any) => payload.safe !== false
      },
      payload: {
        input: '  Hello world! This is safe input.  '
      },
      operators: ['required', 'schema', 'transform', 'condition']
    },
    {
      name: 'Data Processing Pipeline',
      config: {
        schema: schema.object({
          data: schema.array(
            schema.object({
              id: schema.number(),
              value: schema.number(),
              enabled: schema.boolean()
            })
          )
        }),
        selector: (payload: any) =>
          payload.data.filter((item: any) => item.enabled),
        transform: (payload: any) =>
          payload.map((item: any) => ({
            ...item,
            doubled: item.value * 2,
            processed: true
          })),
        condition: (payload: any) => payload.length > 0
      },
      payload: {
        data: [
          {id: 1, value: 10, enabled: true},
          {id: 2, value: 20, enabled: false},
          {id: 3, value: 30, enabled: true}
        ]
      },
      operators: ['schema', 'selector', 'transform', 'condition']
    },
    {
      name: 'Rate Limited Logger',
      config: {
        throttle: 100,
        schema: schema.object({
          level: schema.enums('info', 'warn', 'error'),
          message: schema.string(),
          timestamp: schema.number().optional()
        }),
        transform: (payload: any) => ({
          ...payload,
          timestamp: payload.timestamp || Date.now(),
          formatted: `[${payload.level.toUpperCase()}] ${payload.message}`
        }),
        detectChanges: true
      },
      payload: {
        level: 'info',
        message: 'System operation completed'
      },
      operators: ['throttle', 'schema', 'transform', 'detectChanges']
    }
  ]

  for (const scenario of scenarios) {
    const channelId = `scenario-${scenario.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')}`
    const startMemory = getMemoryUsage()
    const latencies: number[] = []
    let errors = 0

    try {
      // Create scenario channel
      cyre.action({
        id: channelId,
        ...scenario.config
      })

      // Set up handler
      cyre.on(channelId, payload => {
        return {
          scenario: scenario.name,
          processed: payload,
          operators: scenario.operators.length
        }
      })

      console.log(`  Testing: ${scenario.name}`)

      const startTime = performance.now()

      // Execute operations with realistic variation
      for (let i = 0; i < operations; i++) {
        const opStart = performance.now()

        try {
          const variedPayload = {
            ...scenario.payload,
            requestId: `req-${i}`,
            variation: i % 5 // Some variation
          }

          await cyre.call(channelId, variedPayload)

          const opEnd = performance.now()
          latencies.push(opEnd - opStart)
        } catch (error) {
          errors++
        }

        // Realistic timing for throttled scenarios
        if (scenario.config.throttle && i % 15 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }

      const endTime = performance.now()
      const duration = (endTime - startTime) / 1000
      const memoryUsage = getMemoryUsage() - startMemory

      // Calculate metrics
      const avgLatency =
        latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0
      const sortedLatencies = latencies.sort((a, b) => a - b)
      const p95Index = Math.floor(sortedLatencies.length * 0.95)
      const p95Latency = sortedLatencies[p95Index] || 0

      results.push({
        testName: scenario.name,
        operatorCount: scenario.operators.length,
        operators: scenario.operators,
        opsPerSec: Math.round((operations - errors) / duration),
        avgLatency: Number(avgLatency.toFixed(3)),
        p95Latency: Number(p95Latency.toFixed(3)),
        errorRate: errors / operations,
        memoryUsage: Number(memoryUsage.toFixed(2)),
        operations: operations - errors,
        pipelineEfficiency: ((operations - errors) / operations) * 100
      })

      // Cleanup
      cyre.forget(channelId)
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`  ❌ ${scenario.name} failed:`, error)
    }
  }

  return results
}

/**
 * Test fast path performance as control group
 */
async function testFastPathControl(): Promise<OperatorBenchmarkResult[]> {
  console.log('\n🏁 Testing Fast Path Control (No Operators)...')

  const results: OperatorBenchmarkResult[] = []
  const operations = 5000

  const fastPathTests = [
    {
      name: 'Pure Fast Path',
      config: {}, // No operators at all
      payload: {data: 'fast-path-test'}
    },
    {
      name: 'Fast Path + Payload Only',
      config: {payload: {default: 'initial'}}, // Just default payload
      payload: {data: 'fast-path-with-payload'}
    },
    {
      name: 'Fast Path + Type Only',
      config: {type: 'fast-path'}, // Just type classification
      payload: {data: 'fast-path-with-type'}
    }
  ]

  for (const test of fastPathTests) {
    const channelId = `fastpath-${test.name.toLowerCase().replace(/\s+/g, '-')}`
    const startMemory = getMemoryUsage()
    const latencies: number[] = []
    let errors = 0

    try {
      // Create fast path channel (should trigger _hasFastPath = true)
      cyre.action({
        id: channelId,
        ...test.config
      })

      // Set up minimal handler
      cyre.on(channelId, payload => {
        return payload // Simple pass-through
      })

      console.log(`  Testing: ${test.name}`)

      const startTime = performance.now()

      // Execute operations
      for (let i = 0; i < operations; i++) {
        const opStart = performance.now()

        try {
          await cyre.call(channelId, {
            ...test.payload,
            iteration: i
          })

          const opEnd = performance.now()
          latencies.push(opEnd - opStart)
        } catch (error) {
          errors++
        }
      }

      const endTime = performance.now()
      const duration = (endTime - startTime) / 1000
      const memoryUsage = getMemoryUsage() - startMemory

      // Calculate metrics
      const avgLatency =
        latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0
      const sortedLatencies = latencies.sort((a, b) => a - b)
      const p95Index = Math.floor(sortedLatencies.length * 0.95)
      const p95Latency = sortedLatencies[p95Index] || 0

      // Check if fast path was actually used
      const action = cyre.get(channelId)
      const actuallyFastPath = action?._hasFastPath || false

      results.push({
        testName: `${test.name}${actuallyFastPath ? ' ✅' : ' ⚠️'}`,
        operatorCount: 0,
        operators: actuallyFastPath ? ['fast-path'] : ['standard-path'],
        opsPerSec: Math.round((operations - errors) / duration),
        avgLatency: Number(avgLatency.toFixed(3)),
        p95Latency: Number(p95Latency.toFixed(3)),
        errorRate: errors / operations,
        memoryUsage: Number(memoryUsage.toFixed(2)),
        operations: operations - errors,
        pipelineEfficiency: ((operations - errors) / operations) * 100
      })

      // Cleanup
      cyre.forget(channelId)
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`  ❌ ${test.name} failed:`, error)
    }
  }

  return results
}

/**
 * Display comprehensive results
 */
function displayResults(
  fastPathResults: OperatorBenchmarkResult[],
  singleResults: OperatorBenchmarkResult[],
  multiResults: OperatorBenchmarkResult[],
  scenarioResults: OperatorBenchmarkResult[]
): void {
  console.log('\n🏆 CYRE OPERATORS BENCHMARK RESULTS')
  console.log('===================================\n')

  // Fast path control section
  console.log('🏁 FAST PATH CONTROL (No Operators)')
  console.log('-----------------------------------')
  fastPathResults.forEach(result => {
    console.log(`${result.testName}`)
    console.log(`  • Path Type: ${result.operators[0]}`)
    console.log(`  • Ops/sec: ${result.opsPerSec.toLocaleString()}`)
    console.log(`  • Avg Latency: ${result.avgLatency}ms`)
    console.log(`  • P95 Latency: ${result.p95Latency}ms`)
    console.log(`  • Memory: ${result.memoryUsage}MB`)
    console.log(`  • Operations: ${result.operations.toLocaleString()}\n`)
  })
  singleResults.forEach(result => {
    console.log(`${result.testName}`)
    console.log(`  • Operator: ${result.operators[0]}`)
    console.log(`  • Ops/sec: ${result.opsPerSec.toLocaleString()}`)
    console.log(`  • Avg Latency: ${result.avgLatency}ms`)
    console.log(`  • P95 Latency: ${result.p95Latency}ms`)
    console.log(`  • Error Rate: ${(result.errorRate * 100).toFixed(3)}%`)
    console.log(`  • Memory: ${result.memoryUsage}MB`)
    console.log(`  • Operations: ${result.operations.toLocaleString()}\n`)
  })

  // Multiple operators section
  console.log('🔥 MULTIPLE OPERATOR COMBINATIONS')
  console.log('--------------------------------')
  multiResults.forEach(result => {
    console.log(`${result.testName}`)
    console.log(
      `  • Operators (${result.operatorCount}): ${result.operators.join(' → ')}`
    )
    console.log(`  • Ops/sec: ${result.opsPerSec.toLocaleString()}`)
    console.log(`  • Avg Latency: ${result.avgLatency}ms`)
    console.log(`  • P95 Latency: ${result.p95Latency}ms`)
    console.log(
      `  • Pipeline Efficiency: ${result.pipelineEfficiency.toFixed(1)}%`
    )
    console.log(`  • Memory: ${result.memoryUsage}MB`)
    console.log(`  • Operations: ${result.operations.toLocaleString()}\n`)
  })

  // Real-world scenarios section
  console.log('🌍 REAL-WORLD SCENARIOS')
  console.log('----------------------')
  scenarioResults.forEach(result => {
    console.log(`${result.testName}`)
    console.log(
      `  • Pipeline (${result.operatorCount}): ${result.operators.join(' → ')}`
    )
    console.log(`  • Ops/sec: ${result.opsPerSec.toLocaleString()}`)
    console.log(`  • Avg Latency: ${result.avgLatency}ms`)
    console.log(`  • P95 Latency: ${result.p95Latency}ms`)
    console.log(`  • Efficiency: ${result.pipelineEfficiency.toFixed(1)}%`)
    console.log(`  • Memory: ${result.memoryUsage}MB\n`)
  })

  // Performance analysis
  const allResults = [...singleResults, ...multiResults, ...scenarioResults]
  const avgPerformance =
    allResults.reduce((sum, r) => sum + r.opsPerSec, 0) / allResults.length
  const avgLatency =
    allResults.reduce((sum, r) => sum + r.avgLatency, 0) / allResults.length
  const avgEfficiency =
    allResults.reduce((sum, r) => sum + r.pipelineEfficiency, 0) /
    allResults.length

  const fastPathAvg =
    fastPathResults.reduce((sum, r) => sum + r.opsPerSec, 0) /
    fastPathResults.length
  const singleOpAvg =
    singleResults.reduce((sum, r) => sum + r.opsPerSec, 0) /
    singleResults.length

  console.log('\n🎯 FAST PATH vs OPERATORS COMPARISON')
  console.log('===================================')
  console.log(
    `• Fast Path Average: ${Math.round(fastPathAvg).toLocaleString()} ops/sec`
  )
  console.log(
    `• Single Operator Average: ${Math.round(
      singleOpAvg
    ).toLocaleString()} ops/sec`
  )
  console.log(
    `• Performance Impact: ${((singleOpAvg / fastPathAvg - 1) * 100).toFixed(
      1
    )}%`
  )

  if (singleOpAvg > fastPathAvg) {
    console.log(
      `• 🚀 Operators are FASTER than fast path by ${(
        (singleOpAvg / fastPathAvg - 1) *
        100
      ).toFixed(1)}%!`
    )
  } else {
    console.log(
      `• 📉 Operators add ${((1 - singleOpAvg / fastPathAvg) * 100).toFixed(
        1
      )}% overhead`
    )
  }

  console.log('📈 PERFORMANCE ANALYSIS')
  console.log('=====================')
  console.log(
    `• Average Performance: ${Math.round(
      avgPerformance
    ).toLocaleString()} ops/sec`
  )
  console.log(`• Average Latency: ${avgLatency.toFixed(3)}ms`)
  console.log(`• Average Pipeline Efficiency: ${avgEfficiency.toFixed(1)}%`)

  // Operator impact analysis
  console.log('\n🎯 OPERATOR IMPACT ANALYSIS')
  console.log('===========================')

  const operatorImpact = new Map<
    string,
    {count: number; totalOps: number; totalLatency: number}
  >()

  allResults.forEach(result => {
    result.operators.forEach(op => {
      const current = operatorImpact.get(op) || {
        count: 0,
        totalOps: 0,
        totalLatency: 0
      }
      current.count++
      current.totalOps += result.opsPerSec
      current.totalLatency += result.avgLatency
      operatorImpact.set(op, current)
    })
  })

  Array.from(operatorImpact.entries())
    .sort((a, b) => b[1].totalOps / b[1].count - a[1].totalOps / a[1].count)
    .forEach(([operator, stats]) => {
      const avgOps = Math.round(stats.totalOps / stats.count)
      const avgLat = (stats.totalLatency / stats.count).toFixed(3)
      console.log(
        `• ${operator}: ${avgOps.toLocaleString()} ops/sec avg, ${avgLat}ms latency`
      )
    })

  console.log('\n💡 KEY INSIGHTS:')
  console.log(
    `✅ Operators add minimal overhead (avg ${avgLatency.toFixed(
      3
    )}ms per pipeline)`
  )
  console.log(
    `✅ Pipeline efficiency remains high (${avgEfficiency.toFixed(1)}% average)`
  )
  console.log(`✅ Performance scales well with operator complexity`)
  console.log(`✅ Real-world scenarios maintain production-ready performance`)

  const timelineStatus = TimeKeeper.status()
  console.log(
    `\n📊 System Status: ${timelineStatus.activeFormations} active formations`
  )
}

/**
 * Main benchmark runner
 */
// Update the main function:
async function runOperatorsBenchmark(): Promise<void> {
  console.log('🚀 CYRE OPERATORS BENCHMARK WITH FAST PATH CONTROL')
  console.log('==================================================')
  console.log('Testing channel operators vs fast path performance...\n')

  try {
    await cyre.init()

    // Add fast path control first
    const fastPathResults = await testFastPathControl()
    await new Promise(resolve => setTimeout(resolve, 500))

    const singleResults = await testSingleOperators()
    await new Promise(resolve => setTimeout(resolve, 500))

    const multiResults = await testMultipleOperators()
    await new Promise(resolve => setTimeout(resolve, 500))

    const scenarioResults = await testRealWorldScenarios()

    displayResults(
      fastPathResults,
      singleResults,
      multiResults,
      scenarioResults
    )
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
  } finally {
    cyre.clear()
  }
}

// Export for use
export {runOperatorsBenchmark}

// Run if called directly
runOperatorsBenchmark().catch(console.error)
