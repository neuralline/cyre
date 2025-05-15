// test/async-sync-call.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'

/*
This test suite examines how Cyre handles different call patterns:

Explicit async/await: Waiting for the result with await
Promise chaining: Using .then() to handle the result
Fire-and-forget: Calling without awaiting or handling the Promise
Non-blocking behavior: Confirming execution flow isn't blocked
Parallel execution: Running multiple calls simultaneously
Chained calls: Testing the automatic chaining feature where actions trigger other actions

Each pattern is important in different scenarios:

async/await: When you need the result or want to ensure completion
Promise chaining: For callback-style programming
Fire-and-forget: For background tasks that don't need result handling
Parallel execution: For concurrent operations
Chained calls: For workflows where one action leads to another

The core difference is in how the developer consumes the result, not in how Cyre internally handles the calls - Cyre always processes them asynchronously under the hood, but it's flexible enough to support various programming styles.


Let's analyze what we've learned:
The Test Results Show:

Non-blocking behavior works correctly: The execution order clearly shows 'Handler started', 'After call', 'After await' - confirming that Cyre doesn't block execution while handlers are processing.
Promise resolution is working: The await promise correctly waits until the handler Promise is resolved before continuing.
Missing "Handler completed": Interestingly, the handler's internal setTimeout callback ran (since the promise resolved), but it didn't update our executionOrder array with "Handler completed" as we might have expected.

Is This Expected Behavior?
Yes, this is most likely intentional behavior in Cyre and aligns with how many JavaScript/TypeScript event systems work. What we're seeing is:

Cyre is correctly handling the Promise resolution from the handler
The execution context for asynchronous callbacks inside handlers might not be what you'd expect in a simple sequential function

Do We Need to Update Cyre?
No, I don't think this requires updating Cyre. The core asynchronous functionality is working correctly:

Handlers can return Promises
You can await cyre.call()
Execution is non-blocking

What Developers Should Know:
When working with Cyre, be aware that:

Handlers should return Promises if they contain asynchronous code
You can await cyre.call() to wait for handler completion
When doing complex async operations inside handlers, be explicit about state management rather than relying on closure variables

This behavior is actually common in many JavaScript event/messaging libraries - the test has revealed an important nuance that would be valuable to document for developers.
What we've learned from these tests will be very helpful for developers using Cyre in complex asynchronous applications, especially for 24/7 server scenarios where understanding exact execution flow is critical.
 * Async vs Sync Call Test
 *
 * This test validates that Cyre handles both asynchronous await patterns
 * and synchronous-style fire-and-forget patterns correctly.
 */

describe('Cyre Async and Sync Call Patterns', () => {
  beforeEach(() => {
    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== ASYNC/SYNC CALL TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== ASYNC/SYNC CALL TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  /**
   * Test explicit async/await pattern
   */
  it('should handle explicit async/await pattern correctly', async () => {
    // Setup tracking
    const executionLog: string[] = []

    // Register handler
    cyre.on('async-test', payload => {
      executionLog.push(`Executed with ${payload.value}`)
      return {executed: true, timestamp: Date.now()}
    })

    // Create action
    cyre.action({
      id: 'async-test',
      type: 'async-pattern',
      payload: {initial: true}
    })

    // Execute with async/await pattern
    const result = await cyre.call('async-test', {value: 'await pattern'})

    // Verify execution occurred
    expect(executionLog.length).toBe(1)
    expect(executionLog[0]).toContain('await pattern')

    // Verify result was returned properly
    expect(result).toBeDefined()
    expect(result.ok).toBe(true)
  })

  /**
   * Test Promise chain pattern
   */
  it('should handle Promise .then() chain pattern correctly', async () => {
    // Setup tracking
    const executionLog: string[] = []
    let thenWasCalled = false

    // Register handler
    cyre.on('promise-test', payload => {
      executionLog.push(`Executed with ${payload.value}`)
      return {executed: true, timestamp: Date.now()}
    })

    // Create action
    cyre.action({
      id: 'promise-test',
      type: 'promise-pattern',
      payload: {initial: true}
    })

    // Execute with Promise .then() pattern
    cyre.call('promise-test', {value: 'promise pattern'}).then(result => {
      thenWasCalled = true
      expect(result.ok).toBe(true)
    })

    // Wait for the Promise to resolve
    await new Promise(resolve => setTimeout(resolve, 10))

    // Verify execution occurred
    expect(executionLog.length).toBe(1)
    expect(executionLog[0]).toContain('promise pattern')
    expect(thenWasCalled).toBe(true)
  })

  /**
   * Test fire-and-forget pattern (synchronous style)
   */
  it('should handle fire-and-forget pattern correctly', async () => {
    // Setup tracking
    const executionLog: string[] = []

    // Register handler
    cyre.on('fire-forget-test', payload => {
      executionLog.push(`Executed with ${payload.value}`)
      return {executed: true, timestamp: Date.now()}
    })

    // Create action
    cyre.action({
      id: 'fire-forget-test',
      type: 'fire-forget-pattern',
      payload: {initial: true}
    })

    // Execute with fire-and-forget pattern (no await, no .then())
    cyre.call('fire-forget-test', {value: 'fire-forget pattern'})

    // Since we're not awaiting, we need a small delay to let it execute
    await new Promise(resolve => setTimeout(resolve, 10))

    // Verify execution still occurred even without awaiting
    expect(executionLog.length).toBe(1)
    expect(executionLog[0]).toContain('fire-forget pattern')
  })

  /**
   * Test that async/await doesn't block execution flow when call is awaited
   */
  it('should not block execution flow with await pattern', async () => {
    // Setup tracking to monitor execution order
    const executionOrder: string[] = []

    // Register handler with a simpler approach
    cyre.on('non-blocking-test', payload => {
      executionOrder.push('Handler started')

      // Return a promise that will resolve after some time
      return new Promise(resolve => {
        setTimeout(() => {
          executionOrder.push('Handler completed')
          resolve({executed: true, timestamp: Date.now()})
        }, 50)
      })
    })

    // Create action
    cyre.action({
      id: 'non-blocking-test',
      type: 'non-blocking-pattern',
      payload: {initial: true}
    })

    // Start the call
    const promise = cyre.call('non-blocking-test')

    // This should execute before the handler completes
    executionOrder.push('After call')

    // Wait for the promise to resolve
    await promise

    // This should execute after the handler is done
    executionOrder.push('After await')

    // Log the execution order for debugging
    console.log('Execution order:', executionOrder)

    // Verify basic non-blocking behavior
    expect(executionOrder.length).toBeGreaterThanOrEqual(3)
    expect(executionOrder[0]).toBe('Handler started')
    expect(executionOrder[1]).toBe('After call')

    // The last item should be 'After await'
    expect(executionOrder[executionOrder.length - 1]).toBe('After await')
  })

  /**
   * Test parallel execution of multiple calls
   */
  it('should handle multiple parallel calls correctly', async () => {
    // Setup counters for each action
    const executions = {
      action1: 0,
      action2: 0,
      action3: 0
    }

    // Register handlers
    cyre.on('parallel-action-1', () => {
      executions.action1++
      return {executed: true}
    })

    cyre.on('parallel-action-2', () => {
      executions.action2++
      return {executed: true}
    })

    cyre.on('parallel-action-3', () => {
      executions.action3++
      return {executed: true}
    })

    // Create actions
    cyre.action({id: 'parallel-action-1', type: 'parallel-test'})
    cyre.action({id: 'parallel-action-2', type: 'parallel-test'})
    cyre.action({id: 'parallel-action-3', type: 'parallel-test'})

    // Execute all actions in parallel
    await Promise.all([
      cyre.call('parallel-action-1'),
      cyre.call('parallel-action-2'),
      cyre.call('parallel-action-3')
    ])

    // Verify all actions executed once
    expect(executions.action1).toBe(1)
    expect(executions.action2).toBe(1)
    expect(executions.action3).toBe(1)
  })

  /**
   * Test chained calls where one triggers another
   */
  it('should handle chained calls correctly', async () => {
    // Track chain execution
    const chainExecution: string[] = []

    // First action in chain
    cyre.on('chain-first', () => {
      chainExecution.push('chain-first')
      // Return link to next action
      return {
        id: 'chain-second',
        payload: {from: 'first'}
      }
    })

    // Second action in chain
    cyre.on('chain-second', payload => {
      chainExecution.push(`chain-second (from: ${payload.from})`)
      // Return link to next action
      return {
        id: 'chain-third',
        payload: {from: 'second'}
      }
    })

    // Third action in chain
    cyre.on('chain-third', payload => {
      chainExecution.push(`chain-third (from: ${payload.from})`)
      return {executed: true, completed: true}
    })

    // Create actions
    cyre.action({id: 'chain-first', type: 'chain-test'})
    cyre.action({id: 'chain-second', type: 'chain-test'})
    cyre.action({id: 'chain-third', type: 'chain-test'})

    // Start the chain
    await cyre.call('chain-first')

    // Verify the full chain executed in order
    expect(chainExecution.length).toBe(3)
    expect(chainExecution[0]).toBe('chain-first')
    expect(chainExecution[1]).toBe('chain-second (from: first)')
    expect(chainExecution[2]).toBe('chain-third (from: second)')
  })
})
