// example/repeat.ts
import {cyre, CyreLog} from '../src/app'
// Create an action with infinite repeat
cyre.action({
  id: 'heartbeat',
  type: 'system',
  interval: 5000, // Every 5 seconds
  repeat: true // Infinite repetition
})

// Handle the action
cyre.on('heartbeat', () => {
  CyreLog.success('Heartbeat at: ' + new Date().toISOString())
})

// Start the heartbeat
cyre.call('heartbeat')
