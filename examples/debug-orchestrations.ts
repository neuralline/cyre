// examples/debug-orchestrations.ts
// Simple test to debug system orchestrations

import {cyre, orchestration} from '../src'

/*

      C.Y.R.E - D.E.B.U.G - O.R.C.H.E.S.T.R.A.T.I.O.N.S
      
      Debug script to check what system orchestrations are doing:
      - Test individual monitoring actions
      - Check orchestration status
      - Watch logs in real-time
      - Troubleshoot issues

*/
// examples/debug-orchestrations.ts
// Debug orchestrations with static imports - NO DYNAMIC IMPORTS

import {log} from '../src/components/cyre-log'

import {timeline} from '../src/context/state'
import {TimeKeeper} from '../src/components/cyre-timekeeper'

/*

      C.Y.R.E - D.E.B.U.G - O.R.C.H.E.S.T.R.A.T.I.O.N.S
      
      Debug system orchestrations with TimeKeeper integration:
      - Check orchestration status using timeline
      - Monitor system health with proper metrics
      - Watch for orchestration activity
      - Static imports only - NO DYNAMIC IMPORTS
      - TimeKeeper status integration

      NOTE: NO DYNAMIC IMPORTS - use static imports only for better reliability

*/

/**
 * Debug orchestrations with timeline and TimeKeeper status
 */
const debugOrchestrations = async () => {
  try {
    log.info('🔍 System Orchestrations Debug:')

    const systemOrchestrationIds = [
      'system-adaptive-breathing',
      'system-memory-management',
      'system-performance-monitor',
      'system-health-check'
    ]

    // Check orchestration runtime status
    log.info('📋 Orchestration Runtime Status:')
    systemOrchestrationIds.forEach((id: string) => {
      try {
        const runtime = orchestration.get(id)
        if (runtime) {
          log.info(`  📋 ${id}:`)
          log.info(`    Status: ${runtime.status}`)
          log.info(`    Execution Count: ${runtime.executionCount}`)
          log.info(
            `    Last Execution: ${
              runtime.lastExecution
                ? new Date(runtime.lastExecution).toISOString()
                : 'Never'
            }`
          )
          log.info(
            `    Metrics: ${runtime.metrics.totalExecutions} total, ${runtime.metrics.successfulExecutions} successful`
          )
        } else {
          log.warn(`  ❌ ${id}: Runtime not found`)
        }
      } catch (error) {
        log.error(`  ❌ ${id}: Error getting runtime - ${error}`)
      }
    })

    // Check timeline status for orchestration triggers
    log.info('⏰ Timeline Status:')
    const allTimers = timeline.getAll()
    const orchestrationTriggers = allTimers.filter(
      timer =>
        timer.id &&
        (timer.id.includes('system-adaptive-breathing') ||
          timer.id.includes('system-memory-management') ||
          timer.id.includes('system-performance-monitor') ||
          timer.id.includes('system-health-check'))
    )

    log.info(`  Total Timeline Entries: ${allTimers.length}`)
    log.info(`  Orchestration Triggers: ${orchestrationTriggers.length}`)

    orchestrationTriggers.forEach(timer => {
      const nextExecution = timer.nextExecutionTime - Date.now()
      log.info(`    ${timer.id}:`)
      log.info(`      Status: ${timer.status}`)
      log.info(`      Active: ${timer.isActive}`)
      log.info(
        `      Next: ${
          nextExecution > 0 ? `${Math.round(nextExecution / 1000)}s` : 'overdue'
        }`
      )
      log.info(`      Executions: ${timer.executionCount}`)
    })

    // Check TimeKeeper status
    log.info('🕰️ TimeKeeper Status:')
    const timeKeeperStatus = TimeKeeper.status()
    log.info(`  Active Formations: ${timeKeeperStatus.activeFormations}`)
    log.info(`  Total Formations: ${timeKeeperStatus.totalFormations}`)
    log.info(`  Hibernating: ${timeKeeperStatus.hibernating}`)
    log.info(`  In Recuperation: ${timeKeeperStatus.inRecuperation}`)

    if (timeKeeperStatus.quartzStats) {
      log.info(
        `  Quartz Active Timers: ${timeKeeperStatus.quartzStats.activeCount}`
      )
    }

    // Check if monitoring actions exist
    log.info('📋 Monitoring Actions Status:')
    const monitoringActions = [
      'system-stress-monitor',
      'breathing-adapter',
      'memory-monitor',
      'memory-cleanup',
      'performance-analyzer',
      'performance-insights',
      'system-health-checker',
      'health-reporter'
    ]

    monitoringActions.forEach((id: string) => {
      const action = cyre.get(id)
      log.info(`  ${action ? '✅' : '❌'} ${id}`)
    })

    // Get system overview
    const overview = orchestration.getSystemOverview()
    log.info('📊 System Overview:')
    log.info(`  Total Orchestrations: ${overview.total.orchestrations}`)
    log.info(`  Running: ${overview.total.running}`)
    log.info(`  Timeline Entries: ${overview.total.timelineEntries}`)
    log.info(`  Active Triggers: ${overview.total.activeTriggers}`)
    log.info(`  System Stress: ${(overview.systemStress * 100).toFixed(1)}%`)
    log.info(`  Breathing Rate: ${overview.breathing.currentRate}ms`)

    return {
      runtimesFound: systemOrchestrationIds.filter(id => orchestration.get(id))
        .length,
      triggersInTimeline: orchestrationTriggers.length,
      timeKeeperActive: timeKeeperStatus.activeFormations > 0,
      allGood:
        orchestrationTriggers.length > 0 &&
        timeKeeperStatus.activeFormations > 0
    }
  } catch (error) {
    console.error(`Debug failed: ${error}`)
    return {error: String(error)}
  }
}

/**
 * Watch for orchestration activity with improved detection
 */
export const watchOrchestrations = (
  durationSeconds: number = 30
): Promise<any> => {
  return new Promise(resolve => {
    try {
      log.info(`👀 Watching orchestrations for ${durationSeconds} seconds...`)

      let activityCount = 0
      let lastActivityTime = Date.now()
      const activityLog: string[] = []

      // Monitor timeline executions
      const originalTimelineEntries = timeline.getAll().length
      let maxTimelineEntries = originalTimelineEntries

      // Create a simple activity monitor
      const originalCall = cyre.call
      cyre.call = async function (id: string, payload?: any) {
        const systemActions = [
          'system-stress-monitor',
          'breathing-adapter',
          'memory-monitor',
          'memory-cleanup',
          'performance-analyzer',
          'performance-insights',
          'system-health-checker',
          'health-reporter'
        ]

        if (systemActions.includes(id)) {
          activityCount++
          lastActivityTime = Date.now()
          const activity = `🔄 Orchestration activity: ${id}`
          activityLog.push(activity)
          log.info(activity)
        }

        return originalCall.call(this, id, payload)
      }

      // Watch for activity and timeline changes
      const startTime = Date.now()
      const endTime = startTime + durationSeconds * 1000

      const watchInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const currentTimelineEntries = timeline.getAll().length

        if (currentTimelineEntries > maxTimelineEntries) {
          maxTimelineEntries = currentTimelineEntries
        }

        if (elapsed % 5 === 0) {
          log.info(
            `[${elapsed}s] Activity: ${activityCount} calls, Timeline: ${currentTimelineEntries} entries`
          )

          // Show next upcoming executions
          const upcomingExecutions = timeline
            .getAll()
            .filter(
              timer => timer.isActive && timer.nextExecutionTime > Date.now()
            )
            .sort((a, b) => a.nextExecutionTime - b.nextExecutionTime)
            .slice(0, 3)

          if (upcomingExecutions.length > 0) {
            log.info(`  Next executions:`)
            upcomingExecutions.forEach(timer => {
              const timeUntil = Math.round(
                (timer.nextExecutionTime - Date.now()) / 1000
              )
              log.info(`    ${timer.id}: ${timeUntil}s`)
            })
          }
        }

        if (Date.now() >= endTime) {
          clearInterval(watchInterval)

          // Restore original call function
          cyre.call = originalCall

          log.info(`✅ Watch complete!`)
          log.info(`  Total activity: ${activityCount} actions`)
          log.info(
            `  Timeline changes: ${
              maxTimelineEntries - originalTimelineEntries
            }`
          )
          log.info(`  Last activity: ${Date.now() - lastActivityTime}ms ago`)

          if (activityCount === 0) {
            log.warn('⚠️ No orchestration activity detected!')

            // Check why no activity
            const currentTimers = timeline.getAll()
            const orchestrationTimers = currentTimers.filter(
              timer =>
                timer.id &&
                (timer.id.includes('system-adaptive-breathing') ||
                  timer.id.includes('system-memory-management') ||
                  timer.id.includes('system-performance-monitor') ||
                  timer.id.includes('system-health-check'))
            )

            if (orchestrationTimers.length === 0) {
              log.error('❌ No orchestration timers found in timeline')
            } else {
              log.info(
                `Found ${orchestrationTimers.length} orchestration timers:`
              )
              orchestrationTimers.forEach(timer => {
                const nextExecution = timer.nextExecutionTime - Date.now()
                log.info(
                  `  ${timer.id}: next in ${Math.round(
                    nextExecution / 1000
                  )}s (${timer.status})`
                )
              })
            }
          } else {
            log.success(`✅ Detected ${activityCount} orchestration activities`)
            if (activityLog.length > 0) {
              log.info('Recent activities:')
              activityLog
                .slice(-5)
                .forEach(activity => log.info(`  ${activity}`))
            }
          }

          resolve({
            activityCount,
            timelineChanges: maxTimelineEntries - originalTimelineEntries,
            success: activityCount > 0
          })
        }
      }, 1000)
    } catch (error) {
      console.error(`Watch failed: ${error}`)
      resolve({error: String(error)})
    }
  })
}

/**
 * Manual trigger test for orchestrations
 */
export const testOrchestrationTriggers = async () => {
  try {
    log.info('🧪 Testing orchestration triggers manually...')

    const orchestrationIds = [
      'system-adaptive-breathing',
      'system-memory-management',
      'system-performance-monitor',
      'system-health-check'
    ]

    const results = []

    for (const id of orchestrationIds) {
      try {
        log.info(`Testing ${id}...`)
        const result = await orchestration.trigger(id, 'manual-test', {
          test: true,
          timestamp: Date.now()
        })

        if (result.ok) {
          log.info(`  ✅ ${id}: ${result.message}`)
          results.push({id, success: true, message: result.message})
        } else {
          log.error(`  ❌ ${id}: ${result.message}`)
          results.push({id, success: false, message: result.message})
        }
      } catch (error) {
        log.error(`  ❌ ${id}: Error - ${error}`)
        results.push({id, success: false, error: String(error)})
      }
    }

    const successCount = results.filter(r => r.success).length
    log.info(
      `🧪 Manual trigger tests complete: ${successCount}/${results.length} successful`
    )

    return {
      results,
      successCount,
      totalCount: results.length
    }
  } catch (error) {
    console.error(`Test triggers failed: ${error}`)
    return {error: String(error)}
  }
}

/**
 * Check timeline system status with TimeKeeper integration
 */
export const checkTimelineStatus = () => {
  try {
    log.info('⏰ Timeline System Status:')

    const allTimers = timeline.getAll()
    const activeTimers = timeline.getActive()
    const timeKeeperStatus = TimeKeeper.status()

    log.info(`  Total Timers: ${allTimers.length}`)
    log.info(`  Active Timers: ${activeTimers.length}`)
    log.info(`  TimeKeeper Formations: ${timeKeeperStatus.activeFormations}`)
    log.info(`  TimeKeeper Hibernating: ${timeKeeperStatus.hibernating}`)

    // Show orchestration-related timers
    const orchestrationTimers = allTimers.filter(
      timer =>
        timer.metadata?.type === 'orchestration-manager' ||
        timer.metadata?.type === 'orchestration-trigger' ||
        (timer.id &&
          (timer.id.includes('system-adaptive-breathing') ||
            timer.id.includes('system-memory-management') ||
            timer.id.includes('system-performance-monitor') ||
            timer.id.includes('system-health-check')))
    )

    log.info(`  Orchestration Timers: ${orchestrationTimers.length}`)

    orchestrationTimers.forEach(timer => {
      const nextExecution = timer.nextExecutionTime - Date.now()
      const timeUntil =
        nextExecution > 0 ? `${Math.round(nextExecution / 1000)}s` : 'overdue'
      log.info(`    ${timer.id}:`)
      log.info(`      Status: ${timer.status}`)
      log.info(`      Active: ${timer.isActive}`)
      log.info(`      Next: ${timeUntil}`)
      log.info(`      Repeat: ${timer.repeat}`)
      log.info(`      Executions: ${timer.executionCount}`)
    })

    // Check if system breathing timer is running
    const breathingTimer = allTimers.find(
      timer => timer.id === 'system-breathing'
    )
    if (breathingTimer) {
      log.info(`  ✅ System breathing timer: ${breathingTimer.status}`)
    } else {
      log.warn(`  ❌ System breathing timer not found`)
    }

    // Check for quartz timers
    if (timeKeeperStatus.quartzStats) {
      log.info(`  Quartz Active: ${timeKeeperStatus.quartzStats.activeCount}`)
      if (timeKeeperStatus.quartzStats.activeIds?.length > 0) {
        log.info(
          `  Quartz IDs: ${timeKeeperStatus.quartzStats.activeIds
            .slice(0, 5)
            .join(', ')}`
        )
      }
    }

    return {
      totalTimers: allTimers.length,
      activeTimers: activeTimers.length,
      orchestrationTimers: orchestrationTimers.length,
      timeKeeperActive: timeKeeperStatus.activeFormations > 0,
      quartzActive: timeKeeperStatus.quartzStats?.activeCount || 0
    }
  } catch (error) {
    console.error(`Timeline check failed: ${error}`)
    return {error: String(error)}
  }
}

/**
 * Force trigger next orchestration execution
 */
export const forceOrchestrationExecution = async () => {
  try {
    log.info('🚀 Force triggering next orchestration execution...')

    const allTimers = timeline.getAll()
    const orchestrationTimers = allTimers.filter(
      timer =>
        timer.id &&
        (timer.id.includes('system-adaptive-breathing') ||
          timer.id.includes('system-memory-management') ||
          timer.id.includes('system-performance-monitor') ||
          timer.id.includes('system-health-check'))
    )

    if (orchestrationTimers.length === 0) {
      log.error('❌ No orchestration timers found to trigger')
      return {success: false, message: 'No orchestration timers found'}
    }

    // Find the timer with the shortest time until next execution
    const nextTimer = orchestrationTimers
      .filter(timer => timer.isActive && timer.nextExecutionTime > Date.now())
      .sort((a, b) => a.nextExecutionTime - b.nextExecutionTime)[0]

    if (!nextTimer) {
      log.warn('⚠️ No active orchestration timers ready for execution')
      return {success: false, message: 'No active timers ready'}
    }

    const timeUntil = nextTimer.nextExecutionTime - Date.now()
    log.info(
      `⏰ Next timer: ${nextTimer.id} in ${Math.round(timeUntil / 1000)}s`
    )
    log.info(`🔄 Manually executing timer callback...`)

    // Execute the timer callback directly
    if (nextTimer.callback && typeof nextTimer.callback === 'function') {
      try {
        await nextTimer.callback()
        log.success(`✅ Successfully executed ${nextTimer.id}`)
        return {success: true, timerId: nextTimer.id}
      } catch (error) {
        log.error(`❌ Error executing ${nextTimer.id}: ${error}`)
        return {success: false, error: String(error)}
      }
    } else {
      log.error(`❌ Timer ${nextTimer.id} has no callback function`)
      return {success: false, message: 'No callback function'}
    }
  } catch (error) {
    console.error(`Force execution failed: ${error}`)
    return {error: String(error)}
  }
}

// Main debug function that runs all checks
export const runFullDebug = async () => {
  console.log('🔍 Debug System Orchestrations')
  console.log('===================================================')

  console.log('\n📋 Step 1: Debug orchestrations')
  const debugResult = debugOrchestrations()

  console.log('\n📋 Step 2: Check timeline status')
  const timelineResult = checkTimelineStatus()

  console.log('\n📋 Step 3: Test manual triggers')
  const triggerResult = await testOrchestrationTriggers()

  console.log('\n📋 Step 4: Force next execution (if needed)')
  if (!debugResult.allGood) {
    await forceOrchestrationExecution()
  }

  console.log('\n📋 Step 5: Watch orchestrations for 15 seconds')
  console.log('Look for logs from system orchestrations...')
  const watchResult = await watchOrchestrations(15)

  // Summary
  console.log('\n📊 Debug Summary:')
  console.log(
    `  Orchestrations in timeline: ${timelineResult.orchestrationTimers || 0}`
  )
  console.log(`  TimeKeeper active: ${timelineResult.timeKeeperActive}`)
  console.log(
    `  Manual triggers successful: ${triggerResult.successCount || 0}/${
      triggerResult.totalCount || 0
    }`
  )
  console.log(`  Activity detected: ${watchResult.activityCount || 0} calls`)

  if (watchResult.activityCount > 0) {
    console.log('✅ Orchestrations are working correctly!')
  } else {
    console.log('⚠️ No orchestration activity detected - check configuration')
  }

  return {
    debug: debugResult,
    timeline: timelineResult,
    triggers: triggerResult,
    watch: watchResult
  }
}
