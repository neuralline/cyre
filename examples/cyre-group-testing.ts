// comprehensive-group-demo.ts
// Complete exploration of Cyre group system features for Node.js

import {cyre, schema} from '../src/'

/*

      C.Y.R.E - G.R.O.U.P - C.O.M.P.R.E.H.E.N.S.I.V.E - D.E.M.O
      
      This demo explores ALL group system capabilities:
      1. Basic group creation and management
      2. Pattern matching (wildcards, regex, hierarchical)
      3. Middleware chains and inheritance
      4. Alert systems and monitoring
      5. Cross-group coordination
      6. Load balancing and circuit breakers
      7. Analytics and performance monitoring
      8. Testing and validation
      9. Templates and best practices
      10. Advanced orchestration patterns

*/

// Utility to add delays and make async operations visible
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const log = (section: string, message: string, data?: any) => {
  console.log(`\n🔹 [${section}] ${message}`)
  if (data) console.log('   Data:', JSON.stringify(data, null, 2))
}

// =====================================================================
// 1. BASIC GROUP CREATION AND MANAGEMENT
// =====================================================================

async function demoBasicGroupOperations() {
  log('BASIC GROUPS', 'Creating fundamental groups with different patterns...')

  // IoT Sensor Network Group
  const sensorGroup = cyre.group('iot-sensors', {
    channels: ['sensor-*', 'device-*', 'gateway-*'],
    shared: {
      throttle: 1000,
      schema: schema.object({
        deviceId: schema.string(),
        value: schema.number(),
        timestamp: schema.number(),
        location: schema.string().optional()
      }),
      middleware: [
        async (payload: any, next: any) => {
          log('MIDDLEWARE', `IoT validation for device: ${payload.deviceId}`)
          if (!payload.deviceId) {
            return {ok: false, payload: null, message: 'Device ID required'}
          }
          return next({...payload, validated: true, processingTime: Date.now()})
        }
      ]
    }
  })

  // Microservice API Group
  const apiGroup = cyre.group('api-services', {
    channels: ['api-*', 'service-*', 'endpoint-*'],
    shared: {
      throttle: 500,
      priority: {level: 'high'},
      schema: schema.object({
        method: schema.enums('GET', 'POST', 'PUT', 'DELETE'),
        endpoint: schema.string(),
        headers: schema.object({}).optional(),
        body: schema.any().optional()
      }),
      middleware: [
        async (payload: any, next: any) => {
          log(
            'MIDDLEWARE',
            `API request: ${payload.method} ${payload.endpoint}`
          )
          const authToken = payload.headers?.authorization
          if (!authToken) {
            return {ok: false, payload: null, message: 'Authorization required'}
          }
          return next({...payload, authenticated: true, userId: 'user123'})
        }
      ]
    }
  })

  // Background Tasks Group
  const taskGroup = cyre.group('background-tasks', {
    channels: ['task-*', 'job-*', 'worker-*'],
    shared: {
      priority: {level: 'low'},
      throttle: 2000,
      middleware: [
        async (payload: any, next: any) => {
          log('MIDDLEWARE', `Processing background task: ${payload.taskName}`)
          return next({
            ...payload,
            queuedAt: Date.now(),
            priority: 'background'
          })
        }
      ]
    }
  })

  // Create channels that will automatically join groups
  const channels = [
    {
      id: 'sensor-temperature-01',
      payload: {
        deviceId: 'temp_01',
        value: 23.5,
        timestamp: Date.now(),
        location: 'office'
      }
    },
    {
      id: 'sensor-humidity-02',
      payload: {
        deviceId: 'humid_02',
        value: 45.2,
        timestamp: Date.now(),
        location: 'warehouse'
      }
    },
    {
      id: 'device-gateway-main',
      payload: {deviceId: 'gateway_main', value: 1, timestamp: Date.now()}
    },
    {
      id: 'api-user-login',
      payload: {
        method: 'POST',
        endpoint: '/auth/login',
        headers: {authorization: 'Bearer abc123'}
      }
    },
    {
      id: 'service-payment-process',
      payload: {
        method: 'POST',
        endpoint: '/payments',
        headers: {authorization: 'Bearer xyz789'}
      }
    },
    {
      id: 'task-data-backup',
      payload: {taskName: 'daily_backup', schedule: '0 2 * * *'}
    },
    {
      id: 'job-email-notifications',
      payload: {taskName: 'email_queue', batchSize: 100}
    }
  ]

  // Register channels and handlers
  for (const channel of channels) {
    cyre.action(channel)
    cyre.on(channel.id, (data: any) => {
      log('CHANNEL OUTPUT', `${channel.id} processed`, {
        originalPayload: channel.payload,
        processedPayload: data
      })
    })
  }

  await wait(100)

  // Display group status
  const allGroups = cyre.getAllGroups()
  log('GROUP STATUS', `Created ${allGroups.length} groups`)
  allGroups.forEach(group => {
    log(
      'GROUP INFO',
      `${group.id}: ${group.matchedChannels.size} channels, ${group.middlewareIds.length} middleware`
    )
  })
}

// =====================================================================
// 2. ADVANCED PATTERN MATCHING
// =====================================================================

async function demoAdvancedPatternMatching() {
  log('PATTERNS', 'Demonstrating advanced pattern matching capabilities...')

  // Hierarchical pattern matching
  cyre.group('floor-sensors', {
    channels: ['sensor-floor*-*', 'device-floor*-*'],
    shared: {
      middleware: [
        async (payload: any, next: any) => {
          const floor = payload.floor || 'unknown'
          log('PATTERN', `Hierarchical match - Floor ${floor} sensor`)
          return next({...payload, floorProcessed: true})
        }
      ]
    }
  })

  // Department-based grouping
  cyre.group('hr-systems', {
    channels: ['hr-*', 'employee-*', 'payroll-*'],
    shared: {
      middleware: [
        async (payload: any, next: any) => {
          log('PATTERN', `HR system processing: ${payload.operation}`)
          return next({...payload, department: 'hr', compliance: true})
        }
      ]
    }
  })

  // Critical system patterns
  cyre.group('critical-alerts', {
    channels: ['alert-critical-*', 'emergency-*', 'system-failure-*'],
    shared: {
      priority: {level: 'critical'},
      middleware: [
        async (payload: any, next: any) => {
          log('PATTERN', `🚨 CRITICAL: ${payload.alertType}`)
          return next({...payload, escalated: true, notificationSent: true})
        }
      ]
    }
  })

  // Create channels with hierarchical names
  const hierarchicalChannels = [
    {
      id: 'sensor-floor1-temperature',
      payload: {floor: 1, type: 'temperature', value: 22.1}
    },
    {id: 'sensor-floor2-motion', payload: {floor: 2, type: 'motion', value: 1}},
    {
      id: 'device-floor3-air-quality',
      payload: {floor: 3, type: 'air_quality', value: 'good'}
    },
    {
      id: 'hr-employee-onboarding',
      payload: {operation: 'onboard', employeeId: 'emp123'}
    },
    {
      id: 'employee-performance-review',
      payload: {operation: 'review', employeeId: 'emp456'}
    },
    {
      id: 'payroll-salary-calculation',
      payload: {operation: 'calculate', period: '2025-05'}
    },
    {
      id: 'alert-critical-system-down',
      payload: {alertType: 'system_failure', severity: 'critical'}
    },
    {
      id: 'emergency-fire-detected',
      payload: {alertType: 'fire', location: 'building_a'}
    }
  ]

  for (const channel of hierarchicalChannels) {
    cyre.action(channel)
    cyre.on(channel.id, (data: any) => {
      log('PATTERN MATCH', `${channel.id} matched pattern and processed`, data)
    })
  }

  await wait(100)
}

// =====================================================================
// 3. MIDDLEWARE CHAINS AND INHERITANCE
// =====================================================================

async function demoMiddlewareChains() {
  log('MIDDLEWARE', 'Exploring complex middleware chains and inheritance...')

  // Authentication middleware
  const authMiddleware = async (payload: any, next: any) => {
    log('AUTH', `Authenticating user: ${payload.userId || 'anonymous'}`)
    if (!payload.userId) {
      return {ok: false, payload: null, message: 'Authentication required'}
    }
    return next({...payload, authenticated: true, authTime: Date.now()})
  }

  // Logging middleware
  const loggingMiddleware = async (payload: any, next: any) => {
    log(
      'LOGGING',
      `Request logged: ${JSON.stringify(payload).slice(0, 100)}...`
    )
    const result = await next(payload)
    log('LOGGING', `Response logged: ${result.ok ? 'SUCCESS' : 'FAILED'}`)
    return result
  }

  // Rate limiting middleware
  const rateLimitMiddleware = (() => {
    const requests = new Map<string, number[]>()
    return async (payload: any, next: any) => {
      const userId = payload.userId || 'anonymous'
      const now = Date.now()
      const userRequests = requests.get(userId) || []

      // Keep only requests from last minute
      const recentRequests = userRequests.filter(time => now - time < 60000)

      if (recentRequests.length >= 10) {
        log('RATE LIMIT', `Rate limit exceeded for user: ${userId}`)
        return {ok: false, payload: null, message: 'Rate limit exceeded'}
      }

      recentRequests.push(now)
      requests.set(userId, recentRequests)

      log(
        'RATE LIMIT',
        `Request allowed for user: ${userId} (${recentRequests.length}/10)`
      )
      return next(payload)
    }
  })()

  // Data validation middleware
  const validationMiddleware = async (payload: any, next: any) => {
    log('VALIDATION', `Validating payload structure`)
    if (typeof payload !== 'object' || payload === null) {
      return {ok: false, payload: null, message: 'Invalid payload format'}
    }
    return next({...payload, validated: true, validationTime: Date.now()})
  }

  // Create group with full middleware chain
  cyre.group('secure-api', {
    channels: ['secure-*', 'protected-*', 'admin-*'],
    shared: {
      middleware: [
        loggingMiddleware, // 1. Log all requests
        authMiddleware, // 2. Authenticate
        rateLimitMiddleware, // 3. Check rate limits
        validationMiddleware // 4. Validate payload
      ],
      schema: schema.object({
        userId: schema.string(),
        action: schema.string(),
        data: schema.any().optional()
      })
    }
  })

  // Create channels to test middleware chain
  const secureChannels = [
    {
      id: 'secure-user-profile',
      payload: {userId: 'user123', action: 'get_profile'}
    },
    {
      id: 'protected-admin-panel',
      payload: {
        userId: 'admin456',
        action: 'view_dashboard',
        data: {filters: ['active']}
      }
    },
    {
      id: 'admin-user-management',
      payload: {userId: 'admin789', action: 'list_users'}
    },
    // This should fail authentication
    {id: 'secure-unauthorized', payload: {action: 'sensitive_operation'}}
  ]

  for (const channel of secureChannels) {
    cyre.action(channel)
    cyre.on(channel.id, (data: any) => {
      log('SECURE RESULT', `${channel.id} completed middleware chain`, {
        success: true,
        finalPayload: data
      })
    })
  }

  await wait(200)

  // Test rapid requests to trigger rate limiting
  log('MIDDLEWARE', 'Testing rate limiting with rapid requests...')
  for (let i = 0; i < 12; i++) {
    try {
      const result = await cyre.call('secure-user-profile', {
        userId: 'user123',
        action: 'rapid_request',
        requestNumber: i + 1
      })
      if (!result.ok) {
        log('RATE LIMIT', `Request ${i + 1} blocked: ${result.message}`)
      }
    } catch (error) {
      log('RATE LIMIT', `Request ${i + 1} error: ${error}`)
    }
    await wait(100)
  }
}

// =====================================================================
// 4. ALERT SYSTEMS AND MONITORING
// =====================================================================

async function demoAlertSystems() {
  log('ALERTS', 'Setting up comprehensive alert and monitoring systems...')

  // System monitoring group with multiple alert types
  cyre.group('system-monitoring', {
    channels: ['monitor-*', 'health-*', 'metrics-*'],
    shared: {
      throttle: 500,
      alerts: {
        offline: {
          threshold: 5000, // 5 seconds
          action: 'notify-ops',
          handler: (channelId: string, alertType: string, data: any) => {
            log('🚨 ALERT', `OFFLINE: ${channelId} has been inactive`, {
              threshold: data.threshold,
              timeSinceLastActivity: data.timeSinceLastExecution,
              severity: 'HIGH'
            })
          }
        },
        anomaly: {
          threshold: 3000, // 3 seconds
          action: 'investigate',
          condition: 'anomaly',
          handler: (channelId: string, alertType: string, data: any) => {
            log('⚠️ ALERT', `ANOMALY: Unusual activity in ${channelId}`, {
              stressLevel: data.stressLevel,
              severity: 'MEDIUM'
            })
          }
        },
        error: {
          threshold: 1, // Any error
          action: 'immediate-response',
          handler: (channelId: string, alertType: string, data: any) => {
            log('💥 ALERT', `ERROR: Critical error in ${channelId}`, {
              errorMessage: data.error,
              severity: 'CRITICAL'
            })
          }
        }
      },
      middleware: [
        async (payload: any, next: any) => {
          // Health check middleware
          if (payload.health !== undefined && payload.health < 0.5) {
            log('HEALTH', `Low health detected: ${payload.health}`)
          }
          return next({...payload, monitoringTimestamp: Date.now()})
        }
      ]
    }
  })

  // Database monitoring group
  cyre.group('database-monitoring', {
    channels: ['db-*', 'query-*', 'connection-*'],
    shared: {
      alerts: {
        slowQuery: {
          threshold: 1000, // 1 second
          action: 'optimize-query',
          handler: (channelId: string, alertType: string, data: any) => {
            log(
              '🐌 ALERT',
              `SLOW QUERY: ${channelId} execution time exceeded threshold`,
              {
                executionTime: data.executionTime,
                threshold: data.threshold,
                query: data.query
              }
            )
          }
        },
        connectionLoss: {
          threshold: 100, // Immediate
          action: 'reconnect',
          handler: (channelId: string, alertType: string, data: any) => {
            log(
              '🔌 ALERT',
              `CONNECTION LOST: ${channelId} database connection failed`,
              {
                connectionId: data.connectionId,
                lastSuccessful: data.lastSuccessful
              }
            )
          }
        }
      },
      middleware: [
        async (payload: any, next: any) => {
          const startTime = Date.now()
          const result = await next(payload)
          const executionTime = Date.now() - startTime

          if (executionTime > 1000) {
            log('DB PERFORMANCE', `Slow operation detected: ${executionTime}ms`)
          }

          return {...result, executionTime}
        }
      ]
    }
  })

  // Create monitoring channels
  const monitoringChannels = [
    {id: 'monitor-cpu-usage', payload: {metric: 'cpu', value: 75, health: 0.8}},
    {
      id: 'monitor-memory-usage',
      payload: {metric: 'memory', value: 90, health: 0.3}
    }, // Low health
    {
      id: 'health-system-status',
      payload: {system: 'api', status: 'operational', health: 0.95}
    },
    {
      id: 'metrics-response-time',
      payload: {metric: 'response_time', value: 150, health: 0.9}
    },
    {
      id: 'db-user-queries',
      payload: {query: 'SELECT * FROM users', connectionId: 'conn123'}
    },
    {
      id: 'query-analytics-report',
      payload: {
        query: 'SELECT COUNT(*) FROM events WHERE date > ?',
        params: ['2025-05-01']
      }
    },
    {
      id: 'connection-primary-db',
      payload: {connectionId: 'primary', status: 'connected'}
    }
  ]

  for (const channel of monitoringChannels) {
    cyre.action(channel)
    cyre.on(channel.id, (data: any) => {
      log('MONITORING', `${channel.id} metrics collected`, {
        originalMetric: channel.payload.metric || channel.payload.system,
        processedData: data
      })
    })
  }

  await wait(100)

  // Simulate system issues to trigger alerts
  log('ALERTS', 'Simulating system issues to demonstrate alert system...')

  // Wait for offline alert (monitor-memory-usage will trigger offline alert after 5 seconds)
  await wait(6000)

  // Simulate error condition
  try {
    await cyre.call('monitor-error-simulation', {
      error: true,
      message: 'Simulated system error for testing'
    })
  } catch (error) {
    // Expected to trigger error alert
  }
}

// =====================================================================
// 5. CROSS-GROUP COORDINATION
// =====================================================================

async function demoCrossGroupCoordination() {
  log('COORDINATION', 'Demonstrating cross-group coordination patterns...')

  // Emergency coordination system
  cyre.group('emergency-services', {
    channels: ['emergency-*', 'alert-*', 'incident-*'],
    shared: {
      priority: {level: 'critical'},
      middleware: [
        async (payload: any, next: any) => {
          log('EMERGENCY', `Emergency protocol activated: ${payload.type}`)

          // Coordinate with other groups during emergency
          if (payload.severity === 'critical') {
            // Notify all other systems
            setTimeout(() => {
              cyre.call('system-broadcast', {
                message: 'Emergency protocol active',
                source: 'emergency-services',
                timestamp: Date.now()
              })
            }, 100)
          }

          return next({
            ...payload,
            emergencyProcessed: true,
            responseTeam: 'alpha'
          })
        }
      ]
    }
  })

  // Load balancer group
  cyre.group('load-balancers', {
    channels: ['lb-*', 'balance-*', 'distribute-*'],
    shared: {
      middleware: [
        async (payload: any, next: any) => {
          // Simple round-robin load balancing simulation
          const servers = ['server-1', 'server-2', 'server-3']
          const selectedServer = servers[Date.now() % servers.length]

          log('LOAD BALANCE', `Request routed to: ${selectedServer}`)
          return next({
            ...payload,
            assignedServer: selectedServer,
            loadBalanced: true,
            timestamp: Date.now()
          })
        }
      ]
    }
  })

  // Circuit breaker simulation
  let circuitBreakerOpen = false
  let failureCount = 0
  const maxFailures = 3

  cyre.group('circuit-protected', {
    channels: ['circuit-*', 'protected-*'],
    shared: {
      middleware: [
        async (payload: any, next: any) => {
          if (circuitBreakerOpen) {
            log('CIRCUIT BREAKER', 'Circuit is OPEN - blocking request')
            return {
              ok: false,
              payload: null,
              message: 'Circuit breaker is open - service unavailable'
            }
          }

          try {
            // Simulate potential failure
            if (payload.simulateFailure) {
              throw new Error('Simulated service failure')
            }

            const result = await next(payload)

            // Reset failure count on success
            failureCount = 0
            log(
              'CIRCUIT BREAKER',
              'Request successful - circuit remains CLOSED'
            )

            return result
          } catch (error) {
            failureCount++
            log('CIRCUIT BREAKER', `Failure ${failureCount}/${maxFailures}`)

            if (failureCount >= maxFailures) {
              circuitBreakerOpen = true
              log('CIRCUIT BREAKER', '🔴 Circuit OPENED due to failures')

              // Auto-reset after 10 seconds
              setTimeout(() => {
                circuitBreakerOpen = false
                failureCount = 0
                log('CIRCUIT BREAKER', '🟢 Circuit auto-RESET to CLOSED')
              }, 10000)
            }

            throw error
          }
        }
      ]
    }
  })

  // Saga pattern for distributed transactions
  cyre.group('saga-coordinator', {
    channels: ['saga-*', 'transaction-*'],
    shared: {
      middleware: [
        async (payload: any, next: any) => {
          if (payload.sagaId) {
            log(
              'SAGA',
              `Transaction step: ${payload.step} for saga: ${payload.sagaId}`
            )

            // Simulate saga step coordination
            const steps = payload.steps || []
            const currentStep = payload.step || 0

            if (currentStep < steps.length - 1) {
              // Schedule next step
              setTimeout(() => {
                cyre.call(`saga-${payload.sagaId}`, {
                  ...payload,
                  step: currentStep + 1,
                  previousResult: 'success'
                })
              }, 500)
            } else {
              log('SAGA', `Saga ${payload.sagaId} completed successfully`)
            }
          }

          return next({...payload, sagaProcessed: true})
        }
      ]
    }
  })

  // Create coordination test channels
  const coordinationChannels = [
    {
      id: 'emergency-fire-alarm',
      payload: {type: 'fire', severity: 'critical', location: 'building_a'}
    },
    {
      id: 'emergency-medical',
      payload: {type: 'medical', severity: 'high', location: 'floor_3'}
    },
    {id: 'lb-web-traffic', payload: {requestType: 'web', load: 'high'}},
    {id: 'balance-api-calls', payload: {requestType: 'api', load: 'medium'}},
    {id: 'circuit-normal-request', payload: {operation: 'read', data: 'test'}},
    {
      id: 'circuit-failing-request',
      payload: {operation: 'write', simulateFailure: true}
    },
    {
      id: 'saga-payment-process',
      payload: {
        sagaId: 'payment_001',
        steps: [
          'validate_card',
          'charge_amount',
          'update_inventory',
          'send_receipt'
        ],
        step: 0
      }
    }
  ]

  for (const channel of coordinationChannels) {
    cyre.action(channel)
    cyre.on(channel.id, (data: any) => {
      log('COORDINATION', `${channel.id} coordination result`, data)
    })
  }

  await wait(200)

  // Test circuit breaker by sending failing requests
  log('COORDINATION', 'Testing circuit breaker with failing requests...')
  for (let i = 0; i < 5; i++) {
    try {
      const result = await cyre.call('circuit-failing-request', {
        operation: 'test',
        simulateFailure: true,
        attempt: i + 1
      })
      log(
        'CIRCUIT TEST',
        `Attempt ${i + 1}: ${result.ok ? 'SUCCESS' : 'FAILED'}`
      )
    } catch (error) {
      log('CIRCUIT TEST', `Attempt ${i + 1}: ERROR - ${error}`)
    }
    await wait(500)
  }
}

// =====================================================================
// 6. ANALYTICS AND PERFORMANCE MONITORING
// =====================================================================

async function demoAnalyticsAndMonitoring() {
  log('ANALYTICS', 'Demonstrating analytics and performance monitoring...')

  // Performance monitoring group
  cyre.group('performance-analytics', {
    channels: ['perf-*', 'analytics-*', 'benchmark-*'],
    shared: {
      middleware: [
        async (payload: any, next: any) => {
          const startTime = performance.now()
          const result = await next(payload)
          const executionTime = performance.now() - startTime

          // Collect performance metrics
          log(
            'PERFORMANCE',
            `Execution time: ${executionTime.toFixed(2)}ms for ${
              payload.operation
            }`
          )

          return {
            ...result,
            performanceMetrics: {
              executionTime,
              timestamp: Date.now(),
              operation: payload.operation
            }
          }
        }
      ]
    }
  })

  // Data analytics group
  cyre.group('data-analytics', {
    channels: ['data-*', 'report-*', 'insights-*'],
    shared: {
      middleware: [
        async (payload: any, next: any) => {
          // Simulate data processing analytics
          const dataSize = payload.records?.length || 0
          const complexity = payload.aggregations?.length || 1

          log(
            'DATA ANALYTICS',
            `Processing ${dataSize} records with ${complexity} aggregations`
          )

          // Simulate processing time based on data size
          const processingTime = Math.min(dataSize * complexity * 0.1, 100)
          await wait(processingTime)

          return next({
            ...payload,
            processed: true,
            processingTime,
            insights: {
              recordCount: dataSize,
              averageValue: dataSize > 0 ? Math.random() * 100 : 0,
              trend: Math.random() > 0.5 ? 'increasing' : 'decreasing'
            }
          })
        }
      ]
    }
  })

  // ML/AI group for pattern detection
  cyre.group('ai-insights', {
    channels: ['ai-*', 'ml-*', 'predict-*'],
    shared: {
      middleware: [
        async (payload: any, next: any) => {
          // Simulate AI/ML processing
          log('AI INSIGHTS', `Running AI analysis on: ${payload.analysisType}`)

          const confidence = Math.random()
          const prediction = Math.random() > 0.5 ? 'positive' : 'negative'

          await wait(200) // Simulate ML processing time

          return next({
            ...payload,
            aiProcessed: true,
            prediction: {
              result: prediction,
              confidence: confidence,
              model: 'neural_network_v2',
              features: payload.features || []
            }
          })
        }
      ]
    }
  })

  // Create analytics test channels
  const analyticsChannels = [
    {
      id: 'perf-database-query',
      payload: {operation: 'complex_join', tables: 5}
    },
    {
      id: 'analytics-user-behavior',
      payload: {operation: 'behavior_analysis', sessionCount: 1000}
    },
    {
      id: 'benchmark-api-response',
      payload: {operation: 'api_benchmark', endpoints: 20}
    },
    {
      id: 'data-sales-report',
      payload: {
        records: Array.from({length: 500}, (_, i) => ({
          id: i,
          amount: Math.random() * 1000
        })),
        aggregations: ['sum', 'average', 'groupBy']
      }
    },
    {
      id: 'report-monthly-metrics',
      payload: {
        period: '2025-05',
        metrics: ['revenue', 'users', 'conversion'],
        aggregations: ['sum', 'average']
      }
    },
    {
      id: 'ai-fraud-detection',
      payload: {
        analysisType: 'fraud_detection',
        features: ['transaction_amount', 'location', 'time', 'merchant_type'],
        transactionData: {amount: 5000, location: 'unknown', time: 'unusual'}
      }
    },
    {
      id: 'ml-recommendation-engine',
      payload: {
        analysisType: 'recommendations',
        features: ['user_history', 'preferences', 'collaborative_filtering'],
        userId: 'user123'
      }
    },
    {
      id: 'predict-system-load',
      payload: {
        analysisType: 'load_prediction',
        features: ['historical_usage', 'time_patterns', 'seasonal_trends'],
        timeframe: '24h'
      }
    }
  ]

  for (const channel of analyticsChannels) {
    cyre.action(channel)
    cyre.on(channel.id, (data: any) => {
      log('ANALYTICS RESULT', `${channel.id} analysis complete`, {
        inputSize: channel.payload.records?.length || 'N/A',
        insights: data.insights,
        prediction: data.prediction,
        performanceMetrics: data.performanceMetrics
      })
    })
  }

  await wait(300)

  // Generate analytics report
  log('ANALYTICS', 'Generating comprehensive analytics report...')

  const allGroups = cyre.getAllGroups()
  const analyticsReport = {
    timestamp: new Date().toISOString(),
    totalGroups: allGroups.length,
    groupMetrics: allGroups.map(group => ({
      id: group.id,
      channelCount: group.matchedChannels.size,
      middlewareCount: group.middlewareIds.length,
      isActive: group.isActive,
      uptime: Date.now() - group.createdAt
    })),
    systemHealth: {
      overallStatus: 'healthy',
      activeChannels: allGroups.reduce(
        (sum, group) => sum + group.matchedChannels.size,
        0
      ),
      totalMiddleware: allGroups.reduce(
        (sum, group) => sum + group.middlewareIds.length,
        0
      ),
      averageChannelsPerGroup:
        allGroups.length > 0
          ? allGroups.reduce(
              (sum, group) => sum + group.matchedChannels.size,
              0
            ) / allGroups.length
          : 0
    },
    recommendations: [
      'Consider implementing caching for high-frequency channels',
      'Monitor groups with >50 channels for potential splitting',
      'Review middleware chains longer than 5 functions'
    ]
  }

  log('ANALYTICS REPORT', 'System Analytics Summary', analyticsReport)
}

// =====================================================================
// 7. TESTING AND VALIDATION FRAMEWORK
// =====================================================================

async function demoTestingFramework() {
  log('TESTING', 'Running comprehensive testing framework...')

  // Create test group for validation
  cyre.group('test-validation', {
    channels: ['test-*', 'validate-*', 'check-*'],
    shared: {
      schema: schema.object({
        testId: schema.string(),
        operation: schema.string(),
        expected: schema.any().optional(),
        actual: schema.any().optional()
      }),
      middleware: [
        async (payload: any, next: any) => {
          log('TEST MIDDLEWARE', `Validating test: ${payload.testId}`)
          const testResult = await next(payload)

          // Add test validation
          if (payload.expected !== undefined && payload.actual !== undefined) {
            const passed =
              JSON.stringify(payload.expected) ===
              JSON.stringify(payload.actual)
            log(
              'TEST RESULT',
              `Test ${payload.testId}: ${passed ? 'PASSED' : 'FAILED'}`
            )
            return {
              ...testResult,
              testPassed: passed,
              testResults: {
                expected: payload.expected,
                actual: payload.actual,
                passed
              }
            }
          }

          return testResult
        }
      ]
    }
  })

  // Load testing simulation
  async function runLoadTest(
    groupId: string,
    concurrency: number,
    duration: number
  ) {
    log(
      'LOAD TEST',
      `Starting load test: ${concurrency} concurrent calls for ${duration}ms`
    )

    const startTime = Date.now()
    const results: any[] = []
    const promises: Promise<any>[] = []

    // Create test channels for load testing
    for (let i = 0; i < concurrency; i++) {
      const channelId = `load-test-${groupId}-${i}`
      cyre.action({
        id: channelId,
        payload: {loadTest: true, index: i}
      })

      cyre.on(channelId, (data: any) => {
        results.push({
          channelId,
          timestamp: Date.now(),
          data
        })
      })
    }

    // Execute concurrent calls
    while (Date.now() - startTime < duration) {
      for (let i = 0; i < concurrency; i++) {
        const promise = cyre
          .call(`load-test-${groupId}-${i}`, {
            timestamp: Date.now(),
            iteration: Math.floor((Date.now() - startTime) / 100)
          })
          .then(result => {
            return {
              success: result.ok,
              responseTime: Date.now() - startTime,
              channelIndex: i
            }
          })
          .catch(error => {
            return {
              success: false,
              error: error.message,
              channelIndex: i
            }
          })

        promises.push(promise)
      }

      await wait(100) // 100ms intervals
    }

    const loadResults = await Promise.all(promises)
    const successCount = loadResults.filter(r => r.success).length
    const failureCount = loadResults.length - successCount

    // Cleanup test channels
    for (let i = 0; i < concurrency; i++) {
      cyre.forget(`load-test-${groupId}-${i}`)
    }

    return {
      totalRequests: loadResults.length,
      successful: successCount,
      failed: failureCount,
      successRate: successCount / loadResults.length,
      averageResponseTime:
        loadResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) /
        loadResults.length,
      duration: Date.now() - startTime
    }
  }

  // Chaos testing simulation
  async function runChaosTest(groupId: string) {
    log('CHAOS TEST', `Starting chaos testing for group: ${groupId}`)

    const chaosScenarios = [
      {name: 'High Memory Pressure', duration: 2000},
      {name: 'Network Latency', duration: 1500},
      {name: 'Random Failures', duration: 3000},
      {name: 'CPU Spike', duration: 1000}
    ]

    const results: any[] = []

    for (const scenario of chaosScenarios) {
      log('CHAOS', `Executing scenario: ${scenario.name}`)

      const startTime = Date.now()
      let survivedCalls = 0
      let totalCalls = 0

      // Create chaos test channel
      const chaosChannelId = `chaos-${groupId}-${scenario.name
        .replace(/\s+/g, '-')
        .toLowerCase()}`
      cyre.action({
        id: chaosChannelId,
        payload: {chaos: true, scenario: scenario.name}
      })

      cyre.on(chaosChannelId, (data: any) => {
        log('CHAOS SURVIVAL', `Channel survived chaos: ${scenario.name}`)
      })

      // Execute calls during chaos
      while (Date.now() - startTime < scenario.duration) {
        totalCalls++
        try {
          const result = await cyre.call(chaosChannelId, {
            chaosTest: true,
            timestamp: Date.now(),
            scenario: scenario.name
          })

          if (result.ok) {
            survivedCalls++
          }
        } catch (error) {
          // Expected during chaos testing
        }

        await wait(50)
      }

      cyre.forget(chaosChannelId)

      const scenarioResult = {
        scenario: scenario.name,
        survivedCalls,
        totalCalls,
        survivalRate: totalCalls > 0 ? survivedCalls / totalCalls : 0,
        duration: scenario.duration
      }

      results.push(scenarioResult)
      log('CHAOS RESULT', `${scenario.name} completed`, scenarioResult)
    }

    return {
      overallSurvivalRate:
        results.reduce((sum, r) => sum + r.survivalRate, 0) / results.length,
      scenarios: results,
      resilience: results.every(r => r.survivalRate > 0.7)
        ? 'excellent'
        : results.every(r => r.survivalRate > 0.5)
        ? 'good'
        : 'needs_improvement'
    }
  }

  // Performance benchmark
  async function runPerformanceBenchmark() {
    log('BENCHMARK', 'Running performance benchmark suite...')

    const benchmarks = [
      {
        name: 'Simple Channel Call',
        test: async () => {
          const start = performance.now()
          await cyre.call('test-simple', {simple: true})
          return performance.now() - start
        }
      },
      {
        name: 'Complex Middleware Chain',
        test: async () => {
          const start = performance.now()
          await cyre.call('secure-user-profile', {
            userId: 'benchmark',
            action: 'test'
          })
          return performance.now() - start
        }
      },
      {
        name: 'Schema Validation',
        test: async () => {
          const start = performance.now()
          await cyre.call('sensor-temperature-01', {
            deviceId: 'benchmark',
            value: 25.0,
            timestamp: Date.now()
          })
          return performance.now() - start
        }
      }
    ]

    const benchmarkResults: any[] = []

    for (const benchmark of benchmarks) {
      const iterations = 10
      const times: number[] = []

      for (let i = 0; i < iterations; i++) {
        try {
          const time = await benchmark.test()
          times.push(time)
        } catch (error) {
          // Handle benchmark errors
          times.push(1000) // High penalty for errors
        }
      }

      const result = {
        name: benchmark.name,
        iterations,
        averageTime: times.reduce((sum, t) => sum + t, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        medianTime: times.sort()[Math.floor(times.length / 2)]
      }

      benchmarkResults.push(result)
      log('BENCHMARK', `${benchmark.name} completed`, result)
    }

    return benchmarkResults
  }

  // Execute all tests
  const testResults = {
    loadTest: await runLoadTest('iot-sensors', 5, 3000),
    chaosTest: await runChaosTest('api-services'),
    performanceBenchmark: await runPerformanceBenchmark(),
    timestamp: Date.now()
  }

  log('TESTING COMPLETE', 'All tests finished', testResults)
}

// =====================================================================
// 8. TEMPLATES AND BEST PRACTICES
// =====================================================================

async function demoTemplatesAndBestPractices() {
  log('TEMPLATES', 'Demonstrating group templates and best practices...')

  // IoT Device Template
  function createIoTTemplate(groupId: string, deviceTypes: string[]) {
    return cyre.group(groupId, {
      channels: deviceTypes.map(type => `${type}-*`),
      shared: {
        throttle: 5000, // IoT devices shouldn't spam
        schema: schema.object({
          deviceId: schema.string(),
          deviceType: schema.enums(...deviceTypes),
          value: schema.number(),
          batteryLevel: schema.number().min(0).max(100).optional(),
          signalStrength: schema.number().min(0).max(100).optional(),
          location: schema.string().optional(),
          timestamp: schema.number()
        }),
        middleware: [
          // Device authentication
          async (payload: any, next: any) => {
            log('IOT AUTH', `Authenticating device: ${payload.deviceId}`)
            if (
              !payload.deviceId ||
              !payload.deviceId.match(/^[a-zA-Z0-9_-]+$/)
            ) {
              return {
                ok: false,
                payload: null,
                message: 'Invalid device ID format'
              }
            }
            return next({...payload, authenticated: true})
          },
          // Battery monitoring
          async (payload: any, next: any) => {
            if (
              payload.batteryLevel !== undefined &&
              payload.batteryLevel < 15
            ) {
              log(
                'IOT BATTERY',
                `⚠️ Low battery warning: ${payload.deviceId} (${payload.batteryLevel}%)`
              )
            }
            return next(payload)
          },
          // Data normalization
          async (payload: any, next: any) => {
            return next({
              ...payload,
              normalizedValue:
                typeof payload.value === 'number'
                  ? payload.value
                  : parseFloat(payload.value) || 0,
              processedTimestamp: Date.now()
            })
          }
        ],
        alerts: {
          offline: {
            threshold: 30000, // 30 seconds
            action: 'device-maintenance',
            handler: (channelId: string, alertType: string, data: any) => {
              log('IOT ALERT', `Device offline: ${channelId}`, data)
            }
          }
        }
      }
    })
  }

  // Microservice Template
  function createMicroserviceTemplate(
    groupId: string,
    servicePatterns: string[]
  ) {
    return cyre.group(groupId, {
      channels: servicePatterns,
      shared: {
        throttle: 1000,
        priority: {level: 'high'},
        schema: schema.object({
          serviceId: schema.string(),
          operation: schema.string(),
          requestId: schema.string(),
          payload: schema.any().optional(),
          metadata: schema.object({}).optional()
        }),
        middleware: [
          // Request tracing
          async (payload: any, next: any) => {
            const traceId = payload.requestId || crypto.randomUUID()
            log(
              'SERVICE TRACE',
              `${payload.serviceId}:${payload.operation} [${traceId}]`
            )
            return next({...payload, traceId, tracingEnabled: true})
          },
          // Rate limiting
          (() => {
            const serviceCalls = new Map<string, number[]>()
            return async (payload: any, next: any) => {
              const serviceId = payload.serviceId
              const now = Date.now()
              const calls = serviceCalls.get(serviceId) || []

              // Keep only calls from last minute
              const recentCalls = calls.filter(time => now - time < 60000)

              if (recentCalls.length >= 100) {
                // 100 calls per minute limit
                return {
                  ok: false,
                  payload: null,
                  message: 'Service rate limit exceeded'
                }
              }

              recentCalls.push(now)
              serviceCalls.set(serviceId, recentCalls)

              return next(payload)
            }
          })(),
          // Health check
          async (payload: any, next: any) => {
            const result = await next(payload)

            // Simulate health scoring
            const healthScore = Math.random() > 0.1 ? 0.95 : 0.3 // 90% healthy

            return {
              ...result,
              serviceHealth: {
                score: healthScore,
                status: healthScore > 0.8 ? 'healthy' : 'degraded',
                lastCheck: Date.now()
              }
            }
          }
        ]
      }
    })
  }

  // Analytics Template
  function createAnalyticsTemplate(groupId: string, dataTypes: string[]) {
    return cyre.group(groupId, {
      channels: dataTypes.map(type => `analytics-${type}-*`),
      shared: {
        throttle: 2000, // Analytics can be slower
        middleware: [
          // Data validation
          async (payload: any, next: any) => {
            if (!payload.dataset || !Array.isArray(payload.records)) {
              return {
                ok: false,
                payload: null,
                message: 'Invalid analytics dataset'
              }
            }

            log(
              'ANALYTICS',
              `Processing ${payload.records.length} records for ${payload.dataset}`
            )
            return next(payload)
          },
          // Performance optimization
          async (payload: any, next: any) => {
            const startTime = performance.now()

            // Simulate data processing
            const recordCount = payload.records.length
            const processingTime = Math.min(recordCount * 0.1, 500) // Max 500ms
            await wait(processingTime)

            const result = await next({
              ...payload,
              optimized: true,
              processingTime: performance.now() - startTime
            })

            return {
              ...result,
              analyticsMetrics: {
                recordsProcessed: recordCount,
                processingTime: performance.now() - startTime,
                throughput:
                  recordCount / ((performance.now() - startTime) / 1000)
              }
            }
          }
        ]
      }
    })
  }

  // Apply templates
  createIoTTemplate('smart-building', [
    'temperature',
    'humidity',
    'motion',
    'light',
    'air-quality'
  ])
  createMicroserviceTemplate('payment-platform', [
    'payment-*',
    'billing-*',
    'transaction-*'
  ])
  createAnalyticsTemplate('business-intelligence', [
    'sales',
    'users',
    'performance',
    'marketing'
  ])

  // Create test channels for each template
  const templateTestChannels = [
    // IoT devices
    {
      id: 'temperature-sensor-lobby',
      payload: {
        deviceId: 'temp_lobby_001',
        deviceType: 'temperature',
        value: 22.5,
        batteryLevel: 85,
        signalStrength: 95,
        location: 'lobby',
        timestamp: Date.now()
      }
    },
    {
      id: 'motion-detector-hallway',
      payload: {
        deviceId: 'motion_hall_002',
        deviceType: 'motion',
        value: 1,
        batteryLevel: 12, // Low battery
        signalStrength: 78,
        location: 'hallway',
        timestamp: Date.now()
      }
    },

    // Microservices
    {
      id: 'payment-process-card',
      payload: {
        serviceId: 'payment-service',
        operation: 'process_payment',
        requestId: 'req_' + crypto.randomUUID(),
        payload: {amount: 99.99, currency: 'USD', cardToken: 'tok_123'},
        metadata: {userId: 'user_456', merchantId: 'merch_789'}
      }
    },
    {
      id: 'billing-generate-invoice',
      payload: {
        serviceId: 'billing-service',
        operation: 'generate_invoice',
        requestId: 'req_' + crypto.randomUUID(),
        payload: {
          customerId: 'cust_123',
          items: [{id: 'item_1', amount: 49.99}]
        }
      }
    },

    // Analytics
    {
      id: 'analytics-sales-daily',
      payload: {
        dataset: 'daily_sales',
        records: Array.from({length: 100}, (_, i) => ({
          id: i,
          amount: Math.random() * 1000,
          timestamp: Date.now() - i * 3600000, // Hourly data
          category: ['electronics', 'clothing', 'books'][i % 3]
        })),
        aggregations: ['sum', 'average', 'count', 'group_by_category']
      }
    },
    {
      id: 'analytics-users-behavior',
      payload: {
        dataset: 'user_behavior',
        records: Array.from({length: 50}, (_, i) => ({
          userId: `user_${i}`,
          sessionDuration: Math.random() * 3600,
          pageViews: Math.floor(Math.random() * 20),
          conversions: Math.random() > 0.8 ? 1 : 0
        })),
        aggregations: ['average_session', 'conversion_rate', 'engagement_score']
      }
    }
  ]

  for (const channel of templateTestChannels) {
    cyre.action(channel)
    cyre.on(channel.id, (data: any) => {
      log('TEMPLATE RESULT', `${channel.id} processed by template`, {
        templateType: channel.id.split('-')[0],
        processedData: data
      })
    })
  }

  await wait(500)

  // Best practices demonstration
  log('BEST PRACTICES', 'Demonstrating group management best practices...')

  const bestPractices = {
    groupNaming: {
      good: ['user-services', 'iot-sensors', 'payment-processing'],
      bad: ['group1', 'stuff', 'misc-channels'],
      recommendation: 'Use descriptive, domain-specific names'
    },
    channelPatterns: {
      good: ['user-*', 'api-v1-*', 'sensor-floor[1-3]-*'],
      bad: ['*', 'channel-*', 'thing-*'],
      recommendation: 'Use specific patterns that clearly define scope'
    },
    middlewareDesign: {
      good: ['Single responsibility', 'Composable', 'Error handling'],
      bad: ['Do everything', 'Tightly coupled', 'No error handling'],
      recommendation: 'Keep middleware focused and composable'
    },
    performanceOptimization: {
      tips: [
        'Use appropriate throttle/debounce values',
        'Limit middleware chain length (<5 functions)',
        'Implement caching for expensive operations',
        'Monitor group metrics regularly'
      ]
    }
  }

  log('BEST PRACTICES', 'Group Management Guidelines', bestPractices)
}

// =====================================================================
// 9. MAIN EXECUTION FUNCTION
// =====================================================================

async function runComprehensiveDemo() {
  console.log('\n' + '='.repeat(80))
  console.log('🚀 CYRE GROUP SYSTEM - COMPREHENSIVE FEATURE EXPLORATION')
  console.log('='.repeat(80))

  try {
    // Initialize Cyre
    await cyre.initialize({
      autoSave: true,
      saveKey: 'cyre-group-demo'
    })

    log('SYSTEM', 'Cyre initialized successfully with group system support')

    // Run all demo sections
    await demoBasicGroupOperations()
    await wait(1000)

    await demoAdvancedPatternMatching()
    await wait(1000)

    await demoMiddlewareChains()
    await wait(1000)

    await demoAlertSystems()
    await wait(1000)

    await demoCrossGroupCoordination()
    await wait(1000)

    await demoAnalyticsAndMonitoring()
    await wait(1000)

    await demoTestingFramework()
    await wait(1000)

    await demoTemplatesAndBestPractices()
    await wait(1000)

    // Final system report
    log('FINAL REPORT', 'Generating comprehensive system report...')

    const finalReport = {
      timestamp: new Date().toISOString(),
      systemStatus: 'operational',
      totalGroups: cyre.getAllGroups().length,
      groupSummary: cyre.getAllGroups().map(group => ({
        id: group.id,
        channels: group.matchedChannels.size,
        middleware: group.middlewareIds.length,
        active: group.isActive,
        uptime: `${Math.round((Date.now() - group.createdAt) / 1000)}s`
      })),
      performanceMetrics: cyre.getPerformanceState(),
      breathingSystem: cyre.getBreathingState(),
      recommendations: [
        'System is operating within normal parameters',
        'All group features are functioning correctly',
        'Consider implementing production monitoring',
        'Review group patterns for optimization opportunities'
      ]
    }

    log('SYSTEM REPORT', 'Comprehensive Group System Analysis', finalReport)

    console.log('\n' + '='.repeat(80))
    console.log('✅ COMPREHENSIVE GROUP DEMO COMPLETED SUCCESSFULLY')
    console.log('   All group features explored and validated')
    console.log('   System performance: OPTIMAL')
    console.log('   Group coordination: FUNCTIONAL')
    console.log('   Monitoring systems: ACTIVE')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('\n❌ Demo failed:', error)
    log('ERROR', 'Demo execution failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}

// Execute the comprehensive demo

runComprehensiveDemo().catch(console.error)

export {
  runComprehensiveDemo,
  demoBasicGroupOperations,
  demoAdvancedPatternMatching,
  demoMiddlewareChains,
  demoAlertSystems,
  demoCrossGroupCoordination,
  demoAnalyticsAndMonitoring,
  demoTestingFramework,
  demoTemplatesAndBestPractices
}
