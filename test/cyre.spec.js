const {cyre} = require('../dist/cyre.js')

test('CYRE INTRODUCTION', () => {
  expect(cyre.test()).toEqual({
    ok: true,
    payload: 200,
    message: 'Cyre: Hi there, what can I help you with'
  })
})
test('CYRE prevent null action', () => {
  expect(cyre.action()).toEqual({
    ok: false,
    payload: undefined,
    message: `@cyre.action: action id is required`
  })
})
test('CYRE valid action', () => {
  expect(cyre.action({id: test})).toEqual({
    ok: true
  })
})
test('CYRE calling undefined action should fail', () => {
  expect(cyre.call('first test', 'action type')).toEqual({
    message: '@cyre.call : action not found first test',
    ok: false,
    payload: undefined
  })
})
test('CYRE calling null action', () => {
  expect(cyre.call()).toEqual({
    ok: false,
    payload: undefined,
    message: '@cyre.call : id does not exist'
  })
})
test('CYRE should not call empty string', () => {
  expect(cyre.call('')).toEqual({
    ok: false,
    payload: undefined,
    message: '@cyre.call : id does not exist'
  })
})
test('the data is peanut butter', () => {
  expect(cyre.on()).toEqual({
    ok: false,
    payload: undefined,
    message: 'invalid function'
  })
})
test('register empty arrow function', () => {
  expect(cyre.on('register new fn', () => {})).toEqual({
    ok: true,
    payload: 'register new fn'
  })
})
test('@cyre registering named function', () => {
  expect(cyre.on('named function', data => data)).toEqual({
    ok: true,
    payload: 'named function'
  })
})
