// demo/high-freq-test.ts
import {cyre} from '../src/app'

interface HighFreqMetrics {
  name: string
  callsPerSecond: number
  totalCalls: number
  executions: number
  reductionPercent: number
  avgCallTime: number
  totalCallTime: number
  executionTimes: number[]
  firstExecution: number
  lastExecution: number
  executionSpread: number
}

async function highFrequencyTest(
  channelId: string,
  config: any,
  callsPerSecond: number,
  durationSeconds: number = 5
): Promise<HighFreqMetrics> {
  console.log(
    `\n🔥 ${channelId}: ${callsPerSecond} calls/sec for ${durationSeconds}s`
  )

  const executions: number[] = []
  const callTimes: number[] = []
  let totalCalls = 0

  // Create channel
  cyre.action({id: channelId, ...config})

  // Track executions with timestamps
  cyre.on(channelId, payload => {
    const timestamp = performance.now()
    executions.push(timestamp)
    console.log(`   ⚡ Executed: ${payload} (${executions.length})`)
    return `result-${payload}`
  })

  const startTime = performance.now()
  const callInterval = 1000 / callsPerSecond

  // High-frequency call generator
  const callPromises: Promise<void>[] = []

  for (let i = 0; i < callsPerSecond * durationSeconds; i++) {
    const callPromise = new Promise<void>(resolve => {
      setTimeout(async () => {
        const callStart = performance.now()

        await cyre.call(channelId, `msg-${i}`)

        const callEnd = performance.now()
        callTimes.push(callEnd - callStart)
        totalCalls++
        resolve()
      }, i * callInterval)
    })

    callPromises.push(callPromise)
  }

  // Wait for all calls to complete
  await Promise.all(callPromises)

  // Wait for any pending executions
  await new Promise(resolve => setTimeout(resolve, 1000))

  const endTime = performance.now()
  const totalTestTime = endTime - startTime

  // Calculate metrics
  const reductionPercent = ((totalCalls - executions.length) / totalCalls) * 100
  const avgCallTime = callTimes.reduce((a, b) => a + b, 0) / callTimes.length
  const executionSpread =
    executions.length > 1
      ? executions[executions.length - 1] - executions[0]
      : 0

  return {
    name: channelId,
    callsPerSecond,
    totalCalls,
    executions: executions.length,
    reductionPercent,
    avgCallTime,
    totalCallTime: totalTestTime,
    executionTimes: executions,
    firstExecution: executions[0] || 0,
    lastExecution: executions[executions.length - 1] || 0,
    executionSpread
  }
}

async function compareHighFrequency() {
  console.log('🚀 High Frequency Buffer vs Debounce Comparison')
  console.log('===============================================')

  await cyre.init()

  // Test configurations
  const window = 200 // 200ms window/delay

  const tests = [
    {
      name: 'Moderate Load',
      callsPerSecond: 100,
      duration: 5
    },
    {
      name: 'High Load',
      callsPerSecond: 500,
      duration: 3
    },
    {
      name: 'Extreme Load',
      callsPerSecond: 1000,
      duration: 2
    }
  ]

  for (const test of tests) {
    console.log(`\n📊 ${test.name} (${test.callsPerSecond} calls/sec)`)
    console.log('='.repeat(60))

    // Test Buffer
    const bufferResult = await highFrequencyTest(
      `buffer-${test.callsPerSecond}`,
      {buffer: {window}},
      test.callsPerSecond,
      test.duration
    )

    // Test Debounce
    const debounceResult = await highFrequencyTest(
      `debounce-${test.callsPerSecond}`,
      {debounce: window},
      test.callsPerSecond,
      test.duration
    )

    // Test Debounce with maxWait (should behave like buffer)
    const debounceMaxWaitResult = await highFrequencyTest(
      `debounce-maxwait-${test.callsPerSecond}`,
      {debounce: window, maxWait: window},
      test.callsPerSecond,
      test.duration
    )

    // Analysis
    console.log(`\n📈 Results:`)
    console.log(
      `Buffer:              ${bufferResult.totalCalls} calls → ${
        bufferResult.executions
      } executions (${bufferResult.reductionPercent.toFixed(1)}% reduction)`
    )
    console.log(
      `Debounce:            ${debounceResult.totalCalls} calls → ${
        debounceResult.executions
      } executions (${debounceResult.reductionPercent.toFixed(1)}% reduction)`
    )
    console.log(
      `Debounce+maxWait:    ${debounceMaxWaitResult.totalCalls} calls → ${
        debounceMaxWaitResult.executions
      } executions (${debounceMaxWaitResult.reductionPercent.toFixed(
        1
      )}% reduction)`
    )

    console.log(`\n⚡ Call Performance:`)
    console.log(`Buffer avg time:     ${bufferResult.avgCallTime.toFixed(3)}ms`)
    console.log(
      `Debounce avg time:   ${debounceResult.avgCallTime.toFixed(3)}ms`
    )
    console.log(
      `Debounce+maxWait:    ${debounceMaxWaitResult.avgCallTime.toFixed(3)}ms`
    )

    console.log(`\n🎯 Execution Pattern:`)
    console.log(
      `Buffer executions:   ${
        bufferResult.executions
      } over ${bufferResult.executionSpread.toFixed(0)}ms`
    )
    console.log(
      `Debounce executions: ${
        debounceResult.executions
      } over ${debounceResult.executionSpread.toFixed(0)}ms`
    )
    console.log(
      `Debounce+maxWait:    ${
        debounceMaxWaitResult.executions
      } over ${debounceMaxWaitResult.executionSpread.toFixed(0)}ms`
    )

    // Winner analysis
    const fastest = [
      {name: 'Buffer', time: bufferResult.avgCallTime},
      {name: 'Debounce', time: debounceResult.avgCallTime},
      {name: 'Debounce+maxWait', time: debounceMaxWaitResult.avgCallTime}
    ].sort((a, b) => a.time - b.time)[0]

    console.log(
      `\n🏆 Fastest: ${fastest.name} (${fastest.time.toFixed(3)}ms avg)`
    )

    // Test our hypothesis: buffer ≈ debounce+maxWait
    const bufferVsMaxWait = Math.abs(
      bufferResult.avgCallTime - debounceMaxWaitResult.avgCallTime
    )
    const similarity = bufferVsMaxWait < 0.01 ? 'IDENTICAL' : 'DIFFERENT'

    console.log(`\n🔬 Hypothesis Test (buffer ≈ debounce+maxWait):`)
    console.log(`   Performance difference: ${bufferVsMaxWait.toFixed(4)}ms`)
    console.log(
      `   Execution difference: ${Math.abs(
        bufferResult.executions - debounceMaxWaitResult.executions
      )}`
    )
    console.log(`   Verdict: ${similarity} behavior`)
  }
}

async function sustainedLoadTest() {
  console.log('\n💥 Sustained Load Test: 1000 calls/sec for 10 seconds')
  console.log('====================================================')

  const results = await Promise.all([
    highFrequencyTest('buffer-sustained', {buffer: {window: 100}}, 1000, 10),
    highFrequencyTest('debounce-sustained', {debounce: 100}, 1000, 10),
    highFrequencyTest(
      'debounce-maxwait-sustained',
      {debounce: 100, maxWait: 100},
      1000,
      10
    )
  ])

  console.log(`\n🏁 Sustained Load Results:`)
  for (const result of results) {
    console.log(`${result.name}:`)
    console.log(
      `   ${result.totalCalls} calls → ${
        result.executions
      } executions (${result.reductionPercent.toFixed(1)}% reduction)`
    )
    console.log(`   Avg call time: ${result.avgCallTime.toFixed(3)}ms`)
    console.log(`   Execution spread: ${result.executionSpread.toFixed(0)}ms`)
  }

  // Find most efficient
  const mostEfficient = results.sort((a, b) => a.avgCallTime - b.avgCallTime)[0]
  console.log(`\n🎯 Most efficient under sustained load: ${mostEfficient.name}`)
  console.log(
    `   Performance: ${mostEfficient.avgCallTime.toFixed(3)}ms per call`
  )
  console.log(
    `   Efficiency: ${mostEfficient.reductionPercent.toFixed(
      1
    )}% call reduction`
  )

  return results
}

// Run all tests
async function runHighFreqTests() {
  try {
    await compareHighFrequency()
    await sustainedLoadTest()

    console.log('\n🎯 Final Analysis')
    console.log('================')
    console.log('Buffer advantages:')
    console.log('  ✅ Simpler implementation (no timer reset)')
    console.log('  ✅ Predictable execution timing')
    console.log('  ✅ Lower computational overhead')
    console.log('  ✅ Guaranteed execution (no starvation)')

    console.log('\nDebounce advantages:')
    console.log('  ✅ Higher call reduction under burst loads')
    console.log('  ✅ More aggressive optimization for sporadic calls')

    console.log('\nDebounce+maxWait:')
    console.log('  ✅ Combines benefits of both approaches')
    console.log('  ⚠️  Higher complexity (two timer mechanisms)')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Export and auto-run
export {runHighFreqTests, compareHighFrequency, sustainedLoadTest}

runHighFreqTests()
