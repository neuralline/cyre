// test/middleware-diagnostic.test.ts
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {middlewares} from '../src/context/state'

/*
 * Middleware Diagnostic Test
 *
 * This test provides detailed logging and inspection at each step
 * of the middleware registration and execution process.
 */

describe('Middleware System Diagnostic', () => {
  const ACTION_ID = 'diagnostic-action'
  const MIDDLEWARE_ID = 'diagnostic-middleware'
  let middlewareExecuted = false
  let handlerExecuted = false
  let transformedPayload: any = null

  // Setup logging
  const log = (message: string, data?: any) => {
    console.log(`[DIAGNOSTIC] ${message}`, data !== undefined ? data : '')
  }

  // Inspect key parts of the system
  const inspectSystem = () => {
    // Check cyre's internal state
    const action = cyre.get(ACTION_ID)
    const allMiddleware = middlewares.getAll()
    const middleware = middlewares.get(MIDDLEWARE_ID)

    log('System state:')
    log(`- cyre.get('${ACTION_ID}'):`, action ? 'EXISTS' : 'MISSING')
    if (action) {
      log(
        `  - has middleware:`,
        !!action.middleware && Array.isArray(action.middleware)
      )
      log(`  - middleware array:`, action.middleware || 'NONE')
    }

    log(
      `- middlewares.getAll():`,
      `${allMiddleware.length} middlewares registered`
    )
    allMiddleware.forEach((m, i) =>
      log(`  - middleware[${i}]:`, {id: m.id, hasFn: !!m.fn})
    )

    log(
      `- middlewares.get('${MIDDLEWARE_ID}'):`,
      middleware ? 'EXISTS' : 'MISSING'
    )
    if (middleware) {
      log(`  - fn type:`, typeof middleware.fn)
    }
  }

  beforeEach(() => {
    // Reset test state
    middlewareExecuted = false
    handlerExecuted = false
    transformedPayload = null

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize cyre
    cyre.initialize()

    console.log('===== MIDDLEWARE DIAGNOSTIC TEST STARTED =====')
  })

  afterEach(() => {
    // Final system inspection
    inspectSystem()
    console.log('===== MIDDLEWARE DIAGNOSTIC TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  it('should handle a simple middleware transformation', async () => {
    // STEP 1: Register middleware
    log('STEP 1: Registering middleware')
    const middlewareRegistration = cyre.middleware(
      MIDDLEWARE_ID,
      async (action, payload) => {
        log('Middleware executed with:', {action: action.id, payload})
        middlewareExecuted = true

        // Transform payload
        const transformedPayload = {
          ...payload,
          transformed: true,
          timestamp: Date.now()
        }

        log('Middleware returning:', {action: action.id, transformedPayload})
        return {action, payload: transformedPayload}
      }
    )

    log('Middleware registration result:', middlewareRegistration)

    // Inspect system after middleware registration
    log('System state after middleware registration:')
    inspectSystem()

    // STEP 2: Register action handler
    log('STEP 2: Registering action handler')
    const handlerRegistration = cyre.on(ACTION_ID, payload => {
      log('Action handler executed with payload:', payload)
      handlerExecuted = true
      transformedPayload = payload
      return {executed: true}
    })

    log('Handler registration result:', handlerRegistration)

    // STEP 3: Create action with middleware
    log('STEP 3: Creating action with middleware')
    cyre.action({
      id: ACTION_ID,
      type: 'diagnostic-test',
      payload: {initial: true},
      middleware: [MIDDLEWARE_ID]
    })

    // Inspect system after action creation
    log('System state after action creation:')
    inspectSystem()

    // STEP 4: Call action
    log('STEP 4: Calling action')
    const callResult = await cyre.call(ACTION_ID, {test: 'value'})
    log('Call result:', callResult)

    // STEP 5: Wait a moment to ensure async operations complete
    log('STEP 5: Waiting for async operations')
    await new Promise(resolve => setTimeout(resolve, 50))

    // STEP 6: Verify results
    log('STEP 6: Verifying results')
    log('middlewareExecuted:', middlewareExecuted)
    log('handlerExecuted:', handlerExecuted)
    log('transformedPayload:', transformedPayload)

    // Test assertions with detailed error messages
    expect(middlewareExecuted, 'Middleware was not executed').toBe(true)
    expect(handlerExecuted, 'Action handler was not executed').toBe(true)
    expect(
      transformedPayload,
      'Payload was not received by handler'
    ).toBeDefined()

    if (transformedPayload) {
      expect(transformedPayload.test, 'Original payload property missing').toBe(
        'value'
      )
      expect(
        transformedPayload.transformed,
        'Transformed property missing'
      ).toBe(true)
    }
  })

  it('should handle middleware rejection', async () => {
    // STEP 1: Register validation middleware
    log('STEP 1: Registering validation middleware')
    cyre.middleware(MIDDLEWARE_ID, async (action, payload) => {
      log('Validation middleware executed with:', {action: action.id, payload})
      middlewareExecuted = true

      // Validate payload
      if (payload && typeof payload === 'object' && payload.valid === true) {
        log('Validation passed, returning payload')
        return {action, payload}
      }

      log('Validation failed, rejecting action')
      return null
    })

    // STEP 2: Register action handler
    log('STEP 2: Registering action handler')
    cyre.on(ACTION_ID, payload => {
      log('Action handler executed with payload:', payload)
      handlerExecuted = true
      transformedPayload = payload
      return {executed: true}
    })

    // STEP 3: Create action with middleware
    log('STEP 3: Creating action with middleware')
    cyre.action({
      id: ACTION_ID,
      type: 'diagnostic-test',
      payload: {initial: true},
      middleware: [MIDDLEWARE_ID]
    })

    // Inspect system after action creation
    log('System state after action creation:')
    inspectSystem()

    // STEP 4: Call action with invalid payload
    log('STEP 4: Calling action with invalid payload')
    const invalidCallResult = await cyre.call(ACTION_ID, {valid: false})
    log('Invalid call result:', invalidCallResult)

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 50))

    // Save state after invalid call
    const invalidState = {
      middlewareExecuted,
      handlerExecuted
    }

    // Reset execution flags
    middlewareExecuted = false
    handlerExecuted = false

    // STEP 5: Call action with valid payload
    log('STEP 5: Calling action with valid payload')
    const validCallResult = await cyre.call(ACTION_ID, {valid: true})
    log('Valid call result:', validCallResult)

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 50))

    // STEP 6: Verify results
    log('STEP 6: Verifying results')
    log('Invalid call:', invalidState)
    log('Valid call: middlewareExecuted:', middlewareExecuted)
    log('Valid call: handlerExecuted:', handlerExecuted)

    // Test invalid call assertions
    expect(
      invalidState.middlewareExecuted,
      'Middleware not executed for invalid payload'
    ).toBe(true)
    expect(
      invalidState.handlerExecuted,
      'Handler should not execute for invalid payload'
    ).toBe(false)
    expect(invalidCallResult.ok, 'Invalid call should return failure').toBe(
      false
    )

    // Test valid call assertions
    expect(
      middlewareExecuted,
      'Middleware not executed for valid payload'
    ).toBe(true)
    expect(handlerExecuted, 'Handler not executed for valid payload').toBe(true)
    expect(validCallResult.ok, 'Valid call should return success').toBe(true)
  })
})
