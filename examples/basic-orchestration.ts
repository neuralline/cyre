// examples/basic-orchestration.ts
// Basic orchestration usage example

import {cyre} from '../src'

// Setup channels
cyre.action({id: 'sensor-data', payload: null})
cyre.action({id: 'process-data', payload: null})
cyre.action({id: 'alert-system', payload: null})
cyre.action({id: 'log-event', payload: null})

// Setup handlers
cyre.on('process-data', data => {
  console.log('Processing data:', data)
  return {processed: true, value: data.value * 2}
})

cyre.on('alert-system', alert => {
  console.log('ALERT:', alert.message)
  return {alerted: true, timestamp: Date.now()}
})

cyre.on('log-event', event => {
  console.log('LOG:', event)
  return {logged: true}
})

// Create orchestration
const basicOrchestration = cyre.orchestration.create({
  id: 'data-processing-workflow',
  name: 'Basic Data Processing',

  triggers: [
    {
      name: 'sensor-trigger',
      type: 'channel',
      channels: 'sensor-data'
    }
  ],

  workflow: [
    {
      name: 'process-incoming-data',
      type: 'action',
      targets: 'process-data',
      payload: context => context.trigger.payload
    },
    {
      name: 'check-threshold',
      type: 'condition',
      condition: context => {
        const lastResult = context.stepHistory[context.stepHistory.length - 1]
        return lastResult?.result?.[0]?.result?.value > 100
      },
      steps: [
        {
          name: 'send-alert',
          type: 'action',
          targets: 'alert-system',
          payload: context => ({
            message: 'High threshold detected',
            value:
              context.stepHistory[context.stepHistory.length - 1]?.result?.[0]
                ?.result?.value,
            timestamp: Date.now()
          })
        }
      ]
    },
    {
      name: 'log-completion',
      type: 'action',
      targets: 'log-event',
      payload: context => ({
        orchestrationId: context.orchestrationId,
        trigger: context.trigger.name,
        steps: context.stepHistory.length,
        timestamp: Date.now()
      })
    }
  ]
})

// Start orchestration
if (basicOrchestration.ok) {
  console.log('Orchestration created:', basicOrchestration.message)

  const startResult = cyre.orchestration.start('data-processing-workflow')
  if (startResult.ok) {
    console.log('Orchestration started:', startResult.message)

    // Trigger the workflow
    setTimeout(() => {
      cyre.call('sensor-data', {value: 150, source: 'temperature-sensor'})
    }, 1000)

    setTimeout(() => {
      cyre.call('sensor-data', {value: 50, source: 'humidity-sensor'})
    }, 2000)

    // Stop after 5 seconds
    setTimeout(() => {
      cyre.orchestration.stop('data-processing-workflow')
      console.log('Orchestration stopped')
    }, 5000)
  }
} else {
  console.error('Failed to create orchestration:', basicOrchestration.message)
}
