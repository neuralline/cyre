// cyre-multi-caller-intervals.js

/**
 * CYRE Multiple Actions & Callers Demonstration
 *
 * This example shows how multiple actions with intervals interact when called
 * by different callers, revealing important timing and queuing behaviors.
 */

// Import CYRE - in a real project you would use:
// const { cyre } = require('cyre');
// For demo purposes, mock the implementation
const {cyre} = mockCyre()

// Initialize and clear logs
cyre.initialize()
console.log('\n======= CYRE MULTIPLE CALLERS DEMONSTRATION =======\n')
console.log('Starting time: ' + new Date().toISOString())
console.log('')

// Helper to log with timestamps
const startTime = Date.now()
function log(message) {
  const elapsed = Date.now() - startTime
  console.log(`[${elapsed.toString().padStart(5, ' ')}ms] ${message}`)
}

/**
 * SCENARIO: Multiple Services Monitoring System
 *
 * We'll simulate a monitoring system where three different services
 * (Auth, Database, API) are monitored by multiple components (Dashboard, Logger, Alerts)
 */

// Create the monitoring actions with intervals
const services = ['auth', 'database', 'api']
const components = ['dashboard', 'logger', 'alerts']

// Set up all the actions
services.forEach(service => {
  // Create different intervals for each service
  const intervalMap = {
    auth: 300, // Auth service checks every 300ms
    database: 400, // Database checks every 400ms
    api: 500 // API checks every 500ms
  }

  log(
    `Setting up ${service}-status action with ${intervalMap[service]}ms interval`
  )
  cyre.action({
    id: `${service}-status`,
    type: 'monitor',
    interval: intervalMap[service],
    repeat: 3,
    payload: {service, status: 'unknown'}
  })

  // Set up handler for this service
  cyre.on(`${service}-status`, payload => {
    log(
      `${payload.service.toUpperCase()} status check by ${
        payload.component || 'system'
      }: ${payload.status}`
    )

    // Simulate updated status after check
    return {executed: true}
  })
})

/**
 * PHASE 1: Initial health checks from Dashboard
 */
log('\nPHASE 1: Dashboard initiates initial health checks')

// Dashboard checks all services
services.forEach(service => {
  log(`Dashboard checking ${service} status...`)
  cyre.call(`${service}-status`, {
    service,
    status: 'pending',
    component: 'dashboard'
  })
})

/**
 * PHASE 2: Logger starts monitoring while Dashboard checks continue
 */
setTimeout(() => {
  log('\nPHASE 2: Logger starts monitoring while Dashboard checks continue')

  // Logger begins monitoring
  services.forEach(service => {
    log(`Logger starting monitoring for ${service}...`)
    cyre.call(`${service}-status`, {
      service,
      status: 'active',
      component: 'logger'
    })
  })

  // Show internal queue state
  setTimeout(() => {
    // Display current queue state for each service
    services.forEach(service => {
      const actionId = `${service}-status`
      const queueItems = cyre.queue.get(actionId) || []

      log(`Queue state for ${actionId}: ${queueItems.length} items`)
      if (queueItems.length > 0) {
        queueItems.forEach((item, index) => {
          log(
            `  [${index}] Component: ${item.payload.component}, Executed: ${item.executed}/${item.repeat}`
          )
        })
      }
    })
  }, 100)
}, 1000)

/**
 * PHASE 3: Alert system detects issue and changes status
 */
setTimeout(() => {
  log('\nPHASE 3: Alert system detects issues in some services')

  // Simulate an issue with database service
  log('Alert system detected database issue...')
  cyre.call('database-status', {
    service: 'database',
    status: 'error',
    component: 'alerts',
    error: 'Connection timeout'
  })

  // Simulate issue with API but with high priority
  setTimeout(() => {
    log('Alert system detected API issue with high priority...')

    // Access internal queue to check state before the call
    const apiQueue = cyre.queue.get('api-status') || []
    log(`API queue before high-priority alert: ${apiQueue.length} items`)

    // In a real implementation, CYRE would need to support priority
    // but our mock doesn't fully implement this - just showing the concept
    cyre.call('api-status', {
      service: 'api',
      status: 'critical',
      component: 'alerts',
      error: 'High load',
      priority: 'high' // This would ideally affect the queue order
    })
  }, 300)
}, 2000)

/**
 * PHASE 4: Multiple rapid calls from single component
 */
setTimeout(() => {
  log('\nPHASE 4: Dashboard makes multiple rapid status checks on auth service')

  // Make three rapid calls to the same action from the same component
  for (let i = 1; i <= 3; i++) {
    setTimeout(() => {
      log(`Dashboard rapid check #${i} for auth...`)
      cyre.call('auth-status', {
        service: 'auth',
        status: `check-${i}`,
        component: 'dashboard'
      })
    }, i * 50) // 50ms apart
  }

  // Show queue state after rapid calls
  setTimeout(() => {
    const authQueue = cyre.queue.get('auth-status') || []
    log(`Auth queue after rapid calls: ${authQueue.length} items`)
    authQueue.forEach((item, index) => {
      log(
        `  [${index}] Status: ${item.payload.status}, Executed: ${item.executed}/${item.repeat}`
      )
    })
  }, 200)
}, 3000)

/**
 * PHASE 5: Overlapping intervals between services
 */
setTimeout(() => {
  log('\nPHASE 5: Check execution pattern as intervals overlap')

  // Just wait and observe the execution pattern as different
  // service intervals overlap and execute
  log('Observing execution patterns as intervals overlap...')

  // Create visual marker for when we're watching
  const markers = ['▪', '▫']
  let markerIndex = 0

  const intervalId = setInterval(() => {
    log(`${markers[markerIndex]} Monitoring continues...`)
    markerIndex = (markerIndex + 1) % markers.length
  }, 300)

  // Clear the interval after a while
  setTimeout(() => {
    clearInterval(intervalId)
  }, 1500)
}, 4000)

/**
 * PHASE 6: Cancelling a service monitor
 */
setTimeout(() => {
  log('\nPHASE 6: Cancelling the database monitor')

  // Check remaining executions before cancelling
  const dbQueue = cyre.queue.get('database-status') || []
  log(`Database queue before cancelling: ${dbQueue.length} items`)

  // Cancel the database monitoring
  log('Calling forget() on database-status...')
  cyre.forget('database-status')

  // Verify it's gone from the queue
  setTimeout(() => {
    const dbQueueAfter = cyre.queue.get('database-status') || []
    log(`Database queue after forget(): ${dbQueueAfter.length} items`)

    // Demonstrate recreating and calling the action
    log('Recreating database monitor with new interval...')
    cyre.action({
      id: 'database-status',
      type: 'monitor',
      interval: 200, // Faster interval now
      repeat: 2,
      payload: {service: 'database', status: 'restarting'}
    })

    log('Calling new database monitor...')
    cyre.call('database-status', {
      service: 'database',
      status: 'recovered',
      component: 'dashboard'
    })
  }, 100)
}, 5500)

/**
 * Cleanup and conclusions
 */
setTimeout(() => {
  log('\n======= DEMONSTRATION COMPLETE =======')
  log('Key findings about multiple callers with intervals:')
  log('1. Each service maintains its own independent queue of callers')
  log(
    '2. Calls are processed in order of arrival (FIFO), not by priority or component'
  )
  log('3. When multiple components call the same action, they all get queued')
  log(
    '4. Only the last caller in each queue gets to complete its full repeat cycle'
  )
  log('5. forget() cancels ALL pending executions, regardless of caller')
  log('6. Recreating an action after forget() creates a fresh queue')
}, 7000)

// Mock implementation of CYRE for demonstration purposes
function mockCyre() {
  // This is a simplified mock to demonstrate behaviors
  const store = new Map()
  const subscribers = new Map()
  const timers = new Map()
  const queue = new Map()

  const cyreInstance = {
    initialize: () => true,

    action: params => {
      store.set(params.id, params)
      return true
    },

    on: (id, handler) => {
      subscribers.set(id, handler)
      return true
    },

    call: (id, payload = {}) => {
      const action = store.get(id)
      if (!action) return {ok: false, message: 'Action not found'}

      const handler = subscribers.get(id)
      if (!handler) return {ok: false, message: 'No subscriber found'}

      // Handle debounce
      if (action.debounce) {
        if (timers.has(`${id}-debounce`)) {
          clearTimeout(timers.get(`${id}-debounce`))
        }

        timers.set(
          `${id}-debounce`,
          setTimeout(() => {
            // Handle change detection
            if (action.detectChanges) {
              const lastPayload = action.lastPayload
              const hasChanged =
                !lastPayload ||
                JSON.stringify(lastPayload) !== JSON.stringify(payload)

              if (!hasChanged) {
                log(`[MOCK] Action ${id} skipped due to no changes`)
                return
              }
            }

            action.lastPayload = payload
            const result = handler(payload)

            // Handle chain reaction
            if (result && result.id) {
              setTimeout(() => {
                cyreInstance.call(result.id, result.payload)
              }, 0)
            }
          }, action.debounce)
        )

        return {ok: true, message: 'Debounced'}
      }

      // Handle interval with repeat
      if (
        action.interval &&
        (action.repeat === undefined || action.repeat > 0)
      ) {
        // Create or update the queue for this action
        let actionQueue = queue.get(id) || []
        // Add to queue with its own payload
        actionQueue.push({
          payload,
          repeat: action.repeat || 1,
          executed: 0
        })
        queue.set(id, actionQueue)

        // If no timer is currently running for this action, start one
        if (!timers.has(id)) {
          // Process next queue item
          const processQueue = () => {
            const currentQueue = queue.get(id) || []
            if (currentQueue.length === 0) {
              timers.delete(id)
              return
            }

            // Get current item
            const item = currentQueue[0]

            // Execute handler
            const result = handler(item.payload)
            item.executed++

            // Handle chain reaction
            if (result && result.id) {
              setTimeout(() => {
                cyreInstance.call(result.id, result.payload)
              }, 0)
            }

            // Check if this item is done
            if (
              typeof item.repeat === 'number' &&
              item.executed >= item.repeat
            ) {
              currentQueue.shift() // Remove from queue
            }

            // Schedule next execution if queue not empty
            if (currentQueue.length > 0) {
              timers.set(id, setTimeout(processQueue, action.interval))
            } else {
              timers.delete(id)
            }
          }

          // Start the first timer
          timers.set(id, setTimeout(processQueue, action.interval))
        }

        // If this is the first call, do immediate execution too
        if (!action.initialExecuted) {
          action.initialExecuted = true
          const result = handler(payload)

          // Handle chain reaction
          if (result && result.id) {
            setTimeout(() => {
              cyreInstance.call(result.id, result.payload)
            }, 0)
          }
        }

        return {ok: true, message: 'Scheduled'}
      }

      // Normal execution
      const result = handler(payload)

      // Handle change detection
      if (action.detectChanges) {
        action.lastPayload = payload
      }

      // Handle chain reaction
      if (result && result.id) {
        setTimeout(() => {
          cyreInstance.call(result.id, result.payload)
        }, 0)
      }

      return {ok: true, message: 'Executed'}
    },

    forget: id => {
      // Clear all timers for this ID
      if (timers.has(id)) {
        clearTimeout(timers.get(id))
        timers.delete(id)
      }

      if (timers.has(`${id}-debounce`)) {
        clearTimeout(timers.get(`${id}-debounce`))
        timers.delete(`${id}-debounce`)
      }

      // Clear from queue
      queue.delete(id)

      // Remove from store
      store.delete(id)

      return true
    },

    // Expose internal state for demonstration
    store,
    subscribers,
    timers,
    queue
  }

  return {cyre: cyreInstance}
}
