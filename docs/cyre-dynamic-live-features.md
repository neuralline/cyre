//cyre/cyre-dynamic-live-features.md

# Cyre's Dynamic and Live Features

<!-- @format -->

Unlike Redux and other state management libraries that typically require static setup during initialization, Cyre offers powerful runtime capabilities that allow you to dynamically construct, modify, and manage your event system while your application is running. This makes Cyre exceptionally well-suited for applications that need to respond to changing requirements, such as apps with live data feeds, dynamic user interfaces, or systems that evolve based on user behavior.

## Dynamic Event Registration

Cyre allows you to register and configure event handlers at any time during your application's lifecycle:

```typescript
// Dynamically add new handlers based on runtime conditions
function setupDynamicHandlers(config) {
  if (config.feature.analytics) {
    cyre.on('user-action', trackUserAnalytics)
    cyre.action({
      id: 'user-action',
      throttle: config.performance.throttleRate
    })
  }

  if (config.feature.notifications) {
    cyre.on('data-update', triggerNotification)
  }
}

// Call this whenever configuration changes
setupDynamicHandlers(getConfig())
```

## Dynamic IDs for Event Instances

You can generate unique IDs for events, making them perfect for handling multiple instances of the same component:

```typescript
// Generate dynamic event IDs based on component instances
function createComponentEvents(componentId) {
  const eventIds = {
    init: `component_init_${componentId}`,
    update: `component_update_${componentId}`,
    destroy: `component_destroy_${componentId}`
  }

  // Register handlers for this specific component instance
  cyre.on([
    {
      id: eventIds.init,
      fn: data => initializeComponent(componentId, data)
    },
    {
      id: eventIds.update,
      fn: data => updateComponent(componentId, data)
    },
    {
      id: eventIds.destroy,
      fn: () => destroyComponent(componentId)
    }
  ])

  // Configure actions
  cyre.action([
    {
      id: eventIds.init,
      log: true
    },
    {
      id: eventIds.update,
      detectChanges: true,
      throttle: 100
    }
  ])

  return eventIds
}

// Usage - create dynamic events for each component instance
const component1Events = createComponentEvents('comp-1')
const component2Events = createComponentEvents('comp-2')

// Trigger events for specific component instances
cyre.call(component1Events.init, {
  /* component 1 data */
})
cyre.call(component2Events.init, {
  /* component 2 data */
})
```

## Dynamic Event Cleanup

Cyre lets you forget events when they're no longer needed:

```typescript
// When a component is removed
function removeComponent(componentId) {
  const eventIds = getAllComponentEventIds(componentId)

  // Forget all events for this component
  eventIds.forEach(eventId => {
    cyre.forget(eventId)
  })

  // Remove from component registry
  deleteComponentRecord(componentId)
}
```

## Pause and Resume Events at Runtime

You can temporarily pause and resume events without removing them:

```typescript
// During heavy operations
function startHeavyOperation() {
  // Pause non-critical events during the operation
  cyre.pause('background-sync')
  cyre.pause('analytics-tracking')
  cyre.pause('ui-animations')

  // Perform heavy operation...
  performOperation().then(() => {
    // Resume events when done
    cyre.resume('background-sync')
    cyre.resume('analytics-tracking')
    cyre.resume('ui-animations')
  })
}
```

## Constructing Live Data Streams

Cyre excels at handling live data streams from databases or websockets:

```typescript
// Set up connection to data source
function initializeDataStream(sourceConfig) {
  // Create a unique ID for this data stream
  const streamId = `data-stream-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`

  // Register events for this data stream
  cyre.on([
    {
      id: `${streamId}-data`,
      fn: newData => {
        processIncomingData(newData)

        // Chain to appropriate handlers
        return {
          id: `${streamId}-update`,
          payload: {
            source: streamId,
            data: newData,
            timestamp: Date.now()
          }
        }
      }
    },
    {
      id: `${streamId}-update`,
      fn: payload => {
        // Update UI
        updateUI(payload.data)

        // Store in local cache
        updateLocalCache(payload.data)

        // Conditionally trigger notifications
        if (isNotifiable(payload.data)) {
          return {
            id: `${streamId}-notify`,
            payload: {
              message: createNotificationMessage(payload.data),
              level: determineNotificationLevel(payload.data),
              source: payload.source,
              timestamp: payload.timestamp
            }
          }
        }
      }
    },
    {
      id: `${streamId}-notify`,
      fn: notification => {
        showNotification(notification)
      }
    },
    {
      id: `${streamId}-error`,
      fn: error => {
        handleStreamError(error, streamId)

        // Attempt reconnection if appropriate
        if (shouldReconnect(error)) {
          setTimeout(() => {
            cyre.call(`${streamId}-reconnect`)
          }, calculateBackoff(error))
        }
      }
    },
    {
      id: `${streamId}-reconnect`,
      fn: () => {
        reconnectToDataSource(sourceConfig, streamId)
      }
    },
    {
      id: `${streamId}-close`,
      fn: () => {
        closeDataConnection(streamId)[
          // Clean up all events for this stream
          (`${streamId}-data`,
          `${streamId}-update`,
          `${streamId}-notify`,
          `${streamId}-error`,
          `${streamId}-reconnect`,
          `${streamId}-close`)
        ].forEach(eventId => {
          cyre.forget(eventId)
        })
      }
    }
  ])

  // Configure actions
  cyre.action([
    {
      id: `${streamId}-data`,
      throttle: sourceConfig.maxRate || 100 // Rate limit incoming data
    },
    {
      id: `${streamId}-update`,
      detectChanges: true // Only process if data changed
    },
    {
      id: `${streamId}-notify`,
      throttle: 1000 // Limit notifications to once per second
    }
  ])

  // Connect to data source
  const connection = connectToDataSource(sourceConfig, {
    onData: data => cyre.call(`${streamId}-data`, data),
    onError: error => cyre.call(`${streamId}-error`, error),
    onClose: () => cyre.call(`${streamId}-close`)
  })

  // Return stream controller
  return {
    id: streamId,
    pause: () => {
      cyre.pause(`${streamId}-data`)
      cyre.pause(`${streamId}-update`)
    },
    resume: () => {
      cyre.resume(`${streamId}-data`)
      cyre.resume(`${streamId}-update`)
    },
    close: () => {
      cyre.call(`${streamId}-close`)
    }
  }
}

// Usage - create multiple live data streams
const userActivityStream = initializeDataStream({
  source: 'user-activity',
  maxRate: 50
})

const stockPriceStream = initializeDataStream({
  source: 'stock-prices',
  maxRate: 500
})

// Pause specific stream during certain operations
function showUserProfile() {
  // Pause stock updates while viewing profile
  stockPriceStream.pause()

  // When done
  function closeProfile() {
    stockPriceStream.resume()
  }
}
```

## Dynamic Runtime Configuration

Cyre can adapt its behavior based on runtime conditions:

```typescript
// Monitor system resources and adjust event handling
cyre.on('system-monitor', () => {
  const performance = getSystemPerformance()
  const cyreMetrics = cyre.getPerformanceState()

  let updatedConfig = {}

  // Adjust throttling based on CPU usage
  if (performance.cpu > 80) {
    updatedConfig = {
      'ui-update': {throttle: 300},
      'data-sync': {throttle: 2000}
    }
  } else if (performance.cpu > 50) {
    updatedConfig = {
      'ui-update': {throttle: 100},
      'data-sync': {throttle: 1000}
    }
  } else {
    updatedConfig = {
      'ui-update': {throttle: 16}, // 60fps
      'data-sync': {throttle: 500}
    }
  }

  // Apply new configuration
  Object.entries(updatedConfig).forEach(([eventId, config]) => {
    cyre.action({
      id: eventId,
      ...config
    })
  })
})

// Start system monitoring
cyre.action({
  id: 'system-monitor',
  interval: 10000, // Check every 10 seconds
  repeat: true
})

cyre.call('system-monitor')
```

## Compared to Redux and Other State Managers

Unlike Redux, which uses:

- Static reducer functions defined at startup
- Global store initialized once
- Fixed action types
- Middleware configured at initialization

Cyre offers:

- Dynamic handler registration at any time
- Event handlers that can be added, modified, paused, or removed
- Conditional event chains that adapt to runtime conditions
- Automatic performance optimization through the Quantum Breathing system
- Self-healing capability through stress detection and recuperation

This makes Cyre exceptionally well-suited for:

- Applications with changing behaviors based on user interactions
- Systems that need to adapt to varying performance conditions
- UIs that dynamically create and remove components
- Live data processing from multiple sources
- Long-running applications that need to adjust behavior over time
