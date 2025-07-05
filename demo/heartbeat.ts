// demo/heartbeat.ts
import {cyre, log} from '../src'

// Initialize first
await cyre.init()

// Create an action with infinite repeat
cyre.action({
  id: 'heartbeat://',
  type: 'system',
  interval: 1200, // 50 bpm
  repeat: true
})

// Handle the action with visible output
cyre.on('heartbeat://', () => {
  log.debug('💓 Heartbeat')
  return
})

cyre.on('heartbeat://', () => {
  log.debug('💓 Heartbeat 2')
  return
})

cyre.on('heartbeat://', () => {
  log.debug('💓 Heartbeat 3')
  return
})

// lock cyre from further registration
cyre.lock()
// Start the heartbeat
const result = await cyre.call('heartbeat://')
console.log(result)
