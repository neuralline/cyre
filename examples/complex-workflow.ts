// examples/complex-workflow.ts
// Complex orchestration with error handling, retries, and conditions

import {cyre} from '../src'

// Setup e-commerce order processing channels
cyre.action({id: 'order-received', payload: null})
cyre.action({id: 'validate-payment', payload: null})
cyre.action({id: 'check-inventory', payload: null})
cyre.action({id: 'reserve-items', payload: null})
cyre.action({id: 'calculate-shipping', payload: null})
cyre.action({id: 'send-confirmation', payload: null})
cyre.action({id: 'notify-warehouse', payload: null})
cyre.action({id: 'handle-failure', payload: null})
cyre.action({id: 'fraud-check', payload: null})

// Setup handlers with realistic logic
cyre.on('validate-payment', order => {
  const isValid = Math.random() > 0.1 // 90% success rate
  console.log(
    `Payment validation for order ${order.id}: ${
      isValid ? 'SUCCESS' : 'FAILED'
    }`
  )

  if (!isValid) {
    throw new Error('Payment validation failed')
  }

  return {
    valid: true,
    transactionId: `txn_${Date.now()}`,
    amount: order.total
  }
})

cyre.on('check-inventory', order => {
  const hasStock = Math.random() > 0.2 // 80% in stock
  console.log(
    `Inventory check for order ${order.id}: ${
      hasStock ? 'IN STOCK' : 'OUT OF STOCK'
    }`
  )

  if (!hasStock) {
    throw new Error('Insufficient inventory')
  }

  return {
    available: true,
    items: order.items.map(item => ({...item, reserved: true}))
  }
})

cyre.on('reserve-items', order => {
  console.log(`Reserving items for order ${order.id}`)
  return {
    reserved: true,
    reservationId: `res_${Date.now()}`,
    expiresAt: Date.now() + 600000 // 10 minutes
  }
})

cyre.on('fraud-check', order => {
  const isSafe = Math.random() > 0.05 // 95% pass fraud check
  console.log(
    `Fraud check for order ${order.id}: ${isSafe ? 'SAFE' : 'FLAGGED'}`
  )

  if (!isSafe) {
    throw new Error('Order flagged for fraud')
  }

  return {
    fraudScore: Math.random() * 0.1,
    status: 'safe'
  }
})

cyre.on('calculate-shipping', order => {
  console.log(`Calculating shipping for order ${order.id}`)
  return {
    cost: 15.99,
    method: 'standard',
    estimatedDays: 3
  }
})

cyre.on('send-confirmation', data => {
  console.log(`Sending confirmation email for order ${data.order.id}`)
  return {
    sent: true,
    emailId: `email_${Date.now()}`,
    recipient: data.order.customerEmail
  }
})

cyre.on('notify-warehouse', order => {
  console.log(`Notifying warehouse about order ${order.id}`)
  return {
    notified: true,
    warehouseId: 'wh_001',
    picklistId: `pick_${Date.now()}`
  }
})

cyre.on('handle-failure', error => {
  console.log('Handling order failure:', error)
  return {
    handled: true,
    refundInitiated: true,
    customerNotified: true
  }
})

// Create complex order processing orchestration
const orderProcessingOrchestration = cyre.orchestration.create({
  id: 'order-processing-workflow',
  name: 'E-commerce Order Processing',

  triggers: [
    {
      name: 'new-order',
      type: 'channel',
      channels: 'order-received',
      condition: payload => payload && payload.id && payload.total > 0
    }
  ],

  workflow: [
    {
      name: 'fraud-detection',
      type: 'action',
      targets: 'fraud-check',
      payload: context => context.trigger.payload,
      timeout: 5000,
      retries: 2,
      onError: 'continue'
    },
    {
      name: 'payment-and-inventory-check',
      type: 'parallel',
      steps: [
        {
          name: 'validate-payment',
          type: 'action',
          targets: 'validate-payment',
          payload: context => context.trigger.payload,
          timeout: 10000,
          retries: 3,
          onError: [
            {
              name: 'payment-failure-handling',
              type: 'action',
              targets: 'handle-failure',
              payload: context => ({
                orderId: context.trigger.payload.id,
                reason: 'payment_failed',
                timestamp: Date.now()
              })
            }
          ]
        },
        {
          name: 'check-inventory',
          type: 'action',
          targets: 'check-inventory',
          payload: context => context.trigger.payload,
          timeout: 5000,
          retries: 2,
          onError: [
            {
              name: 'inventory-failure-handling',
              type: 'action',
              targets: 'handle-failure',
              payload: context => ({
                orderId: context.trigger.payload.id,
                reason: 'inventory_insufficient',
                timestamp: Date.now()
              })
            }
          ]
        }
      ]
    },
    {
      name: 'check-parallel-success',
      type: 'condition',
      condition: context => {
        // Find the parallel step results
        const parallelStep = context.stepHistory.find(
          s => s.stepName === 'payment-and-inventory-check'
        )
        if (!parallelStep || !parallelStep.success) {
          console.log('Parallel step failed or not found')
          return false
        }

        // Check individual step results within parallel execution
        const paymentSuccess = context.stepHistory.some(
          s => s.stepName === 'validate-payment' && s.success
        )
        const inventorySuccess = context.stepHistory.some(
          s => s.stepName === 'check-inventory' && s.success
        )

        console.log(
          `Payment success: ${paymentSuccess}, Inventory success: ${inventorySuccess}`
        )
        return paymentSuccess && inventorySuccess
      },
      steps: [
        {
          name: 'reserve-inventory',
          type: 'action',
          targets: 'reserve-items',
          payload: context => context.trigger.payload
        },
        {
          name: 'calculate-shipping-cost',
          type: 'action',
          targets: 'calculate-shipping',
          payload: context => context.trigger.payload
        },
        {
          name: 'finalize-order',
          type: 'sequential',
          steps: [
            {
              name: 'send-customer-confirmation',
              type: 'action',
              targets: 'send-confirmation',
              payload: context => ({
                order: context.trigger.payload,
                payment: context.stepHistory.find(
                  s => s.stepName === 'validate-payment'
                )?.result,
                shipping: context.stepHistory.find(
                  s => s.stepName === 'calculate-shipping-cost'
                )?.result
              })
            },
            {
              name: 'notify-fulfillment',
              type: 'action',
              targets: 'notify-warehouse',
              payload: context => context.trigger.payload
            }
          ]
        }
      ]
    },
    {
      name: 'order-processing-delay',
      type: 'delay',
      timeout: 2000
    }
  ],

  errorHandling: {
    retries: 3,
    timeout: 60000,
    fallback: 'handle-failure',
    notifications: ['handle-failure']
  },

  monitoring: {
    trackMetrics: ['execution_time', 'success_rate', 'step_failures'],
    alerts: [
      {
        condition: metrics => metrics.failedExecutions > 5,
        action: 'handle-failure',
        cooldown: 300000 // 5 minutes
      }
    ]
  }
})

// Test the complex orchestration
if (orderProcessingOrchestration.ok) {
  console.log('Order processing orchestration created')

  const startResult = cyre.orchestration.start('order-processing-workflow')
  if (startResult.ok) {
    console.log('Order processing orchestration started')

    // Simulate multiple orders
    const orders = [
      {
        id: 'ORD001',
        customerEmail: 'customer1@example.com',
        total: 299.99,
        items: [{id: 'ITEM1', quantity: 2, price: 149.99}]
      },
      {
        id: 'ORD002',
        customerEmail: 'customer2@example.com',
        total: 49.99,
        items: [{id: 'ITEM2', quantity: 1, price: 49.99}]
      },
      {
        id: 'ORD003',
        customerEmail: 'customer3@example.com',
        total: 899.99,
        items: [{id: 'ITEM3', quantity: 1, price: 899.99}]
      }
    ]

    // Process orders with delays
    orders.forEach((order, index) => {
      setTimeout(() => {
        console.log(`\n--- Processing Order ${order.id} ---`)
        cyre.call('order-received', order)
      }, index * 3000)
    })

    // Stop orchestration after processing all orders
    setTimeout(() => {
      const stopResult = cyre.orchestration.stop('order-processing-workflow')
      console.log(
        '\nOrder processing orchestration stopped:',
        stopResult.message
      )

      // Show final metrics
      const orchestration = cyre.orchestration.get('order-processing-workflow')
      if (orchestration) {
        console.log('\nFinal Orchestration Metrics:')
        console.log(
          '- Total Executions:',
          orchestration.metrics.totalExecutions
        )
        console.log('- Successful:', orchestration.metrics.successfulExecutions)
        console.log('- Failed:', orchestration.metrics.failedExecutions)
        console.log(
          '- Avg Execution Time:',
          orchestration.metrics.averageExecutionTime.toFixed(2),
          'ms'
        )
        console.log(
          '- Success Rate:',
          (
            (orchestration.metrics.successfulExecutions /
              orchestration.metrics.totalExecutions) *
            100
          ).toFixed(1),
          '%'
        )
      }
    }, 15000)
  }
} else {
  console.error(
    'Failed to create order processing orchestration:',
    orderProcessingOrchestration.message
  )
}
