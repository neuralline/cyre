// src/config/cyre-config.ts

import {QuantumState} from '../types/system'

/*

      C.Y.R.E. - C.O.N.F.I.G.
      cyre system configurations and messages

*/
export const PAYLOAD_CONFIG = {MAX_HISTORY_PER_CHANNEL: 10}
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
  store: {
    channels: 0,
    branches: 0,
    tasks: 0,
    subscribers: 0,
    timeline: 0
  },
  lastUpdate: Date.now(),
  inRecuperation: false,
  hibernating: false,
  activeFormations: 0,
  _isLocked: false,
  _init: false,
  _shutdown: false
}
