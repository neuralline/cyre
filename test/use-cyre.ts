// test/use-cyre.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {useCyre} from '../src/hooks/use-cyre'
import {cyre} from '../src/app'

/*
 * Comprehensive test suite for useCyre hook
 *
 * This suite tests all aspects of useCyre functionality, including:
 * - Initialization and basic operations
 * - Middleware integration with core system
 * - History management
 * - Protection features (debounce, throttle, detectChanges)
 * - Error handling
 */

describe('useCyre Hook', () => {
  // Test state tracking
  let testState = {
    handlerExecuted: false,
    middlewareExecuted: false,
    payloadReceived: null,
    errorOccurred: false,
    errorMessage: ''
  }

  // Utility for logging
  const log = (message: string, data?: any) => {
    console.log(`[TEST] ${message}`, data !== undefined ? data : '')
  }

  // Reset test state and mock process.exit
  beforeEach(() => {
    // Reset test state
    testState = {
      handlerExecuted: false,
      middlewareExecuted: false,
      payloadReceived: null,
      errorOccurred: false,
      errorMessage: ''
    }

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize and handle basic actions', async () => {
    // Create a channel with useCyre
    const channel = useCyre({
      name: 'basic-channel',
      debug: true
    })

    // Verify channel initialization
    expect(channel.id).toBeDefined()
    expect(channel.name).toBe('basic-channel')

    // Register action handler
    channel.on(payload => {
      testState.handlerExecuted = true
      testState.payloadReceived = payload
      return {ok: true, message: 'Handler executed'}
    })

    // Initialize action
    channel.action({
      id: 'basic-test'
    })

    // Verify channel is initialized
    expect(channel.isInitialized()).toBe(true)

    // Call the action
    const testPayload = {test: 'value', timestamp: Date.now()}
    const callResult = await channel.call(testPayload)

    // Verify call success
    expect(callResult.ok).toBe(true)

    // Verify handler executed
    expect(testState.handlerExecuted).toBe(true)

    // Verify payload was received correctly
    expect(testState.payloadReceived).toEqual(testPayload)

    // Clean up
    channel.forget()
  })

  it('should execute middleware and transform payloads', async () => {
    // Create a channel
    const channel = useCyre({
      name: 'middleware-channel',
      debug: true
    })

    // Direct middleware tracking
    let middlewareLog = {
      executed: false,
      input: null as any,
      output: null as any
    }

    // Register middleware that directly updates our tracking variable
    channel.middleware(async (payload, next) => {
      console.log('TEST MIDDLEWARE EXECUTING')
      // Update shared state directly
      middlewareLog.executed = true
      middlewareLog.input = payload

      // Transform payload
      const transformed = {
        ...payload,
        transformed: true,
        middlewareTimestamp: Date.now()
      }
      middlewareLog.output = transformed

      // Continue the chain - this should update testState.payloadReceived
      return await next(transformed)
    })

    // Initialize action with explicit middleware array
    channel.action({
      middleware: [] // Make sure middleware array exists
    })

    // Register handler
    channel.on(payload => {
      testState.payloadReceived = payload
      testState.handlerExecuted = true
      return {ok: true}
    })

    // Call with test payload
    await channel.call({original: true})

    // Update test state from our direct tracking
    testState.middlewareExecuted = middlewareLog.executed

    // Verify middleware executed
    expect(testState.middlewareExecuted).toBe(true)

    // Verify payload was transformed
    if (middlewareLog.executed) {
      expect(testState.payloadReceived).toHaveProperty('transformed', true)
      expect(testState.payloadReceived).toHaveProperty('original', true)
    }

    // Clean up
    channel.forget()
  })

  it('should allow middleware to reject actions', async () => {
    // Create a channel
    const channel = useCyre({
      name: 'validation-channel',
      debug: true
    })

    // Register validation middleware
    channel.middleware(async (payload, next) => {
      testState.middlewareExecuted = true

      // Reject if validation fails
      if (payload.invalid) {
        return {
          ok: false,
          payload: null,
          message: 'Validation failed'
        }
      }

      // Continue for valid payloads
      return await next(payload)
    })

    // Register handler
    channel.on(payload => {
      testState.handlerExecuted = true
      testState.payloadReceived = payload
      return {ok: true}
    })

    // Initialize action
    channel.action({})

    // Call with invalid payload
    const invalidResult = await channel.call({invalid: true})

    // Verify middleware executed but rejected the action
    expect(testState.middlewareExecuted).toBe(true)
    expect(testState.handlerExecuted).toBe(false)
    expect(invalidResult.ok).toBe(false)

    // Reset test state
    testState.middlewareExecuted = false
    testState.handlerExecuted = false

    // Call with valid payload
    const validResult = await channel.call({valid: true})

    // Verify valid call was processed
    expect(testState.middlewareExecuted).toBe(true)
    expect(testState.handlerExecuted).toBe(true)
    expect(validResult.ok).toBe(true)

    // Clean up
    channel.forget()
  })

  it('should record and retrieve action history', async () => {
    // Create a channel
    const channel = useCyre({
      name: 'history-channel',
      debug: true
    })

    // Register handler
    channel.on(payload => {
      return {ok: true, message: 'Success'}
    })

    // Initialize action
    channel.action({})

    // Make multiple calls
    await channel.call({call: 1})
    await channel.call({call: 2})
    await channel.call({call: 3})

    // Get history
    const history = channel.getHistory()

    // Verify history was recorded
    expect(history.length).toBe(3)

    // Verify history entries
    expect(history[0].payload).toHaveProperty('call', 3) // Most recent first
    expect(history[1].payload).toHaveProperty('call', 2)
    expect(history[2].payload).toHaveProperty('call', 1)

    // Verify history entry structure
    expect(history[0]).toHaveProperty('timestamp')
    expect(history[0]).toHaveProperty('response')
    expect(history[0].response).toHaveProperty('ok', true)

    // Test history clearing
    channel.clearHistory()
    const clearedHistory = channel.getHistory()
    expect(clearedHistory.length).toBe(0)

    // Clean up
    channel.forget()
  })

  it('should handle protection features: debounce', async () => {
    // Create channel with debounce protection
    const channel = useCyre({
      name: 'debounce-channel',
      protection: {
        debounce: 50 // 50ms debounce
      }
    })

    // Track execution count
    let executionCount = 0

    // Register handler
    channel.on(() => {
      executionCount++
      return {ok: true}
    })

    // Initialize action
    channel.action({})

    // Call multiple times rapidly
    channel.call({rapid: 1})
    channel.call({rapid: 2})
    channel.call({rapid: 3})

    // Wait for debounce to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify only one execution happened (debounced)
    expect(executionCount).toBe(1)

    // Clean up
    channel.forget()
  })

  it('should handle protection features: detectChanges', async () => {
    // Create channel with change detection
    const channel = useCyre({
      name: 'change-detection-channel',
      protection: {
        detectChanges: true
      }
    })

    // Track execution count
    let executionCount = 0

    // Register handler
    channel.on(payload => {
      executionCount++
      return {ok: true}
    })

    // Initialize action
    channel.action({})

    // Call with same payload multiple times
    const samePayload = {id: 1, value: 'test'}
    await channel.call(samePayload)
    await channel.call(samePayload) // Should be skipped due to detectChanges
    await channel.call(samePayload) // Should be skipped due to detectChanges

    // Verify only executed once
    expect(executionCount).toBe(1)

    // Call with different payload
    await channel.call({id: 2, value: 'different'})

    // Verify executed for different payload
    expect(executionCount).toBe(2)

    // Clean up
    channel.forget()
  })

  it('should handle async operations correctly', async () => {
    // Create channel
    const channel = useCyre({
      name: 'async-channel'
    })

    // Register handler with async operation
    channel.on(async payload => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 50))
      testState.handlerExecuted = true
      testState.payloadReceived = payload
      return {ok: true}
    })

    // Register async middleware
    channel.middleware(async (payload, next) => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 50))
      testState.middlewareExecuted = true

      // Add processed flag
      const processedPayload = {
        ...payload,
        processed: true
      }

      // Continue chain
      return await next(processedPayload)
    })

    // Initialize action
    channel.action({})

    // Call with test payload
    const result = await channel.call({test: 'async'})

    // Verify both async operations completed
    expect(testState.middlewareExecuted).toBe(true)
    expect(testState.handlerExecuted).toBe(true)
    expect(testState.payloadReceived).toHaveProperty('processed', true)
    expect(testState.payloadReceived).toHaveProperty('test', 'async')
    expect(result.ok).toBe(true)

    // Clean up
    channel.forget()
  })

  it('should use safe error handling', async () => {
    // Create channel
    const channel = useCyre({
      name: 'error-channel'
    })

    let middlewareThrew = false

    // Register middleware that throws
    channel.middleware(async () => {
      console.log('Error middleware executing and throwing')
      middlewareThrew = true
      throw new Error('Middleware error')
    })

    // Register handler
    channel.on(() => {
      testState.handlerExecuted = true
      return {ok: true}
    })

    // Initialize action
    channel.action({})

    console.log('Using safeCall with error middleware')
    // Use safeCall to handle errors
    const result = await channel.safeCall({test: 'error'})

    console.log('Safe call result:', result)
    console.log('Middleware threw?', middlewareThrew)

    // Verify middleware threw
    expect(middlewareThrew).toBe(true)

    // Verify error was caught
    expect(result.success).toBe(false)
    if ('error' in result) {
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toContain('Middleware error')
    }

    // Verify handler was not executed due to middleware error
    expect(testState.handlerExecuted).toBe(false)

    // Clean up
    channel.forget()
  })

  it('should handle subscription management', () => {
    // Create channel
    const channel = useCyre({
      name: 'subscription-channel'
    })

    // Initialize action
    channel.action({})

    // Register multiple handlers
    const sub1 = channel.on(() => {
      testState.handlerExecuted = true
      return {ok: true}
    })

    const sub2 = channel.on(() => {
      return {ok: true}
    })

    // Verify subscription count
    expect(channel.getSubscriptionCount()).toBe(2)

    // Unsubscribe one handler
    sub1.unsubscribe()

    // Verify subscription count updated
    expect(channel.getSubscriptionCount()).toBe(1)

    // Clean up
    channel.forget()
  })

  it('should integrate with core cyre system', async () => {
    // Create channel
    const channel = useCyre({
      name: 'integration-channel'
    })

    // Register handler
    channel.on(payload => {
      testState.handlerExecuted = true
      testState.payloadReceived = payload
      return {ok: true}
    })

    // Initialize action
    channel.action({})

    // Get the channel ID
    const channelId = channel.id

    // Verify action exists in core cyre
    const coreAction = cyre.get(channelId)
    expect(coreAction).toBeDefined()

    // Call action through core cyre
    await cyre.call(channelId, {source: 'core'})

    // Verify handler executed
    expect(testState.handlerExecuted).toBe(true)
    expect(testState.payloadReceived).toHaveProperty('source', 'core')

    // Clean up
    channel.forget()

    // Verify action removed from core cyre
    const removedAction = cyre.get(channelId)
    expect(removedAction).toBeUndefined()
  })

  it('should preserve payload types through middleware chain', async () => {
    // Create typed channel
    interface UserData {
      id: number
      name: string
      email: string
    }

    const userChannel = useCyre<UserData>({
      name: 'typed-channel',
      debug: true
    })

    // Track middleware execution
    let middlewareExecuted = false
    let transformedData: any = null

    // Type-checking middleware
    userChannel.middleware(async (payload, next) => {
      console.log('Type middleware executing with:', payload)
      middlewareExecuted = true

      // Should have UserData properties
      const userId = payload.id
      const userName = payload.name
      const userEmail = payload.email

      console.log('User ID from typed payload:', userId)

      // Add validation
      const enrichedPayload = {
        ...payload,
        validated: true
      }

      transformedData = enrichedPayload
      console.log('Type middleware returning:', enrichedPayload)

      // Continue chain with typed payload
      return await next(enrichedPayload)
    })

    // Register handler
    userChannel.on(payload => {
      console.log('Handler received typed payload:', payload)
      testState.payloadReceived = payload
      return {ok: true}
    })

    // Initialize action
    userChannel.action({})

    // Call with typed payload
    const userData: UserData = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com'
    }

    console.log('Calling with typed payload:', userData)
    await userChannel.call(userData)

    console.log('Middleware executed?', middlewareExecuted)
    console.log('Transformed data:', transformedData)
    console.log('Handler received:', testState.payloadReceived)

    // First verify middleware executed
    expect(middlewareExecuted).toBe(true)

    // Then check if transformation happened
    // Verify typed properties preserved
    expect(testState.payloadReceived).toHaveProperty('id', 1)
    expect(testState.payloadReceived).toHaveProperty('name', 'Test User')
    expect(testState.payloadReceived).toHaveProperty(
      'email',
      'test@example.com'
    )

    // Verify middleware added property
    expect(testState.payloadReceived).toHaveProperty('validated', true)

    // Clean up
    userChannel.forget()
  })
})
