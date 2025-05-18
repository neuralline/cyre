// cyre-gotchas-demo.js

/**
 * CYRE Gotchas Demonstration
 *
 * This example reveals subtle behaviors in CYRE that might surprise developers.
 * Run this with Node.js to observe the output and understand CYRE's execution patterns.
 */

// Import CYRE - in a real project, you would use:
// const { cyre } = require('cyre');
// For demo purposes, mock the implementation
const {cyre} = mockCyre()

// Initialize and clear logs
cyre.initialize()
console.log('\n======= CYRE GOTCHAS DEMONSTRATION =======\n')
console.log('Starting time: ' + new Date().toISOString())
console.log('')

// Helper to log with timestamps
const startTime = Date.now()
function log(message) {
  const elapsed = Date.now() - startTime
  console.log(`[${elapsed.toString().padStart(5, ' ')}ms] ${message}`)
}

/**
 * GOTCHA #1: Chain reactions with different payload patterns
 *
 * This demonstrates how payload transformation works in chain reactions
 */
log('Setting up GOTCHA #1: Chain Reactions')

// Setup chain reaction actions
cyre.action({id: 'start-chain', type: 'chain-demo'})
cyre.action({id: 'middle-chain', type: 'chain-demo'})
cyre.action({id: 'end-chain', type: 'chain-demo'})

// Chain handlers that transform payloads
cyre.on('start-chain', payload => {
  log(`Start chain executed with: ${JSON.stringify(payload)}`)

  // Return link to next action with transformed payload
  return {
    id: 'middle-chain',
    payload: {
      ...payload,
      step: 'middle',
      value: payload.value * 2 // Transform the value
    }
  }
})

cyre.on('middle-chain', payload => {
  log(`Middle chain executed with: ${JSON.stringify(payload)}`)

  // Return link to the final action with transformed payload
  return {
    id: 'end-chain',
    payload: {
      ...payload,
      step: 'end',
      value: payload.value + 10 // Further transform the value
    }
  }
})

cyre.on('end-chain', payload => {
  log(`End chain executed with: ${JSON.stringify(payload)}`)
  return {complete: true}
})

// Start the chain reaction
log('Starting chain reaction:')
cyre.call('start-chain', {value: 5, step: 'start'})

/**
 * GOTCHA #2: Debounce + Change Detection Interaction
 *
 * This shows how debounce and detectChanges interact in unexpected ways
 */
setTimeout(() => {
  log('\nSetting up GOTCHA #2: Debounce + Change Detection')

  // Action with both debounce and detectChanges
  cyre.action({
    id: 'debounce-changes',
    type: 'change-demo',
    debounce: 300,
    detectChanges: true,
    payload: {initial: true}
  })

  cyre.on('debounce-changes', payload => {
    log(`Debounce+Changes handler: ${JSON.stringify(payload)}`)
    return {executed: true}
  })

  // Make multiple calls with same and different payloads
  log('Calling with payload A multiple times (same value):')
  cyre.call('debounce-changes', {value: 'A'})

  setTimeout(() => {
    log('Calling again with payload A (within debounce window):')
    cyre.call('debounce-changes', {value: 'A'})

    setTimeout(() => {
      log('Calling with payload B (within debounce window):')
      cyre.call('debounce-changes', {value: 'B'})

      setTimeout(() => {
        log('Calling with payload B again (after debounce, but same value):')
        cyre.call('debounce-changes', {value: 'B'})
      }, 350) // Just after debounce period
    }, 100)
  }, 100)
}, 500)

/**
 * GOTCHA #3: Parallel vs. Sequential Timer Queue
 *
 * This demonstrates the sequential timer queue behavior we discovered
 */
setTimeout(() => {
  log('\nSetting up GOTCHA #3: Timer Queue Behavior')

  // Setup action with interval and repeat
  cyre.action({
    id: 'queue-test',
    type: 'queue-demo',
    interval: 300,
    repeat: 2
  })

  cyre.on('queue-test', payload => {
    log(`Queue Test executed with: ${JSON.stringify(payload)}`)
    return {executed: true}
  })

  // Make sequential calls with different payloads
  log('Making first call to queue-test:')
  cyre.call('queue-test', {order: 'first'})

  setTimeout(() => {
    log('Making second call to queue-test:')
    cyre.call('queue-test', {order: 'second'})

    setTimeout(() => {
      log('Making third call to queue-test:')
      cyre.call('queue-test', {order: 'third'})

      log('Demonstrating differences between repeat behavior and interval:')
      log('- Only the last call (third) will get the full repeat cycle')
      log('- Earlier calls will be limited because of the queue')
    }, 150)
  }, 150)
}, 1500)

/**
 * GOTCHA #4: Forget behavior with timers
 *
 * This demonstrates how forget() affects timers
 */
setTimeout(() => {
  log('\nSetting up GOTCHA #4: Forget Behavior with Timers')

  // Create a long-running interval
  cyre.action({
    id: 'forget-test',
    type: 'forget-demo',
    interval: 400,
    repeat: 5
  })

  cyre.on('forget-test', payload => {
    log(`Forget Test executed with: ${JSON.stringify(payload)}`)
    return {executed: true}
  })

  // Start the timer
  log('Starting forget-test timer:')
  cyre.call('forget-test', {value: 'will-be-forgotten'})

  // Call forget after first execution
  setTimeout(() => {
    log('Calling forget() on forget-test:')
    cyre.forget('forget-test')
    log('All scheduled executions for forget-test will be canceled')

    // Create a new action with the same ID
    setTimeout(() => {
      log('Creating new action with same ID after forget:')
      cyre.action({
        id: 'forget-test',
        type: 'forget-demo-new',
        interval: 300,
        repeat: 2
      })

      // Call the regenerated action
      log('Calling the regenerated action:')
      cyre.call('forget-test', {value: 'regenerated'})
    }, 500)
  }, 500)
}, 3000)

/**
 * GOTCHA #5: ID vs Type Subscription
 *
 * This demonstrates the critical gotcha about subscribing to IDs, not types
 */
setTimeout(() => {
  log('\nSetting up GOTCHA #5: ID vs Type Subscription')

  // Create two actions with same type but different IDs
  cyre.action({
    id: 'action-one',
    type: 'shared-type',
    payload: {source: 'one'}
  })

  cyre.action({
    id: 'action-two',
    type: 'shared-type',
    payload: {source: 'two'}
  })

  // Wrong way: Subscribe to the type
  cyre.on('shared-type', payload => {
    log(`Type handler executed with: ${JSON.stringify(payload)}`)
    return {executed: true}
  })

  // Right way: Subscribe to the ID
  cyre.on('action-one', payload => {
    log(`ID handler for action-one: ${JSON.stringify(payload)}`)
    return {executed: true}
  })

  cyre.on('action-two', payload => {
    log(`ID handler for action-two: ${JSON.stringify(payload)}`)
    return {executed: true}
  })

  // Call both actions
  log('Calling action-one:')
  cyre.call('action-one')

  setTimeout(() => {
    log('Calling action-two:')
    cyre.call('action-two')

    log('Notice: Only ID-based handlers executed, not the type-based handler')
  }, 100)
}, 5000)

// Add cleanup callback after all demonstrations
setTimeout(() => {
  log('\n======= DEMONSTRATION COMPLETE =======')
  log('Key takeaways:')
  log('1. Chain reactions transform payloads between steps')
  log('2. Debounce + detectChanges can cause unexpected skipping')
  log('3. Timer repeats form a queue - only last gets full cycles')
  log('4. forget() cleans up ALL timers for an action ID')
  log('5. Subscribe to action IDs, not types')
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
          // Process first item
          const processQueue = () => {
            const queue = cyreInstance.queue.get(id) || []
            if (queue.length === 0) {
              timers.delete(id)
              return
            }

            // Get current item
            const item = queue[0]

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
              queue.shift() // Remove from queue
            }

            // Schedule next execution if queue not empty
            if (queue.length > 0) {
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
