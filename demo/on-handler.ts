// demo/on-handler.ts
// Complete Smart Execution Operators - Usage Examples and Integration
// This shows how the enhanced system works end-to-end

import {cyre} from '../src/app'
import {getHandlerStats} from '../src/components/cyre-on'

/*

      S.M.A.R.T - E.X.E.C.U.T.I.O.N - O.P.E.R.A.T.O.R.S
      
      Complete system with:
      1. Smart operator selection based on actual handler count
      2. Pre-compiled execution configuration on registration
      3. Ultra-fast single handler path (zero overhead)
      4. Optimized multi-handler execution strategies
      5. Real-time operator switching as handlers are added/removed

*/

// ============================================
// USAGE EXAMPLES
// ============================================

type CyreMetadata = {
  executionOperator?: string
  handlerCount?: number
  // add any other expected properties
  [key: string]: unknown
}

/**
 * Example 1: Single Handler (Ultra-Fast Path)
 * User declares 'parallel' but system automatically uses 'single'
 */
const demoSingleHandler = async () => {
  console.log('=== SINGLE HANDLER DEMO ===')

  // User declares parallel but we have only 1 handler
  cyre.action({
    id: 'user-login',
    dispatch: 'parallel', // User intention
    errorStrategy: 'continue',
    collectResults: 'all',
    throttle: 100
  })

  // Register single handler
  cyre.on('user-login', async user => {
    console.log(`🔐 Authenticating ${user.username}`)
    return {authenticated: true, userId: user.id}
  })

  // Check what the system actually assigned
  const stats = getHandlerStats('user-login')
  console.log('Optimized configuration:', stats)
  // Output: { executionOperator: 'single', handlerCount: 1 }

  // Execute - uses ultra-fast single path (no Promise.all overhead)
  const result = await cyre.call('user-login', {username: 'john', id: '123'})
  const meta = result.metadata as CyreMetadata | undefined
  console.log('Result:', meta?.executionOperator ?? 'unknown')
}

/**
 * Example 2: Multiple Handlers (Parallel Execution)
 * System automatically switches to parallel when 2nd handler added
 */
const demoMultipleHandlers = async () => {
  console.log('=== MULTIPLE HANDLERS DEMO ===')

  // Create action with parallel dispatch
  cyre.action({
    id: 'user-notification',
    dispatch: 'parallel',
    errorStrategy: 'continue',
    collectResults: 'all',
    dispatchTimeout: 5000
  })

  // Add handlers one by one - system optimizes automatically
  cyre.on('user-notification', async data => {
    console.log(`📧 Sending email to ${data.user}`)
    await new Promise(resolve => setTimeout(resolve, 100)) // Simulate API call
    return {email: 'sent', timestamp: Date.now()}
  })

  console.log('After 1st handler:', getHandlerStats('user-notification'))
  // Output: { executionOperator: 'single', handlerCount: 1 }

  cyre.on('user-notification', async data => {
    console.log(`📱 Sending push notification to ${data.user}`)
    await new Promise(resolve => setTimeout(resolve, 150))
    return {push: 'sent', timestamp: Date.now()}
  })

  console.log('After 2nd handler:', getHandlerStats('user-notification'))
  // Output: { executionOperator: 'parallel', handlerCount: 2 }

  cyre.on('user-notification', async data => {
    console.log(`📊 Logging notification event for ${data.user}`)
    return {logged: true, timestamp: Date.now()}
  })

  console.log('After 3rd handler:', getHandlerStats('user-notification'))
  // Output: { executionOperator: 'parallel', handlerCount: 3 }

  // Execute - now uses parallel execution
  const result = await cyre.call('user-notification', {
    user: 'alice',
    message: 'Welcome to our platform!'
  })

  const meta = result.metadata as CyreMetadata | undefined
  console.log('Execution result:', {
    operator: meta?.executionOperator ?? 'unknown', // 'parallel'
    handlerCount: meta?.handlerCount ?? 0, // 3
    results: result.payload // Array of all handler results
  })
}

/**
 * Example 3: Sequential Execution
 * Perfect for data processing pipelines
 */
const demoSequentialExecution = async () => {
  console.log('=== SEQUENTIAL EXECUTION DEMO ===')

  cyre.action({
    id: 'data-pipeline',
    dispatch: 'sequential',
    errorStrategy: 'fail-fast',
    collectResults: 'last',
    dispatchTimeout: 10000
  })

  // Data validation handler
  cyre.on('data-pipeline', async data => {
    console.log('🔍 Validating data...')
    if (!data.email) throw new Error('Email required')
    return {...data, validated: true}
  })

  // Data enrichment handler
  cyre.on('data-pipeline', async data => {
    console.log('🔧 Enriching data...')
    return {
      ...data,
      enriched: true,
      timestamp: Date.now(),
      userAgent: 'Cyre/1.0'
    }
  })

  // Data storage handler
  cyre.on('data-pipeline', async data => {
    console.log('💾 Storing data...')
    return {
      ...data,
      stored: true,
      id: `user_${Date.now()}`
    }
  })

  // Execute pipeline - handlers run in sequence
  const result = await cyre.call('data-pipeline', {
    email: 'user@example.com',
    name: 'John Doe'
  })

  const meta = result.metadata as CyreMetadata | undefined
  console.log('Pipeline result:', {
    operator: meta?.executionOperator ?? 'unknown',
    finalData: result.payload ?? 'No data'
  })
}

/**
 * Example 4: Race Execution
 * Perfect for trying multiple services, fastest wins
 */
const demoRaceExecution = async () => {
  console.log('=== RACE EXECUTION DEMO ===')

  cyre.action({
    id: 'fetch-user-data',
    dispatch: 'race',
    dispatchTimeout: 2000 // Short timeout for race
  })

  // Primary API (slower)
  cyre.on('fetch-user-data', async userId => {
    console.log('🔵 Trying primary API...')
    await new Promise(resolve => setTimeout(resolve, 1500))
    return {source: 'primary', data: {userId, name: 'John'}}
  })

  // Backup API (faster)
  cyre.on('fetch-user-data', async userId => {
    console.log('🟡 Trying backup API...')
    await new Promise(resolve => setTimeout(resolve, 500))
    return {source: 'backup', data: {userId, name: 'John'}}
  })

  // Cache lookup (fastest)
  cyre.on('fetch-user-data', async userId => {
    console.log('🟢 Checking cache...')
    await new Promise(resolve => setTimeout(resolve, 100))
    return {source: 'cache', data: {userId, name: 'John'}}
  })

  // Execute race - fastest handler wins
  const result = await cyre.call('fetch-user-data', '123')

  const meta = result.metadata as CyreMetadata | undefined
  console.log('Race winner:', {
    operator: meta?.executionOperator ?? 'unknown', // 'race'
    winner: result.payload.source, // Probably 'cache'
    data: result.payload.data
  })
}

/**
 * Example 5: Waterfall Execution
 * Perfect for data transformation pipelines
 */
const demoWaterfallExecution = async () => {
  console.log('=== WATERFALL EXECUTION DEMO ===')

  cyre.action({
    id: 'transform-data',
    dispatch: 'waterfall',
    errorStrategy: 'fail-fast',
    dispatchTimeout: 5000
  })

  // Step 1: Parse raw data
  cyre.on('transform-data', async rawData => {
    console.log('📋 Parsing raw data...')
    // Always return { data: ... } for next handler
    return {
      data: JSON.parse(rawData),
      step: 1
    }
  })

  // Step 2: Validate parsed data
  cyre.on('transform-data', async parsedResult => {
    console.log('✅ Validating parsed data...')
    const {data} = parsedResult
    if (!data.name) throw new Error('Name required')
    // Always return { data: ... } for next handler
    return {
      data: {
        ...data,
        validated: true
      },
      step: 2
    }
  })

  // Step 3: Transform and format
  cyre.on('transform-data', async validatedResult => {
    console.log('🔄 Transforming data...')
    const {data} = validatedResult
    return {
      finalData: {
        id: `user_${Date.now()}`,
        name: data.name.toUpperCase(),
        email: data.email.toLowerCase(),
        createdAt: new Date().toISOString(),
        ...data
      },
      step: 3
    }
  })

  // Execute waterfall - each step processes previous result
  const result = await cyre.call(
    'transform-data',
    '{"name":"John Doe","email":"JOHN@EXAMPLE.COM"}'
  )

  if (!result.payload || !result.payload.finalData) {
    console.error(
      'Waterfall execution failed or returned no finalData:',
      result
    )
  } else {
    const meta = result.metadata as CyreMetadata | undefined
    console.log('Waterfall result:', {
      operator: meta?.executionOperator ?? 'unknown',
      finalData: result.payload.finalData
    })
  }
}

/**
 * Example 6: Dynamic Handler Management
 * Shows how system re-optimizes when handlers are added/removed
 */
const demoDynamicOptimization = async () => {
  console.log('=== DYNAMIC OPTIMIZATION DEMO ===')

  // Start with parallel declaration
  cyre.action({
    id: 'dynamic-channel',
    dispatch: 'parallel',
    errorStrategy: 'continue'
  })

  // Handler 1
  const handler1 = async data => {
    console.log('Handler 1 executing')
    return {handler: 1, data}
  }

  // Handler 2
  const handler2 = async data => {
    console.log('Handler 2 executing')
    return {handler: 2, data}
  }

  // Handler 3
  const handler3 = async data => {
    console.log('Handler 3 executing')
    return {handler: 3, data}
  }

  console.log('Initial state:', getHandlerStats('dynamic-channel'))
  // { executionOperator: undefined, handlerCount: 0 }

  // Add first handler - system switches to 'single'
  cyre.on('dynamic-channel', handler1)
  console.log('After adding handler 1:', getHandlerStats('dynamic-channel'))
  // { executionOperator: 'single', handlerCount: 1 }

  // Add second handler - system switches to 'parallel'
  cyre.on('dynamic-channel', handler2)
  console.log('After adding handler 2:', getHandlerStats('dynamic-channel'))
  // { executionOperator: 'parallel', handlerCount: 2 }

  // Add third handler - stays 'parallel'
  cyre.on('dynamic-channel', handler3)
  console.log('After adding handler 3:', getHandlerStats('dynamic-channel'))
  // { executionOperator: 'parallel', handlerCount: 3 }

  // Test execution with multiple handlers
  let result = await cyre.call('dynamic-channel', {test: 'parallel'})
  const meta = result.metadata as CyreMetadata | undefined
  console.log('Parallel execution:', meta?.executionOperator ?? 'unknown')

  // Remove handlers - system re-optimizes
  // Note: This would require implementing removeHandler in the actual system
  // cyre.forget('dynamic-channel', handler2)
  // cyre.forget('dynamic-channel', handler3)
  // console.log('After removing handlers:', getHandlerStats('dynamic-channel'))
  // { executionOperator: 'single', handlerCount: 1 }
}

/**
 * Example 7: Performance Comparison
 * Shows the performance benefits of smart optimization
 */
const demoPerformanceComparison = async () => {
  console.log('=== PERFORMANCE COMPARISON DEMO ===')

  // Setup: Create actions with same declaration but different handler counts
  cyre.action({id: 'single-optimized', dispatch: 'parallel'})
  cyre.action({id: 'multi-parallel', dispatch: 'parallel'})

  // Single handler (optimized to 'single')
  cyre.on('single-optimized', async data => {
    return {processed: true, ...data}
  })

  // Multiple handlers (stays 'parallel')
  cyre.on('multi-parallel', async data => ({handler: 1, ...data}))
  cyre.on('multi-parallel', async data => ({handler: 2, ...data}))
  cyre.on('multi-parallel', async data => ({handler: 3, ...data}))

  // Performance test
  const iterations = 1000
  const testData = {test: 'performance'}

  // Test single handler (optimized)
  const singleStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    await cyre.call('single-optimized', testData)
  }
  const singleTime = performance.now() - singleStart

  // Test multiple handlers
  const multiStart = performance.now()
  for (let i = 0; i < iterations / 10; i++) {
    // Less iterations due to slower execution
    await cyre.call('multi-parallel', testData)
  }
  const multiTime = (performance.now() - multiStart) * 10 // Normalize

  console.log('Performance comparison:')
  console.log(
    `Single handler (optimized): ${singleTime.toFixed(
      2
    )}ms for ${iterations} calls`
  )
  console.log(
    `Multi-handler (parallel, 3 handlers): ${multiTime.toFixed(
      2
    )}ms for ${iterations} calls (normalized)`
  )
  console.log('---')
  console.log(
    '1-to-1 (single handler) is much faster due to zero overhead path.'
  )
  console.log(
    '1-to-many (parallel handlers) incurs Promise.all and coordination overhead.'
  )
  console.log(
    'This demonstrates the benefit of smart operator selection in Cyre.'
  )
}

demoSingleHandler()
demoWaterfallExecution()
demoDynamicOptimization()
demoMultipleHandlers()
demoRaceExecution()
demoSequentialExecution()
