# Changelog

## 4.0.0 (2025)

### Breaking Changes

#### Logic realignment

- **Interval Execution**: First execution now waits for the interval instead of executing immediately

  - This aligns with JavaScript's `setInterval` behavior and creates a more predictable timing model
  - Example: `{interval: 1000, repeat: 3}` now waits 1000ms before first execution

- **Repeat Count Definition**: `repeat` now specifies the TOTAL number of executions

  - `repeat: 3` means execute exactly 3 times total (previously could result in 4 executions)
  - `repeat: 1` means execute exactly once after the interval
  - `repeat: 0` means do not execute (new behavior)

- **Delay**: delay only affects the initial execution. overwrites interval (new behavior)

  - `{delay: 500}` = Wait 500ms, execute
  - `{delay: 0}` = Wait 0ms, execute after waiting 0ms (new behavior)

- **Combined Delay and Interval**: delay acts as initial wait, then intervals take over
  - `{delay: 500, interval: 1000, repeat: 3}` = Wait 500ms, execute, wait 1000ms, execute, wait 1000ms, execute
  - `{delay: 0, interval: 1000, repeat: 3}` = Wait 0ms, execute, wait 1000ms, execute, wait 1000ms, execute
- **Channels with intervals**: Cyre does not run the same instance of channel with same id in parallel. it queues.
  - `{id: 'channel-1', payload: 'hello', repeat:5, interval:1000}` = this loops and outputs `'hello'` 5 times
  - `{id: 'channel-1', payload: 'hi'}` = update channel state. the next output will be `'hi'`
- **Edge case scenarios**: Cyre does not run the same instance of channel with same id in parallel. it queues.
  - what will happen if developers use multiple cyre action properties at once
  - which option apply first

### New Features

- **useCyre**: New Cyre hook for creating channels with out ID

  - Simplified middleware registration
  - Automatic history tracking
  - Easy subscription management with unsubscribe capability

- **cyreCompose**: New `cyreCompose` function for creating composed channels

  - Chain multiple channels together
  - Coordinate complex workflows
  - Manage related channels as a single unit
  - Simplified error handling across channel chains

- **Middleware Support**: every Cyre channel has built in middleware as .action() options on top of that you can have custom middleware architecture for transforming actions and payloads

  - Register middleware with `cyre.middleware(id)` or using useCyre hook `channel.middleware()`
  - Chain multiple middleware functions
  - Full support for async middleware
  - Payload validation and transformation
  - Ability to reject actions based on conditions

- **Circuit Breaker Pattern**: Built-in support for the circuit breaker resilience pattern

  - Automatic detection of failing services
  - Configurable thresholds for error rates and response times
  - Self-healing capabilities
  - Prevents cascading failures

### Improvements

#### Breathing System

- **Enhanced Stress Detection**: More responsive system stress detection
- **Dynamic Interval Adjustment**: Intervals now automatically adjust based on system stress
- **Recuperation Logic**: Improved recuperation logic for high-stress scenarios
- **Priority-based Execution**: Critical actions continue to execute even during high stress

#### Protection Features

- **Layered Protection**: Multiple protection mechanisms can be combined

  - Debounce, throttle, and change detection work together intelligently
  - Protection layers prevent cascade failures

- **Surge Protection**: Advanced surge protection with exponential backoff
  - Automatic backoff calculation based on system load
  - Configurable thresholds and recovery strategies

#### Developer Experience

- **Enhanced TypeScript Types**: Comprehensive type definitions for all APIs
- **Extended Documentation**: Detailed API reference and usage examples
- **Improved Logging**: Better error messages and debugging information
- **Testing Utilities**: Built-in support for testing async actions

### Bug Fixes

- Fixed inconsistent timing behavior for interval actions
- Resolved issues with repeat counting and execution tracking
- Fixed edge cases with combined timing properties (delay, interval, repeat)
- Corrected action chain behavior when middleware rejects actions
- Fixed memory leaks related to uncleared timers
- Resolved potential race conditions in action queue management
- Fixed debounce behavior with change detection
- Corrected middleware application sequence on existing actions

### Performance Improvements

- Reduced overhead for action scheduling and execution
- More efficient change detection for payload updates
- Optimized breathing calculations for lower CPU usage
- Improved error handling with reduced overhead
- Better memory management for long-running applications

## Migration Guide

### Updating from v3.x to v4.0

The primary breaking change is in how interval actions are executed. If your code depends on interval actions executing immediately, you'll need to adjust your approach:

**Old approach (v3.x):**

```typescript
// Would execute immediately, then every 5 seconds
cyre.action({
  id: 'interval-action',
  interval: 5000,
  repeat: true
})
```

**New approach (v4.0):**

use delay for immediate execution:

```typescript
// Immediate + interval pattern
cyre.action({
  id: 'interval-action',
  delay: 0, // Execute immediately
  interval: 5000, // Then every 5 seconds
  repeat: true
})
```

## New Cyre Hook Usage

The new `useCyre` hook makes it easy to work with Cyre in React applications:

```typescript
import {useCyre} from 'cyre'

function UserComponent() {
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

    // Cleanup when component unmounts
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
  - adapted TimeKeepers terminology like Keep and Forget

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

- 3.1.6: Cyre lock

  - Added `cyre.lock()` to prevent runtime modification
  - Enhanced queue management for interval actions
  - Expanded test coverage for edge cases
  - Improved documentation and examples
  - Fixed detectChanges behavior with debounce

- 4.0.0: Cyre hooks
  - Introducing `useCyre`
  - Delay
  - Middleware
  - cyre-compose (batch channel processing)
  - Update Cyre logics

For more detailed examples and API reference, see the [documentation](/docs).
