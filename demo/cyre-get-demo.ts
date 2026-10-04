// demo/cyre-get-demo.ts
// Small verification demo for cyre.get(id): confirms it returns the full
// ChannelPayload record - {req, prevReq, res, metadata} - not just the raw
// payload, and that the CyreInstance type now matches that at compile time
// (get: (id: string) => ChannelPayload | undefined, per app.ts). Run with
// e.g. `npx tsx demo/cyre-get-demo.ts` or `bun demo/cyre-get-demo.ts`.
import {cyre, log} from '../src'

console.log('\n' + '='.repeat(78))
console.log(
  '  C Y R E   . G E T ( )   D E M O   ( r e q / r e s / p r e v R e q )'
)
console.log('='.repeat(78))

await cyre.init()

cyre.action({id: 'user-update', payload: {name: 'Alice'}})
cyre.on('user-update', (payload: {name: string}) => ({
  ...payload,
  saved: true
}))

// 1) Before any call() - req should already hold the registration-time
//    payload, res should still be undefined (no execution yet).
const beforeCall = cyre.get('user-update')
console.log('\n[1] state right after action() registration:')
console.log('    req:', beforeCall?.req)
console.log('    res:', beforeCall?.res)
console.log('    metadata.status:', beforeCall?.metadata.status)

// 2) First call() - req becomes the call payload, res is the handler's
//    CyreResponse, prevReq is undefined (only one request so far).
await cyre.call('user-update', {name: 'Bob'})
const afterFirstCall = cyre.get('user-update')
console.log('\n[2] state after cyre.call(\'user-update\', {name: "Bob"}):')
console.log('    req:', afterFirstCall?.req) // {name: 'Bob'}
console.log('    res:', afterFirstCall?.res) // full CyreResponse
console.log('    prevReq:', afterFirstCall?.prevReq) // {name: 'Alice'}
console.log('    metadata:', afterFirstCall?.metadata)

// 3) Second call() - prevReq should shift to what req held a moment ago.
await cyre.call('user-update', {name: 'Carol'})
const afterSecondCall = cyre.get('user-update')
console.log('\n[3] state after cyre.call(\'user-update\', {name: "Carol"}):')
console.log('    req:', afterSecondCall?.req) // {name: 'Carol'}
console.log('    prevReq:', afterSecondCall?.prevReq) // {name: 'Bob'}

// 4) Related helpers should agree with the same store.
console.log('\n[4] cross-checking helper methods:')
console.log(
  '    cyre.getPrevious() === state.prevReq:',
  JSON.stringify(cyre.getPrevious('user-update')) ===
    JSON.stringify(afterSecondCall?.prevReq)
)
console.log(
  '    cyre.hasChanged(id, {name: "Carol"}) (should be false, same as req):',
  cyre.hasChanged('user-update', {name: 'Carol'})
)
console.log(
  '    cyre.hasChanged(id, {name: "Dave"}) (should be true, differs from req):',
  cyre.hasChanged('user-update', {name: 'Dave'})
)

// 5) Assertions - fail loudly if behavior/typing regresses.
const failures: string[] = []
if (afterSecondCall?.req?.name !== 'Carol')
  failures.push('req did not track the latest call payload')
if (afterSecondCall?.prevReq?.name !== 'Bob')
  failures.push('prevReq did not shift to the previous req')
if (afterSecondCall?.res?.ok !== true)
  failures.push('res is not the full CyreResponse from the handler')
if (afterSecondCall?.res?.payload?.saved !== true)
  failures.push("res.payload does not contain the handler's return value")
// requestCount includes the initial action({payload}) registration as
// request #1 (see payloadState.initialize), so two call()s after that
// bring it to 3, not 2 - confirmed by the demo's own [2] output showing
// requestCount: 2 after only the FIRST call().
if (afterSecondCall?.metadata.requestCount !== 3)
  failures.push(
    'metadata.requestCount did not reach 3 after registration + two calls'
  )
if (cyre.hasChanged('user-update', {name: 'Carol'}))
  failures.push('hasChanged() returned true for an unchanged payload')

console.log('\n' + '='.repeat(78))
if (failures.length === 0) {
  console.log(
    '  PASS - cyre.get() returns {req, prevReq, res, metadata} as expected.'
  )
} else {
  console.log('  FAIL:')
  failures.forEach(f => console.log('   - ' + f))
}
console.log('='.repeat(78))

cyre.forget('user-update')
log.sys('cyre.get() demo complete.')
cyre.shutdown()
