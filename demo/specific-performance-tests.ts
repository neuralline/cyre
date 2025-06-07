// demo/specific-performance-tests.ts
// Targeted tests for specific performance concerns

import {compileActionWithStats} from '../src/schema/compilation-integration'
import {processCall} from '../src/components/cyre-call'
import type {IO, ActionPayload} from '../src/types/core'

/*

      C.Y.R.E - S.P.E.C.I.F.I.C - P.E.R.F.O.R.M.A.N.C.E - T.E.S.T.S
      
      Targeted validation for specific performance concerns:
      1. Slow channel interference with fast channels
      2. Concurrency impact on individual channel performance
      3. State talent execution overhead
      4. Complex action impact on simple action performance
      5. Pipeline blocking behavior
      6. Memory pressure under mixed workloads

*/

/**
 * Test: Do slow channels affect fast channels?
 * Critical: Fast channels should maintain performance regardless of slow channels
 */
export const testSlowChannelInterference = async (): Promise<{
  passed: boolean
  fastAlone: number
  fastWithSlow: number
  interferencePercent: number
  details: string
}> => {
  console.log('🔬 Critical Test: Slow Channel Interference')

  // Define fast and slow actions
  const fastAction: IO = {
    id: 'ultra-fast-test',
    type: 'fast',
    payload: {test: true}
  } as IO

  const slowAction: IO = {
    id: 'intentionally-slow-test',
    type: 'slow',
    condition: (payload: any) => {
      // Simulate 10ms of heavy computation
      const start = performance.now()
      while (performance.now() - start < 10) {
        Math.sqrt(Math.random())
      }
      return true
    },
    transform: (payload: any) => {
      // Another 5ms of processing
      const start = performance.now()
      while (performance.now() - start < 5) {
        Math.sqrt(Math.random())
      }
      return {...payload, slow: true}
    }
  } as IO

  const compiledFast = compileActionWithStats(fastAction).compiledAction
  const compiledSlow = compileActionWithStats(slowAction).compiledAction

  // Test 1: Fast channels alone
  console.log('   📊 Measuring fast channels in isolation...')
  const fastAloneTimes: number[] = []

  for (let i = 0; i < 100; i++) {
    const start = performance.now()
    await processCall(compiledFast, {iteration: i})
    fastAloneTimes.push(performance.now() - start)
  }

  const fastAloneAverage =
    fastAloneTimes.reduce((a, b) => a + b) / fastAloneTimes.length

  // Test 2: Fast channels with slow channels running concurrently
  console.log('   📊 Measuring fast channels with slow channels running...')
  const fastWithSlowTimes: number[] = []

  // Start multiple slow channels
  const slowPromises: Promise<any>[] = []
  for (let i = 0; i < 20; i++) {
    slowPromises.push(processCall(compiledSlow, {heavyWork: true}))
  }

  // Measure fast channels while slow ones are running
  for (let i = 0; i < 100; i++) {
    const start = performance.now()
    await processCall(compiledFast, {iteration: i})
    fastWithSlowTimes.push(performance.now() - start)
  }

  // Wait for slow channels to complete
  await Promise.all(slowPromises)

  const fastWithSlowAverage =
    fastWithSlowTimes.reduce((a, b) => a + b) / fastWithSlowTimes.length
  const interferencePercent = (fastWithSlowAverage / fastAloneAverage - 1) * 100

  const passed = interferencePercent < 15 // Allow up to 15% interference

  console.log(`   ✅ Fast alone: ${fastAloneAverage.toFixed(4)}ms`)
  console.log(`   ✅ Fast with slow: ${fastWithSlowAverage.toFixed(4)}ms`)
  console.log(`   ✅ Interference: ${interferencePercent.toFixed(1)}%`)
  console.log(
    `   ${passed ? '✅ PASSED' : '❌ FAILED'}: ${
      passed ? 'Minimal interference' : 'High interference detected'
    }`
  )

  return {
    passed,
    fastAlone: fastAloneAverage,
    fastWithSlow: fastWithSlowAverage,
    interferencePercent,
    details: passed
      ? 'Channel isolation working correctly'
      : 'Slow channels affecting fast channels'
  }
}

/**
 * Test: Concurrency impact on performance
 * Validate that concurrent execution doesn't degrade individual performance
 */
export const testConcurrencyImpact = async (): Promise<{
  passed: boolean
  results: Array<{concurrency: number; avgTime: number; degradation: number}>
  details: string
}> => {
  console.log('🔬 Critical Test: Concurrency Performance Impact')

  const testAction: IO = {
    id: 'concurrency-test',
    type: 'concurrent',
    condition: (payload: any) => payload.valid,
    transform: (payload: any) => ({...payload, processed: true}),
    detectChanges: true
  } as IO

  const compiledAction = compileActionWithStats(testAction).compiledAction
  const concurrencyLevels = [1, 5, 10, 20, 50]
  const results: Array<{
    concurrency: number
    avgTime: number
    degradation: number
  }> = []

  let baselineTime = 0

  for (const concurrency of concurrencyLevels) {
    console.log(`   📊 Testing ${concurrency} concurrent actions...`)

    const promises: Promise<any>[] = []
    const startTime = performance.now()

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        processCall(compiledAction, {
          valid: true,
          data: {id: i, value: Math.random()},
          concurrencyTest: true
        })
      )
    }

    await Promise.all(promises)
    const totalTime = performance.now() - startTime
    const avgTime = totalTime / concurrency

    if (concurrency === 1) {
      baselineTime = avgTime
    }

    const degradation = (avgTime / baselineTime - 1) * 100

    results.push({concurrency, avgTime, degradation})

    console.log(`      Average per action: ${avgTime.toFixed(4)}ms`)
    console.log(`      Performance degradation: ${degradation.toFixed(1)}%`)
  }

  // Check if degradation is reasonable (under 50% even at high concurrency)
  const maxDegradation = Math.max(...results.map(r => r.degradation))
  const passed = maxDegradation < 50

  console.log(
    `   ${
      passed ? '✅ PASSED' : '❌ FAILED'
    }: Max degradation ${maxDegradation.toFixed(1)}%`
  )

  return {
    passed,
    results,
    details: passed
      ? 'Concurrency scaling is acceptable'
      : 'High performance degradation under concurrency'
  }
}

/**
 * Test: State talent overhead
 * Measure individual talent execution overhead
 */
export const testStateTalentOverhead = async (): Promise<{
  passed: boolean
  talentPerformance: Record<string, {avgTime: number; opsPerSec: number}>
  details: string
}> => {
  console.log('🔬 Critical Test: State Talent Execution Overhead')

  const iterations = 10000
  const talentPerformance: Record<
    string,
    {avgTime: number; opsPerSec: number}
  > = {}

  const testPayload = {
    valid: true,
    data: {userId: 'test-123', value: 42},
    timestamp: Date.now()
  }

  const talentTests = [
    {
      name: 'required',
      action: {id: 'test-required', required: true}
    },
    {
      name: 'condition',
      action: {id: 'test-condition', condition: (p: any) => p.valid === true}
    },
    {
      name: 'selector',
      action: {id: 'test-selector', selector: (p: any) => p.data}
    },
    {
      name: 'transform',
      action: {
        id: 'test-transform',
        transform: (p: any) => ({...p, processed: true})
      }
    },
    {
      name: 'detectChanges',
      action: {id: 'test-detect-changes', detectChanges: true}
    }
  ]

  for (const talent of talentTests) {
    console.log(
      `   📊 Testing ${talent.name} talent (${iterations} iterations)...`
    )

    const compiledAction = compileActionWithStats({
      ...talent.action,
      _hasProcessing: true,
      _processingTalents: [talent.name]
    }).compiledAction

    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await processCall(compiledAction, testPayload)
      times.push(performance.now() - start)
    }

    const avgTime = times.reduce((a, b) => a + b) / times.length
    const opsPerSec = 1000 / avgTime

    talentPerformance[talent.name] = {avgTime, opsPerSec}

    console.log(
      `      Average: ${avgTime.toFixed(4)}ms (${opsPerSec.toFixed(0)} ops/sec)`
    )
  }

  // Check if all talents execute under reasonable time (< 0.1ms each)
  const maxTime = Math.max(
    ...Object.values(talentPerformance).map(p => p.avgTime)
  )
  const passed = maxTime < 0.1

  console.log(
    `   ${
      passed ? '✅ PASSED' : '❌ FAILED'
    }: Max talent time ${maxTime.toFixed(4)}ms`
  )

  return {
    passed,
    talentPerformance,
    details: passed
      ? 'All talents execute efficiently'
      : 'Some talents have high overhead'
  }
}

/**
 * Test: Complex action impact on simple actions
 * Ensure complex actions don't slow down simple actions in the same system
 */
export const testComplexSimpleImpact = async (): Promise<{
  passed: boolean
  simpleAlone: number
  simpleWithComplex: number
  impactPercent: number
  details: string
}> => {
  console.log('🔬 Critical Test: Complex Action Impact on Simple Actions')

  const simpleAction: IO = {
    id: 'simple-baseline',
    type: 'simple',
    payload: {simple: true}
  } as IO

  const complexAction: IO = {
    id: 'complex-heavy',
    type: 'complex',
    required: true,
    condition: (payload: any) => {
      // Simulate complex condition logic
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i)
      }
      return payload.valid
    },
    selector: (payload: any) => payload.data,
    transform: (payload: any) => {
      // Simulate complex transformation
      const result = {...payload}
      for (let i = 0; i < 500; i++) {
        result[`computed_${i}`] = Math.random() * i
      }
      return result
    },
    detectChanges: true,
    priority: {level: 'high', maxRetries: 3}
  } as IO

  const compiledSimple = compileActionWithStats(simpleAction).compiledAction
  const compiledComplex = compileActionWithStats(complexAction).compiledAction

  // Test 1: Simple actions alone
  console.log('   📊 Measuring simple actions in isolation...')
  const simpleAloneTimes: number[] = []

  for (let i = 0; i < 200; i++) {
    const start = performance.now()
    await processCall(compiledSimple, {iteration: i})
    simpleAloneTimes.push(performance.now() - start)
  }

  const simpleAloneAvg =
    simpleAloneTimes.reduce((a, b) => a + b) / simpleAloneTimes.length

  // Test 2: Simple actions with complex actions running
  console.log('   📊 Measuring simple actions with complex actions running...')
  const simpleWithComplexTimes: number[] = []

  // Start complex actions in background
  const complexPromises: Promise<any>[] = []
  for (let i = 0; i < 10; i++) {
    complexPromises.push(
      processCall(compiledComplex, {
        valid: true,
        data: {heavy: true, index: i},
        complex: true
      })
    )
  }

  // Measure simple actions
  for (let i = 0; i < 200; i++) {
    const start = performance.now()
    await processCall(compiledSimple, {iteration: i})
    simpleWithComplexTimes.push(performance.now() - start)
  }

  await Promise.all(complexPromises)

  const simpleWithComplexAvg =
    simpleWithComplexTimes.reduce((a, b) => a + b) /
    simpleWithComplexTimes.length
  const impactPercent = (simpleWithComplexAvg / simpleAloneAvg - 1) * 100

  const passed = impactPercent < 20 // Allow up to 20% impact

  console.log(`   ✅ Simple alone: ${simpleAloneAvg.toFixed(4)}ms`)
  console.log(`   ✅ Simple with complex: ${simpleWithComplexAvg.toFixed(4)}ms`)
  console.log(`   ✅ Impact: ${impactPercent.toFixed(1)}%`)
  console.log(
    `   ${passed ? '✅ PASSED' : '❌ FAILED'}: ${
      passed ? 'Minimal impact' : 'High impact detected'
    }`
  )

  return {
    passed,
    simpleAlone: simpleAloneAvg,
    simpleWithComplex: simpleWithComplexAvg,
    impactPercent,
    details: passed
      ? "Complex actions don't significantly impact simple actions"
      : 'Complex actions slowing down simple actions'
  }
}

/**
 * Test: Pipeline blocking behavior
 * Ensure pipeline failures don't block other actions
 */
export const testPipelineBlocking = async (): Promise<{
  passed: boolean
  successfulActions: number
  failedActions: number
  blockingDetected: boolean
  details: string
}> => {
  console.log('🔬 Critical Test: Pipeline Blocking Behavior')

  const goodAction: IO = {
    id: 'good-action',
    type: 'good',
    condition: (payload: any) => payload.valid,
    transform: (payload: any) => ({...payload, good: true})
  } as IO

  const badAction: IO = {
    id: 'bad-action',
    type: 'bad',
    condition: (payload: any) => {
      throw new Error('Intentional test error')
    },
    transform: (payload: any) => payload
  } as IO

  const compiledGood = compileActionWithStats(goodAction).compiledAction
  const compiledBad = compileActionWithStats(badAction).compiledAction

  let successfulActions = 0
  let failedActions = 0
  const promises: Promise<any>[] = []

  console.log('   📊 Running mix of good and bad actions...')

  // Interleave good and bad actions
  for (let i = 0; i < 50; i++) {
    // Good action
    promises.push(
      processCall(compiledGood, {valid: true, index: i})
        .then(() => successfulActions++)
        .catch(() => failedActions++)
    )

    // Bad action
    promises.push(
      processCall(compiledBad, {valid: true, index: i})
        .then(() => successfulActions++)
        .catch(() => failedActions++)
    )
  }

  await Promise.allSettled(promises)

  const blockingDetected = successfulActions === 0 && failedActions > 0
  const passed = successfulActions > 0 && !blockingDetected

  console.log(`   ✅ Successful actions: ${successfulActions}`)
  console.log(`   ✅ Failed actions: ${failedActions}`)
  console.log(
    `   ${passed ? '✅ PASSED' : '❌ FAILED'}: ${
      passed ? 'No blocking detected' : 'Pipeline blocking detected'
    }`
  )

  return {
    passed,
    successfulActions,
    failedActions,
    blockingDetected,
    details: passed
      ? "Pipeline failures don't block other actions"
      : 'Pipeline failures causing system blocking'
  }
}

/**
 * Test: Memory pressure under mixed workloads
 * Validate memory behavior under stress
 */
export const testMemoryPressure = async (): Promise<{
  passed: boolean
  memoryGrowth: number
  memoryPerAction: number
  details: string
}> => {
  console.log('🔬 Critical Test: Memory Pressure Under Mixed Workloads')

  const getMemory = () => {
    if (global.gc) global.gc()
    return process.memoryUsage?.().heapUsed || 0
  }

  const initialMemory = getMemory()

  const actions = [
    {
      id: 'memory-test-simple',
      type: 'simple',
      payload: {test: true}
    },
    {
      id: 'memory-test-complex',
      type: 'complex',
      condition: (p: any) => p.valid,
      transform: (p: any) => ({
        ...p,
        largeData: new Array(100).fill(Math.random())
      }),
      detectChanges: true
    }
  ]

  const compiledActions = actions.map(
    action => compileActionWithStats(action).compiledAction
  )

  console.log(
    `   📊 Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`
  )

  const totalActions = 5000
  const promises: Promise<any>[] = []

  for (let i = 0; i < totalActions; i++) {
    const action = compiledActions[i % compiledActions.length]
    promises.push(
      processCall(action, {
        valid: true,
        iteration: i,
        data: {value: Math.random()}
      })
    )
  }

  await Promise.all(promises)

  const finalMemory = getMemory()
  const memoryGrowth = finalMemory - initialMemory
  const memoryPerAction = memoryGrowth / totalActions

  console.log(`   📊 Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`)
  console.log(
    `   📊 Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`
  )
  console.log(
    `   📊 Memory per action: ${(memoryPerAction / 1024).toFixed(2)}KB`
  )

  // Pass if memory per action is under 1KB
  const passed = memoryPerAction < 1024

  console.log(
    `   ${passed ? '✅ PASSED' : '❌ FAILED'}: ${
      passed ? 'Reasonable memory usage' : 'High memory usage detected'
    }`
  )

  return {
    passed,
    memoryGrowth: memoryGrowth / 1024 / 1024, // MB
    memoryPerAction: memoryPerAction / 1024, // KB
    details: passed
      ? 'Memory usage is within acceptable limits'
      : 'High memory usage detected'
  }
}

/**
 * Run all specific performance tests
 */
export const runSpecificPerformanceTests = async (): Promise<{
  allPassed: boolean
  results: Array<{test: string; passed: boolean; details: string}>
}> => {
  console.log('🎯 Cyre Specific Performance Tests\n')
  console.log('Testing critical performance concerns...\n')

  const results: Array<{test: string; passed: boolean; details: string}> = []

  try {
    // Test 1: Slow channel interference
    const interferenceTest = await testSlowChannelInterference()
    results.push({
      test: 'Slow Channel Interference',
      passed: interferenceTest.passed,
      details: interferenceTest.details
    })

    console.log('')

    // Test 2: Concurrency impact
    const concurrencyTest = await testConcurrencyImpact()
    results.push({
      test: 'Concurrency Impact',
      passed: concurrencyTest.passed,
      details: concurrencyTest.details
    })

    console.log('')

    // Test 3: State talent overhead
    const talentTest = await testStateTalentOverhead()
    results.push({
      test: 'State Talent Overhead',
      passed: talentTest.passed,
      details: talentTest.details
    })

    console.log('')

    // Test 4: Complex action impact
    const complexTest = await testComplexSimpleImpact()
    results.push({
      test: 'Complex Action Impact',
      passed: complexTest.passed,
      details: complexTest.details
    })

    console.log('')

    // Test 5: Pipeline blocking
    const blockingTest = await testPipelineBlocking()
    results.push({
      test: 'Pipeline Blocking',
      passed: blockingTest.passed,
      details: blockingTest.details
    })

    console.log('')

    // Test 6: Memory pressure
    const memoryTest = await testMemoryPressure()
    results.push({
      test: 'Memory Pressure',
      passed: memoryTest.passed,
      details: memoryTest.details
    })

    console.log('')

    // Summary
    const allPassed = results.every(r => r.passed)
    const passedCount = results.filter(r => r.passed).length

    console.log('📊 Test Summary:')
    results.forEach(result => {
      console.log(
        `   ${result.passed ? '✅' : '❌'} ${result.test}: ${result.details}`
      )
    })

    console.log('')
    console.log(
      `🎯 Overall Result: ${
        allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'
      }`
    )
    console.log(`📈 Score: ${passedCount}/${results.length} tests passed`)

    if (allPassed) {
      console.log('🚀 Performance optimization is working correctly!')
      console.log('✅ System is ready for production use')
    } else {
      console.log('⚠️  Performance issues detected - review failed tests')
      console.log(
        '🔧 Consider additional optimization or configuration changes'
      )
    }

    return {allPassed, results}
  } catch (error) {
    console.error('❌ Performance test suite failed:', error)
    throw error
  }
}

// Export individual test functions for targeted testing

// Run specific tests if this file is executed directly
runSpecificPerformanceTests().catch(console.error)
