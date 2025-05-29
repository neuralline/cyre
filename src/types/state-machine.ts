// src/types/state-machine.ts
// State machine type definitions

import type {Priority, ActionPayload} from './core'

export type MachineId = string
export type StateId = string
export type EventType = string

/**
 * State value representing current state and metadata
 */
export interface StateValue {
  current: StateId
  previous?: StateId
  path: StateId[]
  final: boolean
  meta?: Record<string, any>
}

/**
 * State machine event
 */
export interface StateMachineEvent {
  type: EventType
  payload?: ActionPayload
  timestamp: number
  source?: string
}

/**
 * Guard function type
 */
export type Guard<TContext = any> = (
  context: TContext,
  event: StateMachineEvent
) => boolean | Promise<boolean>

/**
 * State action function type
 */
export type StateAction<TContext = any> = (
  context: TContext,
  event: StateMachineEvent
) => void | Promise<void>

/**
 * Transition action function type
 */
export type TransitionAction<TContext = any> = (
  context: TContext,
  event: StateMachineEvent
) => void | Promise<void>

/**
 * Context updater function type
 */
export type ContextUpdater<TContext = any> = (
  context: TContext,
  event: StateMachineEvent
) => TContext | Promise<TContext>

/**
 * Transition definition
 */
export interface Transition<TContext = any> {
  target: StateId
  guard?: Guard<TContext> | string
  actions?: Array<TransitionAction<TContext> | string>
  assign?: ContextUpdater<TContext>
  internal?: boolean
}

/**
 * State configuration
 */
export interface StateConfig<TContext = any> {
  id?: StateId
  entry?: Array<StateAction<TContext> | string>
  exit?: Array<StateAction<TContext> | string>
  on?: Record<EventType, Transition<TContext> | string>
  after?: Record<number, Transition<TContext> | string>
  final?: boolean
  meta?: Record<string, any>
}

/**
 * State machine configuration
 */
export interface StateMachineConfig<TContext = any> {
  id: MachineId
  initial: StateId
  states: Record<StateId, StateConfig<TContext>>
  context?: TContext
  guards?: Record<string, Guard<TContext>>
  actions?: Record<string, StateAction<TContext> | TransitionAction<TContext>>
  priority?: Priority
  debug?: boolean
  meta?: Record<string, any>
}

/**
 * State change event
 */
export interface StateChangeEvent<TContext = any> {
  machineId: MachineId
  from: StateValue
  to: StateValue
  event: StateMachineEvent
  context: TContext
  transition: Transition<TContext>
  timestamp: number
}

/**
 * State machine snapshot
 */
export interface StateMachineSnapshot<TContext = any> {
  id: MachineId
  state: StateValue
  context: TContext
  canTransition: boolean
  availableTransitions: Record<EventType, StateId>
  activeDelays: Array<{
    id: string
    target: StateId
    remainingTime: number
  }>
  meta?: Record<string, any>
}

/**
 * State machine interpreter
 */
export interface StateMachineInterpreter<TContext = any> {
  readonly id: MachineId
  readonly state: StateValue
  readonly context: TContext
  readonly running: boolean
  readonly final: boolean

  start(): void
  stop(): void
  send(eventType: EventType, payload?: ActionPayload): void
  send(event: StateMachineEvent): void
  getSnapshot(): StateMachineSnapshot<TContext>
  can(eventType: EventType): boolean
  getTransitions(): Record<EventType, StateId>

  onStateChange(
    callback: (event: StateChangeEvent<TContext>) => void
  ): () => void
  onState(
    stateId: StateId,
    callback: (context: TContext, event: StateMachineEvent) => void
  ): () => void
  onEvent(
    eventType: EventType,
    callback: (event: StateMachineEvent, context: TContext) => void
  ): () => void
}

/**
 * State machine service
 */
export interface StateMachineService {
  create<TContext = any>(
    config: StateMachineConfig<TContext>
  ): StateMachineInterpreter<TContext>
  get<TContext = any>(
    id: MachineId
  ): StateMachineInterpreter<TContext> | undefined
  remove(id: MachineId): boolean
  getAll(): StateMachineInterpreter[]
  clear(): void
}
