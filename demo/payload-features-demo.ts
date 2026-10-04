// demo/payload-features-demo.ts
// Verification demo for four recent additions to payload/metrics handling:
//   1. keepPayload: false - pass a payload through without storing it
//   2. keepPayload: false + detectChanges - rejected at registration
//   3. history: N - keep more than one previous request payload
//   4. throttle/debounce/buffer call counters on getMetrics()/useMetrics()
//   5. resetPayload(id) - clear a channel's payload, keep the channel
// Run with `npx tsx demo/payload-features-demo.ts` or
// `bun demo/payload-features-demo.ts`.
import {cyre, useMetrics, mostGated} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const banner = (title: string) => {
  console.log('\n' + '='.repeat(78))
  console.log(`  ${title}`)
  console.log('='.repeat(78))
}

console.log('\n' + '='.repeat(78))
console.log('  C Y R E   P A Y L O A D   F E A T U R E S   D E M O')
console.log('='.repeat(78))

await cyre.init()

// ---------------------------------------------------------------------------
// 1) keepPayload: false - handler still gets the real payload by reference,
//    payload-state never copies it. Good for large one-off payloads a
//    channel has no use for after dispatch.
// ---------------------------------------------------------------------------
banner('1) keepPayload: false - large payload passed through, not stored')

const bigDocument = {id: 'doc-1', text: 'x'.repeat(1_000_000)}

cyre.action({id: 'big-doc', keepPayload: false})
let handlerSawSameReference = false
cyre.on('big-doc', (payload: typeof bigDocument) => {
  handlerSawSameReference = payload === bigDocument
  return {processed: true, length: payload.text.length}
})

const bigDocResult = await cyre.call('big-doc', bigDocument)
console.log('handler received the actual payload (by reference):', handlerSawSameReference)
console.log('call ok:', bigDocResult.ok, '- response payload:', bigDocResult.payload)

const bigDocState = cyre.get('big-doc')
console.log('req stored in payload-state (expect undefined):', bigDocState?.req)
console.log('res.payload stored (expect undefined):', bigDocState?.res?.payload)
console.log('res.ok still visible (small, kept):', bigDocState?.res?.ok)
console.log('requestCount still tracked (expect 1):', bigDocState?.metadata.requestCount)

// ---------------------------------------------------------------------------
// 2) keepPayload: false + detectChanges is a compile-time conflict -
//    detectChanges has nothing to compare against once storage is off.
// ---------------------------------------------------------------------------
banner('2) keepPayload: false + detectChanges - rejected at registration')

const conflict = cyre.action({
  id: 'conflict',
  keepPayload: false,
  detectChanges: true
})
console.log('registration ok (expect false):', conflict.ok)
console.log('message:', conflict.message)

// ---------------------------------------------------------------------------
// 3) history: N - keep more than the default single previous payload.
// ---------------------------------------------------------------------------
banner('3) history: N - keep more than one previous payload')

cyre.action({id: 'audit-trail', history: 3})
cyre.on('audit-trail', (n: number) => n)
for (const n of [1, 2, 3, 4]) {
  await cyre.call('audit-trail', n)
}
console.log('req (current, expect 4):', cyre.get('audit-trail')?.req)
console.log('prevReq (expect 3):', cyre.get('audit-trail')?.prevReq)
console.log(
  'getHistory (expect [3, 2, 1], newest first, capped at 3):',
  cyre.getHistory('audit-trail')
)

cyre.action({id: 'default-history'})
cyre.on('default-history', (n: number) => n)
await cyre.call('default-history', 1)
await cyre.call('default-history', 2)
console.log(
  '\ndefault channel (history unset) - getHistory (expect [1], same as prevReq alone):',
  cyre.getHistory('default-history')
)

// ---------------------------------------------------------------------------
// 4) throttle/debounce/buffer counters - previously invisible calls that
//    never reach _executionCount because a protection absorbed them.
// ---------------------------------------------------------------------------
banner('4) throttle/debounce/buffer call counters')

cyre.action({id: 'throttled', throttle: 100})
cyre.on('throttled', () => 'ok')
await cyre.call('throttled', 1)
const throttledReject = await cyre.call('throttled', 2) // still inside the window
console.log(
  'second call throttled (ok expect false):',
  throttledReject.ok,
  '-',
  throttledReject.message
)
console.log(
  'throttleCount (expect 2 - both calls counted, allowed or not):',
  cyre.getMetrics('throttled').throttleCount
)

cyre.action({id: 'debounced', debounce: 40})
cyre.on('debounced', (n: number) => n)
await Promise.all([
  cyre.call('debounced', 1),
  cyre.call('debounced', 2),
  cyre.call('debounced', 3)
])
console.log(
  'debounceCount (expect 3 - every call landing in the window counted):',
  cyre.getMetrics('debounced').debounceCount
)

cyre.action({id: 'buffered', buffer: {window: 40}})
cyre.on('buffered', (n: number) => n)
await Promise.all([cyre.call('buffered', 1), cyre.call('buffered', 2)])
console.log(
  'bufferCount (expect 2):',
  cyre.getMetrics('buffered').bufferCount
)

console.log(
  '\nmostGated() analyzer - channels ranked by throttle+debounce+buffer count:'
)
const vitals = useMetrics(cyre)
console.log(
  mostGated(vitals.channels()).map(row => ({
    id: row.id,
    throttleCount: row.throttleCount,
    debounceCount: row.debounceCount,
    bufferCount: row.bufferCount,
    gatedCount: row.gatedCount
  }))
)
vitals.stop()

// ---------------------------------------------------------------------------
// 5) resetPayload(id) - clear a channel's stored payload without removing
//    the channel (subscribers, protections, path all stay registered).
// ---------------------------------------------------------------------------
banner("5) resetPayload(id) - clear a channel's payload, keep the channel")

cyre.action({id: 'session', payload: {step: 'start'}})
cyre.on('session', (p: any) => p)
await cyre.call('session', {step: 'middle'})
await cyre.call('session', {step: 'end'})
console.log('before reset - req:', cyre.get('session')?.req)
console.log('before reset - prevReq:', cyre.get('session')?.prevReq)

const resetOk = cyre.resetPayload('session')
console.log('resetPayload ok:', resetOk)
console.log(
  'after reset - req (expect back to default {step: "start"}):',
  cyre.get('session')?.req
)
console.log('after reset - prevReq (expect undefined):', cyre.get('session')?.prevReq)
console.log('after reset - metadata:', cyre.get('session')?.metadata)

const stillWorks = await cyre.call('session', {step: 'again'})
console.log('channel still works after reset (ok expect true):', stillWorks.ok)

// A keepPayload: false channel never gets its default reseeded - storing
// it would defeat the point of the flag.
cyre.action({id: 'no-reseed', keepPayload: false, payload: {big: 'data'}})
cyre.on('no-reseed', (p: any) => p)
await cyre.call('no-reseed', {big: 'data2'})
cyre.resetPayload('no-reseed')
console.log(
  'keepPayload:false channel after reset - req (expect undefined, never reseeded):',
  cyre.get('no-reseed')?.req
)

console.log(
  'resetPayload on an unknown id (expect false):',
  cyre.resetPayload('does-not-exist')
)

console.log('\n' + '='.repeat(78))
console.log('  D O N E')
console.log('='.repeat(78) + '\n')

process.exit(0)
