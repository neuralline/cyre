// demo/repeat.ts
import cyre, {log} from '../src'

cyre.action({id: 'repeat 10', repeat: 10, interval: 1000})
cyre.on('repeat 10', payload => {
  log.debug('{repeat: 10, interval: 1000')
})
cyre.call('repeat 10')

cyre.action({
  id: 'repeat with interval undefined',
  repeat: 10,
  interval: undefined
})
cyre.on('repeat with interval undefined', payload => {
  log.debug('{repeat: 10, interval: undefined}')
})
cyre.call('repeat with interval undefined')
cyre.call('repeat with interval undefined')
cyre.call('repeat with interval undefined')

cyre.action({
  id: 'repeat with interval 0',
  repeat: 10,
  interval: 0
})
cyre.on('repeat with interval 0', payload => {
  log.debug('{repeat: 10, interval: 0}')
})
cyre.call('repeat with interval 0')
cyre.call('repeat with interval 0')
cyre.call('repeat with interval 0')

cyre.action({
  id: 'delay with interval 0',

  delay: 900
})
cyre.on('delay with interval 0', payload => {
  log.debug('{ 900')
})
cyre.call('delay with interval 0')
cyre.call('delay with interval 0')
cyre.call('delay with interval 0')
cyre.call('delay with interval 0')
cyre.call('delay with interval 0')
cyre.call('delay with interval 0')

cyre.action({
  id: 'delay 1000 with interval 1000',
  repeat: 10,
  interval: 1000,
  delay: 1000
})
cyre.on('delay 1000 with interval 1000', payload => {
  log.debug('{repeat: 10, interval: 1000, delay: 1000}')
})
cyre.call('delay 1000 with interval 1000')
cyre.call('delay 1000 with interval 1000')
cyre.call('delay 1000 with interval 1000')

cyre.action({
  id: 'repeat: 10, interval: 1000, delay: 0',
  repeat: 10,
  interval: 1000,
  delay: 0
})
cyre.on('repeat: 10, interval: 1000, delay: 0', payload => {
  log.debug('{repeat: 10, interval: 1000, delay: 0}')
})
cyre.call('repeat: 10, interval: 1000, delay: 0')
cyre.call('repeat: 10, interval: 1000, delay: 0')
cyre.call('repeat: 10, interval: 1000, delay: 0')

cyre.action({
  id: 'repeat: undefined, interval: 1000, delay: 1000',
  repeat: undefined,
  interval: 1000,
  delay: 1000
})
cyre.on('repeat: undefined, interval: 1000, delay: 1000', payload => {
  log.debug('{repeat: undefined, interval: 1000, delay: 1000}')
})
cyre.call('repeat: undefined, interval: 1000, delay: 1000')
cyre.call('repeat: undefined, interval: 1000, delay: 1000')
cyre.call('repeat: undefined, interval: 1000, delay: 1000')
