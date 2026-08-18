// demo/cyre-claims-audit.ts
// A verdict-by-verdict audit of Cyre's advertised behaviour, run against a
// real `cyre` import — not a static reading of source or docs. Each test
// makes a specific claim (from README.md or the project's own
// claude/cyre-codebase-analysis.md), exercises it live, and records
// CONFIRMED / BROKEN / PARTIAL based on what actually happens.

import {cyre} from 'cyre'

/**
 * 🔬 CYRE CLAIMS AUDIT
 *
 * Every test below is a small, self-contained experiment: register a
 * channel, do the thing the docs say should work, and check the observed
 * result against the claim — not against what we expect. A few tests are
 * deliberately "control cases" (things we believe DO work) so this reads
 * as a fair audit rather than a list of complaints.
 */

interface Verdict {
  claim: string
  source: string
  verdict: 'CONFIRMED' | 'BROKEN' | 'PARTIAL'
  detail: string
}

const verdicts: Verdict[] = []

function record(
  claim: string,
  source: string,
  verdict: Verdict['verdict'],
  detail: string
) {
  verdicts.push({claim, source, verdict, detail})
  const icon =
    verdict === 'CONFIRMED' ? '✅' : verdict === 'PARTIAL' ? '⚠️ ' : '❌'
  console.log(`${icon} [${verdict}] ${claim}`)
  console.log(`   ${detail}\n`)
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  console.log('='.repeat(72))
  console.log('  C.Y.R.E   C L A I M S   A U D I T')
  console.log('  Live-testing README claims and known-gap findings')
  console.log('='.repeat(72) + '\n')

  await cyre.init()

  // ── Test 1: IntraLink auto-chaining ────────────────────────────────────
  console.log('── Test 1: IntraLink auto-chaining ──')
  let chainBFired = false
  cyre.action({id: 'audit/chain-a'})
  cyre.action({id: 'audit/chain-b'})
  cyre.on('audit/chain-a', (payload: any) => {
    // README: "Return IntraLink to trigger next action"
    return {id: 'audit/chain-b', payload}
  })
  cyre.on('audit/chain-b', (payload: any) => {
    chainBFired = true
    return {received: payload}
  })
  await cyre.call('audit/chain-a', {hello: 'world'})
  await sleep(50) // grace period in case chaining is async
  record(
    'A handler returning {id, payload} auto-triggers the next channel ("IntraLink")',
    'README.md — "IntraLink Chain Reactions"',
    chainBFired ? 'CONFIRMED' : 'BROKEN',
    chainBFired
      ? 'chain-b fired automatically after chain-a returned {id: chain-b, payload}'
      : 'chain-b never fired. Returning {id, payload} from a handler does nothing by itself — call the next channel explicitly (e.g. branch.call(...)) instead.'
  )

  // ── Test 2/3/4: methods the README shows but app.ts may not export ─────
  record(
    'cyre.isHealthy() exists and returns a boolean',
    'README.md — "cyre.isHealthy()" in Monitoring & Debugging',
    typeof (cyre as any).isHealthy === 'function' ? 'CONFIRMED' : 'BROKEN',
    typeof (cyre as any).isHealthy === 'function'
      ? 'method exists on the cyre instance'
      : 'no isHealthy() method on the cyre object — use cyre.getMetrics().system.health.isHealthy instead'
  )

  record(
    'cyre.getBreathingState() exists',
    'README.md — "cyre.getBreathingState()" in Monitoring & Debugging',
    typeof (cyre as any).getBreathingState === 'function'
      ? 'CONFIRMED'
      : 'BROKEN',
    typeof (cyre as any).getBreathingState === 'function'
      ? 'method exists on the cyre instance'
      : 'no getBreathingState() method — breathing stats are only reachable via cyre.getMetrics().system.breathing'
  )

  record(
    'cyre.payloadState.get(...) is exposed on the cyre instance',
    'README.md — "Direct Use of cyre.payloadState"',
    typeof (cyre as any).payloadState === 'object' &&
      (cyre as any).payloadState !== null
      ? 'CONFIRMED'
      : 'BROKEN',
    typeof (cyre as any).payloadState === 'object' &&
      (cyre as any).payloadState !== null
      ? 'payloadState is exposed'
      : 'no payloadState property on the cyre object — cyre.get(id) returns {req, res, metadata} instead (see Test 5)'
  )

  // ── Test 5: cyre.get(id) shape (control case) ───────────────────────────
  cyre.action({id: 'audit/get-shape', payload: {n: 0}})
  cyre.on('audit/get-shape', (p: any) => ({doubled: p.n * 2}))
  await cyre.call('audit/get-shape', {n: 21})
  const shape: any = cyre.get('audit/get-shape')
  const hasReqRes =
    !!shape && 'req' in shape && 'res' in shape && 'metadata' in shape
  record(
    'cyre.get(id) returns {req, res, metadata} (dual request/response payload state)',
    'README.md — "cyre.get(id) ... will include {req,res}"',
    hasReqRes ? 'CONFIRMED' : 'BROKEN',
    hasReqRes
      ? `shape confirmed — req:${JSON.stringify(shape.req)}  res.payload:${JSON.stringify(shape.res?.payload)}`
      : `unexpected shape: ${JSON.stringify(shape)}`
  )

  // ── Test 6: waterfall + errorStrategy:"continue" ────────────────────────
  console.log(
    '── Test 6: waterfall error handling under errorStrategy:"continue" ──'
  )
  cyre.action({
    id: 'audit/waterfall-continue',
    dispatch: 'waterfall',
    errorStrategy: 'continue'
  })
  cyre.on('audit/waterfall-continue', (n: number) => n + 1) // 1 -> 2
  cyre.on('audit/waterfall-continue', () => {
    throw new Error('deliberate failure')
  })
  cyre.on('audit/waterfall-continue', (n: number) => n * 10) // whatever survives -> *10
  const wfContinue = await cyre.call('audit/waterfall-continue', 1)
  const reportedFailure =
    wfContinue.ok === false || (wfContinue.metadata as any)?.failedHandlers > 0
  record(
    'Waterfall with errorStrategy:"continue" reports the failure (ok:false or failedHandlers > 0) rather than silently succeeding',
    'claude/cyre-codebase-analysis.md — "Waterfall silently swallows errors under non-fail-fast strategies"',
    reportedFailure ? 'CONFIRMED' : 'BROKEN',
    reportedFailure
      ? 'the failure was correctly reflected in the response'
      : `pipeline reported ok:${wfContinue.ok}, failedHandlers:${
          (wfContinue.metadata as any)?.failedHandlers ?? 0
        }/3, final payload ${JSON.stringify(
          wfContinue.payload
        )} — handler 2's throw was silently dropped; handler 3 ran on handler 1's stale output as if nothing failed`
  )

  // ── Test 7: waterfall + errorStrategy:"fail-fast" (control case) ───────
  console.log(
    '── Test 7: waterfall error handling under errorStrategy:"fail-fast" (control case) ──'
  )
  cyre.action({
    id: 'audit/waterfall-failfast',
    dispatch: 'waterfall',
    errorStrategy: 'fail-fast'
  })
  cyre.on('audit/waterfall-failfast', (n: number) => n + 1)
  cyre.on('audit/waterfall-failfast', () => {
    throw new Error('deliberate failure')
  })
  cyre.on('audit/waterfall-failfast', (n: number) => n * 10)
  const wfFailFast = await cyre.call('audit/waterfall-failfast', 1)
  record(
    'Waterfall with errorStrategy:"fail-fast" correctly reports ok:false when a handler throws',
    'README.md — errorStrategy documentation (control case)',
    wfFailFast.ok === false ? 'CONFIRMED' : 'BROKEN',
    wfFailFast.ok === false
      ? `correctly reported ok:false — "${wfFailFast.message}"`
      : `expected ok:false, got ok:${wfFailFast.ok}`
  )

  // ── Test 8: forget() + re-subscribe leak ────────────────────────────────
  console.log('── Test 8: cyre.forget() actually removes the old handler ──')
  let handlerACount = 0
  let handlerBCount = 0
  cyre.action({id: 'audit/forget-test'})
  cyre.on('audit/forget-test', () => {
    handlerACount++
  })
  await cyre.call('audit/forget-test')

  cyre.forget('audit/forget-test')
  cyre.action({id: 'audit/forget-test'})
  cyre.on('audit/forget-test', () => {
    handlerBCount++
  })
  await cyre.call('audit/forget-test')

  const cleanHandoff = handlerACount === 1 && handlerBCount === 1
  record(
    'forget(id) then re-registering leaves only the new handler attached (no double-firing)',
    'claude/cyre-codebase-analysis.md — "forget()... never touches handlerStorage"',
    cleanHandoff ? 'CONFIRMED' : 'BROKEN',
    cleanHandoff
      ? 'old handler stopped firing after forget(); only the new one ran on the second call'
      : `after forget + re-register + call: old handler fired ${handlerACount} time(s) total (${
          handlerACount - 1
        } more than expected), new handler fired ${handlerBCount} time(s) — the old handler is still attached underneath`
  )

  // ── Test 9: buffered payload shape ──────────────────────────────────────
  console.log('── Test 9: buffered channel payload shape ──')
  let rawBufferedPayload: any = null
  cyre.action({
    id: 'audit/buffer-shape',
    buffer: {window: 300, strategy: 'append'}
  })
  cyre.on('audit/buffer-shape', (raw: any) => {
    rawBufferedPayload = raw
    return raw
  })
  cyre.call('audit/buffer-shape', 'first')
  cyre.call('audit/buffer-shape', 'second')
  await sleep(500)
  const isWrapped =
    rawBufferedPayload &&
    typeof rawBufferedPayload === 'object' &&
    !Array.isArray(rawBufferedPayload) &&
    'payload' in rawBufferedPayload &&
    'timestamp' in rawBufferedPayload
  record(
    "A buffered channel's handler receives the plain accumulated array, not an internal wrapper",
    'README.md — "batch is an array of payloads collected within 1s or up to 10 items"',
    isWrapped
      ? 'BROKEN'
      : Array.isArray(rawBufferedPayload)
        ? 'CONFIRMED'
        : 'PARTIAL',
    isWrapped
      ? `handler received an internal {payload, timestamp} wrapper instead of the raw batch: ${JSON.stringify(
          rawBufferedPayload
        )} — the real array is at .payload`
      : `handler received: ${JSON.stringify(rawBufferedPayload)}`
  )

  // ── Test 10: race dispatch (control case) ───────────────────────────────
  console.log(
    '── Test 10: race dispatch resolves with the fastest handler (control case) ──'
  )
  cyre.action({id: 'audit/race-test', dispatch: 'race'})
  cyre.on('audit/race-test', async () => {
    await sleep(300)
    return 'slow'
  })
  cyre.on('audit/race-test', async () => {
    await sleep(20)
    return 'fast'
  })
  const raceStart = Date.now()
  const raceResult = await cyre.call('audit/race-test')
  const raceElapsed = Date.now() - raceStart
  const raceCorrect = raceResult.payload === 'fast' && raceElapsed < 150
  record(
    'dispatch:"race" resolves with the fastest handler\'s result without waiting for slower ones',
    'README.md — "Only the fastest handler result is used"',
    raceCorrect ? 'CONFIRMED' : 'BROKEN',
    `resolved to "${raceResult.payload}" in ${raceElapsed}ms (the slow handler alone would take ~300ms)`
  )

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('='.repeat(72))
  console.log('  SUMMARY')
  console.log('='.repeat(72))
  verdicts.forEach(v => {
    const icon =
      v.verdict === 'CONFIRMED' ? '✅' : v.verdict === 'PARTIAL' ? '⚠️ ' : '❌'
    console.log(`${icon} ${v.claim}`)
  })
  const confirmed = verdicts.filter(v => v.verdict === 'CONFIRMED').length
  const broken = verdicts.filter(v => v.verdict === 'BROKEN').length
  const partial = verdicts.filter(v => v.verdict === 'PARTIAL').length
  console.log(
    `\n${confirmed} confirmed · ${broken} broken · ${partial} partial (of ${verdicts.length} claims tested)`
  )
  console.log('='.repeat(72) + '\n')

  // ── Test 11 (run last, on purpose): shutdown() behaviour ────────────────
  console.log('── Test 11: cyre.shutdown() behaviour ──')
  console.log(
    'claude/cyre-codebase-analysis.md claims shutdown() calls process.exit(0) directly.'
  )
  console.log(
    'Calling it now — if that claim holds, the script ends here and nothing after this line prints.\n'
  )
  cyre.shutdown()

  // If we ever reach this line, shutdown() did NOT exit the process as claimed.
  console.log(
    '❌ [BROKEN] shutdown() did not terminate the process as documented'
  )
  process.exit(0)
}

main().catch(error => {
  console.error('❌ Audit failed to run:', error)
  process.exit(1)
})
