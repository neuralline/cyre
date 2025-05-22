// src/types/global.d.ts

/**
 * Global CYRE API declarations - no imports to avoid conflicts
 */

// Re-declare essential types locally to avoid import conflicts
declare global {
  // Core Types
  type ActionPayload = unknown
  type ActionId = string
  type Priority = 'critical' | 'high' | 'medium' | 'low' | 'background'

  // Event Handler Types
  type EventHandler = (
    payload?: unknown
  ) => void | Promise<void> | {id: string; payload?: unknown}

  // Response Types
  interface CyreResponse<T = unknown> {
    ok: boolean
    payload: T
    message: string
    error?: Error
    timestamp?: number
  }

  interface SubscriptionResponse {
    ok: boolean
    message: string
    unsubscribe?: () => boolean
  }

  // Action Configuration
  interface IO {
    id: string
    type?: string
    payload?: ActionPayload
    interval?: number
    repeat?: number | boolean
    delay?: number
    throttle?: number
    debounce?: number
    detectChanges?: boolean
    log?: boolean
    priority?: {level: Priority}
    middleware?: string[]
    [key: string]: any
  }

  // Breathing Metrics
  interface BreathingMetrics {
    breathCount: number
    currentRate: number
    lastBreath: number
    stress: number
    isRecuperating: boolean
    recuperationDepth: number
    pattern: string
    nextBreathDue: number
  }

  // Timekeeper Metrics
  interface TimekeeperMetrics {
    hibernating: boolean
    activeFormations: number
    inRecuperation: boolean
    breathing: BreathingMetrics
    formations: Array<{
      id: string
      duration: number
      executionCount: number
      status: 'active' | 'paused'
      nextExecutionTime: number
      isInRecuperation: boolean
      breathingSync: number
    }>
  }

  // Hook Types
  interface CyreHookOptions<TPayload = ActionPayload> {
    name?: string
    tag?: string
    autoInit?: boolean
    debug?: boolean
    protection?: {
      throttle?: number
      debounce?: number
      detectChanges?: boolean
    }
    priority?: {level: Priority}
    initialPayload?: TPayload
    historyLimit?: number
  }

  interface CyreHook<TPayload = ActionPayload> {
    id: string
    name: string
    action: (
      config: Omit<IO, 'id'>
    ) => {success: true; value: boolean} | {success: false; error: Error}
    on: (handler: EventHandler) => {unsubscribe: () => void}
    call: (payload?: TPayload) => Promise<CyreResponse>
    safeCall: (
      payload?: TPayload
    ) => Promise<
      {success: true; value: CyreResponse} | {success: false; error: Error}
    >
    get: () => IO | undefined
    forget: () => boolean
    pause: () => void
    resume: () => void
    hasChanged: (payload: TPayload) => boolean
    getPrevious: () => TPayload | undefined
    metrics: () => any
    getBreathingState: () => BreathingMetrics
    isInitialized: () => boolean
    middleware: (middleware: any) => void
    getHistory: () => ReadonlyArray<any>
    clearHistory: () => void
    getSubscriptionCount: () => number
  }

  type CyreChannel<TPayload = ActionPayload> = CyreHook<TPayload>

  /**
   * Main CYRE instance available globally
   */
  interface Window {
    cyre: CyreInstance
    useCyre: UseCyreFunction
    cyreCompose: CyreComposeFunction
  }

  /**
   * Node.js global extensions for CYRE
   */
  namespace NodeJS {
    interface Global {
      cyre: CyreInstance
    }

    interface ProcessEnv {
      CYRE_LOG_LEVEL?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
      CYRE_BREATHING_ENABLED?: 'true' | 'false'
      CYRE_METRICS_ENABLED?: 'true' | 'false'
    }
  }

  /**
   * CYRE Core Instance Interface
   */
  interface CyreInstance {
    /**
     * Initialize the CYRE system
     */
    initialize(): CyreResponse

    /**
     * Register an action or array of actions
     * @param attribute Action configuration or array of configurations
     */
    action(attribute: IO | IO[]): void

    /**
     * Subscribe to events by action ID
     * @param type Action ID or array of subscriber objects
     * @param fn Event handler function
     */
    on(
      type: string | Array<{id: string; fn: EventHandler}>,
      fn?: EventHandler
    ): SubscriptionResponse

    /**
     * Call an action by ID with optional payload
     * @param id Action ID to call
     * @param payload Optional payload data
     */
    call(id?: string, payload?: ActionPayload): Promise<CyreResponse>

    /**
     * Remove an action and cancel associated timers
     * @param id Action ID to remove
     */
    forget(id: string): boolean

    /**
     * Get current state of an action
     * @param id Action ID to retrieve
     */
    get(id: string): IO | undefined

    /**
     * Pause execution of specific action or all actions
     * @param id Optional action ID - if omitted, pauses all
     */
    pause(id?: string): void

    /**
     * Resume execution of paused action or all actions
     * @param id Optional action ID - if omitted, resumes all
     */
    resume(id?: string): void

    /**
     * Check if payload has changed from previous execution
     * @param id Action ID to check
     * @param payload New payload to compare
     */
    hasChanged(id: string, payload: ActionPayload): boolean

    /**
     * Get previous payload for an action
     * @param id Action ID
     */
    getPrevious(id: string): ActionPayload | undefined

    /**
     * Lock system to prevent new actions/subscribers
     */
    lock(): CyreResponse

    /**
     * Check if system is shutdown
     * @returns True if shutdown, false if online
     */
    status(): boolean

    /**
     * Shutdown CYRE system completely
     */
    shutdown(): void

    /**
     * Clear all actions and subscribers
     */
    clear(): void

    /**
     * Get current breathing state metrics
     */
    getBreathingState(): Readonly<BreathingMetrics>

    /**
     * Get performance state metrics
     */
    getPerformanceState(): {
      totalProcessingTime: number
      totalCallTime: number
      totalStress: number
      stress: number
    }

    /**
     * Get detailed metrics for specific action
     * @param channelId Action ID to get metrics for
     */
    getMetrics(channelId: string): TimekeeperMetrics

    /**
     * Get execution history
     * @param actionId Optional action ID - if omitted, gets all history
     */
    getHistory(actionId?: string): Array<{
      actionId: string
      timestamp: number
      payload: ActionPayload
      result: {
        ok: boolean
        message?: string
        error?: string
      }
      duration?: number
    }>

    /**
     * Clear execution history
     * @param actionId Optional action ID - if omitted, clears all history
     */
    clearHistory(actionId?: string): void

    /**
     * Register middleware function
     * @param id Unique middleware identifier
     * @param fn Middleware function
     */
    middleware(id: string, fn: Function): CyreResponse

    /**
     * Get comprehensive metrics report
     */
    getMetricsReport(): {
      actions: Array<any>
      global: any
      insights: string[]
    }

    /**
     * Log metrics report to console
     * @param filter Optional filter function for metrics
     */
    logMetricsReport(filter?: (metrics: any) => boolean): void
  }

  /**
   * CYRE Hook Function Type
   */
  type UseCyreFunction = <TPayload = ActionPayload>(
    options?: CyreHookOptions<TPayload>
  ) => CyreHook<TPayload>

  /**
   * CYRE Compose Function Type
   */
  type CyreComposeFunction = <TPayload = ActionPayload>(
    channels: CyreChannel<TPayload>[],
    options?: {
      id?: string
      continueOnError?: boolean
    }
  ) => {
    id: string
    call: (payload?: TPayload) => Promise<CyreResponse[]>
    on: (handler: EventHandler) => {unsubscribe: () => void}
    pause: () => void
    resume: () => void
    forget: () => boolean
    getChannelIds: () => string[]
  }

  /**
   * CYRE Stream Types
   */
  interface CyreStream<T> {
    id: string
    next: (value: T) => Promise<void>
    complete: () => void
    subscribe: (observer: (value: T) => void | Promise<void>) => {
      unsubscribe: () => void
    }
    isCompleted: () => boolean
    map: <R>(fn: (value: T) => R | Promise<R>) => CyreStream<R>
    filter: (predicate: (value: T) => boolean) => CyreStream<T>
    tap: (fn: (value: T) => void | Promise<void>) => CyreStream<T>
    take: (count: number) => CyreStream<T>
    skip: (count: number) => CyreStream<T>
    distinct: () => CyreStream<T>
    debounce: (ms: number) => CyreStream<T>
    throttle: (ms: number) => CyreStream<T>
    catchError: (handler: (error: Error, value?: T) => T) => CyreStream<T>
    switchMap: <R>(fn: (value: T) => CyreStream<R>) => CyreStream<R>
    merge: <R>(otherStream: CyreStream<R>) => CyreStream<T | R>
    zip: <R, O = [T, R]>(
      otherStream: CyreStream<R>,
      combiner?: (a: T, b: R) => O
    ) => CyreStream<O>
  }

  /**
   * Create Stream Function Type
   */
  type CreateStreamFunction = <T>(id: string) => CyreStream<T>

  /**
   * CYRE Action Configuration Helpers
   */
  interface CyreActionHelpers {
    /**
     * Create action with interval timing
     */
    interval(ms: number): Partial<IO>

    /**
     * Create action with delay
     */
    delay(ms: number): Partial<IO>

    /**
     * Create action with repeat configuration
     */
    repeat(count: number | boolean): Partial<IO>

    /**
     * Create action with throttle protection
     */
    throttle(ms: number): Partial<IO>

    /**
     * Create action with debounce protection
     */
    debounce(ms: number): Partial<IO>

    /**
     * Create action with change detection
     */
    detectChanges(): Partial<IO>

    /**
     * Create action with priority
     */
    priority(level: Priority): Partial<IO>

    /**
     * Create action with middleware
     */
    withMiddleware(middlewareIds: string[]): Partial<IO>
  }

  /**
   * CYRE Middleware Types
   */
  type CyreMiddlewareFunction = (
    action: IO,
    payload: ActionPayload
  ) =>
    | Promise<{action: IO; payload: ActionPayload} | null>
    | {action: IO; payload: ActionPayload}
    | null

  /**
   * CYRE Error Types
   */
  interface CyreError extends Error {
    code: string
    actionId?: string
    timestamp: number
    context?: Record<string, unknown>
  }

  /**
   * CYRE Event Types
   */
  interface CyreEvents {
    'action:registered': {actionId: string; config: IO}
    'action:called': {actionId: string; payload: ActionPayload}
    'action:executed': {
      actionId: string
      result: CyreResponse
      duration: number
    }
    'action:failed': {actionId: string; error: Error}
    'system:breathing': {state: BreathingMetrics}
    'system:recuperating': {isRecuperating: boolean; depth: number}
    'system:overloaded': {metrics: any}
    'subscriber:added': {actionId: string}
    'subscriber:removed': {actionId: string}
    'middleware:registered': {middlewareId: string}
    'middleware:executed': {middlewareId: string; actionId: string}
    'middleware:rejected': {middlewareId: string; actionId: string}
  }

  /**
   * CYRE Configuration Types
   */
  interface CyreConfig {
    breathing: {
      enabled: boolean
      rates: {
        min: number
        base: number
        max: number
        recovery: number
      }
      thresholds: {
        low: number
        medium: number
        high: number
        critical: number
      }
    }
    protection: {
      enabled: boolean
      throttle: {
        min: number
        default: number
      }
      debounce: {
        min: number
        default: number
      }
    }
    logging: {
      level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
      enabled: boolean
    }
    metrics: {
      enabled: boolean
      historyLimit: number
    }
  }

  /**
   * CYRE Plugin System
   */
  interface CyrePlugin {
    name: string
    version: string
    install: (cyre: CyreInstance) => void | Promise<void>
    uninstall?: (cyre: CyreInstance) => void | Promise<void>
  }

  /**
   * CYRE Testing Utilities
   */
  interface CyreTestUtils {
    /**
     * Mock CYRE instance for testing
     */
    mockCyre(): CyreInstance

    /**
     * Reset CYRE to initial state
     */
    resetCyre(): void

    /**
     * Wait for action to complete
     */
    waitForAction(actionId: string, timeout?: number): Promise<CyreResponse>

    /**
     * Simulate system stress
     */
    simulateStress(level: number): void

    /**
     * Get test metrics
     */
    getTestMetrics(): any
  }
}

/**
 * Module declarations for CYRE imports
 */
declare module 'cyre' {
  const cyre: CyreInstance
  const Cyre: (line?: string) => CyreInstance
  const useCyre: UseCyreFunction
  const cyreCompose: CyreComposeFunction
  const createStream: CreateStreamFunction
  const log: {
    error: (message: unknown, timestamp?: boolean) => void
    warn: (message: unknown, timestamp?: boolean) => void
    info: (message: unknown, timestamp?: boolean) => void
    debug: (message: unknown, timestamp?: boolean) => void
    success: (message: unknown, timestamp?: boolean) => void
    critical: (message: unknown, timestamp?: boolean) => void
    sys: (message: unknown, timestamp?: boolean) => void
  }
  const version: string

  // Export types
  export {cyre, Cyre, useCyre, cyreCompose, createStream, log, version}
  export type {
    IO,
    ActionPayload,
    CyreResponse,
    EventHandler,
    SubscriptionResponse,
    CyreHook,
    CyreChannel,
    CyreHookOptions,
    Priority,
    BreathingMetrics,
    TimekeeperMetrics
  }
}

/**
 * Ambient module declarations
 */
declare module 'cyre/streams' {
  export const createStream: CreateStreamFunction
  export const mergeStreams: <T>(...streams: CyreStream<T>[]) => CyreStream<T>
  export const interval: (ms: number) => CyreStream<number>
  export const timer: (delay: number) => CyreStream<void>
  export type {CyreStream}
}

declare module 'cyre/hooks' {
  export const useCyre: UseCyreFunction
  export const cyreCompose: CyreComposeFunction
  export type {CyreHook, CyreChannel, CyreHookOptions}
}

declare module 'cyre/ssr' {
  export const prepareSSR: <T = any>(
    renderFn: () => Promise<T> | T,
    options?: any
  ) => Promise<any>
  export const hydrateFromSSR: (
    state: Record<string, any> | string,
    options?: any
  ) => void
  export const serializeState: (
    state: Record<string, any>,
    serializeFn?: (state: Record<string, any>) => string
  ) => string
  export const generateHTML: (
    html: string,
    state: Record<string, any>,
    options?: any
  ) => string
}

/**
 * Extend existing globals
 */
declare global {
  interface Performance {
    now(): number
  }

  interface Console {
    sys: (message?: any, ...optionalParams: any[]) => void
  }
}

export {}
