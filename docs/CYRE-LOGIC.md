# CYRE logic and behavior Analysis

## Core Architecture

### Channel-Based Model

- **Channel ID is the Key**: Subscribe to action IDs, NOT types
- **Type is Grouping**: The `type` property is only for organization/grouping
- **One Handler per Channel**: Recommended 1:1 relationship between channels and handlers
- **Handler Replacement**: New subscriptions to same ID replace previous handlers
- **Independent Timers**: Different action IDs maintain separate interval timers

## Timing Behavior (v4.0.0 Logic)

### Interval Actions

- **First execution WAITS for the interval**: Aligns with `setInterval` behavior
- **No immediate execution**: Actions with intervals wait before first execution
- **Subsequent executions**: Follow the specified interval timing
- **Queue behavior**: Multiple calls to same action ID queue, don't run in parallel

### Delay Actions

- **First execution WAITS for delay**: Even `delay: 0` waits 0ms (not immediate)
- **Overwrites interval**: When both delay and interval specified, delay controls first wait
- **Single execution default**: Delay actions execute once unless repeat specified

### Repeat Handling

- **Total execution count**: `repeat: 3` = Execute exactly 3 times total
- **Proper decrementing**: System decrements repeat count to avoid infinite loops
- **Boolean infinite**: `repeat: true` or `repeat: Infinity` = infinite repeats
- **Zero means none**: `repeat: 0` = Do not execute at all (action registered but not executed)

### Combined Timing Logic

- **Delay + Interval**: Delay applies first, then interval timing for subsequent executions
- **Priority order**: Delay (if specified) → Interval → Default behavior
- **No immediate executions**: Both interval and delay actions wait before execution

### Edge Cases

- **`{ repeat: 0 }`**: Do not execute at all, return success with message
- **`{ repeat: 1, interval: 1000 }`**: Wait 1000ms, execute once, done
- **`{ delay: 0 }`**: Wait 0ms then execute (after event loop tick)
- **`{ delay: 500, interval: 1000, repeat: 3 }`**: Wait 500ms → Execute → Wait 1000ms → Execute → Wait 1000ms → Execute

## Protection Mechanisms

### Throttle Protection

- **Industry standard**: First call always executes immediately
- **Rate limiting**: Subsequent calls within throttle interval are rejected
- **Timer-based**: Throttle interval starts from last successful execution
- **Execution order**: Applied before debounce in protection pipeline

### Debounce Protection

- **Call collapsing**: Multiple rapid calls collapse to single execution
- **Timer reset**: New calls reset the debounce timer
- **Last payload wins**: Uses most recent payload when timer expires
- **Execution order**: Applied after throttle in protection pipeline

### Change Detection

- **Deep comparison**: Uses deep equality to compare payloads
- **Previous payload storage**: Stores last payload for comparison
- **Skip execution**: Identical payloads result in skipped execution
- **First call executes**: No previous payload means change detected

### Protection Pipeline Order

1. **System recuperation check**: Blocks non-critical actions during stress
2. **Repeat: 0 check**: Prevents execution if repeat is 0
3. **Throttle check**: Rate limiting based on last execution time
4. **Debounce application**: Call collapsing with timer
5. **Change detection check**: Payload comparison
6. **Middleware processing**: Custom transformation/validation

## Quantum Breathing System

### Stress Detection

- **Multi-factor stress**: CPU, memory, event loop lag, call rate
- **Graduated response**: Proportional adaptation to stress levels
- **Threshold-based**: Different behaviors at LOW/MEDIUM/HIGH/CRITICAL stress levels
- **Self-monitoring**: Continuous system health assessment

### Breathing Rate Adaptation

- **Base rate**: 200ms default breathing interval
- **Stress-responsive**: Rate increases with system stress
- **Range limits**: 50ms minimum, 2000ms maximum recovery rate
- **Pattern switching**: NORMAL → RECOVERY patterns based on stress

### Recuperation Mode

- **Critical-only execution**: Only critical priority actions during high stress
- **Automatic recovery**: System returns to normal when stress subsides
- **Priority-based filtering**: Actions filtered by priority level during stress
- **Self-healing**: Gradual return to normal operation

### Breathing Patterns

- **NORMAL pattern**: Standard operation (1:1:0.5 in/out/hold ratio)
- **RECOVERY pattern**: Stress response (2:2:1 in/out/hold ratio)
- **Pattern transitions**: Automatic switching based on stress thresholds

## Action Lifecycle

### Registration Phase

- **Action creation**: `cyre.action()` registers configuration
- **Update behavior**: Multiple calls to same ID update configuration
- **Validation**: Data definitions validate action properties
- **Storage**: Actions stored in centralized state management

### Subscription Phase

- **Handler registration**: `cyre.on()` links handlers to action IDs
- **Duplicate handling**: New handlers replace previous ones for same ID
- **Unsubscribe capability**: Cleanup functions for subscription management
- **Array subscriptions**: Batch registration of multiple handlers

### Execution Phase

- **Call initiation**: `cyre.call()` triggers action pipeline
- **Protection processing**: All protection mechanisms applied in sequence
- **Handler execution**: User-defined handler function called
- **Chain processing**: IntraLink support for action chaining
- **History recording**: Execution details stored for analysis

### Cleanup Phase

- **Individual removal**: `cyre.forget()` removes specific actions
- **Complete reset**: `cyre.clear()` removes all actions and state
- **Timer cleanup**: All associated timers and intervals cleared
- **Memory management**: Proper cleanup to prevent memory leaks

## Middleware System

### Registration

- **Unique IDs**: Each middleware has unique identifier
- **Function-based**: Middleware are async functions
- **Global scope**: Middleware available to all actions
- **Order processing**: Applied in sequence specified in action config

### Execution

- **Pipeline integration**: Middleware applied in protection pipeline
- **Transformation capability**: Can modify action and payload
- **Rejection capability**: Return null to reject action
- **Async support**: Full Promise-based processing

### Error Handling

- **Graceful degradation**: Middleware errors don't crash system
- **Rejection tracking**: Failed middleware calls tracked in metrics
- **Logging integration**: Errors logged through Cyre's logging system

## Chain Reactions (IntraLinks)

### Trigger Mechanism

- **Return object**: Handler returns `{ id: string, payload?: any }`
- **Automatic processing**: System automatically processes chain links
- **Proper history**: Chain executions recorded in history
- **Error isolation**: Chain failures don't affect original call

### Chain Behavior

- **Sequential processing**: Chain links processed in order
- **Recursive support**: Chains can trigger further chains
- **Payload passing**: Data flows through chain links
- **Independent execution**: Each link executes with full protection pipeline

## Error Handling

### Handler Errors

- **Graceful capture**: Exceptions in handlers captured and logged
- **Metrics tracking**: Error counts tracked per action
- **State preservation**: Errors don't corrupt system state
- **Response formatting**: Consistent error response format

### System Errors

- **Recovery mechanisms**: System continues operation despite individual failures
- **Isolation**: Errors in one action don't affect others
- **Logging integration**: Comprehensive error logging
- **Metrics collection**: Error rates tracked for analysis

## Performance and Metrics

### Execution Tracking

- **Detailed timing**: Pipeline overhead vs listener execution separated
- **Performance categories**: FAST, NORMAL, SLOW, VERY_SLOW, CRITICAL
- **Percentile tracking**: 95th percentile execution times
- **History limits**: Configurable history retention

### Optimization Insights

- **Automatic analysis**: System identifies performance bottlenecks
- **Threshold-based warnings**: Alerts for slow listeners or pipeline overhead
- **Suggestions**: Automated optimization recommendations
- **Trend analysis**: Performance degradation detection

### Resource Management

- **Memory limits**: Configurable limits on history and metrics storage
- **Cleanup strategies**: Automatic cleanup of old data
- **Formation tracking**: Active timer/interval monitoring
- **System health**: Comprehensive health metrics

## State Management

### Data Persistence

- **In-memory storage**: All state stored in memory during session
- **No browser storage**: localStorage/sessionStorage not supported in artifacts
- **Cleanup on shutdown**: Proper cleanup when system shuts down

### State Isolation

- **Action independence**: Actions don't interfere with each other
- **Instance separation**: Multiple Cyre instances remain isolated
- **Thread safety**: Proper concurrency handling

## Hook System (useCyre)

### Channel Creation

- **Auto-initialization**: Channels initialize automatically unless disabled
- **Unique IDs**: Each hook instance gets unique channel ID
- **Configuration inheritance**: Options passed to underlying action
- **Cleanup integration**: Automatic cleanup on component unmount

### React Integration

- **Component lifecycle**: Proper integration with React component lifecycle
- **State management**: Compatible with React state patterns
- **Effect cleanup**: Proper useEffect cleanup patterns
- **Rerender optimization**: Minimal rerender impact

### Composition Support

- **cyreCompose**: Combine multiple channels into single interface
- **Error handling**: Configurable error propagation in compositions
- **Parallel execution**: Channels execute concurrently in compositions
- **Result aggregation**: Combined results from all channels

## Expected Developer Patterns

### Basic Usage

```typescript
// 1. Register action
cyre.action({id: 'my-action', payload: {initial: true}})

// 2. Subscribe with ID (not type!)
cyre.on('my-action', payload => ({processed: true}))

// 3. Trigger action
cyre.call('my-action', {data: 'new'})
```

### Timing Patterns

```typescript
// Interval with delay override
cyre.action({
  id: 'mixed-timing',
  delay: 500, // Initial wait
  interval: 1000, // Subsequent waits
  repeat: 3 // Total executions
})
// Timeline: Wait 500ms → Execute → Wait 1000ms → Execute → Wait 1000ms → Execute
```

### Protection Patterns

```typescript
// Combined protection
cyre.action({
  id: 'protected',
  throttle: 100, // Max 1 per 100ms
  debounce: 50, // Collapse calls within 50ms
  detectChanges: true // Skip identical payloads
})
```

### Chain Patterns

```typescript
// Chain reaction
cyre.on('step1', payload => ({
  id: 'step2', // Next action ID
  payload: {...payload, processed: true}
}))
```

This comprehensive analysis covers Cyre's core behaviors, edge cases, and expected usage patterns based on the documentation, tests, and implementation.
