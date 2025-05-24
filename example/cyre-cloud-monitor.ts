// example/cyre-cloud-monitor.ts

//example cyre usage

import {cyre} from 'cyre'

// Initialize monitoring system
const initializeMonitoring = () => {
  // Set up monitoring chain reactions
  cyre.on([
    {
      id: 'monitor',
      fn: async () => {
        const services = await checkServicesHealth()
        // Chain to metric processing
        return {
          id: 'metrics',
          payload: {
            timestamp: Date.now(),
            metrics: services
          }
        }
      }
    },
    {
      id: 'metrics',
      fn: (data: {metrics: ServiceMetrics[]; timestamp: number}) => {
        const {degraded, healthScore} = processMetrics(data)

        // Update system state
        const currentState = getCurrentState()
        currentState.healthScore = healthScore
        currentState.degradedServices = degraded

        // Chain to alert manager if issues found
        if (degraded.length > 0) {
          return {
            id: 'alerts',
            payload: {
              severity: healthScore < 50 ? 'critical' : 'warning',
              services: degraded,
              timestamp: data.timestamp
            }
          }
        }
      }
    },
    {
      id: 'alerts',
      fn: async alert => {
        const breaker = await checkCircuitBreaker(alert.services)

        if (breaker.shouldAlert) {
          await sendAlerts(alert)
          // Chain to incident management if critical
          if (alert.severity === 'critical') {
            return {
              id: 'incident',
              payload: {
                services: alert.services,
                timestamp: alert.timestamp
              }
            }
          }
        }
      }
    }
  ])

  // Set up system state management with change detection
  cyre.action({
    id: 'system-state',
    payload: {
      services: new Map<string, ServiceMetrics>(),
      alerts: new Map<string, AlertConfig>(),
      healthScore: 100,
      degradedServices: [],
      lastIncident: null
    } as SystemState,
    detectChanges: true, // Prevent unnecessary updates
    log: true // Track state changes
  })

  // Service health check chain with protection
  cyre.action([
    {
      id: 'health-check',
      type: 'monitor',
      interval: 30000, // Check every 30 seconds
      repeat: 'infinite',
      debounce: 1000, // Protect against rapid checks
      throttle: 5000 // Minimum 5s between checks
    },
    {
      id: 'metric-aggregator',
      type: 'metrics',
      detectChanges: true
    },
    {
      id: 'alert-manager',
      type: 'alerts',
      debounce: 2000 // Collapse rapid alerts
    }
  ])

  // Circuit breaker for service protection
  cyre.action({
    id: 'circuit-breaker',
    payload: {
      thresholds: {
        errorRate: 0.5, // 50% error rate
        responseTime: 5000, // 5s response time
        failureCount: 10 // 10 failures
      },
      breakerStates: new Map()
    },
    detectChanges: true
  })

  // Start monitoring
  cyre.call('health-check')
}

// Utility functions
const getCurrentState = (): SystemState => {
  const state = cyre.get('system-state')?.payload as SystemState
  if (!state) {
    log.error('Failed to get system state')
    throw new Error('System state not initialized')
  }
  return state
}

const checkServicesHealth = async (): Promise<ServiceMetrics[]> => {
  // Simulate service health checks
  return Promise.resolve([
    {
      serviceId: 'api-gateway',
      status: 'healthy',
      responseTime: 120,
      errorRate: 0.01,
      throughput: 1000
    }
    // Add more services...
  ])
}

const processMetrics = (data: {
  metrics: ServiceMetrics[]
  timestamp: number
}): {
  degraded: string[]
  healthScore: number
} => {
  const degraded = data.metrics
    .filter(m => m.errorRate > 0.1 || m.responseTime > 1000)
    .map(m => m.serviceId)

  const healthScore = calculateHealthScore(data.metrics)

  return {degraded, healthScore}
}

const calculateHealthScore = (metrics: ServiceMetrics[]): number => {
  // Complex health score calculation
  const weights = {
    errorRate: 0.4,
    responseTime: 0.3,
    throughput: 0.3
  }

  return metrics.reduce((score, metric) => {
    const errorScore = (1 - metric.errorRate) * weights.errorRate
    const responseScore =
      Math.min(1000 / metric.responseTime, 1) * weights.responseTime
    const throughputScore =
      Math.min(metric.throughput / 1000, 1) * weights.throughput

    return (
      score +
      (errorScore + responseScore + throughputScore) * (100 / metrics.length)
    )
  }, 0)
}

const checkCircuitBreaker = async (
  services: string[]
): Promise<{shouldAlert: boolean}> => {
  // Implement circuit breaker logic
  return Promise.resolve({shouldAlert: true})
}

const sendAlerts = async (alert: any): Promise<void> => {
  // Implement alert sending logic
  log.info(
    `Sending ${alert.severity} alert for services: ${alert.services.join(', ')}`
  )
}

// Export for use
export {initializeMonitoring}
initializeMonitoring()
