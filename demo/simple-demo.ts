// demo/simple-demo.ts
// Quick test of key system orchestration features

import {cyre} from '../src'

const demo = async () => {
  console.log('🚀 Starting Cyre System Demo...\n')

  // Initialize with system orchestrations
  const init = await cyre.initialize()
  console.log('✅ Cyre initialized:', init.message)

  // Create some test channels
  cyre.action({id: 'sensor-temp', detectChanges: true})
  cyre.action({id: 'api-call', throttle: 100})
  cyre.action({id: 'heavy-task', debounce: 200})

  cyre.on('sensor-temp', temp => ({reading: temp, status: 'ok'}))
  cyre.on('api-call', async data => {
    await new Promise(r => setTimeout(r, 50)) // Simulate API delay
    return {api: 'response', data}
  })
  cyre.on('heavy-task', async task => {
    await new Promise(r => setTimeout(r, 100)) // Heavy processing
    return {processed: true, task}
  })

  console.log('📡 Demo channels created\n')

  // Show initial system health
  const health = cyre.getSystemHealth()
  console.log('❤️  Initial System Health:')
  console.log(`   Overall: ${health.overall ? '✅ Healthy' : '❌ Degraded'}`)
  console.log(
    `   Breathing Stress: ${(health.breathing.stress * 100).toFixed(1)}%`
  )
  console.log(`   Breathing Rate: ${health.breathing.rate}ms\n`)

  // Generate some load
  console.log('🔥 Generating load...')
  for (let i = 0; i < 50; i++) {
    cyre.call('sensor-temp', 25 + Math.random() * 10)
    cyre.call('api-call', {request: i})
    cyre.call('heavy-task', {id: i, data: 'test'})

    if (i % 10 === 0) {
      await new Promise(r => setTimeout(r, 100))
    }
  }

  // Wait a bit for system to process
  await new Promise(r => setTimeout(r, 2000))

  // Check system health after load
  const healthAfter = cyre.getSystemHealth()
  console.log('\n❤️  System Health After Load:')
  console.log(
    `   Overall: ${healthAfter.overall ? '✅ Healthy' : '❌ Degraded'}`
  )
  console.log(
    `   Breathing Stress: ${(healthAfter.breathing.stress * 100).toFixed(1)}%`
  )
  console.log(`   Breathing Rate: ${healthAfter.breathing.rate}ms`)

  // Show performance insights
  const insights = cyre.getPerformanceInsights()
  if (insights.length > 0) {
    console.log('\n💡 Performance Insights:')
    insights.forEach(insight => console.log(`   • ${insight}`))
  }

  // Get system metrics
  const metrics = cyre.dev.getSystemMetrics()
  console.log('\n📊 System Metrics:')
  console.log(`   Total Calls: ${metrics.performance.totalCalls}`)
  console.log(`   Call Rate: ${metrics.performance.callRate}/sec`)
  console.log(`   Errors: ${metrics.performance.totalErrors}`)
  console.log(`   Uptime: ${metrics.performance.uptime}s`)

  // Show orchestration status
  const orchestrations = cyre.orchestration.getSystemOrchestrations()
  console.log('\n🎭 System Orchestrations:')
  orchestrations.forEach(orch => {
    const status = orch.status === 'running' ? '✅' : '❌'
    console.log(`   ${status} ${orch.id}`)
  })

  // Trigger manual health check
  console.log('\n🔍 Triggering manual health check...')
  const healthCheck = await cyre.dev.triggerHealthCheck()
  console.log(`   Result: ${healthCheck.ok ? '✅ Passed' : '❌ Failed'}`)

  // Demo system adaptation
  console.log('\n⚖️  Testing system adaptation...')
  cyre.adaptSystemLoad(0.8) // Simulate high load

  await new Promise(r => setTimeout(r, 1000))

  const adaptedHealth = cyre.getSystemHealth()
  console.log(`   Adapted Breathing Rate: ${adaptedHealth.breathing.rate}ms`)
  console.log(
    `   Adapted Stress Level: ${(adaptedHealth.breathing.stress * 100).toFixed(
      1
    )}%`
  )

  // Show final snapshot
  const snapshot = cyre.dev.snapshot()
  console.log('\n📸 Final System Snapshot:')
  console.log(
    `   Channels: ${snapshot.channels.total} (${snapshot.channels.withSubscribers} subscribed)`
  )
  console.log(
    `   Orchestrations: ${snapshot.orchestrations.total} (${snapshot.orchestrations.running} running)`
  )
  console.log(`   System Orchestrations: ${snapshot.orchestrations.system}`)

  console.log('\n✅ Demo completed successfully!')
}

// Run the demo
demo().catch(console.error)
