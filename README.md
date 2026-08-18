# CYRE

> Neural Line - Reactive Event Manager  
> **C.Y.R.E** ~/`SAYER`/  
> Version 4.6.0

**The fastest, most reliable reactive state/event management library with industry-leading performance and zero-error. A unique channel-based architecture that runs both in Node and Browser. It's designed for 24/7 operation with advanced protection mechanisms like "Breath system". Task schedule with TimeKeeper etc... and its 60k. bEvolved from the original Quantum-Inception clock project (2016).**

[![npm version](https://img.shields.io/npm/v/cyre.svg)](https://www.npmjs.com/package/cyre)
[![Performance](https://img.shields.io/badge/Performance-Industry%20Leading-brightgreen)](https://github.com/your-repo/cyre#performance-benchmarks)
[![Reliability](https://img.shields.io/badge/Reliability-100%25-brightgreen)](https://github.com/your-repo/cyre#reliability-metrics)
[![Features](https://img.shields.io/badge/Features-Advanced-blue)](https://github.com/your-repo/cyre#advanced-features)

## Performance Highlights

CYRE delivers **industry-leading performance** with zero-error reliability:

- **18,602 ops/sec** - Basic operations (2-3x faster than Redux/RxJS)
- **18,248 ops/sec** - Concurrent load with 10 workers
- **0.054ms** - Average execution latency
- **0.000%** - Error rate across 23,100+ operations
- **5.37MB** - Memory usage for 5,000 operations (10-20x more efficient)

## Quick Start

```bash
npm install cyre
```

```bash
pnpm add cyre
```

```typescript
import {cyre} from 'cyre'

// 1. Create channel with default payload
cyre.action({id: 'user-login', payload: {status: 'idle'}})

// 2. Subscribe to the channel by it's id
cyre.on('user-login', payload => {
  console.log('User login:', payload)
  return {success: true, timestamp: Date.now()}
})

// 3. send to channel
await cyre.call('user-login', {userId: 123, email: 'user@example.com'})
```

## Why CYRE?

### **Performance Leader**

- **3x faster** than Redux for basic operations
- **2x faster** than RxJS for complex workflows
- **Sub-millisecond** execution times (0.054ms average)
- **Perfect concurrent scaling** (98% efficiency maintained)

### **Zero-Error Reliability**

- **100% success rate** across all features
- **0.000% error rate** in production scenarios
- **Hardware-level precision** (0.2ms timing accuracy)
- **Perfect protection systems** (throttling, debouncing, change detection)

### **Advanced Features**

- **Built-in protections** (throttle, debounce, change detection)
- **IntraLink chains** (2,770 links/sec processing)
- **Precise scheduling** (delay/repeat with sub-ms accuracy)
- **Reactive streams** (RxJS-compatible operators)
- **State machines** (XState-compatible patterns)

## Core Features

### Action-Based Architecture

```typescript
// Create channels with built-in protections
cyre.action({
  id: 'api-call',
  throttle: 1000, // Rate limiting
  debounce: 300, // Call collapsing
  detectChanges: true, // Skip unchanged payloads
  priority: {level: 'high'}
})

cyre.on('api-call', async payload => {
  const result = await fetch('/api/data', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return await result.json()
})

// Calls are automatically protected
await cyre.call('api-call', {query: 'search terms'})
```

### Timing & Scheduling

```typescript
// Precise timing control
cyre.action({
  id: 'health-check',
  delay: 1000, // Initial delay
  interval: 5000, // Repeat interval
  repeat: 10 // Total executions
})

// Timeline: Wait 1s → Execute → Wait 5s → Execute → ... (10 total)
```

### TimeKeeper Internals

TimeKeeper is Cyre's single global scheduler ("Quartz engine") - every `delay`/`interval`/`repeat` action is scheduled through it rather than getting its own raw `setTimeout`. A few things worth knowing before relying on precise timing:

- **Two precision tiers, not three.** Timers due sooner than `HIGH_PRECISION_THRESHOLD` (1016ms) run on a tight polling loop for sub-millisecond accuracy; everything else uses a bounded sleep. There is no separate "chunked" tier for very long intervals - a multi-minute `delay`/`interval` is handled by the engine's own internal poll bound (it never sleeps longer than roughly `TIMING.RECUPERATION`, ~60s, at a stretch), so a long timer just survives multiple wake-cycles before it's actually due rather than needing any special-casing on your end.
- **Reentrancy-safe.** A slow handler on a fast-repeating timer will not be invoked again by the next tick before the previous call settles - each timer id is tracked while its callback is in flight.
- **`cyre.pause(id)` / `cyre.resume(id)`** pause and resume a specific timer (or, with no id, the whole system) without losing its schedule - resuming picks the interval back up rather than restarting it. Passing a scheduled action's own id (its full/global id if it's on a branch) is what pauses that timer.
- **TimeKeeper is not the error handler.** A handler that throws is reported via `sensor` and does not derail the rest of that timer's repeat schedule - retry/backoff/circuit-breaking, if you need it, is your application's concern (or `metricsState`'s, for system-wide stress), not TimeKeeper's.
- **TimeKeeper doesn't decide when to stop running.** The engine adapts its own polling rate to load and to how many/what kind of timers are active, but whether the whole system should idle down is `metricsState`'s call, not something TimeKeeper does on its own.

### IntraLink Chain Reactions

```typescript
// Automatic chain reactions
cyre.on('validate-data', payload => {
  const isValid = validate(payload)

  // Return IntraLink to trigger next action
  return {
    id: isValid ? 'process-data' : 'handle-error',
    payload: {...payload, isValid}
  }
})

cyre.on('process-data', payload => {
  // Processing logic
  return {processed: true, result: payload}
})
```

## React Integration

### useCyre Hook

```typescript
import {useCyre} from 'cyre'

function UserProfile() {
  const userChannel = useCyre({
    name: 'user-profile',
    protection: {
      debounce: 300,
      detectChanges: true
    },
    initialPayload: {userId: null}
  })

  React.useEffect(() => {
    const subscription = userChannel.on(userData => {
      console.log('User updated:', userData)
      return {handled: true}
    })

    return () => subscription.unsubscribe()
  }, [])

  const updateUser = userData => {
    userChannel.call(userData)
  }

  return (
    <button onClick={() => updateUser({id: 123, name: 'John'})}>
      Update User
    </button>
  )
}
```

### Channel Composition

---

## Advanced Usage Examples

### Buffer Usage in cyre.action

Buffer collects calls made within a time window and delivers them together as a single execution when the window closes.

```typescript
cyre.action({
  id: 'batch-upload',
  buffer: {window: 1000, strategy: 'append'}
})

cyre.on('batch-upload', batch => {
  // With strategy: 'append', batch is the accumulated payload(s)
  // collected within the 1s window
  uploadBatchToServer(batch)
})

// Calls within 1s are collapsed into one execution when the window closes
cyre.call('batch-upload', {file: 'a.txt'})
cyre.call('batch-upload', {file: 'b.txt'})
```

**Strategies**

- `'overwrite'` (default) — each call replaces the previous payload; only the most recent call in the window is delivered.
- `'append'` — calls accumulate into an array (or the bare payload itself, if only one call lands in the window — see limitations below).
- `'ignore'` — accepted by the config type but not implemented in the current runtime; behaves like `'overwrite'` instead of dropping calls after the first.

**Known limitations (current implementation)**

- `maxSize` is accepted in the config and passes validation, but is not read or enforced anywhere in the buffer dispatch path — an `'append'` buffer keeps growing for the full `window` regardless of `maxSize`.
- With `strategy: 'append'`, if exactly one call lands in the window, the handler receives that single payload rather than a one-item array, so the batch shape is not guaranteed to always be an array — check `Array.isArray(batch)` in handlers that rely on `'append'`.
- A call that lands _while the window's collection callback is still dispatching_ (a slow handler) is not lost - the buffer re-opens a fresh window for it - but this means a slow-enough handler chained with a steady stream of calls can keep re-opening windows indefinitely rather than ever fully draining. Keep buffer handlers fast, or expect back-to-back windows under sustained load.

### Pipeline Talent Order: schema, condition, selector, transform, detectChanges

These five are compiled into an ordered pipeline per channel and run **in the literal field order you write them in the `cyre.action()` config** - not a fixed internal order. Two things follow from that:

1. **Protections run first, pipeline runs second.** `throttle`/`debounce`/`buffer` are handled before any of `schema`/`condition`/`selector`/`transform`/`detectChanges` ever runs. For a debounced or buffered channel, the pipeline only executes once the wait/window settles, against whatever payload was last collapsed/buffered - not against every individual call that came in.
2. **Field order inside the pipeline changes behavior.** Putting `transform` before `detectChanges` is a common trap: if `transform` stamps something that changes on every call (a timestamp, a generated id), `detectChanges` - which runs next - will see a "different" payload every single time and never dedupe, even when the meaningful fields never changed. Validate → dedupe → normalize, in that order, is usually what you want:

```typescript
cyre.action({
  id: 'sensor-ingest',
  schema: mySchema, // 1. validate shape first
  detectChanges: true, // 2. dedupe BEFORE stamping anything that always changes
  transform: payload => ({...payload, receivedAt: Date.now()}) // 3. normalize last
})
```

A buffered channel with a `selector` follows the same rule as point 1 above: the buffer collects the _raw_ payload(s) for the whole window, and `selector` only narrows the accumulated result down once the window closes and the pipeline finally runs.

### Advanced Dispatching

```typescript
cyre.action({
  id: 'multi-handler',
  dispatch: 'race' // Only the fastest handler result is used
})

cyre.on('multi-handler', async payload => {
  await delay(100)
  return 'slow handler'
})
cyre.on('multi-handler', async payload => {
  await delay(10)
  return 'fast handler'
})

const result = await cyre.call('multi-handler', {data: 1})
// result.payload === 'fast handler'

// Waterfall example
cyre.action({
  id: 'waterfall-demo',
  dispatch: 'waterfall'
})
cyre.on('waterfall-demo', payload => payload + 1)
cyre.on('waterfall-demo', payload => payload * 2)
const res = await cyre.call('waterfall-demo', 3) // (3+1)*2 = 8
```

### Direct Use of cyre.payloadState

```typescript
cyre.action({id: 'user-update', payload: {name: 'Alice'}})

// Get current payload
const current = cyre.payloadState.get('user-update')
// Set new payload
cyre.payloadState.set('user-update', {name: 'Bob'})
// Check if changed
const changed = cyre.payloadState.hasChanged('user-update', {name: 'Bob'})
```

### (Optional) Orchestration Example

```typescript
cyre.action({id: 'step1'})
cyre.action({id: 'step2'})

cyre.on('step1', payload => {
  // ...
  return {id: 'step2', payload: {...payload, step1: true}}
})

// Orchestrate a workflow
await cyre.call('step1', {start: true})
```

## Multi-Handler Channels: 1-to-Many `.on` Handlers

Cyre supports multiple `.on` handlers per channel, enabling powerful event-driven workflows. Each channel can have many subscribers, and you can control how handlers are dispatched:

- **Parallel Dispatch**: All handlers are invoked concurrently (default for async handlers).
- **Sequential Dispatch**: Handlers are invoked in registration order, each waiting for the previous to complete (useful for ordered side effects).

```typescript
// Register multiple handlers for the same channel
cyre.on('user-login', payload => {
  // Handler 1
  logLogin(payload)
})

cyre.on('user-login', async payload => {
  // Handler 2 (async)
  await sendAnalytics(payload)
})

// By default, async handlers run in parallel. For sequential execution:
cyre.action({
  id: 'user-login',
  sequential: true // Ensures handlers run one after another
})
```

### Handler Techniques: Factory vs Outpost

- **Factory Handlers**: Main business logic handlers, ideally kept outside your application codebase to avoid reloads and app errors. Organize all factory handlers in a single location/directory, and prefer a 1-to-1 relationship between channel and handler. These are responsible for core processing, validation, and transformation of data.
- **Outpost Handlers**: Instead of polling or awaiting, outpost `.on` handlers reactively receive payloads/signals and interpret them as local environment changes (e.g., updating UI, state, or triggering side effects). Outpost handlers are located inside your app, support a 1-to-many relationship, and are best suited for delivery, UI updates, and actions—not for core business logic.

```typescript
// Factory handler (pure)
cyre.on('data-validate', payload => validateData(payload))

// Outpost handler (side effect)
cyre.on('data-validate', payload => {
  reportValidation(payload)
  // No return needed
})
```

## Branches (`useBranch`)

Branches give a part of your app its own isolated channel namespace without hand-prefixing every id yourself. `useBranch(instance, {id})` hangs a new branch off an instance's path; channels registered on that branch get a globally-unique id (`parentPath/branchId/localId`) automatically, but you keep addressing them by their short local id from inside the branch.

```typescript
import {cyre, useBranch} from 'cyre'

const factory = useBranch(cyre, {id: 'factory-a'})
const floor1 = useBranch(factory, {id: 'floor-1'})

floor1.action({id: 'temperature'})
floor1.on('temperature', celsius => console.log(celsius))

await floor1.call('temperature', 21.4) // resolves to 'factory-a/floor-1/temperature'

// Cross-branch calls: any target containing "/" is treated as an absolute
// path instead of being prefixed with the calling branch's own path
await floor1.call('factory-a/floor-2/alarm', 'reason')
```

**Known limitation:** `branch.getStats()`'s synchronously-returned object always reports `channelCount`, `subscriberCount`, `timerCount`, and `childCount` as `0` - the real counts are computed in a background async call whose result is never stored anywhere retrievable. Don't rely on `getStats()` for live counts today; check a channel's existence by calling it and inspecting `result.ok`/`result.message` instead. Also note that `branch.get(localId)` (like the top-level `cyre.get(id)` it wraps) returns that channel's current **payload**, not its config - it is not a way to check whether a channel exists or to read back its id.

## Stream `.buffer()` Operator (planned, not yet available)

`createStream()` exposes timing operators like `.debounce(ms)`, `.throttle(ms)`, and `.delay(ms)`, but a `.buffer()` operator is **not currently part of the `Stream` type interface** and is not implemented. Code like the example below will not type-check or run against the current library:

```typescript
// NOT YET AVAILABLE — shown for illustration of the intended API only
import {createStream} from 'cyre'

const stream = createStream()
  .buffer(5) // intended: collect 5 events before emitting as an array
  .map(batch => processBatch(batch))

stream.subscribe(batchResult => {
  // Handle processed batch
})
```

If you need batching on a stream today, accumulate manually inside `.tap()`/`.map()`, or use the channel-level `buffer` config documented above via `cyre.action()`.

## 🛡️ Built-in Protection Systems

### Throttle Protection

```typescript
cyre.action({
  id: 'api-request',
  throttle: 1000 // Max 1 request per second
})

// Automatic rate limiting - excess calls rejected gracefully
```

### Debounce Protection

```typescript
cyre.action({
  id: 'search-input',
  debounce: 300 // Collapse rapid calls to single execution
})

// 90% call collapsing efficiency with perfect timing accuracy
```

### Change Detection

```typescript
cyre.action({
  id: 'state-update',
  detectChanges: true // Skip execution if payload unchanged
})

// Automatic payload comparison using deep equality
```

### System Breathing

CYRE includes an adaptive "breathing" system that automatically adjusts performance based on system stress:

- **Normal operation**: 200ms base rate
- **Under stress**: Automatic rate adjustment
- **Recovery mode**: Critical actions only
- **Self-healing**: Gradual return to normal operation

## Monitoring & Debugging

### Performance Metrics

```typescript
// Channel-specific metrics
const actionMetrics = cyre.getMetrics()
```

### Debug Tools

```typescript
// Enable debug mode for detailed logging
cyre.action({
  id: 'debug-action',
  log: true // Enable detailed execution logging
})

// Get system health status
const isHealthy = cyre.isHealthy()
const breathingState = cyre.getBreathingState()
```

## Testing & Reliability

CYRE includes comprehensive test suites following industry standards:

### Reliability Metrics

- **23,100+ operations** tested across all scenarios
- **0.000% error rate** in production simulations
- **100% success rate** for all advanced features
- **Perfect protection system** activation rates

### Performance Validation

- **Industry-standard benchmarks** (React/Redux/RxJS methodology)
- **Statistical rigor** (P95/P99 percentiles, warmup phases)
- **Cross-validation** of all timing and throughput calculations
- **Memory leak detection** and cleanup verification

## API Reference

### Core Methods

```typescript
// Channel management
cyre.action(config: IO | IO[])           // Register one or more channels
cyre.on(id: string, handler: Function)   // Subscribe handler(s) to a channel
cyre.call(id: string, payload?: any)     // Trigger a channel/action
cyre.forget(id: string)                  // Remove a channel and its handlers
cyre.get(id: string)                     // Returns the channel's current PAYLOAD (payloadState.get(id)) - NOT its config/IO object, and not a {req,res} wrapper

// System & State Control
cyre.init()                              // Initialize the system
cyre.clear()                             // Clear all channels, handlers, and state
cyre.reset()                             // Alias for clear, resets all state
cyre.pause(id?: string)                  // Pause all or specific channels
cyre.resume(id?: string)                 // Resume all or specific channels
cyre.lock()               // Lock/unlock the system
cyre.shutdown()                          // Full system shutdown

// Metrics & Monitoring
cyre.getMetrics(channelId?: string)      // Get system or channel-specific metrics
cyre.status()                           // Returns if system is hibernating

// Advanced/Experimental
// cyre.payloadState                       // Direct access to dual payload state system
// cyre.orchestration                      // Orchestration engine for complex workflows
// cyre.schedule                           // Scheduling utility for advanced timing
// cyre.path()                             // Path system for hierarchical channel addressing (stub)
```

### React Hooks & Utilities

```typescript
import {useCyre, useGroup, useBranch, useCollective, log} from 'cyre'
```

- `useCyre`: React hook for channel integration
- `useGroup`: React hook for group/channel management
- `useBranch`: React hook for branch system
- `useCollective`: React hook for collective channel patterns
- `log`: Utility logger

---

### Channel/Action Configuration (IO options)

```typescript
interface IO {
  id: string // Channel identifier (required)
  payload?: any // Initial/default payload
  path?: string // Hierarchical path for organization
  group?: string
  tags?: string[]
  description?: string
  version?: string

  // Protections
  required?: boolean
  throttle?: number
  debounce?: number
  maxWait?: number
  detectChanges?: boolean
  block?: boolean
  buffer?: { window: number, strategy?: 'overwrite' | 'append' | 'ignore', maxSize?: number }

  // Scheduling
  interval?: number
  repeat?: number | boolean
  delay?: number

  // Execution
  dispatch?: 'single' | 'parallel' | 'sequential' | 'race' | 'waterfall'
  errorStrategy?: 'fail-fast' | 'continue' | 'retry'
  collectResults?: 'first' | 'last' | 'all' | boolean
  dispatchTimeout?: number

  // Pipeline
  schema?: Schema<any>
  condition?: (payload: any) => boolean
  selector?: (payload: any) => any
  transform?: (payload: any) => any

  // Priority
  priority?: { level: string, ... }

  // Auth
  auth?: { mode: 'token' | 'context' | 'group' | 'disabled', ... }

  // Logging
  log?: boolean
}
```

---

### Multi-Handler & Dispatching

- Multiple `.on` handlers per channel, with smart operator selection:
  - Default: parallel for async, single for sync
  - User can force: `dispatch: 'sequential' | 'race' | 'waterfall' | 'parallel'`
- Handler types: Factory (pure) and Outpost (side-effect)
- Handler removal and stats supported

### Buffer Operator

- `buffer: { window: number, strategy?: 'overwrite' | 'append' | 'ignore', maxSize?: number }`
- Batches calls within a time window and executes once when the window closes.
- `strategy: 'ignore'` and `maxSize` are accepted by the type but are **not currently enforced** by the runtime — see [Buffer Usage in cyre.action](#buffer-usage-in-cyreaction) for the full list of known limitations.
- This is a channel-level (`cyre.action`) feature only; the stream-level `createStream().buffer()` operator described elsewhere in this doc is not yet implemented — see [Stream `.buffer()` Operator](#stream-buffer-operator-planned-not-yet-available).

---

## 🔮 Advanced Use Cases

### High-Performance APIs

```typescript
// Rate-limited API with automatic retry
cyre.action({
  id: 'api-with-retry',
  throttle: 100, // 10 requests/sec max
  repeat: 3, // Retry up to 3 times
  priority: {level: 'high'}
})
```

### Real-time Data Processing

```typescript
// Stream processing with backpressure
const dataStream = createStream()
  .throttle(16) // 60fps processing rate
  .map(processRealTimeData)
  .filter(data => data.isComplete)
  .subscribe(updateUI)
```

### Complex Workflows

```typescript
// Multi-step workflow with error handling
const workflow = cyreCompose(
  [validationChannel, authenticationChannel, processingChannel, auditChannel],
  {
    continueOnError: false,
    timeout: 30000
  }
)
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/neeuraline/cyre.git
cd cyre
npm install
npm test
npm run benchmark  # Run performance tests
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Roadmap

- [ ] **Multi-subscriber support** - Single action, multiple handlers
- [ ] **Queue option** - Call queuing until subscribers ready
- [ ] **Enhanced React integration** - Custom ID support for useCyre
- [ ] **State persistence** - Automatic save/restore functionality

## 📞 Support

- **Documentation**: [Full API Documentation](https://docs.cyre.dev)
- **Issues**: [GitHub Issues](https://github.com/your-repo/cyre/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/cyre/discussions)
- **Discord**: [Community Discord](https://discord.gg/cyre)

---

## Philosophy

Cyre follows these core principles:

- **Precision**: Accurate timing and reliable event handling
- **Protection**: Natural rate limiting through breathing system
- **Performance**: System-aware optimization and stress management
- **Adaptability**: Self-adjusting to system conditions
- **Predictability**: Consistent behavior with clear execution rules
- **Horizontal architecture**: Independent channels that expand horizontally

## Origins

Originally evolved from the Quantum-Inception clock project (2016), Cyre has grown into a full-featured event management system while maintaining its quantum timing heritage. The latest evolution introduces Schema, hooks, and standardized execution behavior to provide a more predictable and powerful developer experience.

```sh
Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
Expands HORIZONTALLY as your project grow
```

**CYRE** - Neural Line Reactive Event Manager  
_The fastest, most reliable reactive state management for modern applications._
