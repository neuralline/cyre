// src/intelligence/system-diagnostics.ts
// System diagnostics orchestration - comprehensive system testing and monitoring

import {log} from '../components/cyre-log'
import {sensor} from '../context/metrics-report'
import {metrics} from '../metrics/integration'
import {metricsState} from '../context/metrics-state'
import {timeline} from '../context/state'
import type {IO} from '../types/core'
import type {OrchestrationConfig} from '../types/orchestration'
import cyre from '../'

/*

      C.Y.R.E - S.Y.S.T.E.M - D.I.A.G.N.O.S.T.I.C.S
      
      Comprehensive system diagnostics orchestration:
      - Tests all system components
      - Validates orchestration execution
      - Checks TimeKeeper status
      - Monitors breathing system
      - Verifies metrics collection
      - Reports system health with checkboxes
      - Provides actionable insights

*/

interface DiagnosticResult {
  component: string
  status: 'pass' | 'fail' | 'warn' | 'info'
  message: string
  details?: any
  timestamp: number
}

interface SystemDiagnostics {
  overall: 'healthy' | 'degraded' | 'critical'
  score: number
  results: DiagnosticResult[]
  recommendations: string[]
  timestamp: number
}

/**
 * Get diagnostic actions
 */
const getDiagnosticActions = (): IO[] => {
  return [
    {
      id: 'system-diagnostics-runner',
      tags: ['system', 'diagnostics', 'testing']
    },
    {
      id: 'orchestration-diagnostics',
      tags: ['system', 'diagnostics', 'orchestration']
    },
    {
      id: 'timekeeper-diagnostics',
      tags: ['system', 'diagnostics', 'timekeeper']
    },
    {
      id: 'metrics-diagnostics',
      tags: ['system', 'diagnostics', 'metrics']
    },
    {
      id: 'breathing-diagnostics',
      tags: ['system', 'diagnostics', 'breathing']
    }
  ]
}

/**
 * Get diagnostic handlers
 */
const getDiagnosticHandlers = (): Array<{
  id: string
  handler: (...args: any[]) => any
}> => {
  return [
    {
      id: 'system-diagnostics-runner',
      handler: async (payload?: any) => {
        // Make handler async
        try {
          log.info(
            '🔍 System Diagnostics: Starting comprehensive system check...'
          )

          const results: DiagnosticResult[] = []
          const startTime = Date.now()

          // Test 1: Core System Check
          try {
            const initialized = metricsState._init
            const locked = metricsState.isLocked()

            results.push({
              component: 'Core System',
              status: initialized && !locked ? 'pass' : 'fail',
              message: initialized
                ? locked
                  ? 'System is locked'
                  : 'System initialized and operational'
                : 'System not properly initialized',
              details: {initialized, locked},
              timestamp: Date.now()
            })
          } catch (error) {
            results.push({
              component: 'Core System',
              status: 'fail',
              message: `Core system check failed: ${error}`,
              timestamp: Date.now()
            })
          }

          // Test 2: Metrics System Check
          try {
            const systemMetrics = metrics.getSystemMetrics()
            const hasMetrics = systemMetrics.totalCalls >= 0

            results.push({
              component: 'Metrics System',
              status: hasMetrics ? 'pass' : 'warn',
              message: hasMetrics
                ? `Metrics active: ${systemMetrics.totalCalls} calls, ${systemMetrics.callRate}/sec`
                : 'Metrics system not collecting data',
              details: systemMetrics,
              timestamp: Date.now()
            })
          } catch (error) {
            results.push({
              component: 'Metrics System',
              status: 'fail',
              message: `Metrics check failed: ${error}`,
              timestamp: Date.now()
            })
          }

          // Test 3: Breathing System Check
          try {
            const breathing = metricsState.get().breathing
            const breathingHealthy =
              breathing.stress < 0.9 && breathing.currentRate > 0

            results.push({
              component: 'Breathing System',
              status: breathingHealthy
                ? 'pass'
                : breathing.stress > 0.95
                ? 'fail'
                : 'warn',
              message: `Breathing: ${breathing.currentRate.toFixed(
                1
              )}ms rate, ${(breathing.stress * 100).toFixed(1)}% stress`,
              details: breathing,
              timestamp: Date.now()
            })
          } catch (error) {
            results.push({
              component: 'Breathing System',
              status: 'fail',
              message: `Breathing check failed: ${error}`,
              timestamp: Date.now()
            })
          }

          // Test 4: Timeline System Check
          try {
            const allTimers = timeline.getAll()
            const activeTimers = timeline.getActive()
            const timelinesHealthy =
              allTimers.length > 0 && activeTimers.length > 0

            results.push({
              component: 'Timeline System',
              status: timelinesHealthy ? 'pass' : 'warn',
              message: `Timeline: ${activeTimers.length}/${allTimers.length} active timers`,
              details: {
                total: allTimers.length,
                active: activeTimers.length,
                timerIds: allTimers.map(t => t.id)
              },
              timestamp: Date.now()
            })
          } catch (error) {
            results.push({
              component: 'Timeline System',
              status: 'fail',
              message: `Timeline check failed: ${error}`,
              timestamp: Date.now()
            })
          }

          // Test 5: Orchestration System Check
          try {
            const orchestrationOverview = cyre.orchestration.getSystemOverview()
            const orchestrationsHealthy =
              orchestrationOverview.total.running > 0

            results.push({
              component: 'Orchestration System',
              status: orchestrationsHealthy ? 'pass' : 'warn',
              message: `Orchestrations: ${orchestrationOverview.total.running}/${orchestrationOverview.total.orchestrations} running`,
              details: orchestrationOverview,
              timestamp: Date.now()
            })
          } catch (error) {
            results.push({
              component: 'Orchestration System',
              status: 'fail',
              message: `Orchestration check failed: ${error}`,
              timestamp: Date.now()
            })
          }

          // Test 6: Action Pipeline Test with FIXED ASYNC HANDLING
          try {
            const testActionId = `diagnostic-test-action-${Date.now()}`
            let pipelineResult = {
              working: false,
              details: {
                actionCreated: false,
                handlerRegistered: false,
                callSucceeded: false,
                handlerExecuted: false,
                responseReceived: false,
                expectedPayload: false
              },
              errors: [] as string[],
              timings: {
                actionRegistration: 0,
                handlerRegistration: 0,
                callExecution: 0,
                totalTime: 0
              }
            }

            const testStartTime = performance.now()

            // Step 1: Create test action
            const actionStartTime = performance.now()
            const actionResult = cyre.action({id: testActionId})
            pipelineResult.timings.actionRegistration =
              performance.now() - actionStartTime

            if (!actionResult.ok) {
              pipelineResult.errors.push(
                `Action creation failed: ${actionResult.message}`
              )
            } else {
              pipelineResult.details.actionCreated = true
            }

            // Step 2: Register test handler
            if (pipelineResult.details.actionCreated) {
              const handlerStartTime = performance.now()
              let handlerExecuted = false

              const handlerResult = cyre.on(testActionId, (payload: any) => {
                handlerExecuted = true
                pipelineResult.details.handlerExecuted = true
                return {
                  diagnostic: true,
                  timestamp: Date.now(),
                  receivedPayload: payload,
                  success: true
                }
              })

              pipelineResult.timings.handlerRegistration =
                performance.now() - handlerStartTime

              if (!handlerResult.ok) {
                pipelineResult.errors.push(
                  `Handler registration failed: ${handlerResult.message}`
                )
              } else {
                pipelineResult.details.handlerRegistered = true
              }

              // Step 3: Test call execution with PROPER AWAIT
              if (pipelineResult.details.handlerRegistered) {
                // Small delay to ensure handler registration is complete
                await new Promise(resolve => setTimeout(resolve, 10))

                const callStartTime = performance.now()

                try {
                  // FIXED: Add await here!
                  const callResult = await cyre.call(testActionId, {
                    test: true,
                    diagnostic: true
                  })
                  pipelineResult.timings.callExecution =
                    performance.now() - callStartTime

                  console.log('🔍 DIAGNOSTIC CALL RESULT:', {
                    ok: callResult.ok,
                    payload: callResult.payload,
                    message: callResult.message,
                    error: callResult.error
                  })

                  if (callResult.ok) {
                    pipelineResult.details.callSucceeded = true
                    pipelineResult.details.responseReceived = true

                    // Verify handler was actually executed
                    if (handlerExecuted) {
                      pipelineResult.details.handlerExecuted = true
                    } else {
                      pipelineResult.errors.push(
                        'Handler was not executed during call'
                      )
                    }

                    // Verify response payload structure
                    if (
                      callResult.payload &&
                      callResult.payload.diagnostic === true
                    ) {
                      pipelineResult.details.expectedPayload = true
                      pipelineResult.working = true
                    } else {
                      pipelineResult.errors.push(
                        `Unexpected response payload: ${JSON.stringify(
                          callResult.payload
                        )}`
                      )
                    }
                  } else {
                    pipelineResult.errors.push(
                      `Call failed: ${
                        callResult.message || 'undefined message'
                      }`
                    )
                  }
                } catch (error) {
                  pipelineResult.timings.callExecution =
                    performance.now() - callStartTime
                  pipelineResult.errors.push(`Call threw exception: ${error}`)
                }
              }
            }

            pipelineResult.timings.totalTime = performance.now() - testStartTime

            // Cleanup
            setTimeout(() => {
              cyre.forget(testActionId)
            }, 100)

            // Generate status message
            let statusMessage =
              'Action pipeline working: call → handler → response'
            let status: 'pass' | 'fail' | 'warn' = 'pass'

            if (!pipelineResult.working) {
              const failureReasons: string[] = []

              if (!pipelineResult.details.actionCreated) {
                failureReasons.push('action creation')
              }
              if (!pipelineResult.details.handlerRegistered) {
                failureReasons.push('handler registration')
              }
              if (!pipelineResult.details.callSucceeded) {
                failureReasons.push('call execution')
              }
              if (!pipelineResult.details.handlerExecuted) {
                failureReasons.push('handler execution')
              }
              if (!pipelineResult.details.expectedPayload) {
                failureReasons.push('response validation')
              }

              if (failureReasons.length > 0) {
                statusMessage = `Pipeline failed at: ${failureReasons.join(
                  ', '
                )}`
                status = 'fail'
              }
            }

            results.push({
              component: 'Action Pipeline',
              status,
              message: statusMessage,
              details: {
                testActionId,
                pipelineResult,
                timings: pipelineResult.timings,
                errors: pipelineResult.errors
              },
              timestamp: Date.now()
            })
          } catch (error) {
            results.push({
              component: 'Action Pipeline',
              status: 'fail',
              message: `Pipeline test threw exception: ${error}`,
              timestamp: Date.now()
            })
          }

          // Calculate overall score and status
          const totalTests = results.length
          const passedTests = results.filter(r => r.status === 'pass').length
          const failedTests = results.filter(r => r.status === 'fail').length
          const score = Math.round((passedTests / totalTests) * 100)

          let overall: 'healthy' | 'degraded' | 'critical' = 'healthy'
          if (failedTests > 0 || score < 60) {
            overall = 'critical'
          } else if (score < 80) {
            overall = 'degraded'
          }

          // Generate recommendations
          const recommendations: string[] = []
          if (failedTests > 0) {
            recommendations.push(
              `${failedTests} critical system components need attention`
            )
          }
          if (score < 80) {
            recommendations.push('System performance is below optimal levels')
          }

          const warningCount = results.filter(r => r.status === 'warn').length
          if (warningCount > 0) {
            recommendations.push(
              `${warningCount} components show warning signs`
            )
          }

          const diagnostics = {
            overall,
            score,
            results,
            recommendations,
            timestamp: startTime
          }

          // Log results
          log.info('🔍 SYSTEM DIAGNOSTICS REPORT')
          log.info('=' + '='.repeat(40))

          results.forEach(result => {
            const icon =
              result.status === 'pass'
                ? '✅'
                : result.status === 'fail'
                ? '❌'
                : result.status === 'warn'
                ? '⚠️'
                : 'ℹ️'
            log.info(`${icon} ${result.component}: ${result.message}`)
          })

          log.info('=' + '='.repeat(40))
          const overallIcon =
            overall === 'healthy' ? '✅' : overall === 'degraded' ? '⚠️' : '❌'
          log.info(
            `${overallIcon} Overall Status: ${overall.toUpperCase()} (${score}/100)`
          )

          if (recommendations.length > 0) {
            log.info('📋 Recommendations:')
            recommendations.forEach((rec, i) => {
              log.info(`  ${i + 1}. ${rec}`)
            })
          }

          return {
            success: true,
            diagnostics,
            executionTime: Date.now() - startTime,
            timestamp: Date.now()
          }
        } catch (error) {
          log.error(`❌ System diagnostics failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'orchestration-diagnostics',
      handler: (payload?: any) => {
        try {
          log.info(
            '🎼 Orchestration Diagnostics: Checking orchestration health...'
          )

          const overview = cyre.orchestration.getSystemOverview()
          const allOrchestrations = cyre.orchestration.list()

          const results: DiagnosticResult[] = []

          // Check each orchestration
          allOrchestrations.forEach(runtime => {
            const status = cyre.orchestration.getStatus(runtime.config.id)
            const isHealthy = status?.isActive && runtime.status === 'running'

            results.push({
              component: `Orchestration: ${runtime.config.id}`,
              status: isHealthy ? 'pass' : 'warn',
              message: isHealthy
                ? `Active, ${runtime.executionCount} executions`
                : `Inactive or not running`,
              details: {runtime, status},
              timestamp: Date.now()
            })
          })

          log.info(
            `🎼 Orchestration Health: ${
              results.filter(r => r.status === 'pass').length
            }/${results.length} active`
          )

          return {
            success: true,
            overview,
            results,
            timestamp: Date.now()
          }
        } catch (error) {
          log.error(`❌ Orchestration diagnostics failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'timekeeper-diagnostics',
      handler: (payload?: any) => {
        try {
          log.info('⏰ TimeKeeper Diagnostics: Checking timer system...')

          const timeKeeperStatus = cyre.dev?.getTimeKeeperStatus?.() || {
            message: 'TimeKeeper status not available'
          }

          const allTimers = timeline.getAll()
          const activeTimers = timeline.getActive()

          // Test timer creation
          let timerTestPassed = false
          try {
            const testTimerId = 'diagnostic-timer-test'
            const timerResult = cyre.setTimer(
              1000,
              () => {
                log.info('⏰ Timer test executed successfully')
              },
              testTimerId
            )

            if (timerResult.ok) {
              timerTestPassed = true
              // Clean up test timer
              cyre.clearTimer(testTimerId)
            }
          } catch (error) {
            log.warn(`⏰ Timer test failed: ${error}`)
          }

          const results = {
            timeKeeperStatus,
            totalTimers: allTimers.length,
            activeTimers: activeTimers.length,
            timerTestPassed,
            timerDetails: allTimers.map(timer => ({
              id: timer.id,
              status: timer.status,
              isActive: timer.isActive,
              nextExecution: timer.nextExecutionTime - Date.now()
            }))
          }

          log.info(
            `⏰ Timer Status: ${activeTimers.length}/${allTimers.length} active timers`
          )
          if (timerTestPassed) {
            log.info('⏰ Timer creation test: ✅ PASSED')
          } else {
            log.warn('⏰ Timer creation test: ❌ FAILED')
          }

          return {
            success: true,
            results,
            timestamp: Date.now()
          }
        } catch (error) {
          log.error(`❌ TimeKeeper diagnostics failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'metrics-diagnostics',
      handler: (payload?: any) => {
        try {
          log.info('📊 Metrics Diagnostics: Checking metrics collection...')

          const systemMetrics = metrics.getSystemMetrics()
          const recentEvents = metrics.getEvents({since: Date.now() - 60000})
          const analysis = metrics.analyze(60000)

          const metricsHealthy =
            systemMetrics.totalCalls >= 0 && recentEvents.length >= 0

          const results = {
            systemMetrics,
            recentEventCount: recentEvents.length,
            analysis: {
              health: analysis.health,
              performance: analysis.performance,
              pipeline: analysis.pipeline
            },
            metricsHealthy
          }

          log.info(
            `📊 Metrics Status: ${recentEvents.length} recent events, ${systemMetrics.totalCalls} total calls`
          )
          log.info(
            `📊 System Health: ${analysis.health.overall.toUpperCase()} (${
              analysis.health.score
            }/100)`
          )

          return {
            success: true,
            results,
            timestamp: Date.now()
          }
        } catch (error) {
          log.error(`❌ Metrics diagnostics failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    },
    {
      id: 'breathing-diagnostics',
      handler: (payload?: any) => {
        try {
          log.info('🫁 Breathing Diagnostics: Checking breathing system...')

          const breathing = metricsState.get().breathing
          const breathingStats = metricsState.getBreathingStats()

          const breathingHealthy =
            breathing.stress < 0.9 && breathing.currentRate > 0
          const adaptiveWorking = breathing.breathCount > 0

          const results = {
            breathing,
            breathingStats,
            breathingHealthy,
            adaptiveWorking,
            stressLevel: breathing.stress,
            currentRate: breathing.currentRate,
            isRecuperating: breathing.isRecuperating
          }

          const statusIcon = breathingHealthy
            ? '✅'
            : breathing.stress > 0.95
            ? '❌'
            : '⚠️'
          log.info(
            `🫁 Breathing Status: ${statusIcon} Rate=${breathing.currentRate.toFixed(
              1
            )}ms, Stress=${(breathing.stress * 100).toFixed(1)}%`
          )

          if (breathing.isRecuperating) {
            log.warn('🫁 System is in recuperation mode')
          }

          return {
            success: true,
            results,
            timestamp: Date.now()
          }
        } catch (error) {
          log.error(`❌ Breathing diagnostics failed: ${error}`)
          return {success: false, error: String(error)}
        }
      }
    }
  ]
}

/**
 * Get diagnostic orchestration configuration
 */
const getDiagnosticOrchestrations = (): OrchestrationConfig[] => {
  return [
    {
      id: 'system-comprehensive-diagnostics',
      name: 'Comprehensive System Diagnostics',
      description: 'Runs comprehensive system diagnostics and health checks',
      enabled: true,
      triggers: [
        {
          type: 'time',
          name: 'comprehensive-diagnostics',
          interval: 60000, // Every minute for comprehensive testing
          repeat: true
        }
      ],
      workflow: [
        {
          name: 'run-system-diagnostics',
          type: 'action',
          targets: ['system-diagnostics-runner'],
          enabled: true,
          onError: 'continue'
        }
      ]
    },
    {
      id: 'system-component-diagnostics',
      name: 'Component Diagnostics',
      description: 'Tests individual system components',
      enabled: true,
      triggers: [
        {
          type: 'time',
          name: 'component-diagnostics',
          interval: 45000, // Every 45 seconds
          repeat: true
        }
      ],
      workflow: [
        {
          name: 'check-orchestrations',
          type: 'action',
          targets: ['orchestration-diagnostics'],
          enabled: true,
          onError: 'continue'
        },
        {
          name: 'check-timekeeper',
          type: 'action',
          targets: ['timekeeper-diagnostics'],
          enabled: true,
          onError: 'continue'
        },
        {
          name: 'check-metrics',
          type: 'action',
          targets: ['metrics-diagnostics'],
          enabled: true,
          onError: 'continue'
        },
        {
          name: 'check-breathing',
          type: 'action',
          targets: ['breathing-diagnostics'],
          enabled: true,
          onError: 'continue'
        }
      ]
    }
  ]
}

/**
 * Register system diagnostics
 */
export const registerSystemDiagnostics = (
  orchestration: any
): {registered: string[]; failed: string[]} => {
  const registered: string[] = []
  const failed: string[] = []

  try {
    log.info('🔍 Registering system diagnostics...')

    // Register diagnostic actions
    const diagnosticActions = getDiagnosticActions()
    for (const action of diagnosticActions) {
      try {
        const result = cyre.action(action)
        if (result.ok) {
          log.debug(`✅ Registered diagnostic action: ${action.id}`)
        } else {
          log.error(
            `❌ Failed to register diagnostic action ${action.id}: ${result.message}`
          )
          failed.push(action.id)
        }
      } catch (error) {
        log.error(
          `❌ Error registering diagnostic action ${action.id}: ${error}`
        )
        failed.push(action.id)
      }
    }

    // Register diagnostic handlers
    const diagnosticHandlers = getDiagnosticHandlers()
    for (const {id, handler} of diagnosticHandlers) {
      try {
        const result = cyre.on(id, handler)
        if (result.ok) {
          log.debug(`✅ Registered diagnostic handler: ${id}`)
        } else {
          log.error(
            `❌ Failed to register diagnostic handler ${id}: ${result.message}`
          )
          failed.push(id)
        }
      } catch (error) {
        log.error(`❌ Error registering diagnostic handler ${id}: ${error}`)
        failed.push(id)
      }
    }

    // Register diagnostic orchestrations
    const diagnosticOrchestrations = getDiagnosticOrchestrations()
    for (const config of diagnosticOrchestrations) {
      try {
        // Remove existing if present
        const existing = orchestration.get(config.id)
        if (existing) {
          orchestration.stop(config.id)
          orchestration.remove(config.id)
        }

        // Create and start new orchestration
        const createResult = orchestration.create(config)
        if (createResult.ok) {
          const startResult = orchestration.start(config.id)
          if (startResult.ok) {
            registered.push(config.id)
            log.success(`✅ Started diagnostic orchestration: ${config.id}`)
          } else {
            failed.push(config.id)
            log.error(
              `❌ Failed to start diagnostic orchestration ${config.id}: ${startResult.message}`
            )
          }
        } else {
          failed.push(config.id)
          log.error(
            `❌ Failed to create diagnostic orchestration ${config.id}: ${createResult.message}`
          )
        }
      } catch (error) {
        failed.push(config.id)
        log.error(
          `❌ Error with diagnostic orchestration ${config.id}: ${error}`
        )
      }
    }

    log.success(
      `🔍 System diagnostics registration complete: ${registered.length} orchestrations active`
    )

    return {registered, failed}
  } catch (error) {
    log.error(`❌ System diagnostics registration failed: ${error}`)
    return {registered: [], failed: ['diagnostics-registration-error']}
  }
}

/**
 * Manual diagnostic trigger for immediate testing
 */
export const runDiagnostics = async (): Promise<SystemDiagnostics | null> => {
  try {
    log.info('🔍 Running manual system diagnostics...')

    const result = await cyre.call('system-diagnostics-runner', {manual: true})

    if (result.ok && result.payload?.diagnostics) {
      return result.payload.diagnostics
    } else {
      log.error(`❌ Manual diagnostics failed: ${result.message}`)
      return null
    }
  } catch (error) {
    log.error(`❌ Manual diagnostics error: ${error}`)
    return null
  }
}

export type {DiagnosticResult, SystemDiagnostics}
