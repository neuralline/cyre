// test/system-flags.test.ts
// Test pre-computed system flags for hot path optimization

import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {metricsState} from '../src/context/metrics-state'

describe('System Flags - Pre-computed State Checks', () => {
  beforeEach(async () => {
    // Reset system before each test
    cyre.reset()
  })

  afterEach(() => {
    // Clean up after each test
    cyre.reset()
  })

  describe('canCall() flag', () => {
    it('should return false when system is not initialized', () => {
      const {allowed, messages} = metricsState.canCall()
      expect(allowed).toBe(false)
      expect(messages).toContain('System not initialized')
    })

    it('should return false when system is shutdown', async () => {
      await cyre.init()
      cyre.shutdown()

      const {allowed, messages} = metricsState.canCall()
      expect(allowed).toBe(false)
      expect(messages).toContain('System is shutdown')
    })

    it('should return false when system is in recuperation mode', async () => {
      await cyre.init()

      // Simulate high stress to trigger recuperation
      metricsState.updateBreathingState({
        cpu: 95,
        memory: 90,
        eventLoop: 1000,
        isOverloaded: true
      })

      const {allowed, messages} = metricsState.canCall()
      expect(allowed).toBe(false)
      expect(messages).toContain('System is in recuperation mode')
    })

    it('should return true when system is healthy', async () => {
      await cyre.init()

      const {allowed, messages} = metricsState.canCall()
      expect(allowed).toBe(true)
      expect(messages).toHaveLength(0)
    })
  })

  describe('canAction() flag', () => {
    it('should return false when system is not initialized', () => {
      const {allowed, messages} = metricsState.canAction()
      expect(allowed).toBe(false)
      expect(messages).toContain('System not initialized')
    })

    it('should return false when system is locked', async () => {
      await cyre.init()
      cyre.lock()

      const {allowed, messages} = metricsState.canAction()
      expect(allowed).toBe(false)
      expect(messages).toContain('System is locked')
    })

    it('should return false when system is shutdown', async () => {
      await cyre.init()
      cyre.shutdown()

      const {allowed, messages} = metricsState.canAction()
      expect(allowed).toBe(false)
      expect(messages).toContain('System is shutdown')
    })

    it('should return true when system is healthy and unlocked', async () => {
      await cyre.init()

      const {allowed, messages} = metricsState.canAction()
      expect(allowed).toBe(true)
      expect(messages).toHaveLength(0)
    })
  })

  describe('isOperational() flag', () => {
    it('should return false when system is not initialized', () => {
      const {operational, messages} = metricsState.isOperational()
      expect(operational).toBe(false)
      expect(messages).toContain('System not initialized')
    })

    it('should return false when system is locked', async () => {
      await cyre.init()
      cyre.lock()

      const {operational, messages} = metricsState.isOperational()
      expect(operational).toBe(false)
      expect(messages).toContain('System is locked')
    })

    it('should return false when system is in recuperation mode', async () => {
      await cyre.init()

      // Simulate high stress to trigger recuperation
      metricsState.updateBreathingState({
        cpu: 95,
        memory: 90,
        eventLoop: 1000,
        isOverloaded: true
      })

      const {operational, messages} = metricsState.isOperational()
      expect(operational).toBe(false)
      expect(messages).toContain('System is in recuperation mode')
    })

    it('should return true when system is fully operational', async () => {
      await cyre.init()

      const {operational, messages} = metricsState.isOperational()
      expect(operational).toBe(true)
      expect(messages).toHaveLength(0)
    })
  })

  describe('Hot path integration', () => {
    it('should block action() when system is locked', async () => {
      await cyre.init()
      cyre.lock()

      const result = cyre.action({id: 'test-action', payload: 'test'})
      expect(result.ok).toBe(false)
      expect(result.message).toContain('System is locked')
    })

    it('should block call() when system is not initialized', async () => {
      const result = await cyre.call('test-action')
      expect(result.ok).toBe(false)
      expect(result.message).toContain('System not initialized')
    })

    it('should block on() when system is locked', async () => {
      await cyre.init()
      cyre.lock()

      const result = await cyre.on('test-action', () => {})
      expect(result.ok).toBe(false)
      expect(result.message).toContain('System is locked')
    })

    it('should allow critical calls during recuperation', async () => {
      await cyre.init()

      // Create a critical action
      cyre.action({
        id: 'critical-action',
        payload: 'critical',
        priority: {level: 'critical'}
      })

      // Simulate recuperation mode
      metricsState.updateBreathingState({
        cpu: 95,
        memory: 90,
        eventLoop: 1000,
        isOverloaded: true
      })

      // Critical calls should still work
      const result = await cyre.call('critical-action')
      expect(result.ok).toBe(true)
    })
  })

  describe('Flag recomputation', () => {
    it('should recompute flags when system state changes', async () => {
      await cyre.init()

      // Initially operational
      expect(metricsState.isOperational().operational).toBe(true)

      // Lock system
      cyre.lock()

      // Should now be non-operational
      expect(metricsState.isOperational().operational).toBe(false)
      expect(metricsState.isOperational().messages).toContain(
        'System is locked'
      )

      // Unlock system
      metricsState.unlock()

      // Should be operational again
      expect(metricsState.isOperational().operational).toBe(true)
    })

    it('should update flags when breathing state changes', async () => {
      await cyre.init()

      // Initially can call
      expect(metricsState.canCall().allowed).toBe(true)

      // Enter recuperation mode
      metricsState.updateBreathingState({
        cpu: 95,
        memory: 90,
        eventLoop: 1000,
        isOverloaded: true
      })

      // Should not be able to call
      expect(metricsState.canCall().allowed).toBe(false)
      expect(metricsState.canCall().messages).toContain(
        'System is in recuperation mode'
      )
    })
  })
})
