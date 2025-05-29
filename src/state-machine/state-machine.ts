// src/state-machine/state-machine.ts
// Core state machine implementation integrated with Cyre

import {log} from '../components/cyre-log'
import {metricsReport} from '../context/metrics-report'
import type {
  StateMachineConfig,
  StateMachineInterpreter,
  StateMachineEvent,
  StateValue,
  StateChangeEvent,
  StateMachineSnapshot,
  Transition,
  StateConfig,
  MachineId,
  StateId,
  EventType,
  Guard,
  StateAction,
  TransitionAction,
  ContextUpdater
} from '../types/state-machine'
import type {ActionPayload} from '../types/core'
import {cyre} from '../app'

/*

      C.Y.R.E - S.T.A.T.E - M.A.C.H.I.N.E
      
      State machine implementation using Cyre's reactive infrastructure:
      - Direct state transitions for synchronous behavior
      - Integrates with Cyre's TimeKeeper for delayed transitions
      - Built-in debugging and metrics collection
      - Functional programming approach with clear separation of concerns

*/

// Lazy load cyre to avoid circular dependency

interface MachineState<TContext = any> {
  config: StateMachineConfig<TContext>
  currentState: StateValue
  context: TContext
  running: boolean
  subscribers: Set<(event: StateChangeEvent<TContext>) => void>
  stateSubscribers: Map<
    StateId,
    Set<(context: TContext, event: StateMachineEvent) => void>
  >
  eventSubscribers: Map<
    EventType,
    Set<(event: StateMachineEvent, context: TContext) => void>
  >
  activeDelays: Map<
    string,
    {
      timerId: string
      target: StateId
      transition: Transition<TContext>
    }
  >
}

const machines = new Map<MachineId, MachineState>()
const interpreters = new Map<MachineId, StateMachineInterpreter>()

/**
 * Create state value from state ID and hierarchy
 */
const createStateValue = (
  stateId: StateId,
  previous?: StateId,
  path: StateId[] = [stateId],
  isFinal = false,
  meta?: Record<string, any>
): StateValue => ({
  current: stateId,
  previous,
  path,
  final: isFinal,
  meta
})

/**
 * Resolve string references to actual functions
 */
const resolveAction = <TContext>(
  action: StateAction<TContext> | TransitionAction<TContext> | string,
  config: StateMachineConfig<TContext>
): StateAction<TContext> | TransitionAction<TContext> | undefined => {
  if (typeof action === 'string') {
    return config.actions?.[action]
  }
  return action
}

/**
 * Resolve guard function
 */
const resolveGuard = <TContext>(
  guard: Guard<TContext> | string,
  config: StateMachineConfig<TContext>
): Guard<TContext> | undefined => {
  if (typeof guard === 'string') {
    return config.guards?.[guard]
  }
  return guard
}

/**
 * Execute actions with error handling
 */
const executeActions = async <TContext>(
  actions:
    | Array<StateAction<TContext> | TransitionAction<TContext> | string>
    | undefined,
  context: TContext,
  event: StateMachineEvent,
  config: StateMachineConfig<TContext>,
  machineId: MachineId,
  phase: 'entry' | 'exit' | 'transition'
): Promise<void> => {
  if (!actions?.length) return

  for (const action of actions) {
    try {
      const resolvedAction = resolveAction(action, config)
      if (resolvedAction) {
        await Promise.resolve(resolvedAction(context, event))
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error(
        `State machine ${machineId} ${phase} action failed: ${errorMessage}`
      )
      metricsReport.sensor.error(
        machineId,
        errorMessage,
        `state-machine-${phase}`
      )
    }
  }
}

/**
 * Evaluate guard condition
 */
const evaluateGuard = async <TContext>(
  guard: Guard<TContext> | string | undefined,
  context: TContext,
  event: StateMachineEvent,
  config: StateMachineConfig<TContext>
): Promise<boolean> => {
  if (!guard) return true

  try {
    const resolvedGuard = resolveGuard(guard, config)
    if (!resolvedGuard) return true

    return await Promise.resolve(resolvedGuard(context, event))
  } catch (error) {
    log.error(`Guard evaluation failed: ${error}`)
    return false
  }
}

/**
 * Update context using assign function
 */
const updateContext = async <TContext>(
  assign: ContextUpdater<TContext> | undefined,
  context: TContext,
  event: StateMachineEvent
): Promise<TContext> => {
  if (!assign) return context

  try {
    return await Promise.resolve(assign(context, event))
  } catch (error) {
    log.error(`Context update failed: ${error}`)
    return context
  }
}

/**
 * Get transition from state configuration
 */
const getTransition = <TContext>(
  stateConfig: StateConfig<TContext>,
  eventType: EventType
): Transition<TContext> | undefined => {
  const transitionDef = stateConfig.on?.[eventType]
  if (!transitionDef) return undefined

  if (typeof transitionDef === 'string') {
    return {target: transitionDef}
  }

  return transitionDef
}

/**
 * Setup delayed transitions using Cyre's TimeKeeper
 */
const setupDelayedTransitions = <TContext>(
  machineId: MachineId,
  stateConfig: StateConfig<TContext>,
  machineState: MachineState<TContext>
): void => {
  if (!stateConfig.after) return

  for (const [delayMs, transitionDef] of Object.entries(stateConfig.after)) {
    const delay = parseInt(delayMs, 10)
    const transition =
      typeof transitionDef === 'string'
        ? {target: transitionDef}
        : transitionDef

    const delayId = `${machineId}-delay-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`

    // Use Cyre's TimeKeeper for precise timing
    const cyreInstance = cyre
    const timerResult = cyreInstance.setTimer(
      delay,
      () => {
        // Clean up delay tracking
        machineState.activeDelays.delete(delayId)

        // Send internal timeout event
        const timeoutEvent: StateMachineEvent = {
          type: '__TIMEOUT',
          payload: {delayId, originalDelay: delay},
          timestamp: Date.now(),
          source: 'state-machine-timer'
        }

        // Process the delayed transition directly
        processEvent(machineId, timeoutEvent, transition)
      },
      delayId
    )

    if (timerResult.ok) {
      machineState.activeDelays.set(delayId, {
        timerId: delayId,
        target: transition.target,
        transition
      })
    }
  }
}

/**
 * Clear delayed transitions
 */
const clearDelayedTransitions = (machineState: MachineState): void => {
  const cyreInstance = cyre
  for (const [delayId] of machineState.activeDelays) {
    cyreInstance.clearTimer(delayId)
  }
  machineState.activeDelays.clear()
}

/**
 * Process state machine event - synchronous state transitions
 */
const processEvent = async <TContext>(
  machineId: MachineId,
  event: StateMachineEvent,
  forcedTransition?: Transition<TContext>
): Promise<void> => {
  const machineState = machines.get(machineId) as MachineState<TContext>
  if (!machineState || !machineState.running) return

  const {config, currentState, context} = machineState
  const currentStateConfig = config.states[currentState.current]

  if (!currentStateConfig) {
    log.error(`Invalid state: ${currentState.current} in machine ${machineId}`)
    return
  }

  // Handle multiple transitions for the same event type
  let transition = forcedTransition
  if (!transition) {
    const transitions = currentStateConfig.on?.[event.type]
    if (!transitions) {
      if (config.debug) {
        log.debug(
          `No transition for event ${event.type} in state ${currentState.current}`
        )
      }
      return
    }

    // If transitions is a string, convert to transition object
    if (typeof transitions === 'string') {
      transition = {target: transitions}
    } else if (Array.isArray(transitions)) {
      // Handle multiple transitions - find first matching guard
      for (const t of transitions) {
        const guardPassed = await evaluateGuard(t.guard, context, event, config)
        if (guardPassed) {
          transition = t
          break
        }
      }
    } else {
      transition = transitions
    }
  }

  if (!transition) {
    if (config.debug) {
      log.debug(`No valid transition found for event ${event.type}`)
    }
    return
  }

  // Evaluate guard for single transition
  const guardPassed = await evaluateGuard(
    transition.guard,
    context,
    event,
    config
  )
  if (!guardPassed) {
    if (config.debug) {
      log.debug(
        `Guard failed for transition ${currentState.current} -> ${transition.target}`
      )
    }
    return
  }

  // Internal transition - execute actions but don't change state
  if (transition.internal) {
    await executeActions(
      transition.actions,
      context,
      event,
      config,
      machineId,
      'transition'
    )
    const updatedContext = await updateContext(
      transition.assign,
      context,
      event
    )
    machineState.context = updatedContext
    return
  }

  const targetStateConfig = config.states[transition.target]
  if (!targetStateConfig) {
    log.error(
      `Invalid target state: ${transition.target} in machine ${machineId}`
    )
    return
  }

  // Execute exit actions for current state
  await executeActions(
    currentStateConfig.exit,
    context,
    event,
    config,
    machineId,
    'exit'
  )

  // Clear any active delayed transitions
  clearDelayedTransitions(machineState)

  // Execute transition actions
  await executeActions(
    transition.actions,
    context,
    event,
    config,
    machineId,
    'transition'
  )

  // Update context
  const updatedContext = await updateContext(transition.assign, context, event)

  // Create new state value
  const previousState = currentState
  const newState = createStateValue(
    transition.target,
    currentState.current,
    [transition.target],
    targetStateConfig.final || false,
    targetStateConfig.meta
  )

  // Update machine state
  machineState.currentState = newState
  machineState.context = updatedContext

  // Execute entry actions for new state
  await executeActions(
    targetStateConfig.entry,
    updatedContext,
    event,
    config,
    machineId,
    'entry'
  )

  // Setup delayed transitions for new state
  setupDelayedTransitions(machineId, targetStateConfig, machineState)

  // Create state change event
  const stateChangeEvent: StateChangeEvent<TContext> = {
    machineId,
    from: previousState,
    to: newState,
    event,
    context: updatedContext,
    transition,
    timestamp: Date.now()
  }

  // Notify subscribers
  machineState.subscribers.forEach(callback => {
    try {
      callback(stateChangeEvent)
    } catch (error) {
      log.error(`State change subscriber error: ${error}`)
    }
  })

  // Notify state-specific subscribers
  const stateSubscribers = machineState.stateSubscribers.get(newState.current)
  if (stateSubscribers) {
    stateSubscribers.forEach(callback => {
      try {
        callback(updatedContext, event)
      } catch (error) {
        log.error(`State subscriber error: ${error}`)
      }
    })
  }

  // Record metrics
  metricsReport.sensor.log(machineId, 'info', 'state-transition', {
    from: previousState.current,
    to: newState.current,
    event: event.type,
    final: newState.final
  })

  if (config.debug) {
    log.debug(
      `State machine ${machineId}: ${previousState.current} -> ${newState.current}`
    )
  }
}

/**
 * Create state machine interpreter
 */
export const createStateMachine = <TContext = any>(
  config: StateMachineConfig<TContext>
): StateMachineInterpreter<TContext> => {
  const machineId = config.id

  // Validate configuration
  if (!config.states[config.initial]) {
    throw new Error(`Initial state '${config.initial}' not found in states`)
  }

  // Initialize machine state
  const initialState = createStateValue(
    config.initial,
    undefined,
    [config.initial],
    config.states[config.initial].final || false,
    config.states[config.initial].meta
  )

  const machineState: MachineState<TContext> = {
    config,
    currentState: initialState,
    context: config.context || ({} as TContext),
    running: false,
    subscribers: new Set(),
    stateSubscribers: new Map(),
    eventSubscribers: new Map(),
    activeDelays: new Map()
  }

  // Store in registry
  machines.set(machineId, machineState)

  // Register with Cyre for event handling (optional integration)
  const cyreInstance = cyre
  cyreInstance.action({
    id: `state-machine-${machineId}`,
    type: 'state-machine',
    payload: {},
    priority: config.priority ? {level: config.priority} : undefined,
    detectChanges: false,
    log: config.debug || false
  })

  cyreInstance.on(`state-machine-${machineId}`, (event: StateMachineEvent) => {
    processEvent(machineId, event)
    return {handled: true, machineId, state: machineState.currentState.current}
  })

  const interpreter: StateMachineInterpreter<TContext> = {
    get id() {
      return machineId
    },

    get state() {
      return machineState.currentState
    },

    get context() {
      return machineState.context
    },

    get running() {
      return machineState.running
    },

    get final() {
      return machineState.currentState.final
    },

    start() {
      if (machineState.running) return

      machineState.running = true

      // Execute initial state entry actions
      const initialStateConfig = config.states[config.initial]
      const initialEvent: StateMachineEvent = {
        type: '__START',
        timestamp: Date.now(),
        source: 'state-machine-start'
      }

      executeActions(
        initialStateConfig.entry,
        machineState.context,
        initialEvent,
        config,
        machineId,
        'entry'
      )

      // Setup delayed transitions for initial state
      setupDelayedTransitions(machineId, initialStateConfig, machineState)

      metricsReport.sensor.log(machineId, 'info', 'state-machine-start', {
        initialState: config.initial
      })

      if (config.debug) {
        log.debug(
          `State machine ${machineId} started in state ${config.initial}`
        )
      }
    },

    stop() {
      if (!machineState.running) return

      machineState.running = false
      clearDelayedTransitions(machineState)

      metricsReport.sensor.log(machineId, 'info', 'state-machine-stop', {
        finalState: machineState.currentState.current
      })

      if (config.debug) {
        log.debug(`State machine ${machineId} stopped`)
      }
    },

    send(eventOrType: EventType | StateMachineEvent, payload?: ActionPayload) {
      if (!machineState.running) {
        if (config.debug) {
          log.warn(`Cannot send event to stopped machine ${machineId}`)
        }
        return
      }

      const event: StateMachineEvent =
        typeof eventOrType === 'string'
          ? {
              type: eventOrType,
              payload,
              timestamp: Date.now(),
              source: 'interpreter-send'
            }
          : eventOrType

      // Notify event subscribers
      const eventSubscribers = machineState.eventSubscribers.get(event.type)
      if (eventSubscribers) {
        eventSubscribers.forEach(callback => {
          try {
            callback(event, machineState.context)
          } catch (error) {
            log.error(`Event subscriber error: ${error}`)
          }
        })
      }

      // Process event directly (synchronous)
      processEvent(machineId, event)
    },

    getSnapshot(): StateMachineSnapshot<TContext> {
      const currentStateConfig =
        config.states[machineState.currentState.current]
      const availableTransitions: Record<EventType, StateId> = {}

      if (currentStateConfig.on) {
        for (const [eventType, transition] of Object.entries(
          currentStateConfig.on
        )) {
          const target =
            typeof transition === 'string' ? transition : transition.target
          availableTransitions[eventType] = target
        }
      }

      const activeDelays = Array.from(machineState.activeDelays.entries()).map(
        ([id, delay]) => ({
          id,
          target: delay.target,
          remainingTime: 0 // Would need to calculate actual remaining time
        })
      )

      return {
        id: machineId,
        state: machineState.currentState,
        context: machineState.context,
        canTransition: machineState.running && !machineState.currentState.final,
        availableTransitions,
        activeDelays,
        meta: config.meta
      }
    },

    can(eventType: EventType): boolean {
      if (!machineState.running || machineState.currentState.final) {
        return false
      }

      const currentStateConfig =
        config.states[machineState.currentState.current]
      return !!currentStateConfig.on?.[eventType]
    },

    getTransitions(): Record<EventType, StateId> {
      const currentStateConfig =
        config.states[machineState.currentState.current]
      const transitions: Record<EventType, StateId> = {}

      if (currentStateConfig.on) {
        for (const [eventType, transition] of Object.entries(
          currentStateConfig.on
        )) {
          const target =
            typeof transition === 'string' ? transition : transition.target
          transitions[eventType] = target
        }
      }

      return transitions
    },

    onStateChange(
      callback: (event: StateChangeEvent<TContext>) => void
    ): () => void {
      machineState.subscribers.add(callback)
      return () => machineState.subscribers.delete(callback)
    },

    onState(
      stateId: StateId,
      callback: (context: TContext, event: StateMachineEvent) => void
    ): () => void {
      if (!machineState.stateSubscribers.has(stateId)) {
        machineState.stateSubscribers.set(stateId, new Set())
      }
      const stateSubscribers = machineState.stateSubscribers.get(stateId)!
      stateSubscribers.add(callback)

      return () => stateSubscribers.delete(callback)
    },

    onEvent(
      eventType: EventType,
      callback: (event: StateMachineEvent, context: TContext) => void
    ): () => void {
      if (!machineState.eventSubscribers.has(eventType)) {
        machineState.eventSubscribers.set(eventType, new Set())
      }
      const eventSubscribers = machineState.eventSubscribers.get(eventType)!
      eventSubscribers.add(callback)

      return () => eventSubscribers.delete(callback)
    }
  }

  // Store in registry
  interpreters.set(machineId, interpreter)

  return interpreter
}

/**
 * Get existing state machine
 */
export const getStateMachine = <TContext = any>(
  id: MachineId
): StateMachineInterpreter<TContext> | undefined => {
  return interpreters.get(id) as StateMachineInterpreter<TContext> | undefined
}

/**
 * Remove state machine
 */
export const removeStateMachine = (id: MachineId): boolean => {
  const machineState = machines.get(id)
  if (!machineState) return false

  // Stop machine
  machineState.running = false
  clearDelayedTransitions(machineState)

  // Clean up Cyre resources
  const cyreInstance = cyre
  cyreInstance.forget(`state-machine-${id}`)

  // Remove from storage
  machines.delete(id)
  interpreters.delete(id)

  return true
}

/**
 * Clear all state machines
 */
export const clearStateMachines = (): void => {
  for (const [id] of machines) {
    removeStateMachine(id)
  }
}
