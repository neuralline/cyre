// test/flag-updates.test.ts
// Test that flags are properly updated when system state changes

import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {metricsState} from '../src/context/metrics-state'

describe('Flag Updates - System State Changes', () => {
  beforeEach(async () => {
    cyre.reset()
  })

  afterEach(() => {
    cyre.reset()
  })

  describe('cyre.init() updates flags', () => {
    it('should update flags when cyre.init() is called', async () => {
      // Initially not initialized
      expect(metricsState.canCall().allowed).toBe(false)
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.isOperational().operational).toBe(false)

      // Initialize system
      await cyre.init()

      // Should now be operational
      expect(metricsState.canCall().allowed).toBe(true)
      expect(metricsState.canRegister().allowed).toBe(true)
      expect(metricsState.isOperational().operational).toBe(true)
    })
  })

  describe('cyre.lock() updates flags', () => {
    it('should update flags when cyre.lock() is called', async () => {
      await cyre.init()

      // Initially unlocked
      expect(metricsState.canRegister().allowed).toBe(true)
      expect(metricsState.isOperational().operational).toBe(true)

      // Lock system
      cyre.lock()

      // Should now be locked
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.canRegister().messages).toContain('System is locked')
      expect(metricsState.isOperational().operational).toBe(false)
      expect(metricsState.isOperational().messages).toContain(
        'System is locked'
      )

      // Call should still work (not affected by lock)
      expect(metricsState.canCall().allowed).toBe(true)
    })
  })

  describe('cyre.unlock() updates flags', () => {
    it('should update flags when cyre.unlock() is called', async () => {
      await cyre.init()
      cyre.lock()

      // Initially locked
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.isOperational().operational).toBe(false)

      // Unlock system
      cyre.unlock()

      // Should now be unlocked
      expect(metricsState.canRegister().allowed).toBe(true)
      expect(metricsState.isOperational().operational).toBe(true)
    })
  })

  describe('cyre.shutdown() updates flags', () => {
    it('should update flags when cyre.shutdown() is called', async () => {
      await cyre.init()

      // Initially operational
      expect(metricsState.canCall().allowed).toBe(true)
      expect(metricsState.canRegister().allowed).toBe(true)
      expect(metricsState.isOperational().operational).toBe(true)

      // Shutdown system - this will reset the system, so we check the reset state
      cyre.shutdown()

      // After shutdown (which calls reset), should be back to default state
      expect(metricsState.canCall().allowed).toBe(false)
      expect(metricsState.canCall().messages).toContain(
        'System not initialized'
      )
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.canRegister().messages).toContain(
        'System not initialized'
      )
      expect(metricsState.isOperational().operational).toBe(false)
      expect(metricsState.isOperational().messages).toContain(
        'System not initialized'
      )
    })

    it('should set shutdown flag before resetting', async () => {
      await cyre.init()

      // Test direct shutdown without reset
      metricsState.shutdown()

      // Should now be shutdown
      expect(metricsState.canCall().allowed).toBe(false)
      expect(metricsState.canCall().messages).toContain('System is shutdown')
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.canRegister().messages).toContain(
        'System is shutdown'
      )
      expect(metricsState.isOperational().operational).toBe(false)
      expect(metricsState.isOperational().messages).toContain(
        'System is shutdown'
      )
    })
  })

  describe('cyre.reset() updates flags', () => {
    it('should update flags when cyre.reset() is called', async () => {
      await cyre.init()
      cyre.lock()

      // Initially locked
      expect(metricsState.canRegister().allowed).toBe(false)

      // Reset system
      cyre.reset()

      // Should be back to default state (not initialized)
      expect(metricsState.canCall().allowed).toBe(false)
      expect(metricsState.canCall().messages).toContain(
        'System not initialized'
      )
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.canRegister().messages).toContain(
        'System not initialized'
      )
      expect(metricsState.isOperational().operational).toBe(false)
      expect(metricsState.isOperational().messages).toContain(
        'System not initialized'
      )
    })
  })

  describe('metricsState methods update flags', () => {
    it('should update flags when metricsState methods are called directly', async () => {
      // Test direct metricsState calls
      expect(metricsState.canCall().allowed).toBe(false)

      // Direct init
      metricsState.init()
      expect(metricsState.canCall().allowed).toBe(true)

      // Direct lock
      metricsState.lock()
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.canRegister().messages).toContain('System is locked')

      // Direct unlock
      metricsState.unlock()
      expect(metricsState.canRegister().allowed).toBe(true)

      // Direct shutdown
      metricsState.shutdown()
      expect(metricsState.canCall().allowed).toBe(false)
      expect(metricsState.canCall().messages).toContain('System is shutdown')
    })
  })

  describe('Flag precedence and combinations', () => {
    it('should handle multiple conditions correctly', async () => {
      await cyre.init()
      cyre.lock()

      // Locked but initialized
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.canRegister().messages).toContain('System is locked')
      expect(metricsState.canRegister().messages).not.toContain(
        'System not initialized'
      )

      // Test direct shutdown (not cyre.shutdown which calls reset)
      metricsState.shutdown()

      // Shutdown takes precedence over locked
      expect(metricsState.canRegister().allowed).toBe(false)
      expect(metricsState.canRegister().messages).toContain(
        'System is shutdown'
      )
      expect(metricsState.canRegister().messages).not.toContain(
        'System is locked'
      )
    })
  })
})
