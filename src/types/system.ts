// src/types/system.ts
// System performance and monitoring types

import type {Priority} from './core'

export type SystemMetrics = {
  cpu: number
  memory: number
  eventLoop: number
  isOverloaded: boolean
}

export type SystemStress = {
  cpu: number
  memory: number
  eventLoop: number
  callRate: number
  combined: number
}

export type PerformanceMetrics = {
  callsTotal: number
  callsPerSecond: number
  lastCallTimestamp: number
  activeQueues: Record<Priority, number>
  queueDepth: number
}

export type BreathingState = {
  breathCount: number
  currentRate: number
  lastBreath: number
  stress: number
  isRecuperating: boolean
  recuperationDepth: number
  pattern: keyof typeof import('../config/cyre-config').BREATHING.PATTERNS
  nextBreathDue: number
  recuperationInterval?: NodeJS.Timeout
}

export type BreathingMetrics = {
  breathCount: number
  currentRate: number
  lastBreath: number
  stress: number
  isRecuperating: boolean
  recuperationDepth: number
  pattern: keyof typeof import('../config/cyre-config').BREATHING.PATTERNS
}

export interface QuantumState {
  system: SystemMetrics
  breathing: BreathingState
  performance: PerformanceMetrics
  stress: SystemStress
  lastUpdate: number
  inRecuperation: boolean
  hibernating: boolean
  recuperationInterval?: NodeJS.Timeout
  activeFormations: number
  isLocked: boolean
  initialize: boolean
  isShutdown: boolean
}

export interface ActionMetrics {
  executionTime?: number
  lastExecutionTime?: number
  executionCount?: number
  formationId?: string
  status: 'success' | 'error'
  timestamp: number
  error?: string
}
