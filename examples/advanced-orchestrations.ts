// examples/advanced-orchestrations.ts
// Advanced orchestration examples showcasing complex workflows

import {cyre} from '../src'

// =============================================================================
// SMART HOME AUTOMATION SYSTEM
// =============================================================================

// Setup smart home channels
const smartHomeChannels = [
  'motion-sensor',
  'door-sensor',
  'temperature-sensor',
  'light-sensor',
  'security-camera',
  'smart-lights',
  'smart-thermostat',
  'smart-locks',
  'alarm-system',
  'notification-service',
  'energy-monitor',
  'weather-api',
  'presence-detector',
  'voice-assistant',
  'smart-speakers'
]

smartHomeChannels.forEach(channel => {
  cyre.action({id: channel, payload: null})
})

// Smart home handlers with realistic logic
cyre.on('smart-lights', command => {
  console.log(
    `💡 Lights: ${command.action} - ${command.room} (${
      command.brightness || 100
    }%)`
  )
  return {
    action: command.action,
    room: command.room,
    brightness: command.brightness || 100,
    energyUsage: command.action === 'on' ? (command.brightness || 100) * 0.1 : 0
  }
})

cyre.on('smart-thermostat', command => {
  console.log(`🌡️ Thermostat: ${command.temperature}°F - ${command.mode}`)
  return {
    temperature: command.temperature,
    mode: command.mode,
    energyUsage: Math.abs(command.temperature - 72) * 0.5
  }
})

cyre.on('smart-locks', command => {
  console.log(`🔒 Lock: ${command.action} - ${command.door}`)
  return {
    action: command.action,
    door: command.door,
    timestamp: Date.now(),
    secure: command.action === 'lock'
  }
})

cyre.on('alarm-system', command => {
  console.log(`🚨 Alarm: ${command.action} - Level: ${command.level}`)
  return {
    action: command.action,
    level: command.level,
    timestamp: Date.now()
  }
})

cyre.on('notification-service', data => {
  console.log(`📱 Notification: ${data.message} (${data.priority})`)
  return {sent: true, messageId: `msg_${Date.now()}`, delivery: 'immediate'}
})

cyre.on('security-camera', command => {
  console.log(`📹 Camera: ${command.action} - ${command.location}`)
  return {
    action: command.action,
    location: command.location,
    recording: command.action === 'start_recording',
    timestamp: Date.now()
  }
})

cyre.on('energy-monitor', data => {
  const totalUsage = data.devices.reduce((sum, device) => sum + device.usage, 0)
  console.log(`⚡ Energy Monitor: ${totalUsage.toFixed(2)}kW total usage`)
  return {
    totalUsage,
    devices: data.devices,
    cost: totalUsage * 0.12, // $0.12 per kWh
    recommendation: totalUsage > 5 ? 'reduce_usage' : 'normal'
  }
})

// Complex smart home orchestration
const smartHomeOrchestration = cyre.orchestration.create({
  id: 'smart-home-automation',
  name: 'Advanced Smart Home System',

  triggers: [
    {
      name: 'motion-detected',
      type: 'channel',
      channels: 'motion-sensor',
      condition: payload => payload.detected === true
    },
    {
      name: 'door-opened',
      type: 'channel',
      channels: 'door-sensor',
      condition: payload => payload.status === 'opened'
    },
    {
      name: 'energy-optimization',
      type: 'time',
      interval: 30000 // Every 30 seconds for demo
    },
    {
      name: 'security-check',
      type: 'time',
      interval: 60000 // Every minute for demo
    }
  ],

  workflow: [
    // Determine scenario based on trigger
    {
      name: 'scenario-detection',
      type: 'condition',
      condition: context => context.trigger.type === 'channel',
      steps: [
        // Motion-based automation
        {
          name: 'motion-response',
          type: 'condition',
          condition: context => context.trigger.name === 'motion-detected',
          steps: [
            {
              name: 'check-time-of-day',
              type: 'condition',
              condition: context => {
                const hour = new Date().getHours()
                const isNight = hour < 6 || hour > 20
                context.variables.isNight = isNight
                context.variables.hour = hour
                return true
              },
              steps: [
                {
                  name: 'nighttime-response',
                  type: 'condition',
                  condition: context => context.variables.isNight,
                  steps: [
                    {
                      name: 'activate-night-lighting',
                      type: 'parallel',
                      steps: [
                        {
                          name: 'dim-lights',
                          type: 'action',
                          targets: 'smart-lights',
                          payload: context => ({
                            action: 'on',
                            room: context.trigger.payload.room,
                            brightness: 30
                          })
                        },
                        {
                          name: 'start-security-recording',
                          type: 'action',
                          targets: 'security-camera',
                          payload: context => ({
                            action: 'start_recording',
                            location: context.trigger.payload.room
                          })
                        }
                      ]
                    }
                  ]
                },
                {
                  name: 'daytime-response',
                  type: 'condition',
                  condition: context => !context.variables.isNight,
                  steps: [
                    {
                      name: 'normal-lighting',
                      type: 'action',
                      targets: 'smart-lights',
                      payload: context => ({
                        action: 'on',
                        room: context.trigger.payload.room,
                        brightness: 80
                      })
                    }
                  ]
                }
              ]
            }
          ]
        },
        // Door-based security
        {
          name: 'door-security-response',
          type: 'condition',
          condition: context => context.trigger.name === 'door-opened',
          steps: [
            {
              name: 'verify-authorized-entry',
              type: 'condition',
              condition: context => {
                // Simulate authorization check
                const isAuthorized = Math.random() > 0.2 // 80% authorized
                context.variables.isAuthorized = isAuthorized
                return true
              },
              steps: [
                {
                  name: 'unauthorized-entry-response',
                  type: 'condition',
                  condition: context => !context.variables.isAuthorized,
                  steps: [
                    {
                      name: 'security-alert-sequence',
                      type: 'sequential',
                      steps: [
                        {
                          name: 'trigger-alarm',
                          type: 'action',
                          targets: 'alarm-system',
                          payload: () => ({
                            action: 'activate',
                            level: 'high',
                            reason: 'unauthorized_entry'
                          })
                        },
                        {
                          name: 'lock-all-doors',
                          type: 'action',
                          targets: 'smart-locks',
                          payload: () => ({
                            action: 'lock',
                            door: 'all'
                          })
                        },
                        {
                          name: 'send-security-notification',
                          type: 'action',
                          targets: 'notification-service',
                          payload: () => ({
                            message:
                              'SECURITY ALERT: Unauthorized entry detected',
                            priority: 'critical',
                            recipients: ['homeowner', 'security_service']
                          })
                        }
                      ]
                    }
                  ]
                },
                {
                  name: 'authorized-entry-response',
                  type: 'condition',
                  condition: context => context.variables.isAuthorized,
                  steps: [
                    {
                      name: 'welcome-sequence',
                      type: 'parallel',
                      steps: [
                        {
                          name: 'welcome-lighting',
                          type: 'action',
                          targets: 'smart-lights',
                          payload: () => ({
                            action: 'on',
                            room: 'entrance',
                            brightness: 100
                          })
                        },
                        {
                          name: 'comfort-temperature',
                          type: 'action',
                          targets: 'smart-thermostat',
                          payload: () => ({
                            temperature: 72,
                            mode: 'auto'
                          })
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    // Time-based maintenance tasks
    {
      name: 'scheduled-tasks',
      type: 'condition',
      condition: context => context.trigger.type === 'time',
      steps: [
        {
          name: 'energy-optimization',
          type: 'condition',
          condition: context => context.trigger.name === 'energy-optimization',
          steps: [
            {
              name: 'collect-energy-data',
              type: 'action',
              targets: 'energy-monitor',
              payload: () => ({
                devices: [
                  {name: 'lights', usage: Math.random() * 2},
                  {name: 'thermostat', usage: Math.random() * 3},
                  {name: 'security', usage: Math.random() * 1}
                ]
              })
            },
            {
              name: 'optimize-if-needed',
              type: 'condition',
              condition: context => {
                const energyResult =
                  context.stepHistory[context.stepHistory.length - 1]
                    ?.result?.[0]?.result
                return (
                  energyResult && energyResult.recommendation === 'reduce_usage'
                )
              },
              steps: [
                {
                  name: 'energy-saving-actions',
                  type: 'parallel',
                  steps: [
                    {
                      name: 'dim-non-essential-lights',
                      type: 'action',
                      targets: 'smart-lights',
                      payload: () => ({
                        action: 'dim',
                        room: 'all',
                        brightness: 50
                      })
                    },
                    {
                      name: 'adjust-thermostat',
                      type: 'action',
                      targets: 'smart-thermostat',
                      payload: () => ({
                        temperature: 70,
                        mode: 'eco'
                      })
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          name: 'security-check',
          type: 'condition',
          condition: context => context.trigger.name === 'security-check',
          steps: [
            {
              name: 'verify-all-locks',
              type: 'action',
              targets: 'smart-locks',
              payload: () => ({
                action: 'verify',
                door: 'all'
              })
            },
            {
              name: 'camera-health-check',
              type: 'action',
              targets: 'security-camera',
              payload: () => ({
                action: 'health_check',
                location: 'all'
              })
            }
          ]
        }
      ]
    }
  ],

  errorHandling: {
    retries: 2,
    timeout: 30000,
    fallback: 'notification-service',
    notifications: ['notification-service']
  }
})

// =============================================================================
// CI/CD PIPELINE ORCHESTRATION
// =============================================================================

// Setup CI/CD channels
const cicdChannels = [
  'git-webhook',
  'code-analysis',
  'unit-tests',
  'integration-tests',
  'security-scan',
  'build-docker',
  'push-registry',
  'deploy-staging',
  'smoke-tests',
  'deploy-production',
  'rollback',
  'slack-notify',
  'email-notify',
  'metrics-collector',
  'performance-test'
]

cicdChannels.forEach(channel => {
  cyre.action({id: channel, payload: null})
})

// CI/CD handlers
cyre.on('code-analysis', data => {
  const score = Math.random() * 100
  const passed = score > 70
  console.log(
    `🔍 Code Analysis: ${score.toFixed(1)}/100 - ${
      passed ? 'PASSED' : 'FAILED'
    }`
  )
  return {
    score,
    passed,
    issues: passed ? [] : ['complexity_high', 'coverage_low'],
    timestamp: Date.now()
  }
})

cyre.on('unit-tests', data => {
  const passed = Math.random() > 0.1 // 90% pass rate
  const coverage = Math.random() * 40 + 60 // 60-100%
  console.log(
    `🧪 Unit Tests: ${
      passed ? 'PASSED' : 'FAILED'
    } - Coverage: ${coverage.toFixed(1)}%`
  )
  return {
    passed,
    coverage,
    testsRun: 247,
    failures: passed ? 0 : Math.floor(Math.random() * 5) + 1
  }
})

cyre.on('integration-tests', data => {
  const passed = Math.random() > 0.15 // 85% pass rate
  console.log(`🔗 Integration Tests: ${passed ? 'PASSED' : 'FAILED'}`)
  return {
    passed,
    testsRun: 42,
    duration: Math.floor(Math.random() * 300) + 60 // 1-6 minutes
  }
})

cyre.on('security-scan', data => {
  const vulnerabilities = Math.floor(Math.random() * 3) // 0-2 vulnerabilities
  const passed = vulnerabilities === 0
  console.log(`🛡️ Security Scan: ${vulnerabilities} vulnerabilities found`)
  return {
    passed,
    vulnerabilities,
    severity: vulnerabilities > 0 ? 'medium' : 'none'
  }
})

cyre.on('build-docker', data => {
  const success = Math.random() > 0.05 // 95% success rate
  console.log(`🐳 Docker Build: ${success ? 'SUCCESS' : 'FAILED'}`)
  return {
    success,
    imageTag: success ? `v${Date.now()}` : null,
    size: success ? Math.floor(Math.random() * 500) + 100 : null // MB
  }
})

cyre.on('deploy-staging', data => {
  console.log(`🚀 Deploying to staging: ${data.imageTag}`)
  return {
    deployed: true,
    environment: 'staging',
    url: `https://staging.app.com`,
    imageTag: data.imageTag
  }
})

cyre.on('deploy-production', data => {
  console.log(`🌐 Deploying to production: ${data.imageTag}`)
  return {
    deployed: true,
    environment: 'production',
    url: `https://app.com`,
    imageTag: data.imageTag
  }
})

cyre.on('slack-notify', data => {
  console.log(`💬 Slack: ${data.message}`)
  return {sent: true, channel: data.channel, timestamp: Date.now()}
})

// Complex CI/CD Pipeline Orchestration
const cicdOrchestration = cyre.orchestration.create({
  id: 'cicd-pipeline',
  name: 'Advanced CI/CD Pipeline',

  triggers: [
    {
      name: 'code-push',
      type: 'channel',
      channels: 'git-webhook',
      condition: payload =>
        payload.branch === 'main' || payload.branch.startsWith('release/')
    }
  ],

  workflow: [
    // Phase 1: Code Quality and Testing
    {
      name: 'quality-gate-phase',
      type: 'sequential',
      steps: [
        {
          name: 'parallel-quality-checks',
          type: 'parallel',
          steps: [
            {
              name: 'static-analysis',
              type: 'action',
              targets: 'code-analysis',
              payload: context => ({
                commit: context.trigger.payload.commit,
                branch: context.trigger.payload.branch
              })
            },
            {
              name: 'run-unit-tests',
              type: 'action',
              targets: 'unit-tests',
              payload: context => ({
                commit: context.trigger.payload.commit
              })
            },
            {
              name: 'security-analysis',
              type: 'action',
              targets: 'security-scan',
              payload: context => ({
                commit: context.trigger.payload.commit
              })
            }
          ]
        },
        {
          name: 'evaluate-quality-gate',
          type: 'condition',
          condition: context => {
            // Find results from parallel quality checks
            const analysisResult = context.stepHistory.find(
              s => s.stepName === 'static-analysis'
            )?.result?.[0]?.result
            const testResult = context.stepHistory.find(
              s => s.stepName === 'run-unit-tests'
            )?.result?.[0]?.result
            const securityResult = context.stepHistory.find(
              s => s.stepName === 'security-analysis'
            )?.result?.[0]?.result

            const qualityPassed =
              analysisResult?.passed &&
              testResult?.passed &&
              securityResult?.passed
            context.variables.qualityGatePassed = qualityPassed

            console.log(`Quality Gate: ${qualityPassed ? 'PASSED' : 'FAILED'}`)
            return qualityPassed
          },
          steps: [
            // Phase 2: Integration Testing
            {
              name: 'integration-testing-phase',
              type: 'action',
              targets: 'integration-tests',
              payload: context => ({
                commit: context.trigger.payload.commit
              })
            },
            {
              name: 'integration-gate-check',
              type: 'condition',
              condition: context => {
                const integrationResult =
                  context.stepHistory[context.stepHistory.length - 1]
                    ?.result?.[0]?.result
                const passed = integrationResult?.passed
                context.variables.integrationPassed = passed
                return passed
              },
              steps: [
                // Phase 3: Build and Deploy Pipeline
                {
                  name: 'build-and-deploy-phase',
                  type: 'sequential',
                  steps: [
                    {
                      name: 'build-container',
                      type: 'action',
                      targets: 'build-docker',
                      payload: context => ({
                        commit: context.trigger.payload.commit,
                        branch: context.trigger.payload.branch
                      })
                    },
                    {
                      name: 'build-success-check',
                      type: 'condition',
                      condition: context => {
                        const buildResult =
                          context.stepHistory[context.stepHistory.length - 1]
                            ?.result?.[0]?.result
                        context.variables.imageTag = buildResult?.imageTag
                        return buildResult?.success
                      },
                      steps: [
                        {
                          name: 'staging-deployment',
                          type: 'action',
                          targets: 'deploy-staging',
                          payload: context => ({
                            imageTag: context.variables.imageTag,
                            commit: context.trigger.payload.commit
                          })
                        },
                        {
                          name: 'staging-verification',
                          type: 'delay',
                          timeout: 3000 // Wait 3 seconds for staging to be ready
                        },
                        // Branch-specific deployment logic
                        {
                          name: 'production-deployment-gate',
                          type: 'condition',
                          condition: context => {
                            const isMainBranch =
                              context.trigger.payload.branch === 'main'
                            const isReleaseBranch =
                              context.trigger.payload.branch.startsWith(
                                'release/'
                              )
                            return isMainBranch || isReleaseBranch
                          },
                          steps: [
                            {
                              name: 'deploy-to-production',
                              type: 'action',
                              targets: 'deploy-production',
                              payload: context => ({
                                imageTag: context.variables.imageTag,
                                commit: context.trigger.payload.commit,
                                branch: context.trigger.payload.branch
                              })
                            },
                            {
                              name: 'success-notification',
                              type: 'action',
                              targets: 'slack-notify',
                              payload: context => ({
                                message: `🎉 Production deployment successful! Version ${context.variables.imageTag} is live.`,
                                channel: '#deployments',
                                commit: context.trigger.payload.commit,
                                author: context.trigger.payload.author
                              })
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],

  errorHandling: {
    retries: 1,
    timeout: 600000, // 10 minutes
    fallback: 'slack-notify',
    notifications: ['slack-notify']
  }
})

// =============================================================================
// MICROSERVICES HEALTH MONITORING
// =============================================================================

// Setup microservices monitoring
const microservices = [
  'user-service',
  'payment-service',
  'inventory-service',
  'notification-service',
  'analytics-service',
  'auth-service',
  'order-service',
  'shipping-service'
]

const monitoringChannels = [
  'health-check',
  'performance-monitor',
  'error-tracker',
  'log-aggregator',
  'metric-collector',
  'alert-manager',
  'auto-scaler',
  'circuit-breaker',
  'service-discovery',
  'load-balancer'
]

microservices.forEach(service => cyre.action({id: service, payload: null}))
monitoringChannels.forEach(channel => cyre.action({id: channel, payload: null}))

// Monitoring handlers
cyre.on('health-check', data => {
  const services = data.services.map(service => ({
    name: service,
    status: Math.random() > 0.1 ? 'healthy' : 'unhealthy', // 90% healthy
    responseTime: Math.floor(Math.random() * 200) + 50, // 50-250ms
    cpuUsage: Math.random() * 100,
    memoryUsage: Math.random() * 100
  }))

  console.log(
    `🏥 Health Check: ${services.filter(s => s.status === 'healthy').length}/${
      services.length
    } services healthy`
  )
  return {services, timestamp: Date.now()}
})

cyre.on('auto-scaler', data => {
  console.log(
    `📈 Auto Scaler: ${data.action} ${data.service} (Load: ${data.load}%)`
  )
  return {
    action: data.action,
    service: data.service,
    previousInstances: data.currentInstances,
    newInstances:
      data.action === 'scale_up'
        ? data.currentInstances + 1
        : Math.max(1, data.currentInstances - 1)
  }
})

cyre.on('circuit-breaker', data => {
  console.log(`🔌 Circuit Breaker: ${data.action} for ${data.service}`)
  return {
    service: data.service,
    state: data.action,
    timestamp: Date.now(),
    reason: data.reason
  }
})

cyre.on('alert-manager', data => {
  console.log(`🚨 Alert: ${data.severity} - ${data.message}`)
  return {
    alertId: `alert_${Date.now()}`,
    severity: data.severity,
    acknowledged: false,
    escalated: data.severity === 'critical'
  }
})

// Microservices Monitoring Orchestration
const monitoringOrchestration = cyre.orchestration.create({
  id: 'microservices-monitoring',
  name: 'Microservices Health & Performance Monitoring',

  triggers: [
    {
      name: 'health-monitor',
      type: 'time',
      interval: 15000 // Every 15 seconds
    },
    {
      name: 'performance-monitor',
      type: 'time',
      interval: 20000 // Every 20 seconds
    }
  ],

  workflow: [
    {
      name: 'monitoring-type-detection',
      type: 'condition',
      condition: context => context.trigger.name === 'health-monitor',
      steps: [
        {
          name: 'comprehensive-health-check',
          type: 'action',
          targets: 'health-check',
          payload: () => ({services: microservices})
        },
        {
          name: 'analyze-health-results',
          type: 'condition',
          condition: context => {
            const healthResult =
              context.stepHistory[context.stepHistory.length - 1]?.result?.[0]
                ?.result
            const unhealthyServices =
              healthResult?.services.filter(s => s.status === 'unhealthy') || []
            const highLoadServices =
              healthResult?.services.filter(s => s.cpuUsage > 80) || []

            context.variables.unhealthyServices = unhealthyServices
            context.variables.highLoadServices = highLoadServices

            return unhealthyServices.length > 0 || highLoadServices.length > 0
          },
          steps: [
            {
              name: 'handle-unhealthy-services',
              type: 'condition',
              condition: context =>
                context.variables.unhealthyServices.length > 0,
              steps: [
                {
                  name: 'unhealthy-service-actions',
                  type: 'parallel',
                  steps: [
                    {
                      name: 'trigger-circuit-breaker',
                      type: 'action',
                      targets: 'circuit-breaker',
                      payload: context => ({
                        action: 'open',
                        service: context.variables.unhealthyServices[0]?.name,
                        reason: 'health_check_failed'
                      })
                    },
                    {
                      name: 'send-critical-alert',
                      type: 'action',
                      targets: 'alert-manager',
                      payload: context => ({
                        severity: 'critical',
                        message: `Service ${context.variables.unhealthyServices[0]?.name} is unhealthy`,
                        services: context.variables.unhealthyServices.map(
                          s => s.name
                        )
                      })
                    }
                  ]
                }
              ]
            },
            {
              name: 'handle-high-load-services',
              type: 'condition',
              condition: context =>
                context.variables.highLoadServices.length > 0,
              steps: [
                {
                  name: 'auto-scaling-decision',
                  type: 'action',
                  targets: 'auto-scaler',
                  payload: context => {
                    const service = context.variables.highLoadServices[0]
                    return {
                      action: 'scale_up',
                      service: service.name,
                      load: service.cpuUsage,
                      currentInstances: Math.floor(Math.random() * 5) + 2 // 2-6 instances
                    }
                  }
                },
                {
                  name: 'scaling-alert',
                  type: 'action',
                  targets: 'alert-manager',
                  payload: context => ({
                    severity: 'warning',
                    message: `Auto-scaling triggered for high load services`,
                    services: context.variables.highLoadServices.map(
                      s => s.name
                    )
                  })
                }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'performance-monitoring',
      type: 'condition',
      condition: context => context.trigger.name === 'performance-monitor',
      steps: [
        {
          name: 'collect-performance-metrics',
          type: 'parallel',
          steps: [
            {
              name: 'check-response-times',
              type: 'action',
              targets: 'health-check',
              payload: () => ({
                services: ['user-service', 'payment-service', 'order-service']
              })
            },
            {
              name: 'check-database-performance',
              type: 'action',
              targets: 'health-check',
              payload: () => ({
                services: ['inventory-service', 'analytics-service']
              })
            }
          ]
        },
        {
          name: 'performance-analysis',
          type: 'condition',
          condition: context => {
            // Analyze performance from both checks
            const allServices = context.stepHistory
              .filter(
                s =>
                  s.stepName === 'check-response-times' ||
                  s.stepName === 'check-database-performance'
              )
              .flatMap(s => s.result?.[0]?.result?.services || [])

            const slowServices = allServices.filter(s => s.responseTime > 200)
            context.variables.slowServices = slowServices

            return slowServices.length > 0
          },
          steps: [
            {
              name: 'performance-optimization',
              type: 'sequential',
              steps: [
                {
                  name: 'alert-slow-performance',
                  type: 'action',
                  targets: 'alert-manager',
                  payload: context => ({
                    severity: 'warning',
                    message: `Performance degradation detected in ${context.variables.slowServices.length} services`,
                    services: context.variables.slowServices.map(s => s.name)
                  })
                },
                {
                  name: 'auto-scale-slow-services',
                  type: 'action',
                  targets: 'auto-scaler',
                  payload: context => {
                    const slowService = context.variables.slowServices[0]
                    return {
                      action: 'scale_up',
                      service: slowService.name,
                      load: 85,
                      currentInstances: Math.floor(Math.random() * 3) + 2
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ],

  errorHandling: {
    retries: 3,
    timeout: 45000,
    fallback: 'alert-manager',
    notifications: ['alert-manager']
  }
})

// =============================================================================
// FINANCIAL TRADING SYSTEM
// =============================================================================

// Setup trading channels
const tradingChannels = [
  'market-data',
  'price-alert',
  'trading-signal',
  'risk-analyzer',
  'portfolio-manager',
  'order-executor',
  'compliance-check',
  'trade-reporter',
  'margin-calculator',
  'volatility-monitor',
  'news-analyzer',
  'sentiment-analyzer'
]

tradingChannels.forEach(channel => cyre.action({id: channel, payload: null}))

// Trading handlers with sophisticated logic
cyre.on('market-data', data => {
  const price = data.basePrice + (Math.random() - 0.5) * data.basePrice * 0.05 // ±5% volatility
  const volume = Math.floor(Math.random() * 1000000) + 100000
  console.log(
    `📈 Market Data: ${data.symbol} ${price.toFixed(
      2
    )} (Volume: ${volume.toLocaleString()})`
  )
  return {
    symbol: data.symbol,
    price,
    volume,
    timestamp: Date.now(),
    change: (((price - data.basePrice) / data.basePrice) * 100).toFixed(2)
  }
})

cyre.on('risk-analyzer', data => {
  const riskScore = Math.random() * 100
  const riskLevel = riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low'
  console.log(
    `⚠️ Risk Analysis: ${
      data.symbol
    } - ${riskLevel.toUpperCase()} risk (${riskScore.toFixed(1)})`
  )
  return {
    symbol: data.symbol,
    riskScore,
    riskLevel,
    recommendation:
      riskLevel === 'high'
        ? 'reduce_position'
        : riskLevel === 'medium'
        ? 'hold'
        : 'safe_to_trade',
    factors: ['volatility', 'market_sentiment', 'correlation']
  }
})

cyre.on('trading-signal', data => {
  const signals = ['buy', 'sell', 'hold']
  const signal = signals[Math.floor(Math.random() * signals.length)]
  const confidence = Math.random() * 100
  console.log(
    `🎯 Trading Signal: ${signal.toUpperCase()} ${
      data.symbol
    } (Confidence: ${confidence.toFixed(1)}%)`
  )
  return {
    symbol: data.symbol,
    signal,
    confidence,
    price: data.price,
    strategy: 'momentum_following'
  }
})

cyre.on('order-executor', data => {
  const success = Math.random() > 0.05 // 95% success rate
  const executedPrice = data.price + (Math.random() - 0.5) * 0.1 // Small slippage
  console.log(
    `💰 Order: ${data.action.toUpperCase()} ${data.quantity} ${
      data.symbol
    } @ ${executedPrice.toFixed(2)} - ${success ? 'FILLED' : 'REJECTED'}`
  )
  return {
    orderId: `order_${Date.now()}`,
    symbol: data.symbol,
    action: data.action,
    quantity: data.quantity,
    requestedPrice: data.price,
    executedPrice: success ? executedPrice : null,
    status: success ? 'filled' : 'rejected',
    timestamp: Date.now()
  }
})

cyre.on('compliance-check', data => {
  const compliant = Math.random() > 0.02 // 98% compliance rate
  console.log(
    `🏛️ Compliance: ${data.symbol} ${data.action} - ${
      compliant ? 'APPROVED' : 'BLOCKED'
    }`
  )
  return {
    approved: compliant,
    reason: compliant ? 'all_checks_passed' : 'position_limit_exceeded',
    checks: ['position_limits', 'regulatory_rules', 'risk_limits']
  }
})

// Advanced Trading Orchestration
const tradingOrchestration = cyre.orchestration.create({
  id: 'algorithmic-trading-system',
  name: 'Advanced Algorithmic Trading System',

  triggers: [
    {
      name: 'market-price-update',
      type: 'channel',
      channels: 'market-data',
      condition: payload => Math.abs(parseFloat(payload.change)) > 1 // Significant price movement
    },
    {
      name: 'trading-opportunity-scan',
      type: 'time',
      interval: 25000 // Every 25 seconds
    }
  ],

  workflow: [
    {
      name: 'trading-decision-pipeline',
      type: 'condition',
      condition: context => context.trigger.name === 'market-price-update',
      steps: [
        {
          name: 'market-analysis-phase',
          type: 'parallel',
          steps: [
            {
              name: 'risk-assessment',
              type: 'action',
              targets: 'risk-analyzer',
              payload: context => ({
                symbol: context.trigger.payload.symbol,
                price: context.trigger.payload.price,
                volume: context.trigger.payload.volume
              })
            },
            {
              name: 'generate-trading-signal',
              type: 'action',
              targets: 'trading-signal',
              payload: context => ({
                symbol: context.trigger.payload.symbol,
                price: context.trigger.payload.price
              })
            }
          ]
        },
        {
          name: 'evaluate-trading-opportunity',
          type: 'condition',
          condition: context => {
            const riskResult = context.stepHistory.find(
              s => s.stepName === 'risk-assessment'
            )?.result?.[0]?.result
            const signalResult = context.stepHistory.find(
              s => s.stepName === 'generate-trading-signal'
            )?.result?.[0]?.result

            // Trading logic: only trade if risk is acceptable and signal confidence is high
            const riskAcceptable = riskResult?.riskLevel !== 'high'
            const signalStrong =
              signalResult?.confidence > 70 && signalResult?.signal !== 'hold'

            context.variables.shouldTrade = riskAcceptable && signalStrong
            context.variables.tradingSignal = signalResult
            context.variables.riskAssessment = riskResult

            console.log(
              `Trading Decision: Risk ${riskResult?.riskLevel}, Signal ${
                signalResult?.signal
              } (${signalResult?.confidence.toFixed(1)}%), Trade: ${
                context.variables.shouldTrade
              }`
            )

            return context.variables.shouldTrade
          },
          steps: [
            {
              name: 'pre-trade-validation',
              type: 'sequential',
              steps: [
                {
                  name: 'compliance-verification',
                  type: 'action',
                  targets: 'compliance-check',
                  payload: context => ({
                    symbol: context.trigger.payload.symbol,
                    action: context.variables.tradingSignal.signal,
                    quantity: 100, // Standard lot size
                    price: context.trigger.payload.price
                  })
                },
                {
                  name: 'compliance-gate',
                  type: 'condition',
                  condition: context => {
                    const complianceResult =
                      context.stepHistory[context.stepHistory.length - 1]
                        ?.result?.[0]?.result
                    return complianceResult?.approved
                  },
                  steps: [
                    {
                      name: 'execute-trade',
                      type: 'action',
                      targets: 'order-executor',
                      payload: context => ({
                        symbol: context.trigger.payload.symbol,
                        action: context.variables.tradingSignal.signal,
                        quantity: 100,
                        price: context.trigger.payload.price,
                        orderType: 'market'
                      })
                    },
                    {
                      name: 'post-trade-analysis',
                      type: 'condition',
                      condition: context => {
                        const executionResult =
                          context.stepHistory[context.stepHistory.length - 1]
                            ?.result?.[0]?.result
                        return executionResult?.status === 'filled'
                      },
                      steps: [
                        {
                          name: 'update-risk-monitoring',
                          type: 'action',
                          targets: 'risk-analyzer',
                          payload: context => {
                            const execution = context.stepHistory.find(
                              s => s.stepName === 'execute-trade'
                            )?.result?.[0]?.result
                            return {
                              symbol: execution.symbol,
                              newPosition:
                                execution.action === 'buy'
                                  ? execution.quantity
                                  : -execution.quantity,
                              executedPrice: execution.executedPrice
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'periodic-market-scan',
      type: 'condition',
      condition: context => context.trigger.name === 'trading-opportunity-scan',
      steps: [
        {
          name: 'multi-symbol-analysis',
          type: 'parallel',
          steps: [
            {
              name: 'scan-tech-stocks',
              type: 'action',
              targets: 'market-data',
              payload: () => ({
                symbol: 'AAPL',
                basePrice: 175.5
              })
            },
            {
              name: 'scan-crypto',
              type: 'action',
              targets: 'market-data',
              payload: () => ({
                symbol: 'BTC',
                basePrice: 45000
              })
            },
            {
              name: 'scan-forex',
              type: 'action',
              targets: 'market-data',
              payload: () => ({
                symbol: 'EURUSD',
                basePrice: 1.085
              })
            }
          ]
        },
        {
          name: 'opportunity-evaluation',
          type: 'condition',
          condition: context => {
            // Find symbols with significant price movements
            const marketResults = context.stepHistory
              .filter(s => s.stepName.startsWith('scan-'))
              .map(s => s.result?.[0]?.result)
              .filter(r => r && Math.abs(parseFloat(r.change)) > 2) // >2% movement

            context.variables.opportunities = marketResults
            return marketResults.length > 0
          },
          steps: [
            {
              name: 'analyze-top-opportunity',
              type: 'sequential',
              steps: [
                {
                  name: 'detailed-risk-analysis',
                  type: 'action',
                  targets: 'risk-analyzer',
                  payload: context => {
                    const topOpportunity = context.variables.opportunities[0]
                    return {
                      symbol: topOpportunity.symbol,
                      price: topOpportunity.price,
                      volume: topOpportunity.volume
                    }
                  }
                },
                {
                  name: 'generate-opportunity-signal',
                  type: 'action',
                  targets: 'trading-signal',
                  payload: context => {
                    const topOpportunity = context.variables.opportunities[0]
                    return {
                      symbol: topOpportunity.symbol,
                      price: topOpportunity.price
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ],

  errorHandling: {
    retries: 2,
    timeout: 30000,
    fallback: 'trade-reporter',
    notifications: ['trade-reporter']
  }
})

// =============================================================================
// ORCHESTRATION EXECUTION
// =============================================================================

console.log('🚀 Starting Advanced Orchestration Examples')
console.log('='.repeat(60))

// Start all orchestrations
const orchestrations = [
  {
    config: smartHomeOrchestration,
    id: 'smart-home-automation',
    name: 'Smart Home'
  },
  {config: cicdOrchestration, id: 'cicd-pipeline', name: 'CI/CD Pipeline'},
  {
    config: monitoringOrchestration,
    id: 'microservices-monitoring',
    name: 'Microservices Monitoring'
  },
  {
    config: tradingOrchestration,
    id: 'algorithmic-trading-system',
    name: 'Trading System'
  }
]

orchestrations.forEach(({config, id, name}) => {
  if (config.ok) {
    console.log(`✅ ${name} orchestration created`)
    const startResult = cyre.orchestration.start(id)
    if (startResult.ok) {
      console.log(`🟢 ${name} orchestration started`)
    } else {
      console.error(`❌ Failed to start ${name}:`, startResult.message)
    }
  } else {
    console.error(`❌ Failed to create ${name}:`, config.message)
  }
})

// =============================================================================
// SIMULATION DATA GENERATION
// =============================================================================

console.log('\n🎮 Starting Complex Orchestration Simulations...\n')

// Smart Home Events
setTimeout(() => {
  console.log('🏠 === SMART HOME SIMULATION ===')
  cyre.call('motion-sensor', {
    detected: true,
    room: 'living-room',
    timestamp: Date.now()
  })
}, 2000)

setTimeout(() => {
  cyre.call('door-sensor', {
    status: 'opened',
    door: 'front-door',
    timestamp: Date.now()
  })
}, 4000)

// CI/CD Pipeline Trigger
setTimeout(() => {
  console.log('\n💻 === CI/CD PIPELINE SIMULATION ===')
  cyre.call('git-webhook', {
    branch: 'main',
    commit: 'abc123def456',
    author: 'developer@company.com',
    message: 'feat: add new payment processing feature'
  })
}, 6000)

// Trading System Events
setTimeout(() => {
  console.log('\n📊 === TRADING SYSTEM SIMULATION ===')
  cyre.call('market-data', {
    symbol: 'TSLA',
    basePrice: 250.0,
    change: '+3.2', // Significant price movement to trigger trading
    volume: 2500000
  })
}, 8000)

setTimeout(() => {
  cyre.call('market-data', {
    symbol: 'NVDA',
    basePrice: 450.0,
    change: '-2.8', // Significant downward movement
    volume: 1800000
  })
}, 10000)

// Show final metrics and stop orchestrations
setTimeout(() => {
  console.log('\n📈 === FINAL ORCHESTRATION METRICS ===')
  orchestrations.forEach(({id, name}) => {
    const orchestration = cyre.orchestration.get(id)
    if (orchestration && orchestration.metrics.totalExecutions > 0) {
      console.log(`\n${name} Results:`)
      console.log(`- Executions: ${orchestration.metrics.totalExecutions}`)
      console.log(
        `- Success Rate: ${(
          (orchestration.metrics.successfulExecutions /
            orchestration.metrics.totalExecutions) *
          100
        ).toFixed(1)}%`
      )
      console.log(
        `- Avg Time: ${orchestration.metrics.averageExecutionTime.toFixed(2)}ms`
      )
      console.log(`- Status: ${orchestration.status}`)
    }
  })

  console.log('\n🛑 Stopping all orchestrations...')
  orchestrations.forEach(({id}) => {
    cyre.orchestration.stop(id)
  })

  console.log('\n🎯 Advanced Orchestration Demo Complete!')
  console.log('Features demonstrated:')
  console.log('- Complex conditional workflows')
  console.log('- Parallel and sequential execution')
  console.log('- Multi-trigger orchestrations')
  console.log('- Error handling and fallbacks')
  console.log('- Real-world business logic')
  console.log('- Cross-service communication')
  console.log('- Dynamic payload transformation')
  console.log('- Performance monitoring')
}, 25000)
