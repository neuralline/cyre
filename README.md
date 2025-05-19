<!-- @format -->

# CYRE

```sh
Neural Line
Reactive event manager
C.Y.R.E ~/`SAYER`/
action-on-call
```

## Installation

```sh
npm i cyre
```

```sh
yarn add cyre
```

```sh
pnpm add cyre
```

> Cyre is a general purpose event management system that provides reactive networking throughout your application. Evolved from the original Quantum-Inception clock (2016) to now power 24/7 server, long and short scheduling, bridge between multiple applications and still has low learning curve

## Core Features

## Core Features

### Event managment

- **action-on-call**: follows three phase for better event decoupling.
- **cyre.action**: every channel has its own safeguard/middleware
- **intraLink action chaining**: Data flows seamlessly between connected actions
  **Cascading Protection**: Multiple defense layers prevent runaway reactions

### Breath System

- **Breathing-Based Protection**: Natural rate limiting through biologically-inspired patterns
- **System-Aware Recovery**: Enters recuperation mode during high stress
- **Self-Healing Architecture**: Automatic recovery from system overload
- **Predictive Timing**: Adjusts execution schedules based on observed system patterns
- **Precision**: High-accuracy timing even for extremely long durations
- **Circuit Breaker Pattern**: Prevents cascading failures under load
- **Surge Protection**: Intelligent throttling with adaptive backoff
- **Priority-Based Execution**: Critical actions take precedence during stress

### Intelligent State Management

- **State**: Cyre's payload is defacto state with zero setup. Has access to them through cyre.get() , Cyre.hasChanged() and cyre.gerPrevious()
- **Change Detection**: Prevents unnecessary updates, optimizing resource usage
- **Historical State Tracking**: Maintains record for metrics and rollback

### TimeKeeper

- **Task Scheduling**: Precise timing control for both immediate and long-term operations
- **Long-Duration Support**: Handles durations beyond JavaScript's timeout limits (over 24 days)
- **Repeat & Interval**: Configurable execution patterns with intelligent timing
- **Protection Integration**: Seamlessly works with debounce and throttle mechanisms

### Performance Optimization

- **Stress-Aware Scheduling**: Dynamically balances workload based on system metrics
- **Resource-Conscious Execution**: Only runs when necessary (change detection)
- **Execution Metrics**: Built-in performance tracking
- **Cross-Platform Optimization**: Specialized for both Node.js and Browser environments

## Basic Usage

```typescript
import {cyre} from 'cyre'

cyre.action({id: 'uber', payload: 44085648634})

cyre.on('uber', number => {
  console.log('Calling Uber: ', number)
})

cyre.call('uber')
```

## Advanced Features

### Breath Protection

```typescript
// Action automatically adapts to system stress
cyre.action({
  id: 'protected-action',
  priority: {level: high}, // Higher priority during stress
  interval: 1000 // Interval adapts to breathing rate
})

// System automatically:
// - Adjusts intervals based on stress
// - Enters recuperation when needed
// - Recovers naturally through breathing
// - Maintains quantum precision
```

### Action Chaining

```typescript
cyre.on('event-a', data => {
  // Chain to next action
  return {
    id: 'event-b',
    payload: processedData
  }
})
```

### Built-in Performance Controls

```typescript
cyre.action({
  id: 'protected-action',
  priority: 'low', // Automatic breathing control
  detectChanges: true // Only trigger on changes
})

// Monitor breathing state
const breathingState = cyre.getBreathingState()
console.log(`System stress: ${breathingState.stress * 100}%`)
```

### System Health Monitoring

```typescript
// Check system health through breathing metrics
const {breathing, stress} = quantumState.get()

if (breathing.isRecuperating) {
  console.log(`System recuperating at ${breathing.recuperationDepth * 100}%`)
}

console.log(`Current stress levels:
  CPU: ${stress.cpu * 100}%
  Memory: ${stress.memory * 100}%
  Event Loop: ${stress.eventLoop}ms
  Combined: ${stress.combined * 100}%`)
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

## Philosophy

Cyre follows these core principles:

- **Precision**: Accurate timing and reliable event handling
- **Protection**: Natural rate limiting through quantum breathing
- **Performance**: System-aware optimization and stress management
- **Adaptability**: Self-adjusting to system conditions
- **Predictability**: Consistent behavior with Cyre logics
- first come first serve
- keep Cyre agile, light-weight and cutting age
- independent Channels:
- expand horizontally

## Origins

Originally evolved from the Quantum-Inception clock project (2016), Cyre has grown into a full-featured event management system while maintaining its quantum timing heritage. The latest evolution introduces ...

```sh
Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0
Expands HORIZONTALLY as your projects grow
```

## License

Distributed under the MIT license. See `LICENSE` for more information.
