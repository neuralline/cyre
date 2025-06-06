// src/config/cyre-config.ts

import {QuantumState} from '../types/system'
import {Priority} from '../types/core'

/*

      C.Y.R.E. - C.O.N.F.I.G.
      Enhanced with configurable action pipeline performance monitoring

*/

// Add timing configuration section
export const TIMING = {
  ANIMATION: 16.67, // 60fps - For smooth animations (requestAnimationFrame preferred)
  UI_UPDATE: 100, // User interface updates
  INPUT_DEBOUNCE: 150, // Input handling (typing, scrolling)
  API_POLLING: 1000, // API polling/data refresh
  BACKGROUND_TASK: 5000, // Background operations

  // System timing constants
  RECUPERATION: 60 * 1000, // 1 minute - Recuperation check interval
  LONG_INTERVAL: 60 * 60 * 1000, // 1 hour - Long timer handling
  MAX_TIMEOUT: Math.pow(2, 31) - 1 // Max safe timeout value
} as const

// Enhanced performance monitoring configuration with action pipeline terminology
export const PERFORMANCE = {
  // Action pipeline timing thresholds
  ACTION_PIPELINE_THRESHOLDS: {
    EXCELLENT: 1, // < 1ms pipeline overhead
    GOOD: 3, // < 3ms pipeline overhead
    ACCEPTABLE: 5, // < 5ms pipeline overhead
    POOR: 10, // < 10ms pipeline overhead
    CRITICAL: 20 // > 20ms pipeline overhead (needs optimization)
  },

  // Listener execution thresholds by priority
  LISTENER_EXECUTION_THRESHOLDS: {
    critical: {
      WARNING: 100, // Critical actions can take longer
      ERROR: 500 // But not too long
    },
    high: {
      WARNING: 50,
      ERROR: 200
    },
    medium: {
      WARNING: 20, // Current Cyre standard
      ERROR: 100
    },
    low: {
      WARNING: 15,
      ERROR: 50
    },
    background: {
      WARNING: 10, // Background should be fast
      ERROR: 30
    }
  },

  // Total execution time thresholds
  TOTAL_EXECUTION_THRESHOLDS: {
    FAST: 5, // < 5ms total (excellent)
    NORMAL: 25, // < 25ms total (good)
    SLOW: 100, // < 100ms total (acceptable)
    VERY_SLOW: 500, // < 500ms total (concerning)
    CRITICAL: 1000 // > 1000ms total (critical)
  },

  // Pipeline efficiency thresholds
  PIPELINE_EFFICIENCY: {
    EXCELLENT: 0.1, // Pipeline overhead < 10% of total
    GOOD: 0.2, // Pipeline overhead < 20% of total
    ACCEPTABLE: 0.3, // Pipeline overhead < 30% of total
    POOR: 0.5, // Pipeline overhead < 50% of total
    CRITICAL: 0.7 // Pipeline overhead > 70% of total (bad!)
  },

  // Monitoring settings
  MONITORING: {
    DEFAULT_THRESHOLD: 20, // Default threshold in ms
    WARNING_ENABLED: true, // Enable/disable warnings
    TRACK_PERCENTILES: true, // Track 95th percentile times
    MAX_HISTORY_SIZE: 100, // Max execution times to store
    REPORT_INTERVAL: 10000, // How often to check for patterns (ms)
    AUTO_OPTIMIZE_THRESHOLD: 100, // Auto-suggest optimizations above this
    STAGE_BREAKDOWN_ENABLED: true // Enable detailed stage timing
  }
} as const

export const MSG = {
  // System Status
  OFFLINE: '@cyre: System is offline',
  ONLINE: '@cyre: System is online',
  WELCOME: '@cyre: Welcome! How can I assist you?',
  SYSTEM_LOCKED: 'System is locked: cannot add new channels or subscribers',
  SYSTEM_LOCKED_CHANNELS: 'Cannot add new channels: system is locked',
  SYSTEM_LOCKED_SUBSCRIBERS: 'Cannot add new subscribers: system is locked',

  // Performance warnings with action pipeline terminology
  SLOW_LISTENER_DETECTED: 'Slow listener detected',
  SLOW_ACTION_PIPELINE: 'Slow action pipeline detected',
  HIGH_PIPELINE_OVERHEAD: 'High action pipeline overhead detected',
  INEFFICIENT_PIPELINE_RATIO: 'Inefficient action pipeline ratio detected',
  PERFORMANCE_DEGRADATION: 'Performance degradation detected',
  AUTO_OPTIMIZATION_SUGGESTION: 'Consider optimizing this action pipeline',

  // Action Related
  ACTION_PREPARE_FAILED: 'Failed to prepare action: invalid configuration',
  ACTION_EMIT_FAILED: 'Failed to emit action: communication error',
  ACTION_EXECUTE_FAILED: 'Failed to execute action: runtime error',
  ACTION_SKIPPED: 'Action skipped: no payload changes detected',
  ACTION_ID_REQUIRED: 'Action ID is required',

  // Channel Related
  CHANNEL_VALIDATION_FAILED: 'Channel validation failed: invalid configuration',
  CHANNEL_CREATION_FAILED: 'Failed to create channel: configuration error',
  CHANNEL_UPDATE_FAILED: 'Failed to update channel: validation error',
  CHANNEL_CREATED: 'Channel created',
  CHANNEL_UPDATED: 'Channel updated',
  CHANNEL_INVALID_DEFINITION: 'Invalid channel data definition',
  CHANNEL_MISSING_ID: 'Channel ID is required',
  CHANNEL_MISSING_TYPE: 'Channel type is required',
  CHANNEL_INVALID_TYPE: 'Invalid channel type specified',
  CHANNEL_INVALID_PAYLOAD: 'Invalid channel payload format',
  CHANNEL_INVALID_STRUCTURE: 'Invalid channel structure: check configuration',

  // Subscription Related
  SUBSCRIPTION_INVALID_PARAMS: 'Invalid subscription parameters provided',
  SUBSCRIPTION_EXISTS: 'Subscriber exists - updating configuration',
  SUBSCRIPTION_SUCCESS_SINGLE: 'Subscribed to channel',
  SUBSCRIPTION_SUCCESS_MULTIPLE: 'Subscribed to multiple channels',
  SUBSCRIPTION_INVALID_TYPE: 'Invalid subscriber type specified',
  SUBSCRIPTION_INVALID_HANDLER: 'Invalid channel handler provided',
  SUBSCRIPTION_FAILED: 'Subscription failed: check configuration',

  // Call Related
  CALL_OFFLINE: 'Call failed: system is offline',
  CALL_INVALID_ID: 'Call failed: invalid action ID',
  CALL_NOT_RESPONDING: 'Call failed: action not responding',
  CALL_NO_SUBSCRIBER: 'Call failed: no subscriber found for this type',

  // Dispatch Related
  DISPATCH_NO_SUBSCRIBER: 'Dispatch failed: no subscriber found for this type',
  TIMELINE_NO_SUBSCRIBER: 'Timeline error: no subscriber found for this type',

  // System Headers
  QUANTUM_HEADER:
    'Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0-- ',

  // Add timing related messages
  TIMING_WARNING: 'Timer duration below UI update threshold.',
  TIMING_ANIMATION_WARNING:
    'Consider using requestAnimationFrame for high-frequency updates.',
  TIMING_INVALID: 'Invalid timer duration.',
  TIMING_RECUPERATION: 'Entering recuperation mode for long duration timer.',
  RATE_LIMITED: (delay: number) =>
    `Rate limited. Request delayed by ${delay}ms.`
} as const

// Protection thresholds (keeping existing structure)
export const PROTECTION = {
  CALL_THRESHOLD: 100,
  MIN_DEBOUNCE: 50,
  MIN_THROTTLE: 50,
  MAX_DELAY: 2000,
  WINDOW: 1000,
  INITIAL_DELAY: 25,
  SYSTEM_LOAD_DELAY: 250,
  SYSTEM: {
    CPU: {
      WARNING: 85,
      CRITICAL: 95
    },
    MEMORY: {
      WARNING: 85,
      CRITICAL: 95
    },
    EVENT_LOOP: {
      WARNING: 200,
      CRITICAL: 1000
    },
    OVERLOAD_THRESHOLD: 4
  }
} as const

export type ProtectionConfig = typeof PROTECTION

export const BREATHING = {
  // Core breathing rates (in ms)
  RATES: {
    MIN: 50,
    BASE: 200,
    MAX: 1000,
    RECOVERY: 2000
  },

  // Stress thresholds
  STRESS: {
    LOW: 0.5,
    MEDIUM: 0.75,
    HIGH: 0.9,
    CRITICAL: 0.95
  },

  // Recovery settings
  RECOVERY: {
    BREATH_DEBT: 15,
    COOL_DOWN: 1.1,
    MIN_RECOVERY: 500,
    MAX_RECOVERY: 5000
  },

  // System limits
  LIMITS: {
    MAX_CPU: 80,
    MAX_MEMORY: 85,
    MAX_EVENT_LOOP: 50,
    MAX_CALL_RATE: 1000
  },

  // Breathing patterns
  PATTERNS: {
    NORMAL: {
      inRatio: 1,
      outRatio: 1,
      holdRatio: 0.5
    },
    RECOVERY: {
      inRatio: 2,
      outRatio: 2,
      holdRatio: 1
    }
  }
} as const

// Initialize default state
export const defaultMetrics: QuantumState = {
  system: {
    cpu: 0,
    memory: 0,
    eventLoop: 0,
    isOverloaded: false
  },
  breathing: {
    breathCount: 0,
    currentRate: BREATHING.RATES.BASE,
    lastBreath: Date.now(),
    stress: 0,
    isRecuperating: false,
    recuperationDepth: 0,
    pattern: 'NORMAL',
    nextBreathDue: Date.now() + BREATHING.RATES.BASE
  },
  performance: {
    callsTotal: 0,
    callsPerSecond: 0,
    lastCallTimestamp: Date.now(),
    activeQueues: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      background: 0
    },
    queueDepth: 0
  },
  stress: {
    cpu: 0,
    memory: 0,
    eventLoop: 0,
    callRate: 0,
    combined: 0
  },
  lastUpdate: Date.now(),
  inRecuperation: false,
  hibernating: false,
  activeFormations: 0,
  _Locked: false,
  _init: false,
  _shutdown: false
}

export const systemMetrics = {
  system: {
    cpuUsage: 0,
    memoryUsage: 0,
    eventLoopLag: 0,
    isOverloaded: false
  },
  totalCalls: 0,
  callsPerSecond: 0,
  protectionLevel: 0,
  activeQueues: new Set<Priority>(),
  isOverloaded: false
}

// Helper functions for performance monitoring
export const getListenerThreshold = (priority: Priority = 'medium'): number => {
  return (
    PERFORMANCE.LISTENER_EXECUTION_THRESHOLDS[priority]?.WARNING ||
    PERFORMANCE.MONITORING.DEFAULT_THRESHOLD
  )
}

export const getPipelineThreshold = (): number => {
  return PERFORMANCE.ACTION_PIPELINE_THRESHOLDS.ACCEPTABLE
}

export const categorizeExecutionTime = (
  timeMs: number
): keyof typeof PERFORMANCE.TOTAL_EXECUTION_THRESHOLDS => {
  if (timeMs < PERFORMANCE.TOTAL_EXECUTION_THRESHOLDS.FAST) return 'FAST'
  if (timeMs < PERFORMANCE.TOTAL_EXECUTION_THRESHOLDS.NORMAL) return 'NORMAL'
  if (timeMs < PERFORMANCE.TOTAL_EXECUTION_THRESHOLDS.SLOW) return 'SLOW'
  if (timeMs < PERFORMANCE.TOTAL_EXECUTION_THRESHOLDS.VERY_SLOW)
    return 'VERY_SLOW'
  return 'CRITICAL'
}
