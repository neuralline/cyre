// demo/waterfall-demo.ts
// Comprehensive demo testing Cyre's waterfall dispatch execution

import {cyre} from '../src/index'

/**
 * Demo: Data Processing Pipeline using Waterfall Execution
 * Each handler processes the result of the previous handler
 */

interface UserData {
  id: number
  name: string
  email: string
  age?: number
  score?: number
  level?: string
  processed?: boolean
}

async function runWaterfallDemo() {
  console.log('🌊 CYRE WATERFALL EXECUTION DEMO\n')

  // Initialize Cyre
  await cyre.init()

  // === DEMO 1: Data Processing Pipeline ===
  console.log('📊 Demo 1: User Data Processing Pipeline')
  console.log('='.repeat(50))

  // Create action with waterfall dispatch
  cyre.action({
    id: 'user-processing-pipeline',
    dispatch: 'waterfall',
    errorStrategy: 'fail-fast',
    dispatchTimeout: 5000
  })

  // Handler 1: Validate and normalize data
  cyre.on('user-processing-pipeline', (userData: UserData) => {
    console.log('🔍 Handler 1: Validating data...')
    console.log('   Input:', JSON.stringify(userData, null, 2))

    if (!userData.name || !userData.email) {
      throw new Error('Missing required fields: name or email')
    }

    const normalized = {
      ...userData,
      name: userData.name.trim().toLowerCase(),
      email: userData.email.trim().toLowerCase(),
      age: userData.age || 0
    }

    console.log('   ✅ Validation complete')
    console.log('   Output:', JSON.stringify(normalized, null, 2))
    return normalized
  })

  // Handler 2: Calculate user score based on age
  cyre.on('user-processing-pipeline', (userData: UserData) => {
    console.log('\n🧮 Handler 2: Calculating score...')
    console.log('   Input:', JSON.stringify(userData, null, 2))

    const score = Math.max(0, 100 - (userData.age || 0) * 2)
    const withScore = {
      ...userData,
      score
    }

    console.log('   ✅ Score calculation complete')
    console.log('   Output:', JSON.stringify(withScore, null, 2))
    return withScore
  })

  // Handler 3: Determine user level based on score
  cyre.on('user-processing-pipeline', (userData: UserData) => {
    console.log('\n🏆 Handler 3: Determining level...')
    console.log('   Input:', JSON.stringify(userData, null, 2))

    let level: string
    const score = userData.score || 0

    if (score >= 80) level = 'expert'
    else if (score >= 60) level = 'intermediate'
    else if (score >= 40) level = 'beginner'
    else level = 'novice'

    const withLevel = {
      ...userData,
      level,
      processed: true
    }

    console.log('   ✅ Level determination complete')
    console.log('   Output:', JSON.stringify(withLevel, null, 2))
    return withLevel
  })

  // Test the waterfall pipeline
  const testUser: UserData = {
    id: 1,
    name: '  John Doe  ',
    email: '  JOHN@EXAMPLE.COM  ',
    age: 25
  }

  console.log('\n🚀 Executing waterfall pipeline...')
  console.log('Initial input:', JSON.stringify(testUser, null, 2))
  console.log('\n' + '─'.repeat(50))

  const result = await cyre.call('user-processing-pipeline', testUser)

  console.log('\n' + '─'.repeat(50))
  console.log('🎯 Final Result:')
  console.log('Success:', result.ok)
  console.log('Final Data:', JSON.stringify(result.payload, null, 2))
  console.log('Execution Time:', result.metadata?.executionTime + 'ms')
  console.log('Handlers Executed:', result.metadata?.handlerCount)

  // === DEMO 2: Mathematical Pipeline ===
  console.log('\n\n🧮 Demo 2: Mathematical Operations Pipeline')
  console.log('='.repeat(50))

  cyre.action({
    id: 'math-pipeline',
    dispatch: 'waterfall',
    errorStrategy: 'fail-fast'
  })

  // Handler 1: Add 10
  cyre.on('math-pipeline', (num: number) => {
    console.log(`➕ Add 10: ${num} + 10 = ${num + 10}`)
    return num + 10
  })

  // Handler 2: Multiply by 2
  cyre.on('math-pipeline', (num: number) => {
    console.log(`✖️  Multiply by 2: ${num} × 2 = ${num * 2}`)
    return num * 2
  })

  // Handler 3: Subtract 5
  cyre.on('math-pipeline', (num: number) => {
    console.log(`➖ Subtract 5: ${num} - 5 = ${num - 5}`)
    return num - 5
  })

  // Handler 4: Square the result
  cyre.on('math-pipeline', (num: number) => {
    console.log(`🔢 Square: ${num}² = ${num * num}`)
    return num * num
  })

  console.log('\n🚀 Starting with number: 5')
  console.log('Expected flow: 5 → 15 → 30 → 25 → 625')
  console.log('\n' + '─'.repeat(30))

  const mathResult = await cyre.call('math-pipeline', 5)

  console.log('─'.repeat(30))
  console.log('🎯 Mathematical Pipeline Result:', mathResult.payload)
  console.log('Expected: 625, Got:', mathResult.payload)
  console.log('✅ Test', mathResult.payload === 625 ? 'PASSED' : 'FAILED')

  // === DEMO 3: Error Handling in Waterfall ===
  console.log('\n\n❌ Demo 3: Error Handling with Fail-Fast')
  console.log('='.repeat(50))

  cyre.action({
    id: 'error-pipeline',
    dispatch: 'waterfall',
    errorStrategy: 'fail-fast'
  })

  // Handler 1: Success
  cyre.on('error-pipeline', (data: any) => {
    console.log('✅ Handler 1: Processing successfully...')
    return {...data, step1: true}
  })

  // Handler 2: Will throw error
  cyre.on('error-pipeline', (data: any) => {
    console.log('❌ Handler 2: About to throw error...')
    throw new Error('Simulated processing error')
  })

  // Handler 3: Should never execute due to fail-fast
  cyre.on('error-pipeline', (data: any) => {
    console.log('🚫 Handler 3: This should not execute')
    return {...data, step3: true}
  })

  console.log('\n🚀 Testing error handling...')

  const errorResult = await cyre.call('error-pipeline', {test: true})

  console.log('🎯 Error Result:')
  console.log('Success:', errorResult.ok)
  console.log('Error Message:', errorResult.message)
  console.log('Payload:', errorResult.payload)

  // === DEMO 4: Performance Comparison ===
  console.log('\n\n⚡ Demo 4: Performance Comparison')
  console.log('='.repeat(50))

  // Parallel version for comparison
  cyre.action({
    id: 'parallel-test',
    dispatch: 'parallel'
  })

  cyre.on('parallel-test', async (num: number) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return num + 1
  })

  cyre.on('parallel-test', async (num: number) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return num + 2
  })

  cyre.on('parallel-test', async (num: number) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return num + 3
  })

  // Waterfall version
  cyre.action({
    id: 'waterfall-test',
    dispatch: 'waterfall'
  })

  cyre.on('waterfall-test', async (num: number) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return num + 1
  })

  cyre.on('waterfall-test', async (num: number) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return num + 2
  })

  cyre.on('waterfall-test', async (num: number) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return num + 3
  })

  console.log('Testing parallel vs waterfall execution times...')

  const parallelStart = Date.now()
  const parallelResult = await cyre.call('parallel-test', 10)
  const parallelTime = Date.now() - parallelStart

  const waterfallStart = Date.now()
  const waterfallResult = await cyre.call('waterfall-test', 10)
  const waterfallTime = Date.now() - waterfallStart

  console.log('\n📊 Performance Results:')
  console.log(
    `Parallel: ${parallelTime}ms, Result: ${JSON.stringify(
      parallelResult.payload
    )}`
  )
  console.log(
    `Waterfall: ${waterfallTime}ms, Result: ${waterfallResult.payload}`
  )
  console.log(
    `Waterfall should be ~3x slower: ${
      waterfallTime >= parallelTime * 2.5 ? '✅' : '❌'
    }`
  )

  // === DEMO 5: Complex Data Transformation ===
  console.log('\n\n🔄 Demo 5: Complex Data Transformation Chain')
  console.log('='.repeat(50))

  cyre.action({
    id: 'data-transform',
    dispatch: 'waterfall'
  })

  // Parse CSV-like string
  cyre.on('data-transform', (csvString: string) => {
    console.log('📝 Step 1: Parsing CSV data...')
    const lines = csvString.trim().split('\n')
    const headers = lines[0].split(',')
    const data = lines.slice(1).map(line => {
      const values = line.split(',')
      return headers.reduce((obj, header, index) => {
        obj[header.trim()] = values[index]?.trim()
        return obj
      }, {} as any)
    })
    console.log(`   Parsed ${data.length} records`)
    return data
  })

  // Filter valid records
  cyre.on('data-transform', (records: any[]) => {
    console.log('🔍 Step 2: Filtering valid records...')
    const valid = records.filter(
      record => record.name && record.age && !isNaN(parseInt(record.age))
    )
    console.log(`   ${valid.length}/${records.length} records are valid`)
    return valid
  })

  // Convert age to number and add categories
  cyre.on('data-transform', (records: any[]) => {
    console.log('🏷️  Step 3: Adding categories...')
    const categorized = records.map(record => ({
      ...record,
      age: parseInt(record.age),
      category: parseInt(record.age) < 18 ? 'minor' : 'adult'
    }))
    console.log(`   Added categories to ${categorized.length} records`)
    return categorized
  })

  // Generate summary
  cyre.on('data-transform', (records: any[]) => {
    console.log('📊 Step 4: Generating summary...')
    const summary = {
      total: records.length,
      adults: records.filter(r => r.category === 'adult').length,
      minors: records.filter(r => r.category === 'minor').length,
      averageAge: records.reduce((sum, r) => sum + r.age, 0) / records.length,
      records
    }
    console.log(`   Summary generated for ${summary.total} records`)
    return summary
  })

  const csvData = `name,age,city
John Doe,25,New York
Jane Smith,17,Los Angeles  
Bob Wilson,30,Chicago
Alice Brown,16,Houston
Charlie Davis,35,Phoenix`

  console.log('\n🚀 Processing CSV data through transformation chain...')
  console.log('Input CSV:')
  console.log(csvData)
  console.log('\n' + '─'.repeat(40))

  const transformResult = await cyre.call('data-transform', csvData)

  console.log('─'.repeat(40))
  console.log('🎯 Transformation Result:')
  console.log(JSON.stringify(transformResult.payload, null, 2))

  console.log('\n✨ Waterfall Demo Complete!')
  console.log('Key observations:')
  console.log('• Each handler receives the output of the previous handler')
  console.log('• Data flows sequentially through the pipeline')
  console.log('• Errors stop the entire pipeline (fail-fast)')
  console.log('• Perfect for data transformation chains')
  console.log('• Execution time is cumulative (slower than parallel)')
}

// Run the demo
runWaterfallDemo().catch(console.error)
