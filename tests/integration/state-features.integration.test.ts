// tests/integration/state-features.integration.test.ts
// Integration tests for state reactivity with existing Cyre features

import {cyre} from '../../src/app'
import {describe, test, expect, beforeEach, vi, afterEach} from 'vitest'

describe('State Features Integration', () => {
  beforeEach(async () => {
    await cyre.initialize()
    cyre.clear()
  })

  afterEach(() => {
    cyre.clear()
  })

  describe('Integration with Existing Features', () => {
    test('should work with throttling', async () => {
      const mockHandler = vi.fn()

      cyre.action({
        id: 'throttled-state',
        selector: payload => payload.value,
        condition: value => value > 10,
        throttle: 100,
        detectChanges: true
      })

      cyre.on('throttled-state', mockHandler)

      // First call should execute
      await cyre.call('throttled-state', {value: 15, other: 'data'})
      expect(mockHandler).toHaveBeenCalledTimes(1)
      expect(mockHandler).toHaveBeenCalledWith(15)

      // Second call within throttle window should be blocked
      const result = await cyre.call('throttled-state', {
        value: 20,
        other: 'data'
      })
      expect(result.ok).toBe(false)
      expect(result.message).toContain('Throttled')
      expect(mockHandler).toHaveBeenCalledTimes(1)

      // Wait for throttle to clear
      await new Promise(resolve => setTimeout(resolve, 120))

      // Third call should execute
      await cyre.call('throttled-state', {value: 25, other: 'data'})
      expect(mockHandler).toHaveBeenCalledTimes(2)
      expect(mockHandler).toHaveBeenLastCalledWith(25)
    })

    test('should work with debouncing', async () => {
      const mockHandler = vi.fn()

      cyre.action({
        id: 'debounced-state',
        selector: payload => payload.search,
        condition: search => search.length >= 3,
        transform: search => ({
          query: search.toLowerCase(),
          timestamp: Date.now()
        }),
        debounce: 50
      })

      cyre.on('debounced-state', mockHandler)

      // Rapid calls should be debounced
      await cyre.call('debounced-state', {search: 'abc', page: 1})
      await cyre.call('debounced-state', {search: 'abcd', page: 1})
      await cyre.call('debounced-state', {search: 'abcde', page: 1})

      // Should not execute immediately
      expect(mockHandler).not.toHaveBeenCalled()

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 80))

      // Should execute only the last call with transformed payload
      expect(mockHandler).toHaveBeenCalledTimes(1)
      expect(mockHandler).toHaveBeenCalledWith({
        query: 'abcde',
        timestamp: expect.any(Number)
      })
    })

    test('should work with schema validation', async () => {
      const mockHandler = vi.fn()

      cyre.action({
        id: 'schema-state',
        schema: cyre.schema.object({
          user: cyre.schema.object({
            id: cyre.schema.number(),
            name: cyre.schema.string()
          }),
          timestamp: cyre.schema.number()
        }),
        selector: payload => payload.user,
        condition: user => user.id > 0,
        transform: user => ({...user, processed: true})
      })

      cyre.on('schema-state', mockHandler)

      // Valid schema, condition passes
      const validPayload = {
        user: {id: 1, name: 'John'},
        timestamp: Date.now()
      }

      const result1 = await cyre.call('schema-state', validPayload)
      expect(result1.ok).toBe(true)
      expect(mockHandler).toHaveBeenCalledWith({
        id: 1,
        name: 'John',
        processed: true
      })

      // Invalid schema should fail before selector/condition
      const invalidPayload = {
        user: {id: 'invalid', name: 'John'},
        timestamp: Date.now()
      }

      const result2 = await cyre.call('schema-state', invalidPayload)
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('Schema validation failed')
      expect(mockHandler).toHaveBeenCalledTimes(1) // No additional calls
    })

    test('should work with priority system during stress', async () => {
      const mockHandler = vi.fn()

      // Create high-priority action with state features
      cyre.action({
        id: 'priority-state',
        selector: payload => payload.alert,
        condition: alert => alert.level === 'critical',
        priority: {level: 'critical'},
        transform: alert => ({...alert, prioritized: true})
      })

      cyre.on('priority-state', mockHandler)

      // Simulate system stress (this might need mocking depending on implementation)
      // For now, just test that the action works normally
      const criticalAlert = {
        alert: {level: 'critical', message: 'System down'},
        other: 'data'
      }

      const result = await cyre.call('priority-state', criticalAlert)
      expect(result.ok).toBe(true)
      expect(mockHandler).toHaveBeenCalledWith({
        level: 'critical',
        message: 'System down',
        prioritized: true
      })
    })
  })

  describe('Performance and Edge Cases', () => {
    test('should handle complex nested selectors efficiently', async () => {
      const mockHandler = vi.fn()

      cyre.action({
        id: 'deep-selector',
        selector: state => state.level1?.level2?.level3?.value,
        condition: value => value !== undefined && value !== null,
        detectChanges: true
      })

      cyre.on('deep-selector', mockHandler)

      // Undefined path should not execute (condition fails)
      const emptyState = {}
      const result1 = await cyre.call('deep-selector', emptyState)
      expect(result1.ok).toBe(false)
      expect(result1.message).toContain('Condition not met')

      // Valid path should execute
      const validState = {
        level1: {
          level2: {
            level3: {value: 'found'},
            other: 'ignored'
          }
        },
        other: 'ignored'
      }

      const result2 = await cyre.call('deep-selector', validState)
      expect(result2.ok).toBe(true)
      expect(mockHandler).toHaveBeenCalledWith('found')
    })

    test('should handle function errors gracefully without breaking pipeline', async () => {
      const mockHandler = vi.fn()

      cyre.action({
        id: 'error-handling',
        selector: payload => {
          if (payload.triggerSelectorError) {
            throw new Error('Selector failed')
          }
          return payload.data
        },
        condition: data => {
          if (data === 'triggerConditionError') {
            throw new Error('Condition failed')
          }
          return data !== null
        },
        transform: data => {
          if (data === 'triggerTransformError') {
            throw new Error('Transform failed')
          }
          return {processed: data}
        }
      })

      cyre.on('error-handling', mockHandler)

      // Selector error
      const result1 = await cyre.call('error-handling', {
        triggerSelectorError: true
      })
      expect(result1.ok).toBe(false)
      expect(result1.message).toContain('Selector failed')

      // Condition error
      const result2 = await cyre.call('error-handling', {
        data: 'triggerConditionError'
      })
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('Condition check failed')

      // Transform error
      const result3 = await cyre.call('error-handling', {
        data: 'triggerTransformError'
      })
      expect(result3.ok).toBe(false)
      expect(result3.message).toContain('Transform failed')

      // Valid case should still work
      const result4 = await cyre.call('error-handling', {data: 'valid'})
      expect(result4.ok).toBe(true)
      expect(mockHandler).toHaveBeenCalledWith({processed: 'valid'})

      // No handler should have been called for error cases
      expect(mockHandler).toHaveBeenCalledTimes(1)
    })

    test('should maintain payload history correctly with selectors', async () => {
      const mockHandler = vi.fn()

      cyre.action({
        id: 'history-tracking',
        selector: state => state.counter,
        detectChanges: true
      })

      cyre.on('history-tracking', mockHandler)

      // First call
      await cyre.call('history-tracking', {counter: 1, other: 'a'})
      expect(mockHandler).toHaveBeenCalledTimes(1)

      // Same selected value, different overall payload - should skip
      const result = await cyre.call('history-tracking', {
        counter: 1,
        other: 'b'
      })
      expect(result.ok).toBe(false)
      expect(result.message).toContain('unchanged')
      expect(mockHandler).toHaveBeenCalledTimes(1)

      // Different selected value - should execute
      await cyre.call('history-tracking', {counter: 2, other: 'b'})
      expect(mockHandler).toHaveBeenCalledTimes(2)
      expect(mockHandler).toHaveBeenLastCalledWith(2)
    })
  })

  describe('Real-world Scenarios', () => {
    test('should handle user authentication flow', async () => {
      const authEvents: string[] = []

      // Login state manager
      cyre.action({
        id: 'auth-manager',
        selector: state => ({
          user: state.user,
          session: state.session
        }),
        condition: auth => auth.user !== null,
        transform: auth => ({
          userId: auth.user.id,
          isAuthenticated: true,
          sessionExpiry: auth.session?.expiry || null,
          timestamp: Date.now()
        }),
        detectChanges: true
      })

      cyre.on('auth-manager', auth => {
        authEvents.push(`login:${auth.userId}`)
      })

      // Logout detector
      cyre.action({
        id: 'logout-detector',
        selector: state => state.user,
        condition: user => user === null,
        transform: () => ({
          isAuthenticated: false,
          loggedOutAt: Date.now()
        })
      })

      cyre.on('logout-detector', () => {
        authEvents.push('logout')
      })

      // Login flow
      const loginState = {
        user: {id: 'user123', name: 'John'},
        session: {token: 'abc', expiry: Date.now() + 3600000},
        ui: {theme: 'light'}
      }

      await cyre.call('auth-manager', loginState)
      await cyre.call('logout-detector', loginState)

      expect(authEvents).toEqual(['login:user123'])

      // Logout flow
      const logoutState = {
        user: null,
        session: null,
        ui: {theme: 'light'}
      }

      await cyre.call('auth-manager', logoutState) // Should not trigger (condition fails)
      await cyre.call('logout-detector', logoutState)

      expect(authEvents).toEqual(['login:user123', 'logout'])
    })

    test('should handle shopping cart calculations', async () => {
      const cartEvents: any[] = []

      cyre.action({
        id: 'cart-totals',
        selector: state => state.cart.items,
        condition: items => Array.isArray(items) && items.length > 0,
        transform: items => {
          const subtotal = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          )
          const tax = subtotal * 0.1
          const total = subtotal + tax

          return {
            itemCount: items.length,
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total: Math.round(total * 100) / 100
          }
        },
        detectChanges: true
      })

      cyre.on('cart-totals', totals => {
        cartEvents.push(totals)
      })

      // Add items to cart
      const cartState = {
        cart: {
          items: [
            {id: 1, name: 'Item 1', price: 10.0, quantity: 2},
            {id: 2, name: 'Item 2', price: 15.5, quantity: 1}
          ]
        },
        user: {id: 'user123'}
      }

      await cyre.call('cart-totals', cartState)

      expect(cartEvents).toHaveLength(1)
      expect(cartEvents[0]).toEqual({
        itemCount: 2,
        subtotal: 35.5,
        tax: 3.55,
        total: 39.05
      })

      // Create a new state object (not mutating the original)
      const cartState2 = {
        cart: {
          items: cartState.cart.items // Same items array reference
        },
        user: {id: 'user456'} // Different user
      }

      await cyre.call('cart-totals', cartState2)
      expect(cartEvents).toHaveLength(1) // No new event because items didn't change

      // Add item - should recalculate (new items array)
      const cartState3 = {
        ...cartState,
        cart: {
          items: [
            ...cartState.cart.items,
            {id: 3, name: 'Item 3', price: 5.0, quantity: 1}
          ]
        }
      }

      await cyre.call('cart-totals', cartState3)
      expect(cartEvents).toHaveLength(2)
      expect(cartEvents[1].total).toBe(44.55) // 40.5 + 4.05 tax

      // Empty cart - should not trigger (condition fails)
      cartState.cart.items = []
      const result = await cyre.call('cart-totals', cartState)
      expect(result.ok).toBe(false)
      expect(cartEvents).toHaveLength(2)
    })

    test('should handle notification aggregation', async () => {
      const notificationSummaries: any[] = []

      cyre.action({
        id: 'notification-aggregator',
        selector: state => state.notifications.unread,
        condition: unread => unread.length > 0,
        transform: unread => {
          const byPriority = unread.reduce((acc, notif) => {
            acc[notif.priority] = (acc[notif.priority] || 0) + 1
            return acc
          }, {} as Record<string, number>)

          return {
            total: unread.length,
            critical: byPriority.critical || 0,
            urgent: byPriority.urgent || 0,
            normal: byPriority.normal || 0,
            hasUrgent: (byPriority.critical || 0) + (byPriority.urgent || 0) > 0
          }
        },
        detectChanges: true
      })

      cyre.on('notification-aggregator', summary => {
        notificationSummaries.push(summary)
      })

      const notifState = {
        notifications: {
          unread: [
            {id: 1, message: 'Info', priority: 'normal'},
            {id: 2, message: 'Alert', priority: 'urgent'}
          ],
          read: []
        }
      }

      await cyre.call('notification-aggregator', notifState)

      expect(notificationSummaries).toEqual([
        {
          total: 2,
          critical: 0,
          urgent: 1,
          normal: 1,
          hasUrgent: true
        }
      ])

      // Add critical notification
      notifState.notifications.unread.push({
        id: 3,
        message: 'Critical',
        priority: 'critical'
      })

      await cyre.call('notification-aggregator', notifState)

      expect(notificationSummaries[1]).toEqual({
        total: 3,
        critical: 1,
        urgent: 1,
        normal: 1,
        hasUrgent: true
      })
    })
  })
})
