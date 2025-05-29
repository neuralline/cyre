// src/state-machine/builders.ts
// Builder utilities for creating state machines with fluent API

import type {
  StateMachineConfig,
  StateConfig,
  Transition,
  Guard,
  StateAction,
  TransitionAction,
  MachineId,
  StateId,
  EventType
} from '../types/state-machine'
import type {Priority} from '../types/core'

/*
  
        C.Y.R.E - S.T.A.T.E - M.A.C.H.I.N.E - B.U.I.L.D.E.R.S
        
        Fluent API builders for creating state machines:
        - Intuitive state machine construction
        - Type-safe configuration
        - Common patterns and shortcuts
        - Integration with Cyre features
  
  */

/**
 * State builder for fluent API
 */
export class StateBuilder<TContext = any> {
  private config: StateConfig<TContext>
  private machineBuilder: MachineBuilder<TContext>

  constructor(id: StateId, machineBuilder: MachineBuilder<TContext>) {
    this.config = {id}
    this.machineBuilder = machineBuilder
  }

  /**
   * Add entry actions
   */
  entry(...actions: Array<StateAction<TContext> | string>): this {
    this.config.entry = actions
    return this
  }

  /**
   * Add exit actions
   */
  exit(...actions: Array<StateAction<TContext> | string>): this {
    this.config.exit = actions
    return this
  }

  /**
   * Add event transition
   */
  on(event: EventType, target: StateId | Transition<TContext>): this {
    if (!this.config.on) this.config.on = {}
    this.config.on[event] = target
    return this
  }

  /**
   * Add conditional transition
   */
  when(
    event: EventType,
    guard: Guard<TContext> | string,
    target: StateId
  ): this {
    if (!this.config.on) this.config.on = {}
    this.config.on[event] = {target, guard}
    return this
  }

  /**
   * Add transition with actions
   */
  do(
    event: EventType,
    target: StateId,
    ...actions: Array<TransitionAction<TContext> | string>
  ): this {
    if (!this.config.on) this.config.on = {}
    this.config.on[event] = {target, actions}
    return this
  }

  /**
   * Add delayed transition
   */
  after(delay: number, target: StateId | Transition<TContext>): this {
    if (!this.config.after) this.config.after = {}
    this.config.after[delay] = target
    return this
  }

  /**
   * Mark as final state
   */
  final(): this {
    this.config.final = true
    return this
  }

  /**
   * Add metadata
   */
  meta(metadata: Record<string, any>): this {
    this.config.meta = metadata
    return this
  }

  /**
   * Return to machine builder to add more states
   */
  state(id: StateId): StateBuilder<TContext> {
    // Finalize current state and return machine builder's state method
    this.machineBuilder.addStateConfig(this.config.id, this.config)
    return this.machineBuilder.state(id)
  }

  /**
   * Build the machine configuration
   */
  build(): StateMachineConfig<TContext> {
    // Finalize current state
    this.machineBuilder.addStateConfig(this.config.id, this.config)
    return this.machineBuilder.build()
  }

  /**
   * Build just this state configuration
   */
  buildState(): StateConfig<TContext> {
    return {...this.config}
  }
}

/**
 * Machine builder for fluent API
 */
export class MachineBuilder<TContext = any> {
  private config: Partial<StateMachineConfig<TContext>>
  private stateConfigs: Map<StateId, StateConfig<TContext>>

  constructor(id: MachineId) {
    this.config = {id, states: {}}
    this.stateConfigs = new Map()
  }

  /**
   * Set initial state
   */
  initial(stateId: StateId): this {
    this.config.initial = stateId
    return this
  }

  /**
   * Set initial context
   */
  context(context: TContext): this {
    this.config.context = context
    return this
  }

  /**
   * Add global guards
   */
  guards(guards: Record<string, Guard<TContext>>): this {
    this.config.guards = guards
    return this
  }

  /**
   * Add global actions
   */
  actions(
    actions: Record<string, StateAction<TContext> | TransitionAction<TContext>>
  ): this {
    this.config.actions = actions
    return this
  }

  /**
   * Set priority
   */
  priority(priority: Priority): this {
    this.config.priority = priority
    return this
  }

  /**
   * Enable debug mode
   */
  debug(enable = true): this {
    this.config.debug = enable
    return this
  }

  /**
   * Add metadata
   */
  meta(metadata: Record<string, any>): this {
    this.config.meta = metadata
    return this
  }

  /**
   * Create state builder
   */
  state(id: StateId): StateBuilder<TContext> {
    return new StateBuilder<TContext>(id, this)
  }

  /**
   * Add state configuration (used by StateBuilder)
   */
  addStateConfig(id: StateId, config: StateConfig<TContext>): void {
    this.stateConfigs.set(id, config)
  }

  /**
   * Build the machine configuration
   */
  build(): StateMachineConfig<TContext> {
    if (!this.config.initial) {
      throw new Error('Initial state is required')
    }

    // Build all states from stateConfigs
    const states: Record<StateId, StateConfig<TContext>> = {}
    for (const [id, config] of this.stateConfigs) {
      states[id] = config
    }

    if (Object.keys(states).length === 0) {
      throw new Error('At least one state is required')
    }

    if (!states[this.config.initial]) {
      throw new Error(`Initial state '${this.config.initial}' not found`)
    }

    return {
      ...this.config,
      states
    } as StateMachineConfig<TContext>
  }
}

/**
 * Create a new machine builder
 */
export const machine = <TContext = any>(
  id: MachineId
): MachineBuilder<TContext> => {
  return new MachineBuilder<TContext>(id)
}

/**
 * Common state machine patterns
 */
export const patterns = {
  /**
   * Simple toggle between two states
   */
  toggle<TContext = any>(
    id: MachineId,
    state1: StateId,
    state2: StateId,
    toggleEvent = 'TOGGLE'
  ): StateMachineConfig<TContext> {
    return machine<TContext>(id)
      .initial(state1)
      .state(state1)
      .on(toggleEvent, state2)
      .state(state2)
      .on(toggleEvent, state1)
      .build()
  },

  /**
   * Request/response pattern with loading, success, error states
   */
  request<TContext = any>(
    id: MachineId,
    options: {
      idleState?: StateId
      loadingState?: StateId
      successState?: StateId
      errorState?: StateId
      timeout?: number
    } = {}
  ): StateMachineConfig<TContext> {
    const {
      idleState = 'idle',
      loadingState = 'loading',
      successState = 'success',
      errorState = 'error',
      timeout = 30000
    } = options

    const builder = machine<TContext>(id)
      .initial(idleState)
      .state(idleState)
      .on('REQUEST', loadingState)
      .state(loadingState)
      .on('SUCCESS', successState)
      .on('ERROR', errorState)
      .on('CANCEL', idleState)
      .state(successState)
      .on('REQUEST', loadingState)
      .on('RESET', idleState)
      .state(errorState)
      .on('REQUEST', loadingState)
      .on('RETRY', loadingState)
      .on('RESET', idleState)

    if (timeout > 0) {
      builder.state(loadingState).after(timeout, errorState)
    }

    return builder.build()
  },

  /**
   * Multi-step wizard/form pattern
   */
  wizard<TContext = any>(
    id: MachineId,
    steps: StateId[],
    options: {
      canGoBack?: boolean
      autoAdvance?: boolean
      finalState?: StateId
    } = {}
  ): StateMachineConfig<TContext> {
    const {
      canGoBack = true,
      autoAdvance = false,
      finalState = 'completed'
    } = options

    if (steps.length === 0) {
      throw new Error('At least one step is required')
    }

    const builder = machine<TContext>(id).initial(steps[0])

    steps.forEach((step, index) => {
      const stateBuilder = builder.state(step)

      // Next step
      if (index < steps.length - 1) {
        const nextEvent = autoAdvance ? 'AUTO_NEXT' : 'NEXT'
        stateBuilder.on(nextEvent, steps[index + 1])
      } else {
        // Last step goes to final state
        const completeEvent = autoAdvance ? 'AUTO_COMPLETE' : 'COMPLETE'
        stateBuilder.on(completeEvent, finalState)
      }

      // Previous step
      if (canGoBack && index > 0) {
        stateBuilder.on('BACK', steps[index - 1])
      }

      // Cancel from any step
      stateBuilder.on('CANCEL', 'cancelled')
    })

    // Add final states
    builder.state(finalState).final()
    builder.state('cancelled').final()

    return builder.build()
  },

  /**
   * Retry pattern with exponential backoff
   */
  retry<TContext = any>(
    id: MachineId,
    maxRetries = 3,
    baseDelay = 1000
  ): StateMachineConfig<TContext> {
    const builder = machine<TContext>(id)
      .initial('idle')
      .context({retryCount: 0, maxRetries, baseDelay} as TContext)
      .state('idle')
      .on('START', 'attempting')
      .state('attempting')
      .on('SUCCESS', 'success')
      .on('FAILURE', 'failed')
      .state('failed')
      .when('RETRY', 'canRetry', 'retrying')
      .when('RETRY', 'maxRetriesReached', 'exhausted')
      .state('retrying')
      .after(1000, 'attempting') // Will be dynamic based on context
      .state('success')
      .final()
      .state('exhausted')
      .final()
      .guards({
        canRetry: (context: any) => context.retryCount < context.maxRetries,
        maxRetriesReached: (context: any) =>
          context.retryCount >= context.maxRetries
      })

    return builder.build()
  },

  /**
   * Authentication flow pattern
   */
  auth<TContext = any>(
    id: MachineId,
    options: {
      sessionTimeout?: number
      maxLoginAttempts?: number
    } = {}
  ): StateMachineConfig<TContext> {
    const {sessionTimeout = 900000, maxLoginAttempts = 3} = options // 15 min default

    return machine<TContext>(id)
      .initial('unauthenticated')
      .context({loginAttempts: 0, maxLoginAttempts} as TContext)
      .state('unauthenticated')
      .on('LOGIN_ATTEMPT', 'authenticating')
      .state('authenticating')
      .on('LOGIN_SUCCESS', 'authenticated')
      .on('LOGIN_FAILURE', 'loginFailed')
      .after(10000, 'loginTimeout') // 10s login timeout
      .state('loginFailed')
      .when('RETRY', 'canRetry', 'authenticating')
      .when('RETRY', 'maxAttemptsReached', 'locked')
      .state('authenticated')
      .on('LOGOUT', 'unauthenticated')
      .on('SESSION_EXPIRED', 'unauthenticated')
      .after(sessionTimeout, 'unauthenticated')
      .state('loginTimeout')
      .on('RETRY', 'authenticating')
      .after(5000, 'unauthenticated') // Auto-reset after 5s
      .state('locked')
      .after(300000, 'unauthenticated') // 5 min lockout
      .guards({
        canRetry: (context: any) =>
          context.loginAttempts < context.maxLoginAttempts,
        maxAttemptsReached: (context: any) =>
          context.loginAttempts >= context.maxLoginAttempts
      })
      .build()
  }
}

/**
 * Validation utilities
 */
export const validate = {
  /**
   * Validate state machine configuration
   */
  config<TContext>(config: StateMachineConfig<TContext>): string[] {
    const errors: string[] = []

    if (!config.id) errors.push('Machine ID is required')
    if (!config.initial) errors.push('Initial state is required')
    if (!config.states || Object.keys(config.states).length === 0) {
      errors.push('At least one state is required')
    }

    if (config.initial && config.states && !config.states[config.initial]) {
      errors.push(`Initial state '${config.initial}' not found`)
    }

    // Validate transitions
    if (config.states) {
      for (const [stateId, stateConfig] of Object.entries(config.states)) {
        if (stateConfig.on) {
          for (const [event, transition] of Object.entries(stateConfig.on)) {
            const target =
              typeof transition === 'string' ? transition : transition.target
            if (!config.states[target]) {
              errors.push(
                `Invalid target '${target}' in state '${stateId}' for event '${event}'`
              )
            }
          }
        }

        if (stateConfig.after) {
          for (const [delay, transition] of Object.entries(stateConfig.after)) {
            const target =
              typeof transition === 'string' ? transition : transition.target
            if (!config.states[target]) {
              errors.push(
                `Invalid target '${target}' in delayed transition from state '${stateId}'`
              )
            }
          }
        }
      }
    }

    return errors
  },

  /**
   * Check for unreachable states
   */
  reachability<TContext>(config: StateMachineConfig<TContext>): StateId[] {
    const reachable = new Set<StateId>([config.initial])
    const queue = [config.initial]

    while (queue.length > 0) {
      const currentState = queue.shift()!
      const stateConfig = config.states[currentState]

      if (stateConfig.on) {
        for (const transition of Object.values(stateConfig.on)) {
          const target =
            typeof transition === 'string' ? transition : transition.target
          if (!reachable.has(target)) {
            reachable.add(target)
            queue.push(target)
          }
        }
      }

      if (stateConfig.after) {
        for (const transition of Object.values(stateConfig.after)) {
          const target =
            typeof transition === 'string' ? transition : transition.target
          if (!reachable.has(target)) {
            reachable.add(target)
            queue.push(target)
          }
        }
      }
    }

    const allStates = Object.keys(config.states)
    const unreachable = allStates.filter(state => !reachable.has(state))

    return unreachable
  }
}
