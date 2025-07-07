// benchmark/extreme-cyre-investigation.ts
// Push Cyre to its absolute limits and investigate performance mysteries

import {cyre, schema, useBranch} from '../src'

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
}

const log = (message: string, color = 'white') => {
  console.log(
    `${colors[color as keyof typeof colors]}${message}${colors.reset}`
  )
}

const separator = (title: string) => {
  log('\n' + '='.repeat(80), 'cyan')
  log(`🔬 ${title}`, 'bold')
  log('='.repeat(80), 'cyan')
}

const measureMemory = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage()
    return {
      heap: memory.heapUsed / 1024 / 1024,
      external: memory.external / 1024 / 1024,
      total: (memory.heapUsed + memory.external) / 1024 / 1024
    }
  }
  return {heap: 0, external: 0, total: 0}
}

const forceGC = () => {
  if (typeof global !== 'undefined' && (global as any).gc) {
    ;(global as any).gc()
  }
}

/**
 * 🔥 EXTREME TEST 1: Talent vs Fast Path Speed Mystery
 */
async function investigateTalentSpeedMystery() {
  separator('TALENT SPEED MYSTERY - Why are talents faster?')

  await cyre.init()

  // Create pure fast path channel
  const fastId = 'pure-fast-path'
  cyre.action({id: fastId})
  cyre.on(fastId, () => ({fast: true}))

  // Create talent-heavy channel
  const talentId = 'talent-heavy'
  cyre.action({
    id: talentId,
    required: true,
    detectChanges: true,
    condition: payload => payload !== null,
    selector: payload => payload,
    transform: payload => ({...payload, transformed: true}),
    schema: schema.object({
      test: schema.boolean()
    })
  })
  cyre.on(talentId, () => ({talent: true}))

  // Warmup (trigger V8 optimization)
  log('🔥 Warming up V8 JIT compiler...', 'yellow')
  for (let i = 0; i < 10000; i++) {
    await cyre.call(fastId)
    await cyre.call(talentId, {test: true})
  }

  log('🚀 Starting speed comparison...', 'green')

  // Measure fast path
  const fastTimes: number[] = []
  const iterations = 100000

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await cyre.call(fastId)
    fastTimes.push(performance.now() - start)
  }

  // Measure talent path
  const talentTimes: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await cyre.call(talentId, {test: true})
    talentTimes.push(performance.now() - start)
  }

  // Analysis
  const fastAvg = fastTimes.reduce((a, b) => a + b) / fastTimes.length
  const talentAvg = talentTimes.reduce((a, b) => a + b) / talentTimes.length
  const fastP99 = fastTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.99)]
  const talentP99 = talentTimes.sort((a, b) => a - b)[
    Math.floor(iterations * 0.99)
  ]

  log(`📊 Fast Path:`, 'blue')
  log(`   Average: ${fastAvg.toFixed(6)}ms`, 'white')
  log(`   P99: ${fastP99.toFixed(6)}ms`, 'white')
  log(`   Ops/sec: ${Math.floor(1000 / fastAvg).toLocaleString()}`, 'white')

  log(`📊 Talent Path:`, 'magenta')
  log(`   Average: ${talentAvg.toFixed(6)}ms`, 'white')
  log(`   P99: ${talentP99.toFixed(6)}ms`, 'white')
  log(`   Ops/sec: ${Math.floor(1000 / talentAvg).toLocaleString()}`, 'white')

  const speedRatio = fastAvg / talentAvg
  log(
    `🔍 Speed Ratio: ${speedRatio.toFixed(2)}x ${
      speedRatio > 1 ? '(Talent FASTER!)' : '(Fast Path faster)'
    }`,
    speedRatio > 1 ? 'green' : 'red'
  )

  // Check internal flags
  const fastChannel = cyre.get(fastId)
  const talentChannel = cyre.get(talentId)

  log(`🔍 Fast Path Flags:`, 'cyan')
  log(`   _hasFastPath: ${fastChannel?._hasFastPath}`, 'white')
  log(`   _hasProcessing: ${fastChannel?._hasProcessing}`, 'white')
  log(`   _hasProtections: ${fastChannel?._hasProtections}`, 'white')

  log(`🔍 Talent Path Flags:`, 'cyan')
  log(`   _hasFastPath: ${talentChannel?._hasFastPath}`, 'white')
  log(`   _hasProcessing: ${talentChannel?._hasProcessing}`, 'white')
  log(`   _hasProtections: ${talentChannel?._hasProtections}`, 'white')
  log(
    `   _processingTalents: [${talentChannel?._processingTalents?.join(', ')}]`,
    'white'
  )

  // Cleanup
  cyre.forget(fastId)
  cyre.forget(talentId)
}

/**
 * 🔥 EXTREME TEST 2: Memory Leak Hunt
 */
async function huntMemoryLeaks() {
  separator('MEMORY LEAK INVESTIGATION - Hunt down every byte')

  await cyre.init()

  const channelId = 'memory-hunter'
  let executionCount = 0

  cyre.action({
    id: channelId,
    detectChanges: true,
    required: true
  })

  cyre.on(channelId, payload => {
    executionCount++
    return {
      count: executionCount,
      timestamp: Date.now(),
      // Intentionally create some data to see what sticks around
      data: new Array(50).fill(`execution-${executionCount}`)
    }
  })

  const memorySnapshots: Array<{iteration: number; memory: any}> = []
  const iterations = 10000

  log(
    `🔥 Starting ${iterations.toLocaleString()} iterations memory hunt...`,
    'yellow'
  )

  for (let i = 0; i < iterations; i++) {
    await cyre.call(channelId, {
      iteration: i,
      payload: `test-data-${i}`,
      timestamp: Date.now()
    })

    // Take memory snapshots every 1000 iterations
    if (i % 1000 === 0) {
      forceGC() // Force garbage collection
      const memory = measureMemory()
      memorySnapshots.push({iteration: i, memory})

      if (i > 0) {
        const prev = memorySnapshots[memorySnapshots.length - 2]
        const growth = memory.heap - prev.memory.heap
        log(
          `📊 Iteration ${i.toLocaleString()}: ${memory.heap.toFixed(
            2
          )}MB (+${growth.toFixed(2)}MB)`,
          growth > 1 ? 'red' : 'green'
        )
      } else {
        log(
          `📊 Iteration ${i.toLocaleString()}: ${memory.heap.toFixed(
            2
          )}MB (baseline)`,
          'blue'
        )
      }
    }
  }

  // Final analysis
  const initialMemory = memorySnapshots[0].memory.heap
  const finalMemory = memorySnapshots[memorySnapshots.length - 1].memory.heap
  const totalGrowth = finalMemory - initialMemory
  const growthPerAction = (totalGrowth * 1024) / iterations // KB per action

  log(`🔍 Memory Analysis:`, 'cyan')
  log(`   Initial: ${initialMemory.toFixed(2)}MB`, 'white')
  log(`   Final: ${finalMemory.toFixed(2)}MB`, 'white')
  log(
    `   Total Growth: ${totalGrowth.toFixed(2)}MB`,
    totalGrowth > 5 ? 'red' : 'green'
  )
  log(
    `   Per Action: ${growthPerAction.toFixed(3)}KB`,
    growthPerAction > 1 ? 'red' : 'green'
  )
  log(`   Executions: ${executionCount.toLocaleString()}`, 'white')

  // Check what might be accumulating
  const metrics = cyre.metrics.getChannelMetrics(channelId)
  log(`🔍 Channel Metrics:`, 'cyan')
  log(`   Execution Count: ${metrics?.executionCount}`, 'white')
  log(`   Errors: ${metrics?.errors?.length || 0}`, 'white')

  cyre.forget(channelId)
}

/**
 * 🔥 EXTREME TEST 3: Concurrency Chaos
 */
async function concurrencyChaos() {
  separator('CONCURRENCY CHAOS - Push concurrent limits')

  await cyre.init()

  const results: Array<{
    concurrency: number
    totalTime: number
    throughput: number
    efficiency: number
    memoryUsed: number
  }> = []

  // Test extreme concurrency levels
  const concurrencyLevels = [1, 10, 50, 100, 500, 1000, 2000, 5000]

  for (const concurrency of concurrencyLevels) {
    log(
      `🔥 Testing ${concurrency.toLocaleString()} concurrent operations...`,
      'yellow'
    )

    const channelId = `chaos-${concurrency}`
    let completed = 0

    cyre.action({id: channelId})
    cyre.on(channelId, payload => {
      completed++
      // Simulate variable work
      const work = Math.sin(payload.index) * Math.cos(payload.timestamp)
      return {completed: true, work, index: payload.index}
    })

    const memoryBefore = measureMemory()
    const startTime = performance.now()

    // Launch concurrent operations
    const promises = Array.from({length: concurrency}, (_, i) =>
      cyre.call(channelId, {
        index: i,
        timestamp: Date.now(),
        concurrency
      })
    )

    await Promise.all(promises)

    const endTime = performance.now()
    const totalTime = endTime - startTime
    const throughput = (concurrency / totalTime) * 1000 // ops/sec
    const efficiency = throughput / concurrency

    const memoryAfter = measureMemory()
    const memoryUsed = memoryAfter.heap - memoryBefore.heap

    results.push({
      concurrency,
      totalTime,
      throughput,
      efficiency,
      memoryUsed
    })

    log(
      `📊 ${concurrency.toLocaleString()} ops: ${totalTime.toFixed(
        2
      )}ms, ${Math.floor(throughput).toLocaleString()} ops/sec, ${(
        efficiency * 1000
      ).toFixed(2)} efficiency`,
      efficiency > 0.8 ? 'green' : 'yellow'
    )

    cyre.forget(channelId)

    // Brief pause to let system recover
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  log(`🔍 Concurrency Scaling Analysis:`, 'cyan')
  results.forEach((result, i) => {
    if (i > 0) {
      const prev = results[i - 1]
      const scalingFactor = result.throughput / prev.throughput
      const expectedScaling = result.concurrency / prev.concurrency
      const scalingEfficiency = scalingFactor / expectedScaling

      log(
        `   ${prev.concurrency} → ${
          result.concurrency
        }: ${scalingFactor.toFixed(2)}x throughput (${scalingEfficiency.toFixed(
          2
        )}x efficiency)`,
        scalingEfficiency > 1 ? 'green' : 'red'
      )
    }
  })

  // Find the sweet spot
  const maxThroughput = Math.max(...results.map(r => r.throughput))
  const optimalConcurrency = results.find(r => r.throughput === maxThroughput)
  log(
    `🎯 Optimal Concurrency: ${optimalConcurrency?.concurrency.toLocaleString()} ops (${Math.floor(
      maxThroughput
    ).toLocaleString()} ops/sec)`,
    'green'
  )
}

/**
 * 🔥 EXTREME TEST 4: Branch System Stress Test
 */
async function branchSystemStress() {
  separator('BRANCH SYSTEM STRESS TEST - Isolation under extreme load')

  await cyre.init()

  const branchCount = 100
  const channelsPerBranch = 50
  const operationsPerChannel = 100

  log(
    `🔥 Creating ${branchCount} branches with ${channelsPerBranch} channels each...`,
    'yellow'
  )

  const branches: any[] = []
  const startTime = performance.now()
  const memoryBefore = measureMemory()

  // Create branches and channels
  for (let b = 0; b < branchCount; b++) {
    const branch = useBranch(undefined, {id: `stress-branch-${b}`})
    branches.push(branch)

    for (let c = 0; c < channelsPerBranch; c++) {
      const channelId = `channel-${c}`
      branch.action({
        id: channelId,
        payload: {branchId: b, channelId: c}
      })

      branch.on(channelId, payload => ({
        processed: true,
        branch: payload.branchId,
        channel: payload.channelId,
        timestamp: Date.now()
      }))
    }

    if (b % 20 === 0) {
      log(`   Created ${b + 1} branches...`, 'blue')
    }
  }

  const setupTime = performance.now() - startTime
  log(`📊 Setup completed in ${setupTime.toFixed(2)}ms`, 'green')

  // Stress test: concurrent operations across all branches
  log(
    `🔥 Launching ${(
      branchCount *
      channelsPerBranch *
      operationsPerChannel
    ).toLocaleString()} concurrent operations...`,
    'yellow'
  )

  const operationPromises: Promise<any>[] = []
  const stressStartTime = performance.now()

  for (let b = 0; b < branchCount; b++) {
    const branch = branches[b]

    for (let c = 0; c < channelsPerBranch; c++) {
      const channelId = `channel-${c}`

      for (let o = 0; o < operationsPerChannel; o++) {
        operationPromises.push(
          branch.call(channelId, {
            operation: o,
            timestamp: Date.now(),
            data: `stress-test-${b}-${c}-${o}`
          })
        )
      }
    }
  }

  const results = await Promise.all(operationPromises)
  const stressEndTime = performance.now()
  const totalStressTime = stressEndTime - stressStartTime

  const memoryAfter = measureMemory()
  const memoryGrowth = memoryAfter.heap - memoryBefore.heap

  const successfulOps = results.filter(r => r.ok).length
  const throughput = (successfulOps / totalStressTime) * 1000

  log(`📊 Stress Test Results:`, 'cyan')
  log(
    `   Total Operations: ${operationPromises.length.toLocaleString()}`,
    'white'
  )
  log(`   Successful: ${successfulOps.toLocaleString()}`, 'green')
  log(`   Total Time: ${totalStressTime.toFixed(2)}ms`, 'white')
  log(
    `   Throughput: ${Math.floor(throughput).toLocaleString()} ops/sec`,
    'green'
  )
  log(
    `   Memory Growth: ${memoryGrowth.toFixed(2)}MB`,
    memoryGrowth > 50 ? 'red' : 'green'
  )
  log(`   Branches Created: ${branchCount}`, 'white')
  log(`   Channels per Branch: ${channelsPerBranch}`, 'white')

  // Test isolation - operations in one branch shouldn't affect others
  log(`🔍 Testing isolation...`, 'yellow')

  const testBranch = branches[0]
  const isolationTestTimes: number[] = []

  for (let i = 0; i < 1000; i++) {
    const start = performance.now()
    await testBranch.call('channel-0', {isolation: i})
    isolationTestTimes.push(performance.now() - start)
  }

  const isolationAvg =
    isolationTestTimes.reduce((a, b) => a + b) / isolationTestTimes.length
  log(
    `📊 Isolation Performance: ${isolationAvg.toFixed(6)}ms average (under ${
      branchCount * channelsPerBranch
    } other channels)`,
    'green'
  )

  // Cleanup
  branches.forEach(branch => branch.destroy())
}

/**
 * 🔥 EXTREME TEST 5: Schema Performance Under Load
 */
async function schemaPerformanceStress() {
  separator('SCHEMA PERFORMANCE STRESS - Validation at scale')

  await cyre.init()

  // Create complex schemas
  const simpleSchema = schema.object({
    id: schema.string(),
    value: schema.number()
  })

  const complexSchema = schema.object({
    user: schema.object({
      id: schema.string().minLength(5),
      email: schema.email_string(),
      profile: schema.object({
        name: schema.string().minLength(2),
        age: schema.number().min(0).max(150),
        tags: schema.array(schema.string())
      })
    }),
    metadata: schema.object({
      timestamp: schema.number(),
      version: schema.string(),
      features: schema.array(schema.boolean())
    })
  })

  const testCases = [
    {name: 'No Schema', schema: undefined},
    {name: 'Simple Schema', schema: simpleSchema},
    {name: 'Complex Schema', schema: complexSchema}
  ]

  for (const testCase of testCases) {
    log(`🔥 Testing ${testCase.name}...`, 'yellow')

    const channelId = `schema-${testCase.name.replace(' ', '-').toLowerCase()}`

    cyre.action({
      id: channelId,
      schema: testCase.schema
    })

    cyre.on(channelId, payload => ({validated: true, schema: testCase.name}))

    const iterations = 50000
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const payload = testCase.schema
        ? testCase.name === 'Simple Schema'
          ? {id: `test-${i}`, value: i}
          : {
              user: {
                id: `user-${i}`,
                email: `test${i}@example.com`,
                profile: {
                  name: `User ${i}`,
                  age: 25 + (i % 50),
                  tags: [`tag-${i}`, `category-${i % 10}`]
                }
              },
              metadata: {
                timestamp: Date.now(),
                version: '1.0.0',
                features: [true, false, i % 2 === 0]
              }
            }
        : {simple: i}

      const start = performance.now()
      try {
        await cyre.call(channelId, payload)
        times.push(performance.now() - start)
      } catch (error) {
        // Schema validation failed - still record time
        times.push(performance.now() - start)
      }
    }

    const avg = times.reduce((a, b) => a + b) / times.length
    const p95 = times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)]
    const throughput = Math.floor(1000 / avg)

    log(`📊 ${testCase.name}:`, 'blue')
    log(`   Average: ${avg.toFixed(6)}ms`, 'white')
    log(`   P95: ${p95.toFixed(6)}ms`, 'white')
    log(`   Throughput: ${throughput.toLocaleString()} ops/sec`, 'white')

    cyre.forget(channelId)
  }
}

/**
 * 🚀 Main benchmark runner
 */
async function runExtremeBenchmarks() {
  log('🔥 CYRE EXTREME PERFORMANCE INVESTIGATION 🔥', 'bold')
  log('Pushing Cyre to its absolute limits...', 'yellow')

  const totalStartTime = performance.now()

  try {
    await investigateTalentSpeedMystery()
    await huntMemoryLeaks()
    await concurrencyChaos()
    await branchSystemStress()
    await schemaPerformanceStress()

    const totalTime = performance.now() - totalStartTime

    separator('EXTREME INVESTIGATION COMPLETE')
    log(
      `🏁 Total Investigation Time: ${(totalTime / 1000).toFixed(2)} seconds`,
      'green'
    )
    log(`🎯 Cyre has been pushed to its limits and survived!`, 'bold')
    log(`📊 Check the detailed results above for optimization insights`, 'cyan')
  } catch (error) {
    log(`💥 Extreme test failed: ${error}`, 'red')
    throw error
  }
}

runExtremeBenchmarks().catch(console.error)

export {runExtremeBenchmarks}
