# CYRE

> Neural Line - Reactive Event Manager
> C.Y.R.E ~/`SAYER`/
> Version 4.6.7

**A zero-dependency, channel-based reactive event manager for Node and the browser. Register a channel with `cyre.action()`, subscribe with `cyre.on()`, trigger it with `cyre.call()`. Built-in protections (throttle, debounce, buffer, schema, change detection), a hand-rolled scheduler ("TimeKeeper") with drift compensation and calendar/cron support, multi-handler dispatch strategies, and a workflow orchestration engine - all with no external dependencies, designed to run 24/7.**

[![npm version](https://img.shields.io/npm/v/cyre.svg)](https://www.npmjs.com/package/cyre)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/neuralline/cyre/blob/master/LICENSE)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
![runtime](https://img.shields.io/badge/runtime-Node%20%E2%89%A520%20%7C%20Bun%20%7C%20browser-blue.svg)

**Contents:** [Quick Start](#quick-start) · [Why CYRE?](#why-cyre) · [How to use Cyre in your app](#how-to-use-cyre-in-your-app) · [Commission, lock, and runtime](#commission-lock-and-runtime) · [Core Features](#core-features) · [Functional Cyre](#functional-cyre-with-hooks) · [Branches](#branches-usebranch) · [Protections](#throttle-protection) · [Monitoring](#monitoring--debugging) · [Demos & Examples](#demos--examples) · [API Reference](#api-reference) · [Roadmap](#roadmap)

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
const result = await cyre.call('user-login', {
  userId: 123,
  email: 'user@example.com'
})
// result.ok      -> true
// result.payload -> {success: true, timestamp: ...}  (what the handler returned)
// result.message -> human-readable outcome ("throttled", "No changes detected", ...)
```

That's the whole model: **`action` declares a channel, `on` listens to it, `call` sends to it.** Everything else - protections, scheduling, dispatch strategies, orchestration - is configuration on that one channel, not a new API to learn.

### What every call returns

`cyre.call()` never throws for "expected" outcomes. It always resolves with the same `CyreResponse` shape, so a blocked, throttled, invalid or failed call is just data you can branch on:

```typescript
interface CyreResponse<T = any> {
  ok: boolean // did the handler actually run and succeed?
  payload: T // the handler's return value (or null)
  message: string // why - e.g. 'Throttled - retry available in 420ms'
  error?: boolean | string
  metadata?: {executionTime?: number; intraLink?: {...}; validationErrors?: string[]; ...}
}

const res = await cyre.call('api-call', query)
if (!res.ok) console.warn(res.message) // no try/catch needed for protection rejections
```

### Requirements

- Node **>= 20**, Bun **>= 1.0**, or any modern browser (ESM build via `exports.browser`)
- TypeScript types ship with the package - no `@types/cyre` needed
- **Zero runtime dependencies**

## Why CYRE?

- **Zero dependencies** - the whole engine, scheduler, schema builder, and orchestration system ship with nothing else pulled in.
- **Compile-once, execute-cheap** - `cyre.action()` pre-computes which protections/talents/scheduling a channel needs at registration time (`_hasFastPath`/`_pipeline`), so a plain channel with no protections skips straight to dispatch with no redundant checks on every call.
- **Built-in protections** - throttle, debounce, buffer, schema validation, condition/selector/transform, and change detection, composable per channel.
- **A real scheduler, not `setTimeout` soup** - TimeKeeper runs every `delay`/`interval`/`repeat` action (and every orchestration `time`/`condition` trigger) through one global, drift-compensated, precision-tiered engine. `cyre.schedule` layers calendar-correct time-of-day/cron/date scheduling with IANA timezone and DST handling on top of that.
- **Multiple dispatch strategies** - a channel with more than one handler can run them `parallel`, `sequential`, `race`, or `waterfall`, each with configurable error handling and result collection.
- **Workflow orchestration** - `cyre.orchestration` chains multiple channels into `action`/`condition`/`parallel`/`sequential`/`loop` steps, driven by time, condition-poll, or channel-subscription triggers.
- **Runs 24/7** - designed to sit in a long-running Node process or browser tab without leaking timers or state; `cyre.shutdown()`/`cyre.reset()` tear everything down cleanly for the cases where you do want to stop it.
- **A crashing handler can't crash your process** - a handler that throws (even with no `try`/`catch` of its own) is contained at the dispatch layer and comes back as `{ok: false, message}`. The resilience benchmark fires 500 unguarded throws in a row and the process stays alive and responsive throughout.
- **Every channel is also state** - `cyre.get(id)` returns the channel's last request, previous request, last response and counters, so a channel doubles as a small observable store with no extra library.
- **Decoupled by design** - components never import each other; they talk through channel ids. Swap, add or remove a subscriber and nothing else in the app has to change (see [How to use Cyre in your app](#how-to-use-cyre-in-your-app)).
- **Isolated namespaces** - `useBranch` gives each feature/component/device its own channel namespace (`site-a/floor-1/temperature`) without id collisions, while still allowing cross-branch calls by absolute path.
- **Observable without polling** - `useMetrics` pushes live samples, slow-task and error events, chart series and per-channel rows; `useLog` lets code react to Cyre's own log/error stream. Neither costs anything while nobody is subscribed.
- **Fully typed hooks** - `useCyre<TPayload, TResponse>` types both what `.call()` sends and what `.on()` must return, per channel.

### How it compares

| Need                               | `EventEmitter` / pub-sub   | RxJS                   | **CYRE**                                   |
| ---------------------------------- | -------------------------- | ---------------------- | ------------------------------------------ |
| Throttle / debounce / buffer       | hand-rolled timers         | operators per stream   | one config field per channel               |
| Payload validation                 | manual                     | manual                 | built-in `schema` talent                   |
| Result of an emit                  | none (fire-and-forget)     | stream value           | awaited `CyreResponse` with `ok`/`message` |
| Handler throws                     | can crash / unhandled      | errors the stream      | contained, reported as `ok: false`         |
| Timers, intervals, cron, timezones | `setInterval` + a cron lib | `interval()`/`timer()` | TimeKeeper + `cyre.schedule`               |
| Multi-step workflows               | glue code                  | `pipe`/`switchMap`     | `cyre.orchestration`                       |
| Load shedding under stress         | none                       | none                   | breathing system + `priority`              |
| Dependencies                       | 0                          | 1                      | **0**                                      |

Cyre is a good fit for UI event wiring, IoT/telemetry ingestion, rate-limited API gateways, background jobs and schedulers, and any long-running service where "one noisy thing must not take the rest down" matters. If all you need is a single synchronous callback list, a plain `EventEmitter` is smaller.

### Benchmarking

CYRE ships two separate benchmarks, each answering a different question:

- **`npm run benchmark`** ([`demo/benchmark.ts`](demo/benchmark.ts)) - resilience under bad usage, not raw speed: an unprotected baseline, `throttle`/`detectChanges` rejecting a tight-loop burst, defensive handlers surviving malformed payloads, and - most importantly - a handler that throws with **no** user-side `try`/`catch` still being contained by Cyre's dispatch layer rather than crashing the process. Every figure comes from a real, awaited `cyre.call()` round trip timed with `performance.now()`.
- **`npm run benchmark:speed`** ([`demo/speed-test-demo.ts`](demo/speed-test-demo.ts)) - raw throughput: the fast path, the full compiled pipeline, each dispatch strategy, and throttle/debounce/buffer overhead.

Numbers vary meaningfully by JS runtime - a real run comparing Node and Bun on the same machine saw the fast path range from roughly **270k to 700k operations/second** depending on runtime and call pattern (sequential vs. concurrent), with `parallel` dispatch consistently the slowest of the four multi-handler strategies on both runtimes. Run both yourself against your target runtime and hardware rather than relying on a single published number.

## How to use Cyre in your app

### The mental model

**Nothing in your app holds a reference to anything else in your app.** Every piece of logic and every piece of UI talks to Cyre channels, and only to channels. If component A needs component B to do something, A doesn't import B - A calls a channel, and B (or C, or nobody yet) subscribes to it. The moment two sibling files import each other's functions, you've built a coupling Cyre can't see, route around or protect.

### Factory handlers and outpost handlers

Cyre apps split handlers into two roles:

|                      | **Factory handler**                                                  | **Outpost handler**                                                   |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Job                  | Business logic: parse, validate, compute, decide what happens next   | Delivery: update the DOM, re-render, show a toast, write to storage   |
| Channel relationship | **1-to-1** - one factory owns a channel's logic                      | **1-to-many** - any number of outposts can listen to the same channel |
| Lives in             | `src/handlers/` (or equivalent) — **outside the UI re-render layer** | Inside the component it updates                                       |
| Setup at boot        | **`cyre.action([...])` batch registration** + `cyre.on()`            | **`useCyre`** with a fixed existing id, or `cyre.on()` in the panel   |
| Framework            | **Framework-agnostic** — same handlers for React, Next.js, Electron, vanilla TS | Tied to your UI shell; still talks only through channels              |
| Returns              | A result, often an IntraLink `{id, payload}` to the next channel     | Nothing anyone relies on - it's a leaf                                |
| Testable with        | Plain input → plain expected output, no mocks                        | Your UI test harness                                                  |

```typescript
// src/handlers/scene-handlers.ts - FACTORY: no DOM/UI code in this file
cyre.action({id: 'scene/select'})
cyre.action({id: 'scene/selected'})

cyre.on('scene/select', ({heading, ordinal}) => {
  const key = `${ordinal}:${heading}` // pure derivation
  // IntraLink: returning {id, payload} triggers the next channel for you
  return {id: 'scene/selected', payload: {key, heading}}
})

// src/components/NotesPanel.ts - OUTPOST #1
cyre.on('scene/selected', payload => renderNotes(payload))

// src/components/StatusBar.ts - OUTPOST #2, same channel, knows nothing about #1
cyre.on('scene/selected', payload => setStatus(payload.heading))

// anywhere in the UI
cyre.call('scene/select', {heading: 'INT. KITCHEN - NIGHT', ordinal: 4})
```

Add a third outpost later (autosave, analytics, telemetry) and nothing else changes.

**Factory handlers are not tied to a UI framework.** The same `src/handlers/` modules work whether your shell is React, Next.js, Electron, or plain TypeScript — only the outpost layer changes. A factory can be large and cover a whole subject domain; route by payload when that suits your project:

```typescript
// src/handlers/project-handlers.ts — one factory, many operations (shape is yours)
cyre.action({id: 'project/handler'})
cyre.on('project/handler', async ({op, data}) => {
  switch (op) {
    case 'load':  return loadProject(data)
    case 'save':  return saveProject(data)
    case 'reset': return resetProject(data)
    case 'sync':  return syncProject(data)
    case 'get':   return getProject(data)
  }
})

await cyre.call('project/handler', {op: 'load', data: snapshot})
```

Prefer **batch registration** for factories at boot — declare many channels in one pass:

```typescript
cyre.action([
  {id: 'project/load', description: 'Load project bundle'},
  {id: 'project/save', priority: {level: 'critical'}},
  {id: 'entities/state', detectChanges: true}
])
```

**Outposts** are where `useCyre` shines: a typed, functional wrapper around an **already commissioned** channel id (see [Functional Cyre](#functional-cyre-with-hooks)).

### Events vs standing state

Not every channel is a one-off event. Pick the shape before you register:

| Kind | Examples | Pattern |
| ---- | -------- | ------- |
| **Fire-and-forget event** | `file/saved`, `scene/selected` | Broadcast once; outposts react |
| **Standing state** | `entities/state`, `cursor/position-changed` | Owner broadcasts on every change; new outposts subscribe **and/or** read `cyre.get(id).res?.payload` for the current value without a round trip |

Reach into another module's `let` or import a getter from a panel file only when no channel owns that state yet — once something broadcasts it, read through Cyre.

### A five-step recipe for a new feature

1. **Name the channels first.** Use `domain/verb` for commands (`scene/select`) and `domain/event` for the resulting broadcast (`scene/selected`). Decide which are one-off events and which are standing state (`sidebar/visibility`, `cursor/position-changed`).
2. **Write the factory with zero UI code.** Register it with `cyre.action()` + `cyre.on()`, feed it fake payloads, and confirm its output before any component exists.
3. **Write each outpost inside its component.** Keep it short enough to read at a glance - if it starts computing, move that logic one hop upstream into a factory.
4. **Put protections on the channel, not in the component.** `debounce`, `throttle`, `detectChanges` and `schema` replace scattered `setTimeout`/`clearTimeout` pairs and ad-hoc validation.
5. **Register every channel before anything calls it, then `cyre.lock()`.** Locking freezes further `action()`/`on()`/`orchestration.keep()` registration so nothing can quietly rewire the network at runtime.

### Commission, lock, and runtime

Registration order is the **control plane**, not an accident of startup. You declare the authorized communication surface first, wire handlers second, mount UI third, then freeze:

```
1. cyre.init()
2. cyre.action([...]) / branch.action([...])   ← commission channels (allowlist)
3. cyre.on(...)                                 ← factory + outpost handlers
4. mount UI (useCyre with fixed ids, cyre.on in panels)
5. cyre.lock()                                  ← prevention: no new registration
6. cyre.call('full/path/id', payload)           ← runtime traffic only
```

| Phase | `cyre.action()` / `cyre.on()` | `cyre.call()` |
| ----- | ----------------------------- | ------------- |
| Before `lock()` | Allowed — commission everything here | Allowed on commissioned ids |
| After `lock()` | **Blocked** — logs error, returns `ok: false` | **Allowed** — already-commissioned channels keep working |

**`cyre.lock()` is a prevention mechanism.** After lock, nothing can add channels, duplicate handlers, or rewire the graph at runtime. Panels and buttons should **`cyre.call('panels/editor/go-prev-scene')`** (full global id on root cyre) — not commission new channels from UI code.

Cyre is **strict on registration**: invalid config, rejected combinations (e.g. throttle + debounce), or registration while locked are logged and return `ok: false` — not silently ignored.

### Gotchas worth knowing up front

- **Registration order is intentional.** Only channels declared with `cyre.action()` at setup are callable. That limits unauthorized communication — not a footgun, the design.
- **`cyre.call()` needs the channel registered with `cyre.action()` first; `cyre.on()` alone does not register it.** Calling an unknown id returns `ok: false` and logs "Channel does not exist".
- **Calling a channel with no subscriber is logged as an error** — a deliberate signal that nobody owns that channel yet. The request still lands in channel state (`cyre.get(id).req`); a later `.on()` receives **future** calls. For the current value, read `cyre.get(id).res?.payload` or have the owner re-broadcast.
- **A handler throw does not crash your process.** Cyre contains it at the dispatch layer, logs the error, and returns `{ok: false, message}`. One failing handler does not interrupt the rest of the operation (see multi-handler `errorStrategy`). **CRITICAL system faults** can still trigger shutdown via `cyre.shutdown()`.
- **`cyre.forget(id)` removes the channel and _every_ handler on it.** To clean up just your own subscription, use the `unsubscribe()` returned by `cyre.on()`.
- **Two stateful handlers on one channel both run.** With 2+ handlers the default dispatch is `parallel`, so two outposts that each toggle the same element will cancel each other out. One stateful owner per channel, or pick a `dispatch` strategy deliberately.
- **`useCyre` without a fixed `id` inside a re-rendering path mints a new channel each run.** Always pass an existing commissioned id for outposts, create the hook once at module scope, or use plain `cyre.call()` after lock. See [How `useCyre` resolves channel ids](#how-usecyre-resolves-channel-ids).
- **`throttle` and `debounce` can't be combined on one channel** - `cyre.action()` rejects it at registration.
- **Pipeline order is the order you write the fields in** - see [Pipeline Talent Order](#pipeline-talent-order-schema-condition-selector-transform-detectchanges).
- **Replace polling loops with `cyre.orchestration` or `cyre.schedule`** rather than `setInterval` plus manual gating.

For a full, runnable version of this architecture - a factory function that commissions isolated outposts with `useBranch`, typed `useCyre` channels reporting up to a shared main-instance channel, broadcasts down, unsubscribe, teardown and `lock()` - see [`demo/outpost-factory-demo.ts`](demo/outpost-factory-demo.ts).

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

A handler can trigger the next step in a chain just by returning `{id, payload}` - no explicit `cyre.call()` needed from inside the handler. IntraLink is a **channel chaining method** — it works the same in small and large apps. Its main advantage is **testability**: the factory handler's return value is a plain object you assert in a unit test without mocking the next hop.

```typescript
// Automatic chain reactions
cyre.on('validate-data', payload => {
  const isValid = validate(payload)

  // Return IntraLink to trigger next action — test this return value directly
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

## Functional Cyre with hooks

Cyre hooks (`useCyre`, `useBranch`) are **not React-specific** — plain functions for any JS environment. Use them to give channels a typed, functional API.

| Layer | Tool | When |
| ----- | ---- | ---- |
| **Factory** (business logic) | `cyre.action([...])` batch + `cyre.on()` in `src/handlers/` | Boot-time commission; framework-agnostic |
| **Outpost** (UI delivery) | `useCyre(instance, { id: 'existing-id' })` | Typed `.call()` / `.on()` against a channel already commissioned |

### How `useCyre` resolves channel ids

Channel identity in Cyre is the id string — **same global id, same store entry**. What you pass in `useCyre(instance, config)` decides whether you extend an existing channel or create a new one:

| Config | What happens |
| ------ | ------------ |
| **`id` matches an already-commissioned channel** | The hook **extends** that channel — a functional, typed way to access `.call()` / `.on()` / `.get()` / `.forget()`. It does **not** create a duplicate. **Best for outposts.** |
| **`id` is a brand-new id (not yet registered)** | First `.call()` or `.on()` **creates** that channel (same as `cyre.action({ id })`). Use deliberately at commission time. |
| **No `id` in config** | Cyre mints `hook-xxxxxxxx` for you. **Dangerous inside a re-rendering path** (e.g. a component body that runs every render): each run can **register a new channel**. Prefer a fixed id, a module-level singleton, or plain `cyre.call('full/path/id')` after `cyre.lock()`. |

[`demo/outpost-factory-demo.ts`](demo/outpost-factory-demo.ts) walks through attaching `useCyre` to an existing main-instance id, branch-isolated outposts, teardown, and `lock()`.

### useCyre Hook

`useCyre` wraps `cyre.action`/`cyre.on`/`cyre.call`/`cyre.get`/`cyre.forget` for one channel on the root `cyre` instance or a branch.

**Preferred outpost pattern** — commission at boot, bind once at module scope:

```typescript
import {cyre, useCyre} from 'cyre'

// Commissioned earlier in initializeHandlers():
// cyre.action({ id: 'user-profile', debounce: 300, detectChanges: true })

const userChannel = useCyre<{userId: string}, {handled: boolean}>(cyre, {
  id: 'user-profile' // extends existing channel — typed functional access
})

userChannel.on(userData => {
  renderProfile(userData)
  return {handled: true}
})

// anywhere after lock:
await userChannel.call({userId: '123'})
// or: await cyre.call('user-profile', { userId: '123' })
```

**Avoid** calling `useCyre(cyre)` with no `id` inside a function that re-runs on every render — that pattern mints new channels. The React example below uses a **fixed id**; in production, prefer creating the hook once outside the render path.

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

### Typed channels with `useCyre<TPayload, TResponse>`

Both type parameters are optional (they default to `any`, so untyped code keeps compiling). Pass them to make a channel type-safe end to end:

```typescript
import {cyre, useCyre} from 'cyre'

const profile = useCyre<{userId: string}, {name: string; email: string}>(cyre, {
  id: 'user-profile',
  throttle: 500
})

profile.on(({userId}) => ({name: 'Jane', email: 'jane@example.com'})) // must return {name, email}

const res = await profile.call({userId: '123'}) // payload must be {userId: string}
res.payload?.email // typed as string
```

When the hook's `id` matches an existing channel, `useCyre` gives you **typed functional access** to that same store entry — channel identity is the id string, nothing more. If you pass extra config fields on first use, they merge/update the existing registration; keep config identical to (or a superset of) the original commission when attaching to a channel owned elsewhere.

`hook.on()` returns `{ok, message, unsubscribe}`; `unsubscribe()` removes only that handler and keeps `hook.getStats().subscribed` accurate. `hook.forget()` removes the whole channel.

The hook types (`UseCyreConfig`, `CyreHook`, `UseBranchConfig`, `Branch`, `BranchConfig`, `UseLogConfig`, `LogHook`, `UseMetricsConfig`, `MetricsHook`, ...) are exported from the package root, so you never need to deep-import from `cyre/src/...`.

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

### Controlling payload storage: `keepPayload`, `history`, `resetPayload()`

By default every channel keeps a copy of its most recent request/response in `payload-state` so `cyre.get()`/`getPrevious()` can read it back - fine for most payloads, but wasteful if a channel only ever passes through a large one-off document or buffer that nothing downstream needs to re-read.

```typescript
// Pass a large payload straight to the handler without storing a copy of it
cyre.action({id: 'ingest-document', keepPayload: false})
cyre.on('ingest-document', doc => processDocument(doc)) // still gets the real payload, by reference

await cyre.call('ingest-document', hugeDocument)
cyre.get('ingest-document').req // undefined - nothing was stored
```

`keepPayload: false` cannot be combined with `detectChanges` - `detectChanges` compares the incoming payload against the stored previous one, and there's nothing to compare against once storage is off. `cyre.action()` rejects that combination at registration time.

```typescript
// Keep more than the default single previous-payload slot
cyre.action({id: 'sensor-reading', history: 5})
cyre.on('sensor-reading', reading => reading)

for (const r of readings) await cyre.call('sensor-reading', r)

cyre.getHistory('sensor-reading') // last 5 request payloads, newest first
cyre.getPrevious('sensor-reading') // still just the single most recent previous payload
```

`history: 0` disables previous-payload tracking entirely; `history` is ignored (with a registration warning) on a `keepPayload: false` channel, since there's nothing being stored to keep a history of.

```typescript
// Clear a channel's stored payload/counters without removing the channel itself
cyre.resetPayload('sensor-reading')
// req/res/prevReq/history are cleared and req is reseeded with the channel's
// configured default `payload`, if it has one - unlike cyre.forget(), the
// channel, its handlers, and its schedule are all left intact
```

Unlike `cyre.forget(id)` - which removes the whole channel, its handlers, and its timers - `resetPayload()` only clears what `cyre.get()`/`getPrevious()`/`getHistory()` read. It doesn't cancel an in-flight debounce/buffer window; that window will still overwrite the reset once it settles.

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

- **Factory Handlers**: Main business logic — parse, validate, compute, persist. Live in **`src/handlers/`** (outside the UI re-render layer), are **framework-agnostic** (React, Next.js, Electron, and vanilla TS can share the same handlers), and are registered at boot with **`cyre.action([...])` batch setup** + `cyre.on()`. One factory module can own a whole domain (`project/load`, `project/save`, …) or a single consolidated handler routed by payload (`{ op: 'load' | 'save', data }`). Not every channel needs its own file — adjust to what your project suits.
- **Outpost Handlers**: Delivery only — update DOM, re-render panels, show toasts. Live inside the component they update, support **1-to-many** on broadcast channels, and are best wired with **`useCyre(instance, { id: 'existing-id' })`** for typed functional access, or plain `cyre.on()` for simple listeners. Outposts are leaves; they don't own business logic.

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

Branches give a part of your app its own **isolated channel namespace** — a container. `useBranch(instance, {id})` hangs a new branch off an instance's path; channels registered on that branch get a globally-unique id (`parentPath/branchId/localId`) automatically, but you keep addressing them by their short local id from inside the branch.

**Branch isolation.** A branch does not call sibling branches directly. Cross-area work goes through **root `cyre.call('full/global/id')`**, not by importing another branch instance.

**Duplicated branch setups.** The same branch pattern can be instantiated many times — a carousel, widget, or panel imported in multiple places, even in a loop. Each instance gets the same local ids (`next`, `prev`) without collision; reach the right one by **branch prefix** on `cyre.call()`:

```typescript
import {cyre, useBranch} from 'cyre'

function createCarousel(id: string) {
  const branch = useBranch(cyre, {id})
  branch.action({id: 'next'})
  branch.action({id: 'prev'})
  branch.on('next', () => ({ moved: 'forward' }))
  branch.on('prev', () => ({ moved: 'back' }))
  return branch
}

// Same local ids, isolated global paths — safe in a loop
const carousels = ['hero', 'gallery', 'footer'].map(slug => createCarousel(slug))

await cyre.call('hero/next')
await cyre.call('gallery/prev')

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
// metrics.stores.channels - registered channels
// metrics.stores.subscribedChannels - channels with cyre.on() handlers
// metrics.stores.handlers - total handler count (multiple .on() on one channel = 1 subscribed channel)
// metrics.stores.orphanedHandlers - subscribed channel ids with no matching io entry yet

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

### useMetrics - live, push-based metrics

`cyre.getMetrics()` is a one-off snapshot. `useMetrics` subscribes instead of
polling: it is told when the breathing tick produces a sample, when a handler
runs slow, when one throws, and when the system enters or leaves recuperation.
It creates no channel and no timer, never touches `cyre.call()`, and does no
sampling work at all while nothing is subscribed - the fast lane pays nothing
for it.

```typescript
import {useMetrics, findUnused, hottest, slowest, errorProne, mostGated} from 'cyre'

const vitals = useMetrics(cyre, {slowMs: 50})

// Push events
vitals.on('tick', ({sample, channels}) => chart.push(sample))
vitals.on('slow-task', e => console.warn(e.channelId, e.durationMs))
vitals.on('channel-error', e => alert(e.channelId, e.message))
vitals.on('recuperation', e => setBanner(e.recuperating))

// Snapshot on every tick (or `{interval}` ms minimum between deliveries)
const stop = vitals.watch(metrics => renderStressGauge(metrics.system.stress))

// Chart data: flat rows, oldest first, ~5 min ring buffer (recorded while subscribed)
vitals.series() // [{t, stress, cpu, memory, eventLoop, callsPerSecond, breathingRate, recuperating}]

// Per-channel rows + pure analyzers - rows also carry throttleCount/debounceCount/bufferCount,
// traffic that never reaches executionCount since a throttled/debounced/buffered call
// doesn't always dispatch
const rows = vitals.channels() // {id, count, rate, lastMs, maxMs, errors, idleMs, neverExecuted, throttleCount, debounceCount, bufferCount, ...}
findUnused(rows, {idleMs: 5 * 60_000}) // dead or stale channels
hottest(rows, 5) // busiest right now (or by: 'count')
slowest(rows, 5) // worst durations
errorProne(rows) // error ratio above a threshold
mostGated(rows, 5) // most throttled+debounced+buffered combined - traffic invisible to the others

// One-off read, scoped to a branch's own channel
useMetrics(useBranch(cyre, {id: 'hero'}), {channelId: 'next-slide'}).get()

stop() // or vitals.stop() to remove every subscription
```

Per-channel `maxMs` is sampled at tick time; exact slow executions arrive via
the `slow-task` event.

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

## Demos & Examples

The [`demo/`](demo) folder is a set of runnable, self-explaining scripts. Each file starts with a comment block describing what it exercises and why, and prints what actually happened so behavior is confirmed live rather than assumed.

**Running a demo** (from a clone of this repo):

```bash
pnpm install
pnpm tsx demo/validation-pipeline-demo.ts   # or: bun demo/validation-pipeline-demo.ts
```

Most demos import straight from `../src`, so they run against your working copy with no build step. A few (`buffer-window-demo.ts`, `cyre-claims-audit.ts`, `orbital-command.ts`) import from the package name `cyre` the way a real consumer would - run `pnpm build` first so they pick up current `dist/`. [`cyre-hooks-reliability.ts`](demo/cyre-hooks-reliability.ts) uses the same `cyre` import but is not listed in the tables below.

### Start here

| Demo                                                          | What it shows                                                                                                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`heartbeat.ts`](demo/heartbeat.ts)                           | The smallest possible Cyre program: one repeating channel and a handler.                                                                                                    |
| [`simple-cyre-test.ts`](demo/simple-cyre-test.ts)             | `.on` handlers and batch registration in ~100 lines.                                                                                                                        |
| [`realtime-features-demo.ts`](demo/realtime-features-demo.ts) | Real-world picks for `debounce` (search-as-you-type), `buffer` and `delay` - each used where it actually fits.                                                              |
| [`outpost-factory-demo.ts`](demo/outpost-factory-demo.ts)     | **Start here for real apps:** factory/outpost split, batch commission, `useBranch` isolation + duplication, typed `useCyre` on existing ids, broadcast, unsubscribe, teardown, `cyre.lock()`. |

### Protections & the processing pipeline

| Demo                                                                        | What it shows                                                                                                                                                                 |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`validation-pipeline-demo.ts`](demo/validation-pipeline-demo.ts)           | `schema`, `required`, `condition`, `selector`, `transform`, `detectChanges` - and why their field order matters. Signup, telemetry, payment-webhook and search-box scenarios. |
| [`schema-composition-demo.ts`](demo/schema-composition-demo.ts)             | The schema builder itself: composing, extending and reusing schemas.                                                                                                          |
| [`detectchanges-1000-calls-demo.ts`](demo/detectchanges-1000-calls-demo.ts) | What `detectChanges` costs and saves across 1,000 calls.                                                                                                                      |
| [`buffer-window-demo.ts`](demo/buffer-window-demo.ts)                       | Every `buffer` strategy, printing exactly what the handler received.                                                                                                          |
| [`buffer-vs-debounce.ts`](demo/buffer-vs-debounce.ts)                       | Buffer vs debounce side by side, including what gets saved to `req`/`res`.                                                                                                    |

### Dispatch, chaining & channel state

| Demo                                                                    | What it shows                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`hook-and-chaining-demo.ts`](demo/hook-and-chaining-demo.ts)           | IntraLink chaining, `useCyre`/`useGroup`, and the register-then-`lock()` pattern. |
| [`cyre-on-handlers-test.ts`](demo/cyre-on-handlers-test.ts)             | Exhaustive multi-handler, subscription and error-scenario coverage.               |
| [`cyre-get-demo.ts`](demo/cyre-get-demo.ts)                             | `cyre.get(id)` returning the full `{req, res, prevReq, metadata}` record.         |
| [`cyre-channels-as-state-demo.ts`](demo/cyre-channels-as-state-demo.ts) | Using channels as a state-management primitive with no external store.            |

### Timing, scheduling & orchestration

| Demo                                                                                      | What it shows                                                                                                                                  |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`timekeeper-limits-demo.ts`](demo/timekeeper-limits-demo.ts)                             | TimeKeeper under stress: sub-second precision, very long intervals, concurrent timers, finite/infinite repeat, pause/resume, error resilience. |
| [`calendar-scheduling-demo.ts`](demo/calendar-scheduling-demo.ts)                         | `cyre.schedule`: 5-field cron, IANA timezones and DST, one-off dates, weekday-restricted daily triggers.                                       |
| [`orchestration-scheduling-demo.ts`](demo/orchestration-scheduling-demo.ts)               | `cyre.orchestration` feature by feature: triggers, each step type, condition-abort.                                                            |
| [`orchestration-incident-response-demo.ts`](demo/orchestration-incident-response-demo.ts) | The same pieces composed into one incident-response workflow.                                                                                  |
| [`orchestration-demo.ts`](demo/orchestration-demo.ts)                                     | An e-commerce order pipeline with error handling and monitoring.                                                                               |
| [`system-integration-demo.ts`](demo/system-integration-demo.ts)                           | How schedule and orchestration share TimeKeeper's timeline with core channels (`pause`/`resume` across subsystems).                            |

### Branches, paths & hooks

| Demo                                                                                                              | What it shows                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`branches-demo.ts`](demo/branches-demo.ts)                                                                       | `useBranch` isolation, automatic path prefixing, cross-branch calls, `destroy()`.           |
| [`use-branch-demo.ts`](demo/use-branch-demo.ts) / [`multi-depth-branch-demo.ts`](demo/multi-depth-branch-demo.ts) | Branches nested several levels deep, ids and paths at each level.                           |
| [`path-system-demo.ts`](demo/path-system-demo.ts)                                                                 | The hierarchical path engine: pattern matching and bulk operations.                         |
| [`id-path-collision-demo.ts`](demo/id-path-collision-demo.ts)                                                     | Why you should use `path`/branches instead of typing `/` into an `id`.                      |
| [`collective-intelligence-demo.ts`](demo/collective-intelligence-demo.ts)                                         | `useCollective`: join/leave, shared state, proposals, voting, consensus, work distribution. |
| [`demo-hook.ts`](demo/demo-hook.ts)                                                                               | `useCyre` usage patterns as a consumer would write them.                                    |

### Resilience & performance

| Demo                                                                | What it shows                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`benchmark.ts`](demo/benchmark.ts)                                 | `npm run benchmark` - protections under bad usage and dispatch-level crash containment.                   |
| [`speed-test-demo.ts`](demo/speed-test-demo.ts)                     | `npm run benchmark:speed` - calls/sec for the fast path, pipeline, dispatch strategies and guards.        |
| [`breathing-stress-demo.ts`](demo/breathing-stress-demo.ts)         | The breathing system across idle → critical load, including recuperation and `priority: critical` bypass. |
| [`channel-fairness-demo.ts`](demo/channel-fairness-demo.ts)         | What happens to healthy channels when one channel is the sole source of overload.                         |
| [`cyre-init-userconfig-demo.ts`](demo/cyre-init-userconfig-demo.ts) | Tuning breathing rates, stress thresholds and limits with `cyre.init(userConfig)`.                        |
| [`cyre-claims-audit.ts`](demo/cyre-claims-audit.ts)                 | Checks this README's claims live and prints CONFIRMED / BROKEN / PARTIAL for each.                        |

### Full scenarios

| Demo                                                              | What it shows                                                                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [`smart-building-ops-demo.ts`](demo/smart-building-ops-demo.ts)   | "Aurora Tower": a 40-floor smart building run as one operations story across most of Cyre's surface.                                     |
| [`iot-full-features-demo.ts`](demo/iot-full-features-demo.ts)     | A smart greenhouse: branches per site, pipeline data hygiene, actuator protection, scheduling.                                           |
| [`orbital-command.ts`](demo/orbital-command.ts)                   | Satellite ground control: waterfall and race dispatch, buffered telemetry, throttle, debounce, `useGroup` broadcast, live introspection. |
| [`neural-network-channels.ts`](demo/neural-network-channels.ts)   | A small XOR-trained neural network modelled with channels - Cyre as a computation substrate.                                             |
| [`mathematician-functional.ts`](demo/mathematician-functional.ts) | Channel lifecycle throughput: create → process → destroy at volume.                                                                      |

### Further documentation

- [`docs/CYRE-USAGE-GUIDE.md`](docs/CYRE-USAGE-GUIDE.md) - complete usage guide
- [`docs/cyre-api-reference.md`](docs/cyre-api-reference.md) - method-by-method API reference
- [`docs/channel-architecture.md`](docs/channel-architecture.md) - why channels instead of event types
- [`docs/CYRE-LOGIC.md`](docs/CYRE-LOGIC.md) - execution logic and behavior rules
- [`docs/hotpath-performance-analysis.md`](docs/hotpath-performance-analysis.md) - how the fast path is kept cheap
- [`docs/cyre-dynamic-live-features.md`](docs/cyre-dynamic-live-features.md) - live/dynamic features
- [`CHANGELOG.md`](CHANGELOG.md) - release notes

## API Reference

### Core Methods

```typescript
// Channel management
cyre.action(config: IO | IO[])           // Register one or more channels
cyre.on(id: string, handler: Function)   // Subscribe handler(s) to a channel - result includes unsubscribe()
cyre.call(id: string, payload?: any)     // Trigger a channel/action
cyre.forget(id: string)                  // Remove a channel and every handler on it
cyre.get(id: string)                     // Returns {req, res, prevReq, metadata} - the channel's state record, not its config
cyre.resetPayload(id: string)            // Clear a channel's stored payload/counters without removing the channel - see Controlling payload storage above

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
cyre.getHistory(id)                      // Up to `history` previous request payloads, newest first (falls back to [prevReq] or [])

// Scheduling & Orchestration
cyre.schedule                            // Calendar/cron + fixed-interval task scheduling - see Calendar & Cron Scheduling above
cyre.orchestration                       // Multi-channel workflow engine - see Orchestration above

cyre.path()                              // Always '' on the root instance - root has no path. A branch's own .path() (from useBranch) returns that branch's actual hierarchical path instead - see Branches below.
```

### Hooks & Composable Utilities

```typescript
import {
  useCyre,
  useGroup,
  useBranch,
  useCollective,
  useMetrics,
  useLog,
  log
} from 'cyre'
```

- `useCyre(instance, config)`: typed functional wrapper for one channel on root or a branch — **best for outposts** with a fixed existing id (see [How `useCyre` resolves channel ids](#how-usecyre-resolves-channel-ids)).
- `useGroup(hooks, config)`: coordinates multiple `useCyre` hooks together (`.call()`/`.on()` fan out to all of them).
- `useBranch(instance, {id})`: isolated channel namespace — containers that can be duplicated per instance; see [Branches](#branches-usebranch).
- `useCollective(id, config)`: multi-participant coordination primitive - see [Multi-participant coordination](#multi-participant-coordination-with-usecollective) above.
- `useMetrics(instance, config)`: live push-based metrics - events, chart series and per-channel rows instead of polling `cyre.getMetrics()` - see [useMetrics](#usemetrics---live-push-based-metrics) above.
- `useLog(config)`: subscribe to `sensor`'s log/error stream - see [useLog](#uselog---subscribe-to-the-logerror-stream) above.
- `findUnused`, `findNeverExecuted`, `hottest`, `slowest`, `errorProne`, `mostGated`: pure analyzers over `useMetrics().channels()` rows.
- `log` (alias `sensor`) and `LogLevel`: the library's own structured logger/telemetry surface.

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
  keepPayload?: boolean // Default true. false: pass payload through without storing it (see Controlling payload storage above)
  history?: number // Previous-request payloads to retain (default 1, 0 disables prevReq tracking). Ignored when keepPayload is false

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
pnpm install              # or npm install
pnpm test                 # vitest suite (test/)
pnpm typecheck            # tsc --noEmit
pnpm run benchmark        # resilience benchmark - protections, defensive handlers, crash containment
pnpm run benchmark:speed  # raw throughput - fast path, dispatch strategies, protection overhead
pnpm build                # dist/ (types + ESM)
npx tsx demo/heartbeat.ts # run any demo straight from source
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Roadmap

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
