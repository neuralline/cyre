// examples/state-reactivity-examples.ts
// Real-world examples of state reactivity features

import {cyre} from '../src/app'

/*

      C.Y.R.E - S.T.A.T.E - E.X.A.M.P.L.E.S
      
      Real-world examples showing how to use:
      - condition: when to execute
      - selector: what data to watch
      - transform: how to process data
      - Combined patterns for complex state management

*/

// Initialize Cyre
await cyre.init()

// Example 1: Battery Management System
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

// Add item to cart
shopState.cart.items.push({id: 3, name: 'Tool', price: 12.25, quantity: 3})
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

// Add new urgent notification
notificationState.notifications.unread.push({
  id: 4,
  message: 'Security breach detected',
  priority: 'critical'
})
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
    if (perf.responseTime > 500) issues.push(`Response: ${perf.responseTime}ms`)

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
          quantity: cyre.schema.number(),
          price: cyre.schema.number()
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
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

    order.items.forEach(item => {
      if (item.quantity < 1) {
        throw new Error('Quantity must be at least 1')
      }
      if (item.price < 0) {
        throw new Error('Price must be at least 0')
      }
    })

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

console.log('\n=== State Aggregation Example ===')

// Example 8: Dashboard Data Aggregation
cyre.action({
  id: 'dashboard-aggregator',
  selector: appState => ({
    users: appState.users.active,
    orders: appState.orders.recent,
    revenue: appState.analytics.revenue,
    system: appState.system.health
  }),
  condition: data => {
    // Only update dashboard if we have meaningful data
    return data.users.length > 0 || data.orders.length > 0
  },
  transform: data => {
    const activeUsers = data.users.length
    const todayOrders = data.orders.filter(
      order => order.createdAt > Date.now() - 24 * 60 * 60 * 1000
    ).length

    const todayRevenue = data.orders
      .filter(order => order.createdAt > Date.now() - 24 * 60 * 60 * 1000)
      .reduce((sum, order) => sum + order.amount, 0)

    return {
      summary: {
        activeUsers,
        todayOrders,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        systemHealth: data.system.status
      },
      trends: {
        userGrowth: activeUsers > 100 ? 'up' : 'stable',
        orderVolume: todayOrders > 50 ? 'high' : 'normal',
        revenueTarget: todayRevenue > 1000 ? 'above' : 'below'
      },
      alerts: {
        lowUsers: activeUsers < 10,
        noOrders: todayOrders === 0,
        systemIssues: data.system.status !== 'healthy'
      },
      lastUpdated: Date.now()
    }
  },
  detectChanges: true
})

cyre.on('dashboard-aggregator', dashboard => {
  console.log(`📊 Dashboard Update:`)
  console.log(
    `   Users: ${dashboard.summary.activeUsers} (${dashboard.trends.userGrowth})`
  )
  console.log(
    `   Orders: ${dashboard.summary.todayOrders} (${dashboard.trends.orderVolume})`
  )
  console.log(
    `   Revenue: ${dashboard.summary.todayRevenue} (${dashboard.trends.revenueTarget} target)`
  )
  console.log(`   System: ${dashboard.summary.systemHealth}`)

  if (dashboard.alerts.lowUsers) console.log(`   ⚠️  Low user count`)
  if (dashboard.alerts.noOrders) console.log(`   ⚠️  No orders today`)
  if (dashboard.alerts.systemIssues) console.log(`   🚨 System issues detected`)
})

const dashboardState = {
  users: {
    active: Array.from({length: 150}, (_, i) => ({id: i, name: `User${i}`})),
    inactive: []
  },
  orders: {
    recent: [
      {id: 'O1', amount: 299.99, createdAt: Date.now() - 2 * 60 * 60 * 1000},
      {id: 'O2', amount: 150.5, createdAt: Date.now() - 4 * 60 * 60 * 1000},
      {id: 'O3', amount: 75.25, createdAt: Date.now() - 6 * 60 * 60 * 1000}
    ]
  },
  analytics: {
    revenue: {total: 10000, growth: 0.15}
  },
  system: {
    health: {status: 'healthy', uptime: 99.9}
  },
  ui: {theme: 'light'} // This won't affect dashboard
}

await cyre.call('dashboard-aggregator', dashboardState)

// Update UI (should not trigger dashboard update)
dashboardState.ui.theme = 'dark'
await cyre.call('dashboard-aggregator', dashboardState) // No trigger

// Add new order (should trigger update)
dashboardState.orders.recent.push({
  id: 'O4',
  amount: 500.0,
  createdAt: Date.now() - 1 * 60 * 60 * 1000
})
await cyre.call('dashboard-aggregator', dashboardState) // Triggers

console.log('\n=== State Machine Pattern Example ===')

// Example 9: State Machine with Cyre
const createStateMachine = (
  initialState: string,
  transitions: Record<string, string[]>
) => {
  let currentState = initialState

  cyre.action({
    id: 'state-machine',
    condition: event => {
      const allowedTransitions = transitions[currentState] || []
      return allowedTransitions.includes(event.type)
    },
    transform: event => {
      const oldState = currentState
      currentState = event.newState || currentState

      return {
        event: event.type,
        fromState: oldState,
        toState: currentState,
        data: event.data,
        timestamp: Date.now()
      }
    }
  })

  return {
    transition: (eventType: string, newState: string, data?: any) =>
      cyre.call('state-machine', {type: eventType, newState, data}),
    getCurrentState: () => currentState
  }
}

// Create a simple order state machine
const orderStateMachine = createStateMachine('created', {
  created: ['confirm', 'cancel'],
  confirmed: ['ship', 'cancel'],
  shipped: ['deliver', 'return'],
  delivered: ['return'],
  cancelled: [],
  returned: []
})

cyre.on('state-machine', transition => {
  console.log(
    `🔄 State: ${transition.fromState} → ${transition.toState} (${transition.event})`
  )
})

// Valid transitions
await orderStateMachine.transition('confirm', 'confirmed') // ✅ created → confirmed
await orderStateMachine.transition('ship', 'shipped') // ✅ confirmed → shipped
await orderStateMachine.transition('deliver', 'delivered') // ✅ shipped → delivered

// Invalid transition (will be blocked by condition)
await orderStateMachine.transition('ship', 'shipped') // ❌ delivered → shipped (not allowed)

console.log('\n✨ All state reactivity examples completed!')
console.log(
  'These examples show how condition, selector, and transform work together'
)
console.log('to create powerful, reactive state management with minimal code.')
