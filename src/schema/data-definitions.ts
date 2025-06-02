// src/schema/data-definitions-fixed.ts
// Fixed data-definitions with proper pipeline compilation order

import {schema} from '../schema/cyre-schema'
import type {IO, ActionPayload} from '../types/core'

/*

      C.Y.R.E - D.A.T.A - D.E.F.I.N.I.T.I.O.N.S - F.I.X.E.D
      
      Fixed pipeline compilation order:
      1. System protections first (throttle, debounce)
      2. User protections in order (schema, condition, selector, transform)
      3. Proper change detection integration
      4. Correct blocking logic

*/

interface ProtectionFn {
  (ctx: ProtectionContext): ProtectionResult | Promise<ProtectionResult>
}

interface ProtectionContext {
  action: IO
  payload: ActionPayload
  originalPayload: ActionPayload
  metrics: any
  timestamp: number
}

interface ProtectionResult {
  pass: boolean
  payload?: ActionPayload
  reason?: string
  delayed?: boolean
  duration?: number
}

interface DataDefResult {
  ok: boolean
  data?: any
  error?: string
  // Pipeline compilation flags
  blocking?: boolean
  protectionFn?: ProtectionFn
  protectionOrder?: number // NEW: Order priority
  requiresPayloadCheck?: boolean
}

// Protection order constants
const PROTECTION_ORDER = {
  THROTTLE: 1,
  DEBOUNCE: 2,
  SCHEMA: 3,
  CONDITION: 4,
  SELECTOR: 5,
  TRANSFORM: 6,
  CHANGE_DETECTION: 7
}

// Fixed data-definitions with proper ordering
export const dataDefinitions = {
  // Core required - can block
  id: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'string' || value.length === 0) {
      return {ok: false, error: 'ID must be non-empty string', blocking: true}
    }
    return {ok: true, data: value}
  },

  // Blocking conditions - immediate termination
  repeat: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'number' && typeof value !== 'boolean') {
      return {ok: false, error: 'Repeat must be number or boolean'}
    }
    if (typeof value === 'number' && value < 0) {
      return {ok: false, error: 'Repeat cannot be negative'}
    }
    if (value === 0) {
      return {
        ok: false,
        error: 'Action configured with repeat: 0',
        blocking: true
      }
    }
    return {ok: true, data: value}
  },

  block: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'boolean') {
      return {ok: false, error: 'Block must be boolean'}
    }
    if (value === true) {
      return {ok: false, error: 'Service not available', blocking: true}
    }
    return {ok: true, data: value}
  },

  required: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'boolean' && value !== 'non-empty') {
      return {ok: false, error: 'Required must be boolean or "non-empty"'}
    }
    return {ok: true, data: value, requiresPayloadCheck: true}
  },

  // FIXED: Throttle - system protection (order 1)
  throttle: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'Throttle must be non-negative number'}
    }

    if (value > 0) {
      const throttleProtection: ProtectionFn = (ctx: ProtectionContext) => {
        const lastExec = ctx.metrics?.lastExecutionTime || 0
        if (lastExec === 0) return {pass: true}

        const elapsed = ctx.timestamp - lastExec
        if (elapsed < value) {
          const remaining = value - elapsed
          return {pass: false, reason: `Throttled - ${remaining}ms remaining`}
        }
        return {pass: true}
      }

      // Insert at correct position based on order
      insertProtectionByOrder(
        pipeline,
        throttleProtection,
        PROTECTION_ORDER.THROTTLE
      )
    }

    return {ok: true, data: value, protectionOrder: PROTECTION_ORDER.THROTTLE}
  },

  // FIXED: Debounce - system protection (order 2)
  debounce: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'Debounce must be non-negative number'}
    }

    if (value > 0) {
      const debounceProtection: ProtectionFn = () => ({
        pass: false,
        reason: `Debounced - will execute in ${value}ms`,
        delayed: true,
        duration: value
      })

      insertProtectionByOrder(
        pipeline,
        debounceProtection,
        PROTECTION_ORDER.DEBOUNCE
      )
    }

    return {ok: true, data: value, protectionOrder: PROTECTION_ORDER.DEBOUNCE}
  },

  // FIXED: Schema - user protection (order 3)
  schema: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (!value || typeof value !== 'function') {
      return {ok: false, error: 'Schema must be a validation function'}
    }

    const schemaProtection: ProtectionFn = (ctx: ProtectionContext) => {
      try {
        const result = value(ctx.payload)
        if (!result.ok) {
          return {
            pass: false,
            reason: `Schema validation failed: ${result.errors.join(', ')}`
          }
        }
        return {pass: true, payload: result.data}
      } catch (error) {
        return {
          pass: false,
          reason: `Schema error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }

    insertProtectionByOrder(pipeline, schemaProtection, PROTECTION_ORDER.SCHEMA)
    return {ok: true, data: value, protectionOrder: PROTECTION_ORDER.SCHEMA}
  },

  // FIXED: Condition - user protection (order 4)
  condition: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Condition must be a function'}
    }

    const conditionProtection: ProtectionFn = (ctx: ProtectionContext) => {
      try {
        const conditionMet = value(ctx.payload)
        if (!conditionMet) {
          return {pass: false, reason: 'Condition not met - execution skipped'}
        }
        return {pass: true}
      } catch (error) {
        return {
          pass: false,
          reason: `Condition error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }

    insertProtectionByOrder(
      pipeline,
      conditionProtection,
      PROTECTION_ORDER.CONDITION
    )
    return {ok: true, data: value, protectionOrder: PROTECTION_ORDER.CONDITION}
  },

  // FIXED: Selector - user protection (order 5)
  selector: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Selector must be a function'}
    }

    const selectorProtection: ProtectionFn = (ctx: ProtectionContext) => {
      try {
        const selectedData = value(ctx.payload)
        return {pass: true, payload: selectedData}
      } catch (error) {
        return {
          pass: false,
          reason: `Selector error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }

    insertProtectionByOrder(
      pipeline,
      selectorProtection,
      PROTECTION_ORDER.SELECTOR
    )
    return {ok: true, data: value, protectionOrder: PROTECTION_ORDER.SELECTOR}
  },

  // FIXED: Transform - user protection (order 6)
  transform: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'function') {
      return {ok: false, error: 'Transform must be a function'}
    }

    const transformProtection: ProtectionFn = (ctx: ProtectionContext) => {
      try {
        const transformedPayload = value(ctx.payload)
        return {pass: true, payload: transformedPayload}
      } catch (error) {
        return {
          pass: false,
          reason: `Transform error: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }

    insertProtectionByOrder(
      pipeline,
      transformProtection,
      PROTECTION_ORDER.TRANSFORM
    )
    return {ok: true, data: value, protectionOrder: PROTECTION_ORDER.TRANSFORM}
  },

  // FIXED: Change detection - special handling (not in pipeline)
  detectChanges: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'boolean') {
      return {ok: false, error: 'DetectChanges must be boolean'}
    }

    // Change detection is handled separately in processCall, not in pipeline
    return {ok: true, data: value}
  },

  // Priority - complex validation (unchanged)
  priority: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'object' || value === null) {
      return {ok: false, error: 'Priority must be an object'}
    }

    const prioritySchema = schema.object({
      level: schema.enums('critical', 'high', 'medium', 'low', 'background'),
      maxRetries: schema.number().optional(),
      timeout: schema.number().optional(),
      fallback: schema.any().optional(),
      baseDelay: schema.number().optional(),
      maxDelay: schema.number().optional()
    })

    const result = prioritySchema(value)
    if (!result.ok) {
      return {
        ok: false,
        error: `Priority validation failed: ${result.errors.join(', ')}`
      }
    }

    return {ok: true, data: result.data}
  },

  // Simple validations - no pipeline additions (unchanged)
  interval: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'Interval must be non-negative number'}
    }
    return {ok: true, data: value}
  },

  delay: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'Delay must be non-negative number'}
    }
    return {ok: true, data: value}
  },

  maxWait: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'number' || value < 0) {
      return {ok: false, error: 'MaxWait must be non-negative number'}
    }
    return {ok: true, data: value}
  },

  log: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (typeof value !== 'boolean') {
      return {ok: false, error: 'Log must be boolean'}
    }
    return {ok: true, data: value}
  },

  middleware: (value: any, pipeline: ProtectionFn[]): DataDefResult => {
    if (!Array.isArray(value)) {
      return {ok: false, error: 'Middleware must be an array'}
    }
    return {ok: true, data: value}
  },

  // Pass-through attributes (unchanged)
  type: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  payload: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  group: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  tags: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),

  // Internal fields (unchanged)
  _protectionPipeline: (
    value: any,
    pipeline: ProtectionFn[]
  ): DataDefResult => ({ok: true, data: value}),
  _debounceTimer: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  _bypassDebounce: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  _isBlocked: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  _blockReason: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  _hasFastPath: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  timestamp: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  }),
  timeOfCreation: (value: any, pipeline: ProtectionFn[]): DataDefResult => ({
    ok: true,
    data: value
  })
} as const

/**
 * Insert protection function at correct position based on order
 */
function insertProtectionByOrder(
  pipeline: ProtectionFn[],
  protection: ProtectionFn,
  order: number
): void {
  // Add order metadata to function for sorting
  ;(protection as any).__order = order

  // Insert protection
  pipeline.push(protection)

  // Sort pipeline by order
  pipeline.sort((a, b) => {
    const orderA = (a as any).__order || 999
    const orderB = (b as any).__order || 999
    return orderA - orderB
  })
}

/**
 * Get pipeline execution order for debugging
 */
export function getPipelineOrder(pipeline: ProtectionFn[]): number[] {
  return pipeline.map(fn => (fn as any).__order || 999)
}
