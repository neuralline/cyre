// src/types/interface.ts
// Main interface definitions - re-exports organized types

// Re-export core types
export type {
  Priority,
  PriorityConfig,
  ActionPayload,
  ActionId,
  StateKey,
  CyreResponse,
  EventHandler,
  MiddlewareFunction,
  ISubscriber,
  IMiddleware,
  SubscriptionResponse,
  IO,
  ActionPipelineFunction,
  Result,
  On
} from './core'

// Re-export system types
export type {
  TimerStatus,
  TimerRepeat,
  TimerDuration,
  TimerMetrics,
  Timer,
  SystemMetrics,
  SystemStress,
  PerformanceMetrics,
  BreathingState,
  BreathingMetrics,
  QuantumState,
  TimekeeperMetrics,
  ActionMetrics
} from './system'

// Re-export history types
export type {
  HistoryResponse,
  HistoryEntry,
  HistoryStats,
  HistoryQuery
} from './history'

// Re-export hooks types
export type {
  ProtectionOptions,
  CyreHookOptions,
  CyreMiddleware,
  SubscriptionWithCleanup,
  ChannelHistoryEntry,
  HookResult,
  ChannelConfig,
  CyreHook,
  CyreChannel
} from './hooks-interface'
