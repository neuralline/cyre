/** @format */

const {cyre} = require('../dist/cyre.cjs')

test('CYRE INTRODUCTION', () => {
  expect(cyre.test()).toEqual({ok: true, data: 200, message: 'Cyre: Hi there, what can I help you with'})
})
test('CYRE prevent null action', () => {
  expect(cyre.action()).toEqual({ok: false, data: 'insert', message: `action.id must be a string. Received 'null'`})
})
test('CYRE create action', () => {
  expect(cyre.emit('first test', 'action type')).toEqual({ok: false, data: undefined})
})
test('CYRE call action', () => {
  expect(cyre.call('first test', 'action type')).toEqual({ok: false, data: undefined})
})

test('the data is peanut butter', () => {
  expect(cyre.on()).toEqual({ok: false, data: undefined, message: 'invalid function'})
})
test('register empty arrow function', () => {
  expect(cyre.on('register new fn', () => {})).toEqual({ok: true, data: undefined})
})

test('return data', () => {
  expect(cyre.on('cyre return data', data => data)).toEqual({ok: true, data: undefined})
})

test('register duplicates again', () => {
  expect(cyre._emitAction('cyre return data', 4565)).toEqual({ok: true, data: 'cyre return data action emitted', done: true})
})
