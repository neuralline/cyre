import {cyre, CyreLog} from '../src/app'
//export default cyre

//example use
// Register an action with change detection

// Subscribe to action
cyre.on([
  {
    id: 'userProfile',
    fn: payload => {
      CyreLog.debug(`Profile updated: ${payload}`)
    }
  },
  {
    id: 'action1',
    fn: payload => {
      CyreLog.warn(`Action 1: ${payload}`)
    }
  },
  {
    id: 'action2',
    fn: payload => {
      CyreLog.info(`Action 2: ${payload}`)
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
cyre.call('userProfile', {name: 'Jane'})
cyre.call('action1', {data: 'John'})
cyre.call('action2', {data: 'Doe'})
