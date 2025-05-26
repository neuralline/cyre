// example/repeat.ts
import {cyre, log} from '../src'
// Create an action with infinite repeat
cyre.action({
  id: 'heartbeat',
  type: 'system',
  interval: 5000, // Every 5 seconds
  repeat: true // Infinite repetition
})

// Handle the action
cyre.on('heartbeat', () => {
  log.success('Heartbeat at: ' + new Date().toISOString())
})

// Start the heartbeat
cyre.call('heartbeat')
