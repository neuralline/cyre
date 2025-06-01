// src/state-machine/index.ts
// Main exports for Cyre state machine system

export {
  createStateMachine,
  removeStateMachine,
  clearStateMachines
} from './state-machine'

export {
  stateMachineService,
  createAndStartStateMachine,
  getStateMachineStats,
  debugStateMachines,
  enableDebug
} from './state-machine-service'

export {
  machine,
  patterns,
  validate,
  StateBuilder,
  MachineBuilder
} from './builders'

// Re-export types
export type {
  StateMachineConfig,
  StateMachineInterpreter,
  StateMachineService,
  StateMachineEvent,
  StateValue,
  StateChangeEvent,
  StateMachineSnapshot,
  Transition,
  StateConfig,
  Guard,
  StateAction,
  TransitionAction,
  ContextUpdater,
  MachineId,
  StateId,
  EventType
} from '../types/state-machine'
