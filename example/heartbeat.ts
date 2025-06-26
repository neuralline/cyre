// example/heartbeat.ts
import {cyre, log} from '../src'

// Initialize first
await cyre.init()

// Create an action with infinite repeat
cyre.action({
  id: 'heartbeat',
  type: 'system',
  interval: 1200, // 50 bpm
  repeat: true
})

// Handle the action with visible output
cyre.on('heartbeat', () => {
  log.debug('💓 Heartbeat')
  return
})

// Start the heartbeat
await cyre.call('heartbeat')
