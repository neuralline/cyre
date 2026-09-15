// demo/buffer-demo.ts
import {cyre, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Initialize first
await cyre.init()

// ---------------------------------------------------------------------------
// 1) Basic overwrite buffer - only the last call in the window should survive
// ---------------------------------------------------------------------------
cyre.action({
  id: 'buffer-overwrite://',
  buffer: {window: 300}
})

cyre.on('buffer-overwrite://', payload => {
  log.debug('🪣 overwrite buffer fired with:', payload)
  return payload
})

console.log('\n=== 1) overwrite buffer ===')
await cyre.call('buffer-overwrite://', 'item-1')
await cyre.call('buffer-overwrite://', 'item-2')
await cyre.call('buffer-overwrite://', 'item-3')
console.log('calls made, waiting for 300ms window to close...')
await wait(400)

// ---------------------------------------------------------------------------
// 2) Append buffer - all calls in the window should be collected into an array
// ---------------------------------------------------------------------------
cyre.action({
  id: 'buffer-append://',
  buffer: {window: 300, strategy: 'append'}
})

cyre.on('buffer-append://', payload => {
  log.debug('🪣 append buffer fired with:', payload)
  return payload
})

console.log('\n=== 2) append buffer ===')
await cyre.call('buffer-append://', 'a')
await cyre.call('buffer-append://', 'b')
await cyre.call('buffer-append://', 'c')
console.log('calls made, waiting for 300ms window to close...')
await wait(400)

// ---------------------------------------------------------------------------
// 3) Multiple sequential windows - each window should deliver its own payload,
//    independent of the previous one
// ---------------------------------------------------------------------------
cyre.action({
  id: 'buffer-multi-window://',
  buffer: {window: 300}
})

let multiWindowCallCount = 0
cyre.on('buffer-multi-window://', payload => {
  multiWindowCallCount++
  log.debug(
    `🪣 multi-window buffer fired (#${multiWindowCallCount}) with:`,
    payload
  )
  return payload
})

console.log('\n=== 3) multiple sequential windows ===')
await cyre.call('buffer-multi-window://', 'batch1-item1')
await cyre.call('buffer-multi-window://', 'batch1-item2')
console.log('batch1 sent, waiting for window to close...')
await wait(400)

await cyre.call('buffer-multi-window://', 'batch2-item1')
await cyre.call('buffer-multi-window://', 'batch2-item2')
console.log('batch2 sent, waiting for window to close...')
await wait(400)

console.log(
  multiWindowCallCount === 2
    ? '✅ handler fired exactly twice, once per window'
    : `❌ expected 2 firings, got ${multiWindowCallCount}`
)

// ---------------------------------------------------------------------------
// 4) Slow handler - a call landing while the previous window is still
//    dispatching must not be dropped or double-fired
// ---------------------------------------------------------------------------
cyre.action({
  id: 'buffer-slow-handler://',
  buffer: {window: 200}
})

const slowHandlerCalls: any[] = []
cyre.on('buffer-slow-handler://', async payload => {
  slowHandlerCalls.push(payload)
  log.debug('🪣 slow handler starting with:', payload)
  await wait(300) // dispatch takes longer than the NEXT window's own timer
  log.debug('🪣 slow handler finished with:', payload)
  return payload
})

console.log('\n=== 4) slow handler + call arriving mid-dispatch ===')
await cyre.call('buffer-slow-handler://', 'first-window-payload')
console.log('waiting for the window to close and dispatch to begin...')
await wait(250) // window closes at 200ms, dispatch starts, takes 300ms total

// this call lands while the first window's handler is still running
await cyre.call('buffer-slow-handler://', 'second-window-payload')
console.log(
  'second call made mid-dispatch, waiting for everything to settle...'
)
await wait(600)

console.log('slow handler received payloads (in order):', slowHandlerCalls)
console.log(
  slowHandlerCalls.length === 2
    ? '✅ both payloads were delivered, none dropped or duplicated'
    : `❌ expected 2 deliveries, got ${slowHandlerCalls.length}: ${JSON.stringify(slowHandlerCalls)}`
)

// lock cyre from further registration
cyre.lock()

console.log('\ndone.')
