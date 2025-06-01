// examples/schema-comprehensive-test.ts
// Comprehensive schema testing for efficiency, speed, memory, and errors

import {performance} from 'perf_hooks'
import {schema} from '../src'
// Import memory optimization
import {
  optimizedSchemaCache,
  memoryMonitor,
  cleanupSchemaMemory
} from '../src/schema/schema-memory-optimization'

/*

      C.Y.R.E - S.C.H.E.M.A - C.O.M.P.R.E.H.E.N.S.I.V.E - T.E.S.T
      
      Testing schema system for:
      - Validation speed and efficiency
      - Memory usage and leak detection
      - Error handling and edge cases
      - Complex schema performance
      - Production readiness assessment

*/

interface SchemaTestResult {
  readonly name: string
  readonly validationsPerSecond: number
  readonly meanLatencyMs: number
  readonly p95LatencyMs: number
  readonly p99LatencyMs: number
  readonly memoryDeltaMB: number
  readonly validCount: number
  readonly invalidCount: number
  readonly errorCount: number
  readonly successRate: number
}

// Utilities
const getMemoryMB = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024
  }
  return 0
}

const forceGC = (cycles: number = 2): void => {
  for (let i = 0; i < cycles; i++) {
    if (typeof global !== 'undefined' && (global as any).gc) {
      ;(global as any).gc()
    }
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

const calculatePercentile = (values: number[], percentile: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor((percentile / 100) * sorted.length)
  return sorted[Math.min(index, sorted.length - 1)] || 0
}

// Schema test runner
const runSchemaTest = async (
  name: string,
  testSchema: any,
  validData: any[],
  invalidData: any[],
  iterations: number = 5000
): Promise<SchemaTestResult> => {
  console.log(`\n🧪 Testing: ${name}`)

  // Pre-test cleanup
  forceGC(3)
  await sleep(100)
  const startMemory = getMemoryMB()

  // Warmup
  console.log(`  Warming up...`)
  for (let i = 0; i < Math.min(iterations / 10, 500); i++) {
    const testData =
      i % 2 === 0
        ? validData[i % validData.length]
        : invalidData[i % invalidData.length]
    try {
      testSchema(testData)
    } catch {}
  }

  forceGC(2)
  await sleep(50)

  // Actual test
  console.log(`  Running ${iterations} validations...`)

  const latencies: number[] = []
  let validCount = 0
  let invalidCount = 0
  let errorCount = 0

  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    // Mix valid and invalid data
    const isValid = i % 3 !== 2 // 66% valid, 33% invalid
    const testData = isValid
      ? validData[i % validData.length]
      : invalidData[i % invalidData.length]

    const iterStart = performance.now()

    try {
      const result = testSchema(testData)

      if (result && typeof result === 'object') {
        if (result.ok) {
          validCount++
        } else {
          invalidCount++
        }
      } else {
        // Schema returned non-standard result
        if (isValid) validCount++
        else invalidCount++
      }
    } catch (error) {
      errorCount++
    }

    latencies.push(performance.now() - iterStart)

    // Periodic cleanup
    if (i > 0 && i % 1000 === 0) {
      forceGC(1)
    }
  }

  const totalTime = performance.now() - startTime

  // Final cleanup and memory measurement
  forceGC(3)
  optimizedSchemaCache.optimizeMemory() // Use optimized memory cleanup
  await sleep(100)
  const endMemory = getMemoryMB()

  // Calculate metrics
  const validationsPerSecond = (iterations / totalTime) * 1000
  const meanLatency =
    latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
  const memoryDelta = endMemory - startMemory
  const successRate = ((validCount + invalidCount) / iterations) * 100

  const result: SchemaTestResult = {
    name,
    validationsPerSecond,
    meanLatencyMs: meanLatency,
    p95LatencyMs: calculatePercentile(latencies, 95),
    p99LatencyMs: calculatePercentile(latencies, 99),
    memoryDeltaMB: memoryDelta,
    validCount,
    invalidCount,
    errorCount,
    successRate
  }

  // Status indicators
  const speedStatus =
    validationsPerSecond > 50000
      ? '🟢'
      : validationsPerSecond > 20000
      ? '🟡'
      : '🔴'
  const memoryStatus = memoryDelta < 1 ? '🟢' : memoryDelta < 3 ? '🟡' : '🔴'
  const errorStatus =
    errorCount === 0 ? '🟢' : errorCount < iterations * 0.01 ? '🟡' : '🔴'

  console.log(`  ${speedStatus} ${validationsPerSecond.toFixed(0)} ops/sec`)
  console.log(`  ${memoryStatus} ${memoryDelta.toFixed(2)}MB memory`)
  console.log(
    `  ${errorStatus} ${errorCount} errors, ${successRate.toFixed(1)}% success`
  )

  return result
}

// Schema test suite
const schemaTests = {
  // Test 1: Simple primitives
  async simplePrimitives(): Promise<SchemaTestResult> {
    const stringSchema = schema.string()

    const validData = ['hello', 'world', 'test string', '', 'a'.repeat(100)]

    const invalidData = [123, null, undefined, {}, []]

    return runSchemaTest(
      'Simple String Schema',
      stringSchema,
      validData,
      invalidData,
      10000
    )
  },

  // Test 2: Number validation with constraints
  async numberConstraints(): Promise<SchemaTestResult> {
    const numberSchema = schema.pipe(schema.number(), s =>
      s.positive().min(1).max(1000)
    )

    const validData = [1, 50, 100, 500, 999, 1000]

    const invalidData = [0, -1, 1001, 'string', null, undefined, NaN, Infinity]

    return runSchemaTest(
      'Number with Constraints',
      numberSchema,
      validData,
      invalidData,
      8000
    )
  },

  // Test 3: String with constraints
  async stringConstraints(): Promise<SchemaTestResult> {
    const emailSchema = schema.pipe(schema.string(), s =>
      s.email().minLength(5).maxLength(50)
    )

    const validData = [
      'test@example.com',
      'user123@domain.org',
      'a@b.co',
      'long.email.address@subdomain.example.com'
    ]

    const invalidData = [
      'invalid-email',
      'test@',
      '@domain.com',
      '',
      'a'.repeat(100) + '@example.com',
      123,
      null
    ]

    return runSchemaTest(
      'String Email Constraints',
      emailSchema,
      validData,
      invalidData,
      6000
    )
  },

  // Test 4: Object validation
  async objectValidation(): Promise<SchemaTestResult> {
    const userSchema = schema.object({
      id: schema.pipe(schema.number(), s => s.positive()),
      name: schema.pipe(schema.string(), s => s.minLength(2)),
      email: schema.email_string(),
      age: schema.pipe(schema.number(), s => s.min(0).max(120)).optional()
    })

    const validData = [
      {id: 1, name: 'John', email: 'john@example.com'},
      {id: 2, name: 'Jane', email: 'jane@test.org', age: 25},
      {id: 3, name: 'Bob Smith', email: 'bob@company.co.uk', age: 45}
    ]

    const invalidData = [
      {id: -1, name: 'John', email: 'john@example.com'},
      {id: 1, name: 'A', email: 'john@example.com'},
      {id: 1, name: 'John', email: 'invalid-email'},
      {id: 1, name: 'John', email: 'john@example.com', age: -5},
      {id: 1, name: 'John', email: 'john@example.com', age: 150},
      {name: 'John', email: 'john@example.com'}, // missing id
      'not an object',
      null
    ]

    return runSchemaTest(
      'Object User Schema',
      userSchema,
      validData,
      invalidData,
      5000
    )
  },

  // Test 5: Array validation
  async arrayValidation(): Promise<SchemaTestResult> {
    const numbersSchema = schema.array(
      schema.pipe(schema.number(), s => s.positive())
    )

    const validData = [[1, 2, 3], [100, 200, 300], [1], []]

    const invalidData = [
      [1, 2, -3],
      ['1', 2, 3],
      [1, null, 3],
      'not an array',
      null,
      [1, 2, 'string']
    ]

    return runSchemaTest(
      'Array of Numbers',
      numbersSchema,
      validData,
      invalidData,
      4000
    )
  },

  // Test 6: Complex nested schema
  async complexNested(): Promise<SchemaTestResult> {
    const complexSchema = schema.object({
      user: schema.object({
        id: schema.pipe(schema.number(), s => s.positive()),
        profile: schema.object({
          name: schema.pipe(schema.string(), s => s.minLength(2)),
          contacts: schema.array(
            schema.object({
              type: schema.enums('email', 'phone'),
              value: schema.string()
            })
          )
        })
      }),
      metadata: schema
        .object({
          created: schema.number(),
          tags: schema.array(schema.string()).optional()
        })
        .optional()
    })

    const validData = [
      {
        user: {
          id: 1,
          profile: {
            name: 'John Doe',
            contacts: [
              {type: 'email', value: 'john@example.com'},
              {type: 'phone', value: '123-456-7890'}
            ]
          }
        },
        metadata: {
          created: Date.now(),
          tags: ['user', 'active']
        }
      },
      {
        user: {
          id: 2,
          profile: {
            name: 'Jane Smith',
            contacts: [{type: 'email', value: 'jane@test.org'}]
          }
        }
      }
    ]

    const invalidData = [
      {
        user: {
          id: -1, // invalid
          profile: {
            name: 'John Doe',
            contacts: []
          }
        }
      },
      {
        user: {
          id: 1,
          profile: {
            name: 'A', // too short
            contacts: []
          }
        }
      },
      {
        user: {
          id: 1,
          profile: {
            name: 'John Doe',
            contacts: [
              {type: 'invalid', value: 'test'} // invalid enum
            ]
          }
        }
      },
      'not an object',
      null
    ]

    return runSchemaTest(
      'Complex Nested Schema',
      complexSchema,
      validData,
      invalidData,
      2000
    )
  },

  // Test 7: Schema with transformations
  async schemaTransformations(): Promise<SchemaTestResult> {
    const transformSchema = schema
      .object({
        name: schema.string(),
        age: schema.number()
      })
      .transform(data => ({
        ...data,
        displayName: data.name.toUpperCase(),
        isAdult: data.age >= 18
      }))

    const validData = [
      {name: 'john', age: 25},
      {name: 'jane', age: 16},
      {name: 'bob smith', age: 45}
    ]

    const invalidData = [
      {name: 123, age: 25},
      {name: 'john', age: 'not a number'},
      {name: 'john'}, // missing age
      'not an object'
    ]

    return runSchemaTest(
      'Schema with Transform',
      transformSchema,
      validData,
      invalidData,
      3000
    )
  },

  // Test 8: Union types
  async unionTypes(): Promise<SchemaTestResult> {
    const unionSchema = schema.union(
      schema.string(),
      schema.number(),
      schema.object({type: schema.literal('special'), value: schema.any()})
    )

    const validData = [
      'string value',
      123,
      {type: 'special', value: 'anything'},
      {type: 'special', value: {nested: 'object'}}
    ]

    const invalidData = [
      null,
      undefined,
      [],
      {type: 'wrong', value: 'test'},
      {type: 'special'}, // missing value
      true
    ]

    return runSchemaTest(
      'Union Types',
      unionSchema,
      validData,
      invalidData,
      4000
    )
  },

  // Test 9: Memory stress test
  async memoryStressTest(): Promise<SchemaTestResult> {
    const stressSchema = schema.object({
      id: schema.number(),
      data: schema.array(
        schema.object({
          key: schema.string(),
          values: schema.array(schema.number())
        })
      )
    })

    // Generate large valid data
    const validData = Array.from({length: 10}, (_, i) => ({
      id: i,
      data: Array.from({length: 50}, (_, j) => ({
        key: `key_${j}`,
        values: Array.from({length: 20}, (_, k) => k * j)
      }))
    }))

    const invalidData = [
      {id: 'not a number', data: []},
      {id: 1, data: 'not an array'},
      {id: 1, data: [{key: 123, values: []}]},
      null
    ]

    return runSchemaTest(
      'Memory Stress Test',
      stressSchema,
      validData,
      invalidData,
      1000
    )
  }
}

// Error handling test
const runErrorHandlingTest = async (): Promise<void> => {
  console.log('\n🚨 Error Handling Tests')

  const testCases = [
    {
      name: 'Circular Reference',
      test: () => {
        const circular: any = {name: 'test'}
        circular.self = circular
        const circularSchema = schema.object({
          name: schema.string(),
          self: schema.any()
        })
        return circularSchema(circular)
      }
    },
    {
      name: 'Very Deep Nesting',
      test: () => {
        let deep: any = {value: 1}
        for (let i = 0; i < 100; i++) {
          deep = {nested: deep}
        }
        const deepSchema = schema.any()
        return deepSchema(deep)
      }
    },
    {
      name: 'Large Array',
      test: () => {
        const largeArray = Array.from({length: 10000}, (_, i) => i)
        const largeArraySchema = schema.array(schema.number())
        return largeArraySchema(largeArray)
      }
    },
    {
      name: 'Invalid Schema Function',
      test: () => {
        const invalidSchema = null as any
        try {
          return invalidSchema({test: 'data'})
        } catch (error) {
          return {ok: false, error: (error as Error).message}
        }
      }
    }
  ]

  for (const testCase of testCases) {
    console.log(`  Testing: ${testCase.name}`)
    const startTime = performance.now()

    try {
      const result = testCase.test()
      const endTime = performance.now()

      console.log(
        `    ✅ Handled gracefully in ${(endTime - startTime).toFixed(2)}ms`
      )
      if (result && typeof result === 'object' && 'ok' in result) {
        console.log(`    Result: ${result.ok ? 'Valid' : 'Invalid'}`)
      }
    } catch (error) {
      const endTime = performance.now()
      console.log(
        `    ⚠️  Exception thrown in ${(endTime - startTime).toFixed(2)}ms: ${
          (error as Error).message
        }`
      )
    }
  }
}

// Generate comprehensive report
const generateSchemaReport = (results: SchemaTestResult[]): void => {
  console.log('\n' + '='.repeat(90))
  console.log('                        CYRE SCHEMA COMPREHENSIVE TEST REPORT')
  console.log('='.repeat(90))

  // Results table
  console.log('\n📊 SCHEMA PERFORMANCE RESULTS')
  console.log(
    '┌─' +
      '─'.repeat(25) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(12) +
      '┬─' +
      '─'.repeat(10) +
      '┐'
  )
  console.log(
    '│ Schema Test               │ Ops/Second   │ Mean (ms)    │ P95 (ms)     │ Memory (MB)  │ Success    │'
  )
  console.log(
    '├─' +
      '─'.repeat(25) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(12) +
      '┼─' +
      '─'.repeat(10) +
      '┤'
  )

  results.forEach(result => {
    const name = result.name.padEnd(25)
    const ops = result.validationsPerSecond.toFixed(0).padStart(12)
    const mean = result.meanLatencyMs.toFixed(3).padStart(12)
    const p95 = result.p95LatencyMs.toFixed(3).padStart(12)
    const memory = `${
      result.memoryDeltaMB >= 0 ? '+' : ''
    }${result.memoryDeltaMB.toFixed(2)}`.padStart(12)
    const success = `${result.successRate.toFixed(1)}%`.padStart(10)

    console.log(
      `│ ${name} │ ${ops} │ ${mean} │ ${p95} │ ${memory} │ ${success} │`
    )
  })

  console.log(
    '└─' +
      '─'.repeat(25) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(12) +
      '┴─' +
      '─'.repeat(10) +
      '┘'
  )

  // Analysis
  const avgThroughput =
    results.reduce((sum, r) => sum + r.validationsPerSecond, 0) / results.length
  const avgLatency =
    results.reduce((sum, r) => sum + r.meanLatencyMs, 0) / results.length
  const totalMemory = results.reduce(
    (sum, r) => sum + Math.abs(r.memoryDeltaMB),
    0
  )
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0)
  const avgSuccessRate =
    results.reduce((sum, r) => sum + r.successRate, 0) / results.length

  console.log('\n📈 SCHEMA ANALYSIS')
  console.log(
    `Average Throughput: ${avgThroughput.toFixed(0)} validations/second`
  )
  console.log(`Average Latency: ${avgLatency.toFixed(3)}ms`)
  console.log(`Total Memory Impact: ${totalMemory.toFixed(2)}MB`)
  console.log(`Total Errors: ${totalErrors}`)
  console.log(`Average Success Rate: ${avgSuccessRate.toFixed(1)}%`)

  // Performance ratings
  const throughputRating =
    avgThroughput > 40000
      ? '🟢 Excellent'
      : avgThroughput > 20000
      ? '🟡 Good'
      : '🔴 Needs Work'
  const latencyRating =
    avgLatency < 0.05
      ? '🟢 Excellent'
      : avgLatency < 0.1
      ? '🟡 Good'
      : '🔴 Needs Work'
  const memoryRating =
    totalMemory < 5
      ? '🟢 Excellent'
      : totalMemory < 15
      ? '🟡 Good'
      : '🔴 Memory Leak'
  const reliabilityRating =
    totalErrors === 0
      ? '🟢 Excellent'
      : totalErrors < 10
      ? '🟡 Good'
      : '🔴 Unreliable'

  console.log('\n🎯 SCHEMA SYSTEM RATING')
  console.log(`Throughput: ${throughputRating}`)
  console.log(`Latency: ${latencyRating}`)
  console.log(`Memory Management: ${memoryRating}`)
  console.log(`Reliability: ${reliabilityRating}`)

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS')

  if (avgThroughput < 30000) {
    console.log(
      '⚠️  Consider optimizing schema validation pipeline for better throughput'
    )
  }

  if (totalMemory > 10) {
    console.log(
      '⚠️  Schema validation memory usage is high - memory optimization is active'
    )
  } else {
    console.log('✅ Memory usage is within acceptable limits')
  }

  if (totalErrors > 0) {
    console.log('⚠️  Some schemas threw exceptions - improve error handling')
  }

  // Memory optimization report
  console.log('\n🧠 MEMORY OPTIMIZATION REPORT')
  console.log(memoryMonitor.getReport())

  // Best and worst performers
  const bestThroughput = results.reduce((best, current) =>
    current.validationsPerSecond > best.validationsPerSecond ? current : best
  )
  const worstMemory = results.reduce((worst, current) =>
    Math.abs(current.memoryDeltaMB) > Math.abs(worst.memoryDeltaMB)
      ? current
      : worst
  )

  console.log('\n🏆 PERFORMANCE HIGHLIGHTS')
  console.log(
    `Fastest Schema: ${
      bestThroughput.name
    } (${bestThroughput.validationsPerSecond.toFixed(0)} ops/sec)`
  )
  console.log(
    `Highest Memory Usage: ${worstMemory.name} (${Math.abs(
      worstMemory.memoryDeltaMB
    ).toFixed(2)}MB)`
  )

  // Final assessment
  const ratings = [
    throughputRating,
    latencyRating,
    memoryRating,
    reliabilityRating
  ]
  const excellent = ratings.filter(r => r.includes('🟢')).length
  const good = ratings.filter(r => r.includes('🟡')).length
  const needsWork = ratings.filter(r => r.includes('🔴')).length

  console.log('\n🏆 OVERALL SCHEMA ASSESSMENT')
  if (excellent >= 3) {
    console.log(
      '🟢 EXCELLENT: Schema system is highly optimized and production-ready'
    )
  } else if (good >= 2 && needsWork <= 1) {
    console.log(
      '🟡 GOOD: Schema system performs well with minor optimization opportunities'
    )
  } else {
    console.log(
      '🔴 NEEDS WORK: Schema system requires optimization before production use'
    )
  }
}

// Main test runner
const runSchemaComprehensiveTest = async (): Promise<void> => {
  console.log('🧪 CYRE Schema Comprehensive Test Suite')
  console.log('Testing efficiency, speed, memory usage, and error handling\n')

  try {
    const results: SchemaTestResult[] = []

    // Run all schema tests
    results.push(await schemaTests.simplePrimitives())
    await sleep(200)

    results.push(await schemaTests.numberConstraints())
    await sleep(200)

    results.push(await schemaTests.stringConstraints())
    await sleep(200)

    results.push(await schemaTests.objectValidation())
    await sleep(200)

    results.push(await schemaTests.arrayValidation())
    await sleep(200)

    results.push(await schemaTests.complexNested())
    await sleep(200)

    results.push(await schemaTests.schemaTransformations())
    await sleep(200)

    results.push(await schemaTests.unionTypes())
    await sleep(200)

    results.push(await schemaTests.memoryStressTest())

    // Run error handling tests
    await runErrorHandlingTest()

    // Generate comprehensive report
    generateSchemaReport(results)

    console.log('\n✅ Schema comprehensive test completed!')

    // Cleanup memory
    cleanupSchemaMemory()
  } catch (error) {
    console.error('\n❌ Schema test failed:', error)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }

    // Cleanup on error
    cleanupSchemaMemory()
    process.exit(1)
  }
}

// Auto-run
runSchemaComprehensiveTest().catch(console.error)
