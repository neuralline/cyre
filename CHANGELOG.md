# Changelog

## 4.0.0 (2025-05-18)

### Breaking Changes

#### TimeKeeper Overhaul

- **Interval Timing Precision**: First execution now waits for the interval instead of executing immediately

  - Aligns with JavaScript's native timing behavior for more intuitive mental model
  - Creates predictable rhythmic execution patterns for better system orchestration

- **Execution Counting Redefined**: `repeat` now specifies the TOTAL number of executions

  - `repeat: 3` means execute exactly 3 times total (previously could yield 4 executions)
  - `repeat: 1` means execute exactly once after the initial wait
  - `repeat: 0` means register but do not execute (new behavior)
  - `repeat: true` means execute infinitely with proper interval timing

- **Intelligent Wait Sequencing**: Delay acts as initial wait, then intervals take over
  - `{delay: 500, interval: 1000, repeat: 3}` = Wait 500ms → execute → wait 1000ms → execute → wait 1000ms → execute
  - Provides fine-grained timing control while maintaining predictable execution patterns

#### Breathing System Enhancement

- **Dynamic Stress Adaptation**: Intervals automatically adjust based on system stress
- **Self-Healing Recovery**: New recuperation logic for high-stress scenarios
- **Predictive Timing**: Intelligent wait time calculations based on system load

### Features

- **Chain Reaction Architecture**: Improved flow control through action-reaction sequences
- **Surge Protection**: Advanced throttling with exponential backoff
- **State Change Detection**: Improved payload comparison for optimal execution
- **Cross-Platform Synchronization**: Consistent behavior across Node.js and Browser environments

### Improvements

- **Documentation**: Comprehensive API documentation and timing behavior guides
- **Type Safety**: Enhanced TypeScript definitions for better developer experience
- **Test Coverage**: Comprehensive test suite for all timing behaviors
- **Performance**: Reduced overhead for action scheduling and execution

### Bug Fixes

- Fixed inconsistent timing behavior for interval actions
- Fixed issues with repeat counting and execution tracking
- Resolved race conditions in action queue management
- Fixed edge cases with combined timing properties

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

New approach (v4.0):

```typescript
// For immediate first execution:
cyre.action({
  id: 'interval-action',
  delay: 0, // Execute immediately
  interval: 5000, // Then every 5 seconds
  repeat: true
})
```

# Updated README.md Core Features Section

## Core Features

### Chain Reaction Architecture

- **Neural Reactive Network**: Actions flow through protected channels creating self-organizing systems
- **Automatic Chain Repair**: Failures in one link don't break the entire chain
- **intraLink Propagation**: Data flows seamlessly between connected actions
- **Cascading Protection**: Multiple defense layers prevent runaway reactions

### TimeKeeper & Breathing System

- **Breathing-Based Protection**: Natural rate limiting through biologically-inspired patterns
- **System-Aware Recovery**: Enters recuperation mode during high stress
- **Self-Healing Architecture**: Automatic recovery from system overload
- **Predictive Timing**: Adjusts execution schedules based on observed system patterns
- **Precision**: High-accuracy timing even for extremely long durations

### Intelligent State Management

- **Change Detection**: Prevents unnecessary updates, optimizing resource usage
- **State Synchronization**: Keeps distributed systems in harmony
- **State Mutation Protection**: Guards against harmful state corruption
- **Historical State Tracking**: Maintains record for metrics and rollback

### Advanced Protection Mechanisms

- **Layered Defense**: Multiple protection strategies working in concert
- **Circuit Breaker Pattern**: Prevents cascading failures under load
- **Surge Protection**: Intelligent throttling with adaptive backoff
- **Priority-Based Execution**: Critical actions take precedence during stress

### Performance Optimization

- **Stress-Aware Scheduling**: Dynamically balances workload based on system metrics
- **Resource-Conscious Execution**: Only runs when necessary (change detection)
- **Execution Metrics**: Built-in performance tracking
- **Cross-Platform Optimization**: Specialized for both Node.js and Browser environments
