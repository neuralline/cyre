// demo/branch.ts
// Branch system demonstration with actual Cyre ecosystem APIs
// File location: demonstrates branch system with real functional TypeScript patterns

import {cyre, useBranch, schema, orchestration} from '../src'
import {sensor} from '../src/context/metrics-report'
import {schedule} from '../src/components/cyre-schedule'
import type {Branch, BranchConfig} from '../src/types/branch'
import type {IO} from '../src/types/core'

/*
  Branch System Integration with Actual Cyre Ecosystem
  
  Features demonstrated:
  - Modern branch system with path-based addressing
  - Schema validation integration
  - Real orchestration engine coordination using actual APIs
  - Actual sensor monitoring (not fake metrics.trackEvent)
  - Actual schedule system integration
  - Cross-branch communication patterns
  - Component isolation and reuse
  - Functional programming patterns
  - TypeScript strict typing
*/

// User data schema for validation
const UserDataSchema = schema.object({
  id: schema.string().minLength(3),
  name: schema.string().minLength(2),
  email: schema.email_string(),
  role: schema.enum(['user', 'admin', 'moderator']),
  preferences: schema.object({
    theme: schema.enum(['light', 'dark']),
    notifications: schema.boolean()
  })
})

// Product schema for e-commerce example
const ProductSchema = schema.object({
  id: schema.string(),
  name: schema.string().minLength(1),
  price: schema.number().min(0),
  category: schema.string(),
  stock: schema.number().min(0)
})

// Message schema for communication
const MessageSchema = schema.object({
  from: schema.string(),
  to: schema.string(),
  content: schema.string().minLength(1).maxLength(1000),
  timestamp: schema.number(),
  type: schema.enum(['info', 'warning', 'error', 'success'])
})

/**
 * Initialize Cyre system with actual orchestration
 */
const initializeSystem = async (): Promise<void> => {
  await cyre.initialize()

  // Register system orchestrations using actual API
  const systemMonitor = orchestration.create({
    id: 'branch-system-monitor',
    name: 'Branch System Health Monitor',
    triggers: [
      {
        name: 'health-check',
        type: 'time',
        interval: 30000 // Every 30 seconds
      }
    ],
    actions: [
      {
        action: 'system-health-check',
        targets: 'system-health-log',
        payload: () => ({
          timestamp: Date.now(),
          systemHealth: cyre.getSystemHealth(),
          performanceState: cyre.getPerformanceState()
        })
      }
    ]
  })

  if (systemMonitor.ok) {
    orchestration.start(systemMonitor.orchestrationId)
    sensor.success('system-init', 'System orchestration registered and started')
  } else {
    sensor.error('system-init', systemMonitor.message)
  }
}

/**
 * Create user management branch with modern patterns
 */
const createUserManagementBranch = (): Branch => {
  const userBranch = useBranch({
    id: 'user-management',
    pathSegment: 'users',
    maxDepth: 3
  })

  // User registration with schema validation
  userBranch.action({
    id: 'register-user',
    schema: UserDataSchema,
    throttle: 2000, // Prevent spam registrations
    required: true,
    detectChanges: true,
    payload: null
  })

  // User profile updates
  userBranch.action({
    id: 'update-profile',
    schema: UserDataSchema.partial(), // Allow partial updates
    debounce: 1000, // Batch rapid updates
    payload: null
  })

  // User authentication
  userBranch.action({
    id: 'authenticate',
    required: true,
    maxWait: 5000, // Authentication timeout
    payload: null
  })

  // Setup event handlers with proper typing and real sensor usage
  userBranch.on('register-user', (userData: typeof UserDataSchema._type) => {
    sensor.success('user-registration', `User registered: ${userData.email}`, {
      userId: userData.id,
      email: userData.email
    })

    // Trigger welcome flow using actual orchestration
    orchestration.trigger('user-welcome-flow', 'user-registered', {
      userId: userData.id,
      email: userData.email,
      preferences: userData.preferences
    })

    return {
      success: true,
      userId: userData.id,
      message: 'User registered successfully'
    }
  })

  userBranch.on(
    'update-profile',
    (updates: Partial<typeof UserDataSchema._type>) => {
      sensor.info(
        'user-profile-update',
        `Profile updated for user: ${updates.id}`,
        {
          userId: updates.id,
          fieldsUpdated: Object.keys(updates).length
        }
      )

      return {
        success: true,
        updated: Object.keys(updates),
        timestamp: Date.now()
      }
    }
  )

  userBranch.on(
    'authenticate',
    (credentials: {email: string; password: string}) => {
      // Simulated authentication logic
      const authenticated =
        credentials.email.includes('@') && credentials.password.length >= 8

      if (authenticated) {
        sensor.success('user-authentication', 'Authentication successful', {
          email: credentials.email
        })
      } else {
        sensor.warn('user-authentication', 'Authentication failed', {
          email: credentials.email,
          reason: 'Invalid credentials'
        })
      }

      return {
        authenticated,
        token: authenticated ? `token-${Date.now()}` : null,
        message: authenticated ? 'Login successful' : 'Invalid credentials'
      }
    }
  )

  return userBranch
}

/**
 * Create e-commerce branch with product management
 */
const createEcommerceBranch = (): Branch => {
  const commerceBranch = useBranch({
    id: 'ecommerce',
    pathSegment: 'shop',
    maxDepth: 4
  })

  // Product catalog management
  commerceBranch.action({
    id: 'add-product',
    schema: ProductSchema,
    required: true,
    payload: null
  })

  // Shopping cart operations
  commerceBranch.action({
    id: 'add-to-cart',
    throttle: 500, // Prevent rapid clicking
    payload: {items: [], total: 0}
  })

  // Order processing
  commerceBranch.action({
    id: 'process-order',
    required: true,
    maxWait: 10000, // Order processing timeout
    payload: null
  })

  // Inventory management
  commerceBranch.action({
    id: 'update-inventory',
    schema: schema.object({
      productId: schema.string(),
      quantity: schema.number().min(0),
      operation: schema.enum(['set', 'add', 'subtract'])
    }),
    detectChanges: true,
    payload: null
  })

  // Event handlers with business logic using real APIs
  commerceBranch.on('add-product', (product: typeof ProductSchema._type) => {
    sensor.success('product-catalog', `Product added: ${product.name}`, {
      productId: product.id,
      category: product.category,
      price: product.price
    })

    // Schedule inventory checks using actual schedule API
    schedule.create({
      id: `inventory-check-${product.id}`,
      type: 'scheduled-event',
      source: 'api',
      triggers: [
        {
          interval: 24 * 60 * 60 * 1000, // Daily check
          channels: ['update-inventory'],
          payload: {productId: product.id, checkType: 'daily'}
        }
      ],
      enabled: true,
      metadata: {
        description: `Daily inventory check for ${product.name}`,
        productId: product.id
      }
    })

    return {
      success: true,
      productId: product.id,
      catalogSize: Date.now() % 1000 // Mock catalog size
    }
  })

  commerceBranch.on(
    'add-to-cart',
    (item: {productId: string; quantity: number}) => {
      sensor.info('shopping-cart', `Item added to cart: ${item.productId}`, {
        productId: item.productId,
        quantity: item.quantity
      })

      // Cross-branch call to check inventory
      commerceBranch.call('update-inventory', {
        productId: item.productId,
        quantity: item.quantity,
        operation: 'subtract'
      })

      return {
        cartUpdated: true,
        itemCount: item.quantity,
        timestamp: Date.now()
      }
    }
  )

  commerceBranch.on(
    'process-order',
    async (orderData: {items: any[]; userId: string}) => {
      sensor.info(
        'order-processing',
        `Processing order for user: ${orderData.userId}`,
        {
          userId: orderData.userId,
          itemCount: orderData.items.length
        }
      )

      // Trigger order fulfillment orchestration
      const fulfillmentResult = await orchestration.trigger(
        'order-fulfillment',
        'order-submitted',
        {
          orderId: `order-${Date.now()}`,
          items: orderData.items,
          userId: orderData.userId
        }
      )

      if (fulfillmentResult.ok) {
        sensor.success('order-fulfillment', 'Order processed successfully', {
          orderId: fulfillmentResult.result?.orderId,
          userId: orderData.userId
        })
      } else {
        sensor.error('order-fulfillment', fulfillmentResult.message, {
          userId: orderData.userId
        })
      }

      return {
        orderId: `order-${Date.now()}`,
        status: 'confirmed',
        estimatedDelivery: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString()
      }
    }
  )

  return commerceBranch
}

/**
 * Create notification system branch
 */
const createNotificationBranch = (): Branch => {
  const notificationBranch = useBranch({
    id: 'notifications',
    pathSegment: 'notify',
    maxDepth: 2
  })

  // Message dispatching
  notificationBranch.action({
    id: 'send-notification',
    schema: MessageSchema,
    throttle: 1000, // Rate limiting
    required: true,
    payload: null
  })

  // Bulk notifications
  notificationBranch.action({
    id: 'broadcast',
    debounce: 2000, // Batch broadcasts
    payload: null
  })

  // Notification preferences
  notificationBranch.action({
    id: 'update-preferences',
    detectChanges: true,
    payload: {email: true, push: true, sms: false}
  })

  notificationBranch.on(
    'send-notification',
    (message: typeof MessageSchema._type) => {
      sensor.info(
        'notification-delivery',
        `Notification sent [${message.type.toUpperCase()}]: ${message.content}`,
        {
          type: message.type,
          recipient: message.to,
          timestamp: message.timestamp
        }
      )

      return {
        delivered: true,
        messageId: `msg-${Date.now()}`,
        deliveryTime: Date.now()
      }
    }
  )

  notificationBranch.on(
    'broadcast',
    (broadcast: {message: string; recipients: string[]}) => {
      sensor.info(
        'notification-broadcast',
        `Broadcasting to ${broadcast.recipients.length} recipients`,
        {
          recipientCount: broadcast.recipients.length,
          message: broadcast.message.substring(0, 50) + '...'
        }
      )

      // Schedule individual notifications using actual schedule API
      broadcast.recipients.forEach((recipient, index) => {
        schedule.create({
          id: `broadcast-${Date.now()}-${index}`,
          type: 'scheduled-event',
          source: 'api',
          triggers: [
            {
              delay: index * 100, // Stagger sends
              channels: ['send-notification'],
              payload: {
                from: 'system',
                to: recipient,
                content: broadcast.message,
                timestamp: Date.now(),
                type: 'info'
              }
            }
          ],
          enabled: true,
          metadata: {
            description: `Broadcast notification to ${recipient}`,
            broadcastId: `broadcast-${Date.now()}`
          }
        })
      })

      return {
        scheduled: broadcast.recipients.length,
        broadcastId: `broadcast-${Date.now()}`
      }
    }
  )

  return notificationBranch
}

/**
 * Create child branches for hierarchical organization
 */
const createChildBranches = (
  parentBranch: Branch
): {
  profile: Branch
  settings: Branch
  activity: Branch
} => {
  const profileBranch = parentBranch.createChild({
    id: 'profile',
    pathSegment: 'profile'
  })

  const settingsBranch = parentBranch.createChild({
    id: 'settings',
    pathSegment: 'settings'
  })

  const activityBranch = parentBranch.createChild({
    id: 'activity',
    pathSegment: 'activity'
  })

  // Setup profile operations
  profileBranch.action({
    id: 'update-avatar',
    schema: schema.object({
      userId: schema.string(),
      avatarUrl: schema.string().url()
    }),
    payload: null
  })

  profileBranch.on('update-avatar', data => {
    sensor.success(
      'profile-avatar',
      `Avatar updated for user: ${data.userId}`,
      {
        userId: data.userId,
        avatarUrl: data.avatarUrl
      }
    )
    return {updated: true, timestamp: Date.now()}
  })

  // Setup settings operations
  settingsBranch.action({
    id: 'privacy-settings',
    payload: {public: false, searchable: true, contactable: true}
  })

  settingsBranch.on('privacy-settings', settings => {
    sensor.info('user-settings', 'Privacy settings updated', {
      settings: Object.keys(settings)
    })
    return {saved: true, settings}
  })

  // Setup activity tracking
  activityBranch.action({
    id: 'log-activity',
    throttle: 500, // Prevent spam logging
    payload: null
  })

  activityBranch.on('log-activity', activity => {
    sensor.debug('user-activity', `Activity logged: ${activity.action}`, {
      action: activity.action,
      userId: activity.userId
    })

    return {logged: true, activityId: `activity-${Date.now()}`}
  })

  return {
    profile: profileBranch,
    settings: settingsBranch,
    activity: activityBranch
  }
}

/**
 * Demonstrate cross-branch communication patterns
 */
const demonstrateCrossBranchCommunication = async (
  userBranch: Branch,
  commerceBranch: Branch,
  notificationBranch: Branch
): Promise<void> => {
  console.log('\n=== Cross-Branch Communication Demo ===')

  // Register a user and trigger cross-branch notifications
  const newUser = {
    id: 'user-123',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'user' as const,
    preferences: {
      theme: 'dark' as const,
      notifications: true
    }
  }

  await userBranch.call('register-user', newUser)

  // Add product and notify relevant users
  const newProduct = {
    id: 'prod-456',
    name: 'Premium Widget',
    price: 99.99,
    category: 'electronics',
    stock: 50
  }

  await commerceBranch.call('add-product', newProduct)

  // Send notification about new product
  await notificationBranch.call('send-notification', {
    from: 'system',
    to: newUser.email,
    content: `New product available: ${newProduct.name}`,
    timestamp: Date.now(),
    type: 'info' as const
  })

  // Simulate order process with cross-branch coordination
  await commerceBranch.call('add-to-cart', {
    productId: newProduct.id,
    quantity: 2
  })

  await commerceBranch.call('process-order', {
    items: [{productId: newProduct.id, quantity: 2}],
    userId: newUser.id
  })

  sensor.success(
    'demo-flow',
    'Cross-branch communication completed successfully'
  )
}

/**
 * Performance monitoring using actual sensor system
 */
const demonstrateActualMetricsIntegration = (): void => {
  console.log('\n=== Actual Metrics Integration Demo ===')

  // Setup system monitoring orchestration using real API
  const performanceOrchestration = orchestration.create({
    id: 'performance-monitor',
    name: 'System Performance Monitor',
    triggers: [
      {
        name: 'performance-check',
        type: 'time',
        interval: 15000 // Every 15 seconds
      }
    ],
    actions: [
      {
        action: 'log-performance',
        targets: 'system-performance-log',
        payload: () => {
          const performance = cyre.getPerformanceState()
          const health = cyre.getSystemHealth()

          // Log performance using actual sensor
          sensor.info('system-performance', 'Performance metrics collected', {
            callRate: performance.callRate.toFixed(2),
            totalCalls: performance.totalCalls,
            stress: Math.round(performance.stress * 100),
            uptime: Math.round((Date.now() - performance.startTime) / 1000)
          })

          // Auto-adjust system breathing based on load
          if (performance.stress > 0.8) {
            sensor.warn(
              'system-stress',
              'High system stress detected - adjusting breathing rate',
              {
                currentStress: performance.stress,
                action: 'breathing-adjustment'
              }
            )

            cyre.breathing.adjust({
              interval: Math.min(cyre.breathing.getInterval() * 1.2, 10000)
            })
          }

          return {monitored: true, timestamp: Date.now()}
        }
      }
    ]
  })

  if (performanceOrchestration.ok) {
    orchestration.start(performanceOrchestration.orchestrationId)
    sensor.success(
      'metrics-init',
      'Performance monitoring orchestration started'
    )
  } else {
    sensor.error('metrics-init', performanceOrchestration.message)
  }
}

/**
 * Main demonstration function
 */
const runBranchSystemDemo = async (): Promise<void> => {
  console.log('🌳 Branch System Demo - Latest Cyre Ecosystem')
  console.log('==============================================')

  try {
    // Initialize system
    await initializeSystem()
    console.log('✅ System initialized with actual orchestration')

    // Create main branches
    const userBranch = createUserManagementBranch()
    const commerceBranch = createEcommerceBranch()
    const notificationBranch = createNotificationBranch()

    console.log('✅ Main branches created:', {
      users: userBranch.path,
      ecommerce: commerceBranch.path,
      notifications: notificationBranch.path
    })

    // Create child branches
    const childBranches = createChildBranches(userBranch)
    console.log('✅ Child branches created:', {
      profile: childBranches.profile.path,
      settings: childBranches.settings.path,
      activity: childBranches.activity.path
    })

    // Demonstrate cross-branch communication
    await demonstrateCrossBranchCommunication(
      userBranch,
      commerceBranch,
      notificationBranch
    )

    // Setup actual metrics and monitoring
    demonstrateActualMetricsIntegration()

    // Test child branch operations
    await childBranches.profile.call('update-avatar', {
      userId: 'user-123',
      avatarUrl: 'https://example.com/avatar.jpg'
    })

    await childBranches.settings.call('privacy-settings', {
      public: false,
      searchable: false,
      contactable: true
    })

    await childBranches.activity.call('log-activity', {
      action: 'profile-update',
      userId: 'user-123'
    })

    // Display final system state
    console.log('\n=== Final System State ===')
    const systemSnapshot = cyre.dev.snapshot()
    console.log('Branches:', Object.keys(systemSnapshot.branches || {}))
    console.log('Total Channels:', systemSnapshot.totalChannels)

    const orchestrationOverview = orchestration.getSystemOverview()
    console.log(
      'Active Orchestrations:',
      orchestrationOverview.total.orchestrations
    )
    console.log(
      'Active Timeline Entries:',
      orchestrationOverview.total.timelineEntries
    )

    console.log('\n🎉 Branch system demo completed successfully!')
    console.log('Features demonstrated:')
    console.log('- ✅ Modern branch system with path addressing')
    console.log('- ✅ Schema validation integration')
    console.log('- ✅ Real orchestration engine coordination')
    console.log('- ✅ Actual sensor monitoring system')
    console.log('- ✅ Real schedule system integration')
    console.log('- ✅ Cross-branch communication')
    console.log('- ✅ Hierarchical branch organization')
    console.log('- ✅ Functional programming patterns')
    console.log('- ✅ TypeScript strict typing')
  } catch (error) {
    sensor.error('demo-execution', `Demo failed: ${error}`)
    console.error('❌ Demo failed:', error)
    throw error
  }
}

// Export for testing and reuse
export {
  runBranchSystemDemo,
  createUserManagementBranch,
  createEcommerceBranch,
  createNotificationBranch,
  UserDataSchema,
  ProductSchema,
  MessageSchema
}

runBranchSystemDemo().catch(console.error)
