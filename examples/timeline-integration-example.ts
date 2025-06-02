// examples/timeline-integration-example.ts
// Example showing orchestration using timeline as the one true source

import {cyre} from '../src'
import {timeline} from '../src/context/state'
import {metricsState} from '../src/context/metrics-state'

/*

    Timeline Integration Example
    
    Shows how orchestration can use timeline system:
    - Orchestrations become timeline entries
    - Unified pause/resume/forget APIs
    - Breathing system sees total load
    - Single source of truth for all running tasks

*/

interface OrchestrationTimer {
  orchestrationId: string
  currentStep: number
  totalSteps: number
  steps: OrchestrationStep[]
  variables: Record<string, any>
}

interface OrchestrationStep {
  name: string
  action: string
  payload?: any
  delay?: number
}

/**
 * Create orchestration that uses timeline system
 */
function createTimelineOrchestration(config: {
  id: string
  steps: OrchestrationStep[]
  interval?: number
  repeat?: boolean
}) {
  const orchestrationData: OrchestrationTimer = {
    orchestrationId: config.id,
    currentStep: 0,
    totalSteps: config.steps.length,
    steps: config.steps,
    variables: {}
  }

  // Create timeline entry for orchestration
  const timer = {
    id: config.id,
    startTime: Date.now(),
    duration: config.interval || 1000,
    originalDuration: config.interval || 1000,
    callback: async () => {
      await executeOrchestrationStep(orchestrationData)
    },
    repeat: config.repeat || false,
    executionCount: 0,
    lastExecutionTime: 0,
    nextExecutionTime: Date.now() + (config.interval || 1000),
    isInRecuperation: false,
    status: 'active' as const,
    isActive: true,

    // Store orchestration data in timer
    orchestrationData
  }

  // Add to timeline - now part of unified system
  timeline.add(timer)

  console.log(`📊 Orchestration '${config.id}' added to timeline`)
  console.log(`📊 Total timeline entries: ${timeline.getAll().length}`)
}

/**
 * Execute single orchestration step
 */
async function executeOrchestrationStep(orchestration: OrchestrationTimer) {
  const {currentStep, steps, orchestrationId} = orchestration

  if (currentStep >= steps.length) {
    console.log(`✅ Orchestration '${orchestrationId}' completed`)
    return
  }

  const step = steps[currentStep]
  console.log(
    `🔄 Executing step ${currentStep + 1}/${steps.length}: ${step.name}`
  )

  // Check breathing before step
  const breathing = cyre.getBreathingState()
  if (breathing.stress > 0.5) {
    console.log(
      `🫁 High stress detected (${(breathing.stress * 100).toFixed(
        1
      )}%), pausing briefly`
    )
    await new Promise(resolve => setTimeout(resolve, breathing.currentRate))
  }

  try {
    // Execute the step
    if (step.delay) {
      await new Promise(resolve => setTimeout(resolve, step.delay))
      console.log(`  ⏱️  Delayed ${step.delay}ms`)
    }

    const result = await cyre.call(step.action, step.payload)
    console.log(
      `  ✅ Step '${step.name}' completed:`,
      result.ok ? 'SUCCESS' : 'FAILED'
    )

    // Move to next step
    orchestration.currentStep++
  } catch (error) {
    console.log(`  ❌ Step '${step.name}' failed:`, error)
    orchestration.currentStep++ // Continue to next step
  }
}

/**
 * Get unified system overview
 */
function getSystemOverview() {
  const allTimers = timeline.getAll()
  const orchestrations = allTimers.filter(t => t.orchestrationData)
  const regularTimers = allTimers.filter(t => !t.orchestrationData)

  return {
    total: allTimers.length,
    orchestrations: orchestrations.length,
    timers: regularTimers.length,
    active: allTimers.filter(t => t.isActive).length,
    breathing: cyre.getBreathingState()
  }
}

/**
 * Create stress to trigger breathing system
 */
async function createSystemStress() {
  console.log('\n🔥 Creating system stress to trigger breathing...')

  // Create CPU-intensive channels
  cyre.action({id: 'cpu-intensive', payload: 0})
  cyre.on('cpu-intensive', (data: number[]) => {
    // Heavy computation to create stress
    let result = 0
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < 1000; j++) {
        result += Math.sqrt(data[i] * j) + Math.sin(data[i]) * Math.cos(j)
      }
    }
    return result
  })

  // Launch many concurrent operations to create stress
  const promises = []
  for (let i = 0; i < 100; i++) {
    const data = Array.from({length: 100}, (_, idx) => i * 100 + idx)
    promises.push(cyre.call('cpu-intensive', data))
  }

  await Promise.all(promises)
  console.log('🔥 Stress operations completed')
}

/**
 * Main example
 */
export async function runTimelineIntegrationExample() {
  console.log('🚀 Timeline Integration Example')
  console.log('Showing orchestration using timeline as one true source\n')

  await cyre.initialize()

  // Setup some basic channels
  cyre.action({id: 'data-extract', payload: {}})
  cyre.action({id: 'data-transform', payload: {}})
  cyre.action({id: 'data-validate', payload: {}})
  cyre.action({id: 'data-load', payload: {}})

  cyre.on('data-extract', () => ({extracted: 100, timestamp: Date.now()}))
  cyre.on('data-transform', (data: any) => ({...data, transformed: true}))
  cyre.on('data-validate', (data: any) => ({
    ...data,
    valid: data.extracted > 0
  }))
  cyre.on('data-load', (data: any) => ({
    ...data,
    loaded: true,
    loadTime: Date.now()
  }))

  console.log('📊 Initial system state:')
  console.log(getSystemOverview())

  // Create orchestration using timeline
  createTimelineOrchestration({
    id: 'data-pipeline',
    steps: [
      {name: 'Extract Data', action: 'data-extract', delay: 100},
      {name: 'Transform Data', action: 'data-transform', delay: 200},
      {name: 'Validate Data', action: 'data-validate', delay: 150},
      {name: 'Load Data', action: 'data-load', delay: 100}
    ],
    interval: 2000,
    repeat: true
  })

  // Create another orchestration
  createTimelineOrchestration({
    id: 'monitoring-check',
    steps: [
      {name: 'Health Check', action: 'data-extract'},
      {name: 'Log Status', action: 'data-validate'}
    ],
    interval: 5000,
    repeat: true
  })

  console.log('\n📊 System state after adding orchestrations:')
  console.log(getSystemOverview())

  // Let it run for a bit
  console.log('\n⏱️  Running orchestrations for 10 seconds...')
  await new Promise(resolve => setTimeout(resolve, 10000))

  console.log('\n📊 System state after 10 seconds:')
  console.log(getSystemOverview())

  // Test pause/resume using unified APIs
  console.log('\n⏸️  Pausing data-pipeline orchestration...')
  const pipelineTimer = timeline.get('data-pipeline')
  if (pipelineTimer) {
    pipelineTimer.isActive = false
    pipelineTimer.status = 'paused'
    timeline.add(pipelineTimer) // Update in timeline
    console.log('✅ Paused successfully')
  }

  await new Promise(resolve => setTimeout(resolve, 3000))

  console.log('\n▶️  Resuming data-pipeline orchestration...')
  if (pipelineTimer) {
    pipelineTimer.isActive = true
    pipelineTimer.status = 'active'
    timeline.add(pipelineTimer) // Update in timeline
    console.log('✅ Resumed successfully')
  }

  // Create stress to trigger breathing
  await createSystemStress()

  console.log('\n📊 Final system state:')
  const final = getSystemOverview()
  console.log(final)
  console.log(
    `🫁 Final breathing state: Rate=${final.breathing.currentRate}ms, Stress=${(
      final.breathing.stress * 100
    ).toFixed(1)}%`
  )

  // Cleanup
  console.log('\n🧹 Cleaning up...')
  timeline.forget('data-pipeline')
  timeline.forget('monitoring-check')

  console.log('📊 Final timeline entries:', timeline.getAll().length)
  console.log('✅ Timeline integration example completed!')
}

// Auto-run if executed directly

runTimelineIntegrationExample()
