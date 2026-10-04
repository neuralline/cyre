// demo/detectchanges-1000-calls-demo.ts
// Cyre's `detectChanges` talent (src/schema/talent-definitions.ts) runs a
// shallow fastEquals() against the channel's last *request* payload
// (src/context/payload-state.ts) before the handler ever runs, and blocks
// the call outright ({ok:false, message:'No changes detected - execution
// blocked'}) when nothing changed. That's a real trade: every call now
// pays for a comparison, in exchange for skipping the handler entirely
// when the payload is a repeat.
//
// This demo asks the practical question directly, with real cyre.call()s,
// not synthetic timing: is that trade worth it? 1000 calls per scenario,
// same repeated payload (the case detectChanges exists for) run through
// four configurations - detectChanges on/off, crossed with a trivial
// ".on() just returns the payload" handler vs a "little bit heavy" one
// that does real synchronous work - plus, so the answer isn't one-sided,
// the mirror image: 1000 calls with a *different* payload every time,
// which is detectChanges' worst case (it never blocks anything, so every
// comparison is pure added overhead).
//
// Reject-vs-pass-through is checked directly off cyre.call()'s own
// result.ok and the handler's own execution counter - not inferred from
// timing.
import {cyre} from '../src'

const CALLS = 1000

// A modest, deliberately "not free" synchronous handler - enough to
// resemble real work (a bit of parsing/formatting/validation) without
// turning this into a stress test like demo/channel-fairness-demo.ts's
// burnCpu(4).
const burnCpu = (ms: number): number => {
  const end = performance.now() + ms
  let x = 0
  while (performance.now() < end) x += Math.sqrt(x + 1)
  return x
}

type HandlerWeight = 'light' | 'heavy'
type PayloadMode = 'unchanged' | 'changing'

interface RunResult {
  detectChanges: boolean
  handlerWeight: HandlerWeight
  payloadMode: PayloadMode
  totalMs: number
  callsPerSec: number
  avgLatencyUs: number
  executed: number
  passedThrough: number
  blocked: number
}

const runScenario = async (
  detectChanges: boolean,
  handlerWeight: HandlerWeight,
  payloadMode: PayloadMode
): Promise<RunResult> => {
  const id = `detectchanges-demo/${detectChanges}/${handlerWeight}/${payloadMode}`
  let executed = 0

  cyre.action({id, detectChanges})
  cyre.on(id, (payload: unknown) => {
    executed++
    if (handlerWeight === 'heavy') burnCpu(0.3)
    return payload
  })

  let passedThrough = 0
  let blocked = 0

  const start = performance.now()
  for (let i = 0; i < CALLS; i++) {
    // Same shallow shape every call in 'unchanged' mode - a fresh object
    // literal each time (not the same reference) so this genuinely
    // exercises fastEquals' value comparison, not a `===` shortcut on a
    // reused object.
    const payload =
      payloadMode === 'unchanged'
        ? {userId: 1001, status: 'active', count: 42}
        : {userId: 1001, status: 'active', count: i}

    const result = await cyre.call(id, payload)
    if (result.ok) passedThrough++
    else blocked++
  }
  const totalMs = performance.now() - start

  cyre.forget(id)

  return {
    detectChanges,
    handlerWeight,
    payloadMode,
    totalMs: Number(totalMs.toFixed(2)),
    callsPerSec: Math.round((CALLS / totalMs) * 1000),
    avgLatencyUs: Number(((totalMs / CALLS) * 1000).toFixed(1)),
    executed,
    passedThrough,
    blocked
  }
}

const fmt = (r: RunResult): string =>
  `${r.detectChanges ? 'detectChanges:true ' : 'no check          '} | ` +
  `${r.handlerWeight.padEnd(5)} handler | ` +
  `${r.payloadMode.padEnd(9)} payload | ` +
  `${r.totalMs.toString().padStart(8)}ms total | ` +
  `${r.callsPerSec.toString().padStart(7)} calls/s | ` +
  `${r.avgLatencyUs.toString().padStart(7)}us/call | ` +
  `executed:${r.executed.toString().padStart(4)} ` +
  `passed:${r.passedThrough.toString().padStart(4)} ` +
  `blocked:${r.blocked.toString().padStart(4)}`

const main = async () => {
  await cyre.init()

  console.log('\n' + '='.repeat(96))
  console.log(
    '  C Y R E   D E T E C T C H A N G E S   -   1 0 0 0   C A L L   S P E E D   T E S T'
  )
  console.log('='.repeat(96))
  console.log(`${CALLS} sequential cyre.call()s per scenario\n`)

  const results: RunResult[] = []

  for (const payloadMode of ['unchanged', 'changing'] as PayloadMode[]) {
    for (const handlerWeight of ['light', 'heavy'] as HandlerWeight[]) {
      const off = await runScenario(false, handlerWeight, payloadMode)
      const on = await runScenario(true, handlerWeight, payloadMode)
      results.push(off, on)

      console.log(
        `-- ${payloadMode.toUpperCase()} payload / ${handlerWeight.toUpperCase()} handler --`
      )
      console.log('  ' + fmt(off))
      console.log('  ' + fmt(on))

      const deltaMs = Number((off.totalMs - on.totalMs).toFixed(2))
      const pct = Number(((deltaMs / off.totalMs) * 100).toFixed(1))
      const verdict =
        deltaMs > 0
          ? `detectChanges was ${Math.abs(pct)}% FASTER (saved ${deltaMs}ms, skipped ${on.blocked} of ${CALLS} handler runs)`
          : `detectChanges was ${Math.abs(pct)}% SLOWER (cost ${Math.abs(deltaMs)}ms - comparison overhead with nothing to skip)`
      console.log(`  => ${verdict}\n`)
    }
  }

  console.log('='.repeat(96))
  console.log('  SUMMARY')
  console.log('='.repeat(96))
  console.log(
    'unchanged payload = the case detectChanges exists for (repeat calls, same data).'
  )
  console.log(
    'changing payload  = detectChanges\' worst case (always different data, never blocks -\n' +
      '                    every call still pays the fastEquals comparison for nothing).'
  )
  console.log(
    '\nRule of thumb this run should confirm: the heavier the .on() handler and the more\n' +
      'often payloads repeat, the more worth it detectChanges is. With a near-free handler\n' +
      'and payloads that always change, it is close to a wash or a small net cost - the\n' +
      'comparison itself is cheap (shallow, no JSON/deep-equal), but it is not free.'
  )
}

main().catch(console.error)
