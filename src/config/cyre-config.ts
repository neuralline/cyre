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
  // System Status - British AI Assistant Style
  OFFLINE: 'Cyre offline - systems temporarily unavailable',
  ONLINE: 'Cyre online! at your service',
  WELCOME: 'Cyre ready! how may I assist you today?',
  SYSTEM_LOCKED:
    'System temporarily locked - please wait a moment while I reorganize',
  SYSTEM_LOCKED_CHANNELS:
    'Unable to create new channels at the moment - system is reorganizing',
  SYSTEM_LOCKED_SUBSCRIBERS:
    'Unable to add new subscriptions currently - please try again shortly',

  // Performance Messages - Polite but Informative
  SLOW_LISTENER_DETECTED:
    'Performance notice - a task is taking longer than expected',
  SLOW_ACTION_PIPELINE:
    'Processing notice - workflow is running slower than usual',
  HIGH_PIPELINE_OVERHEAD:
    'Efficiency notice - system overhead detected, optimizing...',
  INEFFICIENT_PIPELINE_RATIO:
    'Performance advisory - task coordination could be improved',
  PERFORMANCE_DEGRADATION: 'System notice - performance adjustment in progress',
  AUTO_OPTIMIZATION_SUGGESTION:
    'Recommendation - this process could benefit from optimization',

  // Action Related - Professional & Clear
  ACTION_PREPARE_FAILED:
    'Unable to prepare task - please check your configuration',
  ACTION_EMIT_FAILED: 'Communication error - unable to send task',
  ACTION_EXECUTE_FAILED: 'Task execution failed - runtime error encountered',
  ACTION_SKIPPED: 'Task skipped - no changes detected from previous request',
  ACTION_ID_REQUIRED: 'Task identifier required - please provide a channel ID',

  // Channel Related - Helpful & Specific
  CHANNEL_VALIDATION_FAILED:
    'Channel setup declined - configuration requirements not met',
  CHANNEL_CREATION_FAILED:
    'Unable to create channel - please verify your configuration',
  CHANNEL_UPDATE_FAILED:
    'Channel update unsuccessful - validation requirements not satisfied',
  CHANNEL_CREATED: 'Channel established - ready for operation',
  CHANNEL_UPDATED: 'Channel configuration updated successfully',
  CHANNEL_INVALID_DEFINITION:
    'Channel definition invalid - please review your setup',
  CHANNEL_MISSING_ID:
    'Channel identifier required - please provide a unique ID',
  CHANNEL_MISSING_TYPE: 'Channel type specification required',
  CHANNEL_INVALID_TYPE:
    'Channel type not recognized - please specify a valid type',
  CHANNEL_INVALID_PAYLOAD:
    'Payload format not accepted - please check your data structure',
  CHANNEL_INVALID_STRUCTURE:
    'Channel structure invalid - please review configuration requirements',

  // Subscription Related - Courteous & Informative
  SUBSCRIPTION_INVALID_PARAMS:
    'Subscription parameters not accepted - please verify your settings',
  SUBSCRIPTION_EXISTS:
    'Subscription already exists - updating configuration as requested',
  SUBSCRIPTION_SUCCESS_SINGLE: 'Successfully subscribed to channel',
  SUBSCRIPTION_SUCCESS_MULTIPLE: 'Successfully subscribed to multiple channels',
  SUBSCRIPTION_INVALID_TYPE:
    'Subscription type not recognized - please specify a valid type',
  SUBSCRIPTION_INVALID_HANDLER:
    'Handler function not accepted - please provide a valid function',
  SUBSCRIPTION_FAILED:
    'Subscription unsuccessful - please check your configuration',

  // Call Related - Clear Error Communication
  CALL_OFFLINE: 'Call unsuccessful - system is currently offline',
  CALL_INVALID_ID: 'Call failed - channel identifier not recognized',
  CALL_NOT_RESPONDING: 'Call timeout - channel is not responding',
  CALL_NO_SUBSCRIBER: 'Call unsuccessful - no handler found for this channel',

  // Dispatch Related - Professional Error Handling
  DISPATCH_NO_SUBSCRIBER:
    'Dispatch failed - no subscriber registered for channel',
  TIMELINE_NO_SUBSCRIBER:
    'Timeline error - no handler registered for scheduled task',

  // System Headers - Maintained Original Style
  QUANTUM_HEADER:
    'Q0.0U0.0A0.0N0.0T0.0U0.0M0 - I0.0N0.0C0.0E0.0P0.0T0.0I0.0O0.0N0.0S0-- ',

  // Timing Related - Helpful Advisories
  TIMING_WARNING:
    'Timing advisory - duration below recommended UI update threshold',
  TIMING_ANIMATION_WARNING:
    'Performance suggestion - consider requestAnimationFrame for smooth animations',
  TIMING_INVALID:
    'Timer duration not accepted - please specify a valid timeframe',
  TIMING_RECUPERATION:
    'System rest mode - conserving resources for optimal performance',
  RATE_LIMITED: (delay: number) =>
    `Request queued - processing will resume in ${delay}ms`,

  // Additional British AI Assistant Messages
  TASK_UNDERSTOOD: 'Task understood - proceeding with your request',
  TASK_COMPLETED:
    'Task completed successfully - anything else I can help with?',
  CONFIGURATION_ACCEPTED: 'Configuration accepted - settings applied',
  OPERATION_SUCCESSFUL: 'Operation completed as requested',
  REQUEST_ACKNOWLEDGED: 'Request acknowledged - processing now',
  SYSTEM_READY: 'All systems ready - standing by for instructions',
  MAINTENANCE_MODE: 'Maintenance mode active - optimizing system performance',
  COORDINATION_ACTIVE: 'Task coordination active - managing your requests',
  INTELLIGENCE_ENGAGED:
    'Processing intelligence engaged - analyzing your requirements',

  // Polite Error Variations
  UNABLE_TO_COMPLY:
    "I'm unable to comply with that request - please check the requirements",
  TEMPORARILY_UNAVAILABLE:
    'Service temporarily unavailable - please try again in a moment',
  ACCESS_PERMISSIONS:
    'Access permissions required - please verify your credentials',
  RESOURCE_UNAVAILABLE:
    'Requested resource currently unavailable - shall I suggest alternatives?',
  VALIDATION_REQUIREMENTS:
    'Validation requirements not met - please review your input',

  // Success Confirmations
  ACKNOWLEDGED_AND_PROCESSED: 'Request acknowledged and processed successfully',
  CONFIGURATION_APPLIED: 'Configuration applied - system updated as requested',
  SUBSCRIPTION_ESTABLISHED:
    "Subscription established - you'll receive updates as they occur",
  CHANNEL_OPERATIONAL: 'Channel operational - ready to handle your requests',
  SYSTEM_OPTIMIZED: 'System optimization complete - performance improved'
} as const

// Helper function to create contextual messages with British politeness
export const createPoliteMessage = (
  operation: 'success' | 'error' | 'info' | 'warning',
  context: string,
  details?: string
): string => {
  const templates = {
    success: {
      base: 'Operation completed successfully',
      withDetails: (details: string) =>
        `Operation completed successfully - ${details}`,
      polite: 'Task accomplished as requested'
    },
    error: {
      base: "I'm afraid there was an issue",
      withDetails: (details: string) => `I\'m unable to proceed - ${details}`,
      polite: 'I apologize, but I cannot complete that request'
    },
    info: {
      base: 'Status update',
      withDetails: (details: string) => `Information: ${details}`,
      polite: 'Keeping you informed'
    },
    warning: {
      base: 'Advisory notice',
      withDetails: (details: string) => `Please note: ${details}`,
      polite: 'I should mention'
    }
  }

  const template = templates[operation]
  if (details) {
    return template.withDetails(details)
  }
  return template.base
}

// Export type for message tone consistency
export type MessageTone =
  | 'formal'
  | 'polite'
  | 'neutral'
  | 'helpful'
  | 'assertive'

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
