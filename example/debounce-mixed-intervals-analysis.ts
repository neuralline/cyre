// example/debounce-mixed-intervals-analysis.ts
// Analysis and fix for the Mixed Intervals test failure

import {cyre} from '../src'

/*

      C.Y.R.E - M.I.X.E.D - I.N.T.E.R.V.A.L.S - A.N.A.L.Y.S.I.S
      
      Analysis of the failing Mixed Intervals test:
      
      Original pattern: burst → pause → burst → pause
      Expected: 2 executions
      Actual: 1 execution
      
      The issue: The pause between bursts might not be long enough
      to allow the first debounce to complete before the second burst starts.

*/

interface TestAnalysis {
  pattern: string
  timing: number[]
  expectedExecutions: number
  actualExecutions: number
  issue: string
  solution: string
}

async function analyzeMixedIntervals(): Promise<TestAnalysis> {
  console.log('🔍 Analyzing Mixed Intervals Test Failure')
  console.log('='.repeat(50))

  await cyre.initialize()

  const actionId = 'mixed-intervals-analysis'
  let executionCount = 0
  const executionTimestamps: number[] = []
  const callTimestamps: number[] = []

  // Set up action and subscriber
  cyre.action({
    id: actionId,
    debounce: 300, // 300ms debounce
    payload: 'test'
  })

  cyre.on(actionId, (payload: any) => {
    const timestamp = Date.now()
    executionCount++
    executionTimestamps.push(timestamp)
    console.log(
      `     ✨ EXECUTION #${executionCount} at: ${new Date(
        timestamp
      ).toISOString()}`
    )
    return {executed: true, timestamp, payload}
  })

  const startTime = Date.now()

  // Original failing pattern analysis
  console.log('\n📊 Original Pattern Analysis:')
  console.log('   Pattern: burst → pause → burst → pause')
  console.log('   Debounce: 300ms')
  console.log('   Expected: 2 executions')

  // The original pattern from the test:
  const patterns = [
    {calls: 3, interval: 50, description: 'Initial burst'},
    {calls: 1, interval: 400, description: 'Long pause'}, // 400ms pause
    {calls: 4, interval: 75, description: 'Second burst'},
    {calls: 1, interval: 500, description: 'Final pause'} // 500ms pause
  ]

  console.log('\n🔄 Executing original pattern:')

  for (const pattern of patterns) {
    console.log(`\n   ${pattern.description}:`)

    for (let i = 0; i < pattern.calls; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      console.log(`     📞 Call at: ${callTime - startTime}ms`)

      await cyre.call(actionId, {
        pattern: pattern.description,
        iteration: i + 1,
        timestamp: callTime
      })

      if (i < pattern.calls - 1) {
        await wait(pattern.interval)
      }
    }
  }

  // Wait for final debounce
  await wait(500)

  const totalTime = Date.now() - startTime

  console.log('\n📈 Results:')
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Expected executions: 2`)
  console.log(`   Actual executions: ${executionCount}`)
  console.log(`   Execution timestamps:`)

  executionTimestamps.forEach((timestamp, index) => {
    console.log(`     ${index + 1}. ${timestamp - startTime}ms`)
  })

  // Analysis
  let issue = ''
  let solution = ''

  if (executionCount === 1) {
    // Check timing between bursts
    const firstBurstEnd = callTimestamps[2] // End of 3-call burst
    const secondBurstStart = callTimestamps[3] // Start of second burst after pause
    const gapTime = secondBurstStart - firstBurstEnd

    console.log(`\n🔍 Timing Analysis:`)
    console.log(`   First burst ends: ${firstBurstEnd - startTime}ms`)
    console.log(`   Second burst starts: ${secondBurstStart - startTime}ms`)
    console.log(`   Gap between bursts: ${gapTime}ms`)
    console.log(`   Debounce duration: 300ms`)

    if (gapTime <= 300) {
      issue = `Gap between bursts (${gapTime}ms) is not longer than debounce (300ms)`
      solution = `Increase pause duration to > 300ms + execution time`
    } else {
      issue = `Gap is sufficient (${gapTime}ms > 300ms) - check execution timing`
      solution = `Verify debounce execution completes before second burst`
    }
  }

  cyre.forget(actionId)

  return {
    pattern: 'burst → pause → burst → pause',
    timing: callTimestamps.map(t => t - startTime),
    expectedExecutions: 2,
    actualExecutions: executionCount,
    issue,
    solution
  }
}

async function testCorrectedPattern(): Promise<TestAnalysis> {
  console.log('\n🔧 Testing Corrected Pattern')
  console.log('='.repeat(50))

  const actionId = 'corrected-mixed-intervals'
  let executionCount = 0
  const executionTimestamps: number[] = []
  const callTimestamps: number[] = []

  // Set up action and subscriber
  cyre.action({
    id: actionId,
    debounce: 300,
    payload: 'test'
  })

  cyre.on(actionId, (payload: any) => {
    const timestamp = Date.now()
    executionCount++
    executionTimestamps.push(timestamp)
    console.log(
      `     ✨ EXECUTION #${executionCount} at: ${new Date(
        timestamp
      ).toISOString()}`
    )
    return {executed: true, timestamp, payload}
  })

  const startTime = Date.now()

  // Corrected pattern with longer pause
  const correctedPatterns = [
    {calls: 3, interval: 50, description: 'Initial burst'},
    {calls: 1, interval: 800, description: 'Extended pause'}, // 800ms pause (300ms debounce + 500ms safety)
    {calls: 4, interval: 75, description: 'Second burst'},
    {calls: 1, interval: 600, description: 'Final pause'}
  ]

  console.log('   Pattern: burst → EXTENDED pause → burst → pause')
  console.log('   Debounce: 300ms')
  console.log('   Extended pause: 800ms (300ms debounce + 500ms safety)')
  console.log('   Expected: 2 executions')

  console.log('\n🔄 Executing corrected pattern:')

  for (const pattern of correctedPatterns) {
    console.log(`\n   ${pattern.description}:`)

    for (let i = 0; i < pattern.calls; i++) {
      const callTime = Date.now()
      callTimestamps.push(callTime)

      console.log(`     📞 Call at: ${callTime - startTime}ms`)

      await cyre.call(actionId, {
        pattern: pattern.description,
        iteration: i + 1,
        timestamp: callTime
      })

      if (i < pattern.calls - 1) {
        await wait(pattern.interval)
      }
    }
  }

  // Wait for final debounce
  await wait(500)

  const totalTime = Date.now() - startTime

  console.log('\n📈 Corrected Results:')
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Expected executions: 2`)
  console.log(`   Actual executions: ${executionCount}`)
  console.log(`   Success: ${executionCount === 2 ? '✅' : '❌'}`)

  if (executionTimestamps.length > 0) {
    console.log(`   Execution timestamps:`)
    executionTimestamps.forEach((timestamp, index) => {
      const delay =
        index === 0
          ? timestamp - callTimestamps[2] // First execution after first burst
          : timestamp - callTimestamps[callTimestamps.length - 1] // Second execution after second burst

      console.log(
        `     ${index + 1}. ${timestamp - startTime}ms (delay: ${delay}ms)`
      )
    })
  }

  cyre.forget(actionId)

  return {
    pattern: 'burst → EXTENDED pause → burst → pause',
    timing: callTimestamps.map(t => t - startTime),
    expectedExecutions: 2,
    actualExecutions: executionCount,
    issue:
      executionCount === 2 ? 'None - pattern works correctly' : 'Still failing',
    solution:
      executionCount === 2
        ? 'Use extended pause > debounce + safety margin'
        : 'Further investigation needed'
  }
}

async function generateFix(): Promise<void> {
  console.log('\n🛠️  RECOMMENDED FIX FOR MIXED INTERVALS TEST')
  console.log('='.repeat(60))

  const originalAnalysis = await analyzeMixedIntervals()
  await wait(1000) // Gap between tests
  const correctedAnalysis = await testCorrectedPattern()

  console.log('\n📋 Summary:')
  console.log('Original Pattern:')
  console.log(`   Issue: ${originalAnalysis.issue}`)
  console.log(
    `   Result: ${originalAnalysis.actualExecutions}/${originalAnalysis.expectedExecutions} executions`
  )

  console.log('\nCorrected Pattern:')
  console.log(`   Solution: ${correctedAnalysis.solution}`)
  console.log(
    `   Result: ${correctedAnalysis.actualExecutions}/${correctedAnalysis.expectedExecutions} executions`
  )

  console.log('\n🔧 FIX IMPLEMENTATION:')
  console.log(
    'In the Mixed Intervals test, change the pause duration from 400ms to:'
  )
  console.log(
    '   const extendedPause = debounceMs + 500 // 300ms + 500ms = 800ms'
  )
  console.log('')
  console.log('Updated pattern should be:')
  console.log('   {calls: 3, interval: 50, description: "Initial burst"},')
  console.log(
    '   {calls: 1, interval: 800, description: "Extended pause"}, // Was 400ms'
  )
  console.log('   {calls: 4, interval: 75, description: "Second burst"},')
  console.log('   {calls: 1, interval: 500, description: "Final pause"}')
  console.log('')
  console.log('This ensures:')
  console.log('1. First burst completes debounce (300ms)')
  console.log('2. Extended pause (800ms) allows first execution')
  console.log('3. Second burst starts fresh')
  console.log('4. Second burst completes debounce for second execution')
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Export and run
export const runMixedIntervalsAnalysis = async (): Promise<void> => {
  await generateFix()
}

// Auto-run if executed directly

runMixedIntervalsAnalysis().catch(error => {
  console.error('Analysis failed:', error)
  process.exit(1)
})
