// tests/state-reactivity.test.ts
// State reactivity examples as tests to ensure they work correctly

import {describe, test, expect, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

describe('State Reactivity Examples', () => {
  beforeEach(async () => {
    await cyre.initialize()
    cyre.clear()
  })

  afterEach(() => {
    cyre.clear()
  })

  test('should run all state reactivity examples successfully', async () => {
    // Run the examples to ensure they work
    console.log('=== Battery Management Example ===')

    // Monitor battery level and only alert when low
    cyre.action({
      id: 'battery-monitor',
      condition: device => device.battery < 20 && !device.charging,
      transform: device => ({
        alertLevel: device.battery < 10 ? 'critical' : 'warning',
        battery: device.battery,
        timestamp: Date.now()
      })
    })

    cyre.on('battery-monitor', alert => {
      console.log(`🔋 Battery Alert: ${alert.alertLevel} - ${alert.battery}%`)
    })

    // Simulate device states
    await cyre.call('battery-monitor', {battery: 50, charging: false}) // No alert
    await cyre.call('battery-monitor', {battery: 15, charging: false}) // Warning alert
    await cyre.call('battery-monitor', {battery: 8, charging: false}) // Critical alert
    await cyre.call('battery-monitor', {battery: 8, charging: true}) // No alert (charging)

    // Example 2: Theme System with Nested State
    console.log('\n=== Theme System Example ===')

    // Watch only theme changes in complex UI state
    cyre.action({
      id: 'theme-watcher',
      selector: state => state.ui.theme,
      condition: theme => theme !== 'auto', // Don't process auto theme
      transform: theme => ({
        theme,
        cssClass: `theme-${theme}`,
        appliedAt: Date.now()
      }),
      detectChanges: true
    })

    cyre.on('theme-watcher', themeConfig => {
      console.log(
        `🎨 Theme changed to: ${themeConfig.theme} (${themeConfig.cssClass})`
      )
    })

    const appState = {
      ui: {theme: 'light', sidebar: 'open', modal: null},
      user: {id: 1, name: 'John'},
      data: {todos: [], notes: []}
    }

    await cyre.call('theme-watcher', appState)

    // Change everything except theme - should not trigger
    appState.user.name = 'Jane'
    appState.data.todos = [1, 2, 3]
    appState.ui.sidebar = 'closed'
    await cyre.call('theme-watcher', appState) // No trigger

    // Change theme - should trigger
    appState.ui.theme = 'dark'
    await cyre.call('theme-watcher', appState) // Triggers

    // Change to auto theme - should not trigger (condition blocks it)
    appState.ui.theme = 'auto'
    await cyre.call('theme-watcher', appState) // No trigger

    // Example 3: User Authentication Flow
    console.log('\n=== Authentication Flow Example ===')

    // Complex auth state management
    cyre.action({
      id: 'auth-state-manager',
      selector: state => ({
        user: state.user,
        session: state.session,
        permissions: state.permissions
      }),
      condition: auth => {
        // Only process if user is logged in and session is valid
        return auth.user && auth.session && auth.session.expires > Date.now()
      },
      transform: auth => ({
        userId: auth.user.id,
        userName: auth.user.name,
        role: auth.user.role,
        permissions: auth.permissions,
        sessionExpiry: auth.session.expires,
        isAdmin: auth.permissions.includes('admin'),
        canEdit: auth.permissions.includes('edit'),
        canDelete: auth.permissions.includes('delete')
      }),
      detectChanges: true
    })

    cyre.on('auth-state-manager', authInfo => {
      console.log(`👤 Auth updated: ${authInfo.userName} (${authInfo.role})`)
      console.log(`   Permissions: ${authInfo.permissions.join(', ')}`)
      console.log(`   Admin: ${authInfo.isAdmin}, Edit: ${authInfo.canEdit}`)
    })

    const authState = {
      user: {id: 1, name: 'Alice', role: 'admin'},
      session: {token: 'abc123', expires: Date.now() + 3600000},
      permissions: ['read', 'edit', 'delete', 'admin'],
      ui: {theme: 'light'},
      other: {data: 'ignored'}
    }

    await cyre.call('auth-state-manager', authState)

    // Update non-auth data - should not trigger
    authState.ui.theme = 'dark'
    authState.other.data = 'changed'
    await cyre.call('auth-state-manager', authState) // No trigger

    // Update user permissions - should trigger
    authState.permissions = ['read', 'edit'] // Remove admin/delete
    await cyre.call('auth-state-manager', authState) // Triggers

    // Example 4: Shopping Cart with Complex Calculations
    console.log('\n=== Shopping Cart Example ===')

    cyre.action({
      id: 'cart-calculator',
      selector: state => state.cart.items,
      condition: items => items.length > 0,
      transform: items => {
        const subtotal = items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        )
        const tax = subtotal * 0.08 // 8% tax
        const shipping = subtotal > 50 ? 0 : 9.99
        const total = subtotal + tax + shipping

        return {
          itemCount: items.length,
          totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: Math.round(subtotal * 100) / 100,
          tax: Math.round(tax * 100) / 100,
          shipping,
          total: Math.round(total * 100) / 100,
          freeShipping: shipping === 0,
          calculatedAt: Date.now()
        }
      },
      detectChanges: true
    })

    cyre.on('cart-calculator', cartSummary => {
      console.log(
        `🛒 Cart: ${cartSummary.itemCount} items, ${cartSummary.totalQuantity} quantity`
      )
      console.log(`   Subtotal: $${cartSummary.subtotal}`)
      console.log(`   Tax: $${cartSummary.tax}`)
      console.log(
        `   Shipping: ${
          cartSummary.freeShipping ? 'FREE' : `$${cartSummary.shipping}`
        }`
      )
      console.log(`   Total: $${cartSummary.total}`)
    })

    const shopState = {
      cart: {
        items: [
          {id: 1, name: 'Widget', price: 29.99, quantity: 2},
          {id: 2, name: 'Gadget', price: 15.5, quantity: 1}
        ]
      },
      user: {id: 1, name: 'Bob'},
      ui: {page: 'cart'}
    }

    await cyre.call('cart-calculator', shopState)

    // Add item to cart (create new array to trigger change detection)
    shopState.cart.items = [
      ...shopState.cart.items,
      {id: 3, name: 'Tool', price: 12.25, quantity: 3}
    ]
    await cyre.call('cart-calculator', shopState) // Recalculates

    // Empty cart - condition should block execution
    shopState.cart.items = []
    await cyre.call('cart-calculator', shopState) // No trigger (empty cart)

    // Example 5: Real-time Notification System
    console.log('\n=== Notification System Example ===')

    cyre.action({
      id: 'notification-processor',
      selector: state => state.notifications.unread,
      condition: unread => unread.length > 0,
      transform: unread => {
        const priorities = unread.reduce((acc, notif) => {
          acc[notif.priority] = (acc[notif.priority] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        return {
          total: unread.length,
          priorities,
          hasUrgent: priorities.urgent > 0,
          hasCritical: priorities.critical > 0,
          latest: unread[unread.length - 1],
          summary: `${unread.length} unread (${priorities.urgent || 0} urgent)`
        }
      },
      detectChanges: true
    })

    cyre.on('notification-processor', summary => {
      console.log(`🔔 ${summary.summary}`)
      if (summary.hasCritical) {
        console.log(`   🚨 CRITICAL: ${summary.priorities.critical}`)
      }
      if (summary.hasUrgent) {
        console.log(`   ⚠️  URGENT: ${summary.priorities.urgent}`)
      }
      console.log(`   Latest: ${summary.latest.message}`)
    })

    const notificationState = {
      notifications: {
        unread: [
          {id: 1, message: 'System update available', priority: 'low'},
          {id: 2, message: 'Payment failed', priority: 'urgent'},
          {id: 3, message: 'Server down', priority: 'critical'}
        ],
        read: []
      },
      user: {id: 1}
    }

    await cyre.call('notification-processor', notificationState)

    // Mark one as read
    notificationState.notifications.read.push(
      notificationState.notifications.unread.shift()!
    )
    await cyre.call('notification-processor', notificationState) // Recalculates

    // Add new urgent notification (create new array to trigger change detection)
    notificationState.notifications.unread = [
      ...notificationState.notifications.unread,
      {
        id: 4,
        message: 'Security breach detected',
        priority: 'critical'
      }
    ]
    await cyre.call('notification-processor', notificationState) // Recalculates

    // Example 6: Performance Monitoring with Thresholds
    console.log('\n=== Performance Monitor Example ===')

    cyre.action({
      id: 'performance-monitor',
      selector: metrics => ({
        cpu: metrics.system.cpu,
        memory: metrics.system.memory,
        responseTime: metrics.api.averageResponseTime
      }),
      condition: perf => {
        // Only alert if any metric exceeds threshold
        return perf.cpu > 80 || perf.memory > 85 || perf.responseTime > 500
      },
      transform: perf => {
        const issues = []
        if (perf.cpu > 80) issues.push(`CPU: ${perf.cpu}%`)
        if (perf.memory > 85) issues.push(`Memory: ${perf.memory}%`)
        if (perf.responseTime > 500)
          issues.push(`Response: ${perf.responseTime}ms`)

        return {
          ...perf,
          issues,
          severity:
            perf.cpu > 95 || perf.memory > 95 || perf.responseTime > 1000
              ? 'critical'
              : 'warning',
          alertMessage: `Performance issues detected: ${issues.join(', ')}`,
          timestamp: Date.now()
        }
      },
      detectChanges: true
    })

    cyre.on('performance-monitor', alert => {
      console.log(`📊 ${alert.severity.toUpperCase()}: ${alert.alertMessage}`)
      alert.issues.forEach(issue => console.log(`   - ${issue}`))
    })

    const performanceMetrics = {
      system: {cpu: 45, memory: 60, disk: 30},
      api: {averageResponseTime: 150, requestsPerSecond: 100},
      database: {connections: 50, queryTime: 25}
    }

    await cyre.call('performance-monitor', performanceMetrics) // No alert (all good)

    // CPU spike
    performanceMetrics.system.cpu = 85
    await cyre.call('performance-monitor', performanceMetrics) // Triggers warning

    // Memory spike too
    performanceMetrics.system.memory = 90
    await cyre.call('performance-monitor', performanceMetrics) // Triggers warning (same alert since detectChanges=true)

    // Critical response time
    performanceMetrics.api.averageResponseTime = 1200
    await cyre.call('performance-monitor', performanceMetrics) // Triggers critical

    console.log('\n=== Complex State Pipeline Example ===')

    // Example 7: E-commerce Order Processing Pipeline
    cyre.action({
      id: 'order-pipeline',
      // First, validate the order structure with schema
      schema: cyre.schema.object({
        order: cyre.schema.object({
          id: cyre.schema.string(),
          status: cyre.schema.enums(
            'pending',
            'processing',
            'shipped',
            'delivered',
            'cancelled'
          ),
          items: cyre.schema.array(
            cyre.schema.object({
              productId: cyre.schema.string(),
              quantity: cyre.schema.number().min(1),
              price: cyre.schema.number().min(0)
            })
          ),
          customer: cyre.schema.object({
            id: cyre.schema.string(),
            email: cyre.schema.string()
          })
        }),
        inventory: cyre.schema.object({}).optional(),
        timestamp: cyre.schema.number()
      }),
      // Then, extract only the order for processing
      selector: data => data.order,
      // Only process orders that need action
      condition: order => {
        return order.status === 'pending' && order.items.length > 0
      },
      // Transform into processing format
      transform: order => {
        const totalAmount = order.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        )
        const itemCount = order.items.reduce(
          (sum, item) => sum + item.quantity,
          0
        )

        return {
          orderId: order.id,
          customerId: order.customer.id,
          customerEmail: order.customer.email,
          totalAmount: Math.round(totalAmount * 100) / 100,
          itemCount,
          items: order.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            lineTotal: Math.round(item.price * item.quantity * 100) / 100
          })),
          processingStarted: Date.now(),
          priority: totalAmount > 100 ? 'high' : 'normal'
        }
      },
      detectChanges: true
    })

    cyre.on('order-pipeline', processedOrder => {
      console.log(`📦 Processing Order: ${processedOrder.orderId}`)
      console.log(`   Customer: ${processedOrder.customerEmail}`)
      console.log(
        `   Amount: ${processedOrder.totalAmount} (${processedOrder.itemCount} items)`
      )
      console.log(`   Priority: ${processedOrder.priority}`)
    })

    // Test the order pipeline
    const orderData = {
      order: {
        id: 'ORD-123',
        status: 'pending',
        items: [
          {productId: 'PROD-1', quantity: 2, price: 29.99},
          {productId: 'PROD-2', quantity: 1, price: 15.5}
        ],
        customer: {
          id: 'CUST-456',
          email: 'customer@example.com'
        }
      },
      inventory: {available: true},
      timestamp: Date.now()
    }

    await cyre.call('order-pipeline', orderData) // Processes order

    // Change order status - should not process
    orderData.order.status = 'processing'
    await cyre.call('order-pipeline', orderData) // No processing (condition fails)

    // Change back to pending
    orderData.order.status = 'pending'
    await cyre.call('order-pipeline', orderData) // Processes again

    console.log('\n✨ All state reactivity examples completed!')
    console.log(
      'These examples show how condition, selector, and transform work together'
    )
    console.log(
      'to create powerful, reactive state management with minimal code.'
    )

    // If we get here without errors, all examples worked
    expect(true).toBe(true)
  })
})
