// src/schema/talent-definitions.test.ts

import {describe, it, expect, vi, beforeEach} from 'vitest'
import {debounce} from './talent-definitions'
import {IO, ActionPayload} from '../types/core'
import {TimeKeeper} from '../components/cyre-timekeeper' // Adjust path if necessary
import {sensor} from '../context/metrics-report' // Adjust path if necessary

// Mock external dependencies
vi.mock('../components/cyre-timekeeper')
vi.mock('../context/metrics-report')

describe('debounce talent', () => {
  let mockAction: IO
  let mockPayload: ActionPayload

  beforeEach(() => {
    // Reset mocks and create a fresh action/payload for each test
    vi.resetAllMocks()
    mockAction = {
      id: 'test-action',
      type: 'test/action',
      payload: {}, // Default empty payload
      _hasFastPath: false,
      _hasProtections: false,
      _hasProcessing: false,
      _hasScheduling: false,
      _isBlocked: false,
      _blockReason: undefined,
      _isScheduled: false,
      _debounceTimer: undefined, // Ensure initial state is clean
      _firstDebounceCall: undefined // Ensure initial state is clean
    }
    mockPayload = {data: 'test'}
  })

  it('should return ok: true if debounce is not configured', () => {
    mockAction.debounce = 0
    const result = debounce(mockAction, mockPayload)
    expect(result.ok).toBe(true)
    expect(TimeKeeper.keep).not.toHaveBeenCalled()
    expect(sensor.log).not.toHaveBeenCalled()
  })

  it('should return ok: true if _bypassDebounce is true', () => {
    mockAction.debounce = 100
    mockAction._bypassDebounce = true
    const result = debounce(mockAction, mockPayload)
    expect(result.ok).toBe(true)
    expect(TimeKeeper.keep).not.toHaveBeenCalled()
    expect(sensor.log).not.toHaveBeenCalled()
  })

  it('should schedule execution and return ok: false for standard debounce', () => {
    mockAction.debounce = 200
    vi.spyOn(TimeKeeper, 'keep').mockReturnValue({
      kind: 'ok',
      value: {
        id: 'timer-id',
        startTime: Date.now(),
        duration: 200,
        originalDuration: 200,
        callback: vi.fn(),
        repeat: 1,
        executionCount: 0,
        lastExecutionTime: 0,
        nextExecutionTime: Date.now() + 200,
        isInRecuperation: false,
        status: 'active',
        isActive: true,
        delay: undefined,
        interval: 200,
        hasExecutedOnce: false,
        metrics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          averageExecutionTime: 0,
          lastExecutionTime: 0,
          longestExecutionTime: 0,
          shortestExecutionTime: Infinity,
          missedExecutions: 0,
          surgeProtection: {
            totalDelays: 0,
            totalDelayTime: 0,
            averageDelay: 0,
            lastDelay: 0
          }
        }
      }
    })

    const result = debounce(mockAction, mockPayload)

    expect(result.ok).toBe(false)
    expect(result.message).toBe('Debounced - will execute in 200ms')
    expect(result.delay).toBe(200)
    expect(TimeKeeper.keep).toHaveBeenCalledWith(
      200,
      expect.any(Function),
      1,
      mockAction.id,
      undefined
    )
    expect(sensor.log).toHaveBeenCalledWith(
      mockAction.id,
      'debounce',
      'talent-debounce',
      {
        debounceMs: 200,
        maxWait: undefined,
        firstCallTime: expect.any(Number) // Check if firstCallTime is set
      }
    )
    expect(mockAction._debounceTimer).toBe('timer-id')
    expect(mockAction._firstDebounceCall).toBeDefined()
  })

  it('should clear existing timer before scheduling a new one', () => {
    mockAction.debounce = 200
    mockAction._debounceTimer = 'existing-timer-id'
    vi.spyOn(TimeKeeper, 'keep').mockReturnValue({
      kind: 'ok',
      value: {
        id: 'new-timer-id',
        startTime: Date.now(),
        duration: 200,
        originalDuration: 200,
        callback: vi.fn(),
        repeat: 1,
        executionCount: 0,
        lastExecutionTime: 0,
        nextExecutionTime: Date.now() + 200,
        isInRecuperation: false,
        status: 'active',
        isActive: true,
        delay: undefined,
        interval: 200,
        hasExecutedOnce: false,
        metrics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          averageExecutionTime: 0,
          lastExecutionTime: 0,
          longestExecutionTime: 0,
          shortestExecutionTime: Infinity,
          missedExecutions: 0,
          surgeProtection: {
            totalDelays: 0,
            totalDelayTime: 0,
            averageDelay: 0,
            lastDelay: 0
          }
        }
      }
    })
    vi.spyOn(TimeKeeper, 'forget')

    debounce(mockAction, mockPayload)

    expect(TimeKeeper.forget).toHaveBeenCalledWith('existing-timer-id')
    expect(TimeKeeper.keep).toHaveBeenCalledWith(
      200,
      expect.any(Function),
      1,
      mockAction.id,
      undefined
    )
    expect(mockAction._debounceTimer).toBe('new-timer-id')
  })

  it('should execute immediately and reset state if maxWait is exceeded', () => {
    mockAction.debounce = 100
    mockAction.maxWait = 500
    mockAction._firstDebounceCall = Date.now() - 600 // Simulate maxWait exceeded
    mockAction._debounceTimer = 'existing-timer-id'
    vi.spyOn(TimeKeeper, 'forget')

    const result = debounce(mockAction, mockPayload)

    expect(result.ok).toBe(true)
    expect(TimeKeeper.forget).toHaveBeenCalledWith('existing-timer-id')
    expect(TimeKeeper.keep).not.toHaveBeenCalled()
    expect(mockAction._debounceTimer).toBeUndefined()
    expect(mockAction._firstDebounceCall).toBeUndefined()
    expect(sensor.log).toHaveBeenCalledWith(
      mockAction.id,
      'debounce',
      'talent-debounce',
      {
        debounceMs: 100,
        maxWait: 500,
        firstCallTime: expect.any(Number) // Should still log the old firstCallTime before reset
      }
    )
  })

  // TODO: Add test for TimeKeeper.keep error case if necessary
})
