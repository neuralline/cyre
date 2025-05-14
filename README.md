<!-- @format -->

# CYRE

```sh
Neural Line
Reactive event manager
C.Y.R.E ~/`SAYER`/
action-on-call
```

> Cyre is a sophisticated event management system that provides reactive networking throughout your application. At its core is the Q.U.A.N.T.U.M. TimeKeeper, evolved from the original Quantum-Inception clock (2016) to now power precise event timing and management with an advanced quantum breathing system for natural rate limiting and system protection.

## Core Features

### Event Management

- Action-based event dispatching
- Reactive state management
- Automatic change detection
- Smart surge protection with quantum breathing
- Event chaining through intraLinks

### Quantum TimeKeeper & Breathing System

- High-precision timing control with quantum breathing
- Intelligent recuperation mode for system health
- Natural rate limiting through breathing patterns
- Self-healing system protection
- Cross-platform (Node.js and Browser)

### Performance Features

- Automatic performance optimization
- Smart surge protection with quantum breathing
- Built-in metrics tracking
- Efficient state updates
- System stress adaptation

## Installation

```sh
npm i cyre
# or
yarn add cyre
```

## Basic Usage

```typescript
import {cyre} from 'cyre'

// Define an action with protection
cyre.action({
  id: 'user-sync',
  type: 'sync',
  payload: {userId: 123},
  priority: 'medium', // Priority level for breathing system
  interval: 5000, // 5 second interval (adjusts with system stress)
  repeat: 'infinite' // Continuous sync
})

// Listen for events
cyre.on('sync', payload => {
  console.log('Syncing user:', payload)
})

// Trigger action - automatically protected by quantum breathing
cyre.call('user-sync')
```

## Advanced Features

### Quantum Breathing Protection

```typescript
// Action automatically adapts to system stress
cyre.action({
  id: 'protected-action',
  priority: 'high', // Higher priority during stress
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

  - Core event management
  - Basic timing control
  - State management

- 2.0.0: Quantum Update

  - Enhanced TimeKeeper integration
  - Performance optimizations
  - Advanced metrics
  - Cross-platform support

- 3.0.0: Function Architecture

  - Functional architecture
  - Enhanced type safety
  - Improved performance
  - Better developer experience

- 3.1.0: Quantum Breathing (Current)

  - Natural rate limiting through Breathing Rate
  - System-wide stress management
  - Self-healing recuperation
  - Adaptive timing controls
  - Priority-based execution

## Philosophy

Cyre follows these core principles:

1. **Precision**: Accurate timing and reliable event handling
2. **Protection**: Natural rate limiting through quantum breathing
3. **Performance**: System-aware optimization and stress management
4. **Adaptability**: Self-adjusting to system conditions
5. **Predictability**: Consistent behavior with natural protection

## Origins

Originally evolved from the Quantum-Inception clock project (2016), Cyre has grown into a full-featured event management system while maintaining its quantum timing heritage. The latest evolution introduces quantum breathing for natural system protection and rate limiting.

`

## License

Distributed under the MIT license. See `LICENSE` for more information.
