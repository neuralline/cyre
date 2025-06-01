// examples/production-integration-example.ts
// Production-ready CYRE integration with schema validation

import {cyre, schema, useCyre, cyreCompose} from '../src'
import {
  memoryMonitor,
  optimizedSchemaCache
} from '../src/schema/schema-memory-optimization'

/*

      C.Y.R.E - P.R.O.D.U.C.T.I.O.N - I.N.T.E.G.R.A.T.I.O.N
      
      Real-world production patterns:
      - Shared schema definitions
      - Proper error handling
      - Memory monitoring
      - Performance optimization
      - Type-safe validation

*/

// =====================================================
// 1. SHARED SCHEMA DEFINITIONS (Create Once, Use Many)
// =====================================================

// User management schemas
const UserSchemas = {
  base: schema.object({
    id: schema.pipe(schema.number(), s => s.positive()),
    email: schema.email_string(),
    createdAt: schema.number()
  }),

  registration: schema.object({
    email: schema.email_string(),
    password: schema.pipe(schema.string(), s => s.minLength(8)),
    firstName: schema.pipe(schema.string(), s => s.minLength(2)),
    lastName: schema.pipe(schema.string(), s => s.minLength(2)),
    acceptTerms: schema.literal(true)
  }),

  profile: schema.object({
    id: schema.pipe(schema.number(), s => s.positive()),
    email: schema.email_string(),
    firstName: schema.string(),
    lastName: schema.string(),
    avatar: schema.string().optional(),
    preferences: schema
      .object({
        theme: schema.enums('light', 'dark', 'system'),
        notifications: schema.boolean(),
        language: schema.enums('en', 'es', 'fr', 'de')
      })
      .optional()
  })
}

// API schemas
const ApiSchemas = {
  request: schema.object({
    method: schema.enums('GET', 'POST', 'PUT', 'DELETE'),
    path: schema.string(),
    headers: schema.object({}).optional(),
    body: schema.any().optional(),
    timestamp: schema.number()
  }),

  response: schema.object({
    success: schema.boolean(),
    data: schema.any().optional(),
    error: schema
      .object({
        code: schema.string(),
        message: schema.string(),
        details: schema.any().optional()
      })
      .optional(),
    metadata: schema.object({
      requestId: schema.string(),
      timestamp: schema.number(),
      duration: schema.number()
    })
  }),

  paginatedResponse: schema.object({
    success: schema.boolean(),
    data: schema.array(schema.any()),
    pagination: schema.object({
      page: schema.pipe(schema.number(), s => s.positive()),
      limit: schema.pipe(schema.number(), s => s.positive()),
      total: schema.pipe(schema.number(), s => s.min(0)),
      hasMore: schema.boolean()
    }),
    metadata: schema.object({
      requestId: schema.string(),
      timestamp: schema.number()
    })
  })
}

// Business logic schemas
const BusinessSchemas = {
  order: schema.object({
    id: schema.pipe(schema.number(), s => s.positive()),
    userId: schema.pipe(schema.number(), s => s.positive()),
    items: schema.array(
      schema.object({
        productId: schema.pipe(schema.number(), s => s.positive()),
        quantity: schema.pipe(schema.number(), s => s.positive()),
        price: schema.pipe(schema.number(), s => s.positive())
      })
    ),
    total: schema.pipe(schema.number(), s => s.positive()),
    status: schema.enums(
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ),
    createdAt: schema.number(),
    updatedAt: schema.number()
  }),

  payment: schema.object({
    amount: schema.pipe(schema.number(), s => s.positive()),
    currency: schema.enums('USD', 'EUR', 'GBP'),
    method: schema.enums('card', 'paypal', 'bank_transfer'),
    metadata: schema.object({
      orderId: schema.pipe(schema.number(), s => s.positive()),
      customerId: schema.pipe(schema.number(), s => s.positive())
    })
  })
}

// =====================================================
// 2. PRODUCTION APPLICATION CLASS
// =====================================================

class ProductionApp {
  private monitoringInterval?: NodeJS.Timeout

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Production CYRE Application...')

    // Initialize CYRE
    await cyre.initialize({
      autoSave: true,
      saveKey: 'production-app-state'
    })

    // Setup core actions with validation
    this.setupUserActions()
    this.setupApiActions()
    this.setupBusinessActions()

    // Start monitoring
    this.startMonitoring()

    console.log('✅ Production application initialized successfully')
  }

  private setupUserActions(): void {
    console.log('👤 Setting up user management actions...')

    // User registration action
    cyre.action({
      id: 'user:register',
      schema: UserSchemas.registration,
      throttle: 1000, // Prevent spam registrations
      log: true,
      priority: {level: 'high'}
    })

    cyre.on('user:register', async userData => {
      console.log(`Registering user: ${userData.email}`)

      // Simulate user creation
      const newUser = {
        id: Math.floor(Math.random() * 10000),
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: Date.now()
      }

      // Trigger profile creation
      await cyre.call('user:profile:create', newUser)

      return {success: true, user: newUser}
    })

    // User profile management
    cyre.action({
      id: 'user:profile:create',
      schema: UserSchemas.base,
      detectChanges: true,
      priority: {level: 'medium'}
    })

    cyre.on('user:profile:create', userData => {
      console.log(`Creating profile for user ${userData.id}`)
      return {success: true, profile: userData}
    })

    // User profile update
    cyre.action({
      id: 'user:profile:update',
      schema: UserSchemas.profile,
      throttle: 500,
      detectChanges: true
    })

    cyre.on('user:profile:update', profileData => {
      console.log(`Updating profile for user ${profileData.id}`)
      return {success: true, updated: profileData}
    })
  }

  private setupApiActions(): void {
    console.log('🌐 Setting up API actions...')

    // API request logging
    cyre.action({
      id: 'api:request:log',
      schema: ApiSchemas.request,
      log: true
    })

    cyre.on('api:request:log', requestData => {
      console.log(`API ${requestData.method} ${requestData.path}`)
      return {logged: true, requestId: `req-${Date.now()}`}
    })

    // API response processing
    cyre.action({
      id: 'api:response:process',
      schema: ApiSchemas.response,
      condition: response => response.success === true,
      transform: response => ({
        ...response,
        processedAt: Date.now()
      })
    })

    cyre.on('api:response:process', responseData => {
      console.log(`Processing successful API response`)
      return {processed: true, data: responseData}
    })

    // Paginated data handling
    cyre.action({
      id: 'api:paginated:handle',
      schema: ApiSchemas.paginatedResponse,
      throttle: 100
    })

    cyre.on('api:paginated:handle', paginatedData => {
      console.log(`Handling paginated data: ${paginatedData.data.length} items`)
      return {
        handled: true,
        itemCount: paginatedData.data.length,
        hasMore: paginatedData.pagination.hasMore
      }
    })
  }

  private setupBusinessActions(): void {
    console.log('💼 Setting up business logic actions...')

    // Order processing
    cyre.action({
      id: 'order:process',
      schema: BusinessSchemas.order,
      priority: {level: 'high'},
      condition: order => order.status === 'pending',
      log: true
    })

    cyre.on('order:process', async orderData => {
      console.log(
        `Processing order ${orderData.id} for user ${orderData.userId}`
      )

      // Trigger payment processing
      const paymentData = {
        amount: orderData.total,
        currency: 'USD' as const,
        method: 'card' as const,
        metadata: {
          orderId: orderData.id,
          customerId: orderData.userId
        }
      }

      const paymentResult = await cyre.call('payment:process', paymentData)

      return {
        processed: true,
        orderId: orderData.id,
        paymentResult: paymentResult
      }
    })

    // Payment processing
    cyre.action({
      id: 'payment:process',
      schema: BusinessSchemas.payment,
      throttle: 2000, // Prevent duplicate payments
      priority: {level: 'critical'},
      log: true
    })

    cyre.on('payment:process', paymentData => {
      console.log(
        `Processing payment: ${paymentData.amount} ${paymentData.currency}`
      )

      // Simulate payment processing
      const success = Math.random() > 0.1 // 90% success rate

      return {
        success,
        amount: paymentData.amount,
        currency: paymentData.currency,
        transactionId: success ? `tx-${Date.now()}` : undefined,
        error: success ? undefined : 'Payment failed'
      }
    })

    // Order status update
    cyre.action({
      id: 'order:status:update',
      schema: schema.object({
        orderId: schema.pipe(schema.number(), s => s.positive()),
        status: schema.enums(
          'pending',
          'processing',
          'shipped',
          'delivered',
          'cancelled'
        ),
        updatedBy: schema.string()
      }),
      detectChanges: true
    })

    cyre.on('order:status:update', updateData => {
      console.log(
        `Order ${updateData.orderId} status updated to ${updateData.status}`
      )
      return {updated: true, ...updateData}
    })
  }

  private startMonitoring(): void {
    console.log('📊 Starting performance monitoring...')

    // Monitor schema cache performance
    this.monitoringInterval = memoryMonitor.startMonitoring(30000) // Every 30 seconds

    // Log performance stats every 2 minutes
    setInterval(() => {
      const cacheStats = optimizedSchemaCache.getStats()
      const memoryReport = memoryMonitor.getReport()

      console.log('\n📈 Performance Report:')
      console.log(`Cache Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`)
      console.log(`Cache Entries: ${cacheStats.totalEntries}`)
      console.log(
        `Memory Usage: ${(cacheStats.totalMemoryUsage / 1024 / 1024).toFixed(
          2
        )}MB`
      )
      console.log(memoryReport)
    }, 120000)
  }

  // =====================================================
  // 3. PRODUCTION USAGE EXAMPLES
  // =====================================================

  async demonstrateUsage(): Promise<void> {
    console.log('\n🎯 Demonstrating production usage patterns...')

    try {
      // 1. User registration flow
      console.log('\n1. User Registration Flow:')
      const registrationResult = await cyre.call('user:register', {
        email: 'john.doe@example.com',
        password: 'securepassword123',
        firstName: 'John',
        lastName: 'Doe',
        acceptTerms: true
      })
      console.log(
        'Registration result:',
        registrationResult.ok ? 'Success' : 'Failed'
      )

      // 2. API request logging
      console.log('\n2. API Request Logging:')
      await cyre.call('api:request:log', {
        method: 'POST',
        path: '/api/users',
        headers: {'Content-Type': 'application/json'},
        body: {name: 'John'},
        timestamp: Date.now()
      })

      // 3. Order processing flow
      console.log('\n3. Order Processing Flow:')
      const orderResult = await cyre.call('order:process', {
        id: 12345,
        userId: 1001,
        items: [
          {productId: 501, quantity: 2, price: 29.99},
          {productId: 502, quantity: 1, price: 49.99}
        ],
        total: 109.97,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      console.log(
        'Order processing result:',
        orderResult.ok ? 'Success' : 'Failed'
      )

      // 4. Demonstrate validation errors
      console.log('\n4. Validation Error Handling:')
      const invalidResult = await cyre.call('user:register', {
        email: 'invalid-email', // Invalid email
        password: '123', // Too short
        firstName: 'J', // Too short
        lastName: '', // Empty
        acceptTerms: false // Must be true
      })
      console.log(
        'Invalid registration result:',
        invalidResult.ok ? 'Unexpected Success' : 'Expected Failure'
      )
      console.log('Error message:', invalidResult.message)

      // 5. Profile update with change detection
      console.log('\n5. Profile Update with Change Detection:')
      const profileData = {
        id: 1001,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        preferences: {
          theme: 'dark' as const,
          notifications: true,
          language: 'en' as const
        }
      }

      // First update
      const updateResult1 = await cyre.call('user:profile:update', profileData)
      console.log(
        'First update result:',
        updateResult1.ok ? 'Success' : 'Failed'
      )

      // Second update with same data (should be skipped due to change detection)
      const updateResult2 = await cyre.call('user:profile:update', profileData)
      console.log(
        'Second update result:',
        updateResult2.ok ? 'Unexpected Success' : 'Skipped (no changes)'
      )

      // 6. Demonstrate throttling
      console.log('\n6. Throttling Protection:')
      const throttleTest1 = await cyre.call('payment:process', {
        amount: 100,
        currency: 'USD',
        method: 'card',
        metadata: {orderId: 123, customerId: 456}
      })
      console.log('First payment:', throttleTest1.ok ? 'Processed' : 'Failed')

      // Immediate second payment (should be throttled)
      const throttleTest2 = await cyre.call('payment:process', {
        amount: 200,
        currency: 'USD',
        method: 'card',
        metadata: {orderId: 124, customerId: 456}
      })
      console.log(
        'Second payment:',
        throttleTest2.ok ? 'Unexpected Success' : 'Throttled'
      )
    } catch (error) {
      console.error('❌ Demo error:', error)
    }
  }

  // =====================================================
  // 4. ADVANCED PATTERNS
  // =====================================================

  async demonstrateAdvancedPatterns(): Promise<void> {
    console.log('\n🔬 Demonstrating advanced patterns...')

    // 1. Composed actions for complex workflows
    console.log('\n1. Composed Action Workflow:')

    // Create user channel
    const userChannel = useCyre({
      name: 'user-management',
      protection: {
        throttle: 1000,
        detectChanges: true
      }
    })

    userChannel.action({
      id: 'user:advanced:create',
      schema: UserSchemas.registration
    })

    // Create order channel
    const orderChannel = useCyre({
      name: 'order-management',
      protection: {
        throttle: 500
      }
    })

    orderChannel.action({
      id: 'order:advanced:create',
      schema: BusinessSchemas.order
    })

    // Compose channels for complete user onboarding
    const onboardingFlow = cyreCompose([userChannel, orderChannel], {
      id: 'user-onboarding',
      continueOnError: false,
      timeout: 10000
    })

    // 2. Advanced middleware patterns
    console.log('\n2. Advanced Middleware:')

    // Logging middleware
    userChannel.middleware(async (payload, next) => {
      console.log(
        `[MIDDLEWARE] Processing user action with email: ${payload.email}`
      )
      const startTime = Date.now()

      const result = await next(payload)

      const duration = Date.now() - startTime
      console.log(`[MIDDLEWARE] Action completed in ${duration}ms`)

      return result
    })

    // Validation middleware
    userChannel.middleware(async (payload, next) => {
      // Custom business logic validation
      if (payload.email && payload.email.includes('spam')) {
        return {
          ok: false,
          payload: null,
          message: 'Spam email addresses not allowed'
        }
      }

      return next(payload)
    })

    // 3. Error handling and recovery
    console.log('\n3. Error Handling Patterns:')

    cyre.action({
      id: 'resilient:action',
      schema: schema.object({
        data: schema.string(),
        shouldFail: schema.boolean().optional()
      }),
      priority: {
        level: 'high',
        maxRetries: 3,
        timeout: 5000,
        fallback: async () => {
          console.log('Executing fallback action')
          return {fallback: true}
        }
      }
    })

    cyre.on('resilient:action', async payload => {
      if (payload.shouldFail) {
        throw new Error('Simulated failure')
      }
      return {success: true, data: payload.data}
    })

    // Test error handling
    const errorResult = await cyre.call('resilient:action', {
      data: 'test',
      shouldFail: true
    })
    console.log(
      'Error handling result:',
      errorResult.ok ? 'Recovered' : 'Failed'
    )

    // 4. Performance monitoring integration
    console.log('\n4. Performance Monitoring:')

    const performanceData = cyre.getMetricsReport()
    console.log('Current performance metrics:')
    console.log(`- Total calls: ${performanceData.global.totalCalls}`)
    console.log(`- Total executions: ${performanceData.global.totalExecutions}`)
    console.log(`- Call rate: ${performanceData.global.callRate}/sec`)
    console.log(`- Uptime: ${performanceData.global.uptime}s`)
  }

  // =====================================================
  // 5. CLEANUP AND SHUTDOWN
  // =====================================================

  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down production application...')

    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    // Save state
    await cyre.saveState()

    // Generate final report
    const finalStats = optimizedSchemaCache.getStats()
    console.log('\n📊 Final Performance Report:')
    console.log(`Cache hit rate: ${(finalStats.hitRate * 100).toFixed(1)}%`)
    console.log(`Total cache entries: ${finalStats.totalEntries}`)
    console.log(
      `Memory usage: ${(finalStats.totalMemoryUsage / 1024 / 1024).toFixed(
        2
      )}MB`
    )

    // Shutdown CYRE
    cyre.shutdown()

    console.log('✅ Application shutdown complete')
  }
}

// =====================================================
// 6. PRODUCTION BEST PRACTICES SUMMARY
// =====================================================

const ProductionBestPractices = {
  schemaDesign: [
    '✅ Create shared schema definitions for reuse',
    '✅ Use composition for complex object validation',
    '✅ Implement proper error messages with refinements',
    '✅ Cache schemas for performance optimization'
  ],

  actionConfiguration: [
    '✅ Set appropriate throttle/debounce for rate limiting',
    '✅ Use change detection for idempotent operations',
    '✅ Configure priority levels for critical actions',
    '✅ Enable logging for audit trails'
  ],

  errorHandling: [
    '✅ Implement graceful degradation with fallbacks',
    '✅ Use proper validation error messages',
    '✅ Set reasonable timeout values',
    '✅ Configure retry mechanisms for critical operations'
  ],

  performance: [
    '✅ Monitor cache hit rates and memory usage',
    '✅ Use composed actions for complex workflows',
    '✅ Implement proper middleware chains',
    '✅ Regular performance profiling and optimization'
  ],

  monitoring: [
    '✅ Real-time performance monitoring',
    '✅ Memory usage tracking and alerts',
    '✅ Cache performance optimization',
    '✅ Error rate monitoring and alerting'
  ]
}

// =====================================================
// 7. MAIN EXECUTION
// =====================================================

async function runProductionExample(): Promise<void> {
  const app = new ProductionApp()

  try {
    // Initialize application
    await app.initialize()

    // Demonstrate basic usage
    await app.demonstrateUsage()

    // Demonstrate advanced patterns
    await app.demonstrateAdvancedPatterns()

    console.log('\n🎉 Production integration demonstration completed!')
    console.log('\n📋 Best Practices Summary:')

    Object.entries(ProductionBestPractices).forEach(([category, practices]) => {
      console.log(`\n${category.toUpperCase()}:`)
      practices.forEach(practice => console.log(`  ${practice}`))
    })

    // Cleanup
    setTimeout(() => {
      app.shutdown()
    }, 5000)
  } catch (error) {
    console.error('❌ Production example failed:', error)
    await app.shutdown()
    process.exit(1)
  }
}

// Auto-run if executed directly

runProductionExample()

export {
  ProductionApp,
  ProductionBestPractices,
  UserSchemas,
  ApiSchemas,
  BusinessSchemas
}
