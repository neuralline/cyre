// demo/schedule.ts
// Complete example using only Cyre's ecosystem - no external timers!

import {cyre, log} from '../src'

/*

      C.Y.R.E - P.U.R.E - E.C.O.S.Y.S.T.E.M
      
      Everything runs through Cyre's scheduling system:
      - No setInterval() or setTimeout()
      - Self-monitoring using schedule system
      - Orchestration coordinates complex workflows
      - Breathing system adapts everything automatically

*/

async function setupPureCyreEcosystem() {
  console.log('🚀 Setting up Pure Cyre Ecosystem...')

  await cyre.initialize()

  // ===== BUSINESS CHANNELS =====

  // User engagement channels
  cyre.action({id: 'send-welcome-email', payload: {}})
  cyre.action({id: 'daily-insights', payload: {}})
  cyre.action({id: 'weekly-summary', payload: {}})
  cyre.action({id: 'user-activity-check', payload: {}})

  // System operation channels
  cyre.action({id: 'database-backup', payload: {}})
  cyre.action({id: 'cache-cleanup', payload: {}})
  cyre.action({id: 'log-rotation', payload: {}})
  cyre.action({id: 'health-check', payload: {}})

  // Monitoring channels
  cyre.action({id: 'system-monitor', payload: {}})
  cyre.action({id: 'performance-analyzer', payload: {}})
  cyre.action({id: 'alert-manager', payload: {}})
  cyre.action({id: 'auto-optimizer', payload: {}})

  // ===== CHANNEL HANDLERS =====

  cyre.on('send-welcome-email', user => {
    console.log(`📧 Welcome email sent to ${user.email || 'new user'}`)
    return {sent: true, timestamp: Date.now()}
  })

  cyre.on('daily-insights', () => {
    console.log('📊 Generating daily user insights...')
    return {insights: ['engagement up 5%', 'new feature adoption 12%']}
  })

  cyre.on('weekly-summary', () => {
    console.log('📈 Creating weekly business summary...')
    // Trigger orchestration for complex report generation
    cyre.orchestration.trigger('weekly-report-generation', 'manual')
    return {status: 'report-generation-started'}
  })

  cyre.on('user-activity-check', () => {
    console.log('👥 Checking user activity patterns...')
    const activeUsers = Math.floor(Math.random() * 1000) + 500

    // Trigger alerts if activity is low
    if (activeUsers < 600) {
      cyre.call('alert-manager', {
        type: 'low-user-activity',
        count: activeUsers
      })
    }

    return {activeUsers, timestamp: Date.now()}
  })

  cyre.on('database-backup', () => {
    console.log('💾 Starting database backup...')
    // Simulate backup process
    const success = Math.random() > 0.1 // 90% success rate

    if (!success) {
      cyre.call('alert-manager', {
        type: 'backup-failed',
        timestamp: Date.now()
      })
    }

    return {success, size: '2.3GB', duration: '45s'}
  })

  cyre.on('cache-cleanup', () => {
    console.log('🧹 Cleaning cache...')
    const freedSpace = Math.floor(Math.random() * 500) + 100
    console.log(`   Freed ${freedSpace}MB of cache space`)
    return {freedMB: freedSpace}
  })

  cyre.on('health-check', () => {
    const breathing = cyre.getBreathingState()
    const performance = cyre.getPerformanceState()

    const health = {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      stress: breathing.stress,
      callRate: performance.callRate,
      healthy: breathing.stress < 0.7
    }

    console.log(
      `💓 Health Check: ${health.healthy ? '✅ Healthy' : '⚠️ Stressed'}`
    )

    if (!health.healthy) {
      cyre.call('auto-optimizer', health)
    }

    return health
  })

  cyre.on('system-monitor', () => {
    const load = cyre.schedule.getLoad()
    const breathing = cyre.getBreathingState()
    const performance = cyre.getPerformanceState()

    const status = {
      tasks: `${load.activeTasks}/${load.totalTasks}`,
      stress: Math.round(breathing.stress * 100),
      breathing: breathing.currentRate,
      callRate: performance.callRate,
      overloaded: load.overloaded
    }

    console.log(`📊 System Monitor:`)
    console.log(`   Tasks: ${status.tasks}`)
    console.log(`   Stress: ${status.stress}%`)
    console.log(`   Breathing: ${status.breathing}ms`)
    console.log(`   Call Rate: ${status.callRate}/sec`)
    console.log(
      `   Status: ${status.overloaded ? '🔴 Overloaded' : '🟢 Healthy'}`
    )

    return status
  })

  cyre.on('performance-analyzer', () => {
    log.debug('hola')
  })

  cyre.on('alert-manager', alert => {
    console.log(`🚨 ALERT: ${alert.type}`)

    // Route different alert types
    switch (alert.type) {
      case 'low-user-activity':
        console.log(`   User count dropped to ${alert.count}`)
        // Could trigger marketing campaigns
        break
      case 'backup-failed':
        console.log(`   Database backup failed at ${new Date(alert.timestamp)}`)
        // Could retry backup or notify ops team
        break
      case 'high-stress':
        console.log(`   System stress at ${Math.round(alert.stress * 100)}%`)
        // Could trigger load balancing
        break
    }

    return {alertProcessed: true, timestamp: Date.now()}
  })

  cyre.on('auto-optimizer', health => {
    console.log('🎚️ Auto-Optimizer activated')

    // Fix: Safely access health data with fallbacks
    const systemStress = health?.stress || health?.breathing || 0
    const memoryUsage = health?.memory || 0

    if (systemStress > 0.8) {
      console.log('   Pausing non-critical tasks...')

      // Get low priority tasks and pause them
      const lowPriorityTasks = cyre.schedule
        .list()
        .filter(
          task => task.breathing?.adaptToStress && task.priority !== 'critical'
        )

      lowPriorityTasks.forEach(task => {
        console.log(`   ⏸️ Pausing task: ${task.id}`)
        // Tasks auto-pause due to breathing config
      })
    }

    if (memoryUsage > 90) {
      console.log('   Triggering memory cleanup...')
      cyre.call('cache-cleanup')
    }

    return {
      optimizationApplied: true,
      actions: ['pause-tasks', 'cleanup-cache'],
      processedStress: systemStress,
      processedMemory: memoryUsage
    }
  })

  // ===== ORCHESTRATIONS =====

  // Weekly report generation orchestration
  cyre.orchestration.keep({
    id: 'weekly-report-generation', // task id
    triggers: [
      {
        name: 'manual',
        type: 'external'
      }
    ],
    workflow: [
      {
        name: 'collect-user-data',
        type: 'action',
        targets: 'user-activity-check' // .call channel
      },
      {
        name: 'analyze-performance',
        type: 'action',
        targets: 'performance-analyzer'
      },
      {
        name: 'generate-insights',
        type: 'action',
        targets: 'daily-insights'
      },
      {
        name: 'compile-report',
        type: 'delay',
        timeout: 2000 // 2 second processing delay
      }
    ]
  })

  // System maintenance orchestration
  cyre.orchestration.keep({
    id: 'nightly-maintenance',
    triggers: [
      {
        name: 'scheduled',
        type: 'time',
        interval: 24 * 60 * 60 * 1000 // Daily
      }
    ],
    workflow: [
      {
        name: 'backup-database',
        type: 'action',
        targets: 'database-backup'
      },
      {
        name: 'cleanup-cache',
        type: 'action',
        targets: 'cache-cleanup'
      },
      {
        name: 'rotate-logs',
        type: 'action',
        targets: 'log-rotation'
      },
      {
        name: 'health-check',
        type: 'action',
        targets: 'health-check'
      }
    ]
  })

  // ===== PURE CYRE SCHEDULING =====

  // Business operations - all using Cyre schedule
  cyre.schedule.task({
    id: 'user-engagement-cycle',
    triggers: [
      {time: '09:00', channels: ['daily-insights']},
      {time: '12:00', channels: ['user-activity-check']},
      {
        time: '17:00',
        channels: ['send-welcome-email'],
        payload: {email: 'new-users@example.com'}
      }
    ],
    breathing: {
      adaptToStress: true,
      stressMultiplier: 1.5
    }
  })

  // System monitoring - self-monitoring using Cyre
  cyre.schedule.task({
    id: 'continuous-monitoring',
    triggers: [
      {
        interval: 5000, // Every 5 seconds
        channels: ['system-monitor'],
        repeat: true
      },
      {
        interval: 30000, // Every 30 seconds
        channels: ['health-check'],
        repeat: true
      }
    ],
    breathing: {
      adaptToStress: true,
      stressMultiplier: 3.0, // Slow down monitoring under stress
      pauseThreshold: 0.9
    }
  })

  // Performance analysis - using Cyre schedule
  cyre.schedule.task({
    id: 'performance-tracking',
    triggers: [
      {
        interval: 60000, // Every minute
        channels: ['performance-analyzer'],
        repeat: true
      }
    ],
    conditions: [
      // Only analyze when system is not overloaded
      ctx => ctx.systemStress < 0.8
    ]
  })

  // Maintenance schedule - orchestration triggered by Cyre schedule
  cyre.schedule.task({
    id: 'daily-maintenance',
    triggers: [
      {
        time: '02:00', // 2 AM daily
        orchestration: 'nightly-maintenance'
      }
    ],
    breathing: {
      adaptToStress: true,
      pauseThreshold: 0.7 // Skip maintenance if system busy
    }
  })

  // Weekly reporting - orchestration on schedule
  cyre.schedule.task({
    id: 'weekly-reporting',
    triggers: [
      {
        cron: '0 9 * * MON', // Every Monday 9 AM
        channels: ['weekly-summary']
      }
    ]
  })

  // Adaptive optimization - frequency changes based on system health
  cyre.schedule.task({
    id: 'adaptive-optimization',
    triggers: [
      {
        interval: 10000, // Start at 10 seconds
        channels: ['auto-optimizer'],
        repeat: true
      }
    ],
    breathing: {
      adaptToStress: true,
      stressMultiplier: 5.0, // Slow to 50 seconds under stress
      resumeThreshold: 0.2 // Speed up when stress is low
    }
  })

  // ===== START ORCHESTRATIONS =====

  cyre.orchestration.start('weekly-report-generation')
  cyre.orchestration.start('nightly-maintenance')

  console.log('✅ Pure Cyre Ecosystem is running!')
  console.log(
    '🌟 All monitoring, scheduling, and automation is handled by Cyre'
  )
  console.log('🔄 System adapts automatically to load and stress')
  console.log('📊 Watch the console for automatic system reports...')

  // PURE CYRE: Startup notification using schedule
  cyre.schedule.once(2000, {
    id: 'startup-complete',
    channels: ['alert-manager'],
    payload: {
      type: 'system-ready',
      message: 'Pure Cyre ecosystem is operational',
      features: ['scheduling', 'orchestration', 'monitoring', 'auto-adaptation']
    }
  })
}

// ===== DEMO FUNCTIONS =====

setupPureCyreEcosystem()
