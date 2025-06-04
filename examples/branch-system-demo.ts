// src/system/plugin-system.ts
// Working plugin system with private branch isolation

import {createBranch} from '../src/hooks/create-branch'
import type {Branch} from '../src/types/branch'
import type {IO} from '../src/types/core'
import {sensor} from '../src/context/metrics-report'
import {executeTalent} from '../src/schema/talent-definitions'
import {dataDefinitions} from '../src/schema/data-definitions'
import {orchestration} from '../src'
import {fusion, patterns} from '../src/schema/fusion-pattern-talents'

/*

      C.Y.R.E - P.L.U.G.I.N - S.Y.S.T.E.M
      
      Private branch-based plugin system:
      - System branch instance never exposed to users
      - Perfect isolation through instance control
      - Full integration with core cyre features
      - Plugin definitions loaded as system channels

*/

// PRIVATE - never exported, completely isolated
let systemBranch: Branch
let isInitialized = false

/**
 * Plugin system with private branch isolation
 */
export const pluginSystem = {
  /**
   * Initialize system branch and load plugin definitions
   */
  initialize: async (): Promise<{ok: boolean; message: string}> => {
    try {
      if (isInitialized) {
        return {ok: true, message: 'Plugin system already initialized'}
      }

      // Create private system branch - users can never access this instance
      systemBranch = createBranch(undefined, {
        id: 'system',
        pathSegment: 'sys'
      })

      sensor.log('plugin-system', 'info', 'system-branch-created', {
        branchId: systemBranch.id,
        branchPath: systemBranch.path
      })

      // Load all plugin definitions
      await loadDataDefinitions()
      await loadTalentDefinitions()
      await loadOrchestrationDefinitions()
      await loadIntelligenceDefinitions()

      isInitialized = true

      sensor.log('plugin-system', 'success', 'plugin-system-initialized', {
        branchPath: systemBranch.path,
        channelCount: systemBranch.getStats().channelCount
      })

      return {
        ok: true,
        message: `Plugin system initialized with ${
          systemBranch.getStats().channelCount
        } system channels`
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      sensor.error('plugin-system', errorMessage, 'initialization')
      return {
        ok: false,
        message: `Plugin system initialization failed: ${errorMessage}`
      }
    }
  },

  /**
   * Process data validation through system branch
   */
  processDataValidation: async (data: any): Promise<any> => {
    if (!isInitialized) {
      throw new Error('Plugin system not initialized')
    }

    try {
      const result = await systemBranch.call('data-validator', data)
      sensor.log('plugin-system', 'info', 'data-validation-processed', {
        success: result.ok
      })
      return result
    } catch (error) {
      sensor.error('plugin-system', String(error), 'data-validation')
      return {
        ok: false,
        message: `Data validation failed: ${error}`,
        error: String(error)
      }
    }
  },

  /**
   * Execute talent through system branch
   */
  executeTalent: async (
    talentName: string,
    action: IO,
    payload: any
  ): Promise<any> => {
    if (!isInitialized) {
      throw new Error('Plugin system not initialized')
    }

    try {
      const result = await systemBranch.call('talent-executor', {
        talentName,
        action,
        payload
      })
      sensor.log('plugin-system', 'info', 'talent-executed', {
        talentName,
        success: result.ok
      })
      return result
    } catch (error) {
      sensor.error('plugin-system', String(error), 'talent-execution')
      return {
        ok: false,
        message: `Talent execution failed: ${error}`,
        error: String(error)
      }
    }
  },

  /**
   * Process orchestration registration
   */
  registerOrchestration: async (config: any): Promise<any> => {
    if (!isInitialized) {
      throw new Error('Plugin system not initialized')
    }

    try {
      const result = await systemBranch.call('orchestration-registrar', config)
      sensor.log('plugin-system', 'info', 'orchestration-registered', {
        orchestrationId: config.id,
        success: result.ok
      })
      return result
    } catch (error) {
      sensor.error('plugin-system', String(error), 'orchestration-registration')
      return {
        ok: false,
        message: `Orchestration registration failed: ${error}`,
        error: String(error)
      }
    }
  },

  /**
   * Process intelligence operations
   */
  processIntelligence: async (operation: string, data: any): Promise<any> => {
    if (!isInitialized) {
      throw new Error('Plugin system not initialized')
    }

    try {
      const result = await systemBranch.call('intelligence-processor', {
        operation,
        data
      })
      sensor.log('plugin-system', 'info', 'intelligence-processed', {
        operation,
        success: result.ok
      })
      return result
    } catch (error) {
      sensor.error('plugin-system', String(error), 'intelligence-processing')
      return {
        ok: false,
        message: `Intelligence processing failed: ${error}`,
        error: String(error)
      }
    }
  },

  /**
   * Get system branch statistics (for monitoring)
   */
  getSystemStats: () => {
    if (!isInitialized) {
      return {
        initialized: false,
        channelCount: 0,
        branchPath: null
      }
    }

    const stats = systemBranch.getStats()
    return {
      initialized: true,
      channelCount: stats.channelCount,
      branchPath: stats.path,
      branchId: stats.id,
      isActive: stats.isActive
    }
  },

  /**
   * Check if plugin system is initialized
   */
  isInitialized: (): boolean => isInitialized
}

/**
 * Load data definition plugins
 */
const loadDataDefinitions = async (): Promise<void> => {
  // Register data validation service
  systemBranch.action({
    id: 'data-validator',
    name: 'Data Validation Service',
    type: 'system-service',
    group: 'validation',
    tags: ['system', 'internal', 'validation'],
    description: 'Validates user input data using data definitions',
    version: '4.0.0',
    payload: {},
    priority: {level: 'high' as const}
  })

  systemBranch.on('data-validator', (payload: any) => {
    const validationResults: any = {}
    const errors: string[] = []

    // Validate each field in payload
    for (const [key, value] of Object.entries(payload)) {
      const definition = dataDefinitions[key]
      if (definition) {
        const result = definition(value)
        if (result.ok) {
          validationResults[key] = result.data
        } else {
          errors.push(`${key}: ${result.error}`)
        }
      } else {
        // Unknown field - pass through
        validationResults[key] = value
      }
    }

    return {
      ok: errors.length === 0,
      validated: validationResults,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: Date.now()
    }
  })

  sensor.log('plugin-system', 'info', 'data-definitions-loaded')
}

/**
 * Load talent definition plugins
 */
const loadTalentDefinitions = async (): Promise<void> => {
  // Register talent execution service
  systemBranch.action({
    id: 'talent-executor',
    name: 'Talent Execution Engine',
    type: 'system-service',
    group: 'execution',
    tags: ['system', 'internal', 'talents'],
    description: 'Executes talent definitions for channel processing',
    payload: {},
    priority: {level: 'critical' as const}
  })

  systemBranch.on('talent-executor', (payload: any) => {
    // Import talent definitions here to avoid circular dependency

    const {talentName, action, payload: talentPayload} = payload

    try {
      const result = executeTalent(talentName, action, talentPayload)

      return {
        ok: result.ok,
        executed: true,
        talent: talentName,
        result: result.payload || result.message,
        error: result.error,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        ok: false,
        executed: false,
        talent: talentName,
        error: String(error),
        timestamp: Date.now()
      }
    }
  })

  sensor.log('plugin-system', 'info', 'talent-definitions-loaded')
}

/**
 * Load orchestration definition plugins
 */
const loadOrchestrationDefinitions = async (): Promise<void> => {
  // Register orchestration service
  systemBranch.action({
    id: 'orchestration-registrar',
    name: 'Orchestration Registration Service',
    type: 'system-service',
    group: 'orchestration',
    tags: ['system', 'internal', 'orchestration'],
    description: 'Registers and manages orchestration definitions',
    payload: {},
    priority: {level: 'high' as const}
  })

  systemBranch.on('orchestration-registrar', (config: any) => {
    try {
      const result = orchestration.create(config)

      return {
        ok: result.ok,
        registered: true,
        orchestrationId: config.id,
        message: result.message,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        ok: false,
        registered: false,
        orchestrationId: config.id,
        error: String(error),
        timestamp: Date.now()
      }
    }
  })

  sensor.log('plugin-system', 'info', 'orchestration-definitions-loaded')
}

/**
 * Load intelligence definition plugins
 */
const loadIntelligenceDefinitions = async (): Promise<void> => {
  // Register intelligence processing service
  systemBranch.action({
    id: 'intelligence-processor',
    name: 'Intelligence Processing Service',
    type: 'system-service',
    group: 'intelligence',
    tags: ['system', 'internal', 'ai', 'fusion', 'patterns'],
    description: 'Processes fusion and pattern recognition operations',
    payload: {},
    priority: {level: 'high' as const}
  })

  systemBranch.on('intelligence-processor', (payload: any) => {
    const {operation, data} = payload

    try {
      let result: any

      switch (operation) {
        case 'fusion':
          result = fusion(data.action, data.payload)
          break
        case 'patterns':
          result = patterns(data.action, data.payload)
          break
        default:
          throw new Error(`Unknown intelligence operation: ${operation}`)
      }

      return {
        ok: result.ok,
        processed: true,
        operation,
        result: result.payload || result.message,
        error: result.error,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        ok: false,
        processed: false,
        operation,
        error: String(error),
        timestamp: Date.now()
      }
    }
  })

  sensor.log('plugin-system', 'info', 'intelligence-definitions-loaded')
}

// Export only the controlled interface - systemBranch is never exposed
export default pluginSystem
