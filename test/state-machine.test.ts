// Comprehensive tests for state machine integration

import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {cyre} from '../src/app'
import {
  machine,
  patterns,
  stateMachineService,
  createAndStartStateMachine
} from '../src/state-machine'

describe('Cyre State Machine Integration', () => {
  beforeEach(() => {
    cyre.initialize()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cyre.clear()
    vi.useRealTimers()
  })

  describe('Basic State Machine Creation', () => {
    it('should create a simple state machine', () => {
      const config = machine('test-machine')
        .initial('idle')
        .state('idle')
        .on('START', 'running')
        .state('running')
        .on('STOP', 'idle')
        .on('FINISH', 'done')
        .state('done')
        .final()
        .build()

      const machine1 = cyre.stateMachine.create(config)

      expect(machine1.id).toBe('test-machine')
      expect(machine1.state.current).toBe('idle')
      expect(machine1.running).toBe(false)
    })

    it('should start and transition between states', () => {
      const config = machine('transition-test')
        .initial('waiting')
        .state('waiting')
        .on('BEGIN', 'working')
        .state('working')
        .on('COMPLETE', 'finished')
        .state('finished')
        .final()
        .build()

      const testMachine = createAndStartStateMachine(config)

      expect(testMachine.running).toBe(true)
      expect(testMachine.state.current).toBe('waiting')

      // Transition to working
      testMachine.send('BEGIN')
      expect(testMachine.state.current).toBe('working')

      // Transition to finished
      testMachine.send('COMPLETE')
      expect(testMachine.state.current).toBe('finished')
      expect(testMachine.final).toBe(true)
    })

    it('should handle guards correctly', async () => {
      interface TestContext {
        count: number
        maxCount: number
      }

      const config = machine<TestContext>('guard-test')
        .initial('counting')
        .context({count: 0, maxCount: 3})
        .guards({
          canIncrement: context => context.count < context.maxCount,
          atMax: context => context.count >= context.maxCount
        })
        .state('counting')
        .when('INCREMENT', 'canIncrement', 'counting')
        .when('INCREMENT', 'atMax', 'maxed')
        .state('maxed')
        .final()
        .build()

      const guardMachine = createAndStartStateMachine(config)

      // Should increment while under max
      guardMachine.send('INCREMENT', {count: 1})
      expect(guardMachine.state.current).toBe('counting')

      guardMachine.send('INCREMENT', {count: 2})
      expect(guardMachine.state.current).toBe('counting')

      guardMachine.send('INCREMENT', {count: 3})
      expect(guardMachine.state.current).toBe('counting')

      // Should transition to maxed when at limit
      guardMachine.send('INCREMENT', {count: 4})
      expect(guardMachine.state.current).toBe('maxed')
    })

    it('should execute entry and exit actions', () => {
      const entryMock = vi.fn()
      const exitMock = vi.fn()
      const actionMock = vi.fn()

      const config = machine('action-test')
        .initial('start')
        .actions({
          onEntry: entryMock,
          onExit: exitMock,
          onTransition: actionMock
        })
        .state('start')
        .entry('onEntry')
        .exit('onExit')
        .do('MOVE', 'end', 'onTransition')
        .state('end')
        .final()
        .build()

      const actionMachine = createAndStartStateMachine(config)

      // Entry action should be called on start
      expect(entryMock).toHaveBeenCalledTimes(1)

      // Send transition event
      actionMachine.send('MOVE')

      // Exit and transition actions should be called
      expect(exitMock).toHaveBeenCalledTimes(1)
      expect(actionMock).toHaveBeenCalledTimes(1)
      expect(actionMachine.state.current).toBe('end')
    })
  })

  describe('Integration with Cyre Actions', () => {
    it('should integrate with Cyre action system', async () => {
      const config = machine('cyre-integration')
        .initial('idle')
        .state('idle')
        .on('ACTIVATE', 'active')
        .state('active')
        .on('DEACTIVATE', 'idle')
        .build()

      const integrationMachine = createAndStartStateMachine(config)

      // Set up Cyre action to control state machine
      cyre.action({id: 'control-machine', payload: {}})
      cyre.on('control-machine', payload => {
        integrationMachine.send(payload.event, payload.data)
        return {handled: true, state: integrationMachine.state.current}
      })

      // Test integration
      const result = await cyre.call('control-machine', {
        event: 'ACTIVATE',
        data: {}
      })

      expect(result.ok).toBe(true)
      expect(result.payload.state).toBe('active')
      expect(integrationMachine.state.current).toBe('active')
    })

    it('should trigger Cyre actions from state machine', () => {
      const cyreActionMock = vi.fn()

      // Set up Cyre action to be triggered
      cyre.action({id: 'machine-event', payload: {}})
      cyre.on('machine-event', cyreActionMock)

      const config = machine('trigger-test')
        .initial('waiting')
        .actions({
          triggerCyre: () => {
            cyre.call('machine-event', {triggered: true})
          }
        })
        .state('waiting')
        .do('TRIGGER', 'triggered', 'triggerCyre')
        .state('triggered')
        .final()
        .build()

      const triggerMachine = createAndStartStateMachine(config)

      triggerMachine.send('TRIGGER')

      expect(triggerMachine.state.current).toBe('triggered')
      expect(cyreActionMock).toHaveBeenCalledWith({triggered: true})
    })
  })

  describe('State Machine Service', () => {
    it('should manage multiple state machines', () => {
      const machine1 = cyre.stateMachine.create(
        machine('service-test-1').initial('idle').state('idle').final().build()
      )

      const machine2 = cyre.stateMachine.create(
        machine('service-test-2')
          .initial('waiting')
          .state('waiting')
          .final()
          .build()
      )

      expect(cyre.stateMachine.get('service-test-1')).toBe(machine1)
      expect(cyre.stateMachine.get('service-test-2')).toBe(machine2)

      const allMachines = cyre.stateMachine.getAll()
      expect(allMachines).toContain(machine1)
      expect(allMachines).toContain(machine2)
    })

    it('should remove state machines correctly', () => {
      const testMachine = cyre.stateMachine.create(
        machine('removable-test')
          .initial('active')
          .state('active')
          .final()
          .build()
      )

      expect(cyre.stateMachine.get('removable-test')).toBe(testMachine)

      const removed = cyre.stateMachine.remove('removable-test')
      expect(removed).toBe(true)
      expect(cyre.stateMachine.get('removable-test')).toBeUndefined()
    })

    it('should clear all state machines', () => {
      cyre.stateMachine.create(
        machine('clear-test-1').initial('idle').state('idle').final().build()
      )
      cyre.stateMachine.create(
        machine('clear-test-2').initial('idle').state('idle').final().build()
      )

      expect(cyre.stateMachine.getAll().length).toBe(2)

      cyre.stateMachine.clear()
      expect(cyre.stateMachine.getAll().length).toBe(0)
    })
  })
})
