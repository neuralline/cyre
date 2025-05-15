// src/config/cyre-config.ts

import {Priority, QuantumState} from '../interfaces/interface'

/*

      C.Y.R.E. - C.O.N.F.I.G.

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

export const MSG = {
  // System Status
  OFFLINE: '@cyre: System is offline',
  ONLINE: '@cyre: System is online',
  WELCOME: '@cyre: Welcome! How can I assist you?',
  SYSTEM_LOCKED: 'System is locked: cannot add new channels or subscribers',
  SYSTEM_LOCKED_CHANNELS: 'Cannot add new channels: system is locked',
  SYSTEM_LOCKED_SUBSCRIBERS: 'Cannot add new subscribers: system is locked',

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
  CHANNEL_CREATED: 'Channel created successfully',
  CHANNEL_UPDATED: 'Channel updated successfully',
  CHANNEL_INVALID_DEFINITION: 'Invalid channel data definition',
  CHANNEL_MISSING_ID: 'Channel ID is required',
  CHANNEL_MISSING_TYPE: 'Channel type is required',
  CHANNEL_INVALID_TYPE: 'Invalid channel type specified',
  CHANNEL_INVALID_PAYLOAD: 'Invalid channel payload format',
  CHANNEL_INVALID_STRUCTURE: 'Invalid channel structure: check configuration',

  // Subscription Related
  SUBSCRIPTION_INVALID_PARAMS: 'Invalid subscription parameters provided',
  SUBSCRIPTION_EXISTS: 'Subscriber exists - updating configuration',
  SUBSCRIPTION_SUCCESS_SINGLE: 'Successfully subscribed to event',
  SUBSCRIPTION_SUCCESS_MULTIPLE: 'Successfully subscribed to multiple events',
  SUBSCRIPTION_INVALID_TYPE: 'Invalid subscriber type specified',
  SUBSCRIPTION_INVALID_HANDLER: 'Invalid event handler provided',
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

// Protection thresholds
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
  isLocked: false
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
