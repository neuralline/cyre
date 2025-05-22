// example/basic.ts
import {cyre, log} from '../src/app'
//export default cyre

//example use
// Register an action with change detection

// Subscribe to action
cyre.on([
  {
    id: 'userProfile',
    fn: payload => {
      log.debug(`Profile updated: ${payload}`)
    }
  },
  {
    id: 'action1',
    fn: payload => {
      log.warn(`Action 1: ${payload}`)
    }
  },
  {
    id: 'action2',
    fn: payload => {
      log.info(`Action 2: ${payload}`)
    }
  }
])

// Register multiple actions
cyre.action([
  {
    id: 'userProfile',
    detectChanges: false,
    payload: {name: 'Jane'},

    repeat: 3000,
    interval: 50
  },
  {
    id: 'action1',
    payload: 'John',

    repeat: 1000,
    interval: 1000
  },
  {
    id: 'action2',
    payload: 'Doe',

    repeat: 1000,
    interval: 10000
  }
])

// Example calls (now without await to allow parallel execution)
// cyre.call('userProfile', {name: 'Jane'})
// cyre.call('action1', {data: 'John'})
// cyre.call('action2', {data: 'Doe'})

// Define an action with repeat: true
cyre.action({
  id: 'forever-action',
  type: 'repeating',
  payload: {value: 42},
  interval: 2000, // 2 seconds
  repeat: true // Should repeat indefinitely
})

// Listen for events
cyre.on('forever-action', payload => {
  console.log('Action executed at:', new Date().toISOString(), payload)
})

// Trigger the action - should repeat indefinitely
cyre.call('forever-action')
