// orchestration-showcase.ts
// Comprehensive showcase of orchestration integration with Cyre
// Run with: npx ts-node orchestration-showcase.ts

import {cyre} from '../src'
import type {OrchestrationConfig} from '../src/types/orchestration'

/*

      C.Y.R.E - O.R.C.H.E.S.T.R.A.T.I.O.N - S.H.O.W.C.A.S.E
      
      Comprehensive demonstration of orchestration integration:
      - Channel-based triggers with patterns
      - Time-based triggers
      - External manual triggers
      - Complex workflow steps
      - Real-world automation scenarios

*/

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))
const randomBetween = (min: number, max: number): number =>
  Math.random() * (max - min) + min

async function setupDemoSystem(): Promise<void> {
  console.log('🚀 Setting up Orchestration Integration Showcase...\n')

  // Initialize Cyre
  await cyre.init({autoSave: false})

  console.log('📊 Creating sensor system...')

  // Create temperature sensors
  for (let floor = 1; floor <= 3; floor++) {
    const channelId = `sensor-temp-floor-${floor}`

    cyre.action({
      id: channelId,
      payload: {
        temperature: randomBetween(20, 25),
        floor,
        timestamp: Date.now()
      },
      type: 'sensor'
    })

    cyre.on(channelId, (data: any) => {
      console.log(
        `🌡️  Sensor reading: Floor ${data.floor} = ${data.temperature.toFixed(
          1
        )}°C`
      )
      return {processed: true, alert: data.temperature > 26}
    })
  }

  console.log('🔔 Creating alert system...')

  // Create alert channels
  cyre.action({
    id: 'alert-temperature',
    type: 'alert'
  })

  cyre.on('alert-temperature', (data: any) => {
    console.log(`🚨 TEMPERATURE ALERT: ${data.message} (${data.location})`)
    return {alerted: true, timestamp: Date.now()}
  })

  cyre.action({
    id: 'alert-system',
    type: 'alert'
  })

  cyre.on('alert-system', (data: any) => {
    console.log(`⚠️  SYSTEM ALERT: ${data.message}`)
    return {alerted: true, timestamp: Date.now()}
  })

  console.log('📧 Creating notification system...')

  // Create notification channels
  cyre.action({
    id: 'notify-email',
    type: 'notification'
  })

  cyre.on('notify-email', (data: any) => {
    console.log(`📧 EMAIL: ${data.subject} - ${data.body}`)
    return {sent: true, timestamp: Date.now()}
  })

  cyre.action({
    id: 'notify-slack',
    type: 'notification'
  })

  cyre.on('notify-slack', (data: any) => {
    console.log(`💬 SLACK: #${data.channel} - ${data.message}`)
    return {sent: true, timestamp: Date.now()}
  })

  console.log('🎮 Creating user activity system...')

  // Create user activity channels
  cyre.action({
    id: 'user-login',
    type: 'user-activity'
  })

  cyre.on('user-login', (data: any) => {
    console.log(`👤 User login: ${data.userId} from ${data.location}`)
    return {tracked: true, timestamp: Date.now()}
  })

  cyre.action({
    id: 'user-error',
    type: 'user-activity'
  })

  cyre.on('user-error', (data: any) => {
    console.log(`❌ User error: ${data.error} - User: ${data.userId}`)
    return {tracked: true, timestamp: Date.now()}
  })

  console.log('✅ Demo system setup complete!\n')
}

async function demonstrateBasicOrchestration(): Promise<void> {
  console.log('='.repeat(60))
  console.log('🎪 BASIC ORCHESTRATION DEMONSTRATIONS')
  console.log('='.repeat(60))

  // Orchestration 1: Temperature monitoring with workflow
  console.log('🌡️  Demo 1: Temperature monitoring orchestration')

  const tempMonitorConfig: OrchestrationConfig = {
    id: 'temperature-monitor',
    name: 'Temperature Monitoring System',
    triggers: [
      {
        name: 'temp-sensor-trigger',
        type: 'channel',
        channels: ['sensor-temp-*'], // Pattern matching all temperature sensors
        condition: payload => {
          return payload.temperature > 26 // Only trigger if temperature is high
        }
      }
    ],
    workflow: [
      {
        name: 'send-alert',
        type: 'action',
        targets: 'alert-temperature',
        payload: context => ({
          message: `High temperature detected: ${context.trigger.payload?.temperature}°C`,
          location: `Floor ${context.trigger.payload?.floor}`,
          severity: 'high',
          timestamp: Date.now()
        })
      },
      {
        name: 'notify-email',
        type: 'action',
        targets: 'notify-email',
        payload: context => ({
          subject: 'Temperature Alert',
          body: `Temperature on floor ${context.trigger.payload?.floor} is ${context.trigger.payload?.temperature}°C`,
          to: 'admin@company.com'
        })
      }
    ]
  }

  const result1 = cyre.orchestration.create(tempMonitorConfig)
  console.log(`   Create result: ${result1.message}`)

  if (result1.ok) {
    const startResult = cyre.orchestration.start('temperature-monitor')
    console.log(`   Start result: ${startResult.message}`)

    // Trigger with normal temperature (should not trigger orchestration)
    console.log('\n   Testing with normal temperature...')
    await cyre.call('sensor-temp-floor-1', {
      temperature: 23.5,
      floor: 1,
      timestamp: Date.now()
    })
    await sleep(100)

    // Trigger with high temperature (should trigger orchestration)
    console.log(
      '   Testing with high temperature (should trigger orchestration)...'
    )
    await cyre.call('sensor-temp-floor-2', {
      temperature: 27.8,
      floor: 2,
      timestamp: Date.now()
    })
    await sleep(500) // Give orchestration time to execute
  }
  console.log()

  // Orchestration 2: User activity monitoring
  console.log('👤 Demo 2: User activity monitoring orchestration')

  const userMonitorConfig: OrchestrationConfig = {
    id: 'user-activity-monitor',
    name: 'User Activity Monitoring',
    triggers: [
      {
        name: 'user-error-trigger',
        type: 'channel',
        channels: ['user-error']
      }
    ],
    workflow: [
      {
        name: 'log-error',
        type: 'action',
        targets: 'alert-system',
        payload: context => ({
          message: `User error detected: ${context.trigger.payload?.error}`,
          userId: context.trigger.payload?.userId,
          timestamp: Date.now()
        })
      },
      {
        name: 'notify-support',
        type: 'action',
        targets: 'notify-slack',
        payload: context => ({
          channel: 'support',
          message: `User ${context.trigger.payload?.userId} encountered error: ${context.trigger.payload?.error}`,
          priority: 'medium'
        })
      }
    ]
  }

  const result2 = cyre.orchestration.create(userMonitorConfig)
  console.log(`   Create result: ${result2.message}`)

  if (result2.ok) {
    cyre.orchestration.start('user-activity-monitor')

    // Trigger user error
    console.log('\n   Simulating user error...')
    await cyre.call('user-error', {
      userId: 'user-12345',
      error: 'Failed to load dashboard',
      timestamp: Date.now()
    })
    await sleep(300)
  }
  console.log()
}

async function demonstrateAdvancedOrchestration(): Promise<void> {
  console.log('='.repeat(60))
  console.log('🚀 ADVANCED ORCHESTRATION DEMONSTRATIONS')
  console.log('='.repeat(60))

  // Advanced Orchestration: Multi-step workflow with conditions
  console.log('🔧 Demo 3: Multi-step conditional workflow')

  const advancedConfig: OrchestrationConfig = {
    id: 'advanced-monitoring',
    name: 'Advanced System Monitoring',
    triggers: [
      {
        name: 'sensor-pattern-trigger',
        type: 'channel',
        channels: ['sensor-*'], // Match any sensor
        condition: async payload => {
          // Complex condition: trigger if temperature > 25 OR if it's a login from suspicious location
          return (
            (payload.temperature && payload.temperature > 25) ||
            (payload.location && payload.location.includes('unknown'))
          )
        }
      }
    ],
    workflow: [
      {
        name: 'evaluate-severity',
        type: 'condition',
        condition: context => {
          const temp = context.trigger.payload?.temperature
          return temp && temp > 28 // High severity condition
        },
        steps: [
          {
            name: 'high-severity-alert',
            type: 'action',
            targets: 'alert-temperature',
            payload: context => ({
              message: `CRITICAL: Temperature ${context.trigger.payload?.temperature}°C`,
              location: `Floor ${context.trigger.payload?.floor}`,
              severity: 'critical',
              timestamp: Date.now()
            })
          },
          {
            name: 'immediate-notification',
            type: 'parallel',
            steps: [
              {
                name: 'email-admin',
                type: 'action',
                targets: 'notify-email',
                payload: () => ({
                  subject: 'CRITICAL Temperature Alert',
                  body: 'Immediate action required!',
                  to: 'admin@company.com',
                  priority: 'high'
                })
              },
              {
                name: 'slack-alert',
                type: 'action',
                targets: 'notify-slack',
                payload: () => ({
                  channel: 'alerts',
                  message:
                    '🚨 CRITICAL temperature alert! Check sensors immediately.',
                  priority: 'high'
                })
              }
            ]
          }
        ]
      },
      {
        name: 'standard-processing',
        type: 'action',
        targets: 'alert-system',
        payload: context => ({
          message: `Standard alert: ${JSON.stringify(context.trigger.payload)}`,
          source: context.trigger.channelId,
          timestamp: Date.now()
        })
      },
      {
        name: 'wait-before-log',
        type: 'delay',
        timeout: 1000 // Wait 1 second
      },
      {
        name: 'log-completion',
        type: 'action',
        targets: 'notify-slack',
        payload: () => ({
          channel: 'logs',
          message: `✅ Monitoring workflow completed at ${new Date().toLocaleTimeString()}`,
          priority: 'low'
        })
      }
    ]
  }

  const result3 = cyre.orchestration.create(advancedConfig)
  console.log(`   Create result: ${result3.message}`)

  if (result3.ok) {
    cyre.orchestration.start('advanced-monitoring')

    // Test normal temperature (should trigger standard processing)
    console.log('\n   Testing with moderate temperature...')
    await cyre.call('sensor-temp-floor-3', {
      temperature: 26.5,
      floor: 3,
      timestamp: Date.now()
    })
    await sleep(500)

    // Test critical temperature (should trigger high severity path)
    console.log('\n   Testing with critical temperature...')
    await cyre.call('sensor-temp-floor-1', {
      temperature: 29.2,
      floor: 1,
      timestamp: Date.now()
    })
    await sleep(1500) // Wait for delay step + execution
  }
  console.log()
}

async function demonstrateTimeBasedOrchestration(): Promise<void> {
  console.log('='.repeat(60))
  console.log('⏰ TIME-BASED ORCHESTRATION DEMONSTRATIONS')
  console.log('='.repeat(60))

  // Time-based orchestration: Health check every 3 seconds
  console.log('🏥 Demo 4: Periodic health check orchestration')

  const healthCheckConfig: OrchestrationConfig = {
    id: 'health-check',
    name: 'System Health Check',
    triggers: [
      {
        name: 'periodic-health-check',
        type: 'time',
        interval: 3000 // Every 3 seconds
      }
    ],
    workflow: [
      {
        name: 'check-sensors',
        type: 'action',
        targets: context => {
          // Dynamic targets - check all temperature sensors
          return [
            'sensor-temp-floor-1',
            'sensor-temp-floor-2',
            'sensor-temp-floor-3'
          ]
        },
        payload: () => ({
          healthCheck: true,
          timestamp: Date.now()
        })
      },
      {
        name: 'report-status',
        type: 'action',
        targets: 'notify-slack',
        payload: context => ({
          channel: 'monitoring',
          message: `🏥 Health check completed at ${new Date().toLocaleTimeString()} - All sensors checked`,
          priority: 'low'
        })
      }
    ]
  }

  const result4 = cyre.orchestration.create(healthCheckConfig)
  console.log(`   Create result: ${result4.message}`)

  if (result4.ok) {
    cyre.orchestration.start('health-check')
    console.log('   Health check orchestration started (runs every 3 seconds)')
    console.log('   Waiting 10 seconds to observe periodic execution...')

    // Wait and observe periodic execution
    await sleep(10000)

    cyre.orchestration.stop('health-check')
    console.log('   Health check orchestration stopped')
  }
  console.log()
}

async function demonstrateExternalTriggers(): Promise<void> {
  console.log('='.repeat(60))
  console.log('🎯 EXTERNAL TRIGGER DEMONSTRATIONS')
  console.log('='.repeat(60))

  // External trigger orchestration
  console.log('🎮 Demo 5: Manual/external trigger orchestration')

  const manualConfig: OrchestrationConfig = {
    id: 'manual-maintenance',
    name: 'Manual Maintenance Mode',
    triggers: [
      {
        name: 'maintenance-trigger',
        type: 'external'
      }
    ],
    workflow: [
      {
        name: 'announce-maintenance',
        type: 'action',
        targets: 'notify-slack',
        payload: context => ({
          channel: 'general',
          message: `🔧 Maintenance mode activated by: ${
            context.trigger.payload?.operator || 'system'
          }`,
          priority: 'high'
        })
      },
      {
        name: 'disable-alerts',
        type: 'action',
        targets: 'alert-system',
        payload: () => ({
          message: 'Alerts temporarily disabled for maintenance',
          type: 'maintenance-mode',
          timestamp: Date.now()
        })
      },
      {
        name: 'wait-maintenance-window',
        type: 'delay',
        timeout: 2000 // 2 second maintenance window for demo
      },
      {
        name: 'maintenance-complete',
        type: 'action',
        targets: 'notify-slack',
        payload: () => ({
          channel: 'general',
          message: '✅ Maintenance completed - System back to normal operation',
          priority: 'medium'
        })
      }
    ]
  }

  const result5 = cyre.orchestration.create(manualConfig)
  console.log(`   Create result: ${result5.message}`)

  if (result5.ok) {
    cyre.orchestration.start('manual-maintenance')

    // Manually trigger the orchestration
    console.log('\n   Triggering maintenance mode manually...')
    const triggerResult = await cyre.orchestration.trigger(
      'manual-maintenance',
      'maintenance-trigger',
      {
        operator: 'admin-user',
        reason: 'Scheduled weekly maintenance',
        timestamp: Date.now()
      }
    )

    console.log(`   Manual trigger result: ${triggerResult.message}`)
    await sleep(3000) // Wait for workflow to complete
  }
  console.log()
}

async function demonstrateOrchestrationMetrics(): Promise<void> {
  console.log('='.repeat(60))
  console.log('📊 ORCHESTRATION METRICS & STATUS')
  console.log('='.repeat(60))

  // Get all orchestration statuses
  const orchestrations = cyre.orchestration.list()

  console.log(`📈 Active Orchestrations: ${orchestrations.length}`)

  orchestrations.forEach(runtime => {
    console.log(`\n🎭 ${runtime.config.name} (${runtime.config.id}):`)
    console.log(`   Status: ${runtime.status}`)
    console.log(`   Executions: ${runtime.executionCount}`)
    console.log(
      `   Success rate: ${
        runtime.metrics.totalExecutions > 0
          ? (
              (runtime.metrics.successfulExecutions /
                runtime.metrics.totalExecutions) *
              100
            ).toFixed(1)
          : '0'
      }%`
    )
    console.log(
      `   Avg execution time: ${runtime.metrics.averageExecutionTime.toFixed(
        2
      )}ms`
    )
    console.log(`   Triggers: ${runtime.config.triggers.length}`)

    if (runtime.context?.stepHistory) {
      console.log(
        `   Last execution steps: ${runtime.context.stepHistory.length}`
      )
      const successfulSteps = runtime.context.stepHistory.filter(
        s => s.success
      ).length
      console.log(
        `   Step success rate: ${
          runtime.context.stepHistory.length > 0
            ? (
                (successfulSteps / runtime.context.stepHistory.length) *
                100
              ).toFixed(1)
            : '0'
        }%`
      )
    }
  })

  console.log()
}

async function runOrchestrationShowcase(): Promise<void> {
  console.clear()
  console.log('🎪 CYRE ORCHESTRATION INTEGRATION SHOWCASE')
  console.log('Advanced workflow automation with seamless Cyre integration')
  console.log('='.repeat(80))
  console.log()

  try {
    // Setup
    await setupDemoSystem()

    // Run demonstrations
    await demonstrateBasicOrchestration()
    await sleep(1000)

    await demonstrateAdvancedOrchestration()
    await sleep(1000)

    await demonstrateTimeBasedOrchestration()
    await sleep(1000)

    await demonstrateExternalTriggers()
    await sleep(1000)

    await demonstrateOrchestrationMetrics()

    // Final summary
    console.log('='.repeat(60))
    console.log('🎯 ORCHESTRATION SHOWCASE SUMMARY')
    console.log('='.repeat(60))

    const orchestrations = cyre.orchestration.list()
    const totalExecutions = orchestrations.reduce(
      (sum, o) => sum + o.executionCount,
      0
    )
    const totalTriggers = orchestrations.reduce(
      (sum, o) => sum + o.config.triggers.length,
      0
    )

    console.log(`✨ Orchestration Integration Success!`)
    console.log(`📊 Statistics:`)
    console.log(`   Total orchestrations: ${orchestrations.length}`)
    console.log(`   Total triggers: ${totalTriggers}`)
    console.log(`   Total executions: ${totalExecutions}`)
    console.log(
      `   Running orchestrations: ${
        orchestrations.filter(o => o.status === 'running').length
      }`
    )
    console.log()

    console.log('🎯 Features Demonstrated:')
    console.log('   ✅ Channel pattern triggers (sensor-*, user-*)')
    console.log('   ✅ Conditional workflow execution')
    console.log('   ✅ Multi-step workflows with actions')
    console.log('   ✅ Parallel step execution')
    console.log('   ✅ Time-based periodic triggers')
    console.log('   ✅ External/manual triggers')
    console.log('   ✅ Dynamic payload generation')
    console.log('   ✅ Workflow delays and timing')
    console.log('   ✅ Comprehensive metrics tracking')
    console.log('   ✅ Seamless Cyre channel integration')
  } catch (error) {
    console.error(
      '❌ Showcase failed:',
      error instanceof Error ? error.message : String(error)
    )
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up orchestrations...')

    const orchestrations = cyre.orchestration.list()
    orchestrations.forEach(runtime => {
      cyre.orchestration.remove(runtime.config.id)
    })

    cyre.clear()
    console.log('✅ Cleanup complete')

    // Exit
    setTimeout(() => {
      process.exit(0)
    }, 1000)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Showcase interrupted')
  cyre.clear()
  process.exit(0)
})

// Run the showcase
runOrchestrationShowcase().catch((error: Error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

export {runOrchestrationShowcase}
