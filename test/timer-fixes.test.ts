// test/working-timer.test.ts
// Simplified working timer test

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {TimeKeeper} from '../src/components/cyre-timekeeper'

describe('Working Timer Implementation', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    await cyre.init()
    cyre.clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    cyre.clear()
    TimeKeeper.reset()
  })

  test('should execute simple timer correctly', async () => {
    const callback = vi.fn()

    const result = TimeKeeper.keep(1000, callback, 1, 'simple-timer')

    expect(result.kind).toBe('ok')
    expect(callback).not.toHaveBeenCalled()

    // Fast forward time
    vi.advanceTimersByTime(1000)

    expect(callback).toHaveBeenCalledTimes(1)

    // Should not execute again since repeat is 1
    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  test('should handle manual interval implementation', async () => {
    const results: number[] = []
    let executionCount = 0
    const maxExecutions = 3

    const intervalFunction = () => {
      executionCount++
      results.push(executionCount)

      if (executionCount < maxExecutions) {
        // Schedule next execution
        setTimeout(intervalFunction, 1000)
      }
    }

    // Start the interval
    setTimeout(intervalFunction, 1000)

    // First execution
    vi.advanceTimersByTime(1000)
    expect(results).toEqual([1])

    // Second execution
    vi.advanceTimersByTime(1000)
    expect(results).toEqual([1, 2])

    // Third execution
    vi.advanceTimersByTime(1000)
    expect(results).toEqual([1, 2, 3])

    // No more executions
    vi.advanceTimersByTime(1000)
    expect(results).toEqual([1, 2, 3])
  })

  test('should test setTimeout behavior', async () => {
    const timeoutResults: string[] = []

    setTimeout(() => {
      timeoutResults.push('first')
    }, 100)

    setTimeout(() => {
      timeoutResults.push('second')
    }, 200)

    setTimeout(() => {
      timeoutResults.push('third')
    }, 300)

    // Check initial state
    expect(timeoutResults).toEqual([])

    // After 100ms
    vi.advanceTimersByTime(100)
    expect(timeoutResults).toEqual(['first'])

    // After 200ms total
    vi.advanceTimersByTime(100)
    expect(timeoutResults).toEqual(['first', 'second'])

    // After 300ms total
    vi.advanceTimersByTime(100)
    expect(timeoutResults).toEqual(['first', 'second', 'third'])
  })

  test('should handle void return values correctly', async () => {
    let executed = false

    const voidFunction = (): void => {
      executed = true
      // Explicitly return void
      return
    }

    setTimeout(voidFunction, 100)

    expect(executed).toBe(false)

    vi.advanceTimersByTime(100)

    expect(executed).toBe(true)
  })

  test('should work with Cyre action creation', async () => {
    const result = cyre.action({
      id: 'priority-test',
      type: 'stream',
      priority: {level: 'medium'},
      payload: null
    })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('registered')

    const action = cyre.get('priority-test')
    expect(action).toBeDefined()
    expect(action?.id).toBe('priority-test')
    expect(action?.type).toBe('stream')
  })

  test('should handle simple Cyre interval action', async () => {
    const executionResults: number[] = []

    // Create action with interval
    cyre.action({
      id: 'interval-test',
      interval: 500,
      repeat: 2
    })

    // Subscribe to action
    cyre.on('interval-test', () => {
      executionResults.push(Date.now())
    })

    // Call the action to start it
    const callResult = await cyre.call('interval-test')
    expect(callResult.ok).toBe(true)

    // First execution after interval
    vi.advanceTimersByTime(500)
    expect(executionResults).toHaveLength(1)

    // Second execution after another interval
    vi.advanceTimersByTime(500)
    expect(executionResults).toHaveLength(2)

    // No more executions since repeat was 2
    vi.advanceTimersByTime(500)
    expect(executionResults).toHaveLength(2)
  })
})
