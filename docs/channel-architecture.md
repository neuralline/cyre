# CYRE Channel Architecture Guide

## Understanding CYRE's Channel-Based Model

CYRE uses a **channel-based communication architecture** rather than the traditional event-type model used by most other event systems. This is a fundamental design choice that enables CYRE's advanced protection features and horizontal scalability.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               CYRE CHANNEL                                    │
│                                                                              │
│  ┌──────────┐       ┌───────────────────────┐        ┌───────────────────┐   │
│  │          │       │  Protection Layers    │        │                   │   │
│  │ .action  │───────►  • Throttle           ├────────► .on Handler       │   │
│  │          │       │  • Debounce           │        │                   │   │
│  └──────────┘       │  • Change Detection   │        └─────────┬─────────┘   │
│       ▲             │  • Circuit Breaker    │                  │             │
│       │             └───────────────────────┘                  │             │
│       │                                                        │             │
│       │             ┌───────────────────────┐                  │             │
│       └─────────────┤        .call          │◄─────────────────┘             │
│                     └───────────────────────┘                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

## How CYRE Channels Work

In CYRE, the **channel ID** is the central concept that connects all operations:

1. **Channel Creation** - A channel is established with `.action()`
2. **Sending TO Channel** - Messages are sent to the channel with `.call()`
3. **Receiving FROM Channel** - Handlers subscribe to the channel with `.on()`

Each channel has its own:

- Protection mechanisms (throttle, debounce, change detection)
- State tracking
- Middleware processing pipeline
- Execution queue

## Difference from Traditional Event Systems

| Traditional Event Systems          | CYRE Channel System                      |
| ---------------------------------- | ---------------------------------------- |
| Subscribe to event **types**       | Subscribe to channel **IDs**             |
| Multiple handlers for same type    | One handler per channel ID (recommended) |
| Type-based filtering               | Channel-based routing                    |
| `emitter.on('eventType', handler)` | `cyre.on('channelId', handler)`          |

## Code Example: Creating and Using Channels

```typescript
// 1. CREATE CHANNEL: Define a user update channel with protection
cyre.action({
  id: 'user-profile-update', // Channel ID - the key identifier
  type: 'user', // Optional grouping category
  payload: {initial: true}, // Initial payload state
  throttle: 500, // Protection: max 1 call per 500ms
  debounce: 200, // Protection: collapse rapid calls
  detectChanges: true // Protection: only process if payload changed
})

// 2. SUBSCRIBE FROM CHANNEL: Set up a handler to process channel data
cyre.on('user-profile-update', payload => {
  // This handler ONLY receives messages from the 'user-profile-update' channel
  console.log('Processing user update:', payload)
  return {success: true}
})

// 3. SEND TO CHANNEL: Send data to the channel
cyre.call('user-profile-update', {
  userId: 123,
  name: 'Alex Chen',
  department: 'Engineering'
})
```

## Common Mistakes to Avoid

### ❌ Incorrect: Subscribing to Type Instead of ID

```typescript
// WRONG - This won't work!
cyre.action({id: 'user-update', type: 'user'})
cyre.on('user', payload => {
  /* Never called */
})
```

### ✅ Correct: Subscribe to the Channel ID

```typescript
// CORRECT
cyre.action({id: 'user-update', type: 'user'})
cyre.on('user-update', payload => {
  /* Works properly */
})
```

## Advanced Channel Concepts

### Multiple Subscribers to One Channel

While possible, it's generally recommended to have just one subscriber per channel to maintain a clear flow and avoid side effects:

```typescript
// Both handlers will receive messages from this channel
cyre.on('metrics-update', logger)
cyre.on('metrics-update', dashboard) // Works but may have side effects
```

### Channel Groups with Type

The `type` property allows logical grouping of related channels:

```typescript
// Channels grouped by 'user' type
cyre.action({id: 'user-create', type: 'user'})
cyre.action({id: 'user-update', type: 'user'})
cyre.action({id: 'user-delete', type: 'user'})

// Channels grouped by 'invoice' type
cyre.action({id: 'invoice-create', type: 'invoice'})
cyre.action({id: 'invoice-finalize', type: 'invoice'})
```

### Channel Chaining

Channels can create chains by returning the next channel ID:

```typescript
cyre.on('validate-user', userData => {
  const isValid = validateUser(userData)

  // Chain to the next appropriate channel
  return {
    id: isValid ? 'process-valid-user' : 'handle-invalid-user',
    payload: {...userData, validated: true, valid: isValid}
  }
})
```

## Why Choose Channel-Based Architecture?

CYRE's channel architecture offers several advantages:

1. **Isolation**: Each channel operates independently, preventing cascade failures
2. **Protection**: Fine-grained control over throttling and debouncing per channel
3. **Clarity**: Clear mapping of which handlers process which data
4. **Horizontal Scaling**: Add more channels as your system grows, without increased complexity
5. **Predictability**: Each channel's behavior is self-contained and deterministic
6. **Performance**: Optimized handling of rate-limiting and system stress

## Best Practices

1. **Descriptive Channel IDs**: Use clear, specific IDs like `invoice-process-payment` rather than generic ones like `process`

2. **One Handler Per Channel**: Maintain a 1:1 relationship between channels and handlers when possible

3. **Group Related Channels**: Use the `type` property to organize related channels

4. **Use Factory Functions**: Create helper functions that set up both the action and handler together:

```typescript
// Factory function for creating complete channels
const createChannel = (id, options, handler) => {
  cyre.action({id, ...options})
  return cyre.on(id, handler)
}

// Usage
createChannel('user-login', {type: 'auth', debounce: 300}, credentials =>
  authenticateUser(credentials)
)
```

5. **Document Channel Relationships**: When building complex systems, diagram channel relationships and chains

## Summary

CYRE's channel-based architecture is a deliberate design choice that prioritizes reliability, protection, and horizontal scaling over the more common type-based event systems. By understanding the channel model, you can fully leverage CYRE's powerful features for building robust, 24/7 systems.

When working with CYRE, remember: **the ID is the channel**, and you always subscribe to the channel with `.on(ID)`, not the type.
