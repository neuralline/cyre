// test/cyre-optimized-flow.test.ts
// Tests for optimized call-to-execution flow

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/app'
import {compileProtectionPipeline} from '../src/components/cyre-actions'
import {internalCall} from '../src/components/cyre-execute'

describe('Optimized Cyre Execution Flow', () => {
  beforeEach(() => {
    cyre.initialize()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cyre.clear()
    vi.useRealTimers()
  })

  describe('Protection Pipeline Compilation', () => {
    it('should compile empty pipeline for simple actions', () => {
      const action = {
        id: 'simple-action',
        payload: {data: 'test'}
      }

      const pipeline = compileProtectionPipeline(action)
      expect(pipeline).toHaveLength(0)
    })

    it('should compile throttle protection when configured', () => {
      const action = {
        id: 'throttled-action',
        throttle: 100
      }

      const pipeline = compileProtectionPipeline(action)
      expect(pipeline).toHaveLength(1)

      // Test throttle behavior
      const ctx = {
        action,
        payload: {},
        metrics: {lastExecutionTime: Date.now() - 50}, // 50ms ago
        timestamp: Date.now()
      }

      const result = pipeline[0](ctx)
      expect(result.pass).toBe(false)
      expect(result.reason).toContain('Throttled')
    })

    it('should compile multiple protections in correct order', () => {
      const action = {
        id: 'protected-action',
        throttle: 100,
        debounce: 200,
        detectChanges: true,
        priority: {level: 'medium'}
      }

      const pipeline = compileProtectionPipeline(action)
      expect(pipeline).toHaveLength(4) // recuperation, throttle, debounce, change detection
    })

    it('should skip recuperation check for critical actions', () => {
      const action = {
        id: 'critical-action',
        priority: {level: 'critical'},
        throttle: 100
      }

      const pipeline = compileProtectionPipeline(action)
      expect(pipeline).toHaveLength(1) // Only throttle, no recuperation
    })
  })

  describe('Execution Path Optimization', () => {
    it('should execute simple actions immediately', async () => {
      const handler = vi.fn(() => ({result: 'immediate'}))

      cyre.action({id: 'immediate-test'})
      cyre.on('immediate-test', handler)

      const result = await cyre.call('immediate-test', {test: 'data'})

      expect(result.ok).toBe(true)
      expect(handler).toHaveBeenCalledWith({test: 'data'})
      expect(result.metadata?.scheduled).toBeUndefined()
    })

    it('should handle debounced actions efficiently', async () => {
      const handler = vi.fn(() => ({result: 'debounced'}))

      cyre.action({id: 'debounce-test', debounce: 100})
      cyre.on('debounce-test', handler)

      // Multiple rapid calls
      await cyre.call('debounce-test', {count: 1})
      await cyre.call('debounce-test', {count: 2})
      await cyre.call('debounce-test', {count: 3})

      expect(handler).not.toHaveBeenCalled()

      // Advance time
      vi.advanceTimersByTime(150)
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1))
      expect(handler).toHaveBeenCalledWith({count: 3})
    })

    it('should handle scheduled actions with delay', async () => {
      const handler = vi.fn(() => ({result: 'delayed'}))

      cyre.action({
        id: 'delay-test',
        delay: 50,
        interval: 100,
        repeat: 3
      })
      cyre.on('delay-test', handler)

      const result = await cyre.call('delay-test', {test: 'delayed'})

      expect(result.ok).toBe(true)
      expect(result.metadata?.scheduled).toBe(true)
      expect(result.metadata?.delay).toBe(50)

      // First execution after delay
      vi.advanceTimersByTime(50)
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1))

      // Subsequent executions use interval
      vi.advanceTimersByTime(100)
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2))

      vi.advanceTimersByTime(100)
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(3))
    })
  })

  describe('Protection Pipeline Performance', () => {
    it('should cache compiled pipelines', async () => {
      const action = {
        id: 'cached-pipeline',
        throttle: 100,
        detectChanges: true
      }

      cyre.action(action)

      // Get action and check pipeline
      const storedAction = cyre.get('cached-pipeline')
      expect(storedAction?._protectionPipeline).toBeDefined()
      expect(storedAction?._protectionPipeline).toHaveLength(2)

      // Subsequent calls should use cached pipeline
      const handler = vi.fn(() => ({result: 'success'}))
      cyre.on('cached-pipeline', handler)

      await cyre.call('cached-pipeline', {test: 'data'})
      expect(handler).toHaveBeenCalled()
    })

    it('should handle zero-overhead simple actions', async () => {
      const handler = vi.fn(() => ({result: 'fast'}))

      cyre.action({id: 'zero-overhead'})
      cyre.on('zero-overhead', handler)

      const startTime = performance.now()
      await cyre.call('zero-overhead', {test: 'fast'})
      const endTime = performance.now()

      expect(handler).toHaveBeenCalled()
      expect(endTime - startTime).toBeLessThan(5) // Should be very fast
    })
  })

  describe('IntraLink Chain Optimization', () => {
    it('should handle chain reactions efficiently', async () => {
      const handler1 = vi.fn(() => ({
        id: 'step2',
        payload: {from: 'step1'}
      }))

      const handler2 = vi.fn(() => ({
        id: 'step3',
        payload: {from: 'step2'}
      }))

      const handler3 = vi.fn(() => ({
        result: 'complete'
      }))

      cyre.action({id: 'step1'})
      cyre.action({id: 'step2'})
      cyre.action({id: 'step3'})

      cyre.on('step1', handler1)
      cyre.on('step2', handler2)
      cyre.on('step3', handler3)

      const result = await cyre.call('step1', {start: true})

      expect(result.ok).toBe(true)
      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
      expect(handler3).toHaveBeenCalled()
      expect(result.metadata?.chainResult).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle protection failures gracefully', async () => {
      cyre.action({
        id: 'fail-protection',
        repeat: 0 // This will fail
      })

      const result = await cyre.call('fail-protection')

      expect(result.ok).toBe(false)
      expect(result.message).toContain('repeat: 0')
    })

    it('should handle handler errors efficiently', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })

      cyre.action({id: 'error-test'})
      cyre.on('error-test', errorHandler)

      const result = await cyre.call('error-test')

      expect(result.ok).toBe(false)
      expect(result.error).toContain('Handler error')
    })
  })

  describe('State Management', () => {
    it('should update payload history correctly', async () => {
      const handler = vi.fn(() => ({result: 'success'}))

      cyre.action({
        id: 'state-test',
        detectChanges: true
      })
      cyre.on('state-test', handler)

      // First call
      await cyre.call('state-test', {value: 1})
      expect(handler).toHaveBeenCalledTimes(1)

      // Same payload - should skip
      await cyre.call('state-test', {value: 1})
      expect(handler).toHaveBeenCalledTimes(1)

      // Different payload - should execute
      await cyre.call('state-test', {value: 2})
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should handle debounce state cleanup', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'debounce-cleanup',
        debounce: 100
      })
      cyre.on('debounce-cleanup', handler)

      await cyre.call('debounce-cleanup', {test: 1})

      // Forget action before debounce executes
      cyre.forget('debounce-cleanup')

      vi.advanceTimersByTime(150)

      // Handler should not be called
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
