// test/middleware-diagnostic.test.ts

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {cyre} from '../src/app'
import {useCyre} from '../src/hooks/use-cyre'

describe('Middleware Loss Diagnostic Test', () => {
  // Setup logging
  const log = (step, message, data) => {
    console.log(
      `[STEP ${step}] ${message}`,
      data !== undefined ? JSON.stringify(data) : ''
    )
  }

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    cyre.initialize()
    console.log('===== MIDDLEWARE LOSS DIAGNOSTIC TEST STARTED =====')
  })

  afterEach(() => {
    console.log('===== MIDDLEWARE LOSS DIAGNOSTIC TEST COMPLETED =====')
    vi.restoreAllMocks()
  })

  it('should diagnose middleware array loss', async () => {
    // STEP 1: Create channel
    const ACTION_ID = 'diagnostic-action'
    log(1, 'Creating channel with useCyre')
    const channel = useCyre({
      name: 'diagnostic',
      debug: true
    })

    log(1.1, 'Channel created with ID', channel.id)

    // STEP 2: Check action before middleware registration
    log(2, 'Checking action before middleware registration')
    const actionBefore = cyre.get(channel.id)
    log(2.1, 'Action state before middleware', {
      exists: !!actionBefore,
      hasMiddleware: !!(actionBefore && actionBefore.middleware),
      middleware: actionBefore?.middleware
    })

    // STEP 3: Register a middleware function
    log(3, 'Registering middleware')
    let middlewareExecuted = false

    channel.middleware(async (payload, next) => {
      log(3.1, 'Middleware executed with payload', payload)
      middlewareExecuted = true

      // Transform payload
      const enriched = {
        ...payload,
        test: true,
        enhanced: true
      }

      log(3.2, 'Middleware returning enhanced payload', enriched)
      return await next(enriched)
    })

    // STEP 4: Check action immediately after middleware registration
    log(4, 'Checking action after middleware registration')
    const actionAfter = cyre.get(channel.id)
    log(4.1, 'Action state after middleware', {
      exists: !!actionAfter,
      hasMiddleware: !!(actionAfter && actionAfter.middleware),
      middleware: actionAfter?.middleware
    })

    // STEP 5: Initialize action explicitly
    log(5, 'Initializing action explicitly')
    channel.action({
      type: 'test-action'
    })

    // STEP 6: Check action after explicit initialization
    log(6, 'Checking action after explicit initialization')
    const actionAfterInit = cyre.get(channel.id)
    log(6.1, 'Action state after initialization', {
      exists: !!actionAfterInit,
      hasMiddleware: !!(actionAfterInit && actionAfterInit.middleware),
      middleware: actionAfterInit?.middleware
    })

    // STEP 7: Register handler
    log(7, 'Registering action handler')
    let handlerPayload = null

    channel.on(payload => {
      log(7.1, 'Handler executed with payload', payload)
      handlerPayload = payload
      return {ok: true}
    })

    // STEP 8: Check action after handler registration
    log(8, 'Checking action after handler registration')
    const actionAfterHandler = cyre.get(channel.id)
    log(8.1, 'Action state after handler registration', {
      exists: !!actionAfterHandler,
      hasMiddleware: !!(actionAfterHandler && actionAfterHandler.middleware),
      middleware: actionAfterHandler?.middleware
    })

    // STEP 9: Call action with payload
    log(9, 'Calling action with payload')
    const testPayload = {value: 'test', timestamp: Date.now()}

    // Check action right before call
    const actionBeforeCall = cyre.get(channel.id)
    log(9.1, 'Action state immediately before call', {
      exists: !!actionBeforeCall,
      hasMiddleware: !!(actionBeforeCall && actionBeforeCall.middleware),
      middleware: actionBeforeCall?.middleware
    })

    const callResult = await channel.call(testPayload)

    // STEP 10: Verify results
    log(10, 'Call completed with result', callResult)
    log(10.1, 'Middleware executed?', middlewareExecuted)
    log(10.2, 'Handler received payload', handlerPayload)

    // STEP 11: Check action after call
    log(11, 'Checking action after call')
    const actionAfterCall = cyre.get(channel.id)
    log(11.1, 'Action state after call', {
      exists: !!actionAfterCall,
      hasMiddleware: !!(actionAfterCall && actionAfterCall.middleware),
      middleware: actionAfterCall?.middleware
    })

    // Verify expectations
    expect(middlewareExecuted).toBe(true)
    expect(handlerPayload).toHaveProperty('test', true)
    expect(handlerPayload).toHaveProperty('enhanced', true)
  })
})
