// src/state-machine/state-machine-service.ts
// State machine service for managing multiple machines

import {log} from '../components/cyre-log'
import {metricsReport} from '../context/metrics-report'
import {
  createStateMachine,
  removeStateMachine,
  clearStateMachines
} from './state-machine'
import type {
  StateMachineConfig,
  StateMachineInterpreter,
  StateMachineService,
  MachineId
} from '../types/state-machine'

/*

      C.Y.R.E - S.T.A.T.E - M.A.C.H.I.N.E - S.E.R.V.I.C.E
      
      Service for managing multiple state machines:
      - Machine lifecycle management
      - Registry and lookup
      - Batch operations
      - Performance monitoring

*/

interface ServiceState {
  machines: Map<MachineId, StateMachineInterpreter>
  initialized: boolean
  debug: boolean
}

const serviceState: ServiceState = {
  machines: new Map(),
  initialized: false,
  debug: false
}

/**
 * Initialize state machine service
 */
const initialize = (debug = false): void => {
  if (serviceState.initialized) return

  serviceState.debug = debug
  serviceState.initialized = true

  metricsReport.sensor.log(
    'state-machine-service',
    'info',
    'service-initialize',
    {
      debug,
      timestamp: Date.now()
    }
  )

  if (debug) {
    log.debug('State machine service initialized')
  }
}

/**
 * Validate machine configuration
 */
const validateConfig = <TContext>(
  config: StateMachineConfig<TContext>
): void => {
  if (!config.id) {
    throw new Error('State machine ID is required')
  }

  if (!config.initial) {
    throw new Error('Initial state is required')
  }

  if (!config.states || Object.keys(config.states).length === 0) {
    throw new Error('States configuration is required')
  }

  if (!config.states[config.initial]) {
    throw new Error(`Initial state '${config.initial}' not found in states`)
  }

  // Validate state references in transitions
  for (const [stateId, stateConfig] of Object.entries(config.states)) {
    if (stateConfig.on) {
      for (const [eventType, transition] of Object.entries(stateConfig.on)) {
        const target =
          typeof transition === 'string' ? transition : transition.target
        if (!config.states[target]) {
          throw new Error(
            `Invalid target state '${target}' in state '${stateId}' for event '${eventType}'`
          )
        }
      }
    }

    if (stateConfig.after) {
      for (const [delay, transition] of Object.entries(stateConfig.after)) {
        const target =
          typeof transition === 'string' ? transition : transition.target
        if (!config.states[target]) {
          throw new Error(
            `Invalid target state '${target}' in delayed transition from state '${stateId}'`
          )
        }
      }
    }
  }
}

/**
 * State machine service implementation
 */
export const stateMachineService: StateMachineService = {
  create<TContext = any>(
    config: StateMachineConfig<TContext>
  ): StateMachineInterpreter<TContext> {
    if (!serviceState.initialized) {
      initialize()
    }

    // Validate configuration
    validateConfig(config)

    // Check for existing machine
    if (serviceState.machines.has(config.id)) {
      throw new Error(`State machine with ID '${config.id}' already exists`)
    }

    try {
      // Create the machine
      const machine = createStateMachine(config)

      // Store in registry
      serviceState.machines.set(config.id, machine)

      // Record creation
      metricsReport.sensor.log(config.id, 'info', 'state-machine-create', {
        initialState: config.initial,
        stateCount: Object.keys(config.states).length,
        hasContext: !!config.context,
        priority: config.priority || 'medium'
      })

      if (serviceState.debug || config.debug) {
        log.debug(
          `Created state machine '${config.id}' with initial state '${config.initial}'`
        )
      }

      return machine
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      metricsReport.sensor.error(
        config.id,
        errorMessage,
        'state-machine-create'
      )
      throw error
    }
  },

  get<TContext = any>(
    id: MachineId
  ): StateMachineInterpreter<TContext> | undefined {
    return serviceState.machines.get(id) as
      | StateMachineInterpreter<TContext>
      | undefined
  },

  remove(id: MachineId): boolean {
    const machine = serviceState.machines.get(id)
    if (!machine) return false

    try {
      // Stop the machine if running
      if (machine.running) {
        machine.stop()
      }

      // Remove from registry
      serviceState.machines.delete(id)

      // Clean up underlying resources
      const removed = removeStateMachine(id)

      metricsReport.sensor.log(id, 'info', 'state-machine-remove', {
        finalState: machine.state.current,
        wasRunning: machine.running
      })

      if (serviceState.debug) {
        log.debug(`Removed state machine '${id}'`)
      }

      return removed
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      metricsReport.sensor.error(id, errorMessage, 'state-machine-remove')
      return false
    }
  },

  getAll(): StateMachineInterpreter[] {
    return Array.from(serviceState.machines.values())
  },

  clear(): void {
    const machineIds = Array.from(serviceState.machines.keys())

    for (const id of machineIds) {
      this.remove(id)
    }

    // Clear underlying storage
    clearStateMachines()

    metricsReport.sensor.log('state-machine-service', 'info', 'service-clear', {
      clearedCount: machineIds.length,
      timestamp: Date.now()
    })

    if (serviceState.debug) {
      log.debug(`Cleared ${machineIds.length} state machines`)
    }
  }
}

/**
 * Convenience function to create and start a state machine
 */
export const createAndStartStateMachine = <TContext = any>(
  config: StateMachineConfig<TContext>
): StateMachineInterpreter<TContext> => {
  const machine = stateMachineService.create(config)
  machine.start()
  return machine
}

/**
 * Get service statistics
 */
export const getStateMachineStats = () => {
  const machines = serviceState.machines.values()
  const stats = {
    totalMachines: serviceState.machines.size,
    runningMachines: 0,
    stoppedMachines: 0,
    finalMachines: 0,
    stateDistribution: {} as Record<string, number>,
    machineDetails: [] as Array<{
      id: string
      state: string
      running: boolean
      final: boolean
    }>
  }

  for (const machine of machines) {
    if (machine.running) stats.runningMachines++
    else stats.stoppedMachines++

    if (machine.final) stats.finalMachines++

    const currentState = machine.state.current
    stats.stateDistribution[currentState] =
      (stats.stateDistribution[currentState] || 0) + 1

    stats.machineDetails.push({
      id: machine.id,
      state: currentState,
      running: machine.running,
      final: machine.final
    })
  }

  return stats
}

/**
 * Debug utilities
 */
export const debugStateMachines = () => {
  const stats = getStateMachineStats()

  console.log('=== State Machine Debug Info ===')
  console.log(`Total Machines: ${stats.totalMachines}`)
  console.log(
    `Running: ${stats.runningMachines}, Stopped: ${stats.stoppedMachines}, Final: ${stats.finalMachines}`
  )
  console.log('\nState Distribution:')
  for (const [state, count] of Object.entries(stats.stateDistribution)) {
    console.log(`  ${state}: ${count}`)
  }
  console.log('\nMachine Details:')
  stats.machineDetails.forEach(machine => {
    console.log(
      `  ${machine.id}: ${machine.state} (${
        machine.running ? 'running' : 'stopped'
      }${machine.final ? ', final' : ''})`
    )
  })
  console.log('==============================')
}

/**
 * Enable debug mode for service
 */
export const enableDebug = (enable = true): void => {
  serviceState.debug = enable
  if (enable) {
    log.debug('State machine service debug mode enabled')
  }
}
