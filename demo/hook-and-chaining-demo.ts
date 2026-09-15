// demo/hook-and-chaining-demo.ts
// The rest of the project's demos already cover a lot of ground:
//   - validation-pipeline-demo.ts   schema/required/condition/selector/
//                                    transform/detectChanges
//   - timekeeper-limits-demo.ts     interval/repeat/delay, pause/resume
//   - buffer-demo.ts                buffer window strategies
//   - branches-demo.ts              useBranch isolation + cross-branch calls
//   - orbital-command.ts            throttle, plain debounce, dispatch:
//                                    race/waterfall, useGroup, useBranch
// This file deliberately stays out of that territory and exercises what's
// left: debounce WITH maxWait (a flush guarantee under continuous input),
// native multi-handler dispatch (`parallel`/`sequential`, not useGroup) with
// both error strategies, IntraLink auto-chaining, the useCyre hook, and the
// lock()/getMetrics() control surface.
//
// A note on IntraLink: orbital-command.ts carries a comment claiming a
// handler's {id, payload} return value does NOT auto-chain to the next
// channel in the current build, and works around it with explicit
// branch.call(...). Reading cyre-dispatch.ts directly shows a
// followIntraLink() step that DOES implement that auto-chaining. Those two
// sources disagree - section 3 below is written to self-report which one is
// true on whatever build you actually run it against, rather than asserting
// either way.
import {cyre, useCyre, log} from '../src'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

await cyre.init()

// =============================================================================
// 1) DEBOUNCE + MAXWAIT  →  a "keep typing" search box that still has to
//    ship a result eventually, even if the user never stops typing
// =============================================================================
console.log('\n=== 1) debounce (150ms) + maxWait (400ms) ===')

cyre.action({id: 'search/query', debounce: 150, maxWait: 400})

const searchFirings: string[] = []
cyre.on('search/query', (term: string) => {
  searchFirings.push(term)
  log.debug(`  🔎 searching for: "${term}"`)
  return term
})

// Keystrokes every 100ms - each one resets the 150ms debounce timer, so
// without maxWait the search would NEVER fire while typing continues.
// maxWait forces a flush once 400ms have passed since the first keystroke.
for (const term of ['w', 'wi', 'wid', 'widg', 'widge', 'widget']) {
  await cyre.call('search/query', term)
  await wait(100)
}
await wait(300)

console.log(`  search fired for: ${JSON.stringify(searchFirings)}`)
console.log(
  searchFirings.length >= 1
    ? '✅ maxWait forced a flush instead of debounce stalling indefinitely'
    : '❌ debounce never flushed despite maxWait'
)

// =============================================================================
// 2) NATIVE MULTI-HANDLER DISPATCH  →  `dispatch` on the ACTION controls how
//    MULTIPLE .on() handlers on the SAME channel run. This is a different
//    mechanism from useGroup (which fans a call out across DIFFERENT
//    channels) - here it's one channel, several handlers.
// =============================================================================
console.log('\n=== 2a) dispatch: parallel, errorStrategy: continue ===')

cyre.action({
  id: 'notify/customer',
  dispatch: 'parallel',
  errorStrategy: 'continue',
  collectResults: 'all'
})
const notifiedVia: string[] = []
cyre.on('notify/customer', async (msg: string) => {
  await wait(30)
  notifiedVia.push('email')
  return 'email:' + msg
})
cyre.on('notify/customer', async () => {
  throw new Error('sms gateway down') // one handler fails...
})
cyre.on('notify/customer', async (msg: string) => {
  await wait(10)
  notifiedVia.push('push')
  return 'push:' + msg
})

const parallelResult = await cyre.call('notify/customer', 'order shipped')
console.log(`  handlers that succeeded: ${JSON.stringify(notifiedVia)}`)
console.log(
  `  overall call ok: ${parallelResult.ok} - ${parallelResult.message}`
)
console.log(
  parallelResult.ok &&
    notifiedVia.includes('email') &&
    notifiedVia.includes('push')
    ? '✅ errorStrategy "continue" let the other channels succeed despite one failure'
    : '❌ one failing handler took down the whole parallel dispatch'
)

console.log('\n=== 2b) dispatch: sequential, errorStrategy: fail-fast ===')

cyre.action({
  id: 'expense/approve',
  dispatch: 'sequential',
  errorStrategy: 'fail-fast',
  collectResults: 'all'
})
const approvalSteps: string[] = []
cyre.on('expense/approve', (amount: number) => {
  approvalSteps.push('manager')
  if (amount > 1000) throw new Error('exceeds manager authority')
  return {step: 'manager', amount}
})
cyre.on('expense/approve', (amount: number) => {
  approvalSteps.push('finance') // should NOT run if manager step throws
  return {step: 'finance', amount}
})

const rejected = await cyre.call('expense/approve', 5000)
console.log(`  steps that ran: ${JSON.stringify(approvalSteps)}`)
console.log(`  call ok: ${rejected.ok} - ${rejected.message}`)
console.log(
  approvalSteps.join(',') === 'manager' && !rejected.ok
    ? '✅ fail-fast stopped the chain at the first failing handler'
    : '❌ the sequential chain kept going (or reported success) after a failure'
)

// =============================================================================
// 3) INTRALINK  →  a handler returning {id, payload} is documented to
//    auto-trigger another channel. See the header note above - this section
//    tells you which behavior your build actually has.
// =============================================================================
console.log(
  '\n=== 3) IntraLink: order/received -> order/validated -> order/shipped ==='
)

const orderTrail: string[] = []

cyre.action({id: 'order/received'})
cyre.on('order/received', (order: {sku: string; qty: number}) => {
  orderTrail.push('received')
  return {id: 'order/validated', payload: order} // documented auto-chain signal
})

cyre.action({id: 'order/validated'})
cyre.on('order/validated', (order: {sku: string; qty: number}) => {
  orderTrail.push('validated')
  return {id: 'order/shipped', payload: {...order, trackingId: 'TRK-001'}}
})

cyre.action({id: 'order/shipped'})
cyre.on(
  'order/shipped',
  (order: {sku: string; qty: number; trackingId: string}) => {
    orderTrail.push('shipped')
    log.debug(`  🚚 shipped ${order.qty}x ${order.sku} (${order.trackingId})`)
    return order
  }
)

await cyre.call('order/received', {sku: 'widget-9', qty: 2})
await wait(20) // give a possible chained call() a tick to land

console.log(
  `  trail after a SINGLE cyre.call('order/received', ...): ${JSON.stringify(orderTrail)}`
)
if (orderTrail.join('>') === 'received>validated>shipped') {
  console.log(
    '✅ this build DOES auto-chain on {id, payload} - IntraLink is live'
  )
} else {
  console.log(
    `ℹ️  this build stopped after "${orderTrail.join('>')}" - IntraLink did NOT auto-chain here, ` +
      "matching orbital-command.ts's note. Chain the channels explicitly with cyre.call(...) instead."
  )
}

// =============================================================================
// 4) useCyre HOOK  →  a channel bound to a single object instead of juggling
//    a raw string id everywhere - .call/.on/.get/.forget all close over the
//    same generated (or given) channel id.
// =============================================================================
console.log('\n=== 4) useCyre hook ===')

const counter = useCyre(cyre, {id: 'ui/counter', detectChanges: true})

let lastSeen: number | undefined
counter.on((value: number) => {
  lastSeen = value
  log.debug(`  🔢 counter -> ${value}`)
  return value
})

await counter.call(1)
await counter.call(1) // detectChanges should suppress this duplicate
await counter.call(2)

console.log(`  hook stats: ${JSON.stringify(counter.getStats())}`)
console.log(`  last value seen by handler: ${lastSeen}`)
console.log(
  lastSeen === 2
    ? '✅ the hook-bound channel behaves exactly like a normal cyre channel'
    : '❌ unexpected value reached the handler through the hook'
)

// =============================================================================
// 5) SYSTEM CONTROL  →  per-channel metrics, then lock() to freeze
//    registration for the remainder of the process.
// =============================================================================
console.log('\n=== 5) getMetrics + lock ===')

const searchMetrics = cyre.getMetrics('search/query') as any
console.log(
  `  "search/query" executions: ${searchMetrics.executionCount}, errors: ${searchMetrics.errorCount}`
)

const systemMetrics = cyre.getMetrics() as any
console.log(`  registered channels: ${systemMetrics.stores?.channels}`)
console.log(`  system healthy: ${systemMetrics.system?.health?.isHealthy}`)

cyre.lock()
const blockedRegistration = cyre.action({id: 'too-late/channel'})
console.log(
  `  registering a new channel after lock() -> ok:${blockedRegistration.ok}`
)
console.log(
  !blockedRegistration.ok
    ? '✅ lock() froze registration as expected'
    : '❌ a new channel registered even though the system was locked'
)

console.log('\ndone.')
