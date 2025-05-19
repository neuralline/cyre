import cyre from '../src/app'

cyre.on('action1', payload => {
    console.log(payload.frute)
})
cyre.action({id: 'action1', repeat: 10, interval: 500})

// Functions:
const apple = () => cyre.call('action1', {frute: 'apple'})
const orange = () => cyre.call('action1', {frute: 'orange'})
const lemon = () => cyre.call('action1', {frute: 'lemon'})
apple()
orange()
lemon()

cyre.action({id: 'uber', payload: 44085648634})
cyre.on('uber', number => {
    console.log('Calling Uber: ', number)
})
cyre.call('uber')
//cyre.shutdown()
