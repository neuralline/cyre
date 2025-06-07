// example/complete-beautiful-trilogy-demo.ts
// The Complete Beautiful Trilogy: useCyre + useBranch + useCompose
// Shows the difference between cyre.group (management) vs useCompose (execution)

import {useBranch, useCyre, useGroup} from '../src'
import {groupOperations} from '../src/components/cyre-group'

/**
 * Complete demonstration of the beautiful trilogy working together
 * Plus comparison with cyre.group to show different purposes
 */
async function demonstrateCompleteBeautifulTrilogy() {
  console.log('🎭 Complete Beautiful Trilogy Demo')
  console.log('==================================')
  console.log('useCyre + useBranch + useCompose + cyre.group')
  console.log('')

  // ========================================
  // SETUP: Create Branch Architecture
  // ========================================

  console.log('🌳 Setting up branch architecture...')

  const userBranch = useBranch({id: 'users', name: 'user-management'})
  const orderBranch = useBranch({id: 'orders', name: 'order-processing'})
  const notificationBranch = useBranch({
    id: 'notifications',
    name: 'notification-system'
  })

  console.log('✅ Branches created:', {
    users: userBranch.path,
    orders: orderBranch.path,
    notifications: notificationBranch.path
  })

  // ========================================
  // STEP 1: Create Individual Channels with useCyre
  // ========================================

  console.log('\n🔧 Creating individual channels with useCyre...')

  // User management channels
  const userValidator = useCyre(
    {
      name: 'user-validator',
      channelId: 'validator',
      priority: {level: 'high'} // Remove condition for now
    },
    userBranch
  )

  const userStorage = useCyre(
    {
      name: 'user-storage',
      channelId: 'storage'
      // Removed debounce for cleaner demo
    },
    userBranch
  )

  const userAnalytics = useCyre(
    {
      name: 'user-analytics',
      channelId: 'analytics'
      // Removed throttle for cleaner demo
    },
    userBranch
  )

  // Order processing channels
  const orderValidator = useCyre(
    {
      name: 'order-validator',
      channelId: 'validator',
      required: true,
      priority: {level: 'critical'} // Correct object format
    },
    orderBranch
  )

  const orderPayment = useCyre(
    {
      name: 'order-payment',
      channelId: 'payment',
      priority: {level: 'high', timeout: 5000} // Include timeout in priority config
    },
    orderBranch
  )

  const orderFulfillment = useCyre(
    {
      name: 'order-fulfillment',
      channelId: 'fulfillment'
    },
    orderBranch
  )

  // Notification channels - removed throttling for cleaner demo
  const emailNotifier = useCyre(
    {
      name: 'email-notifier',
      channelId: 'email'
    },
    notificationBranch
  )

  const smsNotifier = useCyre(
    {
      name: 'sms-notifier',
      channelId: 'sms'
    },
    notificationBranch
  )

  const pushNotifier = useCyre(
    {
      name: 'push-notifier',
      channelId: 'push'
    },
    notificationBranch
  )

  console.log('✅ Individual channels created across branches')

  // ========================================
  // STEP 2: Set Up Channel Handlers
  // ========================================

  console.log('\n🎯 Setting up channel handlers...')

  // User handlers
  userValidator.on((user: any) => {
    console.log(`   👤 Validating user: ${user.name}`)
    // Check if user has required fields
    if (!user.email || !user.name) {
      return {
        ok: false,
        payload: user,
        message: 'User validation failed: missing required fields'
      }
    }
    return {
      ok: true,
      payload: {...user, validated: true},
      message: 'User validated'
    }
  })

  userStorage.on((user: any) => {
    console.log(`   💾 Storing user: ${user.name}`)
    return {
      ok: true,
      payload: {...user, id: Date.now()},
      message: 'User stored'
    }
  })

  userAnalytics.on((user: any) => {
    console.log(`   📊 Analytics for user: ${user.name}`)
    return {
      ok: true,
      payload: {event: 'user_created', userId: user.id},
      message: 'Analytics recorded'
    }
  })

  // Order handlers
  orderValidator.on((order: any) => {
    console.log(`   📋 Validating order: ${order.id}`)
    return {
      ok: true,
      payload: {...order, validated: true},
      message: 'Order validated'
    }
  })

  orderPayment.on((order: any) => {
    console.log(`   💳 Processing payment: $${order.amount}`)
    const success = Math.random() > 0.1 // 90% success rate
    return {
      ok: success,
      payload: success ? {...order, paid: true} : order,
      message: success ? 'Payment successful' : 'Payment failed'
    }
  })

  orderFulfillment.on((order: any) => {
    console.log(`   📦 Fulfilling order: ${order.id}`)
    return {
      ok: true,
      payload: {...order, fulfilled: true},
      message: 'Order fulfilled'
    }
  })

  // Notification handlers
  emailNotifier.on((data: any) => {
    console.log(`   📧 Email sent to: ${data.email}`)
    return {
      ok: true,
      payload: {sent: 'email', to: data.email},
      message: 'Email sent'
    }
  })

  smsNotifier.on((data: any) => {
    console.log(`   📱 SMS sent to: ${data.phone}`)
    return {
      ok: true,
      payload: {sent: 'sms', to: data.phone},
      message: 'SMS sent'
    }
  })

  pushNotifier.on((data: any) => {
    console.log(`   🔔 Push notification sent to: ${data.userId}`)
    return {
      ok: true,
      payload: {sent: 'push', to: data.userId},
      message: 'Push sent'
    }
  })

  console.log('✅ All handlers configured')

  // ========================================
  // STEP 3: cyre.group for Management (Organization)
  // ========================================

  console.log('\n🏗️  STEP 3: Using cyre.group for Management & Organization')
  console.log('=========================================================')

  // Group all validator channels for shared monitoring
  const validatorGroup = groupOperations.create('validators', {
    channels: ['*/validator'], // Pattern: any branch's validator
    shared: {
      middleware: [
        (req: any, next: any) => {
          console.log(`     🛡️  Validator middleware: ${req.channelId}`)
          return next()
        }
      ],
      priority: 'high'
    }
  })

  // Group all notification channels for shared rate limiting
  const notificationGroup = groupOperations.create('notifications', {
    channels: ['notification-system/*'], // Pattern: all notification channels
    shared: {
      throttle: 2000, // Shared rate limiting
      middleware: [
        (req: any, next: any) => {
          console.log(`     🔔 Notification middleware: ${req.channelId}`)
          return next()
        }
      ]
    }
  })

  console.log('✅ Groups created for management:')
  console.log('   • Validators group: Shared monitoring middleware')
  console.log('   • Notifications group: Shared rate limiting')

  // ========================================
  // STEP 4: useCompose for Execution (Workflows)
  // ========================================

  console.log('\n🎪 STEP 4: Using useCompose for Execution & Workflows')
  console.log('======================================================')

  // User registration pipeline (sequential)
  const userRegistrationPipeline = useGroup(
    [userValidator, userStorage, userAnalytics],
    {
      name: 'user-registration-pipeline',
      strategy: 'sequential',
      errorStrategy: 'fail-fast'
    }
  )

  // Order processing pipeline (sequential with error handling)
  const orderProcessingPipeline = useGroup(
    [orderValidator, orderPayment, orderFulfillment],
    {
      name: 'order-processing-pipeline',
      strategy: 'sequential',
      errorStrategy: 'continue' // Continue even if payment fails
    }
  )

  // Multi-channel notification (parallel)
  const notificationBroadcast = useGroup(
    [emailNotifier, smsNotifier, pushNotifier],
    {
      name: 'notification-broadcast',
      strategy: 'parallel',
      errorStrategy: 'continue' // Send to all available channels
    }
  )

  console.log('✅ Workflows created with useCompose:')
  console.log('   • User registration: Sequential pipeline')
  console.log('   • Order processing: Sequential with error tolerance')
  console.log('   • Notifications: Parallel broadcast')

  // ========================================
  // STEP 5: Execute Workflows
  // ========================================

  console.log('\n🚀 STEP 5: Executing Workflows')
  console.log('==============================')

  // Test user registration workflow
  console.log('\n📝 User Registration Workflow:')
  const newUser = {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28
  }

  const userResult = await userRegistrationPipeline.call(newUser)
  console.log(
    `   Result: ${userResult.ok ? '✅ Success' : '❌ Failed'} - ${
      userResult.message
    }`
  )

  // Test order processing workflow
  console.log('\n🛒 Order Processing Workflow:')
  const newOrder = {
    id: 'ORD-' + Date.now(),
    userId: 12345,
    items: ['laptop', 'mouse'],
    amount: 1299.99
  }

  const orderResult = await orderProcessingPipeline.call(newOrder)
  console.log(
    `   Result: ${orderResult.ok ? '✅ Success' : '❌ Failed'} - ${
      orderResult.message
    }`
  )

  // Test notification broadcast
  console.log('\n📢 Notification Broadcast:')
  const notificationData = {
    userId: 12345,
    email: 'alice@example.com',
    phone: '+1234567890',
    message: 'Your order has been confirmed!'
  }

  const notificationResult = await notificationBroadcast.call(notificationData)
  console.log(
    `   Result: ${notificationResult.ok ? '✅ Success' : '❌ Failed'} - ${
      notificationResult.message
    }`
  )

  // ========================================
  // STEP 6: Show the Beautiful Differences
  // ========================================

  console.log('\n💎 STEP 6: The Beautiful Differences')
  console.log('====================================')

  console.log('\n🔧 **useCyre**: Single Channel Management')
  console.log('   • "Just manage this one channel for me"')
  console.log('   • Instance-agnostic, simple, focused')
  console.log('   • Example: userValidator.call(data)')

  console.log('\n🌳 **useBranch**: Hierarchical Organization')
  console.log('   • "Create isolated namespaces for related channels"')
  console.log('   • Path-based routing, namespace isolation')
  console.log('   • Example: userBranch.call("validator", data)')

  console.log('\n🎪 **useCompose**: Execution Coordination')
  console.log('   • "Coordinate these specific channels together"')
  console.log('   • Workflow orchestration, timing control, error handling')
  console.log('   • Example: pipeline.call(data) → runs all channels')

  console.log('\n🏗️  **cyre.group**: Management & Organization')
  console.log('   • "Apply shared config to channels matching patterns"')
  console.log('   • Pattern-based grouping, bulk operations, monitoring')
  console.log('   • Example: All */validator channels get auth middleware')

  // ========================================
  // STEP 7: Advanced Composition Example
  // ========================================

  console.log('\n🚀 STEP 7: Advanced Sequential Business Process')
  console.log('===============================================')

  // Instead of composing pipelines, show proper sequential business logic

  console.log('\n🎯 Master Pipeline: User → Order → Notifications')

  // Execute each pipeline with appropriate data
  console.log('   Executing complete business workflow...')

  // Step 1: Register user (use same data as before)
  const userPipelineResult = await userRegistrationPipeline.call(newUser)
  console.log(
    `   User Registration: ${
      userPipelineResult.ok ? '✅ Success' : '❌ Failed'
    } - ${userPipelineResult.message}`
  )

  // Step 2: Process order (only if user registration succeeded)
  let orderPipelineResult
  if (userPipelineResult.ok) {
    orderPipelineResult = await orderProcessingPipeline.call(newOrder)
    console.log(
      `   Order Processing: ${
        orderPipelineResult.ok ? '✅ Success' : '❌ Failed'
      } - ${orderPipelineResult.message}`
    )
  } else {
    console.log(`   Order Processing: ⏭️  Skipped (user registration failed)`)
  }

  // Step 3: Send notifications (use same data as before)
  const notificationPipelineResult = await notificationBroadcast.call(
    notificationData
  )
  console.log(
    `   Notifications: ${
      notificationPipelineResult.ok ? '✅ Success' : '❌ Failed'
    } - ${notificationPipelineResult.message}`
  )

  const masterResult = {
    ok:
      userPipelineResult.ok &&
      (orderPipelineResult?.ok ?? false) &&
      notificationPipelineResult.ok,
    message: 'Master pipeline completed',
    steps: {
      user: userPipelineResult.ok,
      order: orderPipelineResult?.ok ?? false,
      notifications: notificationPipelineResult.ok
    }
  }

  console.log(
    `   Master Result: ${
      masterResult.ok ? '✅ Complete Success' : '⚠️  Partial Success'
    } - User: ${masterResult.steps.user}, Order: ${
      masterResult.steps.order
    }, Notifications: ${masterResult.steps.notifications}`
  )

  // ========================================
  // STEP 8: Performance & Stats Summary
  // ========================================

  console.log('\n📊 STEP 8: Performance & Stats Summary')
  console.log('======================================')

  // Get stats from all compositions
  const userStats = userRegistrationPipeline.getStats()
  const orderStats = orderProcessingPipeline.getStats()
  const notificationStats = notificationBroadcast.getStats()

  console.log(
    '\n💡 Note: Protection features (throttle, debounce) removed for clean demo'
  )
  console.log(
    "   In production, you'd add: throttle: 1000, debounce: 200, etc."
  )

  console.log('\n📈 Pipeline Statistics:')
  console.log(
    `   User Registration: ${userStats.totalExecutions} executions, ${(
      userStats.successRate * 100
    ).toFixed(1)}% success`
  )
  console.log(
    `   Order Processing: ${orderStats.totalExecutions} executions, ${(
      orderStats.successRate * 100
    ).toFixed(1)}% success`
  )
  console.log(
    `   Notifications: ${notificationStats.totalExecutions} executions, ${(
      notificationStats.successRate * 100
    ).toFixed(1)}% success`
  )
  console.log(`   Individual pipelines working beautifully!`)

  // Get group information
  const validatorGroupInfo = groupOperations.get('validators')
  const notificationGroupInfo = groupOperations.get('notifications')

  console.log('\n🏗️  Group Management:')
  console.log(
    `   Validators Group: ${
      validatorGroupInfo?.matchedChannels.size || 0
    } channels managed`
  )
  console.log(
    `   Notifications Group: ${
      notificationGroupInfo?.matchedChannels.size || 0
    } channels managed`
  )

  console.log('\n🎉 Complete Beautiful Trilogy Demo Finished!')
  console.log('===========================================')
  console.log('✨ Each hook living its beautiful simple life!')
  console.log('✨ Together creating powerful, organized, scalable systems!')
}

// Export for testing
export {demonstrateCompleteBeautifulTrilogy}

// Run demonstration
demonstrateCompleteBeautifulTrilogy().catch(console.error)
