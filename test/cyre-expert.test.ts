// test/cyre-expert.test.ts
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll
} from 'vitest'
import {cyre, schema} from '../src/index'
import type {CyreResponse, ActionPayload} from '../src/types/core'

describe('Cyre Expert Level Features', () => {
  beforeAll(async () => {
    await cyre.init()
  })

  beforeEach(async () => {
    cyre.clear()
    await cyre.init()
  })

  afterEach(() => {
    vi.clearAllTimers()
    cyre.clear()
  })

  describe('Advanced Schema System', () => {
    it('should handle complex schema validations', async () => {
      const userSchema = schema.object({
        name: schema.string().minLength(2).maxLength(50),
        age: schema.number().min(0).max(150),
        email: schema.string().email(),
        address: schema.object({
          street: schema.string(),
          city: schema.string(),
          zipCode: schema.string().pattern(/^\d{5}$/)
        })
      })

      const handler = vi.fn()

      cyre.action({
        id: 'user-registration',
        schema: userSchema,
        required: true
      })
      cyre.on('user-registration', handler)

      // Valid user data
      const validUser = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          zipCode: '12345'
        }
      }

      const result = await cyre.call('user-registration', validUser)
      expect(result.ok).toBe(true)
      expect(handler).toHaveBeenCalledWith(validUser)
    })

    it('should reject invalid schema data', async () => {
      const strictSchema = schema.object({
        id: schema.number().positive(),
        status: schema.enums('active', 'inactive', 'pending')
      })

      cyre.action({
        id: 'status-update',
        schema: strictSchema
      })
      cyre.on('status-update', vi.fn())

      const invalidData = {
        id: -1, // Invalid: negative number
        status: 'unknown' // Invalid: not in enum
      }

      const result = await cyre.call('status-update', invalidData)
      expect(result.ok).toBe(false)
    })

    it('should handle schema transformations', async () => {
      const transformSchema = schema.object({
        timestamp: schema.string().transform(str => new Date(str)),
        amount: schema.string().transform(str => parseFloat(str))
      })

      const handler = vi.fn()

      cyre.action({
        id: 'data-transform',
        schema: transformSchema
      })
      cyre.on('data-transform', handler)

      await cyre.call('data-transform', {
        timestamp: '2024-01-01T00:00:00Z',
        amount: '123.45'
      })

      expect(handler).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        amount: 123.45
      })
    })

    it('should support optional and nullable fields', async () => {
      const flexibleSchema = schema.object({
        required: schema.string(),
        optional: schema.string().optional(),
        nullable: schema.string().nullable(),
        withDefault: schema.string().default('default-value')
      })

      const handler = vi.fn()

      cyre.action({
        id: 'flexible-data',
        schema: flexibleSchema
      })
      cyre.on('flexible-data', handler)

      await cyre.call('flexible-data', {
        required: 'present',
        nullable: null
      })

      expect(handler).toHaveBeenCalledWith({
        required: 'present',
        optional: undefined,
        nullable: null,
        withDefault: 'default-value'
      })
    })
  })

  describe('Advanced Talent Pipeline System', () => {
    it('should execute multiple talent operators in sequence', async () => {
      const transformationLog: string[] = []
      const handler = vi.fn()

      cyre.action({
        id: 'pipeline-test',
        // Multiple talents in pipeline
        required: true,
        selector: (payload: any) => {
          transformationLog.push('selector')
          return payload.data
        },
        condition: (payload: any) => {
          transformationLog.push('condition')
          return payload.length > 0
        },
        transform: (payload: any) => {
          transformationLog.push('transform')
          return payload.toUpperCase()
        }
      })
      cyre.on('pipeline-test', handler)

      await cyre.call('pipeline-test', {data: 'hello'})

      expect(transformationLog).toEqual(['selector', 'condition', 'transform'])
      expect(handler).toHaveBeenCalledWith('HELLO')
    })

    it('should handle talent pipeline failures gracefully', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'pipeline-fail-test',
        condition: () => false, // This will block execution
        transform: (payload: any) => payload.toUpperCase()
      })
      cyre.on('pipeline-fail-test', handler)

      const result = await cyre.call('pipeline-fail-test', 'test')

      expect(result.ok).toBe(false)
      expect(result.message).toContain('Condition not met')
      expect(handler).not.toHaveBeenCalled()
    })

    it('should support complex data transformations', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'complex-transform',
        selector: (payload: any) => payload.items,
        transform: (items: any[]) =>
          items
            .filter(item => item.active)
            .map(item => ({...item, processed: true}))
            .sort((a, b) => a.priority - b.priority)
      })
      cyre.on('complex-transform', handler)

      const complexData = {
        items: [
          {id: 1, active: true, priority: 3},
          {id: 2, active: false, priority: 1},
          {id: 3, active: true, priority: 1},
          {id: 4, active: true, priority: 2}
        ]
      }

      await cyre.call('complex-transform', complexData)

      expect(handler).toHaveBeenCalledWith([
        {id: 3, active: true, priority: 1, processed: true},
        {id: 4, active: true, priority: 2, processed: true},
        {id: 1, active: true, priority: 3, processed: true}
      ])
    })
  })

  describe('Protection System Integration', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should handle complex protection combinations', async () => {
      const handler = vi.fn()

      // This should work: detectChanges without conflicting protections
      cyre.action({
        id: 'protected-complex',
        detectChanges: true,
        required: true,
        throttle: 1000
      })
      cyre.on('protected-complex', handler)

      // First call with data
      const result1 = await cyre.call('protected-complex', {value: 1})
      expect(result1.ok).toBe(true)
      expect(handler).toHaveBeenCalledTimes(1)

      // Second call with same data - should be blocked by detectChanges
      const result2 = await cyre.call('protected-complex', {value: 1})
      expect(result2.ok).toBe(false)
      expect(result2.message).toContain('No changes detected')

      // Third call with different data but within throttle window
      const result3 = await cyre.call('protected-complex', {value: 2})
      expect(result3.ok).toBe(false)
      expect(result3.message).toContain('throttled')
    })

    it('should respect maxWait with debounce', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'debounce-maxwait',
        debounce: 1000,
        maxWait: 3000
      })
      cyre.on('debounce-maxwait', handler)

      // Rapid calls that would normally be debounced
      await cyre.call('debounce-maxwait', 'call1')
      await cyre.call('debounce-maxwait', 'call2')
      await cyre.call('debounce-maxwait', 'call3')

      // Advance time past maxWait
      vi.advanceTimersByTime(3100)

      // Handler should have been called due to maxWait
      expect(handler).toHaveBeenCalled()
    })

    it('should handle required validation with different payload types', async () => {
      const handler = vi.fn()

      cyre.action({
        id: 'required-test',
        required: true
      })
      cyre.on('required-test', handler)

      // Test various "empty" payloads that should be rejected
      const emptyPayloads = [undefined, null, '', [], {}]

      for (const payload of emptyPayloads) {
        const result = await cyre.call('required-test', payload)
        expect(result.ok).toBe(false)
        expect(result.message).toContain('required')
      }

      // Valid payload should work
      const validResult = await cyre.call('required-test', {data: 'valid'})
      expect(validResult.ok).toBe(true)
    })
  })

  describe('Multi-Handler Execution Strategies', () => {
    it('should execute handlers in parallel by default', async () => {
      const executionOrder: number[] = []

      const handler1 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        executionOrder.push(1)
        return 'result1'
      })

      const handler2 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        executionOrder.push(2)
        return 'result2'
      })

      cyre.action({
        id: 'parallel-execution',
        dispatch: 'parallel'
      })

      cyre.on('parallel-execution', handler1)
      cyre.on('parallel-execution', handler2)

      const result = await cyre.call('parallel-execution', 'test')

      expect(result.ok).toBe(true)
      // In parallel execution, faster handler (2) should complete first
      expect(executionOrder).toEqual([2, 1])
    })

    it('should execute handlers in waterfall mode', async () => {
      const handler1 = vi.fn((data: any) => ({...data, step1: true}))
      const handler2 = vi.fn((data: any) => ({...data, step2: true}))
      const handler3 = vi.fn((data: any) => ({...data, step3: true}))

      cyre.action({
        id: 'waterfall-test',
        dispatch: 'waterfall'
      })

      cyre.on('waterfall-test', handler1)
      cyre.on('waterfall-test', handler2)
      cyre.on('waterfall-test', handler3)

      const result = await cyre.call('waterfall-test', {initial: true})

      expect(result.ok).toBe(true)
      expect(result.payload).toEqual({
        initial: true,
        step1: true,
        step2: true,
        step3: true
      })
    })

    it('should handle race execution mode', async () => {
      const handler1 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
        return 'slow-result'
      })

      const handler2 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return 'fast-result'
      })

      cyre.action({
        id: 'race-execution',
        dispatch: 'race'
      })

      cyre.on('race-execution', handler1)
      cyre.on('race-execution', handler2)

      const result = await cyre.call('race-execution', 'test')

      expect(result.ok).toBe(true)
      expect(result.payload).toBe('fast-result') // Fastest wins
    })

    it('should handle error strategies correctly', async () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error')
      })
      const handler2 = vi.fn(() => 'success')
      const handler3 = vi.fn(() => 'also success')

      cyre.action({
        id: 'error-strategy-test',
        dispatch: 'parallel',
        errorStrategy: 'continue',
        collectResults: 'all'
      })

      cyre.on('error-strategy-test', handler1)
      cyre.on('error-strategy-test', handler2)
      cyre.on('error-strategy-test', handler3)

      const result = await cyre.call('error-strategy-test', 'test')

      // With 'continue' strategy, should succeed despite one handler failing
      expect(result.ok).toBe(true)
      expect(Array.isArray(result.payload)).toBe(true)
    })
  })

  describe('Advanced Payload State System', () => {
    it('should track request-response pairs', async () => {
      const handler = vi.fn((data: any) => `processed-${data}`)

      cyre.action({id: 'payload-tracking'})
      cyre.on('payload-tracking', handler)

      await cyre.call('payload-tracking', 'test-data')

      const payloads = cyre.get('payload-tracking')
      expect(payloads).toHaveProperty('req')
      expect(payloads).toHaveProperty('res')
      expect(payloads).toHaveProperty('metadata')

      expect(payloads.req).toBe('test-data')
      expect(payloads.res).toBe('processed-test-data')
      expect(payloads.metadata).toHaveProperty('status')
    })

    it('should maintain payload history', async () => {
      const handler = vi.fn()

      cyre.action({id: 'history-test'})
      cyre.on('history-test', handler)

      // Make multiple calls
      await cyre.call('history-test', 'data1')
      await cyre.call('history-test', 'data2')
      await cyre.call('history-test', 'data3')

      // Payload state should track the latest
      const current = cyre.get('history-test')
      expect(current.req).toBe('data3')
    })

    it('should detect payload changes correctly', () => {
      cyre.action({
        id: 'change-detection',
        payload: {initial: 'value'}
      })

      // Same payload - no change
      expect(cyre.hasChanged('change-detection', {initial: 'value'})).toBe(
        false
      )

      // Different payload - has change
      expect(cyre.hasChanged('change-detection', {initial: 'different'})).toBe(
        true
      )

      // Complex object comparison
      expect(
        cyre.hasChanged('change-detection', {
          initial: 'value',
          extra: 'field'
        })
      ).toBe(true)
    })
  })

  describe('System Metrics and Monitoring', () => {
    it('should provide comprehensive system metrics', () => {
      // Create some channels to generate metrics
      cyre.action({id: 'metric-test-1'})
      cyre.action({id: 'metric-test-2', throttle: 1000})
      cyre.action({id: 'metric-test-3', debounce: 500})

      const metrics = cyre.getMetrics()

      expect(metrics).toHaveProperty('system')
      expect(metrics).toHaveProperty('stores')
      expect(metrics).toHaveProperty('available', true)

      expect(metrics.system).toHaveProperty('stress')
      expect(metrics.system).toHaveProperty('breathing')
      expect(metrics.system).toHaveProperty('health')

      expect(metrics.stores).toHaveProperty('channels')
      expect(metrics.stores.channels).toBeGreaterThan(0)
    })

    it('should track channel-specific metrics', async () => {
      const handler = vi.fn()

      cyre.action({id: 'tracked-channel'})
      cyre.on('tracked-channel', handler)

      // Make some calls to generate metrics
      await cyre.call('tracked-channel', 'test1')
      await cyre.call('tracked-channel', 'test2')

      const channelMetrics = cyre.getMetrics('tracked-channel')

      expect(channelMetrics).toHaveProperty('channelId', 'tracked-channel')
      expect(channelMetrics).toHaveProperty('executionCount')
      expect(channelMetrics).toHaveProperty('available', true)
    })

    it('should monitor system health', () => {
      const status = cyre.status()
      expect(typeof status).toBe('boolean')

      // Lock and unlock to test system control
      const lockResult = cyre.lock()
      expect(lockResult.ok).toBe(true)

      const unlockResult = cyre.unlock()
      expect(unlockResult.ok).toBe(true)
    })
  })

  describe('Advanced Orchestration Patterns', () => {
    it('should handle complex workflow chains', async () => {
      const workflowState: string[] = []

      // Setup workflow steps
      cyre.action({id: 'validate'})
      cyre.action({id: 'transform'})
      cyre.action({id: 'store'})
      cyre.action({id: 'notify'})

      cyre.on('validate', async (data: any) => {
        workflowState.push('validated')
        if (!data.email) throw new Error('Email required')

        // Chain to next step
        await cyre.call('transform', {...data, validated: true})
        return 'validation-complete'
      })

      cyre.on('transform', async (data: any) => {
        workflowState.push('transformed')
        const transformed = {
          ...data,
          email: data.email.toLowerCase(),
          timestamp: Date.now()
        }

        await cyre.call('store', transformed)
        return 'transform-complete'
      })

      cyre.on('store', async (data: any) => {
        workflowState.push('stored')
        await cyre.call('notify', {userId: data.id, action: 'created'})
        return 'store-complete'
      })

      cyre.on('notify', (data: any) => {
        workflowState.push('notified')
        return 'notification-sent'
      })

      // Start workflow
      const result = await cyre.call('validate', {
        id: 123,
        email: 'USER@EXAMPLE.COM',
        name: 'Test User'
      })

      expect(result.ok).toBe(true)
      expect(workflowState).toEqual([
        'validated',
        'transformed',
        'stored',
        'notified'
      ])
    })

    it('should handle conditional workflow branching', async () => {
      const processedItems: string[] = []

      cyre.action({id: 'router'})
      cyre.action({id: 'premium-handler'})
      cyre.action({id: 'standard-handler'})

      cyre.on('router', async (data: any) => {
        const targetHandler =
          data.userType === 'premium' ? 'premium-handler' : 'standard-handler'
        await cyre.call(targetHandler, data)
        return 'routed'
      })

      cyre.on('premium-handler', (data: any) => {
        processedItems.push(`premium-${data.id}`)
        return 'premium-processed'
      })

      cyre.on('standard-handler', (data: any) => {
        processedItems.push(`standard-${data.id}`)
        return 'standard-processed'
      })

      // Test both paths
      await cyre.call('router', {id: 1, userType: 'premium'})
      await cyre.call('router', {id: 2, userType: 'standard'})

      expect(processedItems).toEqual(['premium-1', 'standard-2'])
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should recover from handler errors gracefully', async () => {
      let attemptCount = 0
      const flakyHandler = vi.fn(() => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`)
        }
        return 'success-after-retries'
      })

      cyre.action({id: 'flaky-service'})
      cyre.on('flaky-service', flakyHandler)

      // Multiple attempts should eventually succeed
      let lastResult: CyreResponse
      for (let i = 0; i < 5; i++) {
        lastResult = await cyre.call('flaky-service', `attempt-${i}`)
        if (lastResult.ok) break
      }

      expect(lastResult!.ok).toBe(true)
      expect(lastResult!.payload).toBe('success-after-retries')
    })

    it('should handle system stress gracefully', async () => {
      // Create many channels to stress the system
      const channels = Array.from({length: 50}, (_, i) => `stress-channel-${i}`)

      channels.forEach(channelId => {
        cyre.action({id: channelId})
        cyre.on(channelId, (data: any) => `processed-${data}`)
      })

      // Make many concurrent calls
      const promises = channels.map(channelId =>
        cyre.call(channelId, Math.random())
      )

      const results = await Promise.all(promises)

      // System should handle all calls successfully
      expect(results.every(r => r.ok)).toBe(true)

      // System should still be operational
      const metrics = cyre.getMetrics()
      expect(metrics.available).toBe(true)
    })
  })

  describe('Advanced Configuration Patterns', () => {
    it('should handle complex action configurations', () => {
      const complexConfig = {
        id: 'complex-action',
        name: 'Complex Action Handler',
        description: 'A sophisticated action with multiple protections',
        version: '1.2.3',
        tags: ['critical', 'user-facing', 'api'],
        group: 'authentication',
        path: 'api/auth/login',

        // Protection stack
        required: true,
        throttle: 1000,
        detectChanges: true,

        // Execution strategy
        dispatch: 'sequential' as const,
        errorStrategy: 'fail-fast' as const,
        collectResults: 'all' as const,
        dispatchTimeout: 5000,

        // Processing pipeline
        condition: (payload: any) => !!payload.username,
        selector: (payload: any) => ({
          username: payload.username,
          timestamp: Date.now()
        }),
        transform: (payload: any) => ({
          ...payload,
          normalized: payload.username.toLowerCase()
        }),

        // Metadata
        priority: {level: 'high' as const},
        payload: {default: 'configuration'}
      }

      const result = cyre.action(complexConfig)
      expect(result.ok).toBe(true)

      // Verify the action was registered
      const channelData = cyre.get('complex-action')
      expect(channelData).toBeTruthy()
    })

    it('should validate configuration conflicts', () => {
      // This should fail due to conflicting protections
      const conflictingConfig = {
        id: 'conflicting-action',
        throttle: 1000,
        debounce: 500 // Can't have both throttle and debounce
      }

      const result = cyre.action(conflictingConfig)
      expect(result.ok).toBe(false)
      expect(result.message).toContain(
        'throttle and debounce cannot both be active'
      )
    })
  })

  describe('Performance Edge Cases', () => {
    it('should handle rapid channel creation and destruction', () => {
      const channelIds: string[] = []

      // Rapidly create channels
      for (let i = 0; i < 100; i++) {
        const channelId = `rapid-${i}`
        channelIds.push(channelId)

        const result = cyre.action({id: channelId})
        expect(result.ok).toBe(true)
      }

      // Verify all channels exist
      channelIds.forEach(id => {
        expect(cyre.get(id)).toBeTruthy()
      })

      // Rapidly destroy channels
      channelIds.forEach(id => {
        const success = cyre.forget(id)
        expect(success).toBe(true)
      })

      // Verify channels are gone
      channelIds.forEach(id => {
        expect(cyre.get(id)).toBeUndefined()
      })
    })

    it('should maintain performance under memory pressure', async () => {
      // Create channels with large payloads
      const largePayload = {
        data: Array.from({length: 1000}, (_, i) => ({
          id: i,
          content: `Large content block ${i} `.repeat(100)
        }))
      }

      const handler = vi.fn()
      cyre.action({id: 'memory-test'})
      cyre.on('memory-test', handler)

      // Make multiple calls with large payloads
      const promises = Array.from({length: 20}, (_, i) =>
        cyre.call('memory-test', {...largePayload, callId: i})
      )

      const results = await Promise.all(promises)

      // All calls should succeed despite large payloads
      expect(results.every(r => r.ok)).toBe(true)
      expect(handler).toHaveBeenCalledTimes(20)
    })
  })
})
