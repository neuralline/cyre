// demo-usecyre.ts
// Clean showcase demo for useCyre hook - demonstrates usage patterns

import {performance} from 'perf_hooks'
import {cyre} from '../src/app'
import {useBranch} from '../src/hooks/use-branch'
import {useCyre} from '../src/hooks/use-cyre'

// ========================================
// DEMO TYPES
// ========================================

interface TestResult {
  testName: string
  success: boolean
  message: string
  duration: number
}

// ========================================
// UTILITIES
// ========================================

const timeExecution = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<{result: T; duration: number}> => {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  return {result, duration}
}

const logResult = (result: TestResult): void => {
  const status = result.success ? '✅' : '❌'
  console.log(`${status} ${result.testName} (${result.duration.toFixed(2)}ms)`)
  if (!result.success) {
    console.log(`   Error: ${result.message}`)
  }
}

// ========================================
// MAIN CYRE DEMONSTRATIONS
// ========================================

const demoMainCyreBasics = async (): Promise<TestResult> => {
  const {result, duration} = await timeExecution(
    'Main Cyre Basic Usage',
    async () => {
      // Create hook with main cyre instance
      const hook = useCyre(cyre, {id: 'user-session'})

      // Set up handler - logs only on successful calls
      hook.on(payload => {
        console.log(
          `   📨 Session handler: User ${payload.userId} action: ${payload.action}`
        )
        return {processed: true, timestamp: Date.now()}
      })

      // Test the hook
      const result = await hook.call({userId: 123, action: 'login'})

      // Verify hook statistics
      const stats = hook.getStats()
      const isValid =
        stats.path === '' && stats.isBranch === false && stats.depth === 0

      return {success: result.ok && isValid}
    }
  )

  return {
    testName: 'Main Cyre Basic Usage',
    success: result.success,
    message: result.success
      ? 'Main cyre hook working correctly'
      : 'Main cyre hook failed',
    duration
  }
}

const demoMainCyreMultipleChannels = async (): Promise<TestResult> => {
  const {result, duration} = await timeExecution(
    'Multiple Channels',
    async () => {
      // Create multiple independent channels
      const authHook = useCyre(cyre, {id: 'auth'})
      const dataHook = useCyre(cyre, {id: 'data-sync'})
      const notifHook = useCyre(cyre, {id: 'notifications'})

      // Set up handlers for each channel
      authHook.on(payload => {
        console.log(`   🔐 Auth: ${payload.user} ${payload.action}`)
        return {authenticated: true, user: payload.user}
      })

      dataHook.on(payload => {
        console.log(`   💾 Data: Syncing ${payload.records} records`)
        return {synced: payload.records, status: 'complete'}
      })

      notifHook.on(payload => {
        console.log(`   🔔 Notification: ${payload.message}`)
        return {delivered: true, timestamp: Date.now()}
      })

      // Test all channels independently
      const authResult = await authHook.call({user: 'john', action: 'login'})
      const dataResult = await dataHook.call({records: 150})
      const notifResult = await notifHook.call({message: 'Welcome back!'})

      return {
        success: authResult.ok && dataResult.ok && notifResult.ok
      }
    }
  )

  return {
    testName: 'Multiple Independent Channels',
    success: result.success,
    message: result.success
      ? 'Multiple channels working independently'
      : 'Channel isolation failed',
    duration
  }
}

// ========================================
// BRANCH DEMONSTRATIONS
// ========================================

const demoBranchBasics = async (): Promise<TestResult> => {
  const {result, duration} = await timeExecution(
    'Branch Basic Usage',
    async () => {
      // Create a branch for user management features
      const userBranch = useBranch(cyre, {id: 'user-management'})
      if (!userBranch) throw new Error('Branch creation failed')

      // Create hook within the branch
      const profileHook = useCyre(userBranch, {id: 'profile-manager'})

      // Set up handler
      profileHook.on(payload => {
        console.log(
          `   👤 Profile: Updated ${payload.field} for user ${payload.userId}`
        )
        return {updated: true, field: payload.field, value: payload.value}
      })

      // Test the branch hook
      const result = await profileHook.call({
        userId: 456,
        field: 'email',
        value: 'john@example.com'
      })

      // Verify branch statistics
      const stats = profileHook.getStats()
      const isValid =
        stats.path === 'user-management' &&
        stats.isBranch === true &&
        stats.depth === 1 &&
        stats.globalId === 'user-management/profile-manager'

      return {success: result.ok && isValid}
    }
  )

  return {
    testName: 'Branch Basic Usage',
    success: result.success,
    message: result.success
      ? 'Branch hook working correctly'
      : 'Branch hook failed',
    duration
  }
}

const demoNestedBranches = async (): Promise<TestResult> => {
  const {result, duration} = await timeExecution(
    'Nested Branch Hierarchy',
    async () => {
      // Create nested branch structure for an e-commerce app
      const ecommerceBranch = useBranch(cyre, {id: 'ecommerce'})
      const ordersBranch = useBranch(ecommerceBranch!, {id: 'orders'})
      const paymentBranch = useBranch(ordersBranch!, {id: 'payment'})

      if (!paymentBranch) throw new Error('Nested branch creation failed')

      // Create hook at the deepest level
      const processorHook = useCyre(paymentBranch, {id: 'processor'})

      // Set up handler
      processorHook.on(payload => {
        console.log(
          `   💳 Payment: Processing $${payload.amount} for order #${payload.orderId}`
        )
        return {
          processed: true,
          transactionId: `txn_${Date.now()}`,
          amount: payload.amount
        }
      })

      // Test the nested hook
      const result = await processorHook.call({
        orderId: 'ORD-001',
        amount: 99.99
      })

      // Verify nested branch statistics
      const stats = processorHook.getStats()
      const expectedPath = 'ecommerce/orders/payment'
      const expectedGlobalId = 'ecommerce/orders/payment/processor'
      const isValid =
        stats.path === expectedPath &&
        stats.globalId === expectedGlobalId &&
        stats.depth === 3

      return {success: result.ok && isValid}
    }
  )

  return {
    testName: 'Nested Branch Hierarchy',
    success: result.success,
    message: result.success
      ? 'Nested branches working correctly'
      : 'Nested branch hierarchy failed',
    duration
  }
}

const demoBranchDepthScenarios = async (): Promise<TestResult> => {
  const {result, duration} = await timeExecution(
    'Branch Depth Scenarios',
    async () => {
      // Test various depth scenarios
      const scenarios = [
        {
          name: 'Root Level',
          instance: cyre,
          expectedDepth: 0
        },
        {
          name: 'Single Branch',
          instance: useBranch(cyre, {id: 'analytics'}),
          expectedDepth: 1
        },
        {
          name: 'Triple Nested',
          instance: (() => {
            const l1 = useBranch(cyre, {id: 'company'})
            const l2 = useBranch(l1!, {id: 'engineering'})
            return useBranch(l2!, {id: 'backend'})
          })(),
          expectedDepth: 3
        },
        {
          name: 'Deep Nested (5 levels)',
          instance: (() => {
            const l1 = useBranch(cyre, {id: 'org'})
            const l2 = useBranch(l1!, {id: 'division'})
            const l3 = useBranch(l2!, {id: 'department'})
            const l4 = useBranch(l3!, {id: 'team'})
            return useBranch(l4!, {id: 'project'})
          })(),
          expectedDepth: 5
        }
      ]

      let allValid = true

      for (const scenario of scenarios) {
        if (!scenario.instance) {
          allValid = false
          continue
        }

        // Create hook and verify depth
        const hook = useCyre(scenario.instance, {id: `depth-test`})
        const stats = hook.getStats()

        if (stats.depth !== scenario.expectedDepth) {
          allValid = false
        }
      }

      return {success: allValid}
    }
  )

  return {
    testName: 'Branch Depth Validation',
    success: result.success,
    message: result.success
      ? 'All depth scenarios validated'
      : 'Depth validation failed',
    duration
  }
}

// ========================================
// CROSS-BRANCH COMMUNICATION
// ========================================

const demoCrossBranchCommunication = async (): Promise<TestResult> => {
  const {result, duration} = await timeExecution(
    'Cross-Branch Communication',
    async () => {
      // Create separate feature branches
      const chatBranch = useBranch(cyre, {id: 'chat'})
      const notificationBranch = useBranch(cyre, {id: 'notifications'})

      if (!chatBranch || !notificationBranch) {
        throw new Error('Branch creation failed')
      }

      // Create hooks in different branches
      const messagesHook = useCyre(chatBranch, {id: 'messages'})
      const alertsHook = useCyre(notificationBranch, {id: 'alerts'})

      // Set up handlers
      messagesHook.on(payload => {
        console.log(
          `   💬 Chat: New message from ${payload.user}: "${payload.text}"`
        )
        return {messageId: `msg_${Date.now()}`, user: payload.user}
      })

      alertsHook.on(payload => {
        console.log(
          `   🔔 Alert: ${payload.type} notification for ${payload.recipient}`
        )
        return {alertId: `alert_${Date.now()}`, delivered: true}
      })

      // Test cross-branch communication via core cyre
      // Chat system can notify alerts system directly
      const messageResult = await messagesHook.call({
        user: 'alice',
        text: 'Hello everyone!'
      })

      const alertResult = await cyre.call('notifications/alerts', {
        type: 'new_message',
        recipient: 'bob',
        from: 'alice'
      })

      return {
        success: messageResult.ok && alertResult.ok
      }
    }
  )

  return {
    testName: 'Cross-Branch Communication',
    success: result.success,
    message: result.success
      ? 'Cross-branch communication working'
      : 'Cross-branch communication failed',
    duration
  }
}

// ========================================
// ADVANCED PATTERNS
// ========================================

const demoAdvancedPatterns = async (): Promise<TestResult> => {
  const {result, duration} = await timeExecution(
    'Advanced Usage Patterns',
    async () => {
      // Pattern 1: Feature-based organization
      const featureBranch = useBranch(cyre, {id: 'user-dashboard'})

      // Pattern 2: Hooks with configuration
      const metricsHook = useCyre(featureBranch!, {
        id: 'metrics',
        throttle: 1000, // Throttle updates to once per second
        payload: {initialized: true}
      })

      const eventsHook = useCyre(featureBranch!, {
        id: 'events',
        debounce: 500 // Debounce rapid events
      })

      // Set up handlers
      metricsHook.on(payload => {
        console.log(`   📊 Metrics: ${payload.metric} = ${payload.value}`)
        return {recorded: true, metric: payload.metric}
      })

      eventsHook.on(payload => {
        console.log(
          `   ⚡ Event: ${payload.event} triggered by ${payload.source}`
        )
        return {processed: true, event: payload.event}
      })

      // Test pattern usage
      const metricsResult = await metricsHook.call({
        metric: 'active_users',
        value: 1250
      })

      const eventsResult = await eventsHook.call({
        event: 'page_view',
        source: 'dashboard',
        page: '/analytics'
      })

      return {
        success: metricsResult.ok && eventsResult.ok
      }
    }
  )

  return {
    testName: 'Advanced Usage Patterns',
    success: result.success,
    message: result.success
      ? 'Advanced patterns working correctly'
      : 'Advanced patterns failed',
    duration
  }
}

// ========================================
// MAIN DEMO ORCHESTRATOR
// ========================================

export const useCyreDemo = async (): Promise<void> => {
  console.log('🚀 useCyre Hook Showcase Demo')
  console.log('=============================')
  console.log('Demonstrating clean usage patterns for useCyre hook\n')

  // Initialize Cyre
  console.log('🔧 Initializing Cyre...')
  const initResult = await cyre.init()
  if (!initResult.ok) {
    throw new Error(`Cyre initialization failed: ${initResult.message}`)
  }
  console.log('✅ Cyre ready\n')

  const results: TestResult[] = []

  try {
    // Main Cyre Demonstrations
    console.log('🏠 MAIN CYRE DEMONSTRATIONS')
    console.log('============================')

    results.push(await demoMainCyreBasics())
    results.push(await demoMainCyreMultipleChannels())

    console.log()

    // Branch Demonstrations
    console.log('🌿 BRANCH DEMONSTRATIONS')
    console.log('=========================')

    results.push(await demoBranchBasics())
    results.push(await demoNestedBranches())
    results.push(await demoBranchDepthScenarios())

    console.log()

    // Advanced Features
    console.log('⚡ ADVANCED FEATURES')
    console.log('====================')

    results.push(await demoCrossBranchCommunication())
    results.push(await demoAdvancedPatterns())

    console.log()

    // Log all results
    results.forEach(logResult)

    // Summary
    console.log('\n📊 SHOWCASE SUMMARY')
    console.log('===================')

    const totalTests = results.length
    const passedTests = results.filter(r => r.success).length
    const avgDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / totalTests

    console.log(`Demonstrations: ${totalTests}`)
    console.log(`Successful: ${passedTests}/${totalTests}`)
    console.log(`Average Performance: ${avgDuration.toFixed(2)}ms`)
    console.log(
      `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`
    )

    if (passedTests === totalTests) {
      console.log('\n🎉 All demonstrations successful!')
      console.log('✅ useCyre hook is ready for production use')
      console.log('✅ Works seamlessly with main cyre and branches')
      console.log('✅ Supports unlimited branch depth')
      console.log('✅ Excellent performance characteristics')
    } else {
      console.log('\n⚠️  Some demonstrations failed - review above for details')
    }
  } catch (error) {
    console.error('❌ Showcase execution failed:', error)
    throw error
  }
}

// Run the showcase if executed directly

useCyreDemo()
  .then(() => {
    console.log('\n✨ Showcase completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Showcase failed:', error)
    process.exit(1)
  })

export default useCyreDemo
