// demo/heartbeat.ts
import {cyre, log} from '../src'

// Initialize first
await cyre.init()

// Create an action with infinite repeat
cyre.action({
  id: 'heartbeat://',
  type: 'system',
  interval: 1200, // 50 bpm
  repeat: true,
  dispatch: 'waterfall'
})

// Handle the action with visible output
cyre.on('heartbeat://', a => {
  log.debug('💓 Heartbeat 1 ', a)
  return a + 1
})

cyre.on('heartbeat://', a => {
  log.debug('💓 Heartbeat 2 ', a)
  return a + 1
})

cyre.on('heartbeat://', a => {
  log.debug('💓 Heartbeat 3 ', a)
  const get = cyre.get('heartbeat://')
  console.log('get: ', get)
  return a + 1
})

// lock cyre from further registration
cyre.lock()
// Start the heartbeat
const result = await cyre.call('heartbeat://', 1)

console.log(result)
