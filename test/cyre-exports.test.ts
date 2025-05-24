// test/cyre-exports.test.ts
// Test to verify all Cyre exports are working correctly

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

// Test both import styles
import cyre from '../src/index' // default import
import {
  cyre as namedCyre,
  useCyre,
  cyreCompose,
  log,
  version
} from '../src/index' // named imports

// Test type imports (these should not cause compilation errors)
import type {
  CyreIO,
  CyreEventHandler,
  CyreActionPayload,
  CyreHookType,
  CyreChannelType,
  CompositionOptions,
  CyreHookOptions,
  ProtectionOptions
} from '../src/index'

describe('Cyre Exports Test', () => {
  beforeEach(() => {
    // Mock process.exit to prevent test termination
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    // Initialize both cyre instances
    cyre.initialize()
    namedCyre.initialize()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should export cyre as default', () => {
    expect(cyre).toBeDefined()
    expect(typeof cyre.initialize).toBe('function')
    expect(typeof cyre.action).toBe('function')
    expect(typeof cyre.on).toBe('function')
    expect(typeof cyre.call).toBe('function')
  })

  it('should export cyre as named export', () => {
    expect(namedCyre).toBeDefined()
    expect(typeof namedCyre.initialize).toBe('function')
    expect(typeof namedCyre.action).toBe('function')
    expect(typeof namedCyre.on).toBe('function')
    expect(typeof namedCyre.call).toBe('function')
  })

  it('should have both exports point to the same instance', () => {
    expect(cyre).toBe(namedCyre)
  })

  it('should export useCyre hook', () => {
    expect(useCyre).toBeDefined()
    expect(typeof useCyre).toBe('function')

    // Test creating a channel
    const channel = useCyre({name: 'test-channel'})
    expect(channel).toBeDefined()
    expect(channel.id).toBeDefined()
    expect(channel.name).toBe('test-channel')
  })

  it('should export cyreCompose function', () => {
    expect(cyreCompose).toBeDefined()
    expect(typeof cyreCompose).toBe('function')

    // Test creating composed channels
    const channel1 = useCyre({name: 'channel1'})
    const channel2 = useCyre({name: 'channel2'})
    const composed = cyreCompose([channel1, channel2])

    expect(composed).toBeDefined()
    expect(composed.id).toBeDefined()
  })

  it('should export log utility', () => {
    expect(log).toBeDefined()
    expect(typeof log.info).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.debug).toBe('function')
  })

  it('should export version', () => {
    expect(version).toBeDefined()
    expect(typeof version).toBe('string')
    expect(version).toBe('4.0.0')
  })

  it('should work with basic functionality', async () => {
    const testActionId = `export-test-${Date.now()}`
    let handlerCalled = false

    // Register handler
    cyre.on(testActionId, payload => {
      handlerCalled = true
      return {success: true, payload}
    })

    // Create action
    cyre.action({
      id: testActionId,
      type: 'test',
      payload: {message: 'test'}
    })

    // Call action
    await cyre.call(testActionId, {message: 'export test'})

    // Verify
    expect(handlerCalled).toBe(true)

    // Clean up
    cyre.forget(testActionId)
  })

  it('should work with hooks', async () => {
    const channel = useCyre({
      name: 'export-test-hook',
      protection: {
        throttle: 100,
        debounce: 50,
        detectChanges: true
      }
    })

    let handlerCalled = false

    // Subscribe
    const subscription = channel.on(payload => {
      handlerCalled = true
      return {success: true}
    })

    // Call
    await channel.call({message: 'hook test'})

    // Verify
    expect(handlerCalled).toBe(true)
    expect(subscription.ok).toBe(true)

    // Clean up
    if (subscription.unsubscribe) {
      subscription.unsubscribe()
    }
    channel.forget()
  })

  it('should work with composition', async () => {
    const channel1 = useCyre({name: 'compose-test-1'})
    const channel2 = useCyre({name: 'compose-test-2'})

    let handler1Called = false
    let handler2Called = false

    // Set up handlers
    channel1.on(() => {
      handler1Called = true
      return {success: true}
    })

    channel2.on(() => {
      handler2Called = true
      return {success: true}
    })

    // Compose channels
    const composed = cyreCompose([channel1, channel2])

    // Call composed channel
    const result = await composed.call({message: 'compose test'})

    // Verify
    expect(result.ok).toBe(true)
    expect(handler1Called).toBe(true)
    expect(handler2Called).toBe(true)

    // Clean up
    composed.forget()
  })

  it('should properly type check with TypeScript', () => {
    // These should compile without errors
    const action: CyreIO = {
      id: 'type-test',
      type: 'test',
      payload: {message: 'type test'}
    }

    const handler: CyreEventHandler = payload => {
      return {success: true}
    }

    const hookOptions: CyreHookOptions = {
      name: 'type-test-hook',
      protection: {
        throttle: 100,
        debounce: 50
      }
    }

    const protectionOptions: ProtectionOptions = {
      throttle: 200,
      detectChanges: true
    }

    const compositionOptions: CompositionOptions = {
      continueOnError: true,
      priority: 'high'
    }

    // Verify they're properly typed
    expect(action.id).toBe('type-test')
    expect(typeof handler).toBe('function')
    expect(hookOptions.name).toBe('type-test-hook')
    expect(protectionOptions.throttle).toBe(200)
    expect(compositionOptions.priority).toBe('high')
  })
})
