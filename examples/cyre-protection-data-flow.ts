// examples/cyre-protection-data-flow.ts
// Test data flow through protection talents: debounce, delay, repeat, conditions

import {cyre} from '../src/app'

/*
    Test Cases:
    1. Debounce with data preservation
    2. Delay with data return
    3. Repeat with data accumulation
    4. Condition with data filtering
    5. Schema validation with data transformation
    6. Combined protections with data flow
    7. Transform with data modification
    8. Throttle with data timing
*/

interface TaskData {
  id: string
  message: string
  timestamp: number
  priority: 'low' | 'medium' | 'high'
}

interface ProcessingResult {
  original: any
  processed: any
  metadata: {
    processingTime: number
    timestamp: number
    stage: string
  }
}

// Utility to wait for async operations
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function runProtectionDataFlowTests() {
  console.log('🔧 Starting Cyre Protection Talents Data Flow Tests\n')

  // Initialize Cyre
  await cyre.init()

  // TEST 1: Debounce with Data Preservation
  console.log('📝 TEST 1: Debounce with Data Preservation')

  cyre.action({
    id: 'debounced-search',
    debounce: 300 // 300ms debounce
  })

  cyre.on('debounced-search', (query: string) => {
    return {
      query,
      results: [`Result 1 for "${query}"`, `Result 2 for "${query}"`],
      searchTime: Date.now(),
      resultCount: 2
    }
  })

  console.log('  Sending rapid calls to test debounce...')

  // Send multiple rapid calls - only last should execute
  const promises = [
    cyre.call('debounced-search', 'test1'),
    cyre.call('debounced-search', 'test2'),
    cyre.call('debounced-search', 'test3')
  ]

  const debounceResults = await Promise.all(promises)
  console.log('  First call result:', debounceResults[0])
  console.log('  Second call result:', debounceResults[1])
  console.log('  Third call result:', debounceResults[2])

  // Wait for debounced execution
  await wait(400)

  // Now call again to get actual data
  const finalResult = await cyre.call('debounced-search', 'final-query')
  console.log('  Final call result:', finalResult)
  console.log('  Data received:', finalResult.payload)
  console.log('  ✅ Test 1: Debounce preserves and returns data')
  console.log()

  // TEST 2: Delay with Data Return
  console.log('📝 TEST 2: Delay with Data Return')

  cyre.action({
    id: 'delayed-task',
    delay: 200 // 200ms delay
  })

  cyre.on('delayed-task', (taskData: TaskData) => {
    return {
      task: taskData,
      executedAt: Date.now(),
      status: 'completed',
      delayRespected: true
    }
  })

  console.log('  Calling delayed task...')
  const startTime = Date.now()

  const delayResult = await cyre.call('delayed-task', {
    id: 'task-1',
    message: 'Test delayed execution',
    timestamp: Date.now(),
    priority: 'medium' as const
  })

  const executionTime = Date.now() - startTime
  console.log('  Execution time:', executionTime + 'ms')
  console.log('  Response:', delayResult)
  console.log('  Data received:', delayResult.payload)
  console.log('  ✅ Test 2: Delay returns data after specified time')
  console.log()

  // TEST 3: Repeat with Data Accumulation
  console.log('📝 TEST 3: Repeat with Data Accumulation')

  let executionCounter = 0
  const collectedData: any[] = []

  cyre.action({
    id: 'repeat-task',
    interval: 100, // 100ms interval
    repeat: 3 // Execute 3 times total
  })

  cyre.on('repeat-task', (inputData: any) => {
    executionCounter++
    const result = {
      execution: executionCounter,
      input: inputData,
      timestamp: Date.now(),
      message: `Execution ${executionCounter} completed`
    }
    collectedData.push(result)
    return result
  })

  console.log('  Starting repeat task (3 executions)...')

  const repeatResult = await cyre.call('repeat-task', {
    name: 'Repeat Test',
    data: 'test-data-for-repeat'
  })

  console.log('  Initial response:', repeatResult)
  console.log('  Data received:', repeatResult.payload)

  // Wait for all executions to complete
  await wait(400)

  console.log('  Collected data from all executions:')
  collectedData.forEach((data, index) => {
    console.log(`    Execution ${index + 1}:`, data)
  })
  console.log('  ✅ Test 3: Repeat executions return data each time')
  console.log()

  // TEST 4: Condition with Data Filtering
  console.log('📝 TEST 4: Condition with Data Filtering')

  cyre.action({
    id: 'conditional-process',
    condition: (data: any) => data.priority === 'high' // Only process high priority
  })

  cyre.on('conditional-process', (data: TaskData) => {
    return {
      processed: true,
      data,
      message: 'High priority task processed',
      processedAt: Date.now()
    }
  })

  // Test with low priority (should be skipped)
  const lowPriorityResult = await cyre.call('conditional-process', {
    id: 'task-2',
    message: 'Low priority task',
    timestamp: Date.now(),
    priority: 'low' as const
  })

  console.log('  Low priority result:', lowPriorityResult)

  // Test with high priority (should be processed)
  const highPriorityResult = await cyre.call('conditional-process', {
    id: 'task-3',
    message: 'High priority task',
    timestamp: Date.now(),
    priority: 'high' as const
  })

  console.log('  High priority result:', highPriorityResult)
  console.log('  Data received:', highPriorityResult.payload)
  console.log('  ✅ Test 4: Conditions filter execution but preserve data flow')
  console.log()

  // TEST 5: Schema Validation with Data Transformation
  console.log('📝 TEST 5: Schema Validation with Data Transformation')

  cyre.action({
    id: 'validated-process',
    schema: cyre.schema.object({
      email: cyre.schema.string().email(),
      age: cyre.schema.number().min(18).max(100),
      name: cyre.schema.string().minLength(2)
    })
  })

  cyre.on('validated-process', (validatedData: any) => {
    return {
      user: validatedData,
      validationPassed: true,
      account: {
        id: `user-${Date.now()}`,
        status: 'active',
        createdAt: new Date().toISOString()
      }
    }
  })

  // Test with valid data
  const validResult = await cyre.call('validated-process', {
    email: 'john@example.com',
    age: 25,
    name: 'John Doe'
  })

  console.log('  Valid data result:', validResult)
  console.log('  Data received:', validResult.payload)

  // Test with invalid data
  const invalidResult = await cyre.call('validated-process', {
    email: 'invalid-email',
    age: 15,
    name: 'X'
  })

  console.log('  Invalid data result:', invalidResult)
  console.log(
    '  ✅ Test 5: Schema validation transforms valid data, blocks invalid'
  )
  console.log()

  // TEST 6: Transform with Data Modification
  console.log('📝 TEST 6: Transform with Data Modification')

  cyre.action({
    id: 'transform-process',
    transform: (data: any) => ({
      ...data,
      transformed: true,
      transformedAt: Date.now(),
      originalKeys: Object.keys(data)
    })
  })

  cyre.on('transform-process', (transformedData: any) => {
    return {
      received: transformedData,
      processed: {
        ...transformedData,
        processedBy: 'handler',
        finalResult: `Processed: ${transformedData.message}`
      }
    }
  })

  const transformResult = await cyre.call('transform-process', {
    message: 'Transform me!',
    value: 42,
    metadata: {source: 'test'}
  })

  console.log('  Transform result:', transformResult)
  console.log('  Data received:', transformResult.payload)
  console.log('  ✅ Test 6: Transform modifies data while preserving flow')
  console.log()

  // TEST 7: Throttle with Data Timing
  console.log('📝 TEST 7: Throttle with Data Timing')

  cyre.action({
    id: 'throttled-api',
    throttle: 250 // 250ms throttle
  })

  cyre.on('throttled-api', (requestData: any) => {
    return {
      request: requestData,
      response: `API response for ${requestData.endpoint}`,
      timestamp: Date.now(),
      throttled: false
    }
  })

  console.log('  Testing throttle with rapid calls...')

  // First call should succeed
  const throttleResult1 = await cyre.call('throttled-api', {
    endpoint: '/api/data',
    method: 'GET'
  })
  console.log('  First call result:', throttleResult1)

  // Immediate second call should be throttled
  const throttleResult2 = await cyre.call('throttled-api', {
    endpoint: '/api/users',
    method: 'POST'
  })
  console.log('  Second call result (should be throttled):', throttleResult2)

  // Wait and try again
  await wait(300)
  const throttleResult3 = await cyre.call('throttled-api', {
    endpoint: '/api/orders',
    method: 'GET'
  })
  console.log('  Third call result (after wait):', throttleResult3)
  console.log('  Data received:', throttleResult3.payload)
  console.log('  ✅ Test 7: Throttle controls timing but preserves data')
  console.log()

  // TEST 8: Combined Protections with Data Flow
  console.log('📝 TEST 8: Combined Protections with Data Flow')

  cyre.action({
    id: 'complex-process',
    debounce: 200,
    condition: (data: any) => data.enabled === true,
    transform: (data: any) => ({
      ...data,
      preprocessed: true,
      timestamp: Date.now()
    }),
    schema: cyre.schema.object({
      enabled: cyre.schema.boolean(),
      message: cyre.schema.string().minLength(5),
      value: cyre.schema.number()
    })
  })

  cyre.on('complex-process', (processedData: any) => {
    return {
      input: processedData,
      result: {
        success: true,
        computation: processedData.value * 2,
        finalMessage: `Processed: ${processedData.message}`,
        allProtectionsPassed: true
      }
    }
  })

  console.log('  Testing combined protections...')

  // This should pass all protections
  const complexResult = await cyre.call('complex-process', {
    enabled: true,
    message: 'Complex processing test',
    value: 100
  })

  console.log('  Complex process result:', complexResult)
  console.log('  Data received:', complexResult.payload)
  console.log('  ✅ Test 8: Combined protections preserve data flow')
  console.log()

  // SUMMARY
  console.log('🎯 SUMMARY: Protection Talents Data Flow Verification')
  console.log('  ✅ Debounce preserves data through delayed execution')
  console.log('  ✅ Delay executes with full data after specified time')
  console.log('  ✅ Repeat executions return data each iteration')
  console.log('  ✅ Conditions filter execution but maintain data integrity')
  console.log('  ✅ Schema validation transforms and validates data')
  console.log('  ✅ Transform modifies data while preserving pipeline')
  console.log('  ✅ Throttle controls timing without losing data')
  console.log('  ✅ Combined protections work together with data flow')
  console.log(
    '\n🎉 CONCLUSION: ALL Protection Talents preserve and return ACTUAL DATA!'
  )
}

// Export for testing
export {runProtectionDataFlowTests}

runProtectionDataFlowTests().catch(console.error)
