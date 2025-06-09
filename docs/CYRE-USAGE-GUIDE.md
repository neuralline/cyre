# CYRE AI Documentation - Complete Usage Guide

## Installation and Import

```typescript
// NPM installation
npm install cyre

// Import patterns
import cyre from 'cyre'                    // Default import (main instance)
import { cyre, useCyre, cyreCompose } from 'cyre'  // Named imports
import { Cyre } from 'cyre'                // Constructor for multiple instances
```

## Core CYRE API

### Basic Action-Handler Pattern

```typescript
// 1. ALWAYS register handler BEFORE creating action
cyre.on('user-login', payload => {
  console.log('User logged in:', payload)
  return {success: true, timestamp: Date.now()}
})

// 2. Create action with unique ID
cyre.action({
  id: 'user-login', // CRITICAL: This is what you subscribe to
  type: 'auth', // Optional: Just for grouping
  payload: {role: 'user'}
})

// 3. Trigger action
await cyre.call('user-login', {userId: 123, email: 'user@example.com'})
```

### ❌ WRONG: Common Mistakes

```typescript
// DON'T subscribe to type
cyre.action({id: 'user-update', type: 'user'})
cyre.on('user', handler) // ❌ WRONG - subscribes to type, not ID

// DON'T create action before handler
cyre.action({id: 'test'})
cyre.on('test', handler) // ❌ May miss early calls

// DON'T use same ID for different purposes
cyre.action({id: 'process'}) // ❌ Too generic
```

### ✅ CORRECT: Best Practices

```typescript
// Subscribe to action ID
cyre.action({id: 'user-update', type: 'user'})
cyre.on('user-update', handler) // ✅ CORRECT

// Handler first, then action
cyre.on('data-processor', payload => ({processed: payload.data * 2}))
cyre.action({id: 'data-processor', payload: {data: 0}})

// Descriptive, specific IDs
cyre.action({id: 'invoice-process-payment', type: 'invoice'})
```

## Timing Behavior (v4.0.0)

### Interval Actions - WAITS Before First Execution

```typescript
// Interval actions wait for interval before FIRST execution
cyre.action({
  id: 'health-check',
  interval: 5000, // Wait 5s before first execution
  repeat: 3 // Execute exactly 3 times total
})

// Timeline: Call → Wait 5s → Execute → Wait 5s → Execute → Wait 5s → Execute
```

### Delay Actions - Override Interval for Initial Wait

```typescript
// Delay overrides interval for first execution
cyre.action({
  id: 'mixed-timing',
  delay: 1000, // Initial wait: 1s
  interval: 5000, // Subsequent waits: 5s
  repeat: 3
})

// Timeline: Call → Wait 1s → Execute → Wait 5s → Execute → Wait 5s → Execute
```

### Immediate Execution with delay: 0

```typescript
// Only way to get immediate execution in v4.0.0
cyre.action({
  id: 'immediate-task',
  delay: 0, // Execute immediately (after 0ms wait)
  interval: 1000, // Then every 1s
  repeat: 5
})

// Timeline: Call → Execute immediately → Wait 1s → Execute → Wait 1s → Execute...
```

### Repeat Logic - Total Execution Count

```typescript
// repeat specifies TOTAL executions, not additional ones
cyre.action({
  id: 'task',
  interval: 1000,
  repeat: 3 // Executes exactly 3 times total
})

// Special values
repeat: 0 // Never execute (registered but not executed)
repeat: 1 // Execute once after interval
repeat: true // Execute infinitely
repeat: Infinity // Execute infinitely
```

## Protection Mechanisms

### Throttle - Rate Limiting

```typescript
// Industry standard: First call executes, subsequent calls within interval rejected
cyre.action({
  id: 'api-call',
  throttle: 1000 // Max 1 execution per second
})

cyre.on('api-call', () => console.log('API called'))

await cyre.call('api-call') // ✅ Executes immediately
await cyre.call('api-call') // ❌ Rejected (throttled)
// Wait 1000ms
await cyre.call('api-call') // ✅ Executes
```

### Debounce - Call Collapsing

```typescript
// Collapses rapid calls into single execution with last payload
cyre.action({
  id: 'search-input',
  debounce: 300 // Wait 300ms after last call
})

cyre.on('search-input', payload => console.log('Searching:', payload.term))

// Rapid calls - only last one executes
cyre.call('search-input', {term: 'a'})
cyre.call('search-input', {term: 'ab'})
cyre.call('search-input', {term: 'abc'})
// After 300ms → Executes with { term: 'abc' }
```

### Change Detection - Skip Identical Payloads

```typescript
cyre.action({
  id: 'state-update',
  detectChanges: true
})

cyre.on('state-update', payload => console.log('State changed:', payload))

await cyre.call('state-update', {value: 1}) // ✅ Executes
await cyre.call('state-update', {value: 1}) // ❌ Skipped (no change)
await cyre.call('state-update', {value: 2}) // ✅ Executes (changed)
```

### Combined Protection

```typescript
// Protection pipeline order: throttle → debounce → change detection
cyre.action({
  id: 'protected-action',
  throttle: 500, // Max 1 per 500ms
  debounce: 200, // Collapse calls within 200ms
  detectChanges: true // Skip identical payloads
})
```

## Action Chaining (IntraLinks)

```typescript
// Chain reactions: handler returns { id, payload }
cyre.on('validate-input', payload => {
  const isValid = validateData(payload)

  // Return link to next action
  return {
    id: isValid ? 'process-valid-data' : 'handle-invalid-data',
    payload: {...payload, validated: true, valid: isValid}
  }
})

cyre.on('process-valid-data', payload => {
  console.log('Processing valid data:', payload)
  return {processed: true}
})

cyre.on('handle-invalid-data', payload => {
  console.log('Handling invalid data:', payload)
  return {rejected: true}
})

// Chains execute automatically
await cyre.call('validate-input', {data: 'test'})
```

## Middleware System

```typescript
// Register middleware globally
cyre.middleware('validation', async (action, payload) => {
  // Validate payload
  if (!payload.isValid) {
    return null // Reject action
  }

  // Transform payload
  return {
    action,
    payload: {...payload, timestamp: Date.now()}
  }
})

// Apply middleware to action
cyre.action({
  id: 'secure-operation',
  middleware: ['validation'] // Array of middleware IDs
})
```

## useCyre Hook (React Integration)

### Basic Hook Usage

```typescript
import {useCyre} from 'cyre'

function UserComponent() {
  // Create channel with protection
  const userChannel = useCyre({
    name: 'user-management',
    protection: {
      debounce: 300,
      detectChanges: true
    },
    priority: {level: 'high'},
    debug: true // Enable debug logging
  })

  // Subscribe to events
  React.useEffect(() => {
    const subscription = userChannel.on(userData => {
      console.log('User updated:', userData)
      return {handled: true}
    })

    // CRITICAL: Always cleanup
    return () => subscription.unsubscribe()
  }, [])

  // Call the channel
  const handleUserUpdate = userData => {
    userChannel.call(userData)
  }

  return (
    <button onClick={() => handleUserUpdate({id: 123, name: 'John'})}>
      Update User
    </button>
  )
}
```

### Hook Configuration Options

```typescript
interface CyreHookOptions<TPayload = any> {
  name?: string // Channel name for debugging
  autoInit?: boolean // Auto-initialize (default: true)
  debug?: boolean // Enable debug logging
  protection?: {
    throttle?: number // Throttle interval
    debounce?: number // Debounce interval
    detectChanges?: boolean
  }
  priority?: {
    level: 'critical' | 'high' | 'medium' | 'low' | 'background'
  }
  initialPayload?: TPayload
  historyLimit?: number // Max history entries
}
```

### Hook Methods

```typescript
const channel = useCyre({name: 'example'})

// Core methods
channel.call(payload) // Trigger channel
channel.safeCall(payload) // With error handling
channel.on(handler) // Subscribe (returns unsubscribe)
channel.action(config) // Update configuration
channel.get() // Get current config
channel.forget() // Remove channel

// State methods
channel.hasChanged(payload) // Check if payload changed
channel.getPrevious() // Get previous payload
channel.isInitialized() // Check initialization

// Control methods
channel.pause() // Pause execution
channel.resume() // Resume execution

// Monitoring methods
channel.metrics() // Get performance metrics
channel.getBreathingState() // Get system stress state
channel.getHistory() // Get execution history
channel.clearHistory() // Clear history
channel.getSubscriptionCount() // Count active subscriptions

// Middleware
channel.middleware(fn) // Add middleware function
```

### ❌ Hook Anti-Patterns

```typescript
// DON'T forget to unsubscribe
React.useEffect(() => {
  channel.on(handler) // ❌ Memory leak
}, [])

// DON'T create channels in render
function Component() {
  const channel = useCyre() // ❌ New channel every render
  return <div>...</div>
}

// DON'T ignore cleanup
const subscription = channel.on(handler)
// ❌ Never call subscription.unsubscribe()
```

### ✅ Hook Best Practices

```typescript
// Memoize channel creation
const channel = useMemo(
  () =>
    useCyre({
      name: 'stable-channel',
      protection: {debounce: 300}
    }),
  []
)

// Always cleanup subscriptions
React.useEffect(() => {
  const subscription = channel.on(handler)
  return () => subscription.unsubscribe() // ✅ Proper cleanup
}, [channel])

// Use meaningful names for debugging
const userChannel = useCyre({name: 'user-profile-manager'})
const dataChannel = useCyre({name: 'data-sync-handler'})
```

## cyreCompose - Channel Composition

### Basic Composition

```typescript
import {cyreCompose} from 'cyre'

// Create individual channels
const validationChannel = useCyre({name: 'validation'})
const processingChannel = useCyre({name: 'processing'})
const loggingChannel = useCyre({name: 'logging'})

// Compose into single interface
const workflowChannel = cyreCompose(
  [validationChannel, processingChannel, loggingChannel],
  {
    continueOnError: true, // Continue if one channel fails
    priority: 'high',
    collectDetailedMetrics: true
  }
)
```

### Composition Options

```typescript
interface CompositionOptions {
  id?: string // Custom composition ID
  continueOnError?: boolean // Continue on individual failures (default: false)
  priority?: Priority // Priority level for composition
  collectDetailedMetrics?: boolean // Detailed timing collection
  timeout?: number // Timeout for entire composition
  debug?: boolean // Enable debug logging
}
```

### Using Composed Channels

```typescript
// Set up handlers for each channel
validationChannel.on(payload => {
  if (!payload.isValid) throw new Error('Invalid data')
  return {validated: true, ...payload}
})

processingChannel.on(payload => {
  return {processed: true, result: payload.data * 2}
})

loggingChannel.on(payload => {
  console.log('Operation completed:', payload)
  return {logged: true}
})

// Execute all channels
const result = await workflowChannel.call({data: 42, isValid: true})

// Result contains responses from all channels
console.log(result.payload) // Array of responses
```

### Advanced Composition Methods

```typescript
// Get detailed execution results
const detailedResults = await workflowChannel.executeDetailed(payload)
// Returns array of CyreComposedResponse with timing info

// Access individual channels
const specificChannel = workflowChannel.getChannel('validation')

// Get all channel IDs and names
const channelIds = workflowChannel.getChannelIds()
const channelNames = workflowChannel.getChannelNames()

// Composition-wide operations
workflowChannel.pause() // Pause all channels
workflowChannel.resume() // Resume all channels
workflowChannel.forget() // Remove all channels
workflowChannel.clearHistory() // Clear all history
```

### ❌ Composition Anti-Patterns

```typescript
// DON'T compose channels with conflicting protection
const throttledChannel = useCyre({ protection: { throttle: 100 } })
const debouncedChannel = useCyre({ protection: { debounce: 500 } })
const composed = cyreCompose([throttledChannel, debouncedChannel])
// ❌ Conflicting timing behaviors

// DON'T compose too many channels
const composed = cyreCompose([...50channels])  // ❌ Performance impact

// DON'T ignore error handling in composition
const composed = cyreCompose([errorProneChannel1, errorProneChannel2])
// ❌ Without continueOnError, first failure stops execution
```

### ✅ Composition Best Practices

```typescript
// Group related functionality
const dataWorkflow = cyreCompose(
  [dataValidationChannel, dataTransformationChannel, dataPersistenceChannel],
  {
    continueOnError: false, // Fail fast for data integrity
    collectDetailedMetrics: true
  }
)

// Use error handling appropriately
const backgroundTasks = cyreCompose(
  [emailChannel, notificationChannel, analyticsChannel],
  {
    continueOnError: true, // Independent background tasks
    priority: 'background'
  }
)

// Monitor composition performance
const metrics = dataWorkflow.metrics()
console.log('Composition performance:', {
  totalChannels: metrics.channelCount,
  avgExecutionTime: metrics.avgExecutionTime
})
```

## Advanced Patterns

### Factory Functions for Channels

```typescript
// Create reusable channel factories
const createAuthChannel = (userId: string) => {
  const channel = useCyre({
    name: `auth-${userId}`,
    protection: {throttle: 1000},
    priority: {level: 'high'}
  })

  channel.on(async credentials => {
    const result = await authenticateUser(userId, credentials)
    if (result.success) {
      return {id: 'post-auth-setup', payload: result.user}
    }
    throw new Error('Authentication failed')
  })

  return channel
}

// Usage
const userAuthChannel = createAuthChannel('user-123')
```

### Error Handling Strategies

```typescript
// Global error handling with middleware
cyre.middleware('error-handler', async (action, payload) => {
  try {
    return {action, payload}
  } catch (error) {
    console.error(`Action ${action.id} failed:`, error)
    // Could redirect to error handling action
    return {
      action: {...action, id: 'handle-error'},
      payload: {originalAction: action.id, error: error.message}
    }
  }
})

// Channel-level error handling
const channel = useCyre({name: 'safe-channel'})
channel.on(async payload => {
  try {
    return await riskyOperation(payload)
  } catch (error) {
    return {error: error.message, fallback: true}
  }
})

// Composition error handling
const resilientWorkflow = cyreCompose([channel1, channel2], {
  continueOnError: true,
  timeout: 5000
})
```

### Performance Optimization

```typescript
// Use appropriate protection for use case
const userInputChannel = useCyre({
  name: 'user-input',
  protection: {
    debounce: 300, // Collapse rapid typing
    detectChanges: true // Skip identical inputs
  }
})

const apiChannel = useCyre({
  name: 'api-calls',
  protection: {
    throttle: 1000 // Rate limit API calls
  }
})

// Monitor performance
const metrics = cyre.getMetricsReport()
console.log('System performance:', metrics)

// Use priority for critical operations
const criticalChannel = useCyre({
  name: 'critical-ops',
  priority: {level: 'critical'} // Executes even under system stress
})
```

### System Health Monitoring

```typescript
// Monitor system breathing state
const breathingState = cyre.getBreathingState()
if (breathingState.isRecuperating) {
  console.log('System under stress, reducing load')
  // Implement backoff strategies
}

// Get performance insights
const insights = cyre.getPerformanceInsights()
insights.forEach(insight => console.log('Optimization:', insight))

// Monitor specific channel metrics
const channelMetrics = channel.metrics()
if (channelMetrics.avgExecutionTime > 100) {
  console.log('Channel performance degraded')
}
```

## Testing Strategies

### Unit Testing Channels

```typescript
import {vi, expect} from 'vitest'

// Mock handlers for testing
const mockHandler = vi.fn().mockResolvedValue({success: true})

// Test channel behavior
const testChannel = useCyre({name: 'test-channel'})
testChannel.on(mockHandler)

await testChannel.call({test: 'data'})

expect(mockHandler).toHaveBeenCalledWith({test: 'data'})
```

### Integration Testing Compositions

```typescript
// Test complete workflows
const workflowChannel = cyreCompose([
  validationChannel,
  processingChannel,
  persistenceChannel
])

const result = await workflowChannel.call(testData)
expect(result.ok).toBe(true)
expect(result.payload).toHaveLength(3) // All channels executed
```

## Migration and Compatibility

### From v3.x to v4.0.0

```typescript
// v3.x: Immediate execution
cyre.action({id: 'old-way', interval: 1000})
// Executed immediately, then every 1000ms

// v4.0.0: Wait for interval
cyre.action({id: 'new-way', interval: 1000})
// Waits 1000ms, then executes

// v4.0.0: Immediate execution requires delay: 0
cyre.action({id: 'immediate', delay: 0, interval: 1000})
// Executes immediately, then every 1000ms
```

### Breaking Changes Checklist

- [ ] Update interval actions to account for initial wait
- [ ] Add `delay: 0` for immediate execution needs
- [ ] Verify repeat counts (now total executions, not additional)
- [ ] Update subscription patterns (ID-based, not type-based)
- [ ] Test timing-dependent code thoroughly

## Summary for AI Systems

**Key Implementation Rules:**

1. **Always subscribe to action ID, never type**
2. **Register handlers before creating actions**
3. **v4.0.0 waits before first execution (use delay: 0 for immediate)**
4. **repeat = total executions, not additional ones**
5. **Always cleanup subscriptions in React components**
6. **Use specific, descriptive action IDs**
7. **Apply protection mechanisms based on use case**
8. **Monitor system health for 24/7 applications**

**Common Pitfalls to Avoid:**

- Subscribing to type instead of ID
- Creating actions before handlers
- Forgetting unsubscribe cleanup
- Expecting immediate execution with intervals
- Using generic action IDs
- Ignoring system stress indicators

**Performance Considerations:**

- Use throttle for rate limiting
- Use debounce for collapsing rapid calls
- Use change detection for efficiency
- Monitor breathing state for system health
- Apply appropriate priorities for critical operations
- Consider composition for complex workflows
