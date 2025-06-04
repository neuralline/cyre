// benchmark/cyre-benchmark.ts
// Advanced performance testing scenarios for Cyre

import {cyre} from '../src'
import type {ActionPayload} from '../src/types/core'

interface AdvancedBenchmarkResults {
  protectionPipeline: number
  concurrentCalls: number
  middlewareChain: number
  schemaValidation: number
  stateReactivity: number
  memoryUsage: {
    initial: number
    afterLoad: number
    afterCleanup: number
  }
}

// Memory measurement helper
const measureMemory = (): number => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024 // MB
  }
  return 0
}

// Concurrent execution helper
const runConcurrent = async <T>(
  tasks: (() => Promise<T>)[],
  concurrency: number = 10
): Promise<T[]> => {
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(task => task()))
    results.push(...batchResults)
  }
  return results
}

// Measure execution time
const measureTime = async (fn: () => Promise<void> | void): Promise<number> => {
  const start = performance.now()
  await fn()
  return performance.now() - start
}

export async function runAdvancedBenchmarks(): Promise<AdvancedBenchmarkResults> {
  console.log('\n🚀 Advanced Cyre Performance Benchmarks')
  console.log('=========================================')

  await cyre.initialize()

  const results: AdvancedBenchmarkResults = {
    protectionPipeline: 0,
    concurrentCalls: 0,
    middlewareChain: 0,
    schemaValidation: 0,
    stateReactivity: 0,
    memoryUsage: {
      initial: measureMemory(),
      afterLoad: 0,
      afterCleanup: 0
    }
  }

  // Test 1: Protection Pipeline Performance
  console.log('\n📋 Testing Protection Pipeline Performance...')
  results.protectionPipeline = await measureTime(async () => {
    // Register actions with various protections
    for (let i = 0; i < 1000; i++) {
      cyre.action({
        id: `protected-action-${i}`,
        throttle: 100,
        debounce: 50,
        detectChanges: true,
        schema: cyre.schema.object({
          value: cyre.schema.number(),
          timestamp: cyre.schema.number()
        }),
        condition: (payload: any) => payload.value > 0,
        transform: (payload: any) => ({
          ...payload,
          processed: true,
          processedAt: Date.now()
        })
      })

      cyre.on(`protected-action-${i}`, (payload: ActionPayload) => {
        return payload
      })
    }

    // Execute calls that will go through protection pipeline
    const calls = Array(1000)
      .fill(0)
      .map(
        (_, i) => () =>
          cyre.call(`protected-action-${i}`, {
            value: Math.random() * 100,
            timestamp: Date.now()
          })
      )

    await Promise.all(calls.map(call => call()))
  })
  console.log(`Protection Pipeline: ${results.protectionPipeline.toFixed(2)}ms`)

  // Clear for next test
  cyre.clear()

  // Test 2: Concurrent Call Performance
  console.log('\n⚡ Testing Concurrent Call Performance...')
  results.concurrentCalls = await measureTime(async () => {
    // Setup channels
    for (let i = 0; i < 100; i++) {
      cyre.action({
        id: `concurrent-action-${i}`,
        payload: {initial: true}
      })

      cyre.on(`concurrent-action-${i}`, async (payload: ActionPayload) => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 1))
        return {processed: payload, workerId: i}
      })
    }

    // Create 5000 concurrent calls across 100 channels
    const concurrentCalls = Array(5000)
      .fill(0)
      .map(
        (_, i) => () =>
          cyre.call(`concurrent-action-${i % 100}`, {
            requestId: i,
            data: `concurrent-test-${i}`,
            timestamp: Date.now()
          })
      )

    // Run with controlled concurrency
    await runConcurrent(concurrentCalls, 50)
  })
  console.log(`Concurrent Calls: ${results.concurrentCalls.toFixed(2)}ms`)

  results.memoryUsage.afterLoad = measureMemory()

  // Test 3: Middleware Chain Performance
  console.log('\n🔗 Testing Middleware Chain Performance...')

  // Create complex middleware chain
  const authMiddleware = async (payload: ActionPayload, next: any) => {
    if (!payload.userId) {
      throw new Error('Authentication required')
    }
    return next({...payload, authenticated: true})
  }

  const validationMiddleware = async (payload: ActionPayload, next: any) => {
    if (!payload.data) {
      throw new Error('Data validation failed')
    }
    return next({...payload, validated: true})
  }

  const loggingMiddleware = async (payload: ActionPayload, next: any) => {
    const start = Date.now()
    const result = await next({...payload, logged: true})
    return {...result, processingTime: Date.now() - start}
  }

  const transformMiddleware = async (payload: ActionPayload, next: any) => {
    return next({
      ...payload,
      transformed: true,
      transformedAt: Date.now()
    })
  }

  results.middlewareChain = await measureTime(async () => {
    // Create group with middleware chain
    cyre.group('middleware-test-group', {
      channels: ['middleware-*'],
      shared: {
        middleware: [
          authMiddleware,
          validationMiddleware,
          loggingMiddleware,
          transformMiddleware
        ]
      }
    })

    // Register channels that match the pattern
    for (let i = 0; i < 500; i++) {
      cyre.action({
        id: `middleware-action-${i}`,
        payload: {initial: true}
      })

      cyre.on(`middleware-action-${i}`, (payload: ActionPayload) => {
        return {final: payload}
      })
    }

    // Execute calls through middleware chain
    const middlewareCalls = Array(500)
      .fill(0)
      .map(
        (_, i) => () =>
          cyre.call(`middleware-action-${i}`, {
            userId: `user-${i}`,
            data: `test-data-${i}`,
            timestamp: Date.now()
          })
      )

    await Promise.all(middlewareCalls.map(call => call()))
  })
  console.log(`Middleware Chain: ${results.middlewareChain.toFixed(2)}ms`)

  // Test 4: Schema Validation Performance
  console.log('\n✅ Testing Schema Validation Performance...')
  results.schemaValidation = await measureTime(async () => {
    // Complex schema
    const complexSchema = cyre.schema.object({
      user: cyre.schema.object({
        id: cyre.schema.number(),
        name: cyre.schema.string().minLength(2).maxLength(50),
        email: cyre.schema.string().email(),
        metadata: cyre.schema.object({
          createdAt: cyre.schema.number(),
          tags: cyre.schema.array(cyre.schema.string()),
          preferences: cyre.schema.object({
            theme: cyre.schema.enums('light', 'dark'),
            notifications: cyre.schema.boolean()
          })
        })
      }),
      action: cyre.schema.object({
        type: cyre.schema.enums('create', 'update', 'delete'),
        payload: cyre.schema.any(),
        timestamp: cyre.schema.number()
      })
    })

    // Register actions with complex schema validation
    for (let i = 0; i < 1000; i++) {
      cyre.action({
        id: `schema-action-${i}`,
        schema: complexSchema
      })

      cyre.on(`schema-action-${i}`, (payload: ActionPayload) => {
        return {validated: payload}
      })
    }

    // Execute with valid complex payloads
    const schemaCalls = Array(1000)
      .fill(0)
      .map(
        (_, i) => () =>
          cyre.call(`schema-action-${i}`, {
            user: {
              id: i,
              name: `User ${i}`,
              email: `user${i}@test.com`,
              metadata: {
                createdAt: Date.now(),
                tags: ['test', 'benchmark'],
                preferences: {
                  theme: i % 2 === 0 ? 'light' : 'dark',
                  notifications: true
                }
              }
            },
            action: {
              type: 'create',
              payload: {data: `test-${i}`},
              timestamp: Date.now()
            }
          })
      )

    await Promise.all(schemaCalls.map(call => call()))
  })
  console.log(`Schema Validation: ${results.schemaValidation.toFixed(2)}ms`)

  // Test 5: State Reactivity Performance
  console.log('\n🔄 Testing State Reactivity Performance...')
  results.stateReactivity = await measureTime(async () => {
    // Setup reactive state channels
    for (let i = 0; i < 500; i++) {
      cyre.action({
        id: `reactive-action-${i}`,
        selector: (state: any) => state.counter,
        condition: (counter: number) => counter > 0,
        transform: (counter: number) => ({
          value: counter,
          doubled: counter * 2,
          timestamp: Date.now()
        }),
        detectChanges: true
      })

      cyre.on(`reactive-action-${i}`, (payload: ActionPayload) => {
        return payload
      })
    }

    // Rapid state updates
    const stateUpdates = Array(2000)
      .fill(0)
      .map(
        (_, i) => () =>
          cyre.call(`reactive-action-${i % 500}`, {
            counter: Math.floor(i / 10) + 1,
            other: `data-${i}`,
            timestamp: Date.now()
          })
      )

    await Promise.all(stateUpdates.map(call => call()))
  })
  console.log(`State Reactivity: ${results.stateReactivity.toFixed(2)}ms`)

  // Final memory measurement
  results.memoryUsage.afterCleanup = measureMemory()

  return results
}

export function printAdvancedResults(results: AdvancedBenchmarkResults): void {
  console.log('\n📊 Advanced Benchmark Results')
  console.log('==============================')

  console.log('\nExecution Times:')
  console.log(`Protection Pipeline: ${results.protectionPipeline.toFixed(2)}ms`)
  console.log(`Concurrent Calls: ${results.concurrentCalls.toFixed(2)}ms`)
  console.log(`Middleware Chain: ${results.middlewareChain.toFixed(2)}ms`)
  console.log(`Schema Validation: ${results.schemaValidation.toFixed(2)}ms`)
  console.log(`State Reactivity: ${results.stateReactivity.toFixed(2)}ms`)

  console.log('\nThroughput Analysis:')
  console.log(
    `Protection Pipeline: ${(
      1000 /
      (results.protectionPipeline / 1000)
    ).toFixed(0)} ops/s`
  )
  console.log(
    `Concurrent Calls: ${(5000 / (results.concurrentCalls / 1000)).toFixed(
      0
    )} ops/s`
  )
  console.log(
    `Middleware Chain: ${(500 / (results.middlewareChain / 1000)).toFixed(
      0
    )} ops/s`
  )
  console.log(
    `Schema Validation: ${(1000 / (results.schemaValidation / 1000)).toFixed(
      0
    )} ops/s`
  )
  console.log(
    `State Reactivity: ${(2000 / (results.stateReactivity / 1000)).toFixed(
      0
    )} ops/s`
  )

  console.log('\nMemory Usage:')
  console.log(`Initial: ${results.memoryUsage.initial.toFixed(2)}MB`)
  console.log(`After Load: ${results.memoryUsage.afterLoad.toFixed(2)}MB`)
  console.log(`After Cleanup: ${results.memoryUsage.afterCleanup.toFixed(2)}MB`)
  console.log(
    `Peak Usage: ${(
      results.memoryUsage.afterLoad - results.memoryUsage.initial
    ).toFixed(2)}MB`
  )

  // Performance grades
  console.log('\nPerformance Grades:')
  const gradeProtection =
    results.protectionPipeline < 100
      ? '🟢 A'
      : results.protectionPipeline < 500
      ? '🟡 B'
      : '🔴 C'
  const gradeConcurrent =
    results.concurrentCalls < 2000
      ? '🟢 A'
      : results.concurrentCalls < 5000
      ? '🟡 B'
      : '🔴 C'
  const gradeMiddleware =
    results.middlewareChain < 200
      ? '🟢 A'
      : results.middlewareChain < 1000
      ? '🟡 B'
      : '🔴 C'
  const gradeSchema =
    results.schemaValidation < 500
      ? '🟢 A'
      : results.schemaValidation < 2000
      ? '🟡 B'
      : '🔴 C'
  const gradeReactivity =
    results.stateReactivity < 300
      ? '🟢 A'
      : results.stateReactivity < 1000
      ? '🟡 B'
      : '🔴 C'

  console.log(`Protection Pipeline: ${gradeProtection}`)
  console.log(`Concurrent Calls: ${gradeConcurrent}`)
  console.log(`Middleware Chain: ${gradeMiddleware}`)
  console.log(`Schema Validation: ${gradeSchema}`)
  console.log(`State Reactivity: ${gradeReactivity}`)
}

// Main execution
export async function runCompleteAdvancedBenchmark(): Promise<void> {
  try {
    const results = await runAdvancedBenchmarks()
    printAdvancedResults(results)

    // System health check
    console.log('\n🏥 System Health Check:')
    const metrics = cyre.getMetricsReport()
    const breathingState = cyre.getBreathingState()

    console.log(`Total Operations: ${metrics.global.totalCalls}`)
    console.log(
      `Error Rate: ${(
        (metrics.global.totalErrors / metrics.global.totalCalls) *
        100
      ).toFixed(2)}%`
    )
    console.log(`System Stress: ${(breathingState.stress * 100).toFixed(1)}%`)
    console.log(`Breathing Rate: ${breathingState.currentRate}ms`)
  } catch (error) {
    console.error('❌ Advanced benchmark failed:', error)
  } finally {
    cyre.clear()
    console.log('\n🧹 Cleanup complete')
  }
}

// Auto-run if executed directly

runCompleteAdvancedBenchmark()
