// example/heartbeat.ts
import {cyre, log} from '../src'
// Create an action with infinite repeat

cyre.init()
cyre.action({
  id: 'heartbeat',
  type: 'system',
  interval: false, // Every 5 seconds
  repeat: -2,
  debounce: 1000,
  throttle: 3000,
  maxWait: 299 // Infinite repetition
})

// Handle the action
cyre.on('heartbeat', () => {
  log.success('Heartbeat at: ' + new Date().toISOString())
})

// Start the heartbeat
cyre.call('heartbeat')
