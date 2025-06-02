// examples/time-based-orchestration.ts
// Time-based orchestration with intervals and scheduled tasks

import {cyre} from '../src'

// Setup monitoring channels
cyre.action({id: 'system-health-check', payload: null})
cyre.action({id: 'cleanup-temp-files', payload: null})
cyre.action({id: 'backup-database', payload: null})
cyre.action({id: 'send-report', payload: null})

// Setup handlers
cyre.on('system-health-check', () => {
  const health = {
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk: Math.random() * 100,
    timestamp: Date.now()
  }
  console.log('Health check:', health)
  return health
})

cyre.on('cleanup-temp-files', () => {
  console.log('Cleaning up temporary files...')
  return {cleaned: true, filesRemoved: Math.floor(Math.random() * 50)}
})

cyre.on('backup-database', () => {
  console.log('Creating database backup...')
  return {backup: true, size: '2.5GB', timestamp: Date.now()}
})

cyre.on('send-report', data => {
  console.log('Sending report:', data)
  return {sent: true, recipients: ['admin@company.com']}
})

// Create time-based orchestration
const maintenanceOrchestration = cyre.orchestration.create({
  id: 'system-maintenance',
  name: 'Automated System Maintenance',

  triggers: [
    {
      name: 'health-monitor',
      type: 'time',
      interval: 5000 // Every 5 seconds for demo
    },
    {
      name: 'daily-cleanup',
      type: 'time',
      interval: 15000 // Every 15 seconds for demo (would be daily in production)
    }
  ],

  workflow: [
    {
      name: 'determine-task-type',
      type: 'condition',
      condition: context => context.trigger.name === 'health-monitor',
      steps: [
        {
          name: 'run-health-check',
          type: 'action',
          targets: 'system-health-check'
        },
        {
          name: 'check-if-critical',
          type: 'condition',
          condition: context => {
            const healthResult =
              context.stepHistory[context.stepHistory.length - 1]?.result?.[0]
                ?.result
            return (
              healthResult &&
              (healthResult.cpu > 80 || healthResult.memory > 80)
            )
          },
          steps: [
            {
              name: 'send-critical-alert',
              type: 'action',
              targets: 'send-report',
              payload: context => ({
                type: 'critical-alert',
                health:
                  context.stepHistory[context.stepHistory.length - 2]
                    ?.result?.[0]?.result,
                message: 'System resources critically high'
              })
            }
          ]
        }
      ]
    },
    {
      name: 'daily-maintenance-tasks',
      type: 'condition',
      condition: context => context.trigger.name === 'daily-cleanup',
      steps: [
        {
          name: 'parallel-maintenance',
          type: 'parallel',
          steps: [
            {
              name: 'cleanup-files',
              type: 'action',
              targets: 'cleanup-temp-files'
            },
            {
              name: 'backup-data',
              type: 'action',
              targets: 'backup-database'
            }
          ]
        },
        {
          name: 'send-maintenance-report',
          type: 'action',
          targets: 'send-report',
          payload: context => ({
            type: 'maintenance-complete',
            tasks: context.stepHistory.filter(
              step =>
                step.stepName === 'cleanup-files' ||
                step.stepName === 'backup-data'
            ),
            timestamp: Date.now()
          })
        }
      ]
    }
  ],

  errorHandling: {
    retries: 3,
    timeout: 30000,
    notifications: ['send-report']
  }
})

// Start the maintenance orchestration
if (maintenanceOrchestration.ok) {
  console.log('Maintenance orchestration created')

  const startResult = cyre.orchestration.start('system-maintenance')
  if (startResult.ok) {
    console.log('Maintenance orchestration started')

    // Let it run for 30 seconds then stop
    setTimeout(() => {
      const stopResult = cyre.orchestration.stop('system-maintenance')
      console.log('Maintenance orchestration stopped:', stopResult.message)

      // Show final metrics
      const orchestration = cyre.orchestration.get('system-maintenance')
      if (orchestration) {
        console.log('Final metrics:', orchestration.metrics)
      }
    }, 30000)
  }
} else {
  console.error(
    'Failed to create maintenance orchestration:',
    maintenanceOrchestration.message
  )
}
