# CYRE API Reference

## Overview

CYRE is a sophisticated event management system that provides reactive networking with automatic protection mechanisms. This document details all available methods in the CYRE API.

## Core Methods

### `cyre.initialize()`

Initializes the CYRE system with default settings and activates the quantum breathing system.

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
  repeat?: number|boolean;  // Optional: Number of repeats or true for infinite
  throttle?: number;        // Optional: Minimum milliseconds between executions
  debounce?: number;        // Optional: Delay before execution, resets on new calls
  detectChanges?: boolean;  // Optional: Only execute when payload changes
  log?: boolean;            // Optional: Enable logging for this action
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

// Register an interval action
cyre.action({
  id: 'health-check',
  interval: 30000, // 30 seconds
  repeat: true, // Repeat indefinitely
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

---

### `cyre.on(type, handler)`

Subscribes to actions by ID (not type) and registers a handler function.

**Parameters:**

- `type`: String action ID or array of subscriber objects
- `handler`: Function to execute when the action is called

**Returns:**

```typescript
{
  ok: boolean
  message: string
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
```

**Gotchas:**

- The MOST CRITICAL gotcha: Subscribe to the action ID, not the type!
- Handler functions can return an object with `id` and `payload` to chain actions
- If using an array, each object must have both `id` and `fn` properties

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

### `cyre.getPrevious(id)`

Retrieves the most recent payload used for the specified action.

**Parameters:**

- `id`: String action ID

**Returns:** The previous payload or undefined if none exists

**Example:**

```javascript
// Get the previous payload
const prevPayload = cyre.getPrevious('user-data')
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

Retrieves the current state of the quantum breathing system.

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

## Conclusion

CYRE provides a comprehensive API for managing reactive events with built-in protection mechanisms. The most important consideration when using CYRE is understanding that subscription is based on action IDs, not types, and that interval-based actions form a queue rather than executing in parallel.

By leveraging the various protection mechanisms like debounce, throttle, and change detection, you can create robust and efficient event-driven applications that automatically adapt to system load.
