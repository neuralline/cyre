// comprehensive-showcase.ts
// Complete demonstration of all Cyre features working together

import {cyre, useCyre, cyreCompose, createStream} from '../src'
import {
  machine,
  createAndStartStateMachine,
  patterns
} from '../src/state-machine'

// ============================================================================
// PART 1: Core Cyre + Hooks Integration
// ============================================================================

async function demonstrateHooksIntegration() {
  console.log('\n=== HOOKS INTEGRATION DEMONSTRATION ===')

  // Create specialized channels using useCyre
  const notificationChannel = useCyre({
    name: 'notification-system',
    protection: {
      throttle: 1000, // Max 1 notification per second
      detectChanges: true // Skip identical notifications
    },
    priority: {level: 'high'},
    debug: false
  })

  const auditChannel = useCyre({
    name: 'audit-logging',
    protection: {
      debounce: 500 // Batch audit logs
    },
    priority: {level: 'medium'}
  })

  const analyticsChannel = useCyre({
    name: 'analytics-tracking',
    protection: {
      throttle: 2000, // Rate limit analytics
      detectChanges: true
    },
    priority: {level: 'low'}
  })

  // Add middleware to notification channel
  notificationChannel.middleware(async (payload, next) => {
    // Validate notification payload
    if (!payload.message || !payload.type) {
      return {
        ok: false,
        message: 'Invalid notification format',
        payload: null
      }
    }

    // Add timestamp and format
    const enhancedPayload = {
      ...payload,
      timestamp: Date.now(),
      formatted: `[${payload.type.toUpperCase()}] ${payload.message}`
    }

    return next(enhancedPayload)
  })

  // Add audit trail middleware
  notificationChannel.middleware(async (payload, next) => {
    // Log to audit channel
    auditChannel.call({
      action: 'notification_sent',
      payload: payload,
      timestamp: Date.now()
    })

    return next(payload)
  })

  // Set up handlers
  notificationChannel.on(notification => {
    console.log(`📧 ${notification.formatted}`)

    // Track analytics
    analyticsChannel.call({
      event: 'notification_delivered',
      type: notification.type,
      userId: notification.userId
    })

    return {delivered: true, notificationId: `ntf-${Date.now()}`}
  })

  auditChannel.on(auditLog => {
    console.log(
      `📝 Audit: ${auditLog.action} at ${new Date(
        auditLog.timestamp
      ).toISOString()}`
    )
    return {logged: true, auditId: `aud-${Date.now()}`}
  })

  analyticsChannel.on(analytics => {
    console.log(
      `📊 Analytics: ${analytics.event} for user ${
        analytics.userId || 'anonymous'
      }`
    )
    return {tracked: true, eventId: `evt-${Date.now()}`}
  })

  // Test the integrated system
  console.log('\n--- Testing Hook Integration ---')

  await notificationChannel.call({
    message: 'Welcome to our platform!',
    type: 'welcome',
    userId: 'user123'
  })

  await notificationChannel.call({
    message: 'Your order has been shipped',
    type: 'order',
    userId: 'user456'
  })

  // Test duplicate detection
  await notificationChannel.call({
    message: 'Your order has been shipped',
    type: 'order',
    userId: 'user456'
  }) // Should be skipped due to detectChanges

  // Test validation middleware
  await notificationChannel.call({
    invalidField: 'should fail validation'
  })

  await new Promise(resolve => setTimeout(resolve, 1000))
}

// ============================================================================
// PART 2: Channel Composition - Coordinated Workflows
// ============================================================================

async function demonstrateComposition() {
  console.log('\n=== CHANNEL COMPOSITION DEMONSTRATION ===')

  // Create individual validation channels
  const inventoryCheck = useCyre({
    name: 'inventory-validation',
    protection: {throttle: 500}
  })

  const paymentCheck = useCyre({
    name: 'payment-validation',
    protection: {throttle: 1000}
  })

  const userCheck = useCyre({
    name: 'user-validation',
    protection: {throttle: 300}
  })

  // Set up validation logic
  inventoryCheck.on(async orderData => {
    console.log(`📦 Checking inventory for ${orderData.items.length} items...`)
    await new Promise(resolve => setTimeout(resolve, 200)) // Simulate API call

    const allAvailable = orderData.items.every(
      item => Math.random() > 0.1 // 90% availability rate
    )

    if (!allAvailable) {
      throw new Error('Some items are out of stock')
    }

    return {
      inventoryValid: true,
      reservedItems: orderData.items.map(item => item.id),
      checkedAt: Date.now()
    }
  })

  paymentCheck.on(async orderData => {
    console.log(`💳 Validating payment method: ${orderData.paymentMethod}...`)
    await new Promise(resolve => setTimeout(resolve, 300)) // Simulate payment validation

    const validMethods = ['credit-card', 'paypal', 'bank-transfer']
    if (!validMethods.includes(orderData.paymentMethod)) {
      throw new Error('Invalid payment method')
    }

    // Simulate payment authorization
    const authorized = Math.random() > 0.05 // 95% success rate
    if (!authorized) {
      throw new Error('Payment authorization failed')
    }

    return {
      paymentValid: true,
      authorizationCode: `AUTH-${Math.random()
        .toString(36)
        .substr(2, 8)
        .toUpperCase()}`,
      authorizedAt: Date.now()
    }
  })

  userCheck.on(async orderData => {
    console.log(`👤 Validating user: ${orderData.userId}...`)
    await new Promise(resolve => setTimeout(resolve, 150)) // Simulate user lookup

    // Simulate user validation
    const userExists = orderData.userId && orderData.userId.length > 3
    if (!userExists) {
      throw new Error('Invalid user ID')
    }

    return {
      userValid: true,
      userTier: 'premium',
      validatedAt: Date.now()
    }
  })

  // Compose all validation channels
  const orderValidation = cyreCompose(
    [inventoryCheck, paymentCheck, userCheck],
    {
      continueOnError: false, // Stop on first failure
      collectDetailedMetrics: true,
      timeout: 5000, // 5 second timeout
      debug: false
    }
  )

  // Test successful validation
  console.log('\n--- Testing Successful Validation ---')

  const validOrder = {
    orderId: 'ORD-12345',
    userId: 'user789',
    items: [
      {id: 'item1', name: 'Widget A', quantity: 2},
      {id: 'item2', name: 'Widget B', quantity: 1}
    ],
    paymentMethod: 'credit-card',
    total: 149.99
  }

  try {
    const validationResult = await orderValidation.call(validOrder)

    if (validationResult.ok) {
      console.log('✅ All validations passed!')
      const responses = validationResult.payload
      responses.forEach((response, index) => {
        if (response.ok) {
          console.log(
            `   Channel ${index + 1}: ${JSON.stringify(response.payload)}`
          )
        }
      })
    }
  } catch (error) {
    console.error('❌ Validation failed:', error.message)
  }

  // Test validation failure
  console.log('\n--- Testing Validation Failure ---')

  const invalidOrder = {
    orderId: 'ORD-67890',
    userId: 'usr', // Too short, will fail
    items: [{id: 'item3', name: 'Widget C', quantity: 1}],
    paymentMethod: 'cryptocurrency', // Invalid method
    total: 99.99
  }

  try {
    const failureResult = await orderValidation.call(invalidOrder)
    console.log('Failure result:', failureResult.message)
  } catch (error) {
    console.error('❌ Expected validation failure:', error.message)
  }

  await new Promise(resolve => setTimeout(resolve, 500))
}

// ============================================================================
// PART 3: Streams Integration
// ============================================================================

async function demonstrateStreams() {
  console.log('\n=== STREAMS DEMONSTRATION ===')

  // Create a data processing stream
  const eventStream = createStream({
    id: 'user-events',
    debug: false
  })

  // Create processing pipeline
  const processedEvents = eventStream
    .filter(event => event.type !== 'debug')
    .distinctUntilChanged()
    .map(event => ({
      ...event,
      processed: true,
      timestamp: Date.now()
    }))
    .tap(event => console.log(`🔄 Processing: ${event.type} event`))

  // Subscribe to processed events
  processedEvents.subscribe({
    next: event => {
      // Use core Cyre to handle the processed event
      cyre.call('handle-processed-event', event)
    },
    error: error => console.error('Stream error:', error)
  })

  // Set up Cyre handler for processed events
  cyre.action({
    id: 'handle-processed-event',
    debounce: 200,
    detectChanges: true
  })

  cyre.on('handle-processed-event', event => {
    console.log(`📨 Handled ${event.type} event: ${event.data}`)
    return {handled: true, eventId: event.id}
  })

  // Test the stream
  console.log('\n--- Testing Stream Processing ---')

  await eventStream.next({
    id: 'evt1',
    type: 'user_login',
    data: 'User logged in',
    userId: 'user123'
  })

  await eventStream.next({
    id: 'evt2',
    type: 'page_view',
    data: 'Viewed homepage',
    userId: 'user123'
  })

  await eventStream.next({
    id: 'evt3',
    type: 'debug', // Will be filtered out
    data: 'Debug info'
  })

  await eventStream.next({
    id: 'evt4',
    type: 'purchase',
    data: 'Made a purchase',
    userId: 'user456'
  })

  await new Promise(resolve => setTimeout(resolve, 500))
}

// ============================================================================
// PART 4: State Machine Integration
// ============================================================================

async function demonstrateStateMachine() {
  console.log('\n=== STATE MACHINE DEMONSTRATION ===')

  // Create a simple order processing state machine
  const orderMachineConfig = machine('order-flow')
    .initial('pending')
    .context({
      orderId: '',
      status: 'pending',
      attempts: 0
    })
    .guards({
      canRetry: context => context.attempts < 3
    })
    .actions({
      logTransition: (context, event) => {
        console.log(`🔄 Order ${context.orderId}: ${event.type}`)
      },
      incrementAttempts: context => {
        context.attempts += 1
      }
    })
    .state('pending')
    .entry('logTransition')
    .on('PROCESS', 'processing')
    .on('CANCEL', 'cancelled')
    .state('processing')
    .entry('logTransition')
    .on('SUCCESS', 'completed')
    .when('RETRY', 'canRetry', 'processing')
    .on('RETRY', 'failed')
    .on('FAIL', 'failed')
    .state('completed')
    .entry('logTransition')
    .final()
    .state('cancelled')
    .entry('logTransition')
    .final()
    .state('failed')
    .entry('logTransition')
    .final()
    .build()

  const orderMachine = createAndStartStateMachine(orderMachineConfig)

  // Connect state machine to Cyre system
  orderMachine.onStateChange(change => {
    // Notify via notification system when order state changes
    cyre.call('order-status-update', {
      orderId: change.context.orderId,
      from: change.from.current,
      to: change.to.current,
      timestamp: change.timestamp
    })
  })

  // Set up Cyre handler for state changes
  cyre.action({
    id: 'order-status-update',
    throttle: 100 // Prevent spam
  })

  cyre.on('order-status-update', statusUpdate => {
    console.log(
      `📋 Order ${statusUpdate.orderId}: ${statusUpdate.from} → ${statusUpdate.to}`
    )
    return {updated: true}
  })

  // Test the state machine
  console.log('\n--- Testing State Machine ---')

  // Set order context
  orderMachine.send('__INIT', {orderId: 'ORD-SM-001'})

  // Process order
  orderMachine.send('PROCESS')

  // Simulate processing success
  setTimeout(() => {
    orderMachine.send('SUCCESS')
  }, 1000)

  await new Promise(resolve => setTimeout(resolve, 1500))
}

// ============================================================================
// PART 5: Advanced Integration - All Features Together
// ============================================================================

async function demonstrateAdvancedIntegration() {
  console.log('\n=== ADVANCED INTEGRATION DEMONSTRATION ===')

  // Create a comprehensive order processing system

  // 1. Individual processing channels
  const orderPrep = useCyre({
    name: 'order-preparation',
    protection: {debounce: 100}
  })

  const inventoryReserve = useCyre({
    name: 'inventory-reserve',
    protection: {throttle: 500}
  })

  const paymentProcess = useCyre({
    name: 'payment-process',
    protection: {throttle: 1000}
  })

  // 2. Event stream for real-time updates
  const orderUpdates = createStream({id: 'order-updates-stream'})

  // 3. State machine for workflow control
  const workflowMachine = patterns.request('order-workflow', {
    idleState: 'waiting',
    loadingState: 'processing',
    successState: 'completed',
    errorState: 'failed',
    timeout: 10000
  })

  const workflow = createAndStartStateMachine(workflowMachine)

  // 4. Set up processing logic
  orderPrep.on(async orderData => {
    console.log(`🏭 Preparing order ${orderData.id}...`)

    // Emit to stream
    orderUpdates.next({
      orderId: orderData.id,
      stage: 'preparation',
      status: 'in_progress'
    })

    await new Promise(resolve => setTimeout(resolve, 200))
    return {prepared: true, items: orderData.items.length}
  })

  inventoryReserve.on(async orderData => {
    console.log(`📦 Reserving inventory for order ${orderData.id}...`)

    orderUpdates.next({
      orderId: orderData.id,
      stage: 'inventory',
      status: 'reserving'
    })

    await new Promise(resolve => setTimeout(resolve, 300))

    // Simulate occasional inventory issues
    if (Math.random() < 0.1) {
      throw new Error('Insufficient inventory')
    }

    return {reserved: true, reservationId: `RES-${Date.now()}`}
  })

  paymentProcess.on(async orderData => {
    console.log(`💰 Processing payment for order ${orderData.id}...`)

    orderUpdates.next({
      orderId: orderData.id,
      stage: 'payment',
      status: 'processing'
    })

    await new Promise(resolve => setTimeout(resolve, 400))

    // Simulate occasional payment failures
    if (Math.random() < 0.05) {
      throw new Error('Payment declined')
    }

    return {charged: true, transactionId: `TXN-${Date.now()}`}
  })

  // 5. Compose the processing pipeline
  const orderPipeline = cyreCompose(
    [orderPrep, inventoryReserve, paymentProcess],
    {
      continueOnError: false,
      collectDetailedMetrics: true,
      debug: false
    }
  )

  // 6. Connect stream to state machine
  orderUpdates.subscribe({
    next: update => {
      console.log(
        `📡 Stream update: Order ${update.orderId} - ${update.stage} ${update.status}`
      )

      if (update.stage === 'payment' && update.status === 'processing') {
        // Trigger state machine
        workflow.send('REQUEST')
      }
    }
  })

  // 7. Connect state machine back to Cyre
  workflow.onStateChange(change => {
    if (change.to.current === 'completed') {
      cyre.call('order-completion', {
        workflowCompleted: true,
        timestamp: change.timestamp
      })
    }
  })

  cyre.action({id: 'order-completion'})
  cyre.on('order-completion', completion => {
    console.log('🎉 Order workflow completed successfully!')
    return {notified: true}
  })

  // 8. Test the complete integration
  console.log('\n--- Testing Complete Integration ---')

  const testOrder = {
    id: 'ORD-INTEGRATION-001',
    items: [
      {id: 'widget1', quantity: 2},
      {id: 'widget2', quantity: 1}
    ],
    total: 199.99,
    customerId: 'cust-123'
  }

  try {
    const result = await orderPipeline.call(testOrder)

    if (result.ok) {
      console.log('✅ Complete order processing successful!')

      // Complete the workflow
      setTimeout(() => {
        workflow.send('SUCCESS')
      }, 500)
    } else {
      console.log('❌ Order processing failed:', result.message)
      workflow.send('ERROR')
    }
  } catch (error) {
    console.error('💥 Integration error:', error.message)
    workflow.send('ERROR')
  }

  await new Promise(resolve => setTimeout(resolve, 2000))
}

// ============================================================================
// PART 6: Performance and Monitoring
// ============================================================================

async function demonstrateMonitoring() {
  console.log('\n=== MONITORING & PERFORMANCE ===')

  // Get metrics from various components
  const breathing = cyre.getBreathingState()
  const performance = cyre.getPerformanceState()
  const report = cyre.getMetricsReport()

  console.log(`🫁 System Health:`)
  console.log(`   Stress Level: ${(breathing.stress * 100).toFixed(1)}%`)
  console.log(`   Breathing Pattern: ${breathing.pattern}`)
  console.log(`   Current Rate: ${breathing.currentRate}ms`)

  console.log(`\n📊 Performance:`)
  console.log(`   Call Rate: ${performance.callRate}/sec`)
  console.log(`   Total Calls: ${performance.totalCalls}`)
  console.log(`   Total Executions: ${performance.totalExecutions}`)

  console.log(`\n📈 System Report:`)
  console.log(`   Events Collected: ${report.events}`)
  console.log(`   Uptime: ${report.global.uptime}s`)
  console.log(`   Total Errors: ${report.global.totalErrors}`)

  // Performance insights
  const insights = cyre.getPerformanceInsights()
  if (insights.length > 0) {
    console.log(`\n💡 Performance Insights:`)
    insights.forEach(insight => console.log(`   - ${insight}`))
  } else {
    console.log('\n✅ System performing optimally')
  }
}

// ============================================================================
// Main Demo Runner
// ============================================================================

async function runComprehensiveShowcase() {
  console.log('🚀 COMPREHENSIVE CYRE SHOWCASE')
  console.log('==============================')
  console.log(
    'Demonstrating: Core + Hooks + Composition + Streams + State Machines'
  )

  try {
    // Initialize Cyre
    await cyre.initialize()

    // Run all demonstrations
    await demonstrateHooksIntegration()
    await demonstrateComposition()
    await demonstrateStreams()
    await demonstrateStateMachine()
    await demonstrateAdvancedIntegration()
    await demonstrateMonitoring()

    console.log('\n🎉 COMPREHENSIVE SHOWCASE COMPLETED!')
    console.log('====================================')

    // Final comprehensive stats
    const finalReport = cyre.getMetricsReport()
    console.log(`\n📊 Final Comprehensive Stats:`)
    console.log(`   Total Calls: ${finalReport.global.totalCalls}`)
    console.log(`   Total Executions: ${finalReport.global.totalExecutions}`)
    console.log(`   Total Errors: ${finalReport.global.totalErrors}`)
    console.log(
      `   Success Rate: ${(
        (finalReport.global.totalExecutions / finalReport.global.totalCalls) *
        100
      ).toFixed(1)}%`
    )
    console.log(`   System Uptime: ${finalReport.global.uptime}s`)
    console.log(`   Events Recorded: ${finalReport.events}`)
  } catch (error) {
    console.error('❌ Comprehensive showcase failed:', error)
  }
}

runComprehensiveShowcase().catch(console.error)

export {runComprehensiveShowcase}
