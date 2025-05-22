# CYRE

```sh
Neural Line
Reactive event manager
C.Y.R.E ~/`SAYER`/
action-on-call
```

> CYRE is a sophisticated reactive event management system with a unique channel-based architecture. It's designed for 24/7 operation with advanced protection mechanisms, adaptive rate limiting through a "Breath system," and comprehensive middleware support. Evolved from the original Quantum-Inception clock (2016)

## Installation

```sh
npm i cyre
```

```sh
pnpm add cyre
```

## Core Features

### Event Management

- **Action-based event dispatching**: Define actions with rich configurability
- **Reactive state management**: Automatic state tracking with change detection
- **Action chaining**: Build workflows with automatic action sequencing via intraLinks
- **Protection features**: Built-in throttle, debounce, and change detection
- **Middleware system**: Transform and validate actions and payloads

### Breathing System

- **Adaptive rate limiting**: Natural rate control through breathing patterns
- **System-aware recovery**: Enters recuperation during high stress
- **Self-healing architecture**: Automatic recovery from system overload
- **Priority-based execution**: Critical actions take precedence during stress
- **Circuit breaker pattern**: Prevents cascading failures under load

### Hooks API

- **useCyre**: Simplified React/component integration
- **Automatic cleanup**: Subscription management with proper disposal
- **Composable channels**: Combine channels with cyreCompose
- **Stream operations**: Reactive programming with map, filter, switchMap, etc.

## Breaking Changes in v4.0.0

### Timing Behavior

As of v4.0.0, Cyre has standardized its timing behaviors:

1. **Interval Execution**: First execution waits for the interval (similar to setInterval)
2. **Repeat Count**: The `repeat` property specifies the total executions (not additional ones)
3. **Delay Override**: When both `delay` and `interval` are specified, `delay` controls the first wait time
4. **No Immediate Execution**: Actions with intervals don't execute immediately by default
5. **Immediate Option**: Use `delay: 0` for immediate first execution

## Basic Usage

```typescript
import {cyre} from 'cyre'

// Define an action
cyre.action({
  id: 'greeting',
  payload: {message: 'Hello'}
})

// Subscribe to events (IMPORTANT: Subscribe to the action ID, not type)
cyre.on('greeting', payload => {
  console.log(`Received: ${payload.message}`)
  return {executed: true}
})

// Trigger action
cyre.call('greeting', {message: 'Hello, Cyre!'})
```

## Advanced Features

### Timing and Execution Behavior

```typescript
// Action with interval - waits before first execution
cyre.action({
  id: 'delayed-start',
  interval: 1000, // Wait 1000ms before first execution
  repeat: 3 // Execute exactly 3 times total
})

// Action with delay - overrides interval for first execution
cyre.action({
  id: 'custom-timing',
  delay: 500, // First wait is 500ms
  interval: 1000, // Subsequent waits are 1000ms
  repeat: 3 // Execute exactly 3 times total
})

// Action with immediate execution
cyre.action({
  id: 'immediate-start',
  delay: 0, // Execute immediately
  interval: 1000, // Then wait 1000ms between executions
  repeat: 3 // Execute exactly 3 times total
})
```

### Breathing System Protection

```typescript
// Action automatically adapts to system stress
cyre.action({
  id: 'protected-action',
  priority: {level: 'high'}, // Higher priority during stress
  interval: 1000 // Interval adapts to breathing rate
})

// Monitor breathing state
const breathingState = cyre.getBreathingState()
console.log(`System stress: ${breathingState.stress * 100}%`)
console.log(`Current breathing rate: ${breathingState.currentRate}ms`)
console.log(`Recuperating: ${breathingState.isRecuperating}`)
```

### Action Chaining

```typescript
// First handler in chain
cyre.on('step-one', data => {
  const processed = transformData(data)

  // Return intraLink to next action
  return {
    id: 'step-two',
    payload: processed
  }
})

// Second handler receives processed data
cyre.on('step-two', processedData => {
  // Process further
  console.log('Second step received:', processedData)
})

// Start the chain
cyre.call('step-one', {value: 'initial'})
```

### Protection Features

```typescript
// Throttle - limit execution rate
cyre.action({
  id: 'throttled-action',
  throttle: 1000 // Maximum one execution per second
})

// Debounce - collapse rapid calls
cyre.action({
  id: 'debounced-action',
  debounce: 300 // Wait 300ms after last call before executing
})

// Change detection - only execute on payload changes
cyre.action({
  id: 'efficient-action',
  detectChanges: true // Skip execution if payload hasn't changed
})
```

### Middleware System

```typescript
// Register middleware
cyre.middleware('validation', async (action, payload) => {
  // Validate payload
  if (!payload.isValid) {
    // Return null to reject the action
    return null
  }

  // Return modified action and payload to continue
  return {
    action,
    payload: {...payload, validated: true}
  }
})

// Apply middleware to an action
cyre.action({
  id: 'secure-action',
  middleware: ['validation']
})
```

### React Integration with Hooks

```typescript
import {useCyre} from 'cyre'

function UserComponent() {
  // Create a channel with protection
  const userChannel = useCyre({
    name: 'user',
    protection: {
      debounce: 300,
      detectChanges: true
    }
  })

  // Subscribe to channel events
  React.useEffect(() => {
    const subscription = userChannel.on(userData => {
      console.log('User updated:', userData)
    })

    // Clean up when component unmounts
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

### Stream API for Reactive Programming

```typescript
import {createStream} from 'cyre'

// Create a stream
const numberStream = createStream('numbers')

// Add transformations
const doubledStream = numberStream
  .map(n => n * 2)
  .filter(n => n > 10)
  .debounce(300)

// Subscribe to results
doubledStream.subscribe(result => {
  console.log('Processed value:', result)
})

// Push values to the stream
numberStream.next(5) // Nothing (5*2=10, filtered out)
numberStream.next(6) // Outputs: "Processed value: 12"
```

## System Health Monitoring

```typescript
// Check system health through breathing metrics
const {breathing, stress} = cyre.getPerformanceState()

if (breathing.isRecuperating) {
  console.log(`System recuperating at ${breathing.recuperationDepth * 100}%`)
}

console.log(`Current stress levels:
  CPU: ${stress.cpu * 100}%
  Memory: ${stress.memory * 100}%
  Event Loop: ${stress.eventLoop}ms
  Combined: ${stress.combined * 100}%`)
```

## Important Gotchas

1. **Subscribe to IDs, not Types**: Always subscribe using the action ID, not the type:

   ```typescript
   // CORRECT
   cyre.on('user-update', payload => {
     /* ... */
   })

   // INCORRECT - Won't work!
   cyre.on('user', payload => {
     /* ... */
   })
   ```

2. **Interval Queue Behavior**: Multiple calls to the same action with intervals form a queue:

   ```typescript
   // These form a queue, they don't execute in parallel
   cyre.call('status-check', {service: 'auth'})
   cyre.call('status-check', {service: 'database'})
   ```

3. **Debounce + detectChanges Interaction**: When combining these features, identical payloads might be skipped entirely:

   ```typescript
   // Action with both debounce and detectChanges
   cyre.action({
     id: 'update-view',
     debounce: 300,
     detectChanges: true
   })

   // If these payloads are identical, only one execution occurs
   cyre.call('update-view', {page: 1})
   cyre.call('update-view', {page: 1})
   ```

4. **forget() Behavior**: Using `forget()` cancels ALL pending executions for an action:

   ```typescript
   // This removes the action entirely, including all queued calls
   cyre.forget('long-running-task')
   ```

5. **Timing of First Execution**: For interval actions, the first execution occurs after waiting for the interval.

## Project Evolution

- 1.0.0: Initial release

  - `Quantum inception` of Cyre
  - Core event management `action-on-call`
  - Timing control `TimeKeeper`
  - Recuperation
  - OOP architecture (discontinued)

- 2.0.0: SOLID

  - Functional SOLID architecture (refactor)
  - Enhanced TimeKeeper integration
  - Performance optimizations
  - Cross-platform support

- 3.0.0: Interface

  - Typescript update (refactor)
  - Enhanced type safety
  - Improved performance
  - Better developer experience

- 3.0.1: TimeKeeper

  - Robust timeKeeper
  - better integration with core
  - precision timing
  - adapted TimeKeeper's terminology like Keep, Forget and Recuperation

- 3.0.2: Surge

  - Surge protection
  - insures Cyre's capability to run 24/7
  - Improved performance

- 3.1.0: Breath

  - Natural rate limiting through Breathing Rate
  - System-wide stress management
  - Self-healing recuperation
  - Adaptive timing controls
  - Priority-based execution

- 3.1.6: Cyre Lock

  - Added `cyre.lock()` to prevent runtime modification
  - Enhanced queue management for interval actions
  - Expanded test coverage for edge cases
  - Improved documentation and examples
  - Fixed detectChanges behavior with debounce

- 4.0.0: Cyre Hooks
  - `useCyre`
  - Delay
  - Middleware
  - cyre-compose (batch channel processing)
  - Updated timing logic and execution behavior
  - Stream API for reactive programming

## Philosophy

Cyre follows these core principles:

- **Precision**: Accurate timing and reliable event handling
- **Protection**: Natural rate limiting through breathing system
- **Performance**: System-aware optimization and stress management
- **Adaptability**: Self-adjusting to system conditions
- **Predictability**: Consistent behavior with clear execution rules
- **Horizontal architecture**: Independent channels that expand horizontally

## Origins

Originally evolved from the Quantum-Inception clock project (2016), Cyre has grown into a full-featured event management system while maintaining its quantum timing heritage. The latest evolution introduces middleware, hooks, and standardized execution behavior to provide a more predictable and powerful developer experience.

```sh
Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
Expands HORIZONTALLY as your projects grow
```

## License

Distributed under the MIT license. See `LICENSE` for more information.

---

# CYRE API Reference

## Overview

CYRE is a sophisticated event management system that provides reactive networking with automatic protection mechanisms. This document details all available methods in the CYRE API as of version 4.0.0.

## Core Methods

### `cyre.initialize()`

Initializes the CYRE system with default settings and activates the breathing system.

**Parameters:** None

**Returns:**

```typescript
{
  ok: boolean
  payload: number
  message: string
}
```

**Example:**

```javascript
// Initialize CYRE at application startup
const result = cyre.initialize()
if (result.ok) {
  console.log('CYRE initialized successfully')
}
```

**Gotchas:**

- Should be called before any other CYRE operations
- Multiple calls won't cause issues but aren't necessary

---

### `cyre.action(attribute)`

Registers a new action or array of actions with the system.

**Parameters:**

- `attribute`: A single action configuration object or array of action configurations

**Action Configuration Properties:**

```typescript
{
  id: string;               // Required: Unique identifier for the action
  type?: string;            // Optional: Group identifier (defaults to ID if not provided)
  payload?: any;            // Optional: Initial payload data
  interval?: number;        // Optional: Milliseconds between repeat executions
  delay?: number;           // Optional: Milliseconds to wait before first execution
  repeat?: number|boolean;  // Optional: Number of total executions or true for infinite
  throttle?: number;        // Optional: Minimum milliseconds between executions
  debounce?: number;        // Optional: Delay before execution, resets on new calls
  detectChanges?: boolean;  // Optional: Only execute when payload changes
  log?: boolean;            // Optional: Enable logging for this action
  middleware?: string[];    // Optional: Array of middleware IDs to apply
  priority?: {              // Optional: Execution priority settings
    level: 'critical' | 'high' | 'medium' | 'low' | 'background'
  }
}
```

**Returns:** void

**Example:**

```javascript
// Register a simple action
cyre.action({
  id: 'user-login',
  type: 'auth',
  payload: {defaultRole: 'user'}
})

// Register an interval action (v4.0.0 behavior)
cyre.action({
  id: 'health-check',
  interval: 30000, // Will wait 30s before first execution
  repeat: 3, // Will execute exactly 3 times total
  throttle: 5000 // Minimum 5s between checks
})

// Register multiple actions
cyre.action([
  {id: 'action1', payload: {value: 1}},
  {id: 'action2', payload: {value: 2}}
])
```

**Gotchas:**

- The `id` must be unique across all actions
- If `type` is omitted, it defaults to the value of `id`
- For interval actions, the first execution happens after waiting for the interval
- When both `delay` and `interval` are specified, `delay` controls the initial wait time

---

### `cyre.on(type, handler)`

Subscribes to actions by ID (not type) and registers a handler function.

**Parameters:**

- `type`: String action ID or array of subscriber objects
- `handler`: Function to execute when the action is called

**Returns:**

```typescript
{
  ok: boolean;
  message: string;
  unsubscribe?: () => boolean;
}
```

**Example:**

```javascript
// Subscribe to a single action by ID
cyre.on('user-login', payload => {
  console.log(`User logging in with role: ${payload.role}`)
  processLogin(payload)
})

// Chain to another action
cyre.on('validate-input', payload => {
  const isValid = validateData(payload)

  // Return link to next action in chain
  return {
    id: 'process-input',
    payload: {...payload, valid: isValid}
  }
})

// Subscribe to multiple actions
cyre.on([
  {
    id: 'action1',
    fn: payload => console.log('Action 1:', payload)
  },
  {
    id: 'action2',
    fn: payload => console.log('Action 2:', payload)
  }
])

// Using the unsubscribe function
const subscription = cyre.on('temp-listener', data => {
  console.log('Got data:', data)
})

// Later, clean up the subscription
if (subscription.unsubscribe) {
  subscription.unsubscribe()
}
```

**Gotchas:**

- The MOST CRITICAL gotcha: Subscribe to the action ID, not the type!
- Handler functions can return an object with `id` and `payload` to chain actions
- If using an array, each object must have both `id` and `fn` properties
- As of v4.0.0, subscription objects include an `unsubscribe` function for cleanup

---

### `cyre.call(id, payload)`

Triggers an action by ID with the provided payload.

**Parameters:**

- `id`: String action ID to call
- `payload`: Optional data to pass to the action handler

**Returns:** Promise

```typescript
Promise<{
  ok: boolean
  payload: any
  message: string
  error?: Error
}>
```

**Example:**

```javascript
// Simple call with payload
cyre.call('send-message', {
  recipient: 'user123',
  content: 'Hello world'
})

// Handling the response
const result = await cyre.call('validate-user', {userId: 123})
if (result.ok) {
  console.log('Validation successful:', result.payload)
} else {
  console.error('Validation failed:', result.message)
}
```

**Gotchas:**

- For actions with intervals, the execution starts after waiting for the interval
- Multiple calls to the same action with intervals form a queue, not parallel timers
- For actions with `detectChanges: true`, calls with identical payloads may be skipped
- For actions with `debounce`, rapid calls will be collapsed to a single execution
- Actions with `throttle` follow industry-standard behavior where the first call passes through

---

### `cyre.forget(id)`

Removes an action and cancels any pending timers associated with it.

**Parameters:**

- `id`: String action ID to remove

**Returns:** boolean - True if successful

**Example:**

```javascript
// Remove a specific action
const wasRemoved = cyre.forget('health-check')
if (wasRemoved) {
  console.log('Health check stopped successfully')
}
```

**Gotchas:**

- This cancels ALL pending executions of the action, regardless of which component called it
- The action definition is completely removed, not just paused
- Any queued calls waiting to execute will be discarded

---

### `cyre.clear()`

Removes all actions and subscribers and resets the system state.

**Parameters:** None

**Returns:** void

**Example:**

```javascript
// Reset the entire system
cyre.clear()
console.log('All actions and subscriptions cleared')
```

**Gotchas:**

- This is a drastic operation that removes everything, use with caution
- You'll need to re-register any actions and subscribers after clearing

---

## State Management Methods

### `cyre.get(id)`

Retrieves the current state of an action by ID.

**Parameters:**

- `id`: String action ID to retrieve

**Returns:** The action configuration object or undefined

**Example:**

```javascript
// Get current action state
const userAction = cyre.get('user-profile')
if (userAction) {
  console.log('Current profile data:', userAction.payload)
}
```

**Gotchas:**

- Returns undefined if the action doesn't exist
- Returns a reference to the actual action object, not a copy

---

### `cyre.hasChanged(id, payload)`

Checks if a payload is different from the last payload used for the action.

**Parameters:**

- `id`: String action ID to check
- `payload`: The new payload to compare against the previous one

**Returns:** boolean - True if the payload has changed

**Example:**

```javascript
// Check if a payload has changed
const newData = {userId: 123, status: 'active'}
if (cyre.hasChanged('user-status', newData)) {
  console.log('User status has changed')
}
```

**Gotchas:**

- Uses deep comparison, not reference equality
- Only works for actions that have been called at least once
- Works regardless of whether the action has `detectChanges` enabled

---

### `cyre.getPreviousPayload(id)`

Retrieves the most recent payload used for the specified action.

**Parameters:**

- `id`: String action ID

**Returns:** The previous payload or undefined if none exists

**Example:**

```javascript
// Get the previous payload
const prevPayload = cyre.getPreviousPayload('user-data')
if (prevPayload) {
  console.log('Previous user data:', prevPayload)
}
```

**Gotchas:**

- Returns undefined if the action doesn't exist or has never been called
- Only stored if the action uses `detectChanges: true`

---

## System Management Methods

### `cyre.pause(id)`

Pauses execution of a specific action or all actions if no ID is provided.

**Parameters:**

- `id`: Optional string action ID - if omitted, pauses all actions

**Returns:** void

**Example:**

```javascript
// Pause a specific action
cyre.pause('background-sync')

// Pause all actions
cyre.pause()
```

**Gotchas:**

- Doesn't remove the action, just prevents it from executing
- For interval actions, the timer is paused but the queue remains
- You need to call `resume()` to restart execution

---

### `cyre.resume(id)`

Resumes execution of a paused action or all actions if no ID is provided.

**Parameters:**

- `id`: Optional string action ID - if omitted, resumes all actions

**Returns:** void

**Example:**

```javascript
// Resume a specific action
cyre.resume('background-sync')

// Resume all actions
cyre.resume()
```

**Gotchas:**

- Has no effect on actions that aren't paused
- For interval actions, execution resumes from the current queue state

---

### `cyre.lock()`

Locks the system to prevent adding new actions or subscribers.

**Parameters:** None

**Returns:**

```typescript
{
  ok: boolean
  message: string
  payload: null
}
```

**Example:**

```javascript
// Lock the system after initialization is complete
cyre.lock()
console.log('CYRE system locked for security')
```

**Gotchas:**

- Existing actions and subscribers continue to work
- The lock cannot be easily undone - it's meant as a security feature
- Attempts to add new actions or subscribers after locking will fail silently

---

### `cyre.status()`

Checks if the CYRE system is online or shutdown.

**Parameters:** None

**Returns:** boolean - False if system is online, True if shutdown

**Example:**

```javascript
// Check system status
const isShutdown = cyre.status()
if (!isShutdown) {
  console.log('CYRE system is online')
}
```

**Gotchas:**

- The return value is the shutdown state (true = shutdown, false = online)
- This is the opposite of what many might expect (true ≠ online)

---

### `cyre.shutdown()`

Completely shuts down the CYRE system, clearing all resources.

**Parameters:** None

**Returns:** void

**Example:**

```javascript
// Shutdown at application exit
window.addEventListener('beforeunload', () => {
  cyre.shutdown()
})
```

**Gotchas:**

- In Node.js environments, this calls `process.exit(0)` which terminates the process
- All timers, actions, and subscribers are cleared
- The system cannot be restarted after shutdown without re-initializing

---

## Performance Monitoring Methods

### `cyre.getBreathingState()`

Retrieves the current state of the breathing system.

**Parameters:** None

**Returns:**

```typescript
{
  breathCount: number
  currentRate: number
  lastBreath: number
  stress: number
  isRecuperating: boolean
  recuperationDepth: number
  pattern: string
  nextBreathDue: number
}
```

**Example:**

```javascript
// Monitor system stress
const breathingState = cyre.getBreathingState()
console.log(`System stress: ${breathingState.stress * 100}%`)
if (breathingState.isRecuperating) {
  console.log(
    `System in recuperation mode: ${
      breathingState.recuperationDepth * 100
    }% depth`
  )
}
```

**Gotchas:**

- Stress values range from 0-1 (0% to 100%)
- During high stress, critical priority actions still execute
- When `isRecuperating` is true, only critical priority actions are processed

---

### `cyre.getPerformanceState()`

Retrieves performance metrics for the CYRE system.

**Parameters:** None

**Returns:**

```typescript
{
  totalProcessingTime: number
  totalCallTime: number
  totalStress: number
  stress: number
}
```

**Example:**

```javascript
// Monitor system performance
const perfState = cyre.getPerformanceState()
console.log(`System stress: ${perfState.stress * 100}%`)
console.log(`Total processing time: ${perfState.totalProcessingTime}ms`)
```

**Gotchas:**

- Values are cumulative since last initialization
- Stress value is the same as returned by `getBreathingState().stress`

---

### `cyre.getMetrics(channelId)`

Retrieves detailed metrics for a specific action ID.

**Parameters:**

- `channelId`: String action ID to get metrics for

**Returns:**

```typescript
{
  hibernating: boolean
  activeFormations: number
  inRecuperation: boolean
  breathing: BreathingState
  formations: Array<{
    id: string
    duration: number
    executionCount: number
    status: 'active' | 'paused'
    nextExecutionTime: number
    isInRecuperation: boolean
    breathingSync: number
  }>
}
```

**Example:**

```javascript
// Get metrics for a specific action
const metrics = cyre.getMetrics('health-check')
console.log(
  `Health check executions: ${metrics.formations[0]?.executionCount || 0}`
)
console.log(
  `Next execution at: ${new Date(
    metrics.formations[0]?.nextExecutionTime
  ).toISOString()}`
)
```

**Gotchas:**

- Returns an empty formations array if the action doesn't exist
- Timestamps are in milliseconds since epoch (Unix time)
- The `breathingSync` value shows how the action is affected by system stress

---

### `cyre.middleware(id, fn)`

Registers a middleware function that can modify actions and payloads before execution.

**Parameters:**

- `id`: String unique identifier for the middleware
- `fn`: Function that processes actions and payloads

**Returns:**

```typescript
{
  ok: boolean
  message: string
  payload: null
}
```

**Middleware Function Signature:**

```typescript
async (action: IO, payload: ActionPayload): Promise<{action: IO; payload: ActionPayload} | null>
```

**Example:**

```javascript
// Register validation middleware
cyre.middleware('validation', async (action, payload) => {
  if (!payload || !payload.isValid) {
    // Return null to reject the action
    return null
  }

  // Return modified action and payload
  return {
    action,
    payload: {...payload, validated: true, timestamp: Date.now()}
  }
})

// Apply middleware to an action
cyre.action({
  id: 'protected-action',
  middleware: ['validation']
})
```

**Gotchas:**

- Middleware functions must be async or return a Promise
- Return null to reject the action entirely
- Return {action, payload} to allow execution with possibly modified values
- Middleware is executed in the order specified in the action's middleware array
- A single middleware can be applied to multiple actions

---

### `cyre.getHistory(actionId?)` and `cyre.clearHistory(actionId?)`

Retrieves or clears execution history for actions.

**Parameters:**

- `actionId`: Optional string action ID - if omitted, applies to all actions

**Returns for getHistory:**

```typescript
Array<{
  actionId: string
  timestamp: number
  payload: any
  result: {
    ok: boolean
    message?: string
    error?: string
  }
  duration?: number
}>
```

**Returns for clearHistory:** void

**Example:**

```javascript
// Get history for a specific action
const actionHistory = cyre.getHistory('user-login')
console.log(`Login attempts: ${actionHistory.length}`)
console.log('Last login attempt:', actionHistory[0])

// Clear history for a specific action
cyre.clearHistory('user-login')

// Clear all history
cyre.clearHistory()
```

**Gotchas:**

- History records are stored in newest-first order
- History storage has limits to prevent memory issues
- If no history exists for an action, an empty array is returned

---

## Hook API Methods

### `useCyre(options)`

Creates a Cyre channel with enhanced capabilities for component integration.

**Parameters:**

- `options`: Configuration options for the channel

**Options Properties:**

```typescript
{
  name?: string;            // Friendly name identifier (for debugging)
  tag?: string;             // Alternative name for backwards compatibility
  autoInit?: boolean;       // Auto-initialize the channel action (default: true)
  debug?: boolean;          // Enable debug logging for channel operations
  protection?: {
    throttle?: number;      // Throttle time in milliseconds
    debounce?: number;      // Debounce time in milliseconds
    detectChanges?: boolean;// Only execute when payload changes
  };
  priority?: {              // Set priority level for operations
    level: 'critical' | 'high' | 'medium' | 'low' | 'background'
  };
  initialPayload?: any;     // Initialize with specified payload
  historyLimit?: number;    // Maximum number of history entries to keep
}
```

**Returns:** Channel object with methods for interacting with Cyre

**Example:**

```javascript
import {useCyre} from 'cyre'

function UserComponent() {
  // Create channel
  const userChannel = useCyre({
    name: 'user',
    protection: {
      debounce: 300,
      detectChanges: true
    }
  })

  // Subscribe to events
  React.useEffect(() => {
    const subscription = userChannel.on(userData => {
      console.log('User data updated:', userData)
    })

    // Clean up on unmount
    return () => subscription.unsubscribe()
  }, [])

  // Call the channel
  const handleUpdate = () => {
    userChannel.call({id: 123, name: 'John'})
  }

  return <button onClick={handleUpdate}>Update User</button>
}
```

**Gotchas:**

- Generates a unique ID for each channel instance
- Always use the `unsubscribe` function in cleanup code to prevent memory leaks
- Hooks are primarily designed for component-based architectures

---

### `cyreCompose(channels, options)`

Composes multiple channels into a single channel for coordinated operations.

**Parameters:**

- `channels`: Array of channel objects created with useCyre
- `options`: Optional configuration for the composed channel

**Options Properties:**

```typescript
{
  id?: string;              // Custom ID for composed channels
  continueOnError?: boolean;// Whether to continue on error
}
```

**Returns:** Composed channel object with methods for interacting with all channels

**Example:**

```javascript
import {useCyre, cyreCompose} from 'cyre'

function ComposeExample() {
  // Create individual channels
  const userChannel = useCyre({name: 'user'})
  const logChannel = useCyre({name: 'log'})
  const notifyChannel = useCyre({name: 'notify'})

  // Compose them into a single channel
  const combinedChannel = cyreCompose(
    [userChannel, logChannel, notifyChannel],
    {continueOnError: true}
  )

  // Call all channels at once
  const handleAction = () => {
    combinedChannel.call({action: 'save', data: userData})
  }

  return <button onClick={handleAction}>Save & Log & Notify</button>
}
```

**Gotchas:**

- By default, the chain stops on the first error
- Use `continueOnError: true` to execute all channels regardless of errors
- The same payload is passed to all channels unless middleware modifies it

---

### `createStream(id)`

Creates a new reactive stream with transformation capabilities.

**Parameters:**

- `id`: String unique identifier for the stream

**Returns:** Stream object with reactive methods

**Example:**

```javascript
import {createStream} from 'cyre'

// Create a stream
const dataStream = createStream('data-processing')

// Add transformations
const processedStream = dataStream
  .map(data => enrichData(data))
  .filter(data => data.isValid)
  .debounce(300)

// Subscribe to results
processedStream.subscribe(result => {
  console.log('Processed data:', result)
})

// Push values to the stream
dataStream.next({id: 123, value: 'test'})
```

**Gotchas:**

- Streams are built on top of Cyre's core functionality
- Stream operators return new streams, allowing for composition
- Remember to complete streams when done to prevent memory leaks

---

## Protection Mechanisms Explained

### Throttle

The throttle mechanism limits the rate of execution to at most one call per specified interval.

**Key behavior:**

- First call always executes (industry standard)
- Subsequent calls within the throttle interval are rejected
- The throttle interval starts from the last successful execution

**Use when:**

- Limiting API call frequency
- Preventing UI flooding from rapid user actions
- Controlling resource-intensive operations

### Debounce

The debounce mechanism collapses multiple calls within a specified time window into a single execution.

**Key behavior:**

- All calls start/reset a timer for the specified interval
- Only executes after the timer completes without new calls
- Always uses the most recent payload

**Use when:**

- Handling rapid UI events like typing, scrolling, or resizing
- Collapsing bursts of similar events
- Reducing processing of high-frequency events

### Change Detection

The change detection mechanism prevents execution when the payload hasn't changed from the previous execution.

**Key behavior:**

- Compares current payload with previous payload using deep comparison
- Skips execution if payloads are identical
- Stores the previous payload for comparison

**Use when:**

- Preventing redundant state updates
- Optimizing render cycles
- Reducing network traffic for unchanged data

### Protection Order

When multiple protection mechanisms are applied to an action, they are processed in this order:

1. System recuperation check (blocks non-critical actions)
2. Repeat: 0 check (prevents any execution)
3. Throttle check
4. Debounce application
5. Change detection check

This means, for example, that if an action is both throttled and has change detection enabled, the throttle is checked first, and change detection is only applied if the throttle allows execution.

## Middleware Execution Flow

Middleware provides a powerful way to transform, validate, or reject actions before they reach handlers.

**Execution sequence:**

1. Call to an action with middleware
2. Protection mechanisms applied (throttle, debounce, etc.)
3. If not blocked by protection, middleware chain begins
4. Each middleware function executes in sequence
5. If any middleware returns null, the action is rejected
6. Otherwise, the (potentially modified) action and payload flow to the next middleware
7. After all middleware completes, the action is dispatched to handlers

**Middleware capabilities:**

- Transform payloads (adding fields, formatting data)
- Validate data (rejecting invalid payloads)
- Log or monitor activity
- Apply cross-cutting concerns (authentication, permissions)
- Modify action properties

## Conclusion

CYRE provides a comprehensive API for managing reactive events with built-in protection mechanisms. The most important consideration when using CYRE is understanding that subscription is based on action IDs, not types, and that interval-based actions form a queue rather than executing in parallel.

By leveraging the various protection mechanisms like debounce, throttle, and change detection, you can create robust and efficient event-driven applications that automatically adapt to system load. The addition of hooks, middleware, and streams in v4.0.0 provides even more powerful tools for building reactive systems.
