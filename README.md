# CYRE

> Neural Line - Reactive Event Manager
> C.Y.R.E ~/`SAYER`/
> Version 4.6.4

**A zero-dependency, channel-based reactive event manager for Node and the browser. Register a channel with `cyre.action()`, subscribe with `cyre.on()`, trigger it with `cyre.call()`. Built-in protections (throttle, debounce, buffer, schema, change detection), a hand-rolled scheduler ("TimeKeeper") with drift compensation and calendar/cron support, multi-handler dispatch strategies, and a workflow orchestration engine - all with no external dependencies, designed to run 24/7.**

[![npm version](https://img.shields.io/npm/v/cyre.svg)](https://www.npmjs.com/package/cyre)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/neuralline/cyre/blob/main/LICENSE)

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

- **Zero dependencies** - the whole engine, scheduler, schema builder, and orchestration system ship with nothing else pulled in.
- **Compile-once, execute-cheap** - `cyre.action()` pre-computes which protections/talents/scheduling a channel needs at registration time (`_hasFastPath`/`_pipeline`), so a plain channel with no protections skips straight to dispatch with no redundant checks on every call.
- **Built-in protections** - throttle, debounce, buffer, schema validation, condition/selector/transform, and change detection, composable per channel.
- **A real scheduler, not `setTimeout` soup** - TimeKeeper runs every `delay`/`interval`/`repeat` action (and every orchestration `time`/`condition` trigger) through one global, drift-compensated, precision-tiered engine. `cyre.schedule` layers calendar-correct time-of-day/cron/date scheduling with IANA timezone and DST handling on top of that.
- **Multiple dispatch strategies** - a channel with more than one handler can run them `parallel`, `sequential`, `race`, or `waterfall`, each with configurable error handling and result collection.
- **Workflow orchestration** - `cyre.orchestration` chains multiple channels into `action`/`condition`/`parallel`/`sequential`/`loop` steps, driven by time, condition-poll, or channel-subscription triggers.
- **Runs 24/7** - designed to sit in a long-running Node process or browser tab without leaking timers or state; `cyre.shutdown()`/`cyre.reset()` tear everything down cleanly for the cases where you do want to stop it.

### Benchmarking

CYRE ships its own throughput benchmark (`demo/speed-test-demo.ts` in the repo, run via `npm run benchmark` / `bun run benchmark`) covering the fast path, the full compiled pipeline, each dispatch strategy, and throttle/debounce/buffer overhead. Numbers vary meaningfully by JS runtime - a real run comparing Node and Bun on the same machine saw the fast path range from roughly 270k to 700k operations/second depending on runtime and call pattern (sequential vs. concurrent), with `parallel` dispatch consistently the slowest of the four multi-handler strategies on both runtimes. Run the benchmark yourself against your target runtime and hardware rather than relying on a single published number - a microbenchmark on someone else's machine won't reflect your production environment.

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

Note: `throttle` and `debounce` cannot both be set on the same channel - `cyre.action()` rejects that combination at registration time.

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

TimeKeeper is Cyre's single global scheduler ("Quartz engine") - every `delay`/`interval`/`repeat` action, every `cyre.schedule` trigger, and every orchestration `time`/`condition` trigger is scheduled through it rather than getting its own raw `setTimeout`. A few things worth knowing before relying on precise timing:

- **Two precision tiers, not three.** Timers due sooner than `HIGH_PRECISION_THRESHOLD` (1016ms) run on a tight polling loop for sub-millisecond accuracy; everything else uses a bounded sleep. There is no separate "chunked" tier for very long intervals - a multi-minute `delay`/`interval` is handled by the engine's own internal poll bound (it never sleeps longer than roughly `TIMING.RECUPERATION`, ~60s, at a stretch), so a long timer just survives multiple wake-cycles before it's actually due rather than needing any special-casing on your end.
- **Reentrancy-safe.** A slow handler on a fast-repeating timer will not be invoked again by the next tick before the previous call settles - each timer id is tracked while its callback is in flight.
- **`cyre.pause(id)` / `cyre.resume(id)`** pause and resume a specific timer (or, with no id, the whole system) without losing its schedule - resuming picks the interval back up rather than restarting it. This works transparently across plain channel timers, `cyre.schedule` tasks, and orchestration triggers - `pause`/`resume` figure out which subsystem owns the id and delegate to it.
- **TimeKeeper is not the error handler.** A handler that throws is reported via `sensor` and does not derail the rest of that timer's repeat schedule - retry/backoff/circuit-breaking, if you need it, is your application's concern (or `metricsState`'s, for system-wide stress), not TimeKeeper's.
- **TimeKeeper doesn't decide when to stop running.** The engine adapts its own polling rate to load and to how many/what kind of timers are active, but whether the whole system should idle down is `metricsState`'s call, not something TimeKeeper does on its own. It also stretches a scheduled channel's own interval slightly under real stress (`scheduleNext()`'s `stressFactor = 1 + stress.combined * 0.1`) - see [Tuning breathing behavior](#tuning-breathing-behavior-cyreinituserconfig) below for how that stress value itself is configured.

### Calendar & Cron Scheduling (`cyre.schedule`)

Beyond a channel's own `delay`/`interval`/`repeat`, `cyre.schedule` gives you calendar-correct scheduling - real cron parsing, IANA timezones with DST handling, one-off calendar dates, and weekday-restricted daily triggers - all recomputed on every fire so a "daily at 09:00" trigger stays locked to 09:00 rather than drifting into a fixed interval based on whatever the first day's delay happened to be.

```typescript
// Fire a channel every day at 09:00 in a given timezone
cyre.schedule.daily('09:00', {
  id: 'morning-digest',
  channels: ['send-digest'],
  timezone: 'America/New_York'
})

// Fire every Monday at 17:00
cyre.schedule.weekly('monday', '17:00', {
  id: 'weekly-report',
  channels: ['generate-report']
})

// One-off run on a specific calendar date
cyre.schedule.onDate('2026-12-25', '00:00', {
  id: 'holiday-banner',
  channels: ['show-banner']
})

// Plain fixed interval/delay, if you don't need calendar semantics
cyre.schedule.interval(30000, {id: 'poll-status', channels: ['check-status']})
cyre.schedule.once(5000, {id: 'startup-check', channels: ['verify-config']})

// Management
cyre.schedule.pause('morning-digest')
cyre.schedule.resume('morning-digest')
cyre.schedule.cancel('morning-digest')
cyre.schedule.list() // all scheduled tasks, optionally filtered
cyre.schedule.get('morning-digest') // a single task's definition
```

A trigger can also run a custom function or trigger a full orchestration (`orchestration: 'my-workflow'`) instead of (or alongside) calling channels directly - see `schedule.task()` for the full trigger shape if you need more than the quick-schedule helpers above.

### IntraLink Chain Reactions

A handler can trigger the next step in a chain just by returning `{id, payload}` - no explicit `cyre.call()` needed from inside the handler.

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

IntraLink only chains to a channel `id` that's actually registered - a handler returning `{id: 'not-a-real-channel'}` is treated as an ordinary return value, not a chain signal. Chains are also depth-limited (10 hops) to catch an accidental cycle rather than looping forever; the response's `metadata.intraLink`/`metadata.chainResult` fields let you inspect what a chain actually did.

## React Integration

### useCyre Hook

`useCyre` isn't React-specific - it's a plain factory function that wraps `cyre.action`/`cyre.on`/`cyre.call`/`cyre.get`/`cyre.forget` for one channel, on either the root `cyre` instance or a branch. It's commonly used from inside a React component, as below, but works the same way in any JS environment.

```typescript
import {useCyre} from 'cyre'

function UserProfile() {
  const userChannel = useCyre(cyre, {
    id: 'user-profile',
    debounce: 300,
    detectChanges: true,
    payload: {userId: null}
  })

  React.useEffect(() => {
    const subscription = userChannel.on(userData => {
      console.log('User updated:', userData)
      return {handled: true}
    })

    return () => subscription.unsubscribe?.()
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

A channel with more than one `.on` handler picks its dispatch strategy via `dispatch`. Five strategies exist - `single` is automatic for a channel with exactly one handler (and can't meaningfully be forced onto a multi-handler channel), the other four are for multi-handler channels:

- `'parallel'` (default for 2+ handlers) — all handlers run concurrently; the result is collected per `collectResults` (`'first' | 'last' | 'all'`).
- `'sequential'` — handlers run one after another, each independent of the others' return values.
- `'race'` — the first handler to settle wins; the rest are left to resolve on their own.
- `'waterfall'` — each handler's return value becomes the next handler's input, chaining them together.

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

**Error handling across strategies.** `errorStrategy` controls what happens when a handler throws: `'fail-fast'` stops immediately and the whole call fails; `'continue'` (the default for `parallel`/`sequential`) keeps going through the remaining handlers and reports a partial result. All four multi-handler strategies (including `waterfall`, as of the current implementation) track this consistently - the response's `message` reports `"X/Y handlers succeeded"` when some failed, `metadata.failedHandlers`/`metadata.successfulHandlers` give you the exact counts, and `ok` is `true` only when at least one handler succeeded (or `errorStrategy` is `'continue'`).

```typescript
cyre.action({
  id: 'notify-all',
  dispatch: 'parallel',
  errorStrategy: 'continue' // don't let one failing handler sink the rest
})
cyre.on('notify-all', () => sendEmail())
cyre.on('notify-all', () => sendSms()) // might throw - the email still sends
```

### Reading channel state with `cyre.get()`

`cyre.get(id)` returns the channel's full request/response record - `{req, res, prevReq, metadata}` - not just the raw payload and not the channel's config/`IO` object:

```typescript
cyre.action({id: 'user-update', payload: {name: 'Alice'}})
cyre.on('user-update', payload => ({...payload, saved: true}))

await cyre.call('user-update', {name: 'Bob'})

const state = cyre.get('user-update')
state.req // {name: 'Bob'} - the payload most recently sent to this channel
state.res // the full CyreResponse the handler returned
state.prevReq // {name: 'Alice'} - the request before that one
state.metadata // {requestCount, responseCount, status, lastRequestTime, ...}

// Related helpers on the cyre instance itself:
cyre.hasChanged('user-update', {name: 'Bob'}) // shallow-compares against .req
cyre.getPrevious('user-update') // same as state.prevReq above
```

There's no `cyre.set()` - a channel's payload only changes through `cyre.call()` (or its `payload` at registration time).

### Orchestration: chaining multiple channels into a workflow

`cyre.orchestration` runs a workflow of steps across multiple channels, either on demand (`.call()`) or driven by a trigger (`time`, `condition`, or `channel`).

```typescript
cyre.action({id: 'validate'})
cyre.action({id: 'rollback-db', delay: 30})
cyre.action({id: 'rollback-cache', delay: 30})
cyre.action({id: 'notify'})
cyre.on('validate', payload => ({ok: true}))
cyre.on('rollback-db', () => ({done: 'db'}))
cyre.on('rollback-cache', () => ({done: 'cache'}))
cyre.on('notify', () => ({sent: true}))

cyre.orchestration.keep({
  id: 'incident-response',
  // triggers: [] runs only via .call(); or drive it automatically:
  // [{name: 'poll', type: 'condition', condition: () => isIncident(), interval: 1000}]
  // [{name: 'tick', type: 'time', interval: 60000}]
  // [{name: 'on-alert', type: 'channel', channels: 'alert-raised'}]
  triggers: [],
  workflow: [
    {name: 'validate', type: 'action', targets: 'validate'},
    {
      name: 'rollback',
      type: 'sequential', // waits for each target's own delay/interval too,
      steps: [
        // not just the moment the call is scheduled
        {name: 'db', type: 'action', targets: 'rollback-db'},
        {name: 'cache', type: 'action', targets: 'rollback-cache'}
      ]
    },
    {name: 'notify', type: 'action', targets: 'notify'}
  ]
})

await cyre.orchestration.call('incident-response')

// If you gave it a trigger, turn it on/off:
cyre.orchestration.activate('incident-response', true)
cyre.orchestration.activate('incident-response', false)

// Introspection & teardown
cyre.orchestration.getStatus('incident-response')
cyre.orchestration.list()
cyre.orchestration.getSystemOverview()
cyre.orchestration.forget('incident-response')
```

Step types: `action` (call one or more `targets`), `condition` (a predicate; `onError: 'abort'` stops the workflow), `parallel`/`sequential`/`loop` (each takes nested `steps`, not `targets`). A `loop` step's `iterations` defaults to 3 if omitted, and is configurable per step. `cyre.orchestration.keep()` is subject to `cyre.lock()` the same way `cyre.action()`/`cyre.on()` are - register every orchestration before locking the system.

### Multi-participant coordination with `useCollective`

`useCollective` isn't a channel-pair wrapper like `useCyre` - it's a standalone coordination primitive for multiple participants sharing state, voting, and having work distributed among them. It's a plain function, not a React hook.

```typescript
import {useCollective} from 'cyre'

const room = useCollective('design-review', {
  conflictResolution: 'merge',
  consensus: 'majority'
})

await room.join('alice')
await room.join('bob')
await room.join('carol')

await room.broadcast({type: 'reviewer-assigned', reviewer: 'alice'})
await room.updateSharedState('status', 'in-review')

const {data} = await room.propose({approve: true})
await room.vote(data.proposalId, 'yes', 'alice')
await room.vote(data.proposalId, 'yes', 'bob')
const consensus = await room.getConsensus(data.proposalId)
// consensus.consensus.achieved === true once quorum + majority is reached

await room.distributeWork([{task: 'review-pr-1'}, {task: 'review-pr-2'}])

room.getMetrics() // totalCalls, activeParticipants, messagesExchanged, ...
room.getHealth() // {status: 'healthy' | 'degraded', issues: [...]}
await room.destroy() // tears down the collective's own coordination channel
```

Two things worth knowing: `getMetrics().totalCalls` only increments through `room.call()` specifically - `broadcast`/`vote`/`distributeWork`/`propose` all represent real collective activity but don't add to that counter, so don't rely on it as a total-activity figure. And `destroy()` only removes the collective's own coordination channel, not each joined participant's individual channel - call `leave()` for remaining participants first if you want a fully clean teardown.

### Tuning breathing behavior (`cyre.init(userConfig)`)

`cyre.init()` takes an optional config object that tunes the breathing/recuperation system described in [System Breathing](#system-breathing) below - how aggressively Cyre reacts to CPU/memory/event-loop/call-rate pressure, and how it paces its own internal timer polling under stress. Everything is optional and merges over sensible defaults; out-of-range values are clamped into range with a `sensor.warn`, not silently accepted or thrown.

```typescript
await cyre.init({
  breathing: {
    // How much the internal timer poll rate is stretched under stress
    rates: {
      min: 50, // fastest allowed polling rate, ms
      base: 200, // normal/idle polling rate, ms
      max: 2000, // slowest allowed polling rate under heavy stress, ms
      recovery: 1000 // polling rate while actively recuperating, ms
    },
    // Combined-stress thresholds (0-1) that classify system load
    stress: {
      low: 0.3,
      medium: 0.5,
      high: 0.7, // above this, non-critical calls start getting rejected
      critical: 0.9 // above this, the system enters recuperation
    },
    // What "100% stress" means for each real resource being sampled
    limits: {
      maxCpu: 0.8, // process.cpuUsage()-derived
      maxMemory: 0.85, // heapUsed / heapTotal
      maxEventLoop: 50, // ms of setTimeout(fn, 0) round-trip lag
      maxCallRate: 1000 // calls/sec, from the real call-rate tracker
    }
  },
  timing: {
    recuperation: 30000 // how long (ms) a recuperation cycle lasts once triggered
  }
})
```

While the system is recuperating (combined stress above `stress.critical`), `cyre.call()` rejects any call whose channel isn't `priority: {level: 'critical'}` - this gate (`metricsState.canCall()`) runs before a channel's own `throttle`/`debounce`/`buffer` config is ever consulted, so lowering `stress.critical` or widening the gap between `high` and `critical` is currently the main way to make recuperation less aggressive for a specific deployment. Note that breathing/recuperation state is global to the process, not per-channel - a single overloaded channel's stress affects every other channel's `canCall()` check equally.

## Multi-Handler Channels: 1-to-Many `.on` Handlers

Cyre supports multiple `.on` handlers per channel, enabling powerful event-driven workflows. Each channel can have many subscribers, and you can control how handlers are dispatched (see [Advanced Dispatching](#advanced-dispatching) above for the full list of strategies and error-handling options).

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

// Default for 2+ handlers is parallel. For sequential execution:
cyre.action({
  id: 'user-login',
  dispatch: 'sequential' // Ensures handlers run one after another
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

### Unsubscribing a specific handler

`cyre.on()`'s return value includes an `unsubscribe()` function bound to that exact handler - it removes only that one subscription, not the whole channel (which is what `cyre.forget()` is for).

```typescript
const handler = payload => console.log(payload)
const subscription = cyre.on('user-login', handler)

// later, remove just this handler - other handlers on the channel keep running
subscription.unsubscribe?.()
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

**Known limitation:** `branch.getStats()`'s synchronously-returned object always reports `channelCount`, `subscriberCount`, `timerCount`, and `childCount` as `0` - the real counts are computed in a background async call whose result is never stored anywhere retrievable. Don't rely on `getStats()` for live counts today; check a channel's existence by calling it and inspecting `result.ok`/`result.message` instead. Also note that `branch.get(localId)` (like the top-level `cyre.get(id)` it wraps) returns that channel's `{req, res, prevReq, metadata}` state record, not its config - it is not a way to check whether a channel exists.

## Streams (`createStream`) - on hold, not part of the public API

RxJS-style streams are **not currently usable** - `createStream` is not exported from `cyre`'s package entry point at all (`src/index.ts` only exports `cyre`, `useCyre`, `useGroup`, `useBranch`, `useCollective`, and `sensor`/`log`). `import {createStream} from 'cyre'` fails outright; it isn't a case of one missing operator. Only the `Stream<T>` _type_ definitions exist in the source (`src/types/stream.ts` - `map`/`filter`/`debounce`/`throttle`/`merge`/`zip`/`switchMap`/etc. are all specified there), with no corresponding implementation file and no `buffer()` operator even in the type. The library's own internal TODO list marks `cyre/stream` explicitly `[on hold] experimental/testing stage`, alongside `cyre/ssr`, `state-machine`, and `cyre/server` - none of which are shipped either.

If you need reactive-stream-style composition today, reach for `dispatch: 'waterfall'` handler chains (see [Advanced Dispatching](#advanced-dispatching)) or an external library like RxJS alongside Cyre's own channels, or use the channel-level `buffer` config documented above via `cyre.action()` for batching specifically.

## 🛡️ Built-in Protection Systems

### Throttle Protection

```typescript
cyre.action({
  id: 'api-request',
  throttle: 1000 // Max 1 request per second
})

// Excess calls within the window are rejected with a "throttled" message,
// including a burst of concurrent, un-awaited calls - the throttle slot is
// reserved synchronously the instant a call passes the gate, closing what
// used to be a race between concurrent callers.
```

### Debounce Protection

```typescript
cyre.action({
  id: 'search-input',
  debounce: 300 // Collapse rapid calls to single execution
})

// Every call within the window shares one real result: cyre.call() on a
// debounced channel resolves once the window actually settles and the
// handler runs, not immediately with a "scheduled" acknowledgment.
```

### Change Detection

```typescript
cyre.action({
  id: 'state-update',
  detectChanges: true // Skip execution if payload unchanged
})

// Shallow-equality comparison against the channel's previous request payload
```

### System Breathing

CYRE includes an adaptive "breathing" system that automatically adjusts its internal timer polling rate based on system stress, and gates non-critical calls during recuperation. Stress is a combined 0-1 score derived from real `process.cpuUsage()` deltas, heap usage, event-loop lag, and measured call rate (sampled once per second, not per-call). `cyre.getMetrics().system.breathing`/`.stress` expose the current state. See [Tuning breathing behavior](#tuning-breathing-behavior-cyreinituserconfig) above for the full `cyre.init(userConfig)` shape that controls the thresholds and polling rates behind this.

## Monitoring & Debugging

### Performance Metrics

```typescript
// System-wide metrics
const metrics = cyre.getMetrics()
// metrics.system.stress / .breathing / .health
// metrics.stores.channels, etc.

// Channel-specific metrics
const channelMetrics = cyre.getMetrics('api-call')
// channelMetrics.executionCount, .available, ...
```

### Debug Tools

```typescript
// Enable debug mode for detailed logging
cyre.action({
  id: 'debug-action',
  log: true // Enable detailed execution logging
})

// System status
const isHibernating = cyre.status() // true while the system is hibernating
const metrics = cyre.getMetrics() // includes system.health / .breathing / .stress
```

### useMetrics - watch metrics instead of polling

`cyre.getMetrics()` is a one-off snapshot. `useMetrics` schedules the
polling as a real Cyre channel (interval + repeat) so it inherits the same
breathing/stress regulation as everything else, instead of a bare
`setInterval` that keeps ticking at full speed while the system is under
load.

```typescript
import {useMetrics} from 'cyre'

const vitals = useMetrics(cyre, {interval: 500})
const stop = vitals.watch(metrics => {
  renderStressGauge(metrics.system.stress)
})

// One-off read any time, no polling required
vitals.get()

// Scoped to a branch's own channel
const hero = useBranch(cyre, {id: 'hero'})
useMetrics(hero, {channelId: 'next-slide'}).watch(console.log)

stop() // or vitals.stop()
```

### useLog - subscribe to the log/error stream

`sensor.error()`/`warn()`/etc previously only ever reached the console -
there was no supported way to react to a log event from code. `useLog`
subscribes to that same stream directly, independent of the console's own
verbosity threshold (`sensor.setLogLevel`).

```typescript
import {useLog, LogLevel} from 'cyre'

// Defaults to LogLevel.ERROR - the same default threshold sensor itself
// prints to console, so this reacts to exactly what "usually ends up on
// console"
const errors = useLog()
const stop = errors.on(event => showToast(event.message))

// Everything from one channel, including DEBUG-level chatter
useLog({level: LogLevel.DEBUG, actionId: 'checkout'}).on(console.log)
```

## API Reference

### Core Methods

```typescript
// Channel management
cyre.action(config: IO | IO[])           // Register one or more channels
cyre.on(id: string, handler: Function)   // Subscribe handler(s) to a channel - result includes unsubscribe()
cyre.call(id: string, payload?: any)     // Trigger a channel/action
cyre.forget(id: string)                  // Remove a channel and every handler on it
cyre.get(id: string)                     // Returns {req, res, prevReq, metadata} - the channel's state record, not its config

// System & State Control
cyre.init(userConfig?: CyreConfig)       // Initialize the system - optionally tunes breathing/timing, see Tuning breathing behavior above
cyre.clear()                             // Clear all channels, handlers, and state
cyre.reset()                             // Alias for clear, resets all state
cyre.pause(id?: string)                  // Pause all or a specific channel/schedule task/orchestration
cyre.resume(id?: string)                 // Resume all or a specific channel/schedule task/orchestration
cyre.lock()                              // Freeze further action()/on()/orchestration.keep()/schedule.task() registration
cyre.unlock()                            // Undo lock()
cyre.shutdown()                          // Full system shutdown - calls process.exit(0) on Node

// Metrics & Monitoring
cyre.getMetrics(channelId?: string)      // Get system or channel-specific metrics
cyre.status()                            // Returns whether the system is hibernating
cyre.hasChanged(id, payload)             // Shallow-compares payload against the channel's last request
cyre.getPrevious(id)                     // The request payload before the most recent one

// Scheduling & Orchestration
cyre.schedule                            // Calendar/cron + fixed-interval task scheduling - see Calendar & Cron Scheduling above
cyre.orchestration                       // Multi-channel workflow engine - see Orchestration above

cyre.path()                              // Always '' on the root instance - root has no path. A branch's own .path() (from useBranch) returns that branch's actual hierarchical path instead - see Branches below.
```

### Hooks & Composable Utilities

```typescript
import {useCyre, useGroup, useBranch, useCollective, useMetrics, useLog, log} from 'cyre'
```

- `useCyre(instance, config)`: wraps one channel's `action`/`on`/`call`/`get`/`forget` for the root instance or a branch.
- `useGroup(hooks, config)`: coordinates multiple `useCyre` hooks together (`.call()`/`.on()` fan out to all of them).
- `useBranch(instance, {id})`: isolated channel namespace - see [Branches](#branches-usebranch) above.
- `useCollective(id, config)`: multi-participant coordination primitive - see [Multi-participant coordination](#multi-participant-coordination-with-usecollective) above.
- `useMetrics(instance, config)`: watch `cyre.getMetrics()` on an interval instead of polling it yourself - see [useMetrics](#usemetrics---watch-metrics-instead-of-polling) above.
- `useLog(config)`: subscribe to `sensor`'s log/error stream - see [useLog](#uselog---subscribe-to-the-logerror-stream) above.
- `log` (alias `sensor`): the library's own structured logger/telemetry surface.

None of these are React-specific despite sometimes being used from inside React components in these docs - they're plain functions that work in any JS environment.

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

### Buffer Operator

- `buffer: { window: number, strategy?: 'overwrite' | 'append' | 'ignore', maxSize?: number }`
- Batches calls within a time window and executes once when the window closes.
- `strategy: 'ignore'` and `maxSize` are accepted by the type but are **not currently enforced** by the runtime — see [Buffer Usage in cyre.action](#buffer-usage-in-cyreaction) for the full list of known limitations.
- This is a channel-level (`cyre.action`) feature only - there is no stream-level equivalent, since `createStream` itself isn't part of the public API today; see [Streams](#streams-createstream---on-hold-not-part-of-the-public-api).

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

Streams aren't available (see [Streams](#streams-createstream---on-hold-not-part-of-the-public-api) above), but the same shape - throttle a fast-arriving feed, transform, filter, then hand off - works as a channel:

```typescript
cyre.action({
  id: 'realtime-feed',
  throttle: 16, // 60fps processing rate
  condition: data => data.isComplete
})

cyre.on('realtime-feed', data => {
  updateUI(processRealTimeData(data))
})
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/neuralline/cyre.git
cd cyre
npm install
npm test
npm run benchmark  # Run performance tests
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Roadmap

- [ ] **Streams (`createStream`)** - on hold; type definitions exist but there's no implementation and it isn't exported from the package today
- [ ] **Path-based cross-branch discovery as public API** - the internal path index/wildcard matching exists but isn't exposed outside `useBranch`
- [ ] **Queue option** - Call queuing until subscribers ready
- [ ] **State persistence** - Automatic save/restore functionality

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/neuralline/cyre/issues)
- **Discussions**: [GitHub Discussions](https://github.com/neuralline/cyre/discussions)

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

Originally evolved from the Quantum-Inception clock project (2016), Cyre has grown into a full-featured event management system while maintaining its quantum timing heritage. The latest evolution introduces Schema, hooks, orchestration, and standardized execution behavior to provide a more predictable and powerful developer experience.

```sh
Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
Expands HORIZONTALLY as your project grow
```

**CYRE** - Neural Line Reactive Event Manager
_Zero-dependency reactive event management for Node and the browser._
