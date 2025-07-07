// simple-node-showcase.ts
// Working Node.js demonstration of Cyre's core capabilities

import {cyre} from '../src'

// ============================================================================
// PART 1: Basic Event System with Protection
// ============================================================================

async function demonstrateCore() {
  console.log('\n=== CORE CYRE DEMONSTRATION ===')

  // Initialize Cyre
  await cyre.init()

  // 1. Basic action with throttling
  cyre.action({
    id: 'user-notification',
    throttle: 1000, // Max 1 per second
    payload: {message: '', user: ''}
  })

  // 2. Action with debouncing (good for search)
  cyre.action({
    id: 'search-query',
    debounce: 300, // Wait 300ms after last input
    detectChanges: true // Skip identical searches
  })

  // 3. Action with intervals (background tasks)
  cyre.action({
    id: 'health-check',
    interval: 2000, // Every 2 seconds
    repeat: 3 // Only 3 times
  })

  // Set up handlers
  cyre.on('user-notification', payload => {
    console.log(`📧 Notification: ${payload.message} for ${payload.user}`)
    return {sent: true, timestamp: Date.now()}
  })

  cyre.on('search-query', payload => {
    console.log(`🔍 Searching for: "${payload.query}"`)
    // Simulate search results
    return {
      results: [
        `Result 1 for ${payload.query}`,
        `Result 2 for ${payload.query}`
      ],
      count: 2
    }
  })

  cyre.on('health-check', () => {
    const status = Math.random() > 0.5 ? 'healthy' : 'warning'
    console.log(`❤️  System health: ${status}`)
    return {status, timestamp: Date.now()}
  })

  // Test throttling
  console.log('\n--- Testing Throttling ---')
  await cyre.call('user-notification', {message: 'Welcome!', user: 'Alice'})
  await cyre.call('user-notification', {message: 'Update!', user: 'Alice'}) // Should be throttled

  // Test debouncing
  console.log('\n--- Testing Debouncing ---')
  cyre.call('search-query', {query: 'java'}) // Will be debounced
  cyre.call('search-query', {query: 'javascript'}) // Will be debounced
  cyre.call('search-query', {query: 'typescript'}) // This one will execute

  // Test intervals
  console.log('\n--- Testing Intervals ---')
  await cyre.call('health-check') // Start the interval

  // Wait to see some results
  await new Promise(resolve => setTimeout(resolve, 7000))
}

// ============================================================================
// PART 2: Chain Reactions (IntraLinks)
// ============================================================================

async function demonstrateChaining() {
  console.log('\n=== CHAINING DEMONSTRATION ===')

  // Set up a chain: order -> payment -> shipping -> notification
  cyre.action({id: 'process-order', payload: {}})
  cyre.action({id: 'process-payment', payload: {}})
  cyre.action({id: 'arrange-shipping', payload: {}})
  cyre.action({id: 'send-confirmation', payload: {}})

  // Chain handlers
  cyre.on('process-order', order => {
    console.log(`📦 Processing order #${order.id} for $${order.total}`)

    // Chain to payment processing
    return {
      id: 'process-payment',
      payload: {
        orderId: order.id,
        amount: order.total,
        paymentMethod: order.paymentMethod
      }
    }
  })

  cyre.on('process-payment', payment => {
    console.log(
      `💳 Processing payment of $${payment.amount} for order #${payment.orderId}`
    )

    // Simulate payment processing
    const success = Math.random() > 0.2 // 80% success rate

    if (success) {
      return {
        id: 'arrange-shipping',
        payload: {
          orderId: payment.orderId,
          address: '123 Main St',
          method: 'standard'
        }
      }
    } else {
      return {
        id: 'send-confirmation',
        payload: {
          orderId: payment.orderId,
          status: 'payment-failed',
          message: 'Payment processing failed'
        }
      }
    }
  })

  cyre.on('arrange-shipping', shipping => {
    console.log(
      `🚚 Arranging shipping for order #${shipping.orderId} to ${shipping.address}`
    )

    return {
      id: 'send-confirmation',
      payload: {
        orderId: shipping.orderId,
        status: 'shipped',
        trackingNumber: `TRK${Math.random()
          .toString(36)
          .substr(2, 9)
          .toUpperCase()}`,
        estimatedDelivery: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toDateString()
      }
    }
  })

  cyre.on('send-confirmation', confirmation => {
    if (confirmation.status === 'shipped') {
      console.log(
        `✅ Order #${confirmation.orderId} shipped! Tracking: ${confirmation.trackingNumber}`
      )
      console.log(`   Estimated delivery: ${confirmation.estimatedDelivery}`)
    } else {
      console.log(
        `❌ Order #${confirmation.orderId} failed: ${confirmation.message}`
      )
    }

    return {confirmed: true, timestamp: Date.now()}
  })

  // Test the chain
  await cyre.call('process-order', {
    id: '12345',
    total: 99.99,
    paymentMethod: 'credit-card'
  })

  await new Promise(resolve => setTimeout(resolve, 1000))
}

// ============================================================================
// PART 3: Protection Mechanisms in Action
// ============================================================================

async function demonstrateProtections() {
  console.log('\n=== PROTECTION MECHANISMS ===')

  // Action with change detection
  cyre.action({
    id: 'update-config',
    detectChanges: true,
    payload: {theme: 'light', language: 'en'}
  })

  cyre.on('update-config', config => {
    console.log(`⚙️  Config updated:`, config)
    return {updated: true}
  })

  // Test change detection
  console.log('\n--- Testing Change Detection ---')
  await cyre.call('update-config', {theme: 'dark', language: 'en'}) // Will execute
  await cyre.call('update-config', {theme: 'dark', language: 'en'}) // Will be skipped (no change)
  await cyre.call('update-config', {theme: 'light', language: 'fr'}) // Will execute (changed)

  // Action with priority during system stress
  cyre.action({
    id: 'critical-backup',
    priority: {level: 'critical'}
  })

  cyre.action({
    id: 'routine-cleanup',
    priority: {level: 'low'}
  })

  cyre.on('critical-backup', () => {
    console.log('💾 Critical backup running (always executes)')
    return {backup: 'completed'}
  })

  cyre.on('routine-cleanup', () => {
    console.log('🧹 Routine cleanup (may be skipped under stress)')
    return {cleaned: true}
  })

  // Both will execute normally
  await cyre.call('critical-backup')
  await cyre.call('routine-cleanup')
}

// ============================================================================
// PART 4: System Monitoring
// ============================================================================

async function demonstrateMonitoring() {
  console.log('\n=== SYSTEM MONITORING ===')

  // Get system health
  const breathing = cyre.getBreathingState()
  console.log(
    `🫁 System breathing - Stress: ${(breathing.stress * 100).toFixed(1)}%`
  )
  console.log(
    `   Pattern: ${breathing.pattern}, Rate: ${breathing.currentRate}ms`
  )

  // Get performance metrics
  const performance = cyre.getPerformanceState()
  console.log(`📊 Performance - Call rate: ${performance.callRate}/sec`)
  console.log(
    `   Total calls: ${performance.totalCalls}, Total executions: ${performance.totalExecutions}`
  )

  // Get detailed metrics report
  const report = cyre.getMetricsReport()
  console.log(`📈 Metrics - Events collected: ${report.events}`)
  console.log(`   Uptime: ${report.global.uptime}s`)

  // Performance insights
  const insights = cyre.getPerformanceInsights()
  if (insights.length > 0) {
    console.log('💡 Performance insights:')
    insights.forEach(insight => console.log(`   - ${insight}`))
  } else {
    console.log('✅ System performing optimally')
  }
}

// ============================================================================
// PART 5: Real-world Example - Simple Task Queue
// ============================================================================

async function demonstrateTaskQueue() {
  console.log('\n=== TASK QUEUE EXAMPLE ===')

  // Task processor with throttling to prevent overload
  cyre.action({
    id: 'process-task',
    throttle: 500, // Max 2 tasks per second
    payload: {task: null, priority: 'normal'}
  })

  // Background task cleanup
  cyre.action({
    id: 'cleanup-completed',
    interval: 5000, // Every 5 seconds
    repeat: 2 // Only run twice for demo
  })

  const completedTasks = []

  cyre.on('process-task', async taskData => {
    const {task, priority} = taskData
    console.log(`⚡ Processing ${priority} priority task: ${task.name}`)

    // Simulate processing time based on priority
    const processingTime =
      priority === 'high' ? 100 : priority === 'normal' ? 300 : 500
    await new Promise(resolve => setTimeout(resolve, processingTime))

    const result = {
      taskId: task.id,
      taskName: task.name,
      completedAt: Date.now(),
      processingTime
    }

    completedTasks.push(result)
    console.log(`✅ Completed task: ${task.name} (${processingTime}ms)`)

    return result
  })

  cyre.on('cleanup-completed', () => {
    console.log(`🧹 Cleanup: ${completedTasks.length} completed tasks`)
    const oldCount = completedTasks.length
    completedTasks.splice(0, Math.floor(completedTasks.length / 2)) // Remove half
    console.log(`   Removed ${oldCount - completedTasks.length} old tasks`)
    return {cleaned: oldCount - completedTasks.length}
  })

  // Submit various tasks
  const tasks = [
    {id: 1, name: 'Send email', priority: 'high'},
    {id: 2, name: 'Generate report', priority: 'normal'},
    {id: 3, name: 'Backup data', priority: 'low'},
    {id: 4, name: 'Update cache', priority: 'high'},
    {id: 5, name: 'Archive logs', priority: 'low'}
  ]

  console.log('📋 Submitting tasks...')
  for (const task of tasks) {
    cyre.call('process-task', {task, priority: task.priority})
  }

  // Start cleanup process
  await cyre.call('cleanup-completed')

  // Wait for processing to complete
  await new Promise(resolve => setTimeout(resolve, 8000))
}

// ============================================================================
// PART 6: Error Handling and Recovery
// ============================================================================

async function demonstrateErrorHandling() {
  console.log('\n=== ERROR HANDLING ===')

  cyre.action({
    id: 'risky-operation',
    payload: {shouldFail: false}
  })

  cyre.action({
    id: 'error-recovery',
    payload: {error: null}
  })

  cyre.on('risky-operation', payload => {
    console.log('🎲 Attempting risky operation...')

    if (payload.shouldFail) {
      console.log('❌ Operation failed!')
      // Chain to error recovery
      return {
        id: 'error-recovery',
        payload: {
          error: 'Operation failed as requested',
          originalPayload: payload,
          timestamp: Date.now()
        }
      }
    }

    console.log('✅ Operation succeeded!')
    return {success: true, result: 'All good!'}
  })

  cyre.on('error-recovery', errorData => {
    console.log('🔧 Recovering from error:', errorData.error)
    console.log('   Implementing fallback strategy...')
    return {recovered: true, fallbackUsed: true}
  })

  // Test success case
  await cyre.call('risky-operation', {shouldFail: false})

  // Test failure and recovery
  await cyre.call('risky-operation', {shouldFail: true})
}

// ============================================================================
// Main Demo Runner
// ============================================================================

async function runShowcase() {
  console.log('🚀 CYRE SHOWCASE - Node.js Edition')
  console.log('=====================================')

  try {
    await demonstrateCore()
    await demonstrateChaining()
    await demonstrateProtections()
    await demonstrateMonitoring()
    await demonstrateTaskQueue()
    await demonstrateErrorHandling()

    console.log('\n🎉 SHOWCASE COMPLETED SUCCESSFULLY!')
    console.log('=====================================')

    // Final system status
    const finalReport = cyre.getMetricsReport()
    console.log(`\n📊 Final Stats:`)
    console.log(`   Total calls: ${finalReport.global.totalCalls}`)
    console.log(`   Total executions: ${finalReport.global.totalExecutions}`)
    console.log(`   Total errors: ${finalReport.global.totalErrors}`)
    console.log(`   Uptime: ${finalReport.global.uptime}s`)
  } catch (error) {
    console.error('❌ Showcase failed:', error)
  }
}

runShowcase().catch(console.error)

export {runShowcase}
