// demo/orchestration-demo.ts
// Comprehensive Cyre Orchestration Demo

import cyre from '../src'
import {orchestration} from '../src/orchestration/orchestration-engine'
import type {OrchestrationConfig} from '../src/types/orchestration'

/*

      C.Y.R.E - O.R.C.H.E.S.T.R.A.T.I.O.N - D.E.M.O
      
      Showcasing the power of functional orchestration:
      - E-commerce order processing pipeline
      - Real-time monitoring system  
      - User onboarding workflow
      - System maintenance automation
      - Error handling and recovery patterns

*/

/**
 * Demo: E-commerce Order Processing Pipeline
 * Shows: workflow steps, error handling, monitoring
 */
const createOrderProcessingOrchestration = (): OrchestrationConfig => ({
  id: 'ecommerce-order-pipeline',
  name: 'E-commerce Order Processing',
  description: 'Complete order processing from validation to fulfillment',
  enabled: true,

  triggers: [
    {
      name: 'order-received',
      type: 'channel',
      channels: ['order-submitted', 'cart-checkout'],
      debounce: 500, // Handle rapid submissions
      throttle: 1000, // Rate limiting
      enabled: true
    }
  ],

  workflow: [
    {
      name: 'validate-order',
      type: 'action',
      description: 'Validate order data and inventory',
      targets: ['order-validator', 'inventory-checker'],
      timeout: 5000,
      retries: 2,
      onError: 'abort',
      enabled: true
    },
    {
      name: 'payment-processing',
      type: 'action',
      description: 'Process payment with multiple providers',
      targets: context => {
        // Dynamic target selection based on order amount
        const amount = context.trigger.payload?.amount || 0
        return amount > 1000
          ? ['premium-payment-processor']
          : ['standard-payment-processor']
      },
      payload: context => ({
        ...context.trigger.payload,
        processingMode:
          context.trigger.payload?.amount > 1000 ? 'premium' : 'standard'
      }),
      timeout: 15000,
      retries: 3,
      onError: 'retry',
      enabled: true
    },
    {
      name: 'inventory-reservation',
      type: 'condition',
      description: 'Check if payment succeeded before reserving inventory',
      condition: context => {
        const paymentResult = context.stepHistory.find(
          s => s.stepName === 'payment-processing'
        )
        return (
          paymentResult?.success && paymentResult.result?.status === 'completed'
        )
      },
      onError: 'abort',
      enabled: true
    },
    {
      name: 'parallel-fulfillment',
      type: 'parallel',
      description: 'Execute fulfillment tasks in parallel',
      steps: [
        {
          name: 'reserve-inventory',
          type: 'action',
          targets: ['inventory-manager'],
          enabled: true
        },
        {
          name: 'generate-invoice',
          type: 'action',
          targets: ['invoice-generator'],
          enabled: true
        },
        {
          name: 'notify-warehouse',
          type: 'action',
          targets: ['warehouse-notification'],
          enabled: true
        }
      ],
      onError: 'continue', // Continue even if some tasks fail
      enabled: true
    },
    {
      name: 'confirmation-workflow',
      type: 'sequential',
      description: 'Send confirmations in order',
      steps: [
        {
          name: 'send-customer-confirmation',
          type: 'action',
          targets: ['customer-notification'],
          enabled: true
        },
        {
          name: 'update-analytics',
          type: 'action',
          targets: ['sales-analytics'],
          enabled: true
        }
      ],
      enabled: true
    }
  ],

  errorHandling: {
    retries: 3,
    timeout: 30000,
    fallback: context => {
      // Fallback: Notify customer service for manual handling
      return cyre.call('customer-service-alert', {
        orderId: context.trigger.payload?.orderId,
        error: 'Automated processing failed',
        requiresManualReview: true
      })
    },
    notifications: ['ops-team-alerts'],
    escalation: {
      after: 60000, // 1 minute
      action: 'escalate-to-manager'
    }
  },

  monitoring: {
    trackMetrics: ['execution_time', 'success_rate', 'payment_success_rate'],
    reportTo: 'order-metrics-collector',
    alerts: [
      {
        condition: metrics => metrics.success_rate < 0.95,
        action: 'low-success-rate-alert',
        cooldown: 300000, // 5 minutes
        severity: 'high'
      }
    ],
    healthChecks: [
      {
        interval: 30000,
        timeout: 5000,
        condition: context => cyre.call('payment-processor-health'),
        onFailure: 'payment-system-down-alert'
      }
    ]
  },

  timeout: 60000, // 1 minute total timeout
  priority: 'high'
})

/**
 * Demo: Real-time Monitoring System
 * Shows: time-based triggers, condition triggers, system integration
 */
const createMonitoringOrchestration = (): OrchestrationConfig => ({
  id: 'realtime-monitoring-system',
  name: 'Real-time System Monitoring',
  description: 'Continuous monitoring with adaptive responses',
  enabled: true,

  triggers: [
    {
      name: 'periodic-health-check',
      type: 'time',
      interval: 10000, // Every 10 seconds
      repeat: true,
      enabled: true
    },
    {
      name: 'error-spike-detection',
      type: 'condition',
      condition: async (payload, context) => {
        const errorRate = await cyre.call('get-error-rate')
        return errorRate.result > 0.05 // Trigger if error rate > 5%
      },
      debounce: 5000, // Don't trigger too frequently
      enabled: true
    },
    {
      name: 'manual-system-check',
      type: 'external', // Triggered via API
      enabled: true
    }
  ],

  workflow: [
    {
      name: 'collect-system-metrics',
      type: 'parallel',
      description: 'Gather metrics from all system components',
      steps: [
        {
          name: 'cpu-metrics',
          type: 'action',
          targets: ['cpu-monitor'],
          enabled: true
        },
        {
          name: 'memory-metrics',
          type: 'action',
          targets: ['memory-monitor'],
          enabled: true
        },
        {
          name: 'disk-metrics',
          type: 'action',
          targets: ['disk-monitor'],
          enabled: true
        },
        {
          name: 'network-metrics',
          type: 'action',
          targets: ['network-monitor'],
          enabled: true
        }
      ],
      timeout: 10000,
      enabled: true
    },
    {
      name: 'analyze-system-health',
      type: 'action',
      description: 'Analyze collected metrics for anomalies',
      targets: ['health-analyzer'],
      payload: context => {
        // Aggregate metrics from parallel collection
        const metricsStep = context.stepHistory.find(
          s => s.stepName === 'collect-system-metrics'
        )
        return {
          timestamp: Date.now(),
          metrics: metricsStep?.result,
          triggerType: context.trigger.type
        }
      },
      enabled: true
    },
    {
      name: 'adaptive-response',
      type: 'condition',
      description: 'Take action based on health analysis',
      condition: context => {
        const analysis = context.stepHistory.find(
          s => s.stepName === 'analyze-system-health'
        )
        return analysis?.result?.healthScore < 0.8 // Unhealthy system
      },
      steps: [
        {
          name: 'emergency-scaling',
          type: 'action',
          targets: ['auto-scaler'],
          enabled: true
        },
        {
          name: 'alert-ops-team',
          type: 'action',
          targets: ['ops-alerts'],
          enabled: true
        }
      ],
      onError: 'continue',
      enabled: true
    }
  ],

  conditions: {
    'critical-cpu': context => {
      const cpuMetrics = context.variables.cpuUsage
      return cpuMetrics > 90
    },
    'memory-pressure': context => {
      const memoryMetrics = context.variables.memoryUsage
      return memoryMetrics > 85
    }
  },

  monitoring: {
    trackMetrics: ['response_time', 'system_health_score', 'alert_frequency'],
    alerts: [
      {
        condition: metrics => metrics.system_health_score < 0.5,
        action: 'critical-system-alert',
        severity: 'critical'
      }
    ]
  }
})

/**
 * Demo: User Onboarding Workflow
 * Shows: sequential steps, delays, external integrations
 */
const createUserOnboardingOrchestration = (): OrchestrationConfig => ({
  id: 'user-onboarding-workflow',
  name: 'User Onboarding Journey',
  description: 'Automated user onboarding with personalized experience',
  enabled: true,

  triggers: [
    {
      name: 'user-registered',
      type: 'channel',
      channels: ['user-signup', 'user-created'],
      enabled: true
    }
  ],

  workflow: [
    {
      name: 'welcome-sequence',
      type: 'sequential',
      description: 'Send welcome messages with timing',
      steps: [
        {
          name: 'immediate-welcome',
          type: 'action',
          targets: ['welcome-email-sender'],
          payload: context => ({
            userId: context.trigger.payload?.userId,
            template: 'immediate-welcome',
            personalData: context.trigger.payload
          }),
          enabled: true
        },
        {
          name: 'welcome-delay',
          type: 'delay',
          timeout: 3600000, // 1 hour delay
          enabled: true
        },
        {
          name: 'onboarding-tips',
          type: 'action',
          targets: ['tips-email-sender'],
          payload: context => ({
            userId: context.trigger.payload?.userId,
            template: 'onboarding-tips'
          }),
          enabled: true
        }
      ],
      enabled: true
    },
    {
      name: 'account-setup',
      type: 'parallel',
      description: 'Set up user account and integrations',
      steps: [
        {
          name: 'create-user-profile',
          type: 'action',
          targets: ['profile-creator'],
          enabled: true
        },
        {
          name: 'setup-preferences',
          type: 'action',
          targets: ['preference-manager'],
          enabled: true
        },
        {
          name: 'generate-api-keys',
          type: 'action',
          targets: ['api-key-generator'],
          enabled: true
        }
      ],
      enabled: true
    },
    {
      name: 'personalization-loop',
      type: 'loop',
      description: 'Send personalized content over time',
      steps: [
        {
          name: 'check-engagement',
          type: 'action',
          targets: ['engagement-tracker'],
          enabled: true
        },
        {
          name: 'send-personalized-content',
          type: 'condition',
          condition: context => {
            // Send content if user is engaged
            const engagement = context.variables.engagementScore || 0
            return engagement > 0.3
          },
          steps: [
            {
              name: 'content-delivery',
              type: 'action',
              targets: ['personalized-content-sender'],
              enabled: true
            }
          ],
          enabled: true
        },
        {
          name: 'loop-delay',
          type: 'delay',
          timeout: 86400000, // 24 hours
          enabled: true
        }
      ],
      enabled: true
    }
  ],

  errorHandling: {
    retries: 2,
    timeout: 120000, // 2 minutes
    notifications: ['onboarding-team-alerts']
  }
})

/**
 * Demo: System Maintenance Automation
 * Shows: complex conditions, system integration, maintenance patterns
 */
const createMaintenanceOrchestration = (): OrchestrationConfig => ({
  id: 'automated-maintenance-system',
  name: 'Automated System Maintenance',
  description: 'Smart maintenance scheduling based on system load',
  enabled: true,

  triggers: [
    {
      name: 'maintenance-window',
      type: 'time',
      interval: 3600000, // Every hour, check if maintenance needed
      repeat: true,
      enabled: true
    },
    {
      name: 'emergency-maintenance',
      type: 'condition',
      condition: async (payload, context) => {
        const systemHealth = await cyre.call('system-health-check')
        return systemHealth.result?.needsEmergencyMaintenance === true
      },
      enabled: true
    }
  ],

  workflow: [
    {
      name: 'maintenance-eligibility-check',
      type: 'condition',
      description: 'Check if system can enter maintenance mode',
      condition: async context => {
        const [load, activeUsers, criticalJobs] = await Promise.all([
          cyre.call('get-system-load'),
          cyre.call('get-active-users'),
          cyre.call('get-critical-jobs')
        ])

        // Only proceed if system load is low
        return (
          load.result < 0.3 &&
          activeUsers.result < 10 &&
          criticalJobs.result === 0
        )
      },
      onError: 'abort',
      enabled: true
    },
    {
      name: 'pre-maintenance-tasks',
      type: 'sequential',
      description: 'Prepare system for maintenance',
      steps: [
        {
          name: 'notify-maintenance-start',
          type: 'action',
          targets: ['maintenance-notifications'],
          enabled: true
        },
        {
          name: 'graceful-shutdown-prep',
          type: 'action',
          targets: ['shutdown-preparation'],
          enabled: true
        },
        {
          name: 'backup-critical-data',
          type: 'action',
          targets: ['data-backup-service'],
          timeout: 300000, // 5 minutes for backup
          enabled: true
        }
      ],
      enabled: true
    },
    {
      name: 'maintenance-tasks',
      type: 'parallel',
      description: 'Execute maintenance tasks concurrently',
      steps: [
        {
          name: 'clean-temp-files',
          type: 'action',
          targets: ['temp-file-cleaner'],
          enabled: true
        },
        {
          name: 'optimize-database',
          type: 'action',
          targets: ['database-optimizer'],
          enabled: true
        },
        {
          name: 'update-system-packages',
          type: 'action',
          targets: ['package-updater'],
          enabled: true
        },
        {
          name: 'check-disk-health',
          type: 'action',
          targets: ['disk-health-checker'],
          enabled: true
        }
      ],
      timeout: 600000, // 10 minutes for all maintenance
      onError: 'continue', // Continue even if some tasks fail
      enabled: true
    },
    {
      name: 'post-maintenance-verification',
      type: 'sequential',
      description: 'Verify system health after maintenance',
      steps: [
        {
          name: 'system-health-verification',
          type: 'action',
          targets: ['post-maintenance-health-check'],
          enabled: true
        },
        {
          name: 'restart-services',
          type: 'action',
          targets: ['service-restarter'],
          enabled: true
        },
        {
          name: 'notify-maintenance-complete',
          type: 'action',
          targets: ['maintenance-completion-notification'],
          enabled: true
        }
      ],
      enabled: true
    }
  ],

  conditions: {
    'low-system-load': context => context.variables.systemLoad < 0.2,
    'off-peak-hours': context => {
      const hour = new Date().getHours()
      return hour >= 2 && hour <= 6 // 2 AM to 6 AM
    }
  },

  errorHandling: {
    retries: 1,
    timeout: 1800000, // 30 minutes total
    fallback: context => {
      // Emergency rollback if maintenance fails
      return cyre.call('emergency-rollback', {
        maintenanceId: context.orchestrationId,
        timestamp: context.startTime
      })
    },
    escalation: {
      after: 900000, // 15 minutes
      action: 'escalate-maintenance-failure'
    }
  },

  monitoring: {
    trackMetrics: [
      'maintenance_duration',
      'maintenance_success_rate',
      'system_recovery_time'
    ],
    healthChecks: [
      {
        interval: 60000,
        timeout: 10000,
        condition: context => cyre.call('verify-system-operational'),
        onFailure: 'system-not-operational-alert'
      }
    ]
  },

  priority: 'medium'
})

/**
 * Demo orchestration registration and execution
 */
export const runOrchestrationDemo = async () => {
  console.log('\n🎭 CYRE ORCHESTRATION DEMO')
  console.log('===========================')

  // Initialize Cyre
  cyre.initialize()

  // Register all demo channels for complete workflow execution
  const demoChannels = [
    // Order processing channels
    'order-validator',
    'inventory-checker',
    'standard-payment-processor',
    'premium-payment-processor',
    'inventory-manager',
    'invoice-generator',
    'warehouse-notification',
    'customer-notification',
    'sales-analytics',
    'customer-service-alert',
    'escalate-to-manager',
    'order-metrics-collector',
    'payment-processor-health',
    'low-success-rate-alert',
    'payment-system-down-alert',

    // Monitoring channels
    'cpu-monitor',
    'memory-monitor',
    'disk-monitor',
    'network-monitor',
    'health-analyzer',
    'auto-scaler',
    'ops-alerts',
    'get-error-rate',
    'get-system-load',
    'get-active-users',
    'get-critical-jobs',
    'critical-system-alert',

    // Onboarding channels
    'welcome-email-sender',
    'tips-email-sender',
    'profile-creator',
    'preference-manager',
    'api-key-generator',
    'engagement-tracker',
    'personalized-content-sender',
    'onboarding-team-alerts',

    // Maintenance channels
    'system-health-check',
    'maintenance-notifications',
    'shutdown-preparation',
    'data-backup-service',
    'temp-file-cleaner',
    'database-optimizer',
    'package-updater',
    'disk-health-checker',
    'post-maintenance-health-check',
    'service-restarter',
    'maintenance-completion-notification',
    'emergency-rollback',
    'escalate-maintenance-failure',
    'verify-system-operational',
    'system-not-operational-alert'
  ]

  demoChannels.forEach(channelId => {
    cyre.action({
      id: channelId,
      tags: ['demo', 'orchestration']
    })

    cyre.on(channelId, payload => {
      console.log(`📡 ${channelId} executed with:`, payload)
      return {
        ok: true,
        result: `${channelId} completed successfully`,
        timestamp: Date.now()
      }
    })
  })

  // Create orchestrations
  const orchestrations = [
    createOrderProcessingOrchestration(),
    createMonitoringOrchestration(),
    createUserOnboardingOrchestration(),
    createMaintenanceOrchestration()
  ]

  console.log('\n🏗️  Creating orchestrations...')
  orchestrations.forEach(config => {
    const result = orchestration.keep(config)
    console.log(
      `   ${result.ok ? '✅' : '❌'} ${config.name}: ${result.message}`
    )
  })

  console.log('\n🚀 Activating orchestrations...')
  orchestrations.forEach(config => {
    const result = orchestration.activate(config.id, true)
    console.log(
      `   ${result.ok ? '✅' : '❌'} ${config.name}: ${result.message}`
    )
  })

  console.log('\n🧪 Testing manual calls...')

  // Test order processing
  console.log('\n📦 Testing Order Processing:')
  const orderResult = await orchestration.call('ecommerce-order-pipeline', {
    orderId: 'ORDER-12345',
    amount: 599.99,
    items: ['laptop', 'mouse'],
    customerId: 'CUSTOMER-789'
  })
  console.log(
    `   Order processing: ${orderResult.ok ? '✅' : '❌'} ${
      orderResult.message
    }`
  )

  // Test user onboarding
  console.log('\n👋 Testing User Onboarding:')
  const onboardingResult = await orchestration.call(
    'user-onboarding-workflow',
    {
      userId: 'USER-456',
      email: 'alice@example.com',
      name: 'Alice Johnson',
      signupSource: 'demo'
    }
  )
  console.log(
    `   User onboarding: ${onboardingResult.ok ? '✅' : '❌'} ${
      onboardingResult.message
    }`
  )

  // Test monitoring system
  console.log('\n📊 Testing Manual Health Check:')
  const monitoringResult = await orchestration.call(
    'realtime-monitoring-system',
    {
      triggeredBy: 'demo',
      timestamp: Date.now()
    }
  )
  console.log(
    `   Health check: ${monitoringResult.ok ? '✅' : '❌'} ${
      monitoringResult.message
    }`
  )

  console.log('\n📈 System Overview:')
  const overview = orchestration.getSystemOverview()
  console.log(`   Total orchestrations: ${overview.total.orchestrations}`)
  console.log(`   Running orchestrations: ${overview.total.running}`)
  console.log(`   Active triggers: ${overview.total.activeTriggers}`)

  console.log('\n🎉 Demo completed! Orchestrations are now running...')
  console.log('   Time-based triggers will execute automatically')
  console.log('   Channel-based triggers will respond to events')
  console.log('   Use orchestration.call() for manual execution')

  return {
    orchestrationsCreated: orchestrations.length,
    overview
  }
}

/**
 * Utility function to deactivate demo orchestrations
 */
export const stopOrchestrationDemo = () => {
  const orchestrationIds = [
    'ecommerce-order-pipeline',
    'realtime-monitoring-system',
    'user-onboarding-workflow',
    'automated-maintenance-system'
  ]

  console.log('\n🛑 Deactivating demo orchestrations...')
  orchestrationIds.forEach(id => {
    const result = orchestration.activate(id, false)
    console.log(
      `   ${result.ok ? '✅' : '❌'} Deactivated ${id}: ${result.message}`
    )
  })
}

// Export demo functions
export {
  createOrderProcessingOrchestration,
  createMonitoringOrchestration,
  createUserOnboardingOrchestration,
  createMaintenanceOrchestration
}

runOrchestrationDemo()
