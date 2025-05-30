// tests/separation-of-concerns.test.ts
// Corrected tests for proper separation between channels and actions

import {describe, test, expect, beforeEach, vi} from 'vitest'
import {cyre} from '../src/app'
import CyreChannel from '../src/components/cyre-channels'
import {
  registerSingleAction,
  compileProtectionPipeline
} from '../src/components/cyre-actions'
import {io} from '../src/context/state'

describe('Separation of Concerns: Channels vs Actions', () => {
  beforeEach(async () => {
    await cyre.initialize()
    cyre.clear()
  })

  describe('CyreChannel - Focused Responsibilities', () => {
    test('should validate ID requirements', () => {
      // Missing ID (undefined)
      const result1 = CyreChannel({} as any)
      expect(result1.ok).toBe(false)
      expect(result1.message).toContain('Channel ID cannot be empty')

      // Empty ID
      const result2 = CyreChannel({id: ''})
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('Channel ID cannot be empty')

      // Invalid type
      const result3 = CyreChannel({id: 123} as any)
      expect(result3.ok).toBe(false)
      expect(result3.message).toContain('Invalid channel type')

      // Valid ID
      const result4 = CyreChannel({id: 'test-channel'})
      expect(result4.ok).toBe(true)
    })

    test('should handle channel existence checking', () => {
      const channelConfig = {id: 'existing-channel', payload: {initial: 'data'}}

      // First creation
      const result1 = CyreChannel(channelConfig)
      expect(result1.ok).toBe(true)
      expect(result1.message).toBe('Channel created')

      // Second creation (update)
      const result2 = CyreChannel({
        ...channelConfig,
        payload: {updated: 'data'}
      })
      expect(result2.ok).toBe(true)
      expect(result2.message).toBe('Channel updated')
    })

    test('should set appropriate defaults', () => {
      // Test with no payload provided
      const result1 = CyreChannel({
        id: 'test-defaults'
        // No payload, type, or timestamps
      })

      expect(result1.ok).toBe(true)
      expect(result1.payload).toMatchObject({
        id: 'test-defaults',
        type: undefined, // type is group/category, not defaulting to ID
        payload: undefined, // defaults to undefined unless user sets it
        timestamp: expect.any(Number),
        timeOfCreation: expect.any(Number)
      })

      // Test with payload provided by user
      const result2 = CyreChannel({
        id: 'test-with-payload',
        payload: {message: 'user provided'}
      })

      expect(result2.ok).toBe(true)
      expect(result2.payload!.payload).toEqual({message: 'user provided'})

      // Test with type provided by user
      const result3 = CyreChannel({
        id: 'test-with-type',
        type: 'auth'
      })

      expect(result3.ok).toBe(true)
      expect(result3.payload!.type).toBe('auth')
    })

    test('should NOT validate action-specific attributes', () => {
      // Channel should accept these without validation
      const result = CyreChannel({
        id: 'test-channel',
        throttle: 'invalid', // Should not validate this
        schema: 'not-a-function', // Should not validate this
        condition: 123, // Should not validate this
        repeat: 'invalid' // Should not validate this
      } as any)

      expect(result.ok).toBe(true) // Channel creation succeeds
      expect(result.payload).toBeDefined()
    })

    test('should store channel in state', () => {
      const channelConfig = {
        id: 'stored-channel',
        payload: {test: 'data'}
      }

      CyreChannel(channelConfig)

      const stored = io.get('stored-channel')
      expect(stored).toBeDefined()
      expect(stored!.id).toBe('stored-channel')
      expect(stored!.payload).toEqual({test: 'data'})
    })
  })

  describe('registerSingleAction - Comprehensive Processing', () => {
    test('should handle complete action registration flow', () => {
      const actionConfig = {
        id: 'complete-action',
        selector: (data: any) => data.user,
        condition: (user: any) => user.active,
        transform: (user: any) => ({...user, processed: true}),
        detectChanges: true,
        throttle: 100,
        debounce: 50
      }

      const result = registerSingleAction(actionConfig)

      expect(result.ok).toBe(true)
      // System recuperation + 6 protections = 7 total
      expect(result.message).toContain('with 7 protections')

      const stored = io.get('complete-action')
      expect(stored).toBeDefined()
      expect(stored!._protectionPipeline).toHaveLength(7)
    })

    test('should validate action structure', () => {
      const invalidAction = {
        id: 'test-action',
        throttle: -100, // Invalid negative throttle
        debounce: 'invalid', // Invalid type
        repeat: 'not-valid' // Invalid repeat value
      }

      const result = registerSingleAction(invalidAction as any)
      expect(result.ok).toBe(false)
      expect(result.message).toContain('Action structure invalid')
    })

    test('should validate function attributes', () => {
      const invalidFunctions = {
        id: 'test-functions',
        condition: 'not-a-function',
        selector: 123,
        transform: false,
        schema: 'invalid'
      }

      const result = registerSingleAction(invalidFunctions as any)
      expect(result.ok).toBe(false)
      expect(result.message).toContain('Function validation failed')
    })

    test('should compile protection pipeline with correct ordering', () => {
      const action = {
        id: 'pipeline-test',
        block: true, // Should be early in pipeline
        schema: cyre.schema.string(),
        selector: (data: any) => data.value,
        condition: (value: any) => value !== null,
        detectChanges: true,
        throttle: 100,
        debounce: 50,
        transform: (value: any) => value.toUpperCase()
      }

      const pipeline = compileProtectionPipeline(action)

      // Should have all protections: block, system-recuperation, schema, selector, condition, detectChanges, throttle, debounce, transform
      expect(pipeline).toHaveLength(9)

      // Test pipeline execution order by running through it
      const context = {
        action,
        payload: 'test',
        originalPayload: 'test',
        metrics: {},
        timestamp: Date.now()
      }

      // First protection should be block (fastest)
      const firstResult = pipeline[0](context)
      expect(firstResult.pass).toBe(false)
      expect(firstResult.reason).toContain('not available')
    })

    test('should handle validation errors gracefully', () => {
      const malformedAction = {
        id: '', // Empty ID should fail at channel level
        condition: 'not-a-function'
      }

      const result = registerSingleAction(malformedAction as any)
      expect(result.ok).toBe(false)
      expect(result.message).toBeDefined()
    })

    test('should not add system recuperation for critical priority actions', () => {
      const criticalAction = {
        id: 'critical-action',
        priority: {level: 'critical'},
        condition: (data: any) => true,
        throttle: 100
      }

      const pipeline = compileProtectionPipeline(criticalAction)
      // Should not include system recuperation: condition, throttle = 2 total
      expect(pipeline).toHaveLength(2)
    })
  })

  describe('Integration Between Channel and Action Processing', () => {
    test('should create channel first, then process action', () => {
      const spy = vi.spyOn(io, 'set')

      const actionConfig = {
        id: 'integration-test',
        throttle: 100
      }

      registerSingleAction(actionConfig)

      // Should be called twice: once for channel, once for final action
      expect(spy).toHaveBeenCalledTimes(2)

      const finalStored = io.get('integration-test')
      expect(finalStored).toBeDefined()
      expect(finalStored!._protectionPipeline).toBeDefined()
      expect(finalStored!.throttle).toBe(100)

      spy.mockRestore()
    })

    test('should handle channel creation failure in action registration', () => {
      const invalidAction = {
        id: null, // Invalid ID should fail at channel level
        throttle: 100
      }

      const result = registerSingleAction(invalidAction as any)
      expect(result.ok).toBe(false)
      expect(result.message).toContain('Channel ID cannot be empty')
    })
  })

  describe('Real-world Usage Examples', () => {
    test('should handle simple action without protections', () => {
      const simpleAction = {
        id: 'simple-notify',
        payload: {message: 'Hello'}
      }

      const result = registerSingleAction(simpleAction)
      expect(result.ok).toBe(true)
      expect(result.message).toContain('with no protections')

      const stored = io.get('simple-notify')
      expect(stored!._protectionPipeline).toHaveLength(0)
    })

    test('should handle complex reactive action', () => {
      const complexAction = {
        id: 'user-profile-manager',
        schema: cyre.schema.object({
          user: cyre.schema.object({
            id: cyre.schema.string(),
            name: cyre.schema.string(),
            active: cyre.schema.boolean()
          })
        }),
        selector: (data: any) => data.user,
        condition: (user: any) => user.active && user.id.length > 0,
        transform: (user: any) => ({
          ...user,
          displayName: user.name.toUpperCase(),
          lastProcessed: Date.now()
        }),
        detectChanges: true,
        throttle: 500,
        priority: {level: 'high'}
      }

      const result = registerSingleAction(complexAction)
      expect(result.ok).toBe(true)
      // System recuperation + 6 protections = 7 total
      expect(result.message).toContain('with 7 protections')

      const stored = io.get('user-profile-manager')
      expect(stored).toBeDefined()
      expect(stored!._protectionPipeline).toHaveLength(7)
      expect(stored!.schema).toBeTypeOf('function')
      expect(stored!.selector).toBeTypeOf('function')
      expect(stored!.condition).toBeTypeOf('function')
      expect(stored!.transform).toBeTypeOf('function')
    })

    test('should handle timed action with intervals', () => {
      const timedAction = {
        id: 'periodic-cleanup',
        interval: 5000,
        repeat: 10,
        delay: 1000,
        condition: () => true
      }

      const result = registerSingleAction(timedAction)
      expect(result.ok).toBe(true)

      const stored = io.get('periodic-cleanup')
      expect(stored).toMatchObject({
        id: 'periodic-cleanup',
        interval: 5000,
        repeat: 10,
        delay: 1000,
        condition: expect.any(Function)
      })
    })

    test('should handle blocked action', () => {
      const blockedAction = {
        id: 'blocked-service',
        block: true,
        payload: {service: 'maintenance'}
      }

      const result = registerSingleAction(blockedAction)
      expect(result.ok).toBe(true)
      expect(result.message).toContain('with 1 protections')

      const stored = io.get('blocked-service')
      expect(stored!.block).toBe(true)
      expect(stored!._protectionPipeline).toHaveLength(1)
    })
  })

  describe('Protection Pipeline Details', () => {
    test('should understand protection count logic', () => {
      // Test to document why we get specific protection counts

      // Action with no protections
      const noProtections = {id: 'no-protections'}
      expect(compileProtectionPipeline(noProtections)).toHaveLength(0)

      // Action with only throttle (system recuperation gets added)
      const onlyThrottle = {id: 'only-throttle', throttle: 100}
      expect(compileProtectionPipeline(onlyThrottle)).toHaveLength(2) // system-recuperation + throttle

      // Critical action with throttle (no system recuperation)
      const criticalThrottle = {
        id: 'critical-throttle',
        throttle: 100,
        priority: {level: 'critical'}
      }
      expect(compileProtectionPipeline(criticalThrottle)).toHaveLength(1) // just throttle

      // Action with repeat: 0 (gets zero-repeat block)
      const zeroRepeat = {id: 'zero-repeat', repeat: 0}
      expect(compileProtectionPipeline(zeroRepeat)).toHaveLength(1) // just zero-repeat block
    })
  })
})
