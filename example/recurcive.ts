import {cyre} from '../src/app'

cyre.action({id: 'id', count: 0})
cyre.on('id', count => {
  console.log('stress: ' + cyre.getBreathingState().stress)
  console.log('breathCount: ' + cyre.getBreathingState().breathCount)
  console.log('pattern: ' + cyre.getBreathingState().pattern)
  cyre.getBreathingState()
  return {
    id: 'id',
    payload: ''
  }
})

cyre.call('id')

//cyre.shutdown()
